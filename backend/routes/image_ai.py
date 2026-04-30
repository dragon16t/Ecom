"""AI image processing — uses Gemini Nano Banana via Emergent LLM key to remove background."""
import os
import base64
import logging
import uuid
from pathlib import Path
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from dotenv import load_dotenv

from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

load_dotenv(Path(__file__).parent.parent / ".env")

router = APIRouter()
logger = logging.getLogger(__name__)

# Admin token (imported from env, mirrors server.py)
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "celestaglow2024")

# Shared admin/employee sessions (set by server.py)
_admin_sessions: dict = {}


def set_admin_sessions(sessions: dict):
    global _admin_sessions
    _admin_sessions = sessions


def _verify_admin_token(x_admin_token: Optional[str]):
    if not x_admin_token:
        raise HTTPException(status_code=401, detail="Admin token required")
    if x_admin_token == ADMIN_PASSWORD:
        return True
    if x_admin_token in _admin_sessions:
        return True
    raise HTTPException(status_code=403, detail="Invalid admin token")


class RemoveBGRequest(BaseModel):
    image_url: str
    mode: Optional[str] = "white"  # "white" | "transparent"


# Upload directory (served by FastAPI via /uploads mount in server.py, or use static)
UPLOAD_DIR = Path(__file__).parent.parent / "uploads" / "ai_bg"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@router.post("/admin/ai/remove-bg")
async def remove_background(
    request: RemoveBGRequest,
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
):
    """Remove background from a product image using Gemini Nano Banana.

    Returns a base64 data URL of the processed PNG that the admin UI can
    preview and then save by replacing the product's image URL.
    """
    _verify_admin_token(x_admin_token)

    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="EMERGENT_LLM_KEY not configured")

    # 1. Download the source image
    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            resp = await client.get(request.image_url)
            resp.raise_for_status()
            source_bytes = resp.content
    except Exception as e:
        logger.error(f"Failed to download image: {e}")
        raise HTTPException(status_code=400, detail=f"Could not download image: {str(e)[:120]}")

    if len(source_bytes) > 8 * 1024 * 1024:  # 8 MB limit
        raise HTTPException(status_code=413, detail="Image too large (max 8 MB)")

    src_b64 = base64.b64encode(source_bytes).decode("utf-8")

    # 2. Instruct Gemini Nano Banana to remove background
    bg_desc = (
        "pure white studio background (#FFFFFF)"
        if request.mode == "white"
        else "completely transparent background (alpha channel)"
    )
    prompt = (
        "Edit this image: isolate the main product in the foreground and replace the "
        f"entire background with a {bg_desc}. Keep the product crisp, centered, and "
        "photorealistic with natural lighting. Do not add any new elements, shadows, text, "
        "or decorations. Only the product on the clean background."
    )

    try:
        chat = LlmChat(
            api_key=api_key,
            session_id=f"bg-remove-{uuid.uuid4().hex[:8]}",
            system_message="You are a professional product-photography background removal tool.",
        )
        chat.with_model("gemini", "gemini-3.1-flash-image-preview").with_params(
            modalities=["image", "text"]
        )
        msg = UserMessage(text=prompt, file_contents=[ImageContent(src_b64)])
        _text, images = await chat.send_message_multimodal_response(msg)
    except Exception as e:
        logger.error(f"Gemini call failed: {e}")
        raise HTTPException(status_code=502, detail=f"AI processing failed: {str(e)[:160]}")

    if not images:
        raise HTTPException(status_code=502, detail="AI did not return an edited image")

    out_img = images[0]
    out_bytes = base64.b64decode(out_img["data"])
    mime = out_img.get("mime_type", "image/png")

    # 3. Save to disk so admin can reference a stable URL
    ext = "png" if "png" in mime else "jpg"
    filename = f"bg-{uuid.uuid4().hex[:12]}.{ext}"
    out_path = UPLOAD_DIR / filename
    with open(out_path, "wb") as f:
        f.write(out_bytes)

    # Build a public URL. server.py mounts /api/uploads → backend/uploads
    public_url = f"/api/uploads/ai_bg/{filename}"

    return {
        "success": True,
        "image_url": public_url,
        "mime_type": mime,
        "size_bytes": len(out_bytes),
        # Also return a data URL fallback for instant preview without cache issues
        "data_url": f"data:{mime};base64,{base64.b64encode(out_bytes).decode('utf-8')}",
    }


# ==================== AI PRODUCT CONTENT GENERATION ====================

class GenerateContentRequest(BaseModel):
    name: str
    niche: Optional[str] = "skincare"
    category: Optional[str] = ""
    concerns: Optional[list] = []
    brand: Optional[str] = "Celesta Glow"
    key_ingredients: Optional[str] = ""


@router.post("/admin/ai/generate-product-content")
async def generate_product_content(
    request: GenerateContentRequest,
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
):
    """Generate full product page content (tagline, description, benefits, how_to_use,
    key_ingredients, ingredients_full, faqs) using Gemini text via Emergent LLM key.

    Returns a structured dict the admin UI can prefill into the product editor.
    """
    _verify_admin_token(x_admin_token)

    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="EMERGENT_LLM_KEY not configured")

    concerns_str = ", ".join(request.concerns or []) or "general skincare"
    brand = request.brand or "Celesta Glow"
    prompt = f"""You are a senior copywriter for "{brand}", an Indian skincare/cosmetics brand. Generate compelling, dermatologist-friendly product page content for the product below.

Product: {request.name}
Niche: {request.niche}
Category: {request.category or 'general'}
Targets concerns: {concerns_str}
Known ingredients (if any): {request.key_ingredients or 'auto-pick suitable actives'}

Return ONLY a JSON object (no markdown, no commentary) with EXACTLY these keys:
{{
  "tagline": "<one short benefit-led tagline, max 12 words>",
  "description": "<2-3 sentence paragraph for the product hero>",
  "key_ingredients": "<comma-separated 3-5 hero actives>",
  "ingredients_full": "<full INCI-style ingredients list (realistic, comma-separated)>",
  "benefits": ["<benefit 1>", "<benefit 2>", "<benefit 3>", "<benefit 4>"],
  "how_to_use": "<3-4 short steps separated by newlines, e.g. 1. Cleanse...\\n2. Apply...>",
  "size": "<typical pack size for this product, e.g. 30ml or 50g>",
  "faqs": [
    {{"q": "<question 1>", "a": "<short answer>"}},
    {{"q": "<question 2>", "a": "<short answer>"}},
    {{"q": "<question 3>", "a": "<short answer>"}}
  ]
}}

Tone: trustworthy, clinical-but-warm, India-aware (no foreign units). Avoid hype words like "miracle", "instant cure".
"""

    try:
        chat = LlmChat(
            api_key=api_key,
            session_id=f"prodgen-{uuid.uuid4().hex[:8]}",
            system_message="You are a precise JSON-only copywriting API for a skincare brand.",
        )
        chat.with_model("anthropic", "claude-sonnet-4-5-20250929")
        msg = UserMessage(text=prompt)
        text_resp = await chat.send_message(msg)
    except Exception as e:
        logger.error(f"AI content generation failed: {e}")
        raise HTTPException(status_code=502, detail=f"AI content generation failed: {str(e)[:160]}")

    # Parse JSON from response (strip markdown fences if any)
    import json
    import re

    raw = (text_resp or "").strip()
    # Strip ```json ... ``` fences
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)
    try:
        data = json.loads(raw)
    except Exception:
        # Try to extract first JSON object via regex
        m = re.search(r"\{[\s\S]*\}", raw)
        if not m:
            raise HTTPException(status_code=502, detail="AI returned non-JSON content")
        try:
            data = json.loads(m.group(0))
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Failed to parse AI JSON: {str(e)[:100]}")

    # Normalize keys
    return {
        "success": True,
        "tagline": data.get("tagline", ""),
        "description": data.get("description", ""),
        "key_ingredients": data.get("key_ingredients", ""),
        "ingredients_full": data.get("ingredients_full", ""),
        "benefits": data.get("benefits", []) if isinstance(data.get("benefits"), list) else [],
        "how_to_use": data.get("how_to_use", ""),
        "size": data.get("size", ""),
        "faqs": data.get("faqs", []) if isinstance(data.get("faqs"), list) else [],
    }

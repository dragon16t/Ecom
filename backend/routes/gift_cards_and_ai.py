"""Gift card admin + checkout APIs + AI-powered product enrichment endpoints.

Endpoints:
  Admin:
    GET    /api/admin/gift-cards
    POST   /api/admin/gift-cards            create
    PUT    /api/admin/gift-cards/{code}
    DELETE /api/admin/gift-cards/{code}
    GET    /api/admin/gift-cards/{code}/history
  Public (checkout):
    POST   /api/gift-cards/validate         {code, order_amount} → {valid, discount, ...}

  AI product enrichment (admin):
    POST   /api/admin/products/{slug}/fill-with-ai   re-generates description, benefits, how-to-use, key ingredients (price untouched)
    POST   /api/admin/products/analyze-url           {url} → scraped/enriched dict (admin pastes brand page URL)
    PUT    /api/admin/products/{slug}                update fields (price guard: prepaid_price/cod_price unchanged unless explicitly opted-in)
"""
from __future__ import annotations
from fastapi import APIRouter, Header, HTTPException, Cookie, Body, Query
from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime, timezone
import os
import re
import json
import logging
import uuid

router = APIRouter(prefix="/api", tags=["gift-cards-and-product-ai"])
logger = logging.getLogger(__name__)

_db = None
_gift_card_service = None
_verify_admin = None


def setup(db, gift_card_service, verify_admin_fn):
    global _db, _gift_card_service, _verify_admin
    _db = db
    _gift_card_service = gift_card_service
    _verify_admin = verify_admin_fn


def _auth(x_admin_token, admin_session):
    if _verify_admin is None:
        raise HTTPException(status_code=500, detail="auth not wired")
    _verify_admin(x_admin_token=x_admin_token, admin_session=admin_session)


# ============================================================
# ADMIN — Gift Cards CRUD
# ============================================================

class GiftCardCreate(BaseModel):
    code: Optional[str] = None
    initial_balance: float
    label: Optional[str] = ""
    expiry_date: Optional[str] = None


class GiftCardUpdate(BaseModel):
    label: Optional[str] = None
    is_active: Optional[bool] = None
    expiry_date: Optional[str] = None
    remaining_balance: Optional[float] = None


@router.get("/admin/gift-cards")
async def list_gift_cards(
    page: int = 1, limit: int = 50,
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
    admin_session: Optional[str] = Cookie(None),
):
    _auth(x_admin_token, admin_session)
    return await _gift_card_service.list_cards(page=page, limit=limit)


@router.post("/admin/gift-cards")
async def create_gift_card(
    body: GiftCardCreate,
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
    admin_session: Optional[str] = Cookie(None),
):
    _auth(x_admin_token, admin_session)
    try:
        return await _gift_card_service.create_card(body.code, body.initial_balance, body.label or "", body.expiry_date)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/admin/gift-cards/{code}")
async def update_gift_card(
    code: str,
    body: GiftCardUpdate,
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
    admin_session: Optional[str] = Cookie(None),
):
    _auth(x_admin_token, admin_session)
    fields = body.model_dump(exclude_none=True)
    return await _gift_card_service.update(code, **fields)


@router.delete("/admin/gift-cards/{code}")
async def delete_gift_card(
    code: str,
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
    admin_session: Optional[str] = Cookie(None),
):
    _auth(x_admin_token, admin_session)
    ok = await _gift_card_service.delete(code)
    return {"success": ok}


@router.get("/admin/gift-cards/{code}/history")
async def gift_card_history(
    code: str,
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
    admin_session: Optional[str] = Cookie(None),
):
    _auth(x_admin_token, admin_session)
    return {"redemptions": await _gift_card_service.history(code)}


# ============================================================
# PUBLIC — Validate gift card on checkout
# ============================================================

class GiftCardValidateRequest(BaseModel):
    code: str
    order_amount: float


@router.post("/gift-cards/validate")
async def validate_gift_card(body: GiftCardValidateRequest):
    return await _gift_card_service.validate_for_redemption(body.code, body.order_amount)


# ============================================================
# ADMIN — Per-product edit + AI fill + URL analyze
# ============================================================

class ProductFieldsUpdate(BaseModel):
    name: Optional[str] = None
    short_name: Optional[str] = None
    description: Optional[str] = None
    key_ingredients: Optional[str] = None
    ingredients_full: Optional[str] = None
    benefits: Optional[list] = None
    how_to_use: Optional[str] = None
    size: Optional[str] = None
    images: Optional[list] = None
    image: Optional[str] = None  # singular form used by older bulk-imported products & QuickImageEditor
    category: Optional[str] = None
    concerns: Optional[list] = None
    badges: Optional[list] = None
    brand: Optional[str] = None
    tagline: Optional[str] = None
    stock_qty: Optional[int] = None
    is_to_be_launched: Optional[bool] = None
    is_active: Optional[bool] = None
    # PRICE CHANGES — guarded: pass allow_price_change=true to update
    prepaid_price: Optional[float] = None
    cod_price: Optional[float] = None
    mrp: Optional[float] = None
    allow_price_change: bool = False


@router.put("/admin/products/{slug}")
async def admin_update_product(
    slug: str,
    body: ProductFieldsUpdate,
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
    admin_session: Optional[str] = Cookie(None),
):
    """Admin edit — by default does NOT change prices (per user spec).
    Pass allow_price_change=true to update prepaid/cod/MRP.
    """
    _auth(x_admin_token, admin_session)
    upd = body.model_dump(exclude_none=True)
    allow_price = upd.pop("allow_price_change", False)
    if not allow_price:
        for k in ("prepaid_price", "cod_price", "mrp"):
            upd.pop(k, None)
    if not upd:
        raise HTTPException(status_code=400, detail="Nothing to update")
    upd["updated_at"] = datetime.now(timezone.utc).isoformat()
    r = await _db.products.update_one({"slug": slug}, {"$set": upd})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    prod = await _db.products.find_one({"slug": slug}, {"_id": 0})
    return prod


class FillWithAIRequest(BaseModel):
    fields: Optional[list] = None  # ["description", "benefits", "how_to_use", "key_ingredients", "concerns"]


@router.post("/admin/products/{slug}/fill-with-ai")
async def fill_with_ai(
    slug: str,
    body: Optional[FillWithAIRequest] = None,
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
    admin_session: Optional[str] = Cookie(None),
):
    """Re-generate description / benefits / how-to-use / key ingredients with Claude.
    Price is never touched.
    """
    _auth(x_admin_token, admin_session)
    prod = await _db.products.find_one({"slug": slug}, {"_id": 0})
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")

    api_key = os.environ.get("EMERGENT_LLM_KEY", "")
    if not api_key:
        raise HTTPException(status_code=503, detail="Emergent LLM key not configured")

    from emergentintegrations.llm.chat import LlmChat, UserMessage
    prompt = f"""Product to enrich:
Brand: {prod.get('brand', '')}
Name: {prod.get('name', '')}
Type: {prod.get('subcategory', '')}
Niche: {prod.get('niche', '')}

Return STRICT JSON only (no markdown fences), exactly these keys:
{{
  "description": "120-180 word consumer-facing product description for an Indian beauty store. Mention key benefits and how it suits Indian skin/weather.",
  "key_ingredients": "Comma-separated 3-6 hero ingredients (omit if obviously cosmetic/makeup)",
  "benefits": ["3-5 short benefit phrases, each <=8 words"],
  "how_to_use": "1-2 sentence usage instruction",
  "tagline": "5-8 word punchy product tagline"
}}
Be factual, concise, no medical claims."""

    try:
        chat = LlmChat(
            api_key=api_key,
            session_id=f"fill-{uuid.uuid4().hex[:8]}",
            system_message="You are an expert Indian beauty/skincare cataloging assistant.",
        ).with_model("anthropic", "claude-haiku-4-5-20251001")
        resp = await chat.send_message(UserMessage(text=prompt))
        match = re.search(r"\{[\s\S]*\}", resp or "")
        if not match:
            raise ValueError("No JSON in LLM response")
        data = json.loads(match.group())
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI enrichment failed: {e}")

    upd = {
        "description": (data.get("description") or "")[:1800],
        "key_ingredients": (data.get("key_ingredients") or "")[:400],
        "benefits": list(data.get("benefits") or [])[:8],
        "how_to_use": (data.get("how_to_use") or "")[:400],
        "tagline": (data.get("tagline") or "")[:80],
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "ai_enriched_at": datetime.now(timezone.utc).isoformat(),
    }
    await _db.products.update_one({"slug": slug}, {"$set": upd})
    return {"success": True, "updated": upd}


class AnalyzeURLRequest(BaseModel):
    url: str
    slug: Optional[str] = None  # If provided, applies result to that product


@router.post("/admin/products/analyze-url")
async def analyze_url(
    body: AnalyzeURLRequest,
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
    admin_session: Optional[str] = Cookie(None),
):
    """Scrape a brand product URL → extract name, description, ingredients,
    images. Returns structured dict. Optionally apply to an existing product slug.
    """
    _auth(x_admin_token, admin_session)
    api_key = os.environ.get("EMERGENT_LLM_KEY", "")

    # 1. Fetch HTML
    import httpx
    try:
        async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
            r = await client.get(body.url, headers={"User-Agent": "Mozilla/5.0 CelestaGlowBot"})
            r.raise_for_status()
            html = r.text
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not fetch URL: {e}")

    # 2. Extract main content
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "noscript", "iframe"]):
        tag.decompose()
    title = (soup.find("title").get_text(strip=True) if soup.find("title") else "")[:200]
    # OG image
    og_img = ""
    og = soup.find("meta", property="og:image")
    if og and og.get("content"):
        og_img = og["content"]
    # First couple of large product images
    images = []
    for img in soup.find_all("img"):
        src = img.get("src") or img.get("data-src") or ""
        if not src or src.startswith("data:"):
            continue
        if any(x in src.lower() for x in ["logo", "icon", "sprite", "favicon"]):
            continue
        if src.startswith("//"):
            src = "https:" + src
        elif src.startswith("/"):
            from urllib.parse import urljoin
            src = urljoin(body.url, src)
        images.append(src)
        if len(images) >= 4:
            break
    if og_img and og_img not in images:
        images.insert(0, og_img)
    # Text content (trim)
    text = soup.get_text(separator=" ", strip=True)[:8000]

    if not api_key:
        return {"title": title, "images": images, "raw_text_preview": text[:500]}

    # 3. LLM extraction
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    prompt = f"""URL: {body.url}
Page title: {title}
Page text (truncated):
{text[:4000]}

Extract product details. Return STRICT JSON only:
{{
  "name": "clean product name",
  "brand": "brand name",
  "description": "120-180 word consumer-facing description",
  "key_ingredients": "comma-separated 3-6 hero ingredients",
  "ingredients_full": "full INCI list if found, else ''",
  "benefits": ["3-5 short benefit phrases"],
  "how_to_use": "1-2 sentence usage",
  "size": "size like '50ml' or ''",
  "tagline": "5-8 word tagline"
}}"""
    try:
        chat = LlmChat(api_key=api_key, session_id=f"url-{uuid.uuid4().hex[:8]}",
                      system_message="You extract clean product data from brand pages.").with_model("anthropic", "claude-haiku-4-5-20251001")
        resp = await chat.send_message(UserMessage(text=prompt))
        match = re.search(r"\{[\s\S]*\}", resp or "")
        data = json.loads(match.group()) if match else {}
    except Exception as e:
        logger.warning(f"[analyze-url] LLM extraction failed: {e}")
        data = {}

    result = {
        "name": data.get("name") or title,
        "brand": data.get("brand") or "",
        "description": data.get("description") or "",
        "key_ingredients": data.get("key_ingredients") or "",
        "ingredients_full": data.get("ingredients_full") or "",
        "benefits": data.get("benefits") or [],
        "how_to_use": data.get("how_to_use") or "",
        "size": data.get("size") or "",
        "tagline": data.get("tagline") or "",
        "images": images,
        "source_url": body.url,
    }

    # Optionally apply directly to a product slug
    if body.slug:
        prod = await _db.products.find_one({"slug": body.slug}, {"_id": 0, "slug": 1})
        if prod:
            upd = {k: v for k, v in result.items() if v and k != "source_url"}
            upd["updated_at"] = datetime.now(timezone.utc).isoformat()
            upd["ai_enriched_at"] = datetime.now(timezone.utc).isoformat()
            # Don't touch price
            await _db.products.update_one({"slug": body.slug}, {"$set": upd})
            result["applied_to_slug"] = body.slug

    return result


# ============================================================
# Admin — taxonomy + reclassification trigger
# ============================================================

@router.post("/admin/taxonomy/reset-and-reclassify")
async def reset_and_reclassify(
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
    admin_session: Optional[str] = Cookie(None),
):
    """One-click: wipe concerns + skincare/cosmetics categories, seed new ones,
    then reclassify all 7000+ products by keyword rules. Idempotent."""
    _auth(x_admin_token, admin_session)
    from taxonomy_v2 import reset_taxonomy, reclassify_all_products
    tx = await reset_taxonomy(_db)
    cls = await reclassify_all_products(_db)
    return {"taxonomy": tx, "reclassification": cls}



# ============================================================
# Bulk AI Fill — enrich many products with AI in one shot
# ============================================================

_bulk_ai_jobs: Dict[str, Dict[str, Any]] = {}


async def _enrich_one_product(api_key: str, prod: dict) -> dict:
    """Call Claude Haiku to enrich a single product. Returns the update dict."""
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    prompt = f"""Product to enrich:
Brand: {prod.get('brand', '')}
Name: {prod.get('name', '')}
Type: {prod.get('subcategory') or prod.get('category', '')}
Niche: {prod.get('niche', '')}

Return STRICT JSON only (no markdown fences), exactly these keys:
{{
  "description": "120-180 word consumer-facing product description for an Indian beauty store.",
  "key_ingredients": "Comma-separated 3-6 hero ingredients (omit if obviously cosmetic/makeup)",
  "benefits": ["3-5 short benefit phrases, each <=8 words"],
  "how_to_use": "1-2 sentence usage instruction",
  "tagline": "5-8 word punchy product tagline"
}}"""
    chat = LlmChat(
        api_key=api_key,
        session_id=f"bulk-fill-{uuid.uuid4().hex[:8]}",
        system_message="You are an expert Indian beauty cataloging assistant.",
    ).with_model("anthropic", "claude-haiku-4-5-20251001")
    resp = await chat.send_message(UserMessage(text=prompt))
    match = re.search(r"\{[\s\S]*\}", resp or "")
    if not match:
        raise ValueError("No JSON in LLM response")
    data = json.loads(match.group())
    now = datetime.now(timezone.utc).isoformat()
    return {
        "description": (data.get("description") or "")[:1800],
        "key_ingredients": (data.get("key_ingredients") or "")[:400],
        "benefits": list(data.get("benefits") or [])[:8],
        "how_to_use": (data.get("how_to_use") or "")[:400],
        "tagline": (data.get("tagline") or "")[:80],
        "updated_at": now,
        "ai_enriched_at": now,
    }


async def _bulk_fill_worker(job_id: str, slugs: list, concurrency: int = 5):
    import asyncio as _aio
    api_key = os.environ.get("EMERGENT_LLM_KEY", "")
    sem = _aio.Semaphore(concurrency)
    job = _bulk_ai_jobs[job_id]

    async def one(slug: str):
        async with sem:
            try:
                prod = await _db.products.find_one({"slug": slug}, {"_id": 0})
                if not prod:
                    job["failed"] += 1
                    return
                upd = await _enrich_one_product(api_key, prod)
                await _db.products.update_one({"slug": slug}, {"$set": upd})
                job["done"] += 1
                job["last_slug"] = slug
            except Exception as e:
                logger.warning(f"[bulk-ai-fill] {slug}: {e}")
                job["failed"] += 1
                job["errors"].append({"slug": slug, "error": str(e)[:200]})

    try:
        await _aio.gather(*[one(s) for s in slugs])
        job["status"] = "completed"
    except Exception as e:
        job["status"] = "failed"
        job["fatal_error"] = str(e)


class BulkAIFillRequest(BaseModel):
    scope: str = "needs_enrichment"  # 'needs_enrichment' | 'all' | 'niche' | 'category'
    niche: Optional[str] = None
    category: Optional[str] = None
    limit: int = 200
    concurrency: int = 5
    only_missing: bool = True  # If True, skip products that already have description+benefits


@router.post("/admin/products/bulk-ai-fill")
async def bulk_ai_fill(
    body: BulkAIFillRequest = Body(...),
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
    admin_session: Optional[str] = Cookie(None),
):
    """Kick off background AI enrichment for many products.

    Returns immediately with a job_id; poll GET /admin/products/bulk-ai-fill/{job_id}.
    """
    _auth(x_admin_token, admin_session)
    api_key = os.environ.get("EMERGENT_LLM_KEY", "")
    if not api_key:
        raise HTTPException(status_code=503, detail="Emergent LLM key not configured")

    q: Dict[str, Any] = {}
    if body.scope == "niche" and body.niche:
        q["niche"] = body.niche
    elif body.scope == "category" and body.category:
        q["category"] = body.category
    if body.only_missing or body.scope == "needs_enrichment":
        q["$or"] = [
            {"description": {"$in": [None, ""]}},
            {"benefits": {"$size": 0}},
            {"key_ingredients": {"$in": [None, ""]}},
            {"ai_enriched_at": {"$exists": False}},
        ]

    cur = _db.products.find(q, {"_id": 0, "slug": 1}).limit(max(1, min(body.limit, 2000)))
    slugs = [d["slug"] async for d in cur]
    if not slugs:
        return {"success": True, "queued": 0, "message": "No products match the scope."}

    job_id = f"aifill_{uuid.uuid4().hex[:10]}"
    _bulk_ai_jobs[job_id] = {
        "job_id": job_id,
        "total": len(slugs),
        "done": 0,
        "failed": 0,
        "status": "running",
        "scope": body.scope,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "errors": [],
        "last_slug": "",
    }
    import asyncio as _aio
    _aio.create_task(_bulk_fill_worker(job_id, slugs, body.concurrency))
    return {"success": True, "job_id": job_id, "queued": len(slugs)}


@router.get("/admin/products/bulk-ai-fill/{job_id}")
async def bulk_ai_fill_status(
    job_id: str,
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
    admin_session: Optional[str] = Cookie(None),
):
    _auth(x_admin_token, admin_session)
    job = _bulk_ai_jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.get("/admin/products/bulk-ai-fill")
async def bulk_ai_fill_list(
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
    admin_session: Optional[str] = Cookie(None),
):
    """List recent bulk-ai-fill jobs (in-memory; resets on backend restart)."""
    _auth(x_admin_token, admin_session)
    items = sorted(_bulk_ai_jobs.values(), key=lambda j: j.get("created_at", ""), reverse=True)
    return {"jobs": items[:50]}



# ============================================================
# AI Analyze a SINGLE product (used by the admin edit form)
# - classifies niche/category/subcategory/concerns from name+brand
# - auto-creates any missing taxonomy rows
# - returns the routing so the form can pre-select chips
# ============================================================

class AIAnalyzeRequest(BaseModel):
    name: str
    brand: Optional[str] = ""
    main_category: Optional[str] = ""   # "skincare" | "cosmetics" | "anti-aging" (free text okay)
    product_type: Optional[str] = ""
    concern: Optional[str] = ""
    skin_type: Optional[str] = ""
    auto_create: bool = True


@router.post("/admin/ai/analyze-product")
async def admin_ai_analyze_product(
    body: AIAnalyzeRequest,
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
    admin_session: Optional[str] = Cookie(None),
):
    """Run the DB-aware AI classifier on a single product and (optionally)
    auto-create any missing taxonomy rows. Uses the SAME logic as the
    catalog-wide AI Taxonomy Audit — so the result is consistent.
    """
    _auth(x_admin_token, admin_session)
    if not body.name.strip():
        raise HTTPException(status_code=400, detail="Product name is required")

    from services.ai_categorizer import classify_one
    prod = {
        "name": body.name,
        "brand": body.brand or "",
        "niche": body.main_category or "",
        "category": "",
        "subcategory": body.product_type or "",
        "concerns": [],
        "main_category_hint": body.main_category or "",
        "product_type_hint": body.product_type or "",
        "concern_hint": body.concern or "",
        "skin_type_hint": body.skin_type or "",
    }
    try:
        result = await classify_one(_db, prod)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI classify failed: {e}")

    created: Dict[str, list] = {"categories": [], "subcategories": [], "concerns": []}
    if body.auto_create:
        if result.get("category_slug") and result.get("category_is_new"):
            exists = await _db.categories.find_one({"slug": result["category_slug"]}, {"_id": 1})
            if not exists:
                await _db.categories.insert_one({
                    "slug": result["category_slug"],
                    "name": result["category_name"],
                    "niche": result["niche"],
                    "group": result["niche"],
                    "is_parent": False,
                    "tagline": "",
                    "image": "",
                    "icon": result.get("category_icon") or "🛍️",
                    "sort_order": 99,
                    "is_active": True,
                    "ai_created": True,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                })
                created["categories"].append(result["category_slug"])
        if result.get("subcategory_slug") and result.get("subcategory_is_new"):
            exists = await _db.subcategories.find_one({"slug": result["subcategory_slug"]}, {"_id": 1})
            if not exists:
                await _db.subcategories.insert_one({
                    "slug": result["subcategory_slug"],
                    "name": result["subcategory_name"],
                    "parent_category": result["category_slug"],
                    "niche": result["niche"],
                    "tagline": "",
                    "icon": result.get("subcategory_icon") or "",
                    "image": "",
                    "sort_order": 0,
                    "is_active": True,
                    "ai_created": True,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                })
                created["subcategories"].append(result["subcategory_slug"])
        for c in result.get("concerns") or []:
            if c.get("is_new"):
                exists = await _db.concerns.find_one({"slug": c["slug"]}, {"_id": 1})
                if not exists:
                    await _db.concerns.insert_one({
                        "slug": c["slug"],
                        "name": c["name"],
                        "tagline": "",
                        "icon": "✨",
                        "image": "",
                        "accent_from": "#dcfce7",
                        "accent_to": "#bbf7d0",
                        "accent_text": "#14532d",
                        "description": "",
                        "sort_order": 99,
                        "is_active": True,
                        "niche": result["niche"],
                        "ai_created": True,
                        "created_at": datetime.now(timezone.utc).isoformat(),
                    })
                    created["concerns"].append(c["slug"])

    return {
        "success": True,
        "classification": result,
        "auto_created": created,
    }


# ============================================================
# ONE-CLICK AI Taxonomy Audit — runs across the whole catalog
# ============================================================

class AITaxonomyAuditRequest(BaseModel):
    scope: str = "needs_taxonomy"  # 'needs_taxonomy' | 'niche' | 'all'
    niche: Optional[str] = None  # used when scope='niche'
    limit: Optional[int] = None
    concurrency: int = 6
    only_missing: bool = True


@router.post("/admin/taxonomy/ai-audit")
async def admin_ai_taxonomy_audit(
    body: AITaxonomyAuditRequest = Body(default_factory=AITaxonomyAuditRequest),
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
    admin_session: Optional[str] = Cookie(None),
):
    """Kick off a background AI audit that:
      • Loads the CURRENT canonical category/subcategory/concern lists from MongoDB.
      • Classifies every product in scope against that taxonomy via Claude.
      • Auto-creates new categories / subcategories / concerns when needed.
      • Updates each product's niche/category/subcategory/concerns fields.
    Returns a job_id; poll GET /admin/taxonomy/ai-audit/{job_id}.
    """
    _auth(x_admin_token, admin_session)
    if not os.environ.get("EMERGENT_LLM_KEY"):
        raise HTTPException(status_code=503, detail="Emergent LLM key not configured")

    from services.ai_categorizer import create_audit_job, run_audit_job
    import asyncio as _aio
    job_id = create_audit_job(body.scope, body.niche, body.limit)
    _aio.create_task(run_audit_job(
        _db, job_id, body.scope, niche=body.niche, limit=body.limit,
        concurrency=max(1, min(body.concurrency, 10)),
        only_missing=body.only_missing,
    ))
    return {"success": True, "job_id": job_id}


@router.get("/admin/taxonomy/ai-audit/{job_id}")
async def admin_ai_taxonomy_audit_status(
    job_id: str,
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
    admin_session: Optional[str] = Cookie(None),
):
    _auth(x_admin_token, admin_session)
    from services.ai_categorizer import get_audit_job
    job = get_audit_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.get("/admin/taxonomy/ai-audit")
async def admin_ai_taxonomy_audit_list(
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
    admin_session: Optional[str] = Cookie(None),
):
    """Recent audit jobs (in-memory; resets on backend restart)."""
    _auth(x_admin_token, admin_session)
    from services.ai_categorizer import list_audit_jobs
    return {"jobs": list_audit_jobs()}


# ============================================================
# Danger zone: wipe all products (for re-testing bulk upload)
# ============================================================

@router.post("/admin/products/wipe-all")
async def admin_wipe_all_products(
    confirm: str = Query(..., description="Must be exactly 'DELETE_ALL' to proceed."),
    keep_niches: Optional[str] = Query(None, description="Comma-separated niches to KEEP (e.g. 'anti-aging'). Default: wipe everything."),
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
    admin_session: Optional[str] = Cookie(None),
):
    """Hard-delete every product (optionally keeping certain niches).

    Idempotent and safe; pass `confirm=DELETE_ALL` to actually execute.
    Returns counts of what got deleted.
    """
    _auth(x_admin_token, admin_session)
    if confirm != "DELETE_ALL":
        raise HTTPException(status_code=400, detail="Pass confirm=DELETE_ALL to execute.")
    keep = [n.strip() for n in (keep_niches or "").split(",") if n.strip()]
    q: Dict[str, Any] = {}
    if keep:
        q = {"niche": {"$nin": keep}}
    before = await _db.products.count_documents(q)
    res = await _db.products.delete_many(q)
    after = await _db.products.count_documents({})
    return {
        "success": True,
        "deleted": res.deleted_count,
        "matched": before,
        "remaining_total": after,
        "kept_niches": keep,
    }



# ============================================================
# Fix bad brand values (Sheet1 / Sheet2 / blank) on already-imported products
# ============================================================

@router.post("/admin/products/fix-brands")
async def admin_fix_brands(
    dry_run: bool = Query(False),
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
    admin_session: Optional[str] = Cookie(None),
):
    """Repair products where brand is literally 'Sheet1' / 'Sheet2' / blank.

    Re-derives brand from product name using the same heuristic the parser
    now uses for new uploads (first 1–2 capitalised tokens, stopping at
    common product nouns). Slug is left alone to avoid breaking links.
    """
    _auth(x_admin_token, admin_session)
    import re as _re
    stop = {"face", "skin", "cream", "serum", "wash", "lotion", "spf", "oil", "lip", "eye", "anti", "night", "day", "mask", "toner", "balm", "scrub", "gel", "foam", "cleanser", "moisturizer", "moisturiser", "sunscreen", "lipstick", "kajal", "mascara", "eyeliner", "foundation", "concealer", "primer", "compact", "blush", "highlighter", "powder", "for", "with", "the"}
    bad = {"sheet1", "sheet2", "sheet3", "sheet4", "sheet5", "sheet", "", "nan"}

    def derive_brand(name: str) -> str:
        tokens = _re.findall(r"[A-Za-z0-9&]+", str(name or "").strip())
        if not tokens:
            return ""
        picked = []
        for t in tokens[:2]:
            if t.lower() in stop:
                break
            picked.append(t)
        return " ".join(picked).strip() or tokens[0]

    q = {"$or": [
        {"brand": {"$in": ["Sheet1", "Sheet2", "Sheet3", "Sheet4", "Sheet5", "", None]}},
        {"brand": {"$regex": "^Sheet\\d+$"}},
    ]}
    fixed = 0
    examples = []
    async for p in _db.products.find(q, {"_id": 0, "slug": 1, "brand": 1, "name": 1}):
        new_brand = derive_brand(p.get("name", ""))
        if not new_brand or new_brand.lower() in bad:
            continue
        if not dry_run:
            await _db.products.update_one({"slug": p["slug"]}, {"$set": {"brand": new_brand, "updated_at": datetime.now(timezone.utc).isoformat()}})
        fixed += 1
        if len(examples) < 10:
            examples.append({"slug": p["slug"], "old_brand": p.get("brand"), "new_brand": new_brand})
    return {"success": True, "dry_run": dry_run, "fixed": fixed, "examples": examples}


# ============================================================
# Seed COMPREHENSIVE skincare + cosmetics taxonomy
# ============================================================

@router.post("/admin/taxonomy/seed-comprehensive")
async def admin_taxonomy_seed_comprehensive(
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
    admin_session: Optional[str] = Cookie(None),
):
    """Insert the canonical Celesta Glow taxonomy (concerns, categories,
    subcategories) used by the AI audit to route products. Idempotent —
    only inserts rows that don't already exist (by slug)."""
    _auth(x_admin_token, admin_session)
    from services.taxonomy_seed_v2 import seed_comprehensive_taxonomy
    counts = await seed_comprehensive_taxonomy(_db)
    return {"success": True, "inserted": counts}



# ============================================================
# One-click: Connect ALL products to the canonical taxonomy
# (rule-based, no LLM cost, runs full 9k catalog in seconds)
# ============================================================

class ConnectAllRequest(BaseModel):
    only_unconnected: bool = False
    niche: Optional[str] = None
    limit: Optional[int] = None


@router.post("/admin/taxonomy/connect-all")
async def admin_taxonomy_connect_all(
    body: ConnectAllRequest = Body(default_factory=ConnectAllRequest),
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
    admin_session: Optional[str] = Cookie(None),
):
    """Rule-based one-click router. For every product:
      • Detect niche (skincare / cosmetics / anti-aging) from product name keywords
      • Match best canonical category slug + subcategory sub-filter
      • Tag matching concerns (acne, pigmentation, brightening, etc.)
      • Update product → those storefront pages instantly populate.

    Uses ONLY keyword matching — no LLM. Full 9k catalog routes in ~5 seconds.
    """
    _auth(x_admin_token, admin_session)
    from services.rule_based_router import connect_all_products
    stats = await connect_all_products(
        _db,
        only_unconnected=body.only_unconnected,
        niche_filter=body.niche,
        limit=body.limit,
    )
    return {"success": True, **stats}


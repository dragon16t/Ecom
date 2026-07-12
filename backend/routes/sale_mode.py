"""Global sale-mode toggle (Feb-2026).

One admin switch controls a site-wide 'FLAT 50% OFF' promotion on the
anti-aging niche only. Skincare and cosmetics untouched.

When enabled: product cards, product detail, cart, checkout, homepage and
kit builder all show the discount badge; prices are halved on anti-aging
items; shipping+tax forced to zero for anti-aging orders.
"""
from __future__ import annotations
from typing import Any, Dict, Optional
from fastapi import APIRouter, Header, HTTPException, UploadFile, File
from pydantic import BaseModel

router = APIRouter()
_db = None
_verify_admin = None


def setup(db, verify_admin_token):
    global _db, _verify_admin
    _db = db
    _verify_admin = verify_admin_token


SALE_DOC_KEY = {"type": "sale_mode"}
DEFAULTS = {
    "enabled": False,
    "discount_percent": 50,
    "applies_to_niches": ["anti-aging"],
    "badge_label": "FLAT 50% OFF",
    "banner_text": "Anti-aging FLAT 50% OFF · Free shipping · Ends soon",
    "urgency_line": "Offer ends soon — grab yours today",
    "zero_shipping": True,
    "zero_tax": True,
    "banner_image_desktop": "",
    "banner_image_mobile": "",
}


class SaleModePatch(BaseModel):
    enabled: Optional[bool] = None
    discount_percent: Optional[int] = None
    applies_to_niches: Optional[list] = None
    badge_label: Optional[str] = None
    banner_text: Optional[str] = None
    urgency_line: Optional[str] = None
    zero_shipping: Optional[bool] = None
    zero_tax: Optional[bool] = None
    banner_image_desktop: Optional[str] = None
    banner_image_mobile: Optional[str] = None


async def _get():
    doc = await _db.admin_settings.find_one(SALE_DOC_KEY, {"_id": 0})
    if not doc:
        doc = {**SALE_DOC_KEY, **DEFAULTS}
        await _db.admin_settings.insert_one(dict(doc))
    out = dict(DEFAULTS)
    out.update({k: v for k, v in doc.items() if k in DEFAULTS})
    return out


@router.get("/sale-mode")
async def public_get_sale_mode():
    """Public — anonymous customers read this to know if sale is active."""
    return await _get()


@router.put("/admin/sale-mode")
async def admin_update_sale_mode(
    payload: SaleModePatch,
    x_admin_token: str = Header(None, alias="X-Admin-Token"),
):
    if not _verify_admin:
        raise HTTPException(500, "Auth not wired")
    _verify_admin(x_admin_token)
    upd = {k: v for k, v in payload.dict().items() if v is not None}
    if not upd:
        raise HTTPException(400, "Nothing to update")
    await _db.admin_settings.update_one(
        SALE_DOC_KEY,
        {"$set": upd, "$setOnInsert": SALE_DOC_KEY},
        upsert=True,
    )
    return await _get()


@router.post("/admin/sale-mode/banner")
async def admin_upload_sale_banner(
    field: str,
    file: UploadFile = File(...),
    x_admin_token: str = Header(None, alias="X-Admin-Token"),
):
    """Upload desktop/mobile banner for anti-aging niche sale mode."""
    import io, uuid, cloudinary, cloudinary.uploader
    from services import cloudinary_service as _cs
    if not _verify_admin:
        raise HTTPException(500, "Auth not wired")
    _verify_admin(x_admin_token)
    if field not in {"banner_image_desktop", "banner_image_mobile"}:
        raise HTTPException(400, "field must be banner_image_desktop or banner_image_mobile")
    raw = await file.read()
    if not raw:
        raise HTTPException(400, "Empty file")
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(400, "Only images allowed")
    if not await _cs.ensure_configured(_db):
        raise HTTPException(503, "Cloudinary not configured")
    res = cloudinary.uploader.upload(
        io.BytesIO(raw),
        folder="celesta-glow/sale-mode-banners",
        public_id=f"{field}-{uuid.uuid4().hex[:8]}",
        overwrite=True,
    )
    url = res.get("secure_url")
    await _db.admin_settings.update_one(SALE_DOC_KEY, {"$set": {field: url}}, upsert=True)
    return await _get()

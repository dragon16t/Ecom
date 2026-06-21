"""Public + admin endpoints for the "Shop by Brand" rails.

Public:
  GET  /api/brands/public?niche=<>           — top brands for a niche (logo + count)
  GET  /api/brands/public/{brand}            — full brand detail (used by /brands/<slug>)

Admin:
  POST /api/admin/brands/{brand}/logo        — upload / set brand logo
  POST /api/admin/brands/{brand}/banner      — upload / set brand banner
  GET  /api/admin/brands/assets              — list all brand assets

Brand assets live in their own collection `brand_assets` keyed by lowercase
brand slug so the same brand under skincare + cosmetics shares one logo.
"""
from __future__ import annotations
import os
import re
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Header, UploadFile, File, Form
from motor.motor_asyncio import AsyncIOMotorClient

from services.image_optimizer import optimize_cloudinary_url
from services.cloudinary_service import upload_image, ensure_configured

router = APIRouter(tags=["brands-public"])

_client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = _client[os.environ["DB_NAME"]]


def _brand_slug(b: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", (b or "").lower()).strip("-")


def _verify_admin(x_admin_token: Optional[str]):
    """Local minimal verify — accepts active session or password sha256."""
    import hashlib
    from server import admin_sessions
    if not x_admin_token:
        raise HTTPException(status_code=401, detail="Admin auth required")
    if x_admin_token in admin_sessions:
        return True
    # password fallback
    from services.admin_auth import get_cached_active_admin_hash
    if hashlib.sha256(x_admin_token.encode()).hexdigest() == get_cached_active_admin_hash():
        return True
    raise HTTPException(status_code=401, detail="Admin auth required")


@router.get("/brands/public")
async def public_brands(niche: Optional[str] = None, limit: int = 18):
    """Return up to `limit` brands for a niche, sorted by product count.
    Each row carries the admin-curated logo if one exists, else a fallback
    product image so the banner is never empty."""
    match = {"is_active": True, "brand": {"$nin": [None, "", "nan", "NaN"]}}
    if niche:
        match["niche"] = niche
    pipeline = [
        {"$match": match},
        {"$group": {
            "_id": "$brand",
            "count": {"$sum": 1},
            "preview_image": {"$first": {"$arrayElemAt": ["$images", 0]}},
        }},
        {"$sort": {"count": -1}},
        {"$limit": int(limit)},
    ]
    rows = await db.products.aggregate(pipeline).to_list(length=None)
    # Pull all admin-uploaded brand assets in one query
    slugs = [_brand_slug(r["_id"]) for r in rows]
    assets_map = {}
    if slugs:
        async for a in db.brand_assets.find({"slug": {"$in": slugs}}, {"_id": 0}):
            assets_map[a["slug"]] = a
    out = []
    for r in rows:
        bslug = _brand_slug(r["_id"])
        asset = assets_map.get(bslug) or {}
        logo = asset.get("logo") or r.get("preview_image")
        version = asset.get("updated_at")
        out.append({
            "brand": r["_id"],
            "slug": bslug,
            "count": r["count"],
            "logo": optimize_cloudinary_url(logo, 400, version) if logo else None,
            "banner": optimize_cloudinary_url(asset.get("banner"), 1200, version) if asset.get("banner") else None,
        })
    return {"brands": out, "niche": niche, "total": len(out)}


@router.get("/brands/public/{slug}")
async def public_brand_detail(slug: str):
    """Brand detail — used by /brands/<slug> landing page."""
    asset = await db.brand_assets.find_one({"slug": slug}, {"_id": 0}) or {}
    brand_name = asset.get("brand")
    # If no asset row, infer brand_name from products
    if not brand_name:
        async for p in db.products.aggregate([
            {"$match": {"is_active": True, "brand": {"$nin": [None, ""]}}},
            {"$group": {"_id": "$brand"}},
        ]):
            if _brand_slug(p["_id"]) == slug:
                brand_name = p["_id"]
                break
    if not brand_name:
        raise HTTPException(status_code=404, detail="Brand not found")
    return {
        "brand": brand_name,
        "slug": slug,
        "logo": optimize_cloudinary_url(asset.get("logo"), 400, asset.get("updated_at")) if asset.get("logo") else None,
        "banner": optimize_cloudinary_url(asset.get("banner"), 1600, asset.get("updated_at")) if asset.get("banner") else None,
        "description": asset.get("description") or "",
    }


# ----------- ADMIN -----------

@router.post("/admin/brands/{slug}/logo")
async def upload_brand_logo(
    slug: str,
    brand: str = Form(...),
    file: UploadFile = File(...),
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
):
    _verify_admin(x_admin_token)
    if not await ensure_configured(db):
        raise HTTPException(status_code=500, detail="Cloudinary not configured")
    content = await file.read()
    res = upload_image(content, folder="celesta-glow/brand-logos", public_id=f"{slug}-logo")
    url = res.get("secure_url")
    await db.brand_assets.update_one(
        {"slug": slug},
        {"$set": {
            "slug": slug, "brand": brand, "logo": url,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    # Trigger an incremental snapshot so the upload is backed up within seconds
    try:
        from services.catalog_backup import schedule_snapshot
        schedule_snapshot(db)
    except Exception:
        pass
    return {"success": True, "logo": url}


@router.post("/admin/brands/{slug}/banner")
async def upload_brand_banner(
    slug: str,
    brand: str = Form(...),
    file: UploadFile = File(...),
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
):
    _verify_admin(x_admin_token)
    if not await ensure_configured(db):
        raise HTTPException(status_code=500, detail="Cloudinary not configured")
    content = await file.read()
    res = upload_image(content, folder="celesta-glow/brand-banners", public_id=f"{slug}-banner")
    url = res.get("secure_url")
    await db.brand_assets.update_one(
        {"slug": slug},
        {"$set": {
            "slug": slug, "brand": brand, "banner": url,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    try:
        from services.catalog_backup import schedule_snapshot
        schedule_snapshot(db)
    except Exception:
        pass
    return {"success": True, "banner": url}


@router.get("/admin/brands/assets")
async def list_brand_assets(x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token")):
    _verify_admin(x_admin_token)
    rows = await db.brand_assets.find({}, {"_id": 0}).sort("brand", 1).to_list(length=None)
    return {"assets": rows, "total": len(rows)}

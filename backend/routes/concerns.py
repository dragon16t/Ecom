"""
Public + admin routes for skin concerns and product categories.
- GET /api/concerns                 -> list all active concerns
- GET /api/concerns/{slug}          -> concern + matching products
- GET /api/categories               -> list all active categories
- GET /api/categories/{slug}        -> category + matching products
- POST/PUT/DELETE /api/admin/...    -> admin CRUD
"""
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone

router = APIRouter()
db = None
admin_sessions = {}


def set_db(database):
    global db
    db = database


def set_admin_sessions(sessions):
    global admin_sessions
    admin_sessions = sessions


def verify_admin(x_admin_token):
    if not x_admin_token:
        raise HTTPException(status_code=401, detail="Unauthorized")
    # Accept active session tokens
    if x_admin_token in admin_sessions:
        return
    # Resilient master-password fallback (survives backend restarts).
    import os as _os
    master = _os.environ.get("ADMIN_MASTER_TOKEN") or _os.environ.get("ADMIN_PASSWORD") or "celestaglow2024"
    if x_admin_token == master:
        return
    raise HTTPException(status_code=401, detail="Unauthorized")


# ==================== CONCERNS ====================

class ConcernUpsert(BaseModel):
    slug: str
    name: str
    tagline: str = ""
    icon: str = ""
    image: str = ""
    accent_from: str = "#dcfce7"
    accent_to: str = "#bbf7d0"
    accent_text: str = "#14532d"
    description: str = ""
    sort_order: int = 99
    is_active: bool = True
    niche: str = "skincare"  # 'anti-aging' | 'skincare' | 'cosmetics'


@router.get("/concerns")
async def list_concerns():
    """Public: List all active concerns sorted by sort_order"""
    items = await db.concerns.find({"is_active": True}, {"_id": 0}).sort("sort_order", 1).to_list(50)
    return items


@router.get("/niches")
async def list_niches():
    """Public: List all active niches (top-level 3-pill: anti-aging / skincare / cosmetics)"""
    items = await db.niches.find({"is_active": True}, {"_id": 0}).sort("sort_order", 1).to_list(20)
    return items


@router.get("/concerns/{slug}")
async def get_concern_with_products(slug: str):
    """Public: Get a concern + all products that target it"""
    concern = await db.concerns.find_one({"slug": slug, "is_active": True}, {"_id": 0})
    if not concern:
        raise HTTPException(status_code=404, detail="Concern not found")
    products = await db.products.find(
        {"is_active": True, "concerns": slug},
        {"_id": 0}
    ).sort("sort_order", 1).to_list(100)
    return {"concern": concern, "products": products}


@router.post("/admin/concerns")
async def create_concern(data: ConcernUpsert, x_admin_token: str = Header(None, alias="X-Admin-Token")):
    verify_admin(x_admin_token)
    existing = await db.concerns.find_one({"slug": data.slug})
    if existing:
        raise HTTPException(status_code=400, detail="Concern slug already exists")
    doc = data.dict()
    now = datetime.now(timezone.utc).isoformat()
    doc["created_at"] = now
    doc["updated_at"] = now
    await db.concerns.insert_one(doc)
    return {"success": True, "slug": data.slug}


@router.put("/admin/concerns/{slug}")
async def update_concern(slug: str, data: ConcernUpsert, x_admin_token: str = Header(None, alias="X-Admin-Token")):
    verify_admin(x_admin_token)
    update = data.dict()
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.concerns.update_one({"slug": slug}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Concern not found")
    return {"success": True}


@router.delete("/admin/concerns/{slug}")
async def delete_concern(slug: str, x_admin_token: str = Header(None, alias="X-Admin-Token")):
    verify_admin(x_admin_token)
    result = await db.concerns.delete_one({"slug": slug})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Concern not found")
    return {"success": True}


@router.get("/admin/concerns")
async def admin_list_concerns(x_admin_token: str = Header(None, alias="X-Admin-Token")):
    verify_admin(x_admin_token)
    items = await db.concerns.find({}, {"_id": 0}).sort("sort_order", 1).to_list(100)
    return items


# ==================== CATEGORIES ====================

class CategoryUpsert(BaseModel):
    slug: str
    name: str
    tagline: str = ""
    icon: str = ""
    image: str = ""
    sort_order: int = 99
    is_active: bool = True
    group: str = "skincare"  # 'skincare' or 'cosmetics' (legacy)
    niche: str = "skincare"  # 'anti-aging' | 'skincare' | 'cosmetics'


@router.get("/categories")
async def list_categories():
    """Public: List all active categories"""
    items = await db.categories.find({"is_active": True}, {"_id": 0}).sort("sort_order", 1).to_list(50)
    return items


@router.get("/categories/{slug}")
async def get_category_with_products(slug: str):
    """Public: Get a category + all products in it"""
    category = await db.categories.find_one({"slug": slug, "is_active": True}, {"_id": 0})
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    products = await db.products.find(
        {"is_active": True, "category": slug},
        {"_id": 0}
    ).sort("sort_order", 1).to_list(100)
    return {"category": category, "products": products}


@router.post("/admin/categories")
async def create_category(data: CategoryUpsert, x_admin_token: str = Header(None, alias="X-Admin-Token")):
    verify_admin(x_admin_token)
    existing = await db.categories.find_one({"slug": data.slug})
    if existing:
        raise HTTPException(status_code=400, detail="Category slug already exists")
    doc = data.dict()
    now = datetime.now(timezone.utc).isoformat()
    doc["created_at"] = now
    doc["updated_at"] = now
    await db.categories.insert_one(doc)
    return {"success": True, "slug": data.slug}


@router.put("/admin/categories/{slug}")
async def update_category(slug: str, data: CategoryUpsert, x_admin_token: str = Header(None, alias="X-Admin-Token")):
    verify_admin(x_admin_token)
    update = data.dict()
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.categories.update_one({"slug": slug}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    return {"success": True}


@router.delete("/admin/categories/{slug}")
async def delete_category(slug: str, x_admin_token: str = Header(None, alias="X-Admin-Token")):
    verify_admin(x_admin_token)
    result = await db.categories.delete_one({"slug": slug})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    return {"success": True}


@router.get("/admin/categories")
async def admin_list_categories(x_admin_token: str = Header(None, alias="X-Admin-Token")):
    verify_admin(x_admin_token)
    items = await db.categories.find({}, {"_id": 0}).sort("sort_order", 1).to_list(100)
    return items

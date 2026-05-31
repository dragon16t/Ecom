"""
Public + admin routes for skin concerns and product categories.
- GET /api/concerns                 -> list all active concerns
- GET /api/concerns/{slug}          -> concern + matching products
- GET /api/categories               -> list all active categories
- GET /api/categories/{slug}        -> category + matching products
- POST/PUT/DELETE /api/admin/...    -> admin CRUD
"""
from fastapi import APIRouter, Header, HTTPException, Response
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
    # Plain-password fallback — must match the *active* admin hash.
    # Env-seed password is rejected once a custom one is saved.
    import hashlib as _h
    from services.admin_auth import get_cached_active_admin_hash
    if _h.sha256(x_admin_token.encode()).hexdigest() == get_cached_active_admin_hash():
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
async def list_concerns(response: Response):
    """Public: List all active concerns sorted by sort_order"""
    items = await db.concerns.find({"is_active": True}, {"_id": 0}).sort("sort_order", 1).to_list(length=None)
    # PERF: concerns rarely change → cache at the CDN edge for 5 min, serve stale
    # for 10 min while we revalidate in background. Cuts backend load by ~95%.
    response.headers["Cache-Control"] = "public, max-age=300, stale-while-revalidate=600"
    return items


@router.get("/niches")
async def list_niches(response: Response):
    """Public: List all active niches (top-level 3-pill: anti-aging / skincare / cosmetics)"""
    items = await db.niches.find({"is_active": True}, {"_id": 0}).sort("sort_order", 1).to_list(20)
    response.headers["Cache-Control"] = "public, max-age=600, stale-while-revalidate=1200"
    return items


@router.get("/concerns/{slug}")
async def get_concern_with_products(
    slug: str,
    page: int = 1,
    limit: int = 24,
    search: Optional[str] = None,
    sort: str = "sort_order",
):
    """Public: Get a concern + paginated products that target it.

    Response: { concern, products, total, page, limit, has_next }.
    The legacy shape (concern + products) is preserved; new fields are additive.
    """
    concern = await db.concerns.find_one({"slug": slug, "is_active": True}, {"_id": 0})
    if not concern:
        raise HTTPException(status_code=404, detail="Concern not found")

    query = {"is_active": True, "concerns": slug}
    if search and search.strip():
        import re as _re
        safe = _re.escape(search.strip())
        query["$or"] = [
            {"name":        {"$regex": safe, "$options": "i"}},
            {"description": {"$regex": safe, "$options": "i"}},
            {"brand":       {"$regex": safe, "$options": "i"}},
            {"tags":        {"$regex": safe, "$options": "i"}},
        ]

    sort_spec = {
        "sort_order": [("sort_order", 1), ("name", 1)],
        "price_asc":  [("prepaid_price", 1)],
        "price_desc": [("prepaid_price", -1)],
        "newest":     [("created_at", -1)],
        "popular":    [("total_orders", -1), ("sort_order", 1)],
    }.get((sort or "sort_order").lower(), [("sort_order", 1)])

    page_i  = max(1, page)
    limit_i = min(100, max(1, limit))
    skip_i  = (page_i - 1) * limit_i

    total = await db.products.count_documents(query)
    products = await db.products.find(query, {"_id": 0}).sort(sort_spec).skip(skip_i).limit(limit_i).to_list(length=None)
    return {
        "concern": concern,
        "products": products,
        "total": total,
        "page": page_i,
        "limit": limit_i,
        "has_next": skip_i + len(products) < total,
    }


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
    # No cap — admin needs to see every record (canonical taxonomy may have 100+ rows).
    items = await db.concerns.find({}, {"_id": 0}).sort("sort_order", 1).to_list(length=None)
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
    # Taxonomy V2 fields — preserved on partial admin updates.
    is_parent: Optional[bool] = None
    parent: Optional[str] = None
    subs: Optional[List[str]] = None


class CategoryPatch(BaseModel):
    """Partial update — only sent fields are written. Used by /admin/categories/{slug}."""
    name: Optional[str] = None
    tagline: Optional[str] = None
    icon: Optional[str] = None
    image: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None
    niche: Optional[str] = None
    is_parent: Optional[bool] = None
    parent: Optional[str] = None
    subs: Optional[List[str]] = None


@router.get("/categories")
async def list_categories(response: Response, niche: Optional[str] = None):
    """Public: List all active categories. Optional `niche` filter (skincare/cosmetics)."""
    q = {"is_active": True}
    if niche:
        q["niche"] = niche
    items = await db.categories.find(q, {"_id": 0}).sort("sort_order", 1).to_list(length=None)
    # PERF: categories change rarely → 5 min edge cache
    response.headers["Cache-Control"] = "public, max-age=300, stale-while-revalidate=600"
    return items


@router.get("/categories/{slug}")
async def get_category_with_products(
    slug: str,
    page: int = 1,
    limit: int = 24,
    search: Optional[str] = None,
    sort: str = "sort_order",
):
    """Public: Get a category + paginated products in it."""
    category = await db.categories.find_one({"slug": slug, "is_active": True}, {"_id": 0})
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    # Match products whose category OR subcategory slug matches. This lets
    # /category/concealer (a subcategory) return the 242 products stored as
    # category=face-makeup + subcategory=concealer.
    query = {
        "is_active": True,
        "$or": [{"category": slug}, {"subcategory": slug}],
    }
    if search and search.strip():
        import re as _re
        safe = _re.escape(search.strip())
        # Wrap existing $or in $and to keep the category-OR-subcategory filter
        # alongside the search-OR filter.
        query = {
            "is_active": True,
            "$and": [
                {"$or": [{"category": slug}, {"subcategory": slug}]},
                {"$or": [
                    {"name":        {"$regex": safe, "$options": "i"}},
                    {"description": {"$regex": safe, "$options": "i"}},
                    {"brand":       {"$regex": safe, "$options": "i"}},
                    {"tags":        {"$regex": safe, "$options": "i"}},
                ]},
            ],
        }

    sort_spec = {
        "sort_order": [("sort_order", 1), ("name", 1)],
        "price_asc":  [("prepaid_price", 1)],
        "price_desc": [("prepaid_price", -1)],
        "newest":     [("created_at", -1)],
        "popular":    [("total_orders", -1), ("sort_order", 1)],
    }.get((sort or "sort_order").lower(), [("sort_order", 1)])

    page_i  = max(1, page)
    limit_i = min(100, max(1, limit))
    skip_i  = (page_i - 1) * limit_i

    total = await db.products.count_documents(query)
    products = await db.products.find(query, {"_id": 0}).sort(sort_spec).skip(skip_i).limit(limit_i).to_list(length=None)
    return {
        "category": category,
        "products": products,
        "total": total,
        "page": page_i,
        "limit": limit_i,
        "has_next": skip_i + len(products) < total,
    }


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
async def update_category(slug: str, data: CategoryPatch, x_admin_token: str = Header(None, alias="X-Admin-Token")):
    """Partial update — only fields explicitly sent are written.

    This preserves the taxonomy_v2 parent/sub relationships when admin only
    changes image/icon/name from the category editor.
    """
    verify_admin(x_admin_token)
    update = {k: v for k, v in data.dict().items() if v is not None}
    if not update:
        raise HTTPException(status_code=400, detail="Nothing to update")
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.categories.update_one({"slug": slug}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    # Mirror image (and a couple of display fields) to the sibling subcategory
    # record if it shares the same slug. Keeps admin → user-app rendering in
    # sync whether the admin edits via Categories tab or Subcategories tab.
    mirror_fields = {k: update[k] for k in ("image", "tagline", "icon") if k in update}
    if mirror_fields:
        mirror_fields["updated_at"] = update["updated_at"]
        await db.subcategories.update_one({"slug": slug}, {"$set": mirror_fields})
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
    # No cap — admin must see every category (158+ across both niches incl.
    # canonical parents like `sunscreens`, `cleansers`, etc.). Previously
    # capped at 100 which silently hid 58 records causing the
    # "Sunscreens missing under Protect" bug.
    items = await db.categories.find({}, {"_id": 0}).sort("sort_order", 1).to_list(length=None)
    return items


# ==================== SUBCATEGORIES ====================
# Subcategories are filter chips inside a category page. Example:
#   parent_category="brow" → ["Best Sellers", "Luxury", "Everyday", "Pro Use"]
#
# Each product carries an optional `subcategory` field. The category detail
# page reads subcategories for the current parent + filters products
# client-side.

class SubcategoryUpsert(BaseModel):
    slug: str
    name: str
    parent_category: str   # slug of the parent category
    niche: Optional[str] = None  # auto-derived from parent if missing
    tagline: str = ""
    icon: str = ""
    image: str = ""
    sort_order: int = 0
    is_active: bool = True
    accent_from: str = "#dcfce7"
    accent_to: str = "#bbf7d0"
    accent_text: str = "#14532d"


@router.get("/subcategories")
async def list_subcategories(
    category: Optional[str] = None,
    niche: Optional[str] = None,
):
    """Public list. Filter by parent category and/or niche. Only active rows."""
    query = {"is_active": True}
    if category:
        query["parent_category"] = category
    if niche:
        query["niche"] = niche
    items = await db.subcategories.find(query, {"_id": 0}).sort("sort_order", 1).to_list(200)
    return items


@router.get("/admin/subcategories")
async def admin_list_subcategories(x_admin_token: str = Header(None, alias="X-Admin-Token")):
    verify_admin(x_admin_token)
    items = await db.subcategories.find({}, {"_id": 0}).sort("sort_order", 1).to_list(500)
    return items


@router.post("/admin/subcategories")
async def create_subcategory(data: SubcategoryUpsert, x_admin_token: str = Header(None, alias="X-Admin-Token")):
    verify_admin(x_admin_token)
    # Reject empty / whitespace-only slug — prevents zombie rows that break
    # PUT/DELETE URL construction (the path becomes /admin/subcategories/).
    if not data.slug or not data.slug.strip():
        raise HTTPException(status_code=400, detail="Slug is required (lowercase, dashes only — e.g. lipstick-matte).")
    if not data.name or not data.name.strip():
        raise HTTPException(status_code=400, detail="Name is required.")
    # Validate parent category exists
    parent = await db.categories.find_one({"slug": data.parent_category}, {"_id": 0, "niche": 1, "group": 1})
    if not parent:
        raise HTTPException(status_code=400, detail="Parent category not found. Pick an existing category as parent.")
    existing = await db.subcategories.find_one({"slug": data.slug})
    if existing:
        raise HTTPException(status_code=400, detail="Subcategory slug already exists")
    doc = data.dict()
    if not doc.get("niche"):
        doc["niche"] = parent.get("niche") or parent.get("group") or "skincare"
    now = datetime.now(timezone.utc).isoformat()
    doc["created_at"] = now
    doc["updated_at"] = now
    await db.subcategories.insert_one(doc)
    return {"success": True, "slug": data.slug}


@router.put("/admin/subcategories/{slug}")
async def update_subcategory(slug: str, data: SubcategoryUpsert, x_admin_token: str = Header(None, alias="X-Admin-Token")):
    verify_admin(x_admin_token)
    update = data.dict()
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.subcategories.update_one({"slug": slug}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Subcategory not found")
    # Mirror image/icon/tagline to the sibling categories record (same slug).
    # Many subcategory slugs exist as records in BOTH collections; the public
    # /skincare hub renders from `categories`, so we keep them in sync.
    mirror_fields = {k: update[k] for k in ("image", "tagline", "icon") if update.get(k)}
    if mirror_fields:
        mirror_fields["updated_at"] = update["updated_at"]
        await db.categories.update_one({"slug": slug}, {"$set": mirror_fields})
    return {"success": True}


@router.post("/admin/subcategories/sync-images-to-categories")
async def backfill_subcategory_images_to_categories(x_admin_token: str = Header(None, alias="X-Admin-Token")):
    """One-shot backfill: copies `image` from every subcategory record that has
    an image set, into the same-slug record in the `categories` collection
    (whenever the category record is missing an image). Run this once after
    deploying the mirror fix so PRE-EXISTING admin uploads also propagate
    to the user-facing hub without manual re-upload.
    """
    verify_admin(x_admin_token)
    updated = 0
    skipped_already_set = 0
    no_sibling = 0
    cursor = db.subcategories.find(
        {"image": {"$exists": True, "$ne": ""}},
        {"_id": 0, "slug": 1, "image": 1, "tagline": 1, "icon": 1},
    )
    async for sc in cursor:
        slug = sc.get("slug")
        if not slug:
            continue
        cat = await db.categories.find_one({"slug": slug}, {"_id": 0, "image": 1})
        if not cat:
            no_sibling += 1
            continue
        if cat.get("image"):
            skipped_already_set += 1
            continue
        mirror = {"image": sc["image"], "updated_at": datetime.now(timezone.utc).isoformat()}
        if sc.get("tagline"):
            mirror["tagline"] = sc["tagline"]
        if sc.get("icon"):
            mirror["icon"] = sc["icon"]
        await db.categories.update_one({"slug": slug}, {"$set": mirror})
        updated += 1
    return {
        "success": True,
        "updated": updated,
        "skipped_already_set": skipped_already_set,
        "no_sibling": no_sibling,
    }


class ImagePatch(BaseModel):
    image: str


@router.patch("/admin/subcategories/{slug}/image")
async def patch_subcategory_image(slug: str, data: ImagePatch, x_admin_token: str = Header(None, alias="X-Admin-Token")):
    """One-shot image update — bypasses full-doc validation so QuickImageEditor
    can replace a banner without re-sending every accent colour / tagline / icon.

    IMPORTANT: many subcategory slugs ALSO exist as records in the `categories`
    collection (e.g. `chemical-exfoliant` lives in BOTH because the public hub
    renders from `categories` while admin curates `subcategories`). We mirror
    the image to whichever sibling record exists with the same slug so the
    user-facing hub picks up the update immediately.
    """
    verify_admin(x_admin_token)
    now_iso = datetime.now(timezone.utc).isoformat()
    update = {"image": data.image, "updated_at": now_iso}
    result = await db.subcategories.update_one({"slug": slug}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Subcategory not found")
    # Mirror to the categories collection if a same-slug record exists
    await db.categories.update_one({"slug": slug}, {"$set": update})
    return {"success": True, "image": data.image}


@router.patch("/admin/categories/{slug}/image")
async def patch_category_image(slug: str, data: ImagePatch, x_admin_token: str = Header(None, alias="X-Admin-Token")):
    verify_admin(x_admin_token)
    now_iso = datetime.now(timezone.utc).isoformat()
    update = {"image": data.image, "updated_at": now_iso}
    result = await db.categories.update_one({"slug": slug}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    # Mirror to the subcategories collection if a same-slug record exists
    await db.subcategories.update_one({"slug": slug}, {"$set": update})
    return {"success": True, "image": data.image}


@router.patch("/admin/concerns/{slug}/image")
async def patch_concern_image(slug: str, data: ImagePatch, x_admin_token: str = Header(None, alias="X-Admin-Token")):
    verify_admin(x_admin_token)
    result = await db.concerns.update_one(
        {"slug": slug},
        {"$set": {"image": data.image, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Concern not found")
    return {"success": True, "image": data.image}


@router.delete("/admin/subcategories/{slug}")
async def delete_subcategory(slug: str, x_admin_token: str = Header(None, alias="X-Admin-Token")):
    verify_admin(x_admin_token)
    result = await db.subcategories.delete_one({"slug": slug})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Subcategory not found")
    # Also clear `subcategory` field from any products that referenced it
    await db.products.update_many({"subcategory": slug}, {"$set": {"subcategory": ""}})
    return {"success": True}



# ==================== COSMETICS HOMEPAGE CONFIG (public) ====================

@router.get("/cosmetics/home-config")
async def get_cosmetics_home_config():
    """Featured navigation strip + promo sections rendered on /cosmetics page.

    Falls back to canonical defaults if no override stored in site_settings.
    Admin can persist overrides via PUT /admin/cosmetics/home-config.
    """
    from services.taxonomy_canonical import (
        COSMETICS_FEATURED_NAV, COSMETICS_PROMO_SECTIONS
    )
    settings = await db.site_settings.find_one(
        {"_id": "main"},
        {"_id": 0, "cosmetics_featured_nav": 1, "cosmetics_promo_sections": 1}
    ) or {}
    return {
        "featured_nav": settings.get("cosmetics_featured_nav") or COSMETICS_FEATURED_NAV,
        "promo_sections": settings.get("cosmetics_promo_sections") or COSMETICS_PROMO_SECTIONS,
    }


@router.put("/admin/cosmetics/home-config")
async def update_cosmetics_home_config(
    payload: dict,
    x_admin_token: str = Header(None, alias="X-Admin-Token"),
):
    """Admin: persist Featured Nav + Promo Sections overrides."""
    verify_admin(x_admin_token)
    update = {}
    if "featured_nav" in payload and isinstance(payload["featured_nav"], list):
        update["cosmetics_featured_nav"] = payload["featured_nav"]
    if "promo_sections" in payload and isinstance(payload["promo_sections"], list):
        update["cosmetics_promo_sections"] = payload["promo_sections"]
    if not update:
        raise HTTPException(status_code=400, detail="Nothing to update")
    update["cosmetics_home_config_updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.site_settings.update_one({"_id": "main"}, {"$set": update}, upsert=True)
    return {"success": True, "updated": list(update.keys())}

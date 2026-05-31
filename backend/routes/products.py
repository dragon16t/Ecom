"""
Product Management Routes - Multi-product catalog, combos, coupons, cart
"""
from fastapi import APIRouter, Header, HTTPException, Query, UploadFile, File, Form, Response
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
import secrets
import logging
import random
import re

router = APIRouter()
db = None
admin_sessions = {}
employee_sessions = {}

def set_db(database):
    global db
    db = database

def set_admin_sessions(sessions):
    global admin_sessions
    admin_sessions = sessions

def set_employee_sessions(sessions):
    global employee_sessions
    employee_sessions = sessions

import os
import hashlib

# Cache stored admin password hash so we don't hit DB on every request
_admin_pw_cache = {"hash": None, "checked_at": 0}

def _get_stored_admin_hash_sync():
    """Best-effort cache of the latest admin password hash from DB. Refreshed at most every 30s."""
    import time
    now_ts = time.time()
    if _admin_pw_cache["hash"] is not None and (now_ts - _admin_pw_cache["checked_at"]) < 30:
        return _admin_pw_cache["hash"]
    try:
        # use motor's sync collection access via run_in_executor is overkill; instead store via callback
        return _admin_pw_cache["hash"]
    except Exception:
        return None

async def _refresh_admin_pw_cache():
    import time
    if db is None:
        return
    try:
        doc = await db.admin_settings.find_one({"type": "password"})
        _admin_pw_cache["hash"] = (doc or {}).get("hash")
        _admin_pw_cache["checked_at"] = time.time()
    except Exception:
        pass

def verify_auth(x_admin_token=None, x_employee_token=None, permission=None):
    if x_admin_token:
        # Accept active session tokens (always, regardless of password change).
        if x_admin_token in admin_sessions:
            return True
        # Plain-password fallback — must match the *active* admin hash.
        # Once a custom password is saved, the env-seed password is rejected.
        from services.admin_auth import get_cached_active_admin_hash
        token_hash = hashlib.sha256(x_admin_token.encode()).hexdigest()
        if token_hash == get_cached_active_admin_hash():
            return True
    if x_employee_token and x_employee_token in employee_sessions:
        session = employee_sessions[x_employee_token]
        if permission and not session.get("permissions", {}).get(permission):
            raise HTTPException(status_code=403, detail=f"No permission: {permission}")
        return True
    raise HTTPException(status_code=401, detail="Unauthorized")


# ==================== PRODUCT ENDPOINTS ====================

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    short_name: Optional[str] = None
    tagline: Optional[str] = None
    description: Optional[str] = None
    key_ingredients: Optional[str] = None
    ingredients_full: Optional[str] = None
    benefits: Optional[List[str]] = None
    how_to_use: Optional[str] = None
    size: Optional[str] = None
    images: Optional[List[str]] = None
    image: Optional[str] = None  # singular convenience field — mirrored into images[0] on save
    mrp: Optional[float] = None
    prepaid_price: Optional[float] = None
    cod_price: Optional[float] = None
    cod_advance: Optional[float] = None
    discount_percent: Optional[float] = None
    badge: Optional[str] = None
    badges: Optional[List[str]] = None
    offer_price: Optional[float] = None
    offer_label: Optional[str] = None
    offer_ends_at: Optional[str] = None
    source_url: Optional[str] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None  # filter chip within parent category
    concerns: Optional[List[str]] = None
    niche: Optional[str] = None
    # TBL / Preorder
    is_to_be_launched: Optional[bool] = None
    launch_date: Optional[str] = None  # ISO date string
    preorder_enabled: Optional[bool] = None
    # Inventory
    stock_qty: Optional[int] = None
    low_stock_threshold: Optional[int] = None
    # Display
    fill_card: Optional[bool] = None
    brand: Optional[str] = None
    # Content extras
    faqs: Optional[List[Dict[str, Any]]] = None
    # Niche-specific specs (dict so per-niche fields can vary):
    #   skincare/anti-aging → { skin_type, fragrance, suitable_for, ... }
    #   cosmetics → { shade, finish, spf, skin_tone, coverage, ... }
    #   hair → { hair_type, hair_length, fragrance, ... }
    specs: Optional[Dict[str, Any]] = None
    # Cosmetics shade variants — each shade has independent stock & optional image.
    # Empty/None means the product is sold as a single SKU (no shade picker).
    shades: Optional[List[Dict[str, Any]]] = None  # [{id,name,hex,image,sku,stock_qty}]
    # Price guard — must be explicitly true to allow prepaid_price/cod_price/mrp updates
    allow_price_change: Optional[bool] = False

class ProductCreate(BaseModel):
    slug: str
    name: str
    short_name: str
    tagline: str = ""
    description: str = ""
    category: str = "skincare"
    subcategory: str = ""  # optional filter chip slug within the parent category
    concerns: List[str] = []
    niche: str = "anti-aging"  # 'anti-aging' | 'skincare' | 'cosmetics'
    key_ingredients: str = ""
    ingredients_full: str = ""
    benefits: List[str] = []
    how_to_use: str = ""
    size: str = ""
    images: List[str] = []
    mrp: float = 0
    prepaid_price: float = 0
    cod_price: float = 0
    cod_advance: float = 29
    discount_percent: float = 0
    badge: str = ""
    badges: List[str] = []
    offer_price: Optional[float] = None
    offer_label: Optional[str] = None
    offer_ends_at: Optional[str] = None
    source_url: Optional[str] = None
    is_active: bool = True
    sort_order: int = 99
    # TBL / Preorder
    is_to_be_launched: bool = False
    launch_date: Optional[str] = None
    preorder_enabled: bool = False
    # Inventory
    stock_qty: int = 100
    low_stock_threshold: int = 10
    # Display
    fill_card: bool = False
    brand: str = ""
    # Per-niche specs (free-form dict)
    specs: Dict[str, Any] = {}
    # Cosmetics shade variants — optional list of {id,name,hex,image,sku,stock_qty}
    shades: List[Dict[str, Any]] = []


@router.get("/products")
async def get_all_products(
    response: Response,
    active_only: bool = Query(True),
    niche: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    concern: Optional[str] = Query(None),
    subcategory: Optional[str] = Query(None),
    tag: Optional[str] = Query(None, description="Filter by tag: bestseller | luxury | trending | most_bought"),
    # --- NEW: pagination + server-side search ---
    # `page` is 1-indexed. `limit` is the page size.
    # When neither param is passed, the endpoint stays backward-compatible and
    # returns up to 500 items so tiny catalogs (27 products) just work.
    page: Optional[int] = Query(None, ge=1),
    limit: Optional[int] = Query(None, ge=1, le=100),
    search: Optional[str] = Query(None, description="Text search on name/description/brand/tags"),
    sort: Optional[str] = Query("sort_order", description="sort_order | price_asc | price_desc | newest | popular"),
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
    x_employee_token: Optional[str] = Header(None, alias="X-Employee-Token"),
):
    """Public: paginated + searchable product list, with TBL auto-flip.

    Response shape (always a dict now so clients can see totals):
      { items: [...], total, page, limit, has_next }
    For back-compat we still return a plain array when NEITHER `page` nor `limit`
    are provided AND no `search` is used, so nothing breaks on existing callers.

    Security: ``active_only=false`` returns inactive/draft products and is
    therefore an admin-only mode. Anonymous callers that pass
    ``active_only=false`` are silently coerced back to ``True`` so we never
    leak unpublished SKUs.
    """
    # If the caller is asking for inactive products, they MUST authenticate
    # as admin or as an employee with the products permission. Otherwise we
    # silently force active_only=True so anonymous traffic only sees the
    # public catalog. Previously this endpoint leaked every draft product.
    if not active_only:
        try:
            verify_auth(x_admin_token=x_admin_token, x_employee_token=x_employee_token, permission="products")
        except HTTPException:
            active_only = True
    # Build the query
    query = {"is_active": True} if active_only else {}
    # Public catalog: hide out-of-stock products entirely (business rule).
    # Admins can still see all products via active_only=false.
    if active_only:
        query["$and"] = [
            {"$or": [
                {"is_to_be_launched": True},  # Coming-soon products are shown (different CTA)
                {"stock_qty": {"$gt": 0}},
                {"shades.stock_qty": {"$gt": 0}},
            ]}
        ]
    if niche:
        query["niche"] = niche
    if category:
        # Match the parent category OR a child subcategory with this slug.
        # This lets the Cosmetics hub fetch counts via ?category=foundation
        # even though the product is stored as category=face-makeup + subcategory=foundation.
        query["$or"] = (query.get("$or") or []) + [
            {"category": category},
            {"subcategory": category},
        ]
    if concern:
        query["concerns"] = concern
    if subcategory:
        query["subcategory"] = subcategory
    if tag:
        query["tags"] = tag
    if search and search.strip():
        s = search.strip()
        # PERF: Use the MongoDB text index (created in ensure_indexes) for whole-word
        # matches — ~50ms across 7,800 products vs ~2-4s for $regex. Fall back to
        # a $regex prefix match across name/brand/tags for short queries (<3 chars)
        # or queries containing only special chars where $text isn't useful.
        if len(s) >= 3 and re.search(r"[A-Za-z0-9]", s):
            query["$text"] = {"$search": s}
        else:
            safe = re.escape(s)
            query["$or"] = [
                {"name":  {"$regex": safe, "$options": "i"}},
                {"brand": {"$regex": safe, "$options": "i"}},
                {"tags":  {"$regex": safe, "$options": "i"}},
                {"slug":  {"$regex": safe, "$options": "i"}},
            ]

    # Sort map. Each entry includes `slug` as a stable final tie-breaker so the
    # ordering is deterministic across requests (otherwise Mongo can return
    # documents in different orders when the primary key ties — that's the
    # "Cosmetics shuffled" bug we hit).
    sort_spec = {
        "sort_order": [("sort_order", 1), ("name", 1), ("slug", 1)],
        "price_asc":  [("prepaid_price", 1), ("sort_order", 1), ("slug", 1)],
        "price_desc": [("prepaid_price", -1), ("sort_order", 1), ("slug", 1)],
        "newest":     [("created_at", -1), ("sort_order", 1), ("slug", 1)],
        "popular":    [("total_orders", -1), ("sort_order", 1), ("slug", 1)],
    }.get((sort or "sort_order").lower(), [("sort_order", 1), ("slug", 1)])

    # Whether to paginate
    paginating = page is not None or limit is not None or bool(search and search.strip())
    page_i  = max(1, page or 1)
    limit_i = min(100, max(1, limit or 24))
    skip_i  = (page_i - 1) * limit_i

    # Count — cheap because of the index we ensure below
    total = await db.products.count_documents(query)

    # Lean projection — when the caller is the public catalog listing pages
    # (paginating + no admin/employee), strip the heavy fields that the card
    # UI never renders. Cuts response size by ~80% on a 24-product page (from
    # ~600KB down to ~120KB) and is the single biggest contributor to slow
    # initial page-paint on 3G mobile.
    lean = paginating and active_only
    if lean:
        projection = {
            "_id": 0, "slug": 1, "name": 1, "short_name": 1, "tagline": 1,
            "brand": 1, "niche": 1, "category": 1, "subcategory": 1, "concerns": 1,
            "images": {"$slice": 2},  # only the first 2 images for card hover
            "mrp": 1, "prepaid_price": 1, "cod_price": 1, "discount_percent": 1,
            "badge": 1, "badges": 1, "tags": 1,
            "is_active": 1, "is_to_be_launched": 1, "launch_date": 1,
            "stock_qty": 1, "low_stock_threshold": 1,
            "shades": 1, "fill_card": 1,
            "average_rating": 1, "reviews_count": 1, "total_orders": 1,
            "needs_review": 1, "size": 1, "created_at": 1, "sort_order": 1,
        }
    else:
        projection = {"_id": 0}

    cursor = db.products.find(query, projection).sort(sort_spec)
    if paginating:
        cursor = cursor.skip(skip_i).limit(limit_i)
    else:
        # Admin & legacy callers fetch the full catalog in one shot. Cap at 5000
        # so the list view (with virtualization) can host 2,000-4,000 SKUs.
        cursor = cursor.limit(5000)
    products = await cursor.to_list(length=None)

    # Auto-flip TBL → launched on read if launch_date passed (unchanged logic)
    now = datetime.now(timezone.utc)
    for p in products:
        if p.get("is_to_be_launched") and p.get("launch_date"):
            try:
                ld = datetime.fromisoformat(str(p["launch_date"]).replace("Z", "+00:00"))
                if ld <= now:
                    p["is_to_be_launched"] = False
                    p["launch_date"] = None
                    await db.products.update_one(
                        {"slug": p["slug"]},
                        {"$set": {"is_to_be_launched": False, "launch_date": None,
                                  "updated_at": now.isoformat()}}
                    )
            except Exception:
                pass
        if p.get("is_to_be_launched") and p.get("launch_date"):
            try:
                ld = datetime.fromisoformat(str(p["launch_date"]).replace("Z", "+00:00"))
                delta = ld - now
                p["days_to_launch"] = max(0, delta.days)
                p["hours_to_launch"] = max(0, int(delta.total_seconds() // 3600))
            except Exception:
                p["days_to_launch"] = None
        else:
            p["days_to_launch"] = None

    # Apply Cloudinary auto-format/quality/width transforms to all image URLs
    # in the response. 70-90% smaller images delivered through the CDN
    # without re-uploading anything. Card images use 600px; detail uses 1200.
    try:
        from services.image_optimizer import optimize_products_list
        optimize_products_list(products, width=600 if lean else 1200)
    except Exception as e:
        logging.warning(f"[products] image optimize failed: {e}")

    # CDN cache headers — public catalog responses are safe to cache at the
    # edge for 60 seconds. Searches and admin (active_only=False) bypass cache.
    if active_only and not (search and search.strip()):
        response.headers["Cache-Control"] = "public, max-age=60, stale-while-revalidate=300"
    else:
        response.headers["Cache-Control"] = "no-cache, no-store"

    # Back-compat: if the caller didn't ask for pagination, return a plain array.
    if not paginating:
        return products
    return {
        "items": products,
        "total": total,
        "page": page_i,
        "limit": limit_i,
        "has_next": skip_i + len(products) < total,
    }


@router.post("/products/batch")
async def get_products_batch(data: Dict[str, Any]):
    """Public: fetch a batch of products by slug list in ONE query.

    Used by the cart page (and other client surfaces) so it can avoid pulling
    the entire 7,000+ catalog just to render a few cards. Returns a lean
    projection identical to the public catalog listing.

    Body: ``{ "slugs": ["a", "b", "c"] }`` — max 200 slugs per call.
    """
    slugs = data.get("slugs") or []
    if not isinstance(slugs, list):
        raise HTTPException(status_code=400, detail="`slugs` must be a list")
    # Hard cap to keep one request bounded
    slugs = [s for s in slugs if isinstance(s, str) and s][:200]
    if not slugs:
        return []
    projection = {
        "_id": 0, "slug": 1, "name": 1, "short_name": 1, "tagline": 1,
        "brand": 1, "niche": 1, "category": 1, "subcategory": 1, "concerns": 1,
        "images": {"$slice": 2},
        "mrp": 1, "prepaid_price": 1, "cod_price": 1, "discount_percent": 1,
        "badge": 1, "badges": 1, "tags": 1,
        "is_active": 1, "is_to_be_launched": 1, "launch_date": 1,
        "stock_qty": 1, "low_stock_threshold": 1,
        "shades": 1, "fill_card": 1,
        "average_rating": 1, "reviews_count": 1, "total_orders": 1,
        "size": 1,
    }
    items = await db.products.find(
        {"slug": {"$in": slugs}, "is_active": True}, projection
    ).to_list(length=None)
    # Preserve client-supplied order so the cart shows items in cart order
    order = {s: i for i, s in enumerate(slugs)}
    items.sort(key=lambda p: order.get(p.get("slug"), 9999))
    try:
        from services.image_optimizer import optimize_products_list
        optimize_products_list(items, width=600)
    except Exception:
        pass
    return items


@router.get("/products/{slug}")
async def get_product(slug: str):
    """Public: Get single product by slug (with TBL auto-flip + countdown)"""
    product = await db.products.find_one({"slug": slug}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    now = datetime.now(timezone.utc)
    if product.get("is_to_be_launched") and product.get("launch_date"):
        try:
            ld = datetime.fromisoformat(str(product["launch_date"]).replace("Z", "+00:00"))
            if ld <= now:
                product["is_to_be_launched"] = False
                product["launch_date"] = None
                await db.products.update_one(
                    {"slug": slug},
                    {"$set": {"is_to_be_launched": False, "launch_date": None,
                              "updated_at": now.isoformat()}}
                )
            else:
                delta = ld - now
                product["days_to_launch"] = max(0, delta.days)
                product["hours_to_launch"] = max(0, int(delta.total_seconds() // 3600))
        except Exception:
            pass
    try:
        from services.image_optimizer import optimize_product_images
        optimize_product_images(product, width=1200)
    except Exception:
        pass
    return product


class LaunchStatusUpdate(BaseModel):
    is_to_be_launched: bool
    launch_date: Optional[str] = None  # ISO date; required if is_to_be_launched=True
    preorder_enabled: Optional[bool] = None


@router.put("/admin/products/{slug}/launch-status")
async def set_product_launch_status(
    slug: str,
    data: LaunchStatusUpdate,
    x_admin_token: str = Header(None, alias="X-Admin-Token")
):
    """Admin: Toggle a product's TBL (To-Be-Launched) status, set launch date, toggle preorder."""
    verify_auth(x_admin_token=x_admin_token)
    product = await db.products.find_one({"slug": slug})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    update = {
        "is_to_be_launched": data.is_to_be_launched,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if data.is_to_be_launched:
        # When marking as TBL, default to +25 days from today if no date provided
        if data.launch_date:
            update["launch_date"] = data.launch_date
        else:
            from datetime import timedelta as _td
            update["launch_date"] = (datetime.now(timezone.utc) + _td(days=25)).isoformat()
        if data.preorder_enabled is not None:
            update["preorder_enabled"] = data.preorder_enabled
    else:
        # When marking as launched, clear launch_date and disable preorder
        update["launch_date"] = None
        update["preorder_enabled"] = False

    await db.products.update_one({"slug": slug}, {"$set": update})
    return {"success": True, "slug": slug, "is_to_be_launched": data.is_to_be_launched, "launch_date": update.get("launch_date")}


@router.post("/products/{slug}/preorder-count")
async def increment_preorder_count(slug: str):
    """Public: Increment preorder counter when a TBL item is added to cart."""
    product = await db.products.find_one({"slug": slug}, {"_id": 0})
    if not product or not product.get("is_to_be_launched"):
        raise HTTPException(status_code=400, detail="Product is not in preorder state")
    await db.products.update_one({"slug": slug}, {"$inc": {"preorder_count": 1}})
    return {"success": True}


class ProductReorderItem(BaseModel):
    slug: str
    sort_order: int


class ProductReorderRequest(BaseModel):
    items: List[ProductReorderItem]


@router.post("/admin/products/reorder")
async def bulk_reorder_products(
    data: ProductReorderRequest,
    x_admin_token: str = Header(None, alias="X-Admin-Token")
):
    """Admin: Bulk update sort_order on multiple products in a single request."""
    verify_auth(x_admin_token=x_admin_token)
    now = datetime.now(timezone.utc).isoformat()
    updated = 0
    for it in data.items:
        result = await db.products.update_one(
            {"slug": it.slug},
            {"$set": {"sort_order": int(it.sort_order), "updated_at": now}}
        )
        if result.matched_count:
            updated += 1
    return {"success": True, "updated": updated}




@router.post("/admin/products")
async def create_product(
    data: ProductCreate,
    x_admin_token: str = Header(None, alias="X-Admin-Token")
):
    """Admin: Create a new product"""
    verify_auth(x_admin_token=x_admin_token)
    # Mandatory category — surfaced as a clear 422 so the admin form can show
    # a friendly error instead of a generic 500.
    if not (data.category and str(data.category).strip()):
        raise HTTPException(
            status_code=422,
            detail="Category is required. Pick one from /admin/categories before saving the product."
        )
    existing = await db.products.find_one({"slug": data.slug})
    if existing:
        raise HTTPException(status_code=400, detail="Product slug already exists")
    
    product = data.dict()
    product["created_at"] = datetime.now(timezone.utc).isoformat()
    product["updated_at"] = datetime.now(timezone.utc).isoformat()
    # If admin didn't pick a sort_order (or kept the default 99), auto-place this
    # product at the TOP of its niche so it's visible immediately on home/listing
    # pages without manual reordering. Existing products at sort_order=1 will
    # naturally tie-break by created_at desc inside `newest` sort.
    if not data.sort_order or data.sort_order >= 99:
        try:
            min_existing = await db.products.find_one(
                {"niche": data.niche or "skincare"},
                sort=[("sort_order", 1)],
                projection={"sort_order": 1, "_id": 0},
            )
            min_so = (min_existing or {}).get("sort_order")
            if isinstance(min_so, (int, float)):
                product["sort_order"] = max(1, int(min_so) - 1) if min_so > 1 else 1
            else:
                product["sort_order"] = 1
        except Exception:
            product["sort_order"] = 1
    # Auto-seed a realistic review count + rating so new cards don't feel empty.
    product["reviews_count"] = random.randint(1020, 4875)
    product["rating"] = round(random.uniform(4.5, 4.9), 1)
    await db.products.insert_one(product)

    # Fire-and-forget: generate personalised reviews tailored to this product.
    try:
        from services.ai_content_generator import generate_product_reviews
        reviews = await generate_product_reviews(
            name=data.name,
            niche=data.niche or "skincare",
            key_ingredients=data.key_ingredients or "",
            benefits=data.benefits or [],
        )
        if reviews:
            await db.product_reviews.insert_many([
                {**r, "product_slug": data.slug, "created_at": datetime.now(timezone.utc).isoformat()}
                for r in reviews
            ])
    except Exception as e:
        logging.warning(f"[admin.create_product] AI reviews generation failed for {data.slug}: {e}")

    return {"success": True, "slug": data.slug}


@router.put("/admin/products/{slug}")
async def update_product(
    slug: str,
    data: ProductUpdate,
    x_admin_token: str = Header(None, alias="X-Admin-Token")
):
    """Admin: Update product details.

    PRICE GUARD: prepaid_price / cod_price / mrp are NEVER updated by this
    endpoint unless the request also passes ``allow_price_change=true``.
    This is enforced because price changes must be a deliberate admin action
    (Jan 2026 spec — see gift_cards_and_ai.admin_update_product).
    """
    verify_auth(x_admin_token=x_admin_token)
    update = {k: v for k, v in data.dict().items() if v is not None}
    allow_price = bool(update.pop("allow_price_change", False))
    if not allow_price:
        for k in ("prepaid_price", "cod_price", "mrp"):
            update.pop(k, None)
    if not update:
        raise HTTPException(status_code=400, detail="Nothing to update")
    # Mirror singular `image` into images[0] so legacy schema consumers still find it.
    if "image" in update and update["image"]:
        img = update["image"]
        existing_imgs = update.get("images") or []
        if not existing_imgs:
            # Fetch current images to preserve any extras
            cur = await db.products.find_one({"slug": slug}, {"_id": 0, "images": 1})
            existing_imgs = (cur or {}).get("images") or []
        if not existing_imgs or existing_imgs[0] != img:
            update["images"] = [img] + [i for i in existing_imgs if i and i != img]
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.products.update_one({"slug": slug}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"success": True}


@router.delete("/admin/products/{slug}")
async def delete_product(
    slug: str,
    x_admin_token: str = Header(None, alias="X-Admin-Token")
):
    """Admin: Delete product"""
    verify_auth(x_admin_token=x_admin_token)
    result = await db.products.delete_one({"slug": slug})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"success": True}


class BulkDeleteRequest(BaseModel):
    slugs: List[str]


class BulkUpdateRequest(BaseModel):
    slugs: List[str]
    patch: Dict[str, Any]


@router.post("/admin/products/bulk-delete")
async def bulk_delete_products(
    payload: BulkDeleteRequest,
    x_admin_token: str = Header(None, alias="X-Admin-Token"),
):
    """Admin: Hard-delete a batch of products by slug. Cap at 500 per call so
    a runaway click can never wipe the entire catalog. Returns counts of
    deleted vs not-found so the UI can confirm what actually changed.
    """
    verify_auth(x_admin_token=x_admin_token)
    slugs = [s for s in (payload.slugs or []) if isinstance(s, str) and s][:500]
    if not slugs:
        raise HTTPException(status_code=400, detail="`slugs` cannot be empty")
    res = await db.products.delete_many({"slug": {"$in": slugs}})
    return {"deleted": res.deleted_count, "not_found": len(slugs) - res.deleted_count, "requested": len(slugs)}


@router.post("/admin/products/bulk-update")
async def bulk_update_products(
    payload: BulkUpdateRequest,
    x_admin_token: str = Header(None, alias="X-Admin-Token"),
):
    """Admin: Apply the same patch (e.g. {is_active: False}) to a batch.
    Whitelisted keys only — protects against accidental mass mutation of
    fields like `slug`, `price`, etc."""
    verify_auth(x_admin_token=x_admin_token)
    slugs = [s for s in (payload.slugs or []) if isinstance(s, str) and s][:500]
    if not slugs:
        raise HTTPException(status_code=400, detail="`slugs` cannot be empty")
    ALLOWED = {"is_active", "is_to_be_launched", "badge", "niche", "category", "subcategory", "stock_qty", "low_stock_threshold"}
    patch = {k: v for k, v in (payload.patch or {}).items() if k in ALLOWED}
    if not patch:
        raise HTTPException(status_code=400, detail="`patch` must contain at least one allowed field: " + ", ".join(sorted(ALLOWED)))
    patch["updated_at"] = datetime.now(timezone.utc).isoformat()
    res = await db.products.update_many({"slug": {"$in": slugs}}, {"$set": patch})
    return {"matched": res.matched_count, "modified": res.modified_count, "requested": len(slugs)}


# ==================== SCRAPER ENDPOINTS ====================
class ScrapeRequest(BaseModel):
    url: str
    max_reviews: Optional[int] = 20

@router.post("/admin/scrape/product")
async def scrape_product_endpoint(
    payload: ScrapeRequest,
    x_admin_token: str = Header(None, alias="X-Admin-Token")
):
    """Admin: Analyze a product URL → returns auto-filled product fields.
    Tries JSON-LD first, then site-specific selectors (Amazon/Flipkart/Nykaa),
    and finally an AI fallback (Claude) for unstructured pages."""
    verify_auth(x_admin_token=x_admin_token)
    from services.product_scraper import scrape_product
    data = scrape_product(payload.url)
    return data


@router.post("/admin/scrape/reviews")
async def scrape_reviews_endpoint(
    payload: ScrapeRequest,
    x_admin_token: str = Header(None, alias="X-Admin-Token")
):
    """Admin: Pull reviews from a product URL."""
    verify_auth(x_admin_token=x_admin_token)
    from services.product_scraper import scrape_reviews
    data = scrape_reviews(payload.url, payload.max_reviews or 20)
    return data


@router.post("/admin/scrape/reviews-bulk")
async def scrape_reviews_bulk_endpoint(
    urls: Dict[str, List[str]],  # {"urls": [...]}
    x_admin_token: str = Header(None, alias="X-Admin-Token")
):
    """Admin: Pull reviews from multiple URLs (bulk import)."""
    verify_auth(x_admin_token=x_admin_token)
    from services.product_scraper import scrape_reviews
    out = []
    for u in (urls.get("urls") or [])[:5]:  # cap 5 sources
        d = scrape_reviews(u, 20)
        if d.get("success"):
            for r in d.get("reviews", []):
                r["source_domain"] = d.get("source_domain")
                out.append(r)
    return {"success": True, "count": len(out), "reviews": out}


# ==================== PRODUCT REVIEWS (per-product imported list) ====================
class ReviewItem(BaseModel):
    author: str
    text: str
    rating: Optional[float] = None
    source_domain: Optional[str] = None

@router.get("/products/{slug}/reviews")
async def list_product_reviews(slug: str):
    """Public: list imported reviews for a product."""
    p = await db.products.find_one({"slug": slug}, {"_id": 0, "imported_reviews": 1})
    if not p:
        return {"reviews": []}
    return {"reviews": p.get("imported_reviews", [])}


@router.put("/admin/products/{slug}/reviews")
async def set_product_reviews(
    slug: str,
    payload: Dict[str, List[Dict]],  # {"reviews": [...]}
    x_admin_token: str = Header(None, alias="X-Admin-Token")
):
    """Admin: replace the imported reviews list for a product."""
    verify_auth(x_admin_token=x_admin_token)
    reviews = payload.get("reviews", [])[:50]
    result = await db.products.update_one(
        {"slug": slug},
        {"$set": {"imported_reviews": reviews, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"success": True, "count": len(reviews)}


# ==================== COMBO ENDPOINTS ====================

class ComboCreate(BaseModel):
    combo_id: str
    name: str
    description: str = ""
    product_slugs: List[str]
    mrp_total: float = 0
    combo_prepaid_price: float = 0
    combo_cod_price: float = 0
    discount_percent: float = 0
    badge: str = ""
    is_active: bool = True
    sort_order: int = 99
    image: Optional[str] = None
    niche: Optional[str] = None  # 'anti-aging' | 'skincare' | 'cosmetics' — controls where the combo shows
    # TBL / Preorder
    is_to_be_launched: bool = False
    launch_date: Optional[str] = None
    preorder_enabled: bool = False

class ComboUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    product_slugs: Optional[List[str]] = None
    mrp_total: Optional[float] = None
    combo_prepaid_price: Optional[float] = None
    combo_cod_price: Optional[float] = None
    discount_percent: Optional[float] = None
    badge: Optional[str] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None
    image: Optional[str] = None
    niche: Optional[str] = None
    # TBL / Preorder
    is_to_be_launched: Optional[bool] = None
    launch_date: Optional[str] = None
    preorder_enabled: Optional[bool] = None


@router.get("/combos")
async def get_all_combos(active_only: bool = Query(True), niche: Optional[str] = Query(None)):
    """Public: Get all active combos with TBL auto-flip + countdown.
    If `niche` is provided, returns combos matching that niche (combos with no niche set
    are considered universal and included as well, so legacy combos still appear)."""
    query = {"is_active": True} if active_only else {}
    if niche:
        # match niche==<niche> OR no niche set (legacy/universal)
        query["$or"] = [{"niche": niche}, {"niche": {"$in": [None, ""]}}, {"niche": {"$exists": False}}]
    combos = await db.combos.find(query, {"_id": 0}).sort("sort_order", 1).to_list(50)
    now = datetime.now(timezone.utc)
    for c in combos:
        if c.get("is_to_be_launched") and c.get("launch_date"):
            try:
                ld = datetime.fromisoformat(str(c["launch_date"]).replace("Z", "+00:00"))
                if ld <= now:
                    c["is_to_be_launched"] = False
                    c["launch_date"] = None
                    await db.combos.update_one(
                        {"combo_id": c["combo_id"]},
                        {"$set": {"is_to_be_launched": False, "launch_date": None,
                                  "updated_at": now.isoformat()}}
                    )
                else:
                    delta = ld - now
                    c["days_to_launch"] = max(0, delta.days)
                    c["hours_to_launch"] = max(0, int(delta.total_seconds() // 3600))
            except Exception:
                pass
        else:
            c["days_to_launch"] = None
    return combos


@router.put("/admin/combos/{combo_id}/launch-status")
async def set_combo_launch_status(
    combo_id: str,
    data: LaunchStatusUpdate,
    x_admin_token: str = Header(None, alias="X-Admin-Token")
):
    """Admin: Toggle a combo's TBL status."""
    verify_auth(x_admin_token=x_admin_token)
    combo = await db.combos.find_one({"combo_id": combo_id})
    if not combo:
        raise HTTPException(status_code=404, detail="Combo not found")

    update = {
        "is_to_be_launched": data.is_to_be_launched,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if data.is_to_be_launched:
        if data.launch_date:
            update["launch_date"] = data.launch_date
        else:
            from datetime import timedelta as _td
            update["launch_date"] = (datetime.now(timezone.utc) + _td(days=25)).isoformat()
        if data.preorder_enabled is not None:
            update["preorder_enabled"] = data.preorder_enabled
    else:
        update["launch_date"] = None
        update["preorder_enabled"] = False

    await db.combos.update_one({"combo_id": combo_id}, {"$set": update})
    return {"success": True, "combo_id": combo_id, "is_to_be_launched": data.is_to_be_launched}


@router.post("/admin/combos")
async def create_combo(
    data: ComboCreate,
    x_admin_token: str = Header(None, alias="X-Admin-Token")
):
    verify_auth(x_admin_token=x_admin_token)
    combo = data.dict()
    combo["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.combos.insert_one(combo)
    return {"success": True, "combo_id": data.combo_id}


@router.put("/admin/combos/{combo_id}")
async def update_combo(
    combo_id: str,
    data: ComboUpdate,
    x_admin_token: str = Header(None, alias="X-Admin-Token")
):
    verify_auth(x_admin_token=x_admin_token)
    update = {k: v for k, v in data.dict().items() if v is not None}
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.combos.update_one({"combo_id": combo_id}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Combo not found")
    return {"success": True}


@router.delete("/admin/combos/{combo_id}")
async def delete_combo(
    combo_id: str,
    x_admin_token: str = Header(None, alias="X-Admin-Token")
):
    verify_auth(x_admin_token=x_admin_token)
    await db.combos.delete_one({"combo_id": combo_id})
    return {"success": True}


# ==================== COUPON ENDPOINTS ====================

class CouponCreate(BaseModel):
    code: str
    discount_type: str = "percentage"  # percentage or fixed
    discount_value: float = 10
    min_order_amount: float = 0
    max_uses: int = 100
    expiry_days: int = 30
    is_active: bool = True
    show_on_cart: bool = True
    description: Optional[str] = None


class CouponUpdate(BaseModel):
    discount_type: Optional[str] = None
    discount_value: Optional[float] = None
    min_order_amount: Optional[float] = None
    max_uses: Optional[int] = None
    expiry_date: Optional[str] = None  # ISO date string
    expiry_days: Optional[int] = None  # alternative — extend expiry by N days
    is_active: Optional[bool] = None
    show_on_cart: Optional[bool] = None
    description: Optional[str] = None


@router.get("/admin/coupons")
async def get_all_coupons(x_admin_token: str = Header(None, alias="X-Admin-Token")):
    verify_auth(x_admin_token=x_admin_token)
    coupons = await db.coupons.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return coupons


@router.post("/admin/coupons")
async def create_coupon(data: CouponCreate, x_admin_token: str = Header(None, alias="X-Admin-Token")):
    verify_auth(x_admin_token=x_admin_token)
    coupon = data.dict()
    coupon["used_count"] = 0
    coupon["created_at"] = datetime.now(timezone.utc).isoformat()
    from datetime import timedelta
    coupon["expiry_date"] = (datetime.now(timezone.utc) + timedelta(days=data.expiry_days)).isoformat()
    del coupon["expiry_days"]
    await db.coupons.insert_one(coupon)
    return {"success": True, "code": data.code}


@router.post("/validate-coupon")
async def validate_coupon(code: str = Query(...), cart_total: float = Query(0)):
    """Public: Validate a coupon code"""
    coupon = await db.coupons.find_one({"code": code.upper(), "is_active": True}, {"_id": 0})
    if not coupon:
        raise HTTPException(status_code=404, detail="Invalid coupon code")
    if coupon.get("expiry_date") and datetime.fromisoformat(coupon["expiry_date"]) < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Coupon expired")
    if coupon.get("max_uses") and coupon.get("used_count", 0) >= coupon["max_uses"]:
        raise HTTPException(status_code=400, detail="Coupon usage limit reached")
    if cart_total < coupon.get("min_order_amount", 0):
        raise HTTPException(status_code=400, detail=f"Minimum order amount: ₹{coupon['min_order_amount']}")
    
    discount = coupon["discount_value"]
    if coupon["discount_type"] == "percentage":
        discount = round(cart_total * coupon["discount_value"] / 100, 2)
    
    return {"valid": True, "discount": discount, "discount_type": coupon["discount_type"], "discount_value": coupon["discount_value"]}


@router.get("/coupons/public")
async def list_public_coupons():
    """Public: list active, non-expired coupons that admin marked as `show_on_cart=True`.
    These appear on the cart page so customers can apply them in one click."""
    now = datetime.now(timezone.utc)
    coupons = await db.coupons.find(
        {"is_active": True, "show_on_cart": True},
        {"_id": 0, "code": 1, "discount_type": 1, "discount_value": 1,
         "min_order_amount": 1, "expiry_date": 1, "description": 1, "max_uses": 1, "used_count": 1}
    ).sort("created_at", -1).to_list(20)
    out = []
    for c in coupons:
        # Skip expired/exhausted coupons
        if c.get("expiry_date"):
            try:
                if datetime.fromisoformat(c["expiry_date"]) < now:
                    continue
            except Exception:
                pass
        if c.get("max_uses") and c.get("used_count", 0) >= c["max_uses"]:
            continue
        # Auto-generate description if missing
        if not c.get("description"):
            if c.get("discount_type") == "percentage":
                c["description"] = f"{int(c.get('discount_value', 0))}% OFF"
            else:
                c["description"] = f"₹{int(c.get('discount_value', 0))} OFF"
            if c.get("min_order_amount"):
                c["description"] += f" on orders above ₹{int(c['min_order_amount'])}"
        out.append(c)
    return out


@router.delete("/admin/coupons/{code}")
async def delete_coupon(code: str, x_admin_token: str = Header(None, alias="X-Admin-Token")):
    verify_auth(x_admin_token=x_admin_token)
    await db.coupons.delete_one({"code": code})
    return {"success": True}


@router.put("/admin/coupons/{code}")
async def update_coupon(code: str, data: CouponUpdate, x_admin_token: str = Header(None, alias="X-Admin-Token")):
    """Admin: edit coupon details — discount, expiry, active state, show_on_cart, description, etc."""
    verify_auth(x_admin_token=x_admin_token)
    update = {k: v for k, v in data.dict().items() if v is not None and k != "expiry_days"}
    # Convenience: extend expiry by N days from now
    if data.expiry_days is not None:
        from datetime import timedelta
        update["expiry_date"] = (datetime.now(timezone.utc) + timedelta(days=int(data.expiry_days))).isoformat()
    if not update:
        return {"success": True, "code": code, "updated": 0}
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.coupons.update_one({"code": code.upper()}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Coupon not found")
    return {"success": True, "code": code}


# ==================== CART VALIDATION ====================

class CartItem(BaseModel):
    product_slug: Optional[str] = None
    combo_id: Optional[str] = None
    quantity: int = 1
    shade_id: Optional[str] = None  # cosmetics shade variant selection

class CartValidateRequest(BaseModel):
    items: List[CartItem]
    coupon_code: Optional[str] = None
    gift_card_code: Optional[str] = None
    payment_method: str = "prepaid"


@router.post("/cart/validate")
async def validate_cart(data: CartValidateRequest):
    """Validate cart items, calculate totals.

    Perf: previously did N round-trips to MongoDB (one find_one per cart item +
    one per combo). For a 10-item cart that's 10 sequential queries. Now we
    batch-load ALL products with a single ``$in`` query and ALL combos with
    another single ``$in`` query, then iterate in-memory. ~10x speedup on
    typical carts; preserves shade/stock/TBL/coupon logic byte-for-byte.
    """
    validated_items = []
    subtotal = 0
    mrp_total = 0
    stock_warnings = []  # list of {slug, message, capped_to}

    # COD no longer carries a premium — the new platform fee covers both COD + prepaid
    # uniformly (delivery & taxes are the differentiators below).
    cod_premium = 0

    # ---- Batch-load products & combos in TWO queries instead of 2N ----
    product_slugs = [i.product_slug for i in data.items if i.product_slug]
    combo_ids = [i.combo_id for i in data.items if i.combo_id]
    products_by_slug: Dict[str, Any] = {}
    combos_by_id: Dict[str, Any] = {}
    if product_slugs:
        async for p in db.products.find(
            {"slug": {"$in": product_slugs}, "is_active": True}, {"_id": 0}
        ):
            products_by_slug[p["slug"]] = p
    if combo_ids:
        async for c in db.combos.find(
            {"combo_id": {"$in": combo_ids}, "is_active": True}, {"_id": 0}
        ):
            combos_by_id[c["combo_id"]] = c

    for item in data.items:
        if item.product_slug:
            product = products_by_slug.get(item.product_slug)
            if not product:
                continue
            # Defense in depth: drop TBL products from the cart so they cannot reach checkout.
            if product.get("is_to_be_launched"):
                continue
            # ---- Shade resolution (for cosmetics with shade variants) ----
            shades = product.get("shades") or []
            chosen_shade = None
            if shades:
                # If product has shades but no shade_id passed, drop with warning
                if not item.shade_id:
                    stock_warnings.append({"slug": product["slug"], "message": "Please pick a shade", "code": "shade_required"})
                    continue
                chosen_shade = next((s for s in shades if str(s.get("id")) == str(item.shade_id)), None)
                if not chosen_shade:
                    stock_warnings.append({"slug": product["slug"], "message": "Selected shade no longer available", "code": "shade_missing"})
                    continue
            # ---- Stock enforcement ----
            available = int(chosen_shade["stock_qty"]) if chosen_shade and chosen_shade.get("stock_qty") is not None else int(product.get("stock_qty") or 0)
            qty = item.quantity
            if available <= 0:
                stock_warnings.append({"slug": product["slug"], "message": "Out of stock", "code": "out_of_stock"})
                continue
            if qty > available:
                stock_warnings.append({"slug": product["slug"], "message": f"Only {available} left — quantity reduced", "code": "qty_capped", "capped_to": available})
                qty = available
            # Always use prepaid price as base — COD premium is applied at cart-level (not per-item)
            price = product["prepaid_price"]
            line_total = price * qty
            mrp_line = product["mrp"] * qty
            shade_img = (chosen_shade or {}).get("image") if chosen_shade else None
            base_img = product["images"][0] if product.get("images") else ""
            validated_items.append({
                "type": "product",
                "slug": product["slug"],
                "name": product["name"],
                "short_name": product["short_name"],
                "image": shade_img or base_img,
                "mrp": product["mrp"],
                "price": price,
                "quantity": qty,
                "line_total": line_total,
                "shade_id": chosen_shade.get("id") if chosen_shade else None,
                "shade_name": chosen_shade.get("name") if chosen_shade else None,
                "shade_hex": chosen_shade.get("hex") if chosen_shade else None,
                "stock_left": available,
            })
            subtotal += line_total
            mrp_total += mrp_line
        elif item.combo_id:
            combo = combos_by_id.get(item.combo_id)
            if not combo:
                continue
            # Defense in depth: drop TBL combos from cart.
            if combo.get("is_to_be_launched"):
                continue
            price = combo["combo_prepaid_price"]  # uniform prepaid base
            line_total = price * item.quantity
            mrp_line = combo["mrp_total"] * item.quantity
            validated_items.append({
                "type": "combo",
                "combo_id": combo["combo_id"],
                "name": combo["name"],
                "image": combo.get("image", ""),
                "product_slugs": combo["product_slugs"],
                "mrp_total": combo["mrp_total"],
                "price": price,
                "quantity": item.quantity,
                "line_total": line_total
            })
            subtotal += line_total
            mrp_total += mrp_line
    
    # Apply coupon
    discount = 0
    if data.coupon_code:
        coupon = await db.coupons.find_one({"code": data.coupon_code.upper(), "is_active": True}, {"_id": 0})
        if coupon:
            if coupon["discount_type"] == "percentage":
                discount = round(subtotal * coupon["discount_value"] / 100, 2)
            else:
                discount = coupon["discount_value"]
    
    total = max(subtotal - discount, 0)
    
    # Volume discount DISABLED — buy-N-get-X% removed per business policy (kills margin).
    total_items = sum(i["quantity"] for i in validated_items)
    volume_discount = 0
    volume_discount_percent = 0
    settings_doc = await db.site_settings.find_one({"_id": "main"}, {"_id": 0})

    # Band Margin Strategy (Feb 2026 — tiered for profitability):
    #   Delivery fee:
    #     < ₹1000  → ₹49
    #     ≥ ₹1000  → ₹39
    #     ≥ ₹1500  → ₹29
    #     ≥ ₹2500  → ₹19
    #   Tax & charges reduction (base ₹99):
    #     < ₹1000  → 0%  (full ₹99)
    #     ≥ ₹1000  → 30% off
    #     ≥ ₹1500  → 35% off
    #     ≥ ₹2000  → 40% off
    #     ≥ ₹5000  → 50% off
    delivery_fee_amount = float((settings_doc or {}).get("delivery_fee") or 49)
    tax_charges_full = float((settings_doc or {}).get("tax_charges") or 99)
    packaging_fee_amount = float((settings_doc or {}).get("packaging_fee") or 15)
    moq_amount = float((settings_doc or {}).get("moq_amount") or 300)
    pre_ship_total = max(total - volume_discount, 0)

    # ---- Tiered delivery fee ----
    if pre_ship_total >= 2500:
        delivery_fee = 19
    elif pre_ship_total >= 1500:
        delivery_fee = 29
    elif pre_ship_total >= 1000:
        delivery_fee = 39
    else:
        delivery_fee = delivery_fee_amount

    # ---- Tiered tax reduction ----
    if pre_ship_total >= 5000:
        tax_reduction_pct = 0.50
    elif pre_ship_total >= 2000:
        tax_reduction_pct = 0.40
    elif pre_ship_total >= 1500:
        tax_reduction_pct = 0.35
    elif pre_ship_total >= 1000:
        tax_reduction_pct = 0.30
    else:
        tax_reduction_pct = 0.0
    tax_charges = round(tax_charges_full * (1 - tax_reduction_pct))

    qualifies_999 = pre_ship_total >= 1000  # any tier discount = unlock badge
    free_shipping_threshold = 1000  # legacy field; first discount tier
    packaging_fee = packaging_fee_amount if pre_ship_total > 0 else 0
    # Savings on charges = (full delivery − tier delivery) + (tax_full − tier tax)
    charges_savings = (delivery_fee_amount - delivery_fee) + (tax_charges_full - tax_charges) if pre_ship_total >= 1000 else 0
    tax_reduction_label = f"{int(tax_reduction_pct * 100)}% OFF" if tax_reduction_pct > 0 else None

    free_shipping_remaining = max(0, free_shipping_threshold - pre_ship_total)
    moq_remaining = max(0, moq_amount - pre_ship_total) if pre_ship_total > 0 else 0
    moq_block = bool(pre_ship_total > 0 and pre_ship_total < moq_amount)

    # Keep legacy `shipping_fee` field for backward compatibility with older clients
    shipping_fee = delivery_fee + tax_charges + packaging_fee

    final_total = pre_ship_total + cod_premium + shipping_fee
    total_savings = max(mrp_total - (final_total - shipping_fee - cod_premium), 0)

    # Apply gift card AFTER all charges — gift card can pay for charges too
    gift_card_discount = 0
    gift_card_info = None
    if data.gift_card_code and final_total > 0:
        from services.gift_card_service import GiftCardService
        gc_svc = GiftCardService(db)
        gc_res = await gc_svc.validate_for_redemption(data.gift_card_code, final_total)
        if gc_res.get("valid"):
            gift_card_discount = gc_res["discount"]
            gift_card_info = {
                "code": gc_res["code"],
                "discount": gc_res["discount"],
                "remaining_balance": gc_res["remaining_balance"],
                "remaining_after": gc_res["remaining_after"],
                "message": gc_res["message"],
            }
            final_total = max(0, final_total - gift_card_discount)
        else:
            gift_card_info = {"error": gc_res.get("message", "Invalid gift card")}
    
    # Compute next tier hint so the cart UI can say "Spend ₹X more to save ₹Y"
    next_tier = None
    tier_thresholds = [
        (1000, 30, 39),
        (1500, 35, 29),
        (2000, 40, 29),
        (2500, 40, 19),
        (5000, 50, 19),
    ]
    for thr, pct, dlv in tier_thresholds:
        if pre_ship_total < thr:
            tier_tax = round(tax_charges_full * (1 - pct / 100))
            next_tier = {
                "threshold": thr,
                "spend_more": int(round(thr - pre_ship_total)),
                "next_tax_charges": int(tier_tax),
                "next_delivery_fee": int(dlv),
                "next_tax_pct_off": pct,
                "label": f"Spend ₹{int(round(thr - pre_ship_total))} more to unlock {pct}% OFF taxes" + (f" + ₹{dlv} delivery" if dlv != delivery_fee else ""),
            }
            break

    return {
        "items": validated_items,
        "mrp_total": int(round(mrp_total)),
        "subtotal": int(round(subtotal)),
        "discount": int(round(discount)),
        "volume_discount": 0,
        "volume_discount_percent": 0,
        "cod_premium": int(round(cod_premium)),
        "shipping_fee": int(round(shipping_fee)),
        "delivery_fee": int(round(delivery_fee)),
        "delivery_fee_original": int(round(delivery_fee_amount)),
        "tax_charges": int(round(tax_charges)),
        "tax_charges_original": int(round(tax_charges_full)),
        "tax_reduction_label": tax_reduction_label,
        "tax_reduction_pct": int(tax_reduction_pct * 100),
        "packaging_fee": int(round(packaging_fee)),
        "charges_savings": int(round(charges_savings)),
        "free_shipping_threshold": int(round(free_shipping_threshold)),
        "free_shipping_remaining": int(round(free_shipping_remaining)),
        "moq_amount": int(round(moq_amount)),
        "moq_remaining": int(round(moq_remaining)),
        "moq_block": moq_block,
        "payment_method": data.payment_method,
        "gift_card": gift_card_info,
        "gift_card_discount": int(round(gift_card_discount)),
        "total": int(round(final_total)),
        "savings": int(round(total_savings)),
        "item_count": total_items,
        "prepaid_savings_hint": int(round(cod_premium)),
        "stock_warnings": stock_warnings,
        "next_tier": next_tier,
    }


# ==================== ADMIN SITE SETTINGS ====================

class SiteSettingsUpdate(BaseModel):
    hero_banner_image: Optional[str] = None
    hero_title: Optional[str] = None
    hero_subtitle: Optional[str] = None
    presale_enabled: Optional[bool] = None
    presale_title: Optional[str] = None
    presale_badge: Optional[str] = None
    presale_price: Optional[float] = None
    cod_advance_amount: Optional[float] = None
    before_after_images: Optional[List[Dict]] = None
    result_images: Optional[List[str]] = None
    bundle_hero_image: Optional[str] = None
    # Anti-aging kit landscape banner shown on /shop view-all page
    shop_kit_banner_image: Optional[str] = None
    shop_kit_banner_eyebrow: Optional[str] = None
    shop_kit_banner_title: Optional[str] = None
    shop_kit_banner_subtitle: Optional[str] = None
    shop_kit_banner_link: Optional[str] = None
    homepage_feature_image: Optional[str] = None  # NEW: editable landscape banner that replaces 3-product hero side panel
    homepage_feature_title: Optional[str] = None
    homepage_feature_subtitle: Optional[str] = None
    volume_discounts: Optional[List[Dict]] = None  # [{min_items: 2, discount_percent: 5}, ...]
    # Multi-banner hero carousel
    banner_carousel: Optional[List[Dict]] = None  # [{id, image, title, subtitle, cta_text, cta_link, sort_order}, ...]
    carousel_autoplay_ms: Optional[int] = None  # default 2000
    # Per-niche home page customization
    # Shape: { "anti-aging": {hero: {...}, bestsellers: {...}, cta_section: {...}, banner_carousel: [...], ...},
    #          "skincare": {...}, "cosmetics": {...} }
    niche_settings: Optional[Dict[str, Dict]] = None
    # Premium /categories hub (Shop by Category) — admin-editable hero, niche cards, ribbon banner, ingredient strip.
    # Shape: {
    #   hero: { eyebrow, title_line1, title_line2, subtitle, image_desktop, image_mobile, accent, search_placeholder },
    #   niche_cards: {
    #     anti_aging: { enabled, eyebrow, title, subtitle, image, cta_label, cta_link, accent },
    #     skincare:   {...same...},
    #     cosmetics:  {...same...}
    #   },
    #   ribbon: { enabled, text, cta_label, cta_link, bg_from, bg_to },
    #   ingredient_strip: { enabled, title, subtitle, items: [{name, image, hex}, ...] },
    #   editors_picks: { enabled, eyebrow, title, slugs: [...product_slug...] }
    # }
    categories_hub: Optional[Dict] = None


@router.get("/site-settings")
async def get_site_settings():
    """Public: Get site settings"""
    settings = await db.site_settings.find_one({"_id": "main"}, {"_id": 0})
    return settings or {}


@router.put("/admin/site-settings")
async def update_site_settings(
    data: SiteSettingsUpdate,
    x_admin_token: str = Header(None, alias="X-Admin-Token")
):
    verify_auth(x_admin_token=x_admin_token)
    update = {k: v for k, v in data.dict().items() if v is not None}
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.site_settings.update_one({"_id": "main"}, {"$set": update}, upsert=True)
    return {"success": True}


# ==================== CUSTOMER RETENTION ====================

@router.get("/admin/retention/customers")
async def get_retention_customers(
    x_admin_token: str = Header(None, alias="X-Admin-Token"),
    x_employee_token: str = Header(None, alias="X-Employee-Token"),
    days: int = Query(15)
):
    """Get customers due for follow-up (15 or 30 days after purchase)"""
    verify_auth(x_admin_token=x_admin_token, x_employee_token=x_employee_token, permission="retention")
    from datetime import timedelta
    target_date = datetime.now(timezone.utc) - timedelta(days=days)
    window_start = target_date - timedelta(days=2)
    window_end = target_date + timedelta(days=2)
    
    orders = await db.orders.find({
        "status": {"$in": ["confirmed", "delivered"]},
        "created_at": {"$gte": window_start.isoformat(), "$lte": window_end.isoformat()}
    }, {"_id": 0}).to_list(500)
    
    # Check for existing retention notes
    for order in orders:
        note = await db.retention_notes.find_one({"order_id": order.get("order_id")}, {"_id": 0})
        order["retention_note"] = note
    
    return {"customers": orders, "days": days}


class RetentionNoteCreate(BaseModel):
    order_id: str
    status: str  # interested, not_interested, reorder, callback
    notes: str = ""


@router.post("/admin/retention/note")
async def add_retention_note(
    data: RetentionNoteCreate,
    x_admin_token: str = Header(None, alias="X-Admin-Token"),
    x_employee_token: str = Header(None, alias="X-Employee-Token")
):
    verify_auth(x_admin_token=x_admin_token, x_employee_token=x_employee_token, permission="retention")
    note = data.dict()
    note["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.retention_notes.update_one(
        {"order_id": data.order_id},
        {"$set": note},
        upsert=True
    )
    return {"success": True}


# ==================== BEFORE/AFTER IMAGE MANAGEMENT ====================

class BeforeAfterImage(BaseModel):
    product_slug: str
    customer_name: str = ""
    before_image: str
    after_image: str
    duration: str = ""
    description: str = ""


@router.get("/admin/before-after")
async def get_before_after(x_admin_token: str = Header(None, alias="X-Admin-Token")):
    verify_auth(x_admin_token=x_admin_token)
    images = await db.before_after_images.find({}, {"_id": 0}).to_list(100)
    return images


@router.get("/before-after/{product_slug}")
async def get_product_before_after(product_slug: str):
    """Public: Get before/after images for a product"""
    images = await db.before_after_images.find({"product_slug": product_slug}, {"_id": 0}).to_list(20)
    return images


@router.post("/admin/before-after")
async def add_before_after(data: BeforeAfterImage, x_admin_token: str = Header(None, alias="X-Admin-Token")):
    verify_auth(x_admin_token=x_admin_token)
    doc = data.dict()
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    doc["ba_id"] = f"ba_{secrets.token_hex(4)}"
    await db.before_after_images.insert_one(doc)
    return {"success": True, "ba_id": doc["ba_id"]}


@router.delete("/admin/before-after/{ba_id}")
async def delete_before_after(ba_id: str, x_admin_token: str = Header(None, alias="X-Admin-Token")):
    verify_auth(x_admin_token=x_admin_token)
    await db.before_after_images.delete_one({"ba_id": ba_id})
    return {"success": True}


# ==================== IMAGE UPLOAD (admin) ====================

@router.post("/admin/upload-image")
async def upload_image(
    file: UploadFile = File(...),
    x_admin_token: str = Header(None, alias="X-Admin-Token")
):
    """Upload an image. Automatically compresses + resizes (max 1600px, JPEG/WebP quality 80)
    to keep product pages fast. Saves to /app/backend/uploads/products/ and returns a public URL
    served via `/api/uploads/products/<file>`.
    """
    verify_auth(x_admin_token=x_admin_token)
    import io
    import uuid
    from pathlib import Path
    from PIL import Image

    raw = await file.read()
    if len(raw) > 15 * 1024 * 1024:  # 15 MB raw cap — we'll compress heavily
        raise HTTPException(status_code=400, detail="Image too large (max 15 MB)")
    mime = file.content_type or "image/jpeg"
    if not mime.startswith("image/"):
        raise HTTPException(status_code=400, detail="File is not an image")

    try:
        img = Image.open(io.BytesIO(raw))
        # Respect EXIF rotation so phone photos land upright
        try:
            from PIL import ImageOps
            img = ImageOps.exif_transpose(img)
        except Exception:
            pass

        # Preserve transparency for PNGs; otherwise convert to RGB for JPEG output
        has_alpha = img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info)
        is_png_like = mime in ("image/png", "image/webp") and has_alpha

        # Resize if wider/taller than 1600px on the long edge
        MAX_DIM = 1600
        if max(img.size) > MAX_DIM:
            img.thumbnail((MAX_DIM, MAX_DIM), Image.LANCZOS)

        buf = io.BytesIO()
        if is_png_like:
            img.save(buf, format="WEBP", quality=82, method=6)
            out_ext = "webp"
            out_mime = "image/webp"
        else:
            if img.mode != "RGB":
                img = img.convert("RGB")
            img.save(buf, format="JPEG", quality=82, optimize=True, progressive=True)
            out_ext = "jpg"
            out_mime = "image/jpeg"
        compressed = buf.getvalue()
    except Exception as e:
        logging.error(f"Image compression failed: {e}")
        raise HTTPException(status_code=400, detail="Could not process image")

    # === Storage strategy ===
    # Cloudinary is the ONLY durable storage — the local /uploads folder is
    # ephemeral (wiped on every redeploy in Kubernetes). If Cloudinary is
    # configured we upload there and return its CDN URL. If it's NOT configured
    # we FAIL the request loudly instead of silently saving to the local disk
    # that will disappear on next deploy — that's exactly the bug that caused
    # "uploaded images are missing" in production.
    from services import cloudinary_service as _cs
    cloudinary_ok = False
    try:
        cloudinary_ok = await _cs.ensure_configured(db)
    except Exception as exc:
        logging.warning(f"Cloudinary probe failed: {exc}")

    public_url = None
    if cloudinary_ok:
        try:
            res = await _cs.upload_image(db, compressed, folder="celesta-glow/products", public_id=uuid.uuid4().hex)
            if res.get("url"):
                public_url = res["url"]
        except Exception as exc:
            logging.error(f"Cloudinary upload failed: {exc}")
            raise HTTPException(
                status_code=502,
                detail=f"Image upload to Cloudinary failed: {exc}. "
                       f"Please retry — your image is NOT saved yet."
            )

    # Fallback: local disk is only used when Cloudinary is unreachable AND we
    # explicitly allow it via env. In production this branch should never run.
    allow_local = (os.environ.get("ALLOW_LOCAL_UPLOADS") or "").lower() in ("1", "true", "yes")
    if not public_url:
        if not allow_local:
            raise HTTPException(
                status_code=503,
                detail=(
                    "Image storage is not configured. Cloudinary credentials "
                    "(CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET) "
                    "are missing or invalid. Images uploaded to local disk would "
                    "be lost on the next deploy, so this request is being blocked "
                    "to protect you. Fix: set the three Cloudinary env vars and redeploy."
                ),
            )
        # Dev/preview fallback only — write locally for iteration speed.
        uploads_dir = Path(__file__).parent.parent / "uploads" / "products"
        uploads_dir.mkdir(parents=True, exist_ok=True)
        filename = f"{uuid.uuid4().hex}.{out_ext}"
        (uploads_dir / filename).write_bytes(compressed)
        public_url = f"/api/uploads/products/{filename}"

    return {
        "success": True,
        "url": public_url,
        "storage": "cloudinary" if cloudinary_ok else "local",
        "original_size": len(raw),
        "size": len(compressed),
        "mime": out_mime,
        "width": img.size[0],
        "height": img.size[1],
    }


# ==================== STORAGE HEALTH / DIAGNOSTICS (admin) ====================

@router.get("/admin/storage/health")
async def storage_health(x_admin_token: str = Header(None, alias="X-Admin-Token")):
    """Tells the admin EXACTLY where image uploads go right now + which existing
    products are pointing at ephemeral /api/uploads/ URLs (which will 404 after
    the next redeploy). Lets you see the damage and target your re-uploads."""
    verify_auth(x_admin_token=x_admin_token)
    from services import cloudinary_service as _cs
    ok = await _cs.ensure_configured(db)
    creds = await _cs.get_cloudinary_credentials(db)

    # Scan products + combos for any URL pointing at the ephemeral /api/uploads path
    broken_slugs = []
    async for p in db.products.find({}, {"_id": 0, "slug": 1, "name": 1, "images": 1}):
        imgs = p.get("images") or []
        dead = [u for u in imgs if isinstance(u, str) and u.startswith("/api/uploads/")]
        if dead:
            broken_slugs.append({"slug": p.get("slug"), "name": p.get("name"), "dead_count": len(dead), "total": len(imgs)})
    return {
        "cloudinary_configured": ok,
        "cloud_name": creds.get("cloud_name") or None,
        "loaded_from": creds.get("loaded_from"),
        "new_uploads_will_go_to": "cloudinary" if ok else "FAIL (request will be blocked)",
        "products_with_dead_images": broken_slugs,
        "dead_image_count": sum(p["dead_count"] for p in broken_slugs),
        "fix_hint": (
            "Re-upload the flagged products' images — the new version of the "
            "upload endpoint will push them straight to Cloudinary."
            if ok else
            "Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET "
            "env vars on the production deployment and redeploy."
        ),
    }


@router.post("/admin/storage/purge-dead-images")
async def purge_dead_images(x_admin_token: str = Header(None, alias="X-Admin-Token")):
    """Remove every /api/uploads/... URL from product.images arrays so the
    broken icon is replaced by the empty-placeholder on the store. Admin can
    then re-upload fresh images cleanly."""
    verify_auth(x_admin_token=x_admin_token)
    touched = 0
    async for p in db.products.find({"images": {"$regex": "^/api/uploads/"}}, {"_id": 0, "slug": 1, "images": 1}):
        clean = [u for u in (p.get("images") or []) if not (isinstance(u, str) and u.startswith("/api/uploads/"))]
        await db.products.update_one({"slug": p["slug"]}, {"$set": {"images": clean}})
        touched += 1
    return {"success": True, "products_updated": touched}


# ==================== SEED DATA ====================

async def ensure_indexes():
    """Create the indexes that make paginated listing + search fast at scale.
    Safe to call on every startup — MongoDB skips re-creation when an index
    with the same spec already exists."""
    try:
        # Hub pages — niche + is_active + (subcategory|category) is the hot path.
        await db.products.create_index([("niche", 1), ("is_active", 1), ("sort_order", 1)])
        await db.products.create_index([("niche", 1), ("category", 1), ("is_active", 1)])
        await db.products.create_index([("niche", 1), ("subcategory", 1), ("is_active", 1)])
        await db.products.create_index([("category", 1), ("is_active", 1)])
        await db.products.create_index([("subcategory", 1), ("is_active", 1)])
        await db.products.create_index([("concerns", 1), ("is_active", 1)])
        await db.products.create_index([("brand", 1), ("is_active", 1)])
        await db.products.create_index([("tags", 1), ("is_active", 1)])
        # Slug — hot path for product detail
        await db.products.create_index("slug", unique=True, sparse=True)
        # Price + recency
        await db.products.create_index([("prepaid_price", 1)])
        await db.products.create_index([("created_at", -1)])
        await db.products.create_index([("total_orders", -1)])
        # Stock filter (used inside the public-catalog $and clause)
        await db.products.create_index([("is_active", 1), ("stock_qty", 1)])
        # Text index for /search (Atlas-Search-compatible)
        try:
            await db.products.create_index(
                [("name", "text"), ("brand", "text"),
                 ("description", "text"), ("tags", "text")],
                name="product_text_search",
                default_language="english",
            )
        except Exception:
            pass  # already exists with different spec → skip
        # Orders — for revenue dashboards
        await db.orders.create_index([("status", 1), ("created_at", -1)])
        await db.orders.create_index([("created_at", -1)])
        await db.orders.create_index([("delivery_status", 1), ("created_at", -1)])
        await db.orders.create_index([("delivered_at", -1)])
        await db.orders.create_index("order_id", unique=True, sparse=True)
        logging.info("[products] indexes ensured")
    except Exception as e:
        logging.warning(f"[products] ensure_indexes failed: {e}")


async def seed_products():
    """Seed initial product catalog if empty"""
    count = await db.products.count_documents({})
    if count > 0:
        return
    
    logging.info("Seeding product catalog...")
    
    products = [
        {
            "slug": "anti-aging-serum",
            "name": "Celesta Glow Advanced Face Serum",
            "short_name": "Anti-Aging Serum",
            "tagline": "Anti-Aging + Brightening Formula",
            "description": "A lightweight, fast-absorbing formula designed to improve skin clarity and enhance overall radiance. Formulated with Niacinamide, Alpha Arbutin, and a stable form of Vitamin C, it helps reduce dullness, refine skin texture, and promote a more even-looking complexion. Suitable for daily use across all skin types.",
            "category": "serum",
            "key_ingredients": "Niacinamide + Alpha Arbutin + Vitamin C",
            "ingredients_full": "Aqua, Aloe Barbadensis Leaf Extract, Coco-Caprylate/Caprate, Glycerin, Helianthus Annuus (Sunflower) Seed Oil, Sodium Polyacrylate, Xylitol, Caprylic Acid, Glyceryl Stearate, Diethylhexyl Maleate, Cetearyl Alcohol, Propanediol, Sodium Hyaluronate, Phenoxyethanol, Ethylhexylglycerin, Hydrolyzed Pea Protein, Tocopherol, Stevioside, 4-n-Butylresorcinol, Dimethyl Isosorbide, Hydroxypinacolone Retinoate, Sodium Gluconate, Cyamopsis Tetragonoloba (Guar) Gum",
            "benefits": ["Reduces Dullness & Dark Spots", "Supports Firm, Youthful Skin", "Brightens & Evens Skin Tone", "Lightweight Daily Use Formula"],
            "how_to_use": "Apply to clean, dry skin on the face and neck. Use in the evening. Follow with sunscreen during the day.",
            "size": "30ml / 1.01 fl oz",
            "images": [],
            "mrp": 1699,
            "prepaid_price": 999,
            "cod_price": 1099,
            "cod_advance": 29,
            "discount_percent": 41,
            "badge": "Bestseller",
            "is_active": True,
            "sort_order": 1,
            "rating": 4.8,
            "reviews_count": 2847,
            "skin_type": "All Skin Types",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "slug": "anti-aging-cream",
            "name": "Celesta Glow Advanced Retinoid Night Cream",
            "short_name": "Anti-Aging Night Cream",
            "tagline": "Anti-Aging + Brightening Formula",
            "description": "An advanced night cream formulated with Retinoid and Hyaluronic Acid. Works overnight to reduce fine lines and wrinkles, improve skin firmness, brighten and even skin tone, and deeply hydrate for a youthful morning glow.",
            "category": "cream",
            "key_ingredients": "Retinoid + Hyaluronic Acid",
            "ingredients_full": "Aqua, Aloe Barbadensis Leaf Extract, Coco-Caprylate/Caprate, Glycerin, Helianthus Annuus (Sunflower) Seed Oil, Sodium Polyacrylate, Xylitol, Caprylic Acid, Glyceryl Stearate, Diethylhexyl Maleate, Cetearyl Alcohol, Propanediol, Sodium Hyaluronate, Phenoxyethanol, Ethylhexylglycerin, Hydrolyzed Pea Protein, Tocopherol, Stevioside, 4-n-Butylresorcinol, Dimethyl Isosorbide, Hydroxypinacolone Retinoate, Sodium Gluconate, Cyamopsis Tetragonoloba (Guar) Gum",
            "benefits": ["Reduces Fine Lines & Wrinkles", "Improves Skin Firmness", "Brightens & Evens Skin Tone", "Deeply Hydrates Overnight"],
            "how_to_use": "Apply to clean, dry skin on the face and neck. Use in the evening. Follow with sunscreen during the day.",
            "size": "50ml / 1.69 fl oz",
            "images": [],
            "mrp": 1499,
            "prepaid_price": 899,
            "cod_price": 999,
            "cod_advance": 29,
            "discount_percent": 40,
            "badge": "New Launch",
            "is_active": True,
            "sort_order": 2,
            "rating": 4.7,
            "reviews_count": 1293,
            "skin_type": "All Skin Types",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "slug": "under-eye-cream",
            "name": "Celesta Glow Caffeine Under Eye Cream",
            "short_name": "Under Eye Cream",
            "tagline": "Dark Circle + Puffiness + Anti-Aging Formula",
            "description": "A lightweight formula designed for the delicate under-eye area. Enriched with Caffeine, Niacinamide, and Hyaluronic Acid, it helps reduce the appearance of puffiness, improve under-eye brightness, and smooth the look of fine lines while providing lasting hydration.",
            "category": "eye-care",
            "key_ingredients": "Caffeine + Niacinamide + Hyaluronic Acid",
            "ingredients_full": "Aqua, Aloe Barbadensis Leaf Extract, Caffeine, Butyrospermum Parkii (Shea) Butter Extract, Sodium Starch Octenylsuccinate, Cera Alba (Beeswax), Hydroxyethyl Behenamidopropyl Dimonium Chloride, Polyquaternium-67, Hydrated Silica, Isopropyl Myristate, PEG-100 Stearate, Glyceryl Stearate, Stearic Acid, Cetyl Alcohol, Glycerin, Propanediol, Butyrospermum Parkii (Shea) Butter, Glyceryl Stearate SE, Olea Europaea (Olive) Fruit Oil, Prunus Amygdalus Dulcis (Sweet Almond) Oil, Glycyrrhiza Glabra (Licorice) Root Extract, Sodium Hyaluronate, Hydrolyzed Pea Protein, Niacinamide, Phenoxyethanol, Ethylhexylglycerin, Ammonium Acryloyldimethyltaurate/VP Copolymer, Stevioside, Allantoin, Sodium Gluconate, Tocopherol",
            "benefits": ["Reduces Appearance of Puffiness", "Improves Under-Eye Brightness", "Smooths Fine Lines Around Eyes", "Provides Lightweight Hydration", "Suitable for Daily Use"],
            "how_to_use": "Apply a small amount to the under-eye area. Gently pat with fingertips until absorbed. Use morning and evening.",
            "size": "15g / 0.52 oz",
            "images": [],
            "mrp": 899,
            "prepaid_price": 549,
            "cod_price": 649,
            "cod_advance": 29,
            "discount_percent": 39,
            "badge": "New Launch",
            "is_active": True,
            "sort_order": 3,
            "rating": 4.7,
            "reviews_count": 987,
            "skin_type": "All Skin Types",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "slug": "sunscreen",
            "name": "Celesta Glow SPF 50 PA+++ Sunscreen",
            "short_name": "SPF 50 Sunscreen",
            "tagline": "Broad Spectrum + Lightweight + Matte Feel",
            "description": "A lightweight, broad-spectrum formula designed to protect the skin from harmful UVA and UVB rays. Enriched with Niacinamide and antioxidant Vitamin E, it helps support skin clarity while providing a comfortable, non-greasy matte finish.",
            "category": "sunscreen",
            "key_ingredients": "Niacinamide + Vitamin E",
            "ingredients_full": "Aqua, Aloe Barbadensis Leaf Extract, Methylene Bis-Benzotriazolyl Tetramethylbutylphenol, Decyl Glucoside, Propylene Glycol, Xanthan Gum, Propanediol, Glycerin, Titanium Dioxide, Niacinamide, Betaine, Chamomilla Recutita (Chamomile) Flower Water, Benzyl Alcohol, Ethylhexylglycerin, Tocopherol, Carbomer, Hydrolyzed Pea Protein, 4-n-Butylresorcinol, Stevioside, Sodium Gluconate, Cyamopsis Tetragonoloba (Guar) Gum",
            "benefits": ["Broad Spectrum UVA/UVB Protection", "Prevents Sun-Induced Skin Damage", "Lightweight, Non-Greasy Texture", "Provides a Matte Finish"],
            "how_to_use": "Apply generously to face and exposed areas 15 minutes before sun exposure. Reapply every 2-3 hours, or after sweating or washing.",
            "size": "50g / 1.76 oz",
            "images": [],
            "mrp": 799,
            "prepaid_price": 499,
            "cod_price": 599,
            "cod_advance": 29,
            "discount_percent": 38,
            "badge": "Daily Essential",
            "is_active": True,
            "sort_order": 4,
            "rating": 4.6,
            "reviews_count": 1542,
            "skin_type": "All Skin Types",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "slug": "cleanser",
            "name": "Celesta Glow Gentle Cleanser",
            "short_name": "Gentle Cleanser",
            "tagline": "Anti-Aging Formula",
            "description": "A mild, pH-balanced face cleanser formulated to effectively remove dirt, excess oil, and impurities without disrupting the skin barrier. Enriched with Niacinamide and Salicylic Acid, it helps improve skin clarity, refine texture, and support a healthier-looking complexion.",
            "category": "cleanser",
            "key_ingredients": "Niacinamide + Salicylic Acid + Pea Protein",
            "ingredients_full": "Aqua, Stearic Acid, Sodium Laureth Sulfate, Coco Fatty Acids, Potassium Hydroxide, Sorbitol, Lauric Acid, Aloe Barbadensis Leaf Extract, Cocamide MEA, Myristic Acid, Sodium Lactate, Sodium Gluconate, Palmitic Acid, Propylene Glycol, Salicylic Acid, Hydrolyzed Pea Protein, Phenoxyethanol, Ethylhexylglycerin, Stevioside, Melaleuca Alternifolia (Tea Tree) Leaf Oil, Syzygium Aromaticum (Clove) Flower Oil",
            "benefits": ["Gently Cleanses Without Stripping Moisture", "Reduces Excess Oil & Prevents Clogged Pores", "Supports Smoother, Even Skin Texture", "Maintains Skin's Natural Barrier", "Suitable for All Skin Types"],
            "how_to_use": "Apply to damp skin and gently massage in circular motions. Rinse thoroughly with water. Use twice daily, morning and evening.",
            "size": "100ml / 3.38 fl oz",
            "images": [],
            "mrp": 799,
            "prepaid_price": 499,
            "cod_price": 599,
            "cod_advance": 29,
            "discount_percent": 38,
            "badge": "Daily Essential",
            "is_active": True,
            "sort_order": 5,
            "rating": 4.6,
            "reviews_count": 1128,
            "skin_type": "All Skin Types",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    
    await db.products.insert_many(products)
    logging.info(f"Seeded {len(products)} products")
    
    # Seed combos
    combos = [
        {
            "combo_id": "complete-anti-aging-kit",
            "name": "Complete Anti-Aging Kit",
            "description": "All 5 products for a complete anti-aging routine. Cleanse, treat, hydrate, protect.",
            "product_slugs": ["cleanser", "anti-aging-serum", "anti-aging-cream", "under-eye-cream", "sunscreen"],
            "mrp_total": 5695,
            "combo_prepaid_price": 2799,
            "combo_cod_price": 3099,
            "discount_percent": 51,
            "badge": "Best Value",
            "is_active": True,
            "sort_order": 1,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "combo_id": "day-night-duo",
            "name": "Day & Night Power Duo",
            "description": "Sunscreen for day protection + Retinoid Night Cream for overnight repair.",
            "product_slugs": ["sunscreen", "anti-aging-cream"],
            "mrp_total": 2298,
            "combo_prepaid_price": 1199,
            "combo_cod_price": 1399,
            "discount_percent": 48,
            "badge": "Popular",
            "is_active": True,
            "sort_order": 2,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "combo_id": "glow-essentials",
            "name": "Glow Essentials Trio",
            "description": "Cleanser + Serum + Sunscreen. The essential 3-step routine for radiant skin.",
            "product_slugs": ["cleanser", "anti-aging-serum", "sunscreen"],
            "mrp_total": 3297,
            "combo_prepaid_price": 1699,
            "combo_cod_price": 1899,
            "discount_percent": 48,
            "badge": "Starter Kit",
            "is_active": True,
            "sort_order": 3,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    
    await db.combos.insert_many(combos)
    logging.info(f"Seeded {len(combos)} combos")
    
    # Seed default site settings
    await db.site_settings.update_one(
        {"_id": "main"},
        {"$setOnInsert": {
            "hero_title": "India's #1 Complete Anti-Aging Solution",
            "hero_subtitle": "5 clinically-formulated products designed exclusively to fight aging. Cleanse, treat, hydrate, protect & brighten.",
            "presale_enabled": False,
            "presale_title": "",
            "presale_badge": "",
            "cod_advance_amount": 29,
            "before_after_images": [],
            "result_images": [],
            "created_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    logging.info("Site settings initialized")
    
    # Auto-generate monthly coupons
    await generate_monthly_coupons()


async def generate_monthly_coupons():
    """Auto-generate monthly coupons if not already generated"""
    now = datetime.now(timezone.utc)
    months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
    current_month = months[now.month - 1]
    next_month = months[now.month % 12]
    
    monthly_coupons = [
        {"code": f"{current_month}{now.year % 100}", "discount_type": "fixed", "discount_value": 25, "min_order_amount": 499, "max_uses": 5000,
         "show_on_cart": True, "description": f"Flat ₹25 OFF on orders above ₹499 (this month only)"},
        {"code": f"{current_month}GLOW", "discount_type": "fixed", "discount_value": 30, "min_order_amount": 799, "max_uses": 3000,
         "show_on_cart": True, "description": f"Flat ₹30 OFF on orders above ₹799"},
        {"code": f"{next_month}EARLY", "discount_type": "percentage", "discount_value": 10, "min_order_amount": 499, "max_uses": 2000,
         "show_on_cart": True, "description": "10% OFF early-bird offer"},
    ]
    
    for coupon in monthly_coupons:
        existing = await db.coupons.find_one({"code": coupon["code"]})
        if not existing:
            from datetime import timedelta
            coupon["used_count"] = 0
            coupon["is_active"] = True
            coupon["created_at"] = now.isoformat()
            coupon["expiry_date"] = (now + timedelta(days=45)).isoformat()
            coupon["auto_generated"] = True
            await db.coupons.insert_one(coupon)
            logging.info(f"Auto-generated monthly coupon: {coupon['code']}")
        else:
            # Backfill show_on_cart on legacy auto-gen coupons so they appear on the cart UI
            patch = {}
            if existing.get("show_on_cart") is None:
                patch["show_on_cart"] = True
            if not existing.get("description"):
                patch["description"] = coupon.get("description", "")
            if patch:
                await db.coupons.update_one({"code": coupon["code"]}, {"$set": patch})
    
    # Ensure WELCOME50 exists
    if not await db.coupons.find_one({"code": "WELCOME50"}):
        from datetime import timedelta
        await db.coupons.insert_one({
            "code": "WELCOME50", "discount_type": "fixed", "discount_value": 50,
            "min_order_amount": 499, "max_uses": 99999, "used_count": 0, "is_active": True,
            "show_on_cart": True, "description": "Flat ₹50 OFF on your first order (above ₹499)",
            "created_at": now.isoformat(), "expiry_date": (now + timedelta(days=365)).isoformat()
        })
        logging.info("Created WELCOME50 coupon")
    else:
        # Backfill show_on_cart for the existing WELCOME50 if missing
        existing = await db.coupons.find_one({"code": "WELCOME50"})
        if existing and existing.get("show_on_cart") is None:
            await db.coupons.update_one(
                {"code": "WELCOME50"},
                {"$set": {"show_on_cart": True, "description": "Flat ₹50 OFF on your first order (above ₹499)"}}
            )

"""
Routine reports + extended retention endpoints.

Routine reports:
- POST /api/routines/save               -> public; saves a generated routine (+optional photo) to db.routines
- GET  /api/admin/routines              -> admin; lists all saved routines newest-first
- GET  /api/admin/routines/{id}         -> admin; single routine detail

Retention extensions on top of /admin/retention/customers + /admin/retention/note:
- GET  /api/admin/retention/reorder     -> admin; customers 30+ days post-purchase that haven't reordered yet
                                            (pulled from db.orders, joined with retention_notes)
"""
from fastapi import APIRouter, Header, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import uuid

router = APIRouter()
db = None


def set_db(database):
    global db
    db = database


def _verify_admin_or_employee(x_admin_token: Optional[str], x_employee_token: Optional[str] = None, permission: Optional[str] = None):
    """Allow either admin token or an employee token with the right permission."""
    from routes import products
    products.verify_auth(x_admin_token=x_admin_token, x_employee_token=x_employee_token, permission=permission)


def _verify_admin(token: Optional[str]):
    from routes import products
    products.verify_auth(x_admin_token=token)


# ==================== ROUTINES ====================

class RoutineSlot(BaseModel):
    slot: dict           # {id, label, ...}
    product_slug: Optional[str] = None
    product_name: Optional[str] = None


class RoutineSave(BaseModel):
    skin_type: str
    age: str
    concerns: List[str] = []
    am: List[RoutineSlot] = []
    pm: List[RoutineSlot] = []
    photo_url: Optional[str] = None        # cloudinary URL preferred
    photo_data: Optional[str] = None       # base64 fallback (rarely used)
    phone: Optional[str] = None
    name: Optional[str] = None
    session_id: Optional[str] = None


@router.post("/routines/save")
async def save_routine(payload: RoutineSave):
    """Public — save a generated routine. Used by /routine page so admin gets visibility."""
    doc = payload.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.routines.insert_one(doc)
    return {"success": True, "id": doc["id"]}


@router.get("/admin/routines")
async def list_routines(x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"), limit: int = 200):
    _verify_admin(x_admin_token)
    items = await db.routines.find({}, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return {"routines": items, "count": len(items)}


@router.get("/admin/routines/{rid}")
async def get_routine(rid: str, x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token")):
    _verify_admin(x_admin_token)
    doc = await db.routines.find_one({"id": rid}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Routine not found")
    return doc


# ==================== RETENTION REORDER TAB ====================

@router.get("/admin/retention/reorder")
async def get_reorder_candidates(
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
    x_employee_token: Optional[str] = Header(None, alias="X-Employee-Token"),
):
    """30-day reorder tab: customers whose last order is between 28-90 days old AND
    haven't already been marked reorder/not_interested in the last 30 days.
    The retention agent calls them, then updates status via /admin/retention/note.
    Customers marked 'reorder' / 'not_interested' will reappear after 30 more days
    so the cycle continues.
    """
    _verify_admin_or_employee(x_admin_token, x_employee_token, permission="retention")
    now = datetime.now(timezone.utc)
    window_start = (now - timedelta(days=90)).isoformat()
    window_end = (now - timedelta(days=28)).isoformat()
    cutoff = (now - timedelta(days=30)).isoformat()

    orders = await db.orders.find({
        "status": {"$in": ["confirmed", "delivered"]},
        "created_at": {"$gte": window_start, "$lte": window_end},
    }, {"_id": 0}).sort("created_at", -1).to_list(1000)

    # group by phone, keep most recent order
    seen = {}
    for o in orders:
        ph = o.get("phone")
        if not ph:
            continue
        if ph not in seen or o.get("created_at", "") > seen[ph].get("created_at", ""):
            seen[ph] = o

    out = []
    for ph, order in seen.items():
        note = await db.retention_notes.find_one({"order_id": order.get("order_id")}, {"_id": 0})
        # Skip rows whose note is fresh (within 30 days) — they're already cycled
        if note and note.get("created_at", "") > cutoff:
            order["retention_note"] = note
            continue
        order["retention_note"] = note
        out.append(order)

    return {"customers": out, "count": len(out)}

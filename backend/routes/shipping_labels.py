"""India Post A6 shipping-label endpoints.

  • GET  /api/orders/{order_id}/label.pdf   → single A6 label
  • POST /api/orders/labels/bulk            → A4 4-up sheet (multipart-friendly)
"""
from __future__ import annotations
import os
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Header, Query, Body
from fastapi.responses import Response
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel

from services.shipping_label import build_single_label_pdf, build_bulk_labels_pdf


router = APIRouter()

# Lazy client — server.py imports this module at startup, so we must not crash
# if env vars are momentarily missing.
_client: Optional[AsyncIOMotorClient] = None
_db = None


def _get_db():
    global _client, _db
    if _db is None:
        _client = AsyncIOMotorClient(os.environ["MONGO_URL"])
        _db = _client[os.environ["DB_NAME"]]
    return _db


def _verify_admin(x_admin_token: Optional[str], token: Optional[str]):
    """Accept either header OR ?token=… query (so the PDF opens in a new tab)."""
    expected = os.environ.get("ADMIN_TOKEN", "celestaglow2024")
    supplied = x_admin_token or token
    if not supplied or supplied != expected:
        raise HTTPException(status_code=401, detail="Admin auth required")


@router.get("/orders/{order_id}/label.pdf")
async def get_single_label(
    order_id: str,
    token: Optional[str] = Query(None, description="Admin token (so the PDF can open in a new tab without setting headers)"),
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
):
    _verify_admin(x_admin_token, token)
    db = _get_db()
    # Exclude soft-deleted orders so we never print labels for archived rows
    order = await db.orders.find_one(
        {"order_id": order_id, "deleted": {"$ne": True}},
        {"_id": 0},
    )
    if not order:
        # Try by internal id too, in case the caller passed the mongo id
        order = await db.orders.find_one({"id": order_id, "deleted": {"$ne": True}}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    pdf = build_single_label_pdf(order)
    safe_id = "".join(ch if ch.isalnum() else "_" for ch in str(order.get("order_id") or order_id))
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="celesta-label-{safe_id}.pdf"'},
    )


class BulkLabelsRequest(BaseModel):
    order_ids: List[str]


@router.post("/orders/labels/bulk")
async def post_bulk_labels(
    payload: BulkLabelsRequest = Body(...),
    token: Optional[str] = Query(None),
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
):
    """Generate an A4 PDF with up to 200 labels (50 pages × 4-up). Soft-deleted
    orders are silently filtered out."""
    _verify_admin(x_admin_token, token)
    ids = [s for s in (payload.order_ids or []) if isinstance(s, str) and s][:200]
    if not ids:
        raise HTTPException(status_code=400, detail="`order_ids` cannot be empty")

    db = _get_db()
    cur = db.orders.find(
        {"order_id": {"$in": ids}, "deleted": {"$ne": True}},
        {"_id": 0},
    )
    found = await cur.to_list(length=200)

    # Preserve the caller's id order so the printed PDF matches their pick order
    by_id = {o.get("order_id"): o for o in found if o.get("order_id")}
    ordered = [by_id[i] for i in ids if i in by_id]

    if not ordered:
        raise HTTPException(status_code=404, detail="None of the requested orders were found")

    pdf = build_bulk_labels_pdf(ordered)
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="celesta-labels-{len(ordered)}.pdf"'},
    )

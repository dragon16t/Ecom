"""
Catalog Backup & Restore — pragmatic fix for "data wipes on every redeploy"
without requiring an external MongoDB.

The pod-internal MongoDB at `localhost:27017` lives on ephemeral storage. Every
production redeploy creates a fresh pod with an empty database, which is why
admin-uploaded subcategory images, taxonomy edits, and category structure
appear to "vanish".

This module:
  1. Periodically (and on every admin write) snapshots the taxonomy
     collections to a single JSON file uploaded to Cloudinary as a `raw`
     asset at  celesta-glow/db-snapshots/latest.json.
  2. On backend startup, if any of these collections is empty, automatically
     downloads the latest snapshot and bulk-restores it.

Limitations (be honest):
  - Snapshots only `concerns`, `categories`, `subcategories`, `niches`.
    NOT products, orders, customers, coupons — those need a real persistent
    DB. We restore the structure customers see (taxonomy + images) but not the
    transactional data (which is also far more volatile).
  - Snapshot is asynchronous; a write that happens AFTER the last snapshot
    won't survive a same-second redeploy. ~30s lag worst case.
  - This is a stop-gap. Atlas remains the correct long-term solution.
"""
from __future__ import annotations

import asyncio
import gzip
import io
import json
import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import cloudinary
import cloudinary.uploader

import requests

from . import cloudinary_service as _cs

logger = logging.getLogger(__name__)

# Collections we treat as the canonical snapshot. Everything an admin can
# create / edit through the dashboard belongs here. Skipped collections are
# explained below.
SNAPSHOT_COLLECTIONS = [
    # --- Taxonomy ---
    "concerns", "categories", "subcategories", "niches",
    # --- Catalog & merchandising ---
    "products", "combos", "shades",
    # --- Promotions & site content ---
    "coupons", "gift_cards", "banners", "sale_badges",
    "site_settings", "site_pages", "blogs", "blog_posts",
    # --- Brand / store config ---
    "brands", "store_locations", "site_announcements",
    # --- Orders & customer data are NOT snapshotted here on purpose:
    #     they are write-heavy and would inflate the snapshot to many MB.
    #     For a real production deployment with order volume you still need
    #     a proper persistent MongoDB (Atlas / managed) — this stop-gap is
    #     designed for the launch phase where catalog & admin content is
    #     the primary data being curated.
]

# Collections that are intentionally excluded from the snapshot (transactional
# / session / ephemeral). Documented here so future authors don't add them.
NON_SNAPSHOT_COLLECTIONS = {
    "orders", "users", "customers",
    "admin_sessions", "employee_sessions",
    "reviews", "review_reports",
    "visitor_pings", "live_visitors",
    "taxonomy_jobs", "background_jobs",
    "rate_limits", "scraper_logs", "audit_logs",
    "cart_events", "cart_abandonment",
    "api_credentials",  # contains secrets — never back up to Cloudinary
    "admin_settings",   # Cloudinary credentials live here; never back up
}

CLOUDINARY_PUBLIC_ID = "celesta-glow/db-snapshots/latest"

# Debounce / throttle — at most one snapshot per N seconds even on bursty admin
# writes. The actual snapshot runs in a background task, never blocking the
# user's request.
_throttle_seconds = 25
_last_snapshot_at: Optional[float] = None
_pending_snapshot_task: Optional[asyncio.Task] = None


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _serialize(db) -> Dict[str, Any]:
    """Dump every doc in each snapshot collection into a plain JSON dict.

    Skips collections that exist on the snapshot list but have 0 docs locally
    (saves bytes + lets us add new collections to the list safely without
    bloating the snapshot for stores that don't use them yet)."""
    payload: Dict[str, Any] = {
        "schema_version": 2,
        "created_at": _now_iso(),
        "collections": {},
    }
    existing = await db.list_collection_names()
    existing_set = set(existing)
    for col in SNAPSHOT_COLLECTIONS:
        if col not in existing_set:
            continue
        docs: List[Dict] = []
        async for d in db[col].find({}, {"_id": 0}):
            docs.append(d)
        if not docs:
            continue
        payload["collections"][col] = docs
        payload["collections"][col + "__count"] = len(docs)
    return payload


async def snapshot(db) -> Dict[str, Any]:
    """Compress + upload the current state to Cloudinary as a raw .json.gz."""
    global _last_snapshot_at
    if not await _cs.ensure_configured(db):
        raise RuntimeError("Cloudinary not configured — cannot snapshot")
    payload = await _serialize(db)
    raw_json = json.dumps(payload, separators=(",", ":"), default=str).encode("utf-8")
    # gzip compresses the typical 5-15MB catalog snapshot down to 800KB-2MB
    blob = gzip.compress(raw_json, compresslevel=6)
    res = cloudinary.uploader.upload(
        io.BytesIO(blob),
        public_id=CLOUDINARY_PUBLIC_ID,
        resource_type="raw",
        overwrite=True,
        unique_filename=False,
    )
    _last_snapshot_at = asyncio.get_event_loop().time()
    counts = {c: payload["collections"].get(c + "__count", 0) for c in SNAPSHOT_COLLECTIONS}
    logger.info(
        "Snapshot uploaded: raw=%dKB gz=%dKB collections=%s",
        len(raw_json) // 1024, len(blob) // 1024, counts,
    )
    return {
        "success": True,
        "url": res.get("secure_url") or res.get("url"),
        "counts": counts,
        "snapshot_bytes_raw": len(raw_json),
        "snapshot_bytes_compressed": len(blob),
        "created_at": payload["created_at"],
    }


async def _debounced_snapshot(db):
    """Wait briefly to coalesce a burst of admin writes, then snapshot."""
    global _pending_snapshot_task
    try:
        await asyncio.sleep(_throttle_seconds)
        await snapshot(db)
    except Exception as exc:
        logger.warning("Background snapshot failed: %s", exc)
    finally:
        _pending_snapshot_task = None


def schedule_snapshot(db) -> None:
    """Fire-and-forget snapshot. Safe to call from any admin write handler;
    coalesces bursts so 50 writes in 5 seconds only produce 1 backup."""
    global _pending_snapshot_task
    if _pending_snapshot_task and not _pending_snapshot_task.done():
        return  # already queued
    try:
        loop = asyncio.get_event_loop()
        _pending_snapshot_task = loop.create_task(_debounced_snapshot(db))
    except RuntimeError:
        # No running loop (e.g. called from a sync seed script) — skip
        logger.debug("No running event loop; skipping snapshot schedule")


async def _fetch_latest_snapshot(db) -> Optional[Dict[str, Any]]:
    """Pull the latest snapshot down from Cloudinary. Supports both gzipped
    (current) and plain JSON (legacy v1) snapshots transparently."""
    if not await _cs.ensure_configured(db):
        return None
    creds = _cs._creds_cache  # type: ignore[attr-defined]
    cloud_name = creds.get("cloud_name") or os.environ.get("CLOUDINARY_CLOUD_NAME")
    if not cloud_name:
        return None
    candidates = [
        f"https://res.cloudinary.com/{cloud_name}/raw/upload/{CLOUDINARY_PUBLIC_ID}",
        f"https://res.cloudinary.com/{cloud_name}/raw/upload/{CLOUDINARY_PUBLIC_ID}.json",
    ]
    for candidate in candidates:
        try:
            r = requests.get(candidate, timeout=15)
            if r.status_code != 200:
                continue
            body = r.content
            # Try gzip first (current format)
            try:
                decompressed = gzip.decompress(body)
                return json.loads(decompressed.decode("utf-8"))
            except (OSError, json.JSONDecodeError):
                # Fall back to plain JSON (legacy v1 snapshots)
                txt = body.decode("utf-8", errors="ignore")
                if txt.startswith("{"):
                    return json.loads(txt)
        except Exception as exc:
            logger.debug("Snapshot fetch failed for %s: %s", candidate, exc)
    return None


async def auto_restore_if_empty(db) -> Dict[str, Any]:
    """Run at backend startup. If the snapshot collections look freshly-wiped
    (≥80% of them have ≤5 docs OR the products collection itself is empty),
    pull the latest Cloudinary snapshot and bulk-upsert. Idempotent — never
    overwrites a doc that already exists with the same slug/id.
    """
    counts: Dict[str, int] = {}
    near_empty = 0
    existing = set(await db.list_collection_names())
    for col in SNAPSHOT_COLLECTIONS:
        if col not in existing:
            counts[col] = 0
            near_empty += 1
            continue
        n = await db[col].count_documents({})
        counts[col] = n
        if n < 5:
            near_empty += 1
    # Decide restore: signal of a fresh pod is that products is empty OR
    # most collections are near-empty.
    products_empty = counts.get("products", 0) < 5
    threshold = 0.5  # >=50% of snapshot collections look empty
    needs_restore = products_empty or (near_empty / max(1, len(SNAPSHOT_COLLECTIONS))) >= threshold
    if not needs_restore:
        logger.info("Snapshot collections look populated %s — skipping auto-restore", counts)
        return {"restored": False, "reason": "already populated", "counts": counts}

    snapshot_data = await _fetch_latest_snapshot(db)
    if not snapshot_data:
        logger.info("No remote snapshot available — first deploy. Local counts: %s", counts)
        return {"restored": False, "reason": "no snapshot found", "counts": counts}

    restored_counts: Dict[str, int] = {}
    for col in SNAPSHOT_COLLECTIONS:
        docs = (snapshot_data.get("collections") or {}).get(col) or []
        if not docs:
            restored_counts[col] = 0
            continue
        try:
            inserted = 0
            for d in docs:
                # Pick the natural primary key per collection
                pk = None
                for k in ("slug", "code", "id", "order_id", "combo_id", "_id"):
                    if d.get(k):
                        pk = {k: d[k]}
                        break
                if pk is None:
                    # No identifier — just insert blindly
                    await db[col].insert_one(d)
                    inserted += 1
                else:
                    res = await db[col].update_one(pk, {"$setOnInsert": d}, upsert=True)
                    if res.upserted_id is not None:
                        inserted += 1
            restored_counts[col] = inserted
        except Exception as exc:
            logger.error("Auto-restore failed for %s: %s", col, exc)
            restored_counts[col] = -1
    logger.info(
        "Snapshot auto-restored: %s (snapshot created %s)",
        restored_counts, snapshot_data.get("created_at"),
    )
    return {
        "restored": True,
        "counts": restored_counts,
        "snapshot_created_at": snapshot_data.get("created_at"),
    }


async def status(db) -> Dict[str, Any]:
    """Inspect the snapshot health for the admin UI."""
    counts = {col: await db[col].count_documents({}) for col in SNAPSHOT_COLLECTIONS}
    remote = await _fetch_latest_snapshot(db)
    return {
        "cloudinary_configured": await _cs.ensure_configured(db),
        "local_counts": counts,
        "remote_snapshot_available": bool(remote),
        "remote_snapshot_created_at": (remote or {}).get("created_at"),
        "remote_counts": (remote or {}).get("collections") and {c: (remote["collections"].get(c + "__count") or 0) for c in SNAPSHOT_COLLECTIONS},
    }

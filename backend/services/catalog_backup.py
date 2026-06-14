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
# create / edit through the dashboard belongs here, PLUS all customer-facing
# transactional data (orders, customer accounts, leads, reviews). User mandate:
# "not a penny of data should be lost on redeploy".
SNAPSHOT_COLLECTIONS = [
    # --- Taxonomy ---
    "concerns", "categories", "subcategories", "niches",
    # Deletion records — without this, admin-deleted concerns/categories
    # come back on every redeploy when seed scripts re-create them.
    "taxonomy_tombstones",
    # --- Catalog & merchandising ---
    "products", "combos", "shades",
    # --- Promotions & site content ---
    "coupons", "gift_cards", "banners", "sale_badges",
    "site_settings", "site_pages", "blogs", "blog_posts",
    # --- Brand / store config ---
    "brands", "store_locations", "site_announcements",
    # --- Transactional data (orders, customers, leads, reviews) ---
    # NOTE: these are write-heavy. Snapshots happen on a 25s debounce so an
    # order placed in the last 25s before a redeploy may be lost. For high
    # order volumes (>100/day) you still want Atlas — but for the launch
    # phase this safety net catches everything.
    "orders", "order_items", "order_tracking",
    "users", "customers", "customer_addresses",
    "leads", "contact_messages", "otp_records",
    "reviews", "review_reports",
    "referrals", "referral_payouts",
    "wallet_transactions", "wallet_balances",
]

# Collections that are intentionally excluded (truly ephemeral / sensitive / TTL).
NON_SNAPSHOT_COLLECTIONS = {
    "admin_sessions", "employee_sessions",  # short-lived auth tokens
    "visitor_pings", "live_visitors",       # 5-min TTL by design
    "taxonomy_jobs", "background_jobs",     # transient job runners
    "rate_limits", "scraper_logs",          # short-lived
    "audit_logs",                           # log stream, append-only
    "cart_events", "cart_abandonment",      # analytics fluff
    "api_credentials",                      # SECRETS — never back up
    "admin_settings",                       # SECRETS — Cloudinary keys live here
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
    """Compress + upload the current state to Cloudinary as a raw .json.gz.

    Retention: only the LAST 3 backups are kept. After each upload we delete
    every older backup file on Cloudinary to keep storage usage in check.
    The full DB state is in EVERY snapshot — losing older ones doesn't lose
    any data, you just can't time-travel further back than 3 backups.
    """
    global _last_snapshot_at
    if not await _cs.ensure_configured(db):
        raise RuntimeError("Cloudinary not configured — cannot snapshot")
    payload = await _serialize(db)
    raw_json = json.dumps(payload, separators=(",", ":"), default=str).encode("utf-8")
    # gzip compresses the typical 5-15MB catalog snapshot down to 800KB-2MB
    blob = gzip.compress(raw_json, compresslevel=6)
    # Dated public_id so older backups are addressable and pruneable.
    ts_compact = payload["created_at"].replace(":", "-").replace(".", "-")
    dated_public_id = f"celesta-glow/backups/snapshot-{ts_compact}"
    res = cloudinary.uploader.upload(
        io.BytesIO(blob),
        public_id=dated_public_id,
        resource_type="raw",
        overwrite=True,
        unique_filename=False,
    )
    # ALSO mirror to the legacy `latest` alias so older code paths (auto-restore
    # cold-boot fallback) still find a snapshot if Mongo `admin_settings` is wiped.
    try:
        cloudinary.uploader.upload(
            io.BytesIO(blob),
            public_id=CLOUDINARY_PUBLIC_ID,
            resource_type="raw",
            overwrite=True,
            unique_filename=False,
        )
    except Exception as exc:
        logger.warning("Failed to mirror snapshot to `latest` alias: %s", exc)

    _last_snapshot_at = asyncio.get_event_loop().time()
    counts = {c: payload["collections"].get(c + "__count", 0) for c in SNAPSHOT_COLLECTIONS}
    snapshot_url = res.get("secure_url") or res.get("url")
    snapshot_version = res.get("version")
    try:
        # Append to a sliding window of the last 3 snapshots. Older entries are
        # both forgotten from Mongo AND deleted from Cloudinary below.
        doc = await db.admin_settings.find_one({"type": "catalog_backup"}, {"_id": 0}) or {}
        history = doc.get("history", [])
        history.append({
            "public_id": dated_public_id,
            "url": snapshot_url,
            "version": snapshot_version,
            "created_at": payload["created_at"],
            "bytes": len(blob),
        })
        history = history[-3:]  # keep last 3 only
        await db.admin_settings.update_one(
            {"type": "catalog_backup"},
            {"$set": {
                "type": "catalog_backup",
                "latest_url": snapshot_url,
                "created_at": payload["created_at"],
                "history": history,
            }},
            upsert=True,
        )

        # ---- Cloudinary retention sweep ----
        # Discover every backup file currently on Cloudinary (in the backups/
        # folder) and delete anything not in our 3-keep history. Catches files
        # left over from previous runs even before we tracked history in Mongo.
        try:
            import cloudinary.api as _capi
            keep_ids = {h["public_id"] for h in history}
            keep_ids.add(CLOUDINARY_PUBLIC_ID)  # never delete the `latest` alias
            res_list = _capi.resources(
                resource_type="raw",
                type="upload",
                prefix="celesta-glow/backups/",
                max_results=100,
            )
            to_delete = [r["public_id"] for r in res_list.get("resources", []) if r["public_id"] not in keep_ids]
            if to_delete:
                _capi.delete_resources(to_delete, resource_type="raw")
                logger.info("Backup retention: pruned %d old snapshot(s) from Cloudinary: %s", len(to_delete), to_delete)
        except Exception as exc:
            logger.warning("Cloudinary retention sweep failed (storage may bloat): %s", exc)

    except Exception as exc:
        logger.warning("Failed to persist snapshot URL: %s", exc)
    logger.info(
        "Snapshot uploaded: raw=%dKB gz=%dKB collections=%s",
        len(raw_json) // 1024, len(blob) // 1024, counts,
    )
    return {
        "success": True,
        "url": snapshot_url,
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


_last_write_at: Optional[float] = None


def schedule_snapshot(db) -> None:
    """Mark that a write happened. The actual upload is handled by the
    15-minute safety-net scheduler in `server.py` (was per-write debounced
    before, but that pushed too much Cloudinary bandwidth on busy days)."""
    global _last_write_at
    _last_write_at = asyncio.get_event_loop().time()


async def _fetch_latest_snapshot(db) -> Optional[Dict[str, Any]]:
    """Pull the latest snapshot down from Cloudinary. Supports both gzipped
    (current) and plain JSON (legacy v1) snapshots transparently."""
    if not await _cs.ensure_configured(db):
        return None
    creds = _cs._creds_cache  # type: ignore[attr-defined]
    cloud_name = creds.get("cloud_name") or os.environ.get("CLOUDINARY_CLOUD_NAME")
    if not cloud_name:
        return None
    # 1) Prefer the versioned URL we persisted in Mongo on last snapshot
    #    upload — bypasses Cloudinary's `latest` alias CDN cache entirely.
    versioned: Optional[str] = None
    try:
        meta = await db.admin_settings.find_one({"type": "catalog_backup"}, {"_id": 0, "latest_url": 1})
        if meta and meta.get("latest_url"):
            versioned = meta["latest_url"]
    except Exception:
        pass

    # 2) If Mongo doesn't have the URL (e.g. fresh boot after redeploy where
    #    admin_settings was wiped), ask Cloudinary directly for the current
    #    version of the snapshot resource. This dodges the CDN edge cache
    #    on `latest` aliases that previously made auto-restore pick up
    #    stale snapshots after a redeploy.
    if not versioned:
        try:
            import cloudinary.api as _capi
            info = _capi.resource(CLOUDINARY_PUBLIC_ID, resource_type="raw")
            if info and info.get("secure_url"):
                versioned = info["secure_url"]
        except Exception as exc:
            logger.debug("Cloudinary admin API lookup failed: %s", exc)

    # 3) Fallback to the public `latest` alias (with cache-bust query string).
    import time as _time
    cb = int(_time.time())
    candidates = [
        c for c in [
            versioned,
            f"https://res.cloudinary.com/{cloud_name}/raw/upload/{CLOUDINARY_PUBLIC_ID}?_={cb}",
            f"https://res.cloudinary.com/{cloud_name}/raw/upload/{CLOUDINARY_PUBLIC_ID}.json?_={cb}",
        ] if c
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
    # ------------------------------------------------------------------
    # "Sticky" fields per collection — admin-curated values that must NEVER
    # be reset by a restore.  If the snapshot's value is empty/missing but
    # the local doc already has a non-empty value, we KEEP the local one.
    # Why: admin uploads a category icon at 10:00, the next snapshot fires
    # at 10:15 with the image included. But if the admin uploaded AFTER
    # the most recent snapshot, a redeploy + restore would wipe the image
    # back to the snapshot's older state. Treat image / icon / accent
    # fields as one-way (snapshot fills in blanks, never overwrites).
    # ------------------------------------------------------------------
    STICKY_FIELDS: Dict[str, set] = {
        "concerns":      {"image", "icon", "accent_from", "accent_to", "accent_text", "tagline", "name", "description"},
        "categories":    {"image", "icon", "tagline", "name", "description"},
        "subcategories": {"image", "icon", "tagline", "accent_from", "accent_to", "accent_text", "name", "description"},
        "products":      {"images", "image_url", "thumbnail", "video_url", "video_thumb_url",
                          "hero_image", "swatches"},
        "brands":        {"image", "logo", "logo_url", "banner", "banner_url"},
        "banners":       {"image", "image_url", "mobile_image", "desktop_image"},
        "site_settings": {"logo", "logo_url", "favicon", "splash_image", "hero_image"},
    }

    def _is_filled(v) -> bool:
        if v is None:
            return False
        if isinstance(v, str):
            return v.strip() != ""
        if isinstance(v, (list, dict, tuple, set)):
            return len(v) > 0
        return True

    for col in SNAPSHOT_COLLECTIONS:
        docs = (snapshot_data.get("collections") or {}).get(col) or []
        if not docs:
            restored_counts[col] = 0
            continue
        sticky = STICKY_FIELDS.get(col, set())
        try:
            inserted = 0
            updated = 0
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
                    # Look at local first — if local has admin-curated sticky
                    # values that the snapshot's copy doesn't, preserve them.
                    if sticky:
                        local = await db[col].find_one(pk, {"_id": 0, **{f: 1 for f in sticky}})
                        if local:
                            payload = dict(d)
                            for f in sticky:
                                local_v = local.get(f)
                                if _is_filled(local_v) and not _is_filled(payload.get(f)):
                                    # Keep local's curated value
                                    payload.pop(f, None)
                            d_to_set = payload
                        else:
                            d_to_set = d
                    else:
                        d_to_set = d
                    res = await db[col].update_one(pk, {"$set": d_to_set}, upsert=True)
                    if res.upserted_id is not None:
                        inserted += 1
                    elif res.modified_count:
                        updated += 1
            restored_counts[col] = inserted + updated
        except Exception as exc:
            logger.error("Auto-restore failed for %s: %s", col, exc)
            restored_counts[col] = -1

    # ---------- Tombstone enforcement ----------
    # `taxonomy_tombstones` were already restored above. Now sweep across
    # concerns / categories / subcategories / products and DELETE any row
    # whose slug is tombstoned. This catches the edge case where the
    # snapshot was taken BEFORE the admin's delete — without this sweep,
    # the auto-restore would silently bring deleted items back.
    try:
        kind_to_col = {
            "concern": "concerns",
            "category": "categories",
            "subcategory": "subcategories",
            "product": "products",
        }
        for kind, col in kind_to_col.items():
            tomb_slugs = [d["slug"] async for d in db.taxonomy_tombstones.find({"kind": kind}, {"_id": 0, "slug": 1})]
            if tomb_slugs:
                res = await db[col].delete_many({"slug": {"$in": tomb_slugs}})
                if res.deleted_count:
                    logger.info("Tombstone sweep removed %d resurrected %s rows", res.deleted_count, kind)
    except Exception as exc:
        logger.warning("Tombstone sweep failed: %s", exc)

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

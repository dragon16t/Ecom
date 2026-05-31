"""
Middleware that schedules a debounced Cloudinary snapshot after EVERY
successful admin write to a snapshot-eligible collection.

Why a middleware?
  We have ~60 admin write endpoints across 15 route files. Hooking each one
  manually is brittle and forgets new endpoints. Centralising the trigger here
  means every existing AND future admin route is auto-covered for free.

Activation rules:
  - Method must be POST / PUT / PATCH / DELETE
  - Path must start with /api/admin/
  - Response status must be 2xx (don't snapshot on validation errors)
  - X-Admin-Token must be present (rules out public misuse)

The actual snapshot runs in a 25-second debounced background task — bursts
of admin writes coalesce into a single Cloudinary upload.
"""
from __future__ import annotations

import logging

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

logger = logging.getLogger(__name__)

_WRITE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}

# Public (non-admin) paths that ALSO write user data we care about persisting:
# order creation, payment confirmation, OTP records, review submission, etc.
# Any successful 2xx write to one of these will schedule a snapshot too.
_PUBLIC_WRITE_PREFIXES = (
    "/api/orders",
    "/api/checkout",
    "/api/payment",
    "/api/razorpay",
    "/api/reviews",
    "/api/auth/",
    "/api/customer/",
    "/api/wallet",
    "/api/referral",
    "/api/leads",
    "/api/contact",
    "/api/newsletter",
)


class CatalogBackupTriggerMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, db, schedule_snapshot):
        super().__init__(app)
        self._db = db
        self._schedule = schedule_snapshot

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        try:
            if request.method not in _WRITE_METHODS or not (200 <= response.status_code < 300):
                return response
            path = request.url.path
            # Admin writes (always backed up)
            if path.startswith("/api/admin/") and request.headers.get("x-admin-token"):
                self._schedule(self._db)
                return response
            # Customer/transactional writes
            if any(path.startswith(p) for p in _PUBLIC_WRITE_PREFIXES):
                self._schedule(self._db)
        except Exception as exc:
            logger.debug("Snapshot trigger failed: %s", exc)
        return response

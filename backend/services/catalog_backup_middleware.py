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


class CatalogBackupTriggerMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, db, schedule_snapshot):
        super().__init__(app)
        self._db = db
        self._schedule = schedule_snapshot

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        try:
            if (
                request.method in _WRITE_METHODS
                and request.url.path.startswith("/api/admin/")
                and 200 <= response.status_code < 300
                and request.headers.get("x-admin-token")
            ):
                # Fire-and-forget; the snapshot service is already debounced
                self._schedule(self._db)
        except Exception as exc:
            logger.debug("Snapshot trigger failed: %s", exc)
        return response

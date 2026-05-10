"""
Hybrid session store — in-memory cache + MongoDB persistence.

Drop-in replacement for `admin_sessions = {}` / `employee_sessions = {}` plain
dicts. Behaves exactly like a dict to existing call sites (`token in store`,
`store[token]`, `store[token] = data`, `del store[token]`, `.get()`, `.pop()`)
but every write is also persisted to MongoDB so:

  • Sessions survive pod restarts / re-deploys (no more "you got logged out").
  • Sessions are shared across multiple uvicorn workers / k8s pods.
  • A TTL index on `expires_at` auto-purges stale rows.

Reads are O(1) in-memory; on a miss we fall back to MongoDB so a session
created by another pod is still recognized.
"""
from datetime import datetime, timezone
from typing import Any, Dict, Optional
import logging

from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)


class SessionStore:
    """Dict-like, MongoDB-backed session store with an in-memory cache."""

    def __init__(self, db: AsyncIOMotorDatabase, collection_name: str):
        self._db = db
        self._collection = db[collection_name]
        self._cache: Dict[str, Dict[str, Any]] = {}
        self._collection_name = collection_name

    # ---------- dict protocol (sync, cache-only) ----------
    def __contains__(self, token: str) -> bool:
        return token in self._cache

    def __getitem__(self, token: str) -> Dict[str, Any]:
        return self._cache[token]

    def __setitem__(self, token: str, value: Dict[str, Any]) -> None:
        self._cache[token] = value
        # Fire-and-forget background persistence
        try:
            import asyncio
            loop = asyncio.get_event_loop()
            if loop.is_running():
                loop.create_task(self._persist(token, value))
        except Exception:
            pass

    def __delitem__(self, token: str) -> None:
        self._cache.pop(token, None)
        try:
            import asyncio
            loop = asyncio.get_event_loop()
            if loop.is_running():
                loop.create_task(self._delete(token))
        except Exception:
            pass

    def get(self, token: str, default: Any = None) -> Any:
        return self._cache.get(token, default)

    def pop(self, token: str, default: Any = None) -> Any:
        val = self._cache.pop(token, default)
        try:
            import asyncio
            loop = asyncio.get_event_loop()
            if loop.is_running():
                loop.create_task(self._delete(token))
        except Exception:
            pass
        return val

    def keys(self):
        return self._cache.keys()

    def items(self):
        return self._cache.items()

    def __len__(self):
        return len(self._cache)

    async def clear_all(self) -> int:
        """Delete every session from cache + DB. Returns count cleared.
        Used after admin password change to force re-authentication."""
        n = len(self._cache)
        self._cache.clear()
        try:
            await self._collection.delete_many({})
        except Exception as e:
            logger.warning(f"[{self._collection_name}] clear_all failed: {e}")
        return n

    # ---------- async helpers ----------
    async def _persist(self, token: str, value: Dict[str, Any]) -> None:
        try:
            doc = {"token": token, **value, "_updated_at": datetime.now(timezone.utc)}
            # Make sure expires_at is a real datetime for the TTL index
            exp = doc.get("expires_at")
            if isinstance(exp, str):
                try:
                    doc["expires_at"] = datetime.fromisoformat(exp.replace("Z", "+00:00"))
                except Exception:
                    pass
            await self._collection.update_one({"token": token}, {"$set": doc}, upsert=True)
        except Exception as e:
            logger.warning(f"[{self._collection_name}] persist failed for token: {e}")

    async def _delete(self, token: str) -> None:
        try:
            await self._collection.delete_one({"token": token})
        except Exception as e:
            logger.warning(f"[{self._collection_name}] delete failed for token: {e}")

    async def hydrate(self) -> int:
        """Load all non-expired sessions from MongoDB into the in-memory cache.
        Call this once at app startup. Returns the number of loaded sessions.
        """
        loaded = 0
        try:
            now = datetime.now(timezone.utc)
            cursor = self._collection.find({}, {"_id": 0})
            async for doc in cursor:
                token = doc.pop("token", None)
                if not token:
                    continue
                # Drop legacy/expired rows. Normalize naive datetimes to UTC.
                exp = doc.get("expires_at")
                if isinstance(exp, str):
                    try:
                        exp = datetime.fromisoformat(exp.replace("Z", "+00:00"))
                    except Exception:
                        exp = None
                if isinstance(exp, datetime) and exp.tzinfo is None:
                    exp = exp.replace(tzinfo=timezone.utc)
                if exp and exp < now:
                    await self._collection.delete_one({"token": token})
                    continue
                doc.pop("_updated_at", None)
                self._cache[token] = doc
                loaded += 1
            logger.info(f"[{self._collection_name}] hydrated {loaded} active sessions from Mongo")
        except Exception as e:
            logger.warning(f"[{self._collection_name}] hydrate failed: {e}")
        return loaded

    async def ensure_indexes(self) -> None:
        """Create unique index on token + TTL index on expires_at."""
        try:
            await self._collection.create_index("token", unique=True)
            await self._collection.create_index("expires_at", expireAfterSeconds=0)
        except Exception as e:
            logger.warning(f"[{self._collection_name}] index setup failed: {e}")

    async def lookup(self, token: str) -> Optional[Dict[str, Any]]:
        """Async fallback for cache misses — checks MongoDB. Use sparingly."""
        if token in self._cache:
            return self._cache[token]
        try:
            doc = await self._collection.find_one({"token": token}, {"_id": 0})
            if not doc:
                return None
            doc.pop("token", None)
            doc.pop("_updated_at", None)
            self._cache[token] = doc
            return doc
        except Exception:
            return None

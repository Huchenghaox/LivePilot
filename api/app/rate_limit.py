from __future__ import annotations

import time
from collections import defaultdict, deque

from fastapi import HTTPException


class InMemoryRateLimiter:
    """Single-process rate limiter.

    This protects local and small single-instance deployments. Production
    multi-instance deployments should replace this with Redis-backed storage.
    """

    def __init__(self) -> None:
        self._events: dict[str, deque[float]] = defaultdict(deque)

    def check(self, key: str, limit: int, window_seconds: int, message: str) -> None:
        now = time.time()
        events = self._events[key]
        while events and events[0] <= now - window_seconds:
            events.popleft()
        if len(events) >= limit:
            retry_after = int(max(1, window_seconds - (now - events[0])))
            raise HTTPException(status_code=429, detail=message, headers={"Retry-After": str(retry_after)})
        events.append(now)


rate_limiter = InMemoryRateLimiter()

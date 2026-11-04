"""Concurrency Control, Overload Queue, and Backpressure Management."""

import asyncio
from typing import Optional
from fastapi import HTTPException, status
from agent.config import get_settings
from agent.logger import setup_logger

logger = setup_logger("concurrency")


class ConcurrencyOverloadException(HTTPException):
    def __init__(
        self,
        detail: str = "System overloaded. Concurrency limit reached (max 3 simultaneous calls).",
        status_code: int = status.HTTP_429_TOO_MANY_REQUESTS,
    ):
        super().__init__(
            status_code=status_code,
            detail=detail,
        )


class ConcurrencyManager:
    """Controls server-wide concurrent call execution and overload queuing."""

    def __init__(
        self,
        max_concurrent_calls: Optional[int] = None,
        max_queue_size: Optional[int] = None,
    ) -> None:
        settings = get_settings()
        self.max_concurrent_calls = max_concurrent_calls or settings.max_concurrent_calls
        self.max_queue_size = max_queue_size or settings.max_overload_queue_size
        self._active_calls = 0
        self._queue_waiters = 0
        self._lock = asyncio.Lock()
        self._semaphore = asyncio.Semaphore(self.max_concurrent_calls)

    @property
    def active_calls(self) -> int:
        return self._active_calls

    @property
    def queued_calls(self) -> int:
        return self._queue_waiters

    async def acquire_slot(self, timeout_sec: float = 5.0) -> bool:
        """Attempt to acquire execution slot. Raises 503 if capacity + queue exhausted."""
        async with self._lock:
            if self._active_calls >= self.max_concurrent_calls:
                if self._queue_waiters >= self.max_queue_size:
                    logger.warning(
                        f"Overload: Active ({self._active_calls}) and Queue ({self._queue_waiters}) at capacity!"
                    )
                    raise ConcurrencyOverloadException(
                        f"Server capacity reached: {self._active_calls} active calls, queue full."
                    )
                self._queue_waiters += 1

        try:
            acquired = False
            try:
                await asyncio.wait_for(self._semaphore.acquire(), timeout=timeout_sec)
                acquired = True
            except asyncio.TimeoutError:
                raise ConcurrencyOverloadException("Timed out waiting for an available call concurrency slot.")

            async with self._lock:
                if self._queue_waiters > 0:
                    self._queue_waiters -= 1
                self._active_calls += 1
                logger.info(f"Concurrency slot acquired. Active: {self._active_calls}/{self.max_concurrent_calls}")
                return True

        except Exception:
            async with self._lock:
                if not acquired and self._queue_waiters > 0:
                    self._queue_waiters -= 1
            raise

    def release_slot(self) -> None:
        """Release slot upon call completion or failure."""
        try:
            self._semaphore.release()
            if self._active_calls > 0:
                self._active_calls -= 1
            logger.info(f"Concurrency slot released. Active: {self._active_calls}/{self.max_concurrent_calls}")
        except ValueError:
            pass


_concurrency_manager: Optional[ConcurrencyManager] = None


def get_concurrency_manager() -> ConcurrencyManager:
    global _concurrency_manager
    if _concurrency_manager is None:
        _concurrency_manager = ConcurrencyManager()
    return _concurrency_manager

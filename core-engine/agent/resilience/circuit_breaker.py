"""Circuit Breaker and Resilience Management for External Services.

States:
- CLOSED: Requests pass through normally. Failures are tracked.
- OPEN: Failure threshold exceeded. Inbound requests immediately fast-fail or divert to fallback.
- HALF_OPEN: Recovery timeout elapsed. Probe requests tested to determine service recovery.
"""

from enum import Enum
import time
from typing import Any, Callable, Dict, Optional
from agent.logger import setup_logger

logger = setup_logger("resilience.circuit_breaker")


class CircuitState(str, Enum):
    CLOSED = "CLOSED"
    OPEN = "OPEN"
    HALF_OPEN = "HALF_OPEN"


class CircuitBreaker:
    """Circuit breaker guarding external API and network providers."""

    def __init__(
        self,
        name: str,
        failure_threshold: int = 3,
        recovery_timeout_sec: float = 30.0,
        half_open_max_probes: int = 1,
    ) -> None:
        self.name = name
        self.failure_threshold = failure_threshold
        self.recovery_timeout_sec = recovery_timeout_sec
        self.half_open_max_probes = half_open_max_probes

        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.success_count = 0
        self.total_requests = 0
        self.total_failures = 0
        self.last_failure_time = 0.0
        self.last_state_change = time.time()
        self._probes_in_flight = 0

    def can_execute(self) -> bool:
        """Check if request is permitted through the circuit."""
        now = time.time()

        if self.state == CircuitState.CLOSED:
            return True

        elif self.state == CircuitState.OPEN:
            # Check if recovery timeout has elapsed
            if now - self.last_failure_time >= self.recovery_timeout_sec:
                logger.info(
                    f"CircuitBreaker[{self.name}] transition: OPEN -> HALF_OPEN (probing recovery)"
                )
                self.state = CircuitState.HALF_OPEN
                self.last_state_change = now
                self._probes_in_flight = 1
                return True
            return False

        elif self.state == CircuitState.HALF_OPEN:
            if self._probes_in_flight < self.half_open_max_probes:
                self._probes_in_flight += 1
                return True
            return False

        return False

    def record_success(self) -> None:
        """Record successful downstream execution."""
        self.total_requests += 1
        self.success_count += 1

        if self.state == CircuitState.HALF_OPEN:
            logger.info(f"CircuitBreaker[{self.name}] probe succeeded. Transition: HALF_OPEN -> CLOSED")
            self.state = CircuitState.CLOSED
            self.failure_count = 0
            self._probes_in_flight = 0
            self.last_state_change = time.time()
        elif self.state == CircuitState.CLOSED:
            self.failure_count = 0

    def record_failure(self, error: Optional[Exception] = None) -> None:
        """Record downstream failure or timeout."""
        self.total_requests += 1
        self.total_failures += 1
        self.failure_count += 1
        self.last_failure_time = time.time()

        if self.state == CircuitState.HALF_OPEN:
            logger.warning(
                f"CircuitBreaker[{self.name}] probe failed. Transition: HALF_OPEN -> OPEN (error: {error})"
            )
            self.state = CircuitState.OPEN
            self._probes_in_flight = 0
            self.last_state_change = time.time()

        elif self.state == CircuitState.CLOSED and self.failure_count >= self.failure_threshold:
            logger.warning(
                f"CircuitBreaker[{self.name}] threshold reached ({self.failure_count} failures). "
                f"Transition: CLOSED -> OPEN (error: {error})"
            )
            self.state = CircuitState.OPEN
            self.last_state_change = time.time()

    def get_error_rate(self) -> float:
        """Calculate percentage error rate."""
        if self.total_requests == 0:
            return 0.0
        return round((self.total_failures / self.total_requests) * 100.0, 2)

    def to_dict(self) -> Dict[str, Any]:
        """Serialize circuit breaker metrics for observability and health endpoints."""
        return {
            "name": self.name,
            "state": self.state.value,
            "failure_count": self.failure_count,
            "total_requests": self.total_requests,
            "total_failures": self.total_failures,
            "error_rate_pct": self.get_error_rate(),
            "last_failure_time": self.last_failure_time,
            "last_state_change": self.last_state_change,
        }


class CircuitBreakerRegistry:
    """Global registry managing circuit breakers across all telephony and AI providers."""

    _instance: Optional["CircuitBreakerRegistry"] = None

    def __init__(self) -> None:
        self._breakers: Dict[str, CircuitBreaker] = {}
        self._fallback_counts: Dict[str, int] = {}
        self._total_turn_requests: int = 0

    @classmethod
    def get_instance(cls) -> "CircuitBreakerRegistry":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def get_breaker(
        self,
        name: str,
        failure_threshold: int = 3,
        recovery_timeout_sec: float = 30.0,
    ) -> CircuitBreaker:
        normalized = name.lower()
        if normalized not in self._breakers:
            self._breakers[normalized] = CircuitBreaker(
                name=normalized,
                failure_threshold=failure_threshold,
                recovery_timeout_sec=recovery_timeout_sec,
            )
        return self._breakers[normalized]

    def record_fallback(self, provider_type: str, primary: str, fallback: str) -> None:
        """Track and alert on rising fallback rates across calls."""
        key = f"{provider_type}:{primary}->{fallback}"
        self._fallback_counts[key] = self._fallback_counts.get(key, 0) + 1
        self._total_turn_requests += 1

        total_fallbacks = sum(self._fallback_counts.values())
        fallback_rate = (total_fallbacks / max(1, self._total_turn_requests)) * 100.0

        logger.warning(
            f"[RESILIENCE FALLBACK TRIGGERED] {provider_type.upper()}: {primary} -> {fallback}. "
            f"Total fallbacks for chain: {self._fallback_counts[key]} (Current rate: {fallback_rate:.1f}%)"
        )

        if fallback_rate > 15.0 and self._total_turn_requests >= 10:
            logger.error(
                f"ALERT: Provider fallback rate elevated at {fallback_rate:.1f}% "
                f"({total_fallbacks}/{self._total_turn_requests} turns). Check primary provider connectivity."
            )

    def reset_all(self) -> None:
        """Reset all circuit breakers back to CLOSED state."""
        for b in self._breakers.values():
            b.state = CircuitState.CLOSED
            b.failure_count = 0
            b.success_count = 0
            b.last_failure_time = 0.0
        self._fallback_counts.clear()
        self._total_turn_requests = 0

    def get_all_status(self) -> Dict[str, Any]:
        """Aggregate health status and metrics across all monitored providers."""
        breakers_status = {name: b.to_dict() for name, b in self._breakers.items()}
        all_healthy = all(b.state != CircuitState.OPEN for b in self._breakers.values())

        return {
            "all_healthy": all_healthy,
            "providers": breakers_status,
            "fallback_chains": dict(self._fallback_counts),
            "total_turn_requests": self._total_turn_requests,
        }


def get_circuit_registry() -> CircuitBreakerRegistry:
    return CircuitBreakerRegistry.get_instance()

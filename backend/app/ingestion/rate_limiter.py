import time
import math


class RateLimiter:
    """Tracks GitHub API rate limits and coordinates backoff (D-37)."""

    def __init__(self):
        self.remaining: int = 5000
        self.reset_at: float = 0
        self.min_remaining_threshold: int = 100

    def update(self, remaining: int, reset_unix: int) -> None:
        self.remaining = remaining
        self.reset_at = float(reset_unix)

    def is_exhausted(self) -> bool:
        """Return True if rate limit is critically low."""
        return self.remaining <= self.min_remaining_threshold

    def seconds_until_reset(self) -> float:
        """Seconds until rate limit resets. Returns 0 if reset already happened."""
        return max(0, self.reset_at - time.time())

    def wait_time(self) -> float:
        """Calculate recommended wait time before next request."""
        if self.remaining <= 0:
            return min(self.seconds_until_reset() + 1, 3600)
        if self.remaining <= self.min_remaining_threshold:
            # Exponentially back off as we approach exhaustion
            return math.ceil((self.min_remaining_threshold - self.remaining) * 0.5)
        return 0.0

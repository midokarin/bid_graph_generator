from collections.abc import AsyncIterator
from typing import Protocol
from dataclasses import dataclass


@dataclass
class StreamMetrics:
    """Request-local counts and timings only; never store content or credentials."""
    requests: int = 0
    first_headers_ms: float | None = None
    first_event_ms: float | None = None
    first_reasoning_ms: float | None = None
    first_content_ms: float | None = None
    reasoning_chars: int = 0
    content_chars: int = 0
    elapsed_ms: float = 0


class ProviderError(Exception):
    """Safe user-facing code only; never expose provider headers/body/URL."""


class Provider(Protocol):
    def stream(self, messages: list[dict], schema: dict) -> AsyncIterator[str]: ...

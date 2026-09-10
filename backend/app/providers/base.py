from collections.abc import AsyncIterator
from typing import Protocol


class ProviderError(Exception):
    """Safe user-facing code only; never expose provider headers/body/URL."""


class Provider(Protocol):
    def stream(self, messages: list[dict], schema: dict) -> AsyncIterator[str]: ...

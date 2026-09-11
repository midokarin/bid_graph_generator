import json

import httpx

from app.domain.limits import MAX_OUTPUT
from app.settings import Settings
from .base import ProviderError
from .schema import native_schema


class OpenAIProvider:
    def __init__(self, settings: Settings, transport=None):
        self.settings = settings
        self.transport = transport

    async def stream(self, messages, schema):
        settings = self.settings
        payload = {"model": settings.model, "messages": messages, "stream": True}
        if settings.structured_output != "off":
            payload["response_format"] = {
                "type": "json_schema",
                "json_schema": {"name": "diagram_result", "strict": True, "schema": native_schema(schema)},
            }
        try:
            async with httpx.AsyncClient(timeout=settings.timeout, transport=self.transport) as client:
                for attempt in range(2):
                    async with client.stream(
                        "POST", settings.base_url.rstrip("/") + "/chat/completions",
                        headers={"Authorization": f"Bearer {settings.api_key}"}, json=payload,
                    ) as response:
                        if response.is_error:
                            # Only retry an explicit unsupported structured-output parameter.
                            # Authentication, rate-limit and other schema errors must not be hidden.
                            body = (await response.aread())[:MAX_OUTPUT]
                            try:
                                error = json.loads(body).get("error", {})
                            except (ValueError, AttributeError):
                                error = {}
                            if not isinstance(error, dict):
                                error = {}
                            message = str(error.get("message", "")).lower()
                            unsupported = (
                                error.get("param") in {"response_format", "response_format.type"}
                                and (error.get("code") in {"unsupported_parameter", "unsupported_value"}
                                     or "not supported" in message or "unsupported" in message)
                            )
                            if (attempt == 0 and settings.structured_output == "auto"
                                    and response.status_code in {400, 422} and unsupported):
                                payload.pop("response_format", None)
                                continue
                            raise ProviderError(f"PROVIDER_HTTP_{response.status_code}")
                        data_lines = []
                        event_size = 0
                        async for line in response.aiter_lines():
                            event_size += len(line)
                            if event_size > MAX_OUTPUT:
                                raise ProviderError("PROVIDER_EVENT_TOO_LARGE")
                            if line.startswith("data:"):
                                data_lines.append(line[5:].lstrip())
                            elif not line:
                                data = "\n".join(data_lines)
                                data_lines = []
                                event_size = 0
                                if not data:
                                    continue
                                if data == "[DONE]":
                                    return
                                try:
                                    event = json.loads(data)
                                    if "error" in event:
                                        raise ProviderError("PROVIDER_STREAM_ERROR")
                                    choices = event.get("choices", [])
                                    if not choices:
                                        continue
                                    choice = choices[0]
                                    if choice.get("finish_reason") in {"length", "content_filter"}:
                                        raise ProviderError("PROVIDER_INCOMPLETE_RESPONSE")
                                    delta = choice.get("delta", {})
                                    if delta.get("refusal") or delta.get("tool_calls"):
                                        raise ProviderError("PROVIDER_UNEXPECTED_OUTPUT")
                                    content = delta.get("content")
                                    if content is not None:
                                        if not isinstance(content, str):
                                            raise ProviderError("PROVIDER_INVALID_CONTENT")
                                        yield content
                                except (ValueError, TypeError, AttributeError, IndexError) as exc:
                                    raise ProviderError("PROVIDER_INVALID_SSE") from exc
                        raise ProviderError("PROVIDER_STREAM_INTERRUPTED")
        except httpx.TimeoutException as exc:
            raise ProviderError("PROVIDER_TIMEOUT") from exc
        except httpx.HTTPError as exc:
            raise ProviderError("PROVIDER_CONNECTION_ERROR") from exc

import asyncio
import json
import unittest

import httpx

from app.domain.contracts import FlowchartResult
from app.providers.base import ProviderError
from app.providers.openai import OpenAIProvider
from app.settings import Settings


class Stream(httpx.AsyncByteStream):
    def __init__(self, data):
        self.data = data
        self.closed = False

    async def __aiter__(self):
        for part in self.data:
            yield part

    async def aclose(self):
        self.closed = True


async def collect(provider):
    return "".join([part async for part in provider.stream([{"role": "user", "content": "synthetic input"}], FlowchartResult.model_json_schema())])


class ProviderTests(unittest.IsolatedAsyncioTestCase):
    def settings(self, **changes):
        return Settings(provider="openai", model="test-model", api_key="synthetic-secret", base_url="https://model.example/v1", **changes)

    async def test_native_schema_chunked_sse_and_cleanup(self):
        requests = []
        # Split transport chunks across JSON, UTF-8 and SSE boundaries.
        body = ('data: {"choices":[{"delta":{"content":"中文"}}]}\r\n\r\n'
                'data: {"choices":[]}\n\n'
                'data: {"choices":[{"delta":{"content":"{}"},"finish_reason":"stop"}]}\n\n'
                'data: [DONE]\n\n').encode()
        stream = Stream([body[i:i+7] for i in range(0, len(body), 7)])

        async def handler(request):
            requests.append(request)
            return httpx.Response(200, headers={"Content-Type": "text/event-stream"}, stream=stream)

        self.assertEqual(await collect(OpenAIProvider(self.settings(), httpx.MockTransport(handler))), "中文{}")
        self.assertEqual(str(requests[0].url), "https://model.example/v1/chat/completions")
        payload = json.loads(requests[0].content)
        self.assertTrue(payload["stream"])
        self.assertTrue(payload["response_format"]["json_schema"]["strict"])
        self.assertNotIn("x-domain", json.dumps(payload["response_format"]))
        self.assertNotIn("tools", payload)
        self.assertTrue(stream.closed)

    async def test_fallback_only_for_explicit_unsupported_schema(self):
        for status, error, expected in [
            (400, {"param": "response_format", "code": "unsupported_parameter"}, 2),
            (422, {"param": "response_format.type", "message": "not supported"}, 2),
            (400, {"param": "response_format", "message": "invalid schema"}, 1),
            (401, {"param": "response_format", "code": "unsupported_parameter"}, 1),
            (429, {"message": "rate limited"}, 1),
        ]:
            with self.subTest(status=status, error=error):
                calls = []

                async def handler(request):
                    calls.append(json.loads(request.content))
                    if len(calls) == 1:
                        return httpx.Response(status, json={"error": error})
                    return httpx.Response(200, content=b'data: {"choices":[{"delta":{"content":"{}"}}]}\n\ndata: [DONE]\n\n')

                provider = OpenAIProvider(self.settings(), httpx.MockTransport(handler))
                if expected == 2:
                    self.assertEqual(await collect(provider), "{}")
                    self.assertNotIn("response_format", calls[1])
                    self.assertEqual(calls[0]["messages"], calls[1]["messages"])
                else:
                    with self.assertRaisesRegex(ProviderError, f"PROVIDER_HTTP_{status}"):
                        await collect(provider)
                self.assertEqual(len(calls), expected)

    async def test_off_required_and_safe_errors(self):
        for mode in ["off", "required"]:
            calls = []

            async def handler(request):
                calls.append(json.loads(request.content))
                return httpx.Response(400, json={"error": {"param": "response_format", "code": "unsupported_parameter", "message": "synthetic-secret"}})

            with self.assertRaisesRegex(ProviderError, "^PROVIDER_HTTP_400$"):
                await collect(OpenAIProvider(self.settings(structured_output=mode), httpx.MockTransport(handler)))
            self.assertEqual(len(calls), 1)
            self.assertEqual("response_format" in calls[0], mode == "required")

    async def test_invalid_truncated_and_filtered_sse(self):
        for content, code in [
            (b'data: nope\n\n', "PROVIDER_INVALID_SSE"),
            (b'data: {"choices":[{"delta":{"content":"{}"}}]}\n\n', "PROVIDER_STREAM_INTERRUPTED"),
            (b'data: {"choices":[{"delta":{},"finish_reason":"length"}]}\n\n', "PROVIDER_INCOMPLETE_RESPONSE"),
            (b'data: {"choices":[{"delta":{"tool_calls":[{}]}}]}\n\n', "PROVIDER_UNEXPECTED_OUTPUT"),
        ]:
            async def handler(request):
                return httpx.Response(200, content=content)
            with self.assertRaisesRegex(ProviderError, code):
                await collect(OpenAIProvider(self.settings(), httpx.MockTransport(handler)))

    async def test_cancellation_closes_upstream_response(self):
        started = asyncio.Event()

        class BlockingStream(Stream):
            async def __aiter__(self):
                started.set()
                await asyncio.Event().wait()
                yield b""

        stream = BlockingStream([])

        async def handler(request):
            return httpx.Response(200, stream=stream)

        task = asyncio.create_task(collect(OpenAIProvider(self.settings(), httpx.MockTransport(handler))))
        await asyncio.wait_for(started.wait(), 1)
        task.cancel()
        with self.assertRaises(asyncio.CancelledError):
            await task
        self.assertTrue(stream.closed)

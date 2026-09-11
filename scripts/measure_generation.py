"""Profile the repository's synthetic date-based Gantt case; live calls are opt-in.

Raw responses stay in a private system temporary directory, never in the repo.
An optional messages snapshot permits an exact before/after prompt comparison.
"""
import argparse
import asyncio
from contextlib import aclosing
from dataclasses import asdict
import json
from pathlib import Path
import sys
import tempfile
from time import perf_counter
import httpx

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.domain.contracts import GanttResult, GenerationRequest
from app.domain.limits import MAX_OUTPUT
from app.domain.scheduling import schedule
from app.providers.base import StreamMetrics
from app.providers.openai import OpenAIProvider
from app.services.parsing import parse_result
from app.services.prompts import initial_messages
from app.settings.storage import load_settings


class ThinkingOffExperiment(httpx.AsyncHTTPTransport):
    """Diagnostic-only override. Never changes saved or production settings."""
    async def handle_async_request(self, request):
        payload = json.loads(request.content)
        payload["enable_thinking"] = False
        headers = dict(request.headers)
        headers.pop("content-length", None)
        experiment = httpx.Request(request.method, request.url, headers=headers,
                                   json=payload, extensions=request.extensions)
        return await super().handle_async_request(experiment)


def analyze(raw):
    started = perf_counter()
    result, errors = parse_result(raw, GanttResult, "DOWN")
    validation_ms = (perf_counter() - started) * 1000
    report = {"valid": result is not None, "validation_ms": round(validation_ms, 3)}
    if result is None:
        # Do not print validation errors that might embed model output.
        report["validation_error_count"] = len(errors)
        return report
    started = perf_counter()
    tasks = schedule(result.spec)
    report.update(scheduling_ms=round((perf_counter() - started) * 1000, 3),
                  task_count=len(result.spec.tasks), dependency_count=len(result.spec.dependencies),
                  milestone_count=sum(t.kind == "milestone" for t in result.spec.tasks),
                  supplement_count=len(result.supplements), end=max(t.end for t in tasks))
    return report


async def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--live", action="store_true", help="Send one synthetic request using saved model settings")
    parser.add_argument("--messages-file", type=Path, help="Previously captured baseline messages; transmitted only with --live")
    parser.add_argument("--replay", type=Path, help="Analyze a local result JSON without a model call")
    parser.add_argument("--thinking-off", action="store_true", help="Diagnostic experiment only: request enable_thinking=false; does not change app settings")
    args = parser.parse_args()
    if args.replay:
        if args.live or args.messages_file or args.thinking_off:
            parser.error("--replay cannot be combined with --live or --messages-file")
        print(json.dumps(analyze(args.replay.read_text()), ensure_ascii=False))
        return
    if not args.live:
        parser.error("Choose --replay FILE for local timing or explicitly opt in with --live")
    settings = load_settings()
    if settings.provider != "openai":
        parser.error("Live profiling requires a configured model")
    source = next(line for line in (ROOT / "docs/图表生成业务测试文本.md").read_text().splitlines()
                  if line.startswith("本项目为政务档案"))
    request = GenerationRequest(diagram_type="gantt", source_text=source)
    schema = GanttResult.model_json_schema()
    messages = (json.loads(args.messages_file.read_text()) if args.messages_file
                else initial_messages(request, schema))
    metrics = StreamMetrics()
    directory = Path(tempfile.mkdtemp(prefix="biaoshu2-profile-"))
    print(json.dumps({"phase": "started", "model": settings.model, "directory": str(directory)}, ensure_ascii=False), flush=True)
    raw = ""
    error_code = None
    try:
        # One generation only: do not mask quality regressions with auto-repairs.
        async with asyncio.timeout(settings.timeout):
            transport = ThinkingOffExperiment() if args.thinking_off else None
            async with aclosing(OpenAIProvider(settings, transport).stream(messages, schema, metrics=metrics)) as stream:
                async for chunk in stream:
                    raw += chunk
                    if len(raw) > MAX_OUTPUT:
                        raise ValueError("MODEL_OUTPUT_TOO_LARGE")
    except (Exception, asyncio.CancelledError) as exc:
        error_code = type(exc).__name__
    (directory / "result.json").write_text(raw)
    report = {"model": settings.model, "stream_completed": error_code is None,
              "thinking_override": "off" if args.thinking_off else "unchanged",
              "prompt_chars": sum(len(m["content"]) for m in messages),
              **asdict(metrics), **analyze(raw)}
    if error_code:
        report["error"] = error_code
    if metrics.first_content_ms is not None:
        report["content_stream_ms"] = round(metrics.elapsed_ms - metrics.first_content_ms, 3)
    (directory / "metrics.json").write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(json.dumps(report, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    asyncio.run(main())

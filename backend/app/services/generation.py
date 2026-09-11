import asyncio
from contextlib import aclosing
from dataclasses import dataclass, field
from time import monotonic
from uuid import uuid4

from app.domain.contracts import GenerationRequest, RESULT_MODELS, GanttSpec
from app.domain.scheduling import schedule
from app.domain.limits import MAX_JOBS, JOB_TTL_SECONDS, MAX_OUTPUT, MAX_REPAIRS, MAX_CONCURRENT_GENERATIONS
from app.providers.base import Provider, ProviderError
from .parsing import parse_result
from .prompts import initial_messages, repair_messages

TERMINAL = {"completed", "failed", "cancelled"}


@dataclass
class Job:
    id: str
    state: str = "queued"
    events: list[dict] = field(default_factory=list)
    changed: asyncio.Event = field(default_factory=asyncio.Event)
    task: asyncio.Task | None = None
    finished_at: float | None = None
    created_at: float = field(default_factory=monotonic)

    def emit(self, event, data):
        if self.state == "cancelled":
            return
        self.events.append({"id": len(self.events) + 1, "event": event, "data": data})
        self.changed.set()


class CapacityError(Exception):
    pass


class GenerationService:
    def __init__(self, provider: Provider, log, timeout):
        self.provider, self.log, self.timeout = provider, log, timeout
        self.jobs: dict[str, Job] = {}
        self.slots = asyncio.Semaphore(MAX_CONCURRENT_GENERATIONS)

    def create(self, request: GenerationRequest):
        now = monotonic()
        for key, job in list(self.jobs.items()):
            if job.finished_at is not None and now - job.finished_at > JOB_TTL_SECONDS:
                del self.jobs[key]
        if len(self.jobs) >= MAX_JOBS:
            raise CapacityError()
        job = Job(uuid4().hex)
        self.jobs[job.id] = job
        self.status(job, "queued", 0)
        job.task = asyncio.create_task(self.run(job, request))
        return job

    def status(self, job, state, attempt):
        if job.state in TERMINAL:
            return
        elapsed_ms = round((monotonic() - job.created_at) * 1000, 3)
        job.emit("status", {"state": state, "attempt": attempt, "elapsed_ms": elapsed_ms})
        job.state = state
        if state in TERMINAL:
            job.finished_at = monotonic()
        self.log.write(job.id, state, attempt, elapsed_ms=elapsed_ms)

    def cancel(self, job):
        if job.state not in TERMINAL:
            self.status(job, "cancelled", 0)
            if job.task:
                job.task.cancel()
        return job

    async def run(self, job, request):
        try:
            async with self.slots:
                if job.state != "cancelled":
                    await self.run_generation(job, request)
        except asyncio.CancelledError:
            self.cancel(job)

    async def run_generation(self, job, request):
        attempt = 0
        try:
            model = RESULT_MODELS[request.diagram_type]
            schema = model.model_json_schema()
            messages = initial_messages(request, schema)
            for attempt in range(MAX_REPAIRS + 1):
                if job.state == "cancelled":
                    return
                self.status(job, "generating" if attempt == 0 else "repairing", attempt)
                raw = ""
                started = monotonic()
                first_content_ms = None
                try:
                    async with asyncio.timeout(self.timeout):
                        async with aclosing(self.provider.stream(messages, schema)) as chunks:
                            async for chunk in chunks:
                                if job.state == "cancelled":
                                    return
                                if not chunk:
                                    continue
                                if first_content_ms is None:
                                    first_content_ms = round((monotonic() - started) * 1000, 3)
                                if len(raw) + len(chunk) > MAX_OUTPUT:
                                    raise ProviderError("MODEL_OUTPUT_TOO_LARGE")
                                raw += chunk
                                job.emit("delta", {"attempt": attempt, "text": chunk})
                finally:
                    # Keep useful timing even when the upstream times out or is cancelled.
                    provider_ms = round((monotonic() - started) * 1000, 3)
                    self.log.write(job.id, "provider_timing", attempt, provider_ms=provider_ms,
                                   first_content_ms=first_content_ms, output_chars=len(raw))
                if job.state == "cancelled":
                    return
                self.status(job, "validating", attempt)
                started = monotonic()
                result, errors = parse_result(raw, model, request.direction)
                validation_ms = round((monotonic() - started) * 1000, 3)
                self.log.write(job.id, "validation_timing", attempt, validation_ms=validation_ms)
                if result is not None:
                    if isinstance(result.spec, GanttSpec):
                        started = monotonic()
                        tasks = [task.model_dump(mode="json") for task in schedule(result.spec)]
                        self.log.write(job.id, "schedule_timing", attempt,
                                       schedule_ms=round((monotonic() - started) * 1000, 3))
                        job.emit("schedule", {"tasks": tasks})
                    job.emit("result", result.model_dump(mode="json"))
                    self.status(job, "completed", attempt)
                    return
                job.emit("validation_error", {"attempt": attempt, "errors": errors})
                if attempt == MAX_REPAIRS:
                    job.emit("error", {"message": "生成内容在两次修复后仍未通过校验，请调整文字后重试。", "code": "VALIDATION_FAILED", "details": errors})
                    self.status(job, "failed", attempt)
                    return
                messages = repair_messages(request, schema, raw, errors)
        except asyncio.CancelledError:
            self.cancel(job)
        except (ProviderError, TimeoutError) as exc:
            if job.state != "cancelled":
                code = str(exc) if isinstance(exc, ProviderError) else "PROVIDER_TIMEOUT"
                message = (f"模型请求超时（本次总时限 {self.timeout:g} 秒）。模型可能仍在推理或输出，复杂流程需要更长的等待时间，请稍后重试。"
                           if code == "PROVIDER_TIMEOUT" else "模型请求未完成，请检查配置或稍后重试。")
                job.emit("error", {"message": message, "code": code, "details": []})
                self.status(job, "failed", attempt)
        except Exception:
            if job.state != "cancelled":
                job.emit("error", {"message": "生成服务遇到错误，请重试。", "code": "INTERNAL_ERROR", "details": []})
                self.status(job, "failed", attempt)

    async def close(self):
        for job in self.jobs.values():
            self.cancel(job)
        tasks = [job.task for job in self.jobs.values() if job.task]
        if tasks:
            done, pending = await asyncio.wait(tasks, timeout=2)
            for task in pending:
                task.cancel()

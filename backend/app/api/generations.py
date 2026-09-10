import asyncio
import json

from fastapi import APIRouter, Header, HTTPException, Request
from fastapi.responses import StreamingResponse

from app.domain.contracts import GenerationRequest
from app.domain.limits import HEARTBEAT_SECONDS
from app.services.generation import CapacityError, TERMINAL

router = APIRouter(prefix="/api/v1/generations")


def get_job(request, job_id):
    job = request.app.state.generations.jobs.get(job_id)
    if job is None:
        raise HTTPException(404, "任务不存在或已过期")
    return job


@router.post("", status_code=202)
async def create(body: GenerationRequest, request: Request):
    try:
        job = request.app.state.generations.create(body)
    except CapacityError:
        raise HTTPException(429, "任务缓存已满，请稍后重试或重启本地服务") from None
    return {"job_id": job.id, "state": job.state, "events_url": f"/api/v1/generations/{job.id}/events"}


@router.delete("/{job_id}")
async def cancel(job_id: str, request: Request):
    job = request.app.state.generations.cancel(get_job(request, job_id))
    return {"job_id": job.id, "state": job.state}


@router.get("/{job_id}/events")
async def events(job_id: str, request: Request, last_event_id: str | None = Header(default=None)):
    job = get_job(request, job_id)
    try:
        cursor = int(last_event_id or "0")
        if cursor < 0 or cursor > len(job.events):
            raise ValueError()
    except ValueError:
        raise HTTPException(400, "无效的 Last-Event-ID") from None

    async def stream():
        nonlocal cursor
        while True:
            # Clear before checking buffered events so no wakeup is lost.
            job.changed.clear()
            for item in job.events[cursor:]:
                cursor = item["id"]
                yield f"id: {cursor}\nevent: {item['event']}\ndata: {json.dumps(item['data'], ensure_ascii=False, allow_nan=False)}\n\n"
            if job.state in TERMINAL:
                if cursor < len(job.events):
                    continue
                return
            if await request.is_disconnected():
                return
            try:
                await asyncio.wait_for(job.changed.wait(), HEARTBEAT_SECONDS)
            except TimeoutError:
                yield ": heartbeat\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream", headers={"Cache-Control": "no-cache, no-store", "X-Accel-Buffering": "no"})

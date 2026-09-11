import asyncio
from contextlib import asynccontextmanager
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import httpx

from app.domain.contracts import RESULT_MODELS
from app.domain.limits import MAX_OUTPUT
from app.main import create_app
from app.settings import Settings

CONTRACTS = Path(__file__).resolve().parents[2] / "packages/contracts"


def fixture(kind):
    return (CONTRACTS / f"examples/{kind}.json").read_text()


def parse_events(response):
    events = []
    for frame in response.text.split("\n\n"):
        fields = dict(line.split(": ", 1) for line in frame.splitlines() if ": " in line)
        if "event" in fields:
            events.append({"event": fields["event"], "id": int(fields["id"]), "data": json.loads(fields["data"])})
    return events


class ScriptedProvider:
    def __init__(self, outputs, *, block=False, ignore_cancel=False):
        self.outputs = outputs
        self.calls = []
        self.started = asyncio.Event()
        self.release = asyncio.Event()
        self.cancel_seen = asyncio.Event()
        self.finished = asyncio.Event()
        self.block, self.ignore_cancel = block, ignore_cancel

    async def stream(self, messages, schema):
        index = len(self.calls)
        self.calls.append(messages)
        self.started.set()
        if self.block:
            try:
                await self.release.wait()
            except asyncio.CancelledError:
                self.cancel_seen.set()
                if not self.ignore_cancel:
                    raise
        raw = self.outputs[min(index, len(self.outputs) - 1)]
        self.finished.set()
        for offset in range(0, len(raw), 120):
            await asyncio.sleep(0)
            yield raw[offset:offset + 120]


@asynccontextmanager
async def api(provider=None, timeout=2):
    with tempfile.TemporaryDirectory() as directory:
        app = create_app(Settings(timeout=timeout), provider, directory)
        async with app.router.lifespan_context(app):
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://testserver") as client:
                yield client, app
        assert not list(Path(directory).glob("*.jsonl")), "debug log must be removed on shutdown"


async def create(client, kind="flowchart", direction="DOWN"):
    response = await client.post("/api/v1/generations", json={"diagram_type": kind, "direction": direction, "source_text": "ORIGINAL_SOURCE_MUST_NOT_APPEAR_IN_REPAIR"})
    assert response.status_code == 202, response.text
    return response.json()


class APITests(unittest.IsolatedAsyncioTestCase):
    async def test_global_concurrency_queue_cancel_and_slot_release(self):
        provider = ScriptedProvider([fixture("flowchart")], block=True)
        async with api(provider) as (client, app):
            jobs = [await create(client) for _ in range(4)]
            async with asyncio.timeout(1):
                while len(provider.calls) < 2:
                    await asyncio.sleep(0)
            self.assertEqual(len(provider.calls), 2)
            self.assertEqual(app.state.generations.jobs[jobs[2]["job_id"]].state, "queued")
            await client.delete(f"/api/v1/generations/{jobs[2]['job_id']}")
            await client.delete(f"/api/v1/generations/{jobs[0]['job_id']}")
            async with asyncio.timeout(1):
                while len(provider.calls) < 3:
                    await asyncio.sleep(0)
            self.assertEqual(app.state.generations.jobs[jobs[3]["job_id"]].state, "generating")
            provider.release.set()
            responses = await asyncio.gather(*(client.get(job["events_url"]) for job in jobs))
            states = [parse_events(response)[-1]["data"]["state"] for response in responses]
            self.assertEqual(states, ["cancelled", "completed", "cancelled", "completed"])
            self.assertFalse(any(e["event"] == "result" for e in parse_events(responses[2])))

    async def test_concurrent_jobs_start_together_and_cancellation_is_isolated(self):
        provider = ScriptedProvider([fixture("flowchart")], block=True)
        async with api(provider) as (client, app):
            first = await create(client)
            await asyncio.wait_for(provider.started.wait(), 1)
            second = await create(client)
            async with asyncio.timeout(1):
                while len(provider.calls) < 2:
                    await asyncio.sleep(0)
            self.assertEqual(app.state.generations.jobs[first["job_id"]].state, "generating")
            self.assertEqual(app.state.generations.jobs[second["job_id"]].state, "generating")
            await client.delete(f"/api/v1/generations/{first['job_id']}")
            provider.release.set()
            cancelled, completed = await asyncio.gather(
                client.get(first["events_url"]), client.get(second["events_url"]))
            cancelled_events, completed_events = parse_events(cancelled), parse_events(completed)
            self.assertFalse(any(e["event"] == "result" for e in cancelled_events))
            self.assertEqual(cancelled_events[-1]["data"]["state"], "cancelled")
            self.assertEqual(completed_events[-1]["data"]["state"], "completed")
            self.assertEqual(sum(e["event"] == "result" for e in completed_events), 1)

    async def test_sequential_gantt_keeps_all_tasks_and_finish_milestone(self):
        # Hand-authored fixture: verifies the service/SSE path, not LLM comprehension.
        provider = ScriptedProvider([fixture("gantt-sequential")])
        async with api(provider) as (client, _):
            job = await create(client, "gantt")
            events = parse_events(await client.get(job["events_url"]))
            self.assertEqual(events[-1]["data"]["state"], "completed")
            result = next(e["data"] for e in events if e["event"] == "result")
            self.assertEqual(result, json.loads(fixture("gantt-sequential")))
            tasks = next(e["data"]["tasks"] for e in events if e["event"] == "schedule")
            self.assertEqual([(t["id"], t["start"], t["end"]) for t in tasks],
                             [("prepare", 0, 3), ("implement", 3, 23), ("accept", 23, 23)])
            self.assertEqual(len(provider.calls), 1)

    async def test_sse_success_repair_and_cancel(self):
        for kind in ["flowchart", "gantt"]:
            for repair in [False, True]:
                with self.subTest(kind=kind, repair=repair):
                    provider = ScriptedProvider((["{}"] if repair else []) + [fixture(kind)])
                    async with api(provider) as (client, app):
                        job = await create(client, kind)
                        response = await client.get(job["events_url"])
                        self.assertEqual(response.status_code, 200)
                        self.assertIn("text/event-stream", response.headers["content-type"])
                        events = parse_events(response)
                        self.assertEqual(events[-1]["data"]["state"], "completed")
                        self.assertEqual([e["id"] for e in events], list(range(1, len(events) + 1)))
                        results = [e["data"] for e in events if e["event"] == "result"]
                        schedules = [e["data"] for e in events if e["event"] == "schedule"]
                        if kind == "gantt":
                            self.assertEqual(len(schedules), 1)
                            self.assertEqual([t["end"] for t in schedules[0]["tasks"]], [3, 7, 6, 7, 7])
                        else:
                            self.assertEqual(schedules, [])
                        self.assertEqual(len(results), 1)
                        RESULT_MODELS[kind].model_validate(results[0])
                        attempts = sorted({e["data"]["attempt"] for e in events if e["event"] == "delta"})
                        self.assertEqual(attempts, [0, 1] if repair else [0])
                        self.assertEqual(len(provider.calls), 2 if repair else 1)
                        if repair:
                            self.assertNotIn("ORIGINAL_SOURCE_MUST_NOT_APPEAR_IN_REPAIR", json.dumps(provider.calls[1]))
                            self.assertIn("validation_errors", provider.calls[1][1]["content"])
                        # EventSource reconnect resumes without replaying acknowledged frames.
                        replay = parse_events(await client.get(job["events_url"], headers={"Last-Event-ID": str(events[-2]["id"])}))
                        self.assertEqual(replay, events[-1:])
                        self.assertEqual((await client.delete(f"/api/v1/generations/{job['job_id']}")).json()["state"], "completed")
        for ignore_cancel in [False, True]:
            with self.subTest(ignore_cancel=ignore_cancel):
                provider = ScriptedProvider([fixture("flowchart")], block=True, ignore_cancel=ignore_cancel)
                async with api(provider) as (client, app):
                    job = await create(client)
                    await asyncio.wait_for(provider.started.wait(), 1)
                    response = await client.delete(f"/api/v1/generations/{job['job_id']}")
                    self.assertEqual(response.json()["state"], "cancelled")
                    await asyncio.wait_for(provider.cancel_seen.wait(), 1)
                    await asyncio.wait_for(app.state.generations.jobs[job["job_id"]].task, 1)
                    events = parse_events(await client.get(job["events_url"]))
                    self.assertEqual(events[-1]["data"]["state"], "cancelled")
                    self.assertFalse(any(e["event"] == "result" for e in events))
                    self.assertEqual(len(provider.calls), 1)

    async def test_exact_repair_limit_and_cycle_repair(self):
        invalid = next(c["data"] for c in json.loads((CONTRACTS / "cases.json").read_text()) if c["name"] == "gantt-cycle")
        for outputs, state in [([json.dumps(invalid), fixture("gantt")], "completed"), (["{}", "{}", "{}", fixture("gantt")], "failed"), (["{}", "{}", fixture("gantt")], "completed")]:
            provider = ScriptedProvider(outputs)
            async with api(provider) as (client, _):
                job = await create(client, "gantt")
                events = parse_events(await client.get(job["events_url"]))
                self.assertEqual(events[-1]["data"]["state"], state)
                self.assertEqual(len(provider.calls), min(3, len(outputs)))
                if state == "failed":
                    self.assertFalse(any(e["event"] == "result" for e in events))
                    self.assertEqual(next(e["data"]["code"] for e in events if e["event"] == "error"), "VALIDATION_FAILED")

    async def test_direction_is_authoritative_and_fence_accepted(self):
        right = json.loads(fixture("flowchart"))
        right["spec"]["direction"] = "RIGHT"
        provider = ScriptedProvider([fixture("flowchart"), "```json\n" + json.dumps(right) + "\n```"])
        async with api(provider) as (client, _):
            job = await create(client, direction="RIGHT")
            events = parse_events(await client.get(job["events_url"]))
            self.assertEqual(len(provider.calls), 2)
            result = next(e["data"] for e in events if e["event"] == "result")
            self.assertEqual(result["spec"]["direction"], "RIGHT")

    async def test_output_limit_timeout_and_api_errors(self):
        for provider, timeout, code in [(ScriptedProvider(["x" * (MAX_OUTPUT + 1)]), 2, "MODEL_OUTPUT_TOO_LARGE"),
                                         (ScriptedProvider(["{}"], block=True), 0.02, "PROVIDER_TIMEOUT")]:
            async with api(provider, timeout) as (client, _):
                job = await create(client)
                events = parse_events(await client.get(job["events_url"]))
                self.assertEqual(events[-1]["data"]["state"], "failed")
                self.assertEqual(next(e["data"]["code"] for e in events if e["event"] == "error"), code)
                if code == "PROVIDER_TIMEOUT":
                    error = next(e["data"] for e in events if e["event"] == "error")
                    self.assertIn("0.02 秒", error["message"])
                    self.assertIn("推理", error["message"])
                    self.assertFalse(any(e["event"] == "result" for e in events))
                    self.assertTrue(provider.cancel_seen.is_set())
        async with api(ScriptedProvider([fixture("flowchart")])) as (client, _):
            self.assertEqual((await client.get("/api/v1/health")).json()["provider"], "stub")
            self.assertEqual((await client.get("/api/v1/generations/absent/events")).status_code, 404)
            self.assertEqual((await client.delete("/api/v1/generations/absent")).status_code, 404)
            self.assertEqual((await client.post("/api/v1/generations", json={"diagram_type": "flowchart", "source_text": ""})).status_code, 422)
            job = await create(client)
            for cursor in ["-1", "bad", "999999"]:
                self.assertEqual((await client.get(job["events_url"], headers={"Last-Event-ID": cursor})).status_code, 400)
            with patch("app.services.generation.MAX_JOBS", 1):
                self.assertEqual((await client.post("/api/v1/generations", json={"diagram_type": "gantt", "source_text": "test"})).status_code, 429)

    async def test_default_stub_both_kinds(self):
        async with api() as (client, _):
            for kind in ["flowchart", "gantt"]:
                job = await create(client, kind)
                events = parse_events(await client.get(job["events_url"]))
                self.assertEqual(events[-1]["data"]["state"], "completed")

    async def test_timing_covers_each_repair_without_changing_results_or_logging_text(self):
        provider = ScriptedProvider(["{}", fixture("gantt")])
        async with api(provider) as (client, app):
            job = await create(client, "gantt")
            events = parse_events(await client.get(job["events_url"]))
            result = next(e["data"] for e in events if e["event"] == "result")
            self.assertEqual(result, json.loads(fixture("gantt")))
            elapsed = [e["data"]["elapsed_ms"] for e in events if e["event"] == "status"]
            self.assertEqual(elapsed, sorted(elapsed))
            raw_log = app.state.generations.log.path.read_text()
            self.assertNotIn("ORIGINAL_SOURCE", raw_log)
            self.assertNotIn('"spec"', raw_log)
            records = [json.loads(line) for line in raw_log.splitlines()]
            timings = [r for r in records if r["state"] == "provider_timing"]
            self.assertEqual([r["attempt"] for r in timings], [0, 1])
            self.assertEqual(timings[0]["output_chars"], 2)
            for timing in timings:
                self.assertLessEqual(timing["first_content_ms"], timing["provider_ms"])
            self.assertEqual(len([r for r in records if r["state"] == "schedule_timing"]), 1)

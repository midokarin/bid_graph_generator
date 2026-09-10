"""Optional live local HTTP smoke; requires running stub backend and Vite server."""
import argparse
import json
from time import monotonic
import httpx

parser = argparse.ArgumentParser()
parser.add_argument("--api-port", type=int, default=8000)
parser.add_argument("--web-port", type=int, default=5173)
args = parser.parse_args()
base = f"http://127.0.0.1:{args.api_port}"
web = f"http://127.0.0.1:{args.web_port}"

with httpx.Client(base_url=base, timeout=10) as client:
    health = client.get("/api/v1/health").json()
    assert health["provider"] == "stub", "This smoke is authorized only for the local stub provider"
    assert httpx.get(web, timeout=5).status_code == 200
    assert httpx.get(web + "/api/v1/health", timeout=5).json() == health
    assert client.get("/api/v1/openapi.json").status_code == 200
    for kind, cancel in [("flowchart", False), ("gantt", False), ("flowchart", True)]:
        job_response = client.post("/api/v1/generations", json={"diagram_type": kind, "source_text": "合成 HTTP 测试资料"})
        job_response.raise_for_status()
        job = job_response.json()
        event, terminal, result_count, delta_count = None, None, 0, 0
        first_delta, last_event = None, None
        with client.stream("GET", job["events_url"]) as response:
            response.raise_for_status()
            assert response.headers["content-type"].startswith("text/event-stream")
            for line in response.iter_lines():
                if line.startswith("event: "):
                    event = line[7:]
                if not line.startswith("data: "):
                    continue
                value = json.loads(line[6:])
                last_event = monotonic()
                if event == "delta":
                    delta_count += 1
                    if first_delta is None:
                        first_delta = last_event
                        if cancel:
                            cancelled = client.delete(f"/api/v1/generations/{job['job_id']}")
                            assert cancelled.json()["state"] == "cancelled"
                if event == "result":
                    result_count += 1
                    assert value["spec"]["diagram_type"] == kind
                if event == "status":
                    terminal = value["state"]
        assert terminal == ("cancelled" if cancel else "completed")
        assert result_count == (0 if cancel else 1)
        assert first_delta is not None
        if not cancel:
            assert last_event - first_delta > 0.03, "Expected incremental delivery before stub completion"
        print(json.dumps({"kind": kind, "terminal": terminal, "deltas": delta_count, "results": result_count, "stream_span_ms": round((last_event-first_delta)*1000)}))
print("Local HTTP startup, proxy and SSE smoke: OK (stub only)")

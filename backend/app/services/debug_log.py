import json
import os
from pathlib import Path
import tempfile
from uuid import uuid4

from app.domain.limits import MAX_LOG_BYTES


class DebugLog:
    """Bounded, process-owned temporary diagnostics; no source, output or secrets."""
    def __init__(self, directory=None):
        self.directory = Path(directory) if directory else Path(tempfile.gettempdir()) / "biaoshu2-debug"
        self.directory.mkdir(mode=0o700, parents=True, exist_ok=True)
        if self.directory.is_symlink():
            raise ValueError("Debug directory must not be a symlink")
        for old in self.directory.glob("run-*-*.jsonl"):
            try:
                pid = int(old.name.split("-")[1])
                os.kill(pid, 0)
            except ProcessLookupError:
                old.unlink(missing_ok=True)
            except (PermissionError, ValueError):
                pass
        self.path = self.directory / f"run-{os.getpid()}-{uuid4().hex}.jsonl"
        self.file = self.path.open("x", encoding="utf-8")
        self.path.chmod(0o600)
        self.bytes = 0

    def write(self, job_id, state, attempt):
        line = json.dumps({"job_id": job_id, "state": state, "attempt": attempt}) + "\n"
        if self.bytes + len(line.encode()) <= MAX_LOG_BYTES:
            self.file.write(line)
            self.file.flush()
            self.bytes += len(line.encode())

    def close(self):
        self.file.close()
        self.path.unlink(missing_ok=True)

"""Cross-platform project commands. Uses the local venv, never a global pip."""
from pathlib import Path
import os
import json
import signal
import socket
import subprocess
import sys
import time
from urllib.request import build_opener, ProxyHandler

ROOT = Path(__file__).resolve().parents[1]
PYTHON = ROOT / ".venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
NPM = "npm.cmd" if os.name == "nt" else "npm"


def run(args, cwd=ROOT):
    subprocess.run([str(arg) for arg in args], cwd=cwd, check=True)


def start():
    """Run both services together; never reuse or stop an unrelated server."""
    ports = [int(os.environ.get(name, default)) for name, default in
             [("BIAOSHU_API_PORT", "8000"), ("BIAOSHU_WEB_PORT", "5173")]]
    if any(not 1 <= port <= 65535 for port in ports) or ports[0] == ports[1]:
        raise SystemExit("前后端端口必须不同，且在 1–65535 之间。")
    for port in ports:
        with socket.socket() as probe:
            try:
                probe.bind(("127.0.0.1", port))
            except OSError:
                raise SystemExit(f"端口 {port} 已被占用。请先关闭已有启动终端，或设置 BIAOSHU_API_PORT 和 BIAOSHU_WEB_PORT。") from None
    children = []
    def stop(signum, frame):
        raise KeyboardInterrupt
    previous = signal.signal(signal.SIGTERM, stop)
    try:
        backend = subprocess.Popen([str(PYTHON), "-m", "app"], cwd=ROOT / "backend")
        children.append(backend)
        opener = build_opener(ProxyHandler({}))
        deadline = time.monotonic() + 20
        while True:
            if backend.poll() is not None:
                raise SystemExit("后端启动失败，请查看上方错误。")
            try:
                with opener.open(f"http://127.0.0.1:{ports[0]}/api/v1/health", timeout=1) as response:
                    if json.load(response).get("status") == "ok":
                        break
            except (OSError, ValueError):
                pass
            if time.monotonic() >= deadline:
                raise SystemExit("后端启动超时，请查看上方错误。")
            time.sleep(0.2)
        children.append(subprocess.Popen(
            ["node", str(ROOT / "node_modules/vite/bin/vite.js")], cwd=ROOT / "frontend"))
        print(f"后端已就绪，正在启动页面：http://127.0.0.1:{ports[1]}；按 Ctrl+C 同时关闭服务。", flush=True)
        while all(child.poll() is None for child in children):
            time.sleep(0.2)
        raise SystemExit("服务已退出，正在关闭配套服务。")
    except KeyboardInterrupt:
        pass
    finally:
        signal.signal(signal.SIGTERM, previous)
        for child in reversed(children):
            if child.poll() is None:
                child.terminate()
        for child in reversed(children):
            try:
                child.wait(timeout=5)
            except subprocess.TimeoutExpired:
                child.kill()
                child.wait()


def main():
    if not PYTHON.exists():
        raise SystemExit("Create .venv and install backend/requirements.txt first; see README.md")
    command = sys.argv[1] if len(sys.argv) > 1 else "quality"
    if command == "start":
        start()
    elif command == "backend":
        run([PYTHON, "-m", "app"], ROOT / "backend")
    elif command == "contracts":
        run([PYTHON, ROOT / "scripts/export_contracts.py"])
        run(["node", "scripts/export_types.mjs"])
    elif command == "quality":
        run([PYTHON, ROOT / "scripts/export_contracts.py", "--check"])
        run(["node", "scripts/export_types.mjs", "--check"])
        run([PYTHON, "-m", "unittest", "discover", "-s", "tests", "-v"], ROOT / "backend")
        for script in ["test", "typecheck", "build"]:
            run([NPM, "run", script, "--workspace", "frontend"])
    else:
        raise SystemExit("Use start, backend, contracts or quality")


if __name__ == "__main__":
    main()

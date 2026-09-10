"""Cross-platform project commands. Uses the local venv, never a global pip."""
from pathlib import Path
import os
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
PYTHON = ROOT / ".venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
NPM = "npm.cmd" if os.name == "nt" else "npm"


def run(args, cwd=ROOT):
    subprocess.run([str(arg) for arg in args], cwd=cwd, check=True)


def main():
    if not PYTHON.exists():
        raise SystemExit("Create .venv and install backend/requirements.txt first; see README.md")
    command = sys.argv[1] if len(sys.argv) > 1 else "quality"
    if command == "backend":
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
        raise SystemExit("Use backend, contracts or quality")


if __name__ == "__main__":
    main()

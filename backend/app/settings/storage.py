"""User-scoped configuration. Never stores projects or model conversations."""
import json
import os
from pathlib import Path
import sys
import tempfile
from dataclasses import asdict, replace

from . import Settings


def config_directory(platform=None, env=None, home=None):
    platform, env, home = platform or sys.platform, os.environ if env is None else env, Path.home() if home is None else Path(home)
    if platform == "win32":
        base = Path(env.get("APPDATA", home / "AppData" / "Roaming"))
    elif platform == "darwin":
        base = home / "Library" / "Application Support"
    else:
        base = Path(env.get("XDG_CONFIG_HOME", home / ".config"))
        if not base.is_absolute():
            base = home / ".config"
    return base / "biaoshu2"


def load_settings(directory=None):
    path = (Path(directory) if directory else config_directory()) / "settings.json"
    if path.exists():
        settings = Settings(**json.loads(path.read_text(encoding="utf-8")))
        # Allow an explicit launch-time budget to override an older saved value.
        # Keep provider credentials and other saved preferences unchanged.
        if "BIAOSHU_TIMEOUT" in os.environ:
            settings = replace(settings, timeout=float(os.environ["BIAOSHU_TIMEOUT"]))
        return settings
    return Settings.from_env()


def save_settings(settings, directory=None):
    root = Path(directory) if directory else config_directory()
    root.mkdir(parents=True, exist_ok=True, mode=0o700)
    if root.is_symlink():
        raise ValueError("配置目录不能是符号链接")
    fd, temporary = tempfile.mkstemp(prefix=".settings-", suffix=".tmp", dir=root)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as file:
            json.dump(asdict(settings), file, ensure_ascii=False, indent=2)
            file.flush()
            os.fsync(file.fileno())
        os.replace(temporary, root / "settings.json")
    finally:
        Path(temporary).unlink(missing_ok=True)

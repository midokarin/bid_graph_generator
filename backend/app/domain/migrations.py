"""Pure migration boundary. No file I/O; Demo snapshots are not project files."""
from .contracts import ProjectFile


def migrate_project(value: dict) -> tuple[ProjectFile, bool]:
    version = value.get("project_file_version")
    if version != "1.0":
        raise ValueError(f"Unsupported project file version {version!r}; this program supports 1.0. An explicit migration or newer program is required.")
    return ProjectFile.model_validate(value), False

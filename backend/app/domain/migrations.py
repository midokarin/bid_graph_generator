"""Explicit 0.9 compatibility format: 1.0 fields except optional metadata.
No released Demo format is guessed or accepted as a project.
"""
from copy import deepcopy
from .contracts import ProjectFile


def migrate_project(value: dict) -> tuple[ProjectFile, bool]:
    version = value.get("project_file_version")
    if version == "0.9":
        value = deepcopy(value)
        value["project_file_version"] = "1.0"
        value.setdefault("metadata", {})
        return ProjectFile.model_validate(value), True
    if version != "1.0":
        raise ValueError(f"项目文件版本 {version!r} 不受支持；需要支持该版本的程序，当前仅支持 1.0。")
    return ProjectFile.model_validate(value), False

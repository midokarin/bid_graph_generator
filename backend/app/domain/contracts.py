from typing import Annotated, Literal

from pydantic import BaseModel, BeforeValidator, ConfigDict, Field, JsonValue, model_validator

from .limits import MAX_COORD, MAX_FLOW_NODES, MAX_LABEL, MAX_SOURCE, MAX_SUMMARY, MAX_TIME, MAX_TITLE

ID = Annotated[str, Field(min_length=1, max_length=80, pattern=r"^[A-Za-z0-9_-]+$")]
Text = Annotated[str, Field(min_length=1, max_length=MAX_LABEL, pattern=r"\S")]
Title = Annotated[str, Field(min_length=1, max_length=MAX_TITLE, pattern=r"\S")]
Summary = Annotated[str, Field(min_length=1, max_length=MAX_SUMMARY, pattern=r"\S")]
NonNegative = Annotated[float, Field(ge=0, le=MAX_COORD)]
Positive = Annotated[float, Field(gt=0, le=MAX_COORD)]
Time = Annotated[float, Field(ge=0, le=MAX_TIME)]
Color = Annotated[str, Field(pattern=r"^#[0-9a-fA-F]{6}$")]
Direction = Literal["DOWN", "RIGHT"]


def json_integer(value):
    # JSON/JavaScript has no lexical distinction between 1 and 1.0.
    # Preserve integer semantics without coercing strings or booleans.
    if isinstance(value, float) and value.is_integer():
        return int(value)
    return value


Level = Annotated[int, Field(ge=0, le=MAX_FLOW_NODES), BeforeValidator(json_integer)]
Row = Annotated[int, Field(ge=0), BeforeValidator(json_integer)]
Revision = Annotated[int, Field(ge=1), BeforeValidator(json_integer)]
Timestamp = Annotated[str, Field(
    pattern=r"^[0-9]{4}-[0-9]{2}-[0-9]{2}T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](\.[0-9]+)?(Z|[+-]([01][0-9]|2[0-3]):[0-5][0-9])$",
    json_schema_extra={"format": "date-time"},
)]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, allow_inf_nan=False)


def unique(items, label):
    ids = [item.id for item in items]
    if len(ids) != len(set(ids)):
        raise ValueError(f"duplicate {label} ID")
    return set(ids)


class FlowNode(StrictModel):
    id: ID
    type: Literal["start", "end", "process", "decision", "document", "subprocess"]
    text: Text
    level: Level
    owner: Text | None
    phase: Text | None


class FlowEdge(StrictModel):
    id: ID
    source: ID
    target: ID
    label: Text | None
    kind: Literal["normal", "rework"]


class FlowchartSpec(StrictModel):
    model_config = ConfigDict(json_schema_extra={"x-domain": "flowchart"})
    schema_version: Literal["1.0"]
    diagram_type: Literal["flowchart"]
    title: Title
    direction: Direction
    nodes: Annotated[list[FlowNode], Field(min_length=1, max_length=MAX_FLOW_NODES)]
    edges: list[FlowEdge]

    @model_validator(mode="after")
    def graph(self):
        nodes = unique(self.nodes, "node")
        unique(self.edges, "edge")
        if any(e.source not in nodes or e.target not in nodes for e in self.edges):
            raise ValueError("dangling flow edge")
        return self


class GanttTask(StrictModel):
    model_config = ConfigDict(json_schema_extra={"x-domain": "task"})
    id: ID
    text: Text
    kind: Literal["task", "milestone"]
    duration: Time
    earliest_start: Time | None

    @model_validator(mode="after")
    def duration_kind(self):
        if (self.kind == "milestone") != (self.duration == 0):
            raise ValueError("milestone must have zero duration; task must have positive duration")
        return self


class GanttDependency(StrictModel):
    id: ID
    source: ID
    target: ID
    type: Literal["FS"]
    lag: Annotated[float, Field(ge=-MAX_TIME, le=MAX_TIME)]


class GanttSpec(StrictModel):
    model_config = ConfigDict(json_schema_extra={"x-domain": "gantt"})
    schema_version: Literal["1.0"]
    diagram_type: Literal["gantt"]
    title: Title
    time_unit: Literal["calendar_day", "week", "month"]
    tasks: Annotated[list[GanttTask], Field(min_length=1)]
    dependencies: list[GanttDependency]

    @model_validator(mode="after")
    def graph(self):
        ids = unique(self.tasks, "task")
        unique(self.dependencies, "dependency")
        following = {key: [] for key in ids}
        incoming = dict.fromkeys(ids, 0)
        for edge in self.dependencies:
            if edge.source not in ids or edge.target not in ids:
                raise ValueError("dangling gantt dependency")
            following[edge.source].append(edge.target)
            incoming[edge.target] += 1
        queue = [key for key in ids if incoming[key] == 0]
        seen = 0
        while queue:
            key = queue.pop()
            seen += 1
            for target in following[key]:
                incoming[target] -= 1
                if incoming[target] == 0:
                    queue.append(target)
        if seen != len(ids):
            raise ValueError("gantt dependency cycle")
        return self


class Supplement(StrictModel):
    target_type: Literal["node", "edge", "task", "dependency"]
    target_id: ID
    reason: Text
    question: Text


def check_supplements(spec, supplements):
    groups = ({"node": spec.nodes, "edge": spec.edges} if isinstance(spec, FlowchartSpec)
              else {"task": spec.tasks, "dependency": spec.dependencies})
    for item in supplements:
        if item.target_id not in {v.id for v in groups.get(item.target_type, [])}:
            raise ValueError("dangling or wrong-kind supplement target")


class FlowchartResult(StrictModel):
    model_config = ConfigDict(json_schema_extra={"x-domain": "result"})
    spec: FlowchartSpec
    supplements: list[Supplement]
    summary: Summary

    @model_validator(mode="after")
    def references(self):
        check_supplements(self.spec, self.supplements)
        return self


class GanttResult(StrictModel):
    model_config = ConfigDict(json_schema_extra={"x-domain": "result"})
    spec: GanttSpec
    supplements: list[Supplement]
    summary: Summary

    @model_validator(mode="after")
    def references(self):
        check_supplements(self.spec, self.supplements)
        return self


class Point(StrictModel):
    x: NonNegative
    y: NonNegative


class NodeGeometry(Point):
    id: ID
    width: Positive
    height: Positive


class EdgeGeometry(StrictModel):
    id: ID
    points: Annotated[list[Point], Field(min_length=2)]
    label_position: Point | None


class FlowLayout(StrictModel):
    diagram_type: Literal["flowchart"]
    direction: Direction
    width: Positive
    height: Positive
    nodes: list[NodeGeometry]
    edges: list[EdgeGeometry]


class ScheduledTask(StrictModel):
    model_config = ConfigDict(json_schema_extra={"x-domain": "scheduled_task"})
    id: ID
    start: Time
    end: Time
    row: Row

    @model_validator(mode="after")
    def ordered(self):
        if self.end < self.start:
            raise ValueError("end precedes start")
        return self


class GanttLayout(StrictModel):
    diagram_type: Literal["gantt"]
    width: Positive
    height: Positive
    tasks: list[ScheduledTask]


class Style(StrictModel):
    template: Text
    font_family: Text
    font_size: Annotated[float, Field(ge=8, le=72)]
    text_color: Color
    stroke_color: Color
    fill_color: Color
    background_color: Color
    transparent_background: bool
    stroke_width: Annotated[float, Field(ge=0.5, le=10)]
    corner_radius: Annotated[float, Field(ge=0, le=50)]
    # Optional additions preserve the appearance of existing 1.0 projects.
    font_weight: Literal[400, 600, 700] = 400
    border_style: Literal["solid", "dashed"] = "solid"
    node_accent: Literal["none", "top", "left"] = "none"
    gantt_bar_style: Literal["solid", "outline", "hatched"] = "solid"
    gantt_grid: Literal["full", "rows", "banded"] = "full"


class VersionSnapshot(StrictModel):
    model_config = ConfigDict(json_schema_extra={"x-domain": "snapshot"})
    revision: Revision
    created_at: Timestamp
    origin: Literal["ai", "text", "position", "style", "template", "relayout", "restore"]
    spec: Annotated[FlowchartSpec | GanttSpec, Field(discriminator="diagram_type")]
    layout: Annotated[FlowLayout | GanttLayout, Field(discriminator="diagram_type")]
    style: Style
    supplements: list[Supplement]
    summary: Summary

    @model_validator(mode="after")
    def coherent(self):
        from datetime import datetime
        datetime.fromisoformat(self.created_at.replace("Z", "+00:00"))
        if self.spec.diagram_type != self.layout.diagram_type:
            raise ValueError("layout kind mismatch")
        check_supplements(self.spec, self.supplements)
        if isinstance(self.spec, FlowchartSpec):
            if self.spec.direction != self.layout.direction:
                raise ValueError("layout direction mismatch")
            if unique(self.layout.nodes, "geometry") != {n.id for n in self.spec.nodes}:
                raise ValueError("node geometry coverage mismatch")
            if unique(self.layout.edges, "geometry") != {e.id for e in self.spec.edges}:
                raise ValueError("edge geometry coverage mismatch")
            if any(n.x + n.width > self.layout.width or n.y + n.height > self.layout.height for n in self.layout.nodes):
                raise ValueError("node geometry outside canvas")
            if any(p.x > self.layout.width or p.y > self.layout.height for e in self.layout.edges for p in e.points + ([e.label_position] if e.label_position else [])):
                raise ValueError("edge geometry outside canvas")
        else:
            if unique(self.layout.tasks, "schedule") != {t.id for t in self.spec.tasks}:
                raise ValueError("schedule coverage mismatch")
        return self


class ProjectFile(StrictModel):
    model_config = ConfigDict(json_schema_extra={"x-domain": "project"})
    project_file_version: Literal["1.0"]
    diagram_type: Literal["flowchart", "gantt"]
    source_text: Annotated[str, Field(max_length=MAX_SOURCE)]
    current_revision: Revision
    versions: Annotated[list[VersionSnapshot], Field(min_length=1)]
    metadata: dict[str, JsonValue]

    @model_validator(mode="after")
    def revisions(self):
        revisions = [v.revision for v in self.versions]
        if revisions != sorted(set(revisions)) or self.current_revision not in revisions:
            raise ValueError("invalid revision chain or current revision")
        if any(v.spec.diagram_type != self.diagram_type for v in self.versions):
            raise ValueError("project diagram kind mismatch")
        return self


class GenerationRequest(StrictModel):
    diagram_type: Literal["flowchart", "gantt"]
    source_text: Annotated[str, Field(min_length=1, max_length=MAX_SOURCE, pattern=r"\S")]
    direction: Direction = "DOWN"
    additional_requirements: Annotated[str, Field(max_length=MAX_SOURCE)] = ""
    flow_variant: Literal["default", "mainline", "branches", "stages"] = "default"

    @model_validator(mode="after")
    def variant_kind(self):
        if self.diagram_type != "flowchart" and self.flow_variant != "default":
            raise ValueError("flow_variant is only available for flowcharts")
        return self


RESULT_MODELS = {"flowchart": FlowchartResult, "gantt": GanttResult}
EXPORT_MODELS = [FlowchartSpec, GanttSpec, FlowchartResult, GanttResult, ProjectFile, GenerationRequest]

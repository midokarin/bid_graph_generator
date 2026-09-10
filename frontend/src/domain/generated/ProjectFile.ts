/* Generated from Pydantic JSON Schema. Do not edit. */

export type ProjectFileVersion = "1.0";
export type DiagramType = "flowchart" | "gantt";
export type SourceText = string;
export type CurrentRevision = number;
/**
 * @minItems 1
 */
export type Versions = [VersionSnapshot, ...VersionSnapshot[]];
export type Revision = number;
export type CreatedAt = string;
export type Origin = "ai" | "text" | "position" | "style" | "template" | "relayout" | "restore";
export type Spec = FlowchartSpec | GanttSpec;
export type SchemaVersion = "1.0";
export type DiagramType1 = "flowchart";
export type Title = string;
export type Direction = "DOWN" | "RIGHT";
/**
 * @minItems 1
 * @maxItems 20
 */
export type Nodes =
  | [FlowNode]
  | [FlowNode, FlowNode]
  | [FlowNode, FlowNode, FlowNode]
  | [FlowNode, FlowNode, FlowNode, FlowNode]
  | [FlowNode, FlowNode, FlowNode, FlowNode, FlowNode]
  | [FlowNode, FlowNode, FlowNode, FlowNode, FlowNode, FlowNode]
  | [FlowNode, FlowNode, FlowNode, FlowNode, FlowNode, FlowNode, FlowNode]
  | [FlowNode, FlowNode, FlowNode, FlowNode, FlowNode, FlowNode, FlowNode, FlowNode]
  | [FlowNode, FlowNode, FlowNode, FlowNode, FlowNode, FlowNode, FlowNode, FlowNode, FlowNode]
  | [FlowNode, FlowNode, FlowNode, FlowNode, FlowNode, FlowNode, FlowNode, FlowNode, FlowNode, FlowNode]
  | [FlowNode, FlowNode, FlowNode, FlowNode, FlowNode, FlowNode, FlowNode, FlowNode, FlowNode, FlowNode, FlowNode]
  | [
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode
    ]
  | [
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode
    ]
  | [
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode
    ]
  | [
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode
    ]
  | [
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode
    ]
  | [
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode
    ]
  | [
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode
    ]
  | [
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode
    ]
  | [
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode,
      FlowNode
    ];
export type Id = string;
export type Type = "start" | "end" | "process" | "decision" | "document" | "subprocess";
export type Text = string;
export type Level = number;
export type Owner = string | null;
export type Phase = string | null;
export type Id1 = string;
export type Source = string;
export type Target = string;
export type Label = string | null;
export type Kind = "normal" | "rework";
export type Edges = FlowEdge[];
export type SchemaVersion1 = "1.0";
export type DiagramType2 = "gantt";
export type Title1 = string;
export type TimeUnit = "calendar_day" | "week" | "month";
/**
 * @minItems 1
 */
export type Tasks = [GanttTask, ...GanttTask[]];
export type Id2 = string;
export type Text1 = string;
export type Kind1 = "task" | "milestone";
export type Duration = number;
export type EarliestStart = number | null;
export type Id3 = string;
export type Source1 = string;
export type Target1 = string;
export type Type1 = "FS";
export type Lag = number;
export type Dependencies = GanttDependency[];
export type Layout = FlowLayout | GanttLayout;
export type DiagramType3 = "flowchart";
export type Direction1 = "DOWN" | "RIGHT";
export type Width = number;
export type Height = number;
export type X = number;
export type Y = number;
export type Id4 = string;
export type Width1 = number;
export type Height1 = number;
export type Nodes1 = NodeGeometry[];
export type Id5 = string;
/**
 * @minItems 2
 */
export type Points = [Point, Point, ...Point[]];
export type X1 = number;
export type Y1 = number;
export type Edges1 = EdgeGeometry[];
export type DiagramType4 = "gantt";
export type Width2 = number;
export type Height2 = number;
export type Id6 = string;
export type Start = number;
export type End = number;
export type Row = number;
export type Tasks1 = ScheduledTask[];
export type Template = string;
export type FontFamily = string;
export type FontSize = number;
export type TextColor = string;
export type StrokeColor = string;
export type FillColor = string;
export type BackgroundColor = string;
export type TransparentBackground = boolean;
export type StrokeWidth = number;
export type CornerRadius = number;
export type TargetType = "node" | "edge" | "task" | "dependency";
export type TargetId = string;
export type Reason = string;
export type Question = string;
export type Supplements = Supplement[];
export type Summary = string;
export type JsonValue = unknown;

export interface ProjectFile {
  project_file_version: ProjectFileVersion;
  diagram_type: DiagramType;
  source_text: SourceText;
  current_revision: CurrentRevision;
  versions: Versions;
  metadata: Metadata;
}
export interface VersionSnapshot {
  revision: Revision;
  created_at: CreatedAt;
  origin: Origin;
  spec: Spec;
  layout: Layout;
  style: Style;
  supplements: Supplements;
  summary: Summary;
}
export interface FlowchartSpec {
  schema_version: SchemaVersion;
  diagram_type: DiagramType1;
  title: Title;
  direction: Direction;
  nodes: Nodes;
  edges: Edges;
}
export interface FlowNode {
  id: Id;
  type: Type;
  text: Text;
  level: Level;
  owner: Owner;
  phase: Phase;
}
export interface FlowEdge {
  id: Id1;
  source: Source;
  target: Target;
  label: Label;
  kind: Kind;
}
export interface GanttSpec {
  schema_version: SchemaVersion1;
  diagram_type: DiagramType2;
  title: Title1;
  time_unit: TimeUnit;
  tasks: Tasks;
  dependencies: Dependencies;
}
export interface GanttTask {
  id: Id2;
  text: Text1;
  kind: Kind1;
  duration: Duration;
  earliest_start: EarliestStart;
}
export interface GanttDependency {
  id: Id3;
  source: Source1;
  target: Target1;
  type: Type1;
  lag: Lag;
}
export interface FlowLayout {
  diagram_type: DiagramType3;
  direction: Direction1;
  width: Width;
  height: Height;
  nodes: Nodes1;
  edges: Edges1;
}
export interface NodeGeometry {
  x: X;
  y: Y;
  id: Id4;
  width: Width1;
  height: Height1;
}
export interface EdgeGeometry {
  id: Id5;
  points: Points;
  label_position: Point | null;
}
export interface Point {
  x: X1;
  y: Y1;
}
export interface GanttLayout {
  diagram_type: DiagramType4;
  width: Width2;
  height: Height2;
  tasks: Tasks1;
}
export interface ScheduledTask {
  id: Id6;
  start: Start;
  end: End;
  row: Row;
}
export interface Style {
  template: Template;
  font_family: FontFamily;
  font_size: FontSize;
  text_color: TextColor;
  stroke_color: StrokeColor;
  fill_color: FillColor;
  background_color: BackgroundColor;
  transparent_background: TransparentBackground;
  stroke_width: StrokeWidth;
  corner_radius: CornerRadius;
}
export interface Supplement {
  target_type: TargetType;
  target_id: TargetId;
  reason: Reason;
  question: Question;
}
export interface Metadata {
  [k: string]: JsonValue;
}

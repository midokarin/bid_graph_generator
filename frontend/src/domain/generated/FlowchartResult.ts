/* Generated from Pydantic JSON Schema. Do not edit. */

export type SchemaVersion = "1.0";
export type DiagramType = "flowchart";
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
export type TargetType = "node" | "edge" | "task" | "dependency";
export type TargetId = string;
export type Reason = string;
export type Question = string;
export type Supplements = Supplement[];
export type Summary = string;

export interface FlowchartResult {
  spec: FlowchartSpec;
  supplements: Supplements;
  summary: Summary;
}
export interface FlowchartSpec {
  schema_version: SchemaVersion;
  diagram_type: DiagramType;
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
export interface Supplement {
  target_type: TargetType;
  target_id: TargetId;
  reason: Reason;
  question: Question;
}

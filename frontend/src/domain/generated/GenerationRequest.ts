/* Generated from Pydantic JSON Schema. Do not edit. */

export type DiagramType = "flowchart" | "gantt";
export type SourceText = string;
export type Direction = "DOWN" | "RIGHT";
export type AdditionalRequirements = string;

export interface GenerationRequest {
  diagram_type: DiagramType;
  source_text: SourceText;
  direction?: Direction;
  additional_requirements?: AdditionalRequirements;
}

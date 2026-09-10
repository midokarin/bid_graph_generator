/* Generated from Pydantic JSON Schema. Do not edit. */

export type SchemaVersion = "1.0";
export type DiagramType = "gantt";
export type Title = string;
export type TimeUnit = "calendar_day" | "week" | "month";
/**
 * @minItems 1
 */
export type Tasks = [GanttTask, ...GanttTask[]];
export type Id = string;
export type Text = string;
export type Kind = "task" | "milestone";
export type Duration = number;
export type EarliestStart = number | null;
export type Id1 = string;
export type Source = string;
export type Target = string;
export type Type = "FS";
export type Lag = number;
export type Dependencies = GanttDependency[];

export interface GanttSpec {
  schema_version: SchemaVersion;
  diagram_type: DiagramType;
  title: Title;
  time_unit: TimeUnit;
  tasks: Tasks;
  dependencies: Dependencies;
}
export interface GanttTask {
  id: Id;
  text: Text;
  kind: Kind;
  duration: Duration;
  earliest_start: EarliestStart;
}
export interface GanttDependency {
  id: Id1;
  source: Source;
  target: Target;
  type: Type;
  lag: Lag;
}

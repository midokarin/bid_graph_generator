import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import flowSchema from '../../../packages/contracts/schemas/FlowchartResult.json';
import ganttSchema from '../../../packages/contracts/schemas/GanttResult.json';
import projectSchema from '../../../packages/contracts/schemas/ProjectFile.json';
import type { FlowchartResult } from './generated/FlowchartResult';
import type { GanttResult } from './generated/GanttResult';
import type { FlowchartSpec, GanttSpec, GanttTask, ScheduledTask, VersionSnapshot, ProjectFile, Supplement } from './generated/ProjectFile';

function unique(items: {id: string}[]): Set<string> {
  const ids = new Set(items.map(item => item.id));
  if (ids.size !== items.length) throw new Error('duplicate ID');
  return ids;
}

function graph(spec: FlowchartSpec | GanttSpec): boolean {
  const isFlow = spec.diagram_type === 'flowchart';
  const ids = unique(isFlow ? spec.nodes : spec.tasks);
  const edges = isFlow ? spec.edges : spec.dependencies;
  unique(edges);
  if (edges.some(edge => !ids.has(edge.source) || !ids.has(edge.target))) return false;
  if (isFlow) return true;
  const incoming = new Map([...ids].map(id => [id, 0]));
  const following = new Map([...ids].map(id => [id, [] as string[]]));
  for (const edge of edges) {
    incoming.set(edge.target, incoming.get(edge.target)! + 1);
    following.get(edge.source)!.push(edge.target);
  }
  const queue = [...ids].filter(id => incoming.get(id) === 0);
  let seen = 0;
  while (queue.length) {
    const id = queue.pop()!;
    seen++;
    for (const target of following.get(id)!) {
      incoming.set(target, incoming.get(target)! - 1);
      if (incoming.get(target) === 0) queue.push(target);
    }
  }
  return seen === ids.size;
}

function supplements(spec: FlowchartSpec | GanttSpec, items: Supplement[]): boolean {
  const groups: Partial<Record<Supplement['target_type'], {id: string}[]>> = spec.diagram_type === 'flowchart'
    ? { node: spec.nodes, edge: spec.edges } : { task: spec.tasks, dependency: spec.dependencies };
  return items.every(item => groups[item.target_type]?.some(target => target.id === item.target_id));
}

function sameIds(left: {id: string}[], right: {id: string}[]): boolean {
  const ids = unique(left);
  return ids.size === right.length && right.every(item => ids.has(item.id));
}

function snapshot(value: VersionSnapshot): boolean {
  const { spec, layout } = value;
  if (Number(value.created_at.slice(0, 4)) < 1) return false;
  if (spec.diagram_type !== layout.diagram_type || !supplements(spec, value.supplements)) return false;
  if (spec.diagram_type === 'flowchart' && layout.diagram_type === 'flowchart') {
    return spec.direction === layout.direction && sameIds(layout.nodes, spec.nodes) && sameIds(layout.edges, spec.edges)
      && layout.nodes.every(n => n.x + n.width <= layout.width && n.y + n.height <= layout.height)
      && layout.edges.every(e => [...e.points, ...(e.label_position ? [e.label_position] : [])]
        .every(p => p.x <= layout.width && p.y <= layout.height));
  }
  return spec.diagram_type === 'gantt' && layout.diagram_type === 'gantt' && sameIds(layout.tasks, spec.tasks);
}

/** JSON Schema cannot express reference integrity or DAGs. These named rules mirror
 * Pydantic's x-domain annotations and run against the same committed fixture corpus.
 * Shape validation and semantic validation are both required before use. */
export function domainRule(rule: string, data: unknown): boolean {
  try {
    switch (rule) {
      case 'flowchart': case 'gantt': return graph(data as FlowchartSpec | GanttSpec);
      case 'task': {
        const task = data as GanttTask;
        return (task.kind === 'milestone') === (task.duration === 0);
      }
      case 'scheduled_task': {
        const task = data as ScheduledTask;
        return task.end >= task.start;
      }
      case 'result': {
        const result = data as FlowchartResult | GanttResult;
        return supplements(result.spec, result.supplements);
      }
      case 'snapshot': return snapshot(data as VersionSnapshot);
      case 'project': {
        const project = data as ProjectFile;
        return project.versions.some(v => v.revision === project.current_revision)
          && project.versions.every((v, i) => v.spec.diagram_type === project.diagram_type
            && (i === 0 || v.revision > project.versions[i - 1].revision));
      }
      default: return false;
    }
  } catch { return false; }
}

export function contractAjv() {
  const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false, coerceTypes: false, useDefaults: false, removeAdditional: false });
  addFormats(ajv);
  // Pydantic emits discriminators as a dispatch hint; oneOf still validates the union.
  ajv.addKeyword({ keyword: 'discriminator', valid: true });
  ajv.addKeyword({ keyword: 'x-domain', schemaType: 'string', validate: domainRule, errors: false });
  return ajv;
}

const ajv = contractAjv();
export const validateFlowchartResult = ajv.compile<FlowchartResult>(flowSchema);
export const validateGanttResult = ajv.compile<GanttResult>(ganttSchema);
export const validateProjectFile = ajv.compile<ProjectFile>(projectSchema);

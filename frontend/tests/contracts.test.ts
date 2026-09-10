import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { contractAjv, validateFlowchartResult, validateGanttResult, validateProjectFile } from '../src/domain/validate';

const root = new URL('../../packages/contracts/', import.meta.url);
const cases = JSON.parse(readFileSync(new URL('cases.json', root), 'utf8')) as {name: string; model: string; valid: boolean; data: unknown}[];
const ajv = contractAjv();
const validators = new Map(readdirSync(new URL('schemas/', root)).map(file => [file.replace('.json', ''), ajv.compile(JSON.parse(readFileSync(new URL('schemas/' + file, root), 'utf8')))]));

for (const item of cases) {
  test(`shared contract: ${item.name}`, () => {
    const before = structuredClone(item.data);
    const validate = validators.get(item.model)!;
    assert.equal(validate(item.data), item.valid, JSON.stringify(validate.errors));
    assert.deepEqual(item.data, before, 'validation must not coerce or mutate input');
  });
}

test('runtime validators narrow unknown JSON to generated TypeScript types', () => {
  const flow: unknown = JSON.parse(readFileSync(new URL('examples/flowchart.json', root), 'utf8'));
  const gantt: unknown = JSON.parse(readFileSync(new URL('examples/gantt.json', root), 'utf8'));
  const project: unknown = JSON.parse(readFileSync(new URL('examples/flowchart-project.json', root), 'utf8'));
  assert.ok(validateFlowchartResult(flow));
  assert.equal(flow.spec.diagram_type, 'flowchart');
  assert.ok(validateGanttResult(gantt));
  assert.equal(gantt.spec.diagram_type, 'gantt');
  assert.ok(validateProjectFile(project));
  assert.equal(project.versions[0].revision, 1);
});

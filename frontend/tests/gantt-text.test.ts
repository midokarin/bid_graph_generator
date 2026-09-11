import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {Diagram} from '../src/Diagram';
import {DEFAULT_STYLE,view} from '../src/model';
import {nextVersion} from '../src/store';
import type {VersionSnapshot} from '../src/domain/generated/ProjectFile';

function version(text:string,font=12):VersionSnapshot {
 const project=JSON.parse(readFileSync(new URL('../../packages/contracts/examples/gantt-project.json',import.meta.url),'utf8'));
 const v=project.versions[0] as VersionSnapshot;
 if(v.spec.diagram_type==='gantt')v.spec.tasks[0].text=text;
 v.style={...DEFAULT_STYLE,font_size:font};
 return v;
}

test('default-size Gantt names wrap to fit instead of blocking version creation',()=>{
 for(const name of ['管理员与业务人员培训','培训组开展管理员与业务人员培训','功能配置开发与数据接口联调测试']){
  const v=version(name),saved=nextVersion([],v);
  assert.deepEqual(saved.spec,v.spec);
  assert.deepEqual(saved.layout,v.layout);
  const svg=renderToStaticMarkup(createElement(Diagram,{snapshot:view(saved)}));
  const label=svg.match(/data-task-id="[^"]+"[^>]*>\s*<text[^>]*>(.*?)<\/text>/s)![1];
  const lines=[...label.matchAll(/<tspan[^>]*>(.*?)<\/tspan>/g)].map(m=>m[1]);
  assert.equal(lines.join(''),name);
  assert.ok(lines.every(line=>Array.from(line).length*12*1.4<=190));
 }
});

test('Gantt wrapping respects newlines and font changes without changing schedule',()=>{
 for(const [text,font] of [['需求确认\n实施设计\n成果复核',12],['管理员与业务人员培训',16],['长'.repeat(44),10]] as const){
  const v=version(text,font);
  assert.deepEqual(nextVersion([],v).layout,v.layout);
 }
});

test('Gantt still rejects excessive text or rows that cannot fit at the chosen font',()=>{
 for(const [text,font] of [['长'.repeat(61),8],['长'.repeat(44),16],['甲\n乙\n丙\n丁\n戊',12],['甲',72]] as const)
  assert.throws(()=>nextVersion([],version(text,font)),/精简/);
});

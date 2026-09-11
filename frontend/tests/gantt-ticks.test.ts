import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {Diagram} from '../src/Diagram';
import {view} from '../src/model';
import {ganttTicks,timeX} from '../src/layout/gantt';
import type {VersionSnapshot} from '../src/domain/generated/ProjectFile';

test('integer schedules use unique whole-unit ticks and retain their exact endpoint',()=>{
 for(let total=1;total<=366;total++){
  const ticks=ganttTicks(total);
  assert.equal(ticks[0],0);
  assert.equal(ticks.at(-1),total);
  assert.ok(ticks.length<=7);
  assert.ok(ticks.every(Number.isInteger));
  assert.ok(ticks.every((n,i)=>i===0||n>ticks[i-1]));
 }
 assert.deepEqual(ganttTicks(61),[0,10,20,31,41,51,61]);
 assert.deepEqual(ganttTicks(0),[0,1]);
 assert.deepEqual(ganttTicks(1),[0,1]);
 assert.deepEqual(ganttTicks(3),[0,1,2,3]);
 assert.equal(ganttTicks(6.125).at(-1),6.125);
});

test('61-day cross-month SVG has integer axis labels without altering tasks or milestones',()=>{
 const project=JSON.parse(readFileSync(new URL('../../packages/contracts/examples/gantt-project.json',import.meta.url),'utf8'));
 const v=project.versions[0] as VersionSnapshot;
 assert.equal(v.spec.diagram_type,'gantt');
 assert.equal(v.layout.diagram_type,'gantt');
 if(v.spec.diagram_type!=='gantt'||v.layout.diagram_type!=='gantt')throw Error('fixture');
 // Inclusive date ranges translated to offsets from October 1, 2026.
 const ranges:[string,number,number][]=[
  ['项目启动与需求调研',0,7],['需求确认及实施设计',7,12],
  ['业务功能配置与开发',12,33],['历史档案清洗与映射',12,26],
  ['服务器环境部署',12,19],['系统集成测试',33,40],
  ['数据迁移演练',40,45],['管理员与业务人员培训',40,44],
  ['生产切换',45,46],['正式上线',46,46],
  ['试运行与问题修复',46,57],['成果核验与项目验收',57,61],['最终验收完成',61,61],
 ];
 v.spec.tasks=ranges.map(([text,start,end],i)=>({id:`t${i}`,text,kind:start===end?'milestone':'task',duration:end-start,earliest_start:start})) as typeof v.spec.tasks;
 v.spec.dependencies=[];
 v.layout.tasks=ranges.map(([,start,end],row)=>({id:`t${row}`,start,end,row}));
 v.layout.height=1500;
 const before=JSON.stringify(v);
 const svg=renderToStaticMarkup(createElement(Diagram,{snapshot:view(v)}));
 const ticks=[...svg.matchAll(/data-time-tick="([^"]+)"[^>]*>(.*?)<\/g>/g)];
 assert.deepEqual(ticks.map(m=>Number(m[1])),[0,10,20,31,41,51,61]);
 for(const [,value,markup] of ticks){
  assert.ok(markup.includes(`x="${timeX(Number(value),61)}"`));
  assert.ok(markup.includes(`>${Number(value)===0?'起点':`${value}天`}</text>`));
 }
 assert.doesNotMatch(svg,/10\.17天|20\.33天|30\.5天|40\.67天|50\.83天/);
 for(const [i,[,start,end]] of ranges.entries())
  assert.ok(svg.includes(`data-task-id="t${i}" data-start="${start}" data-end="${end}"`));
 assert.equal(JSON.stringify(v),before);
});

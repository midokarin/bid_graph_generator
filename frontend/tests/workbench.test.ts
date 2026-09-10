import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ELK from 'elkjs/lib/elk.bundled.js';
import {flowGraph,readLayout} from '../src/layout/flow';
import {applyProposal,DEFAULT_STYLE,moved,view} from '../src/model';
import {nextVersion} from '../src/store';
import {Diagram} from '../src/Diagram';
import {validateProjectFile} from '../src/domain/validate';
import type {FlowchartResult} from '../src/domain/generated/FlowchartResult';
import type {GanttResult} from '../src/domain/generated/GanttResult';
import type {VersionSnapshot} from '../src/domain/generated/ProjectFile';
const read=(name:string)=>JSON.parse(readFileSync(new URL(`../../packages/contracts/examples/${name}.json`,import.meta.url),'utf8'));
const flow=read('flowchart') as FlowchartResult;
const gantt=read('gantt') as GanttResult;
const base=(result:FlowchartResult|GanttResult,layout:VersionSnapshot['layout']):VersionSnapshot=>({...result,layout,style:DEFAULT_STYLE,revision:1,created_at:'2026-09-10T00:00:00Z',origin:'ai'});
test('flow JSON → ELK DOWN/RIGHT → SVG; complete snapshots preserve coordinates and bends',async()=>{
 for(const direction of ['DOWN','RIGHT'] as const){
  const spec={...flow.spec,direction};const layout=readLayout(spec,await new ELK().layout(flowGraph(spec)));
  const version=base({...flow,spec},layout);
  assert.equal(layout.nodes.length,6);assert.equal(layout.edges.length,6);
  for(const edge of layout.edges){
   const connection=spec.edges.find(e=>e.id===edge.id)!;
   for(const [id,index] of [[connection.source,0],[connection.target,edge.points.length-1]] as const){
    if(spec.nodes.find(n=>n.id===id)!.type!=='decision')continue;
    const n=layout.nodes.find(n=>n.id===id)!,p=edge.points[index];
    assert.ok(Math.abs(Math.abs(p.x-n.x-n.width/2)/(n.width/2)+Math.abs(p.y-n.y-n.height/2)/(n.height/2)-1)<1e-6);
   }
  }
  const svg=renderToStaticMarkup(createElement(Diagram,{snapshot:view(version)}));
  for(const kind of ['start','end','process','decision','document','subprocess'])assert.ok(svg.includes(`data-node-type="${kind}"`));
  assert.ok(svg.includes('data-kind="rework"'));assert.ok(!svg.includes('undefined'));
  const reloaded=JSON.parse(JSON.stringify(version));assert.deepEqual(reloaded.layout,layout);
  assert.equal(validateProjectFile({project_file_version:'1.0',diagram_type:'flowchart',source_text:'合成样例',current_revision:1,versions:[reloaded],metadata:{}}),true,JSON.stringify(validateProjectFile.errors));
  const snapshot=view(version);const edited=applyProposal(snapshot,{baseRevision:1,field:'nodeText',target:'n2',before:'执行',after:'执行并记录',impact:''});
  assert.deepEqual(edited.layout,layout);assert.equal(version.spec.diagram_type==='flowchart'&&version.spec.nodes[1]!.text,'执行');
  const styled=applyProposal(snapshot,{baseRevision:1,field:'appearance',before:JSON.stringify(snapshot.appearance),after:JSON.stringify({...snapshot.appearance,strokeColor:'#123456'}),impact:''});assert.deepEqual(styled.layout,layout);
  const node=layout.nodes[0];const dragged=moved(layout,node.id,node.x+5,node.y+5,spec.edges);assert.notDeepEqual(dragged,layout);assert.deepEqual(JSON.parse(JSON.stringify(dragged)),dragged);
  const v2=nextVersion([version],edited),v3=nextVersion([version,v2],{...version,origin:'restore'});
  assert.equal(v3.revision,3);assert.deepEqual(v3.spec,version.spec);assert.deepEqual(v3.layout,version.layout);
 }
});
test('gantt JSON → actual Python schedule → SVG across day/week/month, with long canvas',()=>{
 const script="import json,sys; from app.domain.contracts import GanttResult; from app.domain.scheduling import schedule; print(json.dumps([t.model_dump() for t in schedule(GanttResult.model_validate_json(sys.stdin.read()).spec)]))";
 for(const unit of ['calendar_day','week','month'] as const){
  const result={...gantt,spec:{...gantt.spec,time_unit:unit}};
  const output=execFileSync('../.venv/bin/python',['-c',script],{cwd:'../backend',env:{...process.env},input:JSON.stringify(result),encoding:'utf8'});
  const tasks=JSON.parse(output);assert.equal(tasks[3].start,tasks[3].end);assert.equal(tasks[4].end,7);
  const version=base(result,{diagram_type:'gantt',width:900,height:588,tasks});
  const svg=renderToStaticMarkup(createElement(Diagram,{snapshot:view(version)}));
  assert.ok(svg.includes('0 0 900 588'));assert.equal((svg.match(/data-task-id=/g)??[]).length,5);assert.ok(svg.includes({calendar_day:'日历天',week:'周',month:'月'}[unit]));
 }
});

test('multi-branch layout and readable text bounds',async()=>{
 const spec={...flow.spec,edges:[...flow.spec.edges,{id:'third',source:'n3',target:'n6',label:'无需报告',kind:'normal' as const}]};
 const layout=readLayout(spec,await new ELK().layout(flowGraph(spec)));
 assert.equal(layout.edges.length,7);
 const version=base({...flow,spec},layout);
 const long=structuredClone(version);if(long.spec.diagram_type==='flowchart')long.spec.nodes[0].text='长'.repeat(61);
 assert.throws(()=>nextVersion([version],long),/精简/);
});

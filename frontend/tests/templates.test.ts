import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {Diagram} from '../src/Diagram';
import {applyProposal,DEFAULT_APPEARANCE,view} from '../src/model';
import {templatesFor,templateProposal} from '../src/templates';
import {parseProject} from '../src/project/files';
import {svgText,DEFAULT_EXPORT} from '../src/project/export';
import {nextVersion} from '../src/store';
import {flowGraph,readLayout} from '../src/layout/flow';
import ELK from 'elkjs/lib/elk.bundled.js';
const read=(kind:string)=>parseProject(readFileSync(new URL(`../../packages/contracts/examples/${kind}-project.json`,import.meta.url),'utf8')).project;

test('scene templates preserve business data, positions and history through project reopen and SVG export',async()=>{
 for(const kind of ['flowchart','gantt'] as const){
  const project=read(kind),base=project.versions[0];
  base.style.font_size=12;
  if(base.spec.diagram_type==='flowchart')base.layout=readLayout(base.spec,await new ELK().layout(flowGraph(base.spec)));
  const original=structuredClone(project),snapshot=view(base);
  assert.deepEqual(snapshot.appearance,DEFAULT_APPEARANCE);
  for(const template of templatesFor(kind)){
   const candidate=applyProposal(snapshot,templateProposal(snapshot,template.id));
   const next=nextVersion(project.versions,candidate);
   assert.deepEqual(next.spec,base.spec);assert.deepEqual(next.layout,base.layout);assert.deepEqual(next.supplements,base.supplements);
   assert.equal(next.origin,'template');assert.equal(next.style.template,template.id);
   const reopened=parseProject(JSON.stringify({...project,versions:[...project.versions,next],current_revision:next.revision})).project;
   const selected=view(reopened.versions.at(-1)!);
   assert.deepEqual(selected.appearance,template.appearance);
   const svg=await svgText(selected,DEFAULT_EXPORT);
   assert.ok(!svg.includes('undefined'));assert.ok(svg.includes(`font-weight:${template.appearance.fontWeight}`));
  }
  assert.deepEqual(project,original);
 }
});
test('non-color choices render actual emphasis, dash patterns, hatch bars and table bands',()=>{
 const render=(kind:string,id:string)=>renderToStaticMarkup(createElement(Diagram,{snapshot:view(applyProposal(view(read(kind).versions[0]),templateProposal(view(read(kind).versions[0]),id)))}));
 assert.match(render('flowchart','technical'),/data-node-accent="top"/);
 assert.match(render('flowchart','delivery'),/data-node-accent="left"/);
 assert.match(render('flowchart','review'),/stroke-dasharray="8 5"/);
 assert.match(render('gantt','schedule-print'),/fill="url\(#[^"]+"[^>]+data-bar-style="hatched"/);
 assert.match(render('gantt','schedule-report'),/data-row-band=/);
 assert.match(render('gantt','print'),/fill="none"[^>]+data-bar-style="outline"/);
 const snapshot=view(read('flowchart').versions[0]);
 assert.throws(()=>templateProposal(snapshot,'schedule-print'),/不支持/);
 for(const patch of [{fontWeight:900},{borderStyle:'bad'},{nodeAccent:'bad'},{ganttBarStyle:'bad'},{ganttGrid:'bad'}]){
  assert.throws(()=>applyProposal(snapshot,{baseRevision:snapshot.revision,field:'appearance',before:JSON.stringify(snapshot.appearance),after:JSON.stringify({...snapshot.appearance,...patch}),impact:''}),/无效/);
 }
});

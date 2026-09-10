import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseProject,writeProject,type ProjectHandle} from '../src/project/files';
import {useWorkspace} from '../src/store';
import {svgText,dimensions,DEFAULT_EXPORT} from '../src/project/export';
import {view} from '../src/model';
const original=readFileSync(new URL('../../packages/contracts/examples/flowchart-project.json',import.meta.url),'utf8');
test('explicit migration preserves layouts and rejects unknown/future data',()=>{
 const raw=JSON.parse(original),old={...raw,project_file_version:'0.9'};delete old.metadata;
 const migrated=parseProject(JSON.stringify(old));assert.equal(migrated.migrated,true);assert.deepEqual(migrated.project.versions,raw.versions);
 assert.throws(()=>parseProject(JSON.stringify({...old,unknown:1})),/校验失败/);
 assert.throws(()=>parseProject(JSON.stringify({...raw,project_file_version:'99.0'})),/99.0/);
 assert.deepEqual(parseProject(original).project,raw);
});
test('write only succeeds after close; failure and cancelled picker retain dirty state',async()=>{
 const project=parseProject(original).project;useWorkspace.getState().load(project,true);
 Object.assign(globalThis,{window:{showSaveFilePicker:async()=>{throw new DOMException('cancel','AbortError')}}});
 await assert.rejects(writeProject(project,null));assert.equal(useWorkspace.getState().dirty,true);
 let written='',closed=false,aborted=false;
 const handle:ProjectHandle={name:'test.json',async getFile(){throw new Error('unused')},async createWritable(){return {async write(text:string){written=text},async close(){throw new Error('disk full')},async abort(){aborted=true}}}};
 await assert.rejects(writeProject(project,handle),/disk full/);assert.equal(aborted,true);assert.equal(useWorkspace.getState().dirty,true);
 handle.createWritable=async()=>({async write(text:string){written=text},async close(){closed=true},async abort(){}});
 const saved=await writeProject(project,handle);assert.equal(saved.confirmed,true);assert.equal(saved.handle,handle);assert.equal(closed,true);assert.deepEqual(JSON.parse(written),project);
});
test('paper SVG shares diagram geometry, omits source/metadata and supports all export options',async()=>{
 const project=parseProject(original).project,snapshot=view(project.versions[0]);
 for(const paper of ['A4','A3'] as const)for(const orientation of ['portrait','landscape'] as const)for(const includeTitle of [false,true])for(const background of ['white','transparent','custom'] as const){
  const options={...DEFAULT_EXPORT,paper,orientation,includeTitle,background,color:'#abc123'},svg=await svgText(snapshot,options),d=dimensions(snapshot,options);
  assert.ok(svg.includes(`width="${d.width}"`));assert.ok(!svg.includes('source_text'));assert.ok(!svg.includes('metadata'));assert.ok(!svg.includes('foreignObject'));
  assert.equal(svg.includes('font-weight="600"'),includeTitle);
  if(background==='custom')assert.ok(svg.includes('fill="#abc123"'));
  if(snapshot.version.layout.diagram_type==='flowchart')for(const edge of snapshot.version.layout.edges)assert.ok(svg.includes(edge.points.map((p,i)=>`${i?'L':'M'}${p.x} ${p.y}`).join(' ')));
 }
});
test('switching kinds preserves selected revision and unsaved status',()=>{
 const p=parseProject(readFileSync(new URL('../../packages/contracts/examples/gantt-project.json',import.meta.url),'utf8')).project,state=useWorkspace.getState();state.load(p,false);state.append({...p.versions[0],origin:'restore'});const newest=useWorkspace.getState().activeRevision;state.select(p.current_revision);state.activate('flowchart');state.activate('gantt');assert.equal(useWorkspace.getState().activeRevision,p.current_revision);assert.equal(useWorkspace.getState().dirty,true);assert.ok(newest!>p.current_revision);state.markSaved();state.select(p.current_revision);assert.equal(useWorkspace.getState().dirty,false);
});

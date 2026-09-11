import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {view,DEFAULT_STYLE} from '../src/model';
import {adjustment,previewStyle,styleError,DEFAULT_ADJUSTMENT} from '../src/styleDraft';
import {useWorkspace} from '../src/store';
import {parseProject} from '../src/project/files';
import {svgText,DEFAULT_EXPORT} from '../src/project/export';
import {presentationLayout} from '../src/layout/presentation';
import type {ProjectFile,FlowchartSpec} from '../src/domain/generated/ProjectFile';
const fixture=(kind='flowchart'):ProjectFile=>{
 const p=JSON.parse(readFileSync(new URL(`../../packages/contracts/examples/${kind}-project.json`,import.meta.url),'utf8'));
 p.versions[0].style={...DEFAULT_STYLE};
 if(kind==='flowchart'){
  const spec=JSON.parse(readFileSync(new URL('./fixtures/presentation.json',import.meta.url),'utf8')) as FlowchartSpec;
  p.versions[0].spec=spec;p.versions[0].layout=presentationLayout(spec);
 }
 return p;
};

test('style trials leave stored project and dirty state untouched; applying creates just one complete version',()=>{
 const project=fixture(),base=view(project.versions[0]);useWorkspace.getState().load(project,false);
 const before=JSON.stringify(useWorkspace.getState().versions);
 let trial=previewStyle(base,{stroke_width:3})!;
 trial=previewStyle(base,{...adjustment(trial),corner_radius:16,font_size:11})!;
 assert.equal(JSON.stringify(useWorkspace.getState().versions),before);assert.equal(useWorkspace.getState().dirty,false);
 assert.deepEqual(trial.version.spec,base.version.spec);assert.deepEqual(trial.version.layout,base.version.layout);
 assert.equal(styleError(trial),'');
 assert.equal(previewStyle(base,adjustment(base)),null); // reverting every control cancels the pending change
 useWorkspace.getState().append(trial.version);
 const state=useWorkspace.getState();assert.equal(state.versions.length,2);assert.equal(state.activeRevision,2);assert.equal(state.dirty,true);
 assert.equal(JSON.stringify(state.versions[0]),JSON.stringify(base.version));
 assert.equal(state.versions[1].style.stroke_width,3);assert.equal(state.versions[1].style.corner_radius,16);
});

test('oversized text is flagged during preview and rejected on apply without losing the original',()=>{
 const project=fixture(),base=view(project.versions[0]);useWorkspace.getState().load(project,false);
 const trial=previewStyle(base,{font_size:72})!;assert.match(styleError(trial),/字号偏大/);
 assert.throws(()=>useWorkspace.getState().append(trial.version),/精简/);
 assert.equal(useWorkspace.getState().versions.length,1);assert.equal(useWorkspace.getState().dirty,false);
});

test('reset adjusts only the exposed controls and preserves imported colors and additional template fields',()=>{
 const p=fixture();p.versions[0].style={...p.versions[0].style,font_size:11,text_color:'#123456',transparent_background:true};
 const s=view(p.versions[0]),reset=previewStyle(s,DEFAULT_ADJUSTMENT)!;
 assert.equal(reset.appearance.textColor,'#123456');assert.equal(reset.version.style.transparent_background,true);
 for(const [key,value] of Object.entries(s.version.style))if(!['template',...Object.keys(DEFAULT_ADJUSTMENT)].includes(key))assert.deepEqual(reset.version.style[key as keyof typeof reset.version.style],value);
});

test('both chart styles survive project round-trip and reach the shared SVG exporter without moving geometry',async()=>{
 for(const kind of ['flowchart','gantt']){
  const project=fixture(kind),base=view(project.versions[0]),trial=previewStyle(base,{font_family:'Arial',font_size:11,stroke_width:3,corner_radius:16})!;
  assert.equal(styleError(trial),'');
  useWorkspace.getState().load(project,false);useWorkspace.getState().append(trial.version);
  const state=useWorkspace.getState();
  const saved={...project,current_revision:state.activeRevision,versions:state.versions};
  const reopened=parseProject(JSON.stringify(saved)).project.versions[1];
  assert.deepEqual(reopened.layout,base.version.layout);assert.deepEqual(reopened.spec,base.version.spec);
  assert.equal(reopened.style.stroke_width,3);assert.equal(reopened.style.font_family,'Arial');
  const svg=await svgText(view(reopened),DEFAULT_EXPORT);
  assert.ok(svg.includes('stroke-width="3"'));assert.ok(svg.includes('rx="16"'));assert.ok(svg.includes('font-family:Arial'));
 }
});

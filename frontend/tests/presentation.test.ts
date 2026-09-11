import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {presentationLayout} from '../src/layout/presentation';
import {flowGraph,readLayout,wrapText} from '../src/layout/flow';
import {Diagram} from '../src/Diagram';
import {DEFAULT_STYLE,assertReadable,view} from '../src/model';
import {svgText,DEFAULT_EXPORT} from '../src/project/export';
import type {FlowchartSpec,VersionSnapshot} from '../src/domain/generated/ProjectFile';
import ELK from 'elkjs/lib/elk.bundled.js';
const sample=()=>JSON.parse(readFileSync(new URL('./fixtures/presentation.json',import.meta.url),'utf8')) as FlowchartSpec;
const version=(spec:FlowchartSpec):VersionSnapshot=>({spec,layout:presentationLayout(spec)!,style:DEFAULT_STYLE,revision:1,created_at:'2026-09-11T00:00:00Z',origin:'ai',supplements:[],summary:'合成回归样例'});

test('complete Chinese labels survive preview and SVG export without first-character truncation',async()=>{
 const s=sample(),v=version(s);assertReadable(v);
 const preview=renderToStaticMarkup(createElement(Diagram,{snapshot:view(v)}));
 const exported=await svgText(view(v),DEFAULT_EXPORT);
 for(const label of [...s.nodes.map(n=>n.text),...s.edges.map(e=>e.label).filter(Boolean)]){
  assert.ok(preview.includes(`>${label}</text>`),label!);
  assert.ok(exported.includes(`>${label}</text>`),label!);
 }
 assert.deepEqual(wrapText('需求分析与确认'),['需求分析与确认']);
 const long='项目实施质量检查与整改记录'.repeat(3);
 assert.equal(wrapText(long).join(''),long);
});
test('centered spine, side correction loop, orthogonal edges and diamond attachment',()=>{
 const s=sample(),layout=presentationLayout(s)!;
 const decision=layout.nodes.find(n=>n.id==='n4')!,side=layout.nodes.find(n=>n.id==='n7')!;
 assert.equal(decision.x+decision.width/2,layout.width/2);
 assert.equal(side.y+side.height/2,decision.y+decision.height/2);
 assert.ok(side.x>decision.x+decision.width);
 for(const n of layout.nodes){assert.ok(n.x>=0&&n.y>=0&&n.x+n.width<=layout.width&&n.y+n.height<=layout.height);}
 for(const edge of layout.edges){
  for(let i=1;i<edge.points.length;i++){const a=edge.points[i-1],b=edge.points[i];assert.ok(a.x===b.x||a.y===b.y);}
  const end=edge.points.at(-1)!;
  if(s.edges.find(e=>e.id===edge.id)!.target==='n4'){
   assert.ok(Math.abs(Math.abs(end.x-decision.x-decision.width/2)/(decision.width/2)+Math.abs(end.y-decision.y-decision.height/2)/(decision.height/2)-1)<1e-6);
  }
 }
 assert.deepEqual(presentationLayout(s),layout);
});
test('60-character multiline nodes fit their geometry without losing text',()=>{
 const s=sample();s.nodes[1]!.text='长'.repeat(60);s.nodes[4]!.text='检'.repeat(60);
 const v=version(s);assertReadable(v);
 const svg=renderToStaticMarkup(createElement(Diagram,{snapshot:view(v)}));
 assert.equal((svg.match(/长/g)??[]).length,120); // accessible name and visible text
 assert.equal((svg.match(/检/g)??[]).length,121); // plus the return-edge label
});
test('horizontal and multi-branch graphs keep ELK fallback',async()=>{
 for(const spec of [{...sample(),direction:'RIGHT' as const},{...sample(),edges:[...sample().edges,{id:'extra',source:'n1',target:'n5',kind:'normal' as const,label:'提前交付'}]}]){
  assert.equal(presentationLayout(spec),null);
  const layout=readLayout(spec,await new ELK().layout(flowGraph(spec)));
  assert.equal(layout.nodes.length,spec.nodes.length);assert.equal(layout.edges.length,spec.edges.length);
 }
});

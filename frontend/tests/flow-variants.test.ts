import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ELK from 'elkjs/lib/elk.bundled.js';
import type {FlowchartSpec,FlowLayout,VersionSnapshot} from '../src/domain/generated/ProjectFile';
import {optimizedFlowLayout,flowQuality} from '../src/layout/flow-quality';
import {presentationLayout} from '../src/layout/presentation';
import {labelCollisions,placeFlowLabels} from '../src/layout/flow-labels';
import {flowFingerprint} from '../src/layout/flow-similarity';
import {recommendedCandidate} from '../src/candidates';
import {nextVersion} from '../src/store';
import {DEFAULT_STYLE} from '../src/model';
const read=(name:string)=>JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`,import.meta.url),'utf8')) as FlowchartSpec;
const snapshot=(spec:FlowchartSpec,layout:FlowLayout,font=12):VersionSnapshot=>({spec,layout,style:{...DEFAULT_STYLE,font_size:font},origin:'ai',revision:1,created_at:'2026-09-11T00:00:00Z',supplements:[],summary:'合成质量样例'});
for(const name of ['presentation','incident-flow'])for(const direction of ['DOWN','RIGHT'] as const)test(`${name}/${direction}: identical business data yields distinct safe layouts`,async()=>{
 const spec={...read(name),direction},before=structuredClone(spec),elk=new ELK();
 const old=presentationLayout(spec)??await optimizedFlowLayout(spec,g=>elk.layout(g));
 const signatures=new Set<string>();
 for(const profile of ['mainline','branches','stages'] as const){
  let calls=0;
  const layout=await optimizedFlowLayout(spec,g=>{calls++;return elk.layout(g)},undefined,{profile,fontSize:12});
  assert.equal(calls,24);assert.deepEqual(flowQuality(spec,layout,12).slice(0,5),[0,0,0,0,0]);
  assert.ok(layout.width*layout.height<=old.width*old.height*1.6,'diversity must not inflate the canvas excessively');
  const version=nextVersion([],snapshot(spec,layout));
  signatures.add(flowFingerprint(version));assert.deepEqual(spec,before);
  for(const edge of layout.edges)for(let i=1;i<edge.points.length;i++)assert.ok(edge.points[i].x===edge.points[i-1].x||edge.points[i].y===edge.points[i-1].y);
  assert.deepEqual(JSON.parse(JSON.stringify(layout)),layout);
 }
 assert.equal(signatures.size,3,'each candidate must provide a distinct layout on these fixtures');
});

test('larger font grows nodes and reserves long Chinese branch labels without shrinking text',async()=>{
 const spec=read('incident-flow'),elk=new ELK();
 // Keep explicit ordinal prefix so branch ordering remains authoritative.
 spec.edges.find(e=>e.label==='一级')!.label='一级：关键系统不可用';
 const layout=await optimizedFlowLayout(spec,g=>elk.layout(g),undefined,{profile:'branches',fontSize:20});
 const result=nextVersion([],snapshot(spec,layout,20));
 assert.equal(result.style.font_size,20);assert.deepEqual(result.spec,spec);
 assert.equal(flowQuality(spec,layout,20)[1],0);assert.equal(flowQuality(spec,layout,20)[4],0);
});

test('label placement reduces obstruction without changing nodes or connector paths',()=>{
 const spec=read('presentation'),layout=presentationLayout(spec)!;
 const edge=layout.edges.find(e=>e.label_position)!;
 const node=layout.nodes[0];edge.label_position={x:node.x+node.width/2,y:node.y+node.height/2};
 const before=labelCollisions(spec,layout),after=placeFlowLabels(spec,layout);
 assert.ok(before>0);assert.ok(labelCollisions(spec,after)<before);
 assert.deepEqual(after.nodes,layout.nodes);assert.deepEqual(after.edges.map(e=>e.points),layout.edges.map(e=>e.points));
 assert.notDeepEqual(after.edges.find(e=>e.id===edge.id)!.label_position,edge.label_position);
});

test('duplicates ignore generated IDs but different layouts remain distinct; defects suppress recommendation',()=>{
 const spec=read('presentation'),layout=presentationLayout(spec)!,version=snapshot(spec,layout);
 const renamed=structuredClone(version);if(renamed.spec.diagram_type!=='flowchart'||renamed.layout.diagram_type!=='flowchart')throw new Error();
 for(const n of renamed.spec.nodes)n.id='copy_'+n.id;
 for(const e of renamed.spec.edges){e.id='copy_'+e.id;e.source='copy_'+e.source;e.target='copy_'+e.target}
 for(const n of renamed.layout.nodes)n.id='copy_'+n.id;
 for(const e of renamed.layout.edges)e.id='copy_'+e.id;
 renamed.spec.title='不同图题';assert.equal(flowFingerprint(version),flowFingerprint(renamed));
 assert.equal(recommendedCandidate(['mainline','branches'].map(key=>({key:key as 'mainline'|'branches',label:key,status:'success',message:'',attempts:{},snapshot:version,quality:[0,1,0,0,0,2,100,1000]}))),undefined);
});

test('profile optimization still cancels before the next expensive trial',async()=>{
 const control=new AbortController(),elk=new ELK();let count=0;
 await assert.rejects(optimizedFlowLayout(read('incident-flow'),async g=>{count++;const result=await elk.layout(g);control.abort();return result},control.signal,{profile:'stages'}),{name:'AbortError'});
 assert.equal(count,1);
});

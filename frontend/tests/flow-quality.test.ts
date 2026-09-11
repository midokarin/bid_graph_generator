import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ELK from 'elkjs/lib/elk.bundled.js';
import type {FlowchartSpec} from '../src/domain/generated/ProjectFile';
import {branchRank,orderedBranches} from '../src/layout/branch-order';
import {flowGraph,readLayout} from '../src/layout/flow';
import {flowQuality,optimizedFlowLayout} from '../src/layout/flow-quality';

const sample=()=>JSON.parse(readFileSync(new URL('./fixtures/incident-flow.json',import.meta.url),'utf8')) as FlowchartSpec;
test('recognize explicit ordinals without guessing business text order',()=>{
 for(const [text,value] of [['一级',1],['二级',2],['第三级',3],['１０级',10],['二十一级',21],['P0',0],['L2',2],['三、',3]] as const)assert.equal(branchRank(text),value);
 for(const text of ['一般问题','部分功能异常','不能解决','一级或二级',null])assert.equal(branchRank(text),null);
 const s=sample();assert.deepEqual(orderedBranches(s).map(g=>g.map(e=>e.label)),[['一级','二级','三级']]);
 s.edges.find(e=>e.label==='二级')!.label='一级';assert.deepEqual(orderedBranches(s),[]);
});
for(const direction of ['DOWN','RIGHT'] as const)test(`${direction}: incident branches ordered, crossings removed, topology and snapshots preserved`,async()=>{
 const spec={...sample(),direction},original=structuredClone(spec),elk=new ELK();
 // Reproduce the previous unconstrained graph, including its original order.
 const baseline=flowGraph(spec);
 for(const node of baseline.children!){delete node.ports;delete node.layoutOptions}
 for(const edge of baseline.edges!)edge.sources=[spec.edges.find(e=>e.id===edge.id)!.source];
 const before=readLayout(spec,await elk.layout(baseline));
 const after=await optimizedFlowLayout(spec,g=>elk.layout(g));
 assert.ok(flowQuality(spec,before)[2]>0);
 assert.deepEqual(flowQuality(spec,after).slice(0,4),[0,0,0,0]);
 assert.deepEqual(spec,original);
 assert.deepEqual(new Set(after.nodes.map(n=>n.id)),new Set(spec.nodes.map(n=>n.id)));
 assert.deepEqual(new Set(after.edges.map(e=>e.id)),new Set(spec.edges.map(e=>e.id)));
 for(const edge of after.edges)for(let i=1;i<edge.points.length;i++)assert.ok(edge.points[i].x===edge.points[i-1].x||edge.points[i].y===edge.points[i-1].y);
 for(const node of after.nodes)assert.ok(node.x>=0&&node.y>=0&&node.x+node.width<=after.width&&node.y+node.height<=after.height);
 assert.deepEqual(await optimizedFlowLayout(spec,g=>elk.layout(g)),after);
 assert.deepEqual(JSON.parse(JSON.stringify(after)),after);
});
test('cancellation stops candidate search before dispatching another layout',async()=>{
 const controller=new AbortController(),elk=new ELK();let calls=0;
 await assert.rejects(optimizedFlowLayout(sample(),async g=>{calls++;const result=await elk.layout(g);controller.abort();return result},controller.signal),{name:'AbortError'});
 assert.equal(calls,1);
});

for(const direction of ['DOWN','RIGHT'] as const)test(`${direction}: parallel return lines and terminal bends have breathing room`,async()=>{
 const spec={...sample(),direction},elk=new ELK();
 const legacy=await optimizedFlowLayout(spec,g=>{
  // Previous release used ELK's default edge/edge, edge/node and label gaps.
  for(const key of Object.keys(g.layoutOptions!))if(/spacing\.(edgeEdge|edgeNode|edgeLabel)/.test(key))delete g.layoutOptions![key];
  return elk.layout(g);
 });
 const updated=await optimizedFlowLayout(spec,g=>elk.layout(g));
 const returns=spec.edges.filter(e=>e.target==='repair'&&e.kind==='rework');
 assert.equal(returns.length,2);
 const gap=(layout:typeof updated)=>{
  const paths=returns.map(e=>layout.edges.find(a=>a.id===e.id)!.points);
  const axis=direction==='DOWN'?'y':'x',cross=direction==='DOWN'?'x':'y';
  let distance=Infinity;
  for(let i=1;i<paths[0].length;i++)for(let j=1;j<paths[1].length;j++){
   const a=paths[0][i-1],b=paths[0][i],c=paths[1][j-1],d=paths[1][j];
   if(a[cross]!==b[cross]||c[cross]!==d[cross])continue;
   const overlap=Math.min(Math.max(a[axis],b[axis]),Math.max(c[axis],d[axis]))-Math.max(Math.min(a[axis],b[axis]),Math.min(c[axis],d[axis]));
   if(overlap>=100)distance=Math.min(distance,Math.abs(a[cross]-c[cross]));
  }
  return distance;
 };
 assert.ok(Number.isFinite(gap(updated)));
 assert.ok(gap(legacy)<12);assert.ok(gap(updated)>=36);
 for(const edge of returns){const points=updated.edges.find(e=>e.id===edge.id)!.points,a=points.at(-1)!,b=points.at(-2)!;
  assert.ok(Math.abs(a.x-b.x)+Math.abs(a.y-b.y)>=36,'arrow has a straight approach before the last bend');
 }
 assert.deepEqual(flowQuality(spec,updated).slice(0,4),[0,0,0,0]);
 assert.ok(updated.width*updated.height<legacy.width*legacy.height*1.15,'spacing does not need a disproportionate canvas');
});

import type {ElkNode} from 'elkjs/lib/elk-api';
import type {FlowchartSpec,FlowLayout} from '../domain/generated/ProjectFile';
import {orderedBranches} from './branch-order';
import {flowGraph,readLayout} from './flow';
import {crosses} from './connectors';
import {applyFlowProfile,readableNodeSize,flowTextFits,type FlowLayoutOptions} from './flow-profile';
import {labelSize,labelCollisions,placeFlowLabels,intersects} from './flow-labels';
import {presentationLayout} from './presentation';
import {spreadFlowProfile} from './flow-spread';

export function flowQuality(spec:FlowchartSpec,layout:FlowLayout,fontSize=12):number[] {
 const nodes=new Map(layout.nodes.map(n=>[n.id,n]));
 const connections=new Map(spec.edges.map(e=>[e.id,e]));
 let order=0,nodeHits=0,crossings=0,overlaps=0,bends=0,length=0;
 for(const group of orderedBranches(spec)){
  const centers=group.map(e=>{const n=nodes.get(e.target)!;return spec.direction==='DOWN'?n.x+n.width/2:n.y+n.height/2});
  for(let i=1;i<centers.length;i++)if(centers[i]<=centers[i-1])order++;
 }
 const segments=layout.edges.flatMap(edge=>{
  bends+=Math.max(0,edge.points.length-2);
  return edge.points.slice(1).map((b,i)=>({id:edge.id,a:edge.points[i],b}));
 });
 for(const {id,a,b} of segments){
  length+=Math.abs(b.x-a.x)+Math.abs(b.y-a.y);
  const edge=connections.get(id)!;
  for(const node of layout.nodes)if(node.id!==edge.source&&node.id!==edge.target&&crosses(a,b,node))nodeHits++;
 }
 const intersections=new Set<string>();
 for(let i=0;i<segments.length;i++)for(let j=i+1;j<segments.length;j++){
  const s=segments[i],t=segments[j];if(s.id===t.id)continue;
  const sVertical=s.a.x===s.b.x,tVertical=t.a.x===t.b.x;
  if(sVertical!==tVertical){
   const v=sVertical?s:t,h=sVertical?t:s,x=v.a.x,y=h.a.y;
   if(x>Math.min(h.a.x,h.b.x)&&x<Math.max(h.a.x,h.b.x)&&y>Math.min(v.a.y,v.b.y)&&y<Math.max(v.a.y,v.b.y))
    intersections.add(`${s.id}:${t.id}:${x}:${y}`);
  }else{
   const first=connections.get(s.id)!,second=connections.get(t.id)!;
   // Shared trunks into/out of the same node are intentional junctions.
   if(first.source===second.source||first.target===second.target)continue;
   const axis=sVertical?'y':'x',fixed=sVertical?'x':'y';
   if(s.a[fixed]===t.a[fixed])overlaps+=Math.max(0,Math.min(Math.max(s.a[axis],s.b[axis]),Math.max(t.a[axis],t.b[axis]))-Math.max(Math.min(s.a[axis],s.b[axis]),Math.min(t.a[axis],t.b[axis])));
  }
 }
 crossings=intersections.size;
 for(let i=0;i<layout.nodes.length;i++)for(let j=i+1;j<layout.nodes.length;j++)if(intersects(layout.nodes[i],layout.nodes[j]))nodeHits++;
 return [order,nodeHits,crossings,overlaps,labelCollisions(spec,layout,fontSize),bends,length,layout.width*layout.height];
}

const better=(a:number[],b:number[])=>{for(let i=0;i<a.length;i++){if(a[i]!==b[i])return a[i]<b[i]}return false};

// Bounded deterministic search. Single-layout callers retain their original
// search space; multi-candidate callers add two families of profile layouts.
export async function optimizedFlowLayout(spec:FlowchartSpec,run:(graph:ElkNode)=>Promise<ElkNode>,signal?:AbortSignal,options:FlowLayoutOptions={}):Promise<FlowLayout>{
 const pool:{layout:FlowLayout;quality:number[];preferred:boolean}[]=[];
 const add=(raw:FlowLayout,preferred:boolean)=>{
  if(options.profile&&!spec.nodes.every(node=>flowTextFits(node,spec.direction,raw.nodes.find(n=>n.id===node.id)!,options.fontSize)))return;
  const layout=options.profile?placeFlowLabels(spec,raw,options.fontSize):raw;
  pool.push({layout,quality:flowQuality(spec,layout,options.fontSize),preferred});
 };
 if(options.profile){const spine=presentationLayout(spec);if(spine)add(spine,options.profile==='mainline')}
 for(const family of options.profile?['baseline','profile','alternative']:['baseline'])
 for(const cycle of ['GREEDY','DEPTH_FIRST'])for(const feedback of [false,true])for(const seed of [1,7]){
  if(signal?.aborted)throw new DOMException('已取消','AbortError');
  const graph=flowGraph(spec);
  if(options.profile){
   for(const node of graph.children??[])Object.assign(node,readableNodeSize(spec.nodes.find(n=>n.id===node.id)!,spec.direction,options.fontSize));
   // Keep a current-layout baseline, plus two distinct layout families.
   if(family!=='baseline'){
    applyFlowProfile(graph,spec,options.profile);
    if(family==='alternative')Object.assign(graph.layoutOptions!,{
     'elk.layered.nodePlacement.strategy':options.profile==='mainline'?'BRANDES_KOEPF':'NETWORK_SIMPLEX',
     'elk.layered.nodePlacement.bk.fixedAlignment':'NONE',
    });
   }
   for(const edge of graph.edges??[])for(const label of edge.labels??[]){
    const size=labelSize(label.text??'',options.fontSize);label.width=size.width;label.height=size.height;
   }
  }
  Object.assign(graph.layoutOptions!,{'elk.randomSeed':String(seed),'elk.layered.feedbackEdges':String(feedback),
   'elk.layered.cycleBreaking.strategy':cycle});
  const laidOut=await run(graph);
  if(signal?.aborted)throw new DOMException('已取消','AbortError');
  add(readLayout(spec,laidOut),family!=='baseline');
 }
 if(options.profile&&options.profile!=='mainline')for(const candidate of [...pool].filter(c=>!c.preferred))add(spreadFlowProfile(spec,candidate.layout,options.profile),true);
 // Quality wins over novelty: do not buy diversity with additional ordering,
 // node, crossing, overlapping-line or label defects.
 if(!pool.length)throw new Error('节点文字无法清晰排布，请精简文字后重试。');
 const best=pool.reduce((a,b)=>better(b.quality,a.quality)?b:a);
 if(!options.profile)return best.layout;
 const safe=pool.filter(candidate=>candidate.quality.slice(0,5).every((n,i)=>n===best.quality[i]));
 const minBends=Math.min(...safe.map(c=>c.quality[5]));
 const minArea=Math.min(...safe.map(c=>c.layout.width*c.layout.height));
 const preferred=safe.filter(c=>c.preferred&&c.quality[5]<=minBends+2&&c.layout.width*c.layout.height<=minArea*1.6);
 return (preferred.length?preferred.reduce((a,b)=>better(b.quality,a.quality)?b:a):best).layout;
}

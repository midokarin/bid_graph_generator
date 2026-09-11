import type {ElkNode} from 'elkjs/lib/elk-api';
import type {FlowchartSpec,FlowLayout} from '../domain/generated/ProjectFile';
import {orderedBranches} from './branch-order';
import {flowGraph,readLayout} from './flow';
import {crosses} from './connectors';

export function flowQuality(spec:FlowchartSpec,layout:FlowLayout):number[] {
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
 return [order,nodeHits,crossings,overlaps,bends,length,layout.width*layout.height];
}

const better=(a:number[],b:number[])=>{for(let i=0;i<a.length;i++){if(a[i]!==b[i])return a[i]<b[i]}return false};

// Bounded, deterministic search; each expensive layout stays in the caller's
// existing ELK worker, under the same cancellation/timeout budget.
export async function optimizedFlowLayout(spec:FlowchartSpec,run:(graph:ElkNode)=>Promise<ElkNode>,signal?:AbortSignal):Promise<FlowLayout>{
 let best:FlowLayout|undefined,score:number[]|undefined;
 for(const cycle of ['GREEDY','DEPTH_FIRST'])for(const feedback of [false,true])for(const seed of [1,7]){
  if(signal?.aborted)throw new DOMException('已取消','AbortError');
  const graph=flowGraph(spec);
  Object.assign(graph.layoutOptions!,{'elk.randomSeed':String(seed),'elk.layered.feedbackEdges':String(feedback),
   'elk.layered.cycleBreaking.strategy':cycle});
  const laidOut=await run(graph);
  if(signal?.aborted)throw new DOMException('已取消','AbortError');
  const layout=readLayout(spec,laidOut),quality=flowQuality(spec,layout);
  if(!score||better(quality,score)){best=layout;score=quality}
 }
 return best!;
}

import type {FlowLayout,FlowchartSpec} from '../domain/generated/ProjectFile';
import type {FlowProfile} from './flow-profile';
import {orderedBranches} from './branch-order';

function spread(source:FlowLayout,axis:'x'|'y',space:number):FlowLayout {
 const layout=structuredClone(source),dimension=axis==='x'?'width':'height';
 const intervals=layout.nodes.map(n=>[n[axis],n[axis]+n[dimension]]).sort((a,b)=>a[0]-b[0]);
 const merged:number[][]=[];
 for(const interval of intervals){const last=merged.at(-1);if(last&&interval[0]<=last[1])last[1]=Math.max(last[1],interval[1]);else merged.push([...interval])}
 const gaps=merged.slice(1).map((interval,i)=>[merged[i][1],interval[0]]);
 const map=(value:number)=>value+gaps.reduce((sum,[start,end])=>sum+space*Math.max(0,Math.min(1,(value-start)/(end-start))),0);
 for(const node of layout.nodes)node[axis]=map(node[axis]);
 for(const edge of layout.edges){for(const point of edge.points)point[axis]=map(point[axis]);if(edge.label_position)edge.label_position[axis]=map(edge.label_position[axis])}
 layout[dimension]=map(layout[dimension]);return layout;
}

// A safe geometric alternative for graphs whose constraints collapse multiple
// ELK settings to the same result. Node sizes and all edges remain unchanged.
export function spreadFlowProfile(spec:FlowchartSpec,source:FlowLayout,profile:FlowProfile):FlowLayout {
 const main=spec.direction==='DOWN'?'y':'x',cross=main==='x'?'y':'x';
 if(profile==='stages')return spread(source,main,40);
 if(profile==='branches'){
  const centeredDocuments=spec.nodes.filter(n=>n.type==='document').every(node=>{
   const geometry=source.nodes.find(n=>n.id===node.id)!,dimension=cross==='x'?'width':'height';
   return spec.edges.filter(e=>e.source===node.id||e.target===node.id).every(edge=>{
    const points=source.edges.find(e=>e.id===edge.id)!.points,point=edge.source===node.id?points[0]:points.at(-1)!;
    return Math.abs(point[cross]-geometry[cross]-geometry[dimension]/2)<1e-6;
   });
  });
  if(!orderedBranches(spec).length&&centeredDocuments){
   const layout=structuredClone(source),dimension=cross==='x'?'width':'height';
   for(const node of layout.nodes)node[cross]=layout[dimension]-node[cross]-node[dimension];
   for(const edge of layout.edges){for(const point of edge.points)point[cross]=layout[dimension]-point[cross];if(edge.label_position)edge.label_position[cross]=layout[dimension]-edge.label_position[cross]}
   // Mirroring a straight chain cannot create a distinct view; widen spacing.
   const shifted=spread(layout,cross,48);
   return JSON.stringify(shifted.nodes)===JSON.stringify(source.nodes)?spread(source,main,24):shifted;
  }
  const expanded=spread(source,cross,48);
  return JSON.stringify(expanded.nodes)===JSON.stringify(source.nodes)?spread(source,main,24):expanded;
 }
 return structuredClone(source);
}

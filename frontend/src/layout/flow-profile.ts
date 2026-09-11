import type {ElkNode} from 'elkjs/lib/elk-api';
import {nodeSize,flowLines} from './flow';
import type {FlowchartSpec} from '../domain/generated/ProjectFile';
export type FlowProfile='mainline'|'branches'|'stages';
export type FlowLayoutOptions={profile?:FlowProfile;fontSize?:number};

// Profiles change geometry only. They never rewrite graph connections or the
// user-selected direction. Explicit ordinal ports remain fixed in flowGraph.
export function applyFlowProfile(graph:ElkNode,spec:FlowchartSpec,profile:FlowProfile){
 const settings={
  mainline:{placement:'NETWORK_SIMPLEX',layering:'NETWORK_SIMPLEX',layerGap:72,nodeGap:55,straight:true},
  branches:{placement:'BRANDES_KOEPF',layering:'LONGEST_PATH',layerGap:65,nodeGap:110,straight:false},
  stages:{placement:'LINEAR_SEGMENTS',layering:'NETWORK_SIMPLEX',layerGap:112,nodeGap:72,straight:true},
 }[profile];
 Object.assign(graph.layoutOptions!,{
  'elk.layered.nodePlacement.strategy':settings.placement,
  'elk.layered.layering.strategy':settings.layering,
  'elk.layered.nodePlacement.favorStraightEdges':String(settings.straight),
  'elk.layered.spacing.nodeNodeBetweenLayers':String(settings.layerGap),
  'elk.spacing.nodeNode':String(settings.nodeGap),
  'elk.layered.thoroughness':'20',
 });
 if(profile==='branches')graph.layoutOptions!['elk.layered.nodePlacement.bk.fixedAlignment']='BALANCED';
 if(profile==='stages'){
  const order=new Map(spec.nodes.map((node,index)=>[node.id,index]));
  const nodes=new Map(spec.nodes.map(node=>[node.id,node]));
  // Stable phase/level intent influences ordering, without forcing new layers
  // or imposing an invented dependency on the business graph.
  graph.children!.sort((a,b)=>{
   const first=nodes.get(a.id)!,second=nodes.get(b.id)!;
   return first.level-second.level||(first.phase??'').localeCompare(second.phase??'','zh')||order.get(a.id)!-order.get(b.id)!;
  });
 }
}

export function flowTextFits(node:FlowchartSpec['nodes'][number],direction:FlowchartSpec['direction'],size:{width:number;height:number},fontSize=12){
 const lines=flowLines(node.text,direction,size,node.type),ratio=node.type==='decision'?.55:.85,font=fontSize*1.8;
 return lines.length*font*1.25<=size.height*ratio&&Math.max(...lines.map(line=>Array.from(line).length))*font<=size.width*ratio;
}
export function readableNodeSize(node:FlowchartSpec['nodes'][number],direction:FlowchartSpec['direction'],fontSize=12){
 const size=nodeSize(node,direction),ratio=node.type==='decision'?.55:.85,font=fontSize*1.8;
 // Width changes may change horizontal wrapping. Iterate until both axes fit.
 for(let i=0;i<5;i++){
  const lines=flowLines(node.text,direction,size,node.type);
  size.width=Math.max(size.width,Math.ceil(Math.max(...lines.map(line=>Array.from(line).length))*font/ratio+8));
  size.height=Math.max(size.height,Math.ceil(lines.length*font*1.25/ratio+8));
 }
 return size;
}

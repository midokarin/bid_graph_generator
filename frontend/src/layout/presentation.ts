import type {FlowchartSpec,FlowLayout} from '../domain/generated/ProjectFile';
import {wrapText,nodeSize} from './flow';

// A single spine with direct correction loops has a clearer document layout
// than a layered cycle. Other graph topologies continue through ELK.
export function presentationLayout(spec:FlowchartSpec):FlowLayout|null {
 const byId=new Map(spec.nodes.map(n=>[n.id,n]));
 const loops=spec.edges.filter(e=>e.kind==='rework');
 const sideIds=new Set(loops.map(e=>e.source));
 if(sideIds.size!==loops.length)return null;
 for(const e of loops){
  if(byId.get(e.target)?.type!=='decision'||byId.get(e.source)?.type!=='process')return null;
  const incoming=spec.edges.filter(a=>a.target===e.source),outgoing=spec.edges.filter(a=>a.source===e.source);
  if(incoming.length!==1||incoming[0].source!==e.target||incoming[0].kind!=='normal'||outgoing.length!==1)return null;
 }
 if(new Set(loops.map(e=>e.target)).size!==loops.length)return null;
 const spineEdges=spec.edges.filter(e=>!sideIds.has(e.source)&&!sideIds.has(e.target));
 const roots=spec.nodes.filter(n=>!sideIds.has(n.id)&&!spineEdges.some(e=>e.target===n.id));
 if(roots.length!==1)return null;
 const spine:typeof spec.nodes[number][]=[];
 let current:typeof spec.nodes[number]|undefined=roots[0];
 while(current){
  if(spine.some(n=>n.id===current!.id))return null;
  spine.push(current);
  const next=spineEdges.filter(e=>e.source===current!.id);
  if(next.length>1)return null;
  current=next.length?byId.get(next[0].target):undefined;
 }
 if(spine.length+sideIds.size!==spec.nodes.length||spineEdges.length!==spine.length-1)return null;
 if(spec.direction==='RIGHT')return horizontalSpine(spec,spine,sideIds);
 const nodes:FlowLayout['nodes']=[];
 const maxWidth=Math.max(320,...spine.filter(n=>n.type==='decision').map(n=>Math.min(12,Array.from(n.text).length)*40+16));
 const center=maxWidth/2+44,padding=44;
 let y=padding;
 for(const n of spine){
  const count=wrapText(n.text).length;
  const width=n.type==='decision'?Math.max(300,Math.min(12,Array.from(n.text).length)*40+16):320;
  const height=n.type==='decision'?Math.max(148,count*52+60):Math.max(68,count*28+32);
  nodes.push({id:n.id,x:center-width/2,y,width,height});y+=height+52;
 }
 let width=maxWidth+padding*2;
 for(const loop of loops){
  const target=nodes.find(n=>n.id===loop.target)!;
  const height=Math.max(68,wrapText(byId.get(loop.source)!.text).length*28+32);
  const label=spec.edges.find(e=>e.target===loop.source)!.label??'';
  const gap=Math.max(116,Array.from(label).length*18+32);
  const sideWidth=Math.max(208,Math.min(12,Array.from(byId.get(loop.source)!.text).length)*26+36);
  const returnWidth=Array.from(loop.label??'').length*18;
  const landing=target.x+target.width*.78;
  const x=Math.max(target.x+target.width+gap,2*(center+160+16+returnWidth/2)-landing-sideWidth/2);
  nodes.push({id:loop.source,x,y:target.y+target.height/2-height/2,width:sideWidth,height});
  width=Math.max(width,x+sideWidth+padding);
 }
 const edges:FlowLayout['edges']=spec.edges.map(e=>{
  const from=nodes.find(n=>n.id===e.source)!,to=nodes.find(n=>n.id===e.target)!;
  let points:{x:number;y:number}[],label_position:{x:number;y:number}|null=null;
  if(sideIds.has(e.source)){
   const lane=to.y-26,landing=to.x+to.width*.78;
   points=[{x:from.x+from.width/2,y:from.y},{x:from.x+from.width/2,y:lane},{x:landing,y:lane},{x:landing,y:to.y+to.height*.28}];
   if(e.label)label_position={x:(landing+from.x+from.width/2)/2,y:lane-12};
  }else if(sideIds.has(e.target)){
   points=[{x:from.x+from.width,y:from.y+from.height/2},{x:to.x,y:to.y+to.height/2}];
   if(e.label)label_position={x:(points[0].x+points[1].x)/2,y:points[0].y-14};
  }else{
   const bottom=byId.get(from.id)!.type==='document'?from.y+from.height-10.5:from.y+from.height;
   points=[{x:center,y:bottom},{x:center,y:to.y}];
   if(e.label)label_position={x:center+18+Array.from(e.label).length*8,y:(bottom+to.y)/2+5};
  }
  return {id:e.id,points:points as FlowLayout['edges'][number]['points'],label_position};
 });
 // Balance the main spine on the page while reserving room for the side loop.
 if(loops.length){
  const shift=width-2*center;
  nodes.forEach(n=>{n.x+=shift});
  edges.forEach(e=>{e.points.forEach(p=>{p.x+=shift});if(e.label_position)e.label_position.x+=shift});
  width+=shift;
 }
 return {diagram_type:'flowchart',direction:'DOWN',width,height:y-52+padding,nodes,edges};
}

// Keep correction loops local to their decision, below a common horizontal axis.
function horizontalSpine(spec:FlowchartSpec,spine:FlowchartSpec['nodes'][number][],sideIds:Set<string>):FlowLayout {
 const padding=36,nodes:FlowLayout['nodes']=[];
 const center=padding+Math.max(...spine.map(n=>nodeSize(n,'RIGHT').height))/2;
 let x=padding;
 for(const node of spine){
  const size=nodeSize(node,'RIGHT');nodes.push({id:node.id,x,y:center-size.height/2,...size});
  const outgoing=spec.edges.find(e=>e.source===node.id&&!sideIds.has(e.target));
  const correction=spec.edges.find(e=>e.kind==='rework'&&e.target===node.id);
  const side=correction?spec.nodes.find(n=>n.id===correction.source):undefined;
  const loopSpace=side?Math.max(0,(nodeSize(side,'RIGHT').width-size.width)/2)+48+Array.from(correction?.label??'').length*18:0;
  x+=size.width+Math.max(48,Array.from(outgoing?.label??'').length*18+24,loopSpace);
 }
 let height=center*2;
 for(const id of sideIds){
  const node=spec.nodes.find(n=>n.id===id)!,back=spec.edges.find(e=>e.source===id)!;
  const decision=nodes.find(n=>n.id===back.target)!,size=nodeSize(node,'RIGHT');
  const gap=Math.max(72,Array.from(spec.edges.find(e=>e.target===id)?.label??'').length*18+24);
  const side={id,x:decision.x+decision.width/2-size.width/2,y:decision.y+decision.height+gap,...size};
  nodes.push(side);height=Math.max(height,side.y+side.height+padding);
 }
 const edges:FlowLayout['edges']=spec.edges.map(e=>{
  const from=nodes.find(n=>n.id===e.source)!,to=nodes.find(n=>n.id===e.target)!;
  let points:{x:number;y:number}[],label_position:{x:number;y:number}|null=null;
  if(sideIds.has(e.target)){
   const cx=from.x+from.width/2;
   points=[{x:cx,y:from.y+from.height},{x:cx,y:to.y}];
   if(e.label)label_position={x:cx-Array.from(e.label).length*9-12,y:(points[0].y+to.y)/2+6};
  }else if(sideIds.has(e.source)){
   const lane=Math.max(from.x+from.width,to.x+to.width)+24;
   const landing={x:to.x+to.width*.75,y:to.y+to.height*.75};
   points=[{x:from.x+from.width,y:from.y+from.height/2},{x:lane,y:from.y+from.height/2},{x:lane,y:landing.y},{...landing}];
   if(e.label)label_position={x:lane+12+Array.from(e.label).length*9,y:(landing.y+from.y+from.height/2)/2};
  }else{
   points=[{x:from.x+from.width,y:center},{x:to.x,y:center}];
   if(e.label)label_position={x:(points[0].x+to.x)/2,y:center-14};
  }
  return {id:e.id,points:points as FlowLayout['edges'][number]['points'],label_position};
 });
 const width=Math.max(...nodes.map(n=>n.x+n.width),...edges.map(e=>e.label_position?e.label_position.x+Array.from(spec.edges.find(a=>a.id===e.id)?.label??'').length*9:0))+padding;
 return {diagram_type:'flowchart',direction:'RIGHT',width,height,nodes,edges};
}

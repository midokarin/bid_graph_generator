import type {FlowchartSpec,FlowLayout,Point} from '../domain/generated/ProjectFile';
import {crosses} from './connectors';
export type Box={x:number;y:number;width:number;height:number};
export const intersects=(a:Box,b:Box)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
// Match Diagram's label font and baseline. Use conservative character widths,
// including full-width Chinese characters, rather than ELK's old fixed 18 px.
export function labelSize(text:string,fontSize=12){
 const font=fontSize*1.8*.82;
 return {width:Math.max(25,Array.from(text).reduce((sum,ch)=>sum+(/^[\x00-\x7f]$/.test(ch)?.62:1),0)*font+8),height:font*1.25,font};
}
export function labelBox(text:string,point:Point,fontSize=12):Box{
 const size=labelSize(text,fontSize);
 return {x:point.x-size.width/2,y:point.y-size.font,width:size.width,height:size.height};
}
export function labelCollisions(spec:FlowchartSpec,layout:FlowLayout,fontSize=12):number {
 const labels=layout.edges.flatMap(edge=>{
  const text=spec.edges.find(e=>e.id===edge.id)?.label;
  return text&&edge.label_position?[{id:edge.id,box:labelBox(text,edge.label_position,fontSize)}]:[];
 });
 let hits=0;
 for(const {box} of labels){
  if(box.x<0||box.y<0||box.x+box.width>layout.width||box.y+box.height>layout.height)hits++;
  hits+=layout.nodes.filter(n=>intersects(box,n)).length;
  for(const edge of layout.edges)for(let i=1;i<edge.points.length;i++)if(crosses(edge.points[i-1],edge.points[i],box))hits++;
 }
 for(let i=0;i<labels.length;i++)for(let j=i+1;j<labels.length;j++)if(intersects(labels[i].box,labels[j].box))hits++;
 return hits;
}

export function placeFlowLabels(spec:FlowchartSpec,source:FlowLayout,fontSize=12):FlowLayout {
 const layout=structuredClone(source),placed:Box[]=[];
 const segments=layout.edges.flatMap(edge=>edge.points.slice(1).map((b,i)=>({a:edge.points[i],b})));
 for(const edge of layout.edges){
  const text=spec.edges.find(e=>e.id===edge.id)?.label;if(!text||!edge.label_position)continue;
  const size=labelSize(text,fontSize),original=edge.label_position;
  const choices:Point[]=[original];
  // Prefer nearby positions along the same connector; never move a label onto
  // another connector just to fit it somewhere on the canvas.
  for(let i=1;i<edge.points.length;i++){
   const a=edge.points[i-1],b=edge.points[i];
   for(const ratio of [.5,.35,.65]){
    const x=a.x+(b.x-a.x)*ratio,y=a.y+(b.y-a.y)*ratio;
    if(a.y===b.y&&Math.abs(b.x-a.x)>=size.width+12){
     choices.push({x,y:y-10},{x,y:y+size.font+10});
    }else if(a.x===b.x&&Math.abs(b.y-a.y)>=size.height+12){
     choices.push({x:x+size.width/2+10,y:y+size.font/3},{x:x-size.width/2-10,y:y+size.font/3});
    }
   }
  }
  let best=original,bestScore=Infinity;
  for(const point of choices){
   const box=labelBox(text,point,fontSize);
   if(box.x<4||box.y<4||box.x+box.width>layout.width-4||box.y+box.height>layout.height-4)continue;
   const nodeHits=layout.nodes.filter(node=>intersects(box,node)).length;
   const labelHits=placed.filter(other=>intersects(box,other)).length;
   const edgeHits=segments.filter(segment=>crosses(segment.a,segment.b,box)).length;
   const score=(nodeHits+labelHits+edgeHits)*1e9+Math.hypot(point.x-original.x,point.y-original.y);
   if(score<bestScore){best=point;bestScore=score}
  }
  edge.label_position=best;placed.push(labelBox(text,best,fontSize));
 }
 return labelCollisions(spec,layout,fontSize)<=labelCollisions(spec,source,fontSize)?layout:structuredClone(source);
}

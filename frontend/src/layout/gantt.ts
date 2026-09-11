import type {GanttSpec,GanttLayout} from '../domain/generated/ProjectFile';
import {routePorts} from './connectors';
export const taskY=(row:number)=>116+row*84;
export const timeX=(time:number,total:number)=>310+time/Math.max(1,total)*510;
export function ganttDependencies(spec:GanttSpec,layout:GanttLayout,strokeWidth:number){
 const total=Math.max(1,...layout.tasks.map(t=>t.end));
 const boxes=new Map(layout.tasks.map(t=>{
  const milestone=spec.tasks.find(n=>n.id===t.id)!.kind==='milestone';
  const x=timeX(t.start,total),y=taskY(t.row),half=milestone?9:14;
  return [t.id,{x:x-(milestone?9:0),y:y-half,width:milestone?18:Math.max(1,timeX(t.end,total)-x),height:half*2}];
 }));
 const nodes=[...boxes.values()];
 return spec.dependencies.map(d=>{
  const from=boxes.get(d.source)!,to=boxes.get(d.target)!;
  const source={point:{x:from.x+from.width+strokeWidth/2,y:from.y+from.height/2},direction:{x:1,y:0},box:from};
  // All FS dependencies enter from the left. A fixed-size arrow ends just
  // outside the bar (or diamond), and converging dependencies share its tip.
  const target={point:{x:to.x-strokeWidth/2-1,y:to.y+to.height/2},direction:{x:-1,y:0},box:to};
  return {id:d.id,target:d.target,points:routePorts(source,target,nodes,Math.max(900,layout.width),Math.max(200,layout.height),12)};
 });
}

import type {VersionSnapshot,Style,FlowLayout,FlowEdge} from './domain/generated/ProjectFile';
import {TEXT_LIMITS,wrapText} from './layout/flow';
export type Kind='flowchart'|'gantt';
export type Appearance={fontFamily:string;textColor:string;strokeColor:string;backgroundColor:string;fillColor:string;strokeWidth:number;cornerRadius:number};
export const FONTS=['sans-serif','Arial','宋体','黑体','微软雅黑','PingFang SC'];
export const DEFAULT_APPEARANCE:Appearance={fontFamily:'sans-serif',textColor:'#000000',strokeColor:'#000000',backgroundColor:'#FFFFFF',fillColor:'#FFFFFF',strokeWidth:1.5,cornerRadius:5};
export const DEFAULT_STYLE:Style={template:'classic',font_family:'sans-serif',font_size:12,text_color:'#000000',stroke_color:'#000000',background_color:'#FFFFFF',fill_color:'#FFFFFF',stroke_width:1.5,corner_radius:5,transparent_background:false};
// Demo-facing projection only. The canonical snapshot remains `version`.
export type Snapshot={version:VersionSnapshot;revision:number;appearance:Appearance;kind:Kind;title:string;fontSize:number;duration:number};
export function view(version:VersionSnapshot):Snapshot{
 const s=version.style;
 return {version,revision:version.revision,kind:version.spec.diagram_type,title:version.spec.title,fontSize:s.font_size,
 duration:version.layout.diagram_type==='gantt'?Math.max(0,...version.layout.tasks.map(t=>t.end)):0,
 appearance:{fontFamily:s.font_family,textColor:s.text_color,strokeColor:s.stroke_color,backgroundColor:s.background_color,fillColor:s.fill_color,strokeWidth:s.stroke_width,cornerRadius:s.corner_radius}};
}
export function withAppearance(snapshot:Snapshot,a:Appearance):Snapshot{
 return view({...snapshot.version,style:{...snapshot.version.style,font_family:a.fontFamily,text_color:a.textColor,stroke_color:a.strokeColor,background_color:a.backgroundColor,fill_color:a.fillColor,stroke_width:a.strokeWidth,corner_radius:a.cornerRadius}});
}
export type Proposal={baseRevision:number;field:'title'|'fontSize'|'appearance'|'nodeText'|'nodePosition'|'taskText'|'transparent';target?:string;before:string|number;after:string|number;impact:string;template?:string};
export const SAMPLES:Record<Kind,{title:string;text:string}>={
 flowchart:{title:'项目实施与验收流程',text:'接收项目需求 → 需求分析与确认 → 编制实施方案 → 组织项目实施 → 质量检查。\n质量检查合格后，交付验收，项目结束。\n质量检查不合格时，进行问题整改，并返回质量检查。'},
 gantt:{title:'项目实施进度计划',text:'以合同生效日为第 1 天，总工期不超过 30 个日历天。\n准备工作：3 天。\n项目实施：20 天，在准备工作完成后开始。\n交付验收：零工期里程碑，在项目实施完成时发生。'}};
export function moved(layout:FlowLayout,id:string,x:number,y:number,connections:FlowEdge[]):FlowLayout{
 const next=structuredClone(layout),node=next.nodes.find(n=>n.id===id)!;
 if(!Number.isFinite(x)||!Number.isFinite(y)||x<5||y<5||x+node.width>layout.width-5||y+node.height>layout.height-5)throw new Error('节点超出画布。');
 const dx=x-node.x,dy=y-node.y;node.x=x;node.y=y;
 // Move attached endpoints and insert orthogonal elbows, without rerunning ELK.
 for(const edge of next.edges){
  const connection=connections.find(e=>e.id===edge.id)!;
  for(const first of [true,false]){
   const i=first?0:edge.points.length-1;
   if((first?connection.source:connection.target)!==id)continue;
   const p=edge.points[i],other=edge.points[first?1:i-1];
   const point={x:p.x+dx,y:p.y+dy};
   const elbow=p.x===other.x?{x:point.x,y:other.y}:{x:other.x,y:point.y};
   if(first)edge.points.splice(0,1,point,elbow);else edge.points.splice(i,1,elbow,point);
  }
 }
 return next;
}
export function applyProposal(s:Snapshot,p:Proposal):VersionSnapshot{
 if(s.revision!==p.baseRevision)throw new Error('图表已变化，请重新提交修改。');
 let v=structuredClone(s.version);
 if(p.field==='appearance'){
  if(JSON.stringify(s.appearance)!==p.before)throw new Error('版式已变化。');
  const a=JSON.parse(String(p.after)) as Appearance;
  if(!FONTS.includes(a.fontFamily)||![a.textColor,a.strokeColor,a.backgroundColor,a.fillColor].every(c=>/^#[0-9a-f]{6}$/i.test(c))||!Number.isFinite(a.strokeWidth)||a.strokeWidth<.5||a.strokeWidth>5||!Number.isFinite(a.cornerRadius)||a.cornerRadius<0||a.cornerRadius>24)throw new Error('版式参数无效。');
  v=withAppearance(view(v),a).version;v.style.template=p.template??'custom';v.origin=p.template?'template':'style';
 }else if(p.field==='fontSize'){v.style.font_size=Number(p.after);v.origin='style';}
 else if(p.field==='transparent'){v.style.transparent_background=p.after==='true';v.origin='style';}
 else if(p.field==='nodePosition'){
  if(v.layout.diagram_type!=='flowchart')throw new Error('图种不匹配');
  const point=JSON.parse(String(p.after));v.layout=moved(v.layout,p.target!,point.x,point.y,v.spec.diagram_type==='flowchart'?v.spec.edges:[]);v.origin='position';
 }else{
  const value=String(p.after).trim();
  if(!value||value.length>(p.field==='title'?160:p.field==='taskText'?TEXT_LIMITS.task:TEXT_LIMITS.flow))throw new Error('文字过长，请精简后再应用。');
  if(p.field==='title')v.spec.title=value;
  else {const items=v.spec.diagram_type==='flowchart'?v.spec.nodes:v.spec.tasks;const item=items.find(n=>n.id===p.target);if(!item||item.text!==p.before)throw new Error('对象已变化');item.text=value;}
  v.origin='text';
 }
 return v;
}

export function assertReadable(version:VersionSnapshot){
 const font=version.style.font_size*(version.spec.diagram_type==='flowchart'?1.8:1.4);
 if(version.spec.diagram_type==='flowchart'&&version.layout.diagram_type==='flowchart'){
  for(const node of version.spec.nodes){
   const geometry=version.layout.nodes.find(n=>n.id===node.id)!;
   const lines=wrapText(node.text);
   const height=geometry.height*(node.type==='decision'?.55:.85);
   const width=geometry.width*(node.type==='decision'?.55:.85);
   if(node.text.length>TEXT_LIMITS.flow||lines.length>TEXT_LIMITS.lines||lines.length*font*1.25>height||Math.min(12,node.text.length)*font>width)throw new Error('节点文字超出可读范围，请精简文字或减小全局字号。');
  }
 }else if(version.spec.diagram_type==='gantt'){
  if(version.spec.tasks.some(t=>t.text.length>TEXT_LIMITS.task||wrapText(t.text).length*font*1.1>70||Math.min(12,t.text.length)*font>190))throw new Error('任务文字超出可读范围，请精简文字或减小全局字号。');
 }
}

import {useId,useRef,useState} from 'react';
import type {Snapshot,Proposal} from './model';
import {moved} from './model';
import {TEXT_LIMITS,wrapText} from './layout/flow';
import type {NodeGeometry} from './domain/generated/ProjectFile';
export function Diagram({snapshot:s,svgRef,onPropose,locked=false}:{snapshot:Snapshot;svgRef?:React.Ref<SVGSVGElement>;onPropose?:(p:Proposal)=>void;locked?:boolean}){
 const {spec,style}=s.version; const a=s.appearance, font=s.fontSize*(spec.diagram_type==='flowchart'?1.8:1.4), arrow=useId();
 const [editing,setEditing]=useState<{id:string;text:string;before:string;task:boolean}|null>(null);
 const editingRef=useRef(false);
 const [drag,setDrag]=useState<{id:string;x:number;y:number}|null>(null);
 const dragRef=useRef<{node:NodeGeometry;x:number;y:number}|null>(null);
 const [selected,setSelected]=useState('');
 const base=s.version.layout;
 const layout=base.diagram_type==='flowchart'&&drag?moved(base,drag.id,drag.x,drag.y,spec.diagram_type==='flowchart'?spec.edges:[]):base;
 const startEdit=(id:string,text:string,task=false)=>{if(onPropose&&!locked){editingRef.current=true;setEditing({id,text,before:text,task})}};
 function finish(cancel=false){if(!editing||!editingRef.current)return;editingRef.current=false;setEditing(null);if(!cancel&&editing.text.trim()!==editing.before)onPropose?.({baseRevision:s.revision,field:editing.task?'taskText':'nodeText',target:editing.id,before:editing.before,after:editing.text.trim(),impact:'更新选中对象文字，保持已有布局、连接关系和工期。'})}
 function input(x:number,y:number,width:number){return editing&&<foreignObject data-editor="true" x={x} y={y} width={width} height={44}><input aria-label="编辑图中文字" autoFocus value={editing.text} maxLength={editing.task?TEXT_LIMITS.task:TEXT_LIMITS.flow} onChange={e=>setEditing({...editing,text:e.target.value})} onBlur={()=>finish()} onKeyDown={e=>{e.stopPropagation();if(e.key==='Enter'){e.preventDefault();finish()}if(e.key==='Escape'){e.preventDefault();finish(true)}}} style={{width:'100%',fontSize:18,padding:6,border:'2px solid #397fbd',background:'white',color:'black'}}/></foreignObject>}
 function point(e:React.PointerEvent<SVGGElement>){return new DOMPoint(e.clientX,e.clientY).matrixTransform(e.currentTarget.ownerSVGElement!.getScreenCTM()!.inverse())}
 function down(e:React.PointerEvent<SVGGElement>,node:NodeGeometry){if(!onPropose||locked||editing||e.button!==0)return;const p=point(e);dragRef.current={node,x:p.x,y:p.y};setSelected(node.id);e.currentTarget.setPointerCapture(e.pointerId)}
 function move(e:React.PointerEvent<SVGGElement>){const d=dragRef.current;if(!d)return;const p=point(e);setDrag({id:d.node.id,x:Math.round(Math.max(5,Math.min(layout.width-d.node.width-5,d.node.x+p.x-d.x))),y:Math.round(Math.max(5,Math.min(layout.height-d.node.height-5,d.node.y+p.y-d.y)))})}
 function up(e:React.PointerEvent<SVGGElement>){const d=dragRef.current;dragRef.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);if(d&&drag&&(drag.x!==d.node.x||drag.y!==d.node.y))onPropose?.({baseRevision:s.revision,field:'nodePosition',target:d.node.id,before:JSON.stringify({x:d.node.x,y:d.node.y}),after:JSON.stringify({x:drag.x,y:drag.y}),impact:'移动节点并更新相连路径；不重新执行自动布局。'});setDrag(null)}
 const shapeStyle={fill:a.fillColor,stroke:a.strokeColor,strokeWidth:a.strokeWidth};
 const background=style.transparent_background?'transparent':a.backgroundColor;
 const path=(points:{x:number;y:number}[])=>points.map((p,i)=>`${i?'L':'M'}${p.x} ${p.y}`).join(' ');
 const line=(d:string)=><path d={d} fill="none" stroke={a.strokeColor} strokeWidth={a.strokeWidth} markerEnd={`url(#${arrow})`}/>;
 const unit=spec.diagram_type==='gantt'?{calendar_day:'天',week:'周',month:'月'}[spec.time_unit]:'';
 const total=layout.diagram_type==='gantt'?Math.max(1,...layout.tasks.map(t=>t.end)):1;
 const tx=(n:number)=>310+n/total*510;
 const rowY=(row:number)=>116+row*84;
 return <svg ref={svgRef} xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${layout.width} ${layout.height}`} role="img" aria-label={s.title} fill={a.textColor} style={{fontFamily:`${a.fontFamily}, "PingFang SC", "Microsoft YaHei", sans-serif`,background,color:a.textColor,width:'100%',height:'auto'}}>
 <rect width="100%" height="100%" fill={background}/><defs><marker id={arrow} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill={a.strokeColor}/></marker></defs>
 {spec.diagram_type==='flowchart'&&layout.diagram_type==='flowchart'?<>
 {layout.edges.map(edge=><g key={edge.id} data-edge-id={edge.id} data-kind={spec.edges.find(e=>e.id===edge.id)?.kind}>{line(path(edge.points))}{edge.label_position&&<text x={edge.label_position.x} y={edge.label_position.y} textAnchor="middle" fontSize={font*.82}>{spec.edges.find(e=>e.id===edge.id)?.label}</text>}</g>)}
 {layout.nodes.map(node=>{const n=spec.nodes.find(n=>n.id===node.id)!;const {x,y,width:w,height:h}=node;const lines=wrapText(n.text);return <g key={n.id} data-node-id={n.id} data-node-type={n.type} role={onPropose&&!locked?'button':undefined} tabIndex={onPropose&&!locked?0:undefined} aria-label={onPropose&&!locked?`${n.text}，双击编辑，拖动调整位置`:n.text} onDoubleClick={()=>startEdit(n.id,n.text)} onKeyDown={e=>{if(e.key==='Enter')startEdit(n.id,n.text)}} onPointerDown={e=>down(e,node)} onPointerMove={move} onPointerUp={up} onPointerCancel={()=>{dragRef.current=null;setDrag(null)}} style={{cursor:onPropose&&!locked?'move':'default',touchAction:'none'}}>
 {n.type==='decision'?<polygon points={`${x+w/2},${y} ${x+w},${y+h/2} ${x+w/2},${y+h} ${x},${y+h/2}`} {...shapeStyle}/>:n.type==='document'?<path d={`M${x} ${y} H${x+w} V${y+h-12} C${x+w*.65} ${y+h-32},${x+w*.35} ${y+h+12},${x} ${y+h-12} Z`} {...shapeStyle}/>:<rect x={x} y={y} width={w} height={h} rx={n.type==='start'||n.type==='end'?h/2:a.cornerRadius} {...shapeStyle}/>}
 {n.type==='subprocess'&&<path d={`M${x+12} ${y} V${y+h} M${x+w-12} ${y} V${y+h}`} fill="none" stroke={a.strokeColor} strokeWidth={a.strokeWidth}/>}
 <g fill={a.textColor} style={{userSelect:'none',pointerEvents:'none'}}>{lines.map((text,i)=><text key={i} x={x+w/2} y={y+h/2+font*.33+(i-(lines.length-1)/2)*font*1.25} textAnchor="middle" fontSize={font} xmlSpace="preserve">{text}</text>)}</g>
 {onPropose&&selected===n.id&&<rect data-editor="true" x={x-4} y={y-4} width={w+8} height={h+8} fill="none" stroke="#397fbd" strokeDasharray="4 3" pointerEvents="none"/>}
 {editing?.id===n.id&&!editing.task&&input(x,y+h/2-20,w)}</g>})}
 </>:spec.diagram_type==='gantt'&&layout.diagram_type==='gantt'?<>
 <text x="35" y="43" fontSize="18">任务名称</text><text x="230" y="43" fontSize="16">工期</text>
 {Array.from({length:7},(_,i)=>i*total/6).map((n,i)=><g key={i}><line x1={tx(n)} y1={65} x2={tx(n)} y2={layout.height-88} stroke="#dddddd"/><text x={tx(n)} y={43} textAnchor="middle" fontSize={15}>{i===0?'起点':`${Number(n.toFixed(2))}${unit}`}</text></g>)}
 {spec.dependencies.map(d=>{const from=layout.tasks.find(t=>t.id===d.source)!,to=layout.tasks.find(t=>t.id===d.target)!;return <g key={d.id} data-dependency-id={d.id}>{line(`M${tx(from.end)} ${rowY(from.row)} H${tx(from.end)+12} V${rowY(to.row)} H${tx(to.start)}`)}</g>})}
 {layout.tasks.map(t=>{const task=spec.tasks.find(n=>n.id===t.id)!;const y=rowY(t.row);return <g key={t.id} data-task-id={t.id} data-start={t.start} data-end={t.end}>
 <line x1="30" x2="840" y1={y-36} y2={y-36} stroke="#ddd"/>
 <text x="35" y={y+11} fontSize={font} role={onPropose&&!locked?'button':undefined} tabIndex={onPropose&&!locked?0:undefined} aria-label={`编辑任务：${task.text}`} onDoubleClick={()=>startEdit(task.id,task.text,true)} onKeyDown={e=>{if(e.key==='Enter')startEdit(task.id,task.text,true)}} style={{cursor:onPropose&&!locked?'text':'default'}}>{wrapText(task.text).map((text,i)=><tspan key={i} x={35} dy={i?font*1.1:-(wrapText(task.text).length-1)*font*.5}>{text}</tspan>)}</text>
 <text x="235" y={y+11} fontSize="17">{task.duration} {unit}</text>
 {task.kind==='milestone'?<path d={`M${tx(t.start)} ${y-9} l9 9 -9 9 -9 -9 z`} fill={a.strokeColor}/>:<rect x={tx(t.start)} y={y-14} width={Math.max(1,tx(t.end)-tx(t.start))} height={28} rx={a.cornerRadius} {...shapeStyle}/>}
 {editing?.task&&editing.id===task.id&&input(30,y-16,195)}</g>})}
 <text x="310" y={layout.height-55} fontSize="16">起点为 0 · {unit==='天'?'日历天':unit} · 完工：{Math.max(...layout.tasks.map(t=>t.end))} {unit}</text>
 </>:null}</svg>;
}

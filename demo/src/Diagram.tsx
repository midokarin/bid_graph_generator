import {useState,useRef,useId} from 'react';
import type { Snapshot,Proposal,FlowNode } from './model';
export function Diagram({snapshot:s, svgRef,onPropose}: {snapshot:Snapshot; svgRef?:React.Ref<SVGSVGElement>;onPropose?:(p:Proposal)=>void}) {
  const [drag,setDrag]=useState<{id:string;x:number;y:number}|null>(null),[selected,setSelected]=useState('');
  const dragRef=useRef<{id:string;startX:number;startY:number;x:number;y:number}|null>(null);
  const [editing,setEditing]=useState<{id:string;text:string;before:string;task?:boolean}|null>(null);
  const editingRef=useRef(false);
  const a=s.appearance;
  const arrowId=useId();
  function startEdit(id:string,text:string,task=false){if(!onPropose||s.locked)return;editingRef.current=true;setEditing({id,text,before:text,task});}
  function finishEdit(cancel=false){if(!editing||!editingRef.current)return;editingRef.current=false;setEditing(null);if(!cancel&&editing.text.trim()&&editing.text.trim()!==editing.before)onPropose?.({baseRevision:s.revision,field:editing.task?'taskText':'nodeText',target:editing.id,before:editing.before,after:editing.text.trim(),impact:'更新选中对象的文字；流程连接关系和任务工期不变。'});}
  function point(e:React.PointerEvent<SVGElement>){const svg=e.currentTarget.ownerSVGElement!;const matrix=svg.getScreenCTM();if(!matrix)return {x:0,y:0};return new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse());}
  function down(e:React.PointerEvent<SVGGElement>,n:FlowNode){if(!onPropose||editing||e.button!==0)return;const p=point(e);dragRef.current={id:n.id,startX:p.x,startY:p.y,x:n.x,y:n.y};setSelected(n.id);e.currentTarget.setPointerCapture(e.pointerId);}
  function move(e:React.PointerEvent<SVGGElement>,n:FlowNode){const d=dragRef.current;if(!d||d.id!==n.id)return;const p=point(e);setDrag({id:n.id,x:Math.round(Math.max(5,Math.min(755-n.width,d.x+p.x-d.startX))),y:Math.round(Math.max(5,Math.min(655-n.height,d.y+p.y-d.startY)))});}
  function up(e:React.PointerEvent<SVGGElement>,n:FlowNode){dragRef.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);if(drag&&(drag.x!==n.x||drag.y!==n.y))onPropose?.({baseRevision:s.revision,field:'nodePosition',target:n.id,before:JSON.stringify({x:n.x,y:n.y}),after:JSON.stringify({x:drag.x,y:drag.y}),impact:'仅移动节点位置，连线跟随更新；文字和业务顺序不变。'});setDrag(null);}
  function editInput(x:number,y:number,width:number){return editing&&<foreignObject data-editor="true" x={x} y={y} width={width} height="44"><input aria-label="编辑图中文字" autoFocus value={editing.text} maxLength={editing.task?30:60} onChange={e=>setEditing({...editing,text:e.target.value})} onBlur={()=>finishEdit()} onKeyDown={e=>{e.stopPropagation();if(e.key==='Enter')finishEdit();if(e.key==='Escape')finishEdit(true)}} style={{width:'100%',fontSize:'18px',padding:'6px',border:'2px solid #397fbd',background:'white',color:'black'}}/></foreignObject>}
  const nodes=s.nodes.map(n=>drag?.id===n.id?{...n,x:drag.x,y:drag.y}:n);
  function edge(from:string,to:string,branch?:string){const f=nodes.find(n=>n.id===from)!,t=nodes.find(n=>n.id===to)!;let path:string,lx:number,ly:number;
   if(branch==='不合格'){const x=f.x+f.width,y=f.y+f.height/2,tx=t.x,ty=t.y+t.height/2;path=`M${x} ${y} H${(x+tx)/2} V${ty} H${tx}`;lx=(x+tx)/2;ly=y-10;}
   else if(from==='n8'){const x=f.x+f.width/2,y=f.y,tx=t.x+t.width*.8,ty=t.y+t.height*.2;path=`M${x} ${y} V${Math.min(y,ty)-28} H${tx} V${ty}`;lx=0;ly=0;}
   else {const x=f.x+f.width/2,y=f.y+f.height,tx=t.x+t.width/2,ty=t.y;path=`M${x} ${y} V${(y+ty)/2} H${tx} V${ty}`;lx=x+14;ly=(y+ty)/2;}
   return <g key={from+to}>{line(path)}{branch&&<text x={lx} y={ly} fontSize={font*.82}>{branch}</text>}</g>;
  }

  const font = s.fontSize * 1.4;
  const box=(x:number,y:number,w:number,h:number,text:string,round=5)=><g><rect x={x} y={y} width={w} height={h} rx={round} fill={a.fillColor} stroke={a.strokeColor} strokeWidth={a.strokeWidth}/><text x={x+w/2} y={y+h/2+6} textAnchor="middle" fontSize={font}>{text}</text></g>;
  const line=(d:string)=><path d={d} fill="none" stroke={a.strokeColor} strokeWidth={a.strokeWidth} markerEnd={`url(#${arrowId})`}/>;
  return <svg ref={svgRef} xmlns="http://www.w3.org/2000/svg" viewBox={s.kind==='flowchart'?'0 0 760 660':'0 0 900 420'} role="img" aria-label={s.title} fill={a.textColor} style={{fontFamily:a.fontFamily,background:a.backgroundColor,color:a.textColor,width:'100%',height:'auto'}}><rect x="0" y="0" width="100%" height="100%" fill={a.backgroundColor}/><defs><marker id={arrowId} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill={a.strokeColor}/></marker></defs>
  {s.kind==='flowchart'?<>
    {[edge('n1','n2'),edge('n2','n3'),edge('n3','n4'),edge('n4','n5'),edge('n5','n6','合格'),edge('n6','n7'),edge('n5','n8','不合格'),edge('n8','n5')]}
    {nodes.map(n=><g key={n.id} role={onPropose?'button':undefined} tabIndex={onPropose?0:undefined} aria-label={`${n.text}，双击编辑，拖动调整位置`} onDoubleClick={()=>startEdit(n.id,n.text)} onKeyDown={e=>{if(e.key==='Enter')startEdit(n.id,n.text)}} onPointerDown={e=>down(e,n)} onPointerMove={e=>move(e,n)} onPointerUp={e=>up(e,n)} onPointerCancel={()=>{dragRef.current=null;setDrag(null)}} style={{cursor:onPropose?'move':'default',touchAction:'none'}}>
    {n.shape==='diamond'?<polygon points={`${n.x+n.width/2},${n.y} ${n.x+n.width},${n.y+n.height/2} ${n.x+n.width/2},${n.y+n.height} ${n.x},${n.y+n.height/2}`} fill={a.fillColor} stroke={a.strokeColor} strokeWidth={a.strokeWidth}/>:<rect x={n.x} y={n.y} width={n.width} height={n.height} rx={n.shape==='terminal'?n.height/2:a.cornerRadius} fill={a.fillColor} stroke={a.strokeColor} strokeWidth={a.strokeWidth}/>}
    <text x={n.x+n.width/2} y={n.y+n.height/2+font*.33} textAnchor="middle" fontSize={font} style={{userSelect:'none',pointerEvents:'none'}}>{n.text.length>12?<>{[...n.text.matchAll(/.{1,12}/gu)].map((chunk,i,arr)=><tspan key={i} x={n.x+n.width/2} dy={i===0?-(arr.length-1)*font*.55:font*1.1}>{chunk[0]}</tspan>)}</>:n.text}</text>
    {onPropose&&selected===n.id&&<rect data-editor="true" x={n.x-4} y={n.y-4} width={n.width+8} height={n.height+8} fill="none" stroke="#397fbd" strokeDasharray="4 3" pointerEvents="none"/>}
    {editing?.id===n.id&&!editing.task&&editInput(n.x,n.y+n.height/2-20,n.width)}
    </g>)}
  </>:<>
    <text x="35" y="43" fontSize="18">任务名称</text><text x="230" y="43" fontSize="16">工期</text>
    {[0,5,10,15,20,25,30].map(n=><g key={n}><line x1={310+n*17} y1="65" x2={310+n*17} y2="332" stroke="#dddddd"/><text x={310+n*17} y="43" textAnchor="middle" fontSize="15">{n===0?'起点':`第${n}天`}</text></g>)}
    {[0,1,2].map((n)=><g key={n}><line x1="30" x2="840" y1={80+n*84} y2={80+n*84} stroke="#ddd"/><text x="35" y={127+n*84} fontSize={font} role={onPropose?'button':undefined} tabIndex={onPropose?0:undefined} aria-label={`编辑任务：${s.taskLabels[n]}`} onDoubleClick={()=>startEdit(String(n),s.taskLabels[n],true)} onKeyDown={e=>{if(e.key==='Enter')startEdit(String(n),s.taskLabels[n],true)}} style={{cursor:onPropose&&!s.locked?'text':'default'}}>{s.taskLabels[n]}</text>{editing?.task&&editing.id===String(n)&&editInput(30,100+n*84,195)}<text x="235" y={127+n*84} fontSize="17">{[3,s.duration,0][n]} 天</text></g>)}
    <rect x="310" y="102" width="51" height="28" fill={a.fillColor} stroke={a.strokeColor} strokeWidth={a.strokeWidth}/>
    {line('M361 116 H374 V186')}
    <rect x="361" y="186" width={Math.min(s.duration,27)*17} height="28" fill={a.fillColor} stroke={a.strokeColor} strokeWidth={a.strokeWidth}/>
    <text x={365+Math.min(s.duration,27)*8.5} y="205" fontSize="15" textAnchor="middle">{s.taskLabels[1]}</text>
    {line(`M${310+Math.min(3+s.duration,30)*17} 214 V273`)}
    <path d={`M${310+Math.min(3+s.duration,30)*17} 275 l9 9 -9 9 -9 -9 z`} fill={a.strokeColor}/>
    <text x="310" y="365" fontSize="16">合同生效日起算 · 日历天 · 完工：第 {3+s.duration} 天结束</text>
    {s.duration>27&&<text x="310" y="395" fill={a.strokeColor} fontSize="16">超出 30 天范围，超出部分未按比例显示</text>}
  </>}
  </svg>;
}

import {useState} from 'react';
import {Check, CheckCircle2, Circle, CircleAlert, LoaderCircle, MoreHorizontal, Pencil, Plus, Square, Trash2, X} from 'lucide-react';
import type {Kind} from './model';
import type {RunStatus} from './RunStream';

export type TaskSummary={title:string;kind:Kind;busy:boolean;status:RunStatus;dirty:boolean};
type TaskItem={id:string;number:number;name?:string}&Partial<TaskSummary>;
const statusLabels:Record<RunStatus,string>={idle:'待生成',running:'生成中',success:'已完成',error:'生成失败',cancelled:'已取消'};
type Props={tasks:TaskItem[];activeId:string;onSelect:(id:string)=>void;onCreate:()=>void;onRename:(id:string,name:string)=>void;onCancel:(id:string)=>void;onDelete:(id:string)=>void};

export function TaskList({tasks,activeId,onSelect,onCreate,onRename,onCancel,onDelete}:Props){
 const [menu,setMenu]=useState<string|null>(null),[editing,setEditing]=useState<string|null>(null),[name,setName]=useState('');
 const running=tasks.filter(task=>task.busy&&task.status==='running').length;
 function rename(id:string){const value=name.trim();if(!value)return;onRename(id,value);setEditing(null);setMenu(null)}
 return <section className="task-navigation" aria-label="会话任务">
  <div className="task-section-heading"><strong>会话任务</strong><span>{running?`${running} 个生成中`:`${tasks.length} 个任务`}</span></div>
  <button className="button new-task" onClick={onCreate}><Plus size={16}/>新建任务</button>
  <nav className="task-list" aria-label="任务列表">
   {tasks.map(task=>{
    const status=task.status??'idle';
    const Icon=status==='running'?LoaderCircle:status==='success'?CheckCircle2:status==='error'?CircleAlert:Circle;
    const title=task.name||task.title?.trim()||`任务 ${task.number}`;
    return <div key={task.id} className={`task-row ${task.id===activeId?'selected':''}`}>
     <div className="task-row-main"><button className="task-item" aria-current={task.id===activeId?'page':undefined} aria-label={`切换任务：${title}`} title={title} onClick={()=>{setMenu(null);setEditing(null);onSelect(task.id)}}>
      <span className="task-item-title"><span>{title}</span>{task.dirty&&<i aria-label="未保存"/>}</span>
      <span className={`task-item-status ${status}`}><Icon size={12} className={status==='running'?'spin':''}/>{task.busy&&status!=='running'?'处理中':statusLabels[status]}<span>· {task.kind==='gantt'?'甘特图':'流程图'}</span></span>
     </button><button className="task-more icon-button" aria-label={`管理任务：${title}`} aria-expanded={menu===task.id} onClick={()=>{setMenu(menu===task.id?null:task.id);setEditing(null)}}><MoreHorizontal size={17}/></button></div>
     {menu===task.id&&(editing===task.id?<form className="task-rename" onSubmit={event=>{event.preventDefault();rename(task.id)}}>
      <label>任务名称<input aria-label="任务名称" autoFocus maxLength={80} value={name} onChange={event=>setName(event.target.value)} onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();setEditing(null)}}}/></label>
      <div><button type="submit" className="text-button" disabled={!name.trim()}><Check size={13}/>保存名称</button><button type="button" className="text-button" onClick={()=>setEditing(null)}><X size={13}/>取消重命名</button></div>
     </form>:<div className="task-actions" role="group" aria-label={`${title}的管理操作`}>
      <button onClick={()=>{setName(title);setEditing(task.id)}}><Pencil size={13}/>重命名</button>
      {task.busy&&status==='running'&&<button onClick={()=>{onCancel(task.id);setMenu(null)}}><Square size={13}/>取消生成</button>}
      <button className="delete-task" disabled={task.busy&&status!=='running'} onClick={()=>{onDelete(task.id);setMenu(null)}}><Trash2 size={13}/>删除任务</button>
     </div>)}
    </div>;
   })}
  </nav>
  <p className="task-list-hint">切换任务后，生成仍会继续。<br/>项目需逐个手动保存。</p>
 </section>;
}

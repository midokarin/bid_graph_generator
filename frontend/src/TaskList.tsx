import {CheckCircle2, Circle, CircleAlert, LoaderCircle, Plus} from 'lucide-react';
import type {Kind} from './model';
import type {RunStatus} from './RunStream';

export type TaskSummary={title:string;kind:Kind;busy:boolean;status:RunStatus;dirty:boolean};
type TaskItem={id:string;number:number}&Partial<TaskSummary>;
const statusLabels:Record<RunStatus,string>={idle:'待生成',running:'生成中',success:'已完成',error:'生成失败',cancelled:'已取消'};

export function TaskList({tasks,activeId,onSelect,onCreate}:{tasks:TaskItem[];activeId:string;onSelect:(id:string)=>void;onCreate:()=>void}){
 const running=tasks.filter(task=>task.busy&&task.status==='running').length;
 return <section className="task-navigation" aria-label="会话任务">
  <div className="task-section-heading"><strong>会话任务</strong><span>{running?`${running} 个生成中`:`${tasks.length} 个任务`}</span></div>
  <button className="button new-task" onClick={onCreate}><Plus size={16}/>新建任务</button>
  <nav className="task-list" aria-label="任务列表">
   {tasks.map(task=>{
    const status=task.status??'idle';
    const Icon=status==='running'?LoaderCircle:status==='success'?CheckCircle2:status==='error'?CircleAlert:Circle;
    const title=task.title?.trim()||`任务 ${task.number}`;
    return <button key={task.id} className={`task-item ${task.id===activeId?'selected':''}`} aria-current={task.id===activeId?'page':undefined} aria-label={`切换任务：${title}`} title={title} onClick={()=>onSelect(task.id)}>
     <span className="task-item-title"><span>{title}</span>{task.dirty&&<i aria-label="未保存"/>}</span>
     <span className={`task-item-status ${status}`}><Icon size={12} className={status==='running'?'spin':''}/>{task.busy&&status!=='running'?'处理中':statusLabels[status]}<span>· {task.kind==='gantt'?'甘特图':'流程图'}</span></span>
    </button>;
   })}
  </nav>
  <p className="task-list-hint">切换任务后，生成仍会继续。<br/>项目需逐个手动保存。</p>
 </section>;
}

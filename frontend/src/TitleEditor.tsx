import {useRef,useState} from 'react';
import {TITLE_MAX_LENGTH} from './model';

export function TitleEditor({title,editable,onChange,onError}:{title:string;editable:boolean;onChange:(title:string)=>void;onError:(message:string)=>void}){
 const [value,setValue]=useState<string|null>(null);
 const editing=useRef(false);
 function finish(cancel=false){
  if(!editing.current||value===null)return;
  editing.current=false;setValue(null);
  if(cancel)return;
  const next=value.trim().replace(/\s+/gu,' ');
  if(!next){onError('图题不能为空，已保留原图题。');return;}
  if(next!==title)onChange(next);
 }
 if(!editable)return <>{title}</>;
 if(value!==null)return <input className="title-editor" aria-label="编辑图表标题" autoFocus value={value} maxLength={TITLE_MAX_LENGTH}
  onChange={e=>setValue(e.target.value)} onBlur={()=>finish()} onKeyDown={e=>{
   if(e.nativeEvent.isComposing||e.keyCode===229)return;
   if(e.key==='Enter'){e.preventDefault();finish();}
   if(e.key==='Escape'){e.preventDefault();e.stopPropagation();finish(true);}
  }}/>;
 return <button type="button" className="title-edit-button" aria-label="编辑图表标题" title="点击修改标题" onClick={()=>{editing.current=true;setValue(title)}}>{title}</button>;
}

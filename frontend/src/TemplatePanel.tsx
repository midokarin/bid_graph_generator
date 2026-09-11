import {useState} from 'react';
import {Check,Palette,Settings2} from 'lucide-react';
import {Diagram} from './Diagram';
import {TEMPLATE_CATEGORIES,templatesFor,type TemplateCategory} from './templates';
import {withAppearance,type Snapshot} from './model';
export function TemplatePanel({snapshot,onSelect,onCustomize}:{snapshot:Snapshot;onSelect:(id:string)=>void;onCustomize:()=>void}){
 const [filter,setFilter]=useState<TemplateCategory>('全部');
 const templates=templatesFor(snapshot.kind);
 const categories=TEMPLATE_CATEGORIES.filter(c=>c==='全部'||templates.some(t=>t.category===c));
 const category=categories.includes(filter)?filter:'全部';
 const shown=templates.filter(t=>category==='全部'||t.category===category);
 return <section className="template-panel panel" aria-label="样式与模板">
  <div className="template-heading"><Palette size={18}/><strong>样式与模板</strong><span>{templates.length}</span></div>
  <div className="template-scroll">
   <div className="template-filters" role="group" aria-label="模板场景">{categories.map(c=><button key={c} aria-pressed={category===c} onClick={()=>setFilter(c)}>{c}</button>)}</div>
   <div className="template-cards">{shown.map(t=>{const selected=JSON.stringify(snapshot.appearance)===JSON.stringify(t.appearance);return <button key={t.id} className={'template-card '+(selected?'selected':'')} aria-pressed={selected} onClick={()=>onSelect(t.id)}>
    <div className="template-thumbnail" aria-hidden="true" style={{background:t.appearance.backgroundColor}}><Diagram snapshot={withAppearance(snapshot,t.appearance)}/></div>
    <div className="template-card-label"><strong>{t.name}</strong>{selected&&<span><Check size={13}/>当前</span>}</div><div className="template-tags">{t.tags.map(tag=><span key={tag}>{tag}</span>)}</div><p>{t.description}</p>
   </button>})}</div>
   <p className="template-note">仅调整图表外观，不套入业务内容。正式稿确认后应用，并保留上一版本。</p>
  </div>
  <div className="template-footer"><button className="button full" onClick={onCustomize}><Settings2 size={16}/>自定义图表样式</button></div>
 </section>;
}

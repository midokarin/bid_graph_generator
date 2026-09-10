import {Check,Palette,Settings2} from 'lucide-react';
import {Diagram} from './Diagram';
import {TEMPLATES} from './templates';
import {withAppearance,type Snapshot} from './model';
export function TemplatePanel({snapshot,onSelect,onCustomize}:{snapshot:Snapshot;onSelect:(id:string)=>void;onCustomize:()=>void}){
 return <section className="template-panel panel" aria-label="样式与模板"><div className="template-heading"><Palette size={18}/><strong>样式与模板</strong><span>{TEMPLATES.length}</span></div><div className="template-scroll"><p className="template-intro">选择喜欢的样式，预览整张图表的效果。</p><div className="template-cards">{TEMPLATES.map(t=>{const selected=JSON.stringify(snapshot.appearance)===JSON.stringify(t.appearance);return <button key={t.id} className={'template-card '+(selected?'selected':'')} aria-pressed={selected} onClick={()=>onSelect(t.id)}><div className="template-thumbnail" aria-hidden="true" style={{background:t.appearance.backgroundColor}}><Diagram snapshot={withAppearance(snapshot,t.appearance)}/></div><div className="template-card-label"><strong>{t.name}</strong>{selected&&<span><Check size={13}/>当前</span>}</div><p>{t.description}</p></button>})}</div><p className="template-note">模板仅调整外观，保留已编辑的文字和节点位置。</p></div><div className="template-footer"><button className="button full" onClick={onCustomize}><Settings2 size={16}/>自定义字体与颜色</button></div></section>;
}

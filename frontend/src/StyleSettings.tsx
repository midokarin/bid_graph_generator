import {useId} from 'react';
import {FONTS,type Snapshot} from './model';
import {adjustment,DEFAULT_ADJUSTMENT,STYLE_PRESETS,type StyleAdjustment} from './styleDraft';

export function StyleSettings({snapshot,disabled,error,onChange}:{snapshot?:Snapshot;disabled:boolean;error:string;onChange:(patch:Partial<StyleAdjustment>)=>void}){
 const prefix=useId();
 const value=snapshot?adjustment(snapshot):DEFAULT_ADJUSTMENT;
 return <div className="layout-settings">
  <div className="style-heading"><h3>让图表更好读</h3><span>实时预览</span></div>
  <p className="muted">{snapshot?'边调整，边看右侧效果。满意后再应用。':'生成图表后，即可在这里调整外观。'}</p>
  <fieldset disabled={disabled||!snapshot}>
   <div className="field-label field-row"><span>快捷样式</span><button className="text-button" onClick={()=>onChange(DEFAULT_ADJUSTMENT)}>恢复默认版式</button></div>
   <div className="style-presets" role="group" aria-label="快捷样式">{STYLE_PRESETS.map(p=>{
    const selected=value.font_size===p.font_size&&value.stroke_width===p.stroke_width&&value.corner_radius===p.corner_radius;
    return <button key={p.name} className={selected?'selected':''} aria-pressed={selected} onClick={()=>onChange({font_size:p.font_size,stroke_width:p.stroke_width,corner_radius:p.corner_radius})}><span className="style-preset-symbol" aria-hidden="true" style={{borderWidth:p.stroke_width,borderRadius:Math.min(12,p.corner_radius)}}>Aa</span><strong>{p.name}</strong><small>{p.hint}</small></button>;
   })}</div>
   <label className="field-label" htmlFor={`${prefix}-font-family`}>字体选择</label>
   <select id={`${prefix}-font-family`} value={value.font_family} onChange={e=>onChange({font_family:e.target.value})}>{FONTS.map(font=><option key={font} value={font}>{font==='sans-serif'?'系统默认（推荐）':font==='PingFang SC'?'苹方（macOS）':font}</option>)}</select>
   <p className="source-note">未安装的字体会使用系统替代字体。</p>
   <StyleSlider id={`${prefix}-font-size`} label="图内字号" value={value.font_size} min={8} max={Math.max(24,value.font_size)} step={1} unit="磅" start="小" end="大" onChange={font_size=>onChange({font_size})}/>
   <StyleSlider id={`${prefix}-stroke-width`} label="线条粗细" value={value.stroke_width} min={.5} max={Math.max(5,value.stroke_width)} step={.5} unit="px" start="纤细" end="醒目" onChange={stroke_width=>onChange({stroke_width})}/>
   <StyleSlider id={`${prefix}-corner-radius`} label={snapshot?.kind==='gantt'?'进度条圆角':'节点圆角'} value={value.corner_radius} min={0} max={Math.max(24,value.corner_radius)} step={1} unit="px" start="直角" end="圆润" onChange={corner_radius=>onChange({corner_radius})}/>
   <p className="source-note">{snapshot?.kind==='gantt'?'调整任务进度条外观，工期和里程碑保持不变。':'圆角作用于普通步骤，判断等特殊图形保留原形状。'}</p>
  </fieldset>
  {error&&<p className="error-card style-error" role="alert">{error}</p>}
 </div>;
}
function StyleSlider({id,label,value,min,max,step,unit,start,end,onChange}:{id:string;label:string;value:number;min:number;max:number;step:number;unit:string;start:string;end:string;onChange:(value:number)=>void}){
 return <div className="style-slider"><div className="field-row"><label className="field-label" htmlFor={id}>{label}</label><output htmlFor={id}>{value} {unit}</output></div><input id={id} type="range" min={min} max={max} step={step} value={value} aria-valuetext={`${value} ${unit}`} onChange={e=>onChange(Number(e.target.value))}/><div className="slider-scale"><span>{start}</span><span>{end}</span></div></div>;
}
export function describeChange(value:string|number,field:string){if(field==='appearance'){try{const a=JSON.parse(String(value));return `字体：${a.fontFamily}；文字：${a.textColor}；线条：${a.strokeColor}；填充：${a.fillColor}；背景：${a.backgroundColor}；线宽：${a.strokeWidth} px；圆角：${a.cornerRadius} px`;}catch{return String(value)}}if(field==='nodePosition'){try{const p=JSON.parse(String(value));return `横向 ${p.x}，纵向 ${p.y}`;}catch{return String(value)}}return value;}

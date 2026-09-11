import {assertReadable,DEFAULT_STYLE,FONTS,view,type Snapshot} from './model';
import type {Style} from './domain/generated/ProjectFile';

export type StyleAdjustment=Pick<Style,'font_family'|'font_size'|'stroke_width'|'corner_radius'>;
export const DEFAULT_ADJUSTMENT:StyleAdjustment={font_family:DEFAULT_STYLE.font_family,font_size:DEFAULT_STYLE.font_size,stroke_width:DEFAULT_STYLE.stroke_width,corner_radius:DEFAULT_STYLE.corner_radius};
export const STYLE_PRESETS=[
 {name:'标准',hint:'日常文档',font_size:12,stroke_width:1.5,corner_radius:5},
 {name:'醒目',hint:'强调轮廓',font_size:12,stroke_width:3,corner_radius:5},
 {name:'柔和',hint:'圆润线条',font_size:12,stroke_width:1,corner_radius:16},
];
export function adjustment(s:Snapshot):StyleAdjustment{
 const {font_family,font_size,stroke_width,corner_radius}=s.version.style;
 return {font_family,font_size,stroke_width,corner_radius};
}
// The preview is a temporary projection. Only the explicit Apply action appends it.
export function previewStyle(base:Snapshot,patch:Partial<StyleAdjustment>):Snapshot|null{
 const values={...adjustment(base),...patch};
 if(JSON.stringify(values)===JSON.stringify(adjustment(base)))return null;
 return view({...base.version,style:{...base.version.style,...values,template:'custom'},origin:'style'});
}
export function styleError(s:Snapshot):string{
 const a=adjustment(s);
 if(!FONTS.includes(a.font_family)||!Number.isFinite(a.font_size)||a.font_size<8||a.font_size>72||!Number.isFinite(a.stroke_width)||a.stroke_width<.5||a.stroke_width>10||!Number.isFinite(a.corner_radius)||a.corner_radius<0||a.corner_radius>50)return '版式参数无效，请重新调整。';
 try{assertReadable(s.version);return ''}catch{return '字号偏大，部分文字可能超出图形。请减小字号后再应用。'}
}

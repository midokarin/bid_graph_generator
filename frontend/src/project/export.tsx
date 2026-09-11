import {Diagram} from '../Diagram';
import type {Snapshot} from '../model';
export type ExportOptions={includeTitle:boolean;background:'white'|'transparent'|'custom';color:string};
export const DEFAULT_EXPORT:ExportOptions={includeTitle:true,background:'white',color:'#ffffff'};
export function readExport(value:unknown):ExportOptions {
 const v=value as Partial<ExportOptions>|null;
 return {includeTitle:typeof v?.includeTitle==='boolean'?v.includeTitle:true,background:v?.background==='transparent'||v?.background==='custom'?v.background:'white',color:typeof v?.color==='string'&&/^#[0-9a-f]{6}$/i.test(v.color)?v.color:'#ffffff'};
}
export function dimensions(s:Snapshot,o:ExportOptions){
 const {width,height}=s.version.layout;
 const titleLines=o.includeTitle?(Array.from(s.title).join('').match(new RegExp(`.{1,${Math.max(1,Math.floor((width-48)/26))}}`,'gu'))??[]):[];
 const title=titleLines.length?titleLines.length*34+30:0;
 return {width:Math.ceil(width*3),height:Math.ceil((height+title)*3),viewWidth:width,viewHeight:height+title,title,titleLines};
}
export function ExportSheet({snapshot,options}:{snapshot:Snapshot;options:ExportOptions}){
 const d=dimensions(snapshot,options),background=options.background==='transparent'?'none':options.background==='white'?'#ffffff':options.color;
 const transparent={...snapshot,version:{...snapshot.version,style:{...snapshot.version.style,transparent_background:true}}};
 return <svg xmlns="http://www.w3.org/2000/svg" width={d.width} height={d.height} viewBox={`0 0 ${d.viewWidth} ${d.viewHeight}`} role="img" aria-label="导出图表预览" style={{width:'100%',height:'auto',fontFamily:snapshot.appearance.fontFamily}}><rect width={d.viewWidth} height={d.viewHeight} fill={background}/>{d.titleLines.map((line,i)=><text key={i} x={d.viewWidth/2} y={38+i*34} textAnchor="middle" fontSize={26} fontWeight={600} fill={snapshot.appearance.textColor}>{line}</text>)}<svg x={0} y={d.title} width={snapshot.version.layout.width} height={snapshot.version.layout.height} viewBox={`0 0 ${snapshot.version.layout.width} ${snapshot.version.layout.height}`}><Diagram snapshot={transparent}/></svg></svg>;
}
export async function svgText(snapshot:Snapshot,options:ExportOptions){const {renderToStaticMarkup}=await import('react-dom/server');return '<?xml version="1.0" encoding="UTF-8"?>\n'+renderToStaticMarkup(<ExportSheet snapshot={snapshot} options={options}/>)}
export async function imageBlob(snapshot:Snapshot,options:ExportOptions,format:'png'|'svg'){
 await document.fonts.ready;
 const svg=new Blob([await svgText(snapshot,options)],{type:'image/svg+xml;charset=utf-8'});if(format==='svg')return svg;
 const size=dimensions(snapshot,options);if(size.width*size.height>80_000_000||size.width>32767||size.height>32767)throw new Error('PNG 尺寸超过浏览器安全上限，请导出 SVG。');
 const url=URL.createObjectURL(svg);try{const image=new Image();await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error('浏览器无法转换 SVG。'));image.src=url});const {width,height}=dimensions(snapshot,options),canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const context=canvas.getContext('2d');if(!context)throw new Error('浏览器无法创建图片画布。');context.drawImage(image,0,0,width,height);return await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('PNG 导出失败。')),'image/png'))}finally{URL.revokeObjectURL(url)}
}

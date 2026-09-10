import {Diagram} from '../Diagram';
import type {Snapshot} from '../model';
export type ExportOptions={paper:'A4'|'A3';orientation:'portrait'|'landscape';includeTitle:boolean;background:'white'|'transparent'|'custom';color:string};
export const DEFAULT_EXPORT:ExportOptions={paper:'A4',orientation:'portrait',includeTitle:true,background:'white',color:'#ffffff'};
export function readExport(value:unknown):ExportOptions {
 const v=value as Partial<ExportOptions>|null;
 return {paper:v?.paper==='A3'?'A3':'A4',orientation:v?.orientation==='landscape'?'landscape':'portrait',includeTitle:typeof v?.includeTitle==='boolean'?v.includeTitle:true,background:v?.background==='transparent'||v?.background==='custom'?v.background:'white',color:typeof v?.color==='string'&&/^#[0-9a-f]{6}$/i.test(v.color)?v.color:'#ffffff'};
}
export function dimensions(s:Snapshot,o:ExportOptions){
 const mm=o.paper==='A4'?[210,297]:[297,420];if(o.orientation==='landscape')mm.reverse();
 const width=Math.round(mm[0]/25.4*300),paperHeight=Math.round(mm[1]/25.4*300),margin=Math.round(15/25.4*300),title=o.includeTitle?110:0;
 const scale=(width-2*margin)/s.version.layout.width;
 // Preserve readability and allow a single long Gantt image, never paginate.
 const height=Math.max(paperHeight,Math.ceil(s.version.layout.height*scale+2*margin+title));
 return {width,height,margin,title,scale};
}
export function ExportSheet({snapshot,options}:{snapshot:Snapshot;options:ExportOptions}){
 const d=dimensions(snapshot,options),background=options.background==='transparent'?'none':options.background==='white'?'#ffffff':options.color;
 const transparent={...snapshot,version:{...snapshot.version,style:{...snapshot.version.style,transparent_background:true}}};
 return <svg xmlns="http://www.w3.org/2000/svg" width={d.width} height={d.height} viewBox={`0 0 ${d.width} ${d.height}`} role="img" aria-label="导出图表预览" style={{width:'100%',height:'auto',fontFamily:snapshot.appearance.fontFamily}}><rect width={d.width} height={d.height} fill={background}/>{options.includeTitle&&<text x={d.width/2} y={d.margin+55} textAnchor="middle" fontSize={52} fontWeight={600} fill={snapshot.appearance.textColor}>{snapshot.title}</text>}<svg x={d.margin} y={d.margin+d.title} width={d.width-2*d.margin} height={snapshot.version.layout.height*d.scale} viewBox={`0 0 ${snapshot.version.layout.width} ${snapshot.version.layout.height}`}><Diagram snapshot={transparent}/></svg></svg>;
}
export async function svgText(snapshot:Snapshot,options:ExportOptions){const {renderToStaticMarkup}=await import('react-dom/server');return '<?xml version="1.0" encoding="UTF-8"?>\n'+renderToStaticMarkup(<ExportSheet snapshot={snapshot} options={options}/>)}
export async function imageBlob(snapshot:Snapshot,options:ExportOptions,format:'png'|'svg'){
 await document.fonts.ready;
 const svg=new Blob([await svgText(snapshot,options)],{type:'image/svg+xml;charset=utf-8'});if(format==='svg')return svg;
 const size=dimensions(snapshot,options);if(size.width*size.height>80_000_000||size.height>32767)throw new Error('PNG 尺寸超过浏览器安全上限，请导出 SVG。');
 const url=URL.createObjectURL(svg);try{const image=new Image();await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error('浏览器无法转换 SVG。'));image.src=url});const {width,height}=dimensions(snapshot,options),canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const context=canvas.getContext('2d');if(!context)throw new Error('浏览器无法创建图片画布。');context.drawImage(image,0,0,width,height);return await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('PNG 导出失败。')),'image/png'))}finally{URL.revokeObjectURL(url)}
}

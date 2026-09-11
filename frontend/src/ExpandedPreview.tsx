import {useState} from 'react';
import {Minus,Plus} from 'lucide-react';
import {Diagram} from './Diagram';
import type {Snapshot} from './model';
import './expanded-preview.css';

export function ExpandedPreview({snapshot,caption}:{snapshot:Snapshot;caption?:string}){
 const [zoom,setZoom]=useState(100);
 return <>
  <div className="expanded-preview-heading"><h2>放大预览</h2><span className="muted">{caption??`v${snapshot.revision} · ${snapshot.kind==='flowchart'?'流程图':'甘特图'}`}</span></div>
  <div className="expanded-preview-canvas" tabIndex={0} aria-label="放大图表画布">
   <div className="expanded-preview-sheet" style={{width:`${zoom}%`,background:snapshot.version.style.transparent_background?'transparent':snapshot.appearance.backgroundColor}}>
    <div className="expanded-preview-title" style={{fontFamily:snapshot.appearance.fontFamily,color:snapshot.appearance.textColor}}>{snapshot.title}</div>
    <Diagram snapshot={snapshot} locked/>
   </div>
  </div>
  <div className="expanded-preview-footer"><span className="muted">按 Esc 返回编辑</span><div className="zoom-controls">
   <button aria-label="缩小预览" disabled={zoom<=50} onClick={()=>setZoom(z=>Math.max(50,z-25))}><Minus size={16}/></button>
   <span aria-live="polite">{zoom}%</span>
   <button aria-label="放大预览图表" disabled={zoom>=200} onClick={()=>setZoom(z=>Math.min(200,z+25))}><Plus size={16}/></button>
   <button onClick={()=>setZoom(100)}>适配宽度</button>
  </div></div>
 </>;
}

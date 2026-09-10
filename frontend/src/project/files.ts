import type {ProjectFile} from '../domain/generated/ProjectFile';
import {validateProjectFile} from '../domain/validate';
export const MAX_PROJECT_BYTES=20*1024*1024;
export interface ProjectHandle {name:string;getFile():Promise<File>;createWritable():Promise<{write(data:string):Promise<void>;close():Promise<void>;abort():Promise<void>}>}
type PickerWindow=Window & {showOpenFilePicker?:(options:unknown)=>Promise<ProjectHandle[]>;showSaveFilePicker?:(options:unknown)=>Promise<ProjectHandle>};
const types=[{description:'标绘项目 JSON',accept:{'application/json':['.json']}}];
export function parseProject(text:string):{project:ProjectFile;migrated:boolean}{
 if(new TextEncoder().encode(text).length>MAX_PROJECT_BYTES)throw new Error('项目文件超过 20 MB 上限。');
 let value:unknown;try{value=JSON.parse(text)}catch{throw new Error('项目文件不是有效的 JSON。')}
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('项目文件结构无效。');
 const data=value as Record<string,unknown>,version=data.project_file_version;
 const migrated=version==='0.9';
 if(migrated){data.project_file_version='1.0';if(!('metadata' in data))data.metadata={}}
 else if(version!=='1.0')throw new Error(`项目文件版本 ${String(version)} 不受支持；请使用支持 ${String(version)} 的新版程序，当前支持 1.0。`);
 if(!validateProjectFile(data))throw new Error('项目结构校验失败，字段、引用或布局无效，未打开文件。');
 return {project:data,migrated};
}
export function downloadBlob(blob:Blob,name:string){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000)}
export async function openFile():Promise<{text:string;handle:ProjectHandle|null;name:string}|null>{
 const picker=(window as PickerWindow).showOpenFilePicker;
 let file:File,handle:ProjectHandle|null=null;
 if(picker){[handle]=await picker.call(window,{types,multiple:false});file=await handle.getFile()}
 else {const chosen=await new Promise<File|null>(resolve=>{const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.onchange=()=>resolve(input.files?.[0]??null);input.oncancel=()=>resolve(null);input.click()});if(!chosen)return null;file=chosen}
 if(file.size>MAX_PROJECT_BYTES)throw new Error('项目文件超过 20 MB 上限。');
 return {text:await file.text(),handle,name:file.name};
}
export async function writeProject(project:ProjectFile,handle:ProjectHandle|null,saveAs=false):Promise<{handle:ProjectHandle|null;confirmed:boolean}>{
 if(!validateProjectFile(project))throw new Error('项目数据无效，无法保存。');
 const text=JSON.stringify(project,null,2)+'\n';
 if(new TextEncoder().encode(text).length>MAX_PROJECT_BYTES)throw new Error('项目超过 20 MB，无法保存。');
 const picker=(window as PickerWindow).showSaveFilePicker;
 let target=saveAs?null:handle;
 if(!target&&picker)target=await picker.call(window,{types,suggestedName:'diagram.project.json'});
 if(!target){downloadBlob(new Blob([text],{type:'application/json'}),'diagram.project.json');return {handle:null,confirmed:false}}
 const stream=await target.createWritable();
 try{await stream.write(text);await stream.close()}catch(error){await stream.abort().catch(()=>{});throw error}
 return {handle:target,confirmed:true};
}

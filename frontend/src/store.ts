import {create} from 'zustand';
import type {VersionSnapshot} from './domain/generated/ProjectFile';
import {assertReadable,view,type Snapshot,type Kind} from './model';
import {validateProjectFile} from './domain/validate';
export function nextVersion(history:VersionSnapshot[],version:VersionSnapshot):VersionSnapshot{
 assertReadable(version);
 const candidate={...structuredClone(version),revision:Math.max(0,...history.map(v=>v.revision))+1,created_at:new Date().toISOString()};
 if(!validateProjectFile({project_file_version:'1.0',diagram_type:candidate.spec.diagram_type,source_text:'',current_revision:candidate.revision,versions:[candidate],metadata:{}}))throw new Error('版本数据未通过校验，未保存修改。');
 return candidate;
}
type State={activeKind:Kind;histories:Record<Kind,VersionSnapshot[]>;activate:(kind:Kind)=>void;versions:VersionSnapshot[];activeRevision:number|null;dirty:boolean;append:(v:VersionSnapshot)=>void;select:(r:number)=>void};
export const useWorkspace=create<State>((set,get)=>({activeKind:'flowchart',histories:{flowchart:[],gantt:[]},versions:[],activeRevision:null,dirty:false,
 activate:kind=>set(state=>({activeKind:kind,versions:state.histories[kind],activeRevision:state.histories[kind].at(-1)?.revision??null})),
 append:version=>set(state=>{const v=nextVersion(state.versions,version);return {versions:[...state.versions,v],histories:{...state.histories,[state.activeKind]:[...state.versions,v]},activeRevision:v.revision,dirty:true}}),
 select:revision=>{if(get().versions.some(v=>v.revision===revision))set({activeRevision:revision})}}));
export const historyViews=(versions:VersionSnapshot[]):Snapshot[]=>versions.map(view);

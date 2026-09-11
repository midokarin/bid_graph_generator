import {create} from 'zustand';
import type {VersionSnapshot,ProjectFile} from './domain/generated/ProjectFile';
import {assertReadable,view,type Snapshot,type Kind} from './model';
import {validateProjectFile} from './domain/validate';
export function nextVersion(history:VersionSnapshot[],version:VersionSnapshot):VersionSnapshot{
 assertReadable(version);
 const candidate={...structuredClone(version),revision:Math.max(0,...history.map(v=>v.revision))+1,created_at:new Date().toISOString()};
 if(!validateProjectFile({project_file_version:'1.0',diagram_type:candidate.spec.diagram_type,source_text:'',current_revision:candidate.revision,versions:[candidate],metadata:{}}))throw new Error('版本数据未通过校验，未保存修改。');
 return candidate;
}
type State={activeKind:Kind;selections:Record<Kind,number|null>;histories:Record<Kind,VersionSnapshot[]>;activate:(kind:Kind)=>void;versions:VersionSnapshot[];activeRevision:number|null;dirty:boolean;dirtyKinds:Record<Kind,boolean>;touch:()=>void;markSaved:()=>void;load:(project:ProjectFile,migrated:boolean)=>void;append:(v:VersionSnapshot)=>void;select:(r:number)=>void};
export const createWorkspace=()=>create<State>((set,get)=>({activeKind:'flowchart',selections:{flowchart:null,gantt:null},histories:{flowchart:[],gantt:[]},versions:[],activeRevision:null,dirty:false,dirtyKinds:{flowchart:false,gantt:false},
 touch:()=>set(s=>({dirty:true,dirtyKinds:{...s.dirtyKinds,[s.activeKind]:true}})),
 markSaved:()=>set(s=>({dirty:false,dirtyKinds:{...s.dirtyKinds,[s.activeKind]:false}})),
 load:(p,migrated)=>set(s=>({activeKind:p.diagram_type,versions:p.versions,histories:{...s.histories,[p.diagram_type]:p.versions},activeRevision:p.current_revision,selections:{...s.selections,[p.diagram_type]:p.current_revision},dirty:migrated,dirtyKinds:{...s.dirtyKinds,[p.diagram_type]:migrated}})),
 activate:kind=>set(state=>({activeKind:kind,dirty:state.dirtyKinds[kind],versions:state.histories[kind],activeRevision:state.selections[kind]})),
 append:version=>set(state=>{const v=nextVersion(state.versions,version);return {versions:[...state.versions,v],histories:{...state.histories,[state.activeKind]:[...state.versions,v]},activeRevision:v.revision,selections:{...state.selections,[state.activeKind]:v.revision},dirty:true,dirtyKinds:{...state.dirtyKinds,[state.activeKind]:true}}}),
 select:revision=>{if(get().activeRevision!==revision&&get().versions.some(v=>v.revision===revision)){set(s=>({activeRevision:revision,selections:{...s.selections,[s.activeKind]:revision}}));get().touch()}}}));
export const historyViews=(versions:VersionSnapshot[]):Snapshot[]=>versions.map(view);

// The first workspace retains its existing entry point for host integrations.
export const useWorkspace=createWorkspace();
export type WorkspaceStore=ReturnType<typeof createWorkspace>;

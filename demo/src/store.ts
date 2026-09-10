import { create } from 'zustand';
import { type Snapshot } from './model';
export const MAX_HISTORY = 8;
type State = {history:Snapshot[]; activeRevision:number|null; checked:number|null; dirty:boolean; replace:(history:Snapshot[],dirty?:boolean)=>void; append:(s:Snapshot)=>void; select:(revision:number)=>void; check:()=>void; saved:()=>void};
export const useWorkspace = create<State>((set,get)=>({
 history:[],activeRevision:null,checked:null,dirty:false,
 replace:(history,dirty=true)=>{const retained=history.slice(-MAX_HISTORY);set({history:retained,activeRevision:retained.at(-1)?.revision??null,checked:null,dirty});},
 append:s=>set(state=>{const revision=Math.max(0,...state.history.map(item=>item.revision))+1;const next={...s,revision};return {history:[...state.history,next].slice(-MAX_HISTORY),activeRevision:revision,checked:null,dirty:true};}),
 select:revision=>{if(get().history.some(item=>item.revision===revision))set({activeRevision:revision});},
 check:()=>{const state=get();set({checked:state.history.find(item=>item.revision===state.activeRevision)?.revision??null});},
 saved:()=>set({dirty:false})
}));

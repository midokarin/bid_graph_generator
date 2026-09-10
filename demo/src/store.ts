import { create } from 'zustand';
import { type Snapshot } from './model';
type State = {history:Snapshot[]; checked:number|null; dirty:boolean; replace:(history:Snapshot[],dirty?:boolean)=>void; append:(s:Snapshot)=>void; check:()=>void; saved:()=>void};
export const useWorkspace = create<State>((set,get)=>({history:[],checked:null,dirty:false,replace:(history,dirty=true)=>set({history,checked:null,dirty}),append:s=>set({history:[...get().history,s],checked:null,dirty:true}),check:()=>set({checked:get().history.at(-1)?.revision??null}),saved:()=>set({dirty:false})}));

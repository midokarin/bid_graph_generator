import { blockers, canDownload } from './model';
import { useWorkspace } from './store';
type Registry = {registerTool:(tool:{name:string;title:string;description:string;inputSchema:object;annotations:object;execute:(input:unknown)=>unknown},options:{signal:AbortSignal})=>void|Promise<void>};
export function checkVisibleDiagram(input: unknown){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length)throw new Error('此操作不接受参数。');
 const state=useWorkspace.getState(),snapshot=state.history.at(-1);
 if(!snapshot)throw new Error('请先在界面中生成示例草稿。');
 state.check();
 return {revision:snapshot.revision,blockers:blockers(snapshot),draftDownloadAvailable:canDownload(snapshot,useWorkspace.getState().checked),projectCompliance:'unverified'};
}
export function registerDiagramTools(){
 const registry=(document as Document & {modelContext?:Registry}).modelContext;
 if(!registry?.registerTool)return;
 const lifecycle=new AbortController();
 try{void Promise.resolve(registry.registerTool({name:'check_current_demo_diagram',title:'检查当前示例图表',description:'对当前可见图表执行与检查按钮相同的有限演示检查。不会确认规则或生成正式合规结论。',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},execute:checkVisibleDiagram},{signal:lifecycle.signal})).catch(()=>{});}catch{/* Optional browser capability; UI remains available. */}
 return ()=>lifecycle.abort();
}

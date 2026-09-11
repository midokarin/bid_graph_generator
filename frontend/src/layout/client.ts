import ELK from 'elkjs/lib/elk-api.js';
import workerUrl from 'elkjs/lib/elk-worker.min.js?url';
import type {FlowchartSpec,FlowLayout} from '../domain/generated/ProjectFile';
import {flowGraph,readLayout} from './flow';
import {presentationLayout} from './presentation';
export function layoutFlow(spec:FlowchartSpec,signal?:AbortSignal):Promise<FlowLayout>{
 if(signal?.aborted)return Promise.reject(new DOMException('已取消','AbortError'));
 const presentation=presentationLayout(spec);
 if(presentation)return Promise.resolve(presentation);
 return new Promise((resolve,reject)=>{
  const elk=new ELK({workerFactory:()=>new Worker(workerUrl)});
  const finish=()=>{clearTimeout(timer);elk.terminateWorker();signal?.removeEventListener('abort',abort)};
  const abort=()=>{finish();reject(new DOMException('已取消','AbortError'))};
  const timer=setTimeout(()=>{finish();reject(new Error('布局超时，请精简图表后重试。'))},30000);
  signal?.addEventListener('abort',abort,{once:true});
  if(signal?.aborted){abort();return}
  elk.layout(flowGraph(spec)).then(graph=>{const layout=readLayout(spec,graph);finish();resolve(layout)}).catch(error=>{finish();reject(error)});
 });
}

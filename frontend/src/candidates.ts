import type {GenerationRequest} from './domain/generated/GenerationRequest';
import type {FlowchartSpec,FlowLayout,VersionSnapshot} from './domain/generated/ProjectFile';
import {validateFlowchartResult} from './domain/validate';
import {nextVersion} from './store';
import {flowFingerprint} from './layout/flow-similarity';
import {flowQuality} from './layout/flow-quality';
import type {FlowLayoutOptions} from './layout/flow-profile';
import {createGeneration,consumeGeneration,cancelGeneration} from './api/client';

export const FLOW_CANDIDATES = [
 {key:'mainline',label:'主流程优先'},
 {key:'branches',label:'分支清晰'},
 {key:'stages',label:'阶段层次'},
] as const;
export type CandidateKey=typeof FLOW_CANDIDATES[number]['key'];
export type Candidate={key:CandidateKey;label:string;status:'queued'|'running'|'success'|'error'|'cancelled';message:string;attempts:Record<number,string>;snapshot?:VersionSnapshot;quality?:number[];similarTo?:CandidateKey};
type Dependencies={create:typeof createGeneration;consume:typeof consumeGeneration;cancel:typeof cancelGeneration;layout:(spec:FlowchartSpec,signal:AbortSignal,options?:FlowLayoutOptions)=>Promise<FlowLayout>};
type Input={source_text:string;direction:'DOWN'|'RIGHT';title:string;style:VersionSnapshot['style']};
export type CandidateBatch={cancel:()=>Promise<void>;done:Promise<Candidate[]>};

export function recommendedCandidate(candidates:Candidate[]):CandidateKey|undefined {
 // Recommend only after there are at least two valid layouts to compare.
 const ready=candidates.filter(c=>c.snapshot&&c.quality&&c.quality.slice(0,5).every(n=>n===0));
 if(ready.length<2)return;
 return ready.reduce((best,candidate)=>{
  for(let i=0;i<best.quality!.length;i++){
   if(candidate.quality![i]!==best.quality![i])return candidate.quality![i]<best.quality![i]?candidate:best;
  }
  return best;
 }).key;
}

export function startCandidateBatch(input:Input,onUpdate:(candidates:Candidate[])=>void,layout:Dependencies['layout'],overrides:Partial<Dependencies>={}):CandidateBatch {
 const dependencies:Dependencies={create:createGeneration,consume:consumeGeneration,cancel:cancelGeneration,layout,...overrides};
 const control=new AbortController(),jobs=new Set<string>();
 let candidates:Candidate[]=FLOW_CANDIDATES.map(c=>({...c,status:'queued',message:'等待生成',attempts:{}}));
 const update=(key:CandidateKey,patch:Partial<Candidate>)=>{
  candidates=candidates.map(c=>c.key===key?{...c,...patch}:c);onUpdate(candidates);
 };
 onUpdate(candidates);
 const cancel=async()=>{
  control.abort();
  candidates=candidates.map(c=>c.status==='queued'||c.status==='running'?{...c,status:'cancelled',message:'已取消，未创建版本'}:c);onUpdate(candidates);
  const results=await Promise.allSettled([...jobs].map(id=>dependencies.cancel(id)));
  if(results.some(result=>result.status==='rejected'))throw new Error('部分取消请求未送达，本页已忽略后续结果。');
 };
 async function run(key:CandidateKey){
  let jobId:string|undefined;
  try{
   if(control.signal.aborted)return;
   update(key,{status:'running',message:'正在创建任务'});
   const request:GenerationRequest={diagram_type:'flowchart',source_text:input.source_text,direction:input.direction,flow_variant:key};
   const job=await dependencies.create(request);jobId=job.job_id;jobs.add(jobId);
   // Creation deliberately remains observable so a late job ID can be cancelled.
   if(control.signal.aborted){await dependencies.cancel(jobId);return;}
   let result:unknown=null,errorMessage='';
   await dependencies.consume(job.events_url,({event,data})=>{
    if(control.signal.aborted)return;
    if(event==='delta'){
     const attempts=candidates.find(c=>c.key===key)!.attempts;
     update(key,{attempts:{...attempts,[data.attempt]:(attempts[data.attempt]??'')+data.text}});
    }
    if(event==='status'){
     const message:Record<string,string>={queued:'等待模型空位',generating:'正在生成结构',validating:'正在校验结构',repairing:`正在修复结构（第 ${data.attempt} 次）`,completed:'结构已通过，准备布局'};
     if(message[data.state])update(key,{message:message[data.state]});
    }
    if(event==='error')errorMessage=data.message??'生成失败';
    if(event==='result')result=data;
   },control.signal).catch(error=>{throw new Error(errorMessage||(error as Error).message)});
   if(control.signal.aborted)return;
   if(!validateFlowchartResult(result))throw new Error('返回结果未通过前端契约校验。');
   const spec=structuredClone(result.spec);
   spec.title=input.title.trim().replace(/\s+/gu,' ')||spec.title;spec.direction=input.direction;
   update(key,{message:'正在优化布局'});
   const geometry=await dependencies.layout(spec,control.signal,{profile:key,fontSize:input.style.font_size});
   if(control.signal.aborted)return;
   // Validate the complete snapshot before showing or recommending a candidate.
   const snapshot=nextVersion([],{revision:1,created_at:new Date().toISOString(),origin:'ai',spec,layout:geometry,style:input.style,supplements:result.supplements,summary:result.summary});
   update(key,{status:'success',message:'已完成，待选择',snapshot,quality:flowQuality(spec,geometry,input.style.font_size)});
  }catch(error){
   if(!control.signal.aborted)update(key,{status:'error',message:(error as Error).message});
  }finally{if(jobId)jobs.delete(jobId)}
 }
 // Two pipelines per batch; the backend also caps model concurrency across tasks.
 let next=0;
 async function worker(){while(next<FLOW_CANDIDATES.length&&!control.signal.aborted){const candidate=FLOW_CANDIDATES[next++];await run(candidate.key)}}
 const done=Promise.all([worker(),worker()]).then(()=>{
  const seen=new Map<string,CandidateKey>();
  candidates=candidates.map(candidate=>{
   if(!candidate.snapshot)return candidate;
   const fingerprint=flowFingerprint(candidate.snapshot),similarTo=seen.get(fingerprint);
   if(!similarTo)seen.set(fingerprint,candidate.key);
   return {...candidate,similarTo};
  });
  onUpdate(candidates);return candidates;
 });
 return {cancel,done};
}

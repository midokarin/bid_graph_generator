import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {startCandidateBatch,recommendedCandidate,type Candidate} from '../src/candidates';
import ELK from 'elkjs/lib/elk.bundled.js';
import {flowGraph,readLayout} from '../src/layout/flow';
import {createWorkspace} from '../src/store';
import type {ProjectFile,FlowLayout} from '../src/domain/generated/ProjectFile';
const project=JSON.parse(readFileSync(new URL('../../packages/contracts/examples/flowchart-project.json',import.meta.url),'utf8')) as ProjectFile;
const version=project.versions[0];
if(version.spec.diagram_type==='flowchart')version.layout=readLayout(version.spec,await new ELK().layout(flowGraph(version.spec)));
const result={spec:version.spec,supplements:version.supplements,summary:version.summary};
const input={source_text:'保留审核和整改关系',direction:'DOWN' as const,title:'候选测试',style:version.style};
const layout=async()=>structuredClone(version.layout) as FlowLayout;
function deferred<T=void>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>{resolve=r});return {promise,resolve}}

test('three distinct requests, bounded concurrency, partial failure, no history until adoption',async()=>{
 const releases=[deferred(),deferred(),deferred()],third=deferred();let active=0,maxActive=0;
 const requests:any[]=[];let latest:Candidate[]=[];
 const workspace=createWorkspace();
 const batch=startCandidateBatch(input,c=>{latest=c},layout,{
  create:async body=>{const id=requests.length;requests.push(body);return {job_id:String(id),events_url:String(id),state:'queued'}},
  consume:async(url,emit)=>{const id=Number(url);active++;maxActive=Math.max(maxActive,active);if(id===2)third.resolve();await releases[id].promise;active--;if(id===1)throw new Error('仅方案二失败');emit({event:'result',data:result})},
  cancel:async id=>({job_id:id,state:'cancelled'}),
 });
 assert.equal(requests.length,2);releases[1].resolve();await third.promise;
 assert.equal(latest[1].status,'error');assert.equal(latest[0].status,'running');
 releases[2].resolve();releases[0].resolve();await batch.done;
 assert.deepEqual(requests.map(r=>r.flow_variant),['mainline','branches','stages']);
 assert.ok(requests.every(r=>r.source_text===input.source_text&&r.direction==='DOWN'));
 assert.equal(maxActive,2);assert.equal(workspace.getState().versions.length,0);
 assert.equal(latest.filter(c=>c.status==='success').length,2);
 assert.ok(recommendedCandidate(latest));
 workspace.getState().append(latest[2].snapshot!);
 assert.equal(workspace.getState().versions.length,1);
 assert.equal(workspace.getState().versions[0].spec.title,'候选测试');
 assert.deepEqual(workspace.getState().versions[0].layout,latest[2].snapshot!.layout);
});

test('cancel keeps completed candidates, cancels active jobs, never starts queued candidates or accepts late results',async()=>{
 const firstReady=deferred(),releaseLate=deferred(),releaseCreate=deferred();const cancelled:string[]=[];let calls=0;let latest:Candidate[]=[];
 const batch=startCandidateBatch(input,c=>{latest=c;if(c[0].status==='success')firstReady.resolve()},layout,{
  create:async()=>{const id=String(++calls);if(id==='2')await releaseCreate.promise;return {job_id:id,events_url:id,state:'queued'}},
  consume:async(url,emit)=>{if(url==='3')await releaseLate.promise;emit({event:'result',data:result})},
  cancel:async id=>{cancelled.push(id);return {job_id:id,state:'cancelled'}},
 });
 await firstReady.promise;
 // First completion starts third request; second is still waiting for its ID.
 await Promise.resolve();await batch.cancel();releaseCreate.resolve();releaseLate.resolve();await batch.done;
 assert.equal(latest[0].status,'success');
 assert.equal(latest[1].status,'cancelled');assert.equal(latest[1].snapshot,undefined);
 assert.equal(latest[2].status,'cancelled');assert.equal(latest[2].snapshot,undefined);
 assert.ok(cancelled.includes('2'));
 assert.equal(recommendedCandidate(latest),undefined);
 const startCount=deferred();let created=0;
 const pending=deferred();
 const queuedBatch=startCandidateBatch(input,()=>{},layout,{
  create:async()=>{const id=String(++created);if(created===2)startCount.resolve();await pending.promise;return {job_id:id,events_url:id,state:'queued'}},
  consume:async()=>{throw new Error('should never consume cancelled job')},cancel:async id=>({job_id:id,state:'cancelled'}),
 });
 await startCount.promise;await queuedBatch.cancel();pending.resolve();const final=await queuedBatch.done;
 assert.equal(created,2);assert.ok(final.every(c=>c.status==='cancelled'&&!c.snapshot));
});

test('invalid results and unreadable layouts are excluded from selection',async()=>{
 let id=0;
 const batch=startCandidateBatch(input,()=>{},async()=>({...version.layout,width:0}) as FlowLayout,{
  create:async()=>({job_id:String(++id),events_url:String(id),state:'queued'}),
  consume:async(url,emit)=>emit({event:'result',data:url==='1'?{}:result}),
 });
 const candidates=await batch.done;
 assert.ok(candidates.every(c=>c.status==='error'&&!c.snapshot));assert.equal(recommendedCandidate(candidates),undefined);
});

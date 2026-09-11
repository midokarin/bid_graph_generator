import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createGeneration} from '../src/api/client';
const request={diagram_type:'flowchart' as const,source_text:'合成测试',flow_variant:'mainline' as const};

test('old backend rejection explains the required restart without echoing business input',async t=>{
 t.mock.method(globalThis,'fetch',async()=>new Response(JSON.stringify({detail:[{type:'extra_forbidden',loc:['body','flow_variant'],input:'mainline'},{type:'other',input:'PRIVATE_BUSINESS_TEXT'}]}),{status:422}));
 await assert.rejects(createGeneration(request),error=>{
  assert.match((error as Error).message,/后端仍在运行旧版本/);
  assert.match((error as Error).message,/重启后端/);
  assert.doesNotMatch((error as Error).message,/PRIVATE_BUSINESS_TEXT/);
  return true;
 });
});

test('source validation failure is distinguished from backend version mismatch',async t=>{
 t.mock.method(globalThis,'fetch',async()=>new Response(JSON.stringify({detail:[{type:'string_too_long',loc:['body','source_text']}]}),{status:422}));
 await assert.rejects(createGeneration(request),/业务内容未通过校验/);
});

test('malformed validation responses still give a readable request error',async t=>{
 t.mock.method(globalThis,'fetch',async()=>new Response('not json',{status:422}));
 await assert.rejects(createGeneration(request),/生成请求未通过校验/);
});

test('successful job creation retains the response and the candidate variant',async t=>{
 const job={job_id:'test',events_url:'/events',state:'queued'};
 t.mock.method(globalThis,'fetch',async(_url:unknown,options:RequestInit)=>{
  assert.equal(JSON.parse(options.body as string).flow_variant,'mainline');return new Response(JSON.stringify(job),{status:202});
 });
 assert.deepEqual(await createGeneration(request),job);
});

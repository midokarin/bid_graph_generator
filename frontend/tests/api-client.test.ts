import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createGeneration,getModelSettings,saveModelSettings} from '../src/api/client';
const request={diagram_type:'flowchart' as const,source_text:'合成测试',flow_variant:'mainline' as const};

test('empty proxy failures explain how to start the backend for generation and settings',async t=>{
 t.mock.method(globalThis,'fetch',async()=>new Response('',{status:500}));
 for(const action of [()=>createGeneration(request),getModelSettings,()=>saveModelSettings({base_url:'https://example.com/v1',model:'test',api_key:''})]){
  await assert.rejects(action(),/后端已启动.*npm start/);
 }
});

test('empty and HTML success responses do not leak JSON parser errors',async t=>{
 for(const body of ['', '<html>Wrong server</html>']){
  t.mock.method(globalThis,'fetch',async()=>new Response(body));
  await assert.rejects(getModelSettings(),/空内容或无效数据/);
  await assert.rejects(saveModelSettings({base_url:'https://example.com/v1',model:'test',api_key:''}),/空内容或无效数据/);
 }
});

test('settings retains actionable server errors and successful responses',async t=>{
 t.mock.method(globalThis,'fetch',async()=>new Response(JSON.stringify({detail:'请先完成或取消当前生成任务'}),{status:409}));
 await assert.rejects(saveModelSettings({base_url:'https://example.com/v1',model:'test',api_key:''}),/请先完成或取消/);
 const config={base_url:'https://example.com/v1',model:'test',has_api_key:true};
 t.mock.method(globalThis,'fetch',async()=>new Response(JSON.stringify(config)));
 assert.deepEqual(await getModelSettings(),config);
 assert.deepEqual(await saveModelSettings({...config,api_key:''}),config);
});

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

const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
import {execFileSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

// Synthetic 11-task / 2-milestone regression; no provider call or raw user input.
const names=['项目启动与需求调研','需求确认及实施设计','业务功能配置开发与接口联调','历史数据清洗与字段映射','服务器基础环境部署与验证','系统集成测试与缺陷复核','数据迁移演练与结果核对','管理员与业务人员培训实施','生产环境切换与上线检查','正式上线','试运行跟踪与问题修复','成果核验与项目验收交付','最终验收完成'];
const durations=[7,5,21,14,7,7,5,4,1,0,11,4,0];
const pairs=[[0,1],[1,2],[1,3],[1,4],[2,5],[4,5],[5,6],[3,6],[5,7],[6,8],[7,8],[8,9],[9,10],[10,11],[11,12]];
const result={spec:{schema_version:'1.0',diagram_type:'gantt',title:'长任务名回归样例',time_unit:'calendar_day',tasks:names.map((text,i)=>({id:`t${i}`,text,kind:durations[i]?'task':'milestone',duration:durations[i],earliest_start:null})),dependencies:pairs.map(([source,target],i)=>({id:`d${i}`,source:`t${source}`,target:`t${target}`,type:'FS',lag:0}))},supplements:[],summary:'合成回归样例：并行任务、长任务名与零工期里程碑。'};
const python=process.platform==='win32'?'../.venv/Scripts/python.exe':'../.venv/bin/python';
const tasks=JSON.parse(execFileSync(python,['-c','import json,sys; from app.domain.contracts import GanttResult; from app.domain.scheduling import schedule; print(json.dumps([t.model_dump() for t in schedule(GanttResult.model_validate_json(sys.stdin.read()).spec)]))'],{cwd:'backend',input:JSON.stringify(result),encoding:'utf8'}));
assert.equal(Math.max(...tasks.map(t=>t.end)),61);
const out=process.env.BIAOSHU_EVIDENCE_DIR??'tmp/gantt-text';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/v1/health',r=>r.fulfill({json:{provider:'stub',status:'ok'}}));
 await page.route('**/api/v1/generations',r=>r.fulfill({json:{job_id:'gantt-text',events_url:'/api/v1/generations/gantt-text/events',state:'queued'}}));
 const events=[['schedule',{tasks}],['result',result],['status',{state:'completed'}]];
 await page.route('**/api/v1/generations/gantt-text/events',r=>r.fulfill({contentType:'text/event-stream',body:events.map(([event,data],i)=>`id: ${i+1}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join('')}));
 await page.goto(process.env.BIAOSHU_WEB_URL??'http://127.0.0.1:5191');
 await page.getByRole('button',{name:'甘特图',exact:true}).click();
 await page.getByRole('button',{name:'生成图表草稿',exact:true}).click();
 await page.locator('.paper svg').waitFor();
 await page.evaluate(()=>document.fonts.ready);
 assert.equal(await page.locator('.paper [data-task-id]').count(),13);
 async function labels(){return page.locator('.paper [data-task-id]').evaluateAll(groups=>groups.map((g,row)=>{
  const text=g.querySelector('text'),box=text.getBBox();
  return {text:text.textContent,lines:[...text.querySelectorAll('tspan')].map(t=>t.textContent),x:box.x,right:box.x+box.width,top:box.y,bottom:box.y+box.height,row};
 }));}
 function checkBounds(labels){
  assert.deepEqual(labels.map(l=>l.text),names);
  for(const label of labels){
   assert.ok(label.x>=35-.01&&label.right<=225+.01,JSON.stringify(label));
   assert.ok(label.top>=116+label.row*84-36&&label.bottom<=116+label.row*84+48,JSON.stringify(label));
  }
 }
 const initial=await labels();checkBounds(initial);
 for(const width of [1440,1920]){await page.setViewportSize({width,height:width===1440?900:1080});await page.screenshot({path:`${out}/gantt-${width}.png`});}
 await page.locator('.paper svg').screenshot({path:`${out}/gantt-detail.png`});
 const exported=await page.evaluate(async()=>{
  const {useWorkspace}=await import('/src/store.ts'),{view}=await import('/src/model.ts'),{svgText,imageBlob,DEFAULT_EXPORT}=await import('/src/project/export.tsx');
  const state=useWorkspace.getState(),version=state.versions.at(-1),snapshot=view(version);
  const svg=await svgText(snapshot,DEFAULT_EXPORT),doc=new DOMParser().parseFromString(svg,'image/svg+xml');
  const png=await imageBlob(snapshot,DEFAULT_EXPORT,'png'),bitmap=await createImageBitmap(png);
  const pngData=await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.readAsDataURL(png)});
  return {svg,pngData,pngSize:[bitmap.width,bitmap.height],labels:[...doc.querySelectorAll('[data-task-id]')].map(g=>[...g.querySelectorAll('text:first-child tspan')].map(t=>t.textContent)),tasks:version.layout.tasks,versionCount:state.versions.length};
 });
 assert.equal(exported.versionCount,1);assert.deepEqual(exported.tasks,tasks);
 assert.deepEqual(exported.labels,initial.map(l=>l.lines));assert.deepEqual(exported.pngSize,[2700,3972]);
 await writeFile(`${out}/gantt.svg`,exported.svg);await writeFile(`${out}/gantt.png`,Buffer.from(exported.pngData.split(',')[1],'base64'));
 await page.evaluate(async()=>{const {useWorkspace}=await import('/src/store.ts');const state=useWorkspace.getState(),v=state.versions.at(-1);state.append({...v,origin:'style',style:{...v.style,font_size:16}})});
 await page.waitForFunction(()=>document.querySelector('.paper [data-task-id] text')?.getAttribute('font-size')==='22.4');
 checkBounds(await labels());
 const saved=await page.evaluate(async()=>{const {useWorkspace}=await import('/src/store.ts');const state=useWorkspace.getState(),p={project_file_version:'1.0',diagram_type:'gantt',source_text:'合成回归样例',current_revision:state.activeRevision,versions:state.versions,metadata:{}};state.load(JSON.parse(JSON.stringify(p)),false);return {count:state.versions.length,tasks:state.versions.at(-1).layout.tasks}});
 assert.equal(saved.count,2);assert.deepEqual(saved.tasks,tasks);checkBounds(await labels());
 assert.deepEqual(errors,[]);
 const report={browser:browser.version(),fixture:'synthetic SSE response; actual Python scheduling; no live model call',taskCount:11,milestoneCount:2,finish:61,viewports:['1440x900','1920x1080'],fontSizes:[12,16],pngSize:exported.pngSize,previewExportLinesMatch:true,boundsChecked:true,projectRoundTrip:true,pageErrors:errors};
 await writeFile(`${out}/checks.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{await browser.close()}

// Synthetic slow SSE responses test task ownership without calling external models.
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='docs/evidence/concurrent-tasks';await mkdir(out,{recursive:true});
const fixtures=Object.fromEntries(await Promise.all(['flowchart','gantt'].map(async kind=>[kind,JSON.parse(await readFile(`packages/contracts/examples/${kind}-project.json`,'utf8'))])));
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const jobs=[];
await page.addInitScript(()=>{
 window.__saved=[];
 window.showSaveFilePicker=async()=>({createWritable:async()=>({write:async content=>window.__saved.push(JSON.parse(content)),close:async()=>{}})});
});
await page.route('**/api/v1/health',r=>r.fulfill({json:{provider:'stub',status:'ok'}}));
await page.route('**/api/v1/generations',async r=>{
 const job={id:String(jobs.length+1),request:r.request().postDataJSON(),cancelled:false};jobs.push(job);
 await r.fulfill({json:{job_id:job.id,events_url:`/api/v1/generations/${job.id}/events`,state:'queued'}});
});
await page.route(/\/api\/v1\/generations\/\d+$/,async r=>{
 const job=jobs.find(j=>r.request().url().endsWith('/'+j.id));job.cancelled=true;
 await r.fulfill({json:{job_id:job.id,state:'cancelled'}});
});
await page.route(/\/api\/v1\/generations\/\d+\/events$/,async r=>{
 const job=jobs.find(j=>r.request().url().includes('/'+j.id+'/events'));
 const events=await new Promise(resolve=>{job.release=resolve});
 await r.fulfill({contentType:'text/event-stream',body:events.map(([event,data],i)=>`id: ${i+1}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join('')}).catch(()=>{});
});
const visible=()=>page.locator('.task-workbench:not([hidden])');
const button=name=>visible().getByRole('button',{name,exact:true});
const switchTo=title=>button(`切换任务：${title}`).click();
const waitFor=async predicate=>{const until=Date.now()+10000;while(!predicate()){assert.ok(Date.now()<until,'condition timed out');await new Promise(r=>setTimeout(r,20))}};
const start=async(title,kind='flowchart')=>{
 if(kind==='gantt')await button('甘特图').click();
 await visible().getByRole('textbox',{name:'图题',exact:true}).fill(title);
 await visible().getByRole('textbox',{name:'业务内容 *',exact:true}).fill(`合成验证 ${title}`);
 await button('生成图表草稿').click();await waitFor(()=>jobs.at(-1)?.release);
 return jobs.at(-1);
};
const complete=job=>{
 const version=fixtures[job.request.diagram_type].versions[0];
 const events=[['delta',{attempt:0,text:JSON.stringify({task:job.request.source_text})}]];
 if(job.request.diagram_type==='gantt')events.push(['schedule',{tasks:version.layout.tasks}]);
 events.push(['result',{spec:version.spec,supplements:version.supplements,summary:version.summary}],['status',{state:'completed'}]);job.release(events);
};
const history=async(expected)=>{
 await button('版本记录').click();
 const names=await visible().locator('dialog .version-name').allTextContents();assert.deepEqual(names,expected);
 await button('关闭弹窗').click();
};
try{
 await page.goto(process.env.BIAOSHU_WEB_URL??'http://127.0.0.1:5191');
 const a=await start('流程任务 A');
 await button('新建任务').click();
 assert.equal(await visible().getByRole('textbox',{name:'业务内容 *',exact:true}).inputValue(),'');
 const b=await start('流程任务 B');
 await button('新建任务').click();const c=await start('甘特任务 C','gantt');
 assert.equal(jobs.length,3);assert.equal(jobs.filter(j=>j.cancelled).length,0);
 for(const width of [1440,1920]){await page.setViewportSize({width,height:width===1440?900:1080});await page.screenshot({path:`${out}/concurrent-${width}.png`})}
 complete(b);await switchTo('流程任务 B');await visible().locator('.paper').waitFor();await history(['流程任务 B']);
 await switchTo('流程任务 A');await button('取消生成').click();await waitFor(()=>a.cancelled);
 complete(a); // Late successful response must not produce a version in the cancelled task.
 await button('生成图表草稿').waitFor();await history([]);
 complete(c);await switchTo('甘特任务 C');await visible().locator('.paper').waitFor();await history(['甘特任务 C']);
 await button('保存项目').click();await visible().getByText('已保存',{exact:true}).waitFor();
 await switchTo('流程任务 B');
 assert.equal(await visible().getByRole('textbox',{name:'业务内容 *',exact:true}).inputValue(),'合成验证 流程任务 B');
 await button('版式设置').click();await visible().getByRole('slider',{name:'图内字号',exact:true}).fill('17');
 await switchTo('甘特任务 C');await switchTo('流程任务 B');
 assert.equal(await visible().getByRole('slider',{name:'图内字号',exact:true}).inputValue(),'17');
 await button('应用版式').click();await history(['流程任务 B','流程任务 B']);
 await button('版本记录').click();await visible().locator('.version-card').last().click();
 await button('版本记录').click();await button('将当前查看恢复为新版本').click();
 await history(['流程任务 B','流程任务 B','流程任务 B']);
 await button('保存项目').click();await visible().getByText('已保存',{exact:true}).waitFor();
 const saved=await page.evaluate(()=>window.__saved);
 assert.equal(saved.length,2);assert.equal(saved[0].diagram_type,'gantt');assert.equal(saved[0].versions.length,1);
 assert.equal(saved[1].source_text,'合成验证 流程任务 B');assert.equal(saved[1].versions.length,3);
 assert.ok(saved[1].versions.every(v=>v.spec.title==='流程任务 B'));
 await switchTo('流程任务 A');await history([]);
 const retry=await start('流程任务 A');await switchTo('流程任务 B');complete(retry);
 await switchTo('流程任务 A');await visible().locator('.paper').waitFor();await history(['流程任务 A']);
 await switchTo('流程任务 B');await history(['流程任务 B','流程任务 B','流程任务 B']);
 for(const width of [1440,1920]){await page.setViewportSize({width,height:width===1440?900:1080});await page.screenshot({path:`${out}/completed-${width}.png`})}
 await button('版本记录').click();await page.screenshot({path:`${out}/history-1920.png`});await button('关闭弹窗').click();
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:`${out}/mobile-390.png`});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal page overflow');
 await button('新建任务').click();await visible().getByRole('textbox',{name:'图题',exact:true}).fill('移动端任务');
 await switchTo('甘特任务 C');await history(['甘特任务 C']);
 const duplicates=await page.evaluate(()=>{const ids=[...document.querySelectorAll('[id]')].map(e=>e.id);return ids.filter((id,i)=>ids.indexOf(id)!==i)});
 assert.deepEqual(duplicates,[]);assert.deepEqual(errors,[]);
 await writeFile(`${out}/browser-result.json`,JSON.stringify({provider:'synthetic intercepted SSE; no external model calls',checks:['three concurrent tasks including same-kind tasks','out-of-order completion','cancel with late result','retry completes in background','task-specific source, history, restore and save','style draft survives switching','mobile navigation','no duplicate DOM IDs','no browser exceptions'],saved:saved.map(p=>({kind:p.diagram_type,revisions:p.versions.length})),errors},null,2)+'\n');
 console.log('Concurrent task browser checks passed.');
}finally{await browser.close()}

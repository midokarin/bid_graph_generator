// Synthetic delayed SSE deliberately delivers failures and late results.
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const result=JSON.parse(await readFile('packages/contracts/examples/flowchart.json','utf8'));
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900}});
const out='docs/evidence/candidates';await mkdir(out,{recursive:true});
const errors=[],jobs=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/api/v1/health',r=>r.fulfill({json:{provider:'stub',status:'ok'}}));
await page.route('**/api/v1/generations',async r=>{
 const job={id:String(jobs.length+1),request:r.request().postDataJSON(),cancelled:false};jobs.push(job);
 await r.fulfill({json:{job_id:job.id,events_url:`/api/v1/generations/${job.id}/events`,state:'queued'}});
});
await page.route(/\/api\/v1\/generations\/\d+$/,async r=>{
 const job=jobs.find(j=>r.request().url().endsWith('/'+j.id));job.cancelled=true;await r.fulfill({json:{job_id:job.id,state:'cancelled'}});
});
await page.route(/\/api\/v1\/generations\/\d+\/events$/,async r=>{
 const job=jobs.find(j=>r.request().url().includes('/'+j.id+'/events'));
 const events=await new Promise(resolve=>{job.release=resolve});
 await r.fulfill({contentType:'text/event-stream',body:events.map(([event,data],i)=>`id: ${i+1}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join('')}).catch(()=>{});
});
const visible=()=>page.locator('.task-workbench:not([hidden])');
const button=name=>visible().getByRole('button',{name,exact:true});
const waitFor=async predicate=>{const until=Date.now()+10000;while(!await predicate()){assert.ok(Date.now()<until,'condition timed out');await new Promise(r=>setTimeout(r,20))}};
const complete=job=>job.release([['result',result],['status',{state:'completed'}]]);
async function history(count){await button('版本记录').click();assert.equal(await visible().locator('.version-card').count(),count);await button('关闭弹窗').click()}
try{
 await page.goto(process.env.BIAOSHU_WEB_URL??'http://127.0.0.1:5192');
 await visible().getByRole('switch',{name:'多方案生成'}).check();await button('生成 3 个方案').click();await waitFor(()=>jobs.length===2&&jobs.every(j=>j.release));
 jobs[1].release([['error',{message:'合成故障：方案二失败'}],['status',{state:'failed'}]]);
 await waitFor(()=>jobs.length===3&&jobs[2].release);
 complete(jobs[0]);await visible().locator('.candidate-card.success').waitFor();
 assert.equal(await visible().locator('.candidate-card.error').count(),1);
 assert.equal(await visible().getByRole('button',{name:'采用此方案',exact:true}).isEnabled(),false);
 await button('放大方案 1').click();await visible().locator('dialog[open]').waitFor();await page.keyboard.press('Escape');
 // Switching away and back must not discard an in-flight batch.
 await button('新建任务').click();await button('切换任务：任务 1').click();
 await button('取消生成').click();await waitFor(()=>jobs[2].cancelled);
 complete(jobs[2]);await waitFor(()=>button('生成 3 个方案').isEnabled());
 assert.equal(await visible().locator('.candidate-card.success').count(),1);
 assert.equal(await visible().locator('.candidate-card.cancelled').count(),1);
 assert.equal(await visible().locator('.candidate-card.error').count(),1);await history(0);
 if(await button('关闭提示').count())await button('关闭提示').click();await page.screenshot({path:`${out}/partial-cancel-1440.png`});
 await visible().getByRole('button',{name:'采用此方案',exact:true}).click();await visible().locator('.paper').waitFor();await history(1);
 const before=await visible().locator('.paper svg').getAttribute('viewBox');
 const count=jobs.length;await button('生成 3 个方案').click();await button('确认重新生成').click();
 await waitFor(()=>jobs.length===count+2&&jobs.slice(count).every(j=>j.release));
 await button('取消生成').click();await waitFor(()=>jobs.slice(count).every(j=>j.cancelled));
 jobs.slice(count).forEach(complete);await visible().locator('.paper').waitFor();
 assert.equal(jobs.length,count+2,'queued third candidate must never be created');
 assert.equal(await visible().locator('.paper svg').getAttribute('viewBox'),before);await history(1);
 assert.deepEqual(errors,[]);
 await writeFile(`${out}/cancellation-result.json`,JSON.stringify({provider:'synthetic delayed browser SSE, no external calls',checks:['partial failure does not stop others','completed candidate preview during generation','batch survives task switching','cancel preserves successful candidates','late results ignored','adoption creates one version','cancel queued candidates without creation','cancel entire regeneration restores prior diagram'],errors},null,2)+'\n');
 console.log('Candidate cancellation browser checks passed.');
}finally{await browser.close()}

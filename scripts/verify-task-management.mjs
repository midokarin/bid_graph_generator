// Synthetic slow SSE responses test task ownership without calling external models.
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='docs/evidence/task-management';await mkdir(out,{recursive:true});
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
 if(job.request.source_text.includes('延迟创建'))await new Promise(resolve=>{job.releaseCreate=resolve});
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
 await visible().getByRole('textbox',{name:/^图题/}).fill(title);
 await visible().getByRole('textbox',{name:'业务内容 *',exact:true}).fill(`合成验证 ${title}`);
 const count=jobs.length;await button('生成图表草稿').click();await waitFor(()=>jobs.length>count&&jobs.at(-1)?.release);
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
const manage=title=>button(`管理任务：${title}`).click();
const rename=async(title,name)=>{
 await manage(title);await button('重命名').click();
 await visible().getByRole('textbox',{name:'任务名称',exact:true}).fill('  ');
 assert.ok(await button('保存名称').isDisabled());
 await visible().getByRole('textbox',{name:'任务名称',exact:true}).fill(name);
 await button('保存名称').click();
};
const remove=async(title,accept=true)=>{
 await manage(title);
 const dialog=page.waitForEvent('dialog');const click=button('删除任务').click();
 const prompt=await dialog;assert.equal(prompt.type(),'confirm');
 assert.ok(prompt.message().includes(title));
 if(accept)await prompt.accept();else await prompt.dismiss();
 await click;return prompt.message();
};
try{
 await page.goto(process.env.BIAOSHU_WEB_URL??'http://127.0.0.1:5191');
 const a=await start('图表 A');await button('新建任务').click();const b=await start('图表 B');
 await rename('图表 A','  第一份方案  ');
 assert.equal(await visible().getByRole('textbox',{name:/^图题/}).inputValue(),'图表 B','background rename does not switch tasks');
 await switchTo('第一份方案');
 assert.equal(await visible().getByRole('textbox',{name:/^图题/}).inputValue(),'图表 A','renaming does not modify chart title');
 await switchTo('图表 B');await manage('第一份方案');
 await visible().getByRole('group',{name:'第一份方案的管理操作',exact:true}).getByRole('button',{name:'取消生成',exact:true}).click();
 await waitFor(()=>a.cancelled);assert.equal(b.cancelled,false);
 complete(a);await switchTo('第一份方案');await button('生成图表草稿').waitFor();await history([]);
 await switchTo('图表 B');complete(b);await visible().locator('.paper').waitFor();
 await rename('图表 B','第二份方案');await history(['图表 B']);
 await button('保存项目').click();await visible().getByText('已保存',{exact:true}).waitFor();
 const saved=await page.evaluate(()=>window.__saved);
 assert.equal(saved[0].metadata.task_name,'第二份方案');assert.equal(saved[0].versions[0].spec.title,'图表 B');
 await remove('第二份方案',false);assert.equal(await visible().locator('.paper').count(),1,'dismiss delete preserves history');
 await button('新建任务').click();const c=await start('图表 C');
 await switchTo('第二份方案');
 const message=await remove('图表 C');assert.ok(message.includes('取消'));assert.ok(message.includes('未保存'));
 await waitFor(()=>c.cancelled);complete(c);
 assert.equal(await button('切换任务：图表 C').count(),0);await history(['图表 B']);
 await manage('第二份方案');
 for(const width of [1440,1920,390]){
  await page.setViewportSize({width,height:width===1440?900:width===1920?1080:844});
  await page.screenshot({path:`${out}/management-${width}.png`});
 }
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 // Delete before the create API returns: its late job ID must still be cancelled.
 await button('新建任务').click();
 await visible().getByRole('textbox',{name:/^图题/}).fill('延迟创建任务');
 await visible().getByRole('textbox',{name:'业务内容 *',exact:true}).fill('延迟创建');
 await button('生成图表草稿').click();await waitFor(()=>jobs.at(-1)?.releaseCreate);
 const late=jobs.at(-1);await remove('延迟创建任务');late.releaseCreate();await waitFor(()=>late.cancelled);
 assert.equal(await button('切换任务：延迟创建任务').count(),0);
 await remove('第一份方案');await remove('第二份方案');
 assert.equal(await visible().locator('.task-row').count(),1);
 assert.equal(await visible().locator('.paper').count(),0);
 assert.equal(await visible().getByRole('textbox',{name:'业务内容 *',exact:true}).inputValue(),'');
 await history([]);
 const fresh=await start('全新任务');complete(fresh);await visible().locator('.paper').waitFor();await history(['全新任务']);
 assert.deepEqual(errors,[]);
 await writeFile(`${out}/browser-result.json`,JSON.stringify({provider:'synthetic SSE; no external model calls',checks:['rename background task without changing active task or chart title','trim names and reject blank names','cancel background generation without affecting another task','late cancelled result creates no version','save task name in project metadata','dismiss deletion preserves task','delete running background task cancels it','delete while create API is pending cancels late job','delete last task creates empty usable workspace','desktop and mobile management controls'],errors},null,2)+'\n');
 console.log('Task management browser checks passed.');
}finally{await browser.close()}

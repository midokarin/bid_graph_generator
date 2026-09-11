const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
import {readFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='docs/evidence/preview-states';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
for(const kind of ['flowchart','gantt']){
 const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const project=JSON.parse(await readFile(`packages/contracts/examples/${kind}-project.json`,'utf8'));const version=project.versions[0];
 let release;
 const stream=events=>events.map(([event,data],i)=>`id: ${i+1}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join('');
 await page.route('**/api/v1/health',r=>r.fulfill({json:{provider:'stub',status:'ok'}}));
 await page.route('**/api/v1/generations',r=>r.fulfill({json:{job_id:'preview-test',events_url:'/api/v1/generations/preview-test/events',state:'queued'}}));
 await page.route('**/api/v1/generations/preview-test',r=>r.fulfill({json:{job_id:'preview-test',state:'cancelled'}}));
 await page.route('**/api/v1/generations/preview-test/events',async r=>{const events=await new Promise(resolve=>{release=resolve});await r.fulfill({contentType:'text/event-stream',body:stream(events)})});
 await page.goto(process.env.BIAOSHU_WEB_URL??'http://127.0.0.1:5186');
 if(kind==='gantt')await page.getByRole('button',{name:'甘特图',exact:true}).click();
 const canvas=page.getByLabel('图表画布',{exact:true});
 assert.equal(await canvas.innerText(),'');assert.equal(await canvas.locator('svg').count(),0);assert.equal(await page.locator('.preview-toolbar .sub-badge').count(),0);
 for(const width of [1440,1920]){await page.setViewportSize({width,height:width===1440?900:1080});await page.screenshot({path:`${out}/${kind}-empty-${width}.png`});}
 const start=async regenerate=>{release=undefined;await page.getByRole('button',{name:regenerate?'重新生成草稿':'生成图表草稿',exact:true}).click();if(regenerate)await page.getByRole('button',{name:'确认重新生成',exact:true}).click();await canvas.getByRole('status').waitFor();assert.equal(await canvas.innerText(),'正在生成');assert.equal(await canvas.locator('.paper').count(),0);while(!release)await new Promise(r=>setTimeout(r,20));};
 const count=()=>page.evaluate(async()=>(await import('/src/store.ts')).useWorkspace.getState().versions.length);
 await start(false);release([['status',{state:'failed'}]]);await page.getByRole('button',{name:'生成图表草稿',exact:true}).waitFor({state:'visible'});assert.equal(await canvas.innerText(),'');assert.equal(await count(),0);
 await start(false);
 for(const width of [1440,1920]){await page.setViewportSize({width,height:width===1440?900:1080});await page.screenshot({path:`${out}/${kind}-generating-${width}.png`});}
 const events=[];if(kind==='gantt')events.push(['schedule',{tasks:version.layout.tasks}]);events.push(['result',{spec:version.spec,supplements:version.supplements,summary:version.summary}],['status',{state:'completed'}]);release(events);
 await canvas.locator('.paper').waitFor();assert.equal(await canvas.locator('.preview-generating').count(),0);assert.equal(await count(),1);
 await start(true);await page.getByRole('button',{name:'取消生成',exact:true}).click();await canvas.locator('.paper').waitFor();release([['status',{state:'cancelled'}]]);assert.equal(await count(),1);
 assert.deepEqual(errors,[]);console.log(kind,'empty → generating → failure/empty → generating → diagram → regenerate/cancel → previous diagram: passed');await page.close();
}
await browser.close();

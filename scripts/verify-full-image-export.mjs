const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
import {readFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const root=process.cwd(),out=root+'/docs/evidence/full-image-export';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/api/v1/health',r=>r.fulfill({json:{provider:'stub',status:'ok'}}));
await page.goto(process.env.BIAOSHU_WEB_URL??'http://127.0.0.1:5186');
for(const kind of ['flowchart','gantt']){
 const project=JSON.parse(await readFile(root+`/packages/contracts/examples/${kind}-project.json`,'utf8'));
 if(kind==='gantt'){project.versions[0].layout.width=900;project.versions[0].layout.height=588;}
 await page.evaluate(async project=>{(await import('/src/store.ts')).useWorkspace.getState().load(project,false)},project);
 await page.getByRole('button',{name:'下载草稿 PNG',exact:true}).click();
 assert.equal(await page.getByLabel('导出纸型').count(),0);assert.equal(await page.getByLabel('导出方向').count(),0);
 for(const width of [1440,1920]){await page.setViewportSize({width,height:width===1440?900:1080});await page.screenshot({path:`${out}/${kind}-${width}.png`});}
 await page.getByLabel('导出图题').selectOption('false');
 await page.getByLabel('导出背景',{exact:true}).selectOption('transparent');
 const d=project.versions[0].layout;
 const pending=page.waitForEvent('download');await page.locator('dialog').getByRole('button',{name:'下载草稿 PNG',exact:true}).click();const download=await pending;
 const bytes=await readFile(await download.path());assert.equal(bytes.readUInt32BE(16),d.width*3);assert.equal(bytes.readUInt32BE(20),d.height*3);
 const result=await page.evaluate(async()=>{
 const {useWorkspace}=await import('/src/store.ts'),{view}=await import('/src/model.ts'),{imageBlob,DEFAULT_EXPORT}=await import('/src/project/export.tsx');const s=useWorkspace.getState();const snapshot=view(s.versions.find(v=>v.revision===s.activeRevision));const results=[];
 for(const background of ['transparent','white','custom']){const blob=await imageBlob(snapshot,{...DEFAULT_EXPORT,includeTitle:false,background,color:'#abc123'},'png');const bitmap=await createImageBitmap(blob);const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;const ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0);results.push({background,pixel:[...ctx.getImageData(0,0,1,1).data]});}return results;
 });assert.deepEqual(result.map(r=>r.pixel),[[0,0,0,0],[255,255,255,255],[171,193,35,255]]);
 console.log(kind,JSON.stringify({width:d.width*3,height:d.height*3,backgrounds:result}));await page.getByRole('button',{name:'返回编辑',exact:true}).click();
}
assert.deepEqual(errors,[]);await browser.close();

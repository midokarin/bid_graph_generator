const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
import {readFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const out=process.env.BIAOSHU_EVIDENCE_DIR??'tmp/expanded-preview';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/v1/health',r=>r.fulfill({json:{provider:'stub',status:'ok'}}));
 await page.goto(process.env.BIAOSHU_WEB_URL??'http://127.0.0.1:5191');
 const open=page.getByRole('button',{name:'放大预览',exact:true});
 await open.waitFor();assert.equal(await open.isDisabled(),true,'empty canvas cannot open preview');
 const state=()=>page.evaluate(async()=>{const s=(await import('/src/store.ts')).useWorkspace.getState();return JSON.stringify({versions:s.versions,revision:s.activeRevision,dirty:s.dirty})});
 for(const kind of ['flowchart','gantt']){
  const project=JSON.parse(await readFile(`packages/contracts/examples/${kind}-project.json`,'utf8'));
  if(kind==='gantt'){project.versions[0].layout.width=900;project.versions[0].layout.height=588;}
  await page.evaluate(async p=>{if(p.diagram_type==='flowchart'){const v=p.versions[0];v.layout=await (await import('/src/layout/client.ts')).layoutFlow(v.spec);} (await import('/src/store.ts')).useWorkspace.getState().load(p,false)},project);
  const original=await state();
  for(const width of [1440,1920,390]){
   await page.setViewportSize({width,height:width===1920?1080:900});
   const paperWidth=await page.locator('.paper').evaluate(e=>e.getBoundingClientRect().width);
   await open.click();
   const dialog=page.getByRole('dialog',{name:'放大预览',exact:true});await dialog.waitFor();
   const box=await dialog.boundingBox();assert.ok(box.width<=width&&box.x>=0,'dialog fits viewport');
   const sheet=dialog.locator('.expanded-preview-sheet');
   const measure=()=>sheet.evaluate(e=>e.getBoundingClientRect().width);
   const base=await measure();if(width>600)assert.ok(base>paperWidth*1.5,'preview visibly enlarges chart');
   assert.equal(await sheet.locator('svg[role="img"]').count(),1);
   assert.equal(await sheet.locator('input').count(),0,'expanded preview is read only');
   assert.equal(await sheet.locator('svg[role="img"]').getAttribute('viewBox'),await page.locator('.paper>svg').getAttribute('viewBox'));
   await dialog.getByRole('button',{name:'放大预览图表',exact:true}).click();assert.ok(Math.abs((await measure())/base-1.25)<.01);
   for(let i=0;i<3;i++)await dialog.getByRole('button',{name:'放大预览图表',exact:true}).click();
   assert.equal(await dialog.getByRole('button',{name:'放大预览图表',exact:true}).isDisabled(),true);
   const reach=await dialog.locator('.expanded-preview-canvas').evaluate(e=>{e.scrollLeft=0;const left=e.querySelector('.expanded-preview-sheet').getBoundingClientRect().left-e.getBoundingClientRect().left;e.scrollLeft=e.scrollWidth;const right=e.querySelector('.expanded-preview-sheet').getBoundingClientRect().right-e.getBoundingClientRect().left;return {left,right,visible:e.clientWidth}});
   assert.ok(reach.left>=0&&reach.right<=reach.visible+2,'both edges remain reachable');
   await dialog.getByRole('button',{name:'适配宽度',exact:true}).click();assert.ok(Math.abs((await measure())-base)<1);
   await dialog.locator('.expanded-preview-canvas').evaluate(e=>{e.scrollLeft=0;e.scrollTop=0});
   await page.screenshot({path:`${out}/${kind}-${width}.png`});
   await page.keyboard.press('Escape');assert.equal(await dialog.count(),0);
   assert.equal(await open.evaluate(e=>e===document.activeElement),true,'focus returns to opener');
   await open.click();await page.getByRole('dialog',{name:'放大预览',exact:true}).getByRole('button',{name:'关闭弹窗'}).click();
   assert.equal(await dialog.count(),0);
   assert.equal(await state(),original,'preview must preserve data, versions and dirty state');
   console.log(`${kind} ${width}: open, zoom, fit, close, Esc, focus and state passed`);
  }
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close()}

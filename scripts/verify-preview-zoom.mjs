const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
import {readFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='docs/evidence/preview-zoom';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({deviceScaleFactor:1});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/api/v1/health',r=>r.fulfill({json:{provider:'stub',status:'ok'}}));
await page.goto(process.env.BIAOSHU_WEB_URL??'http://127.0.0.1:5186');
const state=()=>page.evaluate(async()=>{const s=(await import('/src/store.ts')).useWorkspace.getState();return JSON.stringify({versions:s.versions,revision:s.activeRevision,dirty:s.dirty})});
const measure=()=>page.locator('.paper').evaluate(e=>({paper:e.getBoundingClientRect().width,svg:e.querySelector('svg').getBoundingClientRect().width}));
const settle=()=>page.waitForTimeout(250);
for(const kind of ['flowchart','gantt']){
 const project=JSON.parse(await readFile(`packages/contracts/examples/${kind}-project.json`,'utf8'));
 if(kind==='gantt'){project.versions[0].layout.width=900;project.versions[0].layout.height=588;}
 await page.evaluate(async p=>(await import('/src/store.ts')).useWorkspace.getState().load(p,false),project);
 const original=await state();
 for(const width of [1440,1920,390]){
  await page.setViewportSize({width,height:width===1920?1080:900});
  await page.getByRole('button',{name:'恢复适配视图',exact:true}).click();await settle();const base=await measure();
  await page.getByRole('button',{name:'放大',exact:true}).click();await settle();const enlarged=await measure();
  assert.ok(Math.abs(enlarged.paper/base.paper-1.1)<.01,`${kind} ${width}: 110% must enlarge the actual paper`);assert.ok(enlarged.svg>base.svg);
  for(let i=0;i<4;i++)await page.getByRole('button',{name:'放大',exact:true}).click();await settle();
  assert.equal(await page.getByRole('button',{name:'放大',exact:true}).isDisabled(),true);
  assert.ok(Math.abs((await measure()).paper/base.paper-1.5)<.01);
  const reach=await page.locator('.canvas-area').evaluate(e=>{e.scrollLeft=0;const left=e.querySelector('.paper').getBoundingClientRect().left-e.getBoundingClientRect().left;e.scrollLeft=e.scrollWidth;const right=e.querySelector('.paper').getBoundingClientRect().right-e.getBoundingClientRect().left;return {left,right,visible:e.clientWidth}});
  assert.ok(reach.left>=0,'left edge stays reachable');assert.ok(reach.right<=reach.visible+1,'right edge stays reachable');
  await page.locator('.canvas-area').evaluate(e=>{e.scrollLeft=0;e.scrollTop=0});
  if(width!==390)await page.screenshot({path:`${out}/${kind}-${width}-150.png`,fullPage:true});
  await page.getByRole('button',{name:'恢复适配视图',exact:true}).click();await settle();assert.ok(Math.abs((await measure()).paper-base.paper)<1);
  for(let i=0;i<4;i++)await page.getByRole('button',{name:'缩小',exact:true}).click();await settle();
  assert.equal(await page.getByRole('button',{name:'缩小',exact:true}).isDisabled(),true);assert.ok((await measure()).svg<base.svg);
  assert.equal(await state(),original,'zoom must not change project data, revision, or dirty state');
  console.log(kind,width,JSON.stringify({base,enlarged,reach}));
 }
}
assert.deepEqual(errors,[]);await browser.close();

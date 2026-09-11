const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const root=process.cwd(),out=root+'/docs/evidence/style-settings';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/api/v1/health',route=>route.fulfill({json:{provider:'stub',status:'ok'}}));
await page.goto(process.env.BIAOSHU_WEB_URL??'http://127.0.0.1:5186');
assert.equal(await page.locator('vite-error-overlay').count(),0);
await page.getByRole('button',{name:'版式设置',exact:true}).click();
assert.equal(await page.locator('#paper,#orientation,.setting-summary,.layout-settings input[type=color]').count(),0);
assert.equal(await page.locator('#font-family').isDisabled(),true);
const initial=JSON.parse(await readFile(root+'/packages/contracts/examples/flowchart-project.json','utf8'));
await page.evaluate(async p=>{(await import('/src/store.ts')).useWorkspace.getState().load(p,false)},initial);
for(const width of [1440,1920]){await page.setViewportSize({width,height:width===1440?900:1080});await page.screenshot({path:`${out}/after-matched-${width}.png`,fullPage:true});}
const spec=JSON.parse(await readFile(root+'/frontend/tests/fixtures/presentation.json','utf8'));
const load=async kind=>{
 const project=JSON.parse(await readFile(`${root}/packages/contracts/examples/${kind}-project.json`,'utf8'));
 await page.evaluate(async({project,spec,kind})=>{
  const {useWorkspace}=await import('/src/store.ts');const {DEFAULT_STYLE}=await import('/src/model.ts');
  project.versions[0].style={...DEFAULT_STYLE};
  if(kind==='flowchart'){project.versions[0].spec=spec;project.versions[0].layout=(await import('/src/layout/presentation.ts')).presentationLayout(spec);}
  else{project.versions[0].layout.width=900;project.versions[0].layout.height=588;}
  useWorkspace.getState().load(project,false);
 },{project,spec,kind});
};
const state=()=>page.evaluate(async()=>{const s=(await import('/src/store.ts')).useWorkspace.getState();return {versions:s.versions,dirty:s.dirty,revision:s.activeRevision}});
const stroke=()=>page.locator('.paper [data-edge-id] path').first().getAttribute('stroke-width');
await load('flowchart');
const original=await state();
await page.getByRole('button',{name:'醒目 强调轮廓'}).click();assert.equal(await stroke(),'3');assert.deepEqual(await state(),original);
await page.locator('#font-family').selectOption('Arial');
await page.locator('#corner-radius').focus();await page.keyboard.press('End');
assert.equal(await page.locator('.paper [data-node-type="process"]>rect').first().getAttribute('rx'),'24');
assert.ok((await page.locator('.paper>svg').getAttribute('style')).includes('Arial'));
await page.getByRole('button',{name:'查看原版',exact:true}).click();assert.equal(await stroke(),'1.5');
await page.getByRole('button',{name:'返回调整效果',exact:true}).click();assert.equal(await stroke(),'3');
await page.getByRole('button',{name:'保存项目',exact:true}).click();assert.deepEqual(await state(),original);
await page.getByRole('button',{name:'下载草稿 PNG',exact:true}).click();assert.equal(await page.locator('dialog[open]').count(),0);
await page.getByRole('button',{name:'版本记录',exact:true}).click();assert.equal(await page.locator('dialog[open]').count(),0);
await page.getByRole('button',{name:'重新布局',exact:true}).click();assert.deepEqual(await state(),original);
await page.getByRole('button',{name:'内容输入',exact:true}).click();await page.getByRole('button',{name:'甘特图',exact:true}).click();assert.deepEqual(await state(),original);
assert.equal(await page.evaluate(()=>{const e=new Event('beforeunload',{cancelable:true});window.dispatchEvent(e);return e.defaultPrevented}),true);
await page.getByRole('button',{name:'撤销调整',exact:true}).click();assert.deepEqual(await state(),original);assert.equal(await stroke(),'1.5');
await page.locator('#font-size').focus();await page.keyboard.press('End');assert.ok(await page.getByRole('alert').isVisible());assert.equal(await page.getByRole('button',{name:'应用版式',exact:true}).isDisabled(),true);
await page.getByRole('button',{name:'恢复默认版式',exact:true}).click();assert.equal(await page.getByRole('button',{name:'应用版式',exact:true}).isDisabled(),true);
await page.getByRole('button',{name:'柔和 圆润线条'}).click();
if(await page.getByRole('button',{name:'关闭提示',exact:true}).count())await page.getByRole('button',{name:'关闭提示',exact:true}).click();
for(const width of [1440,1920,390]){await page.setViewportSize({width,height:width===1920?1080:900});if(width===1440){const control=await page.locator('#corner-radius').boundingBox(),body=await page.locator('.input-scroll').boundingBox();assert.ok(control.y+control.height<=body.y+body.height,'all useful controls visible without scrolling');}
await page.screenshot({path:`${out}/flow-trial-${width}.png`,fullPage:true});if(width===390){assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.getByRole('button',{name:'查看实时预览 ↓',exact:true}).click();assert.ok((await page.locator('.preview-panel').boundingBox()).y<10);await page.getByRole('button',{name:'返回版式设置 ↑',exact:true}).click();assert.ok((await page.locator('.input-panel').boundingBox()).y<10);}}
await page.setViewportSize({width:1440,height:900});
await page.getByRole('button',{name:'应用版式',exact:true}).click();
const applied=await state();assert.equal(applied.versions.length,2);assert.equal(applied.revision,2);assert.equal(applied.dirty,true);assert.deepEqual(applied.versions[0],original.versions[0]);assert.deepEqual(applied.versions[1].layout,original.versions[0].layout);
await page.getByRole('button',{name:'下一步：导出',exact:true}).click();
assert.equal(await page.getByRole('img',{name:'导出图表预览',exact:true}).locator('[data-node-type="process"]>rect').first().getAttribute('rx'),'16');
await page.getByRole('button',{name:'返回编辑',exact:true}).click();
await page.evaluate(()=>{window.showSaveFilePicker=undefined;window.showOpenFilePicker=undefined});
const downloadEvent=page.waitForEvent('download');await page.getByRole('button',{name:'保存项目',exact:true}).click();
const download=await downloadEvent;const file=await readFile(await download.path());const saved=JSON.parse(file.toString());
assert.equal(saved.current_revision,2);assert.deepEqual(saved.versions,applied.versions);assert.equal((await state()).dirty,true);
await page.getByRole('button',{name:'打开已保存项目',exact:true}).click();await page.getByRole('button',{name:'打开项目',exact:true}).click();
const chooserEvent=page.waitForEvent('filechooser');await page.getByRole('button',{name:'放弃修改并打开',exact:true}).click();
await (await chooserEvent).setFiles({name:'style-reopen.json',mimeType:'application/json',buffer:file});
await page.waitForFunction(async()=>!(await import('/src/store.ts')).useWorkspace.getState().dirty);
assert.deepEqual((await state()).versions,saved.versions);assert.equal((await state()).revision,2);

await page.getByRole('button',{name:'内容输入',exact:true}).click();await page.getByRole('button',{name:'甘特图',exact:true}).click();await load('gantt');await page.getByRole('button',{name:'版式设置',exact:true}).click();
const ganttOriginal=await state();
await page.getByRole('button',{name:'柔和 圆润线条'}).click();assert.equal(await page.getByLabel('进度条圆角',{exact:true}).inputValue(),'16');assert.deepEqual(await state(),ganttOriginal);
await page.getByRole('button',{name:'查看原版',exact:true}).click();await page.getByRole('button',{name:'返回调整效果',exact:true}).click();
if(await page.getByRole('button',{name:'关闭提示',exact:true}).count())await page.getByRole('button',{name:'关闭提示',exact:true}).click();
for(const width of [1440,1920]){await page.setViewportSize({width,height:width===1440?900:1080});await page.screenshot({path:`${out}/gantt-trial-${width}.png`,fullPage:true});}
await page.getByRole('button',{name:'应用版式',exact:true}).click();assert.equal((await state()).versions.length,2);assert.deepEqual((await state()).versions[1].layout,ganttOriginal.versions[0].layout);
assert.deepEqual(errors,[]);
await writeFile(`${out}/browser-check.json`,JSON.stringify({browser:await browser.version(),source:'synthetic project fixtures, no model calls',checks:['empty state disabled','removed controls absent','live font/stroke/radius','original comparison','cancel leaves history and dirty unchanged','save/export/history/layout/kind guarded','beforeunload guard','oversized font blocked','reset to default clears trial','one version on apply','shared export rendering','actual downloaded JSON equals applied versions; upload reopen restores styles','download fallback retains dirty','gantt trial and scheduling preserved','390px no horizontal overflow and quick preview navigation','all useful sliders visible at 1440px'],pageErrors:errors},null,2));
await browser.close();console.log('Style browser checks passed');

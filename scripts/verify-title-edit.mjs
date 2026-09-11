const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const out=process.env.BIAOSHU_EVIDENCE_DIR??'tmp/title-edit';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const checks=[];
try{
 for(const kind of ['flowchart','gantt']){
  const project=JSON.parse(await readFile(`packages/contracts/examples/${kind}-project.json`,'utf8'));
  const fixture=project.versions[0],result={spec:fixture.spec,summary:fixture.summary,supplements:fixture.supplements};
  const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/v1/health',r=>r.fulfill({json:{provider:'stub',status:'ok'}}));
  await page.route('**/api/v1/generations',r=>r.fulfill({json:{job_id:'title-test',events_url:'/api/v1/generations/title-test/events',state:'queued'}}));
  const events=[...(kind==='gantt'?[['schedule',{tasks:fixture.layout.tasks}]]:[]),['result',result],['status',{state:'completed'}]];
  await page.route('**/api/v1/generations/title-test/events',r=>r.fulfill({contentType:'text/event-stream',body:events.map(([event,data],i)=>`id: ${i+1}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join('')}));
  await page.goto(process.env.BIAOSHU_WEB_URL??'http://127.0.0.1:5194');
  await page.getByRole('button',{name:kind==='flowchart'?'流程图':'甘特图',exact:true}).click();
  assert.equal(await page.locator('input[id$="title"]').inputValue(),'');
  await page.getByRole('button',{name:'生成图表草稿',exact:true}).click();
  await page.locator('.paper svg').waitFor();
  const heading=page.locator('.paper-heading');
  assert.equal(await heading.innerText(),fixture.spec.title);
  const state=()=>page.evaluate(async()=>{const {useWorkspace}=await import('/src/store.ts');const s=useWorkspace.getState();return {versions:s.versions,activeRevision:s.activeRevision,dirty:s.dirty}});
  const original=await state();assert.equal(original.versions.length,1);
  await heading.dblclick();assert.equal(await page.getByRole('textbox',{name:'编辑图表标题',exact:true}).count(),0);
  await page.getByRole('button',{name:'解锁画布编辑',exact:true}).click();
  async function edit(value,key='Enter'){
   await page.getByRole('button',{name:'编辑图表标题',exact:true}).click();
   const input=page.getByRole('textbox',{name:'编辑图表标题',exact:true});await input.fill(value);await input.press(key);
  }
  await edit('取消此标题','Escape');assert.equal(await heading.innerText(),fixture.spec.title);assert.equal((await state()).versions.length,1);
  await edit('   ');assert.equal(await heading.innerText(),fixture.spec.title);assert.equal((await state()).versions.length,1);
  const edited=kind==='flowchart'?'设备安装调试与验收流程':'设备安装调试进度计划';
  await edit(edited);assert.equal(await heading.innerText(),edited);assert.equal((await state()).versions.length,1);
  await page.getByRole('button',{name:'取消编辑',exact:true}).click();assert.equal(await heading.innerText(),fixture.spec.title);
  await page.getByRole('button',{name:'解锁画布编辑',exact:true}).click();await edit(edited);
  for(const width of [1440,1920]){
   await page.setViewportSize({width,height:width===1440?900:1080});await page.evaluate(()=>document.fonts.ready);
   await page.getByRole('button',{name:'编辑图表标题',exact:true}).click();await page.screenshot({path:`${out}/editing-${kind}-${width}.png`});await page.getByRole('textbox',{name:'编辑图表标题',exact:true}).press('Escape');
  }
  await page.getByRole('button',{name:'确认',exact:true}).click();await page.getByRole('button',{name:'确认并应用',exact:true}).click();
  await page.getByRole('button',{name:'解锁画布编辑',exact:true}).waitFor();
  const applied=await state();assert.equal(applied.versions.length,2);assert.equal(applied.versions[1].spec.title,edited);assert.equal(applied.dirty,true);
  assert.deepEqual(applied.versions[0],original.versions[0]);assert.deepEqual(applied.versions[1].layout,original.versions[0].layout);
  assert.deepEqual({...applied.versions[1].spec,title:fixture.spec.title},original.versions[0].spec);
  await page.getByRole('button',{name:'版本记录',exact:true}).click();await page.locator('.version-card').filter({hasText:'v1'}).click();assert.equal(await heading.innerText(),fixture.spec.title);
  await page.getByRole('button',{name:'版本记录',exact:true}).click();await page.locator('.version-card').filter({hasText:'v2'}).click();assert.equal(await heading.innerText(),edited);
  await page.getByRole('button',{name:'下一步：导出',exact:true}).click();assert.ok((await page.locator('.export-image').innerText()).includes(edited));await page.getByRole('button',{name:'返回编辑',exact:true}).click();
  const exported=await page.evaluate(async()=>{
   const {useWorkspace}=await import('/src/store.ts'),{view}=await import('/src/model.ts'),{svgText,imageBlob,DEFAULT_EXPORT}=await import('/src/project/export.tsx'),{parseProject}=await import('/src/project/files.ts');
   const s=useWorkspace.getState(),v=s.versions.at(-1),p={project_file_version:'1.0',diagram_type:v.spec.diagram_type,source_text:'合成测试',current_revision:s.activeRevision,versions:s.versions,metadata:{}};
   const reopened=parseProject(JSON.stringify(p));s.load(reopened.project,false);
   const snapshot=view(v),svg=await svgText(snapshot,DEFAULT_EXPORT),blob=await imageBlob(snapshot,DEFAULT_EXPORT,'png'),bitmap=await createImageBitmap(blob);
   const png=await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.readAsDataURL(blob)});
   return {svg,png,pngSize:[bitmap.width,bitmap.height],title:reopened.project.versions.at(-1).spec.title};
  });
  assert.equal(exported.title,edited);assert.ok(exported.svg.includes(edited));assert.ok(!exported.svg.includes(fixture.spec.title));assert.ok(!exported.svg.includes('title-editor'));
  await writeFile(`${out}/${kind}.svg`,exported.svg);await writeFile(`${out}/${kind}.png`,Buffer.from(exported.png.split(',')[1],'base64'));
  assert.equal(await heading.innerText(),edited);
  // Regeneration respects an explicit title; clearing it restores model naming.
  for(const custom of ['用户指定图题','']){
   await page.locator('input[id$="title"]').fill(custom);await page.getByRole('button',{name:'重新生成草稿',exact:true}).click();await page.getByRole('button',{name:'确认重新生成',exact:true}).click();await page.locator('.paper svg').waitFor();assert.equal(await heading.innerText(),custom||fixture.spec.title);
  }
  assert.deepEqual(errors,[]);checks.push({kind,modelTitlePreserved:true,customTitlePriority:true,cancelAndBlankSafe:true,historyAndRoundTrip:true,layoutPreserved:true,pngSize:exported.pngSize,pageErrors:errors});
  await page.close();
 }
 await writeFile(`${out}/checks.json`,JSON.stringify({browser:browser.version(),model:'synthetic SSE; no external model calls',checks},null,2)+'\n');console.log(JSON.stringify(checks));
}finally{await browser.close()}

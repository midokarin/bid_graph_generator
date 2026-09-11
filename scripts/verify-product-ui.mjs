// Deterministic browser evidence: fixtures only, no real model traffic.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const out='docs/evidence/product-ui';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
const errors=[];page.on('pageerror',error=>errors.push(error.message));
const fixtures={};for(const kind of ['flowchart','gantt'])fixtures[kind]=JSON.parse(await readFile(`packages/contracts/examples/${kind}-project.json`,'utf8'));
const jobs=new Map();let number=0;
await page.route('**/api/v1/**',async route=>{
 const req=route.request(),url=new URL(req.url());
 if(url.pathname.endsWith('/health'))return route.fulfill({json:{provider:'stub',status:'ok',contract_version:'1.0'}});
 if(req.method()==='POST'&&url.pathname.endsWith('/generations')){const request=req.postDataJSON(),id=String(++number);jobs.set(id,request.diagram_type);return route.fulfill({json:{job_id:id,events_url:`/api/v1/generations/${id}/events`,state:'queued'}})}
 if(url.pathname.endsWith('/events')){const id=url.pathname.split('/').at(-2),version=fixtures[jobs.get(id)].versions[0];const events=[['status',{state:'generating',attempt:0}],['delta',{attempt:0,text:'{"fixture":true}'}]];if(version.spec.diagram_type==='gantt')events.push(['schedule',{tasks:version.layout.tasks}]);events.push(['result',{spec:version.spec,supplements:version.supplements,summary:version.summary}],['status',{state:'completed'}]);return route.fulfill({contentType:'text/event-stream',body:events.map(([event,data],i)=>`id: ${i+1}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join('')})}
 throw new Error(`Unexpected API: ${req.method()} ${url.pathname}`);
});
const base=process.env.BIAOSHU_WEB_URL??'http://127.0.0.1:5191';
await page.goto(base);await page.getByRole('button',{name:'生成图表草稿',exact:true}).waitFor();
await page.getByRole('button',{name:'浅色',exact:true}).click();
const screen=async name=>page.screenshot({path:`${out}/${name}.png`,animations:'disabled'});
const canvas=page.locator('.task-workbench:not([hidden])').getByLabel('图表画布',{exact:true});
assert.equal(await canvas.innerText(),'');
await screen('empty-1440');
await page.getByRole('button',{name:'技术标类型',exact:true}).click();await page.getByRole('option',{name:'暗标',exact:true}).click();
assert.match(await page.getByRole('button',{name:'技术标类型',exact:true}).innerText(),/暗标/);
await page.getByRole('button',{name:'流程布局方向',exact:true}).focus();await page.keyboard.press('Enter');await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
assert.match(await page.getByRole('button',{name:'流程布局方向',exact:true}).innerText(),/从左到右/);
await page.getByRole('button',{name:'流程布局方向',exact:true}).click();await page.getByRole('option',{name:'从上到下'}).click();
await page.getByRole('button',{name:'生成图表草稿',exact:true}).click();await canvas.locator('.paper').waitFor();
await screen('flowchart-1440');
await page.getByRole('button',{name:'模板',exact:true}).click();await page.getByLabel('样式与模板').waitFor();
await screen('templates-1440');await page.getByRole('button',{name:'模板',exact:true}).click();
await page.getByRole('button',{name:'版式设置',exact:true}).click();
const ranges=page.locator('.input-panel input[type=range]');assert.ok(await ranges.count()>0);
await ranges.first().fill('18');await page.getByRole('button',{name:'应用版式',exact:true}).click();
await page.getByRole('button',{name:/^版本记录/}).click();assert.equal(await page.locator('.activity-panel .version-card').count(),2);await screen('history-1440');
await page.getByRole('button',{name:/^生成过程$/}).click();assert.match(await page.locator('.activity-panel').innerText(),/结构校验通过|预览已生成/);
await page.getByRole('button',{name:/^生成结果/}).click();
await page.getByRole('button',{name:'深色',exact:true}).click();await screen('dark-1440');await page.getByRole('button',{name:'浅色',exact:true}).click();
await page.setViewportSize({width:1920,height:1080});await screen('flowchart-1920');
await page.getByRole('button',{name:'导出图表',exact:true}).click();const download=page.waitForEvent('download');await page.getByRole('button',{name:'下载草稿 PNG',exact:true}).click();const png=await download;assert.match(png.suggestedFilename(),/\.png$/);await png.saveAs(`${out}/fixture-export.png`);
await page.getByRole('button',{name:'关闭弹窗',exact:true}).click();
await page.getByRole('button',{name:'内容输入',exact:true}).click();await page.getByRole('button',{name:'甘特图',exact:true}).click();await page.getByRole('button',{name:'生成图表草稿',exact:true}).click();await canvas.locator('.paper').waitFor();await screen('gantt-1920');
await page.getByRole('button',{name:'新建任务',exact:true}).click();assert.equal(await canvas.innerText(),'');await page.getByRole('button',{name:'切换任务：任务 1',exact:true}).click();await canvas.locator('.paper').waitFor();
await page.setViewportSize({width:390,height:844});await page.locator('.task-workbench:not([hidden]) .mobile-tasks summary').click();assert.equal(await page.getByRole('button',{name:'新建任务',exact:true}).isVisible(),true);await page.locator('.task-workbench:not([hidden]) .mobile-tasks summary').click();
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);await screen('mobile-390');
// Two embedded module instances share host theme, but never diagram state or global CSS.
await page.setViewportSize({width:1440,height:900});
await page.evaluate(async({fixture})=>{
 const {default:React}=await import('/node_modules/.vite/deps/react.js');const {default:{createRoot}}=await import('/node_modules/.vite/deps/react-dom_client.js');const {DiagramWorkspace}=await import('/src/module.ts');
 document.getElementById('root').hidden=true;
 const shell=document.createElement('div');shell.dataset.theme='dark';shell.id='test-host';shell.style.cssText='background:#111;color:#eee;padding:24px;font:14px sans-serif';
 shell.innerHTML='<button id="host-button" style="color:rgb(200, 20, 30);background:rgb(230, 230, 230);border-radius:2px">宿主按钮</button><div id="host-module" style="width:760px"></div><div id="second-module" style="width:480px"></div>';
 document.body.append(shell);window.testHost={dirty:[],saved:[],exports:[],createCalls:0,failSave:true};
 const host={getInitialText:async()=>'宿主提供的业务内容',openProject:async()=>({text:JSON.stringify(fixture),handle:null,name:'fixture.json'}),saveProject:async project=>{if(window.testHost.failSave)throw new Error('模拟写入失败');window.testHost.saved.push(project);return {handle:null,confirmed:true}},exportImage:async(blob,name)=>{window.testHost.exports.push({size:blob.size,name})},onDirtyChange:value=>window.testHost.dirty.push(value),generation:{getHealth:async()=>({provider:'stub',status:'ok',contract_version:'1.0'}),createGeneration:async()=>{window.testHost.createCalls++;return {job_id:'host',state:'queued',events_url:'host-stream'}},cancelGeneration:async()=>({job_id:'host',state:'cancelled'}),consumeGeneration:async(url,emit)=>{const version=fixture.versions[0];emit({event:'result',data:{spec:version.spec,supplements:version.supplements,summary:version.summary}})}}};
 createRoot(document.getElementById('host-module')).render(React.createElement(DiagramWorkspace,{embedded:true,host,projectName:'宿主项目示例'}));
 createRoot(document.getElementById('second-module')).render(React.createElement(DiagramWorkspace,{embedded:true,host:{...host,getInitialText:async()=>''}}));
},{fixture:fixtures.flowchart});
const embedded=page.locator('#host-module');await embedded.getByRole('textbox',{name:/业务内容/}).waitFor();await page.waitForFunction(()=>document.querySelector('#host-module textarea')?.value==='宿主提供的业务内容');
assert.equal(await embedded.locator('.product-sidebar').count(),0);
await embedded.getByRole('button',{name:'技术标类型',exact:true}).click();
const triggerBox=await embedded.getByRole('button',{name:'技术标类型',exact:true}).boundingBox();const popupBox=await page.getByRole('listbox',{name:'技术标类型',exact:true}).boundingBox();assert.ok(Math.abs(popupBox.x-triggerBox.x)<2);await page.getByRole('option',{name:'明标',exact:true}).click();

assert.deepEqual(await page.locator('#host-button').evaluate(el=>{const s=getComputedStyle(el);return [s.color,s.backgroundColor,s.borderRadius]}),['rgb(200, 20, 30)','rgb(230, 230, 230)','2px']);
assert.equal(await embedded.locator('.bid-graph').evaluate(el=>getComputedStyle(el).getPropertyValue('--surface').trim()),'#1a1a1a');
await embedded.getByRole('button',{name:'生成图表草稿',exact:true}).click();await embedded.locator('.paper').waitFor();assert.equal(await page.locator('#second-module .paper').count(),0);assert.equal(await page.evaluate(()=>window.testHost.createCalls),1);
await embedded.getByRole('button',{name:'保存项目',exact:true}).click();await embedded.getByText(/保存失败，仍保留未保存修改/).waitFor();assert.equal(await page.evaluate(()=>window.testHost.dirty.at(-1)),true);await page.evaluate(()=>{window.testHost.failSave=false});await embedded.getByRole('button',{name:'保存项目',exact:true}).click();assert.equal(await page.evaluate(()=>window.testHost.saved.length),1);assert.equal(await page.evaluate(()=>window.testHost.dirty.at(-1)),false);
await embedded.getByRole('button',{name:'打开项目',exact:true}).click();await embedded.locator('.paper').waitFor();
await embedded.getByRole('button',{name:'导出图表',exact:true}).click();await embedded.getByRole('button',{name:'下载 SVG',exact:true}).click();await page.waitForFunction(()=>window.testHost.exports.length===1);await embedded.getByRole('button',{name:'关闭弹窗',exact:true}).click();
assert.equal(await embedded.evaluate(el=>el.scrollWidth<=el.clientWidth),true);
await page.locator('#second-module').evaluate(el=>el.style.display='none');await screen('embedded-dark-760');
await embedded.getByRole('switch',{name:'多方案生成',exact:true}).check();await embedded.getByRole('button',{name:'生成 3 个方案',exact:true}).click();await embedded.getByRole('button',{name:'确认重新生成',exact:true}).click();await embedded.getByRole('button',{name:'采用此方案',exact:true}).first().click();await embedded.locator('.paper').waitFor();assert.equal(await page.evaluate(()=>window.testHost.createCalls),4);
const leakedSelectors=await page.evaluate(()=>{
 const leaked=[];const visit=rules=>{for(const rule of rules){if(rule.selectorText&&!rule.selectorText.split(/,(?![^()]*\))/).every(selector=>selector.includes('.bid-graph')))leaked.push(rule.selectorText);if(rule.cssRules&&rule.type!==CSSRule.KEYFRAMES_RULE)visit(rule.cssRules)}};
 for(const sheet of document.styleSheets){const path=sheet.ownerNode?.getAttribute('data-vite-dev-id')??'';if(path.includes('/src/')&&!path.endsWith('/standalone.css'))visit(sheet.cssRules)}return leaked;
});assert.deepEqual(leakedSelectors,[]);
assert.deepEqual(errors,[]);await writeFile(`${out}/results.json`,JSON.stringify({browser:'Chrome headless',model:'fixture only; host injected adapter also verified',checks:['empty canvas','host GlassSelect pointer and keyboard','flowchart generation and layout','style commit and history','run details','light/dark','1440 and 1920 viewports','PNG download','gantt generation','task isolation','390px mobile','760px embedded containment','host CSS and dark theme','two embedded instances isolated','host initial text/generation/save/open/export and dirty notifications','failed save retains dirty','three candidates use host generation adapter','no global module CSS selectors'],pageErrors:errors},null,2)+'\n');
await browser.close();console.log('Product UI browser checks passed.');

const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='docs/evidence/connectors';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/api/v1/health',r=>r.fulfill({json:{provider:'stub',status:'ok'}}));
await page.goto(process.env.BIAOSHU_WEB_URL??'http://127.0.0.1:5186');
await page.getByRole('button',{name:'生成图表草稿',exact:true}).waitFor();
const gantt=JSON.parse(await readFile('frontend/tests/fixtures/connectors-gantt.json','utf8'));
const load=async p=>{await page.getByRole('button',{name:p.diagram_type==='gantt'?'甘特图':'流程图',exact:true}).click();await page.evaluate(async p=>(await import(performance.getEntriesByType('resource').map(e=>e.name).find(u=>new URL(u).pathname==='/src/store.ts'))).useWorkspace.getState().load(p,false),p);await page.locator('.paper svg').waitFor();};
await load(gantt);
for(const width of [1440,1920]){await page.setViewportSize({width,height:width===1440?900:1080});await page.screenshot({path:`${out}/gantt-${width}.png`});}
const markerCount=await page.locator('.paper [data-dependency-id] path[marker-end]').count();assert.equal(markerCount,8,'one arrow per target, without stacking tips');
async function checkExport(name){
 const preview=await page.locator('.paper svg [data-edge-id] path, .paper svg [data-dependency-id] path').evaluateAll(paths=>paths.map(p=>p.getAttribute('d')));
 const data=await page.evaluate(async()=>{
  const {useWorkspace}=await import(performance.getEntriesByType('resource').map(e=>e.name).find(u=>new URL(u).pathname==='/src/store.ts')),{view}=await import('/src/model.ts'),{svgText,imageBlob,DEFAULT_EXPORT}=await import('/src/project/export.tsx');
  const state=useWorkspace.getState(),snapshot=view(state.versions.find(v=>v.revision===state.activeRevision));
  const svg=await svgText(snapshot,DEFAULT_EXPORT),doc=new DOMParser().parseFromString(svg,'image/svg+xml');
  const png=await imageBlob(snapshot,DEFAULT_EXPORT,'png');const bitmap=await createImageBitmap(png);
  const pngData=await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.readAsDataURL(png)});
  return {svg,pngData,paths:[...doc.querySelectorAll('[data-edge-id] path, [data-dependency-id] path')].map(p=>p.getAttribute('d')),pngSize:[bitmap.width,bitmap.height],project:{project_file_version:'1.0',diagram_type:snapshot.kind,source_text:'合成浏览器回归样例',current_revision:state.activeRevision,versions:state.versions,metadata:{fixture:true}}};
 });assert.deepEqual(data.paths,preview,'preview and export use identical connectors');
 await writeFile(`${out}/${name}.svg`,data.svg);await writeFile(`${out}/${name}.png`,Buffer.from(data.pngData.split(',')[1],'base64'));await writeFile(`${out}/${name}.project.json`,JSON.stringify(data.project,null,2)+'\n');
 console.log(name,JSON.stringify({paths:preview.length,pngSize:data.pngSize}));return data.project;
}
await checkExport('gantt');
const flow=JSON.parse(await readFile('frontend/tests/fixtures/presentation.json','utf8'));
for(const direction of ['DOWN','RIGHT']){
 const project=await page.evaluate(async spec=>{
  const {presentationLayout}=await import('/src/layout/presentation.ts'),{DEFAULT_STYLE}=await import('/src/model.ts');
  return {project_file_version:'1.0',diagram_type:'flowchart',source_text:'合成浏览器回归样例',current_revision:1,versions:[{spec,layout:presentationLayout(spec),style:DEFAULT_STYLE,revision:1,origin:'ai',created_at:'2026-09-11T00:00:00Z',supplements:[],summary:'连线测试'}],metadata:{fixture:true}};
 },{...flow,direction});
 await load(project);await page.setViewportSize({width:1920,height:1080});
 await page.getByRole('button',{name:'解锁画布编辑',exact:true}).click();
 const paths=()=>page.locator('.paper [data-edge-id] path').evaluateAll(es=>es.map(e=>e.getAttribute('d')));
 const node=page.locator('.paper [data-node-id="n7"]');
 async function drag(dx,dy){await node.scrollIntoViewIfNeeded();const box=await node.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+dx,box.y+box.height/2+dy,{steps:12});const during=await paths();await page.mouse.up();await page.waitForTimeout(50);assert.deepEqual(await paths(),during,'pointer release keeps the displayed paths');}
 await drag(-5,-8);const once=await paths();
 for(let i=0;i<4;i++){await drag(5,8);await drag(-5,-8);assert.deepEqual(await paths(),once,'repeated browser drags do not accumulate elbows');}
 await page.getByRole('button',{name:'确认',exact:true}).click();await page.getByRole('button',{name:'确认并应用',exact:true}).click();
 const saved=await checkExport(`flow-${direction.toLowerCase()}`);assert.equal(saved.versions.length,2);
 const before=await paths();await load(JSON.parse(JSON.stringify(saved)));assert.deepEqual(await paths(),before,'reopen keeps connector geometry');
 for(const width of [1440,1920]){await page.setViewportSize({width,height:width===1440?900:1080});await page.screenshot({path:`${out}/flow-${direction.toLowerCase()}-${width}.png`});}
}
assert.deepEqual(errors,[]);await browser.close();console.log('Browser connectors verification passed.');

const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import ELK from 'elkjs/lib/elk.bundled.js';
import {flowGraph,readLayout} from '../frontend/src/layout/flow.ts';
const out=process.env.BIAOSHU_EVIDENCE_DIR??'tmp/flow-quality';await mkdir(out,{recursive:true});
const spec=JSON.parse(await readFile('frontend/tests/fixtures/incident-flow.json','utf8'));
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
async function returnDetail(svg,layout,name){
 const detail=await browser.newPage({viewport:{width:1000,height:650},deviceScaleFactor:1});
 try{
  await detail.setContent('<html><body style="margin:0;background:white"></body></html>');
  await detail.evaluate(({svg,node})=>{
   const doc=new DOMParser().parseFromString(svg,'image/svg+xml');
   const nodeGroup=doc.querySelector('[data-node-id]'),diagram=nodeGroup.ownerSVGElement;
   diagram.setAttribute('viewBox',`${Math.max(0,node.x-20)} ${Math.max(0,node.y-20)} 540 351`);
   diagram.setAttribute('width','1000');diagram.setAttribute('height','650');
   diagram.style.width='1000px';diagram.style.height='650px';
   document.body.append(document.importNode(diagram,true));
  },{svg,node:layout.nodes.find(n=>n.id==='repair')});
  await detail.screenshot({path:`${out}/${name}-return-detail.png`});
 }finally{await detail.close()}
}
await page.route('**/api/v1/health',r=>r.fulfill({json:{provider:'stub',status:'ok'}}));
// This verification never sends content to a model.
await page.route('**/api/v1/generations',r=>r.abort());
try{
 await page.goto(process.env.BIAOSHU_WEB_URL??'http://127.0.0.1:5193');
 await page.getByRole('button',{name:'生成图表草稿',exact:true}).waitFor();
 const results=[];
 for(const direction of ['DOWN','RIGHT']){
  await page.setViewportSize({width:1440,height:900});
  const currentSpec={...spec,direction},g=flowGraph(currentSpec);
  for(const n of g.children){delete n.ports;delete n.layoutOptions}for(const e of g.edges)e.sources=[spec.edges.find(a=>a.id===e.id).source];
  const baseline=process.env.BIAOSHU_BASELINE_DIR
   ?JSON.parse(await readFile(`${process.env.BIAOSHU_BASELINE_DIR}/${direction}.json`,'utf8'))
   :readLayout(currentSpec,await new ELK().layout(g));
  const before=await page.evaluate(async ({spec,layout})=>{
   const {DEFAULT_STYLE}=await import('/src/model.ts');
   const {useWorkspace}=await import(performance.getEntriesByType('resource').map(e=>e.name).find(u=>new URL(u).pathname==='/src/store.ts'));
   const {flowQuality}=await import('/src/layout/flow-quality.ts');
   useWorkspace.getState().load({project_file_version:'1.0',diagram_type:'flowchart',source_text:'截图重建的合成测试数据',current_revision:1,versions:[{revision:1,origin:'ai',created_at:'2026-09-11T00:00:00Z',spec,layout,style:DEFAULT_STYLE,supplements:[],summary:'布局回归样例'}],metadata:{}},false);
   return flowQuality(spec,layout);
  },{spec:currentSpec,layout:baseline});
  await page.locator('.paper svg').waitFor();
  await page.screenshot({path:`${out}/${direction}-before-1440.png`});
  await returnDetail(await page.locator('.paper svg').evaluate(svg=>svg.outerHTML),baseline,`${direction}-before`);
  await page.getByRole('button',{name:'重新布局',exact:true}).click();
  const deadline=Date.now()+30000;
  while(await page.evaluate(async()=>{const {useWorkspace}=await import(performance.getEntriesByType('resource').map(e=>e.name).find(u=>new URL(u).pathname==='/src/store.ts'));return useWorkspace.getState().versions.at(-1)?.revision})!==2){
   assert.ok(Date.now()<deadline,'re-layout must create revision 2');await new Promise(resolve=>setTimeout(resolve,25));
  }
  const after=await page.evaluate(async()=>{
   const {useWorkspace}=await import(performance.getEntriesByType('resource').map(e=>e.name).find(u=>new URL(u).pathname==='/src/store.ts')),{flowQuality}=await import('/src/layout/flow-quality.ts');
   const {view}=await import('/src/model.ts'),{svgText,imageBlob,DEFAULT_EXPORT}=await import('/src/project/export.tsx');
   const state=useWorkspace.getState(),version=state.versions.at(-1),snapshot=view(version);
   const svg=await svgText(snapshot,DEFAULT_EXPORT),png=await imageBlob(snapshot,DEFAULT_EXPORT,'png');
   const data=await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.readAsDataURL(png)});
   const paths=doc=>[...doc.querySelectorAll('[data-edge-id] path')].map(p=>p.getAttribute('d'));
   const bitmap=await createImageBitmap(png);
   return {quality:flowQuality(version.spec,version.layout),revision:version.revision,svg,png:data,pngSize:[bitmap.width,bitmap.height],preview:paths(document.querySelector('.paper svg')),exported:paths(new DOMParser().parseFromString(svg,'image/svg+xml')),layout:version.layout};
  });
  assert.equal(after.revision,2);assert.deepEqual(after.quality.slice(0,4),[0,0,0,0]);assert.deepEqual(after.preview,after.exported);
  await writeFile(`${out}/${direction}.svg`,after.svg);await writeFile(`${out}/${direction}.png`,Buffer.from(after.png.split(',')[1],'base64'));
  await returnDetail(after.svg,after.layout,`${direction}-after`);
  for(const width of [1440,1920]){await page.setViewportSize({width,height:width===1440?900:1080});await page.screenshot({path:`${out}/${direction}-after-${width}.png`});}
  // Reopening a saved snapshot preserves its exact points; it does not re-layout.
  const reopened=await page.evaluate(async()=>{const {useWorkspace}=await import(performance.getEntriesByType('resource').map(e=>e.name).find(u=>new URL(u).pathname==='/src/store.ts'));const s=useWorkspace.getState(),v=s.versions.at(-1);s.load(JSON.parse(JSON.stringify({project_file_version:'1.0',diagram_type:'flowchart',source_text:'合成测试',current_revision:v.revision,versions:s.versions,metadata:{}})),false);return useWorkspace.getState().versions.at(-1).layout});
  assert.deepEqual(reopened,after.layout);
  results.push({direction,before,after:after.quality,pngSize:after.pngSize});
 }
 assert.deepEqual(errors,[]);await writeFile(`${out}/checks.json`,JSON.stringify({results,errors},null,2)+'\n');console.log(JSON.stringify({results,errors}));
}finally{await browser.close()}

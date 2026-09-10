import test from 'node:test';
import assert from 'node:assert/strict';
import {applyProposal,blockers,canDownload,makeSnapshot,propose,readSaved,restore} from '../src/model.ts';
import {useWorkspace} from '../src/store.ts';
test('two examples start as unconfirmed drafts',()=>{for(const kind of ['flowchart','gantt'] as const){const s=makeSnapshot(kind);assert.equal(s.confirmed,false);assert.equal(s.revision,1);assert.equal(canDownload(s,null),false)}});
test('proposal leaves original intact; applying creates a new revision',()=>{const s=makeSnapshot('gantt');const p=propose(s,'项目实施改为 24 天');assert.equal(s.duration,20);assert.match(p.impact,/27/);const n=applyProposal(s,p);assert.equal(n.duration,24);assert.equal(n.revision,2);assert.equal(s.duration,20)});
test('overrun blocks download even after a check',()=>{const s=applyProposal(makeSnapshot('gantt'),propose(makeSnapshot('gantt'),'项目实施改为 29 天'));assert.equal(blockers(s).length,1);assert.equal(canDownload(s,s.revision),false)});
test('current check is required and unknown rules only permit draft download',()=>{const s=makeSnapshot('gantt');assert.equal(canDownload(s,1),true);const n=applyProposal(s,propose(s,'项目实施改为 24 天'));assert.equal(canDownload(n,1),false);assert.equal(canDownload(n,2),true)});
test('protected business rejects both proposals and application',()=>{const s=makeSnapshot('gantt'),p=propose(s,'项目实施改为 24 天');assert.throws(()=>propose({...s,locked:true},'项目实施改为 24 天'),/保护/);assert.throws(()=>applyProposal({...s,locked:true},p),/保护/);assert.equal(applyProposal({...s,locked:true},propose(s,'图题改为 测试图题')).title,'测试图题')});
test('stale patch cannot overwrite a later revision',()=>{const s=makeSnapshot('flowchart'),p=propose(s,'图题改为 测试图题');assert.throws(()=>applyProposal({...s,revision:2},p),/变化/)});
test('unsupported free text is explicitly rejected',()=>assert.throws(()=>propose(makeSnapshot('flowchart'),'增加三位工程师'),/Demo/));
test('restoring creates a new revision and retains prior history',()=>{const a=makeSnapshot('gantt'),b=applyProposal(a,propose(a,'项目实施改为 24 天')),history=[a,b];const c=restore(history);assert.equal(c.revision,3);assert.equal(c.duration,20);assert.equal(history.length,2);assert.throws(()=>restore([a]),/暂无/)});
test('saved snapshots roundtrip and malformed data is rejected',()=>{const history=[makeSnapshot('gantt')];assert.deepEqual(readSaved(JSON.stringify(history)),history);assert.throws(()=>readSaved('[{}]'));assert.throws(()=>readSaved('[]'));assert.throws(()=>readSaved(JSON.stringify([{...history[0],duration:-1}])))});
test('store invalidates checks after changes and tracks save state',()=>{const w=useWorkspace.getState();w.replace([makeSnapshot('flowchart')]);w.check();assert.equal(useWorkspace.getState().checked,1);w.append({...makeSnapshot('flowchart'),revision:2});assert.equal(useWorkspace.getState().checked,null);assert.equal(useWorkspace.getState().dirty,true);w.saved();assert.equal(useWorkspace.getState().dirty,false)});
test('font rules cannot be bypassed through a patch',()=>{const s=makeSnapshot('flowchart');assert.throws(()=>applyProposal(s,{baseRevision:1,field:'fontSize',before:12,after:10,impact:''}),/12/)});

test('optional agent check shares visible state and validates input',async()=>{const {checkVisibleDiagram}=await import('../src/webmcp.ts');useWorkspace.getState().replace([]);assert.throws(()=>checkVisibleDiagram({}),/先/);useWorkspace.getState().replace([makeSnapshot('gantt')]);assert.throws(()=>checkVisibleDiagram({skip:true}),/参数/);const result=checkVisibleDiagram({});assert.equal(result.revision,1);assert.equal(result.projectCompliance,'unverified');assert.equal(useWorkspace.getState().checked,1)});
test('both diagrams render accessible SVG without embedded external content',async()=>{const {createElement}=await import('react');const {renderToStaticMarkup}=await import('react-dom/server');const {Diagram}=await import('../src/Diagram.tsx');for(const kind of ['flowchart','gantt'] as const){const html=renderToStaticMarkup(createElement(Diagram,{snapshot:makeSnapshot(kind)}));assert.match(html,/<svg/);assert.match(html,/role="img"/);assert.match(html,/交付验收/);assert.doesNotMatch(html,/<script|<foreignObject|<image/);}});

test('node edits preserve graph identity and enforce business lock',()=>{
 const s=makeSnapshot('flowchart'),n=s.nodes[0];
 const p={baseRevision:1,field:'nodeText' as const,target:n.id,before:n.text,after:'接收业务资料',impact:''};
 const next=applyProposal(s,p);assert.equal(next.nodes[0].text,'接收业务资料');assert.equal(s.nodes[0].text,n.text);assert.equal(next.nodes[0].id,n.id);assert.equal(next.revision,2);
 assert.throws(()=>applyProposal({...s,locked:true},p),/保护/);assert.throws(()=>applyProposal(s,{...p,target:'missing'}),/不存在/);
});
test('drag changes only geometry, stays in bounds and survives save/restore',()=>{
 const s=makeSnapshot('flowchart'),n=s.nodes[0];
 const p={baseRevision:1,field:'nodePosition' as const,target:n.id,before:JSON.stringify({x:n.x,y:n.y}),after:JSON.stringify({x:120,y:80}),impact:''};
 const next=applyProposal({...s,locked:true},p);assert.equal(next.nodes[0].x,120);assert.equal(next.nodes[0].text,n.text);assert.equal(next.duration,s.duration);
 assert.deepEqual(readSaved(JSON.stringify([s,next]))[1].nodes,next.nodes);assert.deepEqual(restore([s,next]).nodes,s.nodes);
 assert.throws(()=>applyProposal(s,{...p,after:'{"x":750,"y":80}'}),/超出/);assert.throws(()=>applyProposal({...s,revision:2},p),/变化/);
});
test('custom style roundtrips and confirmed black-white rules block incompatible colors',()=>{
 const s=makeSnapshot('flowchart'),appearance={...s.appearance,textColor:'#123456',backgroundColor:'#F0F8FF',fontFamily:'Arial',strokeWidth:3,cornerRadius:12};
 const p={baseRevision:1,field:'appearance' as const,before:JSON.stringify(s.appearance),after:JSON.stringify(appearance),impact:''};
 const next=applyProposal(s,p);assert.deepEqual(next.appearance,appearance);assert.deepEqual(next.nodes,s.nodes);assert.deepEqual(readSaved(JSON.stringify([s,next]))[1].appearance,appearance);
 assert.equal(blockers(next).length,0);assert.equal(blockers({...next,confirmed:true}).length,1);assert.equal(canDownload({...next,confirmed:true},next.revision),false);
 assert.throws(()=>applyProposal(s,{...p,after:JSON.stringify({...appearance,textColor:'url(https://example.com)'})}),/无效/);
});
test('legacy saved snapshots receive editable defaults without changing old business data',()=>{
 const legacy=makeSnapshot('gantt') as Partial<ReturnType<typeof makeSnapshot>>;delete legacy.appearance;delete legacy.nodes;delete legacy.taskLabels;
 const migrated=readSaved(JSON.stringify([legacy]))[0];assert.equal(migrated.revision,1);assert.equal(migrated.duration,20);assert.equal(migrated.nodes.length,8);assert.equal(migrated.appearance.backgroundColor,'#FFFFFF');
});
test('gantt text edits preserve schedule and enforce locks',()=>{
 const s=makeSnapshot('gantt'),p={baseRevision:1,field:'taskText' as const,target:'1',before:s.taskLabels[1],after:'执行实施计划',impact:''};
 const next=applyProposal(s,p);assert.equal(next.taskLabels[1],'执行实施计划');assert.equal(next.duration,20);assert.throws(()=>applyProposal({...s,locked:true},p),/保护/);
});
test('render uses changed positions, connected edges, labels and custom styles',async()=>{
 const {createElement}=await import('react');const {renderToStaticMarkup}=await import('react-dom/server');const {Diagram}=await import('../src/Diagram.tsx');
 const s=makeSnapshot('flowchart');s.nodes[0]={...s.nodes[0],text:'接收业务资料',x:120,y:80};s.appearance={...s.appearance,fontFamily:'Arial',backgroundColor:'#FAFAFA',fillColor:'#EDF4FF',strokeColor:'#334455'};
 const html=renderToStaticMarkup(createElement(Diagram,{snapshot:s}));assert.match(html,/接收业务资料/);assert.match(html,/x="120" y="80"/);assert.match(html,/M240 128/);assert.match(html,/font-family:Arial/);assert.match(html,/#FAFAFA/);assert.match(html,/fill="#EDF4FF"/);assert.match(html,/stroke="#334455"/);assert.doesNotMatch(html,/data-editor|foreignObject/);
});

test('all visual templates preserve user edits and history while invalidating checks',async()=>{
 const {TEMPLATES,templateProposal}=await import('../src/templates.ts');
 for(const kind of ['flowchart','gantt'] as const){const s=makeSnapshot(kind);s.nodes[0]={...s.nodes[0],text:'人工编辑文字',x:120};s.taskLabels[0]='人工任务名称';
 for(const t of TEMPLATES){const p=templateProposal(s,t.id);const next=applyProposal(s,p);assert.deepEqual(next.nodes,s.nodes);assert.deepEqual(next.taskLabels,s.taskLabels);assert.equal(next.duration,s.duration);assert.equal(next.confirmed,false);assert.deepEqual(next.appearance,t.appearance);assert.equal(next.revision,s.revision+1);assert.equal(canDownload(next,s.revision),false);assert.deepEqual(readSaved(JSON.stringify([s,next]))[1],next);}
 assert.throws(()=>templateProposal(s,'missing'),/不存在/);}
});
test('preset cannot bypass existing confirmed rules',async()=>{
 const {templateProposal}=await import('../src/templates.ts');const s={...makeSnapshot('flowchart'),confirmed:true};
 const next=applyProposal(s,templateProposal(s,'blue'));assert.equal(next.confirmed,true);assert.equal(canDownload(next,next.revision),false);assert.match(blockers(next).join(),/黑白/);
});
test('workspace shows three steps and template cards instead of review sidebar',async()=>{
 const {createElement}=await import('react');const {renderToStaticMarkup}=await import('react-dom/server');const {default:App}=await import('../src/App.tsx');useWorkspace.getState().replace([]);
 const html=renderToStaticMarkup(createElement(App));assert.match(html,/样式与模板/);assert.match(html,/商务蓝/);assert.match(html,/极简线框/);assert.match(html,/检查图表/);assert.doesNotMatch(html,/核对规则|class="review-panel|class="review-tabs/);assert.equal((html.match(/class="step-number"/g)||[]).length,3);
 const ids=[...html.matchAll(/<marker id="([^"]+)"/g)].map(m=>m[1]);assert.equal(ids.length,5);assert.equal(new Set(ids).size,5);
});

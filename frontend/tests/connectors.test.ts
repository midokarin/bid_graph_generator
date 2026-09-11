import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {moved} from '../src/model';
import {presentationLayout} from '../src/layout/presentation';
import {ganttDependencies,timeX,taskY} from '../src/layout/gantt';
import {cleanPath,crosses,edgePort} from '../src/layout/connectors';
import type {FlowchartSpec,FlowLayout,GanttSpec,GanttLayout} from '../src/domain/generated/ProjectFile';
const spec=JSON.parse(readFileSync(new URL('./fixtures/presentation.json',import.meta.url),'utf8')) as FlowchartSpec;
function validPath(points:{x:number;y:number}[]){
 assert.ok(points.length>=2);assert.deepEqual(cleanPath(points),points,'no redundant elbows');
 for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i];assert.ok(a.x===b.x||a.y===b.y,'orthogonal');assert.notDeepEqual(a,b,'no zero-length segment');}
}
function noCrossings(layout:FlowLayout,s:FlowchartSpec){
 for(const edge of layout.edges){
  for(const n of layout.nodes){
   const connection=s.edges.find(e=>e.id===edge.id)!;
   // The sloping diamond outline is inside its bounding rectangle.
   if((n.id===connection.source||n.id===connection.target)&&s.nodes.find(v=>v.id===n.id)!.type==='decision')continue;
   for(let i=1;i<edge.points.length;i++)assert.ok(!crosses(edge.points[i-1],edge.points[i],n),`${edge.id} crosses ${n.id}`);
  }
 }
}
test('repeated DOWN/RIGHT drags preserve ports, stop elbow/label accumulation and keep unrelated edges intact',()=>{
 for(const direction of ['DOWN','RIGHT'] as const){
  const s={...spec,direction},base=presentationLayout(s)!,id='n7',node=base.nodes.find(n=>n.id===id)!;
  const dx=direction==='DOWN'?8:20,dy=direction==='DOWN'?20:8;
  const once=moved(base,id,node.x+dx,node.y+dy,s.edges);let current=once;
  for(let i=0;i<40;i++){
   current=moved(current,id,node.x,node.y,s.edges);
   current=moved(current,id,node.x+dx,node.y+dy,s.edges);
   assert.deepEqual(current,once,'route and label do not drift after repeated edits');
  }
  assert.deepEqual(moved(current,id,node.x+dx,node.y+dy,s.edges),current,'no-op move preserves exact geometry');
  for(const edge of current.edges){
   const original=base.edges.find(e=>e.id===edge.id)!,connection=s.edges.find(e=>e.id===edge.id)!;
   if(connection.source!==id&&connection.target!==id){assert.deepEqual(edge,original);continue;}
   validPath(edge.points);
   for(const [nodeId,first] of [[connection.source,true],[connection.target,false]] as const){
    const before=edgePort(original.points,base.nodes.find(n=>n.id===nodeId)!,first),after=edgePort(edge.points,current.nodes.find(n=>n.id===nodeId)!,first);
    assert.deepEqual(after.direction,before.direction,'port side stays fixed');
    assert.deepEqual(after.point,{x:before.point.x+(nodeId===id?dx:0),y:before.point.y+(nodeId===id?dy:0)});
   }
  }
  noCrossings(current,s);assert.deepEqual(JSON.parse(JSON.stringify(current)),current);
 }
});
test('a straight flow connection can move sideways, reverse order and return without accumulating bends',()=>{
 const a={id:'a',x:100,y:70,width:100,height:50},b={id:'b',x:100,y:220,width:100,height:50};
 const base:FlowLayout={diagram_type:'flowchart',direction:'DOWN',width:600,height:500,nodes:[a,b],edges:[{id:'e',points:[{x:150,y:120},{x:150,y:220}],label_position:null}]};
 const connections=[{id:'e',source:'a',target:'b',label:null,kind:'normal' as const}];
 let current=base;
 for(const [x,y] of [[240,220],[240,10],[100,220],[240,220],[100,220]]){
  current=moved(current,'b',x,y,connections);const edge=current.edges[0];validPath(edge.points);
  assert.ok(edge.points[1].y>edge.points[0].y,'source exits downward');
  assert.ok(edge.points.at(-1)!.y>edge.points.at(-2)!.y,'target still enters downward');
  for(const n of current.nodes)for(let i=1;i<edge.points.length;i++)assert.ok(!crosses(edge.points[i-1],edge.points[i],n));
 }
 assert.deepEqual(current,base);
});
const ganttProject=JSON.parse(readFileSync(new URL('./fixtures/connectors-gantt.json',import.meta.url),'utf8'));
const ganttSpec=ganttProject.versions[0].spec as GanttSpec,ganttLayout=ganttProject.versions[0].layout as GanttLayout;
test('screenshot regression: every gantt arrow points right, clears bars/milestones, and remains inside the canvas',()=>{
 const routes=ganttDependencies(ganttSpec,ganttLayout,2.5);
 assert.equal(routes.length,10);
 for(const route of routes){validPath(route.points);const end=route.points.at(-1)!,previous=route.points.at(-2)!;assert.ok(end.x>previous.x);assert.equal(end.y,previous.y);
  for(const p of route.points)assert.ok(p.x>=280&&p.x<=880&&p.y>=70&&p.y<=ganttLayout.height-85);
  for(const t of ganttLayout.tasks){const milestone=t.id==='t8',n={x:timeX(t.start,30)-(milestone?9:0),y:taskY(t.row)-(milestone?9:14),width:milestone?18:timeX(t.end,30)-timeX(t.start,30),height:milestone?18:28};
   for(let i=1;i<route.points.length;i++)assert.ok(!crosses(route.points[i-1],route.points[i],n),`${route.id} crosses ${t.id}`);
  }
 }
 const original=JSON.stringify(ganttLayout);ganttDependencies(ganttSpec,ganttLayout,5);assert.equal(JSON.stringify(ganttLayout),original);
});
test('gantt negative/positive lag and same-time milestones keep right-facing arrows',()=>{
 const project=JSON.parse(readFileSync(new URL('../../packages/contracts/examples/gantt-project.json',import.meta.url),'utf8'));
 const v=project.versions[0];v.layout.width=900;v.layout.height=588;
 for(const route of ganttDependencies(v.spec,v.layout,1.5)){validPath(route.points);assert.ok(route.points.at(-1)!.x>route.points.at(-2)!.x);}
});

import type { ElkNode } from 'elkjs/lib/elk-api';
import type { FlowchartSpec, FlowLayout } from '../domain/generated/ProjectFile';
import {orderedBranches} from './branch-order';
export const TEXT_LIMITS = { flow: 60, task: 60, line: 12, lines: 5, horizontalLine: 8, horizontalLines: 8 } as const;
// Keep separate return paths legible even when they join the same node.
// Layered routing has distinct controls within layers and between layers.
export const FLOW_SPACING = {edge:36,node:36,label:12} as const;
export function wrapText(text:string, lineLength:number=TEXT_LIMITS.line){
  const lines:string[]=[];
  for(const paragraph of text.split(/\r?\n/u)){
    const chars=Array.from(paragraph);
    if(!chars.length)lines.push('');
    for(let i=0;i<chars.length;i+=lineLength)lines.push(chars.slice(i,i+lineLength).join(''));
  }
  return lines;
}
export function flowLines(text:string,direction:FlowchartSpec['direction'],geometry?:{width:number},type?:string){
  // Read wrapping from saved geometry too: existing wide snapshots retain their text flow.
  const capacity=geometry?Math.min(12,Math.max(1,Math.floor(geometry.width/(type==='decision'?40:26)))):TEXT_LIMITS.horizontalLine;
  return wrapText(text,direction==='RIGHT'?capacity:TEXT_LIMITS.line);
}
export function nodeSize(node:FlowchartSpec['nodes'][number],direction:FlowchartSpec['direction']){
  const lines=flowLines(node.text,direction),length=Math.max(...lines.map(line=>Array.from(line).length));
  if(direction==='RIGHT')return {width:node.type==='decision'?Math.max(184,length*40+32):Math.max(132,length*26+28),
    height:node.type==='decision'?Math.max(124,lines.length*52+60):Math.max(76,lines.length*28+32)};
  return {width:node.type==='decision'?Math.max(300,Math.min(12,Array.from(node.text).length)*40+16):320,
    height:node.type==='decision'?Math.max(148,lines.length*52+60):Math.max(68,lines.length*28+32)};
}
export function flowGraph(spec: FlowchartSpec): ElkNode {
  const graph:ElkNode={id:'root', layoutOptions:{'elk.algorithm':'layered','elk.direction':spec.direction,
    'elk.edgeRouting':'ORTHOGONAL','elk.padding':'[top=35,left=35,bottom=35,right=35]',
    'elk.layered.spacing.nodeNodeBetweenLayers':'65','elk.spacing.nodeNode':'55',
    'elk.spacing.edgeEdge':String(FLOW_SPACING.edge),
    'elk.layered.spacing.edgeEdgeBetweenLayers':String(FLOW_SPACING.edge),
    'elk.spacing.edgeNode':String(FLOW_SPACING.node),
    'elk.layered.spacing.edgeNodeBetweenLayers':String(FLOW_SPACING.node),
    'elk.spacing.edgeLabel':String(FLOW_SPACING.label),
    'elk.layered.considerModelOrder.strategy':'NODES_AND_EDGES'},
    children:spec.nodes.map(n=>({id:n.id,...nodeSize(n,spec.direction)})),
    edges:spec.edges.map(e=>({id:e.id,sources:[e.source],targets:[e.target],
      labels:e.label?[{text:e.label,width:Math.max(25,e.label.length*18),height:24}]:[]}))};
  for(const branches of orderedBranches(spec)){
    const node=graph.children!.find(n=>n.id===branches[0].source)!;
    node.layoutOptions={'elk.portConstraints':'FIXED_ORDER'};
    // ELK numbers ports clockwise: SOUTH is right-to-left, EAST top-to-bottom.
    node.ports=branches.map((edge,index)=>({id:`${node.id}:branch:${edge.id}`,width:0,height:0,
      layoutOptions:{'elk.port.side':spec.direction==='DOWN'?'SOUTH':'EAST',
        'elk.port.index':String(spec.direction==='DOWN'?branches.length-1-index:index)}}));
    for(const [index,edge] of branches.entries())graph.edges!.find(e=>e.id===edge.id)!.sources=[node.ports[index].id];
  }
  return graph;
}
export function readLayout(spec: FlowchartSpec, graph: ElkNode): FlowLayout {
  const result:FlowLayout={diagram_type:'flowchart', direction:spec.direction,width:graph.width!,height:graph.height!,
    nodes:graph.children!.map(n=>({id:n.id,x:n.x!,y:n.y!,width:n.width!,height:n.height!})),
    edges:(graph.edges??[]).map(e=>{
      const section=e.sections?.[0]; if(!section)throw new Error('连线路径缺失，请重新布局。');
      const label=e.labels?.[0];
      return {id:e.id,points:[section.startPoint,...section.bendPoints??[],section.endPoint] as unknown as FlowLayout['edges'][number]['points'],
        label_position:label?{x:label.x!+label.width!/2,y:label.y!+18}:null};
    })};
  // ELK routes to bounding boxes. Extend terminal segments to the actual
  // diamond/document outline while preserving its orthogonal bend points.
  for(const edge of result.edges){
    const connection=spec.edges.find(e=>e.id===edge.id)!;
    for(const [id,index] of [[connection.source,0],[connection.target,edge.points.length-1]] as const){
      const kind=spec.nodes.find(n=>n.id===id)!.type;
      const n=result.nodes.find(n=>n.id===id)!,p=edge.points[index];
      if(kind==='decision'){
        const cx=n.x+n.width/2,cy=n.y+n.height/2;
        if(Math.abs(p.y-n.y)<.01||Math.abs(p.y-n.y-n.height)<.01)
          p.y=cy+Math.sign(p.y-cy)*(n.height/2)*(1-Math.abs(p.x-cx)/(n.width/2));
        else p.x=cx+Math.sign(p.x-cx)*(n.width/2)*(1-Math.abs(p.y-cy)/(n.height/2));
      }else if(kind==='document'&&Math.abs(p.y-n.y-n.height)<.01){
        let lo=0,hi=1;
        for(let i=0;i<30;i++){const t=(lo+hi)/2;const x=n.x+n.width*((1-t)**3+3*(1-t)**2*t*.65+3*(1-t)*t*t*.35);if(x>p.x)lo=t;else hi=t;}
        const t=(lo+hi)/2;p.y=(1-t)**3*(n.y+n.height-12)+3*(1-t)**2*t*(n.y+n.height-32)+3*(1-t)*t*t*(n.y+n.height+12)+t**3*(n.y+n.height-12);
      }
    }
  }
  // ELK can express the same orthogonal coordinate with different floating
  // point tails. Normalize those before crossing checks and subsequent edits.
  for(const edge of result.edges)for(const point of edge.points){
    point.x=Math.round(point.x*1e6)/1e6;point.y=Math.round(point.y*1e6)/1e6;
  }
  return result;
}

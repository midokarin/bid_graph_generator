import type { ElkNode } from 'elkjs/lib/elk-api';
import type { FlowchartSpec, FlowLayout } from '../domain/generated/ProjectFile';
export const TEXT_LIMITS = { flow: 60, task: 60, line: 12, lines: 5 } as const;
export function wrapText(text:string){
  const lines:string[]=[];
  for(const paragraph of text.split(/\r?\n/u)){
    const chars=Array.from(paragraph);
    if(!chars.length)lines.push('');
    for(let i=0;i<chars.length;i+=TEXT_LIMITS.line)lines.push(chars.slice(i,i+TEXT_LIMITS.line).join(''));
  }
  return lines;
}
export function flowGraph(spec: FlowchartSpec): ElkNode {
  return {id:'root', layoutOptions:{'elk.algorithm':'layered','elk.direction':spec.direction,
    'elk.edgeRouting':'ORTHOGONAL','elk.padding':'[top=35,left=35,bottom=35,right=35]',
    'elk.layered.spacing.nodeNodeBetweenLayers':'65','elk.spacing.nodeNode':'55',
    'elk.layered.considerModelOrder.strategy':'NODES_AND_EDGES'},
    children:spec.nodes.map(n=>({id:n.id,width:n.type==='decision'?220:240,
      height:n.type==='decision'?140:Math.max(60,wrapText(n.text).length*26+24)})),
    edges:spec.edges.map(e=>({id:e.id,sources:[e.source],targets:[e.target],
      labels:e.label?[{text:e.label,width:Math.max(25,e.label.length*18),height:24}]:[]}))};
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
  return result;
}

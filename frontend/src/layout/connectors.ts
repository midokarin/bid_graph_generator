import type {FlowLayout,NodeGeometry} from '../domain/generated/ProjectFile';

export type Point={x:number;y:number};
type Box={x:number;y:number;width:number;height:number};
export type Port={point:Point;direction:Point;box:Box};
const equal=(a:Point,b:Point)=>Math.abs(a.x-b.x)<1e-7&&Math.abs(a.y-b.y)<1e-7;
export function cleanPath(points:Point[]):Point[]{
 const result:Point[]=[];
 for(const p of points){
  if(result.length&&equal(result.at(-1)!,p))continue;
  while(result.length>1){const a=result.at(-2)!,b=result.at(-1)!;
   if(!((a.x===b.x&&b.x===p.x&&(b.y-a.y)*(p.y-b.y)>=0)||(a.y===b.y&&b.y===p.y&&(b.x-a.x)*(p.x-b.x)>=0)))break;
   result.pop();
  }
  result.push({...p});
 }
 return result;
}
export function crosses(a:Point,b:Point,n:Box){
 return a.x===b.x?a.x>n.x&&a.x<n.x+n.width&&Math.max(a.y,b.y)>n.y&&Math.min(a.y,b.y)<n.y+n.height:
 a.y>n.y&&a.y<n.y+n.height&&Math.max(a.x,b.x)>n.x&&Math.min(a.x,b.x)<n.x+n.width;
}
// Keep the original attachment point and outward direction, including ports on
// a diamond's sloping outline. Never infer a new side from the nodes' centres.
export function edgePort(points:Point[],node:NodeGeometry,first:boolean):Port{
 const ordered=first?points:[...points].reverse(),point=ordered[0];
 const adjacent=ordered.find(p=>!equal(p,point));
 const direction=adjacent?(Math.abs(adjacent.x-point.x)>Math.abs(adjacent.y-point.y)?{x:Math.sign(adjacent.x-point.x),y:0}:{x:0,y:Math.sign(adjacent.y-point.y)}):{x:0,y:first?1:-1};
 return {point:{...point},direction,box:node};
}

// Route between fixed ports on an orthogonal visibility grid. The grid depends
// only on current geometry, so repeated edits cannot accumulate old elbows.
export function routePorts(source:Port,target:Port,boxes:Box[],width:number,height:number,gap=12):Point[]{
 const pad=(b:Box):Box=>{const x=Math.max(1,b.x-gap),y=Math.max(1,b.y-gap);return {x,y,width:Math.min(width-1,b.x+b.width+gap)-x,height:Math.min(height-1,b.y+b.height+gap)-y}};
 const obstacles=boxes.map(pad);
 const stub=(port:Port)=>{const b=pad(port.box),p=port.point,d=port.direction;return {x:d.x?d.x>0?b.x+b.width:b.x:p.x,y:d.y?d.y>0?b.y+b.height:b.y:p.y}};
 const start=stub(source),end=stub(target);
 const xs=[...new Set([1,width-1,start.x,end.x,(start.x+end.x)/2,...obstacles.flatMap(b=>[b.x,b.x+b.width])])].sort((a,b)=>a-b);
 const ys=[...new Set([1,height-1,start.y,end.y,(start.y+end.y)/2,...obstacles.flatMap(b=>[b.y,b.y+b.height])])].sort((a,b)=>a-b);
 const nx=xs.length,index=(p:Point)=>ys.indexOf(p.y)*nx+xs.indexOf(p.x),point=(i:number)=>({x:xs[i%nx],y:ys[Math.floor(i/nx)]});
 const startIndex=index(start),endIndex=index(end),initial=startIndex*2+(source.direction.x?0:1);
 const distance=new Map<number,number>([[initial,0]]),parent=new Map<number,number>();
 const heap:{key:number;cost:number;rank:number}[]=[];
 const push=(entry:typeof heap[number])=>{heap.push(entry);let i=heap.length-1;while(i){const p=(i-1)>>1;if(heap[p].rank<=entry.rank)break;heap[i]=heap[p];i=p}heap[i]=entry};
 const pop=()=>{const top=heap[0],last=heap.pop()!;if(heap.length){let i=0;while(i*2+1<heap.length){let child=i*2+1;if(child+1<heap.length&&heap[child+1].rank<heap[child].rank)child++;if(heap[child].rank>=last.rank)break;heap[i]=heap[child];i=child}heap[i]=last}return top};
 push({key:initial,cost:0,rank:0});let final:number|undefined;
 const blocked=new Map<string,boolean>();
 while(heap.length){
  const current=pop();if(current.cost!==distance.get(current.key))continue;
  const i=Math.floor(current.key/2),axis=current.key%2,a=point(i);
  if(i===endIndex){final=current.key;break}
  const ix=i%nx,iy=Math.floor(i/nx);
  for(const j of [ix>0?i-1:-1,ix<nx-1?i+1:-1,iy>0?i-nx:-1,iy<ys.length-1?i+nx:-1]){
   if(j<0)continue;const b=point(j),nextAxis=a.y===b.y?0:1,key=j*2+nextAxis;
   // Do not turn back through a port even when two nodes exchange order.
   if(i===startIndex&&(b.x-a.x)*source.direction.x+(b.y-a.y)*source.direction.y<0)continue;
   if(j===endIndex&&(a.x-b.x)*target.direction.x+(a.y-b.y)*target.direction.y<0)continue;
   const segment=`${Math.min(i,j)}:${Math.max(i,j)}`;
   if(!blocked.has(segment))blocked.set(segment,obstacles.some(n=>crosses(a,b,n)));
   if(blocked.get(segment))continue;
   const cost=current.cost+Math.abs(b.x-a.x)+Math.abs(b.y-a.y)+(axis===nextAxis?0:24)+(j===endIndex&&nextAxis!==(target.direction.x?0:1)?24:0);
   if(cost>=(distance.get(key)??Infinity))continue;
   distance.set(key,cost);parent.set(key,current.key);push({key,cost,rank:cost+Math.abs(b.x-end.x)+Math.abs(b.y-end.y)});
  }
 }
 if(final===undefined){
  // Overlapping nodes can block every corridor. Keep attachment and arrow
  // direction well-defined until the user separates them again.
  return cleanPath([source.point,start,{x:start.x,y:(start.y+end.y)/2},{x:end.x,y:(start.y+end.y)/2},end,target.point]);
 }
 const middle:Point[]=[];for(let key:number|undefined=final;key!==undefined;key=parent.get(key))middle.push(point(Math.floor(key/2)));
 return cleanPath([source.point,...middle.reverse(),target.point]);
}

export function relocateLabel(old:FlowLayout['edges'][number],points:Point[],label:string|null=null){
 if(!old.label_position)return null;
 const longest=(path:Point[])=>path.slice(1).map((b,i)=>({a:path[i],b,length:Math.abs(b.x-path[i].x)+Math.abs(b.y-path[i].y)})).sort((a,b)=>b.length-a.length)[0];
 const segment=longest(points);if(!segment)return old.label_position;
 return {x:(segment.a.x+segment.b.x)/2+(segment.a.x===segment.b.x?Math.max(24,Array.from(label??'').length*9+12):0),y:(segment.a.y+segment.b.y)/2+(segment.a.y===segment.b.y?-14:0)};
}

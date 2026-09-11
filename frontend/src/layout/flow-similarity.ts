import type {VersionSnapshot} from '../domain/generated/ProjectFile';
// Exact normalized content/geometry fingerprint. This detects duplicates, not
// semantic equivalence, and intentionally ignores generated IDs and titles.
export function flowFingerprint(snapshot:VersionSnapshot):string {
 const {spec,layout}=snapshot;if(spec.diagram_type!=='flowchart'||layout.diagram_type!=='flowchart')return '';
 const text=(value:string|null)=>(value??'').normalize('NFKC').replace(/\s+/gu,'').toLowerCase();
 const key=new Map(spec.nodes.map(n=>[n.id,`${n.type}:${text(n.text)}`]));
 const nodes=layout.nodes.map(n=>[key.get(n.id),...[n.x,n.y,n.width,n.height].map(v=>Math.round(v/4))]).sort((a,b)=>String(a).localeCompare(String(b)));
 const edges=spec.edges.map(e=>{
  const path=layout.edges.find(edge=>edge.id===e.id)!;
  return [key.get(e.source),key.get(e.target),e.kind,text(e.label),path.points.map(p=>[Math.round(p.x/4),Math.round(p.y/4)])];
 }).sort((a,b)=>String(a).localeCompare(String(b)));
 return JSON.stringify([spec.direction,nodes,edges]);
}

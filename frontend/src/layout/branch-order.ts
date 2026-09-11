import type {FlowchartSpec} from '../domain/generated/ProjectFile';

// Only interpret explicit ordinal labels, never the incidental order of words
// in a business description. Non-ordinal branches retain their model order.
export function branchRank(label:string|null):number|null {
 const text=(label??'').normalize('NFKC').trim();
 const match=text.match(/^(?:第)?([0-9]+|[一二三四五六七八九十]+)(?:级|等|类|档|阶段|步)(?:$|[：:（(、\s])/u)
  ??text.match(/^(?:P|L)(\d+)$/iu)
  ??text.match(/^([0-9]+|[一二三四五六七八九十]+)[、.．]?$/u);
 if(!match)return null;
 const token=match[1];if(/^\d+$/.test(token))return Number(token);
 const digits='零一二三四五六七八九';
 if(token==='十')return 10;
 if(/^[一二三四五六七八九]?十[一二三四五六七八九]?$/.test(token)){
  const [a,b]=token.split('十');return (a?digits.indexOf(a):1)*10+(b?digits.indexOf(b):0);
 }
 return token.length===1?digits.indexOf(token):null;
}

export function orderedBranches(spec:FlowchartSpec):FlowchartSpec['edges'][] {
 return spec.nodes.filter(n=>n.type==='decision').flatMap(n=>{
  const edges=spec.edges.filter(e=>e.source===n.id&&e.kind==='normal');
  const ranks=edges.map(e=>branchRank(e.label));
  if(edges.length<2||ranks.some(r=>r===null)||new Set(ranks).size!==edges.length||new Set(edges.map(e=>e.target)).size!==edges.length)return [];
  return [[...edges].sort((a,b)=>branchRank(a.label)!-branchRank(b.label)!)];
 });
}

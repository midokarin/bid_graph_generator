import {readFile,writeFile,mkdir} from 'node:fs/promises';
import ELK from 'elkjs/lib/elk.bundled.js';
import {flowGraph,readLayout} from '../frontend/src/layout/flow';
import {optimizedFlowLayout,flowQuality} from '../frontend/src/layout/flow-quality';
import {presentationLayout} from '../frontend/src/layout/presentation';
import {flowFingerprint} from '../frontend/src/layout/flow-similarity';
import type {FlowchartSpec} from '../frontend/src/domain/generated/ProjectFile';
import {DEFAULT_STYLE} from '../frontend/src/model';
const out='docs/evidence/candidate-quality';await mkdir(out,{recursive:true});
const rows=[];
for(const path of ['frontend/tests/fixtures/presentation.json','frontend/tests/fixtures/incident-flow.json','packages/contracts/examples/flowchart.json'])for(const direction of ['DOWN','RIGHT'] as const){
 const raw=JSON.parse(await readFile(path,'utf8')),spec:FlowchartSpec={...(raw.spec??raw),direction},elk=new ELK();
 // Reproduce the previous eight-trial scorer (before label collision scoring).
 let baseline=presentationLayout(spec);
 if(!baseline){let score:number[]|undefined;
  for(const cycle of ['GREEDY','DEPTH_FIRST'])for(const feedback of [false,true])for(const seed of [1,7]){
   const graph=flowGraph(spec);Object.assign(graph.layoutOptions!,{'elk.randomSeed':String(seed),'elk.layered.feedbackEdges':String(feedback),'elk.layered.cycleBreaking.strategy':cycle});
   const candidate=readLayout(spec,await elk.layout(graph)),q=flowQuality(spec,candidate),old=[...q.slice(0,4),...q.slice(5)];
   const index=score?old.findIndex((n,i)=>n!==score![i]):-1;
   if(!score||(index>=0&&old[index]<score[index])){baseline=candidate;score=old}
  }
 }
 const profiles=[],fingerprints=new Set();
 for(const profile of ['mainline','branches','stages'] as const){
  const start=performance.now(),layout=await optimizedFlowLayout(spec,g=>elk.layout(g),undefined,{profile,fontSize:12});
  fingerprints.add(flowFingerprint({spec,layout,style:DEFAULT_STYLE,revision:1,created_at:'2026-09-11T00:00:00Z',origin:'ai',supplements:[],summary:'合成对比'}));
  profiles.push({profile,elapsed_ms:Math.round(performance.now()-start),size:[layout.width,layout.height],quality:flowQuality(spec,layout)});
 }
 rows.push({fixture:path,direction,baseline:flowQuality(spec,baseline!),distinct_layouts:fingerprints.size,profiles});
}
await writeFile(`${out}/measurements.json`,JSON.stringify({source:'fixed synthetic fixtures; no external model calls',metrics:['ordinal_errors','node_obstructions','crossings','line_overlap_length','label_obstructions','bends','line_length','canvas_area'],rows},null,2)+'\n');
console.log(rows.map(r=>({fixture:r.fixture,direction:r.direction,distinct:r.distinct_layouts,beforeBends:r.baseline[5],afterBends:r.profiles.map(p=>p.quality[5]),defects:r.profiles.map(p=>p.quality.slice(0,5)),ms:r.profiles.map(p=>p.elapsed_ms)})));

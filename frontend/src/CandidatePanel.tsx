import {memo} from 'react';
import {LoaderCircle,Maximize2,Check} from 'lucide-react';
import {Diagram} from './Diagram';
import {view} from './model';
import {recommendedCandidate,type Candidate,type CandidateKey} from './candidates';

export const CandidatePanel=memo(function CandidatePanel({candidates,busy,adopted,onPreview,onAdopt}:{candidates:Candidate[];busy:boolean;adopted:CandidateKey|null;onPreview:(candidate:Candidate)=>void;onAdopt:(candidate:Candidate)=>void}){
 const recommended=busy?undefined:recommendedCandidate(candidates);
 return <section className="candidate-panel" aria-label="本次候选方案">
  <div className="candidate-heading"><strong>选择更合适的流程图</strong><span aria-live="polite">{candidates.filter(c=>c.status==='success').length} / 3 已完成</span></div>
  <div className="candidate-grid">{candidates.map((candidate,index)=><article className={`candidate-card ${candidate.status}`} key={candidate.key} aria-label={`方案 ${index+1}：${candidate.label}`}>
   <div className="candidate-label"><strong>{index+1}. {candidate.label}</strong>{recommended===candidate.key&&<span className="sub-badge" title="仅比较走线与位置，请核对业务内容">布局推荐</span>}</div>
   {candidate.snapshot?<button className="candidate-thumbnail" onClick={()=>onPreview(candidate)} aria-label={`放大方案 ${index+1}`}><Diagram snapshot={view(candidate.snapshot)} locked/><span><Maximize2 size={12}/>放大查看</span></button>:<div className="candidate-placeholder">{candidate.status==='running'&&<LoaderCircle size={20} className="spin"/>}<span>{candidate.message}</span></div>}
   {(candidate.snapshot||candidate.status==='error'||candidate.status==='cancelled')&&<p className="candidate-status" role="status">{candidate.snapshot?candidate.message:candidate.status==='error'?'此方案失败，其他方案可继续选择':candidate.status==='cancelled'?'已停止此方案':''}</p>}
   {candidate.snapshot&&<>{candidate.similarTo&&<span className="sub-badge" title="内容与排版接近另一候选；优先保证业务完整和走线质量">排版相近</span>}{candidate.quality?.slice(0,5).some(n=>n>0)&&<span className="sub-badge" title="检测到顺序、交叉、重叠或标签遮挡，请放大检查">走线待检查</span>}<p className="candidate-summary">{candidate.snapshot.summary}</p>{candidate.snapshot.supplements.length>0&&<span className="sub-badge">含 AI 补充，请核对</span>}<button className="button primary" disabled={busy||adopted===candidate.key} title={busy?'生成结束或取消剩余生成后可采用':undefined} onClick={()=>onAdopt(candidate)}>{adopted===candidate.key?<><Check size={14}/>已采用</>:'采用此方案'}</button></>}
   {Object.keys(candidate.attempts).length>0&&<details className="candidate-details"><summary>查看生成详情</summary>{Object.entries(candidate.attempts).map(([attempt,text])=><details key={attempt}><summary>{attempt==='0'?'首次生成':`第 ${attempt} 次修复`}</summary><pre tabIndex={0}>{text}</pre></details>)}</details>}
  </article>)}</div>
 </section>;
});

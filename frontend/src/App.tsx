import {useEffect,useRef,useState,useMemo} from 'react';
import {ArrowDownToLine,ArrowRight,Check,CircleHelp,ClipboardList,FileText,GitBranch,History,LayoutGrid,LoaderCircle,LockKeyhole,Maximize2,Minus,Plus,Save,Settings2,ShieldCheck,Sparkles,UnlockKeyhole,X,RotateCcw} from 'lucide-react';
import {ModelSettings} from './ModelSettings';
import {standaloneAdapter,type HostAdapter} from './adapters/host';
import type {ProjectHandle} from './project/files';
import {ExportSheet,imageBlob,DEFAULT_EXPORT,readExport,type ExportOptions} from './project/export';
import type {ProjectFile} from './domain/generated/ProjectFile';
import {Diagram} from './Diagram';
import {TemplatePanel} from './TemplatePanel';
import {TEMPLATES,templateProposal,describeAppearance} from './templates';
import {StyleSettings,describeChange} from './StyleSettings';
import {adjustment,previewStyle,styleError,type StyleAdjustment} from './styleDraft';
import {RunStream,type RunEvent,type RunStatus} from './RunStream';
import {VersionHistory} from './VersionHistory';
import {applyProposal,DEFAULT_STYLE,SAMPLES,view,withAppearance,type Kind,type Proposal,type Snapshot} from './model';
import {useWorkspace,historyViews} from './store';
import {layoutFlow} from './layout/client';
import {cancelGeneration,consumeGeneration,createGeneration,getHealth} from './api/client';
import {validateFlowchartResult,validateGanttResult} from './domain/validate';
import type {VersionSnapshot,ScheduledTask,FlowchartSpec,GanttSpec} from './domain/generated/ProjectFile';
import flowExample from '../../packages/contracts/examples/flowchart-project.json';
import ganttExample from '../../packages/contracts/examples/gantt-project.json';

export function App({host=standaloneAdapter}:{host?:HostAdapter}){
 const {versions,activeRevision,dirty,dirtyKinds,touch,markSaved,append,select,activate}=useWorkspace();const history=useMemo(()=>historyViews(versions),[versions]);const current=history.find(v=>v.revision===activeRevision);
 const [kind,setKind]=useState<Kind>('flowchart'),[text,setText]=useState(SAMPLES.flowchart.text),[title,setTitle]=useState(SAMPLES.flowchart.title),[bidMode,setBidMode]=useState('unknown'),[direction,setDirection]=useState<'DOWN'|'RIGHT'>('DOWN');
 const [panel,setPanel]=useState<'input'|'style'>('input'),[templateId,setTemplateId]=useState('classic');
 const [toast,setToast]=useState(''),[busy,setBusy]=useState(false),[proposal,setProposal]=useState<Proposal|null>(null),[modal,setModal]=useState<'export'|'help'|'replace'|'history'|'settings'|null>(null),[zoom,setZoom]=useState(100),[inputDirty,setInputDirty]=useState(false),[locked,setLocked]=useState(true);
 const [runStatus,setRunStatus]=useState<RunStatus>('idle'),[runEvents,setRunEvents]=useState<RunEvent[]>([]),[runExpanded,setRunExpanded]=useState(false),[attempts,setAttempts]=useState<Record<number,string>>({}),[provider,setProvider]=useState('连接中');
 const [draft,setDraft]=useState<Snapshot|null>(null),[confirmDraft,setConfirmDraft]=useState(false);
 const confirmationRef=useRef<HTMLDivElement>(null),stylePanelRef=useRef<HTMLElement>(null),previewPanelRef=useRef<HTMLElement>(null);
 useEffect(()=>{if(confirmDraft||proposal)confirmationRef.current?.focus()},[confirmDraft,proposal]);
 const [styleDraft,setStyleDraft]=useState<Snapshot|null>(null),[compareStyle,setCompareStyle]=useState(false);
 const pending=!!draft||!!styleDraft;
 const styleProblem=styleDraft?styleError(styleDraft):'';
 const cancelStyle=()=>{setStyleDraft(null);setCompareStyle(false)};
 function changeStyle(patch:Partial<StyleAdjustment>){
  if(!current||busy||draft||proposal)return;
  setLocked(true);setCompareStyle(false);
  setStyleDraft(previous=>previewStyle(current,{...adjustment(previous??current),...patch}));
 }
 function applyStyle(){
  if(!styleDraft||!current||busy||styleProblem)return;
  try{if(styleDraft.revision!==current.revision||styleDraft.kind!==current.kind)throw new Error('图表已变化，请重新调整版式。');append(styleDraft.version);cancelStyle();notify('版式已应用，已保留上一版。点击“保存项目”写入文件。')}catch(e){notify((e as Error).message)}
 }
 const guardDraft=()=>{if(pending){if(styleDraft)setPanel('style');notify(styleDraft?'请先应用版式或撤销调整，再进行此操作。':'请先确认或取消画布中的修改。');return true}return false};
 const cancelEdits=()=>{setDraft(null);setConfirmDraft(false);setLocked(true)};
 function stageEdit(p:Proposal){if(locked||busy||confirmDraft)return;try{setDraft(view(applyProposal(draft??current!,p)))}catch(e){notify((e as Error).message)}}
 function commitDraft(){if(!draft||!current||busy)return;try{if(draft.revision!==current.revision)throw new Error('图表已变化，请重新编辑。');append(draft.version);cancelEdits();notify('修改已应用，已保留上一版。')}catch(e){notify((e as Error).message)}}
 useEffect(()=>{cancelEdits();cancelStyle();setProposal(null)},[current?.version]);
 const [runStartedAt,setRunStartedAt]=useState<number|null>(null);
 const [exportOptions,setExportOptions]=useState<ExportOptions>(DEFAULT_EXPORT);
 const fileContexts=useRef<Partial<Record<Kind,{handle:ProjectHandle|null;metadata:ProjectFile['metadata'];source:string;title:string;options:ExportOptions}>>>({});
 const latestProject=useRef<ProjectFile|null>(null);
 const metadata=fileContexts.current[kind]?.metadata??{};
 latestProject.current=current?{project_file_version:'1.0',diagram_type:kind,source_text:text,current_revision:activeRevision!,versions:versions as ProjectFile['versions'],metadata:{...metadata,export_options:exportOptions,draft_title:title,bid_mode:bidMode,draft_direction:direction}}:null;
 const changeInput=(value:boolean)=>{setInputDirty(value);if(value)touch()};
 useEffect(()=>{host.getInitialText().then(value=>{if(value){setText(value);touch()}})},[host]);
 const svgRef=useRef<SVGSVGElement>(null),dialogRef=useRef<HTMLDialogElement>(null),controller=useRef<AbortController|null>(null),jobRef=useRef<string|null>(null);
 const notify=(message:string)=>setToast(message);
 useEffect(()=>{getHealth().then(h=>setProvider(h.provider==='stub'?'替身模型':'已连接模型')).catch(()=>setProvider('后端未连接'));return()=>{controller.current?.abort();if(jobRef.current)void cancelGeneration(jobRef.current)}},[]);
 useEffect(()=>{if(toast){const t=setTimeout(()=>setToast(''),4500);return()=>clearTimeout(t)}},[toast]);
 useEffect(()=>{const handler=(e:BeforeUnloadEvent)=>{if(Object.values(dirtyKinds).some(Boolean)||inputDirty||pending){e.preventDefault();e.returnValue=''}};window.addEventListener('beforeunload',handler);return()=>window.removeEventListener('beforeunload',handler)},[dirtyKinds,inputDirty,pending]);
 useEffect(()=>{if(modal)dialogRef.current?.showModal();else dialogRef.current?.close()},[modal]);
 const example={...(kind==='flowchart'?flowExample:ganttExample).versions[0],style:DEFAULT_STYLE} as VersionSnapshot;
 const preview=(compareStyle?current:styleDraft)??draft??current??withAppearance(view(example),TEMPLATES.find(t=>t.id===templateId)!.appearance);
 function selectTemplate(id:string){if(busy||guardDraft())return;if(current){const p=templateProposal(current,id);if(p.before!==p.after)setProposal(p)}else{setTemplateId(id);changeInput(true)}}
 function sample(k:Kind){if(busy||guardDraft())return;
  fileContexts.current[kind]={handle:fileContexts.current[kind]?.handle??null,metadata,source:text,title,options:exportOptions};
  activate(k);setKind(k);if(TEMPLATES.find(t=>t.id===templateId)?.kind&&TEMPLATES.find(t=>t.id===templateId)?.kind!==k)setTemplateId('classic');const prior=fileContexts.current[k];setText(prior?.source??SAMPLES[k].text);setTitle(prior?.title??SAMPLES[k].title);const options=prior?.options??DEFAULT_EXPORT;setExportOptions(options);setInputDirty(false);
 }
 function loadSample(){if(busy)return;setText(SAMPLES[kind].text);setTitle(SAMPLES[kind].title);changeInput(true)}
 function switchVersion(snapshot:Snapshot){if(guardDraft())return;select(snapshot.revision);setModal(null);notify(`已切换到 v${snapshot.revision}，可查看或继续编辑。`)}
 async function generate(force=false){
  if(busy||guardDraft())return;if(!text.trim())return notify('请先输入业务内容。');
  if(current&&!force){setModal('replace');return}
  setModal(null);setToast('');setBusy(true);setRunStatus('running');setRunExpanded(false);setRunEvents([]);setAttempts({});
  const control=new AbortController();controller.current=control;const started=Date.now();setRunStartedAt(started);let id=0;let result:any=null;let tasks:ScheduledTask[]|null=null;
  const push=(message:string,source:RunEvent['source']='程序',level:RunEvent['level']='info',details?:unknown)=>{const entry={id:++id,elapsed:`${((Date.now()-started)/1000).toFixed(1)}s`,source,message,level,details};setRunEvents(events=>[...events,entry])};
  try{
   push('正在整理业务步骤与页面参数');const job=await createGeneration({diagram_type:kind,source_text:text,direction});jobRef.current=job.job_id;
   if(control.signal.aborted){await cancelGeneration(job.job_id);throw new Error('已取消生成')}
   await consumeGeneration(job.events_url,({event,data})=>{
    if(event==='delta')setAttempts(a=>({...a,[data.attempt]:(a[data.attempt]??'')+data.text}));
    if(event==='status'){
     if(data.state==='queued')push('任务已创建，等待生成');
     if(data.state==='generating'||data.state==='repairing'){
      setAttempts(a=>({...a,[data.attempt]:a[data.attempt]??''}));
      push(data.state==='generating'?'正在分析内容并生成图表结构':`正在进行第 ${data.attempt} 次结构修复`,'LLM');
     }
     if(data.state==='validating')push('模型输出已接收，正在校验图表结构');
     if(data.state==='completed')push('结构校验通过，正在准备预览','程序','success');
    }
    if(event==='schedule'){tasks=data.tasks;push('已完成任务排期与依赖计算','程序','success')}
    if(event==='result'){
     result=data;
     push(data.spec.diagram_type==='flowchart'?`已返回 ${data.spec.nodes.length} 个节点、${data.spec.edges.length} 条连线`:`已返回 ${data.spec.tasks.filter((task:{kind:string})=>task.kind==='task').length} 项任务、${data.spec.tasks.filter((task:{kind:string})=>task.kind==='milestone').length} 个里程碑`,'LLM','success');
    }
    if(event==='validation_error')push('结构校验未通过，可展开查看原因','程序','error',data);
    if(event==='error')push(data.message??'生成遇到问题，可展开查看原因','程序','error',data);
   },control.signal);
   if(!result||!(kind==='flowchart'?validateFlowchartResult(result):validateGanttResult(result)))throw new Error('返回结果未通过前端契约校验。');
   push(kind==='flowchart'?'正在计算布局并绘制图形':'正在绘制任务与里程碑','渲染器');
   const spec=structuredClone(result.spec) as FlowchartSpec|GanttSpec;spec.title=title.trim()||spec.title;
   if(spec.diagram_type==='flowchart')spec.direction=direction;
   const layout=spec.diagram_type==='flowchart'?await layoutFlow(spec,control.signal):{diagram_type:'gantt' as const,width:900,height:Math.max(420,168+spec.tasks.length*84),tasks:tasks??[]};
   if(spec.diagram_type==='gantt'&&layout.diagram_type==='gantt'&&layout.tasks.length!==spec.tasks.length)throw new Error('后端排期缺失。');
   if(control.signal.aborted)throw new Error('已取消生成');
   append({revision:1,created_at:new Date().toISOString(),origin:'ai',spec,layout,style:current?.version.style??{...DEFAULT_STYLE,...withAppearance(view(example),preview.appearance).version.style,template:templateId},supplements:result.supplements,summary:result.summary});
   setInputDirty(false);push('预览已生成，可继续编辑','渲染器','success');setRunStatus('success');notify('草稿已生成，已创建完整版本快照。');
  }catch(e){const cancelled=control.signal.aborted;const message=cancelled?'已取消生成，未创建新版本':(e as Error).message;push(message,'程序',cancelled?'info':'error');setRunStatus(cancelled?'cancelled':'error');setRunExpanded(true);notify(message)}
  finally{setBusy(false);jobRef.current=null;controller.current=null}
 }
 async function cancel(){controller.current?.abort();if(jobRef.current)await cancelGeneration(jobRef.current).catch(()=>notify('取消请求未送达，本页已忽略后续结果。'))}
 async function relayout(){if(guardDraft()||!current||busy||current.version.spec.diagram_type!=='flowchart')return;setBusy(true);const c=new AbortController();controller.current=c;try{const layout=await layoutFlow(current.version.spec,c.signal);append({...current.version,layout,origin:'relayout'});notify('已重新布局并创建新版本。')}catch(e){notify((e as Error).message)}finally{controller.current=null;setBusy(false)}}
 function apply(){if(!current||!proposal||busy)return;try{append(applyProposal(current,proposal));setProposal(null);notify('修改已应用，已保留上一版。')}catch(e){notify((e as Error).message)}}
 async function save(){
  const project=latestProject.current;if(!project||busy||guardDraft())return;const serialized=JSON.stringify(project);setBusy(true);
  try{const result=await host.saveProject(project,fileContexts.current[kind]?.handle??null);
   fileContexts.current[kind]={handle:result.handle,metadata:project.metadata,source:project.source_text,title,options:readExport(project.metadata.export_options)};
   if(result.confirmed&&JSON.stringify(latestProject.current)===serialized){markSaved();setInputDirty(false)}
   notify(result.confirmed?'项目已保存。':'已发起项目下载；浏览器无法确认落盘，请检查下载文件，未保存标记保留。');
  }catch(e){if((e as Error).name!=='AbortError')notify('保存失败，仍保留未保存修改。'+(e as Error).message)}finally{setBusy(false)}
 }
 function changeExport(patch:Partial<ExportOptions>){setExportOptions(o=>({...o,...patch}));changeInput(true)}
 async function exportFile(format:'png'|'svg'){if(!current)return;try{host.exportImage(await imageBlob(current,exportOptions,format),`diagram-v${current.revision}.${format}`);notify(`${format.toUpperCase()} 已生成，请检查浏览器下载。`)}catch(e){notify((e as Error).message)}}
 function exportPreview(){if(guardDraft())return;if(current&&!busy)setModal('export')}
 const generating=busy&&runStatus==='running';
 const showPreview=!!current&&!generating;
 const stage=current?(modal==='export'?2:1):0;
 return <div className="app-shell">
  <aside className="rail"><a className="brand-mark" href="#" aria-label="标绘工作台"><GitBranch size={24}/></a><div className="rail-divider"/><button className="rail-item active" aria-label="图表工作台" onClick={()=>setPanel('input')}><LayoutGrid size={21}/><span>工作台</span></button><button className="rail-item" disabled={busy} onClick={()=>{if(!guardDraft())setModal('history')}}><History size={21}/><span>版本记录</span></button><div className="rail-bottom"><button className="rail-item" disabled={busy} onClick={()=>setModal('settings')}><Settings2 size={21}/><span>模型设置</span></button><button className="rail-item" onClick={()=>setModal('help')}><CircleHelp size={21}/><span>使用说明</span></button><div className="avatar">本地</div></div></aside>
  <div className="workspace"><header><div className="header-title"><strong>标绘<span> / </span></strong><span>标书图表工作台</span><span className="demo-badge">本地工作台</span></div><div className="header-actions"><span className="save-status"><i/>{pending?'有待确认修改':dirty||inputDirty?'有未保存修改':current?'已保存':'本地工作空间'}</span><button className="button" disabled={!current||busy} onClick={()=>save()}><Save size={16}/>保存项目</button><button className="button primary" disabled={!current||busy} onClick={exportPreview}><ArrowDownToLine size={16}/>下载草稿 PNG</button></div></header>
  <div className="project-heading"><div><div className="eyebrow">DIAGRAM STUDIO</div><h1>把方案，变成清晰的图表。</h1><p>从业务内容到文档插图，每一步都可核对、可修改。</p></div><div className="local-pill"><span/>{provider} · 本机服务</div></div>
  <nav className="steps" aria-label="制作流程">{['输入内容','预览与修改','导出'].map((label,i)=><div className={i===stage?'step selected':i<stage?'step done':'step'} key={label} aria-current={i===stage?'step':undefined}>{i===2?<button className="step-action" disabled={!current||busy} onClick={exportPreview}><span className="step-number">03</span><span>{label}</span></button>:<><span className="step-number">{i<stage?<Check size={14}/>:String(i+1).padStart(2,'0')}</span><span>{label}</span><span className="step-line"/></>}</div>)}</nav>
  <main className="editor-grid"><section ref={stylePanelRef} className="input-panel panel"><div className="panel-tabs"><button className={panel==='input'?'selected':''} onClick={()=>setPanel('input')}><FileText size={16}/>内容输入</button><button className={panel==='style'?'selected':''} onClick={()=>setPanel('style')}><Settings2 size={16}/>版式设置</button></div>
   <div className="input-scroll">{panel==='input'?<><div className="field-label">图表类型 <span className="required">*</span></div><div className="kind-picker"><button className={kind==='flowchart'?'selected':''} onClick={()=>sample('flowchart')}><GitBranch size={20}/><span>流程图</span>{kind==='flowchart'&&<Check size={14}/>}</button><button className={kind==='gantt'?'selected':''} onClick={()=>sample('gantt')}><ClipboardList size={20}/><span>甘特图</span>{kind==='gantt'&&<Check size={14}/>}</button></div>
   <label className="field-label" htmlFor="title">图题</label><input id="title" disabled={busy} value={title} onChange={e=>{setTitle(e.target.value);changeInput(true)}} placeholder="为这张图表命名"/>
   <label className="field-label" htmlFor="bid-mode">技术标类型 <span className="required">*</span></label><select id="bid-mode" value={bidMode} onChange={e=>{setBidMode(e.target.value);changeInput(true)}}><option value="unknown">尚不确定</option><option value="open">明标</option><option value="blind">暗标</option></select>
   <div className="field-label field-row"><label htmlFor="business">业务内容 <span className="required">*</span></label><button className="text-button" onClick={loadSample}>载入示例 <ArrowRight size={13}/></button></div><textarea id="business" disabled={busy} className="business-text" value={text} onChange={e=>{setText(e.target.value);changeInput(true)}}/><div className="input-caption">粘贴业务描述、步骤与依赖关系<span>{text.length} 字</span></div>
   <div className="source-note"><CircleHelp size={14}/><span>当前为内置示例，内容不代表真实项目要求。</span></div></>:<StyleSettings snapshot={styleDraft??current} disabled={busy||!!draft||!!proposal} error={styleProblem} onChange={changeStyle}/>}
   </div><div className="generate-footer">{panel==='style'?<><button className="text-button style-mobile-link" disabled={!current} onClick={()=>previewPanelRef.current?.scrollIntoView({block:'start'})}>查看实时预览 ↓</button><div className="style-actions"><button className="button" disabled={!styleDraft||busy} onClick={cancelStyle}>撤销调整</button><button className="button primary" disabled={!styleDraft||busy||!!styleProblem} onClick={applyStyle}><Check size={15}/>应用版式</button></div><span>{draft?'请先完成画布中的文字或位置修改':styleDraft?'仅在预览中试调，尚未应用':'应用后创建新版本，项目仍需手动保存'}</span></>:<>{kind==='flowchart'&&<select aria-label="流程布局方向" value={direction} disabled={busy} onChange={e=>{setDirection(e.target.value as 'DOWN'|'RIGHT');changeInput(true)}}><option value="DOWN">从上到下</option><option value="RIGHT">从左到右</option></select>}{busy&&<button className="text-button" onClick={cancel}>取消生成</button>}<button className="button primary generate" disabled={busy} onClick={()=>generate()}>{busy?<LoaderCircle size={18} className="spin"/>:<Sparkles size={18}/>} {busy?'正在生成…':current?'重新生成草稿':'生成图表草稿'}<ArrowRight size={17}/></button><span>{provider} · 完整校验后布局</span></>}</div>
  </section>
  <section ref={previewPanelRef} className="preview-panel panel"><div className="preview-toolbar"><div><span className="status-dot"/><strong>图表预览</strong>{showPreview&&<span className="sub-badge">v{current.revision}</span>}{showPreview&&current.version.supplements.length>0&&<span className="sub-badge" title={current.version.summary}>AI 补充</span>}</div><div className="canvas-toolbar-actions">{current&&!locked&&<><button className="button" disabled={busy} onClick={cancelEdits}>取消编辑</button><button className="button primary" disabled={!draft||busy} aria-expanded={confirmDraft} onClick={()=>setConfirmDraft(v=>!v)}>确认 <Check size={14}/></button></>}<button className="icon-button" disabled={!current||busy} title={locked?'解锁画布编辑':'锁定画布'} aria-label={locked?'解锁画布编辑':'锁定画布'} aria-pressed={locked??false} onClick={()=>{if(guardDraft())return;setLocked(v=>!v)}}>{locked?<LockKeyhole size={17}/>:<UnlockKeyhole size={17}/>}</button>{current?.kind==='flowchart'&&<button className="icon-button" disabled={busy} title="重新布局" aria-label="重新布局" onClick={relayout}><RotateCcw size={17}/></button>}<button className="icon-button" disabled={!showPreview} title="恢复适配视图" aria-label="恢复适配视图" onClick={()=>setZoom(100)}><Maximize2 size={17}/></button></div></div>{(confirmDraft||proposal)&&<div ref={confirmationRef} tabIndex={-1} className="edit-popover" role="dialog" aria-modal="false" aria-labelledby="edit-confirm-title" onKeyDown={e=>{if(e.key==='Escape'){setConfirmDraft(false);setProposal(null)}}}><button className="icon-button edit-popover-close" aria-label="关闭修改确认" onClick={()=>{setConfirmDraft(false);setProposal(null)}}><X size={16}/></button><h3 id="edit-confirm-title">确认本次修改</h3><p className="muted">基于 v{current?.revision}，确认后创建一个新版本。</p>{proposal?<><div className="diff-row"><span>修改前</span><del>{proposal.field==='appearance'?describeAppearance(proposal.before,kind):describeChange(proposal.before,proposal.field)}</del></div><div className="diff-row after"><span>修改后</span><strong>{proposal.field==='appearance'?describeAppearance(proposal.after,kind):describeChange(proposal.after,proposal.field)}</strong></div></>:<p className="edit-summary">应用本次调整的文字与节点位置，保留上一版以便恢复。</p>}<div className="dialog-actions"><button className="button" onClick={()=>{setConfirmDraft(false);setProposal(null)}}>继续编辑</button><button className="button primary" disabled={busy} onClick={proposal?apply:commitDraft}>确认并应用 <Check size={14}/></button></div></div>}{styleDraft&&<div className="style-preview-bar"><span role="status"><span className="status-dot"/>{compareStyle?'正在查看原版':styleProblem?'字号需要调整':'版式试调中 · 尚未应用'}</span><div><button className="button style-mobile-link" onClick={()=>{setPanel('style');stylePanelRef.current?.scrollIntoView({block:'start'})}}>返回版式设置 ↑</button><button className="button" aria-pressed={compareStyle} onClick={()=>setCompareStyle(v=>!v)}>{compareStyle?'返回调整效果':'查看原版'}</button>{panel!=='style'&&<button className="button" onClick={()=>setPanel('style')}>继续调整</button>}</div></div>}{runStatus!=='idle'&&<RunStream startedAt={runStartedAt} attempts={attempts} status={runStatus} events={runEvents} expanded={runExpanded} onExpandedChange={setRunExpanded}/>}<div className="canvas-area" aria-label="图表画布" aria-busy={generating}>{generating?<div className="preview-generating" role="status"><LoaderCircle size={24} className="spin" aria-hidden="true"/><span>正在生成</span></div>:showPreview?<><div className="canvas-info"><span>{kind==='flowchart'?'流程图':'甘特图'} · 自适应预览</span><span>{styleDraft?(compareStyle?'原版对比':'实时预览'):current?'工作草稿':'示例效果预览'}</span></div><div className="paper-wrap"><div className={'paper '+((current?.kind??kind)==='gantt'?'gantt-paper':'')} style={{width:`${zoom}%`,'--preview-zoom':zoom/100,background:preview.version.style.transparent_background?'transparent':preview.appearance.backgroundColor} as React.CSSProperties}><div className="paper-heading" style={{fontFamily:preview.appearance.fontFamily,color:preview.appearance.textColor}}>{current?.title??title}</div><Diagram key={`${kind}-${current?.revision??"preview"}-${locked}`} snapshot={preview} svgRef={svgRef} locked={locked||confirmDraft||!!proposal||!!styleDraft} onPropose={current&&!busy&&!locked&&!confirmDraft&&!proposal&&!styleDraft?stageEdit:undefined}/></div></div><div className="canvas-bottom"><span><LockKeyhole size={13}/>{styleDraft?'试调满意后，点击左侧“应用版式”':!current?'生成后可编辑':locked?'点击右上角小锁，解锁后编辑':current.kind==='flowchart'?'双击文字编辑 · 拖动节点调整位置':'双击任务名称编辑 · 工期定位'}</span><div className="zoom-controls"><button aria-label="缩小" disabled={zoom<=60} onClick={()=>setZoom(z=>z-10)}><Minus size={14}/></button><span>{zoom}%</span><button aria-label="放大" disabled={zoom>=150} onClick={()=>setZoom(z=>z+10)}><Plus size={14}/></button></div></div></>:null}</div>
  <div className="preview-actions"><button className="button primary" disabled={!current||busy} onClick={exportPreview}>下一步：导出 <ArrowRight size={16}/></button></div>
  </section>
  <TemplatePanel snapshot={current??preview} onSelect={selectTemplate} onCustomize={()=>setPanel('style')}/>
  </main><footer className="workspace-footer"><span><ShieldCheck size={13}/>项目手动保存 · 关闭前注意未保存内容</span><span>PNG / SVG <span className="footer-dot">·</span> 自定义文档插图</span></footer>
  </div>{toast&&<div role="status" className="toast"><CircleHelp size={18}/>{toast}<button aria-label="关闭提示" onClick={()=>setToast('')}><X size={15}/></button></div>}
  <dialog ref={dialogRef} onCancel={()=>{setModal(null);setProposal(null)}}><button className="dialog-close icon-button" aria-label="关闭弹窗" onClick={()=>{setModal(null);setProposal(null)}}><X size={20}/></button>{modal==='settings'?<ModelSettings onSaved={()=>{setModal(null);setProvider('已连接模型');notify('模型配置已保存。')}}/>:modal==='export'?<><h2>图表输出预览</h2><p className="muted">v{current?.revision} · 使用当前快照中的图形与布局</p><div className="export-options"><label>图题<select aria-label="导出图题" value={String(exportOptions.includeTitle)} onChange={e=>changeExport({includeTitle:e.target.value==='true'})}><option value="true">包含图题</option><option value="false">不含图题</option></select></label><label>背景<select aria-label="导出背景" value={exportOptions.background} onChange={e=>changeExport({background:e.target.value as ExportOptions['background']})}><option value="white">白色</option><option value="transparent">透明</option><option value="custom">自定义</option></select></label>{exportOptions.background==='custom'&&<label>背景颜色<input aria-label="导出背景颜色" type="color" value={exportOptions.color} onChange={e=>changeExport({color:e.target.value})}/></label>}</div><div className="export-image">{current&&<ExportSheet snapshot={current} options={exportOptions}/>}</div><p className="scope-note">完整图片 · PNG 3 倍清晰度 · 长图不分页 · AI 补充不阻止导出</p><div className="dialog-actions"><button className="button" onClick={()=>setModal(null)}>返回编辑</button><button className="button" onClick={()=>exportFile('svg')}>下载 SVG</button><button className="button primary" onClick={()=>exportFile('png')}><ArrowDownToLine size={16}/>下载草稿 PNG</button></div></>:modal==='history'?<VersionHistory history={history} currentRevision={current?.revision??null} onSelect={switchVersion} onRestore={()=>{current&&append({...current.version,origin:'restore'});setModal(null);notify('已恢复所查看版本内容，保存为新版本。');}}/>:modal==='replace'?<><h2>重新生成草稿？</h2><p className="muted">将使用左侧内容、图题和版式创建新版本。当前预览中的修改不会带入新草稿，历史版本保留。</p><div className="dialog-actions"><button className="button" onClick={()=>setModal(null)}>继续编辑</button><button className="button primary" onClick={()=>generate(true)}>确认重新生成</button></div></>:<><div className="dialog-symbol"><Sparkles size={24}/></div><h2>体验一张图表的完整流程</h2><ol className="help-steps"><li>选择流程图或甘特图，载入内置示例。</li><li>生成草稿，从右侧缩略图选择样式模板。</li><li>点击小锁解锁后，可连续修改文字和拖动节点；完成后点击确认，再应用本次修改。</li><li>在版式设置中调整字体、字号和线条，实时预览后应用；也可查看原版或撤销调整。</li><li>在版本记录中查看和恢复完整快照。</li></ol><p className="scope-note">在模型设置中配置接口后即可生成。可通过顶部“保存项目”手动保存当前图表及版本，下载弹窗支持 PNG 和 SVG。</p><button className="button primary full" onClick={()=>setModal(null)}>开始体验 <ArrowRight size={16}/></button></>}</dialog>
 </div>
}

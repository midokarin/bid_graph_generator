export type Kind = 'flowchart' | 'gantt';
export const FONTS = ['sans-serif', 'Arial', '宋体', '黑体', '微软雅黑', 'PingFang SC'];
export type Appearance = {fontFamily:string; textColor:string; strokeColor:string; backgroundColor:string; fillColor:string; strokeWidth:number; cornerRadius:number};
export type FlowNode = {id:string; text:string; x:number; y:number; width:number; height:number; shape:'box'|'diamond'|'terminal'};
export const DEFAULT_APPEARANCE:Appearance = {fontFamily:'sans-serif',textColor:'#000000',strokeColor:'#000000',backgroundColor:'#FFFFFF',fillColor:'#FFFFFF',strokeWidth:1.5,cornerRadius:5};
export function defaultNodes():FlowNode[]{return [
 ['n1','接收项目需求',260,25,240,48,'terminal'],['n2','需求分析与确认',260,108,240,52,'box'],['n3','编制实施方案',260,195,240,52,'box'],['n4','组织项目实施',260,282,240,52,'box'],['n5','质量检查',270,369,220,112,'diamond'],['n6','交付验收',260,526,240,50,'box'],['n7','项目结束',290,611,180,40,'terminal'],['n8','问题整改',568,399,155,52,'box']
].map(([id,text,x,y,width,height,shape])=>({id,text,x,y,width,height,shape})) as FlowNode[]}
export type Snapshot = { revision: number; appearance:Appearance; nodes:FlowNode[]; taskLabels:string[]; kind: Kind; title: string; confirmed: boolean; fontSize: number; duration: number; locked: boolean; source: string; bidMode: string; page: string; orientation: string };
export type Proposal = { baseRevision: number; field: 'title' | 'duration' | 'fontSize' | 'appearance' | 'nodeText' | 'nodePosition' | 'taskText'; target?:string; before: string | number; after: string | number; impact: string };
export const SAMPLES: Record<Kind, {title: string; text: string}> = {
  flowchart: {title: '项目实施与验收流程', text: '接收项目需求 → 需求分析与确认 → 编制实施方案 → 组织项目实施 → 质量检查。\n质量检查合格后，交付验收，项目结束。\n质量检查不合格时，进行问题整改，并返回质量检查。'},
  gantt: {title: '项目实施进度计划', text: '以合同生效日为第 1 天，总工期不超过 30 个日历天。\n准备工作：3 天。\n项目实施：20 天，在准备工作完成后开始。\n交付验收：零工期里程碑，在项目实施完成时发生。'}
};
export function makeSnapshot(kind: Kind, title = SAMPLES[kind].title): Snapshot {
  return {revision: 1, appearance:{...DEFAULT_APPEARANCE}, nodes:defaultNodes(), taskLabels:['准备工作','项目实施','交付验收'], kind, title, confirmed: false, fontSize: 12, duration: 20, locked: false, source: SAMPLES[kind].text, bidMode: 'unknown', page: 'A4', orientation: 'portrait'};
}
export function propose(s: Snapshot, input: string): Proposal {
  const title = input.match(/^(?:将)?(?:图题|标题)(?:改为|改成|修改为)[：:「“\s]*(.+?)[」”]?$/);
  if (title) return {baseRevision:s.revision, field:'title', before:s.title, after:title[1].trim(), impact:'仅修改图题，图内业务内容与顺序保持不变。'};
  const days = input.match(/(?:项目实施|实施阶段).*?(?:改为|改成|调整为)\s*(\d+)\s*天/);
  if (days && s.kind === 'gantt') {
    if (s.locked) throw new Error('业务内容已保护，请先解除保护后再提出工期修改。');
    const after = Number(days[1]);
    if (after < 1 || after > 90) throw new Error('演示支持 1–90 天的实施工期。');
    return {baseRevision:s.revision, field:'duration', before:s.duration, after, impact:`交付验收由第 ${3+s.duration} 天结束移至第 ${3+after} 天结束。${3+after>30?'超出 30 天总工期，将阻断下载。':'仍在 30 天总工期以内。'}`};
  }
  throw new Error('此 Demo 支持“图题改为 …”；甘特图还支持“项目实施改为 24 天”。其他自然语言修改需后续接入模型。');
}
export function validateAppearance(a:Appearance){
 if(!a || !FONTS.includes(a.fontFamily) || !['textColor','strokeColor','backgroundColor','fillColor'].every(k=>/^#[0-9a-f]{6}$/i.test(a[k as keyof Appearance] as string)) || !Number.isFinite(a.strokeWidth)||a.strokeWidth<.5||a.strokeWidth>5||!Number.isFinite(a.cornerRadius)||a.cornerRadius<0||a.cornerRadius>24)throw new Error('版式参数无效。');
}
export function applyProposal(s: Snapshot, p: Proposal): Snapshot {
 if(s.revision!==p.baseRevision)throw new Error('图表已变化，请重新提交修改。');
 if(s.locked&&['duration','nodeText','taskText'].includes(p.field))throw new Error('业务内容已保护，无法修改文字或工期。');
 if(p.field==='appearance'){
  if(JSON.stringify(s.appearance)!==p.before)throw new Error('版式已变化。');
  const appearance=JSON.parse(String(p.after));validateAppearance(appearance);return {...s,appearance,revision:s.revision+1};
 }
 if(p.field==='nodeText'||p.field==='nodePosition'){
  const n=s.nodes.find(n=>n.id===p.target);if(!n||s.kind!=='flowchart')throw new Error('节点不存在。');
  const before=p.field==='nodeText'?n.text:JSON.stringify({x:n.x,y:n.y});if(before!==p.before)throw new Error('节点已变化。');
  let update:Partial<FlowNode>;
  if(p.field==='nodeText'){if(typeof p.after!=='string'||!p.after.trim()||p.after.length>60)throw new Error('节点文字需为 1–60 字。');update={text:p.after.trim()};}
  else {const pos=JSON.parse(String(p.after));if(!Number.isFinite(pos.x)||!Number.isFinite(pos.y)||pos.x<5||pos.y<5||pos.x+n.width>755||pos.y+n.height>655)throw new Error('节点超出画布。');update={x:pos.x,y:pos.y};}
  return {...s,nodes:s.nodes.map(node=>node.id===n.id?{...node,...update}:node),revision:s.revision+1};
 }
 if(p.field==='taskText'){
  const index=Number(p.target);if(s.kind!=='gantt'||![0,1,2].includes(index)||s.taskLabels[index]!==p.before||typeof p.after!=='string'||!p.after.trim()||p.after.length>30)throw new Error('任务文字无效。');
  return {...s,taskLabels:s.taskLabels.map((v,i)=>i===index?String(p.after).trim():v),revision:s.revision+1};
 }
 if(s[p.field]!==p.before)throw new Error('图表已变化，请重新提交修改。');
 if(p.field==='fontSize'&&(![12,14,16].includes(Number(p.after))))throw new Error('字号需为 12、14 或 16 磅。');
 if(p.field==='duration'&&(!Number.isInteger(p.after)||Number(p.after)<1||Number(p.after)>90))throw new Error('工期无效。');
 if(p.field==='title'&&(typeof p.after!=='string'||!p.after.trim()))throw new Error('图题不能为空。');
 return {...s,[p.field]:p.after,revision:s.revision+1};
}
export function blockers(s:Snapshot){
 const errors:string[]=[];
 if(s.kind==='gantt'&&s.duration+3>30)errors.push(`当前总工期 ${s.duration+3} 天，超出 30 天上限 ${s.duration-27} 天。`);
 if(s.confirmed){const a=s.appearance;if(a.textColor.toUpperCase()!=='#000000'||a.strokeColor.toUpperCase()!=='#000000'||a.backgroundColor.toUpperCase()!=='#FFFFFF'||a.fillColor.toUpperCase()!=='#FFFFFF')errors.push('当前颜色与已确认的黑白白底示例规则冲突，请恢复黑白配色。');}
 return errors;
}
export function canDownload(s: Snapshot, checkedRevision: number | null) { return checkedRevision === s.revision && blockers(s).length === 0; }
export function restore(history: Snapshot[]): Snapshot {
  if (history.length < 2) throw new Error('暂无上一版。');
  return {...history[history.length-2], revision:history[history.length-1].revision+1};
}
export function readSaved(raw: string): Snapshot[] {
  const value: unknown = JSON.parse(raw);
  if (!Array.isArray(value) || !value.length || value.length > 500) throw new Error('保存的数据无效。');
  for (const [i,s] of value.entries()) {
    if(s && !s.appearance){s.appearance={...DEFAULT_APPEARANCE};s.nodes=defaultNodes();s.taskLabels=['准备工作','项目实施','交付验收'];}
    if (!s || !['flowchart','gantt'].includes(s.kind) || !Number.isInteger(s.revision) || s.revision < 1 || (i>0 && s.revision <= value[i-1].revision) || typeof s.title !== 'string' || typeof s.source !== 'string' || typeof s.confirmed !== 'boolean' || typeof s.locked !== 'boolean' || ![12,14,16].includes(s.fontSize) || !Number.isInteger(s.duration) || s.duration<1 || s.duration>90 || !['open','blind','unknown'].includes(s.bidMode) || !['A4','A3'].includes(s.page) || !['portrait','landscape'].includes(s.orientation)) throw new Error('保存的数据不完整或版本不兼容。');
    validateAppearance(s.appearance);
    if(!Array.isArray(s.nodes)||s.nodes.length!==8||!Array.isArray(s.taskLabels)||s.taskLabels.length!==3||s.taskLabels.some((t:unknown)=>typeof t!=='string'||!t.trim()||t.length>30))throw new Error('图表数据无效。');
    for(const n of defaultNodes()){const actual=s.nodes.find((v:FlowNode)=>v.id===n.id);if(!actual||actual.width!==n.width||actual.height!==n.height||actual.shape!==n.shape||typeof actual.text!=='string'||!actual.text.trim()||actual.text.length>60||!Number.isFinite(actual.x)||!Number.isFinite(actual.y)||actual.x<5||actual.y<5||actual.x+n.width>755||actual.y+n.height>655)throw new Error('节点数据无效。');}
  }
  return value as Snapshot[];
}

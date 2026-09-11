import {DEFAULT_APPEARANCE,type Appearance,type Snapshot,type Proposal,type Kind} from './model';
export const TEMPLATE_CATEGORIES=['全部','黑白打印','技术方案','实施交付','进度计划'] as const;
export type TemplateCategory=typeof TEMPLATE_CATEGORIES[number];
type Template={id:string;name:string;description:string;category:TemplateCategory;tags:string[];kind?:Kind;appearance:Appearance};
export const TEMPLATES:Template[]=[
 {id:'classic',name:'经典黑白',category:'黑白打印',tags:['标准线框','通用插图'],description:'白底细线，适合正文中的常规图表。',appearance:{...DEFAULT_APPEARANCE}},
 {id:'print',name:'标书正式版',category:'黑白打印',tags:['宋体','直角','加粗边框'],description:'宋体搭配直角粗框，适合技术标正文与打印附件。',appearance:{...DEFAULT_APPEARANCE,fontFamily:'宋体',cornerRadius:0,strokeWidth:2.5,ganttBarStyle:'outline',ganttGrid:'rows'}},
 {id:'blue',name:'商务蓝',category:'技术方案',tags:['浅色填充','圆角'],description:'浅蓝底与清晰轮廓，适合方案汇报。',appearance:{...DEFAULT_APPEARANCE,textColor:'#203E63',strokeColor:'#3C6BA0',fillColor:'#EDF4FC',cornerRadius:8,strokeWidth:2}},
 {id:'technical',kind:'flowchart',name:'技术方案',category:'技术方案',tags:['黑体','顶部强调','加粗文字'],description:'顶部强调条突出处理环节，适合技术路线与系统实施。',appearance:{...DEFAULT_APPEARANCE,fontFamily:'黑体',fontWeight:600,textColor:'#203E63',strokeColor:'#3C6BA0',fillColor:'#F4F7FB',cornerRadius:0,nodeAccent:'top',ganttBarStyle:'solid',ganttGrid:'banded'}},
 {id:'delivery',kind:'flowchart',name:'实施交付',category:'实施交付',tags:['侧边强调','圆角卡片'],description:'侧边强调条与柔和圆角，适合实施流程和交付安排。',appearance:{...DEFAULT_APPEARANCE,textColor:'#254D40',strokeColor:'#527D69',fillColor:'#EFF6F0',cornerRadius:12,nodeAccent:'left',fontWeight:600,ganttGrid:'banded'}},
 {id:'review',name:'审核与验收',category:'实施交付',tags:['虚线边框','黑白'],description:'虚线轮廓区分图表风格，适合审核程序插图。',appearance:{...DEFAULT_APPEARANCE,borderStyle:'dashed',cornerRadius:0,strokeWidth:2,ganttBarStyle:'outline',ganttGrid:'rows'}},
 {id:'green',name:'简约绿',category:'实施交付',tags:['柔和填充','圆角'],description:'简洁柔和，适合服务组织与日常工作安排。',appearance:{...DEFAULT_APPEARANCE,textColor:'#254D40',strokeColor:'#527D69',fillColor:'#EFF6F0',cornerRadius:12}},
 {id:'outline',name:'极简线框',category:'黑白打印',tags:['直角','轻量线条'],description:'减少装饰，适合信息较多的正文插图。',appearance:{...DEFAULT_APPEARANCE,textColor:'#343A40',strokeColor:'#687078',strokeWidth:1,cornerRadius:0,ganttBarStyle:'outline',ganttGrid:'rows'}},
 {id:'schedule-print',name:'施工进度横道表',category:'进度计划',kind:'gantt',tags:['斜线纹理','完整网格','黑白'],description:'用斜线纹理表示任务区间，适合黑白打印的进度附件。',appearance:{...DEFAULT_APPEARANCE,fontFamily:'宋体',cornerRadius:0,strokeWidth:2,ganttBarStyle:'hatched',ganttGrid:'full'}},
 {id:'schedule-report',name:'项目进度汇报',category:'进度计划',kind:'gantt',tags:['实心横道','隔行底纹','加粗文字'],description:'实心横道搭配隔行底纹，便于逐行查看任务与工期。',appearance:{...DEFAULT_APPEARANCE,textColor:'#203E63',strokeColor:'#3C6BA0',fillColor:'#3C6BA0',cornerRadius:5,fontWeight:600,ganttGrid:'banded'}}
];
export function templatesFor(kind:Kind){return TEMPLATES.filter(t=>!t.kind||t.kind===kind)}
export function templateProposal(s:Snapshot,id:string):Proposal{
 const template=templatesFor(s.kind).find(t=>t.id===id);if(!template)throw new Error('当前图种不支持此模板。');
 return {baseRevision:s.revision,field:'appearance',template:id,before:JSON.stringify(s.appearance),after:JSON.stringify(template.appearance),impact:`应用「${template.name}」：${template.tags.join('、')}。文字、节点位置、连接关系及工期保持不变。`};
}
export function describeAppearance(value:string|number,kind:Kind):string{
 const a=JSON.parse(String(value)) as Appearance;
 const base=`字体：${a.fontFamily==='sans-serif'?'系统默认':a.fontFamily}；字重：${{400:'常规',600:'半粗',700:'加粗'}[a.fontWeight]}；线宽：${a.strokeWidth} px；圆角：${a.cornerRadius} px；边框：${a.borderStyle==='dashed'?'虚线':'实线'}；文字色：${a.textColor}；线条色：${a.strokeColor}；填充色：${a.fillColor}`;
 return base+(kind==='flowchart'?`；节点强调：${{none:'无',top:'顶部强调条',left:'左侧强调条'}[a.nodeAccent]}`:`；横道：${{solid:'填充',outline:'空心',hatched:'斜线纹理'}[a.ganttBarStyle]}；表格：${{full:'完整网格',rows:'横向分隔',banded:'隔行底纹'}[a.ganttGrid]}`);
}

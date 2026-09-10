import {DEFAULT_APPEARANCE,type Appearance,type Snapshot,type Proposal} from './model';
export const TEMPLATES:{id:string;name:string;description:string;appearance:Appearance}[]=[
 {id:'classic',name:'经典黑白',description:'清晰克制，适合文档插图',appearance:{...DEFAULT_APPEARANCE}},
 {id:'blue',name:'商务蓝',description:'蓝色线条，浅色节点',appearance:{...DEFAULT_APPEARANCE,textColor:'#203E63',strokeColor:'#3C6BA0',fillColor:'#EDF4FC',cornerRadius:8,strokeWidth:2}},
 {id:'green',name:'简约绿',description:'柔和填充，圆角边框',appearance:{...DEFAULT_APPEARANCE,textColor:'#254D40',strokeColor:'#527D69',fillColor:'#EFF6F0',cornerRadius:12}},
 {id:'outline',name:'极简线框',description:'直角节点，轻量线条',appearance:{...DEFAULT_APPEARANCE,textColor:'#343A40',strokeColor:'#687078',strokeWidth:1,cornerRadius:0}}
];
export function templateProposal(s:Snapshot,id:string):Proposal{
 const template=TEMPLATES.find(t=>t.id===id);if(!template)throw new Error('模板不存在。');
 return {baseRevision:s.revision,field:'appearance',template:id,before:JSON.stringify(s.appearance),after:JSON.stringify(template.appearance),impact:`应用「${template.name}」的配色与线条样式。文字、节点位置、连接关系及工期保持不变。`};
}

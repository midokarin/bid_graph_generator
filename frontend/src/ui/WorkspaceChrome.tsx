import {useEffect, useState, type ReactNode} from 'react';
import {ChevronRight, CircleHelp, FolderOpen, GitBranch, Monitor, Moon, PanelLeftClose, PanelLeftOpen, Settings2, Sun} from 'lucide-react';

export type ThemeMode = 'light' | 'dark' | 'system';
export function useModuleTheme() {
  const [mode, setMode] = useState<ThemeMode>(() => {
    try { const value = localStorage.getItem('bid-agent.theme-mode'); return value === 'light' || value === 'dark' ? value : 'system'; } catch { return 'system'; }
  });
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setSystemDark(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  const changeTheme = (value: ThemeMode) => {
    setMode(value);
    try { localStorage.setItem('bid-agent.theme-mode', value); } catch { /* Theme still applies without storage. */ }
  };
  return {mode, changeTheme, resolved: mode === 'system' ? (systemDark ? 'dark' : 'light') : mode};
}

export function WorkspaceSidebar({navigation, collapsed, onCollapse, onOpen, onSettings, onHelp, busy, theme, onTheme}: {
  navigation: ReactNode; collapsed: boolean; onCollapse: () => void; onOpen: () => void;
  onSettings: () => void; onHelp: () => void; busy: boolean; theme: ThemeMode; onTheme: (value: ThemeMode) => void;
}) {
  return <aside className={`rail task-rail product-sidebar ${collapsed ? 'is-collapsed' : ''}`} aria-label="图表工作空间">
    <div className="product-brand"><span className="product-brand-icon"><GitBranch size={21}/></span><strong>必得投标<span>图表工作台</span></strong></div>
    <button className="project-entry" disabled={busy} onClick={onOpen} title="打开图表项目"><span className="product-icon-tile"><FolderOpen size={20}/></span><span><strong>图表工作空间</strong><small>打开已保存的项目</small></span><ChevronRight size={15}/></button>
    <div className="sidebar-kicker"><i/>AI 标书工具</div>
    <div className="module-entry"><span className="product-icon-tile"><GitBranch size={19}/></span><span><strong>图表生成</strong><small>流程图 · 甘特图</small></span></div>
    {navigation}
    <div className="rail-bottom">
      <button className="rail-item" disabled={busy} onClick={onSettings} title="模型设置"><Settings2 size={18}/><span>模型设置</span></button>
      <button className="rail-item" onClick={onHelp} title="使用说明"><CircleHelp size={18}/><span>使用说明</span></button>
      <div className="theme-switch" role="group" aria-label="界面主题">{([{value:'light',label:'浅色',Icon:Sun},{value:'dark',label:'深色',Icon:Moon},{value:'system',label:'跟随系统',Icon:Monitor}] as const).map(({value,label,Icon})=><button key={value} aria-label={label} title={label} aria-pressed={theme===value} onClick={()=>onTheme(value)}><Icon size={15}/><span>{label}</span></button>)}</div>
      <button className="icon-button collapse-sidebar" aria-label={collapsed?'展开侧栏':'收起侧栏'} onClick={onCollapse}>{collapsed?<PanelLeftOpen size={18}/>:<PanelLeftClose size={18}/>}</button>
    </div>
  </aside>;
}

export function WorkspaceTabs({value, onChange, versionCount, hasResult, running}: {
  value: 'result' | 'activity' | 'history'; onChange: (value: 'result' | 'activity' | 'history') => void;
  versionCount: number; hasResult: boolean; running: boolean;
}) {
  return <nav className="workspace-tabs" aria-label="图表工作区视图">{([
    {id:'result', label:'生成结果', count:hasResult?1:0},
    {id:'activity', label:'生成过程', count:running?'进行中':undefined},
    {id:'history', label:'版本记录', count:versionCount},
  ] as const).map(tab=><button key={tab.id} type="button" aria-pressed={value===tab.id} className={value===tab.id?'selected':''} onClick={()=>onChange(tab.id)}>{tab.id==='result'?<FolderOpen size={17}/>:tab.id==='activity'?<Monitor size={17}/>:<GitBranch size={17}/>}<span>{tab.label}</span>{tab.count!==undefined&&<small>{tab.count}</small>}</button>)}</nav>;
}

import { RotateCcw } from 'lucide-react';
import { Diagram } from './Diagram';
import type { Snapshot } from './model';

type Props = {
  history: Snapshot[];
  currentRevision: number | null;
  onSelect: (snapshot: Snapshot) => void;
  onRestore: () => void;
};

export function VersionHistory({ history, currentRevision, onSelect, onRestore }: Props) {
  return <>
    <h2>版本记录</h2>
    <p className="muted">点击条目切换查看。完整快照按时间保留。</p>
    {history.length === 0
      ? <p className="empty-history">尚未生成图表。</p>
      : <div className="version-list">
          {[...history].reverse().map(item => <button
            className={`version-card ${currentRevision === item.revision ? 'selected' : ''}`}
            type="button"
            key={item.revision}
            aria-pressed={currentRevision === item.revision}
            onClick={() => onSelect(item)}
          >
            <span className="version-details">
              <span className="version-title"><strong>v{item.revision}</strong>{currentRevision === item.revision && <span className="small-tag">当前查看</span>}</span>
              <span className="version-name">{item.title}</span>
              <span className="version-summary">{item.kind === 'flowchart' ? '流程图' : `甘特图 · ${item.duration} ${{calendar_day:"天",week:"周",month:"月"}[item.version.spec.diagram_type==='gantt'?item.version.spec.time_unit:'calendar_day']}`} · {item.fontSize} 磅</span>
            </span>
            <span className={`version-thumbnail ${item.kind}`} style={{ background: item.appearance.backgroundColor }} aria-hidden="true">
              <Diagram snapshot={item}/>
            </span>
          </button>)}
        </div>}
    <button className="button full" disabled={history.length < 2} onClick={onRestore}><RotateCcw size={15}/>将当前查看恢复为新版本</button>
  </>;
}

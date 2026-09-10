import { CheckCircle2, ChevronDown, ChevronUp, CircleHelp, LoaderCircle, TerminalSquare, XCircle } from 'lucide-react';
import { useEffect, useRef } from 'react';

export type RunStatus = 'idle' | 'running' | 'success' | 'error';
export type RunSource = '程序' | 'LLM' | '渲染器';
export type RunEvent = {
  id: number;
  elapsed: string;
  source: RunSource;
  message: string;
  level?: 'info' | 'success' | 'error';
};

type Props = {
  status: RunStatus;
  events: RunEvent[];
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
};

const statusCopy: Record<RunStatus, string> = {
  idle: '等待生成任务',
  running: '正在生成',
  success: '上次运行完成',
  error: '运行遇到问题',
};

export function RunStream({ status, events, expanded, onExpandedChange }: Props) {
  const latest = events.at(-1);
  const logRef = useRef<HTMLDivElement>(null);
  const StatusIcon = status === 'running' ? LoaderCircle : status === 'success' ? CheckCircle2 : status === 'error' ? XCircle : CircleHelp;
  useEffect(() => {
    if (expanded && logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [events, expanded]);

  return <section className={`run-stream ${expanded ? 'expanded' : ''} ${status}`} aria-label="运行详情">
    <button className="run-stream-summary" type="button" aria-expanded={expanded} aria-controls="run-stream-log" onClick={() => onExpandedChange(!expanded)}>
      <span className="run-stream-state"><StatusIcon size={15} className={status === 'running' ? 'spin' : ''}/><strong>{statusCopy[status]}</strong></span>
      <span className="run-stream-latest" aria-live="polite">{latest?.message ?? '生成时将在这里显示程序、LLM 与渲染器的消息'}</span>
      {latest && <span className="run-stream-time">{latest.elapsed}</span>}
      {expanded ? <ChevronUp size={15}/> : <ChevronDown size={15}/>}
    </button>
    {expanded && <div className="run-stream-body" id="run-stream-log">
      <div className="run-stream-heading"><span><TerminalSquare size={14}/>实时运行日志</span><span>模拟链路 · 未发送数据</span></div>
      <div className="run-stream-events" ref={logRef} role="log" aria-live="polite" aria-relevant="additions">
        {events.length === 0
          ? <div className="run-stream-empty">点击“生成图表草稿”后，通信和渲染过程会逐条显示在这里。</div>
          : events.map(event => <div className={`run-event ${event.level ?? 'info'}`} key={event.id}>
              <time>{event.elapsed}</time><span className={`run-source source-${event.source.toLowerCase()}`}>{event.source}</span><span>{event.message}</span>
            </div>)}
      </div>
    </div>}
  </section>;
}

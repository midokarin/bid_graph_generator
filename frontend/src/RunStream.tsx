import { CheckCircle2, ChevronDown, ChevronUp, CircleHelp, LoaderCircle, TerminalSquare, XCircle } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

export type RunStatus = 'idle' | 'running' | 'success' | 'error' | 'cancelled';
export type RunSource = '程序' | 'LLM' | '渲染器';
export type RunEvent = {
  id: number;
  elapsed: string;
  source: RunSource;
  message: string;
  level?: 'info' | 'success' | 'error';
  details?: unknown;
};

type Props = {
  attempts: Record<number,string>;
  startedAt: number | null;
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
  cancelled: '已取消运行',
};

function JsonOutput({ text }: { text: string }) {
  const formatted = useMemo(() => {
    try { return JSON.stringify(JSON.parse(text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')), null, 2); }
    catch { return text; }
  }, [text]);
  return <pre className="json-stream" tabIndex={0}>{formatted || '等待模型返回内容…'}</pre>;
}

export function RunStream({ status, events, expanded, onExpandedChange, attempts, startedAt }: Props) {
  const latest = events.at(-1);
  const [now, setNow] = useState(Date.now());
  const followLog = useRef(true);
  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (status !== 'running') return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(timer);
  }, [status, startedAt]);
  useEffect(() => { followLog.current = true; }, [startedAt, expanded]);
  const StatusIcon = status === 'running' ? LoaderCircle : status === 'success' ? CheckCircle2 : status === 'error' ? XCircle : CircleHelp;
  useEffect(() => {
    if (expanded && followLog.current && logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [events, expanded]);
  const elapsed = status === 'running' && startedAt !== null ? `${(Math.max(0, now - startedAt) / 1000).toFixed(1)}s` : latest?.elapsed;

  return <section className={`run-stream ${expanded ? 'expanded' : ''} ${status}`} aria-label="运行详情">
    <button className="run-stream-summary" type="button" aria-expanded={expanded} aria-controls="run-stream-log" onClick={() => onExpandedChange(!expanded)}>
      <span className="run-stream-state"><StatusIcon size={15} className={status === 'running' ? 'spin' : ''}/><strong>{statusCopy[status]}</strong></span>
      <span className="run-stream-latest" aria-live="polite">{latest?.message ?? '生成时将在这里显示程序、LLM 与渲染器的消息'}</span>
      <span className="run-stream-time">{elapsed}</span>
      {expanded ? <ChevronUp size={15}/> : <ChevronDown size={15}/>}
    </button>
    {expanded && <div className="run-stream-body" id="run-stream-log">
      <div className="run-stream-heading"><span><TerminalSquare size={14}/>实时运行日志</span><span>按实际进度更新 · JSON 可展开查看</span></div>
      <div className="run-stream-events" ref={logRef} role="log" aria-live="polite" aria-relevant="additions" onScroll={event => {
        const element = event.currentTarget;
        followLog.current = element.scrollHeight - element.scrollTop - element.clientHeight < 24;
      }}>
        {events.length === 0
          ? <div className="run-stream-empty">点击“生成图表草稿”后，通信和渲染过程会逐条显示在这里。</div>
          : events.map(event => <div className={`run-event ${event.level ?? 'info'}`} key={event.id}>
              <time>{event.elapsed}</time><span className={`run-source source-${event.source.toLowerCase()}`}>{event.source}</span><div className="run-event-message">{event.message}{event.details != null && <details className="run-error-details"><summary>查看技术详情</summary><JsonOutput text={JSON.stringify(event.details)}/></details>}</div>
            </div>)}
      </div>
      {Object.keys(attempts).length > 0 && <div className="run-json-outputs">
        {Object.entries(attempts).map(([attempt,text])=><details className="run-json-output" key={`${startedAt}-${attempt}`}><summary><ChevronDown size={14}/><span>{attempt==='0'?'首次生成 JSON':`第 ${attempt} 次修复 JSON`}</span><span className="run-json-meta">{text.length.toLocaleString()} 字符 · 展开查看</span></summary><JsonOutput text={text}/></details>)}
      </div>}
    </div>}
  </section>;
}

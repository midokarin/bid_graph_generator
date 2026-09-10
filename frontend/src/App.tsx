import { useEffect, useState } from 'react';
import { getHealth } from './api/client';

export function App() {
  const [status, setStatus] = useState('正在连接本地后端…');
  useEffect(() => {
    const controller = new AbortController();
    getHealth(controller.signal)
      .then(health => setStatus(`后端已连接 · ${health.provider === 'stub' ? '替身模型' : 'OpenAI 兼容接口'} · 契约 ${health.contract_version}`))
      .catch(() => { if (!controller.signal.aborted) setStatus('后端未连接，请先启动本地生成服务。'); });
    return () => controller.abort();
  }, []);
  return <main>
    <span className="badge">P0 · 会话一</span>
    <h1>标绘正式工程</h1>
    <p>流程图与甘特图的生成后端、严格数据契约已建立。</p>
    <section aria-label="服务状态"><h2>本地服务</h2><p role="status">{status}</p><a href="/api/v1/docs" target="_blank" rel="noreferrer">打开生成 API 文档</a></section>
    <p className="muted">本页为启动入口。图表工作台、布局与编辑将在下一会话接入。</p>
  </main>;
}

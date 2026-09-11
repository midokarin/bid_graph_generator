import type { GenerationRequest } from '../domain/generated/GenerationRequest';

async function read<T>(response: Response): Promise<T> {
  if (!response.ok) {
    if (response.status === 422) {
      const body = await response.json().catch(() => null);
      const issues: {loc?: unknown; type?: unknown}[] = Array.isArray(body?.detail)
        ? body.detail.filter((item: unknown) => item !== null && typeof item === 'object') : [];
      const field = (issue: typeof issues[number], name: string) => Array.isArray(issue.loc) && issue.loc.includes(name);
      if (issues.some(issue => field(issue, 'flow_variant') && issue.type === 'extra_forbidden')) {
        throw new Error('后端仍在运行旧版本，尚不支持多方案生成。请重启后端服务，再点击生成。');
      }
      if (issues.some(issue => field(issue, 'source_text'))) {
        throw new Error('业务内容未通过校验，请检查是否为空或超过长度限制后重试。');
      }
      throw new Error('生成请求未通过校验，请检查输入参数；更新程序后请重启后端并刷新页面。');
    }
    throw new Error(`本地服务返回 ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export const getHealth = (signal?: AbortSignal) => fetch('/api/v1/health', { signal }).then(response => read<{status: string; provider: string; contract_version: string}>(response));
export const createGeneration = (body: GenerationRequest) => fetch('/api/v1/generations', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
}).then(response => read<{job_id: string; state: string; events_url: string}>(response));
export const cancelGeneration = (jobId: string) => fetch(`/api/v1/generations/${encodeURIComponent(jobId)}`, { method: 'DELETE' }).then(response => read<{job_id: string; state: string}>(response));

export type StreamMessage={event:string;data:any};
export function consumeGeneration(url:string,onMessage:(message:StreamMessage)=>void,signal:AbortSignal):Promise<void>{
 return new Promise((resolve,reject)=>{
  const source=new EventSource(url);let lastId=0;
  const close=()=>{source.close();signal.removeEventListener('abort',abort)};
  const abort=()=>{close();reject(new DOMException('已取消','AbortError'))};
  signal.addEventListener('abort',abort,{once:true});
  if(signal.aborted){abort();return;}
  for(const event of ['status','delta','schedule','result','validation_error','error'])source.addEventListener(event,raw=>{
   if(!(raw instanceof MessageEvent))return;
   try{
    const id=Number(raw.lastEventId);if(id<=lastId)return;lastId=id;
    const data=JSON.parse(raw.data);onMessage({event,data});
    if(event==='status'&&['completed','failed','cancelled'].includes(data.state)){close();data.state==='completed'?resolve():reject(new Error(data.state==='cancelled'?'已取消生成':'生成失败，请展开详情。'))}
   }catch(error){close();reject(error)}
  });
  source.onerror=()=>{if(source.readyState===EventSource.CLOSED){close();reject(new Error('事件连接关闭，请重试。'))}};
 });
}

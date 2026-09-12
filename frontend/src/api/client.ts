import type { GenerationRequest } from '../domain/generated/GenerationRequest';

async function read<T>(response: Response, settings = false): Promise<T> {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status >= 500) {
      throw new Error(`本地服务暂不可用（${response.status}）。请确认后端已启动，或在项目目录运行 npm start 同时启动前后端；使用自定义端口时，两端的 BIAOSHU_API_PORT 必须一致。`);
    }
    if (settings) {
      throw new Error(typeof body?.detail === 'string' ? body.detail : '配置未保存，请检查接口地址、模型名和密钥后重试。');
    }
    if (response.status === 422) {
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
  if (body === null || typeof body !== 'object') {
    throw new Error('本地服务返回了空内容或无效数据，请确认前后端端口配置一致，重启程序后重试。');
  }
  return body as T;
}

export type ModelConfiguration = {base_url: string; model: string; has_api_key: boolean};
export const getModelSettings = () => fetch('/api/v1/settings').then(response => read<ModelConfiguration>(response, true));
export const saveModelSettings = (body: {base_url: string; model: string; api_key: string}) => fetch('/api/v1/settings', {
  method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body),
}).then(response => read<ModelConfiguration>(response, true));

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

/** Per-module service boundary; hosts may supply their authenticated transport. */
export const standaloneGeneration={getHealth,createGeneration,cancelGeneration,consumeGeneration};
export type GenerationAdapter=typeof standaloneGeneration;

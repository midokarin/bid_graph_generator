import type { GenerationRequest } from '../domain/generated/GenerationRequest';

async function read<T>(response: Response): Promise<T> {
  if (!response.ok) throw new Error(`本地服务返回 ${response.status}`);
  return response.json() as Promise<T>;
}

export const getHealth = (signal?: AbortSignal) => fetch('/api/v1/health', { signal }).then(response => read<{status: string; provider: string; contract_version: string}>(response));
export const createGeneration = (body: GenerationRequest) => fetch('/api/v1/generations', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
}).then(response => read<{job_id: string; state: string; events_url: string}>(response));
export const cancelGeneration = (jobId: string) => fetch(`/api/v1/generations/${encodeURIComponent(jobId)}`, { method: 'DELETE' }).then(response => read<{job_id: string; state: string}>(response));
// EventSource integration and workbench feedback intentionally belong to session two.

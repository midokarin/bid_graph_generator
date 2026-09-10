import { defineConfig } from 'vite';

function port(value: string | undefined, fallback: number): number {
  const result = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(result) || result < 1 || result > 65535) throw new Error('Invalid local service port');
  return result;
}

export default defineConfig({
  server: {
    host: '127.0.0.1',
    port: port(process.env.BIAOSHU_WEB_PORT, 5173),
    strictPort: true,
    proxy: { '/api': { target: `http://127.0.0.1:${port(process.env.BIAOSHU_API_PORT, 8000)}`, timeout: 0, proxyTimeout: 0 } },
  },
});

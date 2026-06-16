import type { IncomingMessage, ServerResponse } from 'http';

interface VercelRequest extends IncomingMessage {
  query: Record<string, string | string[]>;
  cookies: Record<string, string>;
  body: any;
}
interface VercelResponse extends ServerResponse {
  status(code: number): VercelResponse;
  json(data: any): VercelResponse;
}

function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error('Redis not configured');
  async function exec<T = unknown>(...args: (string | number)[]): Promise<T> {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    if (!res.ok) throw new Error(`Redis error ${res.status}`);
    const json = await res.json();
    if (json.error) throw new Error(json.error);
    return json.result as T;
  }
  return {
    get: <T = unknown>(key: string) => exec<T | null>('GET', key),
    set: (key: string, value: unknown, opts?: { ex?: number }) => {
      const args: (string | number)[] = ['SET', key, typeof value === 'string' ? value : JSON.stringify(value)];
      if (opts?.ex) args.push('EX', opts.ex);
      return exec(...args);
    },
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    const { events } = req.body as any;
    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ error: 'Missing or empty events array' });
    }
    const redis = getRedis();
    const resultados: { id: string; status: string }[] = [];
    for (const event of events) {
      const already = await redis.get(`processed:${event.idempotencyKey}`);
      if (already) { resultados.push({ id: event.id, status: 'already_processed' }); continue; }
      try {
        await redis.set(`processed:${event.idempotencyKey}`, true, { ex: 86400 * 30 });
        await redis.set(`event:${event.id}`, { ...event, processedAt: new Date().toISOString() });
        resultados.push({ id: event.id, status: 'processed' });
      } catch {
        resultados.push({ id: event.id, status: 'error' });
      }
    }
    return res.status(200).json({ results: resultados });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('sync-events error:', msg);
    return res.status(500).json({ error: 'Erro interno no servidor.', detail: msg });
  }
}

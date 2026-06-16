import { z } from 'zod';

interface ApiRequest {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body: any;
}

interface ApiResponse {
  status(code: number): ApiResponse;
  json(data: any): ApiResponse;
  setHeader(name: string, value: string): void;
}

function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error('Redis não configurado');
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

const buckets = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(key: string) {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    const fresh = { count: 1, resetAt: now + 60_000 };
    buckets.set(key, fresh);
    return { allowed: true, remaining: 9, resetAt: fresh.resetAt };
  }
  if (bucket.count >= 10) return { allowed: false, remaining: 0, resetAt: bucket.resetAt };
  bucket.count++;
  return { allowed: true, remaining: 10 - bucket.count, resetAt: bucket.resetAt };
}

const SyncEventSchema = z.object({
  id: z.string().min(1).max(128),
  type: z.enum(['care_registered', 'care_deleted', 'reminder_created', 'reminder_deleted']),
  payload: z.record(z.string(), z.unknown()),
  idempotencyKey: z.string().min(1).max(256)
});
const SyncEventsInputSchema = z.object({
  events: z.array(SyncEventSchema).min(1).max(100)
});

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    const redis = getRedis();
    const forwarded = req.headers['x-forwarded-for'];
    const ip = Array.isArray(forwarded) ? forwarded[0] : (forwarded?.split(',')[0] ?? 'unknown');
    const limit = checkRateLimit(`sync:${ip}`);
    res.setHeader('X-RateLimit-Remaining', String(limit.remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.floor(limit.resetAt / 1000)));
    if (!limit.allowed) return res.status(429).json({ error: 'Muitas requisições. Tente novamente em breve.' });
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

    const parsed = SyncEventsInputSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Dados inválidos', details: parsed.error });

    const { events } = parsed.data;
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

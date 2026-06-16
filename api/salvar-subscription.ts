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
    del: (key: string) => exec('DEL', key),
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

const PushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(2048),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: z.string().min(1).max(512),
    auth: z.string().min(1).max(64)
  })
});
const SalvarSubscriptionInputSchema = z.object({
  tipo: z.enum(['rega', 'sol', 'adubo']),
  subscription: PushSubscriptionSchema,
  timestamp: z.string().datetime(),
  dataDisparoCustom: z.string().datetime().optional()
}).refine(
  (data) => {
    if (!data.dataDisparoCustom) return true;
    const custom = new Date(data.dataDisparoCustom);
    const now = new Date();
    const oneYearFromNow = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    return custom > now && custom < oneYearFromNow;
  },
  { message: 'dataDisparoCustom deve estar entre agora e 1 ano no futuro' }
);

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const redis = getRedis();
  const forwarded = req.headers['x-forwarded-for'];
  const ip = Array.isArray(forwarded) ? forwarded[0] : (forwarded?.split(',')[0] ?? 'unknown');
  const limit = checkRateLimit(`salvar:${ip}`);
  res.setHeader('X-RateLimit-Remaining', String(limit.remaining));
  res.setHeader('X-RateLimit-Reset', String(Math.floor(limit.resetAt / 1000)));
  if (!limit.allowed) return res.status(429).json({ error: 'Muitas requisições. Tente novamente em breve.' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  const parsed = SalvarSubscriptionInputSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Dados inválidos', details: parsed.error });
  const { tipo, subscription, timestamp, dataDisparoCustom } = parsed.data;

  const diasAcrescimo = tipo === 'adubo' ? 15 : tipo === 'rega' ? 2 : 1;
  const dataProxima = dataDisparoCustom
    ? new Date(dataDisparoCustom)
    : (() => {
        const d = new Date(timestamp);
        d.setDate(d.getDate() + diasAcrescimo);
        d.setHours(8, 0, 0, 0);
        return d;
      })();

  const idUsuario = Buffer.from(subscription.endpoint).toString('base64').substring(0, 30);
  await redis.set(`lembrete:${idUsuario}:${tipo}`, {
    tipo,
    subscription,
    dataDisparo: dataProxima.toISOString(),
    processado: false
  });

  return res.status(200).json({ success: true, agendadoPara: dataProxima });
}

import { z } from 'zod';

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

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
  const url = (process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL) as string;
  const token = (process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN) as string;
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
    get: <T = unknown>(key: string) => exec<string | null>('GET', key).then(v => v ? (JSON.parse(v) as T) : null),
    set: (key: string, value: unknown, opts?: { ex?: number }) => {
      const args: (string | number)[] = ['SET', key, typeof value === 'string' ? value : JSON.stringify(value)];
      if (opts?.ex) args.push('EX', opts.ex);
      return exec(...args);
    },
    del: (key: string) => exec('DEL', key),
    incr: (key: string) => exec<number>('INCR', key),
    expire: (key: string, seconds: number) => exec<number>('EXPIRE', key, seconds),
  };
}

async function rateLimit(redis: ReturnType<typeof getRedis>, key: string, limit = 10, windowSec = 60) {
  const current = await redis.incr(`ratelimit:${key}`);
  if (current === 1) await redis.expire(`ratelimit:${key}`, windowSec);
  return { allowed: current <= limit, remaining: Math.max(0, limit - current) };
}

function getClientIp(req: ApiRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  return Array.isArray(forwarded) ? forwarded[0] : (forwarded?.split(',')[0] ?? 'unknown');
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
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

    const apiKey = req.headers['x-api-key'];
    if (!apiKey || !safeCompare(String(apiKey), process.env.VITE_SYNC_API_KEY ?? '')) {
      return res.status(401).json({ error: 'Não autorizado' });
    }

    const redis = getRedis();

    const limit = await rateLimit(redis, `salvar:${getClientIp(req)}`);
    res.setHeader('X-RateLimit-Remaining', String(limit.remaining));
    if (!limit.allowed) return res.status(429).json({ error: 'Muitas requisições. Tente novamente em breve.' });

    const parsed = SalvarSubscriptionInputSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Dados inválidos' });
    const { tipo, subscription, timestamp, dataDisparoCustom } = parsed.data;

    const diasAcrescimo = tipo === 'adubo' ? 15 : tipo === 'rega' ? 2 : 1;
    const dataProxima = dataDisparoCustom
      ? new Date(dataDisparoCustom)
      : (() => {
          const d = new Date(timestamp);
          d.setDate(d.getDate() + diasAcrescimo);
          d.setUTCHours(11, 0, 0, 0);
          return d;
        })();

    const idUsuario = Buffer.from(subscription.endpoint).toString('base64').substring(0, 30);
    await redis.set(`lembrete:${idUsuario}:${tipo}`, {
      tipo,
      subscription,
      dataDisparo: dataProxima.toISOString(),
      processado: false
    });

    await redis.set(`subscription:${idUsuario}`, {
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      atualizadoEm: new Date().toISOString()
    });

    return res.status(200).json({ success: true, agendadoPara: dataProxima });
  } catch (error) {
    console.error('salvar-subscription error:', error instanceof Error ? error.message : error);
    return res.status(500).json({ error: 'Erro interno no servidor.' });
  }
}

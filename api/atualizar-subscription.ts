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
    set: (key: string, value: unknown) => exec('SET', key, typeof value === 'string' ? value : JSON.stringify(value)),
    keys: (pattern: string) => exec<string[]>('KEYS', pattern),
  };
}

const PushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(2048),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: z.string().min(1).max(512),
    auth: z.string().min(1).max(64)
  })
});

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

    const apiKey = req.headers['x-api-key'];
    if (!apiKey || !safeCompare(String(apiKey), process.env.VITE_SYNC_API_KEY ?? '')) {
      return res.status(401).json({ error: 'Não autorizado' });
    }

    const parsed = PushSubscriptionSchema.safeParse(req.body?.subscription);
    if (!parsed.success) return res.status(400).json({ error: 'Subscription inválida' });
    const subscription = parsed.data;

    const redis = getRedis();
    const idUsuario = Buffer.from(subscription.endpoint).toString('base64').substring(0, 30);

    const key = `subscription:${idUsuario}`;
    await redis.set(key, {
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      atualizadoEm: new Date().toISOString()
    });

    const chaves = await redis.keys(`lembrete:${idUsuario}:*`);
    let atualizados = 0;
    for (const chave of chaves) {
      const lembrete = await redis.get<{ tipo: string; subscription: any; dataDisparo: string; processado: boolean }>(chave);
      if (!lembrete) continue;
      lembrete.subscription = { endpoint: subscription.endpoint, keys: subscription.keys };
      await redis.set(chave, lembrete);
      atualizados++;
    }

    return res.status(200).json({ success: true, atualizados });
  } catch (error) {
    console.error('atualizar-subscription error:', error instanceof Error ? error.message : error);
    return res.status(500).json({ error: 'Erro interno no servidor.' });
  }
}

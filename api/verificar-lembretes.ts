import webpush from 'web-push';

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
  const rawUrl = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const rawToken = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!rawUrl || !rawToken) throw new Error('Redis não configurado');
  const url = rawUrl;
  const token = rawToken;
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
    keys: (pattern: string) => exec<string[]>('KEYS', pattern),
  };
}

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? process.env.VITE_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails('mailto:contato@girassol.app', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

interface LembreteKV {
  tipo: string;
  subscription: webpush.PushSubscription;
  dataDisparo: string;
  processado: boolean;
}

function isTransientError(statusCode?: number): boolean {
  if (!statusCode) return true;
  return statusCode === 408 || statusCode === 429 || (statusCode >= 500 && statusCode < 600);
}

function isPermanentError(statusCode?: number): boolean {
  if (!statusCode) return false;
  return statusCode === 404 || statusCode === 410;
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'Não autorizado' });
    }

    const redis = getRedis();
    const chaves = await redis.keys('lembrete:*');
    const agora = new Date();

    const mensagens: Record<string, string> = {
      rega: '💧 Hora de regar o seu Girassol para mantê-lo radiante!',
      sol: '☀️ O dia começou! Que tal colocar o Girassol para tomar 6h de sol?',
      adubo: '🌱 Dia de nutrição! Hora de colocar o fertilizante no seu Girassol.'
    };

    let enviados = 0;
    let apagados = 0;
    let erros = 0;

    for (const chave of chaves) {
      const lembrete = await redis.get<LembreteKV>(chave);
      if (!lembrete || lembrete.processado) continue;

      const dataDisparo = new Date(lembrete.dataDisparo);
      if (agora < dataDisparo) continue;

      try {
        await webpush.sendNotification(
          lembrete.subscription,
          JSON.stringify({
            title: '🌻 Meu Girassol',
            body: mensagens[lembrete.tipo] || 'Seu girassol precisa de você!'
          })
        );
        enviados++;

        if (lembrete.tipo === 'sol') {
          const amanha = new Date();
          amanha.setDate(amanha.getDate() + 1);
          amanha.setHours(8, 0, 0, 0);
          lembrete.dataDisparo = amanha.toISOString();
          await redis.set(chave, lembrete);
        } else {
          await redis.del(chave);
          apagados++;
        }
      } catch (error) {
        const statusCode = (error as any)?.statusCode;
        erros++;

        if (isPermanentError(statusCode)) {
          console.warn(`[verificar-lembretes] subscription morta (${statusCode}), removendo chave`);
          await redis.del(chave);
          apagados++;
        } else if (isTransientError(statusCode)) {
          console.warn(`[verificar-lembretes] erro transitório (${statusCode})`);
        } else {
          console.error(`[verificar-lembretes] erro desconhecido:`, error);
        }
      }
    }

    return res.status(200).json({
      totalVerificados: chaves.length,
      enviados,
      apagados,
      erros
    });
  } catch (error) {
    console.error('verificar-lembretes error:', error instanceof Error ? error.message : error);
    return res.status(500).json({ error: 'Erro interno no servidor.' });
  }
}

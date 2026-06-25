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
    scan: async (pattern: string): Promise<string[]> => {
      const allKeys: string[] = [];
      let cursor = '0';
      do {
        const result = await exec<[string, string[]]>('SCAN', Number(cursor), 'MATCH', pattern, 'COUNT', 100);
        cursor = result[0];
        allKeys.push(...result[1]);
      } while (cursor !== '0');
      return allKeys;
    },
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
  if (!statusCode) return false;
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
    const chaves = await redis.scan('lembrete:*');
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
      if (!lembrete) continue;

      const dataDisparo = new Date(lembrete.dataDisparo);
      if (agora < dataDisparo) continue;

      const idUsuario = chave.split(':')[1];
      const subAtual = await redis.get<{ endpoint: string; keys: any }>(`subscription:${idUsuario}`);
      const subscriptionToSend = subAtual
        ? { endpoint: subAtual.endpoint, keys: subAtual.keys }
        : lembrete.subscription;

      try {
        await webpush.sendNotification(
          subscriptionToSend,
          JSON.stringify({
            title: '🌻 Meu Girassol',
            body: mensagens[lembrete.tipo] || 'Seu girassol precisa de você!'
          })
        );
        enviados++;

        if (subAtual) {
          lembrete.subscription = { endpoint: subAtual.endpoint, keys: subAtual.keys } as webpush.PushSubscription;
        }
        const diasAcrescimo = lembrete.tipo === 'adubo' ? 15 : lembrete.tipo === 'rega' ? 2 : 1;
        const proximoDisparo = new Date();
        proximoDisparo.setDate(proximoDisparo.getDate() + diasAcrescimo);
        proximoDisparo.setUTCHours(11, 0, 0, 0);
        lembrete.dataDisparo = proximoDisparo.toISOString();
        await redis.set(chave, lembrete);
      } catch (error) {
        const statusCode = (error as any)?.statusCode;
        const errMsg = (error as any)?.message || String(error);
        erros++;
        console.error(`[verificar-lembretes] falha (${lembrete.tipo}):`, errMsg);

        if (isPermanentError(statusCode)) {
          console.warn(`[verificar-lembretes] subscription morta (${statusCode}), removendo chave`);
          await redis.del(chave);
          apagados++;
        } else if (isTransientError(statusCode)) {
          console.warn(`[verificar-lembretes] erro transitório (${statusCode}), manter subscription`);
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

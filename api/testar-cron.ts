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

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
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
    del: (key: string) => exec('DEL', key),
    keys: (pattern: string) => exec<string[]>('KEYS', pattern),
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

function isPermanentError(statusCode?: number): boolean {
  if (!statusCode) return false;
  return statusCode === 404 || statusCode === 410;
}

function isTransientError(statusCode?: number): boolean {
  if (!statusCode) return false;
  return statusCode === 408 || statusCode === 429 || (statusCode >= 500 && statusCode < 600);
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    const cronSecretConfigurado = !!process.env.CRON_SECRET;

    if (req.method === 'GET') {
      const urlRedis = !!(process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL);
      const vapidOk = !!(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
      const apiKeyOk = !!process.env.VITE_SYNC_API_KEY;

      return res.status(200).json({
        cronSecretConfigurado,
        vapidOk,
        redisOk: urlRedis,
        apiKeyOk,
        cronSchedule: '0 11 * * * (11:00 UTC diário)'
      });
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

    const { secret } = req.body || {};
    if (!secret || !safeCompare(String(secret), process.env.CRON_SECRET ?? '')) {
      return res.status(401).json({ error: 'CRON_SECRET inválido', cronSecretConfigurado });
    }

    if (!VAPID_PRIVATE_KEY) {
      return res.status(500).json({ error: 'VAPID_PRIVATE_KEY não configurada' });
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
    const detalhes: string[] = [];

    for (const chave of chaves) {
      const lembrete = await redis.get<{ tipo: string; subscription: any; dataDisparo: string }>(chave);
      if (!lembrete) {
        detalhes.push(`${chave}: sem dados`);
        continue;
      }

      const dataDisparo = new Date(lembrete.dataDisparo);
      if (agora < dataDisparo) {
        detalhes.push(`${chave}: agendado para ${lembrete.dataDisparo} (ainda não chegou)`);
        continue;
      }

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
        detalhes.push(`${chave}: ENVIADO ✅`);

        const diasAcrescimo = lembrete.tipo === 'adubo' ? 15 : lembrete.tipo === 'rega' ? 2 : 1;
        const proximoDisparo = new Date();
        proximoDisparo.setDate(proximoDisparo.getDate() + diasAcrescimo);
        proximoDisparo.setUTCHours(11, 0, 0, 0);
        lembrete.dataDisparo = proximoDisparo.toISOString();
        if (subAtual) {
          lembrete.subscription = { endpoint: subAtual.endpoint, keys: subAtual.keys };
        }
        await redis.set(chave, lembrete);
      } catch (error: any) {
        const statusCode = error?.statusCode;
        erros++;
        detalhes.push(`${chave}: ERRO ${statusCode || 'desconhecido'} - ${error?.message?.substring(0, 80)}`);

        if (isPermanentError(statusCode)) {
          await redis.del(chave);
          apagados++;
        }
      }
    }

    return res.status(200).json({
      totalVerificados: chaves.length,
      enviados,
      apagados,
      erros,
      detalhes
    });
  } catch (error) {
    console.error('testar-cron error:', error instanceof Error ? error.message : error);
    return res.status(500).json({ error: 'Erro interno no servidor.' });
  }
}

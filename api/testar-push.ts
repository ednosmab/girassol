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

async function handleAgendar(body: any, res: ApiResponse) {
  const { subscription, tipo, timestamp, dataDisparoCustom } = body;

  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return res.status(400).json({ error: 'Subscription inválida' });
  }

  if (!tipo || !['rega', 'sol', 'adubo'].includes(tipo)) {
    return res.status(400).json({ error: 'Tipo inválido' });
  }

  const redis = getRedis();

  const diasAcrescimo = tipo === 'adubo' ? 15 : tipo === 'rega' ? 2 : 1;
  const dataProxima = dataDisparoCustom
    ? new Date(dataDisparoCustom)
    : (() => {
        const d = new Date(timestamp || new Date().toISOString());
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

  return res.status(200).json({ success: true, agendadoPara: dataProxima.toISOString() });
}

async function handleDisparar(res: ApiResponse) {
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
  const erros: string[] = [];

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
      erros.push(`${lembrete.tipo}: ${errMsg}`);

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
    erros
  });
}

async function handleListar(res: ApiResponse) {
  const redis = getRedis();
  const chaves = await redis.scan('lembrete:*');
  const itens: { tipo: string; dataDisparo: string; processado: boolean }[] = [];

  for (const chave of chaves) {
    const lembrete = await redis.get<LembreteKV>(chave);
    if (lembrete) {
      itens.push({
        tipo: lembrete.tipo,
        dataDisparo: lembrete.dataDisparo,
        processado: lembrete.processado
      });
    }
  }

  return res.status(200).json({ total: itens.length, itens });
}

async function handlePushImmediate(subscription: any, tipo: string, res: ApiResponse) {
  const mensagens: Record<string, string> = {
    rega: 'Teste Rega: Hora de regar o seu Girassol!',
    sol: 'Teste Sol: Que tal colocar o Girassol para tomar sol?',
    adubo: 'Teste Adubo: Dia de fertilizar o seu Girassol!'
  };

  const titulo = 'Teste Girassol';
  const body = mensagens[tipo] || 'Push de teste do Girassol!';

  try {
    await webpush.sendNotification(
      subscription,
      JSON.stringify({ title: titulo, body })
    );
    return res.status(200).json({ success: true, enviado: true });
  } catch (error: any) {
    const statusCode = error?.statusCode;
    const errMsg = error?.message || String(error);
    return res.status(200).json({ success: false, enviado: false, statusCode, error: errMsg });
  }
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  const apiKey = req.headers['x-api-key'];
  if (!apiKey || !safeCompare(String(apiKey), process.env.VITE_SYNC_API_KEY ?? '')) {
    return res.status(401).json({ error: 'Não autorizado' });
  }

  const { action, tipo, subscription, timestamp, dataDisparoCustom } = req.body || {};

  try {
    switch (action) {
      case 'agendar':
        return await handleAgendar({ subscription, tipo, timestamp, dataDisparoCustom }, res);
      case 'disparar':
        return await handleDisparar(res);
      case 'listar':
        return await handleListar(res);
      default:
        if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
          return res.status(400).json({ error: 'Subscription inválida' });
        }
        return await handlePushImmediate(subscription, tipo, res);
    }
  } catch (error) {
    console.error('testar-push error:', error instanceof Error ? error.message : error);
    return res.status(500).json({ error: 'Erro interno no servidor.' });
  }
}

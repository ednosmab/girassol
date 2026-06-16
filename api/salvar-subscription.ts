import { getRedis } from './shared/redis-client';
import type { VercelRequest, VercelResponse } from './shared/types';
import { SalvarSubscriptionInputSchema, parseOrReject } from './shared/validation';
import { checkRateLimit } from './shared/rate-limit';

function getClientKey(req: VercelRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = Array.isArray(forwarded) ? forwarded[0] : (forwarded?.split(',')[0] ?? 'unknown');
  return `salvar:${ip}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const redis = getRedis();
  // Rate limit (sempre, independente de método)
  const limit = checkRateLimit(getClientKey(req));
  res.setHeader('X-RateLimit-Remaining', String(limit.remaining));
  res.setHeader('X-RateLimit-Reset', String(Math.floor(limit.resetAt / 1000)));
  if (!limit.allowed) {
    return res.status(429).json({ error: 'Muitas requisições. Tente novamente em breve.' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const parsed = parseOrReject(SalvarSubscriptionInputSchema, req.body);
  if (!parsed.ok) {
    return res.status(400).json(parsed.response);
  }
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

  const dadosLembrete = {
    tipo,
    subscription,
    dataDisparo: dataProxima.toISOString(),
    processado: false
  };

  await redis.set(`lembrete:${idUsuario}:${tipo}`, dadosLembrete);

  return res.status(200).json({ success: true, agendadoPara: dataProxima });
}

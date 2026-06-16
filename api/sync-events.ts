import { getRedis } from './_shared/redis-client';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { SyncEventsInputSchema, parseOrReject } from './_shared/validation';
import { checkRateLimit } from './_shared/rate-limit';

function getClientKey(req: VercelRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = Array.isArray(forwarded) ? forwarded[0] : (forwarded?.split(',')[0] ?? 'unknown');
  return `sync:${ip}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const redis = getRedis();
  const limit = checkRateLimit(getClientKey(req));
  res.setHeader('X-RateLimit-Remaining', String(limit.remaining));
  res.setHeader('X-RateLimit-Reset', String(Math.floor(limit.resetAt / 1000)));
  if (!limit.allowed) {
    return res.status(429).json({ error: 'Muitas requisições. Tente novamente em breve.' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const parsed = parseOrReject(SyncEventsInputSchema, req.body);
  if (!parsed.ok) {
    return res.status(400).json(parsed.response);
  }
  const { events } = parsed.data;

  const resultados: { id: string; status: string }[] = [];

  for (const event of events) {
    const alreadyProcessed = await redis.get(`processed:${event.idempotencyKey}`);
    if (alreadyProcessed) {
      resultados.push({ id: event.id, status: 'already_processed' });
      continue;
    }

    try {
      await redis.set(`processed:${event.idempotencyKey}`, true, { ex: 86400 * 30 });

      const key = `event:${event.id}`;
      await redis.set(key, {
        ...event,
        processedAt: new Date().toISOString()
      });

      resultados.push({ id: event.id, status: 'processed' });
    } catch (error) {
      resultados.push({ id: event.id, status: 'error' });
    }
  }

  return res.status(200).json({ results: resultados });
}

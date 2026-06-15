import { kv } from '@vercel/kv';
import type { VercelRequest, VercelResponse } from '@vercel/node';

interface SyncEvent {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  idempotencyKey: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { events } = req.body as { events: SyncEvent[] };

  if (!events || !Array.isArray(events) || events.length === 0) {
    return res.status(400).json({ error: 'Events array required' });
  }

  const resultados: { id: string; status: string }[] = [];

  for (const event of events) {
    if (!event.id || !event.type || !event.idempotencyKey) {
      resultados.push({ id: event.id || 'unknown', status: 'error' });
      continue;
    }

    const alreadyProcessed = await kv.get(`processed:${event.idempotencyKey}`);
    if (alreadyProcessed) {
      resultados.push({ id: event.id, status: 'already_processed' });
      continue;
    }

    try {
      await kv.set(`processed:${event.idempotencyKey}`, true, { ex: 86400 * 30 });

      const key = `event:${event.id}`;
      await kv.set(key, {
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

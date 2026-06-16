import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getRedis } from './_shared/redis-client';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const redis = getRedis();
    return res.status(200).json({ ok: true, redis: 'connected' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || String(error) });
  }
}

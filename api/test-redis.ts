import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { getRedis } = require('./_shared/redis-client');
    const redis = getRedis();
    return res.status(200).json({ ok: true, redis: 'connected' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || String(error) });
  }
}

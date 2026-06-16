import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkRateLimit } from './_shared/rate-limit';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const limit = checkRateLimit('test');
    return res.status(200).json({ ok: true, limit });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || String(error) });
  }
}

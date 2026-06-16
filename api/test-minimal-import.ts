import type { VercelRequest, VercelResponse } from './shared/types';
import { checkRateLimit } from './shared/rate-limit';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return res.status(200).json({ ok: true, message: 'minimal import test' });
}

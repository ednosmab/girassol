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

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? process.env.VITE_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails('mailto:contato@girassol.app', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  const apiKey = req.headers['x-api-key'];
  if (!apiKey || !safeCompare(String(apiKey), process.env.VITE_SYNC_API_KEY ?? '')) {
    return res.status(401).json({ error: 'Não autorizado' });
  }

  const { subscription, tipo } = req.body || {};

  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return res.status(400).json({ error: 'Subscription inválida' });
  }

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

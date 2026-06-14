import { kv } from '@vercel/kv';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { tipo, subscription, timestamp } = req.body;

  if (!tipo || !subscription) {
    return res.status(400).json({ error: 'Dados incompletos' });
  }

  const diasAcrescimo = tipo === 'adubo' ? 15 : tipo === 'rega' ? 2 : 1;

  const dataProxima = new Date(timestamp);
  dataProxima.setDate(dataProxima.getDate() + diasAcrescimo);
  dataProxima.setHours(8, 0, 0, 0);

  const idUsuario = Buffer.from(subscription.endpoint).toString('base64').substring(0, 30);

  const dadosLembrete = {
    tipo,
    subscription,
    dataDisparo: dataProxima.toISOString(),
    processado: false
  };

  await kv.set(`lembrete:${idUsuario}:${tipo}`, dadosLembrete);

  return res.status(200).json({ success: true, agendadoPara: dataProxima });
}

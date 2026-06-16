import { getRedis } from './_shared/redis-client';
import webpush from 'web-push';
import type { VercelRequest, VercelResponse } from './_shared/types';
import { SalvarSubscriptionInputSchema, parseOrReject } from './_shared/validation';

webpush.setVapidDetails(
  'mailto:contato@girassol.app',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

interface AuthResult {
  authorized: boolean;
  reason?: string;
}

function authorize(req: VercelRequest): AuthResult {
  // Em produção, exige X-Test-Token == CRON_SECRET
  if (process.env.NODE_ENV === 'production') {
    const token = req.headers['x-test-token'];
    if (!token || token !== process.env.CRON_SECRET) {
      return { authorized: false, reason: 'Token ausente ou inválido' };
    }
  }
  // Em dev/preview, permite sem auth (Vite roda local)
  return { authorized: true };
}

const mensagens: Record<string, string> = {
  rega: '💧 Hora de regar o seu Girassol para mantê-lo radiante!',
  sol: '☀️ O dia começou! Que tal colocar o Girassol para tomar 6h de sol?',
  adubo: '🌱 Dia de nutrição! Hora de colocar o fertilizante no seu Girassol.'
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const redis = getRedis();
  const auth = authorize(req);
  if (!auth.authorized) {
    return res.status(401).json({ error: auth.reason });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const action = req.body?.action as string | undefined;

  // --- Action: agendar ---
  if (action === 'agendar') {
    const parsed = parseOrReject(SalvarSubscriptionInputSchema, {
      ...req.body,
      dataDisparoCustom: req.body?.dataDisparoCustom ?? new Date().toISOString()
    });
    if (!parsed.ok) return res.status(400).json(parsed.response);

    const { tipo, subscription, dataDisparoCustom } = parsed.data;
    const idUsuario = Buffer.from(subscription.endpoint).toString('base64').substring(0, 30);
    await redis.set(`lembrete:${idUsuario}:${tipo}`, {
      tipo,
      subscription,
      dataDisparo: dataDisparoCustom,
      processado: false
    });
    return res.status(200).json({ success: true, agendadoPara: dataDisparoCustom });
  }

  // --- Action: disparar ---
  if (action === 'disparar') {
    const chaves = await redis.keys('lembrete:*');
    const agora = new Date();
    let enviados = 0;
    let apagados = 0;
    const erros: string[] = [];

    for (const chave of chaves) {
      const lembrete: any = await redis.get(chave);
      if (!lembrete || lembrete.processado) continue;
      const dataDisparo = new Date(lembrete.dataDisparo);
      if (agora < dataDisparo) continue;

      try {
        await webpush.sendNotification(
          lembrete.subscription,
          JSON.stringify({
            title: '🌻 Meu Girassol',
            body: mensagens[lembrete.tipo] || 'Seu girassol precisa de você!'
          })
        );
        enviados++;
        if (lembrete.tipo === 'sol') {
          const amanha = new Date();
          amanha.setDate(amanha.getDate() + 1);
          amanha.setHours(8, 0, 0, 0);
          lembrete.dataDisparo = amanha.toISOString();
          await redis.set(chave, lembrete);
        } else {
          await redis.del(chave);
          apagados++;
        }
      } catch (error) {
        erros.push(`${chave}: ${(error as any)?.statusCode ?? 'unknown'}`);
      }
    }

    return res.status(200).json({ totalVerificados: chaves.length, enviados, apagados, erros });
  }

  // --- Action: listar ---
  if (action === 'listar') {
    const chaves = await redis.keys('lembrete:*');
    const itens: any[] = [];
    for (const chave of chaves) {
      const lembrete: any = await redis.get(chave);
      if (lembrete) {
        itens.push({
          chave,
          tipo: lembrete.tipo,
          dataDisparo: lembrete.dataDisparo,
          processado: lembrete.processado
        });
      }
    }
    return res.status(200).json({ total: itens.length, itens });
  }

  return res.status(400).json({ error: 'Ação inválida. Use: agendar, disparar, listar.' });
}

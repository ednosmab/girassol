import { kv } from '@vercel/kv';
import webpush from 'web-push';
import type { VercelRequest, VercelResponse } from '@vercel/node';

webpush.setVapidDetails(
  'mailto:contato@girassol.app',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

interface LembreteKV {
  tipo: string;
  subscription: webpush.PushSubscription;
  dataDisparo: string;
  processado: boolean;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const authHeader = req.headers.authorization;
  if (process.env.NODE_ENV === 'production' && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Não autorizado' });
  }

  const chaves = await kv.keys('lembrete:*');
  const agora = new Date();

  const mensagens: Record<string, string> = {
    rega: '💧 Hora de regar o seu Girassol para mantê-lo radiante!',
    sol: '☀️ O dia começou! Que tal colocar o Girassol para tomar 6h de sol?',
    adubo: '🌱 Dia de nutrição! Hora de colocar o fertilizante no seu Girassol.'
  };

  let enviados = 0;

  for (const chave of chaves) {
    const lembrete = await kv.get<LembreteKV>(chave);

    if (lembrete && !lembrete.processado) {
      const dataDisparo = new Date(lembrete.dataDisparo);

      if (agora >= dataDisparo) {
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
            await kv.set(chave, lembrete);
          } else {
            await kv.del(chave);
          }
        } catch (error) {
          console.error(`Falha ao enviar push para ${chave}:`, error);
          await kv.del(chave);
        }
      }
    }
  }

  return res.status(200).json({ processados: chaves.length, enviados });
}

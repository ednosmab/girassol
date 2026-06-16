import { getRedis } from './_shared/redis-client';
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

function isTransientError(statusCode?: number): boolean {
  if (!statusCode) return true; // erro de rede, sem status, tratar como transitório
  // 408 (timeout), 429 (rate limit), 5xx (server error) → mantém subscription
  return statusCode === 408 || statusCode === 429 || (statusCode >= 500 && statusCode < 600);
}

function isPermanentError(statusCode?: number): boolean {
  if (!statusCode) return false;
  // 404 (not found) e 410 (gone) → endpoint não existe mais, usuário desinstalou
  return statusCode === 404 || statusCode === 410;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const redis = getRedis();
  const authHeader = req.headers.authorization;
  if (process.env.NODE_ENV === 'production' && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Não autorizado' });
  }

  const chaves = await redis.keys('lembrete:*');
  const agora = new Date();

  const mensagens: Record<string, string> = {
    rega: '💧 Hora de regar o seu Girassol para mantê-lo radiante!',
    sol: '☀️ O dia começou! Que tal colocar o Girassol para tomar 6h de sol?',
    adubo: '🌱 Dia de nutrição! Hora de colocar o fertilizante no seu Girassol.'
  };

  let enviados = 0;
  let apagados = 0;
  const erros: string[] = [];

  for (const chave of chaves) {
    const lembrete = await redis.get<LembreteKV>(chave);

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
      const statusCode = (error as any)?.statusCode;
      const msg = error instanceof Error ? error.message : String(error);

      if (isPermanentError(statusCode)) {
        // 404/410: subscription morreu, usuário desinstalou
        console.warn(`[verificar-lembretes] subscription morta (${statusCode}), removendo ${chave}`);
        await redis.del(chave);
        apagados++;
        erros.push(`${chave}: subscription morta (${statusCode})`);
      } else if (isTransientError(statusCode)) {
        // 429/5xx/rede: manter e tentar de novo no próximo ciclo
        console.warn(`[verificar-lembretes] erro transitório (${statusCode}) em ${chave}: ${msg}`);
        erros.push(`${chave}: transitório (${statusCode})`);
      } else {
        // Status desconhecido: comportamento conservador = manter
        console.error(`[verificar-lembretes] erro desconhecido em ${chave}:`, error);
        erros.push(`${chave}: desconhecido`);
      }
    }
  }

  return res.status(200).json({
    totalVerificados: chaves.length,
    enviados,
    apagados,
    erros
  });
}

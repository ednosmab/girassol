A Escolha do Storage: Vercel KV (ou Upstash Redis)
Como o arquivo JSON local é inviável, a melhor abordagem para o seu agente é usar o Vercel KV (que por baixo dos panos é um Redis). Ele possui um plano gratuito generoso que dá e sobra para o aplicativo do Girassol, permitindo salvar e ler as assinaturas e datas com apenas uma linha de código.

Abaixo está o código exato dos arquivos que faltam para o seu agente criar:

1. Dependências e Chaves (package.json e .env)
O seu agente deve instalar a biblioteca de Push e a do Vercel KV:

Bash
npm install web-push @vercel/kv
npm install --save-dev @types/web-push
No arquivo .env (na raiz do projeto), ele deve configurar as chaves VAPID (que servem para autenticar o envio do Push de forma segura):

Snippet de código
NEXT_PUBLIC_VAPID_PUBLIC_KEY="SUA_CHAVE_PUBLICA_AQUI"
VAPID_PRIVATE_KEY="SUA_CHAVE_PRIVADA_AQUI"
# As variáveis abaixo o próprio painel da Vercel injeta ao ativar o KV:
KV_URL="redis://..."
KV_REST_API_URL="https://..."
KV_REST_API_TOKEN="..."
KV_REST_API_READ_ONLY_TOKEN="..."
(Dica: O agente pode gerar as chaves VAPID rodando npx web-push generate-vapid-keys no terminal).

2. Lógica do Servidor (Pastas api/)
📄 api/salvar-subscription.ts
Esta rota recebe a inscrição do navegador da sua sogra e a data em que ela clicou no botão, salvando tudo no Vercel KV.

TypeScript
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

  // Define as regras de intervalo de dias
  const diasAcrescimo = tipo === 'adubo' ? 15 : 2; // Rega = 2 dias, Adubo = 15 dias
  
  const dataProxima = new Date(timestamp);
  dataProxima.setDate(dataProxima.getDate() + diasAcrescimo);
  dataProxima.setHours(8, 0, 0, 0); // Força para as 8h da manhã

  // Chave única para o usuário (pode usar o endpoint da subscription como ID único)
  const idUsuario = Buffer.from(subscription.endpoint).toString('base64').substring(0, 30);
  
  const dadosLembrete = {
    tipo,
    subscription,
    dataDisparo: dataProxima.toISOString(),
    processado: false
  };

  // Salva no banco Key-Value da Vercel usando uma Hash ou Key simples
  await kv.set(`lembrete:${idUsuario}:${tipo}`, dadosLembrete);

  return res.status(200).json({ success: true, agendadoPara: dataProxima });
}
📄 api/verificar-lembretes.ts
Esta é a função acordada pelo Vercel Cron às 8h da manhã. Ela varre o banco procurando quem precisa ser notificado hoje.

TypeScript
import { kv } from '@vercel/kv';
import webpush from 'web-push';
import type { VercelRequest, VercelResponse } from '@vercel/node';

webpush.setVapidDetails(
  'mailto:seu-email@dominio.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Garante que a execução veio do Cron ou de um teste autorizado
  const authHeader = req.headers.authorization;
  if (process.env.NODE_ENV === 'production' && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Não autorizado' });
  }

  // Busca todas as chaves de lembretes no KV
  const chaves = await kv.keys('lembrete:*');
  const agora = new Date();

  const mensagens = {
    rega: "💧 Hora de regar o seu Girassol para mantê-lo radiante!",
    sol: "☀️ O dia começou! Que tal colocar o Girassol para tomar 6h de sol?",
    adubo: "🌱 Dia de nutrição! Hora de colocar o fertilizante no seu Girassol."
  };

  for (const chave of chaves) {
    const lembrete: any = await kv.get(chave);

    if (lembrete && !lembrete.processado) {
      const dataDisparo = new Date(lembrete.dataDisparo);

      // Se a data agendada já passou ou é agora
      if (agora >= dataDisparo) {
        try {
          await webpush.sendNotification(
            lembrete.subscription,
            JSON.stringify({
              title: '🌻 Meu Girassol',
              body: mensagens[lembrete.tipo as 'rega' | 'sol' | 'adubo']
            })
          );
          
          // Se for rega ou adubo, marcamos como processado para não repetir
          // Se for o do Sol (diário), podemos reajustar para o dia seguinte aqui mesmo!
          if (lembrete.tipo === 'sol') {
            const amanha = new Date();
            amanha.setDate(amanha.getDate() + 1);
            amanha.setHours(8, 0, 0, 0);
            lembrete.dataDisparo = amanha.toISOString();
            await kv.set(chave, lembrete);
          } else {
            await kv.del(chave); // Remove o gatilho único disparado
          }
        } catch (error) {
          console.error(`Falha ao enviar push para a chave ${chave}:`, error);
          // Se o token expirou ou o usuário desinstalou, remove do banco
          await kv.del(chave);
        }
      }
    }
  }

  return res.status(200).json({ processados: chaves.length });
}
3. Service Worker Recebendo o Push (public/sw-custom.js)
O Service Worker precisa escutar o evento da nuvem da Vercel para montar o balão na tela do celular:

JavaScript
self.addEventListener('push', (event) => {
  if (event.data) {
    const dados = event.data.json();
    
    const options = {
      body: dados.body,
      icon: '/assets/icons/icon-192x192.png',
      badge: '/assets/icons/badge-72x72.png',
      vibrate: [300, 100, 300],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: '1'
      }
    };

    event.waitUntil(
      self.registration.showNotification(dados.title, options)
    );
  }
});

// Abre o aplicativo ao clicar na notificação da tela de bloqueio
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/')
  );
});
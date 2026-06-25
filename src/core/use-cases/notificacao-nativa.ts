import { db } from '../database/localforage-db';

export type PermissaoStatus = 'supported' | 'not-supported' | 'denied' | 'default';

export function verificarSuporteNotificacoes(): PermissaoStatus {
  console.log('[NOTIF] Verificando suporte a notificações...');
  const hasNotification = 'Notification' in window;
  const hasSW = 'serviceWorker' in navigator;
  console.log(`[NOTIF] 'Notification' in window: ${hasNotification}`);
  console.log(`[NOTIF] 'serviceWorker' in navigator: ${hasSW}`);

  if (!hasNotification || !hasSW) {
    console.warn('[NOTIF] Resultado: not-supported (APIs ausentes)');
    return 'not-supported';
  }
  console.log(`[NOTIF] Notification.permission = "${Notification.permission}"`);
  if (Notification.permission === 'denied') {
    console.warn('[NOTIF] Resultado: denied (usuário bloqueou)');
    return 'denied';
  }
  if (Notification.permission === 'granted') {
    console.log('[NOTIF] Resultado: supported (permissão já concedida)');
    return 'supported';
  }
  console.log('[NOTIF] Resultado: default (permissão ainda não solicitada)');
  return 'default';
}

function getVapidPublicKey(): string {
  const key = (import.meta as any).env?.VITE_VAPID_PUBLIC_KEY as string | undefined;
  if (!key) {
    throw new Error(
      'VITE_VAPID_PUBLIC_KEY não definida. Configure no .env (dev) e na Vercel (prod).'
    );
  }
  return key;
}

export async function solicitarPermissaoEAtivarNotificacoes(): Promise<boolean> {
  console.log('[NOTIF] Solicitando permissão de notificação...');
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    console.warn('[NOTIF] Este dispositivo não suporta notificações nativas.');
    return false;
  }

  console.log(`[NOTIF] Permissão atual antes de pedir: "${Notification.permission}"`);

  if (Notification.permission === 'denied') {
    console.warn('[NOTIF] Permissão negada pelo usuário. Reative em Configurações do navegador.');
    return false;
  }

  const permissao = await Notification.requestPermission();
  console.log(`[NOTIF] Resultado de requestPermission: "${permissao}"`);
  if (permissao === 'granted') {
    console.log('[NOTIF] Permissão concedida com sucesso!');
    return true;
  }
  console.warn(`[NOTIF] Permissão não concedida: "${permissao}"`);
  return false;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function obterPushSubscription(): Promise<PushSubscription | null> {
  console.log('[NOTIF] === Obtendo Push Subscription ===');

  const hasSW = 'serviceWorker' in navigator;
  const hasPush = 'PushManager' in window;
  console.log(`[NOTIF] serviceWorker em navigator: ${hasSW}`);
  console.log(`[NOTIF] PushManager em window: ${hasPush}`);

  if (!hasSW || !hasPush) {
    console.warn('[NOTIF] Service Worker ou PushManager não suportado.');
    return null;
  }

  console.log(`[NOTIF] Permissão atual: "${Notification.permission}"`);
  if (Notification.permission === 'denied') {
    console.warn('[NOTIF] Permissão negada. Reative em Configurações > Notificações.');
    return null;
  }

  const permission = await Notification.requestPermission();
  console.log(`[NOTIF] requestPermission resultado: "${permission}"`);
  if (permission !== 'granted') {
    console.warn(`[NOTIF] Permissão não concedida (${permission})`);
    return null;
  }

  console.log('[NOTIF] Aguardando navigator.serviceWorker.ready...');
  const registration = await navigator.serviceWorker.ready;
  console.log(`[NOTIF] SW Registration pronta: active=${!!registration.active}, scope=${registration.scope}`);

  let subscription = await registration.pushManager.getSubscription();
  console.log(`[NOTIF] Subscription existente: ${subscription ? 'SIM' : 'NÃO'}`);

  if (!subscription) {
    console.log('[NOTIF] Criando nova subscription...');
    let vapidKey: string;
    try {
      vapidKey = getVapidPublicKey();
      console.log(`[NOTIF] VAPID key length: ${vapidKey.length}`);
    } catch (e) {
      console.error('[NOTIF]', (e as Error).message);
      return null;
    }
    try {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource
      });
      const endpoint = subscription.endpoint;
      console.log(`[NOTIF] Nova subscription criada: endpoint=${endpoint.substring(0, 80)}...`);
    } catch (e) {
      console.error('[NOTIF] Falha ao criar subscription:', (e as Error).message);
      return null;
    }
  } else {
    console.log(`[NOTIF] Usando subscription existente: ${subscription.endpoint.substring(0, 80)}...`);
  }

  console.log('[NOTIF] === Push Subscription obtida com sucesso ===');
  return subscription;
}

export async function atualizarSubscriptionServidor(): Promise<boolean> {
  console.log('[NOTIF] Atualizando subscription no servidor...');
  try {
    const subscription = await obterPushSubscription();
    if (!subscription) {
      console.warn('[NOTIF] Subscription não disponível para atualizar');
      return false;
    }

    const response = await fetch('/api/atualizar-subscription', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': (import.meta as any).env?.VITE_SYNC_API_KEY ?? ''
      },
      body: JSON.stringify({ subscription: subscription.toJSON() })
    });

    if (!response.ok) {
      console.error(`[NOTIF] Falha ao atualizar subscription: ${response.status}`);
      return false;
    }

    const data = await response.json();
    console.log(`[NOTIF] Subscription atualizada: ${data.atualizados} lembrete(s) atualizado(s)`);
    return true;
  } catch (e) {
    console.error('[NOTIF] Erro ao atualizar subscription:', (e as Error).message);
    return false;
  }
}

export async function agendarLembrete(
  tipo: 'rega' | 'sol' | 'adubo'
): Promise<{ success: boolean; agendadoPara?: string }> {
  console.log(`[NOTIF] === Iniciando agendamento para: ${tipo} ===`);

  console.log('[NOTIF] Passo 1: Obtendo push subscription...');
  const subscription = await obterPushSubscription();
  if (!subscription) {
    console.error('[NOTIF] Push subscription não disponível — abortando agendamento');
    return { success: false };
  }

  const timestamp = new Date().toISOString();
  const body = JSON.stringify({ tipo, subscription: subscription.toJSON(), timestamp });
  console.log(`[NOTIF] Passo 2: Enviando para /api/salvar-subscription (${body.length} bytes)...`);

  try {
    const response = await fetch('/api/salvar-subscription', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': (import.meta as any).env?.VITE_SYNC_API_KEY ?? ''
      },
      body
    });

    console.log(`[NOTIF] Passo 3: Resposta HTTP ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[NOTIF] Servidor retornou erro: ${response.status} — ${errorText}`);
      throw new Error(`Falha ao salvar no servidor: ${response.status}`);
    }

    const data = await response.json();
    console.log(`[NOTIF] Resposta body: ${JSON.stringify(data)}`);
    console.log(`[NOTIF] === Agendamento CONCLUÍDO: SUCESSO (próximo em ${data.agendadoPara}) ===`);
    return { success: true, agendadoPara: data.agendadoPara };
  } catch (error) {
    console.error('[NOTIF] === Agendamento FALHOU:', (error as Error).message, '===');
    return { success: false };
  }
}

export async function dispararNotificacaoNativa(
  titulo: string,
  mensagem: string
): Promise<void> {
  console.log('[NOTIF] Disparando notificação nativa local...');
  console.log(`[NOTIF] Permissão: "${Notification.permission}"`);

  if (Notification.permission === 'granted') {
    const registration = await navigator.serviceWorker.ready;
    console.log(`[NOTIF] SW ativa: ${!!registration.active}`);

    try {
      await registration.showNotification(titulo, {
        body: mensagem,
        icon: '/icon-192.png',
        tag: 'cuidado-girassol',
        vibrate: [200, 100, 200]
      } as NotificationOptions & { vibrate?: number[] });
      console.log('[NOTIF] showNotification chamada com sucesso');
    } catch (e) {
      console.error('[NOTIF] showNotification FALHOU:', (e as Error).message);
    }
  } else {
    console.warn('[NOTIF] Permissão não é granted, solicitando...');
    await solicitarPermissaoEAtivarNotificacoes();
  }
}

export const TitulosNotificacao: Record<'rega' | 'sol' | 'adubo', string> = {
  rega: '💧 Cuidar do Girassol: Hora da Rega',
  sol: '☀️ Cuidar do Girassol: Banho de Sol',
  adubo: '🌱 Cuidar do Girassol: Nutrição e Adubo'
};

export const DescricoesNotificacao: Record<'rega' | 'sol' | 'adubo', string> = {
  rega: 'Verifique se a terra está seca a dois centímetros de profundidade antes de molhar.',
  sol: 'Garanta que ele pegue pelo menos 6 horas de luz solar direta hoje!',
  adubo: 'Dia de colocar o fertilizante rico em nitrogênio para crescer forte!'
};

export function calcularDiasRestantes(timestamp: string, tipo: 'rega' | 'sol' | 'adubo'): string {
  const dataUltimo = new Date(timestamp);
  const dias = tipo === 'adubo' ? 15 : tipo === 'rega' ? 2 : 1;
  const dataProxima = new Date(dataUltimo);
  dataProxima.setDate(dataProxima.getDate() + dias);

  const agora = new Date();
  const diffMs = dataProxima.getTime() - agora.getTime();
  const diffDias = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDias <= 0) return 'Vence hoje!';

  return dataProxima.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

export async function obterProximoLembrete(tipo: 'rega' | 'sol' | 'adubo'): Promise<string | null> {
  let ultimoTimestamp: string | null = null;

  await db.cuidados.iterate<{ tipo: string; timestamp: string; criadoEm: number }, void>((value) => {
    if (value.tipo === tipo && (!ultimoTimestamp || value.criadoEm > new Date(ultimoTimestamp).getTime())) {
      ultimoTimestamp = value.timestamp;
    }
  });

  if (!ultimoTimestamp) return null;
  return calcularDiasRestantes(ultimoTimestamp, tipo);
}

export async function obterUltimoCuidado(tipo: 'rega' | 'sol' | 'adubo'): Promise<string | null> {
  let ultimoTimestamp: string | null = null;

  await db.cuidados.iterate<{ tipo: string; timestamp: string; criadoEm: number }, void>((value) => {
    if (value.tipo === tipo && (!ultimoTimestamp || value.criadoEm > new Date(ultimoTimestamp).getTime())) {
      ultimoTimestamp = value.timestamp;
    }
  });

  if (!ultimoTimestamp) return null;

  const dataUltimo = new Date(ultimoTimestamp);
  const hoje = new Date();

  const mesmoDia = dataUltimo.getDate() === hoje.getDate() &&
    dataUltimo.getMonth() === hoje.getMonth() &&
    dataUltimo.getFullYear() === hoje.getFullYear();

  if (mesmoDia) return 'Hoje';

  const ontem = new Date(hoje);
  ontem.setDate(ontem.getDate() - 1);
  const foiOntem = dataUltimo.getDate() === ontem.getDate() &&
    dataUltimo.getMonth() === ontem.getMonth() &&
    dataUltimo.getFullYear() === ontem.getFullYear();

  if (foiOntem) return 'Ontem';

  return dataUltimo.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

export async function obterTiposSemRegistro(): Promise<('rega' | 'sol' | 'adubo')[]> {
  const tipos: ('rega' | 'sol' | 'adubo')[] = ['rega', 'sol', 'adubo'];
  const faltantes: ('rega' | 'sol' | 'adubo')[] = [];

  for (const tipo of tipos) {
    let temRegistro = false;
    await db.cuidados.iterate<{ tipo: string }, void>((value) => {
      if (value.tipo === tipo) temRegistro = true;
    });
    if (!temRegistro) faltantes.push(tipo);
  }

  return faltantes;
}

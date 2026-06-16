import { db } from '../database/localforage-db';

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
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    console.warn('Este dispositivo não suporta notificações nativas.');
    return false;
  }

  const permissao = await Notification.requestPermission();
  if (permissao === 'granted') {
    console.log('Permissão para notificações concedida!');
    return true;
  }
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
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push: Service Worker ou PushManager não suportado neste navegador.');
    return null;
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    console.warn('Push: Permissão de notificação não concedida (status:', permission, ')');
    return null;
  }

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    let vapidKey: string;
    try {
      vapidKey = getVapidPublicKey();
    } catch (e) {
      console.warn('Push:', (e as Error).message);
      return null;
    }
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource
    });
  }

  return subscription;
}

export async function agendarLembrete(
  tipo: 'rega' | 'sol' | 'adubo'
): Promise<{ success: boolean; agendadoPara?: string }> {
  const subscription = await obterPushSubscription();
  if (!subscription) {
    console.warn('Push subscription não disponível');
    return { success: false };
  }

  const timestamp = new Date().toISOString();

  try {
    const response = await fetch('/api/salvar-subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo, subscription: subscription.toJSON(), timestamp })
    });

    if (!response.ok) throw new Error('Falha ao salvar no servidor');

    const data = await response.json();
    return { success: true, agendadoPara: data.agendadoPara };
  } catch (error) {
    console.error('Erro ao agendar lembrete:', error);
    return { success: false };
  }
}

export async function dispararNotificacaoNativa(
  titulo: string,
  mensagem: string
): Promise<void> {
  if (Notification.permission === 'granted') {
    const registration = await navigator.serviceWorker.ready;

    registration.showNotification(titulo, {
      body: mensagem,
      icon: '/icon-192.png',
      tag: 'cuidado-girassol',
      vibrate: [200, 100, 200]
    } as NotificationOptions & { vibrate?: number[] });
  } else {
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

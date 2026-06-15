import { db } from '../database/localforage-db';

const VAPID_PUBLIC_KEY = 'BLCM5F8Z0KLjyaXgCiDcFKl1JTr1u4tsRuliqSYqsuWIuUvHv7B6HbWj2kpytijo3nRZDUHkCJGshSucF20ND1w';

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
    return null;
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return null;

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource
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
  return `${diffDias} dia(s)`;
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

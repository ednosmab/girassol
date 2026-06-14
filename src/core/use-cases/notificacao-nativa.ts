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

export async function dispararNotificacaoNativa(
  titulo: string,
  mensagem: string
): Promise<void> {
  if (Notification.permission === 'granted') {
    const registration = await navigator.serviceWorker.ready;

    registration.showNotification(titulo, {
      body: mensagem,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
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

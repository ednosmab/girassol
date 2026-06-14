Plano de Implementação Corrigido: PWA "Meu Girassol"
Este documento substitui as instruções anteriores e estabelece o código técnico exato para notificações nativas, captura do popup de instalação e fidelidade visual.

🔔 1. Sistema de Notificação Nativa (Via Service Worker)
Para que o celular apite e exiba a notificação mesmo com o app fechado, o agente de IA deve utilizar a API nativa de notificações do navegador vinculada ao Service Worker.

Solicitação de Permissão e Disparo Nativo (src/core/use-cases/notificacao-nativa.ts)
TypeScript
export async function solicitarPermissaoEAtivarNotificacoes() {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    console.warn('Este dispositivo não suporta notificações nativas.');
    return;
  }

  const permissao = await Notification.requestPermission();
  if (permissao === 'granted') {
    console.log('Permissão para notificações concedida!');
  }
}

export async function dispararNotificacaoNativa(titulo: string, mensagem: string) {
  if (Notification.permission === 'granted') {
    const registration = await navigator.serviceWorker.ready;
    
    // O Service Worker garante o disparo a nível de sistema operacional
    registration.showNotification(titulo, {
      body: mensagem,
      icon: '/assets/icons/icon-192x192.png', // Caminho do ícone do girassol
      badge: '/assets/icons/badge-72x72.png',
      vibrate: [200, 100, 200],
      tag: 'cuidado-girassol'
    });
  } else {
    // Se não tiver permissão, solicita dinamicamente
    await solicitarPermissaoEAtivarNotificacoes();
  }
}
📲 2. Captura e Disparo do Popup de Instalação PWA
Os navegadores barram popups automáticos de instalação por segurança. Para resolver isso, o agente deve capturar o evento do sistema e acionar a instalação através de um elemento discreto e elegante integrado ao seu layout.

Lógica do Prompt de Instalação (src/ui/components/InstallPrompt.tsx)
TypeScript
let deferredPrompt: any = null;

// Escuta global colocada no ponto de entrada do app (index.html ou _app.tsx)
window.addEventListener('beforeinstallprompt', (e) => {
  // Previne que o navegador mostre o prompt padrão mini no rodapé
  e.preventDefault();
  // Guarda o evento para ser disparado pelo nosso botão
  deferredPrompt = e;
  // Exibe o componente customizado de instalação na UI (ex: um card ou folha no topo)
  window.dispatchEvent(new CustomEvent('pwa-pode-instalar'));
});

// Função que o agente deve colocar no clique do botão "Instalar Aplicativo"
export async function acionarInstalacaoPWA() {
  if (!deferredPrompt) return;
  
  // Mostra o popup nativo de instalação do Android/iOS/Chrome
  deferredPrompt.prompt();
  
  // Espera a resposta da usuária
  const { outcome } = await deferredPrompt.userChoice;
  console.log(`Usuário respondeu à instalação: ${outcome}`);
  
  // Limpa o prompt para que não possa ser reusado
  deferredPrompt = null;
}
📄 3. Arquivo README.md Atualizado
O Agente de IA deve gerar o arquivo README.md na raiz refletindo rigorosamente o escopo correto:

Markdown
# 🌻 Meu Girassol - Diário Interativo de Cuidados

An application crafted with premium design principles and specialized accessibility architecture, developed to simplify and enrich the daily care routine for a beloved family member.

## 🎯 O Propósito do Projeto
Cultivating delicate plants like sunflowers requires rigor in checking soil moisture, exposure to sunlight, and chemical fertilization cycles. This software replaces passive interfaces or easy-to-forget paper notes with an interactive digital ecosystem that guides the user safely and clearly.

### Problemas que a Solução Resolve:
* **Esquecimento de Ciclos:** Centraliza a última data/hora exata em que a planta foi cuidada, sem demandar logins ou cadastros complexos.
* **Complexidade Tecnológica (Acessibilidade):** Interface minimalista baseada em botões táteis no formato de pétalas e tipografia de alta legibilidade, ideal para uso móvel intuitivo.
* **Notificações de Sistema Reais:** Utiliza a Web Notification API em conjunto com Service Workers para disparar alertas nativos diretamente na tela de bloqueio do celular, garantindo atenção imediata.
* **Experiência Própria (PWA):** Captura ativa de instalação para fixar o ícone do aplicativo diretamente na tela inicial do celular.

## 🛠️ Tecnologias Usadas
* **Core Interface:** HTML5 semântico estruturado no padrão SPA (Single Page Application) com controle de visualizações síncronas.
* **Typography & Design System:** Google Fonts (*Playfair Display*, *Caveat*, *Plus Jakarta Sans*) aplicados sob uma paleta botânica personalizada.
* **Engine de Persistência:** **IndexedDB** via `localforage` para armazenamento transacional seguro, assíncrono e não volátil diretamente no dispositivo da usuária.
* **PWA Capability & Push:** Service Workers ativos para tratamento offline, escuta de estados reativos e push nativo no sistema operacional.
* **Cloud Infrastructure:** Configuração de deploy integrada na **Vercel** com cabeçalhos agressivos de revalidação de cache.
📐 4. Ajuste no vercel.json
Garante que as notificações e o service worker sejam sempre revalidados instantaneamente no deploy:

JSON
{
  "version": 2,
  "cleanUrls": true,
  "headers": [
    {
      "source": "/service-worker.js",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=0, must-revalidate"
        }
      ]
    },
    {
      "source": "/manifest.json",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=0, must-revalidate"
        }
      ]
    }
  ],
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
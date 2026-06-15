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
* **Typography & Design System:** Google Fonts (*Caveat*, *Plus Jakarta Sans*) aplicados sob uma paleta botânica personalizada.
* **Engine de Persistência:** **IndexedDB** via `localforage` para armazenamento transacional seguro, assíncrono e não volátil diretamente no dispositivo da usuária.
* **PWA Capability & Push:** Service Workers ativos para tratamento offline, escuta de estados reativos e push nativo no sistema operacional.
* **Cloud Infrastructure:** Deploy na **Vercel** com **Upstash Redis (Vercel KV)** para armazenamento de subscriptions e **Vercel Cron** para disparo matutino de notificações.

## ⏰ Sistema de Notificações Push Matutino

A aplicação contorna as restrições de push em segundo plano dos navegadores (especialmente iOS) utilizando uma arquitetura serverless:

| Componente | Função |
|---|---|
| **Vercel Cron** | Dispara `/api/verificar-lembretes` todo dia às 8h BRT (11:00 UTC) |
| **Upstash Redis (KV)** | Armazena subscriptions Push e timers de lembretes |
| **web-push** | Envia payload criptografado para o browser via protocolo Web Push |
| **Service Worker** | Escuta evento `push` e exibe notificação na tela de bloqueio |

### Fluxo do Usuário

```
1. Usuário clica "Registrei que Reguei"
   → Client: PushManager.subscribe() obtém subscription
   → Client: POST /api/salvar-subscription → salva no KV

2. Vercel Cron (8h BRT): varre KV por lembretes vencidos
   → Server: kv.keys('lembrete:*') → compara dataDisparo <= agora
   → Server: webpush.sendNotification() → payload para o browser

3. Service Worker recebe push → showNotification() → 📱 tela de bloqueio
```

### Intervalos de Lembrete

| Ação | Intervalo | Recorrência |
|---|---|---|
| 💧 Rega | 2 dias | Único (reagenda ao registrar) |
| ☀️ Sol | 1 dia | Diário |
| 🌱 Adubo | 15 dias | Único (reagenda ao registrar) |

## 📁 Estrutura do Projeto

```
├── api/
│   ├── salvar-subscription.ts      # POST: salva subscription no Vercel KV
│   └── verificar-lembretes.ts      # Cron: envia Web Push matutino
├── src/
│   ├── core/
│   │   ├── database/
│   │   │   └── localforage-db.ts   # Interface IndexedDB via localforage
│   │   └── use-cases/
│   │       ├── registrar-cuidado.ts
│   │       ├── buscar-historico.ts
│   │       ├── gerenciar-lembretes.ts
│   │       ├── agendar-notificacao.ts
│   │       └── notificacao-nativa.ts  # Push subscription + agendarLembrete
│   ├── ui/
│   │   ├── components/
│   │   │   ├── Header.tsx
│   │   │   ├── Navigation.tsx
│   │   │   ├── AgendaBox.tsx          # Botões pétala + countdown
│   │   │   └── InstallPrompt.tsx      # beforeinstallprompt popup
│   │   └── views/
│   │       ├── DiarioView.tsx
│   │       └── CuidadosView.tsx
│   ├── __tests__/                     # Suíte de testes Jest (22 testes)
│   ├── App.tsx
│   └── main.tsx
├── public/
│   └── sw-custom.js               # Push + notificationclick handlers
├── vercel.json                     # Cron + rewrites + cache headers
├── vite.config.ts                  # VitePWA com importScripts
└── README.md
```

## 🔧 Variáveis de Ambiente

| Variável | Escopo | Descrição |
|---|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Client | Chave pública VAPID para PushManager.subscribe() |
| `VAPID_PRIVATE_KEY` | Server | Chave privada VAPID para webpush.sendNotification() |
| `KV_URL` | Server | URL do Upstash Redis |
| `KV_REST_API_URL` | Server | Endpoint REST do KV |
| `KV_REST_API_TOKEN` | Server | Token de escrita do KV |
| `KV_REST_API_READ_ONLY_TOKEN` | Server | Token de leitura do KV |
| `CRON_SECRET` | Server | Secret para autenticar o Vercel Cron |

## 📋 Comandos Disponíveis

```bash
npm install          # Instalação de dependências
npm run dev          # Desenvolvimento local
npm run build        # Build de produção
npm test             # Executar testes Jest
npm run test:coverage # Testes com cobertura
npm run lint         # Verificação de tipos TypeScript
```

## 🔮 Sugestões para Evoluções Futuras

1. **Engine de Análise de Padrões:** Mensagens motivacionais baseadas na frequência de cuidados.
2. **Histórico Visual Expandido:** Galeria de fotos integrada ao armazenamento local.
3. **Backup Cloud via Supabase:** Sincronização opcional em nuvem para proteção de dados.

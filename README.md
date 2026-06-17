# 🌻 Meu Girassol — Jardim Secreto

Diário interativo de cuidados com girassol. PWA offline first com sincronização automática, notificações push e experiência centrada na usuária.

## 🎯 Propósito

Cultivar girassol exige rigor em ciclos de rega, exposição solar e adubação. Este aplicativo substitui anotações passageiras por um ecossistema digital que guia a usuária com clareza, mesmo sem internet.

## ✅ Funcionalidades implementadas

### Registro de cuidados
- Botões pétala para registrar rega, sol e adubo
- Countdown visual para próxima ação
- Persistência local via IndexedDB (localforage)
- Toast de feedback elegante com barra de progresso

### Notificações push matutinas
- Vercel Cron às 8h BRT envia lembretes via web-push
- Service Worker exibe notificação na tela de bloqueio
- Intervalos: rega (2 dias), sol (diário), adubo (15 dias)

### PWA completa
- Instalação na tela inicial do celular
- Ícone personalizado (girassol)
- Cache inteligente via Workbox
- Atualização automática do Service Worker

### Offline first (arquitetura por eventos)
- **Outbox Pattern**: toda operação é registrada localmente antes de sincronizar
- **Sincronização automática**: processa fila ao detectar conexão
- **Idempotência**: eventos não são processados em duplicidade
- **Retentativas**: falhas são reattemptadas automaticamente

## 🏗️ Arquitetura

```
Usuária
   ↓
Interface (React)
   ↓
Casos de uso
   ↓
Outbox Local (IndexedDB)
   ↓
Sincronizador (online/offline)
   ↓
API Serverless (Vercel)
   ↓
Redis (Upstash)
   ↓
Cron Jobs → Push Notifications
```

## 📁 Estrutura do projeto

```
├── api/
│   ├── salvar-subscription.ts      # POST: salva subscription Push no Redis
│   ├── verificar-lembretes.ts      # Cron: envia Web Push matutino
│   └── sync-events.ts             # POST: recebe eventos da outbox
├── src/
│   ├── core/
│   │   ├── contexts/
│   │   │   └── SyncContext.tsx     # Contexto React de sincronização
│   │   ├── database/
│   │   │   ├── localforage-db.ts   # IndexedDB (cuidados + lembretes)
│   │   │   └── outbox-store.ts     # Fila de eventos offline
│   │   ├── types/
│   │   │   └── sync.ts            # Tipos SyncState, OutboxEvent
│   │   └── use-cases/
│   │       ├── registrar-cuidado.ts
│   │       ├── registrar-cuidado-com-outbox.ts
│   │       ├── buscar-historico.ts
│   │       ├── gerenciar-lembretes.ts
│   │       ├── agendar-notificacao.ts
│   │       └── notificacao-nativa.ts
│   ├── ui/
│   │   ├── components/
│   │   │   ├── Header.tsx
│   │   │   ├── Navigation.tsx
│   │   │   ├── AgendaBox.tsx
│   │   │   ├── Toast.tsx
│   │   │   └── InstallPrompt.tsx
│   │   └── views/
│   │       ├── DiarioView.tsx
│   │       └── CuidadosView.tsx
│   ├── __tests__/                  # 14 suítes / 101 testes
│   ├── App.tsx
│   └── main.tsx
├── public/
│   ├── sw-custom.js               # Push + notificationclick
│   ├── icon-192.png
│   ├── icon-512.png
│   └── favicon.png
├── vercel.json
├── vite.config.ts
└── package.json
```

## 🧪 Testes

### Cobertura

| Suíte | Testes | O que valida |
|---|---|---|
| `outbox.spec.ts` | 13 | Criação, status, retries, remoção, ordenação |
| `sincronizador.spec.ts` | 10 | Fluxo online/offline, retentativas, idempotência |
| `offline-integracao.spec.ts` | 5 | registrarCuidadoComOutbox + IndexedDB + outbox |
| `notificacao-push.spec.ts` | 8 | Countdown, títulos, descrições |
| `notificacao-nativa.spec.ts` | 4 | Títulos e descrições de notificação |
| `registrar-cuidado.spec.ts` | 4 | Schema Zod de validação |
| `gerenciar-lembretes.spec.ts` | 4 | Schema Zod de lembretes |
| `agendar-notificacao.spec.ts` | 3 | Google Calendar URL |
| `build.spec.ts` | 5 | Arquivos de build existentes |
| `sw-custom.spec.ts` | 8 | Handlers do service worker custom |
| `useServiceWorkerUpdate.spec.ts` | 11 | Hook de update do SW |
| `validation.spec.ts` | 10 | Schemas Zod compartilhados |
| `test-push-endpoint.spec.ts` | 4 | Endpoint /api/test-push |
| `redis-client.spec.ts` | 6 | Factory de Redis injetável |
| **Total** | **101** | |

### Executar

```bash
npm test              # Todos os testes
npm run test:coverage # Com cobertura
```

## 🔧 Variáveis de ambiente

| Variável | Escopo | Descrição |
|---|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Client | Chave pública VAPID |
| `VAPID_PRIVATE_KEY` | Server | Chave privada VAPID |
| `UPSTASH_REDIS_REST_URL` | Server | URL do Upstash Redis |
| `UPSTASH_REDIS_REST_TOKEN` | Server | Token REST do Upstash |
| `CRON_SECRET` | Server | Secret para Vercel Cron |
| `VITE_SYNC_API_KEY` | Client + Server | Chave de API para sync |

## 📋 Comandos

```bash
npm install           # Instalar dependências
npm run dev           # Desenvolvimento local
npm run build         # Build de produção
npm test              # Executar testes
npm run lint          # Verificar tipos TypeScript
```

## 🛡️ Segurança

- **X-API-Key**: Autenticação de API via header (bloqueia bots)
- **Timing-safe comparison**: Comparação constante-time de API keys
- **Rate Limit**: Redis INCR + EXPIRE (10 req/min por IP)
- **CSP header**: Content Security Policy no vercel.json
- **Service Worker**: Validação de origin + sanitização de payload
- **.gitignore**: `.env.*` coberto (exceto `.env.example`)
- **TestarPush**: Dev-only (sem acesso a secrets em produção)

## 🚀 Deploy

- **Produção**: branch `main` → Vercel
- **Staging**: branch `staging` → Vercel Preview
- **Cron**: `0 11 * * *` (8h BRT) via vercel.json

## 📄 Licença

Desenvolvido com amor para a melhor sogra do mundo.

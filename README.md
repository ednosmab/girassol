# 🌻 Meu Girassol — Jardim Secreto

Diário interativo de cuidados com girassol. PWA offline first com sincronização automática, notificações push e experiência centrada na usuária.

## 🎯 Propósito

Cultivar girassol exige rigor em ciclos de rega, exposição solar e adubação. Este aplicativo substitui anotações passageiras por um ecossistema digital que guia a usuária com clareza, mesmo sem internet.

## ✅ Funcionalidades implementadas

### Registro de cuidados
- Botões pétala para registrar rega, sol e adubo
- Countdown visual para próxima ação
- Persistência local via IndexedDB (localforage)

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
- **Feedback visual**: banner discreto com estado da sincronização
- **Idempotência**: eventos não são processados em duplicidade
- **Retentativas**: falhas são reattemptadas automaticamente

### Estados de sincronização

| Estado | Mensagem |
|---|---|
| Offline | 📶 Sem internet. Continue registrando seus cuidados normalmente. |
| Sincronizando | ⏳ Atualizando suas anotações... |
| Sincronizado | ✅ Tudo atualizado |
| Erro | ⚠️ Não foi possível atualizar. Tentaremos novamente. |

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
│   ├── salvar-subscription.ts      # POST: salva subscription Push no KV
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
│   │   │   ├── InstallPrompt.tsx
│   │   │   ├── SyncStatus.tsx      # Banner de estado offline/online
│   │   │   └── TestarPush.tsx
│   │   └── views/
│   │       ├── DiarioView.tsx
│   │       └── CuidadosView.tsx
│   ├── __tests__/                  # 15 suítes / 110 testes
│   ├── App.tsx
│   └── main.tsx
├── public/
│   ├── sw-custom.js               # Push + notificationclick
│   ├── icon-192.png
│   ├── icon-512.png
│   └── favicon.png
├── test-push-staging.sh           # Script de teste de push
├── vercel.json
├── vite.config.ts
└── package.json
```

## 🧪 Testes

### Cobertura (atualizado pós-Planos 01–04)

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
| `build.spec.ts` | 12 | Arquivos de build existentes |
| `sw-custom.spec.ts` | 5 | Handlers do service worker custom |
| `useServiceWorkerUpdate.spec.ts` | 7 | Hook de update do SW |
| `validation.spec.ts` | 14 | Schemas Zod compartilhados |
| `rate-limit.spec.ts` | 7 | Rate limit in-memory |
| `test-push-endpoint.spec.ts` | 4 | Endpoint /api/test-push |
| `redis-client.spec.ts` | 6 | Factory de Redis injetável |
| **Total** | **110** | |

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
| `UPSTASH_REDIS_REST_URL` | Server | URL do Upstash Redis (via Marketplace) |
| `UPSTASH_REDIS_REST_TOKEN` | Server | Token REST do Upstash |
| `CRON_SECRET` | Server | Secret para Vercel Cron |

## 📋 Comandos

```bash
npm install           # Instalar dependências
npm run dev           # Desenvolvimento local
npm run build         # Build de produção
npm test              # Executar testes
npm run lint          # Verificar tipos TypeScript
```

## 🧪 Teste de push no staging

```bash
# 1. Abra o deploy preview com ?test
# https://girassol-xxxxx.vercel.app/?test

# 2. Clique no botão 🧪 → 💧 → Cole CRON_SECRET → Disparar

# 3. Notificação chega imediatamente
```

## 🚀 Deploy

- **Produção**: branch `main` → Vercel
- **Staging**: branch `staging` → Vercel Preview
- **Cron**: `0 11 * * *` (8h BRT) via vercel.json

## 🛡️ Planos de hardening aplicados

- **Plano 01:** Service Worker com update seguro (visibilitychange + ativação em background)
- **Plano 02:** Validação Zod em todas as API functions + rate limit
- **Plano 03:** Endpoint `/api/test-push` autenticado server-side (CRON_SECRET sai do browser)
- **Plano 04:** Migração de `@vercel/kv` (deprecated) para `@upstash/redis`

Detalhes em `docs/plans/`.

## 📄 Licença

Desenvolvido com amor para a melhor sogra do mundo.

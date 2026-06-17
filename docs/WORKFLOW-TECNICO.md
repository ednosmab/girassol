# Workflow Técnico — Operações do Sistema

> Fluxos técnicos que acontecem nos bastidores do projeto Meu Girassol.

---

## 1. Mecanismo de Atualização do Service Worker

### 1.1 Configuração Atual

```typescript
// vite.config.ts
registerType: 'prompt'        // SW não toma controle automático
clientsClaim: false            // SW NÃO assume controle imediatamente
skipWaiting: false             // SW NÃO pula estado "waiting"
```

### 1.2 Fluxo Completo de Atualização

```
┌─────────────────────────────────────────────────────────────────┐
│                    FLUXO DE ATUALIZAÇÃO SW                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. App carrega                                                 │
│     └─ main.tsx → registerSW({ immediate: true })              │
│        (registra o SW mas NÃO força atualização)                │
│                                                                 │
│  2. App monta                                                   │
│     └─ App.tsx → useServiceWorkerUpdate()                       │
│        (hook assume o ciclo de verificação)                     │
│                                                                 │
│  3. Após 3 segundos (INITIAL_CHECK_DELAY_MS)                    │
│     └─ checkForUpdate() → reg.update()                          │
│        (Workbox verifica se há novo sw.js no servidor)          │
│                                                                 │
│  4. A cada 30 minutos (PERIODIC_CHECK_INTERVAL_MS)              │
│     └─ checkForUpdate() repete o processo                       │
│                                                                 │
│  5. Usuário muda de aba (visibilitychange)                      │
│     ├─ visible: checkForUpdate() (throttle 60s)                 │
│     └─ hidden: se há SW waiting → envia SKIP_WAITING            │
│                                                                 │
│  6. SW ativa → dispara "controllerchange"                       │
│     └─ refreshingRef garante reload UMA única vez               │
│                                                                 │
│  7. App recarrega com o SW novo                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3 Detecção de Versão

O browser detecta nova versão por **comparação byte a byte** do arquivo `sw.js`:

1. Workbox gera `sw.js` com `precache manifest` contendo hashes MD5 de todos os arquivos
2. Quando o código muda, os hashes mudam → `sw.js` muda
3. O browser compara o `sw.js` registrado com o novo a cada carregamento
4. Qualquer diferença byte a byte dispara o ciclo de atualização

### 1.4 Compatibilidade com SW Antigo

| Aspecto | SW Antigo (no dispositivo) | SW Novo (deployed) |
|---------|---------------------------|-------------------|
| `skipWaiting` | `true` — auto-ativa no install | `false` — espera mensagem |
| `clientsClaim` | `true` — assume controle imediato | `false` — precisa de reload |
| Ativação | Automática | Via `{ type: 'SKIP_WAITING' }` |
| Pós-ativação | Já controla a página | `controllerchange` → reload |

**Resultado:** O SW antigo NÃO bloqueia a entrega da nova versão. O mecanismo funciona automaticamente.

### 1.5 Arquivos Envolvidos

| Arquivo | Papel |
|---------|-------|
| `vite.config.ts` | Configuração do Workbox (registerType, clientsClaim, skipWaiting) |
| `src/main.tsx` | Registra o SW via `registerSW({ immediate: true })` |
| `src/core/hooks/useServiceWorkerUpdate.ts` | Hook de verificação e ativação |
| `src/App.tsx` | Consome o hook `useServiceWorkerUpdate()` |
| `public/sw-custom.js` | Listener de mensagens SKIP_WAITING + push notifications |

---

## 2. Sincronização Offline (Outbox Pattern)

### 2.1 Fluxo

```
┌──────────────────────────────────────────────────────────────┐
│                    OFFLINE → ONLINE SYNC                      │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Usuário registra cuidado (online ou offline)             │
│     └─ registrarCuidadoComOutbox()                           │
│        ├─ Valida com Zod                                     │
│        ├─ Salva cuidado no IndexedDB                         │
│        └─ Cria evento na outbox (status: pending)            │
│                                                              │
│  2. SyncContext detecta eventos pendentes                    │
│     └─ Polling a cada 5s (quando online)                     │
│     └─ Detecção de visibilitychange                          │
│                                                              │
│  3. triggerSync() processa a outbox                          │
│     ├─ Marca evento como "processing"                        │
│     ├─ Envia para /api/sync-events (com X-API-Key)           │
│     ├─ Marca como "synced" (sucesso)                         │
│     └─ Incrementa retry (falha, máx 5x)                      │
│                                                              │
│  4. Servidor processa                                        │
│     ├─ Autentica X-API-Key (timing-safe comparison)          │
│     ├─ Rate limit: Redis INCR + EXPIRE (10 req/min)          │
│     ├─ Verifica idempotência (processed:{key})               │
│     ├─ Armazena evento no Redis                              │
│     └─ Retorna sucesso ou duplicata                          │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 2.2 Idempotência

- Chave: `care_{tipo}_{timestamp}` ou `event:{eventId}`
- TTL: 30 dias no Redis
- Previne duplicatas em caso de retry

### 2.3 Limites

- Máximo 5 retentativas por evento
- Eventos `failed` após 5x são removidos com log de erro
- Sync automático a cada 5s quando online

---

## 3. Push Notifications

### 3.1 Fluxo Completo

```
┌──────────────────────────────────────────────────────────────┐
│                    PUSH NOTIFICATION FLOW                      │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Usuário registra cuidado no app                          │
│     └─ handlePermitir() no AgendaBox:                        │
│        a. Salva cuidado via registrarCuidadoComOutbox()       │
│        b. Solicita permissão de notificação                   │
│        c. Se concedida: registration.pushManager.subscribe()  │
│        d. Envia subscription + tipo para                      │
│           /api/salvar-subscription (com X-API-Key)            │
│        e. Servidor agendar no Redis:                         │
│           lembrete:{userId}:{tipo} com dataDisparo            │
│        f. Toast: "Registrado! Próxima rega em 2 dias"        │
│                                                              │
│  2. Cron (08:00 BRT = 11:00 UTC)                             │
│     └─ /api/verificar-lembretes (GET)                        │
│        ├─ Auth: Authorization: Bearer CRON_SECRET            │
│        ├─ Scanneia chaves lembrete:* via SCAN (não KEYS)     │
│        ├─ Para cada lembrete com dataDisparo <= agora:       │
│        │   ├─ Envia push via web-push                        │
│        │   ├─ Se "sol" (diário): reagenda para próximo dia   │
│        │   └─ Se "rega"/"adubo": remove (one-shot)           │
│        └─ Erro 404/410: remove subscription permanentemente  │
│        └─ Erro 429/5xx: mantém (retry no próximo cron)       │
│                                                              │
│  3. Service Worker                                           │
│     └─ onpush → showNotification()                           │
│        (valida origin do push, sanitiza payload)              │
│                                                              │
│  4. Usuário clica na notificação                             │
│     └─ notificationclick → focus ou openWindow('/')           │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 Headers de Autenticação

| Endpoint | Quem chama | Auth |
|----------|-----------|------|
| `POST /api/salvar-subscription` | Cliente (usuária) | `X-API-Key` (rate limit) |
| `POST /api/sync-events` | Cliente (SyncContext) | `X-API-Key` (rate limit) |
| `GET /api/verificar-lembretes` | Vercel Cron | `Authorization: Bearer CRON_SECRET` |
| `POST /api/test-push` | TestarPush (dev-only) | `X-Test-Token: CRON_SECRET` (produção) |

### 3.3 Classificação de Erros (verificar-lembretes)

| Erro | Tipo | Ação |
|------|------|------|
| 404 | Permanente | Remove subscription do Redis |
| 410 | Permanente | Remove subscription do Redis |
| 429 | Transiente | Mantém (retry no próximo cron) |
| 5xx | Transiente | Mantém (retry no próximo cron) |

### 3.4 Toast Feedback

Após cada ação de registro, o app exibe um toast elegante (centralizado, com barra de progresso):

| Cuidado | Mensagem |
|---------|----------|
| Rega | "Registrado! Próxima rega em 2 dias" |
| Sol | "Sol todos os dias!" |
| Adubo | "Registrado! Próximo adubo em 15 dias" |

O toast desaparece automaticamente após 3.5 segundos com animação slideUp.

---

## 4. APIs Serverless

### 4.1 Endpoints

| Método | Path | Descrição | Validação |
|--------|------|-----------|-----------|
| `POST` | `/api/salvar-subscription` | Salva subscription push | Zod + X-API-Key + rate limit |
| `POST` | `/api/sync-events` | Recebe eventos da outbox | Zod + X-API-Key + rate limit |
| `GET` | `/api/verificar-lembretes` | Cron: envia push pendentes | Bearer token |
| `POST` | `/api/test-push` | Dev-only: testa push | X-Test-Token |

### 4.2 Arquitetura Self-Contained

Cada arquivo API é **autocontido** — Vercel não consegue resolver imports locais `./shared/`. Cada endpoint inlineda sua própria conexão Redis via `fetch()` raw ao Upstash REST API. Não há dependência do SDK `@upstash/redis` nas API functions.

### 4.3 Segurança

- **X-API-Key**: Chave estática no header (visível no bundle, aceitável para 50 usuários, bloqueia bots)
- **Timing-safe comparison**: `safeCompare()` — comparação XOR byte-a-byte sem módulo `crypto` do Node (Vercel serverless não expõe)
- **Rate Limit**: Redis INCR + EXPIRE (10 req/min por IP) — aceita race condition leve para 50 usuários
- **Zod**: Validação de todos os inputs
- **CRON_SECRET**: Autenticação do cron em produção
- **VAPID_PRIVATE_KEY**: Nunca exposta ao cliente
- **CSP header**: Adicionado ao `vercel.json` com allowlist para `vercel.live`

### 4.4 Redis (Upstash) — Raw REST

```typescript
// api/shared/redis.ts (inlineda em cada endpoint)
async function redisGet(key: string): Promise<string | null> {
  const res = await fetch(`${UPSTASH_REDIS_REST_URL}/get/${key}`, {
    headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` }
  });
  const data = await res.json();
  return data.result ?? null; // REST retorna string, não objeto
}

// NOTA: redis.get() retorna string do Upstash REST.
// É necessário JSON.parse() para obter o objeto.
const subscription = JSON.parse(await redisGet(`lembrete:${userId}:${tipo}`));
```

### 4.5 Keys Redis

| Padrão de Chave | Conteúdo | TTL |
|-----------------|----------|-----|
| `lembrete:{userId}:{tipo}` | Push subscription + schedule | até processar |
| `processed:{idempotencyKey}` | boolean `true` | 30 dias |
| `event:{eventId}` | Payload do evento | sem TTL |
| `ratelimit:{ip}:{endpoint}` | Contador de requests | 60s |

---

## 5. IndexedDB (Dados Locais)

### 5.1 Database: MeuGirassolDB

| Store | Uso |
|-------|-----|
| `cuidados` | Registros de rega/sol/adubo |
| `lembretes` | Anotações e lembretes do usuário |

### 5.2 Modelos

```typescript
interface Cuidado {
  id: string;
  tipo: 'rega' | 'sol' | 'adubo';
  timestamp: number;       // Epoch ms
  dataFormatada: string;   // DD/MM/YYYY
  criadoEm: number;        // Date.now()
}

interface Lembrete {
  id: string;
  titulo: string;
  mensagem: string;
  dataAgendada: string;    // ISO timestamp
  ativo: boolean;          // soft-delete
  criadoEm: number;        // Date.now()
}
```

### 5.3 Regras

- Dados são **locais apenas** (sem sync entre dispositivos)
- Soft-delete: `ativo: false` (não remove do IndexedDB)
- Dados vinculados ao dispositivo via push subscription
- UUIDs gerados via `crypto.randomUUID()` com fallback

---

## 6. Build e Deploy

### 6.1 Pipeline

```
código fonte
    │
    ├─ tsc (type checking)
    │
    └─ vite build
       ├─ React → bundle JS/CSS
       ├─ vite-plugin-pwa → sw.js + manifest
       └─ workbox → precache manifest com hashes
           │
           └─ dist/
              ├─ index.html
              ├─ assets/index-{hash}.js
              ├─ sw.js
              ├─ workbox-{hash}.js
              └─ manifest.webmanifest
```

### 6.2 Deploy

| Ambiente | Branch | Trigger |
|----------|--------|---------|
| Produção | `main` | `git push origin main` |
| Staging | `staging` | `git push origin main:staging` |

### 6.3 Cron Job (Vercel)

```json
{ "path": "/api/verificar-lembretes", "schedule": "0 11 * * *" }
```

- **Horário**: 11:00 UTC = 08:00 BRT
- **Frequência**: Diária
- **Hobby plan**: Intervalo mínimo de 1 dia entre execuções

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
│     ├─ Envia para /api/sync-events                           │
│     ├─ Marca como "synced" (sucesso)                         │
│     └─ Incrementa retry (falha, máx 5x)                      │
│                                                              │
│  4. Servidor processa                                        │
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
│  1. App (Cliente)                                            │
│     └─ registration.pushManager.subscribe()                  │
│        (gera subscription push)                              │
│                                                              │
│  2. App → /api/salvar-subscription                           │
│     ├─ Valida com Zod                                        │
│     ├─ Rate limit: 10 req/min por IP                         │
│     ├─ Calcula próxima data de disparo                       │
│     └─ Salva no Redis: lembrete:{userId}:{tipo}              │
│                                                              │
│  3. Cron (08:00 BRT)                                         │
│     └─ /api/verificar-lembretes (GET)                        │
│        ├─ Auth: Authorization: Bearer CRON_SECRET            │
│        ├─ Scanneia chaves lembrete:*                         │
│        ├─ Para cada lembrete com dataDisparo <= agora:       │
│        │   ├─ Envia push via web-push                        │
│        │   ├─ Se "sol" (diário): reagenda para próximo dia   │
│        │   └─ Se "rega"/"adubo": remove (one-shot)           │
│        └─ Erro 404/410: remove subscription permanentemente  │
│        └─ Erro 429/5xx: mantém (retry no próximo cron)       │
│                                                              │
│  4. Service Worker                                           │
│     └─ onpush → showNotification()                           │
│                                                              │
│  5. Usuário clica na notificação                             │
│     └─ notificationclick → focus ou openWindow('/')           │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 Headers de Autenticação

| Endpoint | Quem chama | Auth |
|----------|-----------|------|
| `POST /api/salvar-subscription` | Cliente (usuária) | nenhuma (rate limit) |
| `GET /api/verificar-lembretes` | Vercel Cron | `Authorization: Bearer CRON_SECRET` |
| `POST /api/test-push` | Admin (TestarPush) | `X-Test-Token: CRON_SECRET` (produção) |

### 3.3 Classificação de Erros (verificar-lembretes)

| Erro | Tipo | Ação |
|------|------|------|
| 404 | Permanente | Remove subscription do Redis |
| 410 | Permanente | Remove subscription do Redis |
| 429 | Transiente | Mantém (retry no próximo cron) |
| 5xx | Transiente | Mantém (retry no próximo cron) |

---

## 4. APIs Serverless

### 4.1 Endpoints

| Método | Path | Descrição | Validação |
|--------|------|-----------|-----------|
| `POST` | `/api/salvar-subscription` | Salva subscription push | Zod schema |
| `POST` | `/api/sync-events` | Recebe eventos da outbox | Zod schema + max 100 eventos |
| `GET` | `/api/verificar-lembretes` | Cron: envia push pendentes | Bearer token |
| `POST` | `/api/test-push` | Admin: testa push | X-Test-Token |

### 4.2 Segurança

- **Zod**: Validação de todos os inputs
- **Rate Limit**: 10 req/min por IP (in-memory)
- **CRON_SECRET**: Autenticação do cron em produção
- **VAPID_PRIVATE_KEY**: Nunca exposta ao cliente

### 4.3 Redis (Upstash)

| Padrão de Chave | Conteúdo | TTL |
|-----------------|----------|-----|
| `lembrete:{userId}:{tipo}` | Push subscription + schedule | até processar |
| `processed:{idempotencyKey}` | boolean `true` | 30 dias |
| `event:{eventId}` | Payload do evento | sem TTL |

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

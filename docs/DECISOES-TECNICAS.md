# Documento Técnico — Projeto Meu Girassol

> Registro das decisões técnicas, justificativas e arquitetura do projeto.

---

## Sumário

1. [Visão Geral](#1-visão-geral)
2. [Stack Tecnológica](#2-stack-tecnológica)
3. [Arquitetura do Sistema](#3-arquitetura-do-sistema)
4. [Armazenamento — Offline-First](#4-armazenamento--offline-first)
5. [Padrão Outbox — Sincronização](#5-padrão-outbox--sincronização)
6. [Service Worker e Atualização Silenciosa](#6-service-worker-e-atualização-silenciosa)
7. [Push Notifications — Web Push](#7-push-notifications--web-push)
8. [PWA — Ícones e Manifesto](#8-pwa--ícones-e-manifesto)
9. [API Serverless — Vercel Functions](#9-api-serverless--vercel-functions)
10. [Validação com Zod](#10-validação-com-zod)
11. [Testes](#11-testes)
12. [Deploy e Infraestrutura](#12-deploy-e-infraestrutura)
13. [Fluxos Críticos](#13-fluxos-críticos)
14. [Decisões de Design](#14-decisões-de-design)
15. [Problemas Encontrados e Soluções](#15-problemas-encontrados-e-soluções)
---

## 1. Visão Geral

**Meu Girassol** é um Progressive Web App (PWA) que funciona como diário interativo de cuidados com girassóis. O app guia o usuário através de três ciclos de cuidado:

| Cuidado | Descrição | Intervalo |
|---------|-----------|-----------|
| **Rega** | Irrigação da planta | A cada 2 dias |
| **Sol** | Exposição solar | Diário |
| **Adubo** | Fertilização | A cada 15 dias |

**Princípios Fundamentais:**
- **Offline-first**: Nenhuma ação do usuário é perdida, mesmo sem conexão
- **Sincronização invisível**: O usuário não precisa realizar nenhuma ação manual para sincronizar
- **Sem autenticação**: Dados vinculados ao dispositivo via subscription push (sem login)
- **Acessibilidade**: Interface simples, linguagem coloquial, destinada a usuários não-técnicos

---

## 2. Stack Tecnológica

### Frontend

| Tecnologia | Versão | Justificativa |
|------------|--------|---------------|
| **React** | ^18.2.0 | Ecossistema maduro, componentes reutilizáveis, suporte a hooks |
| **TypeScript** | ^5.3.3 | Type safety, detecção de erros em compile-time, IntelliSense |
| **Vite** | ^5.0.10 | Build rápido (ESM nativo), HMR instantâneo, configuração mínima |
| **vite-plugin-pwa** | ^0.17.4 | Geração automática do Service Worker via Workbox, manifest JSON |

### Backend

| Tecnologia | Justificativa |
|------------|---------------|
| **Vercel Serverless Functions** | Zero config, escala automática, integrado com deploy |
| **Vercel KV (Upstash Redis)** | KV store gerenciado, baixa latência, sem infraestrutura |
| **web-push** | Padrão W3C para Web Push, suporte VAPID |

### Dados

| Tecnologia | Justificativa |
|------------|---------------|
| **localforage** | Wrapper sobre IndexedDB com fallback, API simples |
| **IndexedDB** | Armazenamento nativo do navegador, suporte offline, grande capacidade |

### Validação

| Tecnologia | Justificativa |
|------------|---------------|
| **Zod** | Validação runtime com TypeScript inference, schemas declarativos |

### Testes

| Tecnologia | Justificativa |
|------------|---------------|
| **Jest** | Runner maduro, suporte ESM (experimental), jsdom |
| **ts-jest** | Transformação TypeScript para Jest |
| **@testing-library/react** | Testes de componentes React seguindo best practices |

---

## 3. Arquitetura do Sistema

### 3.1 Estrutura de Camadas

```
┌─────────────────────────────────────────────────────┐
│                   INTERFACE (UI)                     │
│  React Components + Views + Contexts                │
├─────────────────────────────────────────────────────┤
│                 CASOS DE USO                        │
│  registrar-cuidado, buscar-historico,               │
│  gerenciar-lembretes, agendar-notificacao,          │
│  notificacao-nativa                                 │
├─────────────────────────────────────────────────────┤
│              DADOS LOCAIS (IndexedDB)               │
│  cuidados | lembretes | outbox                      │
├─────────────────────────────────────────────────────┤
│           SINCRONIZAÇÃO (Outbox + Sync)             │
│  SyncContext → triggerSync → API                    │
├─────────────────────────────────────────────────────┤
│              API SERVERLESS (Vercel)                │
│  salvar-subscription | sync-events |                │
│  verificar-lembretes (cron)                         │
├─────────────────────────────────────────────────────┤
│              SERVIDOR (Upstash Redis)               │
│  lembrete:* | processed:* | event:*                 │
└─────────────────────────────────────────────────────┘
```

### 3.2 Organização de Diretórios

```
src/
├── core/                    # Lógica de negócio
│   ├── contexts/            # React Contexts (estado global)
│   ├── database/            # Acesso a dados (IndexedDB, Outbox)
│   ├── hooks/               # Hooks React (useServiceWorkerUpdate)
│   ├── types/               # Tipos TypeScript
│   └── use-cases/           # Funções de lógica de negócio
├── ui/                      # Apresentação
│   ├── components/          # Componentes reutilizáveis
│   └── views/               # Componentes de página
└── __tests__/               # Testes unitários
```

### 3.3 Decisão: Clean Architecture Leve

**Justificativa:** O projeto é pequeno-médio, então uma Clean Architecture completa seria overhead. Adotou-se uma separação leve:
- `core/` contém lógica de negócio pura (sem dependência de UI)
- `ui/` contém componentes React
- `use-cases/` são funções puras que orquestram operações

**Alternativa descartada:** Modular monolith com barrels e dependency injection — complexidade desnecessária para o escopo.

---

## 4. Armazenamento — Offline-First

### 4.1 Escolha: IndexedDB via localforage

**Decisão:** Usar `localforage` como wrapper sobre IndexedDB.

**Justificativa:**
- API simples e assíncrona (`getItem`, `setItem`, `removeItem`)
- Fallback automático para WebSQL/LSD (irrelevante hoje, mas seguro)
- Suporte a múltiplos stores no mesmo database
- Não requer configuração de schema (diferente de SQLite)

**Alternativas descartadas:**
| Alternativa | Motivo da rejeição |
|-------------|-------------------|
| **localStorage** | Limite de 5MB, síncrono, bloqueia main thread |
| **SQLite (via sql.js)** | Overhead excessivo para o escopo do projeto |
| **Dexie.js** | API mais complexa, sem benefício claro sobre localforage |
| **Firebase/PocketBase** | Requer backend próprio, autenticação, custo |

### 4.2 Stores

```typescript
// localforage-db.ts
const MeuGirassolDB = localforage.createInstance({
  name: 'MeuGirassolDB',
  storeName: 'cuidados'    // Store principal
});

const LembretesDB = localforage.createInstance({
  name: 'MeuGirassolDB',
  storeName: 'lembretes'   // Store de lembretes
});
```

**Cuidados Store:**
```typescript
interface Cuidado {
  id?: string;
  tipo: 'rega' | 'sol' | 'adubo';
  timestamp: string;       // ISO timestamp
  dataFormatada: string;   // DD/MM/YYYY
  criadoEm: number;        // Date.now()
}
```

**Lembretes Store:**
```typescript
interface Lembrete {
  id?: string;
  titulo: string;
  mensagem: string;
  dataAgendada: string;    // ISO timestamp
  ativo: boolean;          // soft-delete
  criadoEm: number;        // Date.now() — exibido na UI
}
```

### 4.3 Decisão: Sem Sincronização automática de dados IndexedDB

**Decisão:** Os dados IndexedDB são **locais apenas**. Não há sincronização entre dispositivos.

**Justificativa:**
- O app não possui autenticação de usuário
- Dados estão vinculados ao dispositivo via push subscription
- Sincronização entre dispositivos exigiria backend complexo + auth
- Para o caso de uso (diário pessoal), dados locais são suficientes

---

## 5. Padrão Outbox — Sincronização

### 5.1 Conceito

O **Outbox Pattern** garante que nenhuma ação do usuário seja perdida, mesmo offline:

```
1. Usuário registra cuidado
2. Dados são salvos no IndexedDB (cuidados store)
3. Evento é criado na outbox (status: pending)
4. Quando online, sincronizador processa a outbox
5. Evento é enviado para API → Redis
6. Evento é removido da outbox
```

### 5.2 Estrutura do Evento

```typescript
interface OutboxEvent {
  id: string;
  type: 'care_registered' | 'care_deleted' | 'reminder_created' | 'reminder_deleted';
  payload: Record<string, unknown>;
  status: 'pending' | 'processing' | 'synced' | 'failed';
  retryCount: number;
  maxRetries: number;        // Default: 5
  createdAt: string;          // ISO timestamp
  updatedAt: string;
  idempotencyKey: string;     // Chave única para prevenir duplicatas
}
```

### 5.3 Fluxo de Sincronização

```typescript
// SyncContext.tsx
const triggerSync = async () => {
  if (!navigator.onLine) return;

  const eventos = await obterEventosPendentes();

  for (const evento of eventos) {
    await marcarProcessando(evento.id);

    try {
      await fetch('/api/sync-events', {
        method: 'POST',
        body: JSON.stringify({ events: [evento] })
      });
      await marcarSincronizado(evento.id);
    } catch {
      await incrementarRetry(evento.id);
    }
  }
};
```

### 5.4 Decisão: Polling vs Event-Driven

**Decisão:** Polling a cada 5 segundos (quando online) + detecção de visibilidade.

**Justificativa:**
- `navigator.onLine` é unreliable (pode retornar `true` sem conexão real)
- Polling garante que eventos pendentes sejam processados
- Detecção de `visibilitychange` dispara sync quando app fica visível

**Alternativa descartada:**
- **Background Sync API**: Suporte limitado (apenas Chrome), complexidade desnecessária para o escopo

### 5.5 Idempotência

**Problema:** Se a sincronização falhar após o servidor processar o evento, o cliente reenviará o mesmo evento.

**Solução:** Chave de idempotência (`idempotencyKey`) composta por `care_{tipo}_{timestamp}`.

```typescript
// Server-side (sync-events.ts)
import { getRedis } from './_shared/redis-client';

const kv = getRedis();
const jaProcessado = await kv.get(`processed:${idempotencyKey}`);
if (jaProcessado) {
  return { status: 'duplicate' };
}
await kv.set(`processed:${idempotencyKey}`, true, { ex: 86400 * 30 }); // 30 dias TTL
```

### 5.6 Limpeza da Outbox

Eventos com status `synced` são removidos automaticamente. Eventos `failed` após 5 retentativas são removidos com log de erro.

---

## 6. Service Worker e Atualização Silenciosa

### 6.1 Estratégia: generateSW

**Decisão:** Usar `generateSW` do Workbox (via vite-plugin-pwa) em vez de `injectManifest`.

**Justificativa:**
- `generateSW` gera o SW automaticamente com precaching
- Menos código para manter
- Workbox lida com caching strategies automaticamente

**Quando usar `injectManifest`:**
- Quando precisa de controle total sobre o SW
- Para apps com lógica complexa no SW (ex: background sync)

### 6.2 Configuração Atual: prompt

```typescript
// vite.config.ts
registerType: 'prompt'        // SW não toma controle automático
clientsClaim: false            // SW NÃO assume controle imediatamente
skipWaiting: false             // SW NÃO pula estado "waiting"
```

**Comportamento:** O SW é registrado mas NÃO ativa automaticamente. A ativação ocorre apenas quando o hook `useServiceWorkerUpdate` envia a mensagem `SKIP_WAITING` (em background).

### 6.3 Mecanismo de Atualização — Hook useServiceWorkerUpdate

A atualização é controlada por um hook React dedicado (`src/core/hooks/useServiceWorkerUpdate.ts`):

```typescript
// useServiceWorkerUpdate.ts
const INITIAL_CHECK_DELAY_MS = 3_000;      // 3 segundos após montar
const PERIODIC_CHECK_INTERVAL_MS = 30 * 60 * 1000;  // 30 minutos
const VISIBLE_THROTTLE_MS = 60_000;        // throttle de 60s no visible

// Fluxo:
// 1. checkForUpdate() → reg.update() → detecta novo sw.js
// 2. Se reg.waiting → status: 'available'
// 3. Em background (hidden) → envia SKIP_WAITING
// 4. controllerchange → window.location.reload()
```

**Ciclo completo:**

```
App carrega → registerSW({ immediate: true })
    ↓
App monta → useServiceWorkerUpdate()
    ↓
3s → checkForUpdate() → reg.update()
    ↓
A cada 30min → re-verifica
    ↓
visibilitychange (hidden) → SKIP_WAITING → SW ativa
    ↓
controllerchange → reload (uma única vez)
```

### 6.4 Workbox Config

```typescript
workbox: {
  clientsClaim: false,           // SW NÃO assume controle imediatamente
  skipWaiting: false,            // SW espera mensagem para ativar
  cleanupOutdatedCaches: true,   // Remove caches antigos
  importScripts: ['/sw-custom.js'], // Push notifications + SKIP_WAITING listener
}
```

**Decisão: `prompt` com `clientsClaim: false` e `skipWaiting: false`**

- O SW antigo (com `autoUpdate` + `clientsClaim: true`) já estava no dispositivo do usuário
- A mudança para `prompt` garante que novas atualizações sejam silenciosas e não interrompam o usuário
- A detecção de versão é por comparação byte a byte do `sw.js` (precache manifest com hashes MD5)
- Compatível com SW antigo: o browser detecta o novo `sw.js` e instala normalmente

### 6.5 Cache Headers (Vercel)

```json
{
  "source": "/sw.js",
  "headers": [{ "key": "Cache-Control", "value": "public, max-age=0, must-revalidate" }]
}
```

**Justificativa:** Service Worker e manifest devem sempre ser revalidados para detectar novas versões.

---

## 7. Push Notifications — Web Push

### 7.1 Arquitetura

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  App (Client) │────▶│  API (Vercel) │────▶│  Upstash KV  │
│  subscribe()  │     │  salvar-      │     │  lembrete:*  │
│               │     │  subscription │     │              │
└──────────────┘     └──────┬───────┘     └──────────────┘
                            │
                     ┌──────▼───────┐
                     │  Cron (08:00) │
                     │  verificar-   │
                     │  lembretes    │
                     └──────┬───────┘
                            │
                     ┌──────▼───────┐
                     │  Web Push     │
                     │  Protocol     │
                     └──────────────┘
```

### 7.2 VAPID Keys

- **Public key**: via `getVapidPublicKey()` — lê de `import.meta.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY` (deferred check, sem throw no load do módulo)
- **Private key**: Armazenada apenas no servidor (variável de ambiente `VAPID_PRIVATE_KEY`)
- **Servidor**: Upstash Redis (via `@upstash/redis`)

### 7.3 Fluxo de Notificação

1. **Cliente**: Registra subscription push via `registration.pushManager.subscribe()`
2. **Cliente**: Envia subscription para `/api/salvar-subscription`
3. **Servidor**: Calcula próxima data de disparo baseada no tipo de cuidado
4. **Servidor**: Armazena no Upstash Redis como `lembrete:{userId}:{tipo}`
5. **Cron (08:00 BRT)**: Verifica lembretes pendentes e envia push
6. **Cliente**: SW recebe push e exibe notificação nativa

### 7.4 Decoupling: Notificação vs UI

**Decisão:** A agendamento de notificação (`agendarLembrete`) é fire-and-forget.

```typescript
// AgendaBox.tsx
const handleAgendar = async (tipo) => {
  await registrarCuidadoComOutbox(cuidado);  // UI atualiza primeiro
  await carregarCountdowns();                 // Countdown atualiza

  agendarLembrete(tipo).catch(() => {});     // Notificação é fire-and-forget
};
```

**Justificativa:** Se a notificação falhar, o cuidado já foi registrado. O usuário não deve ser bloqueado por falha de push.

### 7.5 Tipos de Notificação

| Tipo | Título | Corpo | Intervalo |
|------|--------|-------|-----------|
| Rega | "Hora de regar! 🌱" | "Seu girassol precisa de água..." | 2 dias |
| Sol | "Sol para o girassol! ☀️" | "Seu girassol precisa de luz solar..." | 1 dia |
| Adubo | "Adubo para crescer! 🌿" | "Hora de adubar seu girassol..." | 15 dias |

### 7.6 Cron Job

```json
{ "path": "/api/verificar-lembretes", "schedule": "0 11 * * *" }
```

**Horário:** 11:00 UTC = 08:00 BRT (horário ideal para notificação matinal).

**Autenticação:** `Authorization: Bearer {CRON_SECRET}` (apenas em produção).

---

## 8. PWA — Ícones e Manifesto

### 8.1 Manifesto Web App

```json
{
  "name": "Meu Girassol",
  "short_name": "Girassol",
  "theme_color": "#D98E04",
  "background_color": "#D98E04",
  "display": "standalone",
  "icons": [
    { "src": "icon-192.png", "sizes": "192x192", "purpose": "any" },
    { "src": "icon-512.png", "sizes": "512x512", "purpose": "any" },
    { "src": "icon-maskable-192.png", "sizes": "192x192", "purpose": "maskable" },
    { "src": "icon-maskable-512.png", "sizes": "512x512", "purpose": "maskable" }
  ]
}
```

### 8.2 Decisão: Dois Conjuntos de Ícones

**Problema:** Android aplica máscara circular em ícones PWA. Se o ícone tem cantos transparentes, aparecem bordas brancas.

**Solução:** Dois conjuntos com propósitos diferentes:

| Ícone | `purpose` | Comportamento |
|-------|-----------|---------------|
| `icon-*.png` | `any` | Exibido sem máscara (navegadores desktop) |
| `icon-maskable-*.png` | `maskable` | Android aplica máscara — girassol ocupa 80% do canvas |

### 8.3 Geração de Ícones Maskable

```python
# Girassol ocupa 80% do canvas (zona segura do Android)
CANVAS = 512
SAFE_ZONE = 0.80
target_size = int(CANVAS * SAFE_ZONE)  # 410px

# Conteúdo centralizado em fundo azul
maskable = Image.new('RGBA', (512, 512), (55, 150, 218, 255))
maskable.paste(content_resized, (offset_x, offset_y), content_resized)
```

### 8.4 Decisão: Fundo Azul Sólido nos Ícones

**Problema:** Cantos transparentes causavam bordas brancas no Android.

**Solução:** Preencher cantos com a mesma cor azul do fundo da imagem `(55, 150, 218)`.

**Alternativas descartadas:**
- Cantos transparentes: Android preenche com branco
- Cantos pretos: Visíveis em temas claros
- Usar `background_color` do manifest: Não afeta ícones individualmente

### 8.5 Splash Screen

```html
<!-- index.html -->
<body style="background-color: #D98E04">
```

```json
// manifest
"theme_color": "#D98E04",
"background_color": "#D98E04"
```

**Justificativa:** O Android usa `background_color` para a splash screen. Laranja (#D98E04) mantém consistência visual.

---

## 9. API Serverless — Vercel Functions

### 9.1 Endpoints

| Método | Path | Descrição | Validação |
|--------|------|-----------|-----------|
| `POST` | `/api/salvar-subscription` | Salva subscription push no Upstash Redis | Zod + rate limit |
| `POST` | `/api/sync-events` | Recebe eventos da outbox do cliente | Zod + rate limit + max 100 |
| `GET` | `/api/verificar-lembretes` | Cron: envia notificações pendentes | Bearer token |
| `POST` | `/api/test-push` | Admin: testa push notification | `X-Test-Token: CRON_SECRET` |

### 9.2 Redis Client: @upstash/redis

**Decisão:** Migrar de `@vercel/kv` para `@upstash/redis` (Vercel deprecou `@vercel/kv`, recomendou migração).

```typescript
// api/_shared/redis-client.ts
import { Redis } from '@upstash/redis';

let redisInstance: Redis | null = null;

export function getRedis(): Redis {
  if (!redisInstance) {
    redisInstance = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return redisInstance;
}

// Para testes: injetável sem ESM mocking
export function _setRedisForTests(redis: Redis | null): void {
  redisInstance = redis;
}
```

**Justificativa:**
- Factory injetável permite testes sem complexidade de ESM mocking
- `@upstash/redis` é o SDK oficial do Upstash (Vercel recomenda via Marketplace)
- Conexão lazy (criada sob demanda, não no import do módulo)

### 9.3 Estrutura de uma Function

```typescript
// api/salvar-subscription.ts
import { getRedis } from './_shared/redis-client';
import { z } from 'zod';
import { rateLimit } from './_shared/rate-limit';

const BodySchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string()
  })
});

export default async function handler(req: NextRequest) {
  if (req.method !== 'POST') {
    return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const rate = rateLimit(req);
  if (!rate.ok) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const body = BodySchema.parse(await req.json());
  const kv = getRedis();
  // ... lógica de negócio
  return NextResponse.json({ success: true });
}
```

### 9.4 Armazenamento no Upstash Redis

| Key Pattern | Valor | TTL |
|-------------|-------|-----|
| `lembrete:{userId}:{tipo}` | Subscription + schedule | Até processar |
| `processed:{idempotencyKey}` | `true` | 30 dias |
| `event:{eventId}` | Dados do evento | Sem TTL |

**User ID:** Base64 do endpoint push (seudo-anônimo, sem login).

### 9.5 Segurança

- **CRON_SECRET**: Autentica o cron job e endpoint de teste (apenas em produção)
- **VAPID_PRIVATE_KEY**: Nunca exposta ao cliente
- **Rate Limit**: 10 req/min por IP (in-memory, por endpoint)
- **Zod**: Validação de todos os inputs
- **Classificação de erros**: 404/410 = permanente (remove subscription), 429/5xx = transiente (mantém)

---

## 10. Validação com Zod

### 10.1 Schemas

```typescript
// Registrar Cuidado
const CuidadoSchema = z.object({
  tipo: z.enum(['rega', 'sol', 'adubo']),
  timestamp: z.number().positive(),
  dataFormatada: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/),
});

// Gerenciar Lembrete
const LembreteSchema = z.object({
  titulo: z.string().min(1).max(100),
  mensagem: z.string().min(1).max(500),
  dataAgendada: z.string().datetime(),
});
```

### 10.2 Decisão: Zod vs Yup vs Joi

**Justificativa para Zod:**
- Inferência de tipos TypeScript automática (`z.infer<typeof schema>`)
- API declarativa e functional
- Leve (~14KB gzipped)
- Sem dependências externas

**Alternativas descartadas:**
- **Yup**: Sem inferência automática de tipos
- **Joi**: Maior (~130KB), foco em server-side
- **io-ts**: Mais complexo, curva de aprendizado maior

---

## 11. Testes

### 11.1 Configuração

```typescript
// jest.config.ts
export default {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.spec.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.json', useESM: true }]
  },
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
};
```

### 11.2 Suítes de Teste

| Suíte | Testes | O que valida |
|-------|--------|--------------|
| `outbox.spec.ts` | 13 | CRUD da outbox, retentativas, limpeza, ordenação |
| `sincronizador.spec.ts` | 10 | Fluxo online/offline, idempotência, limpeza |
| `offline-integracao.spec.ts` | 5 | Integração outbox + IndexedDB |
| `notificacao-push.spec.ts` | 8 | Cálculos de countdown, títulos/descrições |
| `notificacao-nativa.spec.ts` | 4 | Conteúdo de notificações nativas |
| `registrar-cuidado.spec.ts` | 4 | Validação Zod (tipos válidos/inválidos) |
| `gerenciar-lembretes.spec.ts` | 4 | Validação Zod para lembretes |
| `agendar-notificacao.spec.ts` | 3 | Geração de URL do Google Calendar |
| `build.spec.ts` | 5 | Existência de artefatos de build |
| `useServiceWorkerUpdate.spec.ts` | 11 | Hook de atualização SW |
| `redis-client.spec.ts` | 6 | Redis factory injetável |
| `validation.spec.ts` | 10 | Schemas Zod para APIs |
| `rate-limit.spec.ts` | 6 | Rate limiting por IP |
| `test-push-endpoint.spec.ts` | 9 | Endpoint de teste push |
| `sw-custom.spec.ts` | 8 | SW custom (push, notificationclick, SKIP_WAITING) |

**Total: 15 suítes, 108 testes**

### 11.3 Comandos

```bash
npm test                    # Executa todos os testes
npm run test:coverage       # Com relatório de cobertura
npm run lint                # Type checking (tsc --noEmit)
```

### 11.4 Cobertura

Cobertura coletada apenas para `src/core/**/*.ts` (lógica de negócio), excluindo UI e testes.

---

## 12. Deploy e Infraestrutura

### 12.1 Plataforma: Vercel

| Ambiente | Branch | URL |
|----------|--------|-----|
| Produção | `main` | Dominio configurado |
| Staging | `staging` | Vercel Preview URL |

### 12.2 Build

```bash
npm run build    # tsc && vite build → dist/
```

**Saída:**
- `dist/` — Assets estáticos
- `dist/sw.js` — Service Worker gerenciado pelo Workbox
- `dist/manifest.webmanifest` — Manifesto PWA

### 12.3 Variáveis de Ambiente

| Variável | Escopo | Descrição |
|----------|--------|-----------|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Cliente + Servidor | Chave pública VAPID |
| `VAPID_PRIVATE_KEY` | Servidor | Chave privada VAPID |
| `UPSTASH_REDIS_REST_URL` | Servidor | URL Upstash Redis |
| `UPSTASH_REDIS_REST_TOKEN` | Servidor | Token Upstash Redis |
| `CRON_SECRET` | Servidor | Segredo para autenticação do cron e test-push |

### 12.4 Cron Job

```json
{ "path": "/api/verificar-lembretes", "schedule": "0 11 * * *" }
```

- **Horário**: 11:00 UTC = 08:00 BRT
- **Frequência**: Diária
- **Ação**: Verifica lembretes pendentes e envia push notifications

---

## 13. Fluxos Críticos

### 13.1 Fluxo: Registrar Cuidado (Online)

```
1. Usuário clica em "Registra"
2. registrarCuidadoComOutbox() executado:
   a. Valida dados com Zod
   b. Salva cuidado no IndexedDB (cuidados store)
   c. Cria evento na outbox (status: pending)
3. agendarLembrete() executado (fire-and-forget):
   a. Obtém subscription push
   b. Calcula próxima data (hoje + 2 dias)
   c. Envia para /api/salvar-subscription
   d. Servidor salva no Upstash Redis
4. UI atualiza: countdown, último cuidado
5. SyncContext detecta evento pendente → sync automático
```

### 13.2 Fluxo: Registrar Cuidado (Offline)

```
1. Usuário clica em "Registra"
2. registrarCuidadoComOutbox() executado:
   a. Valida dados com Zod
   b. Salva cuidado no IndexedDB
   c. Cria evento na outbox (status: pending)
3. agendarLembrete() falha (sem conexão) — catch silencioso
4. UI atualiza normalmente (dados locais)
5. SyncStatus mostra "offline"
6. Quando online:
   a. SyncContext detecta conectividade
   b. triggerSync() processa outbox
   c. Eventos enviados para API
   d. SyncStatus mostra "sincronizado"
```

### 13.3 Fluxo: Atualização do Service Worker

```
1. App carrega → registerSW({ immediate: true })
   (registra SW mas NÃO força atualização)

2. App monta → useServiceWorkerUpdate()
   (hook assume o ciclo de verificação)

3. Após 3 segundos → checkForUpdate() → reg.update()
   (Workbox verifica byte a byte se há novo sw.js)

4. Se houver novo SW → entra em estado "waiting"
   (não ativa automaticamente)

5. A cada 30 minutos → re-verificação periódica

6. Usuário muda de aba (visibilitychange → hidden):
   → envia SKIP_WAITING ao SW waiting
   → SW ativa

7. controllerchange dispara → window.location.reload()
   (reload UMA única vez, guarded por refreshingRef)

8. App recarrega com o SW novo
```

### 13.4 Fluxo: Push Notification

```
1. Cron (08:00 BRT) executa /api/verificar-lembretes
2. Auth: Authorization: Bearer CRON_SECRET
3. Servidor scanneia chaves lembrete:* no Upstash Redis
4. Para cada lembrete com dataDisparo <= agora:
   a. Envia push via web-push library
   b. Se "sol" (diário): reagenda para próximo dia
   c. Se "rega"/"adubo": remove chave (one-shot)
   d. Erro 404/410: remove subscription (permanente)
   e. Erro 429/5xx: mantém (retry no próximo cron)
5. SW recebe push → exibe notificação nativa
6. Usuário clica na notificação → app abre/foca
```

---

## 14. Decisões de Design

### 14.1 Layout: Pétalas/Folhas

**Decisão:** Interface orgânica com botões de cuidado em formato de pétalas/folhas, mantendo o layout original do protótipo `girassol.html`.

**Justificativa:** Conexão visual com o tema de girassol, tornando a experiência mais envolvente.

### 14.2 Navegação: Hamburger Menu

**Decisão:** Menu hamburguer lateral em vez de tabs inferiores.

**Justificativa:** Economiza espaço vertical, mantendo a界面 limpa para o conteúdo principal.

### 14.3 Textarea com Auto-Resize

**Decisão:** Input de anotações é um textarea que cresce com o texto.

```typescript
// DiarioView.tsx
const autoResize = () => {
  const el = textoRef.current;
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 100) + 'px';
};
```

**Justificativa:** Melhor UX para anotações longas, sem ocupar espaço desnecessário quando vazio.

### 14.4 Modal de Boas-Vindas

**Decisão:** Modal aparece quando há tipos de cuidado sem registros.

```typescript
const tiposSemRegistro = await obterTiposSemRegistro();
if (tiposSemRegistro.length > 0) {
  setShowModal(true);
}
```

**Justificativa:** Guia novos usuários sem ser intrusivo (aparece apenas quando necessário).

### 14.5 Cores

| Cor | Código | Uso |
|-----|--------|-----|
| Laranja | `#D98E04` | Tema principal, header, splash |
| Creme | `#FFFDF9` | Fundo |
| Marrom escuro | `#3C2A21` | Texto principal |
| Azul | `#3796DC` | Ícone, links |
| Verde | `#6AAF50` | Sucesso |
| Vermelho | `#E63946` | Erro, delete |

---

## 15. Problemas Encontrados e Soluções

### 15.1 Race Condition na Atualização do SW

**Problema:** `registration.update()` retornava antes do SW atingir estado `installed`. Verificar `registration.installing` imediatamente resultava em `null`.

**Solução:** O hook `useServiceWorkerUpdate` usa `checkInFlightRef` para evitar chamadas simultâneas, e verifica `reg.waiting` após `reg.update()`:

```typescript
// useServiceWorkerUpdate.ts
const checkForUpdate = useCallback(async () => {
  if (checkInFlightRef.current) return;  // previne concorrência
  checkInFlightRef.current = true;

  const reg = await navigator.serviceWorker.ready;
  await reg.update();
  if (reg.waiting) {
    setState({ status: 'available' });
  }
  checkInFlightRef.current = false;
}, []);
```

### 15.2 Tipo ServiceWorkerState

**Problema:** `ServiceWorkerState` TypeScript não inclui `'waiting'` como valor válido.

**Solução:** Usar `'installed'` em vez de `'waiting'` para type-checking, já que `waiting` é o estado após `installed`.

### 15.3 Border Brancas nos Ícones PWA

**Problema:** Android preenchia cantos transparentes com branco ao aplicar máscara circular.

**Solução:**
1. Criar ícones `maskable` com girassol ocupando 80% do canvas
2. Preencher fundo com cor azul sólida `(55, 150, 218)`
3. Usar `purpose: 'any'` para ícones sem máscara

### 15.4 Notificação Bloqueando UI

**Problema:** `agendarLembrete()` era `await` antes de atualizar UI, bloqueando o fluxo se push falhasse.

**Solução:** Fire-and-forget:

```typescript
registrarCuidadoComOutbox(cuidado);  // UI atualiza
carregarCountdowns();                 // Countdown atualiza
agendarLembrete(tipo).catch(() => {}); // Notificação é silenciosa
```

### 15.5 Datas Duplicadas no Countdown

**Problema:** "Último Cuidado" e "Próximo Lembrete" mostravam a mesma data.

**Solução:** Funções separadas:
- `obterUltimoCuidado()`: Retorna "Hoje", "Ontem" ou data (DD/MM/YYYY)
- `obterProximoLembrete()`: Retorna DD/MM/YYYY ou "Vence hoje!"

### 15.6 SyncContext Travado em "Syncing"

**Problema:** `atualizarEstado` não chamava `triggerSync()` quando detectava eventos pendentes enquanto online.

**Solução:**

```typescript
if (online && eventosPendentes > 0) {
  setSyncState({ status: 'syncing', pendingEvents: eventosPendentes });
  triggerSync(); // Dispara sincronização
}
```

### 9.6 Endpoints de teste vs produção

| Endpoint | Quem chama | Auth |
|---|---|---|
| `POST /api/salvar-subscription` | Cliente da usuária (em produção) | nenhuma (rate limit) |
| `GET /api/verificar-lembretes` | Vercel Cron | `Authorization: Bearer CRON_SECRET` |
| `POST /api/test-push` | `TestarPush.tsx` (admin) | `X-Test-Token: CRON_SECRET` em produção |

---

## Apêndice A: Comandos Úteis

```bash
# Desenvolvimento
npm run dev              # Inicia servidor de desenvolvimento

# Build
npm run build            # Build de produção
npm run preview          # Preview do build

# Testes
npm test                 # Executa todos os testes
npm run test:coverage    # Com cobertura
npm run lint             # Type checking

# Deploy
git push origin main     # Deploy automático (Vercel)
git push origin main:staging  # Deploy para staging
```

## Apêndice B: Dependências

### Produção
- `react` ^18.2.0
- `react-dom` ^18.2.0
- `localforage` ^1.10.0
- `zod` ^3.22.4
- `@upstash/redis` ^1.38.0
- `web-push` ^3.6.7

### Desenvolvimento
- `typescript` ^5.3.3
- `vite` ^5.0.10
- `vite-plugin-pwa` ^0.17.4
- `jest` ^29.7.0
- `ts-jest` ^29.1.1
- `@testing-library/react` ^14.1.2
- `@testing-library/jest-dom` ^6.1.5

---

*Documento gerado em 16/06/2026 — Projeto Meu Girassol v1.0.0*

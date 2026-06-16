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
  id: string;              // UUID
  tipo: 'rega' | 'sol' | 'adubo';
  timestamp: number;       // Epoch ms
  dataFormatada: string;   // DD/MM/YYYY
  criadoEm: string;        // ISO timestamp
}
```

**Lembretes Store:**
```typescript
interface Lembrete {
  id: string;
  titulo: string;
  mensagem: string;
  dataAgendada: string;    // ISO timestamp
  ativo: boolean;
  criadoEm: string;
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

### 6.2 Registro: autoUpdate

```typescript
registerType: 'autoUpdate'
```

**Comportamento:** O SW verifica atualizações a cada carregamento de página. Se houver nova versão, ativa automaticamente (quando o app estiver em background).

### 6.3 Atualização Silenciosa — O Problema

**Problema:** Se o SW ativar enquanto o usuário está usando o app, `clientsClaim()` forçaria reload, perdendo estado (texto em textarea, etc.).

**Solução: Ciclo de Atualização em Background**

```typescript
// App.tsx
const handleVisibility = async () => {
  if (document.visibilityState === 'hidden') {
    // App foi para background — seguro para atualizar
    const registration = await navigator.serviceWorker.ready;
    await registration.update();

    if (registration.waiting) {
      // SW já está esperando — ativar imediatamente
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }

    if (registration.installing) {
      // SW está instalando — aguardar estado 'installed'
      registration.installing.addEventListener('statechange', (e) => {
        if ((e.target as ServiceWorker).state === 'installed') {
          (e.target as ServiceWorker).postMessage({ type: 'SKIP_WAITING' });
        }
      });
    }
  }

  if (document.visibilityState === 'visible') {
    // App voltou — verificar se SW mudou
    const controllerAtual = navigator.serviceWorker.controller;
    if (controllerAtual && controllerAtual !== swAtualController) {
      window.location.reload(); // Reload seguro — app estava em background
    }
  }
};
```

### 6.4 Workbox Config

```typescript
workbox: {
  clientsClaim: true,            // SW assume controle imediatamente
  cleanupOutdatedCaches: true,   // Remove caches antigos
  importScripts: ['/sw-custom.js'], // Push notifications
  // NÃO usar skipWaiting: true — controle manual via mensagem
}
```

**Decisão: Não usar `skipWaiting: true`**

Se `skipWaiting` estivesse habilitado, o SW ativaria imediatamente ao terminar de instalar, possivelmente recarregando o app durante uso. O controle manual via mensagem `SKIP_WAITING` permite ativar apenas quando o app está em background.

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

- **Public key**: Hardcoded no cliente (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`)
- **Private key**: Armazenada apenas no servidor (variável de ambiente)
- **Servidor**: Upstash Redis (via Vercel KV)

### 7.3 Fluxo de Notificação

1. **Cliente**: Registra subscription push via `registration.pushManager.subscribe()`
2. **Cliente**: Envia subscription para `/api/salvar-subscription`
3. **Servidor**: Calcula próxima data de disparo baseada no tipo de cuidado
4. **Servidor**: Armazena no KV como `lembrete:{userId}:{tipo}`
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

| Método | Path | Descrição |
|--------|------|-----------|
| `POST` | `/api/salvar-subscription` | Salva subscription push no KV |
| `POST` | `/api/sync-events` | Recebe eventos da outbox do cliente |
| `GET` | `/api/verificar-lembretes` | Cron: envia notificações pendentes |

### 9.2 Estrutura de uma Function

```typescript
// api/salvar-subscription.ts
import { kv } from '@vercel/kv';
import { NextRequest, NextResponse } from 'next/server';

export default async function handler(req: NextRequest) {
  if (req.method !== 'POST') {
    return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const body = await req.json();
  // ... lógica de negócio
  return NextResponse.json({ success: true });
}
```

### 9.3 Armazenamento no KV

| Key Pattern | Valor | TTL |
|-------------|-------|-----|
| `lembrete:{userId}:{tipo}` | Subscription + schedule | Até processar |
| `processed:{idempotencyKey}` | `true` | 30 dias |
| `event:{eventId}` | Dados do evento | Sem TTL |

**User ID:** Base64 do endpoint push (seudo-anônimo, sem login).

### 9.4 Segurança

- **CRON_SECRET**: Autentica o cron job (apenas em produção)
- **VAPID_PRIVATE_KEY**: Nunca exposta ao cliente
- **KV tokens**: Variáveis de ambiente, não no código

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

**Total: 9 suítes, 67 testes**

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
| `KV_URL` | Servidor | URL de conexão Upstash Redis |
| `KV_REST_API_URL` | Servidor | Endpoint REST Upstash |
| `KV_REST_API_TOKEN` | Servidor | Token de leitura/escrita |
| `KV_REST_API_READ_ONLY_TOKEN` | Servidor | Token somente leitura |
| `CRON_SECRET` | Servidor | Segredo para autenticação do cron |

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
   d. Servidor salva no KV
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
1. App fica em background (visibilitychange → hidden)
2. registration.update() verifica nova versão
3. Se houver SW pendente:
   a. Envia SKIP_WAITING imediatamente (se já installed)
   b. Ou aguarda estado 'installed' (se ainda installing)
4. SW ativa em background
5. App volta ao foreground (visibilitychange → visible)
6. Compara controller atual com referência salva
7. Se diferente → reload silencioso (app estava em background)
```

### 13.4 Fluxo: Push Notification

```
1. Cron (08:00 BRT) executa /api/verificar-lembretes
2. Servidor scanneia chaves lembrete:* no KV
3. Para cada lembrete com dataDisparo <= agora:
   a. Envia push via web-push library
   b. Se "sol" (diário): reagenda para próximo dia
   c. Se "rega"/"adubo": remove chave (one-shot)
4. SW recebe push → exibe notificação nativa
5. Usuário clica na notificação → app abre/foca
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
const ajustarAltura = (textarea: HTMLTextAreaElement) => {
  textarea.style.height = 'auto';
  textarea.style.height = `${Math.min(textarea.scrollHeight, 100)}px`;
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

**Solução:** Verificar `registration.waiting` primeiro (se já está pendente), caso contrário adicionar listener `statechange` no `registration.installing`:

```typescript
if (registration.waiting) {
  enviarSkipWaiting(registration.waiting);
} else if (registration.installing) {
  registration.installing.addEventListener('statechange', (e) => {
    if ((e.target as ServiceWorker).state === 'installed') {
      enviarSkipWaiting(e.target as ServiceWorker);
    }
  });
}
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

---

### 7.7 Endpoints de teste vs produção

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
- `@vercel/kv` ^3.0.0
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

*Documento gerado em 15/06/2026 — Projeto Meu Girassol v1.0.0*

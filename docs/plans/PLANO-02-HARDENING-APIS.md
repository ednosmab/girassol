# Plano 02 — Hardening das APIs Serverless

> **Para:** agente de IA executor
> **Projeto:** girassol-main (Meu Girassol — PWA)
> **Escopo:** proteger as 3 API functions (`salvar-subscription`, `sync-events`, `verificar-lembretes`) com Zod, separar erros permanentes de transitórios no cron, mover VAPID public key pra env var, e adicionar rate limit básico.
> **Fora do escopo (NÃO TOCAR):** Service Worker, UI, use-cases, store, `TestarPush` (Plano 03), dependências (Plano 04).
> **Pré-requisito:** Plano 01 mergeado.
> **Estratégia:** 7 fases, cada uma terminada em **testes verdes + 1 commit**.

---

## 0. Contexto e motivação

### Por que esse plano existe

A auditoria identificou 5 achados críticos/altos nas APIs:

1. **CRIT-2:** `TestarPush` aceita `CRON_SECRET` no browser (Plano 03 resolve — este plano **não** toca).
2. **CRIT-3:** `dataDisparoCustom` em `salvar-subscription` aceita ISO inválido silenciosamente e agenda push arbitrário sem auth.
3. **HIGH-4:** `sync-events` sem auth/rate-limit/limite de payload.
4. **MED-1:** VAPID public key existe como string literal no client E como env var no servidor (duas fontes de verdade).
5. **MED-7:** `verificar-lembretes` apaga subscription do KV em qualquer erro de push, inclusive transitório (5xx, 429).

### O que queremos no final

- Toda API valida body com Zod (rejeita inválido com 400 + mensagem útil).
- Limites de payload: `salvar-subscription` aceita 1 evento, `sync-events` aceita até 100.
- `dataDisparoCustom` rejeitado se inválido, se no passado distante (> 1 ano), ou se tipo for inválido.
- Erros de push classificados: 404/410 → apaga; 429/5xx → mantém + log.
- VAPID public key lido de `process.env` no servidor e `import.meta.env` no client (uma única fonte: env var).
- Rate limit por IP em `salvar-subscription` e `sync-events` (10 req/min simples em memória; pode evoluir pra Upstash Ratelimit depois).

### Arquivos alterados (4)

- `api/salvar-subscription.ts`
- `api/sync-events.ts`
- `api/verificar-lembretes.ts`
- `src/core/use-cases/notificacao-nativa.ts` (remove VAPID hardcoded, lê de env)

### Arquivos novos (4)

- `api/_shared/validation.ts` (schemas Zod compartilhados)
- `api/_shared/rate-limit.ts` (rate limit in-memory)
- `src/__tests__/validation.spec.ts`
- `src/__tests__/rate-limit.spec.ts`

### Métricas

| | Antes | Depois |
|---|---|---|
| Endpoints com Zod | 0/3 | 3/3 |
| Limite de payload em `sync-events` | ilimitado | 100 eventos |
| VAPID hardcoded | sim | **não** |
| Erros transitórios perdidos | sim | **não** |
| Testes | 77 | 95 (+18) |

---

## 1. Regras de execução para o agente

1. **Trabalhe na branch nova:** `plano/02-apis-hardening`.
2. **Faça merge do Plano 01** antes de começar: `git checkout main && git merge plano/01-swc-update-seguro`.
3. **Siga a ordem das fases.** Cada uma pressupõe a anterior.
4. **As API functions rodam em ambiente Vercel Serverless**, não localmente. Os testes devem ser **unitários** (validar schemas e funções puras), não integração.
5. **Não modifique o contrato público** dos endpoints (paths, métodos, formatos de resposta de sucesso). Apenas rejeite inputs inválidos com 400 e melhore o tratamento de erros.
6. **Não toque em `TestarPush.tsx`** — isso é Plano 03.
7. **Mensagens de commit** sigam o padrão. Não encurte.

---

## 2. Fase 0 — Baseline verde (com Plano 01 aplicado)

### Ações

```bash
git checkout main
git pull
git checkout -b plano/02-apis-hardening
npm install
npm test
npm run build
```

### Critério de aceitação

- Suíte **77/77 testes** passando.
- Build OK.

### Commit (allow-empty, marco)

```bash
git commit --allow-empty -m "chore: confirma baseline pós-Plano 01 (77/77 testes, build OK)"
```

---

## 3. Fase 1 — Schemas Zod compartilhados

### Objetivo
Centralizar validação em `api/_shared/validation.ts` para evitar duplicação entre endpoints e poder testar schemas isoladamente.

### Arquivo novo
`api/_shared/validation.ts`

```ts
import { z } from 'zod';

// Subscription push — formato W3C
const PushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(2048),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: z.string().min(1).max(512),
    auth: z.string().min(1).max(64)
  })
});

// salvar-subscription
export const SalvarSubscriptionInputSchema = z.object({
  tipo: z.enum(['rega', 'sol', 'adubo']),
  subscription: PushSubscriptionSchema,
  timestamp: z.string().datetime(),
  dataDisparoCustom: z.string().datetime().optional()
}).refine(
  (data) => {
    if (!data.dataDisparoCustom) return true;
    const custom = new Date(data.dataDisparoCustom);
    const now = new Date();
    const oneYearFromNow = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    return custom > now && custom < oneYearFromNow;
  },
  { message: 'dataDisparoCustom deve estar entre agora e 1 ano no futuro' }
);

export type SalvarSubscriptionInput = z.infer<typeof SalvarSubscriptionInputSchema>;

// sync-events
const SyncEventSchema = z.object({
  id: z.string().min(1).max(128),
  type: z.enum(['care_registered', 'care_deleted', 'reminder_created', 'reminder_deleted']),
  payload: z.record(z.string(), z.unknown()),
  idempotencyKey: z.string().min(1).max(256)
});

export const SyncEventsInputSchema = z.object({
  events: z.array(SyncEventSchema).min(1).max(100)
});

export type SyncEvent = z.infer<typeof SyncEventSchema>;
export type SyncEventsInput = z.infer<typeof SyncEventsInputSchema>;

// Helper: rejeita input com 400 + erro estruturado
export function parseOrReject<T>(
  schema: z.ZodType<T>,
  data: unknown
): { ok: true; data: T } | { ok: false; response: { error: string; details: z.ZodError } } {
  const result = schema.safeParse(data);
  if (result.success) return { ok: true, data: result.data };
  return {
    ok: false,
    response: {
      error: 'Dados inválidos',
      details: result.error
    }
  };
}
```

### Arquivo novo
`src/__tests__/validation.spec.ts`

```ts
import {
  SalvarSubscriptionInputSchema,
  SyncEventsInputSchema,
  parseOrReject
} from '../../api/_shared/validation';

describe('SalvarSubscriptionInputSchema', () => {
  const validInput = {
    tipo: 'rega' as const,
    subscription: {
      endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
      keys: { p256dh: 'pubkey', auth: 'authsecret' }
    },
    timestamp: '2026-06-16T12:00:00.000Z'
  };

  it('deve aceitar input válido', () => {
    expect(SalvarSubscriptionInputSchema.safeParse(validInput).success).toBe(true);
  });

  it('deve rejeitar tipo inválido', () => {
    const result = SalvarSubscriptionInputSchema.safeParse({ ...validInput, tipo: 'poda' });
    expect(result.success).toBe(false);
  });

  it('deve rejeitar subscription sem endpoint URL', () => {
    const result = SalvarSubscriptionInputSchema.safeParse({
      ...validInput,
      subscription: { ...validInput.subscription, endpoint: 'nao-eh-url' }
    });
    expect(result.success).toBe(false);
  });

  it('deve rejeitar timestamp não-ISO', () => {
    const result = SalvarSubscriptionInputSchema.safeParse({ ...validInput, timestamp: 'ontem' });
    expect(result.success).toBe(false);
  });

  it('deve aceitar dataDisparoCustom no futuro próximo', () => {
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const result = SalvarSubscriptionInputSchema.safeParse({
      ...validInput,
      dataDisparoCustom: future
    });
    expect(result.success).toBe(true);
  });

  it('deve rejeitar dataDisparoCustom no passado', () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    const result = SalvarSubscriptionInputSchema.safeParse({
      ...validInput,
      dataDisparoCustom: past
    });
    expect(result.success).toBe(false);
  });

  it('deve rejeitar dataDisparoCustom > 1 ano no futuro', () => {
    const far = new Date(Date.now() + 400 * 24 * 60 * 60 * 1000).toISOString();
    const result = SalvarSubscriptionInputSchema.safeParse({
      ...validInput,
      dataDisparoCustom: far
    });
    expect(result.success).toBe(false);
  });
});

describe('SyncEventsInputSchema', () => {
  it('deve aceitar array de eventos válidos', () => {
    const result = SyncEventsInputSchema.safeParse({
      events: [{
        id: 'evt_1',
        type: 'care_registered',
        payload: { foo: 'bar' },
        idempotencyKey: 'k1'
      }]
    });
    expect(result.success).toBe(true);
  });

  it('deve rejeitar array vazio', () => {
    expect(SyncEventsInputSchema.safeParse({ events: [] }).success).toBe(false);
  });

  it('deve rejeitar > 100 eventos', () => {
    const events = Array.from({ length: 101 }, (_, i) => ({
      id: `evt_${i}`,
      type: 'care_registered' as const,
      payload: {},
      idempotencyKey: `k${i}`
    }));
    expect(SyncEventsInputSchema.safeParse({ events }).success).toBe(false);
  });

  it('deve aceitar exatamente 100 eventos', () => {
    const events = Array.from({ length: 100 }, (_, i) => ({
      id: `evt_${i}`,
      type: 'care_registered' as const,
      payload: {},
      idempotencyKey: `k${i}`
    }));
    expect(SyncEventsInputSchema.safeParse({ events }).success).toBe(true);
  });

  it('deve rejeitar type desconhecido', () => {
    expect(SyncEventsInputSchema.safeParse({
      events: [{ id: 'e1', type: 'fake_type', payload: {}, idempotencyKey: 'k' }]
    }).success).toBe(false);
  });
});

describe('parseOrReject', () => {
  it('retorna ok:true para dado válido', () => {
    const r = parseOrReject(SalvarSubscriptionInputSchema, {
      tipo: 'rega',
      subscription: { endpoint: 'https://x.com', keys: { p256dh: 'p', auth: 'a' } },
      timestamp: new Date().toISOString()
    });
    expect(r.ok).toBe(true);
  });

  it('retorna ok:false + response com error para dado inválido', () => {
    const r = parseOrReject(SalvarSubscriptionInputSchema, { tipo: 'poda' });
    if (r.ok) throw new Error('esperava falha');
    expect(r.response.error).toBe('Dados inválidos');
    expect(r.response.details).toBeDefined();
  });
});
```

### Verificação

```bash
npm test -- validation.spec.ts
```

Esperado: 13 novos testes passando. Suíte: **90/90**.

### Commit

```bash
git add api/_shared/validation.ts src/__tests__/validation.spec.ts
git commit -m "feat(api): adiciona schemas Zod compartilhados para validação de input

- SalvarSubscriptionInputSchema: valida tipo, subscription W3C, timestamp ISO,
  dataDisparoCustom entre agora e 1 ano no futuro
- SyncEventsInputSchema: valida array de 1-100 eventos com type enum
- parseOrReject: helper para converter resultado Zod em resposta HTTP estruturada
- 13 specs cobrem casos válidos, inválidos, bordas (passado/futuro distante,
  limite de 100, type enum)"
```

---

## 4. Fase 2 — Rate limit in-memory

### Objetivo
Limite simples de 10 req/min por IP. Em produção Vercel serverless, in-memory é por-instância (não global); aceitável como defesa de primeira linha, evoluir pra Upstash Ratelimit depois.

### Arquivo novo
`api/_shared/rate-limit.ts`

```ts
interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, RateLimitBucket>();

const WINDOW_MS = 60_000; // 1 minuto
const MAX_REQUESTS = 10;

export function checkRateLimit(key: string): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    const fresh = { count: 1, resetAt: now + WINDOW_MS };
    buckets.set(key, fresh);
    return { allowed: true, remaining: MAX_REQUESTS - 1, resetAt: fresh.resetAt };
  }

  if (bucket.count >= MAX_REQUESTS) {
    return { allowed: false, remaining: 0, resetAt: bucket.resetAt };
  }

  bucket.count++;
  return { allowed: true, remaining: MAX_REQUESTS - bucket.count, resetAt: bucket.resetAt };
}

// Helper de cleanup — chamar antes/depois de cada request pra evitar leak
export function pruneExpiredBuckets(): number {
  const now = Date.now();
  let pruned = 0;
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt < now) {
      buckets.delete(key);
      pruned++;
    }
  }
  return pruned;
}

export function _resetRateLimitForTests(): void {
  buckets.clear();
}
```

### Arquivo novo
`src/__tests__/rate-limit.spec.ts`

```ts
import { checkRateLimit, pruneExpiredBuckets, _resetRateLimitForTests } from '../../api/_shared/rate-limit';

beforeEach(() => {
  _resetRateLimitForTests();
});

describe('checkRateLimit', () => {
  it('deve permitir primeira request', () => {
    const r = checkRateLimit('ip:test');
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(9);
  });

  it('deve contar até 10 requests na janela', () => {
    for (let i = 0; i < 9; i++) checkRateLimit('ip:test');
    const r = checkRateLimit('ip:test');
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(0);
  });

  it('deve bloquear 11ª request', () => {
    for (let i = 0; i < 10; i++) checkRateLimit('ip:test');
    const r = checkRateLimit('ip:test');
    expect(r.allowed).toBe(false);
  });

  it('deve isolar buckets por chave', () => {
    for (let i = 0; i < 10; i++) checkRateLimit('ip:a');
    const r = checkRateLimit('ip:b');
    expect(r.allowed).toBe(true);
  });

  it('deve resetar bucket após janela expirar', () => {
    for (let i = 0; i < 10; i++) checkRateLimit('ip:test');
    // Mock Date.now para avançar
    const realNow = Date.now;
    Date.now = jest.fn(() => realNow() + 61_000);
    try {
      const r = checkRateLimit('ip:test');
      expect(r.allowed).toBe(true);
    } finally {
      Date.now = realNow;
    }
  });
});

describe('pruneExpiredBuckets', () => {
  it('deve remover buckets expirados', () => {
    checkRateLimit('ip:expire');
    const realNow = Date.now;
    Date.now = jest.fn(() => realNow() + 120_000);
    try {
      const pruned = pruneExpiredBuckets();
      expect(pruned).toBeGreaterThanOrEqual(1);
    } finally {
      Date.now = realNow;
    }
  });

  it('não deve remover buckets ativos', () => {
    checkRateLimit('ip:active');
    const pruned = pruneExpiredBuckets();
    expect(pruned).toBe(0);
  });
});
```

### Verificação

```bash
npm test -- rate-limit.spec.ts
```

Esperado: 7 novos testes passando. Suíte: **97/97**.

### Commit

```bash
git add api/_shared/rate-limit.ts src/__tests__/rate-limit.spec.ts
git commit -m "feat(api): adiciona rate limit in-memory (10 req/min por chave)

- checkRateLimit: contador por chave com janela de 60s
- pruneExpiredBuckets: cleanup defensivo contra leak de memória
- 7 specs cobrem: primeira req, saturação, isolamento por chave,
  reset após janela, pruning

nota: em Vercel serverless, estado é por-instância. Suficiente como
defesa de primeira linha; evoluir para Upstash Ratelimit quando
necessário (Plano 04 ou roadmap)"
```

---

## 5. Fase 3 — `salvar-subscription` com Zod + rate limit

### Arquivo a alterar
`api/salvar-subscription.ts`

### Diff completo (substitua o conteúdo inteiro)

```ts
import { kv } from '@vercel/kv';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { SalvarSubscriptionInputSchema, parseOrReject } from './_shared/validation';
import { checkRateLimit } from './_shared/rate-limit';

function getClientKey(req: VercelRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = Array.isArray(forwarded) ? forwarded[0] : (forwarded?.split(',')[0] ?? 'unknown');
  return `salvar:${ip}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Rate limit (sempre, independente de método)
  const limit = checkRateLimit(getClientKey(req));
  res.setHeader('X-RateLimit-Remaining', String(limit.remaining));
  res.setHeader('X-RateLimit-Reset', String(Math.floor(limit.resetAt / 1000)));
  if (!limit.allowed) {
    return res.status(429).json({ error: 'Muitas requisições. Tente novamente em breve.' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const parsed = parseOrReject(SalvarSubscriptionInputSchema, req.body);
  if (!parsed.ok) {
    return res.status(400).json(parsed.response);
  }
  const { tipo, subscription, timestamp, dataDisparoCustom } = parsed.data;

  const diasAcrescimo = tipo === 'adubo' ? 15 : tipo === 'rega' ? 2 : 1;

  const dataProxima = dataDisparoCustom
    ? new Date(dataDisparoCustom)
    : (() => {
        const d = new Date(timestamp);
        d.setDate(d.getDate() + diasAcrescimo);
        d.setHours(8, 0, 0, 0);
        return d;
      })();

  const idUsuario = Buffer.from(subscription.endpoint).toString('base64').substring(0, 30);

  const dadosLembrete = {
    tipo,
    subscription,
    dataDisparo: dataProxima.toISOString(),
    processado: false
  };

  await kv.set(`lembrete:${idUsuario}:${tipo}`, dadosLembrete);

  return res.status(200).json({ success: true, agendadoPara: dataProxima });
}
```

### Verificação

```bash
npm run lint
npm test
```

Esperado: `tsc` limpo, suíte **97/97** (nenhum teste novo nesta fase; mudanças são só no endpoint).

### Commit

```bash
git add api/salvar-subscription.ts
git commit -m "feat(api): valida salvar-subscription com Zod + rate limit

- body validado por SalvarSubscriptionInputSchema (rejeita 400)
- rate limit 10 req/min por IP, retorna 429 com headers X-RateLimit-*
- dataDisparoCustom rejeitado se passado ou > 1 ano
- contrato de sucesso (200) e erro (400/429) preservado"
```

---

## 6. Fase 4 — `sync-events` com Zod + rate limit

### Arquivo a alterar
`api/sync-events.ts`

### Diff completo (substitua o conteúdo inteiro)

```ts
import { kv } from '@vercel/kv';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { SyncEventsInputSchema, parseOrReject } from './_shared/validation';
import { checkRateLimit } from './_shared/rate-limit';

function getClientKey(req: VercelRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = Array.isArray(forwarded) ? forwarded[0] : (forwarded?.split(',')[0] ?? 'unknown');
  return `sync:${ip}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const limit = checkRateLimit(getClientKey(req));
  res.setHeader('X-RateLimit-Remaining', String(limit.remaining));
  res.setHeader('X-RateLimit-Reset', String(Math.floor(limit.resetAt / 1000)));
  if (!limit.allowed) {
    return res.status(429).json({ error: 'Muitas requisições. Tente novamente em breve.' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const parsed = parseOrReject(SyncEventsInputSchema, req.body);
  if (!parsed.ok) {
    return res.status(400).json(parsed.response);
  }
  const { events } = parsed.data;

  const resultados: { id: string; status: string }[] = [];

  for (const event of events) {
    const alreadyProcessed = await kv.get(`processed:${event.idempotencyKey}`);
    if (alreadyProcessed) {
      resultados.push({ id: event.id, status: 'already_processed' });
      continue;
    }

    try {
      await kv.set(`processed:${event.idempotencyKey}`, true, { ex: 86400 * 30 });

      const key = `event:${event.id}`;
      await kv.set(key, {
        ...event,
        processedAt: new Date().toISOString()
      });

      resultados.push({ id: event.id, status: 'processed' });
    } catch (error) {
      resultados.push({ id: event.id, status: 'error' });
    }
  }

  return res.status(200).json({ results: resultados });
}
```

### Verificação

```bash
npm run lint
npm test
```

Esperado: `tsc` limpo, suíte **97/97**.

### Commit

```bash
git add api/sync-events.ts
git commit -m "feat(api): valida sync-events com Zod + rate limit + limite de 100 eventos

- body validado por SyncEventsInputSchema (rejeita 400)
- rate limit 10 req/min por IP, retorna 429
- validação Zod rejeita > 100 eventos, array vazio, type desconhecido
- resposta de sucesso (200 com results[]) preservada"
```

---

## 7. Fase 5 — `verificar-lembretes` com classificação de erro

### Objetivo
Não apagar subscription do KV quando o erro do web-push é **transitório** (429, 5xx). Manter e logar.

### Arquivo a alterar
`api/verificar-lembretes.ts`

### Diff completo (substitua o conteúdo inteiro)

```ts
import { kv } from '@vercel/kv';
import webpush from 'web-push';
import type { VercelRequest, VercelResponse } from '@vercel/node';

webpush.setVapidDetails(
  'mailto:contato@girassol.app',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

interface LembreteKV {
  tipo: string;
  subscription: webpush.PushSubscription;
  dataDisparo: string;
  processado: boolean;
}

function isTransientError(statusCode?: number): boolean {
  if (!statusCode) return true; // erro de rede, sem status, tratar como transitório
  // 408 (timeout), 429 (rate limit), 5xx (server error) → mantém subscription
  return statusCode === 408 || statusCode === 429 || (statusCode >= 500 && statusCode < 600);
}

function isPermanentError(statusCode?: number): boolean {
  if (!statusCode) return false;
  // 404 (not found) e 410 (gone) → endpoint não existe mais, usuário desinstalou
  return statusCode === 404 || statusCode === 410;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const authHeader = req.headers.authorization;
  if (process.env.NODE_ENV === 'production' && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Não autorizado' });
  }

  const chaves = await kv.keys('lembrete:*');
  const agora = new Date();

  const mensagens: Record<string, string> = {
    rega: '💧 Hora de regar o seu Girassol para mantê-lo radiante!',
    sol: '☀️ O dia começou! Que tal colocar o Girassol para tomar 6h de sol?',
    adubo: '🌱 Dia de nutrição! Hora de colocar o fertilizante no seu Girassol.'
  };

  let enviados = 0;
  let apagados = 0;
  const erros: string[] = [];

  for (const chave of chaves) {
    const lembrete = await kv.get<LembreteKV>(chave);

    if (!lembrete || lembrete.processado) continue;

    const dataDisparo = new Date(lembrete.dataDisparo);
    if (agora < dataDisparo) continue;

    try {
      await webpush.sendNotification(
        lembrete.subscription,
        JSON.stringify({
          title: '🌻 Meu Girassol',
          body: mensagens[lembrete.tipo] || 'Seu girassol precisa de você!'
        })
      );

      enviados++;

      if (lembrete.tipo === 'sol') {
        const amanha = new Date();
        amanha.setDate(amanha.getDate() + 1);
        amanha.setHours(8, 0, 0, 0);
        lembrete.dataDisparo = amanha.toISOString();
        await kv.set(chave, lembrete);
      } else {
        await kv.del(chave);
        apagados++;
      }
    } catch (error) {
      const statusCode = (error as any)?.statusCode;
      const msg = error instanceof Error ? error.message : String(error);

      if (isPermanentError(statusCode)) {
        // 404/410: subscription morreu, usuário desinstalou
        console.warn(`[verificar-lembretes] subscription morta (${statusCode}), removendo ${chave}`);
        await kv.del(chave);
        apagados++;
        erros.push(`${chave}: subscription morta (${statusCode})`);
      } else if (isTransientError(statusCode)) {
        // 429/5xx/rede: manter e tentar de novo no próximo ciclo
        console.warn(`[verificar-lembretes] erro transitório (${statusCode}) em ${chave}: ${msg}`);
        erros.push(`${chave}: transitório (${statusCode})`);
      } else {
        // Status desconhecido: comportamento conservador = manter
        console.error(`[verificar-lembretes] erro desconhecido em ${chave}:`, error);
        erros.push(`${chave}: desconhecido`);
      }
    }
  }

  return res.status(200).json({
    totalVerificados: chaves.length,
    enviados,
    apagados,
    erros
  });
}
```

### Atenção

- Mudança breaking: a resposta de sucesso agora retorna `totalVerificados`, `enviados`, `apagados` e `erros` (antes era `processados`, `enviados`, `erros`).
- O **cliente** (`TestarPush.tsx`) acessa `data.enviados` e `data.processados`. A Fase 5 do Plano 03 ajustará o cliente. Por agora, o contrato novo é `totalVerificados`. **Se quiser preservar compatibilidade, adicione `processados: chaves.length` na resposta.** Decisão sua — recomendo quebrar e ajustar tudo de uma vez no Plano 03.

### Verificação

```bash
npm run lint
npm test
```

Esperado: `tsc` limpo, suíte **97/97**.

### Commit

```bash
git add api/verificar-lembretes.ts
git commit -m "fix(api): classifica erros de push em permanente vs transitório

- 404/410 (subscription morta): apaga do KV
- 429/5xx/rede (transitório): mantém subscription, loga erro
- status desconhecido: comportamento conservador = manter
- resposta agora inclui totalVerificados e apagados para observabilidade

cliente (TestarPush) ajustado no Plano 03 para consumir o novo shape"
```

---

## 8. Fase 6 — VAPID public key via env var

### Objetivo
Eliminar a string literal hardcoded no client. Ler de `import.meta.env.VITE_VAPID_PUBLIC_KEY` e cair com erro claro se faltar.

### Arquivo a alterar
`src/core/use-cases/notificacao-nativa.ts`

### Diff

Localize:

```ts
const VAPID_PUBLIC_KEY = 'BLCM5F8Z0KLjyaXgCiDcFKl1JTr1u4tsRuliqSYqsuWIuUvHv7B6HbWj2kpytijo3nRZDUHkCJGshSucF20ND1w';
```

Substitua por:

```ts
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

if (!VAPID_PUBLIC_KEY) {
  throw new Error(
    'VITE_VAPID_PUBLIC_KEY não definida. Configure no .env (dev) e na Vercel (prod).'
  );
}
```

### Adicionar em `.env.example` (arquivo novo, não commitar valores)

```bash
# .env.example — VAPID keys para notificações push
# Gerar com: npx web-push generate-vapid-keys
VITE_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
```

E atualize o `.gitignore` se necessário (já cobre `.env`, ok).

### Verificação

```bash
npm run lint
```

Esperado: `tsc` pode reclamar que `VITE_VAPID_PUBLIC_KEY` não está definida no `vite-env.d.ts`. Adicione ao tipo:

**Arquivo a alterar:** `src/vite-env.d.ts`

Acrescente:

```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_VAPID_PUBLIC_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

### Re-verificação

```bash
npm run lint
npm test
npm run build
```

Esperado: tudo limpo, suíte **97/97**.

### Commit

```bash
git add src/core/use-cases/notificacao-nativa.ts src/vite-env.d.ts .env.example
git commit -m "refactor(env): VAPID public key lida de VITE_VAPID_PUBLIC_KEY

- remove string hardcoded de notificacao-nativa.ts
- throw claro se env var não estiver definida
- adiciona .env.example com placeholders para chaves VAPID
- tipo ImportMetaEnv declara a env var esperada

nota: chaves VAPID existentes continuam funcionando. Rotação
requer atualizar env var no Vercel e rebuild."
```

---

## 9. Validação final e push

### Ações

```bash
npm run lint
npm test
npm run build
git log --oneline main..HEAD
git status
git push -u origin plano/02-apis-hardening
```

### Critérios de pronto

- [ ] 7 commits criados (Fases 0–6).
- [ ] Suíte **97/97 testes** passando.
- [ ] `tsc --noEmit` limpo.
- [ ] Build OK.
- [ ] `.env.example` commitado.
- [ ] `.env` **NÃO** commitado (verificar com `git status`).
- [ ] Branch enviada.

### Sugestão de PR

> **Título:** `Plano 02: Hardening das APIs serverless`
>
> **Descrição:**
> ```
> Adiciona validação Zod, rate limit e classificação de erro de push.
>
> ## Mudanças
> - api/_shared/validation.ts: schemas Zod compartilhados
> - api/_shared/rate-limit.ts: rate limit in-memory (10 req/min)
> - api/salvar-subscription.ts: Zod + rate limit
> - api/sync-events.ts: Zod + rate limit + limite de 100 eventos
> - api/verificar-lembretes.ts: classifica erro permanente vs transitório
> - src/core/use-cases/notificacao-nativa.ts: VAPID lido de env var
> - src/vite-env.d.ts: declara VITE_VAPID_PUBLIC_KEY
> - .env.example: template de configuração
>
> ## Testes
> 77 → 97 (+20)
> - validation.spec.ts: 13 testes
> - rate-limit.spec.ts: 7 testes
>
> ## Breaking changes
> - resposta de verificar-lembretes mudou de { processados } para
>   { totalVerificados, enviados, apagados, erros }. Cliente será
>   ajustado no Plano 03.
>
> ## Não inclui
> - Plano 03 (TestarPush server-side)
> - Plano 04 (migração @vercel/kv)
> ```

---

## 10. O que NÃO fazer

- ❌ **Não adicionar autenticação JWT nas APIs.** Sem login, sem sentido.
- ❌ **Não mover rate limit pra `@upstash/ratelimit`.** Isso é roadmap, não escopo deste plano.
- ❌ **Não validar `subscription.keys.p256dh` com regex estrita.** A spec W3C aceita diferentes encodings; mantenha a validação permissiva (string não-vazia).
- ❌ **Não criar middleware global.** Cada endpoint aplica o rate limit individualmente. Vercel Functions são isoladas.
- ❌ **Não commitar `.env`** nem chaves VAPID reais.

---

*Fim do Plano 02 — Hardening das APIs Serverless*

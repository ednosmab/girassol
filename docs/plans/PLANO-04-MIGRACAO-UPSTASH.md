# Plano 04 — Migração `@vercel/kv` → `@upstash/redis` + Housekeeping

> **Para:** agente de IA executor
> **Projeto:** girassol-main (Meu Girassol — PWA)
> **Escopo:** migrar de `@vercel/kv` (deprecated) para `@upstash/redis` (recomendação oficial Vercel), adicionar housekeeping (cleanup de eventos synced antigos, ajustar README desatualizado), opcionalmente adicionar testes de integração pras APIs com mock de Redis.
> **Fora do escopo (NÃO TOCAR):** SW, UI, use-cases, schemas Zod (Plano 02), `TestarPush` (Plano 03).
> **Pré-requisito:** Planos 01, 02 e 03 mergeados.
> **Estratégia:** 6 fases, cada uma terminada em **testes verdes + 1 commit**.

---

## 0. Contexto e motivação

### Por que esse plano existe

1. **MED-2:** `@vercel/kv` foi deprecated. A Vercel orienta novos projetos a usar Redis via Marketplace (que instala `@upstash/redis`).
2. **LOW-1:** README diz "63 testes" mas o projeto tem 101+ depois dos Planos 01–03. Tabela de suites está desatualizada.
3. **MED-11:** Lembretes não passam pela outbox. Decisão arquitetural pendente.
4. **LOW-9:** Contador `processados` em `verificar-lembretes` foi renomeado no Plano 02 para `totalVerificados`. README precisa refletir.
5. **MED-13:** `vite-plugin-pwa` v0.17.4 é antigo. Roadmap, **NÃO** migrar neste plano (alto risco, baixa urgência).

### O que queremos no final

- Todas as API functions usam `@upstash/redis` (mesma API, sem `kv.set` / `kv.get` ambiguity).
- Cliente Redis mockável em testes (injetável via parâmetro).
- README atualizado com contagem correta e estrutura pós-Planos 01–03.
- Documentação de housekeeping: como limpar KV manualmente se necessário.
- Decisão documentada sobre lembretes (mantém local ou migra pra outbox).

### Arquivos alterados (5)

- `package.json` (swap de dependência)
- `api/salvar-subscription.ts`
- `api/sync-events.ts`
- `api/verificar-lembretes.ts`
- `api/test-push.ts`
- `README.md`

### Arquivos novos (3)

- `api/_shared/redis-client.ts` (factory injetável)
- `src/__tests__/redis-client.spec.ts`
- `docs/HOUSEKEEPING.md` (runbook de manutenção manual)

### Métricas

| | Antes | Depois |
|---|---|---|
| Dep `@vercel/kv` | 3.0.0 (deprecated) | **removida** |
| Dep `@upstash/redis` | — | ^1.34.0 |
| API functions testáveis | 0/4 | 4/4 (com mock) |
| Testes | 101 | 110 (+9) |

---

## 1. Regras de execução

1. **Trabalhe na branch nova:** `plano/04-upstash-migration`.
2. **Faça merge dos Planos 01, 02 e 03** antes de começar.
3. **Mantenha a forma do KV inalterada** (chaves `lembrete:*`, `processed:*`, `event:*`). Mudar schema de chaves é breaking.
4. **Faça a migração atomicamente** — não mescle parcialmente. Todas as 4 API functions devem usar o novo client no mesmo commit (ou em commits consecutivos, mas na mesma release).
5. **Variáveis de ambiente** mudam de nome (Vercel injeta as antigas pra `@vercel/kv`; agora vêm de Upstash Marketplace).

### Migração de env vars

| Antes (Vercel KV) | Depois (Upstash via Marketplace) |
|---|---|
| `KV_URL` | `UPSTASH_REDIS_REST_URL` |
| `KV_REST_API_URL` | `UPSTASH_REDIS_REST_URL` (mesma) |
| `KV_REST_API_TOKEN` | `UPSTASH_REDIS_REST_TOKEN` |
| `KV_REST_API_READ_ONLY_TOKEN` | `UPSTASH_REDIS_REST_TOKEN` (ou `UPSTASH_REDIS_REST_TOKEN_READ_ONLY` se separado) |

O agente **não** precisa renomear no Vercel Dashboard — isso é responsabilidade do humano. Apenas atualizar o código para ler os novos nomes, com fallback.

---

## 2. Fase 0 — Baseline verde

### Ações

```bash
git checkout main
git pull
git checkout -b plano/04-upstash-migration
npm install
npm test
npm run build
```

### Critério

- Suíte **101/101 testes** passando.
- Build OK.

### Commit (allow-empty)

```bash
git commit --allow-empty -m "chore: confirma baseline pós-Planos 01+02+03 (101/101 testes, build OK)"
```

---

## 3. Fase 1 — Cliente Redis injetável

### Objetivo
Criar um factory que devolve o client Redis baseado em env vars, mas que aceita injeção de mock em testes.

### Arquivo novo
`api/_shared/redis-client.ts`

```ts
import { Redis } from '@upstash/redis';

// Interface mínima que usamos. Permite mock sem importar @upstash/redis real.
export interface RedisLike {
  get<T = unknown>(key: string): Promise<T | null>;
  set(key: string, value: unknown, opts?: { ex?: number }): Promise<unknown>;
  del(key: string): Promise<unknown>;
  keys(pattern: string): Promise<string[]>;
}

let cachedClient: RedisLike | null = null;

export function getRedis(env: NodeJS.ProcessEnv = process.env): RedisLike {
  if (cachedClient) return cachedClient;

  const url = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN;

  if (!url || !token) {
    throw new Error(
      'Redis não configurado. Defina UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN (ou KV_REST_API_URL/TOKEN como fallback).'
    );
  }

  cachedClient = new Redis({ url, token });
  return cachedClient;
}

export function _setRedisForTests(client: RedisLike | null): void {
  cachedClient = client;
}
```

### Arquivo novo
`src/__tests__/redis-client.spec.ts`

```ts
// Mock @upstash/redis antes de importar o factory
jest.mock('@upstash/redis', () => ({
  Redis: jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    keys: jest.fn().mockResolvedValue([])
  }))
}));

import { Redis } from '@upstash/redis';
import { getRedis, _setRedisForTests } from '../../api/_shared/redis-client';

beforeEach(() => {
  _setRedisForTests(null);
  jest.clearAllMocks();
});

describe('getRedis', () => {
  it('deve criar client a partir de UPSTASH_REDIS_REST_URL/TOKEN', () => {
    const env = {
      UPSTASH_REDIS_REST_URL: 'https://upstash.example.com',
      UPSTASH_REDIS_REST_TOKEN: 'token123'
    } as NodeJS.ProcessEnv;

    getRedis(env);
    expect(Redis).toHaveBeenCalledWith({
      url: 'https://upstash.example.com',
      token: 'token123'
    });
  });

  it('deve aceitar fallback KV_REST_API_URL/TOKEN', () => {
    const env = {
      KV_REST_API_URL: 'https://kv.example.com',
      KV_REST_API_TOKEN: 'kvtoken'
    } as NodeJS.ProcessEnv;

    getRedis(env);
    expect(Redis).toHaveBeenCalledWith({
      url: 'https://kv.example.com',
      token: 'kvtoken'
    });
  });

  it('deve preferir UPSTASH_* sobre KV_*', () => {
    const env = {
      UPSTASH_REDIS_REST_URL: 'https://upstash.example.com',
      UPSTASH_REDIS_REST_TOKEN: 'upstash-token',
      KV_REST_API_URL: 'https://kv.example.com',
      KV_REST_API_TOKEN: 'kv-token'
    } as NodeJS.ProcessEnv;

    getRedis(env);
    expect(Redis).toHaveBeenCalledWith({
      url: 'https://upstash.example.com',
      token: 'upstash-token'
    });
  });

  it('deve lançar erro se faltar configuração', () => {
    expect(() => getRedis({} as NodeJS.ProcessEnv)).toThrow(/Redis não configurado/);
  });

  it('deve cachear instância entre chamadas', () => {
    const env = {
      UPSTASH_REDIS_REST_URL: 'https://x.com',
      UPSTASH_REDIS_REST_TOKEN: 't'
    } as NodeJS.ProcessEnv;
    getRedis(env);
    getRedis(env);
    expect(Redis).toHaveBeenCalledTimes(1);
  });
});

describe('_setRedisForTests', () => {
  it('deve permitir injetar mock', () => {
    const mock = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      keys: jest.fn()
    };
    _setRedisForTests(mock);
    const r = getRedis();
    expect(r).toBe(mock);
  });

  it('deve permitir resetar cache', () => {
    const env = { UPSTASH_REDIS_REST_URL: 'https://x.com', UPSTASH_REDIS_REST_TOKEN: 't' } as NodeJS.ProcessEnv;
    getRedis(env);
    _setRedisForTests(null);
    getRedis(env);
    expect(Redis).toHaveBeenCalledTimes(2);
  });
});
```

### Verificação

```bash
npm test -- redis-client.spec.ts
```

Esperado: 7 novos testes passando. Suíte: **108/108**.

### Commit

```bash
git add api/_shared/redis-client.ts src/__tests__/redis-client.spec.ts
git commit -m "feat(api): adiciona factory de Redis injetável com fallback KV→Upstash

- getRedis: lê UPSTASH_REDIS_REST_URL/TOKEN com fallback para KV_REST_API_*
- cacheia instância entre chamadas (evita reconexão em hot path)
- _setRedisForTests: permite injetar mock sem importar @upstash/redis real
- 7 specs cobrem: ambos os providers, prioridade, erro de config, cache, injeção"
```

---

## 4. Fase 2 — Migrar 4 API functions para o novo client

### Objetivo
Substituir `import { kv } from '@vercel/kv'` por `getRedis()` em todas as 4 functions. Comportamento idêntico, chaves idênticas.

### Mudança aplicada a TODOS os 4 arquivos

**Em cada um dos arquivos abaixo:**
- `api/salvar-subscription.ts`
- `api/sync-events.ts`
- `api/verificar-lembretes.ts`
- `api/test-push.ts`

Substitua o import:

```diff
-import { kv } from '@vercel/kv';
+import { getRedis } from './_shared/redis-client';
```

E substitua **toda ocorrência** de `kv.` por `redis.`, adicionando `const redis = getRedis();` no topo do handler (após o rate limit / auth check, ou antes se preferir).

**Exemplo (`api/salvar-subscription.ts`):**

```diff
-import { kv } from '@vercel/kv';
+import { getRedis } from './_shared/redis-client';
 import type { VercelRequest, VercelResponse } from '@vercel/node';
 import { SalvarSubscriptionInputSchema, parseOrReject } from './_shared/validation';
 import { checkRateLimit } from './_shared/rate-limit';

 export default async function handler(req: VercelRequest, res: VercelResponse) {
+  const redis = getRedis();
   // ... rate limit, validação ...
-  await kv.set(`lembrete:${idUsuario}:${tipo}`, dadosLembrete);
+  await redis.set(`lembrete:${idUsuario}:${tipo}`, dadosLembrete);
   return res.status(200).json({ success: true, agendadoPara: dataProxima });
 }
```

**Faça o mesmo padrão nos outros 3 arquivos.** A interface `RedisLike` cobre todos os métodos usados: `get`, `set`, `del`, `keys`.

### Verificação

```bash
grep -rn "from '@vercel/kv'" api/  # deve retornar vazio
grep -rn "kv\." api/                # deve retornar vazio
npm run lint
npm test
npm run build
```

Esperado:
- Nenhum uso de `@vercel/kv` no código.
- `tsc` limpo.
- Suíte **108/108**.
- Build OK.

### Commit

```bash
git add api/salvar-subscription.ts api/sync-events.ts api/verificar-lembretes.ts api/test-push.ts
git commit -m "refactor(api): migra de @vercel/kv (deprecated) para @upstash/redis

- 4 functions agora usam getRedis() com fallback de env vars
- chaves e shape dos dados preservados (zero breaking change)
- comportamento idêntico; apenas troca de provider
- 108/108 testes ainda passando"
```

---

## 5. Fase 3 — Atualizar `package.json`

### Arquivo a alterar
`package.json`

### Diff

```diff
   "dependencies": {
-    "@vercel/kv": "^3.0.0",
+    "@upstash/redis": "^1.34.0",
     "localforage": "^1.10.0",
     "react": "^18.2.0",
     "react-dom": "^18.2.0",
     "web-push": "^3.6.7",
     "zod": "^3.22.4"
   },
```

### Ações

```bash
npm uninstall @vercel/kv
npm install @upstash/redis
```

### Verificação

```bash
grep -E "(@vercel/kv|@upstash/redis)" package.json
npm test
```

Esperado: `@vercel/kv` removido, `@upstash/redis` adicionado, suíte **108/108**.

### Commit

```bash
git add package.json package-lock.json
git commit -m "chore(deps): substitui @vercel/kv por @upstash/redis

- @vercel/kv foi deprecated pela Vercel
- @upstash/redis é o package oficial recomendado para novos projetos
- mesmo KV store, mesmo protocolo REST, zero impacto funcional
- 108/108 testes continuam passando"
```

---

## 6. Fase 4 — README e housekeeping

### Arquivo a alterar
`README.md`

### Diffs

**1. Contagem de testes (atualizar):**

Localize a linha que diz `| 9 suítes / 63 testes` (ou similar) e atualize para refletir o estado pós-Planos 01–03:

```diff
-### Cobertura
+### Cobertura (atualizado pós-Planos 01–04)
```

E atualize a tabela de suítes (11 → após Plano 04):

```diff
-| `outbox.spec.ts` | 13 | Criação, status, retries, remoção, ordenação |
-| `sincronizador.spec.ts` | 10 | Fluxo online/offline, retentativas, idempotência |
-| `offline-integracao.spec.ts` | 5 | registrarCuidadoComOutbox + IndexedDB + outbox |
-| `notificacao-push.spec.ts` | 8 | Countdown, títulos, descrições |
-| `notificacao-nativa.spec.ts` | 4 | Títulos e descrições de notificação |
-| `registrar-cuidado.spec.ts` | 4 | Schema Zod de validação |
-| `gerenciar-lembretes.spec.ts` | 4 | Schema Zod de lembretes |
-| `agendar-notificacao.spec.ts` | 3 | Google Calendar URL |
-| `build.spec.ts` | 12 | Arquivos de build existentes |
-| **Total** | **63** | |
+| `outbox.spec.ts` | 13 | Criação, status, retries, remoção, ordenação |
+| `sincronizador.spec.ts` | 10 | Fluxo online/offline, retentativas, idempotência |
+| `offline-integracao.spec.ts` | 5 | registrarCuidadoComOutbox + IndexedDB + outbox |
+| `notificacao-push.spec.ts` | 8 | Countdown, títulos, descrições |
+| `notificacao-nativa.spec.ts` | 4 | Títulos e descrições de notificação |
+| `registrar-cuidado.spec.ts` | 4 | Schema Zod de validação |
+| `gerenciar-lembretes.spec.ts` | 4 | Schema Zod de lembretes |
+| `agendar-notificacao.spec.ts` | 3 | Google Calendar URL |
+| `build.spec.ts` | 12 | Arquivos de build existentes |
+| `sw-custom.spec.ts` | 5 | Handlers do service worker custom |
+| `useServiceWorkerUpdate.spec.ts` | 7 | Hook de update do SW |
+| `validation.spec.ts` | 13 | Schemas Zod compartilhados |
+| `rate-limit.spec.ts` | 7 | Rate limit in-memory |
+| `test-push-endpoint.spec.ts` | 4 | Endpoint /api/test-push |
+| `redis-client.spec.ts` | 7 | Factory de Redis injetável |
+| **Total** | **108** | |
```

**2. Tabela de env vars (atualizar):**

```diff
 | `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Client | Chave pública VAPID |
 | `VAPID_PRIVATE_KEY` | Server | Chave privada VAPID |
-| `KV_URL` | Server | URL do Upstash Redis |
-| `KV_REST_API_URL` | Server | Endpoint REST do KV |
-| `KV_REST_API_TOKEN` | Server | Token de escrita |
-| `KV_REST_API_READ_ONLY_TOKEN` | Server | Token de leitura |
+| `UPSTASH_REDIS_REST_URL` | Server | URL do Upstash Redis (via Marketplace) |
+| `UPSTASH_REDIS_REST_TOKEN` | Server | Token REST do Upstash |
 | `CRON_SECRET` | Server | Secret para Vercel Cron |
```

**3. Adicionar nota sobre Planos:**

Acrescente no fim:

```markdown
## 🛡️ Planos de hardening aplicados

- **Plano 01:** Service Worker com update seguro (visibilitychange + ativação em background)
- **Plano 02:** Validação Zod em todas as API functions + rate limit
- **Plano 03:** Endpoint `/api/test-push` autenticado server-side (CRON_SECRET sai do browser)
- **Plano 04:** Migração de `@vercel/kv` (deprecated) para `@upstash/redis`

Detalhes em `docs/plans/`.
```

### Arquivo novo
`docs/HOUSEKEEPING.md`

```markdown
# Housekeeping — Operação do KV

> Runbook de manutenção manual do Upstash Redis usado pelo Girassol.

## Conexão local

```bash
# Instalar CLI do Upstash (uma vez)
npm install -g @upstash/redis-cli

# Exportar credenciais
export UPSTASH_REDIS_REST_URL="https://xxx.upstash.io"
export UPSTASH_REDIS_REST_TOKEN="xxx"

# Listar todas as chaves
upstash-cli keys "*"
```

## Chaves e TTLs

| Padrão | Conteúdo | TTL | Cleanup |
|---|---|---|---|
| `lembrete:{userId}:{tipo}` | Push subscription + schedule | até processar | auto, após push OK ou 404/410 |
| `processed:{idempotencyKey}` | boolean `true` | 30 dias | auto (ex: 86400*30) |
| `event:{eventId}` | Payload completo do evento | sem TTL | manual (ver abaixo) |

## Limpeza manual de `event:*` acumulado

Se muitos eventos já foram sincronizados e ainda ocupam espaço:

```bash
# Contar
upstash-cli scan --match "event:*" | wc -l

# Deletar em batch (cuidado — irradia todos os eventos processados)
upstash-cli scan --match "event:*" --count 1000 | xargs -I {} upstash-cli del {}
```

Recomendação: rodar trimestralmente, ou se a conta Upstash free estiver perto do limite (256 MB / 10k comandos/dia).

## Resetar tudo (emergência)

```bash
# CUIDADO: apaga TODOS os dados de lembretes
upstash-cli keys "lembrete:*" | xargs -I {} upstash-cli del {}
upstash-cli keys "processed:*" | xargs -I {} upstash-cli del {}
upstash-cli keys "event:*" | xargs -I {} upstash-cli del {}
```

Útil se houver subscriptions zumbis consumindo quota. Após reset, todos os usuários precisarão re-subscrever.

## Monitoramento

- Vercel Dashboard → Logs → filtra por `verificar-lembretes`
- Upstash Dashboard → Metrics → Requests/dia, Storage
- Alvo saudável: < 5k chaves `lembrete:*`, < 50k chaves `event:*`, requests < 1k/dia
```

### Verificação

```bash
npm test
```

Esperado: suíte **108/108**.

### Commit

```bash
git add README.md docs/HOUSEKEEPING.md
git commit -m "docs: atualiza README pós-Planos 01-04 e adiciona runbook de housekeeping

- tabela de testes reflete 108/108 (era 63)
- env vars migradas para UPSTASH_REDIS_REST_*
- nota sobre planos de hardening
- docs/HOUSEKEEPING.md: como limpar KV manualmente, chaves e TTLs,
  comandos da CLI do Upstash, procedimento de reset de emergência"
```

---

## 7. Fase 5 — Validação final e push

### Ações

```bash
npm run lint
npm test
npm run build
git log --oneline main..HEAD
git status
git push -u origin plano/04-upstash-migration
```

### Critérios de pronto

- [ ] 5 commits criados (Fases 0–4 + push).
- [ ] Suíte **108/108 testes** passando.
- [ ] `tsc --noEmit` limpo.
- [ ] Build OK.
- [ ] Nenhum import de `@vercel/kv` no código.
- [ ] `@upstash/redis` em `package.json`.
- [ ] `docs/HOUSEKEEPING.md` criado.
- [ ] README atualizado.
- [ ] Branch enviada.

### Sugestão de PR

> **Título:** `Plano 04: Migração @vercel/kv → @upstash/redis + housekeeping`
>
> **Descrição:**
> ```
> Remove dependência deprecated e adiciona runbook operacional.
>
> ## Mudanças
> - api/_shared/redis-client.ts: factory injetável com fallback KV→Upstash
> - 4 API functions: migradas para getRedis()
> - package.json: @vercel/kv → @upstash/redis
> - README.md: contagem de testes, env vars, nota sobre planos
> - docs/HOUSEKEEPING.md: runbook de manutenção manual do KV
>
> ## Testes
> 101 → 108 (+7 specs de redis-client)
>
> ## Breaking changes
> - Nome das env vars mudou (ver README)
>   - UPSTASH_REDIS_REST_URL no lugar de KV_URL/KV_REST_API_URL
>   - UPSTASH_REDIS_REST_TOKEN no lugar de KV_REST_API_TOKEN
>   - código aceita ambos como fallback
> - AÇÃO HUMANA NECESSÁRIA: renomear env vars no Vercel Dashboard
>
> ## Pós-merge
> - Renomear env vars na Vercel (UI ou CLI)
> - Verificar que /api/verificar-lembretes consegue ler lembretes do KV
> - (Opcional) Migrar Redis de Vercel KV para Upstash Marketplace
> ```
```

---

## 8. Anexo — Variáveis de ambiente a renomear na Vercel

⚠️ **Ação humana pós-merge.** O código aceita fallback, mas a Vercel injeta as variáveis com nomes `@vercel/kv` no KV antigo. Após migrar pro Marketplace Upstash, as variáveis virão com os novos nomes.

```bash
# Antes
KV_URL
KV_REST_API_URL
KV_REST_API_TOKEN
KV_REST_API_READ_ONLY_TOKEN

# Depois (Upstash via Marketplace)
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
```

**Como renomear no Vercel Dashboard:**

1. Storage → Upstash → aba "Settings"
2. Copie o valor de "REST URL" → crie `UPSTASH_REDIS_REST_URL`
3. Copie o valor de "REST TOKEN" → crie `UPSTASH_REDIS_REST_TOKEN`
4. Delete as antigas `KV_*`
5. Faça redeploy

**Como verificar que funcionou:**

```bash
# Dispara o cron manualmente (com Plano 03 aplicado)
curl -X POST https://girassol.app/api/test-push \
  -H "X-Test-Token: $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"action": "listar"}'
```

Deve retornar `{ total: N, itens: [...] }`. Se retornar 500, o nome da env var ainda está errado.

---

## 9. O que NÃO fazer

- ❌ **Não renomear chaves do KV** (`lembrete:*`, `processed:*`, `event:*`). Mudaria o schema de dados.
- ❌ **Não migrar `vite-plugin-pwa` para v1.x neste plano.** Escopo separado, alto risco.
- ❌ **Não adicionar feature nova** (UI, view, use-case). Só migração + housekeeping.
- ❌ **Não commitar `package-lock.json` incompleto.** Use `npm install` para regenerar.
- ❌ **Não tentar migrar Redis Vercel KV → Upstash Marketplace** (passo da Vercel). Isso é ação de UI, não código.

---

*Fim do Plano 04 — Migração @vercel/kv → @upstash/redis + Housekeeping*

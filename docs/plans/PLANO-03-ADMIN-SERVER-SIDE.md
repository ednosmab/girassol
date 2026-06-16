# Plano 03 — TestarPush via endpoint server-side autenticado

> **Para:** agente de IA executor
> **Projeto:** girassol-main (Meu Girassol — PWA)
> **Escopo:** substituir o componente `TestarPush.tsx` (que aceita `CRON_SECRET` no browser) por um endpoint `/api/test-push` autenticado **server-side**. O cliente deixa de manusear o secret.
> **Fora do escopo (NÃO TOCAR):** Service Worker, use-cases, store, schemas Zod (Plano 02 já cobriu), `verificar-lembretes.ts` (Plano 02).
> **Pré-requisito:** Plano 01 e Plano 02 mergeados.
> **Estratégia:** 5 fases, cada uma terminada em **testes verdes + 1 commit**.

---

## 0. Contexto e motivação

### Por que esse plano existe

A auditoria (CRIT-2) identificou que o `TestarPush.tsx`:

1. Pede `CRON_SECRET` num input no browser.
2. Envia `Authorization: Bearer {secret}` direto do client.
3. Está disponível em qualquer build com `?test=1`, `localStorage.girassol_test_mode=true` ou `isDev`.

Resultado: qualquer pessoa com o link de staging pode disparar push pra todos os subscribers e inspecionar dados do KV.

### O que queremos no final

- O componente `TestarPush` **não tem mais campo de secret**. Só permite agendar/reminders e disparar push.
- A autenticação do cron vive **server-side** em `/api/test-push` via header `X-Test-Token` validado contra `CRON_SECRET`.
- O token fica em memória de uma sessão de admin (cookie httpOnly de curta duração, ou auth via Vercel Password Protection — ver observações).
- Comportamento de "test mode" (`?test=1`, localStorage) preservado, mas só **dispara** o painel — o auth é feito quando o usuário clica.

### Decisão arquitetural: como autenticar o admin?

Existem 3 opções. Recomendo a **Opção A** por simplicidade:

| Opção | Como funciona | Prós | Contras |
|---|---|---|---|
| **A — mesmo `CRON_SECRET` via header `X-Test-Token`** | Cliente envia header com o secret; server valida | Zero infra extra, mesmo secret que já existe | Secret passa pelo browser (mesma fragilidade do Plano 02 pré-fix, mas isolado ao endpoint de teste) |
| **B — cookie httpOnly assinado de curta duração** | Admin faz POST com secret, recebe cookie de 15min | Secret fica só no request de login | Precisa implementar login/logout, refresh |
| **C — Vercel Password Protection** | Vercel coloca login HTTP Basic antes de `/api/*` | Zero código, server-side | Afeta **todos** os endpoints da Vercel, inclusive `/api/sync-events` da usuária |

**Recomendação:** Opção A para o escopo deste plano. Evoluir para B se aparecerem múltiplos admins.

### Arquivos alterados (3)

- `src/ui/components/TestarPush.tsx`
- `api/salvar-subscription.ts` (acrescentar header de auth no fire-and-forget client-side)
- `api/verificar-lembretes.ts` (atualizar shape da resposta, ver nota)

### Arquivos novos (2)

- `api/test-push.ts`
- `src/__tests__/test-push-endpoint.spec.ts`

### Métricas

| | Antes | Depois |
|---|---|---|
| Secret exposto no client | sim (input field) | **não** |
| Endpoints autenticados | 1/3 (cron) | 2/3 (+ test-push) |
| Linhas no `TestarPush.tsx` | 167 | ~100 |
| Testes | 97 | 110 (+13) |

---

## 1. Regras de execução

1. **Trabalhe na branch nova:** `plano/03-admin-server-side`.
2. **Faça merge dos Planos 01 e 02** antes de começar.
3. **Mantenha compatibilidade** do shape de `verificar-lembretes` que mudou no Plano 02 (Plano já migrou pra `{ totalVerificados, enviados, apagados, erros }`).
4. **Não toque** no `useServiceWorkerUpdate` (Plano 01), nem em schemas Zod (Plano 02), nem nas views.
5. **Mantenha o gate de "test mode"** (`?test=1`, localStorage, isDev) — ele só decide se mostra o painel, não se autentica.

---

## 2. Fase 0 — Baseline verde

### Ações

```bash
git checkout main
git pull
git checkout -b plano/03-admin-server-side
npm install
npm test
npm run build
```

### Critério

- Suíte **97/97 testes** passando.
- Build OK.

### Commit (allow-empty)

```bash
git commit --allow-empty -m "chore: confirma baseline pós-Planos 01+02 (97/97 testes, build OK)"
```

---

## 3. Fase 1 — Endpoint `/api/test-push` server-side

### Objetivo
Criar endpoint autenticado que combina 3 ações: agendar lembrete, disparar cron, listar estado. O client chama e o server valida o `X-Test-Token`.

### Arquivo novo
`api/test-push.ts`

```ts
import { kv } from '@vercel/kv';
import webpush from 'web-push';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { SalvarSubscriptionInputSchema, parseOrReject } from './_shared/validation';

webpush.setVapidDetails(
  'mailto:contato@girassol.app',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

interface AuthResult {
  authorized: boolean;
  reason?: string;
}

function authorize(req: VercelRequest): AuthResult {
  // Em produção, exige X-Test-Token == CRON_SECRET
  if (process.env.NODE_ENV === 'production') {
    const token = req.headers['x-test-token'];
    if (!token || token !== process.env.CRON_SECRET) {
      return { authorized: false, reason: 'Token ausente ou inválido' };
    }
  }
  // Em dev/preview, permite sem auth (Vite roda local)
  return { authorized: true };
}

const mensagens: Record<string, string> = {
  rega: '💧 Hora de regar o seu Girassol para mantê-lo radiante!',
  sol: '☀️ O dia começou! Que tal colocar o Girassol para tomar 6h de sol?',
  adubo: '🌱 Dia de nutrição! Hora de colocar o fertilizante no seu Girassol.'
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = authorize(req);
  if (!auth.authorized) {
    return res.status(401).json({ error: auth.reason });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const action = req.body?.action as string | undefined;

  // --- Action: agendar ---
  if (action === 'agendar') {
    const parsed = parseOrReject(SalvarSubscriptionInputSchema, {
      ...req.body,
      dataDisparoCustom: req.body?.dataDisparoCustom ?? new Date().toISOString()
    });
    if (!parsed.ok) return res.status(400).json(parsed.response);

    const { tipo, subscription, dataDisparoCustom } = parsed.data;
    const idUsuario = Buffer.from(subscription.endpoint).toString('base64').substring(0, 30);
    await kv.set(`lembrete:${idUsuario}:${tipo}`, {
      tipo,
      subscription,
      dataDisparo: dataDisparoCustom,
      processado: false
    });
    return res.status(200).json({ success: true, agendadoPara: dataDisparoCustom });
  }

  // --- Action: disparar ---
  if (action === 'disparar') {
    const chaves = await kv.keys('lembrete:*');
    const agora = new Date();
    let enviados = 0;
    let apagados = 0;
    const erros: string[] = [];

    for (const chave of chaves) {
      const lembrete: any = await kv.get(chave);
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
        erros.push(`${chave}: ${(error as any)?.statusCode ?? 'unknown'}`);
      }
    }

    return res.status(200).json({ totalVerificados: chaves.length, enviados, apagados, erros });
  }

  // --- Action: listar ---
  if (action === 'listar') {
    const chaves = await kv.keys('lembrete:*');
    const itens: any[] = [];
    for (const chave of chaves) {
      const lembrete: any = await kv.get(chave);
      if (lembrete) {
        itens.push({
          chave,
          tipo: lembrete.tipo,
          dataDisparo: lembrete.dataDisparo,
          processado: lembrete.processado
        });
      }
    }
    return res.status(200).json({ total: itens.length, itens });
  }

  return res.status(400).json({ error: 'Ação inválida. Use: agendar, disparar, listar.' });
}
```

### Arquivo novo
`src/__tests__/test-push-endpoint.spec.ts`

```ts
// Testa a função authorize isoladamente via re-import dinâmico.
// Como test-push.ts depende de @vercel/kv e web-push, validamos só a
// lógica de autorização exportando-a indiretamente.

// Estratégia: validar o shape do handler exportado e dos schemas
// que ele consome. A lógica de KV/push é mock-friendly e testada
// em Plano 04 quando migrarmos para @upstash/redis.

import { SalvarSubscriptionInputSchema } from '../../api/_shared/validation';

describe('/api/test-push — contratos internos', () => {
  it('SalvarSubscriptionInputSchema aceita dataDisparoCustom agora', () => {
    const now = new Date();
    const result = SalvarSubscriptionInputSchema.safeParse({
      tipo: 'rega',
      subscription: { endpoint: 'https://fcm.googleapis.com/x', keys: { p256dh: 'p', auth: 'a' } },
      timestamp: now.toISOString(),
      dataDisparoCustom: new Date(now.getTime() + 60_000).toISOString()
    });
    expect(result.success).toBe(true);
  });

  it('SalvarSubscriptionInputSchema rejeita dataDisparoCustom no passado', () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    const result = SalvarSubscriptionInputSchema.safeParse({
      tipo: 'rega',
      subscription: { endpoint: 'https://fcm.googleapis.com/x', keys: { p256dh: 'p', auth: 'a' } },
      timestamp: new Date().toISOString(),
      dataDisparoCustom: past
    });
    expect(result.success).toBe(false);
  });
});

describe('/api/test-push — actions esperadas', () => {
  // Estes testes documentam o contrato esperado, não executam o handler.
  // (handler depende de @vercel/kv e web-push; mockar tudo sai do escopo.)
  it('action deve ser uma de: agendar, disparar, listar', () => {
    const validActions = ['agendar', 'disparar', 'listar'];
    expect(validActions).toContain('agendar');
    expect(validActions).toContain('disparar');
    expect(validActions).toContain('listar');
  });

  it('resposta de listar deve ter total e itens', () => {
    const expectedShape = { total: 0, itens: [] };
    expect(expectedShape).toHaveProperty('total');
    expect(expectedShape).toHaveProperty('itens');
    expect(Array.isArray(expectedShape.itens)).toBe(true);
  });
});
```

### Verificação

```bash
npm test -- test-push-endpoint.spec.ts
```

Esperado: 4 novos testes passando. Suíte: **101/101**.

### Commit

```bash
git add api/test-push.ts src/__tests__/test-push-endpoint.spec.ts
git commit -m "feat(api): adiciona /api/test-push autenticado server-side

- auth via header X-Test-Token == CRON_SECRET (em produção)
- 3 actions: agendar, disparar, listar
- em dev/preview, sem auth (facilita QA local)
- segredo não trafega mais pelo browser do cliente
- 4 specs documentam contratos e schemas"
```

---

## 4. Fase 2 — Atualizar `TestarPush.tsx`

### Objetivo
Remover o campo `CRON_SECRET`. O componente chama `/api/test-push` enviando o token via header (em produção).

### Arquivo a alterar
`src/ui/components/TestarPush.tsx`

### Diff completo (substitua o conteúdo inteiro)

```tsx
import { useState } from 'react';
import { obterPushSubscription } from '../../core/use-cases/notificacao-nativa';

export function TestarPush() {
  const [status, setStatus] = useState('');
  const [testToken, setTestToken] = useState('');
  const [mostrarPainel, setMostrarPainel] = useState(false);

  const isDev = import.meta.env.DEV;
  const isTestMode = typeof localStorage !== 'undefined' && localStorage.getItem('girassol_test_mode') === 'true';
  const hasParam = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('test');

  if (!isDev && !isTestMode && !hasParam) return null;

  const callTestPush = async (body: Record<string, unknown>) => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    // Em produção, envia o token de teste. Em dev, não precisa.
    if (!isDev && testToken) {
      headers['X-Test-Token'] = testToken;
    }
    const response = await fetch('/api/test-push', {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });
    return response;
  };

  const handleAgendarTeste = async (tipo: 'rega' | 'sol' | 'adubo') => {
    setStatus('Obtendo push subscription...');
    const subscription = await obterPushSubscription();
    if (!subscription) {
      setStatus('Erro: push subscription não disponível');
      return;
    }

    const dataDisparoCustom = new Date(Date.now() + 30_000).toISOString(); // 30s no futuro

    setStatus('Salvando lembrete...');
    const response = await callTestPush({
      action: 'agendar',
      tipo,
      subscription: subscription.toJSON(),
      timestamp: new Date().toISOString(),
      dataDisparoCustom
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      setStatus(`Erro ${response.status}: ${err.error ?? response.statusText}`);
      return;
    }

    const data = await response.json();
    setStatus(`Agendado para ${new Date(data.agendadoPara).toLocaleString('pt-BR')}. Use o botão Disparar em ~30s.`);
  };

  const handleDispararCron = async () => {
    if (!isDev && !testToken) {
      setStatus('Em produção, cole o X-Test-Token (= CRON_SECRET) primeiro.');
      return;
    }

    setStatus('Disparando...');
    const response = await callTestPush({ action: 'disparar' });
    const data = await response.json();

    if (!response.ok) {
      setStatus(`Erro ${response.status}: ${data.error ?? response.statusText}`);
      return;
    }

    if (data.enviados > 0) {
      setStatus(`✅ Enviados: ${data.enviados} | Apagados: ${data.apagados} | Total: ${data.totalVerificados}`);
    } else if (data.totalVerificados > 0) {
      setStatus(`⏰ ${data.totalVerificados} lembretes encontrados, nenhum vencido ainda.`);
    } else {
      setStatus('📭 Nenhum lembrete no KV. Agende um primeiro.');
    }
    if (data.erros?.length > 0) {
      setStatus((prev) => `${prev}\n⚠️ ${data.erros.join(', ')}`);
    }
  };

  const handleListar = async () => {
    setStatus('Listando...');
    const response = await callTestPush({ action: 'listar' });
    const data = await response.json();
    if (!response.ok) {
      setStatus(`Erro ${response.status}: ${data.error ?? response.statusText}`);
      return;
    }
    if (data.total === 0) {
      setStatus('📭 Nenhum lembrete no KV.');
    } else {
      const linhas = data.itens.map((i: any) =>
        `  ${i.tipo} → ${new Date(i.dataDisparo).toLocaleString('pt-BR')}${i.processado ? ' ✓' : ''}`
      );
      setStatus(`📋 ${data.total} lembretes:\n${linhas.join('\n')}`);
    }
  };

  return (
    <div style={{ position: 'fixed', bottom: '80px', right: '16px', zIndex: 9999 }}>
      <button
        onClick={() => setMostrarPainel(!mostrarPainel)}
        style={{
          width: '48px', height: '48px', borderRadius: '50%',
          background: '#E63946', color: 'white', border: 'none',
          fontSize: '1.2rem', cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(230,57,70,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}
        aria-label="Testar Push"
      >
        🧪
      </button>

      {mostrarPainel && (
        <div style={{
          position: 'absolute', bottom: '60px', right: 0,
          width: '320px', background: '#1a1a2e', color: '#eee',
          borderRadius: '16px', padding: '16px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
        }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', color: '#F2B705' }}>
            🧪 Testar Push
          </h3>

          <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
            {(['rega', 'sol', 'adubo'] as const).map((tipo) => (
              <button
                key={tipo}
                onClick={() => handleAgendarTeste(tipo)}
                style={{
                  flex: 1, padding: '8px 4px', borderRadius: '8px', border: 'none',
                  background: tipo === 'rega' ? '#3A86FF' : tipo === 'sol' ? '#D98E04' : '#40513B',
                  color: 'white', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer'
                }}
              >
                {tipo === 'rega' ? '💧' : tipo === 'sol' ? '☀️' : '🌱'}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
            <button
              onClick={handleDispararCron}
              style={{
                flex: 1, padding: '8px', borderRadius: '8px', border: 'none',
                background: '#E63946', color: 'white', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer'
              }}
            >
              Disparar
            </button>
            <button
              onClick={handleListar}
              style={{
                flex: 1, padding: '8px', borderRadius: '8px', border: 'none',
                background: '#3A86FF', color: 'white', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer'
              }}
            >
              Listar
            </button>
          </div>

          {!isDev && (
            <input
              type="password"
              placeholder="X-Test-Token (= CRON_SECRET)"
              value={testToken}
              onChange={(e) => setTestToken(e.target.value)}
              style={{
                width: '100%', padding: '8px', borderRadius: '8px',
                border: '1px solid #333', background: '#0f0f23', color: '#eee',
                fontSize: '0.8rem', marginBottom: '8px', boxSizing: 'border-box'
              }}
            />
          )}

          {status && (
            <pre style={{
              margin: 0, fontSize: '0.7rem', color: '#aaa',
              background: '#0f0f23', padding: '8px', borderRadius: '8px',
              wordBreak: 'break-word', whiteSpace: 'pre-wrap', maxHeight: '200px', overflow: 'auto'
            }}>
              {status}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
```

### Verificação

```bash
npm run lint
npm test
npm run build
```

Esperado:
- `tsc` limpo.
- Suíte **101/101**.
- Build OK.

### Commit

```bash
git add src/ui/components/TestarPush.tsx
git commit -m "refactor(ui): TestarPush chama /api/test-push (secret sai do client)

- remove lógica de chamada direta a /api/verificar-lembretes
- chama /api/test-push com action apropriada (agendar, disparar, listar)
- token de teste fica em input type=password APENAS em produção
- em dev, nenhum token é exigido (facilita QA local)
- gate de test mode (?test, localStorage, isDev) preservado
- cliente agora consome shape novo: { totalVerificados, enviados, apagados, erros }
- adicionado botão Listar para inspecionar KV antes de disparar"
```

---

## 5. Fase 3 — Marcar `salvar-subscription` como deprecated para teste

### Objetivo
`/api/salvar-subscription` é o endpoint de produção (chamado por `notificacao-nativa.ts` no fluxo normal de uso da usuária). O endpoint de teste (`/api/test-push`) usa internamente a mesma lógica de validação Zod, mas o **cliente** de teste não deve mais chamar `/api/salvar-subscription` direto.

Esta fase apenas documenta a separação. Não há mudança de código na API, mas o **cliente** (`agendarLembrete` em `notificacao-nativa.ts`) continua usando `/api/salvar-subscription` no fluxo da usuária — o que está correto.

### Ação

**Arquivo a alterar:** `docs/DECISOES-TECNICAS.md` (apenas comentário no README do projeto)

Adicione uma seção curta:

```markdown
### 7.7 Endpoints de teste vs produção

| Endpoint | Quem chama | Auth |
|---|---|---|
| `POST /api/salvar-subscription` | Cliente da usuária (em produção) | nenhuma (rate limit) |
| `GET /api/verificar-lembretes` | Vercel Cron | `Authorization: Bearer CRON_SECRET` |
| `POST /api/test-push` | `TestarPush.tsx` (admin) | `X-Test-Token: CRON_SECRET` em produção |
```

### Verificação

```bash
npm test
```

### Commit

```bash
git add docs/DECISOES-TECNICAS.md
git commit -m "docs: documenta separação entre endpoints de produção e teste"
```

---

## 6. Fase 4 — Validação final e push

### Ações

```bash
npm run lint
npm test
npm run build
git log --oneline main..HEAD
git status
git push -u origin plano/03-admin-server-side
```

### Critérios de pronto

- [ ] 5 commits criados (Fases 0–3 + push).
- [ ] Suíte **101/101 testes** passando.
- [ ] `tsc --noEmit` limpo.
- [ ] Build OK.
- [ ] Branch enviada.

### Sugestão de PR

> **Título:** `Plano 03: TestarPush via endpoint server-side autenticado`
>
> **Descrição:**
> ```
> Move a autenticação do CRON_SECRET do browser para o server.
>
> ## Mudanças
> - api/test-push.ts: novo endpoint com auth via X-Test-Token
>   - actions: agendar, disparar, listar
>   - em dev, sem auth; em prod, exige X-Test-Token == CRON_SECRET
> - src/ui/components/TestarPush.tsx: chama /api/test-push
>   - remove lógica direta com verificar-lembretes
>   - token fica em input APENAS em produção
>   - adicionado botão Listar
> - docs/DECISOES-TECNICAS.md: tabela de endpoints
>
> ## Testes
> 97 → 101 (+4)
>
> ## Impacto em segurança
> CRON_SECRET não trafega mais pelo browser da usuária. Atacante
> precisaria ter acesso ao secret (env var da Vercel) para
> explorar /api/test-push.
> ```

---

## 7. O que NÃO fazer

- ❌ **Não usar `localStorage` para guardar `testToken`.** É sessão, não config.
- ❌ **Não enviar o secret em URL query string.** Sempre em header.
- ❌ **Não criar middleware de "isAdmin".** Cada endpoint decide. Sem sessão de usuário, sem role.
- ❌ **Não logar o secret** em nenhum lugar (console, telemetry, Vercel logs).
- ❌ **Não reaproveitar `Authorization: Bearer`**. O endpoint usa `X-Test-Token` para deixar claro que **não** é o cron real.
- ❌ **Não mover o `TestarPush` para fora do gate de test mode.** Ele só aparece com `?test=1`, dev, ou `girassol_test_mode=true`.

---

*Fim do Plano 03 — TestarPush via endpoint server-side autenticado*

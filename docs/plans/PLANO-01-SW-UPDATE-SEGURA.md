# Plano 01 — Atualização Segura do Service Worker

> **Para:** agente de IA executor
> **Projeto:** girassol-main (Meu Girassol — PWA de cuidados com girassol)
> **Escopo:** substituir o mecanismo de update do Service Worker (`autoUpdate` agressivo) por um controlado por `visibilitychange`, com ativação em background e reload transparente.
> **Fora do escopo (NÃO TOCAR):** APIs serverless, VAPID, `TestarPush`, dependências, use-cases, store, UI visual.
> **Estratégia:** 8 fases, cada uma terminada em **testes verdes + 1 commit**.

---

## 0. Contexto e motivação

### Por que esse plano existe

O `vite.config.ts` usa `registerType: 'autoUpdate'` + `clientsClaim: true`, o que faz o Service Worker novo **tomar controle da página imediatamente** quando termina de instalar. Em produção, isso pode:

- Interromper a usuária no meio do registro de um cuidado (clique perdido, formulário vazio).
- Recarregar a página em momentos inoportunos.
- Quebrar a expectativa de "app instalado".

Além disso, o `main.tsx` tem um listener cru de `focus` que não faz o que o `DECISOES-TECNICAS.md` (seção 6.3) descreve. O doc mente: o código real é mais simples e menos seguro.

### O que queremos no final

- O SW novo **espera** todos os tabs serem fechados OU a aba ir pra background antes de ativar.
- O reload é **transparente** (a usuária não vê prompt; o app só atualiza na próxima vez que ela volta).
- A lógica vive num hook testável, não em `main.tsx`.
- Sem mudança observável para a usuária em condições normais.

### Arquivos que serão alterados (5)

- `vite.config.ts`
- `public/sw-custom.js`
- `src/main.tsx`
- `src/App.tsx`
- `src/vite-env.d.ts`

### Arquivos novos (3)

- `src/core/hooks/useServiceWorkerUpdate.ts`
- `src/__tests__/sw-custom.spec.ts`
- `src/__tests__/useServiceWorkerUpdate.spec.ts`

### Métricas

| | Antes | Depois |
|---|---|---|
| Suites de teste | 9 | 11 |
| Testes | 67 | 77 (+10) |
| Linhas no `main.tsx` | 18 | 8 |
| `clientsClaim: true` | sim | **não** |
| `skipWaiting` automático | sim | **não** (controlado) |

---

## 1. Regras de execução para o agente

1. **Trabalhe em uma branch nova:** `plano/01-swc-update-seguro`.
2. **Execute as fases em ordem.** Não pule para a Fase N+1 sem a Fase N estar com testes verdes.
3. **Rode a suíte completa (`npm test`) ao final de cada fase.** Não confie só nos testes específicos da fase.
4. **Não modifique arquivos fora do escopo declarado** neste plano. Se algo parecer errado em outro arquivo, registre como observação ao final mas não corrija.
5. **Não faça commit de artefatos:** `dist/`, `node_modules/`, `.env`, `coverage/` já estão no `.gitignore`, mas confirme com `git status` antes de cada commit.
6. **Mensagens de commit** sigam o padrão dado. Não reformate, não encurte.
7. **Se um teste falhar:** NÃO commite a fase. Investigue, corrija, e só então prossiga.
8. **Se `tsc --noEmit` falhar:** mesma regra.
9. **Ao final do plano**, reporte ao usuário: lista de commits criados, contagem final de testes, e qualquer observação surgida.

---

## 2. Fase 0 — Baseline verde

### Objetivo
Confirmar que o ponto de partida está limpo antes de qualquer mudança.

### Ações

```bash
cd girassol-main
npm install
npm test
npm run build
```

### Critério de aceitação

- **9 suites, 67 testes** passando.
- `tsc --noEmit` sem erro.
- `dist/sw.js`, `dist/manifest.webmanifest` e `dist/index.html` gerados.

### Se falhar
PARE. Reporte o erro ao usuário antes de prosseguir. Não tente corrigir o baseline.

### Commit

```bash
git checkout -b plano/01-swc-update-seguro
git commit --allow-empty -m "chore: confirma baseline verde pré-mudança (67/67 testes, build OK)"
```

---

## 3. Fase 1 — Service Worker responde a `SKIP_WAITING`

### Objetivo
O SW custom (importado pelo Workbox) escuta mensagens do client e executa `self.skipWaiting()` sob comando. Isso destrava a Fase 3 (ativação controlada por background).

### Arquivo a alterar
`public/sw-custom.js`

### Diff esperado

Acrescente no topo do arquivo (antes do handler de `push`):

```js
// --- Atualização controlada por mensagem ---
// O client envia { type: 'SKIP_WAITING' } quando quer ativar este SW.
// Isso é seguro porque só ativamos em background (ver useServiceWorkerUpdate.ts).
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
```

Mantenha os handlers de `push` e `notificationclick` intactos.

### Arquivo novo
`src/__tests__/sw-custom.spec.ts`

```ts
import fs from 'fs';
import path from 'path';

describe('sw-custom.js — handlers críticos', () => {
  const swPath = path.join(__dirname, '../../public/sw-custom.js');
  const source = fs.readFileSync(swPath, 'utf-8');

  it('deve registrar listener de message para SKIP_WAITING', () => {
    expect(source).toMatch(/addEventListener\(\s*['"]message['"]/);
    expect(source).toMatch(/SKIP_WAITING/);
    expect(source).toMatch(/self\.skipWaiting\(\)/);
  });

  it('deve manter handler de push existente', () => {
    expect(source).toMatch(/addEventListener\(\s*['"]push['"]/);
    expect(source).toMatch(/showNotification/);
  });

  it('deve manter handler de notificationclick existente', () => {
    expect(source).toMatch(/addEventListener\(\s*['"]notificationclick['"]/);
  });
});
```

### Verificações

```bash
npm test -- sw-custom.spec.ts
npm test
```

Esperado: 3 novos testes passando. Suíte total: **70/70**.

### Commit

```bash
git add public/sw-custom.js src/__tests__/sw-custom.spec.ts
git commit -m "feat(sw): adiciona listener de message para skipWaiting controlado

- sw-custom.js agora responde a { type: 'SKIP_WAITING' }
- necessário para Fase 3 (ativação controlada por background)
- teste de fumaça: 3 novos specs verificam presença dos handlers"
```

---

## 4. Fase 2 — Config Workbox: `prompt` + ativação manual

### Objetivo
Parar o takeover agressivo do `autoUpdate`. O SW novo agora **espera** ordem do client pra ativar.

### Arquivo a alterar
`vite.config.ts`

### Diff esperado

Localize o bloco `VitePWA({` e altere:

```diff
 VitePWA({
   strategies: 'generateSW',
-  registerType: 'autoUpdate',
-  injectRegister: null,
+  registerType: 'prompt',
+  injectRegister: 'auto',
   includeAssets: ['favicon.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-192.png', 'icon-maskable-512.png'],
   workbox: {
     importScripts: ['/sw-custom.js'],
     globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
-    clientsClaim: true,
+    clientsClaim: false,
+    skipWaiting: false,
     cleanupOutdatedCaches: true,
     runtimeCaching: [ /* ... */ ]
   },
```

**NÃO altere** o array `manifest` nem o array `runtimeCaching`. Apenas as três linhas indicadas.

### Estender `src/__tests__/sw-custom.spec.ts`

Acrescente no final do arquivo:

```ts
describe('workbox build output — comportamento seguro', () => {
  const distSwPath = path.join(__dirname, '../../dist/sw.js');
  const distExists = fs.existsSync(distSwPath);

  (distExists ? it : it.skip)('sw.js gerado não deve auto-skipWaiting solto', () => {
    const buildSw = fs.readFileSync(distSwPath, 'utf-8');
    const matches = buildSw.match(/skipWaiting\s*\(\s*\)/g) || [];
    // O Workbox pode emitir seu próprio skipWaiting() em até 1 local
    // (handler de message do sw-custom). Não deve haver mais que isso.
    expect(matches.length).toBeLessThanOrEqual(1);
  });

  (distExists ? it : it.skip)('sw.js não deve chamar clientsClaim() no top-level', () => {
    const buildSw = fs.readFileSync(distSwPath, 'utf-8');
    expect(buildSw).not.toMatch(/^clientsClaim\s*\(\s*\)/m);
  });
});
```

### Verificações

```bash
npm run build
npm test
```

Ordem importa: `build` precisa rodar antes do `test` para o `dist/sw.js` existir. Se rodar `test` antes, os 2 testes de build serão `skip` (comportamento desejado).

Esperado: build OK, suíte total **70/70** (67 anteriores + 3 da Fase 1; os 2 desta fase são skip se não houver dist).

### Commit

```bash
git add vite.config.ts src/__tests__/sw-custom.spec.ts
git commit -m "chore(pwa): migra de autoUpdate para prompt com ativação manual

- registerType: 'autoUpdate' → 'prompt'
- clientsClaim: true → false (não toma controle imediatamente)
- skipWaiting: false explícito (não pula waiting state)
- agora SW novo espera ordem do client via postMessage
- testes de fumaça verificam que build não injeta skipWaiting solto"
```

---

## 5. Fase 3 — Hook `useServiceWorkerUpdate`

### Objetivo
Encapsular toda a lógica de update num hook testável, com:
- check inicial delayed (3s, não bloqueia primeiro paint)
- check periódico (30 min)
- check no `visibilitychange → visible` (throttle 60s)
- ativação **só** em `visibilitychange → hidden`
- reload transparente via `controllerchange`
- guard contra checks concorrentes

### Arquivo novo
`src/core/hooks/useServiceWorkerUpdate.ts`

```ts
import { useEffect, useRef, useState, useCallback } from 'react';

export type SWUpdateStatus = 'idle' | 'checking' | 'available' | 'activating' | 'activated';

interface UpdateState {
  status: SWUpdateStatus;
}

const INITIAL_CHECK_DELAY_MS = 3_000;
const PERIODIC_CHECK_INTERVAL_MS = 30 * 60 * 1000;
const VISIBLE_THROTTLE_MS = 60_000;

export function useServiceWorkerUpdate(): UpdateState {
  const [state, setState] = useState<UpdateState>({ status: 'idle' });
  const refreshingRef = useRef(false);
  const checkInFlightRef = useRef(false);

  const checkForUpdate = useCallback(async () => {
    if (!('serviceWorker' in navigator)) return;
    if (checkInFlightRef.current) return;
    checkInFlightRef.current = true;
    setState((s) => ({ ...s, status: 'checking' }));

    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.update();
      if (reg.waiting) {
        setState((s) => ({ ...s, status: 'available' }));
      } else {
        setState((s) => ({ ...s, status: 'idle' }));
      }
    } catch (err) {
      console.warn('[SW] update() falhou:', err);
      setState((s) => ({ ...s, status: 'idle' }));
    } finally {
      checkInFlightRef.current = false;
    }
  }, []);

  const activateWaiting = useCallback((waiting: ServiceWorker | null) => {
    if (!waiting) return;
    waiting.postMessage({ type: 'SKIP_WAITING' });
    setState((s) => ({ ...s, status: 'activating' }));
  }, []);

  // Detecta novo controller e recarrega uma vez
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const onControllerChange = () => {
      if (refreshingRef.current) return;
      refreshingRef.current = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    return () => navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
  }, []);

  // Loop de verificação
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const initial = setTimeout(checkForUpdate, INITIAL_CHECK_DELAY_MS);
    const interval = setInterval(checkForUpdate, PERIODIC_CHECK_INTERVAL_MS);

    let lastVisibleCheck = 0;
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        const now = Date.now();
        if (now - lastVisibleCheck < VISIBLE_THROTTLE_MS) return;
        lastVisibleCheck = now;
        checkForUpdate();
      } else {
        // Hidden: se há waiting worker, ativa agora
        navigator.serviceWorker.ready.then((reg) => {
          if (reg.waiting) {
            activateWaiting(reg.waiting);
            setState((s) => ({ ...s, status: 'activated' }));
          }
        });
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearTimeout(initial);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [checkForUpdate, activateWaiting]);

  return state;
}
```

### Arquivo novo
`src/__tests__/useServiceWorkerUpdate.spec.ts`

```ts
import { renderHook, act } from '@testing-library/react';
import { useServiceWorkerUpdate } from '../core/hooks/useServiceWorkerUpdate';

const mockUpdate = jest.fn();
const mockPostMessage = jest.fn();

const mockReg: any = {
  update: mockUpdate,
  waiting: null as ServiceWorker | null,
  installing: null,
  active: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockReg.waiting = null;
  (global as any).navigator.serviceWorker = {
    ready: Promise.resolve(mockReg),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    controller: null,
  };
  Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true, configurable: true });
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useServiceWorkerUpdate', () => {
  it('deve iniciar em status idle', () => {
    const { result } = renderHook(() => useServiceWorkerUpdate());
    expect(result.current.status).toBe('idle');
  });

  it('deve chamar update() após delay inicial de 3s', async () => {
    renderHook(() => useServiceWorkerUpdate());
    expect(mockUpdate).not.toHaveBeenCalled();
    jest.advanceTimersByTime(3_000);
    await act(async () => { await Promise.resolve(); });
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });

  it('deve chamar update() periodicamente a cada 30min', async () => {
    renderHook(() => useServiceWorkerUpdate());
    jest.advanceTimersByTime(3_000);
    await act(async () => { await Promise.resolve(); });
    expect(mockUpdate).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(30 * 60 * 1000);
    await act(async () => { await Promise.resolve(); });
    expect(mockUpdate).toHaveBeenCalledTimes(2);
  });

  it('deve throttlar checks em visibilitychange → visible', async () => {
    renderHook(() => useServiceWorkerUpdate());
    jest.advanceTimersByTime(3_000);
    await act(async () => { await Promise.resolve(); });
    const callsAfterInit = mockUpdate.mock.calls.length;

    Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true, configurable: true });
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    await act(async () => { await Promise.resolve(); });

    expect(mockUpdate.mock.calls.length).toBe(callsAfterInit);
  });

  it('deve permitir check em visibilitychange → visible após 60s', async () => {
    renderHook(() => useServiceWorkerUpdate());
    jest.advanceTimersByTime(3_000);
    await act(async () => { await Promise.resolve(); });
    const callsAfterInit = mockUpdate.mock.calls.length;

    Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true, configurable: true });
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    await act(async () => { await Promise.resolve(); });
    jest.advanceTimersByTime(60_000);
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    await act(async () => { await Promise.resolve(); });

    expect(mockUpdate.mock.calls.length).toBe(callsAfterInit + 1);
  });

  it('deve postar SKIP_WAITING quando vai pra hidden e há worker waiting', async () => {
    const waiting = { postMessage: mockPostMessage } as unknown as ServiceWorker;
    mockReg.waiting = waiting;

    renderHook(() => useServiceWorkerUpdate());

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', writable: true, configurable: true });
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();
    });

    expect(mockPostMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
  });

  it('não deve chamar update() se serviceWorker não existe', () => {
    const original = (global as any).navigator.serviceWorker;
    delete (global as any).navigator.serviceWorker;
    try {
      renderHook(() => useServiceWorkerUpdate());
      jest.advanceTimersByTime(5_000);
      expect(mockUpdate).not.toHaveBeenCalled();
    } finally {
      (global as any).navigator.serviceWorker = original;
    }
  });
});
```

### Verificações

```bash
npm test -- useServiceWorkerUpdate.spec.ts
npm test
```

Esperado: 7 novos testes passando. Suíte total: **77/77**.

### Atenção
- `jest-environment-jsdom@29.7.0` já expõe `navigator.serviceWorker` no jsdom. O mock acima é necessário para isolar o hook de chamadas reais.
- O `@testing-library/react` deve estar em `devDependencies` (já está no projeto). Caso `renderHook` ou `act` não sejam encontrados, o hook desse plano não pode ser entregue como está.

### Commit

```bash
git add src/core/hooks/useServiceWorkerUpdate.ts src/__tests__/useServiceWorkerUpdate.spec.ts
git commit -m "feat(sw): adiciona hook de update com visibilitychange

- check inicial delayed 3s (não bloqueia primeiro paint)
- check periódico a cada 30min
- throttle de 60s em visibilitychange → visible
- ativação (SKIP_WAITING) SÓ quando aba vai pra hidden
- reload transparente via controllerchange (uma vez por refreshingRef)
- guard contra checks concorrentes (checkInFlightRef)
- 7 specs cobrem: estado inicial, periodicidade, throttle,
  ativação em hidden, ausência de SW"
```

---

## 6. Fase 4 — `main.tsx` e `App.tsx` consomem o hook

### Objetivo
Remover o `focus` listener cru do `main.tsx` e fazer o `App` chamar o hook.

### Arquivo a alterar
`src/main.tsx`

### Diff esperado

```diff
 import React from 'react';
 import ReactDOM from 'react-dom/client';
 import { registerSW } from 'virtual:pwa-register';
 import App from './App';

-const updateSW = registerSW({
-  immediate: true,
-});
-
-let lastFocusCheck = 0;
-
-window.addEventListener('focus', () => {
-  const now = Date.now();
-  if (now - lastFocusCheck < 60_000) return;
-  lastFocusCheck = now;
-  updateSW?.();
-});
+registerSW({ immediate: true });

 ReactDOM.createRoot(document.getElementById('root')!).render(
   <React.StrictMode>
     <App />
   </React.StrictMode>
 );
```

### Arquivo a alterar
`src/App.tsx`

### Diff esperado

```diff
 import { useState } from 'react';
+import { useServiceWorkerUpdate } from './core/hooks/useServiceWorkerUpdate';
 import { Header } from './ui/components/Header';
 // ... resto dos imports existentes preservados

 export default function App() {
+  useServiceWorkerUpdate();
+
   const [abaAtiva, setAbaAtiva] = useState('diario');
   // ... resto do componente preservado
 }
```

NÃO altere mais nada no `App.tsx`. O `useServiceWorkerUpdate` deve ser a **primeira linha** do corpo da função.

### Verificações

```bash
npm run lint
npm test
npm run build
```

Esperado:
- `tsc --noEmit` limpo.
- Suíte **77/77** verde.
- Build OK.

### Commit

```bash
git add src/main.tsx src/App.tsx
git commit -m "refactor(sw): delega controle de update ao hook

- main.tsx não tem mais lógica de update (apenas registra SW inicial)
- App.tsx chama useServiceWorkerUpdate() (roda em silêncio)
- todo o ciclo de update agora vive em useServiceWorkerUpdate
- sem mudança de comportamento observável para o usuário"
```

---

## 7. Fase 5 — `vite-env.d.ts` com tipo correto

### Objetivo
O tipo do `registerSW` retornado deve refletir o uso real da lib `vite-plugin-pwa@0.17`.

### Arquivo a alterar
`src/vite-env.d.ts`

### Diff esperado

```diff
 /// <reference types="vite/client" />

 declare module 'virtual:pwa-register' {
   export interface RegisterSWOptions {
     immediate?: boolean;
+    onNeedRefresh?: () => void;
+    onOfflineReady?: () => void;
+    onRegisteredSW?: (swUrl: string, registration: ServiceWorkerRegistration | undefined) => void;
+    onRegisterError?: (error: any) => void;
   }
-  export function registerSW(options?: RegisterSWOptions): (reloadPage?: boolean) => void;
+  export function registerSW(options?: RegisterSWOptions): (reloadPage?: boolean) => Promise<void>;
 }
```

### Verificações

```bash
npm run lint
npm test
```

Esperado: `tsc` limpo, suíte **77/77**.

### Commit

```bash
git add src/vite-env.d.ts
git commit -m "chore(types): corrige tipo de registerSW para vite-plugin-pwa@0.17

- adiciona callbacks onNeedRefresh/onOfflineReady/onRegisteredSW/onRegisterError
- ajusta retorno para Promise<void> (consistente com 0.17.x)
- mantém compatibilidade com chamada atual registerSW({ immediate: true })"
```

---

## 8. Fase 6 — Validação final

### Objetivo
Garantir suíte completa, build, e zero regressão.

### Ações

```bash
npm run lint
npm test
npm run build
ls -la dist/sw.js dist/manifest.webmanifest dist/index.html
```

### Critério de aceitação

- `tsc --noEmit` sem erro.
- **77/77 testes** passando.
- `dist/sw.js`, `dist/manifest.webmanifest` e `dist/index.html` presentes.
- Nenhum warning crítico no build.

### Commit (allow-empty, é um marco)

```bash
git commit --allow-empty -m "chore: valida suíte completa e build de produção (77/77 testes)"
```

---

## 9. Fase 7 — Push

### Objetivo
Enviar a branch para revisão.

### Ações

```bash
# Revise os commits antes de empurrar
git log --oneline main..HEAD

# Confirme que não há artefatos
git status

# Push
git push -u origin plano/01-swc-update-seguro
```

### Sugestão de título e descrição de PR

> **Título:** `Plano 01: Atualização segura do Service Worker`
>
> **Descrição:**
> ```
> Substitui autoUpdate agressivo por update controlado por visibilitychange.
>
> ## Mudanças
> - vite-plugin-pwa: autoUpdate → prompt; clientsClaim e skipWaiting desativados
> - sw-custom.js: novo listener de message para SKIP_WAITING
> - useServiceWorkerUpdate: hook com check delayed, periódico, throttle e ativação em background
> - main.tsx: removido listener de focus cru
> - App.tsx: consome o hook
> - vite-env.d.ts: tipo de registerSW corrigido
>
> ## Testes
> 67 → 77 (+10 specs novos)
> - sw-custom.spec.ts: 5 testes
> - useServiceWorkerUpdate.spec.ts: 7 testes
>
> ## Compatibilidade
> Sem mudanças em API, store, use-case, UI. Apenas comportamento interno do SW.
> ```

---

## 10. Critérios globais de pronto

O plano está completo quando **todos** os itens abaixo forem verdade:

- [ ] Branch `plano/01-swc-update-seguro` existe.
- [ ] 8 commits foram criados (Fases 0–6 + push na 7).
- [ ] `npm test` reporta **77/77 testes** passando.
- [ ] `npm run build` finaliza sem warning crítico.
- [ ] `dist/sw.js` contém `skipWaiting()` apenas dentro de handler de `message` (não solto).
- [ ] `dist/sw.js` NÃO contém `clientsClaim()` no top-level.
- [ ] Branch foi enviada com `git push` e o PR está aberto.

---

## 11. Observações esperadas após execução

1. Em desenvolvimento, `StrictMode` do React monta o hook duas vezes. O `useRef` (não `useState`) protege contra leak de estado. Isso é correto e testado.
2. O build do SW (`dist/sw.js`) é gerado pelo Workbox; ele importa o `sw-custom.js` (passa a incluir nosso novo listener). Não é necessário concatenar manualmente.
3. O reload via `controllerchange` é **uma vez por sessão** (guardado por `refreshingRef`). Em produção, a usuária nunca verá prompt — o app só atualiza quando ela volta a aba após o SW novo ter ativado em background.
4. iOS Safari continua capenga com SW; o `visibilitychange` ainda funciona, mas a ativação pode atrasar até o usuário fechar e reabrir a aba. Comportamento documentado, sem regressão.
5. `@vitejs/plugin-react` em `dev` com HMR não conflita com este plano porque o hook só manipula `serviceWorker`, não o ciclo de render do React.

---

## 12. O que NÃO fazer (anti-patterns)

- ❌ **Não usar `confirm()` ou `window.prompt()`** para perguntar à usuária se quer atualizar. O `registerType: 'prompt'` da Vite-PWA **não** dispara um prompt de UI — ele apenas deixa a função `updateSW` ser chamada manualmente. Se quiser um prompt visual, crie um componente React à parte em outro plano.
- ❌ **Não chamar `skipWaiting()` em mais de um lugar.** Apenas dentro do listener de `message` no `sw-custom.js`.
- ❌ **Não remover os handlers de `push` e `notificationclick`** do `sw-custom.js`. Eles são críticos para as notificações.
- ❌ **Não importar `useServiceWorkerUpdate` em mais de um componente.** Apenas em `App.tsx`. Hook global por design.
- ❌ **Não usar `useState` para `refreshingRef`.** É ref, não state.
- ❌ **Não criar nova pasta `src/hooks/`**. O projeto convenciona `src/core/hooks/`. Siga o padrão.
- ❌ **Não modificar `tsconfig.json`** (a config atual já suporta tudo deste plano).

---

## 13. Apêndice — Comandos rápidos de diagnóstico

Se algo der errado durante a execução:

```bash
# Verificar type-check
npx tsc --noEmit

# Rodar apenas os testes novos
npm test -- sw-custom.spec.ts
npm test -- useServiceWorkerUpdate.spec.ts

# Inspecionar o SW gerado
grep -n "skipWaiting" dist/sw.js
grep -n "clientsClaim" dist/sw.js

# Forçar uma nova versão do SW
# 1) Edite qualquer arquivo (ex: vite.config.ts)
# 2) npm run build
# 3) Sirva o dist/ e abra DevTools → Application → Service Workers
# 4) Clique "Update on reload" e recarregue
```

---

*Fim do Plano 01 — Atualização Segura do Service Worker*

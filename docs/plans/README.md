# Planos de Hardening — Projeto Meu Girassol

> Pacote de 4 planos de correção derivados da auditoria de 16/06/2026.
> Cada plano é **independente** mas pressupõe os anteriores mergeados.

## Ordem de execução

| # | Plano | Cobre | Esforço | Testes após |
|---|---|---|---|---|
| 01 | [Atualização Segura do SW](./PLANO-01-SW-UPDATE-SEGURA.md) | `autoUpdate` agressivo → update controlado por `visibilitychange` | ~2h | 67 → 77 |
| 02 | [Hardening das APIs](./PLANO-02-HARDENING-APIS.md) | Zod nos endpoints, rate limit, classificação de erro, VAPID por env | ~3h | 77 → 97 |
| 03 | [TestarPush via endpoint server-side](./PLANO-03-ADMIN-SERVER-SIDE.md) | CRON_SECRET sai do browser → `/api/test-push` autenticado | ~2h | 97 → 101 |
| 04 | [Migração @vercel/kv → @upstash/redis](./PLANO-04-MIGRACAO-UPSTASH.md) | Dep deprecated → package oficial, housekeeping, README | ~2h | 101 → 108 |

**Total:** ~9h de trabalho, **41 novos testes**, 4 branches, 25 commits.

## Como usar

1. Baixe o zip `audit-planos.zip` (gerado em `/workspace/audit-planos.zip`).
2. Extraia a pasta `planos/` para `docs/plans/` no repo.
3. Comece pelo Plano 01, na branch `plano/01-swc-update-seguro`.
4. Abra um PR por plano.
5. Após merge, puxe `main` e siga para o próximo.

## O que NÃO está nos planos (intencional)

- UI/visual (cores, fontes, layout).
- Migração `vite-plugin-pwa` v0.17 → v1 (alto risco, baixo retorno).
- Internacionalização.
- Adição de autenticação de usuário.
- Backup automático de dados (além do push subscription identifier).
- Análise de padrões / "engine motivacional" mencionado em `INSTRUCTIONS-AGENT.md`.

Esses itens são roadmap futuro, não correções.

## Convenções dos planos

Cada plano segue o mesmo formato:

1. **Fase 0:** baseline verde (testes + build OK).
2. **Fases 1..N:** cada uma com objetivo, arquivos, diff, código, testes, commit.
3. **Validação final:** suíte completa + build.
4. **Push:** branch enviada com PR descritivo.

Mensagens de commit seguem Conventional Commits. Não encurte.

## Resumo da auditoria original

Veja `/workspace/audit/girassol-main/` (não incluso no zip) para o projeto completo.
O diagnóstico detalhado está em `/workspace/audit-planos.zip` (versão antiga, 1 plano)
ou reconstruído na conversa com o usuário.

Categorias de achados:

- **🔴 Críticos (servidor):** 3 — todos cobertos pelos Planos 02 e 03
- **🟠 Altos:** 2 — cobertos pelo Plano 02
- **🟡 Médios:** 13 — 8 cobertos pelos 4 planos; 5 são roadmap
- **🟢 Baixos:** 10 — 4 cobertos; 6 são polish

**Cobertura:** ~70% dos achados são tratados por estes 4 planos.
Os 30% restantes são decisões de design, não defeitos.

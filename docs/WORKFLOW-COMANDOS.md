# Workflow de Comandos — Projeto Meu Girassol

> Todos os comandos executados no projeto, organizados por categoria.

---

## Desenvolvimento

```bash
# Iniciar servidor de desenvolvimento (hot reload)
npm run dev

# Acessar em: http://localhost:5173
```

## Build e Preview

```bash
# Build de produção (tsc + vite build → dist/)
npm run build

# Preview do build localmente
npm run preview
```

## Testes

```bash
# Executar todos os testes (101 testes, 14 suítes)
npm test

# Executar com cobertura
npm run test:coverage

# Executar suíte específica
npm test -- src/__tests__/outbox.spec.ts

# Executar teste específico por nome
npm test -- -t "deve criar evento"
```

## Type Checking

```bash
# Verificar erros de tipo TypeScript (sem gerar saída)
npm run lint
```

## Git — Fluxo de Trabalho

```bash
# Ver status do repositório
git status

# Ver últimos commits
git log --oneline -10

# Criar branch de feature
git checkout -b feature/nome-da-feature

# Adicionar e commitar
git add .
git commit -m "feat: descrição da mudança"

# Push para origin
git push origin main

# Sincronizar staging com main
git push origin main:staging

# Merge de feature no main
git checkout main
git merge feature/nome-da-feature
git push origin main
git push origin main:staging

# Deletar branch após merge
git branch -d feature/nome-da-feature
git push origin --delete feature/nome-da-feature
```

## Deploy (Automático)

```bash
# Produção: push para main → Vercel deploy automático
git push origin main

# Staging: push para staging → Vercel preview automático
git push origin main:staging
```

## Variáveis de Ambiente (Vercel)

```bash
# Variáveis configuradas no Vercel Dashboard:
# NEXT_PUBLIC_VAPID_PUBLIC_KEY   — Chave pública VAPID (visível no cliente)
# VITE_VAPID_PUBLIC_KEY          — Chave pública VAPID (alias para compatibilidade)
# VAPID_PRIVATE_KEY              — Chave privada VAPID (servidor apenas)
# UPSTASH_REDIS_REST_URL         — URL Upstash Redis
# UPSTASH_REDIS_REST_TOKEN       — Token Upstash Redis
# CRON_SECRET                    — Segredo para autenticação do cron
# VITE_SYNC_API_KEY              — Chave de API para autenticação do sync
```

## Redis (Upstash) — Manutenção

```bash
# Instalar CLI (uma vez)
npm install -g @upstash/redis-cli

# Exportar credenciais
export UPSTASH_REDIS_REST_URL="https://xxx.upstash.io"
export UPSTASH_REDIS_REST_TOKEN="xxx"

# Listar todas as chaves
upstash-cli keys "*"

# Contar chaves por padrão
upstash-cli scan --match "lembrete:*" | wc -l
upstash-cli scan --match "event:*" | wc -l

# Limpar eventos antigos
upstash-cli scan --match "event:*" --count 1000 | xargs -I {} upstash-cli del {}

# Reset completo (emergência)
upstash-cli keys "lembrete:*" | xargs -I {} upstash-cli del {}
upstash-cli keys "processed:*" | xargs -I {} upstash-cli del {}
upstash-cli keys "event:*" | xargs -I {} upstash-cli del {}
```

## Resumo Rápido

| Ação | Comando |
|------|---------|
| Desenvolver | `npm run dev` |
| Buildar | `npm run build` |
| Testar | `npm test` |
| Type check | `npm run lint` |
| Deploy prod | `git push origin main` |
| Deploy staging | `git push origin main:staging` |

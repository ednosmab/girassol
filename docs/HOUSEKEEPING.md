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

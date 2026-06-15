# 🧪 Guia de Testes - Sistema de Notificações Push

## Pré-requisitos

- App deployado na Vercel e funcionando
- Upstash Redis conectado via Vercel KV
- Variáveis de ambiente configuradas (VAPID keys, KV, CRON_SECRET)
- Service Worker registrado no navegador

---

## Teste 1: Permissão de Notificação (Local)

1. Abra o app no celular ou Chrome desktop
2. Clique em qualquer botão de cuidado ("Registrei que Reguei")
3. **Esperado:** Browser exibe popup "Permitir notificações?"
4. Clique "Permitir"
5. **Esperado:** Notificação nativa aparece imediatamente

---

## Teste 2: Push Subscription (Local)

1. Abra Chrome → DevTools (F12)
2. Vá em **Application** → **Service Workers**
3. **Esperado:** SW registrado com status "activated and is running"
4. Vá em **Application** → **Push Messaging**
5. **Esperado:** Subscription listada com endpoint

---

## Teste 3: Salvar Subscription no Servidor

### Via curl:

```bash
# Substitua <DOMINIO> pelo domínio do app na Vercel
# Substitua o body por uma subscription real (obtida no Teste 2)

curl -X POST https://<DOMINIO>/api/salvar-subscription \
  -H "Content-Type: application/json" \
  -d '{
    "tipo": "rega",
    "subscription": {
      "endpoint": "https://fcm.googleapis.com/fcm/send/...",
      "keys": {
        "p256dh": "BASE64_AQUI",
        "auth": "BASE64_AQUI"
      }
    },
    "timestamp": "2026-06-14T12:00:00.000Z"
  }'
```

**Esperado:**
```json
{
  "success": true,
  "agendadoPara": "2026-06-16T08:00:00.000Z"
}
```

---

## Teste 4: Verificar Dados no KV

1. Vercel Dashboard → **Storage** → **Upstash Redis**
2. Clique em **Browse** ou **Query**
3. Execute: `KEYS lembrete:*`
4. **Esperado:** Chave com formato `lembrete:<id>:rega` contendo:
   - `tipo`: "rega"
   - `subscription`: objeto com endpoint e keys
   - `dataDisparo`: data + 2 dias às 08:00
   - `processado`: false

---

## Teste 5: Cron Manual (verificar-lembretes)

### Via curl:

```bash
# Substitua <CRON_SECRET> pelo valor da variável de ambiente
# Substitua <DOMINIO> pelo domínio do app

curl -H "Authorization: Bearer <CRON_SECRET>" \
  https://<DOMINIO>/api/verificar-lembretes
```

**Esperado (se dataDisparo já passou):**
```json
{
  "processados": 1,
  "enviados": 1
}
```

**Esperado (se dataDisparo ainda não passou):**
```json
{
  "processados": 1,
  "enviados": 0
}
```

### Sem auth (deve retornar 401 em produção):

```bash
curl https://<DOMINIO>/api/verificar-lembretes
```

**Esperado:**
```json
{
  "error": "Não autorizado"
}
```

---

## Teste 6: Push no Celular

1. Execute o Teste 5 (cron manual)
2. Olhe a tela de bloqueio do celular
3. **Esperado:** Notificação "🌻 Meu Girassol" com corpo baseado no tipo:
   - Rega: "💧 Hora de regar o seu Girassol..."
   - Sol: "☀️ O dia começou! Que tal colocar o Girassol..."
   - Adubo: "🌱 Dia de nutrição! Hora de colocar o fertilizante..."
4. Clique na notificação
5. **Esperado:** App abre na página inicial

---

## Teste 7: Countdown no App

1. Abra o app
2. Clique "Registrei que Reguei Hoje"
3. **Esperado:** Card "Última Rega" mostra "Próxima em: 2 dia(s)"
4. Clique "Coloquei o Fertilizante"
5. **Esperado:** Card "Último Adubo" mostra "Próxima em: 15 dia(s)"

---

## Teste 8: Notificação Diária (Sol)

1. Registre "Garanti as 6h de Sol Forte"
2. Verifique no KV: chave `lembrete:<id>:sol` com dataDisparo = amanhã às 8h
3. Execute o cron manual
4. **Esperado:** Chave NÃO é deletada (recurring)
5. Nova dataDisparo = depois de amanhã às 8h

---

## Troubleshooting

| Problema | Possível causa | Solução |
|---|---|---|
| Notificação não aparece | Permissão não concedida | Verificar `Notification.permission` no console |
| Push subscription null | SW não registrado | Recarregar página, verificar DevTools |
| API retorna 401 | CRON_SECRET errado | Verificar variável no Vercel Dashboard |
| API retorna 500 | KV não conectado | Verificar variáveis KV_* no Vercel Dashboard |
| Cron não executa | vercel.json não deployado | Verificar se `crons` está no vercel.json da branch main |

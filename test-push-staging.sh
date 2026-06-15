#!/bin/bash

set -e

echo "=== 🌻 Teste de Push - Meu Girassol ==="
echo ""

# Pedir URL do staging
read -p "URL do deploy staging (ex: https://girassol-xxxxx.vercel.app): " STAGING_URL
STAGING_URL="${STAGING_URL%/}"

# Pedir CRON_SECRET
read -sp "CRON_SECRET: " CRON_SECRET
echo ""

if [ -z "$STAGING_URL" ] || [ -z "$CRON_SECRET" ]; then
  echo "Erro: preencha todos os campos"
  exit 1
fi

echo ""
echo "1. Verificando endpoint /api/verificar-lembretes..."
RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer $CRON_SECRET" \
  "$STAGING_URL/api/verificar-lembretes")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
  echo "   ✅ Cron executado com sucesso"
  echo "   $BODY" | python3 -m json.tool 2>/dev/null || echo "   $BODY"
else
  echo "   ❌ Erro HTTP $HTTP_CODE"
  echo "   $BODY"
  exit 1
fi

echo ""
echo "2. Verificando chaves no KV..."
# Este endpoint precisa de outro approach - vamos usar o resultado do curl anterior
ENVIADOS=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('enviados',0))" 2>/dev/null || echo "0")
PROCESSADOS=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('processados',0))" 2>/dev/null || echo "0")

echo "   Processados: $PROCESSADOS"
echo "   Enviados: $ENVIADOS"

if [ "$ENVIADOS" -gt 0 ]; then
  echo ""
  echo "🎉 Push disparado com sucesso! Verifique seu celular."
elif [ "$PROCESSADOS" -gt 0 ]; then
  echo ""
  echo "⏰ Lembretes encontrados mas nenhum vencido. Agende um teste primeiro."
else
  echo ""
  echo "📭 Nenhum lembrete encontrado. Registre um cuidado no app primeiro."
fi

echo ""
echo "=== Fim do teste ==="

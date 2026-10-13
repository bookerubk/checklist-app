#!/usr/bin/env bash
# Generate OpenAPI for cloud.ru Evolution API Gateway → Yandex webapp CF
# Evolution не имеет yc-аналога CLI: создаём YAML и инструкции для консоли.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT_DIR/deploy/test/load-env.sh"

: "${WEBAPP_FN_NAME:=checklist-webapp-test}"
: "${APIGW_NAME:=checklist-webapp-test-gw}"

# Resolve WEBAPP_FN_ID
WEBAPP_FN_ID="${WEBAPP_FN_ID:-}"
if [[ -z "$WEBAPP_FN_ID" && -f "$ROOT_DIR/deploy/test/.last-webapp-id" ]]; then
  WEBAPP_FN_ID=$(cat "$ROOT_DIR/deploy/test/.last-webapp-id")
fi
if [[ -z "$WEBAPP_FN_ID" ]]; then
  if command -v yc >/dev/null 2>&1 && [[ -n "${YC_FOLDER_ID:-}" ]]; then
    WEBAPP_FN_ID=$(yc serverless function get --name "$WEBAPP_FN_NAME" --folder-id "$YC_FOLDER_ID" --format json 2>/dev/null | jq -r '.id // empty' || true)
  fi
fi
if [[ -z "$WEBAPP_FN_ID" || "$WEBAPP_FN_ID" == "null" ]]; then
  echo "❌ Нужен WEBAPP_FN_ID (или .last-webapp-id / yc + WEBAPP_FN_NAME)"
  echo "   Сначала: npm run deploy:test:webapp"
  exit 1
fi

SPEC_SRC="$ROOT_DIR/deploy/test/api-gateway-cloudru-evolution.yaml"
OUT_DIR="$ROOT_DIR/deploy/test/generated"
mkdir -p "$OUT_DIR"
SPEC_OUT="$OUT_DIR/api-gateway-cloudru-evolution.generated.yaml"

sed -e "s/\${WEBAPP_FN_ID}/$WEBAPP_FN_ID/g" "$SPEC_SRC" > "$SPEC_OUT"

FN_URL="https://functions.yandexcloud.net/${WEBAPP_FN_ID}"

echo ""
echo "========================================="
echo "✅ OpenAPI для cloud.ru Evolution API Gateway готов"
echo "========================================="
echo "Файл: $SPEC_OUT"
echo "Backend CF: $FN_URL"
echo "Health CF:  ${FN_URL}/health"
echo ""
echo "--- Консоль cloud.ru ---"
echo "1. Разработка → API Gateway → Создать API-шлюз"
echo "2. Имя: ${APIGW_NAME}"
echo "3. Загрузить YAML: $SPEC_OUT"
echo "4. Создать"
echo ""
echo "Если catch-all /{path} не подхватился как wildcard:"
echo "  • Добавьте правило «Маршрутизация запросов»"
echo "  • URI proxy: /*   (или /assets* и /* по необходимости)"
echo "  • Upstream: https://functions.yandexcloud.net"
echo "  • Rewrite path: /${WEBAPP_FN_ID}\$uri  (или через x-cloud-proxy-rewrite)"
echo ""
echo "После создания скопируйте URL шлюза (*.apigw.cloud.ru) и:"
echo "  echo 'https://XXXX.apigw.cloud.ru' > deploy/test/.last-gateway-url"
echo "  npm run deploy:test:smoke"
echo "========================================="

# Не перезаписываем .last-gateway-url автоматически (URL известен только после консоли)
echo "$FN_URL" > "$ROOT_DIR/deploy/test/.last-webapp-url"
echo "$WEBAPP_FN_ID" > "$ROOT_DIR/deploy/test/.last-webapp-id"

echo ""
echo "Подсказка: пока шлюз не создан, smoke можно гнать напрямую на CF:"
echo "  BASE_URL=$FN_URL npm run deploy:test:smoke"

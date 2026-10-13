#!/usr/bin/env bash
# Deploy webapp as Yandex Cloud Function (TEST) — NO Serverless Containers
# SPA zip may exceed 3.5MB → Object Storage path via cf-package-source.sh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT_DIR/deploy/test/load-env.sh"
# shellcheck disable=SC1091
source "$ROOT_DIR/deploy/test/cf-package-source.sh"

: "${WEBAPP_FN_NAME:=checklist-webapp-test}"
: "${WEBAPP_FN_RUNTIME:=nodejs18}"
: "${WEBAPP_FN_ENTRYPOINT:=index.handler}"
: "${WEBAPP_FN_MEMORY:=512m}"
: "${WEBAPP_FN_TIMEOUT:=30s}"

ZIP_PATH="$ROOT_DIR/webapp-function/webapp-function.zip"

echo "=== pack ==="
bash "$ROOT_DIR/deploy/test/pack-webapp-fn.sh" "$ZIP_PATH"
ls -lh "$ZIP_PATH"

echo "=== resolve package source (direct vs Object Storage) ==="
mapfile -t CF_VERSION_SOURCE_ARGS < <(cf_package_source_args "$ZIP_PATH" "webapp")
if [[ ${#CF_VERSION_SOURCE_ARGS[@]} -lt 2 ]]; then
  echo "❌ failed to resolve package source"
  exit 1
fi
echo "   yc args: ${CF_VERSION_SOURCE_ARGS[*]}"

echo "=== ensure function exists ==="
if ! yc serverless function get --name "$WEBAPP_FN_NAME" --folder-id "$YC_FOLDER_ID" >/dev/null 2>&1; then
  yc serverless function create --name "$WEBAPP_FN_NAME" --folder-id "$YC_FOLDER_ID"
  echo "Created function $WEBAPP_FN_NAME"
else
  echo "Function $WEBAPP_FN_NAME already exists"
fi

ENV_FLAGS=(
  --environment "APP_ENV=${APP_ENV:-test}"
  --environment "NODE_ENV=production"
  --environment "ALLOW_UNAUTH_API=${ALLOW_UNAUTH_API:-true}"
  --environment "YDB_PROXY_TIMEOUT_MS=${YDB_PROXY_TIMEOUT_MS:-25000}"
)
if [[ -n "${YDB_FUNCTION_URL:-}" ]]; then
  ENV_FLAGS+=(--environment "YDB_FUNCTION_URL=${YDB_FUNCTION_URL}")
elif [[ -f "$ROOT_DIR/deploy/test/.last-ydb-url" ]]; then
  # auto-pick last deployed ydb url if not set
  AUTO_YDB=$(cat "$ROOT_DIR/deploy/test/.last-ydb-url")
  ENV_FLAGS+=(--environment "YDB_FUNCTION_URL=${AUTO_YDB}")
  echo "ℹ️  Using YDB_FUNCTION_URL from .last-ydb-url: $AUTO_YDB"
fi
if [[ -n "${CORS_ORIGIN:-}" ]]; then
  ENV_FLAGS+=(--environment "CORS_ORIGIN=${CORS_ORIGIN}")
fi

echo "=== create version ==="
yc serverless function version create \
  --function-name "$WEBAPP_FN_NAME" \
  --folder-id "$YC_FOLDER_ID" \
  --runtime "$WEBAPP_FN_RUNTIME" \
  --entrypoint "$WEBAPP_FN_ENTRYPOINT" \
  --memory "$WEBAPP_FN_MEMORY" \
  --execution-timeout "$WEBAPP_FN_TIMEOUT" \
  --service-account-id "$YC_SERVICE_ACCOUNT_ID" \
  "${CF_VERSION_SOURCE_ARGS[@]}" \
  "${ENV_FLAGS[@]}"

echo "=== public invoke (TEST only) ==="
yc serverless function allow-unauthenticated-invoke "$WEBAPP_FN_NAME" --folder-id "$YC_FOLDER_ID" || true

FN_ID=$(yc serverless function get --name "$WEBAPP_FN_NAME" --folder-id "$YC_FOLDER_ID" --format json | jq -r '.id')
FN_URL="https://functions.yandexcloud.net/${FN_ID}"

echo ""
echo "========================================="
echo "✅ TEST webapp Cloud Function deployed"
echo "ID:  $FN_ID"
echo "URL: $FN_URL"
echo "Health: ${FN_URL}?__path=/health"
echo "  (Yandex CF rejects paths after function id — use ?__path= or API Gateway)"
echo "========================================="

echo "$FN_URL" > "$ROOT_DIR/deploy/test/.last-webapp-url"
echo "$FN_ID" > "$ROOT_DIR/deploy/test/.last-webapp-id"

sleep 2
# Direct invoke has NO URL path support:
#   /<id>/health → 400 invalid functionID
# Path via query ?__path= (cloud.ru Evolution) or Yandex API Gateway integration.
code=$(curl -s -o /tmp/cf-health.json -w "%{http_code}" "${FN_URL}?__path=/health" || echo 000)
echo "Health HTTP: $code"
cat /tmp/cf-health.json 2>/dev/null || true
echo ""

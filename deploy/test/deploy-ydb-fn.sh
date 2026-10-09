#!/usr/bin/env bash
# Deploy YDB proxy Cloud Function (TEST)
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT_DIR/deploy/test/load-env.sh"

: "${YDB_FN_NAME:=checklist-ydb-proxy-test}"
: "${YDB_FN_RUNTIME:=nodejs18}"
: "${YDB_FN_ENTRYPOINT:=index.handler}"
: "${YDB_FN_MEMORY:=256m}"
: "${YDB_FN_TIMEOUT:=15s}"

# Required for real YDB (set in .env.test)
: "${ADMIN_YDB_ENDPOINT:?Set ADMIN_YDB_ENDPOINT in .env.test}"
: "${ADMIN_YDB_DATABASE:?Set ADMIN_YDB_DATABASE in .env.test}"
: "${CLIENT_YDB_ENDPOINT:?Set CLIENT_YDB_ENDPOINT in .env.test}"
: "${CLIENT_YDB_DATABASE:?Set CLIENT_YDB_DATABASE in .env.test}"

FN_DIR="$ROOT_DIR/ydb-function"
WORK_DIR=$(mktemp -d)
trap 'rm -rf "$WORK_DIR"' EXIT

echo "=== pack function ==="
cp "$FN_DIR/index.js" "$FN_DIR/package.json" "$WORK_DIR/"
# install deps inside pack (or use zip with node_modules if prebuilt)
(
  cd "$WORK_DIR"
  npm install --omit=dev --no-audit --no-fund
  zip -qr function.zip index.js package.json package-lock.json node_modules
)

echo "=== ensure function exists ==="
if ! yc serverless function get --name "$YDB_FN_NAME" --folder-id "$YC_FOLDER_ID" >/dev/null 2>&1; then
  yc serverless function create --name "$YDB_FN_NAME" --folder-id "$YC_FOLDER_ID"
fi

echo "=== create version ==="
yc serverless function version create \
  --function-name "$YDB_FN_NAME" \
  --folder-id "$YC_FOLDER_ID" \
  --runtime "$YDB_FN_RUNTIME" \
  --entrypoint "$YDB_FN_ENTRYPOINT" \
  --memory "$YDB_FN_MEMORY" \
  --execution-timeout "$YDB_FN_TIMEOUT" \
  --service-account-id "$YC_SERVICE_ACCOUNT_ID" \
  --source-path "$WORK_DIR/function.zip" \
  --environment "ADMIN_YDB_ENDPOINT=${ADMIN_YDB_ENDPOINT}" \
  --environment "ADMIN_YDB_DATABASE=${ADMIN_YDB_DATABASE}" \
  --environment "CLIENT_YDB_ENDPOINT=${CLIENT_YDB_ENDPOINT}" \
  --environment "CLIENT_YDB_DATABASE=${CLIENT_YDB_DATABASE}"

echo "=== allow unauthenticated invoke (TEST only) ==="
yc serverless function allow-unauthenticated-invoke "$YDB_FN_NAME" --folder-id "$YC_FOLDER_ID" || true

FN_ID=$(yc serverless function get --name "$YDB_FN_NAME" --folder-id "$YC_FOLDER_ID" --format json | jq -r '.id')
# HTTP invoke URL pattern
FN_URL="https://functions.yandexcloud.net/${FN_ID}"

echo ""
echo "========================================="
echo "✅ TEST YDB function deployed"
echo "ID:  $FN_ID"
echo "URL: $FN_URL"
echo ""
echo "Put into deploy/test/.env.test:"
echo "  YDB_FUNCTION_URL=$FN_URL"
echo "Then re-run: npm run deploy:test:webapp"
echo "========================================="

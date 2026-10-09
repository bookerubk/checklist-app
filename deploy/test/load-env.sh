#!/usr/bin/env bash
# Source deploy/test/.env.test (or ENV_FILE)
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/deploy/test/.env.test}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "❌ Env file not found: $ENV_FILE"
  echo "   cp deploy/test/env.example deploy/test/.env.test  &&  edit secrets"
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

: "${YC_FOLDER_ID:?YC_FOLDER_ID required}"
: "${YC_REGISTRY_ID:?YC_REGISTRY_ID required}"
: "${YC_SERVICE_ACCOUNT_ID:?YC_SERVICE_ACCOUNT_ID required}"
: "${IMAGE_NAME:=checklist-webapp}"
: "${IMAGE_TAG:=test}"
: "${CONTAINER_NAME:=checklist-webapp-test}"
: "${CORES:=1}"
: "${MEMORY:=512MB}"
: "${CONCURRENCY:=4}"
: "${EXECUTION_TIMEOUT:=30s}"
: "${MIN_INSTANCES:=0}"
: "${PORT:=8080}"
: "${NODE_ENV:=production}"
: "${APP_ENV:=test}"
: "${ALLOW_UNAUTH_API:=true}"
: "${YDB_PROXY_TIMEOUT_MS:=25000}"

export IMAGE_URL="cr.yandex/${YC_REGISTRY_ID}/${IMAGE_NAME}:${IMAGE_TAG}"
export PATH="${HOME}/yandex-cloud/bin:${PATH}"

echo "✅ Loaded env from $ENV_FILE"
echo "   folder=$YC_FOLDER_ID  image=$IMAGE_URL  container=$CONTAINER_NAME"

#!/usr/bin/env bash
# Source deploy/test/.env.test
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/deploy/test/.env.test}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "❌ Env file not found: $ENV_FILE"
  echo "   cp deploy/test/env.example deploy/test/.env.test  &&  edit values"
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

: "${YC_FOLDER_ID:?YC_FOLDER_ID required}"
: "${YC_SERVICE_ACCOUNT_ID:?YC_SERVICE_ACCOUNT_ID required}"

: "${WEBAPP_FN_NAME:=checklist-webapp-test}"
: "${APP_ENV:=test}"
: "${ALLOW_UNAUTH_API:=true}"
: "${YDB_PROXY_TIMEOUT_MS:=25000}"
: "${DEPLOY_APIGW:=1}"

export PATH="${HOME}/yandex-cloud/bin:${PATH}"

echo "✅ Loaded env from $ENV_FILE"
echo "   folder=$YC_FOLDER_ID  webapp_fn=$WEBAPP_FN_NAME  app_env=$APP_ENV"

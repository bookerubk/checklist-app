#!/usr/bin/env bash
# Full TEST pipeline (Cloud Functions only — no Serverless Containers)
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# 1) YDB proxy CF (if env has YDB endpoints)
if [[ -f "$ROOT_DIR/deploy/test/.env.test" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ROOT_DIR/deploy/test/.env.test"
  set +a
fi

if [[ -n "${ADMIN_YDB_ENDPOINT:-}" && -n "${ADMIN_YDB_DATABASE:-}" ]]; then
  echo ">>> deploy YDB function"
  bash "$ROOT_DIR/deploy/test/deploy-ydb-fn.sh"
  # auto-wire YDB_FUNCTION_URL if deploy printed it — user may already have it in env
fi

echo ">>> deploy webapp Cloud Function"
bash "$ROOT_DIR/deploy/test/deploy-webapp-cf.sh"

if [[ "${DEPLOY_APIGW:-1}" == "1" ]]; then
  echo ">>> API Gateway"
  bash "$ROOT_DIR/deploy/test/deploy-apigw.sh" || echo "⚠️ API Gateway step skipped/failed"
fi

echo ">>> smoke"
bash "$ROOT_DIR/deploy/test/smoke.sh"

#!/usr/bin/env bash
# Smoke tests against deployed TEST webapp
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT_DIR/deploy/test/load-env.sh"

BASE_URL="${1:-}"
if [[ -z "$BASE_URL" ]]; then
  BASE_URL=$(yc serverless container get --name "$CONTAINER_NAME" --folder-id "$YC_FOLDER_ID" --format json | jq -r '.url')
fi
BASE_URL="${BASE_URL%/}/"

echo "Smoke against $BASE_URL"

fail=0
check() {
  local path="$1" expect="$2"
  code=$(curl -s -o /tmp/smk.out -w "%{http_code}" "${BASE_URL}${path}" || echo 000)
  if [[ "$code" == "$expect" ]]; then
    echo "  OK  $path → $code"
  else
    echo "  FAIL $path → $code (want $expect)"
    cat /tmp/smk.out || true
    fail=1
  fi
}

check "health" "200"
check "api/health" "200"
check "" "200"   # SPA index

# YDB proxy without URL should 503; with URL may 200/400/502 depending on body
code=$(curl -s -o /tmp/smk-q.out -w "%{http_code}" -X POST "${BASE_URL}api/query" \
  -H 'Content-Type: application/json' \
  -d '{"query":"SELECT 1 AS value;","orgType":"admin"}' || echo 000)
echo "  INFO POST /api/query → $code"
head -c 400 /tmp/smk-q.out 2>/dev/null; echo

if [[ $fail -ne 0 ]]; then
  echo "❌ Smoke failed"
  exit 1
fi
echo "✅ Smoke passed"

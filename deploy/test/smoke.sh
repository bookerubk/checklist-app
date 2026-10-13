#!/usr/bin/env bash
# Smoke against Cloud Function / API Gateway URL
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT_DIR/deploy/test/load-env.sh"

BASE_URL="${1:-}"
if [[ -z "$BASE_URL" && -f "$ROOT_DIR/deploy/test/.last-gateway-url" ]]; then
  BASE_URL=$(cat "$ROOT_DIR/deploy/test/.last-gateway-url")
fi
if [[ -z "$BASE_URL" && -f "$ROOT_DIR/deploy/test/.last-webapp-url" ]]; then
  BASE_URL=$(cat "$ROOT_DIR/deploy/test/.last-webapp-url")
fi
if [[ -z "$BASE_URL" ]]; then
  : "${WEBAPP_FN_NAME:=checklist-webapp-test}"
  FN_ID=$(yc serverless function get --name "$WEBAPP_FN_NAME" --folder-id "$YC_FOLDER_ID" --format json | jq -r '.id')
  BASE_URL="https://functions.yandexcloud.net/${FN_ID}"
fi

# normalize trailing slash
BASE_URL="${BASE_URL%/}"

echo "Smoke against $BASE_URL"
fail=0

# Yandex CF public invoke does not support URL paths after function id.
# Gateway URLs (apigw.*) keep normal paths; direct CF uses ?__path=.
url_for() {
  local path="${1:-/}"
  if [[ "$BASE_URL" == *functions.yandexcloud.net* ]]; then
    # encode path as query — path "/" stays as /
    printf '%s?__path=%s' "$BASE_URL" "$path"
  else
    if [[ "$path" == "/" ]]; then
      printf '%s/' "$BASE_URL"
    else
      printf '%s%s' "$BASE_URL" "$path"
    fi
  fi
}

check() {
  local path="$1" expect="$2"
  local url
  url=$(url_for "$path")
  code=$(curl -s -o /tmp/smk.out -w "%{http_code}" "$url" || echo 000)
  if [[ "$code" == "$expect" ]]; then
    echo "  OK  ${path:-/} → $code"
  else
    echo "  FAIL ${path:-/} → $code (want $expect)  url=$url"
    head -c 300 /tmp/smk.out || true
    echo
    fail=1
  fi
}

check "/health" "200"
check "/api/health" "200"
check "/" "200"

# Static assets must NOT be SPA fallback (HTML). Parse hashed assets from index.html.
INDEX_HTML=$(curl -sS "$(url_for /)" || true)
JS_PATH=$(printf '%s' "$INDEX_HTML" | sed -n 's/.*src="\(\/assets\/[^"]*\.js\)".*/\1/p' | head -1)
CSS_PATH=$(printf '%s' "$INDEX_HTML" | sed -n 's/.*href="\(\/assets\/[^"]*\.css\)".*/\1/p' | head -1)

check_asset() {
  local path="$1" expect_ctype_substr="$2"
  if [[ -z "$path" ]]; then
    echo "  FAIL asset path empty (index.html missing script/link?)"
    fail=1
    return
  fi
  local ctype size code
  local aurl
  aurl=$(url_for "$path")
  code=$(curl -sS -o /tmp/smk-asset.bin -w "%{http_code}" "$aurl" || echo 000)
  ctype=$(curl -sS -I "$aurl" 2>/dev/null | tr -d '\r' | awk -F': ' 'tolower($1)=="content-type"{print $2; exit}')
  size=$(wc -c < /tmp/smk-asset.bin | tr -d ' ')
  # reject HTML SPA fallback
  if head -c 20 /tmp/smk-asset.bin | grep -qi '<!doctype\|<html'; then
    echo "  FAIL ${path} → got HTML SPA fallback (size=${size})"
    fail=1
    return
  fi
  if [[ "$code" != "200" ]]; then
    echo "  FAIL ${path} → HTTP $code (want 200)"
    fail=1
    return
  fi
  if [[ "$size" -lt 100 ]]; then
    echo "  FAIL ${path} → body too small (${size} bytes)"
    fail=1
    return
  fi
  if [[ -n "$expect_ctype_substr" && "$ctype" != *"$expect_ctype_substr"* ]]; then
    echo "  FAIL ${path} → Content-Type='$ctype' (want *${expect_ctype_substr}*) size=${size}"
    fail=1
    return
  fi
  echo "  OK  ${path} → $code (${ctype:-?}, ${size} bytes)"
}

if [[ -n "$JS_PATH" ]]; then
  check_asset "$JS_PATH" "javascript"
else
  echo "  FAIL could not parse /assets/*.js from index.html"
  fail=1
fi
if [[ -n "$CSS_PATH" ]]; then
  check_asset "$CSS_PATH" "css"
else
  echo "  FAIL could not parse /assets/*.css from index.html"
  fail=1
fi

code=$(curl -sS --max-time 45 -o /tmp/smk-q.out -w "%{http_code}" -X POST "$(url_for /api/query)" \
  -H 'Content-Type: application/json' \
  -d '{"query":"SELECT 1 AS value;","orgType":"admin"}' || echo 000)
echo "  INFO POST /api/query → $code"
head -c 400 /tmp/smk-q.out 2>/dev/null; echo
if [[ "$code" != "200" ]]; then
  if [[ "${SMOKE_QUERY_SOFT:-0}" == "1" ]]; then
    echo "  WARN query not 200 (SMOKE_QUERY_SOFT=1)"
  else
    echo "  FAIL POST /api/query (want 200) — M0 blocked"
    fail=1
  fi
else
  # must look like JSON with columns or success
  if ! grep -qE '"success":\s*true|"columns"' /tmp/smk-q.out 2>/dev/null; then
    echo "  FAIL /api/query body unexpected"
    fail=1
  else
    echo "  OK  POST /api/query body"
  fi
fi

if [[ $fail -ne 0 ]]; then
  echo "❌ Smoke failed"
  exit 1
fi
echo "✅ Smoke passed"

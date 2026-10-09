#!/usr/bin/env bash
# Build SPA and pack webapp-function zip for Yandex Cloud Functions
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# env optional for pack (no yc ids required for local pack)
ENV_FILE="${ENV_FILE:-$ROOT_DIR/deploy/test/.env.test}"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

FN_DIR="$ROOT_DIR/webapp-function"
OUT_ZIP="${1:-$ROOT_DIR/webapp-function/webapp-function.zip}"
WORK_DIR=$(mktemp -d)
trap 'rm -rf "$WORK_DIR"' EXIT

cd "$ROOT_DIR"

echo "=== npm ci + build ==="
if [[ -f package-lock.json ]]; then
  npm ci --no-audit --no-fund
else
  npm install --no-audit --no-fund
fi

export VITE_SHOW_DEMO_PROFILES="${VITE_SHOW_DEMO_PROFILES:-true}"
export VITE_APP_ENV="${APP_ENV:-test}"
npm run build

if [[ ! -d dist ]] || [[ ! -f dist/index.html ]]; then
  echo "❌ dist/index.html missing after build"
  exit 1
fi

echo "=== assemble function package ==="
cp "$FN_DIR/index.js" "$FN_DIR/package.json" "$WORK_DIR/"
cp -a dist "$WORK_DIR/dist"

# size check — CF zip limit is 128MB (deploy), recommend < 30MB for test
DIST_SIZE=$(du -sm "$WORK_DIR/dist" | cut -f1)
echo "dist size: ${DIST_SIZE} MB"
if [[ "$DIST_SIZE" -gt 100 ]]; then
  echo "⚠️ dist is large for Cloud Function package (${DIST_SIZE}MB). Consider Object Storage + thin CF later."
fi

(
  cd "$WORK_DIR"
  # no node_modules needed (stdlib + fetch only)
  zip -qr "$OUT_ZIP" index.js package.json dist
)

echo "✅ Packed: $OUT_ZIP ($(du -h "$OUT_ZIP" | cut -f1))"
ls -la "$OUT_ZIP"

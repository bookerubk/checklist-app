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

# Require hashed assets — empty dist/assets → white screen in browser
if [[ ! -d dist/assets ]]; then
  echo "❌ dist/assets/ missing after build"
  exit 1
fi
ASSET_COUNT=$(find dist/assets -type f | wc -l | tr -d ' ')
if [[ "$ASSET_COUNT" -lt 1 ]]; then
  echo "❌ dist/assets/ has no files after build"
  exit 1
fi
JS_COUNT=$(find dist/assets -type f -name '*.js' | wc -l | tr -d ' ')
CSS_COUNT=$(find dist/assets -type f -name '*.css' | wc -l | tr -d ' ')
if [[ "$JS_COUNT" -lt 1 || "$CSS_COUNT" -lt 1 ]]; then
  echo "❌ expected at least one .js and one .css in dist/assets (js=$JS_COUNT css=$CSS_COUNT)"
  exit 1
fi
echo "   dist/assets: $ASSET_COUNT files (js=$JS_COUNT css=$CSS_COUNT)"

echo "=== assemble function package ==="
cp "$FN_DIR/index.js" "$FN_DIR/package.json" "$WORK_DIR/"
cp -a dist "$WORK_DIR/dist"

# size check — CF zip limit is 128MB (deploy), recommend < 30MB for test
DIST_SIZE=$(du -sm "$WORK_DIR/dist" | cut -f1)
echo "dist size: ${DIST_SIZE} MB"
if [[ "$DIST_SIZE" -gt 100 ]]; then
  echo "⚠️ dist is large for Cloud Function package (${DIST_SIZE}MB). Consider Object Storage + thin CF later."
fi

# ensure OUT_ZIP parent exists; remove stale zip
mkdir -p "$(dirname "$OUT_ZIP")"
rm -f "$OUT_ZIP"

(
  cd "$WORK_DIR"
  # no node_modules needed (stdlib + fetch only)
  zip -qr "$OUT_ZIP" index.js package.json dist
)

# verify zip contains assets (not just index)
if ! unzip -l "$OUT_ZIP" | grep -q 'dist/assets/.*\.js'; then
  echo "❌ zip missing dist/assets/*.js — refuse to deploy a white-screen package"
  unzip -l "$OUT_ZIP" | head -40
  exit 1
fi

echo "✅ Packed: $OUT_ZIP ($(du -h "$OUT_ZIP" | cut -f1))"
ls -la "$OUT_ZIP"
# show a few asset entries
unzip -l "$OUT_ZIP" | grep 'dist/assets/' | head -10 || true

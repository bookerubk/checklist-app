#!/usr/bin/env bash
# Apply SPA static-assets fix on VPS checklist-app
# Usage: bash APPLY.sh [/opt/checklist-app]
set -euo pipefail

TARGET="${1:-/opt/checklist-app}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TS=$(date +%Y%m%dT%H%M%S)
BACKUP="$TARGET/deploy/test/.backup-spa-static-$TS"

if [[ ! -d "$TARGET" ]]; then
  echo "❌ target not found: $TARGET"
  exit 1
fi

mkdir -p "$BACKUP/webapp-function" "$BACKUP/deploy/test"

backup_one() {
  local rel="$1"
  if [[ -f "$TARGET/$rel" ]]; then
    mkdir -p "$BACKUP/$(dirname "$rel")"
    cp -a "$TARGET/$rel" "$BACKUP/$rel"
  fi
}

echo "=== backup → $BACKUP ==="
backup_one webapp-function/index.js
backup_one deploy/test/smoke.sh
backup_one deploy/test/pack-webapp-fn.sh
backup_one deploy/test/deploy-apigw.sh

echo "=== install fixed files ==="
cp -a "$HERE/webapp-function/index.js" "$TARGET/webapp-function/index.js"
cp -a "$HERE/deploy/test/smoke.sh" "$TARGET/deploy/test/smoke.sh"
cp -a "$HERE/deploy/test/pack-webapp-fn.sh" "$TARGET/deploy/test/pack-webapp-fn.sh"
cp -a "$HERE/deploy/test/deploy-apigw.sh" "$TARGET/deploy/test/deploy-apigw.sh"
chmod +x "$TARGET/deploy/test/smoke.sh" "$TARGET/deploy/test/pack-webapp-fn.sh" "$TARGET/deploy/test/deploy-apigw.sh"

echo "=== verify path-resolution unit tests ==="
node -e '
const m = require(process.argv[1]);
const r = m._resolveRequestPath;
const cases = [
  [{ path: "/{path+}", url: "/assets/index-abc.js", pathParams: { path: "assets/index-abc.js" } }, "/assets/index-abc.js"],
  [{ path: "/{path+}", url: "/assets/x.js" }, "/assets/x.js"],
  [{ path: "/{path+}" }, "/"],
  [{ path: "/", url: "/" }, "/"],
];
for (const [ev, want] of cases) {
  const got = r(ev);
  if (got !== want) { console.error("FAIL", ev, "→", got, "want", want); process.exit(1); }
}
console.log("path resolution OK");
' "$TARGET/webapp-function/index.js"

cat << MSG

✅ SPA static-assets fix applied to $TARGET
Backup: $BACKUP

Next on VPS:
  cd $TARGET
  npm run deploy:test:webapp
  # or full:
  npm run deploy:test

Then verify:
  curl -sI https://<gateway>/assets/<hash>.js | head -5
  # Content-Type must be application/javascript (NOT text/html)

MSG

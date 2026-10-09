#!/usr/bin/env bash
# Apply CF Object Storage deploy patch on VPS (idempotent).
#
# Usage (from repo root, e.g. /opt/checklist-app):
#   scp vps-cf-object-storage.patch apply-vps-cf-patch.sh user@vps:/opt/checklist-app/
#   cd /opt/checklist-app
#   bash apply-vps-cf-patch.sh vps-cf-object-storage.patch
#
# Works even if deploy/test/ already exists (overwrites known files).
set -euo pipefail

PATCH="${1:-vps-cf-object-storage.patch}"
ROOT="${2:-.}"

cd "$ROOT"
ROOT_ABS=$(pwd)

if [[ ! -f "$PATCH" ]]; then
  echo "❌ Patch not found: $PATCH"
  echo "   Place vps-cf-object-storage.patch in repo root and re-run."
  exit 1
fi

echo "=== target: $ROOT_ABS ==="
echo "=== patch:  $PATCH ==="

backup_dir="deploy/test/.backup-$(date +%Y%m%d-%H%M%S)"
if [[ -d deploy/test ]]; then
  mkdir -p "$backup_dir"
  # backup only regular files we may overwrite
  find deploy/test -maxdepth 1 -type f -exec cp -a {} "$backup_dir/" \; 2>/dev/null || true
  echo "ℹ️  backup → $backup_dir"
fi

mkdir -p deploy/test webapp-function

applied=0

# --- Method 1: git apply ---
if command -v git >/dev/null 2>&1 && [[ -d .git ]]; then
  if git apply --check -p1 "$PATCH" 2>/dev/null; then
    git apply -p1 "$PATCH"
    echo "✅ applied via: git apply -p1"
    applied=1
  elif git apply --check "$PATCH" 2>/dev/null; then
    git apply "$PATCH"
    echo "✅ applied via: git apply"
    applied=1
  else
    echo "⚠️  git apply --check failed (tree already has files?) — force extract from patch"
  fi
fi

# --- Method 2: classic patch ---
if [[ "$applied" -eq 0 ]] && command -v patch >/dev/null 2>&1; then
  if patch -p1 --dry-run < "$PATCH" >/tmp/patch-dry.out 2>&1; then
    patch -p1 < "$PATCH"
    echo "✅ applied via: patch -p1"
    applied=1
  else
    echo "⚠️  patch dry-run failed:"
    tail -15 /tmp/patch-dry.out || true
  fi
fi

# --- Method 3: force extract file bodies from unified diff (idempotent overwrite) ---
if [[ "$applied" -eq 0 ]]; then
  echo "=== force-write files from unified diff ==="
  python3 - "$PATCH" << 'PY'
import sys, re, os
from pathlib import Path

patch_path = Path(sys.argv[1])
text = patch_path.read_text(encoding='utf-8', errors='replace')

# Split on diff --git headers
parts = re.split(r'(?m)^diff --git ', text)
written = []
for part in parts:
    if not part.strip():
        continue
    # first line: a/path b/path
    first = part.splitlines()[0] if part.splitlines() else ''
    m = re.match(r'a/(\S+)\s+b/(\S+)', first)
    if not m:
        # maybe part still has "a/..." after split ate "diff --git "
        m = re.match(r'a/(\S+)\s+b/(\S+)', part[:200].replace('\n', ' '))
    if not m:
        # try +++ b/path
        m2 = re.search(r'(?m)^\+\+\+ b/(.+)$', part)
        if not m2:
            continue
        rel = m2.group(1).strip()
    else:
        rel = m.group(2)

    # collect + lines between @@ hunks (new file content reconstruction)
    # For new files (--- /dev/null), all + lines form the file.
    # For modified, this naive rebuild only works for new files fully made of + lines.
    lines = part.splitlines()
    is_new = any(l.startswith('--- /dev/null') for l in lines[:20])
    body_lines = []
    in_hunk = False
    for l in lines:
        if l.startswith('@@'):
            in_hunk = True
            continue
        if not in_hunk:
            continue
        if l.startswith('+') and not l.startswith('+++'):
            body_lines.append(l[1:])
        elif l.startswith('-') and not l.startswith('---'):
            # skip removals; for pure new files there are none
            if not is_new:
                # modified file: cannot safely rebuild with this simple method
                body_lines = None
                break
        elif l.startswith('\\'):
            continue
        else:
            # context line (space prefix) for modified patches
            if l.startswith(' '):
                if is_new:
                    continue
                body_lines.append(l[1:])
            elif l.startswith('diff ') or l.startswith('index '):
                break

    if body_lines is None:
        print(f'skip (complex update, use git): {rel}')
        continue

    path = Path(rel)
    path.parent.mkdir(parents=True, exist_ok=True)
    content = '\n'.join(body_lines)
    if body_lines:
        content += '\n'
    path.write_text(content, encoding='utf-8')
    if rel.endswith('.sh'):
        os.chmod(path, 0o755)
    written.append(rel)
    print(f'wrote {rel} ({len(content)} bytes)')

if not written:
    sys.exit('No files extracted from patch')
print(f'force-wrote {len(written)} files')
PY
  echo "✅ applied via: force extract"
  applied=1
fi

chmod +x deploy/test/*.sh 2>/dev/null || true

# sanity
need=(
  deploy/test/cf-package-source.sh
  deploy/test/deploy-ydb-fn.sh
  deploy/test/deploy-webapp-cf.sh
  deploy/test/env.example
)
miss=0
for f in "${need[@]}"; do
  if [[ ! -f "$f" ]]; then
    echo "❌ missing after apply: $f"
    miss=1
  else
    echo "  OK $f"
  fi
done
[[ "$miss" -eq 0 ]] || exit 1

# ensure Object Storage key is present in env.example / remind .env.test
if [[ -f deploy/test/.env.test ]] && ! grep -q '^CF_PACKAGE_BUCKET=' deploy/test/.env.test 2>/dev/null; then
  echo "" >> deploy/test/.env.test
  echo "# added by apply-vps-cf-patch.sh — set a globally unique bucket name" >> deploy/test/.env.test
  echo "CF_PACKAGE_BUCKET=checklist-cf-packages-test" >> deploy/test/.env.test
  echo "ℹ️  Appended CF_PACKAGE_BUCKET=checklist-cf-packages-test to .env.test (edit if name taken)"
fi

echo ""
echo "========================================="
echo "✅ Patch applied"
echo "========================================="
echo "Next:"
echo "  1) nano deploy/test/.env.test   # CF_PACKAGE_BUCKET=..."
echo "  2) yc storage bucket create --name \"\$CF_PACKAGE_BUCKET\" --folder-id \"\$YC_FOLDER_ID\"  # if needed"
echo "  3) npm run deploy:test:ydb"
echo "========================================="

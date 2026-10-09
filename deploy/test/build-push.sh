#!/usr/bin/env bash
# Build linux/amd64 image and push to Yandex Container Registry (test)
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT_DIR/deploy/test/load-env.sh"

cd "$ROOT_DIR"

export DOCKER_CONTENT_TRUST=0

echo "=== docker build (linux/amd64) ==="
docker build \
  --platform linux/amd64 \
  --build-arg "VITE_SHOW_DEMO_PROFILES=${VITE_SHOW_DEMO_PROFILES:-true}" \
  --build-arg "VITE_APP_ENV=${APP_ENV:-test}" \
  -t "$IMAGE_URL" \
  -f Dockerfile \
  .

echo "=== docker login (yc) ==="
yc container registry configure-docker --folder-id "$YC_FOLDER_ID" >/dev/null || true

echo "=== docker push ==="
docker push "$IMAGE_URL"

echo "✅ Pushed $IMAGE_URL"

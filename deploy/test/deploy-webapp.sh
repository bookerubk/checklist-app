#!/usr/bin/env bash
# Deploy / update Serverless Container revision (TEST webapp)
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT_DIR/deploy/test/load-env.sh"

echo "=== ensure serverless container exists ==="
if ! yc serverless container get --name "$CONTAINER_NAME" --folder-id "$YC_FOLDER_ID" >/dev/null 2>&1; then
  yc serverless container create --name "$CONTAINER_NAME" --folder-id "$YC_FOLDER_ID"
  echo "Created container $CONTAINER_NAME"
else
  echo "Container $CONTAINER_NAME already exists"
fi

# Build environment flags (only non-empty)
ENV_ARGS=(
  --environment "NODE_ENV=${NODE_ENV}"
  --environment "APP_ENV=${APP_ENV}"
  --environment "PORT=${PORT}"
  --environment "ALLOW_UNAUTH_API=${ALLOW_UNAUTH_API}"
  --environment "YDB_PROXY_TIMEOUT_MS=${YDB_PROXY_TIMEOUT_MS}"
)

if [[ -n "${YDB_FUNCTION_URL:-}" ]]; then
  ENV_ARGS+=(--environment "YDB_FUNCTION_URL=${YDB_FUNCTION_URL}")
fi
if [[ -n "${MINIO_ENDPOINT:-}" ]]; then
  ENV_ARGS+=(--environment "MINIO_ENDPOINT=${MINIO_ENDPOINT}")
fi
if [[ -n "${MINIO_BUCKET:-}" ]]; then
  ENV_ARGS+=(--environment "MINIO_BUCKET=${MINIO_BUCKET}")
fi
if [[ -n "${MINIO_ACCESS_KEY:-}" ]]; then
  ENV_ARGS+=(--environment "MINIO_ACCESS_KEY=${MINIO_ACCESS_KEY}")
fi
if [[ -n "${MINIO_SECRET_KEY:-}" ]]; then
  ENV_ARGS+=(--environment "MINIO_SECRET_KEY=${MINIO_SECRET_KEY}")
fi
if [[ -n "${MINIO_PUBLIC_URL:-}" ]]; then
  ENV_ARGS+=(--environment "MINIO_PUBLIC_URL=${MINIO_PUBLIC_URL}")
fi
if [[ -n "${APP_URL:-}" ]]; then
  ENV_ARGS+=(--environment "APP_URL=${APP_URL}")
fi

echo "=== deploy revision ==="
yc serverless container revision deploy \
  --container-name "$CONTAINER_NAME" \
  --folder-id "$YC_FOLDER_ID" \
  --image "$IMAGE_URL" \
  --cores "$CORES" \
  --memory "$MEMORY" \
  --concurrency "$CONCURRENCY" \
  --execution-timeout "$EXECUTION_TIMEOUT" \
  --service-account-id "$YC_SERVICE_ACCOUNT_ID" \
  --min-instances "$MIN_INSTANCES" \
  "${ENV_ARGS[@]}"

echo "=== allow unauthenticated invoke (TEST only) ==="
yc serverless container allow-unauthenticated-invoke "$CONTAINER_NAME" --folder-id "$YC_FOLDER_ID" || true

CONTAINER_URL=$(yc serverless container get --name "$CONTAINER_NAME" --folder-id "$YC_FOLDER_ID" --format json | jq -r '.url')

echo ""
echo "========================================="
echo "✅ TEST webapp deployed"
echo "URL: $CONTAINER_URL"
echo "Health: ${CONTAINER_URL}health"
echo "========================================="

# smoke
sleep 3
HTTP_CODE=$(curl -s -o /tmp/checklist-health.json -w "%{http_code}" "${CONTAINER_URL}health" || true)
echo "Health HTTP: $HTTP_CODE"
cat /tmp/checklist-health.json 2>/dev/null || true
echo ""

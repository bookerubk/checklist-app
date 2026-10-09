#!/usr/bin/env bash
# Create/update API Gateway pointing to webapp Cloud Function (TEST)
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT_DIR/deploy/test/load-env.sh"

: "${WEBAPP_FN_NAME:=checklist-webapp-test}"
: "${APIGW_NAME:=checklist-webapp-test-gw}"

WEBAPP_FN_ID=$(yc serverless function get --name "$WEBAPP_FN_NAME" --folder-id "$YC_FOLDER_ID" --format json | jq -r '.id')
if [[ -z "$WEBAPP_FN_ID" || "$WEBAPP_FN_ID" == "null" ]]; then
  echo "❌ Deploy webapp CF first: npm run deploy:test:webapp"
  exit 1
fi

SPEC_SRC="$ROOT_DIR/deploy/test/api-gateway-test.yaml"
SPEC_OUT=$(mktemp)
trap 'rm -f "$SPEC_OUT"' EXIT

sed \
  -e "s/\${WEBAPP_FN_ID}/$WEBAPP_FN_ID/g" \
  -e "s/\${YC_SERVICE_ACCOUNT_ID}/$YC_SERVICE_ACCOUNT_ID/g" \
  -e "s/\${YDB_FN_ID}/${YDB_FN_ID:-}/g" \
  "$SPEC_SRC" > "$SPEC_OUT"

if yc serverless api-gateway get --name "$APIGW_NAME" --folder-id "$YC_FOLDER_ID" >/dev/null 2>&1; then
  echo "=== update API Gateway ==="
  yc serverless api-gateway update \
    --name "$APIGW_NAME" \
    --folder-id "$YC_FOLDER_ID" \
    --spec "$SPEC_OUT"
else
  echo "=== create API Gateway ==="
  yc serverless api-gateway create \
    --name "$APIGW_NAME" \
    --folder-id "$YC_FOLDER_ID" \
    --spec "$SPEC_OUT"
fi

DOMAIN=$(yc serverless api-gateway get --name "$APIGW_NAME" --folder-id "$YC_FOLDER_ID" --format json | jq -r '.domain')
echo ""
echo "========================================="
echo "✅ API Gateway: https://${DOMAIN}"
echo "Health: https://${DOMAIN}/health"
echo "========================================="
echo "https://${DOMAIN}" > "$ROOT_DIR/deploy/test/.last-webapp-url"

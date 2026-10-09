#!/usr/bin/env bash
# Compat shim → Cloud Function deploy
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
echo "ℹ️  Redirect: Serverless Containers → Cloud Function"
exec bash "$ROOT_DIR/deploy/test/deploy-webapp-cf.sh"

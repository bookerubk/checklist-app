#!/usr/bin/env bash
# Full TEST pipeline: build → push → deploy webapp → smoke
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
"$ROOT_DIR/deploy/test/build-push.sh"
"$ROOT_DIR/deploy/test/deploy-webapp.sh"
"$ROOT_DIR/deploy/test/smoke.sh"

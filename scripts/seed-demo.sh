#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if test -f "$root/.env"; then set -a; source "$root/.env"; set +a; fi
test "${CONFIRM_DEMO_SEED:-}" = YES || { echo 'Set CONFIRM_DEMO_SEED=YES to load non-production fixtures.' >&2; exit 1; }
test "${NODE_ENV:-development}" != production || { echo 'Demo seed is disabled in production.' >&2; exit 1; }
cd "$root/backend"; node seed.js
"$root/scripts/migrate.sh"

#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; cd "$root"
test -f .env || { echo 'Missing .env; copy .env.example and configure it.' >&2; exit 1; }
set -a; source .env; set +a
: "${BACKEND_HOST:=127.0.0.1}" "${BACKEND_PORT:=4000}"
: "${FRONTEND_HOST:=127.0.0.1}" "${FRONTEND_PORT:=3000}"
: "${OPENROUTER_API_KEY:?OPENROUTER_API_KEY is required}"
: "${OPENROUTER_MODEL:?OPENROUTER_MODEL is required}"
: "${OPENROUTER_BASE_URL:?OPENROUTER_BASE_URL is required}"
[ "$OPENROUTER_BASE_URL" = "https://openrouter.ai/api/v1" ] || { echo 'OPENROUTER_BASE_URL must be https://openrouter.ai/api/v1' >&2; exit 1; }
test -d backend/node_modules && test -d frontend/node_modules || { echo 'Dependencies absent; run scripts/bootstrap.sh.' >&2; exit 1; }
for port in "$BACKEND_PORT" "$FRONTEND_PORT"; do if lsof -ti ":$port" >/dev/null 2>&1; then echo "Port $port is occupied; refusing to terminate another process." >&2; exit 1; fi; done
if [ "${MIGRATE_ON_START:-false}" = true ]; then
  case "${ALLOW_SCHEMA_MIGRATION:-}" in 1|true) ;; *) echo 'ALLOW_SCHEMA_MIGRATION=1 or true is required for startup migration.' >&2; exit 1;; esac
  ./scripts/migrate.sh
fi
node backend/scripts/provision-runtime-admin.js
(cd backend && npm start) & backend_pid=$!
(cd frontend && npm run dev -- --port "$FRONTEND_PORT" --host "$FRONTEND_HOST") & frontend_pid=$!
cleanup(){ kill "$backend_pid" "$frontend_pid" 2>/dev/null || true; }; trap cleanup EXIT INT TERM
wait "$backend_pid" "$frontend_pid"

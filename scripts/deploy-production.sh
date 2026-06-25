#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root_dir"

if [[ ! -f ".env" ]]; then
  echo "FAIL missing .env. Create it from .env.example and fill production values first." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
. "$root_dir/.env"
set +a

"$root_dir/scripts/preflight.sh"

if docker compose version >/dev/null 2>&1; then
  compose=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  compose=(docker-compose)
else
  echo "FAIL Docker Compose is not installed." >&2
  exit 1
fi

echo "Building LivePilot containers..."
"${compose[@]}" build

echo "Starting LivePilot containers..."
"${compose[@]}" up -d

echo "Current service status:"
"${compose[@]}" ps

echo "Checking API health..."
API_HEALTH_URL="${API_HEALTH_URL:-http://127.0.0.1:8000}"
"$root_dir/scripts/check-health.sh" "$API_HEALTH_URL"

echo "LivePilot deployment command completed."

#!/usr/bin/env bash
set -euo pipefail

api_base="${API_BASE:-http://127.0.0.1:8000}"

curl -fsS "$api_base/api/health" >/dev/null
printf 'PASS API health: %s/api/health\n' "$api_base"

curl -fsS "$api_base/api/ready" >/dev/null
printf 'PASS API ready: %s/api/ready\n' "$api_base"

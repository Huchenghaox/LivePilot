#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
status=0

pass() { printf 'PASS %s\n' "$1"; }
warn() { printf 'WARN %s\n' "$1"; }
fail() { printf 'FAIL %s\n' "$1"; status=1; }

"$root_dir/scripts/validate-production-config.sh" || status=1

if git -C "$root_dir" ls-files | grep -Eq '(^|/)(\.env|\.env\.local|.*\.db|.*\.sqlite|.*\.sqlite3)$'; then
  fail "tracked secret or database-like file found"
else
  pass "no tracked .env or SQLite database files"
fi

if [[ -n "${UPLOAD_DIR:-}" ]]; then
  mkdir -p "$UPLOAD_DIR"
  if [[ -w "$UPLOAD_DIR" ]]; then
    pass "UPLOAD_DIR is writable"
  else
    fail "UPLOAD_DIR is not writable"
  fi
fi

if [[ "${RUN_HEALTH_CHECK:-false}" == "true" ]]; then
  "$root_dir/scripts/check-health.sh" || status=1
else
  warn "health check skipped; set RUN_HEALTH_CHECK=true to verify running API"
fi

exit "$status"

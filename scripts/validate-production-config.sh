#!/usr/bin/env bash
set -euo pipefail

status=0

pass() { printf 'PASS %s\n' "$1"; }
warn() { printf 'WARN %s\n' "$1"; }
fail() { printf 'FAIL %s\n' "$1"; status=1; }

app_env="${APP_ENV:-development}"
jwt_secret="${JWT_SECRET:-}"
cors_origins="${CORS_ORIGINS:-}"
registration_mode="${REGISTRATION_MODE:-invite}"
sms_enabled="${SMS_ENABLED:-false}"
sms_provider="${SMS_PROVIDER:-mock}"

if [[ "$app_env" == "production" ]]; then
  pass "APP_ENV=production"
  [[ -n "$jwt_secret" && "$jwt_secret" != "dev-secret-change-me" && ${#jwt_secret} -ge 32 ]] || fail "production JWT_SECRET must be set and at least 32 characters"
  [[ -n "$cors_origins" && "$cors_origins" != "*" ]] || fail "production CORS_ORIGINS must be explicit"
  [[ "$registration_mode" =~ ^(closed|invite|open)$ ]] || fail "REGISTRATION_MODE must be closed, invite, or open"
  if [[ "$registration_mode" == "open" && "$sms_enabled" != "true" ]]; then
    fail "open registration requires SMS_ENABLED=true"
  fi
  if [[ "$sms_enabled" == "true" && "$sms_provider" == "mock" ]]; then
    fail "production cannot use SMS_PROVIDER=mock"
  fi
else
  warn "APP_ENV is not production; production-only checks are advisory"
fi

[[ -n "${DATABASE_URL:-}" ]] && pass "DATABASE_URL is set" || warn "DATABASE_URL not set; backend default may be used"
[[ -n "${UPLOAD_DIR:-}" ]] && pass "UPLOAD_DIR is set" || warn "UPLOAD_DIR not set; backend default may be used"

exit "$status"

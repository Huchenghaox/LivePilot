# Rate Limiting

LivePilot currently includes a single-process in-memory limiter. It protects local development and one-instance early Beta deployments. It is not a distributed rate limiter.

Before open public registration or multi-instance deployment, replace or supplement it with Redis, a gateway limiter, or Cloudflare edge rules.

## Current Protected Actions

- SMS send per phone and purpose.
- SMS send per phone per hour and day.
- SMS send per IP per hour.
- Registration attempts per IP.
- Login attempts per username.
- Password reset start per IP.

## Current Config

- `SMS_SEND_INTERVAL_SECONDS`
- `SMS_HOURLY_LIMIT_PER_PHONE`
- `SMS_DAILY_LIMIT_PER_PHONE`
- `SMS_HOURLY_LIMIT_PER_IP`
- `VERIFICATION_MAX_ATTEMPTS`
- `LOGIN_FAIL_HOURLY_LIMIT`
- `REGISTER_HOURLY_LIMIT_PER_IP`

## User-Facing Behavior

When a limit is reached:

- API returns HTTP 429.
- `Retry-After` is set when available.
- Response uses plain Chinese guidance.
- The response should not reveal whether a username or phone exists.

## Known Boundary

The current limiter resets when the process restarts and does not share counters across multiple workers or servers. Treat it as a baseline protection, not final anti-abuse infrastructure.

## Recommended Production Additions

1. Add Redis-backed limiter for API actions.
2. Add Cloudflare WAF/rate rules for registration, login, SMS, uploads, and model generation.
3. Add per-user daily generation limits for AI plan/report endpoints.
4. Add per-user storage quotas before public registration.


# Production Configuration

LivePilot can run as a real multi-user product with the current FastAPI backend and Next.js frontend. This document lists the minimum production configuration. Do not store real values in Git.

## Required Backend Variables

- `APP_ENV=production`
- `APP_NAME=LivePilot`
- `DATABASE_URL`
- `JWT_SECRET`
- `REGISTRATION_MODE`
- `INVITE_CODE`
- `CORS_ORIGINS`
- `UPLOAD_DIR`

Production startup refuses the default development `JWT_SECRET`. Use at least 32 random characters.

Example:

```bash
APP_ENV=production
DATABASE_URL=sqlite:////app/data/live_assistant.db
JWT_SECRET=replace-with-a-long-random-secret
REGISTRATION_MODE=invite
INVITE_CODE=replace-with-your-real-invite-code
CORS_ORIGINS=https://www.haoxagent.com
UPLOAD_DIR=/app/data/uploads
```

## Account and Registration

LivePilot currently uses one account system:

- Register with phone SMS verification, username, and password.
- Log in with username and password.
- Reset password with SMS verification sent to the bound phone.
- Phone numbers are for verification and recovery, not daily login.

Supported registration modes:

- `REGISTRATION_MODE=closed`: backend rejects registration.
- `REGISTRATION_MODE=invite`: phone verification plus invite code.
- `REGISTRATION_MODE=open`: phone verification only.

Production should use `invite` or `closed` until real SMS delivery is configured and abuse controls are reviewed.

## SMS Variables

```bash
SMS_ENABLED=true
SMS_PROVIDER=aliyun-or-other-real-provider
SMS_ACCESS_KEY_ID=replace-on-server
SMS_ACCESS_KEY_SECRET=replace-on-server
SMS_SIGN_NAME=replace-on-server
SMS_TEMPLATE_CODE=replace-on-server
SMS_REGION=replace-on-server
SMS_CODE_TTL_SECONDS=300
SMS_SEND_INTERVAL_SECONDS=60
SMS_HOURLY_LIMIT_PER_PHONE=5
SMS_DAILY_LIMIT_PER_PHONE=10
SMS_HOURLY_LIMIT_PER_IP=30
VERIFICATION_MAX_ATTEMPTS=5
LOGIN_FAIL_HOURLY_LIMIT=10
REGISTER_HOURLY_LIMIT_PER_IP=20
```

Current code includes the SMS provider abstraction and a development-only Mock provider. A real domestic SMS adapter still needs provider credentials, sign name, template code, and final provider selection before public registration.

## Optional Model Variables

Use these only if LivePilot operates a shared platform model:

```bash
PLATFORM_TEXT_API_BASE=
PLATFORM_TEXT_API_KEY=
PLATFORM_TEXT_MODEL=
PLATFORM_VISION_API_BASE=
PLATFORM_VISION_API_KEY=
PLATFORM_VISION_MODEL=
```

Users can also configure their own model settings inside the product. Saved API keys are encrypted by the backend and never returned to the frontend in full.

## Frontend Variables

Only public variables can be exposed to the browser:

```bash
NEXT_PUBLIC_API_BASE_URL=https://api.haoxagent.com
```

Do not put API keys, tokens, database URLs, or JWT secrets into `NEXT_PUBLIC_*` variables.

## CORS

For production, `CORS_ORIGINS` should list exact frontend origins, for example:

```bash
CORS_ORIGINS=https://www.haoxagent.com
```

Do not use unrestricted `*` with credentials in production.

## Health Checks

- `/api/health`: process can respond.
- `/api/ready`: database and upload directory are available.

Run database migrations before production startup:

```bash
cd api
alembic upgrade head
```

With Docker Compose:

```bash
docker compose run --rm api alembic upgrade head
```

## Storage

Current production bootstrap can use a persistent local volume for SQLite and uploads. This is acceptable for early private Beta only. Standard production should migrate to PostgreSQL and object storage.

# Production Configuration

LivePilot can run as a real multi-user product with the current FastAPI backend and Next.js frontend. This document lists the minimum production configuration. Do not store real values in Git.

## Required Backend Variables

- `APP_ENV=production`
- `APP_NAME=LivePilot`
- `DATABASE_URL`
- `JWT_SECRET`
- `INVITE_CODE`
- `CORS_ORIGINS`
- `UPLOAD_DIR`

Production startup refuses the default development `JWT_SECRET`. Use at least 32 random characters.

Example:

```bash
APP_ENV=production
DATABASE_URL=sqlite:////app/data/live_assistant.db
JWT_SECRET=replace-with-a-long-random-secret
INVITE_CODE=replace-with-your-real-invite-code
CORS_ORIGINS=https://www.haoxagent.com
UPLOAD_DIR=/app/data/uploads
```

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

## Storage

Current production bootstrap can use a persistent local volume for SQLite and uploads. This is acceptable for early private Beta only. Standard production should migrate to PostgreSQL and object storage.

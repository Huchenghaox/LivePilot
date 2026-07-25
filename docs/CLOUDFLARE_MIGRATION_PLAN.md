# Cloudflare Migration Plan

## Short Answer

LivePilot should not be deployed directly to Cloudflare as-is.

The current Beta uses a Python FastAPI backend, SQLAlchemy, SQLite local files, local upload storage, and FFmpeg-oriented media processing code. Cloudflare Workers do not run Python FastAPI or local filesystem workflows directly. The frontend can move first; the backend and data layer need staged adaptation.

## Recommended Target Shape

### Frontend

- Deploy `web/` with Cloudflare Pages if Next.js 16 compatibility is acceptable for the selected adapter.
- Keep `NEXT_PUBLIC_API_BASE_URL` pointing to the existing FastAPI API during the first migration stage.
- Do not move auth/session behavior to Workers until API migration is designed.

### Backend Options

Option A: Hybrid first, lower risk.

- Cloudflare Pages: frontend.
- Existing FastAPI server: API.
- PostgreSQL or current server database: backend storage.
- R2 later for uploads.

Option B: Cloudflare-native later, higher refactor cost.

- Workers or Pages Functions: API rewritten in TypeScript.
- D1: relational data.
- R2: uploaded screenshots and future media.
- Queues: async recognition/report tasks.
- KV: lightweight config/cache.
- Cron Triggers: scheduled cleanup or sync checks.
- Durable Objects only if real-time collaboration/session coordination becomes necessary.

## Component Assessment

### Workers

Useful for:

- Lightweight API gateway.
- Auth/session verification.
- Model call proxy.
- Future TypeScript API.

Current blockers:

- FastAPI cannot run directly in Workers.
- SQLAlchemy and Python runtime are not Worker-compatible.
- FFmpeg subprocess calls are not Worker-compatible.

### D1

Useful for:

- Users, anchors, platform accounts, live sessions, metrics, reports, rules, feedback.

Migration challenges:

- Current schema is SQLAlchemy-defined, not migration-first.
- SQLite local dev uses `create_all` and `ensure_dev_schema`.
- Need explicit migrations, indexes, and D1-compatible SQL.
- Need review of foreign keys and cascade behavior.

### R2

Useful for:

- Uploaded screenshots.
- Future audio/video files.
- Exported report files.

Migration challenges:

- Current storage adapter is local filesystem.
- Need R2 adapter behind existing storage interface.
- Need signed upload/download URL strategy.

### KV

Useful for:

- Non-sensitive feature flags.
- Public platform status.
- Prompt version metadata.

Not suitable for:

- Primary relational data.
- Secrets.
- Report version history.

### Queues

Useful for:

- Async screenshot recognition.
- Report generation.
- Future media jobs.

Current blockers:

- Existing async paths are API-triggered and partly synchronous.
- Need idempotency keys and task status mapping.

### Durable Objects

Not currently required.

Possible future use:

- Real-time assistant sessions.
- Multi-user collaborative review.

## Migration Order

1. Open-source hygiene and repository cleanup.
2. Keep FastAPI backend running unchanged; deploy only frontend to a staging environment.
3. Move uploads from local disk to an adapter that supports R2, while preserving local storage for dev.
4. Replace implicit SQLite schema maintenance with explicit migrations.
5. Decide whether backend remains FastAPI on a conventional host or is rewritten to Workers.
6. If choosing Workers, port one bounded API area first, such as health/model status, before auth or reports.
7. Move relational data to D1 only after schema and query review.
8. Move async tasks to Queues after report generation and upload storage are stable.
9. Bind `livepilot.example.com` only after staging verifies auth, uploads, reports, and model settings.

## Things Not To Do Yet

- Do not delete FastAPI.
- Do not rewrite the backend to TypeScript in one pass.
- Do not bind production D1/R2 resources before schema review.
- Do not deploy Workers for media processing.
- Do not modify DNS until staging is stable.

## Current Conclusion

The safest near-term path is hybrid:

Cloudflare Pages for the frontend, existing FastAPI for the API, and later R2 for uploads. A full Workers/D1 migration is possible but should be treated as a separate backend modernization project.


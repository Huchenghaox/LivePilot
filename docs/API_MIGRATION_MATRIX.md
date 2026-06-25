# LivePilot API Migration Matrix

This document tracks the Cloudflare-native API migration from FastAPI to a D1/R2-backed Worker.

Current Worker directory: `workers/api`

Wrangler config: `workers/api/wrangler.jsonc`

Worker project name: `livepilot-api`

## Runtime Decision

LivePilot currently uses a single Worker for the migrated API surface.

- Worker: `livepilot-api`
- Database: Cloudflare D1 binding `DB`
- Upload storage: Cloudflare R2 binding `UPLOADS`
- Public R2 access: disabled
- Permanent public file URLs: not used
- FastAPI: retained for all non-migrated product APIs

The Worker does not proxy FastAPI. Migrated endpoints read and write D1/R2 directly.

## Migrated In This Stage

| Area | Endpoint | Worker status | Compatibility note |
| --- | --- | --- | --- |
| Health | `GET /health` | Migrated | Process-level health |
| Health | `GET /api/health` | Migrated | Compatible alias |
| Readiness | `GET /ready` | Migrated | Checks D1 schema and R2 write/read/delete |
| Readiness | `GET /api/ready` | Migrated | Compatible alias |
| Registration mode | `GET /api/auth/registration-mode` | Migrated | Returns `mode` and `sms_enabled` |
| SMS | `POST /api/auth/sms/send` | Migrated | Mock debug code only in local development |
| SMS | `POST /api/auth/sms/verify` | Migrated | Validates register/reset/change-phone purposes |
| Auth | `POST /api/auth/register` | Migrated | Phone-code registration, invite/open/closed modes |
| Auth | `POST /api/auth/login` | Migrated | Username + password only |
| Auth | `POST /api/auth/password-reset/start` | Migrated | Starts phone-code reset without exposing account existence |
| Auth | `POST /api/auth/password-reset/confirm` | Migrated | Updates password and invalidates old tokens |
| User | `GET /api/me` | Migrated | Returns public current-user fields only |
| User | `POST /api/account/change-password` | Migrated | Increments token version |
| Streamers | `GET /api/streamers` | Migrated | Current-user scoped |
| Streamers | `POST /api/streamers` | Migrated | Current-user scoped |
| Streamers | `GET /api/streamers/:id` | Migrated | Owner-only; cross-user returns 404 |
| Streamers | `PATCH /api/streamers/:id` | Migrated | Owner-only |
| Streamers | `DELETE /api/streamers/:id` | Migrated | Archives instead of hard delete |
| Streamers | `POST /api/streamers/:id/restore` | Migrated | Compatibility helper |
| Streamers | `POST /api/streamers/:id/set-default` | Migrated | Compatibility helper; client still stores current selection |
| Platform accounts | `GET /api/platform-accounts` | Migrated | Current-user scoped |
| Platform accounts | `POST /api/platform-accounts` | Migrated | Manual account records only |
| Platform accounts | `GET /api/platform-accounts/:id` | Migrated | Owner-only |
| Platform accounts | `PATCH /api/platform-accounts/:id` | Migrated | Owner-only |
| Platform accounts | `DELETE /api/platform-accounts/:id` | Migrated | Archives instead of hard delete |
| Platform accounts | `POST /api/platform-accounts/:id/archive` | Migrated | Compatibility alias |
| Platform binding | `GET /api/streamers/:id/platform-accounts` | Migrated | Owner-only |
| Platform binding | `POST /api/platform-accounts/:id/bind` | Migrated | Validates account and streamer belong to current user |
| Platform binding | `POST /api/platform-accounts/:id/unbind` | Migrated | Validates account and streamer belong to current user |
| Platform OAuth | `POST /api/platform/oauth/douyin/authorize-url` | Placeholder | Returns clear “not configured” message |
| Platform members | `GET /api/platform-accounts/:id/members` | Placeholder-compatible | Returns owner-only detail structure |
| Platform members | `POST/PATCH/DELETE /api/platform-accounts/:id/members...` | Placeholder | Returns clear “后续开放” error |
| Platform sync | `POST /api/platform-accounts/:id/sync` | Placeholder | Returns `unsupported`; no fake sync data |
| Dashboard | `GET /api/dashboard` | Migrated | Current-user D1 counts and onboarding flags |
| Uploads | `POST /api/uploads` | Migrated | Private R2 upload, owner-scoped D1 asset row |
| Uploads | `GET /api/uploads/:id` | Migrated | Owner-only R2 read; no public URL |
| Uploads | `DELETE /api/uploads/:id` | Migrated | Owner-only R2 delete and soft-delete row |

## Not Migrated Yet

These endpoints still belong to FastAPI and are intentionally outside this migration stage:

- AI model settings and model connection tests
- Preparation plan generation and history
- Live-session creation and review metrics
- Screenshot recognition and confirmed metrics
- Report generation, versions, feedback, and growth tasks
- Rule center and rule interpretation
- Admin-only management APIs
- Video, audio, FFmpeg, ASR, high-light clipping
- Celery, Redis, Queues, Workflows, scheduled jobs

## D1 Schema

Local migrations live in `workers/api/migrations`.

Current migrations:

- `0001_initial.sql`: initial worker users, worker sessions, private uploaded assets
- `0002_accounts_streamers_platforms.sql`: account auth, SMS verification, invitations, rate limits, streamers, platform accounts, dashboard support tables

Validated locally:

- Empty local D1 can apply migrations.
- Re-running migrations is safe through Wrangler migration history.
- Worker can read and write users, SMS rows, invitations, streamers, platform accounts, binding rows, and uploaded asset rows.

## SMS Boundary

The Worker includes SMS verification storage, hashing, TTL, attempt limits, and local-development mock delivery.

Production behavior:

- `SMS_ENABLED=false` does not pretend to send SMS.
- No verification code is returned unless `APP_ENV` is not `production` and `SMS_PROVIDER=mock`.
- Real provider credentials must be configured later as Cloudflare secrets or non-public environment bindings.

## Security Notes

- JWT is signed in the Worker with `JWT_SECRET`.
- Production requests requiring JWT fail clearly if `JWT_SECRET` is not configured.
- Password hashes are compatible with the existing FastAPI `pbkdf2_sha256` format.
- API keys, SMS secrets, and tokens are not stored in Wrangler config.
- R2 object keys are private and scoped under the authenticated user.
- R2 read/delete checks D1 ownership before touching the bucket.
- Cross-user streamer/account access returns 404.

## Local Commands

From `workers/api`:

```bash
npm install
npm run build
npm run d1:migrate:local
npm run dev
npm run test:smoke
npx wrangler deploy --dry-run
```

For local registration testing, use an untracked `.dev.vars` file:

```bash
APP_ENV=development
JWT_SECRET=local-worker-secret-local-worker-secret
REGISTRATION_MODE=invite
SMS_ENABLED=true
SMS_PROVIDER=mock
SMS_CODE_TTL_SECONDS=300
```

## Cloudflare Setup Notes

The checked-in Wrangler config already contains the D1 and R2 bindings supplied by the project owner.

Cloudflare dashboard still needs secrets for production behavior:

- `JWT_SECRET`
- Future real SMS provider secrets

If the Worker is created from GitHub with this directory as root, Cloudflare should not need manual D1/R2 binding entry unless the dashboard project ignores `workers/api/wrangler.jsonc`.

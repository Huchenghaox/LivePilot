# Deployment Overview

## Current Recommended Deployment

For the current Beta, use a real FastAPI-backed setup:

- Frontend: Next.js running on a conventional host or container.
- Backend: FastAPI running on the same server or a separate conventional Python host.
- Database: SQLite for early controlled Beta; PostgreSQL recommended before broader public launch.
- Uploads: persistent local volume for early controlled Beta; object storage adapter planned.

The shortest first production path is:

```text
Cloudflare DNS / HTTPS / Tunnel
  -> Huawei Ubuntu server
  -> Next.js frontend container
  -> FastAPI backend container
  -> SQLite database and upload volume
```

## Cloudflare Direction

Transition:

- Cloudflare Tunnel can expose the existing server first.
- Cloudflare Pages can host the frontend after API domain and CORS are stable.
- FastAPI can stay independent while the backend migration is designed.

Long-term target:

- Suitable APIs on Workers.
- Relational data on D1.
- Files on R2.
- Async model and processing tasks on Queues.
- Cron Triggers for scheduled maintenance.

## Not Ready Yet

Do not deploy the current backend directly to Workers. Current blockers:

- Python FastAPI runtime.
- SQLAlchemy ORM.
- SQLite local files.
- Local upload filesystem.
- FFmpeg subprocess assumptions in paused media features.

See `docs/CLOUDFLARE_MIGRATION_PLAN.md`.

## Related Guides

- `docs/FIRST_PRODUCTION_DEPLOYMENT.md`
- `docs/HUAWEI_SERVER_DEPLOYMENT.md`
- `docs/CLOUDFLARE_TUNNEL_DEPLOYMENT.md`
- `docs/PRODUCTION_CONFIGURATION.md`
- `docs/SECURITY_REVIEW.md`

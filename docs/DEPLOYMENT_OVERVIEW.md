# Deployment Overview

## Current Recommended Deployment

For the current Beta, use a hybrid setup:

- Frontend: static/Node-compatible Next.js hosting.
- Backend: FastAPI on a conventional Python host.
- Database: local SQLite for development; a managed relational database for production after migration planning.
- Uploads: local development storage; object storage adapter planned.

## Cloudflare Direction

Transition:

- Cloudflare Pages can host the frontend first.
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


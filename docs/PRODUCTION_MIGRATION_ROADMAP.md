# Production Migration Roadmap

## Phase 1: Fast Real Launch

- Run frontend and FastAPI on the Huawei server with Docker Compose.
- Expose with Cloudflare Tunnel.
- Use SQLite and local upload volume for controlled early Beta.
- Back up the volume before each release.

## Phase 2: Stabilize Data

- Move database from SQLite to PostgreSQL.
- Add versioned migrations.
- Add automated backups.
- Add Redis or edge rate limiting for open registration.

## Phase 3: Improve Storage

- Move uploads to object storage.
- Keep the storage adapter boundary.
- Add signed download URLs if user file download becomes public.

## Phase 4: Cloudflare-Native Frontend

- Deploy the frontend to Cloudflare Pages when the backend API domain is stable.
- Keep FastAPI as an independent backend during this step.

## Phase 5: Evaluate Worker Migration

- Move only suitable stateless API surfaces to Workers.
- Keep model calls, uploads, and long-running processing behind explicit async boundaries.
- Evaluate D1 only after SQLAlchemy/SQLite assumptions are removed.

Do not treat the Huawei transition plan as final architecture.

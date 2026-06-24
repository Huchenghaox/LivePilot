# LivePilot

Open-source AI copilot for live-stream operations and safety.

LivePilot is an open-source AI copilot for live-stream operations, content planning, safety checks, and post-stream review.

## What It Does

LivePilot helps streamers and live-stream operators turn platform backend screenshots and manual metrics into practical next-step plans:

- what went well;
- what went wrong;
- what the data actually supports;
- what to change in the next stream;
- what the streamer can say directly;
- which rules or reminders should be considered.

The current Beta focuses on screenshot-based post-stream review. Audio/video processing, real-time listening, automatic platform control, and highlight clipping are not part of the current usable scope.

## Current Core Features

- Invite-code registration and login.
- Anchor profile management.
- Douyin platform account records and anchor binding.
- Pre-stream planning: topic, title, opening script, interaction nodes, follow prompts, and safety notes.
- Screenshot review flow: create session, upload screenshots, manually confirm metrics, generate report.
- Manual data entry when no vision model is configured.
- Rule and operation prompt center.
- Text-model report generation with report versions.
- Growth task execution tracking.
- Feedback collection.
- Model settings for text analysis and image recognition.

## Product Screenshots

Screenshots are not included yet. Add product screenshots only when the images are owned by the project and contain no real user data, API keys, phone numbers, or private platform screenshots.

## Architecture

- Frontend: Next.js, React, TypeScript, Tailwind CSS.
- Backend: FastAPI, SQLAlchemy, SQLite for local Beta development.
- AI adapters: OpenAI-compatible text and vision adapters, plus explicit Mock paths for tests and demos.
- Storage: local development storage with an adapter boundary for future object storage.
- Future deployment direction: Cloudflare Pages first, then staged evaluation of Workers, D1, R2, and Queues.

See:

- `docs/CURRENT_ARCHITECTURE.md`
- `docs/CLOUDFLARE_MIGRATION_PLAN.md`
- `docs/OPEN_SOURCE_CHECKLIST.md`

## Local Setup

### Requirements

- Node.js compatible with Next.js 16.
- Python 3.9+.
- npm.

### Environment Variables

Safe examples are provided:

- `.env.example`
- `web/.env.example`

Create local files only on your machine. Do not commit real secrets.

Frontend local example:

```bash
cd web
cp .env.example .env.local
```

Backend local configuration can be provided through environment variables. The default local database is SQLite under `api/data/`, which is ignored by Git.

## Start Backend

```bash
cd api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Health check:

```bash
curl http://127.0.0.1:8000/api/health
```

## Start Frontend

```bash
cd web
npm ci
npm run dev -- --hostname 127.0.0.1 --port 3000
```

Open:

```text
http://127.0.0.1:3000
```

## Test Commands

Backend:

```bash
cd api
source .venv/bin/activate
python -m pytest
ruff check .
```

Frontend:

```bash
cd web
npm run typecheck
npm run lint
npm run build
```

## Project Structure

```text
api/      FastAPI backend
web/      Next.js frontend
docs/     Product, architecture, migration, and open-source docs
```

## Cloudflare Migration Status

Cloudflare migration is planned but not production-ready.

Transition plan:

- Cloudflare can host the frontend first.
- FastAPI can continue running independently during migration.

Long-term goal:

- Reduce reliance on traditional servers.
- Move suitable API surfaces to Workers.
- Move relational data to D1 after schema review.
- Move uploaded files to R2.
- Use Queues for async model and processing jobs where appropriate.

See `docs/CLOUDFLARE_MIGRATION_PLAN.md`.

## Roadmap

- Finish screenshot review Beta polish.
- Add public-safe demo data and screenshots.
- Improve model configuration and report quality iteration.
- Add R2-compatible storage adapter.
- Add explicit database migrations.
- Evaluate Cloudflare-native backend migration.

## Contributing

See `CONTRIBUTING.md`.

## Security

Please do not open public issues containing secrets, user data, platform tokens, or private screenshots. See `SECURITY.md`.

## License

License selection is in progress. See `docs/LICENSE_RECOMMENDATION.md`.


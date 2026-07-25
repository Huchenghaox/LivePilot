# LivePilot Current Architecture

## Project Identity

- Project name: LivePilot
- Positioning: An open-source AI copilot for live-stream operations, content planning, safety checks, and post-stream review.
- Target domain: `livepilot.example.com`
- Current product language: Chinese UI for streamers and livestream operators.
- Current stage: Screenshot review Beta.

## Frontend

- Directory: `web/`
- Framework: Next.js `16.2.9`
- Router: App Router under `web/src/app`
- Rendering model:
  - Most pages are client components using `"use client"`.
  - No project-owned Next API Routes are currently used.
  - No custom middleware is currently present.
- Styling:
  - Tailwind CSS `3.4.17`
  - shadcn/ui-style local primitives in `web/src/components/ui.tsx`
  - Dark live-stream visual system in `web/src/app/globals.css` and `web/tailwind.config.ts`
- Auth storage:
  - Frontend stores bearer token in `localStorage`.
  - API calls attach `Authorization: Bearer ...` in `web/src/lib/api.ts`.
- Runtime assumptions:
  - Browser APIs: `localStorage`, `navigator.clipboard`, `XMLHttpRequest` upload progress.
  - Frontend calls a separately deployed API through `NEXT_PUBLIC_API_BASE_URL`.

## Backend

- Directory: `api/`
- Framework: FastAPI `0.115.6`
- Server: Uvicorn
- ORM: SQLAlchemy `2.0.36`
- Current local database: SQLite through `DATABASE_URL`, defaulting to `sqlite:///./data/live_assistant.db`
- Startup behavior:
  - `Base.metadata.create_all(bind=engine)`
  - `ensure_dev_schema()` applies SQLite-oriented development schema maintenance.
- Current major API areas:
  - Auth: invite-code registration, login, bearer token validation.
  - Account: password change, data export, deletion request.
  - Anchor profiles: CRUD, archive, restore, default anchor.
  - Platform accounts: manual Douyin account records, members, anchor binding, capability status, OAuth placeholders.
  - Preparation plans: generate, edit, mark used.
  - Live sessions: create, list, archive, screenshot upload, metrics confirmation.
  - Rules center: create, interpret, confirm, version, disable.
  - Reports: model-assisted report generation, report versions, rule references, growth tasks.
  - Feedback: user feedback with report/model/rule context.
  - Media/ASR/content analysis endpoints exist from earlier phases but are not the current Beta focus.
- File handling:
  - Local storage adapter under `api/app/storage.py`
  - Uploads default to `./data/uploads`
  - Screenshot upload uses FastAPI `UploadFile`
  - Media processing layer shells out to FFmpeg for paused later phases.
- Model calls:
  - OpenAI-compatible text and vision adapters.
  - Mock adapters remain for tests and explicit demo paths.
  - API keys are encrypted before storage and masked before returning to frontend.

## Data Model

Key tables include:

- `users`
- `streamers`
- `platform_accounts`
- `anchor_platform_accounts`
- `user_platform_accounts`
- `platform_authorizations`
- `platform_sync_jobs`
- `platform_data_snapshots`
- `model_settings`
- `live_sessions`
- `uploaded_assets`
- `screenshot_recognitions`
- `recognized_metric_fields`
- `recognized_metrics`
- `preparation_plans`
- `review_reports`
- `review_report_versions`
- `growth_tasks`
- `rule_entries`
- `rule_versions`
- `rule_interpretations`
- `report_rule_references`
- `report_temporary_instructions`
- `user_feedback`
- Phase 2 paused tables: `analysis_jobs`, `audio_chunks`, `transcript_segments`, `content_analyses`, `speech_risks`

## Security Boundaries

- No Douyin password, Cookie, private scraping, simulated login, or reverse API integration.
- Douyin OAuth is only a provider interface and status placeholder unless official credentials/scopes are configured.
- Tokens and API keys must not be returned to the frontend in full.
- `.env`, `.env.local`, SQLite files, uploads, virtualenvs, node modules, and build output are ignored.

## Current Deployment Shape

Current code is easiest to run as:

- Static/Node-hosted Next.js frontend.
- FastAPI backend process.
- SQLite for local Beta or PostgreSQL-compatible database later.
- Local disk uploads for development.

It is not yet a Cloudflare-native application.


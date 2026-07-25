# LivePilot

Open-source AI copilot for live-stream operations, content planning, safety checks, performance review, and continuous improvement.

LivePilot helps content creators and live-stream teams turn stream data, platform screenshots, and operating notes into practical next-session actions. It is designed for streamers who do not have a full operations team but still need structured planning, diagnosis, risk reminders, and repeatable growth loops.

LivePilot is an independent product and is not affiliated with Douyin or ByteDance.

## What LivePilot Helps With

- Prepare a live session with AI-generated topics, titles, opening scripts, rhythm, interaction prompts, and risk reminders.
- Upload live dashboard screenshots and extract metrics with a configured vision model.
- Confirm and correct recognized metrics before they become report data.
- Generate a post-stream review that separates facts, diagnosis, assumptions, risks, and next actions.
- Turn review findings into the next preparation plan and measurable experiments.
- Manage streamers, platform accounts, rules, model providers, users, and system status.

## Current Product Status

LivePilot is an early production MVP. The Cloudflare-native path is the primary deployment target:

- API Worker: Cloudflare Workers
- Web app: Next.js on OpenNext for Cloudflare
- Database: Cloudflare D1
- Private uploads: Cloudflare R2
- AI models: OpenAI-compatible text and vision providers configured by an administrator

The legacy FastAPI implementation under `api/` is kept for regression tests and migration reference. New production work should target `workers/api/` and `web/` unless the task explicitly touches the legacy backend.

## Core Features

- Username/password login with phone-verified registration design.
- Admin-managed registration mode.
- Streamer profile management.
- Platform account records and streamer binding.
- Pre-stream planning generation.
- Screenshot upload to private R2 storage.
- Vision-model metric recognition with user confirmation.
- Manual metric correction when screenshots miss fields.
- Funnel-based post-stream diagnosis and action items.
- Report feedback and next-plan creation.
- Admin dashboard for users, system rules, model providers, and system status.

## Repository Layout

```text
workers/api/     Cloudflare API Worker, D1 migrations, R2 upload logic
web/             LivePilot Next.js app, built with OpenNext for Cloudflare
api/             Legacy FastAPI backend kept for regression and reference
docs/            Product, deployment, migration, design, and security docs
scripts/         Local production-readiness helper scripts
```

## Requirements

- Node.js 22+
- npm
- Python 3.12+ for the legacy FastAPI regression suite
- Wrangler CLI through project dependencies
- Cloudflare account with D1 and R2 bindings for production deployment

## Environment Variables

Safe examples are provided in:

- `.env.example`
- `web/.env.example`

Never commit real `.env`, `.dev.vars`, API keys, model keys, JWT secrets, database files, R2 objects, private screenshots, or user data.

Important production secrets are configured in Cloudflare, not in Git:

- `JWT_SECRET`
- `MODEL_ENCRYPTION_KEY`
- optional emergency model fallback secrets such as `MODEL_API_KEY`

## Local API Worker

```bash
cd workers/api
npm install
npm run build
npm run d1:migrate:local
npm test
npm run dev
```

## Local Web App

```bash
cd web
npm install
npm run dev
```

For local development, set the public API URL in `web/.env.local`:

```bash
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8787
```

## Cloudflare Build

API Worker:

```bash
cd workers/api
npm run build
npm run deploy -- --dry-run
```

Web Worker:

```bash
cd web
npm run typecheck
npm run lint
npm run build
npm run build:cloudflare
npm run deploy:cloudflare -- --dry-run
```

## Legacy FastAPI Regression

Run this suite when touching `api/`:

```bash
cd api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m pytest
ruff check .
```

## Testing Before Pull Requests

```bash
cd workers/api && npm run build && npm test
cd web && npm run typecheck && npm run lint && npm run build
```

## Deployment Notes

The public MVP deployment uses Cloudflare Workers, D1, and R2. Production resources and secrets are managed outside the repository.

See:

- `docs/CLOUDFLARE_DEMO_DEPLOYMENT.md`
- `docs/FIRST_PRODUCTION_DEPLOYMENT.md`
- `docs/GO_LIVE_TOMORROW.md`
- `docs/PRODUCTION_CONFIGURATION.md`
- `docs/SECURITY_REVIEW.md`

## Security

Please do not open public issues containing secrets, tokens, private screenshots, phone numbers, user data, exploit details, or model provider keys.

See `SECURITY.md` for the reporting process and security boundaries.

## Privacy and Terms

Foundational documents:

- `PRIVACY.md`
- `TERMS.md`

These documents are practical project foundations and are not legal advice. A production operator should review them with qualified counsel before serving a broad public audience.

## Contributing

Contributions are welcome. Please read `CONTRIBUTING.md` before opening issues or pull requests.

Keep contributions aligned with LivePilot's product boundaries:

- Do not add unofficial platform scraping, Cookie import, simulated login, or automatic actions on user platform accounts.
- Do not present mock output, test fixtures, or unsupported platform integration as real.
- Keep user-facing language simple enough for non-technical streamers.

## Roadmap

- Improve screenshot metric extraction stability for common live dashboard layouts.
- Strengthen report quality checks and next-session experiment tracking.
- Continue Cloudflare-native hardening.
- Add safer operating analytics for administrators.
- Prepare future real-time live copilot architecture without rushing real-time features into the MVP.

## License

LivePilot is released under the GNU Affero General Public License v3.0. See `LICENSE`.

AGPL-3.0 allows use, modification, distribution, and commercial use, while requiring network-deployed modified versions to provide corresponding source code under the license. This is not legal advice.

# Contributing to LivePilot

Thanks for helping improve LivePilot.

LivePilot is an open-source AI copilot for live-stream operations, planning, safety checks, review, and continuous improvement. Contributions should make the product easier, safer, and more useful for non-technical streamers.

## Product Boundaries

In scope:

- streamer profiles and platform account records;
- pre-stream planning;
- screenshot upload and metric confirmation;
- post-stream diagnosis, action items, and next-session plans;
- admin model provider, rule, user, and system management;
- Cloudflare Workers, D1, R2, and OpenNext deployment hardening.

Out of scope unless a maintainer explicitly approves:

- unofficial platform scraping;
- Cookie import;
- simulated platform login;
- automatic actions on a user's platform account;
- bypassing moderation or platform safety systems;
- payment, subscription, or complex organization management.

## Local Development

Read `README.md` first. Keep real secrets only in local `.env`, `.env.local`, `.dev.vars`, or Cloudflare Secrets. These files are ignored and must never be committed.

## Before Opening a Pull Request

Run the checks relevant to your changes:

```bash
cd workers/api
npm install
npm run build
npm test
```

```bash
cd web
npm install
npm run typecheck
npm run lint
npm run build
```

Run the legacy backend regression suite when touching `api/`:

```bash
cd api
source .venv/bin/activate
python -m pytest
ruff check .
```

## Pull Request Guidelines

- Keep changes focused and reviewable.
- Explain the user problem, not only the technical change.
- Include verification commands.
- Do not remove tests to make a build pass.
- Do not present mock output, test fixtures, or unsupported integrations as production behavior.
- Keep user-facing Chinese copy clear and non-technical.

## Security Boundaries

Never contribute code or files that include:

- API keys or model provider keys;
- passwords, JWTs, Cookies, or platform tokens;
- private screenshots or real user data;
- SQLite databases or upload directories;
- full API keys returned to the browser;
- logs that print secrets or uploaded content.

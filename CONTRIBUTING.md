# Contributing to LivePilot

Thanks for your interest in LivePilot.

## Current Stage

LivePilot is in screenshot review Beta. Contributions should stay within the current product scope unless a maintainer has approved a larger change.

Current focus:

- screenshot review flow;
- pre-stream planning;
- rule and prompt center;
- model settings;
- open-source readiness;
- local development stability.

Out of scope for now:

- non-official Douyin scraping;
- Cookie or password-based platform access;
- automatic platform operations;
- production Cloudflare deployment;
- audio/video and real-time assistant expansion.

## Development Setup

Read `README.md` and `docs/LOCAL_DEVELOPMENT.md`.

## Before Opening a Pull Request

Run:

```bash
cd api
source .venv/bin/activate
python -m pytest
ruff check .
```

```bash
cd web
npm run typecheck
npm run lint
npm run build
```

## Code Guidelines

- Keep user-facing UI text simple.
- Avoid exposing technical terms to streamers.
- Do not commit secrets or local runtime data.
- Do not add platform automation that performs actions on behalf of users.
- Keep Mock paths clearly labeled as demo or test behavior.

## Security Boundaries

Never contribute code that:

- stores platform passwords;
- stores user Cookies;
- scrapes private platform APIs;
- simulates platform login;
- returns full API keys or access tokens to the browser.


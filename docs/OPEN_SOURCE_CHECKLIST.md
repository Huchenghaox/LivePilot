# Open Source Checklist

## Repository Identity

- [x] Project name is LivePilot.
- [x] Positioning is documented as an open-source AI copilot for live-stream operations, content planning, safety checks, and post-stream review.
- [x] Target domain is documented as `www.haoxagent.com`.
- [x] Product copy avoids implying official Douyin ownership or authorization.

## Files That Must Not Be Committed

- [x] `.env`
- [x] `.env.*` except safe examples
- [x] `web/.env.local`
- [x] SQLite databases
- [x] `api/data/`
- [x] uploads and local storage
- [x] `node_modules/`
- [x] `.next/`
- [x] `.venv/`
- [x] caches and build artifacts
- [x] logs
- [x] old unrelated projects

## Safe Examples

- [x] Root `.env.example` contains only safe local examples.
- [x] `web/.env.example` contains only `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000`.
- [x] No API key, token, password, or production secret is present in examples.

## Current Sensitive Scan

- Checked for secret-like patterns.
- Result:
  - No hardcoded API key found.
  - No token value found.
  - No password value found.
  - `web/src/app/me/page.tsx` contains password field names only, not real credentials.
- Checked for unrelated customer/internal terms.
- Result:
  - No AIS, 中煤, 微信支付, 商城, 华为 internal material found in the new LivePilot project tree.

## Runtime Data

- Local API startup creates `api/data/live_assistant.db`.
- This file is ignored and must not be committed.
- Uploads under `api/data/uploads` are ignored and must not be committed.

## Git Hygiene

- Before each commit:
  - Run `git status --short`.
  - Confirm only LivePilot files are staged.
  - Confirm ignored runtime data remains untracked.
- Before push:
  - Run test suite.
  - Run frontend typecheck, lint, and build.
  - Run sensitive pattern scan.
  - Review `git diff --cached`.

## Known Follow-Ups

- Add an explicit open-source license before making the repository public.
- Add a public README focused on installation, local development, and security boundaries.
- Add contributor guidance if external contributions are expected.
- Decide whether Chinese UI docs and English open-source docs should be maintained separately.


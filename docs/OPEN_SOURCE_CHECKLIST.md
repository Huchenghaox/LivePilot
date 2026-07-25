# Open Source Checklist

## Repository Identity

- [x] Project name is LivePilot.
- [x] Positioning is documented as an open-source AI copilot for live-stream operations, content planning, safety checks, and post-stream review.
- [x] Target domains are documented as `livepilot.example.com` for Deployment host and `livepilot.example.com` for LivePilot.
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
- [x] `web/.env.example` contains only safe public frontend variables.
- [x] No API key, token, password, or production secret is present in examples.

## Current Sensitive Scan

- Checked for secret-like patterns before public release.
- Result:
  - No hardcoded API key found in tracked files.
  - No token value found in tracked files.
  - No production password value found in tracked files.
  - Password field names and password hashing code exist only as application logic and tests.
- Checked for unrelated customer/internal terms.
- Result:
  - No unrelated customer or internal project material is tracked in the LivePilot repository.

## Runtime Data

- Local API startup can create ignored SQLite and upload files.
- Wrangler local development can create ignored `.wrangler` state.
- These files are ignored and must not be committed.

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

## Public Release Status

- [x] Standard AGPL-3.0 `LICENSE` file is present.
- [x] Public README is updated for the Cloudflare MVP architecture.
- [x] `CONTRIBUTING.md` is present.
- [x] `SECURITY.md` is present.
- [x] Issue templates are present.
- [x] Pull request template is present.
- [x] GitHub Actions CI is present.
- [x] Dependabot configuration is present.

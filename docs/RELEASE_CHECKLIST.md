# Release Checklist

## Code Safety

- [ ] Work is in `/Users/huchenghao/Projects/livepilot`.
- [ ] `git status` is clean before push.
- [ ] No `.env`, `.env.local`, database, upload, log, token, API key, or private screenshot is tracked.
- [ ] `README.md` reflects current product scope.
- [ ] AGPL-3.0 `LICENSE` is present.

## Tests

- [ ] Worker API: `npm run build`
- [ ] Worker API: `npm test`
- [ ] Legacy backend, when touched: `python -m pytest`
- [ ] Legacy backend, when touched: `ruff check .`
- [ ] Frontend: `npm run typecheck`
- [ ] Frontend: `npm run lint`
- [ ] Frontend: `npm run build`
- [ ] Frontend Cloudflare build: `npm run build:cloudflare`
- [ ] Dependency audit reviewed.

## Docker

- [ ] `docker compose config` works on the deployment machine.
- [ ] `docker compose build` succeeds.
- [ ] `docker compose up -d` starts both services.
- [ ] `/api/health` returns ok.
- [ ] `/api/ready` returns ok.

## Product Smoke Test

- [ ] Register a new user.
- [ ] Login and logout.
- [ ] Create a streamer.
- [ ] Create a platform account.
- [ ] Configure or confirm model state.
- [ ] Generate a pre-stream plan.
- [ ] Create a review.
- [ ] Enter metrics manually.
- [ ] Generate a report.
- [ ] Submit feedback.
- [ ] Confirm mobile layout has no horizontal overflow.

## Production

- [ ] Server `.env` uses strong `JWT_SECRET`.
- [ ] `CORS_ORIGINS` is exact.
- [ ] Upload and database volumes are persistent.
- [ ] Database backup path is known.
- [ ] Rollback commit is known.
- [ ] Cloudflare Tunnel routes do not conflict with old routes.
- [ ] HTTPS works for `livepilot.example.com` and `api.livepilot.example.com`.

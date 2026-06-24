# First Production Deployment

This is the shortest practical path to make LivePilot available for real users without rewriting the backend.

## Recommended First Launch Shape

```text
User browser
  -> Cloudflare DNS / HTTPS / Tunnel
  -> Huawei Ubuntu server
  -> Next.js frontend container
  -> FastAPI backend container
  -> SQLite database and upload volume
```

This is a transition plan, not the final architecture. Later releases should move to managed PostgreSQL and object storage.

## Steps

1. Push the repository to GitHub from the formal project directory.
2. Log in to the Huawei server.
3. Clone or pull `https://github.com/Huchenghaox/LivePilot`.
4. Create a server-side `.env` file from `.env.example`.
5. Set production secrets:

```bash
APP_ENV=production
JWT_SECRET=<long-random-secret-at-least-32-chars>
INVITE_CODE=<private-invite-code>
CORS_ORIGINS=https://www.haoxagent.com
NEXT_PUBLIC_API_BASE_URL=https://api.haoxagent.com
```

6. Build, migrate, and start:

```bash
docker compose build
docker compose run --rm api alembic upgrade head
docker compose up -d
docker compose ps
```

7. Verify backend readiness:

```bash
curl http://127.0.0.1:8000/api/health
curl http://127.0.0.1:8000/api/ready
```

8. Configure Cloudflare Tunnel routes only after local server health checks pass.

## Rollback

Keep the previous image or previous Git commit available. To roll back:

```bash
git checkout <previous-commit>
docker compose build
docker compose run --rm api alembic upgrade head
docker compose up -d
```

Back up `livepilot_api_data` before upgrades.

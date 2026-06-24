# Huawei Server Deployment

This document is for tomorrow's manual server work. Do not run these commands from Codex unless explicitly asked.

## Prerequisites

- Ubuntu server access.
- Docker and Docker Compose installed.
- GitHub repository access.
- Server-side `.env` file with real production secrets.

## Deploy

```bash
git clone https://github.com/Huchenghaox/LivePilot.git
cd LivePilot
cp .env.example .env
```

Edit `.env` on the server. Do not copy it back into Git.

```bash
docker compose build
docker compose up -d
docker compose ps
```

## Health Checks

```bash
curl http://127.0.0.1:8000/api/health
curl http://127.0.0.1:8000/api/ready
curl http://127.0.0.1:3000
```

## Operations

View logs:

```bash
docker compose logs -f api
docker compose logs -f web
```

Restart:

```bash
docker compose restart
```

Stop:

```bash
docker compose down
```

Backup local volume before upgrades:

```bash
docker run --rm -v livepilot_livepilot_api_data:/data -v "$PWD":/backup busybox tar czf /backup/livepilot-api-data.tgz /data
```

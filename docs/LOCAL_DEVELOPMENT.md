# Local Development

## Backend

```bash
cd api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Default local API:

```text
http://127.0.0.1:8000
```

Health check:

```bash
curl http://127.0.0.1:8000/api/health
```

## Frontend

```bash
cd web
npm ci
cp .env.example .env.local
npm run dev -- --hostname 127.0.0.1 --port 3000
```

Default local Web:

```text
http://127.0.0.1:3000
```

## Invite Code

The local default invite code is configured by backend environment settings. For shared development, use a local `.env` and do not commit it.

## Test Commands

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

## Runtime Data

Local API startup may create:

```text
api/data/
```

This directory is ignored by Git. Do not commit local databases or uploaded files.


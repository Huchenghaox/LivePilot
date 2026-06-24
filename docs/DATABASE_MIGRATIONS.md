# Database Migrations

LivePilot now includes Alembic for versioned database migrations.

## Current State

- Alembic config: `api/alembic.ini`.
- Alembic environment: `api/alembic/env.py`.
- First migration: `20260625_0001_account_system.py`.
- `ensure_dev_schema()` still runs only outside production as a temporary local Beta compatibility helper.

## What the First Migration Covers

- Empty SQLite database initialization from current SQLAlchemy metadata.
- Upgrade of an older SQLite database that already has a legacy `users` table.
- Account-system additions:
  - username;
  - normalized username;
  - normalized phone;
  - phone verification time;
  - nickname;
  - status;
  - token version;
  - SMS verification table;
  - invite code table.

## Commands

```bash
cd api
source .venv/bin/activate
alembic upgrade head
```

Verified locally:

- empty SQLite database upgrade;
- repeated `alembic upgrade head`;
- legacy SQLite database with old `users` table upgrade.

## Production Rule

Production should run Alembic before starting the new application version. Do not rely on ad hoc startup schema mutation in production.

## Backup Before Upgrade

For a plain SQLite path:

```bash
cp api/data/live_assistant.db "api/data/live_assistant.$(date +%Y%m%d-%H%M%S).db"
```

For Docker Compose volume:

```bash
docker run --rm -v livepilot_livepilot_api_data:/data -v "$PWD":/backup busybox tar czf /backup/livepilot-api-data.tgz /data
```

Never run production migrations without a current backup.

## Remaining Work

- Split future schema changes into small, purpose-specific migrations.
- Add Alembic upgrade checks to CI once the production database path is finalized.
- Remove development schema mutation after all Beta databases have migrated.

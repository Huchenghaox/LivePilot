# Database Migrations

Current status:

- Local development uses SQLAlchemy table creation plus a development-only compatibility helper.
- `ensure_dev_schema()` now runs only outside production.
- Production should not rely on automatic ad hoc `ALTER TABLE` calls at application startup.

## Production Rule

Before broader production use, introduce a versioned migration tool. Recommended path:

1. Add Alembic.
2. Generate an initial migration from current SQLAlchemy models.
3. Add migration commands to deployment scripts.
4. Back up the database before running migrations.
5. Run migrations before starting the new application version.

## Current Early Beta

For the first controlled deployment, a fresh SQLite database can be initialized by application startup. Existing production databases should not be upgraded blindly. If an existing database is used, make a backup and test migration on a copy first.

## Backup

For Docker Compose local volume:

```bash
docker run --rm -v livepilot_livepilot_api_data:/data -v "$PWD":/backup busybox tar czf /backup/livepilot-api-data.tgz /data
```

## Open Task

Add Alembic before public self-service registration is opened widely.

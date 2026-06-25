from sqlalchemy import text

from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from app.database import engine


def alembic_config() -> Config:
    return Config("alembic.ini")


def migration_status() -> dict:
    cfg = alembic_config()
    script = ScriptDirectory.from_config(cfg)
    expected = script.get_current_head()
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
        current = MigrationContext.configure(connection).get_current_revision()
    return {
        "current": current,
        "expected": expected,
        "up_to_date": bool(expected) and current == expected,
    }

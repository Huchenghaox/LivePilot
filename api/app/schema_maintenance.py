from sqlalchemy import inspect, text

from app.database import engine


def ensure_dev_schema() -> None:
    if not engine.url.drivername.startswith("sqlite"):
        return

    inspector = inspect(engine)
    if "uploaded_assets" in inspector.get_table_names():
        columns = {column["name"] for column in inspector.get_columns("uploaded_assets")}
        additions = {
            "original_filename": "ALTER TABLE uploaded_assets ADD COLUMN original_filename VARCHAR(255) DEFAULT '' NOT NULL",
            "size_bytes": "ALTER TABLE uploaded_assets ADD COLUMN size_bytes INTEGER DEFAULT 0 NOT NULL",
            "display_order": "ALTER TABLE uploaded_assets ADD COLUMN display_order INTEGER DEFAULT 0 NOT NULL",
            "status": "ALTER TABLE uploaded_assets ADD COLUMN status VARCHAR(30) DEFAULT 'uploaded' NOT NULL",
            "error_message": "ALTER TABLE uploaded_assets ADD COLUMN error_message TEXT DEFAULT '' NOT NULL",
        }
        with engine.begin() as connection:
            for name, ddl in additions.items():
                if name not in columns:
                    connection.execute(text(ddl))

    if "analysis_jobs" in inspector.get_table_names():
        columns = {column["name"] for column in inspector.get_columns("analysis_jobs")}
        additions = {
            "updated_at": "ALTER TABLE analysis_jobs ADD COLUMN updated_at DATETIME",
        }
        with engine.begin() as connection:
            for name, ddl in additions.items():
                if name not in columns:
                    connection.execute(text(ddl))

    if "model_settings" in inspector.get_table_names():
        columns = {column["name"] for column in inspector.get_columns("model_settings")}
        additions = {
            "name": "ALTER TABLE model_settings ADD COLUMN name VARCHAR(80) DEFAULT '默认模型' NOT NULL",
            "timeout_seconds": "ALTER TABLE model_settings ADD COLUMN timeout_seconds INTEGER DEFAULT 60 NOT NULL",
            "max_retries": "ALTER TABLE model_settings ADD COLUMN max_retries INTEGER DEFAULT 1 NOT NULL",
            "is_default": "ALTER TABLE model_settings ADD COLUMN is_default BOOLEAN DEFAULT 0 NOT NULL",
            "test_status": "ALTER TABLE model_settings ADD COLUMN test_status VARCHAR(40) DEFAULT '未测试' NOT NULL",
            "last_tested_at": "ALTER TABLE model_settings ADD COLUMN last_tested_at DATETIME",
            "last_error": "ALTER TABLE model_settings ADD COLUMN last_error TEXT DEFAULT '' NOT NULL",
        }
        with engine.begin() as connection:
            for name, ddl in additions.items():
                if name not in columns:
                    connection.execute(text(ddl))

    if "users" in inspector.get_table_names():
        columns = {column["name"] for column in inspector.get_columns("users")}
        additions = {
            "is_deleted": "ALTER TABLE users ADD COLUMN is_deleted BOOLEAN DEFAULT 0 NOT NULL",
            "deletion_requested_at": "ALTER TABLE users ADD COLUMN deletion_requested_at DATETIME",
            "deletion_reason": "ALTER TABLE users ADD COLUMN deletion_reason TEXT DEFAULT '' NOT NULL",
            "default_streamer_id": "ALTER TABLE users ADD COLUMN default_streamer_id INTEGER DEFAULT 0 NOT NULL",
        }
        with engine.begin() as connection:
            for name, ddl in additions.items():
                if name not in columns:
                    connection.execute(text(ddl))

    if "user_feedback" in inspector.get_table_names():
        columns = {column["name"] for column in inspector.get_columns("user_feedback")}
        additions = {
            "streamer_id": "ALTER TABLE user_feedback ADD COLUMN streamer_id INTEGER",
            "platform_account_id": "ALTER TABLE user_feedback ADD COLUMN platform_account_id INTEGER",
            "report_version_id": "ALTER TABLE user_feedback ADD COLUMN report_version_id INTEGER",
            "model_name": "ALTER TABLE user_feedback ADD COLUMN model_name VARCHAR(120) DEFAULT '' NOT NULL",
            "rule_snapshot_json": "ALTER TABLE user_feedback ADD COLUMN rule_snapshot_json TEXT DEFAULT '[]' NOT NULL",
        }
        with engine.begin() as connection:
            for name, ddl in additions.items():
                if name not in columns:
                    connection.execute(text(ddl))

    if "streamers" in inspector.get_table_names():
        columns = {column["name"] for column in inspector.get_columns("streamers")}
        additions = {
            "average_online_range": "ALTER TABLE streamers ADD COLUMN average_online_range VARCHAR(40) DEFAULT '' NOT NULL",
            "usual_live_time": "ALTER TABLE streamers ADD COLUMN usual_live_time VARCHAR(80) DEFAULT '' NOT NULL",
            "improvement_goal": "ALTER TABLE streamers ADD COLUMN improvement_goal VARCHAR(120) DEFAULT '' NOT NULL",
            "is_archived": "ALTER TABLE streamers ADD COLUMN is_archived BOOLEAN DEFAULT 0 NOT NULL",
        }
        with engine.begin() as connection:
            for name, ddl in additions.items():
                if name not in columns:
                    connection.execute(text(ddl))

    if "live_sessions" in inspector.get_table_names():
        columns = {column["name"] for column in inspector.get_columns("live_sessions")}
        additions = {
            "is_archived": "ALTER TABLE live_sessions ADD COLUMN is_archived BOOLEAN DEFAULT 0 NOT NULL",
            "platform_account_id": "ALTER TABLE live_sessions ADD COLUMN platform_account_id INTEGER",
            "preparation_plan_id": "ALTER TABLE live_sessions ADD COLUMN preparation_plan_id INTEGER",
            "platform": "ALTER TABLE live_sessions ADD COLUMN platform VARCHAR(30) DEFAULT 'douyin' NOT NULL",
            "data_source": "ALTER TABLE live_sessions ADD COLUMN data_source VARCHAR(40) DEFAULT 'manual_input' NOT NULL",
        }
        with engine.begin() as connection:
            for name, ddl in additions.items():
                if name not in columns:
                    connection.execute(text(ddl))

    if "preparation_plans" in inspector.get_table_names():
        columns = {column["name"] for column in inspector.get_columns("preparation_plans")}
        additions = {
            "platform_account_id": "ALTER TABLE preparation_plans ADD COLUMN platform_account_id INTEGER",
            "live_form": "ALTER TABLE preparation_plans ADD COLUMN live_form VARCHAR(60) DEFAULT '' NOT NULL",
            "has_cohost": "ALTER TABLE preparation_plans ADD COLUMN has_cohost BOOLEAN DEFAULT 0 NOT NULL",
            "has_ecommerce": "ALTER TABLE preparation_plans ADD COLUMN has_ecommerce BOOLEAN DEFAULT 0 NOT NULL",
            "is_used": "ALTER TABLE preparation_plans ADD COLUMN is_used BOOLEAN DEFAULT 0 NOT NULL",
            "used_at": "ALTER TABLE preparation_plans ADD COLUMN used_at DATETIME",
        }
        with engine.begin() as connection:
            for name, ddl in additions.items():
                if name not in columns:
                    connection.execute(text(ddl))

    if "growth_tasks" in inspector.get_table_names():
        columns = {column["name"] for column in inspector.get_columns("growth_tasks")}
        additions = {
            "remark": "ALTER TABLE growth_tasks ADD COLUMN remark TEXT DEFAULT '' NOT NULL",
        }
        with engine.begin() as connection:
            for name, ddl in additions.items():
                if name not in columns:
                    connection.execute(text(ddl))

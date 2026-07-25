"""add account sms and invite fields

Revision ID: 20260625_0001
Revises:
Create Date: 2026-06-25
"""

import sqlalchemy as sa

from alembic import op

revision = "20260625_0001"
down_revision = None
branch_labels = None
depends_on = None


def _columns(table_name: str) -> set[str]:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return {column["name"] for column in inspector.get_columns(table_name)}


def _add_column_if_missing(table_name: str, column: sa.Column) -> None:
    if column.name not in _columns(table_name):
        op.add_column(table_name, column)


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())
    if not (existing_tables - {"alembic_version"}):
        from app import models  # noqa: F401
        from app.database import Base

        Base.metadata.create_all(bind=bind)
        return

    if "users" in existing_tables:
        _add_column_if_missing("users", sa.Column("phone_normalized", sa.String(length=32), nullable=True))
        _add_column_if_missing("users", sa.Column("phone_verified_at", sa.DateTime(), nullable=True))
        _add_column_if_missing("users", sa.Column("username", sa.String(length=32), nullable=True))
        _add_column_if_missing("users", sa.Column("username_normalized", sa.String(length=32), nullable=True))
        _add_column_if_missing("users", sa.Column("nickname", sa.String(length=80), nullable=False, server_default=""))
        _add_column_if_missing("users", sa.Column("email", sa.String(length=160), nullable=False, server_default=""))
        _add_column_if_missing("users", sa.Column("email_verified_at", sa.DateTime(), nullable=True))
        _add_column_if_missing("users", sa.Column("status", sa.String(length=30), nullable=False, server_default="active"))
        _add_column_if_missing("users", sa.Column("token_version", sa.Integer(), nullable=False, server_default="1"))
        _add_column_if_missing("users", sa.Column("last_login_at", sa.DateTime(), nullable=True))
        _add_column_if_missing("users", sa.Column("updated_at", sa.DateTime(), nullable=True))

    if "sms_verification_codes" not in existing_tables:
        op.create_table(
            "sms_verification_codes",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("phone_normalized", sa.String(length=32), nullable=False),
            sa.Column("phone_hash", sa.String(length=80), nullable=False),
            sa.Column("purpose", sa.String(length=40), nullable=False),
            sa.Column("code_hash", sa.String(length=120), nullable=False),
            sa.Column("expires_at", sa.DateTime(), nullable=False),
            sa.Column("used_at", sa.DateTime(), nullable=True),
            sa.Column("attempt_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("request_ip", sa.String(length=80), nullable=False, server_default=""),
            sa.Column("provider_message_id", sa.String(length=120), nullable=False, server_default=""),
            sa.Column("status", sa.String(length=30), nullable=False, server_default="pending"),
            sa.Column("created_at", sa.DateTime(), nullable=True),
        )
        op.create_index("ix_sms_verification_codes_phone_normalized", "sms_verification_codes", ["phone_normalized"])
        op.create_index("ix_sms_verification_codes_phone_hash", "sms_verification_codes", ["phone_hash"])
        op.create_index("ix_sms_verification_codes_purpose", "sms_verification_codes", ["purpose"])

    if "invite_codes" not in existing_tables:
        op.create_table(
            "invite_codes",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("code_hash", sa.String(length=120), nullable=False),
            sa.Column("label", sa.String(length=120), nullable=False, server_default=""),
            sa.Column("max_uses", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("used_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("expires_at", sa.DateTime(), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("1")),
            sa.Column("created_by", sa.Integer(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("last_used_at", sa.DateTime(), nullable=True),
        )
        op.create_index("ix_invite_codes_code_hash", "invite_codes", ["code_hash"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_invite_codes_code_hash", table_name="invite_codes")
    op.drop_table("invite_codes")
    op.drop_index("ix_sms_verification_codes_purpose", table_name="sms_verification_codes")
    op.drop_index("ix_sms_verification_codes_phone_hash", table_name="sms_verification_codes")
    op.drop_index("ix_sms_verification_codes_phone_normalized", table_name="sms_verification_codes")
    op.drop_table("sms_verification_codes")

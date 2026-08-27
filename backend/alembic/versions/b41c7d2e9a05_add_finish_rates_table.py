"""add finish_rates table

Revision ID: b41c7d2e9a05
Revises: ca2e6516d84d
Create Date: 2026-08-27

Per-process pricing rates ($/in² with a lot-charge floor), editable by Admin.
"""

import sqlalchemy as sa
from alembic import op

revision = "b41c7d2e9a05"
# Parented on ca2e6516d84d (users.last_login_at) rather than on 9dae8bea77b3.
# Both were first written from the same parent, which gave alembic two heads
# the moment they met. This branch carries that migration, so the chain is
# linear and `alembic upgrade head` resolves without a merge revision.
down_revision = "ca2e6516d84d"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "finish_rates",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("process", sa.String(length=120), nullable=False),
        sa.Column("spec", sa.String(length=160), nullable=False, server_default=""),
        sa.Column("rate_per_sq_in", sa.Numeric(precision=10, scale=4), nullable=False, server_default="0"),
        sa.Column("lot_minimum", sa.Numeric(precision=10, scale=2), nullable=False, server_default="0"),
        sa.Column("notes", sa.String(length=400), nullable=False, server_default=""),
        sa.Column("active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("updated_by", sa.String(length=120), nullable=False, server_default=""),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("process", "spec", name="uq_finish_rates_process_spec"),
    )


def downgrade() -> None:
    op.drop_table("finish_rates")

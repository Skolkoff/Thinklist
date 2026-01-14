"""add normalized_name to tags and ingestion_runs table

Revision ID: 0003_tags_and_ingestion_status
Revises: 0002_add_arxiv_source
Create Date: 2026-01-14
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0003_tags_and_ingestion_status"
down_revision: Union[str, None] = "0002_add_arxiv_source"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # tags.normalized_name
    op.add_column(
        "tags",
        sa.Column("normalized_name", sa.String(length=255), nullable=False),
    )
    op.create_unique_constraint(
        "uq_tags_normalized_name",
        "tags",
        ["normalized_name"],
    )

    # ingestion_runs
    op.create_table(
        "ingestion_runs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "source_id",
            sa.Integer(),
            sa.ForeignKey("sources.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "started_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "finished_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column("added", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("skipped", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("failed", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_index(
        "ix_ingestion_runs_started_at",
        "ingestion_runs",
        ["started_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_ingestion_runs_started_at", table_name="ingestion_runs")
    op.drop_table("ingestion_runs")

    op.drop_constraint("uq_tags_normalized_name", "tags", type_="unique")
    op.drop_column("tags", "normalized_name")



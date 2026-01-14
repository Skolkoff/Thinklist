"""add arxiv source and source meta fields

Revision ID: 0002_add_arxiv_source
Revises: 0001_initial_schema
Create Date: 2026-01-14
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0002_add_arxiv_source"
down_revision: Union[str, None] = "0001_initial_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("sources", sa.Column("type", sa.String(length=50), nullable=False, server_default="generic"))
    op.add_column("sources", sa.Column("config", sa.JSON(), nullable=True))
    op.add_column("sources", sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.sql.expression.true()))

    # Создаём источник arXiv
    op.execute(
        """
        INSERT INTO sources (name, code, url, type, config, enabled)
        VALUES (
          'arXiv',
          'arxiv',
          'https://arxiv.org',
          'arxiv',
          '{"categories": ["cs.AI", "cs.CL"], "limit": 100}',
          TRUE
        )
        ON CONFLICT (code) DO UPDATE
        SET type = EXCLUDED.type,
            config = EXCLUDED.config,
            enabled = EXCLUDED.enabled,
            url = EXCLUDED.url
        """
    )

    # Убираем server_default с type, теперь значение должно задаваться явно
    op.alter_column("sources", "type", server_default=None)


def downgrade() -> None:
    op.execute("DELETE FROM sources WHERE code = 'arxiv'")
    op.drop_column("sources", "enabled")
    op.drop_column("sources", "config")
    op.drop_column("sources", "type")



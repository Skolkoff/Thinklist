"""add user language preference

Revision ID: 0006_user_language_preference
Revises: 0005_article_comments
Create Date: 2026-05-08
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0006_user_language_preference"
down_revision: Union[str, None] = "0005_article_comments"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "language_preference",
            sa.String(length=16),
            nullable=False,
            server_default="system",
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "language_preference")

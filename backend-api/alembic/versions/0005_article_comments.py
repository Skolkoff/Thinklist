"""add article comments and comment reactions

Revision ID: 0005_article_comments
Revises: 0004_profiles_collections_chats
Create Date: 2026-05-08
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0005_article_comments"
down_revision: Union[str, None] = "0004_profiles_collections_chats"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "article_comments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "paper_id",
            sa.Integer(),
            sa.ForeignKey("papers.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "author_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_article_comments_paper_created_at",
        "article_comments",
        ["paper_id", "created_at"],
    )
    op.create_index(
        "ix_article_comments_author_id",
        "article_comments",
        ["author_id"],
    )

    op.create_table(
        "comment_reactions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "comment_id",
            sa.Integer(),
            sa.ForeignKey("article_comments.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("emoji", sa.String(length=16), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint(
            "comment_id",
            "user_id",
            "emoji",
            name="uq_comment_reactions_comment_user_emoji",
        ),
    )
    op.create_index(
        "ix_comment_reactions_comment_id",
        "comment_reactions",
        ["comment_id"],
    )
    op.create_index(
        "ix_comment_reactions_user_id",
        "comment_reactions",
        ["user_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_comment_reactions_user_id", table_name="comment_reactions")
    op.drop_index("ix_comment_reactions_comment_id", table_name="comment_reactions")
    op.drop_table("comment_reactions")

    op.drop_index("ix_article_comments_author_id", table_name="article_comments")
    op.drop_index("ix_article_comments_paper_created_at", table_name="article_comments")
    op.drop_table("article_comments")

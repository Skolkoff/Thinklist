"""add profile fields, collections metadata, and chat tables

Revision ID: 0004_profiles_collections_chats
Revises: 0003_tags_and_ingestion_status
Create Date: 2026-01-20
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0004_profiles_collections_chats"
down_revision: Union[str, None] = "0003_tags_and_ingestion_status"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("name", sa.String(length=255), nullable=True))
    op.add_column(
        "users", sa.Column("nickname", sa.String(length=255), nullable=True)
    )
    op.add_column(
        "users", sa.Column("avatar_url", sa.String(length=1000), nullable=True)
    )
    op.add_column(
        "users", sa.Column("workplace", sa.String(length=255), nullable=True)
    )
    op.add_column(
        "users", sa.Column("field_of_study", sa.String(length=255), nullable=True)
    )
    op.add_column("users", sa.Column("bio", sa.Text(), nullable=True))
    op.add_column(
        "users",
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_unique_constraint("uq_users_nickname", "users", ["nickname"])

    op.add_column(
        "collections",
        sa.Column(
            "visibility",
            sa.String(length=32),
            server_default="public",
            nullable=False,
        ),
    )
    op.add_column(
        "collections",
        sa.Column("cover_image", sa.String(length=1000), nullable=True),
    )
    op.add_column(
        "collections",
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    op.create_table(
        "chats",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    op.create_table(
        "chat_participants",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "chat_id",
            sa.Integer(),
            sa.ForeignKey("chats.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "joined_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint("chat_id", "user_id", name="uq_chat_participants_chat_user"),
    )
    op.create_index(
        "ix_chat_participants_chat_id", "chat_participants", ["chat_id"]
    )
    op.create_index(
        "ix_chat_participants_user_id", "chat_participants", ["user_id"]
    )

    op.create_table(
        "messages",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "chat_id",
            sa.Integer(),
            sa.ForeignKey("chats.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "sender_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "type",
            sa.String(length=32),
            server_default="text",
            nullable=False,
        ),
        sa.Column("text", sa.Text(), nullable=True),
        sa.Column("attachment", sa.JSON(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_messages_chat_id", "messages", ["chat_id"])
    op.create_index("ix_messages_sender_id", "messages", ["sender_id"])

    op.create_table(
        "message_reactions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "message_id",
            sa.Integer(),
            sa.ForeignKey("messages.id", ondelete="CASCADE"),
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
            "message_id",
            "user_id",
            "emoji",
            name="uq_message_reactions_message_user",
        ),
    )
    op.create_index(
        "ix_message_reactions_message_id", "message_reactions", ["message_id"]
    )

    op.create_table(
        "user_blocks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "blocker_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "blocked_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint("blocker_id", "blocked_id", name="uq_user_blocks_blocker"),
    )
    op.create_index("ix_user_blocks_blocker_id", "user_blocks", ["blocker_id"])


def downgrade() -> None:
    op.drop_index("ix_user_blocks_blocker_id", table_name="user_blocks")
    op.drop_table("user_blocks")

    op.drop_index("ix_message_reactions_message_id", table_name="message_reactions")
    op.drop_table("message_reactions")

    op.drop_index("ix_messages_sender_id", table_name="messages")
    op.drop_index("ix_messages_chat_id", table_name="messages")
    op.drop_table("messages")

    op.drop_index("ix_chat_participants_user_id", table_name="chat_participants")
    op.drop_index("ix_chat_participants_chat_id", table_name="chat_participants")
    op.drop_table("chat_participants")

    op.drop_table("chats")

    op.drop_column("collections", "updated_at")
    op.drop_column("collections", "cover_image")
    op.drop_column("collections", "visibility")

    op.drop_constraint("uq_users_nickname", "users", type_="unique")
    op.drop_column("users", "updated_at")
    op.drop_column("users", "bio")
    op.drop_column("users", "field_of_study")
    op.drop_column("users", "workplace")
    op.drop_column("users", "avatar_url")
    op.drop_column("users", "nickname")
    op.drop_column("users", "name")

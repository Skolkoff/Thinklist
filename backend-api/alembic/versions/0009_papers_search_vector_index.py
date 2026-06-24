"""add papers full-text search vector index

Revision ID: 0009_papers_search_vector_index
Revises: 0008_arxiv_ingestion_scale
Create Date: 2026-06-24
"""

from typing import Sequence, Union

from alembic import op


revision: str = "0009_papers_search_vector_index"
down_revision: Union[str, None] = "0008_arxiv_ingestion_scale"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_papers_search_vector
        ON papers
        USING gin (
            to_tsvector(
                'english',
                coalesce(title, '') || ' ' || coalesce(abstract, '')
            )
        )
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_papers_search_vector")

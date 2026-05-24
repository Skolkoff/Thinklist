"""expand arxiv source for larger article samples

Revision ID: 0007_expand_arxiv_source
Revises: 0006_user_language_preference
Create Date: 2026-05-16
"""

import json
from typing import Sequence, Union

from alembic import op


revision: str = "0007_expand_arxiv_source"
down_revision: Union[str, None] = "0006_user_language_preference"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


EXPANDED_CONFIG = {
    "categories": [
        "cs.AI",
        "cs.AR",
        "cs.CC",
        "cs.CE",
        "cs.CG",
        "cs.CL",
        "cs.CR",
        "cs.CV",
        "cs.CY",
        "cs.DB",
        "cs.DC",
        "cs.DL",
        "cs.DM",
        "cs.DS",
        "cs.ET",
        "cs.FL",
        "cs.GL",
        "cs.GR",
        "cs.GT",
        "cs.HC",
        "cs.IR",
        "cs.IT",
        "cs.LG",
        "cs.LO",
        "cs.MA",
        "cs.MM",
        "cs.MS",
        "cs.NA",
        "cs.NE",
        "cs.NI",
        "cs.OH",
        "cs.OS",
        "cs.PF",
        "cs.PL",
        "cs.RO",
        "cs.SC",
        "cs.SD",
        "cs.SE",
        "cs.SI",
        "cs.SY",
        "stat.ML",
        "math.NA",
        "math.OC",
        "q-bio.NC",
        "q-bio.QM",
        "q-fin.RM",
        "q-fin.TR",
        "physics.comp-ph",
        "cond-mat.dis-nn",
    ],
    "limit": 5000,
}

LEGACY_CONFIG = {"categories": ["cs.AI", "cs.CL"], "limit": 100}


def upgrade() -> None:
    op.execute(
        "UPDATE sources "
        f"SET config = '{json.dumps(EXPANDED_CONFIG)}' "
        "WHERE code = 'arxiv'"
    )


def downgrade() -> None:
    op.execute(
        "UPDATE sources "
        f"SET config = '{json.dumps(LEGACY_CONFIG)}' "
        "WHERE code = 'arxiv'"
    )

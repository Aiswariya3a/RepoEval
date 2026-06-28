"""add_tags_to_projects

Revision ID: 0002
Revises: 0001
Create Date: 2026-06-28 21:04:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ARRAY

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "projects",
        sa.Column("tags", ARRAY(sa.String()), server_default="{}", nullable=True),
    )


def downgrade() -> None:
    op.drop_column("projects", "tags")

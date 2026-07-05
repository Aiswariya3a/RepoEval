"""create_repos_and_snapshots

Revision ID: 0003
Revises: 0002
Create Date: 2026-07-05 08:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, ARRAY, JSONB

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── project_repos table ──────────────────────────────
    op.create_table(
        "project_repos",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("project_id", UUID(as_uuid=True), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("owner", sa.String(255), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(512), nullable=False),
        sa.Column("url", sa.String(1024), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("default_branch", sa.String(255), server_default="main", nullable=False),
        sa.Column("visibility", sa.String(32), server_default="public", nullable=False),
        sa.Column("languages", JSONB(), nullable=True),
        sa.Column("language_percentages", JSONB(), nullable=True),
        sa.Column("tech_stack", ARRAY(sa.String()), nullable=True),
        sa.Column("ingestion_status", sa.String(32), server_default="pending", nullable=False, index=True),
        sa.Column("snapshot_sha", sa.String(64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # ── repository_snapshots table ───────────────────────
    op.create_table(
        "repository_snapshots",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("repo_id", UUID(as_uuid=True), sa.ForeignKey("project_repos.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("commit_sha", sa.String(64), nullable=False),
        sa.Column("file_tree", JSONB(), nullable=True),
        sa.Column("commit_data", JSONB(), nullable=True),
        sa.Column("pr_data", JSONB(), nullable=True),
        sa.Column("issue_data", JSONB(), nullable=True),
        sa.Column("metadata_json", JSONB(), nullable=True),
        sa.Column("total_commits", sa.BigInteger(), nullable=True),
        sa.Column("total_files", sa.BigInteger(), nullable=True),
        sa.Column("total_prs", sa.BigInteger(), nullable=True),
        sa.Column("total_issues", sa.BigInteger(), nullable=True),
        sa.Column("fetched_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("repository_snapshots")
    op.drop_table("project_repos")

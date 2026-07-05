"""create_analysis_tables

Revision ID: 0005
Revises: 0003
Create Date: 2026-07-05 15:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision: str = "0005"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── static_analysis_runs table (D-10 Layer 1) ───────
    op.create_table(
        "static_analysis_runs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("snapshot_id", UUID(as_uuid=True), sa.ForeignKey("repository_snapshots.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("status", sa.String(32), nullable=False, server_default="queued", index=True),
        sa.Column("current_stage", sa.String(64), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("total_files", sa.BigInteger(), nullable=True),
        sa.Column("analyzed_files", sa.BigInteger(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # ── static_analysis_tool_results table (D-10 Layer 2) ─
    op.create_table(
        "static_analysis_tool_results",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("run_id", UUID(as_uuid=True), sa.ForeignKey("static_analysis_runs.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("tool_name", sa.String(32), nullable=False),
        sa.Column("language", sa.String(32), nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="pending"),
        sa.Column("file_count", sa.BigInteger(), nullable=True),
        sa.Column("metrics", JSONB(), nullable=True),
        sa.Column("issues", JSONB(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("duration_ms", sa.BigInteger(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # Index on tool_name for filtered queries
    op.create_index("ix_tool_results_tool_name", "static_analysis_tool_results", ["tool_name"])

    # ── code_quality_reports table (D-10 Layer 3) ────────
    op.create_table(
        "code_quality_reports",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("run_id", UUID(as_uuid=True), sa.ForeignKey("static_analysis_runs.id", ondelete="CASCADE"), nullable=False, unique=True, index=True),
        sa.Column("snapshot_id", UUID(as_uuid=True), sa.ForeignKey("repository_snapshots.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("overall_score", sa.Float(), nullable=True),
        sa.Column("lint_score", sa.Float(), nullable=True),
        sa.Column("complexity_score", sa.Float(), nullable=True),
        sa.Column("security_score", sa.Float(), nullable=True),
        sa.Column("duplication_score", sa.Float(), nullable=True),
        sa.Column("maintainability_index", sa.Float(), nullable=True),
        sa.Column("total_lint_issues", sa.BigInteger(), nullable=True),
        sa.Column("total_security_issues", sa.BigInteger(), nullable=True),
        sa.Column("duplication_percentage", sa.Float(), nullable=True),
        sa.Column("total_files_analyzed", sa.BigInteger(), nullable=True),
        sa.Column("total_lines_of_code", sa.BigInteger(), nullable=True),
        sa.Column("per_language_metrics", JSONB(), nullable=True),
        sa.Column("file_importance_index", JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("code_quality_reports")
    op.drop_table("static_analysis_tool_results")
    op.drop_table("static_analysis_runs")

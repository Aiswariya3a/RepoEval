import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, DateTime, ForeignKey, BigInteger, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.database import Base


class StaticAnalysisRun(Base):
    """Tracks each analysis execution lifecycle (D-10 Layer 1)."""
    __tablename__ = "static_analysis_runs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    snapshot_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("repository_snapshots.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(
        String(32), default="queued", index=True
    )
    # Stages: queued -> analyzing_files -> running_ruff -> running_radon -> running_bandit -> computing_importance -> computing_duplication -> aggregating -> complete | failed
    current_stage: Mapped[str | None] = mapped_column(String(64), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    total_files: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    analyzed_files: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    tool_results: Mapped[list["StaticAnalysisToolResult"]] = relationship(
        back_populates="run", cascade="all, delete-orphan"
    )
    report: Mapped["CodeQualityReport | None"] = relationship(
        back_populates="run", uselist=False, cascade="all, delete-orphan"
    )


class StaticAnalysisToolResult(Base):
    """Normalized per-tool output (D-10 Layer 2)."""
    __tablename__ = "static_analysis_tool_results"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("static_analysis_runs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    tool_name: Mapped[str] = mapped_column(String(32), nullable=False)  # "ruff", "radon", "bandit"
    language: Mapped[str] = mapped_column(String(32), nullable=False)  # "python" (future: "javascript", "go")
    status: Mapped[str] = mapped_column(String(16), default="pending")  # pending, running, completed, failed
    file_count: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    metrics: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    # Ruff: { "total_errors": int, "total_warnings": int, "issues": [{ "file": str, "line": int, "code": str, "message": str, "severity": str }] }
    # Radon: { "avg_cyclomatic_complexity": float, "max_cyclomatic_complexity": int, "maintainability_index": float, "sloc": int, "files": [{ "path": str, "complexity": int, "mi": float, "sloc": int }] }
    # Bandit: { "total_issues": int, "high_severity": int, "medium_severity": int, "low_severity": int, "issues": [{ "file": str, "line": int, "test_id": str, "issue_text": str, "severity": str, "confidence": str }] }
    issues: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    run: Mapped["StaticAnalysisRun"] = relationship(back_populates="tool_results")


class CodeQualityReport(Base):
    """Denormalized aggregated report (D-10 Layer 3). Fast reads for dashboard."""
    __tablename__ = "code_quality_reports"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("static_analysis_runs.id", ondelete="CASCADE"), nullable=False, unique=True, index=True
    )
    snapshot_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("repository_snapshots.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Composite score (D-14: 0-100 weighted average)
    overall_score: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Dimension sub-scores (0-100 normalized)
    lint_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    complexity_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    security_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    duplication_score: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Aggregated metrics
    maintainability_index: Mapped[float | None] = mapped_column(Float, nullable=True)
    total_lint_issues: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    total_security_issues: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    duplication_percentage: Mapped[float | None] = mapped_column(Float, nullable=True)
    total_files_analyzed: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    total_lines_of_code: Mapped[int | None] = mapped_column(BigInteger, nullable=True)

    # Per-language breakdown for UI drill-down
    per_language_metrics: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    # { "python": { "files": int, "sloc": int, "lint_issues": int, "avg_complexity": float, "mi": float } }

    # File importance index (D-17: canonical ranking for downstream phases)
    file_importance_index: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    # { "src/main.py": { "importance": 85, "rank": 1, "loc": 200, "complexity": 12, "is_entry_point": true }, ... }

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    run: Mapped["StaticAnalysisRun"] = relationship(back_populates="report")

import uuid
from datetime import datetime
from pydantic import BaseModel


# ── Analysis Status Types ──────────────────────────

AnalysisStatus = str
# Valid: "queued", "analyzing_files", "running_ruff", "running_radon", "running_bandit",
#         "computing_importance", "computing_duplication", "aggregating", "complete", "failed"


class AnalysisStep(BaseModel):
    name: str
    status: str  # "pending" | "active" | "completed" | "failed"
    duration_ms: int | None = None
    progress_pct: int | None = None


class AnalysisRunResponse(BaseModel):
    id: uuid.UUID
    snapshot_id: uuid.UUID
    status: AnalysisStatus
    current_stage: str | None = None
    error_message: str | None = None
    total_files: int | None = None
    analyzed_files: int | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AnalysisStatusResponse(BaseModel):
    run: AnalysisRunResponse
    steps: list[AnalysisStep] = []
    elapsed_seconds: float = 0


class CodeQualityReportResponse(BaseModel):
    id: uuid.UUID
    run_id: uuid.UUID
    snapshot_id: uuid.UUID
    overall_score: float | None = None
    lint_score: float | None = None
    complexity_score: float | None = None
    security_score: float | None = None
    duplication_score: float | None = None
    maintainability_index: float | None = None
    total_lint_issues: int | None = None
    total_security_issues: int | None = None
    duplication_percentage: float | None = None
    total_files_analyzed: int | None = None
    total_lines_of_code: int | None = None
    per_language_metrics: dict | None = None
    file_importance_index: dict | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ToolResultResponse(BaseModel):
    id: uuid.UUID
    run_id: uuid.UUID
    tool_name: str
    language: str
    status: str
    file_count: int | None = None
    metrics: dict | None = None
    issues: list | None = None
    duration_ms: int | None = None

    model_config = {"from_attributes": True}


class AnalysisTriggerResponse(BaseModel):
    run_id: uuid.UUID
    status: str
    message: str = "Analysis queued"

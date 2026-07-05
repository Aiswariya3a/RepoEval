import uuid
from datetime import datetime
from pydantic import BaseModel


# ── Ingestion Types ──────────────────────────────

IngestionStatus = str
# Valid values: "pending", "queued", "fetching_metadata", "cloning",
#               "analyzing", "complete", "failed", "paused"


class IngestionStep(BaseModel):
    name: str
    status: str  # "pending" | "active" | "completed" | "failed" | "paused"
    duration_ms: int | None = None
    progress_pct: int | None = None


# ── CRUD Schemas ─────────────────────────────────

class RepoCreate(BaseModel):
    url: str  # Must match https://github.com/{owner}/{repo} pattern


class RepoResponse(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    owner: str
    name: str
    full_name: str
    url: str
    description: str | None = None
    default_branch: str
    visibility: str
    languages: dict | None = None
    language_percentages: dict | None = None
    tech_stack: list[str] | None = None
    ingestion_status: str
    snapshot_sha: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class RepoStatusResponse(BaseModel):
    repo: RepoResponse
    steps: list[IngestionStep] = []
    elapsed_seconds: float = 0

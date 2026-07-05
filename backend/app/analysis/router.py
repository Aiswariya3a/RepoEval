import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.auth.dependencies import get_current_user
from app.models.user import User
from app.models.project import Project
from app.models.repo import Repo
from app.models.snapshot import RepositorySnapshot
from app.analysis.models import StaticAnalysisRun, StaticAnalysisToolResult, CodeQualityReport
from app.analysis.schemas import (
    AnalysisRunResponse,
    AnalysisStatusResponse,
    AnalysisStep,
    AnalysisTriggerResponse,
    CodeQualityReportResponse,
    ToolResultResponse,
)
from app.analysis.tasks import analyze_repo_task


router = APIRouter(prefix="/api/projects/{project_id}/repos/{repo_id}/analysis", tags=["analysis"])


async def _get_project(project_id: uuid.UUID, user: User, db: AsyncSession) -> Project:
    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.owner_id == user.id)
    )
    project = result.scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


async def _get_repo(repo_id: uuid.UUID, project_id: uuid.UUID, db: AsyncSession) -> Repo:
    result = await db.execute(
        select(Repo).where(Repo.id == repo_id, Repo.project_id == project_id)
    )
    repo = result.scalar_one_or_none()
    if repo is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Repository not found")
    return repo


ANALYSIS_STEP_NAMES = [
    ("Queued", "queued"),
    ("Enumerating Files", "analyzing_files"),
    ("Lint Analysis", "running_ruff"),
    ("Complexity Analysis", "running_radon"),
    ("Security Scan", "running_bandit"),
    ("Computing Importance", "computing_importance"),
    ("Detecting Duplication", "computing_duplication"),
    ("Aggregating Results", "aggregating"),
]


def _build_analysis_steps(status: str, current_stage: str | None) -> list[AnalysisStep]:
    """Build step list from current analysis status."""
    status_order_map = {step_key: i for i, (_, step_key) in enumerate(ANALYSIS_STEP_NAMES)}
    current_idx = status_order_map.get(current_stage or status, -1)

    steps = []
    for i, (step_name, step_key) in enumerate(ANALYSIS_STEP_NAMES):
        step_status = "pending"
        if current_idx >= 0:
            if i < current_idx:
                step_status = "completed"
            elif i == current_idx:
                step_status = "failed" if status == "failed" else "active"
        steps.append(AnalysisStep(name=step_name, status=step_status))

    return steps


@router.post("", response_model=AnalysisTriggerResponse, status_code=status.HTTP_201_CREATED)
async def trigger_analysis(
    project_id: uuid.UUID,
    repo_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Trigger static analysis on the latest snapshot of a repository (D-06: manual trigger).

    Requires the repo to have at least one completed ingestion with a snapshot.
    Enqueues a Celery task and returns immediately.
    """
    await _get_project(project_id, user, db)
    await _get_repo(repo_id, project_id, db)

    # Verify repo has a completed snapshot
    result = await db.execute(
        select(RepositorySnapshot)
        .where(RepositorySnapshot.repo_id == repo_id)
        .order_by(RepositorySnapshot.fetched_at.desc())
        .limit(1)
    )
    snapshot = result.scalar_one_or_none()
    if not snapshot:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No completed ingestion snapshot found. Please ingest the repository first.",
        )

    # Check if analysis already running
    result = await db.execute(
        select(StaticAnalysisRun)
        .where(StaticAnalysisRun.snapshot_id == snapshot.id)
        .order_by(StaticAnalysisRun.created_at.desc())
        .limit(1)
    )
    existing = result.scalar_one_or_none()
    if existing and existing.status not in ("complete", "failed"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Analysis already in progress (status: {existing.status})",
        )

    # Create new analysis run
    run = StaticAnalysisRun(
        snapshot_id=snapshot.id,
        status="queued",
        current_stage="queued",
        total_files=snapshot.total_files or 0,
        started_at=datetime.now(timezone.utc),
    )
    db.add(run)
    await db.commit()
    await db.refresh(run)

    # Enqueue Celery task
    analyze_repo_task.delay(str(snapshot.id))

    return AnalysisTriggerResponse(
        run_id=run.id,
        status="queued",
        message="Static analysis queued. Poll GET /status for progress.",
    )


@router.get("/status", response_model=AnalysisStatusResponse)
async def get_analysis_status(
    project_id: uuid.UUID,
    repo_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the status of the latest analysis run. Polling endpoint."""
    await _get_project(project_id, user, db)
    await _get_repo(repo_id, project_id, db)

    # Get latest snapshot
    result = await db.execute(
        select(RepositorySnapshot)
        .where(RepositorySnapshot.repo_id == repo_id)
        .order_by(RepositorySnapshot.fetched_at.desc())
        .limit(1)
    )
    snapshot = result.scalar_one_or_none()
    if not snapshot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No snapshots found for this repository")

    # Get latest analysis run
    result = await db.execute(
        select(StaticAnalysisRun)
        .where(StaticAnalysisRun.snapshot_id == snapshot.id)
        .order_by(StaticAnalysisRun.created_at.desc())
        .limit(1)
    )
    run = result.scalar_one_or_none()
    if not run:
        return AnalysisStatusResponse(
            run=AnalysisRunResponse(
                id=uuid.uuid4(),
                snapshot_id=snapshot.id,
                status="pending",
                created_at=datetime.now(timezone.utc),
            ),
            steps=_build_analysis_steps("pending", None),
            elapsed_seconds=0,
        )

    steps = _build_analysis_steps(run.status, run.current_stage)
    elapsed = 0
    if run.started_at:
        end = run.completed_at or datetime.now(timezone.utc)
        elapsed = (end - run.started_at).total_seconds()

    return AnalysisStatusResponse(
        run=AnalysisRunResponse.model_validate(run),
        steps=steps,
        elapsed_seconds=round(elapsed, 1),
    )


@router.get("/results", response_model=CodeQualityReportResponse | None)
async def get_analysis_results(
    project_id: uuid.UUID,
    repo_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the latest CodeQualityReport for this repository's analysis."""
    await _get_project(project_id, user, db)
    await _get_repo(repo_id, project_id, db)

    # Get latest snapshot
    result = await db.execute(
        select(RepositorySnapshot)
        .where(RepositorySnapshot.repo_id == repo_id)
        .order_by(RepositorySnapshot.fetched_at.desc())
        .limit(1)
    )
    snapshot = result.scalar_one_or_none()
    if not snapshot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No snapshots found")

    # Get latest completed report
    result = await db.execute(
        select(CodeQualityReport)
        .where(CodeQualityReport.snapshot_id == snapshot.id)
        .order_by(CodeQualityReport.created_at.desc())
        .limit(1)
    )
    report = result.scalar_one_or_none()
    if not report:
        return None  # 200 with null body — frontend shows "no analysis yet"

    return CodeQualityReportResponse.model_validate(report)


@router.get("/tool-results", response_model=list[ToolResultResponse])
async def get_tool_results(
    project_id: uuid.UUID,
    repo_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get individual tool results for drill-down views."""
    await _get_project(project_id, user, db)
    await _get_repo(repo_id, project_id, db)

    result = await db.execute(
        select(RepositorySnapshot)
        .where(RepositorySnapshot.repo_id == repo_id)
        .order_by(RepositorySnapshot.fetched_at.desc())
        .limit(1)
    )
    snapshot = result.scalar_one_or_none()
    if not snapshot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No snapshots found")

    result = await db.execute(
        select(StaticAnalysisRun)
        .where(StaticAnalysisRun.snapshot_id == snapshot.id)
        .order_by(StaticAnalysisRun.created_at.desc())
        .limit(1)
    )
    run = result.scalar_one_or_none()
    if not run:
        return []

    result = await db.execute(
        select(StaticAnalysisToolResult)
        .where(StaticAnalysisToolResult.run_id == run.id)
        .order_by(StaticAnalysisToolResult.created_at)
    )
    tool_results = result.scalars().all()
    return [ToolResultResponse.model_validate(tr) for tr in tool_results]

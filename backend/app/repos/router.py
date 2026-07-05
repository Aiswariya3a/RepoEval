import uuid
from datetime import datetime, timezone
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.auth.dependencies import get_current_user
from app.models.user import User
from app.models.project import Project
from app.models.repo import Repo
from app.repos.schemas import RepoCreate, RepoResponse, RepoStatusResponse, IngestionStep
from app.ingestion.tasks import ingest_repo_task

router = APIRouter(prefix="/api/projects/{project_id}/repos", tags=["repos"])


def parse_github_url(url: str) -> tuple[str, str]:
    """Parse a GitHub URL into (owner, name). Raises 422 on invalid format."""
    parsed = urlparse(url)
    if parsed.netloc not in ("github.com", "www.github.com"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="URL must be a valid GitHub repository URL (e.g., https://github.com/owner/repo)",
        )
    parts = parsed.path.strip("/").split("/")
    if len(parts) < 2 or not parts[0] or not parts[1]:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="URL must include both owner and repository name (e.g., https://github.com/owner/repo)",
        )
    return parts[0], parts[1]


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


@router.get("", response_model=list[RepoResponse])
async def list_repos(
    project_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all repositories in a project."""
    await _get_project(project_id, user, db)
    result = await db.execute(
        select(Repo).where(Repo.project_id == project_id).order_by(Repo.created_at.desc())
    )
    repos = result.scalars().all()
    return [RepoResponse.model_validate(r) for r in repos]


@router.post("", response_model=RepoResponse, status_code=status.HTTP_201_CREATED)
async def add_repo(
    project_id: uuid.UUID,
    body: RepoCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a GitHub repository URL to a project. Returns pending repo (not yet ingested)."""
    await _get_project(project_id, user, db)
    owner, name = parse_github_url(body.url)
    full_name = f"{owner}/{name}"

    # Check duplicate
    existing = await db.execute(
        select(Repo).where(Repo.project_id == project_id, Repo.full_name == full_name)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This repository has already been added to this project.",
        )

    repo = Repo(
        project_id=project_id,
        owner=owner,
        name=name,
        full_name=full_name,
        url=body.url,
        ingestion_status="pending",
    )
    db.add(repo)
    await db.commit()
    await db.refresh(repo)
    return RepoResponse.model_validate(repo)


@router.delete("/{repo_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_repo(
    project_id: uuid.UUID,
    repo_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove a repository from a project."""
    await _get_project(project_id, user, db)
    repo = await _get_repo(repo_id, project_id, db)
    await db.delete(repo)
    await db.commit()


@router.post("/{repo_id}/ingest", response_model=RepoResponse)
async def trigger_ingestion(
    project_id: uuid.UUID,
    repo_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Trigger ingestion for a repository. Enqueues Celery task."""
    await _get_project(project_id, user, db)
    repo = await _get_repo(repo_id, project_id, db)

    if repo.ingestion_status not in ("pending", "failed"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Ingestion already in progress (status: {repo.ingestion_status})",
        )

    repo.ingestion_status = "queued"
    repo.updated_at = datetime.now(timezone.utc)
    await db.commit()

    # Enqueue Celery task asynchronously
    ingest_repo_task.delay(str(repo_id))

    await db.refresh(repo)
    return RepoResponse.model_validate(repo)


@router.post("/{repo_id}/retry", response_model=RepoResponse)
async def retry_ingestion(
    project_id: uuid.UUID,
    repo_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retry a failed/paused ingestion from last checkpoint (D-50)."""
    await _get_project(project_id, user, db)
    repo = await _get_repo(repo_id, project_id, db)

    if repo.ingestion_status not in ("failed", "paused"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot retry ingestion in status: {repo.ingestion_status}",
        )

    repo.ingestion_status = "queued"
    repo.updated_at = datetime.now(timezone.utc)
    await db.commit()

    ingest_repo_task.delay(str(repo_id))

    await db.refresh(repo)
    return RepoResponse.model_validate(repo)


@router.get("/{repo_id}/status", response_model=RepoStatusResponse)
async def get_repo_status(
    project_id: uuid.UUID,
    repo_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get ingestion status and step data for a repository. Polling endpoint (D-43)."""
    await _get_project(project_id, user, db)
    repo = await _get_repo(repo_id, project_id, db)

    steps = _build_status_steps(repo.ingestion_status)
    return RepoStatusResponse(
        repo=RepoResponse.model_validate(repo),
        steps=steps,
        elapsed_seconds=0,  # Will be calculated from step timestamps in Plan 02
    )


def _build_status_steps(status: str) -> list[IngestionStep]:
    """Build the step list from the current ingestion status (D-44)."""
    all_steps = [
        ("Queued", "queued"),
        ("Fetching Metadata", "fetching_metadata"),
        ("Cloning Repository", "cloning"),
        ("Analyzing Code", "analyzing"),
    ]

    status_order = ["pending", "queued", "fetching_metadata", "cloning", "analyzing", "complete"]
    current_idx = status_order.index(status) if status in status_order else -1

    steps = []
    for i, (step_name, step_key) in enumerate(all_steps):
        step_status = "pending"
        if current_idx >= 0:
            if i < current_idx:
                step_status = "completed"
            elif i == current_idx:
                if status == "failed":
                    step_status = "failed"
                elif status == "paused":
                    step_status = "paused"
                else:
                    step_status = "active"
        steps.append(IngestionStep(name=step_name, status=step_status))

    return steps

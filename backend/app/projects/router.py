import math
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.auth.dependencies import get_current_user
from app.models.project import Project
from app.models.repo import Repo
from app.models.user import User
from app.projects.schemas import ProjectCreate, ProjectUpdate, ProjectResponse, ProjectListResponse
from app.repos.router import parse_github_url

router = APIRouter(prefix="/api/projects", tags=["projects"])

# ── Helpers ──────────────────────────────────────────

IN_PROGRESS_STATUSES = {"queued", "fetching_metadata", "cloning", "analyzing"}


def _aggregate_ingestion_status(repos: list[Repo]) -> str | None:
    """Aggregate multiple repos' statuses per D-41 priority: failed > paused > in_progress > complete > pending."""
    if not repos:
        return None

    has_failed = any(r.ingestion_status == "failed" for r in repos)
    has_paused = any(r.ingestion_status == "paused" for r in repos)
    has_in_progress = any(r.ingestion_status in IN_PROGRESS_STATUSES for r in repos)
    has_complete = any(r.ingestion_status == "complete" for r in repos)

    if has_failed:
        return "failed"
    if has_paused:
        return "paused"
    if has_in_progress:
        return "queued"  # Generic "in progress"
    if has_complete:
        return "complete"
    return "pending"


def _set_repo_aggregates(resp: ProjectResponse, repos: list[Repo]) -> None:
    """Set computed repo_count and ingestion_status on a ProjectResponse."""
    resp.repo_count = len(repos)
    resp.ingestion_status = _aggregate_ingestion_status(repos)


@router.get("", response_model=ProjectListResponse)
async def list_projects(
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    offset = (page - 1) * page_size

    count_result = await db.execute(
        select(func.count(Project.id)).where(Project.owner_id == user.id)
    )
    total = count_result.scalar_one()

    result = await db.execute(
        select(Project)
        .where(Project.owner_id == user.id)
        .options(selectinload(Project.repos))
        .order_by(Project.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    projects = result.scalars().all()

    total_pages = math.ceil(total / page_size) if total > 0 else 0

    responses = []
    for p in projects:
        resp = ProjectResponse.model_validate(p)
        _set_repo_aggregates(resp, p.repos)
        responses.append(resp)

    return ProjectListResponse(
        items=responses,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    body: ProjectCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = Project(
        name=body.name,
        description=body.description,
        tags=body.tags if body.tags is not None else [],
        owner_id=user.id,
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)

    # Create Repo records for any repo URLs provided
    if body.repo_urls:
        for url in body.repo_urls:
            try:
                owner, name = parse_github_url(url)
                repo = Repo(
                    project_id=project.id,
                    owner=owner,
                    name=name,
                    full_name=f"{owner}/{name}",
                    url=url,
                    ingestion_status="pending",
                )
                db.add(repo)
            except HTTPException:
                continue  # Skip invalid URLs silently during creation
        await db.commit()
        # Reload project with repos to get accurate counts
        result = await db.execute(
            select(Project)
            .where(Project.id == project.id)
            .options(selectinload(Project.repos))
        )
        project = result.scalar_one()

    resp = ProjectResponse.model_validate(project)
    _set_repo_aggregates(resp, project.repos)
    return resp


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Project)
        .where(Project.id == project_id, Project.owner_id == user.id)
        .options(selectinload(Project.repos))
    )
    project = result.scalar_one_or_none()
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )
    resp = ProjectResponse.model_validate(project)
    _set_repo_aggregates(resp, project.repos)
    return resp


@router.patch("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: uuid.UUID,
    body: ProjectUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.owner_id == user.id)
    )
    project = result.scalar_one_or_none()
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(project, field, value)

    project.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(project)
    # Reload with repos for aggregate data
    result = await db.execute(
        select(Project)
        .where(Project.id == project.id)
        .options(selectinload(Project.repos))
    )
    project = result.scalar_one()
    resp = ProjectResponse.model_validate(project)
    _set_repo_aggregates(resp, project.repos)
    return resp


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.owner_id == user.id)
    )
    project = result.scalar_one_or_none()
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    await db.delete(project)
    await db.commit()

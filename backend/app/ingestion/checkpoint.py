import uuid
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.repo import Repo


STAGE_ORDER = [
    "queued",
    "fetching_metadata",
    "cloning",
    "analyzing",
    "complete",
]


class CheckpointManager:
    """Manages per-repo checkpoint state for resume capability (D-50)."""

    def __init__(self, repo_id: uuid.UUID, db: AsyncSession):
        self.repo_id = repo_id
        self.db = db

    async def get_last_stage(self) -> str:
        """Return the last successfully completed stage name."""
        result = await self.db.execute(
            select(Repo.ingestion_status).where(Repo.id == self.repo_id)
        )
        status = result.scalar_one_or_none()
        return status or "pending"

    async def save_stage(self, stage: str) -> None:
        """Persist the current stage as the last completed checkpoint."""
        result = await self.db.execute(select(Repo).where(Repo.id == self.repo_id))
        repo = result.scalar_one_or_none()
        if repo:
            repo.ingestion_status = stage
            repo.updated_at = datetime.now(timezone.utc)
            await self.db.commit()

    async def should_resume(self, stage: str) -> bool:
        """Check if a stage has already been completed (skip on resume)."""
        last_stage = await self.get_last_stage()
        if last_stage == "failed":
            # Find the highest completed stage
            return False
        try:
            return STAGE_ORDER.index(stage) <= STAGE_ORDER.index(last_stage)
        except ValueError:
            return False

    @staticmethod
    def next_stage(current: str) -> str | None:
        """Return the next stage after current, or None if last."""
        try:
            idx = STAGE_ORDER.index(current)
            if idx < len(STAGE_ORDER) - 1:
                return STAGE_ORDER[idx + 1]
            return None
        except ValueError:
            return None

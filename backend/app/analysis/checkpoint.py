import uuid
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.analysis.models import StaticAnalysisRun


ANALYSIS_STAGE_ORDER = [
    "queued",
    "analyzing_files",
    "running_ruff",
    "running_radon",
    "running_bandit",
    "computing_importance",
    "computing_duplication",
    "aggregating",
    "complete",
]


class AnalysisCheckpointManager:
    """Manages per-run checkpoint state for resume capability (D-07, D-09).

    Stores progress on StaticAnalysisRun.current_stage.
    """

    def __init__(self, run_id: uuid.UUID, db: AsyncSession):
        self.run_id = run_id
        self.db = db

    async def get_last_stage(self) -> str:
        """Return the last successfully completed stage name."""
        result = await self.db.execute(
            select(StaticAnalysisRun.current_stage).where(StaticAnalysisRun.id == self.run_id)
        )
        stage = result.scalar_one_or_none()
        return stage or "queued"

    async def save_stage(self, stage: str) -> None:
        """Persist the current stage as the last completed checkpoint."""
        result = await self.db.execute(
            select(StaticAnalysisRun).where(StaticAnalysisRun.id == self.run_id)
        )
        run = result.scalar_one_or_none()
        if run:
            run.current_stage = stage
            run.updated_at = datetime.now(timezone.utc)
            await self.db.commit()

    async def should_resume(self, stage: str) -> bool:
        """Check if a stage has already been completed (skip on resume)."""
        last_stage = await self.get_last_stage()
        if last_stage == "failed" or last_stage == "complete":
            # Failed = find highest completed; Complete = skip everything
            return False
        try:
            return ANALYSIS_STAGE_ORDER.index(stage) <= ANALYSIS_STAGE_ORDER.index(last_stage)
        except ValueError:
            return False

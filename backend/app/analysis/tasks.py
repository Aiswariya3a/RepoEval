import uuid
from app.celery_app import celery_app
from app.analysis.pipeline import run_analysis


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def analyze_repo_task(self, snapshot_id: str):
    """Celery task: run static analysis on a repository snapshot.

    Retries with exponential backoff on failure.
    Checkpoint recovery (D-09) handles resume from last successful stage.
    """
    import asyncio
    try:
        asyncio.run(run_analysis(uuid.UUID(snapshot_id)))
    except Exception as exc:
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))

import uuid
from app.celery_app import celery_app
from app.ingestion.pipeline import ingest_repo


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def ingest_repo_task(self, repo_id: str):
    """Celery task: ingest a GitHub repository. Retries with backoff on failure."""
    import asyncio
    try:
        asyncio.run(ingest_repo(uuid.UUID(repo_id)))
    except Exception as exc:
        # Retry with exponential backoff (D-50 checkpoint recovery handles resume)
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))


@celery_app.task(bind=True)
def retry_ingestion_task(self, repo_id: str):
    """Retry ingestion from last checkpoint (D-50). Same as ingest but status is already 'failed'."""
    # CheckpointManager.should_resume will detect last successful stage
    return ingest_repo_task.delay(repo_id)

from celery import Celery
from app.config import Settings

settings = Settings()

celery_app = Celery(
    "repoeval",
    broker=settings.celery_broker_url,
    backend=settings.celery_broker_url,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_track_started=True,
    task_soft_time_limit=3600,
    task_time_limit=4200,
)

# Auto-discover tasks
celery_app.autodiscover_tasks(["app.ingestion"])

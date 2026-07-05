from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    app_name: str = "RepoEval"
    debug: bool = False

    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/repoeval"
    database_echo: bool = False

    redis_url: str = "redis://localhost:6379/0"

    github_client_id: str = ""
    github_client_secret: str = ""
    github_redirect_uri: str = "http://localhost:8000/api/auth/callback"

    jwt_private_key_path: str = "./keys/private.pem"
    jwt_public_key_path: str = "./keys/public.pem"
    jwt_access_token_expire_minutes: int = 15
    jwt_refresh_token_expire_days: int = 7

    frontend_url: str = "http://localhost:3000"

    celery_broker_url: str = "redis://localhost:6379/0"
    temp_clone_path: str = "/tmp/repoeval_clones"
    github_token_refresh_threshold: int = 300

    # ── Analysis settings ──────────────────────────────
    analysis_batch_size: int = 50
    analysis_deep_analysis_threshold: int = 50
    analysis_max_files: int = 10000
    analysis_timeout_per_tool: int = 300

    # Importance score weights (must sum to 1.0 for weight-bearing heuristics)
    importance_weight_loc: float = 0.15
    importance_weight_complexity: float = 0.20
    importance_weight_entry_point: float = 0.25
    importance_weight_centrality: float = 0.20
    importance_weight_recency: float = 0.10
    importance_weight_directory: float = 0.10

    # Composite score weights
    score_weight_lint: float = 0.30
    score_weight_complexity: float = 0.30
    score_weight_security: float = 0.25
    score_weight_duplication: float = 0.15

    @property
    def cors_origins(self) -> List[str]:
        return [self.frontend_url]

    model_config = {"env_prefix": "REPOEVAL_"}

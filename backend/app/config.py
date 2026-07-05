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

    @property
    def cors_origins(self) -> List[str]:
        return [self.frontend_url]

    model_config = {"env_prefix": "REPOEVAL_"}

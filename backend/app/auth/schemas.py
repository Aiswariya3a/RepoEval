from pydantic import BaseModel
from datetime import datetime
import uuid


class UserResponse(BaseModel):
    id: uuid.UUID
    github_id: int
    email: str | None = None
    display_name: str
    avatar_url: str | None = None

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class ErrorResponse(BaseModel):
    detail: str

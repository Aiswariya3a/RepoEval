import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, DateTime, ForeignKey
from typing import TYPE_CHECKING
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, ARRAY, JSONB
from app.database import Base

if TYPE_CHECKING:
    from app.models.project import Project
    from app.models.snapshot import RepositorySnapshot


class Repo(Base):
    __tablename__ = "project_repos"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    owner: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(512), nullable=False)
    url: Mapped[str] = mapped_column(String(1024), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    default_branch: Mapped[str] = mapped_column(String(255), default="main")
    visibility: Mapped[str] = mapped_column(String(32), default="public")
    languages: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    language_percentages: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    tech_stack: Mapped[list[str] | None] = mapped_column(ARRAY(String), nullable=True)
    ingestion_status: Mapped[str] = mapped_column(
        String(32), default="pending", index=True
    )
    snapshot_sha: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    project: Mapped["Project"] = relationship(back_populates="repos")
    snapshots: Mapped[list["RepositorySnapshot"]] = relationship(
        back_populates="repo", cascade="all, delete-orphan"
    )

import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, ForeignKey, BigInteger
from typing import TYPE_CHECKING
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.database import Base

if TYPE_CHECKING:
    from app.models.repo import Repo


class RepositorySnapshot(Base):
    __tablename__ = "repository_snapshots"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    repo_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("project_repos.id", ondelete="CASCADE"), nullable=False, index=True
    )
    commit_sha: Mapped[str] = mapped_column(String(64), nullable=False)
    file_tree: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    commit_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    pr_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    issue_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    metadata_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    total_commits: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    total_files: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    total_prs: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    total_issues: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    fetched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    repo: Mapped["Repo"] = relationship(back_populates="snapshots")

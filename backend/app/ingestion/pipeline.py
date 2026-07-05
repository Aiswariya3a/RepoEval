import asyncio
import json
import os
import shutil

import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.database import async_session
from app.models.repo import Repo
from app.models.snapshot import RepositorySnapshot
from app.ingestion.checkpoint import CheckpointManager
from app.ingestion.github_client import GithubClient


settings = Settings()


async def ingest_repo(repo_id: uuid.UUID) -> None:
    """Main ingestion pipeline. Runs stages in order with checkpoint recovery (D-50)."""
    async with async_session() as db:
        result = await db.execute(select(Repo).where(Repo.id == repo_id))
        repo = result.scalar_one_or_none()
        if not repo:
            return

        checkpoint = CheckpointManager(repo_id, db)

        # TODO: Get user's GitHub access_token from session (Phase 1 auth stores it)
        # For now, raise if not available — token integration happens in Plan 04 or later
        access_token = await _get_user_github_token(repo.project_id, db)
        if not access_token:
            await _set_failed(repo, db, "GitHub access token not found. Re-authenticate with GitHub.")
            return

        client = GithubClient(access_token)
        owner, name = repo.owner, repo.name
        clone_path = Path(settings.temp_clone_path) / str(repo_id)

        try:
            # ── Stage 1: Fetch Metadata ───────────────────────────
            if not await checkpoint.should_resume("fetching_metadata"):
                await checkpoint.save_stage("fetching_metadata")
                metadata = await client.get_repo_metadata(owner, name)
                languages = await client.get_languages(owner, name)
                total_bytes = sum(languages.values()) if languages else 1

                repo.description = metadata["description"]
                repo.default_branch = metadata["default_branch"]
                repo.visibility = metadata["visibility"]
                repo.languages = languages
                repo.language_percentages = {
                    lang: round((bytes_count / total_bytes) * 100, 1)
                    for lang, bytes_count in (languages or {}).items()
                }
                tech_stack = metadata.get("topics", [])
                if metadata.get("language"):
                    tech_stack = [metadata["language"]] + [t for t in tech_stack if t != metadata["language"]]
                repo.tech_stack = tech_stack[:20]  # Limit to 20 items
                await db.commit()

            # ── Stage 2: Clone Repository ─────────────────────────
            # Hoist variables needed by Stage 4, with DB fallbacks on resume
            head_sha = repo.snapshot_sha
            file_tree = None
            if repo.snapshot_sha:
                # Restore file_tree from the most recent snapshot (if any)
                snapshot_result = await db.execute(
                    select(RepositorySnapshot)
                    .where(RepositorySnapshot.repo_id == repo_id)
                    .order_by(RepositorySnapshot.fetched_at.desc())
                )
                latest_snapshot = snapshot_result.scalar_one_or_none()
                if latest_snapshot:
                    file_tree = latest_snapshot.file_tree

            if not await checkpoint.should_resume("cloning"):
                await checkpoint.save_stage("cloning")
                clone_url = f"https://x-access-token:{access_token}@github.com/{owner}/{name}.git"
                os.makedirs(str(clone_path.parent), exist_ok=True)

                # Shallow clone for speed (D-34: temp storage, delete after success)
                proc = await asyncio.create_subprocess_exec(
                    "git", "clone", "--depth", "50", clone_url, str(clone_path),
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
                await asyncio.wait_for(proc.wait(), timeout=300)

                # Get HEAD commit SHA
                sha_proc = await asyncio.create_subprocess_exec(
                    "git", "-C", str(clone_path), "rev-parse", "HEAD",
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
                stdout, _ = await asyncio.wait_for(sha_proc.communicate(), timeout=30)
                head_sha = stdout.decode().strip()

                # Build file tree (recursive listing for Phase 4)
                file_tree = _build_file_tree(clone_path)

                repo.snapshot_sha = head_sha
                await db.commit()

            # ── Stage 3: Extract Commits, PRs, Issues ─────────────
            # Note: Full commit history is fetched via API (not git log) for richer data
            if not await checkpoint.should_resume("analyzing"):
                await checkpoint.save_stage("analyzing")

                # Fetch additional data from API
                commits_task = asyncio.create_task(
                    client.get_commits(owner, name, sha=repo.default_branch)
                )
                prs_task = asyncio.create_task(
                    client.get_pull_requests(owner, name)
                )
                issues_task = asyncio.create_task(
                    client.get_issues(owner, name)
                )

                commits, prs, issues = await asyncio.gather(
                    commits_task, prs_task, issues_task,
                )

                # ── Stage 4: Create Snapshot (D-48) ──────────────
                snapshot = RepositorySnapshot(
                    repo_id=repo_id,
                    commit_sha=head_sha,
                    file_tree=file_tree,
                    commit_data={"commits": commits},
                    pr_data={"pull_requests": prs},
                    issue_data={"issues": issues},
                    total_commits=len(commits),
                    total_files=_count_files(file_tree),
                    total_prs=len(prs),
                    total_issues=len(issues),
                )
                db.add(snapshot)

            # ── Stage 5: Complete ─────────────────────────────────
            repo.ingestion_status = "complete"
            repo.updated_at = datetime.now(timezone.utc)
            await db.commit()

        except Exception as exc:
            await _set_failed(repo, db, str(exc))
            raise
        finally:
            # Clean up clone (D-34)
            if clone_path.exists():
                shutil.rmtree(str(clone_path), ignore_errors=True)


def _build_file_tree(root: Path) -> dict:
    """Build a recursive file tree structure from the cloned repo."""
    tree = {}
    try:
        for path in root.rglob("*"):
            if path.is_file() and not _is_ignored(path):
                rel_path = str(path.relative_to(root))
                parts = rel_path.replace("\\", "/").split("/")
                current = tree
                for i, part in enumerate(parts):
                    if i == len(parts) - 1:
                        stat = path.stat()
                        current[part] = {
                            "size": stat.st_size,
                            "ext": path.suffix,
                        }
                    else:
                        current = current.setdefault(part, {})
    except Exception:
        pass  # Best-effort tree building
    return tree


def _is_ignored(path: Path) -> bool:
    """Check if a path should be excluded from the file tree."""
    ignored_dirs = {".git", "node_modules", "__pycache__", ".venv", "venv", ".next"}
    return any(part in ignored_dirs for part in path.parts)


def _count_files(tree: dict) -> int:
    """Count leaf nodes (files) in the file tree."""
    count = 0
    for key, value in tree.items():
        if isinstance(value, dict):
            if "size" in value:
                count += 1
            else:
                count += _count_files(value)
    return count


async def _get_user_github_token(project_id: uuid.UUID, db: AsyncSession) -> str | None:
    """Retrieve the user's GitHub access token from the project owner's auth."""
    from app.models.project import Project
    from app.models.user import User
    result = await db.execute(
        select(User).join(Project, Project.owner_id == User.id).where(Project.id == project_id)
    )
    user = result.scalar_one_or_none()
    if user:
        # The User model might store github_token — check the Phase 1 auth implementation
        return getattr(user, "github_token", None) or getattr(user, "github_access_token", None)
    return None


async def _set_failed(repo: Repo, db: AsyncSession, error: str) -> None:
    """Set repo status to failed with error detail."""
    repo.ingestion_status = "failed"
    repo.updated_at = datetime.now(timezone.utc)
    await db.commit()

---
phase: 03-github-integration-repository-ingestion
plan: 01
type: execute
subsystem: backend
tags:
  - data-model
  - api
  - alembic
  - repository-ingestion
requires:
  - phase-01-auth
  - phase-02-project-crud
provides:
  - project-repos-model
  - repo-snapshots-model
  - repos-api-endpoints
affects:
  - backend/app/models/project.py (repos relationship)
  - backend/app/projects/schemas.py (repo_count field)
  - backend/app/main.py (repos_router registration)
  - backend/alembic/env.py (new model imports)
tech-stack:
  added:
    - githubkit==0.15.* (GitHub API client library)
  patterns:
    - FastAPI router with `selectinload` for relationship population
    - GitHub URL parsing with validation (rejects non-github.com)
    - Ingestion status lifecycle step-builder (_build_status_steps)
key-files:
  created:
    - backend/app/models/repo.py
    - backend/app/models/snapshot.py
    - backend/alembic/versions/0003_create_repos_and_snapshots.py
    - backend/app/repos/__init__.py
    - backend/app/repos/schemas.py
    - backend/app/repos/router.py
  modified:
    - backend/app/models/__init__.py
    - backend/app/models/project.py
    - backend/alembic/env.py
    - backend/app/main.py
    - backend/app/projects/schemas.py
    - backend/app/projects/router.py
    - backend/requirements.txt
    - backend/pyproject.toml
decisions:
  - Hand-wrote Alembic migration 0003 (autogenerate requires live DB, not available at plan time)
  - Router prefix is `/api/projects/{project_id}/repos` (nested under projects for ownership scoping)
  - trigger_ingestion endpoint is a placeholder — sets status to "queued" only (Plan 02 wires to Celery)
  - Repo URL validation rejects non-github.com domains with 422 Unprocessable Entity
metrics:
  duration: "~3 minutes"
  completed: "2026-07-05"
  task_count: 2
  commit_count: 2
---

# Phase 03 Plan 01: Repository Data Models & REST API

**One-liner:** Created `project_repos` and `repository_snapshots` SQLAlchemy models, Alembic migration 0003, Pydantic schemas with D-44 status lifecycle, and 5 REST endpoints for repository ingestion.

## Summary

This plan established the backend data foundation for GitHub repository ingestion in Phase 3. The `project_repos` table (D-45) stores repository metadata, language detection results, and ingestion status. The `repository_snapshots` table (D-48) provides immutable snapshots linked to a specific commit SHA, with JSONB columns for file tree, commit data, PR data, and issue data for downstream phases.

### Task 1: Repo and RepositorySnapshot SQLAlchemy Models + Alembic Migration

- Created `Repo` model (table: `project_repos`) with 15 columns matching D-45
- Created `RepositorySnapshot` model (table: `repository_snapshots`) with 13 columns matching D-48
- Registered both models in `app/models/__init__.py`
- Added `repos` relationship to `Project` model with cascade delete
- Updated `alembic/env.py` to import new models
- Hand-wrote Alembic migration `0003_create_repos_and_snapshots.py` (autogenerate requires live DB)
- **Commit:** `097d8c9`

### Task 2: Pydantic Schemas and REST API Router with 5 Endpoints

- Created `RepoCreate`, `RepoResponse`, `RepoStatusResponse`, `IngestionStep` schemas
- Created 5 endpoints in `router.py`:
  - `GET /api/projects/{id}/repos` — list repos (auth-scoped to project owner)
  - `POST /api/projects/{id}/repos` — add repo URL (validates GitHub URL format, duplicate detection → 409)
  - `DELETE /api/projects/{id}/repos/{repo_id}` — remove repo (owner-scoped, 204 No Content)
  - `POST /api/projects/{id}/repos/{repo_id}/ingest` — trigger ingestion placeholder (sets status → queued)
  - `GET /api/projects/{id}/repos/{repo_id}/status` — get ingestion status with step data (D-44 lifecycle)
- Added `_build_status_steps()` — maps current status to step-by-step progress per D-44
- Added `parse_github_url()` — validates GitHub URL format (rejects non-github.com)
- Registered `repos_router` in `app/main.py`
- Added `repo_count` field to `ProjectResponse`
- Updated `projects/router.py` — `selectinload(Project.repos)` + manual `repo_count` population
- Added `githubkit==0.15.*` to `requirements.txt` and `pyproject.toml`
- **Commit:** `a0492fc`

### Successful Verification Results

| Check | Result |
|-------|--------|
| `Repo` model definition | PASS |
| `RepositorySnapshot` model definition | PASS |
| Models registered in `__init__.py` | PASS |
| Migration file exists (0003) | PASS |
| `repos` relationship on Project | PASS |
| 5 REST endpoints defined | PASS |
| `repos_router` registered in `main.py` | PASS |
| `repo_count` in `ProjectResponse` | PASS |
| `selectinload` used in projects router | PASS |
| `githubkit` added to requirements | PASS |
| `python -c "from app.models import Repo, RepositorySnapshot; print('OK')"` | PASS |
| `python -c "from app.repos.schemas import RepoResponse, RepoStatusResponse, IngestionStep; print('OK')"` | PASS |
| `python -c "from app.repos.router import router; print('OK')"` | PASS |
| `python -c "from app.main import app; print('OK')"` | PASS |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

1. **`backend/app/repos/router.py:132`** — `trigger_ingestion` endpoint is a placeholder (TODO comment). It sets `ingestion_status` to "queued" but does not enqueue a Celery task. Plan 02 will wire this to the actual ingestion pipeline. This is intentional per the plan's scope boundary.

## Threat Flags

None — all threats from the plan's threat model are properly mitigated:
- T-03-01 (Spoofing): GitHub URL format validation + auth dependency on all endpoints
- T-03-02 (Tampering): All mutations scoped to `project_id` + `owner_id` via `_get_project`
- T-03-03 (Information Disclosure): Repos scoped per project, users only see own repos
- T-03-04 (DoS): No hard limit yet (accepted risk per plan)
- T-03-05 (EoP): `_get_project` verifies ownership before any operation

## Self-Check: PASSED

- [x] `backend/app/models/repo.py` exists (147 lines)
- [x] `backend/app/models/snapshot.py` exists (42 lines)
- [x] `backend/app/models/__init__.py` includes Repo and RepositorySnapshot
- [x] `backend/app/models/project.py` has repos relationship
- [x] `backend/alembic/versions/0003_create_repos_and_snapshots.py` exists (95 lines)
- [x] `backend/alembic/env.py` imports Repo and RepositorySnapshot
- [x] `backend/app/repos/__init__.py` exists
- [x] `backend/app/repos/schemas.py` exists (52 lines)
- [x] `backend/app/repos/router.py` exists (177 lines)
- [x] `backend/app/main.py` includes repos_router
- [x] `backend/app/projects/schemas.py` has repo_count field
- [x] `backend/app/projects/router.py` uses selectinload for repos
- [x] `backend/requirements.txt` includes githubkit
- [x] `backend/pyproject.toml` includes githubkit
- [x] Commit `097d8c9` exists: feat(03-01): create Repo and RepositorySnapshot SQLAlchemy models + Alembic migration
- [x] Commit `a0492fc` exists: feat(03-01): create Repo Pydantic schemas and REST API router with 5 endpoints

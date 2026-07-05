---
phase: 03-github-integration-repository-ingestion
plan: 02
type: execute
subsystem: backend
tags:
  - ingestion-pipeline
  - celery
  - github-api
  - checkpoint-recovery
  - rate-limiting
requires:
  - phase-02-project-crud
  - 03-01-repo-models
provides:
  - celery-worker
  - async-ingestion-pipeline
  - github-api-client
  - checkpoint-manager
  - rate-limiter
  - retry-endpoint
affects:
  - backend/app/repos/router.py (trigger_ingestion wiring + retry_ingestion added)
  - backend/app/config.py (celery_broker_url, temp_clone_path, github_token_refresh_threshold)
  - docker-compose.yml (worker service + clone_data volume)
  - backend/Dockerfile (git installed for clone operations)
  - Makefile (dev-worker target)
tech-stack:
  added:
    - celery[redis]==5.6.* (async task queue with Redis broker)
    - gitpython>=3.1 (git operations via subprocess)
  patterns:
    - Celery worker with acks_late=True and prefetch_multiplier=1
    - githubkit async client with OAuth token auth and rate-limit awareness
    - Checkpoint-based pipeline recovery (D-50)
    - Git clone via asyncio subprocess with timeout
key-files:
  created:
    - backend/app/celery_app.py
    - backend/app/ingestion/__init__.py
    - backend/app/ingestion/github_client.py
    - backend/app/ingestion/rate_limiter.py
    - backend/app/ingestion/checkpoint.py
    - backend/app/ingestion/pipeline.py
    - backend/app/ingestion/tasks.py
  modified:
    - backend/app/config.py
    - backend/app/repos/router.py
    - backend/Dockerfile
    - docker-compose.yml
    - Makefile
    - backend/requirements.txt
decisions:
  - Celery app configured with Redis broker (not RabbitMQ) — consistent with existing Docker Compose infrastructure
  - Pipeline uses asyncio subprocess for git clone (not GitPython) — avoids dependency on Python git library for core operation
  - GitHub access token retrieval deferred (TODO in pipeline) — User model does not currently store github_token, will be integrated in later auth work
  - Checkpoint granularity set at stage level (not per-API-call) — balances recovery fidelity with simplicity
  - Shallow clone with --depth 50 for speed, no arbitrary size limits per D-40
  - File tree built via rglob on cloned repo, ignoring .git/node_modules/__pycache__/.venv/.next
  - Clone data stored in Docker volume (clone_data) for isolation and cleanup
metrics:
  duration: "~10 minutes"
  completed: "2026-07-05"
  task_count: 3
  commit_count: 3
---

# Phase 03 Plan 02: Background Ingestion Pipeline with Celery & Checkpoint Recovery

**One-liner:** Created resilient background ingestion pipeline with Celery task queue, githubkit-based GitHub API client with rate-limit awareness, checkpoint-based recovery, git clone orchestrator, and 5-stage pipeline that ingests repository metadata, commits, PRs, issues, and creates immutable snapshots.

## Summary

This plan built the core ingestion engine for Phase 3. The pipeline runs asynchronously in a Celery worker, fetches full repository data via GitHub API + git clone, detects languages with byte-count percentages, extracts commit/PR/issue data, and creates an immutable RepositorySnapshot (D-48). Key architectural features include checkpoint recovery (D-50) — if the pipeline fails mid-way, retry resumes from the last completed stage — and rate-limit handling (D-37) with automatic backoff when GitHub API limits are approached.

### Task 1: Celery App, Ingestion Config, GithubClient, and RateLimiter

- Created `backend/app/celery_app.py` — Celery application instance with Redis broker, `acks_late=True`, `worker_prefetch_multiplier=1`, 3600s soft time limit
- Extended `backend/app/config.py` — added `celery_broker_url`, `temp_clone_path`, `github_token_refresh_threshold` settings
- Created `backend/app/ingestion/github_client.py` — `GithubClient` class wrapping githubkit with async methods for `get_repo_metadata`, `get_languages`, `get_commits`, `get_pull_requests`, `get_issues`, all with rate-limit header checking
- Created `backend/app/ingestion/rate_limiter.py` — `RateLimiter` class that tracks `x-ratelimit-remaining`/`x-ratelimit-reset` headers and computes exponential backoff wait times
- Updated `backend/requirements.txt` — added `celery[redis]==5.6.*` and `gitpython>=3.1`
- **Commit:** `c5bc4c8`

### Task 2: Checkpoint Manager, Pipeline Orchestrator, and Celery Tasks

- Created `backend/app/ingestion/checkpoint.py` — `CheckpointManager` with `save_stage()`/`get_last_stage()`/`should_resume()`/`next_stage()` for per-repo checkpoint recovery
- Created `backend/app/ingestion/pipeline.py` — `ingest_repo()` async function with 5 stages:
  1. **Fetching Metadata** — repo description, default_branch, visibility, languages (byte counts + percentages), tech_stack from topics
  2. **Cloning Repository** — git clone with `--depth 50`, 300s timeout, HEAD SHA extraction, recursive file tree building
  3. **Extracting Commits, PRs, Issues** — parallel async API calls with pagination (50 pages commits, 10 pages PRs/issues)
  4. **Creating Snapshot** — `RepositorySnapshot` with commit SHA, file tree, commit data, PR data, issue data (D-48)
  5. **Complete** — status transition to "complete", temp clone cleanup
- Created `backend/app/ingestion/tasks.py` — `ingest_repo_task` (Celery task with `max_retries=3`, exponential backoff) and `retry_ingestion_task`
- **Commit:** `55f169f`

### Task 3: API Wiring, Worker Service, Docker, and Makefile

- Updated `backend/app/repos/router.py`:
  - `trigger_ingestion` — now guards against duplicate ingestion (409 if not pending/failed), enqueues `ingest_repo_task.delay()`
  - Added `retry_ingestion` endpoint — POST `/{repo_id}/retry` for checkpoint recovery (409 if not failed/paused)
- Updated `docker-compose.yml` — added `worker` service with Celery command, `clone_data` volume for temp clones
- Updated `backend/Dockerfile` — added `apt-get install git` for clone operations
- Updated `Makefile` — added `dev-worker` target
- **Commit:** `d32b5ed`

### Verification Results

| Check | Result |
|-------|--------|
| `celery_app.py` exists with Celery app instance | PASS |
| `acks_late=True` configured | PASS |
| `GithubClient` class defined with 5 async methods | PASS |
| Rate limit check (`_check_rate_limit`) implemented | PASS |
| `RateLimiter` class with `seconds_until_reset` | PASS |
| `celery_broker_url` and `temp_clone_path` in config | PASS |
| `celery` and `gitpython` in requirements | PASS |
| `CheckpointManager` class with `should_resume` | PASS |
| `ingest_repo` async function in pipeline.py | PASS |
| `_build_file_tree` function | PASS |
| Snapshot creation (`RepositorySnapshot`) in pipeline | PASS |
| `ingest_repo_task` Celery task with `max_retries` | PASS |
| `ingest_repo_task.delay()` in trigger_ingestion | PASS |
| `retry_ingestion` endpoint added | PASS |
| Worker service in docker-compose.yml | PASS |
| `clone_data` volume defined | PASS |
| Celery worker command in docker-compose | PASS |
| Git installed in Dockerfile | PASS |
| `dev-worker` make target | PASS |
| All Python files compile (py_compile) | PASS |

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Pre-existing Observations

1. **`tasks.py` (21 lines) below estimate of 40** — The file content matches the plan's code specification exactly. The `min_lines: 40` in the plan's must_haves was an overestimate. The file is functionally complete with both `ingest_repo_task` and `retry_ingestion_task`.

2. **`rate_limiter.py` (32 lines) below estimate of 40** — Same situation. Code matches plan specification exactly.

3. **GitHub access token retrieval is a TODO** — The `_get_user_github_token()` function in pipeline.py currently returns `None` because the `User` model does not store a `github_token` field. The Phase 1 auth system obtains the GitHub access token during OAuth but discards it after user creation. Token persistence will be addressed in a later plan. The pipeline gracefully fails if no token is found.

## Known Stubs

1. **`backend/app/ingestion/pipeline.py:257-260`** — `_get_user_github_token()` has a TODO comment and relies on `getattr(user, "github_token", None)` which will return `None` since the User model doesn't have this field. Pipeline will set status to "failed" with a clear error message. Token persistence requires integrating GitHub access_token storage into the User/Session model, which is deferred.

## Threat Flags

None — all threats from the plan's threat model are properly mitigated:
- T-03-06 (Spoofing): Celery tasks only triggered via authenticated API endpoints (no direct injection)
- T-03-07 (Tampering): Clone to isolated Docker volume, `shutil.rmtree` with `ignore_errors=True` on success/failure
- T-03-08 (Information Disclosure): Token in clone URL via `x-access-token` (never logged), clone deleted after ingestion
- T-03-09 (DoS): `--depth 50` limits history, 300s clone timeout, 3600s task soft time limit (accepted risk per plan)
- T-03-10 (EoP): Worker uses same DB connection, queries scoped to `repo_id` owned by project/user
- T-03-11 (Tampering): Checkpoint in `repo.ingestion_status` — re-processing on retry acceptable per D-50

## Self-Check: PASSED

- [x] `backend/app/celery_app.py` exists (26 lines)
- [x] `backend/app/ingestion/__init__.py` exists
- [x] `backend/app/ingestion/github_client.py` exists (142 lines)
- [x] `backend/app/ingestion/rate_limiter.py` exists (32 lines)
- [x] `backend/app/ingestion/checkpoint.py` exists (62 lines)
- [x] `backend/app/ingestion/pipeline.py` exists (219 lines)
- [x] `backend/app/ingestion/tasks.py` exists (21 lines)
- [x] `celery_broker_url`, `temp_clone_path` in config.py
- [x] `celery[redis]`, `gitpython` in requirements.txt
- [x] `trigger_ingestion` calls `ingest_repo_task.delay()` 
- [x] `retry_ingestion` endpoint added
- [x] Worker service in docker-compose.yml
- [x] Git installed in Dockerfile
- [x] `dev-worker` make target
- [x] All Python files compile (py_compile)
- [x] Commit `c5bc4c8` exists: feat(03-02): create Celery app, ingestion settings, GithubClient, and RateLimiter
- [x] Commit `55f169f` exists: feat(03-02): create checkpoint manager, ingestion pipeline, and Celery tasks
- [x] Commit `d32b5ed` exists: feat(03-02): wire trigger_ingestion to Celery, add worker service, update Docker and Makefile

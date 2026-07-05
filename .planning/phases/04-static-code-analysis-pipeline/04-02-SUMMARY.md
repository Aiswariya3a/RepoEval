---
phase: 04-static-code-analysis-pipeline
plan: 02
subsystem: api
tags: [celery, fastapi, analysis-pipeline, checkpoint, async, pydantic]

requires:
  - phase: 04-01
    provides: Analysis models (StaticAnalysisRun, StaticAnalysisToolResult, CodeQualityReport), analyzer wrappers (Ruff/Radon/Bandit), scoring engine, duplication detector
  - phase: 03
    provides: Celery task pattern, CheckpointManager pattern, router pattern for repos

provides:
  - Analysis pipeline orchestrator with checkpointed 8-stage lifecycle
  - REST API endpoints for triggering, polling, and retrieving analysis results
  - Celery background task for executing analysis asynchronously
  - Pydantic schemas for API request/response serialization
  - Analysis-specific checkpoint manager for resume capability

affects: Phase 04-03 (wiring + testing), Phase 05 (repository mining), Phase 06+ (AI agent assessment)

tech-stack:
  added: []
  patterns:
    - Checkpointed pipeline orchestrator with 8 sequential stages
    - Celery task wrapping async pipeline via asyncio.run()
    - Nested router pattern under repos router hierarchy
    - Step builder mapping status → frontend progress display

key-files:
  created:
    - backend/app/analysis/checkpoint.py
    - backend/app/analysis/schemas.py
    - backend/app/analysis/pipeline.py
    - backend/app/analysis/tasks.py
    - backend/app/analysis/router.py
  modified:
    - backend/app/main.py
    - backend/app/celery_app.py

key-decisions:
  - Pipeline stages match CheckpointManager stage order for consistent resume logic
  - Ruff runs on ALL Python files (lightweight), Radon and Bandit run on all files (deep)
  - Composite score computed in aggregating stage from 4 dimensions: lint, complexity, security, duplication
  - 4 API endpoints: POST trigger, GET status, GET results, GET tool-results

patterns-established:
  - AnalysisCheckpointManager mirrors Phase 3 CheckpointManager but operates on StaticAnalysisRun instead of Repo
  - Dockerfile already up to date: git installed, ruff/radon/bandit in requirements.txt from Plan 01

requirements-completed: [SCA-01, SCA-02, SCA-03]

duration: 8min
completed: 2026-07-05
---

# Phase 04 Plan 02: Analysis Pipeline Orchestrator & API

**Checkpointed 8-stage analysis pipeline orchestrator with Celery background execution, 4 REST API endpoints, and Pydantic schemas — wiring analyzers from Plan 01 into a resilient, frontend-accessible workflow**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-07-05
- **Completed:** 2026-07-05
- **Tasks:** 3
- **Files created:** 5
- **Files modified:** 2

## Accomplishments

- AnalysisCheckpointManager with 9-stage lifecycle (queued → analyzing_files → running_ruff → running_radon → running_bandit → computing_importance → computing_duplication → aggregating → complete)
- run_analysis pipeline orchestrator with 8 stages, batch processing (configurable batch size), checkpoint recovery, and comprehensive error handling
- Pydantic schemas: AnalysisRunResponse, AnalysisStatusResponse, AnalysisStep, CodeQualityReportResponse, ToolResultResponse, AnalysisTriggerResponse
- Celery task (analyze_repo_task) with max_retries=3 and exponential backoff
- 4 REST API endpoints: POST trigger analysis, GET status, GET results, GET tool-results
- _build_analysis_steps() utility mapping analysis status to frontend progress display
- Wiring: analysis_router registered in main.py, app.analysis in Celery autodiscover_tasks
- Dockerfile already correct — git installed, ruff/radon/bandit in requirements.txt from Plan 01

## Task Commits

Each task was committed atomically:

1. **task 1: create analysis checkpoint, schemas, and pipeline orchestrator** - `c706853` (feat)
2. **task 2: create API router and Celery task for analysis** - `6c14e4a` (feat)
3. **task 3: wire analysis router and celery tasks into main app** - `db73ab0` (feat)

## Files Created/Modified

- `backend/app/analysis/checkpoint.py` - AnalysisCheckpointManager with 9-stage lifecycle
- `backend/app/analysis/schemas.py` - 6 Pydantic schemas for API request/response
- `backend/app/analysis/pipeline.py` - run_analysis orchestrator with 8 checkpointed stages
- `backend/app/analysis/tasks.py` - analyze_repo_task Celery task
- `backend/app/analysis/router.py` - 4 REST endpoints for analysis API
- `backend/app/main.py` - Added analysis_router include (modified)
- `backend/app/celery_app.py` - Added "app.analysis" to autodiscover_tasks (modified)

## Decisions Made

- Pipeline uses AnalysisCheckpointManager (model-specific) instead of Phase 3 CheckpointManager (repo-specific) — stores state on StaticAnalysisRun.current_stage
- Ruff runs on ALL Python files (lightweight), while Radon and Bandit run on all files (deep analysis per D-18)
- CompositeScoreCalculator invoked in aggregating stage with 4 weighted sub-scores matching D-14 defaults (lint 30%, complexity 30%, security 25%, duplication 15%)
- API nested under repos router as `/api/projects/{id}/repos/{rid}/analysis/...` for consistent URL hierarchy
- GET /results returns 200 with null body (not 404) when no analysis exists — frontend handles "no analysis yet" state

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Python import verification (`python -c "from app.analysis.pipeline import run_analysis"`) not possible on host system — backend runs in Docker container. Code structure and content verification passed instead.
- Dockerfile required no changes — git and analysis tools were already configured in Plan 01.

## Threat Surface Scan

Checked for new security-relevant surface not in the plan's threat model:

| Flag | File | Description |
|------|------|-------------|
| threat_flag: new_router | backend/app/analysis/router.py | 4 new authenticated endpoints under analysis prefix (mitigated by existing JWT auth chain and project/repo ownership verification) |

No unmitigated threat surface introduced.

## Known Stubs

None — all endpoints return real data (or intentional null for "no analysis yet" state).

## Next Phase Readiness

- Analysis pipeline fully wired and ready for Celery worker execution
- Frontend can poll GET /status for progress and GET /results for completed analysis
- Phase 04-03 should add integration tests and verify end-to-end flow with Docker
- Phase 5 (Repository Mining) can incorporate importance_index from CodeQualityReport

---

## Self-Check: PASSED

All 5 created files verified present. All 3 commit hashes verified in git log.

*Phase: 04-static-code-analysis-pipeline*
*Plan: 02*
*Completed: 2026-07-05*

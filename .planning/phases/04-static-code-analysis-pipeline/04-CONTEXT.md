# Phase 4: Static Code Analysis Pipeline - Context

**Gathered:** 2026-07-05
**Status:** Ready for planning

<domain>
## Phase Boundary

System consumes ingested repository snapshots (from Phase 3) and runs deterministic static analysis tools to produce code quality metrics. Generates a composite code quality score and per-file importance rankings for downstream phases. Results serve as advisory evidence — the scoring authority is the instructor-defined rubric (Phase 6+). Analysis is manually triggered after ingestion completes.

**Requirements:** SCA-01, SCA-02, SCA-03
**Depends on:** Phase 3 (RepositorySnapshot.file_tree, Repo.languages/tech_stack)

</domain>

<decisions>
## Implementation Decisions

### Tool Selection & Language Support

- **D-01:** Python-first approach — start with Python static analysis tools. Expand to JS/TS, Go, Java in later phases.
- **D-02:** Ruff (Rust-based linter) for linting and code quality checks. Replaces flake8/isort/pyflakes. Matches existing Makefile lint target.
- **D-03:** Radon for complexity metrics (cyclomatic complexity, maintainability index).
- **D-04:** Bandit for security scanning.
- **D-05:** Skip mypy — type coverage in third-party repos is inconsistent and produces noisy results.

### Trigger & Sequencing Model

- **D-06:** Manual trigger — user clicks "Analyze" button after ingestion completes. Matches D-31 manual ingest trigger pattern.
- **D-07:** Checkpointed sequential stages with concurrent execution inside each stage. Each major stage (Static Analysis → Metric Aggregation → Scoring) guarded by checkpoint.should_resume().
- **D-08:** Within the Static Analysis stage, independent analyzers (Ruff, Radon, Bandit) execute concurrently via asyncio.gather(). Individual analyzer results persist as they complete.
- **D-09:** On failure, resume from failed analyzer or stage — not a full restart.

### Data Model

- **D-10:** 3-layer data model:
  - **StaticAnalysisRun** — tracks each analysis execution lifecycle (status, timing, snapshot_id FK)
  - **StaticAnalysisToolResult** — normalized per-tool outputs (tool_name, language, status, metrics, issues JSONB)
  - **CodeQualityReport** — denormalized aggregated report (overall_score, maintainability_index, complexity_score, duplication_pct, lint_issue_count, security_issue_count, per_language_metrics JSONB)
- **D-11:** Dashboard and APIs query CodeQualityReport primarily. Drill-down views access individual tool results.
- **D-12:** RepositorySnapshot stays focused on repository versioning only — no analysis fields added.

### Scoring Methodology

- **D-13:** Composite code quality score computed as a reference metric, NOT as the final grade. Static analysis is advisory/evidence for the instructor-defined rubric.
- **D-14:** Score is a weighted average of normalized sub-scores (0-100 each): lint quality, complexity, duplication, security. Exact weights determined during planning.
- **D-15:** The composite score feeds into Phase 6+ AI evaluation as supporting evidence, not as an authoritative grade.

### File Scope & Analysis Depth

- **D-16:** Compute and persist a canonical file importance score (0-100) for every source file using deterministic heuristics: import graph centrality, entry-point detection, directory importance, LOC, cyclomatic complexity, and Git commit activity.
- **D-17:** This importance index becomes the canonical ranking used by all downstream phases — ensuring every analyzer and AI agent focuses on the same prioritized subset.
- **D-18:** Run lightweight analysis (Ruff lint) on ALL source files. Run deep analysis (Radon complexity, Bandit security) only on top-ranked files (configurable threshold, default ~top 50).
- **D-19:** Ignore generated code, vendor dependencies, test files, and binaries. Extend the existing _is_ignored() pattern from ingestion pipeline.
- **D-20:** Process files in batches of 50-100 with checkpointing for large repos. User sees progress per batch via checkpoint stages.

### OpenCode's Discretion

- Duplication detection approach — exact tool or method to determine duplication percentage for SCA-02
- Exact scoring weights and normalization formulas
- Importance score heuristic weights and scoring formula
- Batch size tuning for large repos
- UI design for analysis progress display and results dashboard
- API endpoint design for analysis trigger and results retrieval

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Pipeline patterns (Phase 3 reusable infrastructure)
- `.planning/phases/03-github-integration-repository-ingestion/03-02-PLAN.md` — Celery pipeline, checkpoint manager, retry patterns
- `.planning/phases/03-github-integration-repository-ingestion/03-01-PLAN.md` — Repo/snapshot data models and migrations

### Existing code patterns
- `backend/app/ingestion/pipeline.py` — Stage-based pipeline pattern with checkpoint.should_resume() and save_stage()
- `backend/app/ingestion/checkpoint.py` — CheckpointManager class (directly reusable)
- `backend/app/ingestion/tasks.py` — Celery task pattern with retry/backoff
- `backend/app/celery_app.py` — Add `app.analysis` to autodiscover_tasks
- `backend/app/models/snapshot.py` — RepositorySnapshot model (file_tree input)
- `backend/app/models/repo.py` — Repo model (languages, language_percentages, tech_stack)
- `backend/app/config.py` — Settings class pattern for analysis config
- `backend/app/repos/router.py` — Router pattern for analysis endpoints
- `backend/app/repos/schemas.py` — Pydantic schema pattern (IngestionStep reuses)

### Requirements
- `.planning/REQUIREMENTS.md` §22-24 — SCA-01, SCA-02, SCA-03

### Frontend patterns (for analysis results display)
- `frontend/lib/use-ingestion-polling.ts` — Polling hook pattern for analysis status
- `frontend/lib/api-repos.ts` — Typed API client pattern for analysis endpoints
- `frontend/components/repos/ingestion-progress-panel.tsx` — Progress panel pattern for analysis stages
- `frontend/components/repos/ingestion-badge.tsx` — Status badge pattern for analysis status

### Deployment
- `backend/Dockerfile` — Add static analysis tool packages (ruff, radon, bandit)
- `backend/requirements.txt` — Add tool dependencies
- `docker-compose.yml` — Analysis tasks run in existing worker (no new service for v1)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Celery task infrastructure** — Fully configured celery app in `celery_app.py` with Redis broker, acks_late, retry patterns. Add `app.analysis` to autodiscover_tasks.
- **CheckpointManager** — `app/ingestion/checkpoint.py` provides should_resume(), save_stage(), get_last_stage(). Create analysis-specific stage list and reuse class directly.
- **Stage-based pipeline pattern** — `app/ingestion/pipeline.py` demonstrates async pipeline with subprocess execution, file tree traversal, and cleanup.
- **File tree data** — `RepositorySnapshot.file_tree` (JSONB) — recursive file list with size and extension. _build_file_tree() and _is_ignored() already implemented.
- **Async subprocess execution** — `asyncio.create_subprocess_exec` pattern used for git clone. Same pattern applies for running ruff/radon/bandit CLI tools.
- **Polling hook** — `useIngestionPolling` hook in frontend. Create `useAnalysisPolling` variant or parameterize the existing hook.
- **Progress panel** — `IngestionProgressPanel` component with step tracking, icons, progress bar. Reusable for analysis stage display.
- **Status badge** — `IngestionBadge` component with color-coded status labels. Reusable for analysis status.

### Established Patterns
- Multi-stage pipeline with checkpoint recovery — guarded stages, idempotent retry
- Celery task queue with async pipeline call inside asyncio.run()
- REST polling for long-running process status (3s interval)
- Typed API client functions per domain (api-projects.ts, api-repos.ts)
- Config via pydantic-settings with REPOEVAL_ env prefix

### Integration Points
- **Trigger point** — New POST `/api/projects/{id}/repos/{id}/analyze` enqueues analyze_repo_task.delay(snapshot_id)
- **File input** — RepositorySnapshot.file_tree + Repo.languages/language_percentages/tech_stack
- **Worker** — Runs in existing Celery worker (docker-compose worker service). Dedicated analysis-worker if CPU-bound becomes an issue.
- **Status endpoint** — Extend existing repo status API or create dedicated GET `/api/projects/{id}/repos/{id}/analysis` endpoint
- **Frontend** — Add "Analyze" button (parallel to IngestButton pattern), analysis status polling, results display components

</code_context>

<specifics>
## Specific Ideas

- "Treat static analysis as advisory, not authoritative — the instructor-defined rubric is the scoring mechanism"
- "File importance score should be the canonical ranking for ALL downstream phases (analysis tools + AI agents)"
- Student/educational evaluation context — scores inform rubric criteria, they don't determine grades
- Hybrid approach desired: checkpointed stages with concurrent analyzer execution inside each stage
- 3-layer data model for separation of concerns: runs → tool results → aggregated report

</specifics>

<deferred>
## Deferred Ideas

- Multi-language analysis support (JS/TS, Go, Java) — future phase
- AI-powered analysis and evaluation — Phase 6-7
- Re-analysis on new snapshots with trend comparison — Phase 9 dashboard
- Dedicated analysis-worker service — defer until analysis becomes CPU bottleneck
- Tool output caching via Redis — not needed for v1 throughput

</deferred>

---

*Phase: 04-static-code-analysis-pipeline*
*Context gathered: 2026-07-05*

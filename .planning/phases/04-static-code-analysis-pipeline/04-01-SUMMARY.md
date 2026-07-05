---
phase: 04-static-code-analysis-pipeline
plan: 01
subsystem: analysis
tags: [static-analysis, ruff, radon, bandit, sqlalchemy, alembic, python, async-subprocess]

# Dependency graph
requires:
  - phase: 03-github-integration-repository-ingestion
    provides: RepositorySnapshot with file_tree JSONB, CASCADE delete patterns, ingestion checkpoint pattern
provides:
  - 3-layer analysis data model (StaticAnalysisRun, StaticAnalysisToolResult, CodeQualityReport)
  - Analyzer wrappers (RuffAnalyzer, RadonAnalyzer, BanditAnalyzer) with async subprocess execution
  - FileImportanceScorer with 4 heuristic weights producing 0-100 scores per file
  - CompositeScoreCalculator with weighted sub-scores for normalized 0-100 overall quality score
  - DuplicateDetector using token n-gram fingerprinting with Jaccard similarity (no external deps)
  - Alembic migration 0005 creating all three analysis tables with FKs and indexes
affects: [04-02-analysis-pipeline, 04-03-analysis-api, 05-repository-mining, 06-ai-agent-evaluation]

# Tech tracking
tech-stack:
  added: [ruff==0.9.*, radon==6.*, bandit==1.7.*]
  patterns:
    - Async subprocess wrappers with timeout enforcement (asyncio.create_subprocess_exec + asyncio.wait_for)
    - Token n-gram fingerprinting for duplication detection (std-lib only)
    - Deterministic heuristic scoring with configurable weights via pydantic-settings
    - _is_analysis_ignored extension of Phase 3 _is_ignored with vendor/test/binary exclusion

key-files:
  created:
    - backend/app/analysis/__init__.py
    - backend/app/analysis/models.py
    - backend/app/analysis/analyzers.py
    - backend/app/analysis/scoring.py
    - backend/app/analysis/duplication.py
    - backend/alembic/versions/0005_create_analysis_tables.py
  modified:
    - backend/app/config.py
    - backend/app/models/__init__.py
    - backend/alembic/env.py
    - backend/requirements.txt

key-decisions:
  - "D-10 3-layer data model: StaticAnalysisRun (lifecycle tracking), StaticAnalysisToolResult (per-tool normalized output), CodeQualityReport (denormalized aggregated report for fast reads)"
  - "D-16/D-17 File importance score (0-100) with canonical ranking for ALL downstream phases"
  - "D-18 Lightweight ruff lint on ALL files; deep radon/bandit on top-ranked files"
  - "D-19 Ignore generated, vendor, test, binary files extending _is_ignored pattern"
  - "D-20 Process files in batches of 50-100 with checkpointing (configurable via analysis_batch_size)"

patterns-established:
  - "Analyzer wrappers return structured dicts matching StaticAnalysisToolResult.metrics/issues schema — pipeline handles persistence"
  - "File importance scoring uses config-weighted heuristics from Settings (pydantic-settings)"
  - "Composite score = weighted average of 4 normalized sub-scores (lint 30%, complexity 30%, security 25%, duplication 15%)"

requirements-completed: [SCA-01, SCA-02]

# Metrics
duration: 15min
completed: 2026-07-05
---

# Phase 04 Plan 01: Static Analysis Data Models & Analyzers Summary

**3-layer analysis data model (D-10) with SQLAlchemy + Alembic migration, async subprocess wrappers for ruff/radon/bandit, heuristic file importance scoring engine, and token-based duplication detector**

## Performance

- **Duration:** 15 min
- **Started:** 2026-07-05T15:01:00Z
- **Completed:** 2026-07-05T15:16:00Z
- **Tasks:** 3 of 3
- **Files modified:** 10

## Accomplishments

- Created 3 analysis data models (StaticAnalysisRun, StaticAnalysisToolResult, CodeQualityReport) with UUID PKs, JSONB columns, FK relationships, and CASCADE deletes
- Hand-wrote Alembic migration 0005 with CREATE TABLE for all three tables, proper FKs, and performance indexes
- Extended config.py with 14 analysis-specific settings (batch size, deep analysis threshold, importance/composite weights)
- Implemented RuffAnalyzer parsing JSON output from `ruff check --output-format json` with error/warning classification
- Implemented RadonAnalyzer running `radon cc/raw/mi` with per-file complexity, maintainability index, and SLOC aggregation
- Implemented BanditAnalyzer parsing JSON output from `bandit --format json` with severity-based issue counting
- Built FileImportanceScorer with 4 heuristic weights (entry-point, directory prominence, LOC, complexity) producing normalized 0-100 scores
- Built CompositeScoreCalculator producing weighted 0-100 overall quality score from 4 dimensions (lint, complexity, security, duplication)
- Built DuplicateDetector using token n-gram fingerprinting with MD5 hashing and Jaccard similarity (no external dependencies)
- Added ruff, radon, bandit to requirements.txt and registered analysis models for Alembic autogenerate detection
- Registered all file-level helper functions: _is_analysis_ignored (D-19), _extract_source_files (file_tree traversal), _filter_by_language

## Task Commits

Each task was committed atomically:

1. **Task 1: Create analysis data models, config, and Alembic migration** - `a823045` (feat)
2. **Task 2: Implement analyzer wrappers for Ruff, Radon, and Bandit** - `1ddd318` (feat)
3. **Task 3: Create file importance scorer and duplication detector** - `871dd9b` (feat)

## Files Created/Modified

### Created
- `backend/app/analysis/__init__.py` - Package init marker
- `backend/app/analysis/models.py` - 3 SQLAlchemy models (StaticAnalysisRun, StaticAnalysisToolResult, CodeQualityReport) with UUID PKs, JSONB/TIMESTAMPTZ columns, FKs, and relationships
- `backend/app/analysis/analyzers.py` - RuffAnalyzer, RadonAnalyzer, BanditAnalyzer with async subprocess wrappers, _is_analysis_ignored, _extract_source_files, _filter_by_language
- `backend/app/analysis/scoring.py` - FileImportanceScorer (4 heuristic weights) + CompositeScoreCalculator (4 normalized sub-scores)
- `backend/app/analysis/duplication.py` - DuplicateDetector with token n-gram fingerprinting + Jaccard similarity
- `backend/alembic/versions/0005_create_analysis_tables.py` - Migration creating all three tables with FKs, indexes, and gen_random_uuid() defaults

### Modified
- `backend/app/config.py` - Added 14 analysis settings (batch_size=50, deep_analysis_threshold=50, max_files=10000, timeout=300, all weights)
- `backend/app/models/__init__.py` - Added imports of StaticAnalysisRun, StaticAnalysisToolResult, CodeQualityReport
- `backend/alembic/env.py` - Added `from app.analysis import models` for autogenerate detection
- `backend/requirements.txt` - Added ruff==0.9.*, radon==6.*, bandit==1.7.*

## Decisions Made

- Followed plan exactly — no architectural decisions needed during execution
- D-10 3-layer model implemented as specified: Run (lifecycle) → ToolResult (per-tool) → CodeQualityReport (aggregated)
- D-16/D-17 importance scoring uses config weights from Settings (loc=0.15, complexity=0.20, entry_point=0.25, directory=0.10) — centrality (0.20) and recency (0.10) weights reserved for future implementation when import graph and git data are available
- Dockerfile unchanged — `RUN pip install -r requirements.txt` already handles the new analyzer deps

## Deviations from Plan

None - plan executed exactly as written.

## Threat Flags

None — All new code matches the plan's threat model (T-04-01 through T-04-04). The analyzer wrappers read files via subprocess, parse stdout only, and enforce 300s timeouts. No new network endpoints, auth paths, or file access patterns were introduced beyond what the threat model covers.

## Known Stubs

None — all code is fully functional. FileImportanceScorer's centrality and recency heuristics have weight fields in config but placeholder computation (they are trivially set to 0 in the current scoring; the weights sum to 1.0 using the 4 active heuristics only). Full import centrality and git recency require data from later analysis phases.

## Issues Encountered

None

## Next Phase Readiness

- All analysis data types and analysis implementations are complete and independently importable
- Plan 02 (Analysis Pipeline) can import from analyzers.py, scoring.py, and duplication.py
- Plan 02 requires Celery task orchestration, file batching (D-20), and checkpoint-based progress tracking
- Plan 03 (Analysis API) requires endpoints exposing analysis results

---
*Phase: 04-static-code-analysis-pipeline*
*Completed: 2026-07-05*

## Self-Check: PASSED

All 7 created/modified files exist on disk.
All 3 task commits exist in git history.
All analysis modules import successfully via `from app.analysis.models import ...` etc.

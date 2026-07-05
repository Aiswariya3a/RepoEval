---
phase: 04-static-code-analysis-pipeline
plan: 04
subsystem: ui
tags:
  - nextjs
  - react
  - analysis
  - project-detail
ingestion
  - ui-integration
  - polling
  - devops

# Dependency graph
requires:
  - phase: 04-static-code-analysis-pipeline
    plan: 02
    provides: Analysis Celery pipeline orchestrator and API router
  - phase: 04-static-code-analysis-pipeline
    plan: 03
    provides: Analysis frontend UI components (AnalyzeButton, AnalysisProgressPanel, AnalysisResultsDisplay, AnalysisBadge) and analysis API client + polling hook

provides:
  - Analysis lifecycle integration in project detail page (button → progress panel → results display)
  - Analysis-aware IngestButton with disabledReason tooltip
  - Aggregate analysis status indicators on project cards

affects:
  - dashboard
  - project-detail
  - repos
  - analysis

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Analysis lifecycle managed as parallel state alongside ingestion lifecycle in detail page
    - Conditional tooltip wrapping for disabled buttons with context-aware reasons
    - Aggregate analysis label helper exported from api-repos for use across components

key-files:
  created: []
  modified:
    - frontend/app/projects/[id]/page.tsx
    - frontend/components/repos/ingest-button.tsx
    - frontend/components/dashboard/project-card.tsx
    - frontend/lib/api-repos.ts

key-decisions:
  - "D-06 followed: manual trigger — user clicks 'Run Analysis' after ingestion completes"
  - "Only one analysis at a time per page session (single activeAnalysisRepoId)"
  - "Analysis badge shown alongside ingestion badge in status row for the active analysis repo"
  - "Analysis state is session-local — no pre-fetching of existing analysis status on page load"

patterns-established:
  - "Analysis lifecycle mirrors ingestion lifecycle: trigger → polling → progress → results"
  - "Analysis components appear only when repo.ingestion_status === 'complete'"
  - "IngestButton disabledReason prop creates generic pattern for context-aware disabled tooltips"

requirements-completed:
  - SCA-01
  - SCA-02
  - SCA-03

# Metrics
duration: 4min
completed: 2026-07-05
---

# Phase 04 Plan 04: Analysis UI Integration Summary

**Wire analysis UI components into the project detail page, extend IngestButton with analysis-aware tooltip, add aggregate analysis status display to project cards**

## Performance

- **Duration:** 4 min
- **Started:** 2026-07-05T09:46:00Z
- **Completed:** 2026-07-05T09:48:26Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- Analysis lifecycle (button → progress panel → results display) fully integrated into project detail page with polling via `useAnalysisPolling`
- `handleAnalyze` function triggers Celery analysis task, manages `activeAnalysisRepoId`, resets results on re-analysis
- `AnalysisBadge` renders alongside `IngestionBadge` in repo status row when analysis is active/completed
- `IngestButton` extended with `disabledReason` prop showing tooltip when disabled due to active analysis
- `getAggregateAnalysisLabel` helper added to `api-repos.ts` for project card aggregate status
- `ProjectCard` receives `analysisStatus` prop and renders colored dot + label (Analyzed/Partial/Analyzing)

## Task Commits

Each task was committed atomically:

1. **Task 1: Integrate analysis into project detail page** - `512d735` (feat)
2. **Task 2: Extend IngestButton with analysis-aware disabled state** - `fc7ccd9` (feat)
3. **Task 3: Add aggregate analysis status to project cards** - `95d76f1` (feat)

## Files Modified

- `frontend/app/projects/[id]/page.tsx` - Added analysis imports, state, polling, sync effect, handleAnalyze, AnalysisBadge in status row, Code Analysis section with AnalyzeButton/AnalysisProgressPanel/AnalysisResultsDisplay, and disabledReason on IngestButton
- `frontend/components/repos/ingest-button.tsx` - Added `disabledReason` prop and `maybeTooltip` helper for tooltip wrapping when disabled with reason
- `frontend/components/dashboard/project-card.tsx` - Added `analysisStatus` prop and aggregate analysis indicator rendering
- `frontend/lib/api-repos.ts` - Added `getAggregateAnalysisLabel` helper returning label, color, and dotColor for analyzed/partial/running statuses

## Decisions Made

- **Single active analysis per session:** `activeAnalysisRepoId` tracks which repo is currently being analyzed or has been analyzed. When results are complete, the `activeAnalysisRepoId` stays set so the results display remains visible until the user triggers analysis on a different repo.
- **Analysis section visibility gated by ingestion status:** The "Code Analysis" section only renders when `repo.ingestion_status === "complete"`, ensuring analysis cannot be triggered before ingestion finishes.
- **AnalysisBadge in two locations:** The badge appears both in the status row (alongside IngestionBadge for immediate visibility) and in the Code Analysis section header.
- **Analysis state is session-local:** No existing analysis status is pre-fetched on page load. All state is ephemeral within the page session. This can be enhanced in a future phase.
- **Followed D-06 (manual trigger):** User must explicitly click "Run Analysis" after ingestion completes.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- Used inline `style={{ backgroundColor }}` for the aggregate analysis dot instead of dynamic Tailwind class construction to avoid Tailwind v4's purging of dynamically-built classes.

## Stub Tracking

No stubs found — all components are wired to real API calls and state. The AnalysisBadge only renders when there is actual analysis status data.

## Threat Flags

No new threat surface introduced beyond what was scoped in the plan's threat model (T-04-14, T-04-15, T-04-16).

## Next Phase Readiness

- Analysis UI integration is complete: the project detail page now supports the full analysis lifecycle from button trigger through progress polling to results display
- Project cards can receive aggregate analysis status
- Next phase (Phase 5) can build on this by connecting the analysis results to evaluation and AI agent assessment flows

---

*Phase: 04-static-code-analysis-pipeline*
*Plan: 04*
*Completed: 2026-07-05*

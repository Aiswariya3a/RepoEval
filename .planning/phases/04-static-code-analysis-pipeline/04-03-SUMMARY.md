---
phase: 04-static-code-analysis-pipeline
plan: 03
subsystem: ui
tags: [react, typescript, nextjs, shadcn-ui, analysis, code-quality, static-analysis]

# Dependency graph
requires:
  - phase: 04-01
    provides: "Backend analysis schemas (AnalysisStatus, AnalysisRun, CodeQualityReport)"
  - phase: 04-02
    provides: "Analysis API endpoints (trigger, status, results, tool-results)"
provides:
  - "Frontend types and API client for static analysis"
  - "Polling hook for analysis progress"
  - "Analysis UI components (button, progress panel, badge, results display)"
affects:
  - 04-04
  - phase-05

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Analysis API client pattern (fetchApi wrapper with typed responses)"
    - "Analysis polling hook pattern (3s interval, 5s error backoff, terminal stop)"
    - "Analysis component patterns (button states, progress steps, status badge, results display)"

key-files:
  created:
    - frontend/lib/api-analysis.ts
    - frontend/lib/use-analysis-polling.ts
    - frontend/components/analysis/analyze-button.tsx
    - frontend/components/analysis/analysis-progress-panel.tsx
    - frontend/components/analysis/analysis-badge.tsx
    - frontend/components/analysis/analysis-results-display.tsx
  modified: []

key-decisions:
  - "Followed established Phase 3 patterns (IngestionBadge, IngestButton, IngestionProgressPanel, useIngestionPolling)"
  - "AnalysisResultsDisplay accepts data via props (pure presentational) — no data fetching"
  - "Empty state (null report) shows placeholder, not error"
  - "Adjudication note per D-13: scores are reference metrics only"

patterns-established:
  - "Analysis UI mirrors ingestion UI architecture: API client → polling hook → presentational components"
  - "AnalyzeButton follows IngestButton's 4-state pattern with inline confirmation dialogs"
  - "AnalysisProgressPanel extends IngredientProgressPanel with file progress (analyzed_files / total_files)"
  - "formatScore helper provides color-coded score display (green/amber/orange/red 4-tier)"

requirements-completed:
  - SCA-01
  - SCA-02
  - SCA-03

# Metrics
duration: 4min
completed: 2026-07-05
---

# Phase 04 Plan 03: Static Analysis Frontend UI Summary

**Analysis types, polling hook, and 4 UI components (button, progress panel, badge, results display) following Phase 3 ingestion patterns**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-05T15:11:00Z
- **Completed:** 2026-07-05T15:19:00Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- Created `api-analysis.ts` with 10+ types (AnalysisStatus, AnalysisStep, AnalysisRun, CodeQualityReport, LanguageMetrics, FileImportance, ToolResult, AnalysisTriggerResponse) and 4 API functions (triggerAnalysis, getAnalysisStatus, getAnalysisResults, getToolResults) plus helper utilities (isAnalysisTerminal, isAnalysisRunning, formatScore)
- Created `useAnalysisPolling` hook with 3s polling interval, terminal status detection, and 5s error backoff — mirroring useIngestionPolling pattern
- Created AnalyzeButton with 4 visual states (running→tooltip+spinner, complete→Re-analyze+confirm, failed→Retry+confirm, default→Run Analysis)
- Created AnalysisProgressPanel with 8-stage step list, progress bar, file processing status, elapsed timing, error display, and skeleton variant
- Created AnalysisBadge with STATUS_CONFIG color mapping for all 11 analysis lifecycle statuses (pending through failed)
- Created AnalysisResultsDisplay with ScoreCard grid (overall + 4 dimensions), metrics summary row, per-language breakdown table, file importance ranking table with pagination, tool issues panels, empty state, and D-13 adjudication note

## Task Commits

Each task was committed atomically:

1. **task 1: create api-analysis.ts types + API client and use-analysis-polling.ts hook** - `d37ae7e` (feat)
2. **task 2: create AnalyzeButton, AnalysisProgressPanel, and AnalysisBadge components** - `67093bb` (feat)
3. **task 3: create AnalysisResultsDisplay component** - `b450fce` (feat)

## Files Created
- `frontend/lib/api-analysis.ts` - Analysis types (AnalysisStatus, CodeQualityReport, LanguageMetrics, FileImportance, ToolResult) and 4 API functions (triggerAnalysis, getAnalysisStatus, getAnalysisResults, getToolResults) plus helpers (isAnalysisTerminal, isAnalysisRunning, formatScore)
- `frontend/lib/use-analysis-polling.ts` - Polling hook with 3s interval, terminal status detection, 5s error backoff; returns AnalysisPollingState + refetch
- `frontend/components/analysis/analyze-button.tsx` - Context-aware button with 4 visual states and inline confirmation dialogs (ReAnalyzeConfirmDialog, RetryAnalysisConfirmDialog)
- `frontend/components/analysis/analysis-progress-panel.tsx` - 8-stage step progress panel with icons, colors, timing, error display, and AnalysisProgressSkeleton variant
- `frontend/components/analysis/analysis-badge.tsx` - Status pill badge with 11-entry STATUS_CONFIG color mapping matching analysis lifecycle
- `frontend/components/analysis/analysis-results-display.tsx` - Full results display with ScoreCard, ToolIssuesPanel, FileImportanceTable sub-components

## Decisions Made
- None — followed plan as specified. All patterns aligned with Phase 3 ingestion UI architecture.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 6 UI files are complete and match backend API contract defined in Plan 02
- Ready for Plan 04 (wiring into project detail page)
- Components are pure presentational (except useAnalysisPolling), making them easy to integrate
- Plan 04 will provide the data flow: fetch analysis status → poll on mount → render components → trigger re-analysis

---
*Phase: 04-static-code-analysis-pipeline*
*Completed: 2026-07-05*

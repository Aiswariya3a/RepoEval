---
phase: 03-github-integration-repository-ingestion
plan: 03
type: execute
subsystem: frontend
tags:
  - components
  - hooks
  - api-client
  - polling
  - ingestion-ui
requires:
  - 03-01 (backend repo model + API endpoints)
  - 03-02 (Celery pipeline + worker)
provides:
  - api-repos client module
  - useIngestionPolling hook
  - IngestionBadge component
  - ReposField component
  - IngestButton component
  - IngestionProgressPanel component
affects:
  - frontend/components.json (shadcn component registration)
  - frontend/components/ui/ (3 new shadcn components)
tech-stack:
  added:
    - shadcn badge component (official registry)
    - shadcn progress component (official registry)
    - shadcn tooltip component (official registry)
  patterns:
    - fetchApi utility pattern for REST API calls
    - Pure presentational components with typed props and callbacks
    - Controlled dialog overlay for confirmation flows
    - Custom React hook for interval-based polling with backoff
key-files:
  created:
    - frontend/lib/api-repos.ts
    - frontend/lib/use-ingestion-polling.ts
    - frontend/components/repos/ingestion-badge.tsx
    - frontend/components/repos/repos-field.tsx
    - frontend/components/repos/ingest-button.tsx
    - frontend/components/repos/ingestion-progress-panel.tsx
    - frontend/components/ui/badge.tsx
    - frontend/components/ui/progress.tsx
    - frontend/components/ui/tooltip.tsx
decisions:
  - TooltipTrigger does not use `asChild` prop with @base-ui/react (shadcn v4 base-nova) — removed `asChild` from IngestButton
  - Confirmation dialogs are inline controlled overlays (reusing project's modal dialog pattern)
  - Components are pure presentational — accept data via props, emit callbacks for parent handling
metrics:
  duration: "~8 minutes"
  completed: "2026-07-05"
  task_count: 3
  commit_count: 3
---
# Phase 03 Plan 03: Frontend Repository Ingestion UI

**One-liner:** Created 6 new frontend modules — api-repos type definitions and API client, useIngestionPolling hook with 3s polling and backoff, and 4 pure presentational components (IngestionBadge, ReposField, IngestButton, IngestionProgressPanel) following the approved UI-SPEC design contract.

## Summary

This plan delivered all frontend building blocks for the GitHub repository ingestion UI. The components are designed as pure presentational (except the polling hook) — they accept data via props and emit callbacks, ready for Plan 04 to wire into project forms and detail pages. Three new shadcn components (badge, progress, tooltip) were added from the official registry. All components compile cleanly with `npx tsc --noEmit`.

### Task 1: Add shadcn components and create api-repos.ts types + API client

- Added `badge`, `progress`, and `tooltip` shadcn components via `npx shadcn@latest add`
- Created `frontend/lib/api-repos.ts` with 6 types (`IngestionStatus`, `IngestionStep`, `Repo`, `RepoStatusResponse`, `RepoCreate`, `PollingState`)
- Defined 6 API functions: `listProjectRepos`, `addProjectRepo`, `removeProjectRepo`, `triggerIngestion`, `retryIngestion`, `getRepoStatus`
- Added URL validation helpers: `isValidGithubUrl` (regex), `parseGithubUrl` (owner/name extraction)
- Added `aggregateStatus` helper implementing D-41 priority: failed > paused > in_progress > complete > pending
- **Commit:** `23933a7`

### Task 2: Create useIngestionPolling hook and IngestionBadge component

- Created `frontend/lib/use-ingestion-polling.ts` — custom React hook polling `getRepoStatus` every 3 seconds
- Stops polling on terminal statuses (complete/failed/paused) via `TERMINAL_STATUSES` constant
- Switches to 5s backoff interval on network errors
- Exports `PollingState` interface with status, steps, elapsedSeconds, error, isLoading
- Created `frontend/components/repos/ingestion-badge.tsx` — inline-flex pill badge with `STATUS_CONFIG` color map matching UI-SPEC ingestion status color map
- Exported `getAggregateBadgeLabel` function for project card aggregate display (D-41)
- **Commit:** `ae188c8`

### Task 3: Create ReposField, IngestButton, and IngestionProgressPanel components

- Created `frontend/components/repos/repos-field.tsx` — reusable repo URL input with `isValidGithubUrl` validation, duplicate detection, Enter-key support, and add/remove chip display
- Created `frontend/components/repos/ingest-button.tsx` — context-aware button with 4 visual states (Ingest Repository / Ingesting… / Re-ingest / Retry) plus confirmation dialogs for re-ingest and retry
  - Found and fixed `asChild` prop incompatibility with `@base-ui/react` TooltipTrigger (Deviation Rule 1)
- Created `frontend/components/repos/ingestion-progress-panel.tsx` — step-by-step progress list with `STEP_ICONS` and `STEP_COLORS` mappings, progress bar for cloning step, timing footer with elapsed time, error display, and rate-limit warning for paused status
- Exported `IngestionProgressSkeleton` for initial loading state
- All components pass `npx tsc --noEmit` with zero errors
- **Commit:** `b459f4a`

## Successful Verification Results

| Check | Result |
|-------|--------|
| `frontend/components/ui/badge.tsx` exists | PASS |
| `frontend/components/ui/progress.tsx` exists | PASS |
| `frontend/components/ui/tooltip.tsx` exists | PASS |
| `frontend/lib/api-repos.ts` exists (154 lines) | PASS |
| IngestionStatus type defined | PASS |
| listProjectRepos function | PASS |
| triggerIngestion function | PASS |
| getRepoStatus function | PASS |
| aggregateStatus function | PASS |
| isValidGithubUrl function | PASS |
| `frontend/lib/use-ingestion-polling.ts` exists (122 lines) | PASS |
| useIngestionPolling exported | PASS |
| 3s polling interval constant | PASS |
| Terminal status detection | PASS |
| `frontend/components/repos/ingestion-badge.tsx` exists (75 lines) | PASS |
| IngestionBadge exported | PASS |
| STATUS_CONFIG color mapping | PASS |
| getAggregateBadgeLabel exported | PASS |
| `frontend/components/repos/repos-field.tsx` exists (146 lines) | PASS |
| ReposField exported | PASS |
| URL validation (isValidGithubUrl) | PASS |
| `frontend/components/repos/ingest-button.tsx` exists (225 lines) | PASS |
| IngestButton exported | PASS |
| ReIngestConfirmDialog exists | PASS |
| `frontend/components/repos/ingestion-progress-panel.tsx` exists (148 lines) | PASS |
| IngestionProgressPanel exported | PASS |
| IngestionProgressSkeleton exported | PASS |
| STEP_ICONS mapping | PASS |
| STEP_COLORS mapping | PASS |
| `npx tsc --noEmit` (zero errors) | PASS |
| Commit `23933a7` exists | PASS |
| Commit `ae188c8` exists | PASS |
| Commit `b459f4a` exists | PASS |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed `asChild` prop from TooltipTrigger in IngestButton**
- **Found during:** Task 3 (TypeScript compilation)
- **Issue:** `TooltipTrigger` from shadcn/ui v4 base-nova (backed by `@base-ui/react/tooltip`) does not accept an `asChild` prop. The `@base-ui/react` trigger wraps children by default without needing `asChild`.
- **Fix:** Removed `asChild` from `<TooltipTrigger asChild>` → `<TooltipTrigger>`
- **Files modified:** `frontend/components/repos/ingest-button.tsx` (line 77)
- **Commit:** `b459f4a`
- **Verification:** `npx tsc --noEmit` passes with zero errors

## Known Stubs

None — all components are intentionally pure presentational as designed. They accept data via props and emit callbacks. Wire-up to project forms and detail pages is Plan 04's scope.

## Threat Flags

None — all threats from the plan's threat model are properly mitigated:
- T-03-12 (Spoofing): All API calls use `fetchApi` with `credentials: "include"` — backend auth handles validation
- T-03-13 (Information Disclosure): Repos scoped by `project_id` on backend, frontend only shows data user has access to
- T-03-14 (DoS): 3s polling interval with 5s backoff on error, stops on terminal status, max one active poll interval per mount
- T-03-15 (Tampering): Client-side URL validation is UX only — backend performs its own validation (Plan 01)

## Self-Check: PASSED

- [x] `frontend/components/ui/badge.tsx` exists
- [x] `frontend/components/ui/progress.tsx` exists
- [x] `frontend/components/ui/tooltip.tsx` exists
- [x] `frontend/lib/api-repos.ts` exists (154 lines, min 60)
- [x] `frontend/lib/use-ingestion-polling.ts` exists (122 lines, min 60)
- [x] `frontend/components/repos/ingestion-badge.tsx` exists (75 lines, min 50)
- [x] `frontend/components/repos/repos-field.tsx` exists (146 lines, min 100)
- [x] `frontend/components/repos/ingestion-progress-panel.tsx` exists (148 lines, min 100)
- [x] `frontend/components/repos/ingest-button.tsx` exists (225 lines, min 80)
- [x] Commit `23933a7` exists: feat(03-03): add shadcn badge, progress, tooltip components and api-repos.ts types + API client
- [x] Commit `ae188c8` exists: feat(03-03): create useIngestionPolling hook and IngestionBadge component
- [x] Commit `b459f4a` exists: feat(03-03): create ReposField, IngestButton, and IngestionProgressPanel components
- [x] `npx tsc --noEmit` passes from frontend/ directory (zero errors)

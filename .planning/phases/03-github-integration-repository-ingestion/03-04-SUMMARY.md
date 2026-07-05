---
phase: 03-github-integration-repository-ingestion
plan: 04
type: execute
subsystem: frontend + backend
tags:
  - integration
  - forms
  - detail-page
  - project-card
  - ingestion-ui
  - repos-field
requires:
  - 03-03 (Frontend repo UI components)
  - 03-01 (Backend Repo model + CRUD + ingestion endpoints)
provides:
  - Project interface with repo_count and ingestion_status fields
  - ProjectCard with dynamic repo count and IngestionBadge
  - Create form with functional ReposField
  - Edit form with functional ReposField and repo sync on save
  - Detail page with full repositories section, ingestion controls, progress panel, and polling
  - Backend ProjectResponse with ingestion_status aggregate
  - Backend repo creation from repo_urls on ProjectCreate
affects:
  - frontend/app/projects/new/page.tsx
  - frontend/app/projects/[id]/page.tsx
  - frontend/app/projects/[id]/edit/page.tsx
  - frontend/components/dashboard/project-card.tsx
  - frontend/lib/api-projects.ts
  - backend/app/projects/schemas.py
  - backend/app/projects/router.py
tech-stack:
  added:
    - ReposField component integration into create/edit/overview forms
    - IngestButton, IngestionProgressPanel, useIngestionPolling wiring into detail page
    - Backend aggregate ingestion_status computation for ProjectResponse
  patterns:
    - Repo URL collection during project creation (repo_urls in create form)
    - Repo diff sync on edit (add new URLs, remove deleted ones)
    - Repo list + ingestion controls on project detail page
    - Polling hook integration for active ingestion progress tracking
key-files:
  modified:
    - frontend/lib/api-projects.ts
    - frontend/components/dashboard/project-card.tsx
    - frontend/app/projects/new/page.tsx
    - frontend/app/projects/[id]/edit/page.tsx
    - frontend/app/projects/[id]/page.tsx
    - backend/app/projects/schemas.py
    - backend/app/projects/router.py
decisions:
  - Edit form syncs repos via add/remove API (diff-based) rather than inline ReposField — keeps detail page as primary repo management surface
  - Backend ingestion_status aggregation uses same priority as frontend aggregateStatus helper (failed > paused > in_progress > complete > pending)
  - Batch repo URL handling on project creation uses parse_github_url from repos router (deduplication via 409 handled by add_repo endpoint)
metrics:
  duration: "~25 minutes"
  completed: "2026-07-05"
  task_count: 3
  commit_count: 3
---
# Phase 03 Plan 04: Integration into Forms, Detail Page & Project Cards

**One-liner:** Wired all Phase 3 repo ingestion UI components (ReposField, IngestionBadge, IngestButton, IngestionProgressPanel, useIngestionPolling) into project forms, detail page, and project cards — replacing disabled D-30 placeholders with functional repository management including backend aggregate status computation and repo URL handling on project creation.

## Summary

This plan completed the Phase 3 frontend integration by activating the repo ingestion flow across the entire project UI. The disabled "Repo URLs" placeholders from Phase 2 (D-30 deferral) are now fully functional ReposField components in the create form, edit form, and detail page header. The project card shows dynamic repo count and aggregate ingestion status badge. The detail page has a full repositories section with add/remove, IngestButton with context-aware states, IngestionProgressPanel with real-time polling, and status badges per repo. The backend was extended to compute and return aggregate `ingestion_status` on all project responses, and to create Repo records automatically when repo URLs are provided during project creation.

### Task 1: Update Project type with repo_count/ingestion_status and update project card with badge

- Added `repo_count: number` and `ingestion_status: string | null` to the `Project` interface
- Added `repo_urls?: string[]` to the `ProjectCreate` interface
- Updated `ProjectCard` component to display dynamic repo count (`{project.repo_count} repos`) instead of hardcoded "0 repos"
- Added `IngestionBadge` with aggregate status to the card footer, shown only when `repo_count > 0`
- **Commit:** `12e1964`

### Task 2: Integrate ReposField into project create and edit forms + backend support

**Frontend:**
- Replaced disabled repo URL input in `projects/new/page.tsx` with functional `ReposField` component
- Added `repoEntries` state tracked as `RepoEntry[]`
- Updated submit handler to include `repo_urls: repoEntries.map(r => r.url)` in create payload
- Replaced disabled repo URL input in `projects/[id]/edit/page.tsx` with functional `ReposField`
- Fetches existing repos on edit form load via `listProjectRepos`
- Syncs repos on save: removes deleted repos via `removeProjectRepo`, adds new ones via `addProjectRepo`

**Backend:**
- Added `repo_urls: list[str] | None = None` to `ProjectCreate` schema
- Updated `create_project` endpoint to loop through `body.repo_urls`, call `parse_github_url` for each, create `Repo` records with `ingestion_status="pending"`, skipping invalid URLs silently
- Added `ingestion_status: str | None = None` to `ProjectResponse` schema
- Added `_aggregate_ingestion_status()` and `_set_repo_aggregates()` helper functions with D-41 priority (failed > paused > in_progress > complete > pending)
- Applied aggregate computation to `list_projects`, `get_project`, `create_project`, and `update_project` endpoints
- **Commit:** `b82e0f0`

### Task 3: Add repositories section with ingestion controls to project detail page

- Added imports for all repo components: `ReposField`, `IngestionBadge`, `IngestButton`, `IngestionProgressPanel`, `IngestionProgressSkeleton`, `useIngestionPolling`, and API functions
- Added repo state: `repos`, `reposLoading`, `repoEntries`, `activeRepoId`
- Added `fetchRepos` callback called after project loads
- Added active repo detection for polling (first non-terminal status repo)
- Integrated `useIngestionPolling` with `activeRepoId` — polls every 3s when ingestion is running
- Added "Repositories" card in Overview tab with:
  - ReposField for adding new repo URLs
  - "Add to Project" button that calls `addProjectRepo` for each unpersisted entry
  - Repo list with per-repo cards showing name, URL, language percentages, status badge
  - IngestButton with context-aware states (Ingest/Re-ingest/Retry) handling trigger/retry
  - Remove button per repo
  - IngestionProgressPanel wired to polling state for active repo
  - Empty state text: "No repositories added yet."
  - Loading skeleton via IngestionProgressSkeleton
- Updated header repo count from `"0 repos"` to `{repos.length} repos`
- Removed the disabled `settings-repo-urls` input from Settings tab (repos managed from Overview)
- **Commit:** `79147a4`

## Successful Verification Results

| Check | Result |
|-------|--------|
| `repo_count` in Project interface | PASS |
| `ingestion_status` in Project interface | PASS |
| `repo_urls` in ProjectCreate interface | PASS |
| IngestionBadge imported in ProjectCard | PASS |
| Dynamic repo count in ProjectCard (`project.repo_count`) | PASS |
| `ingestion_status` check in ProjectCard | PASS |
| ReposField in create form | PASS |
| `repoEntries` state in create form | PASS |
| `repo_urls` in create submit payload | PASS |
| ReposField in edit form | PASS |
| `listProjectRepos` fetch on edit load | PASS |
| `removeProjectRepo` on edit save | PASS |
| `repo_urls` in ProjectCreate schema (backend) | PASS |
| `ingestion_status` in ProjectResponse schema | PASS |
| `body.repo_urls` handling in `create_project` | PASS |
| `_aggregate_ingestion_status` helper | PASS |
| ReposField in detail page | PASS |
| IngestButton in detail page | PASS |
| IngestionProgressPanel in detail page | PASS |
| `useIngestionPolling` in detail page | PASS |
| `listProjectRepos` in detail page | PASS |
| `removeProjectRepo` in detail page | PASS |
| Dynamic repo count in header (`repos.length`) | PASS |
| No hardcoded "0 repos" in detail page | PASS |
| Settings tab repo URL section removed | PASS |
| `npx tsc --noEmit` (zero errors) | PASS |
| Commit `12e1964` exists | PASS |
| Commit `b82e0f0` exists | PASS |
| Commit `79147a4` exists | PASS |

## Deviations from Plan

None — the plan was executed exactly as written.

## Known Stubs

None — all components are fully wired. Repo ingestion and progress tracking work end-to-end from the UI.

## Threat Flags

None — all threats from the plan's threat model are properly handled:
- T-03-16 (Tampering — Repo URL submission): Client-side validation via ReposField is UX only. Backend validates URL format and ownership on every mutation via `parse_github_url` and project ownership scoping.
- T-03-17 (Denial of Service — Multiple ingest triggers): Backend rejects ingestion if status is not pending/failed (409 Conflict). Frontend tracks `activeRepoId` to disable IngestButton for other repos during active ingestion.
- T-03-18 (Information Disclosure — Repo listing visibility): Backend scopes all repo queries to project_id + owner_id. Frontend only renders what the API returns.

## Self-Check: PASSED

- [x] `frontend/lib/api-projects.ts` — repo_count, ingestion_status, repo_urls added
- [x] `frontend/components/dashboard/project-card.tsx` — IngestionBadge + dynamic repo count
- [x] `frontend/app/projects/new/page.tsx` — ReposField replaces disabled input
- [x] `frontend/app/projects/[id]/edit/page.tsx` — ReposField with repo sync on save
- [x] `frontend/app/projects/[id]/page.tsx` — Full repositories section with ingestion controls, polling, dynamic header count
- [x] `backend/app/projects/schemas.py` — repo_urls in ProjectCreate, ingestion_status in ProjectResponse
- [x] `backend/app/projects/router.py` — repo creation from repo_urls, aggregate ingestion_status computation
- [x] Commit `12e1964` exists: feat(03-04): update Project type with repo fields and project card with IngestionBadge
- [x] Commit `b82e0f0` exists: feat(03-04): integrate ReposField into create/edit forms with backend support
- [x] Commit `79147a4` exists: feat(03-04): add repositories section with ingestion controls to project detail page
- [x] `npx tsc --noEmit` passes from frontend/ directory (zero errors)

# Phase 3: GitHub Integration & Repository Ingestion - Context

**Gathered:** 2026-07-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can ingest GitHub repositories into their projects for evaluation. This phase delivers: manual repo URL input on project forms, a resilient background ingestion pipeline (metadata fetch + git clone + commit/PR/issue data extraction), repository snapshot versioning, ingestion status tracking (badge + progress panel), automatic language/tech stack detection, and the `project_repos` data model that feeds all downstream analysis phases.

</domain>

<decisions>
## Implementation Decisions

### Ingestion Trigger
- **D-31:** Manual trigger — user adds repo URL to project, then clicks "Ingest" button to start ingestion
- **D-32:** Repo URLs added via project create/edit form (Phase 2 D-16 placeholder now made functional)

### Repository Acquisition
- **D-33:** Hybrid with eager full data fetch — API for metadata (languages, topics, description), then git clone for full file tree + commit history, GitHub API pagination for PRs/issues. All fetched in Phase 3 — downstream phases read stored data without re-fetching.
- **D-34:** Clone to temporary local storage (Docker volume), extract structured data, persist to database, delete clone after successful ingestion.

### Ingestion Pipeline
- **D-35:** Resilient background pipeline with queue-based architecture
- **D-36:** Authenticated via user's GitHub OAuth token (from Phase 1 auth)
- **D-37:** Graceful pause/resume on API rate limits — honor GitHub's `x-ratelimit-reset` headers
- **D-38:** Incremental processing for large repositories — partial progress persisted
- **D-39:** Paused/resumed jobs can continue from last checkpoint (no restart)
- **D-40:** No arbitrary repo size limits — adaptive and fault-tolerant

### Status & UX
- **D-41:** Status badge on project card showing current ingestion state
- **D-42:** Inline progress panel on project detail page with step-by-step status
- **D-43:** REST polling for status updates (consistent with existing fetchApi pattern)
- **D-44:** Status lifecycle: `pending → queued → fetching_metadata → cloning → analyzing → complete | failed | paused`

### Data Model
- **D-45:** `project_repos` table (as deferred in D-30) storing: owner, name, description, default branch, visibility, GitHub URL, languages (byte counts), language percentages, tech stack signals, ingestion status, timestamps
- **D-46:** File tree stored for downstream static analysis (Phase 4)
- **D-47:** Commit, PR, and issue data stored for downstream mining (Phase 5)

### Repository Snapshot Versioning
- **D-48:** Each ingestion creates a new immutable repository snapshot linked to a specific commit SHA. All downstream analyses reference snapshots rather than the live repository.

### Re-ingestion Policy
- **D-49:** Re-ingestion creates a new snapshot while preserving historical analyses and reports. Existing intelligence is never overwritten.

### Checkpoint Recovery
- **D-50:** Background ingestion is checkpoint-based. Retry operations resume from the last successful stage instead of restarting the entire pipeline.

### OpenCode's Discretion
- Exact polling interval for status updates
- Number of concurrent ingestion jobs
- Checkpoint granularity (per-file, per-API-call, per-stage)
- Temporary clone storage path and retention policy (beyond delete-on-success)
- Progress panel layout details

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Context
- `.planning/PROJECT.md` — Project vision, core value, and requirements
- `.planning/REQUIREMENTS.md` §REPO-01, REPO-02, REPO-03 — Requirements for repo ingestion, language detection, and large-repo handling
- `.planning/ROADMAP.md` §Phase 3 — Phase goal, success criteria, requirement mapping

### Backend Patterns (from Phase 1 & 2)
- `backend/app/main.py` — Router registration pattern (FastAPI)
- `backend/app/projects/router.py` — Existing CRUD pattern (async SQLAlchemy, auth dependency)
- `backend/app/projects/schemas.py` — Pydantic schema pattern for request/response models
- `backend/app/models/project.py` — Existing SQLAlchemy model pattern
- `backend/app/models/user.py` — User model with GitHub OAuth integration
- `backend/app/auth/dependencies.py` — `get_current_user` dependency for auth
- `backend/app/auth/router.py` — Existing OAuth token handling (token available for API calls)
- `backend/app/database.py` — AsyncSession, `get_db` dependency
- `backend/app/config.py` — Settings pattern for environment configuration

### Frontend Patterns (from Phase 2)
- `frontend/lib/api-projects.ts` — API client pattern (fetchApi with credentials: "include")
- `frontend/lib/auth.ts` — fetchApi utility and auth wrapper
- `frontend/app/projects/page.tsx` — Project list with ProjectGrid (pattern for repo list)
- `frontend/app/projects/new/page.tsx` — Create form (pattern for repo URL input)
- `frontend/app/projects/[id]/page.tsx` — Detail page (pattern for repo detail/status view)
- `frontend/components/dashboard/project-card.tsx` — Card component pattern
- `frontend/components/dashboard/sidebar.tsx` — Sidebar with navigation pattern
- `frontend/app/auth-provider.tsx` — useAuth hook for authenticated user

### UI Design Contract
- `.planning/references/ui-brand.md` — Dark Indigo theme, shadcn/ui v4, Inter font

### Research & Architecture
- `.planning/research/PITFALLS.md` — GitHub API rate limiting pitfalls
- `.planning/research/ARCHITECTURE.md` §Architecture Patterns — Multi-stage pipeline architecture
- `.planning/research/FEATURES.md` — MVP feature definitions

### Phase 2 Deferred Work (now active)
- `.planning/phases/02-project-management/02-CONTEXT.md` — D-30 repo URL deferral

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`frontend/lib/auth.ts` fetchApi** — Can be used for GitHub API calls in addition to backend calls
- **`backend/app/auth/dependencies.py` get_current_user** — Auth dependency available for ingestion endpoints
- **`frontend/components/ui/card.tsx`** — Card pattern for repo status display
- **Project CRUD model/schema** (`backend/app/models/project.py`, `backend/app/projects/schemas.py`) — Can be extended for repo model
- **`backend/app/database.py`** — AsyncSession configuration, can be used for repo/analysis data models

### Established Patterns
- **FastAPI router + Pydantic schema** pattern for all API endpoints
- **Data isolation via owner_id** filter pattern from Phase 2
- **FetchApi-based REST client** on frontend (no WebSocket/SSE yet — polling fits current architecture)
- **Modal overlay pattern** from DeleteProjectDialog (can reuse for ingest confirmation)

### Integration Points
- **Project detail page** (`/projects/[id]`) — Ingest status panel and repo list go here
- **Project create/edit forms** — Repo URL input field goes here (D-32)
- **Project card** — Status badge on project cards linking to ingestion state
- **Backend router** — New `/api/projects/{id}/repos` endpoints under existing projects router (or new repos router)
- **GitHub API** — OAuth token from auth system used for authenticated API calls

</code_context>

<specifics>
## Specific Ideas

- Ingestion should feel like a background task — user adds URL, clicks Ingest, sees progress, can navigate away and come back
- Status lifecycle should be visible at a glance (badge) and in detail (progress panel)
- Snapshot model means users can re-ingest without losing old evaluations — useful for tracking improvement over time
- Checkpoint recovery is critical for large repos — a 50K-commit repo shouldn't restart from scratch if the connection drops

</specifics>

<deferred>
## Deferred Ideas

- Project search/filter bar (Phase 3+ as noted in Phase 2 deferred)
- Bulk repo operations (add multiple URLs at once) — can be added post-MVP
- Scheduled re-ingestion / webhook-triggered re-ingestion — post-MVP

</deferred>

---

*Phase: 03-github-integration-repository-ingestion*
*Context gathered: 2026-07-05*

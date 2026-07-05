# Phase 2: Project Management - Context

**Gathered:** 2026-06-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can create and manage their evaluation projects. This phase delivers: project CRUD (create, read, update, delete), project listing with cards on the dashboard, dedicated create/edit pages, a project detail page with tabs (Overview + Settings), and backend REST endpoints for all project operations. Data isolation ensures each user sees only their own projects.

</domain>

<decisions>
## Implementation Decisions

### Project List Layout
- **D-01:** Card layout using shadcn Card component — NOT table or list
- **D-02:** Card content: project name, description preview, created date, repo count (icon + number in footer)
- **D-03:** Card grid: CSS grid auto-fill with minmax(300px, 1fr)
- **D-04:** Card hover: subtle lift + shadow elevation
- **D-05:** Card menu (three-dot): Edit, Duplicate, Delete
- **D-06:** Sorting: newest first (created_at DESC) by default
- **D-07:** Loading state: skeleton card placeholders
- **D-08:** Pagination: page numbers at bottom
- **D-09:** Empty state: show same welcome CTA after last project deleted

### Route Architecture
- **D-10:** `/dashboard` swaps content between empty state and project card grid (shared component)
- **D-11:** Sidebar "Projects" nav item links to `/projects` (separate route, same component initially)
- **D-12:** `/dashboard` evolves into executive overview in Phase 9; `/projects` remains dedicated management page
- **D-13:** `Projects > Project Name` breadcrumbs on detail page

### Create & Edit
- **D-14:** Create: dedicated page at `/projects/new`
- **D-15:** Edit: dedicated page at `/projects/[id]/edit`
- **D-16:** Form fields: name (required, 1-100 chars, alphanumeric), description (optional textarea), repo URLs (single + bulk hybrid input), tags (hybrid — predefined list + custom)
- **D-17:** Predefined tags: Frontend, Backend, Full Stack, Mobile, AI/ML, Data Science, DevOps, Cloud, Open Source, Research, Hackathon, Capstone, Enterprise, Library, API, Microservices, CLI, Web Application
- **D-18:** Cancel button: navigates to `/projects`

### Project Detail Page
- **D-19:** Route: `/projects/[id]`
- **D-20:** Layout: top header with project name/meta + breadcrumbs, tabbed sections below
- **D-21:** Initial tabs: Overview (project details, description, meta, tags) + Settings (inline edit form + delete button at bottom)

### Delete
- **D-22:** Delete triggered from: card three-dot menu AND Settings tab delete zone
- **D-23:** Confirmation: simple AlertDialog ("Are you sure? This cannot be undone." — Cancel/Delete)
- **D-24:** After deleting last project: show empty state with Create CTA

### Backend API
- **D-25:** REST endpoints under prefix `/api/projects`:
  - `GET /api/projects` — list user's projects (paginated, newest first)
  - `POST /api/projects` — create project
  - `GET /api/projects/{id}` — get project detail
  - `PATCH /api/projects/{id}` — update project
  - `DELETE /api/projects/{id}` — delete project
- **D-26:** All endpoints require authentication (auth dependency from Phase 1)
- **D-27:** Data isolation: query filter by `owner_id` from authenticated user
- **D-28:** Existing Project model already has: id (UUID), name, description, owner_id, created_at, updated_at — needs migration for tags field
- **D-29:** Tags stored as ARRAY(String) on the Project model for PostgreSQL
- **D-30:** Repo URLs stored in a separate `project_repos` table (for Phase 3 expansion) or as ARRAY(String) — deferred to Phase 3, not stored in Phase 2

### OpenCode's Discretion
- Exact skeleton card count and animation
- Pagination page size (recommend 12 or 24)
- Confirm button text color (red vs primary)
- Form field layout details (single vs two-column)

</decisions>

<canonical_refs>
## Canonical References

Downstream agents MUST read these before planning or implementing.

### Auth / Dependency Pattern
- `backend/app/auth/dependencies.py` — get_current_user dependency for auth
- `backend/app/main.py` — existing router registration pattern
- `backend/app/auth/router.py` — existing APIRouter pattern with prefix

### Project Model (exists, needs migration)
- `backend/app/models/project.py` — Project ORM model (name, description optional, owner_id FK, timestamps)
- `backend/app/models/__init__.py` — exports

### Frontend Patterns
- `frontend/app/dashboard/page.tsx` — current dashboard page (swaps content based on state)
- `frontend/components/dashboard/welcome-empty-state.tsx` — empty state component
- `frontend/components/dashboard/sidebar.tsx` — sidebar with "Projects" nav
- `frontend/app/auth-provider.tsx` — useAuth hook for authenticated user
- `frontend/lib/auth.ts` — existing API client pattern

### UI Design Contract
- `.planning/references/ui-brand.md` — Dark Indigo theme (#0F172A bg, #4F46E5 primary), shadcn/ui v4, Inter font

</canonical_refs>

<specifics>
## Specific Ideas

- Dashboard page shows skeleton cards on load, then switches to either empty state (no projects) or project grid
- Repo count on card shows "0 repos" initially — actual counting comes in Phase 3
- The repo count field is shown but will be 0 until Phase 3 populates it; show as icon + "0" with no special empty treatment
- Duplicate project creates a copy with "(copy)" appended to name
- Settings tab is the primary project management hub — edit form + delete in one place
- The /projects route and /dashboard route share the same project grid component; the difference is semantic for future evolution

</specifics>

<deferred>
## Deferred Ideas

- Repo URL storage and management (Phase 3 — needs project_repos table and ingestion)
- Project search/filter bar (can be added in Phase 3+)
- Bulk project operations
- Project sharing / team collaboration
- Project archiving (soft-delete)

</deferred>

---

*Phase: 02-project-management*
*Context gathered: 2026-06-28 via discuss-phase*

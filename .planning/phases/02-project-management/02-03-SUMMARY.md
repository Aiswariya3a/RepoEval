---
phase: 02-project-management
plan: 03
subsystem: ui
tags:
  - nextjs
  - shadcn-ui
  - typescript
  - project-management
  - frontend
  - detail-page
  - crud

requires:
  - phase: 02-01
    provides: Backend project CRUD API endpoints
  - phase: 02-02
    provides: API client module, ProjectCard, ProjectGrid, create form, tag selector pattern

provides:
  - Project detail page with tabbed Overview + Settings layout
  - Edit page with pre-populated form and validation
  - Delete confirmation dialog component
  - TagSelector shared component extracted from create form
  - Card three-dot dropdown menu with Edit, Duplicate, Delete actions
  - Duplicate project feature (creates copy with "(copy)" suffix)

affects:
  - Phase 3: Repo URL management and card menu wiring

tech-stack:
  added:
    - none (uses existing lucide-react, shadcn/ui components)
  patterns:
    - Tabbed layout with client-side useState for active tab
    - Controlled dropdown menu with outside-click dismissal
    - Inline edit form in Settings tab with validation feedback
    - Modal dialog with backdrop overlay for deletion confirmation
    - Shared TagSelector component for DRY tag management

key-files:
  created:
    - frontend/app/projects/[id]/page.tsx
    - frontend/components/dashboard/delete-project-dialog.tsx
    - frontend/app/projects/[id]/edit/page.tsx
    - frontend/components/dashboard/tag-selector.tsx
  modified:
    - frontend/app/projects/new/page.tsx

key-decisions:
  - "DeleteProjectDialog uses a controlled modal with backdrop overlay (not shadcn AlertDialog) to keep dependencies minimal"
  - "Three-dot menu on detail page duplicates the project with a (copy) suffix and navigates to the new project"
  - "Settings tab contains both the inline edit form and the danger zone delete section"
  - "TagSelector extracted as a shared component to DRY up create and edit forms"
  - "PREDEFINED_TAGS moved into TagSelector and exported for use by pages that need them"
  - "Edit page cancel button navigates to /projects/[id] (detail view), not /projects (list view) per D-18"

patterns-established:
  - "Modal dialog pattern: fixed inset-0 backdrop + centered card, controlled via open/onOpenChange props"
  - "Tab pattern: useState<'overview'|'settings'> with button-based tab bar and conditional rendering"
  - "Inline save pattern: success banner auto-dismisses after 3 seconds"

requirements-completed:
  - AUTH-02

duration: 2min
completed: 2026-07-05
---

# Phase 02 Plan 03: Project Detail, Edit, and Delete

**Full project detail page with tabbed overview/settings, edit page at /projects/[id]/edit, delete confirmation dialog, and shared TagSelector component — completing the project CRUD frontend**

## Performance

- **Duration:** 2 min
- **Started:** 2026-07-05T12:45:13+05:30
- **Completed:** 2026-07-05T12:46:46+05:30
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- Created `/projects/[id]` detail page with:
  - Breadcrumb navigation: Projects > {project name}
  - Header with project name, created date, repo count metadata
  - Tabbed layout with Overview (description, tags as badges, metadata) and Settings (inline edit form + delete zone)
  - Three-dot dropdown menu on header with Edit (navigates to edit page), Duplicate (creates copy with "(copy)" suffix), Delete (opens confirmation dialog)
  - Loading skeleton with pulsing blocks matching page layout
  - Error state with "Project Not Found" message and back link
  - Settings tab inline edit form with pre-filled fields from API data
  - Settings tab "Danger Zone" with destructive Delete button triggering DeleteProjectDialog
- Created `DeleteProjectDialog` component — controlled modal with backdrop, loading state, Cancel and destructive Delete buttons
- Created `/projects/[id]/edit` edit page with:
  - Breadcrumbs: Projects > {project name} > Edit
  - Pre-populated form (name, description, tags) from API
  - Same validation rules as create form
  - Submit calls `updateProject()` and redirects to detail page
  - Cancel navigates to `/projects/[id]`
  - Loading skeleton and error states
- Created `TagSelector` shared component and refactored `/projects/new` to use it
  - Exports `PREDEFINED_TAGS` constant for use by pages
  - Handles predefined tag toggling, custom tag input with keyboard support, and selected tags display
  - Replaces inline tag logic previously duplicated in create form
- Duplicate feature creates project with `{name} (copy)` suffix and navigates to new project

## Task Commits

Each task was committed atomically:

1. **task 1: Create project detail page with tabs (Overview + Settings)** - `5d949d4` (feat)
2. **task 2: Create delete confirmation dialog component** - `4cf6a6d` (feat)
3. **task 3: Create project edit page at /projects/[id]/edit** - `22e9956` (feat)

**Plan metadata:** *(to be committed after state updates)*

## Files Created/Modified

### Created
- `frontend/app/projects/[id]/page.tsx` - Project detail page with tabs, dropdown menu, inline edit, delete zone
- `frontend/components/dashboard/delete-project-dialog.tsx` - Controlled modal confirmation dialog for project deletion
- `frontend/app/projects/[id]/edit/page.tsx` - Project edit page with pre-populated form and validation
- `frontend/components/dashboard/tag-selector.tsx` - Shared tag selector component with predefined + custom tags

### Modified
- `frontend/app/projects/new/page.tsx` - Refactored to use shared TagSelector component instead of inline tag logic

## Decisions Made
- **Modal pattern: custom controlled overlay** - Rejected shadcn AlertDialog to keep dependencies minimal; implemented as a simple div-based modal with backdrop
- **Edit page navigation** - Cancel returns to project detail view (per D-18) rather than project list
- **TagSelector extraction** - Prevents code duplication between create and edit forms
- **Duplicate navigation** - After creating a duplicate, navigates to the new project's detail page for immediate context
- **Inline edit success banner** - Auto-dismisses after 3 seconds for positive feedback without manual dismissal

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Threat Surface Scan

No new security-relevant surface introduced beyond what was declared in the plan's threat model. The delete dialog is UX-only (user intent confirmation); actual DELETE authorization is enforced server-side. The edit form submits PATCH requests which are authenticated and owner-filtered server-side.

## Next Phase Readiness
- Project detail page fully functional with all CRUD operations accessible
- Edit and delete workflows complete
- TagSelector component ready for reuse in future forms
- Next plan (Phase 3) should implement: Repo URL management, real repo count on cards, and card menu wiring for three-dot dropdown on project grid cards
- The project-card.tsx three-dot menu is still a placeholder (click handler only) — Phase 3 should wire it to a DropdownMenu

---

*Phase: 02-project-management*
*Completed: 2026-07-05*

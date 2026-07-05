# Phase 3: GitHub Integration & Repository Ingestion - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-05
**Phase:** 03-github-integration-repository-ingestion
**Areas discussed:** Ingestion flow, Repo acquisition, Status UX, Data model, Large repos & rate limits, Repository snapshot versioning, Re-ingestion policy, Checkpoint recovery

---

## Ingestion Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Automatic | Ingestion starts as soon as URL is added | |
| Manual | User clicks "Ingest" button after adding URL | ✓ |
| Hybrid | Auto-starts but user can pause/restart | |

**User's choice:** Manual trigger
**Notes:** User adds repo URL, then explicitly clicks a button to start ingestion. Background queue-based async processing.

---

## Repository Acquisition

| Option | Description | Selected |
|--------|-------------|----------|
| GitHub API only | No clone, lighter, but limited data | |
| Full git clone | Complete history, heavy for large repos | |
| Hybrid | API for metadata, clone when needed | ✓ (eager) |

**User's choice:** Hybrid with eager full data fetch
**Notes:** Combined API + clone in a single comprehensive ingestion pass. Downstream phases read stored data without re-fetching.

---

## Status Tracking UX

| Option | Description | Selected |
|--------|-------------|----------|
| Status badge only | Minimal, notification on completion | |
| Dedicated status page | User navigates to detail view | |
| Badge + inline panel | Card badge + detail page progress panel | ✓ |
| Toast only | Just notify on complete/error | |

**User's choice:** Badge on card + inline panel + REST polling
**Notes:** Consistent with existing fetchApi pattern — no WebSocket/SSE complexity.

---

## Data Model Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Only metadata | Languages, tech stack, status | |
| Comprehensive single fetch | API metadata + clone + commit/PR/issue data all at once | ✓ |
| Deferred fetch | Phase 3 gets metadata, Phases 4/5 fetch their own | |

**User's choice:** One-time full data fetch using API + clone
**Notes:** Stores file tree (for Phase 4 static analysis) and commit/PR/issue data (for Phase 5 mining). All downstream phases read from stored data.

---

## Large Repos & Rate Limits

| Option | Description | Selected |
|--------|-------------|----------|
| Simple timeout | Fail if too large | |
| Adaptive pipeline | Checkpoint-based, pause/resume on rate limits | ✓ |
| Size cap | Reject repos beyond threshold | |

**User's choice:** Resilient background pipeline (detailed design)
**Notes:** Authenticated OAuth tokens, honor GitHub reset headers, incremental processing, no arbitrary size limits, checkpoint recovery.

---

## Repository Snapshot Versioning

**User's choice:** Each ingestion creates a new immutable snapshot linked to a specific commit SHA (D-48). All analyses reference snapshots, not live repos.

---

## Re-ingestion Policy

**User's choice:** Re-ingestion creates a new snapshot while preserving historical analyses and reports (D-49). Existing intelligence is never overwritten.

---

## Checkpoint Recovery

**User's choice:** Background ingestion is checkpoint-based (D-50). Retry operations resume from the last successful stage instead of restarting the entire pipeline.

---

## OpenCode's Discretion

- Exact polling interval for status updates
- Number of concurrent ingestion jobs
- Checkpoint granularity (per-file, per-API-call, per-stage)
- Temporary clone storage path and retention policy
- Progress panel layout details

## Deferred Ideas

- Project search/filter bar — future phase
- Bulk repo operations — post-MVP
- Scheduled / webhook-triggered re-ingestion — post-MVP

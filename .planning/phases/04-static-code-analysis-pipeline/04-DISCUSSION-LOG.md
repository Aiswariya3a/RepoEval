# Phase 4: Static Code Analysis Pipeline - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in CONTEXT.md — this log preserves the discussion.

**Date:** 2026-07-05
**Phase:** 04-static-code-analysis-pipeline
**Mode:** discuss (interactive)

## Areas Discussed

1. Tool selection & language support
2. Trigger & sequencing model
3. Data model & scoring methodology
4. Scope: file inclusion & analysis depth

---

## Discussion Record

### Area 1: Tool Selection & Language Support

**Question:** What's the language support strategy for static analysis tools?
- **Options:** Python-first expand later / Multi-language from start
- **User:** Python-first, expand later

**Question:** Which Python linting tool?
- **Options:** Ruff (Recommended) / Pylint / Both
- **User:** Ruff (Recommended)

**Question:** What additional Python analysis dimensions?
- **Options:** Complexity + Security + Types (full suite) / Complexity + Security (no mypy) / Just complexity metrics
- **User:** Complexity + Security (no mypy)

### Area 2: Trigger & Sequencing Model

**Question:** How should analysis be triggered?
- **Options:** Auto-trigger after ingestion / Manual trigger (Analyze button)
- **User:** Manual trigger (Analyze button)

**Question:** How should analysis stages be sequenced?
- **Options:** Sequential with checkpointing / Sequential no checkpointing / Parallel per-stage
- **User (freeform):** Hybrid — checkpointed sequential stages with concurrent analyzer execution inside each stage. Each major stage has a checkpoint for resumability. Within the Static Analysis stage, execute independent analyzers (Ruff, Radon, Bandit) concurrently using asyncio.gather(). Persist individual results as they complete. Resume from failed analyzer/stage, not full restart.

### Area 3: Data Model & Scoring Methodology

**Question:** How should analysis results be stored?
- **Options:** Composite report model / Per-tool results + composite / Extend RepositorySnapshot
- **User (freeform):** 3-layer model — StaticAnalysisRun (execution tracking), StaticAnalysisToolResult (per-tool normalized outputs), CodeQualityReport (denormalized aggregated scores for fast queries). Dashboard queries CodeQualityReport; drill-down accesses individual tool results.

**Question:** How should composite score be calculated?
- **Options:** Weighted average / Simple average / Penalty-based
- **User (freeform):** Static analysis is advisory, not authoritative. Instructor-defined rubric is the scoring mechanism. Scores are reference metrics for AI evaluator (Phase 6+), not fixed weights in student grades.

### Area 4: Scope — File Inclusion & Depth

**Question:** Which files to analyze and how to handle large repos?
- **Options:** All source size-limited batches / Smart sampling / Lint full + deep subset
- **User (freeform):** Rank source files using inexpensive heuristics (entry points, import graph, file size, commit activity, directory importance). Lightweight analysis (lint) on ALL files. Deep analysis (complexity, security) only on top-ranked files. Ignore generated, vendor, test, binary files.

**Scope check:** Any additional capabilities for this phase?
- **User:** Compute and persist canonical file importance score (0-100) for every source file using deterministic heuristics. Becomes the canonical ranking for ALL downstream phases.

---

## Deferred Ideas

- Multi-language analysis (JS/TS, Go, Java) — future phase
- AI-powered analysis — Phase 6-7
- Re-analysis with trend comparison — Phase 9
- Dedicated analysis-worker service — defer until CPU bottleneck
- Redis caching of tool outputs — not needed for v1

---

*Phase: 04-static-code-analysis-pipeline*
*Discussion recorded: 2026-07-05*

import asyncio
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.database import async_session
from app.models.repo import Repo
from app.models.snapshot import RepositorySnapshot
from app.analysis.models import StaticAnalysisRun, StaticAnalysisToolResult, CodeQualityReport
from app.analysis.analyzers import (
    RuffAnalyzer,
    RadonAnalyzer,
    BanditAnalyzer,
    _extract_source_files,
    _filter_by_language,
    ANALYZER_REGISTRY,
)
from app.analysis.scoring import FileImportanceScorer, CompositeScoreCalculator
from app.analysis.duplication import DuplicateDetector
from app.analysis.checkpoint import AnalysisCheckpointManager


settings = Settings()
# Python-only extensions for now (D-01)
SUPPORTED_LANGUAGE_EXTENSIONS = {".py"}


async def run_analysis(snapshot_id: uuid.UUID) -> None:
    """Main analysis pipeline. Runs stages in order with checkpoint recovery (D-07).

    Stages:
    1. analyzing_files — Enumerate files from snapshot file_tree
    2. running_ruff — Ruff lint on ALL files (lightweight)
    3. running_radon — Radon complexity on top-ranked files (deep)
    4. running_bandit — Bandit security on top-ranked files (deep)
    5. computing_importance — Compute file importance scores
    6. computing_duplication — Detect code duplication
    7. aggregating — Compute composite score, create CodeQualityReport
    8. complete — Mark run as complete
    """
    async with async_session() as db:
        # Load snapshot
        result = await db.execute(
            select(RepositorySnapshot).where(RepositorySnapshot.id == snapshot_id)
        )
        snapshot = result.scalar_one_or_none()
        if not snapshot:
            return

        # Load repo for language info
        result = await db.execute(
            select(Repo).where(Repo.id == snapshot.repo_id)
        )
        repo = result.scalar_one_or_none()
        if not repo:
            return

        # Create or find the analysis run
        result = await db.execute(
            select(StaticAnalysisRun)
            .where(StaticAnalysisRun.snapshot_id == snapshot_id)
            .order_by(StaticAnalysisRun.created_at.desc())
        )
        run = result.scalar_one_or_none()

        if not run:
            run = StaticAnalysisRun(
                snapshot_id=snapshot_id,
                status="queued",
                current_stage="queued",
                total_files=snapshot.total_files or 0,
                started_at=datetime.now(timezone.utc),
            )
            db.add(run)
            await db.commit()
            await db.refresh(run)

        checkpoint = AnalysisCheckpointManager(run.id, db)

        # ── Stage 1: Enumerate Files ────────────────
        all_source_files = []
        if not await checkpoint.should_resume("analyzing_files"):
            await checkpoint.save_stage("analyzing_files")
            run.status = "analyzing_files"
            await db.commit()

            file_tree = snapshot.file_tree or {}
            all_source_files = _extract_source_files(file_tree)
            # Filter to Python files only (D-01)
            all_source_files = [f for f in all_source_files if f.get("ext", "") in SUPPORTED_LANGUAGE_EXTENSIONS]
            run.total_files = len(all_source_files)
            run.analyzed_files = 0
            await db.commit()

        try:
            # ── Stage 2: Ruff Lint (ALL files) ─────
            lint_results = {}
            if not await checkpoint.should_resume("running_ruff"):
                await checkpoint.save_stage("running_ruff")
                run.status = "running_ruff"
                await db.commit()

                start = time.monotonic()
                file_paths = [f["path"] for f in all_source_files]
                # Process in batches per D-20
                batch_size = settings.analysis_batch_size
                all_issues = {"total_errors": 0, "total_warnings": 0, "issues": []}

                for i in range(0, len(file_paths), batch_size):
                    batch = file_paths[i:i + batch_size]
                    batch_result = await RuffAnalyzer.analyze(batch)
                    all_issues["total_errors"] += batch_result.get("total_errors", 0)
                    all_issues["total_warnings"] += batch_result.get("total_warnings", 0)
                    all_issues["issues"].extend(batch_result.get("issues", []))
                    run.analyzed_files = min(i + batch_size, len(file_paths))
                    await db.commit()

                lint_results = all_issues
                duration_ms = int((time.monotonic() - start) * 1000)

                # Persist tool result (D-10 Layer 2)
                tool_result = StaticAnalysisToolResult(
                    run_id=run.id,
                    tool_name="ruff",
                    language="python",
                    status="completed",
                    file_count=len(file_paths),
                    metrics={
                        "total_errors": lint_results.get("total_errors", 0),
                        "total_warnings": lint_results.get("total_warnings", 0),
                    },
                    issues=lint_results.get("issues", []),
                    duration_ms=duration_ms,
                )
                db.add(tool_result)
                await db.commit()

            # ── Stage 3: Radon Complexity ───────────
            complexity_results = {}
            if not await checkpoint.should_resume("running_radon"):
                await checkpoint.save_stage("running_radon")
                run.status = "running_radon"
                await db.commit()

                start = time.monotonic()

                # First, do a lightweight Ruff scan for file importance estimation
                # (Or we can do Radon on all files since Python-first means manageable count)
                file_paths = [f["path"] for f in all_source_files]

                # Radon on all Python files for full complexity picture
                # (batching per D-20 for large repos)
                batch_size = settings.analysis_batch_size
                aggregated = {
                    "avg_cyclomatic_complexity": 0,
                    "max_cyclomatic_complexity": 0,
                    "maintainability_index": 100,
                    "sloc": 0,
                    "files": [],
                    "functions": [],
                }

                for i in range(0, len(file_paths), batch_size):
                    batch = file_paths[i:i + batch_size]
                    batch_result = await RadonAnalyzer.analyze(batch)
                    aggregated["sloc"] += batch_result.get("sloc", 0)
                    aggregated["files"].extend(batch_result.get("files", []))
                    aggregated["functions"].extend(batch_result.get("functions", []))
                    run.analyzed_files = min(i + batch_size, len(file_paths))
                    await db.commit()

                # Recompute aggregate metrics
                complexities = [f.get("avg_complexity", 0) for f in aggregated["files"]]
                mis = [f.get("mi", 100) for f in aggregated["files"]]
                aggregated["avg_cyclomatic_complexity"] = round(
                    sum(complexities) / len(complexities), 2
                ) if complexities else 0
                aggregated["max_cyclomatic_complexity"] = max(
                    [f.get("complexity", 0) for f in aggregated["files"]]
                ) if aggregated["files"] else 0
                aggregated["maintainability_index"] = round(
                    sum(mis) / len(mis), 2
                ) if mis else 100.0

                complexity_results = aggregated
                duration_ms = int((time.monotonic() - start) * 1000)

                tool_result = StaticAnalysisToolResult(
                    run_id=run.id,
                    tool_name="radon",
                    language="python",
                    status="completed",
                    file_count=len(file_paths),
                    metrics={
                        "avg_cyclomatic_complexity": complexity_results.get("avg_cyclomatic_complexity", 0),
                        "max_cyclomatic_complexity": complexity_results.get("max_cyclomatic_complexity", 0),
                        "maintainability_index": complexity_results.get("maintainability_index", 100),
                        "sloc": complexity_results.get("sloc", 0),
                    },
                    issues=complexity_results.get("functions", []),
                    duration_ms=duration_ms,
                )
                db.add(tool_result)
                await db.commit()

            # ── Stage 4: Bandit Security ────────────
            security_results = {}
            if not await checkpoint.should_resume("running_bandit"):
                await checkpoint.save_stage("running_bandit")
                run.status = "running_bandit"
                await db.commit()

                start = time.monotonic()
                file_paths = [f["path"] for f in all_source_files]

                # Bandit on all files (runs per-directory, efficient enough)
                security_results = await BanditAnalyzer.analyze(file_paths)
                duration_ms = int((time.monotonic() - start) * 1000)

                tool_result = StaticAnalysisToolResult(
                    run_id=run.id,
                    tool_name="bandit",
                    language="python",
                    status="completed",
                    file_count=len(file_paths),
                    metrics={
                        "total_issues": security_results.get("total_issues", 0),
                        "high_severity": security_results.get("high_severity", 0),
                        "medium_severity": security_results.get("medium_severity", 0),
                        "low_severity": security_results.get("low_severity", 0),
                    },
                    issues=security_results.get("issues", []),
                    duration_ms=duration_ms,
                )
                db.add(tool_result)
                await db.commit()

            # ── Stage 5: File Importance ────────────
            importance_index = {}
            if not await checkpoint.should_resume("computing_importance"):
                await checkpoint.save_stage("computing_importance")
                run.status = "computing_importance"
                await db.commit()

                start = time.monotonic()
                scorer = FileImportanceScorer()
                importance_index = scorer.compute(
                    all_source_files,
                    radon_results=complexity_results,
                    file_tree=snapshot.file_tree,
                )
                duration_ms = int((time.monotonic() - start) * 1000)
                # Importance is computed in-memory, stored in CodeQualityReport below

            # ── Stage 6: Duplication Detection ─────
            duplication_results = {}
            if not await checkpoint.should_resume("computing_duplication"):
                await checkpoint.save_stage("computing_duplication")
                run.status = "computing_duplication"
                await db.commit()

                start = time.monotonic()
                # Clone path from repo config for file content access
                clone_path = Path(settings.temp_clone_path) / str(snapshot.repo_id)
                duplication_results = DuplicateDetector.detect(
                    all_source_files,
                    repo_root=clone_path if clone_path.exists() else None,
                )
                duration_ms = int((time.monotonic() - start) * 1000)

            # ── Stage 7: Aggregation ────────────────
            if not await checkpoint.should_resume("aggregating"):
                await checkpoint.save_stage("aggregating")
                run.status = "aggregating"
                await db.commit()

                start = time.monotonic()

                # Compute composite score
                score_results = CompositeScoreCalculator.compute(
                    lint_results=lint_results if lint_results else None,
                    complexity_results=complexity_results if complexity_results else None,
                    security_results=security_results if security_results else None,
                    duplication_pct=duplication_results.get("duplication_percentage", 0),
                )

                # Build per-language metrics
                per_language = {}
                if complexity_results:
                    py_metrics = {
                        "files": len(all_source_files),
                        "sloc": complexity_results.get("sloc", 0),
                        "lint_issues": lint_results.get("total_errors", 0) + lint_results.get("total_warnings", 0) if lint_results else 0,
                        "avg_complexity": complexity_results.get("avg_cyclomatic_complexity", 0),
                        "mi": complexity_results.get("maintainability_index", 100),
                    }
                    per_language["python"] = py_metrics

                # Get last lint result for issue count
                total_lint = lint_results.get("total_errors", 0) + lint_results.get("total_warnings", 0) if lint_results else 0
                total_sec = security_results.get("total_issues", 0) if security_results else 0

                # Create or update CodeQualityReport (D-10 Layer 3)
                result = await db.execute(
                    select(CodeQualityReport).where(CodeQualityReport.run_id == run.id)
                )
                report = result.scalar_one_or_none()

                if not report:
                    report = CodeQualityReport(
                        run_id=run.id,
                        snapshot_id=snapshot_id,
                        overall_score=score_results["overall_score"],
                        lint_score=score_results["lint_score"],
                        complexity_score=score_results["complexity_score"],
                        security_score=score_results["security_score"],
                        duplication_score=score_results["duplication_score"],
                        maintainability_index=complexity_results.get("maintainability_index") if complexity_results else None,
                        total_lint_issues=total_lint if total_lint > 0 else None,
                        total_security_issues=total_sec if total_sec > 0 else None,
                        duplication_percentage=duplication_results.get("duplication_percentage"),
                        total_files_analyzed=len(all_source_files),
                        total_lines_of_code=complexity_results.get("sloc") if complexity_results else None,
                        per_language_metrics=per_language or None,
                        file_importance_index=importance_index or None,
                    )
                    db.add(report)
                else:
                    report.overall_score = score_results["overall_score"]
                    report.lint_score = score_results["lint_score"]
                    report.complexity_score = score_results["complexity_score"]
                    report.security_score = score_results["security_score"]
                    report.duplication_score = score_results["duplication_score"]
                    report.maintainability_index = complexity_results.get("maintainability_index") if complexity_results else None
                    report.total_lint_issues = total_lint if total_lint > 0 else None
                    report.total_security_issues = total_sec if total_sec > 0 else None
                    report.duplication_percentage = duplication_results.get("duplication_percentage")
                    report.total_files_analyzed = len(all_source_files)
                    report.total_lines_of_code = complexity_results.get("sloc") if complexity_results else None
                    report.per_language_metrics = per_language or None
                    report.file_importance_index = importance_index or None
                await db.commit()

            # ── Stage 8: Complete ─────────────────
            await checkpoint.save_stage("complete")
            run.status = "complete"
            run.completed_at = datetime.now(timezone.utc)
            await db.commit()

        except Exception as exc:
            run.status = "failed"
            run.error_message = str(exc)
            run.completed_at = datetime.now(timezone.utc)
            await db.commit()
            raise

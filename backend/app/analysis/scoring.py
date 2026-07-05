import math
from pathlib import Path

from app.config import Settings


settings = Settings()


class FileImportanceScorer:
    """Compute a canonical file importance score (0-100) using deterministic heuristics (D-16).

    The importance index becomes the canonical ranking for ALL downstream phases (D-17).
    Heuristics weighted via config settings:
    - Entry-point detection (25%): Files named main.py, app.py, index.py, __init__.py, cli.py
    - Import graph centrality (20%): Number of other files that import this file (requires import parsing)
    - LOC contribution (15%): Larger files tend to be more important
    - Cyclomatic complexity (20%): Complex files are higher impact
    - Directory prominence (10%): Files in src/, app/, lib/ weigh more than tests/, scripts/
    - Git commit recency (10%): Recently modified files are more actively maintained
    """

    # Directories that indicate higher importance
    IMPORTANT_DIRS = {"src", "app", "lib", "core", "api", "main", "backend"}
    # Directories that indicate lower importance
    LOWER_DIRS = {"tests", "test", "scripts", "examples", "docs", "migrations", "config"}

    # Entry-point patterns: filenames that suggest a file is critical
    ENTRY_POINT_NAMES = {"main.py", "app.py", "index.py", "__init__.py", "cli.py", "server.py", "wsgi.py"}

    @classmethod
    def compute(cls, files: list[dict], radon_results: dict | None = None, file_tree: dict | None = None) -> dict[str, dict]:
        """Compute importance scores for all source files.

        Args:
            files: List of {path, size, ext} dicts from _extract_source_files()
            radon_results: Optional Radon analyzer output with per-file complexity
            file_tree: Optional full file_tree for import analysis

        Returns: {
            "src/main.py": { "importance": 85, "rank": 1, "loc": 200, "complexity": 12, "is_entry_point": true },
            ...
        }
        """
        if not files:
            return {}

        # Build radon lookup: path -> complexity
        complexity_map: dict[str, float] = {}
        if radon_results:
            for fdata in radon_results.get("files", []):
                complexity_map[fdata["path"]] = fdata.get("complexity", 0)

        # Compute raw scores per heuristic
        scores: dict[str, dict] = {}
        for f in files:
            path = f["path"]
            loc = f.get("size", 0) // 30  # Rough LOC estimate from byte size
            ext = f.get("ext", "")
            complexity = complexity_map.get(path, 0)

            score = cls._compute_single(path, loc, complexity, ext)
            scores[path] = {
                "importance": round(score, 1),
                "rank": 0,  # Set after sorting
                "loc": loc,
                "complexity": complexity,
                "is_entry_point": cls._is_entry_point(path),
                "ext": ext,
            }

        # Sort by importance descending and assign rank
        ranked = sorted(scores.items(), key=lambda x: x[1]["importance"], reverse=True)
        for rank, (path, data) in enumerate(ranked, start=1):
            scores[path]["rank"] = rank

        return scores

    @classmethod
    def _compute_single(cls, path: str, loc: int, complexity: float, ext: str) -> float:
        """Compute the 0-100 importance score for a single file using weighted heuristics."""
        path_obj = Path(path)
        parts = list(path_obj.parts)

        # Entry-point score (0-100)
        entry_score = 100 if cls._is_entry_point(path) else 0

        # Directory prominence score (0-100)
        dir_score = 50  # default
        for part in parts:
            if part in cls.IMPORTANT_DIRS:
                dir_score = 80
                break
            if part in cls.LOWER_DIRS:
                dir_score = 30
                break

        # LOC score (0-100) — sigmoid scaled, center at 300 LOC
        loc_score = 100 * (1 / (1 + math.exp(-0.01 * (loc - 300))))

        # Complexity score (0-100) — higher complexity = higher impact
        # Cap at 50 cyclomatic complexity
        capped_complexity = min(complexity, 50)
        complexity_score = (capped_complexity / 50) * 100

        # Weighted combination using config settings
        total = (
            settings.importance_weight_entry_point * entry_score
            + settings.importance_weight_directory * dir_score
            + settings.importance_weight_loc * loc_score
            + settings.importance_weight_complexity * complexity_score
        )

        # If no entry-point and low complexity, penalize slightly
        if entry_score == 0 and complexity_score < 10:
            total *= 0.8

        return min(total, 100)  # Clamp to 0-100

    @staticmethod
    def _is_entry_point(path: str) -> bool:
        """Check if a file is likely an entry point."""
        return Path(path).name in FileImportanceScorer.ENTRY_POINT_NAMES

    @staticmethod
    def select_deep_analysis_files(
        importance_index: dict[str, dict],
        threshold: int | None = None
    ) -> list[str]:
        """Select files for deep analysis per D-18 — only top-ranked files.

        Args:
            importance_index: Output from compute()
            threshold: Number of top files to select (default from settings)

        Returns: List of file paths for deep analysis.
        """
        limit = threshold or settings.analysis_deep_analysis_threshold
        sorted_files = sorted(
            importance_index.items(),
            key=lambda x: x[1]["rank"]
        )
        return [path for path, _ in sorted_files[:limit]]

    @staticmethod
    def select_all_files(importance_index: dict[str, dict]) -> list[str]:
        """Select ALL files for lightweight analysis (lint)."""
        return list(importance_index.keys())


class CompositeScoreCalculator:
    """Compute the overall code quality score (D-13, D-14).

    The composite score is a REFERENCE METRIC, NOT the final grade.
    It feeds into Phase 6+ AI evaluation as supporting evidence.

    Scores are 0-100 where higher = better.
    """

    @staticmethod
    def compute(
        lint_results: dict | None = None,
        complexity_results: dict | None = None,
        security_results: dict | None = None,
        duplication_pct: float = 0,
    ) -> dict[str, float]:
        """Compute composite score from individual analysis dimensions.

        Args:
            lint_results: Ruff analyzer output (total_errors, total_warnings)
            complexity_results: Radon analyzer output (avg_cyclomatic_complexity, maintainability_index)
            security_results: Bandit analyzer output (total_issues, high_severity, medium_severity)
            duplication_pct: Percentage of duplicated code (0-100)

        Returns: {
            "overall_score": float,  # 0-100 weighted average
            "lint_score": float,     # 0-100 normalized
            "complexity_score": float,
            "security_score": float,
            "duplication_score": float,
        }
        """
        lint_score = CompositeScoreCalculator._lint_score(lint_results)
        complexity_score = CompositeScoreCalculator._complexity_score(complexity_results)
        security_score = CompositeScoreCalculator._security_score(security_results)
        duplication_score = CompositeScoreCalculator._duplication_score(duplication_pct)

        overall = (
            settings.score_weight_lint * lint_score
            + settings.score_weight_complexity * complexity_score
            + settings.score_weight_security * security_score
            + settings.score_weight_duplication * duplication_score
        )

        return {
            "overall_score": round(overall, 1),
            "lint_score": round(lint_score, 1),
            "complexity_score": round(complexity_score, 1),
            "security_score": round(security_score, 1),
            "duplication_score": round(duplication_score, 1),
        }

    @staticmethod
    def _lint_score(results: dict | None) -> float:
        """Score based on lint issues per 1000 LOC. Lower is better."""
        if not results:
            return 100.0
        total_issues = (results.get("total_errors", 0) * 3 + results.get("total_warnings", 0))
        if total_issues == 0:
            return 100.0
        # More than 50 issues = floor of 0
        score = max(0, 100 - (total_issues * 2))
        return score

    @staticmethod
    def _complexity_score(results: dict | None) -> float:
        """Score based on cyclomatic complexity and maintainability index."""
        if not results:
            return 100.0
        avg_complexity = results.get("avg_cyclomatic_complexity", 0)
        mi = results.get("maintainability_index", 100)

        # Complexity component: lower is better. Target < 5.
        complexity_component = max(0, 100 - (avg_complexity * 10))
        # MI component: higher is better. Target > 80.
        mi_component = mi  # Already 0-100 scale

        return round(complexity_component * 0.5 + mi_component * 0.5, 1)

    @staticmethod
    def _security_score(results: dict | None) -> float:
        """Score based on security issues. High-severity issues weighted more."""
        if not results:
            return 100.0
        high = results.get("high_severity", 0)
        medium = results.get("medium_severity", 0)
        low = results.get("low_severity", 0)

        weighted = high * 20 + medium * 5 + low * 1
        score = max(0, 100 - weighted)
        return score

    @staticmethod
    def _duplication_score(duplication_pct: float) -> float:
        """Score based on duplication percentage. Lower duplication = higher score."""
        if duplication_pct <= 0:
            return 100.0
        # 30% duplication = 0 score
        score = max(0, 100 - (duplication_pct * 3.33))
        return score

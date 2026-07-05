import asyncio
import json
import os
from pathlib import Path
from typing import Any


# ── Shared ─────────────────────────────────────────────

ANALYSIS_TIMEOUT = 300  # seconds per tool execution


async def _run_tool(
    cmd: list[str],
    timeout: int = ANALYSIS_TIMEOUT,
) -> tuple[str, str, int]:
    """Run a CLI tool via subprocess, return (stdout, stderr, returncode)."""
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
    except asyncio.TimeoutError:
        proc.kill()
        raise TimeoutError(f"Tool timed out after {timeout}s: {' '.join(cmd[:3])}...")
    return stdout.decode("utf-8", errors="replace"), stderr.decode("utf-8", errors="replace"), proc.returncode


def _is_analysis_ignored(path: Path) -> bool:
    """Extended ignore check per D-19. Includes generated, vendor, test, and binary files."""
    ignored_dirs = {
        ".git", "node_modules", "__pycache__", ".venv", "venv", ".next",
        "vendor", "third_party", ".eggs", "dist", "build", ".tox",
    }
    if any(part in ignored_dirs for part in path.parts):
        return True
    # Ignore test files (D-19)
    if path.name.startswith("test_") or path.name.endswith("_test.py") or path.name.endswith(".spec.ts"):
        return True
    if "tests" in path.parts or "test" in path.parts:
        return True
    # Ignore generated files
    if path.name.endswith(".pyc") or path.name.endswith(".pb.go"):
        return True
    # Ignore binary-ish extensions
    if path.suffix in {".ico", ".png", ".jpg", ".gif", ".svg", ".woff", ".woff2", ".eot", ".ttf"}:
        return True
    return False


def _extract_source_files(file_tree: dict, root: str = "") -> list[dict]:
    """Recursively extract source files from the snapshot file_tree (JSONB).

    Returns list of {path: str, size: int, ext: str} dicts.
    """
    files = []
    for key, value in file_tree.items():
        current_path = f"{root}/{key}" if root else key
        if isinstance(value, dict):
            if "size" in value:
                file_path = Path(current_path)
                if not _is_analysis_ignored(file_path):
                    files.append({
                        "path": current_path.replace("\\", "/"),
                        "size": value.get("size", 0),
                        "ext": value.get("ext", file_path.suffix),
                    })
            else:
                files.extend(_extract_source_files(value, current_path))
    return files


def _filter_by_language(files: list[dict], language_exts: set[str]) -> list[str]:
    """Filter files by extension set. For Python-first: {'.py'}."""
    return [f["path"] for f in files if f.get("ext", "") in language_exts]


# ── Ruff Analyzer ──────────────────────────────────────


class RuffAnalyzer:
    """Lightweight linter using ruff check (D-02). Runs on ALL source files per D-18."""

    SUPPORTED_EXTENSIONS = {".py"}

    @staticmethod
    async def analyze(files: list[str], repo_root: Path | str | None = None) -> dict[str, Any]:
        """Run ruff check on the given Python files. Returns structured metrics.

        Args:
            files: List of absolute or relative file paths.
            repo_root: Root directory for relative path resolution. If None, files must be absolute.

        Returns: {
            "total_errors": int, "total_warnings": int,
            "issues": [{ "file": str, "line": int, "code": str, "message": str, "severity": str }]
        }
        """
        if not files:
            return {"total_errors": 0, "total_warnings": 0, "issues": []}

        # ruff can accept file paths directly
        cmd = ["ruff", "check", *files, "--output-format", "json", "--quiet"]

        try:
            stdout, stderr, returncode = await _run_tool(cmd)
        except FileNotFoundError:
            # ruff not installed — return empty results
            return {"total_errors": 0, "total_warnings": 0, "issues": [], "error": "ruff not found"}
        except TimeoutError as e:
            return {"total_errors": 0, "total_warnings": 0, "issues": [], "error": str(e)}

        if not stdout.strip():
            # No issues found (ruff exits 0 with no output on clean code)
            return {"total_errors": 0, "total_warnings": 0, "issues": []}

        try:
            raw_issues = json.loads(stdout)
        except json.JSONDecodeError:
            return {"total_errors": 0, "total_warnings": 0, "issues": [], "error": "Failed to parse ruff output"}

        if not isinstance(raw_issues, list):
            raw_issues = [raw_issues]

        total_errors = 0
        total_warnings = 0
        issues = []

        for item in raw_issues:
            severity = "error" if item.get("fixable") is False else "warning"
            issue = {
                "file": item.get("filename", ""),
                "line": item.get("location", {}).get("row", 0) if isinstance(item.get("location"), dict) else item.get("line", 0),
                "code": item.get("code", ""),
                "message": item.get("message", ""),
                "severity": severity,
            }
            issues.append(issue)
            if severity == "error":
                total_errors += 1
            else:
                total_warnings += 1

        return {
            "total_errors": total_errors,
            "total_warnings": total_warnings,
            "issues": issues,
        }


# ── Radon Analyzer ─────────────────────────────────────


class RadonAnalyzer:
    """Complexity and maintainability metrics using radon (D-03).

    Runs on top-ranked files per D-18 (deep analysis mode).
    """

    SUPPORTED_EXTENSIONS = {".py"}

    @staticmethod
    async def analyze(files: list[str], repo_root: Path | str | None = None) -> dict[str, Any]:
        """Run radon on the given Python files. Returns structured metrics.

        Returns: {
            "avg_cyclomatic_complexity": float,
            "max_cyclomatic_complexity": int,
            "maintainability_index": float,
            "sloc": int,
            "files": [{ "path": str, "complexity": float, "mi": float, "sloc": int }]
        }
        """
        if not files:
            return {
                "avg_cyclomatic_complexity": 0,
                "max_cyclomatic_complexity": 0,
                "maintainability_index": 100,
                "sloc": 0,
                "files": [],
            }

        # Radon CC: cyclomatic complexity per function
        cc_results: list[dict] = []
        for f in files:
            try:
                stdout, _, _ = await _run_tool(["radon", "cc", f, "--json", "--min", "A"])
                if stdout.strip():
                    cc_data = json.loads(stdout)
                    for file_path, functions in cc_data.items():
                        for func in functions:
                            cc_results.append({
                                "path": file_path,
                                "function": func.get("name", ""),
                                "type": func.get("type", ""),
                                "complexity": func.get("complexity", 0),
                                "line": func.get("lineno", 0),
                            })
            except (FileNotFoundError, TimeoutError, json.JSONDecodeError):
                continue

        # Radon raw: SLOC metrics
        total_sloc = 0
        file_metrics = []
        for f in files:
            try:
                stdout, _, _ = await _run_tool(["radon", "raw", f, "--json"])
                if stdout.strip():
                    raw_data = json.loads(stdout)
                    for file_path, metrics in raw_data.items():
                        sloc = metrics.get("sloc", 0)
                        total_sloc += sloc
                        file_metrics.append({
                            "path": file_path,
                            "sloc": sloc,
                            "lloc": metrics.get("lloc", 0),
                            "comments": metrics.get("comments", 0),
                            "blank": metrics.get("blank", 0),
                        })
            except (FileNotFoundError, TimeoutError, json.JSONDecodeError):
                continue

        # Radon mi: maintainability index
        mi_sum = 0
        mi_count = 0
        mi_values = []
        for f in files:
            try:
                stdout, _, _ = await _run_tool(["radon", "mi", f, "--json", "--min", "A"])
                if stdout.strip():
                    mi_data = json.loads(stdout)
                    for file_path, scores in mi_data.items():
                        for item in scores:
                            mi = item.get("mi", 0)
                            mi_values.append({"path": file_path, "mi": mi})
                            mi_sum += mi
                            mi_count += 1
            except (FileNotFoundError, TimeoutError, json.JSONDecodeError):
                continue

        # Aggregate
        complexities = [c["complexity"] for c in cc_results]
        avg_complexity = sum(complexities) / len(complexities) if complexities else 0
        max_complexity = max(complexities) if complexities else 0
        avg_mi = mi_sum / mi_count if mi_count > 0 else 100.0

        # Per-file summary
        file_summaries = []
        seen_paths = set()
        for f in files:
            if f in seen_paths:
                continue
            seen_paths.add(f)
            file_complexities = [c["complexity"] for c in cc_results if c["path"] == f]
            file_mi = next((m["mi"] for m in mi_values if m["path"] == f), 100.0)
            file_sloc = next((m["sloc"] for m in file_metrics if m["path"] == f), 0)
            file_summaries.append({
                "path": f,
                "complexity": max(file_complexities) if file_complexities else 0,
                "avg_complexity": sum(file_complexities) / len(file_complexities) if file_complexities else 0,
                "mi": file_mi,
                "sloc": file_sloc,
            })

        return {
            "avg_cyclomatic_complexity": round(avg_complexity, 2),
            "max_cyclomatic_complexity": max_complexity,
            "maintainability_index": round(avg_mi, 2),
            "sloc": total_sloc,
            "files": file_summaries,
            "functions": cc_results,
        }


# ── Bandit Analyzer ────────────────────────────────────


class BanditAnalyzer:
    """Security vulnerability scanner using bandit (D-04).

    Runs on top-ranked files per D-18 (deep analysis mode).
    """

    SUPPORTED_EXTENSIONS = {".py"}

    @staticmethod
    async def analyze(files: list[str], repo_root: Path | str | None = None) -> dict[str, Any]:
        """Run bandit on the given Python files. Returns structured findings.

        Returns: {
            "total_issues": int,
            "high_severity": int, "medium_severity": int, "low_severity": int,
            "issues": [{ "file": str, "line": int, "test_id": str, "issue_text": str, "severity": str, "confidence": str }]
        }
        """
        if not files:
            return {"total_issues": 0, "high_severity": 0, "medium_severity": 0, "low_severity": 0, "issues": []}

        try:
            cmd = ["bandit", "-r", *files, "--format", "json", "--quiet"]
            if repo_root:
                cmd.extend(["--context", str(repo_root)])

            stdout, stderr, returncode = await _run_tool(cmd)
        except FileNotFoundError:
            return {"total_issues": 0, "high_severity": 0, "medium_severity": 0, "low_severity": 0, "issues": [], "error": "bandit not found"}
        except TimeoutError as e:
            return {"total_issues": 0, "high_severity": 0, "medium_severity": 0, "low_severity": 0, "issues": [], "error": str(e)}

        if not stdout.strip():
            return {"total_issues": 0, "high_severity": 0, "medium_severity": 0, "low_severity": 0, "issues": []}

        try:
            bandit_output = json.loads(stdout)
        except json.JSONDecodeError:
            return {"total_issues": 0, "high_severity": 0, "medium_severity": 0, "low_severity": 0, "issues": [], "error": "Failed to parse bandit output"}

        results = bandit_output.get("results", [])
        issues = []
        high, medium, low = 0, 0, 0

        for item in results:
            severity = item.get("issue_severity", "LOW").lower()
            if severity == "high":
                high += 1
            elif severity == "medium":
                medium += 1
            else:
                low += 1

            issues.append({
                "file": item.get("filename", ""),
                "line": item.get("line_number", 0),
                "test_id": item.get("test_id", ""),
                "issue_text": item.get("issue_text", ""),
                "severity": severity,
                "confidence": item.get("issue_confidence", "").lower(),
            })

        return {
            "total_issues": len(issues),
            "high_severity": high,
            "medium_severity": medium,
            "low_severity": low,
            "issues": issues,
        }


# ── Analyzer Registry ──────────────────────────────────


ANALYZER_REGISTRY: dict[str, type[RuffAnalyzer | RadonAnalyzer | BanditAnalyzer]] = {
    "ruff": RuffAnalyzer,
    "radon": RadonAnalyzer,
    "bandit": BanditAnalyzer,
}

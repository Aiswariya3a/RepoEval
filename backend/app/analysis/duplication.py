import hashlib
import re
from collections import defaultdict
from pathlib import Path
from typing import Any


class DuplicateDetector:
    """Detect code duplication using token n-gram fingerprinting.

    Approach: For each Python source file, extract significant tokens
    (identifiers, keywords, operators) and compute n-gram hashes.
    Files sharing a high proportion of n-gram hashes are considered duplicate.

    Returns a duplication percentage for the overall codebase.
    No external dependencies — pure Python, std-lib only.
    """

    # Number of tokens per n-gram
    NGRAM_SIZE = 5
    # Similarity threshold above which files are considered duplicates
    SIMILARITY_THRESHOLD = 0.7
    # Minimum file size (in tokens) for duplication checking
    MIN_TOKENS = 30

    @classmethod
    def detect(cls, files: list[dict], repo_root: Path | str | None = None) -> dict[str, Any]:
        """Run duplication detection across all files.

        Args:
            files: List of {path, ...} dicts from _extract_source_files()
            repo_root: Optional root directory for resolving file paths

        Returns: {
            "duplication_percentage": float,  # 0-100
            "duplicate_groups": [  # Groups of similar files
                { "files": ["path1", "path2"], "similarity": 0.85 }
            ],
            "analyzed_files": int,
            "duplicate_files": int,
        }
        """
        if not files:
            return {"duplication_percentage": 0, "duplicate_groups": [], "analyzed_files": 0, "duplicate_files": 0}

        # Only analyze Python files
        py_files = [f for f in files if f.get("ext", "") == ".py"]
        if not py_files:
            return {"duplication_percentage": 0, "duplicate_groups": [], "analyzed_files": 0, "duplicate_files": 0}

        # Compute n-gram fingerprints for each file
        fingerprints: dict[str, set[str]] = {}

        for f in py_files:
            file_path = Path(f["path"])
            fingerprints[str(file_path)] = set()

            # If repo_root is available, try to read the file
            content = None
            if repo_root:
                full_path = Path(repo_root) / file_path
                try:
                    if full_path.exists():
                        content = full_path.read_text(encoding="utf-8", errors="replace")
                except Exception:
                    pass

            if content:
                tokens = cls._tokenize(content)
                if len(tokens) >= cls.MIN_TOKENS:
                    fingerprints[str(file_path)] = cls._compute_ngrams(tokens)

        if not fingerprints:
            return {"duplication_percentage": 0, "duplicate_groups": [], "analyzed_files": 0, "duplicate_files": 0}

        # Pairwise similarity comparison
        analyzed = list(fingerprints.items())
        duplicate_groups = []
        duplicate_file_paths: set[str] = set()

        for i in range(len(analyzed)):
            for j in range(i + 1, len(analyzed)):
                path_a, grams_a = analyzed[i]
                path_b, grams_b = analyzed[j]

                if not grams_a or not grams_b:
                    continue

                similarity = cls._jaccard_similarity(grams_a, grams_b)
                if similarity >= cls.SIMILARITY_THRESHOLD:
                    duplicate_groups.append({
                        "files": [path_a, path_b],
                        "similarity": round(similarity, 2),
                    })
                    duplicate_file_paths.add(path_a)
                    duplicate_file_paths.add(path_b)

        # Calculate duplication percentage
        total_files = len(analyzed)
        duplicate_count = len(duplicate_file_paths)
        duplication_pct = (duplicate_count / total_files * 100) if total_files > 0 else 0

        return {
            "duplication_percentage": round(duplication_pct, 1),
            "duplicate_groups": duplicate_groups,
            "analyzed_files": total_files,
            "duplicate_files": duplicate_count,
        }

    @staticmethod
    def _tokenize(content: str) -> list[str]:
        """Extract significant tokens from source code."""
        # Remove comments and strings
        content = re.sub(r'#.*$', '', content, flags=re.MULTILINE)
        content = re.sub(r'"""[\s\S]*?"""', '', content)
        content = re.sub(r"'''[\s\S]*?'''", '', content)
        content = re.sub(r'"[^"]*"', '', content)
        content = re.sub(r"'[^']*'", '', content)

        # Extract Python tokens: identifiers, keywords, operators
        tokens = re.findall(r'[a-zA-Z_]\w*|[+\-*/=<>!&|^~%]', content)
        return [t for t in tokens if len(t) > 1 or not t.isalpha()]

    @staticmethod
    def _compute_ngrams(tokens: list[str]) -> set[str]:
        """Compute n-gram hashes from a token list."""
        ngrams: set[str] = set()
        for i in range(len(tokens) - DuplicateDetector.NGRAM_SIZE + 1):
            ngram = " ".join(tokens[i:i + DuplicateDetector.NGRAM_SIZE])
            ngrams.add(hashlib.md5(ngram.encode()).hexdigest())
        return ngrams

    @staticmethod
    def _jaccard_similarity(set_a: set[str], set_b: set[str]) -> float:
        """Compute Jaccard similarity between two sets of n-gram hashes."""
        if not set_a or not set_b:
            return 0.0
        intersection = len(set_a & set_b)
        union = len(set_a | set_b)
        return intersection / union if union > 0 else 0.0

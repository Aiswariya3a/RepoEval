
from githubkit import GitHub
from githubkit.exception import RateLimitExceeded

from app.ingestion.rate_limiter import RateLimiter


class GithubClient:
    """Authenticated GitHub API client using user OAuth token."""

    def __init__(self, access_token: str):
        self.token = access_token
        self.client = GitHub(self.token)
        self.rate_limiter = RateLimiter()

    async def get_repo_metadata(self, owner: str, name: str) -> dict:
        """Fetch repository metadata including description, default_branch, visibility, etc."""
        resp = await self.client.rest.repos.async_get(owner=owner, repo=name)
        self._check_rate_limit(resp)
        data = resp.parsed_data
        return {
            "description": data.description,
            "default_branch": data.default_branch,
            "visibility": data.visibility or "public",
            "topics": data.topics or [],
            "language": data.language,
        }

    async def get_languages(self, owner: str, name: str) -> dict[str, int]:
        """Fetch language byte counts. Returns dict like {'Python': 45000, 'JavaScript': 12000}."""
        resp = await self.client.rest.repos.async_list_languages(owner=owner, repo=name)
        self._check_rate_limit(resp)
        return resp.parsed_data  # type: ignore

    async def get_commits(
        self, owner: str, name: str, sha: str | None = None, per_page: int = 100, max_pages: int = 50
    ) -> list[dict]:
        """Fetch commit history with pagination."""
        commits = []
        page = 0
        async for resp in self.client.paginate(
            self.client.rest.repos.async_list_commits,
            owner=owner,
            repo=name,
            sha=sha,
            per_page=per_page,
        ):
            self._check_rate_limit(resp)
            page += 1
            for c in resp.parsed_data:
                commits.append({
                    "sha": c.sha,
                    "author": c.commit.author.name if c.commit.author else None,
                    "author_email": c.commit.author.email if c.commit.author else None,
                    "date": c.commit.author.date.isoformat() if c.commit.author else None,
                    "message": c.commit.message,
                })
            if page >= max_pages:
                break
        return commits

    async def get_pull_requests(
        self, owner: str, name: str, state: str = "all", per_page: int = 100, max_pages: int = 10
    ) -> list[dict]:
        """Fetch pull requests with pagination."""
        prs = []
        page = 0
        async for resp in self.client.paginate(
            self.client.rest.pulls.async_list,
            owner=owner,
            repo=name,
            state=state,
            per_page=per_page,
        ):
            self._check_rate_limit(resp)
            page += 1
            for pr in resp.parsed_data:
                prs.append({
                    "number": pr.number,
                    "title": pr.title,
                    "state": pr.state,
                    "created_at": pr.created_at.isoformat() if pr.created_at else None,
                    "merged_at": pr.merged_at.isoformat() if pr.merged_at else None,
                    "closed_at": pr.closed_at.isoformat() if pr.closed_at else None,
                    "user_login": pr.user.login if pr.user else None,
                    "additions": pr.additions,
                    "deletions": pr.deletions,
                    "changed_files": pr.changed_files,
                    "comments": pr.comments,
                    "review_comments": pr.review_comments,
                })
            if page >= max_pages:
                break
        return prs

    async def get_issues(
        self, owner: str, name: str, state: str = "all", per_page: int = 100, max_pages: int = 10
    ) -> list[dict]:
        """Fetch issues with pagination."""
        issues = []
        page = 0
        async for resp in self.client.paginate(
            self.client.rest.issues.async_list,
            owner=owner,
            repo=name,
            state=state,
            per_page=per_page,
        ):
            self._check_rate_limit(resp)
            page += 1
            for issue in resp.parsed_data:
                issues.append({
                    "number": issue.number,
                    "title": issue.title,
                    "state": issue.state,
                    "created_at": issue.created_at.isoformat() if issue.created_at else None,
                    "closed_at": issue.closed_at.isoformat() if issue.closed_at else None,
                    "user_login": issue.user.login if issue.user else None,
                    "labels": [lbl.name for lbl in (issue.labels or [])],
                    "comments": issue.comments,
                })
            if page >= max_pages:
                break
        return issues

    def _check_rate_limit(self, response) -> None:
        """Check GitHub API rate limit headers and pause if needed (D-37)."""
        headers = getattr(response, "headers", {})
        remaining = headers.get("x-ratelimit-remaining")
        reset_at = headers.get("x-ratelimit-reset")
        if remaining is not None:
            self.rate_limiter.update(int(remaining), int(reset_at) if reset_at else 0)
        if self.rate_limiter.is_exhausted():
            wait_seconds = self.rate_limiter.seconds_until_reset()
            raise RateLimitExceeded(
                f"Rate limit exhausted. Resets in {wait_seconds}s",
                response=response,
            )

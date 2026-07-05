import { fetchApi } from "@/lib/auth";

// ── Types ──────────────────────────────────────────────

export type IngestionStatus =
  | "pending"
  | "queued"
  | "fetching_metadata"
  | "cloning"
  | "analyzing"
  | "complete"
  | "failed"
  | "paused";

export interface IngestionStep {
  name: string;
  status: "pending" | "active" | "completed" | "failed" | "paused";
  duration_ms: number | null;
  progress_pct: number | null;
}

export interface Repo {
  id: string;
  project_id: string;
  owner: string;
  name: string;
  full_name: string;
  url: string;
  description: string | null;
  default_branch: string;
  visibility: string;
  languages: Record<string, number> | null;
  language_percentages: Record<string, number> | null;
  tech_stack: string[] | null;
  ingestion_status: IngestionStatus;
  snapshot_sha: string | null;
  created_at: string;
  updated_at: string;
}

export interface RepoStatusResponse {
  repo: Repo;
  steps: IngestionStep[];
  elapsed_seconds: number;
}

export interface RepoCreate {
  url: string;
}

// ── API Functions ──────────────────────────────────────

export function listProjectRepos(projectId: string): Promise<Repo[]> {
  return fetchApi<Repo[]>(`/api/projects/${projectId}/repos`);
}

export function addProjectRepo(
  projectId: string,
  url: string
): Promise<Repo> {
  return fetchApi<Repo>(`/api/projects/${projectId}/repos`, {
    method: "POST",
    body: JSON.stringify({ url } satisfies RepoCreate),
  });
}

export function removeProjectRepo(
  projectId: string,
  repoId: string
): Promise<void> {
  return fetchApi<void>(`/api/projects/${projectId}/repos/${repoId}`, {
    method: "DELETE",
  });
}

export function triggerIngestion(
  projectId: string,
  repoId: string
): Promise<Repo> {
  return fetchApi<Repo>(
    `/api/projects/${projectId}/repos/${repoId}/ingest`,
    { method: "POST" }
  );
}

export function retryIngestion(
  projectId: string,
  repoId: string
): Promise<Repo> {
  return fetchApi<Repo>(
    `/api/projects/${projectId}/repos/${repoId}/retry`,
    { method: "POST" }
  );
}

export function getRepoStatus(
  projectId: string,
  repoId: string
): Promise<RepoStatusResponse> {
  return fetchApi<RepoStatusResponse>(
    `/api/projects/${projectId}/repos/${repoId}/status`
  );
}

// ── Helpers ────────────────────────────────────────────

const GITHUB_URL_REGEX = /^https?:\/\/github\.com\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+/;

export function isValidGithubUrl(url: string): boolean {
  return GITHUB_URL_REGEX.test(url);
}

export function parseGithubUrl(url: string): {
  owner: string;
  name: string;
} | null {
  const match = url.match(/github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)/);
  if (!match) return null;
  return { owner: match[1], name: match[2] };
}

/** Get display label and color for aggregate analysis badge on project cards. */
export function getAggregateAnalysisLabel(
  status: "analyzed" | "partial" | "pending" | "running" | null
): { label: string; color: string; dotColor: string } | null {
  if (!status || status === "pending") return null;
  switch (status) {
    case "analyzed":
      return { label: "Analyzed", color: "text-[#10B981]", dotColor: "#10B981" };
    case "partial":
      return { label: "Partial", color: "text-[#F59E0B]", dotColor: "#F59E0B" };
    case "running":
      return { label: "Analyzing", color: "text-[#4F46E5]", dotColor: "#4F46E5" };
  }
}

/** Aggregate multiple repos' statuses per D-41 priority: failed > paused > in_progress > complete > pending */
export function aggregateStatus(
  repos: Repo[]
): IngestionStatus | null {
  if (repos.length === 0) return null;

  const inProgressStatuses: IngestionStatus[] = [
    "queued",
    "fetching_metadata",
    "cloning",
    "analyzing",
  ];

  let hasFailed = false;
  let hasPaused = false;
  let hasInProgress = false;
  let hasComplete = false;

  for (const r of repos) {
    if (r.ingestion_status === "failed") hasFailed = true;
    else if (r.ingestion_status === "paused") hasPaused = true;
    else if (inProgressStatuses.includes(r.ingestion_status))
      hasInProgress = true;
    else if (r.ingestion_status === "complete") hasComplete = true;
  }

  // Priority: failed > paused > in_progress > complete > pending
  if (hasFailed) return "failed";
  if (hasPaused) return "paused";
  if (hasInProgress) return "queued"; // Use "queued" as generic in_progress aggregate
  if (hasComplete) return "complete";
  return "pending";
}

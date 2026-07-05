import { fetchApi } from "@/lib/auth";

// ── Types ──────────────────────────────────────────────

export type AnalysisStatus =
  | "queued"
  | "analyzing_files"
  | "running_ruff"
  | "running_radon"
  | "running_bandit"
  | "computing_importance"
  | "computing_duplication"
  | "aggregating"
  | "complete"
  | "failed"
  | "pending"; // No analysis yet

export interface AnalysisStep {
  name: string;
  status: "pending" | "active" | "completed" | "failed";
  duration_ms: number | null;
  progress_pct: number | null;
}

export interface AnalysisRun {
  id: string;
  snapshot_id: string;
  status: AnalysisStatus;
  current_stage: string | null;
  error_message: string | null;
  total_files: number | null;
  analyzed_files: number | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface AnalysisStatusResponse {
  run: AnalysisRun;
  steps: AnalysisStep[];
  elapsed_seconds: number;
}

export interface CodeQualityReport {
  id: string;
  run_id: string;
  snapshot_id: string;
  overall_score: number | null;
  lint_score: number | null;
  complexity_score: number | null;
  security_score: number | null;
  duplication_score: number | null;
  maintainability_index: number | null;
  total_lint_issues: number | null;
  total_security_issues: number | null;
  duplication_percentage: number | null;
  total_files_analyzed: number | null;
  total_lines_of_code: number | null;
  per_language_metrics: Record<string, LanguageMetrics> | null;
  file_importance_index: Record<string, FileImportance> | null;
  created_at: string;
}

export interface LanguageMetrics {
  files: number;
  sloc: number;
  lint_issues: number;
  avg_complexity: number;
  mi: number;
}

export interface FileImportance {
  importance: number;
  rank: number;
  loc: number;
  complexity: number;
  is_entry_point: boolean;
  ext: string;
}

export interface ToolResult {
  id: string;
  run_id: string;
  tool_name: string;
  language: string;
  status: string;
  file_count: number | null;
  metrics: Record<string, unknown> | null;
  issues: unknown[] | null;
  duration_ms: number | null;
}

export interface AnalysisTriggerResponse {
  run_id: string;
  status: string;
  message: string;
}

// ── API Functions ──────────────────────────────────────

/** Trigger static analysis on the latest snapshot (D-06: manual trigger). */
export function triggerAnalysis(
  projectId: string,
  repoId: string
): Promise<AnalysisTriggerResponse> {
  return fetchApi<AnalysisTriggerResponse>(
    `/api/projects/${projectId}/repos/${repoId}/analysis`,
    { method: "POST" }
  );
}

/** Get analysis status with step data. Polling endpoint. */
export function getAnalysisStatus(
  projectId: string,
  repoId: string
): Promise<AnalysisStatusResponse> {
  return fetchApi<AnalysisStatusResponse>(
    `/api/projects/${projectId}/repos/${repoId}/analysis/status`
  );
}

/** Get the latest code quality report. */
export function getAnalysisResults(
  projectId: string,
  repoId: string
): Promise<CodeQualityReport | null> {
  return fetchApi<CodeQualityReport | null>(
    `/api/projects/${projectId}/repos/${repoId}/analysis/results`
  );
}

/** Get individual tool results for drill-down views. */
export function getToolResults(
  projectId: string,
  repoId: string
): Promise<ToolResult[]> {
  return fetchApi<ToolResult[]>(
    `/api/projects/${projectId}/repos/${repoId}/analysis/tool-results`
  );
}

// ── Helpers ────────────────────────────────────────────

/** Check if a status is terminal (polling should stop). */
export function isAnalysisTerminal(status: AnalysisStatus): boolean {
  return status === "complete" || status === "failed";
}

/** Check if analysis is in progress (status is a running stage, not queued). */
export function isAnalysisRunning(status: AnalysisStatus): boolean {
  const runningStatuses: AnalysisStatus[] = [
    "analyzing_files",
    "running_ruff",
    "running_radon",
    "running_bandit",
    "computing_importance",
    "computing_duplication",
    "aggregating",
  ];
  return runningStatuses.includes(status);
}

/** Format a score (0-100) as a display string with color class. */
export function formatScore(
  score: number | null | undefined
): { display: string; color: string } {
  if (score === null || score === undefined) {
    return { display: "—", color: "text-muted-foreground" };
  }
  const rounded = Math.round(score);
  let color: string;
  if (rounded >= 80) color = "text-[#10B981]"; // green
  else if (rounded >= 60) color = "text-[#F59E0B]"; // amber
  else if (rounded >= 40) color = "text-[#F97316]"; // orange
  else color = "text-[#EF4444]"; // red
  return { display: `${rounded}/100`, color };
}

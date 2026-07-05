"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Bug,
  Code,
  FileCode,
  GitBranch,
  Scale,
  Shield,
  TrendingUp,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  CodeQualityReport,
  LanguageMetrics,
  FileImportance,
} from "@/lib/api-analysis";
import { formatScore } from "@/lib/api-analysis";

// ── ScoreCard ────────────────────────────────────

function ScoreCard({
  label,
  score,
  icon: Icon,
}: {
  label: string;
  score: number | null | undefined;
  icon: React.ElementType;
}) {
  const { display, color } = formatScore(score);
  return (
    <div className="rounded-lg border border-border bg-card p-4 flex items-start gap-3">
      <div className="mt-0.5 rounded-md bg-muted p-2">
        <Icon className="size-4 text-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">
          {label}
        </p>
        <p className={`text-2xl font-bold mt-0.5 ${color}`}>{display}</p>
      </div>
    </div>
  );
}

// ── Tool Issues Panel ────────────────────────────

function ToolIssuesPanel({
  title,
  icon: Icon,
  count,
  issues,
  emptyText,
  toolColor,
}: {
  title: string;
  icon: React.ElementType;
  count: number | null | undefined;
  issues: { file: string; line: number; message: string; severity?: string }[];
  emptyText: string;
  toolColor: string;
}) {
  const [expanded, setExpanded] = useState(false);

  if (!count || count === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <Icon className={`size-4 ${toolColor}`} />
          <span className="text-sm font-medium">{title}</span>
          <span className="text-xs text-[#10B981] ml-auto">No issues found</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">{emptyText}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <button
        className="w-full flex items-center gap-2 p-4 hover:bg-muted/50 transition-colors text-left"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown className="size-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="size-4 text-muted-foreground shrink-0" />
        )}
        <Icon className={`size-4 ${toolColor}`} />
        <span className="text-sm font-medium">{title}</span>
        <span className={`text-xs ml-auto font-medium ${toolColor}`}>
          {count} issue{count !== 1 ? "s" : ""}
        </span>
      </button>
      {expanded && (
        <div className="border-t border-border px-4 pb-4 pt-2 max-h-64 overflow-y-auto">
          {issues.slice(0, 50).map((issue, i) => (
            <div
              key={i}
              className="py-1.5 border-b border-border/50 last:border-0 text-xs"
            >
              <span className="font-mono text-muted-foreground">
                {issue.file}:{issue.line}
              </span>
              {" — "}
              <span>{issue.message}</span>
            </div>
          ))}
          {issues.length > 50 && (
            <p className="text-xs text-muted-foreground mt-2">
              …and {issues.length - 50} more
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── File Importance Table ────────────────────────

function FileImportanceTable({
  files,
}: {
  files: Record<string, FileImportance> | null;
}) {
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 10;

  if (!files) return null;

  const entries = Object.entries(files).sort(
    (a, b) => a[1].rank - b[1].rank
  );
  const totalPages = Math.ceil(entries.length / PAGE_SIZE);
  const pageEntries = entries.slice(
    page * PAGE_SIZE,
    (page + 1) * PAGE_SIZE
  );

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
        <TrendingUp className="size-4 text-[#4F46E5]" />
        File Importance Ranking
      </h4>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted-foreground border-b border-border">
              <th className="text-left py-1.5 pr-2 font-medium">Rank</th>
              <th className="text-left py-1.5 pr-2 font-medium">File</th>
              <th className="text-right py-1.5 pr-2 font-medium">Score</th>
              <th className="text-right py-1.5 pr-2 font-medium">LOC</th>
              <th className="text-right py-1.5 font-medium">Entry</th>
            </tr>
          </thead>
          <tbody>
            {pageEntries.map(([path, data]) => (
              <tr key={path} className="border-b border-border/50">
                <td className="py-1.5 pr-2 text-muted-foreground">
                  #{data.rank}
                </td>
                <td className="py-1.5 pr-2 font-mono truncate max-w-[300px]">
                  {path}
                </td>
                <td className={`py-1.5 pr-2 text-right font-medium ${
                  data.importance >= 70
                    ? "text-[#10B981]"
                    : data.importance >= 40
                    ? "text-[#F59E0B]"
                    : "text-muted-foreground"
                }`}>
                  {Math.round(data.importance)}
                </td>
                <td className="py-1.5 pr-2 text-right text-muted-foreground">
                  {data.loc}
                </td>
                <td className="py-1.5 text-right">
                  {data.is_entry_point ? (
                    <span className="text-[#4F46E5]">●</span>
                  ) : (
                    <span className="text-muted-foreground/50">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3 pt-2 border-t border-border">
          <p className="text-xs text-muted-foreground">
            Page {page + 1} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ───────────────────────────────

export function AnalysisResultsDisplay({
  report,
  onReAnalyze,
  isAnalyzing,
}: {
  report: CodeQualityReport | null;
  onReAnalyze?: () => void;
  isAnalyzing?: boolean;
}) {
  if (!report) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-8 text-center">
        <Code className="size-8 mx-auto text-muted-foreground mb-3" />
        <h3 className="text-sm font-medium mb-1">No Analysis Yet</h3>
        <p className="text-xs text-muted-foreground max-w-md mx-auto">
          Run static analysis to generate code quality metrics including
          complexity scores, lint issues, and a composite quality score.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Title */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Code Quality Report</h3>
        {onReAnalyze && (
          <Button
            variant="outline"
            size="sm"
            onClick={onReAnalyze}
            disabled={isAnalyzing}
          >
            {isAnalyzing ? "Analyzing…" : "Re-analyze"}
          </Button>
        )}
      </div>

      {/* Overall Score + Dimension Scores */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <ScoreCard
          label="Overall"
          score={report.overall_score}
          icon={TrendingUp}
        />
        <ScoreCard
          label="Lint Quality"
          score={report.lint_score}
          icon={Code}
        />
        <ScoreCard
          label="Complexity"
          score={report.complexity_score}
          icon={GitBranch}
        />
        <ScoreCard
          label="Security"
          score={report.security_score}
          icon={Shield}
        />
        <ScoreCard
          label="Duplication"
          score={report.duplication_score}
          icon={Scale}
        />
      </div>

      {/* Metrics Summary Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Files Analyzed</p>
          <p className="text-lg font-semibold mt-0.5">
            {report.total_files_analyzed ?? "—"}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Lines of Code</p>
          <p className="text-lg font-semibold mt-0.5">
            {report.total_lines_of_code?.toLocaleString() ?? "—"}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Lint Issues</p>
          <p className="text-lg font-semibold mt-0.5">
            {report.total_lint_issues ?? "—"}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Security Issues</p>
          <p className="text-lg font-semibold mt-0.5">
            {report.total_security_issues ?? "—"}
          </p>
        </div>
      </div>

      {/* Per-Language Metrics */}
      {report.per_language_metrics && (
        <div className="rounded-lg border border-border bg-card p-4">
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
            <FileCode className="size-4 text-[#4F46E5]" />
            Per-Language Breakdown
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground border-b border-border">
                  <th className="text-left py-1.5 pr-3 font-medium">Language</th>
                  <th className="text-right py-1.5 pr-3 font-medium">Files</th>
                  <th className="text-right py-1.5 pr-3 font-medium">SLOC</th>
                  <th className="text-right py-1.5 pr-3 font-medium">Lint Issues</th>
                  <th className="text-right py-1.5 pr-3 font-medium">Avg Complexity</th>
                  <th className="text-right py-1.5 font-medium">MI</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(report.per_language_metrics).map(
                  ([lang, metrics]) => {
                    const m = metrics as LanguageMetrics;
                    return (
                      <tr key={lang} className="border-b border-border/50">
                        <td className="py-1.5 pr-3 font-medium capitalize">
                          {lang}
                        </td>
                        <td className="py-1.5 pr-3 text-right">{m.files}</td>
                        <td className="py-1.5 pr-3 text-right">
                          {m.sloc.toLocaleString()}
                        </td>
                        <td className="py-1.5 pr-3 text-right">{m.lint_issues}</td>
                        <td className="py-1.5 pr-3 text-right">
                          {m.avg_complexity.toFixed(1)}
                        </td>
                        <td className="py-1.5 text-right">{m.mi.toFixed(1)}</td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* File Importance Index */}
      <FileImportanceTable files={report.file_importance_index} />

      {/* Per-tool drill-downs (placeholder for tool-results data) */}
      <div className="space-y-2">
        <ToolIssuesPanel
          title="Lint Issues"
          icon={Code}
          count={report.total_lint_issues}
          issues={[]}
          emptyText="No lint issues found. Your code is clean!"
          toolColor="text-[#4F46E5]"
        />
        <ToolIssuesPanel
          title="Security Findings"
          icon={Bug}
          count={report.total_security_issues}
          issues={[]}
          emptyText="No security vulnerabilities detected."
          toolColor="text-[#EF4444]"
        />
      </div>

      {/* Adjudication Note (D-13) */}
      <div className="rounded-lg border border-border bg-muted/30 p-3">
        <p className="text-xs text-muted-foreground flex items-start gap-2">
          <AlertTriangle className="size-3.5 shrink-0 mt-0.5 text-[#F59E0B]" />
          <span>
            <strong>Reference metrics only.</strong> These scores are
            automatically generated from static analysis and serve as
            advisory evidence. The authoritative project evaluation is
            determined by the instructor-defined rubric (available in a
            future phase).
          </span>
        </p>
      </div>
    </div>
  );
}

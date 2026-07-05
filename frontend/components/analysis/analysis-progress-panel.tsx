"use client";

import { Check, Loader2, Circle, XCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import type { AnalysisStep, AnalysisStatus } from "@/lib/api-analysis";

const STEP_ICONS = {
  completed: Check,
  active: Loader2,
  pending: Circle,
  failed: XCircle,
} as const;

const STEP_COLORS = {
  completed: "text-[#10B981]",
  active: "text-[#4F46E5]",
  pending: "text-muted-foreground",
  failed: "text-[#EF4444]",
} as const;

export function AnalysisProgressPanel({
  repoName,
  status,
  steps,
  elapsedSeconds,
  error,
  analyzedFiles,
  totalFiles,
}: {
  repoName?: string;
  status: AnalysisStatus | null;
  steps: AnalysisStep[];
  elapsedSeconds: number;
  error?: string | null;
  analyzedFiles?: number | null;
  totalFiles?: number | null;
}) {
  if (!status || status === "pending") return null;

  const activeStep = steps.find((s) => s.status === "active");
  const progressPct =
    totalFiles && totalFiles > 0 && analyzedFiles !== null && analyzedFiles !== undefined
      ? Math.round((analyzedFiles / totalFiles) * 100)
      : null;

  function formatElapsed(seconds: number): string {
    if (seconds < 60) return `${Math.floor(seconds)}s`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}m ${secs}s`;
  }

  return (
    <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4">
      {/* Title */}
      <h4 className="text-sm font-medium mb-3">
        {repoName
          ? `Analysis Progress — ${repoName}`
          : "Analysis Progress"}
      </h4>

      {/* Step list */}
      <div className="space-y-2">
        {steps.map((step, index) => {
          const Icon = STEP_ICONS[step.status] || Circle;
          const colorClass = STEP_COLORS[step.status] || "text-muted-foreground";
          const isActive = step.status === "active";

          return (
            <div key={index}>
              <div className="flex items-center gap-2.5">
                <Icon
                  className={`size-4 shrink-0 ${colorClass} ${
                    isActive ? "animate-spin" : ""
                  }`}
                />
                <span className="text-sm text-foreground flex-1">
                  {step.name}
                </span>
                {step.duration_ms !== null && (
                  <span className="text-xs text-muted-foreground">
                    {(step.duration_ms / 1000).toFixed(1)}s
                  </span>
                )}
              </div>

              {/* Progress bar for enumerating files stage */}
              {isActive && progressPct !== null && step.name === "Enumerating Files" && (
                <div className="ml-6 mt-1">
                  <Progress value={progressPct} className="h-1.5" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* File processing status */}
      {status === "analyzing_files" && totalFiles && (
        <p className="mt-2 text-xs text-muted-foreground">
          Processing {analyzedFiles ?? 0} of {totalFiles} files…
        </p>
      )}

      {/* Error */}
      {error && (
        <p className="mt-2 text-xs text-destructive">{error}</p>
      )}

      {/* Waiting state */}
      {status === "queued" && !activeStep && (
        <p className="mt-2 text-xs text-muted-foreground italic">
          Waiting in queue…
        </p>
      )}

      {/* Timing footer */}
      {elapsedSeconds > 0 && (
        <div className="mt-3 pt-2 border-t border-border flex items-center gap-4 text-xs text-muted-foreground">
          <span>Elapsed: {formatElapsed(elapsedSeconds)}</span>
          {analyzedFiles !== null && analyzedFiles !== undefined && totalFiles && (
            <span>{analyzedFiles} / {totalFiles} files</span>
          )}
        </div>
      )}
    </div>
  );
}

export function AnalysisProgressSkeleton() {
  return (
    <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4 animate-pulse">
      <div className="h-4 w-44 rounded bg-muted mb-3" />
      <div className="space-y-3">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="flex items-center gap-2.5">
            <div className="size-4 rounded-full bg-muted" />
            <div className="h-3 w-36 rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}

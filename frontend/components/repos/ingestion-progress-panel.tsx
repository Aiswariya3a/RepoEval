"use client";

import { Check, Loader2, Circle, XCircle, PauseCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import type { IngestionStep, IngestionStatus } from "@/lib/api-repos";

const STEP_ICONS = {
  completed: Check,
  active: Loader2,
  pending: Circle,
  failed: XCircle,
  paused: PauseCircle,
} as const;

const STEP_COLORS = {
  completed: "text-[#10B981]",
  active: "text-[#4F46E5]",
  pending: "text-muted-foreground",
  failed: "text-[#EF4444]",
  paused: "text-[#F59E0B]",
} as const;

export function IngestionProgressPanel({
  repoName,
  status,
  steps,
  elapsedSeconds,
  error,
}: {
  repoName?: string;
  status: IngestionStatus | null;
  steps: IngestionStep[];
  elapsedSeconds: number;
  error?: string | null;
}) {
  if (!status) return null;

  // Find the active step to show its progress bar (only for "cloning")
  const activeStep = steps.find((s) => s.status === "active");

  function formatDuration(ms: number | null): string | null {
    if (ms === null) return null;
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  }

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
          ? `Ingestion Progress — ${repoName}`
          : "Ingestion Progress"}
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
                    {formatDuration(step.duration_ms)}
                  </span>
                )}
              </div>

              {/* Progress bar (cloning step only) */}
              {isActive && step.progress_pct !== null && (
                <div className="ml-6 mt-1">
                  <Progress
                    value={step.progress_pct}
                    className="h-1.5"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Error message */}
      {error && (
        <p className="mt-2 text-xs text-destructive">{error}</p>
      )}

      {/* Rate limit warning */}
      {status === "paused" && (
        <p className="mt-2 text-xs text-[#F59E0B]">
          GitHub API rate limit reached. Ingestion will resume
          automatically.
        </p>
      )}

      {/* Polling error */}
      {status === "queued" && !activeStep && (
        <p className="mt-2 text-xs text-muted-foreground italic">
          Waiting in queue…
        </p>
      )}

      {/* Timing footer */}
      {elapsedSeconds > 0 && (
        <div className="mt-3 pt-2 border-t border-border flex items-center gap-4 text-xs text-muted-foreground">
          <span>Elapsed: {formatElapsed(elapsedSeconds)}</span>
        </div>
      )}
    </div>
  );
}

// Skeleton loading variant
export function IngestionProgressSkeleton() {
  return (
    <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4 animate-pulse">
      <div className="h-4 w-40 rounded bg-muted mb-3" />
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-2.5">
            <div className="size-4 rounded-full bg-muted" />
            <div className="h-3 w-32 rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}

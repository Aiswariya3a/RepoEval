"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { AnalysisStatus } from "@/lib/api-analysis";
import { isAnalysisRunning } from "@/lib/api-analysis";

export function AnalyzeButton({
  repoId,
  status,
  onAnalyze,
  disabled = false,
}: {
  repoId: string;
  status: AnalysisStatus | null;
  onAnalyze: (repoId: string) => Promise<void>;
  disabled?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmAction, setConfirmAction] = useState<
    "reanalyze" | "retry" | null
  >(null);

  const running = status ? isAnalysisRunning(status) : false;
  const isPending = !status || status === "pending";
  const isComplete = status === "complete";
  const isFailed = status === "failed";

  async function handleClick() {
    if (running) return;

    if (isComplete) {
      setConfirmAction("reanalyze");
      setShowConfirm(true);
      return;
    }

    if (isFailed) {
      setConfirmAction("retry");
      setShowConfirm(true);
      return;
    }

    // pending or queued — start analysis
    setLoading(true);
    try {
      await onAnalyze(repoId);
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    setShowConfirm(false);
    setLoading(true);
    try {
      await onAnalyze(repoId);
    } finally {
      setLoading(false);
    }
  }

  // ── States ───────────────────────────────────────

  if (running) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <span tabIndex={0}>
              <Button disabled className="cursor-not-allowed">
                <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                Analyzing…
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>Static analysis in progress</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (isComplete) {
    return (
      <>
        <Button
          variant="default"
          onClick={handleClick}
          disabled={disabled || loading}
          className="bg-[#10B981] hover:bg-[#10B981]/80 text-white"
        >
          {loading ? (
            <>
              <Loader2 className="size-3.5 mr-1.5 animate-spin" />
              Re-analyzing…
            </>
          ) : (
            "Re-analyze"
          )}
        </Button>
        {showConfirm && confirmAction === "reanalyze" && (
          <ReAnalyzeConfirmDialog
            onConfirm={handleConfirm}
            onCancel={() => setShowConfirm(false)}
          />
        )}
      </>
    );
  }

  if (isFailed) {
    return (
      <>
        <Button
          variant="destructive"
          onClick={handleClick}
          disabled={disabled || loading}
        >
          {loading ? (
            <>
              <Loader2 className="size-3.5 mr-1.5 animate-spin" />
              Retrying…
            </>
          ) : (
            "Retry Analysis"
          )}
        </Button>
        {showConfirm && confirmAction === "retry" && (
          <RetryAnalysisConfirmDialog
            onConfirm={handleConfirm}
            onCancel={() => setShowConfirm(false)}
          />
        )}
      </>
    );
  }

  // Default: pending / queued
  return (
    <Button
      variant="default"
      onClick={handleClick}
      disabled={disabled || loading}
    >
      {loading ? (
        <>
          <Loader2 className="size-3.5 mr-1.5 animate-spin" />
          Starting…
        </>
      ) : (
        "Run Analysis"
      )}
    </Button>
  );
}

// ── Confirmation Dialogs ──────────────────────────

function ReAnalyzeConfirmDialog({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg">
        <h3 className="text-lg font-semibold mb-2">
          Re-analyze Repository
        </h3>
        <p className="text-sm text-muted-foreground mb-6">
          This will re-run static analysis on the current snapshot.
          Previous results will be preserved in history. Continue?
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="default" onClick={onConfirm}>
            Re-analyze
          </Button>
        </div>
      </div>
    </div>
  );
}

function RetryAnalysisConfirmDialog({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg">
        <h3 className="text-lg font-semibold mb-2">
          Retry Analysis
        </h3>
        <p className="text-sm text-muted-foreground mb-6">
          This will resume analysis from the last successful checkpoint.
          Continue?
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Retry
          </Button>
        </div>
      </div>
    </div>
  );
}

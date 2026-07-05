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
import type { IngestionStatus } from "@/lib/api-repos";

export function IngestButton({
  repoId,
  status,
  onIngest,
  disabled = false,
}: {
  repoId: string;
  status: IngestionStatus;
  onIngest: (repoId: string) => Promise<void>;
  disabled?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmAction, setConfirmAction] = useState<
    "reingest" | "retry" | null
  >(null);

  const isRunning =
    status === "queued" ||
    status === "fetching_metadata" ||
    status === "cloning" ||
    status === "analyzing";

  async function handleClick() {
    if (isRunning) return;

    if (status === "complete") {
      setConfirmAction("reingest");
      setShowConfirm(true);
      return;
    }

    if (status === "failed" || status === "paused") {
      setConfirmAction("retry");
      setShowConfirm(true);
      return;
    }

    // pending — start ingestion
    setLoading(true);
    try {
      await onIngest(repoId);
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    setShowConfirm(false);
    setLoading(true);
    try {
      await onIngest(repoId);
    } finally {
      setLoading(false);
    }
  }

  // ── Button rendering ────────────────────────────

  if (isRunning) {
    return (
      <TooltipProvider>
        <Tooltip>
              <TooltipTrigger>
                <span tabIndex={0}>
                  <Button disabled className="cursor-not-allowed">
                    <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                    Ingesting…
                  </Button>
                </span>
              </TooltipTrigger>
          <TooltipContent>
            <p>Ingestion already in progress</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (status === "complete") {
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
              Re-ingesting…
            </>
          ) : (
            "Re-ingest"
          )}
        </Button>
        {showConfirm && confirmAction === "reingest" && (
          <ReIngestConfirmDialog
            onConfirm={handleConfirm}
            onCancel={() => setShowConfirm(false)}
          />
        )}
      </>
    );
  }

  if (status === "failed" || status === "paused") {
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
            "Retry"
          )}
        </Button>
        {showConfirm && confirmAction === "retry" && (
          <RetryConfirmDialog
            onConfirm={handleConfirm}
            onCancel={() => setShowConfirm(false)}
          />
        )}
      </>
    );
  }

  // Default: pending
  return (
    <Button
      variant="default"
      onClick={handleClick}
      disabled={disabled || loading}
    >
      {loading ? (
        <>
          <Loader2 className="size-3.5 mr-1.5 animate-spin" />
          Ingesting…
        </>
      ) : (
        "Ingest Repository"
      )}
    </Button>
  );
}

// ── Confirmation Dialogs ──────────────────────────

function ReIngestConfirmDialog({
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
          Re-ingest Repository
        </h3>
        <p className="text-sm text-muted-foreground mb-6">
          This will create a new snapshot of the repository while preserving
          existing evaluations. Continue?
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="default" onClick={onConfirm}>
            Re-ingest
          </Button>
        </div>
      </div>
    </div>
  );
}

function RetryConfirmDialog({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg">
        <h3 className="text-lg font-semibold mb-2">Retry Ingestion</h3>
        <p className="text-sm text-muted-foreground mb-6">
          This will resume ingestion from the last successful checkpoint.
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

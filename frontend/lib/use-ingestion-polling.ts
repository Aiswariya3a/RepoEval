"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getRepoStatus } from "@/lib/api-repos";
import type { IngestionStatus, IngestionStep } from "@/lib/api-repos";

const POLL_INTERVAL_MS = 3000;
const BACKOFF_INTERVAL_MS = 5000;
const TERMINAL_STATUSES: IngestionStatus[] = [
  "complete",
  "failed",
  "paused",
];

export interface PollingState {
  status: IngestionStatus | null;
  steps: IngestionStep[];
  elapsedSeconds: number;
  error: string | null;
  isLoading: boolean;
}

export function useIngestionPolling(
  projectId: string | null,
  repoId: string | null,
  enabled: boolean
): PollingState & { refetch: () => void } {
  const [state, setState] = useState<PollingState>({
    status: null,
    steps: [],
    elapsedSeconds: 0,
    error: null,
    isLoading: false,
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const fetchStatus = useCallback(async () => {
    if (!projectId || !repoId) return;

    setState((prev) => ({ ...prev, isLoading: true }));
    try {
      const data = await getRepoStatus(projectId, repoId);
      if (!mountedRef.current) return;
      setState({
        status: data.repo.ingestion_status,
        steps: data.steps,
        elapsedSeconds: data.elapsed_seconds,
        error: null,
        isLoading: false,
      });
    } catch (err) {
      if (!mountedRef.current) return;
      setState((prev) => ({
        ...prev,
        error:
          err instanceof Error
            ? err.message
            : "Unable to fetch status updates. Retrying…",
        isLoading: false,
      }));
    }
  }, [projectId, repoId]);

  const refetch = useCallback(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    mountedRef.current = true;

    if (!enabled || !projectId || !repoId) {
      setState({
        status: null,
        steps: [],
        elapsedSeconds: 0,
        error: null,
        isLoading: false,
      });
      return;
    }

    // Initial fetch
    fetchStatus();

    // Poll at interval (D-43: REST polling)
    intervalRef.current = setInterval(async () => {
      await fetchStatus();

      // Check if we should stop polling on terminal status
      setState((prev) => {
        if (
          prev.status &&
          TERMINAL_STATUSES.includes(prev.status) &&
          intervalRef.current
        ) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        return prev;
      });
    }, POLL_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [projectId, repoId, enabled, fetchStatus]);

  // Adjust polling on error — switch to backoff interval
  useEffect(() => {
    if (state.error && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = setInterval(fetchStatus, BACKOFF_INTERVAL_MS);
    }
  }, [state.error, fetchStatus]);

  return { ...state, refetch };
}

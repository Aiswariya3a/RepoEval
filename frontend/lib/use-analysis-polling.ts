"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getAnalysisStatus } from "@/lib/api-analysis";
import type { AnalysisStatus, AnalysisStep } from "@/lib/api-analysis";
import { isAnalysisTerminal } from "@/lib/api-analysis";

const POLL_INTERVAL_MS = 3000;
const BACKOFF_INTERVAL_MS = 5000;

export interface AnalysisPollingState {
  status: AnalysisStatus | null;
  steps: AnalysisStep[];
  elapsedSeconds: number;
  error: string | null;
  isLoading: boolean;
}

export function useAnalysisPolling(
  projectId: string | null,
  repoId: string | null,
  enabled: boolean
): AnalysisPollingState & { refetch: () => void } {
  const [state, setState] = useState<AnalysisPollingState>({
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
      const data = await getAnalysisStatus(projectId, repoId);
      if (!mountedRef.current) return;
      setState({
        status: data.run.status,
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
            : "Unable to fetch analysis status. Retrying…",
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

    // Poll at interval
    intervalRef.current = setInterval(async () => {
      await fetchStatus();

      // Stop polling on terminal status
      setState((prev) => {
        if (
          prev.status &&
          isAnalysisTerminal(prev.status) &&
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

  // Backoff on error
  useEffect(() => {
    if (state.error && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = setInterval(fetchStatus, BACKOFF_INTERVAL_MS);
    }
  }, [state.error, fetchStatus]);

  return { ...state, refetch };
}

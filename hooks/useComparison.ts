// hooks/useComparison.ts

import { useState, useEffect, useCallback } from "react";
import {
  fetchFeedersSource,
  fetchFeederComparison
} from "@/lib/api/services/comparisonService";
import { FeederComparisonResult, FeedersSourceResponse } from "@/lib/types/comparison";


interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook : useFeedersSource
// Charge tous les feeders avec leur poste source
// ─────────────────────────────────────────────────────────────────────────────

export function useFeedersSource() {
  const [state, setState] = useState<AsyncState<FeedersSourceResponse>>({
    data: null,
    loading: true,
    error: null,
  });

  const load = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const data = await fetchFeedersSource();
      setState({ data, loading: false, error: null });
    } catch (err) {
      setState({
        data: null,
        loading: false,
        error: err instanceof Error ? err.message : "Erreur inconnue",
      });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return {
    feeders: state.data?.feeders ?? [],
    count: state.data?.count ?? 0,
    loading: state.loading,
    error: state.error,
    refresh: load,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook : useFeederComparison
// Charge la comparaison pour un feeder spécifique
// ─────────────────────────────────────────────────────────────────────────────

export function useFeederComparison(feederId: string | null | undefined) {
  const [state, setState] = useState<AsyncState<FeederComparisonResult>>({
    data: null,
    loading: false,
    error: null,
  });

  const load = useCallback(async (id: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const data = await fetchFeederComparison(id);
      setState({ data, loading: false, error: null });
    } catch (err) {
      setState({
        data: null,
        loading: false,
        error: err instanceof Error ? err.message : "Erreur inconnue",
      });
    }
  }, []);

  useEffect(() => {
    if (feederId) {
      load(feederId);
    } else {
      setState({ data: null, loading: false, error: null });
    }
  }, [feederId, load]);

  return {
    result: state.data,
    summary: state.data?.summary,
    tables: state.data?.tables,
    loading: state.loading,
    error: state.error,
    refresh: () => feederId && load(feederId),
  };
}
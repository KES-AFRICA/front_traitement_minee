// hooks/useComparison.ts
import { useState, useEffect, useCallback, useRef } from "react";
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
// Cache global en mémoire — persiste tant que l'onglet reste ouvert
// TTL : 24 heures
// ─────────────────────────────────────────────────────────────────────────────
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

interface CacheEntry<T> {
  data: T;
  cachedAt: number; // timestamp ms
}

const comparisonCache = new Map<string, CacheEntry<FeederComparisonResult>>();

function getCached(id: string): FeederComparisonResult | null {
  const entry = comparisonCache.get(id);
  if (!entry) return null;
  const age = Date.now() - entry.cachedAt;
  if (age > CACHE_TTL_MS) {
    comparisonCache.delete(id); // expiré
    return null;
  }
  return entry.data;
}

function setCached(id: string, data: FeederComparisonResult) {
  comparisonCache.set(id, { data, cachedAt: Date.now() });
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook : useFeedersSource
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
// ─────────────────────────────────────────────────────────────────────────────
export function useFeederComparison(feederId: string | null | undefined) {
  const [state, setState] = useState<AsyncState<FeederComparisonResult>>({
    data: null,
    loading: false,
    error: null,
  });

  // Pour savoir à quand remonte le cache affiché
  const [cachedAt, setCachedAt] = useState<number | null>(null);

  // Évite les race conditions si on change de feeder rapidement
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async (id: string, forceRefresh = false) => {
    // Vérifie le cache sauf si refresh forcé
    if (!forceRefresh) {
      const cached = getCached(id);
      if (cached) {
        setState({ data: cached, loading: false, error: null });
        setCachedAt(comparisonCache.get(id)!.cachedAt);
        return; // ← on sort, pas d'appel API
      }
    }

    // Annule la requête précédente si encore en cours
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const data = await fetchFeederComparison(id);
      setCached(id, data);
      setCachedAt(Date.now());
      setState({ data, loading: false, error: null });
    } catch (err) {
      if ((err as Error).name === "AbortError") return; // requête annulée, on ignore
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
      setCachedAt(null);
    }
  }, [feederId, load]);

  // Refresh manuel (bouton "Actualiser")
  const refresh = useCallback(() => {
    if (feederId) load(feederId, true); // forceRefresh = true
  }, [feederId, load]);

  return {
    result: state.data,
    summary: state.data?.summary,
    tables: state.data?.tables,
    loading: state.loading,
    error: state.error,
    cachedAt,          // timestamp pour afficher "Données du JJ/MM à HH:MM"
    refresh,
  };
}
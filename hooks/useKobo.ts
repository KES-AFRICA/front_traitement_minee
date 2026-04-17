// ─── hooks/useKobo.ts ─────────────────────────────────────────────────────────

import { fetchPosteDetail, fetchPostesMap } from "@/lib/api/services/koboService";
import { PosteDetail, PostesMapResponse } from "@/lib/types/kobo";
import { useState, useEffect, useCallback, useRef } from "react";
import { fetchWiresMap, fetchWireDetail } from "@/lib/api/services/koboService";
import { WiresMapResponse, WireDetail } from "@/lib/types/kobo";

// ── Constantes cache ──────────────────────────────────────────────────────────
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 heures

const CACHE_KEYS = {
  postesMap:  "kobo_cache_postes_map",
  wiresMap:   "kobo_cache_wires_map",
  posteDetail: (id: string) => `kobo_cache_poste_${id}`,
  wireDetail:  (id: number) => `kobo_cache_wire_${id}`,
};

// ── Helpers cache localStorage ────────────────────────────────────────────────
interface CacheEntry<T> {
  data:      T;
  expiresAt: number;
}

function cacheGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (Date.now() > entry.expiresAt) {
      localStorage.removeItem(key);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

function cacheSet<T>(key: string, data: T): void {
  try {
    const entry: CacheEntry<T> = {
      data,
      expiresAt: Date.now() + CACHE_TTL_MS,
    };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // localStorage plein ou indisponible → on ignore silencieusement
  }
}

function cacheClear(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch { /* ignore */ }
}

// ── État générique asynchrone ─────────────────────────────────────────────────
interface AsyncState<T> {
  data:    T | null;
  loading: boolean;
  error:   string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook 1 : usePostesMap
// Cache localStorage 24h. refresh() force le rechargement (bouton urgence).
// ─────────────────────────────────────────────────────────────────────────────
export function usePostesMap() {
  const [state, setState] = useState<AsyncState<PostesMapResponse>>({
    data:    null,
    loading: true,
    error:   null,
  });

  const load = useCallback(async (force = false) => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    // Cache hit (sauf si force)
    if (!force) {
      const cached = cacheGet<PostesMapResponse>(CACHE_KEYS.postesMap);
      if (cached) {
        setState({ data: cached, loading: false, error: null });
        return;
      }
    }

    try {
      const data = await fetchPostesMap();
      cacheSet(CACHE_KEYS.postesMap, data);
      setState({ data, loading: false, error: null });
    } catch (err) {
      setState({
        data:    null,
        loading: false,
        error:   err instanceof Error ? err.message : "Erreur inconnue",
      });
    }
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  // refresh() = bouton urgence → force=true, invalide le cache
  const refresh = useCallback(() => {
    cacheClear(CACHE_KEYS.postesMap);
    load(true);
  }, [load]);

  return {
    postes:  state.data?.postes ?? [],
    count:   state.data?.count  ?? 0,
    loading: state.loading,
    error:   state.error,
    refresh,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook 2 : usePosteDetail
// Cache localStorage 24h par substationId.
// ─────────────────────────────────────────────────────────────────────────────
export function usePosteDetail(substationId: string | null | undefined) {
  const [state, setState] = useState<AsyncState<PosteDetail>>({
    data:    null,
    loading: false,
    error:   null,
  });

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!substationId) {
      setState({ data: null, loading: false, error: null });
      return;
    }

    const cached = cacheGet<PosteDetail>(CACHE_KEYS.posteDetail(substationId));
    if (cached) {
      setState({ data: cached, loading: false, error: null });
      return;
    }

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setState(prev => ({ ...prev, loading: true, error: null }));

    fetchPosteDetail(substationId)
      .then(data => {
        cacheSet(CACHE_KEYS.posteDetail(substationId), data);
        setState({ data, loading: false, error: null });
      })
      .catch(err => {
        if (err instanceof Error && err.name === "AbortError") return;
        setState({
          data:    null,
          loading: false,
          error:   err instanceof Error ? err.message : "Erreur inconnue",
        });
      });

    return () => {
      abortRef.current?.abort();
    };
  }, [substationId]);

  return {
    poste:   state.data,
    loading: state.loading,
    error:   state.error,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook 3 : usePosteDetailLazy
// Cache localStorage 24h. fetch() vérifie le cache avant de requêter.
// ─────────────────────────────────────────────────────────────────────────────
export function usePosteDetailLazy() {
  const [state, setState] = useState<AsyncState<PosteDetail>>({
    data:    null,
    loading: false,
    error:   null,
  });

  const fetch = useCallback(async (substationId: string) => {
    if (!substationId) return;

    const cached = cacheGet<PosteDetail>(CACHE_KEYS.posteDetail(substationId));
    if (cached) {
      setState({ data: cached, loading: false, error: null });
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const data = await fetchPosteDetail(substationId);
      cacheSet(CACHE_KEYS.posteDetail(substationId), data);
      setState({ data, loading: false, error: null });
    } catch (err) {
      setState({
        data:    null,
        loading: false,
        error:   err instanceof Error ? err.message : "Erreur inconnue",
      });
    }
  }, []);

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);

  return {
    poste:   state.data,
    loading: state.loading,
    error:   state.error,
    fetch,
    reset,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook 4 : useWiresMap
// Cache localStorage 24h. refresh() force le rechargement (bouton urgence).
// ─────────────────────────────────────────────────────────────────────────────
export function useWiresMap() {
  const [state, setState] = useState<AsyncState<WiresMapResponse>>({
    data:    null,
    loading: true,
    error:   null,
  });

  const load = useCallback(async (force = false) => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    if (!force) {
      const cached = cacheGet<WiresMapResponse>(CACHE_KEYS.wiresMap);
      if (cached) {
        setState({ data: cached, loading: false, error: null });
        return;
      }
    }

    try {
      const data = await fetchWiresMap();
      cacheSet(CACHE_KEYS.wiresMap, data);
      setState({ data, loading: false, error: null });
    } catch (err) {
      setState({
        data:    null,
        loading: false,
        error:   err instanceof Error ? err.message : "Erreur inconnue",
      });
    }
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  const refresh = useCallback(() => {
    cacheClear(CACHE_KEYS.wiresMap);
    load(true);
  }, [load]);

  return {
    wires:   state.data?.wires ?? [],
    count:   state.data?.count  ?? 0,
    loading: state.loading,
    error:   state.error,
    refresh,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook 5 : useWireDetail
// Cache localStorage 24h par wireId.
// ─────────────────────────────────────────────────────────────────────────────
export function useWireDetail(wireId: number | null | undefined) {
  const [state, setState] = useState<AsyncState<WireDetail>>({
    data:    null,
    loading: false,
    error:   null,
  });

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!wireId) {
      setState({ data: null, loading: false, error: null });
      return;
    }

    const cached = cacheGet<WireDetail>(CACHE_KEYS.wireDetail(wireId));
    if (cached) {
      setState({ data: cached, loading: false, error: null });
      return;
    }

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setState(prev => ({ ...prev, loading: true, error: null }));

    fetchWireDetail(wireId)
      .then(data => {
        cacheSet(CACHE_KEYS.wireDetail(wireId), data);
        setState({ data, loading: false, error: null });
      })
      .catch(err => {
        if (err instanceof Error && err.name === "AbortError") return;
        setState({
          data:    null,
          loading: false,
          error:   err instanceof Error ? err.message : "Erreur inconnue",
        });
      });

    return () => {
      abortRef.current?.abort();
    };
  }, [wireId]);

  return {
    wire:    state.data,
    loading: state.loading,
    error:   state.error,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook 6 : useWireDetailLazy
// Cache localStorage 24h. fetch() vérifie le cache avant de requêter.
// ─────────────────────────────────────────────────────────────────────────────
export function useWireDetailLazy() {
  const [state, setState] = useState<AsyncState<WireDetail>>({
    data:    null,
    loading: false,
    error:   null,
  });

  const fetch = useCallback(async (wireId: number) => {
    if (!wireId) return;

    const cached = cacheGet<WireDetail>(CACHE_KEYS.wireDetail(wireId));
    if (cached) {
      setState({ data: cached, loading: false, error: null });
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const data = await fetchWireDetail(wireId);
      cacheSet(CACHE_KEYS.wireDetail(wireId), data);
      setState({ data, loading: false, error: null });
    } catch (err) {
      setState({
        data:    null,
        loading: false,
        error:   err instanceof Error ? err.message : "Erreur inconnue",
      });
    }
  }, []);

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);

  return {
    wire:    state.data,
    loading: state.loading,
    error:   state.error,
    fetch,
    reset,
  };
}
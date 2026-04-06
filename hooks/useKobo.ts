// ─── hooks/useKobo.ts ─────────────────────────────────────────────────────────

import { fetchPosteDetail, fetchPostesMap } from "@/lib/api/services/koboService";
import { PosteDetail, PostesMapResponse } from "@/lib/types/kobo";
import { useState, useEffect, useCallback, useRef } from "react";
import { fetchWiresMap, fetchWireDetail } from "@/lib/api/services/koboService";
import { WiresMapResponse, WireDetail } from "@/lib/types/kobo";


// ── État générique asynchrone ─────────────────────────────────────────────────
interface AsyncState<T> {
  data:    T | null;
  loading: boolean;
  error:   string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook 1 : usePostesMap
// Charge une seule fois la liste des postes géolocalisés.
// Expose aussi un `refresh()` pour forcer un rechargement.
// ─────────────────────────────────────────────────────────────────────────────
export function usePostesMap() {
  const [state, setState] = useState<AsyncState<PostesMapResponse>>({
    data:    null,
    loading: true,
    error:   null,
  });

  const load = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const data = await fetchPostesMap();
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
    load();
  }, [load]);

  return {
    postes:  state.data?.postes ?? [],
    count:   state.data?.count  ?? 0,
    loading: state.loading,
    error:   state.error,
    refresh: load,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook 2 : usePosteDetail
// Charge le détail d'un poste à la demande.
// substationId peut être null/undefined → ne fait rien.
// Évite les doubles appels si le même ID est demandé successivement.
// ─────────────────────────────────────────────────────────────────────────────
export function usePosteDetail(substationId: string | null | undefined) {
  const [state, setState] = useState<AsyncState<PosteDetail>>({
    data:    null,
    loading: false,
    error:   null,
  });

  // Éviter les appels obsolètes si le composant est démonté
  const abortRef = useRef<AbortController | null>(null);
  // Cache simple en mémoire pour éviter un re-fetch inutile
  const cacheRef = useRef<Map<string, PosteDetail>>(new Map());

  useEffect(() => {
    if (!substationId) {
      setState({ data: null, loading: false, error: null });
      return;
    }

    // Déjà en cache → pas de requête
    const cached = cacheRef.current.get(substationId);
    if (cached) {
      setState({ data: cached, loading: false, error: null });
      return;
    }

    // Annuler l'éventuelle requête précédente
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setState(prev => ({ ...prev, loading: true, error: null }));

    fetchPosteDetail(substationId)
      .then(data => {
        cacheRef.current.set(substationId, data);
        setState({ data, loading: false, error: null });
      })
      .catch(err => {
        // Ignorer les erreurs d'annulation
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
// Variante impérative : ne charge que quand on appelle `fetch(id)`.
// Utile pour un clic sur la carte → ouvrir un panneau de détail.
// ─────────────────────────────────────────────────────────────────────────────
export function usePosteDetailLazy() {
  const [state, setState] = useState<AsyncState<PosteDetail>>({
    data:    null,
    loading: false,
    error:   null,
  });

  const cacheRef = useRef<Map<string, PosteDetail>>(new Map());

  const fetch = useCallback(async (substationId: string) => {
    if (!substationId) return;

    const cached = cacheRef.current.get(substationId);
    if (cached) {
      setState({ data: cached, loading: false, error: null });
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const data = await fetchPosteDetail(substationId);
      cacheRef.current.set(substationId, data);
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
// Charge une seule fois la liste des wires géolocalisés.
// Expose aussi un `refresh()` pour forcer un rechargement.
// ─────────────────────────────────────────────────────────────────────────────
export function useWiresMap() {
  const [state, setState] = useState<AsyncState<WiresMapResponse>>({
    data:    null,
    loading: true,
    error:   null,
  });

  const load = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const data = await fetchWiresMap();
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
    load();
  }, [load]);

  return {
    wires:   state.data?.wires ?? [],
    count:   state.data?.count  ?? 0,
    loading: state.loading,
    error:   state.error,
    refresh: load,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook 5 : useWireDetail
// Charge le détail d'un wire à la demande.
// wireId peut être null/undefined → ne fait rien.
// Évite les doubles appels si le même ID est demandé successivement.
// ─────────────────────────────────────────────────────────────────────────────
export function useWireDetail(wireId: number | null | undefined) {
  const [state, setState] = useState<AsyncState<WireDetail>>({
    data:    null,
    loading: false,
    error:   null,
  });

  const abortRef = useRef<AbortController | null>(null);
  const cacheRef = useRef<Map<number, WireDetail>>(new Map());

  useEffect(() => {
    if (!wireId) {
      setState({ data: null, loading: false, error: null });
      return;
    }

    const cached = cacheRef.current.get(wireId);
    if (cached) {
      setState({ data: cached, loading: false, error: null });
      return;
    }

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setState(prev => ({ ...prev, loading: true, error: null }));

    fetchWireDetail(wireId)
      .then(data => {
        cacheRef.current.set(wireId, data);
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
// Variante impérative : ne charge que quand on appelle `fetch(id)`.
// Utile pour un clic sur la carte → ouvrir un panneau de détail.
// ─────────────────────────────────────────────────────────────────────────────
export function useWireDetailLazy() {
  const [state, setState] = useState<AsyncState<WireDetail>>({
    data:    null,
    loading: false,
    error:   null,
  });

  const cacheRef = useRef<Map<number, WireDetail>>(new Map());

  const fetch = useCallback(async (wireId: number) => {
    if (!wireId) return;

    const cached = cacheRef.current.get(wireId);
    if (cached) {
      setState({ data: cached, loading: false, error: null });
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const data = await fetchWireDetail(wireId);
      cacheRef.current.set(wireId, data);
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
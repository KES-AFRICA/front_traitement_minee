import { useCallback, useEffect, useRef, useState } from "react";
import type { CollecteStatsResponse } from "@/lib/types/collecte";
import { fetchCollecteStats } from "@/lib/api/services/koboService";


const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
  data: CollecteStatsResponse;
  fetchedAt: number; // timestamp ms
}

// Singleton : partagé entre toutes les instances du hook dans la session.
const _cache: { entry: CacheEntry | null } = { entry: null };

function isCacheValid(): boolean {
  if (!_cache.entry) return false;
  return Date.now() - _cache.entry.fetchedAt < CACHE_TTL_MS;
}

function readCache(): CollecteStatsResponse | null {
  return isCacheValid() ? _cache.entry!.data : null;
}

function writeCache(data: CollecteStatsResponse): void {
  _cache.entry = { data, fetchedAt: Date.now() };
}

function invalidateCache(): void {
  _cache.entry = null;
}


export interface UseCollecteStatsReturn {
  /** Données de la dernière fetch réussie (null au premier chargement) */
  data: CollecteStatsResponse | null;
  /** True uniquement lors du premier chargement (pas de données en cache) */
  loading: boolean;
  /** True lors d'un background refresh (données stale encore visibles) */
  refreshing: boolean;
  /** Message d'erreur lisible, null si aucune erreur */
  error: string | null;
  /** Date du dernier fetch réussi */
  lastUpdated: Date | null;
  /** Force un refetch en invalidant le cache */
  refresh: () => Promise<void>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCollecteStats(): UseCollecteStatsReturn {
  // Initialisation immédiate depuis le cache si valide → évite le flash de loading
  const [data, setData] = useState<CollecteStatsResponse | null>(readCache);
  const [loading, setLoading] = useState<boolean>(!isCacheValid());
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(
    _cache.entry ? new Date(_cache.entry.fetchedAt) : null,
  );

  // Guard : un seul appel réseau simultané (protège contre StrictMode double-mount)
  const isFetching = useRef<boolean>(false);

  const fetchData = useCallback(
    async (force: boolean = false): Promise<void> => {
      if (isFetching.current) return;

      // Cache valide et pas de force → servir depuis le cache
      if (!force && isCacheValid()) {
        const cached = readCache();
        if (cached) {
          setData(cached);
          setLoading(false);
          return;
        }
      }

      isFetching.current = true;

      // Distinguer premier chargement vs refresh (UX différent)
      const hasExistingData = data !== null;
      if (hasExistingData) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      if (force) invalidateCache();

      try {
        const result = await fetchCollecteStats();
        writeCache(result);
        setData(result);
        setLastUpdated(new Date());
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Erreur inconnue lors du chargement des statistiques de collecte.";
        setError(message);
        // Conserver les données stale en cas d'erreur de refresh
      } finally {
        setLoading(false);
        setRefreshing(false);
        isFetching.current = false;
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [],
  ); // stable : ne dépend pas de `data` pour ne pas recréer à chaque render

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refresh = useCallback(async (): Promise<void> => {
    await fetchData(true);
  }, [fetchData]);

  return { data, loading, refreshing, error, lastUpdated, refresh };
}

// lib/api/services/comparisonService.ts

import { FeederComparisonResult, FeedersSourceResponse } from "@/lib/types/comparison";



const BASE_URL = process.env.NEXT_PUBLIC_API_URL_COMPARISON ?? "http://localhost:8085/comparison";

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  
  if (!res.ok) {
    let message = `Erreur HTTP ${res.status}`;
    try {
      const err = await res.json();
      message = err.detail ?? message;
    } catch {}
    throw new Error(message);
  }
  
  return res.json() as Promise<T>;
}

/**
 * GET /comparison/feeders/source
 * Liste des feeders avec leur poste source
 */
export async function fetchFeedersSource(): Promise<FeedersSourceResponse> {
  return apiFetch<FeedersSourceResponse>("/feeders/source");
}

/**
 * GET /comparison/compare/{feeder_id}
 * Détail de la comparaison pour un feeder spécifique
 */
export async function fetchFeederComparison(feederId: string): Promise<FeederComparisonResult> {
  if (!feederId.trim()) throw new Error("feederId requis");
  return apiFetch<FeederComparisonResult>(`/compare/${encodeURIComponent(feederId)}`);
}
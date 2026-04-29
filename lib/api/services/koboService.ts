// ─── services/koboService.ts ──────────────────────────────────────────────────

import {
  ApiError,
  PosteDetail,
  PostesMapResponse,
  REASDetail,
  SupportDetail,
  WireDetail,
  WiresMapResponse,
} from "@/lib/types/kobo";
import type { CollecteStatsResponse } from "@/lib/types/collecte";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL_KOBO ?? "http://localhost:8001";

// ── Helper fetch générique ────────────────────────────────────────────────────
async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });

  if (!res.ok) {
    let message = `Erreur HTTP ${res.status}`;
    try {
      const err: ApiError = await res.json();
      message = err.detail ?? message;
    } catch {
      // réponse non-JSON
    }
    throw new Error(message);
  }

  return res.json() as Promise<T>;
}

// ── Endpoints ─────────────────────────────────────────────────────────────────

/**
 * GET /map/postes
 * Retourne tous les postes géolocalisés (vue carte légère).
 */
export async function fetchPostesMap(): Promise<PostesMapResponse> {
  return apiFetch<PostesMapResponse>("/map/postes");
}

/**
 * GET /poste/{substationId}
 * Retourne le détail complet d'un poste + son génie civil lié.
 *
 * @param substationId  valeur de feeder_001/substation, ex: "8311402"
 */
export async function fetchPosteDetail(
  substationId: string,
): Promise<PosteDetail> {
  if (!substationId.trim()) {
    throw new Error("substationId ne peut pas être vide.");
  }
  return apiFetch<PosteDetail>(`/poste/${encodeURIComponent(substationId)}`);
}

// ── Nouveaux endpoints pour les wires ─────────────────────────────────────────

/**
 * GET /map/wires
 * Retourne toutes les lignes (wires) géolocalisées pour la carte.
 */
export async function fetchWiresMap(): Promise<WiresMapResponse> {
  return apiFetch<WiresMapResponse>("/map/wires");
}

/**
 * GET /wire/{wireId}
 * Retourne le détail complet d'un wire par son ID Kobo.
 *
 * @param wireId  ID Kobo du wire (ex: 217)
 */
// Cache des longueurs par wireId
const wireLengthCache = new Map<number, number>();

// Fonction utilitaire pour calculer la distance Haversine (en km)
function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Rayon de la Terre en km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Fonction pour calculer la longueur totale d'un wire (avec cache)
function calculateWireLength(wire: WireDetail): number {
  // Vérifier si déjà en cache
  if (wireLengthCache.has(wire.id)) {
    return wireLengthCache.get(wire.id)!;
  }

  let totalLength = 0;

  // Utiliser les segments de la géométrie
  const segments = wire.geometry?.segments ?? [];

  for (const segment of segments) {
    const coords = segment.coordinates ?? [];
    for (let i = 0; i < coords.length - 1; i++) {
      const [lng1, lat1] = coords[i];
      const [lng2, lat2] = coords[i + 1];
      totalLength += haversineDistance(lat1, lng1, lat2, lng2);
    }
  }

  // Stocker dans le cache
  wireLengthCache.set(wire.id, totalLength);

  return totalLength;
}

// Fonction pour vider le cache (appeler lors du refresh)
export function clearWireLengthCache(): void {
  wireLengthCache.clear();
}

// Version modifiée de fetchWireDetail avec calcul de longueur et cache
export async function fetchWireDetail(wireId: number): Promise<WireDetail> {
  if (!wireId) {
    throw new Error("wireId ne peut pas être vide.");
  }

  const wire = await apiFetch<WireDetail>(
    `/wire/${encodeURIComponent(wireId)}`,
  );

  // Calculer ou récupérer du cache la longueur
  const length_km = calculateWireLength(wire);

  // Retourner le wire enrichi avec la longueur
  return {
    ...wire,
    length_km,
  };
}

// ── Fonctions de fetch ────────────────────────────────────────────────────────

export async function fetchSupportDetail(
  wireId: number,
  tronconIndex: number,
  supportIndex: number,
): Promise<SupportDetail> {
  return apiFetch<SupportDetail>(
    `/map/wires/${wireId}/support/${tronconIndex}/${supportIndex}`,
  );
}

export async function fetchREASDetail(
  wireId: number,
  tronconIndex: number,
): Promise<REASDetail> {
  return apiFetch<REASDetail>(`/map/wires/${wireId}/reas/${tronconIndex}`);
}

// ── Utilitaire : construire l'URL complète d'une photo ─────────────────────────
/**
 * Construit l'URL complète pour une photo.
 * Supporte à la fois :
 * - Les URLs complètes (http:// ou https://) retournées par le backend
 * - Les chemins locaux (images/...) pour compatibilité avec l'ancien système
 *
 * Usage :  <img src={buildPhotoUrl(poste.photos.photo_poste)} />
 */
export function buildPhotoUrl(
  photoPath: string | null | undefined,
): string | null {
  if (!photoPath) return null;

  // URL KoboToolbox → passe par le proxy FastAPI qui injecte le token
  if (photoPath.startsWith("http://") || photoPath.startsWith("https://")) {
    return `${BASE_URL}/proxy/photo?url=${encodeURIComponent(photoPath)}`;
  }

  // Chemin relatif local (ancien format)
  if (photoPath.startsWith("images/")) {
    return `${BASE_URL}/${photoPath}`;
  }

  return photoPath;
}

export async function fetchCollecteStats(): Promise<CollecteStatsResponse> {
  return apiFetch<CollecteStatsResponse>("/dashboard/collecte");
}

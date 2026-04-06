// ─── services/koboService.ts ──────────────────────────────────────────────────

import { ApiError, PosteDetail, PostesMapResponse, WireDetail, WiresMapResponse } from "@/lib/types/kobo";



const BASE_URL = process.env.NEXT_PUBLIC_API_URL_KOBO ?? "http://localhost:8001";

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
export async function fetchPosteDetail(substationId: string): Promise<PosteDetail> {
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
export async function fetchWireDetail(wireId: number): Promise<WireDetail> {
  if (!wireId) {
    throw new Error("wireId ne peut pas être vide.");
  }
  return apiFetch<WireDetail>(`/wire/${encodeURIComponent(wireId)}`);
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
export function buildPhotoUrl(photoPath: string | null | undefined): string | null {
  if (!photoPath) return null;

  // URL KoboToolbox → passe par le proxy FastAPI qui injecte le token
  if (photoPath.startsWith('http://') || photoPath.startsWith('https://')) {
    return `${BASE_URL}/proxy/photo?url=${encodeURIComponent(photoPath)}`;
  }

  // Chemin relatif local (ancien format)
  if (photoPath.startsWith('images/')) {
    return `${BASE_URL}/${photoPath}`;
  }

  return photoPath;
}
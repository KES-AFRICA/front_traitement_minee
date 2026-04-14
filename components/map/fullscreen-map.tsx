"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Satellite, Check } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EquipmentRecord {
  m_rid: string | number;
  name?: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
  lattitude?: number | string | null;
  type?: string;
  regime?: string;
  table?: string;
  feeder_id?: string | number;
  substation_id?: string | number;
  bay_mrid?: string | number;
  pole_id?: string | number;
  [key: string]: unknown;
}

interface WireMapItem {
  id?: number;
  coordinates: [number, number][];
  feeder_name?: string | null;
  tension_kv?: string | null;
  type?: string;
  debut_type?: string;
  fin_type?: string;
  [key: string]: unknown;
}

interface FullscreenMapProps {
  equipments?: Record<string, unknown>[];
  wires?: WireMapItem[];
  onMarkerClick?: (equipment: Record<string, unknown>) => void;
  onWireClick?: (wire: WireMapItem) => void;
  feederColor?: string;
  wireColor?: string;
}

type LayerType = "street" | "satellite";

// ─── Couleur par table ────────────────────────────────────────────────────────
const TABLE_COLORS: Record<string, string> = {
  feeder:           "#06b6d4",
  substation:       "#3b82f6",
  powertransformer: "#8b5cf6",
  busbar:           "#f59e0b",
  bay:              "#10b981",
  switch:           "#ef4444",
  wire:             "#ff0000",
  pole:             "#78716c",
  node:             "#9ca3af",
};

// ─── Extraire lat/lng — retourne null si absent ou invalide ──────────────────
function getCoords(eq: EquipmentRecord): [number, number] | null {
  const rawLat = eq.latitude ?? eq.lattitude;
  const rawLng = eq.longitude;
  const lat = parseFloat(String(rawLat ?? ""));
  const lng = parseFloat(String(rawLng ?? ""));
  if (!isNaN(lat) && !isNaN(lng) && !(lat === 0 && lng === 0)) return [lat, lng];
  return null;
}

// ─── Icône SVG selon la table ─────────────────────────────────────────────────
function makeSVGIcon(eq: EquipmentRecord, L: any): any {
  const color = TABLE_COLORS[eq.table || ""] || "#6366f1";
  const table = eq.table || "";

  const typeRaw = (eq.type as string) ?? "";
  let label = "";
  if (typeRaw === "H61") label = "H61";
  else if (typeRaw === "H59") label = "H59";
  else if (typeRaw) label = "S";

  let shape = "";
  if (table === "substation") {
    if (typeRaw === "H61") {
      shape = `<circle cx="14" cy="14" r="11" fill="${color}" stroke="white" stroke-width="2.5"/>`;
    } else if (typeRaw === "H59") {
      shape = `<rect x="3" y="3" width="22" height="22" rx="3" fill="${color}" stroke="white" stroke-width="2.5"/>`;
    } else {
      shape = `<rect x="2" y="6" width="24" height="16" rx="3" fill="${color}" stroke="white" stroke-width="2.5"/>`;
    }
  } else if (table === "feeder") {
    shape = `<circle cx="14" cy="14" r="10" fill="${color}" stroke="white" stroke-width="2.5"/>`;
  } else if (table === "powertransformer") {
    shape = `<rect x="4" y="4" width="20" height="20" rx="3" fill="${color}" stroke="white" stroke-width="2.5"/>`;
  } else if (table === "busbar") {
    shape = `<polygon points="14,4 24,14 14,24 4,14" fill="${color}" stroke="white" stroke-width="2.5"/>`;
  } else if (table === "switch") {
    shape = `<polygon points="9,4 19,4 24,9 24,19 19,24 9,24 4,19 4,9" fill="${color}" stroke="white" stroke-width="2.5"/>`;
  } else if (table === "pole") {
    shape = `<polygon points="14,4 24,22 4,22" fill="${color}" stroke="white" stroke-width="2.5"/>`;
  } else {
    shape = `<circle cx="14" cy="14" r="10" fill="${color}" stroke="white" stroke-width="2.5"/>`;
  }

  const labelEl = label
    ? `<text x="14" y="18" text-anchor="middle" font-size="9" font-weight="700" fill="white" font-family="sans-serif">${label}</text>`
    : `<circle cx="14" cy="14" r="3" fill="white" opacity="0.9"/>`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="32" height="32">
    ${shape}
    ${labelEl}
  </svg>`;

  return L.divIcon({
    html: svg,
    className: "",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18],
  });
}

// ─── Popup HTML ───────────────────────────────────────────────────────────────
function makePopupHtml(eq: EquipmentRecord): string {
  const color = TABLE_COLORS[eq.table || ""] || "#6366f1";
  const skipKeys = new Set(["latitude", "longitude", "lattitude", "m_rid"]);
  const rows = Object.entries(eq)
    .filter(([k]) => !k.startsWith("_") && !skipKeys.has(k))
    .slice(0, 10)
    .map(([k, v]) => `
      <div style="display:flex;justify-content:space-between;gap:8px;padding:2px 0;border-bottom:1px solid #f0f0f0">
        <span style="color:#888;font-size:10px;white-space:nowrap">${k}</span>
        <span style="font-family:monospace;font-size:10px;text-align:right;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
          ${String(v ?? "—")}
        </span>
      </div>`)
    .join("");

  return `
    <div style="font-family:sans-serif;min-width:200px;max-width:280px; height:auto">
      <div style="font-weight:700;font-size:13px;margin-bottom:4px;padding-bottom:4px;border-bottom:2px solid ${color};color:${color}">
        ${eq.name || eq.m_rid}
      </div>
      <div style="font-size:10px;background:#f5f5f5;padding:2px 8px;border-radius:4px;display:inline-block;margin-bottom:6px;color:#555">
        ${eq.table || "équipement"} — ${eq.m_rid}
      </div>
      <div style="min-height:160px;overflow-y:auto">${rows}</div>
    </div>`;
}

// ─── Popup pour les wires ─────────────────────────────────────────────────────
function makeWirePopupHtml(wire: WireMapItem): string {
  return `
    <div style="font-family:sans-serif;min-width:180px;max-width:280px;">
      <div style="font-weight:700;font-size:13px;margin-bottom:4px;padding-bottom:4px;border-bottom:2px solid #a855f7;color:#a855f7">
        ${wire.feeder_name || "Ligne"}
      </div>
      <div style="font-size:10px;background:#f5f5f5;padding:2px 8px;border-radius:4px;display:inline-block;margin-bottom:6px;color:#555">
        ID: ${wire.id || "N/A"}
      </div>
      <div style="display:flex;flex-direction:column;gap:4px;font-size:11px;">
        <div><strong>Tension:</strong> ${wire.tension_kv || "N/A"} kV</div>
        <div><strong>Type:</strong> ${wire.type || "N/A"}</div>
        <div><strong>Début:</strong> ${wire.debut_type || "N/A"}</div>
        <div><strong>Fin:</strong> ${wire.fin_type || "N/A"}</div>
      </div>
    </div>`;
}

// ─── Composant principal ──────────────────────────────────────────────────────
export default function FullscreenMap({
  equipments = [],
  wires = [],
  onMarkerClick,
  onWireClick,
  feederColor = "#6366f1",
  wireColor = "#ff0000",
}: FullscreenMapProps) {
  const mapRef       = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInst      = useRef<any>(null);
  const tileRef      = useRef<any>(null);
  const layerGroup   = useRef<any>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLegendOpen, setIsLegendOpen] = useState(false);
  const [isLayerOpen,  setIsLayerOpen]  = useState(false);
  const [currentLayer, setCurrentLayer] = useState<LayerType>("street");

  // CSS Leaflet
  useEffect(() => {
    if (!document.querySelector('link[href*="leaflet.min.css"]')) {
      const l = document.createElement("link");
      l.rel = "stylesheet";
      l.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
      document.head.appendChild(l);
    }
  }, []);

  // Plein écran
  useEffect(() => {
    const handler = () => {
      setIsFullscreen(!!document.fullscreenElement);
      setTimeout(() => mapInst.current?.invalidateSize(), 150);
    };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    isFullscreen ? document.exitFullscreen() : containerRef.current.requestFullscreen();
  };

  // Init carte (une seule fois)
  useEffect(() => {
    if (!mapRef.current || mapInst.current) return;
    let alive = true;

    import("leaflet").then((L) => {
      if (!alive || !mapRef.current || mapInst.current) return;

      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
        iconUrl:       "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
        shadowUrl:     "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
      });

      const map = L.map(mapRef.current!, {
        zoomControl: true,
        attributionControl: false,
        scrollWheelZoom: true,
      });

      tileRef.current = L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        { attribution: "© OpenStreetMap", maxZoom: 19 }
      ).addTo(map);

      layerGroup.current = L.layerGroup().addTo(map);
      mapInst.current    = map;
    });

    return () => {
      alive = false;
      mapInst.current?.remove();
      mapInst.current    = null;
      layerGroup.current = null;
    };
  }, []);

  // Changement de fond
  const handleLayerChange = (layer: LayerType) => {
    setCurrentLayer(layer);
    setIsLayerOpen(false);
    if (!mapInst.current) return;
    import("leaflet").then((L) => {
      if (tileRef.current) mapInst.current.removeLayer(tileRef.current);
      const url =
        layer === "street"
          ? "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          : "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
      tileRef.current = L.tileLayer(url, { maxZoom: 19 }).addTo(mapInst.current);
    });
  };

  // ── Rendu markers + polylines ─────────────────────────────────────────────
  useEffect(() => {
    let rafId: number;

    const render = () => {
      if (!mapInst.current || !layerGroup.current) {
        rafId = requestAnimationFrame(render);
        return;
      }

      import("leaflet").then((L) => {
        if (!mapInst.current || !layerGroup.current) return;

        layerGroup.current.clearLayers();

        // ── 1. DESSINER LES WIRES ──
        if (wires && wires.length > 0) {
          for (const wire of wires) {
            if (wire.coordinates && wire.coordinates.length > 1) {
              // Conversion [lng, lat] → [lat, lng] pour Leaflet
              const leafletCoordinates = wire.coordinates.map(([lng, lat]) => [lat, lng]);
              
              const isUnderground = wire.type === "souterrain";
              
              const lineOptions: any = {
                color: wireColor,
                weight: 5,
                opacity: 0.9,
                smoothFactor: 1,
              };
              
              if (isUnderground) {
                lineOptions.dashArray = "10, 8";
                lineOptions.opacity = 0.7;
              }
              
              const polyline = L.polyline(leafletCoordinates as any, lineOptions);
              polyline.bindPopup(makeWirePopupHtml(wire), { maxWidth: 300 });
              polyline.on("click", (e: any) => {
                e.originalEvent?.stopPropagation?.();
                onWireClick?.(wire);
              });
              polyline.addTo(layerGroup.current);
            }
          }
        }

        // ── 2. MARKERS DES POSTES ──
        const eqs = (Array.isArray(equipments) ? equipments : []) as EquipmentRecord[];
        const allCoords: [number, number][] = [];

        for (const eq of eqs) {
          const c = getCoords(eq);
          if (!c) continue;
          allCoords.push(c);

          const marker = L.marker(c, { icon: makeSVGIcon(eq, L) });
          marker.bindPopup(makePopupHtml(eq), { maxWidth: 300 });
          marker.on("click", () => onMarkerClick?.(eq));
          marker.addTo(layerGroup.current);
        }

        // ── 3. AJOUTER LES COORDONNÉES DES WIRES ──
        for (const wire of wires) {
          if (wire.coordinates) {
            for (const coord of wire.coordinates) {
              if (coord && coord.length >= 2) {
                allCoords.push([coord[1], coord[0]]);
              }
            }
          }
        }

        // ── 4. CENTRER LA VUE ──
        if (allCoords.length === 0) {
          mapInst.current.setView([4.06, 9.72], 10);
        } else if (allCoords.length === 1) {
          mapInst.current.setView(allCoords[0], 14);
        } else {
          mapInst.current.fitBounds(
            L.latLngBounds(allCoords),
            { padding: [50, 50], maxZoom: 16 }
          );
        }
      });
    };

    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, [equipments, wires, onMarkerClick, onWireClick, feederColor, wireColor]);

  // ─── Rendu JSX ──────────────────────────────────────────────────────────────
  return (
    <div ref={containerRef} className="relative w-full h-full">
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />
      <div ref={mapRef} className="w-full h-full z-0" />

      {/* Plein écran */}
      <button
        onClick={toggleFullscreen}
        className="absolute top-3 right-3 z-10 bg-white text-black rounded-lg shadow-md p-2 hover:bg-gray-50 transition-colors"
        aria-label={isFullscreen ? "Quitter le plein écran" : "Plein écran"}
      >
        {isFullscreen ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
          </svg>
        )}
      </button>

      {/* Sélecteur de fond */}
      <div className="absolute bottom-4 right-3 z-10">
        <button
          onClick={() => setIsLayerOpen((p) => !p)}
          className="bg-white text-black rounded-lg shadow-md px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 hover:bg-gray-50 transition-colors"
        >
          <Satellite className="h-3.5 w-3.5" />
          {currentLayer === "street" ? "Carte" : "Satellite"}
          {isLayerOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
        {isLayerOpen && (
          <div className="absolute bottom-full right-0 mb-1 bg-white rounded-lg shadow-lg overflow-hidden min-w-32.5">
            {(["street", "satellite"] as LayerType[]).map((l) => (
              <button
                key={l}
                onClick={() => handleLayerChange(l)}
                className={`w-full px-3 py-2 text-left text-xs flex items-center gap-2 hover:bg-gray-50 transition-colors ${
                  currentLayer === l ? "text-blue-600 font-medium" : "text-black"
                }`}
              >
                {l === "street" ? "Carte (OSM)" : "Satellite"}
                {currentLayer === l && <Check className="h-3 w-3 ml-auto" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Légende */}
      <div className="absolute bottom-3 left-3 z-10">
        <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-md overflow-hidden" style={{ minWidth: 150 }}>
          <button
            onClick={() => setIsLegendOpen((p) => !p)}
            className="w-full px-3 py-2 flex items-center justify-between hover:bg-gray-50 transition-colors text-xs font-semibold text-gray-700"
          >
            <span>Légende</span>
            {isLegendOpen
              ? <ChevronDown className="h-3 w-3 text-gray-500" />
              : <ChevronUp   className="h-3 w-3 text-gray-500" />}
          </button>

          {isLegendOpen && (
            <div className="px-3 pb-3 space-y-1.5 text-[11px] border-t border-gray-100">
              <div className="flex items-center gap-2 py-0.5">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ background: TABLE_COLORS.substation }} />
                <span className="text-gray-700">Poste</span>
              </div>
              <div className="flex items-center gap-2 py-0.5">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ background: TABLE_COLORS.feeder }} />
                <span className="text-gray-700">Feeder</span>
              </div>
              <div className="flex items-center gap-2 py-0.5">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ background: TABLE_COLORS.busbar }} />
                <span className="text-gray-700">Busbar</span>
              </div>
              <div className="flex items-center gap-2 py-0.5">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ background: TABLE_COLORS.powertransformer }} />
                <span className="text-gray-700">Transformateur</span>
              </div>
              {/* Ligne aérienne */}
              <div className="flex items-center gap-2 pt-1.5 mt-1 border-t border-gray-100">
                <div className="w-8 h-1 rounded shrink-0" style={{ background: wireColor }} />
                <span className="text-gray-700">Ligne aérienne</span>
              </div>
              {/* Ligne souterraine */}
              <div className="flex items-center gap-2">
                <div className="w-8 h-1 rounded shrink-0" style={{ background: wireColor, backgroundImage: `repeating-linear-gradient(90deg, ${wireColor}, ${wireColor} 6px, transparent 6px, transparent 12px)` }} />
                <span className="text-gray-700">Ligne souterraine</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
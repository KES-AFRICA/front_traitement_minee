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
  _anomalyType?: string;
  [key: string]: unknown;
}

interface FullscreenMapProps {
  equipments?: Record<string, unknown>[];
  onMarkerClick?: (equipment: Record<string, unknown>) => void;
  feederColor?: string;
}

type LayerType = "street" | "satellite";

// ─── Couleur par table (défaut) ───────────────────────────────────────────────
const TABLE_COLORS: Record<string, string> = {
  feeder:           "#06b6d4",
  substation:       "#3b82f6",
  powertransformer: "#8b5cf6",
  busbar:           "#f59e0b",
  bay:              "#10b981",
  switch:           "#ef4444",
  wire:             "#6b7280",
  pole:             "#78716c",
  node:             "#9ca3af",
};

// ─── Couleur par anomalie (prioritaire) ──────────────────────────────────────
const ANOMALY_COLORS: Record<string, string> = {
  duplicate:  "#a855f7",  // purple
  divergence: "#f59e0b",  // amber
  new:        "#10b981",  // emerald
  missing:    "#f97316",  // orange
  complex:    "#ef4444",  // red
};

// ─── Obtenir la couleur finale (anomalie > type H59/H61 > table) ─────────────
function getEquipmentColor(eq: EquipmentRecord): string {
  // Priorité absolue aux anomalies
  const anomalyType = eq._anomalyType;
  if (anomalyType && ANOMALY_COLORS[anomalyType]) {
    return ANOMALY_COLORS[anomalyType];
  }
  
  // Ensuite par type H59/H61
  const t = String(eq.type || "").toUpperCase();
  if (t.includes("H59")) return "#3b82f6";  // bleu
  if (t.includes("H61")) return "#f59e0b";  // amber
  if (t.includes("DP")) return "#10b981";   // vert
  
  // Sinon par table
  return TABLE_COLORS[eq.table || ""] || "#6366f1";
}

// ─── Extraire lat/lng — retourne null si absent ou invalide ──────────────────
function getCoords(eq: EquipmentRecord): [number, number] | null {
  const rawLat = eq.latitude ?? eq.lattitude;
  const rawLng = eq.longitude;
  const lat = parseFloat(String(rawLat ?? ""));
  const lng = parseFloat(String(rawLng ?? ""));
  if (!isNaN(lat) && !isNaN(lng) && !(lat === 0 && lng === 0)) return [lat, lng];
  return null;
}

// ─── Forme SVG selon la table ─────────────────────────────────────────────────
function getShapeFromTable(table: string, type?: string): string {
  // Substation : forme selon le type H61/H59
  if (table === "substation") {
    if (type === "H61") return "circle";
    if (type === "H59") return "square";
    return "rectangle";
  }
  
  // Autres tables
  const shapes: Record<string, string> = {
    feeder:           "circle",
    powertransformer: "square",
    busbar:           "diamond",
    bay:              "circle",
    switch:           "octagon",
    wire:             "circle",
    pole:             "triangle",
    node:             "circle",
  };
  
  return shapes[table] || "circle";
}

// ─── Icône SVG avec forme, couleur et animation radar pour anomalies ─────────
function makeSVGIcon(eq: EquipmentRecord, L: any): any {
  const color = getEquipmentColor(eq);
  const table = eq.table || "";
  const type = eq.type as string;
  const shape = getShapeFromTable(table, type);
  const hasAnomaly = !!eq._anomalyType;
  
  // Label central selon le type
  let label = "";
  if (type === "H61") label = "H61";
  else if (type === "H59") label = "H59";
  else if (type) label = type.substring(0, 1);
  
  // Construction de la forme
  let shapeSvg = "";
  switch (shape) {
    case "circle":
      shapeSvg = `<circle cx="14" cy="14" r="10" fill="${color}" stroke="white" stroke-width="2.5"/>`;
      break;
    case "square":
      shapeSvg = `<rect x="4" y="4" width="20" height="20" rx="3" fill="${color}" stroke="white" stroke-width="2.5"/>`;
      break;
    case "rectangle":
      shapeSvg = `<rect x="2" y="6" width="24" height="16" rx="3" fill="${color}" stroke="white" stroke-width="2.5"/>`;
      break;
    case "diamond":
      shapeSvg = `<polygon points="14,4 24,14 14,24 4,14" fill="${color}" stroke="white" stroke-width="2.5"/>`;
      break;
    case "octagon":
      shapeSvg = `<polygon points="9,4 19,4 24,9 24,19 19,24 9,24 4,19 4,9" fill="${color}" stroke="white" stroke-width="2.5"/>`;
      break;
    case "triangle":
      shapeSvg = `<polygon points="14,4 24,22 4,22" fill="${color}" stroke="white" stroke-width="2.5"/>`;
      break;
    default:
      shapeSvg = `<circle cx="14" cy="14" r="10" fill="${color}" stroke="white" stroke-width="2.5"/>`;
  }
  
  // Animation radar pour anomalies (beaucoup plus prononcée)
  const radarAnimation = hasAnomaly ? `
    <circle cx="14" cy="14" r="16" fill="none" stroke="${color}" stroke-width="3" opacity="0.9">
      <animate attributeName="r" values="16;30;16" dur="1.5s" repeatCount="indefinite" />
      <animate attributeName="opacity" values="0.9;0;0.9" dur="1.5s" repeatCount="indefinite" />
    </circle>
    <circle cx="14" cy="14" r="20" fill="none" stroke="${color}" stroke-width="2.5" opacity="0.7">
      <animate attributeName="r" values="20;34;20" dur="1.8s" repeatCount="indefinite" begin="0.3s" />
      <animate attributeName="opacity" values="0.7;0;0.7" dur="1.8s" repeatCount="indefinite" begin="0.3s" />
    </circle>
    <circle cx="14" cy="14" r="24" fill="none" stroke="${color}" stroke-width="2" opacity="0.5">
      <animate attributeName="r" values="24;38;24" dur="2.1s" repeatCount="indefinite" begin="0.6s" />
      <animate attributeName="opacity" values="0.5;0;0.5" dur="2.1s" repeatCount="indefinite" begin="0.6s" />
    </circle>
  ` : "";
  
  // Label centré ou point blanc
  const labelEl = label
    ? `<text x="14" y="18" text-anchor="middle" font-size="9" font-weight="700" fill="white" font-family="sans-serif">${label}</text>`
    : `<circle cx="14" cy="14" r="3" fill="white" opacity="0.95"/>`;
  
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="32" height="32">
    ${radarAnimation}
    ${shapeSvg}
    ${labelEl}
  </svg>`;
  
  return L.divIcon({
    html: svg,
    className: "custom-marker",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18],
  });
}

// ─── Popup HTML avec affichage des anomalies ─────────────────────────────────
function makePopupHtml(eq: EquipmentRecord): string {
  const color = getEquipmentColor(eq);
  const hasAnomaly = !!eq._anomalyType;
  const anomalyType = eq._anomalyType;
  
  const skipKeys = new Set(["latitude", "longitude", "lattitude", "m_rid", "_anomalyType"]);
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
  
  const anomalyBadge = hasAnomaly ? `
    <div style="margin-top:6px;padding:4px 8px;background:${color}20;border-left:3px solid ${color};border-radius:4px">
      <span style="font-size:10px;font-weight:600;color:${color}">⚠️ ANOMALIE: ${anomalyType?.toUpperCase()}</span>
    </div>
  ` : `
    <div style="margin-top:6px;padding:4px 8px;background:#e6f7e6;border-left:3px solid #10b981;border-radius:4px">
      <span style="font-size:10px;font-weight:600;color:#10b981">✓ ÉQUIPEMENT CONFORME</span>
    </div>
  `;
  
  const coords = getCoords(eq);
  const locationInfo = coords ? `
    <div style="margin-top:6px;padding:4px 8px;background:#f0f0f0;border-radius:4px">
      <span style="font-size:9px;color:#666">📍 ${coords[0].toFixed(6)}, ${coords[1].toFixed(6)}</span>
    </div>
  ` : "";
  
  return `
    <div style="font-family:sans-serif;min-width:220px;max-width:300px">
      <div style="font-weight:700;font-size:13px;margin-bottom:4px;padding-bottom:4px;border-bottom:2px solid ${color};color:${color}">
        ${eq.name || eq.m_rid}
        ${hasAnomaly ? ' ⚠️' : ''}
      </div>
      <div style="font-size:10px;margin-bottom:8px">
        <span style="background:#f0f0f0;padding:2px 8px;border-radius:4px">${eq.table || "équipement"}</span>
        <span style="margin-left:4px;background:${color}20;color:${color};padding:2px 8px;border-radius:4px">${eq.type || "—"}</span>
      </div>
      <div style="max-height:180px;overflow-y:auto">${rows}</div>
      ${locationInfo}
      ${anomalyBadge}
      <button 
        style="margin-top:8px;padding:6px 12px;background:#6366f1;color:white;border:none;border-radius:6px;font-size:11px;cursor:pointer;width:100%;font-weight:500"
        onclick="window.__markerClickCallback && window.__markerClickCallback(${JSON.stringify(eq).replace(/"/g, '&quot;')})"
      >
        📋 Voir tous les détails →
      </button>
    </div>`;
}

// ─── Construction des liaisons hiérarchiques ─────────────────────────────────
function buildSegments(equipments: EquipmentRecord[]): [number, number][][] {
  // Index des coordonnées
  const coords = new Map<string, [number, number]>();
  for (const eq of equipments) {
    const c = getCoords(eq);
    if (c) coords.set(String(eq.m_rid), c);
  }
  
  const segments: [number, number][][] = [];
  
  const link = (parentId: unknown, childId: unknown) => {
    if (parentId == null || childId == null) return;
    const a = coords.get(String(parentId));
    const b = coords.get(String(childId));
    if (a && b) segments.push([a, b]);
  };
  
  // Liaisons directes
  for (const eq of equipments) {
    if (!getCoords(eq)) continue;
    
    switch (eq.table) {
      case "substation":       link(eq.feeder_id, eq.m_rid); break;
      case "powertransformer": link(eq.substation_id, eq.m_rid); break;
      case "busbar":           link(eq.substation_id, eq.m_rid); break;
      case "bay":              link(eq.substation_id, eq.m_rid); break;
      case "switch":           link(eq.bay_mrid, eq.m_rid); break;
      case "wire":             link(eq.feeder_id, eq.m_rid); break;
      case "pole":             link(eq.feeder_id, eq.m_rid); break;
      case "node":             link(eq.pole_id, eq.m_rid); break;
    }
  }
  
  // Cas spécial : plusieurs substations sans feeder coordonné
  const feederIds = new Set<string>();
  for (const eq of equipments) {
    if (eq.table === "substation" && eq.feeder_id != null) {
      feederIds.add(String(eq.feeder_id));
    }
  }
  
  for (const feederId of feederIds) {
    if (coords.has(feederId)) continue;
    
    const subs = equipments.filter(
      eq => eq.table === "substation" && String(eq.feeder_id) === feederId && getCoords(eq) !== null
    );
    
    if (subs.length < 2) continue;
    
    const sorted = [...subs].sort((a, b) => {
      const [, lngA] = getCoords(a)!;
      const [, lngB] = getCoords(b)!;
      return lngA - lngB;
    });
    
    const remaining = [...sorted];
    let current = remaining.shift()!;
    
    while (remaining.length > 0) {
      const currentC = getCoords(current)!;
      let nearestIdx = 0;
      let nearestDist = Infinity;
      for (let i = 0; i < remaining.length; i++) {
        const c = getCoords(remaining[i])!;
        const dist = Math.hypot(currentC[0] - c[0], currentC[1] - c[1]);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestIdx = i;
        }
      }
      const next = remaining.splice(nearestIdx, 1)[0];
      const nextC = getCoords(next)!;
      segments.push([currentC, nextC]);
      current = next;
    }
  }
  
  return segments;
}

// ─── Composant principal ──────────────────────────────────────────────────────
export default function FullscreenMap({
  equipments = [],
  onMarkerClick,
  feederColor = "#6366f1",
}: FullscreenMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInst = useRef<any>(null);
  const tileRef = useRef<any>(null);
  const layerGroup = useRef<any>(null);
  const polylineRef = useRef<any>(null);
  
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLegendOpen, setIsLegendOpen] = useState(false);
  const [isLayerOpen, setIsLayerOpen] = useState(false);
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
  
  // Callback global pour les boutons popup
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__markerClickCallback = (eq: EquipmentRecord) => {
        if (onMarkerClick) onMarkerClick(eq);
      };
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).__markerClickCallback;
      }
    };
  }, [onMarkerClick]);
  
  // Init carte
  useEffect(() => {
    if (!mapRef.current || mapInst.current) return;
    let alive = true;
    
    import("leaflet").then((L) => {
      if (!alive || !mapRef.current || mapInst.current) return;
      
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
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
      mapInst.current = map;
    });
    
    return () => {
      alive = false;
      mapInst.current?.remove();
      mapInst.current = null;
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
      const url = layer === "street"
        ? "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        : "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
      tileRef.current = L.tileLayer(url, { maxZoom: 19 }).addTo(mapInst.current);
    });
  };
  
  // Rendu markers + polylines
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
        
        const eqs = (Array.isArray(equipments) ? equipments : []) as EquipmentRecord[];
        if (eqs.length === 0) {
          mapInst.current.setView([4.06, 9.72], 10);
          return;
        }
        
        // Polylines (réseau)
        const segments = buildSegments(eqs);
        for (const seg of segments) {
          L.polyline(seg, {
            color: feederColor,
            weight: 2.5,
            opacity: 0.8,
            dashArray: "6 4",
          }).addTo(layerGroup.current);
        }
        
        // Markers
        const allCoords: [number, number][] = [];
        for (const eq of eqs) {
          const c = getCoords(eq);
          if (!c) continue;
          allCoords.push(c);
          
          const marker = L.marker(c, { icon: makeSVGIcon(eq, L) });
          marker.bindPopup(makePopupHtml(eq), { maxWidth: 320 });
          marker.on("click", () => onMarkerClick?.(eq));
          marker.addTo(layerGroup.current);
        }
        
        // Centrage
        if (allCoords.length === 0) {
          mapInst.current.setView([4.06, 9.72], 10);
        } else if (allCoords.length === 1) {
          mapInst.current.setView(allCoords[0], 14);
        } else {
          mapInst.current.fitBounds(L.latLngBounds(allCoords), { padding: [50, 50], maxZoom: 16 });
        }
      });
    };
    
    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, [equipments, onMarkerClick, feederColor]);
  
  // Légende items
  // const legendItems = [
  //   { table: "substation", label: "Poste source H61", shape: "circle", color: TABLE_COLORS.substation, type: "H61" },
  //   { table: "substation", label: "Poste source H59", shape: "square", color: TABLE_COLORS.substation, type: "H59" },
  //   { table: "substation", label: "Poste source (autre)", shape: "rectangle", color: TABLE_COLORS.substation },
  //   { table: "feeder", label: "Départ", shape: "circle", color: TABLE_COLORS.feeder },
  //   { table: "powertransformer", label: "Transformateur", shape: "square", color: TABLE_COLORS.powertransformer },
  //   { table: "busbar", label: "Jeu de barres", shape: "diamond", color: TABLE_COLORS.busbar },
  //   { table: "bay", label: "Cellule", shape: "circle", color: TABLE_COLORS.bay },
  //   { table: "switch", label: "Interrupteur", shape: "octagon", color: TABLE_COLORS.switch },
  //   { table: "wire", label: "Câble", shape: "circle", color: TABLE_COLORS.wire },
  //   { table: "pole", label: "Poteau", shape: "triangle", color: TABLE_COLORS.pole },
  //   { table: "node", label: "Nœud", shape: "circle", color: TABLE_COLORS.node },
  // ];
  
  const anomalyItems = [
    { type: "duplicate", label: "Doublon", color: ANOMALY_COLORS.duplicate },
    { type: "divergence", label: "Divergence", color: ANOMALY_COLORS.divergence },
    { type: "new", label: "Nouvel équipement", color: ANOMALY_COLORS.new },
    { type: "missing", label: "Manquant", color: ANOMALY_COLORS.missing },
    { type: "complex", label: "Complexe", color: ANOMALY_COLORS.complex },
  ];
  
  return (
    <div ref={containerRef} className="relative w-full h-full">
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
          onClick={() => setIsLayerOpen(p => !p)}
          className="bg-white text-black rounded-lg shadow-md px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 hover:bg-gray-50 transition-colors"
        >
          {currentLayer === "street" ? <Check className="h-3.5 w-3.5" /> : <Satellite className="h-3.5 w-3.5" />}
          {currentLayer === "street" ? "Carte" : "Satellite"}
          {isLayerOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
        {isLayerOpen && (
          <div className="absolute bottom-full right-0 mb-1 bg-white rounded-lg shadow-lg overflow-hidden min-w-32">
            {(["street", "satellite"] as LayerType[]).map(l => (
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
      
      {/* Légende complète */}
      <div className="absolute bottom-3 left-3 z-10 max-h-[80vh] overflow-y-auto">
        <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-md overflow-hidden" style={{ minWidth: 190 }}>
          <button
            onClick={() => setIsLegendOpen(p => !p)}
            className="w-full px-3 py-2 flex items-center justify-between hover:bg-gray-50 transition-colors text-xs font-semibold text-gray-700"
          >
            <span>📋 Légende</span>
            {isLegendOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
          </button>
          
          {isLegendOpen && (
            <div className="px-3 pb-3 space-y-2 text-[11px] border-t border-gray-100 max-h-96 overflow-y-auto">
              {/* Équipements par forme */}
              {/* <div className="space-y-1.5">
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">ÉQUIPEMENTS</div>
                {legendItems.map((item, idx) => {
                  let shapeEl = null;
                  if (item.shape === "square") shapeEl = <div className="w-3 h-3 rounded-sm" style={{ background: item.color }} />;
                  else if (item.shape === "diamond") shapeEl = <div className="w-3 h-3 rotate-45" style={{ background: item.color }} />;
                  else if (item.shape === "triangle") shapeEl = <div className="w-0 h-0" style={{ borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderBottom: `8px solid ${item.color}` }} />;
                  else if (item.shape === "octagon") shapeEl = <div className="w-3 h-3" style={{ background: item.color, clipPath: "polygon(25% 0%,75% 0%,100% 25%,100% 75%,75% 100%,25% 100%,0% 75%,0% 25%)" }} />;
                  else if (item.shape === "rectangle") shapeEl = <div className="w-4 h-2.5 rounded-sm" style={{ background: item.color }} />;
                  else shapeEl = <div className="w-3 h-3 rounded-full" style={{ background: item.color }} />;
                  
                  return (
                    <div key={idx} className="flex items-center gap-2 py-0.5">
                      {shapeEl}
                      <span className="text-gray-700">{item.label}</span>
                    </div>
                  );
                })}
              </div> */}
              
              {/* Anomalies */}
              <div className="space-y-1.5 pt-1.5 border-t border-gray-100">
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">ANOMALIES</div>
                {anomalyItems.map(item => (
                  <div key={item.type} className="flex items-center gap-2 py-0.5">
                    <div className="relative">
                      <div className="w-3 h-3 rounded-full" style={{ background: item.color }} />
                      <div className="absolute inset-0 rounded-full animate-ping opacity-75" style={{ background: item.color }} />
                    </div>
                    <span className="text-gray-700 font-medium">⚠️ {item.label}</span>
                  </div>
                ))}
              </div>
              
              {/* Réseau */}
              <div className="flex items-center gap-2 pt-1.5 mt-1 border-t border-gray-100">
                <div className="w-6 h-0.5 rounded" style={{ background: feederColor }} />
                <span className="text-gray-700">Réseau du départ</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
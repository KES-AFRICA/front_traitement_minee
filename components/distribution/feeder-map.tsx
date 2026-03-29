"use client";

import { useEffect, useRef, useState } from "react";
import { Layers, ChevronDown, ChevronUp, Map, Satellite, Check } from "lucide-react";

export interface EquipmentRecord {
  m_rid: string | number;
  name?: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
  type?: string;
  regime?: string;
  table?: string;
  _anomalyType?: string;
  [key: string]: unknown;
}

interface FeederMapProps {
  equipments: Record<string, unknown>[];
  feederId: string;
  onMarkerClick?: (equipment: Record<string, unknown>) => void;
}

type LayerType = "street" | "satellite";

// Couleur par type d'équipement et anomalie
function getEquipmentColor(equip: EquipmentRecord): string {
  // Priorité aux anomalies
  const anomalyType = equip._anomalyType;
  if (anomalyType === "duplicate") return "#a855f7"; // purple
  if (anomalyType === "divergence") return "#f59e0b"; // amber
  if (anomalyType === "new") return "#10b981"; // emerald
  if (anomalyType === "missing") return "#f97316"; // orange
  if (anomalyType === "complex") return "#ef4444"; // red
  
  // Sinon par type
  const t = String(equip.type || "").toUpperCase();
  if (t.includes("H59")) return "#3b82f6"; // bleu
  if (t.includes("H61")) return "#f59e0b"; // amber
  if (t.includes("DP")) return "#10b981";  // vert
  return "#6366f1"; // violet default
}

// Forme SVG selon la table
function getMarkerShape(equip: EquipmentRecord): "circle" | "square" | "octagon" {
  const table = equip.table || "";
  if (table === "substation") return "circle";
  if (table === "powertransformer") return "square";
  if (table === "switch") return "octagon";
  return "circle";
}

function createSVGIcon(equip: EquipmentRecord, L: any, hasAnomaly: boolean): any {
  const color = getEquipmentColor(equip);
  const shape = getMarkerShape(equip);
  const hasAnomalyAttr = hasAnomaly;

  let svgPath = "";
  if (shape === "circle") {
    svgPath = `<circle cx="14" cy="14" r="10" fill="${color}" stroke="white" stroke-width="2.5"/>`;
  } else if (shape === "square") {
    svgPath = `<rect x="4" y="4" width="20" height="20" rx="3" fill="${color}" stroke="white" stroke-width="2.5"/>`;
  } else {
    // octagon
    svgPath = `<polygon points="9,4 19,4 24,9 24,19 19,24 9,24 4,19 4,9" fill="${color}" stroke="white" stroke-width="2.5"/>`;
  }

  // Ajout d'une animation radar BEAUCOUP PLUS PRONONCÉE si anomalie
  const radarAnimation = hasAnomalyAttr ? `
    <!-- Cercle extérieur pulsant principal -->
    <circle cx="14" cy="14" r="16" fill="none" stroke="${color}" stroke-width="3" opacity="0.9">
      <animate attributeName="r" values="16;28;16" dur="1.5s" repeatCount="indefinite" />
      <animate attributeName="opacity" values="0.9;0;0.9" dur="1.5s" repeatCount="indefinite" />
    </circle>
    <!-- Deuxième vague avec décalage -->
    <circle cx="14" cy="14" r="20" fill="none" stroke="${color}" stroke-width="2.5" opacity="0.7">
      <animate attributeName="r" values="20;32;20" dur="1.8s" repeatCount="indefinite" begin="0.3s" />
      <animate attributeName="opacity" values="0.7;0;0.7" dur="1.8s" repeatCount="indefinite" begin="0.3s" />
    </circle>
    <!-- Troisième vague encore plus large -->
    <circle cx="14" cy="14" r="24" fill="none" stroke="${color}" stroke-width="2" opacity="0.5">
      <animate attributeName="r" values="24;36;24" dur="2.1s" repeatCount="indefinite" begin="0.6s" />
      <animate attributeName="opacity" values="0.5;0;0.5" dur="2.1s" repeatCount="indefinite" begin="0.6s" />
    </circle>
    <!-- Glow / halo constant autour du marqueur -->
    <circle cx="14" cy="14" r="12" fill="none" stroke="${color}" stroke-width="1.5" opacity="0.4">
      <animate attributeName="r" values="12;14;12" dur="1.2s" repeatCount="indefinite" />
    </circle>
  ` : "";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="32" height="32">
    ${radarAnimation}
    ${svgPath}
    <circle cx="14" cy="14" r="3" fill="white" stroke="${color}" stroke-width="1.5" opacity="0.95"/>
  </svg>`;

  return L.divIcon({
    html: svg,
    className: "custom-marker",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
}

export default function FeederMap({ equipments, feederId, onMarkerClick }: FeederMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const tileLayerRef = useRef<any>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLegendOpen, setIsLegendOpen] = useState(false);
  const [isLayerOpen, setIsLayerOpen] = useState(false);
  const [currentLayer, setCurrentLayer] = useState<LayerType>("street");

  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  const handleLayerChange = (layer: LayerType) => {
    setCurrentLayer(layer);
    setIsLayerOpen(false);
    
    if (mapInstanceRef.current && tileLayerRef.current) {
      mapInstanceRef.current.removeLayer(tileLayerRef.current);
      
      let url = "";
      let attribution = "";
      
      if (layer === "street") {
        url = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
        attribution = "© OpenStreetMap";
      } else {
        url = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
        attribution = "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community";
      }
      
      import("leaflet").then((L) => {
        tileLayerRef.current = L.tileLayer(url, {
          attribution: attribution,
          maxZoom: 19,
        }).addTo(mapInstanceRef.current);
      });
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isNowFullscreen = !!document.fullscreenElement;
      setIsFullscreen(isNowFullscreen);
      
      if (mapInstanceRef.current) {
        setTimeout(() => {
          mapInstanceRef.current.invalidateSize();
        }, 100);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }
    
    if (!mapRef.current) return;

    let isMounted = true;

    import("leaflet").then((L) => {
      if (!isMounted || !mapRef.current) return;

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

      const tileUrl = currentLayer === "street" 
        ? "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        : "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
      
      const attribution = currentLayer === "street"
        ? "© OpenStreetMap"
        : "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community";
      
      tileLayerRef.current = L.tileLayer(tileUrl, {
        attribution: attribution,
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;

      const points: [number, number][] = [];
      const newMarkers: any[] = [];

      equipments.forEach((eq) => {
        const e = eq as EquipmentRecord;
        const lat = parseFloat(String(e.latitude ?? ""));
        const lng = parseFloat(String(e.longitude ?? ""));

        if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
          points.push([lat, lng]);
          const hasAnomaly = !!e._anomalyType;
          const icon = createSVGIcon(e, L, hasAnomaly);
          const marker = L.marker([lat, lng], { icon }).addTo(map);
          
          // Construire le contenu du popup avec toutes les données
          const allFields = Object.keys(e)
            .filter(k => !k.startsWith("_") && k !== "m_rid")
            .slice(0, 8);
          
          const fieldsHtml = allFields.map(k => `
            <div style="display:flex;justify-content:space-between;border-bottom:1px solid #eee;padding:2px 0">
              <span style="color:#666;font-size:10px">${k}:</span>
              <span style="font-family:monospace;font-size:10px">${String(e[k] || "—").substring(0, 30)}</span>
            </div>
          `).join("");
          
          const anomalyBadge = hasAnomaly ? `
            <div style="margin-top:6px;padding:4px 8px;background:${getEquipmentColor(e)}20;border-left:3px solid ${getEquipmentColor(e)};border-radius:4px">
              <span style="font-size:10px;font-weight:600;color:${getEquipmentColor(e)}">⚠️ ANOMALIE: ${e._anomalyType?.toUpperCase()}</span>
            </div>
          ` : "";
          
          const popupContent = `
            <div style="font-family:sans-serif;min-width:220px;max-width:300px">
              <div style="font-weight:700;font-size:14px;margin-bottom:6px;border-bottom:2px solid ${hasAnomaly ? getEquipmentColor(e) : '#ddd'};padding-bottom:4px;color:${hasAnomaly ? getEquipmentColor(e) : '#333'}">
                ${e.name || e.m_rid}
                ${hasAnomaly ? ' ⚠️' : ''}
              </div>
              <div style="font-size:10px;color:#666;margin-bottom:8px">
                <span style="background:#f0f0f0;padding:2px 6px;border-radius:4px">${e.table || "équipement"}</span>
                ${hasAnomaly ? `<span style="background:${getEquipmentColor(e)}20;color:${getEquipmentColor(e)};padding:2px 6px;border-radius:4px;margin-left:4px;font-weight:500">${e._anomalyType}</span>` : '<span style="background:#e6f7e6;color:#2e7d32;padding:2px 6px;border-radius:4px;margin-left:4px">✓ Conforme</span>'}
              </div>
              <div style="max-height:200px;overflow-y:auto">
                ${fieldsHtml}
              </div>
              ${anomalyBadge}
              <button 
                style="margin-top:8px;padding:6px 12px;background:#6366f1;color:white;border:none;border-radius:6px;font-size:11px;cursor:pointer;width:100%;font-weight:500"
                onclick="window.__markerClickCallback && window.__markerClickCallback(${JSON.stringify(e).replace(/"/g, '&quot;')})"
              >
                📋 Voir tous les détails →
              </button>
            </div>
          `;
          
          marker.bindPopup(popupContent);
          
          marker.on('click', () => {
            if (onMarkerClick) {
              onMarkerClick(e);
            }
          });
          
          newMarkers.push(marker);
        }
      });

      markersRef.current = newMarkers;

      if (typeof window !== 'undefined') {
        (window as any).__markerClickCallback = (eq: EquipmentRecord) => {
          if (onMarkerClick) {
            onMarkerClick(eq);
          }
        };
      }

      // Tracer une ligne entre les points
      if (points.length >= 2) {
        const sorted = [...points].sort((a, b) => b[0] - a[0]);
        L.polyline(sorted, {
          color: "#6366f1",
          weight: 3,
          opacity: 0.7,
          dashArray: "8 6",
        }).addTo(map);
      }

      // Centrer la carte
      if (points.length === 0) {
        map.setView([4.06, 9.72], 13);
      } else if (points.length === 1) {
        map.setView(points[0], 15);
      } else {
        const bounds = L.latLngBounds(points);
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    });

    return () => {
      isMounted = false;
      if (typeof window !== 'undefined') {
        delete (window as any).__markerClickCallback;
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      markersRef.current = [];
    };
  }, [equipments, onMarkerClick, currentLayer]);

  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>('link[href*="leaflet"]');
    if (!link) {
      const l = document.createElement("link");
      l.rel = "stylesheet";
      l.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
      document.head.appendChild(l);
    }
  }, []);

  return (
    <>
      <div 
        ref={containerRef} 
        className="relative w-full h-full"
      >
        <div
          ref={mapRef}
          className="w-full h-full z-0"
        />
        
        {/* Bouton plein écran */}
        <button
          onClick={toggleFullscreen}
          className="absolute top-4 right-4 z-10 text-black bg-white rounded-lg shadow-lg p-2 hover:bg-gray-100 transition-colors duration-200"
          style={{
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            border: "none",
            cursor: "pointer"
          }}
          aria-label={isFullscreen ? "Quitter le plein écran" : "Plein écran"}
        >
          {isFullscreen ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
            </svg>
          )}
        </button>

        {/* Bouton de couche avec dropdown */}
        <div className="absolute bottom-1 right-4 z-10">
          <div className="relative">
            <button
              onClick={() => setIsLayerOpen(!isLayerOpen)}
              className="bg-white text-black rounded-lg shadow-lg p-2 hover:bg-gray-100 transition-colors duration-200 flex items-center gap-2"
              style={{
                boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                border: "none",
                cursor: "pointer"
              }}
              aria-label="Changer de couche"
            >
              {currentLayer === "street" ? (
                <Map className="h-5 w-5 text-blue-600" />
              ) : (
                <Satellite className="h-5 w-5 text-green-600" />
              )}
              <span className="text-xs font-medium hidden sm:inline">
                {currentLayer === "street" ? "Carte" : "Satellite"}
              </span>
              {isLayerOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
            
            {isLayerOpen && (
              <div className="absolute bottom-full right-0 mb-2 bg-white rounded-lg shadow-lg overflow-hidden min-w-36">
                <button
                  onClick={() => handleLayerChange("street")}
                  className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 hover:bg-gray-100 transition-colors ${
                    currentLayer === "street" ? "bg-blue-50 text-blue-600" : "text-black"
                  }`}
                >
                  <Map className="h-4 w-4" />
                  <span>Carte (OSM)</span>
                  {currentLayer === "street" && (
                    <Check className="h-3 w-3 ml-auto" />
                  )}
                </button>
                <button
                  onClick={() => handleLayerChange("satellite")}
                  className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 hover:bg-gray-100 transition-colors ${
                    currentLayer === "satellite" ? "bg-green-50 text-green-600" : "text-black"
                  }`}
                >
                  <Satellite className="h-4 w-4" />
                  <span>Satellite</span>
                  {currentLayer === "satellite" && (
                    <Check className="h-3 w-3 ml-auto" />
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Légende améliorée avec distinction claire */}
        <div className="absolute bottom-1 left-4 z-10">
          <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-lg overflow-hidden" style={{ minWidth: "180px" }}>

            {isLegendOpen && (
              <div className="px-3 pb-3 pt-1 space-y-2 text-[11px] border-t border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <span className="text-gray-700">H59 — Régime PR (conforme)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-amber-500" style={{ clipPath: "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)" }}></div>
                  <span className="text-gray-700">H61 — Régime DP (conforme)</span>
                </div>
                <div className="flex items-center gap-2 pt-1 border-t border-gray-100 mt-1">
                  <div className="relative">
                    <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                    <div className="absolute inset-0 rounded-full bg-purple-500 animate-ping opacity-75"></div>
                  </div>
                  <span className="text-gray-700 font-medium">⚠️ Doublon (anomalie)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                    <div className="absolute inset-0 rounded-full bg-amber-500 animate-ping opacity-75"></div>
                  </div>
                  <span className="text-gray-700 font-medium">⚠️ Divergence (anomalie)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                    <div className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-75"></div>
                  </div>
                  <span className="text-gray-700 font-medium">✨ Nouvel équipement (anomalie)</span>
                </div>
              </div>
            )}
                        <button
              onClick={() => setIsLegendOpen(!isLegendOpen)}
              className="w-full px-3 py-2 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <span className="text-xs font-semibold text-gray-700">📋 Légende</span>
              {isLegendOpen ? (
                <ChevronDown className="h-3 w-3 text-gray-500" />
              ) : (
                <ChevronUp className="h-3 w-3 text-gray-500" />
              )}
            </button>
            
          </div>
        </div>
      </div>
    </>
  );
}
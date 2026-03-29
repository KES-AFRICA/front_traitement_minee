"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Satellite, Check } from "lucide-react";
import { Map as LeafletMap } from "leaflet";

export interface EquipmentRecord {
  m_rid: string | number;
  name?: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
  type?: string;
  regime?: string;
  table?: string;
  feeder_id?: string | number;
  substation_id?: string | number;
  bay_mrid?: string | number;
  pole_id?: string | number;
  [key: string]: unknown;
}

interface FullscreenMapProps {
  equipments?: Record<string, unknown>[];
  onMarkerClick?: (equipment: Record<string, unknown>) => void;
}

type LayerType = "street" | "satellite";

// Couleur par type d'équipement
function getEquipmentColor(equip: EquipmentRecord): string {
  const table = equip.table || "";
  if (table === "substation") return "#3b82f6";
  if (table === "powertransformer") return "#8b5cf6";
  if (table === "busbar") return "#f59e0b";
  if (table === "bay") return "#10b981";
  if (table === "switch") return "#ef4444";
  if (table === "wire") return "#6b7280";
  if (table === "feeder") return "#06b6d4";
  if (table === "pole") return "#78716c";
  if (table === "node") return "#9ca3af";
  return "#6366f1";
}

// Forme SVG selon la table
function getMarkerShape(equip: EquipmentRecord): "circle" | "square" | "octagon" | "diamond" | "triangle" {
  const table = equip.table || "";
  if (table === "substation") return "circle";
  if (table === "powertransformer") return "square";
  if (table === "switch") return "octagon";
  if (table === "busbar") return "diamond";
  if (table === "pole") return "triangle";
  return "circle";
}

function createSVGIcon(equip: EquipmentRecord, L: any): any {
  const color = getEquipmentColor(equip);
  const shape = getMarkerShape(equip);

  let svgPath = "";
  if (shape === "circle") {
    svgPath = `<circle cx="14" cy="14" r="10" fill="${color}" stroke="white" stroke-width="2.5"/>`;
  } else if (shape === "square") {
    svgPath = `<rect x="4" y="4" width="20" height="20" rx="3" fill="${color}" stroke="white" stroke-width="2.5"/>`;
  } else if (shape === "diamond") {
    svgPath = `<polygon points="14,4 24,14 14,24 4,14" fill="${color}" stroke="white" stroke-width="2.5"/>`;
  } else if (shape === "triangle") {
    svgPath = `<polygon points="14,4 24,20 4,20" fill="${color}" stroke="white" stroke-width="2.5"/>`;
  } else {
    // octagon
    svgPath = `<polygon points="9,4 19,4 24,9 24,19 19,24 9,24 4,19 4,9" fill="${color}" stroke="white" stroke-width="2.5"/>`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="32" height="32">
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

// ─── Construction des connexions entre équipements ───────────────────────────
interface Connection {
  from: [number, number];
  to: [number, number];
  type: string;
}

function buildConnections(equipments: EquipmentRecord[]): Connection[] {
  const connections: Connection[] = [];
  
  // Filtrer les équipements avec coordonnées valides
  const withCoords = equipments.filter(eq => {
    const lat = parseFloat(String(eq.latitude ?? ""));
    const lng = parseFloat(String(eq.longitude ?? ""));
    return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
  });
  
  // Créer un index par m_rid pour les équipements avec coordonnées
  const coordsMap = new Map<string, [number, number]>();
  const equipmentMap = new Map<string, EquipmentRecord>();
  
  withCoords.forEach(eq => {
    const key = String(eq.m_rid);
    const lat = parseFloat(String(eq.latitude));
    const lng = parseFloat(String(eq.longitude));
    coordsMap.set(key, [lat, lng]);
    equipmentMap.set(key, eq);
  });
  
  // 1. Connexions Feeder → Substation (via feeder_id)
  const feeders = withCoords.filter(e => e.table === "feeder");
  const substations = withCoords.filter(e => e.table === "substation");
  
  substations.forEach(sub => {
    const feederId = String(sub.feeder_id);
    const feederCoords = coordsMap.get(feederId);
    const subCoords = coordsMap.get(String(sub.m_rid));
    
    if (feederCoords && subCoords) {
      connections.push({
        from: feederCoords,
        to: subCoords,
        type: "feeder-substation"
      });
    }
  });
  
  // 2. Connexions Feeder → Wire (via feeder_id)
  const wires = withCoords.filter(e => e.table === "wire");
  
  wires.forEach(wire => {
    const feederId = String(wire.feeder_id);
    const feederCoords = coordsMap.get(feederId);
    const wireCoords = coordsMap.get(String(wire.m_rid));
    
    if (feederCoords && wireCoords) {
      connections.push({
        from: feederCoords,
        to: wireCoords,
        type: "feeder-wire"
      });
    }
  });
  
  // 3. Connexions Feeder → Pole (via feeder_id)
  const poles = withCoords.filter(e => e.table === "pole");
  
  poles.forEach(pole => {
    const feederId = String(pole.feeder_id);
    const feederCoords = coordsMap.get(feederId);
    const poleCoords = coordsMap.get(String(pole.m_rid));
    
    if (feederCoords && poleCoords) {
      connections.push({
        from: feederCoords,
        to: poleCoords,
        type: "feeder-pole"
      });
    }
  });
  
  // 4. Connexions Substation → PowerTransformer (via substation_id)
  const transformers = withCoords.filter(e => e.table === "powertransformer");
  
  transformers.forEach(transfo => {
    const substationId = String(transfo.substation_id);
    const substationCoords = coordsMap.get(substationId);
    const transfoCoords = coordsMap.get(String(transfo.m_rid));
    
    if (substationCoords && transfoCoords) {
      connections.push({
        from: substationCoords,
        to: transfoCoords,
        type: "substation-transformer"
      });
    }
  });
  
  // 5. Connexions Substation → Busbar (via substation_id)
  const busbars = withCoords.filter(e => e.table === "busbar");
  
  busbars.forEach(busbar => {
    const substationId = String(busbar.substation_id);
    const substationCoords = coordsMap.get(substationId);
    const busbarCoords = coordsMap.get(String(busbar.m_rid));
    
    if (substationCoords && busbarCoords) {
      connections.push({
        from: substationCoords,
        to: busbarCoords,
        type: "substation-busbar"
      });
    }
  });
  
  // 6. Connexions Substation → Bay (via substation_id)
  const bays = withCoords.filter(e => e.table === "bay");
  
  bays.forEach(bay => {
    const substationId = String(bay.substation_id);
    const substationCoords = coordsMap.get(substationId);
    const bayCoords = coordsMap.get(String(bay.m_rid));
    
    if (substationCoords && bayCoords) {
      connections.push({
        from: substationCoords,
        to: bayCoords,
        type: "substation-bay"
      });
    }
  });
  
  // 7. Connexions Bay → Switch (via bay_mrid)
  const switches = withCoords.filter(e => e.table === "switch");
  
  switches.forEach(sw => {
    const bayId = String(sw.bay_mrid);
    const bayCoords = coordsMap.get(bayId);
    const swCoords = coordsMap.get(String(sw.m_rid));
    
    if (bayCoords && swCoords) {
      connections.push({
        from: bayCoords,
        to: swCoords,
        type: "bay-switch"
      });
    }
  });
  
  // 8. Connexions Wire → Pole (si un wire est relié à un pole, par proximité)
  wires.forEach(wire => {
    const wireCoords = coordsMap.get(String(wire.m_rid));
    if (!wireCoords) return;
    
    // Chercher le pole le plus proche
    let closestPole: EquipmentRecord | undefined;
    let minDistance = Infinity;
    
    poles.forEach(pole => {
      const poleCoords = coordsMap.get(String(pole.m_rid));
      if (!poleCoords) return;
      
      const distance = Math.hypot(
        wireCoords[0] - poleCoords[0],
        wireCoords[1] - poleCoords[1]
      );
      
      if (distance < minDistance && distance < 0.01) { // ~1km max
        minDistance = distance;
        closestPole = pole;
      }
    });
    
    if (closestPole) {
      const poleCoords = coordsMap.get(String(closestPole.m_rid));
      if (poleCoords) {
        connections.push({
          from: wireCoords,
          to: poleCoords,
          type: "wire-pole"
        });
      }
    }
  });
  
  // 9. Connexions Pole → Node (via pole_id)
  const nodes = withCoords.filter(e => e.table === "node");
  
  nodes.forEach(node => {
    const poleId = String(node.pole_id);
    const poleCoords = coordsMap.get(poleId);
    const nodeCoords = coordsMap.get(String(node.m_rid));
    
    if (poleCoords && nodeCoords) {
      connections.push({
        from: poleCoords,
        to: nodeCoords,
        type: "pole-node"
      });
    }
  });
  
  return connections;
}

function getConnectionColor(type: string): string {
  // Toutes les connexions ont la même couleur (violet)
  return "#8b5cf6";
}

export default function FullscreenMap({ equipments = [], onMarkerClick }: FullscreenMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const linesRef = useRef<any[]>([]);
  const tileLayerRef = useRef<any>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLegendOpen, setIsLegendOpen] = useState(false);
  const [isLayerOpen, setIsLayerOpen] = useState(false);
  const [currentLayer, setCurrentLayer] = useState<LayerType>("street");
  const [isMapReady, setIsMapReady] = useState(false);

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
        if (mapInstanceRef.current) {
          tileLayerRef.current = L.tileLayer(url, {
            attribution: attribution,
            maxZoom: 19,
          }).addTo(mapInstanceRef.current);
        }
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

  // Initialisation de la carte
  useEffect(() => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
      setIsMapReady(false);
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
      setIsMapReady(true);
    });

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      setIsMapReady(false);
    };
  }, [currentLayer]);

  // Ajout des marqueurs et des lignes
  useEffect(() => {
    if (!mapInstanceRef.current || !isMapReady) return;
    
    // Supprimer les anciens marqueurs et lignes
    markersRef.current.forEach(marker => {
      if (marker && mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(marker);
      }
    });
    linesRef.current.forEach(line => {
      if (line && mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(line);
      }
    });
    markersRef.current = [];
    linesRef.current = [];

    const points: [number, number][] = [];
    const newMarkers: any[] = [];

    // Vérifier que equipments existe et est un tableau
    const equipmentList: EquipmentRecord[] = (Array.isArray(equipments) ? equipments : []) as EquipmentRecord[];
    
    equipmentList.forEach((eq) => {
      const e = eq as EquipmentRecord;
      const lat = parseFloat(String(e.latitude ?? ""));
      const lng = parseFloat(String(e.longitude ?? ""));

      if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
        points.push([lat, lng]);
        
        import("leaflet").then((L) => {
          if (!mapInstanceRef.current) return;
          
          const icon = createSVGIcon(e, L);
          const marker = L.marker([lat, lng], { icon }).addTo(mapInstanceRef.current);
          
          // Construire le contenu du popup
          const allFields = Object.keys(e)
            .filter(k => !k.startsWith("_") && k !== "m_rid" && k !== "latitude" && k !== "longitude")
            .slice(0, 6);
          
          const fieldsHtml = allFields.map(k => `
            <div style="display:flex;justify-content:space-between;border-bottom:1px solid #eee;padding:2px 0">
              <span style="color:#666;font-size:10px">${k}:</span>
              <span style="font-family:monospace;font-size:10px">${String(e[k] || "—").substring(0, 30)}</span>
            </div>
          `).join("");
          
          const popupContent = `
            <div style="font-family:sans-serif;min-width:200px;max-width:280px">
              <div style="font-weight:700;font-size:14px;margin-bottom:6px;border-bottom:2px solid ${getEquipmentColor(e)};padding-bottom:4px;color:${getEquipmentColor(e)}">
                ${e.name || e.m_rid}
              </div>
              <div style="font-size:10px;color:#666;margin-bottom:8px">
                <span style="background:#f0f0f0;padding:2px 6px;border-radius:4px">${e.table || "équipement"}</span>
              </div>
              <div style="max-height:150px;overflow-y:auto">
                ${fieldsHtml || '<div style="color:#999;text-align:center">Aucune donnée supplémentaire</div>'}
              </div>
              <button 
                style="margin-top:8px;padding:6px 12px;background:#3b82f6;color:white;border:none;border-radius:6px;font-size:11px;cursor:pointer;width:100%;font-weight:500"
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
        });
      }
    });

    markersRef.current = newMarkers;

    // Tracer les connexions entre équipements
    setTimeout(() => {
      if (!mapInstanceRef.current) return;
      
      const connections = buildConnections(equipmentList);
      const newLines: any[] = [];
      
      import("leaflet").then((L) => {
        connections.forEach(conn => {
          const color = getConnectionColor(conn.type);
          const line = L.polyline([conn.from, conn.to], {
            color: color,
            weight: 2,
            opacity: 0.6,
            dashArray: "8 6",
          }).addTo(mapInstanceRef.current);
          newLines.push(line);
        });
        linesRef.current = newLines;
      });
    }, 200);

    if (typeof window !== 'undefined') {
      (window as any).__markerClickCallback = (eq: EquipmentRecord) => {
        if (onMarkerClick) {
          onMarkerClick(eq);
        }
      };
    }

    // Centrer la carte
    setTimeout(() => {
      if (!mapInstanceRef.current) return;
      
      if (points.length === 0) {
        mapInstanceRef.current.setView([4.06, 9.72], 6);
      } else if (points.length === 1) {
        mapInstanceRef.current.setView(points[0], 12);
      } else {
        import("leaflet").then((L) => {
          if (mapInstanceRef.current) {
            const bounds = L.latLngBounds(points);
            mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
          }
        });
      }
    }, 300);

    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).__markerClickCallback;
      }
    };
  }, [equipments, onMarkerClick, isMapReady]);

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
    <div ref={containerRef} className="relative w-full h-full">
      <div ref={mapRef} className="w-full h-full z-0" />
      
      {/* Bouton plein écran */}
      <button
        onClick={toggleFullscreen}
        className="absolute top-4 right-4 z-10 bg-white rounded-lg shadow-lg p-2 hover:bg-gray-100 transition-colors duration-200"
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
      <div className="absolute bottom-4 right-4 z-10">
        <div className="relative">
          <button
            onClick={() => setIsLayerOpen(!isLayerOpen)}
            className="bg-white rounded-lg shadow-lg p-2 hover:bg-gray-100 transition-colors duration-200 flex items-center gap-2"
            style={{
              boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
              border: "none",
              cursor: "pointer"
            }}
            aria-label="Changer de couche"
          >
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
                  currentLayer === "street" ? "bg-blue-50 text-blue-600" : ""
                }`}
              >
                <span>Carte (OSM)</span>
                {currentLayer === "street" && (
                  <Check className="h-3 w-3 ml-auto" />
                )}
              </button>
              <button
                onClick={() => handleLayerChange("satellite")}
                className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 hover:bg-gray-100 transition-colors ${
                  currentLayer === "satellite" ? "bg-green-50 text-green-600" : ""
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

      {/* Légende */}
      <div className="absolute bottom-4 left-4 z-10">
        <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-lg overflow-hidden" style={{ minWidth: "200px" }}>
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
          
          {isLegendOpen && (
            <div className="px-3 pb-3 pt-1 space-y-1.5 text-[11px] border-t border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-cyan-500"></div>
                <span className="text-gray-700">Feeder (Départ)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <span className="text-gray-700">Substation (Poste)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-purple-500 rounded-sm"></div>
                <span className="text-gray-700">Transformateur</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-amber-500" style={{ clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)" }}></div>
                <span className="text-gray-700">Bus Bar</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-emerald-500 rounded-sm"></div>
                <span className="text-gray-700">Bay (Travée)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500" style={{ clipPath: "polygon(25% 0%, 75% 0%, 100% 25%, 100% 75%, 75% 100%, 25% 100%, 0% 75%, 0% 25%)" }}></div>
                <span className="text-gray-700">Switch</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-0.5 bg-gray-500"></div>
                <span className="text-gray-700">Wire (Câble)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-stone-500" style={{ clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)" }}></div>
                <span className="text-gray-700">Pole (Poteau)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                <span className="text-gray-700">Node (Nœud)</span>
              </div>
              <div className="flex items-center gap-2 pt-1 border-t border-gray-100 mt-1">
                <div className="w-5 h-0.5 bg-purple-500" style={{ background: "#8b5cf6" }}></div>
                <span className="text-gray-700">Connexion (ligne)</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
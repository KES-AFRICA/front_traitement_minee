"use client";

import { useEffect, useRef, useState } from "react";

interface SubstationRecord {
  m_rid: string | number;
  name?: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
  type?: string;
  regime?: string;
  [key: string]: unknown;
}

interface FeederMapProps {
  substations: Record<string, unknown>[];
  feederId: string;
  onMarkerClick?: (substation: Record<string, unknown>) => void;
}

// Couleur par type de substation
function getSubstationColor(sub: SubstationRecord): string {
  const t = String(sub.type || "").toUpperCase();
  if (t.includes("H59")) return "#3b82f6"; // bleu
  if (t.includes("H61")) return "#f59e0b"; // amber
  if (t.includes("DP")) return "#10b981";  // vert
  return "#6366f1"; // violet default
}

// Forme SVG selon le régime
function getMarkerShape(sub: SubstationRecord): "circle" | "square" | "octagon" {
  const r = String(sub.regime || "").toUpperCase();
  if (r === "PR") return "circle";
  if (r === "DP") return "square";
  return "octagon";
}

function createSVGIcon(sub: SubstationRecord, L: any): any {
  const color = getSubstationColor(sub);
  const shape = getMarkerShape(sub);

  let svgPath = "";
  if (shape === "circle") {
    svgPath = `<circle cx="14" cy="14" r="10" fill="${color}" stroke="white" stroke-width="2"/>`;
  } else if (shape === "square") {
    svgPath = `<rect x="4" y="4" width="20" height="20" rx="3" fill="${color}" stroke="white" stroke-width="2"/>`;
  } else {
    // octagon
    svgPath = `<polygon points="9,4 19,4 24,9 24,19 19,24 9,24 4,19 4,9" fill="${color}" stroke="white" stroke-width="2"/>`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="28" height="28">
    ${svgPath}
    <circle cx="14" cy="14" r="3" fill="white" opacity="0.9"/>
  </svg>`;

  return L.divIcon({
    html: svg,
    className: "",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16],
  });
}

export default function FeederMap({ substations, feederId, onMarkerClick }: FeederMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

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
    if (!mapRef.current || mapInstanceRef.current) return;

    import("leaflet").then((L) => {
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

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;

      const points: [number, number][] = [];
      const markers: any[] = [];

      substations.forEach((sub) => {
        const s = sub as SubstationRecord;
        const lat = parseFloat(String(s.latitude ?? ""));
        const lng = parseFloat(String(s.longitude ?? ""));

        if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
          points.push([lat, lng]);
          const icon = createSVGIcon(s, L);
          const marker = L.marker([lat, lng], { icon }).addTo(map);

          const popupContent = `
            <div style="font-family:sans-serif;min-width:160px">
              <div style="font-weight:600;font-size:13px;margin-bottom:4px">${s.name || s.m_rid}</div>
              <div style="font-size:11px;color:#666">
                <div>ID : ${s.m_rid}</div>
                <div>Type : ${s.type || "—"}</div>
                <div>Régime : ${s.regime || "—"}</div>
                <div>Lat : ${lat.toFixed(4)}, Lon : ${lng.toFixed(4)}</div>
              </div>
              <button 
                id="marker-details-btn-${s.m_rid}"
                style="margin-top:8px;padding:4px 8px;background:#6366f1;color:white;border:none;border-radius:4px;font-size:10px;cursor:pointer;width:100%"
                onclick="window.__markerClickCallback && window.__markerClickCallback(${JSON.stringify(s).replace(/"/g, '&quot;')})"
              >
                Voir les détails →
              </button>
            </div>
          `;
          
          marker.bindPopup(popupContent);
          
          // Ajouter un événement click direct sur le marqueur
          marker.on('click', () => {
            if (onMarkerClick) {
              onMarkerClick(s);
            }
          });
          
          markers.push({ marker, lat, lng, data: s });
        }
      });

      // Définir le callback global pour les boutons dans les popups
      if (typeof window !== 'undefined') {
        (window as any).__markerClickCallback = (sub: SubstationRecord) => {
          if (onMarkerClick) {
            onMarkerClick(sub);
          }
        };
      }

      // Tracer une ligne entre tous les points (ordre par latitude)
      if (points.length >= 2) {
        const sorted = [...points].sort((a, b) => b[0] - a[0]);
        L.polyline(sorted, {
          color: "#6366f1",
          weight: 2,
          opacity: 0.6,
          dashArray: "6 4",
        }).addTo(map);
      }

      // Centrer la carte
      if (points.length === 0) {
        map.setView([4.06, 9.72], 13);
      } else if (points.length === 1) {
        map.setView(points[0], 14);
      } else {
        const bounds = L.latLngBounds(points);
        map.fitBounds(bounds, { padding: [30, 30] });
      }

      // Légende
      const legend = (L as any).control({ position: "bottomright" });
      legend.onAdd = () => {
        const div = L.DomUtil.create("div");
        div.style.cssText = "background:white;padding:6px 8px;border-radius:6px;font-size:10px;line-height:1.6;box-shadow:0 1px 4px rgba(0,0,0,.2)";
        div.innerHTML = `
          <div style="font-weight:600;margin-bottom:4px">Légende</div>
          <div>⬤ H59 — Régime PR</div>
          <div>■ H61 — Régime DP</div>
          <div>⬡ Autre</div>
          <div style="margin-top:4px;border-top:1px solid #eee;padding-top:4px">
            <span style="display:inline-block;width:20px;height:2px;background:#6366f1;vertical-align:middle"></span> Ligne du départ
          </div>
          <div style="margin-top:6px;font-size:9px;color:#666">Cliquez sur un marqueur pour voir les détails</div>
        `;
        return div;
      };
      legend.addTo(map);
    });

    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).__markerClickCallback;
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [substations, onMarkerClick]);

  // Mettre à jour les markers si les substations changent
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
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"
      />
      <div 
        ref={containerRef} 
        className="relative"
        style={{ 
          width: "100%", 
          height: "100%",
          position: "relative"
        }}
      >
        <div
          ref={mapRef}
          style={{ width: "100%", height: "100%" }}
          className="z-0"
        />
        
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
      </div>
    </>
  );
}
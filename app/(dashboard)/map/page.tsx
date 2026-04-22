"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import {
  Zap, Building2, MapPin, Filter, Search, ChevronDown,
  RefreshCw, XCircle, Loader2, AlertCircle, Calendar,
  ZoomIn, ZoomOut, ChevronLeft, ChevronRight,
} from "lucide-react";
import { Input }  from "@/components/ui/input";
import { Label }  from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge }  from "@/components/ui/badge";
import {
  Sheet, SheetContent, SheetDescription, SheetFooter,
  SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";

import { usePostesMap, useWiresMap, usePosteDetailLazy, useWireDetailLazy } from "@/hooks/useKobo";
import { buildPhotoUrl } from "@/lib/api/services/koboService";
import { PosteDetail, WireDetail, Busbar, WireMapItem } from "@/lib/types/kobo";
import { DateFilter } from "@/components/dashboard/date-filter";
import { DateRange, DateRangeType, useDateFilter } from "@/hooks/use-date-filter-map";
import React from "react";
import { REASDetailSheet, SupportDetailSheet, useREASDetail, useSupportDetail, WaypointClickData } from "@/components/map/support-reas-modal";

// ── Fonction de calcul de distance Haversine ─────────────────────────────────
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Rayon de la Terre en km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// ── Cache des longueurs des wires ───────────────────────────────────────────
const wireLengthCache = new Map<number, number>();

// ── Fonction pour calculer la longueur d'un wire ────────────────────────────
function calculateWireLength(wire: any): number {
  // Vérifier le cache
  if (wireLengthCache.has(wire.id)) {
    return wireLengthCache.get(wire.id)!;
  }
  
  let totalLength = 0;
  const segments = wire.segments ?? [];
  
  for (const segment of segments) {
    const coords = segment.coordinates ?? [];
    for (let i = 0; i < coords.length - 1; i++) {
      const [lng1, lat1] = coords[i];
      const [lng2, lat2] = coords[i+1];
      totalLength += haversineDistance(lat1, lng1, lat2, lng2);
    }
  }
  
  // Mettre en cache
  wireLengthCache.set(wire.id, totalLength);
  return totalLength;
}

// ── Fonction pour vider le cache ────────────────────────────────────────────
function clearWireLengthCache() {
  wireLengthCache.clear();
}

// ── Leaflet client-only ───────────────────────────────────────────────────────
const FullscreenMap = dynamic(
  () => import("@/components/map/fullscreen-map"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-muted/30 flex items-center justify-center animate-pulse">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
          <span className="text-sm text-muted-foreground">Chargement de la carte…</span>
        </div>
      </div>
    ),
  }
);

// ── Constantes ────────────────────────────────────────────────────────────────
const EXPLOITATIONS = [
  { id: "DLAO", label: "Douala Ouest" },
  { id: "DLAE", label: "Douala Est"   },
  { id: "YDE",  label: "Yaoundé Est"  },
  { id: "YDO",  label: "Yaoundé Ouest"},
  { id: "GAR",  label: "Garoua"       },
  { id: "BER",  label: "Bertoua"      },
  { id: "BAM",  label: "Bamenda"      },
];
const TYPES_POSTE = [
  { id: "H61", label: "H61 (Aérien)" },
  { id: "H59", label: "H59 (Cabine)" },
];
const REGIMES_POSTE = [
  { id: "publique", label: "Publique" },
  { id: "privee",   label: "Privée"   },
  { id: "mixte",    label: "Mixte"    },
];

// ── Helpers UI ────────────────────────────────────────────────────────────────
function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

// ── KPI card ──────────────────────────────────────────────────────────────────
function KpiCard({ value, label, color = "default" }: {
  value: number | string;
  label: string;
  color?: "default" | "purple" | "green" | "amber" | "blue" | "cyan";
}) {
  const colors = {
    default: "bg-muted/30",
    purple:  "bg-purple-50 border border-purple-100",
    green:   "bg-green-50 border border-green-100",
    amber:   "bg-amber-50 border border-amber-100",
    blue:    "bg-blue-50 border border-blue-100",
    cyan:    "bg-cyan-50 border border-cyan-100",
  };
  return (
    <div className={`${colors[color]} rounded-lg p-3 text-center`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">{label}</p>
    </div>
  );
}

// ── PhotoModal ────────────────────────────────────────────────────────────────
export function PhotoModal({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const [mounted, setMounted]   = useState(false);
  const [scale, setScale]       = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart]   = useState({ x: 0, y: 0 });
  const imageRef    = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }, [onClose]);
  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleZoomIn  = () => setScale(p => Math.min(p + 0.5, 4));
  const handleZoomOut = () => setScale(p => { const n = Math.max(p - 0.5, 0.5); if (n === 0.5) setPosition({ x: 0, y: 0 }); return n; });
  const handleReset   = () => { setScale(1); setPosition({ x: 0, y: 0 }); };
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => { if (scale > 1) { setIsDragging(true); setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y }); } };
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => { if (isDragging && scale > 1) setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y }); };
  const handleMouseUp   = () => setIsDragging(false);
  const handleWheel     = (e: React.WheelEvent<HTMLDivElement>) => { if (e.ctrlKey) { e.preventDefault(); e.deltaY < 0 ? handleZoomIn() : handleZoomOut(); } };

  if (!mounted) return null;
  return createPortal(
    <div ref={containerRef} className="fixed inset-0 bg-black/95 flex items-center justify-center" style={{ zIndex: 9999 }} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onWheel={handleWheel}>
      <div className="absolute top-4 right-4 flex items-center gap-2" style={{ zIndex: 10001, pointerEvents: "auto" }} onClick={e => e.stopPropagation()}>
        <button onClick={handleZoomOut} className="text-white bg-black/50 rounded-full p-2 hover:text-gray-300"><ZoomOut className="h-6 w-6" /></button>
        <button onClick={handleZoomIn}  className="text-white bg-black/50 rounded-full p-2 hover:text-gray-300"><ZoomIn  className="h-6 w-6" /></button>
        <button onClick={handleReset}   className="text-white bg-black/50 rounded-full p-2 text-xs font-medium min-w-9 hover:text-gray-300">1:1</button>
        <button onClick={onClose}       className="text-white bg-black/50 rounded-full p-2 hover:text-gray-300"><XCircle className="h-8 w-8" /></button>
      </div>
      <div className="relative w-full h-full flex items-center justify-center overflow-hidden" onMouseDown={handleMouseDown} style={{ cursor: scale > 1 ? (isDragging ? "grabbing" : "grab") : "default" }}>
        <img ref={imageRef} src={src} alt={alt} className="transition-transform duration-200 select-none"
          style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`, maxWidth: scale === 1 ? "90%" : "none", maxHeight: scale === 1 ? "90%" : "none" }}
          onClick={e => e.stopPropagation()} draggable={false} />
      </div>
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2" style={{ zIndex: 10001, pointerEvents: "auto" }} onClick={e => e.stopPropagation()}>
        <button onClick={e => { e.stopPropagation(); onClose(); }} className="text-white bg-black/50 rounded-lg px-4 py-2 text-sm">Fermer (Échap)</button>
        {scale > 1 && <div className="text-white bg-black/50 rounded-lg px-3 py-2 text-sm">{Math.round(scale * 100)}% · Glisser</div>}
      </div>
    </div>,
    document.body
  );
}

// ── PhotoThumb ────────────────────────────────────────────────────────────────
export function PhotoThumb({ src, alt }: { src: string | null | undefined; alt: string }) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading]       = useState(false);
  const url = buildPhotoUrl(src);
  if (!url) return null;
  return (
    <>
      <div className="relative w-full h-72 rounded-lg overflow-hidden border bg-gray-500/20 cursor-pointer hover:opacity-90 transition-opacity" onClick={e => { e.stopPropagation(); setIsFullscreen(true); }}>
        <div className="absolute inset-0 z-10 overflow-hidden">
          <div className="absolute inset-0 animate-pulse bg-gray-500/10" />
          <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.12) 50%, transparent 65%)", animation: "shimmer 1.6s ease-in-out infinite" }} />
        </div>
        <img src={url} alt={alt} className="w-full h-full object-cover transition-opacity z-20 relative" style={{ opacity: isLoading ? 0 : 1 }}
          onLoadStart={() => setIsLoading(true)} onLoad={() => setIsLoading(false)} loading="lazy" />
      </div>
      {isFullscreen && <PhotoModal src={url} alt={alt} onClose={() => setIsFullscreen(false)} />}
    </>
  );
}

// ── DetailSheet (Poste) ───────────────────────────────────────────────────────
function DetailSheet({
  substationId,
  isOpen,
  onClose,
  poste,
  loading,
  error,
}: {
  substationId: string | null;
  isOpen:       boolean;
  onClose:      () => void;
  poste:        PosteDetail | null;
  loading:      boolean;
  error:        string | null;
}) {
  const [isGenieCivilPhotosOpen, setIsGenieCivilPhotosOpen] = React.useState(false);

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent
        side="right"
        className="w-[95vw]! sm:w-[90vw]! max-w-none! flex flex-col p-0 overflow-hidden"
      >
        <SheetHeader className="px-5 py-4 border-b shrink-0">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-blue-500" />
            <SheetTitle className="text-base">
              {poste?.substation_name ?? poste?.substation_id ?? substationId ?? "Poste"}
            </SheetTitle>
          </div>
          <SheetDescription>
            {poste
              ? `${poste.type ?? ""} · ${poste.feeder_name ?? poste.feeder ?? ""} · ${poste.exploitation ?? ""}`
              : "Chargement des détails…"}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          {loading && (
            <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span>Chargement…</span>
            </div>
          )}

          {error && !loading && (
            <div className="flex items-start gap-3 p-4 bg-destructive/10 rounded-lg text-destructive">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {poste && !loading && (
            <>
              {/* ==================== PHOTO PRINCIPALE + INFOS ==================== */}
              <div className="flex flex-col sm:flex-row gap-5">
                <div className="sm:w-1/3">
                  <PhotoThumb src={poste.photos.photo_poste} alt="Photo du poste" />
                </div>
                <div className="sm:w-2/3 space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <Field label="Substation ID" value={poste.substation_id} />
                    <Field label="Substation name" value={poste.substation_name} />
                    <Field label="Feeder name" value={poste.feeder_name} />
                    <Field label="Type" value={poste.type} />
                    <Field label="Type H61" value={poste.type_poste_H61} />
                    <Field label="Exploitation" value={poste.exploitation} />
                    <Field label="Régime" value={poste.regime} />
                    <Field label="Régime poste" value={poste.regime_poste} />
                    <Field label="Zone" value={poste.zone_type} />
                    <Field label="ID2" value={poste.ID2} />
                    <Field label="Accès" value={poste.statut_acces} />
                    <Field label="Terre neutre BT" value={poste.terre_neutre_bt} />
                    <Field label="Terre masse" value={poste.terre_masse} />
                    {poste.latitude && poste.longitude && (
                      <div className="col-span-2">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">GPS</p>
                        <p className="text-sm font-mono">
                          {poste.latitude.toFixed(6)}, {poste.longitude.toFixed(6)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ==================== APPAREILLAGE HTA + SUPPORT & ARMEMENT ==================== */}
              {((poste.appareillage.parafoudre ||
                poste.appareillage.etat_parafoudre ||
                poste.appareillage.tableau_bt ||
                poste.appareillage.detecteur_defaut ||
                poste.appareillage.coupe_circuit ||
                poste.appareillage.disjoncteur_hp ||
                poste.appareillage.pmr ||
                poste.appareillage.photo_appareillage) ||
                (poste.support.hauteur ||
                poste.support.etat ||
                poste.support.type_support ||
                poste.armement.type ||
                poste.armement.etat ||
                poste.armement.atronconnement)) && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider border-b pb-1">
                    Appareillage HTA & Support / Armement
                  </h3>
                  <div className="border rounded-lg p-4 bg-card">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <div className="w-1 h-5 bg-blue-500 rounded-full"></div>
                          <p className="text-sm font-medium">Appareillage HTA</p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3">
                          <div className="sm:w-1/2">
                            <PhotoThumb src={poste.appareillage.photo_appareillage} alt="Appareillage" />
                          </div>
                          <div className="sm:w-1/2">
                            <div className="grid grid-cols-2 gap-2">
                              <Field label="Parafoudre" value={poste.appareillage.parafoudre} />
                              <Field label="État parafoudre" value={poste.appareillage.etat_parafoudre} />
                              <Field label="Tableau BT" value={poste.appareillage.tableau_bt} />
                              <Field label="Détecteur défaut" value={poste.appareillage.detecteur_defaut} />
                              <Field label="Coupe-circuit" value={poste.appareillage.coupe_circuit} />
                              <Field label="Disjoncteur HP" value={poste.appareillage.disjoncteur_hp} />
                              <Field label="PMR" value={poste.appareillage.pmr} />
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <div className="w-1 h-5 bg-green-500 rounded-full"></div>
                          <p className="text-sm font-bold">Support & Armement</p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="bg-muted/20 rounded-lg p-3">
                            <p className="text-xs font-bold mb-2">Support</p>
                            <div className="space-y-1">
                              <Field label="Hauteur" value={poste.support.hauteur ? `${poste.support.hauteur} m` : null} />
                              <Field label="État" value={poste.support.etat} />
                              <Field label="Type" value={poste.support.type_support} />
                            </div>
                          </div>
                          <div className="bg-muted/20 rounded-lg p-3">
                            <p className="text-xs font-bold mb-2">Armement</p>
                            <div className="space-y-1">
                              <Field label="Type" value={poste.armement.type} />
                              <Field label="État" value={poste.armement.etat} />
                              <Field label="Atronconnement" value={poste.armement.atronconnement} />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ==================== GÉNIE CIVIL ==================== */}
              {poste.genie_civil && (() => {
                const hasGenieData = !!(
                  poste.genie_civil?.superficie_batie ||
                  poste.genie_civil?.voies?.type ||
                  poste.genie_civil?.voies?.largeur ||
                  poste.genie_civil?.voies?.longueur ||
                  poste.genie_civil?.voies?.surface ||
                  poste.genie_civil?.voies?.observation ||
                  poste.genie_civil?.batiment?.toiture ||
                  poste.genie_civil?.batiment?.peinture_exterieur ||
                  poste.genie_civil?.batiment?.etat_peinture_ext ||
                  poste.genie_civil?.batiment?.portes ||
                  poste.genie_civil?.batiment?.degradation_portes ||
                  poste.genie_civil?.batiment?.structure_murs ||
                  poste.genie_civil?.batiment?.etat_murs ||
                  poste.genie_civil?.batiment?.bouches_ventilation ||
                  poste.genie_civil?.batiment?.nb_bouches ||
                  poste.genie_civil?.batiment?.etat_bouches ||
                  poste.genie_civil?.batiment?.type_degrade_bouches ||
                  poste.genie_civil?.batiment?.peinture_interieur ||
                  poste.genie_civil?.batiment?.etat_peinture_int ||
                  poste.genie_civil?.batiment?.dalle_couverture ||
                  poste.genie_civil?.batiment?.revetement ||
                  poste.genie_civil?.batiment?.etat_revetement ||
                  poste.genie_civil?.batiment?.cloture ||
                  poste.genie_civil?.batiment?.ouvrage_drainage ||
                  poste.genie_civil?.batiment?.galeries_cables ||
                  poste.genie_civil?.batiment?.type_galeries ||
                  poste.genie_civil?.batiment?.etat_galeries ||
                  poste.genie_civil?.batiment?.acces ||
                  poste.genie_civil?.batiment?.type_acces ||
                  poste.genie_civil?.batiment?.etat_acces ||
                  poste.genie_civil?.equipements_local?.interrupteurs ||
                  poste.genie_civil?.equipements_local?.lampes ||
                  poste.genie_civil?.equipements_local?.etat_lampes ||
                  poste.genie_civil?.equipements_local?.extracteur_air ||
                  poste.genie_civil?.equipements_local?.coffret ||
                  Object.keys(poste.genie_civil?.photos || {}).length > 0
                );
                return hasGenieData;
              })() && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider border-b pb-1">Génie civil</h3>
                  {poste.genie_civil.superficie_batie && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      <Field label="Superficie bâtie" value={`${poste.genie_civil.superficie_batie} m²`} />
                    </div>
                  )}
                  {(poste.genie_civil.voies.type || poste.genie_civil.voies.largeur || poste.genie_civil.voies.longueur || poste.genie_civil.voies.surface || poste.genie_civil.voies.observation) && (
                    <div className="border rounded-lg p-3">
                      <p className="text-sm font-medium mb-2">Voies d'accès</p>
                      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                        <Field label="Type" value={poste.genie_civil.voies.type} />
                        <Field label="Largeur" value={poste.genie_civil.voies.largeur ? `${poste.genie_civil.voies.largeur} m` : null} />
                        <Field label="Longueur" value={poste.genie_civil.voies.longueur ? `${poste.genie_civil.voies.longueur} m` : null} />
                        <Field label="Surface" value={poste.genie_civil.voies.surface ? `${poste.genie_civil.voies.surface} m²` : null} />
                        <Field label="Observation" value={poste.genie_civil.voies.observation} />
                      </div>
                    </div>
                  )}
                  {(poste.genie_civil.batiment.toiture || poste.genie_civil.batiment.peinture_exterieur || poste.genie_civil.batiment.etat_peinture_ext || poste.genie_civil.batiment.portes) && (
                    <div className="border rounded-lg p-3">
                      <p className="text-sm font-bold mb-2">Bâtiment</p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
                        <Field label="Toiture" value={poste.genie_civil.batiment.toiture} />
                        <Field label="Peinture extérieure" value={poste.genie_civil.batiment.peinture_exterieur} />
                        <Field label="État peinture ext" value={poste.genie_civil.batiment.etat_peinture_ext} />
                        <Field label="Portes" value={poste.genie_civil.batiment.portes} />
                        <Field label="Dégradation portes" value={poste.genie_civil.batiment.degradation_portes} />
                        <Field label="Structure murs" value={poste.genie_civil.batiment.structure_murs} />
                        <Field label="État murs" value={poste.genie_civil.batiment.etat_murs} />
                        <Field label="Bouches ventilation" value={poste.genie_civil.batiment.bouches_ventilation} />
                        <Field label="Nb bouches" value={poste.genie_civil.batiment.nb_bouches} />
                        <Field label="État bouches" value={poste.genie_civil.batiment.etat_bouches} />
                        <Field label="Type dégradation bouches" value={poste.genie_civil.batiment.type_degrade_bouches} />
                        <Field label="Peinture intérieure" value={poste.genie_civil.batiment.peinture_interieur} />
                        <Field label="État peinture int" value={poste.genie_civil.batiment.etat_peinture_int} />
                        <Field label="Dalle couverture" value={poste.genie_civil.batiment.dalle_couverture} />
                        <Field label="Revetement" value={poste.genie_civil.batiment.revetement} />
                        <Field label="État revetement" value={poste.genie_civil.batiment.etat_revetement} />
                        <Field label="Clôture" value={poste.genie_civil.batiment.cloture} />
                        <Field label="Ouvrage drainage" value={poste.genie_civil.batiment.ouvrage_drainage} />
                        <Field label="Galeries câbles" value={poste.genie_civil.batiment.galeries_cables} />
                        <Field label="Type galeries" value={poste.genie_civil.batiment.type_galeries} />
                        <Field label="État galeries" value={poste.genie_civil.batiment.etat_galeries} />
                        <Field label="Accès" value={poste.genie_civil.batiment.acces} />
                        <Field label="Type accès" value={poste.genie_civil.batiment.type_acces} />
                        <Field label="État accès" value={poste.genie_civil.batiment.etat_acces} />
                      </div>
                    </div>
                  )}
                  {(poste.genie_civil.equipements_local.interrupteurs || poste.genie_civil.equipements_local.lampes || poste.genie_civil.equipements_local.extracteur_air) && (
                    <div className="border rounded-lg p-3">
                      <p className="text-sm font-bold mb-2">Équipements locaux</p>
                      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                        <Field label="Interrupteurs" value={poste.genie_civil.equipements_local.interrupteurs} />
                        <Field label="Lampes" value={poste.genie_civil.equipements_local.lampes} />
                        <Field label="État lampes" value={poste.genie_civil.equipements_local.etat_lampes} />
                        <Field label="Extracteur air" value={poste.genie_civil.equipements_local.extracteur_air} />
                        <Field label="Coffret" value={poste.genie_civil.equipements_local.coffret} />
                      </div>
                    </div>
                  )}
                  {Object.keys(poste.genie_civil.photos).length > 0 && (
                    <div className="border rounded-lg overflow-hidden">
                      <button
                        onClick={() => setIsGenieCivilPhotosOpen(!isGenieCivilPhotosOpen)}
                        className="w-full flex items-center justify-between p-3 bg-muted/20 hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold">📷 Photos du génie civil</span>
                          <Badge variant="secondary" className="text-xs">{Object.keys(poste.genie_civil.photos).length}</Badge>
                        </div>
                        <svg className={`h-4 w-4 transition-transform duration-200 ${isGenieCivilPhotosOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {isGenieCivilPhotosOpen && (
                        <div className="p-3 border-t">
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                            {Object.entries(poste.genie_civil.photos).map(([key, path]) => (
                              <PhotoThumb key={key} src={path} alt={key} />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ==================== BUSBARS ==================== */}
              {poste.busbars && poste.busbars.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider border-b pb-1">Jeux de barres ({poste.busbars.length})</h3>
                  <div className="grid grid-cols-1 gap-3">
                    {poste.busbars.map((busbar: Busbar) => (
                      <div key={busbar.id} className="border rounded-lg p-2 bg-muted/10 hover:shadow-md transition-shadow">
                        <div className="mt-2 flex flex-col md:flex-row gap-3 text-xs">
                          <p className="text-sm font-semibold text-blue-600">{busbar.name || busbar.id}</p>
                          <p><span className="text-sm font-bold">ID:</span> {busbar.id}</p>
                          {busbar.voltage_level && <p><span className="text-sm font-bold">Tension:</span> {busbar.voltage_level} kV</p>}
                          {busbar.phase && <p><span className="text-sm font-bold">Phase:</span> {busbar.phase}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ==================== CELLULES ==================== */}
              {poste.cellules.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider border-b pb-1">Cellules ({poste.cellules.length})</h3>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {poste.cellules.map((c, i) => (
                      <div key={i} className="border rounded-lg p-3 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-semibold">{c.nom_cellule ?? c.bay_id}</p>
                          <Badge variant="outline">{c.type_bay}</Badge>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3">
                          <div className="sm:w-1/3"><PhotoThumb src={c.photo_bay} alt={`Cellule ${c.bay_id}`} /></div>
                          <div className="sm:w-2/3">
                            <div className="grid grid-cols-2 gap-2">
                              <Field label="Fabricant" value={c.fabricant} />
                              <Field label="Modèle" value={c.modele} />
                              <Field label="Commande" value={c.commande} />
                              <Field label="État visuel" value={c.etat_visuel} />
                              <Field label="Signalisation" value={c.signalisation} />
                            </div>
                            {c.busbar && (
                              <div className="mt-2 pt-2 border-t">
                                <p className="text-[10px] uppercase">Jeux de barres associé</p>
                                <p className="text-sm font-medium text-blue-600">{c.busbar.name || c.busbar.id}</p>
                                {c.busbar.voltage_level && <p className="text-xs text-muted-foreground">{c.busbar.voltage_level} kV</p>}
                              </div>
                            )}
                          </div>
                        </div>
                        {c.switches.length > 0 && (
                          <div className="mt-3 pt-2 border-t">
                            <p className="text-[10px] text-muted-foreground uppercase mb-1">OCR ({c.switches.length})</p>
                            <div className="flex flex-wrap gap-2">
                              {c.switches.map((sw, j) => (
                                <div key={j} className="text-xs bg-muted/30 rounded px-2 py-1">
                                  <span className="font-medium">{sw.nom}</span>
                                  <span className="text-muted-foreground ml-1">({sw.type})</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ==================== TRANSFORMATEURS ==================== */}
              {poste.transformateurs.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider border-b pb-1">Transformateurs ({poste.transformateurs.length})</h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {poste.transformateurs.map((t, i) => (
                      <div key={i} className="border rounded-lg p-3 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-semibold">{t.nom ?? `Transfo ${i + 1}`}</p>
                          <Badge variant={t.actif === "TRUE" ? "default" : "secondary"}>{t.actif === "TRUE" ? "Actif" : "Inactif"}</Badge>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3">
                          <div className="sm:w-1/3"><PhotoThumb src={t.photo_transfo} alt={`Transformateur ${t.nom}`} /></div>
                          <div className="sm:w-2/3">
                            <div className="grid grid-cols-2 gap-2">
                              <Field label="Puissance" value={t.puissance_kva ? `${t.puissance_kva} kVA` : null} />
                              <Field label="Tension primaire" value={t.tension_primaire_kv ? `${t.tension_primaire_kv} kV` : null} />
                              <Field label="Tension secondaire" value={t.tension_secondaire_kv ? `${t.tension_secondaire_kv} kV` : null} />
                              <Field label="Marque" value={t.marque} />
                              <Field label="Type" value={t.type} />
                              <Field label="Refroidissement" value={t.refroidissement} />
                              <Field label="État visuel" value={t.etat_visuel} />
                              <Field label="Relai protection" value={t.relai_protection} />
                              <Field label="Intervention" value={t.type_intervention} />
                              <Field label="Remplacement planifié" value={t.remplacement_planifie} />
                              <Field label="ID Transformer" value={t.id_transformer} />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ==================== TABLEAUX BT ==================== */}
              {poste.bt_boards.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider border-b pb-1">Tableaux BT ({poste.bt_boards.length})</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {poste.bt_boards.map((bt, i) => (
                      <div key={i} className="border rounded-lg p-3 hover:shadow-md transition-shadow">
                        <PhotoThumb src={bt.photo} alt={`Tableau BT ${i + 1}`} />
                        <div className="mt-2 space-y-1">
                          <Field label="Type" value={bt.type} />
                          <Field label="Capacité" value={bt.capacity} />
                          <Field label="Actif" value={bt.actif} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ==================== CLIENT COMMERCIAL ==================== */}
              {poste.client_commercial && (() => {
                const hasClientData = !!(poste.client_commercial?.nom_client || poste.client_commercial?.type_client || poste.client_commercial?.activite);
                return hasClientData;
              })() && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider border-b pb-1">Client commercial</h3>
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                    <Field label="Nom client" value={poste.client_commercial.nom_client} />
                    <Field label="Type client" value={poste.client_commercial.type_client} />
                    <Field label="Activité" value={poste.client_commercial.activite} />
                    <Field label="Téléphone" value={poste.client_commercial.telephone} />
                    <Field label="Type compteur" value={poste.client_commercial.type_compteur} />
                    <Field label="N° compteur" value={poste.client_commercial.mrid_compteur} />
                    <Field label="Statut compteur" value={poste.client_commercial.statut_compteur} />
                    <Field label="Statut scellé" value={poste.client_commercial.statut_scelle} />
                    <Field label="N° scellé" value={poste.client_commercial.numero_scelle} />
                    <Field label="Disjoncteur" value={poste.client_commercial.disjoncteur} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mt-2">
                    <PhotoThumb src={poste.client_commercial.photo_disjoncteur} alt="Disjoncteur" />
                    <PhotoThumb src={poste.client_commercial.photo_ensemble} alt="Ensemble" />
                    <PhotoThumb src={poste.client_commercial.photo_index} alt="Index compteur" />
                  </div>
                </div>
              )}

              {/* ==================== MÉTADONNÉES ==================== */}
              {(poste.meta.kobo_id || poste.meta.uuid || poste.meta.submitted_by || poste.meta.submission_time || poste.meta.version) && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider border-b pb-1">Métadonnées</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="ID Kobo" value={String(poste.meta.kobo_id ?? "")} />
                    <Field label="UUID" value={poste.meta.uuid} />
                    <Field label="Saisi par" value={poste.meta.submitted_by} />
                    <Field label="Date saisie" value={poste.meta.submission_time} />
                    <Field label="Version" value={poste.meta.version} />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <SheetFooter className="px-5 py-4 border-t shrink-0">
          <Button variant="outline" className="w-full" onClick={onClose}>Fermer</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ── WireDetailSheet ───────────────────────────────────────────────────────────
function WireDetailSheet({
  wireId, isOpen, onClose, wire, loading, error,
}: {
  wireId:  number | null;
  isOpen:  boolean;
  onClose: () => void;
  wire:    WireDetail | null;
  loading: boolean;
  error:   string | null;
}) {
  // Calculer la longueur du wire si elle n'est pas déjà dans l'objet
  const wireLength = useMemo(() => {
    if (wire?.length_km) return wire.length_km;
    if (wire) return calculateWireLength(wire);
    return null;
  }, [wire]);

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-[95vw]! sm:w-[90vw]! max-w-none! flex flex-col p-0 overflow-hidden">
        <SheetHeader className="px-5 py-4 border-b shrink-0">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-purple-500" />
            <SheetTitle className="text-base">Ligne {wire?.feeder?.name ?? `#${wireId}`}</SheetTitle>
          </div>
          <SheetDescription>
            {wire ? `${wire.stats.troncons_count} tronçon(s) · ${wire.type === "aerien" ? "Aérienne" : wire.type === "souterrain" ? "Souterraine" : "Mixte"}` : "Chargement des détails…"}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          {loading && (
            <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" /><span>Chargement…</span>
            </div>
          )}
          {error && !loading && (
            <div className="flex items-start gap-3 p-4 bg-destructive/10 rounded-lg text-destructive">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" /><p className="text-sm">{error}</p>
            </div>
          )}
          {wire && !loading && (
            <>
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b pb-1">Informations générales</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <Field label="ID Kobo" value={String(wire.id)} />
                  <Field label="Feeder" value={wire.feeder.name} />
                  <Field label="Tension" value={wire.feeder.tension_kv ? `${wire.feeder.tension_kv} kV` : null} />
                  <Field label="Phase" value={wire.feeder.phase} />
                  {/* Longueur en gras */}
                  {wireLength !== null && (
                    <div className="col-span-2 md:col-span-1">
                      <div className="bg-cyan-50 rounded-lg p-2 text-center border border-cyan-200">
                        <p className="text-[10px] text-cyan-600 uppercase tracking-wide font-semibold">Longueur totale</p>
                        <p className="text-lg font-bold text-cyan-700">{wireLength.toFixed(2)} km</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b pb-1">Point de départ</h3>
                  <div className="border rounded-lg p-4 bg-card">
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant={wire.debut.type === "poste" ? "default" : "secondary"}>{wire.debut.type || "N/A"}</Badge>
                      {wire.debut.code && <span className="text-sm font-mono">{wire.debut.code}</span>}
                    </div>
                    {wire.debut.coordinates.latitude && wire.debut.coordinates.longitude && (
                      <p className="text-xs text-muted-foreground mb-3">📍 {wire.debut.coordinates.latitude.toFixed(6)}, {wire.debut.coordinates.longitude.toFixed(6)}</p>
                    )}
                    {wire.debut.type === "poste" && (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-3 border-t">
                        <Field label="Substation ID" value={wire.debut.details.substation_id as string} />
                        <Field label="Substation" value={wire.debut.details.substation_name as string} />
                        <Field label="Feeder" value={wire.debut.details.feeder_name as string} />
                        <Field label="Type poste" value={wire.debut.details.type_poste as string} />
                        <Field label="Exploitation" value={wire.debut.details.exploitation as string} />
                        <Field label="Régime" value={wire.debut.details.regime as string} />
                        <Field label="Zone" value={wire.debut.details.zone_type as string} />
                        <Field label="Bay" value={wire.debut.details.bay_name as string || wire.debut.details.bay as string} />
                        <Field label="Busbar" value={wire.debut.details.busbar as string} />
                        <Field label="Transformateur" value={wire.debut.details.powertransformer_name as string} />
                        <Field label="ID2" value={wire.debut.details.ID2 as string} />
                        <Field label="Tension" value={wire.debut.details.tension_kv ? `${wire.debut.details.tension_kv} kV` : null} />
                      </div>
                    )}
                    {wire.debut.photo && (
                      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                        <PhotoThumb src={wire.debut.photo} alt="Photo début" />
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b pb-1">Point d'arrivée</h3>
                  <div className="border rounded-lg p-4 bg-card">
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant={wire.fin.type === "poste" ? "default" : "secondary"}>{wire.fin.type || "N/A"}</Badge>
                      {(wire.fin.details.code as string) && <span className="text-sm font-mono">{wire.fin.details.code as string}</span>}
                    </div>
                    {wire.fin.coordinates.latitude && wire.fin.coordinates.longitude && (
                      <p className="text-xs text-muted-foreground mb-3">📍 {wire.fin.coordinates.latitude.toFixed(6)}, {wire.fin.coordinates.longitude.toFixed(6)}</p>
                    )}
                    {wire.fin.type === "poste" && (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-3 border-t">
                        <Field label="Substation ID" value={wire.fin.details.substation_id as string} />
                        <Field label="Substation" value={wire.fin.details.substation_name as string} />
                        <Field label="Type poste" value={wire.fin.details.type_poste as string} />
                        <Field label="Exploitation" value={wire.fin.details.exploitation as string} />
                        <Field label="Régime" value={wire.fin.details.regime as string} />
                        <Field label="Zone" value={wire.fin.details.zone_type as string} />
                        <Field label="Bay" value={wire.fin.details.bay_name as string || wire.fin.details.bay as string} />
                        <Field label="Cellule" value={wire.fin.details.cellule as string} />
                        <Field label="Transformateur" value={wire.fin.details.powertransformer_name as string} />
                        <Field label="ID2" value={wire.fin.details.ID2 as string} />
                        <Field label="Tension" value={wire.fin.details.tension_kv ? `${wire.fin.details.tension_kv} kV` : null} />
                      </div>
                    )}
                    {wire.fin.photos && (
                      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                        {wire.fin.photos.photo && <PhotoThumb src={wire.fin.photos.photo} alt="Photo arrivée" />}
                        {wire.fin.photos.photo_armement && <PhotoThumb src={wire.fin.photos.photo_armement} alt="Armement arrivée" />}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {wire.troncons.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b pb-1">Tronçons ({wire.troncons.length})</h3>
                  <div className="grid grid-cols-1 gap-4">
                    {wire.troncons.map((troncon, idx) => (
                      <div key={idx} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-sm font-semibold">Tronçon #{troncon.index}</p>
                          <Badge variant={troncon.type === "aerien" ? "default" : troncon.type === "souterrain" ? "secondary" : "outline"}>
                            {troncon.type === "aerien" ? "Aérien" : troncon.type === "souterrain" ? "Souterrain" : "Remontée"}
                          </Badge>
                        </div>
                        {troncon.aerien && (
                          <div className="space-y-3">
                            {troncon.aerien.cable && (
                              <div className="bg-muted/20 rounded-lg p-3">
                                <p className="text-xs font-semibold mb-2">Câble</p>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                  <Field label="Nature" value={troncon.aerien.cable.nature} />
                                  <Field label="Section" value={troncon.aerien.cable.section} />
                                  <Field label="Isolant" value={troncon.aerien.cable.isolant} />
                                </div>
                              </div>
                            )}
                            {troncon.supports && troncon.supports.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold mb-2">{troncon.supports.length} support(s)</p>
                                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                  {troncon.supports.map((sup, si) => (
                                    <div key={si} className="border rounded-lg p-3 bg-muted/10">
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="font-medium text-sm">Support #{sup.index}</span>
                                        {sup.hauteur && <Badge variant="outline">{sup.hauteur} m</Badge>}
                                      </div>
                                      {sup.position && (
                                        <p className="text-[10px] text-muted-foreground mb-2">📍 {sup.position.latitude.toFixed(5)}, {sup.position.longitude.toFixed(5)}</p>
                                      )}
                                      <div className={`grid grid-cols-1 ${(sup.photo ? 1 : 0) + (sup.armement?.photo ? 1 : 0) > 1 ? "md:grid-cols-2" : ""} gap-4`}>
                                        {sup.photo && <PhotoThumb src={sup.photo} alt={`Support ${sup.index}`} />}
                                        {sup.armement?.photo && <div className="mt-2"><PhotoThumb src={sup.armement.photo} alt="Armement" /></div>}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                        {troncon.souterrain && (
                          <div className="space-y-3">
                            {troncon.souterrain.cable && (
                              <div className="bg-muted/20 rounded-lg p-3">
                                <p className="text-xs font-semibold mb-2">Câble</p>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                  <Field label="Nature" value={troncon.souterrain.cable.nature} />
                                  <Field label="Section" value={troncon.souterrain.cable.section} />
                                  <Field label="Isolant" value={troncon.souterrain.cable.isolant} />
                                  <Field label="Pose" value={troncon.souterrain.cable.pose} />
                                  <Field label="Profondeur" value={troncon.souterrain.cable.profondeur} />
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                        {troncon.remontee && (
                          <div className="space-y-3">
                            <div className="bg-muted/20 rounded-lg p-3">
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                <Field label="Barcode" value={troncon.remontee.support?.barcode} />
                                <Field label="Sens" value={troncon.remontee.support?.sens} />
                                <Field label="Hauteur" value={troncon.remontee.support?.hauteur} />
                                <Field label="Type" value={troncon.remontee.support?.type_remontee} />
                                <Field label="État" value={troncon.remontee.support?.etat_remontee} />
                                <Field label="Câble nature" value={troncon.remontee.cable?.nature} />
                                <Field label="Câble section" value={troncon.remontee.cable?.section} />
                              </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                              {troncon.remontee.support?.photo && <PhotoThumb src={troncon.remontee.support.photo} alt="Support REAS" />}
                              {troncon.remontee.armement?.photo && <PhotoThumb src={troncon.remontee.armement.photo} alt="Armement REAS" />}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b pb-1">Statistiques</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-muted/30 rounded-lg p-3 text-center"><p className="text-2xl font-bold">{wire.stats.troncons_count}</p><p className="text-[10px] text-muted-foreground uppercase">Tronçons</p></div>
                  <div className="bg-muted/30 rounded-lg p-3 text-center"><p className="text-2xl font-bold">{wire.stats.supports_count}</p><p className="text-[10px] text-muted-foreground uppercase">Supports</p></div>
                  <div className="bg-muted/30 rounded-lg p-3 text-center"><p className="text-2xl font-bold">{wire.stats.total_waypoints}</p><p className="text-[10px] text-muted-foreground uppercase">Points GPS</p></div>
                  <div className="bg-muted/30 rounded-lg p-3 text-center"><p className="text-2xl font-bold">{wire.stats.total_photos}</p><p className="text-[10px] text-muted-foreground uppercase">Photos</p></div>
                </div>
              </div>

              {(wire.meta.submitted_by || wire.meta.submission_time || wire.meta.version || wire.meta.status) && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b pb-1">Métadonnées</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Saisi par" value={wire.meta.submitted_by} />
                    <Field label="Date saisie" value={wire.meta.submission_time} />
                    <Field label="Version" value={wire.meta.version} />
                    <Field label="Statut" value={wire.meta.status} />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <SheetFooter className="px-5 py-4 border-t shrink-0">
          <Button variant="outline" className="w-full" onClick={onClose}>Fermer</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function MapPage() {
  const { postes, count, loading: loadingMap, error: errorMap, refresh } = usePostesMap();
  const { wires, count: wiresCount, loading: loadingWires, refresh: refreshWires } = useWiresMap();
  const { poste, loading: loadingDetail, error: errorDetail, fetch: fetchDetail, reset: resetDetail } = usePosteDetailLazy();
  const { wire, loading: loadingWireDetail, error: errorWireDetail, fetch: fetchWireDetail, reset: resetWireDetail } = useWireDetailLazy();

  const [selectedSubstation, setSelectedSubstation] = useState<string | null>(null);
  const [selectedWireId,     setSelectedWireId]     = useState<number | null>(null);
  const [isSheetOpen,        setIsSheetOpen]        = useState(false);
  const [isWireSheetOpen,    setIsWireSheetOpen]    = useState(false);

  // Sidebar ouverte/fermée — fermée par défaut
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Filtres postes
  const [selectedType,         setSelectedType]         = useState("all");
  const [selectedExploitation, setSelectedExploitation] = useState("all");
  const [selectedRegime,       setSelectedRegime]       = useState("all");
  const [searchQuery,          setSearchQuery]          = useState("");

  const supportHook = useSupportDetail();
  const reasHook    = useREASDetail();
 
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [isREASModalOpen,    setIsREASModalOpen]    = useState(false);

  // Filtre date partagé postes + wires
  const { dateRangeType, dateRange, setDateRangeType, setCustomRange } = useDateFilter();

  // ── Filtrage postes ────────────────────────────────────────────────────────
  const filteredPostes = useMemo(() => postes.filter((p) => {
    if (selectedType !== "all"         && p.type         !== selectedType)         return false;
    if (selectedExploitation !== "all" && p.exploitation !== selectedExploitation) return false;
    if (selectedRegime !== "all"       && p.regime_poste !== selectedRegime)       return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!p.substation_name?.toLowerCase().includes(q) && !p.substation?.toLowerCase().includes(q) &&
          !p.feeder?.toLowerCase().includes(q) && !p.feeder_name?.toLowerCase().includes(q) && !p.exploitation?.toLowerCase().includes(q))
        return false;
    }
    if (dateRangeType !== "all" && p.submission_time) {
      const d = new Date(p.submission_time);
      const start = new Date(dateRange.start);
      const end   = new Date(dateRange.end); end.setHours(23, 59, 59, 999);
      if (d < start || d > end) return false;
    }
    return true;
  }), [postes, selectedType, selectedExploitation, selectedRegime, searchQuery, dateRangeType, dateRange]);

  // ── Filtrage wires par date ────────────────────────────────────────────────
  const filteredWires = useMemo(() => wires.filter((w) => {
    if (dateRangeType !== "all" && w.submission_time) {
      const d     = new Date(w.submission_time);
      const start = new Date(dateRange.start);
      const end   = new Date(dateRange.end); end.setHours(23, 59, 59, 999);
      if (d < start || d > end) return false;
    }
    return true;
  }), [wires, dateRangeType, dateRange]);

  // ── Calcul des longueurs totales (avec cache) ──────────────────────────────
  const { totalLengthAll, totalLengthFiltered } = useMemo(() => {
    let allLength = 0;
    let filteredLength = 0;
    
    for (const wire of wires) {
      const length = calculateWireLength(wire);
      allLength += length;
    }
    
    for (const wire of filteredWires) {
      const length = calculateWireLength(wire);
      filteredLength += length;
    }
    
    return { totalLengthAll: allLength, totalLengthFiltered: filteredLength };
  }, [wires, filteredWires]);

  // ── KPIs des wires filtrés ─────────────────────────────────────────────────
  const wireKpis = useMemo(() => {
    let troncons = 0, supports = 0, remontees = 0, ptRemarquables = 0;
    let aerien = 0, souterrain = 0, mixte = 0;
    for (const w of filteredWires) {
      const segs = w.segments ?? [];
      troncons += segs.length;
      let hasAerien = false, hasSout = false, hasRem = false;
      for (const seg of segs) {
        if (seg.type === "aerien")     { hasAerien = true; supports      += (seg.waypoints ?? []).filter((wp: any) => wp.type === "support").length; }
        else if (seg.type === "remontee")   { hasRem    = true; remontees     += 1; }
        else if (seg.type === "souterrain") { hasSout   = true; ptRemarquables += (seg.waypoints ?? []).filter((wp: any) => wp.type !== "aucune" && wp.type !== "souterrain").length; }
      }
      if (hasSout && (hasAerien || hasRem)) mixte++;
      else if (hasSout) souterrain++;
      else              aerien++;
    }
    return { troncons, supports, remontees, ptRemarquables, aerien, souterrain, mixte };
  }, [filteredWires]);

  // ── Map data ───────────────────────────────────────────────────────────────
  const mapPoints = useMemo(() => filteredPostes.map((p) => ({
    m_rid: p.substation ?? p.kobo_id ?? "", name: p.substation_name ?? "—",
    latitude: p.latitude, longitude: p.longitude,
    table: "substation", type: p.type,
    exploitation: p.exploitation, regime_poste: p.regime_poste,
    statut_acces: p.statut_acces, submitted_by: p.submitted_by,
    _substation_id: p.substation,
  })), [filteredPostes]);

  const handleWaypointClick = useCallback((data: WaypointClickData) => {
    if (data.type === "support") {
      setIsSupportModalOpen(true);
      supportHook.fetch(data.wire_id, data.troncon_index, data.support_index!);
    } else if (data.type === "remontee") {
      setIsREASModalOpen(true);
      reasHook.fetch(data.wire_id, data.troncon_index);
    }
  }, [supportHook, reasHook]);

  const mapWires = useMemo(() => {
    return filteredWires.map((w) => ({
      id:                  w.id,
      segments: w.segments?.map(seg => ({
        ...seg,
        waypoints: seg.waypoints?.map(wp => ({ ...wp, wire_id: w.id })),
      })),
      coordinates:         w.coordinates,
      waypoints:           w.waypoints?.map(wp => ({ ...wp, wire_id: w.id })),
      feeder_name:         w.feeder_name,
      tension_kv:          w.tension_kv,
      type:                w.type || "aerien",
      has_complete_coords: w.has_complete_coords,
      debut_type:          w.debut?.type,
      fin_type:            w.fin?.type,
    }));
  }, [filteredWires]);

  const handleMarkerClick = useCallback((eq: Record<string, unknown>) => {
    const id = eq._substation_id as string | undefined;
    if (!id) return;
    setSelectedSubstation(id); setIsSheetOpen(true); fetchDetail(id);
  }, [fetchDetail]);

  const handleWireClick = useCallback((wd: Record<string, unknown>) => {
    const id = wd.id as number | undefined;
    if (!id) return;
    setSelectedWireId(id); setIsWireSheetOpen(true); fetchWireDetail(id);
  }, [fetchWireDetail]);

  const handleCloseSheet     = useCallback(() => { setIsSheetOpen(false);     resetDetail();     setSelectedSubstation(null); }, [resetDetail]);
  const handleCloseWireSheet = useCallback(() => { setIsWireSheetOpen(false); resetWireDetail(); setSelectedWireId(null); },   [resetWireDetail]);

  // Fonction de refresh qui vide aussi le cache des longueurs
  const handleRefresh = useCallback(() => {
    refresh();
    refreshWires();
    clearWireLengthCache();
  }, [refresh, refreshWires]);

  const resetFilters = () => { setSelectedType("all"); setSelectedExploitation("all"); setSelectedRegime("all"); setSearchQuery(""); setDateRangeType("all"); };
  const hasActiveFilters = selectedType !== "all" || selectedExploitation !== "all" || selectedRegime !== "all" || searchQuery !== "" || dateRangeType !== "all";

  return (
    <div className="h-[90vh] w-full flex overflow-hidden">

      {/* ── Sidebar gauche (KPIs + Filtres) ─────────────────────────────────── */}
      <div
        className={cn(
          "relative flex shrink-0 transition-all duration-300 ease-in-out",
          sidebarOpen ? "w-80" : "w-1"
        )}
      >
        {/* Étiquette verticale visible quand fermée */}
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="absolute -left-2 top-1/2 rounded-md inset-0 w-12 h-32 flex items-center justify-center bg-background border-r transition-colors cursor-pointer z-10"
            title="Ouvrir les filtres"
          >
            <div>
              <ChevronRight className="h-4 w-4" />
              <div className="h-2"></div>
              <span
                className="text-[11px] font-bold uppercase tracking-[0.25em] text-muted-foreground select-none"
                style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
              >
                Filtres
              </span>
            </div>
          </button>
        )}

        {/* Contenu de la sidebar */}
        <div
          className={cn(
            "absolute inset-0 flex flex-col bg-background border-r overflow-hidden transition-opacity duration-300",
            sidebarOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          )}
        >
          {/* En-tête sidebar */}
          <div className="shrink-0 flex items-center justify-between px-3 py-3 border-b bg-muted/20">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Filtres & KPIs</span>
              {hasActiveFilters && (
                <Badge className="h-4 w-4 p-0 flex items-center justify-center text-[10px]">!</Badge>
              )}
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="rounded-md p-1 hover:bg-blue-600 transition-colors cursor-pointer bg-blue-500 text-white"
              title="Fermer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>

          {/* Corps scrollable */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">

            {/* ── KPIs postes ── */}
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Postes</p>
              {loadingMap
                ? <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />Chargement…</div>
                : errorMap
                  ? <div className="flex items-center gap-2 text-xs text-destructive"><AlertCircle className="h-3 w-3" />{errorMap}</div>
                  : (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-blue-50 border border-blue-100 rounded-lg p-2 text-center">
                        <p className="text-lg font-bold text-blue-700">{filteredPostes.length}</p>
                        <p className="text-[10px] text-blue-500 uppercase">Filtrés</p>
                      </div>
                      <div className="bg-muted/30 rounded-lg p-2 text-center">
                        <p className="text-lg font-bold">{count}</p>
                        <p className="text-[10px] text-muted-foreground uppercase">Total</p>
                      </div>
                    </div>
                  )
              }
            </div>

            {/* ── KPIs lignes ── */}
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Lignes</p>
              {loadingWires
                ? <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />Chargement…</div>
                : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-purple-50 border border-purple-100 rounded-lg p-2 text-center">
                        <p className="text-lg font-bold text-purple-700">{filteredWires.length}</p>
                        <p className="text-[10px] text-purple-500 uppercase">Filtrées</p>
                      </div>
                      <div className="bg-muted/30 rounded-lg p-2 text-center">
                        <p className="text-lg font-bold">{wiresCount}</p>
                        <p className="text-[10px] text-muted-foreground uppercase">Total</p>
                      </div>
                    </div>
                    
                    {/* KPIs longueurs */}
                    {wiresCount > 0 && (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-cyan-50 border border-cyan-100 rounded-lg p-2 text-center">
                          <p className="text-base font-bold text-cyan-700">{totalLengthFiltered.toFixed(2)} km</p>
                          <p className="text-[10px] text-cyan-500 uppercase">Longueur filtrée</p>
                        </div>
                        <div className="bg-cyan-50 border border-cyan-100 rounded-lg p-2 text-center">
                          <p className="text-base font-bold text-cyan-700">{totalLengthAll.toFixed(2)} km</p>
                          <p className="text-[10px] text-cyan-500 uppercase">Longueur totale</p>
                        </div>
                      </div>
                    )}
                    {filteredWires.length > 0 && (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-muted/20 rounded-lg p-2 text-center">
                          <p className="text-base font-bold">{wireKpis.troncons}</p>
                          <p className="text-[10px] text-muted-foreground uppercase">Tronçons</p>
                        </div>
                        <div className="bg-green-50 border border-green-100 rounded-lg p-2 text-center">
                          <p className="text-base font-bold text-green-700">{wireKpis.supports}</p>
                          <p className="text-[10px] text-green-500 uppercase">Supports</p>
                        </div>
                        {wireKpis.remontees > 0 && (
                          <div className="bg-amber-50 border border-amber-100 rounded-lg p-2 text-center">
                            <p className="text-base font-bold text-amber-700">{wireKpis.remontees}</p>
                            <p className="text-[10px] text-amber-500 uppercase">Remontées</p>
                          </div>
                        )}
                        {wireKpis.ptRemarquables > 0 && (
                          <div className="bg-blue-50 border border-blue-100 rounded-lg p-2 text-center">
                            <p className="text-base font-bold text-blue-700">{wireKpis.ptRemarquables}</p>
                            <p className="text-[10px] text-blue-500 uppercase">Pts remarq.</p>
                          </div>
                        )}
                        <div className="col-span-2 flex justify-center gap-3 text-[10px] text-muted-foreground pt-1">
                          {wireKpis.aerien     > 0 && <span>{wireKpis.aerien} aériens</span>}
                          {wireKpis.souterrain > 0 && <span>{wireKpis.souterrain} souterr.</span>}
                          {wireKpis.mixte      > 0 && <span>{wireKpis.mixte} mixtes</span>}
                        </div>
                      </div>
                    )}
                  </div>
                )
              }
            </div>

            {/* ── Séparateur ── */}
            <div className="border-t" />

            {/* ── Filtres ── */}
            <div className="space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Filtres postes</p>

              {/* Recherche */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground flex items-center gap-1"><Search className="h-3 w-3" />Recherche</Label>
                <Input placeholder="Substation, feeder…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="h-8 text-xs w-full" />
              </div>

              {/* Type de poste */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Type de poste</Label>
                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger className="h-8 text-xs w-full"><SelectValue placeholder="Tous" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous</SelectItem>
                    {TYPES_POSTE.map(t => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Exploitation */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Exploitation</Label>
                <Select value={selectedExploitation} onValueChange={setSelectedExploitation}>
                  <SelectTrigger className="h-8 text-xs w-full"><SelectValue placeholder="Toutes" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes</SelectItem>
                    {EXPLOITATIONS.map(e => <SelectItem key={e.id} value={e.id}>{e.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Régime */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Régime poste</Label>
                <Select value={selectedRegime} onValueChange={setSelectedRegime}>
                  <SelectTrigger className="h-8 text-xs w-full"><SelectValue placeholder="Tous" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous</SelectItem>
                    {REGIMES_POSTE.map(r => <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Période */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" />Période (postes & lignes)</Label>
                <DateFilter
                  dateRangeType={dateRangeType}
                  dateRange={dateRange}
                  onRangeTypeChange={(type: DateRangeType) => setDateRangeType(type)}
                  onCustomRangeChange={(range: DateRange) => setCustomRange(range)}
                />
              </div>
            </div>

            {/* ── Filtres actifs ── */}
            {hasActiveFilters && (
              <div className="space-y-2 pt-2 border-t">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Filtres actifs</p>
                <div className="flex flex-wrap gap-1">
                  {selectedType !== "all" && (
                    <Badge variant="secondary" className="text-[10px] gap-1 h-5">
                      {TYPES_POSTE.find(t => t.id === selectedType)?.label}
                      <XCircle className="h-3 w-3 cursor-pointer hover:text-destructive" onClick={() => setSelectedType("all")} />
                    </Badge>
                  )}
                  {selectedExploitation !== "all" && (
                    <Badge variant="secondary" className="text-[10px] gap-1 h-5">
                      {EXPLOITATIONS.find(e => e.id === selectedExploitation)?.label}
                      <XCircle className="h-3 w-3 cursor-pointer hover:text-destructive" onClick={() => setSelectedExploitation("all")} />
                    </Badge>
                  )}
                  {selectedRegime !== "all" && (
                    <Badge variant="secondary" className="text-[10px] gap-1 h-5">
                      {REGIMES_POSTE.find(r => r.id === selectedRegime)?.label}
                      <XCircle className="h-3 w-3 cursor-pointer hover:text-destructive" onClick={() => setSelectedRegime("all")} />
                    </Badge>
                  )}
                  {searchQuery && (
                    <Badge variant="secondary" className="text-[10px] gap-1 h-5">
                      « {searchQuery} »
                      <XCircle className="h-3 w-3 cursor-pointer hover:text-destructive" onClick={() => setSearchQuery("")} />
                    </Badge>
                  )}
                  {dateRangeType !== "all" && (
                    <Badge variant="secondary" className="text-[10px] gap-1 h-5">
                      {dateRangeType === "today" ? "Aujourd'hui" : dateRangeType === "week" ? "Cette semaine" : dateRangeType === "month" ? "Ce mois" : "Personnalisé"}
                      <XCircle className="h-3 w-3 cursor-pointer hover:text-destructive" onClick={() => setDateRangeType("all")} />
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer sidebar */}
          <div className="shrink-0 border-t px-3 py-2 flex gap-2">
            <Button variant="ghost" size="sm" className="flex-1 h-8 text-xs gap-1" onClick={resetFilters}>
              <RefreshCw className="h-3 w-3" />Réinitialiser
            </Button>
            <Button variant="ghost" size="sm" className="flex-1 h-8 text-xs gap-1" onClick={handleRefresh}>
              <RefreshCw className="h-3 w-3" />Actualiser
            </Button>
          </div>
        </div>
      </div>

      {/* ── Carte — prend tout l'espace restant ──────────────────────────────── */}
      <div className="flex-1 min-w-0 relative">
        {errorMap && (
          <div className="absolute inset-0 flex items-center justify-center z-20 bg-background/80 backdrop-blur-sm">
            <div className="text-center space-y-3">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
              <p className="text-sm font-medium">{errorMap}</p>
              <Button size="sm" onClick={refresh}>Réessayer</Button>
            </div>
          </div>
        )}
        <FullscreenMap
          equipments={mapPoints}
          wires={mapWires}
          onMarkerClick={handleMarkerClick}
          onWireClick={handleWireClick}
          onWaypointClick={handleWaypointClick}
        />
      </div>

      {/* ── Panneaux de détail ───────────────────────────────────────────────── */}
      <DetailSheet
        substationId={selectedSubstation}
        isOpen={isSheetOpen}
        onClose={handleCloseSheet}
        poste={poste}
        loading={loadingDetail}
        error={errorDetail}
      />
      <WireDetailSheet
        wireId={selectedWireId}
        isOpen={isWireSheetOpen}
        onClose={handleCloseWireSheet}
        wire={wire}
        loading={loadingWireDetail}
        error={errorWireDetail}
      />
      <SupportDetailSheet
        isOpen={isSupportModalOpen}
        onClose={() => { setIsSupportModalOpen(false); supportHook.reset(); }}
        loading={supportHook.loading}
        error={supportHook.error}
        data={supportHook.data}
      />
      <REASDetailSheet
        isOpen={isREASModalOpen}
        onClose={() => { setIsREASModalOpen(false); reasHook.reset(); }}
        loading={reasHook.loading}
        error={reasHook.error}
        data={reasHook.data}
      />
    </div>
  );
}
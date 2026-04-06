"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import {
  Zap, Building2, MapPin, Filter, Search, ChevronDown,
  RefreshCw, XCircle, Loader2, AlertCircle, Calendar,
  LayoutGrid, Eye, Satellite, Check, ZoomIn, ZoomOut,
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
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";

import { usePostesMap, useWiresMap, usePosteDetailLazy, useWireDetailLazy } from "@/hooks/useKobo";
import { buildPhotoUrl } from "@/lib/api/services/koboService";
import { PosteDetail, WireDetail } from "@/lib/types/kobo";
import { DateFilter } from "@/components/dashboard/date-filter";
import { DateRange, DateRangeType, useDateFilter } from "@/hooks/use-date-filter-map";


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
  { id: "DLAE", label: "Douala Est" },
  { id: "YDE",  label: "Yaoundé Est" },
  { id: "YDO",  label: "Yaoundé Ouest" },
  { id: "GAR",  label: "Garoua" },
  { id: "BER",  label: "Bertoua" },
  { id: "BAM",  label: "Bamenda" },
];

const TYPES_POSTE = [
  { id: "H61", label: "H61 (Aérien)" },
  { id: "H59", label: "H59 (Cabine)" },
];

const REGIMES_POSTE = [
  { id: "publique", label: "Publique" },
  { id: "privee",   label: "Privée" },
  { id: "mixte",    label: "Mixte" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b pb-1">
        {title}
      </h3>
      {children}
    </div>
  );
}

// ── Composant PhotoModal ───────────────────────────────────────────────────────
export function PhotoModal({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleZoomIn = () => setScale((prev) => Math.min(prev + 0.5, 4));

  const handleZoomOut = () =>
    setScale((prev) => {
      const next = Math.max(prev - 0.5, 0.5);
      if (next === 0.5) setPosition({ x: 0, y: 0 });
      return next;
    });

  const handleReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (scale > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging && scale > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey) {
      e.preventDefault();
      e.deltaY < 0 ? handleZoomIn() : handleZoomOut();
    }
  };

  if (!mounted) return null;

  const modalContent = (
    <div
      ref={containerRef}
      className="fixed inset-0 bg-black/95 flex items-center justify-center"
      style={{ zIndex: 9999 }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
    >
      <div
        className="absolute top-4 right-4 flex items-center gap-2"
        style={{ zIndex: 10001, pointerEvents: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={handleZoomOut}
          className="text-white hover:text-gray-300 transition-colors bg-black/50 rounded-full p-2"
          aria-label="Dézoomer"
        >
          <ZoomOut className="h-6 w-6" />
        </button>

        <button
          onClick={handleZoomIn}
          className="text-white hover:text-gray-300 transition-colors bg-black/50 rounded-full p-2"
          aria-label="Zoomer"
        >
          <ZoomIn className="h-6 w-6" />
        </button>

        <button
          onClick={handleReset}
          className="text-white hover:text-gray-300 transition-colors bg-black/50 rounded-full p-2 text-xs font-medium min-w-[36px]"
          aria-label="Réinitialiser"
        >
          1:1
        </button>

        <button
          onClick={onClose}
          className="text-white hover:text-gray-300 transition-colors bg-black/50 rounded-full p-2"
          aria-label="Fermer"
        >
          <XCircle className="h-8 w-8" />
        </button>
      </div>

      <div
        className="relative w-full h-full flex items-center justify-center overflow-hidden"
        onMouseDown={handleMouseDown}
        style={{ cursor: scale > 1 ? (isDragging ? "grabbing" : "grab") : "default" }}
      >
        <img
          ref={imageRef}
          src={src}
          alt={alt}
          className="transition-transform duration-200 select-none"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            maxWidth:  scale === 1 ? "90%" : "none",
            maxHeight: scale === 1 ? "90%" : "none",
          }}
          onClick={(e) => e.stopPropagation()}
          draggable={false}
        />
      </div>

      <div
        className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2"
        style={{ zIndex: 10001, pointerEvents: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="text-white hover:text-gray-300 transition-colors bg-black/50 rounded-lg px-4 py-2 text-sm"
        >
          Fermer (Échap)
        </button>

        {scale > 1 && (
          <div className="text-white bg-black/50 rounded-lg px-3 py-2 text-sm">
            {Math.round(scale * 100)}% · Glisser pour déplacer
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

// ── Composant PhotoThumb ──────────────────────────────────────────────────────
export function PhotoThumb({ src, alt }: { src: string | null | undefined; alt: string }) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const url = buildPhotoUrl(src);

  if (!url) return null;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsFullscreen(true);
  };

  const handleCloseFullscreen = () => setIsFullscreen(false);

  return (
    <>
      <div
        className="relative w-full h-64 rounded-lg overflow-hidden border bg-gray-500/20 cursor-pointer hover:opacity-90 transition-opacity"
        onClick={handleClick}
      >
        <div className="absolute inset-0 z-10 overflow-hidden">
          <div className="absolute inset-0 animate-pulse bg-gray-500/10" />
          <div className="absolute z-10 inset-0 flex flex-col items-center justify-center gap-2">
            <svg viewBox="0 0 56 56" className="w-12 h-12 opacity-10" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="4" y="10" width="48" height="36" rx="4" fill="currentColor" />
              <circle cx="20" cy="22" r="5" fill="white" opacity="0.7" />
              <path d="M4 38 L16 26 L26 36 L36 24 L52 40" stroke="white" strokeWidth="2.5" fill="none" strokeLinejoin="round" opacity="0.7" />
              <line x1="44" y1="10" x2="10" y2="46" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" opacity="0.6" />
              <line x1="10" y1="10" x2="44" y2="46" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" opacity="0.6" />
            </svg>
            <div className="h-2 w-24 rounded-full bg-gray-400/10 animate-pulse" />
            <div className="h-2 w-16 rounded-full bg-gray-400/10 animate-pulse" style={{ animationDelay: "150ms" }} />
          </div>
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: "linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.12) 50%, transparent 65%)",
              animation: "shimmer 1.6s ease-in-out infinite",
            }}
          />
        </div>

        <img
          src={url}
          alt={alt}
          className="w-full h-full object-cover transition-opacity z-20 relative"
          style={{ opacity: isLoading ? 0 : 1 }}
          onLoadStart={() => setIsLoading(true)}
          onLoad={() => setIsLoading(false)}
          loading="lazy"
        />
      </div>

      {isFullscreen && (
        <PhotoModal src={url} alt={alt} onClose={handleCloseFullscreen} />
      )}
    </>
  );
}

// ── Panneau de détail POSTE ─────────────────────────────────────────────────────────
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
  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent
        side="right"
        className="w-screen! sm:w-130! max-w-none! sm:max-w-130! flex flex-col p-0 overflow-hidden"
      >
        <SheetHeader className="px-5 py-4 border-b shrink-0">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-blue-500" />
            <SheetTitle className="text-base">
              {poste?.substation_id ?? substationId ?? "Poste"}
            </SheetTitle>
          </div>
          <SheetDescription>
            {poste
              ? `${poste.type ?? ""} · ${poste.feeder ?? ""} · ${poste.exploitation ?? ""}`
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
              <PhotoThumb src={poste.photos.photo_poste} alt="Photo du poste" />

              <Section title="Identification">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Substation id"   value={poste.substation_id} />
                  <Field label="Substation name"   value={poste.substation_name} />
                  <Field label="Feeder id"        value={poste.feeder} />
                  <Field label="Feeder name"        value={poste.feeder_name} />
                  <Field label="Type"          value={poste.type} />
                  <Field label="Exploitation"  value={poste.exploitation} />
                  <Field label="Régime"        value={poste.regime} />
                  <Field label="Régime poste"  value={poste.regime_poste} />
                  <Field label="Zone"          value={poste.zone_type} />
                  <Field label="Accès"         value={poste.statut_acces} />
                  <Field label="Terre neutre"  value={poste.terre_neutre_bt} />
                  <Field label="Terre masse"   value={poste.terre_masse} />
                  {poste.latitude && poste.longitude && (
                    <div className="col-span-2">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">GPS</p>
                      <p className="text-sm font-mono">
                        {poste.latitude.toFixed(6)}, {poste.longitude.toFixed(6)}
                      </p>
                    </div>
                  )}
                </div>
              </Section>

              <Section title="Appareillage HTA">
                <PhotoThumb
                  src={poste.appareillage.photo_appareillage}
                  alt="Appareillage"
                />
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <Field label="Parafoudre"       value={poste.appareillage.parafoudre} />
                  <Field label="État parafoudre"  value={poste.appareillage.etat_parafoudre} />
                  <Field label="Tableau BT"        value={poste.appareillage.tableau_bt} />
                  <Field label="Détecteur défaut"  value={poste.appareillage.detecteur_defaut} />
                  <Field label="Coupe-circuit"     value={poste.appareillage.coupe_circuit} />
                  <Field label="Disjoncteur HP"    value={poste.appareillage.disjoncteur_hp} />
                  <Field label="PMR"               value={poste.appareillage.pmr} />
                </div>
              </Section>

              {poste.transformateurs.length > 0 && (
                <Section title={`Transformateurs (${poste.transformateurs.length})`}>
                  {poste.transformateurs.map((t, i) => (
                    <div key={i} className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold">{t.nom ?? `Transfo ${i + 1}`}</p>
                        <Badge variant={t.actif === "TRUE" ? "default" : "secondary"}>
                          {t.actif === "TRUE" ? "Actif" : "Inactif"}
                        </Badge>
                      </div>
                      <PhotoThumb src={t.photo_transfo} alt={`Transformateur ${t.nom}`} />
                      <div className="grid grid-cols-2 gap-2">
                        <Field label="Puissance"     value={t.puissance_kva ? `${t.puissance_kva} kVA` : null} />
                        <Field label="Marque"        value={t.marque} />
                        <Field label="Type"          value={t.type} />
                        <Field label="Refroid."      value={t.refroidissement} />
                        <Field label="État visuel"   value={t.etat_visuel} />
                        <Field label="Rempl. planif" value={t.remplacement_planifie} />
                      </div>
                    </div>
                  ))}
                </Section>
              )}

              {poste.cellules.length > 0 && (
                <Section title={`Cellules HTA (${poste.cellules.length})`}>
                  {poste.cellules.map((c, i) => (
                    <div key={i} className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold">{c.nom_cellule ?? c.bay_id}</p>
                        <Badge variant="outline">{c.type_bay}</Badge>
                      </div>
                      <PhotoThumb src={c.photo_bay} alt={`Cellule ${c.bay_id}`} />
                      <div className="grid grid-cols-2 gap-2">
                        <Field label="Fabricant"  value={c.fabricant} />
                        <Field label="Modèle"     value={c.modele} />
                        <Field label="Commande"   value={c.commande} />
                        <Field label="État"       value={c.etat_visuel} />
                      </div>
                      {c.switches.length > 0 && (
                        <div className="mt-2 space-y-1">
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            Switches ({c.switches.length})
                          </p>
                          {c.switches.map((sw, j) => (
                            <div key={j} className="text-xs bg-muted/30 rounded px-2 py-1 flex justify-between">
                              <span className="font-medium">{sw.nom}</span>
                              <span className="text-muted-foreground">{sw.type}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </Section>
              )}

              {poste.bt_boards.length > 0 && (
                <Section title={`Tableaux BT (${poste.bt_boards.length})`}>
                  {poste.bt_boards.map((bt, i) => (
                    <div key={i} className="border rounded-lg p-3 space-y-2">
                      <PhotoThumb src={bt.photo} alt={`Tableau BT ${i + 1}`} />
                      <div className="grid grid-cols-2 gap-2">
                        <Field label="Type"     value={bt.type} />
                        <Field label="Capacité" value={bt.capacity} />
                        <Field label="Actif"    value={bt.actif} />
                      </div>
                    </div>
                  ))}
                </Section>
              )}

              {poste.client_commercial && (
                <Section title="Client commercial">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Nom"           value={poste.client_commercial.nom_client} />
                    <Field label="Type"          value={poste.client_commercial.type_client} />
                    <Field label="Type compteur" value={poste.client_commercial.type_compteur} />
                    <Field label="N° compteur"   value={poste.client_commercial.mrid_compteur} />
                    <Field label="Statut"        value={poste.client_commercial.statut_compteur} />
                    <Field label="Scellé"        value={poste.client_commercial.statut_scelle} />
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <PhotoThumb src={poste.client_commercial.photo_disjoncteur} alt="Disjoncteur" />
                    <PhotoThumb src={poste.client_commercial.photo_ensemble}    alt="Ensemble" />
                  </div>
                </Section>
              )}

              {poste.genie_civil && (
                <Section title="Génie civil">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Superficie"     value={poste.genie_civil.superficie_batie ? `${poste.genie_civil.superficie_batie} m²` : null} />
                    <Field label="Voie accès"     value={poste.genie_civil.voies.type} />
                    <Field label="Toiture"        value={poste.genie_civil.batiment.toiture} />
                    <Field label="Portes"         value={poste.genie_civil.batiment.portes} />
                    <Field label="Murs"           value={poste.genie_civil.batiment.structure_murs} />
                    <Field label="Bouches vent."  value={poste.genie_civil.batiment.bouches_ventilation} />
                    <Field label="Galeries câbles" value={poste.genie_civil.batiment.galeries_cables} />
                    <Field label="Clôture"        value={poste.genie_civil.batiment.cloture} />
                    <Field label="Lampes"         value={poste.genie_civil.batiment.acces} />
                    <Field label="Interrupteurs"  value={poste.genie_civil.equipements_local.interrupteurs} />
                  </div>
                  {Object.keys(poste.genie_civil.photos).length > 0 && (
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {Object.entries(poste.genie_civil.photos).slice(0, 6).map(([key, path]) => (
                        <PhotoThumb key={key} src={path} alt={key} />
                      ))}
                    </div>
                  )}
                </Section>
              )}

              <Section title="Métadonnées">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="ID Kobo"       value={String(poste.meta.kobo_id ?? "")} />
                  <Field label="Saisi par"     value={poste.meta.submitted_by} />
                  <Field label="Date saisie"   value={poste.meta.submission_time} />
                </div>
              </Section>
            </>
          )}
        </div>

        <SheetFooter className="px-5 py-4 border-t shrink-0">
          <Button variant="outline" className="w-full" onClick={onClose}>
            Fermer
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ── Panneau de détail WIRE ─────────────────────────────────────────────────────────
function WireDetailSheet({
  wireId,
  isOpen,
  onClose,
  wire,
  loading,
  error,
}: {
  wireId: number | null;
  isOpen: boolean;
  onClose: () => void;
  wire: WireDetail | null;
  loading: boolean;
  error: string | null;
}) {
  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent
        side="right"
        className="w-screen! sm:w-130! max-w-none! sm:max-w-130! flex flex-col p-0 overflow-hidden"
      >
        <SheetHeader className="px-5 py-4 border-b shrink-0">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-purple-500" />
            <SheetTitle className="text-base">
              Ligne {wire?.feeder?.name ?? `#${wireId}`}
            </SheetTitle>
          </div>
          <SheetDescription>
            {wire
              ? `${wire.feeder?.tension_kv ?? "?"} kV · ${wire.stats.troncons_count} tronçon(s)`
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

          {wire && !loading && (
            <>
              <Section title="Informations générales">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="ID Kobo" value={String(wire.id)} />
                  <Field label="Feeder ID" value={wire.feeder.id} />
                  <Field label="Feeder Name" value={wire.feeder.name} />
                  <Field label="Tension" value={wire.feeder.tension_kv ? `${wire.feeder.tension_kv} kV` : null} />
                  <Field label="Phase" value={wire.feeder.phase} />
                </div>
              </Section>

              <Section title="Point de départ">
                <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={wire.debut.type === "poste" ? "default" : "secondary"}>
                      {wire.debut.type || "N/A"}
                    </Badge>
                    <span className="text-sm font-mono">{wire.debut.code}</span>
                  </div>
                  {wire.debut.coordinates.latitude && wire.debut.coordinates.longitude && (
                    <div className="text-xs text-muted-foreground">
                      📍 {wire.debut.coordinates.latitude.toFixed(6)}, {wire.debut.coordinates.longitude.toFixed(6)}
                    </div>
                  )}
                  {wire.debut.photo && <PhotoThumb src={wire.debut.photo} alt="Photo début" />}
                  {Object.keys(wire.debut.details).length > 0 && (
                    <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t">
                      {Object.entries(wire.debut.details).slice(0, 4).map(([k, v]) => (
                        <Field key={k} label={k} value={String(v)} />
                      ))}
                    </div>
                  )}
                </div>
              </Section>

              <Section title="Point d'arrivée">
                <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={wire.fin.type === "poste" ? "default" : "secondary"}>
                      {wire.fin.type || "N/A"}
                    </Badge>
                  </div>
                  {wire.fin.coordinates.latitude && wire.fin.coordinates.longitude && (
                    <div className="text-xs text-muted-foreground">
                      📍 {wire.fin.coordinates.latitude.toFixed(6)}, {wire.fin.coordinates.longitude.toFixed(6)}
                    </div>
                  )}
                  {Object.keys(wire.fin.details).length > 0 && (
                    <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t">
                      {Object.entries(wire.fin.details).slice(0, 4).map(([k, v]) => (
                        <Field key={k} label={k} value={String(v)} />
                      ))}
                    </div>
                  )}
                </div>
              </Section>

              <Section title={`Tronçons (${wire.troncons.length})`}>
                {wire.troncons.map((troncon, idx) => (
                  <div key={idx} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">Tronçon #{troncon.index}</p>
                      <Badge variant={
                        troncon.type === "aerien" ? "default" : 
                        troncon.type === "souterrain" ? "secondary" : "outline"
                      }>
                        {troncon.type === "aerien" ? "Aérien" : 
                         troncon.type === "souterrain" ? "Souterrain" : "Remontée"}
                      </Badge>
                    </div>
                    
                    {troncon.aerien && (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Caractéristiques aériennes</p>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <Field label="Caractéristique" value={troncon.aerien.caracteristique} />
                          {troncon.aerien.cable && (
                            <>
                              <Field label="Nature" value={troncon.aerien.cable.nature} />
                              <Field label="Section" value={troncon.aerien.cable.section} />
                              <Field label="Isolant" value={troncon.aerien.cable.isolant} />
                            </>
                          )}
                        </div>
                        {troncon.supports && troncon.supports.length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs text-muted-foreground">Supports: {troncon.supports.length}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {troncon.souterrain && (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Caractéristiques souterraines</p>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {troncon.souterrain.cable && (
                            <>
                              <Field label="Nature" value={troncon.souterrain.cable.nature} />
                              <Field label="Section" value={troncon.souterrain.cable.section} />
                              <Field label="Isolant" value={troncon.souterrain.cable.isolant} />
                              <Field label="Pose" value={troncon.souterrain.cable.pose} />
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    {troncon.remontee && (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Remontée</p>
                        {troncon.remontee.support && (
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <Field label="Barcode" value={troncon.remontee.support.barcode} />
                            <Field label="Sens" value={troncon.remontee.support.sens} />
                            <Field label="Hauteur" value={troncon.remontee.support.hauteur_m} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </Section>

              <Section title="Statistiques">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-muted/30 rounded-lg p-2">
                    <p className="text-2xl font-bold">{wire.stats.troncons_count}</p>
                    <p className="text-xs text-muted-foreground">Tronçons</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-2">
                    <p className="text-2xl font-bold">{wire.stats.supports_count}</p>
                    <p className="text-xs text-muted-foreground">Supports</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-2">
                    <p className="text-2xl font-bold">{wire.stats.total_waypoints}</p>
                    <p className="text-xs text-muted-foreground">Points</p>
                  </div>
                </div>
              </Section>

              <Section title="Métadonnées">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Saisi par" value={wire.meta.submitted_by} />
                  <Field label="Date saisie" value={wire.meta.submission_time} />
                  <Field label="Version" value={wire.meta.version} />
                </div>
              </Section>
            </>
          )}
        </div>

        <SheetFooter className="px-5 py-4 border-t shrink-0">
          <Button variant="outline" className="w-full" onClick={onClose}>
            Fermer
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function MapPage() {
  // ── Données Kobo ─────────────────────────────────────────────────────────
  const { postes, count, loading: loadingMap, error: errorMap, refresh } = usePostesMap();
  const { wires, count: wiresCount, loading: loadingWires, refresh: refreshWires } = useWiresMap();
  const { poste, loading: loadingDetail, error: errorDetail, fetch: fetchDetail, reset: resetDetail } = usePosteDetailLazy();
  const { wire, loading: loadingWireDetail, error: errorWireDetail, fetch: fetchWireDetail, reset: resetWireDetail } = useWireDetailLazy();

  // ── UI state ──────────────────────────────────────────────────────────────
  const [selectedSubstation, setSelectedSubstation] = useState<string | null>(null);
  const [selectedWireId, setSelectedWireId] = useState<number | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isWireSheetOpen, setIsWireSheetOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Filtres
  const [selectedType, setSelectedType] = useState("all");
  const [selectedExploitation, setSelectedExploitation] = useState("all");
  const [selectedRegime, setSelectedRegime] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // ── Filtre date ───────────────────────────────────────────────────────────
  const {
    dateRangeType,
    dateRange,
    setDateRangeType,
    setCustomRange,
  } = useDateFilter();

  // ── Filtrage des postes ───────────────────────────────────────────────────
  const filteredPostes = useMemo(() => {
    return postes.filter((p) => {
      if (selectedType !== "all" && p.type !== selectedType) return false;
      if (selectedExploitation !== "all" && p.exploitation !== selectedExploitation) return false;
      if (selectedRegime !== "all" && p.regime_poste !== selectedRegime) return false;
      
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !p.substation_name?.toLowerCase().includes(q) &&
          !p.substation?.toLowerCase().includes(q) &&
          !p.feeder?.toLowerCase().includes(q) &&
          !p.feeder_name?.toLowerCase().includes(q) &&
          !p.exploitation?.toLowerCase().includes(q)
        )
          return false;
      }
      
      if (dateRangeType !== "all" && p.submission_time) {
        const submissionDate = new Date(p.submission_time);
        const startDate = new Date(dateRange.start);
        const endDate = new Date(dateRange.end);
        endDate.setHours(23, 59, 59, 999);
        
        if (submissionDate < startDate || submissionDate > endDate) {
          return false;
        }
      }
      
      return true;
    });
  }, [postes, selectedType, selectedExploitation, selectedRegime, searchQuery, dateRangeType, dateRange]);

  // ── Conversion pour FullscreenMap ─────────────────────────────────────────
  const mapPoints = useMemo(
    () =>
      filteredPostes.map((p) => ({
        m_rid:          p.substation ?? p.kobo_id ?? "",
        name:           p.substation_name ?? "—",
        latitude:       p.latitude,
        longitude:      p.longitude,
        depart:         p.feeder_name,
        table:          "substation",
        type:           p.type,
        feeder_id:      p.feeder,
        exploitation:   p.exploitation,
        regime_poste:   p.regime_poste,
        statut_acces:   p.statut_acces,
        submitted_by:   p.submitted_by,
        _substation_id: p.substation,
      })),
    [filteredPostes]
  );

  // ── Données pour les wires ────────────────────────────────────────────────
  const mapWires = useMemo(() => {
    return wires.map((w) => ({
      id: w.id,
      coordinates: w.coordinates,
      feeder_name: w.feeder_name,
      tension_kv: w.tension_kv,
      type: w.type || "aerien",
      debut_type: w.debut?.type,
      fin_type: w.fin?.type,
    }));
  }, [wires]);

  // ── Clic sur un marqueur → charge le détail du poste ──────────────────────
  const handleMarkerClick = useCallback(
    (equipment: Record<string, unknown>) => {
      const id = equipment._substation_id as string | undefined;
      if (!id) return;
      setSelectedSubstation(id);
      setIsSheetOpen(true);
      fetchDetail(id);
    },
    [fetchDetail]
  );

  // ── Clic sur un wire → charge le détail du wire ───────────────────────────
  const handleWireClick = useCallback(
    (wireData: Record<string, unknown>) => {
      const id = wireData.id as number | undefined;
      if (!id) return;
      setSelectedWireId(id);
      setIsWireSheetOpen(true);
      fetchWireDetail(id);
    },
    [fetchWireDetail]
  );

  const handleCloseSheet = useCallback(() => {
    setIsSheetOpen(false);
    resetDetail();
    setSelectedSubstation(null);
  }, [resetDetail]);

  const handleCloseWireSheet = useCallback(() => {
    setIsWireSheetOpen(false);
    resetWireDetail();
    setSelectedWireId(null);
  }, [resetWireDetail]);

  const resetFilters = () => {
    setSelectedType("all");
    setSelectedExploitation("all");
    setSelectedRegime("all");
    setSearchQuery("");
    setDateRangeType("all");
  };

  const hasActiveFilters =
    selectedType !== "all" ||
    selectedExploitation !== "all" ||
    selectedRegime !== "all" ||
    searchQuery !== "" ||
    dateRangeType !== "all";

  // ── Rendu ─────────────────────────────────────────────────────────────────
  return (
    <div className="h-[85vh] w-full flex flex-col overflow-hidden">

      {/* Barre d'outils */}
      <div className="shrink-0 bg-background border-b px-4 py-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {loadingMap ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Chargement des postes…
            </div>
          ) : errorMap ? (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {errorMap}
            </div>
          ) : (
            <div className="flex gap-2">
              <Badge variant="outline" className="gap-1">
                <MapPin className="h-3 w-3" />
                {filteredPostes.length} / {count} postes
              </Badge>
              <Badge variant="outline" className="gap-1 text-purple-600 border-purple-200">
                <Zap className="h-3 w-3" />
                {wiresCount} lignes
              </Badge>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFiltersOpen((v) => !v)}
            className="gap-2"
          >
            <Filter className="h-4 w-4" />
            Filtres
            {hasActiveFilters && (
              <Badge className="ml-1 h-4 w-4 p-0 flex items-center justify-center text-[10px]">
                !
              </Badge>
            )}
            <ChevronDown className={cn("h-3 w-3 transition-transform", filtersOpen && "rotate-180")} />
          </Button>

          <Button variant="ghost" size="sm" onClick={resetFilters} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Réinitialiser
          </Button>

          <Button variant="ghost" size="sm" onClick={() => { refresh(); refreshWires(); }} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Actualiser
          </Button>
        </div>
      </div>

      {/* Panneau de filtres */}
      <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen} className="shrink-0">
        <CollapsibleContent>
          <div className="bg-muted/30 border-b p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              
              {/* Recherche */}
              <div className="space-y-2 min-w-0">
                <Label className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1">
                  <Search className="h-3 w-3" />
                  Recherche
                </Label>
                <Input
                  placeholder="Substation, feeder…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 w-full"
                />
              </div>

              {/* Type de poste */}
              <div className="space-y-2 min-w-0">
                <Label className="text-xs font-semibold uppercase tracking-wider">Type de poste</Label>
                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue placeholder="Tous" />
                  </SelectTrigger>
                  <SelectContent className="min-w-50">
                    <SelectItem value="all">Tous</SelectItem>
                    {TYPES_POSTE.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Exploitation */}
              <div className="space-y-2 min-w-0">
                <Label className="text-xs font-semibold uppercase tracking-wider">Exploitation</Label>
                <Select value={selectedExploitation} onValueChange={setSelectedExploitation}>
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue placeholder="Toutes" />
                  </SelectTrigger>
                  <SelectContent className="min-w-[200px]">
                    <SelectItem value="all">Toutes</SelectItem>
                    {EXPLOITATIONS.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Régime poste */}
              <div className="space-y-2 min-w-0">
                <Label className="text-xs font-semibold uppercase tracking-wider">Régime poste</Label>
                <Select value={selectedRegime} onValueChange={setSelectedRegime}>
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue placeholder="Tous" />
                  </SelectTrigger>
                  <SelectContent className="min-w-[200px]">
                    <SelectItem value="all">Tous</SelectItem>
                    {REGIMES_POSTE.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Filtre Date */}
              <div className="space-y-2 min-w-0 lg:col-span-2">
                <Label className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Période
                </Label>
                <DateFilter
                  dateRangeType={dateRangeType}
                  dateRange={dateRange}
                  onRangeTypeChange={(type: DateRangeType) => setDateRangeType(type)}
                  onCustomRangeChange={(range: DateRange) => setCustomRange(range)}
                />
              </div>
            </div>

            {/* Badges filtres actifs */}
            {hasActiveFilters && (
              <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t">
                <span className="text-xs text-muted-foreground shrink-0">Filtres actifs :</span>
                <div className="flex flex-wrap gap-2">
                  {selectedType !== "all" && (
                    <Badge variant="secondary" className="text-xs gap-1">
                      {TYPES_POSTE.find((t) => t.id === selectedType)?.label}
                      <XCircle className="h-3 w-3 cursor-pointer hover:text-destructive" onClick={() => setSelectedType("all")} />
                    </Badge>
                  )}
                  {selectedExploitation !== "all" && (
                    <Badge variant="secondary" className="text-xs gap-1">
                      {EXPLOITATIONS.find((e) => e.id === selectedExploitation)?.label}
                      <XCircle className="h-3 w-3 cursor-pointer hover:text-destructive" onClick={() => setSelectedExploitation("all")} />
                    </Badge>
                  )}
                  {selectedRegime !== "all" && (
                    <Badge variant="secondary" className="text-xs gap-1">
                      {REGIMES_POSTE.find((r) => r.id === selectedRegime)?.label}
                      <XCircle className="h-3 w-3 cursor-pointer hover:text-destructive" onClick={() => setSelectedRegime("all")} />
                    </Badge>
                  )}
                  {searchQuery && (
                    <Badge variant="secondary" className="text-xs gap-1">
                      Recherche : {searchQuery}
                      <XCircle className="h-3 w-3 cursor-pointer hover:text-destructive" onClick={() => setSearchQuery("")} />
                    </Badge>
                  )}
                  {dateRangeType !== "all" && (
                    <Badge variant="secondary" className="text-xs gap-1">
                      Période: {dateRangeType === "today" ? "Aujourd'hui" : dateRangeType === "week" ? "Cette semaine" : dateRangeType === "month" ? "Ce mois" : "Personnalisé"}
                      <XCircle className="h-3 w-3 cursor-pointer hover:text-destructive" onClick={() => setDateRangeType("all")} />
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Carte */}
      <div className="flex-1 min-h-0 relative">
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
        />
      </div>

      {/* Panneau de détail POSTE */}
      <DetailSheet
        substationId={selectedSubstation}
        isOpen={isSheetOpen}
        onClose={handleCloseSheet}
        poste={poste}
        loading={loadingDetail}
        error={errorDetail}
      />

      {/* Panneau de détail WIRE */}
      <WireDetailSheet
        wireId={selectedWireId}
        isOpen={isWireSheetOpen}
        onClose={handleCloseWireSheet}
        wire={wire}
        loading={loadingWireDetail}
        error={errorWireDetail}
      />
    </div>
  );
}
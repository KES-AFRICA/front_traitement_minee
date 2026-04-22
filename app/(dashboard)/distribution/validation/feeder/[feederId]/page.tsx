"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useParams, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import {
  Copy, GitCompare, FilePlus, FileX, AlertCircle,
  CheckCircle2, ChevronRight, ChevronDown,
  X, Check, Zap, Building2, Cable, Box, ToggleLeft,
  Layers, Info, MapPin, Save, UserCheck, Filter,
  Play, Timer, User, RefreshCw,
  Loader2, Search, History, Clock, ChevronUp, ShieldAlert, Trash2,
  DatabaseZap, Pencil,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sheet, SheetContent, SheetDescription, SheetFooter,
  SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import React from "react";
import { useAuth } from "@/lib/auth/context";
import { useFeederComparison } from "@/hooks/useComparison";
import { FeederComparisonResult, TableName, AnomalyItem, EquipmentDetail } from "@/lib/types/comparison";
import { buildPhotoUrl } from "@/lib/api/services/koboService";
import { PhotoThumb } from "@/app/(dashboard)/map/page";
import {
  useTreatmentStatus, useAssignTreatment, useStartTreatment,
  useCompleteTreatment, useUpdateAttribute, useAllUsers,
  useSetPending, useSetCollecting, useSetPendingValidation,
  useValidateTreatment, useRejectTreatment, useHideRecord,
  useInsertFeeder, useInsertSubstation, useInsertWire,
  useInsertBay, useInsertPowerTransformer, useInsertSwitch, useInsertBusbar,
} from "@/hooks/use-treatment-service";
import { usePreSaveCheck, usePreSaveTreeCheck } from "@/hooks/use-compliance";

// ─── Leaflet client-only ──────────────────────────────────────────────
const FullscreenMap = dynamic(
  () => import("@/components/distribution/feeder-map"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full bg-muted/30 rounded-lg flex items-center justify-center animate-pulse"
        style={{ height: "30vh", minHeight: 200 }}>
        <span className="text-sm text-muted-foreground">Chargement de la carte…</span>
      </div>
    ),
  }
);

// ─── Types ────────────────────────────────────────────────────────────
type AnomalyType = "ok" | "duplicate" | "divergence" | "new" | "missing" | "complex";
type FilterType = AnomalyType | "all";

interface TreatmentState {
  [anomalyId: string]: { treated: boolean; editedFields: Record<string, string>; };
}

interface RecentEdit {
  mrid: string | number; name: string; table: string;
  editedAt: number; fieldsChanged: string[]; equipment: EquipmentDetail;
}

// ─── Durée ────────────────────────────────────────────────────────────
const formatDuration = (seconds: number | null | undefined): string => {
  if (!seconds) return "—";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const parts = [];
  if (days > 0) parts.push(`${days}j`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
  return parts.join(' ');
};

// ─── KPI Config ───────────────────────────────────────────────────────
const KPI_CONFIG = [
  { type: "all" as const, label: "Tous", icon: Filter, color: "text-slate-600 dark:text-slate-400", bg: "bg-slate-500/10", activeBg: "bg-slate-500/15", activeBorder: "border-slate-500/50" },
  { type: "ok" as const, label: "Conformes", icon: CheckCircle2, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10", activeBg: "bg-emerald-500/15", activeBorder: "border-emerald-500/50" },
  { type: "duplicate" as const, label: "Doublons", icon: Copy, color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-500/10", activeBg: "bg-purple-500/15", activeBorder: "border-purple-500/50" },
  { type: "divergence" as const, label: "Divergences", icon: GitCompare, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10", activeBg: "bg-amber-500/15", activeBorder: "border-amber-500/50" },
  { type: "new" as const, label: "Nouveaux", icon: FilePlus, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10", activeBg: "bg-emerald-500/15", activeBorder: "border-emerald-500/50" },
  { type: "missing" as const, label: "Manquants", icon: FileX, color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-500/10", activeBg: "bg-orange-500/15", activeBorder: "border-orange-500/50" },
  { type: "complex" as const, label: "Complexes", icon: AlertCircle, color: "text-red-600 dark:text-red-400", bg: "bg-red-500/10", activeBg: "bg-red-500/15", activeBorder: "border-red-500/50" },
] as const;

const ANOMALY_PRIORITY: AnomalyType[] = ["complex", "duplicate", "divergence", "missing", "new", "ok"];

function getDominantAnomalyConfig(anomalies: AnomalyItem[]) {
  if (anomalies.length === 0) return KPI_CONFIG.find(k => k.type === "ok")!;
  const counts = {} as Record<AnomalyType, number>;
  for (const a of anomalies) counts[a.type] = (counts[a.type] || 0) + 1;
  for (const priority of ANOMALY_PRIORITY) {
    if (counts[priority] && counts[priority] > 0) return KPI_CONFIG.find(k => k.type === priority)!;
  }
  return KPI_CONFIG.find(k => k.type === "ok")!;
}

const TABLE_NAME_MAP: Record<string, string> = {
  powertransformer: "power_transformers", substation: "substations",
  bus_bar: "busbar", bay: "bay", switch: "switch", wire: "wire", feeder: "feeders",
};

const TABLE_ICONS: Record<string, React.ElementType> = {
  substation: Building2, powertransformer: Zap, bus_bar: Layers,
  bay: Box, switch: ToggleLeft, wire: Cable, feeder: Zap,
};

const TABLE_LABELS: Record<string, string> = {
  substation: "Poste", powertransformer: "Transformateur", bus_bar: "Jeux de barres",
  bay: "Cellule", switch: "OCR", wire: "Ligne", feeder: "Départ",
};

const FL: Record<string, string> = {
  name: "Nom", code: "Code", type: "Type", voltage: "Tension (kV)", active: "Actif",
  created_date: "Créé le", display_scada: "SCADA", apparent_power: "Puissance (kVA)",
  substation_id: "Poste", feeder_id: "Départ", phase: "Phase",
  localisation: "Localisation", regime: "Régime", section: "Section",
  nature_conducteur: "Conducteur", height: "Hauteur (m)", latitude: "Latitude",
  longitude: "Longitude", highest_voltage_level: "U max (kV)", exploitation: "Exploitation",
  zone_type: "Type zone", security_zone_id: "Zone sécu.", second_substation_id: "Poste 2",
  normal_open: "NO", bay_id: "Cellule", nature: "Nature", t1: "T1", t2: "T2",
  busbar_id1: "Bus bar 1", busbar_id2: "Bus bar 2", is_injection: "Injection",
  is_feederhead: "Tête départ", local_name: "Nom local", m_rid: "M-RID",
  w1_voltage: "Tension primaire", w2_voltage: "Tension secondaire", substations_m_rid: "Poste",
};
const fl = (k: string) => FL[k] || k;
const fv = (v: unknown): string => {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "Oui" : "Non";
  return String(v);
};

// ─── Modal suppression doublon ────────────────────────────────────────
function DeleteDuplicateConfirmModal({ isOpen, onClose, onConfirm, occurrenceName, isLoading }: {
  isOpen: boolean; onClose: () => void; onConfirm: () => void;
  occurrenceName: string; isLoading: boolean;
}) {
  const [countdown, setCountdown] = useState(10);
  const [isConfirmEnabled, setIsConfirmEnabled] = useState(false);
  useEffect(() => {
    if (isOpen) {
      setCountdown(10); setIsConfirmEnabled(false);
      const interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) { clearInterval(interval); setIsConfirmEnabled(true); return 0; }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600"><Trash2 className="h-5 w-5" />Supprimer le doublon</DialogTitle>
          <DialogDescription>Cette action est <strong className="text-red-600">IRRÉVERSIBLE</strong>.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
            <p className="text-sm text-red-700 dark:text-red-400">Vous êtes sur le point de supprimer l'occurrence :</p>
            <p className="text-sm font-mono font-medium mt-1 break-all">{occurrenceName}</p>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isLoading} className="cursor-pointer">Annuler</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={!isConfirmEnabled || isLoading} className="cursor-pointer">
            {isLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Suppression...</>
              : isConfirmEnabled ? <><Trash2 className="h-4 w-4 mr-2" />Confirmer la suppression</>
              : <><Timer className="h-4 w-4 mr-2" />Attendre {countdown}s</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Modal confirmation finale ─────────────────────────────────────────
function FinalConfirmModal({ isOpen, onClose, onConfirm, isLoading }: {
  isOpen: boolean; onClose: () => void; onConfirm: () => void; isLoading: boolean;
}) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600"><ShieldAlert className="h-5 w-5" />Confirmation finale</DialogTitle>
          <DialogDescription>Êtes-vous absolument sûr de vouloir supprimer définitivement ce doublon ?</DialogDescription>
        </DialogHeader>
        <div className="py-4"><p className="text-sm text-muted-foreground">Cette action ne peut pas être annulée. L'élément sera masqué définitivement.</p></div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isLoading} className="cursor-pointer">Non, annuler</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isLoading} className="cursor-pointer">
            {isLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Suppression...</> : <><Trash2 className="h-4 w-4 mr-2" />Oui, supprimer définitivement</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Modal erreurs de validation ──────────────────────────────────────
function ValidationErrorModal({ isOpen, onClose, errors }: {
  isOpen: boolean; onClose: () => void; errors: string[]; onForceSave?: () => void;
}) {
  const [activeKpi, setActiveKpi] = useState<"total" | "interAsset" | "childErrors" | string | null>(null);

  // Reset filtre à chaque ouverture
  useEffect(() => {
    if (isOpen) setActiveKpi(null);
  }, [isOpen]);

  // ── Comptage par règle ─────────────────────────────────────────────
  const stats = useMemo(() => {
    const ruleCount: Record<string, number> = {};
    let interAsset = 0;
    let childErrors = 0;

    for (const err of errors) {
      const ruleMatch = err.match(/\b(R\d+)\b/);
      if (ruleMatch) {
        const rule = ruleMatch[1];
        ruleCount[rule] = (ruleCount[rule] || 0) + 1;
      }
      if (err.includes("appartient à la fois") || err.includes("inter_asset")) {
        interAsset++;
      }
      if (err.match(/^\[(Bus Bar|Cellule|Transformateur|Switch|bay|busbar|powertransformer)/i)) {
        childErrors++;
      }
    }

    return { total: errors.length, ruleCount, interAsset, childErrors };
  }, [errors]);

  // ── Filtrage de la liste selon KPI actif ───────────────────────────
  const filteredErrors = useMemo(() => {
    if (!activeKpi || activeKpi === "total") return errors;
    if (activeKpi === "interAsset")
      return errors.filter(e => e.includes("appartient à la fois") || e.includes("inter_asset"));
    if (activeKpi === "childErrors")
      return errors.filter(e =>
        !!e.match(/^\[(Bus Bar|Cellule|Transformateur|Switch|bay|busbar|powertransformer)/i)
      );
    // règle Rx
    return errors.filter(e => e.match(new RegExp(`\\b${activeKpi}\\b`)));
  }, [errors, activeKpi]);

  const ruleEntries = Object.entries(stats.ruleCount).sort((a, b) => b[1] - a[1]);

  const kpiCards = [
    {
      key: "total",
      value: stats.total,
      label: `erreur${stats.total > 1 ? "s" : ""} au total`,
      cardCn: "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800",
      activeCn: "ring-2 ring-red-500",
      valueCn: "text-red-600 dark:text-red-400",
      labelCn: "text-red-500",
    },
    {
      key: "interAsset",
      value: stats.interAsset,
      label: `conflit${stats.interAsset > 1 ? "s" : ""} inter-asset`,
      cardCn: "bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800",
      activeCn: "ring-2 ring-orange-500",
      valueCn: "text-orange-600 dark:text-orange-400",
      labelCn: "text-orange-500",
    },
    {
      key: "childErrors",
      value: stats.childErrors,
      label: `erreur${stats.childErrors > 1 ? "s" : ""} équipement`,
      cardCn: "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800",
      activeCn: "ring-2 ring-amber-500",
      valueCn: "text-amber-600 dark:text-amber-400",
      labelCn: "text-amber-500",
    },
  ] as const;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg z-200 max-h-[85vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <ShieldAlert className="h-5 w-5" />
            Validation échouée
          </DialogTitle>
          <DialogDescription>
            L'enregistrement ne peut pas être effectué. Corrigez les erreurs suivantes avant de sauvegarder.
          </DialogDescription>
        </DialogHeader>

        {/* ── KPIs ─────────────────────────────────────────────────── */}
        <div className="flex-shrink-0 grid grid-cols-3 gap-2 py-2">
          {kpiCards.map(({ key, value, label, cardCn, activeCn, valueCn, labelCn }) => (
            <button
              key={key}
              onClick={() => setActiveKpi(prev => prev === key ? null : key)}
              disabled={value === 0}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 p-3 rounded-xl border transition-all cursor-pointer",
                "hover:opacity-80 active:scale-95",
                cardCn,
                activeKpi === key && activeCn,
                value === 0 && "opacity-40 cursor-default pointer-events-none"
              )}
            >
              <span className={cn("text-2xl font-bold tabular-nums leading-none", valueCn)}>
                {value}
              </span>
              <span className={cn("text-[10px] font-medium text-center leading-tight", labelCn)}>
                {label}
              </span>
              {activeKpi === key && (
                <span className={cn("text-[9px] font-semibold mt-0.5", labelCn)}>
                  — filtré —
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Pills par règle ───────────────────────────────────────── */}
        {ruleEntries.length > 0 && (
          <div className="flex-shrink-0 flex flex-wrap gap-1.5 pb-2">
            {ruleEntries.map(([rule, count]) => (
              <button
                key={rule}
                onClick={() => setActiveKpi(prev => prev === rule ? null : rule)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer",
                  "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800",
                  "hover:opacity-80 active:scale-95",
                  activeKpi === rule && "ring-2 ring-red-500 bg-red-200 dark:bg-red-800/50"
                )}
              >
                <span className="font-mono">{rule}</span>
                <span className="flex items-center justify-center min-w-4.5 h-4.5 rounded-full bg-red-600 dark:bg-red-500 text-white text-[10px] font-bold px-1">
                  {count}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* ── Bandeau filtre actif ──────────────────────────────────── */}
        {activeKpi && activeKpi !== "total" && (
          <div className="shrink-0 flex items-center justify-between px-3 py-1.5 rounded-lg bg-muted/40 border border-border/50 mb-1">
            <span className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{filteredErrors.length}</span>
              {" "}erreur{filteredErrors.length > 1 ? "s" : ""} affichée{filteredErrors.length > 1 ? "s" : ""}
            </span>
            <button
              onClick={() => setActiveKpi(null)}
              className="text-[10px] text-primary hover:underline cursor-pointer flex items-center gap-1"
            >
              <X className="h-3 w-3" />
              Tout afficher
            </button>
          </div>
        )}

        {/* ── Liste des erreurs (filtrée) ───────────────────────────── */}
        <div className="flex-1 overflow-y-auto py-1 min-h-0">
          <div className="space-y-2">
            {filteredErrors.map((err, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800"
              >
                <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                <p className="text-sm text-red-700 dark:text-red-400 wrap-break-word flex-1">{err}</p>
              </div>
            ))}
            {filteredErrors.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
                <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                <p className="text-sm">Aucune erreur dans cette catégorie</p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="shrink-0 mt-2">
          <Button variant="outline" onClick={onClose} className="flex-1 cursor-pointer">
            Corriger les données
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Badge anomalie ───────────────────────────────────────────────────
function AnomalyBadge({ type }: { type: AnomalyType }) {
  const cfg = KPI_CONFIG.find((k) => k.type === type)!;
  const Icon = cfg.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full", cfg.bg, cfg.color)}>
      <Icon className="h-2.5 w-2.5" />{cfg.label}
    </span>
  );
}

// ─── KPIs par type d'équipement ───────────────────────────────────────
function EquipmentTypeKPIs({ allAnomalies }: { allAnomalies: AnomalyItem[] }) {
  const equipmentTypes = [
    { table: "feeder", label: "Départs", icon: Zap },
    { table: "substation", label: "Postes", icon: Building2 },
    { table: "bay", label: "Cellules", icon: Box },
    { table: "powertransformer", label: "Transfo.", icon: Zap },
    { table: "switch", label: "OCR", icon: ToggleLeft },
    { table: "wire", label: "Lignes", icon: Cable },
    { table: "bus_bar", label: "JDB", icon: Layers },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
      {equipmentTypes.map(({ table, label, icon: Icon }) => {
        const items = allAnomalies.filter(a => a.table === table);
        const total = items.length;
        const conformes = items.filter(a => a.type === "ok").length;
        const nonConformes = total - conformes;
        if (total === 0) return null;
        return (
          <div key={table} className="rounded-xl border border-border bg-card p-3 space-y-2">
            <div className="flex items-center gap-1.5">
              <div className="p-1 rounded-md bg-primary/10"><Icon className="h-3 w-3 text-primary" /></div>
              <span className="text-xs font-semibold text-foreground truncate">{label}</span>
            </div>
            <p className="text-xl font-bold leading-none">{total}</p>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-emerald-600 font-medium flex items-center gap-1"><CheckCircle2 className="h-2.5 w-2.5" />{conformes} conf.</span>
                {nonConformes > 0 && <span className="text-red-500 font-medium flex items-center gap-1"><AlertCircle className="h-2.5 w-2.5" />{nonConformes} n.c.</span>}
              </div>
              <div className="w-full h-1 rounded-full bg-border overflow-hidden">
                <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: total > 0 ? `${(conformes / total) * 100}%` : "0%" }} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Barre de recherche ───────────────────────────────────────────────
function EquipmentSearchBar({ allAnomalies, onEquipmentClick, onSubstationClick }: {
  allAnomalies: AnomalyItem[];
  onEquipmentClick: (equipment: EquipmentDetail) => void;
  onSubstationClick: (anomaly: AnomalyItem) => void;
}) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    if (!query.trim() || query.length < 2) return [];
    const q = query.toLowerCase();
    return allAnomalies.filter(a => {
      const name = (a.name || "").toLowerCase();
      const mrid = String(a.mrid || "").toLowerCase();
      const tableLabel = (TABLE_LABELS[a.table] || a.table).toLowerCase();
      const dataName = (a.data?.name || a.collected_data?.name || a.reference_data?.name || "").toLowerCase();
      return name.includes(q) || mrid.includes(q) || tableLabel.includes(q) || dataName.includes(q);
    }).slice(0, 20);
  }, [query, allAnomalies]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const buildEquipmentDetail = (anomaly: AnomalyItem): EquipmentDetail => {
    const collectedData = anomaly.collected_data || {};
    const referenceData = anomaly.reference_data || {};
    const directData = anomaly.data || {};
    let recordData: Record<string, any> = {};
    if (anomaly.type === "missing") recordData = { ...directData, ...referenceData };
    else if (anomaly.type === "new") recordData = { ...directData, ...collectedData };
    else if (anomaly.type === "divergence") recordData = { ...referenceData, ...collectedData };
    else if (anomaly.type === "duplicate") recordData = { ...collectedData };
    else recordData = { ...directData, ...collectedData };
    const photoUrl = collectedData.photo || directData.photo || referenceData.photo || recordData.photo || null;
    return {
      id: anomaly.mrid, mrid: anomaly.mrid, table: anomaly.table,
      name: anomaly.name || recordData.name || String(anomaly.mrid),
      data: { ...recordData, _anomalyType: anomaly.type },
      anomalies: [anomaly], photo: photoUrl,
      location: recordData.latitude && recordData.longitude
        ? { lat: parseFloat(String(recordData.latitude)), lng: parseFloat(String(recordData.longitude)) } : undefined,
    };
  };

  const handleSelect = (anomaly: AnomalyItem) => {
    if (anomaly.table === "substation") onSubstationClick(anomaly);
    else onEquipmentClick(buildEquipmentDetail(anomaly));
    setIsOpen(false); setQuery("");
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input ref={inputRef} value={query}
          onChange={e => { setQuery(e.target.value); setIsOpen(true); }}
          onFocus={() => query.length >= 2 && setIsOpen(true)}
          placeholder="Rechercher un équipement par nom, M-RID, type… (poste, cellule, switch, câble…)"
          className="pl-9 pr-4 h-10 text-sm" />
        {query && (
          <button onClick={() => { setQuery(""); setIsOpen(false); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {isOpen && results.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-xl border border-border bg-card shadow-xl overflow-hidden max-h-80 overflow-y-auto">
          <div className="px-3 py-1.5 border-b border-border/50 bg-muted/20">
            <span className="text-[10px] text-muted-foreground font-medium">{results.length} résultat{results.length > 1 ? "s" : ""} trouvé{results.length > 1 ? "s" : ""}</span>
          </div>
          {results.map(anomaly => {
            const cfg = KPI_CONFIG.find(k => k.type === anomaly.type)!;
            const Icon = TABLE_ICONS[anomaly.table] || Box;
            const CfgIcon = cfg.icon;
            return (
              <button key={anomaly.id} onClick={() => handleSelect(anomaly)}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/30 transition-colors text-left border-b border-border/20 last:border-0 cursor-pointer">
                <div className="p-1.5 rounded-lg bg-primary/10 shrink-0"><Icon className="h-3.5 w-3.5 text-primary" /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{anomaly.name || anomaly.mrid}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] text-muted-foreground">{TABLE_LABELS[anomaly.table] || anomaly.table}</span>
                    <span className="text-[10px] text-muted-foreground/50">·</span>
                    <span className="text-[10px] font-mono text-muted-foreground/70 truncate">{anomaly.mrid}</span>
                  </div>
                </div>
                <span className={cn("inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0", cfg.bg, cfg.color)}>
                  <CfgIcon className="h-2.5 w-2.5" />{cfg.label}
                </span>
              </button>
            );
          })}
        </div>
      )}
      {isOpen && query.length >= 2 && results.length === 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-xl border border-border bg-card shadow-xl p-6 text-center">
          <Search className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Aucun équipement trouvé pour <strong>"{query}"</strong></p>
        </div>
      )}
    </div>
  );
}

// ─── Historique des modifications récentes ────────────────────────────
function RecentEditsPanel({ recentEdits, onEquipmentClick }: {
  recentEdits: RecentEdit[]; onEquipmentClick: (equipment: EquipmentDetail) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  if (recentEdits.length === 0) return null;
  const formatTime = (ts: number) => {
    const diff = Date.now() - ts;
    if (diff < 60000) return "à l'instant";
    if (diff < 3600000) return `il y a ${Math.floor(diff / 60000)}min`;
    return `il y a ${Math.floor(diff / 3600000)}h`;
  };
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center gap-2 px-4 py-2.5 hover:bg-muted/20 transition-colors cursor-pointer">
        <History className="h-4 w-4 text-primary" />
        <span className="font-semibold text-sm flex-1 text-left">Modifications récentes</span>
        <Badge className="bg-amber-100 text-amber-700 border-amber-200">{recentEdits.length}</Badge>
        {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {isOpen && (
        <div className="border-t border-border/40 divide-y divide-border/20 max-h-64 overflow-y-auto">
          {recentEdits.map((edit, idx) => {
            const Icon = TABLE_ICONS[edit.table] || Box;
            return (
              <button key={idx} onClick={() => onEquipmentClick(edit.equipment)}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 transition-colors text-left cursor-pointer">
                <div className="p-1.5 rounded-lg bg-amber-500/10 shrink-0"><Icon className="h-3.5 w-3.5 text-amber-600" /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{edit.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] text-muted-foreground">{TABLE_LABELS[edit.table]}</span>
                    <span className="text-[10px] text-muted-foreground/50">·</span>
                    <span className="text-[10px] text-muted-foreground">{edit.fieldsChanged.length} champ{edit.fieldsChanged.length > 1 ? "s" : ""} modifié{edit.fieldsChanged.length > 1 ? "s" : ""}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0 text-[10px] text-muted-foreground">
                  <Clock className="h-3 w-3" />{formatTime(edit.editedAt)}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Dialog assignation ────────────────────────────────────────────────
function AssignDialog({ isOpen, onClose, onAssign, feederName, processingAgents, isAssigning, currentUser, isReassign = false }: {
  isOpen: boolean; onClose: () => void; onAssign: (agentId: string, agentName: string) => void;
  feederName: string; processingAgents: any[]; isAssigning: boolean; currentUser: any | null; isReassign?: boolean;
}) {
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const getInitials = (firstName: string, lastName: string) =>
    `${firstName?.charAt(0) || ""}${lastName?.charAt(0) || ""}`.toUpperCase();
  const handleAssign = () => {
    if (!selectedAgentId) { toast.warning("Veuillez sélectionner un agent"); return; }
    const selectedAgent = processingAgents.find(agent => agent.id === selectedAgentId);
    if (selectedAgent) onAssign(selectedAgentId, `${selectedAgent.firstName} ${selectedAgent.lastName}`);
  };
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-primary" />
            {isReassign ? "Assigner un autre agent" : "Assigner un agent"}
          </DialogTitle>
          <DialogDescription>{isReassign ? "Changez l'agent responsable de ce départ." : "Assignez ce départ à un agent de traitement."}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Départ concerné</Label>
            <div className="p-3 bg-muted/30 rounded-lg"><p className="font-medium text-sm">{feederName}</p></div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="agent">Sélectionner un agent</Label>
            <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
              <SelectTrigger id="agent" className="w-full cursor-pointer"><SelectValue placeholder="Choisir un agent..." /></SelectTrigger>
              <SelectContent>
                {processingAgents.length === 0 ? (
                  <SelectItem value="none" disabled>Aucun agent disponible</SelectItem>
                ) : (
                  processingAgents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id} className="cursor-pointer">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-xs bg-primary/10 text-primary">{getInitials(agent.firstName, agent.lastName)}</AvatarFallback>
                        </Avatar>
                        <span>{agent.firstName} {agent.lastName}</span>
                        <div className="ml-2 py-1 px-2 border rounded-md text-xs">{agent.company}</div>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="flex gap-2">
          <Button variant="outline" className="flex-1 cursor-pointer" onClick={onClose} disabled={isAssigning}>Annuler</Button>
          <Button onClick={handleAssign} disabled={isAssigning || !selectedAgentId || processingAgents.length === 0}
            className="flex-1 bg-purple-600 hover:bg-purple-700 cursor-pointer">
            {isAssigning ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Assignation...</>
              : <><UserCheck className="h-4 w-4 mr-2" />{isReassign ? "Réassigner" : "Assigner"}</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── OccurrenceEditCard ───────────────────────────────────────────────
function OccurrenceEditCard({ occurrence, index, canEdit, onSaveSuccess, feederId, equipmentTable, user, updateAttributeMutation, refreshData, onCloseModal }: {
  occurrence: any; index: number; canEdit: boolean;
  onSaveSuccess: (mrid: string, updatedData: Record<string, unknown>) => void;
  feederId: string; equipmentTable: string; user: any;
  updateAttributeMutation: any; refreshData: () => void; onCloseModal?: () => void;
}) {
  const HIDDEN_FIELDS = new Set([
    "qrcode", "precision", "photo", "exploitattion_m_rid", "collected_date",
    "collected_agent_name", "arrondissements_m_rid", "structure_m_rid",
    "second_switch_m_rid", "pole_m_rid", "created_at", "created_date", "cacher", "collected_by"
  ]);
  const LOCATION_FIELDS = new Set(["latitude", "longitude"]);

  const [localRecord, setLocalRecord] = useState<Record<string, any>>({ ...(occurrence.full_record || {}) });
  const mrid = occurrence.m_rid;
  const [editedData, setEditedData] = useState<Record<string, any>>({ ...localRecord });
  const [isSaving, setIsSaving] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showFinalConfirmModal, setShowFinalConfirmModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const hideRecordMutation = useHideRecord();
  const preSaveCheckMutation = usePreSaveCheck();

  const getPhotoUrl = (photo: any) => {
    if (!photo) return null;
    if (typeof photo === 'string') {
      if (photo.startsWith('http://') || photo.startsWith('https://') || photo.startsWith('/')) return photo;
      return buildPhotoUrl(photo);
    }
    if (Array.isArray(photo) && photo.length > 0) {
      const first = photo[0];
      if (typeof first === 'string') return first.startsWith('http') ? first : buildPhotoUrl(first);
      if (first?.download_url) return first.download_url;
      if (first?.filename) return buildPhotoUrl(first.filename);
    }
    return null;
  };
  const photoUrl = getPhotoUrl(localRecord.photo);

  const editableFields = useMemo(() =>
    Object.keys(localRecord).filter(k => !HIDDEN_FIELDS.has(k) && !LOCATION_FIELDS.has(k)),
    [localRecord]
  );
  const fieldsWithValue = editableFields.filter(k => localRecord[k] !== null && localRecord[k] !== undefined && localRecord[k] !== "");
  const fieldsWithoutValue = editableFields.filter(k => localRecord[k] === null || localRecord[k] === undefined || localRecord[k] === "");

  const handleFieldChange = (field: string, value: unknown) => setEditedData(prev => ({ ...prev, [field]: value }));

  const getFieldInputType = (field: string): "text" | "number" | "select" => {
    if (["active", "is_injection", "is_feederhead", "normal_open", "display_scada"].includes(field)) return "select";
    if (["voltage", "apparent_power", "height", "w1_voltage", "w2_voltage", "highest_voltage_level"].includes(field)) return "number";
    return "text";
  };
  const getSelectValue = (value: any): string => (value === 1 || value === "1") ? "true" : "false";

  const doSave = async (changedFields: string[]) => {
    const sqlTableName = TABLE_NAME_MAP[equipmentTable] ?? equipmentTable;
    await Promise.all(changedFields.map(field =>
      updateAttributeMutation.mutateAsync({
        feeder_id: feederId, table_name: sqlTableName, record_id: String(mrid),
        attribute_name: field, new_value: editedData[field],
        changed_by: user.id, changed_by_name: `${user.firstName} ${user.lastName}`,
        comment: `Correction doublon occurrence #${index + 1}`,
      })
    ));
    const updatedRecord = { ...localRecord };
    changedFields.forEach(f => { updatedRecord[f] = editedData[f]; });
    setLocalRecord(updatedRecord);
    setEditedData({ ...updatedRecord });
    toast.success(`Occurrence #${index + 1} — ${changedFields.length} champ(s) enregistré(s)`);
    onSaveSuccess(mrid, updatedRecord);
    refreshData();
    if (onCloseModal) onCloseModal();
  };

  const handleSave = async () => {
    if (!user) { toast.error("Utilisateur non connecté"); return; }
    setIsSaving(true);
    const changedFields = editableFields.filter(field => String(editedData[field]) !== String(localRecord[field]));
    const payload: Record<string, unknown> = { ...localRecord, ...editedData };
    delete payload._anomalyType;
    delete payload.photo;
    try {
      const checkResult = await preSaveCheckMutation.mutateAsync({ tableName: equipmentTable, payload });
      if (!checkResult.can_save) { setValidationErrors(checkResult.errors); setShowValidationModal(true); setIsSaving(false); return; }
      await doSave(changedFields);
    } catch { toast.error("Erreur lors de la validation ou de l'enregistrement"); }
    setIsSaving(false);
  };

  const handleFinalConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      const sqlTableName = TABLE_NAME_MAP[equipmentTable] ?? equipmentTable;
      await hideRecordMutation.mutateAsync({ tableName: sqlTableName, recordId: String(mrid) });
      toast.success(`Occurrence #${index + 1} supprimée avec succès`);
      refreshData();
      if (onCloseModal) onCloseModal();
    } catch { toast.error("Erreur lors de la suppression"); }
    finally { setIsDeleting(false); setShowFinalConfirmModal(false); }
  };

  const hasChanges = editableFields.some(f => String(editedData[f]) !== String(localRecord[f]));

  return (
    <>
      <ValidationErrorModal isOpen={showValidationModal} onClose={() => setShowValidationModal(false)} errors={validationErrors} />
      <DeleteDuplicateConfirmModal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)}
        onConfirm={() => { setShowDeleteModal(false); setShowFinalConfirmModal(true); }}
        occurrenceName={occurrence.name || mrid} isLoading={isDeleting} />
      <FinalConfirmModal isOpen={showFinalConfirmModal} onClose={() => setShowFinalConfirmModal(false)}
        onConfirm={handleFinalConfirmDelete} isLoading={isDeleting} />

      <div className="border border-purple-200 dark:border-purple-800 rounded-xl overflow-hidden bg-purple-50/30 dark:bg-purple-950/10">
        <div className="px-3 py-2.5 bg-purple-100/50 dark:bg-purple-900/20 border-b border-purple-200 dark:border-purple-800 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-purple-700 dark:text-purple-400">Occurrence #{index + 1}</span>
            <span className="text-[10px] font-mono text-purple-600/70 break-all">{mrid}</span>
          </div>
          <div className="flex items-center gap-2">
            {hasChanges && <span className="text-[10px] text-amber-600 font-medium">● modifié</span>}
            {canEdit && (
              <Button variant="destructive" size="sm" onClick={() => setShowDeleteModal(true)} disabled={isDeleting}
                className="h-7 px-2 text-xs gap-1 cursor-pointer">
                <Trash2 className="h-3 w-3" />Supprimer
              </Button>
            )}
          </div>
        </div>
        {photoUrl && <div className="px-3 pt-3"><PhotoThumb src={photoUrl} alt={`Occurrence ${index + 1}`} /></div>}
        {(localRecord.latitude || localRecord.longitude) && (
          <div className="px-3 pt-3">
            <div className="p-2 rounded-lg bg-muted/30 flex items-center gap-2 text-xs">
              <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="font-mono text-muted-foreground">
                {localRecord.latitude ? parseFloat(String(localRecord.latitude)).toFixed(6) : "—"},{" "}
                {localRecord.longitude ? parseFloat(String(localRecord.longitude)).toFixed(6) : "—"}
              </span>
              <span className="text-[10px] text-muted-foreground ml-auto">non modifiable</span>
            </div>
          </div>
        )}
        <div className="p-3 space-y-2">
          {fieldsWithValue.map(field => {
            const inputType = getFieldInputType(field);
            const value = editedData[field];
            const originalValue = localRecord[field];
            const isModified = String(value) !== String(originalValue);
            const isMridField = field === "m_rid";
            return (
              <div key={field} className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                    {fl(field)}
                    {isMridField && canEdit && <span className="text-[9px] text-purple-500 font-medium px-1 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30">modifiable</span>}
                  </Label>
                  {isModified && canEdit && <span className="text-[10px] text-amber-600">modifié</span>}
                </div>
                {!canEdit ? (
                  <div className="p-1.5 rounded bg-muted/20 text-xs font-mono">{fv(value)}</div>
                ) : inputType === "select" && !isMridField ? (
                  <Select value={getSelectValue(value)} onValueChange={(v) => handleFieldChange(field, v === "true" ? 1 : 0)}>
                    <SelectTrigger className="h-8 text-xs cursor-pointer"><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true" className="cursor-pointer">Oui / Actif</SelectItem>
                      <SelectItem value="false" className="cursor-pointer">Non / Inactif</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Input type={isMridField ? "text" : inputType} value={String(value ?? "")}
                    onChange={e => handleFieldChange(field, inputType === "number" && !isMridField ? parseFloat(e.target.value) : e.target.value)}
                    className={cn("h-8 text-xs", isModified && "border-amber-500 focus-visible:ring-amber-500", isMridField && "border-purple-400 focus-visible:ring-purple-400 font-mono")} />
                )}
                {isModified && canEdit && <p className="text-[10px] text-muted-foreground">Ancienne valeur: {fv(originalValue)}</p>}
              </div>
            );
          })}
          {fieldsWithoutValue.length > 0 && (
            <details className="pt-1">
              <summary className="text-[11px] text-purple-600 cursor-pointer hover:text-purple-800 select-none"
                onClick={() => setIsExpanded(p => !p)}>
                {isExpanded ? "Masquer" : `+ ${fieldsWithoutValue.length} champ(s) vide(s)`}
              </summary>
              <div className="mt-2 space-y-2">
                {fieldsWithoutValue.map(field => {
                  const inputType = getFieldInputType(field);
                  const value = editedData[field];
                  const isMridField = field === "m_rid";
                  return (
                    <div key={field} className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">{fl(field)}</Label>
                      {!canEdit ? (
                        <div className="p-1.5 rounded bg-muted/20 text-xs font-mono text-muted-foreground">—</div>
                      ) : inputType === "select" && !isMridField ? (
                        <Select value={getSelectValue(value)} onValueChange={(v) => handleFieldChange(field, v === "true" ? 1 : 0)}>
                          <SelectTrigger className="h-8 text-xs cursor-pointer"><SelectValue placeholder="Non défini" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="true" className="cursor-pointer">Oui / Actif</SelectItem>
                            <SelectItem value="false" className="cursor-pointer">Non / Inactif</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input type={isMridField ? "text" : inputType} value={String(value ?? "")} placeholder="—"
                          onChange={e => handleFieldChange(field, inputType === "number" && !isMridField ? parseFloat(e.target.value) : e.target.value)}
                          className={cn("h-8 text-xs", isMridField && "border-purple-400 focus-visible:ring-purple-400 font-mono")} />
                      )}
                    </div>
                  );
                })}
              </div>
            </details>
          )}
        </div>
        {canEdit && (
          <div className="px-3 pb-3 border-t border-purple-200 dark:border-purple-800 pt-3">
            <Button onClick={handleSave} disabled={isSaving} size="sm" className="w-full cursor-pointer">
              {isSaving ? <><Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />Enregistrement...</>
                : <><Save className="h-3.5 w-3.5 mr-2" />Enregistrer l'occurrence #{index + 1}</>}
            </Button>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Hook insertion par table ─────────────────────────────────────────
function useInsertByTable(table: string) {
  const insertFeeder = useInsertFeeder();
  const insertSubstation = useInsertSubstation();
  const insertWire = useInsertWire();
  const insertBay = useInsertBay();
  const insertPowerTransformer = useInsertPowerTransformer();
  const insertSwitch = useInsertSwitch();
  const insertBusbar = useInsertBusbar();
  const mutationMap: Record<string, any> = {
    feeder: insertFeeder, substation: insertSubstation, wire: insertWire,
    bay: insertBay, powertransformer: insertPowerTransformer, switch: insertSwitch, bus_bar: insertBusbar,
  };
  return mutationMap[table] ?? null;
}

// ─── EquipmentDetailSheet ─────────────────────────────────────────────
function EquipmentDetailSheet({ equipment, isOpen, onClose, onSave, treatment, onFieldChange, isTreatmentActive, isTreatmentAllowed, feederId, user, updateAttributeMutation, refreshData }: {
  equipment: EquipmentDetail | null; isOpen: boolean; onClose: () => void;
  onSave: (equipment: EquipmentDetail, updatedData: Record<string, unknown>) => void;
  treatment: TreatmentState; onFieldChange: (anomalyId: string, field: string, val: string) => void;
  isTreatmentActive: boolean; isTreatmentAllowed: boolean | null;
  feederId: string; user: any; updateAttributeMutation: any; refreshData: () => void;
}) {
  const [editedData, setEditedData] = useState<Record<string, unknown>>({});
  const [localData, setLocalData] = useState<Record<string, unknown>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isInserting, setIsInserting] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenPhoto, setFullscreenPhoto] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showValidationModal, setShowValidationModal] = useState(false);

  const preSaveCheckMutation = usePreSaveCheck();
  const insertMutation = useInsertByTable(equipment?.table ?? "");

  const HIDDEN_FIELDS = new Set([
    "qrcode", "precision", "photo", "exploitattion_m_rid", "collected_date",
    "collected_agent_name", "arrondissements_m_rid", "structure_m_rid",
    "second_switch_m_rid", "pole_m_rid", "cacher", "collected_by"
  ]);
  const LOCATION_FIELDS = new Set(["latitude", "longitude"]);

  useEffect(() => {
    if (equipment) { setLocalData({ ...equipment.data }); setEditedData({ ...equipment.data }); }
  }, [equipment]);

  const divergentFieldNames = useMemo(() => {
    const d = equipment?.anomalies.find(a => a.type === "divergence");
    return d?.divergent_fields ? new Set(d.divergent_fields.map(df => df.field)) : new Set<string>();
  }, [equipment]);

  const isMissingEquipment = equipment?.anomalies.some(a => a.type === "missing") ?? false;
  const canEdit = isTreatmentActive && !!isTreatmentAllowed;

  const allFields = useMemo(() => {
    if (!equipment) return [];
    const data = editedData;
    const fieldsWithValue: string[] = [];
    const fieldsWithoutValue: string[] = [];
    const keys = Object.keys(data).filter(k =>
      !HIDDEN_FIELDS.has(k) && !LOCATION_FIELDS.has(k) &&
      k !== "_anomalyType" && k !== "_table" && k !== "created_date" && k !== "created_at" &&
      k !== "structure_m_rid" && k !== "localisation" && k !== "description" && k !== "observation"
    );
    for (const field of keys) {
      const value = data[field];
      const hasValue = value !== null && value !== undefined && value !== "";
      if (hasValue) fieldsWithValue.push(field); else fieldsWithoutValue.push(field);
    }
    const sortByPriority = (fields: string[]) => {
      const mridIdx = fields.indexOf("m_rid");
      const sorted = fields.filter(f => f !== "m_rid").sort((a, b) => {
        const aP = divergentFieldNames.has(a); const bP = divergentFieldNames.has(b);
        if (aP && !bP) return -1; if (!aP && bP) return 1; return a.localeCompare(b);
      });
      if (mridIdx !== -1) return ["m_rid", ...sorted];
      return sorted;
    };
    return [...sortByPriority(fieldsWithValue), ...sortByPriority(fieldsWithoutValue)];
  }, [equipment, editedData, divergentFieldNames]);

  const filteredFields = useMemo(() => {
    const isDivergenceAnomaly = equipment?.anomalies.some(a => a.type === "divergence") ?? false;
    if (!isDivergenceAnomaly) return allFields;
    return allFields.filter(field => !divergentFieldNames.has(field));
  }, [allFields, divergentFieldNames, equipment]);

  if (!equipment) return null;

  const Icon = TABLE_ICONS[equipment.table] || Box;

  const getPhotoUrl = (photo: any) => {
    if (!photo) return null;
    if (typeof photo === 'string') {
      if (photo.startsWith('http://') || photo.startsWith('https://') || photo.startsWith('/')) return photo;
      return buildPhotoUrl(photo);
    }
    if (Array.isArray(photo) && photo.length > 0) {
      const first = photo[0];
      if (typeof first === 'string') {
        if (first.startsWith('http://') || first.startsWith('https://') || first.startsWith('/')) return first;
        return buildPhotoUrl(first);
      }
      if (first?.download_url) return first.download_url;
      if (first?.filename) return buildPhotoUrl(first.filename);
    }
    return null;
  };

  const rawPhoto = equipment.photo || equipment.data?.photo
    || equipment.anomalies?.[0]?.collected_data?.photo
    || equipment.anomalies?.[0]?.data?.photo
    || equipment.anomalies?.[0]?.reference_data?.photo;
  const displayPhotoUrl = getPhotoUrl(rawPhoto);
  const isDuplicateAnomaly = equipment.anomalies.some(a => a.type === "duplicate");
  const duplicateAnomaly = equipment.anomalies.find(a => a.type === "duplicate");
  const isDivergenceAnomaly = equipment.anomalies.some(a => a.type === "divergence");

  const getFieldInputType = (field: string): "text" | "number" | "select" => {
    if (field === "m_rid") return "text";
    if (["active", "is_injection", "is_feederhead", "normal_open", "display_scada"].includes(field)) return "select";
    if (["voltage", "apparent_power", "height", "w1_voltage", "w2_voltage", "highest_voltage_level"].includes(field)) return "number";
    return "text";
  };
  const getSelectValue = (value: any): string => (value === 1 || value === "1") ? "true" : "false";
  const handleFieldChange = (field: string, value: string | number | boolean) =>
    setEditedData((prev) => ({ ...prev, [field]: value }));

  const doSave = async (changedFields: string[]) => {
    const sqlTableName = TABLE_NAME_MAP[equipment.table] ?? equipment.table;
    await Promise.all(changedFields.map(field =>
      updateAttributeMutation.mutateAsync({
        feeder_id: feederId, table_name: sqlTableName, record_id: String(equipment.mrid),
        attribute_name: field, new_value: editedData[field],
        changed_by: user.id, changed_by_name: `${user.firstName} ${user.lastName}`,
        comment: `Modification depuis l'interface de traitement`,
      })
    ));
    const updatedData = { ...localData };
    changedFields.forEach(f => { updatedData[f] = editedData[f]; });
    setLocalData(updatedData); setEditedData({ ...updatedData });
    toast.success(`${changedFields.length} champ(s) modifié(s) avec succès`);
    onSave(equipment, updatedData);
    refreshData(); onClose();
  };

  const handleSave = async () => {
    if (!user) { toast.error("Utilisateur non connecté"); return; }
    setIsSaving(true);
    const changedFields = Object.keys(editedData).filter(
      key => String(editedData[key]) !== String(localData[key]) && key !== "_anomalyType" && key !== "photo"
    );
    const tableNameMapForPreSave: Record<string, string> = {
      substations: "substation", power_transformers: "powertransformer",
      busbar: "bus_bar", feeders: "feeder", bay: "bay", switch: "switch", wire: "wire",
    };
    const tableNameForApi = tableNameMapForPreSave[equipment.table] ?? equipment.table;
    const payload: Record<string, unknown> = { ...localData, ...editedData };
    delete payload._anomalyType; delete payload.photo;
    try {
      const checkResult = await preSaveCheckMutation.mutateAsync({ tableName: tableNameForApi, payload });
      if (!checkResult.can_save) { setValidationErrors(checkResult.errors); setShowValidationModal(true); setIsSaving(false); return; }
      await doSave(changedFields);
    } catch { toast.error("Erreur lors de la validation ou de l'enregistrement"); }
    setIsSaving(false);
  };

  const handleInsert = async () => {
    if (!user) { toast.error("Utilisateur non connecté"); return; }
    if (!insertMutation) { toast.error("Type d'équipement non supporté pour l'insertion"); return; }
    setIsInserting(true);
    const tableNameForApi = equipment.table;
    const payload: Record<string, unknown> = { ...localData, ...editedData };
    delete payload._anomalyType; delete payload._table; delete payload.photo;
    if (!payload["m_rid"]) payload["m_rid"] = equipment.mrid;
    try {
      const checkResult = await preSaveCheckMutation.mutateAsync({ tableName: tableNameForApi, payload });
      if (!checkResult.can_save) { setValidationErrors(checkResult.errors); setShowValidationModal(true); setIsInserting(false); return; }
      await insertMutation.mutateAsync({ ...payload, feeder_id: feederId, inserted_by: user.id, inserted_by_name: `${user.firstName} ${user.lastName}` });
      toast.success(`${TABLE_LABELS[equipment.table] || equipment.table} inséré(e) avec succès dans la BD`);
      onSave(equipment, editedData); refreshData(); onClose();
    } catch (err: any) { toast.error(err?.message || "Erreur lors de l'insertion en base de données"); }
    setIsInserting(false);
  };

  const sheetWidthClass = isDuplicateAnomaly
    ? "w-screen! sm:w-[92vw]! max-w-none! sm:max-w-[92vw]!"
    : "w-screen! sm:w-[480px]! max-w-none! sm:max-w-[480px]!";

  const hasChanges = Object.keys(editedData).some(
    key => String(editedData[key]) !== String(localData[key]) && key !== "_anomalyType" && key !== "photo"
  );

  return (
    <>
      <ValidationErrorModal isOpen={showValidationModal} onClose={() => setShowValidationModal(false)} errors={validationErrors} />
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent side="right" className={cn(sheetWidthClass, "flex flex-col p-0 overflow-hidden")}>
          <SheetHeader className="px-5 py-4 border-b shrink-0">
            <div className="flex items-center gap-2">
              <Icon className="h-5 w-5 text-primary" />
              <SheetTitle className="text-base">{equipment.name}</SheetTitle>
            </div>
            <SheetDescription className="text-sm flex flex-wrap items-center gap-2">
              <span>{TABLE_LABELS[equipment.table] || equipment.table} • ID: {equipment.mrid}</span>
              {isMissingEquipment && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-600 border border-orange-200">
                  <FileX className="h-2.5 w-2.5" />Manquant dans la BD — éditable
                </span>
              )}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-5">
            {isDuplicateAnomaly && duplicateAnomaly?.duplicate_occurrences ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-purple-200 dark:border-purple-800">
                  <Copy className="h-4 w-4 text-purple-600" />
                  <h3 className="font-semibold text-sm text-purple-700 dark:text-purple-400">
                    {duplicateAnomaly.duplicate_occurrences.length} occurrences détectées
                  </h3>
                  <Badge className="bg-purple-100 text-purple-700 border-purple-200 ml-auto">Doublon confirmé</Badge>
                </div>
                <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(duplicateAnomaly.duplicate_occurrences.length, 3)}, minmax(0, 1fr))` }}>
                  {duplicateAnomaly.duplicate_occurrences.map((occ: any, idx: number) => (
                    <OccurrenceEditCard key={occ.m_rid || idx} occurrence={occ} index={idx}
                      canEdit={!!canEdit} onSaveSuccess={() => {}} feederId={feederId}
                      equipmentTable={equipment.table} user={user}
                      updateAttributeMutation={updateAttributeMutation}
                      refreshData={refreshData} onCloseModal={onClose} />
                  ))}
                </div>
              </div>
            ) : (
              <>
                <div className="w-full flex flex-col items-center justify-center py-2 border-b border-dashed border-border">
                  {displayPhotoUrl ? (
                    <div className="relative cursor-pointer w-full h-full" onClick={() => { setFullscreenPhoto(displayPhotoUrl); setIsFullscreen(true); }}>
                      <PhotoThumb src={displayPhotoUrl} alt={equipment.name} />
                    </div>
                  ) : (
                    <div className="w-full h-full rounded-full bg-muted/50 flex items-center justify-center">
                      <Icon className="h-12 w-12 text-muted-foreground/50" />
                    </div>
                  )}
                </div>

                {isDivergenceAnomaly && canEdit && (
                  <div className="space-y-3">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-amber-600">Champs en divergence (modifiables directement)</Label>
                    {equipment.anomalies.filter(a => a.type === "divergence" && a.divergent_fields)
                      .flatMap(a => a.divergent_fields || [])
                      .map((field: any, idx: number) => {
                        const currentValue = editedData[field.field] !== undefined ? editedData[field.field] : field.collected_value;
                        const isModified = String(currentValue) !== String(localData[field.field]);
                        const inputType = getFieldInputType(field.field);
                        return (
                          <div key={idx} className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium">{fl(field.field)}</span>
                              <div className="flex items-center gap-2">
                                <AnomalyBadge type="divergence" />
                                {isModified && <span className="text-[10px] text-amber-600">modifié</span>}
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3 text-xs">
                              <div>
                                <p className="text-muted-foreground mb-1">Valeur référence</p>
                                <p className="font-mono p-2 rounded bg-muted/30 line-through text-muted-foreground">{fv(field.reference_value)}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground mb-1">Nouvelle valeur</p>
                                {inputType === "select" ? (
                                  <Select value={getSelectValue(currentValue)} onValueChange={(v) => handleFieldChange(field.field, v === "true" ? 1 : 0)}>
                                    <SelectTrigger className={cn("h-8 text-sm font-mono", isModified && "border-amber-500")}><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="true" className="cursor-pointer">Oui / Actif</SelectItem>
                                      <SelectItem value="false" className="cursor-pointer">Non / Inactif</SelectItem>
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <Input type={inputType} value={String(currentValue ?? "")}
                                    onChange={(e) => handleFieldChange(field.field, inputType === "number" ? parseFloat(e.target.value) : e.target.value)}
                                    className={cn("h-8 text-sm font-mono", isModified && "border-amber-500")} />
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}

                {isDivergenceAnomaly && !canEdit && (
                  <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                      <span className="font-semibold text-sm text-amber-700">Anomalie détectée</span>
                    </div>
                    {equipment.anomalies.map((anomaly) => (
                      <div key={anomaly.id} className="text-sm space-y-2">
                        <div className="flex items-center gap-2">
                          <AnomalyBadge type={anomaly.type} />
                          <span className="text-muted-foreground text-xs">ID: {anomaly.id}</span>
                        </div>
                        {anomaly.type === "divergence" && anomaly.divergent_fields && (
                          <div className="mt-2 pt-2 border-t border-amber-500/20 space-y-2">
                            {anomaly.divergent_fields.map((df: any, idx: number) => (
                              <div key={idx} className="p-2 rounded bg-muted/20">
                                <div className="font-medium text-xs mb-1">{fl(df.field)}</div>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  <div className="p-1.5 rounded bg-red-50 dark:bg-red-950/20">
                                    <span className="text-red-600 text-[10px] font-medium">RÉFÉRENCE</span>
                                    <p className="font-mono">{fv(df.reference_value)}</p>
                                  </div>
                                  <div className="p-1.5 rounded bg-amber-50 dark:bg-amber-950/20">
                                    <span className="text-amber-600 text-[10px] font-medium">COLLECTÉ</span>
                                    <p className="font-mono">{fv(df.collected_value)}</p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {equipment.location && (
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      <MapPin className="h-3 w-3 inline mr-1" />Localisation GPS
                    </Label>
                    <div className="p-3 rounded-lg bg-muted/30">
                      <p className="text-sm font-mono">{equipment.location.lat.toFixed(6)}, {equipment.location.lng.toFixed(6)}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">⚠️ La localisation ne peut pas être modifiée</p>
                    </div>
                  </div>
                )}

                {isMissingEquipment && canEdit && (
                  <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-400/30">
                    <div className="flex items-start gap-2">
                      <DatabaseZap className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-orange-700 dark:text-orange-400">Équipement manquant dans la BD</p>
                        <p className="text-[11px] text-orange-600/80 dark:text-orange-500/80 mt-0.5">
                          Modifiez les données si nécessaire, puis cliquez sur "Insérer dans la BD" pour l'ajouter. Le M-RID est modifiable avant insertion.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {filteredFields.length > 0 && (
                  <div className="space-y-4">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {isMissingEquipment ? "Données à insérer" : "Données de l'équipement"}
                      {isDivergenceAnomaly && <span className="ml-2 text-[10px] text-muted-foreground font-normal">(champs conformes)</span>}
                    </Label>
                    {filteredFields.map((field) => {
                      const value = editedData[field];
                      if (value === undefined && !isMissingEquipment) return null;
                      const originalValue = localData[field];
                      const isModified = String(value) !== String(originalValue);
                      const inputType = getFieldInputType(field);
                      const isMridField = field === "m_rid";
                      const isDisabled = !canEdit;
                      return (
                        <div key={field} className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground flex items-center justify-between gap-2">
                            <span className="flex items-center gap-1">
                              {fl(field)}
                              {isMridField && canEdit && (
                                <span className="text-[9px] text-purple-500 font-medium px-1 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30">
                                  {isMissingEquipment ? "modifiable avant insertion" : "modifiable"}
                                </span>
                              )}
                            </span>
                            {isModified && canEdit && !isDisabled && <span className="text-[10px] text-amber-600">modifié</span>}
                          </Label>
                          {isDisabled ? (
                            <div className="p-2 rounded-md bg-muted/20 text-sm font-mono">{fv(value)}</div>
                          ) : inputType === "select" ? (
                            <Select value={getSelectValue(value)} onValueChange={(v) => handleFieldChange(field, v === "true" ? 1 : 0)}>
                              <SelectTrigger className="h-9 text-sm cursor-pointer"><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="true" className="cursor-pointer">Oui / Actif</SelectItem>
                                <SelectItem value="false" className="cursor-pointer">Non / Inactif</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input type={inputType} value={String(value ?? "")}
                              onChange={(e) => handleFieldChange(field, inputType === "number" && !isMridField ? parseFloat(e.target.value) : e.target.value)}
                              className={cn("h-9 text-sm", isModified && "border-amber-500 focus-visible:ring-amber-500", isMridField && "border-purple-400 focus-visible:ring-purple-400 font-mono")}
                              placeholder="—" />
                          )}
                          {isModified && originalValue !== undefined && canEdit && !isDisabled && (
                            <p className="text-[10px] text-muted-foreground">Ancienne valeur: {fv(originalValue)}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>

          {!isDuplicateAnomaly && canEdit && (
            <SheetFooter className="px-5 py-4 border-t shrink-0 flex flex-col gap-2">
              {isMissingEquipment ? (
                <div className="flex flex-col gap-2 w-full">
                  <Button className="w-full cursor-pointer bg-orange-600 hover:bg-orange-700 text-white gap-2" onClick={handleInsert} disabled={isInserting}>
                    {isInserting ? <><Loader2 className="h-4 w-4 animate-spin" />Insertion en cours...</> : <><DatabaseZap className="h-4 w-4" />Insérer dans la BD</>}
                  </Button>
                  <Button variant="outline" className="w-full cursor-pointer" onClick={onClose} disabled={isInserting}>Annuler</Button>
                </div>
              ) : (
                <div className="flex flex-row gap-3 w-full">
                  <Button variant="outline" className="flex-1 cursor-pointer" onClick={onClose}>Annuler</Button>
                  <Button className="flex-1 cursor-pointer" onClick={handleSave} disabled={isSaving}>
                    {isSaving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Enregistrement...</> : <><Save className="h-4 w-4 mr-2" />Enregistrer</>}
                  </Button>
                </div>
              )}
            </SheetFooter>
          )}
          {!isDuplicateAnomaly && !canEdit && isMissingEquipment && (
            <SheetFooter className="px-5 py-4 border-t shrink-0">
              <Button variant="outline" className="w-full cursor-pointer" onClick={onClose}>Fermer</Button>
            </SheetFooter>
          )}
        </SheetContent>
      </Sheet>

      {isFullscreen && fullscreenPhoto && (
        <Dialog open={isFullscreen} onOpenChange={() => setIsFullscreen(false)}>
          <DialogContent className="max-w-[95vw] max-h-[95vh] w-[95vw] h-[95vh] p-0 bg-black/95 border-none">
            <button onClick={() => setIsFullscreen(false)} className="absolute top-4 right-4 z-50 p-2 rounded-full bg-black/50 text-white cursor-pointer">
              <X className="h-6 w-6" />
            </button>
            <img src={fullscreenPhoto} alt="Photo plein écran" className="w-full h-full object-contain" />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

// ─── buildEquipmentDetailFromAnomaly ─────────────────────────────────
function buildEquipmentDetailFromAnomaly(anomaly: AnomalyItem): EquipmentDetail {
  const collectedData = anomaly.collected_data || {};
  const referenceData = anomaly.reference_data || {};
  const directData = anomaly.data || {};
  let recordData: Record<string, any> = {};
  if (anomaly.type === "missing") recordData = { ...directData, ...referenceData };
  else if (anomaly.type === "new") recordData = { ...directData, ...collectedData };
  else if (anomaly.type === "divergence") recordData = { ...referenceData, ...collectedData };
  else if (anomaly.type === "duplicate") recordData = { ...collectedData };
  else recordData = { ...directData, ...collectedData };
  const photoUrl = collectedData.photo || directData.photo || referenceData.photo || recordData.photo || null;
  return {
    id: anomaly.mrid, mrid: anomaly.mrid, table: anomaly.table,
    name: anomaly.name || recordData.name || String(anomaly.mrid),
    data: { ...recordData, _anomalyType: anomaly.type },
    anomalies: [anomaly], photo: photoUrl,
    location: recordData.latitude && recordData.longitude
      ? { lat: parseFloat(String(recordData.latitude)), lng: parseFloat(String(recordData.longitude)) } : undefined,
  };
}

// ─── EquipmentRow ─────────────────────────────────────────────────────
function EquipmentRow({ anomaly, canEdit, onEditClick, onViewClick }: {
  anomaly: AnomalyItem; canEdit: boolean;
  onEditClick: (equipment: EquipmentDetail) => void;
  onViewClick?: (equipment: EquipmentDetail) => void;
}) {
  const Icon = TABLE_ICONS[anomaly.table] || Box;
  const equipment = buildEquipmentDetailFromAnomaly(anomaly);
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border/50 bg-card hover:bg-muted/20 transition-colors">
      <div className="p-1.5 rounded-md bg-muted/40 shrink-0"><Icon className="h-3.5 w-3.5 text-primary/70" /></div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{anomaly.name || anomaly.mrid}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-muted-foreground">{TABLE_LABELS[anomaly.table] || anomaly.table}</span>
          <span className="text-[10px] font-mono text-muted-foreground/60 truncate">{anomaly.mrid}</span>
        </div>
      </div>
      <AnomalyBadge type={anomaly.type} />
      <Button variant="ghost" size="sm" onClick={() => (onViewClick ?? onEditClick)(equipment)}
        className="h-7 w-7 p-0 shrink-0 cursor-pointer hover:bg-muted/40" title="Voir le détail">
        <Info className="h-3.5 w-3.5 text-muted-foreground" />
      </Button>
      {canEdit && (
        <Button variant="ghost" size="sm" onClick={() => onEditClick(equipment)}
          className="h-7 w-7 p-0 shrink-0 cursor-pointer hover:bg-primary/10" title="Éditer">
          <Pencil className="h-3.5 w-3.5 text-primary" />
        </Button>
      )}
    </div>
  );
}

// ─── SubstationDetailSheet ────────────────────────────────────────────
function SubstationDetailSheet({
  isOpen, onClose, substationAnomaly, bays, transformers, busbars,
  switchesByBay, filter, canEdit, feederId, user, updateAttributeMutation,
  refreshData, onEquipmentSave, isTreatmentActive, isTreatmentAllowed,
}: {
  isOpen: boolean; onClose: () => void; substationAnomaly: AnomalyItem;
  bays: AnomalyItem[]; transformers: AnomalyItem[]; busbars: AnomalyItem[];
  switchesByBay: Map<string, AnomalyItem[]>; filter: FilterType; canEdit: boolean;
  feederId: string; user: any; updateAttributeMutation: any; refreshData: () => void;
  onEquipmentSave: (equipment: EquipmentDetail, updatedData: Record<string, unknown>) => void;
  isTreatmentActive: boolean; isTreatmentAllowed: boolean | null;
}) {
  const [childEquipment, setChildEquipment] = useState<EquipmentDetail | null>(null);
  const [isChildSheetOpen, setIsChildSheetOpen] = useState(false);

  // ── Tree pre-save state ──────────────────────────────────────────────
  const [isSavingTree, setIsSavingTree] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [treeValidationErrors, setTreeValidationErrors] = useState<string[]>([]);
  const [showTreeValidationModal, setShowTreeValidationModal] = useState(false);
  const preSaveTreeMutation = usePreSaveTreeCheck();

  const openChildView = (equipment: EquipmentDetail) => {
    setChildEquipment(equipment);
    setIsChildSheetOpen(true);
  };
  const openChildEdit = (equipment: EquipmentDetail) => {
    setChildEquipment(equipment);
    setIsChildSheetOpen(true);
  };

  const allSwitches = bays.flatMap(b => switchesByBay.get(b.mrid) || []);
  const allChildren = [...bays, ...transformers, ...busbars, ...allSwitches];
  const conformes = [substationAnomaly, ...allChildren].filter(a => a.type === "ok").length;
  const total = 1 + allChildren.length;

  const filteredTransformers = filter === "all" ? transformers : transformers.filter(t => t.type === filter);
  const filteredBusbars = filter === "all" ? busbars : busbars.filter(b => b.type === filter);
  const filteredBays = filter === "all" ? bays : bays.filter(b => {
    if (b.type === filter) return true;
    return (switchesByBay.get(b.mrid) || []).some(s => s.type === filter);
  });

  /** Extrait le record fusionné d'un AnomalyItem */
  const getRecord = useCallback((a: AnomalyItem): Record<string, unknown> => ({
    ...(a.reference_data || {}),
    ...(a.collected_data || {}),
    ...(a.data || {}),
  }), []);

  /** Construit le payload arbre complet pour pre-save-tree/substation */
  const buildSubstationTreePayload = useCallback(
    (substationData: Record<string, unknown>): Record<string, unknown> => {
      const busbarsPayload = busbars.map(b => {
        const r = getRecord(b);
        const clean = { ...r };
        delete clean._anomalyType;
        delete clean.photo;
        return clean;
      });

      const baysPayload = bays.map(bay => {
        const bayRecord = getRecord(bay);
        const switches = (switchesByBay.get(bay.mrid) || []).map(sw => {
          const sr = getRecord(sw);
          const clean = { ...sr };
          delete clean._anomalyType;
          delete clean.photo;
          return clean;
        });
        const clean = { ...bayRecord };
        delete clean._anomalyType;
        delete clean.photo;
        return { ...clean, switches };
      });

      const transformersPayload = transformers.map(t => {
        const r = getRecord(t);
        const clean = { ...r };
        delete clean._anomalyType;
        delete clean.photo;
        return clean;
      });

      const substationClean = { ...substationData };
      delete substationClean._anomalyType;
      delete substationClean.photo;

      return {
        ...substationClean,
        bus_bars: busbarsPayload,
        bays: baysPayload,
        powertransformers: transformersPayload,
      };
    },
    [bays, busbars, transformers, switchesByBay, getRecord]
  );

  /** Extrait les messages d'erreur du rapport hiérarchique retourné par pre-save-tree */
  const extractTreeErrors = useCallback((node: any, prefix = ""): string[] => {
    if (!node) return [];
    const errors: string[] = [];

    if (Array.isArray(node.errors) && node.errors.length > 0) {
      node.errors.forEach((e: any) => {
        const msg = e.message || e.rule || e.description || JSON.stringify(e);
        errors.push(prefix ? `[${prefix}] ${msg}` : msg);
      });
    }

    if (Array.isArray(node.inter_asset)) {
      node.inter_asset.forEach((e: any) => {
        const msg = e.message || e.rule || JSON.stringify(e);
        errors.push(msg);
      });
    }

    if (node.children) {
      const { bus_bars, bays: nodeBays, powertransformers } = node.children;
      [
        { items: bus_bars, label: "Bus Bar" },
        { items: nodeBays, label: "Cellule" },
        { items: powertransformers, label: "Transformateur" },
      ].forEach(({ items, label }) => {
        if (!Array.isArray(items)) return;
        items.forEach((child: any) => {
          if (child.status !== "OK") {
            const childName = child.m_rid || `${label}`;
            (child.errors || []).forEach((e: any) => {
              const msg = e.message || e.rule || JSON.stringify(e);
              errors.push(`[${label} ${childName}] ${msg}`);
            });
            (child.switches || []).forEach((sw: any) => {
              if (sw.status !== "OK") {
                (sw.errors || []).forEach((e: any) => {
                  const msg = e.message || e.rule || JSON.stringify(e);
                  errors.push(`[Switch ${sw.m_rid || ""}] ${msg}`);
                });
              }
            });
          }
        });
      });
    }

    // fallback legacy
    if (Array.isArray(node.anomalies)) {
      node.anomalies.forEach((a: any) => {
        const msg = a.message || a.rule || a.description || JSON.stringify(a);
        errors.push(prefix ? `[${prefix}] ${msg}` : msg);
      });
    }
    (["bus_bars", "bays", "powertransformers", "switches"] as const).forEach(key => {
      if (Array.isArray(node[key])) {
        node[key].forEach((child: any, idx: number) => {
          const childName = child.name || child.m_rid || `#${idx + 1}`;
          errors.push(...extractTreeErrors(child, `${key} > ${childName}`));
        });
      }
    });

    return errors;
  }, []);

  /** Vérification rapide du poste sans passer par le formulaire d'édition */
  const handleVerifyTree = useCallback(async () => {
    setIsVerifying(true);
    const substationData = getRecord(substationAnomaly);
    const treePayload = buildSubstationTreePayload(substationData);
    try {
      const result = await preSaveTreeMutation.mutateAsync({
        parentTable: "substation",
        payload: treePayload,
      });
      if (!result.can_save) {
        const errors = extractTreeErrors(result);
        setTreeValidationErrors(
          errors.length > 0
            ? errors
            : ["Validation échouée. Vérifiez les données du poste et ses équipements."]
        );
        setShowTreeValidationModal(true);
      } else {
        toast.success("Poste valide — aucune anomalie structurelle détectée");
      }
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors de la vérification du poste");
    }
    setIsVerifying(false);
  }, [buildSubstationTreePayload, extractTreeErrors, preSaveTreeMutation, substationAnomaly, getRecord]);

  /** Handler onSave intercepté : si substation → tree-check, sinon → save direct */
  const handleChildSave = useCallback(
    async (eq: EquipmentDetail, data: Record<string, unknown>) => {
      if (eq.table !== "substation") {
        onEquipmentSave(eq, data);
        setIsChildSheetOpen(false);
        return;
      }

      // ── Poste → tree-check avant save ──────────────────────────────
      setIsSavingTree(true);
      const treePayload = buildSubstationTreePayload(data);

      try {
        const result = await preSaveTreeMutation.mutateAsync({
          parentTable: "substation",
          payload: treePayload,
        });

        if (!result.can_save) {
          const errors = extractTreeErrors(result);
          setTreeValidationErrors(
            errors.length > 0
              ? errors
              : ["Validation échouée. Vérifiez les données du poste et ses équipements."]
          );
          setShowTreeValidationModal(true);
          setIsSavingTree(false);
          return;
        }

        // ✅ Validation OK → updateAttribute champ par champ
        const sqlTableName = TABLE_NAME_MAP["substation"] ?? "substations";
        const substationRecord = getRecord(substationAnomaly);
        const changedFields = Object.keys(data).filter(k =>
          k !== "_anomalyType" && k !== "photo" &&
          k !== "bus_bars" && k !== "bays" && k !== "powertransformers" &&
          String(data[k]) !== String(substationRecord[k])
        );

        if (changedFields.length > 0) {
          await Promise.all(changedFields.map(field =>
            updateAttributeMutation.mutateAsync({
              feeder_id: feederId,
              table_name: sqlTableName,
              record_id: String(substationAnomaly.mrid),
              attribute_name: field,
              new_value: data[field],
              changed_by: user.id,
              changed_by_name: `${user.firstName} ${user.lastName}`,
              comment: "Modification poste via interface de traitement",
            })
          ));
          toast.success(`Poste enregistré — ${changedFields.length} champ(s) modifié(s)`);
        } else {
          toast.info("Aucune modification détectée sur le poste");
        }

        onEquipmentSave(eq, data);
        refreshData();
        setIsChildSheetOpen(false);
      } catch (err: any) {
        toast.error(err?.message || "Erreur lors de la validation ou de l'enregistrement du poste");
      }
      setIsSavingTree(false);
    },
    [buildSubstationTreePayload, extractTreeErrors, feederId, substationAnomaly, user,
      updateAttributeMutation, onEquipmentSave, refreshData, preSaveTreeMutation, getRecord]
  );

  const getPhotoUrl = (anomaly: AnomalyItem): string | null => {
    const photo = anomaly.collected_data?.photo || anomaly.data?.photo || anomaly.reference_data?.photo || null;
    if (!photo) return null;
    if (typeof photo === "string") {
      if (photo.startsWith("http://") || photo.startsWith("https://") || photo.startsWith("/")) return photo;
      return buildPhotoUrl(photo);
    }
    if (Array.isArray(photo) && photo.length > 0) {
      const first = photo[0];
      if (typeof first === "string") return first.startsWith("http") ? first : buildPhotoUrl(first);
      if (first?.download_url) return first.download_url;
      if (first?.filename) return buildPhotoUrl(first.filename);
    }
    return null;
  };

  return (
    <>
      {/* Modal erreurs tree */}
      <ValidationErrorModal
        isOpen={showTreeValidationModal}
        onClose={() => setShowTreeValidationModal(false)}
        errors={treeValidationErrors}
      />

      {/* Sheet enfant — onSave intercepté pour tree-check si substation */}
      <EquipmentDetailSheet
        equipment={childEquipment}
        isOpen={isChildSheetOpen}
        onClose={() => setIsChildSheetOpen(false)}
        onSave={handleChildSave}
        treatment={{}}
        onFieldChange={() => {}}
        isTreatmentActive={isTreatmentActive}
        isTreatmentAllowed={isTreatmentAllowed}
        feederId={feederId}
        user={user}
        updateAttributeMutation={updateAttributeMutation}
        refreshData={refreshData}
      />

      {/* Sheet principal poste */}
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent
          side="right"
          className="w-screen! sm:w-[60vw]! max-w-none! sm:max-w-[60vw]! flex flex-col p-0 overflow-hidden"
        >
          <SheetHeader className="px-5 py-4 border-b shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10 shrink-0">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <SheetTitle className="text-base">
                    {substationAnomaly.name || substationAnomaly.mrid}
                  </SheetTitle>
                  <AnomalyBadge type={substationAnomaly.type} />
                  {substationAnomaly.data?.type && (
                    <span className="text-[10px] text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded-full">
                      {substationAnomaly.data.type}
                    </span>
                  )}
                </div>
                <SheetDescription className="text-xs font-mono mt-0.5">
                  {substationAnomaly.mrid} · {allChildren.length} équipement{allChildren.length > 1 ? "s" : ""}
                </SheetDescription>
              </div>

              {/* ── Boutons header ───────────────────────────────────── */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Bouton vérification — toujours visible */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleVerifyTree}
                  disabled={isVerifying || isSavingTree}
                  className={cn(
                    "gap-1.5 cursor-pointer",
                    "border-blue-300 text-blue-700 hover:bg-blue-50",
                    "dark:border-blue-700 text-blue-400 dark:hover:bg-blue-950/30 hover:text-blue-300"
                  )}
                >
                  {isVerifying ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span className="hidden sm:inline">Vérification...</span>
                    </>
                  ) : (
                    <>
                      <ShieldAlert className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Vérifier le poste</span>
                    </>
                  )}
                </Button>

                {/* Bouton édition — seulement si canEdit */}
                {canEdit && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openChildEdit(buildEquipmentDetailFromAnomaly(substationAnomaly))}
                    disabled={isSavingTree || isVerifying}
                    className="gap-1.5 cursor-pointer"
                  >
                    {isSavingTree ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span className="hidden sm:inline">Validation...</span>
                      </>
                    ) : (
                      <>
                        <Pencil className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Éditer le poste</span>
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 mt-2">
              <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                  style={{ width: total > 0 ? `${(conformes / total) * 100}%` : "0%" }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                {conformes}/{total} conformes
              </span>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
            {/* Poste lui-même */}
            {(filter === "all" || substationAnomaly.type === filter) && (
              <section className="space-y-2">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">Poste</h3>
                  <div className="h-px flex-1 bg-border/40" />
                </div>
                {getPhotoUrl(substationAnomaly) && (
                  <div className="rounded-lg overflow-hidden border border-border">
                    <PhotoThumb
                      src={getPhotoUrl(substationAnomaly)!}
                      alt={substationAnomaly.name || substationAnomaly.mrid}
                    />
                  </div>
                )}
                <EquipmentRow
                  anomaly={substationAnomaly}
                  canEdit={canEdit}
                  onEditClick={openChildEdit}
                  onViewClick={openChildView}
                />
              </section>
            )}

            {/* Transformateurs */}
            {filteredTransformers.length > 0 && (
              <section className="space-y-2">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-500" />
                  <h3 className="text-sm font-semibold">Transformateurs</h3>
                  <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                    {filteredTransformers.length}
                  </Badge>
                  <div className="h-px flex-1 bg-border/40" />
                </div>
                <div className="space-y-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredTransformers.map(t => (
                    <div key={t.id} className="space-y-1.5">
                      {getPhotoUrl(t) && (
                        <div className="rounded-lg overflow-hidden border border-border">
                          <PhotoThumb src={getPhotoUrl(t)!} alt={t.name || t.mrid} />
                        </div>
                      )}
                      <EquipmentRow
                        anomaly={t}
                        canEdit={canEdit}
                        onEditClick={openChildEdit}
                        onViewClick={openChildView}
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Bus Bars */}
            {filteredBusbars.length > 0 && (
              <section className="space-y-2">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-blue-500" />
                  <h3 className="text-sm font-semibold">Jeux de barres</h3>
                  <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                    {filteredBusbars.length}
                  </Badge>
                  <div className="h-px flex-1 bg-border/40" />
                </div>
                <div className="space-y-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredBusbars.map(b => (
                    <div key={b.id} className="space-y-1.5">
                      {getPhotoUrl(b) && (
                        <div className="rounded-lg overflow-hidden border border-border">
                          <PhotoThumb src={getPhotoUrl(b)!} alt={b.name || b.mrid} />
                        </div>
                      )}
                      <EquipmentRow
                        anomaly={b}
                        canEdit={canEdit}
                        onEditClick={openChildEdit}
                        onViewClick={openChildView}
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Cellules + Switchs */}
            {filteredBays.length > 0 && (
              <section className="space-y-2">
                <div className="flex items-center gap-2">
                  <Box className="h-4 w-4 text-violet-500" />
                  <h3 className="text-sm font-semibold">Cellules</h3>
                  <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                    {filteredBays.length}
                  </Badge>
                  <div className="h-px flex-1 bg-border/40" />
                </div>
                <div className="space-y-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredBays.map(bay => {
                    const baySwitches = switchesByBay.get(bay.mrid) || [];
                    const filteredSwitches =
                      filter === "all" ? baySwitches : baySwitches.filter(s => s.type === filter);
                    return (
                      <div key={bay.id} className="space-y-1.5">
                        {getPhotoUrl(bay) && (
                          <div className="rounded-lg overflow-hidden border border-border">
                            <PhotoThumb src={getPhotoUrl(bay)!} alt={bay.name || bay.mrid} />
                          </div>
                        )}
                        <EquipmentRow
                          anomaly={bay}
                          canEdit={canEdit}
                          onEditClick={openChildEdit}
                          onViewClick={openChildView}
                        />
                        {filteredSwitches.length > 0 && (
                          <div className="ml-5 space-y-2 border-l-2 border-border/40 pl-3">
                            {filteredSwitches.map(sw => (
                              <div key={sw.id} className="space-y-1.5">
                                {getPhotoUrl(sw) && (
                                  <div className="rounded-lg overflow-hidden border border-border">
                                    <PhotoThumb src={getPhotoUrl(sw)!} alt={sw.name || sw.mrid} />
                                  </div>
                                )}
                                <EquipmentRow
                                  anomaly={sw}
                                  canEdit={canEdit}
                                  onEditClick={openChildEdit}
                                  onViewClick={openChildView}
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {filteredBays.length === 0 &&
              filteredTransformers.length === 0 &&
              filteredBusbars.length === 0 &&
              filter !== "all" &&
              substationAnomaly.type !== filter && (
                <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
                  <Filter className="h-8 w-8 opacity-30" />
                  <p className="text-sm">Aucun équipement pour ce filtre</p>
                </div>
              )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

// ─── SubstationsRootGroup ─────────────────────────────────────────────
function SubstationsRootGroup({ substationsList, switchesByBay, filter, treatment, onFieldChange, onMarkTreated, onEquipmentClick, isClickable, canProcess, feederId, user, updateAttributeMutation, refreshData, onEquipmentSave, isTreatmentActive, isTreatmentAllowed }: {
  substationsList: { substation: AnomalyItem; bays: AnomalyItem[]; transformers: AnomalyItem[]; busbars: AnomalyItem[]; }[];
  switchesByBay: Map<string, AnomalyItem[]>; filter: FilterType; treatment: TreatmentState;
  onFieldChange: (id: string, field: string, val: string) => void;
  onMarkTreated: (id: string) => void; onEquipmentClick: (equipment: EquipmentDetail) => void;
  isClickable: boolean; canProcess: boolean;
  feederId: string; user: any; updateAttributeMutation: any; refreshData: () => void;
  onEquipmentSave: (equipment: EquipmentDetail, updatedData: Record<string, unknown>) => void;
  isTreatmentActive: boolean; isTreatmentAllowed: boolean | null;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedSubstationIndex, setSelectedSubstationIndex] = useState<number | null>(null);

  const sortedSubstationsList = useMemo(() =>
    [...substationsList].sort((a, b) => (a.substation.name || "").localeCompare(b.substation.name || "")),
    [substationsList]
  );

  const visibleSubstations = useMemo(() => {
    if (filter === "all") return sortedSubstationsList;
    return sortedSubstationsList.filter(item => {
      if (item.substation.type === filter) return true;
      const allSwitches = item.bays.flatMap(b => switchesByBay.get(b.mrid) || []);
      const allChildren = [...item.bays, ...item.transformers, ...item.busbars, ...allSwitches];
      return allChildren.some(c => c.type === filter);
    });
  }, [sortedSubstationsList, filter, switchesByBay]);

  const substationsWithIssues = substationsList.filter(s => {
    const allSwitches = s.bays.flatMap(b => switchesByBay.get(b.mrid) || []);
    const all = [s.substation, ...s.bays, ...s.transformers, ...s.busbars, ...allSwitches];
    return all.some(a => a.type !== "ok");
  }).length;

  const allItems = substationsList.flatMap(s => {
    const allSwitches = s.bays.flatMap(b => switchesByBay.get(b.mrid) || []);
    return [s.substation, ...s.bays, ...s.transformers, ...s.busbars, ...allSwitches];
  });
  const dominantCfg = getDominantAnomalyConfig(allItems);

  if (substationsList.length === 0) return null;

  const selectedItem = selectedSubstationIndex !== null ? sortedSubstationsList[selectedSubstationIndex] : null;

  return (
    <>
      {selectedItem && (
        <SubstationDetailSheet
          isOpen={selectedSubstationIndex !== null}
          onClose={() => setSelectedSubstationIndex(null)}
          substationAnomaly={selectedItem.substation}
          bays={selectedItem.bays}
          transformers={selectedItem.transformers}
          busbars={selectedItem.busbars}
          switchesByBay={switchesByBay}
          filter={filter}
          canEdit={canProcess}
          feederId={feederId}
          user={user}
          updateAttributeMutation={updateAttributeMutation}
          refreshData={refreshData}
          onEquipmentSave={onEquipmentSave}
          isTreatmentActive={isTreatmentActive}
          isTreatmentAllowed={isTreatmentAllowed}
        />
      )}

      <div className="rounded-xl border border-border/60 overflow-hidden">
        <button onClick={() => setIsOpen(!isOpen)}
          className={cn("flex w-full items-center gap-2 px-4 py-2.5 hover:bg-muted/40 transition-colors text-left cursor-pointer",
            dominantCfg.type !== "ok" ? dominantCfg.activeBg : "bg-muted/20")}>
          {isOpen ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
          <Building2 className={cn("h-4 w-4 shrink-0", dominantCfg.type !== "ok" ? dominantCfg.color : "text-primary")} />
          <span className="font-semibold text-sm flex-1">Postes (Substations)</span>
          <div className="flex items-center gap-2">
            {dominantCfg.type !== "ok" && <AnomalyBadge type={dominantCfg.type as AnomalyType} />}
            {substationsWithIssues > 0 && (
              <span className={cn("text-[10px]", dominantCfg.color)}>{substationsWithIssues} avec anomalie{substationsWithIssues > 1 ? "s" : ""}</span>
            )}
            <span className="text-[10px] text-muted-foreground">{visibleSubstations.length}/{substationsList.length} poste{substationsList.length > 1 ? "s" : ""}</span>
          </div>
        </button>

        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: "easeInOut" }} className="overflow-hidden">
              <div className="border-t border-border/40 divide-y divide-border/20">
                {visibleSubstations.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-muted-foreground">Aucun poste pour ce filtre</div>
                ) : (
                  visibleSubstations.map((item) => {
                    const allSwitches = item.bays.flatMap(b => switchesByBay.get(b.mrid) || []);
                    const allChildren = [...item.bays, ...item.transformers, ...item.busbars, ...allSwitches];
                    const dominantChildCfg = getDominantAnomalyConfig([item.substation, ...allChildren]);
                    const childCount = allChildren.length;
                    const nonConforme = [item.substation, ...allChildren].filter(a => a.type !== "ok").length;
                    const sortedIdx = sortedSubstationsList.findIndex(s => s.substation.id === item.substation.id);

                    return (
                      <button key={item.substation.id} onClick={() => setSelectedSubstationIndex(sortedIdx)}
                        className={cn("w-full flex items-center gap-3 px-4 py-3 text-left transition-colors cursor-pointer group",
                          "hover:bg-muted/30", dominantChildCfg.type !== "ok" && dominantChildCfg.activeBg + "/50")}>
                        <div className={cn("p-1.5 rounded-lg shrink-0", dominantChildCfg.type !== "ok" ? dominantChildCfg.bg : "bg-muted/40")}>
                          <Building2 className={cn("h-3.5 w-3.5", dominantChildCfg.type !== "ok" ? dominantChildCfg.color : "text-primary/70")} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">{item.substation.name || item.substation.mrid}</span>
                            {item.substation.data?.type && (
                              <span className="text-[10px] text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded-full shrink-0 hidden sm:inline">
                                {item.substation.data.type}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] font-mono text-muted-foreground/70 truncate">{item.substation.mrid}</span>
                            <span className="text-[10px] text-muted-foreground/50">·</span>
                            <span className="text-[10px] text-muted-foreground">{childCount} équipement{childCount > 1 ? "s" : ""}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {nonConforme > 0 && <span className={cn("text-[10px] font-medium", dominantChildCfg.color)}>{nonConforme} n.c.</span>}
                          <AnomalyBadge type={dominantChildCfg.type as AnomalyType} />
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

// ─── AnomalyCard ──────────────────────────────────────────────────────
function AnomalyCard({ anomaly, treatment, onFieldChange, onMarkTreated, onEquipmentClick, isClickable, canProcess }: {
  anomaly: AnomalyItem; treatment: TreatmentState;
  onFieldChange: (id: string, field: string, val: string) => void;
  onMarkTreated: (id: string) => void;
  onEquipmentClick?: (equipment: EquipmentDetail) => void;
  isClickable: boolean; canProcess: boolean;
}) {
  const t = treatment[anomaly.id];
  const isTreated = t?.treated ?? false;
  const Icon = TABLE_ICONS[anomaly.table] || Box;
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenPhoto, setFullscreenPhoto] = useState<string | null>(null);
  const equipmentDetail: EquipmentDetail | null = useMemo(() => buildEquipmentDetailFromAnomaly(anomaly), [anomaly]);

  const getPhotoUrl = (photo: any) => {
    if (!photo) return null;
    if (typeof photo === 'string') {
      if (photo.startsWith('http://') || photo.startsWith('https://') || photo.startsWith('/')) return photo;
      return buildPhotoUrl(photo);
    }
    if (Array.isArray(photo) && photo.length > 0) {
      const first = photo[0];
      if (typeof first === 'string') return first.startsWith('http') ? first : buildPhotoUrl(first);
      if (first?.download_url) return first.download_url;
      if (first?.filename) return buildPhotoUrl(first.filename);
    }
    return null;
  };
  const displayPhotoUrl = getPhotoUrl(equipmentDetail?.photo);

  const displayFields = useMemo(() => {
    const data = equipmentDetail?.data || {};
    if (anomaly.type === "divergence" && anomaly.divergent_fields)
      return anomaly.divergent_fields.slice(0, 6).map(df => ({ label: fl(df.field), value: fv(df.collected_value), field: df.field }));
    if (anomaly.type === "new" || anomaly.type === "missing") {
      const imp = ["name", "type", "voltage", "regime", "exploitation", "zone_type", "section", "nature_conducteur", "phase"];
      const selected = imp.filter(f => data[f] !== undefined).slice(0, 9);
      if (selected.length < 6) selected.push(...Object.keys(data).filter(f => !imp.includes(f) && f !== "_anomalyType" && f !== "photo").slice(0, 6 - selected.length));
      return selected.map(f => ({ label: fl(f), value: fv(data[f]), field: f }));
    }
    if (anomaly.type === "duplicate")
      return [
        { label: "Nom", value: anomaly.name || "—", field: "name" },
        { label: "M-RID", value: anomaly.mrid, field: "m_rid" },
        { label: "Occurrences", value: `${anomaly.duplicate_occurrences?.length || 0}`, field: "count" },
      ];
    return Object.keys(data).filter(k => k !== "m_rid" && k !== "_anomalyType" && k !== "photo").slice(0, 6).map(f => ({ label: fl(f), value: fv(data[f]), field: f }));
  }, [equipmentDetail, anomaly]);

  const handleCardClick = () => {
    if (isClickable && equipmentDetail) onEquipmentClick?.(equipmentDetail);
    else toast.info("Le traitement n'a pas encore commencé pour ce départ");
  };

  return (
    <>
      <div className={cn("rounded-xl border transition-all",
        isTreated ? "border-emerald-500/30 bg-emerald-500/5" : "border-border bg-card",
        isClickable ? "cursor-pointer hover:shadow-md" : "cursor-pointer")} onClick={handleCardClick}>
        <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 border-b border-border/40">
          <span className="text-xs font-semibold truncate flex-1">{TABLE_LABELS[anomaly.table] || anomaly.table} — {anomaly.name || anomaly.mrid}</span>
          <span className="text-[10px] font-mono text-muted-foreground hidden sm:inline">{anomaly.mrid}</span>
          <AnomalyBadge type={anomaly.type} />
          {isTreated && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600">
              <CheckCircle2 className="h-2.5 w-2.5" />Traité
            </span>
          )}
        </div>
        <div className="p-3 flex gap-3">
          {displayPhotoUrl ? (
            <div className="w-32 sm:w-48 h-40 sm:h-64 rounded-lg overflow-hidden bg-muted/20 shrink-0 border border-border">
              <img src={displayPhotoUrl} alt={equipmentDetail?.name || "Photo"}
                className="w-full h-full object-cover cursor-pointer"
                onClick={(e) => { e.stopPropagation(); setFullscreenPhoto(displayPhotoUrl); setIsFullscreen(true); }}
                onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/400x200?text=Photo+indisponible'; }} />
            </div>
          ) : (
            <div className="w-12 h-12 flex items-center justify-center bg-muted/30"><Icon className="h-6 w-6 text-muted-foreground/50" /></div>
          )}
          <div className="flex-1 min-w-0">
            {equipmentDetail?.location && (
              <div className="mb-2 text-xs text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="font-mono truncate">{equipmentDetail.location.lat.toFixed(5)}, {equipmentDetail.location.lng.toFixed(5)}</span>
              </div>
            )}
            {anomaly.type === "divergence" && anomaly.divergent_fields ? (
              <div className="space-y-2">
                {anomaly.divergent_fields.slice(0, 3).map((df: any, idx: number) => (
                  <div key={idx} className="grid grid-cols-1 sm:grid-cols-2 gap-1 sm:gap-2 text-xs">
                    <div className="p-1.5 rounded bg-red-50 dark:bg-red-950/20">
                      <span className="text-red-600 text-[10px] font-medium">{fl(df.field)} - REF</span>
                      <p className="font-mono truncate">{fv(df.reference_value)}</p>
                    </div>
                    <div className="p-1.5 rounded bg-amber-50 dark:bg-amber-950/20">
                      <span className="text-amber-600 text-[10px] font-medium">{fl(df.field)} - COL</span>
                      <p className="font-mono truncate">{fv(df.collected_value)}</p>
                    </div>
                  </div>
                ))}
                {anomaly.divergent_fields.length > 3 && (
                  <p className="text-[10px] text-muted-foreground text-center">+ {anomaly.divergent_fields.length - 3} autres champs</p>
                )}
              </div>
            ) : anomaly.type === "duplicate" && anomaly.duplicate_occurrences ? (
              <div className="space-y-1">
                <p className="text-xs font-medium text-purple-600">⚠️ {anomaly.duplicate_occurrences.length} occurrences trouvées</p>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {anomaly.duplicate_occurrences.slice(0, 3).map((occ: any, idx: number) => (
                    <div key={idx} className="text-[10px] font-mono bg-muted/30 p-1 rounded truncate">{occ.m_rid} - {occ.name}</div>
                  ))}
                  {anomaly.duplicate_occurrences.length > 3 && <p className="text-[9px] text-muted-foreground">+{anomaly.duplicate_occurrences.length - 3} autres</p>}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                {displayFields.map((field) => (
                  <div key={field.field} className="truncate">
                    <span className="text-muted-foreground">{field.label}:</span>
                    <p className="font-mono truncate">{field.value}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      {isFullscreen && fullscreenPhoto && (
        <Dialog open={isFullscreen} onOpenChange={() => setIsFullscreen(false)}>
          <DialogContent className="max-w-[95vw] max-h-[95vh] w-[95vw] h-[95vh] p-0 bg-black/95 border-none">
            <button onClick={() => setIsFullscreen(false)} className="absolute top-4 right-4 z-50 p-2 rounded-full bg-black/50 text-white cursor-pointer"><X className="h-6 w-6" /></button>
            <img src={fullscreenPhoto} alt="Photo plein écran" className="w-full h-full object-contain" />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

// ─── WireRootGroup ─────────────────────────────────────────────────────
function WireRootGroup({ wires, filter, treatment, onFieldChange, onMarkTreated, onEquipmentClick, isClickable, canProcess }: {
  wires: AnomalyItem[]; filter: FilterType; treatment: TreatmentState;
  onFieldChange: (id: string, field: string, val: string) => void;
  onMarkTreated: (id: string) => void; onEquipmentClick?: (equipment: EquipmentDetail) => void;
  isClickable: boolean; canProcess: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const filteredWires = useMemo(() => {
    const filtered = filter === "all" ? wires : wires.filter(w => w.type === filter);
    return [...filtered].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [wires, filter]);
  const dominantCfg = getDominantAnomalyConfig(wires);
  if (filteredWires.length === 0) return null;
  return (
    <div className="rounded-xl border border-border/60 overflow-hidden">
      <button onClick={() => setIsOpen(!isOpen)}
        className={cn("flex w-full items-center gap-2 px-4 py-2.5 hover:bg-muted/40 transition-colors text-left cursor-pointer",
          dominantCfg.type !== "ok" ? dominantCfg.activeBg : "bg-muted/20")}>
        {isOpen ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
        <Cable className={cn("h-4 w-4 shrink-0", dominantCfg.type !== "ok" ? dominantCfg.color : "text-primary")} />
        <span className="font-semibold text-sm flex-1">Lignes (Wire)</span>
        <div className="flex items-center gap-2">
          {dominantCfg.type !== "ok" && <AnomalyBadge type={dominantCfg.type as AnomalyType} />}
          <span className="text-[10px] text-muted-foreground">{filteredWires.length} câble{filteredWires.length > 1 ? "s" : ""}</span>
        </div>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: "easeInOut" }} className="overflow-hidden">
            <div className="p-3 space-y-2 border-t border-border/40">
              {filteredWires.map(wire => (
                <AnomalyCard key={wire.id} anomaly={wire} treatment={treatment} onFieldChange={onFieldChange}
                  onMarkTreated={onMarkTreated} onEquipmentClick={onEquipmentClick} isClickable={isClickable} canProcess={canProcess} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── FeederRootGroup ───────────────────────────────────────────────────
function FeederRootGroup({ feeders, orphans, filter, treatment, onFieldChange, onMarkTreated, onEquipmentClick, isClickable, canProcess }: {
  feeders: AnomalyItem[]; orphans: AnomalyItem[]; filter: FilterType; treatment: TreatmentState;
  onFieldChange: (id: string, field: string, val: string) => void;
  onMarkTreated: (id: string) => void; onEquipmentClick?: (equipment: EquipmentDetail) => void;
  isClickable: boolean; canProcess: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const filteredFeeders = useMemo(() => {
    const filtered = filter === "all" ? feeders : feeders.filter(f => f.type === filter);
    return [...filtered].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [feeders, filter]);
  const filteredOrphans = useMemo(() => {
    const filtered = filter === "all" ? orphans : orphans.filter(o => o.type === filter);
    return [...filtered].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [orphans, filter]);
  const allItems = [...feeders, ...orphans];
  const dominantCfg = getDominantAnomalyConfig(allItems);
  if (filteredFeeders.length === 0 && filteredOrphans.length === 0) return null;
  const orphansByTable = filteredOrphans.reduce((acc, o) => {
    if (!acc[o.table]) acc[o.table] = [];
    acc[o.table].push(o);
    return acc;
  }, {} as Record<string, AnomalyItem[]>);
  return (
    <div className="rounded-xl border border-border/60 overflow-hidden">
      <button onClick={() => setIsOpen(!isOpen)}
        className={cn("flex w-full items-center gap-2 px-4 py-2.5 hover:bg-muted/40 transition-colors text-left cursor-pointer",
          dominantCfg.type !== "ok" ? dominantCfg.activeBg : "bg-muted/20")}>
        {isOpen ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
        <Zap className={cn("h-4 w-4 shrink-0", dominantCfg.type !== "ok" ? dominantCfg.color : "text-primary")} />
        <span className="font-semibold text-sm flex-1">Départ</span>
        <div className="flex items-center gap-2">
          {dominantCfg.type !== "ok" && <AnomalyBadge type={dominantCfg.type as AnomalyType} />}
          {filteredFeeders.filter(f => f.type !== "ok").length > 0 && (
            <span className={cn("text-[10px]", dominantCfg.color)}>{filteredFeeders.filter(f => f.type !== "ok").length} anomalie(s)</span>
          )}
          {filteredOrphans.length > 0 && <span className="text-[10px] text-muted-foreground">{filteredOrphans.length} orphelin(s)</span>}
        </div>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: "easeInOut" }} className="overflow-hidden">
            <div className="p-3 space-y-3 border-t border-border/40">
              {filteredFeeders.length > 0 && (
                <div className="space-y-2">
                  {filteredFeeders.map(feeder => (
                    <AnomalyCard key={feeder.id} anomaly={feeder} treatment={treatment} onFieldChange={onFieldChange}
                      onMarkTreated={onMarkTreated} onEquipmentClick={onEquipmentClick} isClickable={isClickable} canProcess={canProcess} />
                  ))}
                </div>
              )}
              {Object.entries(orphansByTable).map(([table, items]) => (
                <div key={table} className="space-y-2">
                  <div className="flex items-center gap-2 px-1">
                    <div className="h-px flex-1 bg-border/40" />
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-2">
                      {TABLE_LABELS[table] || table} sans parent ({items.length})
                    </span>
                    <div className="h-px flex-1 bg-border/40" />
                  </div>
                  {items.map(orphan => (
                    <AnomalyCard key={orphan.id} anomaly={orphan} treatment={treatment} onFieldChange={onFieldChange}
                      onMarkTreated={onMarkTreated} onEquipmentClick={onEquipmentClick} isClickable={isClickable} canProcess={canProcess} />
                  ))}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Conversion pour la carte ─────────────────────────────────────────
const convertToMapEquipments = (comparisonResult: FeederComparisonResult | null, currentFilter: FilterType): Record<string, unknown>[] => {
  if (!comparisonResult) return [];
  const mapEquipments: Record<string, unknown>[] = [];
  const tables: TableName[] = ["substation", "wire"];
  const shouldInclude = (type: string) => {
    if (currentFilter === "all") return true;
    if (currentFilter === "ok") return type === "ok";
    return type === currentFilter;
  };
  for (const table of tables) {
    const tableResult = comparisonResult.tables?.[table];
    if (!tableResult) continue;
    for (const ok of tableResult.ok ?? [])
      if (ok.data?.latitude && ok.data?.longitude && shouldInclude("ok"))
        mapEquipments.push({ ...ok.data, m_rid: ok.mrid, table, _anomalyType: "ok" });
    for (const missing of tableResult.missing ?? [])
      if (missing.full_record?.latitude && missing.full_record?.longitude && shouldInclude("missing"))
        mapEquipments.push({ ...missing.full_record, m_rid: missing.m_rid, name: missing.name, table, _anomalyType: "missing" });
    for (const newItem of tableResult.new ?? [])
      if (newItem.full_record?.latitude && newItem.full_record?.longitude && shouldInclude("new"))
        mapEquipments.push({ ...newItem.full_record, m_rid: newItem.m_rid, name: newItem.name, table, _anomalyType: "new" });
    for (const div of tableResult.divergences ?? [])
      if (div.collected_data?.latitude && div.collected_data?.longitude && shouldInclude("divergence"))
        mapEquipments.push({ ...div.collected_data, m_rid: div.mrid, table, _anomalyType: "divergence" });
    for (const dup of tableResult.duplicates ?? [])
      for (const occ of dup.occurrences ?? [])
        if (occ.full_record?.latitude && occ.full_record?.longitude && shouldInclude("duplicate"))
          mapEquipments.push({ ...occ.full_record, m_rid: occ.m_rid, name: occ.name, table, _anomalyType: "duplicate" });
  }
  return mapEquipments;
};

// ─── TimerDisplay ─────────────────────────────────────────────────────
function TimerDisplay({ startTime }: { startTime: number | null }) {
  const [elapsed, setElapsed] = useState<string>("00:00:00");
  useEffect(() => {
    if (!startTime) return;
    const interval = setInterval(() => {
      const diff = Date.now() - startTime;
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setElapsed(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);
  if (!startTime) return null;
  return (
    <div className="flex items-center justify-center gap-2 px-3 py-1 rounded-lg bg-primary/10 border border-primary/20 w-full">
      <Timer className="h-4 w-4 text-primary" />
      <span className="text-sm font-medium text-muted-foreground">Temps écoulé:</span>
      <span className="text-base font-bold text-primary font-mono tracking-wide">{elapsed}</span>
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────
export default function FeederProcessingPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const feederId = params?.feederId as string;
  const feederNameFromUrl = searchParams?.get("name") || feederId;
  const { user } = useAuth();

  const { result: comparisonResult, summary, loading: comparisonLoading, error: comparisonError, refresh } = useFeederComparison(feederId);
  const { data: treatmentStatus, refetch: refetchStatus } = useTreatmentStatus(feederId);
  const { data: usersData, refetch: refetchUsers } = useAllUsers();

  const assignMutation = useAssignTreatment();
  const startMutation = useStartTreatment();
  const setPendingMutation = useSetPending();
  const setCollectingMutation = useSetCollecting();
  const setPendingValidationMutation = useSetPendingValidation();
  const validateMutation = useValidateTreatment();
  const rejectMutation = useRejectTreatment();
  const updateAttributeMutation = useUpdateAttribute();

  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [treatment, setTreatment] = useState<TreatmentState>({});
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentDetail | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [searchSelectedSubstation, setSearchSelectedSubstation] = useState<AnomalyItem | null>(null);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [isReassignDialogOpen, setIsReassignDialogOpen] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [recentEdits, setRecentEdits] = useState<RecentEdit[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  const feederStatus = treatmentStatus?.status || "collecting";
  const assignedAgentId = treatmentStatus?.assigned_to;
  const assignedAgentName = treatmentStatus?.assigned_to_name;
  const treatmentStartTimeBackend = treatmentStatus?.started_at ? new Date(treatmentStatus.started_at).getTime() : null;
  const durationSeconds = treatmentStatus?.duration_seconds;

  const isTreatmentActive = feederStatus === "in_progress";
  const isTreatmentAllowed = user?.id === assignedAgentId;
  const feederName = comparisonResult?.feeder_name || feederNameFromUrl;
  const processingAgents = useMemo(() => usersData?.data || [], [usersData]);
  const mapEquipments = useMemo(() => convertToMapEquipments(comparisonResult, activeFilter), [comparisonResult, activeFilter]);

  const loadRecentEditsFromStorage = useCallback(() => {
    if (typeof window !== 'undefined' && feederId) {
      const stored = localStorage.getItem(`recent_edits_${feederId}`);
      if (stored) { try { setRecentEdits(JSON.parse(stored)); } catch { } }
    }
  }, [feederId]);

  const saveRecentEditsToStorage = useCallback((edits: RecentEdit[]) => {
    if (typeof window !== 'undefined' && feederId)
      localStorage.setItem(`recent_edits_${feederId}`, JSON.stringify(edits));
  }, [feederId]);

  useEffect(() => { loadRecentEditsFromStorage(); }, [loadRecentEditsFromStorage]);

  const refreshAllData = useCallback(async () => {
    setIsRefreshing(true);
    try { await Promise.all([refresh(), refetchStatus(), refetchUsers()]); }
    finally { setTimeout(() => setIsRefreshing(false), 600); }
  }, [refresh, refetchStatus, refetchUsers]);

  useEffect(() => {
    if (feederId) { setTreatment({}); setRecentEdits([]); refetchUsers(); refetchStatus(); }
  }, [feederId, refetchUsers, refetchStatus]);

  const allAnomalies: AnomalyItem[] = useMemo(() => {
    if (!comparisonResult) return [];
    const anomalies: AnomalyItem[] = [];
    const tables: TableName[] = ["feeder", "substation", "bus_bar", "bay", "switch", "powertransformer", "wire"];
    for (const table of tables) {
      const tableResult = comparisonResult.tables?.[table];
      if (!tableResult) continue;
      for (const ok of tableResult.ok ?? [])
        anomalies.push({ id: `${table}-ok-${ok.mrid}`, type: "ok", table, mrid: ok.mrid, name: ok.data?.name || ok.mrid, data: ok.data });
      for (const missing of tableResult.missing ?? [])
        anomalies.push({ id: `${table}-miss-${missing.m_rid}`, type: "missing", table, mrid: missing.m_rid, name: missing.name, data: missing.full_record });
      for (const div of tableResult.divergences ?? [])
        anomalies.push({ id: `${table}-div-${div.mrid}`, type: "divergence", table, mrid: div.mrid, name: div.name || div.reference_data?.name || div.collected_data?.name || div.mrid, reference_data: div.reference_data, collected_data: div.collected_data, divergent_fields: div.divergent_fields });
      for (const newItem of tableResult.new ?? [])
        anomalies.push({ id: `${table}-new-${newItem.m_rid}`, type: "new", table, mrid: newItem.m_rid, name: newItem.name, data: newItem.full_record });
      for (const dup of tableResult.duplicates ?? [])
        for (const occ of dup.occurrences ?? [])
          anomalies.push({ id: `${table}-dup-${occ.m_rid}`, type: "duplicate", table, mrid: occ.m_rid, name: occ.name, duplicate_occurrences: dup.occurrences, collected_data: occ.full_record });
    }
    return anomalies;
  }, [comparisonResult]);

  const { substationsList, switchesByBay, orphans } = useMemo(() => {
    const substations = allAnomalies.filter(a => a.table === "substation");
    const bays = allAnomalies.filter(a => a.table === "bay");
    const transformers = allAnomalies.filter(a => a.table === "powertransformer");
    const busbars = allAnomalies.filter(a => a.table === "bus_bar");
    const switches = allAnomalies.filter(a => a.table === "switch");

    const substationMap = new Map<string, { substation: AnomalyItem; bays: AnomalyItem[]; transformers: AnomalyItem[]; busbars: AnomalyItem[]; }>();
    for (const substation of substations)
      substationMap.set(substation.mrid, { substation, bays: [], transformers: [], busbars: [] });

    const getSubstationId = (anomaly: AnomalyItem): string | null =>
      anomaly.reference_data?.substation_id || anomaly.reference_data?.substations_m_rid
      || anomaly.collected_data?.substation_id || anomaly.collected_data?.substations_m_rid
      || anomaly.data?.substation_id || anomaly.data?.substations_m_rid || null;

    const attachedBayIds = new Set<string>();
    const attachedTransformerIds = new Set<string>();
    const attachedBusbarIds = new Set<string>();

    for (const bay of bays) {
      const substationId = getSubstationId(bay);
      if (substationId && substationMap.has(substationId)) {
        substationMap.get(substationId)!.bays.push(bay);
        attachedBayIds.add(bay.mrid);
      }
    }
    for (const transformer of transformers) {
      const substationId = getSubstationId(transformer);
      if (substationId && substationMap.has(substationId)) {
        substationMap.get(substationId)!.transformers.push(transformer);
        attachedTransformerIds.add(transformer.mrid);
      }
    }
    for (const busbar of busbars) {
      const substationId = getSubstationId(busbar);
      if (substationId && substationMap.has(substationId)) {
        substationMap.get(substationId)!.busbars.push(busbar);
        attachedBusbarIds.add(busbar.mrid);
      }
    }

    const switchesByBayMap = new Map<string, AnomalyItem[]>();
    const attachedSwitchIds = new Set<string>();
    for (const switchAnomaly of switches) {
      let bayId = null;
      if (switchAnomaly.reference_data?.bay_mrid) bayId = switchAnomaly.reference_data.bay_mrid;
      else if (switchAnomaly.collected_data?.bay_id) bayId = switchAnomaly.collected_data.bay_id;
      else if (switchAnomaly.data?.bay_id) bayId = switchAnomaly.data.bay_id;
      else if (switchAnomaly.data?.bay_mrid) bayId = switchAnomaly.data.bay_mrid;
      if (bayId) {
        if (!switchesByBayMap.has(bayId)) switchesByBayMap.set(bayId, []);
        switchesByBayMap.get(bayId)!.push(switchAnomaly);
        attachedSwitchIds.add(switchAnomaly.mrid);
      }
    }

    const orphansList: AnomalyItem[] = [
      ...bays.filter(b => !attachedBayIds.has(b.mrid)),
      ...transformers.filter(t => !attachedTransformerIds.has(t.mrid)),
      ...busbars.filter(b => !attachedBusbarIds.has(b.mrid)),
      ...switches.filter(s => !attachedSwitchIds.has(s.mrid)),
    ];

    return { substationsList: Array.from(substationMap.values()), switchesByBay: switchesByBayMap, orphans: orphansList };
  }, [allAnomalies]);

  const feeders = useMemo(() => allAnomalies.filter(a => a.table === "feeder"), [allAnomalies]);
  const wires = useMemo(() => allAnomalies.filter(a => a.table === "wire"), [allAnomalies]);

  const counts = useMemo(() => {
    if (summary) return { all: summary.total, ok: summary.ok, duplicate: summary.duplicate, divergence: summary.divergence, new: summary.new, missing: summary.missing, complex: summary.complex };
    return {
      all: allAnomalies.length,
      ok: allAnomalies.filter(a => a.type === "ok").length,
      duplicate: allAnomalies.filter(a => a.type === "duplicate").length,
      divergence: allAnomalies.filter(a => a.type === "divergence").length,
      new: allAnomalies.filter(a => a.type === "new").length,
      missing: allAnomalies.filter(a => a.type === "missing").length,
      complex: allAnomalies.filter(a => a.type === "complex").length,
    };
  }, [summary, allAnomalies]);

  const handleCompleteCollection = () => {
    if (!user) { toast.error("Utilisateur non connecté"); return; }
    setPendingMutation.mutate({ feeder_id: feederId, completed_by: user.id, completed_by_name: `${user.firstName} ${user.lastName}` }, {
      onSuccess: () => { toast.success("Collecte terminée. En attente de traitement."); refetchStatus(); refreshAllData(); },
      onError: (error: Error) => toast.error(`Erreur: ${error.message}`)
    });
  };
  const handleBackToCollecting = () => {
    if (!user) { toast.error("Utilisateur non connecté"); return; }
    setCollectingMutation.mutate({ feeder_id: feederId, changed_by: user.id, changed_by_name: `${user.firstName} ${user.lastName}` }, {
      onSuccess: () => { toast.success("Départ remis en cours de collecte"); refetchStatus(); refreshAllData(); },
      onError: (error: Error) => toast.error(`Erreur: ${error.message}`)
    });
  };
  const handleAssign = async (agentId: string, agentName: string) => {
    setIsAssigning(true);
    assignMutation.mutate({ feeder_id: feederId, agent_id: agentId, agent_name: agentName, assigned_by: user?.id || "", assigned_by_name: `${user?.firstName || ""} ${user?.lastName || ""}` }, {
      onSuccess: () => { toast.success(`Assigné à ${agentName}`); setIsAssignDialogOpen(false); setIsReassignDialogOpen(false); refetchStatus(); refreshAllData(); },
      onError: (error: Error) => toast.error(`Erreur: ${error.message}`),
      onSettled: () => setIsAssigning(false)
    });
  };
  const handleStartTreatment = () => {
    if (!user) { toast.error("Utilisateur non connecté"); return; }
    startMutation.mutate({ feeder_id: feederId, started_by: user.id, started_by_name: `${user.firstName} ${user.lastName}` }, {
      onSuccess: () => { toast.success("Traitement démarré"); refetchStatus(); refreshAllData(); },
      onError: (error: Error) => toast.error(`Erreur: ${error.message}`)
    });
  };
  const handleCompleteTreatment = () => {
    if (!user) { toast.error("Utilisateur non connecté"); return; }
    setPendingValidationMutation.mutate({ feeder_id: feederId, completed_by: user.id, completed_by_name: `${user.firstName} ${user.lastName}` }, {
      onSuccess: () => { toast.success("Traitement terminé, en attente de validation"); refetchStatus(); refreshAllData(); },
      onError: (error: Error) => toast.error(`Erreur: ${error.message}`)
    });
  };
  const handleValidate = () => {
    if (!user) { toast.error("Utilisateur non connecté"); return; }
    validateMutation.mutate({ feeder_id: feederId, validated_by: user.id, validated_by_name: `${user.firstName} ${user.lastName}` }, {
      onSuccess: () => { toast.success("Départ validé avec succès"); refetchStatus(); refreshAllData(); },
      onError: (error: Error) => toast.error(`Erreur: ${error.message}`)
    });
  };
  const handleReject = () => {
    if (!user) { toast.error("Utilisateur non connecté"); return; }
    rejectMutation.mutate({ feeder_id: feederId, rejected_by: user.id, rejected_by_name: `${user.firstName} ${user.lastName}`, reason: "Rejeté par l'agent" }, {
      onSuccess: () => { toast.success("Départ rejeté"); refetchStatus(); refreshAllData(); },
      onError: (error: Error) => toast.error(`Erreur: ${error.message}`)
    });
  };

  const handleEquipmentSave = useCallback((equipment: EquipmentDetail, updatedData: Record<string, unknown>) => {
    const changedFields = Object.keys(updatedData).filter(
      key => String(updatedData[key]) !== String(equipment.data[key]) && key !== "_anomalyType" && key !== "photo"
    );
    const fieldsToLog = changedFields.length > 0 ? changedFields : Object.keys(updatedData).filter(k => k !== "_anomalyType" && k !== "photo");
    setRecentEdits(prev => {
      const filtered = prev.filter(e => String(e.mrid) !== String(equipment.mrid));
      const newEdits = [{ mrid: equipment.mrid, name: equipment.name, table: equipment.table, editedAt: Date.now(), fieldsChanged: fieldsToLog, equipment: { ...equipment, data: { ...equipment.data, ...updatedData } } }, ...filtered].slice(0, 10);
      saveRecentEditsToStorage(newEdits);
      return newEdits;
    });
  }, [saveRecentEditsToStorage]);

  const handleFieldChange = useCallback((id: string, field: string, val: string) => {
    setTreatment((prev) => ({ ...prev, [id]: { treated: prev[id]?.treated ?? false, editedFields: { ...(prev[id]?.editedFields ?? {}), [field]: val } } }));
  }, []);
  const handleMarkTreated = useCallback((id: string) => {
    setTreatment((prev) => ({ ...prev, [id]: { editedFields: prev[id]?.editedFields ?? {}, treated: true } }));
    toast.success("Anomalie marquée comme traitée");
  }, []);
  const handleEquipmentClick = useCallback((equipment: EquipmentDetail) => {
    setSelectedEquipment(equipment); setIsSheetOpen(true);
  }, []);

  const getStatusBadge = () => {
    const map: Record<string, { label: string; className: string }> = {
      collecting: { label: "En cours de collecte", className: "bg-blue-100 text-blue-700 border-blue-200" },
      pending: { label: "En attente de traitement", className: "bg-amber-100 text-amber-700 border-amber-200" },
      assigned: { label: "Assigné", className: "bg-purple-100 text-purple-700 border-purple-200" },
      in_progress: { label: "En cours de traitement", className: "bg-green-100 text-green-700 border-green-200" },
      pending_validation: { label: "En attente de validation", className: "bg-yellow-100 text-yellow-700 border-yellow-200" },
      validated: { label: "Validé", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
      rejected: { label: "Rejeté", className: "bg-red-100 text-red-700 border-red-200" },
    };
    const cfg = map[feederStatus] || { label: feederStatus, className: "bg-gray-100 text-gray-700 border-gray-200" };
    return <Badge className={cfg.className}>{cfg.label}</Badge>;
  };

  const renderActionButtons = () => {
    if (feederStatus === "collecting")
      return (
        <Button onClick={handleCompleteCollection} className="gap-2 cursor-pointer bg-blue-600 hover:bg-blue-700" disabled={setPendingMutation.isPending}>
          {setPendingMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
          Terminer la collecte
        </Button>
      );
    if (feederStatus === "validated" || feederStatus === "rejected")
      return (
        <Button onClick={handleCompleteTreatment} className="gap-2 cursor-pointer bg-blue-600 hover:bg-blue-700" disabled={setPendingMutation.isPending}>
          {setPendingMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Remettre en validation
        </Button>
      );
    if (feederStatus === "pending")
      return (
        <div className="flex flex-col gap-2 w-full sm:w-auto">
          <Button onClick={handleBackToCollecting} variant="outline" className="gap-2 cursor-pointer w-full" disabled={setCollectingMutation.isPending}>
            {setCollectingMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Remettre en collecte
          </Button>
          <div className="flex items-center gap-2 w-full">
            {!assignedAgentId ? (
              <Button onClick={() => setIsAssignDialogOpen(true)} className="w-full gap-2 bg-purple-600 hover:bg-purple-700 cursor-pointer">
                <UserCheck className="h-4 w-4 mr-2" />Assigner à un agent
              </Button>
            ) : (
              <div className="flex flex-col sm:flex-row gap-2 w-full">
                <Badge variant="outline" className="justify-center bg-amber-50 text-amber-700 border-amber-200 py-1.5 px-3">Assigné à {assignedAgentName}</Badge>
                {(user?.role === 'Admin' || user?.role === 'Chef équipe') && (
                  <Button onClick={() => setIsReassignDialogOpen(true)} variant="outline" className="gap-2 cursor-pointer">
                    <RefreshCw className="h-4 w-4 mr-2" />Réassigner
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      );
    if (feederStatus === "assigned")
      return (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {user?.id === assignedAgentId && (
            <Button onClick={handleStartTreatment} className="gap-2 bg-emerald-600 hover:bg-emerald-700 cursor-pointer" disabled={startMutation.isPending}>
              {startMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
              Débuter le traitement
            </Button>
          )}
          <Badge variant="outline" className="justify-center bg-amber-50 text-amber-700 border-amber-200 py-1.5 px-3">
            <User className="h-3 w-3 mr-1.5" />Assigné à {assignedAgentName}
          </Badge>
          {(user?.role === 'Admin' || user?.role === 'Chef équipe') && (
            <Button onClick={() => setIsReassignDialogOpen(true)} variant="outline" className="gap-2 cursor-pointer">
              <RefreshCw className="h-4 w-4 mr-2" />Réassigner
            </Button>
          )}
        </div>
      );
    if (feederStatus === "in_progress" && user?.id === assignedAgentId)
      return (
        <Button onClick={handleCompleteTreatment} variant="default" className="gap-2 cursor-pointer" disabled={setPendingValidationMutation.isPending}>
          {setPendingValidationMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
          Terminer le traitement
        </Button>
      );
    if (feederStatus === "pending_validation" && (user?.role === 'Admin' || user?.role === 'Chef équipe' || user?.role === 'Agent validation'))
      return (
        <div className="flex flex-col gap-3 w-full sm:w-auto">
          <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground bg-muted/30 px-3 py-2 rounded-lg">
            <div className="flex items-center gap-2">
              <Timer className="h-4 w-4" />
              <span>Temps: <span className="font-mono font-medium text-foreground">{formatDuration(durationSeconds)}</span></span>
            </div>
            {(user?.role === 'Admin' || user?.role === 'Chef équipe') && (
              <Button onClick={() => setIsReassignDialogOpen(true)} variant="outline" size="sm" className="gap-2 cursor-pointer">
                <RefreshCw className="h-3.5 w-3.5" />Réassigner
              </Button>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button onClick={handleStartTreatment} className="gap-2 bg-emerald-600 hover:bg-emerald-700 cursor-pointer flex-1" disabled={startMutation.isPending}>
              {startMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Remettre en traitement
            </Button>
            <Button onClick={handleValidate} className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700 cursor-pointer">
              <CheckCircle2 className="h-4 w-4 mr-2" />Valider
            </Button>
            <Button onClick={handleReject} variant="outline" className="flex-1 gap-2 border-red-300 text-red-600 hover:bg-red-600 hover:text-white cursor-pointer">
              <X className="h-4 w-4 mr-2" />Rejeter
            </Button>
          </div>
        </div>
      );
    if (feederStatus === "pending_validation")
      return (
        <div className="flex items-center gap-3">
          <Badge className="bg-yellow-100 text-yellow-700">En attente de validation</Badge>
          <span className="text-sm text-muted-foreground flex items-center gap-1"><Timer className="h-3 w-3" />{formatDuration(durationSeconds)}</span>
        </div>
      );
    return null;
  };

  useEffect(() => {
    if (!comparisonLoading && comparisonResult) setHasLoadedOnce(true);
  }, [comparisonLoading, comparisonResult]);

  if (comparisonLoading && !hasLoadedOnce) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Chargement des données du feeder...</p>
        </div>
      </div>
    );
  }

  if (comparisonError || !comparisonResult) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-muted-foreground">Erreur lors du chargement des données</p>
          <Button onClick={refresh} variant="outline" className="mt-4 cursor-pointer"><RefreshCw className="h-4 w-4 mr-2" />Réessayer</Button>
        </div>
      </div>
    );
  }

  if (!feederId) return (
    <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">Sélectionnez un départ dans le menu</div>
  );

  const isEditAllowed = isTreatmentActive && isTreatmentAllowed;

  return (
    <div className="w-full min-w-0 space-y-4 px-2 sm:px-4 md:px-6 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <button onClick={refreshAllData} disabled={isRefreshing}
              className="flex items-center gap-1.5 text-sm px-3 py-1 rounded border hover:bg-muted disabled:opacity-60 transition-opacity">
              <RefreshCw className={cn("h-3.5 w-3.5 transition-transform duration-300", isRefreshing && "animate-spin")} />
              Actualiser
            </button>
          </div>
          <div className="flex items-center gap-2 flex-wrap mt-1">
            <Zap className="h-5 w-5 text-primary shrink-0" />
            <h1 className="text-base sm:text-lg font-bold truncate">{feederName}</h1>
            {getStatusBadge()}
            {durationSeconds && feederStatus === "pending_validation" && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/30 px-2 py-1 rounded-full">
                <Timer className="h-3 w-3" /><span>{formatDuration(durationSeconds)}</span>
              </div>
            )}
            {assignedAgentName && feederStatus !== "collecting" && feederStatus !== "pending" && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/30 px-2 py-1 rounded-full">
                <User className="h-3 w-3" />
                <span className="hidden sm:inline">Assigné à: </span>
                <span className="font-medium text-foreground">{assignedAgentName}</span>
              </div>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Traitement · <span className="font-medium text-foreground">{counts.all}</span> anomalie{counts.all > 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex flex-col gap-2 shrink-0 w-full sm:w-auto">
          {renderActionButtons()}
          {feederStatus === "in_progress" && treatmentStartTimeBackend && <TimerDisplay startTime={treatmentStartTimeBackend} />}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-4 md:grid-cols-7 sm:gap-2">
        {KPI_CONFIG.map((cfg) => {
          const count = counts[cfg.type];
          const isActive = activeFilter === cfg.type;
          const Icon = cfg.icon;
          const treatedN = cfg.type !== "all" && cfg.type !== "ok"
            ? allAnomalies.filter((a) => a.type === cfg.type && treatment[a.id]?.treated).length : 0;
          return (
            <button key={cfg.type} onClick={() => setActiveFilter(isActive ? "all" : cfg.type)} disabled={count === 0}
              className={cn("flex flex-col gap-1.5 p-2 sm:p-3 rounded-xl border text-left transition-all duration-200 active:scale-95 cursor-pointer",
                isActive ? cn(cfg.activeBg, cfg.activeBorder) : "bg-card border-border hover:border-border",
                count === 0 && "opacity-40 cursor-default pointer-events-none")}>
              <div className="flex items-center justify-between">
                <div className={cn("p-1 sm:p-1.5 rounded-lg", cfg.bg)}><Icon className={cn("h-3 w-3 sm:h-3.5 sm:w-3.5", cfg.color)} /></div>
                {cfg.type !== "all" && cfg.type !== "ok" && count > 0 && (
                  <span className="text-[9px] text-muted-foreground hidden sm:inline">{treatedN}/{count}</span>
                )}
              </div>
              <div>
                <p className="text-lg sm:text-2xl font-bold leading-none tabular-nums">{count}</p>
                <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5 leading-tight">{cfg.label}</p>
              </div>
              {cfg.type !== "all" && cfg.type !== "ok" && count > 0 && (
                <div className="w-full h-1 rounded-full bg-border overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${(treatedN / count) * 100}%` }} />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {activeFilter !== "all" && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5" />
          <span>Filtré sur <strong className="text-foreground">{KPI_CONFIG.find((k) => k.type === activeFilter)?.label}</strong></span>
          <button onClick={() => setActiveFilter("all")} className="text-primary hover:underline cursor-pointer">Tout voir</button>
        </div>
      )}

      <div className="w-full rounded-xl overflow-hidden border border-border" style={{ height: "40vh", minHeight: 250 }}>
        <FullscreenMap equipments={mapEquipments} onMarkerClick={() => {}} feederColor="#6366f1" />
      </div>

      <EquipmentTypeKPIs allAnomalies={allAnomalies} />
      <EquipmentSearchBar allAnomalies={allAnomalies} onEquipmentClick={handleEquipmentClick}
        onSubstationClick={(anomaly) => setSearchSelectedSubstation(anomaly)} />
      <RecentEditsPanel recentEdits={recentEdits} onEquipmentClick={handleEquipmentClick} />

      <div className="space-y-3">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {activeFilter === "all" ? `${counts.all} anomalies`
            : activeFilter === "ok" ? `${counts.ok} équipements conformes`
            : `${counts[activeFilter]} · ${KPI_CONFIG.find(k => k.type === activeFilter)?.label}`}
        </h2>

        <FeederRootGroup feeders={feeders} orphans={orphans} filter={activeFilter} treatment={treatment}
          onFieldChange={handleFieldChange} onMarkTreated={handleMarkTreated} onEquipmentClick={handleEquipmentClick}
          isClickable={true} canProcess={isTreatmentActive && !!isTreatmentAllowed} />

        <SubstationsRootGroup substationsList={substationsList} switchesByBay={switchesByBay} filter={activeFilter}
          treatment={treatment} onFieldChange={handleFieldChange} onMarkTreated={handleMarkTreated}
          onEquipmentClick={handleEquipmentClick} isClickable={true} canProcess={isTreatmentActive && !!isTreatmentAllowed}
          feederId={feederId} user={user} updateAttributeMutation={updateAttributeMutation}
          refreshData={refreshAllData} onEquipmentSave={handleEquipmentSave}
          isTreatmentActive={isTreatmentActive} isTreatmentAllowed={isEditAllowed} />

        <WireRootGroup wires={wires} filter={activeFilter} treatment={treatment}
          onFieldChange={handleFieldChange} onMarkTreated={handleMarkTreated} onEquipmentClick={handleEquipmentClick}
          isClickable={true} canProcess={isTreatmentActive && !!isTreatmentAllowed} />

        {counts.all === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            <p className="text-sm">Aucune anomalie trouvée pour ce filtre</p>
          </div>
        )}
      </div>

      <EquipmentDetailSheet equipment={selectedEquipment} isOpen={isSheetOpen} onClose={() => setIsSheetOpen(false)}
        onSave={handleEquipmentSave} treatment={treatment} onFieldChange={handleFieldChange}
        isTreatmentActive={isTreatmentActive} isTreatmentAllowed={isEditAllowed}
        feederId={feederId} user={user} updateAttributeMutation={updateAttributeMutation} refreshData={refreshAllData} />

      {searchSelectedSubstation && (() => {
        const item = substationsList.find(s => s.substation.mrid === searchSelectedSubstation.mrid);
        return item ? (
          <SubstationDetailSheet isOpen={!!searchSelectedSubstation} onClose={() => setSearchSelectedSubstation(null)}
            substationAnomaly={item.substation} bays={item.bays} transformers={item.transformers}
            busbars={item.busbars} switchesByBay={switchesByBay} filter={activeFilter}
            canEdit={isTreatmentActive && !!isTreatmentAllowed} feederId={feederId} user={user}
            updateAttributeMutation={updateAttributeMutation} refreshData={refreshAllData}
            onEquipmentSave={handleEquipmentSave} isTreatmentActive={isTreatmentActive} isTreatmentAllowed={isEditAllowed} />
        ) : null;
      })()}

      <AssignDialog isOpen={isAssignDialogOpen} onClose={() => setIsAssignDialogOpen(false)} onAssign={handleAssign}
        feederName={feederName} processingAgents={processingAgents} isAssigning={isAssigning} currentUser={user} isReassign={false} />
      <AssignDialog isOpen={isReassignDialogOpen} onClose={() => setIsReassignDialogOpen(false)} onAssign={handleAssign}
        feederName={feederName} processingAgents={processingAgents} isAssigning={isAssigning} currentUser={user} isReassign={true} />
    </div>
  );
}
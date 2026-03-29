"use client";

import { useState, useMemo, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import { getAnomaliesByFeeder, AnomalyCase } from "@/lib/api/eneo-data";
import { formatDateTime, formatDateShort } from "@/lib/utils/date";
import {
  Copy, GitCompare, FilePlus, FileX, AlertCircle,
  CheckCircle2, ChevronRight, ChevronDown, Pencil,
  X, Check, Zap, Building2, Cable, Box, ToggleLeft,
  Layers, Info, MapPin, Save,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import React from "react";

// ─── Leaflet client-only ──────────────────────────────────────────────────────
const FeederMap = dynamic(
  () => import("@/components/distribution/feeder-map"),
  {
    ssr: false,
    loading: () => (
      <div
        className="w-full bg-muted/30 rounded-lg flex items-center justify-center animate-pulse"
        style={{ height: "20vh", minHeight: 160 }}
      >
        <span className="text-sm text-muted-foreground">Chargement de la carte…</span>
      </div>
    ),
  }
);

// ─── Types ────────────────────────────────────────────────────────────────────
type AnomalyType = "duplicate" | "divergence" | "new" | "missing" | "complex";

interface TreatmentState {
  [anomalyId: string]: {
    treated: boolean;
    editedFields: Record<string, string>;
  };
}

interface EquipmentDetail {
  id: string;
  mrid: string | number;
  table: string;
  name: string;
  data: Record<string, unknown>;
  anomalies: AnomalyCase[];
  location?: { lat: number; lng: number };
}

// ─── KPI Config ───────────────────────────────────────────────────────────────
const KPI_CONFIG = [
  { type: "duplicate" as AnomalyType, label: "Doublons",    icon: Copy,        color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-500/10",  activeBg: "bg-purple-500/15",  activeBorder: "border-purple-500/50"  },
  { type: "divergence" as AnomalyType, label: "Divergences", icon: GitCompare,  color: "text-amber-600 dark:text-amber-400",   bg: "bg-amber-500/10",   activeBg: "bg-amber-500/15",   activeBorder: "border-amber-500/50"   },
  { type: "new" as AnomalyType,       label: "Nouveaux",    icon: FilePlus,    color: "text-emerald-600 dark:text-emerald-400",bg: "bg-emerald-500/10", activeBg: "bg-emerald-500/15", activeBorder: "border-emerald-500/50" },
  { type: "missing" as AnomalyType,   label: "Manquants",   icon: FileX,       color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-500/10",  activeBg: "bg-orange-500/15",  activeBorder: "border-orange-500/50"  },
  { type: "complex" as AnomalyType,   label: "Complexes",   icon: AlertCircle, color: "text-red-600 dark:text-red-400",       bg: "bg-red-500/10",     activeBg: "bg-red-500/15",     activeBorder: "border-red-500/50"     },
] as const;

// ─── Icônes / labels par table ────────────────────────────────────────────────
const TABLE_ICONS: Record<string, React.ElementType> = {
  substation: Building2, powertransformer: Zap, busbar: Layers,
  bay: Box, switch: ToggleLeft, wire: Cable, feeder: Zap, pole: Box, node: Box,
};
const TABLE_LABELS: Record<string, string> = {
  substation: "Substation", powertransformer: "Transformateur", busbar: "Bus Bar",
  bay: "Bay", switch: "Switch", wire: "Wire", feeder: "Feeder", pole: "Poteau", node: "Nœud",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const FL: Record<string, string> = {
  name: "Nom", code: "Code", type: "Type", voltage: "Tension (kV)", active: "Actif",
  created_date: "Créé le", display_scada: "SCADA", apparent_power: "Puissance (kVA)",
  substation_id: "Poste source", feeder_id: "Départ", phase: "Phase",
  localisation: "Localisation", regime: "Régime", section: "Section",
  nature_conducteur: "Conducteur", height: "Hauteur (m)", latitude: "Latitude",
  longitude: "Longitude", w1_voltage: "U prim.", w2_voltage: "U sec.",
  highest_voltage_level: "U max (kV)", exploitation: "Exploitation",
  zone_type: "Type zone", security_zone_id: "Zone sécu.", second_substation_id: "Poste 2",
  normal_open: "NO", bay_mrid: "Travée", nature: "Nature", t1: "T1", t2: "T2",
  busbar_id1: "Bus bar 1", busbar_id2: "Bus bar 2", is_injection: "Injection",
  is_feederhead: "Tête départ", local_name: "Nom local", m_rid: "M-RID",
};
const fl = (k: string) => FL[k] || k;
const fv = (v: unknown): string => {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "Oui" : "Non";
  return String(v);
};
const recTitle = (r: Record<string, unknown> | null) =>
  r ? String(r.name || r.local_name || r.code || r.m_rid || "—") : "—";

const allKeys = (r1: Record<string, unknown> | null, r2: Record<string, unknown> | null) => {
  const s = new Set<string>();
  if (r1) Object.keys(r1).forEach((k) => s.add(k));
  if (r2) Object.keys(r2).forEach((k) => s.add(k));
  return Array.from(s).filter((k) => k !== "m_rid").sort();
};

// ─── Champ éditable ───────────────────────────────────────────────────────────
function EditableField({ value, original, onChange }: {
  value: string; original: string; onChange: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const dirty = value !== original;

  if (editing) return (
    <div className="flex items-center gap-1 min-w-0">
      <Input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { onChange(draft); setEditing(false); } if (e.key === "Escape") setEditing(false); }}
        className="h-6 text-xs px-1.5 py-0 font-mono" />
      <button onClick={() => { onChange(draft); setEditing(false); }} className="p-0.5 rounded bg-emerald-500/15">
        <Check className="h-3 w-3 text-emerald-600" />
      </button>
      <button onClick={() => setEditing(false)} className="p-0.5 rounded hover:bg-muted">
        <X className="h-3 w-3 text-muted-foreground" />
      </button>
    </div>
  );

  return (
    <div className="flex items-center gap-1.5 group/ef min-w-0">
      <span className={cn("text-xs font-mono break-all", dirty && "text-amber-600 dark:text-amber-400 font-semibold")}>{value || "—"}</span>
      {dirty && <span className="text-[10px] text-muted-foreground line-through shrink-0">{original}</span>}
      <button onClick={() => { setDraft(value); setEditing(true); }} className="invisible group-hover/ef:visible ml-auto p-0.5 rounded hover:bg-muted shrink-0">
        <Pencil className="h-2.5 w-2.5 text-muted-foreground" />
      </button>
    </div>
  );
}

// ─── Badge anomalie ───────────────────────────────────────────────────────────
function AnomalyBadge({ type }: { type: AnomalyType }) {
  const cfg = KPI_CONFIG.find((k) => k.type === type)!;
  const Icon = cfg.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full", cfg.bg, cfg.color)}>
      <Icon className="h-2.5 w-2.5" />{cfg.label}
    </span>
  );
}

// ─── Sheet pour les détails d'équipement ──────────────────────────────────────
function EquipmentDetailSheet({
  equipment,
  isOpen,
  onClose,
  onSave,
  treatment,
  onFieldChange,
}: {
  equipment: EquipmentDetail | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (equipment: EquipmentDetail, updatedData: Record<string, unknown>) => void;
  treatment: TreatmentState;
  onFieldChange: (anomalyId: string, field: string, val: string) => void;
}) {
  const [editedData, setEditedData] = useState<Record<string, unknown>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Initialiser editedData quand l'équipement change
  useMemo(() => {
    if (equipment) {
      setEditedData({ ...equipment.data });
    }
  }, [equipment]);

  if (!equipment) return null;

  const Icon = TABLE_ICONS[equipment.table] || Box;
  const iconColor = "text-primary";

  // Champs importants à afficher/modifier
  const importantFields = [
    "name", "code", "type", "voltage", "active", "phase",
    "apparent_power", "localisation", "regime", "section",
    "nature_conducteur", "height", "latitude", "longitude",
    "w1_voltage", "w2_voltage", "exploitation", "zone_type",
  ];

  const getFieldInputType = (field: string): "text" | "number" | "select" => {
    if (field === "active" || field === "is_injection" || field === "is_feederhead" || field === "normal_open") {
      return "select";
    }
    if (field === "voltage" || field === "apparent_power" || field === "height" || 
        field === "w1_voltage" || field === "w2_voltage" || field === "highest_voltage_level") {
      return "number";
    }
    return "text";
  };

const handleFieldChange = (field: string, value: string | number | boolean) => {
  setEditedData((prev) => ({ ...prev, [field]: value }));
};

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      onSave(equipment, editedData);
      toast.success(`${equipment.name} modifié avec succès`);
      onClose();
    } catch (error) {
      toast.error("Erreur lors de la modification");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent
        side="right"
        className="w-screen! sm:w-120! max-w-none! sm:max-w-120! flex flex-col p-0 overflow-hidden"
      >
        <SheetHeader className="px-5 py-4 border-b shrink-0">
          <div className="flex items-center gap-2">
            <Icon className={cn("h-5 w-5", iconColor)} />
            <SheetTitle className="text-base">{equipment.name}</SheetTitle>
          </div>
          <SheetDescription className="text-sm">
            {TABLE_LABELS[equipment.table] || equipment.table} • ID: {equipment.mrid}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {/* Anomalies associées */}
          {equipment.anomalies.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Anomalies détectées
              </Label>
              <div className="flex flex-wrap gap-2">
                {equipment.anomalies.map((anomaly) => (
                  <Badge
                    key={anomaly.id}
                    className={cn(
                      "gap-1",
                      KPI_CONFIG.find(k => k.type === anomaly.type)?.bg,
                      KPI_CONFIG.find(k => k.type === anomaly.type)?.color
                    )}
                  >
                    {React.createElement(KPI_CONFIG.find(k => k.type === anomaly.type)?.icon!, { className: "h-3 w-3" })}
                    {KPI_CONFIG.find(k => k.type === anomaly.type)?.label}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Localisation */}
          {equipment.location && (
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <MapPin className="h-3 w-3 inline mr-1" />
                Localisation GPS
              </Label>
              <div className="p-3 rounded-lg bg-muted/30">
                <p className="text-sm font-mono">
                  {equipment.location.lat.toFixed(6)}, {equipment.location.lng.toFixed(6)}
                </p>
              </div>
            </div>
          )}

          {/* Champs modifiables */}
          <div className="space-y-4">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Données de l'équipement
            </Label>
            
            {importantFields.map((field) => {
              const value = editedData[field];
              if (value === undefined) return null;
              
              const originalValue = equipment.data[field];
              const isModified = String(value) !== String(originalValue);
              const inputType = getFieldInputType(field);
              
              return (
                <div key={field} className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground flex items-center justify-between">
                    <span>{fl(field)}</span>
                    {isModified && (
                      <span className="text-[10px] text-amber-600">modifié</span>
                    )}
                  </Label>
                  
                  {inputType === "select" ? (
                    <Select
                      value={String(value)}
                      onValueChange={(v) => handleFieldChange(field, v === "true" || v === "oui" || v === "Oui")}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Oui / Actif</SelectItem>
                        <SelectItem value="false">Non / Inactif</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      type={inputType}
                      value={String(value)}
                      onChange={(e) => handleFieldChange(field, inputType === "number" ? parseFloat(e.target.value) : e.target.value)}
                      className={cn("h-8 text-sm", isModified && "border-amber-500 focus-visible:ring-amber-500")}
                    />
                  )}
                  
                  {isModified && originalValue !== undefined && (
                    <p className="text-[10px] text-muted-foreground">
                      Ancienne valeur: {fv(originalValue)}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Champs divergents spécifiques */}
          {equipment.anomalies.some(a => a.type === "divergence") && (
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-amber-600">
                Champs en divergence
              </Label>
              {equipment.anomalies
                .filter(a => a.type === "divergence" && a.divergentFields)
                .flatMap(a => a.divergentFields || [])
                .map((field, idx) => {
                  const anomalyId = equipment.anomalies.find(a => a.type === "divergence")?.id;
                  const editedValue = anomalyId ? treatment[anomalyId]?.editedFields[field.field] : undefined;
                  const currentValue = editedValue !== undefined ? editedValue : fv(field.layer2Value);
                  
                  return (
                    <div key={idx} className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">{fl(field.field)}</span>
                        <AnomalyBadge type="divergence" />
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <p className="text-muted-foreground">BD1 (Référence)</p>
                          <p className="font-mono line-through text-muted-foreground">{fv(field.layer1Value)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">BD2 (Terrain)</p>
                          {anomalyId ? (
                            <EditableField
                              value={currentValue}
                              original={fv(field.layer2Value)}
                              onChange={(val) => onFieldChange(anomalyId, field.field, val)}
                            />
                          ) : (
                            <p className="font-mono text-amber-600">{fv(field.layer2Value)}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        <SheetFooter className="px-5 py-4 border-t shrink-0 flex flex-row gap-3 sm:gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Annuler
          </Button>
          <Button className="flex-1" onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Enregistrement...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Enregistrer
              </>
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ─── Carte d'anomalie ─────────────────────────────────────────────────────────
function AnomalyCard({ anomaly, treatment, onFieldChange, onMarkTreated, onEquipmentClick }: {
  anomaly: AnomalyCase; treatment: TreatmentState;
  onFieldChange: (id: string, field: string, val: string) => void;
  onMarkTreated: (id: string) => void;
  onEquipmentClick?: (equipment: EquipmentDetail) => void;
}) {
  const t = treatment[anomaly.id];
  const isTreated = t?.treated ?? false;
  const Icon = TABLE_ICONS[anomaly.table] || Box;
  const rec1 = anomaly.layer1Record;
  const rec2 = anomaly.layer2Record;
  const divergentFields = new Set((anomaly.divergentFields ?? []).map((f) => f.field));
  const keys = useMemo(() => allKeys(rec1, rec2), [rec1, rec2]);

  // Créer un objet EquipmentDetail pour le clic
  const equipmentDetail: EquipmentDetail | null = useMemo(() => {
    const record = rec2 ?? rec1;
    if (!record) return null;
    return {
      id: String(anomaly.mrid),
      mrid: anomaly.mrid,
      table: anomaly.table,
      name: recTitle(record),
      data: record,
      anomalies: [anomaly],
      location: (record.latitude && record.longitude) ? {
        lat: parseFloat(String(record.latitude)),
        lng: parseFloat(String(record.longitude)),
      } : undefined,
    };
  }, [anomaly, rec1, rec2]);

  return (
    <div 
      className={cn("rounded-xl border transition-all cursor-pointer hover:shadow-md", 
        isTreated ? "border-emerald-500/30 bg-emerald-500/5" : "border-border bg-card"
      )}
      onClick={() => equipmentDetail && onEquipmentClick?.(equipmentDetail)}
    >
      {/* En-tête */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 border-b border-border/40">
        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="text-xs font-semibold truncate flex-1">{TABLE_LABELS[anomaly.table] || anomaly.table} — {recTitle(rec2 ?? rec1)}</span>
        <span className="text-[10px] font-mono text-muted-foreground">{anomaly.mrid}</span>
        <AnomalyBadge type={anomaly.type} />
        {isTreated && (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-2.5 w-2.5" />Traité
          </span>
        )}
      </div>

      {/* Corps - aperçu */}
      <div className="p-3">
        <div className="grid grid-cols-2 gap-2 text-xs">
          {keys.slice(0, 4).map((k) => (
            <div key={k}>
              <span className="text-muted-foreground">{fl(k)}</span>
              <p className="font-mono truncate">{fv(rec2?.[k] ?? rec1?.[k])}</p>
            </div>
          ))}
        </div>
        
        {/* Bouton Marquer traité */}
        {!isTreated && (
          <div className="flex justify-end pt-2 mt-2 border-t border-border/40">
            <button 
              onClick={(e) => { e.stopPropagation(); onMarkTreated(anomaly.id); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 transition-all"
            >
              <Check className="h-3.5 w-3.5" />Marquer traité
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Groupe par table ─────────────────────────────────────────────────────────
function TableGroup({ table, anomalies, treatment, onFieldChange, onMarkTreated, onEquipmentClick, defaultOpen }: {
  table: string; anomalies: AnomalyCase[]; treatment: TreatmentState;
  onFieldChange: (id: string, field: string, val: string) => void;
  onMarkTreated: (id: string) => void;
  onEquipmentClick?: (equipment: EquipmentDetail) => void;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const Icon = TABLE_ICONS[table] || Box;
  const treatedCount = anomalies.filter((a) => treatment[a.id]?.treated).length;
  const allDone = treatedCount === anomalies.length;

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <button onClick={() => setOpen((p) => !p)}
        className="flex w-full items-center gap-2.5 px-4 py-3 bg-muted/20 hover:bg-muted/40 transition-colors text-left">
        {open ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
        <Icon className="h-4 w-4 shrink-0 text-primary" />
        <span className="font-medium text-sm flex-1">{TABLE_LABELS[table] || table}</span>
        <span className="text-xs text-muted-foreground">{treatedCount}/{anomalies.length}</span>
        {allDone && <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />}
      </button>
      {open && (
        <div className="p-3 space-y-3">
          {anomalies.map((a) => (
            <AnomalyCard 
              key={a.id} 
              anomaly={a} 
              treatment={treatment}
              onFieldChange={onFieldChange} 
              onMarkTreated={onMarkTreated}
              onEquipmentClick={onEquipmentClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Page principale ─────────────────────────────────────────────────────────
export default function FeederProcessingPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const feederId = params?.feederId as string;
  const feederName = searchParams?.get("name") || feederId;

  const [activeFilter, setActiveFilter] = useState<AnomalyType | null>(null);
  const [treatment, setTreatment] = useState<TreatmentState>({});
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentDetail | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const allAnomalies = useMemo(() => getAnomaliesByFeeder(feederId), [feederId]);

  const filteredAnomalies = useMemo(
    () => activeFilter ? allAnomalies.filter((a) => a.type === activeFilter) : allAnomalies,
    [allAnomalies, activeFilter]
  );

  const byTable = useMemo(() => {
    const map = new Map<string, AnomalyCase[]>();
    for (const a of filteredAnomalies) {
      if (!map.has(a.table)) map.set(a.table, []);
      map.get(a.table)!.push(a);
    }
    return map;
  }, [filteredAnomalies]);

  const counts = useMemo(
    () => KPI_CONFIG.reduce((acc, cfg) => ({ ...acc, [cfg.type]: allAnomalies.filter((a) => a.type === cfg.type).length }), {} as Record<AnomalyType, number>),
    [allAnomalies]
  );

  // Points carte
  const mapPoints = useMemo(() => {
    const seen = new Set<string>();
    return allAnomalies
      .filter((a) => a.table === "substation")
      .reduce<Record<string, unknown>[]>((acc, a) => {
        const rec = a.layer2Record ?? a.layer1Record;
        if (!rec) return acc;
        const key = String(rec.m_rid);
        if (seen.has(key)) return acc;
        const lat = parseFloat(String(rec.latitude ?? ""));
        const lng = parseFloat(String(rec.longitude ?? ""));
        if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
          seen.add(key);
          acc.push({ ...rec, _anomalyType: a.type, _anomalyId: a.id, _table: a.table });
        }
        return acc;
      }, []);
  }, [allAnomalies]);

  const handleFieldChange = useCallback((id: string, field: string, val: string) => {
    setTreatment((prev) => ({
      ...prev,
      [id]: { treated: prev[id]?.treated ?? false, editedFields: { ...(prev[id]?.editedFields ?? {}), [field]: val } },
    }));
  }, []);

  const handleMarkTreated = useCallback((id: string) => {
    setTreatment((prev) => ({ ...prev, [id]: { editedFields: prev[id]?.editedFields ?? {}, treated: true } }));
    toast.success("Anomalie marquée comme traitée");
  }, []);

  const handleEquipmentClick = useCallback((equipment: EquipmentDetail) => {
    setSelectedEquipment(equipment);
    setIsSheetOpen(true);
  }, []);

  const handleEquipmentSave = useCallback((equipment: EquipmentDetail, updatedData: Record<string, unknown>) => {
    // Ici, tu peux implémenter la sauvegarde des données modifiées
    // Pour l'instant, on met à jour le traitement local
    console.log("Sauvegarde équipement:", equipment.id, updatedData);
    toast.success(`${equipment.name} sauvegardé`);
  }, []);

  const handleMapMarkerClick = useCallback((equipment: any) => {
    // Construire l'équipement à partir des données du marqueur
    const equipmentDetail: EquipmentDetail = {
      id: String(equipment.m_rid),
      mrid: equipment.m_rid,
      table: equipment._table || "substation",
      name: equipment.name || recTitle(equipment),
      data: equipment,
      anomalies: allAnomalies.filter(a => String(a.mrid) === String(equipment.m_rid)),
      location: equipment.latitude && equipment.longitude ? {
        lat: parseFloat(String(equipment.latitude)),
        lng: parseFloat(String(equipment.longitude)),
      } : undefined,
    };
    setSelectedEquipment(equipmentDetail);
    setIsSheetOpen(true);
  }, [allAnomalies]);

  const allTreated = useMemo(
    () => allAnomalies.length > 0 && allAnomalies.every((a) => treatment[a.id]?.treated),
    [allAnomalies, treatment]
  );

  if (!feederId) return (
    <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
      Sélectionnez un départ dans le menu
    </div>
  );

  return (
    <div className="w-full min-w-0 space-y-4 px-4 py-4 sm:px-6">

      {/* En-tête */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary shrink-0" />
            <h1 className="text-lg font-bold truncate sm:text-xl">{feederName}</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Traitement · <span className="font-medium text-foreground">{allAnomalies.length}</span>{" "}
            anomalie{allAnomalies.length > 1 ? "s" : ""} (BD1 vs BD2)
          </p>
        </div>
        {allTreated && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 w-fit shrink-0">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Prêt pour la validation</span>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5 sm:gap-3">
        {KPI_CONFIG.map((cfg) => {
          const count = counts[cfg.type];
          const isActive = activeFilter === cfg.type;
          const Icon = cfg.icon;
          const treatedN = allAnomalies.filter((a) => a.type === cfg.type && treatment[a.id]?.treated).length;
          return (
            <button key={cfg.type} onClick={() => setActiveFilter(isActive ? null : cfg.type)} disabled={count === 0}
              className={cn("flex flex-col gap-2 p-3 rounded-xl border text-left transition-all duration-200 active:scale-95",
                isActive ? cn(cfg.activeBg, cfg.activeBorder) : "bg-card border-border hover:border-border",
                count === 0 && "opacity-40 cursor-default pointer-events-none")}>
              <div className="flex items-center justify-between">
                <div className={cn("p-1.5 rounded-lg", cfg.bg)}><Icon className={cn("h-3.5 w-3.5", cfg.color)} /></div>
                {count > 0 && <span className="text-[9px] text-muted-foreground">{treatedN}/{count}</span>}
              </div>
              <div>
                <p className="text-2xl font-bold leading-none tabular-nums">{count}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{cfg.label}</p>
              </div>
              {count > 0 && (
                <div className="w-full h-1 rounded-full bg-border overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${(treatedN / count) * 100}%` }} />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {activeFilter && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5" />
          <span>Filtré sur <strong className="text-foreground">{KPI_CONFIG.find((k) => k.type === activeFilter)?.label}</strong></span>
          <button onClick={() => setActiveFilter(null)} className="text-primary hover:underline">Tout voir</button>
        </div>
      )}

      {/* Carte Leaflet */}
      <div className="w-full rounded-xl overflow-hidden border border-border" style={{ height: "20vh", minHeight: 160 }}>
        <FeederMap 
          substations={mapPoints} 
          feederId={feederId} 
          onMarkerClick={handleMapMarkerClick}
        />
      </div>

      {/* Anomalies groupées par table */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {filteredAnomalies.length === 0 ? "Aucune anomalie" : `${filteredAnomalies.length} anomalie${filteredAnomalies.length > 1 ? "s" : ""}`}
        </h2>

        {filteredAnomalies.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 text-emerald-500/40" />
            <p className="text-sm">Aucune anomalie pour ce filtre</p>
          </div>
        )}

        {Array.from(byTable.entries()).map(([table, anomalies], idx) => (
          <TableGroup key={table} table={table} anomalies={anomalies} treatment={treatment}
            onFieldChange={handleFieldChange} onMarkTreated={handleMarkTreated}
            onEquipmentClick={handleEquipmentClick} defaultOpen={idx === 0} />
        ))}
      </div>

      {/* Sheet pour les détails d'équipement */}
      <EquipmentDetailSheet
        equipment={selectedEquipment}
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        onSave={handleEquipmentSave}
        treatment={treatment}
        onFieldChange={handleFieldChange}
      />
    </div>
  );
}
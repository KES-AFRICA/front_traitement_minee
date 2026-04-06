"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import {
  Copy, GitCompare, FilePlus, FileX, AlertCircle,
  CheckCircle2, ChevronRight, ChevronDown,
  X, Check, Zap, Building2, Cable, Box, ToggleLeft,
  Layers, Info, MapPin, Save, UserCheck, Filter,
  Play, Timer, User, RefreshCw,
  Maximize2, Loader2
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import React from "react";
import { useAuth } from "@/lib/auth/context";
import { useFeederComparison } from "@/hooks/useComparison";
import { FeederComparisonResult, TableName, AnomalyItem, EquipmentDetail } from "@/lib/types/comparison";
import { buildPhotoUrl } from "@/lib/api/services/koboService";
import { PhotoThumb } from "@/app/(dashboard)/map/page";
import { 
  useTreatmentStatus, 
  useAssignTreatment, 
  useStartTreatment, 
  useCompleteTreatment, 
  useValidateTreatment, 
  useRejectTreatment, 
  useUpdateAttribute,
  useAllUsers,
  useSetPending,
  useSetCollecting,
  useSetPendingValidation
} from "@/hooks/use-treatment-service";

// ─── Leaflet client-only ──────────────────────────────────────────────
const FullscreenMap = dynamic(
  () => import("@/components/distribution/feeder-map"),
  {
    ssr: false,
    loading: () => (
      <div
        className="w-full bg-muted/30 rounded-lg flex items-center justify-center animate-pulse"
        style={{ height: "30vh", minHeight: 200 }}
      >
        <span className="text-sm text-muted-foreground">Chargement de la carte…</span>
      </div>
    ),
  }
);

// ─── Types ────────────────────────────────────────────────────────────
type AnomalyType = "ok" | "duplicate" | "divergence" | "new" | "missing" | "complex";
type FilterType = AnomalyType | "all";

interface TreatmentState {
  [anomalyId: string]: {
    treated: boolean;
    editedFields: Record<string, string>;
  };
}

// ─── Fonction pour formater la durée (secondes → Jours/Heures/Minutes/Secondes) ───
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

// ─── Mapping noms frontend → noms tables PostgreSQL ───────────────────
const TABLE_NAME_MAP: Record<string, string> = {
  powertransformer: "power_transformers",
  substation:       "substations",
  bus_bar:          "busbar",
  bay:              "bay",
  switch:           "switch",
  wire:             "wire",
  feeder:           "feeders",
};

// ─── Icônes / labels par table ────────────────────────────────────────
const TABLE_ICONS: Record<string, React.ElementType> = {
  substation: Building2, powertransformer: Zap, bus_bar: Layers,
  bay: Box, switch: ToggleLeft, wire: Cable, feeder: Zap,
};
const TABLE_LABELS: Record<string, string> = {
  substation: "Substation", powertransformer: "Transformateur", bus_bar: "Bus Bar",
  bay: "Cellule", switch: "switch", wire: "Câble", feeder: "Départ",
};

// ─── Helpers ──────────────────────────────────────────────────────────
const FL: Record<string, string> = {
  name: "Nom", code: "Code", type: "Type", voltage: "Tension (kV)", active: "Actif",
  created_date: "Créé le", display_scada: "SCADA", apparent_power: "Puissance (kVA)",
  substation_id: "Poste source", feeder_id: "Départ", phase: "Phase",
  localisation: "Localisation", regime: "Régime", section: "Section",
  nature_conducteur: "Conducteur", height: "Hauteur (m)", latitude: "Latitude",
  longitude: "Longitude",
  highest_voltage_level: "U max (kV)", exploitation: "Exploitation",
  zone_type: "Type zone", security_zone_id: "Zone sécu.", second_substation_id: "Poste 2",
  normal_open: "NO", bay_mrid: "Travée", nature: "Nature", t1: "T1", t2: "T2",
  busbar_id1: "Bus bar 1", busbar_id2: "Bus bar 2", is_injection: "Injection",
  is_feederhead: "Tête départ", local_name: "Nom local", m_rid: "M-RID",
  w1_voltage: "Tension primaire", w2_voltage: "Tension secondaire",
  substations_m_rid: "Poste source",
};
const fl = (k: string) => FL[k] || k;
const fv = (v: unknown): string => {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "Oui" : "Non";
  return String(v);
};

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

// ─── Dialog d'assignation ─────────────────────────────────────────────
function AssignDialog({
  isOpen,
  onClose,
  onAssign,
  feederName,
  processingAgents,
  isAssigning,
  currentUser,
  isReassign = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  onAssign: (agentId: string, agentName: string) => void;
  feederName: string;
  processingAgents: any[];
  isAssigning: boolean;
  currentUser: any | null;
  isReassign?: boolean;
}) {
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.charAt(0) || ""}${lastName?.charAt(0) || ""}`.toUpperCase();
  };

  const handleAssign = () => {
    if (!selectedAgentId) {
      toast.warning("Veuillez sélectionner un agent");
      return;
    }
    const selectedAgent = processingAgents.find(agent => agent.id === selectedAgentId);
    if (selectedAgent) {
      onAssign(selectedAgentId, `${selectedAgent.firstName} ${selectedAgent.lastName}`);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-primary" />
            {isReassign ? "Assigner un autre agent" : "Assigner un agent"}
          </DialogTitle>
          <DialogDescription>
            {isReassign 
              ? "Changez l'agent responsable de ce départ pour le traitement des anomalies."
              : "Assignez ce départ à un agent de traitement pour analyse des anomalies."}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Départ concerné</Label>
            <div className="p-3 bg-muted/30 rounded-lg">
              <p className="font-medium text-sm">{feederName}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="agent">Sélectionner un agent de traitement</Label>
            <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
              <SelectTrigger id="agent" className="w-full cursor-pointer">
                <SelectValue placeholder="Choisir un agent..." />
              </SelectTrigger>
              <SelectContent>
                {processingAgents.length === 0 ? (
                  <SelectItem value="none" disabled>
                    Aucun agent disponible
                  </SelectItem>
                ) : (
                  processingAgents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id} className="cursor-pointer">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-xs bg-primary/10 text-primary">
                            {getInitials(agent.firstName, agent.lastName)}
                          </AvatarFallback>
                        </Avatar>
                        <span>
                          {agent.firstName} {agent.lastName}
                        </span>
                        <div className="ml-2 py-1 px-2 border rounded-md text-xs">
                          {agent.company}
                        </div>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="flex gap-2 sm:gap-2">
          <Button variant="outline" className="flex-1 cursor-pointer" onClick={onClose} disabled={isAssigning}>
            Annuler
          </Button>
          
          <Button
            onClick={handleAssign}
            disabled={isAssigning || !selectedAgentId || processingAgents.length === 0}
            className="flex-1 bg-purple-600 hover:bg-purple-700 cursor-pointer"
          >
            {isAssigning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Assignation...
              </>
            ) : (
              <>
                <UserCheck className="h-4 w-4 mr-2" />
                {isReassign ? "Réassigner" : "Assigner"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Sheet pour les détails d'équipement ──────────────────────────────
function EquipmentDetailSheet({
  equipment,
  isOpen,
  onClose,
  onSave,
  treatment,
  onFieldChange,
  isTreatmentActive,
  isTreatmentAllowed,
}: {
  equipment: EquipmentDetail | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (equipment: EquipmentDetail, updatedData: Record<string, unknown>) => void;
  treatment: TreatmentState;
  onFieldChange: (anomalyId: string, field: string, val: string) => void;
  isTreatmentActive: boolean;
  isTreatmentAllowed: boolean | null;
}) {
  const [editedData, setEditedData] = useState<Record<string, unknown>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenPhoto, setFullscreenPhoto] = useState<string | null>(null);

  const HIDDEN_FIELDS = new Set([
    "qrcode", "precision", "photo", "exploitattion_m_rid", "collected_date",
    "collected_agent_name", "arrondissements_m_rid", "structure_m_rid",
    "second_switch_m_rid", "pole_m_rid"
  ]);

  const DISABLED_FIELDS = new Set(["latitude", "longitude"]);

  const divergentFieldNames = useMemo(() => {
    const divergenceAnomaly = equipment?.anomalies.find(a => a.type === "divergence");
    if (divergenceAnomaly && divergenceAnomaly.divergent_fields) {
      return new Set(divergenceAnomaly.divergent_fields.map(df => df.field));
    }
    return new Set<string>();
  }, [equipment]);

  const duplicateFields = useMemo(() => {
    const duplicateAnomaly = equipment?.anomalies.find(a => a.type === "duplicate");
    if (duplicateAnomaly && duplicateAnomaly.duplicate_occurrences) {
      const firstOcc = duplicateAnomaly.duplicate_occurrences[0];
      if (firstOcc && firstOcc.full_record) {
        return Object.keys(firstOcc.full_record).filter(
          k => !HIDDEN_FIELDS.has(k) && k !== "m_rid" && k !== "created_at" && k !== "created_date"
        );
      }
    }
    return [];
  }, [equipment]);

  const allFields = useMemo(() => {
    if (!equipment) return [];
    
    const data = editedData;
    const fieldsWithValue: string[] = [];
    const fieldsWithoutValue: string[] = [];
    
    const allFieldKeys = Object.keys(data).filter(k => 
      !HIDDEN_FIELDS.has(k) && 
      k !== "m_rid" && 
      k !== "_anomalyType" && 
      k !== "_anomalyId" && 
      k !== "_table" && 
      k !== "created_date" && 
      k !== "created_at"&& 
      k !== "structure_m_rid"&& 
      k !== "localisation" &&   
      k !== "description" &&    
      k !== "observation"       
    );
    
    for (const field of allFieldKeys) {
      const value = data[field];
      const hasValue = value !== null && value !== undefined && value !== "";
      
      if (hasValue) {
        fieldsWithValue.push(field);
      } else {
        fieldsWithoutValue.push(field);
      }
    }
    
    const sortByPriority = (fields: string[]) => {
      return fields.sort((a, b) => {
        const aIsPriority = divergentFieldNames.has(a) || duplicateFields.includes(a);
        const bIsPriority = divergentFieldNames.has(b) || duplicateFields.includes(b);
        if (aIsPriority && !bIsPriority) return -1;
        if (!aIsPriority && bIsPriority) return 1;
        return a.localeCompare(b);
      });
    };
    
    return [...sortByPriority(fieldsWithValue), ...sortByPriority(fieldsWithoutValue)];
  }, [equipment, editedData, divergentFieldNames, duplicateFields]);

  useEffect(() => {
    if (equipment) {
      setEditedData({ ...equipment.data });
    }
  }, [equipment]);

  if (!equipment) return null;

  const Icon = TABLE_ICONS[equipment.table] || Box;
  const iconColor = "text-primary";

  const getPhotoUrl = (photo: any) => {
    if (!photo) return null;
    if (typeof photo === 'string') return buildPhotoUrl(photo);
    if (Array.isArray(photo) && photo.length > 0) return buildPhotoUrl(photo[0]);
    return null;
  };

  const displayPhotoUrl = getPhotoUrl(equipment.photo || equipment.data?.photo);

  const handlePhotoClick = (photoUrl: string) => {
    setFullscreenPhoto(photoUrl);
    setIsFullscreen(true);
  };

  const getFieldInputType = (field: string, value: unknown): "text" | "number" | "select" | "textarea" => {
    if (field === "active" || field === "is_injection" || field === "is_feederhead" || field === "normal_open" || field === "display_scada") {
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
    onSave(equipment, editedData);
    setIsSaving(false);
    onClose();
  };

  const canEdit = isTreatmentActive && isTreatmentAllowed;

  return (
    <>
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

          <div className="flex-1 overflow-y-auto px-2 py-2 space-y-5">
            <div className="w-full flex flex-col items-center justify-center py-2 border-b border-dashed border-border">
              {displayPhotoUrl ? (
                <PhotoThumb src={displayPhotoUrl} alt={equipment.name} />
              ) : (
                <div className="w-32 h-32 rounded-full bg-muted/50 flex items-center justify-center">
                  <Icon className="h-12 w-12 text-muted-foreground/50" />
                </div>
              )}
            </div>

            {equipment.anomalies.some(a => a.type === "divergence") && canEdit && (
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-amber-600">
                  Champs en divergence (Référence vs Collecté)
                </Label>
                {equipment.anomalies
                  .filter(a => a.type === "divergence" && a.divergent_fields)
                  .flatMap(a => a.divergent_fields || [])
                  .map((field, idx) => {
                    const anomalyId = equipment.anomalies.find(a => a.type === "divergence")?.id;
                    const editedValue = anomalyId ? treatment[anomalyId]?.editedFields[field.field] : undefined;
                    const currentValue = editedValue !== undefined ? editedValue : fv(field.collected_value);
                    
                    return (
                      <div key={idx} className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">{fl(field.field)}</span>
                          <AnomalyBadge type="divergence" />
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <p className="text-muted-foreground mb-1">Référence (MySQL)</p>
                            <p className="font-mono p-2 rounded bg-muted/30 line-through text-muted-foreground">
                              {fv(field.reference_value)}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground mb-1">Collecté (PostGIS)</p>
                            {anomalyId && (
                              <Input
                                value={currentValue}
                                onChange={(e) => onFieldChange(anomalyId, field.field, e.target.value)}
                                className="h-8 text-sm font-mono border-amber-500"
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}

            {!canEdit && equipment.anomalies.length > 0 && (
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
                    
                    {(anomaly.type === "duplicate" && anomaly.duplicate_occurrences) && (
                      <div className="mt-2 pt-2 border-t border-amber-500/20">
                        <p className="text-xs font-medium mb-2">Toutes les occurrences ({anomaly.duplicate_occurrences.length}) :</p>
                        <div className="space-y-2">
                          {anomaly.duplicate_occurrences.map((occ, idx) => (
                            <div key={idx} className="text-xs bg-muted/20 p-2 rounded">
                              <div className="font-mono font-medium">M-RID: {occ.m_rid}</div>
                              <div>Nom: {occ.name || "—"}</div>
                              {occ.substations_m_rid && <div>Poste: {occ.substations_m_rid}</div>}
                              {occ.full_record && (
                                <div className="mt-1 pt-1 border-t border-border/50">
                                  <details>
                                    <summary className="cursor-pointer text-[10px] text-muted-foreground">Voir tous les champs</summary>
                                    <div className="mt-1 grid grid-cols-2 gap-1 text-[10px]">
                                      {Object.entries(occ.full_record)
                                        .filter(([k]) => !HIDDEN_FIELDS.has(k))
                                        .slice(0, 10)
                                        .map(([k, v]) => (
                                          <div key={k}><span className="text-muted-foreground">{fl(k)}:</span> {fv(v)}</div>
                                        ))}
                                    </div>
                                  </details>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {(anomaly.type === "divergence" && anomaly.divergent_fields) && (
                      <div className="mt-2 pt-2 border-t border-amber-500/20">
                        <p className="text-xs font-medium mb-2">Tous les champs en divergence ({anomaly.divergent_fields.length}) :</p>
                        <div className="space-y-2">
                          {anomaly.divergent_fields.map((df, idx) => (
                            <div key={idx} className="p-2 rounded bg-muted/20">
                              <div className="font-medium text-xs mb-1">{fl(df.field)}</div>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className="p-1.5 rounded bg-red-50 dark:bg-red-950/20">
                                  <span className="text-red-600 dark:text-red-400 text-[10px] font-medium">RÉFÉRENCE</span>
                                  <p className="font-mono break-words">{fv(df.reference_value)}</p>
                                </div>
                                <div className="p-1.5 rounded bg-amber-50 dark:bg-amber-950/20">
                                  <span className="text-amber-600 dark:text-amber-400 text-[10px] font-medium">COLLECTÉ</span>
                                  <p className="font-mono break-words">{fv(df.collected_value)}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

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
                  <p className="text-[10px] text-muted-foreground mt-1">
                    ⚠️ La localisation ne peut pas être modifiée
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Données de l'équipement
              </Label>
              
              {allFields.map((field) => {
                const value = editedData[field];
                if (value === undefined) return null;
                
                const originalValue = equipment.data[field];
                const isModified = String(value) !== String(originalValue);
                const inputType = getFieldInputType(field, value);
                const isDivergentField = divergentFieldNames.has(field);
                const isDisabled = DISABLED_FIELDS.has(field) || !canEdit;
                
                return (
                  <div key={field} className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <span>{fl(field)}</span>
                        {isDivergentField && (
                          <Badge variant="outline" className="text-[9px] bg-amber-500/10 text-amber-600 border-amber-200">
                            Divergence
                          </Badge>
                        )}
                      </div>
                      {isModified && canEdit && !isDisabled && (
                        <span className="text-[10px] text-amber-600">modifié</span>
                      )}
                    </Label>
                    
                    {isDisabled ? (
                      <div className="p-2 rounded-md bg-muted/20 text-sm font-mono">
                        {fv(value)}
                      </div>
                    ) : inputType === "select" ? (
                      <Select
                        value={String(value)}
                        onValueChange={(v) => handleFieldChange(field, v === "true" || v === "oui" || v === "Oui")}
                      >
                        <SelectTrigger className="h-9 text-sm cursor-pointer">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="true" className="cursor-pointer">Oui / Actif</SelectItem>
                          <SelectItem value="false" className="cursor-pointer">Non / Inactif</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : inputType === "textarea" ? (
                      <textarea
                        value={String(value)}
                        onChange={(e) => handleFieldChange(field, e.target.value)}
                        className={cn(
                          "w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                          isModified && "border-amber-500"
                        )}
                        rows={3}
                      />
                    ) : (
                      <Input
                        type={inputType}
                        value={String(value)}
                        onChange={(e) => handleFieldChange(field, inputType === "number" ? parseFloat(e.target.value) : e.target.value)}
                        className={cn(
                          "h-9 text-sm",
                          isModified && "border-amber-500 focus-visible:ring-amber-500"
                        )}
                      />
                    )}
                    
                    {isModified && originalValue !== undefined && canEdit && !isDisabled && (
                      <p className="text-[10px] text-muted-foreground">
                        Ancienne valeur: {fv(originalValue)}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {canEdit && (
            <SheetFooter className="px-5 py-4 border-t shrink-0 flex flex-row gap-3 sm:gap-2">
              <Button variant="outline" className="flex-1 cursor-pointer" onClick={onClose}>
                Annuler
              </Button>
              <Button className="flex-1 cursor-pointer" onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
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
          )}
        </SheetContent>
      </Sheet>

      {isFullscreen && fullscreenPhoto && (
        <Dialog open={isFullscreen} onOpenChange={() => setIsFullscreen(false)}>
          <DialogContent className="max-w-[95vw] max-h-[95vh] w-[95vw] h-[95vh] p-0 bg-black/95 border-none">
            <button
              onClick={() => setIsFullscreen(false)}
              className="absolute top-4 right-4 z-50 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors cursor-pointer"
            >
              <X className="h-6 w-6" />
            </button>
            <img
              src={fullscreenPhoto}
              alt="Photo plein écran"
              className="w-full h-full object-contain"
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

// ─── OkEquipmentCard ─────────────────────────────────────────────────
function OkEquipmentCard({ equipment, onEquipmentClick, isClickable }: {
  equipment: EquipmentDetail;
  onEquipmentClick?: (equipment: EquipmentDetail) => void;
  isClickable: boolean;
}) {
  const Icon = TABLE_ICONS[equipment.table] || Box;
  const iconColor = "text-primary";
  
  const displayFields = ["name", "type", "voltage", "active"].filter(f => equipment.data[f] !== undefined).slice(0, 4);

  const handleClick = () => {
    if (isClickable) {
      onEquipmentClick?.(equipment);
    }
  };

  return (
    <div 
      onClick={handleClick}
      className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/10 cursor-pointer hover:shadow-md transition-all"
    >
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-emerald-200/50 dark:border-emerald-800/50">
        <Icon className={cn("h-3.5 w-3.5 shrink-0", iconColor)} />
        <span className="text-xs font-semibold truncate flex-1">{equipment.name}</span>
        <Badge variant="outline" className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400">
          <CheckCircle2 className="h-2.5 w-2.5 mr-1" />
          Conforme
        </Badge>
      </div>
      <div className="p-3">
        <div className="grid grid-cols-2 gap-2 text-xs">
          {displayFields.map((field) => (
            <div key={field}>
              <span className="text-muted-foreground text-[10px]">{fl(field)}</span>
              <p className="font-mono text-xs truncate">{fv(equipment.data[field])}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── AnomalyCard ─────────────────────────────────────────────────────
function AnomalyCard({ anomaly, treatment, onFieldChange, onMarkTreated, onEquipmentClick, isClickable, canProcess }: {
  anomaly: AnomalyItem; 
  treatment: TreatmentState;
  onFieldChange: (id: string, field: string, val: string) => void;
  onMarkTreated: (id: string) => void;
  onEquipmentClick?: (equipment: EquipmentDetail) => void;
  isClickable: boolean;
  canProcess: boolean;
}) {
  const t = treatment[anomaly.id];
  const isTreated = t?.treated ?? false;
  const Icon = TABLE_ICONS[anomaly.table] || Box;
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenPhoto, setFullscreenPhoto] = useState<string | null>(null);

  const equipmentDetail: EquipmentDetail | null = useMemo(() => {
    const collectedData = anomaly.collected_data || {};
    const referenceData = anomaly.reference_data || {};
    const directData = anomaly.data || {};

    let recordData: Record<string, any> = {};

    if (anomaly.type === "missing") {
      recordData = { ...directData, ...referenceData };
    } else if (anomaly.type === "new") {
      recordData = { ...directData, ...collectedData };
    } else if (anomaly.type === "divergence") {
      recordData = { ...referenceData, ...collectedData };
    } else if (anomaly.type === "duplicate") {
      recordData = { ...collectedData };
    } else {
      recordData = { ...directData, ...collectedData };
    }

    const photoUrl = collectedData.photo || directData.photo || null;

    return {
      id: anomaly.mrid,
      mrid: anomaly.mrid,
      table: anomaly.table,
      name: anomaly.name || recordData.name || String(anomaly.mrid),
      data: { ...recordData, _anomalyType: anomaly.type },
      anomalies: [anomaly],
      photo: photoUrl,  
      location: recordData.latitude && recordData.longitude
        ? {
            lat: typeof recordData.latitude === "string" ? parseFloat(recordData.latitude) : recordData.latitude,
            lng: typeof recordData.longitude === "string" ? parseFloat(recordData.longitude) : recordData.longitude,
          }
        : undefined,
    };
  }, [anomaly]);

  const handleCardClick = () => {
    if (isClickable && equipmentDetail) {
      onEquipmentClick?.(equipmentDetail);
    } else {
      toast.info("Le traitement n'a pas encore commencé pour ce départ");
    }
  };

  const getPhotoUrl = (photo: any) => {
    if (!photo) return null;
    if (typeof photo === 'string') return buildPhotoUrl(photo);
    if (Array.isArray(photo) && photo.length > 0) return buildPhotoUrl(photo[0]);
    return null;
  };

  const handlePhotoClick = (photoUrl: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFullscreenPhoto(photoUrl);
    setIsFullscreen(true);
  };

  const displayPhotoUrl = getPhotoUrl(equipmentDetail?.photo);

  const displayFields = useMemo(() => {
    const data = equipmentDetail?.data || {};
    const fields = Object.keys(data).filter(k => 
      k !== "m_rid" && k !== "_anomalyType" && k !== "created_date" && k !== "created_at" && k !== "photo"
    );
    
    if (anomaly.type === "divergence" && anomaly.divergent_fields) {
      return anomaly.divergent_fields.slice(0, 6).map(df => ({
        label: fl(df.field),
        value: fv(df.collected_value),
        field: df.field
      }));
    } else if (anomaly.type === "new" || anomaly.type === "missing") {
      const importantFields = ["name", "type", "voltage", "regime", "exploitation", "zone_type", "section", "nature_conducteur", "phase"];
      const selectedFields = importantFields.filter(f => data[f] !== undefined).slice(0, 6);
      if (selectedFields.length < 6) {
        const otherFields = fields.filter(f => !importantFields.includes(f)).slice(0, 6 - selectedFields.length);
        selectedFields.push(...otherFields);
      }
      return selectedFields.map(f => ({ label: fl(f), value: fv(data[f]), field: f }));
    } else if (anomaly.type === "duplicate") {
      return [
        { label: "Nom", value: anomaly.name || "—", field: "name" },
        { label: "M-RID", value: anomaly.mrid, field: "m_rid" },
        { label: "Occurrences", value: `${anomaly.duplicate_occurrences?.length || 0}`, field: "count" },
      ];
    }
    
    return fields.slice(0, 6).map(f => ({ label: fl(f), value: fv(data[f]), field: f }));
  }, [equipmentDetail, anomaly]);

  return (
    <>
      <div 
        className={cn("rounded-xl border transition-all", 
          isTreated ? "border-emerald-500/30 bg-emerald-500/5" : "border-border bg-card",
          isClickable ? "cursor-pointer hover:shadow-md" : "cursor-pointer"
        )}
        onClick={handleCardClick}
      >
        <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 border-b border-border/40">
          {displayPhotoUrl ? (
            <div 
              className="w-6 h-6 rounded overflow-hidden bg-muted/30 shrink-0 cursor-pointer"
              onClick={(e) => handlePhotoClick(displayPhotoUrl, e)}
            >
              <img 
                src={displayPhotoUrl} 
                alt="" 
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          ) : (
            <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )}
          <span className="text-xs font-semibold truncate flex-1">{TABLE_LABELS[anomaly.table] || anomaly.table} — {anomaly.name || anomaly.mrid}</span>
          <span className="text-[10px] font-mono text-muted-foreground">{anomaly.mrid}</span>
          <AnomalyBadge type={anomaly.type} />
          {isTreated && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600">
              <CheckCircle2 className="h-2.5 w-2.5" />Traité
            </span>
          )}
        </div>

        <div className="p-3 grid grid-cols-1 md:grid-cols-5 gap-2">
          {displayPhotoUrl && (
            <div className="md:col-span-1 rounded-lg overflow-hidden bg-muted/20 border border-border relative group">
              <img 
                src={displayPhotoUrl} 
                alt={equipmentDetail?.name || "Photo"} 
                className="w-full h-64 object-cover cursor-pointer"
                onClick={(e) => handlePhotoClick(displayPhotoUrl, e)}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://placehold.co/400x200?text=Photo+indisponible';
                }}
              />
              <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => handlePhotoClick(displayPhotoUrl, e)}
                  className="p-1.5 rounded-lg bg-black/50 text-white hover:bg-black/70 transition-colors cursor-pointer"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
          
          <div className="p-3 w-full md:col-span-4">
            {equipmentDetail?.location && (
              <div className="mb-3 text-xs text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                <span className="font-mono">
                  {equipmentDetail.location.lat.toFixed(6)}, {equipmentDetail.location.lng.toFixed(6)}
                </span>
              </div>
            )}
            
            {anomaly.type === "divergence" && anomaly.divergent_fields ? (
              <div className="space-y-2">
                {anomaly.divergent_fields.slice(0, 3).map((df, idx) => (
                  <div key={idx} className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-1.5 rounded bg-red-50 dark:bg-red-950/20">
                      <span className="text-red-600 dark:text-red-400 text-[10px] font-medium">{fl(df.field)} - RÉFÉRENCE</span>
                      <p className="font-mono text-xs wrap-break-word">{fv(df.reference_value)}</p>
                    </div>
                    <div className="p-1.5 rounded bg-amber-50 dark:bg-amber-950/20">
                      <span className="text-amber-600 dark:text-amber-400 text-[10px] font-medium">{fl(df.field)} - COLLECTÉ</span>
                      <p className="font-mono text-xs wrap-break-word">{fv(df.collected_value)}</p>
                    </div>
                  </div>
                ))}
                {anomaly.divergent_fields.length > 3 && (
                  <p className="text-[10px] text-muted-foreground text-center">
                    + {anomaly.divergent_fields.length - 3} autres champs en divergence
                  </p>
                )}
              </div>
            ) : anomaly.type === "duplicate" && anomaly.duplicate_occurrences ? (
              <div className="space-y-1">
                <p className="text-xs font-medium text-purple-600">⚠️ {anomaly.duplicate_occurrences.length} occurrences trouvées</p>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {anomaly.duplicate_occurrences.slice(0, 3).map((occ, idx) => (
                    <div key={idx} className="text-[10px] font-mono bg-muted/30 p-1 rounded">
                      {occ.m_rid} - {occ.name}
                    </div>
                  ))}
                  {anomaly.duplicate_occurrences.length > 3 && (
                    <p className="text-[9px] text-muted-foreground">+{anomaly.duplicate_occurrences.length - 3} autres</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-3 gap-y-2 text-xs">
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

        {!isTreated && isClickable && canProcess && (
          <div className="flex justify-end pt-2 mt-2 border-t border-border/40">
            <button 
              onClick={(e) => { e.stopPropagation(); onMarkTreated(anomaly.id); }}
              className="flex mb-4 mr-4 items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer"
            >
              <Check className="h-3.5 w-3.5" />Marquer traité
            </button>
          </div>
        )}
      </div>

      {isFullscreen && fullscreenPhoto && (
        <Dialog open={isFullscreen} onOpenChange={() => setIsFullscreen(false)}>
          <DialogContent className="max-w-[95vw] max-h-[95vh] w-[95vw] h-[95vh] p-0 bg-black/95 border-none">
            <button
              onClick={() => setIsFullscreen(false)}
              className="absolute top-4 right-4 z-50 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors cursor-pointer"
            >
              <X className="h-6 w-6" />
            </button>
            <img
              src={fullscreenPhoto}
              alt="Photo plein écran"
              className="w-full h-full object-contain"
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

// ─── TableGroup ──────────────────────────────────────────────────────
function TableGroup({ table, anomalies, filter, treatment, onFieldChange, onMarkTreated, onEquipmentClick, defaultOpen, isClickable, canProcess }: {
  table: string; 
  anomalies: AnomalyItem[]; 
  filter: FilterType;
  treatment: TreatmentState;
  onFieldChange: (id: string, field: string, val: string) => void;
  onMarkTreated: (id: string) => void;
  onEquipmentClick?: (equipment: EquipmentDetail) => void;
  defaultOpen: boolean;
  isClickable: boolean;
  canProcess: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const Icon = TABLE_ICONS[table] || Box;
  
  const filteredAnomalies = useMemo(() => {
    if (filter === "all") return anomalies;
    if (filter === "ok") return anomalies.filter((a) => a.type === "ok");
    return anomalies.filter((a) => a.type === filter);
  }, [anomalies, filter]);
  
  const okCount = filteredAnomalies.filter((a) => a.type === "ok").length;
  const anomalyCount = filteredAnomalies.filter((a) => a.type !== "ok").length;
  const treatedCount = filteredAnomalies.filter((a) => a.type !== "ok" && treatment[a.id]?.treated).length;
  const allDone = treatedCount === anomalyCount && anomalyCount > 0;
  const totalCount = filteredAnomalies.length;
  
  if (totalCount === 0) return null;

  const okAnomalies = filteredAnomalies.filter(a => a.type === "ok");
  const otherAnomalies = filteredAnomalies.filter(a => a.type !== "ok");

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <button onClick={() => setOpen((p) => !p)}
        className="flex w-full items-center gap-2.5 px-4 py-3 bg-muted/20 hover:bg-muted/40 transition-colors text-left cursor-pointer">
        {open ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
        <Icon className="h-4 w-4 shrink-0 text-primary" />
        <span className="font-medium text-sm flex-1">{TABLE_LABELS[table] || table}</span>
        <div className="flex items-center gap-2">
          {anomalyCount > 0 && (
            <span className="text-xs text-amber-600">{anomalyCount} anomalie{anomalyCount > 1 ? "s" : ""}</span>
          )}
          {okCount > 0 && (
            <span className="text-xs text-emerald-600">{okCount} conforme{okCount > 1 ? "s" : ""}</span>
          )}
        </div>
        {allDone && anomalyCount > 0 && <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />}
      </button>
      {open && (
        <div className="p-3 space-y-3">
          {otherAnomalies.map((a) => (
            <AnomalyCard 
              key={a.id} 
              anomaly={a} 
              treatment={treatment}
              onFieldChange={onFieldChange} 
              onMarkTreated={onMarkTreated}
              onEquipmentClick={onEquipmentClick}
              isClickable={isClickable}
              canProcess={canProcess}
            />
          ))}
          
          {okAnomalies.length > 0 && otherAnomalies.length > 0 && (
            <div className="pt-2 border-t border-border/50">
              <p className="text-xs text-muted-foreground mb-2">✓ Équipements conformes</p>
            </div>
          )}
          {okAnomalies.map((a) => {
            const equipmentDetail: EquipmentDetail = {
              id: a.mrid,
              mrid: a.mrid,
              table: a.table,
              name: a.name || a.mrid,
              data: a.data || {},
              anomalies: [a],
            };
            return (
              <OkEquipmentCard 
                key={a.id}
                equipment={equipmentDetail}
                onEquipmentClick={onEquipmentClick}
                isClickable={isClickable}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Timer ────────────────────────────────────────────────────────────
function TimerDisplay({ startTime }: { startTime: number | null }) {
  const [elapsed, setElapsed] = useState<string>("00:00:00");

  useEffect(() => {
    if (!startTime) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const diff = now - startTime;
      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setElapsed(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  if (!startTime) return null;

  return (
    <div className="flex items-center justify-center gap-2 px-3 py-1 rounded-lg bg-primary/10 border border-primary/20 w-full">
      <div className="flex items-center">
        <Timer className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium text-muted-foreground ml-1">Temps écoulé:</span>
        <span className="text-base font-bold text-primary font-mono tracking-wide ml-1">{elapsed}</span>
      </div>
    </div>
  );
}

// ─── Conversion pour la carte ─────────────────────────────────────────
const convertToMapEquipments = (comparisonResult: FeederComparisonResult | null): Record<string, unknown>[] => {
  if (!comparisonResult) return [];
  
  const mapEquipments: Record<string, unknown>[] = [];
  const tables: TableName[] = ["substation"];
  
  for (const table of tables) {
    const tableResult = comparisonResult.tables?.[table];
    if (!tableResult) continue;
    
    for (const ok of tableResult.ok ?? []) {
      if (ok.data?.latitude && ok.data?.longitude) {
        mapEquipments.push({ ...ok.data, m_rid: ok.mrid, table, _anomalyType: "ok" });
      }
    }
    for (const missing of tableResult.missing ?? []) {
      if (missing.full_record?.latitude && missing.full_record?.longitude) {
        mapEquipments.push({ ...missing.full_record, m_rid: missing.m_rid, name: missing.name, table, _anomalyType: "missing" });
      }
    }
    for (const newItem of tableResult.new ?? []) {
      if (newItem.full_record?.latitude && newItem.full_record?.longitude) {
        mapEquipments.push({ ...newItem.full_record, m_rid: newItem.m_rid, name: newItem.name, table, _anomalyType: "new" });
      }
    }
    for (const div of tableResult.divergences ?? []) {
      if (div.collected_data?.latitude && div.collected_data?.longitude) {
        mapEquipments.push({ ...div.collected_data, m_rid: div.mrid, table, _anomalyType: "divergence", _referenceData: div.reference_data });
      }
    }
    for (const dup of tableResult.duplicates ?? []) {
      for (const occ of dup.occurrences ?? []) {
        if (occ.full_record?.latitude && occ.full_record?.longitude) {
          mapEquipments.push({ ...occ.full_record, m_rid: occ.m_rid, name: occ.name, table, _anomalyType: "duplicate", _duplicateOccurrences: dup.occurrences });
        }
      }
    }
  }
  
  return mapEquipments;
};

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
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [isReassignDialogOpen, setIsReassignDialogOpen] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  
  // Statut depuis le backend
  const feederStatus = treatmentStatus?.status || "collecting";
  const assignedAgentId = treatmentStatus?.assigned_to;
  const assignedAgentName = treatmentStatus?.assigned_to_name;
  const treatmentStartTimeBackend = treatmentStatus?.started_at ? new Date(treatmentStatus.started_at).getTime() : null;
  const durationSeconds = treatmentStatus?.duration_seconds;
  
  const isTreatmentActive = feederStatus === "in_progress";
  const isTreatmentAllowed = user?.id === assignedAgentId;
  
  const feederName = comparisonResult?.feeder_name || feederNameFromUrl;
  
  const processingAgents = useMemo(() => {
    if (!usersData?.data) return [];
    return usersData.data.filter((u: any) => 
      u.role !== "Admin"
    );
  }, [usersData]);
  
  const mapEquipments = useMemo(() => convertToMapEquipments(comparisonResult), [comparisonResult]);

  useEffect(() => {
    if (feederId) {
      setTreatment({});
      refetchUsers();
      refetchStatus();
    }
  }, [feederId, refetchUsers, refetchStatus]);

  // Convertir les anomalies
  const allAnomalies: AnomalyItem[] = useMemo(() => {
    if (!comparisonResult) return [];
    
    const anomalies: AnomalyItem[] = [];
    const tables: TableName[] = ["feeder", "substation", "bus_bar", "bay", "switch", "powertransformer", "wire"];
    
    for (const table of tables) {
      const tableResult = comparisonResult.tables?.[table];
      if (!tableResult) continue;
      
      for (const ok of tableResult.ok ?? []) {
        anomalies.push({
          id: `${table}-ok-${ok.mrid}`,
          type: "ok" as AnomalyType,
          table,
          mrid: ok.mrid,
          name: ok.data?.name || ok.mrid,
          data: ok.data,
        });
      }
      
      for (const missing of tableResult.missing ?? []) {
        anomalies.push({
          id: `${table}-miss-${missing.m_rid}`,
          type: "missing",
          table,
          mrid: missing.m_rid,
          name: missing.name,
          data: missing.full_record,
        });
      }
      
      for (const div of tableResult.divergences ?? []) {
        anomalies.push({
          id: `${table}-div-${div.mrid}`,
          type: "divergence",
          table,
          mrid: div.mrid,
          name: div.name || div.reference_data?.name || div.collected_data?.name || div.mrid,
          reference_data: div.reference_data,
          collected_data: div.collected_data,
          divergent_fields: div.divergent_fields,
        });
      }
      
      for (const newItem of tableResult.new ?? []) {
        anomalies.push({
          id: `${table}-new-${newItem.m_rid}`,
          type: "new",
          table,
          mrid: newItem.m_rid,
          name: newItem.name,
          data: newItem.full_record,
        });
      }
      
      for (const dup of tableResult.duplicates ?? []) {
        for (const occ of dup.occurrences ?? []) {
          anomalies.push({
            id: `${table}-dup-${occ.m_rid}`,
            type: "duplicate",
            table,
            mrid: occ.m_rid,
            name: occ.name,
            duplicate_occurrences: dup.occurrences,
            collected_data: occ.full_record,
          });
        }
      }
    }
    
    return anomalies;
  }, [comparisonResult]);

  const counts = useMemo(() => {
    if (summary) {
      return {
        all: summary.total,
        ok: summary.ok,
        duplicate: summary.duplicate,
        divergence: summary.divergence,
        new: summary.new,
        missing: summary.missing,
        complex: summary.complex,
      };
    }
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

  const anomaliesByTable = useMemo(() => {
    const byTable = new Map<string, AnomalyItem[]>();
    for (const anomaly of allAnomalies) {
      if (!byTable.has(anomaly.table)) {
        byTable.set(anomaly.table, []);
      }
      byTable.get(anomaly.table)!.push(anomaly);
    }
    return byTable;
  }, [allAnomalies]);

  // Handlers backend
  const handleCompleteCollection = () => {
    if (!user) {
      toast.error("Utilisateur non connecté");
      return;
    }
    
    setPendingMutation.mutate({
      feeder_id: feederId,
      completed_by: user.id,
      completed_by_name: `${user.firstName} ${user.lastName}`,
    }, {
      onSuccess: () => {
        toast.success("Collecte terminée. Le départ est maintenant en attente de traitement.");
        refetchStatus();
      },
      onError: (error: Error) => {
        toast.error(`Erreur: ${error.message}`);
      }
    });
  };

  const handleBackToCollecting = () => {
    if (!user) {
      toast.error("Utilisateur non connecté");
      return;
    }
    
    setCollectingMutation.mutate({
      feeder_id: feederId,
      changed_by: user.id,
      changed_by_name: `${user.firstName} ${user.lastName}`,
    }, {
      onSuccess: () => {
        toast.success("Départ remis en cours de collecte");
        refetchStatus();
      },
      onError: (error: Error) => {
        toast.error(`Erreur: ${error.message}`);
      }
    });
  };

  const handleAssign = async (agentId: string, agentName: string) => {
    setIsAssigning(true);
    assignMutation.mutate({
      feeder_id: feederId,
      agent_id: agentId,
      agent_name: agentName,
      assigned_by: user?.id || "",
      assigned_by_name: `${user?.firstName || ""} ${user?.lastName || ""}`,
    }, {
      onSuccess: () => {
        toast.success(`Départ ${feederName} assigné à ${agentName}`);
        setIsAssignDialogOpen(false);
        setIsReassignDialogOpen(false);
        refetchStatus();
      },
      onError: (error: Error) => {
        toast.error(`Erreur: ${error.message}`);
      },
      onSettled: () => setIsAssigning(false)
    });
  };

  const handleStartTreatment = () => {
    if (!user) {
      toast.error("Utilisateur non connecté");
      return;
    }
    
    startMutation.mutate({
      feeder_id: feederId,
      started_by: user.id,
      started_by_name: `${user.firstName} ${user.lastName}`,
    }, {
      onSuccess: () => {
        toast.success("Traitement démarré, les champs sont maintenant modifiables");
        refetchStatus();
      },
      onError: (error: Error) => {
        toast.error(`Erreur: ${error.message}`);
      }
    });
  };

  const handleCompleteTreatment = () => {
    if (!user) {
      toast.error("Utilisateur non connecté");
      return;
    }
    
    setPendingValidationMutation.mutate({
      feeder_id: feederId,
      completed_by: user.id,
      completed_by_name: `${user.firstName} ${user.lastName}`,
    }, {
      onSuccess: () => {
        toast.success("Traitement terminé, en attente de validation");
        refetchStatus();
      },
      onError: (error: Error) => {
        toast.error(`Erreur: ${error.message}`);
      }
    });
  };

  const handleValidate = () => {
    if (!user) {
      toast.error("Utilisateur non connecté");
      return;
    }
    
    validateMutation.mutate({
      feeder_id: feederId,
      validated_by: user.id,
      validated_by_name: `${user.firstName} ${user.lastName}`,
      comment: "Validé après traitement",
    }, {
      onSuccess: () => {
        toast.success("Départ validé avec succès");
        refetchStatus();
      },
      onError: (error: Error) => {
        toast.error(`Erreur: ${error.message}`);
      }
    });
  };

  const handleReject = () => {
    if (!user) {
      toast.error("Utilisateur non connecté");
      return;
    }
    
    rejectMutation.mutate({
      feeder_id: feederId,
      rejected_by: user.id,
      rejected_by_name: `${user.firstName} ${user.lastName}`,
      reason: "Rejeté après validation",
    }, {
      onSuccess: () => {
        toast.success("Départ rejeté");
        refetchStatus();
      },
      onError: (error: Error) => {
        toast.error(`Erreur: ${error.message}`);
      }
    });
  };

  // ─── CORRECTION : utilisation de TABLE_NAME_MAP pour convertir le nom
  const handleEquipmentSave = (equipment: EquipmentDetail, updatedData: Record<string, unknown>) => {
    if (!user) {
      toast.error("Utilisateur non connecté");
      return;
    }
    
    const originalData = equipment.data;
    const changedFields = Object.keys(updatedData).filter(
      key => originalData[key] !== updatedData[key] && key !== "_anomalyType" && key !== "photo"
    );

    if (changedFields.length === 0) {
      toast.info("Aucune modification détectée");
      return;
    }

    const sqlTableName = TABLE_NAME_MAP[equipment.table] ?? equipment.table;

    Promise.all(changedFields.map(field =>
      updateAttributeMutation.mutateAsync({
        feeder_id: feederId,
        table_name: sqlTableName,
        record_id: String(equipment.mrid),
        attribute_name: field,
        new_value: updatedData[field],
        changed_by: user.id,
        changed_by_name: `${user.firstName} ${user.lastName}`,
        comment: `Modification depuis l'interface de traitement`,
      })
    )).then(() => {
      toast.success(`${changedFields.length} champ(s) modifié(s) avec succès`);
      refresh();
    }).catch(() => {
      toast.error("Erreur lors de la modification");
    });
  };

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

  const handleMarkerClick = useCallback(() => {}, []);

  const filteredTableGroups = useMemo(() => {
    return Array.from(anomaliesByTable.entries()).map(([table, anomalies]) => ({
      table,
      anomalies,
      hasContent: activeFilter === "all" 
        ? anomalies.length > 0
        : anomalies.filter(a => a.type === activeFilter).length > 0
    })).filter(group => group.hasContent);
  }, [anomaliesByTable, activeFilter]);

  const getStatusBadge = () => {
    switch (feederStatus) {
      case "collecting":
        return <Badge className="bg-blue-100 text-blue-700 border-blue-200">En cours de collecte</Badge>;
      case "pending":
        return <Badge className="bg-amber-100 text-amber-700 border-amber-200">En attente de traitement</Badge>;
      case "assigned":
        return <Badge className="bg-purple-100 text-purple-700 border-purple-200">Assigné</Badge>;
      case "in_progress":
        return <Badge className="bg-green-100 text-green-700 border-green-200">En cours de traitement</Badge>;
      case "pending_validation":
        return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">En attente de validation</Badge>;
      case "validated":
        return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Validé</Badge>;
      case "rejected":
        return <Badge className="bg-red-100 text-red-700 border-red-200">Rejeté</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-700 border-gray-200">{feederStatus || "En cours de collecte"}</Badge>;
    }
  };

  const renderActionButtons = () => {
    // En cours de collecte
    if (feederStatus === "collecting") {
      return (
        <Button onClick={handleCompleteCollection} className="gap-2 bg-blue-600 hover:bg-blue-700 cursor-pointer" disabled={setPendingMutation.isPending}>
          {setPendingMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
          Terminer la collecte
        </Button>
      );
    }
    
    // En attente de traitement
    if (feederStatus === "pending") {
      return (
        <div className="flex gap-2">
          <Button 
            onClick={handleBackToCollecting} 
            variant="outline" 
            className="gap-2 cursor-pointer"
            disabled={setCollectingMutation.isPending}
          >
            {setCollectingMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Remettre en cours de collecte
          </Button>
          {!assignedAgentId ? (
            <Button onClick={() => setIsAssignDialogOpen(true)} className="gap-2 bg-purple-600 hover:bg-purple-700 cursor-pointer">
              <UserCheck className="h-4 w-4 mr-2" />
              Assigner à un agent
            </Button>
          ) : (
            <div className="flex gap-2">
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                Assigné à {assignedAgentName}
              </Badge>
              {(user?.role === 'Admin' || user?.role === 'Chef équipe') && (
                <Button 
                  onClick={() => setIsReassignDialogOpen(true)} 
                  variant="outline" 
                  className="gap-2 cursor-pointer"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Réassigner
                </Button>
              )}
            </div>
          )}
        </div>
      );
    }
    
    // Assigné
    if (feederStatus === "assigned") {
      if (user?.id === assignedAgentId) {
        return (
          <Button onClick={handleStartTreatment} className="gap-2 bg-emerald-600 hover:bg-emerald-700 cursor-pointer" disabled={startMutation.isPending}>
            {startMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
            Débuter le traitement
          </Button>
        );
      }
      return (
        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
          Assigné à {assignedAgentName}
        </Badge>
      );
    }

    // En cours de traitement
    if (feederStatus === "in_progress") {
      if (user?.id === assignedAgentId) {
        return (
          <Button onClick={handleCompleteTreatment} variant="default" className="gap-2 cursor-pointer" disabled={setPendingValidationMutation.isPending}>
            {setPendingValidationMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
            Terminer le traitement
          </Button>
        );
      }
      return null;
    }
    
    // En attente de validation
    if (feederStatus === "pending_validation") {
      if (user?.role === 'Admin' || user?.role === 'Chef équipe' || user?.role === 'Agent validation') {
        return (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 text-sm text-muted-foreground bg-muted/30 px-3 py-2 rounded-lg">
              <Timer className="h-4 w-4" />
              <span>Temps de traitement: <span className="font-mono font-medium text-foreground">{formatDuration(durationSeconds)}</span></span>
            </div>
            <div className="flex flex-col md:flex-row gap-2">
              <Button onClick={handleStartTreatment} className="gap-2 bg-emerald-600 hover:bg-emerald-700 cursor-pointer" disabled={startMutation.isPending}>
                {startMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                Remettre en traitement
              </Button>
<div className="flex items-center gap-2 "  >
                <Button onClick={handleValidate} className="w-1/2 gap-2 bg-emerald-600 hover:bg-emerald-700 cursor-pointer" disabled={validateMutation.isPending}>
                {validateMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                Valider
              </Button>
              <Button onClick={handleReject} variant="outline" className="w-1/2 gap-2 border-red-300 text-red-600 hover:bg-red-600 hover:text-white cursor-pointer" disabled={rejectMutation.isPending}>
                {rejectMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <X className="h-4 w-4 mr-2" />}
                Rejeter
              </Button>
</div>
            </div>
          </div>
        );
      }
      return (
        <div className="flex items-center gap-3">
          <Badge className="bg-yellow-100 text-yellow-700">En attente de validation</Badge>
          <span className="text-sm text-muted-foreground flex items-center gap-1">
            <Timer className="h-3 w-3" />
            {formatDuration(durationSeconds)}
          </span>
        </div>
      );
    }
    
    return null;
  };

  if (comparisonLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
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
          <Button onClick={refresh} variant="outline" className="mt-4 cursor-pointer">
            <RefreshCw className="h-4 w-4 mr-2" />
            Réessayer
          </Button>
        </div>
      </div>
    );
  }

  if (!feederId) return (
    <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
      Sélectionnez un départ dans le menu
    </div>
  );

  const isClickable = true;
  const isEditAllowed = isTreatmentActive && isTreatmentAllowed;

  return (
    <div className="w-full min-w-0 space-y-4 md:px-4 md:py-4 sm:px-6">

      {/* En-tête */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary shrink-0" />
              <h1 className="text-lg font-bold truncate sm:text-xl">{feederName}</h1>
            </div>
            {getStatusBadge()}
            {durationSeconds && feederStatus === "pending_validation" && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/30 px-2 py-1 rounded-full">
                <Timer className="h-3 w-3" />
                <span>Temps: {formatDuration(durationSeconds)}</span>
              </div>
            )}
            {assignedAgentName && feederStatus !== "collecting" && feederStatus !== "pending" && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/30 px-2 py-1 rounded-full">
                <User className="h-3 w-3" />
                <span>Assigné à: <span className="font-medium text-foreground">{assignedAgentName}</span></span>
              </div>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Traitement · <span className="font-medium text-foreground">{counts.all}</span> anomalie{counts.all > 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex flex-col md:flex-row gap-2 shrink-0">
          {renderActionButtons()}
          {feederStatus === "in_progress" && treatmentStartTimeBackend && (
            <TimerDisplay startTime={treatmentStartTimeBackend} />
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 sm:gap-3">
        {KPI_CONFIG.map((cfg) => {
          const count = counts[cfg.type];
          const isActive = activeFilter === cfg.type;
          const Icon = cfg.icon;
          
          let treatedN = 0;
          if (cfg.type !== "all" && cfg.type !== "ok") {
            treatedN = allAnomalies.filter((a) => a.type === cfg.type && treatment[a.id]?.treated).length;
          }
          
          return (
            <button key={cfg.type} onClick={() => setActiveFilter(isActive ? "all" : cfg.type)} disabled={count === 0}
              className={cn("flex flex-col gap-2 p-3 rounded-xl border text-left transition-all duration-200 active:scale-95 cursor-pointer",
                isActive ? cn(cfg.activeBg, cfg.activeBorder) : "bg-card border-border hover:border-border",
                count === 0 && "opacity-40 cursor-default pointer-events-none")}>
              <div className="flex items-center justify-between">
                <div className={cn("p-1.5 rounded-lg", cfg.bg)}><Icon className={cn("h-3.5 w-3.5", cfg.color)} /></div>
                {cfg.type !== "all" && cfg.type !== "ok" && count > 0 && (
                  <span className="text-[9px] text-muted-foreground">{treatedN}/{count}</span>
                )}
              </div>
              <div>
                <p className="text-2xl font-bold leading-none tabular-nums">{count}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{cfg.label}</p>
              </div>
              {cfg.type !== "all" && cfg.type !== "ok" && count > 0 && (
                <div className="w-full h-1 rounded-full bg-border overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${(treatedN / count) * 100}%` }} />
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

      {/* Carte Leaflet */}
      <div className="w-full rounded-xl overflow-hidden border border-border" style={{ height: "40vh", minHeight: 300 }}>
        <FullscreenMap 
          equipments={mapEquipments}
          onMarkerClick={handleMarkerClick}
          feederColor="#6366f1"
        />
      </div>

      {/* Équipements groupés */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {activeFilter === "all" ? `${counts.all} anomalies` : 
           activeFilter === "ok" ? `${counts.ok} équipements conformes` :
           `${counts[activeFilter]} anomalies de type ${KPI_CONFIG.find(k => k.type === activeFilter)?.label}`}
        </h2>

        {filteredTableGroups.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            <p className="text-sm">Aucune anomalie trouvée pour ce filtre</p>
          </div>
        )}

        {filteredTableGroups.map(({ table, anomalies }, idx) => (
          <TableGroup 
            key={table} 
            table={table} 
            anomalies={anomalies}
            filter={activeFilter}
            treatment={treatment}
            onFieldChange={handleFieldChange} 
            onMarkTreated={handleMarkTreated}
            onEquipmentClick={handleEquipmentClick} 
            defaultOpen={idx === 0}
            isClickable={isClickable}
            canProcess={isTreatmentActive && isTreatmentAllowed} 
          />
        ))}
      </div>

      {/* Sheet pour détails */}
      <EquipmentDetailSheet
        equipment={selectedEquipment}
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        onSave={handleEquipmentSave}
        treatment={treatment}
        onFieldChange={handleFieldChange}
        isTreatmentActive={isTreatmentActive}
        isTreatmentAllowed={isEditAllowed}
      />

      {/* Dialog assignation */}
      <AssignDialog
        isOpen={isAssignDialogOpen}
        onClose={() => setIsAssignDialogOpen(false)}
        onAssign={handleAssign}
        feederName={feederName}
        processingAgents={processingAgents}
        isAssigning={isAssigning}
        currentUser={user}
        isReassign={false}
      />

      {/* Dialog réassignation */}
      <AssignDialog
        isOpen={isReassignDialogOpen}
        onClose={() => setIsReassignDialogOpen(false)}
        onAssign={handleAssign}
        feederName={feederName}
        processingAgents={processingAgents}
        isAssigning={isAssigning}
        currentUser={user}
        isReassign={true}
      />
    </div>
  );
}
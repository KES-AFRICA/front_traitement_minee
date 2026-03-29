"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import { getAnomaliesByFeeder, AnomalyCase } from "@/lib/api/eneo-data";
import { formatDateTime, formatDateShort } from "@/lib/utils/date";
import {
  Copy, GitCompare, FilePlus, FileX, AlertCircle,
  CheckCircle2, ChevronRight, ChevronDown, Pencil,
  X, Check, Zap, Building2, Cable, Box, ToggleLeft,
  Layers, Info, MapPin, Save, UserCheck, Users, Filter,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import React from "react";
import { userService } from "@/lib/api/services/users";
import { User } from "@/lib/api/types";
import { layer1DB } from "@/data/layer1";
import { layer2DB } from "@/data/layer2";
import { EquipmentRecord } from "@/components/distribution/feeder-map";

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
type EquipmentFilter = "all" | "ok" | AnomalyType;

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

// ─── KPI Config avec ajout du filtre "Tous" et "OK" ───────────────────────────
const KPI_CONFIG = [
  { type: "all" as const, label: "Tous", icon: Filter, color: "text-slate-600 dark:text-slate-400", bg: "bg-slate-500/10", activeBg: "bg-slate-500/15", activeBorder: "border-slate-500/50" },
  { type: "ok" as const, label: "Conformes", icon: CheckCircle2, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10", activeBg: "bg-emerald-500/15", activeBorder: "border-emerald-500/50" },
  { type: "duplicate" as const, label: "Doublons", icon: Copy, color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-500/10", activeBg: "bg-purple-500/15", activeBorder: "border-purple-500/50" },
  { type: "divergence" as const, label: "Divergences", icon: GitCompare, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10", activeBg: "bg-amber-500/15", activeBorder: "border-amber-500/50" },
  { type: "new" as const, label: "Nouveaux", icon: FilePlus, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10", activeBg: "bg-emerald-500/15", activeBorder: "border-emerald-500/50" },
  { type: "missing" as const, label: "Manquants", icon: FileX, color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-500/10", activeBg: "bg-orange-500/15", activeBorder: "border-orange-500/50" },
  { type: "complex" as const, label: "Complexes", icon: AlertCircle, color: "text-red-600 dark:text-red-400", bg: "bg-red-500/10", activeBg: "bg-red-500/15", activeBorder: "border-red-500/50" },
] as const;

type FilterType = typeof KPI_CONFIG[number]['type'];

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

// ─── Dialog d'assignation (inchangé) ─────────────────────────────────────────
function AssignDialog({
  isOpen,
  onClose,
  onAssign,
  feederName,
  processingAgents,
  isAssigning,
}: {
  isOpen: boolean;
  onClose: () => void;
  onAssign: (agentId: string, agentName: string) => void;
  feederName: string;
  processingAgents: User[];
  isAssigning: boolean;
}) {
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
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
            Assigner un agent
          </DialogTitle>
          <DialogDescription>
            Assignez ce départ à un agent de traitement pour analyse des anomalies.
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
              <SelectTrigger id="agent" className="w-full">
                <SelectValue placeholder="Choisir un agent..." />
              </SelectTrigger>
              <SelectContent>
                {processingAgents.length === 0 ? (
                  <SelectItem value="none" disabled>
                    Aucun agent disponible
                  </SelectItem>
                ) : (
                  processingAgents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
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
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={isAssigning}>
            Annuler
          </Button>
          <Button
            onClick={handleAssign}
            disabled={isAssigning || !selectedAgentId || processingAgents.length === 0}
            className="flex-1 bg-purple-600 hover:bg-purple-700"
          >
            {isAssigning ? (
              <>
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Assignation...
              </>
            ) : (
              <>
                <UserCheck className="h-4 w-4 mr-2" />
                Assigner
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Sheet pour les détails d'équipement (inchangé, garder le code précédent) ───
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

  const allFields = useMemo(() => {
    if (!equipment) return [];
    return Object.keys(editedData)
      .filter(k => k !== "m_rid" && k !== "_anomalyType" && k !== "_anomalyId" && k !== "_table")
      .sort();
  }, [equipment, editedData]);

  useEffect(() => {
    if (equipment) {
      setEditedData({ ...equipment.data });
    }
  }, [equipment]);

  if (!equipment) return null;

  const Icon = TABLE_ICONS[equipment.table] || Box;
  const iconColor = "text-primary";

  const getFieldInputType = (field: string, value: unknown): "text" | "number" | "select" | "textarea" => {
    if (field === "active" || field === "is_injection" || field === "is_feederhead" || field === "normal_open" || field === "display_scada") {
      return "select";
    }
    if (field === "voltage" || field === "apparent_power" || field === "height" || 
        field === "w1_voltage" || field === "w2_voltage" || field === "highest_voltage_level" ||
        field === "latitude" || field === "longitude") {
      return "number";
    }
    if (field === "localisation" || field === "description" || field === "observation") {
      return "textarea";
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
          <div className="flex flex-col items-center justify-center py-6 border-b border-dashed border-border">
            <div className="w-24 h-24 rounded-full bg-muted/50 flex items-center justify-center mb-3">
              <Icon className="h-12 w-12 text-muted-foreground/50" />
            </div>
            <p className="text-xs text-muted-foreground text-center">
              {equipment.name}<br />
              <span className="text-[10px]">ID: {equipment.mrid}</span>
            </p>
          </div>

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
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Oui / Actif</SelectItem>
                        <SelectItem value="false">Non / Inactif</SelectItem>
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
                      className={cn("h-9 text-sm", isModified && "border-amber-500 focus-visible:ring-amber-500")}
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

          {equipment.anomalies.some(a => a.type === "divergence") && (
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-amber-600">
                Champs en divergence (BD1 vs BD2)
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
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <p className="text-muted-foreground mb-1">BD1 (Référence)</p>
                          <p className="font-mono p-2 rounded bg-muted/30 line-through text-muted-foreground">
                            {fv(field.layer1Value)}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground mb-1">BD2 (Terrain)</p>
                          {anomalyId ? (
                            <Input
                              value={currentValue}
                              onChange={(e) => onFieldChange(anomalyId, field.field, e.target.value)}
                              className="h-8 text-sm font-mono border-amber-500"
                            />
                          ) : (
                            <p className="font-mono p-2 rounded bg-amber-500/10 text-amber-600">
                              {fv(field.layer2Value)}
                            </p>
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

// ─── Carte d'équipement (pour les bons équipements) ───────────────────────────
function EquipmentCard({ equipment, onEquipmentClick }: {
  equipment: EquipmentDetail;
  onEquipmentClick?: (equipment: EquipmentDetail) => void;
}) {
  const Icon = TABLE_ICONS[equipment.table] || Box;
  const iconColor = "text-primary";
  
  const displayFields = ["name", "code", "type", "voltage", "active"].filter(f => equipment.data[f] !== undefined).slice(0, 3);

  return (
    <div 
      onClick={() => onEquipmentClick?.(equipment)}
      className="rounded-xl border border-border bg-card cursor-pointer hover:shadow-md hover:border-primary/50 transition-all"
    >
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/40">
        <Icon className={cn("h-3.5 w-3.5 shrink-0", iconColor)} />
        <span className="text-xs font-semibold truncate flex-1">{equipment.name}</span>
        <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">
          <CheckCircle2 className="h-2.5 w-2.5 mr-1" />
          OK
        </Badge>
      </div>
      <div className="p-2">
        <div className="grid grid-cols-2 gap-1 text-[11px]">
          {displayFields.map((field) => (
            <div key={field}>
              <span className="text-muted-foreground">{fl(field)}</span>
              <p className="font-mono truncate">{fv(equipment.data[field])}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
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
  const keys = useMemo(() => {
    const s = new Set<string>();
    if (rec1) Object.keys(rec1).forEach(k => s.add(k));
    if (rec2) Object.keys(rec2).forEach(k => s.add(k));
    return Array.from(s).filter(k => k !== "m_rid").sort();
  }, [rec1, rec2]);

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
      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 border-b border-border/40">
        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="text-xs font-semibold truncate flex-1">{TABLE_LABELS[anomaly.table] || anomaly.table} — {recTitle(rec2 ?? rec1)}</span>
        <span className="text-[10px] font-mono text-muted-foreground">{anomaly.mrid}</span>
        <AnomalyBadge type={anomaly.type} />
        {isTreated && (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600">
            <CheckCircle2 className="h-2.5 w-2.5" />Traité
          </span>
        )}
      </div>
      <div className="p-3">
        <div className="grid grid-cols-2 gap-2 text-xs">
          {keys.slice(0, 4).map((k) => (
            <div key={k}>
              <span className="text-muted-foreground">{fl(k)}</span>
              <p className="font-mono truncate">{fv(rec2?.[k] ?? rec1?.[k])}</p>
            </div>
          ))}
        </div>
        {!isTreated && (
          <div className="flex justify-end pt-2 mt-2 border-t border-border/40">
            <button 
              onClick={(e) => { e.stopPropagation(); onMarkTreated(anomaly.id); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Check className="h-3.5 w-3.5" />Marquer traité
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Groupe par table avec filtrage amélioré ─────────────────────────────────
function TableGroup({ table, allAnomalies, allGoodEquipments, filter, treatment, onFieldChange, onMarkTreated, onEquipmentClick, defaultOpen }: {
  table: string; 
  allAnomalies: AnomalyCase[]; 
  allGoodEquipments: EquipmentDetail[];
  filter: FilterType;
  treatment: TreatmentState;
  onFieldChange: (id: string, field: string, val: string) => void;
  onMarkTreated: (id: string) => void;
  onEquipmentClick?: (equipment: EquipmentDetail) => void;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const Icon = TABLE_ICONS[table] || Box;
  
  // Filtrer les anomalies selon le filtre actif
  const filteredAnomalies = useMemo(() => {
    if (filter === "all") return allAnomalies;
    if (filter === "ok") return [];
    return allAnomalies.filter((a) => a.type === filter);
  }, [allAnomalies, filter]);
  
  // Filtrer les bons équipements selon le filtre actif
  const filteredGoodEquipments = useMemo(() => {
    if (filter === "all") return allGoodEquipments;
    if (filter === "ok") return allGoodEquipments;
    return [];
  }, [allGoodEquipments, filter]);
  
  const treatedCount = filteredAnomalies.filter((a) => treatment[a.id]?.treated).length;
  const allDone = treatedCount === filteredAnomalies.length && filteredAnomalies.length > 0;
  const totalCount = filteredAnomalies.length + filteredGoodEquipments.length;
  
  // Ne pas afficher le groupe si aucun élément après filtrage
  if (totalCount === 0) return null;

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <button onClick={() => setOpen((p) => !p)}
        className="flex w-full items-center gap-2.5 px-4 py-3 bg-muted/20 hover:bg-muted/40 transition-colors text-left">
        {open ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
        <Icon className="h-4 w-4 shrink-0 text-primary" />
        <span className="font-medium text-sm flex-1">{TABLE_LABELS[table] || table}</span>
        <span className="text-xs text-muted-foreground">
          {filteredGoodEquipments.length} OK • {filteredAnomalies.length} anomalie{filteredAnomalies.length > 1 ? "s" : ""}
        </span>
        {allDone && filteredAnomalies.length > 0 && <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />}
      </button>
      {open && (
        <div className="p-3 space-y-3">
          {/* Équipements avec anomalies filtrés */}
          {filteredAnomalies.map((a) => (
            <AnomalyCard 
              key={a.id} 
              anomaly={a} 
              treatment={treatment}
              onFieldChange={onFieldChange} 
              onMarkTreated={onMarkTreated}
              onEquipmentClick={onEquipmentClick}
            />
          ))}
          
          {/* Équipements bons filtrés */}
          {filteredGoodEquipments.map((eq) => (
            <EquipmentCard key={eq.id} equipment={eq} onEquipmentClick={onEquipmentClick} />
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

  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [treatment, setTreatment] = useState<TreatmentState>({});
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentDetail | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [processingAgents, setProcessingAgents] = useState<User[]>([]);
  const [isAssigning, setIsAssigning] = useState(false);

  // Récupérer tous les équipements du feeder
  const { allAnomalies, allEquipments, goodEquipmentsByTable, anomaliesByTable } = useMemo(() => {
    // Récupérer les anomalies
    const anomalies = getAnomaliesByFeeder(feederId);
    
    // Construire tous les équipements du feeder depuis layer1 et layer2
    const equipmentMap = new Map<string, EquipmentDetail>();
    
    // Fonction pour ajouter un équipement
    const addEquipment = (record: Record<string, any>, table: string, anomaly?: AnomalyCase) => {
      if (!record) return;
      const id = String(record.m_rid);
      if (!equipmentMap.has(id)) {
        equipmentMap.set(id, {
          id,
          mrid: record.m_rid,
          table: table,
          name: recTitle(record),
          data: { ...record },
          anomalies: anomaly ? [anomaly] : [],
          location: (record.latitude && record.longitude) ? {
            lat: parseFloat(String(record.latitude)),
            lng: parseFloat(String(record.longitude)),
          } : undefined,
        });
      } else {
        const existing = equipmentMap.get(id)!;
        existing.data = { ...existing.data, ...record };
        if (anomaly && !existing.anomalies.some(a => a.id === anomaly.id)) {
          existing.anomalies.push(anomaly);
        }
        if (!existing.location && record.latitude && record.longitude) {
          existing.location = {
            lat: parseFloat(String(record.latitude)),
            lng: parseFloat(String(record.longitude)),
          };
        }
      }
    };
    
    // Ajouter les équipements des anomalies
    anomalies.forEach(anomaly => {
      if (anomaly.layer2Record) {
        addEquipment(anomaly.layer2Record, anomaly.table, anomaly);
      }
      if (anomaly.layer1Record && !anomaly.layer2Record) {
        addEquipment(anomaly.layer1Record, anomaly.table, anomaly);
      }
    });
    
    // Ajouter les équipements de layer2DB pour les bons équipements (sans anomalies)
    const tables = ["substation", "powertransformer", "busbar", "bay", "switch", "wire"];
    tables.forEach(table => {
      const layer2Records = (layer2DB as any)[table] || [];
      layer2Records.forEach((record: any) => {
        if (String(record.feeder_id) === feederId) {
          const id = String(record.m_rid);
          if (!equipmentMap.has(id)) {
            addEquipment(record, table);
          }
        }
      });
    });
    
    // Ajouter les équipements de layer1DB pour les manquants
    tables.forEach(table => {
      const layer1Records = (layer1DB as any)[table] || [];
      layer1Records.forEach((record: any) => {
        if (String(record.feeder_id) === feederId) {
          const id = String(record.m_rid);
          if (!equipmentMap.has(id)) {
            addEquipment(record, table);
          }
        }
      });
    });
    
    const equipments = Array.from(equipmentMap.values());
    
    // Séparer par table
    const byTable = new Map<string, { anomalies: AnomalyCase[]; goods: EquipmentDetail[] }>();
    equipments.forEach(eq => {
      if (!byTable.has(eq.table)) {
        byTable.set(eq.table, { anomalies: [], goods: [] });
      }
      if (eq.anomalies.length > 0) {
        byTable.get(eq.table)!.anomalies.push(...eq.anomalies);
      } else {
        byTable.get(eq.table)!.goods.push(eq);
      }
    });
    
    return {
      allAnomalies: anomalies,
      allEquipments: equipments,
      anomaliesByTable: byTable,
      goodEquipmentsByTable: byTable,
    };
  }, [feederId]);

  // Calcul des comptes pour les KPI
  const counts = useMemo(() => {
    const result: Record<FilterType, number> = {
      all: allEquipments.length,
      ok: allEquipments.filter(eq => eq.anomalies.length === 0).length,
      duplicate: allAnomalies.filter(a => a.type === "duplicate").length,
      divergence: allAnomalies.filter(a => a.type === "divergence").length,
      new: allAnomalies.filter(a => a.type === "new").length,
      missing: allAnomalies.filter(a => a.type === "missing").length,
      complex: allAnomalies.filter(a => a.type === "complex").length,
    };
    return result;
  }, [allEquipments, allAnomalies]);

  // Points carte - TOUS les équipements de layer2DB géolocalisés du départ
  const mapPoints = useMemo(() => {
    const points: EquipmentRecord[] = [];
    
    const tables = ["substation", "powertransformer", "busbar", "bay", "switch", "wire", "pole", "node"];
    
    tables.forEach(table => {
      const layer2Records = (layer2DB as any)[table] || [];
      layer2Records.forEach((record: any) => {
        if (String(record.feeder_id) === feederId) {
          const lat = parseFloat(String(record.latitude ?? ""));
          const lng = parseFloat(String(record.longitude ?? ""));
          
          if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
            const anomaly = allAnomalies.find(a => String(a.mrid) === String(record.m_rid));
            
            points.push({
              ...record,
              table,
              _anomalyType: anomaly?.type,
              _anomalyId: anomaly?.id,
              _hasAnomaly: !!anomaly,
            });
          }
        }
      });
    });
    
    return points;
  }, [feederId, allAnomalies]);

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
    console.log("Sauvegarde équipement:", equipment.id, updatedData);
    toast.success(`${equipment.name} sauvegardé`);
  }, []);

  const handleMapMarkerClick = useCallback((equipment: any) => {
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

  const fetchProcessingAgents = async () => {
    try {
      const response = await userService.getUsers({ role: "processing_agent" }, { pageSize: 100 });
      if (response.data) {
        setProcessingAgents(response.data.data);
      }
    } catch (error) {
      console.error("Failed to fetch processing agents:", error);
      toast.error("Impossible de charger la liste des agents");
    }
  };

  const handleOpenAssignDialog = async () => {
    await fetchProcessingAgents();
    setIsAssignDialogOpen(true);
  };

  const handleAssign = async (agentId: string, agentName: string) => {
    setIsAssigning(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      toast.success(`Départ ${feederName} assigné à ${agentName}`);
      setIsAssignDialogOpen(false);
    } catch (error) {
      toast.error("Erreur lors de l'assignation");
    } finally {
      setIsAssigning(false);
    }
  };

  const allTreated = useMemo(
    () => allAnomalies.length > 0 && allAnomalies.every((a) => treatment[a.id]?.treated),
    [allAnomalies, treatment]
  );

  if (!feederId) return (
    <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
      Sélectionnez un départ dans le menu
    </div>
  );

  // Filtrer les groupes par table selon le filtre actif
  const filteredTableGroups = useMemo(() => {
    return Array.from(anomaliesByTable.entries()).map(([table, { anomalies, goods }]) => ({
      table,
      anomalies,
      goods,
      hasContent: activeFilter === "all" 
        ? (anomalies.length + goods.length) > 0
        : activeFilter === "ok"
          ? goods.length > 0
          : anomalies.filter(a => a.type === activeFilter).length > 0
    })).filter(group => group.hasContent);
  }, [anomaliesByTable, activeFilter]);

  return (
    <div className="w-full min-w-0 space-y-4 md:px-4 md:py-4 sm:px-6">

      {/* En-tête avec bouton assigner */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary shrink-0" />
            <h1 className="text-lg font-bold truncate sm:text-xl">{feederName}</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Traitement · <span className="font-medium text-foreground">{allEquipments.length}</span> équipements ·{" "}
            <span className="font-medium text-foreground">{allAnomalies.length}</span> anomalie{allAnomalies.length > 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" onClick={handleOpenAssignDialog} className="gap-2">
            <UserCheck className="h-4 w-4" />
            Assigner un agent
          </Button>
          {allTreated && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span className="text-sm font-semibold text-emerald-600">Prêt pour la validation</span>
            </div>
          )}
        </div>
      </div>

      {/* KPI Cards avec filtres */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 sm:gap-3">
        {KPI_CONFIG.map((cfg) => {
          const count = counts[cfg.type];
          const isActive = activeFilter === cfg.type;
          const Icon = cfg.icon;
          
          // Calculer le nombre traités pour les types d'anomalies
          let treatedN = 0;
          if (cfg.type !== "all" && cfg.type !== "ok") {
            treatedN = allAnomalies.filter((a) => a.type === cfg.type && treatment[a.id]?.treated).length;
          }
          
          return (
            <button key={cfg.type} onClick={() => setActiveFilter(isActive ? "all" : cfg.type)} disabled={count === 0}
              className={cn("flex flex-col gap-2 p-3 rounded-xl border text-left transition-all duration-200 active:scale-95",
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
          <button onClick={() => setActiveFilter("all")} className="text-primary hover:underline">Tout voir</button>
        </div>
      )}

      {/* Carte Leaflet */}
      <div className="w-full rounded-xl overflow-hidden border border-border" style={{ height: "30vh", minHeight: 160 }}>
        <FeederMap 
          equipments={mapPoints} 
          feederId={feederId} 
          onMarkerClick={handleMapMarkerClick}
        />
      </div>

      {/* Équipements groupés par table avec filtrage */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {activeFilter === "all" ? `${allEquipments.length} équipements` :
           activeFilter === "ok" ? `${counts.ok} équipements conformes` :
           `${counts[activeFilter]} anomalies de type ${KPI_CONFIG.find(k => k.type === activeFilter)?.label}`}
        </h2>

        {filteredTableGroups.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
            <Box className="h-8 w-8 opacity-50" />
            <p className="text-sm">Aucun équipement trouvé pour ce filtre</p>
          </div>
        )}

        {filteredTableGroups.map(({ table, anomalies, goods }, idx) => (
          <TableGroup 
            key={table} 
            table={table} 
            allAnomalies={anomalies}
            allGoodEquipments={goods}
            filter={activeFilter}
            treatment={treatment}
            onFieldChange={handleFieldChange} 
            onMarkTreated={handleMarkTreated}
            onEquipmentClick={handleEquipmentClick} 
            defaultOpen={idx === 0} 
          />
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

      {/* Dialog d'assignation */}
      <AssignDialog
        isOpen={isAssignDialogOpen}
        onClose={() => setIsAssignDialogOpen(false)}
        onAssign={handleAssign}
        feederName={feederName}
        processingAgents={processingAgents}
        isAssigning={isAssigning}
      />
    </div>
  );
}
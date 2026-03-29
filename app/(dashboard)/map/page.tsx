"use client";

import { useState, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import {
  Zap, Building2, Cable, Box, ToggleLeft, Layers,
  MapPin, Calendar, Filter, Search, ChevronDown,
  Database, Map as MapIcon, XCircle, RefreshCw
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { layer2DB } from "@/data/layer2";

// ─── Leaflet client-only ──────────────────────────────────────────────────────
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

// ─── Types ────────────────────────────────────────────────────────────────────
interface EquipmentDetail {
  id: string;
  mrid: string | number;
  table: string;
  name: string;
  data: Record<string, unknown>;
  location?: { lat: number; lng: number };
}

// ─── Types d'équipements disponibles dans layer2DB ───────────────────────────
const EQUIPMENT_TABLES = [
  { id: "substation", label: "Substations", icon: Building2, color: "text-blue-500" },
  { id: "powertransformer", label: "Transformateurs", icon: Zap, color: "text-purple-500" },
  { id: "busbar", label: "Bus Bars", icon: Layers, color: "text-amber-500" },
  { id: "bay", label: "Bay", icon: Box, color: "text-emerald-500" },
  { id: "switch", label: "Switches", icon: ToggleLeft, color: "text-orange-500" },
  { id: "wire", label: "Wires", icon: Cable, color: "text-slate-500" },
  { id: "feeder", label: "Feeders", icon: Zap, color: "text-primary" },
  { id: "pole", label: "Poteaux", icon: Box, color: "text-stone-500" },
  { id: "node", label: "Nœuds", icon: Box, color: "text-gray-500" },
];

// ─── Découpage ENEO ──────────────────────────────────────────────────────────
const EXPLOITATIONS = [
  { id: "DLAO", label: "Douala Ouest" },
  { id: "DLAE", label: "Douala Est" },
  { id: "YDE", label: "Yaoundé Est" },
  { id: "YDO", label: "Yaoundé Ouest" },
  { id: "GAR", label: "Garoua" },
  { id: "BER", label: "Bertoua" },
  { id: "BAM", label: "Bamenda" },
];

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

// ─── Carte d'équipement pour les détails ─────────────────────────────────────
const TABLE_ICONS: Record<string, React.ElementType> = {
  substation: Building2, powertransformer: Zap, busbar: Layers,
  bay: Box, switch: ToggleLeft, wire: Cable, feeder: Zap, pole: Box, node: Box,
};
const TABLE_LABELS: Record<string, string> = {
  substation: "Substation", powertransformer: "Transformateur", busbar: "Bus Bar",
  bay: "Bay", switch: "Switch", wire: "Wire", feeder: "Feeder", pole: "Poteau", node: "Nœud",
};

// ─── Sheet pour les détails d'équipement ─────────────────────────────────────
function EquipmentDetailSheet({
  equipment,
  isOpen,
  onClose,
}: {
  equipment: EquipmentDetail | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!equipment) return null;

  const Icon = TABLE_ICONS[equipment.table] || Box;
  const iconColor = "text-primary";

  const fields = Object.keys(equipment.data)
    .filter(k => k !== "m_rid" && k !== "latitude" && k !== "longitude")
    .sort();

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
            <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
              <Database className="h-3 w-3 text-blue-500" />
              <span>Source: BD1 (Référence)</span>
            </div>
          </div>

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
            
            <div className="grid grid-cols-1 gap-3">
              {fields.map((field) => {
                const value = equipment.data[field];
                if (value === undefined) return null;
                
                return (
                  <div key={field} className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      {fl(field)}
                    </Label>
                    <div className="p-2 rounded-md bg-muted/20 text-sm font-mono break-all">
                      {fv(value)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
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

// ─── Page principale ─────────────────────────────────────────────────────────
export default function MapPage() {
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentDetail | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  
  // Filtres
  const [selectedTable, setSelectedTable] = useState<string>("all");
  const [selectedExploitation, setSelectedExploitation] = useState<string>("all");
  const [dateRange, setDateRange] = useState<{ from: Date | null; to: Date | null }>({
    from: null,
    to: null,
  });
  const [searchQuery, setSearchQuery] = useState("");

  // Récupérer tous les équipements géolocalisés de layer2DB
  const allEquipments = useMemo(() => {
    const equipments: EquipmentDetail[] = [];
    const tables = ["substation", "powertransformer", "busbar", "bay", "switch", "wire", "feeder", "pole", "node"];
    
    tables.forEach(table => {
      const records = (layer2DB as any)[table];
      if (records && Array.isArray(records)) {
        records.forEach((record: any) => {
          const lat = parseFloat(String(record.latitude ?? ""));
          const lng = parseFloat(String(record.longitude ?? ""));
          
          if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
            equipments.push({
              id: String(record.m_rid),
              mrid: record.m_rid,
              table: table,
              name: String(record.name || record.local_name || record.code || record.m_rid || "—"),
              data: { ...record },
              location: { lat, lng },
            });
          }
        });
      }
    });
    
    return equipments;
  }, []);

  // Filtrer les équipements
  const filteredEquipments = useMemo(() => {
    return allEquipments.filter(eq => {
      // Filtre par type d'équipement
      if (selectedTable !== "all" && eq.table !== selectedTable) {
        return false;
      }
      
      // Filtre par exploitation
      if (selectedExploitation !== "all") {
        const exploitation = eq.data.exploitation as string;
        if (!exploitation || exploitation !== selectedExploitation) {
          return false;
        }
      }
      
      // Filtre par date de création
      if (dateRange.from || dateRange.to) {
        const createdDate = eq.data.created_date as string;
        if (createdDate) {
          const date = new Date(createdDate);
          if (dateRange.from && date < dateRange.from) return false;
          if (dateRange.to && date > dateRange.to) return false;
        } else if (dateRange.from || dateRange.to) {
          return false;
        }
      }
      
      // Filtre par recherche textuelle
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const nameMatch = eq.name.toLowerCase().includes(query);
        const idMatch = String(eq.mrid).toLowerCase().includes(query);
        if (!nameMatch && !idMatch) return false;
      }
      
      return true;
    });
  }, [allEquipments, selectedTable, selectedExploitation, dateRange, searchQuery]);

  // Points pour la carte
  const mapPoints = useMemo(() => {
    return filteredEquipments.map(eq => ({
      m_rid: eq.mrid,
      name: eq.name,
      latitude: eq.location?.lat,
      longitude: eq.location?.lng,
      table: eq.table,
      ...eq.data,
    }));
  }, [filteredEquipments]);

  const handleEquipmentClick = useCallback((equipment: any) => {
    const equipmentDetail: EquipmentDetail = {
      id: String(equipment.m_rid),
      mrid: equipment.m_rid,
      table: equipment.table || "substation",
      name: equipment.name || String(equipment.m_rid),
      data: equipment,
      location: equipment.latitude && equipment.longitude ? {
        lat: parseFloat(String(equipment.latitude)),
        lng: parseFloat(String(equipment.longitude)),
      } : undefined,
    };
    setSelectedEquipment(equipmentDetail);
    setIsSheetOpen(true);
  }, []);

  // Statistiques
  const stats = useMemo(() => {
    const total = allEquipments.length;
    const filtered = filteredEquipments.length;
    return { total, filtered };
  }, [allEquipments, filteredEquipments]);

  // Réinitialiser les filtres
  const resetFilters = () => {
    setSelectedTable("all");
    setSelectedExploitation("all");
    setDateRange({ from: null, to: null });
    setSearchQuery("");
  };

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden">
      {/* Barre d'outils */}
      <div className="flex-shrink-0 bg-background border-b px-4 py-2 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <MapIcon className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold">Carte des équipements ENEO</h1>
          <Badge variant="secondary" className="ml-2">
            {stats.filtered} / {stats.total} équipements
          </Badge>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFiltersOpen(!filtersOpen)}
            className="gap-2"
          >
            <Filter className="h-4 w-4" />
            Filtres
            <ChevronDown className={cn("h-3 w-3 transition-transform", filtersOpen && "rotate-180")} />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={resetFilters}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Réinitialiser
          </Button>
        </div>
      </div>

      {/* Panneau de filtres */}
      <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen} className="flex-shrink-0">
        <CollapsibleContent>
          <div className="bg-muted/30 border-b p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Recherche */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider">
                  <Search className="h-3 w-3 inline mr-1" />
                  Recherche
                </Label>
                <Input
                  placeholder="Nom ou ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9"
                />
              </div>

              {/* Type d'équipement */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider">Type d'équipement</Label>
                <Select value={selectedTable} onValueChange={setSelectedTable}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Tous" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous</SelectItem>
                    {EQUIPMENT_TABLES.map(table => (
                      <SelectItem key={table.id} value={table.id}>
                        <div className="flex items-center gap-2">
                          <table.icon className={cn("h-3.5 w-3.5", table.color)} />
                          {table.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Exploitation */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider">Exploitation</Label>
                <Select value={selectedExploitation} onValueChange={setSelectedExploitation}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Toutes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes</SelectItem>
                    {EXPLOITATIONS.map(exp => (
                      <SelectItem key={exp.id} value={exp.id}>{exp.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date de création */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider">
                  <Calendar className="h-3 w-3 inline mr-1" />
                  Créé entre
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="h-9 w-full justify-start text-left font-normal">
                      {dateRange.from ? (
                        dateRange.to ? (
                          <>
                            {format(dateRange.from, "dd/MM/yyyy", { locale: fr })} - {format(dateRange.to, "dd/MM/yyyy", { locale: fr })}
                          </>
                        ) : (
                          format(dateRange.from, "dd/MM/yyyy", { locale: fr })
                        )
                      ) : (
                        <span>Sélectionner une période</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="range"
                      selected={{ from: dateRange.from || undefined, to: dateRange.to || undefined }}
                      onSelect={(range) => setDateRange({ from: range?.from || null, to: range?.to || null })}
                      locale={fr}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Résumé des filtres actifs */}
            {(selectedTable !== "all" || selectedExploitation !== "all" || dateRange.from || searchQuery) && (
              <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t">
                <span className="text-xs text-muted-foreground">Filtres actifs :</span>
                {selectedTable !== "all" && (
                  <Badge variant="secondary" className="text-xs">
                    {EQUIPMENT_TABLES.find(t => t.id === selectedTable)?.label}
                    <XCircle className="h-3 w-3 ml-1 cursor-pointer" onClick={() => setSelectedTable("all")} />
                  </Badge>
                )}
                {selectedExploitation !== "all" && (
                  <Badge variant="secondary" className="text-xs">
                    {EXPLOITATIONS.find(e => e.id === selectedExploitation)?.label}
                    <XCircle className="h-3 w-3 ml-1 cursor-pointer" onClick={() => setSelectedExploitation("all")} />
                  </Badge>
                )}
                {(dateRange.from || dateRange.to) && (
                  <Badge variant="secondary" className="text-xs">
                    {dateRange.from && format(dateRange.from, "dd/MM/yyyy")}
                    {dateRange.to && ` - ${format(dateRange.to, "dd/MM/yyyy")}`}
                    <XCircle className="h-3 w-3 ml-1 cursor-pointer" onClick={() => setDateRange({ from: null, to: null })} />
                  </Badge>
                )}
                {searchQuery && (
                  <Badge variant="secondary" className="text-xs">
                    Recherche: {searchQuery}
                    <XCircle className="h-3 w-3 ml-1 cursor-pointer" onClick={() => setSearchQuery("")} />
                  </Badge>
                )}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Carte plein écran */}
      <div className="flex-1 min-h-0 relative">
        <FullscreenMap
          equipments={mapPoints}
          onMarkerClick={handleEquipmentClick}
        />
      </div>

      {/* Sheet des détails */}
      <EquipmentDetailSheet
        equipment={selectedEquipment}
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
      />
    </div>
  );
}
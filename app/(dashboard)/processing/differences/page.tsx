"use client";

import { useState, useMemo } from "react";
import { useI18n } from "@/lib/i18n/context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { RegionCard } from "@/components/complex-cases/region-card";
import { ZoneCard } from "@/components/complex-cases/zone-card";
import { DepartureCard } from "@/components/complex-cases/departure-card";
import { PeriodFilter, PeriodType } from "@/components/complex-cases/period-filter";
import { GlobalStatsCards } from "@/components/complex-cases/global-stats-cards";
import { NavigationBreadcrumb, BreadcrumbItem } from "@/components/complex-cases/navigation-breadcrumb";
import { GitCompare, Search, CheckCircle, XCircle, Eye } from "lucide-react";
import { toast } from "sonner";
import { 
  eneoRegions, 
  getAnomaliesByFeeder, 
  getComparisonStats,
  EneoRegion, 
  EneoZone, 
  EneoDeparture,
  AnomalyCase,
  DivergentField
} from "@/lib/api/eneo-data";

// Types pour les divergences
type DivergenceSeverity = "critical" | "high" | "medium" | "low";
type DivergenceStatus = "pending" | "analyzing" | "resolved" | "ignored";

// Interface pour une divergence enrichie avec les données de comparaison
interface Divergence {
  id: string;
  code: string;
  type: string;
  table: string;
  description: string;
  severity: DivergenceSeverity;
  status: DivergenceStatus;
  detectedAt: string;
  assignedTo?: string;
  departureCode?: string;
  // Données de comparaison
  layer1Record: Record<string, unknown> | null;
  layer2Record: Record<string, unknown> | null;
  divergentFields: DivergentField[];
  mrid: string | number;
}

type ViewLevel = "regions" | "zones" | "departures" | "divergences";

// Calculer la sévérité en fonction du nombre et du type de champs divergents
function calculateSeverity(divergentFields: DivergentField[], table: string): DivergenceSeverity {
  const criticalFields = ["voltage", "apparent_power", "type", "phase", "active"];
  
  const criticalCount = divergentFields.filter(f => 
    criticalFields.includes(f.field) || 
    f.field.includes("voltage") || 
    f.field.includes("power")
  ).length;
  
  if (criticalCount >= 2) return "critical";
  if (criticalCount >= 1 || divergentFields.length >= 5) return "high";
  if (divergentFields.length >= 3) return "medium";
  return "low";
}

// Convertir une anomalie de type "divergence" en Divergence
function convertAnomalyToDivergence(anomaly: AnomalyCase): Divergence | null {
  if (anomaly.type !== "divergence" || !anomaly.divergentFields) return null;
  
  const fieldDescriptions = anomaly.divergentFields.map(f => {
    const oldVal = formatValueForDisplay(f.layer1Value);
    const newVal = formatValueForDisplay(f.layer2Value);
    return `${getFieldLabel(f.field)}: "${oldVal}" → "${newVal}"`;
  });
  
  const description = `${fieldDescriptions.length} différence(s) détectée(s) : ${fieldDescriptions.join(", ")}`;
  
  const recordName = anomaly.layer1Record?.name || anomaly.layer2Record?.name || anomaly.mrid.toString();
  const code = `${anomaly.table.toUpperCase()}-${recordName}`;
  const severity = calculateSeverity(anomaly.divergentFields, anomaly.table);
  
  return {
    id: anomaly.id,
    code: code.substring(0, 50),
    type: getEquipmentTypeLabel(anomaly.table),
    table: anomaly.table,
    description: description.substring(0, 200),
    severity,
    status: "pending",
    detectedAt: new Date().toISOString().split('T')[0],
    assignedTo: undefined,
    departureCode: anomaly.feederName,
    layer1Record: anomaly.layer1Record,
    layer2Record: anomaly.layer2Record,
    divergentFields: anomaly.divergentFields,
    mrid: anomaly.mrid,
  };
}

// Formater une valeur pour l'affichage
function formatValueForDisplay(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Oui" : "Non";
  if (value instanceof Date) return value.toLocaleString();
  if (typeof value === "object") return JSON.stringify(value).substring(0, 50);
  return String(value).substring(0, 30);
}

// Obtenir le libellé d'un champ
function getFieldLabel(field: string): string {
  const labels: Record<string, string> = {
    name: "Nom",
    code: "Code",
    active: "Actif",
    type: "Type",
    voltage: "Tension (kV)",
    phase: "Phase",
    highest_voltage_level: "Niveau tension max",
    exploitation: "Exploitation",
    localisation: "Localisation",
    regime: "Régime",
    zone_type: "Type de zone",
    apparent_power: "Puissance (kVA)",
    w1_voltage: "Tension primaire",
    w2_voltage: "Tension secondaire",
    nature: "Nature",
    normal_open: "Normalement ouvert",
    height: "Hauteur (m)",
    installation_date: "Date installation",
    lastvisit_date: "Dernière visite",
  };
  return labels[field] || field;
}

// Obtenir le libellé du type d'équipement
function getEquipmentTypeLabel(table: string): string {
  const labels: Record<string, string> = {
    substation: "Poste source",
    powertransformer: "Transformateur",
    busbar: "Jeu de barres",
    bay: "Cellule",
    switch: "Organe de coupure",
    wire: "Câble",
    pole: "Poteau",
    node: "Nœud réseau",
    feeder: "Départ",
  };
  return labels[table] || table;
}

// Composant pour comparer les deux enregistrements côte à côte
function ComparisonView({ 
  divergence, 
  onAccept, 
  onReject, 
  onIgnore 
}: { 
  divergence: Divergence;
  onAccept: () => void;
  onReject: () => void;
  onIgnore: () => void;
}) {
  const [selectedAction, setSelectedAction] = useState<"accept" | "reject" | null>(null);
  
  if (!divergence.layer1Record || !divergence.layer2Record) return null;
  
  const allFields = new Set([
    ...Object.keys(divergence.layer1Record).filter(k => k !== "m_rid"),
    ...Object.keys(divergence.layer2Record).filter(k => k !== "m_rid")
  ]);
  
  const divergentFieldSet = new Set(divergence.divergentFields.map(f => f.field));
  const fieldsList = Array.from(allFields).sort();
  
  return (
    <div className="space-y-6">
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-orange-800">Divergence détectée</h3>
            <p className="text-sm text-orange-600 mt-1">
              Les données de collecte terrain ne correspondent pas à la référence
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedAction("accept")}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                selectedAction === "accept" 
                  ? "bg-green-600 text-white" 
                  : "bg-green-100 text-green-700 hover:bg-green-200"
              }`}
            >
              <CheckCircle className="h-4 w-4" />
              Accepter terrain
            </button>
            <button
              onClick={() => setSelectedAction("reject")}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                selectedAction === "reject" 
                  ? "bg-blue-600 text-white" 
                  : "bg-blue-100 text-blue-700 hover:bg-blue-200"
              }`}
            >
              <CheckCircle className="h-4 w-4" />
              Garder référence
            </button>
            <button
              onClick={onIgnore}
              className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 flex items-center gap-2"
            >
              <XCircle className="h-4 w-4" />
              Ignorer
            </button>
          </div>
        </div>
        
        {selectedAction && (
          <div className="mt-4 pt-4 border-t border-orange-200">
            <p className="text-sm text-gray-600 mb-3">
              {selectedAction === "accept" 
                ? "Les données de collecte terrain remplaceront les données de référence." 
                : "Les données de référence seront conservées, les données terrain seront ignorées pour ce champ."}
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={selectedAction === "accept" ? onAccept : onReject}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Confirmer
              </button>
              <button
                onClick={() => setSelectedAction(null)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Annuler
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
        <div className="font-bold text-black uppercase">
          <span>Type équipement:</span> {divergence.type}
        </div>
        <div>
          <span className="font-medium">ID technique:</span> {divergence.mrid}
        </div>
        {divergence.departureCode && (
          <div>
            <span className="font-medium">Départ:</span> {divergence.departureCode}
          </div>
        )}
      </div>
      
      <div className="border rounded-lg overflow-hidden">
        <div className="grid grid-cols-3 bg-muted/50 border-b">
          <div className="p-3 font-medium">Champ</div>
          <div className="p-3 font-medium border-l">BD1 - Référence</div>
          <div className="p-3 font-medium border-l">BD2 - Collecte terrain</div>
        </div>
        
        {fieldsList.map(field => {
          const value1 = divergence.layer1Record?.[field];
          const value2 = divergence.layer2Record?.[field];
          const isDivergent = divergentFieldSet.has(field);
          const formatted1 = formatValueForDisplay(value1);
          const formatted2 = formatValueForDisplay(value2);
          
          return (
            <div key={field} className={`grid grid-cols-3 border-b ${isDivergent ? 'bg-yellow-50' : ''}`}>
              <div className="p-3 text-sm font-medium">
                {getFieldLabel(field)}
                {isDivergent && (
                  <span className="ml-2 text-xs bg-yellow-200 text-yellow-800 px-1 rounded">
                    divergent
                  </span>
                )}
              </div>
              <div className={`p-3 text-sm border-l ${isDivergent ? 'line-through text-muted-foreground' : ''}`}>
                {formatted1}
              </div>
              <div className={`p-3 text-sm border-l font-mono ${isDivergent ? 'bg-yellow-100 font-medium' : ''}`}>
                {formatted2}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Composant principal de la table des divergences
function DivergenceTable({ 
  divergences, 
  onView, 
  onAccept, 
  onReject, 
  onIgnore,
  onBulkAction 
}: { 
  divergences: Divergence[];
  onView: (divergence: Divergence) => void;
  onAccept: (divergence: Divergence) => void;
  onReject: (divergence: Divergence) => void;
  onIgnore: (divergence: Divergence) => void;
  onBulkAction: (ids: string[], action: string) => void;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  const getSeverityColor = (severity: DivergenceSeverity) => {
    switch (severity) {
      case "critical": return "text-red-600 bg-red-100";
      case "high": return "text-orange-600 bg-orange-100";
      case "medium": return "text-yellow-600 bg-yellow-100";
      case "low": return "text-blue-600 bg-blue-100";
      default: return "text-gray-600 bg-gray-100";
    }
  };

  const getSeverityLabel = (severity: DivergenceSeverity) => {
    switch (severity) {
      case "critical": return "Critique";
      case "high": return "Élevée";
      case "medium": return "Moyenne";
      case "low": return "Faible";
      default: return severity;
    }
  };

  const getStatusColor = (status: DivergenceStatus) => {
    switch (status) {
      case "pending": return "text-yellow-600 bg-yellow-100";
      case "analyzing": return "text-blue-600 bg-blue-100";
      case "resolved": return "text-green-600 bg-green-100";
      case "ignored": return "text-gray-600 bg-gray-100";
      default: return "text-gray-600 bg-gray-100";
    }
  };

  const getStatusLabel = (status: DivergenceStatus) => {
    switch (status) {
      case "pending": return "En attente";
      case "analyzing": return "En analyse";
      case "resolved": return "Résolu";
      case "ignored": return "Ignoré";
      default: return status;
    }
  };

  const filteredDivergences = divergences.filter(div => 
    div.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    div.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    div.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelectAll = () => {
    if (selectedIds.length === filteredDivergences.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredDivergences.map(d => d.id));
    }
  };

  const handleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher une divergence..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        {selectedIds.length > 0 && (
          <div className="flex gap-2">
            <button
              onClick={() => onBulkAction(selectedIds, "accept")}
              className="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600"
            >
              Accepter ({selectedIds.length})
            </button>
            <button
              onClick={() => onBulkAction(selectedIds, "reject")}
              className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Garder référence ({selectedIds.length})
            </button>
          </div>
        )}
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead className="bg-muted/50">
            <tr className="border-b">
              <th className="w-8 p-3">
                <input
                  type="checkbox"
                  checked={selectedIds.length === filteredDivergences.length && filteredDivergences.length > 0}
                  onChange={handleSelectAll}
                  className="rounded border-gray-300"
                />
              </th>
              <th className="text-left p-3 font-medium">Code / Équipement</th>
              <th className="text-left p-3 font-medium">Type</th>
              <th className="text-left p-3 font-medium">Champs divergents</th>
              <th className="text-left p-3 font-medium">Sévérité</th>
              <th className="text-left p-3 font-medium">Statut</th>
              <th className="text-left p-3 font-medium">Actions</th>
             </tr>
          </thead>
          <tbody>
            {filteredDivergences.map((divergence) => (
              <tr key={divergence.id} className="border-b hover:bg-muted/30">
                <td className="p-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(divergence.id)}
                    onChange={() => handleSelect(divergence.id)}
                    className="rounded border-gray-300"
                  />
                 </td>
                <td className="p-3">
                  <div className="font-mono text-sm">{divergence.code}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    ID: {divergence.mrid}
                  </div>
                 </td>
                <td className="p-3">{divergence.type}</td>
                <td className="p-3">
                  <div className="space-y-1">
                    {divergence.divergentFields.slice(0, 3).map((f, idx) => (
                      <div key={idx} className="text-xs">
                        <span className="font-medium">{getFieldLabel(f.field)}</span>
                        <span className="text-muted-foreground ml-1">
                          → {formatValueForDisplay(f.layer2Value)}
                        </span>
                      </div>
                    ))}
                    {divergence.divergentFields.length > 3 && (
                      <div className="text-xs text-muted-foreground">
                        +{divergence.divergentFields.length - 3} autre(s)
                      </div>
                    )}
                  </div>
                 </td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(divergence.severity)}`}>
                    {getSeverityLabel(divergence.severity)}
                  </span>
                 </td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(divergence.status)}`}>
                    {getStatusLabel(divergence.status)}
                  </span>
                 </td>
                <td className="p-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => onView(divergence)}
                      className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1 cursor-pointer"
                    >
                      <Eye className="h-3 w-3" />
                      Comparer
                    </button>
                  </div>
                 </td>
               </tr>
            ))}
          </tbody>
         </table>
        {filteredDivergences.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            Aucune divergence trouvée pour ce départ
          </div>
        )}
      </div>
    </div>
  );
}

// Modal pour les détails d'une divergence
function DivergenceDetailModal({ 
  divergence, 
  isOpen, 
  onClose, 
  onAccept, 
  onReject, 
  onIgnore 
}: { 
  divergence: Divergence | null;
  isOpen: boolean;
  onClose: () => void;
  onAccept: (divergence: Divergence) => void;
  onReject: (divergence: Divergence) => void;
  onIgnore: (divergence: Divergence) => void;
}) {
  if (!isOpen || !divergence) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <GitCompare className="h-5 w-5 text-orange-500" />
            Comparaison des données
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            ✕
          </button>
        </div>
        
        <ComparisonView 
          divergence={divergence}
          onAccept={() => onAccept(divergence)}
          onReject={() => onReject(divergence)}
          onIgnore={() => onIgnore(divergence)}
        />
      </div>
    </div>
  );
}

export default function DivergencesPage() {
  const { t } = useI18n();
  
  const [viewLevel, setViewLevel] = useState<ViewLevel>("regions");
  const [selectedRegion, setSelectedRegion] = useState<EneoRegion | null>(null);
  const [selectedZone, setSelectedZone] = useState<EneoZone | null>(null);
  const [selectedDeparture, setSelectedDeparture] = useState<EneoDeparture | null>(null);
  
  const [period, setPeriod] = useState<PeriodType>("month");
  const [searchQuery, setSearchQuery] = useState("");

  const [selectedDivergence, setSelectedDivergence] = useState<Divergence | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Récupérer les vraies divergences pour le départ sélectionné
  const divergences = useMemo(() => {
    if (!selectedDeparture) return [];
    
    const anomalies = getAnomaliesByFeeder(selectedDeparture.feederId, "divergence");
    
    const divergenceRecords: Divergence[] = [];
    for (const anomaly of anomalies) {
      const converted = convertAnomalyToDivergence(anomaly);
      if (converted) {
        divergenceRecords.push(converted);
      }
    }
    
    return divergenceRecords;
  }, [selectedDeparture]);

  const filteredDivergences = useMemo(() => {
    if (!searchQuery) return divergences;
    const query = searchQuery.toLowerCase();
    return divergences.filter(
      (div) =>
        div.code.toLowerCase().includes(query) ||
        div.type.toLowerCase().includes(query) ||
        div.description.toLowerCase().includes(query)
    );
  }, [divergences, searchQuery]);

  // Calculer les stats globales
  const globalStats = useMemo(() => {
    let totalDivergences = 0;
    
    eneoRegions.forEach((region) => {
      region.zones.forEach((zone) => {
        zone.departures.forEach((departure) => {
          const anomalies = getAnomaliesByFeeder(departure.feederId, "divergence");
          totalDivergences += anomalies.length;
        });
      });
    });

    return {
      total: totalDivergences,
      pendingAndInProgress: totalDivergences,
      completed: 0,
      completionRate: 0,
    };
  }, []);

  // Filtrer les régions pour n'afficher que celles qui ont des divergences
  const filteredRegions = useMemo(() => {
    if (!searchQuery) {
      return eneoRegions.filter(region => {
        let hasDivergences = false;
        region.zones.forEach(zone => {
          zone.departures.forEach(departure => {
            if (getAnomaliesByFeeder(departure.feederId, "divergence").length > 0) {
              hasDivergences = true;
            }
          });
        });
        return hasDivergences;
      });
    }
    
    const query = searchQuery.toLowerCase();
    return eneoRegions.filter(region => {
      let hasDivergences = false;
      region.zones.forEach(zone => {
        zone.departures.forEach(departure => {
          if (getAnomaliesByFeeder(departure.feederId, "divergence").length > 0) {
            hasDivergences = true;
          }
        });
      });
      return hasDivergences && (
        region.code.toLowerCase().includes(query) ||
        region.name.toLowerCase().includes(query) ||
        region.fullName.toLowerCase().includes(query)
      );
    });
  }, [searchQuery]);

  // Filtrer les zones pour n'afficher que celles qui ont des divergences
  const filteredZones = useMemo(() => {
    if (!selectedRegion) return [];
    
    let zones = selectedRegion.zones.filter(zone => {
      let hasDivergences = false;
      zone.departures.forEach(departure => {
        if (getAnomaliesByFeeder(departure.feederId, "divergence").length > 0) {
          hasDivergences = true;
        }
      });
      return hasDivergences;
    });
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      zones = zones.filter(zone => 
        zone.code.toLowerCase().includes(query) || 
        zone.name.toLowerCase().includes(query)
      );
    }
    
    return zones;
  }, [selectedRegion, searchQuery]);

  // Filtrer les départs pour n'afficher que ceux qui ont des divergences
  const filteredDepartures = useMemo(() => {
    if (!selectedZone) return [];
    
    let departures = selectedZone.departures.filter(departure => 
      getAnomaliesByFeeder(departure.feederId, "divergence").length > 0
    );
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      departures = departures.filter(departure => 
        departure.code.toLowerCase().includes(query) || 
        departure.name.toLowerCase().includes(query)
      );
    }
    
    return departures;
  }, [selectedZone, searchQuery]);

  const breadcrumbItems: BreadcrumbItem[] = useMemo(() => {
    const items: BreadcrumbItem[] = [
      { id: "home", label: "Divergences", type: "home" },
    ];

    if (selectedRegion) {
      items.push({ id: selectedRegion.id, label: selectedRegion.code, type: "region" });
    }
    if (selectedZone) {
      items.push({ id: selectedZone.id, label: selectedZone.name, type: "zone" });
    }
    if (selectedDeparture) {
      items.push({ id: selectedDeparture.id, label: selectedDeparture.code, type: "departure" });
    }

    return items;
  }, [selectedRegion, selectedZone, selectedDeparture]);

  const handleBreadcrumbNavigate = (item: BreadcrumbItem) => {
    if (item.type === "home") {
      setViewLevel("regions");
      setSelectedRegion(null);
      setSelectedZone(null);
      setSelectedDeparture(null);
    } else if (item.type === "region") {
      setViewLevel("zones");
      setSelectedZone(null);
      setSelectedDeparture(null);
    } else if (item.type === "zone") {
      setViewLevel("departures");
      setSelectedDeparture(null);
    }
  };

  const handleRegionClick = (region: EneoRegion) => {
    setSelectedRegion(region);
    setViewLevel("zones");
  };

  const handleZoneClick = (zone: EneoZone) => {
    setSelectedZone(zone);
    setViewLevel("departures");
  };

  const handleDepartureClick = (departure: EneoDeparture) => {
    setSelectedDeparture(departure);
    setViewLevel("divergences");
  };

  const handleViewDivergence = (divergence: Divergence) => {
    setSelectedDivergence(divergence);
    setIsDetailModalOpen(true);
  };

  const handleAcceptDivergence = (divergence: Divergence) => {
    toast.success(`Données terrain acceptées pour ${divergence.code}`);
    setIsDetailModalOpen(false);
  };

  const handleRejectDivergence = (divergence: Divergence) => {
    toast.success(`Données de référence conservées pour ${divergence.code}`);
    setIsDetailModalOpen(false);
  };

  const handleIgnoreDivergence = (divergence: Divergence) => {
    toast.info(`Divergence ${divergence.code} ignorée`);
    setIsDetailModalOpen(false);
  };

  const handleBulkAction = (divergenceIds: string[], action: string) => {
    const actionLabel = action === "accept" ? "acceptées" : "conservées en référence";
    toast.success(`${divergenceIds.length} divergence(s) ${actionLabel}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <GitCompare className="h-7 w-7 text-orange-500" />
            Divergences
          </h1>
          <p className="text-muted-foreground mt-1">
            Comparaison entre les données de référence (BD1) et la collecte terrain (BD2)
          </p>
        </div>
        <PeriodFilter value={period} onChange={setPeriod} />
      </div>

      <GlobalStatsCards
        total={globalStats.total}
        pendingAndInProgress={globalStats.pendingAndInProgress}
        completed={globalStats.completed}
        completionRate={globalStats.completionRate}
      />

      <Card>
        <CardContent className="py-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <NavigationBreadcrumb items={breadcrumbItems} onNavigate={handleBreadcrumbNavigate} />
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {viewLevel === "regions" && (
        <div>
          <h2 className="text-xl font-semibold mb-4">
            Régions avec des divergences ({filteredRegions.length})
          </h2>
          {filteredRegions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Aucune région ne contient de divergences
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRegions.map((region) => {
                let regionDivergenceCount = 0;
                region.zones.forEach(zone => {
                  zone.departures.forEach(departure => {
                    regionDivergenceCount += getAnomaliesByFeeder(departure.feederId, "divergence").length;
                  });
                });
                
                const stats = {
                  total: regionDivergenceCount,
                  pending: regionDivergenceCount,
                  inProgress: 0,
                  completed: 0
                };
                
                return (
                  <RegionCard
                    key={region.id}
                    code={region.code}
                    name={region.name}
                    fullName={region.fullName}
                    stats={stats}
                    zonesCount={region.zones.length}
                    onClick={() => handleRegionClick(region)}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {viewLevel === "zones" && selectedRegion && (
        <div>
          <h2 className="text-xl font-semibold mb-4">
            Zones de {selectedRegion.fullName} avec des divergences ({filteredZones.length})
          </h2>
          {filteredZones.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Aucune zone ne contient de divergences dans cette région
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredZones.map((zone) => {
                let zoneDivergenceCount = 0;
                zone.departures.forEach(departure => {
                  zoneDivergenceCount += getAnomaliesByFeeder(departure.feederId, "divergence").length;
                });
                
                const stats = {
                  total: zoneDivergenceCount,
                  pending: zoneDivergenceCount,
                  inProgress: 0,
                  completed: 0
                };
                
                return (
                  <ZoneCard
                    key={zone.id}
                    code={zone.code}
                    name={zone.name}
                    stats={stats}
                    departuresCount={zone.departures.length}
                    onClick={() => handleZoneClick(zone)}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {viewLevel === "departures" && selectedZone && (
        <div>
          <h2 className="text-xl font-semibold mb-4">
            Départs de {selectedZone.name} avec des divergences ({filteredDepartures.length})
          </h2>
          {filteredDepartures.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Aucun départ ne contient de divergences dans cette zone
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDepartures.map((departure) => {
                const divergenceCount = getAnomaliesByFeeder(departure.feederId, "divergence").length;
                return (
                  <DepartureCard
                    key={departure.id}
                    code={departure.code}
                    name={departure.name}
                    equipmentCount={divergenceCount}
                    completedCount={0}
                    pendingCount={divergenceCount}
                    onClick={() => handleDepartureClick(departure)}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {viewLevel === "divergences" && selectedDeparture && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              Divergences du départ {selectedDeparture.code} ({filteredDivergences.length})
            </h2>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitCompare className="h-5 w-5 text-orange-500" />
                Liste des divergences
              </CardTitle>
              <CardDescription>
                Comparez les données de référence (BD1) avec les données de collecte terrain (BD2) pour le départ {selectedDeparture.name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DivergenceTable
                divergences={filteredDivergences}
                onView={handleViewDivergence}
                onAccept={handleAcceptDivergence}
                onReject={handleRejectDivergence}
                onIgnore={handleIgnoreDivergence}
                onBulkAction={handleBulkAction}
              />
            </CardContent>
          </Card>
        </div>
      )}

      <DivergenceDetailModal
        divergence={selectedDivergence}
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        onAccept={handleAcceptDivergence}
        onReject={handleRejectDivergence}
        onIgnore={handleIgnoreDivergence}
      />
    </div>
  );
}
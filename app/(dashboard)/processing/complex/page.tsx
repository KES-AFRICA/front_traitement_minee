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
import { AlertCircle, AlertTriangle, Search, FileWarning, MapPin, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { 
  eneoRegions, 
  getAnomaliesByFeeder, 
  getComparisonStats,
  EneoRegion, 
  EneoZone, 
  EneoDeparture,
  AnomalyCase
} from "@/lib/api/eneo-data";

type ViewLevel = "regions" | "zones" | "departures" | "complexes";

// Type pour les cas complexes basé sur les anomalies réelles
interface ComplexCase {
  id: string;
  code: string;
  type: string;
  table: string;
  name: string;
  description: string;
  reason: string;
  location?: string;
  detectedAt: string;
  status: "pending" | "analyzing" | "resolved" | "ignored";
  rawAnomaly: AnomalyCase;
  metadata: {
    [key: string]: unknown;
  };
}

// Obtenir le libellé du type d'équipement
function getEquipmentTypeLabel(table: string): string {
  const labels: Record<string, string> = {
    substation: "Poste source",
    powertransformer: "Transformateur",
    busbar: "Jeu de barres",
    bay: "Départ",
    switch: "Disjoncteur",
    wire: "Ligne",
    pole: "Poteau",
    node: "Nœud réseau",
    feeder: "Départ",
  };
  return labels[table] || table;
}

// Formater une valeur pour l'affichage
function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Oui" : "Non";
  if (value instanceof Date) return value.toLocaleString();
  if (typeof value === "object") return JSON.stringify(value).substring(0, 100);
  return String(value);
}

// Obtenir un nom lisible pour l'enregistrement
function getRecordName(record: Record<string, unknown> | null, table: string): string {
  if (!record) return "Inconnu";
  if (record.name) return String(record.name);
  if (record.code) return String(record.code);
  if (record.local_name) return String(record.local_name);
  return `${getEquipmentTypeLabel(table)} ${record.m_rid}`;
}

// Obtenir une description du cas complexe
function getCaseDescription(record: Record<string, unknown> | null, table: string): string {
  if (!record) return "Cas complexe nécessitant une analyse";
  
  const importantFields: Record<string, string[]> = {
    busbar: ["voltage", "phase", "substation_id"],
    powertransformer: ["apparent_power", "substation_id"],
    substation: ["type", "regime", "feeder_id"],
    switch: ["nature", "type", "bay_mrid"],
    bay: ["type", "substation_id"],
  };
  
  const fields = importantFields[table] || ["name", "code"];
  const descriptions = fields
    .filter(f => record[f] !== undefined && record[f] !== null && record[f] !== "")
    .map(f => `${f}: ${formatValue(record[f])}`);
  
  if (descriptions.length === 0) return "Données incomplètes ou références cassées";
  return descriptions.join(" • ");
}

// Obtenir la localisation si disponible
function getRecordLocation(record: Record<string, unknown> | null): string | undefined {
  if (!record) return undefined;
  if (record.localisation && String(record.localisation).trim()) {
    return String(record.localisation);
  }
  if (record.latitude && record.longitude) {
    return `${record.latitude}, ${record.longitude}`;
  }
  return undefined;
}

// Convertir une anomalie de type "complex" en ComplexCase
function convertAnomalyToComplex(anomaly: AnomalyCase): ComplexCase | null {
  if (anomaly.type !== "complex") return null;
  
  const record = anomaly.layer2Record || anomaly.layer1Record;
  const table = anomaly.table;
  const name = getRecordName(record, table);
  const description = getCaseDescription(record, table);
  const location = getRecordLocation(record);
  const reason = anomaly.complexReason || "Référence orpheline ou données incomplètes";
  
  // Extraire les métadonnées importantes
  const metadata: Record<string, unknown> = {};
  if (record) {
    const importantFields = ["voltage", "apparent_power", "type", "substation_id", "feeder_id", "bay_mrid", "pole_id"];
    importantFields.forEach(field => {
      if (record[field] !== undefined && record[field] !== null && record[field] !== "") {
        metadata[field] = record[field];
      }
    });
  }
  
  return {
    id: anomaly.id,
    code: `COMPLEX-${table.toUpperCase()}-${anomaly.mrid}`.substring(0, 50),
    type: getEquipmentTypeLabel(table),
    table: table,
    name: name,
    description: description,
    reason: reason,
    location: location,
    detectedAt: new Date().toISOString().split('T')[0],
    status: "pending",
    rawAnomaly: anomaly,
    metadata: metadata,
  };
}

// Composant pour afficher les cas complexes
function ComplexCasesTable({ 
  cases, 
  onView,
  onAnalyze,
  onResolve,
  onIgnore,
  onBulkAction 
}: { 
  cases: ComplexCase[];
  onView: (case_: ComplexCase) => void;
  onAnalyze: (case_: ComplexCase) => void;
  onResolve: (case_: ComplexCase) => void;
  onIgnore: (case_: ComplexCase) => void;
  onBulkAction: (ids: string[], action: string) => void;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  const getStatusColor = (status: ComplexCase["status"]) => {
    switch (status) {
      case "pending": return "text-yellow-600 bg-yellow-100";
      case "analyzing": return "text-blue-600 bg-blue-100";
      case "resolved": return "text-green-600 bg-green-100";
      case "ignored": return "text-gray-600 bg-gray-100";
      default: return "text-gray-600 bg-gray-100";
    }
  };

  const getStatusLabel = (status: ComplexCase["status"]) => {
    switch (status) {
      case "pending": return "En attente";
      case "analyzing": return "En analyse";
      case "resolved": return "Résolu";
      case "ignored": return "Ignoré";
      default: return status;
    }
  };

  const filteredCases = cases.filter(c => 
    c.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.reason.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelectAll = () => {
    if (selectedIds.length === filteredCases.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredCases.map(c => c.id));
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
            placeholder="Rechercher un cas complexe..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        {selectedIds.length > 0 && (
          <div className="flex gap-2">
            <button
              onClick={() => onBulkAction(selectedIds, "analyze")}
              className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Analyser ({selectedIds.length})
            </button>
            <button
              onClick={() => onBulkAction(selectedIds, "resolve")}
              className="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600"
            >
              Résoudre ({selectedIds.length})
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
                  checked={selectedIds.length === filteredCases.length && filteredCases.length > 0}
                  onChange={handleSelectAll}
                  className="rounded border-gray-300"
                />
              </th>
              <th className="text-left p-3 font-medium">Code / Équipement</th>
              <th className="text-left p-3 font-medium">Type</th>
              <th className="text-left p-3 font-medium">Raison du cas complexe</th>
              <th className="text-left p-3 font-medium">Localisation</th>
              <th className="text-left p-3 font-medium">Statut</th>
              <th className="text-left p-3 font-medium">Actions</th>
             </tr>
          </thead>
          <tbody>
            {filteredCases.map((case_) => (
              <tr key={case_.id} className="border-b hover:bg-muted/30">
                <td className="p-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(case_.id)}
                    onChange={() => handleSelect(case_.id)}
                    className="rounded border-gray-300"
                  />
                 </td>
                <td className="p-3">
                  <div className="font-mono text-sm">{case_.code}</div>
                  <div className="font-medium text-sm mt-1">{case_.name}</div>
                 </td>
                <td className="p-3">
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                    {case_.type}
                  </span>
                 </td>
                <td className="p-3 max-w-md">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-muted-foreground">{case_.reason}</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{case_.description}</p>
                 </td>
                <td className="p-3">
                  {case_.location ? (
                    <div className="flex items-center gap-1 text-sm">
                      <MapPin className="h-3 w-3 text-muted-foreground" />
                      <span className="truncate max-w-[150px]">{case_.location}</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-sm">—</span>
                  )}
                 </td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(case_.status)}`}>
                    {getStatusLabel(case_.status)}
                  </span>
                 </td>
                <td className="p-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => onView(case_)}
                      className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
                    >
                      <AlertCircle className="h-3 w-3" />
                      Détails
                    </button>
                    {case_.status === "pending" && (
                      <button
                        onClick={() => onAnalyze(case_)}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        Analyser
                      </button>
                    )}
                    {case_.status === "analyzing" && (
                      <button
                        onClick={() => onResolve(case_)}
                        className="text-green-600 hover:text-green-800 text-sm"
                      >
                        Résoudre
                      </button>
                    )}
                  </div>
                 </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredCases.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            Aucun cas complexe trouvé pour ce départ
          </div>
        )}
      </div>
    </div>
  );
}

// Modal pour les détails d'un cas complexe
function ComplexCaseDetailModal({ 
  case_, 
  isOpen, 
  onClose, 
  onAnalyze, 
  onResolve, 
  onIgnore 
}: { 
  case_: ComplexCase | null;
  isOpen: boolean;
  onClose: () => void;
  onAnalyze: (case_: ComplexCase) => void;
  onResolve: (case_: ComplexCase) => void;
  onIgnore: (case_: ComplexCase) => void;
}) {
  if (!isOpen || !case_) return null;

  const record = case_.rawAnomaly.layer2Record || case_.rawAnomaly.layer1Record;
  const allFields = record 
    ? Object.entries(record)
        .filter(([key]) => key !== "m_rid")
        .sort((a, b) => a[0].localeCompare(b[0]))
    : [];

  // Obtenir un libellé lisible pour un champ
  const getFieldLabel = (key: string): string => {
    const labels: Record<string, string> = {
      name: "Nom",
      code: "Code",
      type: "Type",
      voltage: "Tension (kV)",
      active: "Actif",
      created_date: "Date création",
      display_scada: "Affiché SCADA",
      apparent_power: "Puissance (kVA)",
      substation_id: "Poste source",
      feeder_id: "Départ",
      phase: "Phase",
      localisation: "Localisation",
      regime: "Régime",
      section: "Section",
      nature_conducteur: "Nature conducteur",
      height: "Hauteur (m)",
      latitude: "Latitude",
      longitude: "Longitude",
      bay_mrid: "Travée",
      pole_id: "Poteau",
      t1: "Terminal 1",
      t2: "Terminal 2",
    };
    return labels[key] || key;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[95vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <FileWarning className="h-5 w-5 text-orange-600" />
            Cas Complexe
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 cursor-pointer">
            ✕
          </button>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t">
          {case_.status === "pending" && (
            <button
              onClick={() => onAnalyze(case_)}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
            >
              <AlertCircle className="h-4 w-4" />
              Démarrer l'analyse
            </button>
          )}
          {case_.status === "analyzing" && (
            <>
              <button
                onClick={() => onResolve(case_)}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"
              >
                <AlertCircle className="h-4 w-4" />
                Marquer comme résolu
              </button>
              <button
                onClick={() => onIgnore(case_)}
                className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center justify-center gap-2"
              >
                Ignorer
              </button>
            </>
          )}
        </div>

        <div className="space-y-4">
          {/* Informations générales */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Type d'équipement
              </label>
              <p className="font-medium">{case_.type}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                ID technique
              </label>
              <p className="font-mono text-sm">{case_.rawAnomaly.mrid}</p>
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Raison
              </label>
              <div className="flex items-start gap-2 mt-1 p-2 bg-orange-50 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5" />
                <p className="text-sm text-orange-800">{case_.reason}</p>
              </div>
            </div>
            {case_.rawAnomaly.feederName && (
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Départ
                </label>
                <p>{case_.rawAnomaly.feederName}</p>
              </div>
            )}
          </div>

          {/* Localisation */}
          {case_.location && (
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1 block">
                Localisation
              </label>
              <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
                <MapPin className="h-4 w-4 text-blue-600" />
                <span className="text-sm">{case_.location}</span>
              </div>
            </div>
          )}

          {/* Détails de l'enregistrement */}
          {record && (
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">
                Données de l'enregistrement
              </label>
              <div className="border rounded-lg overflow-hidden">
                <div className="grid grid-cols-2 gap-2 p-4">
                  {allFields.map(([key, value]) => (
                    <div key={key} className="border-b border-gray-100 py-2">
                      <span className="text-xs text-muted-foreground block">
                        {getFieldLabel(key)}
                      </span>
                      <span className="text-sm font-mono break-all">
                        {formatValue(value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Note d'information */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <HelpCircle className="h-4 w-4 text-amber-600 mt-0.5" />
              <div className="text-sm text-amber-800">
                <p className="font-medium">Que faire ?</p>
                <p className="text-xs mt-1">
                  Ce cas nécessite une analyse approfondie car les références sont cassées ou les données sont incomplètes.
                  Vérifiez les liens avec d'autres équipements et mettez à jour les données si nécessaire.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ComplexCasesPage() {
  const { t } = useI18n();
  
  // Navigation state
  const [viewLevel, setViewLevel] = useState<ViewLevel>("regions");
  const [selectedRegion, setSelectedRegion] = useState<EneoRegion | null>(null);
  const [selectedZone, setSelectedZone] = useState<EneoZone | null>(null);
  const [selectedDeparture, setSelectedDeparture] = useState<EneoDeparture | null>(null);
  
  // Filter state
  const [period, setPeriod] = useState<PeriodType>("month");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal state
  const [selectedCase, setSelectedCase] = useState<ComplexCase | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Récupérer les vraies cas complexes pour le départ sélectionné
  const complexCases = useMemo(() => {
    if (!selectedDeparture) return [];
    
    const anomalies = getAnomaliesByFeeder(selectedDeparture.feederId, "complex");
    
    const cases: ComplexCase[] = [];
    for (const anomaly of anomalies) {
      const converted = convertAnomalyToComplex(anomaly);
      if (converted) {
        cases.push(converted);
      }
    }
    
    return cases;
  }, [selectedDeparture]);

  // Filter complex cases
  const filteredCases = useMemo(() => {
    if (!searchQuery) return complexCases;
    const query = searchQuery.toLowerCase();
    return complexCases.filter(
      (c) =>
        c.code.toLowerCase().includes(query) ||
        c.type.toLowerCase().includes(query) ||
        c.name.toLowerCase().includes(query) ||
        c.reason.toLowerCase().includes(query)
    );
  }, [complexCases, searchQuery]);

  // Calculer les stats globales
  const globalStats = useMemo(() => {
    let totalComplex = 0;
    
    eneoRegions.forEach((region) => {
      region.zones.forEach((zone) => {
        zone.departures.forEach((departure) => {
          const anomalies = getAnomaliesByFeeder(departure.feederId, "complex");
          totalComplex += anomalies.length;
        });
      });
    });

    return {
      total: totalComplex,
      pendingAndInProgress: totalComplex,
      completed: 0,
      completionRate: 0,
    };
  }, []);

  // Filtrer les régions pour n'afficher que celles qui ont des cas complexes
  const filteredRegions = useMemo(() => {
    if (!searchQuery) {
      return eneoRegions.filter(region => {
        let hasComplex = false;
        region.zones.forEach(zone => {
          zone.departures.forEach(departure => {
            if (getAnomaliesByFeeder(departure.feederId, "complex").length > 0) {
              hasComplex = true;
            }
          });
        });
        return hasComplex;
      });
    }
    
    const query = searchQuery.toLowerCase();
    return eneoRegions.filter(region => {
      let hasComplex = false;
      region.zones.forEach(zone => {
        zone.departures.forEach(departure => {
          if (getAnomaliesByFeeder(departure.feederId, "complex").length > 0) {
            hasComplex = true;
          }
        });
      });
      return hasComplex && (
        region.code.toLowerCase().includes(query) ||
        region.name.toLowerCase().includes(query) ||
        region.fullName.toLowerCase().includes(query)
      );
    });
  }, [searchQuery]);

  // Filtrer les zones pour n'afficher que celles qui ont des cas complexes
  const filteredZones = useMemo(() => {
    if (!selectedRegion) return [];
    
    let zones = selectedRegion.zones.filter(zone => {
      let hasComplex = false;
      zone.departures.forEach(departure => {
        if (getAnomaliesByFeeder(departure.feederId, "complex").length > 0) {
          hasComplex = true;
        }
      });
      return hasComplex;
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

  // Filtrer les départs pour n'afficher que ceux qui ont des cas complexes
  const filteredDepartures = useMemo(() => {
    if (!selectedZone) return [];
    
    let departures = selectedZone.departures.filter(departure => 
      getAnomaliesByFeeder(departure.feederId, "complex").length > 0
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

  // Build breadcrumb
  const breadcrumbItems: BreadcrumbItem[] = useMemo(() => {
    const items: BreadcrumbItem[] = [
      { id: "home", label: "Cas Complexes", type: "home" },
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

  // Handle navigation
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
    setViewLevel("complexes");
  };

  // Complex case actions
  const handleViewCase = (case_: ComplexCase) => {
    setSelectedCase(case_);
    setIsDetailModalOpen(true);
  };

  const handleAnalyzeCase = (case_: ComplexCase) => {
    toast.success(`Analyse lancée pour ${case_.code}`);
    setIsDetailModalOpen(false);
  };

  const handleResolveCase = (case_: ComplexCase) => {
    toast.success(`Cas complexe ${case_.code} résolu`);
    setIsDetailModalOpen(false);
  };

  const handleIgnoreCase = (case_: ComplexCase) => {
    toast.info(`Cas complexe ${case_.code} ignoré`);
    setIsDetailModalOpen(false);
  };

  const handleBulkAction = (caseIds: string[], action: string) => {
    toast.success(`${caseIds.length} cas(s) ${action === "analyze" ? "en cours d'analyse" : "résolus"}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <AlertCircle className="h-7 w-7 text-orange-600" />
            Cas Complexes
          </h1>
          <p className="text-muted-foreground mt-1">
            Cas nécessitant une expertise particulière : références cassées, orphelins, données incomplètes
          </p>
        </div>
        <PeriodFilter value={period} onChange={setPeriod} />
      </div>

      {/* Global Stats */}
      <GlobalStatsCards
        total={globalStats.total}
        pendingAndInProgress={globalStats.pendingAndInProgress}
        completed={globalStats.completed}
        completionRate={globalStats.completionRate}
      />

      {/* Navigation Breadcrumb + Search */}
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

      {/* Content based on view level */}
      {viewLevel === "regions" && (
        <div>
          <h2 className="text-xl font-semibold mb-4">
            Régions avec des cas complexes ({filteredRegions.length})
          </h2>
          {filteredRegions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Aucune région ne contient de cas complexes
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRegions.map((region) => {
                let regionComplexCount = 0;
                region.zones.forEach(zone => {
                  zone.departures.forEach(departure => {
                    regionComplexCount += getAnomaliesByFeeder(departure.feederId, "complex").length;
                  });
                });
                
                const stats = {
                  total: regionComplexCount,
                  pending: regionComplexCount,
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
            Zones de {selectedRegion.fullName} avec des cas complexes ({filteredZones.length})
          </h2>
          {filteredZones.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Aucune zone ne contient de cas complexes dans cette région
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredZones.map((zone) => {
                let zoneComplexCount = 0;
                zone.departures.forEach(departure => {
                  zoneComplexCount += getAnomaliesByFeeder(departure.feederId, "complex").length;
                });
                
                const stats = {
                  total: zoneComplexCount,
                  pending: zoneComplexCount,
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
            Départs de {selectedZone.name} avec des cas complexes ({filteredDepartures.length})
          </h2>
          {filteredDepartures.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Aucun départ ne contient de cas complexes dans cette zone
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDepartures.map((departure) => {
                const complexCount = getAnomaliesByFeeder(departure.feederId, "complex").length;
                return (
                  <DepartureCard
                    key={departure.id}
                    code={departure.code}
                    name={departure.name}
                    equipmentCount={complexCount}
                    completedCount={0}
                    pendingCount={complexCount}
                    onClick={() => handleDepartureClick(departure)}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {viewLevel === "complexes" && selectedDeparture && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              Cas complexes du départ {selectedDeparture.code} ({filteredCases.length})
            </h2>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-orange-600" />
                Cas nécessitant une analyse
              </CardTitle>
              <CardDescription>
                Ces cas présentent des références cassées ou des données incomplètes nécessitant une expertise.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ComplexCasesTable
                cases={filteredCases}
                onView={handleViewCase}
                onAnalyze={handleAnalyzeCase}
                onResolve={handleResolveCase}
                onIgnore={handleIgnoreCase}
                onBulkAction={handleBulkAction}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal */}
      <ComplexCaseDetailModal
        case_={selectedCase}
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        onAnalyze={handleAnalyzeCase}
        onResolve={handleResolveCase}
        onIgnore={handleIgnoreCase}
      />
    </div>
  );
}
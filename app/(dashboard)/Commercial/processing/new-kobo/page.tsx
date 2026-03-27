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
import { Search, FilePlus, CheckCircle, XCircle, Eye, Trash2, Save } from "lucide-react";
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

type ViewLevel = "regions" | "zones" | "departures" | "newData";

// Type pour les nouvelles données basé sur les anomalies réelles
interface NewDataRecord {
  id: string;
  code: string;
  type: string;
  table: string;
  title: string;
  description: string;
  submissionDate: string;
  validationStatus: "pending" | "reviewing" | "validated" | "rejected";
  rawAnomaly: AnomalyCase;
  metadata: {
    latitude?: number;
    longitude?: number;
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

// Obtenir un titre lisible pour l'enregistrement
function getRecordTitle(record: Record<string, unknown>, table: string): string {
  if (record.name) return String(record.name);
  if (record.code) return String(record.code);
  if (record.local_name) return String(record.local_name);
  return `${getEquipmentTypeLabel(table)} ${record.m_rid}`;
}

// Obtenir une description des champs importants
function getRecordDescription(record: Record<string, unknown>, table: string): string {
  const importantFields: Record<string, string[]> = {
    substation: ["type", "regime", "localisation"],
    powertransformer: ["apparent_power", "w1_voltage", "w2_voltage"],
    busbar: ["voltage", "phase"],
    bay: ["type", "voltage"],
    switch: ["nature", "type", "normal_open"],
    wire: ["nature_conducteur", "section", "phase"],
    pole: ["height", "type"],
    node: ["code"],
  };
  
  const fields = importantFields[table] || ["name", "code"];
  const descriptions = fields
    .filter(f => record[f] !== undefined && record[f] !== null && record[f] !== "")
    .map(f => `${f}: ${formatValue(record[f])}`);
  
  if (descriptions.length === 0) return "Nouvel équipement détecté";
  return descriptions.join(" • ");
}

// Convertir une anomalie de type "new" en NewDataRecord
function convertAnomalyToNewData(anomaly: AnomalyCase): NewDataRecord | null {
  if (anomaly.type !== "new" || !anomaly.layer2Record) return null;
  
  const record = anomaly.layer2Record;
  const table = anomaly.table;
  const title = getRecordTitle(record, table);
  const description = getRecordDescription(record, table);
  
  // Extraire les métadonnées (latitude, longitude si disponibles)
  const metadata: Record<string, unknown> = {};
  if (record.latitude) metadata.latitude = Number(record.latitude);
  if (record.longitude) metadata.longitude = Number(record.longitude);
  if (record.lattitude) metadata.latitude = Number(record.lattitude);
  
  // Ajouter les champs importants comme métadonnées
  const importantFields = ["voltage", "apparent_power", "type", "regime", "section"];
  importantFields.forEach(field => {
    if (record[field] !== undefined && record[field] !== null && record[field] !== "") {
      metadata[field] = record[field];
    }
  });
  
  return {
    id: anomaly.id,
    code: `${table.toUpperCase()}-${record.m_rid || record.code || "NEW"}`,
    type: getEquipmentTypeLabel(table),
    table: table,
    title: title,
    description: description,
    submissionDate: (record.created_date as string)?.split('T')[0] || new Date().toISOString().split('T')[0],
    validationStatus: "pending",
    rawAnomaly: anomaly,
    metadata: metadata,
  };
}

// Composant pour afficher les nouvelles données
function NewDataTable({ 
  records, 
  onView, 
  onKeep, 
  onDelete, 
  onReview,
  onBulkAction 
}: { 
  records: NewDataRecord[];
  onView: (record: NewDataRecord) => void;
  onKeep: (record: NewDataRecord) => void;
  onDelete: (record: NewDataRecord) => void;
  onReview: (record: NewDataRecord) => void;
  onBulkAction: (ids: string[], action: string) => void;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  const getStatusColor = (status: NewDataRecord["validationStatus"]) => {
    switch (status) {
      case "pending": return "text-yellow-600 bg-yellow-100";
      case "reviewing": return "text-blue-600 bg-blue-100";
      case "validated": return "text-green-600 bg-green-100";
      case "rejected": return "text-red-600 bg-red-100";
      default: return "text-gray-600 bg-gray-100";
    }
  };

  const getStatusLabel = (status: NewDataRecord["validationStatus"]) => {
    switch (status) {
      case "pending": return "En attente";
      case "reviewing": return "En revue";
      case "validated": return "Intégré";
      case "rejected": return "Rejeté";
      default: return status;
    }
  };

  const filteredRecords = records.filter(record => 
    record.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelectAll = () => {
    if (selectedIds.length === filteredRecords.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredRecords.map(r => r.id));
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
            placeholder="Rechercher une donnée..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        {selectedIds.length > 0 && (
          <div className="flex gap-2">
            <button
              onClick={() => onBulkAction(selectedIds, "keep")}
              className="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600 flex items-center gap-1"
            >
              <CheckCircle className="h-3 w-3" />
              Intégrer ({selectedIds.length})
            </button>
            <button
              onClick={() => onBulkAction(selectedIds, "delete")}
              className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600 flex items-center gap-1"
            >
              <Trash2 className="h-3 w-3" />
              Supprimer ({selectedIds.length})
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
                  checked={selectedIds.length === filteredRecords.length && filteredRecords.length > 0}
                  onChange={handleSelectAll}
                  className="rounded border-gray-300"
                />
              </th>
              <th className="text-left p-3 font-medium">Code / Équipement</th>
              <th className="text-left p-3 font-medium">Type</th>
              <th className="text-left p-3 font-medium">Description</th>
              <th className="text-left p-3 font-medium">Détecté le</th>
              <th className="text-left p-3 font-medium">Statut</th>
              <th className="text-left p-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRecords.map((record) => (
              <tr key={record.id} className="border-b hover:bg-muted/30">
                <td className="p-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(record.id)}
                    onChange={() => handleSelect(record.id)}
                    className="rounded border-gray-300"
                  />
                </td>
                <td className="p-3">
                  <div className="font-mono text-sm">{record.code}</div>
                  <div className="font-medium text-sm mt-1">{record.title}</div>
                 </td>
                <td className="p-3">
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                    {record.type}
                  </span>
                </td>
                <td className="p-3 max-w-xs">
                  <p className="text-sm text-muted-foreground truncate">{record.description}</p>
                 </td>
                <td className="p-3 text-sm">{record.submissionDate}</td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(record.validationStatus)}`}>
                    {getStatusLabel(record.validationStatus)}
                  </span>
                </td>
                <td className="p-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => onView(record)}
                      className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1 cursor-pointer"
                    >
                      <Eye className="h-3 w-3" />
                      Voir
                    </button>
                   
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredRecords.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            Aucune nouvelle donnée trouvée pour ce départ
          </div>
        )}
      </div>
    </div>
  );
}

// Modal pour les détails d'une nouvelle donnée
function NewDataDetailModal({ 
  record, 
  isOpen, 
  onClose, 
  onKeep, 
  onDelete 
}: { 
  record: NewDataRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onKeep: (record: NewDataRecord) => void;
  onDelete: (record: NewDataRecord) => void;
}) {
  if (!isOpen || !record) return null;

  const allFields = record.rawAnomaly.layer2Record 
    ? Object.entries(record.rawAnomaly.layer2Record)
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
      w1_voltage: "Tension primaire",
      w2_voltage: "Tension secondaire",
    };
    return labels[key] || key;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[95vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <FilePlus className="h-5 w-5 text-green-600" />
            Nouvel équipement détecté
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            ✕
          </button>
        </div>

         {/* Actions */}
          <div className="flex gap-3 py-2 border-t">
            <button
              onClick={() => onKeep(record)}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"
            >
              <Save className="h-4 w-4" />
              Intégrer à la base de référence
            </button>
            <button
              onClick={() => onDelete(record)}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center justify-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Supprimer de la collecte
            </button>
          </div>

        <div className="space-y-2">
          {/* Informations générales */}
          <div className="grid grid-cols-2 p-2 bg-muted/30 rounded-lg">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Type d'équipement
              </label>
              <p className="font-medium">{record.type}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                ID technique
              </label>
              <p className="font-mono text-sm">{record.rawAnomaly.mrid}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Date de détection
              </label>
              <p>{record.submissionDate}</p>
            </div>
            {record.rawAnomaly.feederName && (
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Départ
                </label>
                <p>{record.rawAnomaly.feederName}</p>
              </div>
            )}
          </div>

          {/* Détails complets de l'équipement */}
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-2 block">
              Détails de l'équipement collecté
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
                {allFields.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4 col-span-2">
                    Aucun détail disponible
                  </p>
                )}
              </div>
            </div>
          </div>

         
        </div>
      </div>
    </div>
  );
}

export default function NewDataPage() {
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
  const [selectedRecord, setSelectedRecord] = useState<NewDataRecord | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Récupérer les vraies nouvelles données pour le départ sélectionné
  const newDataRecords = useMemo(() => {
    if (!selectedDeparture) return [];
    
    // Récupérer les anomalies de type "new" pour ce départ
    const anomalies = getAnomaliesByFeeder(selectedDeparture.feederId, "new");
    
    // Convertir chaque anomalie en NewDataRecord
    const records: NewDataRecord[] = [];
    for (const anomaly of anomalies) {
      const converted = convertAnomalyToNewData(anomaly);
      if (converted) {
        records.push(converted);
      }
    }
    
    return records;
  }, [selectedDeparture]);

  // Filter new data records
  const filteredRecords = useMemo(() => {
    if (!searchQuery) return newDataRecords;
    const query = searchQuery.toLowerCase();
    return newDataRecords.filter(
      (record) =>
        record.code.toLowerCase().includes(query) ||
        record.title.toLowerCase().includes(query) ||
        record.type.toLowerCase().includes(query) ||
        record.description.toLowerCase().includes(query)
    );
  }, [newDataRecords, searchQuery]);

  // Calculer les stats globales
  const globalStats = useMemo(() => {
    let totalNewData = 0;
    
    eneoRegions.forEach((region) => {
      region.zones.forEach((zone) => {
        zone.departures.forEach((departure) => {
          const anomalies = getAnomaliesByFeeder(departure.feederId, "new");
          totalNewData += anomalies.length;
        });
      });
    });

    return {
      total: totalNewData,
      pendingAndInProgress: totalNewData,
      completed: 0,
      completionRate: 0,
    };
  }, []);

  // Build breadcrumb
  const breadcrumbItems: BreadcrumbItem[] = useMemo(() => {
    const items: BreadcrumbItem[] = [
      { id: "home", label: "Nouvelles Données", type: "home" },
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
    setViewLevel("newData");
  };

  // New data actions
  const handleViewRecord = (record: NewDataRecord) => {
    setSelectedRecord(record);
    setIsDetailModalOpen(true);
  };

  const handleKeepRecord = (record: NewDataRecord) => {
    toast.success(`Équipement ${record.title} intégré à la base de référence`);
    setIsDetailModalOpen(false);
  };

  const handleDeleteRecord = (record: NewDataRecord) => {
    toast.info(`Équipement ${record.title} supprimé de la collecte`);
    setIsDetailModalOpen(false);
  };

  const handleReviewRecord = (record: NewDataRecord) => {
    setSelectedRecord(record);
    setIsDetailModalOpen(true);
  };

  const handleBulkAction = (recordIds: string[], action: string) => {
    const actionLabel = action === "keep" ? "intégrés" : "supprimés";
    toast.success(`${recordIds.length} équipement(s) ${actionLabel}`);
  };

  // Filter regions by search
  const filteredRegions = useMemo(() => {
    if (!searchQuery) return eneoRegions;
    const query = searchQuery.toLowerCase();
    return eneoRegions.filter(
      (r) =>
        r.code.toLowerCase().includes(query) ||
        r.name.toLowerCase().includes(query) ||
        r.fullName.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  const filteredZones = useMemo(() => {
    if (!selectedRegion) return [];
    if (!searchQuery) return selectedRegion.zones;
    const query = searchQuery.toLowerCase();
    return selectedRegion.zones.filter(
      (z) => z.code.toLowerCase().includes(query) || z.name.toLowerCase().includes(query)
    );
  }, [selectedRegion, searchQuery]);

  const filteredDepartures = useMemo(() => {
    if (!selectedZone) return [];
    if (!searchQuery) return selectedZone.departures;
    const query = searchQuery.toLowerCase();
    return selectedZone.departures.filter(
      (d) => d.code.toLowerCase().includes(query) || d.name.toLowerCase().includes(query)
    );
  }, [selectedZone, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <FilePlus className="h-7 w-7 text-green-600" />
            Nouvelles Données
          </h1>
          <p className="text-muted-foreground mt-1">
            Équipements détectés sur le terrain et absents de la base de référence
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
          <h2 className="text-xl font-semibold mb-4">Découpage Eneo ({filteredRegions.length})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRegions.map((region) => {
              let regionNewCount = 0;
              region.zones.forEach(zone => {
                zone.departures.forEach(departure => {
                  regionNewCount += getAnomaliesByFeeder(departure.feederId, "new").length;
                });
              });
              
              const stats = {
                total: regionNewCount,
                pending: regionNewCount,
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
          {filteredRegions.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              Aucune region trouvée pour &quot;{searchQuery}&quot;
            </div>
          )}
        </div>
      )}

      {viewLevel === "zones" && selectedRegion && (
        <div>
          <h2 className="text-xl font-semibold mb-4">
            Zones de {selectedRegion.fullName} ({filteredZones.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredZones.map((zone) => {
              let zoneNewCount = 0;
              zone.departures.forEach(departure => {
                zoneNewCount += getAnomaliesByFeeder(departure.feederId, "new").length;
              });
              
              const stats = {
                total: zoneNewCount,
                pending: zoneNewCount,
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
          {filteredZones.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              Aucune zone trouvée pour &quot;{searchQuery}&quot;
            </div>
          )}
        </div>
      )}

      {viewLevel === "departures" && selectedZone && (
        <div>
          <h2 className="text-xl font-semibold mb-4">
            Départs de {selectedZone.name} ({filteredDepartures.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDepartures.map((departure) => {
              const newCount = getAnomaliesByFeeder(departure.feederId, "new").length;
              return (
                <DepartureCard
                  key={departure.id}
                  code={departure.code}
                  name={departure.name}
                  equipmentCount={newCount}
                  completedCount={0}
                  pendingCount={newCount}
                  onClick={() => handleDepartureClick(departure)}
                />
              );
            })}
          </div>
          {filteredDepartures.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              Aucun départ trouvé pour &quot;{searchQuery}&quot;
            </div>
          )}
        </div>
      )}

      {viewLevel === "newData" && selectedDeparture && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              Nouvelles données du départ {selectedDeparture.code} ({filteredRecords.length})
            </h2>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FilePlus className="h-5 w-5 text-green-600" />
                Équipements détectés sur le terrain
              </CardTitle>
              <CardDescription>
                Ces équipements sont présents dans la collecte terrain mais absents de la base de référence.
                Choisissez de les intégrer ou de les supprimer.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <NewDataTable
                records={filteredRecords}
                onView={handleViewRecord}
                onKeep={handleKeepRecord}
                onDelete={handleDeleteRecord}
                onReview={handleReviewRecord}
                onBulkAction={handleBulkAction}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal */}
      <NewDataDetailModal
        record={selectedRecord}
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        onKeep={handleKeepRecord}
        onDelete={handleDeleteRecord}
      />
    </div>
  );
}
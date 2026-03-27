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
import { Search, FileX, AlertCircle, CheckCircle, MapPin, Calendar, Clock } from "lucide-react";
import { toast } from "sonner";
import { 
  eneoRegions, 
  getAnomaliesByFeeder, 
  EneoRegion, 
  EneoZone, 
  EneoDeparture,
  AnomalyCase,
  getGlobalMissingStats
} from "@/lib/api/eneo-data";

type ViewLevel = "regions" | "zones" | "departures" | "missing";

// Type pour les enregistrements manquants basé sur les anomalies réelles
interface MissingRecord {
  id: string;
  code: string;
  type: string;
  table: string;
  name: string;
  description: string;
  expectedDate: string;
  location?: string;
  metadata: {
    [key: string]: unknown;
  };
  rawAnomaly: AnomalyCase;
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
function getRecordName(record: Record<string, unknown>, table: string): string {
  if (record.name) return String(record.name);
  if (record.code) return String(record.code);
  if (record.local_name) return String(record.local_name);
  return `${getEquipmentTypeLabel(table)} ${record.m_rid}`;
}

// Obtenir une description des champs importants
function getRecordDescription(record: Record<string, unknown>, table: string): string {
  const importantFields: Record<string, string[]> = {
    substation: ["type", "regime", "localisation", "voltage"],
    powertransformer: ["apparent_power", "w1_voltage", "w2_voltage"],
    busbar: ["voltage", "phase"],
    bay: ["type", "voltage"],
    switch: ["nature", "type", "normal_open"],
    wire: ["nature_conducteur", "section", "phase"],
    pole: ["height", "type"],
    node: ["code"],
    feeder: ["voltage", "is_injection"],
  };
  
  const fields = importantFields[table] || ["name", "code", "type"];
  const descriptions = fields
    .filter(f => record[f] !== undefined && record[f] !== null && record[f] !== "")
    .map(f => `${f}: ${formatValue(record[f])}`);
  
  if (descriptions.length === 0) return "Équipement à collecter";
  return descriptions.join(" • ");
}

// Obtenir la localisation si disponible
function getRecordLocation(record: Record<string, unknown>): string | undefined {
  if (record.localisation && String(record.localisation).trim()) {
    return String(record.localisation);
  }
  if (record.latitude && record.longitude) {
    return `${record.latitude}, ${record.longitude}`;
  }
  return undefined;
}

// Convertir une anomalie de type "missing" en MissingRecord
function convertAnomalyToMissing(anomaly: AnomalyCase): MissingRecord | null {
  if (anomaly.type !== "missing" || !anomaly.layer1Record) return null;
  
  const record = anomaly.layer1Record;
  const table = anomaly.table;
  const name = getRecordName(record, table);
  const description = getRecordDescription(record, table);
  const location = getRecordLocation(record);
  
  // Extraire les métadonnées importantes
  const metadata: Record<string, unknown> = {};
  const importantFields = ["voltage", "apparent_power", "type", "regime", "section", "height", "phase", "active"];
  importantFields.forEach(field => {
    if (record[field] !== undefined && record[field] !== null && record[field] !== "") {
      metadata[field] = record[field];
    }
  });
  
  // Date de création ou date attendue
  const expectedDate = (record.created_date as string)?.split('T')[0] || new Date().toISOString().split('T')[0];
  
  return {
    id: anomaly.id,
    code: `${table.toUpperCase()}-${record.m_rid || record.code || "MISSING"}`,
    type: getEquipmentTypeLabel(table),
    table: table,
    name: name,
    description: description,
    expectedDate: expectedDate,
    location: location,
    metadata: metadata,
    rawAnomaly: anomaly,
  };
}

// Composant pour afficher les enregistrements manquants
function MissingRecordsTable({ 
  records, 
  onView,
  onBulkAction 
}: { 
  records: MissingRecord[];
  onView: (record: MissingRecord) => void;
  onBulkAction: (ids: string[], action: string) => void;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  const filteredRecords = records.filter(record => 
    record.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
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
            placeholder="Rechercher un équipement..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        {selectedIds.length > 0 && (
          <div className="flex gap-2">
            <button
              onClick={() => onBulkAction(selectedIds, "export")}
              className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center gap-1"
            >
              <FileX className="h-3 w-3" />
              Exporter liste ({selectedIds.length})
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
              <th className="text-left p-3 font-medium">Localisation</th>
              <th className="text-left p-3 font-medium">Date attendue</th>
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
                  <div className="font-medium text-sm mt-1">{record.name}</div>
                </td>
                <td className="p-3">
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                    {record.type}
                  </span>
                </td>
                <td className="p-3 max-w-xs">
                  <p className="text-sm text-muted-foreground">{record.description}</p>
                </td>
                <td className="p-3">
                  {record.location ? (
                    <div className="flex items-center gap-1 text-sm">
                      <MapPin className="h-3 w-3 text-muted-foreground" />
                      <span className="truncate max-w-[150px]">{record.location}</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-sm">—</span>
                  )}
                </td>
                <td className="p-3 text-sm">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-muted-foreground" />
                    {record.expectedDate}
                  </div>
                </td>
                <td className="p-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => onView(record)}
                      className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
                    >
                      <AlertCircle className="h-3 w-3" />
                      Détails
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredRecords.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            Aucun enregistrement manquant trouvé pour ce départ
          </div>
        )}
      </div>
    </div>
  );
}

// Modal pour les détails d'un enregistrement manquant
function MissingRecordDetailModal({ 
  record, 
  isOpen, 
  onClose 
}: { 
  record: MissingRecord | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen || !record) return null;

  // Récupérer tous les champs de l'enregistrement BD1
  const allFields = record.rawAnomaly.layer1Record 
    ? Object.entries(record.rawAnomaly.layer1Record)
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
      created_date: "Date de création",
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
      is_injection: "Injection",
      local_name: "Nom local",
      second_substation_id: "ID poste secondaire",
      exploitation: "Exploitation",
      zone_type: "Type de zone",
      security_zone_id: "Zone de sécurité",
      t1: "Terminal 1",
      t2: "Terminal 2",
      bay_mrid: "Travée",
      nature: "Nature",
      normal_open: "Normalement ouvert",
      pole_mrid: "Poteau",
      installation_date: "Date installation",
      lastvisit_date: "Dernière visite",
      pole_id: "Poteau",
      is_derivation: "Dérivation",
    };
    return labels[key] || key;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[95vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <FileX className="h-5 w-5 text-orange-600" />
            Équipement à collecter
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            ✕
          </button>
        </div>

        <div className="space-y-4">
          {/* Informations générales */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
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
                À collecter avant
              </label>
              <p className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {record.expectedDate}
              </p>
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

          {/* Localisation */}
          {record.location && (
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1 block">
                Localisation
              </label>
              <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
                <MapPin className="h-4 w-4 text-blue-600" />
                <span className="text-sm">{record.location}</span>
              </div>
            </div>
          )}

          {/* Détails complets de l'équipement */}
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-2 block">
              Caractéristiques techniques
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

          {/* Note d'information */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5" />
              <div className="text-sm text-amber-800">
                <p className="font-medium">À collecter sur le terrain</p>
                <p className="text-xs mt-1">
                  Cet équipement est présent dans la base de référence mais n'a pas encore été collecté.
                  Prévoyez sa collecte lors de la prochaine tournée terrain.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MissingRecordsPage() {
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
  const [selectedRecord, setSelectedRecord] = useState<MissingRecord | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Récupérer les vraies données manquantes pour le départ sélectionné
  const missingRecords = useMemo(() => {
    if (!selectedDeparture) return [];
    
    // Récupérer les anomalies de type "missing" pour ce départ
    const anomalies = getAnomaliesByFeeder(selectedDeparture.feederId, "missing");
    
    // Convertir chaque anomalie en MissingRecord
    const records: MissingRecord[] = [];
    for (const anomaly of anomalies) {
      const converted = convertAnomalyToMissing(anomaly);
      if (converted) {
        records.push(converted);
      }
    }
    
    return records;
  }, [selectedDeparture]);

  // Filter missing records
  const filteredRecords = useMemo(() => {
    if (!searchQuery) return missingRecords;
    const query = searchQuery.toLowerCase();
    return missingRecords.filter(
      (record) =>
        record.code.toLowerCase().includes(query) ||
        record.type.toLowerCase().includes(query) ||
        record.name.toLowerCase().includes(query) ||
        record.description.toLowerCase().includes(query)
    );
  }, [missingRecords, searchQuery]);

  // Calculer les stats globales
  const globalStats = useMemo(() => {
  const stats = getGlobalMissingStats();
  return {
    total: stats.totalAttendu,
    pendingAndInProgress: stats.manquantsRestants,
    completed: stats.totalCollectes,
    completionRate: stats.tauxProgression,
  };
}, []);

  // Build breadcrumb
  const breadcrumbItems: BreadcrumbItem[] = useMemo(() => {
    const items: BreadcrumbItem[] = [
      { id: "home", label: "Enregistrements Manquants", type: "home" },
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
    setViewLevel("missing");
  };

  // Missing record actions
  const handleViewRecord = (record: MissingRecord) => {
    setSelectedRecord(record);
    setIsDetailModalOpen(true);
  };

  const handleBulkAction = (recordIds: string[], action: string) => {
    toast.success(`${recordIds.length} enregistrement(s) exporté(s) vers la liste de collecte`);
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
            <FileX className="h-7 w-7 text-orange-600" />
            Enregistrements Manquants
          </h1>
          <p className="text-muted-foreground mt-1">
            Équipements présents dans la base de référence mais non encore collectés sur le terrain
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
        // Calculer les stats pour toute la région en sommant les stats des départs
        let totalAttendu = 0;
        let totalCollectes = 0;
        let toatalCompleted = 0
        
        region.zones.forEach(zone => {
          zone.departures.forEach(departure => {
            if (departure.collectionStats) {
              totalAttendu += departure.collectionStats.totalAttendu;
              totalCollectes += departure.collectionStats.collectes;
            toatalCompleted += departure.collectionStats.collectes;
            }
          });
        });
        
        const manquantsRestants = totalAttendu - totalCollectes;
        const tauxProgression = totalAttendu > 0 ? Math.round((totalCollectes / totalAttendu) * 100) : 0;
        
        const stats = {
          total: totalAttendu,        // Nombre d'équipements restants à collecter
          pending: 0,      // En attente de collecte
          inProgress: manquantsRestants,      // Déjà collectés
          completed: totalCollectes,                    // Résolus (pas applicable ici)
          tauxProgression: tauxProgression // Pourcentage de progression
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
        // Calculer les stats pour la zone en sommant les stats des départs
        let totalAttendu = 0;
        let totalCollectes = 0;
        let toatalCompleted = 0
        
        zone.departures.forEach(departure => {
          if (departure.collectionStats) {
            totalAttendu += departure.collectionStats.totalAttendu;
            totalCollectes += departure.collectionStats.collectes;
            toatalCompleted += departure.collectionStats.collectes;
          }
        });
        
        const manquantsRestants = totalAttendu - totalCollectes;
        const tauxProgression = totalAttendu > 0 ? Math.round((totalCollectes / totalAttendu) * 100) : 0;
        
        const stats = {
          total: totalAttendu,        // Nombre d'équipements restants à collecter dans la zone
          pending: 0,      // En attente de collecte
          inProgress:  manquantsRestants,      // Déjà collectés
          completed: totalCollectes,                    // Résolus (pas applicable ici)
          tauxProgression: tauxProgression // Pourcentage de progression
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
        const stats = departure.collectionStats;
        return (
          <DepartureCard
            key={departure.id}
            code={departure.code}
            name={departure.name}
            equipmentCount={stats?.totalAttendu || 0}
            completedCount={stats?.collectes || 0}
            pendingCount={stats?.manquantsRestants || 0}
            onClick={() => handleDepartureClick(departure)}
          />
        );
      })}
    </div>
  </div>
)}

      {viewLevel === "missing" && selectedDeparture && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              Équipements à collecter - {selectedDeparture.code} ({filteredRecords.length})
            </h2>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileX className="h-5 w-5 text-orange-600" />
                Liste des équipements manquants
              </CardTitle>
              <CardDescription>
                Ces équipements sont présents dans la base de référence mais n'ont pas encore été collectés.
                Prévoyez leur collecte lors de la prochaine tournée terrain.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MissingRecordsTable
                records={filteredRecords}
                onView={handleViewRecord}
                onBulkAction={handleBulkAction}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal */}
      <MissingRecordDetailModal
        record={selectedRecord}
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
      />
    </div>
  );
}
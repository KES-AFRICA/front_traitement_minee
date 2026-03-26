"use client";

import { useState, useMemo, useEffect } from "react";
import { useI18n } from "@/lib/i18n/context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { RegionCard } from "@/components/complex-cases/region-card";
import { ZoneCard } from "@/components/complex-cases/zone-card";
import { DepartureCard } from "@/components/complex-cases/departure-card";
import { PeriodFilter, PeriodType } from "@/components/complex-cases/period-filter";
import { GlobalStatsCards } from "@/components/complex-cases/global-stats-cards";
import { NavigationBreadcrumb, BreadcrumbItem } from "@/components/complex-cases/navigation-breadcrumb";
import { eneoRegions, getRegionStats, getZoneStats, EneoRegion, EneoZone, EneoDeparture } from "@/lib/api/eneo-data";
import { Search, FileX, Upload, AlertCircle, CheckCircle, Clock } from "lucide-react";
import { toast } from "sonner";

type ViewLevel = "regions" | "zones" | "departures" | "missing";

// Types pour les enregistrements manquants
type MissingType = "customer" | "meter" | "reading" | "invoice" | "contract";
type MissingSeverity = "critical" | "high" | "medium" | "low";
type MissingStatus = "pending" | "investigating" | "resolved" | "ignored";

interface MissingRecord {
  id: string;
  code: string;
  type: MissingType;
  description: string;
  severity: MissingSeverity;
  status: MissingStatus;
  expectedDate: string;
  lastKnownDate?: string;
  assignedTo?: string;
  impact: string;
  suggestedAction: string;
}

// Générer des enregistrements manquants mock
function generateMockMissingRecords(departureId: string, count: number): MissingRecord[] {
  const types: MissingType[] = ["customer", "meter", "reading", "invoice", "contract"];
  const typeLabels = {
    customer: "Client",
    meter: "Compteur",
    reading: "Relevé",
    invoice: "Facture",
    contract: "Contrat"
  };
  
  const descriptions = [
    "Aucun relevé de consommation pour les 3 derniers mois",
    "Client non référencé dans le système de facturation",
    "Compteur non installé malgré la demande",
    "Facture manquante pour la période de décembre",
    "Contrat client non signé",
    "Données de consommation absentes du mois dernier",
    "Enregistrement client introuvable dans la base",
    "Relevé terrain non saisi dans le système"
  ];
  
  const severities: MissingSeverity[] = ["critical", "high", "medium", "low"];
  const statuses: MissingStatus[] = ["pending", "investigating", "resolved", "ignored"];
  const users = ["Jean Dupont", "Marie Kouam", "Paul Ndi", "Claire Biya", undefined];
  const impacts = [
    "Impossible de facturer le client",
    "Retard dans le traitement des paiements",
    "Non-conformité réglementaire",
    "Perte de revenus estimée à 500 000 FCFA",
    "Délai de traitement prolongé de 15 jours"
  ];
  const suggestedActions = [
    "Contacter le client pour obtenir les informations",
    "Vérifier les logs du système de relevé",
    "Planifier une visite terrain",
    "Recréer l'enregistrement dans le système",
    "Demander une extraction des données historiques"
  ];

  const missingRecords: MissingRecord[] = [];

  for (let i = 0; i < count; i++) {
    const expectedDate = new Date(Date.now() - Math.floor(Math.random() * 90 * 24 * 60 * 60 * 1000));
    const lastKnownDate = Math.random() > 0.3 
      ? new Date(Date.now() - Math.floor(Math.random() * 180 * 24 * 60 * 60 * 1000))
      : undefined;
    
    missingRecords.push({
      id: `${departureId}-miss-${i + 1}`,
      code: `MISS-${departureId.toUpperCase()}-${String(i + 1).padStart(3, "0")}`,
      type: types[Math.floor(Math.random() * types.length)],
      description: descriptions[Math.floor(Math.random() * descriptions.length)],
      severity: severities[Math.floor(Math.random() * severities.length)],
      status: statuses[Math.floor(Math.random() * statuses.length)],
      expectedDate: expectedDate.toLocaleDateString("fr-FR"),
      lastKnownDate: lastKnownDate?.toLocaleDateString("fr-FR"),
      assignedTo: users[Math.floor(Math.random() * users.length)],
      impact: impacts[Math.floor(Math.random() * impacts.length)],
      suggestedAction: suggestedActions[Math.floor(Math.random() * suggestedActions.length)],
    });
  }

  return missingRecords;
}

// Composant pour afficher les enregistrements manquants
function MissingRecordsTable({ 
  records, 
  onView, 
  onInvestigate, 
  onResolve, 
  onIgnore,
  onUpload,
  onBulkAction 
}: { 
  records: MissingRecord[];
  onView: (record: MissingRecord) => void;
  onInvestigate: (record: MissingRecord) => void;
  onResolve: (record: MissingRecord) => void;
  onIgnore: (record: MissingRecord) => void;
  onUpload: (record: MissingRecord) => void;
  onBulkAction: (ids: string[], action: string) => void;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  const getSeverityColor = (severity: MissingSeverity) => {
    switch (severity) {
      case "critical": return "text-red-600 bg-red-100";
      case "high": return "text-orange-600 bg-orange-100";
      case "medium": return "text-yellow-600 bg-yellow-100";
      case "low": return "text-blue-600 bg-blue-100";
      default: return "text-gray-600 bg-gray-100";
    }
  };

  const getStatusColor = (status: MissingStatus) => {
    switch (status) {
      case "pending": return "text-yellow-600 bg-yellow-100";
      case "investigating": return "text-blue-600 bg-blue-100";
      case "resolved": return "text-green-600 bg-green-100";
      case "ignored": return "text-gray-600 bg-gray-100";
      default: return "text-gray-600 bg-gray-100";
    }
  };

  const getStatusLabel = (status: MissingStatus) => {
    switch (status) {
      case "pending": return "En attente";
      case "investigating": return "En investigation";
      case "resolved": return "Résolu";
      case "ignored": return "Ignoré";
      default: return status;
    }
  };

  const getTypeLabel = (type: MissingType) => {
    const labels = {
      customer: "Client",
      meter: "Compteur",
      reading: "Relevé",
      invoice: "Facture",
      contract: "Contrat"
    };
    return labels[type];
  };

  const filteredRecords = records.filter(record => 
    record.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    getTypeLabel(record.type).toLowerCase().includes(searchTerm.toLowerCase()) ||
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
            placeholder="Rechercher un enregistrement..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        {selectedIds.length > 0 && (
          <div className="flex gap-2">
            <button
              onClick={() => onBulkAction(selectedIds, "investigate")}
              className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Investiguer ({selectedIds.length})
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

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
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
              <th className="text-left p-3 font-medium">Code</th>
              <th className="text-left p-3 font-medium">Type</th>
              <th className="text-left p-3 font-medium">Description</th>
              <th className="text-left p-3 font-medium">Sévérité</th>
              <th className="text-left p-3 font-medium">Statut</th>
              <th className="text-left p-3 font-medium">Date attendue</th>
              <th className="text-left p-3 font-medium">Assigné à</th>
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
                <td className="p-3 font-mono text-sm">{record.code}</td>
                <td className="p-3">
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100">
                    {getTypeLabel(record.type)}
                  </span>
                </td>
                <td className="p-3 max-w-xs truncate">{record.description}</td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(record.severity)}`}>
                    {record.severity === "critical" ? "Critique" :
                     record.severity === "high" ? "Élevée" :
                     record.severity === "medium" ? "Moyenne" : "Faible"}
                  </span>
                </td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(record.status)}`}>
                    {getStatusLabel(record.status)}
                  </span>
                </td>
                <td className="p-3 text-sm">{record.expectedDate}</td>
                <td className="p-3 text-sm">{record.assignedTo || "Non assigné"}</td>
                <td className="p-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => onView(record)}
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      Voir
                    </button>
                    {record.status === "pending" && (
                      <button
                        onClick={() => onInvestigate(record)}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        Investiguer
                      </button>
                    )}
                    {record.status === "investigating" && (
                      <>
                        <button
                          onClick={() => onResolve(record)}
                          className="text-green-600 hover:text-green-800 text-sm"
                        >
                          Résoudre
                        </button>
                        <button
                          onClick={() => onUpload(record)}
                          className="text-purple-600 hover:text-purple-800 text-sm flex items-center gap-1"
                        >
                          <Upload className="h-3 w-3" />
                          Importer
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredRecords.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            Aucun enregistrement manquant trouvé
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
  onClose, 
  onInvestigate, 
  onResolve, 
  onIgnore,
  onUpload 
}: { 
  record: MissingRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onInvestigate: (record: MissingRecord) => void;
  onResolve: (record: MissingRecord) => void;
  onIgnore: (record: MissingRecord) => void;
  onUpload: (record: MissingRecord) => void;
}) {
  if (!isOpen || !record) return null;

  const getTypeLabel = (type: MissingType) => {
    const labels = {
      customer: "Client",
      meter: "Compteur",
      reading: "Relevé",
      invoice: "Facture",
      contract: "Contrat"
    };
    return labels[type];
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <FileX className="h-5 w-5 text-destructive" />
            Détails de l'enregistrement manquant
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Code</label>
              <p className="font-mono">{record.code}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Type</label>
              <p>{getTypeLabel(record.type)}</p>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground">Description</label>
            <p className="text-gray-700">{record.description}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Sévérité</label>
              <p className="capitalize">{record.severity}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Statut</label>
              <p className="capitalize">{record.status}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Date attendue</label>
              <p>{record.expectedDate}</p>
            </div>
            {record.lastKnownDate && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Dernière date connue</label>
                <p>{record.lastKnownDate}</p>
              </div>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />
              Impact
            </label>
            <p className="text-gray-700 mt-1">{record.impact}</p>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground">Action suggérée</label>
            <p className="text-gray-700 mt-1">{record.suggestedAction}</p>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground">Assigné à</label>
            <p>{record.assignedTo || "Non assigné"}</p>
          </div>

          <div className="flex gap-2 pt-4 border-t">
            {record.status === "pending" && (
              <button
                onClick={() => onInvestigate(record)}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center gap-2"
              >
                <Clock className="h-4 w-4" />
                Démarrer l'investigation
              </button>
            )}
            {record.status === "investigating" && (
              <>
                <button
                  onClick={() => onResolve(record)}
                  className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 flex items-center gap-2"
                >
                  <CheckCircle className="h-4 w-4" />
                  Marquer comme résolu
                </button>
                <button
                  onClick={() => onUpload(record)}
                  className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 flex items-center gap-2"
                >
                  <Upload className="h-4 w-4" />
                  Importer l'enregistrement
                </button>
              </>
            )}
            <button
              onClick={() => onIgnore(record)}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Ignorer
            </button>
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

  // Generate missing records for selected departure
  const missingRecords = useMemo(() => {
    if (selectedDeparture) {
      return generateMockMissingRecords(selectedDeparture.id, selectedDeparture.equipmentCount);
    }
    return [];
  }, [selectedDeparture]);

  // Filter missing records
  const filteredRecords = useMemo(() => {
    if (!searchQuery) return missingRecords;
    const query = searchQuery.toLowerCase();
    return missingRecords.filter(
      (record) =>
        record.code.toLowerCase().includes(query) ||
        record.description.toLowerCase().includes(query)
    );
  }, [missingRecords, searchQuery]);

  // Calculate global stats
  const globalStats = useMemo(() => {
    let total = 0;
    let pending = 0;
    let investigating = 0;
    let resolved = 0;

    eneoRegions.forEach((region) => {
      const stats = getRegionStats(region.id);
      total += stats.total;
      pending += stats.pending;
      investigating += stats.inProgress;
      resolved += stats.completed;
    });

    return {
      total,
      pendingAndInProgress: pending + investigating,
      completed: resolved,
      completionRate: total > 0 ? Math.round((resolved / total) * 100) : 0,
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

  const handleInvestigateRecord = (record: MissingRecord) => {
    toast.success(`Investigation lancée pour ${record.code}`);
    setIsDetailModalOpen(false);
  };

  const handleResolveRecord = (record: MissingRecord) => {
    toast.success(`Enregistrement ${record.code} marqué comme résolu`);
    setIsDetailModalOpen(false);
  };

  const handleIgnoreRecord = (record: MissingRecord) => {
    toast.info(`Enregistrement ${record.code} ignoré`);
    setIsDetailModalOpen(false);
  };

  const handleUploadRecord = (record: MissingRecord) => {
    toast.info(`Import d'enregistrement pour ${record.code} - Fonctionnalité à venir`);
    setIsDetailModalOpen(false);
  };

  const handleBulkAction = (recordIds: string[], action: string) => {
    toast.success(`${recordIds.length} enregistrement(s) ${action === "investigate" ? "en cours d'investigation" : "résolus"}`);
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

  // Filter zones by search
  const filteredZones = useMemo(() => {
    if (!selectedRegion) return [];
    if (!searchQuery) return selectedRegion.zones;
    const query = searchQuery.toLowerCase();
    return selectedRegion.zones.filter(
      (z) => z.code.toLowerCase().includes(query) || z.name.toLowerCase().includes(query)
    );
  }, [selectedRegion, searchQuery]);

  // Filter departures by search
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
            <FileX className="h-7 w-7 text-destructive" />
            Enregistrements Manquants
          </h1>
          <p className="text-muted-foreground mt-1">
            Identification et traitement des enregistrements absents dans les systèmes
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
          <h2 className="text-xl font-semibold mb-4">Regions ENEO ({filteredRegions.length})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRegions.map((region) => {
              const stats = getRegionStats(region.id);
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
              const stats = getZoneStats(zone.id);
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
            Departs de {selectedZone.name} ({filteredDepartures.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDepartures.map((departure) => {
              const completed = Math.floor(departure.equipmentCount * 0.6);
              const pending = departure.equipmentCount - completed;
              return (
                <DepartureCard
                  key={departure.id}
                  code={departure.code}
                  name={departure.name}
                  equipmentCount={departure.equipmentCount}
                  completedCount={completed}
                  pendingCount={pending}
                  onClick={() => handleDepartureClick(departure)}
                />
              );
            })}
          </div>
          {filteredDepartures.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              Aucun depart trouvé pour &quot;{searchQuery}&quot;
            </div>
          )}
        </div>
      )}

      {viewLevel === "missing" && selectedDeparture && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              Enregistrements manquants du depart {selectedDeparture.code} ({filteredRecords.length})
            </h2>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileX className="h-5 w-5" />
                Liste des enregistrements manquants
              </CardTitle>
              <CardDescription>
                Gérez les enregistrements absents détectés pour le depart {selectedDeparture.name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MissingRecordsTable
                records={filteredRecords}
                onView={handleViewRecord}
                onInvestigate={handleInvestigateRecord}
                onResolve={handleResolveRecord}
                onIgnore={handleIgnoreRecord}
                onUpload={handleUploadRecord}
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
        onInvestigate={handleInvestigateRecord}
        onResolve={handleResolveRecord}
        onIgnore={handleIgnoreRecord}
        onUpload={handleUploadRecord}
      />
    </div>
  );
}
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
import { Search, Copy, CheckCircle, XCircle, GitMerge } from "lucide-react";
import { toast } from "sonner";

type ViewLevel = "regions" | "zones" | "departures" | "duplicates";

// Types pour les doublons
interface DuplicateRecord {
  id: string;
  code: string;
  type: string;
  records: DuplicateItem[];
  similarity: number;
  status: "pending" | "reviewing" | "merged" | "rejected";
  detectedAt: string;
  assignedTo?: string;
}

interface DuplicateItem {
  id: string;
  code: string;
  source: string;
  date: string;
  value: string;
}

// Générer des doublons mock
function generateMockDuplicates(departureId: string, count: number): DuplicateRecord[] {
  const types = [
    "Compteur client",
    "Facture mensuelle",
    "Relevé terrain",
    "Contrat client",
    "Point de livraison"
  ];
  
  const sources = ["SAP", "CRM", "Relevé terrain", "Facturation", "Gestion technique"];
  const statuses: DuplicateRecord["status"][] = ["pending", "reviewing", "merged", "rejected"];
  const users = ["Jean Dupont", "Marie Kouam", "Paul Ndi", "Claire Biya", undefined];

  const duplicates: DuplicateRecord[] = [];

  for (let i = 0; i < count; i++) {
    const detectedDate = new Date(Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000));
    const similarity = 85 + Math.floor(Math.random() * 15);
    
    duplicates.push({
      id: `${departureId}-dup-${i + 1}`,
      code: `DUP-${departureId.toUpperCase()}-${String(i + 1).padStart(3, "0")}`,
      type: types[Math.floor(Math.random() * types.length)],
      records: [
        {
          id: `rec-${i}-1`,
          code: `${departureId.toUpperCase()}-${String(i + 1).padStart(3, "0")}-A`,
          source: sources[Math.floor(Math.random() * sources.length)],
          date: new Date(Date.now() - Math.floor(Math.random() * 90 * 24 * 60 * 60 * 1000)).toLocaleDateString("fr-FR"),
          value: `${Math.floor(Math.random() * 10000)} kWh`
        },
        {
          id: `rec-${i}-2`,
          code: `${departureId.toUpperCase()}-${String(i + 1).padStart(3, "0")}-B`,
          source: sources[Math.floor(Math.random() * sources.length)],
          date: new Date(Date.now() - Math.floor(Math.random() * 90 * 24 * 60 * 60 * 1000)).toLocaleDateString("fr-FR"),
          value: `${Math.floor(Math.random() * 10000)} kWh`
        }
      ],
      similarity,
      status: statuses[Math.floor(Math.random() * statuses.length)],
      detectedAt: detectedDate.toLocaleDateString("fr-FR"),
      assignedTo: users[Math.floor(Math.random() * users.length)],
    });
  }

  return duplicates;
}

// Composant pour afficher les doublons
function DuplicateTable({ 
  duplicates, 
  onView, 
  onMerge, 
  onKeep, 
  onDiscard,
  onReview,
  onBulkAction 
}: { 
  duplicates: DuplicateRecord[];
  onView: (duplicate: DuplicateRecord) => void;
  onMerge: (duplicate: DuplicateRecord) => void;
  onKeep: (duplicate: DuplicateRecord) => void;
  onDiscard: (duplicate: DuplicateRecord) => void;
  onReview: (duplicate: DuplicateRecord) => void;
  onBulkAction: (ids: string[], action: string) => void;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  const getStatusColor = (status: DuplicateRecord["status"]) => {
    switch (status) {
      case "pending": return "text-yellow-600 bg-yellow-100";
      case "reviewing": return "text-blue-600 bg-blue-100";
      case "merged": return "text-green-600 bg-green-100";
      case "rejected": return "text-gray-600 bg-gray-100";
      default: return "text-gray-600 bg-gray-100";
    }
  };

  const getStatusLabel = (status: DuplicateRecord["status"]) => {
    switch (status) {
      case "pending": return "En attente";
      case "reviewing": return "En revue";
      case "merged": return "Fusionné";
      case "rejected": return "Rejeté";
      default: return status;
    }
  };

  const getSimilarityColor = (similarity: number) => {
    if (similarity >= 95) return "text-red-600";
    if (similarity >= 90) return "text-orange-600";
    if (similarity >= 85) return "text-yellow-600";
    return "text-blue-600";
  };

  const filteredDuplicates = duplicates.filter(dup => 
    dup.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    dup.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    dup.records.some(rec => rec.code.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleSelectAll = () => {
    if (selectedIds.length === filteredDuplicates.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredDuplicates.map(d => d.id));
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
            placeholder="Rechercher un doublon..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        {selectedIds.length > 0 && (
          <div className="flex gap-2">
            <button
              onClick={() => onBulkAction(selectedIds, "merge")}
              className="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600 flex items-center gap-1"
            >
              <GitMerge className="h-3 w-3" />
              Fusionner ({selectedIds.length})
            </button>
            <button
              onClick={() => onBulkAction(selectedIds, "reject")}
              className="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Rejeter ({selectedIds.length})
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
                  checked={selectedIds.length === filteredDuplicates.length && filteredDuplicates.length > 0}
                  onChange={handleSelectAll}
                  className="rounded border-gray-300"
                />
              </th>
              <th className="text-left p-3 font-medium">Code</th>
              <th className="text-left p-3 font-medium">Type</th>
              <th className="text-left p-3 font-medium">Enregistrements</th>
              <th className="text-left p-3 font-medium">Similarité</th>
              <th className="text-left p-3 font-medium">Statut</th>
              <th className="text-left p-3 font-medium">Détecté le</th>
              <th className="text-left p-3 font-medium">Assigné à</th>
              <th className="text-left p-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredDuplicates.map((duplicate) => (
              <tr key={duplicate.id} className="border-b hover:bg-muted/30">
                <td className="p-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(duplicate.id)}
                    onChange={() => handleSelect(duplicate.id)}
                    className="rounded border-gray-300"
                  />
                </td>
                <td className="p-3 font-mono text-sm">{duplicate.code}</td>
                <td className="p-3">{duplicate.type}</td>
                <td className="p-3">
                  <div className="space-y-1">
                    {duplicate.records.map((record, idx) => (
                      <div key={record.id} className="text-sm">
                        <span className="font-mono">{record.code}</span>
                        <span className="text-muted-foreground ml-2">({record.source})</span>
                      </div>
                    ))}
                  </div>
                </td>
                <td className="p-3">
                  <span className={`font-semibold ${getSimilarityColor(duplicate.similarity)}`}>
                    {duplicate.similarity}%
                  </span>
                </td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(duplicate.status)}`}>
                    {getStatusLabel(duplicate.status)}
                  </span>
                </td>
                <td className="p-3 text-sm">{duplicate.detectedAt}</td>
                <td className="p-3 text-sm">{duplicate.assignedTo || "Non assigné"}</td>
                <td className="p-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => onView(duplicate)}
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      Voir
                    </button>
                    {duplicate.status === "pending" && (
                      <button
                        onClick={() => onReview(duplicate)}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        Analyser
                      </button>
                    )}
                    {duplicate.status === "reviewing" && (
                      <>
                        <button
                          onClick={() => onMerge(duplicate)}
                          className="text-green-600 hover:text-green-800 text-sm flex items-center gap-1"
                        >
                          <GitMerge className="h-3 w-3" />
                          Fusionner
                        </button>
                        <button
                          onClick={() => onDiscard(duplicate)}
                          className="text-gray-600 hover:text-gray-800 text-sm"
                        >
                          Rejeter
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredDuplicates.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            Aucun doublon trouvé
          </div>
        )}
      </div>
    </div>
  );
}

// Modal pour les détails d'un doublon
function DuplicateDetailModal({ 
  duplicate, 
  isOpen, 
  onClose, 
  onMerge, 
  onKeep, 
  onDiscard 
}: { 
  duplicate: DuplicateRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onMerge: (duplicate: DuplicateRecord) => void;
  onKeep: (duplicate: DuplicateRecord) => void;
  onDiscard: (duplicate: DuplicateRecord) => void;
}) {
  const [selectedRecord, setSelectedRecord] = useState<string | null>(null);

  if (!isOpen || !duplicate) return null;

  const handleMerge = () => {
    if (selectedRecord) {
      onMerge(duplicate);
    } else {
      toast.warning("Veuillez sélectionner l'enregistrement à conserver");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Copy className="h-5 w-5" />
            Détails du doublon
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Code</label>
              <p className="font-mono">{duplicate.code}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Type</label>
              <p>{duplicate.type}</p>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground">Similarité</label>
            <div className="mt-1">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full" 
                  style={{ width: `${duplicate.similarity}%` }}
                />
              </div>
              <p className="text-sm mt-1">{duplicate.similarity}% de similarité</p>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground mb-2 block">
              Enregistrements en conflit
            </label>
            <div className="grid grid-cols-2 gap-4">
              {duplicate.records.map((record, idx) => (
                <div 
                  key={record.id}
                  className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                    selectedRecord === record.id 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedRecord(record.id)}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-mono font-medium">{record.code}</p>
                      <p className="text-sm text-muted-foreground mt-1">{record.source}</p>
                      <p className="text-sm mt-2">Date: {record.date}</p>
                      <p className="text-sm">Valeur: {record.value}</p>
                    </div>
                    <div className="flex items-center">
                      {selectedRecord === record.id && (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-4 border-t">
            <button
              onClick={handleMerge}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 flex items-center gap-2"
            >
              <GitMerge className="h-4 w-4" />
              Fusionner
            </button>
            <button
              onClick={() => onDiscard(duplicate)}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 flex items-center gap-2"
            >
              <XCircle className="h-4 w-4" />
              Rejeter les deux
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DuplicatesPage() {
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
  const [selectedDuplicate, setSelectedDuplicate] = useState<DuplicateRecord | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Generate duplicates for selected departure
  const duplicates = useMemo(() => {
    if (selectedDeparture) {
      return generateMockDuplicates(selectedDeparture.id, selectedDeparture.equipmentCount);
    }
    return [];
  }, [selectedDeparture]);

  // Filter duplicates
  const filteredDuplicates = useMemo(() => {
    if (!searchQuery) return duplicates;
    const query = searchQuery.toLowerCase();
    return duplicates.filter(
      (dup) =>
        dup.code.toLowerCase().includes(query) ||
        dup.type.toLowerCase().includes(query) ||
        dup.records.some(rec => rec.code.toLowerCase().includes(query))
    );
  }, [duplicates, searchQuery]);

  // Calculate global stats
  const globalStats = useMemo(() => {
    let total = 0;
    let pending = 0;
    let reviewing = 0;
    let merged = 0;

    eneoRegions.forEach((region) => {
      const stats = getRegionStats(region.id);
      total += stats.total;
      pending += stats.pending;
      reviewing += stats.inProgress;
      merged += stats.completed;
    });

    return {
      total,
      pendingAndInProgress: pending + reviewing,
      completed: merged,
      completionRate: total > 0 ? Math.round((merged / total) * 100) : 0,
    };
  }, []);

  // Build breadcrumb
  const breadcrumbItems: BreadcrumbItem[] = useMemo(() => {
    const items: BreadcrumbItem[] = [
      { id: "home", label: "Doublons", type: "home" },
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
    setViewLevel("duplicates");
  };

  // Duplicate actions
  const handleViewDuplicate = (duplicate: DuplicateRecord) => {
    setSelectedDuplicate(duplicate);
    setIsDetailModalOpen(true);
  };

  const handleMergeDuplicate = (duplicate: DuplicateRecord) => {
    toast.success(`Fusion des enregistrements pour ${duplicate.code}`);
    setIsDetailModalOpen(false);
  };

  const handleKeepDuplicate = (duplicate: DuplicateRecord) => {
    toast.success(`Enregistrement conservé pour ${duplicate.code}`);
    setIsDetailModalOpen(false);
  };

  const handleDiscardDuplicate = (duplicate: DuplicateRecord) => {
    toast.info(`Doublon ${duplicate.code} rejeté`);
    setIsDetailModalOpen(false);
  };

  const handleReviewDuplicate = (duplicate: DuplicateRecord) => {
    toast.info(`Analyse du doublon ${duplicate.code} en cours`);
    setSelectedDuplicate(duplicate);
    setIsDetailModalOpen(true);
  };

  const handleBulkAction = (duplicateIds: string[], action: string) => {
    toast.success(`${duplicateIds.length} doublon(s) ${action === "merge" ? "fusionnés" : "rejetés"}`);
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
            <Copy className="h-7 w-7" />
            Doublons
          </h1>
          <p className="text-muted-foreground mt-1">
            Détection et gestion des enregistrements en double
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

      {viewLevel === "duplicates" && selectedDeparture && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              Doublons du depart {selectedDeparture.code} ({filteredDuplicates.length})
            </h2>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Copy className="h-5 w-5" />
                Liste des enregistrements en double
              </CardTitle>
              <CardDescription>
                Gérez les doublons détectés pour le depart {selectedDeparture.name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DuplicateTable
                duplicates={filteredDuplicates}
                onView={handleViewDuplicate}
                onMerge={handleMergeDuplicate}
                onKeep={handleKeepDuplicate}
                onDiscard={handleDiscardDuplicate}
                onReview={handleReviewDuplicate}
                onBulkAction={handleBulkAction}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal */}
      <DuplicateDetailModal
        duplicate={selectedDuplicate}
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        onMerge={handleMergeDuplicate}
        onKeep={handleKeepDuplicate}
        onDiscard={handleDiscardDuplicate}
      />
    </div>
  );
}
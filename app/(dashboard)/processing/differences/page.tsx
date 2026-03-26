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
import { eneoRegions, getRegionStats, getZoneStats, EneoRegion, EneoZone, EneoDeparture } from "@/lib/api/eneo-data";
import { GitCompare, Search } from "lucide-react";
import { toast } from "sonner";

// Types pour les divergences
type DivergenceSeverity = "critical" | "high" | "medium" | "low";
type DivergenceStatus = "pending" | "analyzing" | "resolved" | "ignored";

interface Divergence {
  id: string;
  code: string;
  type: string;
  description: string;
  severity: DivergenceSeverity;
  status: DivergenceStatus;
  detectedAt: string;
  assignedTo?: string;
  departureCode?: string;
}

type ViewLevel = "regions" | "zones" | "departures" | "divergences";

// Générer des divergences mock
function generateMockDivergences(departureId: string, count: number): Divergence[] {
  const types = [
    "Écart de consommation",
    "Incohérence de facturation",
    "Défaut de comptage",
    "Anomalie de relevé",
    "Non-conformité technique"
  ];
  const descriptions = [
    "Différence de 15% entre la consommation relevée et estimée",
    "Écart de facturation sur les 3 derniers mois",
    "Compteur défaillant nécessitant un remplacement",
    "Incohérence dans les données de relevé terrain",
    "Non-respect des spécifications techniques installées",
    "Anomalie détectée lors de l'audit énergétique"
  ];
  const severities: DivergenceSeverity[] = ["critical", "high", "medium", "low"];
  const statuses: DivergenceStatus[] = ["pending", "analyzing", "resolved", "ignored"];
  const users = ["Jean Dupont", "Marie Kouam", "Paul Ndi", "Claire Biya", undefined];

  const divergences: Divergence[] = [];

  for (let i = 0; i < count; i++) {
    const detectedDate = new Date(Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000));
    
    divergences.push({
      id: `${departureId}-div-${i + 1}`,
      code: `DIV-${departureId.toUpperCase()}-${String(i + 1).padStart(3, "0")}`,
      type: types[Math.floor(Math.random() * types.length)],
      description: descriptions[Math.floor(Math.random() * descriptions.length)],
      severity: severities[Math.floor(Math.random() * severities.length)],
      status: statuses[Math.floor(Math.random() * statuses.length)],
      detectedAt: detectedDate.toLocaleDateString("fr-FR"),
      assignedTo: users[Math.floor(Math.random() * users.length)],
      departureCode: `DEP-${departureId.toUpperCase()}`,
    });
  }

  return divergences;
}

// Composant pour afficher une divergence (à créer séparément si besoin)
function DivergenceTable({ 
  divergences, 
  onView, 
  onAnalyze, 
  onResolve, 
  onIgnore,
  onAddComment,
  onBulkAction 
}: { 
  divergences: Divergence[];
  onView: (divergence: Divergence) => void;
  onAnalyze: (divergence: Divergence) => void;
  onResolve: (divergence: Divergence) => void;
  onIgnore: (divergence: Divergence) => void;
  onAddComment: (divergence: Divergence) => void;
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

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
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
              <th className="text-left p-3 font-medium">Code</th>
              <th className="text-left p-3 font-medium">Type</th>
              <th className="text-left p-3 font-medium">Description</th>
              <th className="text-left p-3 font-medium">Sévérité</th>
              <th className="text-left p-3 font-medium">Statut</th>
              <th className="text-left p-3 font-medium">Détecté le</th>
              <th className="text-left p-3 font-medium">Assigné à</th>
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
                <td className="p-3 font-mono text-sm">{divergence.code}</td>
                <td className="p-3">{divergence.type}</td>
                <td className="p-3 max-w-xs truncate">{divergence.description}</td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(divergence.severity)}`}>
                    {divergence.severity === "critical" ? "Critique" :
                     divergence.severity === "high" ? "Élevée" :
                     divergence.severity === "medium" ? "Moyenne" : "Faible"}
                  </span>
                </td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(divergence.status)}`}>
                    {getStatusLabel(divergence.status)}
                  </span>
                </td>
                <td className="p-3 text-sm">{divergence.detectedAt}</td>
                <td className="p-3 text-sm">{divergence.assignedTo || "Non assigné"}</td>
                <td className="p-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => onView(divergence)}
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      Voir
                    </button>
                    {divergence.status === "pending" && (
                      <button
                        onClick={() => onAnalyze(divergence)}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        Analyser
                      </button>
                    )}
                    {divergence.status === "analyzing" && (
                      <button
                        onClick={() => onResolve(divergence)}
                        className="text-green-600 hover:text-green-800 text-sm"
                      >
                        Résoudre
                      </button>
                    )}
                    <button
                      onClick={() => onAddComment(divergence)}
                      className="text-gray-600 hover:text-gray-800 text-sm"
                    >
                      Commentaire
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredDivergences.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            Aucune divergence trouvée
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
  onAnalyze, 
  onResolve, 
  onIgnore,
  onAddComment 
}: { 
  divergence: Divergence | null;
  isOpen: boolean;
  onClose: () => void;
  onAnalyze: (divergence: Divergence) => void;
  onResolve: (divergence: Divergence) => void;
  onIgnore: (divergence: Divergence) => void;
  onAddComment: (divergence: Divergence, comment: string) => void;
}) {
  const [comment, setComment] = useState("");

  if (!isOpen || !divergence) return null;

  const handleAddComment = () => {
    if (comment.trim()) {
      onAddComment(divergence, comment);
      setComment("");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Détails de la divergence</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground">Code</label>
            <p className="font-mono">{divergence.code}</p>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground">Type</label>
            <p>{divergence.type}</p>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground">Description</label>
            <p className="text-gray-700">{divergence.description}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Sévérité</label>
              <p className="capitalize">{divergence.severity}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Statut</label>
              <p className="capitalize">{divergence.status}</p>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground">Date de détection</label>
            <p>{divergence.detectedAt}</p>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground">Assigné à</label>
            <p>{divergence.assignedTo || "Non assigné"}</p>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground">Ajouter un commentaire</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="w-full p-2 border rounded-md mt-1"
              rows={3}
              placeholder="Ajoutez un commentaire..."
            />
            <button
              onClick={handleAddComment}
              className="mt-2 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Ajouter
            </button>
          </div>

          <div className="flex gap-2 pt-4 border-t">
            {divergence.status === "pending" && (
              <button
                onClick={() => onAnalyze(divergence)}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Analyser
              </button>
            )}
            {divergence.status === "analyzing" && (
              <button
                onClick={() => onResolve(divergence)}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
              >
                Résoudre
              </button>
            )}
            <button
              onClick={() => onIgnore(divergence)}
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

export default function DivergencesPage() {
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
  const [selectedDivergence, setSelectedDivergence] = useState<Divergence | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Generate divergences for selected departure
  const divergences = useMemo(() => {
    if (selectedDeparture) {
      return generateMockDivergences(selectedDeparture.id, selectedDeparture.equipmentCount);
    }
    return [];
  }, [selectedDeparture]);

  // Filter divergences
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

  // Calculate global stats
  const globalStats = useMemo(() => {
    let total = 0;
    let critical = 0;
    let high = 0;
    let medium = 0;
    let low = 0;
    let resolved = 0;

    eneoRegions.forEach((region) => {
      const stats = getRegionStats(region.id);
      total += stats.total;
      critical += stats.pending;
      high += stats.inProgress;
      medium += stats.completed;
    });

    return {
      total,
      pendingAndInProgress: critical + high,
      completed: medium,
      completionRate: total > 0 ? Math.round((medium / total) * 100) : 0,
    };
  }, []);

  // Build breadcrumb
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
    setViewLevel("divergences");
  };

  // Divergence actions
  const handleViewDivergence = (divergence: Divergence) => {
    setSelectedDivergence(divergence);
    setIsDetailModalOpen(true);
  };

  const handleAnalyzeDivergence = (divergence: Divergence) => {
    toast.success(`Analyse lancée pour ${divergence.code}`);
    setIsDetailModalOpen(false);
  };

  const handleResolveDivergence = (divergence: Divergence) => {
    toast.success(`Divergence ${divergence.code} résolue`);
    setIsDetailModalOpen(false);
  };

  const handleIgnoreDivergence = (divergence: Divergence) => {
    toast.info(`Divergence ${divergence.code} ignorée`);
    setIsDetailModalOpen(false);
  };

  const handleAddComment = (divergence: Divergence, comment: string) => {
    toast.success(`Commentaire ajouté pour ${divergence.code}`);
    setIsDetailModalOpen(false);
  };

  const handleBulkAction = (divergenceIds: string[], action: string) => {
    toast.success(`${divergenceIds.length} divergence(s) ${action === "analyze" ? "en cours d'analyse" : "résolues"}`);
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
            <GitCompare className="h-7 w-7 text-orange-500" />
            Divergences
          </h1>
          <p className="text-muted-foreground mt-1">
            Divergences d'enregistrement nécessitant une analyse et une correction
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

      {viewLevel === "divergences" && selectedDeparture && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              Divergences du depart {selectedDeparture.code} ({filteredDivergences.length})
            </h2>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle>Liste des divergences d'enregistrement</CardTitle>
              <CardDescription>
                Gérez les divergences détectées pour le depart {selectedDeparture.name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DivergenceTable
                divergences={filteredDivergences}
                onView={handleViewDivergence}
                onAnalyze={handleAnalyzeDivergence}
                onResolve={handleResolveDivergence}
                onIgnore={handleIgnoreDivergence}
                onAddComment={(div) => {
                  setSelectedDivergence(div);
                  // Ouvrir modal de commentaire si besoin
                  const comment = prompt("Ajouter un commentaire:");
                  if (comment) handleAddComment(div, comment);
                }}
                onBulkAction={handleBulkAction}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal */}
      <DivergenceDetailModal
        divergence={selectedDivergence}
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        onAnalyze={handleAnalyzeDivergence}
        onResolve={handleResolveDivergence}
        onIgnore={handleIgnoreDivergence}
        onAddComment={handleAddComment}
      />
    </div>
  );
}
"use client";

import { useState, useMemo } from "react";
import { useI18n } from "@/lib/i18n/context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { RegionCard } from "@/components/complex-cases/region-card";
import { ZoneCard } from "@/components/complex-cases/zone-card";
import { DepartureCard } from "@/components/complex-cases/departure-card";
import { PeriodFilter, PeriodType } from "@/components/complex-cases/period-filter";
import { GlobalStatsCards } from "@/components/complex-cases/global-stats-cards";
import { NavigationBreadcrumb, BreadcrumbItem } from "@/components/complex-cases/navigation-breadcrumb";
import { EquipmentTable, Equipment } from "@/components/complex-cases/equipment-table";
import { EquipmentDetailModal } from "@/components/complex-cases/equipment-detail-modal";
import { AddCommentModal } from "@/components/complex-cases/add-comment-modal";
import { eneoRegions, getRegionStats, getZoneStats, EneoRegion, EneoZone, EneoDeparture } from "@/lib/api/eneo-data";
import { AlertCircle, AlertTriangle, Search } from "lucide-react";
import { toast } from "sonner";

type ViewLevel = "regions" | "zones" | "departures" | "equipments";

// Generate mock equipments
function generateMockEquipments(departureId: string, count: number): Equipment[] {
  const types = ["Transformateur", "Poste HTA/BT", "Ligne BT", "Compteur", "Disjoncteur"];
  const locations = ["Quartier Nord", "Quartier Sud", "Zone Industrielle", "Centre-ville", "Peripherie"];
  const statuses: Equipment["status"][] = ["pending", "in_progress", "completed", "validated", "rejected"];
  const users = ["Jean Dupont", "Marie Kouam", "Paul Ndi", "Claire Biya", undefined];

  const equipments: Equipment[] = [];

  for (let i = 0; i < count; i++) {
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    equipments.push({
      id: `${departureId}-eq-${i + 1}`,
      code: `EQ-${departureId.toUpperCase()}-${String(i + 1).padStart(3, "0")}`,
      type: types[Math.floor(Math.random() * types.length)],
      location: locations[Math.floor(Math.random() * locations.length)],
      status,
      lastUpdate: new Date(Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)).toLocaleDateString("fr-FR"),
      assignedTo: users[Math.floor(Math.random() * users.length)],
    });
  }

  return equipments;
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
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);

  // Generate equipments for selected departure
  const equipments = useMemo(() => {
    if (selectedDeparture) {
      return generateMockEquipments(selectedDeparture.id, selectedDeparture.equipmentCount);
    }
    return [];
  }, [selectedDeparture]);

  // Filter equipments
  const filteredEquipments = useMemo(() => {
    if (!searchQuery) return equipments;
    const query = searchQuery.toLowerCase();
    return equipments.filter(
      (eq) =>
        eq.code.toLowerCase().includes(query) ||
        eq.type.toLowerCase().includes(query) ||
        eq.location.toLowerCase().includes(query)
    );
  }, [equipments, searchQuery]);

  // Calculate global stats
  const globalStats = useMemo(() => {
    let total = 0;
    let pending = 0;
    let inProgress = 0;
    let completed = 0;

    eneoRegions.forEach((region) => {
      const stats = getRegionStats(region.id);
      total += stats.total;
      pending += stats.pending;
      inProgress += stats.inProgress;
      completed += stats.completed;
    });

    return {
      total,
      pendingAndInProgress: pending + inProgress,
      completed,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  }, []);

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
    setViewLevel("equipments");
  };

  // Equipment actions
  const handleViewEquipment = (equipment: Equipment) => {
    setSelectedEquipment(equipment);
    setIsDetailModalOpen(true);
  };

  const handleMarkProcessed = (equipment: Equipment, comment?: string) => {
    toast.success(`Equipement ${equipment.code} marque comme traite`);
    setIsDetailModalOpen(false);
  };

  const handleOpenCommentModal = (equipment: Equipment) => {
    setSelectedEquipment(equipment);
    setIsCommentModalOpen(true);
  };

  const handleAddComment = (equipment: Equipment, comment: string, type?: string) => {
    toast.success(`Commentaire ajoute pour ${equipment.code}`);
    setIsCommentModalOpen(false);
  };

  const handleModifyEquipment = (equipment: Equipment) => {
    toast.info(`Modification de ${equipment.code} - Fonctionnalite a venir`);
  };

  const handleBulkAction = (equipmentIds: string[], action: string) => {
    toast.success(`${equipmentIds.length} equipement(s) traite(s)`);
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
            <AlertCircle className="h-7 w-7 text-warning-foreground" />
            Cas Complexes
          </h1>
          <p className="text-muted-foreground mt-1">
            Cas necessitant une expertise particuliere et une validation approfondie
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
              Aucune region trouvee pour &quot;{searchQuery}&quot;
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
              Aucune zone trouvee pour &quot;{searchQuery}&quot;
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
              Aucun depart trouve pour &quot;{searchQuery}&quot;
            </div>
          )}
        </div>
      )}

      {viewLevel === "equipments" && selectedDeparture && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              Equipements du depart {selectedDeparture.code} ({filteredEquipments.length})
            </h2>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle>Liste des equipements</CardTitle>
              <CardDescription>
                Gerez les equipements du depart {selectedDeparture.name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EquipmentTable
                equipments={filteredEquipments}
                isLoading={false}
                onView={handleViewEquipment}
                onMarkProcessed={handleMarkProcessed}
                onAddComment={handleOpenCommentModal}
                onModify={handleModifyEquipment}
                onBulkAction={handleBulkAction}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modals */}
      <EquipmentDetailModal
        equipment={selectedEquipment}
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        onMarkProcessed={handleMarkProcessed}
        onAddComment={handleAddComment}
      />

      <AddCommentModal
        equipment={selectedEquipment}
        isOpen={isCommentModalOpen}
        onClose={() => setIsCommentModalOpen(false)}
        onSubmit={handleAddComment}
      />
    </div>
  );
}
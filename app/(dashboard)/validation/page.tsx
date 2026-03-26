"use client";

import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/lib/auth/context";
import { useI18n } from "@/lib/i18n/context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RegionCard } from "@/components/complex-cases/region-card";
import { ZoneCard } from "@/components/complex-cases/zone-card";
import { DepartureCard } from "@/components/complex-cases/departure-card";
import { PeriodFilter, PeriodType } from "@/components/complex-cases/period-filter";
import { GlobalStatsCards } from "@/components/complex-cases/global-stats-cards";
import { NavigationBreadcrumb, BreadcrumbItem } from "@/components/complex-cases/navigation-breadcrumb";
import { eneoRegions, getRegionStats, getZoneStats, EneoRegion, EneoZone, EneoDeparture } from "@/lib/api/eneo-data";
import { Search, CheckSquare, CheckCircle, XCircle, Clock, FileCheck, User, Calendar, MapPin } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr, enUS } from "date-fns/locale";

type ViewLevel = "regions" | "zones" | "departures" | "validation";

// Types pour la validation de départ
interface DepartureValidation {
  id: string;
  departureId: string;
  departureCode: string;
  departureName: string;
  departureLocation: string;
  status: "pending" | "in_review" | "validated" | "rejected";
  submittedBy: string;
  submittedAt: string;
  completedAt?: string;
  validatedBy?: string;
  validatedAt?: string;
  rejectionReason?: string;
  validationComment?: string;
  stats: {
    totalEquipments: number;
    processedEquipments: number;
    pendingEquipments: number;
    validatedEquipments: number;
    rejectedEquipments: number;
  };
  details: {
    responsibleAgent: string;
    zone: string;
    region: string;
    installationDate: string;
    lastMaintenance: string;
  };
}

// Générer des données de validation mock
function generateMockValidationData(departure: EneoDeparture, region: EneoRegion | null, zone: EneoZone | null): DepartureValidation {
  const totalEquipments = departure.equipmentCount;
  const processedEquipments = Math.floor(totalEquipments * 0.7);
  const validatedEquipments = Math.floor(processedEquipments * 0.8);
  const rejectedEquipments = processedEquipments - validatedEquipments;
  const pendingEquipments = totalEquipments - processedEquipments;

  const submittedDate = new Date(Date.now() - Math.floor(Math.random() * 14 * 24 * 60 * 60 * 1000));
  const completedDate = Math.random() > 0.3 ? new Date(Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)) : undefined;

  const statuses: ("pending" | "in_review" | "validated" | "rejected")[] = ["pending", "in_review", "validated", "rejected"];
  const status = statuses[Math.floor(Math.random() * statuses.length)];

  const installationDate = new Date(Date.now() - Math.floor(Math.random() * 365 * 24 * 60 * 60 * 1000));
  const lastMaintenance = new Date(Date.now() - Math.floor(Math.random() * 90 * 24 * 60 * 60 * 1000));

  return {
    id: `val-${departure.id}`,
    departureId: departure.id,
    departureCode: departure.code,
    departureName: departure.name,
    departureLocation: `${zone?.name || "Zone inconnue"}, ${region?.name || "Région inconnue"}`,
    status,
    submittedBy: ["Jean Dupont", "Marie Kouam", "Paul Ndi", "Claire Biya"][Math.floor(Math.random() * 4)],
    submittedAt: submittedDate.toLocaleDateString("fr-FR"),
    completedAt: completedDate?.toLocaleDateString("fr-FR"),
    validatedBy: status === "validated" || status === "rejected" ? "Admin ENEO" : undefined,
    validatedAt: completedDate?.toLocaleDateString("fr-FR"),
    rejectionReason: status === "rejected" ? "Plusieurs incohérences détectées dans les données" : undefined,
    validationComment: status === "validated" ? "Validation complète approuvée" : undefined,
    stats: {
      totalEquipments,
      processedEquipments,
      pendingEquipments,
      validatedEquipments,
      rejectedEquipments,
    },
    details: {
      responsibleAgent: ["Pierre Kamga", "Esther Ngo", "François Mbarga", "Catherine Ndi"][Math.floor(Math.random() * 4)],
      zone: zone?.name || "Zone non spécifiée",
      region: region?.name || "Région non spécifiée",
      installationDate: installationDate.toLocaleDateString("fr-FR"),
      lastMaintenance: lastMaintenance.toLocaleDateString("fr-FR"),
    },
  };
}

// Composant d'interface de validation simplifié
function ValidationInterface({ 
  validation, 
  onValidate, 
  onReject,
  isLoading 
}: { 
  validation: DepartureValidation | null;
  onValidate: (validation: DepartureValidation, comment: string) => void;
  onReject: (validation: DepartureValidation, reason: string) => void;
  isLoading: boolean;
}) {
  const [validationComment, setValidationComment] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showValidateDialog, setShowValidateDialog] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!validation) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <FileCheck className="h-12 w-12 mx-auto mb-4" />
        <p>Aucune demande de validation pour ce départ</p>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge className="bg-yellow-500 text-white">En attente</Badge>;
      case "in_review":
        return <Badge className="bg-blue-500 text-white">En revue</Badge>;
      case "validated":
        return <Badge className="bg-green-500 text-white">Validé</Badge>;
      case "rejected":
        return <Badge className="bg-red-500 text-white">Rejeté</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const handleValidateDeparture = () => {
    onValidate(validation, validationComment);
    setShowValidateDialog(false);
    setValidationComment("");
  };

  const handleRejectDeparture = () => {
    if (rejectionReason.trim()) {
      onReject(validation, rejectionReason);
      setShowRejectDialog(false);
      setRejectionReason("");
    }
  };

  const canValidate = validation.status === "in_review" || validation.status === "pending";
  const canReject = validation.status === "in_review" || validation.status === "pending";
  const isAlreadyProcessed = validation.status === "validated" || validation.status === "rejected";

  return (
    <div className="space-y-6">
      {/* En-tête du départ */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-2xl flex items-center gap-2">
                {validation.departureCode} - {validation.departureName}
              </CardTitle>
              <CardDescription className="flex items-center gap-2 mt-1">
                <MapPin className="h-4 w-4" />
                {validation.departureLocation}
              </CardDescription>
            </div>
            {getStatusBadge(validation.status)}
          </div>
        </CardHeader>
      </Card>

      {/* Informations de soumission */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Informations de soumission</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Soumis par</p>
                <p className="font-medium">{validation.submittedBy}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Date de soumission</p>
                <p className="font-medium">{validation.submittedAt}</p>
              </div>
            </div>
            {validation.completedAt && (
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Date de traitement</p>
                  <p className="font-medium">{validation.completedAt}</p>
                </div>
              </div>
            )}
            {validation.validatedBy && (
              <div className="flex items-center gap-3">
                <User className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Validé par</p>
                  <p className="font-medium">{validation.validatedBy}</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Statistiques du départ */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Statistiques du départ</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center p-3 bg-muted/30 rounded-lg">
              <p className="text-sm text-muted-foreground">Total éléments</p>
              <p className="text-2xl font-bold">{validation.stats.totalEquipments}</p>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <p className="text-sm text-muted-foreground">Validés</p>
              <p className="text-2xl font-bold text-green-600">{validation.stats.validatedEquipments}</p>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <p className="text-sm text-muted-foreground">Rejetés</p>
              <p className="text-2xl font-bold text-red-600">{validation.stats.rejectedEquipments}</p>
            </div>
            <div className="text-center p-3 bg-yellow-50 rounded-lg">
              <p className="text-sm text-muted-foreground">En attente</p>
              <p className="text-2xl font-bold text-yellow-600">{validation.stats.pendingEquipments}</p>
            </div>
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-muted-foreground">Progression</p>
              <p className="text-2xl font-bold text-blue-600">
                {Math.round((validation.stats.processedEquipments / validation.stats.totalEquipments) * 100)}%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Détails techniques */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Détails techniques</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Agent responsable</p>
              <p className="font-medium">{validation.details.responsibleAgent}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Zone</p>
              <p className="font-medium">{validation.details.zone}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Région</p>
              <p className="font-medium">{validation.details.region}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Date d'installation</p>
              <p className="font-medium">{validation.details.installationDate}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Dernière maintenance</p>
              <p className="font-medium">{validation.details.lastMaintenance}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Commentaires et décision */}
      {(validation.validationComment || validation.rejectionReason) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {validation.status === "validated" ? "Commentaire de validation" : "Motif du rejet"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              {validation.validationComment || validation.rejectionReason}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Actions de validation */}
      {canValidate && (
        <div className="flex gap-4 justify-end">
          <Button
            size="lg"
            variant="destructive"
            onClick={() => setShowRejectDialog(true)}
          >
            <XCircle className="h-4 w-4 mr-2" />
            Rejeter le départ
          </Button>
          <Button
            size="lg"
            onClick={() => setShowValidateDialog(true)}
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Valider le départ
          </Button>
        </div>
      )}

      {/* Message pour les départs déjà traités */}
      {isAlreadyProcessed && (
        <Card className="bg-muted/50">
          <CardContent className="py-6 text-center">
            {validation.status === "validated" ? (
              <>
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
                <p className="text-green-600 font-medium">Ce départ a déjà été validé</p>
              </>
            ) : (
              <>
                <XCircle className="h-12 w-12 text-red-500 mx-auto mb-2" />
                <p className="text-red-600 font-medium">Ce départ a été rejeté</p>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dialog de validation du départ */}
      <Dialog open={showValidateDialog} onOpenChange={setShowValidateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Valider le départ {validation.departureCode}
            </DialogTitle>
            <DialogDescription>
              Confirmez la validation de l'ensemble des données du départ
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Commentaire de validation</label>
              <Textarea
                placeholder="Ajoutez un commentaire pour cette validation (optionnel)"
                value={validationComment}
                onChange={(e) => setValidationComment(e.target.value)}
                rows={4}
              />
            </div>
            <div className="bg-muted/30 p-3 rounded-lg">
              <p className="text-sm font-medium mb-2">Récapitulatif</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-muted-foreground">Total éléments:</span>
                <span className="font-medium">{validation.stats.totalEquipments}</span>
                <span className="text-muted-foreground">Éléments validés:</span>
                <span className="font-medium text-green-600">{validation.stats.validatedEquipments}</span>
                <span className="text-muted-foreground">Éléments rejetés:</span>
                <span className="font-medium text-red-600">{validation.stats.rejectedEquipments}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowValidateDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleValidateDeparture}>
              Confirmer la validation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de rejet du départ */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              Rejeter le départ {validation.departureCode}
            </DialogTitle>
            <DialogDescription>
              Indiquez la raison du rejet pour que l'équipe puisse corriger
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Motif du rejet <span className="text-red-500">*</span>
              </label>
              <Textarea
                placeholder="Décrivez précisément les raisons du rejet..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleRejectDeparture} disabled={!rejectionReason.trim()}>
              Confirmer le rejet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ValidationPage() {
  const { user } = useAuth();
  const { t, language } = useI18n();
  
  // Navigation state
  const [viewLevel, setViewLevel] = useState<ViewLevel>("regions");
  const [selectedRegion, setSelectedRegion] = useState<EneoRegion | null>(null);
  const [selectedZone, setSelectedZone] = useState<EneoZone | null>(null);
  const [selectedDeparture, setSelectedDeparture] = useState<EneoDeparture | null>(null);
  
  // Filter state
  const [period, setPeriod] = useState<PeriodType>("month");
  const [searchQuery, setSearchQuery] = useState("");

  // Validation state
  const [validationData, setValidationData] = useState<DepartureValidation | null>(null);
  const [isValidationLoading, setIsValidationLoading] = useState(false);

  // Generate validation data when departure is selected
  useEffect(() => {
    if (selectedDeparture) {
      setIsValidationLoading(true);
      // Simulate API call
      setTimeout(() => {
        setValidationData(generateMockValidationData(selectedDeparture, selectedRegion, selectedZone));
        setIsValidationLoading(false);
      }, 500);
    } else {
      setValidationData(null);
    }
  }, [selectedDeparture, selectedRegion, selectedZone]);

  // Calculate global stats
  const globalStats = useMemo(() => {
    let total = 0;
    let pending = 0;
    let validated = 0;
    let rejected = 0;

    eneoRegions.forEach((region) => {
      const stats = getRegionStats(region.id);
      total += stats.total;
      pending += stats.pending;
      validated += stats.completed;
      rejected += stats.inProgress;
    });

    return {
      total,
      pendingAndInProgress: pending,
      completed: validated,
      completionRate: total > 0 ? Math.round((validated / total) * 100) : 0,
    };
  }, []);

  // Build breadcrumb
  const breadcrumbItems: BreadcrumbItem[] = useMemo(() => {
    const items: BreadcrumbItem[] = [
      { id: "home", label: "Validation", type: "home" },
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
    setViewLevel("validation");
  };

  // Validation actions
  const handleValidateDeparture = (validation: DepartureValidation, comment: string) => {
    toast.success(`Départ ${validation.departureCode} validé avec succès`);
    setValidationData({
      ...validation,
      status: "validated",
      validatedBy: user?.firstName || "Admin",
      validatedAt: new Date().toLocaleDateString("fr-FR"),
      validationComment: comment || "Validation approuvée",
    });
  };

  const handleRejectDeparture = (validation: DepartureValidation, reason: string) => {
    toast.info(`Départ ${validation.departureCode} rejeté: ${reason}`);
    setValidationData({
      ...validation,
      status: "rejected",
      validatedBy: user?.firstName || "Admin",
      validatedAt: new Date().toLocaleDateString("fr-FR"),
      rejectionReason: reason,
    });
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
            <CheckSquare className="h-7 w-7 text-primary" />
            Validation
          </h1>
          <p className="text-muted-foreground mt-1">
            Validation des départs et de leurs données associées
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
              Aucune region trouvée pour "{searchQuery}"
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
              Aucune zone trouvée pour "{searchQuery}"
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
              Aucun depart trouvé pour "{searchQuery}"
            </div>
          )}
        </div>
      )}

      {viewLevel === "validation" && selectedDeparture && (
        <div className="space-y-4">
          <ValidationInterface
            validation={validationData}
            onValidate={handleValidateDeparture}
            onReject={handleRejectDeparture}
            isLoading={isValidationLoading}
          />
        </div>
      )}
    </div>
  );
}
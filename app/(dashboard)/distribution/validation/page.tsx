"use client";

import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/lib/auth/context";
import { useI18n } from "@/lib/i18n/context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { 
  eneoRegions, 
  getAnomaliesByFeeder, 
  getComparisonStats,
  EneoRegion, 
  EneoZone, 
  EneoDeparture 
} from "@/lib/api/eneo-data";
import { Search, CheckSquare, CheckCircle, XCircle, Clock, FileCheck, User, Calendar, MapPin, TrendingUp } from "lucide-react";
import { toast } from "sonner";

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

// Stockage des statuts de validation des départs (simulé en mémoire)
// Dans un vrai système, cela serait stocké dans une base de données
const departureValidationStatus = new Map<string, DepartureValidation["status"]>();

// Construire les données de validation à partir des anomalies réelles
function buildValidationDataFromAnomalies(
  departure: EneoDeparture, 
  region: EneoRegion | null, 
  zone: EneoZone | null
): DepartureValidation {
  const totalEquipments = departure.collectionStats?.totalAttendu || departure.equipmentCount;
  const collectes = departure.collectionStats?.collectes || 0;
  const manquantsRestants = departure.collectionStats?.manquantsRestants || 0;
  
  // Récupérer les anomalies pour ce départ
  const duplicates = getAnomaliesByFeeder(departure.feederId, "duplicate").length;
  const divergences = getAnomaliesByFeeder(departure.feederId, "divergence").length;
  const complex = getAnomaliesByFeeder(departure.feederId, "complex").length;
  
  // Les équipements "bons" sont ceux collectés sans anomalie
  const validatedEquipments = collectes - (duplicates + divergences + complex);
  
  // Les équipements "en attente" sont ceux manquants (à collecter)
  const pendingEquipments = manquantsRestants;
  
  // Les équipements "à corriger" = ceux qui ont des divergences ou des doublons
  const rejectedEquipments = duplicates + divergences + complex;
  
  // Les équipements "traités" = collectés (bons + anomalies)
  const processedEquipments = collectes;
  
  // Récupérer le statut de validation stocké ou déterminer un statut par défaut
  let status: DepartureValidation["status"] = departureValidationStatus.get(departure.id) || "pending";
  
  // Si le statut n'est pas encore défini, le déterminer automatiquement
  if (!departureValidationStatus.has(departure.id)) {
    if (pendingEquipments === 0 && rejectedEquipments === 0) {
      status = "validated";
      departureValidationStatus.set(departure.id, "validated");
    } else if (processedEquipments > 0 && rejectedEquipments === 0) {
      status = "in_review";
      departureValidationStatus.set(departure.id, "in_review");
    } else {
      status = "pending";
      departureValidationStatus.set(departure.id, "pending");
    }
  }
  
  // Date de soumission
  const submittedDate = new Date();
  
  return {
    id: `val-${departure.id}`,
    departureId: departure.id,
    departureCode: departure.code,
    departureName: departure.name,
    departureLocation: `${zone?.name || "Zone inconnue"}, ${region?.name || "Région inconnue"}`,
    status,
    submittedBy: "Agent terrain",
    submittedAt: submittedDate.toLocaleDateString("fr-FR"),
    completedAt: status === "validated" ? submittedDate.toLocaleDateString("fr-FR") : undefined,
    validatedBy: status === "validated" ? "Système" : undefined,
    validatedAt: status === "validated" ? submittedDate.toLocaleDateString("fr-FR") : undefined,
    stats: {
      totalEquipments,
      processedEquipments,
      pendingEquipments,
      validatedEquipments,
      rejectedEquipments,
    },
    details: {
      responsibleAgent: "Équipe terrain Bonaberi",
      zone: zone?.name || "Zone non spécifiée",
      region: region?.name || "Région non spécifiée",
      installationDate: "Non spécifiée",
      lastMaintenance: "Non spécifiée",
    },
  };
}

// Composant d'interface de validation
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
        return <Badge className="bg-yellow-500 text-white">En attente de validation</Badge>;
      case "in_review":
        return <Badge className="bg-blue-500 text-white">En cours d'analyse</Badge>;
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
  
  // Vérifier si le départ est prêt à être validé (pas d'équipements en attente ni à corriger)
  const isReadyForValidation = validation.stats.pendingEquipments === 0 && validation.stats.rejectedEquipments === 0;

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

      {/* Statistiques du départ */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            État de la collecte
          </CardTitle>
          <CardDescription>
            Équipements du départ {validation.departureCode} et leur statut de collecte
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center p-3 bg-muted/30 rounded-lg">
              <p className="text-sm text-muted-foreground">Total attendu</p>
              <p className="text-2xl font-bold">{validation.stats.totalEquipments}</p>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <p className="text-sm text-muted-foreground">Validés</p>
              <p className="text-2xl font-bold text-green-600">{validation.stats.validatedEquipments}</p>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <p className="text-sm text-muted-foreground">À corriger</p>
              <p className="text-2xl font-bold text-red-600">{validation.stats.rejectedEquipments}</p>
            </div>
            <div className="text-center p-3 bg-yellow-50 rounded-lg">
              <p className="text-sm text-muted-foreground">À collecter</p>
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

      {/* Détail des anomalies */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Détail des anomalies détectées</CardTitle>
          <CardDescription>
            Les équipements à corriger avant validation finale
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {validation.stats.rejectedEquipments > 0 ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-700 font-medium mb-2">
                  {validation.stats.rejectedEquipments} équipement(s) nécessitent une correction
                </p>
                <ul className="text-sm text-red-600 space-y-1 list-disc list-inside">
                  {getAnomaliesByFeeder(validation.departureId, "divergence").length > 0 && (
                    <li>{getAnomaliesByFeeder(validation.departureId, "divergence").length} divergence(s) de données</li>
                  )}
                  {getAnomaliesByFeeder(validation.departureId, "duplicate").length > 0 && (
                    <li>{getAnomaliesByFeeder(validation.departureId, "duplicate").length} doublon(s) détecté(s)</li>
                  )}
                  {getAnomaliesByFeeder(validation.departureId, "complex").length > 0 && (
                    <li>{getAnomaliesByFeeder(validation.departureId, "complex").length} cas complexe(s)</li>
                  )}
                </ul>
              </div>
            ) : (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-700 font-medium">
                  ✅ Aucune anomalie détectée sur les équipements collectés
                </p>
              </div>
            )}
            
            {validation.stats.pendingEquipments > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-700 font-medium">
                  ⚠️ {validation.stats.pendingEquipments} équipement(s) non encore collectés
                </p>
              </div>
            )}
            
            {isReadyForValidation && validation.status !== "validated" && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-700 font-medium">
                  ✅ Tous les équipements sont collectés et sans anomalie. Prêt à être validé !
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Détails techniques */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Informations de collecte</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Équipe responsable</p>
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
              <p className="text-sm text-muted-foreground">Date de dernière collecte</p>
              <p className="font-medium">{validation.submittedAt}</p>
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
            disabled={!isReadyForValidation}
            title={!isReadyForValidation ? "Tous les équipements doivent être collectés et sans anomalie" : ""}
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
                <p className="text-sm text-muted-foreground mt-1">
                  Validé le {validation.validatedAt} par {validation.validatedBy}
                </p>
              </>
            ) : (
              <>
                <XCircle className="h-12 w-12 text-red-500 mx-auto mb-2" />
                <p className="text-red-600 font-medium">Ce départ a été rejeté</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Rejeté le {validation.validatedAt} par {validation.validatedBy}
                </p>
                {validation.rejectionReason && (
                  <p className="text-sm text-muted-foreground mt-2">Motif: {validation.rejectionReason}</p>
                )}
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
            <div className="bg-green-50 p-3 rounded-lg">
              <p className="text-sm font-medium text-green-800 mb-2">Récapitulatif</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-green-700">Total équipements:</span>
                <span className="font-medium">{validation.stats.totalEquipments}</span>
                <span className="text-green-700">Tous collectés:</span>
                <span className="font-medium">✅ Oui</span>
                <span className="text-green-700">Sans anomalie:</span>
                <span className="font-medium">✅ Oui</span>
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
            <div className="bg-red-50 p-3 rounded-lg">
              <p className="text-sm font-medium text-red-800 mb-2">Anomalies à corriger</p>
              <ul className="text-sm text-red-700 space-y-1 list-disc list-inside">
                {validation.stats.pendingEquipments > 0 && (
                  <li>{validation.stats.pendingEquipments} équipement(s) non collecté(s)</li>
                )}
                {getAnomaliesByFeeder(validation.departureId, "divergence").length > 0 && (
                  <li>{getAnomaliesByFeeder(validation.departureId, "divergence").length} divergence(s)</li>
                )}
                {getAnomaliesByFeeder(validation.departureId, "duplicate").length > 0 && (
                  <li>{getAnomaliesByFeeder(validation.departureId, "duplicate").length} doublon(s)</li>
                )}
                {getAnomaliesByFeeder(validation.departureId, "complex").length > 0 && (
                  <li>{getAnomaliesByFeeder(validation.departureId, "complex").length} cas complexe(s)</li>
                )}
              </ul>
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

  // Build validation data when departure is selected
  useEffect(() => {
    if (selectedDeparture) {
      setIsValidationLoading(true);
      setTimeout(() => {
        setValidationData(buildValidationDataFromAnomalies(selectedDeparture, selectedRegion, selectedZone));
        setIsValidationLoading(false);
      }, 100);
    } else {
      setValidationData(null);
    }
  }, [selectedDeparture, selectedRegion, selectedZone]);

  // Calculer les stats globales pour la page Validation
  // Ici, "completed" = nombre de départs validés
  const globalStats = useMemo(() => {
    let totalDepartures = 0;
    let validatedDepartures = 0;
    
    eneoRegions.forEach((region) => {
      region.zones.forEach((zone) => {
        zone.departures.forEach((departure) => {
          totalDepartures++;
          
          // Vérifier si le départ est validé
          const status = departureValidationStatus.get(departure.id);
          if (status === "validated") {
            validatedDepartures++;
          }
        });
      });
    });
    
    // Pour les départs sans statut, vérifier s'ils sont prêts à être validés
    eneoRegions.forEach((region) => {
      region.zones.forEach((zone) => {
        zone.departures.forEach((departure) => {
          if (!departureValidationStatus.has(departure.id)) {
            const collectes = departure.collectionStats?.collectes || 0;
            const totalAttendu = departure.collectionStats?.totalAttendu || departure.equipmentCount;
            const duplicates = getAnomaliesByFeeder(departure.feederId, "duplicate").length;
            const divergences = getAnomaliesByFeeder(departure.feederId, "divergence").length;
            const complex = getAnomaliesByFeeder(departure.feederId, "complex").length;
            
            const pendingEquipments = totalAttendu - collectes;
            const rejectedEquipments = duplicates + divergences + complex;
            
            // Si tous les équipements sont collectés et sans anomalie, on considère comme validé
            if (pendingEquipments === 0 && rejectedEquipments === 0) {
              validatedDepartures++;
              departureValidationStatus.set(departure.id, "validated");
            }
          }
        });
      });
    });
    
    const pendingAndInProgress = totalDepartures - validatedDepartures;
    const completionRate = totalDepartures > 0 ? Math.round((validatedDepartures / totalDepartures) * 100) : 0;
    
    return {
      total: totalDepartures,
      pendingAndInProgress: pendingAndInProgress,
      completed: validatedDepartures,
      completionRate: completionRate,
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
    // Mettre à jour le statut dans le Map
    departureValidationStatus.set(validation.departureId, "validated");
    
    toast.success(`Départ ${validation.departureCode} validé avec succès`);
    setValidationData({
      ...validation,
      status: "validated",
      validatedBy: user?.firstName || "Admin",
      validatedAt: new Date().toLocaleDateString("fr-FR"),
      validationComment: comment || "Validation approuvée - tous les équipements sont collectés et conformes",
    });
  };

  const handleRejectDeparture = (validation: DepartureValidation, reason: string) => {
    // Mettre à jour le statut dans le Map
    departureValidationStatus.set(validation.departureId, "rejected");
    
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
            Validation des départs dont tous les équipements ont été collectés et vérifiés
          </p>
        </div>
        <PeriodFilter value={period} onChange={setPeriod} />
      </div>

      {/* Global Stats - Maintenant basé sur le nombre de départs */}
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
              // Calculer les stats de la région (nombre de départs validés)
              let totalDepartures = 0;
              let validatedDepartures = 0;
              
              region.zones.forEach(zone => {
                zone.departures.forEach(departure => {
                  totalDepartures++;
                  const status = departureValidationStatus.get(departure.id);
                  if (status === "validated") {
                    validatedDepartures++;
                  } else if (!departureValidationStatus.has(departure.id)) {
                    // Vérifier si prêt à être validé
                    const collectes = departure.collectionStats?.collectes || 0;
                    const totalAttendu = departure.collectionStats?.totalAttendu || departure.equipmentCount;
                    const duplicates = getAnomaliesByFeeder(departure.feederId, "duplicate").length;
                    const divergences = getAnomaliesByFeeder(departure.feederId, "divergence").length;
                    const complex = getAnomaliesByFeeder(departure.feederId, "complex").length;
                    
                    if (collectes === totalAttendu && duplicates === 0 && divergences === 0 && complex === 0) {
                      validatedDepartures++;
                    }
                  }
                });
              });
              
              const pendingDepartures = totalDepartures - validatedDepartures;
              
              const stats = {
                total: totalDepartures,
                pending: pendingDepartures,
                inProgress: 0,
                completed: validatedDepartures,
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
              // Calculer les stats de la zone (nombre de départs validés)
              let totalDepartures = 0;
              let validatedDepartures = 0;
              
              zone.departures.forEach(departure => {
                totalDepartures++;
                const status = departureValidationStatus.get(departure.id);
                if (status === "validated") {
                  validatedDepartures++;
                } else if (!departureValidationStatus.has(departure.id)) {
                  const collectes = departure.collectionStats?.collectes || 0;
                  const totalAttendu = departure.collectionStats?.totalAttendu || departure.equipmentCount;
                  const duplicates = getAnomaliesByFeeder(departure.feederId, "duplicate").length;
                  const divergences = getAnomaliesByFeeder(departure.feederId, "divergence").length;
                  const complex = getAnomaliesByFeeder(departure.feederId, "complex").length;
                  
                  if (collectes === totalAttendu && duplicates === 0 && divergences === 0 && complex === 0) {
                    validatedDepartures++;
                  }
                }
              });
              
              const pendingDepartures = totalDepartures - validatedDepartures;
              
              const stats = {
                total: totalDepartures,
                pending: pendingDepartures,
                inProgress: 0,
                completed: validatedDepartures,
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
              Aucune zone trouvée pour "{searchQuery}"
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
              const totalEquipments = stats?.totalAttendu || 0;
              const collectes = stats?.collectes || 0;
              const pendingEquipments = stats?.manquantsRestants || 0;
              
              // Vérifier si le départ est validé
              const isValidated = departureValidationStatus.get(departure.id) === "validated";
              
              // Si tous les équipements sont collectés et sans anomalie, le départ est prêt
              const duplicates = getAnomaliesByFeeder(departure.feederId, "duplicate").length;
              const divergences = getAnomaliesByFeeder(departure.feederId, "divergence").length;
              const complex = getAnomaliesByFeeder(departure.feederId, "complex").length;
              const isReady = pendingEquipments === 0 && duplicates === 0 && divergences === 0 && complex === 0;
              
              const completedCount = isValidated ? totalEquipments : 0;
              const pendingCount = isValidated ? 0 : totalEquipments - collectes;
              
              return (
                <DepartureCard
                  key={departure.id}
                  code={departure.code}
                  name={departure.name}
                  equipmentCount={totalEquipments}
                  completedCount={completedCount}
                  pendingCount={pendingCount}
                  onClick={() => handleDepartureClick(departure)}
                />
              );
            })}
          </div>
          {filteredDepartures.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              Aucun départ trouvé pour "{searchQuery}"
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
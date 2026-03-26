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
import { Search, FilePlus, CheckCircle, XCircle, Eye, Upload, FileText } from "lucide-react";
import { toast } from "sonner";

type ViewLevel = "regions" | "zones" | "departures" | "newData";

// Types pour les nouvelles données Kobo
type DataType = "customer" | "meter" | "reading" | "complaint" | "survey" | "installation";
type ValidationStatus = "pending" | "reviewing" | "validated" | "rejected" | "duplicate";
type DataSource = "kobo" | "mobile_app" | "web_form" | "api_import";

interface NewDataRecord {
  id: string;
  code: string;
  type: DataType;
  title: string;
  description: string;
  source: DataSource;
  submissionDate: string;
  submittedBy: string;
  validationStatus: ValidationStatus;
  priority: "high" | "medium" | "low";
  assignedTo?: string;
  metadata: {
    latitude?: number;
    longitude?: number;
    photos?: number;
    attachments?: string[];
  };
}

// Générer des nouvelles données mock
function generateMockNewData(departureId: string, count: number): NewDataRecord[] {
  const types: DataType[] = ["customer", "meter", "reading", "complaint", "survey", "installation"];
  const typeLabels = {
    customer: "Nouveau client",
    meter: "Installation compteur",
    reading: "Relevé terrain",
    complaint: "Réclamation client",
    survey: "Enquête satisfaction",
    installation: "Demande d'installation"
  };
  
  const titles = [
    "Demande de nouveau raccordement",
    "Signalement compteur défectueux",
    "Relevé consommation mensuel",
    "Plainte sur facturation excessive",
    "Enquête de satisfaction client",
    "Installation compteur intelligent",
    "Mise à jour coordonnées client",
    "Demande de changement de puissance"
  ];
  
  const descriptions = [
    "Nouveau client en zone résidentielle nécessitant un raccordement électrique",
    "Compteur affichant des valeurs anormales depuis 3 mois",
    "Données de consommation collectées lors de la tournée terrain",
    "Client mécontent des montants facturés depuis janvier",
    "Questionnaire de satisfaction post-intervention technique",
    "Installation de compteur communicant dans quartier nord",
    "Changement d'adresse et de contact du client principal",
    "Augmentation de puissance demandée pour activité commerciale"
  ];
  
  const sources: DataSource[] = ["kobo", "mobile_app", "web_form", "api_import"];
  const statuses: ValidationStatus[] = ["pending", "reviewing", "validated", "rejected", "duplicate"];
  const priorities: ("high" | "medium" | "low")[] = ["high", "medium", "low"];
  const users = ["Jean Dupont", "Marie Kouam", "Paul Ndi", "Claire Biya", undefined];
  const submitterNames = ["Agent Terrain", "Client", "Technicien ENEO", "Superviseur", "Chef d'agence"];

  const newData: NewDataRecord[] = [];

  for (let i = 0; i < count; i++) {
    const submissionDate = new Date(Date.now() - Math.floor(Math.random() * 14 * 24 * 60 * 60 * 1000));
    
    newData.push({
      id: `${departureId}-new-${i + 1}`,
      code: `NEW-${departureId.toUpperCase()}-${String(i + 1).padStart(3, "0")}`,
      type: types[Math.floor(Math.random() * types.length)],
      title: titles[Math.floor(Math.random() * titles.length)],
      description: descriptions[Math.floor(Math.random() * descriptions.length)],
      source: sources[Math.floor(Math.random() * sources.length)],
      submissionDate: submissionDate.toLocaleDateString("fr-FR"),
      submittedBy: submitterNames[Math.floor(Math.random() * submitterNames.length)],
      validationStatus: statuses[Math.floor(Math.random() * statuses.length)],
      priority: priorities[Math.floor(Math.random() * priorities.length)],
      assignedTo: users[Math.floor(Math.random() * users.length)],
      metadata: {
        latitude: Math.random() > 0.7 ? 3.8480 + (Math.random() - 0.5) * 0.1 : undefined,
        longitude: Math.random() > 0.7 ? 11.5020 + (Math.random() - 0.5) * 0.1 : undefined,
        photos: Math.floor(Math.random() * 5),
        attachments: Math.random() > 0.5 ? ["photo1.jpg", "document.pdf"] : undefined,
      },
    });
  }

  return newData;
}

// Composant pour afficher les nouvelles données
function NewDataTable({ 
  records, 
  onView, 
  onValidate, 
  onReject, 
  onReview,
  onAssign,
  onBulkAction 
}: { 
  records: NewDataRecord[];
  onView: (record: NewDataRecord) => void;
  onValidate: (record: NewDataRecord) => void;
  onReject: (record: NewDataRecord) => void;
  onReview: (record: NewDataRecord) => void;
  onAssign: (record: NewDataRecord) => void;
  onBulkAction: (ids: string[], action: string) => void;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  const getStatusColor = (status: ValidationStatus) => {
    switch (status) {
      case "pending": return "text-yellow-600 bg-yellow-100";
      case "reviewing": return "text-blue-600 bg-blue-100";
      case "validated": return "text-green-600 bg-green-100";
      case "rejected": return "text-red-600 bg-red-100";
      case "duplicate": return "text-gray-600 bg-gray-100";
      default: return "text-gray-600 bg-gray-100";
    }
  };

  const getStatusLabel = (status: ValidationStatus) => {
    switch (status) {
      case "pending": return "En attente";
      case "reviewing": return "En revue";
      case "validated": return "Validé";
      case "rejected": return "Rejeté";
      case "duplicate": return "Doublon";
      default: return status;
    }
  };

  const getPriorityColor = (priority: "high" | "medium" | "low") => {
    switch (priority) {
      case "high": return "text-red-600 bg-red-100";
      case "medium": return "text-orange-600 bg-orange-100";
      case "low": return "text-blue-600 bg-blue-100";
      default: return "text-gray-600 bg-gray-100";
    }
  };

  const getTypeLabel = (type: DataType) => {
    const labels = {
      customer: "Nouveau client",
      meter: "Installation compteur",
      reading: "Relevé terrain",
      complaint: "Réclamation",
      survey: "Enquête",
      installation: "Demande installation"
    };
    return labels[type];
  };

  const filteredRecords = records.filter(record => 
    record.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    getTypeLabel(record.type).toLowerCase().includes(searchTerm.toLowerCase())
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
              onClick={() => onBulkAction(selectedIds, "validate")}
              className="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600 flex items-center gap-1"
            >
              <CheckCircle className="h-3 w-3" />
              Valider ({selectedIds.length})
            </button>
            <button
              onClick={() => onBulkAction(selectedIds, "reject")}
              className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600 flex items-center gap-1"
            >
              <XCircle className="h-3 w-3" />
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
                  checked={selectedIds.length === filteredRecords.length && filteredRecords.length > 0}
                  onChange={handleSelectAll}
                  className="rounded border-gray-300"
                />
              </th>
              <th className="text-left p-3 font-medium">Code</th>
              <th className="text-left p-3 font-medium">Type</th>
              <th className="text-left p-3 font-medium">Titre</th>
              <th className="text-left p-3 font-medium">Source</th>
              <th className="text-left p-3 font-medium">Statut</th>
              <th className="text-left p-3 font-medium">Priorité</th>
              <th className="text-left p-3 font-medium">Soumis le</th>
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
                <td className="p-3 max-w-xs truncate">
                  <div>
                    <p className="font-medium">{record.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{record.description}</p>
                  </div>
                </td>
                <td className="p-3 text-sm">
                  {record.source === "kobo" ? "Kobo Toolbox" :
                   record.source === "mobile_app" ? "App Mobile" :
                   record.source === "web_form" ? "Formulaire Web" : "Import API"}
                </td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(record.validationStatus)}`}>
                    {getStatusLabel(record.validationStatus)}
                  </span>
                </td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(record.priority)}`}>
                    {record.priority === "high" ? "Élevée" :
                     record.priority === "medium" ? "Moyenne" : "Faible"}
                  </span>
                </td>
                <td className="p-3 text-sm">{record.submissionDate}</td>
                <td className="p-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => onView(record)}
                      className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
                    >
                      <Eye className="h-3 w-3" />
                      Voir
                    </button>
                    {record.validationStatus === "pending" && (
                      <button
                        onClick={() => onReview(record)}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        Analyser
                      </button>
                    )}
                    {record.validationStatus === "reviewing" && (
                      <>
                        <button
                          onClick={() => onValidate(record)}
                          className="text-green-600 hover:text-green-800 text-sm"
                        >
                          Valider
                        </button>
                        <button
                          onClick={() => onReject(record)}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          Rejeter
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => onAssign(record)}
                      className="text-purple-600 hover:text-purple-800 text-sm"
                    >
                      Assigner
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredRecords.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            Aucune nouvelle donnée trouvée
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
  onValidate, 
  onReject, 
  onReview,
  onAssign 
}: { 
  record: NewDataRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onValidate: (record: NewDataRecord) => void;
  onReject: (record: NewDataRecord) => void;
  onReview: (record: NewDataRecord) => void;
  onAssign: (record: NewDataRecord) => void;
}) {
  const [assignmentComment, setAssignmentComment] = useState("");
  const [selectedAssignee, setSelectedAssignee] = useState("");

  if (!isOpen || !record) return null;

  const getTypeLabel = (type: DataType) => {
    const labels = {
      customer: "Nouveau client",
      meter: "Installation compteur",
      reading: "Relevé terrain",
      complaint: "Réclamation",
      survey: "Enquête",
      installation: "Demande d'installation"
    };
    return labels[type];
  };

  const handleAssign = () => {
    if (selectedAssignee) {
      onAssign(record);
      toast.success(`Donnée assignée à ${selectedAssignee}`);
    } else {
      toast.warning("Veuillez sélectionner un responsable");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <FilePlus className="h-5 w-5 text-success" />
            Détails de la nouvelle donnée
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
            <label className="text-sm font-medium text-muted-foreground">Titre</label>
            <p className="font-medium">{record.title}</p>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground">Description</label>
            <p className="text-gray-700">{record.description}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Source</label>
              <p className="flex items-center gap-1">
                {record.source === "kobo" ? "Kobo Toolbox" :
                 record.source === "mobile_app" ? "Application Mobile" :
                 record.source === "web_form" ? "Formulaire Web" : "Import API"}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Soumis par</label>
              <p>{record.submittedBy}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Date de soumission</label>
              <p>{record.submissionDate}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Priorité</label>
              <p className="capitalize">{record.priority}</p>
            </div>
          </div>

          {record.metadata && (
            <div className="border-t pt-4">
              <label className="text-sm font-medium text-muted-foreground mb-2 block">
                Métadonnées additionnelles
              </label>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {record.metadata.latitude && (
                  <div>
                    <span className="text-muted-foreground">Latitude:</span>
                    <span className="ml-2">{record.metadata.latitude.toFixed(6)}</span>
                  </div>
                )}
                {record.metadata.longitude && (
                  <div>
                    <span className="text-muted-foreground">Longitude:</span>
                    <span className="ml-2">{record.metadata.longitude.toFixed(6)}</span>
                  </div>
                )}
                {record.metadata.photos && record.metadata.photos > 0 && (
                  <div>
                    <span className="text-muted-foreground">Photos:</span>
                    <span className="ml-2">{record.metadata.photos} fichier(s)</span>
                  </div>
                )}
                {record.metadata.attachments && record.metadata.attachments.length > 0 && (
                  <div>
                    <span className="text-muted-foreground">Pièces jointes:</span>
                    <span className="ml-2">{record.metadata.attachments.length} document(s)</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="border-t pt-4">
            <label className="text-sm font-medium text-muted-foreground mb-2 block">
              Assigner à un responsable
            </label>
            <select
              value={selectedAssignee}
              onChange={(e) => setSelectedAssignee(e.target.value)}
              className="w-full p-2 border rounded-md"
            >
              <option value="">Sélectionner un responsable</option>
              <option value="Jean Dupont">Jean Dupont - Service Client</option>
              <option value="Marie Kouam">Marie Kouam - Technique</option>
              <option value="Paul Ndi">Paul Ndi - Facturation</option>
              <option value="Claire Biya">Claire Biya - Supervision</option>
            </select>
            <button
              onClick={handleAssign}
              className="mt-2 px-3 py-1 bg-purple-500 text-white rounded hover:bg-purple-600 text-sm"
            >
              Assigner
            </button>
          </div>

          <div className="flex gap-2 pt-4 border-t">
            {record.validationStatus === "pending" && (
              <button
                onClick={() => onReview(record)}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center gap-2"
              >
                <Eye className="h-4 w-4" />
                Analyser
              </button>
            )}
            {record.validationStatus === "reviewing" && (
              <>
                <button
                  onClick={() => onValidate(record)}
                  className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 flex items-center gap-2"
                >
                  <CheckCircle className="h-4 w-4" />
                  Valider et intégrer
                </button>
                <button
                  onClick={() => onReject(record)}
                  className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 flex items-center gap-2"
                >
                  <XCircle className="h-4 w-4" />
                  Rejeter
                </button>
              </>
            )}
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

  // Generate new data for selected departure
  const newDataRecords = useMemo(() => {
    if (selectedDeparture) {
      return generateMockNewData(selectedDeparture.id, selectedDeparture.equipmentCount);
    }
    return [];
  }, [selectedDeparture]);

  // Filter new data records
  const filteredRecords = useMemo(() => {
    if (!searchQuery) return newDataRecords;
    const query = searchQuery.toLowerCase();
    return newDataRecords.filter(
      (record) =>
        record.code.toLowerCase().includes(query) ||
        record.title.toLowerCase().includes(query) ||
        record.description.toLowerCase().includes(query)
    );
  }, [newDataRecords, searchQuery]);

  // Calculate global stats
  const globalStats = useMemo(() => {
    let total = 0;
    let pending = 0;
    let reviewing = 0;
    let validated = 0;

    eneoRegions.forEach((region) => {
      const stats = getRegionStats(region.id);
      total += stats.total;
      pending += stats.pending;
      reviewing += stats.inProgress;
      validated += stats.completed;
    });

    return {
      total,
      pendingAndInProgress: pending + reviewing,
      completed: validated,
      completionRate: total > 0 ? Math.round((validated / total) * 100) : 0,
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

  const handleValidateRecord = (record: NewDataRecord) => {
    toast.success(`Donnée ${record.code} validée et intégrée`);
    setIsDetailModalOpen(false);
  };

  const handleRejectRecord = (record: NewDataRecord) => {
    toast.info(`Donnée ${record.code} rejetée`);
    setIsDetailModalOpen(false);
  };

  const handleReviewRecord = (record: NewDataRecord) => {
    toast.info(`Analyse de la donnée ${record.code} en cours`);
    setSelectedRecord(record);
    setIsDetailModalOpen(true);
  };

  const handleAssignRecord = (record: NewDataRecord) => {
    toast.success(`Donnée ${record.code} assignée à un responsable`);
    setIsDetailModalOpen(false);
  };

  const handleBulkAction = (recordIds: string[], action: string) => {
    toast.success(`${recordIds.length} donnée(s) ${action === "validate" ? "validées" : "rejetées"}`);
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
            <FilePlus className="h-7 w-7 text-success" />
            Nouvelles Données
          </h1>
          <p className="text-muted-foreground mt-1">
            Validation et intégration des données collectées via Kobo et autres sources
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

      {viewLevel === "newData" && selectedDeparture && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              Nouvelles données du depart {selectedDeparture.code} ({filteredRecords.length})
            </h2>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FilePlus className="h-5 w-5" />
                Données collectées à valider
              </CardTitle>
              <CardDescription>
                Gérez les nouvelles données collectées pour le depart {selectedDeparture.name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <NewDataTable
                records={filteredRecords}
                onView={handleViewRecord}
                onValidate={handleValidateRecord}
                onReject={handleRejectRecord}
                onReview={handleReviewRecord}
                onAssign={handleAssignRecord}
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
        onValidate={handleValidateRecord}
        onReject={handleRejectRecord}
        onReview={handleReviewRecord}
        onAssign={handleAssignRecord}
      />
    </div>
  );
}
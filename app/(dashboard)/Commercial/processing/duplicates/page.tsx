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
import { Search, Copy, CheckCircle, XCircle, GitMerge, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { 
  eneoRegions,
  getAnomaliesByFeeder,
  EneoRegion, 
  EneoZone, 
  EneoDeparture,
  AnomalyCase
} from "@/lib/api/eneo-data";
import { layer2DB } from "@/data/layer2";

type ViewLevel = "regions" | "zones" | "departures" | "duplicates";

// Type pour les doublons basé sur les anomalies réelles
interface DuplicateRecord {
  id: string;
  code: string;
  type: string;
  records: DuplicateItem[];
  similarity: number;
  status: "pending" | "reviewing" | "merged" | "rejected";
  detectedAt: string;
  assignedTo?: string;
  rawAnomaly: AnomalyCase;
}

interface DuplicateItem {
  id: string;
  code: string;
  date: string;
  localisation: string;
  equipmentType: string;
  equipmentData: Record<string, unknown>;
}

// Convertir une anomalie de type "duplicate" en DuplicateRecord
function convertAnomalyToDuplicate(anomaly: AnomalyCase): DuplicateRecord | null {
  if (anomaly.type !== "duplicate") return null;
  
  // Pour un doublon, on a layer2Record (le premier doublon) et duplicateOf (l'ID de l'autre doublon)
  const firstRecord = anomaly.layer2Record;
  const otherId = anomaly.duplicateOf;
  
  if (!firstRecord) {
    console.warn("Doublon sans enregistrement", anomaly);
    return null;
  }
  
  // Récupérer l'autre enregistrement en double depuis layer2DB
  let secondRecord = null;
  if (otherId) {
    const tableRecords = layer2DB[anomaly.table] as unknown as Array<Record<string, unknown>>;
    secondRecord = tableRecords.find(r => String(r.m_rid) === String(otherId));
  }
  
  // Construire les deux items à afficher
  const duplicateItems: DuplicateItem[] = [
    {
      id: firstRecord.m_rid?.toString() || firstRecord.id?.toString() || "dup1",
      code: firstRecord.code?.toString() || firstRecord.name?.toString() || "N/A",
      date: firstRecord.created_date?.toString()?.split('T')[0] || "N/A",
      localisation: firstRecord.localisation?.toString() || "N/A",
      equipmentType: anomaly.table,
      equipmentData: firstRecord
    }
  ];
  
  if (secondRecord) {
    duplicateItems.push({
      id: secondRecord.m_rid?.toString() || secondRecord.id?.toString() || "dup2",
      code: secondRecord.code?.toString() || secondRecord.name?.toString() || "N/A",
      date: secondRecord.created_date?.toString()?.split('T')[0] || "N/A",
      localisation: secondRecord.localisation?.toString() || "N/A",
      equipmentType: anomaly.table,
      equipmentData: secondRecord
    });
  }
  
  // Calculer le taux de similarité
  const similarity = secondRecord 
    ? calculateSimilarity(firstRecord, secondRecord)
    : 100;
  
  // Générer un code unique pour le doublon
  const code1 = duplicateItems[0].code;
  const code2 = duplicateItems[1]?.code || "unknown";
  const shortCode1 = code1.length > 15 ? code1.substring(0, 15) : code1;
  const shortCode2 = code2.length > 15 ? code2.substring(0, 15) : code2;
  
  return {
    id: anomaly.id,
    code: `DUP-${shortCode1}-${shortCode2}`,
    type: getEquipmentTypeLabel(anomaly.table),
    records: duplicateItems,
    similarity,
    status: "pending",
    detectedAt: new Date().toISOString().split('T')[0],
    assignedTo: undefined,
    rawAnomaly: anomaly
  };
}

// Extraire une valeur représentative pour l'affichage
function getEquipmentValue(record: Record<string, unknown>): string {
  if (record.name) return record.name.toString();
  if (record.label) return record.label.toString();
  if (record.value) return record.value.toString();
  if (record.code) return record.code.toString();
  return "Valeur non définie";
}

// Calculer le taux de similarité entre deux enregistrements
function calculateSimilarity(record1: Record<string, unknown>, record2: Record<string, unknown>): number {
  let matchingFields = 0;
  let totalFields = 0;
  
  const fieldsToCompare = ["name", "code", "type", "voltage", "active", "status", "localisation"];
  
  for (const field of fieldsToCompare) {
    const val1 = record1[field];
    const val2 = record2[field];
    
    if (val1 !== undefined && val2 !== undefined) {
      totalFields++;
      if (String(val1).toLowerCase().trim() === String(val2).toLowerCase().trim()) {
        matchingFields++;
      }
    }
  }
  
  if (totalFields === 0) return 85;
  return Math.round((matchingFields / totalFields) * 100);
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
    node: "Nœud réseau"
  };
  return labels[table] || table;
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
  onMerge: (duplicate: DuplicateRecord, keepId: string) => void;
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
      case "merged": return "Fusionnés";
      case "rejected": return "Rejetés";
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

      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full min-w-[800px]">
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
              <th className="text-left p-3 font-medium">Code doublon</th>
              <th className="text-left p-3 font-medium">Type équipement</th>
              <th className="text-left p-3 font-medium">Enregistrements</th>
              <th className="text-left p-3 font-medium">Similarité</th>
              <th className="text-left p-3 font-medium">Statut</th>
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
                        <span className="text-muted-foreground ml-2">
                          {record.localisation}
                        </span>
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
                <td className="p-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => onView(duplicate)}
                      className="text-blue-600 hover:text-blue-800 text-sm cursor-pointer"
                    >
                      Voir
                    </button>
                    {duplicate.status === "reviewing" && (
                      <>
                        <button
                          onClick={() => onMerge(duplicate,duplicate.id)}
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
            Aucun doublon trouvé pour ce départ
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
  onMerge: (duplicate: DuplicateRecord, keepId: string) => void;
  onKeep: (duplicate: DuplicateRecord) => void;
  onDiscard: (duplicate: DuplicateRecord) => void;
}) {
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);

  if (!isOpen || !duplicate) return null;

  const handleMerge = () => {
    if (selectedRecordId) {
      onMerge(duplicate,selectedRecordId);
    } else {
      toast.warning("Veuillez sélectionner l'enregistrement à conserver");
    }
  };

  const handleKeepBoth = () => {
    toast.info("Conservation des deux enregistrements");
    onKeep(duplicate);
  };

  // Fonction pour formater une valeur pour l'affichage
  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return "—";
    if (typeof value === "boolean") return value ? "Oui" : "Non";
    if (value instanceof Date) return value.toLocaleString();
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  };

  // Fonction pour obtenir un libellé lisible pour un champ
  const getFieldLabel = (key: string): string => {
    const labels: Record<string, string> = {
      // ========== CHAMPS COMMUNS ==========
      m_rid: "ID unique",
      name: "Nom",
      code: "Code",
      active: "Actif",
      created_date: "Date de création",
      display_scada: "Affiché SCADA",
      
      // ========== FEEDER (Départ) ==========
      voltage: "Tension (kV)",
      is_injection: "Injection",
      local_name: "Nom local",
      
      // ========== SUBSTATION (Poste) ==========
      highest_voltage_level: "Niveau tension max",
      second_substation_id: "ID poste secondaire",
      exploitation: "Exploitation",
      latitude: "Latitude",
      longitude: "Longitude",
      localisation: "Localisation",
      regime: "Régime",
      type: "Type",
      zone_type: "Type de zone",
      security_zone_id: "Zone de sécurité",
      feeder_id: "Départ associé",
      
      // ========== POWERTRANSFORMER (Transformateur) ==========
      apparent_power: "Puissance apparente (kVA)",
      substation_id: "Poste source",
      t1: "Terminal 1",
      t2: "Terminal 2",
      w1_voltage: "Tension enroulement 1 (kV)",
      w2_voltage: "Tension enroulement 2 (kV)",
      
      // ========== BUSBAR (Jeu de barres) ==========
      phase: "Phase",
      is_feederhead: "Tête de départ",
      
      // ========== BAY (Travée) ==========
      busbar_id1: "Jeu de barres 1",
      busbar_id2: "Jeu de barres 2",
      
      // ========== SWITCH (Appareillage) ==========
      bay_mrid: "Travée",
      nature: "Nature",
      normal_open: "Normalement ouvert",
      second_switch_id: "ID secondaire",
      pole_mrid: "Poteau",
      
      // ========== WIRE (Conducteur) ==========
      nature_conducteur: "Nature conducteur",
      section: "Section",
      
      // ========== POLE (Poteau) ==========
      height: "Hauteur (m)",
      //longitude: "Longitude",
      lattitude: "Latitude",
      is_derivation: "Dérivation",
      installation_date: "Date installation",
      lastvisit_date: "Dernière visite",
      
      // ========== NODE (Nœud) ==========
      pole_id: "Poteau",
    };
    return labels[key] || key;
  };

  // Exclure les champs trop longs ou techniques
  const isImportantField = (key: string): boolean => {
    const excludeFields = ["geometry", "geom", "coordinates", "shape", "polygon", "multipolygon"];
    return !excludeFields.some(f => key.toLowerCase().includes(f));
  };

  // Récupérer tous les champs de l'enregistrement, triés
  const getAllFields = (record: Record<string, unknown>) => {
    return Object.entries(record)
      .filter(([key]) => isImportantField(key))
      .sort((a, b) => a[0].localeCompare(b[0]));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-6xl w-full h-[95vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Copy className="h-5 w-5" />
            Fusion de doublon
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            ✕
          </button>
        </div>

                  {/* Actions */}
          <div className="flex flex-wrap gap-3 py-2 border-t">
            <button
              onClick={handleMerge}
              className={`px-5 py-2.5 rounded-lg flex items-center gap-2 font-medium transition-colors ${
                   "bg-green-600 text-white hover:bg-green-700"
              }`}
            >
              <GitMerge className="h-4 w-4" />
              Fusionner (garder sélectionné)
            </button>
            <button
              onClick={handleKeepBoth}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 font-medium"
            >
              <Copy className="h-4 w-4" />
              Conserver les deux
            </button>
            <button
              onClick={() => onDiscard(duplicate)}
              className="px-5 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2 font-medium"
            >
              <XCircle className="h-4 w-4" />
              Rejeter les deux
            </button>
          </div>

        <div className="space-y-3">
          {/* Informations générales */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/30 rounded-lg">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Code doublon
              </label>
              <p className="font-mono text-sm font-medium">{duplicate.code}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Type équipement
              </label>
              <p className="font-medium">{duplicate.type}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Taux de similarité
              </label>
              <p className={`font-semibold ${
                duplicate.similarity >= 95 ? "text-red-600" :
                duplicate.similarity >= 90 ? "text-orange-600" :
                duplicate.similarity >= 85 ? "text-yellow-600" :
                "text-blue-600"
              }`}>
                {duplicate.similarity}%
              </p>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Date détection
              </label>
              <p className="text-sm">{duplicate.detectedAt}</p>
            </div>
          </div>

          {/* Enregistrements en double - Vue complète */}
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-2 block">
              Enregistrements en double dans la base terrain
            </label>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {duplicate.records.map((record, idx) => {
                const fields = getAllFields(record.equipmentData);
                const isSelected = selectedRecordId === record.id;
                
                return (
                  <div 
                    key={record.id}
                    className={`border rounded-lg overflow-hidden transition-all ${
                      isSelected 
                        ? 'border-green-500 ring-2 ring-green-200' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {/* En-tête avec sélection */}
                    <div 
                      className={`p-4 cursor-pointer ${isSelected ? 'bg-green-50' : 'bg-gray-50'}`}
                      onClick={() => setSelectedRecordId(record.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-mono font-semibold text-lg">{record.code}</p>
                          </div>
                          <p className="text-sm">
                            <span className="font-medium">Date:</span> {record.date}
                          </p>
                          <p className="text-sm">
                            <span className="font-medium">Localisation:</span> {record.localisation}
                          </p>
                        </div>
                        <div className="w-8 h-8 rounded-full border flex items-center justify-center">
                          {idx === 0 ? "1" : "2"}
                        </div>
                      </div>
                    </div>

                    {/* Détails complets de l'équipement */}
                    <div className="p-2 border-t">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-sm">
                        {fields.map(([key, value]) => (
                          <div key={key} className="border-b border-gray-100 py-1">
                            <span className="text-muted-foreground text-xs block">
                              {getFieldLabel(key)}
                            </span>
                            <span className="font-mono text-xs break-all">
                              {formatValue(value)}
                            </span>
                          </div>
                        ))}
                      </div>
                      {fields.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          Aucun champ détaillé disponible
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
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

  // Récupérer les vrais doublons pour le départ sélectionné
  const duplicates = useMemo(() => {
    if (!selectedDeparture) return [];
    
    // Récupérer les anomalies de type "duplicate" pour ce départ
    const anomalies = getAnomaliesByFeeder(selectedDeparture.feederId, "duplicate");
    
    // Convertir chaque anomalie en DuplicateRecord
    const duplicateRecords: DuplicateRecord[] = [];
    for (const anomaly of anomalies) {
      const converted = convertAnomalyToDuplicate(anomaly);
      if (converted) {
        duplicateRecords.push(converted);
      }
    }
    
    return duplicateRecords;
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

  // Calculer les stats globales
  const globalStats = useMemo(() => {
    let totalDuplicates = 0;
    
    eneoRegions.forEach((region) => {
      region.zones.forEach((zone) => {
        zone.departures.forEach((departure) => {
          const anomalies = getAnomaliesByFeeder(departure.feederId, "duplicate");
          totalDuplicates += anomalies.length;
        });
      });
    });

    return {
      total: totalDuplicates,
      pendingAndInProgress: totalDuplicates,
      completed: 0,
      completionRate: 0,
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

const handleMergeDuplicate = (duplicate: DuplicateRecord, keepId: string) => {
  const toDelete = duplicate.records.find(r => r.id !== keepId);

  toast.success(`Fusion effectuée pour ${duplicate.code}`);
  setIsDetailModalOpen(false);
};

  const handleKeepDuplicate = (duplicate: DuplicateRecord) => {
    toast.success(`Les deux enregistrements sont conservés pour ${duplicate.code}`);
    setIsDetailModalOpen(false);
  };

  const handleDiscardDuplicate = (duplicate: DuplicateRecord) => {
    toast.info(`Doublon ${duplicate.code} rejeté - les deux enregistrements seront supprimés`);
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
            <Copy className="h-7 w-7" />
            Doublons
          </h1>
          <p className="text-muted-foreground mt-1">
            Détection et gestion des enregistrements en double dans la base de collecte terrain
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
              let regionDuplicateCount = 0;

                region.zones.forEach(zone => {
                  zone.departures.forEach(departure => {
                    regionDuplicateCount += getAnomaliesByFeeder(departure.feederId, "duplicate").length;
                  });
                });

                const stats = {
                  total: regionDuplicateCount,
                  pending: regionDuplicateCount,
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
        </div>
      )}

      {viewLevel === "zones" && selectedRegion && (
        <div>
          <h2 className="text-xl font-semibold mb-4">
            Zones de {selectedRegion.fullName} ({filteredZones.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredZones.map((zone) => {
              // Calculer le nombre total de doublons dans cette zone
              let zoneDuplicateCount = 0;
              zone.departures.forEach(departure => {
                zoneDuplicateCount += getAnomaliesByFeeder(departure.feederId, "duplicate").length;
              });
              
              const stats = {
                total: zoneDuplicateCount,
                pending: zoneDuplicateCount,
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
        </div>
      )}

      {viewLevel === "departures" && selectedZone && (
        <div>
          <h2 className="text-xl font-semibold mb-4">
            Départs de {selectedZone.name} ({filteredDepartures.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDepartures.map((departure) => {
              const duplicateCount = getAnomaliesByFeeder(departure.feederId, "duplicate").length;
              return (
                <DepartureCard
                  key={departure.id}
                  code={departure.code}
                  name={departure.name}
                  equipmentCount={duplicateCount}
                  completedCount={0}
                  pendingCount={duplicateCount}
                  onClick={() => handleDepartureClick(departure)}
                />
              );
            })}
          </div>
        </div>
      )}

      {viewLevel === "duplicates" && selectedDeparture && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              Doublons du départ {selectedDeparture.code} ({filteredDuplicates.length})
            </h2>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Copy className="h-5 w-5" />
                Liste des enregistrements en double
              </CardTitle>
              <CardDescription>
                Gérez les doublons détectés dans la base de collecte terrain pour le départ {selectedDeparture.name}
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

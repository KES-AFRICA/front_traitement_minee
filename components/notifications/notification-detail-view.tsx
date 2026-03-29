// components/notifications/notification-detail-view.tsx
"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Bell,
  CheckCircle,
  MessageCircle,
  User,
  MapPin,
  Calendar,
  GitCompare,
  Copy,
  FilePlus,
  FileX,
  Clock,
  X,
  MoreHorizontal,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import { NotificationDetail } from "@/lib/api/notification-details-data";

interface NotificationDetailViewProps {
  notification: NotificationDetail;
  onMarkAsRead: (id: string) => void;
  onDelete: (id: string) => void;
  language: string;
}

const typeIcons: Record<NotificationDetail["type"], React.ReactNode> = {
  duplicate_task: <Copy className="h-5 w-5 text-amber-500" />,
  difference_task: <GitCompare className="h-5 w-5 text-blue-500" />,
  new_kobo_task: <FilePlus className="h-5 w-5 text-green-500" />,
  missing_eneo_task: <FileX className="h-5 w-5 text-orange-500" />,
  task_validated: <CheckCircle className="h-5 w-5 text-emerald-500" />,
  task_rejected: <X className="h-5 w-5 text-red-500" />,
  comment: <MessageCircle className="h-5 w-5 text-sky-500" />,
  system: <Bell className="h-5 w-5 text-gray-500" />,
};

const typeColors: Record<NotificationDetail["type"], string> = {
  duplicate_task: "bg-amber-50 text-amber-700 border-amber-200",
  difference_task: "bg-blue-50 text-blue-700 border-blue-200",
  new_kobo_task: "bg-green-50 text-green-700 border-green-200",
  missing_eneo_task: "bg-orange-50 text-orange-700 border-orange-200",
  task_validated: "bg-emerald-50 text-emerald-700 border-emerald-200",
  task_rejected: "bg-red-50 text-red-700 border-red-200",
  comment: "bg-sky-50 text-sky-700 border-sky-200",
  system: "bg-gray-50 text-gray-700 border-gray-200",
};

const priorityColors: Record<"low" | "medium" | "high" | "critical", string> = {
  low: "bg-slate-100 text-slate-700",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-amber-100 text-amber-700",
  critical: "bg-red-100 text-red-700",
};

// Helper pour formater les valeurs
const formatValue = (value: unknown): string => {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Oui" : "Non";
  if (value instanceof Date) return value.toLocaleString();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

const getFieldLabel = (key: string): string => {
  const labels: Record<string, string> = {
    name: "Nom",
    code: "Code",
    type: "Type",
    voltage: "Tension (kV)",
    active: "Actif",
    created_date: "Date de création",
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
    duplicateCount: "Nombre de doublons",
    affectedRegion: "Région concernée",
    createdBy: "Créé par",
    fieldCount: "Nombre de champs",
    source: "Source",
    recordCount: "Nombre d'enregistrements",
    location: "Localisation",
    missingCount: "Nombre manquant",
    validatedBy: "Validé par",
    comment: "Commentaire",
    reviewedBy: "Revu par",
    rejectionReason: "Motif du rejet",
    version: "Version",
    changelog: "Changements",
    week: "Semaine",
    resolved: "Résolus",
    rate: "Taux",
  };
  return labels[key] || key.replace(/([A-Z])/g, " $1").trim();
};

// Composant pour afficher les détails d'un équipement
const EquipmentDetails = ({ equipment }: { equipment: NotificationDetail["sourceEquipment"] }) => {
  if (!equipment) return null;
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="bg-muted/30 px-4 py-2 font-medium flex items-center gap-2">
        <MapPin className="h-4 w-4 text-muted-foreground" />
        {equipment.name} ({equipment.code})
      </div>
      <div className="grid grid-cols-2 gap-2 p-4 text-sm">
        <div>
          <span className="text-muted-foreground text-xs block">Type</span>
          <span className="font-medium">{equipment.type}</span>
        </div>
        <div>
          <span className="text-muted-foreground text-xs block">Départ</span>
          <span className="font-medium">{equipment.departure}</span>
        </div>
        <div>
          <span className="text-muted-foreground text-xs block">Puissance</span>
          <span className="font-medium">{equipment.power || "—"}</span>
        </div>
        <div>
          <span className="text-muted-foreground text-xs block">Tension</span>
          <span className="font-medium">{equipment.tension || "—"}</span>
        </div>
        <div>
          <span className="text-muted-foreground text-xs block">Localisation</span>
          <span className="font-medium">{equipment.location || equipment.localisation || "—"}</span>
        </div>
        <div>
          <span className="text-muted-foreground text-xs block">Statut</span>
          <Badge variant="outline" className="text-xs">
            {equipment.status === "active" ? "Actif" : equipment.status === "inactive" ? "Inactif" : "Maintenance"}
          </Badge>
        </div>
      </div>
    </div>
  );
};

// Composant pour afficher la table des divergences
const DifferencesTable = ({ differences }: { differences: NotificationDetail["differences"] }) => {
  if (!differences || differences.length === 0) return null;
  return (
    <div>
      <h4 className="font-medium mb-2 flex items-center gap-2">
        <GitCompare className="h-4 w-4" />
        Champs divergents
      </h4>
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-2 text-left">Champ</th>
              <th className="p-2 text-left">Kobo (source)</th>
              <th className="p-2 text-left">Eneo (cible)</th>
            </tr>
          </thead>
          <tbody>
            {differences.map((diff, idx) => (
              <tr key={idx} className="border-t">
                <td className="p-2 font-medium">{getFieldLabel(diff.field)}</td>
                <td className="p-2 text-muted-foreground">{diff.sourceValue}</td>
                <td className="p-2 text-muted-foreground">{diff.targetValue}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Composant pour afficher la barre de similarité
const SimilarityProgress = ({ value }: { value?: number }) => {
  if (value === undefined) return null;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span>Similarité</span>
        <span className="font-mono">{value}%</span>
      </div>
      <Progress value={value} className="h-2" />
    </div>
  );
};

// Composant pour afficher les métadonnées
const MetadataBlock = ({ metadata }: { metadata?: Record<string, unknown> }) => {
  if (!metadata) return null;
  const entries = Object.entries(metadata).filter(([k]) => !["createdBy", "comment"].includes(k));
  if (entries.length === 0) return null;
  return (
    <div>
      <h4 className="font-medium mb-2 flex items-center gap-2">
        <MoreHorizontal className="h-4 w-4" />
        Informations complémentaires
      </h4>
      <div className="grid grid-cols-2 gap-2 text-sm bg-muted/20 p-3 rounded-lg">
        {entries.map(([key, value]) => (
          <div key={key}>
            <span className="text-muted-foreground text-xs block">{getFieldLabel(key)}</span>
            <span className="font-medium">{formatValue(value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export function NotificationDetailView({
  notification,
  onMarkAsRead,
  onDelete,
  language,
}: NotificationDetailViewProps) {
  const fullDate = new Intl.DateTimeFormat(language === "fr" ? "fr-FR" : "en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(notification.timestamp);

  const timeAgo = formatDistanceToNow(notification.timestamp, {
    addSuffix: true,
    locale: language === "fr" ? fr : enUS,
  });

  const typeLabel = {
    duplicate_task: "Doublon",
    difference_task: "Divergence",
    new_kobo_task: "Nouvelle donnée",
    missing_eneo_task: "Donnée manquante",
    task_validated: "Validé",
    task_rejected: "Rejeté",
    comment: "Commentaire",
    system: "Système",
  }[notification.type];

  const getMetadataNumber = (key: string): number | undefined => {
    const val = notification.metadata?.[key];
    return typeof val === "number" ? val : undefined;
  };

  const recordCount = getMetadataNumber("recordCount");
  const missingCount = getMetadataNumber("missingCount");

  return (
    <div className="h-full w-full flex flex-col overflow-hidden bg-background">
      {/* Header avec actions */}
      <div className="sticky top-0 z-20 border-b bg-card/95 backdrop-blur p-5 space-y-4">
        <div className="flex flex-col md:flex-row items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="mt-1 p-2 rounded-full bg-primary/10">{typeIcons[notification.type]}</div>
            <div className="flex-1">
              <h1 className="text-xl font-semibold tracking-tight">{notification.title}</h1>
              <div className="flex items-center gap-3 mt-1">
                <Badge className={typeColors[notification.type]}>{typeLabel}</Badge>
                <Badge className={priorityColors[notification.priority]}>
                  {notification.priority === "critical" ? "Critique" : 
                   notification.priority === "high" ? "Élevée" :
                   notification.priority === "medium" ? "Moyenne" : "Basse"}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {notification.action && (
              <Button asChild size="sm" className="gap-1.5">
                <a href={notification.action.url} target="_blank" rel="noopener noreferrer">
                  {notification.action.label}
                </a>
              </Button>
            )}
          </div>
        </div>

        {/* Métadonnées rapides */}
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            <span>{fullDate}</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            <span>{timeAgo}</span>
          </div>
          {notification.assignedTo && (
            <div className="flex items-center gap-1">
              <User className="h-3.5 w-3.5" />
              <span>Assigné à <span className="font-medium text-foreground">{notification.assignedTo}</span></span>
            </div>
          )}
        </div>
      </div>

      {/* Contenu principal */}
      <div className="overflow-y-auto p-5 space-y-6">
        {/* Description */}
        <Card className="p-4 bg-muted/30 border-0">
          <p className="text-sm leading-relaxed">{notification.description}</p>
        </Card>

        {/* Doublons */}
        {notification.type === "duplicate_task" && notification.sourceEquipment && notification.targetEquipment && (
          <div className="space-y-3">
            <h3 className="font-medium">Enregistrements en double</h3>
            <div className="grid grid-cols-2 gap-4">
              <EquipmentDetails equipment={notification.sourceEquipment} />
              <EquipmentDetails equipment={notification.targetEquipment} />
            </div>
            <SimilarityProgress value={notification.similarity} />
          </div>
        )}

        {/* Divergences */}
        {notification.type === "difference_task" && notification.sourceEquipment && (
          <div className="space-y-3">
            <h3 className="font-medium">Équipement concerné</h3>
            <EquipmentDetails equipment={notification.sourceEquipment} />
            <DifferencesTable differences={notification.differences} />
            {notification.similarity !== undefined && (
              <SimilarityProgress value={notification.similarity} />
            )}
          </div>
        )}

        {/* Nouvelles données */}
        {notification.type === "new_kobo_task" && notification.sourceEquipment && (
          <div className="space-y-3">
            <h3 className="font-medium">Nouvel équipement détecté</h3>
            <EquipmentDetails equipment={notification.sourceEquipment} />
            {recordCount && (
              <div className="text-sm text-muted-foreground bg-muted/20 p-3 rounded-lg">
                <span className="font-medium">{recordCount}</span> enregistrement(s) dans ce lot
              </div>
            )}
          </div>
        )}

        {/* Données manquantes */}
        {notification.type === "missing_eneo_task" && notification.sourceEquipment && (
          <div className="space-y-3">
            <h3 className="font-medium">Équipement à collecter</h3>
            <EquipmentDetails equipment={notification.sourceEquipment} />
            {missingCount && (
              <div className="text-sm text-muted-foreground bg-muted/20 p-3 rounded-lg">
                <span className="font-medium">{missingCount}</span> équipement(s) manquant(s) dans cette zone
              </div>
            )}
          </div>
        )}

        {/* Validation / rejet */}
        {(notification.type === "task_validated" || notification.type === "task_rejected") && notification.metadata && (
          <div className="space-y-3">
            <h3 className="font-medium">Détails de la décision</h3>
            <div className="bg-muted/20 p-4 rounded-lg space-y-2">
              <div className="flex items-center gap-2">
                {notification.type === "task_validated" ? <CheckCircle className="h-4 w-4 text-green-500" /> : <X className="h-4 w-4 text-red-500" />}
                <span className="font-medium">
                  {formatValue(notification.metadata.validatedBy || notification.metadata.reviewedBy || "Système")}
                </span>
              </div>
              {!!notification.metadata?.comment && (
                <p className="text-sm text-muted-foreground">« {formatValue(notification.metadata.comment)} »</p>
              )}
              {!!notification.metadata?.rejectionReason && (
                <p className="text-sm text-muted-foreground">Motif : {formatValue(notification.metadata.rejectionReason)}</p>
              )}
            </div>
          </div>
        )}

        {/* Métadonnées supplémentaires */}
        <MetadataBlock metadata={notification.metadata} />
      </div>
    </div>
  );
}
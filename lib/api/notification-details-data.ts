// lib/api/notification-details-data.ts
export type NotificationType = 
  | "duplicate_task" 
  | "difference_task" 
  | "new_kobo_task" 
  | "missing_eneo_task" 
  | "task_validated" 
  | "task_rejected" 
  | "comment" 
  | "system";

export interface Equipment {
  id: string;
  code: string;
  name: string;
  type: string;
  region: string;
  zone: string;
  departure: string;
  power?: string;
  tension?: string;
  location?: string;
  localisation?: string;
  status: "active" | "inactive" | "maintenance";
  [key: string]: unknown;
}

export interface NotificationDetail {
  id: string;
  type: NotificationType;
  title: string;
  description: string;
  senderName: string;
  senderAvatar?: string;
  senderEmail: string;
  timestamp: Date;
  isRead: boolean;
  taskId: string;
  priority: "low" | "medium" | "high" | "critical";
  
  // Task specific details
  taskType?: "duplicate" | "difference" | "new_kobo" | "missing_eneo";
  taskStatus?: "pending" | "in_progress" | "completed" | "validated" | "rejected";
  
  // Equipment details
  sourceEquipment?: Equipment;
  targetEquipment?: Equipment;
  
  // Difference details
  differences?: {
    field: string;
    sourceValue: string;
    targetValue: string;
  }[];
  
  // Additional data
  similarity?: number;
  confidence?: number;
  createdAt: Date;
  assignedAt?: Date;
  assignedTo?: string;
  assignedToAvatar?: string;
  action?: {
    label: string;
    url: string;
  };
  metadata?: Record<string, unknown>;
}

export const mockNotifications: NotificationDetail[] = [

  {
    id: "notif-002",
    type: "difference_task",
    title: "Divergence de puissance",
    description: "Différence sur la puissance du transformateur BONAMBAPE 1",
    senderName: "Système de validation",
    senderEmail: "validation@tadec.cm",
    timestamp: new Date(Date.now() - 30 * 60000),
    isRead: false,
    taskId: "task-002",
    priority: "high",
    taskType: "difference",
    taskStatus: "pending",
    assignedTo: "Marie Kouam",
    assignedToAvatar: "MK",
    sourceEquipment: {
      id: "eq-3",
      code: "EQ-BONAMBAPE-01",
      name: "Transformateur BONAMBAPE 1",
      type: "Transformateur",
      region: "Douala",
      zone: "Douala Ouest",
      departure: "BON.D11",
      power: "400 kVA",
      tension: "15/0.4 kV",
      location: "Bonambape",
      status: "active",
    },
    differences: [
      { field: "apparent_power", sourceValue: "400 kVA", targetValue: "250 kVA" },
      { field: "installation_date", sourceValue: "2024-01-15", targetValue: "2024-03-20" },
    ],
    similarity: 72,
    confidence: 88,
    createdAt: new Date(Date.now() - 35 * 60000),
    assignedAt: new Date(Date.now() - 30 * 60000),
    action: { label: "Voir", url: "/distribution/processing/differences/task-002" },
    metadata: { affectedRegion: "Douala", fieldCount: 2 },
  },
  {
    id: "notif-003",
    type: "new_kobo_task",
    title: "Nouveau poste détecté",
    description: "Un nouveau poste a été enregistré sur le terrain",
    senderName: "Collecte terrain",
    senderEmail: "kobo@tadec.cm",
    timestamp: new Date(Date.now() - 2 * 60 * 60000),
    isRead: true,
    taskId: "task-003",
    priority: "medium",
    taskType: "new_kobo",
    taskStatus: "in_progress",
    assignedTo: "Agnès Fotso",
    assignedToAvatar: "AF",
    sourceEquipment: {
      id: "eq-4",
      code: "EQ-NEW-BALI",
      name: "Poste Bali",
      type: "Poste HTA/BT",
      region: "Douala",
      zone: "Douala Ouest",
      departure: "BON.D11",
      power: "160 kVA",
      tension: "15/0.4 kV",
      location: "Carrefour Bali",
      status: "active",
    },
    createdAt: new Date(Date.now() - 2 * 60 * 60000),
    assignedAt: new Date(Date.now() - 1.5 * 60 * 60000),
    action: { label: "Valider", url: "/distribution/processing/new-kobo/task-003" },
    metadata: { source: "Kobo", recordCount: 1 },
  },
  {
    id: "notif-004",
    type: "missing_eneo_task",
    title: "Équipement manquant",
    description: "Un équipement présent en base ENEO n'a pas été collecté",
    senderName: "Système d'audit",
    senderEmail: "audit@tadec.cm",
    timestamp: new Date(Date.now() - 4 * 60 * 60000),
    isRead: false,
    taskId: "task-004",
    priority: "high",
    taskType: "missing_eneo",
    taskStatus: "pending",
    assignedTo: "",
    sourceEquipment: {
      id: "eq-5",
      code: "EQ-MISSING-01",
      name: "Poste CARREFOUR MAGNE",
      type: "Poste HTA/BT",
      region: "Douala",
      zone: "Douala Ouest",
      departure: "BON.D11",
      power: "160 kVA",
      tension: "15/0.4 kV",
      location: "Carrefour Magne, Bonamikano",
      status: "active",
    },
    createdAt: new Date(Date.now() - 4 * 60 * 60000),
    action: { label: "Planifier collecte", url: "/distribution/processing/missing-eneo/task-004" },
    metadata: { missingCount: 1, location: "Bonaberi" },
  },
  {
    id: "notif-005",
    type: "task_validated",
    title: "Validation effectuée",
    description: "Le traitement du doublon DIKABO a été validé",
    senderName: "Paul Ndi",
    senderEmail: "paul.ndi@tadec.cm",
    timestamp: new Date(Date.now() - 6 * 60 * 60000),
    isRead: true,
    taskId: "task-005",
    priority: "low",
    taskStatus: "validated",
    createdAt: new Date(Date.now() - 6 * 60 * 60000),
    action: { label: "Voir", url: "/distribution/processing/duplicates/task-005" },
    metadata: { validatedBy: "Paul Ndi", comment: "OK, fusion effectuée" },
  },
  {
    id: "notif-006",
    type: "task_rejected",
    title: "Tâche rejetée",
    description: "Le nouveau poste a été rejeté car hors zone",
    senderName: "Marie Kouam",
    senderEmail: "marie.kouam@tadec.cm",
    timestamp: new Date(Date.now() - 8 * 60 * 60000),
    isRead: true,
    taskId: "task-006",
    priority: "medium",
    taskStatus: "rejected",
    createdAt: new Date(Date.now() - 8 * 60 * 60000),
    action: { label: "Réviser", url: "/distribution/processing/new-kobo/task-006" },
    metadata: { reviewedBy: "Marie Kouam", rejectionReason: "Hors zone de collecte" },
  },
  {
    id: "notif-007",
    type: "duplicate_task",
    title: "Doublon détecté",
    description: "Deux postes identiques dans la zone de Bonamikano",
    senderName: "Système de détection",
    senderEmail: "system@tadec.cm",
    timestamp: new Date(Date.now() - 10 * 60 * 60000),
    isRead: false,
    taskId: "task-007",
    priority: "high",
    taskType: "duplicate",
    taskStatus: "pending",
    assignedTo: "Jean Dupont",
    assignedToAvatar: "JD",
    sourceEquipment: {
      id: "eq-7",
      code: "EQ-BONAMIKANO-01",
      name: "Poste Bonamikano",
      type: "Poste HTA/BT",
      region: "Douala",
      zone: "Douala Ouest",
      departure: "BON.D11",
      power: "160 kVA",
      tension: "15/0.4 kV",
      location: "Bonamikano",
      status: "active",
    },
    targetEquipment: {
      id: "eq-8",
      code: "EQ-BONAMIKANO-02",
      name: "Poste Bonamikano (double)",
      type: "Poste HTA/BT",
      region: "Douala",
      zone: "Douala Ouest",
      departure: "BON.D11",
      power: "160 kVA",
      tension: "15/0.4 kV",
      location: "Bonamikano",
      status: "active",
    },
    similarity: 96,
    confidence: 92,
    createdAt: new Date(Date.now() - 12 * 60000),
    assignedAt: new Date(Date.now() - 10 * 60000),
    action: { label: "Traiter", url: "/distribution/processing/duplicates/task-007" },
    metadata: { duplicateCount: 2, affectedRegion: "Douala" },
  },
  {
    id: "notif-008",
    type: "difference_task",
    title: "Différence de localisation",
    description: "Coordonnées GPS différentes pour le poste OK FOOD",
    senderName: "Système de validation",
    senderEmail: "validation@tadec.cm",
    timestamp: new Date(Date.now() - 12 * 60 * 60000),
    isRead: false,
    taskId: "task-008",
    priority: "medium",
    taskType: "difference",
    taskStatus: "pending",
    assignedTo: "Paul Ndi",
    assignedToAvatar: "PN",
    sourceEquipment: {
      id: "eq-9",
      code: "EQ-OKFOOD-01",
      name: "Poste OK FOOD",
      type: "Poste HTA/BT",
      region: "Douala",
      zone: "Douala Ouest",
      departure: "BON.D11",
      power: "400 kVA",
      tension: "15/0.4 kV",
      location: "Bonaberi",
      status: "active",
    },
    differences: [
      { field: "latitude", sourceValue: "4.0588", targetValue: "4.0590" },
      { field: "longitude", sourceValue: "9.7210", targetValue: "9.7215" },
    ],
    similarity: 85,
    confidence: 78,
    createdAt: new Date(Date.now() - 14 * 60000),
    assignedAt: new Date(Date.now() - 12 * 60000),
    action: { label: "Corriger", url: "/distribution/processing/differences/task-008" },
    metadata: { fieldCount: 2 },
  },
  {
    id: "notif-009",
    type: "new_kobo_task",
    title: "Lot de 5 nouveaux compteurs",
    description: "Import massif de données Kobo",
    senderName: "Collecte terrain",
    senderEmail: "kobo@tadec.cm",
    timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000),
    isRead: false,
    taskId: "task-009",
    priority: "medium",
    taskType: "new_kobo",
    taskStatus: "pending",
    assignedTo: "",
    createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
    action: { label: "Traiter", url: "/distribution/processing/new-kobo/task-009" },
    metadata: { recordCount: 5, region: "Douala" },
  },
  {
    id: "notif-010",
    type: "missing_eneo_task",
    title: "12 équipements manquants",
    description: "Une zone entière n'a pas été collectée",
    senderName: "Système d'audit",
    senderEmail: "audit@tadec.cm",
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
    isRead: false,
    taskId: "task-010",
    priority: "critical",
    taskType: "missing_eneo",
    taskStatus: "pending",
    assignedTo: "Agnès Fotso",
    assignedToAvatar: "AF",
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    action: { label: "Voir la liste", url: "/distribution/processing/missing-eneo/task-010" },
    metadata: { missingCount: 12, region: "Douala Ouest" },
  },
  {
    id: "notif-011",
    type: "comment",
    title: "Nouveau commentaire",
    description: "Un commentaire a été ajouté sur la tâche #002",
    senderName: "Agnès Fotso",
    senderEmail: "agnes.fotso@tadec.cm",
    timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000),
    isRead: false,
    taskId: "task-002",
    priority: "low",
    taskStatus: "in_progress",
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
    action: { label: "Voir", url: "/distribution/processing/differences/task-002" },
    metadata: { comment: "Vérification en cours", user: "Agnès Fotso" },
  },
  {
    id: "notif-012",
    type: "system",
    title: "Mise à jour du système",
    description: "La plateforme a été mise à jour vers la version 2.1.0",
    senderName: "Système",
    senderEmail: "system@tadec.cm",
    timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000),
    isRead: true,
    taskId: "system-001",
    priority: "low",
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
    metadata: { version: "2.1.0", changelog: "Amélioration des performances" },
  },
  {
    id: "notif-013",
    type: "duplicate_task",
    title: "Doublon détecté",
    description: "Doublon sur le poste BONABERI CENTRE",
    senderName: "Système de détection",
    senderEmail: "system@tadec.cm",
    timestamp: new Date(Date.now() - 7 * 60 * 60 * 1000),
    isRead: false,
    taskId: "task-013",
    priority: "high",
    taskType: "duplicate",
    taskStatus: "pending",
    assignedTo: "Jean Dupont",
    assignedToAvatar: "JD",
    sourceEquipment: {
      id: "eq-13",
      code: "EQ-BONABERI-CENTRE",
      name: "Poste BONABERI CENTRE",
      type: "Poste HTA/BT",
      region: "Douala",
      zone: "Douala Ouest",
      departure: "BON.D11",
      power: "250 kVA",
      tension: "15/0.4 kV",
      location: "Centre Bonaberi",
      status: "active",
    },
    targetEquipment: {
      id: "eq-14",
      code: "EQ-BONABERI-CENTRE-2",
      name: "Poste BONABERI CENTRE (copie)",
      type: "Poste HTA/BT",
      region: "Douala",
      zone: "Douala Ouest",
      departure: "BON.D11",
      power: "250 kVA",
      tension: "15/0.4 kV",
      location: "Centre Bonaberi",
      status: "active",
    },
    similarity: 100,
    confidence: 98,
    createdAt: new Date(Date.now() - 8 * 60 * 60 * 1000),
    assignedAt: new Date(Date.now() - 7 * 60 * 60 * 1000),
    action: { label: "Fusionner", url: "/distribution/processing/duplicates/task-013" },
    metadata: { duplicateCount: 2, affectedRegion: "Douala" },
  },
  {
    id: "notif-014",
    type: "task_validated",
    title: "Validation de doublon",
    description: "Le doublon DIKABO a été validé par Paul Ndi",
    senderName: "Paul Ndi",
    senderEmail: "paul.ndi@tadec.cm",
    timestamp: new Date(Date.now() - 10 * 60 * 60 * 1000),
    isRead: true,
    taskId: "task-001",
    priority: "medium",
    taskStatus: "validated",
    createdAt: new Date(Date.now() - 10 * 60 * 60 * 1000),
    action: { label: "Voir", url: "/distribution/processing/duplicates/task-001" },
    metadata: { validatedBy: "Paul Ndi", comment: "Validé après fusion" },
  },
  {
    id: "notif-015",
    type: "task_rejected",
    title: "Rejet de divergence",
    description: "La divergence sur OK FOOD a été rejetée",
    senderName: "Marie Kouam",
    senderEmail: "marie.kouam@tadec.cm",
    timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000),
    isRead: false,
    taskId: "task-008",
    priority: "medium",
    taskStatus: "rejected",
    createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
    action: { label: "Réviser", url: "/distribution/processing/differences/task-008" },
    metadata: { reviewedBy: "Marie Kouam", rejectionReason: "Les coordonnées terrain sont correctes" },
  },
  {
    id: "notif-016",
    type: "new_kobo_task",
    title: "Nouvelle donnée",
    description: "Détection d'un nouveau câble souterrain",
    senderName: "Collecte terrain",
    senderEmail: "kobo@tadec.cm",
    timestamp: new Date(Date.now() - 14 * 60 * 60 * 1000),
    isRead: false,
    taskId: "task-016",
    priority: "medium",
    taskType: "new_kobo",
    taskStatus: "pending",
    assignedTo: "",
    sourceEquipment: {
      id: "eq-16",
      code: "CABLE-NEW-01",
      name: "Câble souterrain",
      type: "Câble",
      region: "Douala",
      zone: "Douala Ouest",
      departure: "BON.D11",
      power: "",
      tension: "15 kV",
      location: "Rue 12, Bonaberi",
      status: "active",
    },
    createdAt: new Date(Date.now() - 14 * 60 * 60 * 1000),
    action: { label: "Valider", url: "/distribution/processing/new-kobo/task-016" },
    metadata: { recordCount: 1, source: "Kobo" },
  },
  {
    id: "notif-017",
    type: "missing_eneo_task",
    title: "Manquant critique",
    description: "3 transformateurs non collectés",
    senderName: "Système d'audit",
    senderEmail: "audit@tadec.cm",
    timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    isRead: false,
    taskId: "task-017",
    priority: "critical",
    taskType: "missing_eneo",
    taskStatus: "pending",
    assignedTo: "Agnès Fotso",
    assignedToAvatar: "AF",
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    action: { label: "Planifier", url: "/distribution/processing/missing-eneo/task-017" },
    metadata: { missingCount: 3, location: "Zone industrielle" },
  },
  {
    id: "notif-018",
    type: "difference_task",
    title: "Divergence de tension",
    description: "Tension différente pour le transformateur SICC KADJI",
    senderName: "Système de validation",
    senderEmail: "validation@tadec.cm",
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    isRead: true,
    taskId: "task-018",
    priority: "high",
    taskType: "difference",
    taskStatus: "completed",
    assignedTo: "Jean Dupont",
    assignedToAvatar: "JD",
    sourceEquipment: {
      id: "eq-18",
      code: "EQ-SICC-KADJI",
      name: "Transformateur SICC KADJI",
      type: "Transformateur",
      region: "Douala",
      zone: "Douala Ouest",
      departure: "BON.D11",
      power: "1000 kVA",
      tension: "30/0.4 kV",
      location: "Zone industrielle",
      status: "active",
    },
    differences: [
      { field: "w1_voltage", sourceValue: "15", targetValue: "30" },
      { field: "apparent_power", sourceValue: "1000 kVA", targetValue: "800 kVA" },
    ],
    similarity: 65,
    confidence: 72,
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    assignedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 3600000),
    action: { label: "Voir", url: "/distribution/processing/differences/task-018" },
    metadata: { fieldCount: 2 },
  },
  {
    id: "notif-019",
    type: "task_validated",
    title: "Validation de nouveau poste",
    description: "Le poste Bali a été validé et intégré",
    senderName: "Marie Kouam",
    senderEmail: "marie.kouam@tadec.cm",
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    isRead: true,
    taskId: "task-003",
    priority: "low",
    taskStatus: "validated",
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    action: { label: "Voir", url: "/distribution/processing/new-kobo/task-003" },
    metadata: { validatedBy: "Marie Kouam", comment: "Nouveau poste accepté" },
  },
  {
    id: "notif-020",
    type: "system",
    title: "Rapport hebdomadaire",
    description: "Taux de traitement : 78%, 142 anomalies résolues",
    senderName: "Système",
    senderEmail: "system@tadec.cm",
    timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
    isRead: false,
    taskId: "report-001",
    priority: "low",
    createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
    action: { label: "Voir le rapport", url: "/dashboard" },
    metadata: { week: "12", resolved: 142, rate: 78 },
  },
];

export function getNotificationById(id: string): NotificationDetail | undefined {
  return mockNotifications.find((n) => n.id === id);
}

export function getAllNotifications(): NotificationDetail[] {
  return [...mockNotifications].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

export function getUnreadNotifications(): NotificationDetail[] {
  return getAllNotifications().filter((n) => !n.isRead);
}

export function markAsRead(id: string): void {
  const notif = mockNotifications.find((n) => n.id === id);
  if (notif) {
    notif.isRead = true;
  }
}
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
  status: "active" | "inactive" | "maintenance";
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
  action?: {
    label: string;
    url: string;
  };
  metadata?: Record<string, unknown>;
}

export const mockNotifications: NotificationDetail[] = [
  {
    id: "notif-001",
    type: "duplicate_task",
    title: "Tâche de doublons assignée",
    description: "Doublon détecté - EQ-DRD-001",
    senderName: "Administrateur Système",
    senderEmail: "admin@tadec.cm",
    timestamp: new Date(Date.now() - 5 * 60000),
    isRead: false,
    taskId: "task-001",
    priority: "high",
    taskType: "duplicate",
    taskStatus: "pending",
    sourceEquipment: {
      id: "eq-1",
      code: "EQ-DRD-001",
      name: "Transformateur HTA/BT",
      type: "Transformateur",
      region: "Douala",
      zone: "Douala Ouest",
      departure: "Depart-A",
      power: "250 kVA",
      tension: "30/0.4 kV",
      status: "active",
    },
    targetEquipment: {
      id: "eq-2",
      code: "EQ-DRD-001-COPY",
      name: "Transformateur HTA/BT (Doublon)",
      type: "Transformateur",
      region: "Douala",
      zone: "Douala Ouest",
      departure: "Depart-A",
      power: "250 kVA",
      tension: "30/0.4 kV",
      status: "active",
    },
    similarity: 0.98,
    confidence: 0.95,
    createdAt: new Date(Date.now() - 10 * 60000),
    assignedAt: new Date(Date.now() - 5 * 60000),
    action: {
      label: "Traiter la tâche",
      url: "/processing/duplicates/task-001",
    },
    metadata: {
      duplicateCount: 2,
      affectedRegion: "Douala",
      createdBy: "admin-001",
    },
  },
  {
    id: "notif-002",
    type: "difference_task",
    title: "Divergence détectée - Kobo vs Eneo",
    description: "Différences trouvées pour EQ-YDE-445",
    senderName: "Système de Validation",
    senderEmail: "system@tadec.cm",
    timestamp: new Date(Date.now() - 30 * 60000),
    isRead: false,
    taskId: "task-002",
    priority: "high",
    taskType: "difference",
    taskStatus: "pending",
    sourceEquipment: {
      id: "eq-3",
      code: "EQ-YDE-445",
      name: "Poste de transformation",
      type: "Poste HTA/BT",
      region: "Yaoundé",
      zone: "Yaoundé Centre",
      departure: "Depart-B",
      power: "160 kVA",
      tension: "15/0.4 kV",
      status: "active",
    },
    differences: [
      {
        field: "Adresse",
        sourceValue: "Rue de la Paix, Yaoundé",
        targetValue: "Avenue de la Paix, Yaoundé",
      },
      {
        field: "Puissance",
        sourceValue: "160 kVA",
        targetValue: "250 kVA",
      },
      {
        field: "Date d'installation",
        sourceValue: "2018-03-15",
        targetValue: "2019-03-15",
      },
    ],
    similarity: 0.72,
    confidence: 0.88,
    createdAt: new Date(Date.now() - 35 * 60000),
    assignedAt: new Date(Date.now() - 30 * 60000),
    action: {
      label: "Résoudre les divergences",
      url: "/processing/differences/task-002",
    },
  },
  {
    id: "notif-003",
    type: "task_validated",
    title: "Tâche validée avec succès",
    description: "Votre traitement a été approuvé",
    senderName: "Jean Dupont",
    senderEmail: "jean.dupont@tadec.cm",
    timestamp: new Date(Date.now() - 2 * 60 * 60000),
    isRead: true,
    taskId: "task-003",
    priority: "low",
    taskStatus: "validated",
    createdAt: new Date(Date.now() - 2 * 60 * 60000),
    action: {
      label: "Voir les détails",
      url: "/processing/validated",
    },
    metadata: {
      validationDate: new Date(Date.now() - 2 * 60 * 60000),
      validatedBy: "Jean Dupont",
      comment: "Excellent travail sur cette tâche",
    },
  },
  {
    id: "notif-004",
    type: "new_kobo_task",
    title: "Nouvelles données Kobo détectées",
    description: "45 nouveaux enregistrements Kobo",
    senderName: "Système de Synchronisation",
    senderEmail: "system@tadec.cm",
    timestamp: new Date(Date.now() - 4 * 60 * 60000),
    isRead: true,
    taskId: "task-004",
    priority: "medium",
    taskType: "new_kobo",
    taskStatus: "in_progress",
    createdAt: new Date(Date.now() - 4 * 60 * 60000),
    metadata: {
      recordCount: 45,
      region: "Douala",
      syncDate: new Date(Date.now() - 4 * 60 * 60000),
    },
  },
  {
    id: "notif-005",
    type: "task_rejected",
    title: "Tâche rejetée - Révision requise",
    description: "Des corrections sont nécessaires",
    senderName: "Marie Kouam",
    senderEmail: "marie.kouam@tadec.cm",
    timestamp: new Date(Date.now() - 6 * 60 * 60000),
    isRead: true,
    taskId: "task-005",
    priority: "critical",
    taskStatus: "rejected",
    createdAt: new Date(Date.now() - 6 * 60 * 60000),
    action: {
      label: "Réviser la tâche",
      url: "/processing/duplicates/task-005",
    },
    metadata: {
      rejectionReason: "Les données source ne correspondent pas aux critères de validation",
      reviewedBy: "Marie Kouam",
    },
  },
  {
    id: "notif-006",
    type: "missing_eneo_task",
    title: "Données Eneo manquantes",
    description: "12 équipements manquent dans Eneo",
    senderName: "Système d'Audit",
    senderEmail: "system@tadec.cm",
    timestamp: new Date(Date.now() - 8 * 60 * 60000),
    isRead: true,
    taskId: "task-006",
    priority: "high",
    taskType: "missing_eneo",
    taskStatus: "pending",
    createdAt: new Date(Date.now() - 8 * 60 * 60000),
    metadata: {
      missingCount: 12,
      region: "Bertoua",
      lastSync: new Date(Date.now() - 8 * 60 * 60000),
    },
  },
];


export function getNotificationById(id: string): NotificationDetail | undefined {
  return mockNotifications.find((n) => n.id === id);
}

export function getAllNotifications(): NotificationDetail[] {
  return mockNotifications.sort(
    (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
  );
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
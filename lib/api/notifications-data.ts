"use client";

// Notification types
export type NotificationType = 
  | "task_assigned" 
  | "task_completed" 
  | "task_validated" 
  | "task_rejected" 
  | "comment_added" 
  | "equipment_updated" 
  | "report_ready" 
  | "system_alert" 
  | "workflow_update";

export type NotificationPriority = "low" | "medium" | "high" | "critical";
export type NotificationStatus = "unread" | "read" | "archived";

export interface NotificationData {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  status: NotificationStatus;
  title: string;
  description: string;
  message: string;
  avatar?: string;
  avatarInitials?: string;
  timestamp: Date;
  relatedId?: string; // task ID, equipment ID, etc.
  relatedType?: string; // "task", "equipment", "report"
  action?: {
    label: string;
    href?: string;
    callback?: () => void;
  };
  read: boolean;
}

// Mock notifications
export const generateMockNotifications = (): NotificationData[] => {
  const now = new Date();
  
  return [
    {
      id: "notif-001",
      type: "task_assigned",
      priority: "high",
      status: "unread",
      title: "Nouvelle tâche assignée",
      description: "Doublons - Région Douala Ouest",
      message: "Une nouvelle tâche de traitement des doublons vous a été assignée pour la région Douala Ouest.",
      avatarInitials: "DRD",
      timestamp: new Date(now.getTime() - 15 * 60000),
      relatedId: "task-001",
      relatedType: "task",
      read: false,
      action: { label: "Voir la tâche", href: "/processing/duplicates" },
    },
    {
      id: "notif-002",
      type: "task_completed",
      priority: "medium",
      status: "unread",
      title: "Tâche complétée",
      description: "Vérification équipement EQ-DRD-001",
      message: "La tâche de vérification de l'équipement EQ-DRD-001 a été marquée comme complétée.",
      avatarInitials: "JD",
      timestamp: new Date(now.getTime() - 1 * 60 * 60000),
      relatedId: "eq-001",
      relatedType: "equipment",
      read: false,
    },
    {
      id: "notif-003",
      type: "comment_added",
      priority: "low",
      status: "read",
      title: "Nouveau commentaire",
      description: "Jean Dupont a commenté votre tâche",
      message: "Jean Dupont a ajouté un commentaire sur la tâche 'Différences Kobo/Eneo - Yaoundé'.",
      avatarInitials: "JD",
      timestamp: new Date(now.getTime() - 2 * 60 * 60000),
      relatedId: "task-002",
      relatedType: "task",
      read: true,
    },
    {
      id: "notif-004",
      type: "task_validated",
      priority: "high",
      status: "read",
      title: "Tâche validée",
      description: "Validation des données - Douala Centre",
      message: "Votre travail sur la validation des données pour Douala Centre a été approuvé.",
      avatarInitials: "MK",
      timestamp: new Date(now.getTime() - 4 * 60 * 60000),
      relatedId: "task-003",
      relatedType: "task",
      read: true,
      action: { label: "Voir le rapport", href: "/performance" },
    },
    {
      id: "notif-005",
      type: "equipment_updated",
      priority: "medium",
      status: "read",
      title: "Équipement mis à jour",
      description: "EQ-DRY-123 - Statut changé à 'En cours'",
      message: "L'équipement EQ-DRY-123 a été mis à jour par Claire Biya.",
      avatarInitials: "CB",
      timestamp: new Date(now.getTime() - 6 * 60 * 60000),
      relatedId: "eq-002",
      relatedType: "equipment",
      read: true,
    },
    {
      id: "notif-006",
      type: "report_ready",
      priority: "high",
      status: "read",
      title: "Rapport disponible",
      description: "Rapport mensuel - Mars 2024",
      message: "Votre rapport de performance mensuel est maintenant disponible pour consultation.",
      avatarInitials: "SYS",
      timestamp: new Date(now.getTime() - 8 * 60 * 60000),
      relatedId: "report-001",
      relatedType: "report",
      read: true,
      action: { label: "Télécharger", href: "/performance?download=true" },
    },
    {
      id: "notif-007",
      type: "task_rejected",
      priority: "critical",
      status: "read",
      title: "Tâche rejetée",
      description: "Différences Kobo/Eneo - Bertoua",
      message: "Votre travail sur la tâche 'Différences Kobo/Eneo - Bertoua' a été rejeté. Veuillez réviser et réessayer.",
      avatarInitials: "PN",
      timestamp: new Date(now.getTime() - 12 * 60 * 60000),
      relatedId: "task-004",
      relatedType: "task",
      read: true,
      action: { label: "Voir les détails", href: "/processing/differences" },
    },
    {
      id: "notif-008",
      type: "system_alert",
      priority: "critical",
      status: "read",
      title: "Alerte système",
      description: "Maintenance prévue le 25 Mars",
      message: "Une maintenance du système est prévue le 25 Mars de 02:00 à 04:00. Les services seront temporairement indisponibles.",
      avatarInitials: "SYS",
      timestamp: new Date(now.getTime() - 24 * 60 * 60000),
      relatedType: "system",
      read: true,
    },
  ];
};

// Mock notifications service
export class NotificationService {
  private notifications: NotificationData[] = generateMockNotifications();

  getAll(): NotificationData[] {
    return this.notifications;
  }

  getUnread(): NotificationData[] {
    return this.notifications.filter((n) => n.status === "unread");
  }

  getUnreadCount(): number {
    return this.getUnread().length;
  }

  markAsRead(id: string): void {
    const notification = this.notifications.find((n) => n.id === id);
    if (notification) {
      notification.status = "read";
      notification.read = true;
    }
  }

  markAllAsRead(): void {
    this.notifications.forEach((n) => {
      n.status = "read";
      n.read = true;
    });
  }

  archive(id: string): void {
    const notification = this.notifications.find((n) => n.id === id);
    if (notification) {
      notification.status = "archived";
    }
  }

  delete(id: string): void {
    this.notifications = this.notifications.filter((n) => n.id !== id);
  }

  filter(
    type?: NotificationType,
    priority?: NotificationPriority,
    status?: NotificationStatus
  ): NotificationData[] {
    return this.notifications.filter((n) => {
      if (type && n.type !== type) return false;
      if (priority && n.priority !== priority) return false;
      if (status && n.status !== status) return false;
      return true;
    });
  }

  search(query: string): NotificationData[] {
    const q = query.toLowerCase();
    return this.notifications.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.description.toLowerCase().includes(q) ||
        n.message.toLowerCase().includes(q)
    );
  }
}

// Export singleton instance
export const notificationService = new NotificationService();
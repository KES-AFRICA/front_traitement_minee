"use client";

import { Notification } from "@/lib/api/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Bell,
  CheckCircle,
  AlertCircle,
  MessageCircle,
  Archive,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr, enUS } from "date-fns/locale";

interface NotificationDetailViewProps {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
  onDelete: (id: string) => void;
  language: string;
}

const typeIcons: Record<Notification["type"], React.ReactNode> = {
  new_task: <Bell className="h-6 w-6 text-blue-500" />,
  task_validated: <CheckCircle className="h-6 w-6 text-green-500" />,
  task_rejected: <AlertCircle className="h-6 w-6 text-red-500" />,
  comment: <MessageCircle className="h-6 w-6 text-orange-500" />,
  system: <AlertCircle className="h-6 w-6 text-gray-500" />,
};

const typeLabels: Record<Notification["type"], { fr: string; en: string }> = {
  new_task: { fr: "Nouvelle tâche", en: "New task" },
  task_validated: { fr: "Tâche validée", en: "Task validated" },
  task_rejected: { fr: "Tâche rejetée", en: "Task rejected" },
  comment: { fr: "Commentaire", en: "Comment" },
  system: { fr: "Système", en: "System" },
};

export function NotificationDetailView({
  notification,
  onMarkAsRead,
  onDelete,
  language,
}: NotificationDetailViewProps) {
  const fullDate = new Intl.DateTimeFormat(
    language === "fr" ? "fr-FR" : "en-US",
    {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  ).format(new Date(notification.createdAt));

  const timeAgo = formatDistanceToNow(new Date(notification.createdAt), {
    addSuffix: true,
    locale: language === "fr" ? fr : enUS,
  });

  const typeLabel =
    typeLabels[notification.type][language === "fr" ? "fr" : "en"];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="sticky top-0 z-20 space-y-4 border-b bg-card p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="mt-1">{typeIcons[notification.type]}</div>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-foreground">
                {notification.title}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {fullDate}
              </p>
            </div>
          </div>
          <Badge
            variant="outline"
            className={
              notification.type === "task_rejected"
                ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/30 dark:bg-red-950/30"
                : notification.type === "task_validated"
                  ? "border-green-200 bg-green-50 text-green-700 dark:border-green-900/30 dark:bg-green-950/30"
                  : ""
            }
          >
            {typeLabel}
          </Badge>
        </div>

        <Separator />

        <div className="flex gap-2">
          {!notification.isRead && (
            <Button
              size="sm"
              variant="default"
              onClick={() => onMarkAsRead(notification.id)}
              className="gap-2"
            >
              <CheckCircle className="h-4 w-4" />
              {language === "fr" ? "Marquer comme lu" : "Mark as read"}
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => onDelete(notification.id)}
            className="gap-2"
          >
            <Archive className="h-4 w-4" />
            {language === "fr" ? "Archiver" : "Archive"}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-6">
          <Card className="p-4 bg-muted/30 border-0">
            <p className="text-sm leading-relaxed text-foreground">
              {notification.message}
            </p>
          </Card>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">
                {language === "fr" ? "Reçu" : "Received"}
              </p>
              <p className="font-medium mt-1">{timeAgo}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">
                {language === "fr" ? "Type" : "Type"}
              </p>
              <p className="font-medium mt-1">{typeLabel}</p>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
            <p className="text-xs text-muted-foreground">
              {language === "fr"
                ? "Consultez votre tableau de bord pour agir sur cette notification"
                : "Check your dashboard to take action on this notification"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
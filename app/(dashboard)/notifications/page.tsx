"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, Check, Trash2 } from "lucide-react";
import { Notification } from "@/lib/api/types";
import { mockNotifications } from "@/lib/api/mock-data";
import { formatDistanceToNow } from "date-fns";
import { fr, enUS } from "date-fns/locale";

const notificationIcons: Record<Notification["type"], React.ReactNode> = {
  new_task: <Bell className="h-5 w-5 text-blue-600" />,
  task_validated: <Check className="h-5 w-5 text-green-600" />,
  task_rejected: <Bell className="h-5 w-5 text-red-600" />,
  comment: <Bell className="h-5 w-5 text-orange-600" />,
  system: <Bell className="h-5 w-5 text-gray-600" />,
};

const typeLabels: Record<Notification["type"], string> = {
  new_task: "Nouvelle tâche",
  task_validated: "Tâche validée",
  task_rejected: "Tâche rejetée",
  comment: "Commentaire",
  system: "Système",
};

export default function NotificationsPage() {
  const { t, language } = useI18n();
  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications);

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const unreadNotifications = notifications.filter((n) => !n.isRead);
  const readNotifications = notifications.filter((n) => n.isRead);

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const deleteNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const formatDate = (dateString: string) => {
    return formatDistanceToNow(new Date(dateString), {
      addSuffix: true,
      locale: language === "fr" ? fr : enUS,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Bell className="h-8 w-8" />
            {t("notifications.title")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {unreadCount > 0 
              ? `${unreadCount} notification(s) non lue(s)`
              : "Toutes les notifications ont été lues"}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button onClick={markAllAsRead} variant="outline" className="gap-2">
            <Check className="h-4 w-4" />
            {t("notifications.markAllRead")}
          </Button>
        )}
      </div>

      {/* Unread Notifications */}
      {unreadNotifications.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Non lues ({unreadCount})</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-auto">
              <div className="space-y-3">
                {unreadNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className="flex gap-3 p-3 rounded-lg border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors"
                  >
                    <div className="mt-1">{notificationIcons[notification.type]}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-sm">{notification.title}</p>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {notification.message}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline" className="text-xs">
                              {typeLabels[notification.type]}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {formatDate(notification.createdAt)}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => markAsRead(notification.id)}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteNotification(notification.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Read Notifications */}
      {readNotifications.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Lues ({readNotifications.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-auto">
              <div className="space-y-2">
                {readNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className="flex gap-3 p-3 rounded-lg hover:bg-muted transition-colors opacity-75"
                  >
                    <div className="mt-1">{notificationIcons[notification.type]}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm text-foreground">{notification.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(notification.createdAt)}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteNotification(notification.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {notifications.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-30" />
            <p className="text-muted-foreground">{t("notifications.noNotifications")}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
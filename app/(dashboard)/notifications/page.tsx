"use client";

import { useState, useMemo } from "react";
import { useI18n } from "@/lib/i18n/context";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PeriodFilter, TimePeriod } from "@/components/notifications/period-filter";
import { NotificationListItem } from "@/components/notifications/notification-list-item";
import { NotificationDetailView } from "@/components/notifications/notification-detail-view";
import { NotificationGroup } from "@/components/notifications/notification-group";
import { ResizableDivider } from "@/components/notifications/resizable-divider";
import { Notification } from "@/lib/api/types";
import { mockNotifications } from "@/lib/api/mock-data";
import { Search, Bell, Check } from "lucide-react";
import {
  formatDistanceToNow,
  isToday,
  isYesterday,
  isThisWeek,
  isThisMonth,
} from "date-fns";
import { fr, enUS } from "date-fns/locale";

const getDateGroup = (date: Date, language: string): string => {
  if (isToday(date)) return language === "fr" ? "Aujourd'hui" : "Today";
  if (isYesterday(date)) return language === "fr" ? "Hier" : "Yesterday";
  if (isThisWeek(date))
    return language === "fr" ? "Cette semaine" : "This week";
  if (isThisMonth(date))
    return language === "fr" ? "Ce mois" : "This month";
  return language === "fr" ? "Plus ancien" : "Older";
};

const getTimePeriodMs = (period: TimePeriod): number => {
  switch (period) {
    case "24h":
      return 24 * 60 * 60 * 1000;
    case "7d":
      return 7 * 24 * 60 * 60 * 1000;
    case "30d":
      return 30 * 24 * 60 * 60 * 1000;
  }
};

export default function NotificationsPage() {
  const { language } = useI18n();
  const [notifications, setNotifications] = useState<Notification[]>(
    mockNotifications
  );
  const [selectedNotification, setSelectedNotification] =
    useState<Notification | null>(notifications[0] || null);
  const [searchQuery, setSearchQuery] = useState("");
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("24h");
  const [leftWidth, setLeftWidth] = useState(45);

  const periodFiltered = useMemo(() => {
    const periodMs = getTimePeriodMs(timePeriod);
    const cutoffTime = Date.now() - periodMs;
    return notifications.filter(
      (n) => new Date(n.createdAt).getTime() > cutoffTime
    );
  }, [notifications, timePeriod]);

  const filtered = useMemo(() => {
    if (!searchQuery) return periodFiltered;
    const query = searchQuery.toLowerCase();
    return periodFiltered.filter(
      (n) =>
        n.title.toLowerCase().includes(query) ||
        n.message.toLowerCase().includes(query)
    );
  }, [periodFiltered, searchQuery]);

  const grouped = useMemo(() => {
    const groups: Record<string, Notification[]> = {};
    filtered.forEach((n) => {
      const dateGroup = getDateGroup(
        new Date(n.createdAt),
        language
      );
      if (!groups[dateGroup]) groups[dateGroup] = [];
      groups[dateGroup].push(n);
    });
    return groups;
  }, [filtered, language]);

  const handleSelectNotification = (notification: Notification) => {
    setSelectedNotification(notification);
    if (!notification.isRead) {
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notification.id ? { ...n, isRead: true } : n
        )
      );
    }
  };

  const handleMarkAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
  };

  const handleMarkAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const handleDelete = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (selectedNotification?.id === id) {
      setSelectedNotification(
        notifications.find((n) => n.id !== id) || null
      );
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="border-b bg-card px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bell className="h-6 w-6 text-primary" />
          <div>
            <h1 className="font-semibold text-foreground">
              {language === "fr" ? "Notifications" : "Notifications"}
            </h1>
            <p className="text-xs text-muted-foreground">
              {unreadCount > 0
                ? language === "fr"
                  ? `${unreadCount} non lue(s)`
                  : `${unreadCount} unread`
                : language === "fr"
                  ? "Aucune nouvelle"
                  : "All caught up"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <PeriodFilter
            selected={timePeriod}
            onSelectPeriod={setTimePeriod}
            language={language}
          />
          {unreadCount > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleMarkAllAsRead}
              className="gap-1.5"
            >
              <Check className="h-4 w-4" />
              <span className="hidden sm:inline text-xs">
                {language === "fr" ? "Tout lire" : "Mark all"}
              </span>
            </Button>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex gap-0 overflow-hidden">
        {/* Left panel - List */}
        <div
          className="flex flex-col border-r overflow-hidden transition-all"
          style={{ width: `${leftWidth}%` }}
        >
          {/* Search */}
          <div className="border-b p-3 flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={language === "fr" ? "Chercher..." : "Search..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
          </div>

          {/* Notifications list */}
          <ScrollArea className="flex-1">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4 text-center">
                <Bell className="h-12 w-12 opacity-20 mb-2" />
                <p className="text-sm">
                  {language === "fr"
                    ? "Aucune notification"
                    : "No notifications"}
                </p>
              </div>
            ) : (
              <div className="space-y-0">
                {Object.entries(grouped).map(([dateGroup, notifs]) => (
                  <NotificationGroup
                    key={dateGroup}
                    date={dateGroup}
                    notifications={notifs}
                    onSelect={handleSelectNotification}
                    selectedId={selectedNotification?.id}
                    language={language}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Resizable divider */}
        <div
          className="flex h-full"
          style={{ width: `${100 - leftWidth}%`, position: "relative" }}
        >
          <div
            onMouseDown={(e) => {
              const startX = e.clientX;        
              const startWidth = leftWidth;
              const container = document.body;

              const handleMove = (moveEvent: MouseEvent) => {
                const deltaX = moveEvent.clientX - startX;
                const containerWidth = container.clientWidth;
                const deltaPercent = (deltaX / containerWidth) * 100;
                const newLeftWidth = startWidth + deltaPercent;

                if (newLeftWidth >= 20 && newLeftWidth <= 80) {
                  setLeftWidth(newLeftWidth);
                }
              };

              const handleUp = () => {
                document.removeEventListener("mousemove", handleMove);
                document.removeEventListener("mouseup", handleUp);
              };

              document.addEventListener("mousemove", handleMove);
              document.addEventListener("mouseup", handleUp);
            }}
            className="w-1 bg-border hover:bg-primary/50 transition-colors cursor-col-resize select-none"
          />

          {/* Right panel - Details */}
          <div className="hidden md:flex flex-col flex-1 overflow-hidden bg-card">
            {selectedNotification ? (
              <NotificationDetailView
                notification={selectedNotification}
                onMarkAsRead={handleMarkAsRead}
                onDelete={handleDelete}
                language={language}
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-6 text-center">
                <Bell className="h-16 w-16 opacity-10 mb-4" />
                <p className="text-sm">
                  {language === "fr"
                    ? "Sélectionnez une notification"
                    : "Select a notification"}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
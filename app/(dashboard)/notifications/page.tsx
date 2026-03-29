"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n/context";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PeriodFilter, TimePeriod } from "@/components/notifications/period-filter";
import { NotificationDetailView } from "@/components/notifications/notification-detail-view";
import { NotificationGroup } from "@/components/notifications/notification-group";
import { NotificationDetail } from "@/lib/api/notification-details-data";
import { Search, Bell, Check, ArrowLeft } from "lucide-react";
import {
  isToday,
  isYesterday,
  isThisWeek,
  isThisMonth,
} from "date-fns";
import { ResizableDivider } from "@/components/notifications/resizable-divider";
import { useNotificationContext } from "@/lib/context/notification-context";

// Helper functions
const getDateGroup = (date: Date, language: string): string => {
  if (isToday(date)) return language === "fr" ? "Aujourd'hui" : "Today";
  if (isYesterday(date)) return language === "fr" ? "Hier" : "Yesterday";
  if (isThisWeek(date)) return language === "fr" ? "Cette semaine" : "This week";
  if (isThisMonth(date)) return language === "fr" ? "Ce mois" : "This month";
  return language === "fr" ? "Plus ancien" : "Older";
};

const getTimePeriodMs = (period: TimePeriod): number => {
  switch (period) {
    case "24h": return 24 * 60 * 60 * 1000;
    case "7d":  return 7 * 24 * 60 * 60 * 1000;
    case "30d": return 30 * 24 * 60 * 60 * 1000;
    case "all": return Infinity;
    default:    return Infinity;
  }
};

export default function NotificationsPage() {
  const { language } = useI18n();
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotificationContext();

  const searchParams = useSearchParams();
  const notificationIdFromUrl = searchParams.get("notificationId");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [mobileShowDetail, setMobileShowDetail] = useState(false);
  const [leftWidth, setLeftWidth] = useState(35);

  // Derive selected notification from context (always fresh)
  const selectedNotification = useMemo(() => {
    if (!selectedId) return null;
    return notifications.find(n => n.id === selectedId) || null;
  }, [notifications, selectedId]);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 100);
    return () => clearTimeout(timer);
  }, []);

  // Handle URL parameter selection
  useEffect(() => {
    if (isLoading || notifications.length === 0) return;
    if (notificationIdFromUrl) {
      setSelectedId(notificationIdFromUrl);
      setMobileShowDetail(true);
      const found = notifications.find(n => n.id === notificationIdFromUrl);
      if (found && !found.isRead) markAsRead(notificationIdFromUrl);
    }
  }, [notificationIdFromUrl, notifications, isLoading, markAsRead]);

  // Filtering
  const periodFiltered = useMemo(() => {
    if (timePeriod === "all") return notifications;
    const cutoff = Date.now() - getTimePeriodMs(timePeriod);
    return notifications.filter((n) => n.timestamp.getTime() > cutoff);
  }, [notifications, timePeriod]);

  const filtered = useMemo(() => {
    if (!searchQuery) return periodFiltered;
    const query = searchQuery.toLowerCase();
    return periodFiltered.filter(
      (n) =>
        n.title.toLowerCase().includes(query) ||
        n.description.toLowerCase().includes(query)
    );
  }, [periodFiltered, searchQuery]);

  const grouped = useMemo(() => {
    const groups: Record<string, NotificationDetail[]> = {};
    filtered.forEach((n) => {
      const group = getDateGroup(n.timestamp, language);
      if (!groups[group]) groups[group] = [];
      groups[group].push(n);
    });
    return groups;
  }, [filtered, language]);

  const handleSelectNotification = (notification: NotificationDetail) => {
    setSelectedId(notification.id);
    setMobileShowDetail(true);
    if (!notification.isRead) {
      markAsRead(notification.id);
    }
  };

  const handleBack = () => setMobileShowDetail(false);

  // ─── List panel (left) ────────────────────────────────────────────────────
  const ListPanel = (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="border-b bg-card px-4 py-3 flex flex-col shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <Bell className="h-5 w-5 text-primary" />
          <div>
            <h1 className="font-semibold text-foreground text-sm leading-tight">
              Notifications
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
        <div className="flex items-center gap-1.5">
          <PeriodFilter selected={timePeriod} onSelectPeriod={setTimePeriod} language={language} />
          {unreadCount > 0 && (
            <Button size="sm" variant="outline" onClick={markAllAsRead} className="gap-1 h-8 px-2">
              <Check className="h-3.5 w-3.5" />
              <span className="text-xs hidden sm:inline">
                {language === "fr" ? "Tout lire" : "Mark all"}
              </span>
            </Button>
          )}
        </div>
      </div>

      <div className="border-b p-3 shrink-0">
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

      <div className="flex-1 min-h-0">
        <ScrollArea className="h-full">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground text-center px-4">
              <Bell className="h-12 w-12 opacity-20 mb-2" />
              <p className="text-sm">
                {language === "fr" ? "Aucune notification" : "No notifications"}
              </p>
            </div>
          ) : (
            <div>
              {Object.entries(grouped).map(([dateGroup, notifs]) => (
                <NotificationGroup
                  key={dateGroup}
                  date={dateGroup}
                  notifications={notifs}
                  onSelect={handleSelectNotification}
                  selectedId={selectedId!}
                  language={language}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );

  // ─── Detail panel (right) ─────────────────────────────────────────────────
  const DetailPanel = (
    <div className="flex flex-col h-full overflow-hidden bg-card">
      {selectedNotification ? (
        <NotificationDetailView
          notification={selectedNotification}
          onMarkAsRead={markAsRead}
          onDelete={deleteNotification}
          language={language}
        />
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-6 text-center">
          <Bell className="h-16 w-16 opacity-10 mb-4" />
          <p className="text-sm">
            {language === "fr" ? "Sélectionnez une notification" : "Select a notification"}
          </p>
        </div>
      )}
    </div>
  );

  // ─── Mobile detail view with back button ──────────────────────────────────
  const MobileDetailView = (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="border-b bg-card px-4 py-3 flex items-center gap-3 shrink-0">
        <button onClick={handleBack} className="flex items-center gap-1.5 text-primary text-sm font-medium">
          <ArrowLeft className="h-4 w-4" />
          {language === "fr" ? "Retour" : "Back"}
        </button>
      </div>
      <div className="flex-1 overflow-hidden">{DetailPanel}</div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <>
      <div className="md:hidden h-screen flex flex-col overflow-hidden bg-background">
        {mobileShowDetail ? MobileDetailView : ListPanel}
      </div>
      <div className="hidden md:flex h-screen overflow-hidden bg-background">
        <ResizableDivider
          left={ListPanel}
          right={DetailPanel}
          onResize={setLeftWidth}
          minLeft={20}
          maxLeft={80}
          initialLeftWidth={leftWidth}
        />
      </div>
    </>
  );
}
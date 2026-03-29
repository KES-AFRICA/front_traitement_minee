"use client";

import { useI18n } from "@/lib/i18n/context";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, CheckCircle, XCircle, AlertCircle, Info, Check } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import { useNotificationContext } from "@/lib/context/notification-context";

const notificationIcons: Record<string, React.ReactNode> = {
  duplicate_task: <AlertCircle className="h-4 w-4 text-amber-500" />,
  difference_task: <AlertCircle className="h-4 w-4 text-blue-500" />,
  new_kobo_task: <AlertCircle className="h-4 w-4 text-green-500" />,
  missing_eneo_task: <AlertCircle className="h-4 w-4 text-orange-500" />,
  task_validated: <CheckCircle className="h-4 w-4 text-emerald-500" />,
  task_rejected: <XCircle className="h-4 w-4 text-red-500" />,
  comment: <Info className="h-4 w-4 text-sky-500" />,
  system: <Info className="h-4 w-4 text-muted-foreground" />,
};

export function NotificationDropdown() {
  const { t, language } = useI18n();
  const router = useRouter();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotificationContext();

  const formatDate = (date: Date) => {
    return formatDistanceToNow(date, {
      addSuffix: true,
      locale: language === "fr" ? fr : enUS,
    });
  };

  // Take only the 5 most recent notifications (sorted by timestamp descending)
  const latestNotifications = [...notifications]
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, 5);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <span className="relative inline-flex">
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-2 w-2 rounded-full bg-red-500" />
            )}
          </span>
          <span className="sr-only">{t("notifications.title")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>{t("notifications.title")}</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto py-1 px-2 text-xs"
              onClick={() => markAllAsRead()}
            >
              <Check className="h-3 w-3 mr-1" />
              {t("notifications.markAllRead")}
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <ScrollArea className="h-[300px]">
          {latestNotifications.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {t("notifications.noNotifications")}
            </div>
          ) : (
            latestNotifications.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className="flex items-start gap-3 p-3 cursor-pointer"
                onClick={() => {
                  markAsRead(notification.id);
                  router.push(`/notifications?notificationId=${notification.id}`);
                }}
              >
                <div className="mt-0.5">
                  {notificationIcons[notification.type] || <Info className="h-4 w-4" />}
                </div>
                <div className="flex-1 space-y-1">
                  <p
                    className={`text-sm leading-tight ${
                      !notification.isRead ? "font-medium" : ""
                    }`}
                  >
                    {notification.title}
                  </p>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {notification.description}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(notification.timestamp)}
                  </p>
                </div>
                {!notification.isRead && (
                  <div className="w-2 h-2 rounded-full bg-primary mt-1" />
                )}
              </DropdownMenuItem>
            ))
          )}
        </ScrollArea>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => router.push("/notifications")}
          className="text-center justify-center cursor-pointer"
        >
          {language === "fr" ? "Voir toutes les notifications" : "View all notifications"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
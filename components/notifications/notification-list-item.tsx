"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Notification } from "@/lib/api/types";
import { formatDistanceToNow } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface NotificationListItemProps {
  notification: Notification;
  isSelected: boolean;
  onClick: (notification: Notification) => void;
  language: string;
}

const getInitials = (text: string) => {
  return text
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

export function NotificationListItem({
  notification,
  isSelected,
  onClick,
  language,
}: NotificationListItemProps) {
  const timeAgo = formatDistanceToNow(new Date(notification.createdAt), {
    addSuffix: false,
    locale: language === "fr" ? fr : enUS,
  });

  const initials = getInitials(notification.title);

  return (
    <div
      onClick={() => onClick(notification)}
      className={cn(
        "flex gap-3 p-2.5 cursor-pointer transition-all border-l-2",
        "hover:bg-muted/60 active:bg-muted/80",
        isSelected
          ? "bg-muted/80 border-l-primary"
          : "border-l-transparent hover:border-l-muted"
      )}
    >
      <Avatar className="h-10 w-10 shrink-0">
        <AvatarFallback className="text-xs font-semibold bg-gradient-to-br from-primary to-primary/70 text-white">
          {initials}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0 gap-1">
        <div className="flex items-baseline justify-between gap-2">
          <p
            className={cn(
              "text-sm truncate",
              !notification.isRead
                ? "font-semibold text-foreground"
                : "text-foreground/80"
            )}
          >
            {notification.title}
          </p>
          <span className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">
            {timeAgo}
          </span>
        </div>
        <p className="text-xs text-muted-foreground truncate line-clamp-1">
          {notification.message}
        </p>
      </div>

      {!notification.isRead && (
        <div className="w-2 h-2 rounded-full bg-primary shrink-0 self-center" />
      )}
    </div>
  );
}
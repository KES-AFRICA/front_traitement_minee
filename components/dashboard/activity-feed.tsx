"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ActivityItem } from "@/lib/api/services/treatment-service";
import { useI18n } from "@/lib/i18n/context";
import { formatDistanceToNow } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import { CheckCircle, XCircle, PlusCircle, UserPlus, Activity, RefreshCw, Clock, AlertCircle } from "lucide-react";

interface ActivityFeedProps {
  activities: ActivityItem[];
  isLoading?: boolean;
}

// Mapping des types d'activité vers des icônes
const getActivityIcon = (type: ActivityItem["type"]) => {
  switch (type) {
    case "validate":
      return <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />;
    case "reject":
      return <XCircle className="h-3.5 w-3.5 text-red-500" />;
    case "complete":
      return <CheckCircle className="h-3.5 w-3.5 text-blue-500" />;
    case "start":
      return <Clock className="h-3.5 w-3.5 text-amber-500" />;
    case "collect":
      return <RefreshCw className="h-3.5 w-3.5 text-purple-500" />;
    case "update":
      return <AlertCircle className="h-3.5 w-3.5 text-gray-500" />;
    default:
      return <Activity className="h-3.5 w-3.5 text-gray-500" />;
  }
};

const getActivityBadgeVariant = (type: ActivityItem["type"]): "default" | "secondary" | "destructive" | "outline" => {
  switch (type) {
    case "validate":
      return "default";
    case "reject":
      return "destructive";
    case "complete":
      return "secondary";
    case "start":
      return "outline";
    case "collect":
      return "outline";
    default:
      return "outline";
  }
};

const getActivityLabel = (type: ActivityItem["type"]): string => {
  switch (type) {
    case "validate":
      return "Validé";
    case "reject":
      return "Rejeté";
    case "complete":
      return "Complété";
    case "start":
      return "Début";
    case "collect":
      return "Collecte";
    case "update":
      return "Modification";
    default:
      return "Activité";
  }
};

export function ActivityFeed({ activities, isLoading }: ActivityFeedProps) {
  const { t, language } = useI18n();

  const formatDate = (dateString: string) =>
    formatDistanceToNow(new Date(dateString), {
      addSuffix: true,
      locale: language === "fr" ? fr : enUS,
    });

  const getInitials = (name?: string) => {
    if (!name) return "?";
    const parts = name.split(" ");
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
  };

  const header = (
    <CardHeader className="px-4 pt-4 pb-2 sm:px-6 sm:pt-6">
      <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
        <Activity className="h-4 w-4" />
        Activités récentes
      </CardTitle>
    </CardHeader>
  );

  if (isLoading) {
    return (
      <Card>
        {header}
        <CardContent className="px-4 pb-4 sm:px-6">
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-start gap-2.5 animate-pulse">
                <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-800 shrink-0" />
                <div className="flex-1 space-y-1.5 min-w-0">
                  <div className="h-3.5 bg-gray-200 dark:bg-gray-800 rounded w-3/4" />
                  <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-1/4" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!activities || activities.length === 0) {
    return (
      <Card>
        {header}
        <CardContent className="px-4 pb-4 sm:px-6">
          <div className="h-70 flex items-center justify-center text-gray-500 dark:text-gray-400 text-sm sm:h-87.5">
            Aucune activité pour cette période
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      {header}
      <CardContent className="p-0">
        <ScrollArea className="h-70 sm:h-87.5">
          <div className="space-y-1 px-4 pb-4 sm:px-6">
            {activities.map((activity) => (
              <div
                key={activity.id}
                className="flex items-start gap-2.5 p-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors sm:gap-3 sm:p-3"
              >
                {/* Avatar ou icône */}
                {activity.user ? (
                  <Avatar className="h-7 w-7 shrink-0 sm:h-8 sm:w-8">
                    <AvatarFallback className="text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-400">
                      {getInitials(activity.user.name)}
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <div className="flex items-center justify-center h-7 w-7 rounded-full bg-gray-100 dark:bg-gray-800 shrink-0 sm:h-8 sm:w-8">
                    {getActivityIcon(activity.type)}
                  </div>
                )}

                {/* Contenu */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-xs font-medium truncate text-gray-900 dark:text-gray-100 sm:text-sm">
                      {activity.user?.name || "Système"}
                    </p>
                    <Badge
                      variant={getActivityBadgeVariant(activity.type)}
                      className="text-[9px] h-4 px-1.5 sm:text-[10px] sm:h-5"
                    >
                      {getActivityLabel(activity.type)}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-gray-600 dark:text-gray-400 truncate sm:text-sm">
                    {activity.message}
                  </p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-500 mt-0.5 sm:text-xs sm:mt-1">
                    {formatDate(activity.timestamp)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
// components/dashboard/activity-feed.tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ActivityItem } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n/context";
import { formatDistanceToNow } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import {
  CheckCircle,
  XCircle,
  PlusCircle,
  UserPlus,
  Activity,
} from "lucide-react";

interface ActivityFeedProps {
  activities: ActivityItem[];
  isLoading?: boolean;
}

const activityIcons: Record<ActivityItem["type"], React.ReactNode> = {
  task_created: <PlusCircle className="h-4 w-4 text-info" />,
  task_completed: <CheckCircle className="h-4 w-4 text-success" />,
  task_validated: <CheckCircle className="h-4 w-4 text-primary" />,
  task_rejected: <XCircle className="h-4 w-4 text-destructive" />,
  user_created: <UserPlus className="h-4 w-4 text-muted-foreground" />,
};

const activityBadgeVariants: Record<ActivityItem["type"], "default" | "secondary" | "destructive" | "outline"> = {
  task_created: "outline",
  task_completed: "secondary",
  task_validated: "default",
  task_rejected: "destructive",
  user_created: "outline",
};

const activityLabels: Record<ActivityItem["type"], string> = {
  task_created: "Création",
  task_completed: "Complété",
  task_validated: "Validé",
  task_rejected: "Rejeté",
  user_created: "Utilisateur",
};

export function ActivityFeed({ activities, isLoading }: ActivityFeedProps) {
  const { t, language } = useI18n();

  const formatDate = (dateString: string) => {
    return formatDistanceToNow(new Date(dateString), {
      addSuffix: true,
      locale: language === "fr" ? fr : enUS,
    });
  };

  const getInitials = (firstName?: string, lastName?: string) => {
    return `${firstName?.charAt(0) || ""}${lastName?.charAt(0) || ""}`.toUpperCase();
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Activités récentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-start gap-3 animate-pulse">
                <div className="w-8 h-8 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/4" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (activities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Activités récentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[350px] flex items-center justify-center text-muted-foreground">
            Aucune activité pour cette période
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Activités récentes
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[350px] px-6">
          <div className="space-y-4 pb-4">
            {activities.map((activity) => (
              <div
                key={activity.id}
                className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
              >
                {activity.user ? (
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs bg-primary/10 text-primary">
                      {getInitials(activity.user.firstName, activity.user.lastName)}
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <div className="flex items-center justify-center h-8 w-8 rounded-full bg-muted">
                    {activityIcons[activity.type]}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium truncate">
                      {activity.user
                        ? `${activity.user.firstName} ${activity.user.lastName}`
                        : "Système"}
                    </p>
                    <Badge variant={activityBadgeVariants[activity.type]} className="text-[10px] h-5">
                      {activityLabels[activity.type]}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {activity.description}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
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
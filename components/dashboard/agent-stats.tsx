// components/dashboard/agent-stats.tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AgentStats as AgentStatsType } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n/context";
import { Users } from "lucide-react";

interface AgentStatsProps {
  stats: AgentStatsType[];
  isLoading?: boolean;
}

export function AgentStats({ stats, isLoading }: AgentStatsProps) {
  const { t } = useI18n();

  const getInitials = (firstName?: string, lastName?: string) => {
    return `${firstName?.charAt(0) || ""}${lastName?.charAt(0) || ""}`.toUpperCase();
  };

  const getEfficiencyColor = (efficiency: number) => {
    if (efficiency >= 90) return "text-success";
    if (efficiency >= 70) return "text-warning-foreground";
    return "text-destructive";
  };

  const getOccupancyVariant = (rate: number): "default" | "secondary" | "destructive" | "outline" => {
    if (rate >= 90) return "destructive";
    if (rate >= 70) return "default";
    return "secondary";
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Performance des agents
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 animate-pulse">
                <div className="w-10 h-10 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-1/2" />
                  <div className="h-2 bg-muted rounded w-full" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (stats.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Performance des agents
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[350px] flex items-center justify-center text-muted-foreground">
            Aucune donnée pour cette période
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Performance des agents
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[350px] px-6">
          <div className="space-y-4 pb-4">
            {stats.map((agent) => (
              <div
                key={agent.userId}
                className="p-4 rounded-lg border border-border hover:border-primary/30 transition-colors"
              >
                <div className="flex items-center gap-3 mb-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary/10 text-primary text-sm">
                      {getInitials(agent.user.firstName, agent.user.lastName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {agent.user.firstName} {agent.user.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {agent.user.role === "processing_agent" ? "Agent de traitement" : 
                       agent.user.role === "validation_agent" ? "Agent de validation" :
                       agent.user.role === "team_lead" ? "Chef d'équipe" : "Admin"}
                    </p>
                  </div>
                  <Badge variant={getOccupancyVariant(agent.occupancyRate)}>
                    {agent.occupancyRate}%
                  </Badge>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Tâches complétées
                    </span>
                    <span className="font-medium">
                      {agent.tasksCompleted}/{agent.tasksAssigned}
                    </span>
                  </div>
                  <Progress
                    value={(agent.tasksCompleted / Math.max(agent.tasksAssigned, 1)) * 100}
                    className="h-2"
                  />
                </div>

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
                  <div className="text-xs text-muted-foreground">
                    Efficacité:{" "}
                    <span className={`font-medium ${getEfficiencyColor(agent.efficiency)}`}>
                      {agent.efficiency}%
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Temps moyen:{" "}
                    <span className="font-medium">{agent.avgProcessingTime}h</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
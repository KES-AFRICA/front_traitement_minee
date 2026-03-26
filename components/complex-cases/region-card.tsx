"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ChevronRight, MapPin } from "lucide-react";
import { ComplexCaseStats } from "@/lib/api/eneo-data";

interface RegionCardProps {
  code: string;
  name: string;
  fullName: string;
  stats: ComplexCaseStats;
  zonesCount: number;
  onClick: () => void;
}

export function RegionCard({ code, name, fullName, stats, zonesCount, onClick }: RegionCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={onClick}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <MapPin className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">{code}</CardTitle>
              <p className="text-xs text-muted-foreground">{fullName}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon">
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 rounded-lg bg-muted/50">
            <div className="text-xl font-bold">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Total</div>
          </div>
          <div className="p-2 rounded-lg bg-orange-50 dark:bg-orange-950/30">
            <div className="text-xl font-bold text-orange-600">{stats.pending + stats.inProgress}</div>
            <div className="text-xs text-muted-foreground">En attente</div>
          </div>
          <div className="p-2 rounded-lg bg-green-50 dark:bg-green-950/30">
            <div className="text-xl font-bold text-green-600">{stats.completed}</div>
            <div className="text-xs text-muted-foreground">Completes</div>
          </div>
        </div>

        {/* Progress */}
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Progression</span>
            <span className="font-medium">{stats.completionRate}%</span>
          </div>
          <Progress value={stats.completionRate} className="h-2" />
        </div>

        {/* Zones count */}
        <div className="text-xs text-muted-foreground text-center pt-2 border-t">
          {zonesCount} zone(s) disponible(s)
        </div>
      </CardContent>
    </Card>
  );
}
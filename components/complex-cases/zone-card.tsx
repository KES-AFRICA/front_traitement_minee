"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ChevronRight, Layers } from "lucide-react";
import { ComplexCaseStats } from "@/lib/api/eneo-data";

interface ZoneCardProps {
  code: string;
  name: string;
  stats: ComplexCaseStats;
  departuresCount: number;
  onClick: () => void;
}

export function ZoneCard({ code, name, stats, departuresCount, onClick }: ZoneCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={onClick}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-950/50 flex items-center justify-center">
              <Layers className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-base">{name}</CardTitle>
              <p className="text-xs text-muted-foreground">{code}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Mini Stats */}
        <div className="flex justify-between text-sm">
          <div>
            <span className="text-muted-foreground">Total: </span>
            <span className="font-medium">{stats.total}</span>
          </div>
          <div>
            <span className="text-muted-foreground">En attente: </span>
            <span className="font-medium text-orange-600">{stats.pending + stats.inProgress}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Fait: </span>
            <span className="font-medium text-green-600">{stats.completed}</span>
          </div>
        </div>

        {/* Progress */}
        <div className="space-y-1">
          <Progress value={stats.completionRate} className="h-1.5" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{departuresCount} depart(s)</span>
            <span>{stats.completionRate}%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
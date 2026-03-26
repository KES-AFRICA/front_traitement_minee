"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ChevronRight, Zap } from "lucide-react";

interface DepartureCardProps {
  code: string;
  name: string;
  equipmentCount: number;
  completedCount: number;
  pendingCount: number;
  onClick: () => void;
}

export function DepartureCard({ code, name, equipmentCount, completedCount, pendingCount, onClick }: DepartureCardProps) {
  const completionRate = equipmentCount > 0 ? Math.round((completedCount / equipmentCount) * 100) : 0;

  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={onClick}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-amber-100 dark:bg-amber-950/50 flex items-center justify-center">
              <Zap className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <CardTitle className="text-base">{code}</CardTitle>
              <p className="text-xs text-muted-foreground">{name}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 text-center text-sm">
          <div>
            <div className="font-bold">{equipmentCount}</div>
            <div className="text-xs text-muted-foreground">Equipements</div>
          </div>
          <div>
            <div className="font-bold text-orange-600">{pendingCount}</div>
            <div className="text-xs text-muted-foreground">En attente</div>
          </div>
          <div>
            <div className="font-bold text-green-600">{completedCount}</div>
            <div className="text-xs text-muted-foreground">Traites</div>
          </div>
        </div>

        {/* Progress */}
        <div className="space-y-1">
          <Progress value={completionRate} className="h-1.5" />
          <div className="text-xs text-muted-foreground text-right">{completionRate}% complete</div>
        </div>
      </CardContent>
    </Card>
  );
}
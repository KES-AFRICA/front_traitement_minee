"use client";

import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, Clock, CheckCircle, BarChart3 } from "lucide-react";

interface GlobalStatsCardsProps {
  total: number;
  pendingAndInProgress: number;
  completed: number;
  completionRate: number;
}

export function GlobalStatsCards({ total, pendingAndInProgress, completed, completionRate }: GlobalStatsCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total</p>
              <p className="text-3xl font-bold">{total}</p>
              <p className="text-xs text-muted-foreground mt-1">cas identifies</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <BarChart3 className="h-6 w-6 text-primary" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">En attente / En cours</p>
              <p className="text-3xl font-bold text-orange-600">{pendingAndInProgress}</p>
              <p className="text-xs text-muted-foreground mt-1">a traiter</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-orange-100 dark:bg-orange-950/50 flex items-center justify-center">
              <Clock className="h-6 w-6 text-orange-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Completes</p>
              <p className="text-3xl font-bold text-green-600">{completed}</p>
              <p className="text-xs text-muted-foreground mt-1">traites avec succes</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-950/50 flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Taux de completion</p>
              <p className="text-3xl font-bold text-blue-600">{completionRate}%</p>
              <p className="text-xs text-muted-foreground mt-1">progression globale</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-950/50 flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
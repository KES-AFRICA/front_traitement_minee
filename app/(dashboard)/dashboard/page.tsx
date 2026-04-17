"use client";

import { useAuth } from "@/lib/auth/context";
import { useI18n } from "@/lib/i18n/context";
import { StatCard } from "@/components/dashboard/stat-card";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { WeeklyChart } from "@/components/dashboard/weekly-chart";
import { AgentStats } from "@/components/dashboard/agent-stats";
import { TaskDistribution } from "@/components/dashboard/task-distribution";
import { DateFilter } from "@/components/dashboard/date-filter";
import { useDateFilter, DateRangeType, DateRange } from "@/hooks/use-date-filter";
import { useAllDashboardData, useManualRefresh } from "@/hooks/use-treatment-service";
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Loader2,
  XCircle,
  RefreshCw,
  FileCheck,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMemo } from "react";
import { isWithinInterval } from "date-fns";

export default function DashboardPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  
  const {
    dateRangeType,
    dateRange,
    setDateRangeType,
    setCustomRange,
    formatDateRange,
  } = useDateFilter();

  // Récupérer TOUTES les données (sans filtres backend)
  const { 
    data: dashboardData, 
    isLoading, 
    isFetching,
  } = useAllDashboardData();

  const { manualRefresh, isRefreshing } = useManualRefresh();

  // Fonction de refresh manuel
  const handleRefresh = async () => {
    await manualRefresh({ force: true });
  };

  // Indicateur de chargement
  const isDataLoading = isLoading || isFetching || isRefreshing;

  // Extraire les données brutes du dashboard
  const rawStats = dashboardData?.stats;
  const rawWeeklyTrend = dashboardData?.weeklyTrend || [];
  const rawActivities = dashboardData?.recentActivity || [];
  const rawAgentStats = dashboardData?.agentStats || [];
  const taskDistribution = dashboardData?.taskDistribution || [];

  // Fonction de filtrage générique pour les items avec timestamp
  const filterByDateRange = <T extends { timestamp?: string; date?: string; createdAt?: string }>(
    items: T[]
  ): T[] => {
    return items.filter(item => {
      const dateString = item.timestamp || item.date || item.createdAt;
      if (!dateString) return true;
      
      const itemDate = new Date(dateString);
      return isWithinInterval(itemDate, {
        start: dateRange.start,
        end: dateRange.end,
      });
    });
  };

  // APPLIQUER LES FILTRES FRONTEND
  const filteredWeeklyTrend = useMemo(() => 
    filterByDateRange(rawWeeklyTrend), 
    [rawWeeklyTrend, dateRange]
  );

  const filteredActivities = useMemo(() => 
    filterByDateRange(rawActivities), 
    [rawActivities, dateRange]
  );

  const filteredAgentStats = rawAgentStats;
  const stats = rawStats;

  // Calcul des totaux pour les pourcentages
  const totalCollecting = stats?.collecting || 0;
  const totalPendingValidation = stats?.pendingValidation || 0;
  const totalValidated = stats?.validated || 0;
  const totalRejected = stats?.rejected || 0;
  const totalTasks = stats?.totalTasks || 0;

  return (
    <div className="w-full min-w-0 space-y-4 md:px-4 md:py-4 sm:px-6 sm:space-y-6">

      {/* ── Header avec bouton refresh ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl truncate">
            Bonjour, {user?.firstName}
          </h1>
        </div>
        
        {/* Groupe DateFilter + Refresh */}
        <div className="flex gap-2 w-full sm:w-auto shrink-0">
          <div className="flex-1 sm:flex-none hidden">
            <DateFilter
              dateRangeType={dateRangeType}
              dateRange={dateRange}
              onRangeTypeChange={(type: DateRangeType) => setDateRangeType(type)}
              onCustomRangeChange={(range: DateRange) => setCustomRange(range)}
            />
          </div>
          <Button
            variant="outline"
            size="default"
            onClick={handleRefresh}
            disabled={isDataLoading}
            className="shrink-0 gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isDataLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Actualiser</span>
          </Button>
        </div>
      </div>

      {/* ── Stat cards — statuts ──
          Mobile  : 2 colonnes
          md      : 3 colonnes
          xl      : 5 colonnes
      */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5 sm:gap-4">
        <StatCard
          title="En collecte"
          value={isDataLoading ? "-" : totalCollecting.toLocaleString() || "0"}
          description="Collecte en cours"
          icon={Clock}
          variant="default"
          total={totalTasks}
        />
        <StatCard
          title="En traitement"
          value={isDataLoading ? "-" : stats?.inProgress?.toLocaleString() || "0"}
          description="En attente traitement"
          icon={Loader2}
          variant="warning"
          total={totalTasks}
        />
        <StatCard
          className="col-span-2 md:col-span-1"
          title="En attente validation"
          value={isDataLoading ? "-" : totalPendingValidation.toLocaleString() || "0"}
          description="Traités - à valider"
          icon={FileCheck}
          variant="primary"
          total={totalTasks}
        />
        <StatCard
          title="Validés"
          value={isDataLoading ? "-" : totalValidated.toLocaleString() || "0"}
          description="Validés"
          icon={CheckCircle2}
          variant="success"
          total={totalValidated + totalRejected}
        />
        <StatCard
          title="Rejetés"
          value={isDataLoading ? "-" : totalRejected.toLocaleString() || "0"}
          description="Rejetés"
          icon={XCircle}
          variant="destructive"
          total={totalValidated + totalRejected}
        />
      </div>

      {/* ── Taux ── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <StatCard
          title="Taux de traitement"
          value={isDataLoading ? "-" : `${stats?.processingRate?.toFixed(1) || 0}%`}
          description="(Traités / Total)"
          icon={TrendingUp}
          variant="default"
        />
        <StatCard
          title="Taux de validation"
          value={isDataLoading ? "-" : `${stats?.validationRate?.toFixed(1) || 0}%`}
          description="(Validés / Traités)"
          icon={CheckCircle2}
          variant="default"
        />
        <StatCard
          title="Temps moyen"
          value={isDataLoading ? "-" : `${stats?.avgProcessingTime || 0}h`}
          description="Temps de traitement moyen"
          icon={AlertCircle}
          variant="default"
        />
      </div>

      {/* ── Charts ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
        {isDataLoading ? (
          <>
            <Skeleton className="h-[400px] w-full rounded-xl" />
            <Skeleton className="h-[400px] w-full rounded-xl" />
          </>
        ) : (
          <>
            <WeeklyChart data={filteredWeeklyTrend} isLoading={isDataLoading} />
            {taskDistribution && taskDistribution.length > 0 && (
              <TaskDistribution data={taskDistribution} isLoading={isDataLoading} />
            )}
          </>
        )}
      </div>

      {/* ── Agents & Activités ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
        {isDataLoading ? (
          <>
            <Skeleton className="h-[500px] w-full rounded-xl" />
            <Skeleton className="h-[500px] w-full rounded-xl" />
          </>
        ) : (
          <>
            <AgentStats stats={filteredAgentStats} isLoading={isDataLoading} />
            <ActivityFeed activities={filteredActivities} isLoading={isDataLoading} />
          </>
        )}
      </div>
    </div>
  );
}
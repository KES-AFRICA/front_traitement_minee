// app/dashboard/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/context";
import { useI18n } from "@/lib/i18n/context";
import { StatCard } from "@/components/dashboard/stat-card";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { WeeklyChart } from "@/components/dashboard/weekly-chart";
import { AgentStats } from "@/components/dashboard/agent-stats";
import { TaskDistribution } from "@/components/dashboard/task-distribution";
import { DateFilter } from "@/components/dashboard/date-filter";
import { useDateFilter, DateRangeType, DateRange } from "@/hooks/use-date-filter";
import { taskService } from "@/lib/api/services/tasks";
import { userService } from "@/lib/api/services/users";
import {
  DashboardStats,
  WeeklyTrend,
  ActivityItem,
  AgentStats as AgentStatsType,
} from "@/lib/api/types";
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Loader2,
  XCircle,
} from "lucide-react";

export default function DashboardPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [weeklyTrend, setWeeklyTrend] = useState<WeeklyTrend[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [agentStats, setAgentStats] = useState<AgentStatsType[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const {
    dateRangeType,
    dateRange,
    setDateRangeType,
    setCustomRange,
    formatDateRange,
  } = useDateFilter();

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [statsRes, trendRes, activityRes, agentRes] = await Promise.all([
        taskService.getDashboardStats(dateRange.start, dateRange.end),
        taskService.getWeeklyTrend(dateRange.start, dateRange.end),
        taskService.getRecentActivity(10, dateRange.start, dateRange.end),
        userService.getAgentStats(dateRange.start, dateRange.end),
      ]);

      if (statsRes.data) setStats(statsRes.data);
      if (trendRes.data) setWeeklyTrend(trendRes.data);
      if (activityRes.data) setActivities(activityRes.data);
      if (agentRes.data) setAgentStats(agentRes.data);
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [dateRange]);

  const handleRangeTypeChange = (type: DateRangeType) => {
    setDateRangeType(type);
  };

  const handleCustomRangeChange = (range: DateRange) => {
    setCustomRange(range);
  };

  const totalProcessed = stats?.totalTasks || 0;
  const totalCompleted = stats?.completed || 0;

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Bonjour, {user?.firstName}
            </h1>
            <p className="text-muted-foreground">
              Tableau de bord - {formatDateRange()}
            </p>
          </div>
          <DateFilter
            dateRangeType={dateRangeType}
            dateRange={dateRange}
            onRangeTypeChange={handleRangeTypeChange}
            onCustomRangeChange={handleCustomRangeChange}
          />
        </div>
      </div>

      {/* Stats Grid - Status de traitement */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        <StatCard
          title="En attente"
          value={isLoading ? "-" : stats?.pending.toLocaleString() || "0"}
          description="En attente de traitement"
          icon={Clock}
          variant="default"
          total={totalProcessed}
        />
        <StatCard
          title="En cours"
          value={isLoading ? "-" : stats?.inProgress.toLocaleString() || "0"}
          description="En cours de traitement"
          icon={Loader2}
          variant="warning"
          total={totalProcessed}
        />
        <StatCard
          title="Traités"
          value={isLoading ? "-" : stats?.completed.toLocaleString() || "0"}
          description="Traitement terminé"
          icon={CheckCircle2}
          variant="primary"
          total={totalProcessed}
        />
        <StatCard
          title="Validés"
          value={isLoading ? "-" : stats?.validated.toLocaleString() || "0"}
          description="Validation finale"
          icon={CheckCircle2}
          variant="success"
          total={totalCompleted}
        />
        <StatCard
          title="Rejetés"
          value={isLoading ? "-" : stats?.rejected.toLocaleString() || "0"}
          description="Rejeté"
          icon={XCircle}
          variant="destructive"
          total={totalCompleted}
        />
      </div>

      {/* Rate Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Taux de traitement"
          value={isLoading ? "-" : `${stats?.processingRate.toFixed(1) || 0}%`}
          icon={TrendingUp}
          variant="default"
        />
        <StatCard
          title="Taux de validation"
          value={isLoading ? "-" : `${stats?.validationRate.toFixed(1) || 0}%`}
          icon={CheckCircle2}
          variant="default"
        />
        <StatCard
          title="Temps moyen"
          value={isLoading ? "-" : `${stats?.avgProcessingTime || 0}h`}
          icon={AlertCircle}
          variant="default"
        />
      </div>

      {/* Charts and Activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        <WeeklyChart data={weeklyTrend} isLoading={isLoading} />
        {stats && <TaskDistribution stats={stats} isLoading={isLoading} />}
      </div>

      {/* Agent Stats and Activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        <AgentStats stats={agentStats} isLoading={isLoading} />
        <ActivityFeed activities={activities} isLoading={isLoading} />
      </div>
    </div>
  );
}
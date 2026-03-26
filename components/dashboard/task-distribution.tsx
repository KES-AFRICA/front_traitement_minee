// components/dashboard/task-distribution.tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { useI18n } from "@/lib/i18n/context";
import { DashboardStats } from "@/lib/api/types";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from "recharts";
import { PieChartIcon } from "lucide-react";

interface TaskDistributionProps {
  stats: DashboardStats;
  isLoading?: boolean;
}

export function TaskDistribution({ stats, isLoading }: TaskDistributionProps) {
  const { t } = useI18n();

  const data = [
    { name: "En attente", value: stats.pending, color: "var(--muted)" },
    { name: "En cours", value: stats.inProgress, color: "var(--color-warning)" },
    { name: "Traités", value: stats.completed - stats.validated, color: "var(--color-info)" },
    { name: "Validés", value: stats.validated, color: "var(--color-success)" },
    { name: "Rejetés", value: stats.rejected, color: "var(--color-destructive)" },
  ].filter(item => item.value > 0);

  const chartConfig = data.reduce((acc, item) => ({
    ...acc,
    [item.name]: { label: item.name, color: item.color },
  }), {});

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChartIcon className="h-5 w-5" />
            Aperçu de l'avancement
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] animate-pulse bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  if (stats.totalTasks === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChartIcon className="h-5 w-5" />
            Aperçu de l'avancement
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
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
          <PieChartIcon className="h-5 w-5" />
          Aperçu de l'avancement
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
                label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <ChartTooltip content={<ChartTooltipContent />} />
              <Legend
                verticalAlign="bottom"
                height={36}
                formatter={(value: string) => (
                  <span className="text-sm text-foreground">{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </ChartContainer>
        <div className="text-center mt-4">
          <p className="text-3xl font-bold">{stats.totalTasks.toLocaleString()}</p>
          <p className="text-sm text-muted-foreground">Total des tâches</p>
        </div>
      </CardContent>
    </Card>
  );
}
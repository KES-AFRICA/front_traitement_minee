// components/dashboard/weekly-chart.tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { useI18n } from "@/lib/i18n/context";
import { WeeklyTrend } from "@/lib/api/types";
import { format } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { TrendingUp } from "lucide-react";

interface WeeklyChartProps {
  data: WeeklyTrend[];
  isLoading?: boolean;
}

const chartConfig = {
  completed: {
    label: "Completed",
    color: "var(--color-chart-1)",
  },
  validated: {
    label: "Validated",
    color: "var(--color-chart-2)",
  },
  rejected: {
    label: "Rejected",
    color: "var(--color-destructive)",
  },
};

export function WeeklyChart({ data, isLoading }: WeeklyChartProps) {
  const { t, language } = useI18n();

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "EEE dd/MM", {
      locale: language === "fr" ? fr : enUS,
    });
  };

  const formattedData = data.map((item) => ({
    ...item,
    name: formatDate(item.date),
  }));

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            {t("dashboard.weeklyTrend")}
          </CardTitle>
          <CardDescription>Chargement...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] animate-pulse bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            {t("dashboard.weeklyTrend")}
          </CardTitle>
          <CardDescription>
            Aucune donnée pour la période sélectionnée
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            Aucune activité sur cette période
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalCompleted = data.reduce((acc, item) => acc + item.completed, 0);
  const totalValidated = data.reduce((acc, item) => acc + item.validated, 0);
  const validationRate = totalCompleted > 0 
    ? Math.round((totalValidated / totalCompleted) * 100) 
    : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          {t("dashboard.weeklyTrend")}
        </CardTitle>
        <CardDescription>
          Taux de validation: {validationRate}%
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={formattedData}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-chart-1)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorValidated" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-chart-2)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--color-chart-2)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                className="text-muted-foreground"
              />
              <YAxis
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                className="text-muted-foreground"
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area
                type="monotone"
                dataKey="completed"
                name="Traités"
                stroke="var(--color-chart-1)"
                strokeWidth={2}
                fill="url(#colorCompleted)"
              />
              <Area
                type="monotone"
                dataKey="validated"
                name="Validés"
                stroke="var(--color-chart-2)"
                strokeWidth={2}
                fill="url(#colorValidated)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
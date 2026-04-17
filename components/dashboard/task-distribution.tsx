// components/dashboard/task-distribution.tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/context";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { PieChartIcon } from "lucide-react";

export interface TaskDistributionItem {
  name: string;
  value: number;
  percentage: number;
  color: string;
}

interface TaskDistributionProps {
  data: TaskDistributionItem[];
  isLoading?: boolean;
}

// Tooltip personnalisé simple
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-gray-800 p-2 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {payload[0].name}
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Valeur: {payload[0].value}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-500">
          {payload[0].payload.percentage}%
        </p>
      </div>
    );
  }
  return null;
};

export function TaskDistribution({ data, isLoading }: TaskDistributionProps) {
  const { t } = useI18n();

  // Calculer le total
  const total = data.reduce((sum, item) => sum + item.value, 0);

  // Préparer les données pour le graphique
  const chartData = data.filter(item => item.value > 0);

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
          <div className="h-[300px] animate-pulse bg-gray-100 dark:bg-gray-800 rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0 || total === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChartIcon className="h-5 w-5" />
            Aperçu de l'avancement
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-gray-500 dark:text-gray-400">
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
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
                nameKey="name"
                label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="bottom"
                height={36}
                formatter={(value: string) => (
                  <span className="text-sm text-gray-900 dark:text-gray-100">{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="text-center mt-4">
          <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            {total.toLocaleString()}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Total des tâches</p>
        </div>
      </CardContent>
    </Card>
  );
}
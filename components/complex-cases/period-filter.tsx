"use client";

import { Button } from "@/components/ui/button";
import { Calendar } from "lucide-react";
import { useI18n } from "@/lib/i18n/context";

export type PeriodType = "today" | "week" | "month" | "custom";

interface PeriodFilterProps {
  value: PeriodType;
  onChange: (value: PeriodType) => void;
}

export function PeriodFilter({ value, onChange }: PeriodFilterProps) {
  const { t } = useI18n();

  const periods: { value: PeriodType; label: string }[] = [
    { value: "today", label: "Aujourd'hui" },
    { value: "week", label: "Semaine" },
    { value: "month", label: "Mois" },
    { value: "custom", label: "Personnalise" },
  ];

  return (
    <div className="flex items-center gap-2">
      <Calendar className="h-4 w-4 text-muted-foreground" />
      <div className="flex gap-1">
        {periods.map((period) => (
          <Button
            key={period.value}
            variant={value === period.value ? "default" : "outline"}
            size="sm"
            onClick={() => onChange(period.value)}
            className="text-xs"
          >
            {period.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
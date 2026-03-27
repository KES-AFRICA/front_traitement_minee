"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Clock } from "lucide-react";

export type TimePeriod = "24h" | "7d" | "30d";

interface PeriodFilterProps {
  selected: TimePeriod;
  onSelectPeriod: (period: TimePeriod) => void;
  language: string;
}

const periodLabels: Record<TimePeriod, { fr: string; en: string }> = {
  "24h": { fr: "Dernières 24h", en: "Last 24 hours" },
  "7d": { fr: "7 derniers jours", en: "Last 7 days" },
  "30d": { fr: "30 derniers jours", en: "Last 30 days" },
};

export function PeriodFilter({
  selected,
  onSelectPeriod,
  language,
}: PeriodFilterProps) {
  const label = periodLabels[selected][language === "fr" ? "fr" : "en"];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Clock className="h-4 w-4" />
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {(["24h", "7d", "30d"] as const).map((period) => (
          <DropdownMenuItem
            key={period}
            onClick={() => onSelectPeriod(period)}
            className={selected === period ? "bg-primary/10" : ""}
          >
            {periodLabels[period][language === "fr" ? "fr" : "en"]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
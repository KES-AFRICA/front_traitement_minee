// components/dashboard/date-filter.tsx
"use client";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarIcon, ChevronDown } from "lucide-react";
import { DateRangeType, DateRange, useDateFilter } from "@/hooks/use-date-filter";

interface DateFilterProps {
  dateRangeType: DateRangeType;
  dateRange: DateRange;
  onRangeTypeChange: (type: DateRangeType) => void;
  onCustomRangeChange: (range: DateRange) => void;
  className?: string;
}

const rangeOptions: { value: DateRangeType; label: string }[] = [
  { value: "today", label: "Aujourd'hui" },
  { value: "week", label: "Cette semaine" },
  { value: "month", label: "Ce mois" },
  { value: "custom", label: "Personnalisé" },
];

export function DateFilter({
  dateRangeType,
  dateRange,
  onRangeTypeChange,
  onCustomRangeChange,
  className,
}: DateFilterProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex items-center rounded-lg border border-border bg-background">
        {rangeOptions.map((option) => (
          <Button
            key={option.value}
            variant="ghost"
            size="sm"
            className={cn(
              "rounded-none first:rounded-l-lg last:rounded-r-lg px-4",
              dateRangeType === option.value && "bg-primary/10 text-primary"
            )}
            onClick={() => onRangeTypeChange(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>

      {dateRangeType === "custom" && (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <CalendarIcon className="h-4 w-4" />
              {format(dateRange.start, "dd/MM/yyyy", { locale: fr })} -{" "}
              {format(dateRange.end, "dd/MM/yyyy", { locale: fr })}
              <ChevronDown className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="range"
              selected={{
                from: dateRange.start,
                to: dateRange.end,
              }}
              onSelect={(range) => {
                if (range?.from && range?.to) {
                  onCustomRangeChange({
                    start: range.from,
                    end: range.to,
                  });
                }
              }}
              locale={fr}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
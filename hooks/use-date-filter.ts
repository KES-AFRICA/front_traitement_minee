// hooks/use-date-filter.ts
import { useState, useCallback, useMemo } from "react";
import { format, subDays, subWeeks, subMonths, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { fr } from "date-fns/locale";

export type DateRangeType = "today" | "week" | "month" | "custom";

export interface DateRange {
  start: Date;
  end: Date;
}

export interface UseDateFilterReturn {
  dateRangeType: DateRangeType;
  dateRange: DateRange;
  setDateRangeType: (type: DateRangeType) => void;
  setCustomRange: (range: DateRange) => void;
  formatDateRange: () => string;
  filterByDateRange: <T extends { createdAt?: string; timestamp?: string; date?: string }>(items: T[]) => T[];
}

export function useDateFilter(): UseDateFilterReturn {
  const [dateRangeType, setDateRangeType] = useState<DateRangeType>("week");
  const [customRange, setCustomRange] = useState<DateRange>({
    start: startOfDay(new Date()),
    end: endOfDay(new Date()),
  });

  const dateRange = useMemo(() => {
    const now = new Date();
    switch (dateRangeType) {
      case "today":
        return {
          start: startOfDay(now),
          end: endOfDay(now),
        };
      case "week":
        return {
          start: startOfWeek(now, { weekStartsOn: 1 }),
          end: endOfWeek(now, { weekStartsOn: 1 }),
        };
      case "month":
        return {
          start: startOfMonth(now),
          end: endOfMonth(now),
        };
      case "custom":
        return customRange;
      default:
        return {
          start: startOfDay(now),
          end: endOfDay(now),
        };
    }
  }, [dateRangeType, customRange]);

  const formatDateRange = useCallback(() => {
    if (dateRangeType === "today") return "Aujourd'hui";
    if (dateRangeType === "week") return "Cette semaine";
    if (dateRangeType === "month") return "Ce mois";
    if (dateRangeType === "custom") {
      return `${format(dateRange.start, "dd/MM/yyyy", { locale: fr })} - ${format(dateRange.end, "dd/MM/yyyy", { locale: fr })}`;
    }
    return "";
  }, [dateRangeType, dateRange]);

  const filterByDateRange = useCallback(<T extends { createdAt?: string; timestamp?: string; date?: string }>(items: T[]): T[] => {
    return items.filter(item => {
      const dateString = item.createdAt || item.timestamp || item.date;
      if (!dateString) return true;
      
      const itemDate = new Date(dateString);
      return isWithinInterval(itemDate, {
        start: dateRange.start,
        end: dateRange.end,
      });
    });
  }, [dateRange]);

  return {
    dateRangeType,
    dateRange,
    setDateRangeType,
    setCustomRange: (range: DateRange) => {
      setCustomRange(range);
      setDateRangeType("custom");
    },
    formatDateRange,
    filterByDateRange,
  };
}
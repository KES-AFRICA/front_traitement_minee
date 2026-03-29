"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { eneoRegions, EneoRegion, EneoZone, EneoDeparture } from "@/lib/api/eneo-data";
import { ChevronRight, Zap, Building2, DatabaseZap, CheckCircle2 } from "lucide-react";

interface DistributionTreeProps {
  mode: "processing" | "validation";
  onFeederSelect?: (feeder: EneoDeparture, region: EneoRegion, zone: EneoZone) => void;
  selectedFeederId?: string | number;
  /** IDs des feeders entièrement traités (fournis par le parent) */
  treatedFeederIds?: Set<string>;
}

function totalAnomalies(dep: EneoDeparture) {
  const c = dep.anomalyCounts;
  return c.duplicate + c.divergence + c.new + c.missing + c.complex;
}

function badgeColor(n: number) {
  if (n === 0) return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400";
  if (n < 5)  return "bg-amber-500/15 text-amber-600 dark:text-amber-400";
  return "bg-destructive/15 text-destructive";
}

export function DistributionTree({
  mode, onFeederSelect, selectedFeederId, treatedFeederIds = new Set(),
}: DistributionTreeProps) {
  const [openRegions, setOpenRegions] = useState<Set<string>>(new Set());
  const [openZones,   setOpenZones]   = useState<Set<string>>(new Set());

  // Ouvrir auto si feeder déjà sélectionné
  useEffect(() => {
    if (!selectedFeederId) return;
    for (const region of eneoRegions) {
      for (const zone of region.zones) {
        if (zone.departures.some((d) => String(d.feederId) === String(selectedFeederId))) {
          setOpenRegions((p) => new Set(p).add(region.id));
          setOpenZones((p)   => new Set(p).add(zone.id));
        }
      }
    }
  }, [selectedFeederId]);

  // Filtre selon le mode
  const visibleDepartures = (zone: EneoZone) => {
    if (mode === "processing") {
      // Traitement : feeders qui ont des anomalies ET pas encore 100% traités
      return zone.departures.filter(
        (d) => totalAnomalies(d) > 0 && !treatedFeederIds.has(String(d.feederId))
      );
    }
    // Validation : seulement les feeders marqués 100% traités
    return zone.departures.filter(
      (d) => totalAnomalies(d) > 0 && treatedFeederIds.has(String(d.feederId))
    );
  };

  const visibleZones   = (r: EneoRegion) => r.zones.filter((z) => visibleDepartures(z).length > 0);
  const visibleRegions = eneoRegions.filter((r) => visibleZones(r).length > 0);

  if (visibleRegions.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1.5 py-5 px-3 text-center">
        <DatabaseZap className="h-7 w-7 text-muted-foreground/30" />
        <p className="text-[11px] text-muted-foreground leading-snug">
          {mode === "processing"
            ? "Aucune anomalie détectée"
            : "Aucun départ prêt pour la validation"}
        </p>
      </div>
    );
  }

  const toggleRegion = (id: string) =>
    setOpenRegions((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleZone = (id: string) =>
    setOpenZones((p)   => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div className="w-full select-none space-y-0.5">
      {visibleRegions.map((region) => {
        const isRegionOpen = openRegions.has(region.id);
        const zones = visibleZones(region);

        return (
          <div key={region.id}>
            {/* Région */}
            <button onClick={() => toggleRegion(region.id)}
              className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-medium transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                isRegionOpen && "text-sidebar-primary")}>
              <ChevronRight className={cn("h-3 w-3 shrink-0 text-muted-foreground transition-transform duration-150", isRegionOpen && "rotate-90")} />
              <Building2 className="h-3.5 w-3.5 shrink-0 text-sidebar-primary" />
              <span className="truncate flex-1">{region.name}</span>
            </button>

            {isRegionOpen && (
              <div className="ml-3 border-l border-sidebar-border/50 pl-1 space-y-0.5">
                {zones.map((zone) => {
                  const isZoneOpen = openZones.has(zone.id);
                  const deps = visibleDepartures(zone);

                  return (
                    <div key={zone.id}>
                      {/* Zone / Exploitation */}
                      <button onClick={() => toggleZone(zone.id)}
                        className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                          isZoneOpen && "text-sidebar-accent-foreground")}>
                        <ChevronRight className={cn("h-3 w-3 shrink-0 text-muted-foreground transition-transform duration-150", isZoneOpen && "rotate-90")} />
                        <span className="truncate flex-1 text-muted-foreground">{zone.name}</span>
                        <span className="ml-auto shrink-0 rounded-full px-1.5 text-[10px] font-medium bg-sidebar-accent text-sidebar-accent-foreground">
                          {deps.length}
                        </span>
                      </button>

                      {isZoneOpen && (
                        <div className="ml-3 border-l border-sidebar-border/50 pl-1 pb-1 space-y-0.5">
                          {deps.map((dep) => {
                            const total   = totalAnomalies(dep);
                            const treated = treatedFeederIds.has(String(dep.feederId));
                            const isSelected = String(dep.feederId) === String(selectedFeederId);

                            return (
                              <button key={dep.id}
                                onClick={() => onFeederSelect?.(dep, region, zone)}
                                className={cn(
                                  "flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-[11px] transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                                  isSelected && "bg-sidebar-primary/10 text-sidebar-primary font-medium"
                                )}>
                                <Zap className={cn("h-3 w-3 shrink-0", isSelected ? "text-sidebar-primary" : "text-muted-foreground")} />
                                <span className="flex-1 truncate leading-tight">{dep.code}</span>

                                {mode === "processing" && total > 0 && (
                                  <span className={cn("shrink-0 rounded-full px-1.5 py-0 text-[9px] font-semibold", badgeColor(total))}>
                                    {total}
                                  </span>
                                )}
                                {mode === "validation" && treated && (
                                  <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-500" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
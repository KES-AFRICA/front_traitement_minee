// components/distribution/feeders-tree.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Zap, MapPin } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { useFeedersSource } from "@/hooks/useComparison";
import { FeederTreeGroup, FeederTreeSubstation, FeederTreeFeeder } from "@/lib/types/comparison";

interface FeedersTreeProps {
  mode: "processing" | "validation";
  selectedFeederId?: string | number;
}

export function FeedersTree({ mode, selectedFeederId }: FeedersTreeProps) {
  const router = useRouter();
  const { feeders, loading, error } = useFeedersSource();
  const [groupedData, setGroupedData] = useState<FeederTreeGroup[]>([]);
  const [openDecoupages, setOpenDecoupages] = useState<Record<string, boolean>>({});
  const [openSubstations, setOpenSubstations] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (feeders.length === 0) return;

    // Grouper par découpage puis par poste source
    const groups: Record<string, Record<string, FeederTreeSubstation>> = {};

    for (const feeder of feeders) {
      const decoupage = feeder.substation_source.decoupage || "Non défini";
      const substationId = feeder.substation_source.id || "unknown";
      const substationName = feeder.substation_source.name || "Poste inconnu";

      if (!groups[decoupage]) {
        groups[decoupage] = {};
      }
      if (!groups[decoupage][substationId]) {
        groups[decoupage][substationId] = {
          id: substationId,
          name: substationName,
          feeders: []
        };
      }
      groups[decoupage][substationId].feeders.push({
        feeder_id: feeder.feeder_id,
        feeder_name: feeder.feeder_name
      });
    }

    // Convertir en tableau
    const result: FeederTreeGroup[] = Object.entries(groups).map(([decoupage, substationsMap]) => ({
      decoupage,
      substations: Object.values(substationsMap)
    }));

    setGroupedData(result);

    // Auto-expand le découpage et la substation du feeder sélectionné
    if (selectedFeederId) {
      for (const group of result) {
        for (const substation of group.substations) {
          const hasSelected = substation.feeders.some(f => String(f.feeder_id) === String(selectedFeederId));
          if (hasSelected) {
            setOpenDecoupages(prev => ({ ...prev, [group.decoupage]: true }));
            setOpenSubstations(prev => ({ ...prev, [substation.id]: true }));
            break;
          }
        }
      }
    }
  }, [feeders, selectedFeederId]);

  const handleFeederClick = (feederId: string, feederName: string) => {
    router.push(`/distribution/${mode}/feeder/${feederId}?name=${encodeURIComponent(feederName)}`);
  };

  const toggleDecoupage = (decoupage: string) => {
    setOpenDecoupages(prev => ({ ...prev, [decoupage]: !prev[decoupage] }));
  };

  const toggleSubstation = (substationId: string) => {
    setOpenSubstations(prev => ({ ...prev, [substationId]: !prev[substationId] }));
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground p-2">Chargement...</div>;
  }

  if (error) {
    return <div className="text-sm text-red-500 p-2">Erreur: {error}</div>;
  }

  if (groupedData.length === 0) {
    return <div className="text-sm text-muted-foreground p-2">Aucun feeder trouvé</div>;
  }

  return (
    <div className="space-y-1">
      {groupedData.map((group) => (
        <Collapsible
          key={group.decoupage}
          open={openDecoupages[group.decoupage]}
          onOpenChange={() => toggleDecoupage(group.decoupage)}
          className="w-full"
        >
          <CollapsibleTrigger asChild>
            <button
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium",
                "hover:bg-sidebar-accent/40 transition-colors",
                openDecoupages[group.decoupage] && "bg-sidebar-accent/20"
              )}
            >
              <ChevronRight
                className={cn(
                  "h-3 w-3 shrink-0 transition-transform",
                  openDecoupages[group.decoupage] && "rotate-90"
                )}
              />
              <span className={cn(
                "px-1.5 py-0.5 rounded text-xs font-semibold",
                group.decoupage === "DRD" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-700"
              )}>
                {group.decoupage}
              </span>
              <span className="text-muted-foreground text-xs">
                ({group.substations.reduce((acc, s) => acc + s.feeders.length, 0)} feeders)
              </span>
            </button>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="ml-4 pl-2 border-l border-sidebar-border/50 space-y-1 mt-1">
              {group.substations.map((substation) => (
                <Collapsible
                  key={substation.id}
                  open={openSubstations[substation.id]}
                  onOpenChange={() => toggleSubstation(substation.id)}
                  className="w-full"
                >
                  <CollapsibleTrigger asChild>
                    <button
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-1 text-sm",
                        "hover:bg-sidebar-accent/30 transition-colors",
                        openSubstations[substation.id] && "bg-sidebar-accent/10"
                      )}
                    >
                      <ChevronRight
                        className={cn(
                          "h-3 w-3 shrink-0 transition-transform",
                          openSubstations[substation.id] && "rotate-90"
                        )}
                      />
                      <MapPin className="h-3 w-3 text-muted-foreground" />
                      <span className="text-sm truncate">{substation.name}</span>
                      <span className="text-xs text-muted-foreground">
                        ({substation.feeders.length})
                      </span>
                    </button>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <div className="ml-4 pl-2 border-l border-sidebar-border/50 space-y-0.5 mt-1">
                      {substation.feeders.map((feeder) => (
                        <button
                          key={feeder.feeder_id}
                          onClick={() => handleFeederClick(feeder.feeder_id, feeder.feeder_name)}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                            "hover:bg-sidebar-accent/40 transition-colors cursor-pointer",
                            String(selectedFeederId) === String(feeder.feeder_id) && "bg-blue-500/20 text-blue-600 font-medium"
                          )}
                        >
                          <Zap className="h-3 w-3 text-blue-500" />
                          <span className="truncate">{feeder.feeder_name}</span>
                        </button>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      ))}
    </div>
  );
}
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Zap, MapPin, User } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { useFeedersWithSource } from "@/hooks/use-treatment-service";
import { useAuth } from "@/lib/auth/context";
import { motion, AnimatePresence } from "framer-motion";

interface FeedersTreeProps {
  mode: "processing" | "validation";
  selectedFeederId?: string | number;
}

interface FeederTreeGroup {
  decoupage: string;
  substations: FeederTreeSubstation[];
}

interface FeederTreeSubstation {
  id: string;
  name: string;
  feeders: FeederTreeFeeder[];
}

interface FeederTreeFeeder {
  feeder_id: string;
  feeder_name: string;
  assigned_agent_id?: string | null;
  assigned_agent_name?: string | null;
  treatment_status?: string | null;
}

export function FeedersTree({ mode, selectedFeederId }: FeedersTreeProps) {
  const router = useRouter();
  const { user } = useAuth();
  
  // Pour Admin ou Chef équipe → tous les feeders
  // Pour Agent traitement ou Agent validation → uniquement ceux assignés
  const shouldFilterByAgent = user?.role !== 'Admin' && user?.role !== 'Chef équipe';
  const { data, isLoading, error } = useFeedersWithSource(shouldFilterByAgent);
  
  const [groupedData, setGroupedData] = useState<FeederTreeGroup[]>([]);
  const [openDecoupages, setOpenDecoupages] = useState<Record<string, boolean>>({});
  const [openSubstations, setOpenSubstations] = useState<Record<string, boolean>>({});

useEffect(() => {
  const allFeeders = data?.feeders || [];

  // Filtrage par status
  const feeders = allFeeders.filter((feeder: any) => {
    const status = feeder.treatment_status;

    if (mode === "processing") {
      return !["validated", "rejected", "pending_validation"].includes(status);
    }

    if (mode === "validation") {
      return ["validated", "pending_validation", "rejected"].includes(status);
    }

    return true;
  });

  if (feeders.length === 0) {
    setGroupedData([]);
    return;
  }

  const groups: Record<string, Record<string, FeederTreeSubstation>> = {};

  for (const feeder of feeders) {
    const decoupage = feeder.substation_source?.decoupage || "Non défini";
    const substationId = feeder.substation_source?.id || "unknown";
    const substationName = feeder.substation_source?.name || "Poste inconnu";

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
      feeder_name: feeder.feeder_name,
      assigned_agent_id: feeder.assigned_agent_id,
      assigned_agent_name: feeder.assigned_agent_name,
      treatment_status: feeder.treatment_status
    });
  }

const result: FeederTreeGroup[] = Object.entries(groups).map(
  ([decoupage, substationsMap]) => ({
    decoupage,
    substations: Object.values(substationsMap)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(substation => ({
        ...substation,
        feeders: substation.feeders.sort((a, b) => a.feeder_name.localeCompare(b.feeder_name))
      }))
  })
).sort((a, b) => a.decoupage.localeCompare(b.decoupage));

setGroupedData(result);

  // Auto-expand
  if (selectedFeederId) {
    for (const group of result) {
      for (const substation of group.substations) {
        const hasSelected = substation.feeders.some(
          f => String(f.feeder_id) === String(selectedFeederId)
        );
        if (hasSelected) {
          setOpenDecoupages(prev => ({ ...prev, [group.decoupage]: true }));
          setOpenSubstations(prev => ({ ...prev, [substation.id]: true }));
          break;
        }
      }
    }
  }
}, [data, selectedFeederId, mode]);

  const handleFeederClick = (feederId: string, feederName: string) => {
    router.push(`/distribution/${mode}/feeder/${feederId}?name=${encodeURIComponent(feederName)}`);
  };

  const toggleDecoupage = (decoupage: string) => {
    setOpenDecoupages(prev => ({ ...prev, [decoupage]: !prev[decoupage] }));
  };

  const toggleSubstation = (substationId: string) => {
    setOpenSubstations(prev => ({ ...prev, [substationId]: !prev[substationId] }));
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground p-2">Chargement...</div>;
  }

  if (error) {
    return <div className="text-sm text-red-500 p-2">Erreur: {error.message}</div>;
  }

  if (groupedData.length === 0) {
    return (
      <div className="text-sm text-muted-foreground p-2 text-center">
        <p>Aucun feeder trouvé</p>
        {shouldFilterByAgent && (
          <p className="text-xs mt-1">Vous n'êtes assigné à aucun feeder</p>
        )}
      </div>
    );
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

          <CollapsibleContent asChild>
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="overflow-hidden"
            >
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

                    <CollapsibleContent asChild>
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                        className="overflow-hidden"
                      >
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
                              <Zap className="h-3 w-3 text-blue-500 shrink-0" />
                              <span className="truncate flex-1 text-left">
                                {feeder.feeder_name?.slice(4)}
                              </span>
                              {feeder.assigned_agent_name && feeder.assigned_agent_id !== user?.id && user?.role !== 'Admin' && user?.role !== 'Chef équipe' ? null : feeder.assigned_agent_name && user?.role === 'Admin' && (
                                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                  <User className="h-2.5 w-2.5" />
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            </motion.div>
          </CollapsibleContent>
        </Collapsible>
      ))}
    </div>
  );
}
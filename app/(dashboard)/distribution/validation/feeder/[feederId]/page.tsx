"use client";

import { useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { getAnomaliesByFeeder, AnomalyCase } from "@/lib/api/eneo-data";
import {
  ShieldCheck, Zap, CheckCircle2, Building2, Cable,
  Layers, Box, ToggleLeft, Copy, GitCompare, FilePlus,
  FileX, AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

// ─── KPI Config (lecture seule) ───────────────────────────────────────────────
const KPI_CONFIG = [
  { type: "duplicate"  as const, label: "Doublons",    icon: Copy,        color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-500/10"  },
  { type: "divergence" as const, label: "Divergences", icon: GitCompare,  color: "text-amber-600 dark:text-amber-400",   bg: "bg-amber-500/10"   },
  { type: "new"        as const, label: "Nouveaux",    icon: FilePlus,    color: "text-emerald-600 dark:text-emerald-400",bg: "bg-emerald-500/10" },
  { type: "missing"   as const, label: "Manquants",   icon: FileX,       color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-500/10"  },
  { type: "complex"    as const, label: "Complexes",   icon: AlertCircle, color: "text-red-600 dark:text-red-400",       bg: "bg-red-500/10"     },
];

const TABLE_ICONS: Record<string, React.ElementType> = {
  substation: Building2, powertransformer: Zap, busbar: Layers,
  bay: Box, switch: ToggleLeft, wire: Cable, pole: Box, node: Box,
};
const TABLE_LABELS: Record<string, string> = {
  substation: "Substations", powertransformer: "Transformateurs", busbar: "Bus Bars",
  bay: "Bays", switch: "Switches", wire: "Wires", pole: "Poteaux", node: "Nœuds",
};

const FL: Record<string, string> = {
  name: "Nom", type: "Type", voltage: "Tension (kV)", active: "Actif",
  apparent_power: "Puissance (kVA)", phase: "Phase", regime: "Régime",
  localisation: "Localisation", section: "Section", nature_conducteur: "Conducteur",
  latitude: "Latitude", longitude: "Longitude", w1_voltage: "U prim.",
  w2_voltage: "U sec.", highest_voltage_level: "U max (kV)", exploitation: "Exploitation",
};
const fl = (k: string) => FL[k] || k;
const fv = (v: unknown) => { if (v === null || v === undefined) return "—"; if (typeof v === "boolean") return v ? "Oui" : "Non"; return String(v); };

// ─── Résumé d'une anomalie traitée ───────────────────────────────────────────
function AnomalySummary({ anomaly }: { anomaly: AnomalyCase }) {
  const rec2 = anomaly.layer2Record;
  const rec1 = anomaly.layer1Record;
  const display = rec2 ?? rec1;
  const Icon = TABLE_ICONS[anomaly.table] || Box;

  // Pour les divergences, on montre les valeurs finales (BD2 = terrain, corrigées)
  const keys = display
    ? Object.keys(display).filter((k) => !["m_rid", "created_date", "display_scada", "feeder_id"].includes(k)).slice(0, 8)
    : [];

  const kpiCfg = KPI_CONFIG.find((k) => k.type === anomaly.type)!;
  const KpiIcon = kpiCfg.icon;

  return (
    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <Icon className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
        <span className="text-xs font-medium truncate flex-1">
          {fv(display?.name ?? display?.m_rid)}
        </span>
        <span className="text-[10px] font-mono text-muted-foreground">{anomaly.mrid}</span>
        <span className={cn("inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded-full", kpiCfg.bg, kpiCfg.color)}>
          <KpiIcon className="h-2.5 w-2.5" />{kpiCfg.label}
        </span>
        <span className="inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-2.5 w-2.5" />Traité
        </span>
      </div>

      {/* Champs divergents résolus */}
      {anomaly.type === "divergence" && anomaly.divergentFields && (
        <div className="mt-2 space-y-1">
          <p className="text-[10px] text-muted-foreground font-medium mb-1">Champs corrigés :</p>
          {anomaly.divergentFields.map((f) => (
            <div key={f.field} className="flex gap-2 text-xs">
              <span className="text-muted-foreground shrink-0 w-24 truncate">{fl(f.field)}</span>
              <span className="font-mono line-through text-muted-foreground">{fv(f.layer1Value)}</span>
              <span className="text-muted-foreground">→</span>
              <span className="font-mono text-emerald-700 dark:text-emerald-300">{fv(f.layer2Value)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Données sommaires */}
      {anomaly.type !== "divergence" && display && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1 mt-1">
          {keys.map((k) => (
            <div key={k} className="text-xs">
              <p className="text-[9px] text-muted-foreground">{fl(k)}</p>
              <p className="font-mono truncate">{fv(display[k])}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function FeederValidationPage() {
  const params      = useParams();
  const searchParams = useSearchParams();
  const feederId    = params?.feederId as string;
  const feederName  = searchParams?.get("name") || feederId;

  /**
   * On récupère les mêmes anomalies que la page traitement.
   * Elles contiennent layer1Record (BD1) ET layer2Record (BD2).
   * Ici toutes sont supposées traitées (le feeder n'apparaît dans la validation
   * que quand tout est marqué traité côté state global).
   */
  const allAnomalies = useMemo(() => getAnomaliesByFeeder(feederId), [feederId]);

  const counts = useMemo(
    () => KPI_CONFIG.reduce((acc, cfg) => ({ ...acc, [cfg.type]: allAnomalies.filter((a) => a.type === cfg.type).length }), {} as Record<string, number>),
    [allAnomalies]
  );

  // Regrouper par table pour l'affichage
  const byTable = useMemo(() => {
    const map = new Map<string, AnomalyCase[]>();
    for (const a of allAnomalies) {
      if (!map.has(a.table)) map.set(a.table, []);
      map.get(a.table)!.push(a);
    }
    return map;
  }, [allAnomalies]);

  return (
    <div className="w-full min-w-0 space-y-4 px-4 py-4 sm:px-6">

      {/* En-tête */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-500 shrink-0" />
            <h1 className="text-lg font-bold truncate sm:text-xl">{feederName}</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Validation — {allAnomalies.length} anomalie{allAnomalies.length > 1 ? "s" : ""} traitée{allAnomalies.length > 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 w-fit shrink-0">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">100% traité</span>
        </div>
      </div>

      {/* KPIs récap (lecture seule) */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5 sm:gap-3">
        {KPI_CONFIG.map((cfg) => {
          const count = counts[cfg.type];
          const Icon  = cfg.icon;
          return (
            <div key={cfg.type} className="flex flex-col gap-2 p-3 rounded-xl border border-border bg-card opacity-80">
              <div className={cn("p-1.5 rounded-lg w-fit", cfg.bg)}>
                <Icon className={cn("h-3.5 w-3.5", cfg.color)} />
              </div>
              <div>
                <p className="text-2xl font-bold leading-none tabular-nums">{count}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{cfg.label}</p>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                <CheckCircle2 className="h-3 w-3" />Traité{count > 1 ? "s" : ""}
              </div>
            </div>
          );
        })}
      </div>

      {/* Résumé des anomalies traitées, groupées par table */}
      <div className="space-y-4">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Récapitulatif des anomalies traitées
        </h2>

        {Array.from(byTable.entries()).map(([table, anomalies]) => {
          const Icon = TABLE_ICONS[table] || Box;
          return (
            <Card key={table}>
              <CardHeader className="pb-2 px-4 pt-4">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Icon className="h-4 w-4 text-primary" />
                  {TABLE_LABELS[table] || table}
                  <span className="text-muted-foreground font-normal text-xs ml-1">
                    ({anomalies.length})
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-2">
                {anomalies.map((a) => (
                  <AnomalySummary key={a.id} anomaly={a} />
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Bouton validation finale */}
      <div className="sticky bottom-4 flex justify-end pb-2">
        <button
          onClick={() => toast.success("Validation finale envoyée pour " + feederName)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700 active:scale-95 transition-all shadow-lg"
        >
          <ShieldCheck className="h-4 w-4" />
          Valider définitivement ce départ
        </button>
      </div>
    </div>
  );
}
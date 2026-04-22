"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  AlertCircle, Database, GitBranch, BarChart3,
  Users, Zap, Power, Shield, Box, Cable,
  Building2, LayoutGrid, Activity, TrendingUp, RefreshCw,
} from "lucide-react";
import { api } from "@/lib/api/client";

// ─── Types ────────────────────────────────────────────────────────────────────
interface GlobalStats {
  equipes:     { collectes: number; attendus: number | null; taux: number | null };
  departs:     { collectes: number; attendus: number; taux: number };
  commerciaux: { collectes: number; attendus: number | null; taux: number | null };
}
interface DecoupageItem  { exploitation: string; collectes: number; attendus: number; taux: number }
interface EquipementItem { nom: string; collectes: number; attendus: number | null; taux: number | null }
interface ErreursStats   {
  manquants: Record<string, number>;
  nouveaux:  Record<string, number>;
  doublons:  Record<string, number>;
}

// ─── Cache helpers ────────────────────────────────────────────────────────────
const CACHE_TTL_MS  = 24 * 60 * 60 * 1000;
const CACHE_KEY     = "kobo_cache_collecte_dashboard";

interface CacheEntry<T> { data: T; expiresAt: number }

function cacheGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (Date.now() > entry.expiresAt) { localStorage.removeItem(key); return null; }
    return entry.data;
  } catch { return null; }
}

function cacheSet<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify({ data, expiresAt: Date.now() + CACHE_TTL_MS }));
  } catch { /* quota dépassé → ignore */ }
}

function cacheClear(key: string): void {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

// ─── Payload groupé pour le cache ────────────────────────────────────────────
interface DashboardPayload {
  globalStats: GlobalStats;
  decoupage:   DecoupageItem[];
  equipements: EquipementItem[];
  erreurs:     ErreursStats;
}

// ─── Colour helpers ───────────────────────────────────────────────────────────
type GaugeColors = { stroke: string; text: string };

function gaugeColor(pct: number | null): GaugeColors {
  if (pct === null) return { stroke: "rgba(255,255,255,0.3)", text: "rgba(255,255,255,0.5)" };
  if (pct <= 25)    return { stroke: "#E24B4A", text: "#F09595" };
  if (pct <= 50)    return { stroke: "#EF9F27", text: "#FAC775" };
  if (pct <= 75)    return { stroke: "#F2C84B", text: "#FAC775" };
  return              { stroke: "#1D9E75",   text: "#5DCAA5" };
}

function barColor(t: number): string {
  if (t >= 76) return "#1D9E75";
  if (t >= 51) return "#F2C84B";
  if (t >= 26) return "#EF9F27";
  return "#E24B4A";
}

// ─── Equipment icon map ───────────────────────────────────────────────────────
function EquipIcon({ nom, className = "", style }: { nom: string; className?: string; style?: React.CSSProperties }) {
  const map: Record<string, React.ElementType> = {
    "Poste source": Building2, H59: Building2, H61: Building2,
    "Jeu de barre": LayoutGrid, Cellules: Box,
    Transformateur: Power,     "Tableau BT": Shield,
    Wire: Cable,               Support: TrendingUp,
  };
  const Icon = map[nom] || Activity;
  return <Icon className={className} style={style} />;
}

// ─── Animated Speedometer Gauge (canvas) ─────────────────────────────────────
function SpeedometerGauge({ pct, size = 150 }: { pct: number | null; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width  = `${size}px`;
    canvas.style.height = `${size}px`;

    const ctx    = canvas.getContext("2d")!;
    const col    = gaugeColor(pct);
    const cx     = size / 2;
    const cy     = size / 2 + 8;
    const r      = size * 0.36;
    const sw     = size * 0.073;
    const startA = Math.PI * 0.75;
    const endA   = Math.PI * 2.25;
    const target = pct !== null ? Math.min(pct, 100) / 100 : 0;

    let progress = 0;

    function frame() {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, size, size);

      ctx.beginPath();
      ctx.arc(cx, cy, r, startA, endA);
      ctx.strokeStyle = "rgba(255,255,255,0.1)";
      ctx.lineWidth   = sw;
      ctx.lineCap     = "round";
      ctx.stroke();

      if (progress > 0) {
        const valA = startA + (endA - startA) * progress;
        ctx.beginPath();
        ctx.arc(cx, cy, r, startA, valA);
        ctx.strokeStyle = col.stroke;
        ctx.lineWidth   = sw;
        ctx.lineCap     = "round";
        ctx.stroke();
      }

      for (let i = 0; i <= 10; i++) {
        const a  = startA + (endA - startA) * (i / 10);
        const r1 = r - sw / 2 - 3;
        const r2 = r + sw / 2 + 3;
        ctx.beginPath();
        ctx.moveTo(cx + r1 * Math.cos(a), cy + r1 * Math.sin(a));
        ctx.lineTo(cx + r2 * Math.cos(a), cy + r2 * Math.sin(a));
        ctx.strokeStyle = i % 5 === 0 ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.12)";
        ctx.lineWidth   = i % 5 === 0 ? 2 : 0.8;
        ctx.lineCap     = "square";
        ctx.stroke();
      }

      const needleA = startA + (endA - startA) * progress;
      const nx = cx + r * Math.cos(needleA);
      const ny = cy + r * Math.sin(needleA);
      ctx.save();
      if (progress > 0) {
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(nx, ny);
        ctx.strokeStyle = col.stroke;
        ctx.lineWidth   = 2.5;
        ctx.lineCap     = "round";
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fillStyle = progress > 0 ? col.stroke : "rgba(255,255,255,0.3)";
      ctx.fill();
      ctx.restore();

      ctx.font         = `500 ${Math.round(size * 0.13)}px sans-serif`;
      ctx.fillStyle    = col.text;
      ctx.textAlign    = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(pct !== null ? `${pct}%` : "—", cx, cy - 7);

      if (progress < target) {
        progress = Math.min(target, progress + target / 50);
        rafRef.current = requestAnimationFrame(frame);
      }
    }

    cancelAnimationFrame(rafRef.current);
    requestAnimationFrame(frame);
  }, [pct, size]);

  useEffect(() => {
    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw]);

  return <canvas ref={canvasRef} style={{ display: "block" }} />;
}

// ─── Skeleton & Error ─────────────────────────────────────────────────────────
function DashboardSkeleton() {
  return (
    <div className="w-full min-w-0 space-y-5 py-4">
      <div className="h-20 animate-pulse rounded-xl bg-muted" />
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map(i => <div key={i} className="h-36 animate-pulse rounded-xl bg-muted" />)}
      </div>
      <div className="h-60 animate-pulse rounded-xl bg-muted" />
      <div className="h-120 animate-pulse rounded-xl bg-muted" />
      <div className="h-40 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}

function ErrorDisplay({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
        <AlertCircle className="h-7 w-7 text-destructive" />
      </div>
      <p className="mt-4 text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CollecteDashboardPage() {
  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null);
  const [decoupage,   setDecoupage]   = useState<DecoupageItem[]>([]);
  const [equipements, setEquipements] = useState<EquipementItem[]>([]);
  const [erreurs,     setErreurs]     = useState<ErreursStats | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  const applyPayload = (payload: DashboardPayload) => {
    setGlobalStats(payload.globalStats);
    setDecoupage(payload.decoupage);
    setEquipements(payload.equipements);
    setErreurs(payload.erreurs);
  };

  const loadData = useCallback(async (force = false) => {
    // Cache hit (sauf si force)
    if (!force) {
      const cached = cacheGet<DashboardPayload>(CACHE_KEY);
      if (cached) { applyPayload(cached); setLoading(false); return; }
    }

    try {
      const [globalRes, decoupageRes, equipRes, erreursRes] = await Promise.all([
        api.get<GlobalStats>("/kobo/dashboard/collecte/global"),
        api.get<{ decoupage: DecoupageItem[] }>("/kobo/dashboard/collecte/decoupage"),
        api.get<{ equipements: EquipementItem[] }>("/kobo/dashboard/collecte/equipements"),
        api.get<ErreursStats>("/kobo/dashboard/collecte/erreurs"),
      ]);
      const payload: DashboardPayload = {
        globalStats: globalRes,
        decoupage:   decoupageRes.decoupage,
        equipements: equipRes.equipements,
        erreurs:     erreursRes,
      };
      cacheSet(CACHE_KEY, payload);
      applyPayload(payload);
    } catch (err: unknown) {
      setError((err as Error).message || "Erreur de chargement");
    }
  }, []);

  // Chargement initial
  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      await loadData(false);
      setLoading(false);
    })();
  }, [loadData]);

  // Bouton urgence : vide le cache puis recharge
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    cacheClear(CACHE_KEY);
    await loadData(true);
    setRefreshing(false);
  }, [loadData]);

  if (loading) return <DashboardSkeleton />;
  if (error)   return <ErrorDisplay message={error} />;

  const withTaux = equipements.filter(e => e.taux !== null);
  const noTaux   = equipements.filter(e => e.taux === null);

  const anomalyDefs = [
    {
      key: "manquants" as const, label: "Manquants",
      dot: "#E24B4A", tc: "#A32D2D",
      bg: "rgba(226,75,74,0.08)", bt: "#A32D2D", bb: "rgba(226,75,74,0.25)",
    },
    {
      key: "nouveaux" as const, label: "Nouveaux",
      dot: "#1D9E75", tc: "#0F6E56",
      bg: "rgba(29,158,117,0.08)", bt: "#0F6E56", bb: "rgba(29,158,117,0.25)",
    },
    {
      key: "doublons" as const, label: "Doublons",
      dot: "#EF9F27", tc: "#854F0B",
      bg: "rgba(239,159,39,0.08)", bt: "#854F0B", bb: "rgba(239,159,39,0.25)",
    },
  ];

  return (
    <div className="w-full min-w-0 space-y-5 py-2 md:px-4 md:py-4">

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden rounded-xl px-6 py-5"
        style={{ background: "linear-gradient(135deg, #0C447C 0%, #185FA5 60%, #1D9E75 100%)" }}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 20% 50%, rgba(255,255,255,0.06) 0%, transparent 60%), " +
              "radial-gradient(circle at 80% 20%, rgba(29,158,117,0.3) 0%, transparent 50%)",
          }}
        />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15">
              <Database className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-medium leading-tight text-white">
                Tableau de bord – Collecte terrain
              </h1>
              <p className="mt-0.5 text-xs text-white/70">
                État d'avancement de la collecte des équipements électriques
              </p>
            </div>
          </div>

          {/* ── Bouton Actualiser ── */}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 rounded-lg border border-white/25 bg-white/12 px-4 py-2 text-xs font-medium text-white transition-all hover:bg-white/20 disabled:opacity-60"
            style={{ backdropFilter: "blur(8px)" }}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Actualisation…" : "Actualiser"}
          </button>
        </div>
      </div>

      {/* ── KPI CARDS ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {/* Équipes */}
        <div
          className="relative overflow-hidden rounded-xl border p-5"
          style={{ background: "linear-gradient(135deg, #E6F1FB, #B5D4F4)", borderColor: "#85B7EB" }}
        >
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#185FA5]">
              <Users className="h-5 w-5 text-white" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-xs font-medium text-[#185FA5]">Équipes de collecte</p>
            <p className="mt-1 text-3xl font-medium text-[#042C53]">
              {globalStats?.equipes.collectes ?? 0}
            </p>
          </div>
        </div>

        {/* Départs */}
        <div
          className="relative overflow-hidden rounded-xl border p-5"
          style={{ background: "linear-gradient(135deg, #FAEEDA, #FAC775)", borderColor: "#EF9F27" }}
        >
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#BA7517]">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <span
              className="rounded-full border px-2.5 py-0.5 text-[10px] font-medium"
              style={{ background: "rgba(186,117,23,0.18)", color: "#633806", borderColor: "rgba(186,117,23,0.3)" }}
            >
              {globalStats?.departs.taux ?? 0}% complet
            </span>
          </div>
          <div className="mt-4">
            <p className="text-xs font-medium text-[#854F0B]">Départs collectés</p>
            <p className="mt-1 text-3xl font-medium text-[#412402]">
              {globalStats?.departs.collectes ?? 0}{" "}
              <span className="text-lg opacity-60">/ {globalStats?.departs.attendus ?? 0}</span>
            </p>
          </div>
          <div
            className="mt-4 h-1 w-full overflow-hidden rounded-full"
            style={{ background: "rgba(133,79,11,0.15)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${globalStats?.departs.taux ?? 0}%`, background: "#BA7517" }}
            />
          </div>
        </div>

        {/* Commerciaux */}
        <div
          className="relative overflow-hidden rounded-xl border p-5"
          style={{ background: "linear-gradient(135deg, #EAF3DE, #9FE1CB)", borderColor: "#5DCAA5" }}
        >
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0F6E56]">
              <Building2 className="h-5 w-5 text-white" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-xs font-medium text-[#0F6E56]">Clients commerciaux</p>
            <p className="mt-1 text-3xl font-medium text-[#04342C]">
              {globalStats?.commerciaux.collectes ?? 0}
            </p>
          </div>
        </div>
      </div>

      {/* ── DÉCOUPAGE TABLE ──────────────────────────────────────────────── */}
      {decoupage.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border/50 bg-card">
          <div className="flex items-center gap-3 border-b border-border/50 bg-muted/20 px-5 py-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50">
              <GitBranch className="h-4 w-4 text-blue-700" />
            </div>
            <div>
              <p className="text-sm font-medium">Découpage par exploitation</p>
              <p className="text-xs text-muted-foreground">Départs collectés / attendus par zone ENEO</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Exploitation</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground">Collectés</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground">Attendus</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground">Taux</th>
                </tr>
              </thead>
              <tbody>
                {decoupage.map(item => (
                  <tr key={item.exploitation} className="border-b border-border/40 last:border-0 hover:bg-muted/20">
                    <td className="px-5 py-3 font-medium">{item.exploitation}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{item.collectes}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">{item.attendus}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-3">
                        <span className="text-xs font-medium" style={{ color: barColor(item.taux) }}>
                          {item.taux}%
                        </span>
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-border">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${item.taux}%`, background: barColor(item.taux) }}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── ÉQUIPEMENTS ──────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-xl">
        <div
          className="flex items-center gap-3 px-5 py-4"
          style={{ background: "linear-gradient(135deg, #0C447C, #185FA5)", borderBottom: "1px solid rgba(255,255,255,0.1)" }}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15">
            <BarChart3 className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">Détail par équipement</p>
            <p className="text-xs text-white/60">Collecte / référence par type d'équipement</p>
          </div>
        </div>

        <div
          className="p-6"
          style={{ background: "linear-gradient(160deg, #0C447C 0%, #185FA5 40%, #042C53 100%)" }}
        >
          {withTaux.length > 0 && (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {withTaux.map(eq => {
                const col = gaugeColor(eq.taux);
                return (
                  <div
                    key={eq.nom}
                    className="flex flex-col items-center gap-2 rounded-2xl border py-5 px-4 transition-all"
                    style={{ background: "rgba(255,255,255,0.07)", borderColor: "rgba(255,255,255,0.12)" }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.12)";
                      (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.22)";
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.07)";
                      (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.12)";
                    }}
                  >
                    <div className="flex items-center gap-1.5">
                      <EquipIcon nom={eq.nom} className="h-4 w-4" style={{ color: "rgba(255,255,255,0.8)" }} />
                      <span className="text-center text-xs font-medium text-white/90">{eq.nom}</span>
                    </div>
                    <SpeedometerGauge pct={eq.taux} size={150} />
                    <p className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>
                      <span className="font-medium" style={{ color: col.text }}>{eq.collectes}</span>
                      {eq.attendus != null && <span> / {eq.attendus}</span>}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {noTaux.length > 0 && (
            <div className="mt-6">
              <p className="mb-3 text-[10px] font-medium uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.45)" }}>
                Équipements sans référentiel
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {noTaux.map(eq => (
                  <div
                    key={eq.nom}
                    className="flex flex-col gap-3 rounded-xl border p-4 transition-all"
                    style={{ background: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.1)" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.10)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.06)"; }}
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/12">
                        <EquipIcon nom={eq.nom} className="h-4 w-4" style={{ color: "rgba(255,255,255,0.8)" }} />
                      </div>
                      <span className="text-xs font-medium leading-tight text-white/85">{eq.nom}</span>
                    </div>
                    <div>
                      <p className="text-2xl font-medium text-white leading-none">{eq.collectes}</p>
                      <p className="mt-1 text-[10px]" style={{ color: "rgba(255,255,255,0.45)" }}>éléments collectés</p>
                    </div>
                    <div className="h-0.5 w-8 rounded-full" style={{ background: "linear-gradient(90deg, #1D9E75, #5DCAA5)" }} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── ANOMALIES ────────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-border/50 bg-card">
        <div className="flex items-center gap-3 border-b border-border/50 bg-muted/20 px-5 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50">
            <AlertCircle className="h-4 w-4 text-amber-600" />
          </div>
          <p className="text-sm font-medium">Anomalies de collecte</p>
        </div>
        <div className="grid grid-cols-1 gap-5 p-5 sm:grid-cols-3">
          {anomalyDefs.map(a => {
            const entries = Object.entries(erreurs?.[a.key] ?? {}).filter(([, v]) => v > 0);
            if (!entries.length) return null;
            return (
              <div key={a.key} className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-medium" style={{ color: a.tc }}>
                  <div className="h-2 w-2 rounded-full" style={{ background: a.dot }} />
                  {a.label}
                </div>
                <div className="space-y-1">
                  {entries.map(([k, v]) => (
                    <div
                      key={k}
                      className="flex items-center justify-between rounded-lg border border-border/50 bg-background px-3 py-2 text-xs"
                    >
                      <span className="capitalize text-muted-foreground">{k.replace(/_/g, " ")}</span>
                      <span
                        className="rounded-full border px-2 py-0.5 text-[11px] font-medium"
                        style={{ background: a.bg, color: a.bt, borderColor: a.bb }}
                      >
                        {v}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
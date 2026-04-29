"use client";

import {  useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  BarChart3,
  Box,
  Building2,
  Cable,
  CalendarDays,
  ChevronRight,
  Filter,
  LayoutGrid,
  Power,
  RefreshCw,
  Shield,
  TrendingUp,
  Users,
  X,
  Zap,
} from "lucide-react";
import type { DecoupageStats } from "@/lib/types/collecte";
import { useCollecteStats } from "@/hooks/use-collecteStats";

// ─── Types locaux pour l'affichage ──────────────────────────────────────────
interface AnomalyEntry {
  nom: string;
  val: number;
}

interface ErreursStats {
  manquants: AnomalyEntry[];
  nouveaux: AnomalyEntry[];
  doublons: AnomalyEntry[];
}

// ─── Color helpers ───────────────────────────────────────────────────────────
interface PctColors {
  fill: string;
  light: string;
  text: string;
}

function pctCol(p: number): PctColors {
  if (p >= 76) return { fill: "#1D9E75", light: "#EAF5F0", text: "#085041" };
  if (p >= 51) return { fill: "#639922", light: "#EAF3DE", text: "#27500A" };
  if (p >= 26) return { fill: "#BA7517", light: "#FEF6E7", text: "#412402" };
  return { fill: "#A32D2D", light: "#FCEBEB", text: "#501313" };
}

// ─── Equipment icon mapping ─────────────────────────────────────────────────
function EquipIcon({ nom, className = "" }: { nom: string; className?: string }) {
  const p = {
    className,
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  const normalizedNom = nom.toLowerCase();
  
  if (normalizedNom.includes("poste source")) return <Building2 {...p} />;
  if (normalizedNom.includes("h59")) return <Zap {...p} />;
  if (normalizedNom.includes("h61")) return <Zap {...p} />;
  if (normalizedNom.includes("jeu de barres") || normalizedNom.includes("busbar")) return <LayoutGrid {...p} />;
  if (normalizedNom.includes("cellule") || normalizedNom.includes("bay")) return <Box {...p} />;
  if (normalizedNom.includes("transformateur")) return <Power {...p} />;
  if (normalizedNom.includes("tableau bt")) return <Shield {...p} />;
  if (normalizedNom.includes("appareillage")) return <Cable {...p} />;
  if (normalizedNom.includes("support")) return <TrendingUp {...p} />;
  return <BarChart3 {...p} />;
}

// ─── Donut chart (SVG, no lib) ───────────────────────────────────────────────
function DonutChart({ segments, size = 160 }: { segments: { value: number; color: string }[]; size?: number }) {
  const cx = size / 2, cy = size / 2;
  const r = size * 0.36, thick = size * 0.13;
  const tot = segments.reduce((s, g) => s + g.value, 0);
  let cumul = 0;

  const paths = segments.map((seg) => {
    const s1 = (cumul / tot) * 2 * Math.PI - Math.PI / 2;
    cumul += seg.value;
    const s2 = (cumul / tot) * 2 * Math.PI - Math.PI / 2;
    const lg = s2 - s1 > Math.PI ? 1 : 0;
    const ri = r - thick;
    const x1 = cx + r * Math.cos(s1), y1 = cy + r * Math.sin(s1);
    const x2 = cx + r * Math.cos(s2), y2 = cy + r * Math.sin(s2);
    const xi1 = cx + ri * Math.cos(s2), yi1 = cy + ri * Math.sin(s2);
    const xi2 = cx + ri * Math.cos(s1), yi2 = cy + ri * Math.sin(s1);
    return { d: `M${x1} ${y1} A${r} ${r} 0 ${lg} 1 ${x2} ${y2} L${xi1} ${yi1} A${ri} ${ri} 0 ${lg} 0 ${xi2} ${yi2} Z`, color: seg.color };
  });

  const main = segments.reduce((a, b) => (a.value > b.value ? a : b));

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label="Donut chart avancement global">
      {paths.map((p, i) => (<path key={i} d={p.d} fill={p.color} />))}
      <text x={cx} y={cy - 7} textAnchor="middle" dominantBaseline="middle" fontSize={Math.round(size * 0.14)} fontWeight="700" fill={main.color}>{main.value}%</text>
      <text x={cx} y={cy + 13} textAnchor="middle" dominantBaseline="middle" fontSize={Math.round(size * 0.08)} fill="#9CA3AF">collectés</text>
    </svg>
  );
}

// ─── Speedometer gauge (canvas) ─────────────────────────────────────────────
function SpeedGauge({ pct, color }: { pct: number; color: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const raf = useRef<number>(0);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    const W = 160, H = 98;
    cv.width = W * dpr;
    cv.height = H * dpr;
    cv.style.width = `${W}px`;
    cv.style.height = `${H}px`;
    const ctx = cv.getContext("2d")!;
    ctx.scale(dpr, dpr);
    const cx = W / 2, cy = H * 0.9, r = W * 0.34, sw = W * 0.07;
    const sA = Math.PI, eA = Math.PI * 2;
    const target = Math.min(pct, 100) / 100;
    let p = 0;

    const bgSegs = [
      { f: 0, t: 0.25, c: "#FCEBEB" },
      { f: 0.25, t: 0.5, c: "#FEF6E7" },
      { f: 0.5, t: 0.75, c: "#EAF3DE" },
      { f: 0.75, t: 1, c: "#EAF5F0" },
    ];
    const fillSegs = [
      { f: 0, t: 0.25, c: "#E24B4A" },
      { f: 0.25, t: 0.5, c: "#EF9F27" },
      { f: 0.5, t: 0.75, c: "#639922" },
      { f: 0.75, t: 1, c: "#1D9E75" },
    ];

    function frame() {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, W, H);
      bgSegs.forEach((s) => {
        ctx.beginPath();
        ctx.arc(cx, cy, r, sA + (eA - sA) * s.f, sA + (eA - sA) * s.t);
        ctx.strokeStyle = s.c;
        ctx.lineWidth = sw;
        ctx.lineCap = "butt";
        ctx.stroke();
      });
      if (p > 0) {
        fillSegs.filter((s) => s.f < p).forEach((s) => {
          const t = Math.min(s.t, p);
          ctx.beginPath();
          ctx.arc(cx, cy, r, sA + (eA - sA) * s.f, sA + (eA - sA) * t);
          ctx.strokeStyle = s.c;
          ctx.lineWidth = sw;
          ctx.lineCap = t === p ? "round" : "butt";
          ctx.stroke();
        });
      }
      for (let i = 0; i <= 10; i++) {
        const a = sA + (eA - sA) * (i / 10), isMaj = i % 5 === 0;
        const r1 = r - sw / 2 - 2, r2 = r + sw / 2 + (isMaj ? 5 : 2);
        ctx.beginPath();
        ctx.moveTo(cx + r1 * Math.cos(a), cy + r1 * Math.sin(a));
        ctx.lineTo(cx + r2 * Math.cos(a), cy + r2 * Math.sin(a));
        ctx.strokeStyle = isMaj ? "rgba(0,0,0,.18)" : "rgba(0,0,0,.07)";
        ctx.lineWidth = isMaj ? 1.5 : 0.7;
        ctx.lineCap = "square";
        ctx.stroke();
      }
      const nA = sA + (eA - sA) * p, nLen = r - sw / 2 - 5;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + nLen * Math.cos(nA), cy + nLen * Math.sin(nA));
      ctx.strokeStyle = "#374151";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.fill();
      ctx.restore();
      ctx.font = `700 ${Math.round(W * 0.12)}px 'DM Sans',sans-serif`;
      ctx.fillStyle = color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${Math.round(p * 100)}%`, cx, cy - r * 0.33);
      if (p < target) {
        p = Math.min(target, p + target / 45);
        raf.current = requestAnimationFrame(frame);
      }
    }
    cancelAnimationFrame(raf.current);
    requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf.current);
  }, [pct, color]);

  return <canvas ref={ref} style={{ display: "block" }} />;
}

// ─── Line chart (canvas) ─────────────────────────────────────────────────────
function LineChart({ series, labels }: { series: { nom: string; color: string; dash: number[]; data: number[] }[]; labels: string[] }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    const W = cv.offsetWidth || 700, H = 220;
    cv.width = W * dpr;
    cv.height = H * dpr;
    const ctx = cv.getContext("2d")!;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    const pad = { top: 20, right: 52, bottom: 36, left: 44 };
    const cW = W - pad.left - pad.right, cH = H - pad.top - pad.bottom;
    const maxVal = Math.max(...series.flatMap((s) => s.data)) * 1.1;
    const xOf = (i: number) => pad.left + (i / (labels.length - 1)) * cW;
    const yOf = (v: number) => pad.top + cH - (v / maxVal) * cH;

    for (let s = 0; s <= 4; s++) {
      const y = pad.top + (s / 4) * cH;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + cW, y);
      ctx.strokeStyle = "#F3F4F6";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.font = "10px 'DM Sans',sans-serif";
      ctx.fillStyle = "#9CA3AF";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(String(Math.round(maxVal - (maxVal / 4) * s)), pad.left - 6, y);
    }
    labels.forEach((lbl, i) => {
      ctx.font = "10px 'DM Sans',sans-serif";
      ctx.fillStyle = "#9CA3AF";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(lbl, xOf(i), pad.top + cH + 8);
    });
    series.forEach((s) => {
      const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + cH);
      grad.addColorStop(0, s.color + "28");
      grad.addColorStop(1, s.color + "04");
      ctx.beginPath();
      ctx.moveTo(xOf(0), yOf(s.data[0]));
      s.data.forEach((v, i) => { if (i > 0) ctx.lineTo(xOf(i), yOf(v)); });
      ctx.lineTo(xOf(s.data.length - 1), pad.top + cH);
      ctx.lineTo(xOf(0), pad.top + cH);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(xOf(0), yOf(s.data[0]));
      s.data.forEach((v, i) => { if (i > 0) ctx.lineTo(xOf(i), yOf(v)); });
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 2;
      ctx.setLineDash(s.dash);
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.stroke();
      ctx.setLineDash([]);
      const lx = xOf(s.data.length - 1), ly = yOf(s.data[s.data.length - 1]);
      ctx.beginPath();
      ctx.arc(lx, ly, 4, 0, Math.PI * 2);
      ctx.fillStyle = s.color;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(lx, ly, 2, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.fill();
      ctx.font = "700 11px 'DM Sans',sans-serif";
      ctx.fillStyle = s.color;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(String(s.data[s.data.length - 1]), lx + 7, ly);
    });
  }, [series, labels]);

  return <canvas ref={ref} style={{ width: "100%", height: "220px", display: "block" }} />;
}

// ─── Filter dialog ────────────────────────────────────────────────────────────
type Period = "today" | "week" | "custom";

function FilterDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [period, setPeriod] = useState<Period>("today");
  const [selected, setSelected] = useState<string[]>([]);
  const exploitations = ["DRC", "DRD", "DRSM", "DRSOM", "DRY"];

  const toggle = (e: string) => setSelected((prev) => prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-[#D1DCF0] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#EEF1F7] px-5 py-4">
          <p className="text-sm font-bold text-[#111827]">Filtres</p>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#F3F4F6] text-[#6B7280] hover:bg-[#E5EAF2]"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-5 px-5 py-4">
          <div>
            <p className="mb-2.5 text-[9px] font-bold uppercase tracking-widest text-[#9CA3AF]">Période</p>
            <div className="grid grid-cols-3 gap-2">
              {(["today", "week", "custom"] as Period[]).map((p) => (
                <button key={p} onClick={() => setPeriod(p)} className="flex flex-col items-center gap-1 rounded-xl border py-3 text-[10px] font-semibold transition-all"
                  style={period === p ? { background: "#EBF3FC", borderColor: "#185FA5", color: "#185FA5" } : { background: "#F8FAFE", borderColor: "#E5EAF2", color: "#6B7280" }}>
                  <CalendarDays className="h-4 w-4" />
                  {p === "today" ? "Aujourd'hui" : p === "week" ? "Cette semaine" : "Personnalisé"}
                </button>
              ))}
            </div>
            {period === "custom" && (
              <div className="mt-2 space-y-2">
                <input type="date" className="w-full rounded-lg border border-[#D1DCF0] px-3 py-2 text-[11px] text-[#374151] outline-none focus:border-[#185FA5]" />
                <input type="date" className="w-full rounded-lg border border-[#D1DCF0] px-3 py-2 text-[11px] text-[#374151] outline-none focus:border-[#185FA5]" />
              </div>
            )}
          </div>
          <div>
            <p className="mb-2.5 text-[9px] font-bold uppercase tracking-widest text-[#9CA3AF]">Direction régionale</p>
            <div className="flex flex-wrap gap-2">
              {exploitations.map((ex) => (
                <button key={ex} onClick={() => toggle(ex)} className="rounded-lg border px-3 py-1.5 text-[11px] transition-all"
                  style={selected.includes(ex) ? { background: "#EBF3FC", borderColor: "#185FA5", color: "#185FA5", fontWeight: 600 } : { background: "#F8FAFE", borderColor: "#E5EAF2", color: "#6B7280", fontWeight: 500 }}>
                  {ex}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-2 px-5 pb-5">
          <button onClick={() => { setPeriod("today"); setSelected([]); }} className="flex-1 rounded-xl border border-[#E5EAF2] bg-white py-2.5 text-[11px] font-semibold text-[#6B7280] transition hover:bg-[#F3F4F6]">Réinitialiser</button>
          <button onClick={onClose} className="flex-1 rounded-xl bg-[#185FA5] py-2.5 text-[11px] font-bold text-white transition hover:bg-[#0C447C]">Appliquer</button>
        </div>
      </div>
    </div>
  );
}

// ─── Drawer ───────────────────────────────────────────────────────────────────
function Drawer({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm transition-opacity duration-200" style={{ opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none" }} onClick={onClose} />
      <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-xs flex-col border-l border-[#E5EAF2] bg-white shadow-xl transition-transform duration-300 ease-out" style={{ transform: open ? "translateX(0)" : "translateX(100%)" }}>
        <div className="flex items-center justify-between border-b border-[#EEF1F7] px-5 py-4">
          <p className="text-sm font-bold text-[#111827]">{title}</p>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#F3F4F6] text-[#6B7280] hover:bg-[#E5EAF2]"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </>
  );
}

// ─── Helper pour extraire les anomalies (à personnaliser selon vos besoins) ───
function generateAnomaliesFromData(decoupage: DecoupageStats[]): ErreursStats {
  const lowPerformingZones = decoupage.filter(d => d.postes_collectes.taux !== null && d.postes_collectes.taux < 10);
  
  return {
    manquants: lowPerformingZones.map(d => ({ nom: d.decoupage, val: Math.round(100 - (d.postes_collectes.taux || 0)) })),
    nouveaux: [], // À définir selon votre logique métier
    doublons: [], // À définir selon votre logique métier
  };
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CollecteDashboardPage() {
  const [filterOpen, setFilterOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedDecoupage, setSelectedDecoupage] = useState<DecoupageStats | null>(null);
  
  // Utilisation du hook pour les données dynamiques
  const { data, loading, refreshing, error, lastUpdated, refresh } = useCollecteStats();

  // Transformation des données pour l'affichage
  const equipementList = data ? [
    { nom: "Postes collectés", collectes: data.global.postes_collectes.collectes, attendus: data.global.postes_collectes.attendus || 0, taux: data.global.postes_collectes.taux || 0 },
    { nom: "Postes source", collectes: data.global.postes_source.collectes, attendus: data.global.postes_source.attendus || 0, taux: data.global.postes_source.taux || 0 },
    { nom: "H59", collectes: data.global.h59.collectes, attendus: data.global.h59.attendus || 0, taux: data.global.h59.taux || 0 },
    { nom: "H61", collectes: data.global.h61.collectes, attendus: data.global.h61.attendus || 0, taux: data.global.h61.taux || 0 },
    { nom: "Jeu de barres", collectes: data.global.busbars.collectes, attendus: data.global.busbars.attendus || 0, taux: data.global.busbars.taux || 0 },
    { nom: "Cellules", collectes: data.global.bays.collectes, attendus: data.global.bays.attendus || 0, taux: data.global.bays.taux || 0 },
    { nom: "Transformateurs", collectes: data.global.transformers.collectes, attendus: data.global.transformers.attendus || 0, taux: data.global.transformers.taux || 0 },
    { nom: "Appareillage", collectes: data.global.appareillage.collectes, attendus: 0, taux: 0 },
    { nom: "Tableau BT", collectes: data.global.tableau_bt.collectes, attendus: 0, taux: 0 },
    { nom: "Support", collectes: data.global.supports.collectes, attendus: 0, taux: 0 },
  ] : [];

  // Données pour le graphique linéaire (exemple - à adapter selon vos données réelles)
  const lineSeries = [
    { nom: "Tableau BT", color: "#185FA5", dash: [], data: [12, 18, 25, 30, 42, 55, 68, 75, data?.global.tableau_bt.collectes || 89] },
    { nom: "Appareillage", color: "#BA7517", dash: [6, 3], data: [5, 8, 14, 19, 24, 30, 37, 40, data?.global.appareillage.collectes || 47] },
    { nom: "Support", color: "#1D9E75", dash: [2, 2], data: [40, 65, 90, 130, 175, 210, 255, 285, data?.global.supports.collectes || 312] },
  ];

  const SEMAINE_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim", "Lun", "Mar"];

  // Calcul des statistiques globales
  const totalCollectes = data?.global.postes_collectes.collectes || 0;
  const totalAttendus = data?.global.postes_collectes.attendus || 1;
  const totalTaux = data?.global.postes_collectes.taux || 0;
  
  const totalEquipes = data?.equipes.liste.length || 0;
  const equipesActives = data?.equipes.total_actives || 0;

  const feedersCollectes = data?.feeders.collectes || 0;
  const feedersAttendus = data?.feeders.attendus || 1;
  const feedersTaux = data?.feeders.taux || 0;

  // Anomalies générées à partir des données
  const anomalies = data?.decoupage ? generateAnomaliesFromData(data.decoupage) : { manquants: [], nouveaux: [], doublons: [] };

  const anomalyDefs = [
    { key: "manquants" as const, label: "Manquants", dot: "#E24B4A", light: "#FCEBEB", text: "#A32D2D", badge: "#F7C1C1" },
    { key: "nouveaux" as const, label: "Nouveaux", dot: "#1D9E75", light: "#EAF5F0", text: "#0F6E56", badge: "#9FE1CB" },
    { key: "doublons" as const, label: "Doublons", dot: "#BA7517", light: "#FEF6E7", text: "#633806", badge: "#FAC775" },
  ];

  const handleCardClick = (decoupageItem: DecoupageStats) => {
    setSelectedDecoupage(decoupageItem);
    setDrawerOpen(true);
  };

  // État de chargement
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F4F6FA]">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-[#185FA5] border-t-transparent"></div>
          <p className="mt-4 text-sm text-[#6B7280]">Chargement des données...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F4F6FA]">
        <div className="max-w-md rounded-2xl border border-red-200 bg-white p-6 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
          <h2 className="mt-4 text-lg font-semibold text-[#111827]">Erreur de chargement</h2>
          <p className="mt-2 text-sm text-[#6B7280]">{error}</p>
          <button onClick={refresh} className="mt-4 rounded-xl bg-[#185FA5] px-4 py-2 text-sm font-semibold text-white">
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full space-y-4 bg-[#F4F6FA] px-4 py-5 md:px-8 md:py-7" style={{ fontFamily: "'DM Sans',sans-serif" }}>
      {/* HERO */}
      <div className="rounded-2xl border border-[#D1DCF0] bg-white px-6 py-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-2xl bg-[#185FA5]">
              <BarChart3 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold leading-snug text-[#0C2340]">
                Tableau de bord d&apos;inventaire des actifs
                <br />
                <span className="text-[#185FA5]">
                  de distribution électriques et Commerciale
                </span>
              </h1>
             
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setFilterOpen(true)} className="flex items-center gap-2 rounded-xl border border-[#D1DCF0] bg-white px-4 py-2 text-[11px] font-semibold text-[#374151] transition hover:border-[#185FA5] hover:bg-[#F0F5FF] hover:text-[#185FA5]">
              <Filter className="h-3.5 w-3.5" /> Filtres
            </button>
            <button onClick={refresh} disabled={refreshing} className="flex items-center gap-2 rounded-xl border border-[#185FA5] bg-[#185FA5] px-4 py-2 text-[11px] font-bold text-white transition hover:bg-[#0C447C] disabled:opacity-60">
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Actualisation…" : "Actualiser"}
            </button>
          </div>
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {/* Départs en cours (Feeders) */}
        <div className="group relative overflow-hidden rounded-2xl border border-[#B5D4F4] bg-[#EBF3FC] p-5 transition-all hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#185FA5]">
            <Zap className="h-5 w-5 text-white" />
          </div>
          <p className="mt-3.5 text-[10px] font-bold uppercase tracking-widest text-[#185FA5]">
            Départs en cours
          </p>
          <p className="mt-1 text-[30px] font-bold leading-none text-[#0C447C]">
            {feedersCollectes}
          </p>
          <div className="mt-3 h-[3px] w-full overflow-hidden rounded-full bg-[#C8DFF5]">
            <div className="h-full rounded-full bg-[#185FA5] transition-all duration-700" style={{ width: `${feedersTaux}%` }} />
          </div>
        </div>

        {/* Départs collectés (Feeders collectés) */}
        <div className="group relative overflow-hidden rounded-2xl border border-[#9FE1CB] bg-[#EAF5F0] p-5 transition-all hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex items-start justify-between">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1D9E75]">
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
            <span className="rounded-full bg-[#C0F0DC] px-2.5 py-0.5 text-[10px] font-bold text-[#0F6E56]">
              {feedersTaux}%
            </span>
          </div>
          <p className="mt-3.5 text-[10px] font-bold uppercase tracking-widest text-[#1D9E75]">
            Départs collectés
          </p>
          <p className="mt-1 text-[30px] font-bold leading-none text-[#085041]">
            {feedersCollectes}
            <span className="ml-1 text-sm font-medium opacity-40"> / {feedersAttendus}</span>
          </p>
          <div className="mt-3 h-[3px] w-full overflow-hidden rounded-full bg-[#C0EEDD]">
            <div className="h-full rounded-full bg-[#1D9E75] transition-all duration-700" style={{ width: `${feedersTaux}%` }} />
          </div>
        </div>

        {/* Équipes actifs */}
        <div className="group relative overflow-hidden rounded-2xl border border-[#CECBF6] bg-[#F4EEFE] p-5 transition-all hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#7F77DD]">
            <Users className="h-5 w-5 text-white" />
          </div>
          <p className="mt-3.5 text-[10px] font-bold uppercase tracking-widest text-[#7F77DD]">
            Équipes actives
          </p>
          <p className="mt-1 text-[30px] font-bold leading-none text-[#3C3489]">
            {equipesActives}
            <span className="ml-1 text-sm font-medium opacity-40"> / {totalEquipes}</span>
          </p>
          <p className="mt-2.5 text-[10px] font-medium text-[#534AB7]">
            {totalEquipes} équipes au total
          </p>
        </div>

        {/* Postes collectés */}
        <div className="group relative cursor-pointer overflow-hidden rounded-2xl border border-[#FAC775] bg-[#FEF6E7] p-5 transition-all hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex items-start justify-between">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#BA7517]">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <span className="rounded-full bg-[#FDE8B0] px-2.5 py-0.5 text-[10px] font-bold text-[#633806]">
              {totalTaux}%
            </span>
          </div>
          <p className="mt-3.5 text-[10px] font-bold uppercase tracking-widest text-[#BA7517]">
            Postes collectés
          </p>
          <p className="mt-1 text-[30px] font-bold leading-none text-[#412402]">
            {totalCollectes}
            <span className="ml-1 text-sm font-medium opacity-40"> / {totalAttendus}</span>
          </p>
          <div className="mt-2.5 flex items-center gap-1 text-[11px] font-semibold text-[#BA7517] transition-all group-hover:gap-2">
            Détails <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </div>
        </div>
      </div>

      {/* AVANCEMENT CHART */}
      <div className="overflow-hidden rounded-2xl border border-[#E5EAF2] bg-white">
        <div className="flex items-center gap-3 border-b border-[#EEF1F7] px-5 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EBF3FC]">
            <BarChart3 className="h-4 w-4 text-[#185FA5]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#111827]">État d&apos;avancement de la collecte</p>
            <p className="text-[10px] text-[#9CA3AF]">Pourcentages de collecte par direction régionale</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2">
          <div className="border-b border-[#EEF1F7] p-5 md:border-b-0 md:border-r">
            <p className="mb-4 text-[9px] font-bold uppercase tracking-widest text-[#9CA3AF]">Par direction régionale</p>
            <div className="space-y-3">
              {data?.decoupage.map((d) => {
                const taux = d.postes_collectes.taux || 0;
                const c = pctCol(taux);
                return (
                  <div key={d.decoupage} onClick={() => handleCardClick(d)} className="cursor-pointer transition hover:opacity-80">
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-medium text-[#374151]">{d.decoupage}</span>
                      <span className="text-[11px] font-bold" style={{ color: c.fill }}>{taux}%</span>
                    </div>
                    <div className="mt-1 h-[7px] overflow-hidden rounded-full bg-[#EEF1F7]">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${taux}%`, background: c.fill }} />
                    </div>
                    <p className="mt-0.5 text-[10px] text-[#9CA3AF]">{d.postes_collectes.collectes} / {d.postes_collectes.attendus || 0}</p>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="p-5">
            <p className="mb-4 text-[9px] font-bold uppercase tracking-widest text-[#9CA3AF]">Vue globale</p>
            <div className="flex flex-col items-center gap-4">
              <DonutChart segments={[
                { value: totalTaux, color: "#1D9E75" },
                { value: Math.min(100 - totalTaux, 100), color: "#E5EAF2" },
              ]} size={160} />
              <div className="flex flex-wrap justify-center gap-4">
                <div className="flex items-center gap-1.5"><div className="h-2.5 w-2.5 rounded-sm bg-[#1D9E75]" /><span className="text-[11px] text-[#6B7280]">Collectés {totalTaux}%</span></div>
                <div className="flex items-center gap-1.5"><div className="h-2.5 w-2.5 rounded-sm bg-[#D1DCF0]" /><span className="text-[11px] text-[#6B7280]">Restants {100 - totalTaux}%</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SPEEDOMETERS */}
      <div className="overflow-hidden rounded-2xl border border-[#E5EAF2] bg-white">
        <div className="flex items-center gap-3 border-b border-[#EEF1F7] bg-gradient-to-r from-[#EBF3FC] to-[#EAF5F0] px-5 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#185FA5]">
            <LayoutGrid className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#111827]">Détail par équipement</p>
            <p className="text-[10px] text-[#6B7280]">Taux de collecte — référentiel inclus</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 bg-[#F8FAFE] p-5 sm:grid-cols-2 lg:grid-cols-3">
          {equipementList.map((eq) => {
            const col = pctCol(eq.taux);
            return (
              <div key={eq.nom} className="flex flex-col items-center gap-1.5 rounded-2xl border border-[#E5EAF2] bg-white p-4 transition-all hover:border-[#B5D4F4] hover:shadow-md">
                <div className="flex items-center gap-2 self-start">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: col.light, color: col.fill }}>
                    <EquipIcon nom={eq.nom} className="h-4 w-4" />
                  </div>
                  <span className="text-[11px] font-semibold text-[#374151]">{eq.nom}</span>
                </div>
                <SpeedGauge pct={eq.taux} color={col.fill} />
                <p className="text-[11px] text-[#9CA3AF]">
                  <b className="font-semibold text-[#374151]">{eq.collectes}</b> / {eq.attendus}
                  <span className="ml-2 font-bold" style={{ color: col.fill }}>{eq.taux}%</span>
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* LINE CHART */}
      <div className="overflow-hidden rounded-2xl border border-[#E5EAF2] bg-white">
        <div className="flex flex-wrap items-center gap-4 border-b border-[#EEF1F7] px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EEF1F7]">
              <TrendingUp className="h-4 w-4 text-[#6B7280]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#111827]">Progression de collecte</p>
              <p className="text-[10px] text-[#9CA3AF]">Tableau BT · Appareillage · Support</p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-4">
            {lineSeries.map((s) => (
              <div key={s.nom} className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
                <span className="text-[11px] text-[#6B7280]">{s.nom}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="px-4 py-4">
          <LineChart series={lineSeries} labels={SEMAINE_LABELS} />
        </div>
        <div className="grid grid-cols-3 divide-x divide-[#EEF1F7] border-t border-[#EEF1F7]">
          {lineSeries.map((s) => {
            const last = s.data[s.data.length - 1];
            const prev = s.data[s.data.length - 2];
            const delta = last - prev;
            return (
              <div key={s.nom} className="py-3 text-center">
                <p className="text-[9px] uppercase tracking-widest text-[#9CA3AF]">{s.nom}</p>
                <p className="mt-0.5 text-xl font-bold" style={{ color: s.color }}>{last}</p>
                <p className="text-[10px] font-medium text-[#1D9E75]">{delta >= 0 ? `+${delta}` : delta} aujourd&apos;hui</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* ANOMALIES */}
      <div className="overflow-hidden rounded-2xl border border-[#E5EAF2] bg-white">
        <div className="flex items-center gap-3 border-b border-[#EEF1F7] px-5 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FEF3CD]">
            <AlertCircle className="h-4 w-4 text-[#BA7517]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#111827]">Anomalies de collecte</p>
            <p className="text-[10px] text-[#9CA3AF]">Zones à faible taux de collecte</p>
          </div>
          <div className="ml-auto flex gap-2">
            {anomalyDefs.map((a) => {
              const total = anomalies[a.key].reduce((s, e) => s + e.val, 0);
              return total > 0 ? (
                <span key={a.key} className="rounded-full px-2.5 py-0.5 text-[10px] font-bold" style={{ background: a.badge, color: a.text }}>
                  {a.label}: {total}
                </span>
              ) : null;
            })}
          </div>
        </div>
        <div className="grid grid-cols-1 divide-y divide-[#EEF1F7] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {anomalyDefs.map((a) => {
            const entries = anomalies[a.key];
            const maxVal = entries.length ? Math.max(...entries.map((e) => e.val)) : 1;
            return (
              <div key={a.key} className="p-5">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[11px] font-bold" style={{ color: a.text }}>
                    <div className="h-2 w-2 rounded-full" style={{ background: a.dot }} />
                    {a.label}
                  </div>
                  {entries.length > 0 && (
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: a.badge, color: a.text }}>
                      {entries.reduce((s, e) => s + e.val, 0)}
                    </span>
                  )}
                </div>
                {entries.length === 0 ? (
                  <p className="text-[11px] italic text-[#C4C9D4]">Aucune anomalie détectée</p>
                ) : (
                  <div className="space-y-2.5">
                    {entries.map((e) => (
                      <div key={e.nom} className="flex items-center gap-2.5 border-b border-[#F3F4F6] pb-2.5 last:border-0 last:pb-0">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ background: a.light }}>
                          <AlertCircle className="h-3.5 w-3.5" style={{ color: a.dot }} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[12px] font-medium capitalize text-[#374151]">{e.nom.replace(/_/g, " ")}</p>
                          <div className="mt-1 h-[3px] rounded-full opacity-40" style={{ width: `${Math.round((e.val / maxVal) * 100)}%`, background: a.dot }} />
                        </div>
                        <span className="text-[13px] font-bold" style={{ color: a.text }}>{e.val}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* FILTER DIALOG */}
      <FilterDialog open={filterOpen} onClose={() => setFilterOpen(false)} />

      {/* DETAIL DRAWER */}
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title={`Détail - ${selectedDecoupage?.decoupage || "Direction régionale"}`}>
        {selectedDecoupage && (
          <div className="space-y-3">
            <div className="flex gap-2">
              {[
                { label: "Postes collectés", val: selectedDecoupage.postes_collectes.collectes, attendus: selectedDecoupage.postes_collectes.attendus, color: "#1D9E75" },
                { label: "Feeder collectés", val: selectedDecoupage.feeders.collectes, attendus: selectedDecoupage.feeders.attendus, color: "#185FA5" },
                { label: "Taux global", val: `${selectedDecoupage.postes_collectes.taux || 0}%`, color: "#BA7517" },
              ].map((item) => (
                <div key={item.label} className="flex-1 rounded-xl border border-[#E5EAF2] bg-[#F8FAFE] p-3 text-center">
                  <p className="text-[9px] uppercase tracking-widest text-[#9CA3AF]">{item.label}</p>
                  <p className="mt-1 text-[22px] font-bold" style={{ color: item.color }}>
                    {item.val}
                    {item.attendus !== undefined && item.attendus !== null && <span className="ml-1 text-xs opacity-40"> / {item.attendus}</span>}
                  </p>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-[#9CA3AF]">Détail par équipement</p>
              {[
                { label: "Postes source", data: selectedDecoupage.postes_source, icon: Building2 },
                { label: "H59", data: selectedDecoupage.h59, icon: Zap },
                { label: "H61", data: selectedDecoupage.h61, icon: Zap },
                { label: "Jeu de barres", data: selectedDecoupage.busbars, icon: LayoutGrid },
                { label: "Cellules", data: selectedDecoupage.bays, icon: Box },
                { label: "Transformateurs", data: selectedDecoupage.transformers, icon: Power },
              ].map((item) => {
                if (!item.data) return null;
                const taux = item.data.taux || 0;
                const c = pctCol(taux);
                return (
                  <div key={item.label} className="rounded-xl border border-[#E5EAF2] bg-white p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <item.icon className="h-3.5 w-3.5" style={{ color: c.fill }} />
                        <span className="text-[11px] font-medium text-[#374151]">{item.label}</span>
                      </div>
                      <span className="text-[11px] font-bold" style={{ color: c.fill }}>{taux}%</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 overflow-hidden rounded-full bg-[#EEF1F7]" style={{ height: 5 }}>
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${taux}%`, background: c.fill }} />
                      </div>
                      <span className="text-[10px] text-[#9CA3AF]">{item.data.collectes}/{item.data.attendus || 0}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
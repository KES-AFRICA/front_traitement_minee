"use client";

import { useEffect, useRef } from "react";
import { ArrowUpRight } from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────
export interface KpiCardProps {
  label: string;
  value: number | string;
  total?: number;
  unit?: string;
  pct?: number;              // 0-100, si fourni → anneau de progression
  color: string;             // hex couleur principale
  colorBg: string;           // hex ou rgba fond
  colorBorder: string;
  icon: React.ReactNode;
  trend?: { value: number; label: string };  // variation ex. +12 "vs hier"
  href?: string;             // si fourni → bouton "Détails →"
  onDetailClick?: () => void;
  size?: "sm" | "md" | "lg";
}

// ─── Animated ring (canvas) ────────────────────────────────────────────────
function RingProgress({ pct, color, size = 64 }: { pct: number; color: string; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const raf = useRef<number>(0);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width  = `${size}px`;
    canvas.style.height = `${size}px`;
    const ctx = canvas.getContext("2d")!;
    const cx = size / 2, cy = size / 2;
    const r  = size * 0.38;
    const sw = size * 0.09;
    const target = Math.min(pct, 100) / 100;
    let progress = 0;

    function frame() {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, size, size);
      // track
      ctx.beginPath();
      ctx.arc(cx, cy, r, -Math.PI / 2, Math.PI * 1.5);
      ctx.strokeStyle = "rgba(0,0,0,0.08)";
      ctx.lineWidth = sw;
      ctx.lineCap  = "round";
      ctx.stroke();
      // fill
      if (progress > 0) {
        const endA = -Math.PI / 2 + Math.PI * 2 * progress;
        ctx.beginPath();
        ctx.arc(cx, cy, r, -Math.PI / 2, endA);
        ctx.strokeStyle = color;
        ctx.lineWidth = sw;
        ctx.lineCap  = "round";
        ctx.stroke();
      }
      // text
      ctx.font         = `700 ${Math.round(size * 0.2)}px 'DM Sans', sans-serif`;
      ctx.fillStyle    = color;
      ctx.textAlign    = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${Math.round(progress * 100)}%`, cx, cy);

      if (progress < target) {
        progress = Math.min(target, progress + target / 45);
        raf.current = requestAnimationFrame(frame);
      }
    }
    cancelAnimationFrame(raf.current);
    requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf.current);
  }, [pct, color, size]);

  return <canvas ref={ref} style={{ display: "block" }} />;
}

// ─── KpiCard ───────────────────────────────────────────────────────────────
export function KpiCard({
  label, value, total, unit, pct, color, colorBg, colorBorder,
  icon, trend, onDetailClick,
}: KpiCardProps) {
  return (
    <div
      className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
      style={{ background: colorBg, borderColor: colorBorder }}
    >
      {/* Subtle top-right glow */}
      <div
        className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-30 blur-2xl"
        style={{ background: color }}
      />

      {/* Header */}
      <div className="relative flex items-start justify-between">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl shadow-sm"
          style={{ background: color }}
        >
          <span className="text-white [&>svg]:h-5 [&>svg]:w-5">{icon}</span>
        </div>
        {pct !== undefined && <RingProgress pct={pct} color={color} size={52} />}
      </div>

      {/* Values */}
      <div className="relative mt-4">
        <p className="text-[11px] font-semibold uppercase tracking-widest opacity-60">{label}</p>
        <p className="mt-1 text-3xl font-bold leading-none" style={{ color }}>
          {value}
          {total !== undefined && (
            <span className="ml-1 text-base font-medium opacity-40">/ {total}</span>
          )}
          {unit && <span className="ml-1 text-sm font-medium opacity-60">{unit}</span>}
        </p>
        {trend && (
          <p className="mt-1.5 text-[11px] font-medium" style={{ color }}>
            <span className="opacity-80">
              {trend.value > 0 ? "+" : ""}{trend.value}
            </span>{" "}
            <span className="opacity-50">{trend.label}</span>
          </p>
        )}
      </div>

      {/* Detail link */}
      {onDetailClick && (
        <button
          onClick={onDetailClick}
          className="relative mt-4 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider transition-all group-hover:gap-2.5"
          style={{ color }}
        >
          Détails
          <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </button>
      )}
    </div>
  );
}
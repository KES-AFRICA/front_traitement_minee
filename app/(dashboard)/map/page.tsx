"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { ArrowLeft, Bell, Map, Compass, Layers, Globe2 } from "lucide-react";

// Définition des types pour les points
interface GridPoint {
  x: number;
  y: number;
  type: 'grid';
}

interface MarkerPoint {
  x: number;
  y: number;
  type: 'marker';
  size: number;
}

type Point = GridPoint | MarkerPoint;

export default function MapPage() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isNotifying, setIsNotifying] = useState(false);
  const [buildProgress, setBuildProgress] = useState(0);
  const animationRef = useRef<number | undefined>(undefined);

  // Animation de construction du canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Points de la carte (simulation d'une carte vectorielle)
    const points: Point[] = [
      // Grille principale
      ...Array.from({ length: 20 }, (_, i) => ({ x: i * 50, y: 100, type: 'grid' as const })),
      ...Array.from({ length: 20 }, (_, i) => ({ x: i * 50, y: 200, type: 'grid' as const })),
      ...Array.from({ length: 20 }, (_, i) => ({ x: i * 50, y: 300, type: 'grid' as const })),
      ...Array.from({ length: 20 }, (_, i) => ({ x: i * 50, y: 400, type: 'grid' as const })),
      ...Array.from({ length: 20 }, (_, i) => ({ x: 50, y: i * 50, type: 'grid' as const })),
      ...Array.from({ length: 20 }, (_, i) => ({ x: 150, y: i * 50, type: 'grid' as const })),
      ...Array.from({ length: 20 }, (_, i) => ({ x: 250, y: i * 50, type: 'grid' as const })),
      ...Array.from({ length: 20 }, (_, i) => ({ x: 350, y: i * 50, type: 'grid' as const })),
      ...Array.from({ length: 20 }, (_, i) => ({ x: 450, y: i * 50, type: 'grid' as const })),
      // Points d'intérêt
      { x: 200, y: 250, type: 'marker' as const, size: 8 },
      { x: 350, y: 180, type: 'marker' as const, size: 6 },
      { x: 120, y: 320, type: 'marker' as const, size: 6 },
      { x: 420, y: 380, type: 'marker' as const, size: 6 },
      { x: 280, y: 420, type: 'marker' as const, size: 6 },
    ];

    const animate = (timestamp: number) => {
      if (!canvas) return;
      
      const startTime = performance.now();
      const duration = 4000; // 4 secondes d'animation
      
      const animateFrame = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        setBuildProgress(Math.floor(progress * 100));
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Style de ligne futuriste
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#3b82f6';
        
        // Dessiner la grille avec effet de construction
        points.forEach((point, idx) => {
          const pointProgress = Math.max(0, Math.min(1, (progress - idx * 0.002) * 1.2));
          if (pointProgress <= 0) return;
          
          if (point.type === 'grid') {
            ctx.beginPath();
            ctx.arc(point.x, point.y, 2 * pointProgress, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(59, 130, 246, ${0.3 * pointProgress})`;
            ctx.fill();
            
            // Connecter les points pour former la grille
            const connectedPoint = points.find(p => 
              (p.x === point.x + 50 && p.y === point.y) || 
              (p.x === point.x && p.y === point.y + 50)
            );
            if (connectedPoint && progress > idx * 0.002) {
              ctx.beginPath();
              ctx.moveTo(point.x, point.y);
              ctx.lineTo(connectedPoint.x, connectedPoint.y);
              ctx.strokeStyle = `rgba(59, 130, 246, ${0.5 * pointProgress})`;
              ctx.stroke();
            }
          } else if (point.type === 'marker') {
            const size = point.size * pointProgress;
            ctx.beginPath();
            ctx.arc(point.x, point.y, size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(59, 130, 246, ${0.8 * pointProgress})`;
            ctx.fill();
            ctx.beginPath();
            ctx.arc(point.x, point.y, size * 1.5, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(59, 130, 246, ${0.2 * pointProgress})`;
            ctx.fill();
          }
        });
        
        // Effet de scanning
        if (progress < 1) {
          const scanY = (progress * canvas.height) % canvas.height;
          ctx.beginPath();
          ctx.moveTo(0, scanY);
          ctx.lineTo(canvas.width, scanY);
          ctx.strokeStyle = '#3b82f6';
          ctx.lineWidth = 2;
          ctx.stroke();
          
          // Effet de glow
          ctx.beginPath();
          ctx.moveTo(0, scanY - 10);
          ctx.lineTo(canvas.width, scanY - 10);
          ctx.strokeStyle = 'rgba(59, 130, 246, 0.3)';
          ctx.lineWidth = 20;
          ctx.stroke();
        }
        
        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animateFrame);
        } else {
          // Animation continue après la construction
          let time = 0;
          const pulse = () => {
            if (!canvas) return;
            time += 0.02;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            points.forEach((point) => {
              if (point.type === 'grid') {
                ctx.beginPath();
                ctx.arc(point.x, point.y, 2, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(59, 130, 246, ${0.3 + Math.sin(time) * 0.1})`;
                ctx.fill();
                
                const connectedPoint = points.find(p => 
                  (p.x === point.x + 50 && p.y === point.y) || 
                  (p.x === point.x && p.y === point.y + 50)
                );
                if (connectedPoint) {
                  ctx.beginPath();
                  ctx.moveTo(point.x, point.y);
                  ctx.lineTo(connectedPoint.x, connectedPoint.y);
                  ctx.strokeStyle = `rgba(59, 130, 246, ${0.5 + Math.sin(time) * 0.2})`;
                  ctx.stroke();
                }
              } else if (point.type === 'marker') {
                const pulseSize = point.size + Math.sin(time * 2) * 1;
                ctx.beginPath();
                ctx.arc(point.x, point.y, pulseSize, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(59, 130, 246, ${0.8 + Math.sin(time) * 0.2})`;
                ctx.fill();
                ctx.beginPath();
                ctx.arc(point.x, point.y, pulseSize * 1.5, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(59, 130, 246, ${0.2 + Math.sin(time) * 0.1})`;
                ctx.fill();
              }
            });
            
            animationRef.current = requestAnimationFrame(pulse);
          };
          pulse();
        }
      };
      
      animationRef.current = requestAnimationFrame(animateFrame);
    };
    
    animate(performance.now());
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <div className="relative min-h-[calc(100vh-10rem)] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-hidden">
      {/* Background avec effet de mouvement */}
      <div className="absolute inset-0">
        {/* <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3Cpattern id='grid' width='60' height='60' patternUnits='userSpaceOnUse'%3E%3Cpath d="M 60 0 L 0 0 0 60" fill="none" stroke="rgba(59,130,246,0.1)" stroke-width="1"/%3E%3C/pattern%3E%3C/defs%3E%3Crect width="100%25" height="100%25" fill="url(%23grid)"/%3E%3C/svg%3E')] opacity-20" /> */}
        <div className="absolute inset-0 bg-gradient-radial from-transparent via-transparent to-slate-900/50" />
      </div>

      {/* Canvas pour l'animation de la carte */}
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] opacity-70 pointer-events-none"
      />

      {/* Contenu principal */}
      <div className="relative z-10 flex items-center justify-center min-h-[calc(100vh-10rem)]">
        <div className="max-w-2xl mx-4">
          {/* Badge de statut */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 backdrop-blur-sm mb-6">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-sm font-mono text-primary">BUILDING_IN_PROGRESS</span>
            </div>
          </div>

          {/* Titre principal avec effet de glitch */}
          <div className="text-center mb-6 relative">
            <h1 className="text-6xl md:text-7xl font-bold mb-4 relative">
              <span className="absolute inset-0 text-primary blur-sm opacity-70 animate-pulse">
                Interactive Map
              </span>
              <span className="relative bg-gradient-to-r from-white via-primary to-white bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient">
                Interactive Map
              </span>
            </h1>
            <div className="relative">
              <p className="text-xl text-slate-300 font-mono">
                {buildProgress < 100 ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="animate-pulse">⧗</span>
                    Initializing geospatial engine...
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <span>✨</span>
                    System ready for launch
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Barre de progression style terminal */}
          <div className="mb-8 bg-black/50 rounded-lg p-4 border border-primary/20 backdrop-blur-sm">
            <div className="flex justify-between text-xs font-mono text-primary mb-2">
              <span>BUILD_PROGRESS</span>
              <span>{buildProgress}%</span>
            </div>
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-primary via-primary/70 to-primary/30 rounded-full transition-all duration-300 relative"
                style={{ width: `${buildProgress}%` }}
              >
                <div className="absolute inset-0 bg-white/20 animate-shimmer" />
              </div>
            </div>
            <div className="flex justify-between text-xs text-slate-500 font-mono mt-2">
              <span>⟳ Loading modules...</span>
              <span>{buildProgress === 100 ? '✓ Complete' : '⧗ Processing'}</span>
            </div>
          </div>

          {/* Features avec animation staggered */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { icon: Map, label: "3D Terrain", status: "loading" },
              { icon: Compass, label: "Real-time", status: "loading" },
              { icon: Layers, label: "Layers", status: "loading" },
              { icon: Globe2, label: "Global View", status: "loading" }
            ].map((feature, i) => (
              <div
                key={i}
                className="group relative p-4 rounded-lg bg-slate-800/50 border border-slate-700 backdrop-blur-sm overflow-hidden hover:border-primary/50 transition-all duration-300"
                style={{
                  animation: `fadeInUp 0.5s ease-out ${i * 0.1}s forwards`,
                  opacity: 0,
                  transform: 'translateY(20px)'
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/5 to-primary/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                <feature.icon className="w-6 h-6 text-primary mb-2" />
                <p className="text-sm font-mono text-slate-300">{feature.label}</p>
                <div className="flex items-center gap-1 mt-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  <span className="text-xs text-slate-500 font-mono">initializing</span>
                </div>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-4">
            <button
              onClick={() => router.back()}
              className="group flex-1 relative px-6 py-3 rounded-lg bg-slate-800/50 border border-slate-700 hover:border-primary/50 transition-all duration-300 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/5 to-primary/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
              <span className="relative flex items-center justify-center gap-2 text-slate-300 font-mono">
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                RETURN
              </span>
            </button>

            <button
              onClick={() => {
                setIsNotifying(true);
                setTimeout(() => setIsNotifying(false), 3000);
              }}
              className="group flex-1 relative px-6 py-3 rounded-lg bg-primary hover:bg-primary/90 transition-all duration-300 overflow-hidden"
            >
              <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
              <span className="relative flex items-center justify-center gap-2 text-white font-mono">
                <Bell className="w-4 h-4 group-hover:animate-bell" />
                NOTIFY_ME
              </span>
            </button>
          </div>

          {/* Terminal message */}
          <div className="mt-8 text-center">
            <p className="text-xs font-mono text-slate-500">
              <span className="text-primary">$</span> waiting_for_deployment... 
              <span className="animate-pulse inline-block w-1 h-3 bg-primary ml-1" />
            </p>
          </div>
        </div>
      </div>

      {/* Notification toast */}
      {isNotifying && (
        <div className="fixed bottom-8 right-8 animate-slide-up">
          <div className="bg-primary/90 backdrop-blur-sm rounded-lg px-4 py-3 shadow-2xl border border-primary/30">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
              <span className="text-white text-sm font-mono">
                ✓ Notification registered for launch
              </span>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes gradient {
          0%, 100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }
        
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
        
        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes bell {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(15deg); }
          75% { transform: rotate(-15deg); }
        }
        
        .animate-gradient {
          animation: gradient 3s ease infinite;
        }
        
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
        
        .animate-slide-up {
          animation: slide-up 0.3s ease-out forwards;
        }
        
        .group:hover .animate-bell {
          animation: bell 0.5s ease-in-out;
        }
        
        .bg-gradient-radial {
          background-image: radial-gradient(circle at center, transparent 0%, rgba(15, 23, 42, 0.8) 100%);
        }
      `}</style>
    </div>
  );
}
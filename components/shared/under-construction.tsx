"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface UnderConstructionProps {
  title?: string;
  description?: string;
  message?: string;
  className?: string;
  showProgress?: boolean;
  progressSpeed?: number; // en millisecondes
  icon?: React.ReactNode;
}

export function UnderConstruction({
  title = "En développement",
  description = "Cette fonctionnalité arrive bientôt",
  message = "Construction en cours",
  className,
  showProgress = true,
  progressSpeed = 30,
  icon,
}: UnderConstructionProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!showProgress) return;
    
    const timer = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) return 100;
        return prev + 2;
      });
    }, progressSpeed);
    
    return () => clearInterval(timer);
  }, [showProgress, progressSpeed]);

  return (
    <div className={cn(
      "min-h-[calc(100vh-10rem)] flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900",
      className
    )}>
      <div className="text-center max-w-md mx-4">
        {/* Animation de chargement */}
        <div className="relative mx-auto w-32 h-32 mb-8">
          <div className="absolute inset-0 rounded-full border-4 border-slate-200 dark:border-slate-700" />
          <div 
            className="absolute inset-0 rounded-full border-4 border-blue-500 border-t-transparent animate-spin"
            style={{ animationDuration: "1s" }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            {icon ? (
              <div className="text-blue-500">
                {icon}
              </div>
            ) : (
              <div className="w-16 h-16 bg-blue-500/10 rounded-full animate-pulse" />
            )}
          </div>
        </div>

        {/* Titre */}
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-3">
          {title}
        </h1>
        
        <p className="text-slate-500 dark:text-slate-400 mb-6">
          {description}
        </p>

        {/* Barre de progression */}
        {showProgress && (
          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 mb-4 overflow-hidden">
            <div 
              className="bg-blue-500 h-full rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {/* Point de statut animé */}
        <div className="flex items-center justify-center gap-2 mt-8">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
          <span className="text-xs text-slate-400">{message}</span>
        </div>
      </div>
    </div>
  );
}
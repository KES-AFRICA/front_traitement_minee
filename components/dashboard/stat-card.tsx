// components/dashboard/stat-card.tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: LucideIcon;
  className?: string;
  variant?: "default" | "primary" | "success" | "warning" | "destructive";
  total?: number;
}

const variantStyles = {
  default: "bg-card border-border/50",
  primary: "bg-gradient-to-br from-primary/5 via-primary/2 to-transparent border-primary/20",
  success: "bg-gradient-to-br from-emerald-500/5 via-emerald-500/2 to-transparent border-emerald-500/20",
  warning: "bg-gradient-to-br from-amber-500/5 via-amber-500/2 to-transparent border-amber-500/20",
  destructive: "bg-gradient-to-br from-red-500/5 via-red-500/2 to-transparent border-red-500/20",
};

const iconStyles = {
  default: "bg-muted/50 text-muted-foreground",
  primary: "bg-primary/10 text-primary",
  success: "bg-emerald-500/10 text-emerald-500",
  warning: "bg-amber-500/10 text-amber-500",
  destructive: "bg-red-500/10 text-red-500",
};

export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  className,
  variant = "default",
  total,
}: StatCardProps) {
  return (
    <Card 
      className={cn(
        variantStyles[variant], 
        "overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5",
        className
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </CardTitle>
        {Icon && (
          <div className={cn(
            "p-2 rounded-xl transition-transform duration-300",
            iconStyles[variant]
          )}>
            <Icon className="h-4 w-4" />
          </div>
        )}
      </CardHeader>
      
      <CardContent>
        <div className="text-3xl font-bold tracking-tight">
          {typeof value === "number" ? value.toLocaleString() : value}
        </div>
        
        {description && (
          <p className="text-xs text-muted-foreground mt-1">
            {description}
          </p>
        )}
        
        {total !== undefined && total > 0 && (
          <div className="flex items-center gap-1 mt-2">
            <span className="text-xs text-muted-foreground">
              sur {total.toLocaleString()}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
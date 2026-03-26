"use client";

import { ChevronRight, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface BreadcrumbItem {
  id: string;
  label: string;
  type: "home" | "region" | "zone" | "departure";
}

interface NavigationBreadcrumbProps {
  items: BreadcrumbItem[];
  onNavigate: (item: BreadcrumbItem) => void;
}

export function NavigationBreadcrumb({ items, onNavigate }: NavigationBreadcrumbProps) {
  return (
    <nav className="flex items-center gap-1 text-sm">
      {items.map((item, index) => (
        <div key={item.id} className="flex items-center">
          {index > 0 && <ChevronRight className="h-4 w-4 text-muted-foreground mx-1" />}
          <Button
            variant="ghost"
            size="sm"
            className={`h-auto py-1 px-2 ${index === items.length - 1 ? "font-semibold text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => onNavigate(item)}
            disabled={index === items.length - 1}
          >
            {item.type === "home" && <Home className="h-4 w-4 mr-1" />}
            {item.label}
          </Button>
        </div>
      ))}
    </nav>
  );
}
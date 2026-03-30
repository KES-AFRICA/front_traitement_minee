"use client";

import { useI18n } from "@/lib/i18n/context";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { LanguageSwitch } from "@/components/shared/language-switch";
import { NotificationDropdown } from "@/components/shared/notification-dropdown";
import { usePathname, useSearchParams } from "next/navigation";
import React from "react";

// Structure hiérarchique des pages statiques
const routeConfig: Record<string, { label: string; href: string; parent?: string }> = {
  // Distribution
  "distribution": { label: "Distribution", href: "/distribution" },
  "distribution-processing": { label: "Traitements", href: "/distribution/processing", parent: "distribution" },
  "distribution-processing-departs": { label: "Départs", href: "/distribution/processing/departs", parent: "distribution-processing" },
  "distribution-validation": { label: "Validation", href: "/distribution/validation", parent: "distribution" },
  "distribution-validation-departs": { label: "Départs", href: "/distribution/validation/departs", parent: "distribution-validation" },
  
  // Commercial
  "commercial": { label: "Commercial", href: "/commercial" },
  "commercial-processing": { label: "Traitement", href: "/commercial/processing", parent: "commercial" },
  "/commercial/processing/verifications": { label: "Vérifications", href: "/commercial/processing/verifications", parent: "commercial-processing" },
  "/commercial/processing/complex": { label: "Cas complexes", href: "/commercial/processing/complex", parent: "commercial-processing" },
  "/commercial/processing/rejets": { label: "Rejets", href: "/commercial/processing/rejets", parent: "commercial-processing" },
  "/commercial/validation": { label: "Validation", href: "/commercial/validation", parent: "commercial" },
  
  // Pages communes
  "/dashboard": { label: "Tableau de bord", href: "/dashboard" },
  "/users": { label: "Utilisateurs", href: "/users" },
  "/notifications": { label: "Notifications", href: "/notifications" },
  "/map": { label: "Carte", href: "/map" },
  "/settings": { label: "Paramètres", href: "/settings" },
  "/profile": { label: "Profil", href: "/profile" },
};

function getBreadcrumbPath(pathname: string, searchParams: URLSearchParams): { label: string; href: string }[] {
  // Gestion des routes dynamiques pour /distribution/processing/feeder/[id]
  const processingFeederPattern = /^\/distribution\/processing\/feeder\/([^/]+)$/;
  const processingMatch = pathname.match(processingFeederPattern);
  
  if (processingMatch) {
    const feederId = processingMatch[1];
    const feederName = searchParams.get('name') || feederId;
    
    return [
      { label: "Distribution", href: "/distribution" },
      { label: "Traitements", href: "/distribution/processing" },
      { label: "Départs", href: "/distribution/processing/departs" },
      { label: decodeURIComponent(feederName), href: pathname }
    ];
  }
  
  // Gestion des routes dynamiques pour /distribution/validation/feeder/[id]
  const validationFeederPattern = /^\/distribution\/validation\/feeder\/([^/]+)$/;
  const validationMatch = pathname.match(validationFeederPattern);
  
  if (validationMatch) {
    const feederId = validationMatch[1];
    const feederName = searchParams.get('name') || feederId;
    
    return [
      { label: "Distribution", href: "/distribution" },
      { label: "Validation", href: "/distribution/validation" },
      { label: "Départs", href: "/distribution/validation/departs" },
      { label: decodeURIComponent(feederName), href: pathname }
    ];
  }
  
  // Gestion de la liste des départs en traitement
  if (pathname === "/distribution/processing/departs") {
    return [
      { label: "Distribution", href: "/distribution" },
      { label: "Traitements", href: "/distribution/processing" },
      { label: "Départs", href: "/distribution/processing/departs" }
    ];
  }
  
  // Gestion de la liste des départs en validation
  if (pathname === "/distribution/validation/departs") {
    return [
      { label: "Distribution", href: "/distribution" },
      { label: "Validation", href: "/distribution/validation" },
      { label: "Départs", href: "/distribution/validation/departs" }
    ];
  }
  
  // Gestion de la page de traitement
  if (pathname === "/distribution/processing") {
    return [
      { label: "Distribution", href: "/distribution" },
      { label: "Traitements", href: "/distribution/processing" }
    ];
  }
  
  // Gestion de la page de validation
  if (pathname === "/distribution/validation") {
    return [
      { label: "Distribution", href: "/distribution" },
      { label: "Validation", href: "/distribution/validation" }
    ];
  }
  
  // Routes statiques
  const current = routeConfig[pathname];
  if (!current) return [];
  
  const path: { label: string; href: string }[] = [];
  let item = current;
  
  while (item) {
    path.unshift({ label: item.label, href: item.href });
    if (item.parent) {
      item = routeConfig[item.parent];
    } else {
      break;
    }
  }
  
  return path;
}

export function AppHeader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  
  // Utiliser useMemo pour recalculer le breadcrumb quand pathname ou searchParams change
  const breadcrumbItems = React.useMemo(() => {
    return getBreadcrumbPath(pathname, searchParams);
  }, [pathname, searchParams]);

  return (
    <header className="flex h-14 items-center justify-between gap-4 border-b border-border bg-background px-4 lg:px-6">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb className="hidden md:flex">
          <BreadcrumbList>
            {breadcrumbItems.length > 0 ? (
              breadcrumbItems.map((item, index) => (
                <React.Fragment key={item.href}>
                  <BreadcrumbItem>
                    {index === breadcrumbItems.length - 1 ? (
                      <BreadcrumbPage>{item.label}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink href={item.href}>{item.label}</BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                  {index < breadcrumbItems.length - 1 && <BreadcrumbSeparator />}
                </React.Fragment>
              ))
            ) : (
              <BreadcrumbItem>
                <BreadcrumbPage>{t("nav.dashboard")}</BreadcrumbPage>
              </BreadcrumbItem>
            )}
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <div className="flex items-center gap-2">
        <NotificationDropdown />
        <LanguageSwitch />
        <ThemeToggle />
      </div>
    </header>
  );
}
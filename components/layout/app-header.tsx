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
import { usePathname } from "next/navigation";

// Structure hiérarchique des pages
const routeConfig: Record<string, { label: string; href: string; parent?: string }> = {
  // Distribution
  "distribution": { label: "Distribution", href: "/distribution" },
  "distribution-processing": { label: "Traitement", href: "/distribution/processing", parent: "distribution" },
  "/distribution/processing/duplicates": { label: "Doublons", href: "/distribution/processing/duplicates", parent: "distribution-processing" },
  "/distribution/processing/differences": { label: "Divergences", href: "/distribution/processing/differences", parent: "distribution-processing" },
  "/distribution/processing/new-kobo": { label: "Nouvelles données", href: "/distribution/processing/new-kobo", parent: "distribution-processing" },
  "/distribution/processing/missing-eneo": { label: "Manquants", href: "/distribution/processing/missing-eneo", parent: "distribution-processing" },
  "/distribution/processing/complex": { label: "Cas complexes", href: "/distribution/processing/complex", parent: "distribution-processing" },
  "/distribution/validation": { label: "Validation", href: "/distribution/validation", parent: "distribution" },
  
  // Commercial
  "commercial": { label: "Commercial", href: "/commercial" },
  "commercial-processing": { label: "Traitement", href: "/commercial/processing", parent: "commercial" },
  "/commercial/processing/verifications": { label: "Vérifications", href: "/commercial/processing/verifications", parent: "commercial-processing" },
  "/commercial/processing/complex": { label: "Cas complexes", href: "/commercial/processing/complex", parent: "commercial-processing" },
  "/commercial/processing/rejets": { label: "Rejets", href: "/commercial/processing/rejets", parent: "commercial-processing" },
  "/commercial/validation": { label: "Validation", href: "/commercial/validation", parent: "commercial" },
  
  // Génie civil
  "genie-civil": { label: "Génie civil", href: "/genie-civil" },
  "genie-civil-processing": { label: "Traitement", href: "/genie-civil/processing", parent: "genie-civil" },
  "/genie-civil/processing/verifications": { label: "Vérifications", href: "/genie-civil/processing/verifications", parent: "genie-civil-processing" },
  "/genie-civil/processing/complex": { label: "Cas complexes", href: "/genie-civil/processing/complex", parent: "genie-civil-processing" },
  "/genie-civil/processing/rejets": { label: "Rejets", href: "/genie-civil/processing/rejets", parent: "genie-civil-processing" },
  "/genie-civil/validation": { label: "Validation", href: "/genie-civil/validation", parent: "genie-civil" },
  
  // Pages communes
  "/dashboard": { label: "Tableau de bord", href: "/dashboard" },
  "/users": { label: "Utilisateurs", href: "/users" },
  "/notifications": { label: "Notifications", href: "/notifications" },
  "/map": { label: "Carte", href: "/map" },
  "/settings": { label: "Paramètres", href: "/settings" },
  "/profile": { label: "Profil", href: "/profile" },
};

function getBreadcrumbPath(pathname: string): { label: string; href: string }[] {
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
  const { t } = useI18n();
  const breadcrumbItems = getBreadcrumbPath(pathname);

  return (
    <header className="flex h-14 items-center justify-between gap-4 border-b border-border bg-background px-4 lg:px-6">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            {breadcrumbItems.length > 0 ? (
              breadcrumbItems.map((item, index) => (
                <BreadcrumbItem key={item.href}>
                  {index === breadcrumbItems.length - 1 ? (
                    <BreadcrumbPage>{item.label}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink href={item.href}>{item.label}</BreadcrumbLink>
                  )}
                  {index < breadcrumbItems.length - 1 && <BreadcrumbSeparator />}
                </BreadcrumbItem>
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
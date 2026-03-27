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

// Structure hiérarchique complète des pages
interface BreadcrumbItem {
  key: string;           // Clé de traduction
  href: string;          // Lien
  parent?: string;       // ID du parent (référence à une autre clé)
}

const breadcrumbHierarchy: Record<string, BreadcrumbItem> = {
  // Racines des sections principales
  "distribution": { key: "nav.distribution", href: "/distribution" },
  "commercial": { key: "nav.commercial", href: "/commercial" },
  "genie-civil": { key: "nav.genieCivil", href: "/genie-civil" },
  
  // Sous-sections communes
  "processing": { key: "nav.processing", href: "/processing", parent: "distribution" },
  "validation": { key: "nav.validation", href: "/validation", parent: "distribution" },
  
  // Pages de traitement
  "/processing/duplicates": { 
    key: "nav.duplicates", 
    href: "/processing/duplicates", 
    parent: "processing" 
  },
  "/processing/differences": { 
    key: "nav.differences", 
    href: "/processing/differences", 
    parent: "processing" 
  },
  "/processing/new-kobo": { 
    key: "nav.newKobo", 
    href: "/processing/new-kobo", 
    parent: "processing" 
  },
  "/processing/missing-eneo": { 
    key: "nav.missingEneo", 
    href: "/processing/missing-eneo", 
    parent: "processing" 
  },
  "/processing/complex": { 
    key: "nav.complexCases", 
    href: "/processing/complex", 
    parent: "processing" 
  },
  
  // Autres pages sans parent direct
  "/dashboard": { key: "nav.dashboard", href: "/dashboard" },
  "/validation": { key: "nav.validation", href: "/validation", parent: "distribution" },
  "/users": { key: "nav.users", href: "/users" },
  "/map": { key: "nav.map", href: "/map" },
  "/notifications": { key: "nav.notifications", href: "/notifications" },
  "/settings": { key: "nav.settings", href: "/settings" },
  "/profile": { key: "nav.profile", href: "/profile" },
  "/performance": { key: "nav.performance", href: "/performance" },
};

// Fonction pour construire le chemin complet du breadcrumb
function getBreadcrumbPath(pathname: string): BreadcrumbItem[] {
  const current = breadcrumbHierarchy[pathname];
  if (!current) return [];
  
  const path: BreadcrumbItem[] = [];
  let item: BreadcrumbItem | undefined = current;
  
  // Remonter la hiérarchie jusqu'à la racine
  while (item) {
    path.unshift(item);
    if (item.parent) {
      item = breadcrumbHierarchy[item.parent];
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

  // Si aucun breadcrumb trouvé, afficher juste le dashboard par défaut
  if (breadcrumbItems.length === 0) {
    return (
      <header className="flex h-14 items-center justify-between gap-4 border-b border-border bg-background px-4 lg:px-6">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>{t("nav.dashboard")}</BreadcrumbPage>
              </BreadcrumbItem>
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

  return (
    <header className="flex h-14 items-center justify-between gap-4 border-b border-border bg-background px-4 lg:px-6">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            {breadcrumbItems.map((item, index) => (
              <BreadcrumbItem key={item.href}>
                {index === breadcrumbItems.length - 1 ? (
                  <BreadcrumbPage>
                    {t(item.key as Parameters<typeof t>[0])}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink href={item.href}>
                    {t(item.key as Parameters<typeof t>[0])}
                  </BreadcrumbLink>
                )}
                {index < breadcrumbItems.length - 1 && (
                  <BreadcrumbSeparator />
                )}
              </BreadcrumbItem>
            ))}
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
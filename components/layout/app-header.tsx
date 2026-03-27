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

const pathTitles: Record<string, { key: string; parent?: string }> = {
  "/dashboard": { key: "nav.dashboard" },
  "/processing": { key: "nav.processing" },
  "/processing/duplicates": { key: "nav.duplicates", parent: "/processing" },
  "/processing/differences": { key: "nav.differences", parent: "/processing" },
  "/processing/new-kobo": { key: "nav.newKobo", parent: "/processing" },
  "/processing/missing-eneo": { key: "nav.missingEneo", parent: "/processing" },
  "/processing/complex": { key: "nav.complexCases", parent: "/processing" },
  "/validation": { key: "nav.validation" },
  "/users": { key: "nav.users" },
  "/notifications": { key: "nav.notifications" },
  "/map": { key: "nav.map" },
  "/performance": { key: "nav.performance" },
  "/settings": { key: "nav.settings" },
  "/profile": { key: "nav.profile" },
};

export function AppHeader() {
  const pathname = usePathname();
  const { t } = useI18n();

  const currentPath = pathTitles[pathname];
  const parentPath = currentPath?.parent ? pathTitles[currentPath.parent] : null;

  return (
    <header className="flex h-14 items-center justify-between gap-4 border-b border-border bg-background px-4 lg:px-6">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            {parentPath && currentPath?.parent && (
              <>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href={currentPath.parent}>
                    {t(parentPath.key as Parameters<typeof t>[0])}
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
              </>
            )}
            <BreadcrumbItem>
              <BreadcrumbPage>
                {currentPath ? t(currentPath.key as Parameters<typeof t>[0]) : t("nav.dashboard")}
              </BreadcrumbPage>
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
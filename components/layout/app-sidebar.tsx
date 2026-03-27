"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth/context";
import { useI18n } from "@/lib/i18n/context";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard,
  Database,
  CheckSquare,
  Users,
  Map,
  Settings,
  LogOut,
  ChevronRight,
  FileX,
  User,
  AlertCircle,
  Bell,
  DollarSign,
  Building2,
  Bolt,
  Copy,
  GitCompare,
  FilePlus,
  Zap,
} from "lucide-react";
import { LucideIcon } from "lucide-react";

// Définition des types
type SubSubMenuItem = {
  title: string;
  url: string;
  icon: LucideIcon;
};

type SubMenuItem = {
  title: string;
  icon: LucideIcon;
  url?: string;
  permission?: string;
  items?: SubSubMenuItem[];
};

type SectionDropdownItem = {
  title: string;
  icon: LucideIcon;
  type: "section-dropdown";
  color: string;
  bgColor: string;
  borderColor: string;
  items: SubMenuItem[];
};

type SimpleMenuItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  permission?: string;
  type?: never;
  color?: never;
  bgColor?: never;
  borderColor?: never;
  items?: never;
};

type NavItem = SimpleMenuItem | SectionDropdownItem;

const roleLabels: Record<string, string> = {
  admin: "Administrateur",
  team_lead: "Chef d'équipe",
  validation_agent: "Agent de validation",
  processing_agent: "Agent de traitement",
};

// Fonction pour récupérer le nombre de notifications non lues
// À adapter selon votre source de données réelle
function useUnreadNotificationsCount() {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    // Simuler la récupération du nombre de notifications non lues
    // À remplacer par un appel API réel
    const fetchUnreadCount = async () => {
      try {
        // Simulation d'un appel API
        // Dans la réalité, vous feriez : const response = await notificationService.getUnreadCount();
        const mockUnreadCount = 3; // À remplacer par les données réelles
        setCount(mockUnreadCount);
      } catch (error) {
        console.error("Erreur lors de la récupération des notifications:", error);
      }
    };
    
    fetchUnreadCount();
    
    // Optionnel: écouter les mises à jour en temps réel (WebSocket, polling, etc.)
    const interval = setInterval(fetchUnreadCount, 30000); // Rafraîchir toutes les 30 secondes
    
    return () => clearInterval(interval);
  }, []);
  
  return count;
}

export function AppSidebar() {
  const pathname = usePathname();
  const { user, logout, hasPermission } = useAuth();
  const { t } = useI18n();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const unreadNotificationsCount = useUnreadNotificationsCount();

  const mainNavItems: NavItem[] = [
    {
      title: t("nav.dashboard"),
      url: "/dashboard",
      icon: LayoutDashboard,
      permission: "view:dashboard",
    },
    {
      title: "Distribution",
      icon: Zap,
      type: "section-dropdown",
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
      borderColor: "border-l-blue-500",
      items: [
        {
          title: "Traitement",
          icon: Database,
          permission: "view:processing",
          items: [
            {
              title: t("nav.duplicates"),
              url: "/processing/duplicates",
              icon: Copy,
            },
            {
              title: t("nav.differences"),
              url: "/processing/differences",
              icon: GitCompare,
            },
            {
              title: t("nav.newKobo"),
              url: "/processing/new-kobo",
              icon: FilePlus,
            },
            {
              title: t("nav.missingEneo"),
              url: "/processing/missing-eneo",
              icon: FileX,
            },
            {
              title: t("nav.complexCases"),
              url: "/processing/complex",
              icon: AlertCircle,
            },
          ],
        },
        {
          title: t("nav.validation"),
          url: "/validation",
          icon: CheckSquare,
          permission: "view:validation",
        },
      ],
    },
    {
      title: "Commercial",
      icon: DollarSign,
      type: "section-dropdown",
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
      borderColor: "border-l-emerald-500",
      items: [
        {
          title: "Traitement",
          icon: Database,
          permission: "view:processing",
          items: [
            {
              title: "Vérifications",
              url: "/processing/duplicates",
              icon: CheckSquare,
            },
            {
              title: "Cas complexes",
              url: "/processing/complex",
              icon: AlertCircle,
            },
            {
              title: "Rejets",
              url: "/processing/missing-eneo",
              icon: FileX,
            },
          ],
        },
        {
          title: t("nav.validation"),
          url: "/validation",
          icon: CheckSquare,
          permission: "view:validation",
        },
      ],
    },
    {
      title: "Génie civil",
      icon: Building2,
      type: "section-dropdown",
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
      borderColor: "border-l-amber-500",
      items: [
        {
          title: "Traitement",
          icon: Database,
          permission: "view:processing",
          items: [
            {
              title: "Vérifications",
              url: "/processing/duplicates",
              icon: CheckSquare,
            },
            {
              title: "Cas complexes",
              url: "/processing/complex",
              icon: AlertCircle,
            },
            {
              title: "Rejets",
              url: "/processing/missing-eneo",
              icon: FileX,
            },
          ],
        },
        {
          title: t("nav.validation"),
          url: "/validation",
          icon: CheckSquare,
          permission: "view:validation",
        },
      ],
    },
    {
      title: t("nav.users"),
      url: "/users",
      icon: Users,
      permission: "view:users",
    },
    {
      title: t("nav.notifications"),
      url: "/notifications",
      icon: Bell,
      // Pas de permission spécifique pour les notifications
    },
    {
      title: t("nav.map"),
      url: "/map",
      icon: Map,
      permission: "view:map",
    },
  ];

  const filteredNavItems = mainNavItems
    .map((item): NavItem | null => {
      if (item.type === "section-dropdown") {
        const filteredItems = item.items
          .map((subItem): SubMenuItem | null => {
            if (subItem.items) {
              const filteredSubItems = subItem.items.filter(
                (subSubItem) => !subItem.permission || hasPermission(subItem.permission)
              );
              if (filteredSubItems.length === 0) return null;
              return {
                ...subItem,
                items: filteredSubItems,
              };
            }
            if (!subItem.permission || hasPermission(subItem.permission)) {
              return subItem;
            }
            return null;
          })
          .filter((subItem): subItem is SubMenuItem => subItem !== null);

        if (filteredItems.length === 0) return null;
        return {
          ...item,
          items: filteredItems,
        };
      }
      if (!item.permission || hasPermission(item.permission)) {
        return item;
      }
      return null;
    })
    .filter((item): item is NavItem => item !== null);

  const getInitials = (firstName?: string, lastName?: string) => {
    return `${firstName?.charAt(0) || ""}${lastName?.charAt(0) || ""}`.toUpperCase();
  };

  const isSectionDropdown = (item: NavItem): item is SectionDropdownItem => {
    return item.type === "section-dropdown";
  };

  return (
    <Sidebar collapsible="icon" className="border-sidebar-border">
      {/* Header */}
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="font-bold text-sidebar-foreground">TADEC</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarSeparator />

      {/* Main Navigation */}
      <SidebarContent className="overflow-y-auto flex-1 min-h-0">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="pb-4">
              {filteredNavItems.map((item) => {
                // Gestion des sections dropdown (Distribution, Commercial, Génie civil)
                if (isSectionDropdown(item)) {
                  return (
                    <Collapsible
                      key={item.title}
                      asChild
                      defaultOpen={false}
                      className="group/collapsible mb-2"
                    >
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton
                            tooltip={item.title}
                            className={`transition-all duration-200 ${item.bgColor} hover:${item.bgColor}`}
                          >
                            <item.icon className={`w-4 h-4 shrink-0 ${item.color}`} />
                            <span className="font-medium truncate flex-1 text-left">{item.title}</span>
                            <ChevronRight className="ml-auto h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub className="ml-2 border-l border-sidebar-border pl-2 space-y-1">
                            {item.items.map((subItem) => {
                              if (subItem.items) {
                                return (
                                  <Collapsible
                                    key={subItem.title}
                                    asChild
                                    defaultOpen={false}
                                    className="group/sub-collapsible"
                                  >
                                    <SidebarMenuSubItem>
                                      <CollapsibleTrigger asChild>
                                        <SidebarMenuSubButton
                                          className="w-full justify-between hover:bg-sidebar-accent/50 px-2 py-1.5"
                                        >
                                          <div className="flex items-center gap-2 min-w-0 flex-1">
                                            <subItem.icon className="w-4 h-4 shrink-0" />
                                            <span className="truncate">{subItem.title}</span>
                                          </div>
                                          <ChevronRight className="h-3 w-3 shrink-0 transition-transform duration-200 group-data-[state=open]/sub-collapsible:rotate-90" />
                                        </SidebarMenuSubButton>
                                      </CollapsibleTrigger>
                                      <CollapsibleContent>
                                        <SidebarMenuSub className="ml-4 space-y-1">
                                          {subItem.items.map((subSubItem) => (
                                            <SidebarMenuSubItem key={subSubItem.url}>
                                              <SidebarMenuSubButton
                                                asChild
                                                isActive={pathname === subSubItem.url}
                                                className={`transition-colors px-2 py-1.5 ${
                                                  pathname === subSubItem.url
                                                    ? `${item.bgColor} ${item.borderColor} border-l-2`
                                                    : ""
                                                }`}
                                              >
                                                <Link href={subSubItem.url} className="min-w-0">
                                                  <subSubItem.icon className="w-4 h-4 shrink-0" />
                                                  <span className="truncate">{subSubItem.title}</span>
                                                </Link>
                                              </SidebarMenuSubButton>
                                            </SidebarMenuSubItem>
                                          ))}
                                        </SidebarMenuSub>
                                      </CollapsibleContent>
                                    </SidebarMenuSubItem>
                                  </Collapsible>
                                );
                              }
                              return (
                                <SidebarMenuSubItem key={subItem.url}>
                                  <SidebarMenuSubButton
                                    asChild
                                    isActive={pathname === subItem.url}
                                    className={`transition-colors px-2 py-1.5 ${
                                      pathname === subItem.url
                                        ? `${item.bgColor} ${item.borderColor} border-l-2`
                                        : ""
                                    }`}
                                  >
                                    <Link href={subItem.url!} className="min-w-0">
                                      <subItem.icon className="w-4 h-4 shrink-0" />
                                      <span className="truncate">{subItem.title}</span>
                                    </Link>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              );
                            })}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  );
                }

                // Gestion des éléments simples (Dashboard, Users, Notifications, Map)
                // Pour l'élément Notifications, on ajoute un badge avec le nombre de notifications non lues
                const isNotifications = item.title === t("nav.notifications");
                
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={pathname === item.url} tooltip={item.title}>
                      <Link href={item.url} className="relative">
                        <item.icon className="w-4 h-4 shrink-0" />
                        <span className="truncate">{item.title}</span>
                        {isNotifications && unreadNotificationsCount > 0 && (
                          <Badge 
                            variant="destructive" 
                            className="absolute top-2 right-2 h-5 min-w-5 px-1 flex items-center justify-center rounded-full text-[10px] font-bold"
                          >
                            {unreadNotificationsCount > 99 ? "99+" : unreadNotificationsCount}
                          </Badge>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarSeparator />

      {/* Footer - User Menu */}
      <SidebarFooter className="p-2 shrink-0">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="w-full"
                  tooltip={user?.firstName || "User"}
                >
                  <Avatar className="h-8 w-8 rounded-lg shrink-0">
                    <AvatarFallback className="rounded-lg bg-sidebar-primary/20 text-sidebar-primary text-xs">
                      {getInitials(user?.firstName, user?.lastName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col items-start text-left min-w-0 flex-1">
                    <span className="text-sm font-medium truncate w-full">
                      {user?.firstName} {user?.lastName}
                    </span>
                    <span className="text-xs text-sidebar-foreground/60 truncate w-full">
                      {user?.role && roleLabels[user.role]}
                    </span>
                  </div>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" side="right" sideOffset={8}>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">
                      {user?.firstName} {user?.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground">{user?.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/profile" className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    {t("nav.profile")}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    {t("nav.settings")}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  {t("auth.logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
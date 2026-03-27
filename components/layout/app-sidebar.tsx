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
import { cn } from "@/lib/utils";
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
  Copy,
  GitCompare,
  FilePlus,
  Zap,
  Eye,
  XCircle,
} from "lucide-react";

const roleLabels: Record<string, string> = {
  admin: "Administrateur",
  team_lead: "Chef d'équipe",
  validation_agent: "Agent de validation",
  processing_agent: "Agent de traitement",
};

const sectionColors: Record<string, { icon: string; bg: string }> = {
  Distribution: { icon: "text-blue-500", bg: "bg-blue-500/10" },
  Commercial: { icon: "text-emerald-500", bg: "bg-emerald-500/10" },
  "Génie civil": { icon: "text-amber-500", bg: "bg-amber-500/10" },
};

function useUnreadNotificationsCount() {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const mockUnreadCount = 3;
        setCount(mockUnreadCount);
      } catch (error) {
        console.error("Erreur:", error);
      }
    };
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);
  
  return count;
}

export function AppSidebar() {
  const pathname = usePathname();
  const { user, logout, hasPermission } = useAuth();
  const { t } = useI18n();
  const unreadNotificationsCount = useUnreadNotificationsCount();

  const mainNavItems = [
    {
      title: t("nav.dashboard"),
      url: "/dashboard",
      icon: LayoutDashboard,
      permission: "view:dashboard",
    },
    {
      title: "Distribution",
      icon: Zap,
      items: [
        {
          title: "Traitement",
          icon: Database,
          items: [
            { title: t("nav.duplicates"), url: "/distribution/processing/duplicates", icon: Copy },
            { title: t("nav.differences"), url: "/distribution/processing/differences", icon: GitCompare },
            { title: t("nav.newKobo"), url: "/distribution/processing/new-kobo", icon: FilePlus },
            { title: t("nav.missingEneo"), url: "/distribution/processing/missing-eneo", icon: FileX },
            { title: t("nav.complexCases"), url: "/distribution/processing/complex", icon: AlertCircle },
          ],
        },
        { title: t("nav.validation"), url: "/distribution/validation", icon: CheckSquare },
      ],
    },
    {
      title: "Commercial",
      icon: DollarSign,
      items: [
        {
          title: "Traitement",
          icon: Database,
          items: [
            { title: "Vérifications", url: "/commercial/processing/verifications", icon: Eye },
            { title: "Cas complexes", url: "/commercial/processing/complex", icon: AlertCircle },
            { title: "Rejets", url: "/commercial/processing/rejets", icon: XCircle },
          ],
        },
        { title: t("nav.validation"), url: "/commercial/validation", icon: CheckSquare },
      ],
    },
    {
      title: "Génie civil",
      icon: Building2,
      items: [
        {
          title: "Traitement",
          icon: Database,
          items: [
            { title: "Vérifications", url: "/genie-civil/processing/verifications", icon: Eye },
            { title: "Cas complexes", url: "/genie-civil/processing/complex", icon: AlertCircle },
            { title: "Rejets", url: "/genie-civil/processing/rejets", icon: XCircle },
          ],
        },
        { title: t("nav.validation"), url: "/genie-civil/validation", icon: CheckSquare },
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
    },
    {
      title: t("nav.map"),
      url: "/map",
      icon: Map,
      permission: "view:map",
    },
  ];

  const filteredNavItems = mainNavItems.filter(
    (item) => !item.permission || hasPermission(item.permission)
  );

  const getInitials = (firstName?: string, lastName?: string) => {
    return `${firstName?.charAt(0) || ""}${lastName?.charAt(0) || ""}`.toUpperCase();
  };

  const shouldBeOpen = (item: any) => {
    if (item.url && pathname === item.url) return true;
    if (item.items) {
      return item.items.some((sub: any) => {
        if (sub.url && pathname === sub.url) return true;
        if (sub.items) {
          return sub.items.some((subSub: any) => pathname === subSub.url);
        }
        return false;
      });
    }
    return false;
  };

  return (
    <Sidebar collapsible="icon" className="border-sidebar-border">
      <SidebarHeader className="p-4">
        <div className="flex flex-col group-data-[collapsible=icon]:hidden">
          <span className="font-bold text-sidebar-foreground">TADEC</span>
        </div>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent className="overflow-y-auto flex-1 min-h-0">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="pb-4">
              {filteredNavItems.map((item) => {
                if (item.items) {
                  const isOpen = shouldBeOpen(item);
                  const sectionColor = sectionColors[item.title];
                  
                  return (
                    <Collapsible key={item.title} asChild defaultOpen={isOpen} className="group/collapsible">
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton
                            tooltip={item.title}
                            className={cn(
                              sectionColor?.bg,
                            )}
                          >
                            <item.icon className={cn("w-4 h-4", sectionColor?.icon)} />
                            <span>{item.title}</span>
                            <ChevronRight className="ml-auto h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {item.items.map((subItem) => {
                              if (subItem.items) {
                                const isSubOpen = shouldBeOpen(subItem);
                                
                                return (
                                  <Collapsible key={subItem.title} asChild defaultOpen={isSubOpen} className="group/sub-collapsible">
                                    <SidebarMenuSubItem>
                                      <CollapsibleTrigger asChild>
                                        <SidebarMenuSubButton className="w-full justify-between">
                                          <div className="flex items-center gap-2">
                                            <subItem.icon className="w-4 h-4 shrink-0" />
                                            <span>{subItem.title}</span>
                                          </div>
                                          <ChevronRight className="h-3 w-3 shrink-0 transition-transform duration-200 group-data-[state=open]/sub-collapsible:rotate-90" />
                                        </SidebarMenuSubButton>
                                      </CollapsibleTrigger>
                                      <CollapsibleContent>
                                        <SidebarMenuSub className="ml-4 space-y-1">
                                          {subItem.items.map((subSubItem) => (
                                            <SidebarMenuSubItem key={subSubItem.url}>
                                              <SidebarMenuSubButton asChild isActive={pathname === subSubItem.url}>
                                                <Link href={subSubItem.url}>
                                                  <subSubItem.icon className="w-4 h-4" />
                                                  <span>{subSubItem.title}</span>
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
                                  <SidebarMenuSubButton asChild isActive={pathname === subItem.url}>
                                    <Link href={subItem.url!}>
                                      <subItem.icon className="w-4 h-4" />
                                      <span>{subItem.title}</span>
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

                const isNotifications = item.title === t("nav.notifications");
                
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={pathname === item.url} tooltip={item.title}>
                      <Link href={item.url!} className="relative">
                        <item.icon className="w-4 h-4" />
                        <span>{item.title}</span>
                        {isNotifications && unreadNotificationsCount > 0 && (
                          <Badge 
                            variant="destructive" 
                            className="absolute top-4 right-6 translate-x-1/2 -translate-y-1/2 h-5 min-w-5 px-1 flex items-center justify-center rounded-full text-[10px] font-bold"
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

      <SidebarFooter className="p-2 shrink-0">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" className="w-full" tooltip={user?.firstName || "User"}>
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
                    <p className="text-sm font-medium">{user?.firstName} {user?.lastName}</p>
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
                <DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive focus:text-destructive">
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
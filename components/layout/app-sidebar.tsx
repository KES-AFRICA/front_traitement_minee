"use client";

/**
 * ============================================================
 * TADEC — AppSidebar (v2 — RBAC centralisé)
 * ============================================================
 * La navigation est filtrée selon les permissions de l'utilisateur.
 * Chaque item/section n'apparaît que si l'utilisateur a la permission
 * correspondante.
 */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth/context";
import { useI18n } from "@/lib/i18n/context";
import { useNotificationContext } from "@/lib/context/notification-context";
import { PERMISSIONS } from "@/lib/auth/permissions";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard,
  CheckSquare,
  Users,
  Map,
  Settings,
  LogOut,
  ChevronRight,
  Bell,
  DollarSign,
  Zap,
  Eye,
  XCircle,
  AlertCircle,
  Wrench,
  ShieldCheck,
} from "lucide-react";
import { FeedersTree } from "../distribution/feeders-tree";
import { cn } from "@/lib/utils";

const roleLabels: Record<string, string> = {
  "Admin":             "Administrateur",
  'Chef équipe':         "Chef d'équipe",
  'Agent validation':  "Agent de validation",
  'Agent traitement':  "Agent de traitement",
};

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, hasPermission } = useAuth();
  const { t } = useI18n();
  const { unreadCount } = useNotificationContext();

  const [selectedFeederId, setSelectedFeederId] = useState<
    string | number | undefined
  >();
  const [openSection, setOpenSection] = useState<
    "distribution" | "commercial" | null
  >(null);

  // Ouverture automatique de la section active
  useEffect(() => {
    if (pathname.startsWith("/distribution")) setOpenSection("distribution");
    else if (pathname.startsWith("/commercial")) setOpenSection("commercial");
    else setOpenSection(null);
  }, [pathname]);

  // Lecture du feeder actif depuis l'URL
  useEffect(() => {
    const match = pathname.match(
      /\/distribution\/(processing|validation)\/feeder\/([^/]+)/
    );
    if (match) setSelectedFeederId(match[2]);
  }, [pathname]);

  const getInitials = (firstName?: string, lastName?: string) =>
    `${firstName?.charAt(0) || ""}${lastName?.charAt(0) || ""}`.toUpperCase();

  const isDistribProcessing = pathname.startsWith("/distribution/processing");
  const isDistribValidation = pathname.startsWith("/distribution/validation");

  // ── Calcul des permissions une seule fois ─────────────────────────────────
  const canViewDashboard   = hasPermission(PERMISSIONS.VIEW_DASHBOARD);
  const canViewDistrib     = hasPermission(PERMISSIONS.VIEW_DISTRIBUTION);
  const canViewProcessing  = hasPermission(PERMISSIONS.VIEW_PROCESSING);
  const canViewValidation  = hasPermission(PERMISSIONS.VIEW_VALIDATION);
  const canViewCommercial  = hasPermission(PERMISSIONS.VIEW_COMMERCIAL);
  const canViewUsers       = hasPermission(PERMISSIONS.VIEW_USERS);
  const canViewMap         = hasPermission(PERMISSIONS.VIEW_MAP);
  const canViewNotifs      = hasPermission(PERMISSIONS.VIEW_NOTIFICATIONS);

  return (
    <Sidebar collapsible="icon" className="border-sidebar-border">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <SidebarHeader className="p-4">
        <div className="flex flex-col group-data-[collapsible=icon]:hidden">
          <span className="font-bold text-sidebar-foreground tracking-tight">
            TADEC
          </span>
        </div>
      </SidebarHeader>

      <SidebarSeparator />

      {/* ── Navigation principale ────────────────────────────────────────── */}
      <SidebarContent className="overflow-y-auto flex-1 min-h-0">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="pb-2 gap-0.5">

              {/* Dashboard */}
              {canViewDashboard && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === "/dashboard"}
                    tooltip="Tableau de bord"
                    className="hover:bg-sidebar-accent/50"
                  >
                    <Link href="/dashboard">
                      <LayoutDashboard className="w-4 h-4" />
                      <span>{t("nav.dashboard")}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}

              {/* ── Distribution ────────────────────────────────────────── */}
              {canViewDistrib && (
                <SidebarMenuItem>
                  <Collapsible
                    asChild
                    open={openSection === "distribution"}
                    onOpenChange={(open) =>
                      setOpenSection(open ? "distribution" : null)
                    }
                    className="group/distrib"
                  >
                    <div>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton
                          tooltip="Distribution"
                          className={cn(
                            "hover:bg-sidebar-accent/50",
                            openSection === "distribution" && "bg-blue-500/10"
                          )}
                        >
                          <Zap className="w-4 h-4 text-blue-500" />
                          <span>Distribution</span>
                          <ChevronRight className="ml-auto h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]/distrib:rotate-90" />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>

                      <CollapsibleContent>
                        <SidebarMenuSub className="gap-0 ml-2 pl-2 border-l border-sidebar-border/50">

                          {/* Traitement Distribution */}
                          {canViewProcessing && (
                            <SidebarMenuSubItem>
                              <Collapsible
                                asChild
                                defaultOpen={isDistribProcessing}
                                className="group/proc"
                              >
                                <div className="w-full">
                                  <CollapsibleTrigger asChild>
                                    <SidebarMenuSubButton className="w-full justify-between font-medium hover:bg-sidebar-accent/40">
                                      <div className="flex items-center gap-2">
                                        <Wrench className="w-3.5 h-3.5 shrink-0" />
                                        <span>Traitement</span>
                                      </div>
                                      <ChevronRight className="h-3 w-3 shrink-0 transition-transform duration-200 group-data-[state=open]/proc:rotate-90" />
                                    </SidebarMenuSubButton>
                                  </CollapsibleTrigger>

                                  <CollapsibleContent>
                                    <div className="mt-0.5 ml-2 pl-2 border-l border-sidebar-border/50 py-1">
                                      <div className="group-data-[collapsible=icon]:hidden">
                                        <FeedersTree
                                          mode="processing"
                                          selectedFeederId={selectedFeederId}
                                        />
                                      </div>
                                    </div>
                                  </CollapsibleContent>
                                </div>
                              </Collapsible>
                            </SidebarMenuSubItem>
                          )}

                          {/* Validation Distribution */}
                          {canViewValidation && (
                            <SidebarMenuSubItem>
                              <Collapsible
                                asChild
                                defaultOpen={isDistribValidation}
                                className="group/valid"
                              >
                                <div className="w-full">
                                  <CollapsibleTrigger asChild>
                                    <SidebarMenuSubButton className="w-full justify-between font-medium hover:bg-sidebar-accent/40">
                                      <div className="flex items-center gap-2">
                                        <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                                        <span>Validation</span>
                                      </div>
                                      <ChevronRight className="h-3 w-3 shrink-0 transition-transform duration-200 group-data-[state=open]/valid:rotate-90" />
                                    </SidebarMenuSubButton>
                                  </CollapsibleTrigger>

                                  <CollapsibleContent>
                                    <div className="mt-0.5 ml-2 pl-2 border-l border-sidebar-border/50 py-1">
                                      <div className="group-data-[collapsible=icon]:hidden">
                                        <FeedersTree
                                          mode="validation"
                                          selectedFeederId={selectedFeederId}
                                        />
                                      </div>
                                    </div>
                                  </CollapsibleContent>
                                </div>
                              </Collapsible>
                            </SidebarMenuSubItem>
                          )}

                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                </SidebarMenuItem>
              )}

              {/* ── Commercial ──────────────────────────────────────────── */}
              {canViewCommercial && (
                <SidebarMenuItem>
                  <Collapsible
                    asChild
                    open={openSection === "commercial"}
                    onOpenChange={(open) =>
                      setOpenSection(open ? "commercial" : null)
                    }
                    className="group/commercial"
                  >
                    <div>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton
                          tooltip="Commercial"
                          className={cn(
                            "hover:bg-sidebar-accent/50",
                            openSection === "commercial" && "bg-emerald-500/10"
                          )}
                        >
                          <DollarSign className="w-4 h-4 text-emerald-500" />
                          <span>Commercial</span>
                          <ChevronRight className="ml-auto h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]/commercial:rotate-90" />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>

                      <CollapsibleContent>
                        <SidebarMenuSub className="ml-2 pl-2 border-l border-sidebar-border/50">
                          <SidebarMenuSubItem>
                            <Collapsible asChild className="group/comm-proc">
                              <div className="w-full">
                                <CollapsibleTrigger asChild>
                                  <SidebarMenuSubButton className="w-full justify-between hover:bg-sidebar-accent/40">
                                    <div className="flex items-center gap-2">
                                      <Wrench className="w-4 h-4 shrink-0" />
                                      <span>Traitement</span>
                                    </div>
                                    <ChevronRight className="h-3 w-3 shrink-0 transition-transform duration-200 group-data-[state=open]/comm-proc:rotate-90" />
                                  </SidebarMenuSubButton>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                  <SidebarMenuSub className="ml-4 space-y-1">
                                    <SidebarMenuSubItem>
                                      <SidebarMenuSubButton
                                        asChild
                                        isActive={
                                          pathname ===
                                          "/commercial/processing/verifications"
                                        }
                                        className="hover:bg-sidebar-accent/40"
                                      >
                                        <Link href="/commercial/processing/verifications">
                                          <Eye className="w-4 h-4" />
                                          <span>Vérifications</span>
                                        </Link>
                                      </SidebarMenuSubButton>
                                    </SidebarMenuSubItem>
                                    <SidebarMenuSubItem>
                                      <SidebarMenuSubButton
                                        asChild
                                        isActive={
                                          pathname ===
                                          "/commercial/processing/complex"
                                        }
                                        className="hover:bg-sidebar-accent/40"
                                      >
                                        <Link href="/commercial/processing/complex">
                                          <AlertCircle className="w-4 h-4" />
                                          <span>Cas complexes</span>
                                        </Link>
                                      </SidebarMenuSubButton>
                                    </SidebarMenuSubItem>
                                    <SidebarMenuSubItem>
                                      <SidebarMenuSubButton
                                        asChild
                                        isActive={
                                          pathname ===
                                          "/commercial/processing/rejets"
                                        }
                                        className="hover:bg-sidebar-accent/40"
                                      >
                                        <Link href="/commercial/processing/rejets">
                                          <XCircle className="w-4 h-4" />
                                          <span>Rejets</span>
                                        </Link>
                                      </SidebarMenuSubButton>
                                    </SidebarMenuSubItem>
                                  </SidebarMenuSub>
                                </CollapsibleContent>
                              </div>
                            </Collapsible>
                          </SidebarMenuSubItem>

                          {/* Validation commerciale — visible si peut valider */}
                          {canViewValidation && (
                            <SidebarMenuSubItem>
                              <SidebarMenuSubButton
                                asChild
                                isActive={pathname === "/commercial/validation"}
                                className="hover:bg-sidebar-accent/40"
                              >
                                <Link href="/commercial/validation">
                                  <CheckSquare className="w-4 h-4" />
                                  <span>{t("nav.validation")}</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          )}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                </SidebarMenuItem>
              )}

              {/* Utilisateurs (admin uniquement) */}
              {canViewUsers && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === "/users"}
                    tooltip={t("nav.users")}
                    className="hover:bg-sidebar-accent/50"
                  >
                    <Link href="/users">
                      <Users className="w-4 h-4" />
                      <span>{t("nav.users")}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}

              {/* Notifications */}
              {canViewNotifs && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === "/notifications"}
                    tooltip={t("nav.notifications")}
                    className="hover:bg-sidebar-accent/50"
                  >
                    <Link href="/notifications" className="relative">
                      <Bell className="w-4 h-4" />
                      <span>{t("nav.notifications")}</span>
                      {unreadCount > 0 && (
                        <Badge
                          variant="destructive"
                          className="absolute top-2 right-2 h-4 min-w-4 px-1 flex items-center justify-center rounded-full text-[9px] font-bold"
                        >
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </Badge>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}

              {/* Carte */}
              {canViewMap && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === "/map"}
                    tooltip={t("nav.map")}
                    className="hover:bg-sidebar-accent/50"
                  >
                    <Link href="/map">
                      <Map className="w-4 h-4" />
                      <span>{t("nav.map")}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}

            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarSeparator />

      {/* ── Footer : profil utilisateur ─────────────────────────────────── */}
      <SidebarFooter className="p-2 shrink-0">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="w-full hover:bg-sidebar-accent/50"
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
              <DropdownMenuContent
                className="w-56"
                align="end"
                side="top"
                sideOffset={8}
              >
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">
                      {user?.firstName} {user?.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground">{user?.email}</p>
                    <p className="text-xs font-medium text-primary">
                      {user?.role && roleLabels[user.role]}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
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

// "use client";

// /**
//  * ============================================================
//  * TADEC — AppSidebar (v3 — avec intégration traitement-service)
//  * ============================================================
//  * La navigation est filtrée selon les permissions de l'utilisateur.
//  * Chaque item/section n'apparaît que si l'utilisateur a la permission
//  * correspondante.
//  * 
//  * Pour la section Distribution:
//  * - Admin / Chef équipe → voit TOUS les feeders
//  * - Agent traitement / Agent validation → voit UNIQUEMENT ses feeders assignés
//  * ============================================================
//  */

// import Link from "next/link";
// import { usePathname, useRouter } from "next/navigation";
// import { useState, useEffect } from "react";
// import { useAuth } from "@/lib/auth/context";
// import { useI18n } from "@/lib/i18n/context";
// import { useNotificationContext } from "@/lib/context/notification-context";
// import { PERMISSIONS } from "@/lib/auth/permissions";
// import {
//   Sidebar,
//   SidebarContent,
//   SidebarFooter,
//   SidebarGroup,
//   SidebarGroupContent,
//   SidebarHeader,
//   SidebarMenu,
//   SidebarMenuButton,
//   SidebarMenuItem,
//   SidebarMenuSub,
//   SidebarMenuSubButton,
//   SidebarMenuSubItem,
//   SidebarSeparator,
// } from "@/components/ui/sidebar";
// import {
//   DropdownMenu,
//   DropdownMenuContent,
//   DropdownMenuItem,
//   DropdownMenuLabel,
//   DropdownMenuSeparator,
//   DropdownMenuTrigger,
// } from "@/components/ui/dropdown-menu";
// import { Avatar, AvatarFallback } from "@/components/ui/avatar";
// import {
//   Collapsible,
//   CollapsibleContent,
//   CollapsibleTrigger,
// } from "@/components/ui/collapsible";
// import { Badge } from "@/components/ui/badge";
// import {
//   LayoutDashboard,
//   CheckSquare,
//   Users,
//   Map,
//   Settings,
//   LogOut,
//   ChevronRight,
//   Bell,
//   DollarSign,
//   Zap,
//   Eye,
//   XCircle,
//   AlertCircle,
//   Wrench,
//   ShieldCheck,
//   Loader2,
// } from "lucide-react";
// import { cn } from "@/lib/utils";
// import { useFeedersWithSource } from "@/hooks/use-treatment-service";

// const roleLabels: Record<string, string> = {
//   "Admin": "Administrateur",
//   "Chef équipe": "Chef d'équipe",
//   "Agent validation": "Agent de validation",
//   "Agent traitement": "Agent de traitement",
// };

// // Configuration des statuts pour l'affichage des badges
// const statusBadgeConfig: Record<string, { label: string; color: string }> = {
//   assigned: { label: "Assigné", color: "bg-blue-500" },
//   in_progress: { label: "En cours", color: "bg-yellow-500" },
//   completed: { label: "Terminé", color: "bg-green-500" },
//   pending_validation: { label: "En validation", color: "bg-purple-500" },
//   validated: { label: "Validé", color: "bg-emerald-500" },
//   rejected: { label: "Rejeté", color: "bg-red-500" },
// };

// export function AppSidebar() {
//   const pathname = usePathname();
//   const router = useRouter();
//   const { user, logout, hasPermission } = useAuth();
//   const { t } = useI18n();
//   const { unreadCount } = useNotificationContext();

//   const [selectedFeederId, setSelectedFeederId] = useState<string | null>(null);
//   const [openSection, setOpenSection] = useState<"distribution" | "commercial" | null>(null);

//   // Déterminer si on doit filtrer par agent (si l'utilisateur n'est ni Admin ni Chef équipe)
//   const shouldFilterByAgent = user?.role !== 'Admin' && user?.role !== 'Chef équipe';
  
//   // Récupérer les feeders (filtrés selon le rôle)
//   const { data: feedersData, isLoading: isLoadingFeeders } = useFeedersWithSource(shouldFilterByAgent);

//   // Ouverture automatique de la section active
//   useEffect(() => {
//     if (pathname.startsWith("/distribution")) {
//       setOpenSection("distribution");
//     } else if (pathname.startsWith("/commercial")) {
//       setOpenSection("commercial");
//     } else {
//       setOpenSection(null);
//     }
//   }, [pathname]);

//   // Lecture du feeder actif depuis l'URL
//   useEffect(() => {
//     const match = pathname.match(/\/distribution\/(processing|validation)\/feeder\/([^/]+)/);
//     if (match) setSelectedFeederId(match[2]);
//     else setSelectedFeederId(null);
//   }, [pathname]);

//   const getInitials = (firstName?: string, lastName?: string) =>
//     `${firstName?.charAt(0) || ""}${lastName?.charAt(0) || ""}`.toUpperCase();

//   const isDistribProcessing = pathname === "/distribution/processing" || pathname.startsWith("/distribution/processing/feeder/");
//   const isDistribValidation = pathname === "/distribution/validation" || pathname.startsWith("/distribution/validation/feeder/");

//   // ── Calcul des permissions ─────────────────────────────────────────────────
//   const canViewDashboard   = hasPermission(PERMISSIONS.VIEW_DASHBOARD);
//   const canViewDistrib     = hasPermission(PERMISSIONS.VIEW_DISTRIBUTION);
//   const canViewProcessing  = hasPermission(PERMISSIONS.VIEW_PROCESSING);
//   const canViewValidation  = hasPermission(PERMISSIONS.VIEW_VALIDATION);
//   const canViewCommercial  = hasPermission(PERMISSIONS.VIEW_COMMERCIAL);
//   const canViewUsers       = hasPermission(PERMISSIONS.VIEW_USERS);
//   const canViewMap         = hasPermission(PERMISSIONS.VIEW_MAP);
//   const canViewNotifs      = hasPermission(PERMISSIONS.VIEW_NOTIFICATIONS);

//   // Feeders à afficher (avec gestion du chargement)
//   const feeders = feedersData?.feeders || [];

//   // Composant interne pour l'arbre des feeders
//   const FeedersTreeContent = ({ mode }: { mode: "processing" | "validation" }) => {
//     if (isLoadingFeeders) {
//       return (
//         <div className="flex items-center justify-center py-4">
//           <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
//         </div>
//       );
//     }

//     if (feeders.length === 0) {
//       return (
//         <div className="text-center py-4 text-xs text-muted-foreground">
//           {shouldFilterByAgent 
//             ? "Aucun feeder assigné" 
//             : "Aucun feeder disponible"}
//         </div>
//       );
//     }

//     // Filtrer par mode (processing/validation)
//     // Pour le mode validation, on montre seulement les feeders en attente de validation
//     const filteredFeeders = mode === "validation" 
//       ? feeders.filter(f => f.treatment_status === "completed" || f.treatment_status === "pending_validation")
//       : feeders.filter(f => f.treatment_status !== "validated" && f.treatment_status !== "rejected");

//     if (filteredFeeders.length === 0) {
//       return (
//         <div className="text-center py-4 text-xs text-muted-foreground">
//           Aucun feeder à {mode === "validation" ? "valider" : "traiter"}
//         </div>
//       );
//     }

//     return (
//       <div className="space-y-1">
//         {filteredFeeders.map((feeder) => {
//           const isActive = selectedFeederId === feeder.feeder_id && 
//             ((mode === "processing" && isDistribProcessing) || 
//              (mode === "validation" && isDistribValidation));
          
//           const statusBadge = statusBadgeConfig[feeder.treatment_status || ""];
          
//           return (
//             <Link
//               key={feeder.feeder_id}
//               href={`/distribution/${mode}/feeder/${feeder.feeder_id}`}
//               className={cn(
//                 "flex items-center justify-between px-2 py-1.5 rounded-md text-sm transition-colors",
//                 isActive 
//                   ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" 
//                   : "hover:bg-sidebar-accent/50 text-sidebar-foreground/80"
//               )}
//             >
//               <span className="truncate flex-1">
//                 {feeder.feeder_name || feeder.feeder_id}
//               </span>
//               {statusBadge && (
//                 <Badge className={cn("h-1.5 w-1.5 p-0 rounded-full", statusBadge.color)} />
//               )}
//             </Link>
//           );
//         })}
//       </div>
//     );
//   };

//   return (
//     <Sidebar collapsible="icon" className="border-sidebar-border">
//       {/* ── Header ──────────────────────────────────────────────────────── */}
//       <SidebarHeader className="p-4">
//         <div className="flex flex-col group-data-[collapsible=icon]:hidden">
//           <span className="font-bold text-sidebar-foreground tracking-tight">
//             TADEC
//           </span>
//         </div>
//       </SidebarHeader>

//       <SidebarSeparator />

//       {/* ── Navigation principale ────────────────────────────────────────── */}
//       <SidebarContent className="overflow-y-auto flex-1 min-h-0">
//         <SidebarGroup>
//           <SidebarGroupContent>
//             <SidebarMenu className="pb-2 gap-0.5">

//               {/* Dashboard */}
//               {canViewDashboard && (
//                 <SidebarMenuItem>
//                   <SidebarMenuButton
//                     asChild
//                     isActive={pathname === "/dashboard"}
//                     tooltip="Tableau de bord"
//                     className="hover:bg-sidebar-accent/50"
//                   >
//                     <Link href="/dashboard">
//                       <LayoutDashboard className="w-4 h-4" />
//                       <span>{t("nav.dashboard")}</span>
//                     </Link>
//                   </SidebarMenuButton>
//                 </SidebarMenuItem>
//               )}

//               {/* ── Distribution ────────────────────────────────────────── */}
//               {canViewDistrib && (
//                 <SidebarMenuItem>
//                   <Collapsible
//                     asChild
//                     open={openSection === "distribution"}
//                     onOpenChange={(open) =>
//                       setOpenSection(open ? "distribution" : null)
//                     }
//                     className="group/distrib"
//                   >
//                     <div>
//                       <CollapsibleTrigger asChild>
//                         <SidebarMenuButton
//                           tooltip="Distribution"
//                           className={cn(
//                             "hover:bg-sidebar-accent/50",
//                             openSection === "distribution" && "bg-blue-500/10"
//                           )}
//                         >
//                           <Zap className="w-4 h-4 text-blue-500" />
//                           <span>Distribution</span>
//                           <ChevronRight className="ml-auto h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]/distrib:rotate-90" />
//                         </SidebarMenuButton>
//                       </CollapsibleTrigger>

//                       <CollapsibleContent>
//                         <SidebarMenuSub className="gap-0 ml-2 pl-2 border-l border-sidebar-border/50">

//                           {/* Traitement Distribution */}
//                           {canViewProcessing && (
//                             <SidebarMenuSubItem>
//                               <Collapsible
//                                 asChild
//                                 defaultOpen={isDistribProcessing}
//                                 className="group/proc"
//                               >
//                                 <div className="w-full">
//                                   <CollapsibleTrigger asChild>
//                                     <SidebarMenuSubButton className="w-full justify-between font-medium hover:bg-sidebar-accent/40">
//                                       <div className="flex items-center gap-2">
//                                         <Wrench className="w-3.5 h-3.5 shrink-0" />
//                                         <span>Traitement</span>
//                                       </div>
//                                       <ChevronRight className="h-3 w-3 shrink-0 transition-transform duration-200 group-data-[state=open]/proc:rotate-90" />
//                                     </SidebarMenuSubButton>
//                                   </CollapsibleTrigger>

//                                   <CollapsibleContent>
//                                     <div className="mt-0.5 ml-2 pl-2 border-l border-sidebar-border/50 py-1">
//                                       <div className="group-data-[collapsible=icon]:hidden">
//                                         <FeedersTreeContent mode="processing" />
//                                       </div>
//                                     </div>
//                                   </CollapsibleContent>
//                                 </div>
//                               </Collapsible>
//                             </SidebarMenuSubItem>
//                           )}

//                           {/* Validation Distribution */}
//                           {canViewValidation && (
//                             <SidebarMenuSubItem>
//                               <Collapsible
//                                 asChild
//                                 defaultOpen={isDistribValidation}
//                                 className="group/valid"
//                               >
//                                 <div className="w-full">
//                                   <CollapsibleTrigger asChild>
//                                     <SidebarMenuSubButton className="w-full justify-between font-medium hover:bg-sidebar-accent/40">
//                                       <div className="flex items-center gap-2">
//                                         <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
//                                         <span>Validation</span>
//                                       </div>
//                                       <ChevronRight className="h-3 w-3 shrink-0 transition-transform duration-200 group-data-[state=open]/valid:rotate-90" />
//                                     </SidebarMenuSubButton>
//                                   </CollapsibleTrigger>

//                                   <CollapsibleContent>
//                                     <div className="mt-0.5 ml-2 pl-2 border-l border-sidebar-border/50 py-1">
//                                       <div className="group-data-[collapsible=icon]:hidden">
//                                         <FeedersTreeContent mode="validation" />
//                                       </div>
//                                     </div>
//                                   </CollapsibleContent>
//                                 </div>
//                               </Collapsible>
//                             </SidebarMenuSubItem>
//                           )}

//                         </SidebarMenuSub>
//                       </CollapsibleContent>
//                     </div>
//                   </Collapsible>
//                 </SidebarMenuItem>
//               )}

//               {/* ── Commercial ──────────────────────────────────────────── */}
//               {canViewCommercial && (
//                 <SidebarMenuItem>
//                   <Collapsible
//                     asChild
//                     open={openSection === "commercial"}
//                     onOpenChange={(open) =>
//                       setOpenSection(open ? "commercial" : null)
//                     }
//                     className="group/commercial"
//                   >
//                     <div>
//                       <CollapsibleTrigger asChild>
//                         <SidebarMenuButton
//                           tooltip="Commercial"
//                           className={cn(
//                             "hover:bg-sidebar-accent/50",
//                             openSection === "commercial" && "bg-emerald-500/10"
//                           )}
//                         >
//                           <DollarSign className="w-4 h-4 text-emerald-500" />
//                           <span>Commercial</span>
//                           <ChevronRight className="ml-auto h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]/commercial:rotate-90" />
//                         </SidebarMenuButton>
//                       </CollapsibleTrigger>

//                       <CollapsibleContent>
//                         <SidebarMenuSub className="ml-2 pl-2 border-l border-sidebar-border/50">
//                           <SidebarMenuSubItem>
//                             <Collapsible asChild className="group/comm-proc">
//                               <div className="w-full">
//                                 <CollapsibleTrigger asChild>
//                                   <SidebarMenuSubButton className="w-full justify-between hover:bg-sidebar-accent/40">
//                                     <div className="flex items-center gap-2">
//                                       <Wrench className="w-4 h-4 shrink-0" />
//                                       <span>Traitement</span>
//                                     </div>
//                                     <ChevronRight className="h-3 w-3 shrink-0 transition-transform duration-200 group-data-[state=open]/comm-proc:rotate-90" />
//                                   </SidebarMenuSubButton>
//                                 </CollapsibleTrigger>
//                                 <CollapsibleContent>
//                                   <SidebarMenuSub className="ml-4 space-y-1">
//                                     <SidebarMenuSubItem>
//                                       <SidebarMenuSubButton
//                                         asChild
//                                         isActive={pathname === "/commercial/processing/verifications"}
//                                         className="hover:bg-sidebar-accent/40"
//                                       >
//                                         <Link href="/commercial/processing/verifications">
//                                           <Eye className="w-4 h-4" />
//                                           <span>Vérifications</span>
//                                         </Link>
//                                       </SidebarMenuSubButton>
//                                     </SidebarMenuSubItem>
//                                     <SidebarMenuSubItem>
//                                       <SidebarMenuSubButton
//                                         asChild
//                                         isActive={pathname === "/commercial/processing/complex"}
//                                         className="hover:bg-sidebar-accent/40"
//                                       >
//                                         <Link href="/commercial/processing/complex">
//                                           <AlertCircle className="w-4 h-4" />
//                                           <span>Cas complexes</span>
//                                         </Link>
//                                       </SidebarMenuSubButton>
//                                     </SidebarMenuSubItem>
//                                     <SidebarMenuSubItem>
//                                       <SidebarMenuSubButton
//                                         asChild
//                                         isActive={pathname === "/commercial/processing/rejets"}
//                                         className="hover:bg-sidebar-accent/40"
//                                       >
//                                         <Link href="/commercial/processing/rejets">
//                                           <XCircle className="w-4 h-4" />
//                                           <span>Rejets</span>
//                                         </Link>
//                                       </SidebarMenuSubButton>
//                                     </SidebarMenuSubItem>
//                                   </SidebarMenuSub>
//                                 </CollapsibleContent>
//                               </div>
//                             </Collapsible>
//                           </SidebarMenuSubItem>

//                           {/* Validation commerciale */}
//                           {canViewValidation && (
//                             <SidebarMenuSubItem>
//                               <SidebarMenuSubButton
//                                 asChild
//                                 isActive={pathname === "/commercial/validation"}
//                                 className="hover:bg-sidebar-accent/40"
//                               >
//                                 <Link href="/commercial/validation">
//                                   <CheckSquare className="w-4 h-4" />
//                                   <span>{t("nav.validation")}</span>
//                                 </Link>
//                               </SidebarMenuSubButton>
//                             </SidebarMenuSubItem>
//                           )}
//                         </SidebarMenuSub>
//                       </CollapsibleContent>
//                     </div>
//                   </Collapsible>
//                 </SidebarMenuItem>
//               )}

//               {/* Utilisateurs (admin uniquement) */}
//               {canViewUsers && (
//                 <SidebarMenuItem>
//                   <SidebarMenuButton
//                     asChild
//                     isActive={pathname === "/users"}
//                     tooltip={t("nav.users")}
//                     className="hover:bg-sidebar-accent/50"
//                   >
//                     <Link href="/users">
//                       <Users className="w-4 h-4" />
//                       <span>{t("nav.users")}</span>
//                     </Link>
//                   </SidebarMenuButton>
//                 </SidebarMenuItem>
//               )}

//               {/* Notifications */}
//               {canViewNotifs && (
//                 <SidebarMenuItem>
//                   <SidebarMenuButton
//                     asChild
//                     isActive={pathname === "/notifications"}
//                     tooltip={t("nav.notifications")}
//                     className="hover:bg-sidebar-accent/50"
//                   >
//                     <Link href="/notifications" className="relative">
//                       <Bell className="w-4 h-4" />
//                       <span>{t("nav.notifications")}</span>
//                       {unreadCount > 0 && (
//                         <Badge
//                           variant="destructive"
//                           className="absolute -top-1 -right-1 h-4 min-w-4 px-1 flex items-center justify-center rounded-full text-[9px] font-bold"
//                         >
//                           {unreadCount > 99 ? "99+" : unreadCount}
//                         </Badge>
//                       )}
//                     </Link>
//                   </SidebarMenuButton>
//                 </SidebarMenuItem>
//               )}

//               {/* Carte */}
//               {canViewMap && (
//                 <SidebarMenuItem>
//                   <SidebarMenuButton
//                     asChild
//                     isActive={pathname === "/map"}
//                     tooltip={t("nav.map")}
//                     className="hover:bg-sidebar-accent/50"
//                   >
//                     <Link href="/map">
//                       <Map className="w-4 h-4" />
//                       <span>{t("nav.map")}</span>
//                     </Link>
//                   </SidebarMenuButton>
//                 </SidebarMenuItem>
//               )}

//             </SidebarMenu>
//           </SidebarGroupContent>
//         </SidebarGroup>
//       </SidebarContent>

//       <SidebarSeparator />

//       {/* ── Footer : profil utilisateur ─────────────────────────────────── */}
//       <SidebarFooter className="p-2 shrink-0">
//         <SidebarMenu>
//           <SidebarMenuItem>
//             <DropdownMenu>
//               <DropdownMenuTrigger asChild>
//                 <SidebarMenuButton
//                   size="lg"
//                   className="w-full hover:bg-sidebar-accent/50"
//                   tooltip={user?.firstName || "User"}
//                 >
//                   <Avatar className="h-8 w-8 rounded-lg shrink-0">
//                     <AvatarFallback className="rounded-lg bg-sidebar-primary/20 text-sidebar-primary text-xs">
//                       {getInitials(user?.firstName, user?.lastName)}
//                     </AvatarFallback>
//                   </Avatar>
//                   <div className="flex flex-col items-start text-left min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
//                     <span className="text-sm font-medium truncate w-full">
//                       {user?.firstName} {user?.lastName}
//                     </span>
//                     <span className="text-xs text-sidebar-foreground/60 truncate w-full">
//                       {user?.role && roleLabels[user.role]}
//                     </span>
//                   </div>
//                 </SidebarMenuButton>
//               </DropdownMenuTrigger>
//               <DropdownMenuContent
//                 className="w-56"
//                 align="end"
//                 side="top"
//                 sideOffset={8}
//               >
//                 <DropdownMenuLabel className="font-normal">
//                   <div className="flex flex-col space-y-1">
//                     <p className="text-sm font-medium">
//                       {user?.firstName} {user?.lastName}
//                     </p>
//                     <p className="text-xs text-muted-foreground">{user?.email}</p>
//                     <p className="text-xs font-medium text-primary">
//                       {user?.role && roleLabels[user.role]}
//                     </p>
//                   </div>
//                 </DropdownMenuLabel>
//                 <DropdownMenuSeparator />
//                 <DropdownMenuItem asChild>
//                   <Link href="/settings" className="cursor-pointer">
//                     <Settings className="mr-2 h-4 w-4" />
//                     {t("nav.settings")}
//                   </Link>
//                 </DropdownMenuItem>
//                 <DropdownMenuSeparator />
//                 <DropdownMenuItem
//                   onClick={logout}
//                   className="cursor-pointer text-destructive focus:text-destructive"
//                 >
//                   <LogOut className="mr-2 h-4 w-4" />
//                   {t("auth.logout")}
//                 </DropdownMenuItem>
//               </DropdownMenuContent>
//             </DropdownMenu>
//           </SidebarMenuItem>
//         </SidebarMenu>
//       </SidebarFooter>
//     </Sidebar>
//   );
// }
/**
 * ============================================================
 * TADEC — RBAC : Source de vérité des permissions
 * ============================================================
 *
 * RÔLES :
 *  - admin            : Supervision / monitoring. Gestion users. PAS d'actions métier.
 *  - team_lead        : Toutes les fonctions sauf gestion users proprement dite.
 *  - validation_agent : Dashboard + Validation + Commercial + Notifications.
 *  - processing_agent : Dashboard + Traitements assignés + Notifications.
 *
 * CONVENTION DES PERMISSIONS :
 *  view:*      → peut voir la section
 *  manage:*    → CRUD complet
 *  action:*    → action métier spécifique
 *  export:*    → export de données
 */

import { UserRole } from "@/lib/api/types";

// ─── Définition exhaustive des permissions ────────────────────────────────────

export const PERMISSIONS = {
  // Navigation / vues
  VIEW_DASHBOARD:       "view:dashboard",
  VIEW_COLLECTE:        "view:collecte",
  VIEW_DISTRIBUTION:    "view:distribution",
  VIEW_PROCESSING:      "view:processing",
  VIEW_VALIDATION:      "view:validation",
  VIEW_COMMERCIAL:      "view:commercial",
  VIEW_USERS:           "view:users",
  VIEW_MAP:             "view:map",
  VIEW_NOTIFICATIONS:   "view:notifications",
  VIEW_SETTINGS:        "view:settings",


  ACTION_PROCESS_TASK:  "action:process_task",      
  ACTION_ASSIGN_TASK:   "action:assign_task",       
  ACTION_COMPLETE_COLLECTION: "action:complete_collection", 

  ACTION_VALIDATE_TASK: "action:validate_task",      
  ACTION_REJECT_TASK:   "action:reject_task",      


  MANAGE_USERS:         "manage:users",

  EXPORT_DATA:          "export:data",
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

// ─── Matrice rôle → permissions ───────────────────────────────────────────────

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {

  "Admin": [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_COLLECTE,
    PERMISSIONS.VIEW_DISTRIBUTION,
    PERMISSIONS.VIEW_PROCESSING,
    PERMISSIONS.VIEW_VALIDATION,
    PERMISSIONS.VIEW_COMMERCIAL,
    PERMISSIONS.VIEW_USERS,
    PERMISSIONS.VIEW_MAP,
    PERMISSIONS.VIEW_SETTINGS,
    PERMISSIONS.MANAGE_USERS,
    PERMISSIONS.EXPORT_DATA,
    PERMISSIONS.ACTION_COMPLETE_COLLECTION,
    PERMISSIONS.ACTION_PROCESS_TASK,
    PERMISSIONS.ACTION_ASSIGN_TASK,
    PERMISSIONS.ACTION_VALIDATE_TASK,
    PERMISSIONS.ACTION_REJECT_TASK,
    PERMISSIONS.VIEW_NOTIFICATIONS,
    PERMISSIONS.VIEW_SETTINGS,
  ],

  "Chef équipe": [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_DISTRIBUTION,
    PERMISSIONS.VIEW_PROCESSING,
    PERMISSIONS.VIEW_VALIDATION,
    PERMISSIONS.VIEW_COMMERCIAL,
    PERMISSIONS.VIEW_MAP,
    PERMISSIONS.VIEW_NOTIFICATIONS,
    PERMISSIONS.VIEW_SETTINGS,
    PERMISSIONS.ACTION_PROCESS_TASK,
    PERMISSIONS.ACTION_ASSIGN_TASK,
    PERMISSIONS.ACTION_COMPLETE_COLLECTION,
    PERMISSIONS.ACTION_VALIDATE_TASK,
    PERMISSIONS.ACTION_REJECT_TASK,
    PERMISSIONS.EXPORT_DATA,
  ],

  "Agent validation": [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_DISTRIBUTION,
    PERMISSIONS.VIEW_VALIDATION,
    PERMISSIONS.VIEW_PROCESSING,
    PERMISSIONS.VIEW_COMMERCIAL,
    PERMISSIONS.VIEW_NOTIFICATIONS,
    PERMISSIONS.VIEW_SETTINGS,
    PERMISSIONS.ACTION_VALIDATE_TASK,
    PERMISSIONS.ACTION_REJECT_TASK,
    PERMISSIONS.ACTION_PROCESS_TASK,
  ],

  "Agent traitement": [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_DISTRIBUTION,
    PERMISSIONS.VIEW_PROCESSING,
    PERMISSIONS.VIEW_NOTIFICATIONS,
    PERMISSIONS.VIEW_SETTINGS,
    PERMISSIONS.ACTION_PROCESS_TASK,
  ],
};

// ─── Helpers purs (utilisables hors React) ───────────────────────────────────

export function roleHasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function getPermissionsForRole(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

const ROUTE_PERMISSION_MAP: Record<string, Permission> = {
  "/dashboard":                     PERMISSIONS.VIEW_DASHBOARD,
  "/collecte":                       PERMISSIONS.VIEW_COLLECTE,
  "/distribution":                  PERMISSIONS.VIEW_DISTRIBUTION,
  "/distribution/processing":       PERMISSIONS.VIEW_PROCESSING,
  "/distribution/validation":       PERMISSIONS.VIEW_VALIDATION,
  "/commercial":                    PERMISSIONS.VIEW_COMMERCIAL,
  "/users":                         PERMISSIONS.VIEW_USERS,
  "/map":                           PERMISSIONS.VIEW_MAP,
  "/notifications":                 PERMISSIONS.VIEW_NOTIFICATIONS,
  "/settings":                      PERMISSIONS.VIEW_SETTINGS,
};

export function getRequiredPermissionForRoute(pathname: string): Permission | null {
  // On cherche le match le plus long (plus spécifique)
  const sorted = Object.keys(ROUTE_PERMISSION_MAP).sort((a, b) => b.length - a.length);
  for (const prefix of sorted) {
    if (pathname.startsWith(prefix)) {
      return ROUTE_PERMISSION_MAP[prefix];
    }
  }
  return null;
}


export function getDefaultRouteForRole(role: UserRole): string {
  switch (role) {
    case "Admin":            return "/dashboard";
    case "Chef équipe":        return "/dashboard";
    case "Agent validation": return "/dashboard";
    case "Agent traitement": return "/dashboard";
    default:                 return "/login";
  }
}
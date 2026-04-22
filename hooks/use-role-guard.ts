"use client";

/**
 * ============================================================
 * TADEC — Hook : useRoleGuard
 * ============================================================
 * Fournit des utilitaires réactifs pour la gestion RBAC
 * dans les composants React.
 *
 * Usage :
 *   const { can, isAdmin, isTeamLead } = useRoleGuard();
 *   if (can("action:validate_task")) { ... }
 */

import { useAuth } from "@/lib/auth/context";
import { Permission, PERMISSIONS } from "@/lib/auth/permissions";

export function useRoleGuard() {
  const { user, hasPermission, hasRole } = useAuth();

  /** Vérifie une permission typée */
  const can = (permission: Permission): boolean => hasPermission(permission);

  /** Vérifie plusieurs permissions (toutes requises) */
  const canAll = (...perms: Permission[]): boolean =>
    perms.every((p) => hasPermission(p));

  /** Vérifie au moins une permission */
  const canAny = (...perms: Permission[]): boolean =>
    perms.some((p) => hasPermission(p));

  // ── Raccourcis rôles ──────────────────────────────────────────────────────
  const isAdmin           = hasRole("Admin");
  const isTeamLead        = hasRole("Chef équipe");
  const isValidationAgent = hasRole("Agent validation");
  const isProcessingAgent = hasRole("Agent traitement");
  const isCoordinator      = hasRole("Coordonateur");

  // ── Raccourcis actions métier ─────────────────────────────────────────────
  /** Peut effectuer des actions de traitement (chef d'équipe, agent traitement) */
  const canProcess   = can(PERMISSIONS.ACTION_PROCESS_TASK);

  /** Peut effectuer des actions de validation (chef d'équipe, agent validation) */
  const canValidate  = can(PERMISSIONS.ACTION_VALIDATE_TASK);

  /** Peut assigner/réassigner des tâches (chef d'équipe uniquement) */
  const canAssign    = can(PERMISSIONS.ACTION_ASSIGN_TASK);

  /** Peut gérer les utilisateurs (admin uniquement) */
  const canManageUsers = can(PERMISSIONS.MANAGE_USERS);

  /** Peut exporter des données */
  const canExport    = can(PERMISSIONS.EXPORT_DATA);

  /**Peut completer la collecte */
  const canCompleteCollection = can(PERMISSIONS.ACTION_COMPLETE_COLLECTION);

  return {
    user,
    can,
    canAll,
    canAny,
    // Rôles
    isAdmin,
    isTeamLead,
    isValidationAgent,
    isProcessingAgent,
    // Actions métier
    canProcess,
    canValidate,
    canAssign,
    canManageUsers,
    canExport,
    canCompleteCollection
  };
}
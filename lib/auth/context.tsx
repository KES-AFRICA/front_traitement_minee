
"use client";

/**
 * ============================================================
 * TADEC — Auth Context (v3 — Intégration backend réel)
 * ============================================================
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
} from "react";
import { User, UserRole } from "@/lib/api/types";
import { authService } from "@/lib/api/services/auth";
import {
  Permission,
  ROLE_PERMISSIONS,
  roleHasPermission,
} from "@/lib/auth/permissions";

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (
    email: string,
    password: string,
    latitude?: number,
    longitude?: number
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
  hasRole: (roles: UserRole | UserRole[]) => boolean;
  permissions: Permission[];
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // ── Restauration de session via /me (réel) ────────────────────────────────
  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await authService.getCurrentUser();
        if (response.data) {
          setUser(response.data);
        } else {
          // Token invalide ou absent
          localStorage.removeItem('auth_token');
        }
      } catch {
        localStorage.removeItem('auth_token');
      } finally {
        setIsLoading(false);
      }
    };
    checkSession();
  }, []);

  // ── Login ──────────────────────────────────────────────────────────────────
  const login = useCallback(async (email: string, password: string, latitude: number = 0, longitude: number = 0) => {
    try {
      const response = await authService.login({ email, password }, latitude, longitude);
      if (response.data) {
        const { user: userData } = response.data;
        setUser(userData);
        return { success: true };
      }
      return { success: false, error: response.error || "Identifiants invalides" };
    } catch {
      return { success: false, error: "Erreur de connexion" };
    }
  }, []);

  // ── Logout ─────────────────────────────────────────────────────────────────
  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem("auth_token");
    authService.logout();
  }, []);

  // ── Permissions calculées depuis la matrice centralisée ───────────────────
  const permissions = useMemo<Permission[]>(() => {
    if (!user) return [];
    return ROLE_PERMISSIONS[user.role] ?? [];
  }, [user]);

  const hasPermission = useCallback(
    (permission: string): boolean => {
      if (!user) return false;
      return roleHasPermission(user.role, permission as Permission);
    },
    [user]
  );

  const hasRole = useCallback(
    (roles: UserRole | UserRole[]): boolean => {
      if (!user) return false;
      const roleArray = Array.isArray(roles) ? roles : [roles];
      return roleArray.includes(user.role);
    },
    [user]
  );

  const contextValue = useMemo(
    () => ({
      user,
      isAuthenticated: !!user,
      isLoading,
      login,
      logout,
      hasPermission,
      hasRole,
      permissions,
    }),
    [user, isLoading, login, logout, hasPermission, hasRole, permissions]
  );

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
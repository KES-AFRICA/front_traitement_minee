import { ApiResponse, LoginRequest, LoginResponse, User } from "../types";
import { api } from "../client";

function mapRoleIdToUserRole(roleId: number): User['role'] {
  switch (roleId) {
    case 1: return 'Admin';
    case 2: return 'Chef équipe';
    case 3: return 'Agent validation';
    case 4: return 'Agent traitement';
    case 6: return 'Coordonateur';
    default: return 'Agent traitement';
  }
}

// Shape brute renvoyée par le backend /me
interface RawUser {
  id: string;
  email: string;
  full_name: string;
  company: string;
  role_id: number;
  is_active: boolean;
  last_login?: string;
}

function mapRawUser(userData: RawUser): User {
  return {
    id:             userData.id,
    email:          userData.email,
    firstName:      userData.full_name.split(' ')[0] || '',
    lastName:       userData.full_name.split(' ').slice(1).join(' ') || '',
    company:        userData.company,
    role:           mapRoleIdToUserRole(userData.role_id),
    isActive:       userData.is_active,
    lastLogin:      userData.last_login,       // ← mappé
    createdAt:      new Date().toISOString(),
    tasksAssigned:  0,
    tasksCompleted: 0,
    occupancyRate:  0,
    status:         'en ligne',
    password:       '',
  };
}

class AuthService {

  async login(
    credentials: LoginRequest,
    latitude: number = 0,
    longitude: number = 0
  ): Promise<ApiResponse<LoginResponse>> {
    try {
      const data = await api.post<{ access_token: string; token_type: string }>(
        '/auth/login',
        { email: credentials.email, password: credentials.password, latitude, longitude }
      );

      if (typeof window !== 'undefined') {
        localStorage.setItem('auth_token', data.access_token);
      }

      const userData = await api.get<RawUser>('/auth/me');
      const user = mapRawUser(userData);

      return { data: { user, token: data.access_token } };
    } catch (error: any) {
      return { error: 'email ou mot de passe incorrect' };
    }
  }

  async logout(): Promise<ApiResponse<void>> {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
    }
    return { data: undefined };
  }

  async getCurrentUser(): Promise<ApiResponse<User>> {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    if (!token) return { error: 'Not authenticated' };

    try {
      const userData = await api.get<RawUser>('/auth/me');
      return { data: mapRawUser(userData) };
    } catch {
      return { error: 'Session invalide' };
    }
  }

  // ── Mise à jour de son propre profil ──────────────────────────────────────
  async updateMe(payload: {
    email?: string;
    full_name?: string;
    company?: string;
  }): Promise<ApiResponse<User>> {
    try {
      const userData = await api.put<RawUser>('/auth/me', payload);
      return { data: mapRawUser(userData) };
    } catch (error: any) {
      return { error: error.message || 'Erreur de mise à jour' };
    }
  }

  // ── Changement de son propre mot de passe ─────────────────────────────────
  async changeMyPassword(payload: {
    current_password: string;
    new_password: string;
  }): Promise<ApiResponse<{ message: string }>> {
    try {
      const data = await api.put<{ message: string }>('/auth/me/password', payload);
      return { data };
    } catch (error: any) {
      return { error: error.message || 'Erreur de changement de mot de passe' };
    }
  }
}

export const authService = new AuthService();
// lib/api/services/auth.ts
import { ApiResponse, LoginRequest, LoginResponse, User } from "../types";
import { api } from "../client";

function mapRoleIdToUserRole(roleId: number): User['role'] {
  switch (roleId) {
    case 1: return 'admin';
    case 2: return 'team_lead';
    case 3: return 'validation_agent';
    case 4: return 'processing_agent';
    default: return 'processing_agent';
  }
}

class AuthService {
  async login(
    credentials: LoginRequest,
    latitude: number = 0,
    longitude: number = 0
  ): Promise<ApiResponse<LoginResponse>> {
    try {
      const payload = {
        email: credentials.email,
        password: credentials.password,
        latitude,
        longitude,
      };

      const data = await api.post<{ access_token: string; token_type: string }>(
        '/auth/login',
        payload
      );

      if (typeof window !== 'undefined') {
        localStorage.setItem('auth_token', data.access_token);
      }

      const userData = await api.get<{
        id: string;
        email: string;
        full_name: string;
        company: string;
        role_id: number;
        is_active: boolean;
      }>('/auth/me');

      const user: User = {
        id: userData.id,
        email: userData.email,
        firstName: userData.full_name.split(' ')[0] || '',
        lastName: userData.full_name.split(' ').slice(1).join(' ') || '',
        company: userData.company,
        role: mapRoleIdToUserRole(userData.role_id),
        isActive: userData.is_active,
        createdAt: new Date().toISOString(),
        tasksAssigned: 0,
        tasksCompleted: 0,
        occupancyRate: 0,
        status: 'en ligne',
        password: '',
      };
      return { data: { user, token: data.access_token } };
    } catch (error: any) {
      return { error: error.message || 'Erreur de connexion' };
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
      const userData = await api.get<{
        id: string;
        email: string;
        full_name: string;
        company: string;
        role_id: number;
        is_active: boolean;
      }>('/auth/me');
      const user: User = {
        id: userData.id,
        email: userData.email,
        firstName: userData.full_name.split(' ')[0] || '',
        lastName: userData.full_name.split(' ').slice(1).join(' ') || '',
        company: userData.company,
        role: mapRoleIdToUserRole(userData.role_id),
        isActive: userData.is_active,
        createdAt: new Date().toISOString(),
        tasksAssigned: 0,
        tasksCompleted: 0,
        occupancyRate: 0,
        status: 'en ligne',
        password: '',
      };
      return { data: user };
    } catch {
      return { error: 'Session invalide' };
    }
  }
}

export const authService = new AuthService();
// import { ApiResponse, LoginRequest, LoginResponse, User } from "../types";
// import { mockApiResponse, mockApiError } from "../client";
// import { mockUsers } from "../mock-data";

// // Mock credentials for demo
// const MOCK_CREDENTIALS: Record<string, { password: string; userId: string }> = {
//   "admin@minee.cm": { password: "admin123", userId: "1" },
//   "marie.ekotto@minee.cm": { password: "team123", userId: "2" },
//   "paul.mvondo@minee.cm": { password: "valid123", userId: "3" },
//   "agnes.fotso@minee.cm": { password: "process123", userId: "4" },
//   "olivier.nkono@minee.cm": { password: "process123", userId: "5" },
// };

// class AuthService {
//   async login(credentials: LoginRequest): Promise<ApiResponse<LoginResponse>> {
//     const { email, password } = credentials;

//     // Simulate authentication
//     const mockCred = MOCK_CREDENTIALS[email.toLowerCase()];

//     if (!mockCred || mockCred.password !== password) {
//       return mockApiError("Invalid email or password", 500);
//     }

//     const user = mockUsers.find((u) => u.id === mockCred.userId);

//     if (!user) {
//       return mockApiError("User not found", 500);
//     }

//     if (!user.isActive) {
//       return mockApiError("Account is inactive", 500);
//     }

//     return mockApiResponse<LoginResponse>({
//       user,
//       token: `mock-jwt-token-${user.id}-${Date.now()}`,
//     });
//   }

//   async logout(): Promise<ApiResponse<void>> {
//     // Clear any stored tokens
//     return mockApiResponse(undefined);
//   }

//   async getCurrentUser(): Promise<ApiResponse<User>> {
//     // In a real app, this would validate the token and return user info
//     const storedUser = typeof window !== "undefined" 
//       ? localStorage.getItem("minee-user") 
//       : null;

//     if (!storedUser) {
//       return mockApiError("Not authenticated");
//     }

//     try {
//       const user = JSON.parse(storedUser);
//       return mockApiResponse(user);
//     } catch {
//       return mockApiError("Invalid session");
//     }
//   }

//   async refreshToken(): Promise<ApiResponse<{ token: string }>> {
//     // Simulate token refresh
//     return mockApiResponse({
//       token: `mock-jwt-token-refreshed-${Date.now()}`,
//     });
//   }
// }

// export const authService = new AuthService();

// lib/api/services/auth.ts
import { ApiResponse, LoginRequest, LoginResponse, User } from "../types";
import { api } from "../client";

// Mapper role_id (backend) vers UserRole (frontend)
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
  async login(credentials: LoginRequest): Promise<ApiResponse<LoginResponse>> {
    try {
      // 1. Appel à /login pour obtenir le token
      const data = await api.post<{ access_token: string; token_type: string }>('/auth/login', credentials);
      
      // 2. Stocker le token immédiatement
      if (typeof window !== 'undefined') {
        localStorage.setItem('auth_token', data.access_token);
      }

      // 3. Récupérer l'utilisateur via /me
      const userData = await api.get<{
        id: string;
        email: string;
        full_name: string;
        company: string;
        role_id: number;
        is_active: boolean;
      }>('/auth/me');

      // 4. Construire l'objet User frontend
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
        phone: '',
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
        phone: '',
      };
      return { data: user };
    } catch {
      return { error: 'Session invalide' };
    }
  }
}

export const authService = new AuthService();
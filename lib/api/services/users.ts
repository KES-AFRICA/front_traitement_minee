import {
  ApiResponse,
  PaginatedResponse,
  User,
  UserRole,
  AgentStats,
  Task,
} from "../types";
import { api, mockApiResponse } from "../client";
import { mockAgentStats, mockTasks } from "../mock-data";
import { isWithinInterval } from "date-fns";

interface UserFilters {
  role?: UserRole;
  isActive?: boolean;
  search?: string;
}

// Helper pour mapper role_id (backend) → UserRole (frontend)
function mapRoleIdToUserRole(roleId: number): UserRole {
  switch (roleId) {
    case 1: return 'Admin';
    case 2: return 'Chef équipe';
    case 3: return 'Agent validation';
    case 4: return 'Agent traitement';
    case 6: return 'Coordonateur';
    default: return 'Agent traitement';
  }
}

// Helper pour mapper UserRole → role_id (backend)
function mapRoleToRoleId(role: UserRole): number {
  switch (role) {
    case 'Admin': return 1;
    case 'Chef équipe': return 2;
    case 'Agent validation': return 3;
    case 'Agent traitement': return 4;
    case 'Coordonateur': return 6;
    default: return 4;
  }
}

// Interface pour la réponse brute du backend
interface RawUser {
  id: string;
  email: string;
  full_name: string;
  company: string;
  role_id: number;
  is_active: boolean;
  last_login?: string;
}

function mapRawUserToUser(rawUser: RawUser): User {
  const nameParts = rawUser.full_name.split(' ');
  return {
    id: rawUser.id,
    email: rawUser.email,
    firstName: nameParts[0] || '',
    lastName: nameParts.slice(1).join(' ') || '',
    company: rawUser.company,
    role: mapRoleIdToUserRole(rawUser.role_id),
    isActive: rawUser.is_active,
    lastLogin: rawUser.last_login || undefined,
    createdAt: new Date().toISOString(),
    tasksAssigned: 0,
    tasksCompleted: 0,
    occupancyRate: 0,
    status: rawUser.is_active ? 'en ligne' : 'hors ligne',
    phone: '',
    password: '',
  };
}

class UserService {
  private tasks: Task[] = [...mockTasks]; 

  // Récupération de tous les utilisateurs depuis le backend
  async getUsers(
    filters: UserFilters = {},
    pagination?: { page?: number; pageSize?: number }
  ): Promise<ApiResponse<PaginatedResponse<User>>> {
    try {
      const usersData = await api.get<RawUser[]>('/auth/users');
      
      let users: User[] = usersData.map(mapRawUserToUser);

      // Filtrage côté frontend
      if (filters.role) {
        users = users.filter(u => u.role === filters.role);
      }
      if (filters.isActive !== undefined) {
        users = users.filter(u => u.isActive === filters.isActive);
      }
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        users = users.filter(u =>
          u.firstName.toLowerCase().includes(searchLower) ||
          u.lastName.toLowerCase().includes(searchLower) ||
          u.email.toLowerCase().includes(searchLower)
        );
      }

      // Tri par date de dernière connexion (plus récente en premier)
      users.sort((a, b) => {
        if (!a.lastLogin && !b.lastLogin) return 0;
        if (!a.lastLogin) return 1;
        if (!b.lastLogin) return -1;
        return new Date(b.lastLogin).getTime() - new Date(a.lastLogin).getTime();
      });

      const page = pagination?.page || 1;
      const pageSize = pagination?.pageSize || 10;
      const total = users.length;
      const totalPages = Math.ceil(total / pageSize);
      const start = (page - 1) * pageSize;
      const end = start + pageSize;

      return {
        data: {
          data: users.slice(start, end),
          total,
          page,
          pageSize,
          totalPages,
        },
      };
    } catch (error: any) {
      return { error: error.message || 'Erreur lors du chargement des utilisateurs' };
    }
  }

  async getUserById(id: string): Promise<ApiResponse<User>> {
    try {
      const rawUser = await api.get<RawUser>(`/auth/users/${id}`);
      return { data: mapRawUserToUser(rawUser) };
    } catch (error: any) {
      return { error: error.message || 'User not found' };
    }
  }

  async createUser(userData: Partial<User> & { password: string }): Promise<ApiResponse<User>> {
    try {
      const payload = {
        email: userData.email,
        full_name: `${userData.firstName} ${userData.lastName}`.trim(),
        company: userData.company,
        role_id: mapRoleToRoleId(userData.role!),
        password: userData.password,
      };
      
      const createdUser = await api.post<RawUser>('/auth/users', payload);
      return { data: mapRawUserToUser(createdUser) };
    } catch (error: any) {
      return { error: error.message || 'Erreur lors de la création' };
    }
  }

  // ✅ Mise à jour d'un utilisateur (édition complète + activation/désactivation)

async updateUser(id: string, updates: Partial<User>): Promise<ApiResponse<User>> {
  try {
    // Construire le payload pour le backend
    const payload: any = {};
    
    if (updates.email !== undefined) payload.email = updates.email;
    if (updates.firstName !== undefined || updates.lastName !== undefined) {
      const firstName = updates.firstName ?? '';
      const lastName = updates.lastName ?? '';
      payload.full_name = `${firstName} ${lastName}`.trim();
      
    }
    if (updates.company !== undefined) payload.company = updates.company;
    if (updates.role !== undefined) payload.role_id = mapRoleToRoleId(updates.role);
    if (updates.isActive !== undefined) payload.is_active = updates.isActive;
    
    // Pas besoin de récupérer l'utilisateur avant, on fait direct le PUT
    const updatedUser = await api.put<RawUser>(`/auth/users/${id}`, payload);
    return { data: mapRawUserToUser(updatedUser) };
  } catch (error: any) {
    return { error: error.message || 'Erreur lors de la mise à jour' };
  }
}



  // ✅ Suppression d'un utilisateur
  async deleteUser(id: string): Promise<ApiResponse<void>> {
    try {
      await api.delete(`/auth/users/${id}`);
      return { data: undefined };
    } catch (error: any) {
      return { error: error.message || 'Erreur lors de la suppression' };
    }
  }

  // ✅ Activation/Désactivation via updateUser (PUT /auth/users/{id})
async toggleUserStatus(id: string, currentIsActive: boolean): Promise<ApiResponse<User>> {
  try {
    // Inverser le statut
    return this.updateUser(id, { isActive: !currentIsActive });
  } catch (error: any) {
    return { error: error.message || 'Erreur lors du changement de statut' };
  }
}

  // Statistiques (mockées, à remplacer plus tard)
  async getAgentStats(startDate?: Date, endDate?: Date): Promise<ApiResponse<AgentStats[]>> {
    let filteredTasks = [...this.tasks];
    if (startDate && endDate) {
      filteredTasks = filteredTasks.filter(task => {
        const createdAt = new Date(task.createdAt);
        const completedAt = task.completedAt ? new Date(task.completedAt) : null;
        return isWithinInterval(createdAt, { start: startDate, end: endDate }) ||
          (completedAt && isWithinInterval(completedAt, { start: startDate, end: endDate }));
      });
    }
    
    const updatedStats = mockAgentStats.map(stat => {
      const userTasks = filteredTasks.filter(task => task.assignedTo === stat.userId);
      const tasksAssigned = userTasks.length;
      const tasksCompleted = userTasks.filter(task => 
        task.status === "completed" || task.status === "validated"
      ).length;
      const tasksValidated = userTasks.filter(task => task.status === "validated").length;
      const tasksRejected = userTasks.filter(task => task.status === "rejected").length;
      const maxCapacity = 100;
      const occupancyRate = Math.min(Math.round((tasksAssigned / maxCapacity) * 100), 100);
      const completedTasksWithTime = userTasks.filter(task => 
        (task.status === "completed" || task.status === "validated") && 
        task.completedAt
      );
      let avgProcessingTime = 0;
      if (completedTasksWithTime.length > 0) {
        const totalProcessingTime = completedTasksWithTime.reduce((sum, task) => {
          const created = new Date(task.createdAt);
          const completed = new Date(task.completedAt!);
          const hoursDiff = (completed.getTime() - created.getTime()) / (1000 * 60 * 60);
          return sum + hoursDiff;
        }, 0);
        avgProcessingTime = parseFloat((totalProcessingTime / completedTasksWithTime.length).toFixed(1));
      }
      let efficiency = 0;
      if (tasksCompleted > 0) {
        efficiency = Math.round((tasksValidated / tasksCompleted) * 100);
      } else if (tasksAssigned > 0) {
        efficiency = 0;
      } else {
        efficiency = stat.efficiency;
      }
      return { ...stat, tasksAssigned, tasksCompleted, tasksValidated, tasksRejected, occupancyRate, avgProcessingTime, efficiency };
    });
    return mockApiResponse(updatedStats);
  }

  async getUserStats(userId: string, startDate?: Date, endDate?: Date): Promise<ApiResponse<AgentStats>> {
    let filteredTasks = [...this.tasks];
    if (startDate && endDate) {
      filteredTasks = filteredTasks.filter(task => {
        const createdAt = new Date(task.createdAt);
        return isWithinInterval(createdAt, { start: startDate, end: endDate });
      });
    }
    
    const userTasks = filteredTasks.filter(task => task.assignedTo === userId);
    const userResult = await this.getUserById(userId);
    const user = userResult.data;
    
    if (!user) return { error: "User not found" };
    
    const tasksAssigned = userTasks.length;
    const tasksCompleted = userTasks.filter(task => 
      task.status === "completed" || task.status === "validated"
    ).length;
    const tasksValidated = userTasks.filter(task => task.status === "validated").length;
    const tasksRejected = userTasks.filter(task => task.status === "rejected").length;
    const maxCapacity = 100;
    const occupancyRate = Math.min(Math.round((tasksAssigned / maxCapacity) * 100), 100);
    const completedTasksWithTime = userTasks.filter(task => 
      (task.status === "completed" || task.status === "validated") && 
      task.completedAt
    );
    let avgProcessingTime = 0;
    if (completedTasksWithTime.length > 0) {
      const totalProcessingTime = completedTasksWithTime.reduce((sum, task) => {
        const created = new Date(task.createdAt);
        const completed = new Date(task.completedAt!);
        const hoursDiff = (completed.getTime() - created.getTime()) / (1000 * 60 * 60);
        return sum + hoursDiff;
      }, 0);
      avgProcessingTime = parseFloat((totalProcessingTime / completedTasksWithTime.length).toFixed(1));
    }
    let efficiency = 0;
    if (tasksCompleted > 0) {
      efficiency = Math.round((tasksValidated / tasksCompleted) * 100);
    }
    
    const stats: AgentStats = { 
      userId, 
      user, 
      tasksAssigned, 
      tasksCompleted, 
      tasksValidated, 
      tasksRejected, 
      occupancyRate, 
      avgProcessingTime, 
      efficiency 
    };
    return mockApiResponse(stats);
  }

  async getProcessingAgents(): Promise<ApiResponse<User[]>> {
    const res = await this.getUsers({ role: 'Agent traitement', isActive: true });
    if (res.data) {
      return { data: res.data.data };
    }
    return { error: res.error };
  }

  async getValidationAgents(): Promise<ApiResponse<User[]>> {
    const res = await this.getUsers({ role: 'Agent validation', isActive: true });
    if (res.data) {
      return { data: res.data.data };
    }
    return { error: res.error };
  }
}

export const userService = new UserService();
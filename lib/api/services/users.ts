
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
    case 1: return 'admin';
    case 2: return 'team_lead';
    case 3: return 'validation_agent';
    case 4: return 'processing_agent';
    default: return 'processing_agent';
  }
}

// Helper pour mapper UserRole → role_id (backend)
function mapRoleToRoleId(role: UserRole): number {
  switch (role) {
    case 'admin': return 1;
    case 'team_lead': return 2;
    case 'validation_agent': return 3;
    case 'processing_agent': return 4;
    default: return 4;
  }
}

class UserService {
  private tasks: Task[] = [...mockTasks]; 

  // Récupération de tous les utilisateurs depuis le backend
  async getUsers(
    filters: UserFilters = {},
    pagination?: { page?: number; pageSize?: number }
  ): Promise<ApiResponse<PaginatedResponse<User>>> {
    try {
      // Appel à l'API réelle
      const usersData = await api.get<any[]>('/auth/users');
      
      // Transformation des données backend → format frontend
      let users: User[] = usersData.map((u: any) => ({
        id: u.id,
        email: u.email,
        firstName: u.full_name.split(' ')[0] || '',
        lastName: u.full_name.split(' ').slice(1).join(' ') || '',
        company: u.company,
        role: mapRoleIdToUserRole(u.role_id),
        isActive: u.is_active,
        createdAt: new Date().toISOString(),
        tasksAssigned: 0,
        tasksCompleted: 0,
        occupancyRate: 0,
        status: 'hors ligne',
        phone: '', 
        password:'',
      }));

      // Filtrage côté frontend (si nécessaire)
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

      // Pagination côté frontend (simple)
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
      const users = await this.getUsers();
      if (users.data) {
        const user = users.data.data.find(u => u.id === id);
        if (user) return { data: user };
      }
      return { error: 'User not found' };
    } catch {
      return { error: 'User not found' };
    }
  }

  async createUser(userData: Partial<User> & { password: string }): Promise<ApiResponse<User>> {
    try {
      const payload = {
        email: userData.email,
        full_name: `${userData.firstName} ${userData.lastName}`,
        company: userData.company,
        role_id: mapRoleToRoleId(userData.role!),
        password: userData.password, // Mot de passe obligatoire
      };
      await api.post('/auth/users', payload);
      // Après création, on ne retourne pas l'utilisateur du backend, on simule un retour
      const newUser: User = {
        id: 'temp-id', // ne sera pas utilisé en vrai
        email: userData.email!,
        firstName: userData.firstName!,
        lastName: userData.lastName!,
        role: userData.role!,
        company: userData.company!,
        isActive: true,
        createdAt: new Date().toISOString(),
        tasksAssigned: 0,
        tasksCompleted: 0,
        occupancyRate: 0,
        status: 'hors ligne',
        phone: '',
        password:'',
      };
      return { data: newUser };
    } catch (error: any) {
      return { error: error.message || 'Erreur lors de la création' };
    }
  }

  // Les méthodes update, delete, toggle restent mockées (en attente des endpoints backend)
  async updateUser(id: string, updates: Partial<User>): Promise<ApiResponse<User>> {
    // TODO: appeler PUT /auth/users/{id} quand disponible
    return { error: 'Not implemented yet' };
  }

  async deleteUser(id: string): Promise<ApiResponse<void>> {
    // TODO: appeler DELETE /auth/users/{id} quand disponible
    return { error: 'Not implemented yet' };
  }

  async toggleUserStatus(id: string): Promise<ApiResponse<User>> {
    // TODO: appeler PATCH /auth/users/{id}/toggle quand disponible
    return { error: 'Not implemented yet' };
  }

  // Statistiques (mockées, à remplacer plus tard)
  async getAgentStats(startDate?: Date, endDate?: Date): Promise<ApiResponse<AgentStats[]>> {
    // Garde l'ancien mock (inchangé)
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
    // Mock identique à l'original
    let filteredTasks = [...this.tasks];
    if (startDate && endDate) {
      filteredTasks = filteredTasks.filter(task => {
        const createdAt = new Date(task.createdAt);
        return isWithinInterval(createdAt, { start: startDate, end: endDate });
      });
    }
    const userTasks = filteredTasks.filter(task => task.assignedTo === userId);
    const usersRes = await this.getUsers();
    const user = usersRes.data?.data.find(u => u.id === userId);
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
    const stats: AgentStats = { userId, user, tasksAssigned, tasksCompleted, tasksValidated, tasksRejected, occupancyRate, avgProcessingTime, efficiency };
    return mockApiResponse(stats);
  }

  // Agents de traitement : filtre depuis l'API réelle
  async getProcessingAgents(): Promise<ApiResponse<User[]>> {
    const res = await this.getUsers({ role: 'processing_agent', isActive: true });
    if (res.data) {
      return { data: res.data.data };
    }
    return { error: res.error };
  }

  async getValidationAgents(): Promise<ApiResponse<User[]>> {
    const res = await this.getUsers({ role: 'validation_agent', isActive: true });
    if (res.data) {
      return { data: res.data.data };
    }
    return { error: res.error };
  }
}

export const userService = new UserService();
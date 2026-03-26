// lib/api/services/users.ts
import {
  ApiResponse,
  PaginatedResponse,
  User,
  UserRole,
  AgentStats,
  Task,
} from "../types";
import { mockApiResponse } from "../client";
import { mockUsers, mockAgentStats, mockTasks } from "../mock-data";
import { isWithinInterval } from "date-fns";

interface UserFilters {
  role?: UserRole;
  isActive?: boolean;
  search?: string;
  department?: string;
}

interface UserPagination {
  page?: number;
  pageSize?: number;
}

class UserService {
  private users: User[] = [...mockUsers];
  private tasks: Task[] = [...mockTasks];

  async getUsers(
    filters: UserFilters = {},
    pagination: UserPagination = {}
  ): Promise<ApiResponse<PaginatedResponse<User>>> {
    let filteredUsers = [...this.users];

    // Apply filters
    if (filters.role) {
      filteredUsers = filteredUsers.filter((u) => u.role === filters.role);
    }
    if (filters.isActive !== undefined) {
      filteredUsers = filteredUsers.filter((u) => u.isActive === filters.isActive);
    }
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filteredUsers = filteredUsers.filter(
        (u) =>
          u.firstName.toLowerCase().includes(searchLower) ||
          u.lastName.toLowerCase().includes(searchLower) ||
          u.email.toLowerCase().includes(searchLower)
      );
    }

    // Pagination
    const page = pagination.page || 1;
    const pageSize = pagination.pageSize || 10;
    const total = filteredUsers.length;
    const totalPages = Math.ceil(total / pageSize);
    const start = (page - 1) * pageSize;
    const end = start + pageSize;

    return mockApiResponse<PaginatedResponse<User>>({
      data: filteredUsers.slice(start, end),
      total,
      page,
      pageSize,
      totalPages,
    });
  }

  async getUserById(id: string): Promise<ApiResponse<User>> {
    const user = this.users.find((u) => u.id === id);
    if (!user) {
      return { error: "User not found" };
    }
    return mockApiResponse(user);
  }

  async createUser(userData: Partial<User>): Promise<ApiResponse<User>> {
    // Check if email already exists
    if (this.users.some((u) => u.email === userData.email)) {
      return { error: "Email already exists" };
    }

    const newUser: User = {
      id: String(this.users.length + 1),
      email: userData.email || "",
      firstName: userData.firstName || "",
      lastName: userData.lastName || "",
      role: userData.role || "processing_agent",
      phone: userData.phone,
      isActive: true,
      createdAt: new Date().toISOString(),
      tasksAssigned: 0,
      tasksCompleted: 0,
      occupancyRate: 0,
      status: 'hors ligne',
      company: userData.company || ""
    };

    this.users.push(newUser);
    return mockApiResponse(newUser);
  }

  async updateUser(id: string, updates: Partial<User>): Promise<ApiResponse<User>> {
    const userIndex = this.users.findIndex((u) => u.id === id);
    if (userIndex === -1) {
      return { error: "User not found" };
    }

    // Check email uniqueness if updating email
    if (
      updates.email &&
      updates.email !== this.users[userIndex].email &&
      this.users.some((u) => u.email === updates.email)
    ) {
      return { error: "Email already exists" };
    }

    this.users[userIndex] = {
      ...this.users[userIndex],
      ...updates,
    };

    return mockApiResponse(this.users[userIndex]);
  }

  async deleteUser(id: string): Promise<ApiResponse<void>> {
    const userIndex = this.users.findIndex((u) => u.id === id);
    if (userIndex === -1) {
      return { error: "User not found" };
    }

    // Soft delete - set as inactive
    this.users[userIndex].isActive = false;
    return mockApiResponse(undefined);
  }

  async toggleUserStatus(id: string): Promise<ApiResponse<User>> {
    const userIndex = this.users.findIndex((u) => u.id === id);
    if (userIndex === -1) {
      return { error: "User not found" };
    }

    this.users[userIndex].isActive = !this.users[userIndex].isActive;
    return mockApiResponse(this.users[userIndex]);
  }

  async getAgentStats(startDate?: Date, endDate?: Date): Promise<ApiResponse<AgentStats[]>> {
    // Filtrer les tâches par période si des dates sont fournies
    let filteredTasks = [...this.tasks];
    
    if (startDate && endDate) {
      filteredTasks = filteredTasks.filter(task => {
        const createdAt = new Date(task.createdAt);
        const completedAt = task.completedAt ? new Date(task.completedAt) : null;
        
        // Une tâche est considérée dans la période si elle a été créée OU complétée pendant la période
        return isWithinInterval(createdAt, { start: startDate, end: endDate }) ||
          (completedAt && isWithinInterval(completedAt, { start: startDate, end: endDate }));
      });
    }

    // Recalculer les statistiques pour chaque agent basé sur les tâches filtrées
    const updatedStats = mockAgentStats.map(stat => {
      const userTasks = filteredTasks.filter(task => task.assignedTo === stat.userId);
      const tasksAssigned = userTasks.length;
      const tasksCompleted = userTasks.filter(task => 
        task.status === "completed" || task.status === "validated"
      ).length;
      const tasksValidated = userTasks.filter(task => task.status === "validated").length;
      const tasksRejected = userTasks.filter(task => task.status === "rejected").length;
      
      // Calculer le taux d'occupation basé sur les tâches assignées vs capacité (max 100 par agent)
      const maxCapacity = 100;
      const occupancyRate = Math.min(Math.round((tasksAssigned / maxCapacity) * 100), 100);
      
      // Calculer le temps de traitement moyen pour les tâches complétées
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
      
      // Calculer l'efficacité basée sur le taux de validation
      let efficiency = 0;
      if (tasksCompleted > 0) {
        efficiency = Math.round((tasksValidated / tasksCompleted) * 100);
      } else if (tasksAssigned > 0) {
        efficiency = 0;
      } else {
        efficiency = stat.efficiency;
      }
      
      return {
        ...stat,
        tasksAssigned,
        tasksCompleted,
        tasksValidated,
        tasksRejected,
        occupancyRate,
        avgProcessingTime,
        efficiency,
      };
    });
    
    return mockApiResponse(updatedStats);
  }

  async getUserStats(userId: string, startDate?: Date, endDate?: Date): Promise<ApiResponse<AgentStats>> {
    // Filtrer les tâches par période
    let filteredTasks = [...this.tasks];
    
    if (startDate && endDate) {
      filteredTasks = filteredTasks.filter(task => {
        const createdAt = new Date(task.createdAt);
        return isWithinInterval(createdAt, { start: startDate, end: endDate });
      });
    }
    
    const userTasks = filteredTasks.filter(task => task.assignedTo === userId);
    const user = this.users.find((u) => u.id === userId);
    
    if (!user) {
      return { error: "User not found" };
    }
    
    const tasksAssigned = userTasks.length;
    const tasksCompleted = userTasks.filter(task => 
      task.status === "completed" || task.status === "validated"
    ).length;
    const tasksValidated = userTasks.filter(task => task.status === "validated").length;
    const tasksRejected = userTasks.filter(task => task.status === "rejected").length;
    
    // Calculer le taux d'occupation
    const maxCapacity = 100;
    const occupancyRate = Math.min(Math.round((tasksAssigned / maxCapacity) * 100), 100);
    
    // Calculer le temps de traitement moyen
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
    
    // Calculer l'efficacité
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
      efficiency,
    };
    
    return mockApiResponse(stats);
  }

  async getProcessingAgents(): Promise<ApiResponse<User[]>> {
    const agents = this.users.filter(
      (u) => u.role === "processing_agent" && u.isActive
    );
    return mockApiResponse(agents);
  }

  async getValidationAgents(): Promise<ApiResponse<User[]>> {
    const agents = this.users.filter(
      (u) => u.role === "validation_agent" && u.isActive
    );
    return mockApiResponse(agents);
  }
}

export const userService = new UserService();
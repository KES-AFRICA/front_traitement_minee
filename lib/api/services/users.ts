import {
  ApiResponse,
  PaginatedResponse,
  User,
  UserRole,
  AgentStats,
} from "../types";
import { mockApiResponse } from "../client";
import { mockUsers, mockAgentStats } from "../mock-data";

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
      status:'hors ligne',
      company:userData.company || ""
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

  async getAgentStats(): Promise<ApiResponse<AgentStats[]>> {
    return mockApiResponse(mockAgentStats);
  }

  async getUserStats(userId: string): Promise<ApiResponse<AgentStats>> {
    const stats = mockAgentStats.find((s) => s.userId === userId);
    if (!stats) {
      // Return default stats
      const user = this.users.find((u) => u.id === userId);
      if (!user) {
        return { error: "User not found" };
      }
      return mockApiResponse({
        userId,
        user,
        tasksAssigned: user.tasksAssigned,
        tasksCompleted: user.tasksCompleted,
        tasksValidated: 0,
        tasksRejected: 0,
        occupancyRate: user.occupancyRate,
        avgProcessingTime: 0,
        efficiency: 0,
      });
    }
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

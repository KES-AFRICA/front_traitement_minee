// lib/api/services/tasks.ts
import {
  ApiResponse,
  PaginatedResponse,
  Task,
  TaskStatus,
  TaskType,
  TaskPriority,
  DashboardStats,
  WeeklyTrend,
  ActivityItem,
} from "../types";
import { mockApiResponse } from "../client";
import { mockTasks, mockDashboardStats, mockWeeklyTrend, mockActivity } from "../mock-data";
import { isWithinInterval } from "date-fns";

interface TaskFilters {
  type?: TaskType;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignedTo?: string;
  search?: string;
  startDate?: Date;
  endDate?: Date;
}

interface TaskPagination {
  page?: number;
  pageSize?: number;
}

class TaskService {
  private tasks: Task[] = [...mockTasks];

  async getTasks(
    filters: TaskFilters = {},
    pagination: TaskPagination = {}
  ): Promise<ApiResponse<PaginatedResponse<Task>>> {
    let filteredTasks = [...this.tasks];

    // Apply filters
    if (filters.type) {
      filteredTasks = filteredTasks.filter((t) => t.type === filters.type);
    }
    if (filters.status) {
      filteredTasks = filteredTasks.filter((t) => t.status === filters.status);
    }
    if (filters.priority) {
      filteredTasks = filteredTasks.filter((t) => t.priority === filters.priority);
    }
    if (filters.assignedTo) {
      filteredTasks = filteredTasks.filter((t) => t.assignedTo === filters.assignedTo);
    }
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filteredTasks = filteredTasks.filter(
        (t) =>
          t.title.toLowerCase().includes(searchLower) ||
          t.description?.toLowerCase().includes(searchLower)
      );
    }
    if (filters.startDate && filters.endDate) {
      filteredTasks = filteredTasks.filter((t) => {
        const createdAt = new Date(t.createdAt);
        return isWithinInterval(createdAt, { start: filters.startDate!, end: filters.endDate! });
      });
    }

    // Sort by date (newest first)
    filteredTasks.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // Pagination
    const page = pagination.page || 1;
    const pageSize = pagination.pageSize || 10;
    const total = filteredTasks.length;
    const totalPages = Math.ceil(total / pageSize);
    const start = (page - 1) * pageSize;
    const end = start + pageSize;

    return mockApiResponse<PaginatedResponse<Task>>({
      data: filteredTasks.slice(start, end),
      total,
      page,
      pageSize,
      totalPages,
    });
  }

  async getTaskById(id: string): Promise<ApiResponse<Task>> {
    const task = this.tasks.find((t) => t.id === id);
    if (!task) {
      return { error: "Task not found" };
    }
    return mockApiResponse(task);
  }

  async createTask(taskData: Partial<Task>): Promise<ApiResponse<Task>> {
    const newTask: Task = {
      id: `task-${String(this.tasks.length + 1).padStart(3, "0")}`,
      type: taskData.type || "duplicate",
      status: "pending",
      priority: taskData.priority || "medium",
      title: taskData.title || "New Task",
      description: taskData.description,
      assignedTo: taskData.assignedTo,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      data: taskData.data || {},
    };

    this.tasks.unshift(newTask);
    return mockApiResponse(newTask);
  }

  async updateTask(id: string, updates: Partial<Task>): Promise<ApiResponse<Task>> {
    const taskIndex = this.tasks.findIndex((t) => t.id === id);
    if (taskIndex === -1) {
      return { error: "Task not found" };
    }

    this.tasks[taskIndex] = {
      ...this.tasks[taskIndex],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    return mockApiResponse(this.tasks[taskIndex]);
  }

  async assignTask(id: string, userId: string): Promise<ApiResponse<Task>> {
    return this.updateTask(id, { assignedTo: userId, status: "in_progress" });
  }

  async completeTask(id: string): Promise<ApiResponse<Task>> {
    return this.updateTask(id, {
      status: "completed",
      completedAt: new Date().toISOString(),
    });
  }

  async validateTask(
    id: string,
    validatedBy: string,
    comment?: string
  ): Promise<ApiResponse<Task>> {
    return this.updateTask(id, {
      status: "validated",
      validatedAt: new Date().toISOString(),
      validatedBy,
      validationComment: comment,
    });
  }

  async rejectTask(
    id: string,
    rejectedBy: string,
    comment: string
  ): Promise<ApiResponse<Task>> {
    return this.updateTask(id, {
      status: "rejected",
      validatedAt: new Date().toISOString(),
      validatedBy: rejectedBy,
      validationComment: comment,
    });
  }

  async getDashboardStats(startDate?: Date, endDate?: Date): Promise<ApiResponse<DashboardStats>> {
    let filteredTasks = [...this.tasks];
    
    if (startDate && endDate) {
      filteredTasks = filteredTasks.filter(task => {
        const createdAt = new Date(task.createdAt);
        return isWithinInterval(createdAt, { start: startDate, end: endDate });
      });
    }

    const totalTasks = filteredTasks.length;
    const pending = filteredTasks.filter(t => t.status === "pending").length;
    const inProgress = filteredTasks.filter(t => t.status === "in_progress").length;
    const completed = filteredTasks.filter(t => t.status === "completed").length;
    const validated = filteredTasks.filter(t => t.status === "validated").length;
    const rejected = filteredTasks.filter(t => t.status === "rejected").length;

    const processed = completed + validated + rejected;
    const processingRate = totalTasks > 0 ? (processed / totalTasks) * 100 : 0;
    const validationRate = completed > 0 ? (validated / completed) * 100 : 0;

    // Calculer le temps de traitement moyen
    let avgProcessingTime = 0;
    const completedTasks = filteredTasks.filter(t => t.status === "completed" || t.status === "validated");
    if (completedTasks.length > 0) {
      const totalTime = completedTasks.reduce((sum, task) => {
        const created = new Date(task.createdAt);
        const completed = new Date(task.completedAt || task.validatedAt || new Date());
        const hoursDiff = (completed.getTime() - created.getTime()) / (1000 * 60 * 60);
        return sum + hoursDiff;
      }, 0);
      avgProcessingTime = parseFloat((totalTime / completedTasks.length).toFixed(1));
    }

    return mockApiResponse({
      totalTasks,
      pending,
      inProgress,
      completed,
      validated,
      rejected,
      processingRate,
      validationRate,
      avgProcessingTime,
    });
  }

  async getWeeklyTrend(startDate?: Date, endDate?: Date): Promise<ApiResponse<WeeklyTrend[]>> {
    let filteredTrend = [...mockWeeklyTrend];
    
    if (startDate && endDate) {
      filteredTrend = filteredTrend.filter(trend => {
        const trendDate = new Date(trend.date);
        return isWithinInterval(trendDate, { start: startDate, end: endDate });
      });
    }
    
    return mockApiResponse(filteredTrend);
  }

  async getRecentActivity(limit: number = 10, startDate?: Date, endDate?: Date): Promise<ApiResponse<ActivityItem[]>> {
    let filteredActivity = [...mockActivity];
    
    if (startDate && endDate) {
      filteredActivity = filteredActivity.filter(activity => {
        const timestamp = new Date(activity.timestamp);
        return isWithinInterval(timestamp, { start: startDate, end: endDate });
      });
    }
    
    filteredActivity.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    
    return mockApiResponse(filteredActivity.slice(0, limit));
  }

  async getTasksByType(type: TaskType, startDate?: Date, endDate?: Date): Promise<ApiResponse<Task[]>> {
    let tasks = this.tasks.filter((t) => t.type === type);
    
    if (startDate && endDate) {
      tasks = tasks.filter(task => {
        const createdAt = new Date(task.createdAt);
        return isWithinInterval(createdAt, { start: startDate, end: endDate });
      });
    }
    
    return mockApiResponse(tasks);
  }

  async getPendingValidation(startDate?: Date, endDate?: Date): Promise<ApiResponse<Task[]>> {
    let tasks = this.tasks.filter((t) => t.status === "completed");
    
    if (startDate && endDate) {
      tasks = tasks.filter(task => {
        const createdAt = new Date(task.createdAt);
        return isWithinInterval(createdAt, { start: startDate, end: endDate });
      });
    }
    
    return mockApiResponse(tasks);
  }
}

export const taskService = new TaskService();
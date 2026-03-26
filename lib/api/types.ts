// User types
export type UserRole = "admin" | "team_lead" | "validation_agent" | "processing_agent";

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  company: string;
  role: UserRole;
  phone?: string;
  avatar?: string;
  isActive: boolean;
  createdAt: string;
  lastLogin?: string;
  tasksAssigned: number;
  tasksCompleted: number;
  occupancyRate: number;
  status: string;
}

// Task types
export type TaskStatus = "pending" | "in_progress" | "completed" | "validated" | "rejected";
export type TaskPriority = "low" | "medium" | "high";
export type TaskType = "duplicate" | "difference" | "new_kobo" | "missing_eneo";

export interface Task {
  id: string;
  type: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  title: string;
  description?: string;
  assignedTo?: string;
  assignedToUser?: User;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  validatedAt?: string;
  validatedBy?: string;
  validationComment?: string;
  data: Record<string, unknown>;
  sourceData?: Record<string, unknown>;
  targetData?: Record<string, unknown>;
  similarity?: number;
  confidence?: number;
}

// Treatment types
export interface Treatment {
  id: string;
  taskId: string;
  action: "merge" | "keep" | "discard" | "update";
  processedBy: string;
  processedAt: string;
  notes?: string;
  resultData?: Record<string, unknown>;
}

// Statistics types
export interface DashboardStats {
  totalTasks: number;
  pending: number;
  inProgress: number;
  completed: number;
  validated: number;
  rejected: number;
  processingRate: number;
  validationRate: number;
  avgProcessingTime: number;
}

export interface AgentStats {
  userId: string;
  user: User;
  tasksAssigned: number;
  tasksCompleted: number;
  tasksValidated: number;
  tasksRejected: number;
  occupancyRate: number;
  avgProcessingTime: number;
  efficiency: number;
}

export interface WeeklyTrend {
  date: string;
  completed: number;
  validated: number;
  rejected: number;
}

export interface ActivityItem {
  id: string;
  type: "task_created" | "task_completed" | "task_validated" | "task_rejected" | "user_created";
  description: string;
  timestamp: string;
  userId?: string;
  user?: User;
  taskId?: string;
  task?: Task;
}

// Map/GIS types
export interface GeoPoint {
  id: string;
  lat: number;
  lng: number;
  type: "kobo" | "eneo" | "processed";
  status: TaskStatus;
  data: Record<string, unknown>;
}

export interface Region {
  id: string;
  name: string;
  code: string;
  pointsCount: number;
  completionRate: number;
}

// Notification types
export interface Notification {
  id: string;
  type: "new_task" | "task_validated" | "task_rejected" | "comment" | "system";
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  linkTo?: string;
}

// API Response types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Auth types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  token: string;
}

// Geographic and Administrative Divisions
export interface ElectricRegion {
  id: string;
  name: string; 
  code: string; 
  city: string;
}

export interface TaskStatsByRegion {
  region: ElectricRegion;
  totalTasks: number;
  pending: number;
  inProgress: number;
  completed: number;
  validated: number;
  rejected: number;
  completionRate: number;
}

export interface TaskStatsByCity {
  city: string;
  regions: ElectricRegion[];
  totalTasks: number;
  pending: number;
  completionRate: number;
}

export interface TaskStatsByZone {
  zone: string;
  totalTasks: number;
  completed: number;
}

export interface TaskStatsByExploitation {
  exploitationId: string;
  exploitationName: string;
  totalTasks: number;
  completed: number;
  avgProcessingTime: number;
}

import {   
  FeederSourceResponse,
  TreatmentStatusResponse,
  AssignTreatmentRequest,
  StartTreatmentRequest,
  CompleteTreatmentRequest,
  ValidateTreatmentRequest,
  RejectTreatmentRequest,
  AgentTreatmentsResponse,
  AttributeUpdateRequest,
  AttributeUpdateResponse,
  AttributeHistoryResponse,
  TablesResponse,
  DashboardStatsResponse,
  SetCollectingRequest,
  SetPendingRequest,
  SetPendingValidationRequest,
  // Types pour l'insertion
  FeederCreate,
  SubstationCreate,
  WireCreate,
  BayCreate,
  PowerTransformerCreate,
  SwitchCreate,
  BusbarCreate,
  InsertResponse,
} from "@/lib/types/treatment-service";
import { api } from "../client";

// Types pour le dashboard
export interface DashboardStats {
  totalTasks: number;
collecting: number;        // En cours de collecte
  pending: number;           // En attente de traitement
  assigned: number;          // Assignés 
  inProgress: number;        // En cours de traitement
  pendingValidation: number; // En attente validation (Traités)
  validated: number;
  rejected: number;
  processingRate: number;
  validationRate: number;
  avgProcessingTime: number;
}


export interface WeeklyTrend {
  date: string;
  validated: number;   // Nombre de départs validés ce jour
  completed: number;   // Nombre de départs traités (en attente validation)
}

export interface ActivityItem {
  id: number;
  type: 'update' | 'validate' | 'reject' | 'complete' | 'start' | 'collect';
  message: string;
  timestamp: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
  feeder: {
    id: string;
    name: string;
  } | null;
  details?: {
    table: string;
    column: string;
    oldValue: string;
    newValue: string;
  };
}

export interface AgentStat {
  userId: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    company: string;
    role: string;
  };
  tasksAssigned: number;
  tasksCompleted: number;
  tasksValidated: number;
  tasksRejected: number;
  occupancyRate: number;
  avgProcessingTime: number;
  efficiency: number;
}

export interface TaskDistribution {
  name: string;
  value: number;
  percentage: number;
  color: string;
}

export interface DashboardAllData {
  stats: DashboardStats;
  weeklyTrend: WeeklyTrend[];
  recentActivity: ActivityItem[];
  agentStats: AgentStat[];
  taskDistribution: TaskDistribution[];
}

const BASE_PATH = '/treatment';

export const treatmentApi = {
  // ============================================================
  // FEEDERS AVEC SOURCE ET AGENT ASSIGNÉ
  // ============================================================
  
  async getFeedersWithSource(): Promise<FeederSourceResponse> {
    return api.get<FeederSourceResponse>(`${BASE_PATH}/feeders/source`);
  },

  // ============================================================
  // GESTION DES TRAITEMENTS
  // ============================================================

  async assignTreatment(request: AssignTreatmentRequest): Promise<{ success: boolean; message: string }> {
    return api.post(`${BASE_PATH}/treatments/assign`, request);
  },

  async startTreatment(request: StartTreatmentRequest): Promise<{ success: boolean; message: string }> {
    return api.put(`${BASE_PATH}/treatments/start/${request.feeder_id}`, request);
  },

  async completeTreatment(request: CompleteTreatmentRequest): Promise<{ success: boolean; message: string; duration_seconds?: number }> {
    return api.put(`${BASE_PATH}/treatments/complete/${request.feeder_id}`, request);
  },

  async setPendingValidation(request: SetPendingValidationRequest): Promise<{ success: boolean; message: string }> {
    return api.put(`${BASE_PATH}/treatments/pending-validation/${request.feeder_id}`, request);
  },

  async validateTreatment(request: ValidateTreatmentRequest): Promise<{ success: boolean; message: string }> {
    return api.put(`${BASE_PATH}/treatments/validate/${request.feeder_id}`, request);
  },

  async rejectTreatment(request: RejectTreatmentRequest): Promise<{ success: boolean; message: string }> {
    return api.put(`${BASE_PATH}/treatments/reject/${request.feeder_id}`, request);
  },

  async setPending(request: SetPendingRequest): Promise<{ success: boolean; message: string }> {
    return api.put(`${BASE_PATH}/treatments/pending/${request.feeder_id}`, request);
  },

  async setCollecting(request: SetCollectingRequest): Promise<{ success: boolean; message: string }> {
    return api.put(`${BASE_PATH}/treatments/collecting/${request.feeder_id}`, request);
  },

  async getTreatmentStatus(feederId: string): Promise<TreatmentStatusResponse> {
    return api.get<TreatmentStatusResponse>(`${BASE_PATH}/treatments/feeder/${feederId}`);
  },

  async getAgentTreatments(agentId: string): Promise<AgentTreatmentsResponse> {
    return api.get<AgentTreatmentsResponse>(`${BASE_PATH}/treatments/agent/${agentId}`);
  },

  // ============================================================
  // MODIFICATION DES ATTRIBUTS
  // ============================================================

  async hideRecord(tableName: string, recordId: string): Promise<{ success: boolean; message: string; table: string; record_id: string; cacher: number }> {
    return api.put(`${BASE_PATH}/treatments/cacher/${tableName}/${recordId}`);
  },

  async updateAttribute(request: AttributeUpdateRequest): Promise<AttributeUpdateResponse> {
    return api.put(`${BASE_PATH}/treatments/attribute`, request);
  },

  async getAttributeHistory(feederId: string, limit: number = 100): Promise<AttributeHistoryResponse> {
    return api.get<AttributeHistoryResponse>(`${BASE_PATH}/treatments/attribute/history/${feederId}?limit=${limit}`);
  },

  async getRecordHistory(tableName: string, recordId: string, limit: number = 100): Promise<AttributeHistoryResponse> {
    return api.get<AttributeHistoryResponse>(`${BASE_PATH}/treatments/attribute/history/table/${tableName}/${recordId}?limit=${limit}`);
  },

  async getTables(): Promise<TablesResponse> {
    return api.get<TablesResponse>(`${BASE_PATH}/treatments/tables`);
  },

  // ============================================================
  // INSERTION DE DONNÉES
  // ============================================================

  async insertFeeder(request: FeederCreate): Promise<InsertResponse> {
    return api.post(`${BASE_PATH}/treatments/insert/feeder`, request);
  },

  async insertSubstation(request: SubstationCreate): Promise<InsertResponse> {
    return api.post(`${BASE_PATH}/treatments/insert/substation`, request);
  },

  async insertWire(request: WireCreate): Promise<InsertResponse> {
    return api.post(`${BASE_PATH}/treatments/insert/wire`, request);
  },

  async insertBay(request: BayCreate): Promise<InsertResponse> {
    return api.post(`${BASE_PATH}/treatments/insert/bay`, request);
  },

  async insertPowerTransformer(request: PowerTransformerCreate): Promise<InsertResponse> {
    return api.post(`${BASE_PATH}/treatments/insert/power_transformer`, request);
  },

  async insertSwitch(request: SwitchCreate): Promise<InsertResponse> {
    return api.post(`${BASE_PATH}/treatments/insert/switch`, request);
  },

  async insertBusbar(request: BusbarCreate): Promise<InsertResponse> {
    return api.post(`${BASE_PATH}/treatments/insert/busbar`, request);
  },

  // ============================================================
  // DASHBOARD
  // ============================================================

  async getDashboardStats(startDate?: Date, endDate?: Date): Promise<DashboardStats> {
    let url = `${BASE_PATH}/treatments/dashboard/stats`;
    const params = new URLSearchParams();
    
    if (startDate) {
      params.append('start_date', startDate.toISOString().split('T')[0]);
    }
    if (endDate) {
      params.append('end_date', endDate.toISOString().split('T')[0]);
    }
    
    const queryString = params.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
    
    return api.get<DashboardStats>(url);
  },

  async getWeeklyTrend(startDate?: Date, endDate?: Date): Promise<WeeklyTrend[]> {
    let url = `${BASE_PATH}/treatments/dashboard/weekly-trend`;
    const params = new URLSearchParams();
    
    if (startDate) {
      params.append('start_date', startDate.toISOString().split('T')[0]);
    }
    if (endDate) {
      params.append('end_date', endDate.toISOString().split('T')[0]);
    }
    
    const queryString = params.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
    
    return api.get<WeeklyTrend[]>(url);
  },

  async getRecentActivity(limit: number = 10, startDate?: Date, endDate?: Date): Promise<ActivityItem[]> {
    let url = `${BASE_PATH}/treatments/dashboard/recent-activity?limit=${limit}`;
    const params = new URLSearchParams();
    
    if (startDate) {
      params.append('start_date', startDate.toISOString().split('T')[0]);
    }
    if (endDate) {
      params.append('end_date', endDate.toISOString().split('T')[0]);
    }
    
    const queryString = params.toString();
    if (queryString) {
      url += `&${queryString}`;
    }
    
    return api.get<ActivityItem[]>(url);
  },

  async getAgentStats(startDate?: Date, endDate?: Date): Promise<AgentStat[]> {
    let url = `${BASE_PATH}/treatments/dashboard/agent-stats`;
    const params = new URLSearchParams();
    
    if (startDate) {
      params.append('start_date', startDate.toISOString().split('T')[0]);
    }
    if (endDate) {
      params.append('end_date', endDate.toISOString().split('T')[0]);
    }
    
    const queryString = params.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
    
    return api.get<AgentStat[]>(url);
  },

  async getTaskDistribution(): Promise<TaskDistribution[]> {
    return api.get<TaskDistribution[]>(`${BASE_PATH}/treatments/dashboard/task-distribution`);
  },

  async getAllDashboardData(startDate?: Date, endDate?: Date): Promise<DashboardAllData> {
    let url = `${BASE_PATH}/treatments/dashboard/all`;
    const params = new URLSearchParams();
    
    if (startDate) {
      params.append('start_date', startDate.toISOString().split('T')[0]);
    }
    if (endDate) {
      params.append('end_date', endDate.toISOString().split('T')[0]);
    }
    
    const queryString = params.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
    
    return api.get<DashboardAllData>(url);
  },
};
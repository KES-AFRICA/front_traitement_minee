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
} from "@/lib/types/treatment-service";
import { api } from "../client";

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

  /**
   * Met un feeder en attente de validation (après traitement terminé)
   */
  async setPendingValidation(request: SetPendingValidationRequest): Promise<{ success: boolean; message: string }> {
    return api.put(`${BASE_PATH}/treatments/pending-validation/${request.feeder_id}`, request);
  },

  async validateTreatment(request: ValidateTreatmentRequest): Promise<{ success: boolean; message: string }> {
    return api.put(`${BASE_PATH}/treatments/validate/${request.feeder_id}`, request);
  },

  async rejectTreatment(request: RejectTreatmentRequest): Promise<{ success: boolean; message: string }> {
    return api.put(`${BASE_PATH}/treatments/reject/${request.feeder_id}`, request);
  },

  /**
   * Met un feeder en attente de traitement (après collecte terminée)
   */
  async setPending(request: SetPendingRequest): Promise<{ success: boolean; message: string }> {
    return api.put(`${BASE_PATH}/treatments/pending/${request.feeder_id}`, request);
  },

  /**
   * Met un feeder en cours de collecte (état initial)
   */
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
  // DASHBOARD
  // ============================================================

  async getDashboardStats(): Promise<DashboardStatsResponse> {
    return api.get<DashboardStatsResponse>(`${BASE_PATH}/treatments/dashboard/stats`);
  },
};
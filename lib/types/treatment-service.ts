// lib/types/treatment-service.ts

// ============================================================
// SCHÉMAS DE BASE
// ============================================================

export interface Feeder {
  m_rid: string;
  name: string;
  voltage: number | null;
  is_injection: number;
  local_name: string | null;
  created_at: string;
  qrcode: string | null;
  collected_by: string | null;
  collected_at: string | null;
  location: string | null;
  max_power_off_peak: string | null;
  max_power_rush: string | null;
  min_power_off_peak: string | null;
  min_power_rush: string | null;
  peak_off_hour: string | null;
  rush_hour: string | null;
}

export interface Substation {
  m_rid: string;
  name: string;
  type: string | null;
  regime: string | null;
  exploitation: string | null;
  latitude: number | null;
  longitude: number | null;
  altitude: number | null;
  photo: string | null;
  created_at: string;
  qrcode: string | null;
  active: number;
}

export interface PowerTransformer {
  m_rid: string;
  name: string;
  apparent_power: number | null;
  w1_voltage: number | null;
  w2_voltage: number | null;
  active: number;
  latitude: number | null;
  longitude: number | null;
  photo: string | null;
  created_at: string;
  collect_by: string | null;
  collect_at: string | null;
}

export interface Bay {
  m_rid: string;
  name: string;
  type: string | null;
  voltage: number | null;
  status: string | null;
  photo: string | null;
  created_at: string;
  busbar_id1: string | null;
  qrcode: string | null;
}

export interface Switch {
  m_rid: string;
  name: string;
  type: string | null;
  phase: string | null;
  voltage: number | null;
  normal_open: number | null;
  created_at: string;
  bay_id: string | null;
  qrcode: string | null;
}

export interface BtBoard {
  m_rid: number;
  type: string | null;
  capacite: string | null;
  photo: string | null;
  power_transformers_m_rid: string | null;
}

export interface Arm {
  m_rid: number;
  type: string | null;
  count: string | null;
  status: string | null;
  pole_m_rid: number | null;
}

// ============================================================
// TRAITEMENTS (TREATMENTS)
// ============================================================

export type TreatmentStatus = 
  | 'assigned' 
  | 'in_progress' 
  | 'pending'
  | 'completed' 
  | 'validated' 
  | 'rejected'
  | 'pending_collection'
  | 'collecting'
  | 'pending_treatment'
  | 'pending_validation';

export interface Treatment {
  idtreatments: number;
  type: string | null;
  asigned_at: string | null;
  asigned_by: string | null;
  asigned_to: string | null;
  started_at: string | null;
  feeder: string;
  end_at: string | null;
  status: TreatmentStatus | null;
  validated_by: string | null;
  duration_seconds: number | null;
}

export interface TreatmentWithNames extends Treatment {
  assigned_name?: string;
  validated_name?: string;
  feeder_name?: string;
}

// ============================================================
// REQUÊTES / RÉPONSES
// ============================================================

// GET /feeders/source
export interface FeederSourceResponse {
  count: number;
  feeders: FeederSourceItem[];
}

export interface FeederSourceItem {
  feeder_id: string;
  feeder_name: string;
  substation_source: {
    id: string | null;
    name: string | null;
    exploitation: string | null;
    decoupage: string | null;
  };
  assigned_agent_id: string | null;
  assigned_agent_name: string | null;
  treatment_status: TreatmentStatus | null;
}

// GET /treatments/feeder/{feeder_id}
export interface TreatmentStatusResponse {
  feeder_id: string;
  feeder_name: string | null;
  status: TreatmentStatus | null;
  assigned_to: string | null;
  assigned_to_name: string | null;
  assigned_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  validated_by: string | null;
  validated_by_name: string | null;
}

// POST /treatments/assign
export interface AssignTreatmentRequest {
  feeder_id: string;
  agent_id: string;
  agent_name: string;
  assigned_by: string;
  assigned_by_name: string;
}

// PUT /treatments/start/{feeder_id}
export interface StartTreatmentRequest {
  feeder_id: string;
  started_by: string;
  started_by_name: string;
}

// PUT /treatments/complete/{feeder_id}
export interface CompleteTreatmentRequest {
  feeder_id: string;
  completed_by: string;
  completed_by_name: string;
}

// PUT /treatments/validate/{feeder_id}
export interface ValidateTreatmentRequest {
  feeder_id: string;
  validated_by: string;
  validated_by_name: string;
  comment?: string;
}

// PUT /treatments/reject/{feeder_id}
export interface RejectTreatmentRequest {
  feeder_id: string;
  rejected_by: string;
  rejected_by_name: string;
  reason: string;
}

// GET /treatments/agent/{agent_id}
export interface AgentTreatmentsResponse {
  agent_id: string;
  count: number;
  treatments: Array<{
    feeder: string;
    feeder_name: string | null;
    status: TreatmentStatus | null;
    asigned_at: string | null;
    started_at: string | null;
    end_at: string | null;
    duration_seconds: number | null;
  }>;
}

// PUT /treatments/attribute
export interface AttributeUpdateRequest {
  feeder_id: string;
  table_name: string;
  record_id: string;
  attribute_name: string;
  new_value: any;
  changed_by: string;
  changed_by_name: string;
  comment?: string;
}

export interface AttributeUpdateResponse {
  success: boolean;
  message: string;
  old_value: any;
  new_value: any;
}

// GET /treatments/attribute/history/{feeder_id}
export interface AttributeHistoryResponse {
  feeder_id: string;
  count: number;
  history: AttributeHistoryItem[];
}

export interface AttributeHistoryItem {
  idjournal: number;
  table: string;
  column: string;
  old_column_value: string | null;
  new_column_value: string | null;
  comment: string | null;
  created_at: string;
  changed_by_name: string | null;
}

// GET /treatments/tables
export interface TablesResponse {
  tables: Record<string, string[]>;
  count: number;
}

// GET /treatments/dashboard/stats
export interface DashboardStatsResponse {
  by_status: Array<{ status: string; count: number }>;
  average_treatment_duration_seconds: number | null;
  top_agents: Array<{
    asigned_to: string;
    agent_name: string;
    treatments_count: number;
    avg_duration: number | null;
  }>;
}

// Réponse générique
export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

// Nouvelles requêtes pour les statuts
export interface SetCollectingRequest {
  feeder_id: string;
  changed_by: string;
  changed_by_name: string;
}

export interface SetPendingRequest {
  feeder_id: string;
  completed_by: string;
  completed_by_name: string;
}

export interface SetPendingValidationRequest {
  feeder_id: string;
  completed_by: string;
  completed_by_name: string;
}

// À ajouter dans le fichier des types

export interface FeederCreate {
  m_rid: string;
  name?: string;
  voltage?: number;
  is_injection?: number;
  local_name?: string;
  qrcode?: string;
  collected_by?: string;
  collected_at?: string;
  location?: string;
  max_power_off_peak?: string;
  max_power_rush?: string;
  min_power_off_peak?: string;
  min_power_rush?: string;
  peak_off_hour?: string;
  rush_hour?: string;
  created_at?: string;
}

export interface SubstationCreate {
  m_rid: string;
  photo?: string;
  name?: string;
  highest_voltage_level?: number;
  second_substation_id?: string;
  exploitation?: string;
  latitude?: number;
  longitude?: number;
  altitude?: number;
  precision?: number;
  regime?: string;
  type?: string;
  zone_type?: string;
  security_zone_id?: string;
  active?: number;
  display_scada?: number;
  created_at?: string;
  arrondissements_m_rid?: number;
  exploitation_m_rid?: number;
  qrcode?: string;
  collect_agent_name?: string;
  collected_date?: string;
}

export interface WireCreate {
  m_rid: string;
  nature_conducteur?: string;
  phase?: string;
  section?: string;
  type?: string;
  t1?: string;
  t2?: string;
  active?: number;
  display_scada?: number;
  feeder_id?: string;
  nature_bien?: string;
  nature_isolant?: string;
  mode_pose?: string;
  profondeur?: string;
  init_name?: string;
  final_name?: string;
  init_qrcode?: string;
  final_qrcode?: string;
  created_at?: string;
}

export interface BayCreate {
  m_rid: string;
  substation_id?: string;
  photo?: string;
  name?: string;
  type?: string;
  phase?: string;
  voltage?: number;
  status?: string;
  latitude?: number;
  longitude?: number;
  altitude?: number;
  precision?: number;
  active?: number;
  display_scada?: number;
  created_at?: string;
  qrcode?: string;
  busbar_id1?: string;
  busbar_id2?: string;
}

export interface PowerTransformerCreate {
  m_rid: string;
  photo?: string;
  substation_id?: string;
  name?: string;
  apparent_power?: number;
  w1_voltage?: number;
  w2_voltage?: number;
  t1?: string;
  t2?: string;
  latitude?: number;
  longitude?: number;
  altitude?: number;
  precision?: number;
  active?: number;
  display_scada?: number;
  created_at?: string;
  pole_m_rid?: number;
  qrcode?: string;
  admitance?: number;
  b_mac?: number;
  clock_number?: number;
  current_flow?: number;
  flow?: number;
  mag_base_u?: number;
  mag_sat_flux?: number;
  collect_by?: string;
  collect_at?: string;
}

export interface SwitchCreate {
  m_rid: string;
  bay_id?: string;
  feeder_id?: string;
  photo?: string;
  nature?: string;
  t1?: string;
  t2?: string;
  voltage?: number;
  second_switch_id?: string;
  name?: string;
  normal_open?: number;
  phase?: string;
  type?: string;
  latitude?: number;
  longitude?: number;
  altitude?: number;
  precision?: string;
  active?: number;
  display_scada?: number;
  created_at?: string;
  qrcode?: string;
  structure_m_rid?: number;
}

export interface BusbarCreate {
  m_rid: string;
  substation_id?: string;
  photo?: string;
  name?: string;
  voltage?: number;
  phase?: string;
  is_injection?: number;
  is_feederhead?: number;
  t1?: string;
  active?: number;
  display_scada?: number;
  created_at?: string;
  qrcode?: string;
  collected_by?: string;
  collected_at?: string;
  feeder_id?: string;
}

export interface InsertResponse {
  success: boolean;
  message: string;
  m_rid?: string;
}
// lib/types/comparison.ts

export interface AnomalyItem {
  id: string;
  type: AnomalyType;
  table: string;
  mrid: string;
  name: string | null;
  data?: Record<string, any>;
  reference_data?: Record<string, any>;
  collected_data?: Record<string, any>;
  duplicate_occurrences?: DuplicateOccurrence[];
  divergent_fields?: DivergentField[];
}

export interface EquipmentDetail {
  id: string;
  mrid: string | number;
  table: string;
  name: string;
  data: Record<string, any>;
  anomalies: AnomalyItem[];
  photo?: string | null;
  location?: { lat: number; lng: number };
  
}

// Types pour l'arborescence des feeders
export interface FeederTreeFeeder {
  feeder_id: string;
  feeder_name: string;
}

export interface FeederTreeSubstation {
  id: string;
  name: string;
  feeders: FeederTreeFeeder[];
}

export interface FeederTreeGroup {
  decoupage: string;
  substations: FeederTreeSubstation[];
}

// ============================================================
// TYPES POUR /comparison/feeders/source
// ============================================================

export interface FeederSourceSubstation {
  id: string | null;
  name: string | null;
  exploitation: string | null;
  decoupage: "DRD" | "DRY" | null;
}

export interface FeederSource {
  feeder_id: string;
  feeder_name: string;
  treatment_status: string;
  substation_source: FeederSourceSubstation;
}

export interface FeedersSourceResponse {
  count: number;
  feeders: FeederSource[];
}

// ============================================================
// TYPES POUR /comparison/compare/{feeder_id}
// ============================================================

export type AnomalyType = "ok" | "duplicate" | "divergence" | "new" | "missing" | "complex";

export type TableName = 
  | "feeder"
  | "substation"
  | "bus_bar"
  | "bay"
  | "switch"
  | "powertransformer"
  | "wire";

export interface DivergentField {
  field: string;
  reference_value: any;
  collected_value: any;
}

export interface DuplicateOccurrence {
  m_rid: string;
  name: string | null;
  substations_m_rid: string | null;
  full_record?: Record<string, any>;
}

export interface Duplicate {
  duplicate_type?: "same_mrid" | "same_name";
  key?: string;
  count: number;
  occurrences: DuplicateOccurrence[];
}

export interface Divergence {
  mrid: string;
  name?: string;
  reference_data: Record<string, any>;
  collected_data: Record<string, any>;
  divergent_fields: DivergentField[];
}

export interface NewItem {
  m_rid: string;
  name: string | null;
  full_record?: Record<string, any>;
}

export interface MissingItem {
  m_rid: string;
  name: string | null;
  full_record?: Record<string, any>;
}

// ✅ MODIFICATION : OkItem avec data (toutes les données)
export interface OkItem {
  mrid: string;
  name?: string | null;
  data?: Record<string, any>;  // ← Toutes les données de l'équipement
}

export interface TableComparisonResult {
  reference: Record<string, any>[] | null;
  table: TableName;
  duplicates: Duplicate[];
  new: NewItem[];
  missing: MissingItem[];
  divergences: Divergence[];
  ok: OkItem[];  // ← Changé pour utiliser OkItem
}

export interface FeederComparisonSummary {
  total: number;
  duplicate: number;
  divergence: number;
  new: number;
  missing: number;
  complex: number;
  ok: number;
}

export interface FeederComparisonResult {
  feeder_id: string;
  feeder_name: string;
  analyzed_at: string;
  tables: Record<TableName, TableComparisonResult>;
  summary: FeederComparisonSummary;
}
export interface CollecteMetric {
  collectes: number;
  attendus: number | null;
  taux: number | null;
}

export interface CollecteGlobal {
  postes_collectes: CollecteMetric;
  feeders: CollecteMetric;
  postes_source: CollecteMetric;
  h59: CollecteMetric;
  h61: CollecteMetric;
  busbars: CollecteMetric;
  bays: CollecteMetric;
  transformers: CollecteMetric;
  switches: CollecteMetric;
  wires: CollecteMetric;
  armement: CollecteMetric;
  appareillage: CollecteMetric;
  tableau_bt: CollecteMetric;
  supports: CollecteMetric;
  pts_remarquables: CollecteMetric;
  derivations: CollecteMetric;
  ocr: CollecteMetric;
  clients_commerciaux: CollecteMetric;
}

export interface EquipeItem {
  nom: string;
  nb_soumissions: number;
  /** ISO 8601 datetime, ex: "2026-04-08T10:17:36" */
  premiere_soumission: string;
  /** ISO 8601 datetime */
  derniere_soumission: string;
}

export interface CollecteEquipes {
  total_actives: number;
  liste: EquipeItem[];
}

export interface FeederItem {
  id: string;
  nom: string;
}

export interface CollecteFeeders extends CollecteMetric {
  liste: FeederItem[];
}

export interface DecoupageStats {
  decoupage: string;
  postes_collectes: CollecteMetric;
  feeders: CollecteMetric;
  postes_source: CollecteMetric;
  h59: CollecteMetric;
  h61: CollecteMetric;
  busbars: CollecteMetric;
  bays: CollecteMetric;
  transformers: CollecteMetric;
  switches: CollecteMetric;
  wires: CollecteMetric;
  armement: CollecteMetric;
  appareillage: CollecteMetric;
  tableau_bt: CollecteMetric;
  supports: CollecteMetric;
  pts_remarquables: CollecteMetric;
  derivations: CollecteMetric;
  ocr: CollecteMetric;
}

export interface CollecteStatsResponse {
  global: CollecteGlobal;
  equipes: CollecteEquipes;
  feeders: CollecteFeeders;
  decoupage: DecoupageStats[];
}

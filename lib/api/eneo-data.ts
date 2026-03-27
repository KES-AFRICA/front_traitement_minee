// =============================================================================
// lib/api/eneo-data-real.ts
// Adaptateur : connecte le ComparisonService aux structures attendues
// par les pages duplicates, divergences, new-data et missing-records.
//
// Remplace les données mock aléatoires par les vraies anomalies détectées.
// =============================================================================

import { AnomalyCase, TableName, DivergentField } from "../types/eneo-assets";
import { runComparison } from "./services/comparison.service";
import { layer1DB } from "@/data/layer1";
import { layer2DB } from "@/data/layer2";

// ─── Structure de navigation DRD-O (Douala Ouest) ────────────────────────
// Découpage : DRD > DRD-O > Bonaberi > D11 / D12
// Adapté à votre BD qui ne couvre que Douala Ouest

export interface EneoDeparture {
  id: string;
  code: string;
  name: string;
  feederId: number | string;
  equipmentCount: number;          // nombre d'équipements BD1
  anomalyCounts: {
    duplicate: number;
    divergence: number;
    new: number;
    missing: number;
    complex: number;
  };
}

export interface EneoZone {
  id: string;
  code: string;
  name: string;
  departures: EneoDeparture[];
}

export interface EneoRegion {
  id: string;
  code: string;
  name: string;
  fullName: string;
  zones: EneoZone[];
}

// ─── Caches pour les résolutions de relations ────────────────────────────────

// Cache substation → feeder
const substationToFeederCache = new Map<string, string>();

// Cache bay → substation
const bayToSubstationCache = new Map<string, string>();

// Cache pole → feeder
const poleToFeederCache = new Map<string, string>();

// ─── Fonctions de résolution des relations ───────────────────────────────────

/**
 * Récupère le feeder_id d'une substation
 */
function getFeederIdForSubstation(substationId: string | number): string | null {
  const key = String(substationId);
  if (substationToFeederCache.has(key)) {
    return substationToFeederCache.get(key) || null;
  }
  
  // Chercher d'abord dans BD1
  const substation = layer1DB.substation.find(s => String(s.m_rid) === key);
  if (substation && substation.feeder_id) {
    const feederId = String(substation.feeder_id);
    substationToFeederCache.set(key, feederId);
    return feederId;
  }
  
  // Chercher dans BD2 si pas trouvé dans BD1
  const substationL2 = (layer2DB.substation || []).find(s => String(s.m_rid) === key);
  if (substationL2 && substationL2.feeder_id) {
    const feederId = String(substationL2.feeder_id);
    substationToFeederCache.set(key, feederId);
    return feederId;
  }
  
  substationToFeederCache.set(key, "");
  return null;
}

/**
 * Récupère le feeder_id d'une bay (via substation)
 */
function getFeederIdForBay(bayId: string | number): string | null {
  const key = String(bayId);
  if (bayToSubstationCache.has(key)) {
    const substationId = bayToSubstationCache.get(key);
    if (substationId) {
      return getFeederIdForSubstation(substationId);
    }
    return null;
  }
  
  // Chercher dans BD1
  const bay = layer1DB.bay.find(b => String(b.m_rid) === key);
  if (bay && bay.substation_id) {
    const substationId = String(bay.substation_id);
    bayToSubstationCache.set(key, substationId);
    return getFeederIdForSubstation(substationId);
  }
  
  // Chercher dans BD2
  const bayL2 = (layer2DB.bay || []).find(b => String(b.m_rid) === key);
  if (bayL2 && bayL2.substation_id) {
    const substationId = String(bayL2.substation_id);
    bayToSubstationCache.set(key, substationId);
    return getFeederIdForSubstation(substationId);
  }
  
  bayToSubstationCache.set(key, "");
  return null;
}

/**
 * Récupère le feeder_id d'un poteau
 */
function getFeederIdForPole(poleId: string | number): string | null {
  const key = String(poleId);
  if (poleToFeederCache.has(key)) {
    return poleToFeederCache.get(key) || null;
  }
  
  // Chercher dans BD1
  const pole = layer1DB.pole.find(p => String(p.m_rid) === key);
  if (pole && pole.feeder_id) {
    const feederId = String(pole.feeder_id);
    poleToFeederCache.set(key, feederId);
    return feederId;
  }
  
  // Chercher dans BD2
  const poleL2 = (layer2DB.pole || []).find(p => String(p.m_rid) === key);
  if (poleL2 && poleL2.feeder_id) {
    const feederId = String(poleL2.feeder_id);
    poleToFeederCache.set(key, feederId);
    return feederId;
  }
  
  poleToFeederCache.set(key, "");
  return null;
}

/**
 * Fonction principale : extrait le feeder_id d'un enregistrement
 * Gère toutes les tables avec leurs relations spécifiques
 */
function extractFeederId(record: Record<string, unknown> | null): string {
  if (!record) return "";
  
  // 1. Champ direct feeder_id (substation, wire, pole, feeder)
  if (record.feeder_id) {
    return String(record.feeder_id);
  }
  
  // 2. Par substation_id (powertransformer, busbar, bay)
  if (record.substation_id) {
    const feederId = getFeederIdForSubstation(String(record.substation_id));
    if (feederId) return feederId;
  }
  
  // 3. Par bay_mrid (switch)
  if (record.bay_mrid) {
    const feederId = getFeederIdForBay(String(record.bay_mrid));
    if (feederId) return feederId;
  }
  
  // 4. Par pole_id (node)
  if (record.pole_id) {
    const feederId = getFeederIdForPole(String(record.pole_id));
    if (feederId) return feederId;
  }
  
  return "";
}

// ─── Singleton : comparaison lancée une seule fois ────────────────────────
let _comparisonCache: ReturnType<typeof runComparison> | null = null;

function getComparison() {
  if (!_comparisonCache) {
    _comparisonCache = runComparison();
  }
  return _comparisonCache;
}

// ─── Construction de la hiérarchie depuis les données réelles ─────────────

function buildDeparture(feederId: number | string, feederName: string): EneoDeparture {
  const result = getComparison();
  const feederStr = String(feederId);

  // Anomalies relatives à ce départ (avec résolution des relations)
  const feederCases = result.cases.filter((c) => {
    const fid1 = extractFeederId(c.layer1Record);
    const fid2 = extractFeederId(c.layer2Record);
    return fid1 === feederStr || fid2 === feederStr;
  });

  // Nombre total d'équipements BD1 pour ce départ (toutes tables)
  const tables: TableName[] = ["substation", "powertransformer", "busbar", "bay", "switch", "wire", "pole", "node"];
  let equipmentCount = 0;
  for (const table of tables) {
    const records = layer1DB[table] as unknown as Array<Record<string, unknown>>;
    if (!records) continue;
    
    equipmentCount += records.filter((r) => {
      const fid = extractFeederId(r);
      return fid === feederStr;
    }).length;
  }

  return {
    id: feederStr,
    code: feederName.split(" ")[0].replace("BON.", "D").replace("BON.D", "D") || feederStr,
    name: feederName,
    feederId,
    equipmentCount,
    anomalyCounts: {
      duplicate: feederCases.filter((c) => c.type === "duplicate").length,
      divergence: feederCases.filter((c) => c.type === "divergence").length,
      new: feederCases.filter((c) => c.type === "new").length,
      missing: feederCases.filter((c) => c.type === "missing").length,
      complex: feederCases.filter((c) => c.type === "complex").length,
    },
  };
}

// ─── Hiérarchie statique DRD-O avec données réelles ──────────────────────

// Récupérer les feeders depuis layer1DB
const feeders = layer1DB.feeder;

export const eneoRegions: EneoRegion[] = [
  {
    id: "DRD",
    code: "DRD",
    name: "Direction Régionale Douala",
    fullName: "Direction Régionale Douala",
    zones: [
      {
        id: "DRD-O",
        code: "DRD-O",
        name: "Douala Ouest",
        departures: feeders.map((feeder) => buildDeparture(feeder.m_rid, feeder.name)),
      },
    ],
  },
];

// ─── Accesseurs des anomalies par départ ─────────────────────────────────

export function getAnomaliesByFeeder(feederId: string | number, type?: AnomalyCase["type"]): AnomalyCase[] {
  const result = getComparison();
  const targetFeeder = String(feederId);
  
  return result.cases.filter((c) => {
    const fid1 = extractFeederId(c.layer1Record);
    const fid2 = extractFeederId(c.layer2Record);
    const matchFeeder = fid1 === targetFeeder || fid2 === targetFeeder;
    const matchType = type ? c.type === type : true;
    return matchFeeder && matchType;
  });
}

export function getAllAnomalies(type?: AnomalyCase["type"]): AnomalyCase[] {
  const result = getComparison();
  return type ? result.cases.filter((c) => c.type === type) : result.cases;
}

export function getComparisonStats() {
  return getComparison().stats;
}

// ─── Compatibilité avec les fonctions getRegionStats / getZoneStats ───────

export function getRegionStats(regionId: string) {
  const result = getComparison();
  return {
    total: result.stats.total,
    pending: result.stats.missing + result.stats.new,
    inProgress: result.stats.duplicate + result.stats.divergence + result.stats.complex,
    completed: 0, // aucun cas résolu automatiquement
  };
}

export function getZoneStats(zoneId: string) {
  // Pour l'instant une seule zone DRD-O → même stats
  return getRegionStats(zoneId);
}

// ─── Types ré-exportés pour compatibilité ────────────────────────────────
export type { AnomalyCase, TableName, DivergentField };
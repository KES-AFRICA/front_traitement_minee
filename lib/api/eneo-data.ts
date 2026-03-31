// =============================================================================
// lib/api/eneo-data.ts
// Adaptateur : connecte le ComparisonService aux structures attendues
// par les pages duplicates, divergences, new-data et missing-records.
// =============================================================================

import { AnomalyCase, TableName, DivergentField } from "../types/eneo-assets";
import { runComparison } from "./services/comparison.service";
import { layer1DB } from "@/data/layer1";
import { layer2DB } from "@/data/layer2";

// ─── Structure de navigation DRD-O (Douala Ouest) ────────────────────────

export interface EneoDeparture {
  id: string;
  code: string;
  name: string;
  feederId: number | string;
  equipmentCount: number;
  anomalyCounts: {
    duplicate: number;
    divergence: number;
    new: number;
    missing: number;
    complex: number;
  };
  collectionStats?: {
    totalAttendu: number;
    collectes: number;
    manquantsRestants: number;
    tauxProgression: number;
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

export interface ComplexCaseStats {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
}


// ─── Caches pour les résolutions de relations ────────────────────────────────

const substationToFeederCache = new Map<string, string>();
const bayToSubstationCache = new Map<string, string>();
const poleToFeederCache = new Map<string, string>();
const collectedEquipmentCache = new Map<string, Set<string>>();

// ─── Fonctions de résolution des relations ───────────────────────────────────

function getFeederIdForSubstation(substationId: string | number): string | null {
  const key = String(substationId);
  if (substationToFeederCache.has(key)) {
    return substationToFeederCache.get(key) || null;
  }
  
  const substation = layer1DB.substation.find(s => String(s.m_rid) === key);
  if (substation && substation.feeder_id) {
    const feederId = String(substation.feeder_id);
    substationToFeederCache.set(key, feederId);
    return feederId;
  }
  
  const substationL2 = (layer2DB.substation || []).find(s => String(s.m_rid) === key);
  if (substationL2 && substationL2.feeder_id) {
    const feederId = String(substationL2.feeder_id);
    substationToFeederCache.set(key, feederId);
    return feederId;
  }
  
  substationToFeederCache.set(key, "");
  return null;
}

function getFeederIdForBay(bayId: string | number): string | null {
  const key = String(bayId);
  if (bayToSubstationCache.has(key)) {
    const substationId = bayToSubstationCache.get(key);
    if (substationId) {
      return getFeederIdForSubstation(substationId);
    }
    return null;
  }
  
  const bay = layer1DB.bay.find(b => String(b.m_rid) === key);
  if (bay && bay.substation_id) {
    const substationId = String(bay.substation_id);
    bayToSubstationCache.set(key, substationId);
    return getFeederIdForSubstation(substationId);
  }
  
  const bayL2 = (layer2DB.bay || []).find(b => String(b.m_rid) === key);
  if (bayL2 && bayL2.substation_id) {
    const substationId = String(bayL2.substation_id);
    bayToSubstationCache.set(key, substationId);
    return getFeederIdForSubstation(substationId);
  }
  
  bayToSubstationCache.set(key, "");
  return null;
}

function getFeederIdForPole(poleId: string | number): string | null {
  const key = String(poleId);
  if (poleToFeederCache.has(key)) {
    return poleToFeederCache.get(key) || null;
  }
  
  const pole = layer1DB.pole.find(p => String(p.m_rid) === key);
  if (pole && pole.feeder_id) {
    const feederId = String(pole.feeder_id);
    poleToFeederCache.set(key, feederId);
    return feederId;
  }
  
  const poleL2 = (layer2DB.pole || []).find(p => String(p.m_rid) === key);
  if (poleL2 && poleL2.feeder_id) {
    const feederId = String(poleL2.feeder_id);
    poleToFeederCache.set(key, feederId);
    return feederId;
  }
  
  poleToFeederCache.set(key, "");
  return null;
}

function extractFeederId(record: Record<string, unknown> | null): string {
  if (!record) return "";
  
  if (record.feeder_id) {
    return String(record.feeder_id);
  }
  
  if (record.substation_id) {
    const feederId = getFeederIdForSubstation(String(record.substation_id));
    if (feederId) return feederId;
  }
  
  if (record.bay_mrid) {
    const feederId = getFeederIdForBay(String(record.bay_mrid));
    if (feederId) return feederId;
  }
  
  if (record.pole_id) {
    const feederId = getFeederIdForPole(String(record.pole_id));
    if (feederId) return feederId;
  }
  
  return "";
}

// ─── Fonction pour extraire le feeder d'un cas complexe ───────────────────────

function extractFeederIdForComplexCase(anomaly: AnomalyCase): string {
  const record = anomaly.layer2Record || anomaly.layer1Record;
  if (!record) return "";
  
  const directFeeder = extractFeederId(record);
  if (directFeeder) return directFeeder;
  
  // Pour les cas sans feeder direct, essayer de déterminer via d'autres moyens
  if (record.substation_id) {
    // Le substation_id peut être un ID valide mais non résolu
    // On retourne une chaîne vide pour indiquer "sans feeder"
    return "";
  }
  
  return "";
}

// ─── Fonction pour calculer les équipements déjà collectés ───────────────────

function buildCollectedEquipmentCache(): void {
  const result = getComparison();
  
  for (const c of result.cases) {
    if (c.type === "missing") continue;
    
    if (c.layer1Record) {
      const feederId = extractFeederId(c.layer1Record);
      const mrid = String(c.mrid);
      
      if (feederId) {
        if (!collectedEquipmentCache.has(feederId)) {
          collectedEquipmentCache.set(feederId, new Set());
        }
        collectedEquipmentCache.get(feederId)!.add(mrid);
      }
    }
  }
}

// ─── Fonctions pour les KPIs des manquants ───────────────────────────────────

function getCollectionStatsForFeeder(feederId: string | number): {
  totalAttendu: number;
  collectes: number;
  manquantsRestants: number;
  tauxProgression: number;
} {
  const feederStr = String(feederId);
  
  const tables: TableName[] = ["substation", "powertransformer", "busbar", "bay", "switch", "wire", "pole", "node"];
  let totalAttendu = 0;
  const layer1Mrids: string[] = [];
  
  for (const table of tables) {
    const records = layer1DB[table] as unknown as Array<Record<string, unknown>>;
    if (!records) continue;
    
    for (const record of records) {
      const fid = extractFeederId(record);
      if (fid === feederStr) {
        totalAttendu++;
        layer1Mrids.push(String(record.m_rid));
      }
    }
  }
  
  const collectedSet = collectedEquipmentCache.get(feederStr) || new Set();
  
  let collectes = 0;
  for (const mrid of layer1Mrids) {
    if (collectedSet.has(mrid)) {
      collectes++;
    }
  }
  
  const manquantsRestants = totalAttendu - collectes;
  const tauxProgression = totalAttendu > 0 ? Math.round((collectes / totalAttendu) * 100) : 0;
  
  return {
    totalAttendu,
    collectes,
    manquantsRestants,
    tauxProgression,
  };
}

// ─── Singleton : comparaison lancée une seule fois ────────────────────────

let _comparisonCache: ReturnType<typeof runComparison> | null = null;

function getComparison() {
  if (!_comparisonCache) {
    _comparisonCache = runComparison();
    buildCollectedEquipmentCache();
  }
  return _comparisonCache;
}

// ─── Construction de la hiérarchie depuis les données réelles ─────────────

function buildDeparture(feederId: number | string, feederName: string): EneoDeparture {
  const result = getComparison();
  const feederStr = String(feederId);

  const feederCases = result.cases.filter((c) => {
    const fid1 = extractFeederId(c.layer1Record);
    const fid2 = extractFeederId(c.layer2Record);
    return fid1 === feederStr || fid2 === feederStr;
  });

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

  const collectionStats = getCollectionStatsForFeeder(feederId);

  return {
    id: feederStr,
    code: feederName.split(" ")[0].replace("BON.", "").replace("BON.D", "") || feederStr,
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
    collectionStats,
  };
}

// ─── Départ spécial pour les équipements sans feeder ───────────────────────

function buildOrphanDeparture(): EneoDeparture | null {
  const result = getComparison();
  const orphanCases = result.cases.filter((c) => {
    if (c.type !== "complex") return false;
    const fid = extractFeederIdForComplexCase(c);
    return fid === "";
  });
  
  if (orphanCases.length === 0) return null;
  
  return {
    id: "orphan",
    code: "ORPHELIN",
    name: "Équipements sans feeder",
    feederId: "orphan",
    equipmentCount: orphanCases.length,
    anomalyCounts: {
      duplicate: 0,
      divergence: 0,
      new: 0,
      missing: 0,
      complex: orphanCases.length,
    },
  };
}

// ─── NOUVELLE FONCTION : Récupérer les feeders UNIQUEMENT depuis layer2DB ───

function getAvailableFeedersFromLayer2(): Array<{ id: string | number; name: string }> {
  const feedersSet = new Map<string | number, string>();
  
  // Parcourir toutes les tables de layer2DB pour trouver les feeders_id
  const tables: TableName[] = ["substation", "powertransformer", "busbar", "bay", "switch", "wire", "pole", "node", "feeder"];
  
  tables.forEach(table => {
    const records = (layer2DB as any)[table] || [];
    records.forEach((record: any) => {
      // Si c'est un feeder directement
      if (table === "feeder" && record.m_rid) {
        if (!feedersSet.has(record.m_rid)) {
          feedersSet.set(record.m_rid, record.name || String(record.m_rid));
        }
      }
      // Pour les équipements, récupérer leur feeder_id
      if (record.feeder_id && !feedersSet.has(record.feeder_id)) {
        // Chercher le nom du feeder dans layer1DB ou layer2DB
        let feederName = String(record.feeder_id);
        
        // Chercher dans layer1DB
        const feederFromL1 = layer1DB.feeder.find(f => String(f.m_rid) === String(record.feeder_id));
        if (feederFromL1) {
          feederName = feederFromL1.name;
        } else {
          // Chercher dans layer2DB
          const feederFromL2 = (layer2DB.feeder || []).find(f => String(f.m_rid) === String(record.feeder_id));
          if (feederFromL2) {
            feederName = feederFromL2.name;
          }
        }
        
        feedersSet.set(record.feeder_id, feederName);
      }
    });
  });
  
  // Convertir en tableau
  const result: Array<{ id: string | number; name: string }> = [];
  feedersSet.forEach((name, id) => {
    result.push({ id, name });
  });
  
  return result;
}

// ─── Hiérarchie DRD-O avec UNIQUEMENT les feeders collectés dans layer2DB ───

export const eneoRegions: EneoRegion[] = [
  {
    id: "DRD",
    code: "DRD",
    name: "DRD",
    fullName: "Direction Régionale Douala",
    zones: [
      {
        id: "DRD-O",
        code: "DRD-O",
        name: "BONABERI",
        departures: (() => {
          // Récupérer UNIQUEMENT les feeders présents dans layer2DB
          const availableFeeders = getAvailableFeedersFromLayer2();
          
          // Construire les départs à partir de ces feeders
          const regularDepartures = availableFeeders.map((feeder) => 
            buildDeparture(feeder.id, feeder.name)
          );
          
          // Ajouter le dossier des orphelins si nécessaire
          const orphanDeparture = buildOrphanDeparture();
          if (orphanDeparture) {
            return [...regularDepartures, orphanDeparture];
          }
          return regularDepartures;
        })(),
      },
    ],
  },
];

// ─── Accesseurs des anomalies par départ ─────────────────────────────────

export function getAnomaliesByFeeder(feederId: string | number, type?: AnomalyCase["type"]): AnomalyCase[] {
  const result = getComparison();
  const targetFeeder = String(feederId);
  
  // Si on demande les orphelins
  if (targetFeeder === "orphan") {
    return result.cases.filter((c) => {
      if (type && c.type !== type) return false;
      if (c.type !== "complex") return false;
      const fid = extractFeederIdForComplexCase(c);
      return fid === "";
    });
  }
  
  return result.cases.filter((c) => {
    const matchType = type ? c.type === type : true;
    if (!matchType) return false;
    
    // Pour les cas complexes, on utilise la fonction spéciale
    if (c.type === "complex") {
      const fid = extractFeederIdForComplexCase(c);
      return fid === targetFeeder;
    }
    
    const fid1 = extractFeederId(c.layer1Record);
    const fid2 = extractFeederId(c.layer2Record);
    return fid1 === targetFeeder || fid2 === targetFeeder;
  });
}

export function getAllAnomalies(type?: AnomalyCase["type"]): AnomalyCase[] {
  const result = getComparison();
  return type ? result.cases.filter((c) => c.type === type) : result.cases;
}

export function getComparisonStats() {
  return getComparison().stats;
}

// ─── Fonctions pour les KPIs des manquants ─────────────────────────────────

export function getCollectionStats(feederId: string | number): {
  totalAttendu: number;
  collectes: number;
  manquantsRestants: number;
  tauxProgression: number;
} {
  return getCollectionStatsForFeeder(feederId);
}

export function getGlobalMissingStats() {
  let totalAttendu = 0;
  let totalCollectes = 0;
  
  eneoRegions.forEach((region) => {
    region.zones.forEach((zone) => {
      zone.departures.forEach((departure) => {
        if (departure.collectionStats) {
          totalAttendu += departure.collectionStats.totalAttendu;
          totalCollectes += departure.collectionStats.collectes;
        }
      });
    });
  });
  
  const manquantsRestants = totalAttendu - totalCollectes;
  const tauxProgression = totalAttendu > 0 ? Math.round((totalCollectes / totalAttendu) * 100) : 0;
  
  return {
    totalAttendu,
    totalCollectes,
    manquantsRestants,
    tauxProgression,
  };
}

// ─── Compatibilité avec les fonctions getRegionStats / getZoneStats ───────

export function getRegionStats(regionId: string) {
  const result = getComparison();
  return {
    total: result.stats.total,
    pending: result.stats.missing + result.stats.new,
    inProgress: result.stats.duplicate + result.stats.divergence + result.stats.complex,
    completed: 0,
  };
}

export function getZoneStats(zoneId: string) {
  return getRegionStats(zoneId);
}

// ─── Types ré-exportés pour compatibilité ────────────────────────────────
export type { AnomalyCase, TableName, DivergentField };
// ENEO Organizational Structure
// Regions -> Zones -> Departures -> Equipments

import { Equipment } from "@/components/complex-cases/equipment-table";

export interface EneoRegion {
  id: string;
  code: string;
  name: string;
  fullName: string;
  zones: EneoZone[];
}

export interface EneoZone {
  id: string;
  code: string;
  name: string;
  regionId: string;
  departures: EneoDeparture[];
}

export interface EneoDeparture {
  id: string;
  code: string;
  name: string;
  zoneId: string;
  equipmentCount: number;
}

export interface ComplexCaseStats {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  validated: number;
  rejected: number;
  completionRate: number;
}

// ENEO Regions Data
export const eneoRegions: EneoRegion[] = [
  {
    id: "drd",
    code: "DRD",
    name: "DRD",
    fullName: "Direction Regionale Douala",
    zones: [
      {
        id: "drd-nord",
        code: "DRD-N",
        name: "Douala Nord",
        regionId: "drd",
        departures: [
          { id: "d11", code: "D11", name: "Depart D11", zoneId: "drd-nord", equipmentCount: 45 },
          { id: "d12", code: "D12", name: "Depart D12", zoneId: "drd-nord", equipmentCount: 38 },
          { id: "d13", code: "D13", name: "Depart D13", zoneId: "drd-nord", equipmentCount: 52 },
        ],
      },
      {
        id: "drd-centre",
        code: "DRD-C",
        name: "Douala Centre",
        regionId: "drd",
        departures: [
          { id: "d21", code: "D21", name: "Depart D21", zoneId: "drd-centre", equipmentCount: 67 },
          { id: "d22", code: "D22", name: "Depart D22", zoneId: "drd-centre", equipmentCount: 43 },
        ],
      },
      {
        id: "drd-sud",
        code: "DRD-S",
        name: "Douala Sud",
        regionId: "drd",
        departures: [
          { id: "d31", code: "D31", name: "Depart D31", zoneId: "drd-sud", equipmentCount: 55 },
          { id: "d32", code: "D32", name: "Depart D32", zoneId: "drd-sud", equipmentCount: 41 },
        ],
      },
      {
        id: "drd-est",
        code: "DRD-E",
        name: "Douala Est",
        regionId: "drd",
        departures: [
          { id: "d41", code: "D41", name: "Depart D41", zoneId: "drd-est", equipmentCount: 36 },
        ],
      },
      {
        id: "drd-ouest",
        code: "DRD-O",
        name: "Douala Ouest",
        regionId: "drd",
        departures: [
          { id: "d51", code: "D51", name: "Depart D51", zoneId: "drd-ouest", equipmentCount: 48 },
          { id: "d52", code: "D52", name: "Depart D52", zoneId: "drd-ouest", equipmentCount: 29 },
        ],
      },
    ],
  },
  {
    id: "dry",
    code: "DRY",
    name: "DRY",
    fullName: "Direction Regionale Yaounde",
    zones: [
      {
        id: "dry-centre",
        code: "DRY-C",
        name: "Yaounde Centre",
        regionId: "dry",
        departures: [
          { id: "y11", code: "Y11", name: "Depart Y11", zoneId: "dry-centre", equipmentCount: 72 },
          { id: "y12", code: "Y12", name: "Depart Y12", zoneId: "dry-centre", equipmentCount: 58 },
        ],
      },
      {
        id: "dry-est",
        code: "DRY-E",
        name: "Yaounde Est",
        regionId: "dry",
        departures: [
          { id: "y21", code: "Y21", name: "Depart Y21", zoneId: "dry-est", equipmentCount: 45 },
        ],
      },
      {
        id: "dry-nord",
        code: "DRY-N",
        name: "Yaounde Nord",
        regionId: "dry",
        departures: [
          { id: "y31", code: "Y31", name: "Depart Y31", zoneId: "dry-nord", equipmentCount: 38 },
          { id: "y32", code: "Y32", name: "Depart Y32", zoneId: "dry-nord", equipmentCount: 42 },
        ],
      },
      {
        id: "dry-ouest",
        code: "DRY-O",
        name: "Yaounde Ouest",
        regionId: "dry",
        departures: [
          { id: "y41", code: "Y41", name: "Depart Y41", zoneId: "dry-ouest", equipmentCount: 33 },
        ],
      },
      {
        id: "dry-sud",
        code: "DRY-S",
        name: "Yaounde Sud",
        regionId: "dry",
        departures: [
          { id: "y51", code: "Y51", name: "Depart Y51", zoneId: "dry-sud", equipmentCount: 51 },
        ],
      },
    ],
  },
  {
    id: "drsom",
    code: "DRSOM",
    name: "DRSOM",
    fullName: "Direction Regionale Sud-Ouest & Moungo",
    zones: [
      {
        id: "drsom-buea",
        code: "DRSOM-B",
        name: "Buea",
        regionId: "drsom",
        departures: [
          { id: "b11", code: "B11", name: "Depart B11", zoneId: "drsom-buea", equipmentCount: 28 },
        ],
      },
      {
        id: "drsom-limbe",
        code: "DRSOM-L",
        name: "Limbe",
        regionId: "drsom",
        departures: [
          { id: "l11", code: "L11", name: "Depart L11", zoneId: "drsom-limbe", equipmentCount: 34 },
        ],
      },
    ],
  },
  {
    id: "dre",
    code: "DRE",
    name: "DRE",
    fullName: "Direction Regionale Est",
    zones: [
      {
        id: "dre-bertoua",
        code: "DRE-B",
        name: "Bertoua",
        regionId: "dre",
        departures: [
          { id: "e11", code: "E11", name: "Depart E11", zoneId: "dre-bertoua", equipmentCount: 22 },
        ],
      },
    ],
  },
  {
    id: "drnea",
    code: "DRNEA",
    name: "DRNEA",
    fullName: "Direction Regionale Nord, Extreme-Nord, Adamaoua",
    zones: [
      {
        id: "drnea-garoua",
        code: "DRNEA-G",
        name: "Garoua",
        regionId: "drnea",
        departures: [
          { id: "g11", code: "G11", name: "Depart G11", zoneId: "drnea-garoua", equipmentCount: 31 },
        ],
      },
      {
        id: "drnea-maroua",
        code: "DRNEA-M",
        name: "Maroua",
        regionId: "drnea",
        departures: [
          { id: "m11", code: "M11", name: "Depart M11", zoneId: "drnea-maroua", equipmentCount: 25 },
        ],
      },
      {
        id: "drnea-ngaoundere",
        code: "DRNEA-N",
        name: "Ngaoundere",
        regionId: "drnea",
        departures: [
          { id: "n11", code: "N11", name: "Depart N11", zoneId: "drnea-ngaoundere", equipmentCount: 19 },
        ],
      },
    ],
  },
  {
    id: "sana",
    code: "SANA",
    name: "SANA",
    fullName: "Sanaga & Ocean",
    zones: [
      {
        id: "sana-edea",
        code: "SANA-E",
        name: "Edea",
        regionId: "sana",
        departures: [
          { id: "s11", code: "S11", name: "Depart S11", zoneId: "sana-edea", equipmentCount: 27 },
        ],
      },
      {
        id: "sana-kribi",
        code: "SANA-K",
        name: "Kribi",
        regionId: "sana",
        departures: [
          { id: "k11", code: "K11", name: "Depart K11", zoneId: "sana-kribi", equipmentCount: 21 },
        ],
      },
    ],
  },
  {
    id: "drc",
    code: "DRC",
    name: "DRC",
    fullName: "Direction Regionale Centre",
    zones: [
      {
        id: "drc-mbalmayo",
        code: "DRC-M",
        name: "Mbalmayo",
        regionId: "drc",
        departures: [
          { id: "c11", code: "C11", name: "Depart C11", zoneId: "drc-mbalmayo", equipmentCount: 18 },
        ],
      },
    ],
  },
  {
    id: "drono",
    code: "DRONO",
    name: "DRONO",
    fullName: "Direction Regionale Ouest & Nord-Ouest",
    zones: [
      {
        id: "drono-bafoussam",
        code: "DRONO-B",
        name: "Bafoussam",
        regionId: "drono",
        departures: [
          { id: "o11", code: "O11", name: "Depart O11", zoneId: "drono-bafoussam", equipmentCount: 35 },
          { id: "o12", code: "O12", name: "Depart O12", zoneId: "drono-bafoussam", equipmentCount: 29 },
        ],
      },
      {
        id: "drono-bamenda",
        code: "DRONO-A",
        name: "Bamenda",
        regionId: "drono",
        departures: [
          { id: "a11", code: "A11", name: "Depart A11", zoneId: "drono-bamenda", equipmentCount: 24 },
        ],
      },
    ],
  },
  {
    id: "drsm",
    code: "DRSM",
    name: "DRSM",
    fullName: "Direction Regionale Sud & Mbalmayo",
    zones: [
      {
        id: "drsm-ebolowa",
        code: "DRSM-E",
        name: "Ebolowa",
        regionId: "drsm",
        departures: [
          { id: "eb11", code: "EB11", name: "Depart EB11", zoneId: "drsm-ebolowa", equipmentCount: 16 },
        ],
      },
    ],
  },
];

// Helper function to get stats for a region
export function getRegionStats(regionId: string): ComplexCaseStats {
  const region = eneoRegions.find((r) => r.id === regionId);
  if (!region) {
    return { total: 0, pending: 0, inProgress: 0, completed: 0, validated: 0, rejected: 0, completionRate: 0 };
  }

  const totalEquipment = region.zones.reduce(
    (acc, zone) => acc + zone.departures.reduce((a, d) => a + d.equipmentCount, 0),
    0
  );

  // Simulated stats based on equipment count
  const completed = Math.floor(totalEquipment * 0.6);
  const inProgress = Math.floor(totalEquipment * 0.15);
  const pending = totalEquipment - completed - inProgress;
  const validated = Math.floor(completed * 0.9);
  const rejected = completed - validated;

  return {
    total: totalEquipment,
    pending,
    inProgress,
    completed,
    validated,
    rejected,
    completionRate: Math.round((completed / totalEquipment) * 100),
  };
}

// Helper function to get stats for a zone
export function getZoneStats(zoneId: string): ComplexCaseStats {
  for (const region of eneoRegions) {
    const zone = region.zones.find((z) => z.id === zoneId);
    if (zone) {
      const totalEquipment = zone.departures.reduce((a, d) => a + d.equipmentCount, 0);
      const completed = Math.floor(totalEquipment * 0.6);
      const inProgress = Math.floor(totalEquipment * 0.15);
      const pending = totalEquipment - completed - inProgress;
      const validated = Math.floor(completed * 0.9);
      const rejected = completed - validated;

      return {
        total: totalEquipment,
        pending,
        inProgress,
        completed,
        validated,
        rejected,
        completionRate: Math.round((completed / totalEquipment) * 100),
      };
    }
  }
  return { total: 0, pending: 0, inProgress: 0, completed: 0, validated: 0, rejected: 0, completionRate: 0 };
}

// Get all regions with their stats
export function getAllRegionsWithStats() {
  return eneoRegions.map((region) => ({
    ...region,
    stats: getRegionStats(region.id),
  }));
}

// Get region by ID
export function getRegionById(regionId: string) {
  return eneoRegions.find((r) => r.id === regionId);
}

// Get zone by ID
export function getZoneById(zoneId: string) {
  for (const region of eneoRegions) {
    const zone = region.zones.find((z) => z.id === zoneId);
    if (zone) {
      return { zone, region };
    }
  }
  return null;
}

// Mock equipment data generator
export function generateMockEquipments(departureId: string, count: number): Equipment[] {
  const types = ["Transformateur", "Poste HTA/BT", "Ligne BT", "Compteur", "Disjoncteur"];
  const locations = ["Quartier Nord", "Quartier Sud", "Zone Industrielle", "Centre-ville", "Peripherie"];
  const statuses: Equipment["status"][] = ["pending", "in_progress", "completed", "validated", "rejected"];
  const users = ["Jean Dupont", "Marie Kouam", "Paul Ndi", "Claire Biya", undefined];

  const equipments: Equipment[] = [];

  for (let i = 0; i < count; i++) {
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    equipments.push({
      id: `${departureId}-eq-${i + 1}`,
      code: `EQ-${departureId.toUpperCase()}-${String(i + 1).padStart(3, "0")}`,
      type: types[Math.floor(Math.random() * types.length)],
      location: locations[Math.floor(Math.random() * locations.length)],
      status,
      lastUpdate: new Date(Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)).toLocaleDateString("fr-FR"),
      assignedTo: users[Math.floor(Math.random() * users.length)],
    });
  }

  return equipments;
}

// Import Equipment type at the top of the file or define it here
export interface EquipmentData {
  id: string;
  code: string;
  type: string;
  location: string;
  status: "pending" | "in_progress" | "completed" | "validated" | "rejected";
  lastUpdate: string;
  assignedTo?: string;
}

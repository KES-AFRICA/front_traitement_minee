// =============================================================================
// BD2 — Couche de collecte terrain : Campagne Bonaberi D11
// Collecte partielle effectuée sur le départ BON.D11 seulement.
// Volontairement incomplète pour faire émerger les 5 cas d'anomalie.
//
// Cas générés :
//   ✅ DUPLICATE   : Substation 8310710 (DIKABO) saisie deux fois
//   ✅ DIVERGENCE  : Transformer 23ENEO5220 (BONAMBAPE 1) - puissance erronée
//                   Substation 8310714 (SCI TROPIQUES) - type H61 au lieu de H59
//                   Wire 1041109 - section différente
//   ✅ NEW         : Substation 9999001 (NOUVEAU POSTE TERRAIN) inconnue de BD1
//                   Transformer 23ENEO_NEW01 inconnu
//   ✅ MISSING     : La plupart des substations D11 sont absentes (collecte partielle)
//   ✅ COMPLEX     : Busbar avec substation_id qui ne correspond à rien en BD1
// =============================================================================

import { EneoAssetsDB } from "@/lib/types/eneo-assets";


export const layer2DB: Partial<EneoAssetsDB> = {

  // ── Feeder : D11 présent (correct, identique à BD1) ───────────────────────
  feeder: [
    {
      m_rid: 10411,
      name: "BON.D11 BONABERI VILLE",
      voltage: 15,
      is_injection: false,
      created_date: "2026-04-01 04:52:46.000000",
      local_name: "",
    },
    // D12 non collecté → sera "missing"
  ],

  // ── Substations : seulement quelques postes D11 visités ───────────────────
  substation: [
    // ✅ CORRECT — Identique à BD1
    {
      m_rid: 8310710,
      name: "DIKABO",
      highest_voltage_level: 15,
      second_substation_id: "1P05310",
      exploitation: "DLAO",
      latitude: 4.0632,
      longitude: 9.7231,
      localisation: "Quartier Dikabo, Bonaberi",
      regime: "PR",
      type: "H59",
      zone_type: "M",
      security_zone_id: "ZV",
      feeder_id: 10411,
      active: true,
      display_scada: true,
      created_date: "2026-04-01 11:07:56.000000",
    },

    // ✅ DUPLICATE — Doublon de 8310710, même m_rid saisi une seconde fois
    // (agent terrain a re-scanné le même poste)
    {
      m_rid: 8310710,
      name: "DIKABO",
      highest_voltage_level: 15,
      second_substation_id: "1P05310",
      exploitation: "DLAO",
      latitude: 4.0633,      // légère variation GPS (re-scan)
      longitude: 9.7232,
      localisation: "Quartier Dikabo, Bonaberi",
      regime: "PR",
      type: "H59",
      zone_type: "M",
      security_zone_id: "ZV",
      feeder_id: 10411,
      active: true,
      display_scada: true,
      created_date: "2026-04-01 11:07:56.000000",
    },

    // ✅ DIVERGENCE — type est "H61" alors que BD1 dit "H59"
    {
      m_rid: 8310714,
      name: "SCI TROPIQUES",
      highest_voltage_level: 15,
      second_substation_id: "",
      exploitation: "DLAO",
      latitude: 4.0645,
      longitude: 9.7215,
      localisation: "",
      regime: "PR",
      type: "H61",           // ← DIVERGENCE : BD1 a "H59"
      zone_type: "M",
      security_zone_id: "ZV",
      feeder_id: 10411,
      active: true,
      display_scada: true,
      created_date: "2026-04-01 11:07:57.000000",
    },

    // ✅ CORRECT — Identique à BD1
    {
      m_rid: 8311505,
      name: "BONABERI VILLE",
      highest_voltage_level: 15,
      second_substation_id: "",
      exploitation: "DLAO",
      latitude: 4.0598,
      longitude: 9.7189,
      localisation: "Centre Bonaberi",
      regime: "DP",
      type: "H59",
      zone_type: "M",
      security_zone_id: "ZV",
      feeder_id: 10411,
      active: true,
      display_scada: true,
      created_date: "2026-04-01 11:07:56.000000",
    },

    // ✅ DIVERGENCE — name légèrement différent (faute de frappe terrain)
    {
      m_rid: 8311602,
      name: "MM EKO",             // ← DIVERGENCE : BD1 a "MM. EKO" (point manquant)
      highest_voltage_level: 15,
      second_substation_id: "1P06545",
      exploitation: "DLAO",
      latitude: 4.0571,
      longitude: 9.7204,
      localisation: "",
      regime: "PR",
      type: "H59",
      zone_type: "M",
      security_zone_id: "ZV",
      feeder_id: 10411,
      active: true,
      display_scada: true,
      created_date: "2026-04-01 11:07:56.000000",
    },

    // ✅ NEW — Poste inconnu de BD1, découvert sur le terrain
    {
      m_rid: 9999001,
      name: "NOUVEAU POSTE CARREF. BALI",
      highest_voltage_level: 15,
      second_substation_id: "",
      exploitation: "DLAO",
      latitude: 4.0612,
      longitude: 9.7265,
      localisation: "Carrefour Bali-Bonaberi",
      regime: "DP",
      type: "H61",
      zone_type: "M",
      security_zone_id: "ZV",
      feeder_id: 10411,
      active: true,
      display_scada: false,
      created_date: "2026-04-01 08:30:00.000000",
    },

    // ✅ DIVERGENCE — regime "DP" au lieu de "PR"
    {
      m_rid: 8310801,
      name: "SODIACAM",
      highest_voltage_level: 15,
      second_substation_id: "1P05302",
      exploitation: "DLAO",
      latitude: 4.0588,
      longitude: 9.7210,
      localisation: "",
      regime: "DP",           // ← DIVERGENCE : BD1 a "PR"
      type: "H59",
      zone_type: "M",
      security_zone_id: "ZV",
      feeder_id: 10411,
      active: true,
      display_scada: true,
      created_date: "2026-04-01 11:07:56.000000",
    },

    // Les autres substations D11 ne sont PAS dans BD2 → elles seront "MISSING"
    // (8310702, 8310717, 8310718, 83107N6, 83107X1, 83107X2, 83107X3,
    //  8310802, 8310804, 8310805, 8310807, 8310814, 8310815, 8310N03,
    //  8311009, 8311010, 8311012, 83110X1, 83110X2, 8311101, 8311103,
    //  8311301, 8311302, 8311402, 8311403, 8311404, 8311407, 83114X1,
    //  8311501, 8311503, 8311507, 8311604, 8311606, 8311607, 83116Z1, 83116Z2)
  ],

  // ── Transformateurs : quelques-uns D11 ────────────────────────────────────
  powertransformer: [
    // ✅ CORRECT — Identique à BD1
    {
      m_rid: "23ENEO5235",
      name: "DIKABO",
      apparent_power: 630,
      substation_id: 8310710,
      t1: "1CN71547",
      t2: "",
      w1_voltage: 15,
      w2_voltage: 0.4,
      active: true,
      display_scada: true,
      created_date: "2026-04-01 11:08:24.000000",
    },

    // ✅ DIVERGENCE — apparent_power 250 au lieu de 400 (agent a noté la mauvaise plaque)
    {
      m_rid: "23ENEO5220",
      name: "BONAMBAPE 1",
      apparent_power: 250,       // ← DIVERGENCE : BD1 a 400 kVA
      substation_id: 8310717,
      t1: "1CN71508",
      t2: "",
      w1_voltage: 15,
      w2_voltage: 0.4,
      active: true,
      display_scada: true,
      created_date: "2026-04-01 11:08:23.000000",
    },

    // ✅ CORRECT
    {
      m_rid: "23ENEO5197",
      name: "BONABERI VILLE",
      apparent_power: 400,
      substation_id: 8311505,
      t1: "1CN71312",
      t2: "",
      w1_voltage: 15,
      w2_voltage: 0.4,
      active: true,
      display_scada: true,
      created_date: "2026-04-01 11:08:23.000000",
    },

    // ✅ NEW — Transformateur inconnu, associé au nouveau poste terrain
    {
      m_rid: "23ENEO_NEW01",
      name: "TRANSFO CARREF. BALI",
      apparent_power: 160,
      substation_id: 9999001,   // ← lié au nouveau poste
      t1: "1CN_NEW_01",
      t2: "",
      w1_voltage: 15,
      w2_voltage: 0.4,
      active: true,
      display_scada: false,
      created_date: "2026-04-01 08:45:00.000000",
    },

    // ✅ DIVERGENCE — w2_voltage incorrect (agent a noté 0.23 au lieu de 0.4)
    {
      m_rid: "23ENEO5201",
      name: "MM. EKO",
      apparent_power: 250,
      substation_id: 8311602,
      t1: "1CN71321",
      t2: "",
      w1_voltage: 15,
      w2_voltage: 0.23,          // ← DIVERGENCE : BD1 a 0.4
      active: true,
      display_scada: true,
      created_date: "2026-04-01 11:08:23.000000",
    },
  ],

  // ── Busbar : quelques-uns + un cas complexe ───────────────────────────────
  busbar: [
    // ✅ CORRECT
    {
      m_rid: "8310710_JDB01",
      substation_id: 8310710,
      name: "JDBDIKABO_01",
      voltage: 15,
      phase: "ABC",
      t1: "1CN71548",
      is_injection: false,
      is_feederhead: false,
      active: true,
      display_scada: true,
      created_date: "2026-04-01 11:06:41.000000",
    },

    // ✅ COMPLEX — substation_id pointe vers 9999002 qui n'existe ni en BD1 ni en BD2
    // C'est un jeu de barres orphelin, non rattachable à un poste connu
    {
      m_rid: "ORPHAN_JDB_01",
      substation_id: 9999002,   // ← ni dans BD1 ni dans BD2 → cas complexe
      name: "JDB_ORPHELIN_01",
      voltage: 15,
      phase: "ABC",
      t1: "1CN_UNKNOWN",
      is_injection: false,
      is_feederhead: false,
      active: true,
      display_scada: false,
      created_date: "2026-04-01 09:00:00.000000",
    },

    // ✅ DIVERGENCE — voltage 11 au lieu de 15 kV
    {
      m_rid: "8311505_JDB01",
      substation_id: 8311505,
      name: "JDBBONABERI VILLE_01",
      voltage: 11,               // ← DIVERGENCE : BD1 a 15
      phase: "ABC",
      t1: "1CN71302",
      is_injection: false,
      is_feederhead: false,
      active: true,
      display_scada: true,
      created_date: "2026-04-01 11:06:41.000000",
    },
  ],

  // ── Wires : quelques conducteurs ──────────────────────────────────────────
  wire: [
    // ✅ CORRECT
    {
      m_rid: "1041101",
      nature_conducteur: "ALUMINIUM",
      phase: "ABC",
      section: "",
      type: "S",
      t1: "1CN80857",
      t2: "1CN71301",
      feeder_id: 10411,
      active: true,
      display_scada: true,
      created_date: "2026-04-01 11:06:28.000000",
    },

    // ✅ DIVERGENCE — section "22" au lieu de "34" (plaque lue différemment)
    {
      m_rid: "1041109",
      nature_conducteur: "ALMELEC",
      phase: "ABC",
      section: "22",            // ← DIVERGENCE : BD1 a "34"
      type: "A",
      t1: "1CN71634",
      t2: "1CN71308",
      feeder_id: 10411,
      active: true,
      display_scada: true,
      created_date: "2026-04-01 11:06:28.000000",
    },

    // ✅ NEW — Conducteur nouveau découvert sur le terrain
    {
      m_rid: "WIRE_NEW_001",
      nature_conducteur: "ALMELEC",
      phase: "ABC",
      section: "34",
      type: "A",
      t1: "1CN_NEW_T1",
      t2: "1CN_NEW_T2",
      feeder_id: 10411,
      active: true,
      display_scada: false,
      created_date: "2026-04-01 09:15:00.000000",
    },
  ],

  // ── Bay : quelques travées ────────────────────────────────────────────────
  bay: [
    // ✅ CORRECT
    {
      m_rid: "8310710_CI01",
      name: "inter vers 8310717 Bonambape 1",
      type: "CI",
      voltage: 15,
      busbar_id1: "8310710_JDB01",
      busbar_id2: "",
      substation_id: 8310710,
      created_date: "2026-04-01 11:07:17.000000",
      active: true,
      display_scada: true,
    },

    // ✅ DIVERGENCE — type "CP" au lieu de "CI"
    {
      m_rid: "8310710_CI02",
      name: "inter vers 8310714 SCI Tropiques",
      type: "CP",               // ← DIVERGENCE : BD1 a "CI"
      voltage: 15,
      busbar_id1: "8310710_JDB01",
      busbar_id2: "",
      substation_id: 8310710,
      created_date: "2026-04-01 11:07:17.000000",
      active: true,
      display_scada: true,
    },

    // ✅ NEW — Travée nouvelle non référencée
    {
      m_rid: "NEW_BAY_BALI_01",
      name: "inter vers nouveau poste Bali",
      type: "CI",
      voltage: 15,
      busbar_id1: "8310710_JDB01",
      busbar_id2: "",
      substation_id: 9999001,
      created_date: "2026-04-01 09:20:00.000000",
      active: true,
      display_scada: false,
    },
  ],

  // ── Switch : quelques appareils ───────────────────────────────────────────
  switch: [
    // ✅ CORRECT
    {
      m_rid: "1INF05059",
      bay_mrid: "8311505_CP04",
      nature: "PFA",
      voltage: 15,
      second_switch_id: "",
      pole_mrid: "",
      name: "",
      normal_open: false,
      phase: "ABC",
      t1: "1CN71302",
      t2: "1CN71312",
      type: "Inter Fuse",
      feeder_id: 10411,
      active: true,
      display_scada: true,
      created_date: "2026-04-01 11:09:30.000000",
    },

    // ✅ DIVERGENCE — normal_open: true au lieu de false (état différent constaté)
    {
      m_rid: "1IAC30026",
      bay_mrid: "",
      nature: "IACM",
      voltage: 15,
      second_switch_id: "A1L3K",
      pole_mrid: "",
      name: "",
      normal_open: true,        // ← DIVERGENCE : BD1 a false
      phase: "ABC",
      t1: "1CN71639",
      t2: "1CN71634",
      type: "LBS",
      feeder_id: 10411,
      active: true,
      display_scada: true,
      created_date: "2026-04-01 11:09:28.000000",
    },
  ],

  // Pole et Node : non collectés → tous seront "MISSING"
  pole: [],
  node: [],
};
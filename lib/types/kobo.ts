// ─── types/kobo.ts ────────────────────────────────────────────────────────────

// ── Poste géolocalisé (liste carte) ──────────────────────────────────────────
export interface PosteMapItem {
  substation:       string | null;
  substation_name:  string | null;
  type:             string | null;  // H61, H59…
  type_poste_H61:   string | null;  // S, SL, SP…
  feeder:           string | null;
  feeder_name:  string | null;
  exploitation:     string | null;
  regime:           string | null;
  regime_poste:     "publique" | "privee" | "mixte" | null;
  zone_type:        string | null;
  statut_acces:     string | null;
  latitude:         number;
  longitude:        number;
  photo_poste:      string | null;
  submission_time:  string | null;
  submitted_by:     string | null;
  kobo_id:          number | null;
}

export interface PostesMapResponse {
  count:  number;
  postes: PosteMapItem[];
}

// ── Support & Armement ────────────────────────────────────────────────────────
export interface Support {
  hauteur:      string | null;
  etat:         string | null;
  type_support: string | null;
}

export interface Armement {
  type:           string | null;
  etat:           string | null;
  atronconnement: string | null;
}

// ── Appareillage HTA ──────────────────────────────────────────────────────────
export interface Appareillage {
  parafoudre:           string | null;
  etat_parafoudre:      string | null;
  tableau_bt:           string | null;
  detecteur_defaut:     string | null;
  coupe_circuit:        string | null;
  disjoncteur_hp:       string | null;
  pmr:                  string | null;
  photo_appareillage:   string | null;
}

// ── Transformateur ────────────────────────────────────────────────────────────
export interface Transformateur {
  nom:                   string | null;
  puissance_kva:         string | null;
  tension_primaire_kv:   string | null;
  tension_secondaire_kv: string | null;
  statut_presence:       string | null;
  actif:                 string | null;
  marque:                string | null;
  type:                  string | null;
  refroidissement:       string | null;
  etat_visuel:           string | null;
  relai_protection:      string | null;
  type_intervention:     string | null;
  remplacement_planifie: string | null;
  id_transformer:        string | null;
  photo_transfo:         string | null;
}

// ── Switch (appareil dans une cellule) ────────────────────────────────────────
export interface Switch {
  nom:                   string | null;
  type:                  string | null;
  forme:                 string | null;
  phase:                 string | null;
  tension_kv:            string | null;
  borne_t1:              string | null;
  borne_t2:              string | null;
  commande:              string | null;
  etat_visuel:           string | null;
  actif:                 string | null;
  type_intervention:     string | null;
  remplacement_planifie: string | null;
}

// ── Cellule HTA (bay) ─────────────────────────────────────────────────────────
export interface Cellule {
  bay_id:        string | null;
  type_bay:      string | null;  // CI, CP…
  fabricant:     string | null;
  modele:        string | null;
  commande:      string | null;
  etat_visuel:   string | null;
  signalisation: string | null;
  nom_cellule:   string | null;
  barcode_bay:   string | null;
  photo_bay:     string | null;
  switches:      Switch[];
}

// ── Tableau BT ────────────────────────────────────────────────────────────────
export interface BTBoard {
  type:     string | null;
  capacity: string | null;
  actif:    string | null;
  photo:    string | null;
}

// ── Client commercial ─────────────────────────────────────────────────────────
export interface ClientCommercial {
  type_client:       string | null;
  nom_client:        string | null;
  activite:          string | null;
  type_compteur:     string | null;
  mrid_compteur:     string | null;
  statut_compteur:   string | null;
  statut_scelle:     string | null;
  numero_scelle:     string | null;
  telephone:         string | null;
  disjoncteur:       string | null;
  photo_disjoncteur: string | null;
  photo_ensemble:    string | null;
  photo_index:       string | null;
}

// ── Voies d'accès ─────────────────────────────────────────────────────────────
export interface Voies {
  type:        string | null;
  largeur:     string | null;
  longueur:    string | null;
  surface:     string | null;
  observation: string | null;
}

// ── Bâtiment (génie civil) ────────────────────────────────────────────────────
export interface Batiment {
  toiture:              string | null;
  peinture_exterieur:   string | null;
  etat_peinture_ext:    string | null;
  portes:               string | null;
  degradation_portes:   string | null;
  structure_murs:       string | null;
  etat_murs:            string | null;
  bouches_ventilation:  string | null;
  nb_bouches:           string | null;
  etat_bouches:         string | null;
  type_degrade_bouches: string | null;
  peinture_interieur:   string | null;
  etat_peinture_int:    string | null;
  dalle_couverture:     string | null;
  revetement:           string | null;
  etat_revetement:      string | null;
  cloture:              string | null;
  ouvrage_drainage:     string | null;
  galeries_cables:      string | null;
  type_galeries:        string | null;
  etat_galeries:        string | null;
  acces:                string | null;
  type_acces:           string | null;
  etat_acces:           string | null;
}

// ── Équipements locaux (génie civil) ──────────────────────────────────────────
export interface EquipementsLocal {
  interrupteurs: string | null;
  lampes:        string | null;
  etat_lampes:   string | null;
  extracteur_air: string | null;
  coffret:       string | null;
}

// ── Génie civil ───────────────────────────────────────────────────────────────
export interface GenieCivil {
  kobo_id:          number | null;
  submission_time:  string | null;
  submitted_by:     string | null;
  superficie_batie: string | null;
  voies:            Voies;
  batiment:         Batiment;
  equipements_local: EquipementsLocal;
  photos:           Record<string, string>;
}

// ── Métadonnées ───────────────────────────────────────────────────────────────
export interface PosteMeta {
  kobo_id:         number | null;
  uuid:            string | null;
  submission_time: string | null;
  submitted_by:    string | null;
  version:         string | null;
}

// ── Photos principales ────────────────────────────────────────────────────────
export interface PostePhotos {
  photo_poste:        string | null;
  photo_appareillage: string | null;
}

// ── Détail complet d'un poste ─────────────────────────────────────────────────
export interface PosteDetail {
  substation_id:   string;
  substation_name:          string | null;
  latitude:        number | null;
  longitude:       number | null;

  // Identification
  feeder:          string | null;
  feeder_name:          string | null;
  type:            string | null;
  type_poste_H61:  string | null;
  exploitation:    string | null;
  regime:          string | null;
  regime_poste:    string | null;
  zone_type:       string | null;
  barcode_poste:   string | null;
  ID2:             string | null;

  // État
  statut_acces:    string | null;
  terre_neutre_bt: string | null;
  terre_masse:     string | null;

  // Équipements
  support:         Support;
  armement:        Armement;
  appareillage:    Appareillage;
  transformateurs: Transformateur[];
  cellules:        Cellule[];
  bt_boards:       BTBoard[];

  // Commercial
  client_commercial: ClientCommercial | null;

  // Photos
  photos: PostePhotos;

  // Génie civil lié
  genie_civil: GenieCivil | null;

  // Méta
  meta: PosteMeta;
}

// ── Erreur API ────────────────────────────────────────────────────────────────
export interface ApiError {
  detail: string;
}
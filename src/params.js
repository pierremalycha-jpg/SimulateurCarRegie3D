// @ts-check
import { LENSES, LINKS } from './data/cameras.js';
import { CN_REQ } from './data/rf.js';
import { LATENCY } from './rf.js';
import { AV_TOL } from './audio.js';
import { LINEUP_TARGET } from './bcam.js';

// ----------------------------------------------------------------------------------
// Valeurs chiffrées que les relecteurs métier peuvent corriger. Chaque paramètre pointe
// sur une donnée réellement utilisée par le simulateur : une correction validée par le
// formateur (config/review.overrides) s'applique tout de suite, sans développeur.
// ----------------------------------------------------------------------------------
export const DOMAINS = {
  vision: 'Vision, caméras et objectifs',
  son: 'Son',
  reseau: 'Réseau IP / ST 2110',
  ralentis: 'Mélangeur, ralentis, IPDirector',
  hf: 'HF et liaisons caméra',
  niveaux: 'Niveaux et normes',
  stade: 'Stade et installation',
};
// groupe d'un point de relecture → domaine
export const GROUP_DOMAIN = {
  'Caméras': 'vision', 'Chaîne caméra': 'vision', 'Objectifs': 'vision',
  'Console son': 'son', 'Son': 'son',
  'IP': 'reseau', 'Réseau ST 2110': 'reseau', 'Mesures ST 2110': 'reseau', 'Formation réseau': 'reseau',
  'Serveur EVS XT4K': 'ralentis', 'Télécommande LSM': 'ralentis', 'IPDirector': 'ralentis', 'Mélangeur XVS-6000': 'ralentis',
  'HF et liaisons': 'hf', 'Niveaux et mesures': 'niveaux', 'Stade': 'stade',
};

export const PARAMS = [];
const add = (p) => { p.def = p.get(); PARAMS.push(p); };
// le registre est construit au premier usage (évite tout souci d'ordre de chargement des modules)
const LENS_F = [['fmin', 'Focale mini', 'mm'], ['fmax', 'Focale maxi', 'mm'], ['f0', 'Ouverture maxi (grand-angle)', 'f/'], ['ramp', 'Focale où l\'ouverture commence à baisser', 'mm'], ['fLong', 'Ouverture au long foyer', 'f/'], ['mod', 'Distance mini de mise au point', 'm'], ['kg', 'Masse', 'kg']];
export function initParams() {
  if (PARAMS.length) return PARAMS;
  // objectifs : focales, ouvertures, distance minimale, masse
  for (const [k, L] of Object.entries(LENSES)) {
    if (!L.brand) continue;
    for (const [f, lab, unit] of LENS_F) {
      if (L[f] == null && (f === 'mod' || f === 'kg')) continue;
      add({ id: `lens.${k}.${f}`, domain: 'vision', group: L.name, label: lab, unit, get: () => LENSES[k][f], set: (v) => { LENSES[k][f] = v; } });
    }
  }
  // liaisons caméra : portées
  for (const k of ['smpte', 'triax', 'coax', 'smf']) for (const fmt of ['UHD', 'HD']) add({ id: `link.${k}.${fmt}`, domain: 'hf', group: 'Portée des liaisons caméra', label: `${LINKS[k].short} en ${fmt}`, unit: 'm', get: () => LINKS[k].max[fmt], set: (v) => { LINKS[k].max[fmt] = v; } });
  // HF : C/N requis par modulation et rendement, latence
  for (const mod of Object.keys(CN_REQ)) for (const fec of Object.keys(CN_REQ[mod])) add({ id: `cn.${mod}.${fec}`, domain: 'hf', group: 'C/N requis (COFDM, avant marges)', label: `${mod} ${fec}`, unit: 'dB', get: () => CN_REQ[mod][fec], set: (v) => { CN_REQ[mod][fec] = v; } });
  for (const k of Object.keys(LATENCY)) add({ id: `lat.${k}`, domain: 'hf', group: 'Latence du codec HF', label: LATENCY[k].label.split(' (')[0], unit: 'images', get: () => LATENCY[k].frames, set: (v) => { LATENCY[k].frames = Math.max(0, Math.round(v)); } });
  // son : tolérance de synchro labiale
  add({ id: 'av.early', domain: 'son', group: 'Synchro son / image', label: 'Son en avance toléré', unit: 'ms', get: () => AV_TOL.early, set: (v) => { AV_TOL.early = v; } });
  add({ id: 'av.late', domain: 'son', group: 'Synchro son / image', label: 'Son en retard toléré', unit: 'ms', get: () => AV_TOL.late, set: (v) => { AV_TOL.late = v; } });
  // vision : niveaux visés au line-up selon la valeur de plan
  for (const k of Object.keys(LINEUP_TARGET)) add({ id: `lineup.${k}`, domain: 'niveaux', group: 'Niveau moyen visé au line-up (waveform)', label: k, unit: '%', get: () => Math.round(LINEUP_TARGET[k] * 100), set: (v) => { LINEUP_TARGET[k] = v / 100; } });
  return PARAMS;
}

export const paramById = (id) => initParams().find((p) => p.id === id);
export const fmtParam = (p, v) => (v == null || v === '' ? '—' : (p.unit === 'f/' ? 'f/' + String(v).replace('.', ',') : String(v).replace('.', ',') + (p.unit ? ' ' + p.unit : '')));

// applique les corrections validées (et revient aux valeurs d'origine pour les autres)
let applied = {};
export function applyOverrides(ov = {}) {
  for (const p of initParams()) {
    const v = ov[p.id];
    if (v != null && v !== '' && isFinite(+v)) { p.set(+v); applied[p.id] = +v; }
    else if (applied[p.id] != null) { p.set(p.def); delete applied[p.id]; }
  }
}
export const overrideCount = () => Object.keys(applied).length;

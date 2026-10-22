// @ts-check
import * as THREE from 'three';

// ----------------------------------------------------------------------------------
// Petits outils communs à la scène de l'entrepôt : un « bac » qui retient tout ce qui se libère
// (géométries, matériaux, textures), la fabrique de textures dessinées sur un canvas, et les
// mesures du hall (où sont la baie, la table, le plateau, le tableau électrique). Toutes les
// cotes sont en mètres ; +z est le côté de l'opérateur (la vue d'ouverture), -z le fond du hall.
// ----------------------------------------------------------------------------------

/** une unité de baie (1 U = 1,75 pouce = 44,45 mm) */
export const U = 0.04445;
/** largeur d'une face 19 pouces (avec les oreilles) et entraxe des rails */
export const RACK19 = 0.4826, RAIL_X = 0.2253;

/** la baie mobile : centre au sol, profondeur, bas du premier U, plan avant des appareils (repère de la baie) */
export const RACK = { x: -1.15, z: 0.05, w: 0.6, d: 0.6, y0: 0.13, rail: 0.262, front: 0.268 };
/** la table de régie : étendue et hauteur du plateau ; 2 rangées de 4 emplacements */
export const TABLE = { x0: 0.2, x1: 2.6, z0: -0.4, z1: 0.4, top: 0.75 };
/** le plateau : la scène (estrade, fond) et l'arc des huit emplacements de caméra qui la regardent */
export const STAGE = { x: 1.4, z: -4.45, r: 2.45, a0: -63, da: 18 };
/** le tableau électrique, sur le mur du fond */
export const WALL_Z = -5.2;
export const MUR = { x: -2.7, y: 1.25, z: WALL_Z };
/** le hall : murs et sol */
export const HALL = { x0: -7.5, x1: 7.5, z0: WALL_Z, z1: 6.2, h: 6 };

/**
 * Le bac : tout objet libérable créé par la scène y est inscrit, puis libéré d'un coup.
 * @returns {{ add: <T>(o: T) => T, dispose: () => void, size: () => number }}
 */
export function makeBin() {
  /** @type {Set<{ dispose: () => void }>} */
  const items = new Set();
  return {
    add(o) { if (o && typeof (/** @type {any} */ (o)).dispose === 'function') items.add(/** @type {any} */ (o)); return o; },
    dispose() { for (const o of items) { try { o.dispose(); } catch (e) { /* déjà libéré */ } } items.clear(); },
    size: () => items.size,
  };
}

/** un canvas de la taille voulue (le DOM du navigateur) */
export function canvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }

/**
 * Une texture dessinée sur un canvas (couleurs sRGB).
 * @param {number} w @param {number} h
 * @param {(g: CanvasRenderingContext2D, w: number, h: number) => void} draw
 * @param {{ repeat?: [number, number], aniso?: number }} [o]
 */
export function canvasTex(w, h, draw, o = {}) {
  const c = canvas(w, h); const g = c.getContext('2d'); if (g) draw(g, c.width, c.height);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = o.aniso || 4;
  if (o.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(o.repeat[0], o.repeat[1]); }
  return t;
}

/** tirage pseudo-aléatoire reproductible (mêmes cartons à chaque ouverture) */
export function rng(seed = 7) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/** empreinte d'une chaîne (pour varier un câble d'après son identifiant) */
export function hash(/** @type {string} */ s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

export const FONT = '"Archivo Narrow", "Arial Narrow", "Roboto Condensed", sans-serif';

/** position, rotation, ombres, parent : un maillage prêt à poser */
export function put(/** @type {THREE.Object3D} */ o, pos, rot, /** @type {THREE.Object3D | null} */ parent, shadows = true) {
  if (pos) o.position.set(pos[0], pos[1], pos[2]);
  if (rot) o.rotation.set(rot[0], rot[1], rot[2]);
  if (shadows) o.traverse((x) => { if (/** @type {any} */ (x).isMesh) { x.castShadow = true; x.receiveShadow = true; } });
  if (parent) parent.add(o);
  return o;
}

/** l'emplacement n (1 à 8) du plateau : position au sol et angle vers la scène */
export function plateauSlot(/** @type {number} */ slot) {
  const a = THREE.MathUtils.degToRad(STAGE.a0 + STAGE.da * (slot - 1));
  const x = STAGE.x + Math.sin(a) * STAGE.r, z = STAGE.z + Math.cos(a) * STAGE.r;
  return { x, z, rotY: Math.atan2(STAGE.x - x, STAGE.z - z) };
}
/** l'emplacement n (1 à 8) de la table : rangée du fond 1 à 4, rangée de l'opérateur 5 à 8 */
export function tableSlot(/** @type {number} */ slot) {
  const s = Math.max(0, slot - 1); const col = s % 4, row = Math.floor(s / 4);
  const cw = (TABLE.x1 - TABLE.x0) / 4;
  return { x: TABLE.x0 + cw * (col + 0.5), z: row ? 0.18 : -0.17, y: TABLE.top };
}
/** bas de l'emplacement n (1 à 12, 1 en bas) de la baie, et plan avant, en coordonnées du hall */
export function rackSlot(/** @type {number} */ slot) { return { x: RACK.x, y: RACK.y0 + (slot - 1) * U, z: RACK.z + RACK.front }; }

// @ts-check
import * as THREE from 'three';
import { dessineMedia } from './dessin.js';
import { TEAMS } from '../data/match.js';

// ----------------------------------------------------------------------------------
// L'image d'un média en lecture sur un canal de l'EVS : un canvas par canal, redessiné quand la
// position change (25 images par seconde au plus) et seulement quand quelqu'un le regarde
// (pipeline.js, resolve). Ce que les médias affichent du match (score, générique déroulant) est
// fourni par src/emission/index.js (setInfoMedias).
// ----------------------------------------------------------------------------------
const W = 960, H = 540;
/** @type {import('./dessin.js').InfoMedia} */
const INFO = { equipes: TEAMS, score: [0, 0], credits: [], heure: '21:00' };
/** @param {Partial<import('./dessin.js').InfoMedia>} o */
export function setInfoMedias(o) { Object.assign(INFO, o); for (const c of CAN) if (c) c.key = ''; }
export const infoMedias = () => INFO;

/** @type {({ canvas: HTMLCanvasElement, g: CanvasRenderingContext2D, tex: THREE.CanvasTexture, key: string } | null)[]} */
const CAN = [null, null];
function canal(k) {
  if (CAN[k]) return CAN[k];
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const g = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
  const tex = new THREE.CanvasTexture(canvas); tex.generateMipmaps = false; tex.minFilter = THREE.LinearFilter;
  return (CAN[k] = { canvas, g, tex, key: '' });
}
/**
 * La texture du média chargé sur le canal k, à sa position.
 * @param {number} k canal de lecture (0 = PGM1, 1 = PGM2)
 * @param {{ id: string, pos: number }} m
 */
export function textureMedia(k, m) {
  const c = canal(k);
  const key = m.id + ':' + Math.floor(m.pos * 25);
  if (key !== c.key) { c.key = key; dessineMedia(c.g, W, H, m.id, m.pos, INFO); c.tex.needsUpdate = true; }
  return c.tex;
}
/** une image d'un média dans un canvas quelconque (vignettes de l'IPDirector) */
export function vignetteMedia(/** @type {HTMLCanvasElement} */ cv, /** @type {string} */ id, /** @type {number} */ t) {
  const g = cv.getContext('2d'); if (!g) return;
  g.save(); g.scale(cv.width / W, cv.height / H); dessineMedia(g, W, H, id, t, INFO); g.restore();
}

// @ts-check
import { el } from '../util.js';
import { NOTIONS } from '../camlab/notions/index.js';
import { QUIZ } from '../camlab/quiz.js';
import { FIGS } from '../camlab/figs.js';

// ----------------------------------------------------------------------------------
// Les outils des leçons de la caméra qui reprennent les notions du module « La caméra en 3D »
// (src/camlab) : la banque du quiz tirée des questions d'Olivier (les trois de chaque fiche, et celles
// du quiz de chapitre qui relèvent de la notion), convertie au format du Cours ; le schéma d'une ou
// deux notions, repris de camlab/figs.js. Une question du module : { q, a: [[texte, explication]], ok } ;
// une question du Cours : { q, choices, answer, why } où chaque choix faux porte son explication.
// ----------------------------------------------------------------------------------

/** « Exact : deux crans… » → « Deux crans… » : le Cours écrit lui-même « Exact. » devant l'explication */
const sansExact = (t) => { const s = String(t).replace(/^Exact\s*[:.,!]?\s*/, ''); return s.charAt(0).toUpperCase() + s.slice(1); };

/** une question du module, au format du Cours */
export function questionDuModule(/** @type {{ q: string, a: [string, string][], ok: number }} */ Q) {
  return { q: Q.q, choices: Q.a.map(([t, e], k) => (k === Q.ok ? t : /** @type {[string, string]} */ ([t, e]))), answer: Q.ok, why: sansExact(Q.a[Q.ok][1]) };
}

/**
 * La banque d'une leçon : les questions d'Olivier de ses notions, puis celles du quiz de chapitre qui relèvent de
 * ces notions, puis les questions écrites pour la leçon (« dans le car ») ; sans doublon.
 * @param {string[]} ids notions de la leçon
 * @param {import('./index.js').QuizQuestion[]} [propres]
 */
export function quizDe(ids, propres = []) {
  const out = [], vus = new Set();
  const add = (Q) => { if (!vus.has(Q.q)) { vus.add(Q.q); out.push(Q); } };
  for (const id of ids) for (const Q of (NOTIONS[id] && NOTIONS[id].quiz) || []) add(questionDuModule(Q));
  for (const list of Object.values(QUIZ)) for (const Q of list) if (Q.n && ids.includes(Q.n)) add(questionDuModule(Q));
  for (const Q of propres) add(Q);
  return out;
}

/** les compétences du référentiel travaillées par des notions (sans doublon, dans l'ordre) */
export const competencesDe = (/** @type {string[]} */ ids) => [...new Set(ids.flatMap((id) => (NOTIONS[id] && NOTIONS[id].competences) || []))];

/**
 * Le schéma de la leçon : ceux de une à trois de ses notions côte à côte (camlab/figs.js), chacun titré.
 * @param {string[]} ids
 * @param {string} [titre] ce que montrent les schémas ensemble
 */
export function figNotions(ids, titre = '') {
  const items = ids.filter((id) => FIGS[id]);
  return el('div', { class: 'co-cfigs' + (items.length > 1 ? ' n' + items.length : ''), role: 'group', 'aria-label': titre || 'Schémas de la caméra en 3D' },
    ...items.map((id) => el('figure', { class: 'co-cfig' }, el('div', { class: 'cl-fig', html: FIGS[id]() }), el('figcaption', {}, NOTIONS[id].t))));
}

// ---------------- les manipulations : couleurs et dessin dans un canevas ----------------
/** couleurs des schémas et manipulations (les mêmes que les autres chapitres) */
export const COUL = { grey: '#8a949c', amber: '#ffd38a', red: '#ff8a80', green: '#7fd1a0', cyan: '#7fd3f3', box: '#1a2026', line: '#2a3238', tally: '#f0372c', pvw: '#33c46c', fond: '#0b1013', txt: '#aab4ba', blanc: '#e8eef2', fibre: '#ffb020' };
/** efface le canevas sur le fond sombre des manipulations */
export function fond(/** @type {CanvasRenderingContext2D} */ g, W, H) { g.fillStyle = COUL.fond; g.fillRect(0, 0, W, H); }
/** un texte dans le canevas */
export function ecrire(/** @type {CanvasRenderingContext2D} */ g, t, x, y, o = {}) {
  g.fillStyle = o.col || COUL.txt; g.font = o.font || '11px Arial, sans-serif'; g.textAlign = o.align || 'left';
  g.fillText(t, x, y); g.textAlign = 'left';
}
/** une ligne dans le canevas */
export function trait(/** @type {CanvasRenderingContext2D} */ g, x1, y1, x2, y2, col = COUL.grey, w = 1, dash = null) {
  g.strokeStyle = col; g.lineWidth = w; if (dash) g.setLineDash(dash); g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); if (dash) g.setLineDash([]);
}
/** un nombre écrit à la française avec le vrai signe moins */
export const nf = (v, d = 0) => (Number.isFinite(v) ? v.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }).replace('-', '−') : '∞');
/** une distance en mètres lisible (cm sous 1 m) */
export const metres = (m) => (!Number.isFinite(m) ? 'l\'infini' : m < 1 ? `${nf(m * 100, m < 0.1 ? 1 : 0)} cm` : `${nf(m, m < 10 ? 2 : 1)} m`);
/** un nombre f : f/1,8 · f/2,4 · f/16 */
export const fN = (N) => 'f/' + nf(N, N >= 10 ? 0 : Math.abs(N * 10 - Math.round(N * 10)) > 0.05 ? 2 : Number.isInteger(N) ? 0 : 1);

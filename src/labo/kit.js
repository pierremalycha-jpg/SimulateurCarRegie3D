// @ts-check
import { el } from '../util.js';

// ----------------------------------------------------------------------------------
// Les commandes des ateliers du Labo, liées à l'état par un chemin pointé (« p1.d », « courbe ») :
// curseur, touches à bascule, liste, case, champ. Chacune se met à jour quand l'état change
// (refresh) et se verrouille quand un défi l'impose (ctx.verrous). Les couleurs des dessins sont
// lues dans les jetons du thème (theme-jeu.css), jamais écrites en dur.
// ----------------------------------------------------------------------------------
/**
 * @typedef {object} Ctx le contexte d'un atelier
 * @property {any} st l'état (labo/etats.js)
 * @property {() => any} m ses mesures
 * @property {(patch: Record<string, any>) => void} changer applique un réglage, redessine, prévient le défi en cours
 * @property {Set<string>} verrous les chemins imposés par la question en cours
 * @property {(text: string) => void} dire une annonce pour les lecteurs d'écran
 */
export const lire = (st, /** @type {string} */ k) => k.split('.').reduce((o, p) => (o == null ? o : Array.isArray(o) ? o.find((x) => x && x.id === p) : o[p]), st);
let uid = 0;
const nid = (p) => `lb-${p}-${++uid}`;

/** les commandes d'un atelier : chacune s'inscrit pour se remettre à jour */
export function commandes(/** @type {Ctx} */ ctx) {
  /** @type {Array<() => void>} */ const ups = [];
  const verrou = (k) => ctx.verrous.has(k) || [...ctx.verrous].some((v) => k.startsWith(v + '.'));
  /**
   * Un curseur. log : échelle logarithmique ; fmt : l'écriture de la valeur.
   * @param {string} k @param {string} label
   * @param {{ min: number, max: number, step?: number, log?: boolean, fmt?: (v: number) => string, unite?: string }} o
   */
  const curseur = (k, label, o) => {
    const id = nid('c'); const N = 1000;
    const toPos = (v) => (o.log ? Math.round(Math.log(v / o.min) / Math.log(o.max / o.min) * N) : v);
    const fromPos = (p) => { if (!o.log) return Number(p); const v = o.min * Math.pow(o.max / o.min, Number(p) / N); const s = o.step || 0; return s ? Math.round(v / s) * s : v; };
    const input = /** @type {HTMLInputElement} */ (el('input', { type: 'range', id, min: o.log ? 0 : o.min, max: o.log ? N : o.max, step: o.log ? 1 : o.step || 'any', 'data-k': k }));
    const out = el('output', { for: id, class: 'lb-val' });
    input.addEventListener('input', () => ctx.changer({ [k]: fromPos(input.value) }));
    const box = el('div', { class: 'lb-ctl lb-range' }, el('label', { for: id }, label), out, input);
    ups.push(() => { const v = Number(lire(ctx.st, k)); input.value = String(toPos(v)); out.textContent = (o.fmt ? o.fmt(v) : String(v)) + (o.unite ? ' ' + o.unite : ''); input.disabled = verrou(k); box.classList.toggle('locked', input.disabled); input.setAttribute('aria-valuetext', out.textContent); });
    return box;
  };
  /** des touches à bascule (une seule allumée) @param {string} k @param {string} label @param {Array<[any, string, string?]>} options */
  const touches = (k, label, options) => {
    const keys = options.map(([v, t, title]) => el('button', { type: 'button', 'data-k': k, 'data-v': String(v), title: title || t, onclick: () => ctx.changer({ [k]: v }) }, t));
    const box = el('div', { class: 'lb-ctl' }, el('span', { class: 'lb-lab' }, label), el('div', { class: 'seg lb-seg', role: 'group', 'aria-label': label }, ...keys));
    ups.push(() => { const v = lire(ctx.st, k); const lock = verrou(k); options.forEach(([o], i) => { keys[i].setAttribute('aria-pressed', String(o === v)); /** @type {HTMLButtonElement} */ (keys[i]).disabled = lock && o !== v; }); box.classList.toggle('locked', lock); });
    return box;
  };
  /** une liste déroulante @param {string} k @param {string} label @param {Array<[string, string]>} options */
  const liste = (k, label, options) => {
    const id = nid('l');
    const sel = /** @type {HTMLSelectElement} */ (el('select', { id, 'data-k': k }, ...options.map(([v, t]) => el('option', { value: v }, t))));
    sel.addEventListener('change', () => ctx.changer({ [k]: sel.value }));
    const box = el('div', { class: 'lb-ctl' }, el('label', { for: id }, label), sel);
    ups.push(() => { sel.value = String(lire(ctx.st, k)); sel.disabled = verrou(k); box.classList.toggle('locked', sel.disabled); });
    return box;
  };
  /** une case à cocher @param {string} k @param {string} label */
  const caseA = (k, label) => {
    const id = nid('b');
    const cb = /** @type {HTMLInputElement} */ (el('input', { type: 'checkbox', id, 'data-k': k }));
    cb.addEventListener('change', () => ctx.changer({ [k]: cb.checked }));
    const box = el('div', { class: 'lb-ctl lb-check' }, cb, el('label', { for: id }, label));
    ups.push(() => { cb.checked = !!lire(ctx.st, k); cb.disabled = verrou(k); box.classList.toggle('locked', cb.disabled); });
    return box;
  };
  /**
   * un champ (texte ou nombre), validé à la sortie ou à Entrée
   * @param {string} k @param {string} label @param {{ nombre?: boolean, min?: number, max?: number, placeholder?: string, largeur?: string }} [o]
   */
  const champ = (k, label, o = {}) => {
    const id = nid('t');
    const inp = /** @type {HTMLInputElement} */ (el('input', { id, 'data-k': k, type: o.nombre ? 'number' : 'text', inputmode: o.nombre ? 'numeric' : null, min: o.min ?? null, max: o.max ?? null, placeholder: o.placeholder || null, spellcheck: 'false', autocomplete: 'off', style: o.largeur ? `width:${o.largeur}` : null }));
    const valider = () => { const v = o.nombre ? Math.round(Number(inp.value)) : inp.value.trim(); if (o.nombre && !Number.isFinite(v)) return; ctx.changer({ [k]: v }); };
    inp.addEventListener('change', valider);
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); valider(); } });
    const box = el('div', { class: 'lb-ctl lb-field' }, el('label', { for: id }, label), inp);
    ups.push(() => { if (document.activeElement !== inp) inp.value = String(lire(ctx.st, k) ?? ''); inp.disabled = verrou(k); box.classList.toggle('locked', inp.disabled); });
    return box;
  };
  return { curseur, touches, liste, caseA, champ, refresh: () => { for (const u of ups) u(); }, ups };
}

/** un afficheur de mesure : un titre et une valeur, mis à jour par set */
export function afficheur(/** @type {string} */ titre, cls = '') {
  const v = el('b', { class: 'lb-read-v' }); const n = el('small', { class: 'lb-read-n' });
  const box = el('div', { class: 'lb-read' + (cls ? ' ' + cls : '') }, el('span', { class: 'lb-read-t' }, titre), v, n);
  return { box, set: (/** @type {string} */ val, /** @type {string} */ note = '', /** @type {'' | 'ok' | 'warn' | 'bad'} */ etat = '') => { v.textContent = val; n.textContent = note; box.dataset.etat = etat; } };
}

/** les couleurs du thème, lues une fois (pour les dessins en canvas) */
let TOK = null;
export function jetons() {
  if (TOK) return TOK;
  const cs = getComputedStyle(document.documentElement);
  const g = (n, d) => (cs.getPropertyValue(n) || '').trim() || d;
  TOK = { bg: g('--bg', '#0c0e13'), panel: g('--panel', '#161a22'), raise: g('--raise', '#242a36'), line: g('--line2', 'rgba(255,255,255,.16)'), fg: g('--fg', '#f5f6f8'), muted: g('--muted', '#aab2bf'), dim: g('--dim', '#929baa'),
    accent: g('--accent', '#3b9cff'), ok: g('--pvw', '#34c759'), amber: g('--amber', '#ffb340'), tally: g('--tally', '#ff453a'), violet: g('--violet', '#bf5af2'), fibre: g('--fibre', '#ffd60a'), font: g('--f-body', 'sans-serif'), mono: g('--f-mono', 'monospace') };
  return TOK;
}
/** un canvas net sur les écrans haute densité : sa taille en pixels CSS, son contexte déjà mis à l'échelle */
export function toile(/** @type {number} */ w, /** @type {number} */ h, /** @type {string} */ label, cls = '') {
  const c = /** @type {HTMLCanvasElement} */ (el('canvas', { class: 'lb-canvas' + (cls ? ' ' + cls : ''), role: 'img', 'aria-label': label }));
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
  const g = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { c, g, w, h };
}
/** écrit un nombre à la française */
export const fr = (v, d = 0) => (Number.isFinite(v) ? Number(v).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }).replace(/\u202f/g, '\u00a0') : '∞');
/** une couleur du thème (#rrggbb) avec une transparence */
export function teinte(/** @type {string} */ c, /** @type {number} */ a) {
  const m = /^#([0-9a-f]{6})$/i.exec(c.trim());
  if (!m) return c;
  const n = parseInt(m[1], 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}
/** un rectangle aux coins arrondis (tracé seul), même sans roundRect (navigateurs anciens) */
export function arrondi(/** @type {CanvasRenderingContext2D} */ g, x, y, w, h, r) {
  g.beginPath();
  if (typeof g.roundRect === 'function') { g.roundRect(x, y, w, h, r); return; }
  g.rect(x, y, w, h);
}

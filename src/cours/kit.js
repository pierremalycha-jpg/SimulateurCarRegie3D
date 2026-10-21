// @ts-check
import { el } from '../util.js';

// ----------------------------------------------------------------------------------
// Outils communs aux leçons : SVG, canvas, curseurs et touches de la manipulation, lectures.
// ----------------------------------------------------------------------------------
const NS = 'http://www.w3.org/2000/svg';
/** élément SVG ; les attributs en camelCase sont écrits tels quels (viewBox, strokeWidth → stroke-width) */
export function sv(tag, attrs = {}, ...kids) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k === 'strokeWidth' ? 'stroke-width' : k === 'fontSize' ? 'font-size' : k === 'textAnchor' ? 'text-anchor' : k, String(attrs[k]));
  for (const c of kids) if (c != null) e.append(typeof c === 'string' ? document.createTextNode(c) : c);
  return e;
}
/** un schéma SVG prêt pour la page : largeur fluide, hauteur selon le viewBox, titre accessible */
export function figure(w, h, title, ...kids) {
  const s = sv('svg', { viewBox: `0 0 ${w} ${h}`, class: 'co-fig', role: 'img', 'aria-label': title });
  s.append(sv('title', {}, title), ...kids);
  return s;
}
/** canvas à la taille demandée, net sur écran haute densité */
export function canvas(w, h, cls = 'co-canvas') {
  const c = el('canvas', { class: cls, width: w, height: h });
  c.style.aspectRatio = `${w} / ${h}`;
  return c;
}
/** curseur avec étiquette et valeur lue ; fmt formate la valeur affichée */
export function slider(label, min, max, value, step, onInput, fmt = (v) => String(v)) {
  const out = el('output', {}, fmt(value));
  const inp = /** @type {HTMLInputElement} */ (el('input', { type: 'range', min, max, step, value }));
  const id = 'co-sl-' + Math.random().toString(36).slice(2, 7); inp.id = id;
  inp.addEventListener('input', () => { out.textContent = fmt(+inp.value); onInput(+inp.value); });
  return el('label', { class: 'co-slider', for: id }, el('span', {}, label), inp, out);
}
/** rangée de touches à bascule (une seule allumée) */
export function choice(label, options, value, onChange) {
  const box = el('div', { class: 'seg co-seg', role: 'group', 'aria-label': label });
  const set = (v) => { for (const b of box.children) b.setAttribute('aria-pressed', String(b.dataset.v === v)); onChange(v); };
  for (const [v, text, title] of options) box.append(el('button', { type: 'button', 'data-v': v, title: title || text, 'aria-pressed': String(v === value), onclick: () => set(v) }, text));
  return el('div', { class: 'co-choice' }, el('span', {}, label), box);
}
/** lecture « clé : valeur » mise à jour par set(k, v) */
export function readout(keys) {
  const vals = {};
  const dl = el('dl', { class: 'co-read' }, ...keys.map((k) => { vals[k] = el('dd', {}, '—'); return el('div', {}, el('dt', {}, k), vals[k]); }));
  return { el: dl, set: (k, v) => { if (vals[k]) vals[k].textContent = v; } };
}
export const fmtNum = (v, d = 0) => v.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });

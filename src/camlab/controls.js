// @ts-check
import { el, clamp } from '../util.js';
import { focusDist, focusPos, zoomFocal, zoomPos, effAperture, ND, fr, distLabel } from './optics.js';

// ----------------------------------------------------------------------------------
// Les commandes des manipulations : curseurs, touches à bascule, bascule de zoom à ressort, et
// le cadre commun (viseur, mesures, commandes, Olivier, défis). Les bagues de l'objectif sont
// des positions de 0 à 1, comme sur la caméra 3D : zoom logarithmique, point en 1/d (affiché
// en racine, comme l'échelle gravée), iris de f/1,8 à f/16 puis C (fermé).
// ----------------------------------------------------------------------------------

/** un curseur avec son libellé et sa valeur */
export function slider(label, min, max, step, value, onInput, cls = '') {
  const out = el('output', { class: 'cl-out' });
  const input = /** @type {HTMLInputElement} */ (el('input', { type: 'range', min, max, step, value, 'aria-label': label, oninput: () => onInput(Number(input.value)) }));
  return { row: el('label', { class: 'cl-row ' + cls }, el('span', { class: 'cl-lbl' }, label), input, out), input, out, set(v) { input.value = String(v); } };
}
/** une rangée de touches dont une seule est enfoncée */
export function seg(label, options, value, onChange, cls = '') {
  const box = el('div', { class: 'seg cl-seg', role: 'group', 'aria-label': label });
  const mark = (v) => { for (const b of box.children) b.setAttribute('aria-pressed', String(/** @type {HTMLElement} */ (b).dataset.v === String(v))); };
  const set = (v) => { mark(v); onChange(v); };
  for (const [v, text] of options) box.append(el('button', { type: 'button', 'data-v': String(v), 'aria-pressed': String(v === value), onclick: () => set(v) }, text));
  return { row: el('div', { class: 'cl-row ' + cls }, el('span', { class: 'cl-lbl' }, label), box), set, mark, box };
}
/** une touche qui s'allume */
export function toggle(label, on, onChange) {
  const b = el('button', { type: 'button', class: 'btn small', 'aria-pressed': String(!!on) }, label);
  const set = (v) => { b.setAttribute('aria-pressed', String(!!v)); b.classList.toggle('on', !!v); };
  b.onclick = () => { const v = b.getAttribute('aria-pressed') !== 'true'; set(v); onChange(v); };
  set(on);
  return { btn: b, set };
}
/** une rangée de boutons */
export const btnRow = (...items) => el('div', { class: 'cl-row cl-btns' }, ...items);
export const linkBtn = (label, onclick) => el('button', { type: 'button', class: 'linkbtn', onclick }, label);

/**
 * Bascule de zoom à ressort (W–T) : plus on appuie, plus le zoom va vite ; relâchée, elle revient
 * au milieu. onSpeed(v) reçoit la vitesse de -1 (W) à +1 (T).
 */
export function rocker(onSpeed) {
  const input = /** @type {HTMLInputElement} */ (el('input', { type: 'range', min: -1, max: 1, step: 0.01, value: 0, class: 'cl-rocker', 'aria-label': 'Bascule de zoom : W à gauche, T à droite ; flèches gauche et droite' }));
  const back = () => { input.value = '0'; onSpeed(0); };
  input.addEventListener('input', () => onSpeed(Number(input.value)));
  input.addEventListener('pointerup', back); input.addEventListener('pointercancel', back); input.addEventListener('blur', back);
  input.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); input.value = e.key === 'ArrowRight' ? '0.6' : '-0.6'; onSpeed(Number(input.value)); } });
  input.addEventListener('keyup', (e) => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') back(); });
  const out = el('output', { class: 'cl-out' });
  return { row: el('label', { class: 'cl-row cl-rk' }, el('span', { class: 'cl-lbl' }, 'Bascule W–T'), el('span', { class: 'cl-rkw' }, el('b', {}, 'W'), input, el('b', {}, 'T')), out), input, out };
}

// ---------------- les bagues de l'objectif ----------------
/** l'iris : position 0 (f/1,8) à 0,96 (f/16), au-delà C (fermé) */
export const IRIS_C = 0.97;
export const irisN = (n) => (n >= IRIS_C ? Infinity : 1.8 * Math.pow(16 / 1.8, n / 0.96));
export const irisPos = (N) => (isFinite(N) ? clamp(Math.log(N / 1.8) / Math.log(16 / 1.8) * 0.96, 0, 0.96) : 1);
/** la bague de point : position affichée (racine, comme l'échelle) ↔ distance */
export const pointDist = (s) => focusDist(Math.pow(s, 1 / 0.45));
export const pointPos = (d) => Math.pow(focusPos(d), 0.45);
export const irisLabel = (N, Nset) => (isFinite(N) ? 'f/' + fr(N) + (Nset != null && N > Nset + 0.01 ? ' (ramping)' : '') : 'C (fermé)');

/**
 * Les trois bagues : st = { z, s, n } (positions), up() à chaque changement. which : celles à
 * montrer. Renvoie les rangées, et sync() pour remettre les curseurs aux valeurs de st.
 */
export function lensRings(st, up, which = ['zoom', 'point', 'iris']) {
  const rows = [], parts = {};
  if (which.includes('zoom')) { parts.zoom = slider('Zoom', 0, 1, 0.001, st.z, (v) => { st.z = v; up(); }); rows.push(parts.zoom.row); }
  if (which.includes('point')) { parts.point = slider('Bague de point', 0, 1, 0.0005, st.s, (v) => { st.s = v; up(); }); rows.push(parts.point.row); }
  if (which.includes('iris')) { parts.iris = slider('Iris', 0, 1, 0.001, st.n, (v) => { st.n = v; up(); }); rows.push(parts.iris.row); }
  const sync = () => { if (parts.zoom) parts.zoom.set(st.z); if (parts.point) parts.point.set(st.s); if (parts.iris) parts.iris.set(st.n); };
  /** les valeurs optiques de st : focale, distance, ouverture effective (ramping) */
  const read = () => { const f = zoomFocal(st.z), Nset = irisN(st.n); return { f, dF: pointDist(st.s), Nset, N: isFinite(Nset) ? effAperture(Nset, f) : Infinity }; };
  const show = () => {
    const o = read();
    if (parts.zoom) parts.zoom.out.textContent = fr(o.f, o.f < 10 ? 1 : 0) + ' mm';
    if (parts.point) parts.point.out.textContent = distLabel(o.dF);
    if (parts.iris) parts.iris.out.textContent = irisLabel(o.N, o.Nset);
  };
  return { rows, parts, sync, read, show };
}
/** l'état à envoyer à la caméra 3D (bagues, filtre, image) */
export function lensState(st, o, extra = {}) {
  return { zoom: st.z, focus: Math.pow(st.s, 1 / 0.45), iris: o.N, ff: st.delta || 0, nd: ND.findIndex((x) => x[1] === (st.nd != null ? st.nd : 1)), focal: o.f, dF: o.dF, ...extra };
}
export { zoomPos, pointPos as focusRingPos };

// ---------------- le cadre d'une manipulation ----------------
/**
 * vf : le viseur ; scope : un canvas de mesure (ou null) ; ctrls : rangées de commandes ;
 * defis : les étapes. Renvoie { node, say(texte), done(drapeaux) }.
 */
export function shell({ vf, scope = null, ctrls, defis, extra = null, vfClass = '' }) {
  const say = el('p', { class: 'cl-say', 'aria-live': 'polite' });
  const list = el('ol', { class: 'cl-defis' }, ...defis.map((t) => el('li', {}, t)));
  const screen = el('div', { class: 'cl-vf ' + vfClass }, vf ? vf.canvas : null, scope ? el('div', { class: 'cl-scope' }, scope) : null);
  const node = el('div', { class: 'cl-lab' }, screen, el('div', { class: 'cl-ctrls' }, ...ctrls), el('div', { class: 'cl-olivier' }, el('b', {}, 'Olivier'), say), list, extra);
  let last = '';
  return {
    node, screen,
    say(t) { if (t !== last) { say.textContent = t; last = t; } },
    done(flags) { [...list.children].forEach((li, i) => li.classList.toggle('done', !!flags[i])); },
  };
}
/** un canvas de mesure (forme d'onde, parade) */
export const scopeCanvas = () => { const c = document.createElement('canvas'); c.width = 320; c.height = 118; c.className = 'cl-scopec'; c.setAttribute('aria-label', 'Moniteur de forme d\'onde : niveau de l\'image de 0 à 100 %'); return c; };

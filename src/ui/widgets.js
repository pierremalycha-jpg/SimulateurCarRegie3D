import { S, camById } from '../state.js';
import { el, clamp, tc, fmt } from '../util.js';
import { $ } from './common.js';
import { allSources, sourceLabel } from '../pipeline.js';

// ----------------------------------------------------------------------------------
// Fil d'explications « Ce qui se passe »
// ----------------------------------------------------------------------------------
export const EXPL = { box: null, list: null, last: '', lastT: 0 };
export function explainBox() {
  const list = el('div', { class: 'ex-list' });
  const box = el('div', { class: 'explain' }, el('div', { class: 'ex-h' }, el('span', { class: 'dot amber' }), 'Ce qui se passe'), list);
  EXPL.box = box; EXPL.list = list;
  list.appendChild(el('div', { class: 'ex-item muted' }, 'Chaque action que vous faites ici est expliquée en direct : ce qu\'elle change dans le signal et ce que vous devez voir à l\'image.'));
  return box;
}
export function explain(text, kind = '') {
  if (!EXPL.list || !EXPL.list.isConnected) return;
  const now = performance.now();
  // remplace l'entrée précédente si c'est le même réglage qui continue de bouger
  const key = kind.split(':')[1] || '';
  const first = EXPL.list.firstChild;
  if (key && first && first.dataset.key === key && now - EXPL.lastT < 2500) { first.querySelector('.ex-t').textContent = text; EXPL.lastT = now; return; }
  EXPL.lastT = now;
  const tone = kind.split(':')[0];
  const it = el('div', { class: 'ex-item' + (['warn', 'muted', 'ok'].includes(tone) ? ' ' + tone : '') }, el('span', { class: 'ex-tc' }, tc(S.tcOffset + S.simTime).slice(0, 8)), el('span', { class: 'ex-t' }, text));
  it.dataset.key = key;
  EXPL.list.prepend(it);
  while (EXPL.list.children.length > 9) EXPL.list.lastChild.remove();
}

// ----------------------------------------------------------------------------------
// Molette rotative (glisser verticalement ou molette de souris, double-clic = zéro)
// ----------------------------------------------------------------------------------
export function rotary(label, get, set, opts = {}) {
  const min = opts.min ?? -99, max = opts.max ?? 99, step = opts.step ?? 1, size = opts.size ?? 46;
  const cap = el('div', { class: 'rot-cap', style: { width: size + 'px', height: size + 'px' } }, el('i'));
  const val = el('div', { class: 'rot-val' });
  const w = el('div', { class: 'rot' + (opts.color ? ' ' + opts.color : ''), tabindex: 0, role: 'slider', 'aria-label': label, title: opts.title || label }, cap, el('div', { class: 'rot-l' }, label), val);
  const fmtv = opts.fmt || ((v) => (v > 0 ? '+' : '') + Math.round(v));
  const draw = () => { const v = get(); const a = ((v - min) / (max - min)) * 270 - 135; cap.firstChild.style.transform = `rotate(${a}deg)`; val.textContent = fmtv(v); w.setAttribute('aria-valuenow', v); };
  const apply = (v) => { v = clamp(Math.round(v / step) * step, min, max); if (v !== get()) { set(v); draw(); } };
  let drag = null;
  cap.addEventListener('pointerdown', (e) => { drag = { y: e.clientY, x: e.clientX, v: get() }; cap.setPointerCapture(e.pointerId); e.preventDefault(); });
  cap.addEventListener('pointermove', (e) => { if (!drag) return; const d = (drag.y - e.clientY) + (e.clientX - drag.x) * 0.5; apply(drag.v + d * (max - min) / 300); });
  cap.addEventListener('pointerup', () => { drag = null; });
  w.addEventListener('wheel', (e) => { e.preventDefault(); apply(get() + (e.deltaY < 0 ? 1 : -1) * step * (e.shiftKey ? 10 : (opts.wheel ?? 2))); }, { passive: false });
  w.addEventListener('dblclick', () => apply(opts.zero ?? 0));
  w.addEventListener('keydown', (e) => { if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { apply(get() + step); e.preventDefault(); } if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { apply(get() - step); e.preventDefault(); } });
  w.refresh = draw; draw();
  return w;
}

// ----------------------------------------------------------------------------------
// Joystick IRIS / MASTER BLACK (comme sur un RCP)
//   - glisser la poignée verticalement : iris (haut = ouvrir)
//   - faire tourner la bague (glisser horizontalement ou molette) : master black
// ----------------------------------------------------------------------------------
export function joystick(getPos, setPos, getRing, setRing) {
  const ring = el('div', { class: 'rjoy-ring' });
  const handle = el('div', { class: 'rjoy-handle' });
  const track = el('div', { class: 'rjoy-track' }, handle);
  const w = el('div', { class: 'rjoy', tabindex: 0, role: 'group', 'aria-label': 'Joystick iris et master black' }, ring, track);
  const draw = () => { const p = getPos(); handle.style.top = `${(1 - p) * 100}%`; const r = getRing(); ring.style.background = `conic-gradient(from -135deg, var(--amber) 0deg ${((r + 99) / 198) * 270}deg, #2a3138 ${((r + 99) / 198) * 270}deg 270deg, transparent 270deg)`; };
  let drag = null;
  handle.addEventListener('pointerdown', (e) => { drag = { mode: 'iris', y: e.clientY, p: getPos(), h: track.getBoundingClientRect().height }; handle.setPointerCapture(e.pointerId); e.preventDefault(); e.stopPropagation(); });
  handle.addEventListener('pointermove', (e) => { if (!drag) return; setPos(clamp(drag.p + (drag.y - e.clientY) / Math.max(drag.h * 2, 140), 0, 1)); draw(); });
  handle.addEventListener('pointerup', () => { drag = null; });
  ring.addEventListener('pointerdown', (e) => { drag = { mode: 'ring', x: e.clientX, r: getRing() }; ring.setPointerCapture(e.pointerId); e.preventDefault(); });
  ring.addEventListener('pointermove', (e) => { if (!drag || drag.mode !== 'ring') return; setRing(clamp(Math.round(drag.r + (e.clientX - drag.x) * 0.6), -99, 99)); draw(); });
  ring.addEventListener('pointerup', () => { drag = null; });
  w.addEventListener('wheel', (e) => { e.preventDefault(); if (e.shiftKey) setRing(clamp(getRing() + (e.deltaY < 0 ? 2 : -2), -99, 99)); else setPos(clamp(getPos() + (e.deltaY < 0 ? 0.01 : -0.01), 0, 1)); draw(); }, { passive: false });
  w.addEventListener('keydown', (e) => { if (e.key === 'ArrowUp') { setPos(clamp(getPos() + 0.01, 0, 1)); draw(); e.preventDefault(); } if (e.key === 'ArrowDown') { setPos(clamp(getPos() - 0.01, 0, 1)); draw(); e.preventDefault(); } if (e.key === 'ArrowLeft') { setRing(clamp(getRing() - 2, -99, 99)); draw(); e.preventDefault(); } if (e.key === 'ArrowRight') { setRing(clamp(getRing() + 2, -99, 99)); draw(); e.preventDefault(); } });
  w.refresh = draw; draw();
  return w;
}

// ----------------------------------------------------------------------------------
// Moniteur flottant (déplaçable) : n'importe quelle source, pour voir l'effet de ses réglages
// ----------------------------------------------------------------------------------
export function toggleFloatMon(src) {
  let f = $('#floatmon');
  if (f && !src) { f.remove(); return; }
  if (!f) {
    const sel = el('select', { id: 'fmsrc', 'aria-label': 'Source du moniteur flottant' });
    const fill = () => {
      const cur = sel.value || src || 'PGM'; sel.innerHTML = '';
      const opts = [['PGM', 'PGM'], ['PVW', 'PVW'], ['mv', 'Multiview'], ['CLEAN', 'Clean feed'], ['RETANT', 'Retour antenne'], ['EVSA', 'EVS A'], ['EVSB', 'EVS B'], ['scope', 'Oscilloscope'], ['AUX_VISION', 'Moniteur vision'], ...S.cams.map((c) => ['CAM' + c.id, 'CAM ' + c.id])];
      for (const [v, l] of opts) { const o = el('option', { value: v }, l); if (v === cur) o.selected = true; sel.appendChild(o); }
    };
    fill();
    const video = el('div', { class: 'fm-video', 'data-gl': src || 'PGM' });
    sel.addEventListener('change', () => { video.dataset.gl = sel.value; });
    const size = (w) => { f.style.width = w + 'px'; };
    const head = el('div', { class: 'fm-head' }, el('span', { class: 'fm-grip' }, '⠿ Moniteur'), sel,
      el('button', { class: 'btn small', onclick: () => size(300) }, 'S'), el('button', { class: 'btn small', onclick: () => size(480) }, 'M'), el('button', { class: 'btn small', onclick: () => size(720) }, 'L'),
      el('button', { class: 'x', 'aria-label': 'Fermer le moniteur', onclick: () => f.remove() }, '×'));
    f = el('div', { id: 'floatmon', class: 'floatmon' }, head, video);
    document.body.appendChild(f);
    let d = null;
    head.addEventListener('pointerdown', (e) => { if (e.target.tagName === 'SELECT' || e.target.tagName === 'BUTTON') return; const r = f.getBoundingClientRect(); d = { x: e.clientX - r.left, y: e.clientY - r.top }; head.setPointerCapture(e.pointerId); });
    head.addEventListener('pointermove', (e) => { if (!d) return; f.style.left = clamp(e.clientX - d.x, 0, window.innerWidth - 120) + 'px'; f.style.top = clamp(e.clientY - d.y, 0, window.innerHeight - 60) + 'px'; f.style.right = 'auto'; f.style.bottom = 'auto'; });
    head.addEventListener('pointerup', () => { d = null; });
    f.refill = fill;
  } else if (src) { $('#fmsrc').value = src; $('#floatmon .fm-video').dataset.gl = src; }
}

// ----------------------------------------------------------------------------------
// Chaîne de traitement de la caméra (étapes, valeurs, étape modifiée)
// ----------------------------------------------------------------------------------
export const STAGES = [
  ['optique', 'Optique', 'Iris, filtres ND : quantité de lumière qui entre.'],
  ['capteur', 'Capteurs', 'Prisme + 3 capteurs ; le shutter fixe le temps de pose.'],
  ['gain', 'Gain', 'Amplification (dB) : plus de signal, plus de bruit.'],
  ['blanc', 'Balance', 'Gains R/G/B : un blanc doit rester blanc sous la lumière du moment.'],
  ['noir', 'Noirs', 'Pedestal : niveau du noir, global et par couleur.'],
  ['gamma', 'Gamma', 'Courbe de transfert (BT.709 / HLG) et black gamma.'],
  ['knee', 'Knee', 'Compression des hautes lumières avant l\'écrêtage.'],
  ['detail', 'Détail', 'Accentuation des contours.'],
  ['matrice', 'Matrice', 'Saturation et rendu des couleurs.'],
  ['sortie', 'Sortie', 'Signal SDI / IP vers la grille.'],
];
export function chainBox() {
  const row = el('div', { class: 'chain-row' });
  const cells = {};
  for (const [k, l, d] of STAGES) { const v = el('small', {}, ''); const c = el('div', { class: 'chain-cell', title: d }, el('b', {}, l), v); cells[k] = { c, v }; row.appendChild(c); }
  const box = el('div', { class: 'chainbox' }, el('div', { class: 'ex-h' }, 'Chaîne de traitement de la caméra'), row);
  box.update = (cam, hot) => {
    if (!cam) return;
    const p = cam.paint;
    const vals = {
      optique: `F${fmt(cam.effAperture(), 1)} · ND ${['CLR', '1/4', '1/8', '1/16', '1/64'][p.nd]}`, capteur: `1/${Math.round(1 / cam.exposureTime())} s`, gain: `${p.gain > 0 ? '+' : ''}${p.gain} dB`,
      blanc: `R${p.wbR} G${p.wbG} B${p.wbB}`, noir: `M ${p.mblack}`, gamma: p.gammaOn ? `${p.gamma}${p.blackGamma ? ' · BG ' + p.blackGamma : ''}` : 'OFF', knee: p.kneeOn ? `${p.knee} · WC ${p.wclip ?? 109}` : `OFF · WC ${p.wclip ?? 109}`, detail: p.detailOn ? String(p.detail) : 'OFF', matrice: p.matrixOn ? p.sat + ' %' : 'OFF', sortie: cam.signalOK ? (S.format === 'UHD' ? '12G UHD' : '3G HD') : 'DÉFAUT',
    };
    for (const k in cells) { cells[k].v.textContent = vals[k]; cells[k].c.classList.toggle('hot', hot === k); }
  };
  return box;
}

export function srcOptions() { return allSources().filter((s) => s.exists).map((s) => [s.id, sourceLabel(s.id)]); }

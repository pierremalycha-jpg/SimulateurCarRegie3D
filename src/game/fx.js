// @ts-check
import { S, on, emit } from '../state.js';
import { el } from '../util.js';
import { $ } from '../ui/common.js';
import { icon } from '../ui/icons.js';
import { xpOf, levelOf } from './xp.js';
import { whereAmI } from '../app/hud.js';

// ----------------------------------------------------------------------------------
// Les effets de jeu : la barre d'XP du HUD et ses « +25 XP » qui montent, la bannière de
// niveau, la bannière de badge, la carte-titre à l'entrée dans un lieu (compound, car), la
// vignette, le flash rouge du tally à chaque commutation, l'alerte de panne. Rien dans la 3D :
// des couches HTML par-dessus, peu coûteuses, coupées par « réduire les animations ».
// ----------------------------------------------------------------------------------
const F = { xp: /** @type {HTMLElement | null} */ (null), banner: /** @type {HTMLElement | null} */ (null), card: /** @type {HTMLElement | null} */ (null), queue: /** @type {Array<() => void>} */ ([]), busy: false, inTruck: false, cardT: 0, cardT2: 0 };

function build() {
  const hud = $('#hud'); if (!hud) return;
  hud.prepend(el('div', { id: 'vignette', 'aria-hidden': 'true' }));
  F.xp = el('div', { id: 'xpbar', class: 'xpbar', title: 'Ton niveau et ton expérience : ouvre le journal des missions (L)', role: 'button', tabindex: '0' },
    el('span', { class: 'xp-lvl' }, el('small', {}, 'NIV'), el('b', {}, '1')), el('span', { class: 'xp-track' }, el('i')), el('span', { class: 'xp-txt' }, ''), el('span', { class: 'xp-floats' }));
  F.xp.addEventListener('click', () => { if (S.mode !== 'start') emit('journal'); });
  F.xp.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); F.xp.click(); } });
  const tb = $('#hud .topbar'); if (tb) tb.append(F.xp); else hud.append(F.xp);
  F.banner = el('div', { id: 'banner', hidden: true, role: 'status', 'aria-live': 'polite' });
  F.card = el('div', { id: 'titlecard', hidden: true, 'aria-hidden': 'true' });
  hud.append(F.banner, F.card);
  renderXp();
}
export function renderXp() {
  if (!F.xp) return;
  const xp = xpOf(), L = levelOf(xp);
  F.xp.querySelector('.xp-lvl b').textContent = String(L.n);
  /** @type {HTMLElement} */ (F.xp.querySelector('.xp-track i')).style.width = `${Math.round(L.pct * 100)}%`;
  F.xp.querySelector('.xp-txt').textContent = L.next ? `${L.title} · ${xp} / ${L.next} XP` : `${L.title} · ${xp} XP`;
}
function floatXp(pts) {
  if (!F.xp) return;
  const box = F.xp.querySelector('.xp-floats'); if (!box) return;
  const f = el('span', { class: 'xp-float' }, `+${pts} XP`);
  box.append(f); setTimeout(() => f.remove(), 1600);
  F.xp.classList.remove('bump'); void F.xp.offsetWidth; F.xp.classList.add('bump');
}
// bannières (niveau, badge) : une à la fois, 3,6 s chacune
function banner(cls, kids) {
  F.queue.push(() => {
    const b = F.banner; if (!b) return;
    b.className = 'banner ' + cls; b.replaceChildren(...kids); b.hidden = false;
    setTimeout(() => b.classList.add('out'), 3100);
    setTimeout(() => { b.hidden = true; F.busy = false; next(); }, 3700);
  });
  next();
}
function next() { if (F.busy || !F.queue.length) return; F.busy = true; const f = F.queue.shift(); if (f) f(); }
// carte-titre : le nom du lieu en grand, qui s'efface
export function titleCard(big, small) {
  const c = F.card; if (!c) return;
  c.replaceChildren(el('small', {}, small || ''), el('b', {}, big));
  c.hidden = false; c.classList.remove('show', 'out'); void c.offsetWidth; c.classList.add('show');
  clearTimeout(F.cardT); clearTimeout(F.cardT2);
  F.cardT2 = window.setTimeout(() => c.classList.add('out'), 2600); F.cardT = window.setTimeout(() => { c.hidden = true; }, 3300);
}
const pulse = (cls, ms) => { const hud = $('#hud'); if (!hud) return; hud.classList.remove(cls); void hud.offsetWidth; hud.classList.add(cls); setTimeout(() => hud.classList.remove(cls), ms); };

export function installFx() {
  build();
  on('xp', (r) => { if (!r) return; renderXp(); floatXp(r.pts); if (r.leveled) banner('level', [icon('couronne'), el('small', {}, 'Niveau ' + r.level.n), el('b', {}, r.level.title), el('span', {}, 'Tu progresses : continue, le car compte sur toi.')]); });
  on('badge', (b) => { if (!b) return; banner('badge ' + b.tier, [icon(b.ico), el('small', {}, 'Badge ' + ({ bronze: 'bronze', argent: 'argent', or: 'or' })[b.tier]), el('b', {}, b.title), el('span', {}, b.desc)]); });
  on('shared', renderXp);
  on('mixer', (e) => { if (e && (e.type === 'cut' || e.type === 'transition') && S.mode !== 'start') pulse('tally-flash', 450); });
  on('faultNew', () => pulse('alarm-flash', 1600));
  on('started', () => { F.inTruck = S.inTruck; const z = whereAmI(); setTimeout(() => titleCard(z[0], z[1]), 700); const hud = $('#hud'); if (hud) { hud.classList.add('fade-in'); setTimeout(() => hud.classList.remove('fade-in'), 1400); } });
  on('teleport', () => { const z = whereAmI(); titleCard(z[0], z[1]); F.inTruck = S.inTruck; });
  // entrée dans le car, sortie : une carte-titre (le lieu change sans téléportation)
  setInterval(() => { if (S.mode !== 'fps') return; if (S.inTruck !== F.inTruck) { F.inTruck = S.inTruck; const z = whereAmI(); titleCard(z[0], z[1]); } }, 400);
}

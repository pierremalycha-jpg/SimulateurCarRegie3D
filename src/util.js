// @ts-check
// Utilitaires partagés
import { report } from './diag.js';
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const DEG = Math.PI / 180;
export const wrapAngle = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
export const lerpAngle = (a, b, t) => a + wrapAngle(b - a) * t;
export const dbToLin = (db) => Math.pow(10, db / 20);
export const linToDb = (l) => 20 * Math.log10(Math.max(l, 1e-9));
export const powDbToLin = (db) => Math.pow(10, db / 10);
export const linToPowDb = (l) => 10 * Math.log10(Math.max(l, 1e-15));

// Ressort amorti critique (valeur, vitesse) -> utilisé pour les mouvements de caméra
export function spring(state, target, omega, dt, maxVel = Infinity) {
  const x = state.v - target;
  const exp = Math.exp(-omega * dt);
  let nv = (state.vel - omega * omega * x * dt) * exp;
  nv = clamp(nv, -maxVel, maxVel);
  state.vel = nv;
  state.v += nv * dt;
  return state.v;
}
export function springAngle(state, target, omega, dt, maxVel = Infinity) {
  const t = state.v + wrapAngle(target - state.v);
  return spring(state, t, omega, dt, maxVel);
}

// PRNG déterministe
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const rand = mulberry32(20261015);
export const randRange = (a, b) => a + (b - a) * rand();
export const randPick = (arr) => arr[Math.floor(rand() * arr.length)];
export function gauss() { let u = 0, v = 0; while (u === 0) u = rand(); while (v === 0) v = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

// Timecode 25 i/s (Europe, 50 Hz)
export function tc(seconds, fps = 25) {
  if (!isFinite(seconds)) return '--:--:--:--';
  const s = Math.max(0, seconds);
  const total = Math.floor(s * fps + 1e-6);
  const ff = total % fps;
  const ts = Math.floor(total / fps);
  const ss = ts % 60, mm = Math.floor(ts / 60) % 60, hh = Math.floor(ts / 3600) % 24;
  const p = (n) => String(n).padStart(2, '0');
  return `${p(hh)}:${p(mm)}:${p(ss)}:${p(ff)}`;
}
export function clockStr(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const p = (n) => String(n).padStart(2, '0');
  return `${p(Math.floor(s / 3600) % 24)}:${p(Math.floor(s / 60) % 60)}:${p(s % 60)}`;
}
export function mmss(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// geste de l'interface (clic, saisie…) : une erreur est notée dans le journal avec l'élément concerné,
// au lieu de remonter au navigateur, qui en masque le détail (« Script error. ») dans une page
// ouverte comme fichier sous Safari ; une promesse rejetée (gestionnaire async) aussi
const GESTE = { click: 'clic', input: 'saisie', change: 'choix', keydown: 'touche', pointerdown: 'appui', toggle: 'ouverture' };
function guard(type, node, f) {
  const where = () => `${GESTE[type] || type} sur ${node.tagName.toLowerCase()}${node.textContent ? ` « ${node.textContent.trim().slice(0, 40)} »` : ''}`;
  const fail = (er) => { report(er, where()); console.error(er); };
  return function (ev) {
    try { const r = f.call(this, ev); if (r && typeof r.then === 'function') r.then(null, fail); } catch (er) { fail(er); }
  };
}
export const el = (tag, attrs = {}, ...children) => {
  const e = document.createElement(tag);
  for (const k in attrs) {
    const v = attrs[k];
    if (k === 'class') e.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), guard(k.slice(2), e, v));
    else if (k === 'html') e.innerHTML = v;
    else if (v === true) e.setAttribute(k, '');
    else if (v !== false && v != null) e.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    e.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
  return e;
};

export const fmt = (v, d = 1) => (Math.round(v * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d).replace('.', ',');

// Couleur approx. d'une source lumineuse selon sa température (normalisée à 5600 K)
export function kelvinRGB(k) {
  const t = k / 100;
  let r, g, b;
  if (t <= 66) { r = 255; g = 99.4708025861 * Math.log(t) - 161.1195681661; }
  else { r = 329.698727446 * Math.pow(t - 60, -0.1332047592); g = 288.1221695283 * Math.pow(t - 60, -0.0755148492); }
  if (t >= 66) b = 255; else if (t <= 19) b = 0; else b = 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  r = clamp(r, 0, 255) / 255; g = clamp(g, 0, 255) / 255; b = clamp(b, 0, 255) / 255;
  // linéarisation approximative
  return [Math.pow(r, 2.2), Math.pow(g, 2.2), Math.pow(b, 2.2)];
}
export function kelvinRGBNorm(k) {
  const ref = kelvinRGB(5600); const c = kelvinRGB(k);
  const r = c[0] / ref[0], g = c[1] / ref[1], b = c[2] / ref[2];
  return [r / g, 1, b / g];
}

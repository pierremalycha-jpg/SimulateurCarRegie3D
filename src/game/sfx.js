// @ts-check
import { on } from '../state.js';
import { RECETTES, recetteCurseur, dureeDe } from './sons.js';

// ----------------------------------------------------------------------------------
// Bruitages de l'interface, synthétisés en WebAudio (aucun fichier : la page reste un seul
// fichier, comme la console son). Les recettes sont dans src/game/sons.js (calcul pur) ; ici le
// moteur qui les joue et les accroches sur les gestes et les événements du simulateur.
//
// La chaîne de sortie, commune à tous les sons : bus → coupe-bas 40 Hz → coupe-haut 11 kHz →
// compresseur → volume des bruitages → haut-parleurs, avec un départ par son vers une
// réverbération courte (réponse impulsionnelle calculée : 1,1 s, aigus amortis). Les clics
// varient un peu à chaque fois (± 3 % de hauteur) pour ne pas sonner « mitraillette ».
//
// Le vocabulaire (nom → quand) :
//   ui, press, tap, tab, toggleOn/Off, select, fold   une touche, la principale, une application du
//                                                       téléphone, un onglet, un interrupteur, une
//                                                       carte de Jouer, un repli
//   hover                                              survol ou flèches dans un menu
//   open, close, layer, poste                          une fenêtre, le Cours, s'asseoir à un poste
//   telUp, telDown                                     lever et ranger le téléphone
//   confirm, error, notify, dialog                     réussite, refus, information, Olivier parle
//   step, check, quizok, mission, unlock, xp, badge,   une étape, une tâche cochée, un quiz juste, une
//   levelup                                            mission, un niveau du Cours ouvert, des points,
//                                                       un badge, un niveau de technicien
//   alarm, tally, intercom, whoosh, place              une panne, un CUT, l'intercom, un déplacement,
//                                                       une caméra posée
//   launch, onair, offair                              la partie commence, top antenne, fin d'antenne
// Le contexte audio est créé au premier geste de l'utilisateur (règle des navigateurs). Les
// bruitages ont leur propre réglage (Réglages → Jeu), indépendant du son d'ambiance du car.
// ----------------------------------------------------------------------------------
const KEY = 'carregie.jeu';
/** @type {{ sfx: boolean, volume: number, quest: boolean, marker: boolean, minimap: boolean }} */
export const JEU = { sfx: true, volume: 0.6, quest: true, marker: true, minimap: false };
try { Object.assign(JEU, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* stockage indisponible */ }
export function saveJeu() { try { localStorage.setItem(KEY, JSON.stringify(JEU)); } catch (e) { /* stockage indisponible */ } applyJeu(); }
/** classes du document pilotées par les réglages du jeu (le mini-plan du car dans le HUD) */
export function applyJeu() { document.body.classList.toggle('hud-map', !!JEU.minimap); }

/** @typedef {import('./sons.js').Recette} Recette */
/** @typedef {import('./sons.js').Voix} Voix */
/** @typedef {{ bus: AudioNode, envoi: AudioNode, sortie: GainNode }} Chaine */

const FX = { ctx: /** @type {AudioContext | null} */ (null), ch: /** @type {Chaine | null} */ (null), last: /** @type {Record<string, number>} */ ({}), joues: 0, dernier: '' };
/** @type {WeakMap<BaseAudioContext, AudioBuffer>} */
const BRUIT = new WeakMap();

function ctxNow() {
  if (FX.ctx) { if (FX.ctx.state === 'suspended') FX.ctx.resume().catch(() => {}); return FX.ctx; }
  const AC = window.AudioContext || /** @type {any} */ (window).webkitAudioContext; if (!AC) return null;
  try { FX.ctx = new AC(); } catch (e) { return null; }
  FX.ch = chaine(FX.ctx, FX.ctx.destination, JEU.volume);
  return FX.ctx;
}
/** le volume des bruitages (0 à 1) */
export function setSfxVolume(v) { JEU.volume = Math.max(0, Math.min(1, v)); if (FX.ch) FX.ch.sortie.gain.value = JEU.volume; saveJeu(); }

/**
 * La chaîne de sortie : filtres, compresseur, volume, et la réverbération en départ.
 * @param {BaseAudioContext} c @param {AudioNode} dest @param {number} volume
 * @returns {Chaine}
 */
export function chaine(c, dest, volume) {
  const bus = c.createGain();
  const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 40;
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 11000; lp.Q.value = 0.5;
  const comp = c.createDynamicsCompressor();
  comp.threshold.value = -16; comp.knee.value = 8; comp.ratio.value = 3; comp.attack.value = 0.003; comp.release.value = 0.15;
  const sortie = c.createGain(); sortie.gain.value = volume;
  const rattrapage = c.createGain(); rattrapage.gain.value = 1.5; // le gain que le compresseur a pris
  bus.connect(hp); hp.connect(lp); lp.connect(comp); comp.connect(rattrapage); rattrapage.connect(sortie); sortie.connect(dest);
  const envoi = c.createGain();
  const rev = c.createConvolver(); rev.buffer = reponse(c);
  const retour = c.createGain(); retour.gain.value = 0.9;
  envoi.connect(rev); rev.connect(retour); retour.connect(comp);
  return { bus, envoi, sortie };
}
// réponse impulsionnelle d'une petite salle mate : bruit stéréo qui décroît, de plus en plus sombre
function reponse(/** @type {BaseAudioContext} */ c) {
  const sr = c.sampleRate, n = Math.round(sr * 1.1), pre = Math.round(sr * 0.01);
  const b = c.createBuffer(2, n, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch); let y = 0;
    for (let i = pre; i < n; i++) {
      const t = (i - pre) / sr;
      const k = Math.min(0.95, 0.15 + t * 0.9); // le filtre se ferme : les aigus s'éteignent d'abord
      y = y * k + (Math.random() * 2 - 1) * (1 - k);
      d[i] = y * Math.exp(-t * 5.5) * 2.2;
    }
  }
  return b;
}
function bruit(/** @type {BaseAudioContext} */ c) {
  let b = BRUIT.get(c); if (b) return b;
  const n = c.sampleRate; b = c.createBuffer(1, n, c.sampleRate); const d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  BRUIT.set(c, b); return b;
}
// enveloppe : montée linéaire (a), puis chute exponentielle jusqu'au silence à la fin de d
function enveloppe(/** @type {BaseAudioContext} */ c, t, a, d, g) {
  const e = c.createGain();
  e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(g, t + a);
  e.gain.setTargetAtTime(0, t + a, Math.max(0.003, (d - a) / 4.5));
  return e;
}
function panneau(/** @type {BaseAudioContext} */ c, /** @type {AudioNode} */ dest, t, d, pan = 0, pan2 = pan) {
  if (!pan && !pan2) return dest;
  if (!c.createStereoPanner) return dest;
  const p = c.createStereoPanner(); p.pan.setValueAtTime(pan, t); if (pan2 !== pan) p.pan.linearRampToValueAtTime(pan2, t + d);
  p.connect(dest); return p;
}
function osc(/** @type {BaseAudioContext} */ c, f, t, fin, type = 'sine') {
  const o = c.createOscillator(); o.type = /** @type {OscillatorType} */ (type); o.frequency.setValueAtTime(f, t); o.start(t); o.stop(fin); return o;
}

/**
 * Une voix, jouée à l'instant t vers dest.
 * @param {BaseAudioContext} c @param {AudioNode} dest @param {Voix} v @param {number} t
 */
function voix(c, dest, v, t) {
  const d = v.d, fin = t + d + 0.12, out = panneau(c, dest, t, d, v.pan || 0, v.pan2 ?? (v.pan || 0));
  if (v.k === 'tick') {
    const n = c.createBufferSource(); n.buffer = bruit(c);
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = v.q || 1.4; bp.frequency.value = v.f * (0.97 + Math.random() * 0.06);
    const e = enveloppe(c, t, 0.001, d, v.g * (0.92 + Math.random() * 0.08));
    n.connect(bp); bp.connect(e); e.connect(out); n.start(t, Math.random() * 0.8); n.stop(fin);
  } else if (v.k === 'tone') {
    const o = osc(c, v.f, t, fin, v.type || 'sine'); if (v.f2) o.frequency.exponentialRampToValueAtTime(v.f2, t + d);
    const e = enveloppe(c, t, v.a ?? 0.003, d, v.g);
    if (v.q) { const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = v.q; bp.frequency.value = v.f; o.connect(bp); bp.connect(e); } else o.connect(e);
    e.connect(out);
  } else if (v.k === 'bell') {
    const ratio = v.ratio || 2, idx = v.idx ?? 0.6;
    const car = osc(c, v.f, t, fin), mod = osc(c, v.f * ratio, t, fin);
    const mg = c.createGain(); mg.gain.setValueAtTime(v.f * ratio * idx, t); mg.gain.setTargetAtTime(0, t, d / 6);
    mod.connect(mg); mg.connect(car.frequency);
    const e = enveloppe(c, t, v.a ?? 0.002, d, v.g); car.connect(e); e.connect(out);
  } else if (v.k === 'pluck') {
    // le bois : la fondamentale, puis les partiels à 4 et 10 fois qui s'éteignent bien plus vite
    [[1, 1, 1], [4, 0.35, 0.25], [10, 0.1, 0.08]].forEach(([m, gg, dd]) => {
      const o = osc(c, v.f * m, t, fin); const e = enveloppe(c, t, 0.001, d * dd, v.g * gg); o.connect(e); e.connect(out);
    });
  } else if (v.k === 'air') {
    const n = c.createBufferSource(); n.buffer = bruit(c); n.loop = true;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = v.q || 0.9;
    bp.frequency.setValueAtTime(v.f, t); bp.frequency.exponentialRampToValueAtTime(v.f2 || v.f, t + d);
    const a = Math.max(0.005, (v.a ?? 0.5) * d);
    const e = c.createGain(); e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(v.g, t + a); e.gain.linearRampToValueAtTime(0, t + d);
    n.connect(bp); bp.connect(e); e.connect(out); n.start(t, Math.random() * 0.5); n.stop(fin);
  } else if (v.k === 'thump') {
    const o = osc(c, v.f, t, fin); o.frequency.exponentialRampToValueAtTime(v.f2 || v.f, t + d * 0.6);
    const e = enveloppe(c, t, 0.002, d, v.g); o.connect(e); e.connect(out);
  }
}

/**
 * Joue une recette dans une chaîne, à l'instant t.
 * @param {BaseAudioContext} c @param {Chaine} ch @param {Recette} r @param {number} t
 */
export function jouerRecette(c, ch, r, t) {
  const entree = c.createGain(); entree.connect(ch.bus);
  if (r.rev) { const s = c.createGain(); s.gain.value = r.rev; entree.connect(s); s.connect(ch.envoi); }
  for (const v of r.voix) voix(c, entree, v, t + (v.t0 || 0));
}

/**
 * Joue un bruitage. Un même son n'est pas rejoué avant sa pause (60 ms par défaut : clic + clavier).
 * @param {string} name
 * @param {{ pan?: number, recette?: Recette }} [o] pan : décale tout le son à gauche ou à droite
 */
export function sfx(name, o = {}) {
  const r0 = o.recette || RECETTES[name];
  if (!JEU.sfx || !r0) return;
  if (typeof document !== 'undefined' && document.hidden) return;
  const ctx = ctxNow(); if (!ctx || !FX.ch) return;
  const now = performance.now(); if (now - (FX.last[name] || 0) < (r0.pause || 60)) return; FX.last[name] = now;
  const r = o.pan ? { ...r0, voix: r0.voix.map((v) => ({ ...v, pan: Math.max(-1, Math.min(1, (v.pan || 0) + /** @type {number} */ (o.pan))) })) } : r0;
  try { jouerRecette(ctx, FX.ch, r, ctx.currentTime + 0.005); FX.joues++; FX.dernier = name; } catch (e) { /* un son manqué n'a aucune importance */ }
}
export const sfxNames = () => Object.keys(RECETTES);
/** le dernier bruitage joué et leur nombre (tests de bout en bout) */
export const sfxEtat = () => ({ dernier: FX.dernier, joues: FX.joues, etat: FX.ctx ? FX.ctx.state : 'aucun' });

/**
 * Rend un bruitage hors ligne (OfflineAudioContext) : crête, énergie, durée. Pour les tests de bout
 * en bout et la planche d'écoute (tests/e2e/sons.mjs).
 * @param {string} name
 * @returns {Promise<{ name: string, peak: number, rms: number, duree: number, buffer: AudioBuffer } | null>}
 */
export async function rendre(name) {
  const r = RECETTES[name]; if (!r) return null;
  const OAC = window.OfflineAudioContext || /** @type {any} */ (window).webkitOfflineAudioContext; if (!OAC) return null;
  const sr = 44100, duree = dureeDe(r) + 1.3; // la queue de la réverbération
  const c = new OAC(2, Math.ceil(sr * duree), sr);
  jouerRecette(c, chaine(c, c.destination, 1), r, 0.01);
  const buffer = await c.startRendering();
  let peak = 0, sum = 0, n = 0;
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) { const d = buffer.getChannelData(ch); for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > peak) peak = a; sum += d[i] * d[i]; n++; } }
  return { name, peak, rms: Math.sqrt(sum / Math.max(1, n)), duree, buffer };
}

// ---------------- accroches : gestes et événements du simulateur ----------------
// le son d'un clic dépend de ce qu'on touche : du plus précis au plus général
const CLICS = /** @type {[string, string][]} */ ([
  ['.tel-app', 'tap'], ['.tel-tog', 'toggle'],
  ['.tab, [role="tab"], .tel-tab', 'tab'],
  ['.seg button, input[type="checkbox"], [role="switch"]', 'toggle'],
  ['.lx, .jo-mode, .pa-cat, .co-exo', 'select'],
  ['summary', 'fold'],
  ['.btn.primary, .ti-key.primary, .tbtn.primary', 'press'],
  ['button, [role="button"], .ti-key, .tbtn, a[href]', 'ui'],
]);
const SURVOL = '.ti-key, .mn-key, .jo-mode, .lx, .onair-key, .qj-row, .tel-app, .pa-cat';
// un interrupteur qui s'allume ou s'éteint : la valeur de la touche le dit (1, on, activé…) ; sinon son état
// aria, lu AVANT que la page le bascule (on écoute le clic à la capture) : il va donc changer de sens
const ETEINT = /^(0|off|non|coupée?s?|masquée?s?|faux|false)$/i;
const allume = (/** @type {HTMLElement} */ b) => {
  if (b instanceof HTMLInputElement) return b.checked;
  const v = (b.dataset.v || '').trim();
  if (v) return !ETEINT.test(v);
  for (const a of ['aria-pressed', 'aria-checked']) if (b.hasAttribute(a)) return b.getAttribute(a) !== 'true';
  return !ETEINT.test((b.textContent || '').trim());
};
const panX = (/** @type {number} */ x) => (typeof x === 'number' && window.innerWidth ? ((x / window.innerWidth) * 2 - 1) * 0.35 : 0);

export function installSfx() {
  // le contexte se crée au premier geste (clavier ou pointeur), pour que le premier son parte à l'heure
  const wake = () => { ctxNow(); };
  window.addEventListener('pointerdown', wake, { capture: true, passive: true });
  window.addEventListener('keydown', wake, { capture: true });
  document.addEventListener('click', (e) => {
    const t = /** @type {HTMLElement} */ (e.target); if (!t || !t.closest) return;
    if (t.closest('#commut, .mixer-keys')) return; // les touches du mélangeur ont leur propre relais (tally)
    for (const [sel, nom] of CLICS) {
      const b = /** @type {HTMLElement | null} */ (t.closest(sel)); if (!b) continue;
      if (/** @type {any} */ (b).disabled || b.getAttribute('aria-disabled') === 'true') return;
      const pan = e.detail ? panX(e.clientX) : 0;
      sfx(nom === 'toggle' ? (allume(b) ? 'toggleOn' : 'toggleOff') : nom, { pan });
      return;
    }
  }, true);
  let hovered = /** @type {Element | null} */ (null), pointe = 0;
  document.addEventListener('pointerover', (e) => {
    const t = /** @type {HTMLElement} */ (e.target); if (!t || !t.closest || e.pointerType === 'touch') return;
    pointe = performance.now();
    const h = t.closest(SURVOL); if (!h || h === hovered) { if (!h) hovered = null; return; }
    hovered = h; sfx('hover', { pan: panX(e.clientX) });
  }, true);
  // au clavier (flèches, Tab) dans un menu : le même petit son que le survol
  document.addEventListener('focusin', (e) => {
    const t = /** @type {HTMLElement} */ (e.target); if (!t || !t.closest || performance.now() - pointe < 400) return;
    const h = t.closest(SURVOL); if (h && h !== hovered) { hovered = h; sfx('hover'); }
  }, true);
  // les curseurs (volumes) : un cran sonore, plus aigu vers le haut
  let cran = 0;
  document.addEventListener('input', (e) => {
    const r = /** @type {HTMLInputElement} */ (e.target);
    if (!(r instanceof HTMLInputElement) || r.type !== 'range' || performance.now() - cran < 45) return;
    cran = performance.now();
    const min = +r.min || 0, max = +r.max || 100;
    sfx('curseur', { recette: recetteCurseur((+r.value - min) / Math.max(1e-9, max - min)) });
  }, true);

  on('modalopen', () => sfx('open')); on('modalclose', () => sfx('close'));
  on('layeropen', () => sfx('layer')); on('layerclose', () => sfx('close'));
  on('station', () => sfx('poste')); on('stationClose', () => sfx('close'));
  on('toast', (k) => { if (k === 'good') sfx('confirm'); else if (k === 'bad') sfx('error'); else sfx('notify'); });
  on('intercom', () => sfx('intercom'));
  on('mixer', (e) => { if (e && (e.type === 'cut' || e.type === 'transition')) sfx('tally'); });
  on('tutor', (e) => {
    if (!e) return;
    if (e.type === 'done') sfx('step'); else if (e.type === 'finish') sfx('mission');
    else if (e.type === 'answer') sfx(e.ok ? 'quizok' : 'error');
    else if (e.type === 'start' || e.type === 'step') sfx('dialog');
  });
  on('mission', () => sfx('mission'));
  on('missionCar', (e) => { if (e && e.type === 'tache') sfx('check'); else if (e && e.type === 'fini') sfx('mission'); });
  on('niveau', () => sfx('unlock'));
  on('faultNew', () => sfx('alarm')); on('faultSolved', () => sfx('confirm'));
  on('teleport', () => sfx('whoosh'));
  on('installed', () => sfx('place'));
  on('started', () => sfx('launch'));
  on('emission', (e) => { if (e && e.type === 'segment' && e.id === 'generique') sfx('onair'); else if (e && e.type === 'segment' && e.id === 'fin') sfx('offair'); });
  on('xp', (e) => { if (e && e.leveled) sfx('levelup'); else sfx('xp'); });
  on('badge', () => sfx('badge'));
  on('quiz', (e) => { if (e && e.score === e.total) sfx('mission'); });
}

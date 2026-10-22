// @ts-check
import { on } from '../state.js';

// ----------------------------------------------------------------------------------
// Bruitages de l'interface, synthétisés en WebAudio (aucun fichier : la page reste un seul
// fichier, comme la console son). Un petit vocabulaire sonore, le même partout :
//   ui        clic d'une touche                 open / close   une fenêtre, un poste
//   confirm   une action réussie                error          refus, mauvaise réponse
//   step      une étape de l'exercice validée    mission        une mission ou un exercice réussi
//   xp        des points gagnés                 levelup        un niveau de plus (fanfare)
//   badge     un badge décroché                 alarm          une panne injectée
//   tally     relais de commutation (CUT)        intercom       un ordre à l'intercom
//   whoosh    un déplacement, une carte-titre    hover          survol d'une touche du menu
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

const FX = { ctx: /** @type {AudioContext | null} */ (null), master: /** @type {GainNode | null} */ (null), last: {}, noise: /** @type {AudioBuffer | null} */ (null) };
function ctxNow() {
  if (FX.ctx) { if (FX.ctx.state === 'suspended') FX.ctx.resume().catch(() => {}); return FX.ctx; }
  const AC = window.AudioContext || /** @type {any} */ (window).webkitAudioContext; if (!AC) return null;
  try { FX.ctx = new AC(); } catch (e) { return null; }
  FX.master = FX.ctx.createGain(); FX.master.gain.value = JEU.volume; FX.master.connect(FX.ctx.destination);
  return FX.ctx;
}
/** le volume des bruitages (0 à 1) */
export function setSfxVolume(v) { JEU.volume = Math.max(0, Math.min(1, v)); if (FX.master) FX.master.gain.value = JEU.volume; saveJeu(); }
function noise(ctx) {
  if (FX.noise) return FX.noise;
  const len = Math.round(ctx.sampleRate * 0.25); const b = ctx.createBuffer(1, len, ctx.sampleRate); const d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return (FX.noise = b);
}
// une note : oscillateur, enveloppe (attaque, chute), volume, délai
function tone(ctx, out, { f = 440, f2 = 0, type = 'sine', t0 = 0, a = 0.005, d = 0.18, g = 0.2, q = 0 }) {
  const t = ctx.currentTime + t0;
  const o = ctx.createOscillator(); o.type = /** @type {OscillatorType} */ (type); o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
  const e = ctx.createGain(); e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(g, t + a); e.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  let node = /** @type {AudioNode} */ (o);
  if (q) { const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = q; bp.frequency.value = f; o.connect(bp); node = bp; }
  node.connect(e); e.connect(out); o.start(t); o.stop(t + a + d + 0.05);
}
// un souffle filtré : clic de touche, relais, whoosh
function hiss(ctx, out, { f = 2000, f2 = 0, t0 = 0, d = 0.04, g = 0.15, q = 1.2 }) {
  const t = ctx.currentTime + t0;
  const n = ctx.createBufferSource(); n.buffer = noise(ctx);
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = q; bp.frequency.setValueAtTime(f, t); if (f2) bp.frequency.exponentialRampToValueAtTime(f2, t + d);
  const e = ctx.createGain(); e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(g, t + 0.004); e.gain.exponentialRampToValueAtTime(0.0001, t + d);
  n.connect(bp); bp.connect(e); e.connect(out); n.start(t); n.stop(t + d + 0.05);
}
const C5 = 523.25, E5 = 659.25, G5 = 783.99, C6 = 1046.5, E6 = 1318.5, G6 = 1567.98, A5 = 880, D6 = 1174.66;
/** @type {Record<string, (ctx: AudioContext, out: GainNode) => void>} */
const SOUNDS = {
  ui: (c, o) => { hiss(c, o, { f: 2600, d: 0.03, g: 0.12 }); tone(c, o, { f: 1800, type: 'triangle', d: 0.03, g: 0.05 }); },
  hover: (c, o) => hiss(c, o, { f: 3600, d: 0.02, g: 0.04, q: 3 }),
  open: (c, o) => { tone(c, o, { f: 520, f2: 880, type: 'triangle', d: 0.09, g: 0.08 }); hiss(c, o, { f: 1200, f2: 4000, d: 0.12, g: 0.06 }); },
  close: (c, o) => { tone(c, o, { f: 760, f2: 420, type: 'triangle', d: 0.09, g: 0.07 }); hiss(c, o, { f: 3000, f2: 900, d: 0.1, g: 0.05 }); },
  confirm: (c, o) => { tone(c, o, { f: C6, type: 'sine', d: 0.14, g: 0.14 }); tone(c, o, { f: E6, t0: 0.07, d: 0.22, g: 0.12 }); },
  error: (c, o) => { tone(c, o, { f: 220, type: 'square', d: 0.12, g: 0.06 }); tone(c, o, { f: 196, type: 'square', t0: 0.13, d: 0.16, g: 0.06 }); },
  step: (c, o) => { tone(c, o, { f: G5, d: 0.1, g: 0.12 }); tone(c, o, { f: C6, t0: 0.08, d: 0.26, g: 0.14 }); },
  mission: (c, o) => { [C5, E5, G5, C6].forEach((f, i) => tone(c, o, { f, t0: i * 0.09, d: 0.3, g: 0.14 })); tone(c, o, { f: C6 * 2, t0: 0.36, type: 'triangle', d: 0.5, g: 0.05 }); },
  xp: (c, o) => { tone(c, o, { f: E6, type: 'triangle', d: 0.06, g: 0.07 }); tone(c, o, { f: G6, t0: 0.05, type: 'triangle', d: 0.1, g: 0.06 }); },
  levelup: (c, o) => { [C5, E5, G5, C6, E6, G6].forEach((f, i) => tone(c, o, { f, t0: i * 0.1, d: 0.35, g: 0.13 })); [C6, E6, G6].forEach((f, i) => tone(c, o, { f, t0: 0.65 + i * 0.02, type: 'triangle', d: 1.1, g: 0.08 })); },
  badge: (c, o) => { tone(c, o, { f: A5, d: 0.5, g: 0.1 }); tone(c, o, { f: D6, t0: 0.12, d: 0.6, g: 0.1 }); tone(c, o, { f: A5 * 2, t0: 0.24, type: 'triangle', d: 0.9, g: 0.05 }); },
  alarm: (c, o) => { for (let i = 0; i < 3; i++) { tone(c, o, { f: 880, type: 'square', t0: i * 0.22, d: 0.09, g: 0.05 }); tone(c, o, { f: 660, type: 'square', t0: i * 0.22 + 0.1, d: 0.09, g: 0.05 }); } },
  tally: (c, o) => { hiss(c, o, { f: 1500, d: 0.02, g: 0.14, q: 2 }); tone(c, o, { f: 140, type: 'square', d: 0.02, g: 0.05 }); },
  intercom: (c, o) => { tone(c, o, { f: 1000, type: 'sine', d: 0.06, g: 0.07, q: 4 }); tone(c, o, { f: 1250, type: 'sine', t0: 0.08, d: 0.08, g: 0.07, q: 4 }); },
  whoosh: (c, o) => hiss(c, o, { f: 300, f2: 2400, d: 0.45, g: 0.12, q: 0.8 }),
  quizok: (c, o) => { tone(c, o, { f: G5, d: 0.08, g: 0.1 }); tone(c, o, { f: C6, t0: 0.06, d: 0.12, g: 0.1 }); tone(c, o, { f: E6, t0: 0.12, d: 0.3, g: 0.1 }); },
};
/**
 * Joue un bruitage. Un même son n'est pas rejoué deux fois en moins de 60 ms (clic + clavier).
 * @param {keyof typeof SOUNDS} name
 */
export function sfx(name) {
  if (!JEU.sfx || !SOUNDS[name]) return;
  const ctx = ctxNow(); if (!ctx || !FX.master) return;
  const now = performance.now(); if (now - (FX.last[name] || 0) < 60) return; FX.last[name] = now;
  try { SOUNDS[name](ctx, FX.master); } catch (e) { /* un son manqué n'a aucune importance */ }
}
export const sfxNames = () => Object.keys(SOUNDS);

// ---------------- accroches : clics et événements du simulateur ----------------
const CLICKY = 'button, [role="button"], .tab, .lx, .jo-mode, .ti-key, .dkey, .tbtn, .seg button, summary';
const HOVERY = '.ti-key, .mn-key, .jo-mode, .lx, .onair-key, .qj-row';
export function installSfx() {
  // le contexte se crée au premier geste (clavier ou pointeur), pour que le premier son parte à l'heure
  const wake = () => { ctxNow(); };
  window.addEventListener('pointerdown', wake, { capture: true, passive: true });
  window.addEventListener('keydown', wake, { capture: true });
  document.addEventListener('click', (e) => {
    const t = /** @type {HTMLElement} */ (e.target); if (!t || !t.closest) return;
    const b = t.closest(CLICKY); if (!b || /** @type {any} */ (b).disabled) return;
    if (b.closest('#commut, .mixer-keys')) return; // les touches du mélangeur ont leur propre relais (tally)
    sfx('ui');
  }, true);
  let hovered = null;
  document.addEventListener('pointerover', (e) => {
    const t = /** @type {HTMLElement} */ (e.target); if (!t || !t.closest || e.pointerType === 'touch') return;
    const h = t.closest(HOVERY); if (!h || h === hovered) { if (!h) hovered = null; return; }
    hovered = h; sfx('hover');
  }, true);
  on('modalopen', () => sfx('open')); on('modalclose', () => sfx('close'));
  on('station', () => sfx('open')); on('stationClose', () => sfx('close'));
  on('layeropen', () => sfx('open')); on('layerclose', () => sfx('close'));
  on('toast', (k) => { if (k === 'good') sfx('confirm'); else if (k === 'bad') sfx('error'); });
  on('intercom', () => sfx('intercom'));
  on('mixer', (e) => { if (e && (e.type === 'cut' || e.type === 'transition')) sfx('tally'); });
  on('tutor', (e) => { if (!e) return; if (e.type === 'done') sfx('step'); else if (e.type === 'finish') sfx('mission'); else if (e.type === 'answer') sfx(e.ok ? 'quizok' : 'error'); });
  on('mission', () => sfx('mission'));
  on('faultNew', () => sfx('alarm')); on('faultSolved', () => sfx('confirm'));
  on('teleport', () => sfx('whoosh'));
  on('xp', (e) => { if (e && e.leveled) sfx('levelup'); else sfx('xp'); });
  on('badge', () => sfx('badge'));
  on('quiz', (e) => { if (e && e.score === e.total) sfx('mission'); });
}

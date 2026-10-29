// @ts-check
// ----------------------------------------------------------------------------------
// Les recettes des bruitages de l'interface (calcul pur, sans WebAudio : testées par
// tests/unit/sons.test.mjs ; jouées par src/game/sfx.js). Une recette est une liste de voix
// courtes, mêlées puis envoyées dans une chaîne de sortie commune (réverbération courte,
// compresseur) : le même grain partout, comme l'habillage sonore d'une chaîne.
//
// Les règles de la palette, celles d'une interface professionnelle plutôt que d'un jeu d'arcade :
//   - pas d'onde carrée ni en dents de scie : des sinus, des cloches en synthèse FM (verre, métal
//     doux), des « bois » (marimba) et des souffles filtrés ;
//   - les notes tenues sont prises dans une seule gamme, ré majeur pentatonique (ré, mi, fa#, la,
//     si) : deux sons qui se suivent ne jurent jamais ;
//   - court et discret : un clic dure moins de 60 ms, une touche qui sonne (la principale, une application,
//     une carte) moins de 0,35 s, bien en dessous d'une notification ; seules les grandes réussites
//     (mission, niveau, badge, lancement, top antenne) s'autorisent une queue.
//
// Les voix (k) :
//   tick   un clic : bruit très court dans un filtre passe-bande (f, q)
//   tone   une note pure ou triangle, glissando possible (f → f2), filtre passe-bande facultatif (q)
//   bell   une cloche en synthèse FM : porteuse f, modulante f × ratio, indice idx qui s'éteint
//   pluck  un bois (marimba) : fondamentale et deux partiels aigus qui s'éteignent vite
//   air    un souffle : bruit dans un passe-bande qui glisse de f à f2, attaque a (part de d),
//          panoramique qui peut voyager de pan à pan2
//   thump  un corps grave : sinus qui tombe de f à f2 (une porte, un pas, un contact)
// Champs communs : t0 départ (s), d durée (s), g niveau crête (0 à 1), pan (−1 gauche, +1 droite).
// ----------------------------------------------------------------------------------

/** les notes de la gamme (Hz, la 440) */
export const N = Object.freeze({
  D3: 146.83, A3: 220, D4: 293.66, Fs4: 369.99, A4: 440, B4: 493.88,
  D5: 587.33, E5: 659.26, Fs5: 739.99, A5: 880, B5: 987.77,
  D6: 1174.66, E6: 1318.51, Fs6: 1479.98, A6: 1760, B6: 1975.53,
  D7: 2349.32, E7: 2637.02, Fs7: 2959.96, A7: 3520,
});
/** les classes de hauteur de ré majeur pentatonique (demi-tons au-dessus de do) */
export const GAMME = Object.freeze([2, 4, 6, 9, 11]);

/**
 * @typedef {object} Voix
 * @property {'tick' | 'tone' | 'bell' | 'pluck' | 'air' | 'thump'} k
 * @property {number} f fréquence (Hz) ; pour air et thump, le départ du glissement
 * @property {number} [f2] fréquence d'arrivée (tone, air, thump)
 * @property {number} [t0] départ (s)
 * @property {number} d durée (s)
 * @property {number} g niveau crête (0 à 1)
 * @property {number} [a] attaque : en secondes (tone, bell), en part de d (air)
 * @property {number} [q] facteur de qualité du filtre (tick, tone, air)
 * @property {number} [ratio] rapport modulante / porteuse (bell)
 * @property {number} [idx] indice de modulation (bell)
 * @property {'sine' | 'triangle'} [type] forme d'onde (tone)
 * @property {number} [pan] panoramique (−1 à 1)
 * @property {number} [pan2] panoramique d'arrivée (air)
 */
/** @typedef {{ voix: Voix[], rev: number, pause?: number }} Recette */

// raccourcis d'écriture
const tick = (f, d, g, o = {}) => /** @type {Voix} */ ({ k: 'tick', f, d, g, q: 1.4, ...o });
const bell = (f, d, g, o = {}) => /** @type {Voix} */ ({ k: 'bell', f, d, g, ratio: 2, idx: 0.6, ...o });
const glass = (f, d, g, o = {}) => bell(f, d, g, { ratio: 3.5, idx: 0.4, ...o });
const pluck = (f, d, g, o = {}) => /** @type {Voix} */ ({ k: 'pluck', f, d, g, ...o });
const air = (f, f2, d, g, o = {}) => /** @type {Voix} */ ({ k: 'air', f, f2, d, g, a: 0.5, q: 0.9, ...o });
const thump = (f, f2, d, g, o = {}) => /** @type {Voix} */ ({ k: 'thump', f, f2, d, g, ...o });
const tone = (f, d, g, o = {}) => /** @type {Voix} */ ({ k: 'tone', f, d, g, type: 'sine', ...o });

/** @type {Record<string, Recette>} */
export const RECETTES = {
  // ---- les gestes : touches, survol, onglets, interrupteurs ----
  ui: { voix: [tick(3200, 0.016, 0.09), tone(1700, 0.03, 0.022, { f2: 1400 })], rev: 0.04 },
  hover: { voix: [tick(5200, 0.01, 0.024, { q: 2.5 })], rev: 0 },
  press: { voix: [tick(2600, 0.02, 0.1), bell(N.D6, 0.14, 0.045, { t0: 0.004 })], rev: 0.1 },
  tap: { voix: [tick(4600, 0.01, 0.07, { q: 2 }), glass(N.A6, 0.09, 0.03, { idx: 0.35 })], rev: 0.08 },
  tab: { voix: [tick(2100, 0.02, 0.07), thump(640, 460, 0.045, 0.035)], rev: 0.03 },
  toggleOn: { voix: [tick(2300, 0.012, 0.08), tick(3600, 0.012, 0.08, { t0: 0.035 })], rev: 0.03 },
  toggleOff: { voix: [tick(3600, 0.012, 0.08), tick(2100, 0.012, 0.07, { t0: 0.035 })], rev: 0.03 },
  select: { voix: [pluck(N.Fs5, 0.3, 0.07), tick(3000, 0.012, 0.05)], rev: 0.1 },
  fold: { voix: [tick(1700, 0.014, 0.06), air(900, 1800, 0.08, 0.025, { a: 0.3 })], rev: 0.03 },
  // ---- les fenêtres : s'ouvrir, se fermer, le Cours en plein écran, s'asseoir à un poste ----
  open: { voix: [air(500, 3200, 0.2, 0.05), bell(N.A5, 0.3, 0.035, { t0: 0.05, idx: 0.4 })], rev: 0.15 },
  close: { voix: [air(3000, 500, 0.16, 0.04, { a: 0.2 }), thump(300, 190, 0.07, 0.04, { t0: 0.04 })], rev: 0.08 },
  layer: { voix: [air(300, 3800, 0.32, 0.06, { a: 0.6 }), bell(N.D5, 0.5, 0.035, { t0: 0.12, idx: 0.35 }), bell(N.A5, 0.5, 0.03, { t0: 0.16, idx: 0.35 })], rev: 0.2 },
  poste: { voix: [thump(190, 120, 0.09, 0.06), air(700, 2600, 0.18, 0.035, { t0: 0.02, a: 0.4 }), bell(N.A5, 0.3, 0.03, { t0: 0.1, idx: 0.3 })], rev: 0.12 },
  // ---- le téléphone, tenu à droite ----
  telUp: { voix: [air(900, 2800, 0.22, 0.05, { a: 0.6, pan: 0.35 }), thump(150, 95, 0.035, 0.07, { t0: 0.17, pan: 0.35 }),
    glass(N.D6, 0.35, 0.03, { t0: 0.2, idx: 0.45, pan: 0.35 }), glass(N.A6, 0.4, 0.022, { t0: 0.23, idx: 0.3, pan: 0.35 })], rev: 0.12 },
  telDown: { voix: [air(2600, 700, 0.2, 0.045, { a: 0.3, pan: 0.35 }), tick(1900, 0.012, 0.07, { t0: 0.15, pan: 0.35 }), thump(130, 90, 0.03, 0.05, { t0: 0.155, pan: 0.35 })], rev: 0.05 },
  // ---- ce que dit le simulateur : réussite, refus, information, Olivier ----
  confirm: { voix: [bell(N.A5, 0.45, 0.06, { idx: 0.8 }), bell(N.D6, 0.6, 0.06, { t0: 0.075, idx: 0.8 })], rev: 0.18 },
  notify: { voix: [glass(N.Fs6, 0.45, 0.035, { idx: 0.7 }), glass(N.A6, 0.4, 0.02, { t0: 0.09 })], rev: 0.2, pause: 400 },
  error: { voix: [pluck(N.Fs4, 0.2, 0.06), pluck(N.D4, 0.28, 0.06, { t0: 0.11 }), thump(150, 110, 0.06, 0.025)], rev: 0.06 },
  dialog: { voix: [tick(3800, 0.008, 0.03), bell(N.B5, 0.14, 0.03, { t0: 0.005, idx: 0.5 })], rev: 0.1, pause: 250 },
  // ---- les exercices et la progression ----
  step: { voix: [pluck(N.A5, 0.25, 0.055), pluck(N.D6, 0.35, 0.06, { t0: 0.07 })], rev: 0.12 },
  check: { voix: [tick(3000, 0.01, 0.05), pluck(N.D6, 0.3, 0.06, { t0: 0.01 }), glass(N.A6, 0.3, 0.015, { t0: 0.02, idx: 0.3 })], rev: 0.12 },
  quizok: { voix: [pluck(N.A5, 0.2, 0.05), pluck(N.D6, 0.22, 0.05, { t0: 0.055 }), pluck(N.Fs6, 0.4, 0.055, { t0: 0.11 })], rev: 0.15 },
  xp: { voix: [glass(N.E7, 0.08, 0.032, { idx: 0.25, pan: 0.2 }), glass(N.A7, 0.12, 0.026, { t0: 0.04, idx: 0.25, pan: 0.25 })], rev: 0.15 },
  mission: { voix: [air(300, 4000, 0.5, 0.04, { a: 0.7 }),
    bell(N.D5, 0.9, 0.05, { t0: 0.05 }), bell(N.Fs5, 0.9, 0.05, { t0: 0.12 }), bell(N.A5, 0.9, 0.05, { t0: 0.19 }), bell(N.D6, 1.2, 0.055, { t0: 0.26 }),
    glass(N.Fs7, 0.6, 0.015, { t0: 0.38, idx: 0.3, pan: -0.4 }), glass(N.A6, 0.6, 0.015, { t0: 0.44, idx: 0.3, pan: 0.4 })], rev: 0.28 },
  unlock: { voix: [bell(N.A5, 0.5, 0.05), bell(N.E6, 0.7, 0.05, { t0: 0.09 }), air(600, 3500, 0.35, 0.03, { a: 0.6 })], rev: 0.22 },
  badge: { voix: [bell(N.D6, 1.1, 0.045, { t0: 0.05 }), air(2000, 6000, 0.5, 0.02, { a: 0.4 }),
    glass(N.B6, 0.7, 0.025, { idx: 0.5, pan: -0.3 }), glass(N.Fs6, 0.7, 0.025, { t0: 0.06, idx: 0.5, pan: 0.3 }),
    glass(N.D7, 0.7, 0.02, { t0: 0.12, idx: 0.5, pan: -0.1 }), glass(N.A6, 0.7, 0.02, { t0: 0.18, idx: 0.5, pan: 0.15 })], rev: 0.3 },
  levelup: { voix: [thump(110, 55, 0.35, 0.08), air(150, 5000, 0.7, 0.04, { a: 0.75 }),
    bell(N.D4, 1.8, 0.045, { t0: 0.45, idx: 0.5 }), bell(N.A4, 1.8, 0.045, { t0: 0.47, idx: 0.5 }), bell(N.D5, 1.8, 0.045, { t0: 0.49, idx: 0.5 }),
    bell(N.Fs5, 1.8, 0.04, { t0: 0.51, idx: 0.5 }), bell(N.A5, 1.8, 0.04, { t0: 0.53, idx: 0.5 }),
    glass(N.E6, 1.4, 0.025, { t0: 0.6, pan: -0.3 }), glass(N.B6, 1.4, 0.022, { t0: 0.7, pan: 0.3 }),
    glass(N.Fs7, 1.2, 0.012, { t0: 0.82, pan: -0.5 }), glass(N.A7, 1.2, 0.01, { t0: 0.95, pan: 0.5 })], rev: 0.32 },
  // ---- le car : panne, commutation, intercom, déplacement, caméra posée ----
  alarm: { voix: [0, 1, 2].flatMap((i) => [bell(N.B5, 0.1, 0.06, { t0: i * 0.24, ratio: 1, idx: 0.2 }), bell(N.Fs5, 0.1, 0.055, { t0: i * 0.24 + 0.11, ratio: 1, idx: 0.2 })]), rev: 0.08 },
  tally: { voix: [tick(1700, 0.008, 0.12, { q: 1 }), thump(120, 80, 0.02, 0.05), tick(2800, 0.006, 0.06, { t0: 0.028 })], rev: 0.02 },
  intercom: { voix: [tick(2300, 0.008, 0.07), tone(1000, 0.07, 0.04, { q: 5 }), tone(1250, 0.08, 0.04, { t0: 0.085, q: 5 }), tick(1800, 0.008, 0.05, { t0: 0.18 })], rev: 0.05 },
  whoosh: { voix: [air(280, 2600, 0.45, 0.07, { a: 0.55, pan: -0.6, pan2: 0.6 })], rev: 0.15 },
  place: { voix: [thump(220, 140, 0.08, 0.07), tick(1300, 0.012, 0.06)], rev: 0.06 },
  // ---- l'antenne : le lancement d'une partie, le top antenne (bips à 1 kHz), la fin d'antenne ----
  launch: { voix: [thump(90, 45, 0.5, 0.09), air(120, 4000, 0.9, 0.035, { a: 0.8 }),
    bell(N.D4, 1.6, 0.05, { t0: 0.6, idx: 0.5 }), bell(N.A4, 1.6, 0.05, { t0: 0.62, idx: 0.5 }), bell(N.D5, 1.6, 0.05, { t0: 0.64, idx: 0.5 }),
    bell(N.Fs5, 1.6, 0.045, { t0: 0.66, idx: 0.5 }), glass(N.A6, 1, 0.015, { t0: 0.75, idx: 0.3, pan: 0.4 })], rev: 0.3 },
  onair: { voix: [tone(1000, 0.16, 0.07, { a: 0.004 }), tone(1000, 0.16, 0.07, { t0: 0.5, a: 0.004 }), tone(1000, 0.5, 0.07, { t0: 1, a: 0.004 }),
    air(200, 2000, 0.6, 0.03, { t0: 1, a: 0.5 })], rev: 0.1 },
  offair: { voix: [bell(N.A5, 0.6, 0.045, { idx: 0.5 }), bell(N.D5, 0.9, 0.045, { t0: 0.12, idx: 0.5 })], rev: 0.25 },
};

/** le petit clic du curseur de volume, plus aigu quand on monte (v de 0 à 1) */
export function recetteCurseur(v) { return { voix: [tick(1500 + 2500 * Math.max(0, Math.min(1, v)), 0.006, 0.035, { q: 3 })], rev: 0 }; }

/** la durée d'une recette (s), queue comprise */
export function dureeDe(/** @type {Recette} */ r) { return r.voix.reduce((m, v) => Math.max(m, (v.t0 || 0) + v.d), 0); }
/** la note la plus proche d'une fréquence, en demi-tons au-dessus de do (0 à 11) */
export function classeDe(/** @type {number} */ f) { return ((Math.round(12 * Math.log2(f / 440)) + 9) % 12 + 12) % 12; }
/** les voix « tenues » (cloches, bois) : celles qui doivent rester dans la gamme */
export const tenue = (/** @type {Voix} */ v) => v.k === 'bell' || v.k === 'pluck';

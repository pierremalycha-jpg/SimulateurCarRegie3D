// @ts-check
// ----------------------------------------------------------------------------------
// Les bancs de touche (v19.21) : devant la tribune Lepagnot, Lens à gauche (x = −10), l'adversaire à droite
// (x = +10), là où les joueurs rejoignent leur banc à la mi-temps (match.js). Sous chaque abri, neuf sièges baquets :
// sept remplaçants en veste d'échauffement aux couleurs du club, l'entraîneur adjoint et le préparateur physique ;
// l'entraîneur principal se tient debout dans sa zone technique, va et vient, croise les bras, montre le jeu.
// Tout le monde suit le ballon des yeux ; quand son équipe marque, le banc se lève, bras en l'air.
// Les commentateurs de la tribune de presse sont de la même troupe (assis, casque sur les oreilles).
// Calculs purs (places, tenues, poses) : tests/unit/figurants.test.mjs. Les couleurs viennent de TEAMS : le banc
// visiteur change de tenue avec l'adversaire (adversaire.js → peindreBancs).
// ----------------------------------------------------------------------------------

/** les deux bancs : l'équipe et le centre de l'abri */
export const BANCS = [{ team: 0, cx: -10 }, { team: 1, cx: 10 }];
/** l'abri : sièges contre le dos de la coque, zone technique devant (la ligne de touche est à z = −34) */
export const ABRI = { z: -38.95, long: 8, sieges: 9, pas: 0.82, assise: 0.5, zt: { z0: -37.1, z1: -35.4, dx: 3.6 } };
/** les commentateurs : terrasse de la tribune de presse (Lepagnot), face au terrain */
export const COMMENTATEURS = [{ x: 11, y: 11, z: -64.85 }, { x: 12.1, y: 11, z: -64.85 }];

/** position (x, z) du siège k (0 à 8) d'un banc */
export function siege(cx, k) { return { x: cx - (ABRI.sieges - 1) / 2 * ABRI.pas + k * ABRI.pas, z: ABRI.z }; }

const PEAU = [0xf1c6a5, 0xe0ac86, 0xc68a62, 0x9c6b47, 0x7a4e30, 0x5a3a24];
const CHEVEUX = [0x1a1410, 0x0c0c0c, 0x2a1d14, 0x3b2a1a, 0x6b4a2a];
/**
 * Les membres d'un banc, dans l'ordre des places de la troupe : sept remplaçants, l'adjoint, le préparateur (assis
 * sur les sièges 0 à 8, un siège reste libre au bout), l'entraîneur (debout).
 * @typedef {{ role: 'remplacant' | 'adjoint' | 'preparateur' | 'entraineur', siege: number }} Membre
 */
/** @type {Membre[]} */
export const MEMBRES = [
  ...[0, 1, 2, 3, 4, 5, 6].map((k) => /** @type {Membre} */ ({ role: 'remplacant', siege: k + 1 })),
  { role: 'adjoint', siege: 0 }, { role: 'preparateur', siege: 8 }, { role: 'entraineur', siege: -1 },
];
/**
 * La tenue d'un membre du banc d'après les couleurs du club (TEAMS) : veste d'échauffement des remplaçants (manches
 * du maillot, col du maillot), survêtement sombre du staff, costume de l'entraîneur.
 * @param {{ shirt: number, sleeves?: number, shorts: number }} club @param {Membre} m @param {number} k indice (peau, cheveux)
 * @returns {import('./troupe.js').Tenue}
 */
export function tenueBanc(club, m, k) {
  const peau = PEAU[(k * 5 + 1) % 6], cheveux = CHEVEUX[(k * 3) % 5];
  if (m.role === 'remplacant') return { haut: club.sleeves ?? club.shirt, col: club.shirt, manches: club.sleeves ?? club.shirt, bas: club.shorts, peau, cheveux, manchesLongues: true, chaussures: 0x111214 };
  if (m.role === 'entraineur') return { haut: 0x1b1e24, col: 0xf2f2f2, bas: 0x1b1e24, peau, cheveux, manchesLongues: true, chaussures: 0x0c0c0d };
  return { haut: 0x23262d, col: club.sleeves ?? club.shirt, bas: 0x23262d, peau, cheveux, manchesLongues: true, chaussures: 0x111214 };
}

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
/**
 * La pose d'un membre du banc à l'instant t.
 * @param {{ team: number, cx: number }} banc @param {Membre} m @param {number} i indice dans le banc
 * @param {number} t horloge (s) @param {{ x: number, z: number }} ballon @param {boolean} fete son équipe vient de marquer
 * @returns {import('./troupe.js').Pose}
 */
export function poseBanc(banc, m, i, t, ballon, fete) {
  if (m.role === 'entraineur') {
    // va et vient dans la zone technique, s'arrête, montre le jeu, croise les bras
    const z = (ABRI.zt.z0 + ABRI.zt.z1) / 2 + Math.sin(t * 0.21 + banc.team) * 0.5;
    const s = Math.sin(t * 0.16 + banc.team * 2), x = banc.cx + s * (ABRI.zt.dx - 0.6);
    const v = Math.abs(Math.cos(t * 0.16 + banc.team * 2)) * 0.16 * (ABRI.zt.dx - 0.6);
    const marche = v > 0.18;
    const vers = Math.atan2(ballon.x - x, ballon.z - z);
    const yaw = marche ? (Math.cos(t * 0.16 + banc.team * 2) > 0 ? Math.PI / 2 : -Math.PI / 2) : clamp(vers, -1.2, 1.2);
    const geste = fete ? 'leve' : marche ? 'marche' : (t * 0.37 + banc.team * 3) % 9 < 2.5 ? 'pointe' : 'croise';
    return { x, y: 0, z, yaw, vitesse: marche ? v : 0, phase: t * 3.2, bras: /** @type {any} */ (geste), teteYaw: clamp(wrap(vers - yaw), -1.1, 1.1), tetePitch: -0.05, t };
  }
  const p = siege(banc.cx, m.siege);
  const vers = clamp(wrap(Math.atan2(ballon.x - p.x, ballon.z - p.z)), -1.25, 1.25);
  // debout et bras levés quand l'équipe marque (chacun à son rythme), sinon assis : les mains sur les cuisses ou
  // les bras croisés, le buste qui se penche quand le jeu s'approche
  const debout = fete && (t * 1.3 + i * 0.7) % 6 < 5.2;
  const pres = 1 - clamp(Math.hypot(ballon.x - p.x, ballon.z - p.z) / 60, 0, 1);
  return { x: p.x, y: 0, z: p.z, yaw: 0, assis: debout ? 0 : 1, bras: debout ? 'leve' : i % 3 === 1 ? 'croise' : 'ballants', teteYaw: vers, tetePitch: 0.05, penche: debout ? 0 : 0.08 + pres * 0.18, t };
}

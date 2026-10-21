// @ts-check
import { el, clamp } from '../../util.js';
import { MIRE_D, ND, zoomPos, exposureOf, fr } from '../optics.js';
import { makeViewfinder, drawScope, encode, MIRE_WHITE, cnv } from '../vf.js';
import { slider, seg, toggle, btnRow, linkBtn, lensRings, lensState, shell, scopeCanvas, irisN, irisPos, pointPos } from '../controls.js';

// ----------------------------------------------------------------------------------
// Manipulations du chapitre 7 (la voie caméra) : la fibre et ses connecteurs, la CCU, le RCP, la
// référence et le genlock, le signal de sortie, le line-up. Chacune reçoit ctx = { lens(état) } et
// renvoie { node, dispose } (voir ../labs.js). Les calculs sont exportés pour les tests
// (tests/unit/camlab-ch7.test.mjs) et pour les schémas (../figs/ch7.js) :
//   · fibre : la lumière arrêtée par une poussière = intégrale du mode gaussien (diamètre du champ
//     de mode 9,2 µm) sur la poussière ; zone du cœur de 25 µm (IEC 61300-3-35) ;
//   · référence : tri-level (SMPTE ST 274, 44 périodes de 74,25 MHz), black burst (ITU-R BT.1700),
//     ligne de 75 Ω terminée ou ouverte (réflexion +1, 5 ns par mètre) ;
//   · sortie : Y'CbCr BT.709, codes 10 bits (64–940, 512 ± 448), débit = trame totale × 2 mots × 10 bits ;
//   · line-up : deux caméras, même modèle de signal (courbe BT.709, noir ajouté, saturation autour de Y').
// Les commandes portent les noms des modes d'emploi (HXCU-FB80, RCP-1500, HXC-FB80) ; un affichage que
// le mode d'emploi ne donne pas est écrit en français et présenté comme celui de la manipulation.
// ----------------------------------------------------------------------------------

const send = (ctx, s) => { if (ctx && ctx.lens) ctx.lens(s); };
const readout = () => el('p', { class: 'cl-read' });
/** un nombre signé, avec le vrai signe moins */
const sgn = (v, d = 1) => (Math.abs(v) < 0.5 * 10 ** -d ? '0' : (v > 0 ? '+' : '−') + fr(Math.abs(v), d));
const NS = 'http://www.w3.org/2000/svg';
/** un élément SVG */
const mk = (parent, tag, attrs) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v)); parent.append(e); return e; };
/** un élément SVG cliquable au clavier (Entrée, espace) */
function pressable(g, fn) {
  g.addEventListener('click', fn);
  g.addEventListener('keydown', (e) => { const k = /** @type {KeyboardEvent} */ (e).key; if (k === 'Enter' || k === ' ') { e.preventDefault(); fn(); } });
}

// =================================================================================
// Calculs : la fibre
// =================================================================================
/** rayon du mode d'une fibre monomode G.652 à 1310 nm (µm) : diamètre du champ de mode 9,2 µm */
export const MODE_W = 4.6;
/** rayon de la zone du cœur à inspecter (µm) : 25 µm de diamètre (IEC 61300-3-35) */
export const ZONE_A = 12.5;
/** rayon de la gaine (µm) : 125 µm de diamètre */
export const CLAD = 62.5;
/** perte d'une connexion propre (dB) : ordre de grandeur, comme le Cours (camera-systeme) */
export const CONN_DB = 0.5;
/**
 * Part de la lumière arrêtée par des taches posées sur la face d'une fibre. Chaque tache est un disque
 * { x, y, r } (µm, depuis le centre du cœur) qui laisse passer la part t de la lumière (0 : opaque). La
 * lumière du mode est une gaussienne d'intensité 2/(π w²) · exp(−2 r²/w²) : on l'intègre sur chaque disque.
 * @param {{ x: number, y: number, r: number, t?: number }[]} spots
 */
export function blockedFraction(spots, w = MODE_W) {
  let b = 0;
  for (const s of spots) {
    const n = Math.max(24, Math.min(160, Math.ceil(2 * s.r / 0.12))), h = 2 * s.r / n;
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const dx = -s.r + (i + 0.5) * h, x = s.x + dx;
      for (let j = 0; j < n; j++) {
        const dy = -s.r + (j + 0.5) * h;
        if (dx * dx + dy * dy > s.r * s.r) continue;
        const y = s.y + dy;
        sum += Math.exp(-2 * (x * x + y * y) / (w * w));
      }
    }
    b += (1 - (s.t || 0)) * sum * h * h * 2 / (Math.PI * w * w);
  }
  return clamp(b, 0, 1);
}
/** perte (dB) quand une part b de la lumière est arrêtée */
export const lossDb = (b) => (b <= 0 ? 0 : -10 * Math.log10(Math.max(1e-9, 1 - b)));
/** une tache touche-t-elle la zone du cœur ? */
export const inZoneA = (s) => Math.hypot(s.x, s.y) - s.r < ZONE_A;

// =================================================================================
// Calculs : la référence
// =================================================================================
/** demi-impulsion du tri-level 1080i50 (µs) : 44 périodes d'une horloge à 74,25 MHz (SMPTE ST 274) */
export const TRI_HALF = 44 / 74.25;
/** top de synchro du black burst 625 lignes (µs, ITU-R BT.1700) */
export const BB_SYNC = 4.7;
/** salve du black burst : début après le front (µs), périodes, fréquence (MHz), amplitude crête (V) */
export const BB_BURST = { start: 5.6, cycles: 10, f: 4.43361875, amp: 0.15 };
/** propagation dans un coaxial (µs par mètre) : ≈ 5 ns/m */
export const COAX_US_M = 0.005;
/**
 * La référence au temps t (µs), en volts, sur une ligne terminée (le front de synchro à t0, mesuré à
 * mi-hauteur). kind : 'tri' (tri-level, ±300 mV) ou 'bb' (black burst, top à −300 mV et salve ±150 mV).
 */
export function refWave(kind, t, t0 = 1.5) {
  // un front centré en 0, de durée rise
  const edge = (x, rise) => clamp(x / rise + 0.5, 0, 1);
  const a = t - t0;
  if (kind === 'tri') {
    const r = 0.054; // ≈ 4 périodes d'horloge (ordre de grandeur)
    return -0.3 * edge(a, r) + 0.6 * edge(a - TRI_HALF, r) - 0.3 * edge(a - 2 * TRI_HALF, r);
  }
  const r = 0.2;
  let v = -0.3 * (edge(a, r) - edge(a - BB_SYNC, r));
  const b0 = BB_BURST.start, dur = BB_BURST.cycles / BB_BURST.f;
  if (a > b0 - 0.25 && a < b0 + dur + 0.25) {
    const env = clamp((a - b0 + 0.25) / 0.25, 0, 1) * clamp((b0 + dur + 0.25 - a) / 0.25, 0, 1);
    v += BB_BURST.amp * env * Math.sin(2 * Math.PI * BB_BURST.f * (a - b0));
  }
  return v;
}
/**
 * Le signal vu en un point d'une ligne de 75 Ω : l'onde incidente, plus l'onde réfléchie au bout (coefficient
 * gamma : 0 si la ligne est terminée, +1 si elle est ouverte), arrivée avec un retard delay (µs, aller et
 * retour entre ce point et le bout).
 */
export const lineWave = (kind, t, gamma, delay) => refWave(kind, t) + gamma * refWave(kind, t - delay);
/**
 * Amplitude relative au bout d'une ligne : une source de 75 Ω qui donne 1 sur 75 Ω donne 2 × R / (75 + R)
 * sur une charge R. n : nombre de bouchons de 75 Ω en parallèle (0 : ligne ouverte).
 */
export const termGain = (n) => (n <= 0 ? 2 : 2 * (75 / n) / (75 + 75 / n));
/**
 * La boucle de référence : src[k] dit d'où la CCU k reçoit sa référence ('A1', 'A2', 'B1', 'B2' : une sortie
 * du distributeur ; 'L0', 'L1' : la boucle de la CCU 0 ou 1 ; '' : rien) ; term[k] : bouchon sur sa boucle.
 * sig : le signal de chaque sortie du DA. Renvoie pour chaque CCU le signal reçu, le coefficient de
 * réflexion du bout de sa chaîne, sa distance au DA et celle du bout (m).
 * @param {string[]} src @param {boolean[]} term @param {Record<string, string>} sig
 */
export function refChains(src, term, sig) {
  const n = src.length;
  const next = (k) => src.findIndex((s) => s === 'L' + k);
  return src.map((_, k) => {
    // on remonte les boucles jusqu'au distributeur
    let j = k, hops = 0, guard = 0;
    while (src[j] && src[j][0] === 'L' && guard++ < n) { j = Number(src[j].slice(1)); hops++; }
    const root = src[j];
    if (!root || root[0] === 'L') return { sig: null, root: null, gamma: 0, x: 0, L: 0 };
    // et on descend jusqu'au bout de la chaîne
    let e = k, down = 0; guard = 0;
    while (next(e) >= 0 && guard++ < n) { e = next(e); down++; }
    const x = 10 + 0.5 * hops; // 10 m du DA à la baie, 0,5 m par cavalier entre deux CCU
    return { sig: sig[root[0]], root, gamma: term[e] ? 0 : 1, x, L: x + 0.5 * down };
  });
}

// =================================================================================
// Calculs : le signal de sortie
// =================================================================================
/** BT.709 : Y', Cb, Cr (normalisés) d'un point R', G', B' (0 à 1) */
export function ycbcr(r, g, b) {
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return [y, (b - y) / 1.8556, (r - y) / 1.5748];
}
/** codes 10 bits (BT.709, plage vidéo) : Y' = 64 + 876 Y', Cb et Cr = 512 + 896 C, bornés à 4–1019 */
export function codes10(y, cb, cr) {
  const q = (v) => clamp(Math.round(v), 4, 1019);
  return [q(64 + 876 * y), q(512 + 896 * cb), q(512 + 896 * cr)];
}
/** les formats : trame totale (points par ligne, lignes), images par seconde, interface (SMPTE ST 274, ST 296) */
export const FORMATS = {
  '1080i50': { w: 2640, h: 1125, fps: 25, sdi: 'HD-SDI', norme: 'ST 292-1', act: '1 920 × 1 080, deux trames' },
  '720p50': { w: 1980, h: 750, fps: 50, sdi: 'HD-SDI', norme: 'ST 292-1', act: '1 280 × 720' },
  '1080p50': { w: 2640, h: 1125, fps: 50, sdi: '3G-SDI', norme: 'ST 424', act: '1 920 × 1 080' },
};
/** débit série (bit/s) : points par ligne totale × lignes totales × images/s × 2 mots (Y' et C) × 10 bits */
export const sdiRate = (fmt) => { const f = FORMATS[fmt]; return f.w * f.h * f.fps * 2 * 10; };

// =================================================================================
// Calculs : le line-up
// =================================================================================
const oetf709 = (l) => (l < 0.018 ? 4.5 * l : 1.099 * Math.pow(l, 0.45) - 0.099);
/** la charte du line-up : réflectances (lumière linéaire, R, V, B) */
export const CHARTE = {
  board: [0.07, 0.07, 0.07],
  noir: [0, 0, 0], // le trou de velours : rien que le niveau du noir
  gris: [0.18, 0.18, 0.18],
  blanc: [0.9, 0.9, 0.9],
  /** @type {[string, number[]][]} */
  colors: [['R', [0.4, 0.045, 0.045]], ['Yl', [0.45, 0.4, 0.05]], ['G', [0.07, 0.3, 0.07]], ['Cy', [0.06, 0.28, 0.36]], ['B', [0.05, 0.06, 0.34]], ['Mg', [0.36, 0.06, 0.3]]],
};
/**
 * Le signal R', V', B' d'une caméra pour une réflectance : lumière reçue E, gains des voies wb, courbe BT.709,
 * noir ajouté (black, en part du signal), saturation autour de Y', écrêtage de −7 à 109 %.
 * @param {number[]} refl @param {{ E: number, wb: number[], black: number[], sat: number }} c
 */
export function camSignal(refl, c) {
  const v = refl.map((x, i) => oetf709(Math.max(0, x * c.E * c.wb[i])) + c.black[i]);
  const y = 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  return v.map((x) => clamp(y + c.sat * (x - y), -0.07, 1.09));
}
/** Cb, Cr d'un signal R', V', B' */
const cbcr = (v) => { const [, cb, cr] = ycbcr(v[0], v[1], v[2]); return [cb, cr]; };
/** les écarts entre deux caméras : noir, gris, blanc (voie par voie) et couleurs (distance au vecteurscope) */
export function lineupGaps(c1, c2) {
  const diff = (refl) => { const a = camSignal(refl, c1), b = camSignal(refl, c2); return a.map((x, i) => b[i] - x); };
  const col = CHARTE.colors.map(([n, refl]) => { const a = cbcr(camSignal(refl, c1)), b = cbcr(camSignal(refl, c2)); return [n, Math.hypot(b[0] - a[0], b[1] - a[1])]; });
  const worst = col.reduce((m, x) => (x[1] > m[1] ? x : m), col[0]);
  return { noir: diff(CHARTE.noir), gris: diff(CHARTE.gris), blanc: diff(CHARTE.blanc), col: Number(worst[1]), colName: String(worst[0]) };
}

// =================================================================================
// La fibre : inspecter, nettoyer, brancher
// =================================================================================
/** @typedef {{ x: number, y: number, r: number, t?: number, k: 'poussiere' | 'gras' | 'humide' }} Tache */
const FACES = [['cam1', 'Caméra · fibre 1'], ['cam2', 'Caméra · fibre 2'], ['cab1', 'Câble · fibre 1'], ['cab2', 'Câble · fibre 2']];
/** l'état de départ des quatre faces : une poussière sur le cœur, une trace de doigt, des grains près du cœur */
const dirt0 = () => /** @type {Record<string, Tache[]>} */ ({
  cam1: [{ x: 1.4, y: -0.9, r: 2.1, k: 'poussiere' }, { x: 36, y: 22, r: 3.2, k: 'poussiere' }, { x: -24, y: -41, r: 1.6, k: 'poussiere' }],
  cam2: [{ x: -31, y: 14, r: 1.2, k: 'poussiere' }],
  cab1: [{ x: -4, y: 5, r: 17, t: 0.55, k: 'gras' }, { x: 28, y: -30, r: 2.4, k: 'poussiere' }],
  cab2: [{ x: 7.5, y: -3, r: 3.4, k: 'poussiere' }, { x: -9, y: 8, r: 1.1, k: 'poussiere' }, { x: 44, y: 10, r: 2, k: 'poussiere' }],
});
/** un nombre pseudo-aléatoire stable pour dessiner le contour d'une tache */
const hash = (a, b) => { const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return s - Math.floor(s); };

/** la face d'une fibre au microscope : férule, gaine, cœur, taches, zone du cœur */
function drawFace(g, face, title, plugged) {
  const W = 640, H = 360, k = 2.2, cx = W / 2, cy = H / 2 + 6;
  g.fillStyle = '#05070a'; g.fillRect(0, 0, W, H);
  g.font = '600 14px "B612 Mono", monospace'; g.textAlign = 'left'; g.fillStyle = '#e8e8e2';
  if (plugged) {
    g.fillStyle = '#c9cdc5'; g.textAlign = 'center';
    g.fillText('Câble branché : les faces sont l\'une contre l\'autre.', W / 2, H / 2 - 8);
    g.fillText('Débranche pour inspecter.', W / 2, H / 2 + 16);
    return;
  }
  const fe = g.createRadialGradient(cx, cy, CLAD * k, cx, cy, 330);
  fe.addColorStop(0, '#9aa0a6'); fe.addColorStop(1, '#2a2e33');
  g.fillStyle = fe; g.beginPath(); g.arc(cx, cy, 330, 0, Math.PI * 2); g.fill();
  const cl = g.createRadialGradient(cx, cy, 0, cx, cy, CLAD * k);
  cl.addColorStop(0, '#d6dce1'); cl.addColorStop(1, '#b4bbc1');
  g.fillStyle = cl; g.beginPath(); g.arc(cx, cy, CLAD * k, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#6d757c'; g.lineWidth = 2; g.stroke();
  g.fillStyle = '#f4fbff'; g.beginPath(); g.arc(cx, cy, 4.5 * k, 0, Math.PI * 2); g.fill();
  for (const s of face) {
    const X = cx + s.x * k, Y = cy + s.y * k, R = s.r * k;
    if (s.k === 'humide') {
      g.strokeStyle = 'rgba(210,235,255,0.45)'; g.lineWidth = 2.5;
      for (let i = 0; i < 7; i++) { const y = Y - R * 0.8 + i * R * 0.27; g.beginPath(); g.moveTo(X - R * 0.9, y + 6 * hash(i, 1)); g.bezierCurveTo(X - R * 0.3, y - 10, X + R * 0.3, y + 12, X + R * 0.9, y - 6 * hash(i, 2)); g.stroke(); }
      continue;
    }
    g.beginPath();
    const n = 14;
    for (let i = 0; i <= n; i++) {
      const a = i / n * Math.PI * 2, rr = R * (0.75 + 0.4 * hash(s.x + i, s.y - i));
      const px = X + Math.cos(a) * rr, py = Y + Math.sin(a) * rr;
      if (i) g.lineTo(px, py); else g.moveTo(px, py);
    }
    g.closePath();
    g.fillStyle = s.k === 'gras' ? 'rgba(150,120,60,0.42)' : '#1e1b17'; g.fill();
  }
  g.setLineDash([6, 4]); g.strokeStyle = '#ffb020'; g.lineWidth = 1.6; g.beginPath(); g.arc(cx, cy, ZONE_A * k, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
  g.fillStyle = '#e8e8e2'; g.textAlign = 'left'; g.fillText(title, 14, 24);
  g.fillStyle = '#ffb020'; g.font = '600 12px "B612 Mono", monospace'; g.fillText('- - zone du cœur, 25 µm', 14, H - 16);
  // l'échelle : 25 µm
  g.fillStyle = '#e8e8e2'; g.fillRect(W - 14 - 25 * k, H - 24, 25 * k, 3); g.textAlign = 'right'; g.fillText('25 µm', W - 14, H - 30);
}

/** le schéma de la manipulation « La CCU » : les prises de la face arrière */
const CCU_JACKS = [
  { id: 'fibre', nom: 'CAMERA', type: 'prise de la fibre hybride', x: 42, y: 70, kind: 'fibre', lbl: 'CAMERA' },
  { id: 'ac', nom: 'AC IN', type: 'prise secteur', x: 42, y: 152, kind: 'ac', lbl: 'AC IN' },
  { id: 'refin', nom: 'REFERENCE IN', type: 'BNC', x: 104, y: 60, kind: 'bnc', lbl: 'IN' },
  { id: 'refloop', nom: 'REFERENCE (boucle)', type: 'BNC', x: 104, y: 100, kind: 'bnc', lbl: 'boucle' },
  { id: 'prompter', nom: 'PROMPTER IN', type: 'BNC, vidéo analogique', x: 156, y: 60, kind: 'bnc', lbl: 'IN' },
  { id: 'promploop', nom: 'PROMPTER (boucle)', type: 'BNC', x: 156, y: 100, kind: 'bnc', lbl: 'boucle' },
  { id: 'retv1', nom: 'RET VBS 1', type: 'BNC, vidéo analogique', x: 208, y: 60, kind: 'bnc', lbl: '1' },
  { id: 'retv2', nom: 'RET VBS 2', type: 'BNC, vidéo analogique', x: 208, y: 100, kind: 'bnc', lbl: '2' },
  { id: 'rets1', nom: 'RET SDI 1', type: 'BNC, SDI', x: 258, y: 60, kind: 'bnc', lbl: '1' },
  { id: 'rets2', nom: 'RET SDI 2', type: 'BNC, SDI', x: 258, y: 100, kind: 'bnc', lbl: '2' },
  { id: 'icom', nom: 'INTERCOM/TALLY', type: 'D-sub 25 broches', x: 330, y: 66, kind: 'dsub', lbl: 'INTERCOM/TALLY' },
  { id: 'rcp', nom: 'RCP', type: 'rond 8 broches', x: 400, y: 66, kind: 'multi', lbl: 'RCP' },
  ...[1, 2, 3, 4].map((i) => ({ id: 'sdi' + i, nom: 'SDI OUT HD/SD ' + i, type: 'BNC, sortie SDI', x: 98 + (i - 1) * 27, y: 162, kind: 'bnc', lbl: String(i) })),
  ...[1, 2, 3, 4].map((i) => ({ id: 'g' + i, nom: 'SDI OUT 3G/4K/HD ' + i, type: 'BNC, sortie SDI', x: 230 + (i - 1) * 27, y: 162, kind: 'bnc', lbl: String(i) })),
];
/** ce qu'il faut brancher à l'arrière de la CCU : équipement, prises qui conviennent, explication, groupe (défi) */
const CCU_CABLES = [
  { nom: 'La fibre de la caméra (nettoyée)', ok: ['fibre'], why: 'CAMERA : la fibre hybride. Tout ce qui va et vient de la caméra passe par ce seul connecteur.', g: 0 },
  { nom: 'Le cordon secteur', ok: ['ac'], why: 'AC IN : la CCU prend le secteur (100 à 240 V) ; c\'est elle qui alimentera la caméra.', g: 0 },
  { nom: 'Le câble du RCP de la CAM 1', ok: ['rcp'], why: 'La prise du RCP, 8 broches : le pupitre de la vision commande la caméra à travers la CCU.', g: 0 },
  { nom: 'La référence tri-level, du distributeur', ok: ['refin'], why: 'REFERENCE IN : la CCU cale la caméra sur le rythme de la régie (tri-level 0,6 V).', g: 1 },
  { nom: 'Le bouchon de 75 Ω', ok: ['refloop'], why: 'Sur la boucle de REFERENCE : cette CCU est la dernière de la boucle, le bouchon termine la ligne.', g: 1 },
  { nom: 'Le câble vers la grille (image de CAM 1)', ok: ['sdi1', 'sdi2', 'sdi3', 'sdi4', 'g1', 'g2', 'g3', 'g4'], why: 'Une sortie SDI : en 1080i50, du HD-SDI, que les deux cartes savent sortir.', g: 1 },
  { nom: 'Le retour programme, en SDI depuis la grille', ok: ['rets1', 'rets2'], why: 'RET SDI : le programme arrive de la grille en SDI ; le cadreur le voit dans son viseur avec la touche RET.', g: 2 },
  { nom: 'Le prompteur (vidéo analogique)', ok: ['prompter'], why: 'PROMPTER IN : le texte, en vidéo analogique ; la caméra le ressort sur sa prise PROMPTER, vers l\'écran du prompteur.', g: 2 },
  { nom: 'L\'intercom et le tally (matrice, mélangeur)', ok: ['icom'], why: 'La D-sub 25 broches porte l\'intercom, le tally et le son du programme : le casque du cadreur et ses lampes.', g: 2 },
];
/** l'indice d'une mauvaise prise : pourquoi pas celle-là */
function ccuHint(cable, jack) {
  const target = cable.ok[0];
  if (target === 'refin' && jack === 'refloop') return 'c\'est la boucle : elle ressort la référence vers la CCU suivante. L\'arrivée, c\'est REFERENCE IN.';
  if (target === 'refloop' && jack === 'refin') return 'le bouchon termine la ligne au bout de la boucle, pas à l\'entrée : REFERENCE IN reçoit le câble du distributeur.';
  if (target === 'refloop' && jack === 'promploop') return 'la boucle du prompteur n\'est pas celle de la référence : lis l\'inscription au-dessus.';
  if (target === 'rets1' && (jack === 'retv1' || jack === 'retv2')) return 'RET VBS attend de la vidéo analogique ; le retour arrive de la grille en SDI.';
  if (target === 'rets1' && /^(sdi|g)\d/.test(jack)) return 'c\'est une sortie : le retour, lui, entre dans la CCU.';
  if (target === 'sdi1' && /^ret/.test(jack)) return 'c\'est une entrée de retour : l\'image de la caméra sort par SDI OUT.';
  if (target === 'prompter' && jack === 'refin') return 'REFERENCE IN et PROMPTER IN sont deux BNC voisins : lis l\'inscription.';
  if (target === 'refin' && jack === 'prompter') return 'PROMPTER IN reçoit le texte du prompteur, pas la référence.';
  const t = CCU_JACKS.find((p) => p.id === target);
  return `cherche une prise ${t.type}.`;
}

// =================================================================================
// Le genlock : la boucle de référence
// =================================================================================
const DA_SIG = { A: 'bb', B: 'tri' };
const DA_OUTS = ['A1', 'A2', 'B1', 'B2'];
const SIG_NAME = { tri: 'tri-level', bb: 'black burst' };

/** dessine l'oscilloscope : 1 µs et 0,2 V par division, deux curseurs */
function drawRefScope(g, trace, t1, t2, title) {
  const W = 640, H = 250, x0 = 40, y0 = 14, pw = W - x0 - 12, ph = H - y0 - 28;
  const X = (t) => x0 + t / 10 * pw, Y = (v) => y0 + ph / 2 - v / 0.8 * ph / 2;
  g.fillStyle = '#05070a'; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(120,200,160,0.2)'; g.lineWidth = 1; g.font = '600 10px "B612 Mono", monospace'; g.fillStyle = 'rgba(150,210,180,0.7)';
  for (let i = 0; i <= 10; i++) { g.beginPath(); g.moveTo(X(i) + 0.5, y0); g.lineTo(X(i) + 0.5, y0 + ph); g.stroke(); g.textAlign = 'center'; g.fillText(String(i), X(i), H - 12); }
  for (let v = -0.8; v <= 0.81; v += 0.2) { const y = Math.round(Y(v)) + 0.5; g.strokeStyle = Math.abs(v) < 0.01 ? 'rgba(150,210,180,0.45)' : 'rgba(120,200,160,0.2)'; g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + pw, y); g.stroke(); g.textAlign = 'right'; g.fillText(fr(v, 1).replace('-', '−'), x0 - 4, y + 3); }
  g.textAlign = 'right'; g.fillText('µs', W - 12, H - 12);
  g.strokeStyle = '#7fe8a6'; g.lineWidth = 2; g.beginPath();
  for (let i = 0; i <= pw; i++) { const t = i / pw * 10, v = trace(t), y = Y(v); if (i) g.lineTo(x0 + i, y); else g.moveTo(x0 + i, y); }
  g.stroke();
  g.setLineDash([5, 4]); g.strokeStyle = '#ffb020'; g.lineWidth = 1.4;
  for (const t of [t1, t2]) { g.beginPath(); g.moveTo(X(t), y0); g.lineTo(X(t), y0 + ph); g.stroke(); }
  g.setLineDash([]);
  g.fillStyle = '#e8e8e2'; g.textAlign = 'left'; g.font = '600 12px "B612 Mono", monospace'; g.fillText(title, x0 + 6, y0 + 14);
}

export const LABS_CH7 = {
  // =================================================================================
  /** la fibre : inspecter les quatre faces, nettoyer à sec ou à l'alcool, brancher, puis CAM PW */
  fibre(ctx) {
    const st = { faces: dirt0(), view: '', seen: new Set(), plugged: false, campw: false, msg: '' };
    const defis = [false, false, false];
    const view = cnv(640, 360); view.className = 'cl-vfc c7-micro'; view.setAttribute('role', 'img');
    const faceSel = seg('Face', FACES.map(([id, t]) => [id, t]), '', (v) => { st.view = String(v); st.msg = ''; if (!st.plugged) st.seen.add(st.view); up(); });
    const dry = el('button', { type: 'button', class: 'btn small', onclick: () => clean('sec') }, 'Stylo de nettoyage (à sec)');
    const wet = el('button', { type: 'button', class: 'btn small', onclick: () => clean('alcool') }, 'Lingette à l\'alcool');
    const plugB = el('button', { type: 'button', class: 'btn small', onclick: () => plug() }, 'Brancher le câble');
    const pw = toggle('CAM PW (RCP)', false, (v) => { st.campw = v; st.msg = v && !st.plugged ? 'CAM PW allumé sans câble : la CCU n\'a rien au bout. Branche d\'abord, caméra hors tension.' : ''; up(); });
    const read = readout();
    const sh = shell({ vf: { canvas: view }, ctrls: [faceSel.row, btnRow(dry, wet), btnRow(plugB, pw.btn), read], defis: [
      'Inspecte les quatre faces au microscope : la prise de la caméra et le bout du câble, fibre 1 et fibre 2.',
      'Nettoie jusqu\'à ce que la zone du cœur soit propre sur les quatre faces : à sec d\'abord, à l\'alcool si une tache résiste, et toujours fini à sec.',
      'Branche le câble caméra hors tension, puis allume CAM PW : chaque fibre ne doit perdre que sa connexion, 0,5 dB.',
    ] });
    const dirty = (id) => st.faces[id].some(inZoneA);
    const faceB = (id) => blockedFraction(st.faces[id]);
    /** perte de chaque fibre : la connexion propre, plus ce qu'arrêtent les deux faces */
    const fibreLoss = (n) => CONN_DB + lossDb(1 - (1 - faceB('cam' + n)) * (1 - faceB('cab' + n)));
    function clean(how) {
      if (st.plugged) { st.msg = 'Le câble est branché : on ne nettoie que des faces débranchées. Débranche (caméra hors tension).'; up(); return; }
      if (!st.view) { st.msg = 'Choisis d\'abord la face à nettoyer.'; up(); return; }
      const f = st.faces[st.view];
      if (how === 'sec') {
        const gras = f.filter((s) => s.k === 'gras');
        st.faces[st.view] = gras;
        st.msg = gras.length ? 'Le stylo à sec a enlevé la poussière, pas la trace grasse : il l\'étale. Passe la lingette à l\'alcool, puis finis à sec.' : 'Face nettoyée à sec. Regarde-la encore : on vérifie toujours après avoir nettoyé.';
      } else {
        st.faces[st.view] = [{ x: 0.8, y: -0.6, r: 38, t: 0.9, k: 'humide' }];
        st.msg = 'L\'alcool a dissous la saleté, mais il reste un film humide sur la face : finis toujours par un nettoyage à sec.';
      }
      up();
    }
    function plug() {
      if (st.campw) { st.msg = 'CAM PW est allumé : on ne branche ni ne débranche une fibre sous tension. Éteins CAM PW au RCP.'; up(); return; }
      if (st.plugged) { st.plugged = false; st.msg = 'Débranché. Les bouchons, tout de suite, si tu ne rebranches pas.'; up(); return; }
      // au branchement, les deux faces se touchent : la saleté de l'une passe sur l'autre (vue en miroir)
      let moved = 0;
      for (const n of [1, 2]) {
        const a = st.faces['cam' + n], b = st.faces['cab' + n];
        const copy = (s) => ({ ...s, x: -s.x, r: s.r * 0.85, t: s.k === 'gras' ? 0.7 : s.t });
        const toB = a.map(copy), toA = b.map(copy);
        moved += toA.length + toB.length;
        st.faces['cam' + n] = [...a, ...toA]; st.faces['cab' + n] = [...b, ...toB];
      }
      st.plugged = true;
      st.msg = moved ? 'Branché sale : la saleté de chaque face est passée sur la face d\'en face. Débranche, et nettoie les deux.' : '';
      up();
    }
    function olivier() {
      if (st.msg) return st.msg;
      if (defis[2]) return `Liaison propre : ${fr(fibreLoss(1), 1)} dB sur la fibre 1, ${fr(fibreLoss(2), 1)} dB sur la fibre 2, la connexion seule. La CCU alimente la caméra ; les bouchons vont dans la poche, pas par terre.`;
      if (st.plugged) {
        if (!defis[1]) return 'Branché avant d\'avoir tout nettoyé. Débranche, nettoie, puis rebranche.';
        return st.campw ? 'CAM PW allumé.' : 'Branché et verrouillé. Allume CAM PW : la CCU envoie l\'énergie à la caméra.';
      }
      if (!st.view) return 'Avant de brancher, on regarde. Choisis une face : la prise de la caméra ou le bout du câble, fibre 1 ou fibre 2.';
      const f = st.faces[st.view], b = faceB(st.view);
      if (f.some((s) => s.k === 'humide')) return 'Encore un film d\'alcool : un coup de stylo à sec.';
      if (f.some((s) => s.k === 'gras' && inZoneA(s))) return `Une trace de doigt sur le cœur : elle arrête ${fr(b * 100, 0)} % de la lumière. Le stylo à sec l'étalerait : alcool d'abord, puis à sec.`;
      const near = f.filter((s) => s.k === 'poussiere' && inZoneA(s));
      if (near.length) {
        const big = near.reduce((m, s) => (s.r > m.r ? s : m), near[0]);
        return b >= 0.03 ? `Une poussière de ${fr(big.r * 2, 1)} µm sur le cœur : à elle seule, elle arrête ${fr(b * 100, 0)} % de la lumière (${fr(lossDb(b), 1)} dB). Stylo à sec, puis regarde encore.` : `${near.length > 1 ? 'Des grains' : 'Un grain'} dans la zone du cœur : peu de lumière perdue aujourd'hui (${fr(lossDb(b), 2)} dB), mais au branchement ils glissent sur le cœur ou rayent l'autre face. Stylo à sec.`;
      }
      if (f.length) return 'Zone du cœur propre. Les grains sur la gaine ne coûtent rien aujourd\'hui, mais un coup de stylo ne coûte rien non plus.';
      return defis[1] ? 'Les quatre faces sont propres : branche le câble, caméra hors tension.' : 'Face propre. Passe à la suivante.';
    }
    function up() {
      if (!defis[0] && st.seen.size === 4) defis[0] = true;
      if (defis[0] && !defis[1] && FACES.every(([id]) => !dirty(id))) defis[1] = true;
      if (defis[1] && !defis[2] && st.plugged && st.campw && fibreLoss(1) < CONN_DB + 0.05 && fibreLoss(2) < CONN_DB + 0.05) defis[2] = true;
      const g = view.getContext('2d');
      const title = st.view ? FACES.find((x) => x[0] === st.view)[1] : 'Choisis une face';
      drawFace(g, st.view ? st.faces[st.view] : [], title, st.plugged);
      view.setAttribute('aria-label', st.plugged ? 'Microscope : câble branché, faces invisibles' : st.view ? `Microscope : ${title}, ${dirty(st.view) ? 'saleté dans la zone du cœur' : 'zone du cœur propre'}` : 'Microscope de fibre');
      plugB.textContent = st.plugged ? 'Débrancher le câble' : 'Brancher le câble';
      plugB.classList.toggle('on', st.plugged);
      const parts = [];
      if (st.view && !st.plugged) { const b = faceB(st.view); parts.push(`Cette face : zone du cœur ${dirty(st.view) ? 'sale' : 'propre'}, ${fr(b * 100, 1)} % de la lumière arrêtée (${fr(lossDb(b), 2)} dB).`); }
      parts.push(`${st.plugged ? 'Branché' : 'Si l\'on branchait maintenant'} : fibre 1 (vers la CCU) ${fr(fibreLoss(1), 2)} dB, fibre 2 (vers la caméra) ${fr(fibreLoss(2), 2)} dB, dont ${fr(CONN_DB, 1)} dB pour une connexion propre (ordre de grandeur).`);
      read.textContent = parts.join(' ');
      sh.done(defis); sh.say(olivier());
      send(ctx, { light: st.plugged && st.campw ? 0.5 : 0 });
    }
    sh.node.append(btnRow(linkBtn('Recommencer', () => { Object.assign(st, { faces: dirt0(), view: '', seen: new Set(), plugged: false, campw: false, msg: '' }); faceSel.mark(''); pw.set(false); defis.fill(false); up(); })));
    up();
    return { node: sh.node, dispose() {} };
  },

  // =================================================================================
  /** la CCU : câbler l'arrière, mettre la voie en service, vérifier aux barres, renvoyer au cadreur */
  ccu(ctx) {
    const st = { z: zoomPos(20), s: pointPos(MIRE_D), n: irisPos(5.6), nd: 1, power: false, campw: false, bars: false, barsSeen: false };
    /** @type {Map<number, string>} câble → prise */
    const placed = new Map(); let sel = -1, msg = '';
    const defis = [false, false, false];
    const vf = makeViewfinder();
    const rings = lensRings(st, () => up(), []);
    // ---- la face arrière ----
    const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', '0 0 440 196'); svg.setAttribute('class', 'cf c7-ccupanel'); svg.setAttribute('role', 'group'); svg.setAttribute('aria-label', 'Face arrière de la CCU : les prises');
    mk(svg, 'rect', { x: 3, y: 3, width: 434, height: 190, rx: 6, class: 'c7-plate' });
    for (const [x, t] of [[104, 'REFERENCE'], [156, 'PROMPTER'], [208, 'RET VBS'], [258, 'RET SDI']]) mk(svg, 'text', { x, y: 32, class: 'c7-plbl' }).textContent = t;
    mk(svg, 'text', { x: 138, y: 138, class: 'c7-plbl' }).textContent = 'SDI OUT · HD/SD';
    mk(svg, 'text', { x: 270, y: 138, class: 'c7-plbl' }).textContent = 'SDI OUT · 3G/4K/HD';
    const holes = new Map();
    for (const p of CCU_JACKS) {
      const g = mk(svg, 'g', { class: 'c7-jack', tabindex: 0, role: 'button', 'aria-label': `${p.nom}, ${p.type}` });
      if (p.kind === 'fibre') { mk(g, 'circle', { cx: p.x, cy: p.y, r: 25, class: 'c7-jk-ring' }); mk(g, 'circle', { cx: p.x, cy: p.y, r: 21, class: 'c7-jk-body' }); mk(g, 'circle', { cx: p.x, cy: p.y, r: 9, class: 'c7-jk-pin' }); mk(g, 'circle', { cx: p.x, cy: p.y - 16, r: 2.4, class: 'c7-jk-red' }); }
      else if (p.kind === 'ac') { mk(g, 'rect', { x: p.x - 17, y: p.y - 12, width: 34, height: 24, rx: 3, class: 'c7-jk-body' }); for (const dx of [-7, 0, 7]) mk(g, 'rect', { x: p.x + dx - 1.5, y: p.y - 5, width: 3, height: 10, class: 'c7-jk-pin' }); }
      else if (p.kind === 'dsub') { mk(g, 'path', { d: `M${p.x - 34} ${p.y - 11} L${p.x + 34} ${p.y - 11} L${p.x + 29} ${p.y + 11} L${p.x - 29} ${p.y + 11} Z`, class: 'c7-jk-body' }); for (let i = 0; i < 13; i++) mk(g, 'circle', { cx: p.x - 27 + i * 4.5, cy: p.y - 4, r: 1.2, class: 'c7-jk-pin' }); for (let i = 0; i < 12; i++) mk(g, 'circle', { cx: p.x - 25 + i * 4.5, cy: p.y + 4, r: 1.2, class: 'c7-jk-pin' }); }
      else if (p.kind === 'multi') { mk(g, 'circle', { cx: p.x, cy: p.y, r: 15, class: 'c7-jk-body' }); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; mk(g, 'circle', { cx: p.x + Math.cos(a) * 8, cy: p.y + Math.sin(a) * 8, r: 1.5, class: 'c7-jk-pin' }); } }
      else { mk(g, 'circle', { cx: p.x, cy: p.y, r: 11, class: 'c7-jk-body' }); mk(g, 'circle', { cx: p.x, cy: p.y, r: 5.5, class: 'c7-jk-pin' }); mk(g, 'circle', { cx: p.x, cy: p.y, r: 1.8, class: 'c7-jk-ring' }); }
      const ly = p.kind === 'fibre' ? p.y + 38 : p.kind === 'ac' ? p.y + 26 : p.kind === 'dsub' ? p.y + 26 : p.kind === 'multi' ? p.y + 28 : p.y + 23;
      mk(g, 'text', { x: p.x, y: ly, class: 'c7-jk-lbl' }).textContent = p.lbl;
      pressable(g, () => plugAt(p.id));
      holes.set(p.id, g);
    }
    const chips = el('div', { class: 'cl-see cl-gear' }, ...CCU_CABLES.map((c, i) => el('button', { type: 'button', class: 'cl-chip', onclick: () => { sel = i; msg = ''; up(); } }, c.nom)));
    const powerB = toggle('POWER (façade de la CCU)', false, (v) => { if (v && !has('ac')) { powerB.set(false); msg = 'Pas de secteur : branche d\'abord AC IN.'; } else { st.power = v; if (!v) { st.campw = false; st.bars = false; } msg = ''; } up(); });
    const campwB = el('button', { type: 'button', class: 'btn small', onclick: () => {
      if (!st.power) msg = 'La CCU est éteinte : allume son interrupteur POWER.';
      else if (!has('rcp')) msg = 'Le RCP n\'est pas branché sur la CCU : sa touche CAM PW ne commande rien.';
      else if (!has('fibre') && !st.campw) msg = 'Pas de caméra au bout : branche d\'abord la fibre, propre.';
      else { st.campw = !st.campw; msg = st.campw ? '' : 'CAM PW éteint : la caméra n\'est plus alimentée.'; }
      up();
    } }, 'CAM PW (RCP)');
    const barsB = el('button', { type: 'button', class: 'btn small', onclick: () => {
      if (!st.power || !has('rcp')) msg = 'BARS est une touche du RCP : il faut la CCU allumée et le RCP branché.';
      else { st.bars = !st.bars; if (st.bars) st.barsSeen = true; msg = ''; }
      up();
    } }, 'BARS (RCP)');
    const disp = el('div', { class: 'c7-ccud', role: 'status', 'aria-label': 'Affichage de la manipulation : état de la voie' });
    const cad = readout();
    const sh = shell({ vf, ctrls: [el('p', { class: 'cl-hint' }, 'Choisis un câble, puis clique sur la prise où le brancher.'), chips, el('div', { class: 'c7-ccuwrap' }, svg), btnRow(powerB.btn, campwB, barsB), disp, cad], defis: [
      'Mets la caméra sous tension : la fibre, le secteur, le RCP, l\'interrupteur POWER, puis CAM PW au RCP.',
      'Envoie l\'image calée vers la régie : la référence (et son bouchon), une sortie SDI vers la grille ; vérifie aux barres, puis repasse sur la caméra.',
      'Renvoie au cadreur ce dont il a besoin : le programme sur un retour, le prompteur, l\'intercom et le tally.',
    ] });
    function has(id) { for (const [i, j] of placed) if (CCU_CABLES[i].ok.includes(id) && (id === j || CCU_CABLES[i].ok[0] === id)) return true; return false; }
    function plugAt(id) {
      const p = CCU_JACKS.find((x) => x.id === id);
      const used = [...placed.entries()].find(([, j]) => j === id);
      if (used) { msg = `${p.nom} : déjà pris par « ${CCU_CABLES[used[0]].nom.toLowerCase()} ».`; up(); return; }
      if (sel < 0) { msg = `${p.nom} : ${p.type}. Choisis d'abord un câble dans la liste.`; up(); return; }
      const c = CCU_CABLES[sel];
      if (c.ok.includes(id)) { placed.set(sel, id); msg = c.why; sel = -1; }
      else msg = `Pas ${p.nom} pour « ${c.nom.toLowerCase()} » : ${ccuHint(c, id)}`;
      up();
    }
    function olivier() {
      if (msg) return msg;
      if (defis.every(Boolean)) return 'La voie est en service : énergie et commandes vers la caméra, image calée vers la grille, retours, prompteur, intercom et tally vers le cadreur. Tout passe par la même fibre.';
      if (st.campw && !has('refin')) return 'L\'image est belle, mais la CCU n\'est calée sur rien : à la première coupe au mélangeur, elle sauterait. La référence.';
      if (st.bars) return 'Les barres sortent de la CCU : la liaison jusqu\'à la grille est bonne, sans dépendre de l\'objectif ni de la lumière. Repasse sur la caméra.';
      if (!st.power) return 'Commence par la fibre et le secteur. On allume la CCU, puis on alimente la caméra.';
      if (!st.campw) return 'La CCU est allumée, la caméra pas encore : c\'est CAM PW, au RCP, qui envoie l\'énergie dans la fibre.';
      return 'Câble par câble : chaque prise a sa forme et son inscription.';
    }
    function up() {
      const ref = has('refin'), term = has('refloop'), sdi = [...placed.values()].some((j) => /^(sdi|g)\d$/.test(j));
      if (!defis[0] && has('fibre') && has('ac') && has('rcp') && st.power && st.campw) defis[0] = true;
      if (!defis[1] && ref && term && sdi && st.barsSeen && !st.bars) defis[1] = true;
      if (!defis[2] && has('rets1') && has('prompter') && has('icom')) defis[2] = true;
      [...chips.children].forEach((b, i) => { b.classList.toggle('on', sel === i); b.classList.toggle('done', placed.has(i)); /** @type {HTMLButtonElement} */ (b).disabled = placed.has(i); });
      for (const [id, g] of holes) g.classList.toggle('used', [...placed.values()].includes(id));
      campwB.classList.toggle('on', st.campw); campwB.setAttribute('aria-pressed', String(st.campw));
      barsB.classList.toggle('on', st.bars); barsB.setAttribute('aria-pressed', String(st.bars));
      const cam = !has('fibre') ? 'pas de câble' : st.campw ? 'alimentée par la fibre (≈ 32 W avec le viseur, fiche Sony)' : 'non alimentée';
      const refT = !ref ? 'aucune : la CCU suit son horloge interne' : `tri-level, ${term ? '0,6 V : verrouillée' : '1,2 V sans bouchon : hors norme'}`;
      const outT = !sdi ? 'non branchée' : `1080i50 en HD-SDI, 1,485 Gb/s${st.bars ? ' : barres' : st.campw ? ' : image de la caméra' : ' : noir'}`;
      disp.replaceChildren(...[
        ['CCU', st.power ? 'sous tension' : 'éteinte'], ['Caméra', st.power ? cam : '—'], ['Référence', st.power ? refT : '—'], ['Sortie SDI', st.power ? outT : '—'],
      ].map(([k, v]) => el('div', {}, el('b', {}, k), el('span', {}, v))));
      const on = st.power && st.campw;
      cad.textContent = `Côté cadreur : viseur ${on ? 'allumé' : 'éteint'} · retour RET ${on && has('rets1') ? 'programme reçu' : 'rien'} · prompteur ${on && has('prompter') ? 'texte reçu' : 'rien'} · intercom et tally ${on && has('icom') ? 'reçus' : 'rien'}.`;
      sh.done(defis); sh.say(olivier());
      const o = rings.read();
      const shown = !st.power || !sdi ? 'nosig' : st.bars ? 'bars' : st.campw ? 'cam' : 'noir';
      vf.draw({ f: o.f, dF: o.dF, N: o.N, light: 0.5, E: shown === 'cam' ? undefined : 0, scene: shown === 'bars' ? 'bars' : 'mire', osd: false, msg: shown === 'nosig' ? 'pas de signal' : shown === 'noir' ? 'noir : caméra non alimentée' : '' });
      send(ctx, lensState(st, o, { light: on ? 0.5 : 0, bars: on && st.bars }));
    }
    sh.node.append(btnRow(linkBtn('Recommencer', () => { placed.clear(); sel = -1; msg = ''; Object.assign(st, { power: false, campw: false, bars: false, barsSeen: false }); powerB.set(false); defis.fill(false); up(); })));
    up();
    return { node: sh.node, dispose: () => vf.dispose() };
  },

  // =================================================================================
  /** le RCP : prendre la main, exposer au manche, rattraper une baisse de lumière, caler le noir */
  rcp(ctx) {
    const GAINS = [0, 6, 12];
    const st = { z: zoomPos(20), s: pointPos(MIRE_D), n: irisPos(11), nd: 1, ndi: 0, gi: 0, mb: 5, light: 0.5, panel: false, call: false };
    const defis = [false, false, false];
    let msg = '', callT = 0;
    const vf = makeViewfinder(); const sc = scopeCanvas(); vf.onFrame((img) => drawScope(sc, img));
    const rings = lensRings(st, () => up(), []);
    const lcd = el('div', { class: 'c7-rcpd', role: 'status', 'aria-label': 'Écran du RCP' });
    const locked = () => { if (!st.panel) { msg = 'PANEL ACTIVE est éteint : le panneau est verrouillé, la caméra ne bouge pas. Allume PANEL ACTIVE pour prendre la main.'; return true; } msg = ''; return false; };
    const panel = toggle('PANEL ACTIVE', false, (v) => { st.panel = v; msg = ''; up(); });
    const callB = el('button', { type: 'button', class: 'btn small c7-call', onclick: () => { st.call = true; clearTimeout(callT); callT = window.setTimeout(() => { st.call = false; up(); }, 1500); msg = 'CALL : la lampe d\'appel s\'allume chez le cadreur, qui répond dans l\'intercom. Le CALL marche même panneau verrouillé.'; up(); } }, 'CALL');
    const iris = slider('Manche : iris', 0, 0.96, 0.001, st.n, (v) => { if (locked()) iris.set(st.n); else st.n = v; up(); });
    const mblk = slider('Bouton du manche : master black', -4, 8, 0.1, st.mb, (v) => { if (locked()) mblk.set(st.mb); else st.mb = v; up(); });
    const step = (key, list, d) => { if (locked()) { up(); return; } st[key] = clamp(st[key] + d, 0, list.length - 1); up(); };
    const gDn = el('button', { type: 'button', class: 'btn small', 'aria-label': 'MASTER GAIN : moins', onclick: () => step('gi', GAINS, -1) }, '▼');
    const gUp = el('button', { type: 'button', class: 'btn small', 'aria-label': 'MASTER GAIN : plus', onclick: () => step('gi', GAINS, 1) }, '▲');
    const ndDn = el('button', { type: 'button', class: 'btn small', 'aria-label': 'ND : filtre plus clair', onclick: () => step('ndi', ND, -1) }, '▼');
    const ndUp = el('button', { type: 'button', class: 'btn small', 'aria-label': 'ND : filtre plus dense', onclick: () => step('ndi', ND, 1) }, '▲');
    const gOut = el('output', { class: 'c7-win' }), ndOut = el('output', { class: 'c7-win' });
    const read = readout();
    const sh = shell({ vf, scope: sc, ctrls: [btnRow(panel.btn, callB), lcd, iris.row, mblk.row,
      el('div', { class: 'cl-row c7-steps' }, el('span', { class: 'cl-lbl' }, 'MASTER GAIN'), el('span', { class: 'c7-stepbox' }, gDn, gOut, gUp), el('span')),
      el('div', { class: 'cl-row c7-steps' }, el('span', { class: 'cl-lbl' }, 'ND'), el('span', { class: 'c7-stepbox' }, ndDn, ndOut, ndUp), el('span')), read], defis: [
      'Prends la main sur la CAM 1 (PANEL ACTIVE) et expose la mire au manche : le blanc entre 85 et 100 % sur la forme d\'onde.',
      'La lumière du plateau baisse de quatre diaphragmes (seize fois moins). Rattrape l\'exposition : l\'iris d\'abord, le gain seulement s\'il le faut, et pas plus qu\'il ne faut.',
      'La lumière revient : gain à 0 dB, blanc entre 85 et 100 %, le noir entre 0 et 2 % au master black. Puis rends la main (PANEL ACTIVE éteint).',
    ] });
    const N = () => irisN(st.n);
    const gain = () => GAINS[st.gi];
    const E = () => exposureOf(N(), ND[st.ndi][1], gain()) * st.light;
    /** le master black : un décalage du signal (%), ramené en lumière dans la partie droite de la courbe BT.709 */
    const blackLin = () => st.mb / 100 / 4.5;
    const white = () => 100 * encode(MIRE_WHITE * E() + blackLin());
    const blackLvl = () => 100 * encode(Math.max(0, blackLin()));
    const ok = (w) => w >= 85 && w < 99.6;
    function olivier(w) {
      if (msg) return msg;
      if (defis[2]) return 'Réglée, rendue : PANEL ACTIVE éteint, un dossier posé sur le pupitre ne changera plus rien. L\'ordre : la lumière ou le ND pour le gros, l\'iris pour le fin, le gain en dernier recours.';
      if (defis[1]) {
        if (gain() > 0) return `La lumière est revenue : ${gain()} dB de gain ne servent plus qu'à faire du bruit. Remets MASTER GAIN à 0 dB et referme l'iris.`;
        if (!ok(w)) return w >= 99.6 ? 'Écrêté : referme l\'iris.' : 'Un peu sombre : ouvre l\'iris.';
        if (st.mb < 0) return `Le master black est à ${sgn(st.mb)} % : les ombres sont écrasées sous 0 %, leurs détails disparaissent. Remonte-le entre 0 et 2 %.`;
        if (st.mb > 2) return `Le noir est à ${fr(blackLvl(), 1)} % : la vacation précédente l'a laissé haut, l'image paraît délavée. Tourne le bouton du manche vers le bas, jusqu'à 0 à 2 %.`;
        return st.panel ? 'Tout est bon : éteins PANEL ACTIVE pour rendre la main.' : 'Rallume PANEL ACTIVE pour finir les réglages.';
      }
      if (defis[0]) {
        const n = N();
        if (ok(w)) return gain() > 6 ? `Exposé, mais avec +${gain()} dB : deux diaphragmes de bruit, alors que l'iris pouvait encore s'ouvrir. +6 dB suffisent.` : 'Exposé.';
        if (w < 85 && n > 1.85) return `La lumière a baissé : le blanc est tombé à ${fr(w, 0)} %. Ouvre l'iris d'abord, il ne coûte rien.`;
        if (w < 85 && gain() === 0) return `Iris en butée à f/1,8 : il a rattrapé 3,3 diaphragmes, il en manque encore. Monte MASTER GAIN d'un cran : +6 dB, un diaphragme.`;
        if (w >= 99.6) return 'Écrêté : referme un peu l\'iris.';
        return `Le blanc est à ${fr(w, 0)} %.`;
      }
      if (!st.panel) return 'Le RCP de la CAM 1 est verrouillé : la touche PANEL ACTIVE est éteinte. Allume-la pour prendre la main.';
      if (w < 85) return `Le blanc est à ${fr(w, 0)} % : l'image est sombre. Tire ou pousse le manche pour ouvrir l'iris.`;
      if (w >= 99.6) return 'Le blanc est écrêté à 100 % : referme l\'iris.';
      return `Blanc à ${fr(w, 0)} %.`;
    }
    function up() {
      let w = white();
      if (!defis[0] && st.panel && ok(w)) { defis[0] = true; st.light = 0.5 / 16; w = white(); }
      else if (defis[0] && !defis[1] && ok(w) && gain() === 6) { defis[1] = true; st.light = 0.5; w = white(); }
      if (defis[1] && !defis[2] && !st.panel && ok(w) && gain() === 0 && st.mb >= 0 && st.mb <= 2) defis[2] = true;
      panel.set(st.panel); callB.classList.toggle('on', st.call);
      iris.out.textContent = 'f/' + fr(N(), 1); mblk.out.textContent = sgn(st.mb) + ' %';
      gOut.textContent = (gain() > 0 ? '+' : '') + gain() + ' dB'; ndOut.textContent = ND[st.ndi][0];
      lcd.replaceChildren(el('div', {}, el('b', {}, 'CAM 1'), el('span', { class: st.panel ? 'on' : '' }, st.panel ? 'PANEL ACTIVE' : 'verrouillé')),
        el('div', {}, el('span', {}, 'IRIS F' + fr(N(), 1)), el('span', {}, 'GAIN ' + (gain() > 0 ? '+' : '') + gain() + 'dB'), el('span', {}, 'ND ' + ND[st.ndi][0].replace('ND', ''))),
        el('div', {}, el('span', {}, 'M.BLK ' + sgn(st.mb) + '%'), el('span', {}, 'CC 3200K')));
      read.textContent = `Blanc de la mire ${fr(w, 0)} % · noir ${fr(blackLvl(), 1)} % · lumière du plateau ${st.light < 0.5 ? '÷ 16 (− 4 diaphragmes)' : 'normale'} · lumière reçue ${fr(Math.log2(E() / 0.5), 1).replace('-', '−')} diaph. par rapport à f/8`;
      sh.done(defis); sh.say(olivier(w));
      const o = rings.read();
      vf.draw({ f: o.f, dF: o.dF, N: N(), nd: ND[st.ndi][1], gain: gain(), E: E(), black: [blackLin(), blackLin(), blackLin()], noise: 0.0016 * 10 ** (gain() / 20) });
      send(ctx, lensState(st, o, { iris: N(), nd: st.ndi, light: st.light, gain: gain() }));
    }
    sh.node.append(btnRow(linkBtn('Recommencer', () => { Object.assign(st, { n: irisPos(11), ndi: 0, gi: 0, mb: 5, light: 0.5, panel: false }); msg = ''; iris.set(st.n); mblk.set(st.mb); defis.fill(false); up(); })));
    up();
    return { node: sh.node, dispose: () => { clearTimeout(callT); vf.dispose(); } };
  },

  // =================================================================================
  /** le genlock : mesurer les deux références, câbler la boucle de trois CCU, la terminer */
  genlock(ctx) {
    const st = { src: ['', '', ''], term: [false, false, false], probe: 'A1', t1: 1, t2: 2, seen: { tri: false, bb: false } };
    const defis = [false, false, false];
    let msg = '';
    const scope = cnv(640, 250); scope.className = 'c7-refscope'; scope.setAttribute('role', 'img');
    const schema = document.createElementNS(NS, 'svg'); schema.setAttribute('viewBox', '0 0 440 196'); schema.setAttribute('class', 'cf c7-refmap'); schema.setAttribute('role', 'img');
    const probeSel = seg('Oscilloscope sur', [['A1', 'DA A1'], ['B1', 'DA B1'], ['c0', 'CCU 1'], ['c1', 'CCU 2'], ['c2', 'CCU 3']], st.probe, (v) => { st.probe = String(v); up(); });
    const c1 = slider('Curseur 1', 0, 10, 0.01, st.t1, (v) => { st.t1 = v; up(); });
    const c2 = slider('Curseur 2', 0, 10, 0.01, st.t2, (v) => { st.t2 = v; up(); });
    const rows = [0, 1, 2].map((k) => {
      const opts = [['', 'rien'], ...DA_OUTS.map((o) => [o, 'DA ' + o]), ...[0, 1].filter((j) => j < k).map((j) => ['L' + j, 'boucle de la CCU ' + (j + 1)])];
      const select = /** @type {HTMLSelectElement} */ (el('select', { class: 'c7-sel', 'aria-label': `REFERENCE IN de la CCU ${k + 1}`, onchange: () => setSrc(k, select.value) }, ...opts.map(([v, t]) => el('option', { value: v }, t))));
      const bouchon = toggle('Bouchon 75 Ω sur la boucle', false, (v) => { st.term[k] = v; msg = ''; up(); });
      const state = el('span', { class: 'c7-lock' });
      return { select, bouchon, state, row: el('div', { class: 'c7-ccurow' }, el('b', {}, `CCU ${k + 1}`), el('label', { class: 'c7-in' }, el('span', {}, 'REF IN ←'), select), bouchon.btn, state) };
    });
    const read = readout();
    const sh = shell({ vf: { canvas: scope }, ctrls: [probeSel.row, c1.row, c2.row, read, el('div', { class: 'c7-ccurows' }, ...rows.map((r) => r.row))], defis: [
      'Le distributeur sort deux signaux, A et B. Mesure aux curseurs le top de synchro de chacun : lequel est le tri-level ?',
      'Envoie le tri-level aux trois CCU de la baie : la CCU 3 le reçoit par une boucle.',
      'Termine chaque ligne : un bouchon de 75 Ω au bout de chaque boucle, et 0,6 V crête à crête sur les trois CCU.',
    ] });
    sh.screen.append(el('div', { class: 'c7-refwrap' }, schema));
    function setSrc(k, v) {
      msg = '';
      // une sortie ne se partage pas : la CCU qui l'avait la perd
      if (v) st.src.forEach((s, j) => { if (j !== k && s === v) { st.src[j] = ''; rows[j].select.value = ''; msg = `${v[0] === 'L' ? 'Cette boucle' : 'Cette sortie du DA'} allait déjà à la CCU ${j + 1} : un connecteur, un câble. La CCU ${j + 1} n'a plus de référence.`; } });
      st.src[k] = v;
      // une boucle qui part vers une autre CCU ne peut plus porter de bouchon
      if (v[0] === 'L') { const j = Number(v.slice(1)); if (st.term[j]) { st.term[j] = false; rows[j].bouchon.set(false); msg = `Le câble prend la place du bouchon sur la boucle de la CCU ${j + 1} : le bouchon va au bout de la chaîne.`; } }
      up();
    }
    const chains = () => refChains(st.src, st.term, DA_SIG);
    /** la trace au point mesuré : signal, réflexion du bout, retard aller-retour */
    function probeInfo() {
      const ch = chains();
      if (st.probe[0] === 'c') {
        const c = ch[Number(st.probe.slice(1))];
        return c.sig ? { sig: c.sig, gamma: c.gamma, delay: 2 * (c.L - c.x) * COAX_US_M, where: `CCU ${Number(st.probe.slice(1)) + 1}` } : { sig: null, where: `CCU ${Number(st.probe.slice(1)) + 1}` };
      }
      const first = st.src.findIndex((s) => s === st.probe);
      const sig = DA_SIG[st.probe[0]];
      if (first < 0) return { sig, gamma: 1, delay: 0, where: 'DA ' + st.probe, open: true };
      const c = ch[first];
      return { sig, gamma: c.gamma, delay: 2 * c.L * COAX_US_M, where: 'DA ' + st.probe };
    }
    function drawSchema(ch) {
      schema.replaceChildren();
      const ys = [20, 82, 144], inX = 262, loopX = 296;
      mk(schema, 'rect', { x: 10, y: 22, width: 92, height: 160, rx: 4, class: 'c7-box' });
      mk(schema, 'text', { x: 56, y: 40, class: 'c7-bt' }).textContent = 'Distributeur';
      const daY = { A1: 66, A2: 96, B1: 130, B2: 160 };
      for (const o of DA_OUTS) { mk(schema, 'circle', { cx: 92, cy: daY[o], r: 7, class: 'c7-bnc' }); mk(schema, 'text', { x: 76, y: daY[o] + 4, class: 'c7-tl r' }).textContent = o; }
      mk(schema, 'text', { x: 18, y: 80, class: 'c7-tl l' }).textContent = 'A'; mk(schema, 'text', { x: 18, y: 146, class: 'c7-tl l' }).textContent = 'B';
      ys.forEach((y, k) => {
        mk(schema, 'rect', { x: 246, y, width: 186, height: 48, rx: 4, class: 'c7-box' + (ch[k].sig === 'tri' && ch[k].gamma === 0 ? ' ok' : ch[k].sig ? ' warn' : '') });
        mk(schema, 'text', { x: 340, y: y + 15, class: 'c7-bt' }).textContent = `CCU ${k + 1}`;
        mk(schema, 'circle', { cx: inX, cy: y + 30, r: 7, class: 'c7-bnc' }); mk(schema, 'circle', { cx: loopX, cy: y + 30, r: 7, class: 'c7-bnc' });
        mk(schema, 'text', { x: inX, y: y + 45, class: 'c7-tl' }).textContent = 'IN'; mk(schema, 'text', { x: loopX, y: y + 45, class: 'c7-tl' }).textContent = 'boucle';
        const c = ch[k];
        mk(schema, 'text', { x: 334, y: y + 34, class: 'c7-tl l' }).textContent = !c.sig ? 'libre' : `${c.sig === 'tri' ? 'tri-level' : 'b. burst'} ${fr(0.6 * (1 + c.gamma) * (c.sig === 'bb' ? 0.5 : 1), 1)} V`;
        if (st.term[k]) { mk(schema, 'rect', { x: loopX + 8, y: y + 24, width: 22, height: 12, rx: 2, class: 'c7-term' }); mk(schema, 'text', { x: loopX + 19, y: y + 33, class: 'c7-tl ink' }).textContent = '75'; }
      });
      st.src.forEach((s, k) => {
        if (!s) return;
        const y2 = ys[k] + 30;
        if (s[0] === 'L') { const j = Number(s.slice(1)), y1 = ys[j] + 30; mk(schema, 'path', { d: `M${loopX} ${y1} C ${loopX + 40} ${y1 + 26}, ${inX - 40} ${y2 - 26}, ${inX} ${y2}`, class: 'c7-cable ' + DA_SIG[ch[k].root ? ch[k].root[0] : 'A'] }); }
        else { const y1 = daY[s]; mk(schema, 'path', { d: `M99 ${y1} C 170 ${y1}, 190 ${y2}, ${inX - 7} ${y2}`, class: 'c7-cable ' + DA_SIG[s[0]] }); }
      });
      schema.setAttribute('aria-label', 'Schéma de la boucle : ' + ch.map((c, k) => `CCU ${k + 1} ${c.sig ? SIG_NAME[c.sig] + (c.gamma ? ', ligne ouverte' : ', ligne terminée') : 'sans référence'}`).join(' ; '));
    }
    function olivier(info, ch) {
      if (msg) return msg;
      if (defis[2]) {
        // la CCU qui passe la référence à une autre par sa boucle : on ne la retire pas sans recâbler l'autre
        const k = st.src.findIndex((s) => s[0] === 'L'), j = k >= 0 ? Number(st.src[k].slice(1)) : -1;
        return `Trois CCU verrouillées sur le tri-level, chaque ligne terminée : 0,6 V partout.${j >= 0 ? ` Et si l'on doit sortir la CCU ${j + 1} de la baie, on recâble d'abord la CCU ${k + 1}, sinon elle perd la référence avec elle.` : ''}`;
      }
      if (defis[1]) {
        const open = ch.find((c) => c.sig && c.gamma);
        return open ? `Une ligne n'est pas terminée : sur sa CCU, le tri-level mesure ${fr(0.6 * 2, 1)} V crête à crête au lieu de 0,6. Un bouchon au bout, sur la boucle de la dernière CCU de la chaîne.` : 'Mesure les trois CCU.';
      }
      if (defis[0]) {
        if (ch.some((c) => c.sig === 'bb')) return 'Le black burst verrouillerait aussi la CCU (la fiche accepte les deux), mais on a dit tri-level : la sortie B du distributeur.';
        return 'Le distributeur n\'a que deux sorties B : deux CCU en direct, la troisième par la boucle de l\'une d\'elles.';
      }
      if (!info.sig) return `${info.where} : rien. Aucune référence n'arrive là.`;
      const dt = Math.abs(st.t2 - st.t1);
      const pp = info.sig === 'tri' ? 0.6 * (1 + info.gamma) : 0.3 * (1 + info.gamma);
      const base = info.open ? ` La sortie n'est chargée par rien : le signal monte au double (${fr(pp, 1)} V), le DA est fait pour une ligne de 75 Ω.` : '';
      return `${info.where} : place les deux curseurs sur les fronts du top de synchro, à mi-hauteur. Écart : ${fr(dt, 2)} µs.${base}`;
    }
    function up() {
      const info = probeInfo(), ch = chains();
      // la mesure : les curseurs encadrent-ils une demi-impulsion du tri-level, l'impulsion entière, ou le top du black burst ?
      const dt = Math.abs(st.t2 - st.t1);
      if (info.sig === 'tri' && (Math.abs(dt - TRI_HALF) <= 0.06 || Math.abs(dt - 2 * TRI_HALF) <= 0.1) && !st.seen.tri) { st.seen.tri = true; msg = `${fr(dt, 2)} µs : c'est le tri-level. 44 périodes d'horloge à 74,25 MHz font 0,593 µs par demi-impulsion, −300 mV puis +300 mV.`; }
      if (info.sig === 'bb' && Math.abs(dt - BB_SYNC) <= 0.25 && !st.seen.bb) { st.seen.bb = true; msg = `${fr(dt, 2)} µs : le top de 4,7 µs du black burst, suivi de sa salve de sous-porteuse (10 périodes à 4,43 MHz).`; }
      if (!defis[0] && st.seen.tri && st.seen.bb) defis[0] = true;
      if (defis[0] && !defis[1] && ch.every((c) => c.sig === 'tri')) defis[1] = true;
      if (defis[1] && !defis[2] && ch.every((c) => c.sig === 'tri' && c.gamma === 0)) defis[2] = true;
      rows.forEach((r, k) => {
        r.select.value = st.src[k];
        const usedAsLoop = st.src.some((s) => s === 'L' + k);
        /** @type {HTMLButtonElement} */ (r.bouchon.btn).disabled = usedAsLoop;
        const c = ch[k];
        r.state.textContent = !c.sig ? 'libre : horloge interne' : `verrouillée · ${SIG_NAME[c.sig]}${c.gamma ? ' · ligne ouverte' : ''}`;
        r.state.className = 'c7-lock ' + (!c.sig ? 'ko' : c.gamma ? 'warn' : 'ok');
      });
      const trace = info.sig ? (t) => lineWave(info.sig, t, info.gamma, info.delay) : () => 0;
      drawRefScope(scope.getContext('2d'), trace, st.t1, st.t2, `${info.where}${info.sig ? ' · ' + (info.sig === 'tri' ? 'signal B' : 'signal A') : ' · pas de signal'}`);
      let lo = 0, hi = 0; if (info.sig) for (let t = 0; t <= 10; t += 0.005) { const v = trace(t); lo = Math.min(lo, v); hi = Math.max(hi, v); }
      scope.setAttribute('aria-label', `Oscilloscope, ${info.where} : ${info.sig ? `crête à crête ${fr(hi - lo, 2)} V` : 'pas de signal'}, curseurs à ${fr(st.t1, 2)} et ${fr(st.t2, 2)} µs`);
      c1.out.textContent = fr(st.t1, 2) + ' µs'; c2.out.textContent = fr(st.t2, 2) + ' µs';
      read.textContent = info.sig ? `Δt = ${fr(dt, 2)} µs · crête à crête ${fr(hi - lo, 2)} V${info.sig === 'bb' ? ` (top de synchro : ${fr(-lo > 0.45 ? 0.6 : 0.3, 1)} V, salve comprise dans le reste)` : ''}` : `Δt = ${fr(dt, 2)} µs · pas de signal`;
      drawSchema(ch);
      sh.done(defis); sh.say(olivier(info, ch));
      msg = '';
      send(ctx, {});
    }
    sh.node.append(btnRow(linkBtn('Recommencer', () => { Object.assign(st, { src: ['', '', ''], term: [false, false, false], probe: 'A1', t1: 1, t2: 2, seen: { tri: false, bb: false } }); rows.forEach((r) => r.bouchon.set(false)); probeSel.mark('A1'); c1.set(1); c2.set(2); defis.fill(false); msg = ''; up(); })));
    up();
    return { node: sh.node, dispose() {} };
  },

  // =================================================================================
  /** le signal de sortie : les codes 10 bits d'un point de l'image, le format et le débit */
  sortie(ctx) {
    const st = { z: zoomPos(20), s: pointPos(MIRE_D), n: irisPos(5.6), nd: 1, bars: false, fmt: '1080i50', out: 'hd', px: 320, py: 70, seenW: false, seenK: false };
    const defis = [false, false, false];
    const vf = makeViewfinder(); vf.canvas.classList.add('c7-pick'); vf.canvas.tabIndex = 0;
    vf.canvas.setAttribute('aria-label', 'Image de la caméra : clic ou flèches pour choisir le point mesuré (Maj : pas de 20 pixels)');
    const rings = lensRings(st, () => up(), []);
    const outSw = seg('OUTPUT', [['CAM', 'CAM'], ['BARS', 'BARS']], 'CAM', (v) => { st.bars = v === 'BARS'; up(); });
    const fmtSw = seg('Format', Object.keys(FORMATS).map((f) => [f, f]), st.fmt, (v) => { st.fmt = String(v); up(); });
    const outCard = seg('Sortie de la CCU', [['hd', 'HD/SD'], ['3g', '3G/4K/HD']], st.out, (v) => { st.out = String(v); up(); });
    const table = el('div', { class: 'c7-codes', role: 'status' });
    const rate = readout();
    const sh = shell({ vf, ctrls: [outSw.row, table, fmtSw.row, outCard.row, rate], defis: [
      'Mesure un blanc puis un noir de la mire (clic sur l\'image) : Cb et Cr restent près de 512, il n\'y a presque pas de couleur ; seul Y\' change.',
      'Passe la caméra en barres (OUTPUT : BARS) et pointe la barre rouge : Y\' = 204, Cb = 435, Cr = 848.',
      'La production demande du 1080p50 : choisis le format, et la carte de sorties de la CCU qui peut le porter.',
    ] });
    let px = null;
    function pick() {
      const img = vf.image(); if (!img) return null;
      const x = clamp(Math.round(st.px), 0, img.width - 1), y = clamp(Math.round(st.py), 0, img.height - 1), i = (y * img.width + x) * 4;
      return [img.data[i] / 255, img.data[i + 1] / 255, img.data[i + 2] / 255];
    }
    vf.onFrame(() => { px = pick(); show(); });
    vf.canvas.addEventListener('click', (e) => { const r = vf.canvas.getBoundingClientRect(); st.px = (e.clientX - r.left) / r.width * 640; st.py = (e.clientY - r.top) / r.height * 360; up(); });
    vf.canvas.addEventListener('keydown', (e) => {
      const d = e.shiftKey ? 20 : 4, k = e.key;
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(k)) return;
      e.preventDefault();
      st.px = clamp(st.px + (k === 'ArrowRight' ? d : k === 'ArrowLeft' ? -d : 0), 0, 639); st.py = clamp(st.py + (k === 'ArrowDown' ? d : k === 'ArrowUp' ? -d : 0), 0, 359); up();
    });
    const overlay = (g) => { g.strokeStyle = '#ffb020'; g.lineWidth = 2; g.beginPath(); g.arc(st.px, st.py, 7, 0, Math.PI * 2); g.moveTo(st.px - 14, st.py); g.lineTo(st.px - 4, st.py); g.moveTo(st.px + 4, st.py); g.lineTo(st.px + 14, st.py); g.moveTo(st.px, st.py - 14); g.lineTo(st.px, st.py - 4); g.moveTo(st.px, st.py + 4); g.lineTo(st.px, st.py + 14); g.stroke(); };
    function olivier(c) {
      const f = FORMATS[st.fmt];
      if (defis[2]) return `1080p50 : ${fr(sdiRate('1080p50') / 1e9, 2)} Gb/s, du 3G-SDI (ST 424) : la carte 3G/4K/HD. La carte HD/SD plafonne au HD-SDI, 1,485 Gb/s.`;
      if (defis[1]) {
        if (st.fmt !== '1080p50') return `${st.fmt} : ${fr(sdiRate(st.fmt) / 1e9, 3)} Gb/s, du ${f.sdi}. Choisis 1080p50.`;
        return st.out === 'hd' ? `1080p50 demande ${fr(sdiRate('1080p50') / 1e9, 2)} Gb/s : trop pour une sortie HD-SDI (1,485 Gb/s). L'autre carte.` : '';
      }
      if (defis[0]) {
        if (!st.bars) return 'Passe OUTPUT sur BARS : les barres à 75 % ont des codes connus, qu\'on vérifie à l\'instrument.';
        return c ? `Y' ${c[0]}, Cb ${c[1]}, Cr ${c[2]}. La barre rouge est la sixième en partant de la gauche.` : 'Pointe une barre.';
      }
      if (st.bars) return 'Repasse sur CAM : le premier défi se fait sur l\'image de la mire.';
      if (st.seenW && !st.seenK) return 'Le blanc : Y\' vers 880, Cb et Cr près de 512 (le carton de la mire est à peine crème : Cb un peu sous 512). Pointe maintenant un noir : une branche de l\'étoile.';
      if (st.seenK && !st.seenW) return 'Un noir : Y\' bas, vers 64, Cb et Cr toujours près de 512. Pointe maintenant le blanc de la mire.';
      return 'Clique sur l\'image (ou les flèches du clavier) : la croix mesure le point, ses trois valeurs et leurs codes sur 10 bits.';
    }
    function show() {
      const yc = px ? ycbcr(px[0], px[1], px[2]) : null;
      const c = yc ? codes10(yc[0], yc[1], yc[2]) : null;
      if (c && !st.bars) {
        const neutral = Math.abs(c[1] - 512) <= 12 && Math.abs(c[2] - 512) <= 12;
        if (neutral && c[0] >= 800) st.seenW = true;
        if (neutral && c[0] <= 140) st.seenK = true;
      }
      if (!defis[0] && st.seenW && st.seenK) defis[0] = true;
      if (defis[0] && !defis[1] && st.bars && c && Math.abs(c[0] - 204) <= 2 && Math.abs(c[1] - 435) <= 2 && Math.abs(c[2] - 848) <= 2) defis[1] = true;
      if (defis[1] && !defis[2] && st.fmt === '1080p50' && st.out === '3g') defis[2] = true;
      if (px) {
        const [y, cb, cr] = ycbcr(px[0], px[1], px[2]);
        const hex = (v) => v.toString(16).toUpperCase().padStart(3, '0');
        table.replaceChildren(
          el('div', {}, el('b', {}, 'R\' G\' B\''), el('span', {}, px.map((v) => fr(v * 100, 1) + ' %').join(' · '))),
          el('div', {}, el('b', {}, 'Y\' Cb Cr'), el('span', {}, `${fr(y, 3)} · ${sgn(cb, 3)} · ${sgn(cr, 3)}`)),
          el('div', {}, el('b', {}, '10 bits'), el('span', { class: 'c7-big' }, `Y' ${c[0]} · Cb ${c[1]} · Cr ${c[2]}`)),
          el('div', {}, el('b', {}, 'Dans le SDI'), el('span', {}, `… Cb ${hex(c[1])} · Y' ${hex(c[0])} · Cr ${hex(c[2])} · Y' … (hexadécimal)`)));
      }
      const f = FORMATS[st.fmt], r = sdiRate(st.fmt);
      rate.textContent = `${st.fmt} : ${f.w.toLocaleString('fr-FR')} × ${f.h.toLocaleString('fr-FR')} × ${f.fps} images × 2 mots × 10 bits = ${fr(r / 1e9, 3)} Gb/s, du ${f.sdi} (SMPTE ${f.norme}), dont ${f.act} utiles. ${st.out === 'hd' && f.sdi === '3G-SDI' ? 'La carte HD/SD ne le porte pas.' : 'La carte ' + (st.out === 'hd' ? 'HD/SD' : '3G/4K/HD') + ' le porte.'}`;
      sh.done(defis); sh.say(olivier(c));
    }
    function up() {
      const o = rings.read();
      vf.draw({ f: o.f, dF: o.dF, N: o.N, light: 0.5, scene: st.bars ? 'bars' : 'mire', osd: false, overlay });
      send(ctx, lensState(st, o, { light: 0.5, bars: st.bars }));
      show();
    }
    sh.node.append(btnRow(linkBtn('Recommencer', () => { Object.assign(st, { bars: false, fmt: '1080i50', out: 'hd', px: 320, py: 70, seenW: false, seenK: false }); outSw.mark('CAM'); fmtSw.mark('1080i50'); outCard.mark('hd'); defis.fill(false); up(); })));
    up();
    return { node: sh.node, dispose: () => vf.dispose() };
  },

  // =================================================================================
  /** le line-up : raccorder la CAM 2 sur la CAM 1, en écran partagé, à la parade et au vecteurscope */
  lineup(ctx) {
    const L1 = 0.2247, L2 = L1 * Math.SQRT2; // la CAM 2 reçoit un demi-diaphragme de plus
    const CAST = [1.08, 1, 0.9], BLACK0 = [0.025, 0.018, 0.008], SAT0 = 1.22;
    const cam1 = { E: exposureOf(4) * L1, wb: [1, 1, 1], black: [0.01, 0.01, 0.01], sat: 1 };
    const st0 = () => ({ mb: 0, bR: 0, bB: 0, wR: 0, wB: 0, n: irisPos(4), s: 100 });
    const st = st0();
    const lens = { z: zoomPos(20), s: pointPos(MIRE_D), n: irisPos(4), nd: 1 };
    const defis = [false, false, false];
    let msg = '';
    const cam2 = () => ({ E: exposureOf(irisN(st.n)) * L2, wb: [CAST[0] * (1 + st.wR / 100), 1, CAST[2] * (1 + st.wB / 100)], black: [BLACK0[0] + (st.mb + st.bR) / 100, BLACK0[1] + st.mb / 100, BLACK0[2] + (st.mb + st.bB) / 100], sat: SAT0 * st.s / 100 });
    const view = cnv(640, 360); view.className = 'cl-vfc c7-split'; view.setAttribute('role', 'img');
    const parade = scopeCanvas(); parade.setAttribute('aria-label', 'Parade R, V, B : moitié gauche de chaque voie la CAM 1, moitié droite la CAM 2');
    const vec = cnv(240, 240); vec.className = 'c7-vec'; vec.setAttribute('role', 'img');
    const abb = el('button', { type: 'button', class: 'btn small', onclick: () => { st.bR = (BLACK0[1] - BLACK0[0]) * 100; st.bB = (BLACK0[1] - BLACK0[2]) * 100; sync(); msg = 'ABB : iris fermé, les noirs R et B sont posés sur le noir V. Il reste à mettre le niveau au master black.'; up(); } }, 'ABB (noirs auto)');
    const awb = el('button', { type: 'button', class: 'btn small', onclick: () => { st.wR = (1 / CAST[0] - 1) * 100; st.wB = (1 / CAST[2] - 1) * 100; sync(); msg = 'WHITE : la balance des blancs sur la charte. Le gris est neutre ; reste à l\'amener au niveau de la CAM 1.'; up(); } }, 'WHITE (balance auto)');
    const S = {
      mb: slider('M.BLK (manche)', -5, 5, 0.1, st.mb, (v) => { st.mb = v; up(); }),
      bR: slider('BLACK R', -3, 3, 0.1, st.bR, (v) => { st.bR = v; up(); }),
      bB: slider('BLACK B', -3, 3, 0.1, st.bB, (v) => { st.bB = v; up(); }),
      wR: slider('WHITE R', -20, 20, 0.5, st.wR, (v) => { st.wR = v; up(); }),
      wB: slider('WHITE B', -20, 20, 0.5, st.wB, (v) => { st.wB = v; up(); }),
      n: slider('Iris (manche)', 0, 0.96, 0.001, st.n, (v) => { st.n = v; up(); }),
      s: slider('SATURATION (P06)', 50, 150, 1, st.s, (v) => { st.s = v; up(); }),
    };
    const sync = () => { for (const k of Object.keys(S)) S[k].set(st[k]); };
    const read = el('div', { class: 'c7-codes', role: 'status' });
    const sh = shell({ vf: { canvas: view }, ctrls: [el('p', { class: 'cl-hint' }, 'Le RCP de la CAM 2. La CAM 1, à gauche, est la référence : on n\'y touche pas.'), btnRow(abb, awb), ...Object.values(S).map((x) => x.row), read], defis: [
      'Les noirs : le même noir que la CAM 1 sur les trois voies, à 0,5 point près (le trou noir de la charte).',
      'Les blancs et l\'exposition : le gris de la CAM 2 neutre et au niveau de celui de la CAM 1, à 1 point près sur chaque voie.',
      'Les couleurs : au vecteurscope, les pastilles de la CAM 2 sur celles de la CAM 1, sans défaire le reste.',
    ] });
    sh.screen.append(el('div', { class: 'c7-scopes' }, el('div', { class: 'c7-sc' }, parade), el('div', { class: 'c7-sc' }, vec)));
    const toPx = (v) => Math.round(clamp(v, 0, 1) * 255);
    const rgb = (v) => `rgb(${toPx(v[0])},${toPx(v[1])},${toPx(v[2])})`;
    function drawChart(g, x0, c, name) {
      g.fillStyle = rgb(camSignal(CHARTE.board, c)); g.fillRect(x0, 0, 320, 360);
      const top = [['noir', CHARTE.noir, 20], ['gris 18 %', CHARTE.gris, 116], ['blanc', CHARTE.blanc, 212]];
      for (const [t, refl, x] of top) { g.fillStyle = rgb(camSignal(/** @type {number[]} */ (refl), c)); g.fillRect(x0 + Number(x), 40, 88, 110); g.fillStyle = '#c9cdc5'; g.font = '600 12px "B612 Mono", monospace'; g.textAlign = 'center'; g.fillText(String(t), x0 + Number(x) + 44, 166); }
      CHARTE.colors.forEach(([t, refl], i) => { const x = x0 + 17 + i * 50; g.fillStyle = rgb(camSignal(refl, c)); g.fillRect(x, 190, 44, 110); g.fillStyle = '#c9cdc5'; g.fillText(t, x + 22, 316); });
      g.fillStyle = '#e8e8e2'; g.textAlign = 'left'; g.font = '700 14px "B612 Mono", monospace'; g.fillText(name, x0 + 10, 22);
    }
    function drawVec(g, c1, c2) {
      const W = 240, cx = W / 2, cy = W / 2, R = 108, k = R / 0.5;
      g.fillStyle = '#05070a'; g.fillRect(0, 0, W, W);
      g.strokeStyle = 'rgba(120,200,160,0.25)'; g.lineWidth = 1; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.moveTo(cx - R, cy); g.lineTo(cx + R, cy); g.moveTo(cx, cy - R); g.lineTo(cx, cy + R); g.stroke();
      // les cibles des barres à 75 %
      g.font = '600 10px "B612 Mono", monospace'; g.textAlign = 'center';
      for (const [n, v] of [['R', [0.75, 0, 0]], ['Yl', [0.75, 0.75, 0]], ['G', [0, 0.75, 0]], ['Cy', [0, 0.75, 0.75]], ['B', [0, 0, 0.75]], ['Mg', [0.75, 0, 0.75]]]) {
        const [, cb, cr] = ycbcr(v[0], v[1], v[2]), x = cx + cb * k, y = cy - cr * k;
        g.strokeStyle = 'rgba(150,210,180,0.5)'; g.strokeRect(x - 5, y - 5, 10, 10); g.fillStyle = 'rgba(150,210,180,0.75)'; g.fillText(String(n), x + (cb > 0 ? 14 : -14), y + 4);
      }
      CHARTE.colors.forEach(([, refl]) => {
        const a = cbcr(camSignal(refl, c1)), b = cbcr(camSignal(refl, c2));
        const ax = cx + a[0] * k, ay = cy - a[1] * k, bx = cx + b[0] * k, by = cy - b[1] * k;
        g.strokeStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
        g.fillStyle = '#7fd3f3'; g.beginPath(); g.arc(ax, ay, 4, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#ffb020'; g.lineWidth = 2; g.beginPath(); g.arc(bx, by, 5.5, 0, Math.PI * 2); g.stroke(); g.lineWidth = 1;
      });
      const gr = cbcr(camSignal(CHARTE.gris, c2));
      g.strokeStyle = '#ffb020'; g.beginPath(); g.arc(cx + gr[0] * k, cy - gr[1] * k, 3, 0, Math.PI * 2); g.stroke();
      g.textAlign = 'left'; g.fillStyle = '#7fd3f3'; g.fillText('● CAM 1', 6, W - 20); g.fillStyle = '#ffb020'; g.fillText('○ CAM 2', 6, W - 7);
      g.textAlign = 'right'; g.fillStyle = 'rgba(150,210,180,0.6)'; g.fillText('vecteurscope', W - 4, W - 7);
    }
    const tri = (v) => v.map((x) => fr(x * 100, 1)).join(' / ');
    function olivier(gp) {
      if (msg) return msg;
      if (defis[2]) return 'Raccordée : même noir, même gris, mêmes couleurs. À la coupe, on ne voit plus que l\'angle qui change. La CAM 1 n\'a pas bougé : c\'est la référence.';
      const nmax = Math.max(...gp.noir.map(Math.abs)), gmax = Math.max(...gp.gris.map(Math.abs));
      if (defis[1]) return gp.col > 0.012 ? `Les pastilles de la CAM 2 sont plus loin du centre : ses couleurs sont plus vives (écart ${fr(gp.col, 3)}, pastille ${gp.colName}). Baisse la saturation, page P06.` : (nmax > 0.005 || gmax > 0.01 ? 'Les couleurs sont bonnes, mais le noir ou le gris a bougé : reprends-les.' : '');
      if (defis[0]) {
        const g = gp.gris;
        if (Math.abs(g[0] - g[1]) > 0.01 || Math.abs(g[2] - g[1]) > 0.01) return `Le gris de la CAM 2 n'est pas neutre : R ${sgn(g[0] * 100)}, B ${sgn(g[2] * 100)} points par rapport à la CAM 1. La balance des blancs (WHITE), puis les boutons WHITE R et B pour finir.`;
        return `Gris neutre, mais ${g[1] > 0 ? 'plus clair' : 'plus sombre'} que celui de la CAM 1 de ${fr(Math.abs(g[1]) * 100, 1)} points : c'est l'exposition, l'iris de la CAM 2.`;
      }
      const n = gp.noir;
      if (Math.abs(n[0] - n[1]) > 0.005 || Math.abs(n[2] - n[1]) > 0.005) return `Les noirs de la CAM 2 ne sont pas égaux entre eux (R ${sgn(n[0] * 100)}, V ${sgn(n[1] * 100)}, B ${sgn(n[2] * 100)} points par rapport à la CAM 1) : la balance des noirs d'abord (ABB), ou les boutons BLACK R et B.`;
      return `Les trois noirs de la CAM 2 sont égaux, mais ${n[1] > 0 ? 'plus hauts' : 'plus bas'} que ceux de la CAM 1 de ${fr(Math.abs(n[1]) * 100, 1)} point : le master black, au manche.`;
    }
    function up() {
      const c2 = cam2(), gp = lineupGaps(cam1, c2);
      const nOk = gp.noir.every((d) => Math.abs(d) <= 0.005), gOk = gp.gris.every((d) => Math.abs(d) <= 0.01);
      if (!defis[0] && nOk) defis[0] = true;
      if (defis[0] && !defis[1] && nOk && gOk) defis[1] = true;
      if (defis[1] && !defis[2] && nOk && gOk && gp.col <= 0.012) defis[2] = true;
      const g = view.getContext('2d', { willReadFrequently: true });
      drawChart(g, 0, cam1, 'CAM 1'); drawChart(g, 320, c2, 'CAM 2');
      g.fillStyle = '#05070a'; g.fillRect(319, 0, 2, 360);
      drawScope(parade, g.getImageData(0, 0, 640, 360), 'parade');
      drawVec(vec.getContext('2d'), cam1, c2);
      for (const k of ['mb', 'bR', 'bB']) S[k].out.textContent = sgn(st[k]) + ' %';
      for (const k of ['wR', 'wB']) S[k].out.textContent = sgn(st[k], 1) + ' %';
      S.n.out.textContent = 'f/' + fr(irisN(st.n), 2); S.s.out.textContent = Math.round(st.s) + ' %';
      const s1 = (r) => camSignal(r, cam1), s2 = (r) => camSignal(r, c2);
      read.replaceChildren(
        el('div', {}, el('b', {}, 'Noir R/V/B'), el('span', { class: nOk ? 'ok' : '' }, `CAM 1 ${tri(s1(CHARTE.noir))} · CAM 2 ${tri(s2(CHARTE.noir))} %`)),
        el('div', {}, el('b', {}, 'Gris R/V/B'), el('span', { class: gOk ? 'ok' : '' }, `CAM 1 ${tri(s1(CHARTE.gris))} · CAM 2 ${tri(s2(CHARTE.gris))} %`)),
        el('div', {}, el('b', {}, 'Couleurs'), el('span', { class: gp.col <= 0.012 ? 'ok' : '' }, `écart le plus grand ${fr(gp.col, 3)} (pastille ${gp.colName}), toléré 0,012`)));
      view.setAttribute('aria-label', `Écran partagé : la charte vue par la CAM 1 à gauche, par la CAM 2 à droite. Gris CAM 2 : ${tri(s2(CHARTE.gris))} %`);
      vec.setAttribute('aria-label', `Vecteurscope : pastilles de la CAM 1 (points) et de la CAM 2 (cercles), écart le plus grand ${fr(gp.col, 3)}`);
      sh.done(defis); sh.say(olivier(gp));
      msg = '';
      send(ctx, lensState(lens, { f: 20, dF: MIRE_D, N: irisN(st.n) }, { iris: irisN(st.n), light: 0.5 * c2.E / cam1.E, wb: /** @type {[number, number, number]} */ ([c2.wb[0], 1, c2.wb[2]]) }));
    }
    sh.node.append(btnRow(linkBtn('Recommencer', () => { Object.assign(st, st0()); sync(); defis.fill(false); msg = ''; up(); })));
    up();
    return { node: sh.node, dispose() {} };
  },
};

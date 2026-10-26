// @ts-check
import * as THREE from 'three';
import { S, camById } from '../state.js';
import { fmt, clamp } from '../util.js';
import { Builder } from '../geo.js';
import { matiere } from '../matiere.js';
import { tallyOf } from '../pipeline.js';
import { ND_FILTERS } from '../data/exposure.js';
import { keyField, canvasPlane, rr, txt } from './kit.js';

// ----------------------------------------------------------------------------------
// La rangée de RCP du bureau vision, en 3D : un pupitre de commande de caméra (type Sony RCP-3500) par
// caméra, six devant l'ingénieur vision 1 (CAM 1 à 6), dix devant l'ingénieur vision 2 (CAM 7 à 16), un MSU
// (pupitre maître, décor) entre les deux. Chaque RCP porte, de l'arrière vers l'opérateur : les voyants
// TALLY et CALL, l'écran tactile, les neuf touches assignables, les molettes WHITE (R, G, B), AWB / ABB /
// FLARE, les molettes BLACK, les touches de fonction, puis le joystick (pousser = ouvrir l'iris, tourner
// la bague = master black). Tout suit l'état réel des caméras (updateRcp3D).
// Ce fichier n'est que le matériel ; le poste en vue 3D est dans poste3d/vision.js.
// Dimensions d'un RCP : ordre de grandeur (environ 10 × 36 cm), disposition simplifiée.
// Repère du plateau (top) : x vers la droite de l'opérateur, z vers lui, y vers le haut, au dessus des RCP.
// ----------------------------------------------------------------------------------
export const RCPW = 0.098, RCPD = 0.36, RCPH = 0.035, PITCH = 0.104;
/** emplacements : la caméra n est au RCP n − 1 ; groupe A (CAM 1 à 6) puis groupe B (CAM 7 à 16) */
export const N_RCP = 16;
const GA = { cx: -0.97, n: 6 }, GB = { cx: 0.73, n: 10 };
export const unitX = (i) => (i < GA.n ? GA.cx + (i - (GA.n - 1) / 2) * PITCH : GB.cx + (i - GA.n - (GB.n - 1) / 2) * PITCH);
/** touches d'un RCP : libellé, x, z (repère du RCP), couleur allumée, sorte */
export const RCP_KEYS = [
  ...['DETAIL', 'KNEE', 'GAMMA', 'MATRIX', 'BLK GAM', 'SKIN DTL', 'ND ▲', 'ND ▼', 'ZEBRA'].map((l, k) => ({ l, x: (k % 3 - 1) * 0.03, z: -0.040 + Math.floor(k / 3) * 0.017, color: 0xffb030, kind: 'assign' })),
  { l: 'AWB', x: -0.03, z: 0.036, color: 0xe8ecf2, kind: 'awb' }, { l: 'ABB', x: 0, z: 0.036, color: 0xe8ecf2, kind: 'abb' }, { l: 'FLARE', x: 0.03, z: 0.036, color: 0xffb030, kind: 'flare' },
  { l: 'CALL', x: -0.03, z: 0.082, color: 0xffb030, kind: 'call' }, { l: 'BARS', x: 0, z: 0.082, color: 0x50b0ff, kind: 'bars' }, { l: 'CAM PW', x: 0.03, z: 0.082, color: 0x38e070, kind: 'campw' },
  { l: 'PANEL ACTIVE', x: -0.03, z: 0.1, color: 0x38e070, kind: 'active' }, { l: 'PREVIEW', x: 0, z: 0.1, color: 0xe8ecf2, kind: 'preview' }, { l: 'AUTO IRIS', x: 0.03, z: 0.1, color: 0xffb030, kind: 'auto' },
  { l: 'CLOSE', x: -0.03, z: 0.118, color: 0xff3a30, kind: 'close' },
];
const KW = 0.026, KD = 0.012;
const LEGEND = { 'PANEL ACTIVE': 'PANEL\nACTIVE', 'AUTO IRIS': 'AUTO\nIRIS', 'SKIN DTL': 'SKIN\nDTL', 'BLK GAM': 'BLK\nGAM', 'CAM PW': 'CAM\nPW' };
/** molettes : WHITE R G B (z 0.014), BLACK R G B (z 0.058) ; puis la bague du joystick */
export const KNOB_Z = { white: 0.014, black: 0.058 };
export const JOY = { z0: 0.172, z1: 0.128, zc: 0.15, r: 0.028 }; // course du joystick : z0 iris fermé → z1 ouvert
export const LCD = { z: -0.09, w: 0.08, d: 0.058 };

/** @type {{ grp: THREE.Group | null, top: THREE.Object3D | null, keys: any, knobs: any, marks: any, sticks: any, rings: any, leds: any, lcds: any[], sig: string[], t: number, hot: number, sel: number }} */
export const RCPS = { grp: null, top: null, keys: null, knobs: null, marks: null, sticks: null, rings: null, leds: null, lcds: [], sig: [], t: 0, hot: -1, sel: -1 };

export function buildRcp3D(scene, pos, rotY = 0) {
  const grp = new THREE.Group(); grp.name = 'pupitres-rcp'; grp.position.copy(pos); grp.rotation.y = rotY;
  const deck = new THREE.Object3D(); deck.position.set(0, 0.03, 0); deck.rotation.x = 0.12; grp.add(deck);
  const top = new THREE.Object3D(); top.position.set(0, RCPH, 0); deck.add(top);
  RCPS.grp = grp; RCPS.top = top;
  // boîtiers des RCP, socle incliné, MSU : plastique ; flancs : aluminium (occlusion cuite)
  const Bc = new Builder({ ao: 0.05, aoOpts: { dist: 0.1, strength: 0.9, floor: 0.35 } });
  const Ba = new Builder({ ao: 0.05, aoOpts: { dist: 0.1, strength: 0.9, floor: 0.35 } });
  for (const g of [GA, GB]) { const w = g.n * PITCH + 0.03; Bc.cbox(w, 0.05, RCPD + 0.04, g.cx, -0.025, 0, 0x1a1d21, 0.006); }
  for (let i = 0; i < N_RCP; i++) {
    const x = unitX(i);
    Bc.cbox(RCPW, RCPH, RCPD, x, RCPH / 2, 0, 0x2b3036, 0.006);
    Bc.cbox(LCD.w + 0.008, 0.004, LCD.d + 0.008, x, RCPH + 0.002, LCD.z, 0x0b0d10, 0.002); // cadre de l'écran
    Bc.cyl(JOY.r + 0.004, JOY.r + 0.006, 0.01, x, RCPH + 0.005, JOY.zc, 0x0c0d0f, 20); // embase du joystick
    Ba.box(0.004, RCPH + 0.004, RCPD, x - RCPW / 2 + 0.002, RCPH / 2, 0, 0x8c939b);
  }
  // MSU (pupitre maître) entre les deux groupes : décor
  Bc.cbox(0.3, 0.06, RCPD, -0.2, 0.03, 0, 0x262b31, 0.008);
  for (let k = 0; k < 12; k++) Bc.cbox(0.05, 0.008, 0.03, -0.31 + (k % 4) * 0.072, 0.064, -0.1 + Math.floor(k / 4) * 0.05, k === 0 ? 0xe0b030 : 0x3a4047, 0.003);
  const body = Bc.mesh(matiere('plastique', { seed: 31, scale: 0.12, strength: 0.6, roughness: 0.62, name: 'pupitres-rcp-boitiers' })); body.name = 'pupitres-rcp-boitiers';
  const alu = Ba.mesh(matiere('alu', { seed: 32, scale: 0.2, strength: 0.6, name: 'pupitres-rcp-alu' })); alu.name = 'pupitres-rcp-alu';
  deck.add(body, alu);
  // écran du MSU
  const msu = canvasPlane(deck, 0.26, 0.09, -0.2, 0.11, 0.0605, 256, 90, { lit: true, name: 'pupitres-rcp-msu' });
  msu.g.fillStyle = '#0d2338'; msu.g.fillRect(0, 0, 256, 90); txt(msu.g, 'MSU · MASTER SETUP', 128, 30, 22, '#9ed0ff'); txt(msu.g, 'ALL CAM', 128, 62, 18, '#6fa8dc', 'center', 500); msu.dirty();
  // touches de tous les RCP : un seul champ instancié
  const keys = [];
  for (let i = 0; i < N_RCP; i++) for (const k of RCP_KEYS) keys.push({ x: unitX(i) + k.x, z: k.z, w: KW, d: KD, h: 0.007, color: k.color, legend: LEGEND[k.l] || k.l, u: i, key: k });
  RCPS.keys = keyField(top, keys, { name: 'pupitres-rcp-touches' });
  // molettes WHITE et BLACK : corps sombres, repère de couleur qui tourne avec la valeur
  const nK = N_RCP * 6;
  const kmat = matiere('plastique', { seed: 33, scale: 0.05, strength: 0.5, roughness: 0.5, vertexColors: false, color: 0x15171a, name: 'pupitres-rcp-molettes' });
  RCPS.knobs = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.0085, 0.0095, 0.014, 18), kmat, nK); RCPS.knobs.name = 'pupitres-rcp-molettes';
  const markGeo = new THREE.BoxGeometry(0.0024, 0.001, 0.0075); markGeo.translate(0, 0, -0.0045);
  RCPS.marks = new THREE.InstancedMesh(markGeo, new THREE.MeshBasicMaterial({ toneMapped: false }), nK + N_RCP); RCPS.marks.name = 'pupitres-rcp-reperes';
  // joystick : manche et bague (master black)
  const Bj = new Builder();
  Bj.cyl(0.0045, 0.0055, 0.05, 0, 0.025, 0, 0x2a2d31, 10); Bj.sphere(0.012, 0, 0.055, 0, 0x14161a, 16);
  RCPS.sticks = new THREE.InstancedMesh(Bj.build(), matiere('plastique', { seed: 34, scale: 0.05, strength: 0.4, roughness: 0.4, name: 'pupitres-rcp-joysticks' }), N_RCP); RCPS.sticks.name = 'pupitres-rcp-joysticks';
  RCPS.rings = new THREE.InstancedMesh(new THREE.CylinderGeometry(JOY.r, JOY.r, 0.012, 28, 1, true), kmat, N_RCP); RCPS.rings.name = 'pupitres-rcp-bagues';
  // voyants TALLY et CALL
  RCPS.leds = new THREE.InstancedMesh(new THREE.BoxGeometry(0.02, 0.003, 0.008), new THREE.MeshBasicMaterial({ toneMapped: false }), N_RCP * 2); RCPS.leds.name = 'pupitres-rcp-voyants';
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < N_RCP; i++) {
    const x = unitX(i);
    for (let j = 0; j < 6; j++) { m4.makeTranslation(x + (j % 3 - 1) * 0.03, 0.007, j < 3 ? KNOB_Z.white : KNOB_Z.black); RCPS.knobs.setMatrixAt(i * 6 + j, m4); RCPS.marks.setColorAt(i * 6 + j, new THREE.Color([0xff4040, 0x40d060, 0x4080ff][j % 3])); }
    RCPS.marks.setColorAt(nK + i, new THREE.Color(0xffb030));
    m4.makeTranslation(x, 0.006, JOY.zc); RCPS.rings.setMatrixAt(i, m4);
    for (let j = 0; j < 2; j++) { m4.makeTranslation(x + (j ? 0.03 : -0.03), 0.0015, -0.155); RCPS.leds.setMatrixAt(i * 2 + j, m4); RCPS.leds.setColorAt(i * 2 + j, new THREE.Color(0x200808)); }
  }
  top.add(RCPS.knobs, RCPS.marks, RCPS.sticks, RCPS.rings, RCPS.leds);
  // écrans tactiles
  RCPS.lcds = []; RCPS.sig = [];
  for (let i = 0; i < N_RCP; i++) { RCPS.lcds.push(canvasPlane(top, LCD.w, LCD.d, unitX(i), LCD.z, 0.0045, 256, 186, { lit: true, name: 'pupitres-rcp-ecran' })); RCPS.sig.push(''); }
  scene.add(grp);
  updateRcp3D(0, true);
  return grp;
}

const col = new THREE.Color(), m4b = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), P = new THREE.Vector3(), ONE = new THREE.Vector3(1, 1, 1);
/** la caméra du RCP i (ou null) */
export const camOfUnit = (i) => camById(i + 1);
/** position du joystick (0 fermé, 1 ouvert) : en échelle de diaphragmes, de F22 à F1,4 */
export const irisPos = (c) => clamp(1 - Math.log(c.paint.iris / 1.4) / Math.log(22 / 1.4), 0, 1);
/** valeurs des molettes ramenées à 0..1 (−99..+99) */
const knobN = (v) => clamp(((v || 0) + 99) / 198, 0, 1);
const KNOB_KEYS = ['wbR', 'wbG', 'wbB'];
/** l'état allumé d'une touche (0, 0,5, 1) */
export function keyLit(c, k) {
  if (!c) return 0;
  const p = c.paint;
  switch (k.kind) {
    case 'assign': { const prop = { DETAIL: 'detailOn', KNEE: 'kneeOn', GAMMA: 'gammaOn', MATRIX: 'matrixOn' }[k.l]; return prop ? (p[prop] ? 1 : 0) : k.l === 'BLK GAM' ? (p.blackGamma ? 1 : 0) : 0; }
    case 'flare': return S.rcpFlare ? 1 : 0;
    case 'call': return S.time - (p.call || -99) < 3 ? 1 : 0;
    case 'bars': return p.bars ? 1 : 0;
    case 'campw': return c.powerOn !== false ? 1 : 0;
    case 'active': return c.panelActive !== false ? 1 : 0;
    case 'preview': return S.selCam === c.id ? 0.5 : 0;
    case 'auto': return p.autoIris ? 1 : 0;
    case 'close': return p.irisClose ? 1 : 0;
    default: return 0;
  }
}

export function updateRcp3D(dt, force = false) {
  if (!RCPS.grp) return;
  RCPS.t += dt; if (!force && RCPS.t < 0.1) return; RCPS.t = 0;
  const F = RCPS.keys;
  const nK = N_RCP * 6;
  F.keys.forEach((k, idx) => { const c = camOfUnit(k.u); F.set(idx, keyLit(c, k.key)); });
  F.flush();
  for (let i = 0; i < N_RCP; i++) {
    const c = camOfUnit(i); const x = unitX(i);
    // molettes : le repère tourne de −135° à +135°
    for (let j = 0; j < 6; j++) {
      const v = c ? (j < 3 ? c.paint[KNOB_KEYS[j]] : (S.rcpFlare ? c.paint['flare' + 'RGB'[j - 3]] : c.paint[['blackR', 'blackG', 'blackB'][j - 3]])) : 0;
      Q.setFromEuler(E.set(0, -(knobN(v) - 0.5) * 1.5 * Math.PI, 0));
      m4b.compose(P.set(x + (j % 3 - 1) * 0.03, 0.0142, j < 3 ? KNOB_Z.white : KNOB_Z.black), Q, ONE); RCPS.marks.setMatrixAt(i * 6 + j, m4b);
    }
    // bague (master black) et manche (iris)
    Q.setFromEuler(E.set(0, -(knobN(c ? c.paint.mblack : 0) - 0.5) * 1.5 * Math.PI, 0));
    m4b.compose(P.set(x, 0.0125, JOY.zc), Q, ONE); m4b.multiply(new THREE.Matrix4().makeTranslation(0, 0, -JOY.r + 0.004)); RCPS.marks.setMatrixAt(nK + i, m4b);
    const ip = c ? irisPos(c) : 0;
    Q.setFromEuler(E.set(-(ip - 0.5) * 0.6, 0, 0));
    m4b.compose(P.set(x, 0.006, JOY.z0 + (JOY.z1 - JOY.z0) * ip), Q, ONE); RCPS.sticks.setMatrixAt(i, m4b);
    // voyants : tally rouge (à l'antenne), CALL ambre (appel)
    const t = c ? tallyOf('CAM' + c.id) : 0;
    RCPS.leds.setColorAt(i * 2, col.setHex(t === 2 ? 0xff2a20 : 0x200808));
    RCPS.leds.setColorAt(i * 2 + 1, col.setHex(c && S.time - (c.paint.call || -99) < 3 && Math.floor(S.time * 4) % 2 ? 0xffb020 : 0x201808));
    drawLcd(i, c, t);
  }
  RCPS.marks.instanceMatrix.needsUpdate = true; RCPS.sticks.instanceMatrix.needsUpdate = true;
  if (RCPS.leds.instanceColor) RCPS.leds.instanceColor.needsUpdate = true;
}
function drawLcd(i, c, t) {
  const sel = S.selCam != null && c && S.selCam === c.id;
  const sig = c ? [c.id, c.T.short, fmt(c.effAperture(), 1), c.paint.irisClose, c.paint.gain, c.paint.nd, t, sel, c.powerOn !== false, c.panelActive !== false, c.paint.bars, c.paint.autoIris].join('|') : '—';
  if (sig === RCPS.sig[i]) return; RCPS.sig[i] = sig;
  const o = RCPS.lcds[i], g = o.g, W = o.c.width, H = o.c.height;
  g.fillStyle = c ? (sel ? '#0e2a46' : '#0a1828') : '#050608'; g.fillRect(0, 0, W, H);
  if (!c) { txt(g, `RCP ${i + 1}`, W / 2, H / 2 - 12, 26, '#2a3440'); txt(g, 'pas de caméra', W / 2, H / 2 + 18, 18, '#2a3440', 'center', 500); o.dirty(); return; }
  if (t) { g.fillStyle = t === 2 ? '#c81e18' : '#178a3a'; g.fillRect(0, 0, W, 34); }
  txt(g, `CAM ${c.id}`, 12, 18, 26, '#fff', 'left', 700); txt(g, t === 2 ? 'ON AIR' : t === 1 ? 'PVW' : c.T.short, W - 12, 18, 20, '#e8f2ff', 'right', 600);
  if (c.powerOn === false) { txt(g, 'CAM PW OFF', W / 2, 100, 30, '#ff8070'); o.dirty(); return; }
  txt(g, c.paint.irisClose ? 'CLOSE' : 'F' + fmt(c.effAperture(), 1), W / 2, 84, 52, '#ffd070', 'center', 700);
  txt(g, `${c.paint.gain > 0 ? '+' : ''}${c.paint.gain} dB · ND ${ND_FILTERS[c.paint.nd].label.split(' ')[0]}`, W / 2, 128, 21, '#9ed0ff', 'center', 600);
  const st = [c.paint.autoIris && 'AUTO', c.paint.bars && 'BARS', c.panelActive === false && 'LOCK'].filter(Boolean).join(' · ');
  if (st) txt(g, st, W / 2, 158, 19, '#ffb030', 'center', 600);
  if (sel) rr(g, 2, 2, W - 4, H - 4, 6, null, '#5be5ff', 4);
  o.dirty();
}
/** la touche survolée s'éclaire (indice dans le champ de touches, −1 : aucune) */
export function hoverRcpKey(idx) {
  const F = RCPS.keys; if (!F) return;
  const old = F.hot; F.hot = idx;
  for (const k of [old, idx]) if (k >= 0) { F.set(k, -1); F.set(k, keyLit(camOfUnit(F.keys[k].u), F.keys[k].key)); }
  F.flush();
}

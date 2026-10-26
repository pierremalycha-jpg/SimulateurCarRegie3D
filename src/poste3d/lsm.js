// @ts-check
import * as THREE from 'three';
import { S, camById } from '../state.js';
import { clamp, tc, fmt } from '../util.js';
import { Builder } from '../geo.js';
import { matiere } from '../matiere.js';
import { EVS, recordedCams, clipName } from '../pipeline.js';
import { EQUIP } from '../equip.js';
import { keyField, canvasPlane, rr, txt } from './kit.js';

// ----------------------------------------------------------------------------------
// La télécommande LSM du poste ralentis, en 3D (type EVS LSM, logiciel Multicam) : de l'arrière vers
// l'opérateur, l'afficheur (quatre lignes), les touches F1 à F10 (clips de la page), les touches d'angle
// (CAM A à H, les entrées enregistrées), le bloc opérationnel (IN, OUT, PLST, LIVE, PLAY, SHIFT…), et
// les raccourcis du simulateur ; à droite, le levier de vitesse (poussé loin de soi = 100 %) et, devant,
// la molette jog. Tout suit l'état du serveur (updateLsm3D).
// Ce fichier n'est que le matériel ; le poste en vue 3D est dans poste3d/ralentis.js.
// Dimensions : ordre de grandeur (environ 40 × 30 cm), disposition simplifiée (celle du poste à plat).
// Repère du plateau (top) : x vers la droite de l'opérateur, z vers lui, y vers le haut, au dessus du boîtier.
// ----------------------------------------------------------------------------------
export const LSMW = 0.40, LSMD = 0.30, LSMH = 0.04;
/** afficheur, levier (z0 : 100 %, loin de l'opérateur ; z1 : 0 %), molette jog */
export const SCREEN = { x: -0.05, z: -0.118, w: 0.25, d: 0.046 };
export const LEVER = { x: 0.135, z0: -0.125, z1: -0.01 };
export const JOG = { x: 0.118, z: 0.085, r: 0.046 };
const KP = 0.025; // pas des touches F et d'angle
/** les touches : nom (geste de LSMACT), légende, position, taille, couleur ; sorte f (F1–F10), cam (angle), op */
/** @type {any[]} */
export const LSM_KEYS = [
  ...Array.from({ length: 10 }, (_, i) => ({ kind: 'f', i, name: 'F' + (i + 1), legend: 'F' + (i + 1), x: -0.165 + i * KP, z: -0.066, w: 0.021, d: 0.016, color: 0xe8ecf2 })),
  ...Array.from({ length: 8 }, (_, i) => ({ kind: 'cam', i, name: 'CAM ' + 'ABCDEFGH'[i], legend: 'CAM\n' + 'ABCDEFGH'[i], x: -0.165 + i * KP, z: -0.04, w: 0.021, d: 0.018, color: 0x46c6f2 })),
  ...[['IN', 'IN', 0xffb030], ['OUT', 'OUT', 0xffb030], ['PLST', 'PLST', 0xe8ecf2], ['LOOP', 'LOOP', 0xe8ecf2], ['RETURN', 'RET', 0xe8ecf2],
    ['LIVE', 'LIVE\nE/E', 0x46c6f2], ['PLAY', 'PLAY', 0x38e070], ['FAST', 'FAST\nJOG', 0xb080ff], ['TAKE', 'TAKE', 0xe8ecf2], ['PGM', 'PGM\nPRV', 0xe8ecf2],
    ['SHIFT', 'SHIFT', 0xe8ecf2], ['MENU', 'MENU', 0xe8ecf2], ['CLEAR', 'CLEAR', 0xe8ecf2], ['PAGE', 'PAGE', 0xe8ecf2]]
    .map(([name, legend, color], k) => ({ kind: 'op', name, legend, x: -0.155 + (k % 5) * 0.044, z: -0.01 + Math.floor(k / 5) * 0.027, w: 0.038, d: 0.021, color })),
  // raccourcis du simulateur (bande à part, devant à gauche)
  { kind: 'op', name: 'LAST', legend: 'DERN.\nACTION', x: -0.142, z: 0.098, w: 0.06, d: 0.024, color: 0xffb030 },
  { kind: 'op', name: 'REC', legend: 'REC', x: -0.082, z: 0.098, w: 0.04, d: 0.024, color: 0xff3a30 },
  { kind: 'op', name: 'AUTO', legend: 'OPÉ.\nAUTO', x: -0.034, z: 0.098, w: 0.04, d: 0.024, color: 0xb080ff },
];

/** @type {{ grp: THREE.Group | null, top: THREE.Object3D | null, keys: any, lever: THREE.Object3D | null, jog: THREE.Object3D | null, lcd: any, sig: string, t: number, jogA: number, auto: () => boolean }} */
export const LSMS = { grp: null, top: null, keys: null, lever: null, jog: null, lcd: null, sig: '', t: 0, jogA: 0, auto: () => false };

// ---------------- état de la télécommande (commun au poste à plat ui/st_evs.js et à la 3D) ----------------
/** SHIFT enfoncé, mode playlist, boucle, choix de page en attente ; le canal piloté est EVS.lsmCh */
export const LSM = { shift: false, plst: false, loop: false, page: false };
const chI = () => EVS.lsmCh || 0;
const cur = () => EVS.ch[chI()];
/** une touche est-elle allumée ? (même lecture pour les touches 2D et 3D) */
export function lsmKeyOn(k) {
  const c = cur();
  switch (k) {
    case 'LIVE': return c.mode === 'live';
    case 'PLAY': return c.playing && c.speed === 1;
    case 'PLST': return LSM.plst || !!EVS.browse;
    case 'SHIFT': return LSM.shift;
    case 'LOOP': return LSM.loop;
    case 'PAGE': return LSM.page;
    case 'FAST': return !!EVS.fastJog;
    case 'REC': return !!EVS.recording;
    case 'AUTO': return LSMS.auto();
    case 'PGM': return chI() === 1;
    default: return false;
  }
}
/** la lettre d'angle d'une caméra enregistrée */
export const camLetter = (id) => { const i = recordedCams().indexOf(id); return i >= 0 ? 'ABCDEFGH'[i] : '?'; };
/** les quatre lignes de l'afficheur de la télécommande */
export function lsmLines() {
  const c = cur(), live = c.mode === 'live', t = live ? S.simTime : c.t;
  return [
    `PGM${chI() + 1}  CAM ${camLetter(c.cam)} (${c.cam})  ${live ? 'E/E' : c.playing ? '▶ ' + Math.round(c.speed * 100) + '%' : 'STILL'}${c.pl ? '  PLST ' + (c.pl.i + 1) + '/' + EVS.playlist.length : ''}`,
    `TC ${tc(S.tcOffset + t)}   −${fmt(Math.max(0, S.simTime - t), 1)} s`,
    `IN ${c.in != null ? tc(S.tcOffset + c.in).slice(3) : '--:--:--'}  OUT ${c.out != null ? tc(S.tcOffset + c.out).slice(3) : '--:--:--'}`,
    `${LSM.shift ? 'SHIFT  ' : ''}${LSM.plst ? 'PLST  ' : ''}${EVS.browse ? 'BROWSE  ' : ''}${LSM.page ? 'PAGE ?  ' : ''}${EVS.fastJog ? 'FAST JOG  ' : ''}${EVS.recording ? 'REC ●' : 'REC ARRÊTÉ'}`,
  ];
}

export function buildLsm3D(scene, pos, rotY = 0) {
  const grp = new THREE.Group(); grp.name = 'telecommande-lsm'; grp.position.copy(pos); grp.rotation.y = rotY;
  // le boîtier, légèrement incliné vers l'opérateur
  const deck = new THREE.Object3D(); deck.position.set(0, 0.02, 0); deck.rotation.x = 0.1; grp.add(deck);
  const top = new THREE.Object3D(); top.position.set(0, LSMH, 0); deck.add(top);
  LSMS.grp = grp; LSMS.top = top;
  const Bc = new Builder({ ao: 0.05, aoOpts: { dist: 0.1, strength: 0.9, floor: 0.35 } });
  const Ba = new Builder({ ao: 0.05, aoOpts: { dist: 0.1, strength: 0.9, floor: 0.35 } });
  Bc.cbox(LSMW, LSMH, LSMD, 0, LSMH / 2, 0, 0x24282d, 0.01);
  // cadre de l'afficheur, fente du levier, cuvette de la molette, bande des raccourcis
  Bc.cbox(SCREEN.w + 0.012, 0.004, SCREEN.d + 0.012, SCREEN.x, LSMH + 0.002, SCREEN.z, 0x0b0d10, 0.003);
  Bc.cbox(0.012, 0.003, LEVER.z1 - LEVER.z0 + 0.02, LEVER.x, LSMH + 0.0015, (LEVER.z0 + LEVER.z1) / 2, 0x07080a, 0.003);
  Bc.cyl(JOG.r + 0.006, JOG.r + 0.008, 0.004, JOG.x, LSMH + 0.002, JOG.z, 0x101215, 36);
  Bc.cbox(0.17, 0.003, 0.034, -0.088, LSMH + 0.0015, 0.098, 0x1a1d21, 0.004);
  // flancs en aluminium
  for (const sx of [-1, 1]) Ba.box(0.004, LSMH + 0.004, LSMD, sx * (LSMW / 2 - 0.002), LSMH / 2, 0, 0x8c939b);
  const body = Bc.mesh(matiere('plastique', { seed: 41, scale: 0.12, strength: 0.6, roughness: 0.6, name: 'telecommande-lsm-boitier' })); body.name = 'telecommande-lsm-boitier';
  const alu = Ba.mesh(matiere('alu', { seed: 42, scale: 0.2, strength: 0.6, name: 'telecommande-lsm-alu' })); alu.name = 'telecommande-lsm-alu';
  deck.add(body, alu);
  // sérigraphie : noms des groupes de touches, du levier et de la molette
  const ser = canvasPlane(top, LSMW - 0.01, LSMD - 0.01, 0, 0, 0.0003, 1024, 768, { name: 'telecommande-lsm-serigraphie' });
  drawSerigraphy(ser.g, 1024, 768); ser.dirty();
  // touches
  LSMS.keys = keyField(top, LSM_KEYS.map((k) => ({ ...k, h: 0.008 })), { name: 'telecommande-lsm-touches' });
  // levier : manche et poignée en T
  const Bl = new Builder();
  Bl.box(0.006, 0.03, 0.006, 0, 0.015, 0, 0x2a2d31); Bl.cbox(0.05, 0.014, 0.018, 0, 0.034, 0, 0xc8ccd0, 0.005);
  LSMS.lever = new THREE.Mesh(Bl.build(), matiere('plastique', { seed: 43, scale: 0.05, strength: 0.4, roughness: 0.45, name: 'telecommande-lsm-levier' })); LSMS.lever.name = 'telecommande-lsm-levier';
  top.add(LSMS.lever);
  // molette jog : la roue, son anneau caoutchouté et le creux pour le doigt (qui montre qu'elle tourne)
  const Bj = new Builder();
  Bj.cyl(JOG.r, JOG.r, 0.016, 0, 0.008, 0, 0x1a1c1f, 40); Bj.cyl(JOG.r * 0.72, JOG.r * 0.72, 0.002, 0, 0.0165, 0, 0x2a2e33, 36);
  Bj.cyl(0.008, 0.008, 0.003, 0, 0.0175, -JOG.r * 0.55, 0xe0b030, 16);
  LSMS.jog = new THREE.Mesh(Bj.build(), matiere('plastique', { seed: 44, scale: 0.04, strength: 0.5, roughness: 0.7, name: 'telecommande-lsm-jog' })); LSMS.jog.name = 'telecommande-lsm-jog';
  LSMS.jog.position.set(JOG.x, 0.001, JOG.z); top.add(LSMS.jog);
  // afficheur
  LSMS.lcd = canvasPlane(top, SCREEN.w, SCREEN.d, SCREEN.x, SCREEN.z, 0.0045, 640, 128, { lit: true, name: 'telecommande-lsm-afficheur' });
  scene.add(grp);
  updateLsm3D(0, true);
  return grp;
}

function drawSerigraphy(g, W, H) {
  g.fillStyle = '#24282d'; g.fillRect(0, 0, W, H);
  // repère : 1024 px pour LSMW - 0,01 m ; origine au centre
  const k = W / (LSMW - 0.01), X = (x) => W / 2 + x * k, Z = (z) => H / 2 + z * k;
  const lab = (s, x, z, size = 16, color = '#8b949e', align = 'left') => txt(g, s, X(x), Z(z), size, color, align, 600);
  lab('LSM · ' + EQUIP.evsModel + ' · MULTICAM', -0.188, 0.135, 16, '#c9d1d9');
  lab('TOUCHES F (clips de la page)', -0.177, -0.081, 13);
  lab('ANGLES (entrées enregistrées)', -0.177, -0.0535, 13);
  lab('BLOC OPÉRATIONNEL (en jaune : avec SHIFT)', -0.177, -0.027, 13);
  lab('SIMULATEUR', -0.172, 0.08, 14, '#e0b030');
  lab('100 %', LEVER.x + 0.012, LEVER.z0, 14); lab('0 %', LEVER.x + 0.012, LEVER.z1, 14); lab('LEVIER', LEVER.x - 0.012, (LEVER.z0 + LEVER.z1) / 2, 14, '#8b949e', 'right');
  lab('JOG', JOG.x, JOG.z + JOG.r + 0.012, 15, '#8b949e', 'center');
  // fonctions secondaires (SHIFT) sous les touches
  const sec = { IN: 'GOTO IN', OUT: 'GOTO OUT', PLST: 'BROWSE', PAGE: '+ F : page' };
  for (const kk of LSM_KEYS) if (sec[kk.name]) lab(sec[kk.name], kk.x, kk.z + kk.d / 2 + 0.004, 11, '#c08a20', 'center');
  rr(g, X(-0.18), Z(0.08), 0.172 * k, 0.04 * k, 6, null, '#3a3020', 2);
}

const lerp = (a, b, t) => a + (b - a) * t;
/** l'état allumé d'une touche (0, 0,5, 1) */
export function lsmLit(k) {
  if (k.kind === 'f') { const idx = (EVS.page - 1) * 10 + k.i; return LSM.page ? 1 : EVS.clips[idx] ? 0.5 : 0; }
  if (k.kind === 'cam') { const id = recordedCams()[k.i]; return id == null ? 0 : EVS.ch[EVS.lsmCh || 0].cam === id ? 1 : 0.5; }
  return lsmKeyOn(k.name) ? 1 : 0;
}

export function updateLsm3D(dt, force = false) {
  if (!LSMS.grp) return;
  // la molette suit les crans tournés (instantané : c'est la main de l'opérateur)
  LSMS.jog.rotation.y = -LSMS.jogA;
  LSMS.t += dt; if (!force && LSMS.t < 0.1) return; LSMS.t = 0;
  const F = LSMS.keys;
  F.keys.forEach((k, i) => F.set(i, lsmLit(k)));
  F.flush();
  const c = EVS.ch[EVS.lsmCh || 0];
  LSMS.lever.position.set(LEVER.x, 0, lerp(LEVER.z1, LEVER.z0, clamp(c.lever, 0, 1)));
  drawLcd();
}
function drawLcd() {
  const lines = lsmLines();
  const fk = Array.from({ length: 10 }, (_, i) => { const idx = (EVS.page - 1) * 10 + i; return LSM.page ? 'P' + (i + 1) : EVS.clips[idx] ? clipName(idx) : '·'; });
  const sig = lines.join('|') + '|' + fk.join(',');
  if (sig === LSMS.sig) return; LSMS.sig = sig;
  const o = LSMS.lcd, g = o.g, W = o.c.width, H = o.c.height;
  g.fillStyle = '#081a0c'; g.fillRect(0, 0, W, H);
  g.font = '500 21px "JetBrains Mono", monospace'; g.textBaseline = 'middle'; g.textAlign = 'left';
  lines.forEach((l, i) => { g.fillStyle = i === 3 && !EVS.recording ? '#ff7060' : '#8cf0a8'; g.fillText(l, 10, 15 + i * 27); });
  o.dirty();
}
/** la touche survolée s'éclaire (indice dans le champ de touches, −1 : aucune) */
export function hoverLsmKey(idx) {
  const F = LSMS.keys; if (!F) return;
  const old = F.hot; F.hot = idx;
  for (const k of [old, idx]) if (k >= 0) { F.set(k, -1); F.set(k, lsmLit(F.keys[k])); }
  F.flush();
}
/** une caméra derrière la touche d'angle i (ou null) */
export const camOfAngle = (i) => { const id = recordedCams()[i]; return id != null ? camById(id) : null; };

// @ts-check
import * as THREE from 'three';
import { Builder, screenMaterial } from './geo.js';
import { matiere } from './matiere.js';
import { TRUCK } from './world.js';
import { makeCanvas, tc } from './util.js';
import { S } from './state.js';
import { buildAudioDesk } from './audiodesk.js';
import { buildMelangeur3D } from './poste3d/icp.js';
import { buildRcp3D } from './poste3d/rcp.js';
import { buildLsm3D } from './poste3d/lsm.js';
import { buildIcom3D } from './poste3d/icom.js';

// ----------------------------------------------------------------------------------
// Intérieur du car régie (scène séparée : on ne voit pas l'extérieur).
// Repère local : lx le long du car (−8,8 → +8,8), lz en travers (−2,7 = mur d'écrans,
// +2,7 = côté porte). Circulation : une allée continue côté porte (son → technique),
// un passage transversal entre la production et la vision pour rejoindre la 1re rangée.
// ----------------------------------------------------------------------------------
export const T = { scene: null, screens: {}, stations: [], panels: {}, leds: null, ledColors: [], blockers: [], markers: [], layout: null };

const F = TRUCK.floor;
const X = (lx) => TRUCK.cx + lx;
const Z = (lz) => TRUCK.cz + lz;
const IN = { x0: -8.8, x1: 8.8, z0: -2.7, z1: 2.7 };
const PS = -5.4, PT = 3.9; // cloisons son / production et vision / technique
const DOOR = { x0: TRUCK.doorX0 - TRUCK.cx, x1: TRUCK.doorX1 - TRUCK.cx };
const EST = { x0: -5.35, x1: -0.95, z0: -0.4, z1: 1.45, h: 0.18 }; // estrade de la 2e rangée production

// plan (repère local) : utilisé par le plan du car affiché dans l'interface
const LAYOUT = {
  size: IN, door: DOOR,
  zones: [
    { id: 'son', name: 'Son', short: 'Son', x0: IN.x0, x1: PS, color: '#3a2a4a' },
    { id: 'prod', name: 'Production', short: 'Prod.', x0: PS, x1: -0.15, color: '#2a3446' },
    { id: 'vision', name: 'Vision · ralentis', short: 'Vision', x0: -0.15, x1: PT, color: '#263f3a' },
    { id: 'tech', name: 'Technique', short: 'Tech.', x0: PT, x1: IN.x1, color: '#3f3626' },
  ],
  walls: [], furniture: [],
};
T.layout = LAYOUT;

export function truckBlocked(x, z) {
  const lx = x - TRUCK.cx, lz = z - TRUCK.cz;
  // sortie par la porte
  if (lz > IN.z1 - 0.3 && lx > DOOR.x0 + 0.05 && lx < DOOR.x1 - 0.05) return false;
  if (lx < IN.x0 + 0.2 || lx > IN.x1 - 0.2 || lz < IN.z0 + 0.2 || lz > IN.z1 - 0.2) return true;
  for (const b of T.blockers) if (lx > b[0] && lx < b[1] && lz > b[2] && lz < b[3]) return true;
  return false;
}
// hauteur du plancher (estrade de la 2e rangée)
export function truckFloorAt(x, z) {
  const lx = x - TRUCK.cx, lz = z - TRUCK.cz;
  return lx > EST.x0 && lx < EST.x1 && lz > EST.z0 && lz < EST.z1 ? F + EST.h : F;
}
const block = (x0, x1, z0, z1, kind = 'desk', label = '') => { T.blockers.push([x0, x1, z0, z1]); LAYOUT.furniture.push({ x0, x1, z0, z1, kind, label }); };
const wall = (x0, x1, z0, z1) => { T.blockers.push([x0, x1, z0, z1]); LAYOUT.walls.push({ x0, x1, z0, z1 }); };

function screen(name, w, h, lx, y, lz, rotY = 0, label) {
  const mat = screenMaterial(null, { gain: 1.1 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.position.set(X(lx), F + y, Z(lz)); m.rotation.y = rotY;
  T.scene.add(m);
  const bezel = new THREE.Mesh(new THREE.BoxGeometry(w + 0.05, h + 0.05, 0.05), new THREE.MeshLambertMaterial({ color: 0x08090b }));
  bezel.position.copy(m.position); bezel.rotation.y = rotY; bezel.translateZ(-0.03); T.scene.add(bezel);
  T.screens[name] = mat;
  if (label) {
    // étiquette sous l'écran (UMD) : texture nette, dans le plan de l'écran
    const c = makeCanvas(512, 64); const g = c.getContext('2d');
    g.fillStyle = '#050607'; g.fillRect(0, 0, 512, 64);
    g.fillStyle = '#e8f0e0'; g.font = '600 36px "Barlow Condensed", "Arial Narrow", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(label, 256, 34);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    const umd = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w, 0.9), Math.min(w, 0.9) / 8), new THREE.MeshBasicMaterial({ map: t, toneMapped: false }));
    umd.position.copy(m.position); umd.rotation.y = rotY; umd.translateY(-h / 2 - 0.07); umd.translateZ(0.002);
    T.scene.add(umd);
  }
  return mat;
}

function canvasTex(w, h) { const c = makeCanvas(w, h); const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; return { c, g: c.getContext('2d'), tex }; }

// pupitre (plan incliné sur le bureau) dessiné une fois
function deskPanel(name, w, d, lx, lz, draw, y = 0.79, tilt = 0.18, rotY = 0) {
  const { c, g, tex } = canvasTex(1024, Math.max(64, Math.round(1024 * d / w)));
  draw(g, c.width, c.height);
  T.panels[name] = { canvas: c, ctx: g, tex };
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshLambertMaterial({ map: tex }));
  m.rotation.order = 'YXZ'; m.rotation.y = rotY; m.rotation.x = -Math.PI / 2 + tilt; m.position.set(X(lx), F + y, Z(lz));
  T.scene.add(m);
  return m;
}

// ---------------- dessins des pupitres ----------------
const rr = (g, x, y, w, h, r, fill, stroke) => { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = 2; g.stroke(); } };
const txt = (g, s, x, y, size = 14, color = '#c9d1d9', align = 'center', weight = 600) => { g.font = `${weight} ${size}px "Barlow Condensed", "Arial Narrow", sans-serif`; g.fillStyle = color; g.textAlign = align; g.textBaseline = 'middle'; g.fillText(s, x, y); };

function drawIPD(g, W, H) {
  // clavier et souris d'IPDirector, conducteur papier (la télécommande LSM est en 3D : poste3d/lsm.js)
  g.fillStyle = '#1e2125'; g.fillRect(0, 0, W, H);
  rr(g, 40, 50, 400, 130, 6, '#131517', '#2a2e33');
  for (let r = 0; r < 5; r++) for (let i = 0; i < 16; i++) rr(g, 50 + i * 24, 60 + r * 23, 21, 19, 2, '#2a2e33');
  rr(g, 480, 80, 52, 80, 22, '#2a2e33', '#3f454c');
  txt(g, 'IPDirector', 240, H - 26, 16, '#8b949e');
  rr(g, 640, 30, 150, H - 60, 4, '#e8e4d8'); for (let i = 0; i < 9; i++) { g.fillStyle = '#9a968c'; g.fillRect(655, 50 + i * 18, 110 - (i % 3) * 18, 2); }
}
function drawIntercom(g, W, H) {
  g.fillStyle = '#1f2226'; g.fillRect(0, 0, W, H);
  for (const ox of [10, W / 2 + 5]) {
    rr(g, ox, 8, W / 2 - 15, H - 16, 6, '#2b3036');
    for (let i = 0; i < 12; i++) {
      const x = ox + 10 + (i % 6) * ((W / 2 - 35) / 6), y = 18 + Math.floor(i / 6) * ((H - 40) / 2);
      rr(g, x, y, (W / 2 - 35) / 6 - 6, 22, 3, '#0d2338'); txt(g, ['RÉAL', 'CAM', 'EVS', 'SON', 'VISION', 'HF', 'PROD', 'CHAÎNE', 'COMM', 'STUDIO', 'TECH', 'ALL'][i], x + ((W / 2 - 35) / 6 - 6) / 2, y + 11, 11, '#9ed0ff', 'center', 500);
      rr(g, x, y + 26, ((W / 2 - 35) / 6 - 6) / 2 - 2, 14, 2, i === 0 ? '#30c060' : '#3a4047'); rr(g, x + ((W / 2 - 35) / 6 - 6) / 2 + 2, y + 26, ((W / 2 - 35) / 6 - 6) / 2 - 2, 14, 2, i === 0 ? '#e0b030' : '#3a4047');
    }
  }
}
function drawKeyboard(label) {
  return (g, W, H) => {
    g.fillStyle = '#1e2125'; g.fillRect(0, 0, W, H);
    rr(g, 20, 14, W * 0.62, H - 28, 6, '#131517', '#2a2e33');
    for (let r = 0; r < 4; r++) for (let i = 0; i < 18; i++) rr(g, 28 + i * (W * 0.6 / 18), 22 + r * ((H - 44) / 4), W * 0.6 / 18 - 4, (H - 44) / 4 - 4, 2, '#2a2e33');
    rr(g, W * 0.68, 20, W * 0.28, H - 40, 6, '#262a2f'); txt(g, label, W * 0.82, H / 2, 20, '#8b949e');
  };
}
function drawScripte(g, W, H) {
  g.fillStyle = '#1e2125'; g.fillRect(0, 0, W, H);
  rr(g, 20, 14, 240, H - 28, 4, '#e8e4d8'); for (let i = 0; i < 8; i++) { g.fillStyle = '#9a968c'; g.fillRect(34, 30 + i * ((H - 60) / 8), 200 - (i % 3) * 30, 2); }
  rr(g, 300, 20, 300, H - 40, 6, '#0a0c0e'); txt(g, '00:43:12', 450, H / 2, 46, '#ff4040', 'center', 500);
  rr(g, 640, 20, 340, H - 40, 6, '#262a2f'); txt(g, 'TIMER · TC · CHRONO', 810, H / 2, 20, '#8b949e');
}

// ---------------- baies : façades des appareils ----------------
// unités : [hauteur en U, type, libellé]
export const RACKS = {
  ccu: { title: 'CCU 1-6', units: [[1, 'sw1', 'LEAF R1 · CAMÉRAS'], [1, 'sw1', 'LEAF B1 · CAMÉRAS'], [3, 'hdcu2', 'HDCU-5500'], [3, 'hdcu2', 'HDCU-5500'], [3, 'hdcu2', 'HDCU-5500'], [1, 'vent'], [2, 'conv', 'CONV. FIBRE'], [1, 'blank'], [3, 'hdcu2', 'HDCU-5500'], [1, 'pdu', 'PDU'], [1, 'vent']], device: 'ccu' },
  ccu2: { title: 'CCU 7-12', units: [[1, 'blank'], [3, 'hdcu2', 'HDCU-5500'], [3, 'hdcu2', 'HDCU-5500'], [3, 'hdcu2', 'HDCU-5500'], [1, 'vent'], [2, 'msu', 'MSU'], [1, 'blank'], [2, 'conv', 'CONV. FIBRE'], [1, 'pdu', 'PDU']], device: 'ccu' },
  router: { title: 'Grille', units: [[1, 'blank'], [12, 'router', 'GRILLE VIDÉO 3G/12G 144×144'], [1, 'vent'], [2, 'panel', 'PANNEAU X-Y'], [1, 'pdu', 'PDU']], device: 'router' },
  xvs: { title: 'Mélangeur', units: [[1, 'sw1', 'LEAF R2 · PRODUCTION'], [1, 'sw1', 'LEAF B2 · PRODUCTION'], [6, 'xvs', 'XVS-6000'], [1, 'mks', 'MKS-X7700'], [1, 'vent'], [4, 'frame', 'CONVERSIONS / SYNCHROS'], [2, 'kvm', 'KVM'], [1, 'pdu', 'PDU']], device: 'mixer' },
  mv: { title: 'Réseau IP · Multiview', units: [[1, 'sw1', 'SPINE ROUGE 1'], [1, 'sw1', 'SPINE ROUGE 2'], [1, 'blank'], [1, 'sw1', 'SPINE BLEUE 1'], [1, 'sw1', 'SPINE BLEUE 2'], [1, 'vent'], [1, 'sw1', 'LEAF R4 · MONITORING'], [1, 'sw1', 'LEAF B4 · MONITORING'], [1, 'sw1', 'SW CONTRÔLE · NMOS'], [1, 'blank'], [2, 'mv', 'MULTIVIEWER 1'], [2, 'mv', 'MULTIVIEWER 2'], [1, 'vent'], [4, 'frame', 'PASSERELLES SDI ↔ IP'], [1, 'pdu', 'PDU']], device: 'swred' },
  evs: { title: 'EVS', units: [[1, 'sw1', 'LEAF R3 · RALENTIS'], [1, 'sw1', 'LEAF B3 · RALENTIS'], [6, 'xt4k', 'XT4K'], [1, 'vent'], [2, 'switch', 'SWITCH XNET / 10 GbE'], [2, 'ipd', 'SERVEUR IPDirector'], [1, 'kvm', 'KVM'], [1, 'pdu', 'PDU']], device: 'evs' },
  tx: { title: 'Transmission', units: [[1, 'sw1', 'LEAF R6 · PASSERELLES'], [1, 'sw1', 'LEAF B6 · PASSERELLES'], [1, 'enc', 'ENCODEUR JPEG XS'], [1, 'enc', 'ENCODEUR JPEG XS'], [1, 'enc', 'ENCODEUR HEVC'], [1, 'enc', 'MODULATEUR DVB-S2'], [1, 'vent'], [2, 'dec', 'DÉCODEUR RETOUR'], [2, 'frame', 'FIBRE OPÉRATEUR'], [1, 'pdu', 'PDU']], device: 'conv' },
  spg: { title: 'Synchro', units: [[1, 'blank'], [1, 'spg', 'SPG · GPS'], [1, 'spg', 'SPG SECOURS'], [1, 'chg', 'COMMUTATEUR AUTO'], [1, 'vent'], [2, 'da', 'DISTRIB. RÉFÉRENCE'], [2, 'da', 'DISTRIB. RÉFÉRENCE'], [2, 'tcd', 'TIMECODE'], [1, 'pdu', 'PDU']], device: 'spg' },
  icom: { title: 'Intercom', units: [[1, 'blank'], [6, 'matrix', 'MATRICE INTERCOM'], [1, 'vent'], [2, 'beltpack', 'BASE BELTPACKS'], [2, 'bridge', 'INTERFACES 4 FILS'], [1, 'pdu', 'PDU']] },
  patch: { title: 'Patch', units: [[1, 'blank'], [2, 'jack', 'VIDÉO IN 1-24'], [2, 'jack', 'VIDÉO IN 25-48'], [2, 'jack', 'GRILLE IN'], [2, 'jack', 'GRILLE OUT'], [2, 'jack', 'DÉPARTS / EVS'], [2, 'jack', 'RÉFÉRENCES'], [1, 'blank'], [2, 'jack', 'AUDIO']], device: 'pdc' },
  audio: { title: 'Audio', units: [[1, 'sw1', 'LEAF R5 · AUDIO'], [1, 'sw1', 'LEAF B5 · AUDIO'], [4, 'frame', 'CONSOLE · CŒUR DSP'], [1, 'madi', 'MADI / DANTE'], [1, 'madi', 'EMBEDDERS'], [1, 'madi', 'DÉSEMBEDDERS'], [1, 'vent'], [2, 'frame', 'UNITÉ COMMENTAIRE'], [1, 'pdu', 'PDU']] },
  rx: { title: 'Réception HF', units: [[1, 'blank'], [1, 'rx', 'RÉCEPTEUR HF 1'], [1, 'rx', 'RÉCEPTEUR HF 2'], [1, 'rx', 'RÉCEPTEUR HF 3'], [1, 'rx', 'RÉCEPTEUR HF 4'], [1, 'vent'], [2, 'dec', 'DÉCODEURS'], [2, 'frame', 'CONTRÔLE ANTENNES'], [1, 'pdu', 'PDU']], device: 'rx' },
  ups: { title: 'Énergie · mesure', units: [[1, 'blank'], [3, 'frame', 'PRISM · MESURE SDI / IP'], [3, 'ups', 'ONDULEUR'], [3, 'ups', 'ONDULEUR'], [1, 'vent'], [2, 'pdu', 'DISTRIBUTION 230 V'], [2, 'pdu', 'SURVEILLANCE ÉNERGIE']] },
};
// rangées de baies de la zone technique : contre le mur d'écrans (côté gauche en entrant) et côté porte
export const RACK_ROWS = { mur: ['ccu', 'ccu2', 'router', 'xvs', 'mv', 'evs', 'tx'], porte: ['spg', 'icom', 'patch', 'audio', 'rx', 'ups'] };
const LED_SPOTS = [];

function drawRackFace(key, g, W, H) {
  // 1 px ≈ 1 mm (rack 19" = 482 mm de large, 42 U ≈ 1 870 mm)
  const def = RACKS[key];
  g.fillStyle = '#0d0f12'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#20242a'; g.fillRect(0, 0, 22, H); g.fillRect(W - 22, 0, 22, H);
  for (let y = 10; y < H; y += 15) { g.fillStyle = '#3a3f46'; g.fillRect(8, y, 6, 4); g.fillRect(W - 14, y, 6, 4); }
  let y = 40;
  const spots = [];
  for (const [u, type, label] of def.units) {
    const h = u * 44.45 - 2;
    const x = 22, w = W - 44;
    const face = { blank: '#1a1d21', vent: '#16191d', pdu: '#22262b' }[type] || (['hdcu2', 'xt4k', 'xvs'].includes(type) ? '#2c3137' : '#262a30');
    rr(g, x, y, w, h, 3, face, '#0a0b0d');
    // vis de fixation
    g.fillStyle = '#5a6068'; for (const yy of u > 1 ? [y + 8, y + h - 8] : [y + h / 2]) { g.beginPath(); g.arc(x + 9, yy, 3, 0, 7); g.arc(x + w - 9, yy, 3, 0, 7); g.fill(); }
    if (type === 'sw1') {
      // commutateur 1 U : étiquette, 48 cages SFP28 sur deux rangées, 8 QSFP28 ; liseré rouge ou bleu
      const blue = /BLEU|B\d/.test(label), ctl = /CONTRÔLE/.test(label);
      g.fillStyle = ctl ? '#8b949e' : blue ? '#2f7ff0' : '#e03a30'; g.fillRect(x + 4, y + 3, 5, h - 6);
      rr(g, x + 16, y + 5, 150, h - 10, 2, '#0d1218'); txt(g, label, x + 91, y + h / 2, 12, ctl ? '#c9d1d9' : blue ? '#9ec8ff' : '#ffb0a8', 'center', 700);
      for (let r = 0; r < 2; r++) for (let i = 0; i < 24; i++) { const px = x + 176 + i * 9.5 + Math.floor(i / 6) * 3, py = y + 7 + r * 15; g.fillStyle = '#05070a'; g.fillRect(px, py, 7.5, 11); g.fillStyle = (i * 7 + r * 3) % 5 ? '#30ff60' : '#16301c'; g.fillRect(px + 1, py + 1, 2.5, 2); }
      for (let i = 0; i < 4; i++) for (let r = 0; r < 2; r++) { const px = x + w - 66 + i * 14, py = y + 7 + r * 15; g.fillStyle = '#05070a'; g.fillRect(px, py, 12, 11); g.fillStyle = '#30ff60'; g.fillRect(px + 1, py + 1, 3, 2); }
      spots.push([x + 178, y + 9], [x + 245, y + 24], [x + w - 64, y + 9]);
    } else if (type === 'vent') { for (let i = 0; i < 40; i++) { g.fillStyle = '#0b0c0e'; g.fillRect(x + 30 + i * 10, y + 10, 5, h - 20); } }
    else if (type === 'hdcu2') {
      // deux CCU demi-largeur côte à côte
      for (const k of [0, 1]) {
        const ox = x + 6 + k * (w / 2);
        rr(g, ox, y + 5, w / 2 - 12, h - 10, 3, '#353b42', '#1a1d21');
        rr(g, ox + 12, y + 14, 92, 40, 2, '#0d2338'); txt(g, 'CAM ' + (key === 'ccu2' ? 7 : 1), ox + 58, y + 34, 18, '#9ed0ff');
        txt(g, label, ox + 160, y + 22, 15, '#c9d1d9', 'center', 700);
        for (let i = 0; i < 5; i++) { g.fillStyle = ['#30ff60', '#30ff60', '#30ff60', '#555', '#30ff60'][i]; g.beginPath(); g.arc(ox + 120 + i * 18, y + 50, 4, 0, 7); g.fill(); }
        rr(g, ox + 12, y + 70, 30, 46, 4, '#e0e0e0'); rr(g, ox + 50, y + 70, 30, 46, 4, '#3a4047');
        g.beginPath(); g.arc(ox + 190, y + 90, 16, 0, 7); g.fillStyle = '#101214'; g.fill(); g.strokeStyle = '#6a7078'; g.lineWidth = 2; g.stroke();
        spots.push([ox + 120, y + 50]);
      }
    } else if (type === 'router') {
      for (let c = 0; c < 18; c++) { rr(g, x + 12 + c * 24, y + 10, 20, h - 80, 2, '#1c2025'); for (let l = 0; l < 6; l++) { g.fillStyle = l % 3 === 0 ? '#30ff60' : '#1a3a22'; g.fillRect(x + 18 + c * 24, y + 20 + l * 12, 8, 5); } spots.push([x + 22 + c * 24, y + 22]); }
      for (let i = 0; i < 30; i++) { g.fillStyle = '#0b0c0e'; g.fillRect(x + 20 + i * 14, y + h - 60, 8, 40); }
      txt(g, label, x + w / 2, y + h - 70, 16, '#c9d1d9', 'center', 700);
    } else if (type === 'xvs' || type === 'xt4k') {
      txt(g, label, x + 60, y + 28, 30, '#e6edf3', 'left', 800);
      if (type === 'xt4k') { for (let i = 0; i < 12; i++) { rr(g, x + 30 + i * 34, y + 60, 30, h - 90, 2, '#1a1d21', '#3a4047'); g.fillStyle = '#30ff60'; g.fillRect(x + 40 + i * 34, y + h - 44, 10, 4); spots.push([x + 45 + i * 34, y + h - 42]); } rr(g, x + w - 140, y + 16, 110, 30, 3, '#0d2338'); txt(g, 'REC ● PLAY', x + w - 85, y + 31, 14, '#9ed0ff'); }
      else { for (let i = 0; i < 26; i++) { g.fillStyle = '#121416'; g.fillRect(x + 30 + i * 16, y + 60, 9, h - 90); } for (let i = 0; i < 4; i++) { g.fillStyle = i ? '#30ff60' : '#3aa0ff'; g.beginPath(); g.arc(x + w - 120 + i * 22, y + 30, 5, 0, 7); g.fill(); spots.push([x + w - 120 + i * 22, y + 30]); } }
    } else if (type === 'jack') {
      txt(g, label, x + 16, y + 12, 12, '#e0b030', 'left', 700);
      for (let r = 0; r < 2; r++) for (let i = 0; i < 24; i++) { const cx = x + 26 + i * 17.5, cy = y + 34 + r * 30; g.beginPath(); g.arc(cx, cy, 6, 0, 7); g.fillStyle = '#0a0b0d'; g.fill(); g.strokeStyle = '#8a9098'; g.lineWidth = 1.5; g.stroke(); }
      g.fillStyle = '#e8e4d8'; g.fillRect(x + 18, y + 47, w - 36, 6);
    } else if (type === 'rx' || type === 'enc' || type === 'dec' || type === 'spg' || type === 'madi' || type === 'mks' || type === 'chg' || type === 'kvm' || type === 'tcd' || type === 'switch') {
      rr(g, x + 16, y + 6, 120, h - 12, 2, '#0d2338'); txt(g, label, x + 76, y + h / 2, Math.min(13, h - 10), '#9ed0ff', 'center', 500);
      for (let i = 0; i < (type === 'switch' ? 24 : 4); i++) { g.fillStyle = i % 4 === 3 ? '#ffb020' : '#30ff60'; const lx = type === 'switch' ? x + 160 + (i % 12) * 24 : x + 160 + i * 18; const ly = type === 'switch' ? y + 14 + Math.floor(i / 12) * 30 : y + h / 2; g.fillRect(lx - 3, ly - 3, 6, 6); if (i < 4) spots.push([lx, ly]); }
      if (type === 'rx') { for (let i = 0; i < 10; i++) { g.fillStyle = i < 7 ? '#30d060' : '#1a3a22'; g.fillRect(x + 260 + i * 12, y + h / 2 - 5, 9, 10); } }
    } else if (type === 'ups' || type === 'pdu') {
      if (type === 'ups') { rr(g, x + w / 2 - 70, y + 20, 140, 50, 3, '#0a1a0c'); txt(g, '230 V · 42 %', x + w / 2, y + 45, 18, '#8cf0a8', 'center', 500); spots.push([x + w / 2 + 90, y + 45]); }
      else { for (let i = 0; i < 8; i++) { g.fillStyle = '#0a0b0d'; g.fillRect(x + 40 + i * 48, y + h / 2 - 8, 30, 16); } txt(g, label, x + w - 60, y + h / 2, 11, '#8b949e', 'center', 500); }
    } else if (type === 'blank') { /* tôle pleine */ }
    else {
      // cadres modulaires, multiviewers, matrices : cartes verticales
      const nC = type === 'mv' ? 2 : 14;
      if (type === 'mv') { rr(g, x + 16, y + 10, 160, h - 20, 2, '#0d2338'); txt(g, label, x + 96, y + h / 2, 14, '#9ed0ff', 'center', 500); for (let i = 0; i < 6; i++) { g.fillStyle = '#30ff60'; g.fillRect(x + 200 + i * 16, y + h / 2 - 3, 6, 6); } spots.push([x + 203, y + h / 2]); }
      else { for (let c = 0; c < nC; c++) { rr(g, x + 14 + c * 31, y + 8, 27, h - 16, 2, '#1c2025'); g.fillStyle = c % 5 === 4 ? '#ffb020' : '#30ff60'; g.fillRect(x + 22 + c * 31, y + 16, 8, 5); if (c % 3 === 0) spots.push([x + 26 + c * 31, y + 18]); } txt(g, label, x + w / 2, y + h - 14, 12, '#c9d1d9', 'center', 700); }
    }
    y += h + 2;
  }
  // titre de baie (bandeau en haut)
  rr(g, 22, 6, W - 44, 28, 3, '#e0b030'); txt(g, def.title.toUpperCase(), W / 2, 21, 18, '#15100a', 'center', 800);
  return spots;
}

function buildRack({ Br, Bm, Bp }, key, lx, side) {
  // caisson 600 × 900 mm, façade texturée ; side −1 : contre le mur d'écrans, +1 : côté porte
  const depth = 0.85, w = 0.58, h = 2.05;
  const lz = side < 0 ? IN.z0 + depth / 2 : IN.z1 - depth / 2;
  Br.cbox(w, h, depth, X(lx), F + h / 2, Z(lz), 0x14161a, 0.012);
  Br.cbox(w + 0.02, 0.04, depth + 0.02, X(lx), F + h + 0.02, Z(lz), 0x22262c, 0.008);
  // rails 19" (alu) de part et d'autre de la façade, poignées de flanc, pieds réglables
  const zr = Z(lz) + (side < 0 ? depth / 2 - 0.02 : -depth / 2 + 0.02);
  for (const dx of [-0.25, 0.25]) Bm.box(0.02, h - 0.1, 0.03, X(lx) + dx, F + h / 2, zr, 0x8a9096);
  for (const dx of [-0.26, 0.26]) Bp.cyl(0.02, 0.02, 0.04, X(lx) + dx, F + 0.02, Z(lz), 0x111214, 8);
  const { c, g, tex } = canvasTex(526, 2048);
  const spots = drawRackFace(key, g, c.width, c.height);
  tex.needsUpdate = true;
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.04, h - 0.05), new THREE.MeshLambertMaterial({ map: tex, emissive: 0x111418, emissiveMap: tex, emissiveIntensity: 0.6 }));
  const zf = Z(lz) + (side < 0 ? depth / 2 + 0.006 : -depth / 2 - 0.006);
  face.position.set(X(lx), F + h / 2, zf); face.rotation.y = side < 0 ? 0 : Math.PI;
  T.scene.add(face);
  // LED clignotantes posées sur les voyants dessinés
  for (const [px, py] of spots) {
    const u = px / c.width - 0.5, v = 0.5 - py / c.height;
    const wx = X(lx) + (side < 0 ? u : -u) * (w - 0.04), wy = F + h / 2 + v * (h - 0.05);
    LED_SPOTS.push([wx, wy, zf + (side < 0 ? 0.004 : -0.004)]);
  }
  return { lx, lz: side < 0 ? IN.z0 + depth : IN.z1 - depth, faceZ: zf };
}

// ---------------- afficheur de timecode et documents ----------------
/** un afficheur LED rouge (HH:MM:SS:FF) encastré dans un mur d'écrans ; T.tcDisplays est mis à jour chaque seconde */
function tcDisplay(lx, y) {
  const { g, tex } = canvasTex(512, 128);
  const draw = (txt) => {
    g.fillStyle = '#07080a'; g.fillRect(0, 0, 512, 128);
    g.font = '700 86px "B612 Mono", "JetBrains Mono", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#3a0a08'; g.fillText('88:88:88:88', 256, 66);
    g.fillStyle = '#ff3b2a'; g.fillText(txt, 256, 66);
    tex.needsUpdate = true;
  };
  draw('--:--:--:--');
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.105), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  m.position.set(X(lx), F + y, Z(IN.z0 + 0.191)); T.scene.add(m);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.14, 0.03), new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.6 }));
  frame.position.copy(m.position); frame.translateZ(-0.018); T.scene.add(frame);
  (T.tcDisplays = T.tcDisplays || []).push({ draw, last: '' });
}
let DOC_TEX = null;
/** une feuille A4 : conducteur d'émission (titre, colonnes, lignes), partagée par tous les documents */
function docTexture() {
  if (DOC_TEX) return DOC_TEX;
  const { g, tex } = canvasTex(256, 362);
  g.fillStyle = '#f4f2ec'; g.fillRect(0, 0, 256, 362);
  g.fillStyle = '#1b2230'; g.fillRect(14, 14, 228, 26);
  txt(g, 'CONDUCTEUR · RCL – RIV', 128, 27, 15, '#f2f5f7', 'center', 700);
  txt(g, 'Séq.   TC          Source      Durée', 20, 58, 10, '#4a4f55', 'left', 600);
  for (let i = 0; i < 16; i++) {
    const y = 76 + i * 17; g.fillStyle = i % 2 ? '#e9e6de' : '#f4f2ec'; g.fillRect(14, y - 7, 228, 16);
    txt(g, `${String(i + 1).padStart(2, '0')}    ${String(19 + Math.floor(i / 4)).padStart(2, '0')}:${String((i * 7) % 60).padStart(2, '0')}:00    ${['CAM 1', 'EVS A', 'CAM 4', 'GFX', 'STU', 'CAM 2'][i % 6]}       ${['0:30', '1:10', '0:45', '0:20'][i % 4]}`, 20, y, 9, '#2a2d31', 'left', 500);
  }
  g.strokeStyle = '#c8d0d8'; g.lineWidth = 1; g.strokeRect(14, 14, 228, 334);
  tex.needsUpdate = true; DOC_TEX = tex; return tex;
}
/** une feuille posée sur un bureau (légèrement tournée), avec un stylo */
function document(lx, lz, y, rot) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.297), new THREE.MeshStandardMaterial({ map: docTexture(), roughness: 0.9 }));
  m.rotation.order = 'YXZ'; m.rotation.y = rot; m.rotation.x = -Math.PI / 2; m.position.set(X(lx), F + y, Z(lz)); T.scene.add(m);
}

// ---------------- signalétique ----------------
function hangingSign(text, lx, lz, w = 1.6, rotY = 0, color = '#e0b030') {
  const { g, tex } = canvasTex(1024, 192);
  g.fillStyle = '#0b0d10'; g.fillRect(0, 0, 1024, 192); g.fillStyle = color; g.fillRect(0, 0, 1024, 10); g.fillRect(0, 182, 1024, 10);
  txt(g, text, 512, 100, 92, '#f2f5f7', 'center', 700);
  tex.needsUpdate = true;
  const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 192 / 1024), mat);
  m.position.set(X(lx), TRUCK.ceil - 0.28, Z(lz)); m.rotation.y = rotY;
  T.scene.add(m);
  // le texte doit rester lisible des deux côtés : seconde face retournée, légèrement décalée
  const back = m.clone(); back.rotation.y = rotY + Math.PI; back.translateZ(0.012); T.scene.add(back);
  const slab = new THREE.Mesh(new THREE.BoxGeometry(w, w * 192 / 1024, 0.008), new THREE.MeshBasicMaterial({ color: 0x0b0d10 }));
  slab.position.copy(m.position); slab.rotation.y = rotY; slab.translateZ(0.006); T.scene.add(slab);
  m.translateZ(-0.002);
}

// text : libellé, ou fonction qui le donne (libellé qui suit le type de car, SDI ou IP)
function stationLabel(label) {
  const c = makeCanvas(1024, 160); const g = c.getContext('2d');
  const draw = (hot) => {
    const text = typeof label === 'function' ? label() : label;
    s.userData.txt = text;
    g.clearRect(0, 0, 1024, 160);
    g.font = '700 74px "Barlow Condensed", "Arial Narrow", sans-serif';
    const w = Math.min(1000, g.measureText(text).width + 80);
    rr(g, (1024 - w) / 2, 18, w, 124, 22, hot ? 'rgba(255,176,32,0.95)' : 'rgba(10,14,18,0.86)', hot ? '#ffd27a' : 'rgba(255,176,32,0.8)');
    txt(g, text, 512, 82, 74, hot ? '#15100a' : '#f2f5f7', 'center', 700);
    t.needsUpdate = true;
  };
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true, toneMapped: false, sizeAttenuation: false }));
  s.renderOrder = 10; s.scale.set(0.5, 0.5 * 160 / 1024, 1);
  draw(false); s.userData.draw = draw; s.userData.hot = false; s.visible = false;
  return s;
}

export function buildTruck() {
  const scene = new THREE.Scene();
  T.scene = scene;
  scene.background = new THREE.Color(0x07080a);
  // ---------------- matières ----------------
  // une famille de surfaces par Builder (un appel de rendu chacune) ; toutes partagent la liste des
  // occulteurs : l'occlusion ambiante cuite à la fusion voit les murs, les bureaux et les baies
  const occ = [];
  const mk = () => new Builder({ ao: 0.3, occluders: occ, aoOpts: { dist: 1.0, strength: 1.15, floor: 0.22 } });
  const B = mk(); // tôle peinte : parois, plafond, cloisons, caissons
  const Bf = mk(); // sol en caoutchouc à pastilles
  const Bd = mk(); // stratifié des bureaux
  const Bm = mk(); // aluminium brossé : nez de bureau, chemins de câbles, rails, pieds
  const Br = mk(); // acier thermolaqué des baies
  const Bt = mk(); // tissu des sièges
  const Bp = mk(); // plastique : accessoires, câbles, boîtiers
  const Bs = mk(); // mousse acoustique
  const Bl = mk(); // tôle larmée : seuils, marches
  const MT = {
    tole: matiere('tole', { seed: 2, scale: 0.55, strength: 0.3, roughness: 0.78, name: 'car-tole' }),
    sol: matiere('caoutchouc', { seed: 3, scale: 0.32, name: 'car-sol' }),
    strat: matiere('stratifie', { seed: 4, scale: 0.9, roughness: 0.58, strength: 0.7, name: 'car-stratifie' }),
    alu: matiere('alu', { seed: 5, scale: 0.35, strength: 0.7, name: 'car-alu' }),
    laque: matiere('laque', { seed: 6, scale: 0.45, name: 'car-laque' }),
    tissu: matiere('tissu', { seed: 7, scale: 0.18, strength: 0.7, name: 'car-tissu' }),
    plast: matiere('plastique', { seed: 8, scale: 0.2, name: 'car-plastique' }),
    mousse: matiere('mousse', { seed: 9, scale: 0.3, name: 'car-mousse' }),
    larme: matiere('larme', { seed: 10, scale: 0.28, name: 'car-larme' }),
  };
  const wallC = 0x565e68, floorC = 0x31363c, desk = 0x3c424a, deskTop = 0x5a6168, ceil = 0x3c424a, part = 0x47505a;
  const cx = TRUCK.cx, cz = TRUCK.cz;
  const L = IN.x1 - IN.x0, Wd = IN.z1 - IN.z0, H = TRUCK.ceil - F;
  // sol (allée plus claire), plafond, murs
  Bf.box(L, 0.05, Wd, cx, F - 0.025, cz, floorC);
  Bf.box(L - 0.4, 0.006, 1.25, cx, F + 0.004, Z(2.05), 0x2a2f38);
  B.box(L, 0.05, Wd, cx, TRUCK.ceil, cz, ceil);
  B.box(L, H, 0.1, cx, F + H / 2, Z(IN.z0), wallC);
  B.box(DOOR.x0 - IN.x0, H, 0.1, X((IN.x0 + DOOR.x0) / 2), F + H / 2, Z(IN.z1), wallC);
  B.box(IN.x1 - DOOR.x1, H, 0.1, X((IN.x1 + DOOR.x1) / 2), F + H / 2, Z(IN.z1), wallC);
  B.box(DOOR.x1 - DOOR.x0, H - 2.05, 0.1, X((DOOR.x0 + DOOR.x1) / 2), F + 2.05 + (H - 2.05) / 2, Z(IN.z1), wallC);
  // encadrement de porte, seuil en tôle larmée, poignée
  B.box(0.06, 2.05, 0.14, X(DOOR.x0), F + 1.025, Z(IN.z1), 0xe0b030); B.box(0.06, 2.05, 0.14, X(DOOR.x1), F + 1.025, Z(IN.z1), 0xe0b030);
  Bl.box(DOOR.x1 - DOOR.x0, 0.012, 0.3, X((DOOR.x0 + DOOR.x1) / 2), F + 0.006, Z(IN.z1 - 0.32), 0x8a9096);
  Bm.cyl(0.012, 0.012, 0.16, X(DOOR.x1 + 0.08), F + 1.05, Z(IN.z1 - 0.07), 0xd0d4d8, 8, Math.PI / 2);
  B.box(L - 0.2, 0.06, 0.02, cx, F + 0.1, Z(IN.z1 - 0.06), 0x1a1d21);
  B.box(0.1, H, Wd, X(IN.x0), F + H / 2, cz, wallC); B.box(0.1, H, Wd, X(IN.x1), F + H / 2, cz, wallC);
  wall(IN.x0, IN.x0 + 0.2, IN.z0, IN.z1); wall(IN.x1 - 0.2, IN.x1, IN.z0, IN.z1);
  // plinthes et lisse en aluminium à hauteur de bureau (passage des câbles et prises)
  for (const lz of [IN.z0 + 0.06, IN.z1 - 0.06]) Bm.box(L - 0.2, 0.08, 0.02, cx, F + 0.04, Z(lz), 0x6d737a);
  for (const lx of [IN.x0 + 0.06, IN.x1 - 0.06]) Bm.box(0.02, 0.08, Wd - 0.2, X(lx), F + 0.04, cz, 0x6d737a);
  // goulotte électrique (prises) le long du mur d'écrans
  B.box(L - 0.6, 0.09, 0.05, cx, F + 0.68, Z(IN.z0 + 0.13), 0xb0b4b8);
  for (let lx = -8; lx <= 8; lx += 0.9) { Bp.box(0.06, 0.05, 0.012, X(lx), F + 0.68, Z(IN.z0 + 0.16), 0x151719); Bp.box(0.06, 0.05, 0.012, X(lx + 0.09), F + 0.68, Z(IN.z0 + 0.16), 0x151719); }

  // cloison son / production : allège, vitre, imposte ; porte côté allée (lz 1.1 → 2.7)
  const sonDoor = 1.1;
  B.box(0.1, 1.0, sonDoor - IN.z0, X(PS), F + 0.5, Z((IN.z0 + sonDoor) / 2), part);
  B.box(0.1, H - 1.95, sonDoor - IN.z0, X(PS), F + 1.95 + (H - 1.95) / 2, Z((IN.z0 + sonDoor) / 2), part);
  B.box(0.1, 0.95, 0.12, X(PS), F + 1.475, Z(IN.z0 + 0.06), part); B.box(0.1, 0.95, 0.12, X(PS), F + 1.475, Z(sonDoor - 0.06), part);
  Bm.box(0.12, 0.03, sonDoor - IN.z0, X(PS), F + 1.0, Z((IN.z0 + sonDoor) / 2), 0x8a9096); Bm.box(0.12, 0.03, sonDoor - IN.z0, X(PS), F + 1.95, Z((IN.z0 + sonDoor) / 2), 0x8a9096);
  B.box(0.1, H - 2.05, IN.z1 - sonDoor, X(PS), F + 2.05 + (H - 2.05) / 2, Z((sonDoor + IN.z1) / 2), part);
  {
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(sonDoor - IN.z0 - 0.24, 0.95), new THREE.MeshPhysicalMaterial({ color: 0x8aa0b4, transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 1.2 }));
    glass.position.set(X(PS), F + 1.475, Z((IN.z0 + sonDoor) / 2)); glass.rotation.y = Math.PI / 2; scene.add(glass);
  }
  wall(PS - 0.08, PS + 0.08, IN.z0, sonDoor);
  // cloison vision / technique : porte côté allée (lz 1.0 → 2.7)
  const techDoor = 1.0;
  B.box(0.1, H, techDoor - IN.z0, X(PT), F + H / 2, Z((IN.z0 + techDoor) / 2), part);
  B.box(0.1, H - 2.05, IN.z1 - techDoor, X(PT), F + 2.05 + (H - 2.05) / 2, Z((techDoor + IN.z1) / 2), part);
  wall(PT - 0.08, PT + 0.08, IN.z0, techDoor);
  // seuils de porte (repères au sol)
  for (const px of [PS, PT]) B.box(0.14, 0.008, IN.z1 - 1.1, X(px), F + 0.006, Z((1.1 + IN.z1) / 2), 0xe0b030);

  // éléments lumineux (LED, bandeaux) : matériau émissif, ils « bavent » dans la vue post-traitée
  const glow = new Builder();
  // ---------------- production ----------------
  const deskRow = (x0, x1, z0, z1, y0 = 0, top = 0.77) => {
    const cxl = (x0 + x1) / 2, czl = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0;
    Bd.box(w, top - 0.04, 0.05, X(cxl), F + y0 + (top - 0.04) / 2, Z(z1 - 0.03), desk); // façade
    Bd.box(0.05, top - 0.04, d, X(x0 + 0.03), F + y0 + (top - 0.04) / 2, Z(czl), desk); Bd.box(0.05, top - 0.04, d, X(x1 - 0.03), F + y0 + (top - 0.04) / 2, Z(czl), desk);
    Bd.box(w, top - 0.04, 0.05, X(cxl), F + y0 + (top - 0.04) / 2, Z(z0 + 0.03), 0x1d2025);
    Bd.cbox(w + 0.04, 0.04, d + 0.06, X(cxl), F + y0 + top, Z(czl), deskTop, 0.012);
    Bm.cbox(w, 0.03, 0.035, X(cxl), F + y0 + top + 0.012, Z(z1 + 0.028), 0x9aa0a8, 0.008); // nez de bureau (alu), 7 mm au-dessus du plateau
    // trappe de câbles et passe-fils dans le plateau
    for (let k = 0; k < Math.floor(w / 1.4); k++) Bp.cyl(0.035, 0.035, 0.012, X(x0 + 0.7 + k * 1.4), F + y0 + top + 0.02, Z(z0 + 0.14), 0x101214, 12);
    // éclairage d'appoint sous le plateau (bandeau LED chaud, lumineux)
    glow.box(w - 0.2, 0.012, 0.025, X(cxl), F + y0 + top - 0.05, Z(z1 - 0.06), 0xffa040);
  };
  deskRow(-5.2, -0.4, -2.05, -1.2); block(-5.2, -0.4, -2.05, -1.2, 'desk', 'Réal · truquiste');
  Bl.box(EST.x1 - EST.x0, EST.h, EST.z1 - EST.z0, X((EST.x0 + EST.x1) / 2), F + EST.h / 2, Z((EST.z0 + EST.z1) / 2), 0x3a3e44);
  B.box(EST.x1 - EST.x0, 0.01, 0.03, X((EST.x0 + EST.x1) / 2), F + EST.h + 0.005, Z(EST.z1 - 0.02), 0xe0b030);
  LAYOUT.furniture.push({ x0: EST.x0, x1: EST.x1, z0: EST.z0, z1: EST.z1, kind: 'platform', label: 'Estrade' });
  deskRow(-5.2, -1.15, -0.32, 0.35, EST.h); block(-5.2, -1.15, -0.32, 0.35, 'desk', 'Production');
  const CH = { Bt, Bp, Bm };
  for (const lx of [-4.3, -2.9, -1.3]) chairAt(CH, lx, -0.75, 0);
  for (const lx of [-4.3, -2.9, -1.75]) chairAt(CH, lx, 0.95, EST.h);
  // mur d'écrans production (cadre + console de moniteurs)
  const monWall = (x0, x1, lxC) => {
    // le mur s'arrête sous le plafond (F + 2,25) : console à 0,78, haut à 2,2
    B.box(x1 - x0, 1.42, 0.1, X(lxC), F + 1.49, Z(IN.z0 + 0.12), 0x0b0c0e);
    // montants et traverses de la structure (alu noir)
    for (const lx of [x0 + 0.02, x1 - 0.02]) Bm.box(0.03, 1.46, 0.14, X(lx), F + 1.49, Z(IN.z0 + 0.13), 0x2a2d31);
    Bm.box(x1 - x0, 0.03, 0.14, X(lxC), F + 2.2, Z(IN.z0 + 0.13), 0x2a2d31);
    // rétroéclairage du mur d'écrans (bias light D65 tamisé, limite la fatigue visuelle)
    glow.box(x1 - x0 - 0.1, 0.015, 0.02, X(lxC), F + 2.2, Z(IN.z0 + 0.19), 0x9fb8ff); glow.box(x1 - x0 - 0.1, 0.015, 0.02, X(lxC), F + 0.79, Z(IN.z0 + 0.16), 0x9fb8ff);
    Bm.cbox(x1 - x0, 0.06, 0.25, X(lxC), F + 0.8 + 0.03, Z(IN.z0 + 0.25), 0x1b1e22, 0.01);
  };
  monWall(-5.45, -0.15, -2.8);
  // ---------------- vision et ralentis ----------------
  deskRow(0.4, 3.75, -2.05, -1.2); block(0.4, 3.75, -2.05, -1.2, 'desk', 'Vision (RCP)');
  deskRow(0.75, 3.75, -0.32, 0.35); block(0.75, 3.75, -0.32, 0.35, 'desk', 'EVS · IPDirector');
  for (const lx of [1.1, 2.8]) chairAt(CH, lx, -0.75, 0);
  for (const lx of [1.5, 3.0]) chairAt(CH, lx, 0.95, 0);
  monWall(0.37, 3.77, 2.07);
  // ---------------- son ----------------
  Bd.box(0.9, 0.78, 2.9, X(-7.75), F + 0.39, Z(-0.45), desk);
  Bd.cbox(1.0, 0.04, 3.0, X(-7.7), F + 0.8, Z(-0.45), deskTop, 0.012);
  Bm.cbox(0.035, 0.03, 3.0, X(-7.185), F + 0.812, Z(-0.45), 0x9aa0a8, 0.008);
  block(-8.25, -7.2, -1.95, 1.05, 'desk', 'Console son');
  chairAt(CH, -6.75, -0.4, 0, Math.PI / 2);
  // enceintes de proximité (sur pieds) et panneaux de mousse acoustique
  for (const lz of [-1.6, 0.8]) {
    Bp.cbox(0.28, 0.42, 0.24, X(-8.05), F + 1.05, Z(lz), 0x111214, 0.012, 0.5 * Math.sign(lz));
    Bp.cyl(0.08, 0.08, 0.02, X(-7.9), F + 1.0, Z(lz), 0x2a2d31, 16, 0, Math.PI / 2); Bp.cyl(0.03, 0.03, 0.02, X(-7.9), F + 1.16, Z(lz), 0x2a2d31, 12, 0, Math.PI / 2);
    Bm.cyl(0.02, 0.02, 0.2, X(-8.05), F + 0.94, Z(lz), 0x3a3e44, 8);
  }
  for (let i = 0; i < 5; i++) Bs.box(0.05, 1.3, 0.5, X(-8.72), F + 1.45, Z(-2.3 + i * 0.95), 0x3a3f46);
  for (let i = 0; i < 3; i++) Bs.box(0.8, 1.3, 0.05, X(-8.2 + i * 0.95), F + 1.45, Z(IN.z0 + 0.06), 0x3a3f46);
  for (let i = 0; i < 2; i++) Bs.box(0.8, 1.0, 0.05, X(-7.2 + i * 0.95), F + 1.5, Z(IN.z1 - 0.06), 0x3a3f46);

  // ---------------- zone technique : baies ----------------
  const rackDefs = [];
  RACK_ROWS.mur.forEach((k, i) => rackDefs.push([k, 4.25 + i * 0.6, -1]));
  RACK_ROWS.porte.forEach((k, i) => rackDefs.push([k, 5.1 + i * 0.6, 1]));
  const rackPos = {};
  for (const [k, lx, side] of rackDefs) rackPos[k] = buildRack({ Br, Bm, Bp }, k, lx, side);
  block(3.95, 8.15, IN.z0, IN.z0 + 0.85, 'rack', 'Baies');
  block(4.8, 8.4, IN.z1 - 0.85, IN.z1, 'rack', 'Baies');
  for (const [k, lx, side] of rackDefs) LAYOUT.furniture.push({ x0: lx - 0.29, x1: lx + 0.29, z0: side < 0 ? IN.z0 : IN.z1 - 0.85, z1: side < 0 ? IN.z0 + 0.85 : IN.z1, kind: 'rackunit', label: RACKS[k].title });
  // pupitre HF au fond
  Bd.box(0.62, 0.75, 2.2, X(8.45), F + 0.375, Z(-0.45), desk); Bd.cbox(0.66, 0.04, 2.25, X(8.45), F + 0.77, Z(-0.45), deskTop, 0.012);
  Bm.cbox(0.035, 0.03, 2.25, X(8.105), F + 0.782, Z(-0.45), 0x9aa0a8, 0.008);
  block(8.14, 8.8, -1.55, 0.65, 'desk', 'Pupitre HF');
  chairAt(CH, 7.75, -0.45, 0, -Math.PI / 2);
  // chemins de câbles au plafond (échelles à câbles) et leurs torons
  for (const lz of [-1.6, 1.6]) {
    for (const dz of [-0.14, 0.14]) Bm.box(L - 0.6, 0.05, 0.02, cx, TRUCK.ceil - 0.12, Z(lz + dz), 0x50565e);
    for (let lx = -8.4; lx <= 8.4; lx += 0.3) Bm.box(0.02, 0.04, 0.28, X(lx), TRUCK.ceil - 0.12, Z(lz), 0x50565e);
  }
  cableBundles(Bp, L, cx);
  // bouches de climatisation au plafond (grilles à lames)
  for (const lx of [-6.5, -2.5, 1.5, 6]) {
    B.box(0.5, 0.03, 0.3, X(lx), TRUCK.ceil - 0.02, Z(-0.9), 0xd8dadc);
    for (let k = 0; k < 7; k++) Bm.box(0.46, 0.012, 0.012, X(lx), TRUCK.ceil - 0.046, Z(-0.9 - 0.12 + k * 0.04), 0x8a9096);
  }
  // bandeaux lumineux au plafond (diffus)
  const strips = new Builder();
  for (const lx of [-7, -4, -1.5, 1.2, 3, 5.5, 7.5]) { strips.box(1.2, 0.02, 0.18, X(lx), TRUCK.ceil - 0.03, Z(0.4), 0xffffff); Bm.box(1.26, 0.02, 0.24, X(lx), TRUCK.ceil - 0.02, Z(0.4), 0x8a9096); }
  scene.add(new THREE.Mesh(strips.build(), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xc8d2e0).multiplyScalar(2.2) })));
  scene.add(new THREE.Mesh(glow.build(), new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(2.4, 2.4, 2.4) })));
  // dans l'encadrement de porte : la lumière du compound
  {
    const { g, tex } = canvasTex(128, 256);
    const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#bcd4ee'); gr.addColorStop(0.55, '#e8eef4'); gr.addColorStop(0.6, '#5a5e62'); gr.addColorStop(1, '#3b3e40');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 256); tex.needsUpdate = true;
    const out = new THREE.Mesh(new THREE.PlaneGeometry(DOOR.x1 - DOOR.x0 + 0.4, 2.6), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
    out.position.set(X((DOOR.x0 + DOOR.x1) / 2), F + 0.9, Z(IN.z1 + 0.6)); out.rotation.y = Math.PI; out.userData.noAO = true; scene.add(out);
  }
  // balisage au sol de l'allée (LED ambre)
  const guide = new Builder();
  for (let lx = -8.2; lx <= 8.2; lx += 0.8) { guide.box(0.12, 0.012, 0.03, X(lx), F + 0.01, Z(1.36), 0xffffff); guide.box(0.12, 0.012, 0.03, X(lx), F + 0.01, Z(IN.z1 - 0.12), 0xffffff); }
  scene.add(new THREE.Mesh(guide.build(), new THREE.MeshBasicMaterial({ color: 0xffb030, toneMapped: false })));

  // pieds des écrans EVS posés sur le bureau
  for (const lx of [1.5, 3.0]) { Bp.box(0.06, 0.22, 0.06, X(lx), F + 0.9, Z(-0.16), 0x111111); Bp.cbox(0.22, 0.012, 0.16, X(lx), F + 0.797, Z(-0.14), 0x111111, 0.005); }
  // ---------------- accessoires ----------------
  props({ Bp, Bm, Bt, B });

  // fusion : une pièce par matière
  const parts = [[B, MT.tole], [Bf, MT.sol], [Bd, MT.strat], [Bm, MT.alu], [Br, MT.laque], [Bt, MT.tissu], [Bp, MT.plast], [Bs, MT.mousse], [Bl, MT.larme]];
  for (const [b, m] of parts) { if (!b.parts.length) continue; const mesh = b.mesh(m); mesh.name = m.name; scene.add(mesh); }

  // LED des baies (clignotement)
  {
    const ledGeo = new THREE.BoxGeometry(0.008, 0.006, 0.003);
    const leds = new THREE.InstancedMesh(ledGeo, new THREE.MeshBasicMaterial({ toneMapped: false }), Math.max(1, LED_SPOTS.length));
    const mat = new THREE.Matrix4(); const col = new THREE.Color();
    const r = (n) => Math.abs(Math.sin(n * 12.9898) * 43758.5453 % 1);
    LED_SPOTS.forEach((p, i) => {
      mat.makeTranslation(p[0], p[1], p[2]); leds.setMatrixAt(i, mat);
      const h = r(i * 3.1);
      col.setHex(h < 0.75 ? 0x30ff60 : h < 0.9 ? 0x40a0ff : 0xffb020);
      leds.setColorAt(i, col); T.ledColors.push(col.getHex());
    });
    leds.userData.noAO = true;
    scene.add(leds); T.leds = leds;
  }

  // lumières : pénombre d'un vrai car (un spot au-dessus de chaque poste, la lueur des écrans sur les pupitres)
  scene.add(new THREE.HemisphereLight(0xcfd6e2, 0x2a2826, 1.5));
  const spot = (lx, lz, i = 50, col = 0xf2eee4, ang = 0.62) => {
    const s = new THREE.SpotLight(col, i, 7, ang, 0.7, 1.4);
    s.position.set(X(lx), TRUCK.ceil - 0.04, Z(lz)); s.target.position.set(X(lx), F, Z(lz));
    scene.add(s); scene.add(s.target); return s;
  };
  spot(-7.4, -0.4, 48); // son
  spot(-3.9, -1.2, 56); spot(-1.6, -1.2, 56); // production, 1re rangée
  spot(-3.2, 0.3, 50); // production, estrade
  spot(2.0, -1.2, 56); spot(2.2, 0.3, 50); // vision, EVS
  spot(5.0, 0.3, 48, 0xe8ecf4, 0.85); spot(7.2, 0.3, 48, 0xe8ecf4, 0.85); // technique
  spot(8.0, -0.45, 42); // HF
  // lueur froide des murs d'écrans sur les pupitres
  for (const [lx, i] of [[-4.0, 2.6], [-1.6, 2.6], [2.07, 2.4]]) { const p = new THREE.PointLight(0x9fb8ff, i, 3.2, 1.6); p.position.set(X(lx), F + 1.15, Z(IN.z0 + 0.75)); scene.add(p); }

  // écrans
  screen('mv', 2.3, 1.29, -2.85, 1.52, IN.z0 + 0.19, 0, 'MULTIVIEW PRODUCTION');
  screen('retant', 0.72, 0.405, -4.72, 1.95, IN.z0 + 0.19, 0, 'RETOUR ANTENNE');
  screen('clean', 0.72, 0.405, -4.72, 1.25, IN.z0 + 0.19, 0, 'CLEAN FEED');
  screen('pgm', 0.72, 0.405, -0.95, 1.95, IN.z0 + 0.19, 0, 'PGM');
  screen('pvw', 0.72, 0.405, -0.95, 1.25, IN.z0 + 0.19, 0, 'PVW');
  screen('mv2', 1.55, 0.87, 1.2, 1.6, IN.z0 + 0.19, 0, 'MULTIVIEW VISION');
  screen('ref', 0.9, 0.506, 2.95, 1.25, IN.z0 + 0.19, 0, 'MONITEUR GRADE 1');
  screen('scope', 0.9, 0.506, 2.95, 1.93, IN.z0 + 0.19, 0, 'OSCILLOSCOPE');
  screen('evsA', 0.56, 0.315, 1.5, 1.2, -0.12, 0, 'EVS A');
  screen('evsB', 0.56, 0.315, 3.0, 1.2, -0.12, 0, 'IPDIRECTOR');
  screen('audioMv', 0.95, 0.534, IN.x0 + 0.12, 1.5, -0.45, Math.PI / 2, 'PGM / MULTIVIEW');
  screen('hfmon', 0.75, 0.42, IN.x1 - 0.12, 1.45, -0.9, -Math.PI / 2, 'RÉCEPTION HF');
  screen('hfspec', 0.75, 0.42, IN.x1 - 0.12, 1.45, 0.05, -Math.PI / 2, 'SPECTRE');

  // afficheurs de timecode (LED rouges) dans les murs d'écrans de la production et de la vision
  tcDisplay(-0.37, 2.02); tcDisplay(2.24, 1.5);
  // documents de travail : conducteurs et feuilles de poste sur les bureaux
  for (const [lx, lz, y, rot] of [[-4.75, -1.42, 0.77, 0.15], [-2.4, -1.9, 0.77, -0.2], [-1.3, 0.2, 0.77 + EST.h, 0.3], [3.5, -1.9, 0.77, 0.1], [-7.6, -1.7, 0.8, 0.5], [8.45, 0.45, 0.77, 0.2]]) document(lx, lz, y + 0.021, rot);
  // pupitres (textures détaillées)
  // pupitre du truquiste en 3D, touche par touche (poste3d/icp.js) : le poste Mélangeur s'y installe (poste3d/melangeur.js)
  buildMelangeur3D(T.scene, new THREE.Vector3(X(-1.25), F + 0.79, Z(-1.6)));
  // pupitre d'intercom du réalisateur en 3D (poste3d/icom.js) : le poste intercom s'y installe (poste3d/intercom.js)
  buildIcom3D(T.scene, new THREE.Vector3(X(-2.9), F + 0.79, Z(-1.5)));
  deskPanel('scripte', 0.9, 0.3, -4.3, -1.55, drawScripte);
  // rangée de RCP en 3D, un par caméra (poste3d/rcp.js) : le poste vision s'y installe (poste3d/vision.js)
  buildRcp3D(T.scene, new THREE.Vector3(X(2.07), F + 0.79, Z(-1.6)));
  // télécommande LSM en 3D (poste3d/lsm.js) : le poste ralentis s'y installe (poste3d/ralentis.js) ; à côté, le clavier d'IPDirector
  buildLsm3D(T.scene, new THREE.Vector3(X(1.5), F + 0.79, Z(0.05)));
  deskPanel('ipd', 1.3, 0.4, 2.95, 0.0, drawIPD, 0.79, 0.16);
  // console son en 3D (inspiration Studer Vista 1, 22 faders) posée sur le bureau, face à l'opérateur
  buildAudioDesk(T.scene, new THREE.Vector3(X(-7.22), F + 0.82, Z(-0.45)), Math.PI / 2);
  deskPanel('audioside', 0.9, 0.3, -7.6, 0.75, drawIntercom, 0.83, 0.12, Math.PI / 2);
  deskPanel('gfx', 0.9, 0.3, -4.3, 0.0, drawKeyboard('HABILLAGE'), 0.97);
  deskPanel('prod', 0.9, 0.3, -2.9, 0.0, drawKeyboard('TIMING'), 0.97);
  deskPanel('chef', 0.9, 0.3, -1.75, 0.0, drawIntercom, 0.97);
  deskPanel('hf', 0.6, 2.0, 8.45, -0.45, drawKeyboard('HF'), 0.79, 0.1, -Math.PI / 2);

  // signalétique suspendue (lisible depuis l'allée)
  hangingSign('◂ SON', -5.2, 1.9, 1.0, Math.PI / 2, '#b480ff');
  hangingSign('PRODUCTION', -2.8, -2.0, 1.5);
  hangingSign('VISION · RALENTIS', 2.0, -2.0, 1.7, 0, '#40c0a0');
  hangingSign('TECHNIQUE ▸', 3.7, 1.85, 1.1, Math.PI / 2, '#e08040');
  hangingSign('SORTIE', 0.75, 2.25, 0.7, 0, '#30c060');

  // postes : position debout (pos), point regardé (look), rayon, poste ouvert
  // label et opts.short peuvent être des fonctions : le libellé suit alors le type de car (SDI ou IP)
  const st = (id, label, lx, lz, look, opts = {}) => {
    const fy = truckFloorAt(X(lx), Z(lz)) - F;
    const pos = new THREE.Vector3(X(lx), F + fy + 1.2, Z(lz));
    const lk = new THREE.Vector3(X(look[0]), F + look[1], Z(look[2]));
    const lab = stationLabel(label); lab.position.copy(lk); lab.position.y += opts.labelDy ?? 0.35; scene.add(lab);
    if (opts.zone === 'tech' && id !== 'hf') lab.position.y += (T.stations.filter((x) => x.zone === 'tech').length % 2) * 0.32;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.26, 28), new THREE.MeshBasicMaterial({ color: 0x8a9098, transparent: true, opacity: 0.55, toneMapped: false, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(X(lx), F + fy + 0.012, Z(lz)); scene.add(ring);
    const val = (v) => (typeof v === 'function' ? v() : v);
    T.stations.push({ id, get label() { return val(label); }, get short() { return val(opts.short); }, pos, look: lk, r: opts.r || 1.6, station: opts.station || id, arg: opts.arg, device: opts.device, zone: opts.zone, sprite: lab, ring, lx, lz });
  };
  st('son', 'Son', -6.75, -0.4, [-7.7, 0.9, -0.45], { zone: 'son', device: null });
  st('scripte', 'Scripte', -4.3, -0.75, [-4.3, 0.85, -1.55], { zone: 'prod' });
  st('realisateur', 'Réalisateur', -2.9, -0.75, [-2.9, 1.5, -2.5], { zone: 'prod' });
  st('melangeur', 'Truquiste · XVS-6000', -1.3, -0.75, [-1.25, 0.85, -1.6], { zone: 'prod', device: 'mixpanel', short: 'Truquiste' });
  st('habillage', 'Habillage', -4.3, 0.95, [-4.3, 1.0, 0.0], { zone: 'prod' });
  st('producteur', 'Production', -2.9, 0.95, [-2.9, 1.0, 0.0], { zone: 'prod' });
  st('chefdecar', 'Chef de car', -1.75, 0.95, [-1.75, 1.0, 0.0], { zone: 'prod' });
  st('vision1', 'Ingé vision 1', 1.1, -0.75, [1.1, 0.85, -1.6], { station: 'vision', arg: 0, zone: 'vision', device: 'rcp' });
  st('vision2', 'Ingé vision 2', 2.8, -0.75, [2.8, 0.85, -1.6], { station: 'vision', arg: 1, zone: 'vision', device: 'rcp' });
  st('evsA', 'EVS · LSM', 1.5, 0.95, [1.5, 0.85, 0.0], { station: 'evs', arg: 0, zone: 'vision', device: 'lsm' });
  st('evsB', 'IPDirector', 3.0, 0.95, [3.0, 0.85, 0.0], { station: 'ipdirector', zone: 'vision', device: 'ipd' });
  const rk = (k, lzOff = 0) => [rackPos[k].lx, 1.25, (rackPos[k].faceZ - TRUCK.cz) + lzOff];
  st('ccu', 'Baie CCU', 4.55, -1.3, [4.55, 1.25, rackPos.ccu.faceZ - TRUCK.cz], { r: 1.3, zone: 'tech', device: 'ccu' });
  st('grille', 'Grille', 5.45, -1.3, rk('router'), { r: 1.2, zone: 'tech', device: 'router' });
  st('xvsrack', 'Mélangeur (processeur)', 6.05, -1.3, rk('xvs'), { r: 1.1, station: 'melangeur', zone: 'tech', device: 'mixer', short: 'Mélangeur (proc.)' });
  st('reseau', () => (S.ipMode ? 'Réseau IP · spines et multiview' : 'Réseau de contrôle · switchs et multiview'), 6.65, -1.3, rk('mv'), { r: 1.1, zone: 'tech', device: 'swred', short: () => (S.ipMode ? 'Réseau IP' : 'Réseau de contrôle') });
  st('evsrack', 'Serveur EVS XT4K', 7.25, -1.3, rk('evs'), { r: 1.1, station: 'evs', arg: 0, zone: 'tech', device: 'evs' });
  st('transmission', 'Transmission', 7.85, -1.3, rk('tx'), { r: 1.1, zone: 'tech', device: 'conv' });
  st('synchro', 'Synchro (SPG)', 5.1, 1.3, rk('spg'), { r: 1.1, zone: 'tech', device: 'spg' });
  st('intercom', 'Intercom', 5.7, 1.3, rk('icom'), { r: 1.1, zone: 'tech' });
  st('mvproc', 'Baie de brassage', 6.3, 1.3, rk('patch'), { r: 1.1, station: 'brassage', zone: 'tech', device: 'pdc' });
  st('audiorack', 'Audio (MADI, embedders)', 6.9, 1.3, rk('audio'), { r: 1.1, station: 'son', zone: 'tech', short: 'Audio (MADI)' });
  st('hf', 'Régie HF', 7.75, -0.45, [8.65, 1.45, -0.45], { r: 1.3, zone: 'tech', device: 'rx' });
  // baie de mesure (instrument type PRISM) au bout de la rangée côté porte : ui/prism_station.js
  st('mesure', 'Baie de mesure (PRISM)', 8.0, 1.3, rk('ups'), { r: 1.1, zone: 'tech', device: 'prism', short: 'Mesure (PRISM)' });
  return scene;
}

// ---------------- accessoires : ce qui traîne dans un vrai car ----------------
/** un tube le long d'une courbe (câble, toron) ajouté à un Builder */
function cable(Bc, pts, r, color, seg = 24) {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(X(p[0]), F + p[1], Z(p[2]))), false, 'catmullrom', 0.6);
  Bc.add(new THREE.TubeGeometry(curve, seg, r, 6, false), null, color);
}
// torons dans les échelles à câbles, descentes derrière les baies et les murs d'écrans
function cableBundles(Bp, L, cx) {
  const cols = [0x111214, 0x1d2a44, 0x3a1e1e, 0x111214, 0x24321c, 0x111214];
  for (const lz of [-1.6, 1.6]) {
    cols.forEach((c, i) => {
      const off = (i - 2.5) * 0.035, sag = 0.012 * (i % 3);
      const pts = []; for (let lx = -8.3; lx <= 8.3; lx += 2.1) pts.push([lx, TRUCK.ceil - F - 0.16 - sag * Math.abs(Math.sin(lx)), lz + off]);
      cable(Bp, pts, 0.008 + 0.002 * (i % 2), c, 40);
    });
  }
  // descentes derrière les baies (côté mur et côté porte) et derrière les murs d'écrans
  for (const lx of [4.6, 6.4, 7.9]) cable(Bp, [[lx, 2.25 - 0.16, -1.6], [lx + 0.05, 1.9, -2.2], [lx, 1.4, -2.55], [lx, 0.4, -2.58]], 0.012, 0x111214, 10);
  for (const lx of [5.4, 7.0]) cable(Bp, [[lx, 2.25 - 0.16, 1.6], [lx + 0.05, 1.9, 2.2], [lx, 1.4, 2.55], [lx, 0.4, 2.58]], 0.012, 0x111214, 10);
  for (const lx of [-4.4, -2.0, 1.0, 2.9]) cable(Bp, [[lx, 2.25 - 0.16, -1.6], [lx + 0.08, 2.0, -2.3], [lx, 1.2, -2.5], [lx + 0.1, 0.85, -2.3]], 0.01, 0x1a1c20, 10);
  // jarretières de brassage devant la baie de patch (boucles courtes)
  for (let k = 0; k < 9; k++) {
    const x0 = 6.3 - 0.2 + (k % 5) * 0.1, y0 = 1.25 + Math.floor(k / 5) * 0.3 - 0.1, z = 2.7 - 0.85 - 0.02;
    const col = [0xe8c020, 0x2060d0, 0xd03030, 0x30a050][k % 4];
    cable(Bp, [[x0, y0, z], [x0 + 0.05, y0 - 0.08 - 0.03 * (k % 3), z - 0.04], [x0 + 0.1 + 0.02 * k, y0 - 0.02, z]], 0.004, col, 10);
  }
}
/** casque d'intercom posé sur le bureau */
function headset(Bp, Bm, lx, y, lz, rot) {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(X(lx), F + y + 0.06, Z(lz)), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rot, Math.PI / 2)), new THREE.Vector3(1, 1, 1));
  Bp.add(new THREE.TorusGeometry(0.085, 0.009, 6, 14, Math.PI), m, 0x151719);
  for (const s of [-1, 1]) Bp.cyl(0.036, 0.036, 0.028, X(lx) + Math.cos(rot) * 0.085 * s, F + y + 0.036, Z(lz) - Math.sin(rot) * 0.085 * s, 0x1b1e22, 12, 0, Math.PI / 2, rot);
  Bm.rod([X(lx) + Math.cos(rot) * 0.085, F + y + 0.03, Z(lz) - Math.sin(rot) * 0.085], [X(lx) + Math.cos(rot) * 0.02, F + y + 0.012, Z(lz) - Math.sin(rot) * 0.1 + 0.08], 0.003, 0x8a9096, 5);
}
/** gobelet, bloc-notes et stylo, boîtier d'intercom : la table de travail d'un technicien */
function deskStuff(Bp, Bm, Bt, lx, y, lz, kind) {
  y += 0.02; // y : centre du plateau → surface
  if (kind.includes('cup')) { Bp.cyl(0.04, 0.034, 0.1, X(lx), F + y + 0.05, Z(lz), 0xe8e4dc, 14); Bp.cyl(0.036, 0.03, 0.006, X(lx), F + y + 0.098, Z(lz), 0x3a2a1a, 12); }
  if (kind.includes('pad')) Bp.cyl(0.004, 0.004, 0.14, X(lx) + 0.1, F + y + 0.004, Z(lz) + 0.05, 0x202428, 6, 0, Math.PI / 2, 0.6); // le stylo (la feuille est un document)
  if (kind.includes('beltpack')) { Bp.cbox(0.1, 0.03, 0.14, X(lx), F + y + 0.015, Z(lz), 0x1a1d21, 0.006); for (let k = 0; k < 3; k++) Bp.box(0.02, 0.012, 0.02, X(lx) - 0.03 + k * 0.03, F + y + 0.035, Z(lz) - 0.03, [0xe03030, 0x30c060, 0xe0b030][k]); }
  if (kind.includes('headset')) headset(Bp, Bm, lx, y, lz, 0.4);
  if (kind.includes('phone')) Bp.cbox(0.07, 0.008, 0.15, X(lx), F + y + 0.004, Z(lz), 0x0c0d0f, 0.004, -0.3);
}
function props({ Bp, Bm, Bt, B }) {
  // extincteur et trousse de secours près de la porte, panneau électrique
  const ex = [DOOR.x1 + 0.45, IN.z1 - 0.2];
  Bp.cyl(0.075, 0.075, 0.46, X(ex[0]), F + 0.33, Z(ex[1]), 0xc8201c, 16); Bp.cyl(0.03, 0.045, 0.07, X(ex[0]), F + 0.59, Z(ex[1]), 0x1a1c1e, 10);
  Bm.cyl(0.012, 0.012, 0.06, X(ex[0]), F + 0.66, Z(ex[1]), 0x9aa0a8, 8); Bp.box(0.02, 0.18, 0.06, X(ex[0]) + 0.08, F + 0.6, Z(ex[1]), 0x1a1c1e);
  Bp.box(0.18, 0.012, 0.02, X(ex[0]), F + 0.1, Z(ex[1]) + 0.02, 0xe8e4dc);
  Bp.cbox(0.3, 0.22, 0.1, X(DOOR.x1 + 0.9), F + 1.6, Z(IN.z1 - 0.07), 0xb4b8bc, 0.01); Bp.box(0.14, 0.04, 0.012, X(DOOR.x1 + 0.9), F + 1.6, Z(IN.z1 - 0.125), 0x30a050); Bp.box(0.04, 0.14, 0.012, X(DOOR.x1 + 0.9), F + 1.6, Z(IN.z1 - 0.125), 0x30a050);
  B.cbox(0.45, 0.6, 0.1, X(DOOR.x0 - 0.5), F + 1.55, Z(IN.z1 - 0.07), 0xa8acb0, 0.01); Bp.box(0.3, 0.06, 0.01, X(DOOR.x0 - 0.5), F + 1.78, Z(IN.z1 - 0.125), 0xe0b030);
  // production : casques, blocs, gobelets, boîtiers d'intercom
  deskStuff(Bp, Bm, Bt, -4.75, 0.77, -1.4, ['pad', 'cup']);
  deskStuff(Bp, Bm, Bt, -3.35, 0.77, -1.35, ['headset']);
  deskStuff(Bp, Bm, Bt, -2.35, 0.77, -1.9, ['cup']);
  deskStuff(Bp, Bm, Bt, -2.27, 0.77, -1.42, ['beltpack', 'phone']); // à gauche du pupitre du truquiste
  deskStuff(Bp, Bm, Bt, -4.85, 0.77 + EST.h, 0.15, ['cup', 'pad']);
  deskStuff(Bp, Bm, Bt, -2.3, 0.77 + EST.h, 0.15, ['headset']);
  deskStuff(Bp, Bm, Bt, -1.3, 0.77 + EST.h, 0.2, ['beltpack']);
  // vision : casque, gobelet, bloc
  deskStuff(Bp, Bm, Bt, 0.65, 0.77, -1.45, ['headset']);
  deskStuff(Bp, Bm, Bt, 3.5, 0.77, -1.9, ['cup', 'pad']);
  deskStuff(Bp, Bm, Bt, 2.3, 0.77, 0.25, ['beltpack', 'cup']);
  // son : casque de l'ingénieur du son, bloc
  deskStuff(Bp, Bm, Bt, -7.65, 0.8, 0.9, ['headset']); deskStuff(Bp, Bm, Bt, -7.6, 0.8, -1.7, ['pad', 'cup']);
  // HF : gobelet, bloc
  deskStuff(Bp, Bm, Bt, 8.45, 0.77, 0.45, ['cup', 'pad']);
  // technique : lampe de baie et tabouret
  Bm.cyl(0.015, 0.015, 0.5, X(6.6), F + 0.25, Z(0.0), 0x8a9096, 8); Bm.cyl(0.14, 0.14, 0.02, X(6.6), F + 0.01, Z(0.0), 0x6a7078, 16); Bt.cyl(0.16, 0.16, 0.05, X(6.6), F + 0.52, Z(0.0), 0x1b1d21, 16);
  // horloge au mur de la production et de la vision
  for (const lx of [-2.8, 2.07]) { Bp.cyl(0.11, 0.11, 0.02, X(lx), F + 2.9, Z(IN.z0 + 0.06), 0x1a1c1e, 24, Math.PI / 2); Bp.cyl(0.095, 0.095, 0.006, X(lx), F + 2.9, Z(IN.z0 + 0.075), 0xe8e8e8, 24, Math.PI / 2); }
}

function chairAt({ Bt, Bp, Bm }, lx, lz, y0 = 0, rot = 0) {
  const x = X(lx), z = Z(lz);
  (T.chairs = T.chairs || []).push({ x, z, y: F + y0 + 0.52, rot }); // assises (avatars des joueurs en réseau)
  // siège de régie : assise et dossier en tissu, accoudoirs, vérin et piètement à cinq branches
  Bt.cbox(0.5, 0.09, 0.5, x, F + y0 + 0.48, z, 0x1b1d21, 0.035, rot);
  const bx = Math.sin(rot) * 0.22, bz = Math.cos(rot) * 0.22;
  Bt.cbox(0.48, 0.58, 0.07, x + bx, F + y0 + 0.82, z + bz, 0x1b1d21, 0.035, rot, -0.08);
  Bp.box(0.46, 0.06, 0.06, x + bx * 0.9, F + y0 + 0.53, z + bz * 0.9, 0x111214, rot);
  for (const s of [-1, 1]) {
    const ax = Math.cos(rot) * 0.27 * s, az = -Math.sin(rot) * 0.27 * s;
    Bp.cbox(0.05, 0.03, 0.3, x + ax, F + y0 + 0.69, z + az, 0x2c2f34, 0.012, rot);
    Bp.box(0.03, 0.16, 0.03, x + ax, F + y0 + 0.6, z + az, 0x2c2f34, rot);
  }
  Bm.cyl(0.028, 0.028, 0.3, x, F + y0 + 0.3, z, 0x9aa0a8, 10); Bp.cyl(0.04, 0.04, 0.14, x, F + y0 + 0.12, z, 0x111214, 10);
  for (let k = 0; k < 5; k++) {
    const a = rot + k * 1.2566;
    Bp.cbox(0.04, 0.03, 0.3, x + Math.sin(a) * 0.15, F + y0 + 0.04, z + Math.cos(a) * 0.15, 0x2a2d31, 0.01, a);
    Bp.cyl(0.025, 0.025, 0.02, x + Math.sin(a) * 0.29, F + y0 + 0.025, z + Math.cos(a) * 0.29, 0x111214, 8, 0, Math.PI / 2, a);
  }
}

// ---------------- mise à jour : LED, étiquettes et repères ----------------
export function updateTruck(t) {
  // les afficheurs de timecode suivent l'horloge du car (une fois par image)
  if (T.tcDisplays) { const s = tc(S.tcOffset + S.simTime); for (const d of T.tcDisplays) if (d.last !== s) { d.last = s; d.draw(s); } }
  if (!T.leds || (Math.floor(t * 4) % 2)) return;
  const col = new THREE.Color();
  const n = T.leds.count;
  for (let k = 0; k < 6; k++) {
    const i = Math.floor(Math.random() * n);
    col.setHex(Math.random() < 0.5 ? T.ledColors[i] : 0x0a0a0a);
    T.leds.setColorAt(i, col);
  }
  if (T.leds.instanceColor) T.leds.instanceColor.needsUpdate = true;
}
// étiquettes visibles près du joueur (devant lui), poste visé en surbrillance
export function truckZoneAt(x) {
  const lx = x - TRUCK.cx;
  return lx < PS ? 'son' : lx < -0.15 ? 'prod' : lx < PT ? 'vision' : 'tech';
}
export function updateTruckView(eye, dir, targetId, t) {
  const zone = truckZoneAt(eye.x);
  const near = (z) => z === zone || (zone === 'prod' && z === 'vision') || (zone === 'vision' && z === 'prod');
  const cand = [];
  for (const s of T.stations) {
    const v = s.look.clone().sub(eye); const d = v.length(); const cos = v.normalize().dot(dir);
    s._d = d; s._show = near(s.zone) && d < 4.2 && cos > 0.55;
    if (s._show) cand.push(s);
  }
  // au plus 4 étiquettes (les plus proches) en plus du poste visé
  cand.sort((a, b) => a._d - b._d);
  const shown = new Set(cand.slice(0, 4));
  for (const s of T.stations) {
    const hot = s.id === targetId;
    s.sprite.visible = hot || shown.has(s);
    if (s.sprite.userData.hot !== hot || (hot || s.sprite.visible) && s.sprite.userData.txt !== s.label) { s.sprite.userData.hot = hot; s.sprite.userData.draw(hot); }
    s.ring.material.color.setHex(hot ? 0xffb020 : 0x8a9098);
    s.ring.material.opacity = hot ? 0.75 + 0.25 * Math.sin(t * 6) : 0.4;
  }
}

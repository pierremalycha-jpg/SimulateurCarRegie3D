import * as THREE from 'three';
import { pbr } from './render.js';
import { Builder, screenMaterial } from './geo.js';
import { TRUCK, labelSprite } from './world.js';
import { makeCanvas } from './util.js';
import { EQUIP } from './equip.js';
import { buildAudioDesk } from './audiodesk.js';

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

function drawICP(g, W, H) {
  // pupitre ICP-X7000 : rangées de croisements (OLED + touches RVB), zone de transition, menu
  g.fillStyle = '#23272c'; g.fillRect(0, 0, W, H);
  rr(g, 8, 8, 170, H - 16, 8, '#15191d');
  rr(g, 18, 18, 150, 110, 6, '#0d2a4a'); txt(g, 'MENU', 93, 40, 18, '#9ed0ff'); for (let i = 0; i < 4; i++) rr(g, 28 + i * 36, 70, 30, 44, 4, '#174a7a');
  for (let i = 0; i < 6; i++) rr(g, 22 + (i % 3) * 48, 145 + Math.floor(i / 3) * 40, 40, 30, 4, '#3b4148');
  txt(g, 'ICP-X7000', 93, H - 30, 18, '#8b949e');
  const rows = [['KEY1', '#e0b030'], ['AUX', '#3aa0e0'], ['PGM A', '#e04040'], ['PST B', '#30c060']];
  const x0 = 200, bw = 26, gap = 4;
  rows.forEach(([lab, col], r) => {
    const y = 18 + r * 64;
    txt(g, lab, x0 - 6, y + 34, 13, '#8b949e', 'right');
    for (let i = 0; i < 20; i++) {
      const x = x0 + i * (bw + gap);
      rr(g, x, y, bw, 14, 2, '#0a0c0e'); txt(g, i < 12 ? 'CAM' + (i + 1) : ['EVS A', 'EVS B', 'GFX', 'STU', 'BARS', 'BLK', 'CLN', 'MV'][i - 12], x + bw / 2, y + 7, 9, '#cfe8ff', 'center', 500);
      const on = (r === 2 && i === 0) || (r === 3 && i === 1) || (r === 1 && i === 5);
      rr(g, x, y + 18, bw, 26, 4, on ? col : '#3a4047');
      if (!on) { g.fillStyle = col; g.globalAlpha = 0.35; g.fillRect(x + 3, y + 21, bw - 6, 3); g.globalAlpha = 1; }
    }
  });
  // zone de transition
  const tx = x0 + 20 * (bw + gap) + 16;
  rr(g, tx, 14, W - tx - 12, H - 28, 8, '#191d21');
  for (let i = 0; i < 6; i++) rr(g, tx + 12 + (i % 3) * 46, 26 + Math.floor(i / 3) * 40, 40, 30, 4, ['#e0b030', '#3a4047', '#3a4047', '#e04040', '#3a4047', '#3a4047'][i]);
  txt(g, 'MIX WIPE DME CLIP', tx + 80, 112, 12, '#8b949e');
  rr(g, tx + 14, 128, 70, 34, 5, '#5a6068'); txt(g, 'CUT', tx + 49, 145, 16, '#f0f0f0');
  rr(g, tx + 92, 128, 70, 34, 5, '#c03030'); txt(g, 'AUTO', tx + 127, 145, 16, '#fff');
  rr(g, tx + 175, 22, 26, H - 50, 8, '#0b0d0f'); rr(g, tx + 165, 70, 46, 22, 4, '#c8ccd0');
  rr(g, tx + 14, 180, 148, 40, 5, '#3a4047'); txt(g, 'DSK1  DSK2  FTB', tx + 88, 200, 14, '#e0b030');
}
function drawRCPRow(g, W, H) {
  // rangée de RCP-3500 (un par caméra) avec un MSU au milieu
  g.fillStyle = '#1b1e22'; g.fillRect(0, 0, W, H);
  const n = 12, uw = 66, gap = 8; const mid = 6;
  let x = 10;
  for (let i = 0; i < n; i++) {
    if (i === mid) { rr(g, x, 6, 120, H - 12, 6, '#262b31'); txt(g, 'MSU', x + 60, 20, 14, '#8b949e'); for (let k = 0; k < 12; k++) rr(g, x + 8 + (k % 4) * 27, 36 + Math.floor(k / 4) * 26, 22, 18, 3, k === 0 ? '#e0b030' : '#3a4047'); x += 128; }
    rr(g, x, 6, uw, H - 12, 6, '#2b3036');
    rr(g, x + 6, 12, uw - 12, 34, 3, '#0d2338'); txt(g, 'CAM ' + (i + 1), x + uw / 2, 24, 12, '#9ed0ff'); txt(g, 'F5.6  0dB', x + uw / 2, 38, 10, '#6fa8dc', 'center', 500);
    rr(g, x + 8, 52, 12, 8, 2, i === 0 ? '#ff3030' : '#3a1515'); rr(g, x + uw - 20, 52, 12, 8, 2, i === 1 ? '#30d060' : '#153a20');
    ['#d04040', '#40b050', '#4070d0'].forEach((c, k) => { g.beginPath(); g.arc(x + 15 + k * 18, 76, 7, 0, Math.PI * 2); g.fillStyle = '#111'; g.fill(); g.lineWidth = 3; g.strokeStyle = c; g.stroke(); });
    for (let k = 0; k < 6; k++) rr(g, x + 7 + (k % 3) * 18, 92 + Math.floor(k / 3) * 14, 15, 10, 2, '#4a5058');
    g.beginPath(); g.arc(x + uw / 2, H - 34, 18, 0, Math.PI * 2); g.fillStyle = '#0c0d0f'; g.fill();
    g.beginPath(); g.arc(x + uw / 2, H - 34, 8, 0, Math.PI * 2); g.fillStyle = '#c8a040'; g.fill();
    x += uw + gap;
  }
}
function drawLSM(g, W, H) {
  // télécommande LSM (Multicam) + clavier et souris IPDirector
  g.fillStyle = '#1e2125'; g.fillRect(0, 0, W, H);
  rr(g, 10, 8, 420, H - 16, 10, '#2c3036', '#3f454c');
  rr(g, 22, 16, 230, 34, 4, '#0a1a0c'); txt(g, 'PGM1  CAM A  LIVE', 137, 33, 15, '#8cf0a8', 'center', 500);
  for (let i = 0; i < 10; i++) rr(g, 22 + i * 23, 58, 19, 16, 3, '#4a5058');
  for (let r = 0; r < 3; r++) for (let i = 0; i < 5; i++) rr(g, 22 + i * 46, 84 + r * 26, 40, 20, 4, ['#3a4047', '#c08a20', '#30a050', '#3a4047', '#2f6fb0'][(i + r) % 5]);
  rr(g, 280, 20, 22, H - 44, 8, '#0b0d0f'); rr(g, 270, 60, 42, 18, 4, '#c8ccd0'); txt(g, 'LEVIER', 291, H - 14, 11, '#8b949e');
  g.beginPath(); g.arc(370, H / 2 + 6, 46, 0, Math.PI * 2); g.fillStyle = '#121416'; g.fill(); g.beginPath(); g.arc(370, H / 2 + 6, 30, 0, Math.PI * 2); g.fillStyle = '#2a2e33'; g.fill(); g.beginPath(); g.arc(385, H / 2 - 6, 5, 0, Math.PI * 2); g.fillStyle = '#e0b030'; g.fill();
  txt(g, 'LSM · ' + EQUIP.evsModel, 220, H - 14, 12, '#8b949e');
  // clavier et souris
  rr(g, 470, 30, 340, 110, 6, '#131517', '#2a2e33');
  for (let r = 0; r < 5; r++) for (let i = 0; i < 15; i++) rr(g, 478 + i * 22, 38 + r * 20, 19, 16, 2, '#2a2e33');
  rr(g, 840, 50, 46, 70, 20, '#2a2e33', '#3f454c');
  txt(g, 'IPDirector', 640, H - 12, 12, '#8b949e');
  rr(g, 910, 20, 100, H - 40, 4, '#e8e4d8'); for (let i = 0; i < 7; i++) { g.fillStyle = '#9a968c'; g.fillRect(920, 36 + i * 14, 70 - (i % 3) * 12, 2); }
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
  ups: { title: 'Énergie', units: [[1, 'blank'], [3, 'ups', 'ONDULEUR'], [3, 'ups', 'ONDULEUR'], [1, 'vent'], [2, 'pdu', 'DISTRIBUTION 230 V'], [2, 'pdu', 'SURVEILLANCE ÉNERGIE']] },
};
// rangées de baies de la zone technique : contre le mur d'écrans (côté gauche en entrant) et côté porte
export const RACK_ROWS = { mur: ['ccu', 'ccu2', 'router', 'xvs', 'mv', 'evs', 'tx'], porte: ['spg', 'icom', 'patch', 'audio', 'rx', 'ups'] };
const RU = 0.0445; // 1 U = 44,45 mm
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

function buildRack(B, key, lx, side) {
  // caisson 600 × 900 mm, façade texturée ; side −1 : contre le mur d'écrans, +1 : côté porte
  const depth = 0.85, w = 0.58, h = 2.05;
  const lz = side < 0 ? IN.z0 + depth / 2 : IN.z1 - depth / 2;
  B.box(w, h, depth, X(lx), F + h / 2, Z(lz), 0x14161a);
  B.box(w + 0.02, 0.04, depth + 0.02, X(lx), F + h + 0.02, Z(lz), 0x22262c);
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

// ---------------- signalétique ----------------
function hangingSign(text, lx, lz, w = 1.6, rotY = 0, color = '#e0b030') {
  const { c, g, tex } = canvasTex(1024, 192);
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

function stationLabel(text) {
  const c = makeCanvas(1024, 160); const g = c.getContext('2d');
  const draw = (hot) => {
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
  const B = new Builder();
  const wallC = 0x3d444d, floorC = 0x24282e, desk = 0x2f343b, deskTop = 0x454b53, ceil = 0x2a2f36, part = 0x363c44;
  const cx = TRUCK.cx, cz = TRUCK.cz;
  const L = IN.x1 - IN.x0, Wd = IN.z1 - IN.z0, H = TRUCK.ceil - F;
  // sol (allée plus claire), plafond, murs
  B.box(L, 0.05, Wd, cx, F - 0.025, cz, floorC);
  B.box(L - 0.4, 0.006, 1.25, cx, F + 0.004, Z(2.05), 0x2f3540);
  B.box(L, 0.05, Wd, cx, TRUCK.ceil, cz, ceil);
  B.box(L, H, 0.1, cx, F + H / 2, Z(IN.z0), wallC);
  B.box(DOOR.x0 - IN.x0, H, 0.1, X((IN.x0 + DOOR.x0) / 2), F + H / 2, Z(IN.z1), wallC);
  B.box(IN.x1 - DOOR.x1, H, 0.1, X((IN.x1 + DOOR.x1) / 2), F + H / 2, Z(IN.z1), wallC);
  B.box(DOOR.x1 - DOOR.x0, H - 2.05, 0.1, X((DOOR.x0 + DOOR.x1) / 2), F + 2.05 + (H - 2.05) / 2, Z(IN.z1), wallC);
  // encadrement de porte
  B.box(0.06, 2.05, 0.14, X(DOOR.x0), F + 1.025, Z(IN.z1), 0xe0b030); B.box(0.06, 2.05, 0.14, X(DOOR.x1), F + 1.025, Z(IN.z1), 0xe0b030);
  B.box(L - 0.2, 0.06, 0.02, cx, F + 0.1, Z(IN.z1 - 0.06), 0x1a1d21);
  B.box(0.1, H, Wd, X(IN.x0), F + H / 2, cz, wallC); B.box(0.1, H, Wd, X(IN.x1), F + H / 2, cz, wallC);
  wall(IN.x0, IN.x0 + 0.2, IN.z0, IN.z1); wall(IN.x1 - 0.2, IN.x1, IN.z0, IN.z1);

  // cloison son / production : allège, vitre, imposte ; porte côté allée (lz 1.1 → 2.7)
  const sonDoor = 1.1;
  B.box(0.1, 1.0, sonDoor - IN.z0, X(PS), F + 0.5, Z((IN.z0 + sonDoor) / 2), part);
  B.box(0.1, H - 1.95, sonDoor - IN.z0, X(PS), F + 1.95 + (H - 1.95) / 2, Z((IN.z0 + sonDoor) / 2), part);
  B.box(0.1, 0.95, 0.12, X(PS), F + 1.475, Z(IN.z0 + 0.06), part); B.box(0.1, 0.95, 0.12, X(PS), F + 1.475, Z(sonDoor - 0.06), part);
  B.box(0.1, H - 2.05, IN.z1 - sonDoor, X(PS), F + 2.05 + (H - 2.05) / 2, Z((sonDoor + IN.z1) / 2), part);
  {
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(sonDoor - IN.z0 - 0.24, 0.95), new THREE.MeshLambertMaterial({ color: 0x5a7a9a, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }));
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
    B.box(w, top - 0.04, 0.05, X(cxl), F + y0 + (top - 0.04) / 2, Z(z1 - 0.03), desk); // façade
    B.box(0.05, top - 0.04, d, X(x0 + 0.03), F + y0 + (top - 0.04) / 2, Z(czl), desk); B.box(0.05, top - 0.04, d, X(x1 - 0.03), F + y0 + (top - 0.04) / 2, Z(czl), desk);
    B.box(w, top - 0.04, 0.05, X(cxl), F + y0 + (top - 0.04) / 2, Z(z0 + 0.03), 0x1d2025);
    B.box(w + 0.04, 0.04, d + 0.06, X(cxl), F + y0 + top, Z(czl), deskTop);
    B.box(w, 0.02, 0.03, X(cxl), F + y0 + top + 0.01, Z(z1 + 0.02), 0x8a9098); // nez de bureau
    // éclairage d'appoint sous le plateau (bandeau LED chaud, lumineux)
    glow.box(w - 0.2, 0.012, 0.025, X(cxl), F + y0 + top - 0.05, Z(z1 - 0.06), 0xffa040);
  };
  deskRow(-5.2, -0.4, -2.05, -1.2); block(-5.2, -0.4, -2.05, -1.2, 'desk', 'Réal · truquiste');
  B.box(EST.x1 - EST.x0, EST.h, EST.z1 - EST.z0, X((EST.x0 + EST.x1) / 2), F + EST.h / 2, Z((EST.z0 + EST.z1) / 2), 0x23272d);
  B.box(EST.x1 - EST.x0, 0.01, 0.03, X((EST.x0 + EST.x1) / 2), F + EST.h + 0.005, Z(EST.z1 - 0.02), 0xe0b030);
  LAYOUT.furniture.push({ x0: EST.x0, x1: EST.x1, z0: EST.z0, z1: EST.z1, kind: 'platform', label: 'Estrade' });
  deskRow(-5.2, -1.15, -0.32, 0.35, EST.h); block(-5.2, -1.15, -0.32, 0.35, 'desk', 'Production');
  for (const lx of [-4.3, -2.9, -1.3]) chairAt(B, lx, -0.75, 0);
  for (const lx of [-4.3, -2.9, -1.75]) chairAt(B, lx, 0.95, EST.h);
  // mur d'écrans production (cadre + console de moniteurs)
  B.box(5.3, 1.6, 0.1, X(-2.8), F + 1.6, Z(IN.z0 + 0.12), 0x0b0c0e);
  // rétroéclairage du mur d'écrans (bias light D65 tamisé, limite la fatigue visuelle)
  glow.box(5.2, 0.015, 0.02, X(-2.8), F + 2.41, Z(IN.z0 + 0.16), 0x9fb8ff); glow.box(5.2, 0.015, 0.02, X(-2.8), F + 0.79, Z(IN.z0 + 0.16), 0x9fb8ff);
  B.box(5.3, 0.06, 0.25, X(-2.8), F + 0.8 + 0.03, Z(IN.z0 + 0.25), 0x1b1e22);
  // ---------------- vision et ralentis ----------------
  deskRow(0.4, 3.75, -2.05, -1.2); block(0.4, 3.75, -2.05, -1.2, 'desk', 'Vision (RCP)');
  deskRow(0.75, 3.75, -0.32, 0.35); block(0.75, 3.75, -0.32, 0.35, 'desk', 'EVS · IPDirector');
  for (const lx of [1.1, 2.8]) chairAt(B, lx, -0.75, 0);
  for (const lx of [1.5, 3.0]) chairAt(B, lx, 0.95, 0);
  B.box(3.4, 1.6, 0.1, X(2.07), F + 1.6, Z(IN.z0 + 0.12), 0x0b0c0e);
  glow.box(3.3, 0.015, 0.02, X(2.07), F + 2.41, Z(IN.z0 + 0.16), 0x9fb8ff); glow.box(3.3, 0.015, 0.02, X(2.07), F + 0.79, Z(IN.z0 + 0.16), 0x9fb8ff);
  // ---------------- son ----------------
  B.box(0.9, 0.78, 2.9, X(-7.75), F + 0.39, Z(-0.45), desk);
  B.box(1.0, 0.04, 3.0, X(-7.7), F + 0.8, Z(-0.45), deskTop);
  block(-8.25, -7.2, -1.95, 1.05, 'desk', 'Console son');
  chairAt(B, -6.75, -0.4, 0, Math.PI / 2);
  // enceintes de proximité et panneaux acoustiques
  for (const lz of [-1.6, 0.8]) { B.box(0.28, 0.42, 0.24, X(-8.05), F + 1.05, Z(lz), 0x111214, 0.5 * Math.sign(lz)); B.cyl(0.08, 0.08, 0.02, X(-7.9), F + 1.0, Z(lz), 0x2a2d31, 12, 0, Math.PI / 2); }
  for (let i = 0; i < 5; i++) B.box(0.05, 1.3, 0.5, X(-8.72), F + 1.45, Z(-2.3 + i * 0.95), 0x4a505a);
  for (let i = 0; i < 3; i++) B.box(0.8, 1.3, 0.05, X(-8.2 + i * 0.95), F + 1.45, Z(IN.z0 + 0.06), 0x4a505a);

  // ---------------- zone technique : baies ----------------
  const rackDefs = [];
  RACK_ROWS.mur.forEach((k, i) => rackDefs.push([k, 4.25 + i * 0.6, -1]));
  RACK_ROWS.porte.forEach((k, i) => rackDefs.push([k, 5.1 + i * 0.6, 1]));
  const rackPos = {};
  for (const [k, lx, side] of rackDefs) rackPos[k] = buildRack(B, k, lx, side);
  block(3.95, 8.15, IN.z0, IN.z0 + 0.85, 'rack', 'Baies');
  block(4.8, 8.4, IN.z1 - 0.85, IN.z1, 'rack', 'Baies');
  for (const [k, lx, side] of rackDefs) LAYOUT.furniture.push({ x0: lx - 0.29, x1: lx + 0.29, z0: side < 0 ? IN.z0 : IN.z1 - 0.85, z1: side < 0 ? IN.z0 + 0.85 : IN.z1, kind: 'rackunit', label: RACKS[k].title });
  // pupitre HF au fond
  B.box(0.62, 0.75, 2.2, X(8.45), F + 0.375, Z(-0.45), desk); B.box(0.66, 0.04, 2.25, X(8.45), F + 0.77, Z(-0.45), deskTop);
  block(8.14, 8.8, -1.55, 0.65, 'desk', 'Pupitre HF');
  chairAt(B, 7.75, -0.45, 0, -Math.PI / 2);
  // chemins de câbles au plafond
  for (const lz of [-1.6, 1.6]) B.box(L - 0.6, 0.05, 0.3, cx, TRUCK.ceil - 0.12, Z(lz), 0x50565e);
  // bandeaux lumineux au plafond (diffus)
  const strips = new Builder();
  for (const lx of [-7, -4, -1.5, 1.2, 3, 5.5, 7.5]) strips.box(1.2, 0.02, 0.18, X(lx), TRUCK.ceil - 0.03, Z(0.4), 0xffffff);
  scene.add(new THREE.Mesh(strips.build(), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xc8d2e0).multiplyScalar(2.6) })));
  scene.add(new THREE.Mesh(glow.build(), new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(2.4, 2.4, 2.4) })));
  // dans l'encadrement de porte : la lumière du compound
  {
    const { c, g, tex } = canvasTex(128, 256);
    const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#bcd4ee'); gr.addColorStop(0.55, '#e8eef4'); gr.addColorStop(0.6, '#5a5e62'); gr.addColorStop(1, '#3b3e40');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 256); tex.needsUpdate = true;
    const out = new THREE.Mesh(new THREE.PlaneGeometry(DOOR.x1 - DOOR.x0 + 0.4, 2.6), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
    out.position.set(X((DOOR.x0 + DOOR.x1) / 2), F + 0.9, Z(IN.z1 + 0.6)); out.rotation.y = Math.PI; scene.add(out);
  }
  // balisage au sol de l'allée (LED ambre)
  const guide = new Builder();
  for (let lx = -8.2; lx <= 8.2; lx += 0.8) { guide.box(0.12, 0.012, 0.03, X(lx), F + 0.01, Z(1.36), 0xffffff); guide.box(0.12, 0.012, 0.03, X(lx), F + 0.01, Z(IN.z1 - 0.12), 0xffffff); }
  scene.add(new THREE.Mesh(guide.build(), new THREE.MeshBasicMaterial({ color: 0xffb030, toneMapped: false })));

  // pieds des écrans EVS posés sur le bureau
  for (const lx of [1.5, 3.0]) B.box(0.06, 0.22, 0.06, X(lx), F + 0.9, Z(-0.16), 0x111111);
  const mesh = B.mesh(pbr(new THREE.MeshLambertMaterial({ vertexColors: true }), 0.62, 0.08));
  scene.add(mesh);

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
    scene.add(leds); T.leds = leds;
  }

  // lumières : ambiance plus claire, appoints au-dessus des rangées
  scene.add(new THREE.HemisphereLight(0xdfe4ec, 0x3a3836, 1.55));
  for (const [lx, lz, i] of [[-7, 0, 3], [-3.6, -1.0, 4], [-2, 1.6, 3.5], [1.2, -1.0, 4], [2.6, 1.6, 3.5], [5.2, 0, 4], [7.6, 0, 3.5]]) {
    const p = new THREE.PointLight(0xe6ecf5, i, 6, 1.2);
    p.position.set(X(lx), TRUCK.ceil - 0.3, Z(lz)); scene.add(p);
  }

  // écrans
  screen('mv', 2.3, 1.29, -2.85, 1.6, IN.z0 + 0.19, 0, 'MULTIVIEW PRODUCTION');
  screen('retant', 0.72, 0.405, -4.72, 2.0, IN.z0 + 0.19, 0, 'RETOUR ANTENNE');
  screen('clean', 0.72, 0.405, -4.72, 1.25, IN.z0 + 0.19, 0, 'CLEAN FEED');
  screen('pgm', 0.72, 0.405, -0.95, 2.0, IN.z0 + 0.19, 0, 'PGM');
  screen('pvw', 0.72, 0.405, -0.95, 1.25, IN.z0 + 0.19, 0, 'PVW');
  screen('mv2', 1.55, 0.87, 1.2, 1.6, IN.z0 + 0.19, 0, 'MULTIVIEW VISION');
  screen('ref', 0.9, 0.506, 2.95, 1.25, IN.z0 + 0.19, 0, 'MONITEUR GRADE 1');
  screen('scope', 0.9, 0.506, 2.95, 1.97, IN.z0 + 0.19, 0, 'OSCILLOSCOPE');
  screen('evsA', 0.56, 0.315, 1.5, 1.2, -0.12, 0, 'EVS A');
  screen('evsB', 0.56, 0.315, 3.0, 1.2, -0.12, 0, 'IPDIRECTOR');
  screen('audioMv', 0.95, 0.534, IN.x0 + 0.12, 1.5, -0.45, Math.PI / 2, 'PGM / MULTIVIEW');
  screen('hfmon', 0.75, 0.42, IN.x1 - 0.12, 1.45, -0.9, -Math.PI / 2, 'RÉCEPTION HF');
  screen('hfspec', 0.75, 0.42, IN.x1 - 0.12, 1.45, 0.05, -Math.PI / 2, 'SPECTRE');

  // pupitres (textures détaillées)
  deskPanel('mixer', 1.6, 0.55, -1.25, -1.6, drawICP);
  deskPanel('director', 0.9, 0.3, -2.9, -1.55, drawIntercom);
  deskPanel('scripte', 0.9, 0.3, -4.3, -1.55, drawScripte);
  deskPanel('rcp', 3.0, 0.42, 2.07, -1.6, drawRCPRow);
  deskPanel('lsm', 2.6, 0.4, 2.25, 0.0, drawLSM, 0.79, 0.16);
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
  const st = (id, label, lx, lz, look, opts = {}) => {
    const fy = truckFloorAt(X(lx), Z(lz)) - F;
    const pos = new THREE.Vector3(X(lx), F + fy + 1.2, Z(lz));
    const lk = new THREE.Vector3(X(look[0]), F + look[1], Z(look[2]));
    const lab = stationLabel(label); lab.position.copy(lk); lab.position.y += opts.labelDy ?? 0.35; scene.add(lab);
    if (opts.zone === 'tech' && id !== 'hf') lab.position.y += (T.stations.filter((x) => x.zone === 'tech').length % 2) * 0.32;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.26, 28), new THREE.MeshBasicMaterial({ color: 0x8a9098, transparent: true, opacity: 0.55, toneMapped: false, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(X(lx), F + fy + 0.012, Z(lz)); scene.add(ring);
    T.stations.push({ id, label, short: opts.short, pos, look: lk, r: opts.r || 1.6, station: opts.station || id, arg: opts.arg, device: opts.device, zone: opts.zone, sprite: lab, ring, lx, lz });
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
  st('reseau', 'Réseau IP · spines et multiview', 6.65, -1.3, rk('mv'), { r: 1.1, zone: 'tech', device: 'swred', short: 'Réseau IP' });
  st('evsrack', 'Serveur EVS XT4K', 7.25, -1.3, rk('evs'), { r: 1.1, station: 'evs', arg: 0, zone: 'tech', device: 'evs' });
  st('transmission', 'Transmission', 7.85, -1.3, rk('tx'), { r: 1.1, zone: 'tech', device: 'conv' });
  st('synchro', 'Synchro (SPG)', 5.1, 1.3, rk('spg'), { r: 1.1, zone: 'tech', device: 'spg' });
  st('intercom', 'Intercom', 5.7, 1.3, rk('icom'), { r: 1.1, zone: 'tech' });
  st('mvproc', 'Baie de brassage', 6.3, 1.3, rk('patch'), { r: 1.1, station: 'brassage', zone: 'tech', device: 'pdc' });
  st('audiorack', 'Audio (MADI, embedders)', 6.9, 1.3, rk('audio'), { r: 1.1, station: 'son', zone: 'tech', short: 'Audio (MADI)' });
  st('hf', 'Régie HF', 7.75, -0.45, [8.65, 1.45, -0.45], { r: 1.3, zone: 'tech', device: 'rx' });
  return scene;
}

function chairAt(B, lx, lz, y0 = 0, rot = 0) {
  const x = X(lx), z = Z(lz);
  B.box(0.5, 0.08, 0.5, x, F + y0 + 0.48, z, 0x1b1d21, rot);
  const bx = Math.sin(rot) * 0.22, bz = Math.cos(rot) * 0.22;
  B.box(0.48, 0.55, 0.06, x + bx, F + y0 + 0.8, z + bz, 0x1b1d21, rot);
  for (const s of [-1, 1]) { const ax = Math.cos(rot) * 0.26 * s, az = -Math.sin(rot) * 0.26 * s; B.box(0.05, 0.04, 0.32, x + ax, F + y0 + 0.66, z + az, 0x2c2f34, rot); }
  B.cyl(0.03, 0.03, 0.42, x, F + y0 + 0.24, z, 0x50555c, 6);
  for (let k = 0; k < 5; k++) { const a = rot + k * 1.2566; B.box(0.04, 0.03, 0.3, x + Math.sin(a) * 0.15, F + y0 + 0.04, z + Math.cos(a) * 0.15, 0x2a2d31, a); }
}

// ---------------- mise à jour : LED, étiquettes et repères ----------------
export function updateTruck(t) {
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
    if (s.sprite.userData.hot !== hot) { s.sprite.userData.hot = hot; s.sprite.userData.draw(hot); }
    s.ring.material.color.setHex(hot ? 0xffb020 : 0x8a9098);
    s.ring.material.opacity = hot ? 0.75 + 0.25 * Math.sin(t * 6) : 0.4;
  }
}

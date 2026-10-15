import * as THREE from 'three';
import { Builder, screenMaterial } from './geo.js';
import { TRUCK, labelSprite } from './world.js';
import { makeCanvas } from './util.js';

// Intérieur du car régie : scène séparée (pas de fenêtres, on ne voit pas l'extérieur)
export const T = { scene: null, screens: {}, stations: [], panels: {}, leds: null, ledColors: [], blockers: [] };

const F = TRUCK.floor;
const X = (lx) => TRUCK.cx + lx;
const Z = (lz) => TRUCK.cz + lz;
const IN = { x0: -8.8, x1: 8.8, z0: -2.7, z1: 2.7 };

export function truckBlocked(x, z) {
  const lx = x - TRUCK.cx, lz = z - TRUCK.cz;
  // sortie par la porte
  if (lz > IN.z1 && lx > TRUCK.doorX0 - TRUCK.cx && lx < TRUCK.doorX1 - TRUCK.cx) return false;
  if (lx < IN.x0 + 0.25 || lx > IN.x1 - 0.25 || lz < IN.z0 + 0.25 || lz > IN.z1 - 0.25) return true;
  for (const b of T.blockers) if (lx > b[0] && lx < b[1] && lz > b[2] && lz < b[3]) return true;
  return false;
}

function screen(name, w, h, lx, y, lz, rotY = 0, label) {
  const mat = screenMaterial(null, { gain: 1.1 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.position.set(X(lx), F + y, Z(lz)); m.rotation.y = rotY;
  T.scene.add(m);
  const bezel = new THREE.Mesh(new THREE.BoxGeometry(w + 0.04, h + 0.04, 0.04), new THREE.MeshLambertMaterial({ color: 0x0b0c0e }));
  bezel.position.copy(m.position); bezel.rotation.y = rotY; bezel.translateZ(-0.025); T.scene.add(bezel);
  T.screens[name] = mat;
  if (label) {
    const s = labelSprite(label, { scale: 0.9, border: 'rgba(120,130,140,0.6)', size: 40 });
    s.position.copy(m.position); s.position.y -= h / 2 + 0.07; T.scene.add(s);
  }
  return mat;
}

function panelTexture(name, w, h) {
  const c = makeCanvas(w, h); const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  T.panels[name] = { canvas: c, ctx: c.getContext('2d'), tex };
  return tex;
}

function deskPanel(name, w, d, lx, lz, tilt = 0.18) {
  const tex = panelTexture(name, 1024, Math.round(1024 * d / w));
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  m.rotation.x = -Math.PI / 2 + tilt; m.position.set(X(lx), F + 0.79, Z(lz));
  T.scene.add(m);
  return m;
}

export function buildTruck() {
  const scene = new THREE.Scene();
  T.scene = scene;
  scene.background = new THREE.Color(0x050608);
  const B = new Builder();
  const wall = 0x2a2f36, floor = 0x1a1d22, desk = 0x2c3138, deskTop = 0x3a4048, chair = 0x15171a, rack = 0x16181b, ceil = 0x23272d;
  const cx = TRUCK.cx, cz = TRUCK.cz;
  const L = IN.x1 - IN.x0, Wd = IN.z1 - IN.z0, H = TRUCK.ceil - F;
  // sol, plafond, murs
  B.box(L, 0.05, Wd, cx, F - 0.025, cz, floor);
  B.box(L, 0.05, Wd, cx, TRUCK.ceil, cz, ceil);
  B.box(L, H, 0.1, cx, F + H / 2, Z(IN.z0), wall);
  // mur côté porte, avec ouverture
  const dx0 = TRUCK.doorX0 - cx, dx1 = TRUCK.doorX1 - cx;
  B.box(dx0 - IN.x0, H, 0.1, X((IN.x0 + dx0) / 2), F + H / 2, Z(IN.z1), wall);
  B.box(IN.x1 - dx1, H, 0.1, X((IN.x1 + dx1) / 2), F + H / 2, Z(IN.z1), wall);
  B.box(dx1 - dx0, H - 2.05, 0.1, X((dx0 + dx1) / 2), F + 2.05 + (H - 2.05) / 2, Z(IN.z1), wall);
  B.box(0.1, H, Wd, X(IN.x0), F + H / 2, cz, wall); B.box(0.1, H, Wd, X(IN.x1), F + H / 2, cz, wall);
  // cloison son / production (porte côté allée + vitre)
  const ps = -5.4;
  B.box(0.1, H, 3.9, X(ps), F + H / 2, Z(-0.75), 0x30353c);
  B.box(0.1, H - 2.05, 1.5, X(ps), F + 2.05 + (H - 2.05) / 2, Z(1.95), 0x30353c);
  T.blockers.push([ps - 0.1, ps + 0.1, IN.z0, 1.2]);
  // cloison vision / technique
  const pt = 3.9;
  B.box(0.1, H, 2.1, X(pt), F + H / 2, Z(-1.65), 0x30353c); B.box(0.1, H, 2.1, X(pt), F + H / 2, Z(1.65), 0x30353c);
  B.box(0.1, H - 2.05, 1.2, X(pt), F + 2.05 + (H - 2.05) / 2, cz, 0x30353c);
  T.blockers.push([pt - 0.1, pt + 0.1, IN.z0, -0.6]); T.blockers.push([pt - 0.1, pt + 0.1, 0.6, IN.z1]);

  // --- Régie production ---
  // rangée 1
  B.box(4.9, 0.75, 0.75, X(-2.75), F + 0.375, Z(-1.62), desk); B.box(4.95, 0.04, 0.8, X(-2.75), F + 0.77, Z(-1.62), deskTop);
  T.blockers.push([-5.25, -0.25, -2.05, -1.2]);
  // rangée 2 (estrade)
  B.box(5.4, 0.18, 2.0, X(-2.7), F + 0.09, Z(0.55), 0x202328);
  B.box(4.9, 0.75, 0.6, X(-2.75), F + 0.18 + 0.375, Z(0.05), desk); B.box(4.95, 0.04, 0.65, X(-2.75), F + 0.95, Z(0.05), deskTop);
  T.blockers.push([-5.25, -0.25, -0.3, 0.38]);
  for (const lx of [-4.3, -2.9, -1.3]) { chairAt(B, lx, -0.75, 0); chairAt(B, lx, 0.95, 0.18); }
  // mur d'écrans production
  B.box(5.3, 1.45, 0.08, X(-2.75), F + 1.55, Z(IN.z0 + 0.1), 0x0d0e10);
  // --- Régie vision et ralentis ---
  B.box(3.3, 0.75, 0.75, X(2.05), F + 0.375, Z(-1.62), desk); B.box(3.35, 0.04, 0.8, X(2.05), F + 0.77, Z(-1.62), deskTop);
  T.blockers.push([0.35, 3.75, -2.05, -1.2]);
  B.box(3.3, 0.75, 0.6, X(2.05), F + 0.375, Z(0.05), desk); B.box(3.35, 0.04, 0.65, X(2.05), F + 0.77, Z(0.05), deskTop);
  T.blockers.push([0.35, 3.75, -0.3, 0.38]);
  for (const lx of [1.1, 2.8]) { chairAt(B, lx, -0.75, 0); chairAt(B, lx, 0.95, 0); }
  B.box(3.5, 1.45, 0.08, X(2.05), F + 1.55, Z(IN.z0 + 0.1), 0x0d0e10);
  // --- Régie son ---
  B.box(0.9, 0.78, 2.8, X(-7.7), F + 0.39, Z(-0.4), desk);
  B.box(1.0, 0.04, 2.9, X(-7.65), F + 0.8, Z(-0.4), deskTop);
  T.blockers.push([-8.2, -7.2, -1.85, 1.05]);
  chairAt(B, -6.7, -0.4, 0, Math.PI / 2);
  B.box(0.3, 0.45, 0.3, X(-8.55), F + 2.2, Z(-1.9), 0x111111); B.box(0.3, 0.45, 0.3, X(-8.55), F + 2.2, Z(1.1), 0x111111);
  B.box(0.3, 0.3, 0.3, X(-8.55), F + 2.4, Z(-0.4), 0x111111);
  // panneaux acoustiques
  for (let i = 0; i < 5; i++) B.box(0.05, 1.2, 0.5, X(-8.78), F + 1.4, Z(-2.3 + i * 0.95), 0x3b3f46);
  // --- Zone technique (baies) ---
  const rackCols = [];
  for (let i = 0; i < 8; i++) {
    const lx = 4.25 + i * 0.6;
    B.box(0.58, 2.05, 0.85, X(lx), F + 1.025, Z(IN.z0 + 0.45), rack);
    rackCols.push({ lx, lz: IN.z0 + 0.9, side: -1 });
    if (i < 7) { B.box(0.58, 2.05, 0.85, X(lx), F + 1.025, Z(IN.z1 - 0.45), rack); rackCols.push({ lx, lz: IN.z1 - 0.9, side: 1 }); }
  }
  T.blockers.push([3.95, 8.8, IN.z0, IN.z0 + 0.9]); T.blockers.push([3.95, 8.2, IN.z1 - 0.9, IN.z1]);
  // pupitre HF au fond
  B.box(0.7, 0.75, 1.6, X(8.4), F + 0.375, Z(0.5), desk); B.box(0.75, 0.04, 1.65, X(8.4), F + 0.77, Z(0.5), deskTop);
  T.blockers.push([8.05, 8.8, -0.3, 1.3]);
  // bandeaux lumineux au plafond
  const strips = new Builder();
  for (const lx of [-7, -2.75, 2.05, 6.3]) strips.box(1.6, 0.03, 0.12, X(lx), TRUCK.ceil - 0.03, Z(0.6), 0xffffff);
  const stripMesh = new THREE.Mesh(strips.build(), new THREE.MeshBasicMaterial({ color: 0xb8c4d8 }));
  scene.add(stripMesh);

  const mesh = B.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }));
  scene.add(mesh);

  // façades de baies : unités 1U/2U et LED
  buildRacks(rackCols);

  // lumières
  scene.add(new THREE.HemisphereLight(0xaab8cc, 0x2a2a2a, 1.1));
  for (const lx of [-7, -2.75, 2.05, 6.3]) {
    const p = new THREE.PointLight(0xd8e0ee, 4.5, 0, 1);
    p.position.set(X(lx), TRUCK.ceil - 0.25, Z(0.4)); scene.add(p);
  }

  // écrans
  screen('mv', 2.3, 1.29, -2.85, 1.55, IN.z0 + 0.16, 0, 'MULTIVIEW PRODUCTION');
  screen('retant', 0.72, 0.405, -4.72, 1.95, IN.z0 + 0.16, 0, 'RETOUR ANTENNE');
  screen('clean', 0.72, 0.405, -4.72, 1.2, IN.z0 + 0.16, 0, 'CLEAN FEED');
  screen('pgm', 0.72, 0.405, -0.95, 1.95, IN.z0 + 0.16, 0, 'PGM');
  screen('pvw', 0.72, 0.405, -0.95, 1.2, IN.z0 + 0.16, 0, 'PVW');
  screen('mv2', 1.55, 0.87, 1.15, 1.5, IN.z0 + 0.16, 0, 'MULTIVIEW VISION');
  screen('ref', 0.9, 0.506, 2.9, 1.2, IN.z0 + 0.16, 0, 'MONITEUR GRADE 1');
  screen('scope', 0.9, 0.506, 2.9, 1.92, IN.z0 + 0.16, 0, 'OSCILLOSCOPE / VECTEURSCOPE');
  screen('evsA', 0.56, 0.315, 1.1, 1.2, -0.12, 0, 'EVS A');
  screen('evsB', 0.56, 0.315, 2.8, 1.2, -0.12, 0, 'EVS B');
  screen('audioMv', 0.95, 0.534, IN.x0 + 0.08, 1.45, -0.4, Math.PI / 2, 'PGM / MULTIVIEW');
  screen('hfmon', 0.75, 0.42, IN.x1 - 0.1, 1.45, 0.5, -Math.PI / 2, 'RÉCEPTION HF');
  screen('hfspec', 0.75, 0.42, IN.x1 - 0.1, 1.95, 0.5, -Math.PI / 2, null);

  // pupitres (textures dessinées dynamiquement)
  deskPanel('mixer', 1.6, 0.55, -1.25, -1.62);
  deskPanel('rcp', 2.2, 0.42, 2.0, -1.62);
  deskPanel('lsm', 2.4, 0.4, 2.0, 0.05).position.y = F + 0.78;
  deskPanel('audio', 0.8, 2.6, -7.65, -0.4, 0).rotation.z = Math.PI / 2;
  deskPanel('intercom', 0.9, 0.3, -2.9, -1.62);
  deskPanel('gfx', 0.9, 0.3, -4.3, 0.05).position.y = F + 0.97;

  // postes (points d'interaction)
  const st = (id, label, lx, lz, opts = {}) => {
    const pos = new THREE.Vector3(X(lx), F + 1.2, Z(lz));
    T.stations.push({ id, label, pos, r: opts.r || 1.5, station: opts.station || id, arg: opts.arg });
    const s = labelSprite(label, { scale: 0.2, size: 40, fixed: true }); s.position.set(X(lx), F + 1.3, Z(opts.labelZ ?? lz)); scene.add(s);
  };
  st('son', 'Son', -6.7, -0.4, { r: 1.6 });
  st('scripte', 'Scripte', -4.3, -0.75);
  st('realisateur', 'Réalisateur', -2.9, -0.75);
  st('melangeur', 'Truquiste · Mélangeur', -1.3, -0.75);
  st('habillage', 'Habillage', -4.3, 0.95);
  st('producteur', 'Production', -2.9, 0.95);
  st('chefdecar', 'Chef de car', -1.3, 0.95);
  st('vision1', 'Ingé vision 1', 1.1, -0.75, { station: 'vision', arg: 0 });
  st('vision2', 'Ingé vision 2', 2.8, -0.75, { station: 'vision', arg: 1 });
  st('evsA', 'EVS A (ralentis)', 1.1, 0.95, { station: 'evs', arg: 0 });
  st('evsB', 'EVS B (ralentis)', 2.8, 0.95, { station: 'evs', arg: 1 });
  st('ccu', 'Baie CCU', 4.55, -1.4, { r: 1.2 });
  st('grille', 'Grille', 5.75, -1.4, { r: 1.2 });
  st('mvproc', 'Multiview / Mélangeur (châssis)', 6.95, -1.4, { r: 1.2, station: 'grille' });
  st('evsrack', 'Serveurs EVS', 8.2, -1.4, { r: 1.0, station: 'evs', arg: 0 });
  st('synchro', 'Synchro (SPG)', 4.55, 1.4, { r: 1.2 });
  st('intercom', 'Intercom', 5.75, 1.4, { r: 1.2 });
  st('transmission', 'Transmission', 6.95, 1.4, { r: 1.2 });
  st('hf', 'Régie HF', 7.9, 0.5, { r: 1.3 });
  return scene;
}

function chairAt(B, lx, lz, y0 = 0, rot = 0) {
  const x = X(lx), z = Z(lz);
  B.box(0.5, 0.08, 0.5, x, F + y0 + 0.48, z, 0x15171a, rot);
  const bx = Math.sin(rot) * 0.22, bz = Math.cos(rot) * 0.22;
  B.box(0.5, 0.55, 0.06, x + bx, F + y0 + 0.78, z + bz, 0x15171a, rot);
  B.cyl(0.03, 0.03, 0.45, x, F + y0 + 0.23, z, 0x333333, 6);
  B.box(0.55, 0.04, 0.06, x, F + y0 + 0.03, z, 0x333333, rot); B.box(0.06, 0.04, 0.55, x, F + y0 + 0.03, z, 0x333333, rot);
}

function buildRacks(cols) {
  // unités en façade : textures
  const B = new Builder();
  const ledPos = [];
  const r = (n) => Math.sin(n * 12.9898) * 43758.5453 % 1;
  cols.forEach((c, ci) => {
    const x = X(c.lx), zf = Z(c.lz) + (c.side < 0 ? 0.01 : -0.01);
    let y = 0.15;
    let k = 0;
    while (y < 1.95) {
      const u = (Math.abs(r(ci * 31 + k)) < 0.35 ? 2 : 1) * 0.0445;
      B.box(0.48, u - 0.004, 0.02, x, F + y + u / 2, zf, Math.abs(r(ci * 7 + k)) < 0.5 ? 0x2b2f35 : 0x3a3f46);
      const nLed = 2 + Math.floor(Math.abs(r(ci * 13 + k)) * 5);
      for (let j = 0; j < nLed; j++) ledPos.push([x - 0.2 + j * 0.03, F + y + u / 2, zf + (c.side < 0 ? 0.012 : -0.012), ci, k]);
      y += u + 0.002; k++;
    }
  });
  const m = B.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }));
  T.scene.add(m);
  const ledGeo = new THREE.BoxGeometry(0.012, 0.008, 0.004);
  const leds = new THREE.InstancedMesh(ledGeo, new THREE.MeshBasicMaterial({ toneMapped: false }), ledPos.length);
  const mat = new THREE.Matrix4(); const col = new THREE.Color();
  ledPos.forEach((p, i) => {
    mat.makeTranslation(p[0], p[1], p[2]); leds.setMatrixAt(i, mat);
    const h = Math.abs(r(i * 3.1));
    col.setHex(h < 0.7 ? 0x30ff60 : h < 0.85 ? 0x40a0ff : h < 0.95 ? 0xffb020 : 0xff3030);
    leds.setColorAt(i, col);
    T.ledColors.push(col.getHex());
  });
  T.scene.add(leds);
  T.leds = leds;
  // étiquettes de baies
  const names = ['CCU 1-8', 'Synchro', 'CCU 9-16', 'Intercom', 'Grille', 'Transmission', 'Mélangeur', 'Audio MADI', 'Multiview', 'Récepteurs HF', 'EVS 1', 'Patch', 'EVS 2', 'Onduleur', 'Encodeurs'];
  cols.forEach((c, i) => {
    const s = labelSprite(names[i] || 'Baie', { scale: 0.6, size: 46, border: 'rgba(90,100,110,0.7)' });
    s.position.set(X(c.lx), F + 2.18, Z(c.lz)); T.scene.add(s);
  });
}

// clignotement des LED de baies
export function updateTruck(t) {
  if (!T.leds || (Math.floor(t * 4) % 2)) return;
  const col = new THREE.Color();
  const n = T.leds.count;
  for (let k = 0; k < 6; k++) {
    const i = Math.floor(Math.random() * n);
    const base = T.ledColors[i];
    col.setHex(Math.random() < 0.5 ? base : 0x0a0a0a);
    T.leds.setColorAt(i, col);
  }
  T.leds.instanceColor.needsUpdate = true;
}

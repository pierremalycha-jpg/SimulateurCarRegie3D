// @ts-check
import * as THREE from 'three';
import { RENDER, refreshEnvironment, pbr } from './render.js';
import { buildGround, buildTrees, forestPoints, terrilGeometry } from './landscape.js';
import { buildOBTruck, buildDSNG, buildGenerator, buildBungalows, tarmacTexture } from './vehicles.js';
import { Builder, mergeNonIndexed, setLayer, screenMaterial } from './geo.js';
import { matiere } from './matiere.js';
import { makeCanvas, mulberry32, kelvinRGBNorm } from './util.js';
import { S } from './state.js';
import { TEAMS } from './data/match.js';
import { ANTENNAS } from './data/stadium.js';

// --- Dimensions du stade (m) : inspiré du stade Bollaert-Delelis (Lens) ---
// Quatre tribunes séparées, angles ouverts, terrain 105 × 68 m orienté est-ouest.
//   z < 0 : sud, tribune Lepagnot (principale : vestiaires, presse, TV, passerelle caméras)
//   z > 0 : nord, tribune Marek-Xercès (Marek : kop debout en bas, Xercès en haut)
//   x < 0 : ouest, tribune Trannin (le long de la voie ferrée, parcage visiteurs)
//   x > 0 : est, tribune Delacourt
export const PITCH = { hl: 52.5, hw: 34 };
export const BOWL = { hx: 61, hz: 41 }; // bord intérieur des tribunes
// profil de chaque tribune en fonction du décalage o depuis le bord intérieur :
//   lo / up : tribune basse / haute [o début, o fin, hauteur début, hauteur fin] ; back : profondeur ; roof : hauteur du toit
export const STANDS = [
  { id: 'lepagnot', name: 'Tribune Lepagnot', axis: 'z', sgn: -1, half: 58, lo: [0, 22, 1.5, 11], up: [29.4, 44, 18.2, 30], back: 52, roof: 34, main: true },
  { id: 'marek', name: 'Tribune Marek-Xercès', axis: 'z', sgn: 1, half: 58, lo: [0, 22, 1.2, 11], up: [25, 40, 13.5, 24.5], back: 41.5, roof: 31.5 },
  { id: 'trannin', name: 'Tribune Trannin', axis: 'x', sgn: -1, half: 37, lo: [0, 22, 1.2, 11], up: [25, 36, 13.5, 22.5], back: 37.5, roof: 29.5 },
  { id: 'delacourt', name: 'Tribune Delacourt', axis: 'x', sgn: 1, half: 37, lo: [0, 22, 1.2, 11], up: [25, 41, 13.5, 26], back: 42.5, roof: 31.5 },
];
// compatibilité : tribune principale
export const TIERS = { lower: { o1: 0, o2: 22, y1: 1.5, y2: 11 }, upper: { o1: 29.4, o2: 44, y1: 18.2, y2: 30 } };
export const OUTER = { hx: BOWL.hx + 52, hz: BOWL.hz + 52 };
// pylônes d'angle (≈ 72 m) qui portent l'anneau de poutres du toit
export const MASTS = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => [sx * (BOWL.hx + 10), sz * (BOWL.hz + 10)]);
export const RING_Y = 37;
export const TRUCK = { cx: -18, cz: -120, len: 18, wid: 5.8, floor: 1.2, ceil: 3.45, doorX0: -17.75, doorX1: -16.75 };
TRUCK.x0 = TRUCK.cx - TRUCK.len / 2; TRUCK.x1 = TRUCK.cx + TRUCK.len / 2;
TRUCK.z0 = TRUCK.cz - TRUCK.wid / 2; TRUCK.z1 = TRUCK.cz + TRUCK.wid / 2;

export const W = {
  scene: null, sun: null, flood1: null, flood2: null, hemi: null, sky: null,
  roofMeshes: [], screens: [], boardsMat: null, crowdMat: null, floodMat: null,
  interactables: [], obstacles: [], walkable: [], antennaMeshes: {}, giantScreen: null, train: null,
};

export function profileY(st, o) {
  if (o < 0) return 0;
  const [a1, a2, b1, b2] = st.lo, [c1, c2, d1, d2] = st.up;
  if (o <= a2) return b1 + (o - a1) / (a2 - a1) * (b2 - b1);
  if (o < c1) return b2; // coursive / niveau des loges
  if (o <= c2) return d1 + (o - c1) / (c2 - c1) * (d2 - d1);
  if (o <= st.back) return d2 + 1.2;
  return 0;
}
// tribune sous le point (x, z) et décalage depuis son bord intérieur ; null dans les angles ouverts
export function standAt(x, z, margin = 0) {
  const ax = Math.abs(x), az = Math.abs(z);
  for (const st of STANDS) {
    if (st.axis === 'z') { if (Math.sign(z) !== st.sgn || ax > st.half) continue; const o = az - BOWL.hz; if (o >= -margin && o <= st.back) return { st, o }; }
    else { if (Math.sign(x) !== st.sgn || az > st.half) continue; const o = ax - BOWL.hx; if (o >= -margin && o <= st.back) return { st, o }; }
  }
  return null;
}
export function standHeightAt(x, z) { const s = standAt(x, z); return s ? profileY(s.st, s.o) : 0; }
// hauteur des gradins de la tribune principale pour un décalage o (compatibilité)
export function standHeight(o) { return profileY(STANDS[0], o); }
export function bowlOffset(x, z) { return Math.max(Math.abs(x) - BOWL.hx, Math.abs(z) - BOWL.hz); }

// Zones praticables à l'intérieur du volume des tribunes (tunnel, couloir, vestiaires, local TV)
const WALK_ZONES = [
  { x0: -5, x1: 5, z0: -47.5, z1: -40.5 }, // embouchure du tunnel
  { x0: -3, x1: 3, z0: -93.5, z1: -47 }, // couloir
  { x0: 3, x1: 16, z0: -84, z1: -72 }, // vestiaire
  { x0: -16, x1: -3, z0: -91, z1: -82 }, // local technique TV
];
export function inWalkZone(x, z) { for (const w of WALK_ZONES) if (x > w.x0 && x < w.x1 && z > w.z0 && z < w.z1) return true; return false; }

export function blockedOutside(x, z) {
  if (Math.abs(x) > 320 || Math.abs(z) > 320) return true;
  if (standAt(x, z, 0.4) && !inWalkZone(x, z)) return true;
  // murs internes vestiaire / local (portes)
  if (x > 3 && x < 3.3 && z > -84 && z < -72 && !(z > -79.5 && z < -77.5)) return true;
  if (x < -3 && x > -3.3 && z > -91 && z < -82 && !(z > -87.5 && z < -85.5)) return true;
  for (const o of W.obstacles) if (x > o.x0 && x < o.x1 && z > o.z0 && z < o.z1) return true;
  return false;
}

export function inTruckFootprint(x, z) { return x > TRUCK.x0 && x < TRUCK.x1 && z > TRUCK.z0 && z < TRUCK.z1; }
export function groundHeight(x, z) {
  if (inTruckFootprint(x, z)) return TRUCK.floor;
  // marches devant la porte
  if (x > TRUCK.doorX0 - 0.3 && x < TRUCK.doorX1 + 0.3 && z >= TRUCK.z1 && z < TRUCK.z1 + 1.8) {
    const t = 1 - (z - TRUCK.z1) / 1.8; return Math.floor(t * 4) / 4 * TRUCK.floor;
  }
  return 0;
}

// ----------------------------------------------------------------------------------
// Textures procédurales
// ----------------------------------------------------------------------------------
function pitchTexture(renderer) {
  const Wt = 2560, Ht = 1720; const sx = Wt / 122, sy = Ht / 82;
  const c = makeCanvas(Wt, Ht); const g = c.getContext('2d');
  const X = (m) => (m + 61) * sx, Y = (m) => (m + 41) * sy;
  g.fillStyle = '#2f6a2d'; g.fillRect(0, 0, Wt, Ht);
  // bandes de tonte
  for (let i = 0; i < 20; i++) {
    g.fillStyle = i % 2 ? '#3d7b38' : '#35702f';
    g.fillRect(X(-52.5 - 2.5 + i * 5.5 + 0.0), Y(-37), 5.5 * sx + 1, 74 * sy);
  }
  // bruit
  const r = mulberry32(7);
  for (let i = 0; i < 90000; i++) {
    g.fillStyle = `rgba(${r() < 0.5 ? '20,40,15' : '120,160,90'},${0.05 + r() * 0.06})`;
    g.fillRect(r() * Wt, r() * Ht, 2 + r() * 3, 2 + r() * 3);
  }
  g.strokeStyle = 'rgba(240,244,236,0.95)'; g.lineWidth = 0.12 * sx; g.lineCap = 'butt';
  const L = 52.5, Wd = 34;
  g.strokeRect(X(-L), Y(-Wd), 2 * L * sx, 2 * Wd * sy);
  g.beginPath(); g.moveTo(X(0), Y(-Wd)); g.lineTo(X(0), Y(Wd)); g.stroke();
  g.beginPath(); g.ellipse(X(0), Y(0), 9.15 * sx, 9.15 * sy, 0, 0, Math.PI * 2); g.stroke();
  g.fillStyle = 'rgba(240,244,236,0.95)';
  const spot = (x, z, rr = 0.15) => { g.beginPath(); g.ellipse(X(x), Y(z), rr * sx, rr * sy, 0, 0, Math.PI * 2); g.fill(); };
  spot(0, 0);
  for (const s of [-1, 1]) {
    const gx = s * L;
    // surface de réparation 16,5 x 40,32
    g.strokeRect(Math.min(X(gx), X(gx - s * 16.5)), Y(-20.16), 16.5 * sx, 40.32 * sy);
    g.strokeRect(Math.min(X(gx), X(gx - s * 5.5)), Y(-9.16), 5.5 * sx, 18.32 * sy);
    spot(gx - s * 11, 0);
    // arc de cercle
    g.beginPath();
    const a = Math.acos(5.5 / 9.15);
    if (s < 0) g.ellipse(X(gx + 11), Y(0), 9.15 * sx, 9.15 * sy, 0, -a, a);
    else g.ellipse(X(gx - 11), Y(0), 9.15 * sx, 9.15 * sy, 0, Math.PI - a, Math.PI + a);
    g.stroke();
    // corners
    for (const t of [-1, 1]) {
      g.beginPath();
      const cx = X(gx), cy = Y(t * Wd);
      const start = s < 0 ? (t < 0 ? 0 : -Math.PI / 2) : (t < 0 ? Math.PI / 2 : Math.PI);
      g.ellipse(cx, cy, 1 * sx, 1 * sy, 0, start, start + Math.PI / 2); g.stroke();
    }
  }
  // zone technique
  g.setLineDash([0.5 * sx, 0.5 * sx]); g.lineWidth = 0.08 * sx;
  for (const s of [-1, 1]) g.strokeRect(X(s * 4 - (s > 0 ? 0 : 10)), Y(-Wd - 3.5), 10 * sx, 2.6 * sy);
  g.setLineDash([]);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

// grain de la pelouse vu de près : brins (traits verticaux) et petites touffes, répété tous les 1,4 m
function grassDetailTexture() {
  const N = 256, c = makeCanvas(N, N), g = c.getContext('2d'), r = mulberry32(12);
  g.fillStyle = 'rgb(128,128,128)'; g.fillRect(0, 0, N, N);
  for (let i = 0; i < 9000; i++) {
    const x = r() * N, y = r() * N, v = 70 + Math.floor(r() * 120), len = 2 + r() * 5;
    g.strokeStyle = `rgba(${v},${v},${v},0.55)`; g.lineWidth = 0.8 + r() * 0.6;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 2, y - len); g.stroke();
  }
  for (let i = 0; i < 70; i++) { const x = r() * N, y = r() * N, rad = 4 + r() * 12, v = r() < 0.5 ? 'rgba(90,90,90,0.18)' : 'rgba(170,170,170,0.16)'; g.fillStyle = v; g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.generateMipmaps = true;
  return t;
}
// pelouse : texture du terrain (tonte, lignes) × grain de près × variations douces à grande échelle
function pitchMaterial(map) {
  const detail = grassDetailTexture();
  const m = new THREE.MeshStandardMaterial({ map, roughness: 1, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.tGrass = { value: detail };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vPW;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPW = (modelMatrix * vec4(position, 1.0)).xz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D tGrass; varying vec2 vPW;')
      .replace('#include <map_fragment>', `#include <map_fragment>
  {
    float dist = length(vViewPosition);
    float g1 = texture2D(tGrass, vPW / 1.4).r, g2 = texture2D(tGrass, vPW / 9.0 + 0.37).r;
    float near = 1.0 - smoothstep(12.0, 70.0, dist);
    diffuseColor.rgb *= mix(1.0, 0.72 + 0.56 * g1, near * 0.85) * (0.93 + 0.14 * g2);
  }`);
  };
  m.customProgramCacheKey = () => 'pitch-grass';
  return m;
}
function roofTexture() {
  // bac acier nervuré (dessus) / sous-face : nervures tous les 25 cm, joints de plaques, traces
  const c = makeCanvas(256, 256), g = c.getContext('2d'), r = mulberry32(21);
  g.fillStyle = '#e4e7ea'; g.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 16) { const gr = g.createLinearGradient(x, 0, x + 16, 0); gr.addColorStop(0, 'rgba(255,255,255,0.5)'); gr.addColorStop(0.45, 'rgba(160,166,172,0.35)'); gr.addColorStop(0.55, 'rgba(110,116,124,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0.3)'); g.fillStyle = gr; g.fillRect(x, 0, 16, 256); }
  g.fillStyle = 'rgba(80,86,94,0.5)'; g.fillRect(0, 0, 256, 2); g.fillRect(0, 128, 256, 1.5);
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(120,110,95,${0.04 + r() * 0.06})`; g.fillRect(r() * 256, r() * 256, 3 + r() * 30, 20 + r() * 120); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}
function seatTexture() {
  // sièges noirs, gris et blancs mêlés (comme à Bollaert depuis 2015)
  const c = makeCanvas(256, 256); const g = c.getContext('2d'); const r = mulberry32(5);
  g.fillStyle = '#6b6f75'; g.fillRect(0, 0, 256, 256);
  // noir, gris et blanc (sièges installés en 2015)
  const shades = ['#1d1f22', '#2a2d31', '#6e747b', '#8f969e', '#d9dde1', '#eef0f2'];
  for (let row = 0; row < 4; row++) {
    const y = row * 64;
    g.fillStyle = '#5a5e64'; g.fillRect(0, y + 44, 256, 20);
    for (let s = 0; s < 8; s++) {
      g.fillStyle = shades[Math.floor(r() * shades.length)];
      g.fillRect(s * 32 + 3, y + 18, 26, 26);
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(s * 32 + 3, y + 36, 26, 8);
    }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}
function terraceTexture() {
  // tribune debout (Marek) : marches en béton et barrières anti-écrasement
  const c = makeCanvas(256, 256); const g = c.getContext('2d');
  for (let row = 0; row < 4; row++) {
    const y = row * 64;
    g.fillStyle = '#9a9c9e'; g.fillRect(0, y, 256, 44); g.fillStyle = '#6e7174'; g.fillRect(0, y + 44, 256, 20);
    if (row % 2 === 0) { g.fillStyle = '#c8102e'; g.fillRect(0, y + 8, 256, 5); for (let x = 10; x < 256; x += 64) g.fillRect(x, y + 8, 4, 30); }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}
function textBand(text, w, h, bg, fg, size, reps = 3) {
  const c = makeCanvas(w, h); const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.fillStyle = fg; g.font = `700 ${size}px "Barlow Condensed", "Arial Narrow", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let i = 0; i < reps; i++) g.fillText(text, w * (i + 0.5) / reps, h / 2 + 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
function glassTexture() {
  // façade vitrée des loges (tribune Lepagnot)
  const c = makeCanvas(512, 128); const g = c.getContext('2d');
  g.fillStyle = '#1d2c3c'; g.fillRect(0, 0, 512, 128);
  for (let i = 0; i < 16; i++) { const lit = (i * 7) % 5 < 3; g.fillStyle = lit ? '#6c8aa6' : '#2b3e52'; g.fillRect(i * 32 + 3, 10, 26, 108); g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(i * 32 + 3, 10, 26, 18); }
  g.fillStyle = '#cfd5db'; g.fillRect(0, 0, 512, 6); g.fillRect(0, 122, 512, 6);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}
// grillage de barrière de chantier : fils fins (alpha), motif tuilable
function fenceTexture() {
  const c = makeCanvas(128, 128); const g = c.getContext('2d');
  g.clearRect(0, 0, 128, 128); g.strokeStyle = '#d0d4d8'; g.lineWidth = 2.5;
  for (let x = 0; x <= 128; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 128); g.stroke(); }
  for (let y = 0; y <= 128; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(128, y); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.repeat.set(12, 6);
  return t;
}
function meshTexture() {
  // bardage blanc : panneaux de composite et de maille perforée, joints verticaux, bandeau horizontal
  const c = makeCanvas(128, 128); const g = c.getContext('2d');
  g.fillStyle = '#e9ecef'; g.fillRect(0, 0, 128, 128);
  for (let x = 0; x < 128; x += 64) { g.fillStyle = x ? '#dfe3e7' : '#eef1f3'; g.fillRect(x, 0, 64, 128); }
  g.fillStyle = 'rgba(70,78,88,0.55)'; for (let x = 0; x < 128; x += 32) g.fillRect(x, 0, 2, 128);
  g.fillStyle = 'rgba(70,78,88,0.45)'; g.fillRect(0, 0, 128, 3); g.fillRect(0, 64, 128, 2);
  for (let y = 8; y < 60; y += 6) for (let x = 36; x < 60; x += 6) { g.fillStyle = 'rgba(90,98,108,0.35)'; g.fillRect(x, y, 2, 2); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}

// atlas du public : 8 variantes de 3 personnes, 4 rangées (face calme, face debout bras levés, dos calme, dos debout)
// deux textures : masque (r maillot, g peau, b cheveux, a opacité) et détail (r ombrage, g accessoire, b vêtement sombre)
const CROWD_NV = 8;
function crowdAtlas() {
  const CW = 256, CH = 192, NV = CROWD_NV, W = CW * NV, H = CH * 4;
  const mc = makeCanvas(W, H), dc = makeCanvas(W, H);
  const m = mc.getContext('2d'), d = dc.getContext('2d');
  m.clearRect(0, 0, W, H); d.fillStyle = '#000'; d.fillRect(0, 0, W, H);
  const r = mulberry32(3);
  const MK = { shirt: 'rgb(255,0,0)', skin: 'rgb(0,255,0)', hair: 'rgb(0,0,255)' };
  const det = (sh, acc = 0, dark = 0) => `rgb(${Math.round(sh)},${acc ? 255 : 0},${dark ? 255 : 0})`;
  // dessine la même forme dans les deux textures
  const shape = (path, mk, dt) => { path(m); m.fillStyle = mk; m.fill(); path(d); d.fillStyle = dt; d.fill(); };
  const circle = (x, y, rr) => (g) => { g.beginPath(); g.arc(x, y, rr, 0, Math.PI * 2); };
  const rect = (x, y, w, h) => (g) => { g.beginPath(); g.rect(x, y, w, h); };
  const grad = (y0, y1, a, b, acc = 0, dark = 0) => { const gr = d.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, det(a, acc, dark)); gr.addColorStop(1, det(b, acc, dark)); return gr; };
  function fan(cx, y0, P, back, cheer) {
    const bottom = y0 + CH;
    const standing = P.stand || cheer;
    const top = y0 + (cheer ? 50 : standing ? 62 : 84) + P.dy;
    const hr = 14.5 * P.size, hy = top + hr, sy = hy + hr + 8, sw = 26 * P.wide;
    // buste et épaules
    const torso = (g) => { g.beginPath(); g.moveTo(cx - sw, bottom); g.lineTo(cx - sw, sy + 12); g.quadraticCurveTo(cx - sw, sy, cx - sw + 12, sy - 2); g.lineTo(cx + sw - 12, sy - 2); g.quadraticCurveTo(cx + sw, sy, cx + sw, sy + 12); g.lineTo(cx + sw, bottom); g.closePath(); };
    shape(torso, MK.shirt, grad(sy - 2, bottom, 205, 115, 0, P.jacket));
    if (P.jacket && !back) shape(rect(cx - 6, sy + 6, 12, bottom - sy), MK.shirt, grad(sy, bottom, 190, 120));
    // bras le long du corps (plus sombres sur les bords)
    if (!cheer) for (const s of [-1, 1]) shape(rect(s < 0 ? cx - sw : cx + sw - 9, sy + 8, 9, bottom - sy - 8), MK.shirt, grad(sy, bottom, 150, 90, 0, P.jacket));
    // cou
    shape(rect(cx - 6, hy + hr - 6, 12, sy - hy - hr + 8), MK.skin, det(back ? 120 : 105));
    // écharpe
    if (P.scarf && !(cheer && P.raise < 0.55)) {
      shape(rect(cx - 13, sy - 6, 26, 10), MK.shirt, det(185, 1));
      if (!back) { shape(rect(cx - 10, sy + 2, 7, 34), MK.shirt, grad(sy, sy + 36, 175, 130, 1)); shape(rect(cx + 3, sy + 2, 7, 30), MK.shirt, grad(sy, sy + 32, 165, 125, 1)); }
    }
    // tête
    const hl = back ? 150 : 175;
    shape(circle(cx, hy, hr), MK.skin, det(hl));
    if (!back) {
      // ombrage du visage, yeux, bouche (ouverte quand on chante)
      shape(circle(cx + 3, hy + 3, hr * 0.8), MK.skin, det(150));
      shape(circle(cx - 1, hy - 1, hr * 0.62), MK.skin, det(190));
      for (const s of [-1, 1]) shape(circle(cx + s * 5, hy - 1, 1.7), MK.skin, det(55));
      if (cheer) shape(circle(cx, hy + 7, 3.2), MK.skin, det(40)); else shape(rect(cx - 3.5, hy + 7, 7, 1.6), MK.skin, det(90));
    }
    // cheveux / bonnet
    if (P.hat) {
      shape((g) => { g.beginPath(); g.arc(cx, hy - 1, hr + 1.5, Math.PI, 0); g.closePath(); }, MK.hair, det(185, 1));
      shape(rect(cx - hr - 1.5, hy - 3, 2 * hr + 3, 4), MK.hair, det(150, 1));
    } else if (P.hair > 0.12) {
      const long = P.hair > 0.78;
      if (back) shape((g) => { g.beginPath(); g.arc(cx, hy, hr + 1, Math.PI * 0.92, Math.PI * 2.08); g.lineTo(cx + hr * 0.8, hy + (long ? hr + 12 : hr * 0.75)); g.lineTo(cx - hr * 0.8, hy + (long ? hr + 12 : hr * 0.75)); g.closePath(); }, MK.hair, grad(hy - hr, hy + hr, 175, 105));
      else {
        shape((g) => { g.beginPath(); g.arc(cx, hy - 1, hr + 1, Math.PI * 1.02, Math.PI * 1.98); g.quadraticCurveTo(cx, hy - hr * 0.55, cx - hr - 0.5, hy - 2); g.closePath(); }, MK.hair, grad(hy - hr, hy, 180, 120));
        if (long) for (const s of [-1, 1]) shape(rect(s < 0 ? cx - hr - 2 : cx + hr - 4, hy - 4, 6, hr + 10), MK.hair, det(110));
      }
    }
    // bras levés (debout, on chante / on célèbre), écharpe tendue au-dessus de la tête
    if (cheer) {
      const ax = sw - 5, top2 = hy - 40 - P.raise * 10;
      for (const s of [-1, 1]) {
        const x0 = cx + s * ax, x1 = cx + s * (ax + 5 + P.raise * 6);
        shape((g) => { g.beginPath(); g.moveTo(x0 - 5, sy + 6); g.lineTo(x1 - 4, top2); g.lineTo(x1 + 4, top2); g.lineTo(x0 + 5, sy + 6); g.closePath(); }, MK.shirt, grad(top2, sy, 175, 125, 0, P.jacket));
        shape(circle(x1, top2 - 3, 5), MK.skin, det(165));
      }
      if (P.scarf && P.raise < 0.55) shape(rect(cx - ax - 8, top2 - 10, 2 * ax + 16 + P.raise * 12, 10), MK.shirt, det(195, 1));
    }
  }
  for (let v = 0; v < NV; v++) {
    const ppl = [];
    for (let p = 0; p < 3; p++) ppl.push({ cx: 43 + p * 85 + (r() - 0.5) * 12, stand: r() < 0.22, hair: r(), hat: r() < 0.14, scarf: r() < 0.38, jacket: r() < 0.3 ? 1 : 0, wide: 0.88 + r() * 0.28, size: 0.92 + r() * 0.16, raise: r(), dy: (r() - 0.5) * 8 });
    for (let row = 0; row < 4; row++) for (const P of ppl) fan(v * CW + P.cx, row * CH, P, row >= 2, row % 2 === 1);
  }
  const mk = (c) => { const t = new THREE.CanvasTexture(c); t.generateMipmaps = true; t.anisotropy = 4; return t; };
  return { mask: mk(mc), det: mk(dc) };
}

function boardsTexture() {
  const c = makeCanvas(2048, 64); const g = c.getContext('2d');
  const ads = [
    ['#c8102e', '#f5c400', 'SANG ET OR'], ['#1d3a8a', '#ffffff', 'BIENVENUE À BOLLAERT'], ['#101010', '#ffd23f', 'SPORT EN DIRECT'], ['#1d6b3a', '#ffffff', 'FAIR PLAY'],
    ['#f5c400', '#c8102e', 'BOLLAERT'], ['#13294b', '#5fd1ff', 'UHD · HDR · 50P'], ['#c8102e', '#ffffff', 'BASSIN MINIER'], ['#2b2b2b', '#ffffff', 'RESPECT'],
  ];
  const wSeg = 2048 / 8;
  ads.forEach((a, i) => {
    g.fillStyle = a[0]; g.fillRect(i * wSeg, 0, wSeg, 64);
    g.fillStyle = a[1]; g.font = 'bold 34px "Barlow Condensed", "Arial Narrow", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(a[2], i * wSeg + wSeg / 2, 33);
  });
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return { tex: t, canvas: c, redraw: () => { ads.forEach((a, i) => { g.fillStyle = a[0]; g.fillRect(i * wSeg, 0, wSeg, 64); g.fillStyle = a[1]; g.font = 'bold 34px "Barlow Condensed", "Arial Narrow", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(a[2], i * wSeg + wSeg / 2, 33); }); t.needsUpdate = true; } };
}

// tracés pédagogiques non éclairés (câbles caméra) : leur luminosité suit l'exposition de l'œil,
// sinon de nuit (exposition × 24) ils deviendraient des néons
const OVERLAYS = new Set();
export function overlayMat(m) { m.userData.base = m.color.clone(); OVERLAYS.add(m); m.color.copy(m.userData.base).multiplyScalar(W.overlayK ?? 1); return m; }
/** un tracé retiré (câble d'une caméra démontée) : sa matière quitte la liste et la carte graphique */
export function releaseOverlay(m) { if (!m) return; OVERLAYS.delete(m); m.dispose(); }
/** géométries, matières et textures d'un objet et de ses enfants (à libérer quand il disparaît) */
export function ownedResources(root) {
  const out = new Set();
  root.traverse((o) => {
    const x = /** @type {any} */ (o);
    if (x.geometry) out.add(x.geometry);
    for (const m of [].concat(x.material || [])) { out.add(m); for (const k of ['map', 'alphaMap', 'emissiveMap', 'normalMap', 'roughnessMap']) if (m[k]) out.add(m[k]); }
  });
  return [...out];
}
function updateOverlays() { W.overlayK = Math.min(1, 1.3 / (S.eyeExposure || 1)); for (const m of OVERLAYS) m.color.copy(m.userData.base).multiplyScalar(W.overlayK); }
export function labelSprite(text, opts = {}) {
  const fs = opts.size || 44;
  const c = makeCanvas(512, 96); const g = c.getContext('2d');
  g.font = `600 ${fs}px "Barlow Condensed", "Arial Narrow", sans-serif`;
  const w = Math.min(500, g.measureText(text).width + 36);
  g.fillStyle = opts.bg || 'rgba(10,14,18,0.82)';
  g.beginPath(); g.roundRect ? g.roundRect((512 - w) / 2, 14, w, 68, 12) : g.rect((512 - w) / 2, 14, w, 68); g.fill();
  g.strokeStyle = opts.border || 'rgba(255,176,32,0.9)'; g.lineWidth = 3; g.stroke();
  g.fillStyle = opts.color || '#f2f5f7'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 256, 49);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.SpriteMaterial({ map: t, depthTest: opts.depthTest ?? true, transparent: true, toneMapped: false, sizeAttenuation: opts.fixed ? false : true });
  const s = new THREE.Sprite(m);
  const sc = opts.scale || 3;
  s.scale.set(sc, sc * 96 / 512, 1);
  s.userData.canvas = c; s.userData.tex = t;
  return s;
}

// ----------------------------------------------------------------------------------
// Construction des tribunes : profils extrudés le long de chaque côté du terrain
// ----------------------------------------------------------------------------------
// point monde depuis (u le long de la tribune, o vers l'extérieur, y)
const SP = (st, u, o, y) => (st.axis === 'z' ? [u, y, st.sgn * (BOWL.hz + o)] : [st.sgn * (BOWL.hx + o), y, u]);
// normale monde depuis une normale (no, ny) du plan du profil
const SN = (st, no, ny) => (st.axis === 'z' ? [0, ny, st.sgn * no] : [st.sgn * no, ny, 0]);
const UN = (st, s) => (st.axis === 'z' ? [s, 0, 0] : [0, 0, s]);

// géométrie à partir de triangles orientés selon la normale voulue (faces visibles de l'extérieur)
function trisGeo(tris, uvs) {
  const pos = [], nor = [], uv = [];
  tris.forEach(([a, b, c, n, ta, tb, tc]) => {
    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const cr = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
    const flip = cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2] < 0;
    const P = flip ? [a, c, b] : [a, b, c], U = flip ? [ta, tc, tb] : [ta, tb, tc];
    for (let k = 0; k < 3; k++) { pos.push(...P[k]); nor.push(...n); if (uvs) uv.push(...U[k]); }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  if (uvs) g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}
function quadTris(p0, p1, p2, p3, n, t = [[0, 0], [1, 0], [1, 1], [0, 1]]) { return [[p0, p1, p2, n, t[0], t[1], t[2]], [p0, p2, p3, n, t[0], t[2], t[3]]]; }

// contour (o, y, nature du segment suivant) dans le sens horaire
function standProfile(st, tunnel = false) {
  const [, a2, b1, b2] = st.lo, [c1, c2, d1, d2] = st.up;
  const top = d2 + 1.2;
  const pts = [];
  if (tunnel) { const oc = (4.6 - b1) / (b2 - b1) * a2; pts.push([0, 4.6, 'canopy'], [oc, 4.6, 'slopeLo']); }
  else pts.push([0, 0, 'front'], [0, b1 - 0.05, 'slopeLo']);
  pts.push([a2, b2, 'conc']);
  if (st.main) pts.push([24.5, b2, 'glass'], [24.5, 17.0, 'deck'], [c1, 17.0, 'fascia']);
  else pts.push([c1, b2, 'fascia']);
  pts.push([c1, d1, 'slopeUp'], [c2, d2, 'parapet'], [c2, top, 'roofTop'], [st.back, top, 'back'], [st.back, 0, 'bottom']);
  return pts;
}
const SEG_COL = { front: 0x2a2f35, slopeLo: 0x8d9196, slopeUp: 0x8d9196, conc: 0x7c8086, glass: 0x1d2c3c, deck: 0x6d7278, fascia: 0x1b2230, parapet: 0x9aa0a6, roofTop: 0xb9bec4, back: 0xb3b9c0, canopy: 0x3a3f46 };

function buildStandBody(B, st, u0, u1, opts = {}) {
  const pts = standProfile(st, opts.tunnel);
  for (let i = 0; i < pts.length; i++) {
    const [o1, y1, kind] = pts[i]; const [o2, y2] = pts[(i + 1) % pts.length];
    if (kind === 'bottom') continue;
    const dx = o2 - o1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1;
    const n = SN(st, -dy / L, dx / L);
    if (kind === 'back' && opts.door) {
      // porte du couloir (tribune principale) : u ∈ [−3,2 ; 3,2], hauteur 4,2 m
      const [d0, d1, dh] = opts.door;
      for (const [ua, ub, ya] of [[u0, d0, 0], [d1, u1, 0], [d0, d1, dh]]) {
        if (ub <= ua) continue;
        B.add(trisGeo(quadTris(SP(st, ua, o1, Math.max(ya, y2)), SP(st, ub, o1, Math.max(ya, y2)), SP(st, ub, o1, y1), SP(st, ua, o1, y1), n)), null, SEG_COL.back);
      }
      continue;
    }
    B.add(trisGeo(quadTris(SP(st, u0, o1, y1), SP(st, u1, o1, y1), SP(st, u1, o2, y2), SP(st, u0, o2, y2), n)), null, SEG_COL[kind] ?? 0x8d9196);
  }
  // extrémités (joues) de la tribune
  const contour = pts.map(([o, y]) => new THREE.Vector2(o, y));
  const tri = THREE.ShapeUtils.triangulateShape(contour, []);
  for (const [u, s, show] of [[u0, -1, opts.cap0 !== false], [u1, 1, opts.cap1 !== false]]) {
    if (!show) continue;
    const n = UN(st, s);
    B.add(trisGeo(tri.map(([a, b, c]) => [SP(st, u, ...contour[a].toArray()), SP(st, u, ...contour[b].toArray()), SP(st, u, ...contour[c].toArray()), n])), null, 0xd6dadf);
  }
}
// surface des gradins (texture de sièges) posée sur une pente
function slopeGeo(st, u0, u1, oa, ya, ob, yb) {
  const dx = ob - oa, dy = yb - ya, L = Math.hypot(dx, dy);
  const nn = [-dy / L, dx / L];
  const off = 0.04;
  const p = (u, o, y) => SP(st, u, o + nn[0] * off, y + nn[1] * off);
  const n = SN(st, nn[0], nn[1]);
  return trisGeo(quadTris(p(u0, oa, ya), p(u1, oa, ya), p(u1, ob, yb), p(u0, ob, yb), n, [[u0 / 4, 0], [u1 / 4, 0], [u1 / 4, L / 3.2], [u0 / 4, L / 3.2]]), true);
}
// bandeau vertical (nom de la tribune, vitrage des loges) dans le plan o = cte
function bandGeo(st, u0, u1, o, y0, y1, rep = 1) {
  const n = SN(st, -1, 0);
  // vu depuis le terrain : u inversé pour Marek-Xercès et Trannin, sinon le texte serait en miroir
  const flip = st.axis === 'z' ? st.sgn > 0 : st.sgn < 0;
  const t = flip ? [[rep, 0], [0, 0], [0, 1], [rep, 1]] : [[0, 0], [rep, 0], [rep, 1], [0, 1]];
  return trisGeo(quadTris(SP(st, u0, o, y0), SP(st, u1, o, y0), SP(st, u1, o, y1), SP(st, u0, o, y1), n, t), true);
}
function backBandGeo(st, u0, u1, o, y0, y1, repU = 1, repV = 1) {
  const n = SN(st, 1, 0);
  // vu de l'extérieur : u inversé pour que le texte se lise à l'endroit
  const flip = (st.axis === 'z' ? st.sgn < 0 : st.sgn > 0);
  const t = flip ? [[repU, 0], [0, 0], [0, repV], [repU, repV]] : [[0, 0], [repU, 0], [repU, repV], [0, repV]];
  return trisGeo(quadTris(SP(st, u0, o, y0), SP(st, u1, o, y0), SP(st, u1, o, y1), SP(st, u0, o, y1), n, t), true);
}

function buildStands(scene) {
  const B = new Builder();
  const seatMat = matiere('sieges', { uv: true, map: seatTexture(), vertexColors: false, roughness: 0.62, strength: 0.7, name: 'tribunes-sieges' });
  const terraceMat = matiere('gradins', { uv: true, map: terraceTexture(), vertexColors: false, roughness: 0.88, strength: 1.0, name: 'tribunes-gradins' });
  const seats = [], terrace = [];
  for (const st of STANDS) {
    const h = st.half;
    const [, a2, b1, b2] = st.lo, [c1, c2, d1, d2] = st.up;
    if (st.main) {
      // tunnel des joueurs au centre de la tribune principale
      buildStandBody(B, st, -h, -5);
      buildStandBody(B, st, -5, 5, { tunnel: true, cap0: false, cap1: false, door: [-3.2, 3.2, 4.2] });
      buildStandBody(B, st, 5, h);
      const oc = (4.6 - b1) / (b2 - b1) * a2;
      seats.push(slopeGeo(st, -h, -5, 0, b1, a2, b2), slopeGeo(st, -5, 5, oc, 4.6, a2, b2), slopeGeo(st, 5, h, 0, b1, a2, b2));
    } else {
      buildStandBody(B, st, -h, h);
      (st.id === 'marek' ? terrace : seats).push(slopeGeo(st, -h, h, 0, b1, a2, b2));
    }
    seats.push(slopeGeo(st, -h, h, c1, d1, c2, d2));
    // bandeau au nom de la tribune (front de la tribune haute)
    const nameTex = textBand(st.name.toUpperCase(), 4096, 96, '#141a22', '#f2f4f6', 62, st.axis === 'z' ? 4 : 2);
    if (!st.main) scene.add(new THREE.Mesh(bandGeo(st, -h, h, c1 - 0.03, b2 + 0.2, d1 - 0.1), new THREE.MeshLambertMaterial({ map: nameTex })));
    else {
      const gt = glassTexture(); gt.repeat.set(1, 1);
      scene.add(new THREE.Mesh(bandGeo(st, -h, h, 24.47, b2, 17.0, h / 8), new THREE.MeshLambertMaterial({ map: gt, emissive: 0x223344, emissiveMap: gt, emissiveIntensity: 0.6 })));
      scene.add(new THREE.Mesh(bandGeo(st, -h, h, c1 - 0.03, 17.05, d1 - 0.05), new THREE.MeshLambertMaterial({ map: nameTex })));
    }
    // façade arrière : maille blanche et nom de la tribune
    const mt = meshTexture();
    const meshMat = new THREE.MeshLambertMaterial({ map: mt });
    scene.add(new THREE.Mesh(backBandGeo(st, -h, h, st.back + 0.35, 4.5, d2 + 1.3, h / 1.5, (d2 - 3.2) / 3), meshMat));
    const sign = textBand(st.name.toUpperCase(), 2048, 256, '#e9ecef', '#1b2230', 170, 1);
    scene.add(new THREE.Mesh(backBandGeo(st, -20, 20, st.back + 0.5, d2 - 7, d2 - 2), new THREE.MeshLambertMaterial({ map: sign })));
  }
  // le corps des tribunes est légèrement repoussé en profondeur : les gradins, sièges et bandeaux posés
  // à quelques centimètres devant lui ne « clignotent » plus (z-fighting) quand on les regarde de loin
  const body = B.mesh(matiere('beton', { seed: 51, scale: 1.4, strength: 0.7, roughness: 0.88, name: 'tribunes-beton' })); body.material.polygonOffset = true; body.material.polygonOffsetFactor = 1; body.material.polygonOffsetUnits = 2;
  body.castShadow = true; body.receiveShadow = true; scene.add(body);
  for (const [list, mat] of [[seats, seatMat], [terrace, terraceMat]]) {
    if (!list.length) continue;
    const m = new THREE.Mesh(mergeNonIndexed(list), mat); m.receiveShadow = true; m.castShadow = true; scene.add(m);
  }
}

// ---------------- détails des tribunes : escaliers, vomitoires, loges, garde-corps, banderoles ----------------
function stairTexture() {
  // escaliers gris, nez de marche jaunes (accès aux rangées)
  const c = makeCanvas(64, 256); const g = c.getContext('2d');
  for (let i = 0; i < 4; i++) { g.fillStyle = '#8e9297'; g.fillRect(0, i * 64, 64, 64); g.fillStyle = '#6c7075'; g.fillRect(0, i * 64 + 40, 64, 24); g.fillStyle = '#f5c400'; g.fillRect(0, i * 64 + 36, 64, 6); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t;
}
function vipTexture() {
  // sièges rembourrés de la tribune présidentielle (Lepagnot, au-dessus du tunnel)
  const c = makeCanvas(256, 256); const g = c.getContext('2d');
  g.fillStyle = '#3a3d42'; g.fillRect(0, 0, 256, 256);
  for (let row = 0; row < 4; row++) for (let s = 0; s < 8; s++) { g.fillStyle = '#7a121c'; g.fillRect(s * 32 + 2, row * 64 + 10, 28, 36); g.fillStyle = '#5c0d15'; g.fillRect(s * 32 + 2, row * 64 + 34, 28, 12); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t;
}
function bannerTexture(text, bg, fg, stripes) {
  const c = makeCanvas(1024, 192); const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 1024, 192);
  if (stripes) for (let x = 0; x < 1024; x += 128) { g.fillStyle = stripes; g.fillRect(x, 0, 64, 192); }
  g.fillStyle = fg; g.font = '800 120px "Barlow Condensed", "Arial Narrow", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 10; g.strokeStyle = 'rgba(0,0,0,0.35)'; g.strokeText(text, 512, 102); g.fillText(text, 512, 102);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
// bande rectangulaire posée sur une pente avec des coordonnées de texture propres (largeur → u, longueur → v)
function stripGeo(st, u0, u1, oa, ya, ob, yb, vRep, off = 0.06) {
  const dx = ob - oa, dy = yb - ya, L = Math.hypot(dx, dy); const nn = [-dy / L, dx / L];
  const p = (u, o, y) => SP(st, u, o + nn[0] * off, y + nn[1] * off);
  return trisGeo(quadTris(p(u0, oa, ya), p(u1, oa, ya), p(u1, ob, yb), p(u0, ob, yb), SN(st, nn[0], nn[1]), [[0, 0], [1, 0], [1, L / vRep], [0, L / vRep]]), true);
}
function buildStandDetails(scene) {
  const B = new Builder(); const stairs = [], vip = [], voids = [];
  for (const st of STANDS) {
    const [, a2, b1, b2] = st.lo, [c1, c2, d1, d2] = st.up, h = st.half;
    const loY = (o) => b1 + o / a2 * (b2 - b1);
    // escaliers (mêmes emplacements que les allées laissées libres par le public)
    for (let u = -h + 11; u < h - 1; u += 22) {
      const oStart = st.main && Math.abs(u) < 6 ? (4.6 - b1) / (b2 - b1) * a2 : 0;
      stairs.push(stripGeo(st, u - 0.6, u + 0.6, oStart, loY(oStart), a2, b2, 1.6));
      stairs.push(stripGeo(st, u - 0.6, u + 0.6, c1, d1, c2, d2, 1.6));
    }
    // vomitoires de la tribune basse : ouverture sombre, joues blanches, linteau jaune
    for (let u = -h + 22; u < h - 4; u += 22) {
      if (st.main && Math.abs(u) < 16) continue;
      const o0 = 8.5, o1 = 12.5, w = 1.3;
      voids.push(stripGeo(st, u - w, u + w, o0, loY(o0), o1, loY(o1), 4, 0.09));
      for (const s of [-1, 1]) {
        const uu = u + s * (w + 0.1);
        const q = [SP(st, uu, o0, loY(o0)), SP(st, uu, o1, loY(o1)), SP(st, uu, o1, loY(o1) + 1.1), SP(st, uu, o0, loY(o0) + 0.15)];
        B.add(trisGeo([[q[0], q[1], q[2], UN(st, 1)], [q[0], q[2], q[3], UN(st, 1)], [q[0], q[2], q[1], UN(st, -1)], [q[0], q[3], q[2], UN(st, -1)]]), null, 0xe9ecef);
      }
      const a = SP(st, u - w - 0.1, o0, loY(o0) + 0.2), b2p = SP(st, u + w + 0.1, o0, loY(o0) + 0.2);
      B.rod(a, b2p, 0.06, 0xf5c400, 5);
    }
    // garde-corps du balcon de la tribune haute et liseré sang et or du mur de front
    B.rod(SP(st, -h, c1 + 0.1, d1 + 1.0), SP(st, h, c1 + 0.1, d1 + 1.0), 0.04, 0xf2f4f6, 5);
    for (let u = -h; u <= h; u += 3) B.rod(SP(st, u, c1 + 0.1, d1), SP(st, u, c1 + 0.1, d1 + 1.0), 0.025, 0xf2f4f6, 4);
    B.rod(SP(st, -h, -0.05, b1 - 0.06), SP(st, h, -0.05, b1 - 0.06), 0.07, 0xc8102e, 5);
    B.rod(SP(st, -h, -0.06, b1 - 0.22), SP(st, h, -0.06, b1 - 0.22), 0.035, 0xf5c400, 5);
    B.rod(SP(st, -h, 0.25, b1 + 0.95), SP(st, h, 0.25, b1 + 0.95), 0.035, 0xb9bec4, 5); // main courante du premier rang
    if (st.main) vip.push(stripGeo(st, -14, 14, 8, loY(8), 15, loY(15), 3.2, 0.07));
  }
  const det = B.mesh(matiere('tole', { seed: 52, scale: 0.6, strength: 0.4, roughness: 0.55, metalness: 0.2, side: THREE.DoubleSide, name: 'tribunes-details' })); det.castShadow = true; scene.add(det);
  const sm = new THREE.Mesh(mergeNonIndexed(stairs), new THREE.MeshLambertMaterial({ map: stairTexture() })); sm.receiveShadow = true; scene.add(sm);
  const vm = new THREE.Mesh(mergeNonIndexed(vip), new THREE.MeshLambertMaterial({ map: (() => { const t = vipTexture(); return t; })() })); vm.receiveShadow = true; scene.add(vm);
  scene.add(new THREE.Mesh(mergeNonIndexed(voids), new THREE.MeshBasicMaterial({ color: 0x07080a })));
  // banderoles du kop (Marek) et du balcon Xercès
  const mk = STANDS.find((x) => x.id === 'marek');
  const banners = [['SANG ET OR', '#c8102e', '#f5c400'], ['MAREK', '#f5c400', '#c8102e', '#e8b800'], ['LENS 62', '#c8102e', '#ffffff'], ['FIERTÉ MINIÈRE', '#111111', '#f5c400'], ['ALLEZ LES SANG ET OR', '#f5c400', '#c8102e'], ['XERCÈS', '#c8102e', '#f5c400', '#b00e28']];
  banners.forEach(([t, bg, fg, stp], i) => {
    const tex = bannerTexture(t, bg, fg, stp);
    const lower = i < 3;
    const u = lower ? -30 + i * 30 : -36 + (i - 3) * 36, w = lower ? 9 : 12, hh = lower ? 1.0 : 2.0;
    const o = lower ? -0.12 : mk.up[0] - 0.1, y0 = lower ? 0.1 : mk.lo[3] + 0.3;
    const g = bandGeo(mk, u - w / 2, u + w / 2, o, y0, y0 + hh);
    scene.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: tex })));
  });
  // drapeaux agités dans le kop : toile qui ondule (vague le long du drapeau), bandes sang et or
  W.flags = [];
  const flagU = { uTime: { value: 0 } }; W.flagU = flagU;
  const flagTex = [0, 1, 2].map((k) => {
    const c = makeCanvas(256, 160), g = c.getContext('2d');
    const cols = k === 0 ? ['#c8102e', '#f5c400', '#c8102e'] : k === 1 ? ['#f5c400', '#c8102e', '#f5c400'] : ['#111111', '#f5c400', '#111111'];
    cols.forEach((cc, j) => { g.fillStyle = cc; g.fillRect(0, j * 160 / 3, 256, 160 / 3 + 1); });
    g.fillStyle = k === 2 ? '#f5c400' : '#ffffff'; g.font = '700 54px "Barlow Condensed", "Arial Narrow", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; if (k !== 1) g.fillText('LENS', 128, 82);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  });
  const flagMat = (k) => {
    const m = new THREE.MeshStandardMaterial({ map: flagTex[k], side: THREE.DoubleSide, roughness: 0.8 });
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = flagU.uTime;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
  float ph = modelMatrix[3].x * 1.7 + modelMatrix[3].z;
  float k = position.x / 1.8;
  transformed.z += sin(position.x * 3.2 - uTime * 7.0 + ph) * 0.16 * k + sin(position.y * 2.0 + uTime * 4.0 + ph) * 0.04 * k;
  transformed.y -= k * k * 0.12;`);
    };
    m.customProgramCacheKey = () => 'flag-wave';
    return m;
  };
  const r = mulberry32(19); const Pb = new Builder();
  for (let i = 0; i < 16; i++) {
    const u = -44 + r() * 88, o = 3 + r() * 16, y = mk.lo[2] + o / mk.lo[1] * (mk.lo[3] - mk.lo[2]);
    const [x, , z] = SP(mk, u, o, y);
    Pb.cyl(0.02, 0.02, 3.2, x, y + 2.2, z, 0x9aa0a6, 5);
    const fg = new THREE.PlaneGeometry(1.8, 1.2, 12, 4); fg.translate(0.9, 0, 0);
    const flag = new THREE.Mesh(fg, flagMat(i % 3));
    flag.position.set(x, y + 3.0, z); flag.userData.ph = r() * 6.28; flag.userData.base = r() * 6.28; scene.add(flag); W.flags.push(flag);
  }
  scene.add(Pb.mesh(matiere('laque', { seed: 53, scale: 0.5, roughness: 0.45, metalness: 0.5, name: 'pylones' })));
}

// toits suspendus à un anneau de poutres porté par quatre pylônes d'angle
function buildRoofs(scene) {
  const R = new Builder({ uv: true }), S2 = new Builder(), Fl = new Builder();
  for (const st of STANDS) {
    // la rive avant s'arrête au-dessus des premiers rangs : par vent, les premières rangées sont mouillées
    const h = st.half + 1.5, of = 3.5, ob = st.back + 1.5, yf = st.roof, yb = st.roof - 1.6;
    const up = SN(st, 0, 1), dn = SN(st, 0, -1);
    const tu = (2 * h) / 4, tv = (ob - of) / 4, uvR = [[0, 0], [tu, 0], [tu, tv], [0, tv]];
    R.add(trisGeo(quadTris(SP(st, -h, of, yf + 0.5), SP(st, h, of, yf + 0.5), SP(st, h, ob, yb + 0.5), SP(st, -h, ob, yb + 0.5), up, uvR), true), null, 0xeef1f4);
    R.add(trisGeo(quadTris(SP(st, -h, of, yf), SP(st, h, of, yf), SP(st, h, ob, yb), SP(st, -h, ob, yb), dn, uvR), true), null, 0xd9dde2);
    // rive avant (bandeau blanc)
    R.add(trisGeo(quadTris(SP(st, -h, of, yf - 1.1), SP(st, h, of, yf - 1.1), SP(st, h, of, yf + 0.5), SP(st, -h, of, yf + 0.5), SN(st, -1, 0), [[0, 0.02], [0, 0.02], [0, 0.02], [0, 0.02]]), true), null, 0xf6f7f8);
    // projecteurs LED sous la rive
    for (let u = -h + 3; u <= h - 3; u += 3.2) { const p = SP(st, u, of + 0.7, yf - 0.4); Fl.box(st.axis === 'z' ? 1.4 : 0.8, 0.5, st.axis === 'z' ? 0.8 : 1.4, p[0], p[1], p[2], 0xffffff); }
    // sous-face : pannes et nervures en acier blanc, visibles depuis le terrain
    const yAt = (o) => yf + (o - of) / (ob - of) * (yb - yf);
    for (let u = -st.half; u <= st.half; u += 8) S2.rod(SP(st, u, of + 0.3, yf - 0.25), SP(st, u, ob - 0.5, yb - 0.25), 0.12, 0xeceff2, 5);
    for (const o of [of + 6, of + 14, of + 22, of + 30]) if (o < ob - 2) S2.rod(SP(st, -st.half, o, yAt(o) - 0.3), SP(st, st.half, o, yAt(o) - 0.3), 0.09, 0xeceff2, 5);
    S2.rod(SP(st, -h, of + 0.2, yf - 1.3), SP(st, h, of + 0.2, yf - 1.3), 0.18, 0xeceff2, 6); // poutre de rive (porte l'éclairage)
    // grappes de haut-parleurs suspendues (sonorisation du stade)
    const nSpk = st.axis === 'z' ? 6 : 4;
    for (let k = 0; k < nSpk; k++) {
      const u = -st.half * 0.82 + k * (st.half * 1.64 / (nSpk - 1)), o = of + 3, y0 = yAt(o) - 1.0;
      const top = SP(st, u, o, yAt(o) - 0.3), bot = SP(st, u, o, y0);
      S2.rod(top, bot, 0.03, 0x2a2d31, 4);
      for (let i = 0; i < 5; i++) { const p = SP(st, u, o + i * 0.06, y0 - 0.25 - i * 0.42); S2.box(st.axis === 'z' ? 0.7 : 0.55, 0.38, st.axis === 'z' ? 0.55 : 0.7, p[0], p[1], p[2], 0x24272b); }
    }
    // suspentes entre l'anneau (o = 10) et le toit
    for (let u = -st.half + 4; u <= st.half - 4; u += 12) { const a = SP(st, u, 10, RING_Y - 1.2), b = SP(st, u, 10, yf + (10 - of) / (ob - of) * (yb - yf) + 0.5); S2.rod(a, b, 0.06, 0xf2f4f6, 5); }
  }
  // anneau de poutres treillis entre les pylônes
  for (let i = 0; i < 4; i++) {
    const [x0, z0] = MASTS[i], [x1, z1] = MASTS[(i + 1) % 4];
    const L = Math.hypot(x1 - x0, z1 - z0), n = Math.round(L / 6);
    S2.rod([x0, RING_Y + 1.2, z0], [x1, RING_Y + 1.2, z1], 0.22, 0xf2f4f6); S2.rod([x0, RING_Y - 1.2, z0], [x1, RING_Y - 1.2, z1], 0.22, 0xf2f4f6);
    for (let k = 0; k <= n; k++) {
      const t = k / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
      S2.rod([x, RING_Y - 1.2, z], [x, RING_Y + 1.2, z], 0.08, 0xf2f4f6, 5);
      if (k < n) { const t2 = (k + 1) / n; S2.rod([x, RING_Y - 1.2, z], [x0 + (x1 - x0) * t2, RING_Y + 1.2, z0 + (z1 - z0) * t2], 0.07, 0xf2f4f6, 5); }
    }
  }
  // pylônes en treillis (≈ 72 m)
  const cables = [];
  for (const [mx, mz] of MASTS) {
    const H = 72, legs = 3;
    const leg = (k, y) => { const r = 1.5 - (y / H) * 1.0, a = k * Math.PI * 2 / legs + Math.atan2(mz, mx); return [mx + Math.cos(a) * r, y, mz + Math.sin(a) * r]; };
    for (let k = 0; k < legs; k++) S2.rod(leg(k, 0), leg(k, H), 0.14, 0xf4f6f8);
    for (let y = 0; y < H; y += 4) for (let k = 0; k < legs; k++) { S2.rod(leg(k, y), leg((k + 1) % legs, y + 4), 0.05, 0xf4f6f8, 4); S2.rod(leg(k, y + 4), leg((k + 1) % legs, y + 4), 0.05, 0xf4f6f8, 4); }
    S2.cyl(0.25, 0.25, 1.2, mx, H + 0.6, mz, 0xd8262f, 8); // balisage
    S2.box(4, 1, 4, mx, 0.5, mz, 0x9aa0a6);
    W.obstacles.push({ x0: mx - 2.2, x1: mx + 2.2, z0: mz - 2.2, z1: mz + 2.2 });
    // haubans vers l'anneau et vers un massif d'ancrage extérieur
    const top = [mx, H - 1, mz];
    const sx = -Math.sign(mx), sz = -Math.sign(mz);
    for (const t of [0.22, 0.45]) { cables.push(top, [mx + sx * Math.abs(2 * mx) * t, RING_Y + 1.2, mz]); cables.push(top, [mx, RING_Y + 1.2, mz + sz * Math.abs(2 * mz) * t]); }
    cables.push(top, [mx * 1.45, 0.2, mz * 1.45]);
  }
  // polycarbonate translucide : la sous-face reste claire (lumière transmise)
  const roofMat = pbr(new THREE.MeshLambertMaterial({ vertexColors: true, map: roofTexture(), transparent: true, opacity: 0.93, side: THREE.DoubleSide, emissive: 0x5a5f66 }), 0.55, 0.35);
  W.roofMat = roofMat;
  const roof = R.mesh(roofMat); roof.castShadow = true; scene.add(roof); W.roofMeshes.push(roof);
  const steel = S2.mesh(pbr(new THREE.MeshLambertMaterial({ vertexColors: true }), 0.42, 0.6)); steel.castShadow = true; scene.add(steel); W.roofMeshes.push(steel);
  const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.Float32BufferAttribute(cables.flat(), 3));
  W.cableMat = new THREE.LineBasicMaterial({ color: 0xd8dde2 });
  const cab = new THREE.LineSegments(cg, W.cableMat); scene.add(cab); W.roofMeshes.push(cab);
  W.floodMat = new THREE.MeshBasicMaterial({ color: 0x606468, toneMapped: true });
  const fl = new THREE.Mesh(Fl.build(), W.floodMat); scene.add(fl); W.roofMeshes.push(fl);
}

// ----------------------------------------------------------------------------------
export function buildWorld(renderer) {
  const scene = new THREE.Scene();
  W.scene = scene;

  // --- ciel ---
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { uZen: { value: new THREE.Color(0.2, 0.42, 0.9) }, uHor: { value: new THREE.Color(0.7, 0.82, 1.0) }, uGround: { value: new THREE.Color(0.25, 0.25, 0.25) }, uI: { value: 2.0 }, uCloud: { value: 0.45 }, uCloudCol: { value: new THREE.Color(0.78, 0.8, 0.84) }, uTime: { value: 0 }, uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color(1, 1, 1) }, uSunI: { value: 0 } },
    vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    // dégradé + nuages procéduraux (bruit fractal projeté sur un plafond), qui dérivent lentement
    fragmentShader: `uniform vec3 uZen, uHor, uGround, uCloudCol, uSunDir, uSunCol; uniform float uI, uCloud, uTime, uSunI; varying vec3 vP;
      float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h2(i), h2(i + vec2(1.0, 0.0)), f.x), mix(h2(i + vec2(0.0, 1.0)), h2(i + vec2(1.0, 1.0)), f.x), f.y); }
      float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * n2(p); p = p * 2.03 + 17.0; a *= 0.5; } return s; }
      void main(){ float h = vP.y; vec3 c = h > 0.0 ? mix(uHor, uZen, pow(clamp(h,0.0,1.0), 0.6)) : mix(uHor, uGround, clamp(-h*6.0,0.0,1.0));
        if (h > 0.0 && uCloud > 0.01) {
          vec2 uv = vP.xz / (h + 0.15) * 1.3 + vec2(uTime * 0.006, uTime * 0.002);
          float f = fbm(uv);
          float cl = smoothstep(1.0 - uCloud, 1.0 - uCloud + 0.32, f) * smoothstep(0.0, 0.2, h);
          vec3 cc = uCloudCol * (0.82 + 0.3 * smoothstep(0.35, 0.9, f));
          c = mix(c, cc, cl * 0.9);
        }
        // soleil : disque, auréole et voile clair autour (le halo du post-traitement fait le reste)
        float sd = max(dot(normalize(vP), uSunDir), 0.0);
        vec3 sun = uSunCol * uSunI * (smoothstep(0.99985, 0.99993, sd) * 60.0 + pow(sd, 400.0) * 1.6 + pow(sd, 18.0) * 0.18);
        gl_FragColor = vec4(c * uI + sun * step(0.0, vP.y), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  W.sky = new THREE.Mesh(new THREE.SphereGeometry(1400, 32, 16), skyMat);
  W.sky.frustumCulled = false; W.sky.renderOrder = -1; // dessiné en premier : le sol lointain (au-delà de la sphère) passe devant
  scene.add(W.sky);

  // --- lumières ---
  W.hemi = new THREE.HemisphereLight(0xbfd4ff, 0x4a5a3a, 1.0);
  scene.add(W.hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.castShadow = true;
  const sm = S.lite ? 1024 : S.quality === 'haute' ? 4096 : 2048;
  sun.shadow.mapSize.set(sm, sm);
  const sc = sun.shadow.camera; sc.left = -135; sc.right = 135; sc.top = 115; sc.bottom = -115; sc.near = 10; sc.far = 600;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
  scene.add(sun); scene.add(sun.target);
  W.sun = sun;
  const f2 = new THREE.DirectionalLight(0xffffff, 0);
  scene.add(f2); scene.add(f2.target); W.flood2 = f2;

  // --- sol extérieur ---
  // sols superposés (sol, pelouse extérieure, parvis, pelouse du terrain) : décalés en hauteur ET en profondeur
  // (polygonOffset), sinon ils se disputent le même pixel vus d'avion
  buildGround(scene, groundTexture());
  // --- pelouse ---
  const pitch = new THREE.Mesh(new THREE.PlaneGeometry(122, 82), pitchMaterial(pitchTexture(renderer)));
  pitch.rotation.x = -Math.PI / 2; pitch.position.y = 0.0; pitch.receiveShadow = true;
  scene.add(pitch);

  // --- tribunes, toits, pylônes ---
  buildStands(scene);
  buildStandDetails(scene);
  buildRoofs(scene);

  // --- éléments intérieurs de la tribune principale (fusionnés) ---
  const B = new Builder();
  const darkC = 0x55595e;
  // tunnel : murs et plafond
  const ty = 4.6;
  B.box(0.4, ty, 6.5, -5, ty / 2, -44.25, darkC); B.box(0.4, ty, 6.5, 5, ty / 2, -44.25, darkC);
  B.box(10.4, 0.4, 19, 0, ty + 0.2, -56.5, darkC); B.box(10.4, 0.3, 6.5, 0, ty - 0.15, -44.25, darkC);
  B.box(0.4, ty, 19, -5, ty / 2, -56.5, darkC); B.box(0.4, ty, 19, 5, ty / 2, -56.5, darkC);
  // auvent rétractable du tunnel (sang et or)
  B.box(9.6, 0.12, 4.2, 0, 2.9, -39.2, 0xc8102e, 0, -0.18); B.box(9.6, 0.4, 0.12, 0, 2.6, -37.1, 0xf5c400);
  // couloir intérieur sous la tribune
  B.box(0.3, 4, 26.5, -3.1, 2, -79.75, 0x9a9488); B.box(0.3, 4, 26.5, 3.1, 2, -79.75, 0x9a9488);
  B.box(6.5, 0.3, 46, 0, 4.15, -70, 0x6d6a64);
  // vestiaire
  B.box(13, 0.3, 12, 9.5, 3.4, -78, 0x6d6a64); B.box(13, 3.4, 0.3, 9.5, 1.7, -84, 0xc9c2b3); B.box(13, 3.4, 0.3, 9.5, 1.7, -72, 0xc9c2b3); B.box(0.3, 3.4, 12, 16, 1.7, -78, 0xc9c2b3);
  for (let i = 0; i < 6; i++) B.box(1.6, 0.45, 0.5, 6 + i * 1.8, 0.45, -83.4, 0x6b4a2b);
  for (let i = 0; i < 6; i++) B.box(1.4, 2, 0.4, 6 + i * 1.8, 1.4, -83.75, TEAMS[0].shirt);
  // local technique TV
  B.box(13, 0.3, 9, -9.5, 3.4, -86.5, 0x6d6a64); B.box(13, 3.4, 0.3, -9.5, 1.7, -91, 0xb8bcc0); B.box(13, 3.4, 0.3, -9.5, 1.7, -82, 0xb8bcc0); B.box(0.3, 3.4, 9, -16, 1.7, -86.5, 0xb8bcc0);
  for (let i = 0; i < 5; i++) { B.box(0.6, 2.1, 0.8, -14.5 + i * 1.1, 1.05, -90.3, 0x22262b); }
  // passerelle caméras : sur le toit des loges, sous le front de la tribune haute (Lepagnot)
  B.box(82, 0.25, 3.2, 0, 17.1, -(BOWL.hz + 27.8), 0x3c4148);
  for (let x = -40; x <= 40; x += 2) B.box(0.05, 0.5, 0.05, x, 17.45, -(BOWL.hz + 26.25), 0xbfc4c9);
  B.box(82, 0.05, 0.05, 0, 17.7, -(BOWL.hz + 26.25), 0xbfc4c9);
  B.box(82, 0.12, 0.25, 0, 17.0, -(BOWL.hz + 26.2), 0xe0b030); // nez de passerelle
  // positions commentateurs (terrasse des loges de presse)
  for (let i = 0; i < 4; i++) {
    const x = 9 + i * 3;
    B.box(2.6, 0.9, 0.7, x, TIERS.lower.y2 + 0.45, -(BOWL.hz + 23.0), 0x30353b);
    B.box(2.6, 0.04, 0.9, x, TIERS.lower.y2 + 0.92, -(BOWL.hz + 23.1), 0x4a5058);
  }
  // bancs de touche
  for (const s of [-1, 1]) {
    const x = s * 10;
    B.box(8, 0.12, 1.6, x, 2.2, -38.6, 0x9fb3c8); B.box(8, 2.2, 0.08, x, 1.1, -39.4, 0x9fb3c8);
    B.box(0.08, 2.2, 1.6, x - 4, 1.1, -38.6, 0x9fb3c8); B.box(0.08, 2.2, 1.6, x + 4, 1.1, -38.6, 0x9fb3c8);
    B.box(7.6, 0.45, 0.5, x, 0.45, -39.0, 0x1b1f24);
  }
  // table du 4e arbitre
  B.box(2.2, 0.8, 0.8, 0, 0.4, -37.6, 0xeeeeee);
  // drapeaux de coin
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { B.cyl(0.02, 0.02, 1.5, sx * PITCH.hl, 0.75, sz * PITCH.hw, 0xffee55, 6); B.box(0.02, 0.3, 0.4, sx * PITCH.hl, 1.35, sz * PITCH.hw + 0.2 * -sz, 0xff3355); }
  // buts
  const goalMat = 0xf8f8f8;
  for (const s of [-1, 1]) {
    const x = s * PITCH.hl;
    B.cyl(0.06, 0.06, 2.44, x, 1.22, -3.66, goalMat, 10); B.cyl(0.06, 0.06, 2.44, x, 1.22, 3.66, goalMat, 10);
    B.cyl(0.06, 0.06, 7.44, x, 2.44, 0, goalMat, 10, Math.PI / 2);
    B.rod([x + s * 2.0, 0, -3.66], [x, 2.44, -3.66], 0.025, 0xcccccc); B.rod([x + s * 2.0, 0, 3.66], [x, 2.44, 3.66], 0.025, 0xcccccc);
    B.rod([x + s * 2.0, 0, -3.66], [x + s * 2.0, 0, 3.66], 0.025, 0xcccccc);
  }
  // supports d'antennes HF (mâts)
  const struct = B.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }));
  struct.castShadow = true; struct.receiveShadow = true;
  scene.add(struct);

  // filets (lignes)
  {
    const pts = [];
    for (const s of [-1, 1]) {
      const x0 = s * PITCH.hl, x1 = s * (PITCH.hl + 2.0);
      for (let z = -3.66; z <= 3.661; z += 0.2) { pts.push(x0, 2.44, z, x1, 0, z); }
      for (let t = 0; t <= 1.001; t += 0.08) { const x = x0 + (x1 - x0) * t, y = 2.44 * (1 - t); pts.push(x, y, -3.66, x, y, 3.66); }
      for (const z of [-3.66, 3.66]) for (let t = 0; t <= 1.001; t += 0.1) { pts.push(x0, 2.44 * t, z, x0 + (x1 - x0) * t * 0 + (x1 - x0) * (1 - t) * 0 + (x1 - x0), 0, z); }
      for (const z of [-3.66, 3.66]) for (let y = 0; y <= 2.44; y += 0.2) { const t = 1 - y / 2.44; pts.push(x0, y, z, x0 + (x1 - x0) * t, y, z); }
      for (const z of [-3.66, 3.66]) for (let k = 0; k <= 10; k++) { const t = k / 10; const xx = x0 + (x1 - x0) * t; pts.push(xx, 0, z, xx, 2.44 * (1 - t), z); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    W.netMat = new THREE.LineBasicMaterial({ color: 0xd8d8d8, transparent: true, opacity: 0.55 });
    scene.add(new THREE.LineSegments(g, W.netMat));
  }

  // --- panneaux LED ---
  {
    const bt = boardsTexture(); W.boards = bt;
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: bt.tex }, uOff: { value: 0 }, uI: { value: 1.0 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform sampler2D map; uniform float uOff; uniform float uI; varying vec2 vUv;
        void main(){ vec3 c = texture2D(map, vec2(vUv.x + uOff, vUv.y)).rgb; gl_FragColor = vec4(c * uI, 1.0); }`,
    });
    W.boardsMat = mat;
    const segs = [];
    const addBoard = (x0, z0, x1, z1) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const g = new THREE.PlaneGeometry(len, 0.9);
      const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * len / 48);
      const m = new THREE.Matrix4();
      const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
      const ang = Math.abs(mz) > Math.abs(mx) ? (mz > 0 ? Math.PI : 0) : (mx > 0 ? -Math.PI / 2 : Math.PI / 2);
      m.compose(new THREE.Vector3(mx, 0.45, mz), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ang, 0)), new THREE.Vector3(1, 1, 1));
      g.applyMatrix4(m); segs.push(g);
      // dos du panneau
    };
    addBoard(-55, 38, 55, 38); // opposé : face vers -z ? (orientation corrigée par la normale)
    addBoard(55, -38, 20, -38); addBoard(-20, -38, -55, -38);
    addBoard(-58, 32, -58, -32); addBoard(58, -32, 58, 32);
    const geo = mergeNonIndexed(segs.map((g) => g.index ? g.toNonIndexed() : g));
    const boards = new THREE.Mesh(geo, mat);
    mat.side = THREE.DoubleSide;
    scene.add(boards);
    const B4 = new Builder();
    B4.box(110, 0.9, 0.25, 0, 0.45, 38.2, 0x15181c); B4.box(35, 0.9, 0.25, 37.5, 0.45, -38.2, 0x15181c); B4.box(35, 0.9, 0.25, -37.5, 0.45, -38.2, 0x15181c);
    B4.box(0.25, 0.9, 64, -58.2, 0.45, 0, 0x15181c); B4.box(0.25, 0.9, 64, 58.2, 0.45, 0, 0x15181c);
    const backs = B4.mesh(new THREE.MeshLambertMaterial({ vertexColors: true })); backs.castShadow = true; scene.add(backs);
  }

  // --- écrans d'angle (Trannin-Lepagnot et Marek-Delacourt), de taille modeste : sortie AUX « écran géant » ---
  {
    const mat = screenMaterial(null, { gain: 1.1 });
    W.screens.push(mat);
    const Bs = new Builder();
    for (const [sx, sz] of [[-1, -1], [1, 1]]) {
      const x = sx * (BOWL.hx + 3.6), z = sz * (BOWL.hz + 3.6), ry = Math.atan2(-x, -z);
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(6.6, 3.7), mat);
      scr.position.set(x, 13.5, z); scr.rotation.y = ry; scene.add(scr);
      if (!W.giantScreen) W.giantScreen = scr;
      const back = new THREE.Vector3(Math.sin(ry), 0, Math.cos(ry)).multiplyScalar(-0.35);
      Bs.box(7.1, 4.2, 0.5, x + back.x, 13.5, z + back.z, 0x15181c, ry);
      const side = new THREE.Vector3(Math.cos(ry), 0, -Math.sin(ry));
      for (const s of [-1, 1]) Bs.box(0.5, 11.5, 0.5, x + back.x * 2 + side.x * s * 2.4, 5.75, z + back.z * 2 + side.z * s * 2.4, 0x9aa0a6, ry);
      W.obstacles.push({ x0: x - 4.5, x1: x + 4.5, z0: z - 4.5, z1: z + 4.5 });
    }
    const sm = Bs.mesh(new THREE.MeshLambertMaterial({ vertexColors: true })); sm.castShadow = true; scene.add(sm);
  }

  // --- public ---
  buildCrowd(scene);

  // --- antennes HF (modèles) ---
  for (const a of ANTENNAS) {
    const g = new THREE.Group();
    const Bx = new Builder();
    Bx.cyl(0.05, 0.05, 1.6, 0, -0.8, 0, 0x9aa0a6, 6);
    Bx.box(0.45, 0.9, 0.1, 0, 0.2, 0, 0xe8e8e8);
    g.add(Bx.mesh(new THREE.MeshLambertMaterial({ vertexColors: true })));
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: 0x333333 }));
    led.position.set(0, 0.8, 0); g.add(led);
    g.position.set(...a.pos);
    g.lookAt(0, 0, 0); g.rotation.x = 0; g.rotation.z = 0;
    const lab = labelSprite(a.label, { scale: 9, border: 'rgba(214,92,242,0.9)' }); lab.position.set(0, 2.2, 0); setLayer(lab, 1); g.add(lab);
    scene.add(g);
    W.antennaMeshes[a.id] = { group: g, led };
    W.interactables.push({ id: 'ant:' + a.id, pos: new THREE.Vector3(...a.pos), r: 4, label: a.label, info: 'antenne' });
  }

  // --- compound et cars ---
  buildCompound(scene);

  // --- autour du stade : cités minières, voie ferrée, gare, terrils jumeaux et chevalements ---
  buildSurroundings(scene);

  // signalétique extérieure
  {
    const sign = (text, w, h, x, y, z, rotY, bg = '#13294b', fg = '#ffffff', fs = 64) => {
      const c = makeCanvas(1024, Math.round(1024 * h / w)); const g = c.getContext('2d');
      g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height); g.fillStyle = fg; g.font = `700 ${fs}px "Barlow Condensed", "Arial Narrow", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      text.split('\n').forEach((l, i, a) => g.fillText(l, 512, c.height / 2 + (i - (a.length - 1) / 2) * fs * 1.1));
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ map: t }));
      m.position.set(x, y, z); m.rotation.y = rotY; scene.add(m); return m;
    };
    const fz = -(BOWL.hz + STANDS[0].back) - 0.6;
    sign('ACCÈS TERRAIN · TUNNEL · LOCAL TECHNIQUE TV', 12, 1.4, 0, 5.2, fz, Math.PI, '#ffb020', '#15100a', 70);
    sign('STADE BOLLAERT-DELELIS', 64, 6, -40, 24.5, fz - 0.2, Math.PI, '#e9ecef', '#c8102e', 150);
    sign('VESTIAIRE · ' + TEAMS[0].name, 5, 0.8, 3.0, 2.9, -78.5, -Math.PI / 2, TEAMS[0].color, '#c8102e', 80);
    sign('LOCAL TECHNIQUE TV\nPRÉ-CÂBLAGE', 5, 1.2, -2.95, 2.8, -86.5, Math.PI / 2, '#ffd23f', '#15100a', 70);
    sign('COMPOUND TV · CARS RÉGIE', 10, 1.2, -18, 3.4, -96.6, Math.PI, '#ffb020', '#15100a', 70);
  }

  // points d'intérêt du stade
  W.interactables.push({ id: 'localtv', pos: new THREE.Vector3(-9.5, 1.5, -86.5), r: 5, label: 'Local technique TV', info: 'localtv' });
  W.interactables.push({ id: 'comm', pos: new THREE.Vector3(12, 12.4, -64.2), r: 5, label: 'Positions commentateurs (tribune Lepagnot)', info: 'commentateurs' });
  W.interactables.push({ id: 'var', pos: new THREE.Vector3(0, 1.4, -37.6), r: 2.5, label: 'Table du 4e arbitre / VAR', info: 'var' });

  // commentateurs (statiques)
  {
    const Bc = new Builder();
    for (let i = 0; i < 2; i++) {
      const x = 11 + i * 1.1, z = -(BOWL.hz + 23.7), y = TIERS.lower.y2;
      Bc.box(0.45, 0.7, 0.3, x, y + 0.9, z, 0x2b3a55); Bc.sphere(0.13, x, y + 1.42, z, 0xd9a07a); Bc.box(0.3, 0.06, 0.06, x, y + 1.42, z + 0.13, 0x111111);
      Bc.box(0.5, 0.45, 0.5, x, y + 0.23, z - 0.05, 0x111111);
    }
    const cm = Bc.mesh(new THREE.MeshLambertMaterial({ vertexColors: true })); scene.add(cm);
  }

  return scene;
}

function buildCrowd(scene) {
  const atlas = crowdAtlas();
  // matériau éclairé (soleil, ombres du toit, brume) ; la couleur vient de l'atlas et de l'instance
  const U = { uTime: { value: 0 }, uLight: { value: 1 }, uExcite: { value: new THREE.Vector2(0.1, 0.1) }, tMask: { value: atlas.mask }, tDet: { value: atlas.det } };
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0, side: THREE.DoubleSide });
  mat.uniforms = U;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
attribute float aSeed; attribute float aSide; attribute vec3 aAcc; attribute float aAO;
uniform float uTime; uniform vec2 uExcite;
varying vec2 vCUv; varying vec3 vShirt; varying vec3 vAcc; varying float vSeed; varying float vCheer; varying float vAO;`)
      .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = normalize(vec3(0.0, 0.55, 1.0));')
      .replace('#include <begin_vertex>', `vec3 transformed = vec3(position);
  float ex = aSide > 0.5 ? uExcite.y : uExcite.x;
  float ch = step(fract(aSeed * 91.7), ex * 0.75 - 0.08);
  vCheer = ch;
  transformed.y += max(0.0, sin(uTime * (7.0 + aSeed * 4.0) + aSeed * 40.0)) * (0.05 + 0.16 * ch) * ex;
  vCUv = vec2((uv.x + floor(aSeed * ${CROWD_NV}.0)) / ${CROWD_NV}.0, uv.y);
  vShirt = instanceColor; vAcc = aAcc; vSeed = aSeed; vAO = aAO;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform sampler2D tMask; uniform sampler2D tDet; uniform float uLight;
varying vec2 vCUv; varying vec3 vShirt; varying vec3 vAcc; varying float vSeed; varying float vCheer; varying float vAO;`)
      .replace('#include <map_fragment>', `{
    float rowF = (gl_FrontFacing ? 0.0 : 2.0) + vCheer;
    vec2 uvc = vec2(vCUv.x, (vCUv.y + 3.0 - rowF) / 4.0);
    vec4 mk = texture2D(tMask, uvc);
    if (mk.a < 0.5) discard;
    vec3 dt = texture2D(tDet, uvc).rgb;
    float s1 = fract(vSeed * 13.7), s2 = fract(vSeed * 7.3);
    vec3 skin = mix(vec3(0.72, 0.45, 0.32), vec3(0.42, 0.24, 0.15), s1 * s1);
    skin = mix(skin, vec3(0.16, 0.09, 0.055), step(0.9, s1));
    vec3 hair = mix(vec3(0.012, 0.009, 0.006), vec3(0.09, 0.05, 0.025), s2);
    hair = mix(hair, vec3(0.42, 0.3, 0.13), step(0.86, s2));
    hair = mix(hair, vec3(0.35, 0.35, 0.36), step(0.95, s2));
    vec3 dark = mix(vec3(0.012), vec3(0.03, 0.035, 0.06), step(0.5, fract(vSeed * 3.1)));
    float w = max(0.001, mk.r + mk.g + mk.b);
    vec3 c = (vShirt * mk.r + skin * mk.g + hair * mk.b) / w;
    c = mix(c, dark, dt.b);
    c = mix(c, vAcc, dt.g);
    diffuseColor.rgb = c * dt.r * 1.45 * vAO * uLight;
  }`)
      .replace('#include <color_fragment>', '');
  };
  mat.customProgramCacheKey = () => 'crowd';
  W.crowdMat = mat;
  const quad = new THREE.PlaneGeometry(1.7, 1.25); quad.translate(0, 0.5, 0);
  const placements = [];
  const r = mulberry32(99);
  const density = S.lite ? 0.15 : S.quality === 'basse' ? 0.5 : 1;
  // public par tribune : supporters sang et or ; parcage visiteurs dans un coin de la tribune Trannin
  for (const st of STANDS) {
    const rot = st.axis === 'z' ? (st.sgn < 0 ? 0 : Math.PI) : (st.sgn < 0 ? -Math.PI / 2 : Math.PI / 2);
    /** @type {Array<[number, number, string]>} */
    const tiers = [[st.lo[0], st.lo[1], 'lo'], [st.up[0], st.up[1], 'up']];
    for (const [o1, o2, tier] of tiers) {
      const kop = st.id === 'marek' && tier === 'lo';
      for (let o = o1 + 0.6; o < o2 - 0.3; o += kop ? 0.7 : 0.85) {
        const y = profileY(st, o);
        for (let u = -st.half + 0.9; u < st.half - 0.9; u += 1.7) {
          if (r() > (kop ? 0.97 : 0.86) * density) continue;
          if (Math.abs(((u % 22) + 22) % 22 - 11) < 0.9 && !kop) continue; // escaliers
          if (st.main && Math.abs(u) < 5.5 && o < 8) continue; // tunnel
          const m22 = ((u % 22) + 22) % 22;
          if (tier === 'lo' && o > 8.2 && o < 12.8 && (m22 < 1.7 || m22 > 20.3) && !(st.main && Math.abs(u) < 16)) continue; // vomitoires
          const [x, , z] = SP(st, u, o, y);
          const away = st.id === 'trannin' && tier === 'lo' && u > 14;
          // occultation : le fond des tribunes, sous le toit, reçoit moins de ciel
          const ao = 1 - (tier === 'up' ? 0.42 : 0.22) * Math.pow((o - o1) / Math.max(1, o2 - o1), 1.3);
          placements.push({ x, y, z, rot, side: away ? 1 : 0, kop, away, ao });
        }
      }
    }
  }
  const n = placements.length;
  const mesh = new THREE.InstancedMesh(quad, mat, n);
  const seeds = new Float32Array(n), side = new Float32Array(n), acc = new Float32Array(n * 3), aos = new Float32Array(n);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color();
  const home = [0xc8102e, 0xf5c400, 0xc8102e, 0xf5c400, 0xc8102e, 0x1a1a1a, 0xf2f2f2, 0x8a8f99, 0x2b2b2b];
  const kopCols = [0xc8102e, 0xf5c400, 0xc8102e, 0xf5c400, 0x111111];
  const awayCols = [TEAMS[1].shirt, TEAMS[1].shorts, TEAMS[1].shirt, 0x2b2b2b];
  W.visiteurs = []; // supporters visiteurs : [indice, tirage du maillot, tirage de l'écharpe] (peindreVisiteurs)
  placements.forEach((p, i) => {
    q.setFromEuler(new THREE.Euler(0, p.rot, 0));
    m.compose(new THREE.Vector3(p.x, p.y, p.z), q, new THREE.Vector3(1, 1, 1));
    mesh.setMatrixAt(i, m);
    seeds[i] = r();
    side[i] = p.side;
    const pal = p.away ? awayCols : p.kop ? kopCols : home;
    const r1 = r(); const sh = pal[Math.floor(r1 * pal.length)];
    col.setHex(sh); mesh.setColorAt(i, col);
    // accessoire (écharpe, bonnet) : l'autre couleur du club
    const r2 = r();
    const ac = p.away ? (r2 < 0.5 ? TEAMS[1].sleeves : TEAMS[1].shirt) : sh === 0xc8102e ? 0xf5c400 : sh === 0xf5c400 ? 0xc8102e : (r2 < 0.5 ? 0xc8102e : 0xf5c400);
    if (p.away) W.visiteurs.push([i, r1, r2]);
    col.setHex(ac); acc[i * 3] = col.r; acc[i * 3 + 1] = col.g; acc[i * 3 + 2] = col.b;
    aos[i] = p.ao;
  });
  quad.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
  quad.setAttribute('aSide', new THREE.InstancedBufferAttribute(side, 1));
  quad.setAttribute('aAcc', new THREE.InstancedBufferAttribute(acc, 3));
  quad.setAttribute('aAO', new THREE.InstancedBufferAttribute(aos, 1));
  mesh.frustumCulled = false; mesh.receiveShadow = true;
  scene.add(mesh);
  W.crowd = mesh;
}

/** le parcage visiteurs aux couleurs de l'adversaire du soir (adversaire.js, quand il change) */
export function peindreVisiteurs() {
  const mesh = W.crowd; if (!mesh || !W.visiteurs || !mesh.instanceColor) return;
  const pal = [TEAMS[1].shirt, TEAMS[1].shorts, TEAMS[1].shirt, 0x2b2b2b];
  const acc = mesh.geometry.attributes.aAcc, col = new THREE.Color();
  for (const [i, r1, r2] of W.visiteurs) {
    mesh.setColorAt(i, col.setHex(pal[Math.floor(r1 * pal.length)]));
    col.setHex(r2 < 0.5 ? TEAMS[1].sleeves : TEAMS[1].shirt); acc.setXYZ(i, col.r, col.g, col.b);
  }
  mesh.instanceColor.needsUpdate = true; acc.needsUpdate = true;
}

function buildCompound(scene) {
  const g = new THREE.Group();
  const B = new Builder({ ao: 0.4, aoOpts: { dist: 1.2, strength: 1.0, floor: 0.3 } });
  // enrobé : texture de teinte + relief de gravillons et plaques d'usure (matière bitume)
  const tarmac = tarmacTexture(); tarmac.repeat.set(130 / 9, 80 / 9);
  const asphalt = new THREE.Mesh(new THREE.PlaneGeometry(130, 80), matiere('bitume', { map: tarmac, vertexColors: false, roughness: 0.88, scale: 1.8, name: 'compound-bitume' }));
  asphalt.rotation.x = -Math.PI / 2; asphalt.position.set(-5, 0.0, -135); asphalt.receiveShadow = true; g.add(asphalt);
  // flaques (après la pluie du matin) : disques sombres et lisses qui reflètent le ciel
  const puddle = new THREE.MeshStandardMaterial({ color: 0x0e1114, roughness: 0.03, metalness: 0, transparent: true, opacity: 0.82, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  const rp = mulberry32(44);
  for (let i = 0; i < 9; i++) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(1, 18), puddle);
    m.rotation.x = -Math.PI / 2; m.position.set(-55 + rp() * 95, 0.006, -158 + rp() * 48); m.scale.set(1.2 + rp() * 2.8, 0.7 + rp() * 1.6, 1); m.rotation.z = rp() * 3;
    m.userData.noAO = true; g.add(m);
  }
  for (let x = -60; x <= 50; x += 10) B.box(0.15, 0.02, 5, x, 0.02, -100, 0xd9d9d9);
  // barrières de chantier (grillage sur plots béton) et accessoires de compound
  const Bm = new Builder({ ao: 0.4 }), Bp = new Builder({ ao: 0.4 }), Bw = new Builder({ ao: 0.4 });
  const fenceTex = fenceTexture();
  const fenceMat = new THREE.MeshStandardMaterial({ map: fenceTex, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.5, color: 0xb8bec4 });
  const fences = [];
  for (let x = -68; x <= 58; x += 3.5) {
    for (const dx of [-1.7, 1.7]) Bm.cyl(0.021, 0.021, 2.0, x + dx, 1.0, -96, 0xa0a6ac, 8);
    Bm.cyl(0.021, 0.021, 3.4, x, 1.98, -96, 0xa0a6ac, 8, 0, Math.PI / 2); Bm.cyl(0.021, 0.021, 3.4, x, 0.06, -96, 0xa0a6ac, 8, 0, Math.PI / 2);
    Bp.cbox(0.6, 0.15, 0.22, x + 1.75, 0.075, -96, 0x8f9296, 0.02);
    const f = new THREE.Mesh(new THREE.PlaneGeometry(3.35, 1.88), fenceMat); f.position.set(x, 1.02, -96); fences.push(f);
  }
  for (const f of fences) g.add(f);
  // cônes et balises autour des rampes de câbles, plots devant la porte du car
  const T = TRUCK;
  const cone = (x, z) => { Bp.cyl(0.03, 0.14, 0.5, x, 0.27, z, 0xff6a1a, 10); Bp.cyl(0.075, 0.095, 0.08, x, 0.3, z, 0xf4f4f0, 10); Bp.cbox(0.34, 0.04, 0.34, x, 0.02, z, 0x1a1c1e, 0.01); };
  for (const [x, z] of [[2.9, -112], [2.9, -118], [1.1, -112], [-10, -114.2], [-13, -115.8], [-4, -114.2], [1.3, -100.5], [2.8, -100.5]]) cone(x, z);
  // rampes de câbles à 5 voies (noir, couvercle jaune), bobines, flight cases et palettes près de la porte
  const ramp = (x, z, L, alongX) => {
    const w = alongX ? L : 0.9, d = alongX ? 0.9 : L;
    Bp.cbox(w, 0.06, d, x, 0.03, z, 0x1a1c1e, 0.02); Bp.cbox(alongX ? L : 0.5, 0.025, alongX ? 0.5 : L, x, 0.07, z, 0xf2c200, 0.01);
  };
  ramp(2.0, -105.5, 20, false); ramp(-6, -115, 16, true);
  for (const [x, z, h] of [[-7, -112.6, 0.5], [-7.9, -112.6, 0.5], [-7.45, -112.6, 1.06]]) { Bp.cyl(0.42, 0.42, 0.08, x, h - 0.04, z, 0x6b5a3e, 16); Bp.cyl(0.42, 0.42, 0.08, x, h + 0.44, z, 0x6b5a3e, 16); Bp.cyl(0.18, 0.18, 0.4, x, h + 0.2, z, 0x1a1c1e, 12); }
  const fcase = (x, z, w, h, d, rot = 0) => {
    Bp.cbox(w, h, d, x, h / 2 + 0.08, z, 0x16181b, 0.02, rot);
    for (const sy of [-1, 1]) for (const sz of [-1, 1]) Bm.cbox(w + 0.02, 0.03, 0.03, x, h / 2 + 0.08 + sy * (h / 2), z + sz * (d / 2), 0x9aa0a6, 0.01, rot);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) Bm.cbox(0.03, h + 0.02, 0.03, x + sx * (w / 2), h / 2 + 0.08, z + sz * (d / 2), 0x9aa0a6, 0.01, rot);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) Bp.cyl(0.04, 0.04, 0.04, x + sx * (w / 2 - 0.1), 0.04, z + sz * (d / 2 - 0.1), 0x111214, 8);
    for (const sx of [-1, 1]) Bm.cbox(0.16, 0.05, 0.03, x + sx * (w / 2 - 0.2), h * 0.75, z + d / 2 + 0.01, 0x9aa0a6, 0.01, rot);
  };
  fcase(-12.2, -114.9, 1.2, 0.8, 0.6); fcase(-12.2, -114.9 + 0.0, 1.2, 0.5, 0.6); fcase(-14.0, -115.2, 0.8, 1.1, 0.6, 0.2);
  // palette avec caisses
  const pallet = (x, z) => { for (let k = 0; k < 5; k++) Bw.box(1.2, 0.022, 0.1, x, 0.12, z - 0.4 + k * 0.2, 0xb08a56); for (const dx of [-0.5, 0, 0.5]) Bw.box(0.1, 0.1, 0.8, x + dx, 0.05, z, 0x9a7646); };
  pallet(-24, -114.5); Bp.cbox(1.0, 0.6, 0.7, -24, 0.43, -114.5, 0x2b3b52, 0.02); Bp.cbox(0.6, 0.4, 0.5, -24.1, 0.93, -114.4, 0x2b3b52, 0.02);
  // poubelle, groupe de prises, lampadaires du parking
  Bp.cyl(0.3, 0.26, 0.9, 6.5, 0.45, -112, 0x2f3338, 14); Bp.cyl(0.32, 0.32, 0.04, 6.5, 0.92, -112, 0x1a1c1e, 14);
  for (const [x, z] of [[-40, -158], [20, -158], [-40, -98.5], [40, -98.5]]) { Bm.cyl(0.08, 0.12, 8, x, 4, z, 0x7a8086, 10); Bm.cyl(0.07, 0.07, 1.4, x + 0.7, 8.0, z, 0x7a8086, 8, 0, Math.PI / 2); Bp.cbox(0.7, 0.14, 0.3, x + 1.4, 8.0, z, 0x3a3f45, 0.02); }
  for (const [b, m] of [[Bm, matiere('alu', { seed: 41, scale: 0.4, roughness: 0.5, metalness: 0.8, name: 'compound-metal' })], [Bp, matiere('plastique', { seed: 42, scale: 0.25, roughness: 0.55, name: 'compound-plastique' })], [Bw, matiere('stratifie', { seed: 43, scale: 0.4, roughness: 0.9, name: 'compound-bois' })]]) {
    const mesh = b.mesh(m); mesh.castShadow = true; mesh.receiveShadow = true; g.add(mesh);
  }

  // --- car régie (extérieur), tracteur, camion satellite, groupe, bungalows ---
  g.add(buildOBTruck(T));
  g.add(buildGenerator(18, -125));
  g.add(buildDSNG(-48, -128));
  g.add(buildBungalows(22, -150));
  // câbles d'énergie au sol (toron souple) et câbles vers le pied de car
  {
    const Bc = new Builder();
    const run = (pts, r, col) => Bc.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), false, 'catmullrom', 0.5), 48, r, 7, false), null, col);
    run([[13.4, 0.05, -122], [10, 0.04, -121.3], [6, 0.05, -121.2], [2.5, 0.04, -120.5], [-1.5, 0.05, -120.0], [-5, 0.04, -119.4], [-8, 0.05, -118.4]], 0.035, 0x111214);
    run([[13.4, 0.05, -121.6], [9, 0.04, -121.0], [5, 0.05, -120.7], [1, 0.04, -120.1], [-3, 0.05, -119.4], [-7, 0.04, -118.6], [-8.4, 0.05, -118.0]], 0.035, 0x111214);
    for (let k = 0; k < 4; k++) run([[2.2 + k * 0.08, 0.1, -96.2], [2.2 + k * 0.08, 0.1, -100], [2.1 + k * 0.08, 0.1, -108], [2.0 + k * 0.08, 0.1, -115], [-2 + k * 0.1, 0.1, -115.1], [-6, 0.1, -115.1 + k * 0.08], [-10.5, 0.4, -116.4 + k * 0.06], [T.x1 - 3.6 + k * 0.34, 1.0, T.z1 + 0.2]], 0.014, [0x1d2a44, 0x111214, 0x3a1e1e, 0x111214][k]);
    const cm = Bc.mesh(matiere('plastique', { seed: 45, scale: 0.15, roughness: 0.6, name: 'compound-cables' })); cm.castShadow = true; g.add(cm);
  }
  const mesh = B.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }));
  mesh.castShadow = true; mesh.receiveShadow = true; g.add(mesh);
  // inscription du car
  const lab = makeCanvas(1024, 160); const lg = lab.getContext('2d');
  lg.fillStyle = 'rgba(0,0,0,0)'; lg.clearRect(0, 0, 1024, 160);
  const lt = new THREE.CanvasTexture(lab); lt.colorSpace = THREE.SRGBColorSpace;
  const signMat = new THREE.MeshLambertMaterial({ map: lt, transparent: true, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.4), signMat); sign.position.set(T.cx - 3, T.floor + 1.85, T.z1 + 0.03); g.add(sign);
  W.truckSign = { canvas: lab, tex: lt };
  paintTruckSign();
  setLayer(g, 2);
  scene.add(g);
  // obstacles
  W.obstacles.push({ x0: T.x0 - 4.8, x1: T.x1, z0: T.z0 - 0.1, z1: T.z1 + 0.1, truck: true });
  W.obstacles.push({ x0: 13.4, x1: 22.6, z0: -126.4, z1: -123.6 });
  W.obstacles.push({ x0: -54.3, x1: -44.4, z0: -129.4, z1: -126.6 });
  W.obstacles.push({ x0: 18.9, x1: 38.1, z0: -151.3, z1: -148.7 });
  W.interactables.push({ id: 'pieddecar', pos: new THREE.Vector3(T.x1 - 2.3, 1.3, T.z1 + 0.5), r: 3, label: 'Pied de car (raccordements)', info: 'pieddecar' });
  W.interactables.push({ id: 'energie', pos: new THREE.Vector3(18, 1.5, -123.4), r: 4, label: 'Groupe électrogène', info: 'energie' });
  W.interactables.push({ id: 'dsng', pos: new THREE.Vector3(-48, 1.5, -126.4), r: 4, label: 'Camion satellite (DSNG)', info: 'transmission' });
  W.interactables.push({ id: 'door', pos: new THREE.Vector3((T.doorX0 + T.doorX1) / 2, 1.6, T.z1 + 1.0), r: 2.2, label: 'Entrer dans le car régie', action: 'enterTruck' });
}

// ----------------------------------------------------------------------------------
// Environnement : bassin minier autour du stade (échelle réduite pour l'horizon)
// ----------------------------------------------------------------------------------
// sol des abords (friches, pelouses, chemins) : variations douces pour casser l'aplat vu d'avion
function groundTexture() {
  const N = 512; const c = makeCanvas(N, N); const g = c.getContext('2d'); const r = mulberry32(31);
  g.fillStyle = '#4c5a3f'; g.fillRect(0, 0, N, N);
  for (let i = 0; i < 260; i++) { const x = r() * N, y = r() * N, rad = 10 + r() * 60; const tone = r(); const gr = g.createRadialGradient(x, y, 0, x, y, rad); const col = tone < 0.45 ? '86,104,64' : tone < 0.75 ? '70,82,55' : tone < 0.9 ? '104,100,78' : '92,92,88'; gr.addColorStop(0, `rgba(${col},0.55)`); gr.addColorStop(1, `rgba(${col},0)`); g.fillStyle = gr; for (const dx of [-N, 0, N]) for (const dy of [-N, 0, N]) { g.save(); g.translate(dx, dy); g.fillRect(x - rad, y - rad, rad * 2, rad * 2); g.restore(); } }
  for (let i = 0; i < 6000; i++) { const v = 60 + Math.floor(r() * 50); g.fillStyle = `rgba(${v},${v + 18},${v - 10},0.35)`; g.fillRect(r() * N, r() * N, 1.5, 1.5); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = S.lite || S.quality === 'basse' ? 2 : 4; t.repeat.set(28, 28); return t;
}
function pavingTexture() {
  const c = makeCanvas(256, 256); const g = c.getContext('2d'); const r = mulberry32(8);
  g.fillStyle = '#a8a7a2'; g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 32) for (let x = 0; x < 256; x += 64) { const v = 150 + Math.floor(r() * 30); g.fillStyle = `rgb(${v},${v},${v - 4})`; g.fillRect(x + ((y / 32) % 2) * 32 + 1, y + 1, 62, 30); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.repeat.set(60, 50); return t;
}
// toit à deux pans (faîtage le long de l'axe x si alongX, sinon de l'axe z)
function gable(B, cx, cy, cz, L, Wd, Hr, alongX, color) {
  const P = (a, c, y) => (alongX ? [cx + a, y, cz + c] : [cx + c, y, cz + a]);
  const hw = Wd / 2 + 0.3, hl = L / 2 + 0.2, top = cy + Hr;
  const n1 = alongX ? [0, hw, -Hr] : [-Hr, hw, 0], n2 = alongX ? [0, hw, Hr] : [Hr, hw, 0];
  const nrm = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); };
  const tris = [
    ...quadTris(P(-hl, -hw, cy), P(hl, -hw, cy), P(hl, 0, top), P(-hl, 0, top), nrm(n1)),
    ...quadTris(P(-hl, hw, cy), P(hl, hw, cy), P(hl, 0, top), P(-hl, 0, top), nrm(n2)),
    [P(-hl + 0.2, -hw + 0.3, cy), P(-hl + 0.2, hw - 0.3, cy), P(-hl + 0.2, 0, top - 0.1), alongX ? [-1, 0, 0] : [0, 0, -1]],
    [P(hl - 0.2, -hw + 0.3, cy), P(hl - 0.2, hw - 0.3, cy), P(hl - 0.2, 0, top - 0.1), alongX ? [1, 0, 0] : [0, 0, 1]],
  ];
  B.add(trisGeo(tris), null, color);
}
function buildSurroundings(scene) {
  const B = new Builder(); const r = mulberry32(62);
  const foot = []; // emprises des maisons (pour ne pas planter d'arbres dedans) : [x, z, rayon]
  // --- parvis piéton autour des tribunes (dalles claires) ---
  { const pv = new THREE.Mesh(new THREE.PlaneGeometry(250, 200), matiere('beton', { seed: 54, map: pavingTexture(), vertexColors: false, scale: 1.6, strength: 0.6, roughness: 0.85, name: 'parvis' })); pv.material.polygonOffset = true; pv.material.polygonOffsetFactor = 3; pv.material.polygonOffsetUnits = 6; pv.rotation.x = -Math.PI / 2; pv.position.set(0, -0.03, 5); pv.receiveShadow = true; scene.add(pv); }
  // --- arbres du parvis (instanciés) ---
  {
    const pts = [];
    const add = (x, z) => { if (standAt(x, z, 2) || (x > -80 && x < 70 && z < -94) || x < -104) return; pts.push([x, z]); };
    for (let x = -96; x <= 118; x += 11) add(x, 97);
    for (let z = -88; z <= 95; z += 11) add(116, z);
    for (let x = 70; x <= 118; x += 11) add(x, -100);
    for (const [mx, mz] of MASTS) for (let k = 0; k < 6; k++) { const a = k * 1.05; add(mx * 1.18 + Math.cos(a) * 9, mz * 1.18 + Math.sin(a) * 9); }
    buildTrees(scene, pts.map(([x, z]) => [x, z, 0.85 + r() * 0.35, 0]), { shadows: true, sectors: 4, lod: 1 });
  }
  // --- maisons de mineurs individuelles en brique (ouest et sud-ouest, vers l'ancienne fosse 9) ---
  for (let i = 0; i < 90; i++) {
    const a = Math.PI * (0.8 + r() * 0.75), d = 150 + r() * 260;
    const cx = Math.cos(a) * d, cz = Math.sin(a) * d;
    if ((Math.abs(cx) < 130 && Math.abs(cz) < 112) || (cx > -135 && cx < -95) || (cx > -80 && cx < 70 && cz > -180 && cz < -90) || (cx < -420 && cx > -540 && cz < -120 && cz > -300)) continue;
    const w = 7 + r() * 2, dd = 8 + r() * 2, hh = 5 + r() * 1.2, rot = Math.round(r()) * Math.PI / 2;
    foot.push([cx, cz, 8]);
    B.box(w, hh, dd, cx, hh / 2, cz, [0x8b4a36, 0x7a3f2e, 0x95553d][i % 3], rot);
    gable(B, cx, hh, cz, dd, w, 2.8, !!rot, [0x3b3f45, 0x8e3b2a][i % 2]);
  }
  // --- cités minières (corons) : rangées de maisons en brique ---
  const bricks = [0x8b4a36, 0x7a3f2e, 0x95553d, 0x84462f], roofs = [0x3b3f45, 0x4a3a34, 0x8e3b2a];
  const row = (cx, cz, len, alongX) => {
    const d = 7, h = 5.6, col = bricks[Math.floor(r() * bricks.length)], rc = roofs[Math.floor(r() * roofs.length)];
    const w = alongX ? len : d, dd = alongX ? d : len;
    for (let t = -len / 2; t <= len / 2; t += 8) foot.push([cx + (alongX ? t : 0), cz + (alongX ? 0 : t), 8]);
    B.box(w, h, dd, cx, h / 2, cz, col);
    // toit à deux pans (prisme triangulaire)
    gable(B, cx, h, cz, len, d, 2.6, alongX, rc);
    for (let k = 0; k < Math.floor(len / 8); k++) { const t = -len / 2 + 4 + k * 8; B.box(0.6, 1.4, 0.6, cx + (alongX ? t : 0), h + 2.2, cz + (alongX ? 0 : t), 0x6b3a2a); }
  };
  const busy = (x, z) => (Math.abs(x) < 125 && Math.abs(z) < 110) || (x > -80 && x < 70 && z > -180 && z < -90) || (x > -135 && x < -95) || (x < -380 && z > 120 && z < 700);
  for (let i = 0; i < 70; i++) {
    const a = r() * Math.PI * 2, d = 160 + r() * 420;
    const cx = Math.cos(a) * d, cz = Math.sin(a) * d;
    const alongX = r() < 0.5, len = 36 + Math.floor(r() * 4) * 8;
    if (busy(cx, cz) || busy(cx + (alongX ? 0 : 0), cz + (alongX ? 18 : 0)) || busy(cx + (alongX ? 0 : 18), cz)) continue;
    row(cx, cz, len, alongX);
    row(cx + (alongX ? 0 : 18), cz + (alongX ? 18 : 0), len, alongX);
  }
  // --- voie ferrée le long de la tribune Trannin ---
  for (const x of [-110.5, -115]) { for (const dx of [-0.72, 0.72]) B.box(0.08, 0.16, 1400, x + dx, 0.18, 0, 0x8a8f94); B.box(3.0, 0.1, 1400, x, 0.05, 0, 0x5a524a); }
  for (let z = -680; z <= 680; z += 50) { B.box(0.25, 7.5, 0.25, -108.4, 3.75, z, 0x6b7076); B.box(8.6, 0.15, 0.15, -112.6, 7.2, z, 0x6b7076); }
  B.box(0.04, 0.04, 1400, -110.5, 6.4, 0, 0x2a2a2a); B.box(0.04, 0.04, 1400, -115, 6.4, 0, 0x2a2a2a);
  for (let z = -300; z <= 300; z += 3) B.box(0.05, 1.6, 2.8, -107.6, 0.8, z, 0x8a9096); // clôture
  W.obstacles.push({ x0: -108.2, x1: -107.2, z0: -320, z1: 320 });
  // --- gare (style Art déco, tour de l'horloge), au sud-est ---
  { const gx = 380, gz = -360; B.box(70, 10, 14, gx, 5, gz, 0xd9cfbf); B.box(66, 1.2, 15, gx, 10.6, gz, 0x8e8a82); B.box(7, 22, 7, gx + 38, 11, gz, 0xd9cfbf); B.box(7.4, 1, 7.4, gx + 38, 22.4, gz, 0x8e8a82); B.cyl(2, 2, 0.4, gx + 38, 18, gz + 3.6, 0xf4f4f4, 16, Math.PI / 2); }
  // --- musée du Louvre-Lens : longues halles d'aluminium et de verre, à l'ouest-sud-ouest ---
  { const lx = -470, lz = -210; B.box(24, 8, 120, lx, 4, lz, 0xc9cdd2, 0.25); B.box(26, 7, 60, lx + 30, 3.5, lz + 40, 0xbfc4c9, 0.25); B.box(40, 6, 30, lx + 10, 3, lz - 70, 0x9fb6c8, 0.25); }
  const city = B.mesh(new THREE.MeshLambertMaterial({ vertexColors: true })); city.receiveShadow = true; scene.add(city);
  // --- bois, haies, arbres des cités (hors emprises des maisons, du stade, du compound, de la voie ferrée) ---
  {
    const busyT = (x, z) => {
      if (Math.abs(x) < 135 && Math.abs(z) < 120) return true;
      if (x > -125 && x < -98) return true; // voie ferrée
      if (x > -90 && x < 80 && z > -190 && z < -85) return true; // compound
      if (Math.hypot(x + 930, z - 480) < 140 || Math.hypot(x + 1000, z - 318) < 130) return true; // terrils
      for (const [fx, fz, fr] of foot) if (Math.abs(x - fx) < fr && Math.abs(z - fz) < fr) return true;
      return false;
    };
    buildTrees(scene, forestPoints(busyT), { shadows: false, sectors: 8, lod: 1, layer: 2 });
  }

  // --- terrils jumeaux de Loos-en-Gohelle (ouest-nord-ouest) et chevalements de la fosse 11/19 ---
  const T = new Builder();
  const terrilMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0 });
  const terril = (x, z, h, rad) => { const m = new THREE.Mesh(terrilGeometry(h, rad, Math.round(-x)), terrilMat); m.position.set(x, -0.5, z); m.receiveShadow = true; scene.add(m); };
  terril(-930, 480, 80, 125); terril(-1000, 318, 74, 118);
  // chevalement métallique (fosse 11) et tour en béton (fosse 19)
  const hx = -820, hz = 300;
  for (const [dx, dz] of [[-3, -3], [3, -3], [3, 3], [-3, 3]]) T.rod([hx + dx, 0, hz + dz], [hx + dx * 0.4, 26, hz + dz * 0.4], 0.35, 0x3a3f46, 5);
  for (let y = 4; y < 26; y += 4) { const k = 1 - y / 26 * 0.6; T.box(6 * k, 0.3, 0.3, hx, y, hz - 3 * k, 0x3a3f46); T.box(6 * k, 0.3, 0.3, hx, y, hz + 3 * k, 0x3a3f46); T.box(0.3, 0.3, 6 * k, hx - 3 * k, y, hz, 0x3a3f46); T.box(0.3, 0.3, 6 * k, hx + 3 * k, y, hz, 0x3a3f46); }
  for (const s of [-1, 1]) T.cyl(2.2, 2.2, 0.4, hx, 26.5, hz + s * 1.2, 0x2a2e33, 16, Math.PI / 2);
  T.rod([hx + 12, 0, hz - 4], [hx + 1, 24, hz], 0.5, 0x3a3f46, 5);
  T.box(12, 46, 12, hx - 40, 23, hz + 40, 0xa9a59e); T.box(14, 6, 14, hx - 40, 49, hz + 40, 0x8e8a82);
  T.box(30, 10, 18, hx - 10, 5, hz + 30, 0x8b4a36);
  const tm = T.mesh(new THREE.MeshLambertMaterial({ vertexColors: true })); scene.add(tm);

  // --- TER (circule de temps en temps le long de la tribune Trannin) ---
  const tr = new Builder();
  for (let k = 0; k < 4; k++) {
    const z = k * 27;
    tr.box(3.0, 3.4, 26, 0, 2.2, z, 0xe4e7ea); tr.box(3.02, 0.9, 25, 0, 2.7, z, 0x1b2230); tr.box(3.04, 0.35, 26, 0, 1.25, z, 0x1d6fd1);
    tr.box(2.2, 0.5, 6, 0, 4.1, z - 6, 0x9aa0a6);
  }
  tr.box(3.0, 2.6, 2, 0, 2.0, -13.5, 0xf5c400);
  W.train = tr.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }));
  W.train.position.set(-110.5, 0, -900); W.train.castShadow = true; scene.add(W.train);
}

// ----------------------------------------------------------------------------------
// Éclairage
// ----------------------------------------------------------------------------------
// nuages : coûteux sur un petit processeur graphique (ils sont aussi rendus par chaque caméra) → coupés en qualité basse
export function setCloudQuality(q) { if (W.sky) W.sky.material.uniforms.uCloud.value = q === 'basse' || S.lite ? 0 : (W.cloudBase ?? 0.42); }
export function applyLighting(key) {
  S.lighting = key;
  const sun = W.sun, f2 = W.flood2, hemi = W.hemi, sky = W.sky.material.uniforms;
  const setDir = (light, azDeg, elDeg, dist = 300) => {
    const az = azDeg * Math.PI / 180, el = elDeg * Math.PI / 180;
    light.position.set(Math.sin(az) * Math.cos(el) * dist, Math.sin(el) * dist, -Math.cos(az) * Math.cos(el) * dist);
    light.target.position.set(0, 0, 0);
  };
  f2.intensity = 0; sun.castShadow = true;
  // brume atmosphérique : quasi nulle dans le stade, elle donne de la profondeur à l'horizon (vue aérienne)
  const fog = { jour: [0x8fb4e8, 0.0011, 2.1], fin: [0xe0a070, 0.0013, 1.5], couvert: [0xb9bfc6, 0.0017, 1.5], nuit: [0x0a0d14, 0.0009, 0.05] }[key] || [0x8fb4e8, 0.0011, 2.1];
  if (!W.scene.fog) W.scene.fog = new THREE.FogExp2(fog[0], fog[1]);
  W.scene.fog.density = fog[1];
  if (key === 'jour') {
    setDir(sun, -30, 35); sun.color.setRGB(...kelvinRGBNorm(5600)); sun.intensity = 3.2;
    hemi.color.setRGB(0.55, 0.66, 0.9); hemi.groundColor.setRGB(0.32, 0.34, 0.26); hemi.intensity = 1.0;
    sky.uZen.value.setRGB(0.07, 0.2, 0.62); sky.uHor.value.setRGB(0.5, 0.64, 0.86); sky.uI.value = 1.5; W.cloudBase = 0.42; sky.uCloudCol.value.setRGB(0.8, 0.82, 0.86);
    W.boardsMat.uniforms.uI.value = 1.4; W.crowdMat.uniforms.uLight.value = 1; W.floodMat.color.setHex(0x55595d);
    S.sceneCCT = 5600; S.eyeExposure = 0.9;
  } else if (key === 'fin') {
    setDir(sun, -40, 12); sun.color.setRGB(...kelvinRGBNorm(3600)); sun.intensity = 2.4;
    hemi.color.setRGB(0.5, 0.48, 0.6); hemi.groundColor.setRGB(0.25, 0.2, 0.15); hemi.intensity = 0.55;
    sky.uZen.value.setRGB(0.05, 0.09, 0.3); sky.uHor.value.setRGB(1.0, 0.5, 0.22); sky.uI.value = 0.95; W.cloudBase = 0.48; sky.uCloudCol.value.setRGB(1.05, 0.62, 0.45);
    W.boardsMat.uniforms.uI.value = 0.9; W.crowdMat.uniforms.uLight.value = 1; W.floodMat.color.setHex(0x8a8c90);
    S.sceneCCT = 3600; S.eyeExposure = 1.5;
  } else if (key === 'couvert') {
    setDir(sun, -20, 60); sun.color.setRGB(...kelvinRGBNorm(6500)); sun.intensity = 0.35; sun.castShadow = true;
    hemi.color.setRGB(0.78, 0.82, 0.9); hemi.groundColor.setRGB(0.35, 0.36, 0.33); hemi.intensity = 0.9;
    sky.uZen.value.setRGB(0.42, 0.44, 0.48); sky.uHor.value.setRGB(0.62, 0.64, 0.67); sky.uI.value = 0.8; W.cloudBase = 0.92; sky.uCloudCol.value.setRGB(0.66, 0.68, 0.72);
    W.boardsMat.uniforms.uI.value = 0.7; W.crowdMat.uniforms.uLight.value = 1; W.floodMat.color.setHex(0x55595d);
    S.sceneCCT = 6500; S.eyeExposure = 2.6;
  } else { // nuit
    setDir(sun, 0, 58); sun.color.setRGB(...kelvinRGBNorm(5700)); sun.intensity = 0.06;
    setDir(f2, 180, 52); f2.color.setRGB(...kelvinRGBNorm(5700)); f2.intensity = 0.045;
    hemi.color.setRGB(0.6, 0.65, 0.8); hemi.groundColor.setRGB(0.2, 0.22, 0.2); hemi.intensity = 0.012;
    sky.uZen.value.setRGB(0.004, 0.007, 0.02); sky.uHor.value.setRGB(0.03, 0.03, 0.045); sky.uI.value = 0.06; W.cloudBase = 0.35; sky.uCloudCol.value.setRGB(0.12, 0.12, 0.14);
    W.boardsMat.uniforms.uI.value = 0.09; W.crowdMat.uniforms.uLight.value = 1; W.floodMat.color.setRGB(40, 40, 40);
    S.sceneCCT = 5700; S.eyeExposure = 24;
  }
  setCloudQuality(S.quality);
  // brume = luminance de l'horizon : le paysage lointain se fond dans le ciel
  W.scene.fog.color.copy(sky.uHor.value).multiplyScalar(sky.uI.value * 0.92);
  // disque solaire dans le ciel (absent la nuit et par temps couvert)
  sky.uSunDir.value.copy(sun.position).normalize(); sky.uSunCol.value.copy(sun.color);
  sky.uSunI.value = { jour: 1.0, fin: 0.8, couvert: 0, nuit: 0 }[key] ?? 0;
  // éclairage physique : l'environnement (ciel capturé) remplace la majeure partie de la lumière hémisphérique
  if (RENDER.pbr) { hemi.intensity *= key === 'jour' ? 0.45 : 0.3; refreshEnvironment(key); }
  // les haubans (non éclairés) suivent la lumière ambiante
  if (W.cableMat) W.cableMat.color.setHex({ jour: 0xd8dde2, fin: 0x9a8f88, couvert: 0x8a8f94 }[key] ?? 0x0a0b0c);
  if (W.roofMat) W.roofMat.emissive.setHex({ jour: 0x5a5f66, fin: 0x34363a, couvert: 0x3c3f43 }[key] ?? 0x030304);
  if (W.netMat) W.netMat.color.setScalar(key === 'nuit' ? 0.06 : key === 'fin' ? 0.5 : key === 'couvert' ? 0.4 : 0.85);
  updateOverlays();
  // teinte de la source en fonction de la température de couleur
  const tint = kelvinRGBNorm(S.sceneCCT);
  S.illum = tint;
}

export function updateWorld(t) {
  // un TER toutes les deux minutes environ
  if (W.flagU) W.flagU.uTime.value = t;
  if (W.flags) for (const f of W.flags) { f.rotation.y = f.userData.base + Math.sin(t * 2.2 + f.userData.ph) * 0.7; f.rotation.z = Math.sin(t * 3.1 + f.userData.ph) * 0.12; }
  if (W.train) { const c = t % 120; W.train.visible = c < 70; W.train.position.z = -900 + c * 26; }
  if (W.boardsMat) W.boardsMat.uniforms.uOff.value = Math.floor(t / 8) * (1 / 8) + (t % 8 < 0.4 ? (t % 8) / 0.4 * 0.0 : 0);
  if (W.crowdMat) W.crowdMat.uniforms.uTime.value = t;
  if (W.sky) W.sky.material.uniforms.uTime.value = t;
}

// inscription sur le flanc du car : nom donné par le formateur (sinon « Car régie ») et format
export function paintTruckSign(name) {
  if (!W.truckSign) return;
  const { canvas, tex } = W.truckSign; const g = canvas.getContext('2d');
  g.clearRect(0, 0, 1024, 160);
  const txt = ((name || 'Car régie') + ' · ' + (S.format === 'UHD' ? 'UHD' : 'HD')).toUpperCase().slice(0, 32);
  let size = 96; g.font = `700 ${size}px "Barlow Condensed", "Arial Narrow", sans-serif`;
  while (g.measureText(txt).width > 990 && size > 40) { size -= 4; g.font = `700 ${size}px "Barlow Condensed", "Arial Narrow", sans-serif`; }
  g.fillStyle = '#1c2733'; g.fillText(txt, 20, 110);
  tex.needsUpdate = true;
}

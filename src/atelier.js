// @ts-check
import * as THREE from 'three';
import { S, emit } from './state.js';
import { W } from './world.js';
import { el, makeCanvas, texteAjuste } from './util.js';
import { screenMaterial } from './geo.js';
import { addCamera, removeCamera, lineUpCamera } from './bcam.js';
import { camById } from './state.js';
import { $, toast, modal } from './ui/common.js';

// ----------------------------------------------------------------------------------
// Atelier de montage : la caméra principale (CAM 1) se monte à la main, sur la passerelle,
// pièce par pièce, comme le fait l'équipe caméra le jour du match.
//   · les pièces attendent dans leurs flight cases ; on vise, E (ou clic) pour prendre, Q pour reposer ;
//   · la pièce tenue s'affiche en fantôme à sa place de montage : vert si c'est le moment, rouge sinon
//     (la raison s'affiche, l'erreur est comptée) ;
//   · certains gestes se maintiennent (lever l'objectif à deux, déployer les jambes, nettoyer une fibre),
//     d'autres se règlent à la molette (bulle de niveau, équilibrage avant / arrière) ;
//   · la mise en service se fait avec la vision par l'intercom : alimentation par la fibre, image,
//     test tally et CALL. Une fibre mal nettoyée ou un bouchon oublié se voient à ce moment-là.
// Matériel de référence (exemples réels) : pied Vinten HDT-2 avec araignée, tête fluide Vinten Vector 750i
// (embase 4 vis), adaptateur grand objectif Sony HDLA-3505, tête de caméra Sony HDC-5500, objectif box
// Fujinon UA80x9BESM, viseur 7,4" Sony HDVF-EL760, commandes Fujinon ERD-50A (zoom) et EPD-51A (point),
// câble hybride SMPTE 311M, connecteurs SMPTE 304M (LEMO 3K.93C).
// ----------------------------------------------------------------------------------
export const AT = { active: false };
const DECK_Y = 17.225; // dessus de la passerelle caméras (tribune Lepagnot)
const H_UP = 0.95, H_DOWN = 0.62; // hauteur du haut du pied, jambes déployées / repliées

// ------------------------------- géométrie -------------------------------
function std(color, rough = 0.6, metal = 0.1, extra = {}) { return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra }); }
const MAT = {
  carbon: () => std(0x24272b, 0.45, 0.2), alu: () => std(0xb8bec4, 0.35, 0.85), dark: () => std(0x2c3035, 0.55, 0.3), black: () => std(0x121315, 0.5, 0.1),
  grey: () => std(0x4a5058, 0.5, 0.25), red: () => std(0xc8102e, 0.45, 0.1), blue: () => std(0x2d6fb3, 0.4, 0.2), rubber: () => std(0x0d0e0f, 0.9, 0),
  lens: () => std(0x17181a, 0.38, 0.15), glass: () => std(0x0b1a2a, 0.05, 0.6), orange: () => std(0xff7a1a, 0.5, 0.1), case: () => std(0x1b1d20, 0.7, 0.1),
};
function box(g, w, h, d, x, y, z, m, ry = 0) { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.rotation.y = ry; o.castShadow = true; o.receiveShadow = true; g.add(o); return o; }
function cyl(g, r1, r2, h, x, y, z, m, axis = 'y', seg = 16) {
  const o = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), m); o.position.set(x, y, z);
  if (axis === 'x') o.rotation.z = Math.PI / 2; if (axis === 'z') o.rotation.x = Math.PI / 2;
  o.castShadow = true; g.add(o); return o;
}
function rod(g, a, b, r, m, seg = 8) {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b); const len = va.distanceTo(vb);
  const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), m);
  o.position.copy(va).add(vb).multiplyScalar(0.5);
  o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
  o.castShadow = true; g.add(o); return o;
}
function label(text, w, h, bg = '#ebe5d1', fg = '#16181b', size = 60) {
  const c = makeCanvas(512, Math.round(512 * h / w)); const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height); g.fillStyle = fg;
  g.textAlign = 'center'; g.textBaseline = 'middle'; texteAjuste(g, text, 256, c.height / 2 + 3, 480, Math.min(size, Math.round(c.height * 0.8)), { family: '"Barlow Semi Condensed", "Barlow Condensed", "Arial Narrow", sans-serif' });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 }));
}

// pied lourd 2 étages (type Vinten HDT-2) avec araignée au sol ; origine au sol, haut à H_UP
function buildTripod() {
  const g = new THREE.Group(); const cb = MAT.carbon(), al = MAT.alu(), bk = MAT.black();
  const top = H_UP;
  for (let k = 0; k < 3; k++) {
    const a = k * 2.094 + Math.PI / 6, fx = Math.sin(a) * 0.62, fz = Math.cos(a) * 0.62, tx = Math.sin(a) * 0.1, tz = Math.cos(a) * 0.1;
    rod(g, [tx, top - 0.03, tz], [tx + (fx - tx) * 0.55, top * 0.45, tz + (fz - tz) * 0.55], 0.024, cb);
    rod(g, [tx * 1.25, top - 0.06, tz * 1.25], [tx + (fx - tx) * 0.55 + 0.02, top * 0.45, tz + (fz - tz) * 0.55], 0.014, cb);
    rod(g, [tx + (fx - tx) * 0.5, top * 0.5, tz + (fz - tz) * 0.5], [fx, 0.03, fz], 0.017, al);
    box(g, 0.06, 0.07, 0.06, tx + (fx - tx) * 0.55, top * 0.45, tz + (fz - tz) * 0.55, bk); // serrage de jambe
    box(g, 0.09, 0.035, 0.09, fx, 0.018, fz, MAT.rubber());
    // araignée au sol : bras vers le centre
    rod(g, [fx, 0.03, fz], [0, 0.03, 0], 0.012, bk, 6);
  }
  cyl(g, 0.05, 0.05, 0.04, 0, 0.03, 0, bk);
  cyl(g, 0.13, 0.11, 0.06, 0, top - 0.02, 0, MAT.dark(), 'y', 24); // embase plate 4 vis
  for (let k = 0; k < 4; k++) cyl(g, 0.012, 0.012, 0.012, Math.cos(k * 1.57 + 0.78) * 0.09, top + 0.012, Math.sin(k * 1.57 + 0.78) * 0.09, al, 'y', 8);
  return g;
}
// tête fluide (type Vinten Vector 750i) ; origine à l'embase
function buildHead() {
  const g = new THREE.Group(); const dk = MAT.dark(), gr = MAT.grey(), al = MAT.alu();
  cyl(g, 0.12, 0.12, 0.03, 0, 0.015, 0, dk, 'y', 24);
  box(g, 0.24, 0.13, 0.25, 0, 0.1, 0, gr);
  cyl(g, 0.085, 0.085, 0.3, 0, 0.18, 0, dk, 'x', 24); // tambour d'inclinaison
  for (const s of [-1, 1]) cyl(g, 0.05, 0.05, 0.03, s * 0.16, 0.18, 0, MAT.blue(), 'x', 18); // molettes de contrepoids / friction
  box(g, 0.2, 0.02, 0.3, 0, 0.25, 0, al); // plateau
  for (const s of [-1, 1]) cyl(g, 0.035, 0.035, 0.05, s * 0.15, 0.09, 0.1, dk, 'x', 14); // rosaces des manches
  const lock = box(g, 0.015, 0.05, 0.015, 0.13, 0.13, 0.04, MAT.red()); lock.name = 'lock';
  // niveau à bulle
  cyl(g, 0.025, 0.025, 0.012, -0.08, 0.2, 0.12, std(0x0b2a14, 0.2, 0.1, { transparent: true, opacity: 0.9 }), 'y', 18);
  const bub = new THREE.Mesh(new THREE.SphereGeometry(0.008, 10, 8), std(0x8cf06a, 0.3, 0, { emissive: 0x2a8a20, emissiveIntensity: 0.8 }));
  bub.position.set(-0.08, 0.208, 0.12); bub.name = 'bubble'; g.add(bub);
  return g;
}
function buildBar(side) {
  const g = new THREE.Group(); const al = MAT.alu();
  rod(g, [0, 0, 0], [side * 0.23, -0.12, 0.62], 0.016, al);
  rod(g, [side * 0.215, -0.112, 0.58], [side * 0.235, -0.125, 0.7], 0.022, MAT.rubber());
  return g;
}
function buildPlate() {
  const g = new THREE.Group();
  box(g, 0.18, 0.025, 0.48, 0, 0.012, 0.02, MAT.alu());
  box(g, 0.2, 0.012, 0.12, 0, 0.03, 0.02, MAT.dark());
  const lv = box(g, 0.06, 0.012, 0.03, 0.12, 0.016, 0.2, MAT.red()); lv.name = 'lever';
  return g;
}
// adaptateur grand objectif (type Sony HDLA-3505) ; origine au centre de sa base
function buildAdaptor() {
  const g = new THREE.Group(); const dk = std(0x353a40, 0.55, 0.25), d2 = std(0x262a2f, 0.6, 0.2);
  box(g, 0.3, 0.32, 0.38, 0, 0.16, 0, dk);
  box(g, 0.31, 0.04, 0.36, 0, 0.33, 0, d2);
  box(g, 0.2, 0.03, 0.2, 0, 0.37, -0.02, d2); // poignée de transport
  cyl(g, 0.135, 0.135, 0.03, 0, 0.16, -0.2, d2, 'z', 28); // monture avant de l'objectif
  box(g, 0.18, 0.24, 0.02, 0, 0.15, 0.19, std(0x0c0d0e, 0.8, 0)); // baie arrière (accueil de la caméra)
  for (let i = 0; i < 5; i++) box(g, 0.004, 0.16, 0.012, 0.152, 0.16, -0.1 + i * 0.05, std(0x15171a, 0.8, 0));
  const lv = box(g, 0.015, 0.06, 0.03, 0.158, 0.06, 0.08, MAT.red()); lv.name = 'lever';
  return g;
}
// tête de caméra (type Sony HDC-5500) ; origine au centre
function buildCamera() {
  const g = new THREE.Group(); const gr = std(0x4c535b, 0.5, 0.3);
  box(g, 0.16, 0.25, 0.25, 0, 0, 0, gr);
  box(g, 0.17, 0.04, 0.26, 0, 0.145, 0, std(0x2c3035, 0.5, 0.25));
  cyl(g, 0.03, 0.03, 0.05, 0.04, -0.06, 0.145, MAT.alu(), 'z', 14); // embase fibre SMPTE (LEMO 3K.93C)
  cyl(g, 0.018, 0.018, 0.03, -0.045, -0.06, 0.135, MAT.black(), 'z', 10); // INTERCOM (XLR 5)
  const call = box(g, 0.025, 0.018, 0.01, -0.045, 0.08, 0.13, std(0xd8d8d8, 0.4, 0)); call.name = 'call';
  box(g, 0.08, 0.05, 0.006, 0.02, 0.06, 0.128, std(0x0e2a14, 0.3, 0, { emissive: 0x0a2a10, emissiveIntensity: 0.4 }));
  return g;
}
// objectif box (type Fujinon UA80x9BESM) ; origine à la monture, l'objectif s'étend vers -z
function buildLens(L = 0.62) {
  const g = new THREE.Group(); const bk = MAT.lens(), b2 = std(0x101113, 0.5, 0.1);
  box(g, 0.258, 0.24, L * 0.84, 0, 0, -L * 0.42, bk);
  box(g, 0.28, 0.28, L * 0.16, 0, 0, -L * 0.92, bk);
  box(g, 0.31, 0.31, 0.035, 0, 0, -L - 0.012, b2);
  cyl(g, 0.118, 0.118, 0.012, 0, 0, -L - 0.03, MAT.glass(), 'z', 28);
  cyl(g, 0.13, 0.13, 0.04, 0, 0, -0.01, std(0x2a2e33, 0.5, 0.3), 'z', 24);
  box(g, 0.014, 0.15, L * 0.38, 0.136, -0.03, -L * 0.25, std(0x2c2f33, 0.5, 0.2)); // module servo
  box(g, 0.004, 0.045, 0.08, 0.144, 0.02, -L * 0.18, std(0x183a22, 0.3, 0, { emissive: 0x0a2010, emissiveIntensity: 0.6 }));
  box(g, 0.14, 0.08, 0.16, 0, -0.16, -L * 0.32, std(0x23272c, 0.6, 0.2)); // support d'objectif
  const lab = label('FUJINON  UA80x9BESM', 0.3, 0.03, '#17181a', '#dfe2e5', 40); lab.position.set(-0.1305, 0.05, -L * 0.45); lab.rotation.y = -Math.PI / 2; g.add(lab);
  const cap = new THREE.Group(); cap.name = 'cap';
  cyl(cap, 0.16, 0.16, 0.03, 0, 0, 0, MAT.rubber(), 'z', 28); cap.position.set(0, 0, -L - 0.045); g.add(cap);
  return g;
}
// viseur 7,4" (type Sony HDVF-EL760) ; origine sous son pied ; l'écran regarde vers +z (le cadreur)
function buildViewfinder() {
  const g = new THREE.Group(); const dk = std(0x1b1e22, 0.6, 0.2);
  box(g, 0.07, 0.08, 0.07, 0, 0.04, 0, std(0x23272c, 0.6, 0.2));
  box(g, 0.25, 0.18, 0.13, 0, 0.17, 0.02, dk);
  box(g, 0.27, 0.012, 0.1, 0, 0.266, 0.12, MAT.black()); for (const s of [-1, 1]) box(g, 0.012, 0.17, 0.1, s * 0.13, 0.18, 0.12, MAT.black());
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.125), new THREE.MeshBasicMaterial({ color: 0x030405 })); scr.position.set(0, 0.17, 0.087); scr.name = 'screen'; g.add(scr);
  const tal = box(g, 0.12, 0.025, 0.03, 0, 0.27, -0.03, std(0x2b0d0d, 0.4, 0)); tal.name = 'tally';
  return g;
}
function buildDemand(kind) {
  const g = new THREE.Group();
  cyl(g, 0.026, 0.026, 0.05, 0, 0, 0, MAT.black(), 'z', 12); // collier sur le manche
  if (kind === 'zoom') { box(g, 0.055, 0.075, 0.11, 0, 0.045, 0, std(0x23272c, 0.5, 0.2)); box(g, 0.02, 0.015, 0.035, 0, 0.088, 0.01, std(0xf2c400, 0.5, 0.1)); }
  else { box(g, 0.06, 0.06, 0.09, 0, 0.04, 0, std(0x23272c, 0.5, 0.2)); cyl(g, 0.048, 0.048, 0.025, 0.045, 0.045, 0, std(0x3a3f45, 0.4, 0.4), 'x', 22); }
  return g;
}
function buildDrum() {
  const g = new THREE.Group();
  for (const s of [-1, 1]) cyl(g, 0.26, 0.26, 0.02, s * 0.12, 0.27, 0, std(0x2a2d31, 0.5, 0.5), 'x', 28);
  cyl(g, 0.18, 0.18, 0.22, 0, 0.27, 0, std(0x0d0e0f, 0.85, 0), 'x', 24);
  box(g, 0.3, 0.03, 0.3, 0, 0.015, 0, std(0x2a2d31, 0.5, 0.5));
  cyl(g, 0.03, 0.03, 0.08, 0.15, 0.45, 0.1, MAT.orange(), 'z', 12);
  return g;
}
function buildPen() { const g = new THREE.Group(); cyl(g, 0.012, 0.012, 0.16, 0, 0, 0, std(0x1f6fd1, 0.5, 0.1), 'z', 10); cyl(g, 0.006, 0.006, 0.03, 0, 0, -0.095, std(0xeeeeee, 0.5, 0), 'z', 8); return g; }
function buildHeadset() {
  const g = new THREE.Group(); const bk = MAT.black();
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.008, 6, 18, Math.PI), bk); band.position.y = 0.0; g.add(band);
  for (const s of [-1, 1]) cyl(g, 0.04, 0.04, 0.03, s * 0.085, 0, 0, bk, 'x', 14);
  rod(g, [-0.095, -0.01, 0], [-0.07, -0.06, 0.08], 0.004, bk, 5);
  return g;
}
function buildWallBox() {
  const g = new THREE.Group();
  box(g, 0.18, 0.16, 0.08, 0, 0, 0, std(0x8a9098, 0.45, 0.6));
  cyl(g, 0.032, 0.032, 0.04, 0, 0, -0.06, MAT.alu(), 'z', 14);
  const capm = cyl(g, 0.036, 0.036, 0.02, 0, 0, -0.085, MAT.red(), 'z', 14); capm.name = 'dustcap';
  const lab = label('CAM 1 · SMPTE', 0.16, 0.03); lab.position.set(0, 0.06, -0.041); lab.rotation.y = Math.PI; g.add(lab);
  return g;
}
function buildCase(w, d, h, text) {
  const g = new THREE.Group(); const cm = MAT.case(), al = MAT.alu();
  box(g, w, h, d, 0, h / 2, 0, cm);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, 0.035, h + 0.01, 0.035, sx * (w / 2 - 0.012), h / 2, sz * (d / 2 - 0.012), al);
  box(g, w + 0.01, 0.02, d + 0.01, 0, h, 0, al);
  const lid = box(g, w, 0.06, d, 0, h + 0.02, -d / 2 - 0.03, cm); lid.rotation.x = -1.35; lid.position.set(0, h + d / 2 * Math.sin(1.35) * 0.05 + 0.02, -d / 2 - 0.03); // couvercle ouvert vers l'arrière
  const lab = label(text, Math.min(w * 0.8, 0.5), 0.08); lab.position.set(0, h * 0.55, d / 2 + 0.002); g.add(lab);
  return g;
}

// ------------------------------- pièces et opérations -------------------------------
// mount : position dans le repère du pied (y vers le haut, -z vers le terrain, +x à droite du cadreur)
const PARTS = {
  tripod: { label: 'Pied lourd 2 étages + araignée', ex: 'type Vinten HDT-2', mass: 15, build: buildTripod, mount: [0, 0, 0], hold: [0.42, -0.36, 1.0], holdRot: [0, 0, Math.PI / 2] },
  head: { label: 'Tête fluide', ex: 'type Vinten Vector 750i, embase 4 vis', mass: 18, build: buildHead, mount: [0, H_UP, 0], hold: [0.3, -0.3, 0.7] },
  barL: { label: 'Manche gauche', ex: 'barre de panoramique télescopique', mass: 1, build: () => buildBar(-1), mount: [-0.15, H_UP + 0.09, 0.1], hold: [0.25, -0.2, 0.55] },
  barR: { label: 'Manche droit', ex: 'barre de panoramique télescopique', mass: 1, build: () => buildBar(1), mount: [0.15, H_UP + 0.09, 0.1], hold: [0.25, -0.2, 0.55] },
  plate: { label: 'Plaque coulissante', ex: 'semelle de la tête, levier de blocage rouge', mass: 1.5, build: buildPlate, mount: [0, H_UP + 0.26, 0], hold: [0.25, -0.25, 0.6] },
  adaptor: { label: 'Adaptateur grand objectif', ex: 'type Sony HDLA-3505, 15,5 kg', mass: 15.5, build: buildAdaptor, mount: [0, H_UP + 0.285, 0], hold: [0.3, -0.3, 0.75] },
  camera: { label: 'Tête de caméra', ex: 'type Sony HDC-5500', mass: 5, build: buildCamera, mount: [0, H_UP + 0.43, 0.31], hold: [0.25, -0.25, 0.6] },
  lens: { label: 'Objectif box', ex: 'type Fujinon UA80x9BESM, ≈ 23,5 kg', mass: 23.5, lift2: true, build: () => buildLens(0.62), mount: [0, H_UP + 0.445, -0.2], hold: [0.38, -0.42, 1.15], holdRot: [0, Math.PI / 2, 0] },
  vf: { label: 'Viseur 7,4" OLED', ex: 'type Sony HDVF-EL760', mass: 3.3, build: buildViewfinder, mount: [0, H_UP + 0.655, 0.05], hold: [0.25, -0.25, 0.65] },
  zoom: { label: 'Commande de zoom', ex: 'type Fujinon ERD-50A (bascule au pouce)', mass: 0.5, build: () => buildDemand('zoom'), mounts: { L: [-0.38, H_UP - 0.03, 0.66], R: [0.38, H_UP - 0.03, 0.66] }, hold: [0.2, -0.2, 0.45] },
  focus: { label: 'Commande de point', ex: 'type Fujinon EPD-51A (molette)', mass: 0.5, build: () => buildDemand('focus'), mounts: { L: [-0.38, H_UP - 0.03, 0.66], R: [0.38, H_UP - 0.03, 0.66] }, hold: [0.2, -0.2, 0.45] },
  fiber: { label: 'Câble fibre hybride SMPTE 311M', ex: 'touret de 100 m, connecteurs SMPTE 304M (LEMO 3K.93C)', mass: 9, build: buildDrum, mount: [0.04, H_UP + 0.37, 0.455], hold: [0.3, -0.45, 0.8], tool: false },
  pen: { label: 'Stylo de nettoyage fibre', ex: 'nettoyeur « one-click » pour connecteurs SMPTE', mass: 0.05, build: buildPen, tool: true, hold: [0.2, -0.16, 0.4] },
  headset: { label: 'Casque intercom', ex: 'micro-casque du cadreur, prise INTERCOM de la caméra (XLR 5)', mass: 0.3, build: buildHeadset, mount: [-0.3, H_UP + 0.02, 0.55], hold: [0.22, -0.2, 0.45] },
};
// opérations : place = poser une pièce ; act = geste (clic ou maintien) ; adjust = réglage à la molette
const OPS = [
  { id: 'tripod', kind: 'place', part: 'tripod', label: 'Poser le pied sur le repère', phase: 'Support', req: [], tip: 'Le pied se pose sur le repère « CAM 1 » collé au sol : c\'est la position prévue au plan de caméras.' },
  { id: 'legs', kind: 'act', on: 'tripod', hold: 1.0, label: 'Déployer et bloquer les jambes', phase: 'Support', req: ['tripod'], at: [0.32, 0.45, 0.18], tip: 'Les jambes se sortent à la hauteur d\'optique voulue (≈ 1,40 m d\'axe) et chaque serrage est bloqué.' },
  { id: 'spreader', kind: 'act', on: 'tripod', label: 'Verrouiller l\'araignée', phase: 'Support', req: ['tripod'], at: [0, 0.05, 0], tip: 'Araignée verrouillée : sous 50 kg de charge, des jambes libres s\'écartent.' },
  { id: 'head', kind: 'place', part: 'head', label: 'Poser la tête fluide sur l\'embase', phase: 'Support', req: ['legs', 'spreader'], tip: 'Embase plate 4 vis : la tête se boulonne sur le pied (un adaptateur est nécessaire si le support n\'a qu\'une embase Mitchell).' },
  { id: 'level', kind: 'adjust', on: 'head', label: 'Mettre la tête à niveau (bulle)', phase: 'Support', req: ['head'], at: [-0.08, H_UP + 0.21, 0.12], tip: 'Visez la bulle, molette pour rattraper l\'horizon, E pour valider quand elle est au centre.' },
  { id: 'lock', kind: 'act', on: 'head', label: 'Verrouiller panoramique et inclinaison', phase: 'Support', req: ['head'], at: [0.13, H_UP + 0.13, 0.04], tip: 'Toujours verrouiller la tête avant d\'ajouter ou de retirer une charge : une plateforme libre bascule.' },
  { id: 'barL', kind: 'place', part: 'barL', label: 'Monter le manche gauche', phase: 'Support', req: ['head'], tip: 'Les dentures de la rosace doivent s\'emboîter avant de serrer.' },
  { id: 'barR', kind: 'place', part: 'barR', label: 'Monter le manche droit', phase: 'Support', req: ['head'], tip: 'Les dentures de la rosace doivent s\'emboîter avant de serrer.' },
  { id: 'plate', kind: 'place', part: 'plate', label: 'Fixer la plaque coulissante', phase: 'Caméra', req: ['head', 'lock'], tip: 'La plaque reçoit l\'adaptateur ; elle coulissera pour l\'équilibrage.' },
  { id: 'adaptor', kind: 'place', part: 'adaptor', label: 'Poser l\'adaptateur grand objectif', phase: 'Caméra', req: ['plate', 'lock', 'level'], tip: 'Une fois chargée, la tête ne se remet plus à niveau : bulle d\'abord.' },
  { id: 'adlock', kind: 'act', on: 'adaptor', label: 'Verrouiller l\'adaptateur (témoin, test de traction)', phase: 'Caméra', req: ['adaptor'], at: [0.16, H_UP + 0.34, 0.08], tip: 'Levier fermé, témoin visible, puis on tire : la charge ne doit pas bouger.' },
  { id: 'camera', kind: 'place', part: 'camera', label: 'Insérer la tête de caméra par l\'arrière', phase: 'Caméra', req: ['adlock'], tip: 'Sur un adaptateur HDLA-3505, l\'alimentation, la vidéo et les commandes passent par l\'accouplement : pas de câble entre caméra et adaptateur.' },
  { id: 'camlock', kind: 'act', on: 'camera', label: 'Verrouiller la caméra dans l\'adaptateur', phase: 'Caméra', req: ['camera'], at: [0.09, H_UP + 0.5, 0.33], tip: 'Le verrou d\'accouplement garantit le contact du connecteur.' },
  { id: 'lens', kind: 'place', part: 'lens', label: 'Monter l\'objectif box (à deux)', phase: 'Caméra', req: ['adlock', 'lock'], tip: '≈ 24 kg en bout de bras : on le soulève à deux, tête verrouillée, et on le présente sur la monture de l\'adaptateur.' },
  { id: 'lenslock', kind: 'act', on: 'lens', label: 'Verrouiller l\'objectif sur son support', phase: 'Caméra', req: ['lens'], at: [0, H_UP + 0.27, -0.4], tip: 'Bouton de blocage serré : un objectif mal tenu dérive en mise au point et abîme la monture.' },
  { id: 'lenscable', kind: 'act', on: 'lens', label: 'Brancher le câble d\'objectif (36 broches)', phase: 'Caméra', req: ['lens', 'camlock'], at: [0.14, H_UP + 0.47, -0.22], tip: 'Ce câble porte les commandes de zoom, de point et d\'iris entre la caméra et l\'objectif.' },
  { id: 'vf', kind: 'place', part: 'vf', label: 'Poser le viseur 7,4"', phase: 'Caméra', req: ['adlock'], tip: 'Le viseur s\'emboîte sur le dessus de l\'adaptateur ; il reçoit l\'image et le tally.' },
  { id: 'zoom', kind: 'place', part: 'zoom', label: 'Fixer la commande de zoom sur un manche', phase: 'Commandes', req: [], reqAny: ['barL', 'barR'], tip: 'En Europe, on la met souvent à gauche (pouce gauche) ; c\'est une préférence d\'opérateur.' },
  { id: 'focus', kind: 'place', part: 'focus', label: 'Fixer la commande de point sur l\'autre manche', phase: 'Commandes', req: [], reqAny: ['barL', 'barR'], tip: 'Molette de point sur l\'autre manche (souvent à droite en Europe).' },
  { id: 'demcable', kind: 'act', on: 'lens', label: 'Brancher les commandes sur l\'objectif', phase: 'Commandes', req: ['zoom', 'focus', 'lens'], at: [0.15, H_UP + 0.42, -0.34], tip: 'Prises ZOOM et FOCUS du module servo. On règle ensuite la vitesse maxi et la courbe de la commande de zoom.' },
  { id: 'balance', kind: 'adjust', on: 'plate', label: 'Équilibrer (plaque avant / arrière)', phase: 'Équilibrage', req: ['lens', 'vf', 'camlock', 'lenslock'], at: [0.12, H_UP + 0.28, 0.2], tip: 'Contrepoids de la tête réglé pour cette charge avant de libérer le verrou central, sinon la caméra bascule. Molette pour faire glisser la plaque avant / arrière, E quand elle tient seule à l\'horizontale ; les frictions se règlent après, au goût du cadreur.' },
  { id: 'cleanCam', kind: 'act', on: 'camera', tool: 'pen', hold: 1.0, label: 'Nettoyer le connecteur fibre de la caméra', phase: 'Liaison', req: ['camlock'], at: [0.04, H_UP + 0.37, 0.46], tip: 'À chaque branchement : on inspecte et on nettoie. Une poussière sur une fibre suffit à faire chuter le niveau optique.' },
  { id: 'cleanWall', kind: 'act', on: 'wall', tool: 'pen', hold: 1.0, label: 'Nettoyer la prise murale SMPTE', phase: 'Liaison', req: [], at: 'wall', tip: 'La prise de la passerelle (pré-câblage vers le car) se nettoie aussi, bouchon retiré.' },
  { id: 'fiberCam', kind: 'place', part: 'fiber', label: 'Brancher la fibre sur la caméra', phase: 'Liaison', req: ['camlock'], tip: 'Connecteur SMPTE 304M : on aligne le détrompeur, on visse la bague.' },
  { id: 'fiberWall', kind: 'act', on: 'wall', label: 'Raccorder la fibre à la prise murale', phase: 'Liaison', req: ['fiberCam'], at: 'wall', tip: 'La fibre rejoint le pré-câblage de la passerelle, qui descend jusqu\'au pied de car et à la CCU.' },
  { id: 'strain', kind: 'act', on: 'tripod', label: 'Attacher le câble au pied (anti-traction)', phase: 'Liaison', req: ['fiberCam'], at: [0.1, 0.55, 0.35], tip: 'Un câble qu\'on accroche ne doit pas tirer sur le connecteur, ni renverser la caméra.' },
  { id: 'headset', kind: 'place', part: 'headset', label: 'Brancher le casque intercom', phase: 'Mise en service', req: ['camlock'], tip: 'Le casque se branche sur la prise INTERCOM de la caméra : le cadreur entend la réalisation par la fibre.' },
  { id: 'cap', kind: 'act', on: 'lens', label: 'Retirer le bouchon d\'objectif', phase: 'Mise en service', req: ['lens'], at: [0, H_UP + 0.445, -0.86], tip: 'Le bouchon protège la lentille frontale pendant le montage.' },
  { id: 'power', kind: 'act', on: 'camera', label: 'Appeler la vision : « CAM 1 câblée »', phase: 'Mise en service', req: ['fiberWall', 'headset', 'lenscable', 'camlock', 'vf'], at: [-0.05, H_UP + 0.51, 0.45], tip: 'La CCU alimente la tête par la fibre hybride ; la vision allume la caméra depuis le car.' },
  { id: 'tally', kind: 'act', on: 'camera', label: 'Tester le tally et le CALL avec la vision', phase: 'Mise en service', req: ['power'], at: [-0.05, H_UP + 0.51, 0.45], tip: 'Touche CALL de la caméra : la lampe d\'appel s\'allume au RCP ; la vision envoie le tally pour vérifier la lampe du viseur.' },
];
const OPI = Object.fromEntries(OPS.map((o) => [o.id, o]));
// raisons pédagogiques des refus (prérequis manquants)
const WHY = {
  legs: 'Déployez et bloquez d\'abord les jambes du pied.', spreader: 'Verrouillez l\'araignée : sous la charge, des jambes libres s\'écartent.',
  head: 'Il faut d\'abord la tête fluide.', level: 'Mettez la tête à niveau avant de la charger : une fois l\'adaptateur posé, on ne rattrape plus l\'horizon.',
  lock: 'Verrouillez la tête (panoramique et inclinaison) avant d\'y poser une charge : une plateforme libre bascule brutalement.',
  plate: 'Il faut d\'abord la plaque coulissante sur la tête.', adaptor: 'Il faut d\'abord l\'adaptateur.', adlock: 'Verrouillez l\'adaptateur sur la plaque (levier fermé, test de traction) avant d\'y ajouter du poids.',
  camera: 'Il faut d\'abord la tête de caméra.', camlock: 'Verrouillez la caméra dans l\'adaptateur.', lens: 'Il faut d\'abord l\'objectif.', lenslock: 'Verrouillez l\'objectif sur son support.',
  vf: 'Il faut d\'abord le viseur.', zoom: 'Il manque la commande de zoom.', focus: 'Il manque la commande de point.', fiberCam: 'Branchez d\'abord la fibre côté caméra.',
  fiberWall: 'La fibre n\'est pas raccordée à la prise murale.', headset: 'Branchez le casque : sans intercom, pas de mise en service avec la vision.', lenscable: 'Le câble d\'objectif n\'est pas branché.',
  tripod: 'Il faut d\'abord le pied.', barL: 'Il faut d\'abord un manche.', barR: 'Il faut d\'abord un manche.', power: 'La caméra n\'est pas encore allumée par la vision.', tripodH: '',
};

// ------------------------------- état -------------------------------
const rc = new THREE.Raycaster(); rc.far = 4.2; rc.layers.set(2);
// calques : 2 = vue « œil » seulement, 3 = ombres. Les caméras du stade (calque 0) ne voient pas l'atelier :
// la CAM 1 allumée filme depuis l'axe de l'objectif monté, qui lui boucherait l'image.
function eyeOnly(root) { root.traverse((o) => { if (!o.isLight) o.layers.mask = (1 << 2) | (1 << 3); }); }
const V = new THREE.Vector3(), Q = new THREE.Quaternion(), E3 = new THREE.Euler();
let ctx = null;

function resetState() {
  Object.assign(AT, {
    active: true, t0: performance.now(), done: new Set(), errors: [], incidents: 0, held: null, target: null, hold: null, keyE: false,
    level: (Math.random() < 0.5 ? -1 : 1) * (1.0 + Math.random() * 0.8), balance: 0.07 + Math.random() * 0.03, clean: { cam: false, wall: false }, dirty: { cam: false, wall: false },
    cap: true, powered: false, alarm: false, tilting: 0, mountSide: {}, objs: {}, hot: [], pick: [], seq: [], finished: false, report: null, cam: null,
  });
}

export function beginAtelier(c) {
  ctx = c;
  if (AT.active) endAtelier(true);
  resetState();
  // la CAM 1 (plan large) est démontée : c'est elle qu'on va monter
  const c1 = camById(1);
  AT.saved = c1 ? { id: 1, slotId: c1.slotId, type: c1.type, lens: c1.lens, link: c1.link, role: c1.role } : (AT.saved || { id: 1, slotId: 'g_c1', type: 'plateau', lens: 'UA80', link: 'smpte', role: 'large' });
  if (c1) removeCamera(1);
  const o = { x: -1.5, z: -67.9 };
  const root = new THREE.Group(); root.name = 'atelier'; W.scene.add(root); AT.root = root;
  const rig = new THREE.Group(); rig.position.set(o.x, DECK_Y, o.z); rig.rotation.y = Math.PI; root.add(rig); AT.rig = rig;
  rig.updateMatrixWorld(true);
  // repère au sol (gaffer) et étiquette
  const mark = new THREE.Group();
  for (const [w, d, r] of [[0.9, 0.05, 0.785], [0.9, 0.05, -0.785]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.004, d), std(0xf2cf45, 0.8, 0)); m.rotation.y = r; m.position.y = 0.003; mark.add(m); }
  const ml = label('CAM 1 · PLAN LARGE', 0.42, 0.07); ml.rotation.x = -Math.PI / 2; ml.position.set(0, 0.004, 0.55); mark.add(ml);
  rig.add(mark); AT.mark = mark;
  // prise murale sur le garde-corps (pré-câblage vers le car)
  const wb = buildWallBox(); wb.position.set(1.5, 0.62, -0.55); rig.add(wb); AT.wall = wb;
  // flight cases au fond de la passerelle, pièces posées dessus
  /** @type {Array<[string, number, number, number, number, string[]]>} : étiquette, largeur, profondeur, hauteur, x, pièces */
  const cases = [
    ['PIED', 1.25, 0.36, 0.3, -6.4, ['tripod']], ['TÊTE · MANCHES', 0.7, 0.5, 0.42, -5.2, ['head', 'barL', 'barR', 'plate']],
    ['ADAPTATEUR', 0.6, 0.55, 0.42, -4.3, ['adaptor']], ['CAMÉRA', 0.5, 0.45, 0.4, -3.55, ['camera']],
    ['OBJECTIF', 0.95, 0.5, 0.45, -2.6, ['lens']], ['VISEUR · COMMANDES', 0.6, 0.45, 0.4, -1.65, ['vf', 'zoom', 'focus']], ['ACCESSOIRES', 0.45, 0.4, 0.35, -0.95, ['pen', 'headset']],
  ];
  for (const [text, w, d, h, x, parts] of cases) {
    const cg = buildCase(w, d, h, text); cg.position.set(x, DECK_Y, -70.0); root.add(cg); // étiquette vers la passerelle, couvercle ouvert vers le mur
    parts.forEach((pid, i) => {
      const P = PARTS[pid]; const obj = P.build();
      const n = parts.length, dx = n > 1 ? (i - (n - 1) / 2) * (w / n) : 0;
      obj.position.set(x + dx, DECK_Y + h + 0.03, -70.0);
      if (pid === 'tripod') { obj.scale.set(0.5, 0.5, 0.5); obj.rotation.set(0, 0, Math.PI / 2); obj.position.set(x - 0.45, DECK_Y + h + 0.06, -70.0); }
      if (pid === 'lens') obj.rotation.y = Math.PI / 2;
      root.add(obj); addPick(obj, pid);
      AT.objs[pid] = { obj, home: { pos: obj.position.clone(), rot: obj.rotation.clone(), scale: obj.scale.clone() }, state: 'case' };
    });
  }
  // éclairage de travail : deux panneaux LED sur pied derrière les flight cases (la passerelle est à l'ombre de la tribune haute)
  for (const x of [-4.4, -1.2]) {
    const st = new THREE.Group(); st.position.set(x, DECK_Y, -70.33); root.add(st);
    rod(st, [0, 0, 0], [0, 2.25, 0], 0.016, MAT.black());
    for (let k = 0; k < 3; k++) rod(st, [0, 0.5, 0], [Math.cos(k * 2.09) * 0.32, 0.01, Math.sin(k * 2.09) * 0.07], 0.01, MAT.black(), 5);
    const pan = box(st, 0.34, 0.22, 0.04, 0, 2.32, 0.03, std(0x1a1c1f, 0.6, 0.2)); pan.rotation.x = 0.55;
    const led = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.18), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 3.7, 3.3), toneMapped: true }));
    led.position.set(0, 2.32 - 0.012, 0.055); led.rotation.x = 0.55; st.add(led);
    const L = new THREE.PointLight(0xffe9d2, 10, 0, 2); L.position.set(0, 2.2, 0.3); st.add(L);
  }
  // touret de fibre au sol
  { const d = buildDrum(); d.position.set(-0.4, DECK_Y, -69.75); root.add(d); addPick(d, 'fiber'); AT.objs.fiber = { obj: d, home: { pos: d.position.clone(), rot: d.rotation.clone(), scale: d.scale.clone() }, state: 'case' }; }
  // repères d'action (points cliquables) : invisibles, une pastille montre ceux qui sont disponibles
  const dotMat = new THREE.SpriteMaterial({ map: dotTexture(), depthTest: false, transparent: true, toneMapped: false });
  for (const op of OPS) {
    if (op.kind === 'place' || !op.at) continue;
    const hs = new THREE.Mesh(new THREE.SphereGeometry(op.id === 'spreader' ? 0.12 : 0.07, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
    if (op.at === 'wall') hs.position.copy(wb.position).add(new THREE.Vector3(0, 0, -0.08)); else hs.position.set(...op.at);
    hs.userData.at = { kind: 'act', op: op.id }; rig.add(hs); AT.hot.push(hs);
    const dot = new THREE.Sprite(dotMat); dot.scale.set(0.035, 0.035, 1); dot.position.copy(hs.position); dot.renderOrder = 10; dot.visible = false; rig.add(dot); hs.userData.dot = dot;
  }
  eyeOnly(root); W.sun.shadow.camera.layers.enable(3);
  // panneau : feuille de montage
  buildPanel();
  // le stagiaire arrive au bout de la zone : les flight cases devant lui, le repère CAM 1 sur sa gauche
  if (ctx && ctx.place) ctx.place(0.1, DECK_Y, -68.65, 1.28, -0.32);
  ctx && ctx.intercom && ctx.intercom('VISION', 'La 1 est à monter sur la passerelle : tout est dans les flight cases. Appelle-moi quand elle est câblée.');
  emit('atelier', { type: 'start' });
}
function addPick(obj, pid) {
  // volume de visée invisible autour de la pièce : les pièces fines (pied, manches) restent faciles à viser
  obj.updateMatrixWorld(true);
  const inv = obj.matrixWorld.clone().invert(), bb = new THREE.Box3();
  obj.traverse((m) => { if (m.isMesh && m.geometry) { m.geometry.computeBoundingBox(); bb.union(m.geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld))); } });
  const sz = bb.getSize(new THREE.Vector3()).addScalar(0.04), c = bb.getCenter(new THREE.Vector3());
  const proxy = new THREE.Mesh(new THREE.BoxGeometry(sz.x, sz.y, sz.z), new THREE.MeshBasicMaterial({ visible: false })); proxy.position.copy(c); proxy.name = 'pickProxy'; obj.add(proxy);
  obj.traverse((m) => { if (m.isMesh) m.userData.at = { kind: 'pick', part: pid }; });
  AT.pick.push(obj);
}
function dotTexture() {
  const c = makeCanvas(64, 64); const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 30); gr.addColorStop(0, 'rgba(160,220,255,1)'); gr.addColorStop(0.4, 'rgba(140,205,242,0.85)'); gr.addColorStop(1, 'rgba(140,205,242,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); return t;
}

// ------------------------------- règles -------------------------------
function missing(op) {
  const miss = op.req.filter((r) => !AT.done.has(r));
  if (op.reqAny && !op.reqAny.some((r) => AT.done.has(r))) miss.push(op.reqAny[0]);
  if (op.id === 'cleanWall' && AT.done.has('fiberWall')) return [];
  return miss;
}
function available(op) { return !AT.done.has(op.id) && missing(op).length === 0; }
function fail(op, msg) {
  AT.errors.push({ op: op.id, label: op.label, msg, t: (performance.now() - AT.t0) / 1000 });
  say(msg, 'bad'); flashPanel();
}
function say(msg, kind = '') { if (AT.logEl) { AT.logEl.textContent = msg; AT.logEl.className = 'at-log ' + kind; } }

// ------------------------------- interactions -------------------------------
export function atelierInput(type, code) {
  if (!AT.active || S.modalOpen) return false;
  const isUse = code === 'KeyE' || code === 'Mouse0';
  if (type === 'down' && code === 'KeyQ') { putBack(); return true; }
  if (isUse) {
    if (type === 'down') { AT.keyE = true; use(); }
    else { AT.keyE = false; if (AT.hold) { AT.hold = null; ringEl().hidden = true; } }
    return true;
  }
  return false;
}
export function atelierWheel(dy) {
  if (!AT.active || !AT.target || AT.target.kind !== 'act') return false;
  const op = OPI[AT.target.op];
  if (op.kind !== 'adjust' || !available(op)) return false;
  // pavé tactile : de nombreux petits événements ; on cumule jusqu'à l'équivalent d'un cran de molette
  AT.wacc = (AT.wacc || 0) + dy;
  if (Math.abs(AT.wacc) < 40) return true;
  const step = Math.sign(AT.wacc); AT.wacc = 0;
  if (op.id === 'level') { AT.level = clampN(AT.level + step * 0.18, -3, 3); updateBubble(); }
  if (op.id === 'balance') { AT.balance = clampN(AT.balance + step * 0.01, -0.12, 0.12); AT.tilting = 1; }
  gauge(op); return true;
}
const clampN = (v, a, b) => Math.max(a, Math.min(b, v));

function use() {
  const t = AT.target;
  if (!t) { if (AT.held) say('Visez la place de la pièce (son fantôme) pour la monter, ou Q pour la reposer.'); return; }
  if (t.kind === 'pick') return pickUp(t.part);
  if (t.kind === 'mount') return install(t.part, t.side);
  if (t.kind === 'act') return act(OPI[t.op]);
}
function pickUp(pid) {
  if (AT.held) { say(`Vous tenez déjà : ${PARTS[AT.held].label}. Q pour la reposer.`); return; }
  const o = AT.objs[pid]; if (!o || o.state !== 'case') return;
  const P = PARTS[pid];
  if (P.lift2) { startHold(1.3, 'Levage à deux : un collègue soulève l\'autre côté', () => grab(pid)); say('Objectif de ≈ 24 kg : maintenez E, un collègue vous aide à le soulever.'); return; }
  grab(pid);
}
function grab(pid) {
  const o = AT.objs[pid]; AT.held = pid; o.state = 'hand';
  if (pid === 'tripod') o.obj.scale.setScalar(0.5);
  say(`En main : ${PARTS[pid].label} (${PARTS[pid].ex}). ${PARTS[pid].tool ? 'Visez le connecteur à nettoyer.' : 'Visez sa place : le fantôme vert indique où la monter.'}`);
  makeGhost(pid); updatePanel();
}
function putBack() {
  const pid = AT.held; if (!pid) return;
  const o = AT.objs[pid]; o.obj.position.copy(o.home.pos); o.obj.rotation.copy(o.home.rot); o.obj.scale.copy(o.home.scale);
  o.state = 'case'; AT.held = null; clearGhost(); say(`${PARTS[pid].label} reposé dans son flight case.`); updatePanel();
}
function opForPart(pid) { return OPS.find((o) => o.kind === 'place' && o.part === pid && !AT.done.has(o.id)); }
function install(pid, side) {
  const op = opForPart(pid); if (!op) return;
  const miss = missing(op);
  if (miss.length) { AT.incidents += /lock|adlock|spreader|level/.test(miss[0]) ? 1 : 0; return fail(op, WHY[miss[0]] || `Il faut d'abord : ${OPI[miss[0]] ? OPI[miss[0]].label.toLowerCase() : miss[0]}.`); }
  const P = PARTS[pid]; const o = AT.objs[pid];
  let mp = P.mount;
  if (P.mounts) { mp = P.mounts[side]; AT.mountSide[pid] = side; }
  // le pied se pose replié ; le touret reste au sol, c'est le connecteur qui monte
  if (pid === 'fiber') { o.obj.position.copy(AT.rig.localToWorld(new THREE.Vector3(0.55, 0, 0.75))); o.obj.rotation.set(0, 0.6, 0); o.obj.scale.setScalar(1); o.state = 'mounted'; drawFiber(false); }
  else {
    AT.root.remove(o.obj); AT.rig.add(o.obj); o.obj.position.set(...mp); o.obj.rotation.set(0, 0, 0); o.obj.scale.setScalar(1); o.state = 'mounted';
    const px = o.obj.getObjectByName('pickProxy'); if (px) o.obj.remove(px);
    if (pid === 'tripod') { o.obj.scale.set(1, H_DOWN / H_UP, 1); }
    if (pid === 'headset') o.obj.rotation.set(0, 0, 0.3);
  }
  AT.held = null; clearGhost(); done(op);
  if ((pid === 'zoom' || pid === 'focus')) {
    const other = pid === 'zoom' ? 'focus' : 'zoom';
    if (AT.mountSide[other] === side) { /* impossible : la place est prise (filtré au ciblage) */ }
    if (pid === 'zoom') say(side === 'L' ? 'Commande de zoom à gauche : la configuration la plus courante en Europe.' : 'Commande de zoom à droite : la configuration habituelle aux États-Unis. C\'est une préférence d\'opérateur, les deux se rencontrent.', 'ok');
  }
}
function act(op) {
  if (AT.done.has(op.id) && !(op.tool === 'pen')) {
    // fibre sale : on débranche, nettoie et rebranche avec le stylo en main
    return;
  }
  // nettoyage (avec le stylo) et reprise d'une fibre sale après la mise sous tension
  if (op.tool === 'pen') {
    const end = op.id === 'cleanCam' ? 'cam' : 'wall';
    if (AT.held !== 'pen') return fail(op, 'Prenez le stylo de nettoyage (flight case « Accessoires ») avant de toucher au connecteur.');
    const reconnect = AT.dirty[end];
    startHold(reconnect ? 1.8 : 1.0, reconnect ? 'Débrancher, nettoyer, inspecter, rebrancher' : 'Nettoyer et inspecter le connecteur', () => {
      AT.clean[end] = true; AT.dirty[end] = false;
      if (!AT.done.has(op.id)) done(op);
      if (reconnect && !AT.powered) say('Connecteur débranché, nettoyé, inspecté et rebranché avant la mise sous tension : bon réflexe.', 'ok');
      else if (reconnect) { say('Connecteur nettoyé et rebranché : le niveau optique remonte à la CCU.', 'ok'); ctx.intercom && ctx.intercom('VISION', 'C\'est bon, le niveau optique est revenu dans le vert. Image stable.', 'ok'); updateVf(); }
      else say('Connecteur propre : bouchon retiré, extrémité nettoyée et inspectée.', 'ok');
      updatePanel();
    });
    return;
  }
  const miss = missing(op);
  if (miss.length) { AT.incidents += /lock|adlock/.test(miss[0]) ? 1 : 0; return fail(op, WHY[miss[0]] || `Il faut d'abord : ${OPI[miss[0]] ? OPI[miss[0]].label.toLowerCase() : miss[0]}.`); }
  if (op.kind === 'adjust') {
    if (op.id === 'level') { if (Math.abs(AT.level) <= 0.2) { done(op); say('Tête de niveau : la bulle est au centre.', 'ok'); } else fail(op, `Pas encore de niveau (${AT.level.toFixed(1).replace('.', ',')}°) : tournez la molette jusqu'à centrer la bulle.`); }
    if (op.id === 'balance') { if (Math.abs(AT.balance) <= 0.01) { done(op); AT.tilting = 0; say('Caméra équilibrée : elle tient seule à l\'horizontale. Contrepoids et frictions réglés.', 'ok'); } else fail(op, `Pas encore en équilibre : la caméra ${AT.balance > 0 ? 'pique du nez' : 'part en arrière'}. Faites glisser la plaque à la molette.`); }
    return;
  }
  if (op.hold) { startHold(op.hold, op.label, () => finishAct(op)); return; }
  finishAct(op);
}
function finishAct(op) {
  if (op.id === 'legs') { const t = AT.objs.tripod.obj; t.scale.set(1, 1, 1); }
  if (op.id === 'fiberWall') {
    if (!AT.clean.wall) AT.dirty.wall = true;
    drawFiber(true); const cap = AT.wall.getObjectByName('dustcap'); if (cap) cap.visible = false;
    const d = AT.objs.fiber.obj; d.visible = false;
  }
  if (op.id === 'cap') { const cap = AT.objs.lens.obj.getObjectByName('cap'); if (cap) cap.visible = false; AT.cap = false; if (AT.powered) { ctx.intercom && ctx.intercom('VISION', 'J\'ai l\'image de la 1. Je fais les noirs et les blancs depuis le RCP.', 'ok'); } updateVf(); }
  if (op.id === 'power') return powerOn(op);
  if (op.id === 'tally') return tallyTest(op);
  if (op.id === 'strain') { const s = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.006, 6, 12), std(0x111111, 0.8, 0)); s.position.set(0.1, 0.55, 0.32); AT.rig.add(s); eyeOnly(s); }
  done(op);
}
function done(op) {
  AT.done.add(op.id);
  if (op.id === 'fiberCam' && !AT.clean.cam) AT.dirty.cam = true;
  if (op.kind !== 'adjust' && !['cap', 'power', 'tally'].includes(op.id)) say(`✓ ${op.label}. ${op.tip}`, 'ok');
  updatePanel();
  if (OPS.every((o) => AT.done.has(o.id))) setTimeout(finish, 1200);
}
// mise en service : alimentation par la CCU, image, éventuelles alarmes
function powerOn(op) {
  done(op);
  const sv = AT.saved;
  ctx.intercom && ctx.intercom('CAM 1', 'Vision, la 1 est câblée, casque branché : tu peux m\'allumer.');
  setTimeout(() => {
    if (!AT.active) return;
    ctx.intercom && ctx.intercom('VISION', 'Je t\'allume depuis la CCU.');
    const cam = addCamera({ ...sv });
    if (cam) {
      cam.hideModel = true; if (cam.model) cam.model.root.visible = false; cam.manual = true; lineUpCamera(cam); AT.cam = cam;
      // pas encore de cadreur : la caméra reste sur son cadre de repos, plan large sur le rond central
      const p = cam.cam.position, dx = -p.x, dy = 0.5 - p.y, dz = -p.z;
      cam.yaw.v = Math.atan2(-dx, -dz); cam.pitch.v = Math.atan2(dy, Math.hypot(dx, dz));
      cam.lf.v = Math.log(Math.min(cam.fMax, Math.max(cam.fMin, cam.sensor.w * Math.hypot(dx, dy, dz) / 42))); cam.applyPose();
    }
    AT.powered = true; updateVf();
    setTimeout(() => {
      if (!AT.active) return;
      if (AT.dirty.cam || AT.dirty.wall) {
        AT.alarm = true;
        ctx.intercom && ctx.intercom('VISION', `Alarme CCU : niveau optique bas, l'image décroche. Vérifie la fibre ${AT.dirty.cam ? 'côté caméra' : 'à la prise murale'} : débranche, nettoie, rebranche.`, 'bad');
        AT.errors.push({ op: 'clean', label: 'Fibre branchée sans nettoyage', msg: 'Connecteur branché sans être nettoyé : niveau optique trop bas à la CCU.', t: (performance.now() - AT.t0) / 1000 });
        say('Prenez le stylo de nettoyage et visez le connecteur fautif (maintenez E).', 'bad');
      } else if (AT.cap) {
        ctx.intercom && ctx.intercom('VISION', 'J\'ai du noir sur la 1… Ton bouchon est encore sur l\'objectif ?', 'bad');
      } else ctx.intercom && ctx.intercom('VISION', 'J\'ai l\'image de la 1. Je fais les noirs et les blancs depuis le RCP.', 'ok');
      updatePanel(); updateVf();
    }, 1800);
  }, 1200);
}
function tallyTest(op) {
  if (AT.dirty.cam || AT.dirty.wall) return fail(op, 'Réglez d\'abord l\'alarme de niveau optique : la liaison doit être propre.');
  if (AT.cap) return fail(op, 'La vision n\'a pas d\'image : retirez le bouchon d\'objectif.');
  ctx.intercom && ctx.intercom('CAM 1', 'CALL.');
  const tal = AT.objs.vf.obj.getObjectByName('tally');
  let n = 0; const iv = setInterval(() => { n++; if (tal) tal.material.emissive.setHex(n % 2 ? 0xff2a1a : 0x000000), tal.material.emissiveIntensity = 2.2; if (n >= 6) { clearInterval(iv); if (tal) tal.material.emissive.setHex(0); } }, 300);
  setTimeout(() => { ctx.intercom && ctx.intercom('VISION', 'Reçu ton appel, et ton tally s\'allume ? Parfait. La 1 est prête, à toi.', 'ok'); done(op); }, 1900);
}
function startHold(sec, label, cb) {
  AT.hold = { need: sec * (AT.fast || 1), t: 0, label, cb }; // AT.fast : tests automatiques (rendu logiciel très lent)
  const r = ringEl(); r.hidden = false; r.querySelector('span').textContent = label;
}
function ringEl() { return $('#at-ring'); }

// ------------------------------- fantômes, fibre, viseur -------------------------------
const GHOST_OK = new THREE.MeshBasicMaterial({ color: 0x5fe08a, transparent: true, opacity: 0.32, depthWrite: false, toneMapped: false });
const GHOST_NO = new THREE.MeshBasicMaterial({ color: 0xff5a4a, transparent: true, opacity: 0.28, depthWrite: false, toneMapped: false });
function makeGhost(pid) {
  clearGhost();
  const P = PARTS[pid]; const op = opForPart(pid);
  if (!op || P.tool) return;
  const sides = P.mounts ? Object.keys(P.mounts).filter((s) => !Object.entries(AT.mountSide).some(([k, v]) => k !== pid && v === s)) : [null];
  AT.ghosts = sides.map((side) => {
    const gobj = pid === 'fiber' ? buildFiberPlug() : P.build();
    gobj.traverse((m) => { if (m.isMesh) { m.material = GHOST_OK; m.castShadow = false; m.userData.at = { kind: 'mount', part: pid, side }; } });
    gobj.position.set(...(side ? P.mounts[side] : P.mount));
    if (pid === 'tripod') gobj.scale.set(1, H_DOWN / H_UP, 1);
    // grande zone de visée invisible autour du point de montage
    const hit = new THREE.Mesh(new THREE.SphereGeometry(pid === 'tripod' ? 0.45 : 0.18, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.set(0, pid === 'tripod' ? 0.4 : 0.05, 0); hit.userData.at = { kind: 'mount', part: pid, side }; gobj.add(hit);
    AT.rig.add(gobj); eyeOnly(gobj); return gobj;
  });
}
function buildFiberPlug() { const g = new THREE.Group(); cyl(g, 0.034, 0.034, 0.09, 0, 0, 0.04, MAT.orange(), 'z', 14); return g; }
function clearGhost() { for (const g of AT.ghosts || []) AT.rig.remove(g); AT.ghosts = []; }
function drawFiber(full) {
  if (AT.fiberMesh) { AT.rig.remove(AT.fiberMesh); AT.fiberMesh.geometry.dispose(); }
  const pts = [[0.04, H_UP + 0.37, 0.48], [0.08, H_UP + 0.2, 0.5], [0.12, 0.6, 0.36], [0.2, 0.05, 0.42], [0.5, 0.03, 0.7]];
  if (full) pts.splice(4, 1, [0.9, 0.03, 0.3], [1.45, 0.05, -0.2], [1.5, 0.45, -0.5], [1.5, 0.62, -0.62]);
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
  AT.fiberMesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 60, 0.0065, 6, false), std(0x101112, 0.6, 0.1));
  AT.fiberMesh.castShadow = true; AT.rig.add(AT.fiberMesh);
  const plug = buildFiberPlug(); plug.position.set(0.04, H_UP + 0.37, 0.455); AT.rig.add(plug);
  eyeOnly(AT.fiberMesh); eyeOnly(plug);
}
function updateVf() {
  const vf = AT.objs.vf && AT.objs.vf.obj; if (!vf) return;
  const scr = vf.getObjectByName('screen'); if (!scr) return;
  const live = AT.powered && AT.cam && !AT.cap && !AT.dirty.cam && !AT.dirty.wall;
  if (live) {
    if (!AT.vfMat) { AT.vfMat = screenMaterial(AT.cam.outRT.texture, { gain: 1.05 }); W.screens.push(AT.vfMat); }
    AT.vfMat.uniforms.map.value = AT.cam.outRT.texture; scr.material = AT.vfMat;
  } else scr.material = new THREE.MeshBasicMaterial({ color: AT.powered ? (AT.cap ? 0x050505 : 0x2a2e33) : 0x030405 });
}
function updateBubble() {
  const head = AT.objs.head && AT.objs.head.obj; if (!head) return;
  const b = head.getObjectByName('bubble'); if (!b) return;
  b.position.x = -0.08 + clampN(AT.level / 3, -1, 1) * 0.016;
}

// ------------------------------- boucle -------------------------------
export function updateAtelier(dt, pcam) {
  if (!AT.active) return;
  // pièce tenue : devant le regard, en bas à droite
  if (AT.held) {
    const o = AT.objs[AT.held].obj; const P = PARTS[AT.held];
    const [hx, hy, hz] = P.hold || [0.25, -0.25, 0.6];
    V.set(hx, hy, -hz).applyQuaternion(pcam.quaternion).add(pcam.position);
    o.position.copy(V);
    Q.copy(pcam.quaternion); if (P.holdRot) Q.multiply(new THREE.Quaternion().setFromEuler(E3.set(...P.holdRot)));
    o.quaternion.copy(Q);
  }
  // ciblage
  rc.setFromCamera({ x: 0, y: 0 }, pcam);
  const objs = [];
  for (const p of AT.pick) if (AT.objs[[...Object.keys(AT.objs)].find((k) => AT.objs[k].obj === p)]?.state === 'case') objs.push(p);
  if (AT.held) for (const g of AT.ghosts || []) objs.push(g);
  for (const h of AT.hot) objs.push(h);
  const hits = rc.intersectObjects(objs, true);
  let tgt = null;
  for (const h of hits) {
    const a = h.object.userData.at; if (!a) continue;
    if (a.kind === 'pick' && AT.held) continue;
    if (a.kind === 'act') { const op = OPI[a.op]; if (AT.done.has(op.id) && !(op.tool === 'pen' && AT.alarm && AT.dirty[op.id === 'cleanCam' ? 'cam' : 'wall'])) continue; if (op.on !== 'wall' && op.on && !AT.done.has(OPS.find((x) => x.kind === 'place' && x.part === op.on)?.id ?? op.on) && op.on !== 'plate') continue; }
    tgt = a; break;
  }
  setTarget(tgt);
  // ghosts : vert si autorisé, rouge sinon
  if (AT.held) { const op = opForPart(AT.held); const ok = op && missing(op).length === 0; for (const g of AT.ghosts || []) g.traverse((m) => { if (m.isMesh && m.material !== m.userData.keep) m.material = ok ? GHOST_OK : GHOST_NO; }); }
  // maintien
  if (AT.hold) {
    if (!AT.keyE) { AT.hold = null; ringEl().hidden = true; }
    else {
      AT.hold.t += dt; const k = Math.min(1, AT.hold.t / AT.hold.need);
      ringEl().style.setProperty('--p', (k * 100).toFixed(0));
      if (k >= 1) { const cb = AT.hold.cb; AT.hold = null; ringEl().hidden = true; cb(); }
    }
  }
  // équilibrage : la caméra bascule selon le balourd tant que ce n'est pas réglé
  if (AT.done.has('lens') && AT.done.has('vf') && !AT.done.has('balance') && AT.target && AT.target.kind === 'act' && AT.target.op === 'balance') AT.tilting = 1;
  const tiltTarget = AT.tilting && !AT.done.has('balance') ? clampN(AT.balance * 2.4, -0.25, 0.25) : 0;
  for (const pid of ['plate', 'adaptor', 'camera', 'lens', 'vf']) {
    const o = AT.objs[pid]; if (!o || o.state !== 'mounted') continue;
    const P = PARTS[pid]; const pivotY = H_UP + 0.18;
    const ang = (o.obj.userData.tilt || 0) + (tiltTarget - (o.obj.userData.tilt || 0)) * Math.min(1, dt * 4);
    o.obj.userData.tilt = ang;
    const base = new THREE.Vector3(...P.mount); const shift = pid === 'plate' ? 0 : 0;
    const rel = base.clone().sub(new THREE.Vector3(0, pivotY, 0)); rel.z += shift;
    rel.applyAxisAngle(new THREE.Vector3(1, 0, 0), -ang);
    o.obj.position.set(rel.x, rel.y + pivotY, rel.z); o.obj.rotation.set(-ang, 0, 0);
  }
  // pastilles des actions disponibles
  for (const h of AT.hot) { const op = OPI[h.userData.at.op]; const vis = available(op) || (op.tool === 'pen' && AT.alarm && AT.dirty[op.id === 'cleanCam' ? 'cam' : 'wall']); h.userData.dot.visible = vis; if (vis) { const s = 0.03 + Math.sin(performance.now() / 260) * 0.006; h.userData.dot.scale.set(s, s, 1); } }
  // garder le joueur sur la passerelle
  const tEl = $('#at-time'); if (tEl) { const s = (performance.now() - AT.t0) / 1000; tEl.textContent = `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`; }
}
function setTarget(t) {
  const key = t ? JSON.stringify(t) : '';
  if (AT._tk === key) return; AT._tk = key; AT.target = t;
  // surbrillance de la pièce visée dans son flight case
  for (const k in AT.objs) glow(AT.objs[k].obj, t && t.kind === 'pick' && t.part === k);
  const p = $('#prompt'); if (!p) return;
  if (!t) { p.hidden = true; gauge(null); return; }
  p.hidden = false; p.innerHTML = '';
  if (t.kind === 'pick') { const P = PARTS[t.part]; p.append(el('kbd', {}, 'E'), el('span', {}, (P.lift2 ? 'Soulever à deux (maintenir) : ' : 'Prendre : ') + P.label), el('small', {}, `${P.ex} · ${String(P.mass).replace('.', ',')} kg`)); gauge(null); }
  else if (t.kind === 'mount') { const op = opForPart(t.part); const miss = op ? missing(op) : []; p.append(el('kbd', {}, 'E'), el('span', {}, miss.length ? 'Pas encore : ' + op.label.toLowerCase() : op.label), el('small', {}, miss.length ? (WHY[miss[0]] || '') : op.tip)); gauge(null); }
  else if (t.kind === 'act') {
    const op = OPI[t.op]; const miss = missing(op);
    const reconnect = op.tool === 'pen' && AT.dirty[op.id === 'cleanCam' ? 'cam' : 'wall'];
    p.append(el('kbd', {}, op.kind === 'adjust' ? 'Molette · E' : (op.hold || op.tool ? 'E maintenu' : 'E')), el('span', {}, reconnect ? 'Débrancher, nettoyer, rebrancher' : op.label), el('small', {}, miss.length ? (WHY[miss[0]] || '') : op.tip));
    gauge(op.kind === 'adjust' && !miss.length ? op : null);
  }
}
function glow(obj, on) {
  obj.traverse((m) => {
    if (!m.isMesh || !m.material || !m.material.emissive) return;
    const u = m.material.userData; if (u.base === undefined) u.base = m.material.emissive.getHex();
    m.material.emissive.setHex(on ? 0x1d4256 : u.base);
  });
}
function gauge(op) {
  const g = $('#at-gauge'); if (!g) return;
  if (!op) { g.hidden = true; return; }
  g.hidden = false;
  const v = op.id === 'level' ? AT.level / 3 : AT.balance / 0.12;
  g.querySelector('b').textContent = op.id === 'level' ? 'Niveau à bulle' : 'Équilibre avant / arrière';
  g.querySelector('i').style.left = `${50 + clampN(v, -1, 1) * 46}%`;
  g.querySelector('small').textContent = op.id === 'level' ? `${AT.level >= 0 ? '+' : ''}${AT.level.toFixed(1).replace('.', ',')}° · centre = de niveau` : (Math.abs(AT.balance) <= 0.01 ? 'En équilibre' : `${AT.balance > 0 ? 'Pique du nez' : 'Part en arrière'} · plaque ${Math.round(AT.balance * 100)} cm`);
  g.classList.toggle('ok', op.id === 'level' ? Math.abs(AT.level) <= 0.2 : Math.abs(AT.balance) <= 0.01);
}

// ------------------------------- panneau -------------------------------
function buildPanel() {
  $('#atelier')?.remove();
  const box = el('aside', { id: 'atelier', 'aria-label': 'Feuille de montage' },
    el('div', { class: 'at-head' }, el('span', { class: 'tape' }, 'Montage · CAM 1'), el('span', { class: 'at-meta' }, el('b', { id: 'at-time' }, '0:00'), ' · ', el('b', { id: 'at-err' }, '0'), ' erreur(s)')),
    el('p', { class: 'at-intro' }, 'Caméra principale, plan large : pied lourd, tête fluide, adaptateur grand objectif, objectif box, viseur, commandes, fibre. Visez une pièce dans les flight cases, E pour la prendre, Q pour la reposer.'),
    el('ol', { class: 'at-list', id: 'at-list' }),
    el('p', { class: 'at-log', id: 'at-log', role: 'status', 'aria-live': 'polite' }, 'Commencez par le pied : flight case « PIED », au fond de la passerelle.'),
    el('div', { class: 'at-foot' }, el('button', { class: 'btn small', onclick: () => endAtelier(false, true) }, 'Quitter l\'atelier')));
  document.body.appendChild(box);
  AT.logEl = box.querySelector('#at-log');
  if (!$('#at-ring')) document.body.appendChild(el('div', { id: 'at-ring', hidden: true }, el('i'), el('span')));
  if (!$('#at-gauge')) {
    const stepBtn = (d, t) => el('button', { class: 'at-step', 'aria-label': t, onclick: () => atelierWheel(d * 100), onpointerdown: (e) => e.stopPropagation() }, d < 0 ? '−' : '+');
    document.body.appendChild(el('div', { id: 'at-gauge', hidden: true }, el('b'), el('div', { class: 'at-row' }, stepBtn(-1, 'Moins'), el('div', { class: 'at-track' }, el('em'), el('i')), stepBtn(1, 'Plus')), el('small')));
  }
  updatePanel();
}
function updatePanel() {
  const list = $('#at-list'); if (!list) return;
  list.innerHTML = '';
  let phase = '';
  const next = OPS.find((o) => available(o));
  for (const op of OPS) {
    if (op.phase !== phase) { phase = op.phase; list.append(el('li', { class: 'at-phase' }, phase)); }
    const st = AT.done.has(op.id) ? 'done' : op === next ? 'next' : available(op) ? 'open' : 'wait';
    let extra = '';
    if (AT.alarm && ((op.id === 'cleanCam' && AT.dirty.cam) || (op.id === 'cleanWall' && AT.dirty.wall))) extra = ' · à reprendre'; // l'erreur ne se révèle qu'à la mise en service
    list.append(el('li', { class: 'at-op ' + st + (extra ? ' warn' : '') }, el('span', { class: 'at-box', 'aria-hidden': 'true' }), op.label + extra));
  }
  const e = $('#at-err'); if (e) e.textContent = String(AT.errors.length);
  const n = list.querySelector('.next'); if (n && n.scrollIntoView) n.scrollIntoView({ block: 'nearest' });
}
function flashPanel() { const p = $('#atelier'); if (!p) return; p.classList.remove('flash'); void p.offsetWidth; p.classList.add('flash'); updatePanel(); }

// ------------------------------- fin -------------------------------
function finish() {
  if (!AT.active || AT.finished) return;
  AT.finished = true;
  const sec = (performance.now() - AT.t0) / 1000;
  const errs = AT.errors.length;
  const grade = errs === 0 ? 'Montage sans faute' : errs <= 2 ? 'Montage correct, quelques reprises' : 'Montage à retravailler';
  AT.report = { sec, errs, grade, errors: AT.errors.slice() };
  emit('atelier', { type: 'done', report: AT.report });
  const body = el('div', { class: 'at-report' },
    el('p', { class: 'lede' }, `${grade}. Temps : ${Math.floor(sec / 60)} min ${String(Math.round(sec % 60)).padStart(2, '0')} s · erreurs : ${errs}.`),
    errs ? el('div', {}, el('h3', {}, 'Ce qui a été repris'), el('ul', { class: 'steps' }, ...AT.errors.map((x) => el('li', {}, el('b', {}, x.label + ' : '), x.msg)))) : el('p', {}, 'Ordre de montage respecté, tête verrouillée avant chaque charge, fibre propre aux deux extrémités.'),
    el('h3', {}, 'À retenir'),
    el('ul', { class: 'steps' },
      el('li', {}, 'Le support d\'abord : pied stable, araignée verrouillée, tête de niveau et verrouillée avant toute charge.'),
      el('li', {}, 'L\'objectif box (≈ 24 kg) se lève à deux, sur une tête verrouillée, adaptateur déjà bloqué.'),
      el('li', {}, 'On équilibre une fois tout monté (objectif, viseur) : plaque, puis contrepoids et frictions.'),
      el('li', {}, 'Chaque connecteur fibre se nettoie et s\'inspecte avant d\'être branché ; le câble est attaché pour ne jamais tirer sur la caméra.'),
      el('li', {}, 'La mise en service se fait avec la vision : alimentation par la CCU, image, tally, CALL.')),
    el('div', { class: 'hwrow' }, el('button', { class: 'btn primary', onclick: () => { modal.close(); endAtelier(false); } }, 'Laisser la caméra en place et reprendre l\'antenne'), el('button', { class: 'btn', onclick: () => { modal.close(); endAtelier(true); beginAtelier(ctx); } }, 'Recommencer le montage')));
  modal.open('Rapport de montage · CAM 1', body, { width: 720 });
}
// keepCam : la caméra montée prend sa place (modèle du simulateur, cadreur automatique)
export function endAtelier(discard, userQuit = false) {
  if (!AT.active) return;
  const keep = !discard && AT.cam;
  if (AT.vfMat) { const i = W.screens.indexOf(AT.vfMat); if (i >= 0) W.screens.splice(i, 1); AT.vfMat = null; }
  if (AT.root) { W.scene.remove(AT.root); AT.root.traverse((o) => { if (o.geometry && !o.isSprite) o.geometry.dispose(); if (o.material && o.material.map) o.material.map.dispose(); }); AT.root = null; }
  $('#atelier')?.remove(); const r = $('#at-ring'); if (r) r.hidden = true; const g = $('#at-gauge'); if (g) g.hidden = true;
  if (keep) { AT.cam.hideModel = false; if (AT.cam.model) AT.cam.model.root.visible = true; AT.cam.manual = false; }
  else {
    if (AT.cam) removeCamera(AT.cam.id);
    if (!camById(1) && AT.saved && (userQuit || !discard)) { const c = addCamera({ ...AT.saved }); if (c) lineUpCamera(c); }
  }
  AT.active = false; AT.held = null; AT.cam = null;
  const p = $('#prompt'); if (p) p.hidden = true;
  emit('atelier', { type: 'end' });
  if (userQuit) toast('Atelier quitté : la CAM 1 est remise en place telle que prévue au plan.');
}
// collisions sur la passerelle pendant l'atelier
export function atelierBlocks(x, z) {
  if (x < -7.6 || x > 0.4 || z < -70.15 || z > -67.45) return true;
  if (Math.hypot(x + 1.5, z + 67.9) < 0.6 && AT.done.has('tripod')) return true; // le pied monté
  if (z < -69.6 && x < -0.6) return true; // les flight cases
  return false;
}
export const ATELIER_DECK = { x0: -8, x1: 1, z0: -70.4, z1: -67.2, y: DECK_Y };
// pour les tests et le débogage : réaliser une opération sans viser
export const atelierDebug = { OPS, PARTS, grab, install, act: (id) => act(OPI[id]), finishAct: (id) => finishAct(OPI[id]), fast: (k) => { AT.fast = k; }, setLevel: (v) => { AT.level = v; }, setBalance: (v) => { AT.balance = v; } };

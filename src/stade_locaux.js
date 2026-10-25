// @ts-check
import * as THREE from 'three';
import { Builder } from './geo.js';
import { matiere } from './matiere.js';
import { makeCanvas, mulberry32 } from './util.js';
import { fillFit, fillLines } from './textfit.js';
import { TEAMS } from './data/match.js';

// ----------------------------------------------------------------------------------
// Les locaux sous la tribune principale (Lepagnot) : l'embouchure du tunnel, le couloir des
// joueurs, les deux vestiaires et le local technique TV (pré-câblage). Avant la v19.9, c'étaient
// des boîtes posées les unes à côté des autres : des angles ouverts sur le vide de la tribune, des
// plafonds noirs, les gradins qui traversaient les pièces. Ici chaque pièce est close : les murs
// se recouvrent aux angles (chaque mur dépasse d'une demi-épaisseur), un plafond ferme chaque
// volume, les portes ont un encadrement, un linteau et un battant ouvert.
//
// Les matières sont éclairées « de l'intérieur » (selfLit : une part de la couleur en émission,
// comme sous des plafonniers) ; aucune lumière ponctuelle, qui coûterait à tout le stade.
// Repère : x le long de la tribune, z vers l'extérieur (le terrain est en z > −41).
// ----------------------------------------------------------------------------------

const H = 3.2; // hauteur sous plafond du couloir et des pièces
const HM = 4.4; // hauteur de l'embouchure (sous l'auvent de la tribune, à 4,6 m)
const T = 0.24; // épaisseur des murs

/** pièces praticables : à garder cohérent avec WALK_ZONES et blockedOutside (world.js) */
export const LOCAUX = {
  embouchure: { x0: -5, x1: 5, z0: -47.5, z1: -40.6 },
  couloir: { x0: -3, x1: 3, z0: -93, z1: -47.5 },
  vestiaireDom: { x0: 3, x1: 16, z0: -84, z1: -72, porte: [-79.5, -77.5] },
  vestiaireExt: { x0: -16, x1: -3, z0: -80, z1: -66, porte: [-73.5, -71.5] },
  localTV: { x0: -16, x1: -3, z0: -91, z1: -82, porte: [-87.5, -85.5] },
};

/** une plaque de signalétique (texte ajusté) */
function plaque(lines, w, h, bg, fg) {
  const c = makeCanvas(512, Math.max(64, Math.round(512 * h / w))); const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(0, 0, c.width, 4);
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  fillLines(g, lines, c.width / 2, c.height / 2 + 2, c.width - 40, c.height - 18, c.height * 0.5);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), matiere('plastique', { map: t, vertexColors: false, roughness: 0.5, strength: 0.2, selfLit: 0.35, name: 'locaux-plaque' }));
}

/** tableau tactique (feutre sur tableau blanc) */
function tableauTactique() {
  const c = makeCanvas(512, 320); const g = c.getContext('2d');
  g.fillStyle = '#f4f5f2'; g.fillRect(0, 0, 512, 320);
  g.strokeStyle = '#2e7d4f'; g.lineWidth = 4; g.strokeRect(30, 30, 452, 260); g.beginPath(); g.moveTo(256, 30); g.lineTo(256, 290); g.stroke();
  g.beginPath(); g.arc(256, 160, 40, 0, Math.PI * 2); g.stroke(); g.strokeRect(30, 100, 60, 120); g.strokeRect(422, 100, 60, 120);
  const r = mulberry32(5);
  for (let i = 0; i < 10; i++) { g.fillStyle = '#c8102e'; g.beginPath(); g.arc(60 + r() * 180, 50 + r() * 220, 9, 0, 7); g.fill(); }
  g.strokeStyle = '#1d3a8a'; g.lineWidth = 3; for (let i = 0; i < 4; i++) { g.beginPath(); const x = 120 + r() * 100, y = 60 + r() * 200; g.moveTo(x, y); g.quadraticCurveTo(x + 60, y - 40, x + 120, y + 10); g.stroke(); }
  g.fillStyle = '#1b1f24'; g.textAlign = 'left'; g.textBaseline = 'top'; fillFit(g, 'PRESSING HAUT · BLOC 4-4-2', 34, 296, 440, 18);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

/** façade d'une baie du local TV : appareils et voyants */
function baieTex(seed) {
  const c = makeCanvas(128, 512); const g = c.getContext('2d'); const r = mulberry32(seed);
  g.fillStyle = '#0d0f12'; g.fillRect(0, 0, 128, 512);
  let y = 14;
  while (y < 480) {
    const h = [12, 24, 36, 48][Math.floor(r() * 4)];
    g.fillStyle = r() < 0.3 ? '#1a1d21' : '#2a2f35'; g.fillRect(8, y, 112, h - 2);
    for (let k = 0; k < 4; k++) { g.fillStyle = r() < 0.8 ? '#30ff60' : '#ffb020'; g.fillRect(90 + k * 6, y + 4, 3, 3); }
    if (h > 20) { g.fillStyle = '#0d2338'; g.fillRect(14, y + 4, 40, Math.min(14, h - 10)); }
    y += h;
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

/**
 * Construit les locaux dans la scène du stade.
 * @param {THREE.Scene} scene
 */
export function buildLocaux(scene) {
  const occ = [];
  const mk = () => new Builder({ ao: 0.35, occluders: occ, aoOpts: { dist: 1.1, strength: 1.0, floor: 0.3 } });
  const Bw = mk(); // murs peints (béton)
  const Bt = mk(); // carrelage (vestiaires)
  const Bf = mk(); // sols en résine
  const Bc = mk(); // plafonds
  const Bm = mk(); // métal : encadrements, casiers, pieds, baies
  const Bb = mk(); // bois : bancs, portes
  const Bp = mk(); // plastique : sièges, plots, accessoires
  const glow = new Builder(); // plafonniers (émissifs)

  // ---------- murs : un mur dépasse d'une demi-épaisseur à chaque bout, les angles se recouvrent ----------
  /** mur le long de z (à x constant), de z0 à z1, avec des portes [za, zb] ; bande basse colorée */
  const wallX = (B, x, z0, z1, h, cHaut, cBas, portes = [], dado = 1.1) => {
    const a = Math.min(z0, z1) - T / 2, b = Math.max(z0, z1) + T / 2;
    const cuts = [a, ...portes.flat(), b];
    for (let i = 0; i < cuts.length; i += 2) {
      const za = cuts[i], zb = cuts[i + 1]; if (zb - za < 0.01) continue;
      B.box(T, dado, zb - za, x, dado / 2, (za + zb) / 2, cBas);
      B.box(T, h - dado, zb - za, x, dado + (h - dado) / 2, (za + zb) / 2, cHaut);
    }
    for (const [za, zb] of portes) { B.box(T, h - 2.15, zb - za, x, 2.15 + (h - 2.15) / 2, (za + zb) / 2, cHaut); porte(x, za, zb, x > 0 ? 1 : -1); }
  };
  /** mur le long de x (à z constant) */
  const wallZ = (B, z, x0, x1, h, cHaut, cBas, portes = [], dado = 1.1) => {
    const a = Math.min(x0, x1) - T / 2, b = Math.max(x0, x1) + T / 2;
    const cuts = [a, ...portes.flat(), b];
    for (let i = 0; i < cuts.length; i += 2) {
      const xa = cuts[i], xb = cuts[i + 1]; if (xb - xa < 0.01) continue;
      B.box(xb - xa, dado, T, (xa + xb) / 2, dado / 2, z, cBas);
      B.box(xb - xa, h - dado, T, (xa + xb) / 2, dado + (h - dado) / 2, z, cHaut);
    }
  };
  /** encadrement de porte (métal) et battant ouvert à 90° vers la pièce (côté `side` du mur) */
  const porte = (x, za, zb, side) => {
    const w = zb - za, zc = (za + zb) / 2, lw = w - 0.08;
    for (const z of [za, zb]) Bm.cbox(T + 0.06, 2.18, 0.06, x, 1.09, z, 0x8a9096, 0.01);
    Bm.cbox(T + 0.06, 0.06, w + 0.06, x, 2.18, zc, 0x8a9096, 0.01);
    const lx = x + side * (T / 2 + lw / 2);
    Bb.cbox(lw, 2.08, 0.045, lx, 1.06, za + 0.06, 0x6b4a2b, 0.01);
    Bm.cyl(0.012, 0.012, 0.13, lx + side * (lw / 2 - 0.08), 1.05, za + 0.12, 0xd0d4d8, 8, Math.PI / 2);
    Bp.box(0.3, 0.3, 0.005, lx, 1.55, za + 0.085, 0xf2f2f2); // pictogramme sur le battant
  };

  const peint = 0xd6d9dc, dadoC = 0x23344f, ligne = 0xc8102e;
  // ---------- l'embouchure du tunnel (sous l'auvent) ----------
  const E = LOCAUX.embouchure;
  wallX(Bw, E.x0 - T / 2, E.z0, E.z1, HM, 0xb9bec4, dadoC, [], 1.6);
  wallX(Bw, E.x1 + T / 2, E.z0, E.z1, HM, 0xb9bec4, dadoC, [], 1.6);
  // ressauts entre l'embouchure (10 m) et le couloir (6 m) : fermés jusqu'au plafond
  wallZ(Bw, E.z0 - T / 2, E.x0 - T, -3 - T, HM, 0xb9bec4, dadoC, [], 1.6);
  wallZ(Bw, E.z0 - T / 2, 3 + T, E.x1 + T, HM, 0xb9bec4, dadoC, [], 1.6);
  // linteau entre le plafond haut de l'embouchure et celui du couloir
  Bw.box(6 + 2 * T, HM - H - 0.02, T, 0, H + 0.02 + (HM - H - 0.02) / 2, E.z0 - T / 2, 0xb9bec4);
  Bc.box(E.x1 - E.x0 + 2 * T, 0.2, E.z1 - E.z0 + T, 0, HM + 0.1, (E.z0 + E.z1) / 2, 0x9aa0a6);
  Bf.box(E.x1 - E.x0, 0.02, E.z1 - E.z0, 0, 0.01, (E.z0 + E.z1) / 2, 0x2a6f3a); // gazon synthétique de l'embouchure
  // liserés sang et or à la sortie, et l'enseigne « ACCÈS TERRAIN »
  for (const s of [-1, 1]) { Bp.box(0.02, HM - 0.2, 0.12, s * (E.x1 - 0.01), HM / 2, E.z1 - 0.1, s < 0 ? ligne : 0xf5c400); }

  // ---------- le couloir ----------
  const C = LOCAUX.couloir, VD = LOCAUX.vestiaireDom, VE = LOCAUX.vestiaireExt, TV = LOCAUX.localTV;
  wallX(Bw, C.x1 + T / 2, C.z0, C.z1, H, peint, dadoC, [VD.porte]);
  wallX(Bw, C.x0 - T / 2, C.z0, C.z1, H, peint, dadoC, [VE.porte, TV.porte].sort((p, q) => p[0] - q[0]));
  Bc.box(6 + 2 * T, 0.2, C.z1 - C.z0, 0, H + 0.1, (C.z0 + C.z1) / 2, 0xe4e6e8);
  Bf.box(6, 0.02, C.z1 - C.z0, 0, 0.01, (C.z0 + C.z1) / 2, 0x3a4250);
  // bandes de guidage jaunes le long des murs, liseré rouge sur le soubassement
  for (const s of [-1, 1]) {
    Bp.box(0.08, 0.004, C.z1 - C.z0 - 0.2, s * 2.7, 0.022, (C.z0 + C.z1) / 2, 0xe8b400);
    Bp.box(0.012, 0.05, C.z1 - C.z0, s * (3 - 0.005), 1.12, (C.z0 + C.z1) / 2, ligne);
    // main courante en inox
    Bm.cyl(0.022, 0.022, C.z1 - C.z0 - 1, s * 2.93, 0.95, (C.z0 + C.z1) / 2, 0xc0c6cc, 10, Math.PI / 2);
  }
  // linteau au-dessus de la porte extérieure (porte de 4,2 m dans la façade, couloir de 3,2 m)
  Bw.box(6.6, 1.1, T, 0, H + 0.55, C.z0 + T / 2, peint);
  for (let z = C.z1 - 2; z > C.z0 + 1; z -= 3.2) glow.box(1.2, 0.03, 0.3, 0, H - 0.01, z, 0xffffff);

  // ---------- le vestiaire du club recevant, celui des visiteurs ----------
  const vestiaire = (V, team, side) => {
    const xIn = side > 0 ? V.x0 : V.x1, xOut = side > 0 ? V.x1 : V.x0;
    // murs : le fond, les deux côtés (le côté couloir est le mur du couloir)
    wallX(Bt, xOut + side * T / 2, V.z0, V.z1, H, 0xeef0f1, 0xeef0f1, [], 1.4);
    const wa = side > 0 ? V.x0 + T : V.x0, wb = side > 0 ? V.x1 : V.x1 - T; // côté couloir : s'arrête dans le mur du couloir
    wallZ(Bt, V.z0 - T / 2, wa, wb, H, 0xeef0f1, 0xeef0f1, [], 1.4);
    wallZ(Bt, V.z1 + T / 2, wa, wb, H, 0xeef0f1, 0xeef0f1, [], 1.4);
    Bc.box(V.x1 - V.x0 + 2 * T, 0.2, V.z1 - V.z0 + 2 * T, (V.x0 + V.x1) / 2, H + 0.1, (V.z0 + V.z1) / 2, 0xe4e6e8);
    Bt.box(V.x1 - V.x0, 0.02, V.z1 - V.z0, (V.x0 + V.x1) / 2, 0.01, (V.z0 + V.z1) / 2, 0x8f979e);
    const TM = TEAMS[team];
    // bandeau aux couleurs du club sur les trois murs
    Bp.box(0.02, 0.18, V.z1 - V.z0 - 0.1, xOut - side * 0.01, 2.45, (V.z0 + V.z1) / 2, TM.shirt);
    // casiers ouverts le long du mur du fond et d'un côté, avec le maillot du joueur, et le banc devant
    const lockers = [];
    const nFond = Math.floor((V.z1 - V.z0 - 1) / 0.75);
    for (let i = 0; i < nFond; i++) lockers.push([xOut - side * 0.32, V.z0 + 0.6 + i * 0.75, side > 0 ? -Math.PI / 2 : Math.PI / 2]);
    const nCote = Math.floor((V.x1 - V.x0 - 3) / 0.75);
    for (let i = 0; i < nCote; i++) lockers.push([xIn + side * (2.5 + i * 0.75), V.z0 + 0.32, 0]);
    lockers.forEach(([x, z, ry], i) => {
      const along = ry === 0 ? [1, 0] : [0, 1];
      // caisson (montants + tablette + fond)
      Bm.cbox(ry === 0 ? 0.72 : 0.5, 0.04, ry === 0 ? 0.5 : 0.72, x, 2.05, z, 0x3a3f46, 0.01);
      Bm.cbox(ry === 0 ? 0.72 : 0.5, 0.04, ry === 0 ? 0.5 : 0.72, x, 0.42, z, 0x3a3f46, 0.01);
      for (const s of [-1, 1]) Bm.box(ry === 0 ? 0.03 : 0.5, 1.65, ry === 0 ? 0.5 : 0.03, x + along[0] * s * 0.36, 1.23, z + along[1] * s * 0.36, 0x3a3f46);
      // maillot suspendu (torse aplati) et sac au sol
      const sx = ry === 0 ? 0 : side * 0.18, sz = ry === 0 ? -0.18 : 0; // vers le mur
      Bp.cbox(ry === 0 ? 0.46 : 0.04, 0.62, ry === 0 ? 0.04 : 0.46, x + sx, 1.55, z + sz, TM.shirt, 0.015);
      Bp.cbox(ry === 0 ? 0.5 : 0.08, 0.14, ry === 0 ? 0.08 : 0.5, x + sx, 1.86, z + sz, TM.sleeves ?? TM.shirt, 0.015);
      if (i % 3 !== 1) Bp.cbox(0.42, 0.26, 0.28, x - sx * 0.5, 0.13, z - sz * 0.5, 0x15181c, 0.04);
      // banc devant les casiers
      const bx = x + (ry === 0 ? 0 : -side * 0.55), bz = z + (ry === 0 ? 0.55 : 0);
      Bb.cbox(ry === 0 ? 0.74 : 0.36, 0.05, ry === 0 ? 0.36 : 0.74, bx, 0.46, bz, 0xa57a4e, 0.01);
      Bm.box(0.04, 0.44, 0.04, bx, 0.22, bz, 0x8a9096);
    });
    // table de massage, sacs de ballons, plots, tableau tactique
    const tx = (V.x0 + V.x1) / 2 + side * 1.5, tz = (V.z0 + V.z1) / 2 + 1.5;
    Bp.cbox(1.9, 0.12, 0.7, tx, 0.78, tz, 0x1b2230, 0.03); for (const dx of [-0.8, 0.8]) for (const dz of [-0.28, 0.28]) Bm.box(0.04, 0.72, 0.04, tx + dx, 0.36, tz + dz, 0x9aa0a6);
    Bp.cbox(0.5, 0.5, 0.5, tx - side * 2.2, 0.25, tz - 1.6, 0x15181c, 0.12);
    for (let k = 0; k < 4; k++) Bp.cyl(0.02, 0.09, 0.22, tx - side * 3 + k * 0.05, 0.11 + k * 0.03, tz + 1.5, 0xff7a1a, 10);
    const tb = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.0), matiere('plastique', { map: tableauTactique(), vertexColors: false, roughness: 0.25, strength: 0.15, selfLit: 0.3, name: 'locaux-tableau' }));
    tb.position.set((V.x0 + V.x1) / 2, 1.7, V.z1 - 0.01); tb.rotation.y = Math.PI; scene.add(tb);
    Bm.cbox(1.66, 1.06, 0.03, (V.x0 + V.x1) / 2, 1.7, V.z1 - 0.005 + 0.018, 0xc0c6cc, 0.01);
    for (let k = 0; k < 3; k++) glow.box(1.2, 0.03, 0.3, (V.x0 + V.x1) / 2 + (k - 1) * 3.6, H - 0.01, (V.z0 + V.z1) / 2, 0xffffff);
    // plaque au-dessus de la porte, côté couloir
    const pl = plaque(['VESTIAIRE', TM.name.toUpperCase()], 1.7, 0.42, TM.color || '#1b2230', '#ffffff');
    pl.position.set(xIn - side * 0.015, 2.55, (V.porte[0] + V.porte[1]) / 2); pl.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2; scene.add(pl);
  };
  vestiaire(VD, 0, 1);
  vestiaire(VE, 1, -1);

  // ---------- le local technique TV : pré-câblage du stade ----------
  {
    wallX(Bw, TV.x0 - T / 2, TV.z0, TV.z1, H, 0xc9cdd1, 0x3a3f46);
    wallZ(Bw, TV.z0 - T / 2, TV.x0, TV.x1 - T, H, 0xc9cdd1, 0x3a3f46);
    wallZ(Bw, TV.z1 + T / 2, TV.x0, TV.x1 - T, H, 0xc9cdd1, 0x3a3f46);
    Bc.box(TV.x1 - TV.x0 + 2 * T, 0.2, TV.z1 - TV.z0 + 2 * T, (TV.x0 + TV.x1) / 2, H + 0.1, (TV.z0 + TV.z1) / 2, 0xe4e6e8);
    Bf.box(TV.x1 - TV.x0, 0.02, TV.z1 - TV.z0, (TV.x0 + TV.x1) / 2, 0.01, (TV.z0 + TV.z1) / 2, 0x6a7078);
    // cinq baies 42 U au fond, façades dessinées
    for (let i = 0; i < 5; i++) {
      const x = -14.5 + i * 1.1, z = TV.z0 + 0.55;
      Bm.cbox(0.6, 2.1, 0.9, x, 1.05, z, 0x1a1d21, 0.015);
      const f = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 1.95), new THREE.MeshBasicMaterial({ map: baieTex(i + 3), toneMapped: true }));
      f.position.set(x, 1.05, z + 0.456); scene.add(f);
    }
    // panneau de pré-câblage : connecteurs SMPTE (orange), BNC, fibre ; repères des positions caméras
    const px = TV.x0 + 0.13, pz = (TV.z0 + TV.z1) / 2 + 1.2;
    Bm.cbox(0.06, 1.2, 3.0, px, 1.5, pz, 0x2b3036, 0.01);
    for (let r = 0; r < 3; r++) for (let k = 0; k < 12; k++) Bp.cyl(0.035, 0.035, 0.06, px + 0.06, 1.85 - r * 0.32, pz - 1.32 + k * 0.24, r === 0 ? 0xff8a1f : r === 1 ? 0xd8d8d8 : 0x2f7ff0, 10, 0, Math.PI / 2);
    const pp = plaque(['PRÉ-CÂBLAGE STADE', 'POSITIONS CAMÉRAS 1 → 12'], 1.8, 0.32, '#ffd23f', '#15100a');
    pp.position.set(px + 0.035, 2.3, pz); pp.rotation.y = Math.PI / 2; scene.add(pp);
    // bureau, écran, tourets
    Bb.cbox(1.6, 0.04, 0.7, (TV.x0 + TV.x1) / 2 + 2, 0.76, TV.z1 - 0.5, 0x5a6068, 0.01);
    for (const dx of [-0.75, 0.75]) Bm.box(0.04, 0.74, 0.6, (TV.x0 + TV.x1) / 2 + 2 + dx, 0.37, TV.z1 - 0.5, 0x8a9096);
    Bp.cbox(0.6, 0.36, 0.04, (TV.x0 + TV.x1) / 2 + 2, 1.0, TV.z1 - 0.7, 0x111214, 0.01);
    for (const [x, z] of [[-6, -89.8], [-6.8, -89.8]]) { Bp.cyl(0.34, 0.34, 0.06, x, 0.34, z, 0x2f6f45, 16, Math.PI / 2); Bp.cyl(0.22, 0.22, 0.3, x, 0.34, z, 0x15181c, 14, Math.PI / 2); }
    for (let k = 0; k < 2; k++) glow.box(1.2, 0.03, 0.3, -12.5 + k * 6, H - 0.01, (TV.z0 + TV.z1) / 2, 0xffffff);
    const pl = plaque(['LOCAL TECHNIQUE TV', 'PRÉ-CÂBLAGE'], 1.7, 0.42, '#ffd23f', '#15100a');
    pl.position.set(TV.x1 + 0.015, 2.55, (TV.porte[0] + TV.porte[1]) / 2); pl.rotation.y = Math.PI / 2; scene.add(pl);
  }
  // plaque « ACCÈS TERRAIN » au bout du couloir, côté vestiaires
  { const pl = plaque(['ACCÈS TERRAIN ▸'], 1.8, 0.34, '#13294b', '#ffffff'); pl.position.set(0, 2.75, C.z1 - 0.15 - T); pl.rotation.y = Math.PI; scene.add(pl); }
  { const pl = plaque(['◂ SORTIE · COMPOUND TV'], 1.8, 0.34, '#1d6b3a', '#ffffff'); pl.position.set(0, 2.75, -88); scene.add(pl); }
  // extincteurs
  for (const [x, z] of [[2.82, -60], [-2.82, -82]]) { Bp.cyl(0.075, 0.075, 0.46, x, 0.55, z, 0xc8201c, 14); Bp.cyl(0.03, 0.045, 0.07, x, 0.81, z, 0x1a1c1e, 10); }

  const parts = [
    [Bw, matiere('beton', { seed: 61, scale: 1.4, strength: 0.3, roughness: 0.75, selfLit: 0.32, name: 'locaux-murs' })],
    [Bt, matiere('carrelage', { seed: 62, scale: 0.6, strength: 0.8, selfLit: 0.3, name: 'locaux-carrelage' })],
    [Bf, matiere('resine', { seed: 63, scale: 1.2, roughness: 0.35, selfLit: 0.22, name: 'locaux-sol' })],
    [Bc, matiere('carrelage', { seed: 64, scale: 1.8, strength: 0.5, roughness: 0.85, selfLit: 0.4, name: 'locaux-plafond' })],
    [Bm, matiere('laque', { seed: 65, scale: 0.4, roughness: 0.45, metalness: 0.5, selfLit: 0.25, name: 'locaux-metal' })],
    [Bb, matiere('stratifie', { seed: 66, scale: 0.6, roughness: 0.6, selfLit: 0.25, name: 'locaux-bois' })],
    [Bp, matiere('plastique', { seed: 67, scale: 0.25, roughness: 0.55, selfLit: 0.25, name: 'locaux-plastique' })],
  ];
  // les plafonds sont vus d'en dessous : la face basse de chaque dalle est la seule utile
  for (const [b, m] of parts) { if (!b.parts.length) continue; const mesh = b.mesh(m); mesh.name = m.name; mesh.receiveShadow = true; scene.add(mesh); }
  const g = new THREE.Mesh(glow.build(), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.25, 2.35) }));
  g.name = 'locaux-plafonniers'; scene.add(g);
}

// @ts-check
import * as THREE from 'three';
import { makeCanvas, mulberry32 } from './util.js';
import { Builder, roundedBox } from './geo.js';
import { matiere } from './matiere.js';

// ----------------------------------------------------------------------------------
// Véhicules du compound : semi-remorque régie (extensions déployées, livrée, roues, béquilles),
// tracteur, camion satellite, groupe électrogène, bungalows ; enrobé du compound.
// ----------------------------------------------------------------------------------
const tex = (c, rep = false) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };

// livrée d'un flanc (1 px = 1 cm) : tôle laquée, joints de panneaux rivetés, bandeau sombre, filet orange, grilles
function liveryTexture(L, H, opts = {}) {
  const W = Math.round(L * 100 / 2), Hp = Math.round(H * 100 / 2); // 2 cm / px
  const c = makeCanvas(W, Hp), g = c.getContext('2d'), r = mulberry32(opts.seed || 5);
  const gr = g.createLinearGradient(0, 0, 0, Hp); gr.addColorStop(0, '#f7f8f9'); gr.addColorStop(0.7, '#e9ecef'); gr.addColorStop(1, '#d9dde1');
  g.fillStyle = gr; g.fillRect(0, 0, W, Hp);
  // bandeau bas sombre et filet orange
  const yb = Hp * 0.78; g.fillStyle = '#1c2733'; g.fillRect(0, yb, W, Hp - yb);
  g.fillStyle = '#ff8a1f'; g.fillRect(0, yb - 7, W, 5);
  // vague graphique (bandeau supérieur)
  g.fillStyle = 'rgba(28,39,51,0.92)'; g.beginPath(); g.moveTo(0, 0); g.lineTo(W, 0); g.lineTo(W, Hp * 0.08); g.bezierCurveTo(W * 0.7, Hp * 0.1, W * 0.45, Hp * 0.02, 0, Hp * 0.12); g.closePath(); g.fill();
  // joints de panneaux (tous les 1,2 m) et rivets
  for (let x = 60; x < W; x += 60) {
    g.fillStyle = 'rgba(90,98,108,0.55)'; g.fillRect(x, 0, 1.5, Hp);
    for (let y = 8; y < Hp; y += 14) { g.fillStyle = 'rgba(70,76,84,0.55)'; g.beginPath(); g.arc(x - 3, y, 1.2, 0, 7); g.fill(); g.beginPath(); g.arc(x + 4, y, 1.2, 0, 7); g.fill(); }
  }
  // grilles de ventilation (climatisation des baies)
  for (const fx of opts.vents || []) {
    const x = fx * W, y = Hp * 0.45; g.fillStyle = '#2a2f35'; g.fillRect(x, y, 70, 46);
    g.fillStyle = '#5c646d'; for (let k = 0; k < 9; k++) g.fillRect(x + 3, y + 3 + k * 4.8, 64, 2);
  }
  // salissures en bas de caisse
  for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(80,70,55,${0.03 + r() * 0.05})`; g.fillRect(r() * W, yb - 30 + r() * 20, 10 + r() * 60, 6 + r() * 20); }
  // étiquettes
  g.fillStyle = '#ffd23f'; g.font = '700 14px "Barlow Condensed", "Arial Narrow", sans-serif';
  for (const [fx, t] of opts.labels || []) {
    const x = Math.min(fx * W, W - 12 - g.measureText(t).width); // l'étiquette reste sur le flanc
    g.fillStyle = '#ffd23f'; g.fillRect(x - 4, Hp * 0.66, g.measureText(t).width + 8, 18); g.fillStyle = '#15100a'; g.fillText(t, x, Hp * 0.66 + 14, W - x - 8);
  }
  return tex(c);
}
// plan texturé collé sur une face (léger décalage + polygonOffset pour éviter le scintillement)
function decal(group, t, w, h, x, y, z, rotY, rough = 0.32, metal = 0.15, flat = false) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), matiere(flat ? 'tole' : 'nervure', { map: t, vertexColors: false, roughness: rough, metalness: metal, polygonOffset: 2, scale: flat ? 0.7 : 1.0, strength: flat ? 0.4 : 0.5, name: 'car-livree' }));
  m.position.set(x, y, z); m.rotation.y = rotY; m.castShadow = false; m.receiveShadow = true; group.add(m); return m;
}

// roue : pneu (tore aplati) + jante alu + moyeu ; géométries et matériaux partagés par toutes les roues
const WHEEL = { geo: null, mat: null };
function wheel(group, x, y, z, rad = 0.5, w = 0.32, twin = false) {
  if (!WHEEL.geo) {
    const tyre = new THREE.TorusGeometry(0.39, 0.13, 10, 28); tyre.scale(1, 1, 1.25);
    const rim = new THREE.CylinderGeometry(0.29, 0.29, 0.26, 24); rim.rotateX(Math.PI / 2);
    const hub = new THREE.CylinderGeometry(0.1, 0.12, 0.3, 10); hub.rotateX(Math.PI / 2);
    WHEEL.geo = { tyre, rim, hub };
    WHEEL.mat = { tyre: new THREE.MeshStandardMaterial({ color: 0x16171a, roughness: 0.88 }), rim: new THREE.MeshStandardMaterial({ color: 0xc8ccd0, roughness: 0.28, metalness: 0.85 }), hub: new THREE.MeshStandardMaterial({ color: 0x55595e, roughness: 0.4, metalness: 0.7 }) };
  }
  for (const dz of twin ? [-0.17, 0.17] : [0]) {
    const s = rad / 0.5;
    const t = new THREE.Mesh(WHEEL.geo.tyre, WHEEL.mat.tyre); t.position.set(x, y, z + dz); t.scale.setScalar(s); t.castShadow = true; group.add(t);
    const r = new THREE.Mesh(WHEEL.geo.rim, WHEEL.mat.rim); r.position.set(x, y, z + dz); r.scale.set(s, s, 1); group.add(r);
  }
  const h = new THREE.Mesh(WHEEL.geo.hub, WHEEL.mat.hub); h.position.set(x, y, z + (z > 0 ? 0.08 : -0.08) * (twin ? 2.5 : 1)); group.add(h);
}

export function tarmacTexture() {
  const N = 512, c = makeCanvas(N, N), g = c.getContext('2d'), r = mulberry32(77);
  g.fillStyle = '#34373a'; g.fillRect(0, 0, N, N);
  for (let i = 0; i < 26000; i++) { const v = 30 + Math.floor(r() * 60); g.fillStyle = `rgba(${v},${v},${v + 2},0.6)`; g.fillRect(r() * N, r() * N, 1 + r() * 1.6, 1 + r() * 1.6); }
  for (let i = 0; i < 9; i++) { const x = r() * N, y = r() * N, w = 40 + r() * 120, h = 30 + r() * 90; g.fillStyle = `rgba(${r() < 0.5 ? '20,21,23' : '70,72,74'},0.35)`; g.fillRect(x, y, w, h); }
  for (let i = 0; i < 14; i++) { const x = r() * N, y = r() * N, rad = 6 + r() * 26; const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, 'rgba(10,10,12,0.5)'); gr.addColorStop(1, 'rgba(10,10,12,0)'); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
  g.strokeStyle = 'rgba(15,15,16,0.7)'; g.lineWidth = 1.2; for (let i = 0; i < 6; i++) { g.beginPath(); let x = r() * N, y = r() * N; g.moveTo(x, y); for (let k = 0; k < 8; k++) { x += (r() - 0.5) * 40; y += (r() - 0.5) * 40; g.lineTo(x, y); } g.stroke(); }
  const t = tex(c, true); return t;
}

// ------------------------------- car régie -------------------------------
export function buildOBTruck(T) {
  const grp = new THREE.Group();
  const occ = [];
  const mk = () => new Builder({ ao: 0.4, occluders: occ, aoOpts: { dist: 1.4, strength: 1.0, floor: 0.3 } });
  const B = mk(); // tôle peinte (caisse, extensions, béquilles)
  const Bs = mk(); // acier thermolaqué (châssis, jupes, pare-chocs)
  const Bm = mk(); // aluminium (profilés, échelle, garde-corps, marches)
  const Bp = mk(); // plastique et caoutchouc (feux, catadioptres, bavettes, rétroviseurs)
  const body = 0xeef1f4;
  const yF = T.floor;
  // caisse principale (largeur route 2,55 m), toit légèrement plus clair, arêtes arrondies
  B.cbox(T.len, 3.0, 2.55, T.cx, yF + 1.55, T.cz, body, 0.07, 0, 0, 0, 6);
  B.cbox(T.len - 0.1, 0.06, 2.45, T.cx, yF + 3.08, T.cz, 0xf6f7f8, 0.02);
  // arêtes (profilés alu) qui donnent de la tenue à la caisse
  for (const s of [-1, 1]) for (const y of [yF + 0.05, yF + 3.05]) Bm.cbox(T.len + 0.02, 0.06, 0.06, T.cx, y, T.cz + s * 1.27, 0xb8bec4, 0.012);
  for (const x of [T.x0, T.x1]) for (const s of [-1, 1]) Bm.cbox(0.06, 3.0, 0.06, x, yF + 1.55, T.cz + s * 1.27, 0xb8bec4, 0.012);
  // extensions latérales déployées (caissons coulissants), corniche et joint d'étanchéité
  const ew = (T.wid - 2.55) / 2;
  for (const s of [-1, 1]) {
    const zc = T.cz + s * (1.275 + ew / 2);
    B.cbox(13.5, 2.55, ew, T.cx + 0.5, yF + 1.38, zc, 0xe6e9ec, 0.05, 0, 0, 0, 6);
    Bm.cbox(13.56, 0.08, ew + 0.04, T.cx + 0.5, yF + 2.68, zc, 0xb8bec4, 0.015); // corniche
    Bm.cbox(13.56, 0.06, ew + 0.04, T.cx + 0.5, yF + 0.1, zc, 0x9aa0a6, 0.012);
    Bp.box(13.5, 2.5, 0.03, T.cx + 0.5, yF + 1.38, T.cz + s * 1.29, 0x1b1e22); // joint à la jonction caisse / extension
    // feux de gabarit ambre le long de l'extension
    for (let k = 0; k < 5; k++) Bp.cbox(0.1, 0.04, 0.02, T.cx - 5.5 + k * 3, yF + 2.6, T.cz + s * (1.275 + ew + 0.01), 0xffb020, 0.008);
  }
  // jupes et châssis, pare-cycliste, bavettes, passages de roues, feux arrière
  Bs.cbox(T.len - 1, 0.5, 2.3, T.cx, 0.85, T.cz, 0x2a2d30, 0.03);
  for (const s of [-1, 1]) { Bm.cbox(9, 0.08, 0.05, T.cx - 2.2, 0.72, T.cz + s * 1.24, 0xb8bec4, 0.012); Bm.cbox(9, 0.08, 0.05, T.cx - 2.2, 0.94, T.cz + s * 1.24, 0xb8bec4, 0.012); for (let k = 0; k < 6; k++) Bm.box(0.04, 0.3, 0.04, T.cx - 6.2 + k * 1.6, 0.83, T.cz + s * 1.24, 0x9aa0a6); }
  for (const s of [-1, 1]) for (const dx of [5.2, 6.6, 8.0]) { Bs.add(new THREE.CylinderGeometry(0.66, 0.66, 0.5, 14, 1, true, 0, Math.PI), new THREE.Matrix4().compose(new THREE.Vector3(T.cx + dx, 0.5, T.cz + s * 1.05), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI / 2)), new THREE.Vector3(1, 1, 1)), 0x1f2225); }
  for (const s of [-1, 1]) Bp.box(0.02, 0.4, 0.45, T.cx + 8.7, 0.3, T.cz + s * 1.05, 0x111214); // bavettes
  for (const s of [-1, 1]) { Bp.cbox(0.05, 0.14, 0.38, T.x1 + 0.02, 0.95, T.cz + s * 1.0, 0xb3101e, 0.01); Bp.cbox(0.05, 0.1, 0.12, T.x1 + 0.02, 0.95, T.cz + s * 0.75, 0xff8a1f, 0.01); Bp.cbox(0.02, 0.06, 0.12, T.x1 + 0.04, 0.72, T.cz + s * 1.05, 0xd01020, 0.006); }
  Bs.cbox(0.12, 0.14, 2.4, T.x1 - 0.1, 0.62, T.cz, 0x2a2d30, 0.02); // pare-chocs arrière
  // plaque d'immatriculation et feux de plaque
  Bp.cbox(0.02, 0.11, 0.52, T.x1 + 0.03, 0.78, T.cz, 0xf4f4f0, 0.004); Bp.box(0.01, 0.07, 0.42, T.x1 + 0.04, 0.78, T.cz, 0x1a1c20);
  // portes arrière : deux vantaux, charnières, crémones verticales et poignées
  for (const s of [-1, 1]) {
    B.cbox(0.04, 2.6, 1.22, T.x1 + 0.02, yF + 1.45, T.cz + s * 0.63, 0xe9ecef, 0.015);
    for (const dy of [-1.0, -0.3, 0.4, 1.1]) Bm.cyl(0.025, 0.025, 0.12, T.x1 + 0.05, yF + 1.45 + dy, T.cz + s * 1.22, 0x9aa0a6, 8);
    Bm.cyl(0.016, 0.016, 2.4, T.x1 + 0.07, yF + 1.45, T.cz + s * 0.3, 0xa8aeb4, 8);
    Bm.cbox(0.05, 0.03, 0.28, T.x1 + 0.09, yF + 1.0, T.cz + s * 0.3 + (s > 0 ? 0.12 : -0.12), 0xa8aeb4, 0.01);
    for (const dy of [-1.15, 1.15]) Bm.box(0.04, 0.08, 0.1, T.x1 + 0.07, yF + 1.45 + dy, T.cz + s * 0.3, 0x6a7078);
  }
  // béquilles hydrauliques (jaunes) avec patins
  for (const dx of [-7, 3]) for (const s of [-1, 1]) { B.cbox(0.2, 1.05, 0.2, T.cx + dx, 0.6, T.cz + s * 1.3, 0xf2c200, 0.02); Bs.cbox(0.5, 0.06, 0.5, T.cx + dx, 0.03, T.cz + s * 1.3, 0x3a3a3a, 0.01); Bm.cyl(0.05, 0.05, 0.5, T.cx + dx, 0.3, T.cz + s * 1.3, 0xb8bec4, 10); }
  // climatisations de toit, mât (GPS / intercom HF), échelle arrière
  for (const dx of [-5, 4]) { B.cbox(2.0, 0.48, 1.6, T.cx + dx, yF + 3.36, T.cz, 0xcfd3d6, 0.05); for (let k = 0; k < 6; k++) Bm.box(1.7, 0.02, 0.05, T.cx + dx, yF + 3.61, T.cz - 0.6 + k * 0.24, 0x5c646d); Bs.cyl(0.32, 0.32, 0.05, T.cx + dx + 0.5, yF + 3.62, T.cz, 0x2a2f35, 16); }
  Bm.cyl(0.03, 0.03, 1.6, T.cx + 7.5, yF + 3.9, T.cz - 0.8, 0x9aa0a6, 6); Bp.cbox(0.12, 0.12, 0.12, T.cx + 7.5, yF + 4.7, T.cz - 0.8, 0xeeeeee, 0.02);
  for (let k = 0; k < 8; k++) Bm.cyl(0.02, 0.02, 0.42, T.x1 + 0.08, 0.6 + k * 0.33, T.cz - 0.9, 0xb8bec4, 6, Math.PI / 2);
  for (const dz of [-1.1, -0.7]) Bm.cyl(0.02, 0.02, 2.8, T.x1 + 0.08, 1.8, T.cz + dz, 0xb8bec4, 6);
  // porte : encadrement, marches en tôle larmée avec garde-corps
  Bm.cbox(T.doorX1 - T.doorX0 + 0.12, 2.15, 0.05, (T.doorX0 + T.doorX1) / 2, yF + 1.06, T.z1 + 0.015, 0x9aa0a6, 0.01);
  B.box(T.doorX1 - T.doorX0, 2.05, 0.06, (T.doorX0 + T.doorX1) / 2, yF + 1.02, T.z1 + 0.03, 0x0d1013);
  const Bl = mk();
  for (let i = 0; i < 4; i++) Bl.cbox(1.3, 0.06, 0.45, (T.doorX0 + T.doorX1) / 2, yF * (i + 1) / 4 - 0.04, T.z1 + 1.8 - i * 0.45 - 0.22, 0x8a8f94, 0.01);
  for (const dx of [-0.72, 0.72]) {
    const x = (T.doorX0 + T.doorX1) / 2 + dx;
    Bm.rod([x, 0.05, T.z1 + 1.95], [x, yF + 0.95, T.z1 + 0.1], 0.025, 0xc8ccd0, 8);
    Bm.rod([x, 0.95, T.z1 + 1.95], [x, yF + 1.0, T.z1 + 0.1], 0.025, 0xc8ccd0, 8);
    Bm.rod([x, 0.05, T.z1 + 1.95], [x, 0.95, T.z1 + 1.95], 0.025, 0xc8ccd0, 8);
  }
  // pied de car (panneau de raccordement) avec son auvent
  Bs.cbox(3.0, 1.1, 0.12, T.x1 - 2.3, 1.25, T.z1 + 0.06, 0x2b3036, 0.02);
  Bs.cbox(3.1, 0.04, 0.3, T.x1 - 2.3, 1.84, T.z1 + 0.15, 0x3a3f45, 0.01);
  for (let i = 0; i < 16; i++) Bp.cyl(0.05, 0.05, 0.08, T.x1 - 3.6 + (i % 8) * 0.34, 1.5 - Math.floor(i / 8) * 0.25, T.z1 + 0.13, 0xff8a1f, 10, Math.PI / 2);
  for (let i = 0; i < 8; i++) Bm.cyl(0.03, 0.03, 0.06, T.x1 - 3.6 + i * 0.34, 0.95, T.z1 + 0.13, 0xd8d8d8, 8, Math.PI / 2);
  // tracteur : châssis, réservoirs, échappements, pare-chocs, rétroviseurs
  const tx = T.x0 - 2.3;
  Bs.cbox(6.2, 0.4, 1.0, T.x0 - 2.2, 0.85, T.cz, 0x202326, 0.03);
  for (const s of [-1, 1]) { Bm.cyl(0.32, 0.32, 1.4, tx + 0.9, 0.85, T.cz + s * 1.0, 0xc8ccd0, 18, 0, Math.PI / 2); Bm.cyl(0.07, 0.07, 3.0, tx + 2.0, 2.4, T.cz + s * 1.1, 0xb8bec4, 10); Bm.cyl(0.09, 0.09, 0.25, tx + 2.0, 3.95, T.cz + s * 1.1, 0x8a9096, 10); }
  Bs.cbox(0.3, 0.45, 2.45, T.x0 - 5.05, 0.75, T.cz, 0x1d2025, 0.04);
  for (const s of [-1, 1]) { Bp.cyl(0.08, 0.08, 0.04, T.x0 - 5.21, 0.7, T.cz + s * 0.9, 0xfff0d0, 12, 0, 0, Math.PI / 2); }
  for (const s of [-1, 1]) { Bp.cbox(0.05, 0.42, 0.22, T.x0 - 5.1, 2.55, T.cz + s * 1.42, 0x1d2025, 0.015); Bp.cbox(0.05, 0.18, 0.16, T.x0 - 5.1, 2.2, T.cz + s * 1.42, 0x1d2025, 0.012); Bm.rod([T.x0 - 4.8, 2.9, T.cz + s * 1.25], [T.x0 - 5.05, 2.75, T.cz + s * 1.4], 0.02, 0x6a7078, 6); }
  // passages de roue et marchepieds du tracteur
  for (const s of [-1, 1]) {
    Bs.add(new THREE.CylinderGeometry(0.66, 0.66, 0.5, 14, 1, true, 0, Math.PI), new THREE.Matrix4().compose(new THREE.Vector3(T.x0 - 4.0, 0.5, T.cz + s * 1.05), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI / 2)), new THREE.Vector3(1, 1, 1)), 0x1f2225);
    Bm.cbox(0.6, 0.04, 0.3, T.x0 - 2.9, 0.55, T.cz + s * 1.2, 0x9aa0a6, 0.01); Bm.cbox(0.6, 0.04, 0.3, T.x0 - 2.9, 0.95, T.cz + s * 1.2, 0x9aa0a6, 0.01);
  }
  const steelMat = matiere('laque', { seed: 21, scale: 0.5, roughness: 0.5, metalness: 0.25, name: 'car-acier' });
  const paint = matiere('tole', { seed: 22, scale: 0.7, strength: 0.5, roughness: 0.38, metalness: 0.12, name: 'car-peinture' });
  const alu = matiere('alu', { seed: 23, scale: 0.4, name: 'car-alu-ext' });
  const plast = matiere('plastique', { seed: 24, scale: 0.2, roughness: 0.5, name: 'car-plastique-ext' });
  const larme = matiere('larme', { seed: 25, scale: 0.3, name: 'car-larme-ext' });
  for (const [b, m] of [[B, paint], [Bs, steelMat], [Bm, alu], [Bp, plast], [Bl, larme]]) { const mesh = b.mesh(m); mesh.castShadow = true; mesh.receiveShadow = true; grp.add(mesh); }
  // cabine (peinture métallisée bleu nuit) : caisse arrondie, déflecteur de toit, calandre à lames, pare-soleil
  const cab = new Builder({ ao: 0.4, occluders: occ });
  cab.cbox(2.3, 2.6, 2.5, T.x0 - 3.7, 2.15, T.cz, 0x2d4a72, 0.16, 0, 0, 0, 6);
  cab.cbox(1.8, 0.7, 2.3, T.x0 - 3.45, 3.75, T.cz, 0x2d4a72, 0.1, 0, 0, -0.18, 5);
  cab.cbox(0.08, 0.9, 2.1, T.x0 - 4.86, 1.25, T.cz, 0x14181c, 0.02);
  cab.cbox(0.06, 0.2, 2.3, T.x0 - 4.87, 3.3, T.cz, 0x1a2230, 0.015); // pare-soleil
  for (const s of [-1, 1]) cab.box(0.02, 1.9, 0.03, T.x0 - 3.7 + 0.3, 1.9, T.cz + s * 1.26, 0x16243a); // joints de porte
  const cabM = cab.mesh(matiere('tole', { seed: 26, scale: 0.6, strength: 0.4, roughness: 0.3, metalness: 0.55, name: 'car-cabine' })); cabM.castShadow = true; grp.add(cabM);
  const grille = new Builder();
  for (let k = 0; k < 6; k++) grille.cbox(0.03, 0.05, 1.9, T.x0 - 4.91, 0.9 + k * 0.14, T.cz, 0x8a9098, 0.01);
  grille.cbox(0.04, 0.12, 0.5, T.x0 - 4.92, 1.6, T.cz, 0xc0c6cc, 0.01); // emblème
  grp.add(grille.mesh(alu));
  // pare-brise courbe (verre teinté, reflets du ciel) et vitres latérales
  const glass = new THREE.MeshStandardMaterial({ color: 0x1a2430, roughness: 0.05, metalness: 0.9 });
  const ws = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 1.05, 18, 1, true, -0.75, 1.5), glass);
  ws.position.set(T.x0 - 3.3, 2.75, T.cz); ws.rotation.y = -Math.PI / 2; ws.scale.set(1, 1, 0.8); grp.add(ws);
  for (const s of [-1, 1]) { const sw = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.8), glass); sw.position.set(T.x0 - 4.2, 2.8, T.cz + s * 1.26); sw.rotation.y = s > 0 ? 0 : Math.PI; grp.add(sw); }
  // phares (émissifs) et feux de position
  const lamp = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4d8, emissiveIntensity: 0.6, roughness: 0.2 });
  for (const s of [-1, 1]) { const h = new THREE.Mesh(roundedBox(0.06, 0.16, 0.36, 0.02), lamp); h.position.set(T.x0 - 5.12, 1.05, T.cz + s * 0.9); grp.add(h); }
  const amber = new THREE.MeshStandardMaterial({ color: 0xffb020, emissive: 0xff9010, emissiveIntensity: 0.5, roughness: 0.3 });
  for (const s of [-1, 1]) { const h = new THREE.Mesh(roundedBox(0.04, 0.05, 0.12, 0.01), amber); h.position.set(T.x0 - 4.86, 3.42, T.cz + s * 1.0); grp.add(h); }
  // roues : remorque (3 essieux, roues simples larges) et tracteur (avant simple, arrière jumelé)
  for (const dx of [5.2, 6.6, 8.0]) for (const s of [-1, 1]) wheel(grp, T.cx + dx, 0.5, T.cz + s * 1.05);
  for (const s of [-1, 1]) { wheel(grp, T.x0 - 4.0, 0.5, T.cz + s * 1.05); wheel(grp, T.x0 - 0.9, 0.5, T.cz + s * 0.95, 0.5, 0.32, true); }
  // livrée des flancs (extensions et caisse) et faces avant / arrière, sur tôle nervurée
  const lv1 = liveryTexture(13.5, 2.55, { seed: 3, vents: [0.06, 0.82], labels: [[0.79, 'PIED DE CAR →']] });
  const lv2 = liveryTexture(13.5, 2.55, { seed: 4, vents: [0.12, 0.5, 0.86] });
  decal(grp, lv1, 13.4, 2.45, T.cx + 0.5, yF + 1.38, T.z1 + 0.012, 0);
  decal(grp, lv2, 13.4, 2.45, T.cx + 0.5, yF + 1.38, T.z0 - 0.012, Math.PI);
  const lvB = liveryTexture(T.len, 3.0, { seed: 6 });
  decal(grp, lvB, T.len - 0.14, 2.86, T.cx, yF + 1.55, T.cz + 1.288, 0); decal(grp, lvB, T.len - 0.14, 2.86, T.cx, yF + 1.55, T.cz - 1.288, Math.PI);
  const lvE = liveryTexture(2.55, 3.0, { seed: 8, labels: [[0.1, 'HAUTEUR 4,0 m']] });
  decal(grp, lvE, 2.4, 2.86, T.x1 + 0.012, yF + 1.55, T.cz, Math.PI / 2, 0.38, 0.1, true); decal(grp, lvE, 2.4, 2.86, T.x0 - 0.012, yF + 1.55, T.cz, -Math.PI / 2);
  return grp;
}

// camion satellite (DSNG) : porteur avec antenne 1,8 m et coffres
export function buildDSNG(x, z) {
  const grp = new THREE.Group(); const B = new Builder({ ao: 0.4 });
  B.cbox(7, 2.6, 2.5, x, 1.9, z, 0xe9ecef, 0.08, 0, 0, 0, 6); B.cbox(2.3, 2.3, 2.5, x - 4.7, 1.55, z, 0xe9ecef, 0.14, 0, 0, 0, 6);
  B.cbox(7.05, 0.3, 2.52, x, 1.0, z, 0x1d6fd1, 0.02); B.cbox(0.06, 0.9, 2.1, x - 5.86, 2.1, z, 0x1a2430, 0.02);
  B.cbox(9.4, 0.35, 2.2, x - 1.2, 0.55, z, 0x222428, 0.03);
  for (let k = 0; k < 4; k++) { B.cbox(1.4, 1.1, 0.04, x - 2.5 + k * 1.6, 1.8, z + 1.27, 0xd6dadf, 0.01); B.cyl(0.012, 0.012, 0.14, x - 2.5 + k * 1.6 + 0.55, 1.6, z + 1.31, 0x8a9096, 6, 0, 0, 0); }
  B.cbox(1.2, 0.5, 1.2, x + 1, 3.45, z, 0x9aa0a6, 0.03); B.cyl(0.15, 0.15, 1.2, x + 1, 4.1, z, 0x777777, 10);
  for (const s of [-1, 1]) B.cbox(0.05, 0.4, 0.2, x - 5.9, 2.5, z + s * 1.4, 0x1d2025, 0.012);
  const m = B.mesh(matiere('tole', { seed: 31, scale: 0.7, strength: 0.5, roughness: 0.4, metalness: 0.15, name: 'dsng' })); m.castShadow = true; m.receiveShadow = true; grp.add(m);
  for (const dx of [-4.2, 1.2, 2.6]) for (const s of [-1, 1]) wheel(grp, x + dx, 0.5, z + s * 1.05);
  const dish = new THREE.Mesh(new THREE.SphereGeometry(1.0, 28, 12, 0, Math.PI * 2, 0, 0.85), new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.45, metalness: 0.1, side: THREE.DoubleSide }));
  dish.position.set(x + 1, 4.9, z); dish.rotation.set(-0.9, 0.6, 0); dish.castShadow = true; grp.add(dish);
  const feed = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.9, 8), new THREE.MeshStandardMaterial({ color: 0x55595e, roughness: 0.4, metalness: 0.6 }));
  feed.position.set(x + 1.25, 5.2, z + 0.25); feed.rotation.set(-0.9, 0.6, 0); grp.add(feed);
  return grp;
}

// groupe électrogène insonorisé sur remorque
export function buildGenerator(x, z) {
  const grp = new THREE.Group(); const B = new Builder({ ao: 0.4 });
  B.cbox(9, 3, 2.5, x, 2.1, z, 0x2f6a3f, 0.06, 0, 0, 0, 6); B.cbox(9, 0.6, 2.3, x, 0.5, z, 0x2a2d30, 0.03);
  for (const s of [-1, 1]) for (let k = 0; k < 5; k++) { B.cbox(1.2, 1.6, 0.04, x - 3.4 + k * 1.7, 2.2, z + s * 1.27, 0x285c36, 0.01); for (let j = 0; j < 8; j++) B.box(1.0, 0.04, 0.05, x - 3.4 + k * 1.7, 1.6 + j * 0.17, z + s * 1.29, 0x1d4428); B.cyl(0.012, 0.012, 0.12, x - 3.4 + k * 1.7 + 0.45, 2.2, z + s * 1.31, 0x8a9096, 6); }
  B.cyl(0.18, 0.18, 1.2, x + 3, 4.1, z, 0x444444, 10); B.cyl(0.24, 0.18, 0.2, x + 3, 4.75, z, 0x333333, 10);
  B.cbox(0.1, 0.45, 1.2, x - 4.55, 2.4, z, 0xf5c400, 0.01);
  // armoire de commande : afficheur, voyants, prises P17 rouges (triphasé) et bleues
  B.cbox(0.06, 0.5, 0.7, x + 4.53, 1.6, z + 0.3, 0x1a1d21, 0.01); B.box(0.02, 0.12, 0.3, x + 4.57, 1.72, z + 0.3, 0x9ed0ff);
  for (let k = 0; k < 4; k++) B.cyl(0.05, 0.05, 0.08, x + 4.56, 1.05, z - 0.8 + k * 0.35, k < 2 ? 0xd01020 : 0x2060d0, 10, 0, Math.PI / 2);
  const m = B.mesh(matiere('tole', { seed: 32, scale: 0.7, strength: 0.6, roughness: 0.5, metalness: 0.15, name: 'groupe' })); m.castShadow = true; m.receiveShadow = true; grp.add(m);
  for (const dx of [-1.2, 0.2]) for (const s of [-1, 1]) wheel(grp, x + dx, 0.5, z + s * 1.05);
  return grp;
}

// bungalows de production : bardage, fenêtres, porte, climatiseur
export function buildBungalows(x0, z) {
  const grp = new THREE.Group(); const B = new Builder({ ao: 0.4 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x223040, roughness: 0.08, metalness: 0.85 });
  for (let i = 0; i < 3; i++) {
    const x = x0 + i * 6.5;
    B.cbox(6, 2.6, 2.4, x, 1.45, z, 0xd6d0c4, 0.04, 0, 0, 0, 5); B.cbox(6.1, 0.12, 2.5, x, 2.8, z, 0x8a8f94, 0.02); B.cbox(6.1, 0.18, 2.5, x, 0.12, z, 0x6b7076, 0.02);
    for (let k = -2; k <= 2; k++) B.box(0.04, 2.5, 0.03, x + k * 1.2, 1.45, z + 1.21, 0xbfb9ad);
    B.cbox(0.9, 2.0, 0.04, x - 2.2, 1.2, z + 1.22, 0x6b7076, 0.01); B.box(0.02, 0.14, 0.03, x - 1.85, 1.1, z + 1.25, 0xc0c6cc);
    B.cbox(0.7, 0.5, 0.35, x + 2.3, 2.2, z + 1.35, 0xe4e4e4, 0.02);
    for (const dx of [-0.6, 1.0]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.8), glass); w.position.set(x + dx, 1.75, z + 1.215); grp.add(w); for (const dy of [-0.43, 0.43]) B.box(1.16, 0.03, 0.03, x + dx, 1.75 + dy, z + 1.215, 0xf4f4f0); for (const ddx of [-0.57, 0.57]) B.box(0.03, 0.86, 0.03, x + dx + ddx, 1.75, z + 1.215, 0xf4f4f0); }
    for (let k = 0; k < 3; k++) B.cbox(0.6, 0.05, 0.4, x - 2.2, 0.03 + k * 0.17, z + 1.5 + k * 0.1, 0x8a8f94, 0.01); // marches
  }
  const m = B.mesh(matiere('tole', { seed: 33, scale: 0.6, strength: 0.6, roughness: 0.6, metalness: 0.1, name: 'bungalow' })); m.castShadow = true; m.receiveShadow = true; grp.add(m);
  return grp;
}

// @ts-check
import * as THREE from 'three';
import { Builder } from './geo.js';
import { matiere } from './matiere.js';
import { makeCanvas, kelvinRGBNorm } from './util.js';
import { fillFit } from './textfit.js';
import { S } from './state.js';
import { paintMat } from './bcam.js';

// ----------------------------------------------------------------------------------
// Le mini plateau des commentateurs, sur la terrasse de la tribune Lepagnot (au-dessus des
// derniers rangs, à droite de l'axe du terrain) : une plateforme sur échafaudage, un pupitre à
// façade LED, un fond de décor LED, les deux commentateurs (journaliste et consultant) assis avec
// leur casque-micro, deux caméras sur trépied (un plan à deux, un plan serré qui alterne d'un
// commentateur à l'autre) et deux panneaux LED sur pied qui les éclairent de face.
//
// Ce que filment ces deux caméras alimente l'entrée STUDIO du mélangeur (pipeline.js) : l'image du
// plateau est rendue en basse définition (480 × 270), une image sur quatre, puis passe par le même
// traitement que les caméras du stade (matériau CCU de bcam.js), avec une exposition et une balance
// tirées de la lumière du moment. Avant la v19.9, cette entrée était une image fixe dessinée.
//
// Repère de la tribune Lepagnot : u = x le long de la tribune, o vers l'extérieur, z = −(41 + o).
// La terrasse est à y = 11 (haut de la tribune basse, o = 22) ; le vitrage des loges à o = 24,5.
// ----------------------------------------------------------------------------------

const HZ = 41;
const P = (u, o, y) => new THREE.Vector3(u, y, -(HZ + o));
/** emprise de la plateforme (public retiré dessous : world.js, buildCrowd) */
export const PLATEAU = {
  u0: 8, u1: 15.6, o0: 19.4, o1: 24.4, y: 11.15,
  // les deux commentateurs : journaliste (u 11,1) et consultant (u 12,5), face au terrain
  sieges: [{ u: 11.1, o: 23.15 }, { u: 12.5, o: 23.15 }],
  // caméra 1 : plan à deux ; caméra 2 : plan serré (alterne entre les deux commentateurs)
  cams: [{ u: 11.8, o: 20.0, fov: 34 }, { u: 13.7, o: 20.35, fov: 16 }],
  leds: [{ u: 9.4, o: 20.9 }, { u: 14.6, o: 21.1 }],
  staff: /** @type {any[]} */ ([]),
  rt: null, raw: null, cam: null, quad: null, scene: null, active: 0, last: -1, lights: [],
};

function fondTex() {
  const c = makeCanvas(1024, 512); const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 1024, 512); gr.addColorStop(0, '#0d1b3a'); gr.addColorStop(0.55, '#16306a'); gr.addColorStop(1, '#3a0d1a');
  g.fillStyle = gr; g.fillRect(0, 0, 1024, 512);
  // lignes de lumière et silhouette de la tribune
  g.globalAlpha = 0.22; g.strokeStyle = '#7fb4ff'; g.lineWidth = 3;
  for (let i = 0; i < 14; i++) { g.beginPath(); g.moveTo(i * 90 - 200, 512); g.lineTo(i * 90 + 200, 0); g.stroke(); }
  g.globalAlpha = 0.5; g.fillStyle = '#05080f'; g.beginPath(); g.moveTo(0, 420);
  for (let x = 0; x <= 1024; x += 32) g.lineTo(x, 400 - Math.sin(x / 140) * 18 - (x % 64 ? 0 : 10));
  g.lineTo(1024, 512); g.lineTo(0, 512); g.fill();
  // textes au-dessus des têtes (elles sont à mi-hauteur du fond, vers 270 px) : lisibles dans le plan à deux
  g.globalAlpha = 1; g.fillStyle = '#f5c400'; g.fillRect(140, 254, 744, 5);
  g.fillStyle = '#ffd23f'; g.textAlign = 'center'; g.textBaseline = 'middle';
  fillFit(g, 'RC LENS – AS RIVIÈRE · STADE BOLLAERT-DELELIS', 512, 118, 760, 34, { weight: 600 });
  g.fillStyle = '#ffffff'; fillFit(g, 'MATCH EN DIRECT', 512, 196, 760, 88);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function facadeTex() {
  const c = makeCanvas(1024, 256); const g = c.getContext('2d');
  g.fillStyle = '#0b0e16'; g.fillRect(0, 0, 1024, 256);
  g.fillStyle = '#c8102e'; g.fillRect(0, 0, 1024, 16); g.fillStyle = '#f5c400'; g.fillRect(0, 240, 1024, 16);
  g.fillStyle = '#ff3b2a'; g.beginPath(); g.arc(90, 128, 22, 0, 7); g.fill();
  g.fillStyle = '#ffffff'; g.textAlign = 'left'; g.textBaseline = 'middle'; fillFit(g, 'EN DIRECT', 130, 128, 300, 70);
  g.textAlign = 'right'; g.fillStyle = '#ffd23f'; fillFit(g, 'RCL – RIV', 980, 128, 460, 90);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

/** une caméra de plateau sur trépied (repère local : regarde vers +z) */
function cameraPlateau(Bm, Bp, base, h, tally, glow) {
  const m = new THREE.Matrix4().makeRotationY(h).setPosition(base);
  const add = (B, g, color) => { g.applyMatrix4(m); B.add(g, null, color); };
  for (let k = 0; k < 3; k++) {
    const a = k * 2.094 + 0.5, f = new THREE.Vector3(Math.cos(a) * 0.55, 0, Math.sin(a) * 0.55), top = new THREE.Vector3(0, 1.05, 0);
    const len = f.distanceTo(top), mid = f.clone().add(top).multiplyScalar(0.5);
    const g = new THREE.CylinderGeometry(0.016, 0.02, len, 6); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), top.clone().sub(f).normalize())); g.translate(mid.x, mid.y, mid.z);
    add(Bm, g, 0x2a2d31);
    const sp = new THREE.CylinderGeometry(0.008, 0.008, 0.3, 5); sp.rotateZ(Math.PI / 2); sp.rotateY(-a); sp.translate(Math.cos(a) * 0.28, 0.3, Math.sin(a) * 0.28); add(Bm, sp, 0x2a2d31); // araignée
  }
  add(Bm, new THREE.CylinderGeometry(0.08, 0.1, 0.16, 12).translate(0, 1.12, 0), 0x3a3d42); // tête fluide
  add(Bp, new THREE.BoxGeometry(0.2, 0.24, 0.42).translate(0, 1.32, -0.02), 0x1d1e20); // corps
  add(Bp, new THREE.CylinderGeometry(0.065, 0.075, 0.26, 16).rotateX(Math.PI / 2).translate(0, 1.33, 0.32), 0x18191b); // objectif
  add(Bp, new THREE.CylinderGeometry(0.082, 0.082, 0.05, 16).rotateX(Math.PI / 2).translate(0, 1.33, 0.46), 0x101112); // pare-soleil
  add(Bp, new THREE.BoxGeometry(0.18, 0.13, 0.12).translate(0.02, 1.52, -0.12), 0x15161a); // viseur
  add(Bm, new THREE.CylinderGeometry(0.012, 0.012, 0.5, 6).rotateX(Math.PI / 2 + 0.5).translate(-0.12, 1.16, -0.36), 0x9aa0a6); // manche
  const tl = new THREE.BoxGeometry(0.06, 0.03, 0.02).translate(0, 1.47, 0.18); tl.applyMatrix4(m); glow.add(tl, null, tally ? 0xff2010 : 0x3a1010);
}

/**
 * Construit le plateau et renvoie la liste des deux commentateurs (pour staff.js).
 * @param {THREE.Scene} scene
 */
export function buildPlateau(scene) {
  const L = PLATEAU, y = L.y;
  const occ = [];
  const mk = () => new Builder({ ao: 0.3, occluders: occ, aoOpts: { dist: 0.9, strength: 0.9, floor: 0.35 } });
  const Bm = mk(), Bp = mk(), Bd = mk(), Bf = mk();
  const glow = new Builder();
  const cu = (L.u0 + L.u1) / 2, co = (L.o0 + L.o1) / 2, W = L.u1 - L.u0, D = L.o1 - L.o0;
  // plateforme sur échafaudage, nez lumineux, garde-corps vitré côté terrain
  Bf.cbox(W, 0.14, D, cu, y - 0.07, -(HZ + co), 0x2a2e36, 0.02);
  glow.box(W - 0.1, 0.02, 0.03, cu, y - 0.12, -(HZ + L.o0) + 0.01, 0x7fb4ff);
  for (let u = L.u0 + 0.2; u <= L.u1 - 0.1; u += 1.85) for (const o of [L.o0 + 0.15, L.o0 + 1.6]) {
    const yb = 1.5 + 9.5 * o / 22; // marche de la tribune sous le pied
    Bm.box(0.06, y - 0.14 - yb, 0.06, u, (y - 0.14 + yb) / 2, -(HZ + o), 0x9aa0a6);
  }
  for (let u = L.u0 + 0.2; u <= L.u1 - 0.1; u += 0.95) Bm.box(0.03, 1.0, 0.03, u, y + 0.5, -(HZ + L.o0) - 0.03, 0xc0c6cc);
  Bm.cyl(0.022, 0.022, W, cu, y + 1.0, -(HZ + L.o0) - 0.03, 0xc0c6cc, 8, 0, Math.PI / 2);
  // pupitre : plateau en stratifié, façade LED (texture), deux écrans de retour, micros de table
  const du = 11.8, dO = 22.45, dw = 2.9;
  Bd.cbox(dw, 0.05, 0.75, du, y + 0.76, -(HZ + dO), 0xd8dadc, 0.02);
  Bd.cbox(dw - 0.06, 0.7, 0.06, du, y + 0.39, -(HZ + dO) + 0.33, 0x15181c, 0.01);
  for (const s of [-1, 1]) Bd.cbox(0.06, 0.74, 0.7, du + s * (dw / 2 - 0.05), y + 0.37, -(HZ + dO), 0x15181c, 0.01);
  const fa = new THREE.Mesh(new THREE.PlaneGeometry(dw - 0.1, 0.62), new THREE.MeshBasicMaterial({ map: facadeTex(), toneMapped: true, color: new THREE.Color(1.6, 1.6, 1.6) }));
  fa.position.set(du, y + 0.4, -(HZ + dO) + 0.365); scene.add(fa);
  for (const s of L.sieges) {
    // écran de retour bas (encastré, incliné vers le commentateur) : il ne masque pas le plan à deux
    Bp.cbox(0.34, 0.2, 0.025, s.u, y + 0.86, -(HZ + dO) - 0.22, 0x101114, 0.006, 0, 0.55);
    Bp.cbox(0.1, 0.06, 0.08, s.u, y + 0.8, -(HZ + dO) - 0.16, 0x1a1c1f, 0.01);
    Bp.cbox(0.3, 0.02, 0.22, s.u + 0.25, y + 0.795, -(HZ + dO) - 0.1, 0xf4f2ec, 0.004); // fiches
    // fauteuil de plateau (assise, dossier, piètement)
    Bp.cbox(0.48, 0.07, 0.46, s.u, y + 0.46, -(HZ + s.o), 0x2b2f38, 0.03);
    Bp.cbox(0.46, 0.5, 0.07, s.u, y + 0.75, -(HZ + s.o) - 0.24, 0x2b2f38, 0.03, 0, 0.1);
    Bm.cyl(0.03, 0.03, 0.42, s.u, y + 0.21, -(HZ + s.o), 0x9aa0a6, 8); Bm.cyl(0.24, 0.24, 0.02, s.u, y + 0.01, -(HZ + s.o), 0x6a7078, 16);
  }
  // fond de décor LED derrière les commentateurs, sur son châssis
  const bw = 4.4, bh = 2.4, bo = 24.15;
  const fond = new THREE.Mesh(new THREE.PlaneGeometry(bw, bh), new THREE.MeshBasicMaterial({ map: fondTex(), toneMapped: true, color: new THREE.Color(1.3, 1.3, 1.3) }));
  fond.position.set(du, y + 0.35 + bh / 2, -(HZ + bo) + 0.04); scene.add(fond);
  Bm.cbox(bw + 0.1, bh + 0.1, 0.08, du, y + 0.35 + bh / 2, -(HZ + bo) - 0.01, 0x15181c, 0.01);
  for (const s of [-1, 1]) Bm.box(0.08, 0.35, 0.4, du + s * (bw / 2 - 0.2), y + 0.175, -(HZ + bo) - 0.1, 0x2a2d31);
  // deux caméras sur trépied, tally rouge sur celle qui est à l'antenne
  L.cams.forEach((c, k) => {
    const base = P(c.u, c.o, y);
    const tgt = P(12.0 - (k ? 0.7 : 0.2), 23.15, y + 1.2);
    const h = Math.atan2(tgt.x - base.x, tgt.z - base.z);
    cameraPlateau(Bm, Bp, base, h, k === 0, glow);
    // point de vue : la lentille frontale (devant le pare-soleil), pas le centre du boîtier
    c.h = h; c.pos = base.clone().add(new THREE.Vector3(Math.sin(h) * 0.53, 1.33, Math.cos(h) * 0.53)); c.tgt = tgt;
  });
  // deux panneaux LED (lumière de face) sur pied, orientés vers les commentateurs
  const ledMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 3.0, 2.7) });
  L.leds.forEach((l) => {
    const base = P(l.u, l.o, y), tgt = P(11.8, 23.15, y + 1.25);
    const h = Math.atan2(tgt.x - base.x, tgt.z - base.z);
    for (let k = 0; k < 3; k++) { const a = k * 2.094; Bm.rod([base.x, y + 0.7, base.z], [base.x + Math.cos(a) * 0.45, y, base.z + Math.sin(a) * 0.45], 0.014, 0x2a2d31, 5); }
    Bm.cyl(0.018, 0.018, 1.5, base.x, y + 1.45, base.z, 0x2a2d31, 6);
    const ph = new THREE.Matrix4().makeRotationY(h).multiply(new THREE.Matrix4().makeRotationX(0.18)).setPosition(base.x, y + 2.15, base.z);
    const panel = new THREE.BoxGeometry(0.62, 0.42, 0.06); panel.applyMatrix4(ph); Bp.add(panel, null, 0x1a1c1f);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.36), ledMat); face.applyMatrix4(ph); face.translateZ(0.032); scene.add(face);
    // volets coupe-flux
    for (const s of [-1, 1]) { const v = new THREE.BoxGeometry(0.01, 0.42, 0.18); v.translate(s * 0.31, 0, 0.1); v.rotateY(0); v.applyMatrix4(ph); Bm.add(v, null, 0x15171a); }
    if (!S.lite && S.quality !== 'basse') {
      const sp = new THREE.SpotLight(0xfff2e0, 14, 7, 0.75, 0.6, 1.5);
      sp.position.set(base.x, y + 2.15, base.z); sp.target.position.copy(tgt); scene.add(sp); scene.add(sp.target); L.lights.push(sp);
    }
  });
  // câbles au sol (caméras et panneaux vers la boîte de raccordement sous la plateforme)
  {
    const run = (pts) => Bp.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => P(p[0], p[1], y + 0.01))), 24, 0.01, 5, false), null, 0x111214);
    run([[11.8, 20.0], [11.0, 20.4], [9.6, 20.6], [8.6, 21.4], [8.3, 22.6]]); run([[13.7, 20.35], [14.4, 21.0], [15.1, 22.4], [15.3, 23.8]]);
    run([[9.4, 20.9], [8.9, 21.8], [8.5, 23.0]]); run([[14.6, 21.1], [15.0, 22.0], [15.25, 23.5]]);
  }
  const parts = [
    [Bm, matiere('laque', { seed: 81, scale: 0.4, roughness: 0.45, metalness: 0.5, name: 'plateau-metal' })],
    [Bp, matiere('plastique', { seed: 82, scale: 0.25, roughness: 0.5, name: 'plateau-plastique' })],
    [Bd, matiere('stratifie', { seed: 83, scale: 0.7, roughness: 0.4, name: 'plateau-pupitre' })],
    [Bf, matiere('moquette', { seed: 84, scale: 0.3, roughness: 0.95, name: 'plateau-sol' })],
  ];
  for (const [b, m] of parts) { const mesh = b.mesh(m); mesh.name = m.name; mesh.castShadow = true; mesh.receiveShadow = true; scene.add(mesh); }
  const gm = new THREE.Mesh(glow.build(), new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(2.4, 2.4, 2.4) })); gm.name = 'plateau-voyants'; scene.add(gm);

  // les deux commentateurs : journaliste (parle, gestes) et consultant (écoute, regarde ses fiches)
  L.staff = L.sieges.map((s, k) => ({ kind: 'commentateur', tenue: k ? 'consultant' : 'commentateur', x: s.u, y, z: -(HZ + s.o), h: 0, pose: 'sit', seat: 0.49, bras: k ? 'pupitre' : 'geste', anim: 'parole', acc: 'casque', skin: k ? 0xa8714f : 0xe0b090, hair: k ? 0x0c0c0c : 0x5a4026 }));
  return L.staff;
}

// ------------------------------- l'image du plateau : entrée STUDIO -------------------------------
const W_RT = 480, H_RT = 270;
function ensureRT() {
  if (PLATEAU.rt) return;
  PLATEAU.raw = new THREE.WebGLRenderTarget(W_RT, H_RT, { type: THREE.HalfFloatType, samples: S.quality === 'haute' ? 4 : 0 });
  PLATEAU.rt = new THREE.WebGLRenderTarget(W_RT, H_RT, { type: THREE.UnsignedByteType, depthBuffer: false });
  PLATEAU.cam = new THREE.PerspectiveCamera(34, W_RT / H_RT, 0.05, 400);
  PLATEAU.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), paintMat); PLATEAU.quad.frustumCulled = false;
  PLATEAU.scene = new THREE.Scene(); PLATEAU.scene.add(PLATEAU.quad);
  PLATEAU.ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
}
/** la texture de l'entrée STUDIO (créée à la première demande) */
export function studioTexture() { ensureRT(); return PLATEAU.rt.texture; }
/**
 * Rend l'image du plateau (une image sur quatre, plus rarement en qualité Basse) : plan à deux
 * pendant 8 s, puis plan serré sur l'un ou l'autre commentateur pendant 6 s.
 * @param {THREE.WebGLRenderer} renderer @param {THREE.Scene} scene
 */
export function renderStudio(renderer, scene) {
  if (!PLATEAU.cams[0].pos) return;
  ensureRT();
  const every = S.quality === 'basse' ? 8 : 4;
  if (S.frame - PLATEAU.last < every && PLATEAU.last >= 0) return;
  PLATEAU.last = S.frame;
  const cyc = S.time % 28, k = cyc < 8 ? 0 : cyc < 14 ? 1 : cyc < 22 ? 0 : 2;
  PLATEAU.active = k;
  const c = PLATEAU.cams[k === 0 ? 0 : 1], cam = PLATEAU.cam;
  cam.position.copy(c.pos);
  // plan à deux : les épaules au tiers bas ; plan serré : le visage (tête à ≈ 1,38 m au-dessus du plancher)
  const tgt = k === 0 ? new THREE.Vector3(11.8, PLATEAU.y + 1.1, -(HZ + 23.0)) : new THREE.Vector3(k === 1 ? 11.1 : 12.5, PLATEAU.y + 1.3, -(HZ + 23.1));
  cam.fov = k === 0 ? c.fov : 17; cam.updateProjectionMatrix(); cam.lookAt(tgt);
  const prevTarget = renderer.getRenderTarget();
  renderer.setRenderTarget(PLATEAU.raw); renderer.render(scene, cam);
  // traitement caméra neutre : exposition tirée de la lumière du moment, balance sur la température de la scène
  const u = paintMat.uniforms, ill = kelvinRGBNorm(S.sceneCCT || 5600);
  u.tRaw.value = PLATEAU.raw.texture; u.uTexel.value.set(1 / W_RT, 1 / H_RT);
  u.uExpo.value = 2.2 * (S.eyeExposure || 1); u.uWB.value.set(1 / ill[0], 1, 1 / ill[2]); u.uBlack.value.set(0, 0, 0);
  u.uGamma.value = 0.45; u.uKnee.value = 0.92; u.uClip.value = 1.05; u.uDetail.value = 0.25; u.uSat.value = 1.0; u.uHLG.value = 0;
  u.uNoise.value = 0.002; u.uSeed.value = S.frame % 100; u.uBlackGamma.value = 0; u.uBlock.value = 0; u.uBreak.value = 0; u.uRoll.value = 0; u.uIris.value = 1;
  renderer.setRenderTarget(PLATEAU.rt); renderer.render(PLATEAU.scene, PLATEAU.ortho);
  renderer.setRenderTarget(prevTarget);
}

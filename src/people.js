// @ts-check
import * as THREE from 'three';
import { makeCanvas, mulberry32 } from './util.js';
import { TEAMS, PLAYER_NAMES } from './data/match.js';

// ----------------------------------------------------------------------------------
// Joueurs et arbitres : corps articulé (bassin, buste, tête, cuisses, jambes, chaussures,
// bras, avant-bras, mains), un mesh instancié par segment. Chaque segment porte deux couleurs
// (masque par sommet : maillot / col, short / peau, peau / cheveux…). Le dos du maillot
// reçoit le nom et le numéro. L'animation de course est procédurale (cycle de foulée, flexion
// du genou et du coude, inclinaison du buste, rotation des épaules) et la tête suit le ballon.
// ----------------------------------------------------------------------------------

// géométrie « loft » : anneaux en super-ellipse empilés le long de y (du haut vers le bas)
// s = { y, rx, rz, cx, cz, e (exposant : 2 = ellipse, plus grand = plus carré), m (masque, ou fonction (angle, s) → masque) }
function loft(secs, seg = 10, caps = [true, true], capBulge = [0, 0]) {
  const pos = [], mask = [], idx = [];
  for (const s of secs) {
    const e = s.e || 2;
    for (let k = 0; k < seg; k++) {
      const a = (k / seg) * Math.PI * 2;
      const c = Math.cos(a), sn = Math.sin(a);
      const px = Math.sign(c) * Math.pow(Math.abs(c), 2 / e) * s.rx;
      const pz = Math.sign(sn) * Math.pow(Math.abs(sn), 2 / e) * s.rz;
      pos.push((s.cx || 0) + px, s.y, (s.cz || 0) + pz);
      mask.push(typeof s.m === 'function' ? s.m(a, s) : (s.m || 0));
    }
  }
  for (let i = 0; i < secs.length - 1; i++) for (let k = 0; k < seg; k++) {
    const a = i * seg + k, b = i * seg + ((k + 1) % seg), c = (i + 1) * seg + k, d = (i + 1) * seg + ((k + 1) % seg);
    idx.push(a, b, c, b, d, c);
  }
  const cap = (ri, top) => {
    const s = secs[ri]; const ci = pos.length / 3;
    pos.push(s.cx || 0, s.y + (top ? capBulge[0] : -capBulge[1]), s.cz || 0);
    mask.push(typeof s.m === 'function' ? s.m(Math.PI / 2, s) : (s.m || 0));
    for (let k = 0; k < seg; k++) {
      const a = ri * seg + k, b = ri * seg + ((k + 1) % seg);
      if (top) idx.push(ci, b, a); else idx.push(ci, a, b);
    }
  };
  if (caps[0]) cap(0, true);
  if (caps[1]) cap(secs.length - 1, false);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aMask', new THREE.Float32BufferAttribute(mask, 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
// ellipsoïde en anneaux (tête, mains)
function ovoid(rx, ry, rz, rings, seg, opts = {}) {
  const secs = [];
  for (let i = 1; i < rings; i++) {
    const t = (i / rings) * Math.PI;
    const y = Math.cos(t) * ry;
    const r = Math.sin(t);
    secs.push({ y: y + (opts.cy || 0), rx: rx * r * (opts.wx ? opts.wx(y) : 1), rz: rz * r * (opts.wz ? opts.wz(y) : 1), cz: opts.oz ? opts.oz(y) : 0, m: opts.m, e: opts.e || 2 });
  }
  return loft(secs, seg, [true, true], [ry * 0.06, ry * 0.06]);
}

// ------------------------------- géométries -------------------------------
// partagées avec les avatars des joueurs en réseau (multi/avatars.js)
let GEOS = null;
export function personGeometries() { return GEOS || (GEOS = buildGeos()); }
function buildGeos() {
  const G = {};
  // buste : de la taille (y = 0) à la base du cou (y = 0,5) ; épaules, pectoraux, dos
  const collar = (a, s) => (s.y > 0.47 ? 1 : 0);
  G.torso = loft([
    { y: 0.52, rx: 0.075, rz: 0.065, m: 1 },
    { y: 0.50, rx: 0.12, rz: 0.09, m: collar },
    { y: 0.48, rx: 0.19, rz: 0.11, e: 2.6, m: collar },
    { y: 0.44, rx: 0.215, rz: 0.12, e: 3 },
    { y: 0.36, rx: 0.205, rz: 0.13, e: 2.8, cz: 0.008 },
    { y: 0.25, rx: 0.19, rz: 0.125, e: 2.6, cz: 0.01 },
    { y: 0.13, rx: 0.17, rz: 0.115, e: 2.4 },
    { y: 0.02, rx: 0.165, rz: 0.11, e: 2.4 },
    { y: -0.05, rx: 0.172, rz: 0.115, e: 2.4 },
  ], 12, [true, false]);
  // short : bassin (origine à la hauteur des hanches)
  G.pelvis = loft([
    { y: 0.13, rx: 0.17, rz: 0.115, e: 2.4 },
    { y: 0.05, rx: 0.18, rz: 0.12, e: 2.5 },
    { y: -0.05, rx: 0.19, rz: 0.125, e: 2.6 },
    { y: -0.11, rx: 0.17, rz: 0.11, e: 2.4 },
  ], 10, [false, true], [0, 0.02]);
  // cuisse : du haut (hanche) au genou ; le haut est dans le short
  G.thigh = loft([
    { y: 0.02, rx: 0.088, rz: 0.092 },
    { y: -0.10, rx: 0.087, rz: 0.09 },
    { y: -0.19, rx: 0.08, rz: 0.083 },
    { y: -0.19, rx: 0.074, rz: 0.077, m: 1 },
    { y: -0.30, rx: 0.065, rz: 0.07, m: 1 },
    { y: -0.40, rx: 0.052, rz: 0.058, m: 1, cz: 0.006 },
    { y: -0.45, rx: 0.048, rz: 0.052, m: 1, cz: 0.004 },
  ], 7, [true, true]);
  // jambe (chaussette) : genou → cheville, mollet marqué
  G.shin = loft([
    { y: 0.01, rx: 0.05, rz: 0.054, m: 1 },
    { y: -0.04, rx: 0.052, rz: 0.056 },
    { y: -0.13, rx: 0.056, rz: 0.062, cz: -0.012 },
    { y: -0.26, rx: 0.045, rz: 0.047, cz: -0.006 },
    { y: -0.38, rx: 0.033, rz: 0.035 },
    { y: -0.44, rx: 0.034, rz: 0.04 },
  ], 7, [true, true]);
  // chaussure : de la pointe (devant) au talon, construite verticalement puis couchée
  {
    const g = loft([
      // cz + rz = 0,075 : semelle à plat, 7,5 cm sous la cheville
      { y: 0.215, rx: 0.018, rz: 0.012, cz: 0.063 },
      { y: 0.2, rx: 0.038, rz: 0.024, cz: 0.051 },
      { y: 0.15, rx: 0.048, rz: 0.03, cz: 0.045 },
      { y: 0.06, rx: 0.047, rz: 0.04, cz: 0.035 },
      { y: 0.0, rx: 0.044, rz: 0.058, cz: 0.017 },
      { y: -0.04, rx: 0.042, rz: 0.058, cz: 0.017 },
      { y: -0.07, rx: 0.036, rz: 0.045, cz: 0.03 },
    ], 8, [true, true]);
    // y → z (vers l'avant), z → -y (vers le bas)
    g.rotateX(Math.PI / 2);
    // semelle : sommets les plus bas, couleur secondaire
    const p = g.attributes.position, m = g.attributes.aMask;
    for (let i = 0; i < p.count; i++) m.setX(i, p.getY(i) < -0.068 ? 1 : 0);
    G.boot = g;
  }
  // bras (manche courte → peau) : épaule → coude
  G.upperArm = loft([
    { y: 0.04, rx: 0.058, rz: 0.062 },
    { y: -0.04, rx: 0.06, rz: 0.06 },
    { y: -0.15, rx: 0.056, rz: 0.056 },
    { y: -0.15, rx: 0.045, rz: 0.047, m: 1 },
    { y: -0.24, rx: 0.04, rz: 0.042, m: 1 },
    { y: -0.29, rx: 0.036, rz: 0.038, m: 1 },
  ], 6, [true, true]);
  // avant-bras : coude → poignet
  G.forearm = loft([
    { y: 0.015, rx: 0.036, rz: 0.038 },
    { y: -0.07, rx: 0.04, rz: 0.038 },
    { y: -0.2, rx: 0.03, rz: 0.026 },
    { y: -0.25, rx: 0.026, rz: 0.022 },
  ], 6, [true, true]);
  G.hand = ovoid(0.026, 0.05, 0.016, 5, 6, { cy: -0.05 });
  // tête + cou : origine à la base du cou ; cheveux sur le dessus et l'arrière (masque)
  {
    const hair = (a, s) => {
      const fz = Math.sin(a); // +1 devant, -1 derrière
      const yl = fz >= 0 ? fz * 0.055 : fz * 0.08; // front, tempes, nuque
      return s.y - 0.17 > yl ? 1 : 0;
    };
    const head = ovoid(0.082, 0.118, 0.1, 9, 12, {
      cy: 0.17, m: hair,
      wx: (y) => (y < -0.04 ? 0.86 + (y + 0.12) * 1.6 : 1), // mâchoire plus étroite
      oz: (y) => (y < -0.03 ? 0.012 : y > 0.06 ? -0.006 : 0),
    });
    const neck = loft([{ y: 0.09, rx: 0.048, rz: 0.05 }, { y: -0.01, rx: 0.055, rz: 0.058 }], 9, [false, false]);
    G.head = mergeIndexed([head, neck]);
  }
  // fanion d'arbitre assistant (hampe + toile à damier, couleur secondaire)
  {
    const stick = loft([{ y: 0.05, rx: 0.008, rz: 0.008 }, { y: -0.55, rx: 0.008, rz: 0.008 }], 5, [true, true]);
    const cloth = new THREE.BufferGeometry();
    const P = [], M = [], I = [];
    const n = 4, w = 0.3, h = 0.24;
    for (let iy = 0; iy <= n; iy++) for (let ix = 0; ix <= n; ix++) { P.push(0.005, -0.3 + (iy / n) * h - 0.2, (ix / n) * w); M.push(((ix + iy) % 2)); }
    for (let iy = 0; iy < n; iy++) for (let ix = 0; ix < n; ix++) { const a = iy * (n + 1) + ix, b = a + 1, c = a + n + 1, d = c + 1; I.push(a, b, c, b, d, c, a, c, b, b, c, d); }
    cloth.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); cloth.setAttribute('aMask', new THREE.Float32BufferAttribute(M, 1)); cloth.setIndex(I); cloth.computeVertexNormals();
    G.flag = mergeIndexed([stick, cloth]);
  }
  return G;
}
function mergeIndexed(list) {
  const pos = [], mask = [], idx = []; let base = 0;
  for (const g of list) {
    const p = g.attributes.position, m = g.attributes.aMask;
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); mask.push(m ? m.getX(i) : 0); }
    const ix = g.index.array; for (let i = 0; i < ix.length; i++) idx.push(ix[i] + base);
    base += p.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aMask', new THREE.Float32BufferAttribute(mask, 1));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

// ------------------------------- matériaux -------------------------------
// deux couleurs par instance : instanceColor (principale) et aCol2 (secondaire), mélangées par le masque
export function kitMaterial(kind, opts = {}) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: opts.rough ?? 0.8, metalness: 0, side: opts.side || THREE.FrontSide });
  const num = kind === 'torso', face = kind === 'head';
  m.onBeforeCompile = (sh) => {
    if (num) sh.uniforms.tNum = { value: opts.tNum };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
attribute float aMask; attribute vec3 aCol2;${num ? '\nattribute vec4 aNum; varying vec3 vLoc; varying vec4 vNum;' : ''}${face ? '\nvarying vec3 vLoc; varying float vMk;' : ''}`)
      .replace('#include <color_vertex>', `#include <color_vertex>
#ifdef USE_INSTANCING_COLOR
  vColor.xyz = mix(instanceColor.xyz, aCol2, aMask);
#endif${num ? '\n  vLoc = position; vNum = aNum;' : ''}${face ? '\n  vLoc = position; vMk = aMask;' : ''}`);
    if (face) {
      // traits du visage (yeux, sourcils, bouche, ombre du nez) : lisibles dans les gros plans
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vLoc; varying float vMk;')
        .replace('#include <color_fragment>', `#include <color_fragment>
  {
    vec3 q = vLoc - vec3(0.0, 0.17, 0.0);
    if (q.z > 0.05 && vMk < 0.5) {
      float ax = abs(q.x);
      float eye = 1.0 - smoothstep(0.0075, 0.0125, length(vec2((ax - 0.031) * 0.8, q.y - 0.012)));
      float brow = (1.0 - smoothstep(0.0025, 0.006, abs(q.y - 0.034 + ax * 0.08))) * step(0.012, ax) * step(ax, 0.05);
      float mouth = (1.0 - smoothstep(0.0025, 0.0055, abs(q.y + 0.05 + ax * ax * 4.0))) * step(ax, 0.022);
      float nose = (1.0 - smoothstep(0.004, 0.012, length(vec2(q.x * 1.4, q.y + 0.022)))) * 0.5;
      diffuseColor.rgb *= 1.0 - 0.78 * eye - 0.55 * brow - 0.5 * mouth - 0.25 * nose;
    }
  }`);
    }
    if (num) {
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform sampler2D tNum; varying vec3 vLoc; varying vec4 vNum;')
        .replace('#include <color_fragment>', `#include <color_fragment>
  if (vNum.x >= 0.0 && vLoc.z < 0.0) {
    vec2 q = vec2(-vLoc.x / 0.32 + 0.5, (vLoc.y - 0.07) / 0.33);
    if (q.x > 0.0 && q.x < 1.0 && q.y > 0.0 && q.y < 1.0) {
      float col = mod(vNum.x, 4.0), row = floor(vNum.x / 4.0 + 0.01);
      float a = texture2D(tNum, vec2((col + q.x) / 4.0, 1.0 - (row + 1.0 - q.y) / 6.0)).r;
      diffuseColor.rgb = mix(diffuseColor.rgb, vNum.yzw, a);
    }
  }`);
    }
  };
  m.customProgramCacheKey = () => 'kit-' + kind;
  return m;
}

// nom + numéro au dos (blanc sur noir : la couleur vient de l'instance)
function numberAtlas() {
  const c = makeCanvas(1024, 1536); const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, 1024, 1536);
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  for (let i = 0; i < 22; i++) {
    const col = i % 4, row = Math.floor(i / 4); const x = col * 256 + 128, y = row * 256;
    const name = PLAYER_NAMES[i < 11 ? 0 : 1][i % 11].replace(/^[A-Z]\.\s*/, '').toUpperCase();
    let fs = 44; g.font = `700 ${fs}px "Barlow Condensed", "Arial Narrow", sans-serif`;
    while (g.measureText(name).width > 220 && fs > 24) { fs -= 2; g.font = `700 ${fs}px "Barlow Condensed", "Arial Narrow", sans-serif`; }
    g.fillText(name, x, y + 52);
    g.font = '700 178px "Barlow Condensed", "Arial Narrow", sans-serif';
    g.fillText(String([1, 2, 4, 5, 3, 6, 8, 10, 7, 9, 11][i % 11]), x, y + 238);
  }
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4;
  return t;
}

// ------------------------------- construction -------------------------------
export const PEOPLE = { parts: {}, n: 0, ball: new THREE.Vector3(), time: 0, atlas: null };
/** @type {Array<[string, string, number, number]>} : nom, géométrie, nombre par personne, rugosité */
export const PARTS = [
  // nom, géométrie, nombre par personne, rugosité
  ['torso', 'torso', 1, 0.82], ['pelvis', 'pelvis', 1, 0.85], ['head', 'head', 1, 0.6],
  ['thigh', 'thigh', 2, 0.75], ['shin', 'shin', 2, 0.85], ['boot', 'boot', 2, 0.45],
  ['upperArm', 'upperArm', 2, 0.8], ['forearm', 'forearm', 2, 0.7], ['hand', 'hand', 2, 0.65],
];
export function buildPeople(scene, humans) {
  const G = personGeometries();
  const n = humans.length; PEOPLE.n = n;
  PEOPLE.atlas = numberAtlas();
  if (document.fonts) document.fonts.ready.then(() => { const t = numberAtlas(); PEOPLE.atlas.image = t.image; PEOPLE.atlas.needsUpdate = true; });
  for (const [name, geo, per, rough] of PARTS) {
    const g = G[geo].clone();
    const cnt = n * per;
    g.setAttribute('aCol2', new THREE.InstancedBufferAttribute(new Float32Array(cnt * 3), 3));
    if (name === 'torso') g.setAttribute('aNum', new THREE.InstancedBufferAttribute(new Float32Array(cnt * 4).fill(-1), 4));
    const mesh = new THREE.InstancedMesh(g, kitMaterial(name, { rough, tNum: PEOPLE.atlas }), cnt);
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(mesh); PEOPLE.parts[name] = mesh;
  }
  // fanions des arbitres assistants
  {
    const g = G.flag.clone();
    g.setAttribute('aCol2', new THREE.InstancedBufferAttribute(new Float32Array([1, 0.85, 0.05, 1, 0.85, 0.05]), 3));
    const mesh = new THREE.InstancedMesh(g, kitMaterial('flag', { rough: 0.7, side: THREE.DoubleSide }), 2);
    mesh.castShadow = true; mesh.frustumCulled = false;
    mesh.setColorAt(0, new THREE.Color(0xe01020)); mesh.setColorAt(1, new THREE.Color(0xe01020));
    scene.add(mesh); PEOPLE.parts.flag = mesh;
  }
  const r = mulberry32(77);
  const col = new THREE.Color();
  const set = (part, i, a, b) => {
    const m = PEOPLE.parts[part]; m.setColorAt(i, col.setHex(a));
    col.setHex(b ?? a); m.geometry.attributes.aCol2.setXYZ(i, col.r, col.g, col.b);
  };
  const hairs = [0x1a1410, 0x241a12, 0x3b2a1a, 0x5a4026, 0x0c0c0c, 0x8a6a3a, 0x15100c];
  const bootsC = [0x111111, 0xf2f2f2, 0x1f6fff, 0xff5a1f, 0xd4ff3a, 0x111111, 0xe8e8e8];
  humans.forEach((h, i) => {
    let shirt, shorts, socks, sleeves, trim, numCol;
    if (h.team >= 0) {
      const T = TEAMS[h.team]; const gk = h.role === 'gk';
      shirt = gk ? T.gk : T.shirt; sleeves = gk ? T.gk : (T.sleeves ?? T.shirt); shorts = gk ? 0x111111 : T.shorts; socks = gk ? T.gk : T.socks;
      trim = gk ? 0x111111 : (T.sleeves ?? T.shorts);
      numCol = gk ? 0x111111 : (h.team === 0 ? 0xc8102e : 0x1d3a8a);
    } else { shirt = 0x1b1c20; sleeves = 0x1b1c20; shorts = 0x111111; socks = 0x111111; trim = 0x3a3d44; numCol = null; }
    const skin = h.skin, hair = hairs[Math.floor(r() * hairs.length)];
    const boot = bootsC[Math.floor(r() * bootsC.length)], sole = boot === 0x111111 ? 0xe8e8e8 : 0x222222;
    const longSl = h.role === 'gk' || h.team < 0 && r() < 0.5;
    set('torso', i, shirt, trim); set('pelvis', i, shorts, shorts); set('head', i, skin, hair);
    for (let s = 0; s < 2; s++) {
      const k = i * 2 + s;
      set('thigh', k, shorts, skin); set('shin', k, socks, socks); set('boot', k, boot, sole);
      set('upperArm', k, sleeves, longSl ? sleeves : skin); set('forearm', k, longSl ? sleeves : skin, longSl ? sleeves : skin);
      set('hand', k, h.role === 'gk' ? 0xf0f0f0 : skin, skin);
    }
    if (numCol != null) {
      col.setHex(numCol);
      PEOPLE.parts.torso.geometry.attributes.aNum.setXYZW(i, i, col.r, col.g, col.b);
    }
  });
  for (const m of Object.values(PEOPLE.parts)) { if (m.instanceColor) m.instanceColor.needsUpdate = true; m.geometry.attributes.aCol2.needsUpdate = true; }
  PEOPLE.humans = humans;
}

// ------------------------------- animation -------------------------------
const _root = new THREE.Matrix4(), _pel = new THREE.Matrix4(), _sp = new THREE.Matrix4(), _j = new THREE.Matrix4(), _j2 = new THREE.Matrix4(), _j3 = new THREE.Matrix4(), _t = new THREE.Matrix4(), _r = new THREE.Matrix4();
const T = (x, y, z) => _t.makeTranslation(x, y, z);
const RX = (a) => _r.makeRotationX(a), RY = (a) => _r.makeRotationY(a), RZ = (a) => _r.makeRotationZ(a);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
// i : indice, (x, z) position, heading cap, phase de foulée, cel : célébration, speed (m/s)
export function poseHuman(i, x, z, heading, phase, cel, speed) {
  const P = PEOPLE.parts; if (!P.torso) return;
  const sf = Math.min(1, speed / 7), walk = Math.min(1, speed / 1.5);
  const t = PEOPLE.time + i * 1.7;
  const gk = i % 11 === 0 && i < 22;
  // hauteur : le bassin descend un peu en course, rebond deux fois par cycle
  let bob = Math.abs(Math.sin(phase)) * (0.015 + 0.05 * sf) * walk - 0.035 * sf;
  if (cel) bob = Math.max(0, Math.sin(t * 7)) * 0.22;
  if (gk && speed < 0.5 && !cel) bob -= 0.03;
  const lean = 0.03 + 0.2 * sf + (cel ? -0.12 : 0);
  const twist = Math.sin(phase) * 0.16 * sf * walk;
  _root.makeRotationY(heading).setPosition(x, bob, z);
  // bassin
  _pel.copy(_root).multiply(T(0, 0.975, 0)).multiply(RY(twist)).multiply(RX(lean * 0.3));
  P.pelvis.setMatrixAt(i, _pel);
  // buste (contre-rotation des épaules), respiration à l'arrêt
  const breath = (1 - walk) * Math.sin(t * 1.6) * 0.012;
  _sp.copy(_pel).multiply(T(0, 0.1, 0)).multiply(RX(lean * 0.7 + breath)).multiply(RY(-twist * 1.7));
  P.torso.setMatrixAt(i, _sp);
  // tête : regarde le ballon
  const b = PEOPLE.ball;
  let ly = wrap(Math.atan2(b.x - x, b.z - z) - heading - twist * 0.5);
  ly = Math.max(-1.1, Math.min(1.1, ly));
  const dist = Math.hypot(b.x - x, b.z - z);
  const lp = Math.max(-0.2, Math.min(0.45, Math.atan2(1.6 - b.y, Math.max(1, dist)) * 0.6)) - lean * 0.8;
  _j.copy(_sp).multiply(T(0, 0.5, 0.005)).multiply(RY(cel ? 0 : ly)).multiply(RX(cel ? -0.35 : lp));
  P.head.setMatrixAt(i, _j);
  for (let s = 0; s < 2; s++) {
    const sg = s ? 1 : -1; // s = 0 : gauche (x négatif), 1 : droite
    const ph = phase + s * Math.PI;
    const k = i * 2 + s;
    // jambes : balancier de la cuisse, flexion du genou maximale en phase de rappel
    const amp = 0.12 + 0.55 * sf;
    const thigh = Math.sin(ph) * amp * walk + (gk && speed < 0.5 ? 0.25 : 0);
    const knee = (0.06 + (0.25 + 1.25 * sf) * Math.pow(Math.max(0, Math.cos(ph - 0.35)), 1.6) * walk + 0.12 * sf) + (gk && speed < 0.5 ? 0.45 : 0);
    const ankle = -0.25 * sf * Math.max(0, Math.cos(ph)) * walk + (gk && speed < 0.5 ? -0.2 : 0);
    _j.copy(_pel).multiply(T(sg * 0.095, -0.03, 0)).multiply(RX(-thigh - lean * 0.2)).multiply(RZ(sg * 0.035));
    P.thigh.setMatrixAt(k, _j);
    _j2.copy(_j).multiply(T(0, -0.44, 0)).multiply(RX(knee));
    P.shin.setMatrixAt(k, _j2);
    _j3.copy(_j2).multiply(T(0, -0.43, 0)).multiply(RX(ankle - knee * 0.25 + thigh * 0.35));
    P.boot.setMatrixAt(k, _j3);
    // bras : opposés aux jambes, coude plié en course ; bras levés pour célébrer
    _j.copy(_sp).multiply(T(sg * 0.2, 0.43, 0));
    let flex;
    if (cel) {
      _j.multiply(RZ(sg * (2.55 + Math.sin(t * 7 + s) * 0.18))).multiply(RX(-0.2));
      flex = 0.25;
    } else {
      const arm = -Math.sin(ph) * (0.15 + 0.55 * sf) * walk;
      _j.multiply(RX(-arm + 0.05)).multiply(RZ(sg * (0.1 + 0.08 * sf + (gk && speed < 0.5 ? 0.35 : 0))));
      flex = 0.25 + 1.15 * sf * walk + Math.max(0, arm) * 0.4 + (gk && speed < 0.5 ? 0.6 : 0);
    }
    P.upperArm.setMatrixAt(k, _j);
    _j2.copy(_j).multiply(T(0, -0.29, 0)).multiply(RX(-flex));
    P.forearm.setMatrixAt(k, _j2);
    _j3.copy(_j2).multiply(T(0, -0.25, 0)).multiply(RX(-0.1)).multiply(RY(sg * 0.3));
    P.hand.setMatrixAt(k, _j3);
    // arbitres assistants : fanion dans la main droite
    if (s === 1 && (i === 23 || i === 24) && P.flag) P.flag.setMatrixAt(i - 23, _j.copy(_j3).multiply(T(0, -0.06, 0)).multiply(RX(0.25)));
  }
}
export function flushPeople() {
  for (const m of Object.values(PEOPLE.parts)) m.instanceMatrix.needsUpdate = true;
}

// ballon : icosaèdre tronqué (12 pentagones noirs, 20 hexagones blancs) projeté en équirectangulaire,
// coutures entre panneaux
export function ballTexture() {
  const W = 512, H = 256;
  const c = makeCanvas(W, H); const g = c.getContext('2d');
  const img = g.createImageData(W, H);
  const ph = (1 + Math.sqrt(5)) / 2;
  const pent = [[0, 1, ph], [0, -1, ph], [0, 1, -ph], [0, -1, -ph], [1, ph, 0], [-1, ph, 0], [1, -ph, 0], [-1, -ph, 0], [ph, 0, 1], [-ph, 0, 1], [ph, 0, -1], [-ph, 0, -1]].map(norm);
  const hex = [];
  for (const a of [-1, 1]) for (const b of [-1, 1]) for (const d of [-1, 1]) hex.push(norm([a, b, d]));
  for (const a of [-1, 1]) for (const b of [-1, 1]) { hex.push(norm([0, a / ph, b * ph])); hex.push(norm([a / ph, b * ph, 0])); hex.push(norm([a * ph, 0, b / ph])); }
  const centers = pent.map((v) => [v, 1]).concat(hex.map((v) => [v, 0]));
  for (let y = 0; y < H; y++) {
    const th = (y + 0.5) / H * Math.PI;
    for (let x = 0; x < W; x++) {
      const p2 = (x + 0.5) / W * Math.PI * 2;
      const v = [Math.sin(th) * Math.cos(p2), Math.cos(th), Math.sin(th) * Math.sin(p2)];
      let b1 = -2, b2 = -2, k1 = 0;
      for (const [cv, k] of /** @type {Array<[number[], number]>} */ (centers)) { const d = v[0] * cv[0] + v[1] * cv[1] + v[2] * cv[2]; if (d > b1) { b2 = b1; b1 = d; k1 = k; } else if (d > b2) b2 = d; }
      let col = k1 ? 22 : 244;
      if (b1 - b2 < 0.012) col = k1 ? 60 : 150; // couture
      const i = (y * W + x) * 4; img.data[i] = col; img.data[i + 1] = col; img.data[i + 2] = k1 ? col : col - 6; img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function norm(v) { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; }

import * as THREE from 'three';
import { Builder, quadGeo, mergeNonIndexed, setLayer, screenMaterial } from './geo.js';
import { makeCanvas, rand, mulberry32, clamp, kelvinRGBNorm } from './util.js';
import { S } from './state.js';
import { ANTENNAS, TEAMS } from './data.js';

// --- Dimensions du stade (m) ---
export const PITCH = { hl: 52.5, hw: 34 };
export const BOWL = { hx: 61, hz: 41 }; // bord intérieur des tribunes
export const TIERS = {
  lower: { o1: 0, o2: 25, y1: 1.5, y2: 13.5 },
  upper: { o1: 29, o2: 52, y1: 18, y2: 36 },
};
export const OUTER = { hx: BOWL.hx + 52, hz: BOWL.hz + 52 };
export const TRUCK = { cx: -18, cz: -120, len: 18, wid: 5.8, floor: 1.2, ceil: 3.45, doorX0: -17.75, doorX1: -16.75 };
TRUCK.x0 = TRUCK.cx - TRUCK.len / 2; TRUCK.x1 = TRUCK.cx + TRUCK.len / 2;
TRUCK.z0 = TRUCK.cz - TRUCK.wid / 2; TRUCK.z1 = TRUCK.cz + TRUCK.wid / 2;

export const W = {
  scene: null, sun: null, flood1: null, flood2: null, hemi: null, sky: null,
  roofMeshes: [], screens: [], boardsMat: null, crowdMat: null, floodMat: null,
  interactables: [], obstacles: [], walkable: [], antennaMeshes: {}, giantScreen: null,
};

// hauteur de la surface des gradins pour un décalage o depuis le bord intérieur
export function standHeight(o) {
  const L = TIERS.lower, U = TIERS.upper;
  if (o < 0) return 0;
  if (o <= L.o2) return L.y1 + (o - L.o1) / (L.o2 - L.o1) * (L.y2 - L.y1);
  if (o < U.o1) return L.y2; // coursive
  if (o <= U.o2) return U.y1 + (o - U.o1) / (U.o2 - U.o1) * (U.y2 - U.y1);
  return 38;
}
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
  const inBowlOuter = Math.abs(x) < OUTER.hx && Math.abs(z) < OUTER.hz;
  const inField = Math.abs(x) < BOWL.hx - 0.4 && Math.abs(z) < BOWL.hz - 0.4;
  if (inBowlOuter && !inField && !inWalkZone(x, z)) return true;
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

function seatTexture() {
  const c = makeCanvas(256, 256); const g = c.getContext('2d');
  g.fillStyle = '#6b6f75'; g.fillRect(0, 0, 256, 256);
  for (let row = 0; row < 4; row++) {
    const y = row * 64;
    g.fillStyle = '#585c62'; g.fillRect(0, y + 44, 256, 20);
    for (let s = 0; s < 8; s++) {
      g.fillStyle = row % 2 ? '#2a4c9a' : '#24448c';
      g.fillRect(s * 32 + 3, y + 18, 26, 26);
      g.fillStyle = '#1b3570'; g.fillRect(s * 32 + 3, y + 36, 26, 8);
    }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}

function crowdAtlas() {
  const c = makeCanvas(512, 128); const g = c.getContext('2d');
  const r = mulberry32(3);
  for (let v = 0; v < 4; v++) {
    const ox = v * 128;
    for (let p = 0; p < 3; p++) {
      const cx = ox + 22 + p * 42 + (r() - 0.5) * 6;
      const stand = r() < 0.25;
      const top = stand ? 40 : 58;
      g.fillStyle = 'rgb(255,0,0)';
      g.beginPath(); g.moveTo(cx - 17, 128); g.lineTo(cx - 15, top + 14); g.quadraticCurveTo(cx, top + 4, cx + 15, top + 14); g.lineTo(cx + 17, 128); g.closePath(); g.fill();
      g.fillStyle = 'rgb(0,255,0)';
      g.beginPath(); g.arc(cx, top - 2, 10.5, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgb(0,0,255)';
      g.beginPath(); g.arc(cx, top - 6, 10.5, Math.PI * 1.05, Math.PI * 1.95); g.fill();
      if (r() < 0.3) { // bras levé
        g.fillStyle = 'rgb(255,0,0)'; g.fillRect(cx + 12, top - 22, 6, 34);
      }
    }
  }
  const t = new THREE.CanvasTexture(c); t.generateMipmaps = true;
  return t;
}

function boardsTexture() {
  const c = makeCanvas(2048, 64); const g = c.getContext('2d');
  const ads = [
    ['#0b1b3a', '#ffffff', 'FC LUMIÈRE'], ['#d8262f', '#ffffff', 'AS RIVIÈRE'], ['#101010', '#ffd23f', 'SPORT EN DIRECT'], ['#1d6b3a', '#ffffff', 'FAIR PLAY'],
    ['#ffffff', '#0b1b3a', 'BILLETTERIE EN LIGNE'], ['#13294b', '#5fd1ff', 'UHD · HDR · 50P'], ['#ff8a1f', '#101010', 'STADE MUNICIPAL'], ['#2b2b2b', '#ffffff', 'RESPECT'],
  ];
  const wSeg = 2048 / 8;
  ads.forEach((a, i) => {
    g.fillStyle = a[0]; g.fillRect(i * wSeg, 0, wSeg, 64);
    g.fillStyle = a[1]; g.font = 'bold 34px "Saira Condensed", "Arial Narrow", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(a[2], i * wSeg + wSeg / 2, 33);
  });
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return { tex: t, canvas: c, redraw: () => { ads.forEach((a, i) => { g.fillStyle = a[0]; g.fillRect(i * wSeg, 0, wSeg, 64); g.fillStyle = a[1]; g.font = 'bold 34px "Saira Condensed", "Arial Narrow", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(a[2], i * wSeg + wSeg / 2, 33); }); t.needsUpdate = true; } };
}

export function labelSprite(text, opts = {}) {
  const fs = opts.size || 44;
  const c = makeCanvas(512, 96); const g = c.getContext('2d');
  g.font = `600 ${fs}px "Saira Condensed", "Arial Narrow", sans-serif`;
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
// Construction des gradins (anneaux de trapèzes mitrés)
// ----------------------------------------------------------------------------------
function ringSurface(o1, y1, o2, y2, opts = {}) {
  const geos = [];
  const sides = [
    { ax: 'x', s: -1 }, { ax: 'x', s: 1 }, { ax: 'z', s: -1 }, { ax: 'z', s: 1 },
  ];
  const slope = Math.hypot(o2 - o1, y2 - y1);
  for (const sd of sides) {
    // côté de normale (axe, signe) ; on décrit le trapèze
    const corners = (o, y) => {
      const hx = BOWL.hx + o, hz = BOWL.hz + o;
      if (sd.ax === 'z') return [[-hx, y, sd.s * hz], [hx, y, sd.s * hz]];
      return [[sd.s * hx, y, -hz], [sd.s * hx, y, hz]];
    };
    let [a1, b1] = corners(o1, y1); let [a2, b2] = corners(o2, y2);
    const pieces = [];
    if (opts.tunnelCut && sd.ax === 'z' && sd.s < 0) {
      // découpe du tunnel : x ∈ [-5,5]
      const cut = 5;
      pieces.push([[a1, [-cut, y1, a1[2]]], [a2, [-cut, y2, a2[2]]]]);
      pieces.push([[[cut, y1, a1[2]], b1], [[cut, y2, a2[2]], b2]]);
      // partie au-dessus du tunnel (à partir de y = 4.6)
      const oc = o1 + (4.6 - y1) / (y2 - y1) * (o2 - o1);
      if (oc < o2) {
        const zc = -(BOWL.hz + oc);
        pieces.push([[[-cut, 4.6, zc], [cut, 4.6, zc]], [[-cut, y2, a2[2]], [cut, y2, a2[2]]]]);
      }
    } else pieces.push([[a1, b1], [a2, b2]]);
    for (const [[p0, p1], [p3, p2]] of pieces) {
      const len1 = Math.hypot(p1[0] - p0[0], p1[2] - p0[2]);
      const len2 = Math.hypot(p2[0] - p3[0], p2[2] - p3[2]);
      // orientation : face visible depuis le terrain (normale vers l'intérieur et le haut)
      let q;
      const u0 = (sd.ax === 'z' ? p0[0] : p0[2]);
      const uv = [[u0 / 2, 0], [(u0 + len1) / 2, 0], [(u0 + (len2 - len1) / 2 * 0 + len1) / 2, slope / 2], [u0 / 2, slope / 2]];
      const uvA = [[p0[0] / 2 + p0[2] / 2, 0], [p1[0] / 2 + p1[2] / 2, 0], [p2[0] / 2 + p2[2] / 2, slope / 2], [p3[0] / 2 + p3[2] / 2, slope / 2]];
      q = quadGeo(p0, p1, p2, p3, uvA);
      // vérifie l'orientation de la normale
      const n = q.attributes.normal;
      const toCenter = new THREE.Vector3(-p0[0], 0, -p0[2]).normalize();
      if (n.getX(0) * toCenter.x + n.getZ(0) * toCenter.z < 0 && n.getY(0) < 0.99) q = quadGeo(p0, p3, p2, p1, [uvA[0], uvA[3], uvA[2], uvA[1]]);
      geos.push(q);
    }
  }
  return mergeNonIndexed(geos);
}

// ----------------------------------------------------------------------------------
export function buildWorld(renderer) {
  const scene = new THREE.Scene();
  W.scene = scene;

  // --- ciel ---
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { uZen: { value: new THREE.Color(0.2, 0.42, 0.9) }, uHor: { value: new THREE.Color(0.7, 0.82, 1.0) }, uGround: { value: new THREE.Color(0.25, 0.25, 0.25) }, uI: { value: 2.0 } },
    vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 uZen, uHor, uGround; uniform float uI; varying vec3 vP;
      void main(){ float h = vP.y; vec3 c = h > 0.0 ? mix(uHor, uZen, pow(clamp(h,0.0,1.0), 0.6)) : mix(uHor, uGround, clamp(-h*6.0,0.0,1.0));
        gl_FragColor = vec4(c * uI, 1.0); }`,
  });
  W.sky = new THREE.Mesh(new THREE.SphereGeometry(1400, 32, 16), skyMat);
  W.sky.frustumCulled = false;
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
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), new THREE.MeshLambertMaterial({ color: 0x3b3e40 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; ground.receiveShadow = true;
  scene.add(ground);
  // pelouse autour (hors stade)
  const grassOut = new THREE.Mesh(new THREE.RingGeometry(260, 700, 48, 1), new THREE.MeshLambertMaterial({ color: 0x334d2c }));
  grassOut.rotation.x = -Math.PI / 2; grassOut.position.y = -0.01; scene.add(grassOut);

  // --- pelouse ---
  const pitch = new THREE.Mesh(new THREE.PlaneGeometry(122, 82), new THREE.MeshLambertMaterial({ map: pitchTexture(renderer) }));
  pitch.rotation.x = -Math.PI / 2; pitch.position.y = 0.0; pitch.receiveShadow = true;
  scene.add(pitch);

  // --- gradins ---
  const seatMat = new THREE.MeshLambertMaterial({ map: seatTexture(), side: THREE.DoubleSide });
  const lower = new THREE.Mesh(ringSurface(0, TIERS.lower.y1, 25, TIERS.lower.y2, { tunnelCut: true }), seatMat);
  const upper = new THREE.Mesh(ringSurface(29, TIERS.upper.y1, 52, TIERS.upper.y2), seatMat);
  for (const m of [lower, upper]) { m.castShadow = true; m.receiveShadow = true; scene.add(m); }

  // --- structure en béton (fusionnée) ---
  const B = new Builder();
  const concrete = 0x8d9196, darkC = 0x55595e, white = 0xd9dde0;
  const ringWalls = (o, y0, y1, color, thick = 0.4, opts = {}) => {
    const hx = BOWL.hx + o, hz = BOWL.hz + o, h = y1 - y0, yc = (y0 + y1) / 2;
    if (opts.cutMain) {
      const cw = opts.cutMain;
      const segW = hx - cw;
      B.box(segW, h, thick, -(cw + segW / 2), yc, -hz, color);
      B.box(segW, h, thick, (cw + segW / 2), yc, -hz, color);
    } else B.box(2 * hx, h, thick, 0, yc, -hz, color);
    B.box(2 * hx, h, thick, 0, yc, hz, color);
    B.box(thick, h, 2 * hz, -hx, yc, 0, color);
    B.box(thick, h, 2 * hz, hx, yc, 0, color);
  };
  ringWalls(-0.2, 0, TIERS.lower.y1, 0x2c3e66, 0.4, { cutMain: 5 }); // mur avant bas (bleu)
  // coursive (dalle) + fascia de la tribune haute
  {
    const o1 = 25, o2 = 29, y = TIERS.lower.y2;
    const g = ringSurface(o1, y, o2, y);
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: 0x7c8086, side: THREE.DoubleSide }));
    m.receiveShadow = true; m.castShadow = true; scene.add(m);
  }
  ringWalls(29, TIERS.lower.y2, TIERS.upper.y1, 0x1d2a44, 0.4); // fascia
  ringWalls(52, 0, 38.5, concrete, 0.8, { cutMain: 3.2 }); // façade
  // linteau au-dessus de l'entrée du couloir
  B.box(6.4, 34, 0.8, 0, 21.5, -(BOWL.hz + 52), concrete);
  // poteaux de façade
  for (let x = -110; x <= 110; x += 20) { B.box(1.2, 44, 1.2, x, 22, -(BOWL.hz + 53.2), white); B.box(1.2, 44, 1.2, x, 22, BOWL.hz + 53.2, white); }
  for (let z = -90; z <= 90; z += 20) { B.box(1.2, 44, 1.2, -(BOWL.hx + 53.2), 22, z, white); B.box(1.2, 44, 1.2, BOWL.hx + 53.2, 22, z, white); }
  // tunnel : murs et plafond
  const ty = 4.6;
  B.box(0.4, ty, 6.5, -5, ty / 2, -44.25, darkC); B.box(0.4, ty, 6.5, 5, ty / 2, -44.25, darkC);
  B.box(10.4, 0.4, 19, 0, ty + 0.2, -56.5, darkC);
  B.box(0.4, ty, 19, -5, ty / 2, -56.5, darkC); B.box(0.4, ty, 19, 5, ty / 2, -56.5, darkC);
  // remplissage latéral de la découpe sous gradins
  for (const s of [-1, 1]) {
    for (let k = 0; k < 6; k++) {
      const z0 = -41 - k * 4.2, oc = -z0 - 41 + 2.1; const h = standHeight(oc);
      if (h > ty) B.box(0.4, h - ty, 4.2, s * 5, ty + (h - ty) / 2, z0 - 2.1, concrete);
    }
  }
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
  // passerelle caméras principale (tribune principale)
  B.box(82, 0.25, 3.2, 0, 17.1, -(BOWL.hz + 27.8), 0x3c4148);
  for (let x = -40; x <= 40; x += 2) B.box(0.05, 0.5, 0.05, x, 17.45, -(BOWL.hz + 26.25), 0xbfc4c9);
  B.box(82, 0.05, 0.05, 0, 17.7, -(BOWL.hz + 26.25), 0xbfc4c9);
  for (let x = -40; x <= 40; x += 10) B.rod([x, 17.1, -(BOWL.hz + 27)], [x, 33, -(BOWL.hz + 32)], 0.08, 0x9aa0a6);
  // cabines commentateurs
  for (let i = 0; i < 4; i++) {
    const x = 9 + i * 3;
    B.box(2.6, 0.9, 0.7, x, TIERS.lower.y2 + 0.45, -(BOWL.hz + 25.9), 0x30353b);
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

  // --- toit ---
  {
    const o1 = 8, o2 = 54, y1 = 40, y2 = 43;
    const top = ringSurface(o1, y1 + 1.2, o2, y2 + 1.2);
    const bot = ringSurface(o1, y1, o2, y2);
    const roofMat = new THREE.MeshLambertMaterial({ color: 0xe4e7ea, side: THREE.DoubleSide });
    for (const g of [top, bot]) { const m = new THREE.Mesh(g, roofMat); m.castShadow = true; m.receiveShadow = false; scene.add(m); W.roofMeshes.push(m); }
    // rive intérieure
    const B2 = new Builder();
    const hx = BOWL.hx + o1, hz = BOWL.hz + o1;
    B2.box(2 * hx, 1.4, 0.3, 0, y1 + 0.6, -hz, 0xb9bec4); B2.box(2 * hx, 1.4, 0.3, 0, y1 + 0.6, hz, 0xb9bec4);
    B2.box(0.3, 1.4, 2 * hz, -hx, y1 + 0.6, 0, 0xb9bec4); B2.box(0.3, 1.4, 2 * hz, hx, y1 + 0.6, 0, 0xb9bec4);
    const edge = B2.mesh(new THREE.MeshLambertMaterial({ vertexColors: true })); edge.castShadow = true; scene.add(edge); W.roofMeshes.push(edge);
    // projecteurs LED sous la rive
    const B3 = new Builder();
    for (let x = -hx + 4; x <= hx - 4; x += 3.2) { B3.box(1.4, 0.5, 0.8, x, y1 - 0.3, -hz + 0.6, 0xffffff); B3.box(1.4, 0.5, 0.8, x, y1 - 0.3, hz - 0.6, 0xffffff); }
    for (let z = -hz + 4; z <= hz - 4; z += 3.2) { B3.box(0.8, 0.5, 1.4, -hx + 0.6, y1 - 0.3, z, 0xffffff); B3.box(0.8, 0.5, 1.4, hx - 0.6, y1 - 0.3, z, 0xffffff); }
    W.floodMat = new THREE.MeshBasicMaterial({ color: 0x606468, toneMapped: true });
    const fl = new THREE.Mesh(B3.build(), W.floodMat); scene.add(fl); W.roofMeshes.push(fl);
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

  // --- écran géant (affiche la sortie AUX "écran géant") ---
  {
    const mat = screenMaterial(null, { gain: 1.1 });
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(14.4, 8.1), mat);
    scr.position.set(BOWL.hx + 11, 33.5, 0); scr.rotation.y = -Math.PI / 2;
    scene.add(scr); W.giantScreen = scr; W.screens.push(mat);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.6, 9, 15.2), new THREE.MeshLambertMaterial({ color: 0x1a1d21 }));
    frame.position.set(BOWL.hx + 11.35, 33.5, 0); scene.add(frame);
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

  // villes alentours
  {
    const Bv = new Builder(); const r = mulberry32(11);
    for (let i = 0; i < 90; i++) {
      const a = r() * Math.PI * 2, d = 330 + r() * 380;
      const w = 20 + r() * 40, h = 8 + r() * 45, dd = 20 + r() * 40;
      Bv.box(w, h, dd, Math.cos(a) * d, h / 2, Math.sin(a) * d, r() < 0.5 ? 0x7d8288 : 0x9a8f86, a);
    }
    const city = Bv.mesh(new THREE.MeshLambertMaterial({ vertexColors: true })); scene.add(city);
  }

  // signalétique extérieure
  {
    const sign = (text, w, h, x, y, z, rotY, bg = '#13294b', fg = '#ffffff', fs = 64) => {
      const c = makeCanvas(1024, Math.round(1024 * h / w)); const g = c.getContext('2d');
      g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height); g.fillStyle = fg; g.font = `700 ${fs}px "Saira Condensed", "Arial Narrow", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      text.split('\n').forEach((l, i, a) => g.fillText(l, 512, c.height / 2 + (i - (a.length - 1) / 2) * fs * 1.1));
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ map: t }));
      m.position.set(x, y, z); m.rotation.y = rotY; scene.add(m); return m;
    };
    const fz = -(BOWL.hz + 52) - 0.45;
    sign('ACCÈS TERRAIN · TUNNEL · LOCAL TECHNIQUE TV', 12, 1.4, 0, 5.2, fz, Math.PI, '#ffb020', '#15100a', 70);
    sign('STADE MUNICIPAL', 60, 7, -45, 30, fz, Math.PI, '#e9ecef', '#13294b', 150);
    sign('STADE MUNICIPAL', 60, 7, 0, 30, BOWL.hz + 52 + 0.45, 0, '#e9ecef', '#13294b', 150);
    sign('VESTIAIRE · FC LUMIÈRE', 5, 0.8, 3.0, 2.9, -78.5, -Math.PI / 2, '#1f4fd6', '#ffffff', 80);
    sign('LOCAL TECHNIQUE TV\nPRÉ-CÂBLAGE', 5, 1.2, -2.95, 2.8, -86.5, Math.PI / 2, '#ffd23f', '#15100a', 70);
    sign('COMPOUND TV · CARS RÉGIE', 10, 1.2, -18, 3.4, -96.6, Math.PI, '#ffb020', '#15100a', 70);
  }

  // points d'intérêt du stade
  W.interactables.push({ id: 'localtv', pos: new THREE.Vector3(-9.5, 1.5, -86.5), r: 5, label: 'Local technique TV', info: 'localtv' });
  W.interactables.push({ id: 'comm', pos: new THREE.Vector3(12, 14.6, -67), r: 5, label: 'Cabine commentateurs', info: 'commentateurs' });
  W.interactables.push({ id: 'var', pos: new THREE.Vector3(0, 1.4, -37.6), r: 2.5, label: 'Table du 4e arbitre / VAR', info: 'var' });

  // commentateurs (statiques)
  {
    const Bc = new Builder();
    for (let i = 0; i < 2; i++) {
      const x = 11 + i * 1.1, z = -(BOWL.hz + 26.5), y = TIERS.lower.y2;
      Bc.box(0.45, 0.7, 0.3, x, y + 0.9, z, 0x2b3a55); Bc.sphere(0.13, x, y + 1.42, z, 0xd9a07a); Bc.box(0.3, 0.06, 0.06, x, y + 1.42, z + 0.13, 0x111111);
      Bc.box(0.5, 0.45, 0.5, x, y + 0.23, z - 0.05, 0x111111);
    }
    const cm = Bc.mesh(new THREE.MeshLambertMaterial({ vertexColors: true })); scene.add(cm);
  }

  return scene;
}

function buildCrowd(scene) {
  const atlas = crowdAtlas();
  const mat = new THREE.ShaderMaterial({
    uniforms: { map: { value: atlas }, uTime: { value: 0 }, uLight: { value: 0.4 }, uExcite: { value: new THREE.Vector2(0.1, 0.1) } },
    vertexShader: `
      attribute float aSeed; attribute float aSide;
      uniform float uTime; uniform vec2 uExcite;
      varying vec2 vUv; varying vec3 vCol; varying float vSeed;
      void main(){
        vUv = vec2((uv.x + floor(aSeed * 4.0)) * 0.25, uv.y);
        vCol = instanceColor; vSeed = aSeed;
        vec3 p = position;
        float ex = aSide > 0.5 ? uExcite.y : uExcite.x;
        p.y += max(0.0, sin(uTime * (7.0 + aSeed * 4.0) + aSeed * 40.0)) * 0.22 * ex;
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `
      uniform sampler2D map; uniform float uLight; varying vec2 vUv; varying vec3 vCol; varying float vSeed;
      void main(){
        vec4 t = texture2D(map, vUv);
        if (t.a < 0.45) discard;
        vec3 skin = mix(vec3(0.85,0.6,0.45), vec3(0.32,0.2,0.13), fract(vSeed*13.7));
        vec3 hair = mix(vec3(0.05,0.04,0.03), vec3(0.45,0.32,0.18), step(0.75, fract(vSeed*7.3)));
        vec3 c = vCol * t.r + skin * t.g + hair * t.b;
        c /= max(0.001, t.r + t.g + t.b);
        gl_FragColor = vec4(pow(c, vec3(2.2)) * uLight, 1.0);
      }`,
    side: THREE.DoubleSide,
  });
  W.crowdMat = mat;
  const quad = new THREE.PlaneGeometry(1.7, 1.25); quad.translate(0, 0.5, 0);
  const placements = [];
  const r = mulberry32(99);
  const density = S.lite ? 0.15 : S.quality === 'basse' ? 0.5 : 1;
  const addTier = (o1, o2, rowD) => {
    for (let o = o1 + 0.6; o < o2 - 0.3; o += rowD) {
      const y = standHeight(o);
      const hx = BOWL.hx + o, hz = BOWL.hz + o;
      // 4 côtés
      const sides = [
        { len: 2 * hx, f: (t) => [-hx + t, -hz], rot: 0, side: 0, main: true },
        { len: 2 * hx, f: (t) => [-hx + t, hz], rot: Math.PI, side: 1 },
        { len: 2 * hz, f: (t) => [-hx, -hz + t], rot: -Math.PI / 2, side: 0 },
        { len: 2 * hz, f: (t) => [hx, -hz + t], rot: Math.PI / 2, side: 1 },
      ];
      for (const sd of sides) {
        for (let t = 0.9; t < sd.len - 0.9; t += 1.7) {
          if (r() > 0.86 * density) continue;
          const [x, z] = sd.f(t);
          // couloirs (escaliers) tous les 22 m
          const u = sd === sides[0] || sd === sides[1] ? x : z;
          if (Math.abs(((u % 22) + 22) % 22 - 11) < 0.9) continue;
          if (sd.main && Math.abs(x) < 5.5 && o < 25) continue; // tunnel
          if (sd.main && o > 25.5 && o < 29.5) continue;
          // miter : éviter les doublons dans les coins
          if ((sd.side === 0 || sd.side === 1) && (sd === sides[0] || sd === sides[1])) { if (Math.abs(x) > hx - (o) * 0) { } }
          const cx = Math.abs(x) - BOWL.hx, cz = Math.abs(z) - BOWL.hz;
          if ((sd === sides[0] || sd === sides[1]) && cx > cz + 0.01 && Math.abs(x) > BOWL.hx) continue;
          if ((sd === sides[2] || sd === sides[3]) && cz >= cx && Math.abs(z) > BOWL.hz) continue;
          placements.push({ x, y, z, rot: sd.rot, side: (x > 0 ? 1 : 0) });
        }
      }
    }
  };
  addTier(0, 25, 0.85);
  addTier(29, 52, 0.85);
  const n = placements.length;
  const mesh = new THREE.InstancedMesh(quad, mat, n);
  const seeds = new Float32Array(n), side = new Float32Array(n);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color();
  const palette = [0x1f4fd6, 0x1f4fd6, 0x1f4fd6, 0xffffff, 0xd8262f, 0x222222, 0x8a8f99, 0x2b6e3f, 0xf2c014];
  placements.forEach((p, i) => {
    q.setFromEuler(new THREE.Euler(0, p.rot, 0));
    m.compose(new THREE.Vector3(p.x, p.y, p.z), q, new THREE.Vector3(1, 1, 1));
    mesh.setMatrixAt(i, m);
    seeds[i] = r();
    side[i] = p.side;
    let c = palette[Math.floor(r() * palette.length)];
    if (p.x > 40 && r() < 0.6) c = 0xd8262f; // virage visiteur
    col.setHex(c); mesh.setColorAt(i, col);
  });
  quad.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
  quad.setAttribute('aSide', new THREE.InstancedBufferAttribute(side, 1));
  mesh.frustumCulled = false;
  scene.add(mesh);
  W.crowd = mesh;
}

function buildCompound(scene) {
  const g = new THREE.Group();
  const B = new Builder();
  // marquages au sol du compound
  const asphalt = new THREE.Mesh(new THREE.PlaneGeometry(130, 80), new THREE.MeshLambertMaterial({ color: 0x2c2f31 }));
  asphalt.rotation.x = -Math.PI / 2; asphalt.position.set(-5, 0.0, -135); asphalt.receiveShadow = true; g.add(asphalt);
  for (let x = -60; x <= 50; x += 10) B.box(0.15, 0.02, 5, x, 0.02, -100, 0xd9d9d9);
  // barrières
  for (let x = -68; x <= 58; x += 2.5) B.box(2.4, 1.1, 0.05, x, 0.55, -96, 0x9aa0a6);

  // --- car régie (extérieur) ---
  const T = TRUCK;
  const body = 0xf2f4f6, accent = 0x1c2733;
  B.box(T.len, 3.0, 2.55, T.cx, T.floor + 1.5 + 0.05, T.cz, body);
  // extensions déployées
  B.box(13.5, 2.5, (T.wid - 2.55) / 2 + 0.02, T.cx + 0.5, T.floor + 1.35, T.z0 + (T.wid - 2.55) / 4, 0xe6e9ec);
  B.box(13.5, 2.5, (T.wid - 2.55) / 2 + 0.02, T.cx + 0.5, T.floor + 1.35, T.z1 - (T.wid - 2.55) / 4, 0xe6e9ec);
  // bandeau décoratif
  B.box(T.len + 0.02, 0.35, 2.6, T.cx, T.floor + 2.65, T.cz, accent);
  B.box(13.52, 0.25, T.wid + 0.02, T.cx + 0.5, T.floor + 0.35, T.cz, 0xff8a1f);
  // châssis, roues
  B.box(T.len - 1, 0.5, 2.3, T.cx, 0.85, T.cz, 0x2a2d30);
  for (const dx of [5.2, 6.6, 8.0]) for (const s of [-1, 1]) B.cyl(0.5, 0.5, 0.35, T.cx + dx, 0.5, T.cz + s * 1.05, 0x111111, 16, Math.PI / 2);
  // stabilisateurs
  for (const dx of [-7, 3]) for (const s of [-1, 1]) B.box(0.25, 1.1, 0.25, T.cx + dx, 0.55, T.cz + s * 1.3, 0xffcc00);
  // tracteur
  B.box(3.0, 2.9, 2.5, T.x0 - 2.0, 1.95, T.cz, 0x2e3a4a); B.box(1.5, 1.6, 2.5, T.x0 - 3.9, 1.3, T.cz, 0x2e3a4a);
  B.box(0.05, 1.0, 2.0, T.x0 - 3.5, 2.6, T.cz, 0x8fb7d9);
  for (const dx of [-3.3, -1.0]) for (const s of [-1, 1]) B.cyl(0.5, 0.5, 0.35, T.x0 + dx, 0.5, T.cz + s * 1.05, 0x111111, 16, Math.PI / 2);
  // porte et marches
  B.box(T.doorX1 - T.doorX0, 2.05, 0.06, (T.doorX0 + T.doorX1) / 2, T.floor + 1.02, T.z1 + 0.02, 0x0d1013);
  for (let i = 0; i < 4; i++) B.box(1.3, 0.08, 0.45, (T.doorX0 + T.doorX1) / 2, T.floor * (i + 1) / 4 - 0.04, T.z1 + 1.8 - i * 0.45 - 0.22, 0x8a8f94);
  B.box(0.04, 1.0, 1.8, T.doorX0 - 0.2, T.floor + 0.2, T.z1 + 0.9, 0xbfc4c9);
  // pied de car (panneau de raccordement)
  B.box(3.0, 1.1, 0.12, T.x1 - 2.3, 1.25, T.z1 + 0.06, 0x2b3036);
  for (let i = 0; i < 16; i++) B.cyl(0.05, 0.05, 0.08, T.x1 - 3.6 + (i % 8) * 0.34, 1.5 - Math.floor(i / 8) * 0.25, T.z1 + 0.13, 0xff8a1f, 8, Math.PI / 2);
  for (let i = 0; i < 8; i++) B.cyl(0.03, 0.03, 0.06, T.x1 - 3.6 + i * 0.34, 0.95, T.z1 + 0.13, 0xd8d8d8, 6, Math.PI / 2);
  // climatisation sur le toit
  B.box(2.0, 0.5, 1.6, T.cx - 5, T.floor + 3.3, T.cz, 0xcfd3d6); B.box(2.0, 0.5, 1.6, T.cx + 4, T.floor + 3.3, T.cz, 0xcfd3d6);

  // --- groupe électrogène ---
  B.box(9, 3, 2.5, 18, 1.5 + 0.6, -125, 0x2f6a3f); B.box(9, 0.6, 2.3, 18, 0.5, -125, 0x2a2d30);
  B.box(0.6, 1, 0.6, 21, 3.9, -125, 0x444444);
  // câbles d'énergie au sol
  B.box(26, 0.06, 0.15, 3.5, 0.03, -121, 0x111111);
  // --- camion satellite (DSNG) ---
  B.box(7, 2.8, 2.5, -48, 1.4 + 0.6, -128, 0xe9e9e9); B.box(2.3, 2.4, 2.5, -53, 1.6, -128, 0xe9e9e9);
  B.cyl(0.15, 0.15, 1.5, -47, 3.9, -128, 0x777777);
  // --- bungalows production ---
  for (let i = 0; i < 3; i++) B.box(6, 2.6, 2.4, 22 + i * 6.5, 1.3, -150, 0xd6d0c4);
  // chemin de câbles (passe-câbles) vers la façade
  B.box(0.6, 0.06, 20, 2.0, 0.03, -105.5, 0x6b5a1e);
  B.box(16, 0.06, 0.6, -6, 0.03, -115, 0x6b5a1e);
  const mesh = B.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }));
  mesh.castShadow = true; mesh.receiveShadow = true; g.add(mesh);
  // parabole satellite
  const dish = new THREE.Mesh(new THREE.SphereGeometry(1.4, 20, 10, 0, Math.PI * 2, 0, 0.9), new THREE.MeshLambertMaterial({ color: 0xf2f2f2, side: THREE.DoubleSide }));
  dish.position.set(-47, 5.2, -128); dish.rotation.set(-0.9, 0.6, 0); g.add(dish);
  // inscription du car
  const lab = makeCanvas(1024, 160); const lg = lab.getContext('2d');
  lg.fillStyle = 'rgba(0,0,0,0)'; lg.clearRect(0, 0, 1024, 160);
  const lt = new THREE.CanvasTexture(lab); lt.colorSpace = THREE.SRGBColorSpace;
  const signMat = new THREE.MeshLambertMaterial({ map: lt, transparent: true });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.4), signMat); sign.position.set(T.cx - 3, T.floor + 2.1, T.z1 + 0.03); g.add(sign);
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
// Éclairage
// ----------------------------------------------------------------------------------
export function applyLighting(key) {
  S.lighting = key;
  const sun = W.sun, f2 = W.flood2, hemi = W.hemi, sky = W.sky.material.uniforms;
  const setDir = (light, azDeg, elDeg, dist = 300) => {
    const az = azDeg * Math.PI / 180, el = elDeg * Math.PI / 180;
    light.position.set(Math.sin(az) * Math.cos(el) * dist, Math.sin(el) * dist, -Math.cos(az) * Math.cos(el) * dist);
    light.target.position.set(0, 0, 0);
  };
  f2.intensity = 0; sun.castShadow = true;
  if (key === 'jour') {
    setDir(sun, -30, 35); sun.color.setRGB(...kelvinRGBNorm(5600)); sun.intensity = 3.2;
    hemi.color.setRGB(0.55, 0.66, 0.9); hemi.groundColor.setRGB(0.32, 0.34, 0.26); hemi.intensity = 1.0;
    sky.uZen.value.setRGB(0.18, 0.4, 0.95); sky.uHor.value.setRGB(0.68, 0.8, 1.0); sky.uI.value = 1.6;
    W.boardsMat.uniforms.uI.value = 1.4; W.crowdMat.uniforms.uLight.value = 0.42; W.floodMat.color.setHex(0x55595d);
    S.sceneCCT = 5600; S.eyeExposure = 0.9;
  } else if (key === 'fin') {
    setDir(sun, -40, 12); sun.color.setRGB(...kelvinRGBNorm(3600)); sun.intensity = 2.4;
    hemi.color.setRGB(0.5, 0.48, 0.6); hemi.groundColor.setRGB(0.25, 0.2, 0.15); hemi.intensity = 0.55;
    sky.uZen.value.setRGB(0.15, 0.25, 0.6); sky.uHor.value.setRGB(1.0, 0.62, 0.35); sky.uI.value = 1.0;
    W.boardsMat.uniforms.uI.value = 0.9; W.crowdMat.uniforms.uLight.value = 0.22; W.floodMat.color.setHex(0x8a8c90);
    S.sceneCCT = 3600; S.eyeExposure = 1.5;
  } else if (key === 'couvert') {
    setDir(sun, -20, 60); sun.color.setRGB(...kelvinRGBNorm(6500)); sun.intensity = 0.35; sun.castShadow = true;
    hemi.color.setRGB(0.78, 0.82, 0.9); hemi.groundColor.setRGB(0.35, 0.36, 0.33); hemi.intensity = 0.9;
    sky.uZen.value.setRGB(0.6, 0.63, 0.68); sky.uHor.value.setRGB(0.78, 0.8, 0.83); sky.uI.value = 0.75;
    W.boardsMat.uniforms.uI.value = 0.7; W.crowdMat.uniforms.uLight.value = 0.2; W.floodMat.color.setHex(0x55595d);
    S.sceneCCT = 6500; S.eyeExposure = 2.6;
  } else { // nuit
    setDir(sun, 0, 58); sun.color.setRGB(...kelvinRGBNorm(5700)); sun.intensity = 0.06;
    setDir(f2, 180, 52); f2.color.setRGB(...kelvinRGBNorm(5700)); f2.intensity = 0.045;
    hemi.color.setRGB(0.6, 0.65, 0.8); hemi.groundColor.setRGB(0.2, 0.22, 0.2); hemi.intensity = 0.012;
    sky.uZen.value.setRGB(0.01, 0.015, 0.035); sky.uHor.value.setRGB(0.05, 0.05, 0.07); sky.uI.value = 0.06;
    W.boardsMat.uniforms.uI.value = 0.09; W.crowdMat.uniforms.uLight.value = 0.012; W.floodMat.color.setRGB(40, 40, 40);
    S.sceneCCT = 5700; S.eyeExposure = 24;
  }
  if (W.netMat) W.netMat.color.setScalar(key === 'nuit' ? 0.06 : key === 'fin' ? 0.5 : key === 'couvert' ? 0.4 : 0.85);
  // teinte de la source en fonction de la température de couleur
  const tint = kelvinRGBNorm(S.sceneCCT);
  S.illum = tint;
}

export function updateWorld(t) {
  if (W.boardsMat) W.boardsMat.uniforms.uOff.value = Math.floor(t / 8) * (1 / 8) + (t % 8 < 0.4 ? (t % 8) / 0.4 * 0.0 : 0);
  if (W.crowdMat) W.crowdMat.uniforms.uTime.value = t;
}

// inscription sur le flanc du car : nom donné par le formateur (sinon « Car régie ») et format
export function paintTruckSign(name) {
  if (!W.truckSign) return;
  const { canvas, tex } = W.truckSign; const g = canvas.getContext('2d');
  g.clearRect(0, 0, 1024, 160);
  const txt = ((name || 'Car régie') + ' · ' + (S.format === 'UHD' ? 'UHD' : 'HD')).toUpperCase().slice(0, 32);
  let size = 96; g.font = `700 ${size}px "Saira Condensed", "Arial Narrow", sans-serif`;
  while (g.measureText(txt).width > 990 && size > 40) { size -= 4; g.font = `700 ${size}px "Saira Condensed", "Arial Narrow", sans-serif`; }
  g.fillStyle = '#1c2733'; g.fillText(txt, 20, 110);
  tex.needsUpdate = true;
}

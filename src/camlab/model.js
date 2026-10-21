// @ts-check
import * as THREE from 'three';
import { clamp, lerp, mulberry32 } from '../util.js';
import { focusPos, zoomPos } from './optics.js';

// ----------------------------------------------------------------------------------
// La caméra du module, construite dans le code d'après les photos de la caméra de l'établissement :
// corps type Sony HXC-FB80, zoom Fujinon ZA12x4.5BERD et son pare-soleil, viseur 7", tête fluide
// sur trépied, manches avec commandes de zoom et de point. Pas de modèle acheté : des volumes
// simples, extrudés ou tournés, et des sérigraphies dessinées sur des textures.
// Repère de la caméra : X vers l'avant (axe optique), Y vers le haut, Z vers la droite du cadreur ;
// origine sur l'axe, à la face d'appui de la monture B4. Mètres. Les capteurs sont 48 mm derrière.
// Chaque pièce porte `userData.point` : la pastille qu'elle ouvre quand on clique dessus.
// ----------------------------------------------------------------------------------

const FONT = '"Archivo Narrow", "Arial Narrow", sans-serif';
/** hauteur de l'axe optique au-dessus du sol (m) */
export const AXIS_H = 1.4;
/** plan des capteurs, derrière la face de la monture (m) */
export const FOCAL_PLANE = -0.048;
/** angle (autour de l'axe) où l'on lit les échelles : côté gauche, un peu vers le haut */
const TH_IDX = Math.PI + 0.25;

// ---------------- outils de construction ----------------
const std = (color, roughness, metalness = 0, o = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness, ...o });

/** grain de peinture (texture de relief) */
function grain(seed, repeat) {
  const n = 256, c = document.createElement('canvas'); c.width = c.height = n;
  const g = c.getContext('2d'), img = g.createImageData(n, n), r = mulberry32(seed);
  for (let i = 0; i < n * n; i++) { const v = 128 + (r() + r() - 1) * 70; img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255; }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); return t;
}

/** polygone aux coins arrondis : points [x, y], rayon commun ou un par coin */
function roundPoly(pts, r, path = new THREE.Shape()) {
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n];
    const rr = Array.isArray(r) ? r[i] : r;
    const d1 = Math.hypot(p0[0] - p1[0], p0[1] - p1[1]), d2 = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const k1 = Math.min(rr, d1 / 2) / d1, k2 = Math.min(rr, d2 / 2) / d2;
    const a = [p1[0] + (p0[0] - p1[0]) * k1, p1[1] + (p0[1] - p1[1]) * k1];
    const b = [p1[0] + (p2[0] - p1[0]) * k2, p1[1] + (p2[1] - p1[1]) * k2];
    if (i === 0) path.moveTo(a[0], a[1]); else path.lineTo(a[0], a[1]);
    path.quadraticCurveTo(p1[0], p1[1], b[0], b[1]);
  }
  path.closePath(); return path;
}
const rrect = (w, h, r, cx = 0, cy = 0) => roundPoly([[cx + w / 2, cy - h / 2], [cx + w / 2, cy + h / 2], [cx - w / 2, cy + h / 2], [cx - w / 2, cy - h / 2]], r);

/** profil (plan XY) extrudé selon Z, centré sur z = 0, arêtes arrondies */
function slab(shape, depth, bevel = 0.003, seg = 3) {
  const d = Math.max(1e-4, depth - 2 * bevel);
  const g = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: seg, curveSegments: 10 });
  g.translate(0, 0, -d / 2); return g;
}
/** cylindre d'axe X (rayon arrière, rayon avant, longueur) */
function cylX(r0, r1, len, seg = 56, open = false) { const g = new THREE.CylinderGeometry(r1, r0, len, seg, 1, open); g.rotateZ(-Math.PI / 2); return g; }
/** cylindre d'axe Z */
function cylZ(r, len, seg = 32) { const g = new THREE.CylinderGeometry(r, r, len, seg); g.rotateX(Math.PI / 2); return g; }
/** cylindre d'axe Y */
const cylY = (r, len, seg = 32) => new THREE.CylinderGeometry(r, r, len, seg);
/** bague moletée d'axe X : nervures en relief tout autour */
function knurl(r, len, ribs, depth) {
  const g = new THREE.CylinderGeometry(r, r, len, ribs * 4, 1, false);
  const p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i); const rho = Math.hypot(v.x, v.z); if (rho < r * 0.98) continue;
    const k = clamp(Math.cos(ribs * Math.atan2(v.x, v.z)) * 2.2, -1, 1) * 0.5 + 0.5;
    const nr = r + depth * k; p.setXYZ(i, v.x / rho * nr, v.y, v.z / rho * nr);
  }
  g.computeVertexNormals(); g.rotateZ(-Math.PI / 2); return g;
}
/** surface entre deux contours fermés de même nombre de points ([z, y]), aux abscisses xa et xb */
function loft(A, xa, B, xb) {
  const pos = [], idx = [], n = A.length;
  for (let i = 0; i < n; i++) pos.push(xa, A[i][1], A[i][0], xb, B[i][1], B[i][0]);
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; idx.push(2 * i, 2 * j, 2 * i + 1, 2 * i + 1, 2 * j, 2 * j + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
/** contour d'un rectangle arrondi ([z, y]), n points par coin */
function rrOutline(w, h, r, n = 7) {
  const pts = [];
  for (const [cx, cy, a0] of [[w / 2 - r, h / 2 - r, 0], [-(w / 2 - r), h / 2 - r, Math.PI / 2], [-(w / 2 - r), -(h / 2 - r), Math.PI], [w / 2 - r, -(h / 2 - r), 1.5 * Math.PI]]) {
    for (let i = 0; i <= n; i++) { const a = a0 + i / n * Math.PI / 2; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  }
  return pts;
}

/** un objet : position, rotation, parent, pastille */
function put(obj, pos, rot, parent, point) {
  if (pos) obj.position.set(pos[0], pos[1], pos[2]);
  if (rot) obj.rotation.set(rot[0], rot[1], rot[2]);
  if (point) obj.userData.point = point;
  obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  if (parent) parent.add(obj);
  return obj;
}
const mesh = (geo, mat, pos, rot, parent, point) => put(new THREE.Mesh(geo, mat), pos, rot, parent, point);

// ---------------- sérigraphies ----------------
/**
 * texture dessinée : w × h mètres, k pixels par mètre. draw(g, X, Y, k) : X et Y convertissent
 * des mètres (origine au centre, Y vers le haut) en pixels.
 */
function paint(w, h, k, draw) {
  const W = Math.min(2048, Math.ceil(w * k)), H = Math.min(2048, Math.ceil(h * k));
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'); const kx = W / w, ky = H / h;
  draw(g, (x) => (x + w / 2) * kx, (y) => (h / 2 - y) * ky, kx);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function txt(g, s, x, y, size, o = {}) {
  g.font = `${o.weight || 600} ${size}px ${o.font || FONT}`; g.fillStyle = o.color || '#e8e9e2';
  g.textAlign = o.align || 'center'; g.textBaseline = o.base || 'middle'; g.fillText(s, x, y);
}
/** sérigraphie posée sur une face : un plan transparent, orienté selon `face` */
function decal(w, h, draw, face, k = 7000) {
  const m = new THREE.MeshStandardMaterial({ map: paint(w, h, k, draw), transparent: true, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, depthWrite: false });
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
  const R = { '+z': [0, 0, 0], '-z': [0, Math.PI, 0], '+x': [0, Math.PI / 2, 0], '-x': [0, -Math.PI / 2, 0], '+y': [-Math.PI / 2, 0, 0], '-y': [Math.PI / 2, 0, 0] }[face];
  p.rotation.set(R[0], R[1], R[2]); p.renderOrder = 2; return p;
}
/** abscisse sur la texture d'un cylindre d'axe X pour l'angle th (0 : côté droit, π/2 : dessous, π : gauche) */
const uOf = (th, W) => (((th % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) / (2 * Math.PI) * W;

/**
 * bague graduée d'axe X : rayon r, de x0 à x1. marks : [texte, position 0–1, couleur, rangée 0–1
 * (0 = avant)]. span : rotation de la bague d'un bout à l'autre (rad). knurlRibs : moletage à l'arrière.
 */
function scaleRing({ r, x0, x1, marks, span, base = '#141516', knurlFrom = null, ribs = 60, size = 0.0042, warp = (p) => p }) {
  // graduations sur la partie arrière (x0 → knurlFrom), moletage sur la partie avant (knurlFrom → x1)
  const sLen = (knurlFrom == null ? x1 : knurlFrom) - x0, k = 9000, W = Math.min(2048, Math.ceil(2 * Math.PI * r * k)), H = Math.ceil(sLen * k);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'); g.fillStyle = base; g.fillRect(0, 0, W, H);
  const px = W / (2 * Math.PI * r);
  for (const [label, p, color, row] of marks) {
    const th = TH_IDX - warp(p) * span, x = uOf(th, W), y = (0.18 + row * 0.64) * H;
    txt(g, label, x, y, size * px, { color, weight: 600 });
  }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const grp = new THREE.Group();
  mesh(cylX(r, r, sLen, 96), std(0xffffff, 0.5, 0.1, { map: tex }), [x0 + sLen / 2, 0, 0], null, grp);
  if (knurlFrom != null) mesh(knurl(r, x1 - knurlFrom, ribs, 0.0011), std(0x121314, 0.55, 0.1), [(knurlFrom + x1) / 2, 0, 0], null, grp);
  grp.userData.set = (p) => { grp.rotation.x = warp(clamp(p, 0, 1.2)) * span; };
  return grp;
}
/** bague fixe avec le repère blanc de lecture */
function indexBand(r, x0, x1, color = 0x17181a) {
  const len = x1 - x0;
  const tex = paint(2 * Math.PI * r, len, 9000, (g, X, Y, k) => {
    g.fillStyle = '#' + new THREE.Color(color).getHexString(); g.fillRect(0, 0, 99999, 99999);
    const W = 2 * Math.PI * r * k; g.fillStyle = '#e8e8e0'; g.fillRect(uOf(TH_IDX, W) - 0.0004 * k, 0, 0.0008 * k, len * k);
  });
  return new THREE.Mesh(cylX(r, r, len, 96), std(0xffffff, 0.5, 0.15, { map: tex }));
}

// ---------------- matières ----------------
export function makeMaterials() {
  const g1 = grain(11, 14), g2 = grain(23, 14);
  return {
    body: std(0x1d1e20, 0.72, 0.08, { bumpMap: g1, bumpScale: 0.35 }),
    cover: std(0x202224, 0.68, 0.08, { bumpMap: g2, bumpScale: 0.35 }),
    pad: std(0x2e3033, 0.7, 0.05, { bumpMap: g2, bumpScale: 0.3 }),
    handle: std(0x47494d, 0.62, 0.1, { bumpMap: g1, bumpScale: 0.25 }),
    dark: std(0x161719, 0.6, 0.1),
    black: std(0x0c0d0e, 0.5, 0.1),
    rubber: std(0x0f1011, 0.88, 0),
    lens: std(0x18191b, 0.42, 0.25),
    lensGrey: std(0x34363a, 0.5, 0.25),
    hood: std(0x3e4145, 0.55, 0.05, { side: THREE.DoubleSide }),
    hoodIn: std(0x101112, 0.85, 0, { side: THREE.DoubleSide }),
    metal: std(0x9a9da2, 0.32, 0.9),
    metalDark: std(0x3b3d41, 0.38, 0.85),
    chrome: std(0xd8dade, 0.15, 1),
    red: std(0xc8261d, 0.45, 0.1),
    orange: std(0xe0731c, 0.5, 0.1),
    green: std(0x2faa55, 0.45, 0.05),
    blue: std(0x2d7fd6, 0.45, 0.1),
    yellow: std(0xe7c62b, 0.6, 0),
    vf: std(0x1f2123, 0.65, 0.08, { bumpMap: g1, bumpScale: 0.3 }),
    tally: std(0xb9bcbf, 0.35, 0, { emissive: 0x000000 }),
    screenOff: std(0x050607, 0.15, 0.2),
    carbon: std(0x141516, 0.45, 0.3),
    alu: std(0x8d9196, 0.4, 0.8),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x0b0e15, roughness: 0.03, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02, iridescence: 1, iridescenceIOR: 1.35, iridescenceThicknessRange: [180, 420], envMapIntensity: 1.4 }),
    cable: std(0x141415, 0.6, 0),
    cableGreen: std(0x7fcf3a, 0.5, 0),
  };
}

// =================================================================================
// L'objectif : Fujinon ZA12x4.5BERD (4,5–54 mm, doubleur ×2), avec sa poignée de servo
// =================================================================================
function buildLens(M) {
  const lens = new THREE.Group(); lens.name = 'objectif';
  const barrel = new THREE.Group(); barrel.name = 'barillet'; lens.add(barrel);
  const rings = {};
  // monture et bague de tirage (F.f), à l'arrière
  mesh(cylX(0.033, 0.033, 0.007), M.metalDark, [0.0035, 0, 0], null, barrel, 'monture');
  rings.ff = put(new THREE.Group(), null, null, barrel, 'tirage');
  mesh(knurl(0.0355, 0.011, 90, 0.0006), M.lensGrey, [0.0125, 0, 0], null, rings.ff);
  rings.ff.userData.set = (d) => { rings.ff.rotation.x = d * 18; };
  // vis de blocage de la bague F.f : bouton à collerette rouge, sur le dessus
  const lock = put(new THREE.Group(), [0.0125, 0.036, -0.012], [0, 0, 0], barrel, 'tirage');
  mesh(cylY(0.0055, 0.006), M.red, [0, 0.003, 0], null, lock);
  mesh(knurl(0.0045, 0.006, 16, 0.0005).rotateZ(Math.PI / 2), M.black, [0, 0.008, 0], null, lock);
  rings.ffLock = lock;
  // corps arrière (servo, doubleur), avec son bloc gauche et ses plaques
  mesh(cylX(0.039, 0.040, 0.050), M.lens, [0.044, 0, 0], null, barrel);
  const side = mesh(slab(roundPoly([[0.064, -0.042], [0.064, 0.034], [0.021, 0.034], [0.021, -0.042]], 0.008), 0.016, 0.003), M.lensGrey, [0, 0, -0.038], null, barrel);
  side.name = 'bloc gauche';
  put(decal(0.042, 0.012, (g, X, Y, k) => txt(g, 'WIDE POWER', X(0), Y(0), 0.0062 * k, { color: '#e2402e', weight: 700 }), '-z'), [0.0425, 0.012, -0.0465], null, barrel);
  put(decal(0.040, 0.020, (g, X, Y, k) => {
    g.fillStyle = '#2a2b2d'; g.fillRect(X(-0.019), Y(0.009), 0.038 * k, 0.018 * k);
    g.strokeStyle = '#b89a55'; g.lineWidth = 0.0006 * k; g.strokeRect(X(-0.019), Y(0.009), 0.038 * k, 0.018 * k);
    txt(g, 'FUJINON', X(0), Y(0.003), 0.0085 * k, { color: '#d9bd78', weight: 700 });
    txt(g, 'HD  HIGH DEFINITION', X(0), Y(-0.0045), 0.0032 * k, { color: '#c9b07a', weight: 600 });
  }, '-z'), [0.043, -0.014, -0.0466], null, barrel);
  // levier de la macro (arrière, en bas à gauche) et levier du doubleur (dessous)
  rings.macro = put(new THREE.Group(), [0.027, 0, 0], null, barrel, 'macro');
  mesh(new THREE.BoxGeometry(0.007, 0.014, 0.005), M.lensGrey, [0, -0.044, -0.014], [0.35, 0, 0], rings.macro);
  mesh(new THREE.BoxGeometry(0.0045, 0.004, 0.006), M.metal, [0, -0.051, -0.017], [0.35, 0, 0], rings.macro);
  rings.ext = put(new THREE.Group(), [0.056, -0.041, 0.010], null, barrel, 'doubleur');
  mesh(new THREE.BoxGeometry(0.010, 0.006, 0.016), M.lensGrey, [0, -0.002, 0], null, rings.ext);
  const extLever = mesh(new THREE.BoxGeometry(0.006, 0.012, 0.005), M.metal, [0, -0.009, 0.004], null, rings.ext);
  rings.ext.userData.set = (on) => { extLever.rotation.x = on ? -0.7 : 0.3; };
  put(decal(0.016, 0.012, (g, X, Y, k) => { txt(g, '×1', X(-0.004), Y(0.0025), 0.0036 * k); txt(g, '×2', X(0.004), Y(-0.0025), 0.0036 * k, { color: '#e2402e' }); }, '-y'), [0.056, -0.0472, 0.010], null, barrel);
  // bague d'iris, repère, bague de zoom (moletée, avec son levier), repère, échelle de point, moletage du point
  const IR = [1.8, 2.8, 4, 5.6, 8, 11, 16];
  const irisP = (n) => Math.log2(n / 1.8) / Math.log2(16 / 1.8);
  rings.iris = put(scaleRing({ r: 0.041, x0: 0.068, x1: 0.082, span: 1.45, knurlFrom: 0.0735, ribs: 70,
    marks: [...IR.map((n) => [String(n), irisP(n), '#e9e9e2', 0.5]), ['C', 1.13, '#e9e9e2', 0.5]] }), null, null, barrel, 'iris');
  rings.iris.userData.p = irisP;
  put(indexBand(0.0405, 0.082, 0.088), null, null, barrel);
  rings.zoom = put(scaleRing({ r: 0.0425, x0: 0.088, x1: 0.112, span: 1.9, knurlFrom: 0.098, ribs: 72,
    marks: [4.5, 8, 15, 30, 50].map((f) => [String(f), zoomPos(f), '#e9e9e2', 0.5]) }), null, null, barrel, 'zoom');
  // levier de zoom : petite tige vissée sur la bague, en bas à gauche
  const zl = new THREE.Group(); zl.rotation.x = 0.7; rings.zoom.add(zl);
  mesh(cylY(0.0028, 0.022), M.metal, [0.105, -0.0525, 0], null, zl);
  mesh(cylY(0.0036, 0.008), M.rubber, [0.105, -0.064, 0], null, zl);
  put(indexBand(0.0415, 0.112, 0.118), null, null, barrel);
  const fW = (p) => Math.pow(Math.max(0, p), 0.45);
  /** @type {[number, string][]} */
  const FT = [[1, '1'], [1.2, '1.2'], [1.5, '1.5'], [2, '2'], [3, '3'], [5, '5'], [10, '10'], [20, '20']];
  rings.focus = put(scaleRing({ r: 0.0435, x0: 0.118, x1: 0.140, span: 3.3, warp: fW, size: 0.0038,
    marks: [...[[0.3, '0.3'], [0.4, '0.4'], [0.6, '0.6'], [0.8, '0.8'], [1, '1'], [1.5, '1.5'], [2, '2'], [3, '3'], [5, '5'], [10, '10']].map(([d, s]) => [s, focusPos(d), '#ecece6', 0.85]),
      ...FT.map(([ft, s]) => [s, focusPos(ft * 0.3048), '#ef8a2a', 0.15]), ['∞', 0, '#ecece6', 0.5], ['m', 1.06, '#ecece6', 0.85], ['ft', 1.06, '#ef8a2a', 0.15]] }), null, null, barrel, 'point');
  const grip = mesh(knurl(0.0465, 0.046, 44, 0.0022), M.rubber, [0.163, 0, 0], null, rings.focus);
  grip.userData.point = 'point';
  // bague verte, barillet avant, lentille frontale
  mesh(cylX(0.0478, 0.0478, 0.003), M.green, [0.1875, 0, 0], null, barrel);
  mesh(cylX(0.0485, 0.050, 0.016), M.lens, [0.197, 0, 0], null, barrel, 'frontale');
  put(new THREE.Mesh(cylX(0.0445, 0.0445, 0.003, 64, true), M.black), [0.2045, 0, 0], null, barrel, 'frontale');
  const capR = 0.12, capA = Math.asin(0.0425 / capR);
  const front = new THREE.SphereGeometry(capR, 64, 10, 0, Math.PI * 2, 0, capA); front.rotateZ(-Math.PI / 2);
  mesh(front, M.glass, [0.2035 - capR, 0, 0], null, barrel, 'frontale');
  // pare-soleil rectangulaire (avant) : surfaces extérieure et intérieure, bord, fond autour du barillet
  const hood = new THREE.Group(); hood.name = 'pare-soleil'; hood.userData.point = 'frontale';
  const xa = 0.200, xb = 0.288, t = 0.003;
  const Ao = rrOutline(0.150, 0.122, 0.036), Bo = rrOutline(0.208, 0.158, 0.026);
  const Ai = rrOutline(0.150 - 2 * t, 0.122 - 2 * t, 0.033), Bi = rrOutline(0.208 - 2 * t, 0.158 - 2 * t, 0.023);
  // le fond du pare-soleil va du barillet (cercle) au contour : un point du cercle par point du contour, dans la même direction
  const toCircle = (C, r) => C.map(([z, y]) => { const a = Math.atan2(y, z); return [r * Math.cos(a), r * Math.sin(a)]; });
  for (const [geo, mat] of [[loft(Ao, xa, Bo, xb), M.hood], [loft(Ai, xa + 0.002, Bi, xb), M.hoodIn], [loft(Bo, xb, Bi, xb), M.hood], [loft(toCircle(Ao, 0.0505), xa - 0.004, Ao, xa), M.hood], [loft(toCircle(Ai, 0.0505), xa - 0.002, Ai, xa + 0.002), M.hoodIn]]) mesh(geo, mat, null, null, hood);
  put(decal(0.016, 0.009, (g) => { g.fillStyle = '#e7c62b'; g.fillRect(0, 0, 999, 999); }, '+y'), [0.27, 0.0795, -0.07], [-Math.PI / 2, 0, 0.12], hood);
  lens.add(hood);
  // poignée du servo (côté droit) : bascule de zoom, bouton RET, sangle
  const servo = new THREE.Group(); servo.name = 'poignée'; servo.userData.point = 'poignee';
  mesh(slab(roundPoly([[0.016, 0.034], [0.150, 0.040], [0.166, 0.004], [0.158, -0.068], [0.112, -0.086], [0.034, -0.080], [0.012, -0.042]], [0.012, 0.016, 0.02, 0.024, 0.02, 0.02, 0.012]), 0.06, 0.008, 4), M.lens, [0, 0, 0.069], null, servo);
  mesh(slab(roundPoly([[0.06, 0.012], [0.155, 0.016], [0.16, -0.05], [0.11, -0.072], [0.065, -0.06]], 0.012), 0.006, 0.002), M.rubber, [0, 0, 0.1], null, servo);
  const rock = put(new THREE.Group(), [0.128, 0.050, 0.072], null, servo);
  mesh(new THREE.BoxGeometry(0.030, 0.006, 0.016), M.lensGrey, [0, 0, 0], null, rock);
  mesh(new THREE.BoxGeometry(0.008, 0.004, 0.012), M.metal, [-0.009, 0.004, 0], null, rock);
  mesh(new THREE.BoxGeometry(0.008, 0.004, 0.012), M.metal, [0.009, 0.004, 0], null, rock);
  rings.rocker = rock;
  mesh(cylY(0.0055, 0.006), M.dark, [0.045, 0.046, 0.075], null, servo);
  put(decal(0.016, 0.006, (g, X, Y, k) => { txt(g, 'W', X(-0.006), Y(0), 0.004 * k); txt(g, 'T', X(0.006), Y(0), 0.004 * k); }, '+y'), [0.128, 0.0485, 0.090], null, servo);
  put(decal(0.06, 0.012, (g, X, Y, k) => { txt(g, 'FUJINON  ZA12x4.5BERD-S6', X(0), Y(0.002), 0.0042 * k, { color: '#d8d8d2' }); txt(g, '1:1.8/4.5-54mm', X(0), Y(-0.0035), 0.0032 * k, { color: '#b9b9b2' }); }, '+z'), [0.09, 0.027, 0.0995], [0, 0, 0.045], servo);
  // sangle de poignée sous le servo, avec son inscription
  const strap = new THREE.Shape(); const sp = [[0.158, -0.058], [0.14, -0.088], [0.09, -0.098], [0.04, -0.088], [0.02, -0.066]];
  strap.moveTo(sp[0][0], sp[0][1]); for (const p of sp.slice(1)) strap.lineTo(p[0], p[1]);
  for (const p of [...sp].reverse()) strap.lineTo(p[0], p[1] - 0.014);
  mesh(new THREE.ExtrudeGeometry(strap, { depth: 0.003, bevelEnabled: false }).translate(0, 0, -0.0015), M.rubber, [0, 0, 0.095], null, servo);
  put(decal(0.04, 0.008, (g, X, Y, k) => txt(g, 'FUJINON', X(0), Y(0), 0.0058 * k, { color: '#d0d0ca', weight: 700 }), '+z'), [0.09, -0.105, 0.0968], null, servo);
  // prises des commandes reportées (zoom et point) sous la poignée : embouts verts
  for (const [x, z] of [[0.05, 0.062], [0.072, 0.066]]) { mesh(cylY(0.0042, 0.012), M.dark, [x, -0.088, z], null, servo); mesh(cylY(0.0046, 0.006), M.cableGreen, [x, -0.097, z], null, servo); }
  lens.add(servo);

  // groupes de lentilles à l'intérieur (visibles en coupe) : ils bougent avec le point, le zoom, le tirage
  const inner = new THREE.Group(); inner.name = 'lentilles'; lens.add(inner);
  const glassIn = new THREE.MeshPhysicalMaterial({ color: 0xbfd8ff, roughness: 0.05, transparent: true, opacity: 0.32, clearcoat: 1, depthWrite: false, side: THREE.DoubleSide });
  const elt = (r, th, x, parent) => { const g = new THREE.CylinderGeometry(r, r, th, 40); g.rotateZ(-Math.PI / 2); return mesh(g, glassIn, [x, 0, 0], null, parent); };
  const grp = (name, items) => { const g = new THREE.Group(); g.name = name; for (const [r, th, x] of items) elt(r, th, x, g); inner.add(g); return g; };
  const G = {
    front: grp('groupe frontal', [[0.042, 0.007, 0.196], [0.039, 0.006, 0.186]]),
    focus: grp('groupe de mise au point', [[0.036, 0.006, 0.170], [0.034, 0.005, 0.161]]),
    vari: grp('variateur', [[0.024, 0.004, 0], [0.022, 0.004, -0.008]]),
    comp: grp('compensateur', [[0.026, 0.005, 0], [0.025, 0.004, -0.007]]),
    relay: grp('groupe relais', [[0.020, 0.005, 0.054], [0.019, 0.004, 0.046], [0.018, 0.004, 0.036]]),
    ext: grp('doubleur', [[0.016, 0.004, 0], [0.015, 0.003, -0.006]]),
    rear: grp('groupe arrière (tirage)', [[0.017, 0.004, 0.014]]),
  };
  // diaphragme : couronne dont le trou suit le nombre f
  const irisDisc = mesh(new THREE.RingGeometry(0.0072, 0.03, 48, 1).rotateY(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x1b1c1e, roughness: 0.4, metalness: 0.6, side: THREE.DoubleSide }), [0.075, 0, 0], null, inner);
  const lensState = { zoom: 0, focus: 0, ff: 0, ext: false };
  const updateInner = () => {
    const z = lensState.zoom;
    G.vari.position.x = lerp(0.140, 0.104, z);
    G.comp.position.x = lerp(0.098, 0.118, Math.sin(z * Math.PI) * 0.6 + z * 0.4);
    G.focus.position.x = lensState.focus * 0.008;
    G.ext.position.set(0.029, lensState.ext ? 0 : -0.026, 0); G.ext.visible = true;
    G.rear.position.x = lensState.ff * 0.02; // tirage en mm, déplacement exagéré vingt fois pour être visible
  };
  return { lens, barrel, hood, servo, inner, rings, irisDisc, lensState, updateInner };
}

// =================================================================================
// Le corps : type Sony HXC-FB80
// =================================================================================
function buildBody(M) {
  const body = new THREE.Group(); body.name = 'corps';
  // bloc principal (profil de côté extrudé sur la largeur)
  const shell = new THREE.Group(); shell.name = 'coque'; body.add(shell);
  const shellMat = M.body.clone();
  mesh(slab(roundPoly([[-0.016, 0.074], [-0.016, -0.123], [-0.314, -0.123], [-0.314, 0.056], [-0.298, 0.074]], [0.012, 0.01, 0.01, 0.01, 0.012]), 0.136, 0.004), shellMat, null, null, shell, 'bloc');
  // face avant : bague de la monture, levier de verrouillage, prise LENS
  mesh(cylX(0.052, 0.052, 0.012, 64), M.metalDark, [-0.006, 0, 0], null, body, 'monture');
  mesh(cylX(0.036, 0.036, 0.013, 48), M.black, [-0.006, 0, 0], null, body, 'monture');
  const lever = mesh(new THREE.BoxGeometry(0.008, 0.024, 0.010), M.metalDark, [-0.004, 0.056, -0.022], [0, 0, 0], body, 'monture');
  lever.rotation.x = 0.4;
  mesh(cylX(0.006, 0.006, 0.01), M.dark, [-0.008, 0.052, 0.048], null, body, 'monture');
  // câble de l'objectif (12 broches) : de la poignée du servo à la prise LENS
  const lensCable = new THREE.CatmullRomCurve3([new THREE.Vector3(0.03, 0.028, 0.082), new THREE.Vector3(0.012, 0.05, 0.075), new THREE.Vector3(-0.006, 0.055, 0.056)]);
  mesh(new THREE.TubeGeometry(lensCable, 20, 0.0032, 8), M.cable, null, null, body, 'monture');

  // côté droit : grand capot à grille d'aération, sangle, inscriptions SONY et Exmor
  const coverR = new THREE.Group(); coverR.name = 'capot droit'; body.add(coverR);
  mesh(slab(roundPoly([[-0.176, 0.068], [-0.31, 0.068], [-0.31, -0.115], [-0.205, -0.115]], 0.012), 0.008, 0.0025), M.cover, [0, 0, 0.0705], null, coverR, 'bloc');
  for (let i = 0; i < 8; i++) mesh(new THREE.BoxGeometry(0.0035, 0.07, 0.003), M.black, [-0.298 + i * 0.0065, -0.06, 0.0746], null, coverR, 'bloc');
  mesh(new THREE.BoxGeometry(0.014, 0.19, 0.004), M.rubber, [-0.192, -0.025, 0.0765], [0, 0, -0.08], coverR);
  mesh(new THREE.BoxGeometry(0.02, 0.012, 0.006), M.metalDark, [-0.19, -0.035, 0.078], null, coverR);
  mesh(cylZ(0.046, 0.003, 64), M.cover, [-0.058, -0.023, 0.0685], null, body);
  put(decal(0.05, 0.012, (g, X, Y, k) => txt(g, 'SONY', X(0), Y(0), 0.0105 * k, { color: '#dfe0db', weight: 700, font: 'Georgia, "Times New Roman", serif' }), '+z'), [-0.06, 0.024, 0.0683], null, body);
  put(decal(0.04, 0.012, (g, X, Y, k) => { txt(g, 'Exmor', X(0), Y(0), 0.0078 * k, { color: '#b5d34a', weight: 700 }); }, '+z'), [-0.058, -0.024, 0.0703], null, body);

  // côté gauche : capot, panneau de commandes (FILTER, COLOR TEMP., ASSIGN 1 à 3, inverseurs, menu)
  const coverL = new THREE.Group(); coverL.name = 'capot gauche'; body.add(coverL);
  mesh(slab(roundPoly([[-0.10, 0.068], [-0.31, 0.068], [-0.31, -0.115], [-0.122, -0.115]], 0.014), 0.009, 0.003), M.cover, [0, 0, -0.071], null, coverL, 'bloc');
  mesh(slab(roundPoly([[-0.13, 0.058], [-0.29, 0.058], [-0.29, 0.0], [-0.15, -0.02]], 0.02), 0.006, 0.003), M.cover, [0, 0, -0.077], null, coverL, 'bloc');
  const panel = new THREE.Group(); panel.name = 'commandes'; body.add(panel);
  mesh(new THREE.BoxGeometry(0.086, 0.17, 0.003), M.dark, [-0.058, -0.022, -0.0685], null, panel, 'commandes');
  put(decal(0.086, 0.17, (g, X, Y, k) => {
    // le panneau vu de la gauche : l'avant de la caméra est à gauche de l'image
    g.fillStyle = '#121315'; g.fillRect(X(-0.039), Y(0.078), 0.038 * k, 0.026 * k);
    txt(g, 'FILTER', X(-0.02), Y(0.074), 0.0042 * k, { weight: 700 });
    ['CLEAR', '1/4ND', '1/16ND', '1/64ND'].forEach((s, i) => { g.fillStyle = '#9ea39b'; g.fillRect(X(-0.036), Y(0.0675 - i * 0.0048) - 0.0015 * k, 0.003 * k, 0.003 * k); txt(g, s, X(-0.031), Y(0.0675 - i * 0.0048), 0.0034 * k, { align: 'left' }); });
    txt(g, 'COLOR', X(0.023), Y(0.079), 0.0036 * k, { weight: 700 }); txt(g, 'TEMP.', X(0.023), Y(0.075), 0.0036 * k, { weight: 700 });
    [['ASSIGN 1', -0.002, 0.032], ['ASSIGN 2', 0.028, 0.012], ['ASSIGN 3', -0.002, -0.008]].forEach(([s, x, y]) => { g.fillStyle = '#d8d9d2'; g.fillRect(X(Number(x)), Y(Number(y)) - 0.0025 * k, 0.0175 * k, 0.005 * k); txt(g, String(s), X(Number(x) + 0.00875), Y(Number(y)), 0.0033 * k, { color: '#141516', weight: 700 }); });
    txt(g, 'Φ', X(-0.010), Y(-0.025), 0.006 * k, { weight: 500 });
    g.fillStyle = '#1c1d1f'; g.fillRect(X(-0.042), Y(-0.04), 0.084 * k, 0.018 * k);
    ['GAIN', 'OUTPUT', 'WHITE BAL'].forEach((s, i) => txt(g, s, X(-0.028 + i * 0.028), Y(-0.043), 0.0027 * k));
    g.fillStyle = '#111214'; g.fillRect(X(-0.042), Y(-0.06), 0.084 * k, 0.016 * k);
    txt(g, 'STATUS', X(-0.024), Y(-0.062), 0.0028 * k); txt(g, 'CANCEL', X(-0.024), Y(-0.074), 0.0028 * k);
    txt(g, 'DISPLAY', X(0.006), Y(-0.062), 0.0028 * k); txt(g, 'OFF', X(0.006), Y(-0.074), 0.0028 * k); txt(g, 'MENU', X(0.02), Y(-0.074), 0.0028 * k);
  }, '-z', 6000), [-0.058, -0.022, -0.0702], null, panel, 'commandes');
  // le repère Φ du plan focal : exactement au-dessus du plan des capteurs
  // boutons ronds (vus de la gauche : x du panneau = -X de la caméra)
  const bx = (x) => -0.058 - x;
  const button = (x, y, point, r = 0.0062) => { const b = put(new THREE.Group(), [bx(x), -0.022 + y, -0.0705], null, panel, point); mesh(cylZ(r + 0.0015, 0.002), M.black, [0, 0, 0], null, b); mesh(cylZ(r, 0.004), M.lensGrey, [0, 0, -0.002], null, b); return b; };
  const B = {
    filter: put(new THREE.Group(), [bx(-0.02), -0.022 + 0.066, -0.0705], null, panel, 'filtres'),
    colorTemp: button(0.023, 0.06, 'commandes'), assign1: button(-0.017, 0.032, 'commandes'), assign2: button(0.013, 0.012, 'commandes'), assign3: button(-0.017, -0.008, 'commandes'),
  };
  mesh(new THREE.BoxGeometry(0.04, 0.026, 0.004), new THREE.MeshBasicMaterial({ visible: false }), [0, 0, 0], null, B.filter);
  // trois inverseurs à levier (GAIN, OUTPUT, WHITE BAL)
  const toggles = [];
  for (let i = 0; i < 3; i++) {
    const tg = put(new THREE.Group(), [bx(-0.028 + i * 0.028), -0.022 - 0.050, -0.0705], null, panel, 'commandes');
    mesh(new THREE.BoxGeometry(0.008, 0.012, 0.003), M.black, [0, 0, 0], null, tg);
    const lv = mesh(cylY(0.0014, 0.009), M.chrome, [0, 0.002, -0.004], [Math.PI / 2 - 0.5, 0, 0], tg); toggles.push(lv);
  }
  // touches du menu : STATUS/CANCEL et DISPLAY/MENU
  const menuKeys = put(new THREE.Group(), null, null, panel, 'menu');
  mesh(cylZ(0.0026, 0.004), M.black, [bx(-0.016), -0.022 - 0.068, -0.071], null, menuKeys);
  mesh(cylZ(0.0026, 0.004), M.black, [bx(0.013), -0.022 - 0.068, -0.071], null, menuKeys);
  mesh(new THREE.BoxGeometry(0.03, 0.016, 0.004), new THREE.MeshBasicMaterial({ visible: false }), [bx(0), -0.022 - 0.067, -0.071], null, menuKeys);

  // arrière : capot central (SONY), colonne des retours et de l'intercom, panneau des prises, prise fibre
  const rear = new THREE.Group(); rear.name = 'arrière'; body.add(rear);
  mesh(slab(rrect(0.085, 0.13, 0.01), 0.012, 0.003), M.cover, [-0.322, -0.002, 0.004], [0, Math.PI / 2, 0], rear);
  put(decal(0.03, 0.008, (g, X, Y, k) => txt(g, 'SONY', X(0), Y(0), 0.0062 * k, { color: '#cfd0cb', weight: 700, font: 'Georgia, serif' }), '-x'), [-0.3282, 0.045, 0.004], null, rear);
  // colonne gauche (vue de derrière) : RET, RET2 SEL, RET 1, niveau intercom, INTERCOM, CALL
  const col = put(new THREE.Group(), null, null, rear, 'intercom');
  mesh(new THREE.BoxGeometry(0.008, 0.13, 0.022), M.cover, [-0.322, -0.002, -0.054], null, col);
  put(decal(0.022, 0.13, (g, X, Y, k) => {
    [['RET2 SEL', 0.032], ['RET 1', 0.012], ['INTERCOM', -0.03], ['PROD', -0.036], ['ENG', -0.046], ['CALL', -0.054]].forEach(([s, y]) => txt(g, String(s), X(0), Y(Number(y)), 0.0029 * k, { weight: 700 }));
  }, '-x', 6000), [-0.3262, -0.002, -0.054], null, col);
  /** @type {[number, string][]} */
  const ctl = [[0.05, 'knob'], [0.026, 'sw'], [0.004, 'btn'], [-0.015, 'knob'], [-0.041, 'sw'], [-0.062, 'btn']];
  for (const [y, kind] of ctl) {
    if (kind === 'knob') mesh(knurl(0.0058, 0.006, 14, 0.0006), M.black, [-0.329, y - 0.002, -0.054], null, col);
    if (kind === 'btn') mesh(cylX(0.0042, 0.0042, 0.004), M.dark, [-0.3275, y - 0.002, -0.054], null, col);
    if (kind === 'sw') mesh(new THREE.BoxGeometry(0.006, 0.008, 0.0035), M.chrome, [-0.328, y - 0.002, -0.054], null, col);
  }
  // panneau des prises, en bas
  const plate = put(new THREE.Group(), null, null, rear, 'connectique');
  mesh(new THREE.BoxGeometry(0.006, 0.052, 0.134), M.dark, [-0.3175, -0.099, 0], null, plate);
  const Zr = (z) => z; // de gauche à droite vu de derrière = de -Z à +Z
  const xlr = (z, y, r, mat = M.metal) => { mesh(cylX(r + 0.0018, r + 0.0018, 0.004, 32), M.black, [-0.3215, y, Zr(z)], null, plate); mesh(cylX(r, r, 0.006, 32), mat, [-0.3235, y, Zr(z)], null, plate); mesh(cylX(r * 0.72, r * 0.72, 0.0062, 24), M.black, [-0.3236, y, Zr(z)], null, plate); };
  const bnc = (z, y) => { mesh(cylX(0.0048, 0.0048, 0.003, 24), M.black, [-0.3215, y, z], null, plate); mesh(cylX(0.0036, 0.0036, 0.009, 24), M.chrome, [-0.325, y, z], null, plate); mesh(cylX(0.0042, 0.0042, 0.004, 20), M.rubber, [-0.3295, y, z], null, plate); };
  xlr(-0.0467, -0.100, 0.0088);
  mesh(cylX(0.0032, 0.0032, 0.005), M.black, [-0.322, -0.083, -0.032], null, plate);
  xlr(-0.0255, -0.100, 0.0086, M.metal);
  xlr(0.0005, -0.100, 0.0086, M.metal);
  mesh(new THREE.BoxGeometry(0.003, 0.006, 0.008), M.orange, [-0.3215, -0.081, 0.0], null, plate);
  xlr(0.0255, -0.090, 0.0052); xlr(0.0255, -0.108, 0.006);
  bnc(0.042, -0.090); bnc(0.042, -0.108); bnc(0.058, -0.090); bnc(0.058, -0.108);
  put(decal(0.134, 0.052, (g, X, Y, k) => {
    const L = (s, z, y, a = 'center') => txt(g, s, X(z), Y(y + 0.099), 0.0026 * k, { weight: 700, align: a });
    L('DC IN', -0.0467, -0.1125); L('EARPHONE', -0.026, -0.0765); L('INTERCOM', -0.0255, -0.1125); L('AUDIO 2 IN', 0.0005, -0.1125); L('LINE MIC +48V', 0.0005, -0.0765);
    L('REMOTE', 0.0255, -0.0995); L('DC OUT', 0.0255, -0.1165); L('TEST OUT', 0.042, -0.0815); L('PROMPTER/', 0.042, -0.1155); L('GENLOCK', 0.042, -0.1195);
    L('SDI OUT', 0.058, -0.0815); L('SDI I/O', 0.058, -0.1165);
  }, '-x', 6000), [-0.3209, -0.099, 0], null, plate);
  // câble d'intercom bleu (le casque du cadreur, accroché au manche)
  mesh(cylX(0.0095, 0.0095, 0.016, 24), M.blue, [-0.331, -0.100, -0.0255], null, plate);
  // prise fibre (vers la CCU) : à l'arrière droite, sous son capot, avec son bouchon
  const fib = put(new THREE.Group(), [-0.322, -0.035, 0.056], null, rear, 'fibre');
  mesh(new THREE.BoxGeometry(0.01, 0.034, 0.024), M.cover, [0.0, 0, 0], null, fib);
  mesh(cylX(0.0115, 0.0115, 0.016, 32), M.metalDark, [-0.012, 0, 0], null, fib);
  mesh(knurl(0.0128, 0.01, 24, 0.0008), M.black, [-0.017, 0, 0], null, fib);
  mesh(new THREE.SphereGeometry(0.0018, 12, 8), M.red, [-0.0145, 0.012, 0], null, fib);
  put(decal(0.012, 0.005, (g, X, Y, k) => txt(g, 'CCU', X(0), Y(0), 0.0036 * k, { weight: 700 }), '-x'), [-0.0052, 0.0142, 0], null, fib);

  // dessous : coussin d'épaule à arche, plaque VCT, plaque coulissante de la tête (levier rouge)
  const pad = new THREE.Shape();
  pad.moveTo(-0.04, -0.123); pad.lineTo(-0.30, -0.123); pad.lineTo(-0.30, -0.165); pad.lineTo(-0.255, -0.165);
  pad.quadraticCurveTo(-0.17, -0.128, -0.085, -0.165); pad.lineTo(-0.04, -0.165); pad.closePath();
  mesh(slab(pad, 0.112, 0.004), M.pad, null, null, body);
  mesh(new THREE.BoxGeometry(0.24, 0.010, 0.10), M.black, [-0.17, -0.170, 0], null, body);
  mesh(new THREE.BoxGeometry(0.29, 0.014, 0.125), M.metalDark, [-0.165, -0.182, 0], null, body);
  mesh(new THREE.BoxGeometry(0.014, 0.008, 0.014), M.red, [-0.12, -0.182, -0.068], null, body);

  // poignée de transport (grise) et support de micro à l'avant
  const handle = new THREE.Group(); handle.name = 'poignée de transport'; body.add(handle);
  const hs = roundPoly([[-0.022, 0.074], [-0.022, 0.150], [-0.182, 0.150], [-0.242, 0.074]], [0.003, 0.012, 0.03, 0.003]);
  hs.holes.push(roundPoly([[-0.045, 0.086], [-0.17, 0.086], [-0.17, 0.131], [-0.045, 0.131]], [0.01, 0.022, 0.012, 0.012], new THREE.Path()));
  mesh(slab(hs, 0.034, 0.005, 4), M.handle, null, null, handle);
  mesh(new THREE.CylinderGeometry(0.0125, 0.0125, 0.018, 28, 1, true).rotateZ(Math.PI / 2), M.dark, [-0.012, 0.166, 0], null, handle);
  mesh(new THREE.BoxGeometry(0.02, 0.012, 0.012), M.dark, [-0.024, 0.156, 0], null, handle);
  mesh(knurl(0.0065, 0.008, 12, 0.0007).rotateY(Math.PI / 2), M.black, [-0.012, 0.166, 0.019], null, handle);

  return { body, shell, shellMat, coverL, coverR, panel, rear, handle, B, toggles };
}

// =================================================================================
// Le viseur 7" et son support
// =================================================================================
function buildViewfinder(M) {
  const vf = new THREE.Group(); vf.name = 'viseur'; vf.userData.point = 'viseur';
  const cy = 0.248;
  mesh(slab(roundPoly([[-0.405, 0.172], [-0.30, 0.172], [-0.30, 0.322], [-0.405, 0.322]], 0.012), 0.226, 0.008, 4), M.vf, null, null, vf);
  // face arrière : cadre, écran, rangées de voyants, boutons
  mesh(new THREE.BoxGeometry(0.004, 0.118, 0.182), M.black, [-0.4115, cy, 0], null, vf);
  const screen = mesh(new THREE.PlaneGeometry(0.155, 0.0872), M.screenOff, [-0.4140, cy + 0.002, 0], [0, -Math.PI / 2, 0], vf);
  const leds = [];
  const ledCol = [0x8a1712, 0x18802f, 0x18802f, 0xa0700f, 0xa0700f, 0x8a1712];
  for (const y of [cy + 0.052, cy - 0.050]) ledCol.forEach((c, i) => { const m = new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.25, roughness: 0.4 }); leds.push(mesh(new THREE.BoxGeometry(0.002, 0.003, 0.009), m, [-0.414, y, -0.04 + i * 0.016], null, vf)); });
  for (const [z, y] of [[0.103, cy + 0.04], [0.103, cy + 0.008], [0.103, cy - 0.024], [-0.103, cy + 0.04]]) mesh(knurl(0.0075, 0.008, 14, 0.0007), M.black, [-0.413, y, z], null, vf);
  for (const y of [cy + 0.012, cy - 0.006, cy - 0.024, cy - 0.042]) mesh(new THREE.BoxGeometry(0.004, 0.008, 0.01), M.dark, [-0.411, y, -0.103], null, vf);
  // côtés : gros boutons de pivot et flasques triangulaires
  for (const s of [-1, 1]) {
    mesh(knurl(0.019, 0.026, 22, 0.0015).rotateY(Math.PI / 2), M.dark, [-0.345, 0.212, s * 0.126], null, vf);
    mesh(slab(roundPoly([[-0.33, 0.30], [-0.39, 0.18], [-0.30, 0.18]], 0.012), 0.008, 0.002), M.vf, [0, 0, s * 0.116], null, vf);
    mesh(cylZ(0.004, 0.012), M.metal, [-0.345, 0.27, s * 0.12], null, vf);
  }
  // lampe de tally à l'avant, sur le dessus ; SONY sur la face avant
  const tallyMat = M.tally.clone();
  mesh(slab(rrect(0.036, 0.046, 0.008), 0.05, 0.004), tallyMat, [-0.296, 0.31, 0], [0, Math.PI / 2, 0], vf);
  put(decal(0.05, 0.012, (g, X, Y, k) => txt(g, 'SONY', X(0), Y(0), 0.0105 * k, { color: '#d9dad5', weight: 700, font: 'Georgia, serif' }), '+x'), [-0.2915, 0.235, 0], null, vf);
  // support en U sous le viseur, pied sur la caméra
  const brk = new THREE.Group(); brk.name = 'support du viseur'; vf.add(brk);
  mesh(new THREE.BoxGeometry(0.03, 0.007, 0.27), M.dark, [-0.345, 0.158, 0], null, brk);
  for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(0.02, 0.06, 0.007), M.dark, [-0.345, 0.186, s * 0.135], [s * -0.12, 0, 0], brk);
  mesh(new THREE.BoxGeometry(0.05, 0.08, 0.05), M.dark, [-0.29, 0.115, 0], null, brk);
  mesh(new THREE.BoxGeometry(0.07, 0.012, 0.06), M.metalDark, [-0.29, 0.08, 0], null, brk);
  mesh(knurl(0.008, 0.012, 14, 0.0007).rotateY(Math.PI / 2), M.black, [-0.29, 0.115, 0.032], null, brk);
  // câble du viseur, qui descend le long du côté droit
  const cab = new THREE.CatmullRomCurve3([[-0.36, 0.17, 0.09], [-0.33, 0.13, 0.11], [-0.27, 0.07, 0.085], [-0.24, 0.0, 0.082], [-0.25, -0.10, 0.082]].map((p) => new THREE.Vector3(p[0], p[1], p[2])));
  mesh(new THREE.TubeGeometry(cab, 40, 0.0028, 8), M.cable, null, null, vf);
  return { vf, screen, tallyMat, leds };
}

// =================================================================================
// L'intérieur : roue de filtres, filtre passe-bas, bloc prisme, capteurs, cartes
// =================================================================================
function buildInternals() {
  const g = new THREE.Group(); g.name = 'intérieur';
  const glassMat = (c, o = 0.55) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.05, metalness: 0, transparent: true, opacity: o, clearcoat: 1, envMapIntensity: 1.2, side: THREE.DoubleSide });
  const P = {};
  // roue de filtres ND : 4 fenêtres (CLEAR, 1/4, 1/16, 1/64), centre au-dessus de l'axe
  P.filter = put(new THREE.Group(), [-0.020, 0.024, 0], null, g, 'filtres');
  const wheel = put(new THREE.Group(), null, null, P.filter);
  mesh(cylX(0.034, 0.034, 0.003, 48), new THREE.MeshStandardMaterial({ color: 0x2a2b2e, roughness: 0.4, metalness: 0.7 }), null, null, wheel);
  [0.1, 0.45, 0.7, 0.88].forEach((d, i) => {
    const a = i * Math.PI / 2; // la fenêtre 0 (CLEAR) en bas, sur l'axe ; la roue tourne d'un quart de tour par filtre
    mesh(cylX(0.0105, 0.0105, 0.0035, 32), glassMat(new THREE.Color().setScalar(1 - d), 0.35 + d * 0.6), [0, -0.024 * Math.cos(a), 0.024 * Math.sin(a)], null, wheel);
  });
  mesh(cylX(0.004, 0.004, 0.008), new THREE.MeshStandardMaterial({ color: 0x999999, metalness: 1, roughness: 0.3 }), null, null, wheel);
  P.wheel = wheel;
  // filtre passe-bas optique et filtre infrarouge (lame légèrement cyan)
  P.olpf = mesh(new THREE.BoxGeometry(0.0025, 0.020, 0.020), glassMat(0x9fe3ec, 0.45), [-0.0255, 0, 0], null, g, 'bloc');
  // bloc prisme : trois prismes collés, chacun teinté de la couleur qu'il garde
  P.prism = put(new THREE.Group(), null, null, g, 'bloc');
  const prismPiece = (pts, color) => mesh(new THREE.ExtrudeGeometry(new THREE.Shape(pts.map((p) => new THREE.Vector2(p[0], p[1]))), { depth: 0.02, bevelEnabled: false }).translate(0, 0, -0.01), glassMat(color, 0.42), null, null, P.prism, 'bloc');
  prismPiece([[-0.028, -0.011], [-0.028, 0.011], [-0.0365, 0.011], [-0.0315, -0.011]], 0x7fa8ff);
  prismPiece([[-0.0315, -0.011], [-0.0365, 0.011], [-0.0385, 0.011], [-0.0435, -0.011]], 0xff8f86);
  prismPiece([[-0.0435, -0.011], [-0.0385, 0.011], [-0.0465, 0.011], [-0.0465, -0.011]], 0x8fe39a);
  // capteurs : boîtier céramique, puce irisée, carte verte derrière
  const dieMat = new THREE.MeshPhysicalMaterial({ color: 0x241a46, roughness: 0.15, metalness: 0.4, iridescence: 1, iridescenceIOR: 1.6, iridescenceThicknessRange: [200, 600] });
  const sensor = (name, pos, rot, tint) => {
    const s = put(new THREE.Group(), pos, rot, P.prism, 'bloc'); s.name = name;
    mesh(new THREE.BoxGeometry(0.0022, 0.018, 0.018), new THREE.MeshStandardMaterial({ color: 0xc9bfa6, roughness: 0.6 }), [0, 0, 0], null, s);
    mesh(new THREE.BoxGeometry(0.0006, 0.0054, 0.0096), dieMat, [0.0013, 0, 0], null, s);
    mesh(new THREE.BoxGeometry(0.0016, 0.026, 0.026), new THREE.MeshStandardMaterial({ color: 0x1f5c36, roughness: 0.6 }), [-0.0022, 0, 0], null, s);
    mesh(new THREE.BoxGeometry(0.0005, 0.003, 0.003), new THREE.MeshBasicMaterial({ color: tint }), [-0.0031, 0.009, 0.009], null, s);
    return s;
  };
  P.sB = sensor('capteur bleu', [-0.032, 0.0135, 0], [0, 0, -Math.PI / 2], 0x3d7bff);
  P.sR = sensor('capteur rouge', [-0.039, -0.0135, 0], [0, 0, Math.PI / 2], 0xff4a3d);
  P.sG = sensor('capteur vert', [-0.0478, 0, 0], [0, 0, 0], 0x35d05a);
  // cartes de traitement, ventilateur, module optique de la fibre, alimentation
  P.boards = put(new THREE.Group(), null, null, g);
  const pcb = new THREE.MeshStandardMaterial({ color: 0x1d5a33, roughness: 0.55 });
  const chip = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4 });
  const rnd = mulberry32(5);
  const board = (pos, size, rot, chips, point) => {
    const b = put(new THREE.Group(), pos, rot, P.boards, point);
    mesh(new THREE.BoxGeometry(size[0], 0.0016, size[1]), pcb, null, null, b);
    for (let i = 0; i < chips; i++) { const w = 0.006 + rnd() * 0.014; mesh(new THREE.BoxGeometry(w, 0.002, w * (0.6 + rnd() * 0.5)), chip, [(rnd() - 0.5) * (size[0] - 0.02), 0.0018, (rnd() - 0.5) * (size[1] - 0.02)], null, b); }
    return b;
  };
  P.bDsp = board([-0.17, -0.068, 0], [0.2, 0.11], null, 14, 'bloc');
  P.bA = board([-0.18, 0.0, -0.045], [0.18, 0.12], [Math.PI / 2, 0, 0], 10, 'bloc');
  P.bB = board([-0.18, 0.0, 0.045], [0.18, 0.12], [Math.PI / 2, 0, 0], 10, 'bloc');
  P.fan = put(new THREE.Group(), [-0.295, -0.1, 0.035], null, P.boards);
  mesh(new THREE.BoxGeometry(0.03, 0.045, 0.045), new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6 }), null, null, P.fan);
  P.fibreMod = put(new THREE.Group(), [-0.29, -0.035, 0.03], null, P.boards, 'fibre');
  mesh(new THREE.BoxGeometry(0.035, 0.028, 0.03), new THREE.MeshStandardMaterial({ color: 0xa8acb2, roughness: 0.35, metalness: 0.9 }), null, null, P.fibreMod);
  P.psu = mesh(new THREE.BoxGeometry(0.06, 0.03, 0.06), new THREE.MeshStandardMaterial({ color: 0x9a9ea4, roughness: 0.4, metalness: 0.85 }), [-0.25, -0.1, -0.025], null, P.boards, 'connectique');
  return { group: g, P };
}

// =================================================================================
// Le trajet de la lumière (vue en coupe) : de la mire aux trois capteurs
// =================================================================================
function stripes() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 4; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 64, 0); gr.addColorStop(0, 'rgba(255,255,255,0.25)'); gr.addColorStop(0.7, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0.25)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 4);
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; return t;
}
function buildRays() {
  const g = new THREE.Group(); g.name = 'lumière'; g.visible = false;
  const tex = stripes(); const mats = [];
  const ray = (pts, color, r = 0.0007) => {
    const path = new THREE.CurvePath();
    for (let i = 0; i < pts.length - 1; i++) path.add(new THREE.LineCurve3(new THREE.Vector3(pts[i][0], pts[i][1], pts[i][2]), new THREE.Vector3(pts[i + 1][0], pts[i + 1][1], pts[i + 1][2])));
    const len = path.getLength(); const t = tex.clone(); t.repeat.set(len / 0.02, 1); t.needsUpdate = true;
    const m = new THREE.MeshBasicMaterial({ color, map: t, transparent: true, opacity: 0.95, depthWrite: false, toneMapped: false });
    mats.push(m); const tube = new THREE.Mesh(new THREE.TubeGeometry(path, Math.max(20, Math.round(len / 0.004)), r, 6, false), m); tube.renderOrder = 3; g.add(tube);
  };
  for (const h of [-1, 0, 1]) {
    ray([[0.45, h * 0.034, 0], [0.20, h * 0.030, 0], [0.165, h * 0.024, 0], [0.075, h * 0.0035, 0], [0.04, h * 0.006, 0], [-0.028, h * 0.003, 0], [-0.033, h * 0.0026, 0]], 0xfff3d6);
    ray([[-0.033, h * 0.0026, 0], [-0.0325, 0.0125, 0]], 0x4d8bff);
    ray([[-0.033, h * 0.0026, 0], [-0.039, h * 0.0018, 0], [-0.039, -0.0125, 0]], 0xff5544);
    ray([[-0.039, h * 0.0018, 0], [-0.0466, 0, 0]], 0x3ee070);
  }
  return { group: g, mats };
}

// =================================================================================
// Le support : plaque et tête fluide, trépied, manches et commandes reportées
// =================================================================================
function buildSupport(M) {
  const g = new THREE.Group(); g.name = 'support'; g.userData.point = 'manches';
  // plateau basculant et son échelle de bascule, corps de la tête, boutons de friction
  mesh(new THREE.BoxGeometry(0.21, 0.022, 0.13), M.dark, [-0.165, -0.2, 0], null, g);
  put(decal(0.2, 0.014, (g2, X, Y, k) => { for (let i = -5; i <= 5; i++) { txt(g2, String(Math.abs(i) * 10), X(i * 0.017), Y(-0.001), 0.0042 * k, { weight: 600 }); g2.fillStyle = '#ddd'; g2.fillRect(X(i * 0.017) - 0.0003 * k, Y(0.007), 0.0006 * k, 0.003 * k); } }, '-z'), [-0.165, -0.2, -0.0655], null, g);
  mesh(slab(roundPoly([[-0.09, -0.215], [-0.24, -0.215], [-0.225, -0.37], [-0.105, -0.37]], 0.03), 0.15, 0.01, 4), M.dark, null, null, g);
  put(decal(0.08, 0.016, (g2, X, Y, k) => txt(g2, 'CARTONI', X(0), Y(0), 0.0105 * k, { color: '#d7d7d2', weight: 700 }), '-z'), [-0.165, -0.235, -0.0752], null, g);
  for (const s of [-1, 1]) {
    mesh(cylZ(0.055, 0.02, 48), M.dark, [-0.165, -0.292, s * 0.083], null, g);
    mesh(cylZ(0.04, 0.012, 48), M.lensGrey, [-0.165, -0.292, s * 0.099], null, g);
    mesh(knurl(0.012, 0.03, 10, 0.002).rotateY(Math.PI / 2), M.black, [-0.165, -0.292, s * 0.115], null, g);
  }
  put(decal(0.07, 0.07, (g2, X, Y, k) => { g2.strokeStyle = '#cfd0cb'; g2.lineWidth = 0.0008 * k; g2.beginPath(); g2.arc(X(0), Y(0), 0.03 * k, 0, Math.PI * 2); g2.stroke(); for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; txt(g2, String(i + 1), X(0.023 * Math.cos(a)), Y(0.023 * Math.sin(a)), 0.005 * k); } }, '+z'), [-0.165, -0.292, 0.1056], null, g);
  // bol, platine du trépied, jambes doubles en carbone, araignée au sol
  mesh(new THREE.SphereGeometry(0.058, 32, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M.dark, [-0.165, -0.37, 0], null, g);
  mesh(cylY(0.09, 0.04, 48), M.metalDark, [-0.165, -0.43, 0], null, g);
  mesh(cylY(0.03, 0.05, 24), M.dark, [-0.165, -0.47, 0], null, g);
  put(decal(0.2, 0.012, (g2, X, Y, k) => { g2.fillStyle = '#bfc2c6'; g2.fillRect(0, 0, 9999, 9999); for (let i = 0; i < 36; i++) { g2.fillStyle = '#222'; g2.fillRect(X(-0.1 + i * 0.0055), Y(0.006), 0.0004 * k, (i % 3 ? 0.003 : 0.006) * k); } }, '+z'), [-0.165, -0.443, 0.0905], null, g);
  const floorY = -AXIS_H, cxT = -0.165;
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI * 2 / 3; const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    const top = new THREE.Vector3(cxT, -0.45, 0).addScaledVector(dir, 0.08), foot = new THREE.Vector3(cxT, floorY + 0.03, 0).addScaledVector(dir, 0.56);
    const side = new THREE.Vector3(-dir.z, 0, dir.x);
    for (const s of [-1, 1]) {
      const a0 = top.clone().addScaledVector(side, s * 0.022), a1 = foot.clone().addScaledVector(side, s * 0.012);
      const len = a0.distanceTo(a1), mid = a0.clone().add(a1).multiplyScalar(0.5);
      const leg = mesh(cylY(0.0105, len, 16), M.carbon, [mid.x, mid.y, mid.z], null, g);
      leg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), a1.clone().sub(a0).normalize());
    }
    const clampP = top.clone().lerp(foot, 0.47);
    mesh(new THREE.BoxGeometry(0.05, 0.03, 0.06), M.dark, [clampP.x, clampP.y, clampP.z], [0, -a, 0], g);
    const footM = mesh(new THREE.BoxGeometry(0.07, 0.03, 0.05), M.dark, [foot.x, floorY + 0.015, foot.z], [0, -a, 0], g);
    footM.name = 'pied';
    const arm = new THREE.Vector3(cxT, floorY + 0.03, 0).addScaledVector(dir, 0.28);
    mesh(new THREE.BoxGeometry(0.5, 0.016, 0.025), M.metalDark, [arm.x, floorY + 0.03, arm.z], [0, -a, 0], g);
  }
  mesh(cylY(0.045, 0.03, 24), M.metalDark, [cxT, floorY + 0.03, 0], null, g);
  // manches : du plateau vers l'arrière ; commande de point à gauche (molette), de zoom à droite (pouce)
  const bars = {};
  for (const s of [-1, 1]) {
    const a0 = new THREE.Vector3(-0.24, -0.21, s * 0.075), a1 = new THREE.Vector3(-0.78, -0.40, s * 0.33);
    const len = a0.distanceTo(a1), mid = a0.clone().add(a1).multiplyScalar(0.5), dir = a1.clone().sub(a0).normalize();
    const bar = mesh(cylY(0.0135, len, 20), M.carbon, [mid.x, mid.y, mid.z], null, g);
    bar.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    const gp = a1.clone().addScaledVector(dir, -0.08);
    const grip = mesh(knurl(0.018, 0.15, 26, 0.0016).rotateZ(Math.PI / 2), M.rubber, [gp.x, gp.y, gp.z], null, g);
    grip.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    mesh(new THREE.BoxGeometry(0.04, 0.04, 0.04), M.dark, [a0.x, a0.y, a0.z], null, g);
    bars[s] = { a0, a1, dir };
  }
  const L = bars[-1], R = bars[1];
  const fp = L.a0.clone().lerp(L.a1, 0.62);
  const focusDemand = put(new THREE.Group(), [fp.x, fp.y + 0.035, fp.z], null, g, 'manches');
  mesh(cylZ(0.028, 0.07), M.lensGrey, [0, 0, 0], null, focusDemand);
  const wheel = mesh(knurl(0.044, 0.016, 36, 0.0012).rotateY(Math.PI / 2), M.alu, [0, 0, 0.044], null, focusDemand);
  put(decal(0.05, 0.012, (g2, X, Y, k) => txt(g2, '4.5-54MM', X(0), Y(0), 0.0065 * k, { color: '#222', weight: 700 }), '-z'), [0, 0, -0.0355], null, focusDemand);
  const zp = R.a0.clone().lerp(R.a1, 0.78);
  const zoomDemand = put(new THREE.Group(), [zp.x, zp.y + 0.03, zp.z], null, g, 'manches');
  mesh(new THREE.BoxGeometry(0.06, 0.04, 0.035), M.dark, [0, 0, 0], null, zoomDemand);
  const thumb = mesh(new THREE.BoxGeometry(0.026, 0.008, 0.016), M.lensGrey, [0, 0.024, 0], null, zoomDemand);
  // câbles des commandes, de la poignée du servo jusqu'aux manches
  const cable = (pts) => mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p[0], p[1], p[2]))), 60, 0.0026, 8), M.cable, null, null, g);
  cable([[0.05, -0.1, 0.062], [0.05, -0.25, 0.07], [-0.1, -0.38, 0.0], [-0.4, -0.36, -0.15], [fp.x + 0.03, fp.y + 0.03, fp.z]]);
  cable([[0.072, -0.1, 0.066], [0.07, -0.3, 0.1], [-0.15, -0.45, 0.2], [-0.5, -0.34, 0.26], [zp.x + 0.03, zp.y + 0.03, zp.z]]);
  // casque du cadreur, accroché au manche droit
  const hp = R.a0.clone().lerp(R.a1, 0.45);
  const headset = put(new THREE.Group(), [hp.x, hp.y - 0.06, hp.z], null, g, 'intercom');
  mesh(new THREE.TorusGeometry(0.075, 0.006, 8, 32, Math.PI), M.black, [0, 0.04, 0], [0, 0, 0], headset);
  for (const s of [-1, 1]) mesh(cylZ(0.035, 0.03), M.rubber, [s * 0.075, 0.035, 0], [0, 0, 0], headset);
  headset.rotation.y = 0.9;
  return { group: g, focusDemand, zoomDemand, wheel, thumb };
}

// =================================================================================
// Assemblage
// =================================================================================
/**
 * Construit la caméra sur son pied. Renvoie la racine (à poser au sol, axe à AXIS_H), les pièces
 * animées et les réglages : set({ zoom, focus, iris, ff, ext, macro, nd, tally }).
 */
export function buildRig() {
  const M = makeMaterials();
  const root = new THREE.Group(); root.name = 'caméra sur pied';
  const cam = new THREE.Group(); cam.name = 'caméra'; cam.position.y = AXIS_H; root.add(cam);
  const L = buildLens(M), B = buildBody(M), V = buildViewfinder(M), I = buildInternals(), R = buildRays(), S = buildSupport(M);
  cam.add(L.lens, B.body, V.vf, I.group, R.group, S.group);
  L.updateInner();

  // vue éclatée : chaque pièce s'écarte de sa place
  const EXPL = [
    [L.lens, [0.17, 0, 0]], [L.hood, [0.07, 0, 0]], [L.servo, [0, -0.02, 0.06]], [B.coverL, [0, 0, -0.13]], [B.coverR, [0, 0, 0.13]], [B.panel, [0, 0, -0.09]],
    [B.handle, [0, 0.13, 0]], [V.vf, [-0.08, 0.15, 0]], [B.rear, [-0.12, 0, 0]], [I.P.filter, [0.07, 0.03, 0]], [I.P.olpf, [0.045, 0, 0]],
    [I.P.boards, [-0.04, 0.05, 0]], [I.P.bA, [0, 0, -0.05]], [I.P.bB, [0, 0, 0.05]], [I.P.sB, [0, 0.025, 0]], [I.P.sR, [0, -0.025, 0]], [I.P.sG, [-0.03, 0, 0]],
  ].map(([o, d]) => ({ o, base: o.position.clone(), d: new THREE.Vector3(d[0], d[1], d[2]) }));
  // matières de la coque : coupées par le plan de coupe, rendues transparentes dans la vue éclatée
  // (une matière qui sert aussi au viseur, au support ou à l'intérieur est dédoublée : la coupe ne touche qu'à la coque)
  const keep = new Set(); for (const grp of [V.vf, S.group, I.P.prism, I.P.filter, L.inner]) grp.traverse((o) => { if (o.isMesh) keep.add(o.material); });
  const shellMats = new Set(), dup = new Map();
  for (const grp of [B.body, L.barrel, L.hood, L.servo, I.P.boards]) grp.traverse((o) => {
    if (!o.isMesh) return;
    if (keep.has(o.material)) { if (!dup.has(o.material)) dup.set(o.material, o.material.clone()); o.material = dup.get(o.material); }
    shellMats.add(o.material);
  });
  for (const m of shellMats) m.userData.side0 = m.side;

  const cutPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const state = { zoom: 0.5, focus: 0.1, iris: 4, ff: 0, ext: false, macro: false, nd: 0, tally: 'off', explode: 0, cut: false };
  const rig = {
    root, cam, M, lens: L, body: B, vf: V, internals: I, rays: R, support: S, state, cutPlane,
    /** réglages de l'objectif et de la caméra, reportés sur les bagues et les pièces internes */
    set(o) {
      Object.assign(state, o);
      L.rings.zoom.userData.set(state.zoom);
      L.rings.focus.userData.set(state.focus);
      L.rings.iris.userData.set(state.iris >= 99 ? 1.13 : L.rings.iris.userData.p(state.iris));
      L.rings.ff.userData.set(state.ff);
      L.rings.ext.userData.set(state.ext);
      L.rings.macro.rotation.x = state.macro ? -0.35 : 0;
      if (L.irisDisc.userData.n !== state.iris) {
        L.irisDisc.userData.n = state.iris; L.irisDisc.geometry.dispose();
        const hole = state.iris >= 99 ? 0.0004 : 0.0125 * 1.8 / state.iris;
        L.irisDisc.geometry = new THREE.RingGeometry(hole, 0.03, 48, 1).rotateY(Math.PI / 2);
      }
      Object.assign(L.lensState, { zoom: state.zoom, focus: state.focus, ff: state.ff, ext: state.ext });
      L.updateInner();
      I.P.wheel.rotation.x = state.nd * Math.PI / 2;
      const on = state.tally === 'pgm' ? 0xff2a1a : state.tally === 'pvw' ? 0x22ff55 : 0x000000;
      V.tallyMat.emissive.setHex(on); V.tallyMat.emissiveIntensity = on ? 2.2 : 0;
    },
    /** vue éclatée : 0 = assemblée, 1 = éclatée */
    setExplode(t) {
      state.explode = t;
      const e = t * t * (3 - 2 * t);
      for (const p of EXPL) p.o.position.copy(p.base).addScaledVector(p.d, e);
      B.shellMat.transparent = e > 0.001; B.shellMat.opacity = 1 - 0.85 * e; B.shellMat.depthWrite = e < 0.5;
    },
    /** vue en coupe : la moitié gauche de la coque et de l'objectif disparaît, la lumière se montre */
    setCut(on) {
      state.cut = on; R.group.visible = on;
      for (const m of shellMats) { m.clippingPlanes = on ? [cutPlane] : null; m.side = on ? THREE.DoubleSide : m.userData.side0; m.needsUpdate = true; }
    },
    /** à chaque image : plan de coupe dans le repère du monde, lumière qui avance */
    update(dt) {
      cam.updateMatrixWorld();
      const n = new THREE.Vector3(0, 0, 1).transformDirection(cam.matrixWorld), o = new THREE.Vector3().setFromMatrixPosition(cam.matrixWorld);
      cutPlane.setFromNormalAndCoplanarPoint(n, o);
      if (R.group.visible) for (const m of R.mats) m.map.offset.x -= dt * 1.6;
    },
  };
  rig.set({});
  return rig;
}

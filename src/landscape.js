// @ts-check
import * as THREE from 'three';
import { makeCanvas, mulberry32 } from './util.js';
import { S } from './state.js';

// ----------------------------------------------------------------------------------
// Paysage autour du stade : grand sol (jusqu'à l'horizon, fondu dans la brume) avec une carte
// « macro » (parcelles agricoles, routes, quartiers), arbres instanciés (bois, haies, arbres
// d'alignement), terrils érodés.
// ----------------------------------------------------------------------------------
const EXT = 5800; // côté de la carte macro (m)

function noise2(seed) {
  const r = mulberry32(seed); const P = new Float32Array(512); for (let i = 0; i < 512; i++) P[i] = r();
  const h = (x, y) => P[((x * 73856093) ^ (y * 19349663)) & 511];
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}

// carte macro : 1 px ≈ 5,7 m
function macroTexture() {
  const N = 1024, c = makeCanvas(N, N), g = c.getContext('2d'), r = mulberry32(404);
  const px = (m) => (m / EXT + 0.5) * N; // mètres → pixels
  g.fillStyle = '#5f7a43'; g.fillRect(0, 0, N, N);
  // parcelles : bandes allongées orientées par îlots (openfield du bassin minier)
  const fields = ['#6f8a46', '#7d9150', '#a39a5c', '#8f7f58', '#5d7a3f', '#b4a865', '#6a7f3e', '#94895a', '#55703a'];
  for (let k = 0; k < 140; k++) {
    const cx = r() * N, cy = r() * N, ang = r() * Math.PI, L = 40 + r() * 90, Wd = 30 + r() * 60;
    g.save(); g.translate(cx, cy); g.rotate(ang);
    const n = 3 + Math.floor(r() * 5);
    for (let i = 0; i < n; i++) { g.fillStyle = fields[Math.floor(r() * fields.length)]; g.fillRect(-L / 2, -Wd / 2 + (i * Wd) / n, L, Wd / n + 0.6); }
    g.restore();
  }
  // grain
  for (let i = 0; i < 40000; i++) { const v = r(); g.fillStyle = v < 0.5 ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,230,0.05)'; g.fillRect(r() * N, r() * N, 2, 2); }
  // quartiers (cités minières, centre-ville) : gris-brun parsemé de jardins
  const urban = (x, z, rad) => {
    const gr = g.createRadialGradient(px(x), px(z), 0, px(x), px(z), (rad / EXT) * N);
    gr.addColorStop(0, 'rgba(112,104,92,0.95)'); gr.addColorStop(0.7, 'rgba(108,104,90,0.7)'); gr.addColorStop(1, 'rgba(108,104,90,0)');
    g.fillStyle = gr; g.fillRect(0, 0, N, N);
    for (let i = 0; i < rad / 6; i++) { const a = r() * 6.28, d = r() * rad * 0.9; g.fillStyle = r() < 0.5 ? 'rgba(80,110,60,0.55)' : 'rgba(140,128,112,0.5)'; g.fillRect(px(x + Math.cos(a) * d), px(z + Math.sin(a) * d), 3, 3); }
  };
  urban(0, 0, 700); urban(650, -500, 420); urban(-500, -250, 300); urban(400, 700, 350); urban(-200, 900, 300); urban(1400, 200, 380);
  // routes et voie ferrée
  g.lineCap = 'round';
  const road = (pts, w, col) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); pts.forEach(([x, z], i) => (i ? g.lineTo(px(x), px(z)) : g.moveTo(px(x), px(z)))); g.stroke(); };
  road([[-2900, -900], [-800, -300], [0, -160], [900, 300], [2900, 1100]], 2.2, '#77777a');
  road([[-1400, 2900], [-600, 600], [-150, 130], [200, -400], [700, -2900]], 2.2, '#77777a');
  road([[-2900, 1600], [-1200, 900], [600, 600], [2900, -200]], 1.6, '#808083');
  road([[-112, -2900], [-112, 2900]], 1.4, '#5d564e');
  for (let k = 0; k < 26; k++) { const x = (r() - 0.5) * EXT, z = (r() - 0.5) * EXT; road([[x, z], [x + (r() - 0.5) * 900, z + (r() - 0.5) * 900]], 1, '#86847a'); }
  // autoroute A21 (rocade minière) au nord
  road([[-2900, 1250], [-900, 1180], [1000, 1320], [2900, 1250]], 3, '#6c6c70');
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

// grand sol : texture de détail répétée × carte macro qui prend le relais au loin
export function buildGround(scene, detailTex) {
  const macro = macroTexture();
  const mat = new THREE.MeshStandardMaterial({ map: detailTex, roughness: 0.97, metalness: 0, polygonOffset: true, polygonOffsetFactor: 6, polygonOffsetUnits: 12 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.tMacro = { value: macro };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vGW;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGW = (modelMatrix * vec4(position, 1.0)).xz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D tMacro; varying vec2 vGW;')
      .replace('#include <map_fragment>', `#include <map_fragment>
  {
    vec3 mac = texture2D(tMacro, vGW / ${EXT}.0 + 0.5).rgb;
    float l = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722)) / 0.09;
    float k = smoothstep(170.0, 420.0, length(vGW));
    diffuseColor.rgb = mix(diffuseColor.rgb, mac * (0.7 + 0.3 * l), k);
  }`);
  };
  mat.customProgramCacheKey = () => 'ground-macro';
  const ground = new THREE.Mesh(new THREE.CircleGeometry(2900, 72), mat);
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.06; ground.receiveShadow = true;
  // les UV du disque vont de 0 à 1 sur 5 800 m : on répète le détail comme l'ancien sol (28 × sur 1 400 m)
  detailTex.repeat.set(116, 116);
  scene.add(ground);
  return ground;
}

// ------------------------------- arbres -------------------------------
// un arbre = tronc + couronne en 3 masses irrégulières ; couleurs par sommet (ombre en bas de la couronne)
function treeGeometry(kind = 0, lod = 0) {
  const parts = [];
  const nz = noise2(91 + kind);
  const trunk = new THREE.CylinderGeometry(0.16, 0.26, 3.2, lod ? 4 : 6, 1, lod > 0); trunk.translate(0, 1.6, 0);
  parts.push([trunk, new THREE.Color(0x4a3b2d), new THREE.Color(0x2f251c)]);
  // lod 1 (arbres lointains) : une seule masse, ~90 triangles
  const blobs = kind === 1 ? [[0, 6.2, 0, 1.6, 3.2]] : lod ? [[0, 5.0, 0, 2.7, 2.4]] : [[0, 4.6, 0, 2.5, 2.2], [0.9, 5.6, 0.4, 1.9, 1.8], [-0.8, 5.4, -0.6, 1.8, 1.7]];
  for (const [x, y, z, rad, ry] of blobs) {
    const g = new THREE.IcosahedronGeometry(rad, 1);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const vx = p.getX(i), vy = p.getY(i), vz = p.getZ(i);
      const k = 0.82 + 0.36 * nz(vx * 1.3 + 7, vz * 1.3 + vy * 0.7);
      p.setXYZ(i, vx * k, vy * k * (ry / rad), vz * k);
    }
    g.translate(x, y, z);
    parts.push([g, new THREE.Color(0x5a8a45), new THREE.Color(0x2d4a24)]);
  }
  // fusion avec couleurs (dégradé vertical : bas de couronne plus sombre)
  const pos = [], nor = [], col = [];
  for (const [g0, top, bot] of parts) {
    const g = g0.index ? g0.toNonIndexed() : g0; // normales d'origine : couronnes arrondies
    const p = g.attributes.position, n = g.attributes.normal;
    g.computeBoundingBox(); const y0 = g.boundingBox.min.y, y1 = g.boundingBox.max.y;
    const c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i));
      c.copy(bot).lerp(top, (p.getY(i) - y0) / Math.max(0.01, y1 - y0)); col.push(c.r, c.g, c.b);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return geo;
}

// pts : [x, z, échelle, type (0 feuillu, 1 peuplier)] ; regroupés par secteur pour que les caméras
// n'envoient au GPU que ce qu'elles voient
export function buildTrees(scene, pts, { shadows = false, sectors = 8, lod = 0, layer = 0 } = {}) {
  const geos = [treeGeometry(0, lod), treeGeometry(1, lod)];
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 });
  const r = mulberry32(17);
  const groups = new Map();
  for (const p of pts) {
    const sec = Math.floor(((Math.atan2(p[1], p[0]) + Math.PI) / (Math.PI * 2)) * sectors) % sectors;
    const key = sec * 2 + (p[3] || 0);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color(), e = new THREE.Euler();
  const tints = [0xffffff, 0xe8f0d8, 0xd8e8c8, 0xf4f0d0, 0xc8dcc0];
  const out = [];
  for (const [key, list] of groups) {
    const mesh = new THREE.InstancedMesh(geos[key % 2], mat, list.length);
    list.forEach(([x, z, s], i) => {
      e.set((r() - 0.5) * 0.08, r() * 6.28, (r() - 0.5) * 0.08); q.setFromEuler(e);
      const sx = s * (0.85 + r() * 0.3);
      m.compose(new THREE.Vector3(x, -0.05, z), q, new THREE.Vector3(sx, s * (0.85 + r() * 0.35), sx));
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, c.setHex(tints[Math.floor(r() * tints.length)]));
    });
    mesh.castShadow = shadows; mesh.receiveShadow = shadows;
    mesh.computeBoundingSphere();
    if (layer) mesh.layers.set(layer); // calque 2 : vue « œil » seulement, les caméras du stade ne les calculent pas
    scene.add(mesh); out.push(mesh);
  }
  return out;
}

// bois, haies et arbres de quartier entre 180 m et 2,6 km
export function forestPoints(busy) {
  const r = mulberry32(2024), pts = [];
  const dens = S.lite ? 0.25 : S.quality === 'basse' ? 0.5 : 1;
  const ok = (x, z) => { const d = Math.hypot(x, z); return d > 175 && d < 2700 && !busy(x, z); };
  // bois : amas
  for (let k = 0; k < 46; k++) {
    const a = r() * 6.28, d = 420 + r() * 2100, cx = Math.cos(a) * d, cz = Math.sin(a) * d;
    const n = Math.floor((25 + r() * 70) * dens), sp = 25 + r() * 55;
    for (let i = 0; i < n; i++) { const x = cx + (r() + r() + r() - 1.5) * sp, z = cz + (r() + r() + r() - 1.5) * sp; if (ok(x, z)) pts.push([x, z, 1 + r() * 0.8, r() < 0.12 ? 1 : 0]); }
  }
  // haies et alignements le long de chemins
  for (let k = 0; k < 60; k++) {
    const a = r() * 6.28, d = 300 + r() * 2200, x0 = Math.cos(a) * d, z0 = Math.sin(a) * d, ang = r() * 6.28, L = 120 + r() * 380;
    const poplar = r() < 0.3, step = poplar ? 9 : 13;
    for (let t = 0; t < L; t += step / dens) { const x = x0 + Math.cos(ang) * t, z = z0 + Math.sin(ang) * t; if (ok(x, z)) pts.push([x, z, 0.9 + r() * 0.5, poplar ? 1 : 0]); }
  }
  // arbres de jardin dans les cités
  for (let k = 0; k < 520 * dens; k++) { const a = r() * 6.28, d = 160 + r() * 520, x = Math.cos(a) * d, z = Math.sin(a) * d; if (ok(x, z)) pts.push([x, z, 0.7 + r() * 0.5, r() < 0.1 ? 1 : 0]); }
  return pts;
}

// ------------------------------- terrils -------------------------------
// cône de schiste érodé : ravines, sommet arrondi, pied colonisé par la végétation
export function terrilGeometry(h, rad, seed) {
  const nz = noise2(seed), seg = 72, rings = 26;
  const pos = [], col = [], idx = [];
  const slag = new THREE.Color(0x2b2826), slag2 = new THREE.Color(0x3a3430), veg = new THREE.Color(0x4a5a30), veg2 = new THREE.Color(0x5d6b3a);
  const c = new THREE.Color();
  for (let j = 0; j <= rings; j++) {
    const t = j / rings; // 0 = pied, 1 = sommet
    const prof = Math.pow(1 - t, 0.92) * (1 - 0.18 * Math.pow(t, 6));
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const gully = 1 - 0.05 * Math.pow(Math.abs(Math.sin(a * 9 + nz(i * 0.2, t * 3) * 3)), 3) * (1 - t);
      const rr = rad * prof * gully * (0.94 + 0.12 * nz(Math.cos(a) * 3 + 5, Math.sin(a) * 3 + t * 4));
      const y = h * (1 - Math.pow(1 - t, 1.0)) * (0.97 + 0.03 * nz(i * 0.3, j * 0.5));
      pos.push(Math.cos(a) * rr, y, Math.sin(a) * rr);
      const vg = Math.max(0, Math.min(1, (0.28 - t) * 4 + (nz(i * 0.4 + 9, j * 0.6) - 0.5) * 1.4));
      c.copy(slag).lerp(slag2, nz(i * 0.9, j * 0.9)).lerp(nz(i * 0.7, j) > 0.5 ? veg : veg2, vg * 0.85);
      col.push(c.r, c.g, c.b);
    }
  }
  for (let j = 0; j < rings; j++) for (let i = 0; i < seg; i++) {
    const a = j * seg + i, b = j * seg + ((i + 1) % seg), cc = (j + 1) * seg + i, d = (j + 1) * seg + ((i + 1) % seg);
    idx.push(a, cc, b, b, cc, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

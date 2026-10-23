// @ts-check
import * as THREE from 'three';
import { S } from './state.js';

// ----------------------------------------------------------------------------------
// Matières procédurales : le relief (carte de normales), la rugosité et une légère variation de
// teinte sont générés en code, sans aucun fichier, et plaqués en triplanaire (par la position dans
// le monde). Les géométries fusionnées du Builder, qui n'ont pas d'UV, en profitent telles quelles.
// Une matière = une recette (tôle peinte, alu brossé, caoutchouc…) + une couleur + une échelle.
// En qualité Basse (et en mode lite), le matériau reste uni : le relief se coupe sans recompiler
// la scène (MATIERE.setDetail), et les cartes ne sont générées qu'à la première demande.
// ----------------------------------------------------------------------------------

export const MATIERE = {
  /** relief et rugosité actifs (qualité Moyenne et Haute) */
  detail: true,
  /** @type {Set<THREE.MeshStandardMaterial>} */
  all: new Set(),
  /** @type {Map<string, { nrm: THREE.DataTexture, srf: THREE.DataTexture }>} */
  cache: new Map(),
  setDetail(on) {
    MATIERE.detail = !!on;
    for (const m of MATIERE.all) { m.userData.detailOn = MATIERE.detail; if (m.userData.apply) m.userData.apply(); else m.needsUpdate = true; }
  },
};

// ------------------------------- bruit tuilable -------------------------------
// bruit de valeur sur une grille périodique : toute fréquence multiple de la base reste tuilable
const h2 = (x, y, seed) => { const s = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453; return s - Math.floor(s); };
const sm = (t) => t * t * (3 - 2 * t);
/** bruit de valeur périodique (période p cellules en x, py en y), x et y en cellules */
export function noise(x, y, p, seed = 0, py = p) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const fx = sm(x - xi), fy = sm(y - yi);
  const x0 = ((xi % p) + p) % p, y0 = ((yi % py) + py) % py, x1 = (x0 + 1) % p, y1 = (y0 + 1) % py;
  const a = h2(x0, y0, seed), b = h2(x1, y0, seed), c = h2(x0, y1, seed), d = h2(x1, y1, seed);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
/** bruit fractal périodique : u, v dans [0,1[, p cellules de base, oct octaves */
export function fbm(u, v, p, oct = 4, seed = 0, gain = 0.5) {
  let s = 0, a = 1, f = p, n = 0;
  for (let i = 0; i < oct; i++) { s += a * noise(u * f, v * f, f, seed + i); n += a; a *= gain; f *= 2; }
  return s / n;
}

// ------------------------------- cartes -------------------------------
/**
 * Carte de normales (tangente) d'un champ de hauteur tuilable, par différences finies circulaires.
 * @param {Float32Array} h hauteurs (n × n), en « unités de pixel »
 * @param {number} n
 * @param {number} k amplitude (pente par unité de hauteur)
 */
export function normalsFromHeight(h, n, k) {
  const out = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) {
    const ym = (y + n - 1) % n, yp = (y + 1) % n;
    for (let x = 0; x < n; x++) {
      const xm = (x + n - 1) % n, xp = (x + 1) % n;
      const dx = (h[y * n + xp] - h[y * n + xm]) * k, dy = (h[yp * n + x] - h[ym * n + x]) * k;
      const l = Math.hypot(dx, dy, 1);
      const i = (y * n + x) * 4;
      out[i] = Math.round((-dx / l * 0.5 + 0.5) * 255); out[i + 1] = Math.round((-dy / l * 0.5 + 0.5) * 255); out[i + 2] = Math.round((1 / l * 0.5 + 0.5) * 255); out[i + 3] = 255;
    }
  }
  return out;
}
function dataTex(data, n, srgb = false) {
  const t = new THREE.DataTexture(data, n, n, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true; t.anisotropy = 4; if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

/**
 * Une recette : hauteur (relief), rugosité (× 2 : 0,5 = neutre), teinte (× 2 : 0,5 = neutre),
 * pour (u, v) dans [0,1[ ; n = définition ; k = amplitude des normales ; scale = mètres par tuile.
 * @typedef {{ n?: number, k: number, scale: number, rough?: number, metal?: number, strength?: number, h: (u: number, v: number) => number, r?: (u: number, v: number, h: number) => number, a?: (u: number, v: number, h: number) => number }} Recette
 */
/** @type {Record<string, (seed: number) => Recette>} */
export const RECETTES = {
  // tôle peinte (peau d'orange légère) : parois, caisse du car, mobilier métallique
  tole: (s) => ({ k: 1.6, scale: 0.6, rough: 0.5, h: (u, v) => fbm(u, v, 24, 3, s) * 0.5 + fbm(u, v, 96, 2, s + 9) * 0.25, r: (u, v) => 0.5 + (fbm(u, v, 6, 3, s + 20) - 0.5) * 0.08 }),
  // tôle nervurée (flancs de caisse) : nervures verticales adoucies + peau d'orange
  nervure: (s) => ({ k: 1.1, scale: 1.0, rough: 0.45, h: (u, v) => { const t = Math.abs(((u * 8) % 1) - 0.5) * 2; return Math.pow(Math.min(1, Math.max(0, (t - 0.8) / 0.2)), 1.4) * 1.6 + fbm(u, v, 48, 2, s) * 0.3; } }),
  // aluminium brossé : stries fines dans un sens
  alu: (s) => ({ k: 1.2, scale: 0.4, rough: 0.42, metal: 0.9, h: (u, v) => noise(u * 4, v * 240, 4, s, 240) * 0.6 + noise(u * 16, v * 480, 16, s + 3, 480) * 0.4, r: (u, v) => 0.5 + (noise(u * 6, v * 180, 6, s + 7, 180) - 0.5) * 0.35 }),
  // plastique grainé : façades d'appareils, boîtiers
  plastique: (s) => ({ k: 1.1, scale: 0.25, rough: 0.6, h: (u, v) => fbm(u, v, 64, 3, s, 0.55), r: (u, v) => 0.5 + (fbm(u, v, 16, 2, s + 4) - 0.5) * 0.2 }),
  // stratifié de bureau : grain très fin, micro-rayures
  stratifie: (s) => ({ k: 0.7, scale: 0.8, rough: 0.5, h: (u, v) => fbm(u, v, 128, 2, s, 0.5) * 0.6 + noise(u * 300, v * 6, 300, s + 2, 6) * 0.2, r: (u, v) => 0.5 + (fbm(u, v, 5, 3, s + 11) - 0.5) * 0.3, a: (u, v) => 0.5 + (fbm(u, v, 3, 3, s + 5) - 0.5) * 0.06 }),
  // caoutchouc à pastilles (sol du car)
  caoutchouc: (s) => ({ k: 1.4, scale: 0.35, rough: 0.78, h: (u, v) => { const r = 2 / 7; const cx = ((u * 7) % 1) - 0.5, cy = ((v * 7 + Math.floor(u * 7) * 0.5) % 1) - 0.5; const d = Math.hypot(cx, cy) / r; return (d < 1 ? Math.sqrt(1 - d * d) * 1.2 : 0) + fbm(u, v, 96, 2, s) * 0.25; }, r: (u, v) => 0.5 + (fbm(u, v, 4, 3, s + 1) - 0.5) * 0.2 }),
  // moquette : bouclette dense, aucun reflet
  moquette: (s) => ({ k: 1.3, scale: 0.3, rough: 0.96, h: (u, v) => fbm(u, v, 96, 3, s, 0.6), a: (u, v) => 0.5 + (fbm(u, v, 4, 3, s + 8) - 0.5) * 0.12 }),
  // bitume : gravillons et plaques d'usure
  bitume: (s) => ({ k: 1.5, scale: 1.6, rough: 0.9, h: (u, v) => fbm(u, v, 160, 3, s, 0.55) * 0.7 + fbm(u, v, 12, 3, s + 2) * 0.3, r: (u, v) => 0.5 + (fbm(u, v, 3, 4, s + 6) - 0.5) * 0.28, a: (u, v) => 0.5 + (fbm(u, v, 2, 4, s + 9) - 0.5) * 0.3 }),
  // béton : grain, pores, légères traces de coffrage
  beton: (s) => ({ k: 1.2, scale: 1.2, rough: 0.85, h: (u, v) => fbm(u, v, 80, 3, s) * 0.5 + Math.pow(Math.max(0, fbm(u, v, 40, 2, s + 3) - 0.62), 1.0) * -3, a: (u, v) => 0.5 + (fbm(u, v, 3, 4, s + 4) - 0.5) * 0.2 }),
  // mousse acoustique : pyramides
  mousse: (s) => ({ k: 3.2, scale: 0.25, rough: 0.95, h: (u, v) => 2 * Math.min(1 - Math.abs(((u * 6) % 1) * 2 - 1), 1 - Math.abs(((v * 6) % 1) * 2 - 1)) + fbm(u, v, 64, 2, s) * 0.15 }),
  // tissu de siège : tissage fin
  tissu: (s) => ({ k: 1.0, scale: 0.2, rough: 0.9, h: (u, v) => 0.5 + 0.25 * Math.sin(u * 2 * Math.PI * 120) + 0.25 * Math.sin(v * 2 * Math.PI * 120) + fbm(u, v, 32, 2, s) * 0.3, a: (u, v) => 0.5 + (fbm(u, v, 6, 3, s + 3) - 0.5) * 0.08 }),
  // acier thermolaqué (baies) : grain mat
  laque: (s) => ({ k: 0.9, scale: 0.4, rough: 0.55, metal: 0.15, h: (u, v) => fbm(u, v, 96, 3, s, 0.5), r: (u, v) => 0.5 + (fbm(u, v, 8, 2, s + 2) - 0.5) * 0.15 }),
  // tôle larmée (marches, seuils)
  larme: (s) => ({ k: 2.6, scale: 0.3, rough: 0.5, metal: 0.8, h: (u, v) => { let m = 0; for (let i = 0; i < 2; i++) { const a = i ? 0.25 : 0; const x = ((u * 5 + a) % 1), y = ((v * 5 + a + (i ? 0.5 : 0)) % 1); const d = Math.hypot((x - 0.5) * 1.6, (y - 0.5) * 0.45); m = Math.max(m, d < 0.22 ? 1 - d / 0.22 : 0); } return m * 1.5 + fbm(u, v, 64, 2, s) * 0.2; } }),
  // sièges de tribune (mode UV : 4 rangs par tuile, 8 sièges par rang, comme la texture des sièges) :
  // coque relevée aux bords arrondis, dossier plus haut, contremarche en creux
  sieges: (s) => ({ k: 2.4, scale: 1, rough: 0.6, h: (u, v) => {
    const row = (((1 - v) * 4) % 1 + 1) % 1, seat = ((u * 8) % 1 + 1) % 1; // row : 0 en haut de la rangée (dossier), 1 en bas (marche)
    const inX = seat > 0.1 && seat < 0.9 ? Math.min(1, Math.min(seat - 0.1, 0.9 - seat) / 0.08) : 0;
    const inY = row > 0.28 && row < 0.56 ? Math.min(1, Math.min(row - 0.28, 0.56 - row) / 0.06) : 0;
    const back = row > 0.28 && row < 0.36 ? 1 : 0;
    const tread = row > 0.69 ? -0.8 : 0;
    return inX * inY * (1.2 + back * 0.8) + tread + fbm(u, v, 64, 2, s) * 0.12;
  } }),
  // gradins en béton de la tribune debout : marches (nez arrondi) et barrières
  gradins: (s) => ({ k: 2.0, scale: 1, rough: 0.85, h: (u, v) => { const row = (((1 - v) * 4) % 1 + 1) % 1; const step = row > 0.69 ? -1.0 : 0; const nez = row > 0.62 && row <= 0.69 ? -(row - 0.62) / 0.07 : 0; return step + nez + fbm(u, v, 80, 3, s) * 0.3; } }),
  // herbe tondue (relief fin seulement)
  herbe: (s) => ({ k: 1.0, scale: 0.5, rough: 0.9, h: (u, v) => fbm(u, v, 128, 3, s, 0.6), a: (u, v) => 0.5 + (fbm(u, v, 6, 3, s + 1) - 0.5) * 0.14 }),
};

/** génère (ou retrouve) les cartes d'une recette */
export function cartes(key, seed = 1, n = 256) {
  const id = `${key}:${seed}:${n}`;
  const got = MATIERE.cache.get(id); if (got) return got;
  const R = RECETTES[key](seed);
  const h = new Float32Array(n * n); const srf = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const u = x / n, v = y / n; const hv = R.h(u, v);
    h[y * n + x] = hv;
    const i = (y * n + x) * 4;
    srf[i] = Math.round(Math.min(1, Math.max(0, R.r ? R.r(u, v, hv) : 0.5)) * 255);
    srf[i + 1] = Math.round(Math.min(1, Math.max(0, R.a ? R.a(u, v, hv) : 0.5)) * 255);
    srf[i + 2] = 128; srf[i + 3] = 255;
  }
  const out = { nrm: dataTex(normalsFromHeight(h, n, R.k), n), srf: dataTex(srf, n) };
  MATIERE.cache.set(id, out);
  return out;
}

// ------------------------------- matériau -------------------------------
const VERT = `
#include <worldpos_vertex>
{ vec4 p4 = vec4(transformed, 1.0); vec3 n3 = objectNormal;
  #ifdef USE_INSTANCING
    p4 = instanceMatrix * p4; n3 = mat3(instanceMatrix) * n3;
  #endif
  p4 = modelMatrix * p4; vTriP = p4.xyz; vTriN = normalize(mat3(modelMatrix) * n3); }`;
// poids des trois projections et lecture de la carte de surface (rugosité, teinte)
const FRAG_BEGIN = `
#include <map_fragment>
vec3 triW = abs(normalize(vTriN)); triW = triW * triW * triW * triW; triW /= (triW.x + triW.y + triW.z);
vec3 triP = vTriP * uTri.x;
vec4 triS = texture2D(tSrf, triP.zy) * triW.x + texture2D(tSrf, triP.xz) * triW.y + texture2D(tSrf, triP.xy) * triW.z;
diffuseColor.rgb *= mix(1.0, triS.g * 2.0, uTri.w);`;
const FRAG_ROUGH = `
float roughnessFactor = roughness * mix(1.0, triS.r * 2.0, uTri.z);`;
const FRAG_NORMAL = `
{
  vec3 wn = normalize(vTriN);
  #ifdef DOUBLE_SIDED
    wn *= faceDirection;
  #endif
  vec3 tx = texture2D(tNrm, triP.zy).xyz * 2.0 - 1.0;
  vec3 ty = texture2D(tNrm, triP.xz).xyz * 2.0 - 1.0;
  vec3 tz = texture2D(tNrm, triP.xy).xyz * 2.0 - 1.0;
  tx.xy *= uTri.y; ty.xy *= uTri.y; tz.xy *= uTri.y;
  // mélange « whiteout » : les tangentes de chaque projection sont les axes du monde
  tx = vec3(tx.xy + wn.zy, abs(tx.z) * wn.x);
  ty = vec3(ty.xy + wn.xz, abs(ty.z) * wn.y);
  tz = vec3(tz.xy + wn.xy, abs(tz.z) * wn.z);
  vec3 wN = normalize(tx.zyx * triW.x + ty.xzy * triW.y + tz.xyz * triW.z);
  normal = normalize((viewMatrix * vec4(wN, 0.0)).xyz);
}`;

/**
 * Un matériau physique habillé d'une recette.
 * @param {string} key recette (RECETTES)
 * @param {{ color?: number | THREE.Color, roughness?: number, metalness?: number, scale?: number, strength?: number, seed?: number, vertexColors?: boolean, side?: THREE.Side, emissive?: number, emissiveIntensity?: number, transparent?: boolean, opacity?: number, name?: string, rough?: number, tint?: number, n?: number, map?: THREE.Texture | null, polygonOffset?: number, alphaTest?: number, uv?: boolean, repeat?: number[] }} [o]
 */
export function matiere(key, o = {}) {
  const R = RECETTES[key](o.seed ?? 1);
  const m = new THREE.MeshStandardMaterial({
    color: o.color ?? 0xffffff, roughness: o.roughness ?? R.rough ?? 0.6, metalness: o.metalness ?? R.metal ?? 0,
    vertexColors: o.vertexColors ?? true, side: o.side ?? THREE.FrontSide, emissive: o.emissive ?? 0x000000, emissiveIntensity: o.emissiveIntensity ?? 1,
    transparent: !!o.transparent, opacity: o.opacity ?? 1, map: o.map || null, alphaTest: o.alphaTest ?? 0,
    polygonOffset: !!o.polygonOffset, polygonOffsetFactor: -(o.polygonOffset || 0), polygonOffsetUnits: -(o.polygonOffset || 0),
  });
  m.name = o.name || key;
  if (S.lite) return m; // mode allégé : uni, et jamais de relief
  if (o.uv) {
    // mode UV : la carte de normales suit les UV du maillage (alignée sur sa texture de teinte)
    const c = cartes(key, o.seed ?? 1, o.n);
    const nrm = c.nrm.clone(); nrm.needsUpdate = true;
    if (o.repeat) nrm.repeat.set(o.repeat[0], o.repeat[1]); else if (o.map) nrm.repeat.copy(o.map.repeat);
    const k = o.strength ?? 1;
    m.userData.recette = key; m.userData.uvNormal = nrm; m.userData.uvScale = k; m.userData.detailOn = MATIERE.detail;
    const apply = () => { m.normalMap = m.userData.detailOn ? nrm : null; m.normalScale.set(k, k); m.needsUpdate = true; };
    m.userData.apply = apply; apply();
    MATIERE.all.add(m);
    return m;
  }
  const u = { tNrm: { value: null }, tSrf: { value: null }, uTri: { value: new THREE.Vector4(1 / (o.scale ?? R.scale), o.strength ?? 1, o.rough ?? 1, o.tint ?? 1) } };
  m.userData.detailOn = MATIERE.detail; m.userData.tri = u; m.userData.recette = key;
  m.onBeforeCompile = (sh) => {
    if (!m.userData.detailOn) return;
    if (!u.tNrm.value) { const c = cartes(key, o.seed ?? 1, o.n); u.tNrm.value = c.nrm; u.tSrf.value = c.srf; }
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTriP; varying vec3 vTriN;')
      .replace('#include <worldpos_vertex>', VERT);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTriP; varying vec3 vTriN; uniform sampler2D tNrm, tSrf; uniform vec4 uTri;')
      .replace('#include <map_fragment>', FRAG_BEGIN)
      .replace('#include <roughnessmap_fragment>', FRAG_ROUGH)
      .replace('#include <normal_fragment_maps>', FRAG_NORMAL);
  };
  m.customProgramCacheKey = () => `matiere-${m.userData.detailOn ? 1 : 0}`;
  MATIERE.all.add(m);
  return m;
}

/** la qualité graphique courante autorise-t-elle le relief ? */
export const detailOk = () => !S.lite && S.quality !== 'basse';

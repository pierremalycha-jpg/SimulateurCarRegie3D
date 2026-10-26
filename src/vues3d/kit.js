// @ts-check
import * as THREE from 'three';
import { matiere } from '../matiere.js';
import { Builder, roundedBox } from '../geo.js';

// ----------------------------------------------------------------------------------
// Les outils communs des vues 3D : matières (toujours par matiere(), relief procédural et
// triplanaire), pièces de matériel (Builder en mode ao, arêtes arrondies, occlusion cuite), textes
// et écrans dessinés dans un canevas, câbles (tubes le long d'une courbe), zones translucides, flèches,
// et le flux : des paquets, des mots ou des impulsions qui avancent le long d'une courbe (un seul
// maillage instancié par flux). Couleurs : les mêmes que les schémas 2D du Cours.
// ----------------------------------------------------------------------------------
export const FONT = '"Archivo Narrow", "Arial Narrow", sans-serif';
export const MONO = '"B612 Mono", Menlo, Consolas, monospace';

/** palette commune (schémas du Cours, cours/sdi.js) */
export const COUL = {
  sav: 0x7fd1a0, eav: 0xff8a80, video: 0xffd38a, chroma: 0x8ab8ff, ln: 0x7fd3f3, hanc: 0x6f7a84, audio: 0xd08cff, vanc: 0x4fb3a8,
  cuivre: 0xd08a4a, dielec: 0xe8ebe4, tresse: 0xa7adb3, gaine: 0x2b3036, rouge: 0xe0453a, bleu: 0x3f7fe6, vert: 0x3fcf6e,
  ambre: 0xffb020, cyan: 0x4cc3e6, gris: 0x59646f, sombre: 0x1d2227, blanc: 0xf2f3ee, violet: 0x9a7bff, rose: 0xff6fb1,
};
export const hex = (c) => '#' + c.toString(16).padStart(6, '0');

/** matière d'une pièce simple (géométrie sans couleur par sommet) */
export const mat = (key, color, o = {}) => matiere(key, { color, vertexColors: false, ...o });
/** matière lumineuse (paquets, lumière, voyants) : elle brille un peu dans la pénombre */
export const lum = (color, k = 0.9, o = {}) => matiere('plastique', { color, emissive: color, emissiveIntensity: k, vertexColors: false, roughness: 0.4, ...o });
/** matière d'un signal (mots, paquets, impulsions, lumière dans une fibre) : unie, sans éclairage ni reflet, elle
 *  garde sa couleur (et la couleur de chaque instance d'un flux) dans la pénombre comme sous un projecteur */
export const eclat = (color = 0xffffff, opacity = 1) => new THREE.MeshBasicMaterial({ color, toneMapped: false, transparent: opacity < 1, opacity });
/** matière translucide (zones, gaines coupées, verre) */
export const verre = (color, opacity = 0.18, o = {}) => matiere('plastique', { color, vertexColors: false, transparent: true, opacity, roughness: 0.2, ...o });

/**
 * Une pièce de matériel : un Builder en mode ao (arêtes arrondies, occlusion cuite), une seule matière
 * (une famille de matière = une pièce fusionnée et nommée).
 * @param {string} name
 * @param {string} key recette de matiere()
 * @param {(b: Builder) => void} fill
 * @param {{ ao?: number, mat?: any }} [o]
 */
export function piece(name, key, fill, o = {}) {
  const b = new Builder({ ao: o.ao ?? 0.03 });
  fill(b);
  const m = b.mesh(matiere(key, { color: 0xffffff, ...(o.mat || {}) }));
  m.name = name;
  return m;
}

/** un texte posé dans la scène (sérigraphie, étiquette sur un appareil) : un plan de h mètres de haut */
export function texte(str, o = {}) {
  const px = o.px ?? 64, h = o.h ?? 0.08;
  const font = `${o.weight ?? 600} ${px}px ${o.mono ? MONO : FONT}`;
  const c = document.createElement('canvas'); let g = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
  g.font = font;
  const pad = o.bg ? px * 0.45 : px * 0.15;
  c.width = Math.max(8, Math.ceil(g.measureText(str).width + pad * 2)); c.height = Math.ceil(px * 1.35);
  g = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
  if (o.bg) { g.fillStyle = o.bg; g.beginPath(); g.roundRect(0, 0, c.width, c.height, px * 0.25); g.fill(); }
  g.font = font; g.fillStyle = o.color ?? '#e8ece6'; g.textBaseline = 'middle'; g.textAlign = 'center';
  g.fillText(str, c.width / 2, c.height / 2 + px * 0.04);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(h * c.width / c.height, h), new THREE.MeshBasicMaterial({ map: t, transparent: true, toneMapped: false, depthWrite: false, side: o.double ? THREE.DoubleSide : THREE.FrontSide }));
  m.name = 'texte ' + str;
  m.renderOrder = 2;
  return m;
}

/**
 * Un écran : un plan dont l'image est dessinée dans un canevas (moniteur, afficheur, table MAC…).
 * @param {number} w largeur (m)
 * @param {number} h hauteur (m)
 * @param {number} pw largeur du canevas (px)
 * @param {(g: CanvasRenderingContext2D, W: number, H: number) => void} draw
 */
export function ecran(w, h, pw, draw) {
  const c = document.createElement('canvas'); c.width = pw; c.height = Math.round(pw * h / w);
  const g = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, toneMapped: false }));
  const E = { mesh, g, W: c.width, H: c.height, draw, redraw() { E.draw(g, c.width, c.height); t.needsUpdate = true; } };
  E.redraw();
  return E;
}

/** une courbe passant par des points ([x, y, z] ou vecteurs) */
export function courbe(pts, closed = false) {
  return new THREE.CatmullRomCurve3(pts.map((p) => (Array.isArray(p) ? new THREE.Vector3(p[0], p[1], p[2]) : p.clone())), closed, 'centripetal');
}
/** un câble : un tube le long d'une courbe */
export function tube(curve, r, material, seg = 64, radial = 12) {
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, seg, r, radial, false), material);
  m.userData.curve = curve;
  return m;
}
/** un câble entre deux points, avec un peu de mou (il pend de sag mètres au milieu) */
export function cableEntre(a, b, r, material, sag = 0.12, o = {}) {
  const A = Array.isArray(a) ? new THREE.Vector3(a[0], a[1], a[2]) : a.clone(), B = Array.isArray(b) ? new THREE.Vector3(b[0], b[1], b[2]) : b.clone();
  const out = o.out ?? 0.12; // le câble sort de la prise avant de plonger
  const da = o.da || new THREE.Vector3(0, 0, 1), db = o.db || new THREE.Vector3(0, 0, 1);
  const A1 = A.clone().addScaledVector(da, out), B1 = B.clone().addScaledVector(db, out);
  const M = A1.clone().add(B1).multiplyScalar(0.5); M.y -= sag;
  const curve = courbe([A, A1, M, B1, B]);
  return tube(curve, r, material, 72, 10);
}

/** une zone translucide aux arêtes arrondies, soulignée par ses arêtes (VLAN, sous-réseau, domaine) */
export function zone(w, h, d, color, o = {}) {
  const g = new THREE.Group(); g.name = o.name || 'zone';
  const m = new THREE.Mesh(roundedBox(w, h, d, Math.min(o.r ?? 0.12, w / 2, h / 2, d / 2), 3), verre(color, o.opacity ?? 0.1, { depthWrite: false }));
  m.renderOrder = 1; g.add(m);
  const e = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)), new THREE.LineBasicMaterial({ color, transparent: true, opacity: o.edge ?? 0.55 }));
  g.add(e);
  g.userData.fill = m; g.userData.edges = e;
  return g;
}

/** une flèche de a vers b (tige et pointe) */
export function fleche(a, b, color, r = 0.015, material = null) {
  const A = Array.isArray(a) ? new THREE.Vector3(a[0], a[1], a[2]) : a.clone(), B = Array.isArray(b) ? new THREE.Vector3(b[0], b[1], b[2]) : b.clone();
  const dir = B.clone().sub(A); const L = dir.length(); dir.normalize();
  const head = Math.min(L * 0.35, r * 6);
  const g = new THREE.Group(); const M = material || lum(color, 0.6);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(r, r, L - head, 10), M); shaft.position.copy(A).addScaledVector(dir, (L - head) / 2);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(r * 2.6, head, 14), M); cone.position.copy(A).addScaledVector(dir, L - head / 2);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); shaft.quaternion.copy(q); cone.quaternion.copy(q);
  g.add(shaft, cone); g.name = 'flèche';
  return g;
}

/** libère tout ce qu'un groupe a créé (géométries, matières, images dessinées) */
export function libere(root) {
  root.traverse((o) => {
    const any = /** @type {any} */ (o);
    if (any.geometry) any.geometry.dispose();
    const ms = Array.isArray(any.material) ? any.material : any.material ? [any.material] : [];
    for (const m of ms) { if (m.map && m.map.isTexture) m.map.dispose(); m.dispose(); }
    if (any.isInstancedMesh) any.dispose();
  });
}

// ---------------- le flux : des objets qui avancent le long d'une courbe ----------------
const QX = new THREE.Vector3(1, 0, 0), Vt = new THREE.Vector3(), Vp = new THREE.Vector3(), Qd = new THREE.Quaternion(), Sd = new THREE.Vector3(), Md = new THREE.Matrix4(), Cd = new THREE.Color();
/** longueur d'une courbe, gardée sur la courbe */
const lenOf = (c) => { const u = /** @type {any} */ (c).userData || (/** @type {any} */ (c).userData = {}); return u.len || (u.len = c.getLength()); };
/** la même courbe parcourue dans l'autre sens */
export function inverse(c) {
  c.userData = c.userData || {};
  if (!c.userData.rev) {
    const pts = c.getSpacedPoints(64).reverse();
    const r = new THREE.CatmullRomCurve3(pts, false, 'centripetal'); r.userData = { rev: c };
    c.userData.rev = r;
  }
  return c.userData.rev;
}
/**
 * @typedef {{ curve: THREE.Curve<THREE.Vector3>, speed: number, t?: number, delay?: number, color: number, scale?: number | number[], loop?: boolean,
 *   from?: number, to?: number, onEnd?: (it: any) => void, info?: { nom: string, texte?: string }, data?: any, slot?: number }} FluxItem
 */
export class Flux {
  /**
   * @param {number} max objets au plus
   * @param {THREE.BufferGeometry} geo forme d'un objet (orientée le long de x)
   * @param {THREE.Material} material
   */
  constructor(max, geo, material) {
    this.max = max;
    this.mesh = new THREE.InstancedMesh(geo, material, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0; this.mesh.frustumCulled = false; this.mesh.name = 'flux';
    this.mesh.userData.flux = this;
    /** @type {FluxItem[]} */
    this.items = [];
    this.mesh.setColorAt(0, Cd.set(0xffffff));
  }
  /** @param {FluxItem} it */
  add(it) {
    if (this.items.length >= this.max) this.items.shift();
    const o = { t: 0, delay: 0, from: 0, to: 1, ...it };
    o.t = Math.max(o.t, o.from);
    this.items.push(o);
    return o;
  }
  clear() { this.items.length = 0; this.mesh.count = 0; }
  update(dt) {
    const keep = [];
    for (const it of this.items) {
      if (it.delay > 0) { it.delay -= dt; keep.push(it); continue; }
      it.t += it.speed * dt / lenOf(it.curve);
      if (it.t >= it.to) {
        if (it.loop) it.t = it.from + ((it.t - it.from) % (it.to - it.from));
        else { if (it.onEnd) it.onEnd(it); continue; }
      }
      keep.push(it);
    }
    this.items = keep;
    let n = 0;
    for (const it of this.items) {
      if (it.delay > 0) continue;
      const t = Math.min(1, Math.max(0, it.t));
      it.curve.getPointAt(t, Vp); it.curve.getTangentAt(t, Vt);
      Qd.setFromUnitVectors(QX, Vt.normalize());
      const s = it.scale ?? 1; if (Array.isArray(s)) Sd.set(s[0], s[1], s[2]); else Sd.setScalar(s);
      Md.compose(Vp, Qd, Sd);
      this.mesh.setMatrixAt(n, Md); this.mesh.setColorAt(n, Cd.set(it.color));
      it.slot = n; n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
  /** l'objet affiché à l'instance i (pour un clic) */
  at(i) { return this.items.find((it) => it.slot === i && !(it.delay > 0)) || null; }
}

// @ts-check
import * as THREE from 'three';
import { makeCanvas } from '../util.js';
import { matiere } from '../matiere.js';

// ----------------------------------------------------------------------------------
// Outils des pupitres en 3D (poste3d/) : un champ de touches en deux maillages instanciés
// (le corps de la touche, et son dessus lumineux qui porte la légende), des surfaces dessinées
// (sérigraphie, OLED, écrans) et la géométrie dont le moteur a besoin pour placer les zones
// cliquables de l'interface par-dessus la 3D. Repère du plateau : x vers la droite de
// l'opérateur, z vers lui, y vers le haut ; la surface du plateau est à y = 0.
// ----------------------------------------------------------------------------------

export const FONT = '"Barlow Condensed", "Arial Narrow", sans-serif';

/** surface dessinée : un plan du plateau et son canevas (texture), à redessiner à volonté */
export function canvasPlane(parent, w, d, x, z, y, pxW, pxH, o = {}) {
  const c = makeCanvas(pxW, pxH); const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  // écran ou afficheur : lumineux par lui-même (sans éclairage ni courbe filmique) ; sérigraphie : matière du plateau
  const mat = o.lit
    ? new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, transparent: !!o.transparent })
    : matiere('plastique', { uv: true, map: tex, vertexColors: false, roughness: o.roughness ?? 0.62, name: o.name || 'pupitre-serigraphie' });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
  m.rotation.x = -Math.PI / 2; m.position.set(x, y, z);
  m.name = o.name || 'surface';
  parent.add(m);
  return { c, g, tex, mesh: m, dirty() { tex.needsUpdate = true; } };
}

/** rectangle arrondi plein ou tracé */
export function rr(g, x, y, w, h, r, fill, stroke, lw = 2) {
  g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h);
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); }
}
export function txt(g, s, x, y, size, color, align = 'center', weight = 600) {
  g.font = `${weight} ${size}px ${FONT}`; g.fillStyle = color; g.textAlign = align; g.textBaseline = 'middle'; g.fillText(s, x, y);
}

// ---------------- champ de touches ----------------
// Chaque touche : { x, z, w, d, color, legend } (mètres, repère du plateau). Le corps est en matière
// plastique ; le dessus lumineux (MeshBasicMaterial, hors courbe filmique) prend une couleur par instance :
// éteinte (teinte grisée), allumée (couleur pleine), survolée (plus claire). La légende vient d'un atlas
// (une case par légende) : un attribut d'instance décale les UV du dessus vers sa case.
const CELL = 128, COLS = 8;
const DIM = new THREE.Color(0.5, 0.52, 0.55);
export function keyField(parent, keys, o = {}) {
  const h = o.h ?? 0.012; // hauteur des touches au-dessus du plateau
  const n = keys.length;
  // atlas des légendes : case 0 = vierge ; légendes identiques partagées
  const legends = [''];
  for (const k of keys) if (k.legend && !legends.includes(k.legend)) legends.push(k.legend);
  const rows = Math.ceil(legends.length / COLS);
  const atlas = makeCanvas(CELL * COLS, CELL * rows); const g = atlas.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, atlas.width, atlas.height);
  const cellOf = new Map();
  legends.forEach((s, i) => {
    cellOf.set(s, i); if (!s) return;
    const k = keys.find((x) => x.legend === s);
    const cx = (i % COLS) * CELL, cy = Math.floor(i / COLS) * CELL;
    // la case couvre tout le dessus de la touche : on compense son allongement pour garder les lettres droites
    g.save(); g.translate(cx + CELL / 2, cy + CELL / 2); g.scale(1, k.w / k.d);
    const lines = s.split('\n'); const fs = lines.length > 1 ? 34 : (s.length > 5 ? 36 : 46);
    lines.forEach((l, j) => txt(g, l, 0, (j - (lines.length - 1) / 2) * fs * 1.02, fs, '#15181c', 'center', 700));
    g.restore();
  });
  const tex = new THREE.CanvasTexture(atlas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;

  const capMat = matiere('plastique', { seed: 21, scale: 0.08, strength: 0.5, roughness: 0.55, vertexColors: false, color: 0x2b2f35, name: (o.name || 'touches') + '-corps' });
  const caps = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), capMat, n);
  caps.name = (o.name || 'touches') + '-corps';
  const topMat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
  topMat.onBeforeCompile = (sh) => {
    sh.uniforms.uCell = { value: new THREE.Vector2(1 / COLS, 1 / rows) };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 aCell; uniform vec2 uCell;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvMapUv = vMapUv * uCell + aCell;');
  };
  topMat.customProgramCacheKey = () => 'poste3d-touches';
  const topGeo = new THREE.PlaneGeometry(1, 1); topGeo.rotateX(-Math.PI / 2);
  const cell = new Float32Array(n * 2);
  const tops = new THREE.InstancedMesh(topGeo, topMat, n);
  tops.name = (o.name || 'touches') + '-dessus';
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), Sc = new THREE.Vector3();
  const base = [], cur = [];
  keys.forEach((k, i) => {
    const kh = k.h ?? h;
    M.compose(P.set(k.x, kh / 2, k.z), Q, Sc.set(k.w, kh, k.d)); caps.setMatrixAt(i, M);
    M.compose(P.set(k.x, kh + 0.0004, k.z), Q, Sc.set(k.w * 0.9, 1, k.d * 0.88)); tops.setMatrixAt(i, M);
    const ci = cellOf.get(k.legend || '') || 0;
    cell[i * 2] = (ci % COLS) / COLS; cell[i * 2 + 1] = 1 - (Math.floor(ci / COLS) + 1) / rows;
    const c = new THREE.Color(k.color ?? 0xffffff); base.push(c); cur.push(-1);
    tops.setColorAt(i, new THREE.Color().copy(c).lerp(DIM, 0.72).multiplyScalar(0.3));
  });
  // l'atlas est rangé de haut en bas, les UV de bas en haut : la case i commence à 1 − (ligne + 1) / lignes
  tops.geometry.setAttribute('aCell', new THREE.InstancedBufferAttribute(cell, 2));
  parent.add(caps, tops);
  const col = new THREE.Color();
  const F = {
    keys, caps, tops, hot: -1,
    /** état d'une touche : 0 éteinte, 1 allumée, 0,5 à demi (mémoire occupée, mode choisi), survol en plus */
    set(i, level) {
      const hot = i === F.hot ? 1 : 0; const key = level * 10 + hot;
      if (cur[i] === key) return; cur[i] = key;
      const c = base[i];
      if (level >= 1) col.copy(c).multiplyScalar(1.25);
      else if (level > 0) col.copy(c).lerp(DIM, 0.3).multiplyScalar(0.6);
      else col.copy(c).lerp(DIM, 0.72).multiplyScalar(0.3);
      if (hot) col.lerp(new THREE.Color(1, 1, 1), 0.28).multiplyScalar(1.15);
      tops.setColorAt(i, col); F.dirty = true;
    },
    dirty: false,
    flush() { if (F.dirty && tops.instanceColor) { tops.instanceColor.needsUpdate = true; F.dirty = false; } },
    /** coins (repère du plateau) du dessus de la touche i : sert à placer sa zone cliquable à l'écran */
    corners(i) { const k = keys[i]; const y = (k.h ?? h) + 0.0004; return [[k.x - k.w / 2, y, k.z - k.d / 2], [k.x + k.w / 2, y, k.z - k.d / 2], [k.x + k.w / 2, y, k.z + k.d / 2], [k.x - k.w / 2, y, k.z + k.d / 2]]; },
  };
  return F;
}

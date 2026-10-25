// @ts-check
import * as THREE from 'three';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Builder } from '../geo.js';
import { matiere } from '../matiere.js';

// ----------------------------------------------------------------------------------
// Le téléphone en 3D : un smartphone tenu devant soi, dessiné par son propre petit rendu (un
// canevas posé par-dessus tout, même un poste ou le plan) ; son écran est une vraie page HTML
// (CSS3DRenderer), placée sur la vitre par la même caméra : elle suit le téléphone quand on le
// lève ou qu'on le range. Au repos, le téléphone fait face à l'œil et l'écran est à l'échelle 1
// (texte net). Sans WebGL, l'écran seul s'affiche, avec un cadre dessiné en CSS.
// Dimensions d'un smartphone courant (ordre de grandeur) : 74 × 154 × 8 mm, écran 68 × 148 mm.
// ----------------------------------------------------------------------------------
const BW = 0.0744, BH = 0.1544, BD = 0.0083; // boîtier (m)
const SW = 0.068, SH = 0.148; // écran (m)
/** taille de l'écran HTML en pixels CSS, au repos sur un grand écran (échelle 1) */
export const SCREEN_PX = { w: 340, h: 740 };
const FOV = 28;

/** contour arrondi (rayon r) d'un rectangle centré */
function rounded(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
/** plaque arrondie extrudée, chanfreinée, centrée en z */
function plaque(w, h, r, d, bevel) {
  const g = new THREE.ExtrudeGeometry(rounded(w - 2 * bevel, h - 2 * bevel, Math.max(0.001, r - bevel)), { depth: Math.max(0.0002, d - 2 * bevel), bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 8 });
  g.translate(0, 0, -(d - 2 * bevel) / 2);
  return g;
}

/** le modèle : boîtier en aluminium, vitre noire, boutons, module photo au dos */
function buildPhone() {
  const g = new THREE.Group(); g.name = 'telephone';
  // boîtier : cadre en aluminium et dos (une seule pièce)
  const alu = new Builder({ ao: 0.006, small: 0.004 });
  alu.add(plaque(BW, BH, 0.011, BD, 0.0016), null, 0x5a6068);
  // boutons : volume à gauche, marche à droite
  alu.cbox(0.0012, 0.011, 0.0034, -BW / 2 - 0.0003, 0.032, 0, 0x6a7078, 0.0005);
  alu.cbox(0.0012, 0.011, 0.0034, -BW / 2 - 0.0003, 0.018, 0, 0x6a7078, 0.0005);
  alu.cbox(0.0012, 0.016, 0.0034, BW / 2 + 0.0003, 0.026, 0, 0x6a7078, 0.0005);
  // module photo au dos (visible quand le téléphone bascule)
  alu.cbox(0.03, 0.03, 0.0014, -0.016, 0.054, -BD / 2 - 0.0006, 0x3c4148, 0.004);
  const boitier = alu.mesh(matiere('alu', { color: 0xffffff, roughness: 0.32, metalness: 0.85, name: 'telephone-alu' }));
  boitier.name = 'telephone-boitier';
  // vitre et pièces noires : vitre avant, objectifs, port USB-C et haut-parleur sous le téléphone
  const noir = new Builder({ ao: 0.006, small: 0.004 });
  noir.add(plaque(BW - 0.0018, BH - 0.0018, 0.0102, 0.0008, 0.0003), new THREE.Matrix4().makeTranslation(0, 0, BD / 2 - 0.0002), 0x07080a);
  for (const [x, y] of [[-0.0235, 0.061], [-0.0235, 0.047], [-0.0095, 0.054]]) noir.cyl(0.0052, 0.0052, 0.0012, x, y, -BD / 2 - 0.0016, 0x101215, 18, Math.PI / 2);
  noir.cbox(0.009, 0.0016, 0.0032, 0, -BH / 2 + 0.0004, 0, 0x020203, 0.0007);
  for (let i = 0; i < 5; i++) noir.cyl(0.0006, 0.0006, 0.002, 0.012 + i * 0.0022, -BH / 2 + 0.0004, 0, 0x020203, 6);
  const verre = noir.mesh(matiere('plastique', { color: 0xffffff, roughness: 0.08, metalness: 0, strength: 0.15, name: 'telephone-verre' }));
  verre.name = 'telephone-verre';
  g.add(boitier, verre);
  return g;
}

/**
 * Le rendu du téléphone : canevas WebGL (le boîtier) et calque CSS 3D (l'écran HTML), dans un
 * conteneur plein écran. pose(t) : 0 = rangé (sous l'écran, basculé), 1 = tenu devant soi.
 * @param {HTMLElement} host conteneur plein écran
 * @param {HTMLElement} screen l'écran HTML (SCREEN_PX)
 */
export function createPhone3D(host, screen) {
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.01, 5);
  const css = new CSS3DRenderer(); css.domElement.classList.add('tel-css');
  const cssScene = new THREE.Scene();
  const obj = new CSS3DObject(screen);
  obj.scale.setScalar(SW / SCREEN_PX.w);
  const holder = new THREE.Group(); cssScene.add(holder); holder.add(obj);
  /** @type {THREE.WebGLRenderer | null} */
  let gl = null; let scene = null, phone = null;
  try {
    gl = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
    gl.setClearColor(0x000000, 0);
    gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.1;
    gl.domElement.classList.add('tel-gl');
    scene = new THREE.Scene();
    // reflets : une pièce éclairée procédurale (aucun fichier), une lampe au-dessus de l'épaule
    const pm = new THREE.PMREMGenerator(gl); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose();
    const key = new THREE.DirectionalLight(0xffffff, 1.4); key.position.set(0.6, 1, 0.8); scene.add(key, new THREE.AmbientLight(0x8090a0, 0.3));
    phone = buildPhone(); scene.add(phone);
    host.append(gl.domElement);
  } catch (e) { gl = null; host.classList.add('tel-2d'); }
  host.append(css.domElement);

  const R = { w: 1, h: 1, f: 1, rest: new THREE.Vector3(), dist: 0.5, k: 1 };
  /** recalcule la place du téléphone au repos : écran à l'échelle 1 si la fenêtre le permet */
  function resize() {
    const w = window.innerWidth, h = window.innerHeight, m = 16;
    R.w = w; R.h = h; camera.aspect = w / h; camera.updateProjectionMatrix();
    R.f = (h / 2) / Math.tan((FOV / 2) * Math.PI / 180);
    // hauteur de l'écran à l'écran, bornée par la hauteur et la largeur de la fenêtre
    const hpx = Math.min(SCREEN_PX.h, (h - 2 * m) * SH / BH, (w - 2 * m) * SH / BW);
    R.k = hpx / SCREEN_PX.h;
    R.dist = SH * R.f / hpx;
    const bw = hpx * BW / SH, bh = hpx * BH / SH;
    // à droite sur un écran large (comme dans un jeu), au centre sinon ; posé en bas
    const cx = w >= 820 ? w - m - 28 - bw / 2 : w / 2, cy = h - m - bh / 2;
    R.rest.set((cx - w / 2) * R.dist / R.f, -(cy - h / 2) * R.dist / R.f, -R.dist);
    if (gl) { gl.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); gl.setSize(w, h, false); }
    css.setSize(w, h);
  }
  const P = new THREE.Vector3(), E = new THREE.Euler();
  /** @param {number} t 0 = rangé, 1 = en main */
  function pose(t) {
    const u = 1 - t;
    P.copy(R.rest); P.y -= u * BH * 1.25; P.x += u * BW * 0.35;
    E.set(-0.95 * u, -0.25 * u, 0.22 * u);
    for (const o of [holder, phone]) { if (!o) continue; o.position.copy(P); o.rotation.copy(E); }
    // l'écran HTML, juste devant la vitre
    obj.position.set(0, 0, BD / 2 + 0.0002);
  }
  function render() {
    if (gl && scene) gl.render(scene, camera);
    css.render(cssScene, camera);
  }
  resize();
  return { resize, pose, render, get scale() { return R.k; }, get webgl() { return !!gl; } };
}

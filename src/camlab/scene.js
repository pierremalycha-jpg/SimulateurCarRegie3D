// @ts-check
import * as THREE from 'three';
import { mulberry32 } from '../util.js';
import { AXIS_H, FOCAL_PLANE } from './model.js';
import { MIRE_D } from './optics.js';

// ----------------------------------------------------------------------------------
// Le plateau du module caméra, comme sur les photos de l'établissement : rideaux bleu nuit, un
// fond vert, des flight cases, un projecteur bleu posé au sol. Devant la caméra, la mire en
// étoile sur son chevalet, à 3 m du plan des capteurs. Derrière, le coin de la vision : CCU,
// RCP, moniteur de référence et moniteur de forme d'onde, reliés à la caméra par la fibre.
// L'image de la caméra est vraiment calculée : une seconde vue rendue dans une texture, puis
// « traitée » par un petit shader (exposition, balance des blancs, flou de mise au point,
// courbe de la caméra), affichée dans le viseur et sur le moniteur.
// ----------------------------------------------------------------------------------

const MIRE_X = FOCAL_PLANE + MIRE_D;

const std = (color, roughness, metalness = 0, o = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness, ...o });
function put(obj, pos, rot, parent, point) {
  if (pos) obj.position.set(pos[0], pos[1], pos[2]);
  if (rot) obj.rotation.set(rot[0], rot[1], rot[2]);
  if (point) obj.userData.point = point;
  obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  if (parent) parent.add(obj);
  return obj;
}
const mesh = (geo, mat, pos, rot, parent, point) => put(new THREE.Mesh(geo, mat), pos, rot, parent, point);
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
const FONT = '"Archivo Narrow", "Arial Narrow", sans-serif';

// ---------------- l'image de la caméra : le « traitement » ----------------
const SCREEN_VS = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const SCREEN_FS = `
uniform sampler2D map; uniform float blur; uniform float exposure; uniform vec3 wb; uniform float vignette; uniform float power; uniform float bars; uniform float range; uniform vec2 texel;
uniform float chan; uniform vec2 zebra;
varying vec2 vUv;
const int N = 24;
vec3 tap(vec2 uv) { return texture2D(map, clamp(uv, vec2(0.001), vec2(0.999))).rgb; }
// barres de couleur 75 % (ce que la caméra envoie quand on choisit BARS)
vec3 colorBars(vec2 uv) {
  float i = floor(uv.x * 7.0);
  vec3 c = vec3(i == 0.0 || i == 1.0 || i == 4.0 || i == 5.0 ? 1.0 : 0.0, i < 4.0 ? 1.0 : 0.0, mod(i, 2.0) < 0.5 ? 1.0 : 0.0);
  return c * 0.75;
}
void main() {
  if (power < 0.5) { gl_FragColor = vec4(0.01, 0.012, 0.014, 1.0); return; }
  vec3 c;
  if (bars > 0.5) { c = colorBars(vUv); }
  else {
    // flou de mise au point : disque de rayon « blur » (en pixels de l'image), échantillonné en spirale
    c = tap(vUv);
    if (blur > 0.3) {
      vec3 s = vec3(0.0);
      for (int i = 0; i < N; i++) { float f = (float(i) + 0.5) / float(N); float a = float(i) * 2.39996; s += tap(vUv + vec2(cos(a), sin(a)) * sqrt(f) * blur * texel); }
      c = s / float(N);
    }
    // lumière reçue (iris, ND, gain), balance des blancs, puis courbe de la caméra (BT.709 et coude)
    c = max(c * exposure * wb, 0.0);
    c = mix(4.5 * c, 1.099 * pow(c, vec3(0.45)) - 0.099, step(0.018, c));
    c = mix(c, 0.85 + (c - 0.85) * 0.22, step(0.85, c));
    c = min(c, vec3(1.09));
  }
  // viseur : une seule voie (VF OUT Y, R, G ou B), puis les zébras entre zebra.x et zebra.y
  if (chan > 0.5) { float v = chan < 1.5 ? dot(c, vec3(0.2126, 0.7152, 0.0722)) : chan < 2.5 ? c.r : chan < 3.5 ? c.g : c.b; c = vec3(v); }
  float L = dot(min(c, vec3(1.0)), vec3(0.2126, 0.7152, 0.0722));
  if (L >= zebra.x && L <= zebra.y && mod(gl_FragCoord.x + gl_FragCoord.y, 10.0) < 4.0) c = vec3(0.92);
  float v = 1.0 - vignette * pow(length(vUv - 0.5) * 1.25, 3.0);
  gl_FragColor = vec4(min(c * range, vec3(1.0)) * v, 1.0);
}`;
/** matière d'un écran qui montre l'image de la caméra (viseur, moniteur) */
export function screenMaterial(tex, w, h, vignette = 0) {
  return new THREE.ShaderMaterial({
    uniforms: { map: { value: tex }, blur: { value: 0 }, exposure: { value: 1 }, wb: { value: new THREE.Vector3(1, 1, 1) }, vignette: { value: vignette }, power: { value: 1 }, bars: { value: 0 }, range: { value: 1 }, chan: { value: 0 }, zebra: { value: new THREE.Vector2(9, 9) }, texel: { value: new THREE.Vector2(1 / w, 1 / h) } },
    vertexShader: SCREEN_VS, fragmentShader: SCREEN_FS, toneMapped: false,
  });
}

// ---------------- décor ----------------
/** rideau plissé : plan dont les plis verticaux sont creusés dans la géométrie */
function curtain(w, h, color, seed, sheen = 0x3a4a86) {
  const g = new THREE.PlaneGeometry(w, h, Math.round(w * 24), 6), p = g.attributes.position, r = mulberry32(seed);
  const ph = Array.from({ length: 8 }, () => r() * 6.28);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    const z = Math.sin(x * 25 + ph[0]) * 0.045 + Math.sin(x * 11.3 + ph[1]) * 0.03 + Math.sin(x * 4.1 + ph[2]) * 0.05 * (1 - (y + h / 2) / h * 0.5);
    p.setZ(i, z);
  }
  g.computeVertexNormals();
  return new THREE.Mesh(g, new THREE.MeshPhysicalMaterial({ color, roughness: 0.92, sheen: 1, sheenRoughness: 0.6, sheenColor: sheen }));
}
/** flight case : panneaux sombres, cornières et coins d'aluminium */
function flightCase(w, h, d, panel, M, seed) {
  const g = new THREE.Group();
  mesh(box(w - 0.01, h - 0.01, d - 0.01), std(panel, 0.6, 0.1), [0, h / 2, 0], null, g);
  const e = 0.022;
  for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    mesh(box(e, h, e), M.alu, [x * (w / 2 - e / 2), h / 2, z * (d / 2 - e / 2)], null, g);
    mesh(box(w, e, e), M.alu, [0, x > 0 ? h - e / 2 : e / 2, z * (d / 2 - e / 2)], null, g);
    mesh(box(e, e, d), M.alu, [x * (w / 2 - e / 2), z > 0 ? h - e / 2 : e / 2, 0], null, g);
    for (const y of [e, h - e]) mesh(new THREE.SphereGeometry(0.02, 12, 8), M.chrome, [x * (w / 2 - 0.005), y, z * (d / 2 - 0.005)], null, g);
  }
  mesh(box(0.12, 0.05, 0.012), M.chrome, [0, h * 0.6, d / 2 + 0.006], null, g);
  const r = mulberry32(seed); if (r() > 0.4) mesh(box(0.07, 0.05, 0.002), std(0xc33a32, 0.6), [w * 0.25, h * 0.7, d / 2 + 0.006], null, g);
  return g;
}

/** la mire en étoile de Siemens, avec son échelle de gris */
function mireTexture() {
  return canvasTex(1024, 1024, (g, W, H) => {
    g.fillStyle = '#f2f2ee'; g.fillRect(0, 0, W, H);
    const cx = W / 2, cy = H * 0.46, R = W * 0.36, n = 36;
    g.fillStyle = '#111';
    for (let i = 0; i < n; i++) { const a0 = i / n * Math.PI * 2, a1 = (i + 0.5) / n * Math.PI * 2; g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, R, a0, a1); g.closePath(); g.fill(); }
    g.strokeStyle = '#111'; g.lineWidth = 4; g.beginPath(); g.arc(cx, cy, R + 10, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#f2f2ee'; g.beginPath(); g.arc(cx, cy, 5, 0, Math.PI * 2); g.fill();
    for (let i = 0; i < 11; i++) { const v = Math.round(255 * Math.pow(i / 10, 1 / 1.1)); g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(W * 0.08 + i * W * 0.0764, H * 0.88, W * 0.0764, H * 0.06); }
    g.strokeStyle = '#111'; g.lineWidth = 3; g.strokeRect(W * 0.08, H * 0.88, W * 0.84, H * 0.06);
    g.fillStyle = '#111'; g.font = `600 ${W * 0.026}px ${FONT}`; g.textAlign = 'left'; g.fillText('MIRE DE MISE AU POINT · ÉTOILE DE SIEMENS 36 RAYONS', W * 0.08, H * 0.055);
    for (const [x, y] of [[0.05, 0.08], [0.95, 0.08], [0.05, 0.82], [0.95, 0.82]]) { g.fillRect(W * x - 22, H * y - 2, 44, 4); g.fillRect(W * x - 2, H * y - 22, 4, 44); }
  });
}

/** écran d'appareil : un plan dessiné, redessinable (voyants, menus) */
function panelTex(w, h, draw) { const t = canvasTex(w, h, draw); return t; }

// =================================================================================
/**
 * Construit le plateau autour de la caméra. renderer : pour l'environnement de reflets et
 * l'image de la caméra. Renvoie la scène, la vue de la caméra et ses écrans.
 */
export function buildStudio(renderer, rig, quality = 'moyenne') {
  const scene = new THREE.Scene(); scene.name = 'plateau';
  scene.background = new THREE.Color(0x07090c);
  scene.fog = new THREE.Fog(0x07090c, 9, 20);
  const M = rig.M;
  scene.add(rig.root);

  // sol, rideaux bleu nuit, fond vert, gaffer au sol
  const floor = mesh(new THREE.PlaneGeometry(16, 16), std(0x26282b, 0.86, 0.02), [0, 0, 0], [-Math.PI / 2, 0, 0], scene);
  floor.castShadow = false; floor.name = 'sol';
  const navy = 0x18224a;
  put(curtain(11, 4.2, navy, 3), [4.7, 2.1, 0], [0, -Math.PI / 2, 0], scene);
  put(curtain(9, 4.2, navy, 5), [0.2, 2.1, -4.6], [0, 0, 0], scene);
  put(curtain(5, 4.2, navy, 7), [-4.6, 2.1, -2.2], [0, Math.PI / 2, 0], scene);
  put(curtain(3.4, 4.2, 0x1f8a3a, 9, 0x3fdc6a), [3.2, 2.1, 4.3], [0, Math.PI + 0.35, 0], scene);
  for (const [x, z, a] of [[1.4, 0.0, 0], [1.4, 0.04, Math.PI / 2]]) mesh(box(0.3, 0.002, 0.05), std(0xd8c33a, 0.7), [x, 0.001, z], [0, a, 0], scene);

  // flight cases (à gauche de la caméra, comme sur les photos)
  put(flightCase(0.62, 0.55, 0.5, 0x2b1d33, M, 1), [-0.6, 0, -1.7], [0, 0.2, 0], scene);
  put(flightCase(0.62, 0.5, 0.5, 0x332b2e, M, 2), [-0.6, 0.55, -1.7], [0, 0.15, 0], scene);
  put(flightCase(0.4, 0.95, 0.42, 0x2f3236, M, 3), [-1.35, 0, -2.1], [0, -0.3, 0], scene);
  put(flightCase(0.35, 0.85, 0.12, 0x9ba0a6, M, 4), [0.9, 0, -3.3], [0.0, 0.5, -0.12], scene);

  // projecteur LED bleu posé au sol
  const par = put(new THREE.Group(), [1.6, 0, -2.9], [0, -0.6, 0], scene);
  mesh(new THREE.CylinderGeometry(0.11, 0.1, 0.09, 24), std(0x111214, 0.5, 0.3), [0, 0.12, 0], [0.9, 0, 0], par);
  mesh(new THREE.CircleGeometry(0.095, 24), new THREE.MeshBasicMaterial({ color: 0x3a6bff }), [0, 0.165, 0.035], [0.9 - Math.PI / 2, 0, 0], par);
  mesh(new THREE.TorusGeometry(0.12, 0.008, 6, 16, Math.PI), M.metalDark, [0, 0.07, 0], [0, Math.PI / 2, 0], par);
  const blue = new THREE.PointLight(0x3a6bff, 8, 5, 2); blue.position.set(1.6, 0.4, -2.6); scene.add(blue);

  // la mire sur son chevalet, centrée sur l'axe, à 3 m du plan des capteurs
  const mire = put(new THREE.Group(), [MIRE_X, 0, 0], null, scene, 'mire');
  mesh(box(0.02, 0.62, 0.62), std(0x1b1c1e, 0.7), [0.012, AXIS_H, 0], null, mire);
  mesh(new THREE.PlaneGeometry(0.6, 0.6), std(0xffffff, 0.82, 0, { map: mireTexture() }), [0, AXIS_H, 0], [0, -Math.PI / 2, 0], mire);
  for (const [z, x] of [[-0.25, 0.05], [0.25, 0.05], [0, 0.45]]) {
    const top = new THREE.Vector3(0.03, AXIS_H + 0.2, z * 0.3), foot = new THREE.Vector3(x, 0, z);
    const leg = mesh(new THREE.CylinderGeometry(0.012, 0.014, top.distanceTo(foot), 10), std(0x3a2a1c, 0.7), [(top.x + foot.x) / 2, (top.y + foot.y) / 2, (top.z + foot.z) / 2], null, mire);
    leg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), top.clone().sub(foot).normalize());
  }
  mesh(box(0.06, 0.03, 0.66), std(0x3a2a1c, 0.7), [0.02, AXIS_H - 0.325, 0], null, mire);

  // ---------------- le coin de la vision : table, CCU, RCP, moniteurs ----------------
  const desk = put(new THREE.Group(), [-2.2, 0, 1.8], [0, 2.0, 0], scene);
  desk.name = 'vision';
  mesh(box(1.7, 0.04, 0.75), std(0x2b2c2f, 0.55, 0.1), [0, 0.74, 0], null, desk);
  for (const [x, z] of [[-0.8, -0.32], [0.8, -0.32], [-0.8, 0.32], [0.8, 0.32]]) mesh(box(0.04, 0.72, 0.04), M.metalDark, [x, 0.36, z], null, desk);
  // CCU (une unité de rack) posée sur un flight case, à gauche de la table
  put(flightCase(0.6, 0.62, 0.55, 0x222428, M, 6), [-1.25, 0, 0.05], null, desk);
  const ccu = put(new THREE.Group(), [-1.25, 0.62, 0.05], null, desk, 'ccu');
  mesh(box(0.48, 0.088, 0.42), std(0x2c2e31, 0.5, 0.3), [0, 0.044, 0], null, ccu);
  mesh(new THREE.PlaneGeometry(0.48, 0.088), std(0xffffff, 0.5, 0.2, { map: panelTex(960, 176, (g, W, H) => {
    g.fillStyle = '#26282b'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#dcdcd6'; g.font = `700 ${H * 0.18}px ${FONT}`; g.textAlign = 'left'; g.fillText('CAMERA CONTROL UNIT', W * 0.04, H * 0.3);
    g.font = `600 ${H * 0.14}px ${FONT}`; g.fillText('type Sony HXCU-FB80', W * 0.04, H * 0.52);
    g.fillStyle = '#0c1a12'; g.fillRect(W * 0.42, H * 0.2, W * 0.22, H * 0.55); g.fillStyle = '#7bf29a'; g.font = `600 ${H * 0.16}px "B612 Mono", monospace`; g.fillText('CAM 1  OK', W * 0.44, H * 0.43); g.fillText('OPT ▮▮▮▮▯', W * 0.44, H * 0.65);
    g.fillStyle = '#d23a2e'; g.beginPath(); g.arc(W * 0.9, H * 0.5, H * 0.14, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#dcdcd6'; g.font = `600 ${H * 0.12}px ${FONT}`; g.fillText('POWER', W * 0.86, H * 0.86);
    for (let i = 0; i < 4; i++) { g.fillStyle = '#3b3d41'; g.fillRect(W * (0.68 + i * 0.045), H * 0.38, W * 0.03, H * 0.24); }
  }) }), [0, 0.044, 0.2105], null, ccu);
  // RCP : pupitre avec son manche (iris / noir), son écran et ses touches
  const rcp = put(new THREE.Group(), [-0.45, 0.76, 0.08], [0, 0, 0], desk, 'rcp');
  mesh(box(0.2, 0.05, 0.36), std(0x2d2f33, 0.5, 0.2), [0, 0.025, 0], null, rcp);
  mesh(new THREE.PlaneGeometry(0.2, 0.36), std(0xffffff, 0.55, 0.1, { map: panelTex(400, 720, (g, W, H) => {
    g.fillStyle = '#2b2d31'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#0d1520'; g.fillRect(W * 0.1, H * 0.05, W * 0.8, H * 0.16); g.fillStyle = '#9fd4ff'; g.font = `600 ${H * 0.025}px "B612 Mono", monospace`; g.textAlign = 'left';
    g.fillText('CAM 1   F4    0dB', W * 0.14, H * 0.1); g.fillText('ND CLR  3200K', W * 0.14, H * 0.15); g.fillText('M.BLK  +0', W * 0.14, H * 0.19);
    const keys = [['CALL', '#c8261d'], ['BARS', '#3b3d41'], ['AWB', '#3b3d41'], ['ABB', '#3b3d41'], ['GAIN', '#3b3d41'], ['ND', '#3b3d41'], ['CC', '#3b3d41'], ['AUTO', '#e2a025'], ['PARA', '#3b3d41']];
    keys.forEach(([s, c], i) => { const x = W * (0.1 + (i % 3) * 0.28), y = H * (0.26 + Math.floor(i / 3) * 0.075); g.fillStyle = c; g.fillRect(x, y, W * 0.22, H * 0.05); g.fillStyle = '#e8e8e2'; g.font = `700 ${H * 0.02}px ${FONT}`; g.textAlign = 'center'; g.fillText(s, x + W * 0.11, y + H * 0.033); });
    g.fillStyle = '#1b1c1f'; g.fillRect(W * 0.3, H * 0.52, W * 0.4, H * 0.44);
    g.fillStyle = '#e8e8e2'; g.font = `700 ${H * 0.02}px ${FONT}`; g.fillText('IRIS / M.BLK', W * 0.5, H * 0.5);
  }) }), [0, 0.0505, 0], [-Math.PI / 2, 0, Math.PI / 2], rcp);
  const stick = put(new THREE.Group(), [0.055, 0.05, 0], null, rcp, 'rcp');
  mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.07, 12), M.chrome, [0, 0.035, 0], null, stick);
  mesh(new THREE.CylinderGeometry(0.02, 0.016, 0.03, 20), std(0x1a1a1a, 0.6), [0, 0.08, 0], null, stick);
  mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.004, 20), std(0xe2a025, 0.5), [0, 0.096, 0], null, stick);
  // moniteur de référence (image de la caméra) et moniteur de forme d'onde
  const mon = put(new THREE.Group(), [0.15, 0.76, -0.12], [0, 0, 0], desk, 'moniteur');
  mesh(box(0.6, 0.38, 0.06), std(0x1e1f22, 0.5, 0.2), [0, 0.3, 0], null, mon);
  mesh(box(0.2, 0.012, 0.16), std(0x1e1f22, 0.5, 0.2), [0, 0.006, 0], null, mon);
  mesh(box(0.06, 0.1, 0.03), std(0x1e1f22, 0.5, 0.2), [0, 0.06, -0.02], null, mon);
  const wfm = put(new THREE.Group(), [0.62, 0.76, -0.1], [0, -0.25, 0], desk, 'mesure');
  mesh(box(0.26, 0.19, 0.12), std(0x2a2c30, 0.5, 0.2), [0, 0.095, 0], null, wfm);

  // ---------------- lumières et reflets ----------------
  // (intensités physiques, en candelas : un projecteur de plateau à 3 ou 4 m)
  scene.add(new THREE.HemisphereLight(0xb4b6bc, 0x202124, 0.5));
  const key = new THREE.SpotLight(0xfff1de, 220, 14, 0.55, 0.6, 2); key.position.set(-1.2, 3.6, 2.6); key.target.position.set(0, 1.25, 0);
  key.castShadow = true; key.shadow.mapSize.set(quality === 'basse' ? 1024 : 2048, quality === 'basse' ? 1024 : 2048); key.shadow.bias = -0.0002; key.shadow.normalBias = 0.02; key.shadow.camera.near = 1; key.shadow.camera.far = 9;
  scene.add(key, key.target);
  const fill = new THREE.SpotLight(0xdfe6f5, 110, 12, 0.7, 0.8, 2); fill.position.set(1.4, 3.1, -2.6); fill.target.position.set(-0.1, 1.3, 0); scene.add(fill, fill.target);
  const rim = new THREE.SpotLight(0xc9d6ff, 140, 10, 0.5, 0.7, 2); rim.position.set(-3.2, 3.0, -1.0); rim.target.position.set(0, 1.4, 0); scene.add(rim, rim.target);
  const mireLight = new THREE.SpotLight(0xffffff, 120, 8, 0.42, 0.5, 2); mireLight.position.set(1.1, 2.7, 1.4); mireLight.target.position.set(MIRE_X, AXIS_H, 0); scene.add(mireLight, mireLight.target);
  // rideaux éclairés en bleu, comme sur les photos ; une lampe au-dessus de la table de la vision
  for (const [p, t] of [[[1.5, 3.9, 0.5], [4.6, 1.6, 0.3]], [[0.5, 3.9, -1.5], [0.4, 1.6, -4.5]]]) {
    const w = new THREE.SpotLight(0x4466ff, 200, 9, 0.6, 0.9, 2); w.position.set(p[0], p[1], p[2]); w.target.position.set(t[0], t[1], t[2]); scene.add(w, w.target);
  }
  const deskLight = new THREE.SpotLight(0xffe2b8, 60, 4, 0.8, 0.7, 2); deskLight.position.set(-2.0, 2.4, 1.6); deskLight.target.position.set(-2.2, 0.75, 1.8); scene.add(deskLight, deskLight.target);

  // environnement de reflets : une pièce sombre avec quelques boîtes à lumière
  const pm = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(new THREE.BoxGeometry(20, 8, 20), new THREE.MeshBasicMaterial({ color: 0x0d1018, side: THREE.BackSide })));
  for (const [p, s, c] of [[[-3, 4, 3], [3, 0.1, 2], 0xfff0dc], [[3, 3.5, -3], [2, 0.1, 2], 0xd8e4ff], [[0, 2, -9.9], [6, 2, 0.1], 0x223066], [[9.9, 2, 0], [0.1, 2, 6], 0x223066], [[-6, 3, -2], [0.1, 1.5, 1.5], 0xbfd0ff]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(s[0], s[1], s[2]), new THREE.MeshBasicMaterial({ color: c })); m.position.set(p[0], p[1], p[2]); envScene.add(m);
  }
  scene.environment = pm.fromScene(envScene, 0.02).texture;
  scene.environmentIntensity = 0.32;

  // ---------------- l'image de la caméra ----------------
  const W = quality === 'basse' ? 640 : 960, H = Math.round(W * 9 / 16);
  const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: quality === 'basse' ? 0 : 4 });
  const view = new THREE.PerspectiveCamera(30, 16 / 9, 0.05, 60);
  const vfMat = screenMaterial(rt.texture, W, H, 0.35);
  const monMat = screenMaterial(rt.texture, W, H, 0);
  rig.vf.screen.material = vfMat;
  mesh(new THREE.PlaneGeometry(0.55, 0.31), monMat, [0, 0.3, 0.0305], null, mon, 'moniteur');
  // forme d'onde : l'image traitée réduite (128 × 72), relue quatre fois par seconde
  const SW = 128, SH = 72;
  const small = new THREE.WebGLRenderTarget(SW, SH, { type: THREE.UnsignedByteType });
  // (la forme d'onde lit jusqu'à 110 % : l'image est réduite de 1/1,1 avant d'être relue)
  const quadMat = screenMaterial(rt.texture, W, H, 0); quadMat.uniforms.range.value = 1 / 1.1;
  const post = new THREE.Scene(); post.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), quadMat));
  const orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const px = new Uint8Array(SW * SH * 4);
  const wc = document.createElement('canvas'); wc.width = 512; wc.height = 288;
  const wctx = wc.getContext('2d'); const wTex = new THREE.CanvasTexture(wc); wTex.colorSpace = THREE.SRGBColorSpace;
  mesh(new THREE.PlaneGeometry(0.22, 0.124), new THREE.MeshBasicMaterial({ map: wTex, toneMapped: false }), [0, 0.1, 0.0605], null, wfm, 'mesure');
  function drawWaveform() {
    const g = wctx, w = wc.width, h = wc.height;
    g.fillStyle = '#020604'; g.fillRect(0, 0, w, h);
    const y = (pct) => h - 16 - (pct / 110) * (h - 30);
    g.strokeStyle = 'rgba(120,200,140,0.35)'; g.lineWidth = 1; g.fillStyle = 'rgba(150,220,170,0.7)'; g.font = `500 12px "B612 Mono", monospace`;
    for (const p of [0, 25, 50, 75, 100]) { g.beginPath(); g.moveTo(34, y(p)); g.lineTo(w - 6, y(p)); g.stroke(); g.fillText(String(p), 4, y(p) + 4); }
    g.fillStyle = 'rgba(140,255,160,0.16)';
    for (let i = 0; i < SW * SH; i++) {
      const r = px[i * 4], gg = px[i * 4 + 1], b = px[i * 4 + 2];
      const luma = (0.2126 * r + 0.7152 * gg + 0.0722 * b) / 255 * 110;
      g.fillRect(34 + (i % SW) / SW * (w - 40), y(luma) - 1, 3, 2);
    }
  }
  let wAcc = 0, wKey = '';
  /** la forme d'onde : relue quatre fois par seconde au plus, et seulement si l'image a changé */
  function tickWaveform(dt) {
    wAcc += dt; if (wAcc < 0.25) return; wAcc = 0;
    const u = monMat.uniforms, key = [u.blur.value.toFixed(2), u.exposure.value.toFixed(3), u.power.value, u.bars.value, u.wb.value.x, u.wb.value.z, view.fov.toFixed(2)].join();
    if (key === wKey) return; wKey = key;
    for (const k of ['blur', 'exposure', 'power', 'bars']) quadMat.uniforms[k].value = u[k].value;
    quadMat.uniforms.wb.value.copy(u.wb.value);
    renderer.setRenderTarget(small); renderer.render(post, orthoCam);
    renderer.readRenderTargetPixels(small, 0, 0, SW, SH, px);
    renderer.setRenderTarget(null);
    drawWaveform(); wTex.needsUpdate = true;
  }
  const cam = rig.cam; const lensFront = new THREE.Vector3(0.29, 0, 0); const fwd = new THREE.Vector3(), up = new THREE.Vector3();

  return {
    scene, view, rt, vfMat, monMat, quadMat, mire, desk, lights: { key, fill, rim, mireLight },
    /** l'image de la caméra : place la vue sur l'objectif, puis rend la texture (et la forme d'onde) */
    renderView(dt, fovDeg) {
      // la scène est immobile : l'image n'est refaite que si la focale change (le flou et
      // l'exposition s'appliquent à l'affichage, dans le shader des écrans)
      if (Math.abs(view.fov - fovDeg) < 0.01 && !this.dirty) { tickWaveform(dt); return; }
      this.dirty = false;
      cam.updateMatrixWorld();
      view.position.copy(lensFront).applyMatrix4(cam.matrixWorld);
      fwd.set(1, 0, 0).transformDirection(cam.matrixWorld); up.set(0, 1, 0).transformDirection(cam.matrixWorld);
      view.up.copy(up); view.lookAt(view.position.clone().add(fwd));
      if (Math.abs(view.fov - fovDeg) > 0.01) { view.fov = fovDeg; view.updateProjectionMatrix(); }
      const vis = rig.root.visible; rig.root.visible = false;
      renderer.setRenderTarget(rt); renderer.clear(); renderer.render(scene, view);
      rig.root.visible = vis;
      renderer.setRenderTarget(null);
      wAcc = 1; tickWaveform(dt);
    },
    dirty: true,
    dispose() { rt.dispose(); small.dispose(); pm.dispose(); },
  };
}

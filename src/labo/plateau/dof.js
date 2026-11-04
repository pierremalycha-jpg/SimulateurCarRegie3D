// @ts-check
import * as THREE from 'three';
import { fovVertical } from './calc.js';

// ----------------------------------------------------------------------------------
// L'image de la caméra du plateau 3D (v19.30) : la scène est rendue une seconde fois depuis l'œil de la
// caméra posée sur le plateau (angle de champ tiré de la focale et du capteur), dans une cible de rendu qui
// garde la profondeur ; un second passage dessine cette image dans un coin du plateau en lui appliquant,
// pixel par pixel :
//   - le flou de profondeur de champ : la profondeur donne la distance d de ce qui est vu, l'optique de la
//     leçon (labo/calc/optique.js) la taille de sa tache de flou sur le capteur, t = f² |d − s| ÷ (N d (s − f)),
//     rapportée à la hauteur d'une image HD (1 080 lignes : le cercle de confusion y vaut deux photosites) et
//     montrée telle quelle, quelle que soit la taille du cadre à l'écran, pour que l'œil voie ce que l'image
//     HD montrerait à 100 % ; chaque pixel cueille ses voisins sur un disque de ce diamètre (spirale dorée),
//     un voisin ne comptant que si sa propre tache déborde jusqu'ici (un sujet net au premier plan ne bave
//     pas sur un fond flou) ;
//   - l'exposition : la lumière du rendu est en unités physiques (candelas, lux) ; multiplier par π ÷ Eref met
//     un gris 18 % reçu sous l'éclairement Eref (celui qu'il faut pour le diaphragme, la sensibilité et le temps
//     de pose) à 18 % (calc.js) ; puis la courbe ACES, comme le simulateur ;
//   - la balance des blancs : les gains d'une caméra réglée à Tcam (les composantes inverses de sa
//     température), si bien qu'une lumière de même température sort blanche, et qu'une plus chaude tire vers
//     l'orange ;
//   - le zébra : au-dessus de 90 % après la courbe (un blanc à deux diaphs de trop, une peau à deux diaphs et
//     demi), des hachures, comme dans un viseur.
// Quand le rendu sait écrire des cibles en demi-flottants (WebGL2), l'image garde ses hautes lumières jusqu'à
// la courbe ; sinon elle est exposée à l'écriture et écrête plus tôt (même image, zébra compris).
// ----------------------------------------------------------------------------------
/**
 * @typedef {object} ImageSpec ce que l'atelier dit de l'image à rendre
 * @property {THREE.Vector3} position l'œil de la caméra (monde)
 * @property {THREE.Vector3} direction où elle regarde (vecteur unitaire)
 * @property {number} f focale (mm)
 * @property {number} hCap hauteur du capteur (mm)
 * @property {number} N nombre f
 * @property {number} s distance de mise au point (m)
 * @property {number} expo exposition du rendu (π ÷ Eref)
 * @property {[number, number, number]} wb gains de la balance des blancs [r, g, b]
 * @property {boolean} [zebra] hachures au-dessus de 95 %
 * @property {boolean} [dof] flou de profondeur de champ
 * @property {string} [legende] le texte sous l'image
 */
const VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tColor; uniform sampler2D tDepth;
uniform float uNear, uFar, uFocus, uF, uN, uHcap, uMax, uExpo, uZebra, uRayon, uDof, uLignes;
uniform vec2 uRes; uniform vec3 uWB;
varying vec2 vUv;
// profondeur du tampon (0..1, perspective) → distance à la caméra (m)
float distanceDe(float z) { float zn = z * 2.0 - 1.0; return 2.0 * uNear * uFar / (uFar + uNear - zn * (uFar - uNear)); }
// diamètre de la tache de flou (px) d'un point à d mètres : l'optique de la leçon, rapportée aux lignes d'une image HD
float tache(float d) {
  float S = uFocus * 1000.0, D = max(d * 1000.0, 1.0);
  if (S <= uF) return uMax * 2.0;
  float t = uF * uF * abs(D - S) / (uN * D * (S - uF));
  return min(uMax * 2.0, t / uHcap * uLignes);
}
// la courbe ACES (approximation de Narkowicz) : des hautes lumières qui s'arrondissent au lieu d'écrêter
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
void main() {
  // les coins arrondis du cadre : rien n'est dessiné dehors
  vec2 px = vUv * uRes; vec2 q = abs(px - uRes * 0.5) - (uRes * 0.5 - uRayon);
  if (length(max(q, 0.0)) > uRayon) discard;
  float r0 = tache(distanceDe(texture2D(tDepth, vUv).r)) * 0.5;
  vec3 c = texture2D(tColor, vUv).rgb; float w = 1.0;
  if (uDof > 0.5 && r0 > 0.6) {
    for (int i = 1; i < 36; i++) {
      float fi = float(i);
      float r = sqrt(fi / 36.0) * r0, a = fi * 2.39996;
      vec2 uv = clamp(vUv + vec2(cos(a), sin(a)) * r / uRes, vec2(0.001), vec2(0.999));
      float rj = tache(distanceDe(texture2D(tDepth, uv).r)) * 0.5;
      float wj = clamp(rj - r + 1.0, 0.0, 1.0);
      c += texture2D(tColor, uv).rgb * wj; w += wj;
    }
    c /= w;
  }
  vec3 o = aces(c * uExpo * uWB);
  if (uZebra > 0.5 && dot(o, vec3(0.299, 0.587, 0.114)) > 0.9) { float s = step(0.5, fract((px.x + px.y) / 9.0)); o = mix(o, vec3(s * 0.9 + 0.05), 0.8); }
  gl_FragColor = vec4(o, 1.0);
  #include <colorspace_fragment>
}`;

export class ImageCamera {
  /** @param {THREE.WebGLRenderer} renderer */
  constructor(renderer) {
    this.renderer = renderer;
    const ext = /** @type {any} */ (renderer.extensions);
    this.hdr = !!(renderer.capabilities.isWebGL2 && ext.has && ext.has('EXT_color_buffer_float'));
    this.w = 0; this.h = 0;
    this.rt = new THREE.WebGLRenderTarget(16, 9, { type: this.hdr ? THREE.HalfFloatType : THREE.UnsignedByteType, depthTexture: new THREE.DepthTexture(16, 9), depthBuffer: true, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false });
    this.cam = new THREE.PerspectiveCamera(30, 16 / 9, 0.08, 150); this.cam.layers.set(0); this.cam.name = 'image de la caméra';
    this.mat = new THREE.ShaderMaterial({
      uniforms: { tColor: { value: this.rt.texture }, tDepth: { value: this.rt.depthTexture }, uNear: { value: 0.08 }, uFar: { value: 150 }, uFocus: { value: 4 }, uF: { value: 35 }, uN: { value: 4 }, uHcap: { value: 14 }, uMax: { value: 12 }, uExpo: { value: 1 }, uZebra: { value: 0 }, uRayon: { value: 12 }, uDof: { value: 1 }, uLignes: { value: 1080 }, uRes: { value: new THREE.Vector2(16, 9) }, uWB: { value: new THREE.Vector3(1, 1, 1) } },
      vertexShader: VERT, fragmentShader: FRAG, depthTest: false, depthWrite: false,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat); this.quad.frustumCulled = false;
    this.scene2 = new THREE.Scene(); this.scene2.add(this.quad);
    this.cam2 = new THREE.Camera();
    this.vise = new THREE.Vector3();
  }
  /** rend l'image dans la cible, à w × h pixels d'appareil */
  rendre(/** @type {THREE.Scene} */ scene, /** @type {ImageSpec} */ im, w, h) {
    const R = this.renderer;
    w = Math.max(16, Math.round(w)); h = Math.max(9, Math.round(h));
    if (w !== this.w || h !== this.h) { this.rt.setSize(w, h); this.w = w; this.h = h; this.mat.uniforms.uRes.value.set(w, h); }
    const cam = this.cam;
    cam.position.copy(im.position); this.vise.copy(im.position).add(im.direction); cam.lookAt(this.vise);
    cam.fov = fovVertical(im.hCap, im.f); cam.aspect = w / h; cam.updateProjectionMatrix();
    const tm = R.toneMapping, ex = R.toneMappingExposure;
    // en demi-flottants : la radiance brute, exposée dans le second passage ; sinon exposée ici, écrêtée à 1
    R.toneMapping = this.hdr ? THREE.NoToneMapping : THREE.LinearToneMapping; R.toneMappingExposure = this.hdr ? 1 : im.expo;
    R.setRenderTarget(this.rt); R.render(scene, cam); R.setRenderTarget(null);
    R.toneMapping = tm; R.toneMappingExposure = ex;
    const u = this.mat.uniforms;
    u.uNear.value = cam.near; u.uFar.value = cam.far; u.uFocus.value = im.s; u.uF.value = im.f; u.uN.value = im.N; u.uHcap.value = im.hCap;
    u.uMax.value = Math.max(6, h / 12); u.uExpo.value = this.hdr ? im.expo : 1; u.uZebra.value = im.zebra ? 1 : 0; u.uDof.value = im.dof === false ? 0 : 1;
    u.uWB.value.set(im.wb[0], im.wb[1], im.wb[2]);
  }
  /** dessine l'image dans le cadre (x, y, w, h en pixels CSS, y depuis le bas du canevas) du canevas, coins arrondis de r pixels d'appareil */
  composer(x, y, w, h, r) {
    const R = this.renderer;
    this.mat.uniforms.uRayon.value = r;
    const ac = R.autoClear; R.autoClear = false;
    R.setViewport(x, y, w, h); R.setScissor(x, y, w, h); R.setScissorTest(true);
    R.render(this.scene2, this.cam2);
    R.setScissorTest(false); R.autoClear = ac;
  }
  dispose() { this.rt.dispose(); this.mat.dispose(); this.quad.geometry.dispose(); }
}

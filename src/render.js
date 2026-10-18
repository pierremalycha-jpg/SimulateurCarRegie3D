// @ts-check
import * as THREE from 'three';
import { S } from './state.js';

// ----------------------------------------------------------------------------------
// Rendu « réaliste » :
//  · matériaux physiques (MeshStandardMaterial) : les matériaux Lambert de la scène sont convertis,
//    les références existantes continuent de fonctionner (propriétés redirigées) ;
//  · éclairage d'environnement (IBL) : le ciel du moment est capturé en carte d'environnement
//    préfiltrée (PMREM) ; un studio lumineux tient lieu d'environnement dans le car ;
//  · post-traitement de la vue « œil » (déplacement, vol, car) : image HDR multi-échantillonnée,
//    halo des sources intenses (bloom), courbe filmique ACES, étalonnage léger, vignettage, tramage.
// Les caméras broadcast ont leur propre traitement (peinture CCU) et ne passent pas par ici.
// ----------------------------------------------------------------------------------
export const RENDER = { pbr: false, envI: 0.3, envTruck: 0.55, std: new Set(), post: null, envRT: null, truckEnvRT: null, bloom: 0.05, truckBloom: 0.16 };

// inverse de la transformation de vue (ACES + sRGB) : un écran (image vidéo) affiché dans la vue
// post-traitée garde ses valeurs d'origine au lieu d'être recompressé par la courbe filmique
export const VIEW_INV = (() => {
  const I = new THREE.Matrix3().set(0.59719, 0.35458, 0.04823, 0.07600, 0.90834, 0.01566, 0.02840, 0.13383, 0.83777);
  const O = new THREE.Matrix3().set(1.60475, -0.53108, -0.07367, -0.10208, 1.10813, -0.00605, -0.00327, -0.07276, 1.07602);
  return { invI: { value: I.clone().invert() }, invO: { value: O.clone().invert() }, exp: { value: 1 } };
})();
export const VIEW_INV_GLSL = `
  vec3 viewInvFit(vec3 y){ y = clamp(y, 0.0, 0.99); vec3 a = y * 0.983729 - 1.0; vec3 b = y * 0.4329510 - 0.0245786; vec3 c = y * 0.238081 + 0.000090537; return (-b - sqrt(b * b - 4.0 * a * c)) / (2.0 * a); }
  vec3 viewInverse(vec3 v, mat3 invI, mat3 invO, float ex){
    v = clamp(v, 0.0, 0.985);
    vec3 t = mix(pow((v + 0.055) / 1.055, vec3(2.4)), v / 12.92, vec3(lessThanEqual(v, vec3(0.04045))));
    return 0.6 * (invI * viewInvFit(max(invO * t, vec3(0.0)))) / ex; }`;

// indication de rugosité / métal sur un matériau Lambert (utilisée à la conversion)
export function pbr(mat, rough, metal = 0, envBoost = 1) { mat.userData.pbr = [rough, metal]; if (envBoost !== 1) mat.userData.envBoost = envBoost; return mat; }

const FWD = ['map', 'opacity', 'visible', 'transparent', 'emissiveIntensity', 'side', 'depthWrite', 'depthTest', 'alphaTest', 'wireframe', 'emissiveMap', 'alphaMap', 'fog', 'polygonOffset', 'polygonOffsetFactor', 'polygonOffsetUnits', 'vertexColors', 'flatShading', 'toneMapped', 'blending', 'colorWrite'];
function toStd(m) {
  if (m.userData.std) return m.userData.std;
  const [rough, metal] = m.userData.pbr || [0.9, 0];
  const n = new THREE.MeshStandardMaterial({ roughness: rough, metalness: metal });
  n.name = m.name;
  n.color = m.color; n.emissive = m.emissive; // mêmes objets couleur : les changements de teinte suivent
  for (const k of FWD) n[k] = m[k];
  n.userData = m.userData;
  // l'ancien matériau devient une façade : lire / écrire ses propriétés agit sur le nouveau
  for (const k of FWD) Object.defineProperty(m, k, { get: () => n[k], set: (v) => { n[k] = v; }, configurable: true });
  Object.defineProperty(m, 'needsUpdate', { get: () => false, set: (v) => { if (v) n.needsUpdate = true; }, configurable: true });
  m.userData.std = n;
  return n;
}
const own = (m, k) => Object.prototype.hasOwnProperty.call(m, k);
function conv(m) {
  if (!m) return m;
  if (m.isMeshLambertMaterial && !own(m, 'onBeforeCompile') && !m.userData.noPbr) m = toStd(m);
  if (m.isMeshStandardMaterial && !RENDER.std.has(m)) { RENDER.std.add(m); m.envMapIntensity = envFor(m); }
  return m;
}
const envFor = (m) => (m.userData.truck ? RENDER.envTruck : RENDER.envI) * (m.userData.envBoost || 1);
// convertit une scène (ou un sous-arbre ajouté plus tard : caméras, appareils)
export function upgradeScene(root, truck = false) {
  if (!RENDER.pbr || !root) return;
  root.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    const mark = (m) => { if (m && truck) m.userData.truck = true; return conv(m); };
    o.material = Array.isArray(o.material) ? o.material.map(mark) : mark(o.material);
  });
}
function setEnvIntensity() { for (const m of RENDER.std) m.envMapIntensity = envFor(m); }

// ------------------------------- environnement -------------------------------
let pmrem = null;
export function initRender(renderer, W, T) {
  RENDER.renderer = renderer; RENDER.W = W; RENDER.T = T;
  RENDER.pbr = !S.lite && !/[?&]nopbr\b/.test(location.search);
  if (!RENDER.pbr) return;
  pmrem = new THREE.PMREMGenerator(renderer);
  upgradeScene(W.scene);
  upgradeScene(T.scene, true);
  T.scene.traverse((o) => { if (o.isHemisphereLight) o.intensity *= 0.5; });
  // studio du car : plafond à bandeaux lumineux, murs sombres, mur d'écrans
  {
    const sc = new THREE.Scene();
    const room = new THREE.Mesh(new THREE.BoxGeometry(18, 3, 6), new THREE.MeshBasicMaterial({ color: 0x23272d, side: THREE.BackSide }));
    sc.add(room);
    const strip = new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 5.2, 5.6) });
    for (let x = -7; x <= 7; x += 3.5) { const s = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.25), strip); s.rotation.x = Math.PI / 2; s.position.set(x, 1.45, 0); sc.add(s); }
    const wall = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 1.2, 0.9) });
    const mv = new THREE.Mesh(new THREE.PlaneGeometry(12, 1.2), wall); mv.position.set(0, 0.4, -2.95); sc.add(mv);
    const desk = new THREE.Mesh(new THREE.PlaneGeometry(16, 2.5), new THREE.MeshBasicMaterial({ color: 0x3a4048 })); desk.rotation.x = -Math.PI / 2; desk.position.y = -0.6; sc.add(desk);
    RENDER.truckEnvRT = pmrem.fromScene(sc, 0.03, 0.1, 50);
    T.scene.environment = RENDER.truckEnvRT.texture;
  }
}
// recalcule la carte d'environnement du stade à partir du ciel courant (après un changement de lumière)
export function refreshEnvironment(key) {
  const W = RENDER.W; if (!RENDER.pbr || !W || !W.sky) return;
  const u = W.sky.material.uniforms;
  const sc = new THREE.Scene();
  const sky = new THREE.Mesh(W.sky.geometry, W.sky.material); sc.add(sky);
  // sol : herbe et béton éclairés, vus depuis le stade
  const gl = { jour: 0.42, fin: 0.22, couvert: 0.26, nuit: 0.02 }[key] ?? 0.4;
  const ground = new THREE.Mesh(new THREE.CircleGeometry(1300, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.16 * gl, 0.2 * gl, 0.12 * gl) }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -2; sc.add(ground);
  const sun0 = u.uSunI ? u.uSunI.value : 0; if (u.uSunI) u.uSunI.value = 0; // pas de disque solaire dans l'environnement : le soleil est déjà une lumière
  const rt = pmrem.fromScene(sc, 0.02, 1, 3000);
  if (u.uSunI) u.uSunI.value = sun0;
  if (RENDER.envRT) RENDER.envRT.dispose();
  RENDER.envRT = rt; W.scene.environment = rt.texture;
  RENDER.envI = { jour: 0.15, fin: 0.12, couvert: 0.27, nuit: 0.3 }[key] ?? 0.15;
  RENDER.bloom = { jour: 0.045, fin: 0.06, couvert: 0.04, nuit: 0.22 }[key] ?? 0.05;
  setEnvIntensity();
}

// ------------------------------- post-traitement -------------------------------
const VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const sh = (frag, uniforms) => new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false, toneMapped: false });
const rtOpts = { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
class Post {
  constructor(renderer) {
    this.r = renderer;
    this.w = 0; this.h = 0;
    this.msaa = S.quality === 'haute' ? 4 : 2;
    this.rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: this.msaa });
    this.down = []; this.up = [];
    for (let i = 0; i < 5; i++) this.down.push(new THREE.WebGLRenderTarget(1, 1, rtOpts));
    for (let i = 0; i < 4; i++) this.up.push(new THREE.WebGLRenderTarget(1, 1, rtOpts));
    this.scene = new THREE.Scene(); this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); this.quad.frustumCulled = false; this.scene.add(this.quad);
    // seuil doux + sous-échantillonnage (4 lectures bilinéaires = filtre 4×4)
    this.mPre = sh(`uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uExp, uTh; varying vec2 vUv;
      void main(){
        vec3 c = 0.25 * (texture2D(tSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb + texture2D(tSrc, vUv + uTexel * vec2(1.0, -1.0)).rgb + texture2D(tSrc, vUv + uTexel * vec2(-1.0, 1.0)).rgb + texture2D(tSrc, vUv + uTexel * vec2(1.0, 1.0)).rgb);
        c = min(c * uExp, vec3(60.0));
        float br = max(c.r, max(c.g, c.b));
        float k = 0.5 * uTh; float soft = clamp(br - uTh + k, 0.0, 2.0 * k); soft = soft * soft / (4.0 * k + 1e-4);
        float w = max(soft, br - uTh) / max(br, 1e-4);
        gl_FragColor = vec4(c * w, 1.0); }`, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uExp: { value: 1 }, uTh: { value: 1.1 } });
    this.mDown = sh(`uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv;
      void main(){ vec3 c = texture2D(tSrc, vUv).rgb * 4.0;
        c += texture2D(tSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb + texture2D(tSrc, vUv + uTexel * vec2(1.0, -1.0)).rgb + texture2D(tSrc, vUv + uTexel * vec2(-1.0, 1.0)).rgb + texture2D(tSrc, vUv + uTexel * vec2(1.0, 1.0)).rgb;
        gl_FragColor = vec4(c / 8.0, 1.0); }`, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } });
    // sur-échantillonnage en tente (9 lectures) + niveau courant
    this.mUp = sh(`uniform sampler2D tSrc, tBase; uniform vec2 uTexel; uniform float uMix; varying vec2 vUv;
      void main(){ vec2 t = uTexel;
        vec3 c = texture2D(tSrc, vUv).rgb * 4.0;
        c += (texture2D(tSrc, vUv + vec2(-t.x, 0.0)).rgb + texture2D(tSrc, vUv + vec2(t.x, 0.0)).rgb + texture2D(tSrc, vUv + vec2(0.0, -t.y)).rgb + texture2D(tSrc, vUv + vec2(0.0, t.y)).rgb) * 2.0;
        c += texture2D(tSrc, vUv - t).rgb + texture2D(tSrc, vUv + t).rgb + texture2D(tSrc, vUv + vec2(-t.x, t.y)).rgb + texture2D(tSrc, vUv + vec2(t.x, -t.y)).rgb;
        gl_FragColor = vec4(texture2D(tBase, vUv).rgb + c / 16.0 * uMix, 1.0); }`, { tSrc: { value: null }, tBase: { value: null }, uTexel: { value: new THREE.Vector2() }, uMix: { value: 1 } });
    // composition : exposition, halo, ACES (même courbe que three.js), étalonnage, vignettage, tramage, sRGB
    this.mComp = sh(`uniform sampler2D tSrc, tBloom; uniform float uExp, uBloom, uVig, uSat, uCon, uTime; uniform vec3 uLift; varying vec2 vUv;
      vec3 RRTAndODTFit(vec3 v){ vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
      vec3 aces(vec3 color){
        const mat3 I = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
        const mat3 O = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
        color *= 1.0 / 0.6; color = I * color; color = RRTAndODTFit(color); color = O * color; return clamp(color, 0.0, 1.0); }
      vec3 srgb(vec3 c){ return mix(pow(c, vec3(1.0 / 2.4)) * 1.055 - 0.055, c * 12.92, vec3(lessThanEqual(c, vec3(0.0031308)))); }
      float h12(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){
        vec3 c = texture2D(tSrc, vUv).rgb * uExp + texture2D(tBloom, vUv).rgb * uBloom;
        c = aces(c);
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        c = max(mix(vec3(l), c, uSat), 0.0);
        vec2 d = vUv - 0.5; c *= 1.0 - uVig * pow(dot(d, d) * 2.2, 1.4);
        // contraste et teinte des ombres en espace d'affichage (en linéaire, les noirs seraient écrasés)
        c = srgb(c);
        c = clamp((c - 0.5) * uCon + 0.5 + uLift * (1.0 - c), 0.0, 1.0);
        c += (h12(gl_FragCoord.xy + uTime) - 0.5) / 255.0;
        gl_FragColor = vec4(c, 1.0); }`, { tSrc: { value: null }, tBloom: { value: null }, uExp: { value: 1 }, uBloom: { value: 0.05 }, uVig: { value: 0.22 }, uSat: { value: 1.06 }, uCon: { value: 1.03 }, uLift: { value: new THREE.Vector3(0.012, 0.014, 0.02) }, uTime: { value: 0 } });
  }
  setSize(w, h) {
    if (w === this.w && h === this.h) return;
    this.w = w; this.h = h;
    this.rt.setSize(w, h);
    let dw = w, dh = h;
    for (let i = 0; i < 5; i++) { dw = Math.max(1, dw >> 1); dh = Math.max(1, dh >> 1); this.down[i].setSize(dw, dh); if (i < 4) this.up[i].setSize(dw, dh); }
  }
  pass(mat, target) { this.quad.material = mat; this.r.setRenderTarget(target); this.r.render(this.scene, this.cam); }
  render(scene, camera, exposure, bloom) {
    const r = this.r;
    const v = r.getDrawingBufferSize(new THREE.Vector2());
    this.setSize(v.x, v.y);
    const tm = r.toneMapping;
    r.setRenderTarget(this.rt); r.clear(); r.render(scene, camera);
    // halo
    const p = this.mPre.uniforms; p.tSrc.value = this.rt.texture; p.uTexel.value.set(1 / this.w, 1 / this.h); p.uExp.value = exposure;
    this.pass(this.mPre, this.down[0]);
    for (let i = 1; i < 5; i++) { const d = this.mDown.uniforms; d.tSrc.value = this.down[i - 1].texture; d.uTexel.value.set(1 / this.down[i - 1].width, 1 / this.down[i - 1].height); this.pass(this.mDown, this.down[i]); }
    for (let i = 3; i >= 0; i--) {
      const u = this.mUp.uniforms; const src = i === 3 ? this.down[4] : this.up[i + 1];
      u.tSrc.value = src.texture; u.tBase.value = this.down[i].texture; u.uTexel.value.set(1 / src.width, 1 / src.height); u.uMix.value = 1;
      this.pass(this.mUp, this.up[i]);
    }
    const c = this.mComp.uniforms; c.tSrc.value = this.rt.texture; c.tBloom.value = this.up[0].texture; c.uExp.value = exposure; c.uBloom.value = bloom; c.uTime.value = (S.frame % 64) * 1.7;
    this.pass(this.mComp, null);
    r.toneMapping = tm;
  }
}
export function postEnabled() { return RENDER.pbr && S.quality !== 'basse' && !/[?&]nopost\b/.test(location.search); }
// vue « œil » : rendu avec post-traitement si la qualité le permet, sinon rendu direct
export function renderEye(renderer, scene, camera, exposure, inTruck) {
  if (postEnabled()) {
    if (!RENDER.post || RENDER.post.msaa !== (S.quality === 'haute' ? 4 : 2)) RENDER.post = new Post(renderer);
    // écrans : mode « vue post-traitée » pendant ce rendu
    const scr = inTruck ? Object.values(RENDER.T.screens) : RENDER.W.screens;
    for (const m of scr) if (m.uniforms && m.uniforms.uLin) m.uniforms.uLin.value = 2;
    VIEW_INV.exp.value = exposure;
    RENDER.post.render(scene, camera, exposure, inTruck ? RENDER.truckBloom : RENDER.bloom);
    for (const m of scr) if (m.uniforms && m.uniforms.uLin) m.uniforms.uLin.value = 0;
  } else {
    renderer.toneMappingExposure = exposure;
    renderer.render(scene, camera);
  }
}

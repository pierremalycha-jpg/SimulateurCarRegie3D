import * as THREE from 'three';
import { S, emit, camById, nextCamId } from './state.js';
import { CAMERA_TYPES, LENSES, LINKS, SENSORS, SLOTS, ROLES, maxAperture, ND_FILTERS, SHUTTERS, IRIS_STOPS } from './data.js';
import { Builder, setLayer } from './geo.js';
import { W, BOWL, TRUCK, PITCH, standHeight, bowlOffset, labelSprite } from './world.js';
import { M } from './match.js';
import { clamp, spring, springAngle, wrapAngle, DEG, rand, randRange, kelvinRGBNorm, gauss, lerp } from './util.js';

export const K_EXPO = { k: 256 * 0.18 / 0.105 }; // calibré : jour, f/8, ND 1/4, 0 dB -> gris moyen correct

// ----------------------------------------------------------------------------------
// Matériau de traitement caméra (CCU) : exposition, balance, noir, gamma, knee, détail, bruit, artefacts HF
// ----------------------------------------------------------------------------------
export const paintMat = new THREE.ShaderMaterial({
  uniforms: {
    tRaw: { value: null }, uTexel: { value: new THREE.Vector2(1 / 512, 1 / 288) },
    uExpo: { value: 1 }, uWB: { value: new THREE.Vector3(1, 1, 1) }, uBlack: { value: new THREE.Vector3() },
    uGamma: { value: 0.45 }, uKnee: { value: 0.95 }, uDetail: { value: 0.3 }, uSat: { value: 1 },
    uNoise: { value: 0.003 }, uSeed: { value: 0 }, uBlackGamma: { value: 0 }, uBlock: { value: 0 }, uBreak: { value: 0 }, uRoll: { value: 0 }, uIris: { value: 1 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tRaw; uniform vec2 uTexel; uniform float uExpo; uniform vec3 uWB; uniform vec3 uBlack;
    uniform float uGamma, uKnee, uDetail, uSat, uNoise, uSeed, uBlock, uBreak, uRoll, uIris, uBlackGamma;
    varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + uSeed*1.37) * 43758.5453); }
    vec3 oetf(vec3 L){
      L = max(L, 0.0);
      vec3 lo = 4.5 * L; vec3 hi = 1.099 * pow(L, vec3(uGamma)) - 0.099;
      return mix(lo, hi, step(0.018, L));
    }
    vec3 proc(vec2 uv){ return oetf(texture2D(tRaw, uv).rgb * uExpo * uWB); }
    void main(){
      vec2 uv = vUv;
      // perte de genlock : l'image saute verticalement
      if (uRoll > 0.0) { uv.y = fract(uv.y + uRoll); uv.x += sin(uv.y*40.0 + uSeed)*0.002; }
      // artefacts de compression / erreurs HF (blocs de 16 px)
      vec2 blocks = vec2(1.0/uTexel.x, 1.0/uTexel.y) / 16.0;
      vec2 bid = floor(uv * blocks);
      float br = h(bid + floor(uSeed*3.0));
      vec2 suv = uv;
      if (uBlock > 0.0) { vec2 bc = (bid + 0.5) / blocks; suv = mix(uv, bc, uBlock * 0.55); }
      vec3 c = proc(suv);
      // détail (accentuation des contours sur la luminance)
      vec3 n = proc(uv + vec2(uTexel.x,0.0)) + proc(uv - vec2(uTexel.x,0.0)) + proc(uv + vec2(0.0,uTexel.y)) + proc(uv - vec2(0.0,uTexel.y));
      float yc = dot(c, vec3(0.2126,0.7152,0.0722));
      float yn = dot(n*0.25, vec3(0.2126,0.7152,0.0722));
      c += clamp((yc - yn) * uDetail * 2.0, -0.08, 0.08);
      // knee
      vec3 kn = vec3(uKnee);
      c = mix(c, kn + (c - kn) * 0.3, step(kn, c));
      // black gamma : relève ou écrase les basses lumières
      c += uBlackGamma * (1.0 - smoothstep(0.0, 0.32, c)) * smoothstep(0.0, 0.04, c);
      // saturation
      float y = dot(c, vec3(0.2126,0.7152,0.0722));
      c = y + (c - y) * uSat;
      // bruit (gain)
      c += (h(uv*731.0) - 0.5) * uNoise * 2.0 + (h(uv*197.0+3.1)-0.5) * uNoise;
      // niveau de noir (pedestal)
      c += uBlack;
      if (uBreak > 0.0 && br < uBreak) {
        // bloc corrompu : macro-bloc décalé et teinté
        vec3 bad = proc(uv + vec2(0.07, 0.0) * (h(bid*1.7) - 0.5));
        c = mix(bad, vec3(0.15,0.42,0.18), step(0.6, h(bid*3.3)) * 0.6);
      }
      c *= uIris;
      c = clamp(c, -0.07, 1.09);
      gl_FragColor = vec4(max(c, 0.0) / 1.1, 1.0);
    }`,
  depthTest: false, depthWrite: false,
});
const fsQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), paintMat);
fsQuad.frustumCulled = false;
const fsScene = new THREE.Scene(); fsScene.add(fsQuad);
const fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

export function rtSize() {
  return S.quality === 'haute' ? [640, 360] : S.quality === 'basse' ? [384, 216] : [512, 288];
}

// ----------------------------------------------------------------------------------
// Routage des câbles (anneaux de chemins de câbles du stade)
// ----------------------------------------------------------------------------------
const RINGS = {
  pitch: { hx: 59.4, hz: 39.7, y: 0.05 },
  conc: { hx: BOWL.hx + 27, hz: BOWL.hz + 27, y: 13.6 },
};
function perimLen(r) { return 4 * r.hx + 4 * r.hz; }
function projRing(r, x, z) {
  const cands = [];
  const cx = clamp(x, -r.hx, r.hx), cz = clamp(z, -r.hz, r.hz);
  cands.push({ s: cx + r.hx, d: Math.abs(z + r.hz) + Math.abs(x - cx) }); // bas z=-hz
  cands.push({ s: 2 * r.hx + (cz + r.hz), d: Math.abs(x - r.hx) + Math.abs(z - cz) });
  cands.push({ s: 2 * r.hx + 2 * r.hz + (r.hx - cx), d: Math.abs(z - r.hz) + Math.abs(x - cx) });
  cands.push({ s: 4 * r.hx + 2 * r.hz + (r.hz - cz), d: Math.abs(x + r.hx) + Math.abs(z - cz) });
  cands.sort((a, b) => a.d - b.d);
  return cands[0].s;
}
function ringPoint(r, s) {
  const P = perimLen(r); s = ((s % P) + P) % P;
  if (s < 2 * r.hx) return [-r.hx + s, r.y, -r.hz];
  s -= 2 * r.hx; if (s < 2 * r.hz) return [r.hx, r.y, -r.hz + s];
  s -= 2 * r.hz; if (s < 2 * r.hx) return [r.hx - s, r.y, r.hz];
  s -= 2 * r.hx; return [-r.hx, r.y, r.hz - s];
}
function ringPath(r, s1, s2) {
  const P = perimLen(r);
  const fwd = ((s2 - s1) % P + P) % P;
  const corners = [0, 2 * r.hx, 2 * r.hx + 2 * r.hz, 4 * r.hx + 2 * r.hz];
  const pts = [ringPoint(r, s1)];
  if (fwd <= P / 2) {
    const list = corners.map((c) => ((c - s1) % P + P) % P).map((d, i) => ({ d, c: corners[i] })).filter((o) => o.d > 0 && o.d < fwd).sort((a, b) => a.d - b.d);
    for (const o of list) pts.push(ringPoint(r, o.c));
  } else {
    const back = P - fwd;
    const list = corners.map((c) => ((s1 - c) % P + P) % P).map((d, i) => ({ d, c: corners[i] })).filter((o) => o.d > 0 && o.d < back).sort((a, b) => a.d - b.d);
    for (const o of list) pts.push(ringPoint(r, o.c));
  }
  pts.push(ringPoint(r, s2));
  return pts;
}
const PANEL = [TRUCK.x1 - 2.3, 1.2, TRUCK.z1 + 0.15];
const LOCALTV = [-9.5, 0.6, -86.5];
function compoundTail(fromX) { return [[fromX, 0.05, -93], [fromX, 0.05, -114.6], [PANEL[0], 0.05, -114.6], PANEL]; }

export function computeRoute(pos, typeKey, linkKey) {
  const [x, y, z] = pos;
  let pts = [[x, y, z]];
  let infra = null;
  const T = CAMERA_TYPES[typeKey];
  if (linkKey === 'hf') return { pts: [], length: 0, infra: null };
  let start = [x, y, z];
  if (T.moving === 'spider') { start = [-59.4, 0.05, -39.7]; pts.push([-59.4, 40, -60], start); }
  const off = bowlOffset(start[0], start[2]);
  let main;
  if (start[1] < 3 || off < 0.5) {
    // niveau terrain
    pts.push([start[0], 0.05, start[2]]);
    const r = RINGS.pitch; const s1 = projRing(r, start[0], start[2]); const s2 = projRing(r, 2.5, -41);
    main = ringPath(r, s1, s2);
    pts.push(...main, [2.5, 0.05, -41], [2.5, 0.05, -93]);
    pts.push(...compoundTail(2.5).slice(1));
  } else if (off < 25.5) {
    const front = [clamp(start[0], -BOWL.hx, BOWL.hx), 1.5, clamp(start[2], -BOWL.hz, BOWL.hz)];
    if (Math.abs(start[0]) - BOWL.hx > Math.abs(start[2]) - BOWL.hz) front[0] = Math.sign(start[0]) * BOWL.hx; else front[2] = Math.sign(start[2]) * BOWL.hz;
    pts.push(front);
    const r = RINGS.pitch; const s1 = projRing(r, front[0], front[2]); const s2 = projRing(r, 2.5, -41);
    pts.push(...ringPath(r, s1, s2), [2.5, 0.05, -41], [2.5, 0.05, -93]);
    pts.push(...compoundTail(2.5).slice(1));
  } else {
    const r = RINGS.conc; const s1 = projRing(r, start[0], start[2]);
    const p0 = ringPoint(r, s1);
    pts.push([p0[0], Math.max(r.y, Math.min(start[1], 40)), p0[2]]);
    const s2 = projRing(r, 6, -68);
    pts.push(...ringPath(r, s1, s2), [6, 0.05, -68], [6, 0.05, -93]);
    pts.push(...compoundTail(6).slice(1));
  }
  if (linkKey === 'precab') {
    // jusqu'au local TV par le pré-câblage, puis câble du local au car
    const idx = pts.findIndex((p) => p[2] <= -92.9 && p[1] < 1);
    const infraPts = pts.slice(0, idx >= 0 ? idx : pts.length);
    infraPts.push([infraPts[infraPts.length - 1][0], 0.6, -86.5], LOCALTV);
    infra = infraPts;
    pts = [LOCALTV, [LOCALTV[0], 0.05, -93], [LOCALTV[0], 0.05, -114.6], [PANEL[0], 0.05, -114.6], PANEL];
  }
  const len = (arr) => { let L = 0; for (let i = 1; i < arr.length; i++) L += Math.hypot(arr[i][0] - arr[i - 1][0], arr[i][1] - arr[i - 1][1], arr[i][2] - arr[i - 1][2]); return L; };
  const L = len(pts) * 1.06 + 8;
  const Li = infra ? len(infra) * 1.04 + 4 : 0;
  return { pts, length: L, infra, infraLength: Li };
}

// ----------------------------------------------------------------------------------
// Modèles 3D de caméras
// ----------------------------------------------------------------------------------
function personParts(B, x, y, z, color = 0x2b3340, rotY = 0, crouch = 0) {
  const c = Math.cos(rotY), s = Math.sin(rotY);
  const P = (dx, dz) => [x + dx * c + dz * s, z - dx * s + dz * c];
  for (const sd of [-1, 1]) { const [px, pz] = P(sd * 0.1, 0); B.box(0.14, 0.85 - crouch, 0.15, px, y + (0.85 - crouch) / 2, pz, 0x1c2128, rotY); }
  { const [px, pz] = P(0, 0); B.box(0.44, 0.6, 0.26, px, y + 1.15 - crouch, pz, color, rotY); B.sphere(0.12, px, y + 1.6 - crouch, pz, 0xd2a07c, 8); B.box(0.27, 0.06, 0.27, px, y + 1.7 - crouch, pz, 0x111111, rotY); }
}

function buildModel(cam) {
  const T = cam.T;
  const root = new THREE.Group();
  const pan = new THREE.Group(); root.add(pan);
  const tilt = new THREE.Group(); pan.add(tilt);
  const Bs = new Builder(), Bp = new Builder(), Bt = new Builder();
  const lensLen = cam.L.kind === 'box' ? 0.62 : cam.L.kind === 'portable' ? 0.28 : 0.08;
  const body = 0x2a2e33, lensCol = cam.L.name.startsWith('Canon') ? 0xe9e9e9 : 0x1a1a1a;
  const y0 = -cam.mountH;
  let tally = null;
  switch (T.model) {
    case 'box': {
      // trépied
      for (let k = 0; k < 3; k++) { const a = k * 2.09; Bs.rod([0, y0 + 1.05, 0], [Math.sin(a) * 0.55, y0, Math.cos(a) * 0.55], 0.03, 0x444444); }
      Bs.cyl(0.08, 0.1, 0.12, 0, -0.32, 0, 0x222222);
      Bt.box(0.28, 0.32, 0.42, 0, 0, 0.05, body);
      Bt.box(0.34, 0.36, lensLen, 0, 0.0, -0.21 - lensLen / 2, lensCol);
      Bt.cyl(0.13, 0.13, 0.05, 0, 0, -0.21 - lensLen, 0x111111, 14, Math.PI / 2);
      Bt.box(0.22, 0.18, 0.25, 0, 0.27, 0.12, 0x1d2024);
      Bp.rod([0.12, -0.15, 0.2], [0.35, -0.25, 0.75], 0.02, 0x333333); Bp.rod([-0.12, -0.15, 0.2], [-0.35, -0.25, 0.75], 0.02, 0x333333);
      personParts(Bp, 0, y0, 0.95, 0x2d3a4f, 0);
      break;
    }
    case 'shoulder': {
      personParts(Bp, 0.18, y0, 0.15, 0x3a2f2a, 0);
      Bt.box(0.16, 0.24, 0.42, 0, 0, 0.1, body); Bt.box(0.12, 0.12, lensLen, 0, 0, -0.11 - lensLen / 2, lensCol); Bt.box(0.06, 0.08, 0.16, -0.12, 0.08, 0.05, 0x111111);
      break;
    }
    case 'steadicam': {
      personParts(Bp, 0, y0, 0.55, 0x1e2a3a, 0);
      Bp.box(0.5, 0.45, 0.3, 0, y0 + 1.2, 0.42, 0x111111); // gilet
      Bp.rod([0.2, y0 + 1.1, 0.3], [0.1, -0.15, 0.1], 0.03, 0x666666);
      Bt.box(0.14, 0.22, 0.36, 0, 0, 0.05, body); Bt.box(0.1, 0.1, lensLen, 0, 0, -0.13 - lensLen / 2, lensCol);
      Bp.rod([0, -0.12, 0.05], [0, -1.0, 0.05], 0.02, 0x888888); Bp.box(0.2, 0.18, 0.2, 0, -1.05, 0.05, 0x222222);
      Bp.box(0.1, 0.18, 0.06, 0, -0.95, 0.2, 0xd65cf2); // émetteur HF
      break;
    }
    case 'pov': {
      Bt.box(0.06, 0.06, 0.09, 0, 0, 0.02, 0x111111); Bt.cyl(0.02, 0.02, 0.02, 0, 0, -0.035, 0x333333, 8, Math.PI / 2);
      break;
    }
    case 'crane': {
      Bs.box(1.2, 0.6, 1.2, 0, -3.2, 0, 0x333a42);
      Bt.box(0.16, 0.2, 0.3, 0, 0, 0.05, body); Bt.box(0.1, 0.1, lensLen, 0, 0, -0.1 - lensLen / 2, lensCol);
      Bt.box(0.36, 0.36, 0.06, 0, 0, 0.25, 0x555555);
      break;
    }
    case 'rail': {
      Bt.box(0.16, 0.2, 0.32, 0, 0, 0.05, body); Bt.box(0.1, 0.1, lensLen, 0, 0, -0.11 - lensLen / 2, lensCol);
      Bp.box(0.6, 0.3, 0.5, 0, -0.55, 0, 0x2a2f36);
      break;
    }
    case 'spider': {
      Bt.box(0.3, 0.3, 0.3, 0, 0, 0, 0x202020); Bt.box(0.08, 0.08, 0.14, 0, -0.05, -0.2, lensCol);
      Bp.box(0.7, 0.12, 0.7, 0, 0.3, 0, 0x2b2b2b);
      break;
    }
    case 'drone': {
      Bp.box(0.5, 0.12, 0.5, 0, 0.18, 0, 0xdddddd);
      for (const [dx, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { Bp.rod([0, 0.18, 0], [dx * 0.45, 0.2, dz * 0.45], 0.02, 0x999999); Bp.cyl(0.18, 0.18, 0.01, dx * 0.45, 0.25, dz * 0.45, 0x444444, 12); }
      Bt.box(0.12, 0.1, 0.12, 0, 0, 0, 0x111111);
      break;
    }
    case 'ptz': {
      Bs.box(0.18, 0.08, 0.18, 0, -0.22, 0, 0x2a2a2a);
      Bp.box(0.16, 0.24, 0.16, 0, -0.08, 0, 0xe8e8e8);
      Bt.box(0.12, 0.12, 0.2, 0, 0, -0.02, 0x222222); Bt.cyl(0.045, 0.045, 0.03, 0, 0, -0.13, 0x111111, 10, Math.PI / 2);
      break;
    }
  }
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  if (Bs.parts.length) { const m = Bs.mesh(mat); m.castShadow = true; root.add(m); }
  if (Bp.parts.length) { const m = Bp.mesh(mat); m.castShadow = true; pan.add(m); }
  if (Bt.parts.length) { const m = Bt.mesh(mat); m.castShadow = true; tilt.add(m); }
  tally = new THREE.Mesh(new THREE.SphereGeometry(T.model === 'pov' ? 0.015 : 0.035, 8, 6), new THREE.MeshBasicMaterial({ color: 0x220000, toneMapped: false }));
  tally.position.set(0, T.model === 'box' ? 0.2 : 0.14, T.model === 'box' ? -0.15 : 0); tilt.add(tally);
  const lab = labelSprite(`CAM ${cam.id}`, { scale: T.model === 'pov' ? 2.2 : 3.2, border: '#' + LINKS[cam.link].color.toString(16).padStart(6, '0') });
  lab.position.set(0, T.model === 'box' ? 1.0 : 0.9, 0); setLayer(lab, 1); root.add(lab);
  return { root, pan, tilt, tally, label: lab };
}

// ----------------------------------------------------------------------------------
// Caméra broadcast
// ----------------------------------------------------------------------------------
export class BCam {
  constructor(o) {
    this.id = o.id;
    this.type = o.type; this.lens = o.lens || CAMERA_TYPES[o.type].defLens; this.link = o.link || CAMERA_TYPES[o.type].defLink;
    this.slotId = o.slotId || null;
    this.base = new THREE.Vector3(...o.pos);
    this.role = o.role || CAMERA_TYPES[o.type].roles[0];
    this.targetPlayer = o.targetPlayer ?? 9;
    this.ext = false;
    this.manual = false;
    this.mountH = this.T.model === 'box' ? 1.45 : this.T.model === 'shoulder' ? 1.55 : this.T.model === 'steadicam' ? 1.25 : 0;
    this.cam = new THREE.PerspectiveCamera(30, 16 / 9, 0.25, 2000);
    this.cam.rotation.order = 'YXZ';
    this.cam.position.copy(this.base);
    this.cam.layers.set(0);
    this.yaw = { v: 0, vel: 0 }; this.pitch = { v: -0.1, vel: 0 }; this.lf = { v: Math.log(30), vel: 0 };
    this.fixed = null; // cadre fixe
    this.aiT = 0; this.aiTarget = null;
    this.paint = { iris: 5.6, autoIris: false, irisClose: false, gain: 0, nd: 0, shutter: 0, wbR: 0, wbG: 0, wbB: 0, blackR: 0, blackG: 0, blackB: 0, flareR: 0, flareG: 0, flareB: 0, mblack: 0, gamma: 0, gammaOn: true, blackGamma: 0, knee: 95, kneeOn: true, detail: 30, detailOn: true, sat: 100, matrixOn: true, wbCCT: 5600, bars: false, call: 0 };
    this.powerOn = true; this.panelActive = true;
    this.hidden = { tR: 1 + gauss() * 0.035, tB: 1 + gauss() * 0.035, bR: gauss() * 0.008, bB: gauss() * 0.008 };
    this.meter = { mean: 0.4, peak: 0.8, t: 0 };
    this.tallyState = 0;
    this.status = { ok: true, reason: '', power: true };
    this.rf = this.link === 'hf' ? { txmW: 100, ch: 2150 + (o.id % 3) * 40, bw: 10, mod: '16QAM', fec: '2/3', gi: '1/16', lat: 'basse', snr: 30, margin: 10, levels: {}, state: 'ok', lostT: 0, err: 0 } : null;
    this.freezeT = 0;
    this.lastRender = -1;
    this.genlock = true;
    this.fiberCut = false;
    this.model = buildModel(this);
    this.model.root.position.copy(this.base);
    W.scene.add(this.model.root);
    const [w, h] = rtSize();
    this.rawRT = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: S.quality === 'haute' ? 4 : S.quality === 'moyenne' ? 2 : 0 });
    this.outRT = new THREE.WebGLRenderTarget(w, h, { type: THREE.UnsignedByteType, depthBuffer: false });
    this.cable = null; this.route = null;
    this.initFraming();
    this.updateLink();
  }
  get T() { return CAMERA_TYPES[this.type]; }
  get L() { return LENSES[this.lens]; }
  get sensor() { return SENSORS[this.T.sensor]; }
  get hfr() { return this.T.hfr || 1; }
  get name() { return `CAM ${this.id}`; }
  get fps() { return 50 * this.hfr; }
  get focal() { return Math.exp(this.lf.v); }
  get fMin() { return this.L.fmin * (this.ext ? 2 : 1); }
  get fMax() { return this.L.fmax * (this.ext ? 2 : 1); }
  hfov(f = this.focal) { return 2 * Math.atan(this.sensor.w / (2 * f)); }
  vfov(f = this.focal) { return 2 * Math.atan(this.sensor.h / (2 * f)); }
  get slot() { return SLOTS.find((s) => s.id === this.slotId); }
  shortLabel() { return `CAM ${this.id}`; }
  descr() { return `${this.T.short} · ${this.L.name.replace(/^(Canon|Fujinon) /, '')}`; }

  initFraming() {
    const p = this.base;
    const toC = new THREE.Vector3(0, 0, 0).sub(p);
    this.yaw.v = Math.atan2(-toC.x, -toC.z);
    this.pitch.v = Math.atan2(toC.y, Math.hypot(toC.x, toC.z));
    let f = this.L.fmin * 2;
    if (this.role === 'but') { this.yaw.v = Math.atan2(-Math.sign(-p.x) * 1, 0) ; this.pitch.v = -0.12; f = this.L.fmin; }
    this.lf.v = Math.log(clamp(f, this.L.fmin, this.L.fmax));
    if (this.role === 'fixe' || this.role === 'but') this.fixed = { yaw: this.yaw.v, pitch: this.pitch.v, f };
  }

  dispose() {
    W.scene.remove(this.model.root);
    if (this.cable) { W.scene.remove(this.cable); this.cable.geometry.dispose(); }
    if (this.infraLine) { W.scene.remove(this.infraLine); this.infraLine.geometry.dispose(); }
    if (this.wedge) { W.scene.remove(this.wedge); this.wedge.geometry.dispose(); }
    this.rawRT.dispose(); this.outRT.dispose();
  }

  resizeRT() {
    const [w, h] = rtSize();
    this.rawRT.dispose(); this.outRT.dispose();
    this.rawRT = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: S.quality === 'haute' ? 4 : S.quality === 'moyenne' ? 2 : 0 });
    this.outRT = new THREE.WebGLRenderTarget(w, h, { type: THREE.UnsignedByteType, depthBuffer: false });
  }

  // --- liaison & câble ---
  updateLink() {
    const Lk = LINKS[this.link];
    if (this.cable) { W.scene.remove(this.cable); this.cable.geometry.dispose(); this.cable = null; }
    if (this.infraLine) { W.scene.remove(this.infraLine); this.infraLine.geometry.dispose(); this.infraLine = null; }
    this.route = computeRoute(this.base.toArray(), this.type, this.link);
    if (this.route.pts.length > 1) {
      const g = new THREE.BufferGeometry().setFromPoints(this.route.pts.map((p) => new THREE.Vector3(p[0], p[1] + 0.12 + this.id * 0.03, p[2] + this.id * 0.06)));
      this.cable = new THREE.Line(g, new THREE.LineBasicMaterial({ color: Lk.color, depthTest: true }));
      setLayer(this.cable, 1); W.scene.add(this.cable);
    }
    if (this.route.infra) {
      const g = new THREE.BufferGeometry().setFromPoints(this.route.infra.map((p) => new THREE.Vector3(p[0], p[1] + 0.12 + this.id * 0.03, p[2] + this.id * 0.06)));
      this.infraLine = new THREE.Line(g, new THREE.LineDashedMaterial({ color: 0xffd23f, dashSize: 1.5, gapSize: 1.2 }));
      this.infraLine.computeLineDistances(); setLayer(this.infraLine, 1); W.scene.add(this.infraLine);
    }
    this.checkLink();
  }
  checkLink() {
    const Lk = LINKS[this.link];
    let ok = true, reason = '', power = true, warn = '';
    if (this.link !== 'hf') {
      const max = Lk.max[S.format];
      if (this.route.length > max) {
        ok = false;
        if (Lk.power) { power = false; reason = `Câble trop long (${Math.round(this.route.length)} m > ${max} m) : chute de tension, la CCU ne peut pas alimenter la caméra.`; }
        else reason = `Liaison trop longue (${Math.round(this.route.length)} m > ${max} m en ${S.format === 'UHD' ? '12G-SDI' : '3G-SDI'}) : signal inexploitable.`;
      }
      if (!Lk.power && ok) warn = 'Alimentation locale nécessaire à la caméra (bloc secteur ou batterie).';
      if (this.link === 'precab' && !(this.slot && this.slot.precab)) { ok = false; reason = 'Pas de pré-câblage à cette position.'; }
      if (this.link === 'triax' && S.format === 'UHD') warn = 'UHD sur triax : possible sur certains systèmes, portée réduite.';
    }
    if (this.fiberCut) { ok = false; reason = 'Coupure de la liaison (fibre endommagée) : plus de signal optique à la CCU.'; }
    if (this.powerOn === false) { ok = false; power = false; reason = 'Caméra hors tension (touche CAM PW éteinte au RCP).'; }
    this.status = { ok, reason, power, warn };
  }
  get signalOK() { return this.status.ok && (!this.rf || this.rf.state !== 'lost'); }

  // --- exposition ---
  effAperture() { return Math.max(this.paint.iris, maxAperture(this.L, this.focal / (this.ext ? 2 : 1) * 1, this.ext)); }
  exposureTime() { const sh = SHUTTERS[this.paint.shutter].v; const base = 1 / this.fps; return sh ? Math.min(base, 1 / sh) : base; }
  exposure(ctime = S.simTime) {
    const N = this.effAperture();
    let e = K_EXPO.k * (1 / (N * N)) * Math.pow(10, this.paint.gain / 20) * ND_FILTERS[this.paint.nd].f * (this.exposureTime() * 50);
    if (S.flickerLamps && S.lighting === 'nuit') {
      const te = this.exposureTime(); const x = Math.PI * 100 * te;
      const amp = 0.35 * Math.abs(Math.sin(x) / x);
      e *= 1 + amp * Math.sin(2 * Math.PI * 100 * (ctime + te / 2));
    }
    return e;
  }
  wbGains() {
    const ill = kelvinRGBNorm(this.paint.wbCCT);
    return [1 / ill[0] * this.hidden.tR * (1 + this.paint.wbR * 0.0025), 1 + (this.paint.wbG || 0) * 0.0025, 1 / ill[2] * this.hidden.tB * (1 + this.paint.wbB * 0.0025)];
  }
  autoWhite() {
    this.paint.wbCCT = S.sceneCCT; this.paint.wbR = Math.round((1 / this.hidden.tR - 1) / 0.0025); this.paint.wbB = Math.round((1 / this.hidden.tB - 1) / 0.0025);
  }
  autoBlack() { this.paint.blackR = Math.round(-this.hidden.bR / 0.0003); this.paint.blackB = Math.round(-this.hidden.bB / 0.0003); }
  // écart de couleur restant (pour le matching)
  colorError() {
    const g = this.wbGains(); const ill = kelvinRGBNorm(S.sceneCCT);
    const r = g[0] * ill[0] / g[1], b = g[2] * ill[2] / g[1];
    return { r: r - 1, b: b - 1, blackR: this.hidden.bR + this.paint.blackR * 0.0003, blackB: this.hidden.bB + this.paint.blackB * 0.0003 };
  }
  setPaintUniforms(ctime = S.simTime) {
    const u = paintMat.uniforms; const p = this.paint;
    u.uExpo.value = this.exposure(ctime);
    const g = this.wbGains(); u.uWB.value.set(g[0], g[1], g[2]);
    const mb = p.mblack * 0.0012;
    u.uBlack.value.set(mb + this.hidden.bR + (p.blackR + p.flareR * 0.5) * 0.0003, mb + (p.blackG + p.flareG * 0.5) * 0.0003, mb + this.hidden.bB + (p.blackB + p.flareB * 0.5) * 0.0003);
    u.uGamma.value = p.gammaOn ? 0.45 - p.gamma * 0.0012 : 1.0;
    u.uKnee.value = p.kneeOn ? p.knee / 100 : 1.2;
    u.uDetail.value = p.detailOn ? p.detail / 100 : 0;
    u.uSat.value = p.matrixOn ? p.sat / 100 : 1;
    u.uBlackGamma.value = p.blackGamma / 99 * 0.06;
    u.uNoise.value = 0.0025 * Math.pow(10, p.gain / 20) * (this.T.sensor === '2/3' ? 1 : 1.6);
    u.uSeed.value = (S.frame * 0.618 + this.id * 1.3) % 100;
    u.uTexel.value.set(1 / this.rawRT.width, 1 / this.rawRT.height);
    u.uIris.value = p.irisClose || p.iris >= 99 ? 0 : 1;
    let block = 0, brk = 0;
    if (this.rf) { block = this.rf.block || 0; brk = this.rf.brk || 0; }
    u.uBlock.value = block; u.uBreak.value = brk;
    u.uRoll.value = this.genlock ? 0 : ((S.time * 0.7) % 1) * (Math.sin(S.time * 3) > 0.6 ? 1 : 0.02);
  }

  // rendu : scène -> raw (HDR linéaire) -> traitement CCU -> out
  render(renderer, scene, pose = null, target = this.outRT, ctime = S.simTime) {
    const c = this.cam;
    const savePos = c.position.clone(), sy = c.rotation.y, sx = c.rotation.x, sf = c.fov;
    if (pose) { c.position.set(pose[0], pose[1], pose[2]); c.rotation.set(pose[4], pose[3], 0); c.fov = pose[5]; c.updateProjectionMatrix(); }
    this.model.root.visible = false;
    renderer.setRenderTarget(this.rawRT);
    renderer.render(scene, c);
    this.model.root.visible = true;
    this.setPaintUniforms(ctime);
    paintMat.uniforms.tRaw.value = this.rawRT.texture;
    renderer.setRenderTarget(target);
    renderer.render(fsScene, fsCam);
    if (pose) { c.position.copy(savePos); c.rotation.set(sx, sy, 0); c.fov = sf; c.updateProjectionMatrix(); }
  }

  // --- cadreur automatique ---
  update(dt) {
    const b = M.ball; const T = this.T;
    let P = null, Wd = 20, omega = 3, maxV = 1.2;
    const lead = 0.5;
    const owner = M.owner >= 0 ? M.humans[M.owner] : null;
    const cel = M.state === 'celebration' && M.scorer >= 0 ? M.humans[M.scorer] : null;
    this.aiT -= dt;
    // déplacements des machineries
    if (T.moving && !this.manualMove) this.moveRig(dt);
    const pos = this.cam.position;
    switch (this.role) {
      case 'large': P = new THREE.Vector3(b.x + b.vx * lead, 0.5, b.z * 0.75 + b.vz * 0.3); Wd = 34 + Math.min(12, Math.hypot(b.vx, b.vz) * 0.6); omega = 2.2; break;
      case 'semi': P = new THREE.Vector3(b.x + b.vx * 0.4, 0.8, b.z + b.vz * 0.2); Wd = 19; omega = 2.8; break;
      case 'tactique': P = new THREE.Vector3(b.x * 0.75, 0, b.z * 0.4); Wd = 78; omega = 1.5; break;
      case 'serre': {
        const tgt = cel || owner;
        if (tgt) { P = new THREE.Vector3(tgt.x + tgt.vx * 0.15, 1.0, tgt.z + tgt.vz * 0.15); Wd = cel ? 4.5 : 6.5; }
        else { P = new THREE.Vector3(b.x, Math.max(0.8, b.y), b.z); Wd = 12; }
        omega = 4; maxV = 2; break;
      }
      case 'joueur': {
        const tgt = cel || M.humans[this.targetPlayer] || owner;
        P = new THREE.Vector3(tgt.x, 1.15, tgt.z); Wd = 3.8; omega = 4.5; maxV = 2; break;
      }
      case 'bancs': {
        if (this.aiT <= 0) { this.aiTarget = rand() < 0.5 ? -10 : 10; this.aiT = 8 + rand() * 6; }
        P = new THREE.Vector3(this.aiTarget + (M.state === 'celebration' ? 0 : 0) - 3.2, 1.25, -38.7); Wd = 3.2; omega = 3; break;
      }
      case 'tribune': {
        if (this.aiT <= 0) {
          const side = M.state === 'celebration' && M.lastGoal ? (M.attackDir[M.lastGoal.team] > 0 ? 1 : -1) : (rand() < 0.5 ? -1 : 1);
          this.aiTarget = new THREE.Vector3(side * (BOWL.hx + 8 + rand() * 12), 0, (rand() - 0.5) * 40);
          this.aiTarget.y = standHeight(bowlOffset(this.aiTarget.x, this.aiTarget.z)) + 0.8; this.aiT = 7 + rand() * 5;
        }
        P = this.aiTarget; Wd = 12; omega = 2; break;
      }
      case 'tunnel': P = new THREE.Vector3(b.x * 0.4, 1.2, Math.max(-30, b.z)); Wd = 14; omega = 2; break;
      case 'comm': P = new THREE.Vector3(11.55, TIERS_Y + 1.32, -(BOWL.hz + 26.5)); Wd = 1.9; omega = 2; break;
      case 'grue': P = new THREE.Vector3(b.x * 0.8, 0.8, b.z * 0.6); Wd = 24; omega = 2; break;
      case 'suivi': P = new THREE.Vector3(b.x + b.vx * 0.3, Math.max(0.8, b.y * 0.5), b.z + b.vz * 0.2); Wd = T.moving === 'spider' ? 18 : T.moving === 'drone' ? 80 : 10; omega = 3; break;
      case 'beaute': P = new THREE.Vector3(0, 0, 0); Wd = 400; omega = 1; break;
      case 'fixe': case 'but': default: P = null;
    }
    if (this.manual) return;
    if (!P) { // cadre fixe
      if (this.fixed) { springAngle(this.yaw, this.fixed.yaw, 3, dt); spring(this.pitch, this.fixed.pitch, 3, dt); spring(this.lf, Math.log(clamp(this.fixed.f, this.fMin, this.fMax)), 3, dt); }
    } else {
      const d = P.clone().sub(pos);
      const dist = d.length();
      const yawT = Math.atan2(-d.x, -d.z), pitchT = Math.atan2(d.y, Math.hypot(d.x, d.z));
      springAngle(this.yaw, yawT, omega, dt, maxV);
      spring(this.pitch, pitchT, omega, dt, maxV * 0.6);
      const fT = clamp(this.sensor.w * dist / Wd, this.fMin, this.fMax);
      spring(this.lf, Math.log(fT), omega * 0.6, dt, 1.4);
    }
    this.applyPose();
  }

  moveRig(dt) {
    const b = M.ball; const p = this.cam.position; const T = this.T;
    const mv = (axis, target, vmax) => { const d = target - p[axis]; p[axis] += clamp(d, -vmax * dt, vmax * dt); };
    if (T.moving === 'touchline') {
      const x0 = this.base.x; mv('x', clamp(b.x - 4 * Math.sign(this.base.z) * 0, x0 - 28, x0 + 28), 3.2); p.y = this.base.y; p.z = this.base.z;
    } else if (T.moving === 'rail') { mv('x', clamp(b.x, -50, 50), 8.5); p.y = this.base.y; p.z = this.base.z; }
    else if (T.moving === 'spider') {
      const dir = b.vx >= 0 ? 1 : -1;
      mv('x', clamp(b.x - dir * 14, -45, 45), 7); mv('z', clamp(b.z * 0.6 - 7, -28, 26), 6); mv('y', 15 + Math.sin(S.simTime * 0.1) * 3, 2);
    } else if (T.moving === 'drone') {
      const a = S.simTime * 0.035; p.set(Math.cos(a) * 150, 62 + Math.sin(a * 2.3) * 5, Math.sin(a) * 125);
    } else if (T.moving === 'crane') {
      const pivot = this.base; const toB = Math.atan2(b.z - pivot.z, b.x - pivot.x);
      this.armA = this.armA ?? toB; this.armA += clamp(wrapAngle(toB - this.armA), -0.3 * dt, 0.3 * dt);
      const armA = clamp(this.armA, -0.1, 1.5);
      const hgt = 4.5 + 3.5 * Math.sin(S.simTime * 0.12);
      p.set(pivot.x + Math.cos(armA) * 7, pivot.y + hgt - 3.5, pivot.z + Math.sin(armA) * 7);
      if (this.boom) { this.boom.position.copy(pivot); this.boom.lookAt(p); this.boom.scale.z = pivot.distanceTo(p); }
    }
    this.model.root.position.copy(p);
  }

  applyPose() {
    const c = this.cam;
    c.rotation.set(this.pitch.v, this.yaw.v, 0);
    const f = this.focal;
    c.fov = this.vfov(f) / DEG;
    c.updateProjectionMatrix();
    // modèle : panoramique et inclinaison
    this.model.pan.rotation.y = this.yaw.v;
    this.model.tilt.rotation.x = this.pitch.v;
    if (!this.T.moving) this.model.root.position.copy(this.base);
  }

  setTally(state) {
    if (this.tallyState === state) return;
    this.tallyState = state;
    this.model.tally.material.color.setHex(state === 2 ? 0xff1a1a : state === 1 ? 0x22ff55 : 0x220000);
    if (state === 2) this.model.tally.material.color.multiplyScalar(4);
  }
}
const TIERS_Y = 13.5;

// ----------------------------------------------------------------------------------
// Gestion de l'ensemble des caméras
// ----------------------------------------------------------------------------------
export function addCamera(o) {
  const id = o.id ?? nextCamId();
  if (id == null) return null;
  const slot = o.slotId ? SLOTS.find((s) => s.id === o.slotId) : null;
  const pos = o.pos || slot.pos;
  const cam = new BCam({ ...o, id, pos });
  if (o.crane !== false && cam.T.model === 'crane') {
    const boom = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 1), new THREE.MeshLambertMaterial({ color: 0x9aa3ad }));
    boom.geometry.translate(0, 0, 0.5); W.scene.add(boom); cam.boom = boom; boom.castShadow = true;
    const old = cam.dispose.bind(cam); cam.dispose = () => { W.scene.remove(boom); old(); };
  }
  if (cam.T.moving === 'spider') {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(8 * 3), 3));
    const lines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x222222 })); lines.frustumCulled = false; W.scene.add(lines); cam.ropes = lines;
    const old = cam.dispose.bind(cam); cam.dispose = () => { W.scene.remove(lines); old(); };
  }
  S.cams.push(cam); S.cams.sort((a, b) => a.id - b.id);
  emit('cams');
  return cam;
}
export function removeCamera(id) {
  const c = camById(id); if (!c) return;
  c.dispose(); S.cams.splice(S.cams.indexOf(c), 1); emit('cams');
}
export function clearCameras() { for (const c of [...S.cams]) { c.dispose(); } S.cams.length = 0; emit('cams'); }

export function updateRopes(cam) {
  if (!cam.ropes) return;
  const a = cam.ropes.geometry.attributes.position; const p = cam.cam.position;
  const anchors = [[-95, 40, -75], [95, 40, -75], [95, 40, 75], [-95, 40, 75]];
  anchors.forEach((q, i) => { a.setXYZ(i * 2, p.x, p.y + 0.35, p.z); a.setXYZ(i * 2 + 1, q[0], q[1], q[2]); });
  a.needsUpdate = true;
}

// Réglage initial "propre" de l'exposition selon la lumière (line-up déjà fait)
export function lineUpCamera(cam, quality = 1) {
  const p = cam.paint;
  const preset = { jour: [8, 1], fin: [4, 1], couvert: [5.6, 0], nuit: [2.8, 0] }[S.lighting] || [5.6, 0];
  let n = preset[0]; let nd = preset[1];
  // compensation HFR
  if (cam.hfr === 3) n /= 1.7; if (cam.hfr === 6) n /= 2.45;
  if (n < 2) { n = 2; }
  if (cam.T.sensor !== '2/3') { n = Math.max(2, n / 1.4); }
  p.iris = IRIS_STOPS.reduce((a, b) => (Math.abs(b - n) < Math.abs(a - n) ? b : a));
  p.nd = nd;
  if (quality >= 1) { cam.autoWhite(); cam.autoBlack(); p.wbR += Math.round(gauss() * 6); p.wbB += Math.round(gauss() * 6); }
}

export const PRESETS = {
  basique: [
    { slotId: 'g_c1', type: 'plateau', lens: 'UJ86', role: 'large' },
    { slotId: 'g_c2', type: 'plateau', lens: 'UA107', role: 'serre' },
    { slotId: 'g_16l', type: 'plateau', lens: 'UJ86', role: 'semi' },
    { slotId: 'g_16r', type: 'plateau', lens: 'UJ86', role: 'semi' },
    { slotId: 'pitch_c', type: 'portable', lens: 'CJ24', role: 'joueur', link: 'smpte' },
    { slotId: 'steadi_l', type: 'steadicam', role: 'suivi' },
  ],
  standard: [
    { slotId: 'g_c1', type: 'plateau', lens: 'UJ86', role: 'large' },
    { slotId: 'g_c2', type: 'plateau', lens: 'UA107', role: 'serre' },
    { slotId: 'g_c3', type: 'hfr3', lens: 'UJ86', role: 'joueur' },
    { slotId: 'g_16l', type: 'plateau', lens: 'UJ86', role: 'semi' },
    { slotId: 'g_16r', type: 'plateau', lens: 'UJ86', role: 'semi' },
    { slotId: 'pitch_gl', type: 'hfr3', lens: 'CJ45', role: 'serre' },
    { slotId: 'pitch_gr', type: 'portable', lens: 'CJ45', role: 'serre' },
    { slotId: 'steadi_l', type: 'steadicam', role: 'suivi' },
    { slotId: 'pitch_c', type: 'portable', lens: 'CJ24', role: 'bancs' },
    { slotId: 'end_hl', type: 'plateau', lens: 'UJ86', role: 'semi', link: 'precab' },
    { slotId: 'opp_c', type: 'plateau', lens: 'UJ86', role: 'semi', link: 'smpte' },
    { slotId: 'pov_l', type: 'pov', role: 'but', link: 'smf' },
  ],
  grand: [
    { slotId: 'g_c1', type: 'plateau', lens: 'UJ86', role: 'large' },
    { slotId: 'g_c2', type: 'plateau', lens: 'UJ122', role: 'serre' },
    { slotId: 'g_c3', type: 'hfr6', lens: 'UA107', role: 'joueur' },
    { slotId: 'g_16l', type: 'hfr3', lens: 'UJ86', role: 'semi' },
    { slotId: 'g_16r', type: 'hfr3', lens: 'UJ86', role: 'semi' },
    { slotId: 'high_c', type: 'plateau', lens: 'UJ27', role: 'tactique' },
    { slotId: 'pitch_gl', type: 'portable', lens: 'CJ45', role: 'serre' },
    { slotId: 'pitch_gr', type: 'portable', lens: 'CJ45', role: 'serre' },
    { slotId: 'steadi_l', type: 'steadicam', role: 'suivi' },
    { slotId: 'steadi_r', type: 'steadicam', role: 'suivi' },
    { slotId: 'spider', type: 'spider', role: 'suivi' },
    { slotId: 'rail_opp', type: 'rail', role: 'suivi' },
    { slotId: 'pov_l', type: 'pov', role: 'but', link: 'smf' },
    { slotId: 'pov_r', type: 'pov', role: 'but', link: 'smf' },
    { slotId: 'crane_l', type: 'grue', role: 'grue' },
    { slotId: 'comm', type: 'ptz', role: 'comm', link: 'ip' },
  ],
};

export function loadPreset(name, lineup = true) {
  clearCameras();
  for (const o of PRESETS[name] || []) {
    const c = addCamera(o);
    if (c && lineup) lineUpCamera(c);
  }
}

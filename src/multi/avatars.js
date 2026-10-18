// @ts-check
import * as THREE from 'three';
import { personGeometries } from '../people.js';
import { camById } from '../state.js';
import { makeCanvas } from '../util.js';
import { SES, ROLES_S, pseudoOf } from './session.js';

// ----------------------------------------------------------------------------------
// Avatars des autres joueurs d'une session : un technicien articulé (mêmes formes que les
// joueurs du match), tenue de la couleur de son rôle, casque d'ordres, étiquette pseudo + rôle.
// · il marche là où le joueur marche (stade, compound, passerelle) ou dans le car ;
// · au poste, il s'assoit sur la chaise du pupitre s'il y en a une, face aux écrans ;
// · quand il cadre une caméra, c'est le cadreur de cette caméra qui porte son étiquette.
// La position arrive environ 12 fois par seconde : on la lisse pour un mouvement fluide.
// ----------------------------------------------------------------------------------
export const ROLE_COLORS = {
  formateur: '#f2cf45', realisateur: '#e8392f', truquiste: '#f0a61c', evs: '#c77dff', son: '#46c6f2',
  vision: '#2fbf5a', technique: '#ff7a1a', habillage: '#ff6fb1', cadreur: '#8ccdf2', observateur: '#9aa3ab',
};
const AV = { list: new Map(), W: null, T: null, stations: [], chairs: [] };
export const AVATARS = AV;
const SKINS = [0xf1c6a5, 0xe0ac86, 0xc68a62, 0x9c6b47, 0x7a4e30, 0x5a3a24];
const HAIRS = [0x1a1410, 0x3b2a1a, 0x5a4026, 0x0c0c0c, 0x8a6a3a, 0xb8b0a4];

export function initAvatars(Wscene, Tscene, opts = {}) {
  AV.W = Wscene; AV.T = Tscene; AV.stations = opts.stations || []; AV.chairs = opts.chairs || [];
}

// ---------------- matériaux : deux couleurs par pièce (masque des géométries) ----------------
const FACE = `
  {
    vec3 q = vLoc - vec3(0.0, 0.17, 0.0);
    if (q.z > 0.05 && vMk < 0.5) {
      float ax = abs(q.x);
      float eye = 1.0 - smoothstep(0.0075, 0.0125, length(vec2((ax - 0.031) * 0.8, q.y - 0.012)));
      float brow = (1.0 - smoothstep(0.0025, 0.006, abs(q.y - 0.034 + ax * 0.08))) * step(0.012, ax) * step(ax, 0.05);
      float mouth = (1.0 - smoothstep(0.0025, 0.0055, abs(q.y + 0.05 + ax * ax * 4.0))) * step(ax, 0.022);
      diffuseColor.rgb *= 1.0 - 0.78 * eye - 0.55 * brow - 0.5 * mouth;
    }
  }`;
function toneMat(c1, c2, face = false, rough = 0.78) {
  const m = new THREE.MeshStandardMaterial({ color: c1, roughness: rough, metalness: 0 });
  const col2 = new THREE.Color(c2);
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uCol2 = { value: col2 };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aMask; varying float vMk; varying vec3 vLoc;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMk = aMask; vLoc = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uCol2; varying float vMk; varying vec3 vLoc;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, uCol2, step(0.5, vMk));' + (face ? FACE : ''));
  };
  m.customProgramCacheKey = () => 'avatar' + (face ? '-f' : '');
  return m;
}
const darker = (hex, k) => { const c = new THREE.Color(hex); c.multiplyScalar(k); return c.getHex(); };

// ---------------- construction d'un avatar ----------------
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function build(seed, role) {
  const G = personGeometries();
  const h = hashStr(seed);
  const skin = SKINS[h % SKINS.length], hair = HAIRS[(h >>> 4) % HAIRS.length];
  const shirt = new THREE.Color(ROLE_COLORS[role] || '#9aa3ab').getHex();
  const pants = [0x1d2129, 0x2a2f38, 0x23262b, 0x3a3328][(h >>> 8) % 4];
  const M = {
    torso: toneMat(shirt, darker(shirt, 0.55)), pelvis: toneMat(pants, pants, false, 0.85), head: toneMat(skin, hair, true, 0.6),
    thigh: toneMat(pants, pants, false, 0.85), shin: toneMat(pants, pants, false, 0.85), boot: toneMat(0x16171a, 0x2c2c2c, false, 0.5),
    arm: toneMat(shirt, shirt), fore: toneMat(shirt, shirt), hand: toneMat(skin, skin, false, 0.65),
  };
  const mesh = (g, m) => { const o = new THREE.Mesh(g, m); o.castShadow = true; o.receiveShadow = true; return o; };
  const root = new THREE.Group(); root.name = 'avatar';
  const hips = new THREE.Group(); hips.position.y = 0.975; root.add(hips);
  hips.add(mesh(G.pelvis, M.pelvis));
  const torso = new THREE.Group(); torso.position.y = 0.1; hips.add(torso); torso.add(mesh(G.torso, M.torso));
  const head = new THREE.Group(); head.position.set(0, 0.5, 0.005); torso.add(head); head.add(mesh(G.head, M.head));
  // casque d'ordres : arceau, deux écouteurs, micro
  if (role !== 'observateur') {
    const bk = new THREE.MeshStandardMaterial({ color: 0x111214, roughness: 0.45, metalness: 0.2 });
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.094, 0.009, 6, 20, Math.PI), bk); band.position.y = 0.18; head.add(band);
    for (const s of [-1, 1]) { const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.026, 14), bk); cup.rotation.z = Math.PI / 2; cup.position.set(s * 0.092, 0.165, 0); head.add(cup); }
    const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.13, 5), bk); boom.position.set(-0.075, 0.115, 0.055); boom.rotation.set(1.2, 0, -0.35); head.add(boom);
  }
  const legs = [], arms = [];
  for (const sg of [-1, 1]) {
    const th = new THREE.Group(); th.position.set(sg * 0.095, -0.03, 0); hips.add(th); th.add(mesh(G.thigh, M.thigh));
    const sh = new THREE.Group(); sh.position.y = -0.44; th.add(sh); sh.add(mesh(G.shin, M.shin));
    const ft = new THREE.Group(); ft.position.y = -0.43; sh.add(ft); ft.add(mesh(G.boot, M.boot));
    legs.push({ th, sh, ft, sg });
    const ua = new THREE.Group(); ua.position.set(sg * 0.2, 0.43, 0); torso.add(ua); ua.add(mesh(G.upperArm, M.arm));
    const fa = new THREE.Group(); fa.position.y = -0.29; ua.add(fa); fa.add(mesh(G.forearm, M.fore));
    const hd = new THREE.Group(); hd.position.y = -0.25; fa.add(hd); hd.add(mesh(G.hand, M.hand));
    arms.push({ ua, fa, hd, sg });
  }
  return { root, hips, torso, head, legs, arms, mats: M };
}

// ---------------- étiquette : pseudo + rôle ----------------
function tagTexture(name, roleTxt, color) {
  const c = makeCanvas(512, 136); const g = c.getContext('2d');
  g.font = '700 54px "Barlow Semi Condensed", "Barlow Condensed", "Arial Narrow", sans-serif';
  const w1 = g.measureText(name).width;
  g.font = '600 30px "Barlow Semi Condensed", "Barlow Condensed", "Arial Narrow", sans-serif';
  const w2 = g.measureText(roleTxt.toUpperCase()).width;
  const w = Math.min(500, Math.max(w1, w2) + 52), x0 = (512 - w) / 2;
  g.fillStyle = 'rgba(8,10,12,0.82)'; g.beginPath(); g.roundRect ? g.roundRect(x0, 6, w, 124, 14) : g.rect(x0, 6, w, 124); g.fill();
  g.fillStyle = color; g.fillRect(x0, 6, 10, 124);
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.fillStyle = '#f4f6f7'; g.font = '700 54px "Barlow Semi Condensed", "Barlow Condensed", "Arial Narrow", sans-serif'; g.fillText(name, 261, 66, w - 40);
  g.fillStyle = color; g.font = '600 30px "Barlow Semi Condensed", "Barlow Condensed", "Arial Narrow", sans-serif'; g.fillText(roleTxt.toUpperCase(), 261, 110, w - 40);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function makeTag() {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, toneMapped: false }));
  sp.scale.set(1.15, 0.305, 1); sp.renderOrder = 5; sp.center.set(0.5, 0);
  sp.layers.set(1); // calque des étiquettes : les caméras du stade ne les filment pas
  return sp;
}

// ---------------- mise à jour ----------------
const tmpV = new THREE.Vector3();
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
export function updateAvatars(dt, eye) {
  if (!AV.W) return;
  const seen = new Set();
  if (SES.active) for (const p of SES.peers) {
    if (p.sameTab) continue;
    const pr = p.presence || {}; const av = pr.av;
    if (!av || !Array.isArray(av.p)) continue;
    seen.add(p.peer);
    let A = AV.list.get(p.peer);
    const role = ROLES_S[pr.role] ? pr.role : 'observateur';
    const name = pseudoOf(p);
    if (!A || A.role !== role) { if (A) dispose(A); A = create(p.peer, pr.bid || p.peer, role); AV.list.set(p.peer, A); }
    const roleTxt = ROLES_S[role].label + (role === 'cadreur' && pr.cam ? ' · CAM ' + pr.cam : '') + (SES.hostPeer && SES.hostPeer.peer === p.peer ? ' · hôte' : '');
    if (A.tagKey !== name + '|' + roleTxt) { A.tagKey = name + '|' + roleTxt; if (A.tag.material.map) A.tag.material.map.dispose(); A.tag.material.map = tagTexture(name, roleTxt, ROLE_COLORS[role]); A.tag.material.needsUpdate = true; }
    step(A, av, dt, eye);
  }
  for (const [id, A] of AV.list) if (!seen.has(id)) { dispose(A); AV.list.delete(id); }
}
function create(peer, seed, role) {
  const A = build(seed, role);
  A.role = role; A.peer = peer; A.tag = makeTag(); A.pos = null; A.yaw = 0; A.speed = 0; A.phase = Math.random() * 6; A.scene = null; A.sit = 0;
  return A;
}
function dispose(A) {
  if (A.scene) { A.scene.remove(A.root); A.scene.remove(A.tag); }
  A.root.traverse((o) => { if (o.isMesh) { if (o.material && !Object.values(A.mats).includes(o.material)) o.material.dispose(); } });
  for (const m of Object.values(A.mats)) m.dispose();
  if (A.tag.material.map) A.tag.material.map.dispose(); A.tag.material.dispose();
}
function setScene(A, sc) {
  if (A.scene === sc) return;
  if (A.scene) { A.scene.remove(A.root); A.scene.remove(A.tag); }
  A.scene = sc; if (sc) { sc.add(A.root); sc.add(A.tag); }
}

function step(A, av, dt, eye) {
  const inTruck = !!av.t;
  setScene(A, inTruck ? AV.T : AV.W);
  // cadreur : son étiquette se pose au-dessus du cadreur de la caméra qu'il tient
  const cam = av.c ? camById(av.c) : null;
  if (cam && !inTruck) {
    A.root.visible = false;
    const r = cam.model.root.position, yw = cam.yaw.v;
    A.tag.position.set(r.x + Math.sin(yw) * 1.0, r.y + 0.7, r.z + Math.cos(yw) * 1.0);
    scaleTag(A, eye); A.pos = null; return;
  }
  A.root.visible = true;
  // cible : position reçue, ou siège du poste qu'il occupe
  let tx = av.p[0], ty = av.p[1], tz = av.p[2], tyaw = av.a + Math.PI, sit = 0;
  if (av.s && inTruck) {
    let st = null, bd = 9;
    for (const s of AV.stations) { if (s.station !== av.s) continue; const d = Math.hypot(s.pos.x - tx, s.pos.z - tz); if (d < bd) { bd = d; st = s; } }
    if (st) {
      tyaw = Math.atan2(st.look.x - st.pos.x, st.look.z - st.pos.z);
      let ch = null, cd = 0.75;
      for (const c of AV.chairs) { const d = Math.hypot(c.x - st.pos.x, c.z - st.pos.z); if (d < cd) { cd = d; ch = c; } }
      if (ch) { tx = ch.x; tz = ch.z; ty = ch.y; sit = 1; } else { tx = st.pos.x; tz = st.pos.z; }
    }
  }
  if (!A.pos) { A.pos = new THREE.Vector3(tx, ty, tz); A.yaw = tyaw; }
  // lissage : on rattrape la cible en ~0,15 s ; un saut (téléportation) est appliqué tel quel
  const d = Math.hypot(tx - A.pos.x, tz - A.pos.z);
  if (d > 6 || Math.abs(ty - A.pos.y) > 3) { A.pos.set(tx, ty, tz); A.speed = 0; }
  else {
    const k = 1 - Math.exp(-dt * 9);
    const ox = A.pos.x, oz = A.pos.z;
    A.pos.x += (tx - A.pos.x) * k; A.pos.z += (tz - A.pos.z) * k; A.pos.y += (ty - A.pos.y) * (1 - Math.exp(-dt * 12));
    const v = dt > 0 ? Math.hypot(A.pos.x - ox, A.pos.z - oz) / dt : 0;
    A.speed += (v - A.speed) * Math.min(1, dt * 6);
  }
  // en marchant, il regarde où il va ; sinon dans la direction de sa caméra
  A.yaw += wrap(tyaw - A.yaw) * Math.min(1, dt * 8);
  A.sit += (sit - A.sit) * Math.min(1, dt * 5);
  A.phase += dt * (A.speed > 0.15 ? 2.2 + A.speed * 1.6 : 0);
  pose(A, av.f ? 0 : A.speed, av.f);
  A.root.position.copy(A.pos); A.root.rotation.y = A.yaw;
  A.tag.position.set(A.pos.x, A.pos.y + (A.sit > 0.5 ? 1.5 : 2.02), A.pos.z);
  scaleTag(A, eye);
}
function scaleTag(A, eye) {
  // lisible de loin : l'étiquette grossit avec la distance (jusqu'à 6 fois)
  const dist = eye ? tmpV.copy(A.tag.position).distanceTo(eye) : 5;
  const s = Math.min(6, Math.max(1, dist / 14));
  A.tag.scale.set(1.15 * s, 0.305 * s, 1);
}
// pose : marche procédurale, assis, ou en vol (bras le long du corps)
function pose(A, speed, fly) {
  const walk = Math.min(1, speed / 1.4), sf = Math.min(1, speed / 6);
  const ph = A.phase, sit = A.sit;
  const bob = Math.abs(Math.sin(ph)) * 0.02 * walk;
  A.hips.position.y = 0.975 * (1 - sit) + 0.1 * sit + bob;
  A.hips.position.z = -0.06 * sit;
  A.torso.rotation.x = 0.04 + 0.12 * sf + 0.08 * sit;
  A.head.rotation.x = -0.05 + 0.1 * sit;
  for (const L of A.legs) {
    const p = ph + (L.sg > 0 ? Math.PI : 0);
    const th = Math.sin(p) * (0.1 + 0.45 * sf) * walk;
    const knee = 0.05 + (0.2 + 1.0 * sf) * Math.pow(Math.max(0, Math.cos(p - 0.35)), 1.6) * walk;
    L.th.rotation.x = -(th * (1 - sit) + 1.45 * sit); L.th.rotation.z = L.sg * 0.03;
    L.sh.rotation.x = knee * (1 - sit) + 1.5 * sit;
    L.ft.rotation.x = -0.1 * sit;
  }
  for (const R of A.arms) {
    const p = ph + (R.sg > 0 ? 0 : Math.PI);
    const sw = Math.sin(p) * (0.12 + 0.45 * sf) * walk;
    // assis : avant-bras posés sur le pupitre
    R.ua.rotation.x = -sw * (1 - sit) - 0.45 * sit; R.ua.rotation.z = R.sg * (fly ? 0.25 : 0.08);
    R.fa.rotation.x = -(0.2 + 0.9 * sf * walk) * (1 - sit) - 1.0 * sit;
  }
}

// ---------------- pour la carte du car et « Aller à un équipier » ----------------
export function avatarPositions() {
  const out = [];
  if (!SES.active) return out;
  for (const p of SES.peers) {
    if (p.sameTab) continue;
    const pr = p.presence || {}; if (!pr.av || !Array.isArray(pr.av.p)) continue;
    const A = AV.list.get(p.peer);
    const pos = A && A.pos ? A.pos : { x: pr.av.p[0], y: pr.av.p[1], z: pr.av.p[2] };
    out.push({ peer: p.peer, name: pseudoOf(p), role: ROLES_S[pr.role] ? pr.role : 'observateur', x: pos.x, y: pos.y, z: pos.z, yaw: pr.av.a, truck: !!pr.av.t, station: pr.av.s || null, cam: pr.av.c || null, color: ROLE_COLORS[pr.role] || '#9aa3ab' });
  }
  return out;
}

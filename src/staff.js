// @ts-check
import * as THREE from 'three';
import { personGeometries, kitMaterial, PARTS, PEOPLE } from './people.js';
import { mulberry32 } from './util.js';
import { BANCS, TABLE4, PHOTOGRAPHES } from './bordterrain.js';

// ----------------------------------------------------------------------------------
// Les personnes du bord terrain qui ne jouent pas : entraîneurs (debout dans la zone technique,
// ils font les cent pas et donnent des consignes), adjoints, remplaçants et staff assis sur les
// bancs, remplaçants à l'échauffement le long de la touche, 4e arbitre à sa table, ramasseurs de
// balles, photographes derrière les buts, stadiers face au public, et les deux commentateurs du
// plateau (plateau.js). Mêmes corps articulés que les joueurs (people.js : géométries et matière
// partagées), un jeu de maillages instanciés à part ; les poses (debout, assis, à genou, course
// lente) et les gestes des bras sont calculés ici. Seules les personnes animées sont recalculées.
//
// Une personne : { x, y, z, h (cap : 0 = regarde vers +z), pose, bras, couleurs, anim } ; voir STAFF_KINDS.
// ----------------------------------------------------------------------------------

export const STAFF = { parts: {}, acc: {}, list: /** @type {any[]} */ ([]), n: 0, built: false };

const SKINS = [0xe0b090, 0xc99a7a, 0xa8714f, 0x8a5a3c, 0x5e3b26, 0xf0c8a8];
const HAIRS = [0x1a1410, 0x241a12, 0x3b2a1a, 0x5a4026, 0x0c0c0c, 0x8a8a8a, 0xb0b0b0];

/** tenues : veste, col, pantalon, chaussures */
const TENUES = {
  costume: { jacket: 0x16181c, collar: 0xf0f0f0, trousers: 0x16181c, shoes: 0x0c0c0c },
  surv0: { jacket: 0xc8102e, collar: 0xf5c400, trousers: 0x15171a, shoes: 0x111111 },
  surv1: { jacket: 0x1d3a8a, collar: 0xf2f4f6, trousers: 0x111a33, shoes: 0x111111 },
  staff0: { jacket: 0x15171a, collar: 0xc8102e, trousers: 0x15171a, shoes: 0x111111 },
  staff1: { jacket: 0x0f1a33, collar: 0xf2f4f6, trousers: 0x0f1a33, shoes: 0x111111 },
  medical: { jacket: 0xe8e8e8, collar: 0xc8102e, trousers: 0x15171a, shoes: 0xf2f2f2 },
  arbitre: { jacket: 0x1b1c20, collar: 0x3a3d44, trousers: 0x1b1c20, shoes: 0x111111 },
  chasuble0: { jacket: 0xd4ff3a, collar: 0xd4ff3a, trousers: 0xc8102e, shoes: 0x111111, shorts: true, socks: 0xf5c400 },
  chasuble1: { jacket: 0xff7a1a, collar: 0xff7a1a, trousers: 0x1d3a8a, shoes: 0xf2f2f2, shorts: true, socks: 0xf2f4f6 },
  ramasseur: { jacket: 0x2f7ff0, collar: 0xf2f2f2, trousers: 0x15171a, shoes: 0xf2f2f2 },
  photo: { jacket: 0xff8a1f, collar: 0x15171a, trousers: 0x2a2d31, shoes: 0x2a2010 },
  stadier: { jacket: 0xffd21a, collar: 0xff8a1f, trousers: 0x15171a, shoes: 0x111111 },
  commentateur: { jacket: 0x1d2433, collar: 0xe8eef8, trousers: 0x23262c, shoes: 0x111111 },
  consultant: { jacket: 0x3a2f2a, collar: 0xf2f0ea, trousers: 0x23262c, shoes: 0x2a2010 },
};

/** la liste du bord terrain (sans les commentateurs, ajoutés par le plateau) */
export function staffBordTerrain() {
  const r = mulberry32(404), L = [];
  const pick = (a) => a[Math.floor(r() * a.length)];
  const add = (o) => { L.push({ skin: pick(SKINS), hair: pick(HAIRS), y: 0, ...o }); };
  for (const b of BANCS) {
    const t = b.team, s = t === 0 ? -1 : 1;
    // entraîneur principal : il arpente la zone technique ; l'adjoint reste au bord de l'abri, bras croisés
    add({ kind: 'entraineur', tenue: t === 0 ? 'costume' : 'staff1', x: b.zone.x, z: b.zone.z, h: 0, pose: 'stand', bras: 'hanches', anim: 'coach', base: b.zone.x });
    add({ kind: 'adjoint', tenue: t === 0 ? 'staff0' : 'staff1', x: b.x - s * 3.6, z: -37.25, h: 0.2 * s, pose: 'stand', bras: 'croises' });
    // les douze sièges : 7 remplaçants (survêtement), 4 staff, 1 médecin
    b.seats.forEach((st, i) => {
      if (i === 5 || i === 9) return; // deux sièges libres
      const tenue = i < 7 ? (t === 0 ? 'surv0' : 'surv1') : i === 11 ? 'medical' : (t === 0 ? 'staff0' : 'staff1');
      add({ kind: i < 7 ? 'remplacant' : 'staff', tenue, x: st.x, z: st.z, y: 0, seat: st.y, h: 0, pose: 'sit', bras: r() < 0.3 ? 'croises' : 'cuisses', anim: 'regard' });
    });
    // trois remplaçants à l'échauffement le long de la touche, vers le poteau de corner
    for (let k = 0; k < 3; k++) add({ kind: 'echauffement', tenue: t === 0 ? 'chasuble0' : 'chasuble1', x: s * (34 + k * 2.4), z: -35.4 - k * 0.5, h: Math.PI / 2, pose: 'jog', bras: 'cote', anim: 'jog', x0: s * 30, x1: s * 46, ph: k * 1.3 });
  }
  // 4e arbitre, debout derrière sa table
  add({ kind: 'arbitre4', tenue: 'arbitre', x: TABLE4.x + 0.2, z: TABLE4.z - 0.65, h: 0, pose: 'stand', bras: 'cote', anim: 'regard' });
  // ramasseurs de balles (debout), photographes (à genou ou sur tabouret), stadiers face au public
  for (const [x, z, h] of [[-26, 37.3, Math.PI], [26, 37.3, Math.PI], [-46, 37.3, Math.PI], [46, 37.3, Math.PI], [-30, -37.3, 0], [30, -37.3, 0], [-57.4, 28, Math.PI / 2], [57.4, -28, -Math.PI / 2]]) add({ kind: 'ramasseur', tenue: 'ramasseur', x, z, h, pose: 'stand', bras: 'dos', anim: 'regard' });
  for (const p of PHOTOGRAPHES) add({ kind: 'photographe', tenue: 'photo', x: p.x, z: p.z, h: p.h, pose: p.assis ? 'sit' : 'kneel', seat: 0.4, bras: 'camera', acc: 'appareil' });
  for (const [x, z, h] of [[-16, 39.5, 0], [16, 39.5, 0], [-40, 39.5, 0], [40, 39.5, 0], [-20, -39.9, Math.PI], [24, -39.9, Math.PI], [59.6, 20, -Math.PI / 2], [-59.6, -20, Math.PI / 2], [59.6, -12, -Math.PI / 2], [-59.6, 12, Math.PI / 2]]) add({ kind: 'stadier', tenue: 'stadier', x, z, h, pose: 'stand', bras: 'dos' });
  return L;
}

// ------------------------------- poses -------------------------------
const _root = new THREE.Matrix4(), _pel = new THREE.Matrix4(), _sp = new THREE.Matrix4(), _j = new THREE.Matrix4(), _j2 = new THREE.Matrix4(), _j3 = new THREE.Matrix4(), _t = new THREE.Matrix4(), _r = new THREE.Matrix4(), _hd = new THREE.Matrix4();
const T = (x, y, z) => _t.makeTranslation(x, y, z);
const RX = (a) => _r.makeRotationX(a), RY = (a) => _r.makeRotationY(a), RZ = (a) => _r.makeRotationZ(a);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/** bras : [rotation X de l'épaule, Z de l'épaule (vers l'extérieur), Z du coude (vers l'intérieur), flexion du coude] par côté (g, d) */
function armPose(mode, sg, t, p) {
  switch (mode) {
    case 'croises': return [-0.28, 0.16, -sg * 1.15, 1.45];
    case 'hanches': return [0.12, 0.62, -sg * 1.45, 0.25];
    case 'dos': return [0.32, 0.12, sg * 0.55, 1.0];
    case 'cuisses': return [-0.42, 0.1, 0, 0.95];
    case 'pupitre': return [-0.55, 0.12, -sg * 0.2, 1.05];
    case 'camera': return [-1.05, sg > 0 ? -0.05 : 0.25, -sg * 0.35, 1.55];
    case 'consigne': return sg > 0 ? [-1.35 - Math.sin(t * 3 + p) * 0.12, 0.25, 0, 0.25] : [0.12, 0.62, -sg * 1.45, 0.25];
    case 'geste': return sg > 0 ? [-0.75 + Math.sin(t * 2.3 + p) * 0.25, 0.2, -sg * 0.5, 1.3 + Math.sin(t * 3.1 + p) * 0.2] : [-0.55, 0.12, -sg * 0.2, 1.05];
    default: return [0.04, 0.1, 0, 0.18];
  }
}

/** calcule les matrices de la personne i (à l'instant t) */
function pose(i, s, t) {
  const P = STAFF.parts;
  let x = s.x, z = s.z, h = s.h, phase = 0, speed = 0, bras = s.bras;
  if (s.anim === 'coach') {
    // il fait les cent pas (± 1,6 m) puis s'arrête pour donner une consigne
    const c = (t + s.base * 3) % 14;
    if (c < 6) { const u = c / 6; x = s.base + Math.sin(u * Math.PI * 2) * 1.6; speed = Math.abs(Math.cos(u * Math.PI * 2)) * 1.6 * Math.PI * 2 / 6; h = Math.cos(u * Math.PI * 2) > 0 ? Math.PI / 2 : -Math.PI / 2; phase = t * 6.5; bras = 'cote'; }
    else { x = s.base; h = wrap(Math.atan2(PEOPLE.ball.x - x, PEOPLE.ball.z - z)); bras = c < 10 ? 'consigne' : 'hanches'; }
  } else if (s.anim === 'jog') {
    const span = Math.abs(s.x1 - s.x0), v = 2.2, c = ((t * v + s.ph * 4) % (2 * span));
    const fwd = c < span; x = s.x0 + Math.sign(s.x1 - s.x0) * (fwd ? c : 2 * span - c);
    h = (fwd === (s.x1 > s.x0)) ? Math.PI / 2 : -Math.PI / 2; speed = v; phase = t * 8 + s.ph;
  }
  s.cx = x; s.cz = z; s.ch = h;
  const sit = s.pose === 'sit', kneel = s.pose === 'kneel';
  const walk = Math.min(1, speed / 1.5), sf = Math.min(1, speed / 7);
  const breath = Math.sin(t * 1.6 + i) * 0.01;
  const pelY = sit ? (s.seat ?? 0.46) + 0.115 : kneel ? 0.56 : 0.975 + Math.abs(Math.sin(phase)) * 0.03 * walk - 0.02 * sf;
  _root.makeRotationY(h).setPosition(x, s.y, z);
  const lean = sit ? -0.12 : kneel ? 0.18 : 0.03 + 0.15 * sf;
  _pel.copy(_root).multiply(T(0, pelY, 0)).multiply(RX(lean * 0.3));
  P.pelvis.setMatrixAt(i, _pel);
  _sp.copy(_pel).multiply(T(0, 0.1, 0)).multiply(RX(lean * 0.7 + breath));
  P.torso.setMatrixAt(i, _sp);
  // tête : vers le ballon pour ceux qui suivent le jeu, sinon droit devant
  let ly = 0, lp = sit ? 0.08 : 0;
  if (s.anim === 'regard' || s.anim === 'coach') { ly = wrap(Math.atan2(PEOPLE.ball.x - x, PEOPLE.ball.z - z) - h); ly = Math.max(-1.0, Math.min(1.0, ly)); }
  if (s.anim === 'parole') { ly = Math.sin(t * 0.7 + i) * 0.35; lp = 0.1 + Math.sin(t * 1.3 + i) * 0.05; }
  _hd.copy(_sp).multiply(T(0, 0.5, 0.005)).multiply(RY(ly)).multiply(RX(lp - lean * 0.6));
  P.head.setMatrixAt(i, _hd);
  for (let k = 0; k < 2; k++) {
    const sg = k ? 1 : -1, ph = phase + k * Math.PI, id = i * 2 + k;
    let thigh, knee, ankle;
    if (sit) { thigh = 1.48 + (k ? 0.04 : -0.02); knee = 1.5; ankle = -0.05; }
    else if (kneel) { thigh = k ? -0.05 : 1.45; knee = k ? 1.6 : 1.5; ankle = k ? 0.7 : -0.05; }
    else { const amp = 0.12 + 0.55 * sf; thigh = Math.sin(ph) * amp * walk; knee = 0.05 + (0.25 + 1.25 * sf) * Math.pow(Math.max(0, Math.cos(ph - 0.35)), 1.6) * walk; ankle = -0.2 * sf * Math.max(0, Math.cos(ph)) * walk; }
    _j.copy(_pel).multiply(T(sg * 0.095, -0.03, 0)).multiply(RX(-thigh - lean * 0.2)).multiply(RZ(sg * (sit ? 0.08 : 0.035)));
    P.thigh.setMatrixAt(id, _j);
    _j2.copy(_j).multiply(T(0, -0.44, 0)).multiply(RX(knee));
    P.shin.setMatrixAt(id, _j2);
    _j3.copy(_j2).multiply(T(0, -0.43, 0)).multiply(RX(ankle - (sit || kneel ? 0 : knee * 0.25) + (sit ? -thigh + knee : kneel && !k ? -thigh + knee : thigh * 0.35)));
    P.boot.setMatrixAt(id, _j3);
    // bras
    _j.copy(_sp).multiply(T(sg * 0.2, 0.43, 0));
    let ax, az, ez, flex;
    if (speed > 0.3 && bras === 'cote') { const arm = -Math.sin(ph) * (0.15 + 0.55 * sf) * walk; ax = -arm + 0.05; az = 0.1 + 0.08 * sf; ez = 0; flex = 0.25 + 1.15 * sf * walk + Math.max(0, arm) * 0.4; }
    else [ax, az, ez, flex] = armPose(bras, sg, t, i);
    _j.multiply(RX(ax)).multiply(RZ(sg * az));
    P.upperArm.setMatrixAt(id, _j);
    _j2.copy(_j).multiply(T(0, -0.29, 0)).multiply(RZ(ez)).multiply(RX(-flex));
    P.forearm.setMatrixAt(id, _j2);
    _j3.copy(_j2).multiply(T(0, -0.25, 0)).multiply(RX(-0.1)).multiply(RY(sg * 0.3));
    P.hand.setMatrixAt(id, _j3);
  }
  // accessoires portés à la tête : casque des commentateurs, appareil photo devant l'œil
  if (s.accIdx != null) {
    const A = STAFF.acc[s.acc];
    if (A) A.setMatrixAt(s.accIdx, _j.copy(_hd));
  }
}

// ------------------------------- géométries des accessoires (repère de la tête) -------------------------------
function accGeometry(kind) {
  const parts = [];
  const add = (g, x, y, z, rx = 0, ry = 0, rz = 0) => { g.rotateX(rx); g.rotateY(ry); g.rotateZ(rz); g.translate(x, y, z); parts.push(g.index ? g.toNonIndexed() : g); };
  if (kind === 'casque') {
    add(new THREE.TorusGeometry(0.097, 0.011, 6, 20, Math.PI), 0, 0.175, 0);
    for (const s of [-1, 1]) add(new THREE.CylinderGeometry(0.042, 0.042, 0.03, 16), s * 0.093, 0.165, 0, 0, 0, Math.PI / 2);
    add(new THREE.CylinderGeometry(0.0045, 0.0045, 0.15, 6), -0.07, 0.115, 0.07, 1.1, 0, -0.4);
    add(new THREE.SphereGeometry(0.014, 8, 6), -0.035, 0.09, 0.125);
  } else {
    // boîtier reflex et téléobjectif (400 mm) : l'objectif part vers l'avant, devant l'œil droit
    add(new THREE.BoxGeometry(0.15, 0.11, 0.09), 0.03, 0.16, 0.14);
    add(new THREE.CylinderGeometry(0.055, 0.045, 0.34, 14), 0.03, 0.15, 0.36, Math.PI / 2);
    add(new THREE.CylinderGeometry(0.062, 0.062, 0.06, 14), 0.03, 0.15, 0.52, Math.PI / 2);
  }
  const g = new THREE.BufferGeometry();
  const tot = parts.reduce((n, p) => n + p.attributes.position.count, 0);
  const pos = new Float32Array(tot * 3), nor = new Float32Array(tot * 3); let o = 0;
  for (const p of parts) { if (!p.attributes.normal) p.computeVertexNormals(); pos.set(p.attributes.position.array, o * 3); nor.set(p.attributes.normal.array, o * 3); o += p.attributes.position.count; }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return g;
}

/**
 * Construit les maillages instanciés du staff et pose tout le monde une première fois.
 * @param {THREE.Scene} scene @param {any[]} list
 */
export function buildStaff(scene, list) {
  const G = personGeometries();
  const n = list.length; STAFF.n = n; STAFF.list = list;
  for (const [name, geo, per, rough] of PARTS) {
    const g = G[geo].clone();
    const cnt = n * per;
    g.setAttribute('aCol2', new THREE.InstancedBufferAttribute(new Float32Array(cnt * 3), 3));
    if (name === 'torso') g.setAttribute('aNum', new THREE.InstancedBufferAttribute(new Float32Array(cnt * 4).fill(-1), 4));
    const mesh = new THREE.InstancedMesh(g, kitMaterial(name, { rough: rough + 0.05, tNum: PEOPLE.atlas }), cnt);
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false; mesh.name = 'staff-' + name;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(mesh); STAFF.parts[name] = mesh;
  }
  const col = new THREE.Color();
  const set = (part, i, a, b) => { const m = STAFF.parts[part]; m.setColorAt(i, col.setHex(a)); col.setHex(b ?? a); m.geometry.attributes.aCol2.setXYZ(i, col.r, col.g, col.b); };
  list.forEach((s, i) => {
    const te = TENUES[s.tenue] || TENUES.staff0;
    const skin = s.skin, hair = s.hair;
    set('torso', i, te.jacket, te.collar); set('pelvis', i, te.trousers, te.trousers); set('head', i, skin, hair);
    for (let k = 0; k < 2; k++) {
      const id = i * 2 + k;
      if (te.shorts) { set('thigh', id, te.trousers, skin); set('shin', id, te.socks, te.socks); }
      else { set('thigh', id, te.trousers, te.trousers); set('shin', id, te.trousers, te.trousers); }
      set('boot', id, te.shoes, te.shoes === 0xf2f2f2 ? 0x222222 : 0xe8e8e8);
      set('upperArm', id, te.jacket, te.jacket); set('forearm', id, te.jacket, te.jacket); set('hand', id, skin, skin);
    }
  });
  for (const m of Object.values(STAFF.parts)) { if (m.instanceColor) m.instanceColor.needsUpdate = true; m.geometry.attributes.aCol2.needsUpdate = true; }
  // accessoires : casques (commentateurs) et appareils photo
  for (const [acc, color, rough, metal] of [['casque', 0x111214, 0.5, 0.2], ['appareil', 0x141516, 0.4, 0.3]]) {
    const who = list.filter((s) => s.acc === acc);
    if (!who.length) continue;
    const mesh = new THREE.InstancedMesh(accGeometry(acc), new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal }), who.length);
    who.forEach((s, k) => { s.accIdx = k; });
    mesh.castShadow = true; mesh.frustumCulled = false; mesh.name = 'staff-' + acc; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(mesh); STAFF.acc[acc] = mesh;
  }
  list.forEach((s, i) => pose(i, s, 0));
  flush();
  STAFF.built = true;
}
function flush() {
  for (const m of Object.values(STAFF.parts)) m.instanceMatrix.needsUpdate = true;
  for (const m of Object.values(STAFF.acc)) m.instanceMatrix.needsUpdate = true;
}
/** anime les personnes qui bougent (entraîneurs, échauffement, regards, commentateurs) : une image sur deux */
let frame = 0;
export function updateStaff(t) {
  if (!STAFF.built || (frame++ & 1)) return;
  STAFF.list.forEach((s, i) => { if (s.anim) pose(i, s, t); });
  flush();
}

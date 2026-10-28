// @ts-check
import * as THREE from 'three';
import { personGeometries, kitMaterial, mergeIndexed } from '../people.js';

// ----------------------------------------------------------------------------------
// Une troupe de figurants : techniciens, équipe du car, agents de sécurité. Mêmes corps que les joueurs
// (people.js : un mesh instancié par membre, deux couleurs par instance), dans une scène donnée (le stade ou
// l'intérieur du car). Chacun a sa tenue (maillot, col, pantalon, peau, cheveux, chaussures) et un casque d'ordres
// s'il travaille au car. Les poses sont procédurales : marche, assis au pupitre (mains au travail, regard qui
// va des écrans au bureau), debout bras croisés, la main à la radio, le bras tendu vers le mur d'écrans.
// ----------------------------------------------------------------------------------
const PARTS = /** @type {Array<[string, string, number, number]>} */ ([
  ['torso', 'torso', 1, 0.82], ['pelvis', 'pelvis', 1, 0.85], ['head', 'head', 1, 0.6],
  ['thigh', 'thigh', 2, 0.85], ['shin', 'shin', 2, 0.85], ['boot', 'boot', 2, 0.5],
  ['upperArm', 'upperArm', 2, 0.8], ['forearm', 'forearm', 2, 0.75], ['hand', 'hand', 2, 0.65],
]);
// le casque d'ordres : arceau, deux écouteurs, micro (une seule géométrie, posée sur la tête)
let CASQUE = null;
function casqueGeo() {
  if (CASQUE) return CASQUE;
  const mk = (g) => { const n = g.index ? g : g.toNonIndexed(); n.setAttribute('aMask', new THREE.Float32BufferAttribute(new Float32Array(n.attributes.position.count), 1)); if (!n.index) { const ix = []; for (let i = 0; i < n.attributes.position.count; i++) ix.push(i); n.setIndex(ix); } return n; };
  const band = new THREE.TorusGeometry(0.094, 0.009, 6, 20, Math.PI); band.translate(0, 0.18, 0);
  const cups = [-1, 1].map((s) => { const c = new THREE.CylinderGeometry(0.038, 0.038, 0.026, 12); c.rotateZ(Math.PI / 2); c.translate(s * 0.092, 0.165, 0); return c; });
  const boom = new THREE.CylinderGeometry(0.004, 0.004, 0.13, 5); boom.rotateZ(-0.35); boom.rotateX(1.2); boom.translate(-0.075, 0.115, 0.055); // comme l'Euler (1,2 ; 0 ; −0,35) des avatars
  CASQUE = mergeIndexed([band, ...cups, boom].map(mk));
  return CASQUE;
}

/**
 * @typedef {object} Tenue
 * @property {number} haut maillot, polo ou gilet @property {number} [col] col (et dos du gilet) @property {number} [manches]
 * @property {number} bas pantalon @property {number} peau @property {number} cheveux @property {number} [chaussures]
 * @property {boolean} [casque] casque d'ordres @property {boolean} [manchesLongues]
 */
/**
 * @typedef {object} Pose
 * @property {number} x @property {number} y sol (ou plancher) sous le figurant @property {number} z @property {number} yaw
 * @property {number} [assis] 0 debout, 1 assis (hauteur d'assise 0,52 m au-dessus de y)
 * @property {number} [vitesse] m/s @property {number} [phase] cycle de marche (radians)
 * @property {number} [teteYaw] @property {number} [tetePitch] regard, relatif au corps
 * @property {number} [penche] buste penché en avant (radians)
 * @property {'marche' | 'bureau' | 'console' | 'pointe' | 'croise' | 'radio' | 'ballants'} [bras]
 * @property {number} [t] horloge (petits mouvements)
 */

const _r = new THREE.Matrix4(), _p = new THREE.Matrix4(), _s = new THREE.Matrix4(), _j = new THREE.Matrix4(), _j2 = new THREE.Matrix4(), _j3 = new THREE.Matrix4(), _t = new THREE.Matrix4(), _q = new THREE.Matrix4();
const T = (x, y, z) => _t.makeTranslation(x, y, z);
const RX = (a) => _q.makeRotationX(a), RY = (a) => _q.makeRotationY(a), RZ = (a) => _q.makeRotationZ(a);
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const DUMMY = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1); DUMMY.needsUpdate = true;

export class Troupe {
  /** @param {THREE.Scene} scene @param {number} n nombre de places @param {string} nom */
  constructor(scene, n, nom) {
    const G = personGeometries();
    this.n = n; this.parts = {}; this.visible = new Array(n).fill(false);
    const col = new THREE.Color(0xffffff);
    for (const [name, geo, per, rough] of PARTS) {
      const g = G[geo].clone();
      g.setAttribute('aCol2', new THREE.InstancedBufferAttribute(new Float32Array(n * per * 3), 3));
      if (name === 'torso') g.setAttribute('aNum', new THREE.InstancedBufferAttribute(new Float32Array(n * 4).fill(-1), 4));
      const m = new THREE.InstancedMesh(g, kitMaterial(name, { rough, tNum: DUMMY }), n * per);
      m.name = `${nom}-${name}`; m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      for (let i = 0; i < n * per; i++) { m.setMatrixAt(i, ZERO); m.setColorAt(i, col); }
      scene.add(m); this.parts[name] = m;
    }
    const cg = casqueGeo().clone();
    cg.setAttribute('aCol2', new THREE.InstancedBufferAttribute(new Float32Array(n * 3).fill(0.08), 3));
    const cm = new THREE.InstancedMesh(cg, kitMaterial('casque', { rough: 0.45 }), n);
    cm.name = `${nom}-casque`; cm.castShadow = true; cm.frustumCulled = false; cm.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < n; i++) { cm.setMatrixAt(i, ZERO); cm.setColorAt(i, col.setHex(0x111214)); }
    scene.add(cm); this.parts.casque = cm;
    this.casques = new Array(n).fill(false);
  }
  /** @param {number} i @param {Tenue} t */
  habiller(i, t) {
    const col = new THREE.Color();
    const set = (part, k, a, b) => { const m = this.parts[part]; m.setColorAt(k, col.setHex(a)); col.setHex(b ?? a); m.geometry.attributes.aCol2.setXYZ(k, col.r, col.g, col.b); };
    const manches = t.manches ?? t.haut, ch = t.chaussures ?? 0x16171a;
    set('torso', i, t.haut, t.col ?? t.haut); set('pelvis', i, t.bas); set('head', i, t.peau, t.cheveux);
    for (let s = 0; s < 2; s++) {
      const k = i * 2 + s;
      set('thigh', k, t.bas, t.bas); set('shin', k, t.bas, t.bas); set('boot', k, ch, 0x2c2c2c);
      set('upperArm', k, manches, t.manchesLongues ? manches : t.peau); set('forearm', k, t.manchesLongues ? manches : t.peau, t.manchesLongues ? manches : t.peau);
      set('hand', k, t.peau, t.peau);
    }
    this.casques[i] = !!t.casque;
    for (const m of Object.values(this.parts)) { if (m.instanceColor) m.instanceColor.needsUpdate = true; m.geometry.attributes.aCol2.needsUpdate = true; }
  }
  /** retire un figurant de la scène (place libre, ou il est dans l'autre scène) */
  cacher(i) {
    if (!this.visible[i]) return;
    this.visible[i] = false;
    for (const [name, , per] of PARTS) for (let s = 0; s < per; s++) this.parts[name].setMatrixAt(i * per + s, ZERO);
    this.parts.casque.setMatrixAt(i, ZERO);
  }
  /** @param {number} i @param {Pose} P */
  poser(i, P) {
    this.visible[i] = true;
    const Pp = this.parts;
    const sit = P.assis || 0, v = P.vitesse || 0, ph = P.phase || 0, t = P.t || 0;
    const walk = Math.min(1, v / 1.4) * (1 - sit), sf = Math.min(1, v / 6);
    const bob = Math.abs(Math.sin(ph)) * 0.02 * walk;
    const breath = Math.sin(t * 1.7 + i) * 0.01;
    // racine, bassin (assis : sur l'assise, un peu en arrière), buste, tête
    _r.makeRotationY(P.yaw).setPosition(P.x, P.y, P.z);
    _p.copy(_r).multiply(T(0, 0.975 * (1 - sit) + 0.62 * sit + bob, -0.06 * sit));
    Pp.pelvis.setMatrixAt(i, _p);
    _s.copy(_p).multiply(T(0, 0.1, 0)).multiply(RX(0.04 + 0.12 * sf + 0.05 * sit + (P.penche || 0) + breath));
    Pp.torso.setMatrixAt(i, _s);
    _j.copy(_s).multiply(T(0, 0.5, 0.005)).multiply(RY(P.teteYaw || 0)).multiply(RX(P.tetePitch || 0));
    Pp.head.setMatrixAt(i, _j);
    Pp.casque.setMatrixAt(i, this.casques[i] ? _j : ZERO);
    // jambes : foulée, ou cuisses à l'horizontale et jambes pendantes
    for (let s = 0; s < 2; s++) {
      const sg = s ? 1 : -1, k = i * 2 + s, p = ph + (s ? Math.PI : 0);
      const th = Math.sin(p) * (0.1 + 0.45 * sf) * walk;
      const knee = 0.05 + (0.2 + 1.0 * sf) * Math.pow(Math.max(0, Math.cos(p - 0.35)), 1.6) * walk;
      _j.copy(_p).multiply(T(sg * 0.095, -0.03, 0)).multiply(RX(-(th * (1 - sit) + 1.45 * sit))).multiply(RZ(sg * (0.03 + 0.06 * sit)));
      Pp.thigh.setMatrixAt(k, _j);
      _j2.copy(_j).multiply(T(0, -0.44, 0)).multiply(RX(knee * (1 - sit) + 1.5 * sit));
      Pp.shin.setMatrixAt(k, _j2);
      _j3.copy(_j2).multiply(T(0, -0.43, 0)).multiply(RX(-0.1 * sit));
      Pp.boot.setMatrixAt(k, _j3);
    }
    // bras
    const bras = P.bras || (v > 0.15 ? 'marche' : 'ballants');
    for (let s = 0; s < 2; s++) {
      const sg = s ? 1 : -1, k = i * 2 + s, p = ph + (s ? 0 : Math.PI);
      let ux, fx, uz = sg * 0.08, uy = 0;
      if (bras === 'marche') { const sw = Math.sin(p) * (0.12 + 0.45 * sf) * walk; ux = -sw; fx = -(0.2 + 0.9 * sf * walk); }
      else if (bras === 'bureau' || bras === 'console') {
        // avant-bras posés sur le pupitre ; les mains travaillent (clavier, faders)
        const w = bras === 'console' ? Math.sin(t * 2.3 + s * 1.7 + i) * 0.08 : Math.sin(t * 6 + s * 2 + i) * 0.03;
        ux = -0.45 - w; fx = -1.0 + w * 0.5; uz = sg * 0.12;
      } else if (bras === 'pointe' && s === 1) { ux = -1.35 + Math.sin(t * 2) * 0.05; fx = -0.15; uz = 0.05; }
      else if (bras === 'pointe') { ux = -0.45; fx = -1.0; uz = sg * 0.12; }
      else if (bras === 'croise') { ux = -0.25; uz = sg * 0.05; fx = -1.75; uy = -sg * 0.45; }
      else if (bras === 'radio' && s === 0) { ux = -0.35; uz = -0.35; fx = -2.1; uy = 0.4; }
      else { ux = Math.sin(t * 0.9 + s + i) * 0.03; fx = -0.15; }
      _j.copy(_s).multiply(T(sg * 0.2, 0.43, 0)).multiply(RX(ux)).multiply(RZ(uz)).multiply(RY(uy));
      Pp.upperArm.setMatrixAt(k, _j);
      _j2.copy(_j).multiply(T(0, -0.29, 0)).multiply(RX(fx));
      Pp.forearm.setMatrixAt(k, _j2);
      _j3.copy(_j2).multiply(T(0, -0.25, 0)).multiply(RX(-0.1));
      Pp.hand.setMatrixAt(k, _j3);
    }
  }
  /** envoie les poses de l'image à la carte graphique */
  publier() { for (const m of Object.values(this.parts)) m.instanceMatrix.needsUpdate = true; }
}

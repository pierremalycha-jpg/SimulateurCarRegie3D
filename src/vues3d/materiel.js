// @ts-check
import * as THREE from 'three';
import { piece, texte, eclat, mat, cableEntre, inverse, COUL } from './kit.js';

// ----------------------------------------------------------------------------------
// Le matériel des vues 3D du réseau, du ST 2110 et de la synchro : des silhouettes reconnaissables
// (CCU, RCP, PC, caméra, mélangeur, multiview, serveur, intercom, portable, SPG, passerelle,
// commutateur, routeur), chacune une pièce (Builder en mode ao, arêtes arrondies) posée sur un socle,
// avec son nom sérigraphié et son point de raccordement (userData.port, dans son repère). Puis le
// réseau : des câbles entre ports, et des trames qui les parcourent (un flux instancié pour tout).
// ----------------------------------------------------------------------------------
const DARK = 0x262c33, PANEL = 0x30373f, BLACK = 0x15191d, ALU = 0xb8bec4;

/**
 * Un appareil posé au sol, face à +z.
 * @param {string} type ccu | rcp | pc | camera | melangeur | multiview | serveur | intercom | portable | spg | passerelle | moniteur | micro
 * @param {string} nom
 * @param {{ info?: any, couleur?: number }} [o]
 */
export function appareil(type, nom, o = {}) {
  const g = new THREE.Group(); g.name = nom;
  const C = o.couleur ?? DARK;
  let port = new THREE.Vector3(0, 0.1, -0.2), top = 0.9;
  const socle = (b, h = 0.55) => { b.cbox(0.5, h, 0.42, 0, h / 2, 0, 0x1d2227, 0.02); };
  if (type === 'ccu' || type === 'serveur' || type === 'spg' || type === 'passerelle') {
    g.add(piece(nom, 'plastique', (b) => {
      socle(b);
      const h = type === 'serveur' ? 0.36 : 0.18;
      b.cbox(0.48, h, 0.4, 0, 0.55 + h / 2, 0, type === 'spg' ? 0x34302a : type === 'passerelle' ? 0x2c3440 : C, 0.015);
      if (type === 'serveur') for (let i = 0; i < 4; i++) b.cbox(0.4, 0.05, 0.01, 0, 0.6 + i * 0.075, 0.205, 0x3d454e, 0.005);
      if (type === 'spg') { b.cyl(0.006, 0.006, 0.3, 0.15, 0.88, -0.1, ALU, 8); b.cyl(0.05, 0.03, 0.05, 0.15, 1.05, -0.1, 0xe8ece6, 16); }
    }));
    const lcd = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.05), eclat(type === 'passerelle' ? COUL.cyan : 0x7bf29a, 0.9)); lcd.position.set(-0.1, 0.64, 0.202); g.add(lcd);
    top = type === 'serveur' ? 1.0 : type === 'spg' ? 1.15 : 0.82;
    port = new THREE.Vector3(0, 0.62, -0.21);
  } else if (type === 'rcp') {
    g.add(piece(nom, 'plastique', (b) => { socle(b, 0.7); b.cbox(0.22, 0.06, 0.36, 0, 0.73, 0, PANEL, 0.015, 0, -0.18); b.cyl(0.008, 0.008, 0.09, 0.04, 0.8, 0.06, ALU, 8); b.sphere(0.025, 0.04, 0.85, 0.06, 0x1a1a1a, 12); }));
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.06), eclat(0x9fd4ff, 0.85)); s.position.set(-0.03, 0.765, -0.09); s.rotation.x = -Math.PI / 2 - 0.18; g.add(s);
    top = 0.95; port = new THREE.Vector3(0, 0.6, -0.21);
  } else if (type === 'pc' || type === 'moniteur' || type === 'multiview') {
    const w = type === 'multiview' ? 0.7 : 0.48, h = type === 'multiview' ? 0.42 : 0.3;
    g.add(piece(nom, 'plastique', (b) => { socle(b, 0.7); b.cbox(0.06, 0.22, 0.06, 0, 0.81, -0.08, BLACK, 0.01); b.cbox(w, h, 0.04, 0, 0.92 + h / 2, -0.06, BLACK, 0.012); if (type === 'pc') b.cbox(0.36, 0.02, 0.12, 0, 0.71, 0.1, 0x2a3036, 0.006); }));
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.04, h - 0.04), eclat(type === 'multiview' ? 0x2a4a3a : 0x1f3448, 1)); scr.position.set(0, 0.92 + h / 2, -0.038); g.add(scr);
    if (type === 'multiview') for (let i = 0; i < 4; i++) { const t = new THREE.Mesh(new THREE.PlaneGeometry((w - 0.06) / 2 - 0.01, (h - 0.06) / 2 - 0.01), eclat([0x3d7a4a, 0x4a6aa0, 0x7a5a3a, 0x5a4a7a][i], 1)); t.position.set((i % 2 ? 1 : -1) * (w - 0.06) / 4, 0.92 + h / 2 + (i < 2 ? 1 : -1) * (h - 0.06) / 4, -0.036); g.add(t); }
    top = 0.98 + h; port = new THREE.Vector3(0, 0.62, -0.21);
  } else if (type === 'camera') {
    g.add(piece(nom, 'plastique', (b) => {
      for (const a of [0, 2.1, 4.2]) b.rod([0, 0.95, 0], [Math.sin(a) * 0.32, 0, Math.cos(a) * 0.32], 0.012, 0x2a2f35, 6);
      b.cbox(0.16, 0.06, 0.16, 0, 0.98, 0, 0x2a2f35, 0.01);
      b.cbox(0.2, 0.2, 0.32, 0, 1.12, -0.02, C === DARK ? 0x3a4048 : C, 0.02);
      b.cyl(0.06, 0.07, 0.24, 0, 1.12, 0.24, 0x15181b, 20, Math.PI / 2);
      b.cbox(0.12, 0.08, 0.1, -0.04, 1.27, -0.06, BLACK, 0.01);
    }));
    top = 1.4; port = new THREE.Vector3(0, 1.08, -0.2);
  } else if (type === 'melangeur' || type === 'intercom') {
    g.add(piece(nom, 'plastique', (b) => { socle(b, 0.7); b.cbox(type === 'melangeur' ? 0.7 : 0.4, 0.06, 0.36, 0, 0.73, 0, PANEL, 0.015, 0, -0.15); }));
    const n = type === 'melangeur' ? 8 : 4, keys = new THREE.InstancedMesh(new THREE.BoxGeometry(0.045, 0.02, 0.045), eclat(0xffffff), n * 2);
    const M = new THREE.Matrix4(), col = new THREE.Color();
    for (let i = 0; i < n * 2; i++) { const r = Math.floor(i / n), c = i % n; M.makeRotationX(-0.15).setPosition((c - (n - 1) / 2) * 0.07, 0.77 - r * 0.012, -0.02 + r * 0.08); keys.setMatrixAt(i, M); keys.setColorAt(i, col.set(type === 'intercom' ? 0x3fcf6e : r ? (c === 2 ? 0x3fcf6e : 0x5a6470) : (c === 1 ? 0xe0453a : 0x5a6470))); }
    g.add(keys);
    top = 0.95; port = new THREE.Vector3(0, 0.6, -0.21);
  } else if (type === 'portable') {
    g.add(piece(nom, 'plastique', (b) => { socle(b, 0.7); b.cbox(0.34, 0.02, 0.24, 0, 0.71, 0.04, 0x8a9096, 0.008); b.cbox(0.34, 0.22, 0.015, 0, 0.82, -0.08, 0x8a9096, 0.008, 0, -0.25); }));
    const sc = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.18), eclat(0x2c4f7a, 1)); sc.position.set(0, 0.825, -0.069); sc.rotation.x = -0.25; g.add(sc);
    top = 1.0; port = new THREE.Vector3(0, 0.6, -0.21);
  } else if (type === 'micro') {
    g.add(piece(nom, 'alu', (b) => { b.cyl(0.08, 0.1, 0.02, 0, 0.01, 0, 0x2a2f35, 16); b.cyl(0.008, 0.008, 1.2, 0, 0.61, 0, ALU, 8); b.cyl(0.025, 0.02, 0.16, 0, 1.25, 0.04, 0x1a1a1a, 14, 0.6); }));
    top = 1.42; port = new THREE.Vector3(0, 0.05, -0.05);
  }
  const t = texte(nom, { h: 0.1, bg: 'rgba(18,22,26,.86)' }); t.position.set(0, type === 'camera' ? 0.55 : 0.34, 0.22); g.add(t);
  g.userData.port = port; g.userData.top = top; g.userData.type = type;
  if (o.info) g.userData.info = o.info;
  return g;
}

/**
 * Un commutateur (ou un routeur) de baie, sur un pied : n ports en façade, leurs voyants.
 * @param {string} nom
 * @param {number} n ports
 * @param {{ routeur?: boolean, couleur?: number, info?: any, pied?: number }} [o]
 */
export function commutateur(nom, n, o = {}) {
  const g = new THREE.Group(); g.name = nom;
  const w = Math.max(0.9, 0.16 * n + 0.3), h = o.routeur ? 0.16 : 0.1, y = o.pied ?? 0.9;
  g.add(piece(nom, 'laque', (b) => {
    b.cbox(0.36, y - h / 2, 0.36, 0, (y - h / 2) / 2, -0.05, 0x1d2227, 0.02);
    b.cbox(w, h, 0.5, 0, y, 0, o.couleur ?? (o.routeur ? 0x2d3f55 : 0x2b3138), 0.012);
    for (let i = 0; i < n; i++) b.cbox(0.075, 0.055, 0.02, -w / 2 + 0.2 + i * 0.16, y - 0.005, 0.25, 0x0d1013, 0.004);
  }));
  const leds = new THREE.InstancedMesh(new THREE.BoxGeometry(0.022, 0.014, 0.006), eclat(0xffffff), n);
  const M = new THREE.Matrix4(), col = new THREE.Color(0x3fcf6e);
  for (let i = 0; i < n; i++) { M.makeTranslation(-w / 2 + 0.2 + i * 0.16 + 0.05, y + 0.035, 0.252); leds.setMatrixAt(i, M); leds.setColorAt(i, col); }
  g.add(leds);
  const t = texte(nom, { h: 0.06, color: '#e8ece6' }); t.position.set(-w / 2 + 0.1 + t.geometry.parameters.width / 2, y + 0.032, 0.252); g.add(t);
  g.userData.ports = Array.from({ length: n }, (_, i) => new THREE.Vector3(-w / 2 + 0.2 + i * 0.16, y - 0.005, 0.27));
  g.userData.leds = leds; g.userData.w = w; g.userData.y = y;
  /** colore le voyant du port i */
  g.userData.led = (i, c) => { leds.setColorAt(i, col.set(c)); if (leds.instanceColor) leds.instanceColor.needsUpdate = true; };
  if (o.info) g.userData.info = o.info;
  return g;
}
/** le point de raccordement d'un appareil (ou du port i d'un commutateur), dans le repère du monde */
export function prise(obj, i = -1) {
  obj.updateMatrixWorld(true);
  const p = i >= 0 ? obj.userData.ports[i] : obj.userData.port;
  return p.clone().applyMatrix4(obj.matrixWorld);
}

// ---------------- le réseau : câbles et trames ----------------
export class Reseau {
  /** @param {any} ctx contexte de la vue (ctx.flux) */
  constructor(ctx, root, max = 500) {
    this.root = root; this.links = [];
    this.flux = ctx.flux(max, new THREE.BoxGeometry(1, 1, 1), eclat(0xffffff));
  }
  /**
   * Un câble entre deux appareils : a et b sont { obj, i? } (i : port d'un commutateur).
   * @param {{ obj: THREE.Object3D, i?: number }} a
   * @param {{ obj: THREE.Object3D, i?: number }} b
   * @param {{ couleur?: number, r?: number, sag?: number, info?: any, nom?: string }} [o]
   */
  relie(a, b, o = {}) {
    const A = prise(a.obj, a.i ?? -1), B = prise(b.obj, b.i ?? -1);
    const da = new THREE.Vector3(0, 0, a.i != null && a.i >= 0 ? 1 : -1).applyQuaternion(a.obj.getWorldQuaternion(new THREE.Quaternion()));
    const db = new THREE.Vector3(0, 0, b.i != null && b.i >= 0 ? 1 : -1).applyQuaternion(b.obj.getWorldQuaternion(new THREE.Quaternion()));
    const m = cableEntre(A, B, o.r ?? 0.018, mat('plastique', o.couleur ?? 0x4a6a8a, { roughness: 0.5 }), o.sag ?? Math.min(A.y, B.y) * 0.9, { da, db, out: 0.15 });
    m.name = o.nom || 'câble';
    if (o.info) m.userData.info = o.info;
    this.root.add(m);
    const L = { a, b, curve: m.userData.curve, mesh: m, nom: o.nom || '' };
    this.links.push(L);
    return L;
  }
  /**
   * Une trame sur un câble, dans un sens (+1 : de a vers b), puis la suite.
   * @param {any} L lien
   * @param {number} sens
   * @param {{ couleur?: number, info?: any, vitesse?: number, taille?: number[], onEnd?: () => void, retard?: number }} [o]
   */
  trame(L, sens, o = {}) {
    return this.flux.add({ curve: sens > 0 ? L.curve : inverse(L.curve), speed: o.vitesse ?? 1.6, color: o.couleur ?? 0xffffff, scale: o.taille ?? [0.12, 0.075, 0.075], info: o.info, delay: o.retard ?? 0, onEnd: o.onEnd ? () => o.onEnd && o.onEnd() : undefined });
  }
  /** une trame qui enchaîne plusieurs câbles : chemin = [[lien, sens], …] */
  chemin(chemin, o = {}) {
    const [first, ...rest] = chemin; if (!first) { if (o.onEnd) o.onEnd(); return; }
    this.trame(first[0], first[1], { ...o, onEnd: () => { if (rest.length) this.chemin(rest, { ...o, retard: 0 }); else if (o.onEnd) o.onEnd(); } });
  }
  clear() { this.flux.clear(); }
}

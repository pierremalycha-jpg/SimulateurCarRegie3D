// @ts-check
import * as THREE from 'three';
import { CATALOGUE } from './catalogue/index.js';
import { ZONES } from './build.js';

// ----------------------------------------------------------------------------------
// La scène 3D de l'entrepôt : un hall, des rayonnages (le stock), une baie 19" mobile de 12 U,
// une table de régie, un coin plateau (pieds de caméra), le tableau électrique au mur. Les
// appareils sortis du stock y apparaissent à leur emplacement ; les câbles sont tracés entre les
// connecteurs. Le rédacteur « scène » écrit ce fichier (voir le brief). Ci-dessous : le squelette
// qui fait tourner le module (un sol, une baie et une table schématiques, des boîtes pour les
// appareils, des tubes pour les câbles), avec l'API que le reste du module attend.
//
// API :
//   buildHall(renderer, quality) → H
//   H.scene, H.update(dt) (animations), H.sync(B, E) (reconstruit appareils et câbles d'après le
//   montage et le résultat du moteur), H.anchor(uid) → position 3D de l'appareil (pastille),
//   H.portAnchor(uid, port) → position 3D du connecteur, H.pick(raycaster) → uid ou null,
//   H.lookAt(zone) → { target, dir, dist } (un point de vue par zone), H.dispose().
// ----------------------------------------------------------------------------------
/** @typedef {import('./types.js').Build} Build */
/** @typedef {import('./types.js').Eval} Eval */

const U = 0.04445; // une unité de baie, en mètres
/** position d'un emplacement dans le hall (origine : coin de la table) */
export const ZONE_POS = {
  rack: { x: -1.6, y: 0, z: 0, nom: ZONES.rack.nom },
  table: { x: 0.2, y: 0.75, z: 0, nom: ZONES.table.nom },
  plateau: { x: 0, y: 0, z: -3.2, nom: ZONES.plateau.nom },
  mur: { x: -3.2, y: 1.2, z: -4.4, nom: ZONES.mur.nom },
};

/** @param {THREE.WebGLRenderer} renderer @param {string} quality */
export function buildHall(renderer, quality) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0e12);
  scene.fog = new THREE.Fog(0x0b0e12, 14, 30);
  const hemi = new THREE.HemisphereLight(0xdfe8f2, 0x2a2622, 0.8); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2dc, 1.4); sun.position.set(4, 7, 3); sun.castShadow = quality !== 'basse';
  sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = -8; sun.shadow.camera.right = 8; sun.shadow.camera.top = 8; sun.shadow.camera.bottom = -8; sun.shadow.camera.far = 30;
  scene.add(sun);
  const M = {
    sol: new THREE.MeshStandardMaterial({ color: 0x3b3f44, roughness: 0.95 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x2b2f33, roughness: 0.6, metalness: 0.4 }),
    bois: new THREE.MeshStandardMaterial({ color: 0x7a5b3a, roughness: 0.9 }),
    mur: new THREE.MeshStandardMaterial({ color: 0x6b7178, roughness: 0.95 }),
  };
  const mesh = (g, m, p = [0, 0, 0], parent = scene) => { const o = new THREE.Mesh(g, m); o.position.set(p[0], p[1], p[2]); o.castShadow = o.receiveShadow = true; parent.add(o); return o; };
  // le sol et le mur du fond
  mesh(new THREE.BoxGeometry(14, 0.02, 12), M.sol, [0, -0.01, -1]);
  mesh(new THREE.BoxGeometry(14, 4, 0.1), M.mur, [0, 2, -4.5]);
  // la baie 19" : un cadre de 12 U
  const rack = new THREE.Group(); rack.position.set(ZONE_POS.rack.x, 0, ZONE_POS.rack.z); scene.add(rack);
  const RH = 12 * U + 0.1;
  for (const x of [-0.27, 0.27]) mesh(new THREE.BoxGeometry(0.04, RH, 0.6), M.metal, [x, RH / 2 + 0.05, 0], rack);
  mesh(new THREE.BoxGeometry(0.58, 0.05, 0.6), M.metal, [0, 0.025, 0], rack);
  mesh(new THREE.BoxGeometry(0.58, 0.03, 0.6), M.metal, [0, RH + 0.05, 0], rack);
  // la table
  const table = new THREE.Group(); table.position.set(ZONE_POS.table.x, 0, ZONE_POS.table.z); scene.add(table);
  mesh(new THREE.BoxGeometry(2.4, 0.04, 0.8), M.bois, [1.0, 0.73, 0], table);
  for (const [x, z] of [[-0.1, -0.35], [2.1, -0.35], [-0.1, 0.35], [2.1, 0.35]]) mesh(new THREE.BoxGeometry(0.05, 0.71, 0.05), M.metal, [x, 0.355, z], table);
  // le plateau : quatre repères au sol
  for (let i = 0; i < ZONES.plateau.slots; i++) mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.01, 24), new THREE.MeshStandardMaterial({ color: 0x4b5560 }), [ZONE_POS.plateau.x - 1.5 + i * 1.0, 0.005, ZONE_POS.plateau.z]);

  const devs = new THREE.Group(); scene.add(devs);
  const cables = new THREE.Group(); scene.add(cables);
  /** @type {Map<string, THREE.Object3D>} */ const byUid = new Map();
  const pos = (/** @type {import('./types.js').Appareil} */ a, /** @type {import('./types.js').Modele} */ m) => {
    const z = ZONE_POS[a.place.zone];
    if (a.place.zone === 'rack') { const h = (m.u || 1) * U; return new THREE.Vector3(z.x, 0.05 + (a.place.slot - 1) * U + h / 2, z.z); }
    if (a.place.zone === 'table') { const s = a.place.slot - 1; return new THREE.Vector3(z.x + 0.1 + (s % 4) * 0.56, z.y + ((m.boite && m.boite.h) || 0.1) / 2, z.z - 0.2 + Math.floor(s / 4) * 0.4); }
    if (a.place.zone === 'plateau') return new THREE.Vector3(z.x - 1.5 + (a.place.slot - 1) * 1.0, 1.5, z.z);
    return new THREE.Vector3(z.x, z.y, z.z);
  };
  const H = {
    scene,
    update(dt) { /* rien n'est animé dans le squelette */ },
    /** @param {Build} B @param {Eval} E */
    sync(B, E) {
      devs.clear(); cables.clear(); byUid.clear();
      for (const a of B.appareils) {
        const m = CATALOGUE[a.modele]; if (!m) continue;
        const b = m.boite || { w: 0.3, h: 0.1, d: 0.25 };
        const on = E.power[a.uid] && E.power[a.uid].on;
        const box = mesh(new THREE.BoxGeometry(a.place.zone === 'rack' ? 0.483 : b.w, a.place.zone === 'rack' ? (m.u || 1) * U - 0.004 : b.h, b.d), new THREE.MeshStandardMaterial({ color: new THREE.Color(b.couleur || '#3a4048'), roughness: 0.7, emissive: on ? 0x113311 : 0x000000 }), [0, 0, 0], devs);
        box.position.copy(pos(a, m)); box.userData.uid = a.uid; byUid.set(a.uid, box);
        if (a.place.zone === 'plateau') mesh(new THREE.CylinderGeometry(0.02, 0.03, 1.45, 10), M.metal, [box.position.x, 0.72, box.position.z], devs);
      }
      for (const c of B.cables) {
        const pa = H.portAnchor(c.a.dev, c.a.port), pb = H.portAnchor(c.b.dev, c.b.port); if (!pa || !pb) continue;
        const ok = !E.cables[c.uid] || E.cables[c.uid].ok;
        const mid = pa.clone().add(pb).multiplyScalar(0.5); mid.y = Math.min(pa.y, pb.y) - 0.15;
        const curve = new THREE.CatmullRomCurve3([pa, mid, pb]);
        const col = ok ? ({ sdi: 0x46c6f2, hdmi: 0x8fd3ff, ip: 0x2fd25a, audio: 0xffd23f, aes: 0xe6c21a, ref: 0xc77dff, tc: 0xb388ff, rs422: 0xff9f43, rs232: 0xffb86b, gpio: 0xff7f50, tally: 0xff3b30, secteur: 0x9aa1a8, dc12: 0xc9ced3, usb: 0x7f8c8d, madi: 0xf1c40f, media: 0x95a5a6 })[c.sig] || 0x999999 : 0xff3b30;
        const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.006, 6, false), new THREE.MeshStandardMaterial({ color: col, roughness: 0.5 }));
        tube.userData.cable = c.uid; cables.add(tube);
      }
    },
    anchor(uid) { const o = byUid.get(uid); return o ? o.position.clone() : null; },
    portAnchor(uid, port) { const o = byUid.get(uid); if (!o) return null; const p = o.position.clone(); p.z += 0.15; return p; },
    /** @param {THREE.Raycaster} ray */
    pick(ray) { const hits = ray.intersectObjects(devs.children, false); return hits.length ? String(hits[0].object.userData.uid || '') || null : null; },
    lookAt(zone) {
      const z = ZONE_POS[zone] || ZONE_POS.table;
      if (zone === 'rack') return { target: new THREE.Vector3(z.x, 0.5, z.z), dir: new THREE.Vector3(0.6, 0.35, 1), dist: 2.2 };
      if (zone === 'plateau') return { target: new THREE.Vector3(z.x, 1.2, z.z), dir: new THREE.Vector3(0.2, 0.4, 1), dist: 5 };
      if (zone === 'mur') return { target: new THREE.Vector3(z.x, z.y, z.z), dir: new THREE.Vector3(0.5, 0.2, 1), dist: 1.6 };
      return { target: new THREE.Vector3(z.x + 1.0, 0.8, z.z), dir: new THREE.Vector3(0.3, 0.6, 1), dist: 3.2 };
    },
    dispose() { scene.traverse((o) => { const m = /** @type {any} */ (o); if (m.geometry) m.geometry.dispose(); if (m.material && m.material.dispose) m.material.dispose(); }); },
  };
  return H;
}

// @ts-check
import * as THREE from 'three';
import { CATALOGUE } from './catalogue/index.js';
import { ZONES } from './build.js';
import { makeBin, RACK, TABLE, STAGE, MUR, BUREAU, plateauSlot, tableSlot, rackSlot } from './scene/kit.js';
import { buildStatic } from './scene/hall.js';
import { buildBureau } from './scene/bureau.js';
import { makeDevices } from './scene/devices.js';
import { makeCables } from './scene/cables.js';

// ----------------------------------------------------------------------------------
// La scène 3D de l'entrepôt : un hall (sol en béton, rayonnages du stock, suspensions), une baie
// 19" mobile de 12 U, une table de régie, un plateau (estrade et huit emplacements de caméra en
// arc), le tableau électrique au mur (scene/hall.js), le bureau du planning et son ordinateur
// (scene/bureau.js, la messagerie de la Carrière). Les appareils sortis du stock y apparaissent
// à leur emplacement, avec leurs faces dessinées et leurs voyants (scene/devices.js) ; les câbles
// partent des vrais connecteurs et suivent un chemin de technicien (scene/cables.js).
//
// API (lue par index.js) :
//   buildHall(renderer, quality) → H
//   H.scene, H.update(dt) (animations), H.sync(B, E) (met la scène à jour d'après le montage et le
//   résultat du moteur : seuls les appareils et câbles qui ont changé sont reconstruits),
//   H.anchor(uid) → position 3D de la pastille, H.portAnchor(uid, port) → position 3D du
//   connecteur, H.pick(raycaster) → uid, PC_UID (l'ordinateur du bureau) ou null, H.lookAt(zone) →
//   { target, dir, dist } (un point de vue par zone, et le bureau), H.select(uid) (surligne
//   l'appareil choisi, '' pour aucun), H.pcAnchor() (la pastille de l'ordinateur), H.ecranPc(e)
//   (redessine son écran), H.dispose().
// ----------------------------------------------------------------------------------
/** @typedef {import('./types.js').Build} Build */
/** @typedef {import('./types.js').Eval} Eval */
/** @typedef {import('./types.js').Appareil} Appareil */

/** ce que H.pick renvoie quand on clique l'ordinateur du bureau */
export const PC_UID = '@pc';

/** position de chaque zone dans le hall */
export const ZONE_POS = {
  rack: { x: RACK.x, y: RACK.y0, z: RACK.z, nom: ZONES.rack.nom },
  table: { x: (TABLE.x0 + TABLE.x1) / 2, y: TABLE.top, z: (TABLE.z0 + TABLE.z1) / 2, nom: ZONES.table.nom },
  plateau: { x: STAGE.x, y: 0, z: STAGE.z + STAGE.r, nom: ZONES.plateau.nom },
  mur: { x: MUR.x, y: MUR.y, z: MUR.z, nom: ZONES.mur.nom },
};

/** @param {THREE.WebGLRenderer} renderer @param {string} quality */
export function buildHall(renderer, quality) {
  const scene = new THREE.Scene();
  const bin = makeBin();
  buildStatic(scene, bin, quality);
  const BU = buildBureau(scene, bin, quality);
  // carte d'environnement du hall (lanterneaux clairs, murs gris, sol sombre) : les métaux et les
  // façades des appareils reflètent quelque chose, comme dans le car
  if (quality !== 'basse') {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const sc = new THREE.Scene();
    sc.add(new THREE.Mesh(new THREE.BoxGeometry(15, 6, 11), new THREE.MeshBasicMaterial({ color: 0x4a4f55, side: THREE.BackSide })));
    const sky = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 2.7, 2.9) });
    for (const x of [-4.8, -1.6, 1.6, 4.8]) for (const z of [-3.4, 0.3, 3.8]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.8), sky); m.rotation.x = Math.PI / 2; m.position.set(x, 2.95, z); sc.add(m); }
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(15, 11), new THREE.MeshBasicMaterial({ color: 0x2a2d31 })); fl.rotation.x = -Math.PI / 2; fl.position.y = -2.95; sc.add(fl);
    const rt = pmrem.fromScene(sc, 0.04, 0.1, 40); bin.add(rt); pmrem.dispose();
    scene.environment = rt.texture;
    scene.traverse((o) => { const m = /** @type {any} */ (o).material; if (m && m.isMeshStandardMaterial) m.envMapIntensity = 0.5; });
  }
  const DV = makeDevices(bin, quality);
  const CB = makeCables(bin, quality);
  const devs = new THREE.Group(); devs.name = 'appareils'; scene.add(devs);
  const cabs = new THREE.Group(); cabs.name = 'câbles'; scene.add(cabs);
  /** @type {Map<string, { I: ReturnType<typeof DV.instance>, key: string, zone: string }>} */
  const devices = new Map();
  /** @type {Map<string, { obj: THREE.Object3D, key: string }>} */
  const cables = new Map();

  // la sélection : une boîte filaire orange qui « respire » autour de l'appareil choisi
  const selBox = new THREE.Box3();
  const sel = new THREE.Box3Helper(selBox, 0xffb020); sel.visible = false; sel.renderOrder = 10; scene.add(sel);
  const selMat = /** @type {THREE.LineBasicMaterial} */ (sel.material); selMat.transparent = true; selMat.depthTest = false;
  bin.add(sel.geometry); bin.add(selMat);
  let selUid = '', t = 0;

  const devKey = (/** @type {Appareil} */ a) => `${a.modele}|${a.place.zone}|${a.place.slot}`;
  /** pose le groupe d'un appareil à son emplacement */
  function place(/** @type {THREE.Object3D} */ g, /** @type {Appareil} */ a) {
    const z = a.place.zone, s = a.place.slot;
    if (z === 'rack') { const p = rackSlot(s); g.position.set(p.x, p.y, p.z); g.rotation.set(0, 0, 0); }
    else if (z === 'table') { const p = tableSlot(s); g.position.set(p.x, p.y, p.z); g.rotation.set(0, 0, 0); }
    else if (z === 'plateau') { const p = plateauSlot(s); g.position.set(p.x, 0, p.z); g.rotation.set(0, p.rotY, 0); }
    else { g.position.set(MUR.x, MUR.y, MUR.z); g.rotation.set(0, 0, 0); }
    g.updateMatrixWorld(true);
  }
  function removeDevice(/** @type {string} */ uid) { const d = devices.get(uid); if (!d) return; devs.remove(d.I.group); DV.release(d.I); devices.delete(uid); }
  function removeCable(/** @type {string} */ uid) { const c = cables.get(uid); if (!c) return; cabs.remove(c.obj); const g = /** @type {any} */ (c.obj).geometry; if (g) g.dispose(); cables.delete(uid); }
  /** un bout de câble en coordonnées du hall : le connecteur, la normale de sa face, la zone */
  function bout(/** @type {string} */ uid, /** @type {string} */ port) {
    const d = devices.get(uid); if (!d) return null;
    const g = d.I.group; const L = DV.portLocal(d.I.proto, port);
    return { p: g.localToWorld(L.p.clone()), n: L.n.clone().transformDirection(g.matrixWorld), zone: d.zone, origin: g.getWorldPosition(new THREE.Vector3()) };
  }
  function refreshSel() {
    const d = selUid ? devices.get(selUid) : null;
    if (!d) { sel.visible = false; return; }
    selBox.setFromObject(d.I.group).expandByScalar(0.012); sel.visible = true;
  }

  const H = {
    scene,
    update(/** @type {number} */ dt) {
      t += dt;
      if (sel.visible) selMat.opacity = 0.55 + 0.4 * (0.5 + 0.5 * Math.sin(t * 4));
    },
    /** @param {Build} B @param {Eval} E */
    sync(B, E) {
      const vus = new Set();
      for (const a of B.appareils) {
        const m = CATALOGUE[a.modele]; if (!m || !a.place) continue;
        vus.add(a.uid);
        const key = devKey(a); let d = devices.get(a.uid);
        if (!d || d.key !== key) {
          if (d) removeDevice(a.uid);
          const I = DV.instance(a, m); place(I.group, a); devs.add(I.group);
          d = { I, key, zone: a.place.zone }; devices.set(a.uid, d);
        }
        DV.state(d.I, a, E);
      }
      for (const uid of [...devices.keys()]) if (!vus.has(uid)) removeDevice(uid);
      // les câbles : reconstruits si un bout a bougé, si la liaison change d'état
      const cvus = new Set();
      for (const c of B.cables) {
        const A = B.appareils.find((x) => x.uid === c.a.dev), Bb = B.appareils.find((x) => x.uid === c.b.dev); if (!A || !Bb) continue;
        const ok = !E.cables[c.uid] || E.cables[c.uid].ok;
        const key = `${devKey(A)}:${c.a.port}>${devKey(Bb)}:${c.b.port}|${c.sig}|${ok}`;
        cvus.add(c.uid);
        const old = cables.get(c.uid); if (old && old.key === key) continue;
        if (old) removeCable(c.uid);
        const ba = bout(c.a.dev, c.a.port), bb = bout(c.b.dev, c.b.port); if (!ba || !bb) continue;
        const obj = CB.build(c.uid, c.sig, ok, ba, bb); cabs.add(obj); cables.set(c.uid, { obj, key });
      }
      for (const uid of [...cables.keys()]) if (!cvus.has(uid)) removeCable(uid);
      refreshSel();
    },
    /** la pastille d'un appareil (au-dessus, ou à droite de sa face dans la baie) */
    anchor(/** @type {string} */ uid) { const d = devices.get(uid); return d ? d.I.group.localToWorld(d.I.proto.pin.clone()) : null; },
    /** le connecteur d'un appareil, en coordonnées du hall */
    portAnchor(/** @type {string} */ uid, /** @type {string} */ port) { const b = bout(uid, port); return b ? b.p : null; },
    /** @param {THREE.Raycaster} ray */
    pick(ray) {
      const hits = ray.intersectObjects(devs.children, true);
      // l'ordinateur du bureau, s'il est devant
      const pc = ray.intersectObjects(BU.cibles, true)[0];
      for (const h of hits) {
        if (pc && pc.distance < h.distance) return PC_UID;
        let o = /** @type {THREE.Object3D | null} */ (h.object); while (o && !o.userData.uid) o = o.parent; if (o) return String(o.userData.uid);
      }
      return pc ? PC_UID : null;
    },
    /** un point de vue par zone : la cible, la direction d'où l'on regarde, la distance (étroit : le panneau est en bas de l'écran) */
    lookAt(/** @type {string} */ zone, o = { etroit: false }) {
      if (zone === 'rack') return { target: new THREE.Vector3(RACK.x, 0.42, RACK.z + 0.1), dir: new THREE.Vector3(0.5, 0.32, 1), dist: 1.9 };
      if (zone === 'plateau') return { target: new THREE.Vector3(STAGE.x, 1.05, STAGE.z + 1.6), dir: new THREE.Vector3(0.12, 0.72, 1), dist: 4.6 };
      if (zone === 'mur') return { target: new THREE.Vector3(MUR.x, MUR.y, MUR.z + 0.1), dir: new THREE.Vector3(0.35, 0.1, 1), dist: 1.35 };
      // le bureau : derrière le fauteuil, l'écran à gauche de l'image (la messagerie s'ouvre à droite), le hall derrière ;
      // sur un écran étroit, l'écran en haut de l'image (la messagerie s'ouvre en bas)
      if (zone === 'bureau') return o.etroit ? { target: new THREE.Vector3(BUREAU.x, BUREAU.top - 0.02, BUREAU.z - 0.16), dir: new THREE.Vector3(0.05, 0.4, 1), dist: 2.3 }
        : { target: new THREE.Vector3(BUREAU.x + 0.5, BUREAU.top + 0.32, BUREAU.z - 0.2), dir: new THREE.Vector3(0.12, 0.34, 1), dist: 2.2 };
      return { target: new THREE.Vector3((TABLE.x0 + TABLE.x1) / 2, 0.88, 0), dir: new THREE.Vector3(0.12, 0.62, 1), dist: 2.9 };
    },
    /** la pastille de l'ordinateur du bureau */
    pcAnchor() { return BU.anchor; },
    /** l'écran de l'ordinateur : la messagerie (Carrière) ou la session verrouillée @param {import('./scene/bureau.js').Ecran} e */
    ecranPc(e) { BU.ecran(e); },
    /** surligne l'appareil choisi ('' : aucun) */
    select(/** @type {string} */ uid) { selUid = uid || ''; refreshSel(); },
    dispose() {
      for (const uid of [...cables.keys()]) removeCable(uid);
      for (const uid of [...devices.keys()]) removeDevice(uid);
      DV.dispose(); bin.dispose();
    },
  };
  return H;
}

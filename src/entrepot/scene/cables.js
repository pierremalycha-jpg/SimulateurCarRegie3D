// @ts-check
import * as THREE from 'three';
import { SIGNAUX } from '../catalogue/index.js';
import { RACK, TABLE, WALL_Z, hash } from './kit.js';

// ----------------------------------------------------------------------------------
// Les câbles en 3D. Un câble part du connecteur (perpendiculaire à la face), puis suit le chemin
// qu'un technicien lui ferait prendre : sur la table, il file vers l'arrière et tombe derrière
// elle ; dans la baie, il sort par l'arrière (ou contourne le flanc depuis la face avant) et
// descend au sol ; sous une caméra, il longe la colonne ; au mur, il descend le long du mur. Deux
// appareils de la même table (ou de la même baie) se relient sans passer par le sol ; sinon, le
// câble court au sol d'une zone à l'autre, avec un peu de mou. Couleur du signal ; rouge quand la
// liaison est fausse ; un support d'enregistrement (carte, disque) n'est qu'un trait pointillé.
// ----------------------------------------------------------------------------------

/**
 * Un bout de câble, en coordonnées du hall.
 * @typedef {{ p: THREE.Vector3, n: THREE.Vector3, zone: string, origin: THREE.Vector3 }} Bout3D
 */
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const RADIUS = { secteur: 0.0045, sdi: 0.0034, ref: 0.0034, tc: 0.003, ip: 0.003, hdmi: 0.0036, dc12: 0.0026, usb: 0.0028 };
const TABLE_BACK = TABLE.z0 + 0.035;
const RACK_REAR = RACK.z - RACK.d / 2 + 0.05;
/** le centre de la table : les câbles des caméras partent vers la régie */
const REGIE = V((TABLE.x0 + TABLE.x1) / 2, 0, TABLE.z0);

/**
 * Le chemin d'un bout jusqu'à sa zone : « pres » va du connecteur au point de rassemblement de la
 * zone (arrière de la table, arrière de la baie, sortie de l'embase), « bas » de là jusqu'au sol.
 * @param {Bout3D} b @param {number} r rayon du câble
 */
function chemin(b, r) {
  const p = b.p, s = p.clone().addScaledVector(b.n, 0.045);
  if (b.zone === 'table') {
    const y = TABLE.top + r + 0.002;
    const pres = [p, s, V(s.x, Math.max(y, s.y - 0.03), s.z), V(s.x, y, Math.min(s.z, TABLE_BACK))];
    if (s.z > TABLE_BACK) pres.push(V(s.x, y, TABLE_BACK));
    const bas = [V(s.x, TABLE.top - 0.025, TABLE.z0 - 0.04), V(s.x, 0.35, TABLE.z0 - 0.1), V(s.x, r, TABLE.z0 - 0.2)];
    return { pres, bas };
  }
  if (b.zone === 'rack') {
    const pres = [p, s];
    if (b.n.z > 0.5) {
      // une prise en face avant : le câble contourne le flanc le plus proche
      const xs = RACK.x + (s.x < RACK.x ? -1 : 1) * (RACK.w / 2 + 0.03);
      pres.push(V(xs - Math.sign(xs - RACK.x) * 0.01, s.y - 0.01, s.z + 0.02), V(xs, s.y - 0.02, RACK.z), V(xs, s.y - 0.03, RACK_REAR - 0.04));
    } else pres.push(V(s.x, s.y - 0.01, Math.min(s.z, RACK_REAR)));
    const last = pres[pres.length - 1];
    const bas = [V(last.x, 0.14, RACK_REAR - 0.08), V(last.x, r, RACK_REAR - 0.28)];
    return { pres, bas };
  }
  if (b.zone === 'plateau') {
    // le long de la colonne, côté régie, puis au sol, au-delà des pieds du trépied
    const dir = V(REGIE.x - b.origin.x, 0, REGIE.z - b.origin.z).normalize();
    const col = (y, k) => V(b.origin.x + dir.x * k, y, b.origin.z + dir.z * k);
    return { pres: [p, s], bas: [col(s.y - 0.1, 0.07), col(0.8, 0.045), col(0.3, 0.2), col(r, 0.45)] };
  }
  // le mur : le câble descend le long du mur
  return { pres: [p, s], bas: [V(s.x, 0.3, WALL_Z + 0.07), V(s.x, r, WALL_Z + 0.22)] };
}
/** retire les points confondus (une courbe n'en veut pas deux au même endroit) */
function net(/** @type {THREE.Vector3[]} */ pts) { const out = []; for (const p of pts) if (!out.length || out[out.length - 1].distanceTo(p) > 0.003) out.push(p); return out; }

/**
 * @param {ReturnType<import('./kit.js').makeBin>} bin @param {string} quality
 */
export function makeCables(bin, quality) {
  const low = quality === 'basse';
  /** @type {Map<string, THREE.Material>} */
  const mats = new Map();
  const mat = (/** @type {string} */ col, ko = false) => {
    const k = ko ? 'ko' : col; let m = mats.get(k);
    if (!m) { m = bin.add(new THREE.MeshStandardMaterial({ color: ko ? '#ff3b30' : col, roughness: 0.55, metalness: 0.05, emissive: ko ? '#5a0a06' : '#000000' })); mats.set(k, m); }
    return m;
  };
  const dashed = bin.add(new THREE.LineDashedMaterial({ color: '#c9ced3', dashSize: 0.03, gapSize: 0.02 }));

  /**
   * Le maillage d'un câble entre deux bouts (à libérer par l'appelant : geometry.dispose()).
   * @param {string} uid @param {string} sig @param {boolean} ok @param {Bout3D} A @param {Bout3D} B
   * @returns {THREE.Object3D}
   */
  function build(uid, sig, ok, A, B) {
    if (sig === 'media') {
      const g = new THREE.BufferGeometry().setFromPoints([A.p, B.p]);
      const l = new THREE.Line(g, dashed); l.computeLineDistances(); l.userData.cable = uid; return l;
    }
    const r = RADIUS[sig] || 0.0028;
    const a = chemin(A, r), b = chemin(B, r);
    /** @type {THREE.Vector3[]} */ let pts;
    if (A.zone === B.zone && (A.zone === 'table' || A.zone === 'rack')) {
      const ea = a.pres[a.pres.length - 1], eb = b.pres[b.pres.length - 1];
      const mid = ea.clone().add(eb).multiplyScalar(0.5);
      if (A.zone === 'rack') mid.y -= 0.03 + 0.05 * Math.min(1, ea.distanceTo(eb));
      pts = [...a.pres, mid, ...b.pres.slice().reverse()];
    } else {
      const fa = a.bas[a.bas.length - 1], fb = b.bas[b.bas.length - 1];
      // au sol : un peu de mou, d'un côté ou de l'autre selon le câble
      const h = hash(uid); const d = fb.clone().sub(fa); const len = d.length();
      const perp = V(-d.z, 0, d.x).normalize().multiplyScalar(((h % 1000) / 1000 - 0.5) * 0.5 * Math.min(1, len / 3));
      const mid = fa.clone().add(fb).multiplyScalar(0.5).add(perp); mid.y = r;
      pts = [...a.pres, ...a.bas, ...(len > 0.6 ? [mid] : []), ...b.bas.slice().reverse(), ...b.pres.slice().reverse()];
    }
    pts = net(pts);
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const L = curve.getLength();
    const g = new THREE.TubeGeometry(curve, Math.max(12, Math.min(220, Math.round(L * (low ? 16 : 32)))), r, low ? 4 : 6, false);
    const m = new THREE.Mesh(g, mat(SIGNAUX[sig] ? SIGNAUX[sig].couleur : '#999999', !ok));
    m.castShadow = !low; m.receiveShadow = true; m.userData.cable = uid;
    return m;
  }
  return { build };
}

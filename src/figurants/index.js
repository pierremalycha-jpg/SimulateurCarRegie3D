// @ts-check
import * as THREE from 'three';
import { S } from '../state.js';
import { TRUCK, groundHeight, inTruckFootprint } from '../world.js';
import { truckFloorAt, T } from '../truck.js';
import { SES } from '../multi/session.js';
import { PL } from '../app/player.js';
import { Troupe } from './troupe.js';
import { EQUIPE, longueur, pointSur, avancerEquipier } from './equipe.js';
import { MARCHEURS, departMarcheur, avancerMarcheur } from './compound.js';

// ----------------------------------------------------------------------------------
// Les figurants : l'équipe du car à ses postes (equipe.js) et la vie du compound (compound.js). Deux troupes
// instanciées (troupe.js) : l'une dans le stade (le compound), l'autre dans le car ; un technicien qui entre dans
// le car passe de l'une à l'autre en franchissant la porte. L'équipe n'est là que si le car est installé (pas au
// car vide ni au brassage d'arrivée) ; le poste où l'on s'assoit (ou celui d'un équipier en coopération) est
// laissé libre par son titulaire.
// ----------------------------------------------------------------------------------
export const FIG = {
  W: /** @type {Troupe | null} */ (null), T: /** @type {Troupe | null} */ (null),
  equipe: /** @type {Array<{ e: typeof EQUIPE[0], st: any, siege: { x: number, y: number, z: number }, cap: number, chemin: number[][], L: number, etat: { s: number, assis: number, sens?: number }, ici: boolean, occupe: boolean }>} */ ([]),
  marcheurs: /** @type {Array<{ m: typeof MARCHEURS[0], e: ReturnType<typeof departMarcheur>, slotW: number, slotT: number }>} */ ([]),
  t: 0, present: false,
};
const NT = EQUIPE.length;

export function installFigurants(Wscene, Tscene) {
  // le compound (du stade au fond du parking) ; l'intérieur du car (sans ombres portées : l'occlusion du car suffit)
  FIG.W = new Troupe(Wscene, MARCHEURS.length, 'figurants-compound', { zone: new THREE.Sphere(new THREE.Vector3(-5, 1, -125), 52) });
  FIG.T = new Troupe(Tscene, NT + MARCHEURS.length, 'figurants-car', { zone: new THREE.Sphere(new THREE.Vector3(TRUCK.cx, TRUCK.floor + 1, TRUCK.cz), 11), ombres: false });
  // l'équipe : le siège le plus proche de son poste
  EQUIPE.forEach((e, i) => {
    const st = T.stations.find((s) => s.id === e.station); if (!st) return;
    let ch = null, cd = 0.8;
    for (const c of T.chairs || []) { const d = Math.hypot(c.x - st.pos.x, c.z - st.pos.z); if (d < cd) { cd = d; ch = c; } }
    const siege = ch ? { x: ch.x, y: ch.y - 0.52, z: ch.z } : { x: st.pos.x, y: truckFloorAt(st.pos.x, st.pos.z), z: st.pos.z };
    const chemin = e.chemin.map(([lx, lz]) => [TRUCK.cx + lx, TRUCK.cz + lz]);
    chemin[0] = [siege.x, siege.z];
    FIG.equipe.push({ e, st, siege, cap: Math.atan2(st.look.x - st.pos.x, st.look.z - st.pos.z), chemin, L: longueur(chemin), etat: { s: 0, assis: 1 }, ici: false, occupe: false });
    FIG.T.habiller(i, e.tenue);
  });
  // les marcheurs : une place dans chaque troupe
  MARCHEURS.forEach((m, k) => {
    FIG.marcheurs.push({ m, e: departMarcheur(m), slotW: k, slotT: NT + k });
    FIG.W.habiller(k, m.tenue); FIG.T.habiller(NT + k, m.tenue);
  });
}

/** l'équipe est-elle au car ? (car installé, partie commencée) */
export const equipePresente = () => S.mode !== 'start' && !['zero', 'vierge', 'brassage', 'scenario'].includes(S.preset || '');
/** le joueur est assis à ce pupitre */
const parMoi = (st) => S.mode === 'station' && Math.hypot(PL.pos.x - st.pos.x, PL.pos.z - st.pos.z) < 0.9;
/** un poste est-il pris par le joueur ou par un équipier de la session ? */
function posteOccupe(st) {
  if (parMoi(st)) return true;
  if (SES.active) for (const p of SES.peers) {
    const av = !p.sameTab && p.presence && p.presence.av;
    if (av && av.t && av.s && Array.isArray(av.p) && Math.hypot(av.p[0] - st.pos.x, av.p[2] - st.pos.z) < 1.2) return true;
  }
  return false;
}

// petits mouvements : le regard va des écrans au pupitre, le réalisateur montre le mur d'écrans
const onde = (t, a, b) => Math.sin(t * a + b) * 0.6 + Math.sin(t * a * 2.3 + b * 1.7) * 0.4;
function poseAssise(i, q, t) {
  const g = q.e.geste, ph = i * 1.37;
  const versEcrans = onde(t, 0.18, ph) > 0.1;
  let bras = g, tetePitch = versEcrans ? -0.1 : 0.32, teteYaw = 0.22 * onde(t, 0.11, ph + 2), penche = 0.06;
  if (g === 'pointe') { bras = (t + ph * 3) % 11 < 2.6 ? 'pointe' : 'bureau'; tetePitch = -0.16; }
  if (g === 'croise') { penche = -0.1; tetePitch = -0.08; }
  if (g === 'console') penche = 0.12;
  return { bras, tetePitch, teteYaw, penche };
}

export function updateFigurants(dt) {
  if (!FIG.W || !FIG.T) return;
  FIG.t += dt;
  const t = FIG.t, dansLeCar = S.inTruck || S.mode === 'station';
  // ---- l'équipe ----
  const present = equipePresente();
  if (present !== FIG.present) { FIG.present = present; for (let i = 0; i < NT; i++) { FIG.T.cacher(i); const q = FIG.equipe[i]; if (q) Object.assign(q.etat, { s: 0, assis: 1 }); } }
  if (present) FIG.equipe.forEach((q, i) => {
    q.occupe = posteOccupe(q.st);
    // le joueur s'assoit à sa place : la vue du poste est là où était sa tête, il s'écarte d'emblée
    if (q.occupe && parMoi(q.st) && q.etat.s < Math.min(q.L, 1.3)) { q.etat.assis = 0; q.etat.s = Math.min(q.L, 1.3); }
    avancerEquipier(q.etat, q.L, q.occupe, dt);
    if (!dansLeCar) return;
    const E = q.etat;
    if (E.s <= 0) {
      // assis (ou en train de se lever : on reste sur le siège)
      const p = poseAssise(i, q, t);
      FIG.T.poser(i, { x: q.siege.x, y: q.siege.y, z: q.siege.z, yaw: q.cap, assis: E.assis, ...p, t });
    } else {
      const pt = pointSur(q.chemin, E.s), arrive = E.s >= q.L - 1e-3 && E.sens === 0;
      const y = truckFloorAt(pt.x, pt.z);
      if (arrive) FIG.T.poser(i, { x: pt.x, y, z: pt.z, yaw: Math.PI, bras: 'croise', tetePitch: -0.12, teteYaw: 0.3 * onde(t, 0.13, i), t });
      else FIG.T.poser(i, { x: pt.x, y, z: pt.z, yaw: E.sens < 0 ? pt.cap + Math.PI : pt.cap, vitesse: 1.1, phase: E.s * 3.1, t });
    }
  });
  // ---- le compound ----
  for (const w of FIG.marcheurs) {
    const e = avancerMarcheur(w.m, w.e, dt);
    const dedans = inTruckFootprint(e.x, e.z);
    if (e.cache) { FIG.W.cacher(w.slotW); FIG.T.cacher(w.slotT); continue; }
    const P = { x: e.x, z: e.z, yaw: e.cap, vitesse: e.vitesse, phase: e.phase, bras: e.bras, penche: e.penche, teteYaw: e.vitesse > 0 ? 0 : 0.35 * onde(t, 0.2, w.slotW), t };
    if (dedans) { FIG.W.cacher(w.slotW); if (dansLeCar) FIG.T.poser(w.slotT, { ...P, y: truckFloorAt(e.x, e.z) }); }
    else { FIG.T.cacher(w.slotT); if (!dansLeCar || S.frame % 4 === 0) FIG.W.poser(w.slotW, { ...P, y: groundHeight(e.x, e.z) }); }
  }
  if (dansLeCar) FIG.T.publier(); else FIG.W.publier();
  if (S.frame % 4 === 0) FIG.W.publier();
}
/** pour les tests : où sont les figurants */
export function figurantsDebug() {
  return {
    equipe: FIG.equipe.map((q) => ({ id: q.e.id, nom: q.e.nom, occupe: q.occupe, s: Math.round(q.etat.s * 100) / 100, assis: Math.round(q.etat.assis * 100) / 100, L: q.L, visible: FIG.T.visible[FIG.equipe.indexOf(q)] })),
    marcheurs: FIG.marcheurs.map((w) => ({ id: w.m.id, x: w.e.x, z: w.e.z, cache: w.e.cache, k: w.e.k, dedans: inTruckFootprint(w.e.x, w.e.z), visibleW: FIG.W.visible[w.slotW], visibleT: FIG.T.visible[w.slotT] })),
    present: FIG.present,
  };
}
/** pour les tests : fait avancer les figurants de quelques secondes d'un coup */
export function sauterFigurants(sec) { for (let t = 0; t < sec; t += 0.05) updateFigurants(0.05); }

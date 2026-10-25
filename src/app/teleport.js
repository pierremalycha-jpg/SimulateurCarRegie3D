// @ts-check
import { S, emit } from '../state.js';
import { TRUCK } from '../world.js';
import { truckBlocked, truckFloorAt, T } from '../truck.js';
import { AT, ATELIER_DECK } from '../atelier.js';
import { ROLE_BRIEF } from '../multi/roles.js';
import { openStation, closeStation } from '../ui/stations.js';
import { toast, modal } from '../ui/common.js';
import { PL, onDeck, updToolbar } from './player.js';
import { takeCamera } from './camop.js';

// ----------------------------------------------------------------------------------
// Se rendre quelque part : destinations du téléphone (telephone/apps.js), postes du car, équipiers
// d'une session, poste attribué par la fiche de rôle.
// ----------------------------------------------------------------------------------
/** @type {Array<[string, number[], number, boolean, boolean?]>} : nom, position, cap, vol libre, dans le car */
export const DESTS = [
  ['Compound, devant le car', [-13, 0, -107.5], 0.25, false],
  ['Car régie · production (multiview)', [TRUCK.cx - 2.8, TRUCK.floor, TRUCK.cz + 1.85], 0, false, true],
  ['Car régie · vision et EVS', [TRUCK.cx + 2, TRUCK.floor, TRUCK.cz + 1.85], 0, false, true],
  ['Car régie · zone technique', [TRUCK.cx + 5.2, TRUCK.floor, TRUCK.cz], -Math.PI / 2, false, true],
  ['Car régie · son', [TRUCK.cx - 6.4, TRUCK.floor, TRUCK.cz + 1.6], Math.PI / 2, false, true],
  ['Bord terrain, ligne médiane', [0, 0, -37], Math.PI, false],
  ['Sortie du tunnel des joueurs', [0, 0, -46], Math.PI, false],
  ['Tunnel et vestiaires', [0, 0, -76], 0, false],
  ['Passerelle caméras (tribune Lepagnot)', [0, 17.2, -68.4], Math.PI, true],
  ['Derrière le but, côté Trannin', [-58.4, 0, -14], -Math.PI / 2 - 0.3, false],
  ['Kop Marek (tribune debout)', [0, 7.3, 54], 0, true],
  ['Angle ouvert et pylône (Trannin-Lepagnot)', [-68, 0, -48], -2.3, false],
  ['Toit (antennes HF)', [0, 36.2, -46], Math.PI, true],
  ['Vue aérienne du stade', [-60, 140, -190], Math.PI * 0.85, true],
];
export function teleport(i) {
  const [, p, yaw, fly, truck] = DESTS[i];
  PL.pos.set(p[0], p[1], p[2]); PL.yaw = yaw; PL.pitch = DESTS[i][0].startsWith('Vue aérienne') ? -0.55 : 0; PL.fly = !!fly; S.inTruck = !!truck;
  PL.y = p[1] + 1.7; PL.vel.set(0, 0, 0); PL.cyaw = PL.yaw; PL.cpitch = PL.pitch;
  // retour à l'atelier : à pied sur la passerelle
  if (AT.active && fly) { PL.fly = false; if (onDeck()) { PL.pos.y = ATELIER_DECK.y; PL.y = PL.pos.y + 1.7; } else PL.fly = true; }
  updToolbar();
  emit('teleport', i);
}
// se placer au poste (debout devant, tourné vers le pupitre) puis l'ouvrir
export function goToStation(s, open = true) {
  if (S.mode === 'station') closeStation(true);
  if (S.modalOpen) modal.close();
  S.inTruck = true; PL.fly = false;
  PL.pos.set(s.pos.x, truckFloorAt(s.pos.x, s.pos.z), s.pos.z); PL.y = PL.pos.y + 1.7;
  PL.yaw = Math.atan2(-(s.look.x - s.pos.x), -(s.look.z - s.pos.z)); PL.pitch = -0.25; PL.vel.set(0, 0, 0);
  if (open) openStation(s.station, s.arg);
}
// ouvrir un poste à distance (guide, scénario) : le joueur est placé dans le car, devant ce poste
export function placeAtStation(id) {
  const st = T.stations.find((s) => s.station === id);
  if (st) { PL.pos.set(st.pos.x, TRUCK.floor, st.pos.z); S.inTruck = true; PL.y = TRUCK.floor + 1.7; }
}
export function goToMate(a) {
  // juste derrière lui, tourné dans la même direction (en hauteur hors du car : vol libre, comme les téléportations)
  const yaw = a.yaw || 0;
  S.inTruck = !!a.truck;
  const c = a.cam ? S.cams.find((x) => x.id === a.cam) : null;
  if (c) { const r = c.model.root.position; PL.pos.set(r.x + Math.sin(c.yaw.v) * 2.2, Math.max(0, r.y - 1.4), r.z + Math.cos(c.yaw.v) * 2.2); PL.yaw = c.yaw.v; }
  else if (a.truck) { let x = a.x + Math.sin(yaw) * 0.7, z = a.z + Math.cos(yaw) * 0.7; if (truckBlocked(x, z)) { x = a.x; z = a.z + 0.5; } PL.pos.set(x, truckFloorAt(x, z), z); PL.yaw = yaw; }
  else { PL.pos.set(a.x + Math.sin(yaw) * 1.2, a.y, a.z + Math.cos(yaw) * 1.2); PL.yaw = yaw; }
  PL.fly = !S.inTruck && PL.pos.y > 0.5;
  if (AT.active && PL.fly) { PL.fly = false; if (onDeck()) PL.pos.y = ATELIER_DECK.y; else PL.fly = true; }
  PL.y = PL.pos.y + 1.7; PL.vel.set(0, 0, 0); PL.pitch = 0; PL.cyaw = PL.yaw; PL.cpitch = 0; updToolbar();
}
// fiche de rôle : « Aller à mon poste » (ou prendre sa caméra pour un cadreur)
export function goToRolePost(role, camId) {
  if (role === 'cadreur') {
    const c = S.cams.find((x) => x.id === camId); if (!c) { toast(`La CAM ${camId} n'existe pas dans ce dispositif.`, 'bad'); return; }
    if (S.mode === 'station') closeStation(true);
    const r = c.model.root.position; S.inTruck = false;
    PL.pos.set(r.x + Math.sin(c.yaw.v) * 1.6, Math.max(0, r.y - 1.4), r.z + Math.cos(c.yaw.v) * 1.6); PL.fly = PL.pos.y > 0.5; PL.yaw = c.yaw.v;
    PL.y = PL.pos.y + 1.7; PL.vel.set(0, 0, 0); PL.cyaw = PL.yaw; PL.pitch = PL.cpitch = 0; updToolbar();
    takeCamera(c); return;
  }
  const B = ROLE_BRIEF[role]; const st = B && T.stations.find((x) => x.id === B.station);
  if (st) goToStation(st);
}

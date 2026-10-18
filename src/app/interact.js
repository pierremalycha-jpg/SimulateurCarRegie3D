// @ts-check
import * as THREE from 'three';
import { S } from '../state.js';
import { el } from '../util.js';
import { STATION_INFO } from '../content/stations.js';
import { W } from '../world.js';
import { T } from '../truck.js';
import { AT } from '../atelier.js';
import { $, toast, openInfo } from '../ui/common.js';
import { onDeck, eyePos } from './player.js';
import { pcam } from './view.js';
import { teleport, goToStation } from './teleport.js';
import { takeCamera } from './camop.js';

// ----------------------------------------------------------------------------------
// Ce que le joueur vise : poste du car, caméra à prendre, point d'information, porte du car.
// La visée est recalculée à chaque image ; elle réutilise ses vecteurs et ses objets.
// ----------------------------------------------------------------------------------
export const AIM = { target: /** @type {any} */ (null) };

const EYE = new THREE.Vector3(), DIR = new THREE.Vector3(), V = new THREE.Vector3();
// un objet « visé » par source (poste, point d'information, caméra), rafraîchi quand il est choisi
const AIMS = new WeakMap();
function aimOf(src, fill) {
  let a = AIMS.get(src);
  if (!a) { a = {}; AIMS.set(src, a); }
  fill(a);
  return a;
}
// dehors : plus on est près et dans l'axe, meilleur est le score (Infinity = hors de portée)
function score(pos, r) {
  V.copy(pos).sub(EYE); const d = V.length();
  if (d > r + 1.2) return Infinity;
  const cos = d > 0.01 ? V.normalize().dot(DIR) : 1;
  if (cos < 0.55 && d > 1.3) return Infinity;
  return d * (2.2 - cos);
}
export function findTarget() {
  eyePos(EYE); pcam.getWorldDirection(DIR);
  if (S.inTruck) {
    // dans le car : on prend le poste que l'on regarde (point visé : écran, pupitre ou baie)
    let best = null, bs = 1e9;
    for (const s of T.stations) {
      V.copy(s.look).sub(EYE); const d = V.length();
      const h = Math.hypot(s.pos.x - EYE.x, s.pos.z - EYE.z);
      if (d > 3.4 || h > s.r + 1.4) continue;
      const cos = V.normalize().dot(DIR);
      if (cos < 0.8 && !(h < 0.45 && cos > 0.3)) continue;
      const sc = (1 - cos) * 6 + d * 0.25;
      if (sc < bs) { bs = sc; best = s; }
    }
    return best ? aimOf(best, (a) => { Object.assign(a, best); a.kind = 'station'; }) : null;
  }
  let best = null, cam = null, bs = 1e9;
  for (const it of W.interactables) { const sc = score(it.pos, it.r); if (sc < bs) { bs = sc; best = it; cam = null; } }
  for (const c of S.cams) { const sc = score(c.cam.position, c.T.model === 'pov' ? 2 : 2.6); if (sc < bs) { bs = sc; best = null; cam = c; } }
  if (cam) return aimOf(cam, (a) => { a.id = 'cam' + cam.id; a.pos = cam.cam.position; a.r = cam.T.model === 'pov' ? 2 : 2.6; a.label = `Prendre la CAM ${cam.id} (${cam.T.short})`; a.kind = 'cam'; a.cam = cam; a.info = 'cadreur'; });
  if (best) { const it = best; return aimOf(it, (a) => { Object.assign(a, it); a.kind = it.action ? 'action' : 'info'; }); }
  return null;
}
export function act(t) {
  if (!t) return;
  if (t.kind === 'station') { goToStation(t); return; }
  if (t.kind === 'cam') { takeCamera(t.cam); return; }
  if (t.action === 'enterTruck') { teleport(1); toast('Vous êtes dans la régie production. Approchez-vous d\'un poste et appuyez sur E.'); return; }
  if (t.info) { openInfo(t.info); if (t.id.startsWith('ant:')) S.openedInfo.antenne = true; }
}
// bandeau « E : … » sous le réticule ; reconstruit seulement quand la cible change
export function updatePrompt() {
  const p = $('#prompt');
  if (S.mode !== 'fps' || S.modalOpen) { p.hidden = true; if (AT.active) AT._tk = '#'; return; }
  if (AT.active && onDeck()) { AIM.target = null; return; } // l'atelier gère sa propre visée
  const target = AIM.target = findTarget();
  if (!target) { p.hidden = true; return; }
  const infoId = target.kind === 'station' ? (STATION_INFO[target.station] ? target.station : target.id) : target.info;
  const key = target.label + (infoId || '');
  if (p.dataset.k === key && !p.hidden) return;
  p.dataset.k = key; p.hidden = false; p.innerHTML = '';
  p.append(el('kbd', {}, 'E'), el('span', {}, target.kind === 'station' ? 'Prendre le poste : ' + target.label : target.label));
  if (target.kind === 'cam') p.append(el('small', {}, 'I : voir le matériel (connecteurs)'));
  else if (target.kind === 'station') p.append(el('small', {}, ['clic ou E', infoId && STATION_INFO[infoId] ? 'I : fiche du poste' : '', target.device ? 'K : voir l\'appareil' : ''].filter(Boolean).join(' · ')));
  else if (infoId && STATION_INFO[infoId] && target.kind !== 'info') p.append(el('small', {}, 'I : fiche du poste'));
  p.onclick = () => act(target);
}

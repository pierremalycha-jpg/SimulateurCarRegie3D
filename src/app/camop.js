// @ts-check
import * as THREE from 'three';
import { S } from '../state.js';
import { el, clamp, fmt } from '../util.js';
import { W, blockedOutside } from '../world.js';
import { P } from '../pipeline.js';
import { $, intercom } from '../ui/common.js';
import { closeStation } from '../ui/stations.js';
import { closePlan } from '../ui/plan.js';
import { KEYS } from './player.js';
import { renderer } from './view.js';

// ----------------------------------------------------------------------------------
// Opérateur caméra : le joueur prend une caméra et cadre dans le viseur (rendu dédié en
// 1280 × 720, sans les artefacts de transmission). R maintenu : retour PGM.
// ----------------------------------------------------------------------------------
export const CAMOP = { returnHeld: false };
const camopRT = { raw: null };
// éléments du viseur, retrouvés une fois à chaque prise de caméra
let VF = null;

export function takeCamera(cam) {
  if (!cam) return;
  if (S.mode === 'station') closeStation();
  if (S.mode === 'plan') closePlan();
  S.mode = 'camop'; S.camop = cam; cam.manual = true;
  cam.tgt = { yaw: cam.yaw.v, pitch: cam.pitch.v, lf: cam.lf.v }; // consignes : la tête fluide les rejoint avec un léger amorti
  if (cam.T.moving === 'touchline') cam.manualMove = true;
  const o = $('#camop'); o.hidden = false; o.innerHTML = '';
  o.append(el('div', { class: 'vf', 'data-gl': 'camop', id: 'vf' }), el('div', { class: 'safe' }), el('div', { class: 'safe2' }), el('div', { class: 'cross' }), el('div', { class: 'tally', id: 'vf-tally' }),
    el('div', { class: 'head', id: 'vf-head' }), el('div', { class: 'zoombar' }, el('i', { id: 'vf-zoom' })), el('div', { class: 'info', id: 'vf-info' }),
    el('div', { class: 'help' }, el('b', {}, 'Vous êtes cadreur'), el('br'), 'Souris : panoramique / inclinaison', el('br'), 'Molette ou + / − : zoom', el('br'), 'X : doubleur x2 · R (maintenu) : retour PGM', el('br'), cam.T.moving === 'touchline' ? 'Z Q S D : marcher avec la Steadicam' : '', cam.T.moving === 'touchline' ? el('br') : '', 'E ou Échap : rendre la caméra', el('br'),
      el('button', { class: 'btn small', style: { marginTop: '6px' }, onclick: () => releaseCamera() }, 'Rendre la caméra')));
  VF = { vf: $('#vf'), tally: $('#vf-tally'), head: $('#vf-head'), zoom: $('#vf-zoom'), info: $('#vf-info'), infoKey: '' };
  $('#hud').hidden = true;
  try { $('#input-layer').requestPointerLock(); } catch (e) { /* refus */ }
  intercom('RÉAL', `CAM ${cam.id}, je t'entends ? Cadre propre quand ton tally est rouge.`);
}
export function releaseCamera() {
  const cam = S.camop; if (!cam) return;
  cam.manual = cam.role === 'manuel'; cam.manualMove = false;
  S.camop = null; S.mode = 'fps'; $('#camop').hidden = true; $('#hud').hidden = false;
}

const F = new THREE.Vector3(), R = new THREE.Vector3(), MV = new THREE.Vector3();
export function updateCamop(dt) {
  const c = S.camop; if (!c) return;
  if (c.manualMove) {
    const f = F.set(-Math.sin(c.yaw.v), 0, -Math.cos(c.yaw.v)), r = R.set(Math.cos(c.yaw.v), 0, -Math.sin(c.yaw.v));
    const mv = MV.set(0, 0, 0);
    if (KEYS.KeyW || KEYS.ArrowUp) mv.add(f); if (KEYS.KeyS || KEYS.ArrowDown) mv.sub(f); if (KEYS.KeyD || KEYS.ArrowRight) mv.add(r); if (KEYS.KeyA || KEYS.ArrowLeft) mv.sub(r);
    if (mv.lengthSq()) {
      mv.normalize().multiplyScalar((KEYS.ShiftLeft || KEYS.ShiftRight ? 5.5 : 2.6) * dt);
      const p = c.cam.position;
      if (!blockedOutside(p.x + mv.x, p.z)) p.x += mv.x;
      if (!blockedOutside(p.x, p.z + mv.z)) p.z += mv.z;
      c.model.root.position.copy(p);
    }
  }
  if (!c.tgt) c.tgt = { yaw: c.yaw.v, pitch: c.pitch.v, lf: c.lf.v };
  if (KEYS.NumpadAdd || KEYS.Equal) c.tgt.lf = clamp(c.tgt.lf + dt * 1.2, Math.log(c.fMin), Math.log(c.fMax));
  if (KEYS.NumpadSubtract || KEYS.Minus || KEYS.Digit6) c.tgt.lf = clamp(c.tgt.lf - dt * 1.2, Math.log(c.fMin), Math.log(c.fMax));
  // tête fluide : le cadre rejoint la consigne de la souris avec un amorti (≈ 80 ms), le zoom avec la rampe du servo
  const kh = 1 - Math.exp(-dt * 12), kz = 1 - Math.exp(-dt * 6);
  c.yaw.v += (c.tgt.yaw - c.yaw.v) * kh; c.pitch.v += (c.tgt.pitch - c.pitch.v) * kh;
  c.tgt.lf = clamp(c.tgt.lf, Math.log(c.fMin), Math.log(c.fMax)); c.lf.v += (c.tgt.lf - c.lf.v) * kz;
  c.yaw.vel = 0; c.pitch.vel = 0; c.lf.vel = 0;
  c.applyPose();
  // rendu haute définition pour le viseur (image de la caméra, sans artefacts de transmission)
  if (!P.rts.camop) { P.rts.camop = new THREE.WebGLRenderTarget(1280, 720, { depthBuffer: false }); camopRT.raw = new THREE.WebGLRenderTarget(1280, 720, { type: THREE.HalfFloatType, samples: S.quality === 'basse' ? 0 : 4 }); }
  const r0 = c.rawRT; c.rawRT = camopRT.raw;
  const rf = c.rf ? { b: c.rf.block, k: c.rf.brk } : null;
  if (c.rf) { c.rf.block = 0; c.rf.brk = 0; }
  for (const m of W.screens) m.uniforms.uLin.value = 1;
  c.render(renderer, W.scene, null, P.rts.camop);
  for (const m of W.screens) m.uniforms.uLin.value = 0;
  if (rf) { c.rf.block = rf.b; c.rf.brk = rf.k; }
  c.rawRT = r0;
  if (!VF) return;
  VF.vf.dataset.gl = CAMOP.returnHeld ? 'PGM' : 'camop';
  const t = c.tallyState;
  VF.tally.className = 'tally ' + (t === 2 ? 'red' : t === 1 ? 'green' : '');
  if (S.frame % 4 === 0) {
    VF.head.textContent = `CAM ${c.id} · ${c.T.short} · ${c.L.name}${CAMOP.returnHeld ? ' · RETOUR PGM' : ''}`;
    const zr = (Math.log(c.focal) - Math.log(c.fMin)) / Math.max(0.001, Math.log(c.fMax) - Math.log(c.fMin));
    VF.zoom.style.bottom = `calc(${zr * 100}% - 2px)`;
    const items = [`${Math.round(c.focal)} mm${c.ext ? ' EX2' : ''}`, `Angle ${fmt(c.hfov() * 180 / Math.PI, 1)}°`, `F${fmt(c.effAperture(), 1)}`, `${c.paint.gain > 0 ? '+' : ''}${c.paint.gain} dB · ND ${['CLR', '1/4', '1/8', '1/16', '1/64'][c.paint.nd]}`, t === 2 ? '● À L\'ANTENNE' : t === 1 ? '● PRÉPARÉE' : '○'];
    // la ligne d'informations n'est reconstruite que si elle change
    const key = items.join('|');
    if (key !== VF.infoKey) { VF.infoKey = key; VF.info.replaceChildren(...items.map((s) => el('span', {}, s))); }
  }
}

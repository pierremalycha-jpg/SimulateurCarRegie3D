// @ts-check
import { S, emit, on } from '../state.js';
import { el, tc, mmss } from '../util.js';
import { TEAMS } from '../data/match.js';
import { TRUCK, standAt } from '../world.js';
import { M } from '../match.js';
import { MIX, EVS, meSource, sourceLabel } from '../pipeline.js';
import { AU, startAudio, applyFaders } from '../audio.js';
import { AT } from '../atelier.js';
import { $ } from '../ui/common.js';
import { openSessionPanel } from '../ui/session_ui.js';
import { openPupitre } from '../ui/pupitre.js';
import { PL } from './player.js';

// ----------------------------------------------------------------------------------
// Affichage tête haute : barre d'outils, bande d'état (timecode, score, PGM / PVW, alarmes,
// images par seconde) et lieu où l'on se trouve.
// ----------------------------------------------------------------------------------
const chefBtn = (btn) => { btn.classList.add('chef-btn'); return btn; };
const soundLabel = () => (AU.muted ? 'Son coupé' : 'Son');
export function buildToolbar() {
  const tb = $('#toolbar'); tb.innerHTML = '';
  // quatre touches : le pupitre (aller quelque part, tous les outils), le chef de car, le son, l'équipe
  const b = (label, key, fn, id, title) => el('button', { class: 'tbtn', id, title: title || label + (key ? ' (' + key + ')' : ''), onclick: fn }, el('span', { class: 'tl' }, label), key ? el('kbd', {}, key) : null);
  tb.append(
    b('Pupitre', 'Tab', () => openPupitre(), 'tb-pupitre', 'Aller à un poste ou un endroit, et tous les outils (Tab ou T)'),
    chefBtn(b('Chef de car', 'J', () => emit('chef'), 'tb-chef', 'Le chef de car vous explique le poste et vous guide pas à pas (J)')),
    b(soundLabel(), null, () => { startAudio(); AU.muted = !AU.muted; applyFaders(); emit('soundToggle'); }, 'tb-son', 'Couper ou rétablir le son'),
    b('Équipe', null, () => openSessionPanel(), 'tb-ses', 'Jouer à plusieurs : joueurs, rôles, ordres'));
  const son = $('#tb-son'); if (son) son.classList.toggle('muted', AU.muted);
}
on('soundToggle', () => { const son = $('#tb-son'); if (son) { son.querySelector('.tl').textContent = soundLabel(); son.classList.toggle('muted', AU.muted); } });

// images par seconde affichées (mesurées en temps réel sur une demi-seconde)
export const FPS = { shown: 0 };
let fpsAcc = 0, fpsN = 0;
// barre d'état : construite une fois ; ensuite, seuls les textes qui changent sont réécrits
let SB = null;
const setText = (node, v) => { if (node.textContent !== v) node.textContent = v; };
function buildStatus() {
  const sb = $('#statusbar'); sb.innerHTML = '';
  const b = () => el('b');
  SB = { tc: b(), score: document.createTextNode(''), clock: b(), pgm: b(), pvw: b(), alarms: b(), fps: b(), alarmChip: null };
  SB.alarmChip = el('span', { class: 'chip' }, 'Alarmes', SB.alarms);
  sb.append(
    el('span', { class: 'chip tc' }, 'TC', SB.tc),
    el('span', { class: 'chip' }, SB.score, SB.clock),
    el('span', { class: 'chip red' }, el('span', { class: 'dot red' }), 'PGM', SB.pgm),
    el('span', { class: 'chip green' }, el('span', { class: 'dot green' }), 'PVW', SB.pvw),
    SB.alarmChip,
    el('span', { class: 'chip fps', title: 'Images par seconde du rendu' }, SB.fps));
}
export function updateStatus(dt) {
  fpsAcc += dt; fpsN++;
  if (fpsAcc > 0.5) { FPS.shown = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; }
  if (S.frame % 6) return;
  if (!SB || !SB.tc.isConnected) buildStatus();
  const alarms = S.cams.filter((c) => !c.signalOK || !c.genlock).length + (EVS.recording ? 0 : 1) + ((S.faults.tx && S.txPath === 1) ? 1 : 0);
  const pgm = sourceLabel(meSource(MIX.pgm));
  setText(SB.tc, tc(S.tcOffset + S.simTime));
  setText(SB.score, `${TEAMS[0].short} ${M.score[0]}-${M.score[1]} ${TEAMS[1].short}`);
  setText(SB.clock, mmss(M.clock));
  setText(SB.pgm, pgm);
  setText(SB.pvw, sourceLabel(meSource(MIX.pst)));
  setText(SB.alarms, String(alarms)); SB.alarmChip.classList.toggle('alarm', alarms > 0);
  setText(SB.fps, FPS.shown + ' i/s');
  setText($('#minimon .lab'), 'PGM · ' + pgm);
  const zone = whereAmI();
  setText($('#where'), zone[0]); setText($('#where2'), zone[1]);
}
export function whereAmI() {
  const p = PL.pos;
  if (S.inTruck) {
    const lx = p.x - TRUCK.cx;
    if (lx < -5.4) return ['Car régie · son', 'Cabine isolée, console de mixage'];
    if (lx < -0.15) return ['Car régie · production', 'Réalisateur, scripte, truquiste, habillage, chef de car'];
    if (lx < 3.9) return ['Car régie · vision et ralentis', 'Ingénieurs vision (RCP), opérateurs EVS'];
    return ['Car régie · zone technique', 'Baies CCU, grille, synchro, transmission, HF'];
  }
  if (p.y > 15 && !PL.fly && p.z < -66 && p.z > -71.5 && Math.abs(p.x) < 41) return ['Passerelle caméras', AT.active ? 'Atelier de montage · CAM 1' : 'Tribune Lepagnot, au-dessus des loges'];
  if (p.z < -95) return ['Compound', 'Parc technique : car régie, groupe, satellite'];
  if (Math.abs(p.x) < 61 && Math.abs(p.z) < 41) return ['Pelouse et bord terrain', 'Caméras basses, Steadicam, mini-caméras'];
  if (p.z < -41 && p.z > -95 && Math.abs(p.x) < 17) return ['Sous la tribune Lepagnot', 'Tunnel, vestiaires, local technique TV'];
  const sa = standAt(p.x, p.z);
  if (sa) return [sa.st.name, PL.fly ? 'Vol libre' : sa.st.id === 'marek' ? 'Marek en bas (kop debout), Xercès en haut' : sa.st.main ? 'Tribune principale : presse, loges, passerelle caméras' : 'Tribune derrière le but'];
  if (Math.abs(p.x) < 125 && Math.abs(p.z) < 110) return ['Stade Bollaert-Delelis (inspiration)', 'Angle ouvert, pylône du toit'];
  return ['Abords du stade', PL.fly ? 'Vol libre' : 'Cités minières, voie ferrée, terrils à l\'horizon'];
}

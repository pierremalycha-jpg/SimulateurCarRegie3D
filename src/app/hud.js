// @ts-check
import { S, emit } from '../state.js';
import { el, tc, mmss } from '../util.js';
import { TEAMS } from '../data/match.js';
import { TRUCK, standAt } from '../world.js';
import { M } from '../match.js';
import { MIX, EVS, meSource, sourceLabel } from '../pipeline.js';
import { AU, startAudio, applyFaders } from '../audio.js';
import { AT } from '../atelier.js';
import { $ } from '../ui/common.js';
import { openTruckPlan } from '../ui/truckmap.js';
import { openSynoptics } from '../ui/synoptics.js';
import { openPlan } from '../ui/plan.js';
import { openGuide } from '../ui/guide.js';
import { openSessionPanel } from '../ui/session_ui.js';
import { openEquipmentIndex } from '../equipment/viewer.js';
import { PL, updToolbar } from './player.js';
import { teleportMenu } from './teleport.js';

// ----------------------------------------------------------------------------------
// Affichage tête haute : barre d'outils, barre d'état (timecode, score, PGM / PVW, alarmes,
// images par seconde) et lieu où l'on se trouve.
// ----------------------------------------------------------------------------------
const chefBtn = (btn) => { btn.classList.add('chef-btn'); return btn; };
export function buildToolbar() {
  const tb = $('#toolbar'); tb.innerHTML = '';
  // groupes : se déplacer · la régie · l'aide · l'équipe et l'écoute
  const b = (label, key, fn, id, title) => el('button', { class: 'tbtn', id, title: title || label + (key ? ' (' + key + ')' : ''), onclick: fn }, el('span', { class: 'tl' }, label), key ? el('kbd', {}, key) : null);
  const sep = () => el('span', { class: 'tsep', 'aria-hidden': 'true' });
  tb.append(
    b('Aller à', 'T', () => teleportMenu()),
    b('Plan du car', 'Tab', () => openTruckPlan(), 'tb-truck'),
    b('Vol libre', 'V', () => { PL.fly = !PL.fly; updToolbar(); }, 'tb-fly'),
    sep(),
    b('Plan caméras', 'P', () => openPlan()),
    b('Synoptiques', 'Y', () => openSynoptics()),
    b('Matériel', 'K', () => openEquipmentIndex()),
    sep(),
    b('Guide', 'G', () => openGuide('missions')),
    chefBtn(b('Chef de car', 'J', () => emit('chef'), 'tb-chef', 'Le chef de car vous explique le poste et vous guide pas à pas (J)')),
    sep(),
    b('Retour PGM', 'M', () => { $('#minimon').hidden = !$('#minimon').hidden; }),
    b(AU.muted ? 'Son coupé' : 'Son', null, (e) => { startAudio(); AU.muted = !AU.muted; applyFaders(); e.currentTarget.querySelector('.tl').textContent = AU.muted ? 'Son coupé' : 'Son'; }),
    b('Équipe', null, () => openSessionPanel(), 'tb-ses', 'Jouer à plusieurs : joueurs, rôles, ordres'));
}

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
  const tbt = $('#tb-truck'); if (tbt && tbt.hidden === S.inTruck) tbt.hidden = !S.inTruck;
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

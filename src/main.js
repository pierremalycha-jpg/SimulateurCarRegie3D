import * as THREE from 'three';
import { S, emit, on, camById } from './state.js';
import { el, clamp, tc, mmss, fmt } from './util.js';
import { LIGHTING, TEAMS, STATION_INFO, CONTROLS_HELP } from './data.js';
import { buildWorld, applyLighting, updateWorld, paintTruckSign, standAt, W, TRUCK, blockedOutside, groundHeight, inTruckFootprint } from './world.js';
import { buildTruck, truckBlocked, truckFloorAt, updateTruck, updateTruckView, T } from './truck.js';
import { initTruckMap, updateTruckMap, openTruckPlan } from './ui/truckmap.js';
import { openSynoptics } from './ui/synoptics.js';
import { initMatch, buildPlayers, stepMatch, initRecorder, record, M } from './match.js';
import { loadPreset, lineUpCamera, updateRopes } from './bcam.js';
import { updateRF } from './rf.js';
import { initGfx, updateGfx } from './gfx.js';
import { initPipeline, renderPipeline, drawSlots, MIX, meSource, sourceLabel, defaultRouting, EVS, P, ROUTER } from './pipeline.js';
import { AU, startAudio, updateAudio, applyFaders } from './audio.js';
import { $, $$, toast, modal, openInfo, intercom } from './ui/common.js';
import { openStation, closeStation, updateStation, stationKey, ST } from './ui/stations.js';
import { initPlan, openPlan, closePlan, renderPlan, planPointer, planWheel, fitView, PLAN } from './ui/plan.js';
import { openGuide, checkMissions, drawMissionCard } from './ui/guide.js';
import { updateFaults, injectFault, ACTIVE, FAULTS, clearFaults } from './faults.js';
import { updateExercises, EX } from './exercises.js';
import { openDevice, openEquipmentIndex } from './equipment/viewer.js';
import { initShared, CFG, SH, setPerf } from './shared.js';
import { openTrainer } from './ui/config.js';
import { EQUIP, evsLayout, mixInputs } from './equip.js';
import { patchEmpty } from './patch.js';
import { updateScenario, SC } from './scenario.js';
import { updateNet, NET } from './ipnet.js';
import { FAB } from './net/fabric.js';
import { FORMATS } from './data.js';

// ----------------------------------------------------------------------------------
// Initialisation
// ----------------------------------------------------------------------------------
Object.assign(S, { simTime: 0, tcOffset: 20 * 3600 + 44 * 60 + 30, txPath: 1, showMission: true, autoLineup: true, showLabels: true, directorVoice: false, eyeExposure: 1 });
S.kickoffTOD = S.tcOffset + 4;
try { const q = localStorage.getItem('carregie.quality'); if (q) S.quality = q; } catch (e) { /* stockage indisponible */ }
if (/[?&]lite/.test(location.search)) { S.lite = true; S.quality = 'basse'; }

function fatal(msg) {
  const e = $('#err'); e.hidden = false; e.innerHTML = '';
  e.append(el('div', { class: 'sheet', style: { width: 'min(620px,100%)' } }, el('header', {}, el('h2', {}, 'Le simulateur ne peut pas démarrer')), el('div', { class: 'body prose' }, el('p', {}, msg), el('p', { class: 'note' }, 'Il faut un navigateur récent avec WebGL 2 (Chrome, Edge, Firefox, Safari 15+) et l\'accélération matérielle activée.'))));
}

// charge les polices avant de dessiner les textures (étiquettes, panneaux), sans bloquer plus de 2,5 s
try {
  await Promise.race([
    Promise.all(['600 40px "Saira Condensed"', '700 40px "Saira Condensed"', '600 16px "JetBrains Mono"', '500 16px "Barlow"'].map((f) => document.fonts.load(f))),
    new Promise((r) => setTimeout(r, 2500)),
  ]);
} catch (e) { /* polices indisponibles : polices de secours */ }

const canvas = $('#gl');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
} catch (e) { fatal('WebGL n\'est pas disponible sur cet appareil.'); throw e; }
if (!renderer.capabilities.isWebGL2) { fatal('Ce navigateur ne prend pas en charge WebGL 2.'); throw new Error('webgl2'); }
renderer.setPixelRatio(S.lite ? 0.5 : Math.min(window.devicePixelRatio || 1, S.quality === 'basse' ? 1 : 1.5));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false;
renderer.autoClear = true;

buildWorld(renderer);
initMatch(); buildPlayers(W.scene); initRecorder();
buildTruck();
initGfx();
applyLighting('jour');
initPipeline();
initPlan(W.scene);

const pcam = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 3000);
pcam.rotation.order = 'YXZ';
pcam.layers.enable(1); pcam.layers.enable(2);
const PL = { pos: new THREE.Vector3(-13, 0, -107.5), yaw: 0.25, pitch: 0.02, y: 1.7, fly: false, vy: 0 };
const KEYS = {};
const camopRT = { raw: null };

// ----------------------------------------------------------------------------------
// Écran d'accueil
// ----------------------------------------------------------------------------------
function buildStart() {
  const s = $('#start');
  const light = el('select', { id: 'stlight' }, ...Object.entries(LIGHTING).map(([k, v]) => el('option', { value: k }, v.label)));
  const qual = el('select', { id: 'stqual' }, el('option', { value: 'basse' }, 'Basse (ordinateur portable)'), el('option', { value: 'moyenne' }, 'Moyenne'), el('option', { value: 'haute' }, 'Haute (carte graphique dédiée)'));
  qual.value = S.quality;
  const snd = el('input', { type: 'checkbox', id: 'stsnd' }); snd.checked = true;
  const fmt = el('select', { id: 'stfmt' }, ...Object.entries(FORMATS).map(([k, v]) => el('option', { value: k }, v.label)));
  fmt.value = S.format;
  const infra = el('select', { id: 'stinfra' }, el('option', { value: 'sdi' }, 'Car SDI (grille coaxiale)'), el('option', { value: 'ip' }, 'Car IP (ST 2110, PTP, NMOS)'));
  const fmtNote = el('p', { class: 'note' });
  const updFmt = () => { S.format = fmt.value; paintTruckSign(CFG.car.name); fmtNote.textContent = `Avec ce format : ${evsLayout().label} ; mélangeur ${EQUIP.mixer} avec ${mixInputs()} entrées utilisées.`; };
  fmt.onchange = updFmt; updFmt();
  const go = (preset) => start(preset, light.value, qual.value, snd.checked, fmt.value, infra.value === 'ip');
  const truckLine = el('div', { class: 'eyebrow', id: 'sttruck' });
  const setTruck = () => { truckLine.textContent = [CFG.car.company, CFG.car.name].filter(Boolean).join(' · '); truckLine.hidden = !truckLine.textContent; updFmt(); };
  setTruck(); on('config', setTruck); on('shared', setTruck);
  const chain = ['Objectif', 'Caméra', 'Liaison', 'CCU', 'Grille', 'Mélangeur', 'Antenne'];
  s.append(el('div', { class: 'wrap' },
    el('div', { class: 'eyebrow' }, el('span', { class: 'rec' }), 'Simulateur de formation · OB · régie mobile'), truckLine,
    el('h1', {}, 'Car régie ', el('em', {}, '3D')),
    el('p', { class: 'lede' }, 'Placez vos caméras dans un stade inspiré de Bollaert-Delelis (Lens), choisissez les objectifs et les liaisons, suivez les câbles jusqu\'au car, puis prenez place à chaque poste : réalisation, mélangeur, vision, ralentis, son, HF, grille, transmission. Un match se joue en continu : tout ce que vous réglez se voit à l\'image, et chaque action est expliquée. Ouvrez le matériel (touche K) pour voir les faces avant et arrière des appareils, leurs connecteurs et le câblage de votre installation.'),
    el('div', { class: 'chain' }, ...chain.map((c, i) => el('div', {}, el('small', {}, String(i + 1).padStart(2, '0')), el('b', {}, c)))),
    el('div', { class: 'choices' },
      el('button', { class: 'choice main', onclick: () => go('standard') }, el('b', {}, 'Car prêt à l\'antenne'), el('span', {}, '12 caméras installées, câblées et réglées, dont 2 super ralentis, une Steadicam HF et une mini-caméra de but. Idéal pour découvrir les postes.')),
      el('button', { class: 'choice', onclick: () => go('vierge') }, el('b', {}, 'Installation pas à pas'), el('span', {}, 'Stade vide et missions guidées : vous montez le dispositif, câblez, réglez les caméras puis réalisez.')),
      el('button', { class: 'choice', onclick: () => go('grand') }, el('b', {}, 'Grand match · 16 caméras'), el('span', {}, 'Caméra volante, rail, grue, super ralenti 6x, deux Steadicam HF. Demande un ordinateur puissant.')),
      el('button', { class: 'choice', onclick: () => go('brassage') }, el('b', {}, 'Exercice : le car vide'), el('span', {}, 'Les caméras sont installées mais rien n\'est brassé : vous reliez chaque source à la grille, les sorties aux destinations et la référence aux CCU, liste de câblage en main.')),
      el('button', { class: 'choice', onclick: () => go('scenario') }, el('b', {}, 'Scénario : jour de match'), el('span', {}, 'Brassage, line-up, test de ligne avec la chaîne, puis le direct avec des pannes. Chronométré et noté, avec un compte rendu à la fin.'))),
    el('div', { class: 'opts' },
      el('div', { class: 'field' }, el('label', { for: 'stlight' }, 'Lumière'), light),
      el('div', { class: 'field' }, el('label', { for: 'stqual' }, 'Qualité graphique'), qual),
      el('div', { class: 'field' }, el('label', { for: 'stfmt' }, 'Format de production'), fmt),
      el('div', { class: 'field' }, el('label', { for: 'stinfra' }, 'Infrastructure'), infra),
      el('button', { class: 'btn', onclick: () => openTrainer('car') }, 'Espace formateur'),
      el('label', { class: 'item', for: 'stsnd', style: { padding: '6px 10px' } }, snd, el('span', {}, 'Son (ambiance, frappes, sifflet)'))),
    fmtNote,
    el('div', { class: 'keys' }, ...CONTROLS_HELP.map(([k, d]) => el('div', {}, el('kbd', {}, k), d))),
    el('p', { class: 'note' }, 'Les caractéristiques techniques (objectifs, portées de câbles, seuils HF, niveaux vidéo et audio) sont des ordres de grandeur réalistes, donnés à titre pédagogique. Les noms d\'équipements cités le sont comme exemples de matériel courant.')));
}

function start(preset, light, quality, sound, format = S.format, ip = false) {
  if (quality !== S.quality) setQuality(quality);
  S.format = format; S.ipMode = !!ip; paintTruckSign(CFG.car.name);
  applyLighting(light);
  if (preset === 'vierge') { loadPreset('none'); S.autoLineup = false; S.showMission = true; }
  else if (preset === 'brassage' || preset === 'scenario') { loadPreset('standard', preset !== 'scenario'); S.showMission = false; }
  else { loadPreset(preset, true); S.showMission = false; }
  defaultRouting(true);
  if (preset === 'brassage' || preset === 'scenario') { S.patch.on = true; patchEmpty(); }
  MIX.pgm = 1; MIX.pst = 2;
  if (preset !== 'vierge') { MIX.dsk1.on = true; MIX.dsk1.level = 1; }
  $('#start').hidden = true; $('#hud').hidden = false;
  S.mode = 'fps';
  if (sound) startAudio(); else { startAudio(); AU.muted = true; applyFaders(); }
  buildToolbar();
  if (preset === 'brassage') { emit('openStationNow', { id: 'brassage' }); toast('Car vide : brassez chaque liaison en suivant la liste de câblage. Le multiview montre le résultat.', '', 7000); }
  else if (preset === 'scenario') emit('startScenario');
  else if (preset === 'vierge') toast('Commencez par la mission en haut à gauche : découvrez le compound puis ouvrez le plan des caméras (P).', '', 6000);
  else toast('Vous êtes dans le compound, devant le car régie. Cliquez dans la vue pour regarder, avancez avec Z Q S D.', '', 6000);
  if (matchMedia('(pointer: coarse)').matches) setupTouch();
}

// ----------------------------------------------------------------------------------
// Barre d'outils et statut
// ----------------------------------------------------------------------------------
function buildToolbar() {
  const tb = $('#toolbar'); tb.innerHTML = '';
  const b = (label, key, fn, id) => el('button', { class: 'tbtn', id, onclick: fn }, label, key ? el('kbd', {}, key) : null);
  tb.append(
    b('Plan caméras', 'P', () => openPlan()),
    b('Aller à', 'T', () => teleportMenu()),
    b('Plan du car', 'Tab', () => openTruckPlan(), 'tb-truck'),
    b('Synoptiques', 'Y', () => openSynoptics()),
    b('Guide', 'G', () => openGuide('missions')),
    b('Matériel', 'K', () => openEquipmentIndex()),
    b('Vol libre', 'V', () => { PL.fly = !PL.fly; updToolbar(); }, 'tb-fly'),
    b('Retour PGM', 'M', () => { $('#minimon').hidden = !$('#minimon').hidden; }),
    b(AU.muted ? 'Son coupé' : 'Son', null, (e) => { startAudio(); AU.muted = !AU.muted; applyFaders(); e.currentTarget.firstChild.textContent = AU.muted ? 'Son coupé' : 'Son'; }));
}
function updToolbar() { const f = $('#tb-fly'); if (f) f.classList.toggle('on', PL.fly); }

let fpsAcc = 0, fpsN = 0, fpsShow = 0;
function updateStatus(dt) {
  fpsAcc += dt; fpsN++;
  if (fpsAcc > 0.5) { fpsShow = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; }
  if (S.frame % 6) return;
  const sb = $('#statusbar'); sb.innerHTML = '';
  const alarms = S.cams.filter((c) => !c.signalOK || !c.genlock).length + (EVS.recording ? 0 : 1) + ((S.faults.tx && S.txPath === 1) ? 1 : 0);
  sb.append(
    el('span', { class: 'chip' }, 'TC', el('b', {}, tc(S.tcOffset + S.simTime))),
    el('span', { class: 'chip' }, `${TEAMS[0].short} ${M.score[0]}-${M.score[1]} ${TEAMS[1].short}`, el('b', {}, mmss(M.clock))),
    el('span', { class: 'chip red' }, el('span', { class: 'dot red' }), 'PGM', el('b', {}, sourceLabel(meSource(MIX.pgm)))),
    el('span', { class: 'chip green' }, el('span', { class: 'dot green' }), 'PVW', el('b', {}, sourceLabel(meSource(MIX.pst)))),
    el('span', { class: 'chip' + (alarms ? ' red' : '') }, 'Alarmes', el('b', {}, String(alarms))),
    el('span', { class: 'chip' }, el('b', {}, fpsShow + ' i/s')));
  $('#minimon .lab').textContent = 'PGM · ' + sourceLabel(meSource(MIX.pgm));
  const w = $('#where'), w2 = $('#where2');
  const zone = whereAmI();
  w.textContent = zone[0]; w2.textContent = zone[1];
  const tbt = $('#tb-truck'); if (tbt) tbt.hidden = !S.inTruck;
}
function whereAmI() {
  const p = PL.pos;
  if (S.inTruck) {
    const lx = p.x - TRUCK.cx;
    if (lx < -5.4) return ['Car régie · son', 'Cabine isolée, console de mixage'];
    if (lx < -0.15) return ['Car régie · production', 'Réalisateur, scripte, truquiste, habillage, chef de car'];
    if (lx < 3.9) return ['Car régie · vision et ralentis', 'Ingénieurs vision (RCP), opérateurs EVS'];
    return ['Car régie · zone technique', 'Baies CCU, grille, synchro, transmission, HF'];
  }
  if (p.z < -95) return ['Compound', 'Parc technique : car régie, groupe, satellite'];
  if (Math.abs(p.x) < 61 && Math.abs(p.z) < 41) return ['Pelouse et bord terrain', 'Caméras basses, Steadicam, mini-caméras'];
  if (p.z < -41 && p.z > -95 && Math.abs(p.x) < 17) return ['Sous la tribune Lepagnot', 'Tunnel, vestiaires, local technique TV'];
  const sa = standAt(p.x, p.z);
  if (sa) return [sa.st.name, PL.fly ? 'Vol libre' : sa.st.id === 'marek' ? 'Marek en bas (kop debout), Xercès en haut' : sa.st.main ? 'Tribune principale : presse, loges, passerelle caméras' : 'Tribune derrière le but'];
  if (Math.abs(p.x) < 125 && Math.abs(p.z) < 110) return ['Stade Bollaert-Delelis (inspiration)', 'Angle ouvert, pylône du toit'];
  return ['Abords du stade', PL.fly ? 'Vol libre' : 'Cités minières, voie ferrée, terrils à l\'horizon'];
}

// ----------------------------------------------------------------------------------
// Téléportation
// ----------------------------------------------------------------------------------
const DESTS = [
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
function teleport(i) {
  const [, p, yaw, fly, truck] = DESTS[i];
  PL.pos.set(p[0], p[1], p[2]); PL.yaw = yaw; PL.pitch = DESTS[i][0].startsWith('Vue aérienne') ? -0.55 : 0; PL.fly = !!fly; S.inTruck = !!truck;
  PL.y = p[1] + 1.7; updToolbar();
}
function teleportMenu() {
  const list = el('div', { class: 'list' });
  DESTS.forEach((d, i) => list.appendChild(el('button', { class: 'item', style: { textAlign: 'left' }, onclick: () => { teleport(i); modal.close(); } }, el('div', { class: 'grow' }, el('div', { class: 't' }, d[0])))));
  const posts = el('div', { class: 'hwrow' });
  for (const st of T.stations) posts.append(el('button', { class: 'btn small', onclick: () => goToStation(st) }, st.label));
  modal.open('Aller à…', el('div', { class: 'list' }, list, el('h3', {}, 'Postes du car (on s\'y rend et on l\'ouvre)'), posts, el('button', { class: 'btn', onclick: () => openTruckPlan() }, 'Plan du car (Tab)')), { width: 620 });
}

// ----------------------------------------------------------------------------------
// Interactions
// ----------------------------------------------------------------------------------
let target = null;
function eyePos() { return new THREE.Vector3(PL.pos.x, PL.y, PL.pos.z); }
function findTarget() {
  const eye = eyePos();
  const dir = new THREE.Vector3(); pcam.getWorldDirection(dir);
  const cands = [];
  if (S.inTruck) {
    // dans le car : on prend le poste que l'on regarde (point visé : écran, pupitre ou baie)
    let best = null, bs = 1e9;
    for (const s of T.stations) {
      const v = s.look.clone().sub(eye); const d = v.length();
      const h = Math.hypot(s.pos.x - eye.x, s.pos.z - eye.z);
      if (d > 3.4 || h > s.r + 1.4) continue;
      const cos = v.normalize().dot(dir);
      if (cos < 0.8 && !(h < 0.45 && cos > 0.3)) continue;
      const sc = (1 - cos) * 6 + d * 0.25;
      if (sc < bs) { bs = sc; best = s; }
    }
    return best ? { ...best, kind: 'station' } : null;
  } else {
    for (const it of W.interactables) cands.push({ ...it, kind: it.action ? 'action' : 'info' });
    for (const c of S.cams) cands.push({ id: 'cam' + c.id, pos: c.cam.position.clone(), r: c.T.model === 'pov' ? 2 : 2.6, label: `Prendre la CAM ${c.id} (${c.T.short})`, kind: 'cam', cam: c, info: 'cadreur' });
  }
  let best = null, bs = 1e9;
  for (const c of cands) {
    const v = c.pos.clone().sub(eye); const d = v.length();
    if (d > c.r + 1.2) continue;
    const cos = d > 0.01 ? v.normalize().dot(dir) : 1;
    if (cos < 0.55 && d > 1.3) continue;
    const s = d * (2.2 - cos);
    if (s < bs) { bs = s; best = c; }
  }
  return best;
}
function act(t) {
  if (!t) return;
  if (t.kind === 'station') { goToStation(t); return; }
  if (t.kind === 'cam') { takeCamera(t.cam); return; }
  if (t.action === 'enterTruck') { teleport(1); toast('Vous êtes dans la régie production. Approchez-vous d\'un poste et appuyez sur E.'); return; }
  if (t.info) { openInfo(t.info); if (t.id.startsWith('ant:')) S.openedInfo.antenne = true; }
}
// se placer au poste (debout devant, tourné vers le pupitre) puis l'ouvrir
function goToStation(s, open = true) {
  if (S.mode === 'station') closeStation(true);
  if (S.modalOpen) modal.close();
  S.inTruck = true; PL.fly = false;
  PL.pos.set(s.pos.x, truckFloorAt(s.pos.x, s.pos.z), s.pos.z); PL.y = PL.pos.y + 1.7;
  PL.yaw = Math.atan2(-(s.look.x - s.pos.x), -(s.look.z - s.pos.z)); PL.pitch = -0.25;
  if (open) openStation(s.station, s.arg);
}
function updatePrompt() {
  const p = $('#prompt');
  if (S.mode !== 'fps' || S.modalOpen) { p.hidden = true; return; }
  target = findTarget();
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

// ----------------------------------------------------------------------------------
// Opérateur caméra (vue viseur)
// ----------------------------------------------------------------------------------
function takeCamera(cam) {
  if (!cam) return;
  if (S.mode === 'station') closeStation();
  if (S.mode === 'plan') closePlan();
  S.mode = 'camop'; S.camop = cam; cam.manual = true;
  if (cam.T.moving === 'touchline') cam.manualMove = true;
  const o = $('#camop'); o.hidden = false; o.innerHTML = '';
  o.append(el('div', { class: 'vf', 'data-gl': 'camop', id: 'vf' }), el('div', { class: 'safe' }), el('div', { class: 'safe2' }), el('div', { class: 'cross' }), el('div', { class: 'tally', id: 'vf-tally' }),
    el('div', { class: 'head', id: 'vf-head' }), el('div', { class: 'zoombar' }, el('i', { id: 'vf-zoom' })), el('div', { class: 'info', id: 'vf-info' }),
    el('div', { class: 'help' }, el('b', {}, 'Vous êtes cadreur'), el('br'), 'Souris : panoramique / inclinaison', el('br'), 'Molette ou + / − : zoom', el('br'), 'X : doubleur x2 · R (maintenu) : retour PGM', el('br'), cam.T.moving === 'touchline' ? 'Z Q S D : marcher avec la Steadicam' : '', cam.T.moving === 'touchline' ? el('br') : '', 'E ou Échap : rendre la caméra', el('br'),
      el('button', { class: 'btn small', style: { marginTop: '6px' }, onclick: () => releaseCamera() }, 'Rendre la caméra')));
  $('#hud').hidden = true;
  try { $('#input-layer').requestPointerLock(); } catch (e) { /* refus */ }
  intercom('RÉAL', `CAM ${cam.id}, je t'entends ? Cadre propre quand ton tally est rouge.`);
}
function releaseCamera() {
  const cam = S.camop; if (!cam) return;
  cam.manual = cam.role === 'manuel'; cam.manualMove = false;
  S.camop = null; S.mode = 'fps'; $('#camop').hidden = true; $('#hud').hidden = false;
}
let returnHeld = false;
function updateCamop(dt) {
  const c = S.camop; if (!c) return;
  if (c.manualMove) {
    const f = new THREE.Vector3(-Math.sin(c.yaw.v), 0, -Math.cos(c.yaw.v)), r = new THREE.Vector3(Math.cos(c.yaw.v), 0, -Math.sin(c.yaw.v));
    const mv = new THREE.Vector3();
    if (KEYS.KeyW || KEYS.ArrowUp) mv.add(f); if (KEYS.KeyS || KEYS.ArrowDown) mv.sub(f); if (KEYS.KeyD || KEYS.ArrowRight) mv.add(r); if (KEYS.KeyA || KEYS.ArrowLeft) mv.sub(r);
    if (mv.lengthSq()) {
      mv.normalize().multiplyScalar((KEYS.ShiftLeft || KEYS.ShiftRight ? 5.5 : 2.6) * dt);
      const p = c.cam.position;
      if (!blockedOutside(p.x + mv.x, p.z)) p.x += mv.x;
      if (!blockedOutside(p.x, p.z + mv.z)) p.z += mv.z;
      c.model.root.position.copy(p);
    }
  }
  if (KEYS.NumpadAdd || KEYS.Equal) c.lf.v = clamp(c.lf.v + dt * 1.2, Math.log(c.fMin), Math.log(c.fMax));
  if (KEYS.NumpadSubtract || KEYS.Minus || KEYS.Digit6) c.lf.v = clamp(c.lf.v - dt * 1.2, Math.log(c.fMin), Math.log(c.fMax));
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
  $('#vf').dataset.gl = returnHeld ? 'PGM' : 'camop';
  const t = c.tallyState;
  $('#vf-tally').className = 'tally ' + (t === 2 ? 'red' : t === 1 ? 'green' : '');
  if (S.frame % 4 === 0) {
    $('#vf-head').textContent = `CAM ${c.id} · ${c.T.short} · ${c.L.name}${returnHeld ? ' · RETOUR PGM' : ''}`;
    const zr = (Math.log(c.focal) - Math.log(c.fMin)) / Math.max(0.001, Math.log(c.fMax) - Math.log(c.fMin));
    $('#vf-zoom').style.bottom = `calc(${zr * 100}% - 2px)`;
    const inf = $('#vf-info'); inf.innerHTML = '';
    inf.append(el('span', {}, `${Math.round(c.focal)} mm${c.ext ? ' EX2' : ''}`), el('span', {}, `Angle ${fmt(c.hfov() * 180 / Math.PI, 1)}°`), el('span', {}, `F${fmt(c.effAperture(), 1)}`), el('span', {}, `${c.paint.gain > 0 ? '+' : ''}${c.paint.gain} dB · ND ${['CLR', '1/4', '1/8', '1/16', '1/64'][c.paint.nd]}`), el('span', {}, t === 2 ? '● À L\'ANTENNE' : t === 1 ? '● PRÉPARÉE' : '○'));
  }
}

// ----------------------------------------------------------------------------------
// Déplacements du joueur
// ----------------------------------------------------------------------------------
const joy = { x: 0, y: 0 };
function updatePlayer(dt) {
  const f = new THREE.Vector3(-Math.sin(PL.yaw), 0, -Math.cos(PL.yaw)), r = new THREE.Vector3(Math.cos(PL.yaw), 0, -Math.sin(PL.yaw));
  const mv = new THREE.Vector3();
  if (KEYS.KeyW || KEYS.ArrowUp) mv.add(f); if (KEYS.KeyS || KEYS.ArrowDown) mv.sub(f); if (KEYS.KeyD || KEYS.ArrowRight) mv.add(r); if (KEYS.KeyA || KEYS.ArrowLeft) mv.sub(r);
  mv.addScaledVector(f, -joy.y).addScaledVector(r, joy.x);
  const run = KEYS.ShiftLeft || KEYS.ShiftRight;
  if (PL.fly && S.inTruck) PL.fly = false;
  let sp = PL.fly ? (run ? 45 : 15) : (run ? 8.5 : 4.2);
  if (S.inTruck) sp = run ? 3.2 : 2.2;
  if (mv.lengthSq() > 1) mv.normalize();
  mv.multiplyScalar(sp * dt);
  const p = PL.pos;
  if (PL.fly) {
    p.add(mv);
    if (KEYS.Space) p.y += sp * dt; if (KEYS.KeyC || KEYS.ControlLeft) p.y -= sp * dt;
    p.y = Math.max(groundHeight(p.x, p.z), p.y);
    PL.y = p.y + 1.7;
    if (inTruckFootprint(p.x, p.z) && p.y < TRUCK.ceil) { p.y = TRUCK.ceil + 0.5; }
    return;
  }
  const blocked = (x, z) => S.inTruck ? truckBlocked(x, z) : blockedOutside(x, z);
  const nx = p.x + mv.x, nz = p.z + mv.z;
  // entrée dans le car par la porte
  if (!S.inTruck && inTruckFootprint(nx, nz) && nx > TRUCK.doorX0 && nx < TRUCK.doorX1 && nz > TRUCK.z1 - 0.6) { S.inTruck = true; p.x = nx; p.z = TRUCK.z1 - 0.35; }
  else if (S.inTruck && nz > TRUCK.z1 + 0.05) { S.inTruck = false; p.x = nx; p.z = nz; }
  else {
    const R = S.inTruck ? 0.24 : 0.28, D = R * 0.71;
    const ok = (x, z) => !blocked(x + R, z) && !blocked(x - R, z) && !blocked(x, z + R) && !blocked(x, z - R) && !blocked(x + D, z + D) && !blocked(x - D, z + D) && !blocked(x + D, z - D) && !blocked(x - D, z - D);
    // glissement le long des obstacles : on essaie le mouvement complet, puis chaque axe séparément
    if (ok(nx, nz)) { p.x = nx; p.z = nz; } else { if (ok(nx, p.z)) p.x = nx; else if (ok(p.x, nz)) p.z = nz; }
  }
  // gravité / sol (estrade dans le car)
  const g = S.inTruck ? truckFloorAt(p.x, p.z) : groundHeight(p.x, p.z);
  if (p.y > g + 0.05) { PL.vy -= 18 * dt; p.y = Math.max(g, p.y + PL.vy * dt); } else { PL.vy = 0; p.y += (g - p.y) * Math.min(1, dt * 14); }
  PL.y = p.y + 1.7;
}

// ----------------------------------------------------------------------------------
// Entrées clavier / souris / tactile
// ----------------------------------------------------------------------------------
const isTyping = (e) => e.target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName) && e.target.type !== 'range' && e.target.type !== 'checkbox';
window.addEventListener('keydown', (e) => {
  if (S.mode === 'start') return;
  if (modal.isOpen) { if (e.code === 'Escape') modal.close(); return; }
  if (isTyping(e) && e.code !== 'Escape') return;
  KEYS[e.code] = true;
  if (S.mode === 'station') {
    if (e.code === 'Escape') { closeStation(); e.preventDefault(); return; }
    if (stationKey(e)) e.preventDefault();
    return;
  }
  if (S.mode === 'plan') { if (e.code === 'Escape' || e.code === 'KeyP') closePlan(); return; }
  if (S.mode === 'camop') {
    if (e.code === 'KeyE' || e.code === 'Escape') { releaseCamera(); return; }
    if (e.code === 'KeyX' && S.camop.L.ext) { const c = S.camop; const f = c.focal; c.ext = !c.ext; c.lf.v = Math.log(clamp(c.ext ? f * 2 : f / 2, c.fMin, c.fMax)); toast(c.ext ? 'Doubleur x2 engagé : focale doublée, -2 diaphragmes' : 'Doubleur retiré'); }
    if (e.code === 'KeyR') returnHeld = true;
    if (e.key === '+') KEYS.Equal = true; if (e.key === '-') KEYS.Minus = true;
    e.preventDefault();
    return;
  }
  if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
  if (e.code === 'KeyE') act(target);
  if (e.code === 'KeyI' && target) { if (target.kind === 'cam') { openDevice('cam', target.cam.id); return; } const id = target.kind === 'station' ? target.station : target.info; if (id) openInfo(id); }
  if (e.code === 'KeyV') { PL.fly = !PL.fly; updToolbar(); toast(PL.fly ? 'Vol libre : Espace pour monter, C pour descendre' : 'Vol libre désactivé'); }
  if (e.code === 'KeyP') openPlan();
  if (e.code === 'KeyT') teleportMenu();
  if (e.code === 'KeyG') openGuide('missions');
  if (e.code === 'KeyH') openGuide('commandes');
  if (e.code === 'KeyK') { if (target && target.kind === 'station' && target.device) openDevice(target.device, 1); else openEquipmentIndex(); }
  if (e.code === 'Tab' && S.inTruck) { e.preventDefault(); if (document.pointerLockElement) document.exitPointerLock(); openTruckPlan(); }
  if (e.code === 'KeyY') openSynoptics();
  if (e.code === 'KeyM') $('#minimon').hidden = !$('#minimon').hidden;
});
window.addEventListener('keyup', (e) => { KEYS[e.code] = false; if (e.code === 'KeyR') returnHeld = false; if (e.key === '+') KEYS.Equal = false; if (e.key === '-') KEYS.Minus = false; });
window.addEventListener('blur', () => { for (const k in KEYS) KEYS[k] = false; });

const IL = $('#input-layer');
let dragLook = null;
IL.addEventListener('pointerdown', (e) => {
  if (S.mode === 'plan') { planPointer('down', e); IL.setPointerCapture(e.pointerId); return; }
  if (S.mode === 'fps' && document.pointerLockElement && e.button === 0 && target) { act(target); return; }
  if (S.mode === 'fps' || S.mode === 'camop') {
    if (e.pointerType === 'mouse' && !document.pointerLockElement) { try { const r = IL.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (err) { /* refus */ } }
    dragLook = { x: e.clientX, y: e.clientY, id: e.pointerId };
    IL.setPointerCapture(e.pointerId);
  }
});
IL.addEventListener('pointermove', (e) => {
  if (S.mode === 'plan') { planPointer('move', e); return; }
  if (dragLook && !document.pointerLockElement && dragLook.id === e.pointerId) { look(e.clientX - dragLook.x, e.clientY - dragLook.y, 2.2); dragLook.x = e.clientX; dragLook.y = e.clientY; }
});
IL.addEventListener('pointerup', (e) => { if (S.mode === 'plan') planPointer('up', e); dragLook = null; });
IL.addEventListener('wheel', (e) => {
  if (S.mode === 'plan') { e.preventDefault(); planWheel(e); }
  if (S.mode === 'camop' && S.camop) { e.preventDefault(); const c = S.camop; c.lf.v = clamp(c.lf.v - e.deltaY * 0.0012, Math.log(c.fMin), Math.log(c.fMax)); }
}, { passive: false });
document.addEventListener('mousemove', (e) => { if (document.pointerLockElement) look(e.movementX, e.movementY, 1); });
document.addEventListener('wheel', (e) => { if (document.pointerLockElement && S.mode === 'camop' && S.camop) { const c = S.camop; c.lf.v = clamp(c.lf.v - e.deltaY * 0.0012, Math.log(c.fMin), Math.log(c.fMax)); } }, { passive: true });
function look(dx, dy, mult) {
  if (S.mode === 'camop' && S.camop) {
    const c = S.camop; const s = 0.0016 * mult * (c.cam.fov / 40);
    c.yaw.v -= dx * s; c.pitch.v = clamp(c.pitch.v - dy * s, -1.3, 1.0);
    return;
  }
  if (S.mode !== 'fps') return;
  const s = 0.0022 * mult;
  PL.yaw -= dx * s; PL.pitch = clamp(PL.pitch - dy * s, -1.45, 1.45);
}

function setupTouch() {
  const t = $('#touch'); t.hidden = false; t.innerHTML = '';
  const j = el('div', { class: 'joy' }, el('i'));
  const knobEl = j.firstChild;
  let jid = null, c0 = null;
  j.addEventListener('pointerdown', (e) => { jid = e.pointerId; j.setPointerCapture(jid); const r = j.getBoundingClientRect(); c0 = [r.left + r.width / 2, r.top + r.height / 2]; e.stopPropagation(); });
  j.addEventListener('pointermove', (e) => { if (e.pointerId !== jid) return; const dx = clamp((e.clientX - c0[0]) / 50, -1, 1), dy = clamp((e.clientY - c0[1]) / 50, -1, 1); joy.x = dx; joy.y = dy; knobEl.style.transform = `translate(${dx * 40}px, ${dy * 40}px)`; });
  const end = () => { jid = null; joy.x = joy.y = 0; knobEl.style.transform = ''; };
  j.addEventListener('pointerup', end); j.addEventListener('pointercancel', end);
  const b = (l, fn) => el('button', { class: 'tbtn', style: { padding: '14px 18px', fontSize: '16px' }, onclick: fn }, l);
  t.append(j, el('div', { class: 'tact' }, b('E', () => act(target)), b('Monter', () => { PL.pos.y += 3; PL.fly = true; }), b('Info', () => target && (target.kind === 'cam' ? openDevice('cam', target.cam.id) : openInfo(target.kind === 'station' ? target.station : target.info)))));
}

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  pcam.aspect = window.innerWidth / window.innerHeight; pcam.updateProjectionMatrix();
});

// ----------------------------------------------------------------------------------
// Événements de l'application
// ----------------------------------------------------------------------------------
on('takeCamera', (c) => takeCamera(c));
on('openSynoptics', (t) => openSynoptics(t || 'video'));
on('openStationNow', ({ id, cam }) => {
  const st = T.stations.find((s) => s.station === id);
  if (st) { PL.pos.set(st.pos.x, TRUCK.floor, st.pos.z); S.inTruck = true; PL.y = TRUCK.floor + 1.7; }
  openStation(id, cam ? { cam } : 0);
});
on('openStationLater', (id) => setTimeout(() => { const st = T.stations.find((s) => s.station === id); if (st) { PL.pos.set(st.pos.x, TRUCK.floor, st.pos.z); S.inTruck = true; } openStation(id); }, 60));
on('setLighting', (v) => { applyLighting(v); toast(`${LIGHTING[v].label} : la lumière a changé, les ingénieurs vision doivent réajuster les iris (poste vision, ou AUTO IRIS).`, '', 6000); });
on('setLabels', (v) => { S.showLabels = v; if (v) pcam.layers.enable(1); else pcam.layers.disable(1); });
on('setQuality', (v) => setQuality(v));
on('match', (e) => { if (e.type === 'goal') toast(`BUT ! ${TEAMS[e.team].name} · ${e.score[0]}-${e.score[1]}`, 'good', 3500); });
function setQuality(v) {
  S.quality = v;
  try { localStorage.setItem('carregie.quality', v); } catch (e) { /* stockage indisponible */ }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, v === 'basse' ? 1 : 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  for (const c of S.cams) c.resizeRT();
  const sm = v === 'haute' ? 4096 : 2048;
  if (W.sun.shadow.mapSize.x !== sm) { W.sun.shadow.mapSize.set(sm, sm); if (W.sun.shadow.map) { W.sun.shadow.map.dispose(); W.sun.shadow.map = null; } }
}

// ----------------------------------------------------------------------------------
// Diagnostic de performance : mesure de la fluidité et carte graphique
// ----------------------------------------------------------------------------------
const QUAL_LABEL = { basse: 'Basse', moyenne: 'Moyenne', haute: 'Haute' };
function gpuName() {
  try {
    const gl = renderer.getContext(); const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const r = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    return String(r || 'inconnue').replace(/^ANGLE \((.*)\)$/, '$1').slice(0, 120);
  } catch (e) { return 'inconnue'; }
}
let perfRunning = false;
on('perfTest', () => {
  if (perfRunning) return;
  perfRunning = true;
  modal.close();
  const where = S.mode === 'station' ? 'dans un poste' : S.inTruck ? 'dans le car' : S.mode === 'fps' ? 'dans le stade' : 'sur l\'écran d\'accueil';
  toast('Mesure des performances pendant 6 secondes… ne touchez à rien.', '', 6000);
  const times = []; let prev = performance.now(); const t0 = prev;
  const tick = (now) => {
    times.push(now - prev); prev = now;
    if (now - t0 < 6000) { requestAnimationFrame(tick); return; }
    perfRunning = false;
    const ft = times.slice(10).sort((a, b) => a - b); // on ignore la mise en route
    const avg = ft.reduce((a, b) => a + b, 0) / Math.max(1, ft.length);
    const r1 = (v) => (v < 10 ? Math.round(v * 10) / 10 : Math.round(v));
    const fps = r1(1000 / avg); const low = r1(1000 / (ft[Math.min(ft.length - 1, Math.floor(ft.length * 0.99))] || avg));
    const gpu = gpuName(); const soft = /swiftshader|llvmpipe|software|basic render/i.test(gpu);
    const rec = soft || fps < 30 ? 'basse' : fps < 50 ? (S.quality === 'haute' ? 'moyenne' : S.quality) : (S.quality === 'basse' && fps >= 58 ? 'moyenne' : S.quality === 'moyenne' && fps >= 58 ? 'haute' : S.quality);
    setPerf({ fps, low, gpu, quality: S.quality, rec, where, px: `${renderer.domElement.width}×${renderer.domElement.height}` });
    const verdict = fps >= 50 ? ['ok', 'Fluide : le simulateur tourne bien sur cet ordinateur.'] : fps >= 30 ? ['warn', 'Correct, mais quelques saccades possibles dans les postes chargés (multiview, vision).'] : ['err', 'Trop lent pour un usage confortable.'];
    const kv = el('div', { class: 'kv' });
    for (const [k, v, cls] of [
      ['Images par seconde', `${String(fps).replace('.', ',')} i/s en moyenne · ${String(low).replace('.', ',')} i/s dans les 1 % d'images les plus lentes`, verdict[0]],
      ['Mesuré', where], ['Carte graphique', gpu + (soft ? ' (rendu logiciel : pas d\'accélération matérielle)' : '')],
      ['Qualité actuelle', QUAL_LABEL[S.quality]], ['Résolution de rendu', `${renderer.domElement.width} × ${renderer.domElement.height} px (rapport ${fmt(renderer.getPixelRatio(), 2)})`],
      ['Caméras simulées', `${S.cams.length} (chaque caméra est une image 3D rendue en plus)`],
    ]) kv.append(el('dt', {}, k), el('dd', { class: cls || '' }, v));
    const tips = el('ul', {});
    if (soft) tips.append(el('li', {}, 'Le navigateur n\'utilise pas la carte graphique : activez l\'accélération matérielle dans ses réglages, ou essayez un autre navigateur (Chrome, Edge, Firefox récents).'));
    if (fps < 50) tips.append(el('li', {}, 'Branchez l\'ordinateur portable sur secteur et fermez les autres onglets lourds (visio, vidéos).'), el('li', {}, 'Moins de caméras = moins d\'images à calculer : le dispositif « Léger » (écran d\'accueil) aide beaucoup.'), el('li', {}, 'Une fenêtre plus petite ou un écran moins défini réduit aussi la charge.'));
    const apply = rec !== S.quality ? el('button', { class: 'btn primary', onclick: () => { setQuality(rec); modal.close(); toast(`Qualité graphique : ${QUAL_LABEL[rec]}`, 'good'); } }, `Passer en qualité ${QUAL_LABEL[rec]} (recommandé)`) : null;
    modal.open('Diagnostic de performance', el('div', { class: 'list' }, el('p', { class: verdict[0] }, verdict[1]), kv,
      el('p', {}, rec !== S.quality ? `Qualité recommandée : ${QUAL_LABEL[rec]}.` : fps < 30 ? 'Vous êtes déjà en qualité Basse : suivez les conseils ci-dessous.' : `La qualité ${QUAL_LABEL[S.quality]} est adaptée à cet ordinateur.`),
      tips.children.length ? el('div', { class: 'prose' }, el('h3', {}, 'Pour gagner en fluidité'), tips) : null,
      el('p', { class: 'note' }, 'Ce résultat est enregistré avec votre progression : le formateur le voit dans son tableau de bord, utile pour repérer un poste de formation trop juste.'),
      el('div', { class: 'hwrow' }, apply, el('button', { class: 'btn', onclick: () => modal.close() }, 'Fermer'))), { width: 720 });
  };
  requestAnimationFrame(tick);
});
// alerte unique si la fluidité reste mauvaise
let slowT = 0, slowWarned = false;
function watchFps(dt) {
  if (slowWarned || S.mode === 'start' || perfRunning || !fpsShow) return;
  slowT = fpsShow < 22 && S.quality !== 'basse' ? slowT + dt : 0;
  if (slowT > 12) { slowWarned = true; toast('L\'affichage saccade. Guide → Réglages → « Tester les performances » pour trouver la bonne qualité graphique.', 'bad', 9000); }
}

// ----------------------------------------------------------------------------------
// Boucle principale
// ----------------------------------------------------------------------------------
let last = performance.now();
let rfAcc = 0, slowAcc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000; last = now;
  dt = clamp(dt, 0.001, 0.05);
  S.time += dt; S.frame++;
  stepMatch(dt);
  updateWorld(S.simTime);
  W.crowdMat.uniforms.uExcite.value.set(Math.min(1.2, M.excite[0]), Math.min(1.2, M.excite[1]));
  for (const c of S.cams) { c.update(dt); updateRopes(c); }
  record(S.cams);
  rfAcc += dt; if (rfAcc > 0.1) { updateRF(rfAcc); rfAcc = 0; }
  if (S.mode === 'fps') updatePlayer(dt);
  updateGfx(dt); { const pgm = meSource(MIX.pgm); updateAudio(dt, { pgmSrc: pgm, replay: (pgm === 'EVSA' || pgm === 'EVSB') && EVS.ch[pgm === 'EVSA' ? 0 : 1].playing, studioOnAir: pgm === 'STUDIO' }); } updateTruck(S.time); updateExercises(dt); updateScenario(dt); updateNet(dt, ROUTER.map, ROUTER.phase);
  slowAcc += dt; if (slowAcc > 0.5) { watchFps(slowAcc); slowAcc = 0; checkMissions(); updateFaults(); if (S.mode === 'fps') drawMissionCard(); }

  renderer.shadowMap.needsUpdate = S.quality !== 'basse' || S.frame % 2 === 0;
  renderer.toneMappingExposure = 1;
  if (S.mode !== 'start') renderPipeline(renderer, dt);
  renderer.setRenderTarget(null);

  if (S.mode === 'camop') { updateCamop(dt); renderer.setRenderTarget(null); }
  if (S.mode === 'fps' || S.mode === 'start') {
    pcam.position.set(PL.pos.x, PL.y, PL.pos.z);
    if (S.mode === 'start') { const a = S.time * 0.04; pcam.position.set(Math.cos(a) * 150, 70, Math.sin(a) * 125); pcam.lookAt(0, 0, 0); }
    else pcam.rotation.set(PL.pitch, PL.yaw, 0);
    renderer.setClearColor(0x000000, 1);
    renderer.toneMappingExposure = S.inTruck ? 1.0 : S.eyeExposure;
    renderer.render(S.inTruck ? T.scene : W.scene, pcam);
    if (S.mode === 'fps' && !$('#minimon').hidden) drawSlots(renderer, [$('#minimon')]);
    updatePrompt();
    if (S.inTruck) { const dir = new THREE.Vector3(); pcam.getWorldDirection(dir); updateTruckView(eyePos(), dir, target && target.kind === 'station' ? target.id : null, S.time); }
    updateTruckMap(PL);
  } else if (S.mode === 'plan') {
    renderPlan(renderer);
  } else {
    renderer.setClearColor(0x000000, 0); renderer.clear();
    if (S.mode === 'station') drawSlots(renderer, $$('#station [data-gl], #floatmon [data-gl]'));
    else if (S.mode === 'camop') drawSlots(renderer, [$('#vf')]);
  }
  if (S.mode === 'station') updateStation(dt);
  if (S.mode !== 'start') updateStatus(dt);
}

buildStart();
S.mode = 'start';
initTruckMap((st) => goToStation(st), () => PL);
initShared();
// la configuration du car peut arriver après le démarrage : on recalcule la répartition EVS
on('config', (part) => { if (part === 'car' && S.mode !== 'start') { defaultRouting(false); emit('router', {}); } updBrand(); });
function updBrand() { paintTruckSign(CFG.car.name); const w2 = $('#where2'); if (w2 && CFG.car.name && !S.inTruck) w2.textContent = CFG.car.name; }
document.fonts && document.fonts.ready.then(() => { W.boards && W.boards.redraw(); P.mvDirty = true; paintTruckSign(CFG.car.name); });
requestAnimationFrame(frame);
window.__S = S; // accès console pour le débogage
window.__dbg = { S, M, MIX, EVS, ROUTER, P, W, T, PL, EX, teleport, openStation, closeStation, openPlan, closePlan, takeCamera, releaseCamera, start, openGuide, renderer, applyLighting, openDevice, openEquipmentIndex, openTrainer, CFG, SH, AU, SC, NET, FAB, emit, injectFault, clearFaults, ACTIVE, FAULTS, truckBlocked, truckFloorAt, goToStation, TRUCK };

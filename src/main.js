import * as THREE from 'three';
import { S, emit, on, camById } from './state.js';
import { el, clamp, tc, mmss, fmt } from './util.js';
import { LIGHTING, TEAMS, STATION_INFO, CONTROLS_HELP } from './data.js';
import { buildWorld, applyLighting, setCloudQuality, updateWorld, paintTruckSign, standAt, W, TRUCK, blockedOutside, groundHeight, inTruckFootprint } from './world.js';
import { buildTruck, truckBlocked, truckFloorAt, updateTruck, updateTruckView, T } from './truck.js';
import { initTruckMap, updateTruckMap, openTruckPlan } from './ui/truckmap.js';
import { openSynoptics } from './ui/synoptics.js';
import { initRender, renderEye, upgradeScene, RENDER } from './render.js';
import { initMatch, buildPlayers, stepMatch, initRecorder, record, M } from './match.js';
import { loadPreset, lineUpCamera, updateRopes, PRESETS } from './bcam.js';
import { openReview } from './ui/review_ui.js';
import { SES, updateSession, followMatch, isFollower } from './multi/session.js';
import { openSessionPanel, setSessionStarter, updateSessionHud, trackMix } from './ui/session_ui.js';
import { updateRF } from './rf.js';
import { initGfx, updateGfx } from './gfx.js';
import { initPipeline, renderPipeline, drawSlots, MIX, meSource, sourceLabel, defaultRouting, EVS, P, ROUTER } from './pipeline.js';
import { AU, startAudio, updateAudio, applyFaders, applyAll, voiceGain, setMonitor, stripRms, corrNow, faderLin, avOk } from './audio.js';
import { updateCommentary, CMT } from './commentary.js';
import { updateAudioDesk } from './audiodesk.js';
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
import { updateCourse, NC } from './net/course.js';
import { AN } from './net/analyzer.js';
import { FORMATS } from './data.js';
import { commutKey, COMMUT } from './ui/commut.js';
import { AT, beginAtelier, atelierInput, atelierWheel, updateAtelier, endAtelier, atelierBlocks, ATELIER_DECK, atelierDebug } from './atelier.js';

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
    Promise.all(['600 40px "Barlow Condensed"', '700 40px "Barlow Condensed"', '600 16px "JetBrains Mono"', '500 16px "Barlow"'].map((f) => document.fonts.load(f))),
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
initRender(renderer, W, T);
applyLighting('jour');
initPipeline();
initPlan(W.scene);

const pcam = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 3000);
pcam.rotation.order = 'YXZ';
pcam.layers.enable(1); pcam.layers.enable(2);
const PL = { pos: new THREE.Vector3(-13, 0, -107.5), yaw: 0.25, pitch: 0.02, y: 1.7, fly: false, vy: 0, vel: new THREE.Vector3(), bob: 0, bobY: 0, roll: 0, fov: 70, cyaw: 0.25, cpitch: 0.02 };
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
  // session à plusieurs : on démarre le car prêt à l'antenne, avec les réglages de l'hôte s'il y en a déjà un
  setSessionStarter({
    cfg: () => ({ fmt: fmt.value, ip: infra.value === 'ip', light: light.value }),
    start: async () => {
      for (let i = 0; i < 25 && !(SES.hostPeer && !SES.hostPeer.sameTab && SES.hostPeer.presence.cfg); i++) await new Promise((r) => setTimeout(r, 120));
      const h = SES.hostPeer && !SES.hostPeer.sameTab && SES.hostPeer.presence.cfg;
      start('standard', h ? h.light : light.value, qual.value, snd.checked, h ? h.fmt : fmt.value, h ? !!h.ip : infra.value === 'ip');
    },
  });
  const truckLine = el('div', { class: 'cs-truck', id: 'sttruck' });
  const setTruck = () => { truckLine.textContent = [CFG.car.company, CFG.car.name].filter(Boolean).join(' · '); truckLine.hidden = !truckLine.textContent; updFmt(); };
  setTruck(); on('config', setTruck); on('shared', setTruck);
  // la journée d'un car régie : chaque mode du simulateur se place à son heure
  const slot = (time, phase, title, desc, label, preset, primary) => el('li', { class: 'cs-slot' + (primary ? ' main' : '') },
    el('time', {}, time),
    el('div', { class: 'cs-what' }, el('small', {}, phase), el('b', {}, title), el('span', {}, desc)),
    el('button', { class: 'btn' + (primary ? ' primary' : ''), onclick: () => go(preset) }, label));
  const field = (id, label, ctl) => el('div', { class: 'field' }, el('label', { for: id }, label), ctl);
  s.append(el('div', { class: 'callsheet' },
    el('header', { class: 'cs-head' },
      el('div', { class: 'cs-title' },
        el('span', { class: 'tape' }, 'Feuille de service'),
        el('h1', {}, 'Car régie 3D'),
        el('p', { class: 'lede' }, 'Simulateur de formation aux métiers du car régie. Un match se joue en continu dans un stade inspiré de Bollaert-Delelis : tout ce que vous réglez se voit à l\'image, chaque action est expliquée.')),
      el('dl', { class: 'cs-match' },
        el('dt', {}, 'Rencontre'), el('dd', {}, 'RC Lens – AS Rivière'),
        el('dt', {}, 'Lieu'), el('dd', {}, 'Stade Bollaert-Delelis (reconstitution)'),
        el('dt', {}, 'Antenne'), el('dd', {}, '20:45 · coup d\'envoi 21:00'),
        el('dt', {}, 'Chaîne du signal'), el('dd', { class: 'cs-chain' }, 'objectif → caméra → liaison → CCU → grille → mélangeur → antenne'),
        truckLine)),
    el('div', { class: 'cs-grid' },
      el('section', { class: 'cs-day', 'aria-labelledby': 'cs-day-h' },
        el('h2', { id: 'cs-day-h' }, 'Choisissez votre vacation'),
        el('ol', { class: 'cs-slots' },
          slot('08:00', 'Get-in', 'Installation pas à pas', 'Stade vide et missions guidées : placer les caméras, les câbler, les régler, puis réaliser.', 'Installer', 'vierge'),
          slot('09:30', 'Préparation caméras', 'Atelier de montage', 'Monter une caméra pièce par pièce : pied, tête fluide, adaptateur, objectif, viseur, commandes de zoom et de point, fibre.', 'Monter une caméra', 'atelier'),
          slot('11:00', 'Câblage', 'Le car vide', 'Rien n\'est brassé : reliez chaque source à la grille, les sorties aux destinations et la référence aux CCU, liste de câblage en main.', 'Brasser le car', 'brassage'),
          slot('17:30', 'Line-up · test de ligne', 'Jour de match', 'Brassage, line-up, test de ligne avec la chaîne, puis le direct avec des pannes. Chronométré, noté, avec un compte rendu.', 'Lancer le scénario', 'scenario'),
          slot('20:45', 'Antenne', 'Car prêt à l\'antenne', '12 caméras installées et réglées, 2 super ralentis, une Steadicam HF et une mini-caméra de but. Pour découvrir les postes.', 'Prendre l\'antenne', 'standard', true),
          slot('20:45', 'Antenne · grand dispositif', 'Grand match, 16 caméras', 'Caméra volante, rail, grue, super ralenti, deux Steadicam HF. Demande un ordinateur puissant.', 'Grand dispositif', 'grand'))),
      el('aside', { class: 'cs-side' },
        el('section', { class: 'cs-box' },
          el('h2', {}, 'Conditions de captation'),
          el('div', { class: 'cs-fields' },
            field('stlight', 'Lumière', light), field('stfmt', 'Format de production', fmt),
            field('stinfra', 'Infrastructure', infra), field('stqual', 'Qualité graphique', qual)),
          el('label', { class: 'cs-check', for: 'stsnd' }, snd, el('span', {}, 'Son : ambiance, frappes, sifflet, commentaires')),
          fmtNote),
        el('section', { class: 'cs-box' },
          el('h2', {}, 'Équipe et formation'),
          el('button', { class: 'btn primary', title: 'Plusieurs stagiaires dans le même car, en direct, avec un formateur', onclick: () => openSessionPanel() }, 'Session à plusieurs'),
          el('div', { class: 'cs-row' },
            el('button', { class: 'btn', onclick: () => openTrainer('car') }, 'Espace formateur'),
            el('button', { class: 'btn', title: 'Pour les experts métier : valider ou corriger chaque point technique du simulateur', onclick: () => openReview('me') }, 'Relecture technique (experts)'))),
        el('details', { class: 'cs-box cs-keys' },
          el('summary', {}, 'Commandes clavier'),
          el('div', { class: 'keys' }, ...CONTROLS_HELP.map(([k, d]) => el('div', {}, el('kbd', {}, k), el('span', {}, d))))))),
    el('p', { class: 'note cs-foot' }, 'Simulation non officielle, sans lien avec le club ni avec les constructeurs cités. Les caractéristiques techniques (objectifs, portées de câbles, seuils HF, niveaux vidéo et audio) sont des ordres de grandeur réalistes, donnés à titre pédagogique ; les noms d\'équipements sont des exemples de matériel courant.')));
}

function start(preset, light, quality, sound, format = S.format, ip = false) {
  if (quality !== S.quality) setQuality(quality);
  S.format = format; S.ipMode = !!ip; paintTruckSign(CFG.car.name);
  applyLighting(light);
  if (preset === 'vierge') { loadPreset('none'); S.autoLineup = false; S.showMission = true; }
  else if (preset === 'brassage' || preset === 'scenario') { loadPreset('standard', preset !== 'scenario'); S.showMission = false; }
  else if (preset === 'atelier') { loadPreset('standard', true); S.showMission = false; }
  else if (preset === 'standard' && Array.isArray(CFG.car.camPreset) && CFG.car.camPreset.length) { PRESETS.car = CFG.car.camPreset; loadPreset('car', true); S.showMission = false; }
  else { loadPreset(preset, true); S.showMission = false; }
  defaultRouting(true);
  if (preset === 'brassage' || preset === 'scenario') { S.patch.on = true; patchEmpty(); }
  MIX.pgm = 1; MIX.pst = 2;
  if (preset === 'atelier') { MIX.pgm = 2; MIX.pst = 3; } // la 1 est démontée : l'antenne reste sur la 2
  if (preset !== 'vierge') { MIX.dsk1.on = true; MIX.dsk1.level = 1; }
  $('#start').hidden = true; $('#hud').hidden = false;
  S.mode = 'fps';
  if (sound) startAudio(); else { startAudio(); AU.muted = true; applyFaders(); }
  buildToolbar();
  if (preset === 'brassage') { emit('openStationNow', { id: 'brassage' }); toast('Car vide : brassez chaque liaison en suivant la liste de câblage. Le multiview montre le résultat.', '', 7000); }
  else if (preset === 'scenario') emit('startScenario');
  else if (preset === 'atelier') emit('startAtelier');
  else if (preset === 'vierge') toast('Commencez par la mission en haut à gauche : découvrez le compound puis ouvrez le plan des caméras (P).', '', 6000);
  else toast('Vous êtes dans le compound, devant le car régie. Cliquez dans la vue pour regarder, avancez avec Z Q S D.', '', 6000);
  if (matchMedia('(pointer: coarse)').matches) setupTouch();
  showOnboarding();
}

// première prise en main : les six gestes de base, affichés une fois (mémorisé dans ce navigateur)
function showOnboarding() {
  let seen = false; try { seen = localStorage.getItem('carregie.onboard') === '1'; } catch (e) { /* stockage indisponible */ }
  if (seen || $('#onboard')) return;
  const touch = matchMedia('(pointer: coarse)').matches;
  const rows = touch
    ? [['Pouce gauche', 'se déplacer'], ['Glisser', 'regarder'], ['Bouton action', 'utiliser ce que vous visez'], ['Aller à', 'se téléporter devant un poste']]
    : [['Z Q S D', 'se déplacer (flèches aussi)'], ['Souris', 'regarder : cliquez d\'abord dans la vue'], ['E', 'utiliser ce que vous visez'], ['T', 'aller directement à un endroit'], ['1 – 9', 'commuter une caméra à l\'antenne'], ['G', 'guide, missions et glossaire']];
  const close = () => { box.remove(); try { localStorage.setItem('carregie.onboard', '1'); } catch (e) { /* stockage indisponible */ } };
  const box = el('div', { id: 'onboard', role: 'dialog', 'aria-label': 'Prise en main' },
    el('span', { class: 'tape' }, 'Prise en main'),
    el('ul', {}, ...rows.map(([k, d]) => el('li', {}, el('kbd', {}, k), el('span', {}, d)))),
    el('button', { class: 'btn small primary', onclick: close }, 'Compris'));
  $('#hud').appendChild(box);
}

// ----------------------------------------------------------------------------------
// Barre d'outils et statut
// ----------------------------------------------------------------------------------
function buildToolbar() {
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
    sep(),
    b('Retour PGM', 'M', () => { $('#minimon').hidden = !$('#minimon').hidden; }),
    b(AU.muted ? 'Son coupé' : 'Son', null, (e) => { startAudio(); AU.muted = !AU.muted; applyFaders(); e.currentTarget.querySelector('.tl').textContent = AU.muted ? 'Son coupé' : 'Son'; }),
    b('Session', null, () => openSessionPanel(), 'tb-ses', 'Session à plusieurs'));
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
    el('span', { class: 'chip tc' }, 'TC', el('b', {}, tc(S.tcOffset + S.simTime))),
    el('span', { class: 'chip' }, `${TEAMS[0].short} ${M.score[0]}-${M.score[1]} ${TEAMS[1].short}`, el('b', {}, mmss(M.clock))),
    el('span', { class: 'chip red' }, el('span', { class: 'dot red' }), 'PGM', el('b', {}, sourceLabel(meSource(MIX.pgm)))),
    el('span', { class: 'chip green' }, el('span', { class: 'dot green' }), 'PVW', el('b', {}, sourceLabel(meSource(MIX.pst)))),
    el('span', { class: 'chip' + (alarms ? ' alarm' : '') }, 'Alarmes', el('b', {}, String(alarms))),
    el('span', { class: 'chip fps', title: 'Images par seconde du rendu' }, el('b', {}, fpsShow + ' i/s')));
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
  if (p.y > 15 && !PL.fly && p.z < -66 && p.z > -71.5 && Math.abs(p.x) < 41) return ['Passerelle caméras', AT.active ? 'Atelier de montage · CAM 1' : 'Tribune Lepagnot, au-dessus des loges'];
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
  PL.y = p[1] + 1.7; PL.vel.set(0, 0, 0); PL.cyaw = PL.yaw; PL.cpitch = PL.pitch;
  // retour à l'atelier : à pied sur la passerelle
  if (AT.active && fly) { PL.fly = false; if (onDeck()) { PL.pos.y = ATELIER_DECK.y; PL.y = PL.pos.y + 1.7; } else PL.fly = true; }
  updToolbar();
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
  PL.yaw = Math.atan2(-(s.look.x - s.pos.x), -(s.look.z - s.pos.z)); PL.pitch = -0.25; PL.vel.set(0, 0, 0);
  if (open) openStation(s.station, s.arg);
}
function updatePrompt() {
  const p = $('#prompt');
  if (S.mode !== 'fps' || S.modalOpen) { p.hidden = true; if (AT.active) AT._tk = '#'; return; }
  if (AT.active && onDeck()) { target = null; return; } // l'atelier gère sa propre visée
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
  cam.tgt = { yaw: cam.yaw.v, pitch: cam.pitch.v, lf: cam.lf.v }; // consignes : la tête fluide les rejoint avec un léger amorti
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
// atelier de montage : on marche sur la passerelle (sol à 17,2 m), entre les flight cases et le garde-corps
const onDeck = () => !PL.fly && PL.pos.y > 15 && PL.pos.x > ATELIER_DECK.x0 && PL.pos.x < ATELIER_DECK.x1 && PL.pos.z > ATELIER_DECK.z0 && PL.pos.z < ATELIER_DECK.z1;
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
  // inertie : la vitesse rejoint la consigne en douceur (accélération / freinage), plus « planant » en vol
  const target = mv.multiplyScalar(sp);
  const acc = PL.fly ? 2.6 : S.inTruck ? 11 : 8;
  if (PL.fly) target.y = ((KEYS.Space ? 1 : 0) - (KEYS.KeyC || KEYS.ControlLeft ? 1 : 0)) * sp * 0.8;
  else target.y = 0;
  PL.vel.lerp(target, 1 - Math.exp(-acc * dt));
  if (!PL.fly) PL.vel.y = 0;
  const step = PL.vel.clone().multiplyScalar(dt);
  const p = PL.pos;
  const hs = Math.hypot(PL.vel.x, PL.vel.z);
  // roulis léger en vol quand on se décale sur le côté, FOV élargi à grande vitesse
  const side = PL.vel.dot(r) / Math.max(1, sp);
  PL.roll += ((PL.fly ? -side * 0.06 : 0) - PL.roll) * Math.min(1, dt * 4);
  PL.fov += (70 + (PL.fly ? Math.min(8, hs / 6) : run && hs > 5 ? 4 : 0) - PL.fov) * Math.min(1, dt * 3);
  if (PL.fly) {
    p.add(step);
    p.y = Math.max(groundHeight(p.x, p.z), p.y);
    PL.y = p.y + 1.7; PL.bobY *= 0.9;
    if (inTruckFootprint(p.x, p.z) && p.y < TRUCK.ceil) { p.y = TRUCK.ceil + 0.5; }
    return;
  }
  const deck = AT.active && onDeck();
  const blocked = (x, z) => S.inTruck ? truckBlocked(x, z) : deck ? atelierBlocks(x, z) : blockedOutside(x, z);
  const nx = p.x + step.x, nz = p.z + step.z;
  // entrée dans le car par la porte
  if (!S.inTruck && inTruckFootprint(nx, nz) && nx > TRUCK.doorX0 && nx < TRUCK.doorX1 && nz > TRUCK.z1 - 0.6) { S.inTruck = true; p.x = nx; p.z = TRUCK.z1 - 0.35; }
  else if (S.inTruck && nz > TRUCK.z1 + 0.05) { S.inTruck = false; p.x = nx; p.z = nz; }
  else {
    const R = S.inTruck ? 0.24 : 0.28, D = R * 0.71;
    const ok = (x, z) => !blocked(x + R, z) && !blocked(x - R, z) && !blocked(x, z + R) && !blocked(x, z - R) && !blocked(x + D, z + D) && !blocked(x - D, z + D) && !blocked(x + D, z - D) && !blocked(x - D, z - D);
    // glissement le long des obstacles : on essaie le mouvement complet, puis chaque axe séparément (la vitesse bloquée s'annule)
    if (ok(nx, nz)) { p.x = nx; p.z = nz; } else if (ok(nx, p.z)) { p.x = nx; PL.vel.z = 0; } else if (ok(p.x, nz)) { p.z = nz; PL.vel.x = 0; } else { PL.vel.x = 0; PL.vel.z = 0; }
  }
  // gravité / sol (estrade dans le car)
  const g = S.inTruck ? truckFloorAt(p.x, p.z) : deck ? ATELIER_DECK.y : groundHeight(p.x, p.z);
  if (p.y > g + 0.05) { PL.vy -= 18 * dt; p.y = Math.max(g, p.y + PL.vy * dt); } else { PL.vy = 0; p.y += (g - p.y) * Math.min(1, dt * 14); }
  // balancement de la marche (discret, plus faible dans le car)
  if (hs > 0.25) PL.bob += dt * (5.2 + hs * 0.9);
  const amp = (S.inTruck ? 0.012 : 0.028) * Math.min(1, hs / 4);
  PL.bobY += (Math.abs(Math.sin(PL.bob)) * amp - amp * 0.5 - PL.bobY) * Math.min(1, dt * 12);
  PL.y = p.y + 1.7 + PL.bobY;
}

// ----------------------------------------------------------------------------------
// Entrées clavier / souris / tactile
// ----------------------------------------------------------------------------------
const isTyping = (e) => e.target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName) && e.target.type !== 'range' && e.target.type !== 'checkbox';
window.addEventListener('keydown', (e) => {
  if (modal.isOpen) { if (e.code === 'Escape') modal.close(); return; }
  if (S.mode === 'start') return;
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
    if (e.code === 'KeyX' && S.camop.L.ext) { const c = S.camop; const f = c.focal; c.ext = !c.ext; c.lf.v = Math.log(clamp(c.ext ? f * 2 : f / 2, c.fMin, c.fMax)); if (c.tgt) c.tgt.lf = c.lf.v; toast(c.ext ? 'Doubleur x2 engagé : focale doublée, -2 diaphragmes' : 'Doubleur retiré'); }
    if (e.code === 'KeyR') returnHeld = true;
    if (e.key === '+') KEYS.Equal = true; if (e.key === '-') KEYS.Minus = true;
    e.preventDefault();
    return;
  }
  if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
  if (AT.active && onDeck() && (e.code === 'KeyE' || e.code === 'KeyQ')) { if (!e.repeat) atelierInput('down', e.code); return; }
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
  if (commutKey(e, 'fps')) e.preventDefault();
});
// un clic de souris sur un bouton d'un poste ne doit pas lui laisser le focus : sinon Espace ou Entrée
// (CUT, AUTO) « recliquerait » ce bouton en plus du raccourci
document.addEventListener('click', (e) => { const b = e.target && e.target.closest && e.target.closest('button'); if (b && e.detail > 0 && S.mode === 'station') b.blur(); });
window.addEventListener('keyup', (e) => { KEYS[e.code] = false; if (e.code === 'KeyE' && AT.active) atelierInput('up', 'KeyE'); if (e.code === 'KeyR') returnHeld = false; if (e.key === '+') KEYS.Equal = false; if (e.key === '-') KEYS.Minus = false; });
window.addEventListener('blur', () => { for (const k in KEYS) KEYS[k] = false; if (AT.active) atelierInput('up', 'KeyE'); });

const IL = $('#input-layer');
let dragLook = null;
IL.addEventListener('pointerdown', (e) => {
  if (S.mode === 'plan') { planPointer('down', e); IL.setPointerCapture(e.pointerId); return; }
  if (S.mode === 'fps' && document.pointerLockElement && e.button === 0 && AT.active && onDeck()) { atelierInput('down', 'Mouse0'); return; }
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
IL.addEventListener('pointerup', (e) => { if (S.mode === 'plan') planPointer('up', e); if (AT.active && e.button === 0) atelierInput('up', 'Mouse0'); dragLook = null; });
IL.addEventListener('wheel', (e) => {
  if (S.mode === 'plan') { e.preventDefault(); planWheel(e); }
  if (S.mode === 'camop' && S.camop) { e.preventDefault(); const c = S.camop; if (c.tgt) c.tgt.lf = clamp(c.tgt.lf - e.deltaY * 0.0012, Math.log(c.fMin), Math.log(c.fMax)); }
  if (S.mode === 'fps' && !document.pointerLockElement && AT.active && atelierWheel(e.deltaY)) e.preventDefault();
}, { passive: false });
document.addEventListener('mousemove', (e) => { if (document.pointerLockElement) look(e.movementX, e.movementY, 1); });
document.addEventListener('wheel', (e) => { if (document.pointerLockElement && S.mode === 'fps' && AT.active) atelierWheel(e.deltaY); if (document.pointerLockElement && S.mode === 'camop' && S.camop && S.camop.tgt) { const c = S.camop; c.tgt.lf = clamp(c.tgt.lf - e.deltaY * 0.0012, Math.log(c.fMin), Math.log(c.fMax)); } }, { passive: true });
function look(dx, dy, mult) {
  if (S.mode === 'camop' && S.camop) {
    const c = S.camop; const s = 0.0016 * mult * (c.cam.fov / 40);
    if (!c.tgt) c.tgt = { yaw: c.yaw.v, pitch: c.pitch.v, lf: c.lf.v };
    c.tgt.yaw -= dx * s; c.tgt.pitch = clamp(c.tgt.pitch - dy * s, -1.3, 1.0);
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
  // atelier : E se maintient (lever, nettoyer), « Reposer » remplace la touche Q
  const eb = b('E', () => { if (!(AT.active && onDeck())) act(target); });
  eb.addEventListener('pointerdown', () => { if (AT.active && onDeck()) atelierInput('down', 'KeyE'); });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) eb.addEventListener(ev, () => { if (AT.active) atelierInput('up', 'KeyE'); });
  const qb = b('Reposer', () => atelierInput('down', 'KeyQ')); qb.hidden = !AT.active;
  on('atelier', (e) => { qb.hidden = e.type === 'end'; });
  t.append(j, el('div', { class: 'tact' }, eb, qb, b('Monter', () => { PL.pos.y += 3; PL.fly = true; }), b('Info', () => target && (target.kind === 'cam' ? openDevice('cam', target.cam.id) : openInfo(target.kind === 'station' ? target.station : target.info)))));
}

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  pcam.aspect = window.innerWidth / window.innerHeight; pcam.updateProjectionMatrix();
});

// ----------------------------------------------------------------------------------
// Événements de l'application
// ----------------------------------------------------------------------------------
on('takeCamera', (c) => takeCamera(c));
on('startAtelier', () => beginAtelier({
  place: (x, y, z, yaw, pitch = -0.15) => { PL.fly = false; S.inTruck = false; PL.pos.set(x, y, z); PL.y = y + 1.7; PL.yaw = PL.cyaw = yaw; PL.pitch = PL.cpitch = pitch; PL.vel.set(0, 0, 0); PL.vy = 0; updToolbar(); },
  intercom,
}));
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
  S.quality = v; setCloudQuality(v);
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
// plan proche adaptatif : la précision du tampon de profondeur dépend du rapport far / near. Avec un plan
// proche à 5 cm, deux surfaces distantes de quelques centimètres « clignotent » dès 100 m (z-fighting) ;
// on le recule quand on vole haut (rien n'est alors à portée de main) et on le rapproche dans le car.
function updateNear() {
  let n = 0.1;
  if (S.mode === 'start') n = 2;
  else if (S.inTruck) n = 0.04;
  else if (PL.fly) n = clamp(0.1 + Math.max(0, PL.pos.y - 6) * 0.03, 0.1, 4);
  if (Math.abs(pcam.near - n) > 0.004) { pcam.near = n; pcam.updateProjectionMatrix(); }
}
function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000; last = now;
  const realDt = Math.max(0.001, dt); // le compteur d'images par seconde mesure le temps réel, pas le pas de simulation borné
  dt = clamp(dt, 0.001, 0.05);
  S.time += dt; S.frame++;
  if (isFollower()) followMatch(dt); else stepMatch(dt);
  updateWorld(S.simTime);
  W.crowdMat.uniforms.uExcite.value.set(Math.min(1.2, M.excite[0]), Math.min(1.2, M.excite[1]));
  for (const c of S.cams) { c.update(dt); updateRopes(c); }
  record(S.cams);
  rfAcc += dt; if (rfAcc > 0.1) { updateRF(rfAcc); rfAcc = 0; }
  if (S.mode === 'fps') updatePlayer(dt);
  updateGfx(dt); { const pgm = meSource(MIX.pgm); updateAudio(dt, { pgmSrc: pgm, replayA: EVS.ch[0].playing, replayB: EVS.ch[1] && EVS.ch[1].playing, studioOnAir: pgm === 'STUDIO' }); updateCommentary(dt, { pgmSrc: pgm, replay: (pgm === 'EVSA' || pgm === 'EVSB') && EVS.ch[pgm === 'EVSA' ? 0 : 1].playing, studioOnAir: pgm === 'STUDIO' }); } updateTruck(S.time); updateExercises(dt); updateScenario(dt); updateNet(dt, ROUTER.map, ROUTER.phase); updateCourse(dt); updateSession(dt); trackMix(); if (S.frame % 10 === 0) updateSessionHud();
  slowAcc += dt; if (slowAcc > 0.5) { watchFps(slowAcc); slowAcc = 0; checkMissions(); updateFaults(); if (S.mode === 'fps') drawMissionCard(); }

  // matériaux ajoutés en cours de route (caméras posées, appareils) : conversion physique
  if (S.frame % 90 === 0) upgradeScene(W.scene); else if (S.frame % 90 === 45) upgradeScene(T.scene, true);
  renderer.shadowMap.needsUpdate = S.quality !== 'basse' || S.frame % 2 === 0;
  renderer.toneMappingExposure = 1;
  if (S.mode !== 'start') renderPipeline(renderer, dt);
  renderer.setRenderTarget(null);

  if (S.mode === 'camop') { updateCamop(dt); renderer.setRenderTarget(null); }
  if (S.mode === 'fps' || S.mode === 'start') {
    updateNear();
    pcam.position.set(PL.pos.x, PL.y, PL.pos.z);
    if (S.mode === 'start') { const a = S.time * 0.04; pcam.position.set(Math.cos(a) * 150, 70, Math.sin(a) * 125); pcam.lookAt(0, 0, 0); }
    else {
      // regard lissé (quelques centièmes de seconde) : plus doux à l'œil, sans retard perceptible ; saut direct après une téléportation
      let dy = PL.yaw - PL.cyaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      if (Math.abs(dy) > 0.8 || Math.abs(PL.pitch - PL.cpitch) > 0.8) { PL.cyaw = PL.yaw; PL.cpitch = PL.pitch; }
      const k = 1 - Math.exp(-dt * 28); PL.cyaw += dy * k; PL.cpitch += (PL.pitch - PL.cpitch) * k;
      pcam.rotation.set(PL.cpitch, PL.cyaw, S.mode === 'fps' ? PL.roll : 0);
      if (Math.abs(pcam.fov - PL.fov) > 0.05) { pcam.fov = PL.fov; pcam.updateProjectionMatrix(); }
    }
    if (AT.active && S.mode === 'fps') { pcam.updateMatrixWorld(); updateAtelier(dt, pcam); }
    // étiquettes des caméras masquées pendant le montage : à 2 m, elles boucheraient la vue
    { const lab = S.showLabels && !(AT.active && onDeck()); if (lab !== pcam.layers.isEnabled(1)) { if (lab) pcam.layers.enable(1); else pcam.layers.disable(1); } }
    renderer.setClearColor(0x000000, 1);
    renderEye(renderer, S.inTruck ? T.scene : W.scene, pcam, S.inTruck ? (RENDER.pbr ? 1.2 : 1.0) : S.eyeExposure, S.inTruck);
    if (S.mode === 'fps' && !$('#minimon').hidden) drawSlots(renderer, [$('#minimon')]);
    updatePrompt();
    if (S.inTruck && PL.pos.x - TRUCK.cx < -3) updateAudioDesk(AU, dt, faderLin);
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
  if (S.mode !== 'start') updateStatus(realDt);
  if (AT.active && S.frame % 10 === 0) { const ap = $('#atelier'); if (ap) ap.hidden = S.mode !== 'fps'; }
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
window.__dbg = { RENDER, openReview, openSessionPanel, SES, S, M, MIX, EVS, ROUTER, P, W, T, PL, pcam, COMMUT, CMT, applyAudio: applyAll, voiceGain, setMonitor, stripRms, corrNow, EX, teleport, openStation, closeStation, openPlan, closePlan, takeCamera, releaseCamera, start, openGuide, renderer, applyLighting, openDevice, openEquipmentIndex, openTrainer, CFG, SH, AU, SC, NET, FAB, NC, AN, emit, injectFault, clearFaults, ACTIVE, FAULTS, truckBlocked, truckFloorAt, goToStation, TRUCK, AT, atelierDebug, beginAtelier, endAtelier, avOk };

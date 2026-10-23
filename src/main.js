// @ts-check
import * as THREE from 'three';
import { S, emit, on } from './state.js';
import { clamp, el } from './util.js';
import { LIGHTING } from './data/exposure.js';
import { TEAMS } from './data/match.js';
import { buildWorld, applyLighting, updateWorld, paintTruckSign, W, TRUCK } from './world.js';
import { buildTruck, truckBlocked, truckFloorAt, updateTruck, updateTruckView, T } from './truck.js';
import { initTruckMap, updateTruckMap } from './ui/truckmap.js';
import { openSynoptics } from './ui/synoptics.js';
import { initRender, renderEye, upgradeScene, RENDER } from './render.js';
import { initMatch, buildPlayers, stepMatch, initRecorder, record, M } from './match.js';
import { updateRopes } from './bcam.js';
import { openReview } from './ui/review_ui.js';
import { SES, updateSession, followMatch, isFollower, setAvatarSource } from './multi/session.js';
import { initAvatars, updateAvatars, avatarPositions, AVATARS } from './multi/avatars.js';
import { openSessionPanel, updateSessionHud, trackMix, setRolePostHandler } from './ui/session_ui.js';
import { updateRF } from './rf.js';
import { initGfx, updateGfx } from './gfx.js';
import { initPipeline, renderPipeline, drawSlots, MIX, meSource, defaultRouting, EVS, P, ROUTER } from './pipeline.js';
import { AU, updateAudio, applyAll, voiceGain, setMonitor, stripRms, corrNow, faderLin, avOk } from './audio.js';
import { updateCommentary, CMT } from './commentary.js';
import { updateAudioDesk } from './audiodesk.js';
import { $, $$, toast, intercom } from './ui/common.js';
import { openStation, closeStation, updateStation, ST } from './ui/stations.js';
import { initPlan, openPlan, closePlan, renderPlan } from './ui/plan.js';
import { openGuide, checkMissions, drawMissionCard } from './ui/guide.js';
import { updateFaults, injectFault, ACTIVE, FAULTS, clearFaults } from './faults.js';
import { updateExercises, EX } from './exercises.js';
import { openDevice, openEquipmentIndex } from './equipment/viewer.js';
import { initShared, CFG, SH, PROG } from './shared.js';
import { openTrainer } from './ui/config.js';
import { updateScenario, SC } from './scenario.js';
import { updateNet, NET } from './ipnet.js';
import { FAB } from './net/fabric.js';
import { updateCourse, NC } from './net/course.js';
import { AN } from './net/analyzer.js';
import { COMMUT } from './ui/commut.js';
import { AT, beginAtelier, updateAtelier, endAtelier, atelierDebug } from './atelier.js';
import { pt, pe, profFrame, profSnapshot, profReset } from './app/profiler.js';
import { createRenderer, pcam, setQuality, updateNear } from './app/view.js';
import { MATIERE, detailOk } from './matiere.js';
import { PL, onDeck, eyePos, updatePlayer, updToolbar } from './app/player.js';
import { takeCamera, releaseCamera, updateCamop } from './app/camop.js';
import { AIM, updatePrompt } from './app/interact.js';
import { teleport, goToStation, goToRolePost, placeAtStation } from './app/teleport.js';
import { updateStatus, FPS } from './app/hud.js';
import { installInput } from './app/input.js';
import { buildStart, start } from './app/start.js';
import { initTitle, loadStep, tick, titleReady, enterFrom, showTitle } from './app/title.js';
import './ui/settings.js';
import { initCamLab, camlabOpen, camlabDebug } from './camlab/index.js';
import { initEntrepot, entrepotOpen, entrepotDebug } from './entrepot/index.js';
import { applyRole, PROFILE, setRole } from './app/profile.js';
import { openCours } from './ui/cours_ui.js';
import { CHAPTERS as COURS_CHAPTERS, allLessons, lessonById as coursLessonById, lessonDone as coursLessonDone } from './cours/index.js';
import './cours/all.js';
import * as CTRL from './net/ctrlnet.js';
import { installPerfTest, watchFps } from './app/perf.js';
import { openMenu, restart, resumeAfterReload } from './app/nav.js';
import { toggleChef } from './ui/tutor_ui.js';
import { installSfx, sfx, JEU, applyJeu } from './game/sfx.js';
import { installProgression } from './game/progression.js';
import { installFx } from './game/fx.js';
import { renderQuest, updateQuestMarker, openJournal, currentGoal } from './game/quest.js';
import * as XP from './game/xp.js';
import { report, ERRS } from './diag.js';
import { initDiagUI, setDiagInfo, diagText, openDiag } from './ui/diag_ui.js';
import { TUTOR, startLesson as startChefLesson, doForMe as chefDoForMe, next as chefNext, stopLesson as stopChefLesson } from './tutor/engine.js';

// ----------------------------------------------------------------------------------
// Point d'entrée : initialisation du monde et du car, événements de l'application, boucle
// principale. Le reste de l'application est dans src/app/ (vue, joueur, visée, cadreur,
// téléportation, affichage tête haute, entrées, écran d'accueil, diagnostic, profileur).
// ----------------------------------------------------------------------------------
Object.assign(S, { simTime: 0, tcOffset: 20 * 3600 + 44 * 60 + 30, txPath: 1, showMission: true, autoLineup: true, showLabels: true, directorVoice: false, eyeExposure: 1 });
S.kickoffTOD = S.tcOffset + 4;
try { const q = localStorage.getItem('carregie.quality'); if (q) S.quality = q; } catch (e) { /* stockage indisponible */ }
if (/[?&]lite/.test(location.search)) { S.lite = true; S.quality = 'basse'; }

// écran titre : la construction se fait par étapes, chacune affichée avant la suivante
applyRole();
initTitle();
initCamLab();
initEntrepot();
loadStep('Chargement des polices', 6); await tick();
// charge les polices avant de dessiner les textures (étiquettes, panneaux), sans bloquer plus de 2,5 s
try {
  await Promise.race([
    Promise.all(['600 40px "Barlow Condensed"', '700 40px "Barlow Condensed"', '600 16px "JetBrains Mono"', '500 16px "Barlow"'].map((f) => document.fonts.load(f))),
    new Promise((r) => setTimeout(r, 2500)),
  ]);
} catch (e) { /* polices indisponibles : polices de secours */ }

loadStep('Construction du stade', 12); await tick();
const renderer = createRenderer();
MATIERE.detail = detailOk();
buildWorld(renderer);
loadStep('Le match et les joueurs', 42); await tick();
initMatch(); buildPlayers(W.scene); initRecorder();
loadStep('Le car régie et ses postes', 52); await tick();
buildTruck();
loadStep('Habillage et rendu', 70); await tick();
initGfx();
initRender(renderer, W, T);
applyLighting('jour');
loadStep('La chaîne vidéo : grille, mélangeur, multiview', 80); await tick();
initPipeline();
initPlan(W.scene);
initAvatars(W.scene, T.scene, { stations: T.stations, chairs: T.chairs || [] });

// session à plusieurs : ce que les autres voient de moi (avatar, poste, caméra tenue)
setAvatarSource(() => ({ x: PL.pos.x, y: PL.pos.y, z: PL.pos.z, yaw: PL.yaw, truck: S.inTruck, fly: PL.fly, station: S.mode === 'station' && ST.cur ? ST.cur.id : null, cam: S.mode === 'camop' && S.camop ? S.camop.id : null }));
// fiche de rôle : « Aller à mon poste » (ou prendre sa caméra pour un cadreur)
setRolePostHandler(goToRolePost);

// ----------------------------------------------------------------------------------
// Événements de l'application
// ----------------------------------------------------------------------------------
on('takeCamera', (c) => takeCamera(c));
on('startAtelier', () => beginAtelier({
  place: (x, y, z, yaw, pitch = -0.15) => { PL.fly = false; S.inTruck = false; PL.pos.set(x, y, z); PL.y = y + 1.7; PL.yaw = PL.cyaw = yaw; PL.pitch = PL.cpitch = pitch; PL.vel.set(0, 0, 0); PL.vy = 0; updToolbar(); },
  intercom,
}));
on('openSynoptics', (t) => openSynoptics(t || 'video'));
on('openStationNow', ({ id, cam }) => { placeAtStation(id); openStation(id, cam ? { cam } : 0); });
on('openStationLater', (id) => setTimeout(() => { placeAtStation(id); openStation(id); }, 60));
on('setLighting', (v) => { applyLighting(v); toast(`${LIGHTING[v].label} : la lumière a changé, les ingénieurs vision doivent réajuster les iris (poste vision, ou AUTO IRIS).`, '', 6000); });
on('setLabels', (v) => { S.showLabels = v; if (v) pcam.layers.enable(1); else pcam.layers.disable(1); });
on('setQuality', (v) => setQuality(v));
on('match', (e) => { if (e.type === 'goal') toast(`BUT ! ${TEAMS[e.team].name} · ${e.score[0]}-${e.score[1]}`, 'good', 3500); });

// ----------------------------------------------------------------------------------
// Boucle principale
// ----------------------------------------------------------------------------------
let last = performance.now();
let rfAcc = 0, slowAcc = 0;
const EYE = new THREE.Vector3(), DIR = new THREE.Vector3();
function frame(now) {
  requestAnimationFrame(frame);
  // une image qui plante n'arrête pas le simulateur : l'erreur est notée (une fois, avec son
  // nombre de répétitions, et signalée à l'écran) et l'image suivante repart
  try { step(now); } catch (e) { const r = report(e, 'boucle de rendu'); if (r && r.n === 1) console.error(e); }
}
function step(now) {
  // module « La caméra » ouvert : le simulateur attend, sans rien calculer ni dessiner
  if (camlabOpen() || entrepotOpen()) { last = now; return; }
  let dt = (now - last) / 1000; last = now;
  const realDt = Math.max(0.001, dt); // le compteur d'images par seconde mesure le temps réel, pas le pas de simulation borné
  dt = clamp(dt, 0.001, 0.05);
  S.time += dt; S.frame++;
  const t0 = pt(); let t = t0;
  if (isFollower()) followMatch(dt); else stepMatch(dt);
  updateWorld(S.simTime);
  W.crowdMat.uniforms.uExcite.value.set(Math.min(1.2, M.excite[0]), Math.min(1.2, M.excite[1]));
  t = pe('match', t);
  for (const c of S.cams) { c.update(dt); updateRopes(c); }
  record(S.cams);
  rfAcc += dt; if (rfAcc > 0.1) { updateRF(rfAcc); rfAcc = 0; }
  t = pe('caméras', t);
  if (S.mode === 'fps') updatePlayer(dt);
  t = pe('joueur', t);
  updateGfx(dt); { const pgm = meSource(MIX.pgm); updateAudio(dt, { pgmSrc: pgm, replayA: EVS.ch[0].playing, replayB: EVS.ch[1] && EVS.ch[1].playing, studioOnAir: pgm === 'STUDIO' }); updateCommentary(dt, { pgmSrc: pgm, replay: (pgm === 'EVSA' || pgm === 'EVSB') && EVS.ch[pgm === 'EVSA' ? 0 : 1].playing, studioOnAir: pgm === 'STUDIO' }); } updateTruck(S.time); updateExercises(dt); updateScenario(dt); updateNet(dt, ROUTER.map, ROUTER.phase); updateCourse(dt); updateSession(dt); trackMix(); if (S.frame % 10 === 0) updateSessionHud();
  slowAcc += dt; if (slowAcc > 0.5) { watchFps(slowAcc); slowAcc = 0; checkMissions(); updateFaults(); if (S.mode === 'fps') drawMissionCard(); renderQuest(); }
  t = pe('simulation', t);

  // matériaux ajoutés en cours de route (caméras posées, appareils) : conversion physique
  if (S.frame % 90 === 0) upgradeScene(W.scene); else if (S.frame % 90 === 45) upgradeScene(T.scene, true);
  renderer.shadowMap.needsUpdate = S.quality !== 'basse' || S.frame % 2 === 0;
  renderer.toneMappingExposure = 1;
  if (S.mode !== 'start') renderPipeline(renderer, dt);
  renderer.setRenderTarget(null);
  t = pe('pipeline', t);

  if (S.mode === 'camop') { updateCamop(dt); renderer.setRenderTarget(null); t = pe('cadreur', t); }
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
    if (SES.active || S.frame % 30 === 0) updateAvatars(dt, pcam.position);
    // étiquettes des caméras masquées pendant le montage : à 2 m, elles boucheraient la vue
    { const lab = S.showLabels && !(AT.active && onDeck()); if (lab !== pcam.layers.isEnabled(1)) { if (lab) pcam.layers.enable(1); else pcam.layers.disable(1); } }
    renderer.setClearColor(0x000000, 1);
    renderEye(renderer, S.inTruck ? T.scene : W.scene, pcam, S.inTruck ? (RENDER.pbr ? 1.2 : 1.0) : S.eyeExposure, S.inTruck);
    if (S.mode === 'fps' && !$('#minimon').hidden) drawSlots(renderer, [$('#minimon')]);
    t = pe('vue', t);
    updatePrompt(); updateQuestMarker();
    if (S.inTruck && PL.pos.x - TRUCK.cx < -3) updateAudioDesk(AU, dt, faderLin);
    if (S.inTruck) { pcam.getWorldDirection(DIR); updateTruckView(eyePos(EYE), DIR, AIM.target && AIM.target.kind === 'station' ? AIM.target.id : null, S.time); }
    updateTruckMap(PL);
    t = pe('visée', t);
  } else if (S.mode === 'plan') {
    renderPlan(renderer);
  } else {
    renderer.setClearColor(0x000000, 0); renderer.clear();
    if (S.mode === 'station') drawSlots(renderer, $$('#station [data-gl], #floatmon [data-gl]'));
    else if (S.mode === 'camop') drawSlots(renderer, [$('#vf')]);
  }
  if (S.mode === 'station') updateStation(dt);
  t = pe('poste', t);
  if (S.mode !== 'start') updateStatus(realDt);
  if (AT.active && S.frame % 10 === 0) { const ap = $('#atelier'); if (ap) ap.hidden = S.mode !== 'fps'; }
  pe('statut', t);
  pe('image', t0); profFrame(now);
}

buildStart();
S.mode = 'start';
// les shaders se compilent maintenant, plutôt qu'à la première image (qui figerait l'écran)
loadStep('Préparation des matériaux', 90); await tick();
try { renderer.compile(W.scene, pcam); renderer.compile(T.scene, pcam); } catch (e) { report(e, 'préparation des matériaux'); }
initTruckMap((st) => goToStation(st), () => PL);
installInput();
installSfx(); applyJeu(); installProgression(); installFx();
installPerfTest();
initShared();
// la configuration du car peut arriver après le démarrage : on recalcule la répartition EVS
on('config', (part) => { if (part === 'car' && S.mode !== 'start') { defaultRouting(false); emit('router', {}); } updBrand(); });
function updBrand() { paintTruckSign(CFG.car.name); const w2 = $('#where2'); if (w2 && CFG.car.name && !S.inTruck) w2.textContent = CFG.car.name; }
document.fonts && document.fonts.ready.then(() => { W.boards && W.boards.redraw(); P.mvDirty = true; paintTruckSign(CFG.car.name); });
requestAnimationFrame(frame);
window.__S = S; // accès console pour le débogage
// diagnostic : la carte graphique et la fluidité, pour le texte à copier
setDiagInfo(() => {
  const gl = renderer.getContext();
  let name = gl.getParameter(gl.RENDERER);
  if (/^WebKit WebGL$/.test(name)) { const ext = gl.getExtension('WEBGL_debug_renderer_info'); if (ext) name = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL); }
  const mem = renderer.info.memory;
  return { gl: `${gl.getParameter(gl.VERSION)} · ${name} · texture max ${gl.getParameter(gl.MAX_TEXTURE_SIZE)} · ${mem.geometries} géométries, ${mem.textures} textures`, fps: `${FPS.shown} i/s` };
});
window.__dbg = { RENDER, openReview, openSessionPanel, SES, S, M, MIX, EVS, ROUTER, P, W, T, PL, pcam, COMMUT, CMT, applyAudio: applyAll, voiceGain, setMonitor, stripRms, corrNow, EX, teleport, openStation, closeStation, openPlan, closePlan, takeCamera, releaseCamera, start, openGuide, renderer, applyLighting, openDevice, openEquipmentIndex, openTrainer, CFG, SH, AU, SC, NET, FAB, NC, AN, emit, injectFault, clearFaults, ACTIVE, FAULTS, truckBlocked, truckFloorAt, goToStation, TRUCK, AT, atelierDebug, beginAtelier, endAtelier, avOk, AVATARS, avatarPositions, profSnapshot, profReset, TUTOR, toggleChef, startChefLesson, chefDoForMe, chefNext, stopChefLesson, PROG };
window.__dbg.diag = { ERRS, report, diagText, openDiag, el }; window.__dbg.on = on;
window.__dbg.title = { enter: enterFrom, show: showTitle };
window.__dbg.nav = { openMenu, restart };
window.__dbg.openCours = openCours; window.__dbg.PROFILE = PROFILE; window.__dbg.setRole = setRole; window.__dbg.camlab = camlabDebug; window.__dbg.entrepot = entrepotDebug;
window.__dbg.COURS = { CHAPTERS: COURS_CHAPTERS, allLessons, lessonById: coursLessonById, lessonDone: coursLessonDone };
window.__dbg.CTRL = CTRL; window.__dbg.MATIERE = MATIERE;
window.__dbg.jeu = { XP, sfx, JEU, openJournal, currentGoal, renderQuest };
// le programme a démarré : le filet du chargement (boot.js) n'a plus à intervenir
window.__carReady = true;
initDiagUI();
titleReady();
resumeAfterReload();

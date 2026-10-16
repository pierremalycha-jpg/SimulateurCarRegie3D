import { S, emit, on, camById } from '../state.js';
import { el, clamp, tc, fmt, mmss, linToDb } from '../util.js';
import { STATION_INFO, IRIS_STOPS, GAINS, ND_FILTERS, SHUTTERS, LINKS, LENSES, CAMERA_TYPES, ROLES, MODS, FECS, GUARDS, TX_POWERS, TEAMS, POSITIONS } from '../data.js';
import { $, $$, toast, intercom, modal, openInfo, hwBtn, knob, selectEl, field, monitor } from './common.js';
import { MIX, TRANS, WIPES, mixSetPst, mixSetPgm, mixCut, mixAuto, mixTbar, dskToggle, ftbToggle, keyToggle, meSource, sourceLabel, allSources, ROUTER, DESTS, route, defaultRouting, EVS, evsAction, evsSetRecording, recordedCams, canReplay, SCOPE, drawScopes, resolve, P, tallyOf } from '../pipeline.js';
import { recRange, M, playerName, playerNumber } from '../match.js';
import { GFX, gfxTake, gfxOut } from '../gfx.js';
import { AU, startAudio, applyFaders, resetLoudness, setMonitor, setLineDelay, setFollow, setSend, avOffsetMs, avOk, AV_TOL, videoLatencyMs, EMB_OPTIONS, SOUND_PLAN, soundPlanOk, embLabel } from '../audio.js';
import { RF, LATENCY, channelInfo } from '../rf.js';
import { maxAperture } from '../data.js';
import { synopticsPanel } from './synoptics.js';
import { FAULTS, injectFault, activeFaults, faultPanel } from '../faults.js';
import { EX, startExercise, stopExercise } from '../exercises.js';
import { explainBox, explain, toggleFloatMon } from './widgets.js';
import { buildVision } from './st_vision.js';
import { buildEVS } from './st_evs.js';
import { buildMixer } from './st_mixer.js';
import { buildIPD } from './st_ipd.js';
import { buildPatch } from './st_patch.js';
import { mixInputs, EQUIP } from '../equip.js';
import { netStatus, flowGbps, mcastOf } from '../ipnet.js';
import { FAB, markDirty, camPtpOk } from '../net/fabric.js';
import { buildNetwork } from './st_network.js';
import { buildAudio } from './st_audio.js';
import { COMMUT, commutKey, setKeyMode, keyLegend, keyModeLabel } from './commut.js';
import { openDevice, openEquipmentIndex } from '../equipment/viewer.js';
import { buildCabling, SIG, DEV_NAMES, endLabel } from '../equipment/cabling.js';
import { DEVICE_LIST } from '../equipment/devices.js';
import { CFG, offerDownload } from '../shared.js';
import { checklistItems, cablingCSV, generatedRows } from './config.js';

export const ST = { cur: null, lastUpd: 0 };

// layout : 'side' = écrans à gauche, commandes à droite · 'top' = écrans en haut · 'top sm' = bandeau d'écrans réduit · 'none' = sans écrans
// dev : appareil ouvert par le bouton « Matériel »
const STATIONS = {
  melangeur: { title: 'Mélangeur — truquiste', build: buildMixer, layout: 'top', dev: 'mixpanel' },
  realisateur: { title: 'Réalisateur', build: buildDirector, layout: 'top', dev: 'mv' },
  scripte: { title: 'Scripte', build: buildScripte, layout: 'top sm' },
  habillage: { title: 'Habillage', build: buildGfx, layout: 'top' },
  producteur: { title: 'Production', build: buildProd, layout: 'top' },
  chefdecar: { title: 'Chef de car', build: buildChef, layout: 'top sm' },
  vision: { title: 'Ingénieur vision — RCP', build: buildVision, layout: 'side', dev: 'rcp' },
  evs: { title: 'Ralentis — EVS XT4K / LSM', build: buildEVS, layout: 'top', dev: 'lsm' },
  ipdirector: { title: 'IPDirector — base de clips EVS', build: buildIPD, layout: 'top sm', dev: 'ipd' },
  son: { title: 'Régie son · console (inspiration Studer Vista 1)', build: buildAudio, layout: 'top sm', dev: 'audio' },
  hf: { title: 'Régie HF', build: buildHF, layout: 'side', dev: 'rx' },
  grille: { title: 'Grille de commutation', build: buildRouter, layout: 'top', dev: 'router', ipTitle: 'Contrôleur IP (ST 2110 / NMOS)' },
  brassage: { title: 'Baie de brassage (jackfield)', build: buildPatch, layout: 'top sm', dev: 'router' },
  ccu: { title: 'Baie CCU', build: buildCCU, layout: 'side', dev: 'ccu' },
  synchro: { title: 'Synchro et timecode', build: buildSync, layout: 'top sm', dev: 'spg' },
  transmission: { title: 'Transmission', build: buildTX, layout: 'top' },
  intercom: { title: 'Intercom', build: buildIntercom, layout: 'none' },
  reseau: { title: 'Réseau IP (ST 2110 · spine-leaf)', build: buildNetwork, layout: 'top sm', dev: 'swred' },
};
export function hasStation(id) { return !!STATIONS[id]; }

export function openStation(id, arg) {
  const def = STATIONS[id];
  if (!def) { openInfo(id); return; }
  if (document.pointerLockElement) document.exitPointerLock();
  if (ST.cur) closeStation(true);
  S.mode = 'station'; S.station = id;
  const root = $('#station'); root.innerHTML = ''; root.hidden = false;
  const info = STATION_INFO[id] || {};
  const devBtn = el('button', { class: 'btn small', title: 'Faces avant et arrière, connecteurs et raccordements', onclick: () => (def.dev ? openDevice(def.dev, S.selCam || 1) : openEquipmentIndex()) }, 'Matériel');
  const fmBtn = el('button', { class: 'btn small', title: 'Un écran déplaçable, au choix, par-dessus le poste', onclick: () => toggleFloatMon(document.getElementById('floatmon') ? null : 'PGM') }, 'Moniteur flottant');
  const head = el('div', { class: 'st-head' },
    el('h2', {}, S.ipMode && def.ipTitle ? def.ipTitle : def.title),
    el('div', { class: 'role' }, info.role ? info.role.split('. ')[0] + '.' : ''),
    devBtn, fmBtn,
    el('button', { class: 'btn small', onclick: () => openInfo(id) }, 'Le poste'),
    el('button', { class: 'btn small', onclick: () => emit('openGuide') }, 'Guide'),
    el('button', { class: 'btn small primary', onclick: () => closeStation() }, 'Quitter le poste · Échap'));
  const dock = el('div', { class: 'st-dock' });
  const body = el('div', { class: 'st-body' });
  const main = el('div', { class: 'st-main ' + def.layout }, dock, body);
  root.append(head, main);
  const ctx = { dock, explainBox: explainBox(), explain };
  const inst = def.build(body, arg, ctx) || {};
  // les postes qui n'ont pas placé le fil d'explications le reçoivent en fin de dock
  if (def.layout !== 'none' && !ctx.explainBox.isConnected) dock.appendChild(ctx.explainBox);
  if (def.layout === 'none') { dock.remove(); if (!ctx.explainBox.isConnected) body.prepend(ctx.explainBox); }
  ST.cur = { id, inst, arg };
  S.visited[id] = true;
  emit('station', id);
  $('#hud').hidden = true;
  if (inst.update) inst.update(0);
  if (STATION_HELLO[id]) explain(STATION_HELLO[id], 'muted');
}
export function closeStation(silent) {
  if (!ST.cur) return;
  const c = ST.cur; ST.cur = null;
  if (c.inst.close) c.inst.close();
  const fm = document.getElementById('floatmon'); if (fm) fm.remove();
  $('#station').hidden = true; $('#station').innerHTML = '';
  S.mode = 'fps'; S.station = null; S.selCam = null; SCOPE.active = false;
  $('#hud').hidden = false;
  if (!silent) emit('stationClose', c.id);
}
const STATION_HELLO = {
  vision: 'Le moniteur de référence, l\'oscilloscope et le multiview restent affichés : chaque réglage du RCP s\'y voit tout de suite. Joystick : glissez la poignée (iris), faites tourner la bague (master black) ; molettes : glisser ou molette de la souris, double-clic = 0.',
  evs: 'Les sorties EVS A, EVS B et le programme restent affichés. Les trains d\'enregistrement défilent sur l\'écran du LSM : cliquez dedans pour vous placer.',
  intercom: 'Chaque touche du pupitre a TALK et LISTEN. Essayez-les : le type de liaison (conférence, point à point, IFB, 4 fils) est expliqué ici.',
  melangeur: 'Le multiview ci-dessus reste visible : chaque commutation s\'y voit (tally rouge = PGM, vert = PVW).',
  grille: 'Choisissez une destination, une source, puis TAKE. Le multiview montre le résultat de vos prises.',
  son: 'Console inspirée de la Studer Vista 1 : deux écrans Vistonics de 10 tranches (molettes sur l\'écran : rouge = égaliseur, vert = dynamique, jaune = panoramique), FaderGlow le long des faders, Control Bay avec vumètres et écoutes. Les commentateurs parlent pendant le match : leur volume suit vos faders.',
  hf: 'Le spectre et l\'image reçue restent affichés : changez fréquence, modulation ou antennes et regardez la marge.',
  ccu: 'Le multiview reste visible : une voie en défaut y apparaît immédiatement (PAS DE SIGNAL, image qui roule).',
  synchro: 'Le multiview reste visible : une caméra mal synchronisée y « roule » à la commutation.',
  transmission: 'Comparez le départ vers la chaîne et le retour antenne (en retard de quelques secondes).',
  habillage: 'À gauche, la sortie fill/key du moteur graphique ; à droite, le programme : le graphique n\'y apparaît que si le DSK est à l\'antenne.',
  chefdecar: 'Le multiview reste visible pendant que vous lisez le synoptique ou injectez des pannes.',
  reseau: 'Deux réseaux identiques et indépendants (rouge et bleu) en spine-leaf. Cliquez un commutateur pour le configurer (interface graphique ou terminal) : chaque réglage agit réellement sur ce que reçoivent le mélangeur, l\'EVS et le multiview ci-dessus.',
};
const later = (fn) => setTimeout(fn, 160);
// moniteur du dock : label + écran 16/9 rendu par WebGL
function dmon(src, label, cls = 'grow') { return el('div', { class: 'monwrap ' + cls }, el('div', { class: 'lab' }, label), el('div', { class: 'mon fill', 'data-gl': src })); }

// ---- explications des actions communes (mélangeur, grille, habillage, pannes) ----
const nameOf = (id) => sourceLabel(id);
on('mixer', (e) => {
  if (!ST.cur || !['melangeur', 'realisateur'].includes(ST.cur.id)) return;
  const pgm = nameOf(meSource(MIX.pgm)), pst = nameOf(meSource(MIX.pst));
  const t = {
    pst: `PST (preset) = ${pst} : la source est préparée sur le bus vert. Elle apparaît dans la tuile PVW du multiview avec un tally vert. Rien ne change à l'antenne.`,
    pgm: `Commutation directe sur le bus PGM : ${pgm} passe à l'antenne immédiatement (tally rouge). Pratique, mais on ne voit pas avant ce qu'on envoie : on préfère PST + CUT.`,
    cut: `CUT : PGM et PST s'échangent instantanément (au top image, synchronisé par la référence). À l'antenne : ${pgm}. La source précédente revient en preset.`,
    autostart: `AUTO : la transition « ${TRANS[MIX.trans]} » se déroule en ${MIX.rate} images (${fmt(MIX.rate / 50, 2)} s). Regardez la tuile PGM du multiview.`,
    transition: `Transition terminée : ${pgm} est à l'antenne. Comptez vos images : 25 images = 0,5 s à 50 i/s.`,
    dsk: `DSK ${e.n} ${e.on ? 'à l\'antenne' : 'retiré'} : ${e.n === 1 ? 'le score/chrono' : 'le graphique (bandeau, stats…)'} est incrusté en aval de tout. Le clean feed, lui, reste sans habillage (pour les diffuseurs étrangers).`,
    ftb: e.on ? 'FTB (fade to black) : fondu au noir de toute la sortie, DSK compris. Utilisé en tout début ou toute fin d\'émission.' : 'Retour du noir : le programme réapparaît.',
    key: `KEY 1 ${MIX.key1.on ? 'à l\'antenne' : 'retirée'} : l'incrustation en image dans l'image (DVE) se superpose au fond de M/E.`,
  }[e.type];
  if (t) explain(t, 'mix:' + e.type);
});
on('router', (e) => {
  if (!ST.cur || !e || !e.dest || ST.cur.id !== 'grille') return;
  const d = DESTS.find((x) => x.id === e.dest);
  explain(`TAKE : ${sourceLabel(e.src)} → ${d ? d.group + ' · ' + d.label : e.dest}. La grille établit un point de croisement : la même entrée peut alimenter autant de sorties que nécessaire (une source, plusieurs destinations), mais chaque sortie ne reçoit qu'une seule source.`, 'grille:take');
});
on('gfx', () => { if (ST.cur && ST.cur.id === 'habillage') explain(GFX.animDir < 0 ? 'TAKE OUT : le graphique sort en animation. Le key repasse à 0 : le fond redevient visible partout.' : `TAKE IN « ${GFX.cued} » : le moteur graphique anime le fill (l'image) et le key (la transparence). ${MIX.dsk2.on ? 'Le DSK 2 est à l\'antenne : il se voit au PGM.' : 'Attention : DSK 2 hors antenne, rien ne se voit au PGM !'}`, 'gfx:take'); });
on('fault', () => { if (ST.cur && ST.cur.id === 'chefdecar') explain('Panne en cours : regardez le multiview et l\'onglet « État de l\'installation ». Méthode : constater, localiser (quel maillon ?), contourner (secours), puis réparer.', 'warn'); });

export function updateStation(dt) {
  if (!ST.cur) return;
  const now = performance.now();
  if (ST.cur.inst.frame) ST.cur.inst.frame(dt);
  if (now - ST.lastUpd < 100) return;
  ST.lastUpd = now;
  if (ST.cur.inst.update) ST.cur.inst.update(dt);
}
export function stationKey(e) {
  if (!ST.cur) return false;
  if (ST.cur.inst.key && ST.cur.inst.key(e)) return true;
  // dans les autres postes, les chiffres commutent aussi le mélangeur (sauf l'EVS : ils y choisissent l'angle)
  if (ST.cur.id === 'evs') return false;
  if (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter') return false;
  return commutKey(e, 'fallback');
}

// ----------------------------------------------------------------------------------
// Mélangeur
// ----------------------------------------------------------------------------------
function srcButtonLabel(n) {
  const id = meSource(n); const s = allSources().find((x) => x.id === id);
  if (!id) return ['—', ''];
  if (id.startsWith('CAM')) { const c = camById(+id.slice(3)); return [`CAM ${id.slice(3)}`, c ? c.T.short : 'libre']; }
  return [s ? s.short : id, { EVSA: 'ralenti', EVSB: 'ralenti', GFX: 'graph.', STUDIO: 'duplex', BARS: 'mire', BLACK: 'noir' }[id] || ''];
}
// ----------------------------------------------------------------------------------
// Réalisateur
// ----------------------------------------------------------------------------------
function buildDirector(body, arg, ctx) {
  ctx.dock.append(dmon('mv', 'Multiview — le mur d\'écrans du réalisateur'));
  const p = el('div', { class: 'hwpanel' }, el('h3', {}, 'Ordres au truquiste'));
  const rowP = el('div', { class: 'hwrow' }, el('span', { class: 'rl' }, 'Prépare'));
  const btnsP = {};
  const srcs = () => { const l = []; for (let n = 1; n <= mixInputs(); n++) { const id = meSource(n); if (!id) continue; if (id.startsWith('CAM') && !camById(+id.slice(3))) continue; if (['BLACK', 'BARS'].includes(id)) continue; l.push(n); } return l; };
  const build = () => {
    rowP.innerHTML = ''; rowP.appendChild(el('span', { class: 'rl' }, 'Prépare'));
    for (const n of srcs()) { const [l, sub] = srcButtonLabel(n); const b = hwBtn(l, { sub, onclick: () => order('prep', n) }); btnsP[n] = b; rowP.appendChild(b); }
  };
  build();
  const top = hwBtn('TOP !', { cls: 'big', onclick: () => order('cut') });
  const mix = hwBtn('ENCHAÎNE', { cls: 'big', onclick: () => order('mix') });
  const sting = hwBtn('VOLET LOGO', { cls: 'big', onclick: () => order('stinger') });
  const replay = hwBtn('RALENTI !', { cls: 'big', onclick: () => order('replay') });
  const score = hwBtn('SCORE', { sub: 'DSK 1', onclick: () => order('dsk1') });
  const lower = hwBtn('BANDEAU', { sub: 'joueur', onclick: () => order('lower') });
  p.append(rowP, el('div', { class: 'hwrow' }, top, mix, sting, replay, score, lower));
  p.append(el('p', { class: 'note' }, 'Ici, une équipe virtuelle exécute vos ordres : le truquiste commute (avec un temps de réaction réaliste) et l\'opérateur EVS prépare le ralenti de la dernière action sur EVS A. Annoncez toujours la caméra (« Prépare ») avant le « Top ».'));
  const ex = el('div', { class: 'hwpanel' }, el('h3', {}, 'Exercices'),
    el('div', { class: 'hwrow' },
      el('button', { class: 'btn primary', onclick: () => { startExercise('td'); closeStation(); emit('openStationLater', 'melangeur'); } }, 'Je suis truquiste : le réalisateur virtuel me donne les ordres'),
      el('button', { class: 'btn', onclick: () => { stopExercise(); } }, 'Arrêter l\'exercice')),
    el('p', { class: 'note' }, 'Dans l\'exercice truquiste, un réalisateur virtuel annonce les caméras (« Prépare la 3… Top ! »). Vous avez quelques secondes pour exécuter au mélangeur. Score affiché dans l\'intercom.'));
  const kmBtn = hwBtn('TOUCHES 1-9', { sub: keyModeLabel(), onclick: () => { setKeyMode(COMMUT.mode === 'direct' ? 'preset' : 'direct'); explain(COMMUT.mode === 'direct' ? 'Clavier en mode DIRECT : chaque chiffre envoie l\'entrée à l\'antenne, sans passer par le truquiste virtuel. En petite production, le réalisateur commute souvent lui-même.' : 'Clavier en mode PRESET : le chiffre prépare l\'entrée (PST, tally vert), Espace ou Entrée = « Top » (CUT).', 'real:keys'); } });
  const kLegend = el('p', { class: 'note' });
  const kp = el('div', { class: 'hwpanel' }, el('h3', {}, 'Commuter soi-même au clavier'), el('div', { class: 'hwrow' }, kmBtn, kLegend),
    el('p', { class: 'note' }, 'Les chiffres correspondent aux numéros des entrées du mélangeur (affichés sous chaque bouton du pupitre et dans le multiview). Ils marchent aussi en vous déplaçant dans le stade ou en vol, avec le retour PGM (M) affiché.'));
  body.append(p, kp, ex);
  let lastN = '';
  function order(kind, n) {
    const delay = 250 + Math.random() * 350;
    explain({ prep: 'Annonce « Prépare… » : le truquiste met la source en preset. Le cadreur concerné voit son tally vert (s\'il est câblé) et sait qu\'il va passer.', cut: '« Top ! » : le truquiste fait le CUT au moment exact annoncé. Le temps de réaction compte : on anticipe sur l\'action.', mix: '« Enchaîne » : transition douce, souvent sur un changement de valeur de plan ou de rythme.', stinger: 'Volet logo : marque l\'entrée ou la sortie d\'un ralenti.', replay: 'Ralenti : l\'opérateur EVS se cale sur l\'action, choisit l\'angle, le truquiste prépare l\'entrée EVS et l\'envoie en volet.', dsk1: 'Score : le DSK 1 incruste le chrono et le score.', lower: 'Bandeau : l\'habilleur joue le nom du joueur (DSK 2).' }[kind] || '', 'real:' + kind);
    if (kind === 'prep') { intercom('RÉAL', `Prépare la ${sourceLabel(meSource(n)).replace('CAM ', '')}…`); setTimeout(() => mixSetPst(n), delay); }
    if (kind === 'cut') { intercom('RÉAL', 'Top !'); setTimeout(() => mixCut(), delay); }
    if (kind === 'mix') { intercom('RÉAL', 'Enchaîne !'); setTimeout(() => { MIX.trans = 'mix'; mixAuto(); }, delay); }
    if (kind === 'stinger') { intercom('RÉAL', 'Volet logo, envoie !'); setTimeout(() => { MIX.trans = 'stinger'; mixAuto(); }, delay); }
    if (kind === 'replay') {
      intercom('RÉAL', 'EVS A, ralenti de l\'action !');
      setTimeout(() => {
        if (!S.lastAction) { intercom('EVS A', 'Pas d\'action récente à ressortir.', 'bad'); return; }
        const best = bestReplayCam();
        evsAction(0, 'lastaction'); if (best) evsAction(0, 'cam', best.id); evsAction(0, 'lever', best && best.hfr > 1 ? 0.33 : 0.5);
        intercom('EVS A', `Prêt sur la ${best ? best.id : '?'}${best && best.hfr > 1 ? ' (super ralenti)' : ''}. Prépare l'EVS A et envoie en volet.`, 'ok');
        const nEvs = [...Array(22).keys()].map((i) => i + 1).find((k) => meSource(k) === 'EVSA');
        if (nEvs) mixSetPst(nEvs);
        EX.autoPlayA = true;
      }, 900);
    }
    if (kind === 'dsk1') { intercom('RÉAL', MIX.dsk1.on ? 'Enlève le score.' : 'Envoie le score.'); setTimeout(() => dskToggle(1, true), delay); }
    if (kind === 'lower') {
      intercom('RÉAL', `Bandeau sur le ${playerNumber(M.owner >= 0 ? M.owner : 9)} !`);
      setTimeout(() => { GFX.player = M.owner >= 0 && M.owner < 22 ? M.owner : 9; GFX.cued = 'lower'; if (!MIX.dsk2.on) dskToggle(2, false); gfxTake('lower'); setTimeout(() => gfxOut(), 6000); }, delay);
    }
  }
  return {
    update() {
      const key = srcs().join(',') + Object.values(ROUTER.map).join(',');
      if (key !== lastN) { lastN = key; build(); }
      for (const n in btnsP) btnsP[n].className = 'hw' + (MIX.pgm === +n ? ' pgm' : MIX.pst === +n ? ' pst' : '');
      score.classList.toggle('pgm', MIX.dsk1.on);
      kmBtn.querySelector('small').textContent = keyModeLabel(); kmBtn.classList.toggle('lit', COMMUT.mode === 'preset'); kmBtn.classList.toggle('pgm', COMMUT.mode === 'direct');
      kLegend.textContent = keyLegend();
    },
    key(e) { return commutKey(e, 'station'); },
  };
}
export function bestReplayCam() {
  const rec = recordedCams().map((id) => camById(id)).filter(Boolean);
  return rec.find((c) => c.hfr > 1 && (c.role === 'serre' || c.role === 'joueur')) || rec.find((c) => c.role === 'serre') || rec.find((c) => c.hfr > 1) || rec[0];
}

// ----------------------------------------------------------------------------------
// Scripte
// ----------------------------------------------------------------------------------
function buildScripte(body, arg, ctx) {
  ctx.dock.append(el('div', { class: 'dockrow' }, dmon('PGM', 'Programme'), dmon('mv', 'Multiview')));
  const tcBox = el('div', { class: 'lcd amber big' }, '');
  const cd = el('div', { class: 'lcd big' }, '');
  const list = el('div', { class: 'list' });
  const log = el('div', { class: 'list' });
  const rundown = [
    ['Mire + 1 kHz vers la chaîne', -20 * 60], ['Générique, prise d\'antenne', -10 * 60], ['Avant-match plateau (studio)', -9 * 60], ['Entrée des joueurs (tunnel)', -3 * 60], ['Coup d\'envoi', 0], ['Mi-temps', 45 * 60], ['Reprise', 60 * 60], ['Fin du match, résumé', 105 * 60],
  ];
  const kickoff = S.kickoffTOD;
  body.append(el('div', { class: 'panelgrid' },
    el('div', { class: 'hwpanel' }, el('h3', {}, 'Heure maître (timecode du SPG)'), tcBox, el('h3', {}, 'Temps de jeu'), cd),
    el('div', { class: 'hwpanel' }, el('h3', {}, 'Conducteur'), list)),
    el('div', { class: 'hwpanel' }, el('h3', {}, 'Notes de scripte (actions marquantes)'), el('p', { class: 'note' }, 'Chaque action est notée avec son timecode. Un clic envoie le point d\'entrée à l\'EVS A (MARK IN 3 s avant).'), log));
  for (const [t, off] of rundown) list.appendChild(el('div', { class: 'item' }, el('span', { class: 'lcd amber' }, tc(kickoff + off).slice(0, 8)), el('div', { class: 'grow' }, el('div', { class: 't' }, t))));
  let lastN = -1;
  return {
    update() {
      tcBox.textContent = tc(S.tcOffset + S.simTime);
      cd.textContent = mmss(M.clock) + `  ·  ${TEAMS[0].short} ${M.score[0]} - ${M.score[1]} ${TEAMS[1].short}`;
      if (S.events.length !== lastN) {
        lastN = S.events.length; log.innerHTML = '';
        for (const e of S.events.slice(-14).reverse()) {
          log.appendChild(el('div', { class: 'item' }, el('span', { class: 'lcd amber' }, tc(S.tcOffset + e.t)), el('div', { class: 'grow' }, el('div', { class: 't' }, e.label), el('div', { class: 's' }, mmss(e.clock) + ' de jeu')),
            el('button', { class: 'btn small', onclick: () => { evsAction(0, 'back', 0); EVS.ch[0].t = Math.max(recRange()[0], e.t - 3); EVS.ch[0].in = EVS.ch[0].t; EVS.ch[0].out = e.t + 2.5; toast('EVS A calé 3 s avant : ' + e.label); } }, '→ EVS A')));
        }
      }
    },
  };
}

// ----------------------------------------------------------------------------------
// Habillage
// ----------------------------------------------------------------------------------
function buildGfx(body, arg, ctx) {
  const prev = el('canvas', { class: 'scope fill', width: 960, height: 540, style: { background: 'repeating-conic-gradient(#20262c 0% 25%, #171c21 0% 50%) 50% / 24px 24px' } });
  const pgm = el('div', { class: 'mon fill', 'data-gl': 'PGM' });
  ctx.dock.append(el('div', { class: 'dockrow' }, el('div', { class: 'monwrap grow' }, el('div', { class: 'lab' }, 'Sortie habillage (fill + key, damier = transparent)'), prev), el('div', { class: 'monwrap grow' }, el('div', { class: 'lab' }, 'Programme'), pgm)));
  const tpl = {};
  const p = el('div', { class: 'hwpanel' }, el('h3', {}, 'Modèles (DSK 2)'));
  const row = el('div', { class: 'hwrow' });
  for (const [k, l] of [['lower', 'Bandeau joueur'], ['stats', 'Statistiques'], ['compo', 'Composition'], ['titre', 'Titre du match']]) { const b = hwBtn(l, { onclick: () => { GFX.cued = k; explain(`Modèle « ${l} » préparé (cued). Le moteur graphique remplit le modèle avec les données (nom, numéro, statistiques) ; il n'est pas encore joué.`, 'gfx:cue'); } }); tpl[k] = b; row.appendChild(b); }
  const pl = selectEl([...Array(22).keys()].map((i) => [i, `${playerNumber(i)} · ${playerName(i)} (${TEAMS[i < 11 ? 0 : 1].short})`]), GFX.player, (v) => { GFX.player = +v; });
  const take = hwBtn('TAKE IN', { cls: 'big', onclick: () => gfxTake() });
  const out = hwBtn('TAKE OUT', { cls: 'big', onclick: () => gfxOut() });
  const d1 = hwBtn('DSK 1', { sub: 'score', onclick: () => dskToggle(1, true) }), d2 = hwBtn('DSK 2', { sub: 'graph.', onclick: () => dskToggle(2, true) });
  const tag = hwBtn('TAG RALENTI', { sub: 'auto', onclick: () => { GFX.replayTag = !GFX.replayTag; } });
  p.append(row, field('Joueur pour le bandeau', pl), el('div', { class: 'hwrow' }, take, out, el('span', { style: { flex: 1 } }), d1, d2, tag));
  const warn = el('p', { class: 'note warn' });
  p.append(warn, el('p', { class: 'note' }, 'Le moteur graphique sort un fill et un key. Le mélangeur les incruste par ses DSK : si le DSK 2 n\'est pas à l\'antenne, votre bandeau ne se voit pas au PGM. Le score/chrono (DSK 1) est relié au chronomètre du match.'));
  body.append(p);
  const g = prev.getContext('2d');
  return {
    frame() { g.clearRect(0, 0, 960, 540); g.drawImage(GFX.bug.canvas, 0, 0); g.drawImage(GFX.main.canvas, 0, 0); },
    update() {
      for (const k in tpl) tpl[k].classList.toggle('lit', GFX.cued === k);
      take.classList.toggle('pgm', !!GFX.template && GFX.anim > 0);
      d1.classList.toggle('pgm', MIX.dsk1.on); d2.classList.toggle('pgm', MIX.dsk2.on); tag.classList.toggle('lit', GFX.replayTag);
      warn.textContent = GFX.template && !MIX.dsk2.on ? 'Attention : le graphique est joué mais le DSK 2 n\'est pas à l\'antenne au mélangeur.' : '';
    },
  };
}

function buildProd(body, arg, ctx) {
  const st = el('div', { class: 'kv' });
  ctx.dock.append(el('div', { class: 'dockrow' }, dmon('PGM', 'Programme'), dmon('RETANT', 'Retour antenne')));
  body.append(
    el('div', { class: 'hwpanel' }, el('h3', {}, 'Données du match'), st),
    el('div', { class: 'hwpanel prose' }, el('h3', {}, 'Rôle'), el('p', {}, STATION_INFO.producteur.role)));
  return {
    update() {
      const tot = M.possession[0] + M.possession[1] || 1;
      st.innerHTML = '';
      const rows = [['Score', `${TEAMS[0].name} ${M.score[0]} - ${M.score[1]} ${TEAMS[1].name}`], ['Temps de jeu', mmss(M.clock)], ['Possession', `${Math.round(M.possession[0] / tot * 100)} % - ${Math.round(M.possession[1] / tot * 100)} %`], ['Tirs (cadrés)', `${M.shots[0]} (${M.onTarget[0]}) - ${M.shots[1]} (${M.onTarget[1]})`], ['Commutations', `${S.stats.cuts} cuts · ${S.stats.mixes} enchaînés · ${S.stats.stingers} volets logo`]];
      for (const [k, v] of rows) st.append(el('dt', {}, k), el('dd', {}, v));
    },
  };
}

// ----------------------------------------------------------------------------------
// Chef de car
// ----------------------------------------------------------------------------------
function buildChef(body, arg, ctx) {
  ctx.dock.append(dmon('mv', 'Multiview'));
  const tabs = el('div', { class: 'tabs' });
  const content = el('div', { class: 'list' });
  const T = [['syn', 'Synoptiques'], ['cables', 'Liste de câblage'], ['materiel', 'Matériel'], ['etat', 'État de l\'installation'], ['pannes', 'Simulateur de pannes'], ['lineup', 'Check-list line-up']];
  let cur = 'syn'; let updater = null;
  const show = (k) => {
    cur = k; content.innerHTML = ''; updater = null;
    $$('.tab', tabs).forEach((b) => b.classList.toggle('on', b.dataset.k === k));
    if (k === 'syn') { const p = synopticsPanel('video'); content.append(p.el); updater = p.update; }
    if (k === 'etat') { const box = el('div', { class: 'list' }); content.append(box); updater = () => { box.innerHTML = ''; for (const it of statusItems()) box.appendChild(el('div', { class: 'item' }, el('span', { class: 'dot ' + (it.level === 'err' ? 'red' : it.level === 'warn' ? 'amber' : 'green') }), el('div', { class: 'grow' }, el('div', { class: 't' }, it.t), el('div', { class: 's' }, it.s)))); }; }
    if (k === 'pannes') { const fp = faultPanel(); content.append(fp.el); updater = fp.update; }
    if (k === 'cables') { const cl = cablingList(); content.append(cl.el); updater = cl.update; }
    if (k === 'materiel') content.append(materielTab());
    if (k === 'lineup') {
      const items = checklistItems();
      if (CFG.car.checklist && CFG.car.checklist.length) content.appendChild(el('p', { class: 'note' }, 'Check-list maison définie par le formateur.'));
      S.checklist = S.checklist || {};
      for (const [i, t] of items.entries()) { const id = 'chk' + i; const cb = el('input', { type: 'checkbox', id }); cb.checked = !!S.checklist[i]; cb.addEventListener('change', () => { S.checklist[i] = cb.checked; }); content.appendChild(el('label', { class: 'item', for: id }, cb, el('span', { class: 'grow' }, t))); }
    }
  };
  for (const [k, l] of T) tabs.appendChild(el('button', { class: 'tab', 'data-k': k, onclick: () => show(k) }, l));
  body.append(tabs, content);
  show('syn');
  return { update() { if (updater) updater(); } };
}
// liste de câblage générée à partir de l'installation (comme le document papier du chef de car)
function cablingList() {
  const filt = { sig: '', q: '' };
  const sigSel = selectEl([['', 'Tous les signaux'], ...Object.entries(SIG).map(([k, v]) => [k, v.label])], '', (v) => { filt.sig = v; draw(); });
  const q = el('input', { type: 'text', placeholder: 'Filtrer (ex. CAM 3, EVS, REF…)', 'aria-label': 'Filtrer la liste de câblage', style: { flex: '1 1 220px' } });
  q.addEventListener('input', () => { filt.q = q.value.trim().toLowerCase(); draw(); });
  const count = el('span', { class: 'note' });
  const tbody = el('tbody');
  const tb = el('table', { class: 'tbl compact cabtbl' }, el('thead', {}, el('tr', {}, ...['N°', 'Origine (A)', 'Destination (B)', 'Câble', 'Long.', 'Signal', 'État'].map((h) => el('th', {}, h)))), tbody);
  let mode = 'gen';
  const modeSel = selectEl([['gen', 'Liste générée (installation simulée)'], ...(CFG.cabling && CFG.cabling.rows ? [['imp', `Liste du car importée (${CFG.cabling.rows.length} lignes)`]] : [])], 'gen', (v) => { mode = v; draw(); });
  const exp = el('button', { class: 'btn small', onclick: () => offerDownload(mode === 'imp' ? 'liste-cablage-car.csv' : 'liste-cablage-simulateur.csv', cablingCSV(mode === 'imp' ? CFG.cabling.rows : generatedRows())) }, 'Exporter (CSV)');
  const box = el('div', { class: 'list' },
    el('p', { class: 'note' }, 'Liste de câblage générée à partir de votre installation : chaque ligne est un câble réel, avec ses deux extrémités (appareil · connecteur). Cliquez une extrémité pour ouvrir l\'appareil sur ce connecteur. Sur le terrain, cette liste est imprimée et chaque câble porte son numéro aux deux bouts. Le formateur peut importer la liste réelle du car dans l\'Espace formateur.'),
    el('div', { class: 'hwrow' }, modeSel, sigSel, q, count, exp), el('div', { class: 'tblwrap' }, tb));
  let lastKey = '';
  function drawImported() {
    const rows = CFG.cabling.rows.filter((r) => !filt.q || `${r.n} ${r.a} ${r.b} ${r.type} ${r.sig} ${r.note}`.toLowerCase().includes(filt.q));
    tbody.innerHTML = '';
    for (const r of rows.slice(0, 600)) tbody.appendChild(el('tr', {}, el('td', { class: 'mono' }, r.n), el('td', {}, r.a), el('td', {}, r.b), el('td', {}, r.type + (r.note ? ' · ' + r.note : '')), el('td', { class: 'mono' }, r.len ? r.len + (/^\d+([.,]\d+)?$/.test(r.len) ? ' m' : '') : '—'), el('td', {}, r.sig || '—'), el('td', {}, '—')));
    count.textContent = `${rows.length} ligne${rows.length > 1 ? 's' : ''} · liste « ${CFG.cabling.name} »`;
  }
  function draw() {
    if (mode === 'imp' && CFG.cabling && CFG.cabling.rows) { drawImported(); return; }
    const all = buildCabling();
    const rows = all.filter((c) => (!filt.sig || c.sig === filt.sig) && (!filt.q || `${c.n} ${endLabel(c.a)} ${endLabel(c.b)} ${c.type} ${c.note || ''}`.toLowerCase().includes(filt.q)));
    tbody.innerHTML = '';
    for (const c of rows.slice(0, 400)) {
      const end = (e) => el('button', { class: 'linkbtn', onclick: () => openDevice(e.dev, e.n, { focus: e.port }) }, endLabel(e));
      tbody.appendChild(el('tr', { class: c.ok ? '' : 'bad' }, el('td', { class: 'mono' }, c.n), el('td', {}, end(c.a)), el('td', {}, end(c.b)), el('td', {}, c.type + (c.note ? ' · ' + c.note : '')), el('td', { class: 'mono' }, c.len ? c.len + ' m' : '—'),
        el('td', {}, el('span', { class: 'dot', style: { background: SIG[c.sig] ? SIG[c.sig].color : '#999' } }), ' ' + (SIG[c.sig] ? SIG[c.sig].label : c.sig)), el('td', { class: c.ok ? 'ok' : 'err' }, c.ok ? 'OK' : 'DÉFAUT')));
    }
    count.textContent = `${rows.length} câble${rows.length > 1 ? 's' : ''} sur ${all.length}${rows.length > 400 ? ' (400 premiers affichés)' : ''}`;
  }
  draw();
  return { el: box, update() { const k = buildCabling().length + ':' + buildCabling().filter((c) => !c.ok).length; if (k !== lastKey) { lastKey = k; draw(); } } };
}
function materielTab() {
  const box = el('div', { class: 'list' }, el('p', { class: 'note' }, 'Faces avant et arrière des appareils, d\'après les fiches techniques constructeurs (chaîne caméra type Sony HDC / HDCU / RCP, mélangeur Sony XVS-6000 et pupitre ICP-X7000, serveur EVS XT4K, télécommande LSM et IPDirector). Les connecteurs câblés dans votre installation sont entourés de la couleur du signal.'));
  const row = el('div', { class: 'grid2' });
  for (const [k, l] of DEVICE_LIST) row.appendChild(el('button', { class: 'choice', onclick: () => openDevice(k, k === 'cam' || k === 'ccu' || k === 'rcp' ? (S.cams[0] ? S.cams[0].id : 1) : 1) }, el('b', { style: { fontSize: '17px' } }, l), el('span', {}, DEV_NAMES[k] || '')));
  box.append(row);
  return box;
}
export function statusItems() {
  const out = [];
  for (const c of S.cams) {
    let level = 'ok', s = `${c.T.short} · ${LINKS[c.link].short}${c.route && c.route.length ? ' · ' + Math.round(c.route.length) + ' m' : ''}`;
    if (!c.status.ok) { level = 'err'; s += ' — ' + c.status.reason; }
    else if (c.rf && c.rf.state !== 'ok') { level = c.rf.state === 'lost' ? 'err' : 'warn'; s += ` — HF ${c.rf.state === 'lost' ? 'perdue' : 'erreurs'} (marge ${fmt(c.rf.margin, 1)} dB)`; }
    else if (!c.genlock) { level = 'err'; s += ' — référence non verrouillée'; }
    else if (c.status.warn) { level = 'warn'; s += ' — ' + c.status.warn; }
    out.push({ t: `CAM ${c.id}`, s, level });
  }
  const rec = recordedCams();
  out.push({ t: 'EVS', s: EVS.recording ? `Enregistrement en cours : ${rec.length ? rec.map((i) => 'CAM ' + i).join(', ') : 'aucune caméra'}` : 'ENREGISTREMENT ARRÊTÉ', level: EVS.recording ? (rec.length ? 'ok' : 'warn') : 'err' });
  const tx = ROUTER.map[S.txPath === 2 ? 'AUX_TX2' : 'AUX_TX1'];
  out.push({ t: 'Transmission', s: `Chemin TX${S.txPath} · source ${sourceLabel(tx)}${S.faults.tx && S.txPath === 1 ? ' · LIAISON COUPÉE' : ''}`, level: (S.faults.tx && S.txPath === 1) || tx !== 'PGM' ? 'err' : 'ok' });
  out.push({ t: 'Synchro', s: S.faults.gps ? 'SPG en holdover (GPS perdu) — référence stable quelques heures' : 'SPG verrouillé GPS', level: S.faults.gps ? 'warn' : 'ok' });
  out.push(...netStatus());
  return out;
}

// ----------------------------------------------------------------------------------
// Son
// ----------------------------------------------------------------------------------
// ----------------------------------------------------------------------------------
// HF
// ----------------------------------------------------------------------------------
function buildHF(body, arg, ctx) {
  const spec = el('canvas', { class: 'scope', width: 900, height: 300, style: { maxWidth: '100%', aspectRatio: '3 / 1' } });
  const map = el('canvas', { width: 360, height: 300, style: { width: '100%', aspectRatio: '6 / 5', maxHeight: '100%', background: '#0a0e12', border: '1px solid #2c3640', borderRadius: '3px', display: 'block' } });
  const cards = el('div', { class: 'panelgrid' });
  const ants = el('div', { class: 'list' });
  const firstHF = () => S.cams.find((c) => c.rf);
  const monSlot = el('div', { class: 'mon fill', 'data-gl': firstHF() ? 'CAM' + firstHF().id : 'BLACK' });
  ctx.dock.append(el('div', { class: 'monwrap' }, el('div', { class: 'lab' }, 'Analyseur de spectre (bande 2 GHz)'), spec),
    el('div', { class: 'dockrow' }, el('div', { class: 'monwrap grow' }, el('div', { class: 'lab' }, 'Image reçue (décodeur)'), monSlot), el('div', { class: 'monwrap grow' }, el('div', { class: 'lab' }, 'Couverture'), map)), ctx.explainBox);
  body.append(el('div', { class: 'hwpanel' }, el('h3', {}, 'Antennes de réception (diversité)'), ants),
    cards,
    el('p', { class: 'note' }, 'Bilan : niveau reçu = puissance + gains d\'antennes − affaiblissement en espace libre − obstacles. La marge = C/N combiné − C/N requis par la modulation. Au-dessous de 0 dB : macro-blocs, puis image figée et perte (effet falaise). Astuce : promenez-vous avec la Steadicam (prenez-la au bord du terrain, touche E) jusque dans le tunnel et regardez la marge.'));
  let lastKey = '';
  const opts = (obj) => Object.keys(obj).map((k) => [k, k]);
  const buildCards = () => {
    cards.innerHTML = '';
    const hf = S.cams.filter((c) => c.rf);
    if (!hf.length) cards.appendChild(el('div', { class: 'hwpanel' }, el('p', {}, 'Aucune caméra HF installée. Ouvrez le plan des caméras (P) et installez une Steadicam HF ou un drone.')));
    for (const c of hf) {
      const r = c.rf;
      const chOpts = RF.channels.map((ch) => [ch.f, `${(ch.f / 1000).toFixed(3)} GHz · ${ch.status === 'attrib' ? 'ATTRIBUÉ' : ch.status === 'occ' ? 'occupé' : ch.status === 'wifi' ? 'Wi-Fi' : 'libre'}`]);
      const live = el('div', { class: 'kv' });
      const bar = el('div', { style: { height: '10px', background: '#0a0e12', border: '1px solid #2c3640', borderRadius: '3px', overflow: 'hidden' } }, el('div', { style: { height: '100%', width: '50%', background: 'var(--pvw)' } }));
      const state = el('span', { class: 'pill' });
      const card = el('div', { class: 'hwpanel' }, el('h3', {}, `CAM ${c.id} · ${c.T.short} · émetteur COFDM`), el('div', { class: 'hwrow' }, state),
        el('div', { class: 'grid2' },
          field('Fréquence', selectEl(chOpts, r.ch, (v) => { r.ch = +v; const ci = channelInfo(r.ch); later(() => explain(`CAM ${c.id} sur ${fmt(r.ch / 1000, 3)} GHz${ci && ci.status !== 'attrib' ? ' : canal NON attribué par la coordination (' + (ci.status === 'libre' ? 'interdit sans autorisation' : ci.user) + ')' : ' : canal attribué par la coordination des fréquences'}. Regardez le spectre : la porteuse se déplace ; un brouilleur sur le même canal fait chuter le C/N.`, 'hf:ch')); })),
          field('Puissance', selectEl(TX_POWERS.map((p) => [p, p >= 1000 ? '1 W' : p + ' mW']), r.txmW, (v) => { const before = r.txmW; r.txmW = +v; later(() => explain(`Puissance ${r.txmW >= 1000 ? '1 W' : r.txmW + ' mW'} : ${fmt(10 * Math.log10(r.txmW / before), 1)} dB sur le bilan de liaison, donc sur la marge (${fmt(r.margin, 1)} dB). Plus de puissance = plus d'autonomie consommée et plus de risque de gêner les voisins.`, 'hf:pw')); })),
          field('Largeur de canal', selectEl([[8, '8 MHz'], [10, '10 MHz'], [20, '20 MHz']], r.bw, (v) => { r.bw = +v; later(() => explain(`Canal de ${r.bw} MHz : débit ${fmt(r.bitrate, 1)} Mb/s. Un canal plus large transporte plus de débit mais reçoit plus de bruit (+${fmt(10 * Math.log10(r.bw / 8), 1)} dB par rapport à 8 MHz) et occupe plus de spectre.`, 'hf:bw')); })),
          field('Modulation', selectEl(opts(MODS), r.mod, (v) => { r.mod = v; later(() => explain(`Modulation ${r.mod} : C/N requis ${fmt(r.req, 1)} dB, débit ${fmt(r.bitrate, 1)} Mb/s, marge ${fmt(r.margin, 1)} dB. Plus il y a de points dans la constellation, plus le débit monte et plus la liaison est fragile.`, 'hf:mod')); })),
          field('FEC', selectEl(opts(FECS), r.fec, (v) => { r.fec = v; later(() => explain(`FEC ${r.fec} : part des bits utiles. ${r.fec === '1/2' ? 'Beaucoup de redondance : robuste, débit réduit.' : 'Moins de redondance : plus de débit, moins robuste.'} C/N requis ${fmt(r.req, 1)} dB, débit ${fmt(r.bitrate, 1)} Mb/s.`, 'hf:fec')); })),
          field('Intervalle de garde', selectEl(opts(GUARDS), r.gi, (v) => { r.gi = v; later(() => explain(`Intervalle de garde ${r.gi} : temps « blanc » entre symboles OFDM pour absorber les échos (réflexions sur les tribunes). Plus long = plus robuste aux trajets multiples, moins de débit (${fmt(r.bitrate, 1)} Mb/s).`, 'hf:gi')); })),
          field('Latence encodeur', selectEl(Object.entries(LATENCY).map(([k, v]) => [k, v.label]), r.lat, (v) => { r.lat = v; later(() => explain(`Latence ${LATENCY[r.lat].label} : ${Math.round(r.latencyS * 1000)} ms entre la caméra et l'image décodée. Visible au multiview : la caméra HF est en retard sur les caméras filaires (attention au son et aux ralentis).`, 'hf:lat')); }))),
        el('div', { class: 'note' }, 'Marge'), bar, live);
      card.upd = () => {
        live.innerHTML = '';
        const rows = [['Débit utile', fmt(r.bitrate, 1) + ' Mb/s (HEVC 4:2:2 10 bits)'], ['C/N requis', fmt(r.req, 1) + ' dB'], ['C/N combiné', fmt(r.snr, 1) + ' dB'], ['Marge', fmt(r.margin, 1) + ' dB'], ['MER', fmt(r.mer, 1) + ' dB'], ['BER (avant correction)', r.ber ? r.ber.toExponential(1) : '< 1e-9'], ['Latence', Math.round(r.latencyS * 1000) + ' ms'], ['Interférence', r.I > -150 ? fmt(r.I, 0) + ' dBm' : 'aucune']];
        for (const [k, v] of rows) live.append(el('dt', {}, k), el('dd', {}, v));
        const ci = channelInfo(r.ch);
        if (ci && ci.status !== 'attrib') live.append(el('dt', {}, 'Coordination'), el('dd', { class: 'warn' }, ci.status === 'libre' ? 'Fréquence non attribuée : interdit sans autorisation.' : ci.user));
        bar.firstChild.style.width = clamp((r.margin + 5) / 30 * 100, 2, 100) + '%';
        bar.firstChild.style.background = r.margin > 3 ? 'var(--pvw)' : r.margin > 0 ? 'var(--amber)' : 'var(--tally)';
        state.className = 'pill ' + (r.state === 'ok' ? 'ok' : r.state === 'err' ? 'warn' : 'err');
        state.textContent = r.state === 'ok' ? 'VERROUILLÉ' : r.state === 'err' ? 'ERREURS' : 'PERDU';
      };
      cards.appendChild(card);
    }
  };
  const buildAnts = () => {
    ants.innerHTML = '';
    for (const a of RF.antennas) {
      const b = hwBtn(a.on ? 'ON' : 'OFF', { onclick: () => { a.on = !a.on; b.firstChild.textContent = a.on ? 'ON' : 'OFF'; b.classList.toggle('lit', a.on); later(() => explain(`Antenne « ${a.label} » ${a.on ? 'en service' : 'coupée'}. Le récepteur combine les antennes (diversité MRC) : ${a.on ? 'le C/N combiné remonte' : 'le C/N combiné baisse'} ; regardez la marge de chaque caméra.`, 'hf:ant')); } });
      b.classList.toggle('lit', a.on);
      const lv = el('div', { class: 's' });
      ants.appendChild(el('div', { class: 'item' }, b, el('div', { class: 'grow' }, el('div', { class: 't' }, a.label), el('div', { class: 's' }, `${a.kind === 'omni' ? 'Omnidirectionnelle' : 'Panneau secteur'} · ${a.gain} dBi`), lv)));
      a._lv = lv;
    }
  };
  buildAnts();
  const sg = spec.getContext('2d'), mg = map.getContext('2d');
  return {
    update() {
      const key = S.cams.filter((c) => c.rf).map((c) => c.id).join();
      if (key !== lastKey) { lastKey = key; buildCards(); const h = firstHF(); monSlot.dataset.gl = h ? 'CAM' + h.id : 'BLACK'; }
      $$('.hwpanel', cards).forEach((c) => c.upd && c.upd());
      for (const a of RF.antennas) {
        const parts = [];
        for (const c of S.cams) if (c.rf && c.rf.levels[a.id]) { const l = c.rf.levels[a.id]; parts.push(`CAM ${c.id} : ${fmt(l.lvl, 0)} dBm, C/N ${fmt(l.sinr, 0)} dB${l.walls ? ' (masqué)' : ''}`); }
        if (a._lv) a._lv.textContent = a.on ? (parts.join(' · ') || '—') : 'éteinte';
      }
      drawSpectrum(sg, 900, 300);
      drawRFMap(mg, 360, 300);
    },
  };
}
export function drawSpectrum(g, w, h) {
  g.fillStyle = '#05080a'; g.fillRect(0, 0, w, h);
  const f0 = 2020, f1 = 2500; const X = (f) => (f - f0) / (f1 - f0) * (w - 50) + 40; const Y = (d) => 10 + (h - 40) * (1 - (d + 110) / 80);
  g.strokeStyle = 'rgba(255,200,60,0.18)'; g.fillStyle = '#c8a040'; g.font = '11px monospace'; g.lineWidth = 1;
  for (let d = -110; d <= -30; d += 10) { g.beginPath(); g.moveTo(40, Y(d)); g.lineTo(w - 10, Y(d)); g.stroke(); g.fillText(String(d), 4, Y(d) + 4); }
  for (let f = 2050; f <= 2500; f += 50) { g.beginPath(); g.moveTo(X(f), 10); g.lineTo(X(f), h - 30); g.stroke(); g.fillText((f / 1000).toFixed(2), X(f) - 14, h - 14); }
  for (const ch of RF.channels) if (ch.status === 'attrib') { g.fillStyle = 'rgba(70,198,242,0.10)'; g.fillRect(X(ch.f - 5), 10, X(ch.f + 5) - X(ch.f - 5), h - 40); }
  g.fillStyle = 'rgba(255,80,80,0.08)'; g.fillRect(X(2400), 10, X(2500) - X(2400), h - 40);
  // trace
  g.beginPath(); g.strokeStyle = '#ffd23f'; g.lineWidth = 1.5;
  const carriers = [];
  for (const ch of RF.channels) { if (ch.status === 'occ') carriers.push([ch.f, 8, -74]); }
  for (let f = 2402; f < 2480; f += 22) carriers.push([f, 20, -66 + Math.random() * 10]);
  if (S.faults.jam) carriers.push([S.faults.jam.f, 10, -52]);
  for (const c of S.cams) if (c.rf) carriers.push([c.rf.ch, c.rf.bw, c.rf.bestLevel ?? -100, 'cam', c.id]);
  for (let px = 40; px < w - 10; px++) {
    const f = f0 + (px - 40) / (w - 50) * (f1 - f0);
    let p = Math.pow(10, (-101 + (Math.random() - 0.5) * 3) / 10);
    for (const [fc, bw, lv] of carriers) { const d = Math.abs(f - fc); if (d < bw / 2) p += Math.pow(10, (lv - 2 + Math.random() * 2) / 10); else if (d < bw / 2 + 2) p += Math.pow(10, (lv - 30) / 10); }
    const y = Y(10 * Math.log10(p)); if (px === 40) g.moveTo(px, y); else g.lineTo(px, y);
  }
  g.stroke();
  g.font = '600 12px "Saira Condensed", sans-serif'; g.textAlign = 'center';
  for (const [fc, bw, lv, kind, id] of carriers) if (kind === 'cam') { g.fillStyle = '#c77dff'; g.fillText('CAM ' + id, X(fc), Y(lv) - 8); }
  g.fillStyle = '#ff8080'; g.fillText('Wi-Fi 2,4 GHz', X(2440), 24);
  g.fillStyle = '#46c6f2'; g.fillText('canaux attribués', X(2190), h - 34);
}
export function drawRFMap(g, w, h) {
  g.fillStyle = '#0a0e12'; g.fillRect(0, 0, w, h);
  const sx = w / 260, sz = h / 230; const X = (x) => w / 2 + x * sx, Z = (z) => h / 2 + z * sz * 1.0 - 20;
  g.strokeStyle = '#2c3640'; g.strokeRect(X(-113), Z(-93), 226 * sx, 186 * sz);
  g.fillStyle = '#1d4a25'; g.fillRect(X(-61), Z(-41), 122 * sx, 82 * sz);
  g.strokeStyle = '#3b6a40'; g.strokeRect(X(-52.5), Z(-34), 105 * sx, 68 * sz);
  g.fillStyle = '#2b3036'; g.fillRect(X(-4), Z(-93), 8 * sx, 52 * sz);
  g.fillStyle = '#5a6570'; g.fillRect(X(-27), Z(-123), 18 * sx, 6 * sz);
  for (const a of RF.antennas) { g.fillStyle = a.on ? '#c77dff' : '#444'; g.beginPath(); g.arc(X(a.pos[0]), Z(a.pos[2]), 5, 0, 7); g.fill(); }
  for (const c of S.cams) if (c.rf) {
    const p = c.cam.position; const col = c.rf.state === 'ok' ? '#2fd25a' : c.rf.state === 'err' ? '#ffb020' : '#ff3b30';
    for (const a of RF.antennas) if (a.on && c.rf.levels[a.id]) { g.strokeStyle = c.rf.levels[a.id].walls ? 'rgba(255,80,80,0.5)' : 'rgba(47,210,90,0.35)'; g.beginPath(); g.moveTo(X(p.x), Z(p.z)); g.lineTo(X(a.pos[0]), Z(a.pos[2])); g.stroke(); }
    g.fillStyle = col; g.beginPath(); g.arc(X(p.x), Z(p.z), 6, 0, 7); g.fill();
    g.fillStyle = '#fff'; g.font = '600 12px "Saira Condensed", sans-serif'; g.fillText('CAM ' + c.id, X(p.x) + 8, Z(p.z) - 6);
  }
  g.fillStyle = '#93a0ab'; g.font = '11px sans-serif'; g.fillText('Car', X(-26), Z(-126));
}

// ----------------------------------------------------------------------------------
// Grille
// ----------------------------------------------------------------------------------
function buildRouter(body, arg, ctx) {
  ctx.dock.append(dmon('mv', 'Multiview (les tuiles suivent les sorties MV de la grille)'));
  let group = 'Mélangeur', dest = 'ME1', srcSel = null;
  const groups = [...new Set(DESTS.map((d) => d.group))];
  const tabs = el('div', { class: 'tabs' });
  const dGrid = el('div', { class: 'hwrow' });
  const sGrid = el('div', { class: 'hwrow' });
  const cur = el('div', { class: 'lcd amber' });
  const errBox = el('div', { class: 'note err' });
  const ip = S.ipMode;
  const take = hwBtn(ip ? 'CONNECT' : 'TAKE', { cls: 'big', onclick: () => { if (!srcSel) return; const err = route(dest, srcSel); errBox.textContent = err || ''; if (!err) { toast(`${labelDest(dest)} ← ${sourceLabel(srcSel)}`, 'good'); if (ip) explain(`IS-05 : le contrôleur demande au récepteur « ${labelDest(dest)} » de s'abonner au flux de ${sourceLabel(srcSel)} (multicast ${mcastOf(srcSel)}, ${String(flowGbps()).replace('.', ',')} Gb/s par réseau). La commutation se fait au changement d'image grâce au PTP.`, 'grille:take'); } else explain(err, 'warn'); srcSel = null; } });
  const labelDest = (id) => { const d = DESTS.find((x) => x.id === id); return d ? `${d.group} · ${d.label}` : id; };
  const buildTabs = () => { tabs.innerHTML = ''; for (const g of groups) tabs.appendChild(el('button', { class: 'tab' + (g === group ? ' on' : ''), onclick: () => { group = g; dest = DESTS.find((d) => d.group === g).id; srcSel = null; buildTabs(); buildDests(); } }, g)); };
  const buildDests = () => { dGrid.innerHTML = ''; for (const d of DESTS.filter((x) => x.group === group)) { const b = hwBtn(d.label.replace('Entrée ', '').replace('Tuile ', 'MV '), { sub: sourceLabel(ROUTER.map[d.id]), onclick: () => { dest = d.id; srcSel = null; explain(`Destination choisie : ${d.group} · ${d.label}, qui reçoit actuellement ${sourceLabel(ROUTER.map[d.id])}. Choisissez maintenant la source.`, 'grille:sel'); } }); b.dataset.d = d.id; dGrid.appendChild(b); } };
  const buildSrcs = () => { sGrid.innerHTML = ''; for (const s of allSources()) { const b = hwBtn(s.id.startsWith('CAM') ? 'CAM ' + s.short : s.short, { sub: s.id.startsWith('CAM') ? (s.cam ? s.cam.T.short : 'libre') : '', onclick: () => { srcSel = s.id; explain(`Source présélectionnée : ${sourceLabel(s.id)}. Rien n'est commuté tant que vous n'appuyez pas sur TAKE (sécurité contre les fausses manœuvres).`, 'grille:sel'); } }); b.dataset.s = s.id; if (!s.exists || (s.id.startsWith('CAM') && !s.cam)) b.classList.add('dead'); sGrid.appendChild(b); } };
  buildTabs(); buildDests(); buildSrcs();
  const netBox = el('div', { class: 'list' });
  const netPanel = ip ? el('div', { class: 'hwpanel' }, el('h3', {}, 'Réseau ST 2110 · contrôleur NMOS'),
    el('p', { class: 'note' }, `Dans ce car IP, la « grille » est un contrôleur NMOS : il demande à chaque récepteur de s'abonner au flux de l'émetteur choisi, sur deux réseaux spine-leaf indépendants (rouge et bleu, ST 2022-7), synchronisés par PTP. Un flux vidéo ${S.format === 'UHD' ? 'UHD' : 'HD'} fait ≈ ${String(fmt(flowGbps(), 2)).replace('.', ',')} Gb/s par réseau. Le détail (commutateurs, VLAN, multicast, PTP) est au poste « Réseau IP ».`), netBox,
    el('div', { class: 'hwrow' },
      el('button', { class: 'btn small primary', onclick: () => openStation('reseau') }, 'Ouvrir le poste Réseau IP'),
      el('button', { class: 'btn small', onclick: () => { FAB.registryUp = true; markDirty(); explain('Registre NMOS redémarré : les appareils se réenregistrent (IS-04) et le contrôleur peut de nouveau établir des connexions (IS-05).'); } }, 'Redémarrer le registre NMOS'))) : null;
  body.append(netPanel, el('div', { class: 'hwpanel' }, el('h3', {}, ip ? '1 · Récepteur (destination)' : '1 · Destination'), tabs, dGrid),
    el('div', { class: 'hwpanel' }, el('h3', {}, ip ? '2 · Émetteur (source)' : '2 · Source'), sGrid),
    el('div', { class: 'hwpanel' }, el('h3', {}, ip ? '3 · Connecter (IS-05)' : '3 · Prendre'), el('div', { class: 'hwrow' }, cur, take,
      el('button', { class: 'btn', onclick: () => { ROUTER.customMV = false; ROUTER.customREC = false; defaultRouting(true); emit('router', {}); toast('Salvo « match » rappelé : configuration par défaut de la grille'); explain('Salvo : un ensemble de points de croisement enregistré et rappelé en une seule action. On en prépare pour chaque configuration (avant-match, match, mi-temps).'); } }, 'Rappeler le salvo par défaut'),
      el('button', { class: 'btn', onclick: () => openDevice('router', 1) }, 'Voir le châssis de la grille')), errBox,
      el('p', { class: 'note' }, 'Une caméra super ralenti 3x occupe 3 entrées REC consécutives (une par phase). Le départ TX1 doit recevoir le PGM : vérifiez toujours le retour antenne après une manipulation.')));
  let lk = '';
  return {
    update() {
      const k = Object.values(ROUTER.map).join() + S.cams.map((c) => c.id + c.type).join();
      if (k !== lk) { lk = k; buildDests(); buildSrcs(); }
      $$('button', dGrid).forEach((b) => b.classList.toggle('lit', b.dataset.d === dest));
      const curSrc = ROUTER.map[dest];
      $$('button', sGrid).forEach((b) => { b.classList.toggle('lit2', b.dataset.s === curSrc); b.classList.toggle('lit', b.dataset.s === srcSel); });
      cur.textContent = `${labelDest(dest)} ← ${sourceLabel(curSrc)}${ip ? ' (' + mcastOf(curSrc) + ')' : ''}${srcSel ? '  ⇒  ' + sourceLabel(srcSel) + (ip ? ' (' + mcastOf(srcSel) + ')' : '') : ''}`;
      take.classList.toggle('lit', !!srcSel);
      if (ip) { netBox.innerHTML = ''; for (const it of netStatus()) netBox.appendChild(el('div', { class: 'item' }, el('span', { class: 'dot ' + (it.level === 'err' ? 'red' : it.level === 'warn' ? 'amber' : 'green') }), el('div', { class: 'grow' }, el('div', { class: 't' }, it.t), el('div', { class: 's' }, it.s)))); }
    },
  };
}

// ----------------------------------------------------------------------------------
// Baie CCU
// ----------------------------------------------------------------------------------
function buildCCU(body, arg, ctx) {
  const list = el('div', { class: 'list' });
  ctx.dock.append(dmon('mv', 'Multiview', ''), ctx.explainBox);
  body.append(el('div', { class: 'hwpanel' }, el('h3', {}, 'Voies caméras (CCU)'), list),
    el('p', { class: 'note' }, 'Le niveau optique est mesuré par la CCU sur la fibre retour. Une fibre sale ou pincée fait chuter ce niveau ; une coupure fait perdre l\'image et le contrôle de la caméra.'));
  let lk = '';
  const rows = {};
  const build = () => {
    list.innerHTML = '';
    for (let i = 1; i <= S.maxCams; i++) {
      const c = camById(i);
      const info = el('div', { class: 'grow' }, el('div', { class: 't' }, `CCU ${i}`), el('div', { class: 's' }, c ? `${c.T.short} · ${LINKS[c.link].short} · ${c.route && c.route.length ? Math.round(c.route.length) + ' m' : 'sans câble'}` : 'non affectée'));
      const st = el('span', { class: 'pill' });
      const bars = c ? hwBtn('BARS', { onclick: () => { c.paint.bars = !c.paint.bars; explain(c.paint.bars ? `CCU ${i} : barres de couleur. Elles sont générées dans la CCU/caméra et passent par toute la chaîne : si on les voit sur la bonne tuile du multiview, la liaison et l'affectation de la grille sont bonnes.` : `CCU ${i} : retour de l'image caméra.`, 'ccu:bars'); } }) : null;
      const fix1 = c ? el('button', { class: 'btn small', onclick: () => { c.fiberCut = false; c.checkLink(); toast(`CAM ${i} : basculée sur la fibre de secours`, 'good'); emit('repair', 'fibre'); explain(`CAM ${i} : basculée sur la fibre de secours. Dans un car, on tire toujours des fibres de réserve dans les multipaires ; au pied de car on change de brin. Ensuite : nettoyer les connecteurs (lingette et stylo de nettoyage) et mesurer le niveau optique.`); } }, 'Fibre de secours') : null;
      const fix2 = c ? el('button', { class: 'btn small', onclick: () => { c.genlock = true; toast(`CCU ${i} : référence re-verrouillée`, 'good'); emit('repair', 'genlock'); explain(`CCU ${i} : référence re-verrouillée (voyant REF IN allumé, UNLOCK éteint). La caméra est de nouveau en phase avec les autres sources : plus de saut à la commutation.`); } }, 'Re-verrouiller la réf.') : null;
      const see = c ? el('button', { class: 'btn small', onclick: () => openDevice('ccu', i) }, 'Faces CCU') : null;
      const row = el('div', { class: 'item' + (c ? '' : ' dim') }, el('span', { class: 'dot' }), info, st, bars, fix1, fix2, see);
      rows[i] = { row, st, bars, fix1, fix2, dot: row.firstChild };
      list.appendChild(row);
    }
  };
  return {
    update() {
      const k = S.cams.map((c) => c.id + c.link + c.type).join();
      if (k !== lk) { lk = k; build(); }
      for (let i = 1; i <= S.maxCams; i++) {
        const c = camById(i); const r = rows[i]; if (!r) continue;
        if (!c) { r.st.textContent = '—'; r.st.className = 'pill'; continue; }
        const optical = c.link === 'hf' || c.link === 'coax' ? null : -4 - (c.route.length / 1000) * 0.4 - 1.5 - (c.id % 3) * 0.7;
        let txt = '', cls = 'ok';
        if (c.fiberCut) { txt = 'OPTIQUE : PAS DE SIGNAL (< -30 dBm)'; cls = 'err'; }
        else if (!c.status.ok) { txt = c.status.power ? 'ERREUR LIAISON' : 'ALIM. COUPÉE (câble trop long)'; cls = 'err'; }
        else if (!c.genlock) { txt = S.ipMode && !camPtpOk(c.id) ? 'PTP NON VERROUILLÉ (poste Réseau IP)' : 'RÉF. NON VERROUILLÉE'; cls = 'err'; }
        else if (c.rf) { txt = `HF ${c.rf.state === 'ok' ? 'OK' : c.rf.state === 'err' ? 'ERREURS' : 'PERDUE'} · marge ${fmt(c.rf.margin, 1)} dB`; cls = c.rf.state === 'ok' ? 'ok' : c.rf.state === 'err' ? 'warn' : 'err'; }
        else txt = `ALIM. ${LINKS[c.link].power ? 'CCU' : 'LOCALE'} · ${optical != null ? 'OPT. ' + fmt(optical, 1) + ' dBm · ' : ''}RÉF. LOCK`;
        r.st.textContent = txt; r.st.className = 'pill ' + cls; r.dot.className = 'dot ' + (cls === 'ok' ? 'green' : cls === 'warn' ? 'amber' : 'red');
        if (r.bars) r.bars.classList.toggle('lit', c.paint.bars);
        if (r.fix1) r.fix1.hidden = !c.fiberCut; if (r.fix2) r.fix2.hidden = c.genlock;
      }
    },
  };
}

function buildSync(body, arg, ctx) {
  ctx.dock.append(dmon('mv', 'Multiview', ''));
  const tcB = el('div', { class: 'lcd amber big' });
  const st = el('div', { class: 'kv' });
  body.append(el('div', { class: 'panelgrid' }, el('div', { class: 'hwpanel' }, el('h3', {}, 'Générateur de synchro principal'), tcB, st,
    el('div', { class: 'hwrow' }, el('button', { class: 'btn small', onclick: () => { S.faults.gps = !S.faults.gps; explain(S.faults.gps ? 'GPS perdu : le SPG passe en holdover. Son oscillateur (OCXO) continue de générer la référence avec une dérive de l\'ordre de quelques ns par heure : l\'antenne n\'est pas affectée.' : 'GPS retrouvé : le SPG se ré-asservit lentement (sans saut de phase) pour ne pas perturber les équipements.', 'sync:gps'); } }, 'Simuler une perte GPS'),
      el('button', { class: 'btn small', onclick: () => { for (const c of S.cams) c.genlock = true; toast('Toutes les CCU re-verrouillées sur la référence', 'good'); emit('repair', 'genlock'); explain('Toutes les CCU re-verrouillées : elles reçoivent le tri-level (ou black burst) du SPG par les distributeurs et alignent leur sortie sur la même phase.'); } }, 'Re-verrouiller toutes les CCU'),
      el('button', { class: 'btn small', onclick: () => openDevice('spg', 1) }, 'Voir le SPG'), el('button', { class: 'btn small', onclick: () => openDevice('da', 1) }, 'Voir les DA de référence')),
      S.ipMode ? el('div', { class: 'hwrow' }, el('button', { class: 'btn small', onclick: () => { FAB.gm.gm1.up = !FAB.gm.gm1.up; markDirty(); explain(FAB.gm.gm1.up ? 'Grand maître PTP 1 remis en service : avec la meilleure priorité (priority1 100) et le GPS verrouillé, il est réélu par l\'algorithme BMCA.' : 'Grand maître 1 coupé : après 3 messages Announce manqués, les horloges frontières (commutateurs) élisent le grand maître 2. Les appareils restent synchronisés.', 'sync:ptp'); } }, 'Couper / rétablir le grand maître PTP 1'), el('button', { class: 'btn small', onclick: () => { FAB.gm.gm2.up = !FAB.gm.gm2.up; markDirty(); } }, 'Couper / rétablir le grand maître PTP 2'), el('button', { class: 'btn small', onclick: () => openStation('reseau', null) }, 'PTP détaillé (poste Réseau IP)')) : null),
    el('div', { class: 'hwpanel prose' }, el('h3', {}, 'Pourquoi synchroniser ?'), el('p', {}, STATION_INFO.synchro.role), el('p', {}, 'Le SPG est asservi au GPS. S\'il perd le GPS, il passe en « holdover » : son oscillateur interne garde la référence stable pendant des heures, l\'antenne continue. Si une CCU perd la référence, son image saute ou roule à la commutation : c\'est visible immédiatement au multiview.'))));
  return {
    update() {
      tcB.textContent = tc(S.tcOffset + S.simTime);
      st.innerHTML = '';
      const rows = [['Verrouillage', S.faults.gps ? 'HOLDOVER (GPS perdu)' : 'GPS LOCK · 11 satellites'], ['Sorties BB', 'Black burst 625 lignes 50 Hz × 4'], ['Sorties tri-level', S.format === 'HDi' ? '1080i50 × 4' : '1080p50 × 4'], ['Timecode', 'LTC 25 i/s, heure locale'], ['Horloge audio', 'Word clock 48 kHz'], ['PTP', 'Grand maître ST 2059-2, domaine 127'], ['Secours', 'SPG n°2 en veille, bascule automatique']];
      for (const [k, v] of rows) st.append(el('dt', {}, k), el('dd', {}, v));
      if (S.ipMode) for (const it of netStatus().filter((x) => x.t === 'PTP')) st.append(el('dt', {}, 'PTP (car IP)'), el('dd', { class: it.level === 'ok' ? '' : it.level === 'warn' ? 'warn' : 'err' }, `${it.s} · horloges frontières dans les commutateurs`));
      const bad = S.cams.filter((c) => !c.genlock).map((c) => 'CAM ' + c.id);
      if (bad.length) st.append(el('dt', {}, 'Alarmes'), el('dd', { class: 'err' }, 'Référence non verrouillée : ' + bad.join(', ')));
    },
  };
}

function buildTX(body, arg, ctx) {
  const st = el('div', { class: 'kv' });
  const p1 = hwBtn('TX1', { sub: 'fibre', onclick: () => { S.txPath = 1; explain('Chemin TX1 (fibre opérateur, encodeur JPEG XS) : faible latence et haute qualité. C\'est le chemin principal.', 'tx:path'); } });
  const p2 = hwBtn('TX2', { sub: 'satellite', onclick: () => { S.txPath = 2; emit('repair', 'tx'); explain('Chemin TX2 (satellite, HEVC) : secours indépendant de la fibre. Latence plus forte (≈ 0,5 s de trajet + codage), et le retour antenne arrive encore plus tard.', 'tx:path'); } });
  const test = hwBtn('ENVOYER LA MIRE', { sub: 'test de ligne', onclick: () => { const cur = ROUTER.map.AUX_TX1; if (cur === 'BARS') { route('AUX_TX1', 'PGM'); route('AUX_TX2', 'PGM'); } else { route('AUX_TX1', 'BARS'); route('AUX_TX2', 'BARS'); } } });
  ctx.dock.append(el('div', { class: 'dockrow' }, dmon(S.txPath === 2 ? 'AUX_TX2' : 'AUX_TX1', 'Départ vers la chaîne'), dmon('RETANT', 'Retour antenne (après diffusion)')));
  body.append(el('div', { class: 'panelgrid' }, el('div', { class: 'hwpanel' }, el('h3', {}, 'Chemin de transmission'), el('div', { class: 'hwrow' }, p1, p2, test), st),
      el('div', { class: 'hwpanel prose' }, el('h3', {}, 'À retenir'), el('p', {}, STATION_INFO.transmission.tips[0]), el('p', {}, 'Test de ligne avant l\'antenne : on envoie la mire avec le 1 kHz, la chaîne confirme réception et niveaux. Les deux chemins (fibre et satellite) sont testés.'))));
  return {
    update() {
      p1.classList.toggle('lit', S.txPath === 1); p2.classList.toggle('lit', S.txPath === 2); test.classList.toggle('lit', ROUTER.map.AUX_TX1 === 'BARS');
      const mon = $('[data-gl^="AUX_TX"]', ctx.dock); if (mon) mon.dataset.gl = S.txPath === 2 ? 'AUX_TX2' : 'AUX_TX1';
      st.innerHTML = '';
      const rows = [['TX1', `Fibre opérateur · encodeur JPEG XS ${S.format === 'UHD' ? '600' : '200'} Mb/s · source ${sourceLabel(ROUTER.map.AUX_TX1)}${S.faults.tx ? ' · COUPÉE' : ''}`], ['TX2', `DSNG satellite · HEVC ${S.format === 'UHD' ? '60' : '25'} Mb/s · source ${sourceLabel(ROUTER.map.AUX_TX2)}`], ['Chemin actif', 'TX' + S.txPath], ['Délai du retour', fmt(P.delay.delay, 2).replace('.', ',') + ' s (encodage + satellite + décodage)'],
        ['Plan de son (embedder)', soundPlanOk() ? `conforme : ${AU.emb.map((v, i) => `${2 * i + 1}-${2 * i + 2} ${embLabel(v)}`).join(' · ')}` : 'NON CONFORME — voir la régie son'],
        ['Synchro son / image', avOk() ? 'dans la tolérance' : `HORS TOLÉRANCE (${avOffsetMs() > 0 ? '+' : ''}${avOffsetMs()} ms)`]];
      for (const [k, v] of rows) st.append(el('dt', {}, k), el('dd', { class: (k === 'TX1' && S.faults.tx) || (k.startsWith('Plan') && !soundPlanOk()) || (k.startsWith('Synchro') && !avOk()) ? 'err' : '' }, v));
    },
  };
}

function buildIntercom(body, arg, ctx) {
  const TYPES = {
    conf: ['CONF', 'Conférence (partyline) : tous les membres s\'entendent et peuvent se parler.'],
    p2p: ['P2P', 'Point à point : une liaison privée entre deux pupitres, les autres n\'entendent pas.'],
    ifb: ['IFB', 'IFB (interruptible foldback) : le destinataire entend un programme ; quand on parle, ce programme est atténué (dim) et la voix passe par-dessus.'],
    w4: ['4 FILS', 'Liaison 4 fils : une paire pour parler, une pour écouter, vers un système extérieur (la chaîne, un autre car).'],
    hyb: ['HYBRIDE', 'Hybride téléphonique / SIP : relie l\'intercom à une ligne téléphonique.'],
    gpo: ['GPO', 'Sortie relais : la touche ferme un contact (voyant, buzzer, commande d\'un appareil).'],
  };
  const keys = [
    ['ORDRES', 'conf', 'La conférence « Ordres » : le réalisateur parle à tout le car et à tous les cadreurs. Tout le monde écoute, seuls quelques pupitres y parlent.'],
    ['CAMÉRAS', 'conf', 'Les cadreurs : la voix sort de la matrice sur une carte 4 fils, entre dans chaque CCU par son connecteur INTERCOM/TALLY (D-sub 50, canal PROD), voyage dans la fibre caméra et arrive au casque du cadreur (XLR-5 INTERCOM sur la tête).'],
    ...S.cams.slice(0, 6).map((c) => [`CAM ${c.id}`, 'p2p', `Point à point avec le cadreur de la CAM ${c.id} (${c.T.short}) : pour lui parler sans déranger les autres.${c.link === 'hf' ? ' Caméra HF : l\'intercom passe par une liaison radio séparée (talkie numérique ou retour HF).' : ''}`]),
    ['ENG', 'conf', 'Canal ENG (technique) : la vision, le chef de car et les cadreurs parlent des problèmes techniques sans polluer les ordres de la production. Sur les caméras Sony, PROD et ENG sont deux canaux distincts du connecteur intercom.'],
    ['VISION', 'p2p', 'Ligne directe avec les ingénieurs vision.'],
    ['EVS', 'conf', 'Les opérateurs ralentis : le réalisateur demande les angles, l\'opérateur annonce « EVS A prêt ».'],
    ['SON', 'p2p', 'Ligne directe avec l\'ingénieur du son.'],
    ['TRUQUISTE', 'p2p', 'Le truquiste est souvent à côté du réalisateur, mais garde une touche pour les pupitres déportés.'],
    ['COMMENT.', 'ifb', 'IFB des commentateurs : ils entendent le programme (et leur propre voix) ; quand la production leur parle, le programme baisse.'],
    ['CHAÎNE', 'w4', 'Coordination avec la régie finale de la chaîne : top départ, compte à rebours, pubs, incidents.'],
    ['TÉLÉPHONE', 'hyb', 'Pour joindre un intervenant extérieur (le stade, la sécurité, un duplex).'],
    ['VOYANT', 'gpo', 'Allume le voyant « réalisateur au micro » dans le compound (exemple de sortie relais).'],
  ];
  const state = {};
  const grid = el('div', { class: 'icp' });
  for (const [l, t, d] of keys) {
    const st = state[l] = { talk: false, listen: t === 'conf' || t === 'ifb' };
    const talk = el('button', { class: 'icp-talk', onclick: () => { st.talk = !st.talk; upd(); if (st.talk) intercom('ORDRES', `Canal ouvert vers : ${l}`); explain(`TALK ${l} ${st.talk ? 'ouvert' : 'fermé'} · ${TYPES[t][1]} ${d}`, 'icom:' + l); } }, 'TALK');
    const lis = el('button', { class: 'icp-lis', onclick: () => { st.listen = !st.listen; upd(); explain(`LISTEN ${l} ${st.listen ? 'activé : vous entendez ce canal' : 'coupé : vous n\'entendez plus ce canal'}. Chaque touche a un volume d'écoute réglable ; on coupe les canaux inutiles pour rester concentré.`, 'icom:l' + l); } }, 'LISTEN');
    const k = el('div', { class: 'icp-key' }, el('div', { class: 'icp-lcd' }, el('b', {}, l), el('small', {}, TYPES[t][0])), el('div', { class: 'icp-btns' }, talk, lis));
    const upd = () => { talk.classList.toggle('on', st.talk); lis.classList.toggle('on', st.listen); k.classList.toggle('talking', st.talk); };
    upd(); grid.appendChild(k);
  }
  body.append(el('div', { class: 'hwpanel' }, el('h3', {}, 'Pupitre d\'intercom (poste réalisateur, 16 touches)'), grid,
      el('p', { class: 'note' }, 'Comme sur les pupitres numériques (Riedel, Clear-Com…) : chaque touche a une fonction TALK (parler, en appui bref = momentané, appui long = verrouillé) et LISTEN (écouter). L\'afficheur indique la destination et son type.'),
      el('div', { class: 'hwrow' }, el('button', { class: 'btn small', onclick: () => openDevice('icom', 1) }, 'Voir la matrice d\'intercom'), el('button', { class: 'btn small', onclick: () => openDevice('ccu', S.cams[0] ? S.cams[0].id : 1, { focus: 'icom' }) }, 'Voir l\'entrée intercom d\'une CCU'))),
    el('div', { class: 'panelgrid' },
      el('div', { class: 'hwpanel prose' }, el('h3', {}, 'Le trajet d\'un ordre jusqu\'au cadreur'), el('ol', { class: 'steps' },
        el('li', {}, 'Micro col de cygne du pupitre → convertisseur dans le pupitre → liaison numérique (AES3, fibre ou AES67) vers la matrice.'),
        el('li', {}, 'La matrice route la voix vers la conférence « CAMÉRAS » : sortie sur une carte 4 fils analogique ou numérique.'),
        el('li', {}, 'Câble multipaire vers la baie CCU : connecteur INTERCOM/TALLY/IO (D-sub 50) de chaque CCU, canaux PROD et ENG.'),
        el('li', {}, 'La CCU multiplexe l\'audio dans la fibre hybride avec la vidéo retour, le tally et les commandes.'),
        el('li', {}, 'Sur la caméra : connecteur INTERCOM 1 (XLR-5) → casque du cadreur. Le micro du casque repart dans l\'autre sens.'))),
      el('div', { class: 'hwpanel prose' }, el('h3', {}, 'Et le tally ?'), el('p', {}, 'Le mélangeur sait quelle source est au PGM (rouge) et en preset (vert). Il l\'envoie à un contrôleur de tally (GPI ou protocole TSL UMD sur IP), qui allume le tally de chaque CCU (contacts R/G/Y du D-sub 50). La CCU transmet l\'information à la caméra : voyant sur la tête, dans le viseur, et indication sur le RCP. Le même système envoie les noms de sources (UMD) au multiview.'),
        el('p', {}, STATION_INFO.intercom.role))),
    el('div', { class: 'hwpanel prose' }, el('h3', {}, 'Équipements'), el('ul', { class: 'steps' }, STATION_INFO.intercom.gear.map((g) => el('li', {}, g)))));
  return {};
}

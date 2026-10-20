// @ts-check
import { openDiag } from './diag_ui.js';
import { openDevice } from '../equipment/viewer.js';
import { openTrainer } from './config.js';
import { openReport } from './report.js';
import { qify, openLexique } from './term.js';
import { CFG } from '../shared.js';
import { DEVICE_LIST, DEVICES } from '../equipment/devices.js';
import { S, emit, on, camById } from '../state.js';
import { el } from '../util.js';
import { CONTROLS_HELP } from '../content/controls.js';
import { GLOSSARY } from '../content/glossary.js';
import { GUIDE } from '../content/guide.js';
import { STATION_INFO, STATION_LIST } from '../content/stations.js';
import { LIGHTING } from '../data/exposure.js';
import { $, modal, openInfo, toast, selectEl, field } from './common.js';
import { MIX, meSource, EVS } from '../pipeline.js';
import { GFX } from '../gfx.js';
import { RF } from '../rf.js';

const cam = (slot) => S.cams.find((c) => c.slotId === slot);
export const MISSIONS = [
  { id: 'm1', title: 'Le compound', text: 'Approchez-vous du pied de car (le panneau de raccordement à l\'arrière droit du car régie) et appuyez sur E pour le découvrir.', check: () => S.openedInfo.pieddecar },
  { id: 'm2', title: 'Le plan de caméras', text: 'Ouvrez le plan (touche P). Installez une caméra tribune sur « Passerelle centrale – position 1 » avec la consigne « Plan large ».', check: () => { const c = cam('g_c1'); return c && c.role === 'large'; } },
  { id: 'm3', title: 'Câbler la caméra 1', text: 'Dans le plan, vérifiez la liaison de cette caméra : fibre SMPTE ou pré-câblage, longueur dans la limite. Le câble apparaît en couleur jusqu\'au pied de car.', check: () => { const c = cam('g_c1'); return c && c.status.ok && ['smpte', 'precab', 'smf'].includes(c.link); } },
  { id: 'm3b', title: 'Les connecteurs de la caméra', text: 'Visez la caméra 1 dans le stade et appuyez sur I (ou, dans le plan, « Voir le matériel ») : cliquez sur un connecteur, par exemple la fibre CCU ou l\'intercom du cadreur, pour savoir à quoi il sert et où il est câblé.', check: () => S.seenPort && Object.keys(S.seenPort).some((k) => k.startsWith('cam:')) },
  { id: 'm4', title: 'Le serré', text: 'Installez une deuxième caméra sur la position 2 avec un très long zoom (UA107 ou UJ122) et la consigne « Serré porteur du ballon ».', check: () => { const c = cam('g_c2'); return c && c.role === 'serre' && c.L.fmax >= 900; } },
  { id: 'm5', title: 'Une caméra HF', text: 'Installez une Steadicam HF au bord du terrain et allumez au moins deux antennes de réception. Objectif : une marge HF supérieure à 3 dB.', check: () => S.cams.some((c) => c.rf && c.rf.margin > 3) && RF.antennas.filter((a) => a.on).length >= 2 },
  { id: 'm6', title: 'Entrer dans le car', text: 'Rejoignez le car régie (Tab, le pupitre, puis « Devant le car ») et entrez par les marches de la porte.', check: () => S.inTruck },
  { id: 'm7', title: 'Le multiview', text: 'Asseyez-vous au poste Truquiste · Mélangeur (E). Repérez le PGM (cadre rouge, à droite) et le PVW (cadre vert, à gauche).', check: () => S.visited.melangeur },
  { id: 'm8', title: 'Premier enchaîné', text: 'Au mélangeur : plan large au PGM, serré au PST, choisissez MIX puis AUTO (ou Entrée).', check: () => S.stats.mixes >= 1 },
  { id: 'm9', title: 'Exposition', text: 'Au poste Ingé vision, réglez l\'iris de la CAM 1 pour un niveau moyen entre 35 et 55 % (lisez le waveform).', check: () => { const c = camById(1); return S.visited.vision && c && c.meter.mean > 0.35 && c.meter.mean < 0.55; } },
  { id: 'm10', title: 'Le matching', text: 'Toujours en vision : égalisez la colorimétrie des CAM 1 et 2 (écarts rouge et bleu inférieurs à 2 %, voir sous les gains). AUTO WHITE ou réglage fin des gains R/B.', check: () => { const a = camById(1), b = camById(2); if (!a || !b || !S.visited.vision) return false; const ea = a.colorError(), eb = b.colorError(); return Math.abs(ea.r) < 0.02 && Math.abs(ea.b) < 0.02 && Math.abs(eb.r) < 0.02 && Math.abs(eb.b) < 0.02; } },
  { id: 'm10b', title: 'Les barres au line-up', text: 'Au poste Ingé vision, envoyez les barres d\'une caméra (touche BARS du RCP), retrouvez-les sur le multiview, puis revenez à l\'image.', check: () => S.flags && S.flags.barsCycle },
  { id: 'm11', title: 'Habillage', text: 'Mettez le score à l\'antenne (DSK 1 au mélangeur), puis jouez un bandeau joueur depuis le poste Habillage avec le DSK 2 à l\'antenne.', check: () => MIX.dsk1.on && MIX.dsk2.on && GFX.template === 'lower' && GFX.anim > 0.5 },
  { id: 'm12', title: 'Le ralenti', text: 'Au poste EVS : après une action, DERNIÈRE ACTION (ou jog + MARK IN), puis passez l\'EVS A au PGM et lancez la lecture au levier à 60 % maximum.', check: () => meSource(MIX.pgm) === 'EVSA' && EVS.ch[0].playing && EVS.ch[0].speed <= 0.6 },
  { id: 'm13', title: 'Le volet logo', text: 'Au mélangeur, entrez ou sortez d\'un ralenti avec le volet logo (transition CLIP de la frame memory).', check: () => S.stats.stingers >= 1 },
  { id: 'm13b', title: 'Clips et playlist', text: 'Au poste EVS : créez deux clips (IN, OUT puis F1 ; IN, OUT puis F2), ajoutez-les à la playlist (PLST puis F1 et F2) et lancez PLST PLAY.', check: () => EVS.playlist.length >= 2 && EVS.ch.some((c) => c.pl) },
  { id: 'm14', title: 'La synchro', text: 'Dans la zone technique (au fond du car), ouvrez le poste Synchro (SPG).', check: () => S.visited.synchro },
  { id: 'm15', title: 'Retour antenne', text: 'Au poste Transmission, comparez le départ et le retour antenne : repérez le délai.', check: () => S.visited.transmission },
  { id: 'm16', title: 'Dépannage', text: 'Au poste Chef de car, onglet « Simulateur de pannes » : lancez le mode examen et trouvez la panne.', check: () => S.faultsSolved >= 1 },
  { id: 'm17', title: 'Suivre un câble', text: 'Poste Chef de car, onglet « Liste de câblage » : ouvrez un appareil en cliquant sur une extrémité de câble, puis « Suivre » jusqu\'à l\'autre bout.', check: () => S.flags && S.flags.followed },
];
export function currentMission() { return MISSIONS.find((m) => !S.missionsDone[m.id]); }
export function checkMissions() {
  for (const m of MISSIONS) {
    if (S.missionsDone[m.id]) continue;
    let ok; try { ok = !!m.check(); } catch (e) { ok = false; }
    if (ok) { S.missionsDone[m.id] = true; if (S.showMission) toast(`Mission réussie : ${m.title}`, 'good', 4000); emit('mission', m.id); }
  }
}
export function drawMissionCard() {
  const box = $('#mission');
  if (!S.showMission) { box.hidden = true; return; }
  const m = currentMission();
  if (!m) { box.hidden = false; box.innerHTML = ''; box.append(el('div', { class: 'k' }, 'Parcours terminé'), el('h4', {}, 'Bravo, toutes les missions sont réussies'), el('p', {}, 'Essayez l\'exercice truquiste (poste Réalisateur) ou le mode examen des pannes.')); return; }
  const done = MISSIONS.filter((x) => S.missionsDone[x.id]).length;
  if (box.dataset.m === m.id && !box.hidden) return;
  box.dataset.m = m.id; box.hidden = false; box.innerHTML = '';
  box.append(el('div', { class: 'k' }, `Mission ${done + 1} / ${MISSIONS.length}`), el('h4', {}, m.title), el('p', {}, m.text),
    el('div', { class: 'row' }, el('button', { class: 'btn small', onclick: () => openGuide('missions') }, 'Toutes les missions'), el('button', { class: 'btn small', onclick: () => { S.missionsDone[m.id] = true; } }, 'Passer'), el('button', { class: 'btn small', onclick: () => { S.showMission = false; box.hidden = true; } }, 'Masquer')));
}


const NET_CHAPTERS = ['ipguide', 'reseau', 'mesure2110'];
export function openGuide(tab = 'missions', chapter = null) {
  const tabs = el('div', { class: 'tabs' });
  const content = el('div', { class: 'list' });
  const T = [['missions', 'Missions'], ['guide', 'Comprendre'], ['procedures', 'Procédures'], ['postes', 'Les postes'], ['materiel', 'Matériel'], ['glossaire', 'Glossaire'], ['commandes', 'Commandes'], ['reglages', 'Réglages']];
  const show = (k) => {
    content.innerHTML = '';
    [...tabs.children].forEach((b) => b.classList.toggle('on', b.dataset.k === k));
    if (k === 'missions') {
      content.append(el('p', { class: 'note' }, 'Un parcours d\'intégration pas à pas, du câblage d\'une caméra au dépannage. Les missions se valident automatiquement.'));
      for (const m of MISSIONS) content.appendChild(el('div', { class: 'item' + (currentMission() === m ? ' sel' : '') }, el('span', { class: 'dot ' + (S.missionsDone[m.id] ? 'green' : currentMission() === m ? 'amber' : '') }), el('div', { class: 'grow' }, el('div', { class: 't' }, m.title), el('div', { class: 's' }, m.text))));
      const cb = el('input', { type: 'checkbox', id: 'showm' }); cb.checked = S.showMission; cb.onchange = () => { S.showMission = cb.checked; $('#mission').dataset.m = ''; };
      content.append(el('label', { class: 'item', for: 'showm' }, cb, el('span', {}, 'Afficher la mission en cours à l\'écran')),
        el('button', { class: 'btn small', onclick: () => { S.missionsDone = {}; $('#mission').dataset.m = ''; show('missions'); } }, 'Recommencer le parcours'));
    }
    if (k === 'guide') {
      const nav = el('div', { class: 'tabs' }); const art = el('div', { class: 'prose' });
      let curG = GUIDE[0];
      // chapitres ST 2110 et réseau : boutons « ? » des termes (tableaux) et accès au lexique
      const lex = el('button', { class: 'btn small', onclick: () => openLexique(lex) }, 'Lexique réseau et ST 2110');
      const open = (g) => {
        curG = g; art.innerHTML = `<h3>${g.title}</h3>` + g.html; [...nav.children].forEach((b) => b.classList.toggle('on', b.dataset.g === g.id));
        lex.hidden = !NET_CHAPTERS.includes(g.id); if (!lex.hidden) qify(art, 'h4, th, td:first-child');
      };
      for (const g of GUIDE) nav.appendChild(el('button', { class: 'tab', 'data-g': g.id, onclick: () => open(g) }, g.title));
      content.append(nav, art, el('div', { class: 'hwrow' }, lex, el('button', { class: 'btn small', onclick: () => openReport('Guide · ' + curG.title) }, 'Signaler une erreur dans ce chapitre'))); open(GUIDE.find((g) => g.id === chapter) || GUIDE[0]);
      art.querySelectorAll('table').forEach((t) => { const w = el('div', { class: 'tblwrap' }); t.replaceWith(w); w.appendChild(t); });
      nav.addEventListener('click', () => art.querySelectorAll('table').forEach((t) => { if (!t.parentElement.classList.contains('tblwrap')) { const w = el('div', { class: 'tblwrap' }); t.replaceWith(w); w.appendChild(t); } }));
    }
    if (k === 'postes') {
      content.append(el('p', { class: 'note' }, 'Chaque poste du car et chaque équipement du stade, avec son rôle, son matériel et ses pièges. Dans le simulateur, approchez-vous et appuyez sur E.'));
      for (const [id, where] of STATION_LIST) { const I = STATION_INFO[id]; if (!I) continue; content.appendChild(el('div', { class: 'item' }, el('div', { class: 'grow' }, el('div', { class: 't' }, I.title), el('div', { class: 's' }, `${where} · ${I.role.split('. ')[0]}.`)), el('button', { class: 'btn small', onclick: () => openInfo(id) }, 'Fiche'))); }
    }
    if (k === 'procedures') {
      const procs = CFG.car.procedures || [];
      content.append(el('p', { class: 'note' }, procs.length ? `Procédures de ${CFG.car.name || 'votre car'}, définies par le formateur.` : 'Aucune procédure maison pour l\'instant : le formateur peut en ajouter dans l\'Espace formateur (onglet Procédures).'));
      for (const p of procs) content.append(el('div', { class: 'hwpanel prose' }, el('h3', {}, p.title), el('ol', { class: 'steps' }, (p.steps || []).map((s) => el('li', {}, s)))));
      content.append(el('div', { class: 'hwrow' }, el('button', { class: 'btn small', onclick: () => openTrainer('proc') }, 'Espace formateur')));
    }
    if (k === 'materiel') {
      content.append(el('p', { class: 'note' }, 'Faces avant et arrière des appareils, connecteurs, signaux et raccordements de votre installation. Inventaire des connecteurs d\'après les fiches techniques (chaîne caméra type Sony HDC-5500 / HDCU-5500 / RCP-3500, mélangeur Sony XVS-6000 et pupitre ICP-X7000, serveur EVS XT4K, télécommande LSM, IPDirector). Raccourci : touche K.'));
      const row = el('div', { class: 'grid2' });
      for (const [kk, l] of DEVICE_LIST) row.appendChild(el('button', { class: 'choice', onclick: () => openDevice(kk, ['cam', 'ccu', 'rcp'].includes(kk) && S.cams[0] ? S.cams[0].id : 1) }, el('b', { style: { fontSize: '17px' } }, l), el('span', {}, DEVICES[kk] ? DEVICES[kk].title : '')));
      content.append(row);
    }
    if (k === 'glossaire') {
      const q = el('input', { type: 'text', id: 'glq', placeholder: 'Rechercher un terme (SDI, genlock, DSK…)' });
      const list = el('div', { class: 'list' });
      const render = () => { list.innerHTML = ''; const s = q.value.trim().toLowerCase(); for (const [t, d] of GLOSSARY) { if (s && !(t.toLowerCase().includes(s) || d.toLowerCase().includes(s))) continue; list.appendChild(el('div', { class: 'item' }, el('div', { class: 'grow' }, el('div', { class: 't' }, t), el('div', { class: 's', style: { fontSize: '13px', color: '#c7d0d7' } }, d)))); } };
      q.addEventListener('input', render); content.append(field('Recherche', q), list); render();
    }
    if (k === 'commandes') {
      const g = el('div', { class: 'keys' }); for (const [kk, d] of CONTROLS_HELP) g.appendChild(el('div', {}, el('kbd', {}, kk), d));
      content.append(g, el('p', { class: 'note' }, 'Sur tablette : joystick à gauche pour avancer, glisser à droite pour regarder, bouton E pour interagir. Dans un poste, les raccourcis du poste sont indiqués en bas de l\'écran.'));
    }
    if (k === 'reglages') {
      content.append(el('div', { class: 'grid2' },
        field('Lumière', selectEl(Object.entries(LIGHTING).map(([k2, v]) => [k2, v.label]), S.lighting, (v) => emit('setLighting', v))),
        field('Qualité graphique', selectEl([['basse', 'Basse (portable)'], ['moyenne', 'Moyenne'], ['haute', 'Haute (bonne carte graphique)']], S.quality, (v) => emit('setQuality', v))),
        field('Éclairage de nuit', selectEl([['led', 'LED « flicker-free »'], ['halide', 'Iodures métalliques 50 Hz (scintillement en super ralenti)']], S.flickerLamps ? 'halide' : 'led', (v) => { S.flickerLamps = v === 'halide'; })),
        field('Voix du réalisateur virtuel', selectEl([['0', 'Texte seulement'], ['1', 'Synthèse vocale']], S.directorVoice ? '1' : '0', (v) => { S.directorVoice = v === '1'; })),
        field('Line-up automatique à l\'installation', selectEl([['1', 'Oui (caméras déjà réglées)'], ['0', 'Non (réglages par défaut, à faire en vision)']], S.autoLineup ? '1' : '0', (v) => { S.autoLineup = v === '1'; })),
        field('Étiquettes et câbles dans le stade', selectEl([['1', 'Afficher'], ['0', 'Masquer']], S.showLabels ? '1' : '0', (v) => emit('setLabels', v === '1')))),
        el('p', { class: 'note' }, LIGHTING[S.lighting].desc),
        el('div', { class: 'hwrow' }, el('button', { class: 'btn', onclick: () => openTrainer('car') }, 'Espace formateur'), el('button', { class: 'btn', id: 'perfbtn', onclick: () => emit('perfTest') }, 'Tester les performances de cet ordinateur'), el('button', { class: 'btn', onclick: () => openReport('Simulateur (général)') }, 'Signaler une erreur'), el('button', { class: 'btn', onclick: () => openDiag() }, 'Diagnostic technique')));
    }
  };
  for (const [k, l] of T) tabs.appendChild(el('button', { class: 'tab', 'data-k': k, onclick: () => show(k) }, l));
  modal.open('Guide du car régie', el('div', { class: 'list' }, tabs, content), { width: 980 });
  show(tab);
}
on('openGuide', (ch) => openGuide('guide', typeof ch === 'string' ? ch : null));

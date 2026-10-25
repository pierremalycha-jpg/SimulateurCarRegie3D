// @ts-check
import { openDiag } from './diag_ui.js';
import { openDevice } from '../equipment/viewer.js';
import { openReport } from './report.js';
import { qify, openLexique } from './term.js';
import { CFG } from '../shared.js';
import { DEVICE_LIST, DEVICES } from '../equipment/devices.js';
import { S, emit, on, camById } from '../state.js';
import { el } from '../util.js';
import { CONTROLS_HELP } from '../content/controls.js';
import { GLOSSARY } from '../content/glossary.js';
import { cibleDuTerme, posteCible, titreDe, estLecon } from '../cours/liens.js';
import { GUIDE } from '../content/guide.js';
import { STATION_INFO, STATION_LIST } from '../content/stations.js';
import { LIGHTING } from '../data/exposure.js';
import { $, modal, openInfo, toast, selectEl, field } from './common.js';
import { MIX, meSource, EVS } from '../pipeline.js';
import { GFX } from '../gfx.js';
import { RF } from '../rf.js';
import { patchScore } from '../patch.js';
import { ctrlCam, camAuPlan } from '../net/ctrlnet.js';

const cam = (slot) => S.cams.find((c) => c.slotId === slot);
// « ce poste a été ouvert » : depuis toujours (progression) pour le car vide ; une mission spécifique
// (game/mission_run.js) passe sa propre mémoire, celle de la partie en cours
const VU = (/** @type {string} */ id) => !!S.visited[id];
export const MISSIONS = [
  { id: 'm1', title: 'Le compound', text: 'Approchez-vous du pied de car (le panneau de raccordement à l\'arrière droit du car régie) et appuyez sur E pour le découvrir.', check: () => S.openedInfo.pieddecar },
  { id: 'm2', title: 'Le plan de caméras', text: 'Ouvrez le plan (touche P). Installez une caméra tribune sur « Passerelle centrale – position 1 » avec la consigne « Plan large ».', check: () => { const c = cam('g_c1'); return c && c.role === 'large'; } },
  { id: 'm3', title: 'Câbler la caméra 1', text: 'Dans le plan, vérifiez la liaison de cette caméra : fibre SMPTE ou pré-câblage, longueur dans la limite. Le câble apparaît en couleur jusqu\'au pied de car.', check: () => { const c = cam('g_c1'); return c && c.status.ok && ['smpte', 'precab', 'smf'].includes(c.link); } },
  { id: 'm3b', title: 'Les connecteurs de la caméra', text: 'Visez la caméra 1 dans le stade et appuyez sur I (ou, dans le plan, « Voir le matériel ») : cliquez sur un connecteur, par exemple la fibre CCU ou l\'intercom du cadreur, pour savoir à quoi il sert et où il est câblé.', check: () => S.seenPort && Object.keys(S.seenPort).some((k) => k.startsWith('cam:')) },
  { id: 'm4', title: 'Le serré', text: 'Installez une deuxième caméra sur la position 2 avec un très long zoom (UA107 ou UJ122) et la consigne « Serré porteur du ballon ».', check: () => { const c = cam('g_c2'); return c && c.role === 'serre' && c.L.fmax >= 900; } },
  { id: 'm5', title: 'Une caméra HF', text: 'Installez une Steadicam HF au bord du terrain et allumez au moins deux antennes de réception. Objectif : une marge HF supérieure à 3 dB.', check: () => S.cams.some((c) => c.rf && c.rf.margin > 3) && RF.antennas.filter((a) => a.on).length >= 2 },
  { id: 'm6', title: 'Entrer dans le car', text: 'Rejoignez le car régie (Tab, le pupitre, puis « Devant le car ») et entrez par les marches de la porte.', check: () => S.inTruck },
  { id: 'mz-patch', title: 'Brasser le car', text: 'Le car n\'est pas brassé : au poste « Baie de brassage » (zone technique), reliez chaque liaison en suivant la liste de câblage (sources vers la grille, sorties vers l\'EVS et les départs, référence vers les CCU). Objectif : 100 %.', check: () => S.preset === 'zero' && S.patch.on && patchScore().pct >= 100 },
  { id: 'mz-net', title: 'Le réseau de contrôle', text: 'Les RCP et les CCU sortent du carton avec leur adresse d\'usine (192.168.0.x). Au poste « Réseau de contrôle », donnez à ceux des caméras installées l\'adresse du plan (10.1.20.x/24, passerelle 10.1.20.1) : chaque RCP doit reprendre la main sur sa caméra.', check: () => (S.preset === 'zero' || S.reseauUsine) && S.cams.length > 0 && S.cams.every((c) => ctrlCam(c.id).ok && camAuPlan(c.id)) },
  { id: 'm7', title: 'Le multiview', text: 'Asseyez-vous au poste « Truquiste · XVS-6000 » (E). Repérez le PGM (cadre rouge, à droite) et le PVW (cadre vert, à gauche).', check: (vu = VU) => vu('melangeur') },
  { id: 'm8', title: 'Premier enchaîné', text: 'Au mélangeur : plan large au PGM, serré en preset (rangée B · PST, tuile PVW), choisissez MIX puis AUTO TRANS (ou Entrée du pavé numérique).', check: () => S.stats.mixes >= 1 },
  { id: 'm9', title: 'Exposition', text: 'Au poste Ingé vision, réglez l\'iris de la CAM 1 pour un niveau moyen entre 35 et 55 % (lisez le waveform).', check: (vu = VU) => { const c = camById(1); return vu('vision') && c && c.meter.mean > 0.35 && c.meter.mean < 0.55; } },
  { id: 'm10', title: 'Le matching', text: 'Toujours en vision : égalisez la colorimétrie des CAM 1 et 2 (écarts rouge et bleu inférieurs à 2 %, voir sous les gains). AUTO WHITE ou réglage fin des gains R/B.', check: (vu = VU) => { const a = camById(1), b = camById(2); if (!a || !b || !vu('vision')) return false; const ea = a.colorError(), eb = b.colorError(); return Math.abs(ea.r) < 0.02 && Math.abs(ea.b) < 0.02 && Math.abs(eb.r) < 0.02 && Math.abs(eb.b) < 0.02; } },
  { id: 'm10b', title: 'Les barres au line-up', text: 'Au poste Ingé vision, envoyez les barres d\'une caméra (touche BARS du RCP), retrouvez-les sur le multiview, puis revenez à l\'image.', check: () => S.flags && S.flags.barsCycle },
  { id: 'm11', title: 'Habillage', text: 'Mettez le score à l\'antenne (DSK 1 au mélangeur), puis jouez un bandeau joueur depuis le poste Habillage avec le DSK 2 à l\'antenne.', check: () => MIX.dsk1.on && MIX.dsk2.on && GFX.template === 'lower' && GFX.anim > 0.5 },
  { id: 'm12', title: 'Le ralenti', text: 'Au poste EVS : après une action, DERNIÈRE ACTION (ou jog + MARK IN), puis passez l\'EVS A au PGM et lancez la lecture au levier à 60 % maximum.', check: () => meSource(MIX.pgm) === 'EVSA' && EVS.ch[0].playing && EVS.ch[0].speed <= 0.6 },
  { id: 'm13', title: 'Le volet logo', text: 'Au mélangeur, entrez ou sortez d\'un ralenti avec le volet logo (transition CLIP de la frame memory).', check: () => S.stats.stingers >= 1 },
  { id: 'm13b', title: 'Clips et playlist', text: 'Au poste EVS : créez deux clips (IN, OUT puis F1 ; IN, OUT puis F2), ajoutez-les à la playlist (PLST puis F1 et F2) et lancez PLST PLAY.', check: () => EVS.playlist.length >= 2 && EVS.ch.some((c) => c.pl) },
  { id: 'm14', title: 'La synchro', text: 'Dans la zone technique (au fond du car), ouvrez le poste Synchro (SPG).', check: (vu = VU) => vu('synchro') },
  { id: 'm15', title: 'Retour antenne', text: 'Au poste Transmission, comparez le départ et le retour antenne : repérez le délai.', check: (vu = VU) => vu('transmission') },
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
    el('div', { class: 'row' }, el('button', { class: 'btn small', onclick: () => openMissions() }, 'Toutes les tâches'), el('button', { class: 'btn small', onclick: () => { S.missionsDone[m.id] = true; } }, 'Passer cette mission'), el('button', { class: 'btn small', onclick: () => { S.showMission = false; box.hidden = true; } }, 'Masquer')));
}


// ----------------------------------------------------------------------------------
// Le contenu de l'ancien Guide, rangé à sa place : le glossaire, les postes et le matériel sont des
// onglets du Cours ; les articles sont l'« article de référence » des leçons (openArticle) ; les
// tâches du mode « Tout à faire » ont leur fenêtre (openMissions) ; les réglages sont dans la
// fenêtre Réglages (ui/settings.js). openGuide(onglet, chapitre) reste l'entrée commune et aiguille.
// ----------------------------------------------------------------------------------
/** les missions d'installation : liste, mission affichée à l'écran, recommencer */
export function missionsSection(box) {
  const draw = () => {
    box.replaceChildren();
    for (const m of MISSIONS) box.appendChild(el('div', { class: 'item' + (currentMission() === m ? ' sel' : '') }, el('span', { class: 'dot ' + (S.missionsDone[m.id] ? 'green' : currentMission() === m ? 'amber' : '') }), el('div', { class: 'grow' }, el('div', { class: 't' }, m.title), el('div', { class: 's' }, m.text))));
    const cb = el('input', { type: 'checkbox', id: 'showm' }); cb.checked = S.showMission; cb.onchange = () => { S.showMission = cb.checked; $('#mission').dataset.m = ''; };
    box.append(el('label', { class: 'item', for: 'showm' }, cb, el('span', {}, 'Afficher la mission en cours à l\'écran')),
      el('div', { class: 'hwrow' }, el('button', { class: 'btn small', onclick: () => { S.missionsDone = {}; $('#mission').dataset.m = ''; draw(); } }, 'Recommencer le parcours')));
  };
  box.classList.add('list'); draw();
}

// chapitres, par famille (l'ordre d'une journée : la production, l'image, les liaisons, le son, l'IP)
/** @type {[string, string[]][]} */
export const CHAPTER_GROUPS = [
  ['La production', ['deroule', 'stade', 'car', 'icomguide', 'cablage', 'securite']],
  ['Image et caméras', ['chaine', 'formats', 'optique', 'objectifs', 'camsys', 'montage', 'hdrguide', 'mesures']],
  ['Liaisons et synchro', ['liaisons', 'hfguide', 'sync', 'timing']],
  ['Son et ralentis', ['songuide', 'vista', 'evsarch']],
  ['Production IP', ['ipguide', 'reseau', 'mesure2110']],
  ['Le simulateur', ['sessions', 'relecture']],
];
const NET_CHAPTERS = ['ipguide', 'reseau', 'mesure2110'];
/** les chapitres : à gauche la liste par famille, à droite le chapitre ouvert */
export function chaptersSection(box, chapter = null) {
  const art = el('article', { class: 'prose gd-art', tabindex: '-1' });
  const nav = el('nav', { class: 'gd-nav plate', 'aria-label': 'Les chapitres' });
  const lex = el('button', { class: 'btn small', onclick: () => openLexique(lex) }, 'Lexique des postes');
  const tools = el('div', { class: 'hwrow' }, lex);
  let cur = GUIDE[0];
  const report = el('button', { class: 'btn small', onclick: () => openReport('Guide · ' + cur.title) }, 'Signaler une erreur dans ce chapitre');
  tools.append(report);
  const grouped = new Set(CHAPTER_GROUPS.flatMap(([, ids]) => ids));
  /** @type {[string, string[]][]} */
  const groups = [...CHAPTER_GROUPS, ['Autres chapitres', GUIDE.map((g) => g.id).filter((id) => !grouped.has(id))]];
  const open = (g) => {
    cur = g;
    art.innerHTML = `<h2>${g.title}</h2>` + g.html;
    art.querySelectorAll('table').forEach((t) => { const w = el('div', { class: 'tblwrap' }); t.replaceWith(w); w.appendChild(t); });
    lex.hidden = !NET_CHAPTERS.includes(g.id); if (!lex.hidden) qify(art, 'h4, th, td:first-child');
    for (const b of /** @type {NodeListOf<HTMLElement>} */ (nav.querySelectorAll('[data-g]'))) b.setAttribute('aria-current', String(b.dataset.g === g.id));
    const sc = box.closest('.ly-scroll'); if (sc && art.getBoundingClientRect().top < 0) art.scrollIntoView({ block: 'start' });
  };
  nav.append(...groups.filter(([, ids]) => ids.length).map(([name, ids]) => el('section', { class: 'gd-theme' },
    el('h3', {}, el('span', {}, name)),
    el('ul', { class: 'gd-items' }, ...ids.map((id) => GUIDE.find((g) => g.id === id)).filter(Boolean).map((g) => el('li', {},
      el('button', { type: 'button', class: 'gd-item plain', 'data-g': g.id, onclick: () => { open(g); art.focus({ preventScroll: true }); } }, el('span', {}, el('b', {}, g.title)))))))));
  box.append(el('div', { class: 'gd-wrap' }, nav, el('div', { class: 'gd-main' }, art, tools)));
  open(GUIDE.find((g) => g.id === chapter) || GUIDE[0]);
}
/** le glossaire : 246 termes, recherche sans accents ; un terme qui a sa fiche y mène (onglet Notions) */
export function glossarySection(box) {
  const q = el('input', { type: 'search', id: 'glq', placeholder: 'Rechercher un terme (SDI, genlock, DSK…)', autocomplete: 'off', spellcheck: 'false' });
  const list = el('div', { class: 'list' });
  const count = el('p', { class: 'note' });
  const fiches = GLOSSARY.map(([t]) => cibleDuTerme(t));
  const nf = fiches.filter(Boolean).length;
  const render = () => {
    list.innerHTML = '';
    const nz = (x) => x.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const s = nz(q.value.trim()); let n = 0;
    GLOSSARY.forEach(([t, d], i) => {
      if (s && !(nz(t).includes(s) || nz(d).includes(s))) return;
      n++;
      const f = fiches[i];
      list.appendChild(el('div', { class: 'item' }, el('div', { class: 'grow' }, el('div', { class: 't' }, t), el('div', { class: 's', style: { fontSize: '13px', color: '#c7d0d7' } }, d)),
        f ? el('button', { type: 'button', class: 'btn small', 'data-fiche': f, title: (estLecon(f) ? 'Ouvrir la leçon « ' : 'Ouvrir la fiche « ') + titreDe(f) + ' »', onclick: () => emit('cours', { fiche: f }) }, estLecon(f) ? 'Leçon' : 'Fiche « ? »') : null));
    });
    count.textContent = s ? `${n} terme${n > 1 ? 's' : ''} sur ${GLOSSARY.length}` : `${GLOSSARY.length} termes, de A à Z. ${nf} d'entre eux ont leur leçon ou leur fiche « ? », avec un schéma : boutons « Leçon » et « Fiche « ? » ».`;
  };
  q.addEventListener('input', render);
  box.append(el('div', { class: 'list ly-narrow' }, field('Recherche', q), count, list)); render();
}
/** les postes du car et du stade : rôle, la notion technique du poste et la fiche complète */
export function postesSection(box) {
  box.append(el('p', { class: 'note' }, 'Chaque poste du car et chaque équipement du stade, avec son rôle, son matériel et ses pièges. Dans le simulateur, approchez-vous et appuyez sur E.'));
  const list = el('div', { class: 'list' });
  for (const [id, where] of STATION_LIST) {
    const I = STATION_INFO[id]; if (!I) continue;
    const f = posteCible(id, S.ipMode);
    list.appendChild(el('div', { class: 'item' }, el('div', { class: 'grow' }, el('div', { class: 't' }, I.title), el('div', { class: 's' }, `${where} · ${I.role.split('. ')[0]}.`)),
      f ? el('button', { class: 'btn small', 'data-fiche': f, title: 'La notion technique de ce poste, dans le Cours', onclick: () => emit('cours', { fiche: f }) }, (estLecon(f) ? 'Leçon : ' : 'Fiche : ') + titreDe(f)) : null,
      el('button', { class: 'btn small', onclick: () => openInfo(id) }, 'Voir la fiche')));
  }
  box.append(list);
}
/** le matériel : faces avant et arrière, connecteurs */
export function materielSection(box) {
  box.append(el('p', { class: 'note' }, 'Faces avant et arrière des appareils, connecteurs, signaux et raccordements de votre installation. Inventaire des connecteurs d\'après les fiches techniques (chaîne caméra type Sony HDC-5500 / HDCU-5500 / RCP-3500, mélangeur Sony XVS-6000 et pupitre ICP-X7000, serveur EVS XT4K, télécommande LSM, IPDirector). Dans le car : touche K.'));
  const row = el('div', { class: 'grid2' });
  for (const [kk, l] of DEVICE_LIST) row.appendChild(el('button', { class: 'choice', onclick: () => openDevice(kk, ['cam', 'ccu', 'rcp'].includes(kk) && S.cams[0] ? S.cams[0].id : 1) }, el('b', { style: { fontSize: '17px' } }, l), el('span', {}, DEVICES[kk] ? DEVICES[kk].title : '')));
  box.append(row);
}
/** les procédures maison, écrites par le formateur */
export function proceduresSection(box) {
  const procs = CFG.car.procedures || [];
  box.append(el('p', { class: 'note' }, procs.length ? `Procédures de ${CFG.car.name || 'votre car'}, définies par le formateur.` : 'Aucune procédure maison pour l\'instant : le formateur peut en ajouter dans l\'Espace formateur (onglet Procédures).'));
  for (const p of procs) box.append(el('div', { class: 'hwpanel prose' }, el('h3', {}, p.title), el('ol', { class: 'steps' }, (p.steps || []).map((s) => el('li', {}, s)))));
}
/** toutes les commandes du clavier */
export function commandesSection(box) {
  const g = el('div', { class: 'keys' }); for (const [kk, d] of CONTROLS_HELP) g.appendChild(el('div', {}, el('kbd', {}, kk), d));
  box.append(g, el('p', { class: 'note' }, 'Sur tablette : joystick à gauche pour avancer, glisser à droite pour regarder, bouton E pour interagir. Dans un poste, les raccourcis du poste sont indiqués en bas de l\'écran.'));
}
/** les réglages de la partie en cours */
export function reglagesSection(box) {
  box.append(el('div', { class: 'grid2' },
    field('Lumière', selectEl(Object.entries(LIGHTING).map(([k2, v]) => [k2, v.label]), S.lighting, (v) => emit('setLighting', v))),
    field('Qualité graphique', selectEl([['basse', 'Basse (portable)'], ['moyenne', 'Moyenne'], ['haute', 'Haute (bonne carte graphique)']], S.quality, (v) => emit('setQuality', v))),
    field('Éclairage de nuit', selectEl([['led', 'LED « flicker-free »'], ['halide', 'Iodures métalliques 50 Hz (scintillement en super ralenti)']], S.flickerLamps ? 'halide' : 'led', (v) => { S.flickerLamps = v === 'halide'; })),
    field('Voix du réalisateur virtuel', selectEl([['0', 'Texte seulement'], ['1', 'Synthèse vocale']], S.directorVoice ? '1' : '0', (v) => { S.directorVoice = v === '1'; })),
    field('Line-up automatique à l\'installation', selectEl([['1', 'Oui (caméras déjà réglées)'], ['0', 'Non (réglages par défaut, à faire en vision)']], S.autoLineup ? '1' : '0', (v) => { S.autoLineup = v === '1'; })),
    field('Étiquettes et câbles dans le stade', selectEl([['1', 'Afficher'], ['0', 'Masquer']], S.showLabels ? '1' : '0', (v) => emit('setLabels', v === '1')))),
  el('p', { class: 'note' }, (LIGHTING[S.lighting] || {}).desc || ''),
  el('div', { class: 'hwrow' }, el('button', { class: 'btn', id: 'perfbtn', onclick: () => emit('perfTest') }, 'Tester les performances de cet ordinateur'), el('button', { class: 'btn', onclick: () => openReport('Simulateur (général)') }, 'Signaler une erreur'), el('button', { class: 'btn', onclick: () => openDiag() }, 'Diagnostic technique')));
}
export function openReglages() { emit('settings'); }
export function openCommandes() { const b = el('div', { class: 'list' }); commandesSection(b); modal.open('Commandes', b, { width: 900 }); }

/** les tâches du mode « Tout à faire » (missions d'installation) */
export function openMissions() {
  const box = el('div'); missionsSection(box);
  modal.open('Les tâches de l\'installation', el('div', { class: 'list' }, el('p', { class: 'note' }, 'Elles se cochent toutes seules quand vous agissez ; la tâche en cours s\'affiche en haut à gauche de l\'écran.'), box), { width: 820 });
}
/** un article de référence du guide (content/guide.js), proposé par une leçon du Cours */
export function openArticle(id) {
  const g = GUIDE.find((x) => x.id === id); if (!g) return;
  const art = el('article', { class: 'prose gd-art' });
  art.innerHTML = `<h2>${g.title}</h2>` + g.html;
  art.querySelectorAll('table').forEach((t) => { const w = el('div', { class: 'tblwrap' }); t.replaceWith(w); w.appendChild(t); });
  if (NET_CHAPTERS.includes(g.id)) qify(art, 'h4, th, td:first-child');
  modal.open('Article de référence', el('div', { class: 'list' }, art, el('div', { class: 'hwrow' }, el('button', { class: 'btn small', onclick: () => openReport('Article · ' + g.title) }, 'Signaler une erreur dans cet article'))), { width: 900 });
}
/**
 * L'entrée commune de l'ancien Guide : chaque onglet va là où il est maintenant. Un « chapitre »
 * de l'ancien guide ouvre la leçon du Cours qui le cite comme article de référence.
 * @param {string} [tab] missions, guide, postes, materiel, glossaire, commandes, reglages
 * @param {string | null} [chapter] article du guide
 */
export function openGuide(tab = 'guide', chapter = null) {
  if (modal.isOpen) modal.close();
  if (tab === 'missions') openMissions();
  else if (tab === 'reglages') emit('settings');
  else if (tab === 'commandes') openCommandes();
  else if (tab === 'glossaire' || tab === 'postes' || tab === 'materiel') emit('cours', { tab });
  else emit('cours', { article: chapter });
}
on('openGuide', (ch) => openGuide('guide', typeof ch === 'string' ? ch : null));

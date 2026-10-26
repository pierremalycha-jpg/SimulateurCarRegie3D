// @ts-check
import { S, emit, camById } from '../../state.js';
import { ROUTER, route } from '../../pipeline.js';
import { RF, channelInfo } from '../../rf.js';
import { patchEmpty, patchNormal } from '../../patch.js';
import { lockState, setLock } from '../../videohub.js';
import { goStation, ui, hw, btn, camIds } from './kit.js';

// ----------------------------------------------------------------------------------
// Parcours « Liaisons, synchro et diffusion », exercices pratiques des leçons du Cours : HF (hf-bilan),
// générateur de synchro (synchro-genlock), grille (sdi-grille), baie de brassage (sdi-cable),
// transmission (expl-transmission), intercom (expl-intercom). Les défauts sont créés au début de
// l'étape et vérifiés sur l'état réel (marge HF, verrouillage, table de la grille, cordons, chemin de
// transmission).
// ----------------------------------------------------------------------------------
const D = 'Liaisons, synchro et diffusion';
const ALLOWED = [2230, 2290, 2310, 2330, 2350];
const txOk = () => ROUTER.map[S.txPath === 2 ? 'AUX_TX2' : 'AUX_TX1'] === 'PGM';
const visible = (sel) => { if (typeof document === 'undefined') return false; const n = document.querySelector(sel); return !!n && n.getBoundingClientRect().width > 1; };

// ---------------- HF ----------------
const hfCam = (c) => camById(c.mem.cam);
/** @type {import('../engine.js').Lesson} */
const HF = {
  id: 'hf-liaisons', domain: D, stations: ['hf'], needs: { hf: true },
  title: 'Rétablir une liaison HF : diversité et changement de canal',
  summary: 'Exercice de la leçon « Le bilan de liaison » : mettre une deuxième antenne en service pour remonter la marge, puis sortir une caméra HF d\'un brouillage en passant sur un canal attribué libre.',
  duration: '8 min', level: 'intermédiaire',
  outro: 'Une liaison HF se coordonne avant le match (canaux attribués par l\'organisateur), se surveille à la marge pendant le match, et se dépanne en changeant de canal ou d\'antenne, jamais au hasard.',
  cleanupLabel: 'Supprimer le brouilleur',
  cleanup: () => { S.faults.jam = null; },
  after: () => { S.faults.jam = null; },
  steps: [
    {
      id: 'intro', title: 'Les liaisons HF',
      enter: (c) => { const k = S.cams.find((x) => x.rf); c.mem.cam = k ? k.id : 0; },
      say: (c) => `Rappel de la leçon : la **marge** est l'écart entre le niveau reçu et la sensibilité du récepteur ; au-dessus de 10 dB on est tranquille, sous 3 dB le moindre creux fait décrocher l'image, d'un coup (l'effet falaise).\n\nLes caméras sans fil (steadicam, caméra portée${c.mem.cam ? `, ici la CAM ${c.mem.cam}` : ''}) envoient leur image par un émetteur **COFDM** (modulation numérique répartie sur de nombreuses porteuses, résistante aux échos), vers des antennes de réception autour du stade. Sous quelques dB de marge, l'image se fige en blocs, puis disparaît.`,
    },
    goStation('hf', 'La régie HF est dans la zone technique.', 'En haut, les antennes ; au milieu, une carte par liaison ; dans le moniteur, le spectre et la carte de couverture : tout ce qu\'il faut pour surveiller la marge.', { hints: ['Les postes techniques sont regroupés dans la zone technique du car.', 'Touche Tab (le pupitre), puis la touche du poste dans la rangée Technique ; ou « Emmène-moi ».'] }),
    {
      id: 'ant', title: 'Deux antennes',
      say: 'Avec une seule antenne, un joueur ou un poteau entre la caméra et l\'antenne suffit à couper le signal. On en met plusieurs, réparties autour du stade : le récepteur garde la meilleure (**diversité**).',
      do: 'Mets en service une deuxième antenne de réception.',
      go: { station: 'hf' }, show: [hw('OFF', 'une antenne éteinte')], skip: () => RF.antennas.filter((a) => a.on).length >= 2,
      done: () => RF.antennas.filter((a) => a.on).length >= 2,
      ok: 'Deux antennes : la carte de couverture s\'élargit et la marge remonte dans les zones d\'ombre, car le récepteur garde à chaque instant la meilleure des deux.',
      hints: ['Les antennes ont leur propre panneau, en haut du poste.', 'Panneau « Antennes de réception (diversité) » : clique la touche OFF d\'une antenne éteinte.'],
      auto: (c) => { if (!ui(c, 'click', '#station .st-body > .hwpanel:first-child .list .item button.hw', 'OFF')) { const a = RF.antennas.find((x) => !x.on); if (a) a.on = true; } },
    },
    {
      id: 'jam', title: 'Un brouillage',
      enter: (c) => { const k = hfCam(c); if (k) { c.mem.jam = k.rf.ch; S.faults.jam = { f: k.rf.ch }; } },
      say: (c) => `La CAM ${c.mem.cam} part en blocs : sur l'analyseur de spectre, une porteuse inconnue est apparue sur son canal (${c.mem.jam} MHz). On ne cherche pas le brouilleur pendant le match : on **change de canal**, pour un canal **attribué** à la production et libre.`,
      do: (c) => `Change la fréquence de la CAM ${c.mem.cam} pour un canal attribué libre (${ALLOWED.join(', ')} MHz).`,
      go: { station: 'hf' }, show: (c) => [{ sel: '#station .panelgrid > .hwpanel', text: `CAM ${c.mem.cam}`, label: `liaison CAM ${c.mem.cam}` }],
      done: (c) => { const k = hfCam(c); if (!k) return false; const info = channelInfo(k.rf.ch); return Math.abs(k.rf.ch - c.mem.jam) >= k.rf.bw && !!info && info.status === 'attrib' && !S.cams.some((x) => x !== k && x.rf && Math.abs(x.rf.ch - k.rf.ch) < k.rf.bw); },
      ok: 'La liaison est de nouveau verrouillée : le nouveau canal est attribué, libre et assez loin du brouillage. On prévient la coordination des fréquences du brouillage constaté.',
      hints: ['Un canal valable doit être attribué à la production, libre, et assez loin du canal brouillé.', 'Sur la carte de la liaison, le premier menu, « Fréquence ».', 'Les canaux attribués sont marqués dans le menu ; évite celui d\'une autre caméra HF.'],
      auto: (c) => {
        const k = hfCam(c); const used = S.cams.filter((x) => x !== k && x.rf).map((x) => x.rf.ch);
        const f = ALLOWED.find((v) => Math.abs(v - c.mem.jam) >= k.rf.bw && !used.some((u) => Math.abs(u - v) < k.rf.bw)) || ALLOWED[0];
        const i = S.cams.filter((x) => x.rf).indexOf(k);
        if (!ui(c, 'select', `#station .panelgrid > .hwpanel:nth-child(${i + 1}) .grid2 select`, f)) k.rf.ch = f;
        if (k.rf.ch !== f) k.rf.ch = f;
      },
    },
    {
      id: 'quiz', title: 'Question',
      say: 'Une question sur la marge.',
      quiz: { q: 'La marge d\'une liaison passe de 12 dB à 2 dB quand le cadreur passe derrière le but. Que fais-tu ?', choices: ['Je mets en service une antenne qui voit cette zone, ou je baisse la modulation (plus robuste, moins de débit)', 'Je monte le gain vidéo', 'Rien, tant qu\'il y a une image'], answer: 0, why: 'À 2 dB, la moindre obstruction coupe l\'image. On agit avant : diversité d\'antennes, ou modulation plus robuste (16-QAM vers QPSK) au prix du débit. Le gain vidéo éclaircit l\'image mais ne renforce pas le signal radio, et attendre, c\'est découvrir la coupure à l\'antenne.' },
    },
  ],
};

// ---------------- synchro ----------------
/** @type {import('../engine.js').Lesson} */
const SYNC = {
  id: 'synchro-reference', domain: D, stations: ['synchro', 'ccu'],
  title: 'Gérer une perte du GPS et des CCU décrochées',
  summary: 'Exercice de la leçon « La référence et le genlock » : le générateur de synchro et son GPS, le mode holdover, puis des CCU qui ont perdu la référence à re-verrouiller.',
  duration: '6 min', level: 'intermédiaire',
  outro: 'Tout le car bat au rythme du générateur de synchro (SPG). Le GPS lui donne l\'heure exacte ; s\'il le perd, il continue sur son oscillateur (holdover) et l\'antenne ne voit rien.',
  cleanupLabel: 'Rétablir GPS et références',
  cleanup: (c) => { S.faults.gps = false; for (const id of c.mem.cams || []) { const k = camById(id); if (k) k.genlock = true; } },
  steps: [
    {
      id: 'intro', title: 'La synchro',
      say: 'Rappel de la leçon : pour couper d\'une source à l\'autre sans saut, toutes commencent chaque image **au même instant**, parce qu\'elles sont verrouillées (**genlock**) sur la même référence.\n\nLe **générateur de synchro** (SPG, Sync Pulse Generator) distribue cette **référence** à tout le car : black burst (noir codé, hérité de la SD) ou tri-level (synchro à trois niveaux, pour la HD). Il distribue aussi le **timecode** (l\'heure qui date chaque image), et il est lui-même calé sur le temps GPS.',
    },
    goStation('synchro', 'Le poste synchro est dans la zone technique.', 'En haut, le timecode maître ; dans le tableau, l\'état du générateur et de ses sorties : c\'est là qu\'on lit s\'il est verrouillé sur le GPS.', { hints: ['Les postes techniques sont regroupés dans la zone technique du car.', 'Touche Tab (le pupitre), puis la touche du poste dans la rangée Technique ; ou « Emmène-moi ».'] }),
    {
      id: 'gps', title: 'Perte du GPS',
      say: 'Simulons une perte du GPS (antenne débranchée, masquée par un camion…).',
      do: 'Simule une perte GPS.',
      go: { station: 'synchro' }, show: [btn('perte GPS', 'perte GPS')],
      done: () => !!S.faults.gps,
      ok: 'Le SPG passe en **holdover** (maintien) : il continue sur son oscillateur interne thermostaté, qui ne dérive que de quelques dizaines à quelques centaines de nanosecondes par heure. Rien ne change à l\'image, parce que tout le car reste calé sur le même générateur.',
      hints: ['Les simulations de panne sont des boutons du poste synchro.', 'Le bouton « perte GPS ».'],
      auto: () => { S.faults.gps = true; },
    },
    {
      id: 'holdover', title: 'Holdover',
      say: 'Le holdover ne se voit pas à l\'image, mais c\'est une alarme à traiter.',
      quiz: { q: 'En holdover, que se passe-t-il ?', choices: ['Le car continue sur l\'oscillateur du générateur : la dérive est très lente, l\'antenne n\'est pas affectée', 'Toutes les caméras perdent leur référence', 'Le timecode s\'arrête'], answer: 0, why: 'L\'oscillateur du SPG dérive très lentement : on a des heures pour rétablir le GPS. Les caméras ne perdent rien, elles suivent toujours la référence du SPG, et le timecode continue de tourner. Le danger concerne surtout les échanges avec l\'extérieur (heure exacte, synchronisation avec d\'autres sites).' },
    },
    {
      id: 'gpsback', title: 'Rétablir le GPS',
      say: 'L\'antenne GPS est rebranchée.',
      do: 'Rétablis le GPS (même bouton).',
      go: { station: 'synchro' }, show: [btn('GPS', 'GPS')],
      done: () => !S.faults.gps,
      ok: 'Le SPG se recale doucement sur le GPS, sans saut : un recalage brutal ferait décrocher les appareils qui le suivent.',
      hints: ['C\'est le même bouton que pour la panne.', 'Le bouton marqué GPS, pour le rétablir.'],
      auto: () => { S.faults.gps = false; },
    },
    {
      id: 'relock', title: 'Des CCU décrochées',
      enter: (c) => { const ids = camIds(true).slice(1, 3); c.mem.cams = ids; for (const id of ids) { const k = camById(id); if (k) k.genlock = false; } },
      say: (c) => `Après une coupure du distributeur de référence, les CCU ${c.mem.cams.join(' et ')} ne sont plus verrouillées : leurs images dérivent sur leur propre quartz et sauteraient à la coupe. Depuis la synchro, on peut toutes les re-verrouiller d'un coup.`,
      do: 'Re-verrouille toutes les CCU.',
      go: { station: 'synchro' }, show: [btn('Re-verrouiller', 'toutes les CCU')],
      done: (c) => (c.mem.cams || []).every((id) => { const k = camById(id); return !k || k.genlock; }),
      ok: 'Toutes les caméras sont de nouveau verrouillées sur la référence, donc en phase : leurs images ne sauteront plus à la commutation.',
      hints: ['Le poste synchro peut agir sur toutes les CCU à la fois.', 'Le bouton « Re-verrouiller » (toutes les CCU).'],
      auto: (c) => { for (const id of c.mem.cams) { const k = camById(id); if (k) k.genlock = true; } emit('repair', 'genlock'); },
    },
    {
      id: 'quiz', title: 'Question',
      say: 'Pour finir.',
      quiz: { q: 'Quel signal de référence a été conçu pour les équipements HD ?', choices: ['Le tri-level (synchro à trois niveaux)', 'Le black burst', 'Le timecode LTC'], answer: 0, why: 'Le tri-level a été créé pour la HD. Le black burst vient de la SD : beaucoup d\'appareils HD l\'acceptent encore, c\'est pourquoi on le trouve partout, mais ce n\'est pas la référence propre à la HD. Le timecode date les images, il ne les synchronise pas.' },
    },
  ],
};

// ---------------- grille ----------------
// car SDI : la Videohub 40 × 40 (ui/st_videohub.js) ; car IP : le contrôleur NMOS (boutons data-d / data-s)
const vhUi = () => visible('#station .vh-ctl');
const vhTargets = (c, out, outLabel, inp, inLabel) => (c.view().tab === 'control'
  ? [{ sel: `#station .vh-dest button[data-out="${out}"]`, label: outLabel }, { sel: `#station .vh-src button[data-in="${inp}"]`, label: inLabel }, { sel: '#station .vh-take', label: 'TAKE' }]
  : [{ sel: '#station .tabs .tab[data-k="control"]', label: 'Videohub Control' }]);
/** @type {import('../engine.js').Lesson} */
const ROUTE = {
  id: 'grille-routage', domain: D, stations: ['grille'],
  title: 'Router une source vers une destination à la grille',
  summary: 'Exercice de la leçon « La grille de commutation » : la destination d\'abord, la source ensuite, puis TAKE ; changer une vignette du multiview, puis remettre le programme sur un départ vers la chaîne.',
  duration: '6 min', level: 'débutant',
  outro: 'La grille relie n\'importe quelle source à n\'importe quelle destination. On choisit toujours la destination d\'abord, la source ensuite, puis TAKE ; et on vérifie au moniteur.',
  cleanupLabel: 'Remettre la vignette et les départs',
  cleanup: (c) => { if (c.mem.old) route('MV13', c.mem.old); route('AUX_TX1', 'PGM'); route('AUX_TX2', 'PGM'); },
  steps: [
    {
      id: 'intro', title: 'La grille',
      enter: (c) => {
        // un verrou laissé par un autre exercice ne doit pas bloquer celui-ci
        if (!S.ipMode) for (const n of [31, 32, 35]) if (lockState(n) !== 'U') setLock(n, null);
        c.mem.old = ROUTER.map.MV13; const ids = camIds().filter((i) => i <= 16); c.mem.src = 'CAM' + ([4, 5, 6, 3].find((i) => ids.includes(i) && ROUTER.map.MV13 !== 'CAM' + i) || ids[0]);
      },
      say: () => 'Rappel de la leçon : la grille relie n\'importe quelle source à n\'importe quelle destination, et l\'on choisit toujours la destination d\'abord, la source ensuite, puis TAKE.\n\nLa **grille de commutation** distribue tous les signaux du car : les entrées du mélangeur, les vignettes du multiview, les enregistrements de l\'EVS, les départs vers la chaîne. Chaque **destination** (une entrée d\'appareil) reçoit une **source** (une sortie d\'appareil).' + (S.ipMode ? '\n\nDans le car IP, un contrôleur NMOS joue ce rôle sur le réseau ST 2110.' : '\n\nDans ce car SDI, c\'est une **Videohub 40 × 40** : 40 entrées (les sources), 40 sorties (les destinations).'),
    },
    goStation('grille', 'Le poste grille est dans la zone technique.', 'Trois colonnes : la destination, la source, puis TAKE (la touche qui exécute la commutation) : toujours dans cet ordre.', {
      ok: () => (S.ipMode ? 'Trois colonnes : la destination, la source, puis CONNECT (la touche qui exécute la connexion) : toujours dans cet ordre.' : 'En haut, la façade de la Videohub ; dessous, le logiciel Videohub Control : les destinations, les sources, puis TAKE (la touche qui exécute la commutation) : toujours dans cet ordre.'),
      hints: ['Les postes techniques sont regroupés dans la zone technique du car.', 'Touche Tab (le pupitre), puis la touche du poste dans la rangée Technique ; ou « Emmène-moi ».'],
    }),
    {
      id: 'mv', title: 'Une vignette du multiview',
      say: (c) => `Le réalisateur veut voir la ${c.mem.src.replace('CAM', 'CAM ')} sur la vignette 13 du multiview. ${S.ipMode ? 'Destination d\'abord (groupe Multiview, MV 13), source ensuite, puis CONNECT.' : 'Sur la Videohub, la vignette 13 est alimentée par la sortie 35 « MV 13 » : destination d\'abord, source ensuite, puis TAKE.'}`,
      do: (c) => (S.ipMode ? `Envoie la ${c.mem.src.replace('CAM', 'CAM ')} sur MV 13.` : `Envoie la ${c.mem.src.replace('CAM', 'CAM ')} sur la sortie 35 « MV 13 » (Videohub Control).`),
      go: () => (S.ipMode ? { station: 'grille' } : { station: 'grille', tab: 'control' }),
      show: (c) => (vhUi() || (!S.ipMode && c.view().tab !== 'control') ? vhTargets(c, 35, 'MV 13', +c.mem.src.slice(3), c.mem.src) : visible('#station button.hw[data-d="MV13"]') ? [{ sel: '#station button.hw[data-d="MV13"]', label: 'MV 13' }, { sel: `#station button.hw[data-s="${c.mem.src}"]`, label: c.mem.src }] : [{ sel: '#station .tabs .tab', text: 'Multiview', label: 'groupe Multiview' }]),
      done: (c) => ROUTER.map.MV13 === c.mem.src,
      ok: 'La vignette a changé : le réalisateur voit la caméra demandée. Les destinations du multiview se règlent en général une fois pour toutes avant le match.',
      hints: ['Destination d\'abord : la vignette 13 du multiview (sur la Videohub du car SDI, c\'est la sortie 35 « MV 13 »).', 'MV 13, puis la caméra dans les sources, puis TAKE.'],
      auto: (c) => route('MV13', c.mem.src),
    },
    {
      id: 'tx', title: 'Un départ sur la mire',
      enter: () => { if (!S.ipMode) for (const n of [31, 32]) if (lockState(n) !== 'U') setLock(n, null); route('AUX_TX1', 'BARS'); route('AUX_TX2', 'BARS'); },
      say: 'Alerte de la chaîne : elle reçoit la **mire** (les barres de couleur) au lieu du programme. Une mauvaise manipulation a routé les barres sur les départs TX (les sorties vers la chaîne). On remet le **PGM** (le programme, ce qui part à l\'antenne) sur le départ en service.',
      do: () => (S.ipMode ? 'Remets PGM sur le départ TX1 (groupe « Départs et AUX »).' : 'Remets le PGM (entrée 24) sur la sortie 31 « TX1 FIBRE ».'),
      go: () => (S.ipMode ? { station: 'grille' } : { station: 'grille', tab: 'control' }),
      show: (c) => (vhUi() || (!S.ipMode && c.view().tab !== 'control') ? vhTargets(c, 31, 'départ TX1', 24, 'PGM') : visible('#station button.hw[data-d="AUX_TX1"]') ? [{ sel: '#station button.hw[data-d="AUX_TX1"]', label: 'départ TX1' }, { sel: '#station button.hw[data-s="PGM"]', label: 'PGM' }] : [{ sel: '#station .tabs .tab', text: 'Départs', label: 'groupe Départs et AUX' }]),
      done: () => txOk(),
      ok: 'La chaîne a de nouveau le programme. Pense aussi au départ de secours TX2 : s\'il garde la mire, une bascule sur le secours enverrait les barres à l\'antenne.',
      hints: ['Destination d\'abord : le départ TX1 (sur la Videohub, sortie 31 « TX1 FIBRE » ; sur le contrôleur IP, groupe « Départs et AUX »).', 'TX1, puis la source PGM, puis TAKE.'],
      auto: () => { route('AUX_TX1', 'PGM'); route('AUX_TX2', 'PGM'); },
    },
    {
      id: 'quiz', title: 'Question',
      say: 'Deux sources se ressemblent.',
      quiz: { q: 'Quelle différence entre PGM et CLEAN ?', choices: ['CLEAN est le programme sans les incrustations (score, bandeaux)', 'CLEAN est le programme sans le son', 'CLEAN est l\'image en PVW, prête à passer'], answer: 0, why: 'Le clean feed (« programme propre ») suit les mêmes commutations que le PGM, mais sans l\'habillage : il sert aux diffuseurs qui ajoutent le leur, et à l\'écran géant du stade. Ce n\'est ni une version sans son, ni le PVW (la source préparée pour la prochaine transition).' },
    },
  ],
};

// ---------------- baie de brassage ----------------
const jack = (field, label) => ({ sel: `#pf-${field} + .patch-field g.jack[aria-label="${label}"]`, label });
/** @type {import('../engine.js').Lesson} */
const PATCH = {
  id: 'brassage-cordons', domain: D, stations: ['brassage'], needs: { cams: 1 },
  title: 'Câbler un car vide à la baie de brassage',
  summary: 'Exercice de la leçon « Connecteurs, câbles, brassage » : la baie normalée, puis un car vide à brasser : une CCU vers la grille, sa référence, le départ vers le codeur de transmission.',
  duration: '8 min', level: 'intermédiaire',
  outro: 'Dans un car normalisé, chaque liaison passe par la baie sans cordon ; un cordon sert à dévier un signal (secours, test). Le brassage complet d\'un car vide, c\'est l\'exercice du même nom au poste.',
  cleanupLabel: 'Remettre le car normalisé',
  cleanup: () => { patchNormal(); S.patch.on = false; emit('router', {}); emit('cams'); },
  after: () => { if (S.patch.on) { patchNormal(); S.patch.on = false; emit('router', {}); emit('cams'); } },
  steps: [
    {
      id: 'intro', title: 'Le jackfield',
      enter: (c) => { c.mem.cam = camIds(true)[0] || 1; },
      say: 'Rappel de la leçon : la baie de brassage est le carrefour des liaisons ; chaque passage y ajoute deux connecteurs et un cordon, et un cordon inséré coupe la liaison habituelle pour la dévier.\n\nEntre les équipements et la grille, tous les signaux passent par une **baie de brassage** (jackfield, un panneau de prises où l\'on branche des cordons). Elle est **normalée** (on dit aussi « normalisée ») : sans cordon, chaque sortie est reliée à l\'entrée prévue. Pour cet exercice, je débranche tout : c\'est le « car vide ».',
    },
    goStation('brassage', 'La baie de brassage est dans la zone technique.', 'Trois champs : sources vers entrées de la grille, sorties de la grille vers les destinations, distributeur de référence vers les CCU. On les câblera dans cet ordre.', { hints: ['Les postes techniques sont regroupés dans la zone technique du car.', 'Touche Tab (le pupitre), puis la touche du poste dans la rangée Technique ; ou « Emmène-moi ».'] }),
    {
      id: 'empty', title: 'Car vide',
      say: 'Plus rien n\'est relié : le multiview est noir, la chaîne ne reçoit rien. C\'est l\'état d\'un car qui arrive sur le site.',
      do: 'Passe en mode « car vide ».',
      go: { station: 'brassage' }, show: [btn('car vide', 'car vide')],
      done: () => !!(S.patch && S.patch.on),
      ok: 'Tout est débranché : c\'est le point de départ d\'un car qu\'on installe. On câble l\'essentiel, dans l\'ordre de la chaîne.',
      hints: ['Le mode de la baie se choisit par un bouton du poste.', 'Le bouton « car vide ».'],
      auto: () => { S.patch.on = true; patchEmpty(); emit('router', {}); emit('cams'); },
    },
    {
      id: 'in', title: 'Une caméra vers la grille',
      say: (c) => `Un cordon relie une sortie (rangée du haut) à une entrée (rangée du bas). On commence par la CCU ${c.mem.cam} vers l'entrée ${c.mem.cam} de la grille.`,
      do: (c) => `Brasse CCU ${c.mem.cam} → IN ${c.mem.cam} (clique la prise du haut, puis celle du bas).`,
      go: { station: 'brassage' }, show: (c) => [jack('inputs', `CCU ${c.mem.cam}`), jack('inputs', `IN ${c.mem.cam}`)],
      done: (c) => S.patch.inputs[c.mem.cam] === 'CAM:' + c.mem.cam,
      ok: 'L\'image de la caméra arrive à la grille, donc au mélangeur et au multiview.',
      hints: ['Champ du haut : sources vers entrées de la grille. Un cordon va d\'une sortie à une entrée.', 'Clique la prise « CCU » de la caméra (rangée du haut), puis la prise « IN » du même numéro (rangée du bas).'],
      auto: (c) => { S.patch.inputs[c.mem.cam] = 'CAM:' + c.mem.cam; emit('router', {}); },
    },
    {
      id: 'ref', title: 'Sa référence',
      say: (c) => `Sans référence, la CCU ${c.mem.cam} n'est pas verrouillée. Le distributeur de référence (DA, il recopie la référence du SPG) a une sortie par CCU.`,
      do: (c) => `Brasse DA ${c.mem.cam} → CCU ${c.mem.cam} REF.`,
      go: { station: 'brassage' }, show: (c) => [jack('refs', `DA ${c.mem.cam}`), jack('refs', `CCU ${c.mem.cam} REF`)],
      done: (c) => !!S.patch.refs[c.mem.cam],
      ok: 'La caméra est verrouillée : son image est en phase avec les autres et ne sautera pas à la commutation.',
      hints: ['Champ du bas : le distributeur de référence vers les CCU.', 'Clique la prise « DA » du même numéro, puis la prise « REF » de la CCU.'],
      auto: (c) => { S.patch.refs[c.mem.cam] = c.mem.cam; emit('cams'); },
    },
    {
      id: 'tx', title: 'Le départ vers la chaîne',
      say: 'La sortie 31 de la grille porte le départ TX1 : on la brasse vers le **codeur de transmission** (il compresse le programme pour la liaison vers la chaîne).',
      do: 'Brasse OUT 31 → CODEUR TX1.',
      go: { station: 'brassage' }, show: [jack('outputs', 'OUT 31'), jack('outputs', 'CODEUR TX1')],
      done: () => S.patch.outputs[31] === 'TX1',
      ok: 'Le programme repart vers la chaîne : sans ce cordon, tout le travail du car resterait dans le car.',
      hints: ['Champ du milieu : sorties de la grille vers les destinations.', 'Clique la prise « OUT 31 », puis la prise « CODEUR TX1 ».'],
      auto: () => { S.patch.outputs[31] = 'TX1'; emit('router', {}); },
    },
    {
      id: 'back', title: 'Retour au car normalisé',
      say: 'Pour la suite de la journée, on remet le car normalisé.',
      do: 'Repasse en car normalisé.',
      go: { station: 'brassage' }, show: [btn('normalisé', 'car normalisé')],
      done: () => !S.patch.on,
      ok: 'Toutes les liaisons sont rétablies sans cordon : c\'est l\'intérêt d\'une baie normalisée.',
      hints: ['Même endroit que le mode « car vide ».', 'Le bouton « normalisé ».'],
      auto: () => { patchNormal(); S.patch.on = false; emit('router', {}); emit('cams'); },
    },
    {
      id: 'quiz', title: 'Question',
      say: 'Pour finir.',
      quiz: { q: 'Que veut dire « baie normalée » ?', choices: ['Sans cordon, chaque sortie est reliée à son entrée habituelle ; un cordon interrompt la liaison et la dévie', 'Toutes les prises ont le même connecteur', 'La baie respecte une norme de couleur'], answer: 0, why: 'Les normales évitent des centaines de cordons : on ne brasse que les exceptions. « Normalisée » décrit le câblage par défaut derrière la baie, pas le type de connecteur ni un code de couleurs.' },
    },
  ],
};

// ---------------- transmission ----------------
/** @type {import('../engine.js').Lesson} */
const TX = {
  id: 'transmission-secours', domain: D, stations: ['transmission'],
  title: 'Envoyer la mire et basculer sur le secours',
  summary: 'Exercice de la leçon « La transmission : départ, retour, secours » : envoyer la mire avant l\'antenne, revenir au programme, puis basculer sur la liaison de secours quand la fibre principale tombe.',
  duration: '6 min', level: 'débutant',
  outro: 'La transmission, c\'est le lien avec la chaîne : un départ principal, un secours prêt, et le retour antenne à surveiller en permanence.',
  cleanupLabel: 'Rétablir la liaison principale',
  cleanup: () => { S.faults.tx = false; S.txPath = 1; route('AUX_TX1', 'PGM'); route('AUX_TX2', 'PGM'); },
  after: () => { S.faults.tx = false; },
  steps: [
    {
      id: 'intro', title: 'La transmission',
      say: 'Rappel de la leçon : le programme part vers la chaîne par deux chemins prêts en permanence, et le retour antenne, ce que la chaîne diffuse vraiment, revient avec plusieurs secondes de retard.\n\nIci, **TX1** est la fibre de l\'opérateur, codée en JPEG XS (le principal), et **TX2** un camion satellite, codé en HEVC (le secours). La chaîne renvoie ce qu\'elle diffuse : le **retour antenne**.',
    },
    goStation('transmission', 'Le poste transmission est dans la zone technique.', 'À gauche le départ, à droite le retour antenne ; dans le tableau, l\'état des deux liaisons : d\'un regard, tu sais ce que la chaîne reçoit.', { hints: ['Les postes techniques sont regroupés dans la zone technique du car.', 'Touche Tab (le pupitre), puis la touche du poste dans la rangée Technique ; ou « Emmène-moi ».'] }),
    {
      id: 'bars', title: 'La mire',
      say: 'Avant la prise d\'antenne, c\'est le **test de ligne** : la chaîne reçoit la **mire** (barres à 75 %, 1 kHz à −18 dBFS sur chaque paire audio, ident) pour vérifier l\'image, les niveaux et l\'ordre des paires.',
      do: 'Envoie la mire à la chaîne.',
      go: { station: 'transmission' }, show: [hw('ENVOYER LA MIRE')],
      done: () => ROUTER.map.AUX_TX1 === 'BARS',
      ok: 'La chaîne reçoit la mire : elle confirme « image et son OK ». Les niveaux et les paires audio sont vérifiés avant l\'antenne, pas pendant.',
      hints: ['C\'est le départ qu\'on change : cherche la commande de la mire au poste transmission.', 'La touche « ENVOYER LA MIRE ».'],
      auto: () => { route('AUX_TX1', 'BARS'); route('AUX_TX2', 'BARS'); },
    },
    {
      id: 'pgm', title: 'Le programme',
      say: 'Quelques minutes avant l\'antenne, on renvoie le programme.',
      do: 'Remets le programme sur les départs (même bouton).',
      go: { station: 'transmission' }, show: [hw('MIRE')],
      done: () => ROUTER.map.AUX_TX1 === 'PGM',
      ok: 'Le programme part vers la chaîne : on est prêt pour l\'antenne.',
      hints: ['La même touche bascule entre mire et programme.', 'La touche « MIRE » : appuie de nouveau pour revenir au programme.'],
      auto: () => { route('AUX_TX1', 'PGM'); route('AUX_TX2', 'PGM'); },
    },
    {
      id: 'cut', title: 'La fibre TX1 tombe',
      enter: () => { S.faults.tx = true; S.txPath = 1; },
      say: 'Alarme : la fibre TX1 est coupée, le retour antenne est figé. On bascule immédiatement sur **TX2**, puis on prévient la chaîne.',
      do: 'Bascule sur TX2.',
      go: { station: 'transmission' }, show: [hw('TX2')],
      done: () => S.txPath === 2,
      ok: 'Le programme repart par TX2. La chaîne a perdu quelques secondes, pas plus, et comme le satellite a près de 0,75 s de retard de plus que la fibre, elle revoit un petit morceau d\'action. C\'est pour ça qu\'un secours doit toujours être prêt, et porter le programme.',
      hints: ['On ne répare pas la fibre en direct : on change de liaison.', 'La touche « TX2 ».'],
      auto: () => { S.txPath = 2; emit('repair', 'tx'); },
    },
    {
      id: 'quiz', title: 'Question',
      say: 'Le retour antenne a toujours un peu de retard.',
      quiz: { q: 'Pourquoi le retour antenne arrive-t-il avec plusieurs secondes de retard ?', choices: ['Codage, transmission, régie finale de la chaîne puis diffusion : chaque étape ajoute du retard', 'Parce que le car le retarde volontairement', 'Parce que la fibre est trop longue'], answer: 0, why: 'Un retour par satellite ou par la diffusion numérique cumule plusieurs secondes de codage et de traitement. La fibre, elle, n\'ajoute qu\'environ 5 µs par kilomètre, et le car ne retarde rien volontairement. On ne commute donc jamais en regardant le retour antenne : il sert à vérifier ce que la chaîne diffuse.' },
    },
  ],
};

// ---------------- intercom ----------------
// la touche TALK d'un canal, par son nom : le pupitre à plat et le pupitre en 3D portent le même aria-label
const icpTalk = (canal) => ({ sel: `#station .icp-talk[aria-label="TALK ${canal}"]`, label: 'TALK ' + canal });
/** @type {import('../engine.js').Lesson} */
const ICOM = {
  id: 'intercom-parler', domain: D, stations: ['intercom'],
  title: 'Parler à la bonne personne à l\'intercom',
  summary: 'Exercice de la leçon « L\'intercom : parler à la bonne personne » : le panneau de la régie, ses touches TALK et LISTEN, la conférence des cadreurs, une touche vers l\'EVS et le retour des commentateurs.',
  duration: '5 min', level: 'découverte',
  outro: 'L\'intercom relie tout le car : cadreurs, vision, son, EVS, plateau, chaîne. Règle d\'or : des phrases courtes, et on ferme le TALK dès qu\'on a fini de parler.',
  steps: [
    {
      id: 'intro', title: 'L\'intercom',
      say: 'Rappel de la leçon : une matrice relie tous les postes ; on parle par la touche la plus étroite (conférence, point à point, IFB), le nom d\'abord, et on referme le TALK dès qu\'on a fini.\n\nL\'**intercom** est le réseau d\'ordres du car. Chaque poste a un panneau : **TALK** ouvre ton micro vers un groupe ou une personne, **LISTEN** te fait entendre ce canal. Les cadreurs écoutent le réalisateur en permanence dans leur casque.',
    },
    goStation('intercom', 'Le panneau principal est en régie de production.', 'Chaque touche : un écran (le nom du canal), TALK et LISTEN. Lis toujours le nom avant d\'ouvrir le micro.', { hints: ['Le panneau principal est en régie de production, avec le réalisateur.', 'Touche Tab (le pupitre), puis la touche « Intercom » ; ou « Emmène-moi ».'] }),
    {
      id: 'cams', title: 'Parler aux cadreurs',
      say: 'Le canal **CAMÉRAS** est une conférence : tous les cadreurs l\'entendent. C\'est par là que passent les « prépare », les consignes de cadrage, les remarques.',
      do: 'Ouvre le TALK vers CAMÉRAS.',
      go: { station: 'intercom' }, show: [icpTalk('CAMÉRAS')],
      done: (c) => c.seen('intercom', (e) => /CAMÉRAS/.test(e.msg || '')),
      ok: 'Tous les cadreurs t\'entendent. Referme le TALK dès que tu as fini : un micro resté ouvert couvre les ordres du réalisateur.',
      hints: ['Chaque touche du panneau porte le nom de son canal sur son écran.', 'Sur la touche CAMÉRAS, appuie sur TALK.'],
      auto: (c) => ui(c, 'click', icpTalk('CAMÉRAS').sel),
    },
    {
      id: 'evs', title: 'Un point direct',
      say: 'Pour ne pas encombrer la conférence des cadreurs, on prend une touche plus étroite, vers un seul groupe : ici les opérateurs ralenti (l\'**EVS**, le serveur de ralentis).',
      do: 'Ouvre le TALK vers EVS.',
      go: { station: 'intercom' }, show: [icpTalk('EVS')],
      done: (c) => c.seen('intercom', (e) => /EVS/.test(e.msg || '')),
      ok: 'Seuls les opérateurs ralenti t\'entendent : les cadreurs gardent leur canal libre pour les ordres du réalisateur.',
      hints: ['Cherche la touche dont l\'écran porte le nom du poste ralenti.', 'Sur la touche EVS, appuie sur TALK.'],
      auto: (c) => ui(c, 'click', icpTalk('EVS').sel),
    },
    {
      id: 'quiz', title: 'Question',
      say: 'Une question sur les commentateurs. Dans leur casque, ils reçoivent un **N-1** (le retour son qui contient tout le programme, sauf la voix de celui qui l\'écoute).',
      quiz: { q: 'Pourquoi le commentateur reçoit-il un N-1 et non le programme complet dans son casque ?', choices: ['Sinon il s\'entendrait lui-même, en retard, et parlerait en écho', 'Parce que le programme est en stéréo', 'Pour économiser de la bande passante'], answer: 0, why: 'Le N-1 (« mix-minus ») est le programme moins sa propre voix. Sa voix lui revient après tout le traitement, avec du retard : il s\'entendrait en écho et finirait par bafouiller. Ce n\'est ni une question de stéréo ni de bande passante. Le N-1 garde les ordres de la régie et le son du stade, sans l\'écho de sa voix.' },
    },
  ],
};

export const LIAISON_LESSONS = [HF, SYNC, ROUTE, PATCH, TX, ICOM];

// @ts-check
// Parcours du chef de car : la grille Videohub.
import { emit } from '../../state.js';
import { ROUTER, route } from '../../pipeline.js';
import { injectFault, ACTIVE } from '../../faults.js';
import { VH, VH_PANEL as FP, VH_MON, inLabel, lockState, setLock, vhRoute } from '../../videohub.js';
import { goStation, camIds } from './kit.js';

// ----------------------------------------------------------------------------------
// Deux parcours sur la grille du car SDI (Videohub 40 × 40 12G, ui/st_videohub.js) :
//   · router une caméra de la façade puis du logiciel Videohub Control, lire le monitoring ;
//   · verrouiller les départs vers la chaîne, vérifier le refus, retrouver deux étiquettes inversées.
// Tout est vérifié sur l'état réel de la grille (videohub.js) : points de croisement, verrous,
// étiquettes, sélection de la façade, vignette cliquée dans le monitoring. Les deux sont les exercices
// pratiques de la leçon « La grille de commutation » du Cours (cours/sdi_grille.js).
// ----------------------------------------------------------------------------------
const D = 'Liaisons, synchro et diffusion';
const face = (k, label) => ({ sel: `#station .vh-face [data-fp="${k}"]`, label });
const dest = (n, label) => ({ sel: `#station .vh-dest button[data-out="${n}"]`, label });
const src = (n, label) => ({ sel: `#station .vh-src button[data-in="${n}"]`, label });
const TAKE = { sel: '#station .vh-take', label: 'TAKE' };
const tab = (k, label) => [{ sel: `#station .tabs .tab[data-k="${k}"]`, label }];
const onTab = (c, k) => c.view().tab === k;
// une caméra filaire de la grille (entrées 1 à 16) qui n'est ni sur l'écran géant ni sur la tuile 13
function pickCam() {
  const ids = camIds(true).filter((i) => i <= 16);
  return [4, 3, 5, 2, 6, ...ids].find((i) => ids.includes(i) && ROUTER.map.AUX_GIANT !== 'CAM' + i && ROUTER.map.MV13 !== 'CAM' + i) || ids[0] || 1;
}
// un verrou laissé par un autre exercice ne doit pas bloquer celui-ci
function freeOuts(c, outs) { c.mem.locks = c.mem.locks || {}; for (const n of outs) { const l = lockState(n); if (l !== 'U') { c.mem.locks[n] = l; setLock(n, null); } } }

// ---------------- router de la façade et du logiciel ----------------
/** @type {import('../engine.js').Lesson} */
const ROUTE = {
  id: 'videohub-routage', domain: D, stations: ['grille'], needs: { sdi: true, cams: 2 },
  title: 'Router une caméra sur la Videohub et lire le monitoring',
  summary: 'Exercice de la leçon « La grille de commutation » : la façade (OUT, IN, TAKE), le logiciel Videohub Control et le monitoring des 40 entrées et 40 sorties ; une même caméra vers l\'écran géant et vers une tuile du multiview.',
  duration: '8 min', level: 'débutant',
  outro: 'Sur une grille, toujours le même ordre : la destination, la source, TAKE, puis on vérifie l\'image (écran de la façade, monitoring, multiview). Une source peut partir vers autant de sorties qu\'on veut ; une sortie ne reçoit qu\'une source.',
  cleanupLabel: 'Remettre l\'écran géant et la tuile 13',
  cleanup: (c) => { route('AUX_GIANT', c.mem.giant || 'CLEAN'); if (c.mem.mv13) route('MV13', c.mem.mv13); },
  steps: [
    {
      id: 'intro', title: 'La Videohub',
      enter: (c) => { c.mem.cam = pickCam(); c.mem.giant = ROUTER.map.AUX_GIANT; c.mem.mv13 = ROUTER.map.MV13; freeOuts(c, [33, 35]); },
      say: 'Leçon « La grille de commutation » : chaque sortie reçoit une seule source, une source peut partir vers toutes les sorties, et l\'on commute toujours dans l\'ordre destination, source, TAKE.\n\nLa grille de ce car est une **Videohub 40 × 40 12G** : 40 **entrées** (les sources : caméras, serveurs EVS, sorties du mélangeur…) et 40 **sorties** (les destinations : entrées du mélangeur, enregistreurs, départs, écrans). Chaque sortie peut recevoir n\'importe quelle entrée.\n\nOn la commande de sa **façade** (un écran, des touches, une molette) ou du logiciel **Videohub Control**, par le réseau. Le **monitoring** montre en direct toutes les entrées et toutes les sorties.',
    },
    goStation('grille', 'La grille est dans la zone technique.', 'En haut, la façade de la Videohub ; dessous, le logiciel Videohub Control, le monitoring, la matrice et les réglages (Videohub Setup).'),
    {
      id: 'fp-out', title: 'Façade : la destination',
      enter: () => { FP.mode = 'out'; FP.pending = false; FP.inp = null; if (FP.out === 33) FP.out = 1; },
      say: 'Le réalisateur veut une caméra sur l\'**écran géant** du stade : c\'est la sortie 33. Sur une grille, on choisit **toujours la destination d\'abord**.',
      do: 'Sur la façade : touche OUT, puis la sortie 33 (touches 3 et 3, ou la molette).',
      go: { station: 'grille' }, show: [face('out', 'OUT'), face('d3', '3'), face('knob', 'molette')],
      done: () => FP.out === 33 && FP.mode !== 'menu',
      ok: 'L\'écran de la façade montre ce que reçoit l\'écran géant : le clean feed (le programme sans habillage). Tu as seulement choisi la destination : rien n\'a changé dans le stade.',
      hints: ['La façade est en haut du poste : une touche fait passer en choix de la destination, puis on donne le numéro de la sortie.', 'OUT, puis 3 et 3 (ou la molette jusqu\'à 33 « ÉCRAN GÉANT »).'],
      auto: () => { FP.mode = 'out'; FP.out = 33; FP.pending = false; FP.inp = null; },
    },
    {
      id: 'fp-in', title: 'Façade : la source et TAKE',
      say: (c) => `La source ensuite : la CAM ${c.mem.cam}, câblée sur l'entrée ${c.mem.cam}. Touche **IN** : la molette parcourt les entrées et l'écran montre l'image de chacune **avant** la commutation. Dès qu'une autre source est choisie, CLEAR et TAKE clignotent : **TAKE** valide, CLEAR annule.`,
      do: (c) => `IN, puis l'entrée ${c.mem.cam} (CAM ${c.mem.cam}), puis TAKE.`,
      go: { station: 'grille' }, show: [face('in', 'IN'), face('knob', 'molette'), face('take', 'TAKE')],
      done: (c) => ROUTER.map.AUX_GIANT === 'CAM' + c.mem.cam,
      ok: (c) => `**Point de croisement** établi (la liaison, dans la grille, entre une entrée et une sortie) : entrée ${c.mem.cam} → sortie 33. L'écran géant montre la CAM ${c.mem.cam}. L'écran de la façade t'a montré l'image avant de valider : on regarde toujours avant de prendre.`,
      hints: ['Une touche fait passer en choix de la source ; le numéro de l\'entrée d\'une caméra est celui de la caméra.', 'IN, puis le numéro de la caméra (ou la molette), puis TAKE quand il clignote.'],
      auto: (c) => { vhRoute(33, c.mem.cam); FP.mode = 'out'; FP.out = 33; FP.pending = false; FP.inp = null; },
    },
    {
      id: 'sw-mv', title: 'Logiciel : une deuxième sortie',
      say: (c) => `Le réalisateur veut aussi la CAM ${c.mem.cam} sur la **tuile 13** du multiview : c'est la sortie 35. Cette fois, avec le logiciel **Videohub Control** : la première grille de boutons donne les destinations, la seconde les sources.`,
      do: (c) => `Videohub Control : destination 35 « MV 13 », source ${c.mem.cam} « CAM ${c.mem.cam} », puis TAKE.`,
      go: { station: 'grille', tab: 'control' },
      show: (c) => (onTab(c, 'control') ? [dest(35, 'MV 13'), src(c.mem.cam, 'CAM ' + c.mem.cam), TAKE] : tab('control', 'Videohub Control')),
      done: (c) => ROUTER.map.MV13 === 'CAM' + c.mem.cam,
      ok: (c) => `La CAM ${c.mem.cam} alimente maintenant deux sorties, 33 et 35 : une source peut partir vers autant de destinations qu'on veut. Chaque sortie, elle, ne reçoit qu'une source.`,
      hints: ['Destination d\'abord, dans la première grille de boutons.', 'MV 13 (sortie 35), puis la caméra dans les sources (elle clignote), puis TAKE.'],
      auto: (c) => vhRoute(35, c.mem.cam),
    },
    {
      id: 'mon', title: 'Lire le monitoring',
      enter: () => { VH_MON.pickOut = null; },
      say: 'Le **monitoring** montre en vignettes vivantes les 40 entrées et les 40 sorties, avec leur numéro et leur étiquette. Une bordure rouge : à l\'antenne ; verte : en preview ; un bandeau rouge : une alarme (pas de signal) ; un cadenas : une sortie verrouillée.',
      do: 'Onglet Monitoring : dans la mosaïque des sorties, clique la vignette de la sortie 33 (ÉCRAN GÉANT).',
      go: { station: 'grille', tab: 'mon' },
      show: (c) => (onTab(c, 'mon') ? [{ sel: '#station .vh-hit.out button[data-out="33"]', label: 'sortie 33' }] : tab('mon', 'Monitoring')),
      done: (c) => VH_MON.pickOut === 33 && onTab(c, 'mon'),
      ok: (c) => `Vignette 33 : l'image de la CAM ${c.mem.cam}, l'étiquette « ÉCRAN GÉANT » et « ← ${c.mem.cam} », l'entrée qu'elle reçoit. La vignette 35 montre la même image : une colonne, deux points de croisement.`,
      hints: ['Le monitoring a deux mosaïques : les entrées (sources), puis les sorties (destinations).', 'Dans la mosaïque des sorties, la vignette numérotée 33, cinquième rangée.'],
      auto: (c) => { c.io.go({ station: 'grille', tab: 'mon' }); VH_MON.pickOut = 33; },
    },
    {
      id: 'back', title: 'Rendre l\'écran géant',
      say: 'L\'essai est fini : l\'écran géant du stade reprend le **clean feed** (le programme sans l\'habillage de la télé : le stade affiche son propre score).',
      do: 'Remets l\'entrée 25 « CLEAN » sur la sortie 33, de la façade ou du logiciel.',
      go: { station: 'grille', tab: 'control' },
      show: (c) => (onTab(c, 'control') ? [dest(33, 'ÉCRAN GÉANT'), src(25, 'CLEAN'), TAKE] : tab('control', 'Videohub Control')),
      done: () => ROUTER.map.AUX_GIANT === 'CLEAN',
      ok: 'Écran géant revenu au clean feed. La tuile 13 garde la caméra : le réalisateur l\'avait demandée.',
      hints: ['Même geste que tout à l\'heure : la destination, puis la source.', 'Sortie 33 « ÉCRAN GÉANT », entrée 25 « CLEAN », TAKE.'],
      auto: () => vhRoute(33, 25),
    },
    {
      id: 'quiz', title: 'Question',
      say: 'Pour finir.',
      quiz: { q: 'La CAM 4 part vers l\'écran géant (sortie 33) et la tuile 13 (sortie 35). Tu routes la CAM 2 sur la sortie 33. Que montre la tuile 13 ?', choices: ['Toujours la CAM 4 : chaque sortie a son propre point de croisement', 'La CAM 2 : les deux sorties recevaient la même source, elles suivent ensemble', 'Plus rien : une entrée ne peut pas être retirée d\'une sortie sans couper les autres'], answer: 0, why: 'Commuter la sortie 33 ferme un autre point sur sa ligne et ouvre l\'ancien, sur cette ligne seulement. Une entrée n\'est jamais « attachée » à un groupe de sorties : la grille recopie le signal vers chaque sortie indépendamment. L\'erreur fréquente est de croire que les sorties d\'une même source sont liées.' },
    },
  ],
};

// ---------------- verrouiller les départs, étiquettes fausses ----------------
/** @type {import('../engine.js').Lesson} */
const LOCK = {
  id: 'videohub-verrou', domain: D, stations: ['grille'], needs: { sdi: true, cams: 2 },
  title: 'Verrouiller les départs et corriger une étiquette sur la Videohub',
  summary: 'Exercice de la leçon « La grille de commutation » : verrouiller les sorties TX1 et TX2 vers la chaîne, constater le refus d\'une fausse manœuvre, puis retrouver au monitoring et dans Videohub Setup deux étiquettes de caméras inversées.',
  duration: '9 min', level: 'intermédiaire',
  outro: 'Trois réflexes de grille : verrouiller les départs, regarder l\'image avant de valider, relire les étiquettes au line-up. À la fin du parcours, je déverrouille les départs pour les autres exercices ; en exploitation, ils restent verrouillés pendant tout le direct.',
  cleanupLabel: 'Déverrouiller les départs et réparer les étiquettes',
  after: (c) => {
    for (const n of [31, 32]) if (lockState(n) !== 'U') setLock(n, null);
    for (const a of ACTIVE) if (!a.done && a.f.id === 'vhlabel') { a.f.repair(a.st); a.done = true; emit('fault'); }
  },
  steps: [
    {
      id: 'intro', title: 'Les départs vers la chaîne',
      enter: (c) => { freeOuts(c, [31, 32, 35]); route('AUX_TX1', 'PGM'); route('AUX_TX2', 'PGM'); },
      say: 'Leçon « La grille de commutation » : une sortie verrouillée refuse toute commutation, d\'où qu\'elle vienne, et une étiquette n\'est qu\'un nom.\n\nLes sorties 31 et 32 de la grille partent vers la chaîne : **TX1** par la fibre, **TX2** par le satellite (le secours). Or la grille se commande de partout : sa façade, le logiciel sur plusieurs ordinateurs, des panneaux, des automatismes. Une fausse manœuvre sur ces sorties, et la chaîne diffuse autre chose que le programme.\n\nOn les **verrouille** (LOCK) : une sortie verrouillée refuse toute commutation, d\'où qu\'elle vienne.',
    },
    goStation('grille', 'La grille est dans la zone technique.', 'La façade en haut, le logiciel Videohub Control dessous.'),
    {
      id: 'lock1', title: 'Verrouiller TX1 (logiciel)',
      say: 'Dans Videohub Control, on choisit la sortie, puis on la verrouille.',
      do: 'Destination 31 « TX1 FIBRE », puis « Verrouiller la sortie 31 ».',
      go: { station: 'grille', tab: 'control' },
      show: (c) => (onTab(c, 'control') ? [dest(31, 'TX1 FIBRE'), { sel: '#station .vh-lockbtn', label: 'verrouiller' }] : tab('control', 'Videohub Control')),
      done: () => lockState(31) !== 'U',
      ok: 'Cadenas ambre : la sortie 31 est verrouillée par ce poste (état O dans le protocole de la grille ; U = libre, L = verrouillée par un autre poste). Plus aucune commutation possible, ni d\'ici, ni de la façade, ni d\'un autre poste.',
      hints: ['La sortie d\'abord, puis le bouton de verrou à côté de TAKE.', 'Bouton 31 « TX1 FIBRE » dans les destinations, puis « Verrouiller la sortie 31 ».'],
      auto: () => setLock(31, 'O'),
    },
    {
      id: 'lock2', title: 'Verrouiller TX2 (façade)',
      say: 'Le secours aussi : une bascule sur TX2 enverrait sinon n\'importe quoi à l\'antenne. Cette fois depuis la façade.',
      do: 'Façade : OUT, 3 puis 2 (sortie 32 « TX2 SAT »), puis LOCK.',
      go: { station: 'grille' }, show: [face('out', 'OUT'), face('d3', '3'), face('d2', '2'), face('lock', 'LOCK')],
      done: () => lockState(32) !== 'U',
      ok: 'Les deux départs sont verrouillés. La touche LOCK reste allumée quand la sortie choisie est verrouillée : on le voit d\'un coup d\'œil.',
      hints: ['Sur la façade, on choisit d\'abord la sortie (OUT), puis la touche de verrou.', 'OUT, 3, 2, puis LOCK.'],
      auto: () => setLock(32, 'O'),
    },
    {
      id: 'try', title: 'Une fausse manœuvre',
      say: 'Vérifions. Envoie la **mire** (les barres de couleur du générateur de synchro, entrée 22 « MIRE SPG ») sur la sortie 31, comme le ferait une fausse manœuvre.',
      do: 'Destination 31, source 22 (puis TAKE si elle clignote) : la grille doit refuser.',
      go: { station: 'grille', tab: 'control' },
      show: (c) => (onTab(c, 'control') ? [dest(31, 'TX1 FIBRE'), src(22, 'MIRE SPG')] : tab('control', 'Videohub Control')),
      done: (c) => c.seen('router', (e) => e.vhRefused === 31) && ROUTER.map.AUX_TX1 === 'PGM',
      ok: 'Refusé : le départ garde le programme. Même la touche « Envoyer la mire » du poste Transmission ne passe plus. Pour un test de ligne, on déverrouille, on teste, on reverrouille.',
      hints: ['Même geste qu\'une commutation normale : la sortie, puis la source.', 'Sortie 31, puis entrée 22 « MIRE SPG » : un message de refus doit apparaître.'],
      auto: () => { vhRoute(31, 22); },
    },
    {
      id: 'labels', title: 'Deux étiquettes inversées',
      enter: (c) => { if (!c.mem.fault) { c.mem.fault = injectFault('vhlabel') || null; } const st = c.mem.fault ? c.mem.fault.st : { a: 3, b: 4 }; c.mem.a = st.a; c.mem.b = st.b; },
      say: (c) => `Le réalisateur à l'intercom : il a demandé la CAM ${c.mem.a} sur la tuile 13 et il voit la CAM ${c.mem.b}. L'opérateur a pourtant cliqué sur « CAM ${c.mem.a} »… Une **étiquette** n'est qu'un nom : si elle est fausse, on route la mauvaise image en croyant bien faire.\n\nCompare les étiquettes avec ce qui est câblé : onglet **Videohub Setup**, tableau des entrées, colonne « Câblée depuis ». Le monitoring des entrées montre aussi chaque image sous son étiquette.`,
      do: 'Corrige les deux étiquettes inversées (Videohub Setup, entrées).',
      go: { station: 'grille', tab: 'setup' },
      show: (c) => (onTab(c, 'setup') ? [{ sel: `#station .vh-setup input[aria-label="Étiquette de l'entrée ${c.mem.a}"]`, label: 'entrée ' + c.mem.a }, { sel: `#station .vh-setup input[aria-label="Étiquette de l'entrée ${c.mem.b}"]`, label: 'entrée ' + c.mem.b }] : tab('setup', 'Videohub Setup')),
      done: (c) => inLabel(c.mem.a) === 'CAM ' + c.mem.a && inLabel(c.mem.b) === 'CAM ' + c.mem.b,
      ok: 'Les étiquettes disent de nouveau la vérité : l\'entrée de chaque CCU porte le nom de sa caméra. C\'est ce qu\'on relit au line-up, liste de câblage en main.',
      hints: ['Deux entrées de caméras portent le nom l\'une de l\'autre : la colonne « Câblée depuis » dit quelle CCU arrive sur chaque entrée.', 'Chaque caméra arrive sur l\'entrée de même numéro : corrige les deux étiquettes, ou « Rétablir les étiquettes du car ».'],
      auto: (c) => { delete VH.labels.in[c.mem.a]; delete VH.labels.in[c.mem.b]; emit('router', { vhLabel: 'all' }); },
    },
    {
      id: 'reroute', title: 'La bonne caméra',
      say: 'Les noms sont justes ; la tuile 13 montre toujours la mauvaise caméra. On corrige la prise.',
      do: (c) => `Route la vraie CAM ${c.mem.a} sur la sortie 35 (MV 13).`,
      go: { station: 'grille', tab: 'control' },
      show: (c) => (onTab(c, 'control') ? [dest(35, 'MV 13'), src(c.mem.a, 'CAM ' + c.mem.a), TAKE] : tab('control', 'Videohub Control')),
      done: (c) => ROUTER.map.MV13 === 'CAM' + c.mem.a,
      ok: 'La tuile 13 montre enfin la caméra demandée. La grille n\'était pas en panne : l\'étiquette était fausse. Réflexe : regarder l\'image (écran de la façade, monitoring) avant de valider.',
      hints: ['Destination d\'abord, puis la source, puis TAKE.', 'Sortie 35 « MV 13 », puis l\'entrée qui porte maintenant le bon nom.'],
      auto: (c) => vhRoute(35, c.mem.a),
    },
    {
      id: 'quiz', title: 'Question',
      say: 'Pour finir.',
      quiz: { q: 'Pourquoi verrouiller les départs vers la chaîne plutôt que compter sur la prudence de chacun ?', choices: ['Plusieurs postes commandent la même grille (façade, logiciels, panneaux, automatismes) : le verrou bloque aussi une manœuvre faite ailleurs', 'Le verrou améliore la qualité du signal envoyé à la chaîne', 'Une sortie non verrouillée finit par changer de source toute seule'], answer: 0, why: 'Le verrou agit dans la grille elle-même : toute demande de commutation sur la sortie est refusée, d\'où qu\'elle vienne. Il ne touche pas au signal (c\'est le reclocking qui le régénère), et une sortie libre ne bouge jamais seule : le danger vient des manœuvres, la sienne ou celle d\'un autre poste.' },
    },
  ],
};

/** @type {import('../engine.js').Lesson[]} */
export const VIDEOHUB_LESSONS = [ROUTE, LOCK];

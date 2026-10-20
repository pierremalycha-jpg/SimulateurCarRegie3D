// @ts-check
import { S, camById } from '../../state.js';
import { MIX, EVS, mixSetPst, mixAuto, meSource, evsAction, evsSetRecording, recordedCams } from '../../pipeline.js';
import { EX } from '../../exercises.js';
import { recRange } from '../../match.js';
import { goStation, hw, meIndex } from './kit.js';

// ----------------------------------------------------------------------------------
// Parcours « Ralentis » : un ralenti de bout en bout (LSM, angle, mélangeur, volet logo), les clips
// et la playlist, la base de clips IPDirector. Pendant ces parcours, l'opérateur EVS automatique
// du simulateur est mis en pause pour laisser la main au stagiaire.
// ----------------------------------------------------------------------------------
const D = 'Ralentis';
const key = (text, label = text) => ({ sel: '#station .lsm-key', text, label });
const chA = () => EVS.ch[0];
const clipCount = () => EVS.clips.filter(Boolean).length;
const freeIdx = (from = 0) => { for (let i = from; i < 100; i++) if (!EVS.clips[i]) return i; return 99; };
// l'opérateur EVS automatique se met en retrait pendant le parcours, et reprend ensuite
const handsOff = (c) => { if (c.mem.auto0 === undefined) c.mem.auto0 = EX.evsAuto; EX.evsAuto = false; };
const handsBack = (c) => { if (c.mem.auto0 !== undefined) EX.evsAuto = c.mem.auto0; EX.autoPlayA = false; };
// une action récente à rejouer (sinon on en note une, quelques secondes en arrière)
function ensureAction() {
  const [t0] = recRange();
  if (!S.lastAction || S.lastAction.t < t0 + 4 || S.simTime - S.lastAction.t > 120) S.lastAction = { t: Math.max(t0 + 4, S.simTime - 5), type: 'shot', label: 'Tir' };
}
// le meilleur angle pour un ralenti : une caméra à haute fréquence d'images, sinon un serré
function bestAngle() {
  const rec = recordedCams().map((id) => camById(id)).filter(Boolean);
  const b = rec.find((k) => k.hfr > 1) || rec.find((k) => k.role === 'serre') || rec[0];
  return b ? b.id : chA().cam;
}

// ---------------- un ralenti à l'antenne ----------------
/** @type {import('../engine.js').Lesson} */
const REPLAY = {
  id: 'evs-ralenti', domain: D, stations: ['evs', 'melangeur'],
  title: 'Faire un ralenti et l\'envoyer à l\'antenne',
  summary: 'Repérer l\'action, choisir l\'angle (caméra HFR), préparer l\'EVS au mélangeur, entrer et sortir en volet logo.',
  duration: '10 min', level: 'débutant',
  outro: 'C\'est la mécanique d\'un ralenti : l\'opérateur EVS cale l\'action et l\'angle pendant le jeu, annonce « ralenti prêt », le réalisateur le demande, le truquiste l\'envoie en volet logo et l\'opérateur lance la lecture.',
  after: handsBack,
  steps: [
    {
      id: 'intro', title: 'Le serveur ralenti',
      enter: handsOff,
      say: 'Le serveur **EVS** (le serveur de ralentis) enregistre en permanence plusieurs caméras, que la grille lui envoie sur ses entrées REC. L\'opérateur, à sa télécommande **LSM**, peut à tout moment revenir en arrière sur n\'importe quel angle, marquer un point d\'entrée (IN) et relire à vitesse variable avec le levier.\n\nPendant ce parcours, c\'est toi l\'opérateur : l\'automatique du simulateur te laisse la main.',
    },
    goStation('evs', 'On va au poste ralentis, à côté de la régie de production.', 'La télécommande LSM : touches de fonction, levier de vitesse à droite, molette jog (la roue qui avance ou recule image par image), et la ligne d\'enregistrement de chaque caméra.'),
    {
      id: 'rec', title: 'L\'enregistrement tourne',
      say: 'Premier réflexe : l\'enregistrement doit tourner. Sans REC, pas de ralenti possible après l\'arrêt.',
      do: 'Relance l\'enregistrement (REC).',
      go: { station: 'evs' }, show: [key('REC')], skip: () => EVS.recording,
      done: () => EVS.recording,
      ok: 'L\'EVS enregistre toutes ses entrées : chaque action du match pourra être rejouée.',
      hints: ['L\'écran du LSM affiche l\'état de l\'enregistrement : REC ● ou REC ARRÊTÉ.', 'La touche REC de la télécommande.'],
      auto: () => evsSetRecording(true),
    },
    {
      id: 'cue', title: 'Repérer l\'action',
      enter: () => { ensureAction(); const ch = chA(); evsAction(0, 'live'); ch.in = ch.out = null; },
      say: 'Une action vient d\'avoir lieu. La touche **DERN. ACTION** revient quelques secondes avant elle et pose l\'**IN** : c\'est le point de départ du ralenti. À la main, on remonte à la molette et on marque IN.',
      do: 'Appuie sur DERN. ACTION (ou remonte à la molette et marque IN).',
      go: { station: 'evs' }, show: [key('DERN. ACTION')],
      done: () => chA().mode === 'pause' && chA().in != null,
      ok: 'L\'EVS A est en pause sur l\'IN, trois secondes avant l\'action : le ralenti partira avec un peu d\'élan, pas au milieu du geste.',
      hints: ['Le serveur doit revenir quelques secondes en arrière, juste avant l\'action.', 'La touche DERN. ACTION fait tout d\'un coup.', 'À la main : molette jog vers l\'arrière (ou flèche gauche), puis la touche IN.'],
      auto: () => evsAction(0, 'lastaction'),
    },
    {
      id: 'angle', title: 'Choisir l\'angle',
      enter: (c) => { c.mem.best = bestAngle(); const k = camById(c.mem.best); c.mem.hfr = k ? k.hfr || 1 : 1; },
      say: (c) => `Toutes les caméras enregistrées sont disponibles au même instant. Pour un ralenti, on choisit l'angle qui montre le mieux l'action, et si possible une caméra **HFR** (haute fréquence d'images) : la CAM ${c.mem.best}${c.mem.hfr > 1 ? ` tourne à ${c.mem.hfr} fois la cadence, son ralenti sera fluide` : ' est un serré, idéal pour le détail'}.`,
      do: (c) => `Choisis l'angle de la CAM ${c.mem.best}.`,
      go: { station: 'evs' }, show: (c) => [{ sel: `#station .lsm-key[data-id="${c.mem.best}"]`, label: `CAM ${c.mem.best}` }],
      done: (c) => c.seen('evs', (e) => e.action === 'cam') && chA().cam === c.mem.best,
      ok: 'Angle choisi. Tu annoncerais maintenant « ralenti prêt » au réalisateur.',
      hints: ['Les touches de caméras du LSM changent l\'angle relu, au même instant du match.', 'La touche portant le numéro de la caméra que je t\'ai indiquée.'],
      auto: (c) => evsAction(0, 'cam', c.mem.best),
    },
    goStation('melangeur', 'Le réalisateur dit « Ralenti ! ». On passe côté truquiste.', 'L\'EVS A arrive sur une entrée du mélangeur, comme une caméra.'),
    {
      id: 'pst', title: 'Préparer l\'EVS',
      say: 'Le truquiste prépare l\'**EVS A** sur la rangée PST, comme une caméra.',
      do: 'Mets l\'EVS A sur la rangée B · PST.',
      go: { station: 'melangeur' }, show: () => [{ sel: `#station .xpt.pst[aria-label="B · PST entrée ${meIndex('EVSA')}"]`, label: 'EVS A' }],
      done: () => meSource(MIX.pst) === 'EVSA',
      ok: 'L\'EVS A est en preset, comme une caméra : la prochaine transition le mettra à l\'antenne.',
      hints: ['Le serveur ralenti se prépare exactement comme une caméra.', 'Rangée B · PST : la touche marquée EVS A.'],
      auto: () => mixSetPst(meIndex('EVSA')),
    },
    {
      id: 'air', title: 'Entrer en volet logo',
      enter: (c) => { c.mem.st = S.stats.stingers; chA().lever = c.mem.hfr > 1 ? 1 / c.mem.hfr : 0.5; EX.autoPlayA = true; },
      say: (c) => `On entre dans un ralenti en **volet logo** : CLIP, puis AUTO TRANS. Je joue l'opérateur EVS pour toi : dès que l'EVS A passe à l'antenne, je lance la lecture à ${Math.round(chA().lever * 100)} %.`,
      do: 'Choisis CLIP et appuie sur AUTO TRANS.',
      go: { station: 'melangeur' }, show: () => [...(MIX.trans !== 'stinger' ? [hw('CLIP')] : []), { sel: '#station .hw.big', text: 'AUTO TRANS', label: 'AUTO TRANS' }],
      done: (c) => meSource(MIX.pgm) === 'EVSA' && S.stats.stingers > c.mem.st,
      ok: 'Le ralenti est à l\'antenne, avec le tag RALENTI de l\'habillage si le score est ouvert.',
      hints: ['Le volet logo est un type de transition : on le choisit, puis on lance.', 'La touche CLIP du module de transition (ou L au clavier), puis AUTO TRANS.'],
      auto: () => { if (meSource(MIX.pst) !== 'EVSA') mixSetPst(meIndex('EVSA')); MIX.trans = 'stinger'; mixAuto(); },
    },
    {
      id: 'back', title: 'Sortir du ralenti',
      enter: (c) => { c.mem.st2 = S.stats.stingers; },
      say: 'À la fin de l\'action, on revient en direct, toujours en volet logo. La caméra qui était à l\'antenne avant le ralenti est restée en preset : un seul geste suffit.',
      do: 'Reviens sur la caméra en volet logo (AUTO TRANS).',
      go: { station: 'melangeur' }, show: [{ sel: '#station .hw.big', text: 'AUTO TRANS', label: 'AUTO TRANS' }],
      done: (c) => /^CAM/.test(meSource(MIX.pgm) || '') && S.stats.stingers > c.mem.st2,
      ok: 'Retour au direct. L\'opérateur EVS, lui, est déjà reparti en live pour la prochaine action.',
      hints: ['Le volet logo est encore sélectionné, et la caméra attend sur la rangée PST.', 'Un seul geste : AUTO TRANS.'],
      auto: () => { MIX.trans = 'stinger'; mixAuto(); },
    },
    {
      id: 'quiz', title: 'Question',
      say: 'Une question sur les caméras HFR.',
      quiz: { q: 'Une caméra HFR tourne à 3 fois la cadence (150 images/s en 50p). Relue à 33 %, son ralenti…', choices: ['est parfaitement fluide : chaque image enregistrée est montrée une fois', 'saccade, car chaque image est répétée trois fois', 'saute des images : on n\'en montre qu\'une sur trois'], answer: 0, why: 'À 33 %, une seconde de jeu (150 images) dure 3 s à l\'écran, soit 3 × 50 = 150 images affichées : chaque image enregistrée est montrée une fois, aucune n\'est répétée ni sautée. Répéter les images, c\'est ce que doit faire une caméra normale (50 images/s) relue à 33 % ; n\'en montrer qu\'une sur trois, c\'est la caméra HFR relue à 100 %.' },
    },
  ],
};

// ---------------- clips et playlist ----------------
/** @type {import('../engine.js').Lesson} */
const CLIPS = {
  id: 'evs-clips', domain: D, stations: ['evs'],
  title: 'Clips et playlist au LSM',
  summary: 'Marquer IN et OUT, ranger deux clips sur les touches F, les enchaîner en playlist pour un résumé.',
  duration: '8 min', level: 'intermédiaire',
  outro: 'Les clips rangés pendant le match font les résumés de la mi-temps et de la fin : chaque bonne action se garde tout de suite, sur une page et une touche.',
  after: handsBack,
  steps: [
    {
      id: 'intro', title: 'Garder les actions',
      enter: handsOff,
      say: 'Un ralenti part de l\'enregistrement continu. Pour le garder, on en fait un **clip** : un IN, un OUT, un angle, rangés sur une touche F de la page en cours. Plusieurs clips s\'enchaînent ensuite en **playlist**.',
    },
    goStation('evs', 'Retour à la télécommande LSM.', 'Les touches F1 à F10 de la page en cours : vides, elles enregistrent un clip ; pleines, elles le rappellent.'),
    {
      id: 'inout', title: 'IN et OUT',
      enter: () => { ensureAction(); const ch = chA(); evsAction(0, 'live'); ch.in = ch.out = null; },
      say: 'On marque le début (**IN**) et la fin (**OUT**) de l\'action. DERN. ACTION pose les deux d\'un coup ; à la main, on remonte à la molette, IN, puis on avance, OUT.',
      do: 'Pose un IN et un OUT (DERN. ACTION, ou IN puis OUT).',
      go: { station: 'evs' }, show: [key('DERN. ACTION'), key('OUT')],
      done: () => chA().in != null && chA().out != null && chA().out > chA().in,
      ok: 'Le clip est délimité, du IN au OUT : il reste à le ranger pour ne pas le perdre.',
      hints: ['Un clip a un début et une fin, marqués sur l\'enregistrement.', 'La touche DERN. ACTION pose IN et OUT d\'un coup.', 'À la main : molette en arrière, IN ; molette en avant, OUT.'],
      auto: () => evsAction(0, 'lastaction'),
    },
    {
      id: 'save', title: 'Ranger le clip',
      enter: (c) => { c.mem.n = clipCount(); },
      say: 'On range le clip sur une touche F **vide** de la page en cours : il prend un nom du type 111A (page 1, banque 1, touche 1, angle A).',
      do: 'Appuie sur une touche F vide.',
      go: { station: 'evs' }, show: [key('F1', 'une touche F vide')],
      done: (c) => clipCount() > c.mem.n,
      ok: 'Clip rangé : la touche s\'allume et porte son nom. Il est à l\'abri, même quand l\'enregistrement continu tourne.',
      hints: ['Les clips se rangent sur les touches de fonction de la page en cours.', 'Une touche F1 à F10 encore vide (sans nom de clip).'],
      auto: () => evsAction(0, 'save', freeIdx((EVS.page - 1) * 10)),
    },
    {
      id: 'save2', title: 'Un deuxième clip',
      enter: (c) => { c.mem.n2 = clipCount(); const ch = chA(); ch.in = ch.out = null; },
      say: 'Une autre action, un autre clip. Remonte un peu plus loin à la molette, marque IN et OUT, et range-le sur la touche suivante.',
      do: 'Fais un deuxième clip (IN, OUT, touche F vide).',
      go: { station: 'evs' }, show: [key('IN'), key('OUT'), key('F2', 'une touche F vide')],
      done: (c) => clipCount() > c.mem.n2,
      ok: 'Deux clips rangés : de quoi faire un petit résumé.',
      hints: ['Même méthode que pour le premier clip, sur une autre action.', 'Molette en arrière, IN, molette en avant, OUT, puis une touche F vide.'],
      auto: () => { const ch = chA(); const [t0] = recRange(); ch.in = Math.max(t0 + 1, S.simTime - 20); ch.out = ch.in + 5; ch.mode = 'pause'; evsAction(0, 'save', freeIdx((EVS.page - 1) * 10)); },
    },
    {
      id: 'plst', title: 'La playlist',
      enter: (c) => { c.mem.pl0 = EVS.playlist.length; },
      say: 'En mode **PLST**, les touches F ajoutent leur clip à la playlist au lieu de le rappeler. On construit ainsi un résumé dans l\'ordre voulu.',
      do: 'Passe en mode PLST et ajoute tes deux clips.',
      go: { station: 'evs' }, show: [key('PLST'), key('F1', 'tes clips')],
      done: (c) => EVS.playlist.length >= c.mem.pl0 + 2,
      ok: 'Deux clips dans la playlist, dans l\'ordre où tu les as ajoutés.',
      hints: ['Les touches F ont un second rôle quand on change de mode.', 'La touche PLST, puis F1 et F2 (tes deux clips).'],
      auto: () => { const idx = EVS.clips.map((cl, i) => (cl ? i : -1)).filter((i) => i >= 0).sort((a, b) => EVS.clips[b].savedT - EVS.clips[a].savedT).slice(0, 2).reverse(); for (const i of idx) evsAction(0, 'plstadd', i); },
    },
    {
      id: 'play', title: 'Lire la playlist',
      say: 'PLAY, en mode playlist, lit les clips l\'un après l\'autre, à la vitesse du levier.',
      do: 'Lance la lecture de la playlist (PLAY en mode PLST).',
      go: { station: 'evs' }, show: [key('PLAY')],
      done: () => EVS.ch.some((ch) => ch.pl),
      ok: 'La playlist défile. À l\'antenne, on l\'enverrait avec un volet logo, comme un ralenti.',
      hints: ['Toujours en mode PLST, une seule touche lance la lecture.', 'La touche PLAY (verte).'],
      auto: () => evsAction(0, 'plstplay'),
    },
    {
      id: 'quiz', title: 'Question',
      say: 'Le nom des clips suit une convention.',
      quiz: { q: 'Que signifie le nom de clip « 111A » ?', choices: ['Page 1, banque 1, touche 1, angle A', 'Premier clip de la première mi-temps, caméra 1', 'Clip numéro 111 de l\'opérateur A'], answer: 0, why: 'C\'est la convention des serveurs EVS : on retrouve le clip sur la télécommande à sa page et à sa touche, et l\'angle dit quelle entrée d\'enregistrement il utilise. Ce n\'est ni un numéro d\'ordre ni un numéro de caméra : c\'est une adresse sur la télécommande.' },
    },
  ],
};

// ---------------- IPDirector ----------------
// les commandes du clip n'apparaissent qu'une fois un clip choisi dans la base
const PICK = { sel: '#station .hwpanel.ipd tbody tr', label: 'choisis d\'abord un clip' };
const snap = () => EVS.clips.map((cl) => (cl ? { name: cl.name || '', kw: (cl.kw || []).length, rating: cl.rating || 0 } : null));
const changed = (c, f) => EVS.clips.some((cl, i) => cl && c.mem.snap[i] && f(cl, c.mem.snap[i]));
/** @type {import('../engine.js').Lesson} */
const IPD = {
  id: 'ipdirector-clips', domain: D, stations: ['ipdirector'],
  title: 'IPDirector : nommer et retrouver les clips',
  summary: 'La base de clips partagée : renommer un clip, le décrire par des mots-clés, le noter, l\'ajouter à la playlist.',
  duration: '6 min', level: 'débutant',
  outro: 'Un clip bien nommé et décrit se retrouve en quelques secondes, par n\'importe quel opérateur : c\'est ce qui permet de monter un résumé pendant que le match continue.',
  steps: [
    {
      id: 'intro', title: 'La base de clips',
      enter: (c) => {
        if (!clipCount()) { const [t0] = recRange(); const cam = recordedCams()[0] || 1; const t = Math.max(t0 + 1, S.simTime - 15); EVS.clips[0] = { in: t, out: t + 6, cam, name: '', kw: [], rating: 0, savedT: S.simTime }; }
        c.mem.idx = EVS.clips.map((cl, i) => (cl ? i : -1)).filter((i) => i >= 0).pop();
        c.mem.snap = snap(); c.mem.pl0 = EVS.playlist.length;
      },
      say: '**IPDirector** est le logiciel de gestion des clips des serveurs EVS. Tous les clips du car y apparaissent ; un **logueur** les nomme, leur ajoute des mots-clés (but, tir, carton, joueur) et une note, pour que les opérateurs les retrouvent vite.',
    },
    goStation('ipdirector', 'Le poste IPDirector est à côté des ralentis.', 'À gauche, la base de clips ; au centre, le clip sélectionné ; à droite, la playlist.'),
    {
      id: 'name', title: 'Nommer un clip',
      say: 'Sélectionne un clip dans la base, puis donne-lui un nom parlant : l\'action, le joueur, le moment.',
      do: 'Sélectionne un clip et renomme-le.',
      go: { station: 'ipdirector' }, show: [{ sel: '#station .hwpanel.ipd tbody tr', label: 'un clip' }, { sel: '#station input[aria-label="Nom du clip"]', label: 'nom du clip' }],
      done: (c) => changed(c, (cl, s) => (cl.name || '').trim() && cl.name !== s.name),
      ok: 'Le nom est enregistré dans la base : tous les postes le voient, la télécommande LSM comprise.',
      hints: ['On ne renomme qu\'un clip choisi : commence par la base, à gauche.', 'Clique une ligne de la base, écris dans le champ « Nom du clip » au centre, puis valide par Entrée.'],
      auto: (c) => { EVS.clips[c.mem.idx].name = 'Action de jeu · tir cadré'; },
    },
    {
      id: 'kw', title: 'Des mots-clés',
      say: 'Les mots-clés servent aux recherches : « tous les tirs », « tous les cartons ».',
      do: 'Ajoute au moins un mot-clé à un clip (TIR, BUT, ARRÊT…).',
      go: { station: 'ipdirector' }, show: [{ sel: '#station .hwpanel.ipd .ipd-kw', text: 'TIR', label: 'mots-clés' }, PICK],
      done: (c) => changed(c, (cl, s) => (cl.kw || []).length > s.kw),
      ok: 'Mot-clé ajouté : une recherche « TIR » retrouvera ce clip parmi des dizaines.',
      hints: ['Les mots-clés s\'ajoutent au clip choisi, dans le panneau du centre (la rangée du haut sert à noter une action en direct).', 'Clip choisi, puis une touche de mot-clé du panneau central : TIR, BUT, ARRÊT…'],
      auto: (c) => { const cl = EVS.clips[c.mem.idx]; cl.kw = [...(cl.kw || []), 'TIR']; },
    },
    {
      id: 'rate', title: 'Une note',
      say: 'Les étoiles disent l\'importance de l\'action : trois étoiles pour un but, une pour une action anodine.',
      do: 'Donne une note (étoiles) à un clip.',
      go: { station: 'ipdirector' }, show: [{ sel: '#station .hwpanel.ipd button', text: '★', label: 'note' }, PICK],
      done: (c) => changed(c, (cl, s) => (cl.rating || 0) > s.rating),
      ok: 'Note enregistrée : au moment du résumé, on trie par étoiles pour garder l\'essentiel.',
      hints: ['La note se donne au clip choisi, comme le nom et les mots-clés.', 'Panneau du centre, ligne « Note » : une, deux ou trois étoiles.'],
      auto: (c) => { EVS.clips[c.mem.idx].rating = 2; },
    },
    {
      id: 'plst', title: 'Vers la playlist',
      say: 'On prépare le résumé en ajoutant les meilleurs clips à la playlist, qui sera lue par un canal du serveur.',
      do: 'Ajoute un clip à la playlist.',
      go: { station: 'ipdirector' }, show: [{ sel: '#station .hwpanel.ipd button', text: 'Ajouter à la playlist', label: 'ajouter à la playlist' }, PICK],
      done: (c) => EVS.playlist.length > c.mem.pl0,
      ok: 'Clip ajouté à la playlist, à droite : il passera à son tour quand un canal du serveur la lira.',
      hints: ['La playlist est à droite ; le bouton pour y ajouter un clip est avec le clip choisi.', 'Clip choisi, puis le bouton « Ajouter à la playlist ».'],
      auto: (c) => { EVS.playlist.push(c.mem.idx); },
    },
    {
      id: 'quiz', title: 'Question',
      say: 'Pour finir.',
      quiz: { q: 'À quoi sert d\'indexer les clips (nom, mots-clés, joueurs, note) ?', choices: ['À les retrouver en quelques secondes pour les résumés et à les partager entre opérateurs', 'À laisser le serveur choisir seul le meilleur angle du ralenti', 'À libérer de la place sur le serveur'], answer: 0, why: 'Pendant un match, des dizaines de clips s\'accumulent. Sans index, impossible de monter un résumé à la mi-temps. L\'index ne choisit rien et ne libère aucune place : il décrit les clips pour les personnes qui les cherchent.' },
    },
  ],
};

export const RALENTI_LESSONS = [REPLAY, CLIPS, IPD];

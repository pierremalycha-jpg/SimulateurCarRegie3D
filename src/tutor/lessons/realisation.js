// @ts-check
import { S } from '../../state.js';
import { MIX, EVS, mixSetPst, mixCut, mixAuto, mixTbar, dskToggle, meSource, evsAction } from '../../pipeline.js';
import { GFX, gfxTake, gfxOut } from '../../gfx.js';
import { goStation, hw, meIndex, freeCam } from './kit.js';

// ----------------------------------------------------------------------------------
// Parcours « Réalisation et mélangeur » : commuter, incruster, diriger, noter. Chaque geste est
// vérifié sur l'état réel du mélangeur, de l'habillage et du serveur ralenti.
// ----------------------------------------------------------------------------------
const D = 'Réalisation et mélangeur';
const xpt = (row, src, label) => [{ sel: `#station .xpt.${row}[aria-label="${row === 'pst' ? 'B · PST' : 'A · PGM'} entrée ${meIndex(src)}"]`, label: label || src.replace('CAM', 'CAM ') }];
const camName = (src) => (src || '').replace('CAM', 'CAM ');

// ---------------- commuter : preset, coupe, enchaîné, barre T, volet logo ----------------
/** @type {import('../engine.js').Lesson} */
const MIXER = {
  id: 'melangeur-commuter', domain: D, stations: ['melangeur'],
  title: 'Préparer, couper et enchaîner au mélangeur',
  summary: 'Exercice de la leçon « Le mélangeur : PGM, preset et transitions » : préparer une caméra sur la rangée PST, couper, enchaîner en AUTO TRANS puis à la barre T, passer un volet logo, en suivant le tally au multiview.',
  duration: '10 min', level: 'débutant',
  outro: 'Tu as fait les cinq gestes de base du truquiste : préparer, couper, enchaîner, barre T, volet logo. Pour t\'entraîner en vrai, le poste Réalisateur propose l\'exercice « Je suis truquiste » : le réalisateur donne ses ordres et tu es noté sur ta vitesse.',
  steps: [
    {
      id: 'intro', title: 'Le pupitre du truquiste',
      say: 'La leçon l\'a montré : le bus PGM est à l\'antenne, le bus PST prépare la suite, et chaque transition les échange. Ici, c\'est toi le **truquiste** : tu exécutes les ordres du réalisateur sur le **mélangeur**. Deux rangées de touches comptent pour commencer :\n- **A · PGM** (programme) : la source à l\'antenne, **tally** (le voyant de la caméra) **rouge** ;\n- **B · PST** (preset ; on dit aussi PVW, preview) : la source suivante, préparée à l\'avance, tally **vert**.\n\nLe geste de base : on prépare sur PST, on regarde le cadre au moniteur preset, puis une **transition** fait passer la source à l\'antenne.',
    },
    goStation('melangeur', 'On va au pupitre, dans la régie de production.', 'Au-dessus du pupitre, le **multiview** (l\'écran mosaïque de toutes les sources) : chaque vignette porte le tally de sa source.'),
    {
      id: 'pst', title: 'Préparer une caméra',
      enter: (c) => { c.mem.src = 'CAM' + freeCam(meSource(MIX.pgm)); },
      say: (c) => `Le réalisateur annonce « Prépare la ${camName(c.mem.src).slice(4)} ». On la sélectionne sur la rangée **B · PST** : rien ne change à l'antenne, seul le preset bouge.`,
      do: (c) => `Appuie sur ${camName(c.mem.src)} dans la rangée B · PST.`,
      go: { station: 'melangeur' }, show: (c) => xpt('pst', c.mem.src),
      done: (c) => meSource(MIX.pst) === c.mem.src,
      ok: 'Elle est en preset : son tally est vert, le cadreur sait qu\'il est le prochain.',
      hints: ['Le pupitre a trois rangées de boutons ; une seule prépare la source suivante sans toucher à l\'antenne.', 'La rangée du bas, marquée B · PST.', 'Le numéro du bouton est celui de l\'entrée du mélangeur : en standard, entrée 3 = CAM 3.'],
      auto: (c) => mixSetPst(meIndex(c.mem.src)),
    },
    {
      id: 'cut', title: 'Couper',
      say: '« Top ! » : on coupe. La touche **CUT** échange PGM et PST d\'une image à la suivante, sans image intermédiaire. C\'est la transition la plus utilisée en direct sportif.',
      do: 'Appuie sur CUT.',
      go: { station: 'melangeur' }, show: [{ sel: '#station .hw.big', text: 'CUT', label: 'CUT' }],
      done: (c) => meSource(MIX.pgm) === c.mem.src,
      ok: 'La caméra est à l\'antenne (tally rouge) et l\'ancienne source est passée en preset (tally vert) : les deux bus se sont échangés.',
      hints: ['Les transitions se lancent dans le module de transition, sous les rangées de boutons.', 'La grande touche CUT, à gauche du levier. Au clavier : Entrée (ou Espace au poste).'],
      auto: () => mixCut(),
    },
    {
      id: 'mix', title: 'Enchaîner',
      enter: (c) => { c.mem.mixes = S.stats.mixes; c.mem.src2 = 'CAM' + freeCam(meSource(MIX.pgm), [2, 1, 4, 5]); },
      say: (c) => `« Enchaîne sur la ${camName(c.mem.src2).slice(4)} » : un fondu entre les deux images. On choisit le type **MIX**, puis **AUTO TRANS** déroule la transition à la durée affichée, comptée en images (25 images durent 0,5 s en 1080p50, 1 s en 1080i50).`,
      do: (c) => `Prépare ${camName(c.mem.src2)} sur PST, choisis MIX et appuie sur AUTO TRANS.`,
      go: { station: 'melangeur' },
      show: (c) => [...(meSource(MIX.pst) !== c.mem.src2 ? xpt('pst', c.mem.src2) : []), ...(MIX.trans !== 'mix' ? [hw('MIX')] : []), { sel: '#station .hw.big', text: 'AUTO TRANS', label: 'AUTO TRANS' }],
      done: (c) => S.stats.mixes > c.mem.mixes && MIX.lastTrans && MIX.lastTrans.type === 'mix',
      ok: 'Pendant le fondu, les deux caméras étaient à l\'antenne : les deux tallys étaient rouges.',
      hints: ['Trois gestes, dans l\'ordre : préparer la source, choisir le type de transition, lancer.', 'La caméra sur la rangée B · PST, puis la touche MIX du module de transition (ou X au clavier).', 'Enfin la grande touche AUTO TRANS.'],
      auto: (c) => { mixSetPst(meIndex(c.mem.src2)); MIX.trans = 'mix'; mixAuto(); },
    },
    {
      id: 'tbar', title: 'La barre T',
      enter: (c) => { c.mem.dir = MIX.tbarDir; },
      say: 'La **barre T** (le levier de transition, à droite de CUT et AUTO TRANS) fait la même transition à la main : sa durée est celle du geste, et l\'on peut s\'arrêter à mi-course pour une surimpression. Arrivée en bout de course, la transition est terminée, les bus s\'échangent et la barre repart dans l\'autre sens.',
      do: 'Pousse la barre T jusqu\'au bout.',
      go: { station: 'melangeur' }, show: [{ sel: '#station #tbar', label: 'barre T' }],
      done: (c) => MIX.tbarDir !== c.mem.dir,
      ok: 'Transition terminée à la main. Pour le direct, AUTO TRANS est plus régulier ; la barre sert aux effets doux.',
      hints: ['Le levier est à droite des grandes touches CUT et AUTO TRANS.', 'Fais-le glisser jusqu\'à l\'autre butée : la transition n\'est finie qu\'en bout de course.'],
      auto: () => mixTbar(MIX.tbarDir > 0 ? 1 : 0),
    },
    {
      id: 'clip', title: 'Le volet logo',
      enter: (c) => { c.mem.st = S.stats.stingers; },
      say: 'Pour entrer dans un ralenti et en sortir, on passe par un **volet logo** (CLIP, ou « stinger ») : une animation du logo couvre l\'écran pendant environ une seconde, et la source change derrière. Le téléspectateur sait ainsi qu\'il regarde une image en différé.',
      do: 'Choisis CLIP et lance AUTO TRANS.',
      go: { station: 'melangeur' }, show: (c) => [...(MIX.trans !== 'stinger' ? [hw('CLIP')] : []), { sel: '#station .hw.big', text: 'AUTO TRANS', label: 'AUTO TRANS' }],
      done: (c) => S.stats.stingers > c.mem.st,
      ok: 'Le logo est passé : c\'est la signature du ralenti en football, le téléspectateur sait qu\'il quitte le direct.',
      hints: ['Même logique que le fondu : choisir le type de transition, puis lancer.', 'La touche CLIP du module de transition (ou L au clavier), puis AUTO TRANS.'],
      auto: () => { MIX.trans = 'stinger'; mixAuto(); },
    },
    {
      id: 'quiz', title: 'Question',
      say: 'Une question de tally, essentielle pour les cadreurs.',
      quiz: { q: 'Pendant un enchaîné (MIX) de la CAM 1 vers la CAM 2, quel tally est rouge ?', choices: ['Seulement la CAM 1', 'Les deux caméras', 'Seulement la CAM 2'], answer: 1, why: 'Pendant le fondu, les deux images sont à l\'antenne : les deux cadreurs ont le tally rouge et ne doivent pas bouger leur cadre. L\'erreur fréquente est de croire que le tally ne suit qu\'une source : il suit tout ce qui est visible à l\'antenne.' },
    },
  ],
};

// ---------------- score, bandeau, DSK ----------------
/** @type {import('../engine.js').Lesson} */
const KEYS = {
  id: 'melangeur-incrustations', domain: D, stations: ['melangeur', 'habillage'],
  title: 'Incruster le score et un bandeau sur les DSK',
  summary: 'Exercice de la leçon « Incrustations : fill, key et DSK » : ouvrir le score sur le DSK 1, préparer un bandeau joueur à l\'habillage, le passer sur le DSK 2, puis le retirer.',
  duration: '8 min', level: 'débutant',
  outro: 'Retiens l\'ordre : l\'habillage prépare et anime le graphique, le truquiste ouvre le DSK qui le pose sur l\'antenne. Le DSK est en aval de tout : une coupe ou un ralenti ne le font pas disparaître.',
  steps: [
    {
      id: 'intro', title: 'Les incrustations',
      say: 'La leçon l\'a montré : une incrustation pose un **fill** (l\'image du graphique) sur le fond là où le **key** (la découpe) l\'autorise. Les graphiques (score, bandeaux, statistiques) sont fabriqués par l\'**habillage**, qui sort le fill et le key, et posés sur l\'image par le mélangeur, en clé linéaire.\n\nLes **DSK** (downstream keyers, les incrustateurs aval) sont tout au bout du mélangeur, après les transitions : ce qu\'ils incrustent reste à l\'écran quelle que soit la source. Ici, le DSK 1 porte le score, le DSK 2 les bandeaux.',
    },
    goStation('melangeur', 'On commence au mélangeur.', 'Repère les touches DSK 1 et DSK 2, à droite du module de transition.'),
    {
      id: 'dsk1', title: 'Le score (DSK 1)',
      enter: () => { if (MIX.dsk1.on) dskToggle(1, false); },
      say: 'Le **score** reste à l\'écran pendant tout le match. On l\'ouvre en fondu sur le DSK 1 : la touche AUTO fait monter son key en une douzaine d\'images.',
      do: 'Appuie sur DSK 1 AUTO.',
      go: { station: 'melangeur' }, show: [hw('DSK 1 AUTO')],
      done: () => MIX.dsk1.on,
      ok: 'Le score est à l\'antenne. Il restera là même pendant les ralentis, puisque le DSK est après les transitions.',
      hints: ['Les touches DSK sont à côté du module de transition : pour chaque DSK, une touche CUT (sec) et une touche AUTO (en fondu).', 'La touche DSK 1 AUTO, sous-titrée « score ».'],
      auto: () => { if (!MIX.dsk1.on) dskToggle(1, true); },
    },
    goStation('habillage', 'Le bandeau se prépare au poste Habillage, au deuxième rang de la régie de production.', 'À gauche, l\'aperçu du graphique (fill) et de sa découpe (key) ; à droite, le programme.'),
    {
      id: 'cue', title: 'Préparer le bandeau',
      enter: () => { if (GFX.template) gfxOut(); GFX.cued = 'titre'; },
      say: 'On prépare le graphique **avant** de le lancer : le modèle (bandeau joueur), puis le joueur à présenter.',
      do: 'Choisis le modèle « Bandeau joueur ».',
      go: { station: 'habillage' }, show: [hw('Bandeau joueur')],
      done: () => GFX.cued === 'lower',
      ok: 'Le bandeau est prêt (en « cue », c\'est-à-dire chargé et pas encore lancé). Le menu sous les modèles choisit le joueur.',
      hints: ['On choisit d\'abord quoi passer : les modèles de graphiques sont listés au poste.', 'La touche « Bandeau joueur », parmi les modèles.'],
      auto: () => { GFX.cued = 'lower'; },
    },
    {
      id: 'take', title: 'Lancer le bandeau',
      say: 'TAKE IN anime le graphique dans le moteur graphique : son fill et son key sortent vers le mélangeur. Ce n\'est pas encore l\'antenne : il faut que le DSK 2 soit ouvert.',
      do: 'Appuie sur TAKE IN.',
      go: { station: 'habillage' }, show: [{ sel: '#station .hw.big', text: 'TAKE IN', label: 'TAKE IN' }],
      done: () => GFX.template === 'lower' && (GFX.anim > 0.5 || GFX.animDir > 0),
      ok: 'Le bandeau s\'anime. Regarde l\'avertissement : tant que le DSK 2 est fermé, il n\'est pas à l\'antenne.',
      hints: ['Le graphique est chargé : il reste à l\'animer dans le générateur.', 'La grande touche TAKE IN.'],
      auto: () => gfxTake('lower'),
    },
    {
      id: 'dsk2', title: 'Ouvrir le DSK 2',
      say: 'Le bandeau passe par le **DSK 2**. Dans une vraie régie, le truquiste l\'ouvre à la demande ; ici, les deux postes ont la touche.',
      do: 'Ouvre le DSK 2.',
      go: { station: 'habillage' }, show: [hw('DSK 2')],
      done: () => MIX.dsk2.on && GFX.template === 'lower',
      ok: 'Le bandeau est à l\'antenne, par-dessus l\'image ; le score, sur le DSK 1, reste affiché à côté.',
      hints: ['Le moteur graphique sort bien le fill et le key du bandeau : c\'est l\'incrustateur qui le pose sur l\'antenne qui est fermé.', 'La touche DSK 2, sous-titrée « graph. », au poste Habillage.'],
      auto: () => { if (!MIX.dsk2.on) dskToggle(2, true); if (GFX.template !== 'lower') gfxTake('lower'); },
    },
    {
      id: 'out', title: 'Retirer le bandeau',
      say: 'Un bandeau reste quelques secondes, le temps de le lire. On le retire en animation de sortie : son key redescend à zéro et le fond réapparaît.',
      do: 'Appuie sur TAKE OUT.',
      go: { station: 'habillage' }, show: [{ sel: '#station .hw.big', text: 'TAKE OUT', label: 'TAKE OUT' }],
      done: () => !GFX.template || GFX.animDir < 0,
      ok: 'Bandeau sorti. Le score, lui, est toujours là : il est sur un autre DSK.',
      hints: ['La sortie se fait en animation, comme l\'entrée.', 'La grande touche TAKE OUT.'],
      auto: () => gfxOut(),
    },
    {
      id: 'quiz', title: 'Question',
      say: 'Pour finir, une question de logique.',
      quiz: { q: 'Pourquoi le score est-il sur un DSK et pas sur une clé du M/E (l\'étage de mélange, en amont des DSK) ?', choices: ['Parce que le DSK est en aval des transitions : le score ne bouge pas quand on coupe ou qu\'on enchaîne', 'Parce que le DSK a une meilleure qualité d\'image', 'Parce qu\'une clé de M/E ne peut pas afficher de texte'], answer: 0, why: 'Une clé du M/E est prise dans les transitions de cet étage : selon le réglage Next Transition (BKGD, KEY 1), elle peut partir ou changer avec l\'image. Le DSK, tout au bout de la chaîne, reste à l\'écran quoi qu\'on fasse en amont, et le clean feed, pris avant lui, donne le programme sans score. Ce n\'est ni une question de qualité ni de texte : les deux incrustent aussi bien, seule leur place dans la chaîne change.' },
    },
  ],
};

// ---------------- réalisateur : les ordres ----------------
/** @type {import('../engine.js').Lesson} */
const DIRECTOR = {
  id: 'realisateur-ordres', domain: D, stations: ['realisateur'],
  title: 'Donner les ordres au truquiste',
  summary: 'Exercice de la leçon « Le langage du direct : ordres, conducteur, timecode » : annoncer une caméra, donner le top, demander un enchaîné puis le score, depuis le pupitre du réalisateur.',
  duration: '8 min', level: 'débutant',
  outro: 'Le réalisateur pense le plan suivant, le truquiste exécute. Pour t\'entraîner de l\'autre côté, lance l\'exercice « Je suis truquiste » sur ce même poste.',
  steps: [
    {
      id: 'intro', title: 'Le réalisateur',
      say: 'Dans la leçon, tu as vu la règle du direct : on annonce, puis on déclenche. Le **réalisateur** choisit les plans, en regardant le **multiview** (l\'écran mosaïque de toutes les sources). Il ne touche pas au mélangeur : il parle au **truquiste** dans l\'intercom, avec des mots courts et toujours les mêmes, le numéro d\'abord :\n- « **Prépare la 4** » : le truquiste met la CAM 4 en preset (prête à passer) ;\n- « **Top !** » : il coupe ;\n- « **Enchaîne** » : il fait un fondu ;\n- « **Ralenti !** » : l\'opérateur EVS (le serveur de ralentis) et le truquiste lancent le ralenti.\n\nIci, le truquiste est simulé : chaque bouton est un ordre.',
    },
    goStation('realisateur', 'On s\'installe au pupitre de réalisation, face au multiview.', 'La première ligne de boutons, ce sont les sources : un clic = « Prépare… ».'),
    {
      id: 'prep', title: '« Prépare… »',
      enter: (c) => { c.mem.src = 'CAM' + freeCam(meSource(MIX.pgm), [4, 3, 5, 2]); },
      say: (c) => `On annonce toujours le plan suivant **avant** de le demander : « Prépare la ${c.mem.src.slice(3)} ». Le cadreur voit son tally vert et soigne son cadre.`,
      do: (c) => `Donne l'ordre « Prépare la ${c.mem.src.slice(3)} ».`,
      go: { station: 'realisateur' }, show: (c) => [{ sel: '#station .hwpanel .hw', text: camName(c.mem.src), label: `Prépare la ${c.mem.src.slice(3)}` }],
      done: (c) => meSource(MIX.pst) === c.mem.src,
      ok: 'Le truquiste a mis la caméra en preset. Le multiview la montre avec un cadre vert : tu vois ce qui va passer avant de le demander.',
      hints: ['Chaque ordre est un bouton : cherche la rangée qui sert à préparer.', 'Rangée « Prépare » : la touche de la caméra demandée.'],
      auto: (c) => mixSetPst(meIndex(c.mem.src)),
    },
    {
      id: 'top', title: '« Top ! »',
      say: '« Top ! » déclenche la coupe : annoncée, elle part quelques images après le mot. Le bon moment : sur une action, un regard, un changement de jeu, jamais au milieu d\'un mouvement de caméra.',
      do: 'Donne le top.',
      go: { station: 'realisateur' }, show: [{ sel: '#station .hw.big', text: 'TOP', label: 'TOP !' }],
      done: (c) => meSource(MIX.pgm) === c.mem.src,
      ok: 'Coupé. Le multiview encadre la caméra en rouge : elle est à l\'antenne.',
      hints: ['L\'ordre de couper est le plus court de tous.', 'La grande touche TOP !'],
      auto: () => mixCut(),
    },
    {
      id: 'mix', title: '« Enchaîne »',
      enter: (c) => { c.mem.mixes = S.stats.mixes; c.mem.src2 = 'CAM' + freeCam(meSource(MIX.pgm), [1, 2, 3]); },
      say: (c) => `Un fondu se demande quand le rythme ralentit : avant une pause, sur un plan d'ambiance. Prépare la ${c.mem.src2.slice(3)}, puis « Enchaîne ».`,
      do: (c) => `Prépare la ${c.mem.src2.slice(3)}, puis donne l'ordre ENCHAÎNE.`,
      go: { station: 'realisateur' },
      show: (c) => [...(meSource(MIX.pst) !== c.mem.src2 ? [{ sel: '#station .hwpanel .hw', text: camName(c.mem.src2), label: 'Prépare' }] : []), { sel: '#station .hw.big', text: 'ENCHAÎNE', label: 'ENCHAÎNE' }],
      done: (c) => S.stats.mixes > c.mem.mixes,
      ok: 'Fondu réalisé par le truquiste : un ordre, un geste, sans que tu touches au mélangeur.',
      hints: ['Deux ordres, dans l\'ordre : d\'abord préparer, ensuite le fondu.', 'Rangée « Prépare » : la caméra demandée, puis la grande touche ENCHAÎNE.'],
      auto: (c) => { mixSetPst(meIndex(c.mem.src2)); MIX.trans = 'mix'; mixAuto(); },
    },
    {
      id: 'score', title: 'Le score',
      enter: () => { if (MIX.dsk1.on) dskToggle(1, false); },
      say: 'Le réalisateur décide aussi de l\'habillage : quand afficher le score, un bandeau, une statistique.',
      do: 'Demande le score (bouton SCORE).',
      go: { station: 'realisateur' }, show: [hw('SCORE')],
      done: () => MIX.dsk1.on,
      ok: 'Le score est à l\'antenne sur le DSK 1 : il y restera quelle que soit la caméra que tu demandes.',
      hints: ['L\'habillage se commande aussi depuis ce pupitre, par ses propres boutons d\'ordres.', 'La touche SCORE, sous-titrée « DSK 1 ».'],
      auto: () => { if (!MIX.dsk1.on) dskToggle(1, true); },
    },
    {
      id: 'quiz', title: 'Question',
      say: 'Une question de méthode.',
      quiz: { q: 'Pourquoi annoncer « Prépare la 4 » avant « Top » ?', choices: ['Pour que le truquiste la mette en preset et que le cadreur, tally vert, soigne son cadre', 'Parce que le mélangeur ne peut pas couper sans preset', 'Pour laisser le temps à l\'EVS d\'enregistrer'], answer: 0, why: 'Le « prépare » fait gagner la seconde qui compte : la coupe part quelques images après le top, et le cadreur sait qu\'il sera à l\'antenne. Techniquement, le mélangeur pourrait couper sans cette annonce (il y a toujours une source en preset, souvent l\'ancien plan) : c\'est pour les personnes qu\'on l\'annonce, pas pour la machine. Le serveur ralenti, lui, enregistre en continu.' },
    },
  ],
};

// ---------------- scripte : le temps et les notes ----------------
/** @type {import('../engine.js').Lesson} */
const SCRIPT = {
  id: 'scripte-notes', domain: D, stations: ['scripte', 'evs'],
  title: 'Noter une action au timecode et l\'envoyer au ralenti',
  summary: 'Exercice de la leçon « Le langage du direct : ordres, conducteur, timecode » : lire le timecode maître et le temps de jeu au poste Scripte, puis envoyer une action notée à l\'opérateur ralenti.',
  duration: '4 min', level: 'débutant',
  outro: 'La scripte est la mémoire de la réalisation : avec le timecode, chaque action se retrouve en quelques secondes, au ralenti comme au montage du résumé.',
  steps: [
    {
      id: 'intro', title: 'La scripte',
      say: 'La leçon l\'a dit : le timecode est l\'heure inscrite dans chaque image, la même pour tout le car. La **scripte** tient le temps : l\'heure d\'antenne, le **conducteur** (le déroulé minuté : ce qui doit passer et quand), le temps de jeu. Elle note aussi chaque action importante avec son **timecode**, pour que l\'opérateur ralenti et le monteur la retrouvent.',
    },
    goStation('scripte', 'Son poste est en régie de production, à côté du réalisateur.', 'En haut, le timecode maître ; à côté, le temps de jeu et le score.'),
    {
      id: 'tc', title: 'Le timecode',
      say: 'Le **timecode** (heures:minutes:secondes:images, numérotées de 00 à 24 à 25 images par seconde) est distribué à tout le car par le générateur de synchro (LTC). Caméras, serveur ralenti, enregistreurs et notes partagent la même horloge.',
      quiz: { q: 'Pourquoi tout le car utilise-t-il le même timecode ?', choices: ['Pour retrouver une action au même instant sur le serveur ralenti, les notes et les enregistrements', 'Pour que les caméras soient synchronisées entre elles', 'Pour que le son reste calé sur l\'image'], answer: 0, why: 'Le timecode date les images. La synchronisation des caméras entre elles, c\'est le genlock (la référence) ; le calage du son, c\'est le retard de ligne.' },
    },
    {
      id: 'note', title: 'Envoyer une action au ralenti',
      enter: (c) => { if (!S.events.length) S.events.push({ t: Math.max(0, S.simTime - 6), label: 'Tir', clock: 0, type: 'shot' }); c.mem.ev = S.events[S.events.length - 1]; },
      say: 'Chaque action du match s\'inscrit dans les notes, avec son timecode. Le bouton **→ EVS A** envoie ce timecode à l\'opérateur ralenti : le serveur se cale trois secondes avant et pose son point d\'entrée (IN).',
      do: 'Envoie la dernière action vers l\'EVS A.',
      go: { station: 'scripte' }, show: [{ sel: '#station .item .btn.small', text: 'EVS A', label: '→ EVS A' }],
      done: (c) => c.seen('evs', (e) => e.action === 'back') && EVS.ch[0].in != null,
      ok: 'L\'EVS A est en pause trois secondes avant l\'action, point d\'entrée (IN) posé : l\'opérateur n\'a plus qu\'à choisir l\'angle et lancer.',
      hints: ['Les actions du match sont dans le panneau « Notes de scripte », la plus récente en haut.', 'Sur la première ligne, le bouton « → EVS A ».'],
      auto: (c) => { const e = c.mem.ev; evsAction(0, 'back', 0); const ch = EVS.ch[0]; ch.t = Math.max(0, e.t - 3); ch.in = ch.t; ch.out = e.t + 2.5; },
    },
  ],
};

// ---------------- production ----------------
/** @type {import('../engine.js').Lesson} */
const PROD = {
  id: 'production-suivi', domain: D, stations: ['producteur'],
  title: 'Suivre le programme et le retour antenne',
  summary: 'Exercice de la leçon « Le langage du direct : ordres, conducteur, timecode » : comparer le programme et le retour antenne au poste Production, situer une panne, lire le compte des transitions.',
  duration: '4 min', level: 'découverte',
  outro: 'La production est l\'interlocuteur de la chaîne : horaires, conducteur, publicités, contenus. Elle ne touche à aucun bouton technique.',
  steps: [
    {
      id: 'intro', title: 'La production',
      say: 'Dans la leçon, la production est celle qui parle à la chaîne. Le **chargé de production** représente le diffuseur dans le car : il fait respecter le conducteur et les horaires (prise d\'antenne, mi-temps, publicités), prépare les contenus (statistiques, résumés) et règle les imprévus avec la chaîne.',
    },
    goStation('producteur', 'Son poste est en régie de production.', 'À l\'écran, le programme et le retour antenne ; dans le tableau, le match et le compte des transitions.'),
    {
      id: 'retour', title: 'Programme et retour antenne',
      say: 'Deux écrans : le **programme** sortant du car et le **retour antenne**, ce que la chaîne diffuse réellement. Le retour arrive avec quelques secondes de retard (codage, transmission, régie finale de la chaîne).',
      quiz: { q: 'Le retour antenne montre la mire alors que le programme est normal. Où est le problème ?', choices: ['Entre le départ du car et la chaîne : départ TX (la sortie du car vers la transmission), transmission ou régie finale', 'Au mélangeur', 'À la caméra à l\'antenne'], answer: 0, why: 'Le programme est bon en sortie du mélangeur : la panne est en aval. Le mélangeur et la caméra sont en amont d\'un point qu\'on sait bon : inutile d\'y chercher. On vérifie la grille (départ TX), puis la transmission, et on appelle la chaîne.' },
    },
    {
      id: 'quiz', title: 'Question',
      say: () => `Depuis le début de la séance : ${S.stats.cuts} coupe(s), ${S.stats.mixes} enchaîné(s), ${S.stats.stingers} volet(s) logo. Ces chiffres servent à analyser une réalisation.`,
      quiz: { q: 'Qui est responsable du respect du conducteur et des horaires vis-à-vis de la chaîne ?', choices: ['La production', 'Le truquiste', 'L\'ingénieur vision'], answer: 0, why: 'La production tient le conducteur et parle à la chaîne. Le truquiste exécute les ordres du réalisateur et l\'ingénieur vision règle les caméras : ils suivent le conducteur, mais n\'en répondent pas devant la chaîne.' },
    },
  ],
};

export const REALISATION_LESSONS = [MIXER, KEYS, DIRECTOR, SCRIPT, PROD];

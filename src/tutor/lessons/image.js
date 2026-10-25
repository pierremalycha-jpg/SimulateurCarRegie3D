// @ts-check
import { S, camById } from '../../state.js';
import { MIX, meSource } from '../../pipeline.js';
import { goStation, ui, camIds } from './kit.js';

// ----------------------------------------------------------------------------------
// Parcours « Image et caméras » : exposer et équilibrer au RCP, dépanner une voie à la baie CCU,
// cadrer une caméra, monter une caméra de stade (atelier). Les mesures viennent de l'image
// réellement rendue (waveform, erreur colorimétrique de la caméra). Chacun est l'exercice pratique
// d'une leçon du Cours : vision-exposition (signal-niveaux), vision-balance (signal-couleur),
// ccu-depannage et cadreur-cadrer (camera-systeme), atelier-montage (camera-montage).
// ----------------------------------------------------------------------------------
const D = 'Image et caméras';
const rcpBtn = (text) => ({ sel: '#station .rcp-btn', text, label: text });
const cam = (c) => camById(c.mem.cam);
// une caméra filaire, de préférence pas à l'antenne : l'exercice ne casse pas le programme
function pickCam(pref) {
  const wired = camIds(true); const pgm = meSource(MIX.pgm);
  return [...pref.filter((i) => wired.includes(i)), ...wired].find((i) => 'CAM' + i !== pgm) || wired[0] || 1;
}
const atVision = (c) => c.view().station === 'vision' && c.view().cam === c.mem.cam;
const pct = (v) => Math.round(v * 100) + ' %';

// ---------------- exposer ----------------
/** @type {import('../engine.js').Lesson} */
const EXPO = {
  id: 'vision-exposition', domain: D, stations: ['vision'],
  title: 'Exposer une caméra au RCP',
  summary: 'Exercice de la leçon « Niveaux : 0–100 %, noir à 64, blanc à 940 » : déverrouiller le RCP (PANEL ACTIVE), lire le waveform et ramener à l\'iris une image sous-exposée entre le noir et le blanc.',
  duration: '8 min', level: 'débutant',
  outro: 'L\'ingénieur vision expose toutes les caméras au même niveau : en sport, on travaille en iris manuel, l\'œil sur le waveform (blancs sous 100 %, noirs vers 0 %), pour que les coupes ne fassent pas « pomper » la lumière.',
  cleanupLabel: 'Remettre l\'iris de la caméra',
  cleanup: (c) => { const k = cam(c); if (k && c.mem.iris0) { k.paint.iris = c.mem.iris0; k.panelActive = true; } },
  steps: [
    {
      id: 'intro', title: 'L\'ingénieur vision',
      enter: (c) => { c.mem.cam = pickCam([2, 4, 5, 3, 1]); c.mem.iris0 = cam(c) ? cam(c).paint.iris : null; },
      say: 'Leçon « Niveaux » : sur le waveform, le noir est à 0 % (code 64 en 10 bits) et le blanc à 100 % (code 940) ; exposer, c\'est tenir l\'image entre ces deux lignes.\n\nL\'**ingénieur vision** règle à distance chaque caméra depuis son **RCP** (Remote Control Panel, le pupitre de réglage de la caméra) : l\'exposition (iris), le noir (master black), la couleur.\n\nSon outil de mesure est le **waveform** : il montre le niveau de chaque point de l\'image, de 0 % (noir) à 100 % (blanc nominal) ; au-dessus, les blancs sont écrêtés à la diffusion.',
    },
    goStation('vision', 'On va au poste vision, en régie vision et ralentis.', 'À gauche, l\'image de la caméra et son waveform ; à droite, le RCP.', {
      go: (c) => ({ station: 'vision', cam: c.mem.cam }), done: atVision, skip: atVision,
      do: (c) => `Ouvre le poste vision sur la CAM ${c.mem.cam}.`,
      hints: ['Le poste vision est dans la zone « Vision et ralentis » du téléphone (Tab, application Aller à) : Ingé vision 1 ou 2.', 'Au poste, une rangée de touches numérotées choisit la caméra que le RCP commande : prends celle que je t\'ai donnée.'],
      auto: (c) => c.io.go({ station: 'vision', cam: c.mem.cam }),
    }),
    {
      id: 'active', title: 'PANEL ACTIVE',
      enter: (c) => { const k = cam(c); if (k) k.panelActive = false; },
      say: 'Un RCP verrouillé refuse tout réglage : c\'est une sécurité, pour qu\'un coude ne dérègle pas une caméra à l\'antenne. On le déverrouille avec **PANEL ACTIVE**.',
      do: 'Active le panneau (PANEL ACTIVE).',
      go: (c) => ({ station: 'vision', cam: c.mem.cam }), show: [rcpBtn('PANEL ACTIVE')],
      done: (c) => !!cam(c) && cam(c).panelActive !== false,
      ok: 'Le RCP répond. Quand tu as fini une caméra, tu peux le reverrouiller : c\'est ta protection contre un réglage involontaire.',
      hints: ['Le RCP refuse les réglages : cherche la touche qui lui donne la main sur la caméra.', 'Section FONCTIONS du RCP : la touche PANEL ACTIVE.'],
      auto: (c) => { cam(c).panelActive = true; },
    },
    {
      id: 'expo', title: 'Ouvrir l\'iris',
      enter: (c) => { const k = cam(c); if (k) { k.paint.autoIris = false; k.paint.irisClose = false; k.paint.iris = Math.min(22, Math.max(k.paint.iris * 2.8, 8)); } },
      say: (c) => `Je viens de fermer l'iris de la CAM ${c.mem.cam} : l'image est sombre, le waveform est tassé vers le bas. On vise une moyenne de l'image entre **35 et 55 %** (la pelouse de jour se pose vers 40 à 55 %), les blancs (maillots, lignes) sous **100 %**, les noirs entre 0 et 2 %.`,
      do: 'Ouvre l\'iris au joystick (vers le haut) jusqu\'à une moyenne de 35 à 55 %.',
      go: (c) => ({ station: 'vision', cam: c.mem.cam }), show: [{ sel: '#station .rjoy .rjoy-handle', label: 'joystick : iris' }],
      done: (c) => { const k = cam(c); return !!k && k.meter.mean > 0.35 && k.meter.mean < 0.55; },
      ok: (c) => `Moyenne à ${pct(cam(c).meter.mean)} : l'image est exposée. Chaque cran d'iris compte : on règle doucement, en regardant le waveform plutôt que l'image, car sur un moniteur un blanc à 95 % et un blanc à 108 % se ressemblent.`,
      hints: ['Regarde le waveform : la masse de l\'image doit remonter vers le milieu de l\'échelle. Quel réglage laisse entrer plus de lumière ?', 'L\'iris se règle au joystick (section IRIS / M.BLACK) : vers le haut, on ouvre (f/ plus petit), vers le bas on ferme.', 'Molette ou flèches du clavier sur le joystick pour aller cran par cran, jusqu\'à une moyenne entre 35 et 55 %.'],
      auto: (c) => { const k = cam(c); k.paint.autoIris = false; k.lineup = { n: 0, target: 0.42 }; },
    },
    {
      id: 'stop', title: 'Le diaphragme',
      say: 'Les valeurs d\'iris (f/2,8, f/4, f/5,6, f/8…) suivent une échelle où chaque cran entier divise ou double la lumière.',
      quiz: { q: 'On ouvre l\'iris d\'un diaphragme entier, de f/5,6 à f/4. La lumière qui entre…', choices: ['double', 'augmente de 10 %', 'ne change pas : seule la profondeur de champ change'], answer: 0, why: 'Un diaphragme = un facteur 2 de lumière. Ouvrir réduit aussi la profondeur de champ : le cadreur du serré devra suivre son point de plus près. Penser que seule la profondeur de champ change est l\'erreur classique : les deux effets vont ensemble.' },
    },
    {
      id: 'auto', title: 'Iris automatique ?',
      say: 'Le RCP a un **AUTO IRIS** : la caméra vise seule une exposition moyenne. En sport, on l\'évite : un maillot blanc qui entre dans le cadre ou une ombre sur la pelouse ferait varier l\'image en direct. L\'auto sert en dépannage, ou sur une caméra qu\'on ne surveille pas.',
      quiz: { q: 'Pourquoi expose-t-on en manuel en sport ?', choices: ['Pour que l\'image ne varie pas quand le contenu du cadre change (maillot blanc, ombre)', 'Parce que l\'auto iris est plus lent', 'Parce que l\'auto iris abîme l\'objectif'], answer: 0, why: 'L\'auto iris réagit au contenu du cadre : un plan qui « pompe » (dont la lumière varie toute seule) se voit tout de suite à l\'antenne. Ce n\'est donc ni une question de vitesse ni d\'usure de l\'objectif : l\'ingénieur vision garde la main pour garder la même exposition.' },
    },
  ],
};

// ---------------- balance des blancs et matching ----------------
/** @type {import('../engine.js').Lesson} */
const WB = {
  id: 'vision-balance', domain: D, stations: ['vision'],
  title: 'Faire la balance des blancs et raccorder les caméras',
  summary: 'Exercice de la leçon « Espaces de couleur : BT.709, BT.2020, HDR » : les barres au line-up, une caméra qui dérive vers le rouge, la balance des blancs automatique (AWB) et le réglage fin des gains, pour que toutes les caméras rendent le même blanc.',
  duration: '8 min', level: 'intermédiaire',
  outro: 'Le **matching**, c\'est obtenir la même colorimétrie sur toutes les caméras : le même maillot doit avoir la même couleur quel que soit le plan. On le vérifie au vecteurscope (teinte et saturation) et à l\'œil, sur un moniteur de référence.',
  cleanupLabel: 'Corriger la dérive de la caméra',
  cleanup: (c) => { const k = cam(c); if (k) k.autoWhite(); },
  steps: [
    {
      id: 'intro', title: 'La couleur',
      enter: (c) => { c.mem.cam = pickCam([4, 5, 2, 3, 1]); },
      say: 'Leçon « Espaces de couleur » : un espace de couleur fixe ses trois primaires et son **blanc**, le D65 ; une caméra bien réglée rend un objet blanc avec rouge, vert et bleu au même niveau.\n\nOr chaque lumière a sa **température de couleur** (projecteurs du stade, soleil, ciel couvert). La **balance des blancs** compense : un objet blanc doit sortir blanc, quelle que soit la lumière qui l\'éclaire.',
    },
    goStation('vision', 'On retourne au poste vision.', 'Repère les molettes WHITE R, G, B et la touche AWB.', {
      go: (c) => ({ station: 'vision', cam: c.mem.cam }), done: atVision, skip: atVision,
      do: (c) => `Ouvre le poste vision sur la CAM ${c.mem.cam}.`,
      hints: ['Le poste vision est dans la zone « Vision et ralentis » du téléphone (Tab, application Aller à) : Ingé vision 1 ou 2.', 'Au poste, une rangée de touches numérotées choisit la caméra que le RCP commande : prends celle que je t\'ai donnée.'],
      auto: (c) => c.io.go({ station: 'vision', cam: c.mem.cam }),
    }),
    {
      id: 'bars', title: 'Les barres',
      enter: (c) => { (S.flags ||= {}).barsCycle = false; const k = cam(c); if (k) { k.panelActive = true; k.paint.bars = false; } },
      say: 'Au **line-up** (la vérification de toute la chaîne avant l\'antenne), chaque caméra envoie ses **barres de couleur** : des couleurs connues, aux primaires et aux complémentaires du BT.709. La vision vérifie ainsi que toute la chaîne (caméra, CCU, liaison, grille) transporte correctement le signal, avant même de regarder une image.',
      do: 'Envoie les barres (BARS), regarde-les, puis retire-les.',
      go: (c) => ({ station: 'vision', cam: c.mem.cam }), show: [rcpBtn('BARS')],
      done: () => !!(S.flags && S.flags.barsCycle),
      ok: 'Barres vues et retirées. Au vecteurscope (la mesure des teintes et de la saturation), chaque couleur tombe dans sa case : la chaîne est bonne.',
      hints: ['Les barres sont une fonction de sortie de la caméra : cherche-la dans la section FONCTIONS du RCP.', 'Touche BARS une fois pour les envoyer, une seconde fois pour les retirer.'],
      auto: (c) => { const k = cam(c); k.paint.bars = false; (S.flags ||= {}).barsCycle = true; },
    },
    {
      id: 'drift', title: 'Une caméra dérive',
      enter: (c) => { const k = cam(c); if (k && !c.mem.drift) { k.hidden.tR *= 1.14; k.hidden.tB *= 0.9; c.mem.drift = true; } },
      say: (c) => `La CAM ${c.mem.cam} tire vers le rouge-orangé : sur la parade RVB (le waveform séparé en rouge, vert et bleu), le rouge est plus haut que le vert et le bleu sur les blancs. Le plus rapide : la **balance automatique (AWB)**, la caméra cadrant un blanc.`,
      do: 'Fais une balance des blancs automatique (AWB).',
      go: (c) => ({ station: 'vision', cam: c.mem.cam }), show: [rcpBtn('AWB')],
      done: (c) => { const k = cam(c); if (!k) return false; const e = k.colorError(); return Math.abs(e.r) < 0.02 && Math.abs(e.b) < 0.02; },
      ok: 'Rouge et bleu sont revenus au niveau du vert : la caméra est neutre, un blanc sort blanc.',
      hints: ['Sur la parade, compare rouge, vert et bleu sur un blanc. Il existe un réglage automatique qui les égalise.', 'La touche AWB, sous les molettes WHITE du RCP.', 'À la main : baisser WHITE R et monter WHITE B, par petites touches, en regardant la parade.'],
      auto: (c) => cam(c).autoWhite(),
    },
    {
      id: 'quiz', title: 'Question',
      say: 'Et si l\'automatique ne suffit pas ?',
      quiz: { q: 'Sur un même plan, la CAM 4 paraît plus bleue que les autres. Que fais-tu au RCP ?', choices: ['Je baisse un peu le gain bleu (WHITE B), en comparant avec une caméra de référence', 'Je refais une balance automatique (AWB) en cadrant la pelouse', 'Je monte le master black (le niveau du noir)'], answer: 0, why: 'Le matching se fait sur les gains de blanc (et de noir), par petites touches, en comparant à la caméra de référence, souvent la large. Une AWB sur la pelouse prendrait le vert pour du blanc et fausserait toute la couleur ; le master black change le niveau du noir, pas la teinte.' },
    },
  ],
};

// ---------------- baie CCU ----------------
/** @type {import('../engine.js').Lesson} */
const CCU = {
  id: 'ccu-depannage', domain: D, stations: ['ccu', 'synchro'],
  title: 'Dépanner une voie caméra à la baie CCU',
  summary: 'Exercice de la leçon « La chaîne caméra : tête, fibre, CCU, RCP » : une caméra perd sa fibre (plus de niveau optique), une autre sa référence (genlock) ; on les retrouve à la baie CCU et on les rétablit.',
  duration: '6 min', level: 'intermédiaire',
  outro: 'Réflexe de dépannage : le multiview dit quoi (PAS DE SIGNAL, RÉF.), la baie CCU dit où (niveau optique, alimentation, verrouillage), et on rétablit avant de chercher la cause.',
  cleanupLabel: 'Rétablir les deux caméras',
  cleanup: (c) => { const a = camById(c.mem.cam), b = camById(c.mem.cam2); if (a) { a.fiberCut = false; a.checkLink(); } if (b) b.genlock = true; },
  steps: [
    {
      id: 'intro', title: 'La baie CCU',
      enter: (c) => { c.mem.cam = pickCam([5, 4, 3]); c.mem.cam2 = pickCam([4, 3, 5].filter((i) => i !== c.mem.cam)); if (c.mem.cam2 === c.mem.cam) c.mem.cam2 = camIds(true).find((i) => i !== c.mem.cam) || c.mem.cam; },
      say: 'Leçon « La chaîne caméra » : la tête et sa CCU ne sont reliées que par la fibre hybride ; tout passe par elle, et c\'est la CCU qui cale la tête sur la référence du car.\n\nChaque caméra est reliée à sa **CCU** (Camera Control Unit, la voie caméra : elle alimente la tête, la pilote et reçoit son image) par une fibre hybride SMPTE : deux fibres portent l\'image, les retours, l\'intercom, le tally et les commandes du RCP, le cuivre porte l\'énergie.\n\nLa CCU reçoit aussi la **référence** du générateur de synchro (black burst ou tri-level) et y cale sa caméra : c\'est le **genlock**, qui met toutes les caméras en phase.',
    },
    goStation('ccu', 'La baie CCU est dans la zone technique.', 'Une ligne par CCU : son état, le niveau optique, la référence.'),
    {
      id: 'fibre', title: 'Une caméra disparaît',
      enter: (c) => { const k = camById(c.mem.cam); if (k) { k.fiberCut = true; k.checkLink(); } },
      say: (c) => `Le multiview affiche PAS DE SIGNAL sur la CAM ${c.mem.cam}. À la baie, sa CCU n'a plus de niveau optique (moins de −30 dBm, quand une voie normale lit de −5 à −15 dBm) : la fibre est coupée (un engin de chantier, un pied posé dessus…). En exploitation, on bascule sur la **fibre de secours** tirée lors de l'installation.`,
      do: (c) => `Trouve la CCU ${c.mem.cam} et bascule sur la fibre de secours.`,
      go: { station: 'ccu' }, show: [{ sel: '#station .btn', text: 'Fibre de secours', label: 'fibre de secours' }],
      done: (c) => { const k = camById(c.mem.cam); return !!k && !k.fiberCut; },
      ok: 'L\'image revient. Il faudra quand même faire changer la fibre principale à la mi-temps, nettoyer ses connecteurs et mesurer le niveau optique : tant qu\'elle est coupée, tu n\'as plus de secours.',
      hints: ['Une ligne par CCU : cherche celle dont l\'état est en rouge.', 'Sur la ligne de la CCU (« OPTIQUE : PAS DE SIGNAL »), le bouton « Fibre de secours ».'],
      auto: (c) => { const k = camById(c.mem.cam); k.fiberCut = false; k.checkLink(); },
    },
    {
      id: 'ref', title: 'Une référence perdue',
      enter: (c) => { const k = camById(c.mem.cam2); if (k) k.genlock = false; },
      say: (c) => `Autre alarme : la CAM ${c.mem.cam2} n'est plus verrouillée sur la référence (RÉF. NON VERROUILLÉE). Son image n'est plus en phase avec les autres : au mélangeur, la coupe sauterait. On la **re-verrouille** à la CCU.`,
      do: (c) => `Re-verrouille la référence de la CCU ${c.mem.cam2}.`,
      go: { station: 'ccu' }, show: [{ sel: '#station .btn', text: 'Re-verrouiller', label: 'référence' }],
      done: (c) => { const k = camById(c.mem.cam2); return !!k && k.genlock; },
      ok: 'Verrouillée. Si toutes les CCU décrochent en même temps, la panne est en amont : générateur de synchro ou distributeur.',
      hints: ['Même baie : lis l\'état de chaque ligne, une seule parle de référence.', 'Sur la ligne « RÉF. NON VERROUILLÉE », le bouton « Re-verrouiller la réf. ».'],
      auto: (c) => { camById(c.mem.cam2).genlock = true; },
    },
    {
      id: 'quiz', title: 'Question',
      say: 'Une question pour retenir le rôle de la référence.',
      quiz: { q: 'Une caméra non verrouillée sur la référence (genlock)…', choices: ['donne une image qui saute ou roule à la commutation, car elle n\'est pas en phase avec les autres', 'n\'a plus de couleur', 'perd son intercom'], answer: 0, why: 'Le mélangeur combine des images qui doivent commencer exactement au même instant. Sans référence commune, il faut un synchroniseur d\'images (frame sync), au prix d\'une image de retard. La couleur et l\'intercom ne dépendent pas de la référence : c\'est la phase de l\'image qui est en cause.' },
    },
  ],
};

// ---------------- prendre une caméra ----------------
/** @type {import('../engine.js').Lesson} */
const OPERATOR = {
  id: 'cadreur-cadrer', domain: D, stations: [],
  title: 'Prendre une caméra et cadrer',
  summary: 'Exercice de la leçon « La chaîne caméra : tête, fibre, CCU, RCP » : se mettre derrière une caméra, zoomer, faire un panoramique, lire le tally, rendre la caméra ; le cadreur règle le cadre, la vision règle l\'image.',
  duration: '5 min', level: 'découverte',
  outro: 'Un cadreur travaille au tally : rouge, il est à l\'antenne et son cadre doit rester propre ; vert, il est le suivant ; éteint, il prépare son prochain plan.',
  steps: [
    {
      id: 'intro', title: 'Le cadreur',
      enter: (c) => { const large = S.cams.find((k) => k.role === 'large') || S.cams[0]; c.mem.cam = large ? large.id : 1; },
      say: 'Leçon « La chaîne caméra » : le cadreur règle le cadre, l\'ingénieur vision règle l\'image depuis le car ; la voix de la réalisation et le tally arrivent au cadreur par la fibre.\n\nLe **cadreur** suit l\'action à la **tête fluide** (la rotule amortie qui porte la caméra) : panoramique, inclinaison, zoom et point aux commandes sur les manches. Il entend le réalisateur dans son casque et voit le **tally** (le voyant rouge ou vert de l\'antenne) dans son viseur. L\'iris, lui, est réglé par la vision.',
    },
    {
      id: 'take', title: 'Prendre la caméra',
      say: (c) => `On prend la CAM ${c.mem.cam}, la caméra large en tribune.`,
      do: (c) => `Prends la CAM ${c.mem.cam} (au plan caméras, ou en t'approchant et en appuyant sur E).`,
      done: (c) => S.mode === 'camop' && !!S.camop && S.camop.id === c.mem.cam,
      ok: 'Tu es derrière la caméra : le viseur montre son image, le tally est en haut.',
      hints: ['Deux chemins : le plan caméras (P), ou à pied jusqu\'à la caméra dans le stade.', 'Au plan caméras, clique la caméra demandée puis « Prendre la caméra » ; à pied, vise-la et appuie sur E.'],
      auto: (c) => ui(c, 'take', c.mem.cam),
    },
    {
      id: 'zoom', title: 'Zoomer',
      enter: (c) => { const k = camById(c.mem.cam); if (k && !k.tgt) k.tgt = { yaw: k.yaw.v, pitch: k.pitch.v, lf: k.lf.v }; c.mem.lf0 = k ? k.tgt.lf : 0; },
      say: 'Le zoom se commande à la molette (la commande de zoom du manche, au pouce). Un objectif de stade va du grand angle au très serré : on cadre un joueur à 80 m.',
      do: 'Zoome jusqu\'à doubler la focale (molette vers l\'avant).',
      done: (c) => { const k = camById(c.mem.cam); return !!k && !!k.tgt && k.tgt.lf - c.mem.lf0 >= Math.log(1.8); },
      ok: 'Focale doublée : le champ est deux fois plus étroit, le joueur paraît deux fois plus grand.',
      hints: ['Sur la caméra, le zoom est au pouce ; à la souris, c\'est la molette.', 'Molette vers l\'avant, par petits crans, jusqu\'à ce que le champ se resserre de moitié.'],
      auto: (c) => { const k = camById(c.mem.cam); k.tgt.lf = Math.min(Math.log(k.fMax), c.mem.lf0 + Math.log(2.5)); },
    },
    {
      id: 'pan', title: 'Panoramique',
      enter: (c) => { const k = camById(c.mem.cam); c.mem.yaw0 = k && k.tgt ? k.tgt.yaw : 0; },
      say: 'Le panoramique suit le ballon. Le bon geste est régulier, sans à-coups, en anticipant le jeu.',
      do: 'Fais un panoramique de plus de 20° (souris).',
      done: (c) => { const k = camById(c.mem.cam); return !!k && !!k.tgt && Math.abs(k.tgt.yaw - c.mem.yaw0) > 0.35; },
      ok: 'Panoramique fait. En tribune, on garde toujours un peu d\'espace devant le joueur, dans le sens du jeu.',
      hints: ['Le panoramique, c\'est tourner la caméra à l\'horizontale.', 'Déplace la souris vers la gauche ou la droite, d\'un geste régulier, d\'au moins 20°.'],
      auto: (c) => { const k = camById(c.mem.cam); k.tgt.yaw += 0.45; },
    },
    {
      id: 'tally', title: 'Le tally',
      say: 'Regarde le voyant en haut du viseur : c\'est le tally.',
      quiz: { q: 'Ton tally est rouge. Que fais-tu ?', choices: ['Je garde un cadre propre : je suis à l\'antenne, je suis le jeu sans recadrer brutalement', 'Je change de cadre pour proposer un autre plan', 'Rien de particulier, le tally ne concerne que la régie'], answer: 0, why: 'Rouge = à l\'antenne. On propose de nouveaux plans quand le tally est éteint ; vert, on se prépare car on est le suivant. Le tally s\'adresse d\'abord au cadreur : l\'ignorer, c\'est risquer un recadrage brutal en direct.' },
    },
    {
      id: 'release', title: 'Rendre la caméra',
      say: 'On rend la caméra à son cadreur automatique.',
      do: 'Rends la caméra (touche E ou Échap).',
      done: () => S.mode !== 'camop',
      ok: 'Caméra rendue : son cadreur automatique reprend le cadre.',
      hints: ['On rend la caméra avec la touche qui sert à la prendre.', 'Touche E, ou Échap.'],
      auto: (c) => ui(c, 'release'),
    },
  ],
};

// ---------------- atelier de montage ----------------
const phaseDone = (c, ...phases) => { const a = c.view().atelier; return !!a && a.ops.filter((o) => phases.includes(o.phase)).every((o) => a.done.has(o.id)); };
/** @type {import('../engine.js').Lesson} */
const RIG = {
  id: 'atelier-montage', domain: D, stations: [],
  title: 'Monter une caméra de stade à l\'atelier',
  summary: 'Exercice de la leçon « Monter une caméra de stade » : pied, tête, adaptateur, objectif box, commandes, équilibrage, fibre propre et mise en service avec la vision, 30 gestes dans l\'ordre.',
  duration: '20 min', level: 'intermédiaire',
  outro: 'Le rapport de montage note le temps et les erreurs. En vrai, les deux pièges sont l\'objectif posé sur une tête non verrouillée et la fibre branchée sans nettoyage : une poussière suffit à faire chuter le niveau optique.',
  steps: [
    {
      id: 'intro', title: 'L\'atelier',
      say: 'Leçon « Monter une caméra de stade » : rien ne se pose sur une pièce qui n\'est pas stable et verrouillée.\n\nUne caméra de tribune se monte donc dans un ordre précis : on ne pose pas près de 24 kg d\'objectif sur une tête qui n\'est pas verrouillée !\n\nL\'atelier te met devant le matériel, rangé dans ses **flight cases** (les malles de transport) : tu vises une pièce, **E** pour la prendre, puis tu vises sa place. La liste à droite indique le geste suivant ; je te suis phase par phase.',
    },
    {
      id: 'start', title: 'Entrer dans l\'atelier',
      do: 'Lance l\'atelier de montage (bouton « Fais-le pour moi » ou écran d\'accueil, « Monter une caméra »).',
      say: 'On démonte la CAM 1 de la tribune et on la remonte entièrement.',
      done: (c) => !!c.view().atelier,
      ok: 'Te voilà devant le repère CAM 1 et les flight cases : le repère au sol est la position prévue au plan caméras.',
      hints: ['L\'atelier est un exercice à part : il se lance depuis l\'écran d\'accueil, ou depuis moi.', 'Écran d\'accueil, carte « Atelier de montage », bouton « Monter une caméra » — ou mon bouton « Fais-le pour moi ».'],
      auto: (c) => ui(c, 'atelier', 'start'),
    },
    {
      id: 'support', title: 'Le support',
      say: 'D\'abord le **support** : le pied sur son repère, les jambes déployées, l\'**araignée** (l\'étoile qui tient le bas des jambes) verrouillée, la tête fluide boulonnée, **mise à niveau** (bulle), puis **verrouillée**, et les deux manches.',
      do: 'Termine la phase Support (8 gestes).',
      show: [{ sel: '#atelier', label: 'la liste de l\'atelier' }],
      done: (c) => phaseDone(c, 'Support'),
      ok: 'Support prêt : de niveau et verrouillé, il peut recevoir la charge.',
      hints: ['La liste de l\'atelier, à droite, donne le geste suivant et ce qui manque encore pour le faire.', 'Le pied se pose sur le repère au sol ; maintiens E pour déployer les jambes.', 'Pour la bulle : vise-la, tourne la molette jusqu\'à moins de 0,2°, puis E.'],
      auto: (c) => ui(c, 'atelier', 'Support'),
    },
    {
      id: 'camera', title: 'Caméra et objectif',
      say: 'La **plaque**, l\'**adaptateur grand objectif** (le support qui reçoit le corps de caméra et l\'objectif, ≈ 15,5 kg) verrouillé, la **tête de caméra** insérée par l\'arrière et verrouillée, l\'**objectif box** (le gros zoom de stade en caisson, ≈ 23,5 kg : on le lève à deux) verrouillé et son câble 36 broches, le viseur.',
      do: 'Termine la phase Caméra (9 gestes).',
      show: [{ sel: '#atelier', label: 'la liste de l\'atelier' }],
      done: (c) => phaseDone(c, 'Caméra'),
      ok: 'Caméra et objectif en place, tout est verrouillé : la charge ne peut plus glisser.',
      hints: ['L\'ordre de la liste compte : rien ne se pose sur une pièce qui n\'est pas verrouillée.', 'Plaque, adaptateur et son verrou, caméra par l\'arrière et son verrou ; l\'objectif seulement une fois l\'adaptateur verrouillé.'],
      auto: (c) => ui(c, 'atelier', 'Caméra'),
    },
    {
      id: 'controls', title: 'Commandes et équilibrage',
      say: 'Les **commandes** de zoom et de point sur les manches, branchées sur l\'objectif, puis l\'**équilibrage** : contrepoids réglé pour la charge, on libère le verrou et on fait coulisser la plaque jusqu\'à ce que le centre de gravité passe au-dessus de l\'axe d\'inclinaison. La caméra tient alors seule à l\'horizontale.',
      do: 'Termine les phases Commandes et Équilibrage.',
      show: [{ sel: '#atelier', label: 'la liste de l\'atelier' }],
      done: (c) => phaseDone(c, 'Commandes', 'Équilibrage'),
      ok: 'Équilibrée : le cadreur pourra lâcher les manches sans que la caméra pique du nez. Les frictions se règlent maintenant, à son goût.',
      hints: ['D\'abord les commandes sur les manches ; l\'équilibrage vient en dernier, avec toute la charge en place.', 'Pour l\'équilibrage : vise la plaque et tourne la molette jusqu\'à ce que la caméra reste à l\'horizontale, puis E.'],
      auto: (c) => { ui(c, 'atelier', 'Commandes'); ui(c, 'atelier', 'Équilibrage'); },
    },
    {
      id: 'link', title: 'La liaison',
      say: 'La **fibre** : on **nettoie** les deux connecteurs (caméra et prise murale) au stylo avant de brancher, on raccorde, et on attache le câble au pied pour qu\'une traction ne l\'arrache pas.',
      do: 'Termine la phase Liaison.',
      show: [{ sel: '#atelier', label: 'la liste de l\'atelier' }],
      done: (c) => phaseDone(c, 'Liaison'),
      ok: 'Fibre propre, raccordée et attachée au pied : une traction ne l\'arrachera pas.',
      hints: ['Avant de brancher une fibre, il y a toujours un geste de propreté, aux deux bouts.', 'Le stylo de nettoyage sur le connecteur de la caméra et sur la prise murale (E maintenu), puis on branche et on attache le câble au pied.'],
      auto: (c) => ui(c, 'atelier', 'Liaison'),
    },
    {
      id: 'power', title: 'Mise en service',
      say: 'Le **casque** intercom, le **bouchon** d\'objectif retiré, puis on appelle la vision (« CAM 1 câblée ») qui allume la caméra, et on teste ensemble le **tally** et le **CALL** (l\'appel lumineux entre le cadreur et la vision).',
      do: 'Termine la mise en service jusqu\'au rapport de montage.',
      show: [{ sel: '#atelier', label: 'la liste de l\'atelier' }],
      done: (c) => { const a = c.view().atelier; return !!a && a.finished; },
      ok: 'Montage terminé : le rapport s\'affiche, avec ton temps et tes erreurs.',
      hints: ['Avant d\'allumer, le cadreur doit pouvoir entendre la régie et voir à travers l\'objectif.', 'Casque intercom, bouchon retiré, puis « CAM 1 câblée » à la vision, et enfin le test tally / CALL.'],
      auto: (c) => ui(c, 'atelier', 'Mise en service'),
    },
    {
      id: 'quiz', title: 'Question',
      say: 'Une question de sécurité et de qualité.',
      quiz: { q: 'Pourquoi nettoie-t-on les connecteurs de fibre avant chaque branchement ?', choices: ['Une poussière sur le cœur de la fibre suffit à faire chuter le niveau optique, voire à abîmer le connecteur', 'Pour éviter un court-circuit électrique', 'C\'est une simple habitude, sans effet mesurable'], answer: 0, why: 'Le cœur d\'une fibre monomode fait environ 9 µm : une poussière l\'obstrue. La CCU signale alors un niveau optique bas, et l\'image peut décrocher.' },
    },
  ],
};

export const IMAGE_LESSONS = [EXPO, WB, CCU, OPERATOR, RIG];

// @ts-check
// Exercices pratiques de la mesure vidéo (PRISM), menés par Olivier, le chef de car.
// ----------------------------------------------------------------------------------
// Trois exercices, chacun rangé dans sa leçon du Cours : lire le waveform et la parade (leçon
// « Niveaux », poste vision), le gamut au vecteurscope, au diamant et au split diamant (leçon « Espaces
// de couleur », poste vision), qualifier une liaison SDI au diagramme de l'œil et trouver un cordon
// abîmé (leçon « Longueur de câble et diagramme de l'œil », baie de mesure). Les gestes se vérifient sur l'état du simulateur : affichages des
// tuiles de l'instrument (prism_model.js), réglages de la caméra au RCP, couche physique de la liaison.
// ----------------------------------------------------------------------------------
import { S, camById } from '../../state.js';
import { MIX, meSource } from '../../pipeline.js';
import { goStation, camIds } from './kit.js';
import { PRISM, setTile, setPreset, setInput, showing, phyFault, repairLink, phyFaultAt, pointById, pickFaultCam, sdiStd } from '../../prism_model.js';

const D = 'Image et caméras';
const rcpBtn = (text) => ({ sel: '#station .rcp-btn', text, label: text });
const tileSel = { sel: '#station .pz-app', label: 'liste des affichages d\'une tuile' };
const opt = (prop, v, label) => ({ sel: `#station .pz-b[data-opt="${prop}"]${v != null ? `[data-v="${v}"]` : ''}`, label });
const cam = (c) => camById(c.mem.cam);
function pickCam(pref) {
  const wired = camIds(true); const pgm = meSource(MIX.pgm);
  return [...pref.filter((i) => wired.includes(i)), ...wired].find((i) => 'CAM' + i !== pgm) || wired[0] || 1;
}
const atVision = (c) => c.view().station === 'vision' && c.view().cam === c.mem.cam;
const goVision = (say, ok) => goStation('vision', say, ok, {
  go: (c) => ({ station: 'vision', cam: c.mem.cam }), done: atVision, skip: atVision,
  do: (c) => `Ouvre le poste vision sur la CAM ${c.mem.cam}.`,
  hints: ['Le poste vision est dans la zone « Vision et ralentis » du pupitre (Tab) : touche Ingé vision 1 ou 2.', 'Au poste, la rangée de touches numérotées choisit la caméra que commandent le RCP et le PRISM : prends celle que je t\'ai donnée.'],
  auto: (c) => c.io.go({ station: 'vision', cam: c.mem.cam }),
});
// tuile à utiliser pour un « Fais-le pour moi » : celle qui montre déjà l'affichage, sinon la tuile proposée
const tileOf = (key, app, pref = 0) => { const i = PRISM[key].tiles.findIndex((t) => t.app === app); return i >= 0 ? i : pref; };
const ensureVisible = (key) => { if (PRISM[key].layout === 1) PRISM[key].layout = 4; };

// ---------------- lire le waveform et la parade ----------------
/** @type {import('../engine.js').Lesson} */
const WFM = {
  id: 'prism-waveform', domain: D, stations: ['vision', 'mesure'],
  title: 'Lire les niveaux au waveform et à la parade',
  summary: 'Exercice de la leçon « Niveaux : 0–100 %, noir à 64, blanc à 940 » : mettre une tuile du PRISM en waveform, lire les niveaux en mV et en % au curseur, puis corriger au RCP un noir qui tire au rouge sur la parade RVB.',
  duration: '10 min', level: 'débutant',
  outro: 'Le Grade 1 dit si c\'est beau, le PRISM dit si c\'est juste. Une habitude d\'ingénieur vision : l\'œil sur le moniteur, un coup d\'œil au waveform et à la parade à chaque réglage, et des chiffres plutôt qu\'une impression.',
  cleanupLabel: 'Remettre le noir de la caméra',
  cleanup: (c) => { const k = cam(c); if (k) k.autoBlack(); },
  steps: [
    {
      id: 'intro', title: 'L\'instrument',
      enter: (c) => { c.mem.cam = pickCam([3, 4, 2, 5, 1]); },
      say: 'Leçon « Niveaux » : le noir vidéo est à **0 %** (code 64 en 10 bits), le blanc à **100 %** (code 940), et seul un instrument dit où sont vraiment les niveaux, parce que l\'œil s\'adapte et se trompe.\n\nÀ la vision, à côté du **RCP** (le pupitre de réglage de la caméra) et sous le **Grade 1** (le moniteur de référence), il y a un **moniteur de mesure** : ici un **PRISM** (de Telestream, anciennement Tektronix). C\'est un écran tactile découpé en quatre **tuiles** ; chaque tuile choisit son affichage : waveform, vecteurscope, diamant, image…\n\nLe Grade 1 te dit si l\'image est belle ; le PRISM te dit si elle est **juste** : des niveaux chiffrés, comparables d\'une caméra à l\'autre et aux consignes du diffuseur.',
    },
    goVision('On va au poste vision, en régie vision et ralentis.', 'Le PRISM est sous le Grade 1 et le multiview, au-dessus du fil « Ce qui se passe ». Il mesure la caméra choisie au RCP.'),
    {
      id: 'wfm', title: 'Une tuile en waveform',
      enter: () => { setPreset('vision', 'gamut'); ensureVisible('vision'); },
      say: 'J\'ai mis l\'instrument sur le préréglage « Gamut » : pas de waveform à l\'écran. Le **waveform** (on dit aussi « oscillo ») trace le niveau de chaque point de l\'image, colonne par colonne.',
      do: 'Mets une tuile en Waveform, en luminance (bouton Y).',
      go: (c) => ({ station: 'vision', cam: c.mem.cam }), show: [tileSel],
      done: () => showing('vision', 'wfm', (t) => t.mode === 'y'),
      ok: 'Voilà le waveform de ta caméra. La trace, c\'est toute l\'image, colonne par colonne : à gauche ce qui est à gauche dans l\'image, en hauteur le niveau.',
      hints: ['Chaque tuile a, dans son bandeau, une liste qui choisit son affichage.', 'Choisis « Waveform » dans la liste d\'une tuile ; le bouton Y (luminance) est le réglage par défaut.'],
      auto: () => { ensureVisible('vision'); setTile('vision', 0, { app: 'wfm', mode: 'y' }); },
    },
    {
      id: 'lire', title: 'Lire les niveaux',
      say: 'De bas en haut : **0 mV** = noir (code 64), **700 mV** = blanc nominal (code 940), soit **100 %** : c\'est la plage légale. Le bouton mV / % change seulement l\'échelle : 1 % vaut 7 mV.\n\nRepères de jour : pelouse vers **40 à 55 %**, maillots blancs **sous 100 %** (103 % au plus selon le diffuseur, EBU R 103), noirs **entre 0 et 2 %**. La ligne pointillée rouge à 109 % (763 mV, code 1 019) est le plafond des super-blancs que le SDI transporte : entre 100 et 109 %, le signal passe, mais il n\'est plus légal.',
    },
    {
      id: 'curseur', title: 'Le curseur',
      say: 'Pour lire un niveau précis, l\'instrument a un **curseur** : une ligne que tu poses sur la trace, avec sa valeur en mV et en %.',
      do: 'Active le curseur de la tuile Waveform et pose-le sur le haut de la trace.',
      go: (c) => ({ station: 'vision', cam: c.mem.cam }), show: [opt('cursor', null, 'bouton Curseur'), tileSel],
      done: () => showing('vision', 'wfm', (t) => t.cursor != null),
      ok: 'Le curseur donne le niveau exact : c\'est lui qu\'on utilise pour vérifier une consigne (« blancs à 100 % maxi ») ou pour égaliser deux caméras.',
      hints: ['Regarde les boutons dans le bandeau de la tuile Waveform.', 'Bouton « Curseur », puis fais glisser la ligne sur le waveform (ou flèches haut et bas).'],
      auto: () => { const i = tileOf('vision', 'wfm'); setTile('vision', i, { app: 'wfm', cursor: 0.97 }); },
    },
    {
      id: 'quiz1', title: 'mV ou % ?',
      say: 'Une question de lecture.',
      quiz: { q: 'Le maillot blanc du gardien monte à 735 mV au waveform. Qu\'en dis-tu ?', choices: ['735 mV = 105 % : au-dessus du blanc nominal, je le ramène (iris, knee ou white clip)', '735 mV = 73,5 % : tout va bien', '105 %, mais le waveform ne compte pas pour un blanc : seul le vecteurscope compte'], answer: 0, why: '700 mV = 100 %, donc 735 mV = 105 % : au-dessus des 100 % (ou 103 %) qu\'acceptent les diffuseurs. L\'erreur classique est de lire les mV comme des % : 1 % vaut 7 mV. Et c\'est bien le waveform qui mesure les niveaux ; le vecteurscope ne voit que la couleur.' },
    },
    {
      id: 'parade', title: 'La parade RVB',
      say: 'Le waveform en luminance mélange les trois couleurs. Pour la **balance**, on sépare le rouge, le vert et le bleu côte à côte : c\'est la **parade RVB**.',
      do: 'Passe une tuile Waveform en parade RVB.',
      go: (c) => ({ station: 'vision', cam: c.mem.cam }), show: [opt('mode', 'rgb', 'bouton RVB'), tileSel],
      done: () => showing('vision', 'wfm', (t) => t.mode === 'rgb'),
      ok: 'Trois traces : R, G, B. Sur un blanc ou un gris neutre, elles sont à la même hauteur ; sur les noirs aussi, en bas.',
      hints: ['La parade est un mode du waveform : regarde les boutons de la tuile Waveform.', 'Bouton RVB dans le bandeau de la tuile Waveform.'],
      auto: () => { const i = tileOf('vision', 'wfm'); setTile('vision', i, { app: 'wfm', mode: 'rgb' }); },
    },
    {
      id: 'noir', title: 'Un noir qui tire au rouge',
      enter: (c) => { const k = cam(c); if (k) { k.panelActive = true; k.paint.blackR += 120; } },
      say: (c) => `Je viens de dérégler le noir rouge de la CAM ${c.mem.cam} (le niveau de noir du seul rouge ; le master black, lui, déplace les trois) : sur la parade, en bas, la trace rouge part plus haut que la verte et la bleue. Les ombres de la tribune virent au rouge.`,
      do: 'Rééquilibre les noirs : balance des noirs automatique ou molette BLACK R.',
      go: (c) => ({ station: 'vision', cam: c.mem.cam }), show: [rcpBtn('ABB')],
      done: (c) => { const k = cam(c); if (!k) return false; const e = k.colorError(); return Math.abs(e.blackR) < 0.006 && Math.abs(e.blackB) < 0.006; },
      ok: 'Les trois traces repartent du même niveau : des noirs neutres. L\'ABB se fait iris fermé, normalement au line-up ; en direct, on retouche à la molette, l\'œil sur la parade.',
      hints: ['Regarde le bas de la parade : quelle trace n\'est pas au niveau des deux autres ? C\'est le noir de cette couleur qu\'il faut corriger.', 'La balance des noirs automatique s\'appelle ABB, sous les molettes BLACK du RCP.', 'À la main : molette BLACK R vers le bas, jusqu\'à aligner le rouge sur le vert et le bleu en bas de la parade.'],
      auto: (c) => cam(c).autoBlack(),
    },
    {
      id: 'quiz2', title: 'Question',
      say: 'Dernière question sur la parade.',
      quiz: { q: 'Sur la chemise blanche de l\'arbitre, la trace bleue de la parade est plus haute que la rouge et la verte. Que fais-tu ?', choices: ['Une balance des blancs (AWB) ou un peu moins de WHITE B : l\'image tire vers le bleu', 'Je baisse la saturation', 'Une balance des noirs (ABB)'], answer: 0, why: 'Sur un blanc, ce sont les gains (la balance des blancs) qui comptent : un bleu plus haut, c\'est une image froide. La balance des noirs agit sur le bas de la trace, pas sur les blancs ; la saturation ne change rien à un blanc, qui n\'a pas de couleur.' },
    },
  ],
};

// ---------------- gamut ----------------
/** @type {import('../engine.js').Lesson} */
const GAMUT = {
  id: 'prism-gamut', domain: D, stations: ['vision'],
  title: 'Vérifier le gamut au vecteurscope et au diamant',
  summary: 'Exercice de la leçon « Espaces de couleur : BT.709, BT.2020, HDR » : la mire dans les cibles 75 % du vecteurscope, une caméra trop saturée qui sort du diamant et que l\'on ramène dans le gamut au RCP, puis le split diamant.',
  duration: '10 min', level: 'intermédiaire',
  outro: 'Le vecteurscope dit la teinte et la saturation ; le diamant dit si le signal est légal en RVB. Une image peut être belle au Grade 1 et refusée au contrôle qualité : on vérifie le gamut avant l\'antenne, surtout quand on pousse la saturation, et sur la sortie SDR d\'une production HDR, où les couleurs du triangle BT.2020 doivent rentrer dans celui du BT.709.',
  cleanupLabel: 'Remettre la caméra comme avant',
  cleanup: (c) => { const k = cam(c); if (k) { k.paint.bars = false; if (c.mem.sat0 != null) { k.paint.sat = c.mem.sat0; k.paint.kneeOn = c.mem.knee0; k.paint.wclip = c.mem.wclip0; } } },
  steps: [
    {
      id: 'intro', title: 'Le gamut',
      enter: (c) => { c.mem.cam = pickCam([4, 5, 2, 3, 1]); },
      say: 'Leçon « Espaces de couleur » : le **gamut** d\'un espace, c\'est le triangle des couleurs que ses trois primaires savent reproduire (BT.709 en HD, BT.2020 en UHD).\n\nÀ la mesure, on vérifie la même chose sur le signal. Le câble transporte Y, Cb et Cr ; mais toutes leurs combinaisons ne se reconvertissent pas en rouge, vert et bleu entre 0 et 700 mV. Une couleur hors du triangle, ou trop lumineuse et trop saturée à la fois, ressort avec une composante sous 0 ou au-dessus de 700 mV : elle est **hors gamut**. Elle sera écrêtée plus loin (codeur, émetteur) et changera de teinte ; la chaîne peut même refuser le programme au contrôle qualité.',
    },
    goVision('On retourne au poste vision.', 'On va se servir du vecteurscope et du diamant du PRISM.'),
    {
      id: 'vec', title: 'Le vecteurscope',
      enter: () => { setPreset('vision', 'vision'); setTile('vision', 2, { app: 'wfm', mode: 'y' }); ensureVisible('vision'); },
      say: 'Le **vecteurscope** place chaque point de l\'image selon sa couleur : l\'angle donne la teinte, la distance au centre la saturation. Au centre : le blanc, les gris, le noir.',
      do: 'Mets une tuile en Vecteurscope.',
      go: (c) => ({ station: 'vision', cam: c.mem.cam }), show: [tileSel],
      done: () => showing('vision', 'vec'),
      ok: 'Le nuage vert-jaune, c\'est la pelouse ; les petites taches au centre, les gris et les blancs.',
      hints: ['Chaque tuile choisit son affichage dans la liste de son bandeau.', 'Choisis « Vecteurscope » dans la liste d\'une tuile.'],
      auto: () => { ensureVisible('vision'); setTile('vision', 2, { app: 'vec' }); },
    },
    {
      id: 'bars', title: 'La mire dans les cibles',
      enter: (c) => { const k = cam(c); if (k) { k.panelActive = true; k.paint.bars = false; } },
      say: 'Au **line-up** (la vérification de toute la chaîne avant l\'antenne), chaque caméra envoie sa **mire** de barres. Les cases du vecteurscope sont les **cibles** : une par couleur de la mire.',
      do: 'Envoie les barres de la caméra (BARS) et regarde le vecteurscope.',
      go: (c) => ({ station: 'vision', cam: c.mem.cam }), show: [rcpBtn('BARS')],
      done: (c) => !!cam(c) && !!cam(c).paint.bars,
      ok: 'Chaque barre tombe dans sa case : la chaîne (CCU, grille, instrument) transporte les couleurs sans erreur de gain ni de teinte.',
      hints: ['Les barres sont une fonction de sortie de la caméra : cherche dans la section FONCTIONS du RCP.', 'Touche BARS du RCP.'],
      auto: (c) => { cam(c).paint.bars = true; },
    },
    {
      id: 'quiz75', title: 'Pourquoi 75 % ?',
      say: 'Regarde bien où tombent les points.',
      quiz: { q: 'Les points de la mire tombent dans les cases 75 %, pas dans les 100 %. Pourquoi ?', choices: ['La mire du car est une mire 75 % (100/0/75/0) : couleurs à 75 %, blanc à 100 %', 'La saturation de la caméra est trop basse : il faut la monter', 'Le vecteurscope est mal étalonné'], answer: 0, why: 'La mire 100/0/75/0 a ses couleurs à 75 % : une mire 100 % pousserait le jaune et le cyan à 133 % en composite. Monter la saturation n\'y changerait rien : la mire est fabriquée électroniquement, après le réglage de la matrice. Et un vecteurscope mal étalonné décalerait toutes les cibles, pas seulement leur distance.' },
    },
    {
      id: 'diamond', title: 'Le diamant',
      say: 'Le vecteurscope ne voit pas la luminance : une couleur à la fois très lumineuse et très saturée peut y sembler sage. Le **diamant** de Tektronix regarde directement R, G et B : deux losanges, bleu-vert en haut, rouge-vert en bas. Tant que la trace reste dedans, chaque composante est entre 0 et 700 mV.',
      do: 'Coupe les barres et mets une tuile en Diamant.',
      go: (c) => ({ station: 'vision', cam: c.mem.cam }), show: [rcpBtn('BARS'), tileSel],
      done: (c) => !!cam(c) && !cam(c).paint.bars && showing('vision', 'diamond'),
      ok: 'L\'image normale tient dans les losanges : pas d\'excursion. La pointe du haut et celle du bas, ce sont les blancs.',
      hints: ['Deux gestes : la touche BARS, puis la liste d\'affichage d\'une tuile.', 'BARS pour couper la mire, puis « Diamant » dans la liste d\'une tuile.'],
      auto: (c) => { cam(c).paint.bars = false; setTile('vision', tileOf('vision', 'diamond', 1), { app: 'diamond' }); },
    },
    {
      id: 'sat', title: 'Une caméra hors gamut',
      enter: (c) => { const k = cam(c); if (k && c.mem.sat0 == null) { c.mem.sat0 = k.paint.sat; c.mem.knee0 = k.paint.kneeOn; c.mem.wclip0 = k.paint.wclip; k.paint.sat = 155; k.paint.kneeOn = false; k.paint.wclip = 109; k.panelActive = true; } },
      say: (c) => `Je viens de pousser la saturation de la CAM ${c.mem.cam} à 155 %, de couper le **knee** (la compression des hautes lumières) et d'ouvrir le **white clip** (l'écrêteur des blancs) à 109 % : les maillots sortent du diamant par les côtés, les blancs par les pointes. Le Grade 1 trouve ça « pétant » ; la chaîne, non.`,
      do: 'Ramène l\'image dans le gamut : saturation à 115 % au plus, knee rallumé, white clip à 105 % au plus.',
      go: (c) => ({ station: 'vision', cam: c.mem.cam }), show: [{ sel: '#station .rcp-key', text: 'KNEE', label: 'touche KNEE' }, { sel: '#station .rcp-tab', text: 'PAINT', label: 'page PAINT' }],
      done: (c) => { const k = cam(c); return !!k && k.paint.sat <= 115 && k.paint.kneeOn && k.paint.wclip <= 105; },
      ok: 'La trace est rentrée dans les losanges : chaque composante reste entre 0 et 700 mV, dans les −5 à 105 % que tolère le diffuseur sur R, V et B (EBU R 103). Le knee compresse les hautes lumières au lieu de les laisser filer ; le white clip est le plafond de sécurité.',
      hints: ['Une trace qui sort par un côté du diamant = une couleur trop saturée ; par une pointe = des blancs trop hauts. Trois réglages du RCP sont en cause.', 'Page PAINT : molette SATURATION ; touches assignables : KNEE ; page GAMMA / KNEE : molette WHITE CLIP.', 'Saturation vers 100 %, KNEE allumé, WHITE CLIP à 103 % : la trace rentre dans les losanges.'],
      auto: (c) => { const k = cam(c); k.paint.sat = 100; k.paint.kneeOn = true; k.paint.wclip = 103; },
    },
    {
      id: 'split', title: 'Le split diamant',
      say: 'Dans le diamant, les deux losanges se touchent par leur pointe noire : une valeur **sous le noir** dans le losange du haut tomberait dans celui du bas, invisible. Le **split diamant** les écarte : tout ce qui apparaît entre les deux est sous le noir.',
      do: 'Mets une autre tuile en Split diamant.',
      go: (c) => ({ station: 'vision', cam: c.mem.cam }), show: [tileSel],
      done: () => showing('vision', 'split'),
      ok: 'Rien entre les losanges : la caméra ne descend pas sous le noir. Sur une source extérieure (un duplex, un serveur), le split diamant attrape les sous-noirs (le SDI les transporte jusqu\'à −7 %) que le diamant cache.',
      hints: ['C\'est un affichage à part entière dans la liste des tuiles.', 'Choisis « Split diamant » dans la liste d\'une autre tuile.'],
      auto: () => { const i = PRISM.vision.tiles.findIndex((t) => t.app !== 'diamond'); setTile('vision', i < 0 ? 0 : i, { app: 'split' }); },
    },
    {
      id: 'quiz', title: 'Question',
      say: 'Pour finir, une question qui revient souvent au contrôle qualité.',
      quiz: { q: 'Un rouge très lumineux et saturé reste dans le cercle du vecteurscope mais sort du diamant. Il est…', choices: ['hors gamut en RVB : une composante dépasse 700 mV, elle sera écrêtée plus loin', 'légal : le vecteurscope ne montre aucun défaut', 'hors gamut en composite seulement : seul l\'arrowhead compte'], answer: 0, why: 'Le vecteurscope ne montre que la chrominance (Cb, Cr) et ignore la luminance : une couleur lumineuse et saturée peut y sembler raisonnable avec un R au-dessus de 700 mV. C\'est le diamant qui le voit. L\'arrowhead ne concerne que la sortie composite analogique.' },
    },
  ],
};

// ---------------- qualifier une liaison SDI ----------------
const ptOf = (c) => pointById(c.mem.pt);
/** @type {import('../engine.js').Lesson} */
const OEIL = {
  id: 'prism-oeil', domain: 'Liaisons, synchro et diffusion', stations: ['mesure'],
  title: 'Qualifier une liaison SDI au diagramme de l\'œil',
  summary: 'Exercice de la leçon « Longueur de câble et diagramme de l\'œil » : l\'œil de référence de la mire du SPG, l\'amplitude, l\'œil brut et l\'œil égalisé, puis une sortie de CCU qui fait des erreurs CRC, à trouver et à réparer avant la falaise.',
  duration: '12 min', level: 'intermédiaire',
  outro: 'Une liaison numérique ne prévient pas : parfaite, puis coupée. Ce qui prévient, ce sont les CRC et la marge. On qualifie chaque liaison à l\'installation (œil, longueur, CRC à zéro) et on surveille les CRC pendant le direct.',
  cleanupLabel: 'Réparer la liaison en panne',
  cleanup: (c) => { if (c.mem.pt && phyFaultAt(c.mem.pt)) repairLink(c.mem.pt, 'cordon'); },
  steps: [
    {
      id: 'intro', title: 'La couche physique',
      say: () => { const f = sdiStd(); return `Leçon « Longueur de câble et diagramme de l'œil » : le coaxial atténue d'autant plus que la fréquence est haute, l'égaliseur du récepteur rouvre l'œil jusqu'à son budget, puis l'image tombe d'un coup.\n\nLe waveform mesure l'**image** ; ici, on mesure le **signal** : en ${f.name}, un train de bits à ${f.rate} sur un câble coaxial de 75 Ω. Le câble atténue, les connecteurs renvoient des échos, l'horloge tremble : c'est la **couche physique**, le signal électrique avant qu'on lise ses bits.${S.ipMode ? '\n\nDans le car IP, les caméras arrivent en ST 2110 sur le réseau : seule la mire du SPG reste en coaxial. Pour la panne de cet exercice, refais-le dans le car SDI.' : ''}`; },
    },
    goStation('mesure', 'La baie de mesure est dans la zone technique, au bout de la rangée côté porte.', 'L\'instrument en grand ; dessous, les points de mesure et la liaison mesurée.'),
    {
      id: 'ref', title: 'L\'œil de référence',
      enter: () => { setPreset('mesure', 'vision'); setInput('mesure', 'pgm'); ensureVisible('mesure'); },
      say: 'Le **diagramme de l\'œil** superpose des milliers de bits du signal : plus l\'« œil » est ouvert au centre, plus le récepteur distingue facilement les 0 des 1.\n\nOn commence toujours par un signal connu : la sortie de test du **SPG** (le générateur de synchro), avec un cordon de 1 m. C\'est la mesure que décrit la norme.',
      do: 'Mets l\'instrument sur le point « MIRE SPG » et choisis le préréglage « Couche physique ».',
      go: { station: 'mesure' }, show: [{ sel: '#station .mz-points button.hw', text: 'MIRE SPG', label: 'point MIRE SPG' }, { sel: '#station .pz-sel', label: 'préréglages' }],
      done: () => PRISM.mesure.input === 'spg' && showing('mesure', 'eye'),
      ok: 'Voilà un œil de référence, grand ouvert : amplitude vers 800 mV, montée bien sous la limite, dépassement de quelques %. C\'est l\'étalon : on comparera les autres liaisons à lui.',
      hints: ['Dans « Points de mesure », la référence est la sortie de test du générateur de synchro. Il faut ensuite un affichage d\'œil.', 'Touche MIRE SPG, puis la liste « Préréglages… » en haut de l\'instrument : « Couche physique ».'],
      auto: () => { setInput('mesure', 'spg'); setPreset('mesure', 'phy'); ensureVisible('mesure'); },
    },
    {
      id: 'quizamp', title: 'L\'amplitude',
      say: 'Regarde la ligne « Amplitude » à côté de l\'œil.',
      quiz: { q: 'La norme fixe l\'amplitude d\'un signal SDI, à la sortie de l\'émetteur, à…', choices: ['800 mV ± 10 %, pour toutes les versions du SDI (HD, 3G, 12G)', '700 mV, comme le blanc du waveform', '1 V crête à crête, comme la vidéo analogique'], answer: 0, why: 'Le SDI fait 800 mV ± 10 % (720 à 880 mV). Les 700 mV du waveform sont une autre échelle : celle du contenu de l\'image, entre le noir et le blanc. Ne confonds pas le signal électrique et ce qu\'il transporte ; le 1 V de l\'analogique, synchronisation comprise, n\'a rien à voir non plus.' },
    },
    {
      id: 'brut', title: 'Brut ou égalisé',
      say: 'La norme définit l\'œil à la sortie de l\'émetteur. Après 80 m de 1694A en 3G (déjà 20 dB à 1,485 GHz, tout le budget que la norme garantit), l\'**œil brut** est fermé : c\'est normal, le câble atténue les hautes fréquences. Chaque récepteur a un **égaliseur** adaptatif qui les remonte et rouvre l\'œil : l\'**œil égalisé** montre ce que lit vraiment la grille.\n\nL\'instrument lit aussi le réglage de son égaliseur : il en déduit l\'**affaiblissement** du câble et sa **longueur** (tuile État SDI), et la **marge** qui reste.',
    },
    {
      id: 'find', title: 'Trouver la liaison malade',
      enter: (c) => { if (c.mem.pt) return; const k = pickFaultCam(); c.mem.cam = k ? k.id : (camIds(true)[0] || 1); c.mem.pt = 'ccu' + c.mem.cam; phyFault('cable', c.mem.pt, { ramp: 900, start: 0.6 }); },
      say: 'Le contrôle qualité de la chaîne nous signale des erreurs sur une caméra, mais rien de visible à l\'image pour l\'instant. Chaque ligne du signal porte un **CRC** (une somme de contrôle) : le récepteur la recalcule, et une différence veut dire une ligne arrivée fausse.\n\nÀ toi de trouver la liaison malade : passe les sorties caméras sur l\'instrument et regarde l\'état SDI (les CRC) et l\'œil.',
      do: 'Trouve la sortie caméra qui fait des erreurs CRC et mets-la sur l\'instrument.',
      go: { station: 'mesure' }, show: (c) => [{ sel: '#station .mz-points button.hw', text: ptOf(c) ? ptOf(c).short : 'CCU', label: 'la sortie en erreur' }],
      done: (c) => PRISM.mesure.input === c.mem.pt,
      ok: 'C\'est elle : des CRC qui montent, alors que l\'image paraît encore bonne. Le câble ne fait que quelques mètres, et pourtant la marge est presque nulle.',
      hints: ['Les points de mesure en erreur ont un liseré rouge en bas de leur touche.', 'Passe les sorties caméras une à une : celle dont la tuile État SDI compte des CRC et dont l\'œil a un dépassement de plus de 10 %.'],
      auto: (c) => setInput('mesure', c.mem.pt),
    },
    {
      id: 'eq', title: 'Lire l\'œil',
      say: 'Compare avec l\'œil de référence. En brut : le **dépassement** après chaque front passe au-dessus de 10 % (une rupture d\'impédance renvoie un écho), et la trace est bruitée. En égalisé : l\'œil se referme et la **gigue** (les fronts qui n\'arrivent plus tout à fait à l\'heure) monte.',
      do: 'Passe la tuile Diagramme de l\'œil en « Égalisé ».',
      go: { station: 'mesure' }, show: [opt('eq', 'true', 'bouton Égalisé'), tileSel],
      done: (c) => PRISM.mesure.input === c.mem.pt && showing('mesure', 'eye', (t) => !!t.eq),
      ok: 'L\'œil égalisé est petit : le récepteur de la grille est au bord de la falaise. Avec quelques mètres de câble, ce n\'est pas la longueur : c\'est le cordon ou son connecteur.',
      hints: ['La tuile Diagramme de l\'œil a deux boutons dans son bandeau.', 'Bouton « Égalisé » de la tuile Diagramme de l\'œil.'],
      auto: () => { const i = tileOf('mesure', 'eye'); setTile('mesure', i, { app: 'eye', eq: true }); },
    },
    {
      id: 'fix', title: 'Réparer',
      say: 'Câble court, marge presque nulle, dépassement trop fort : c\'est un défaut du cordon (connecteur mal serti, câble écrasé). Il s\'aggrave : si on attend, la caméra va disparaître du multiview.',
      do: 'Répare la liaison depuis le panneau « Liaison mesurée ».',
      go: { station: 'mesure' }, show: [{ sel: '#station .mz-fix button', text: 'Remplacer le cordon', label: 'remplacer le cordon' }],
      done: (c) => !phyFaultAt(c.mem.pt),
      ok: 'Œil rouvert, dépassement revenu à quelques %, plus de CRC. Remets les compteurs à zéro et surveille quelques minutes : un CRC qui revient, c\'est qu\'un autre maillon est fautif.',
      hints: ['Deux interventions possibles : changer le cordon, ou ajouter un répéteur. Lequel corrige un défaut qui est dans le cordon lui-même ?', 'Bouton « Remplacer le cordon » ; un répéteur ne servirait à rien, il recevrait le même signal abîmé.'],
      auto: (c) => repairLink(c.mem.pt, 'cordon'),
    },
    {
      id: 'quiz', title: 'L\'effet de falaise',
      say: 'Une question pour retenir pourquoi on surveille les CRC.',
      quiz: { q: 'Pourquoi la liaison faisait-elle des erreurs CRC alors que l\'image paraissait parfaite ?', choices: ['Effet de falaise : l\'image reste parfaite tant que presque tous les bits sont justes ; les CRC signalent les premières erreurs avant la coupure', 'Le CRC mesure le bruit de l\'image : il était simplement un peu sévère', 'Le waveform aurait dû montrer le défaut : l\'ingénieur vision l\'a manqué'], answer: 0, why: 'En numérique, chaque ligne arrive juste ou fausse ; quelques lignes fausses passent inaperçues, puis sur quelques dB tout s\'effondre. Le CRC ne dit rien du bruit de l\'image : il vérifie que chaque ligne est arrivée bit pour bit. Et le waveform mesure le contenu de l\'image, pas le signal électrique : il ne pouvait rien voir.' },
    },
    {
      id: 'quizlong', title: 'La longueur',
      say: () => `Dernière chose : la longueur. En ${sdiStd().name}, la norme garantit qu'un récepteur accepte ${sdiStd().loss} dB d'affaiblissement à la moitié de la fréquence d'horloge.`,
      quiz: { q: 'En 3G-SDI, la tuile État SDI d\'une caméra en coaxial affiche 26 dB d\'affaiblissement (environ 100 m de 1694A), sans aucune erreur CRC. Que fais-tu ?', choices: ['C\'est au-delà des 20 dB garantis par la norme : ça passe grâce à un bon égaliseur, sans marge garantie ; je prévois un répéteur ou une fibre avant le direct', 'Rien : pas de CRC, donc pas de problème', 'Je change le câble tout de suite : à 100 m, un coaxial 3G est forcément en panne'], answer: 0, why: 'Les 20 dB sont un minimum garanti : les égaliseurs actuels vont plus loin, mais sans promesse, et la marge fond avec la température, un connecteur ou un changement d\'appareil. Pas de CRC aujourd\'hui ne garantit rien pour le direct. Changer le câble pour le même câble ne raccourcirait rien.' },
    },
  ],
};

/** @type {import('../engine.js').Lesson[]} */
export const MESURE_LESSONS = [WFM, GAMUT, OEIL];

// @ts-check
import { el } from '../util.js';
import { NOTIONS, CHAPITRES, notionsDu } from './notions/index.js';
import { recordChapterQuiz, chapterQuizBest, acquises } from './progress.js';

// ----------------------------------------------------------------------------------
// Les questions du module caméra : le moule commun (une question, ses réponses, l'explication
// de chaque réponse, on peut réessayer mais seule la première réponse compte), utilisé par les
// trois questions d'Olivier de chaque fiche (fiche.js) et par le quiz de chaque chapitre (ici).
// Le quiz d'un chapitre mélange ses notions : chaque question dit de quelle notion elle relève
// (champ n), pour proposer la fiche à revoir après une erreur. Les chiffres sont ceux des fiches
// et des sources du module : Fujinon ZA12x4.5BERD (4,5–54 mm, f/1,8 jusqu'à 41 mm, f/2,4 à 54 mm,
// doubleur ×2, 0,3 m), mode d'emploi HXC-FB80 (FILTER CLEAR à 1/64, WHITE BAL, COLOR TEMP., menus,
// 600 m sur fibre hybride), ITU-R BT.709 (64–940 en 10 bits), EBU R 103 (−1 à 103 %), ITU-R BT.814
// (PLUGE), ITU-R BT.2100 et BT.2408 (HLG, blanc de référence à 75 %), SMPTE ST 292 et ST 424
// (HD-SDI 1,5 Gbit/s, 3G-SDI 3 Gbit/s).
// ----------------------------------------------------------------------------------

/** @typedef {import('./notions/index.js').Question & { n?: string }} QuestionChap */

/** @type {Record<number, QuestionChap[]>} */
export const QUIZ = {
  // ---- 1. L'objectif ----
  1: [
    {
      n: 'ramping', q: 'Iris grand ouvert (f/1,8), le cadreur serre de 30 à 54 mm. L\'image s\'assombrit un peu. Pourquoi ?',
      a: [
        ['C\'est le ramping : au-delà de 41 mm, l\'objectif n\'ouvre plus qu\'à f/2,4 à 54 mm.', 'Exact : de f/1,8 à f/2,4, la lumière baisse d\'environ 0,8 diaphragme. Iris réglé à f/2,8 ou plus fermé, rien ne bouge : l\'objectif tient cette ouverture jusqu\'au bout.'],
        ['La caméra baisse le gain pendant le zoom.', 'Le gain ne change jamais tout seul pendant un zoom : c\'est l\'objectif qui laisse passer moins de lumière au bout de sa course.'],
        ['Le tirage optique est mal réglé.', 'Un tirage faux rend l\'image floue en grand angle ; il ne change pas la lumière.'],
      ],
      ok: 0,
    },
    {
      n: 'doubleur', q: 'Le cadreur engage le doubleur ×2 du ZA12x4.5. Qu\'obtient-il ?',
      a: [
        ['Des focales de 9 à 108 mm, sans rien perdre.', 'La même lumière s\'étale sur une image deux fois plus grande en hauteur et en largeur : quatre fois moins de lumière par photosite.'],
        ['Des focales de 9 à 108 mm, et deux diaphragmes de lumière en moins.', 'Exact : la focale double, le nombre f aussi (f/1,8 devient f/3,6). Il faut ouvrir l\'iris de deux crans ou ajouter de la lumière, et l\'image est un peu moins piquée.'],
        ['Des focales de 4,5 à 108 mm.', 'Toutes les focales sont doublées, la plus courte aussi : le grand angle devient 9 mm.'],
      ],
      ok: 1,
    },
    {
      n: 'pdc', q: 'Le cadreur fait le point en plan large à 4,5 mm, puis serre à 54 mm sur le présentateur : il est flou. Que s\'est-il passé ?',
      a: [
        ['En large, la profondeur de champ cachait l\'erreur de point ; à 54 mm, elle fond.', 'Exact : à 4,5 mm, tout paraît net de quelques dizaines de centimètres à l\'infini. On fait le point en serré, puis on élargit.'],
        ['Le zoom n\'est pas parfocal.', 'Un zoom de télévision est parfocal quand son tirage est juste. Ici, le point n\'a jamais été fait : en large, tout paraissait net.'],
        ['L\'iris s\'est fermé pendant le zoom.', 'L\'iris ne se ferme pas tout seul ; et un iris plus fermé donnerait plus de profondeur de champ, pas moins.'],
      ],
      ok: 0,
    },
    {
      n: 'tirage', q: 'Pourquoi la bague de point ne peut-elle pas rattraper un tirage faux en grand angle ?',
      a: [
        ['Parce qu\'elle est bloquée en grand angle.', 'La bague de point tourne à toutes les focales : c\'est son effet qui change avec la focale.'],
        ['Parce que le tirage se règle dans le menu de la caméra.', 'Le tirage se règle sur l\'objectif, avec la bague F.f et sa vis de blocage ; aucun menu ne le corrige.'],
        ['Parce que son effet sur la position de l\'image varie comme le carré de la focale : (54 ÷ 4,5)² = 144 fois moins à 4,5 mm qu\'à 54 mm.', 'Exact : en large, elle n\'agit presque plus. La bague F.f, qui agit autant à toutes les focales, règle la netteté en grand angle.'],
      ],
      ok: 2,
    },
    {
      n: 'monture', q: 'Que passe par le câble 12 broches de l\'objectif, branché sur la caméra ?',
      a: [
        ['L\'image formée par l\'objectif.', 'L\'image passe en lumière, par la monture, jusqu\'au prisme : aucun câble ne la transporte.'],
        ['Le son du micro de la caméra.', 'Le micro se branche sur les entrées audio de la caméra, pas sur l\'objectif.'],
        ['L\'alimentation du servo, la commande de l\'iris et les données de l\'objectif (zoom, point).', 'Exact : c\'est par ce câble que la vision commande l\'iris depuis le RCP, et que la caméra affiche la position du zoom dans le viseur.'],
      ],
      ok: 2,
    },
    {
      n: 'defauts', q: 'Au bord du cadre, un liseré violet borde un contour très contrasté ; au centre de l\'image, rien. D\'où vient-il ?',
      a: [
        ['D\'un capteur décalé dans le bloc prisme.', 'Un capteur décalé donne le même liseré partout, au centre comme au bord : c\'est un défaut de registration, pour la maintenance.'],
        ['De l\'aberration chromatique de l\'objectif.', 'Exact : nulle au centre, plus forte vers les bords et avec le doubleur ; la caméra en corrige une partie (ALAC).'],
        ['D\'une balance des blancs mal faite.', 'Une balance fausse teinte toute l\'image, les blancs comme les gris, pas seulement les contours au bord.'],
      ],
      ok: 1,
    },
  ],
  // ---- 2. Les filtres et le prisme ----
  2: [
    {
      n: 'nd', q: 'Sur le plateau, on expose à f/5,6 sans filtre. Dehors, en plein soleil, il y a soixante-quatre fois plus de lumière. Quel filtre pour garder f/5,6 ?',
      a: [
        ['Le 1/4 ND.', 'Deux diaphragmes seulement : il en manquerait quatre, au-delà de f/16.'],
        ['Le 1/16 ND.', 'Quatre diaphragmes : il en manque deux, l\'iris devrait fermer à f/11.'],
        ['Le 1/64 ND.', 'Exact : soixante-quatre fois moins de lumière, six diaphragmes ; l\'iris reste à sa meilleure place.'],
      ],
      ok: 2,
    },
    {
      n: 'cc', q: 'Balancée pour la lumière du jour, la caméra filme sous des projecteurs tungstène. L\'image vire à l\'orange. Pourquoi ?',
      a: [
        ['La lumière tungstène (3200 K) a plus de rouge et moins de bleu que celle du jour (5600 K) : la caméra la rend telle quelle.', 'Exact : on refait la balance des blancs sous cette lumière, ou on passe au préréglage 3200 K.'],
        ['Les projecteurs chauffent le capteur rouge.', 'La température de couleur décrit la couleur de la lumière, pas la chaleur que reçoit la caméra.'],
        ['Le filtre ND est resté en place.', 'Un ND est gris neutre : il assombrit l\'image, il ne la colore pas.'],
      ],
      ok: 0,
    },
    {
      n: 'prisme', q: 'Dans le bloc prisme, qu\'arrive-t-il à la lumière qui va vers le capteur vert ?',
      a: [
        ['Elle traverse un verre vert qui absorbe le rouge et le bleu.', 'Le prisme n\'absorbe pas : ses couches dichroïques réfléchissent le bleu puis le rouge vers leurs capteurs, sans les perdre.'],
        ['Elle continue tout droit, une fois le bleu puis le rouge renvoyés vers leurs capteurs par les deux surfaces dichroïques.', 'Exact : chacun des trois capteurs reçoit l\'image complète de sa couleur, en 1920 × 1080.'],
        ['Elle n\'éclaire qu\'un photosite sur deux, comme dans une matrice de Bayer.', 'C\'est le principe du capteur unique. Ici, chaque capteur reçoit toute l\'image de sa couleur.'],
      ],
      ok: 1,
    },
    {
      n: 'olpf', q: 'À quoi sert le filtre passe-bas optique placé devant les capteurs ?',
      a: [
        ['À arrêter l\'infrarouge.', 'C\'est l\'autre filtre posé devant les capteurs, le filtre infrarouge.'],
        ['À retirer de la lumière, comme un ND.', 'Il ne retire presque pas de lumière : il adoucit l\'image d\'une fraction de photosite.'],
        ['À adoucir très légèrement l\'image, pour qu\'un motif plus fin que les photosites ne fasse pas de moiré.', 'Exact : sans lui, une veste à fines rayures ou une grille du décor ferait apparaître de fausses ondulations.'],
      ],
      ok: 2,
    },
    {
      n: 'cc', q: 'Sur la HXC-FB80, comment adapte-t-on vite la caméra à la lumière du jour, sans faire de balance ?',
      a: [
        ['On tourne la roue de filtres sur un filtre bleu.', 'La roue de la FB80 ne porte que des ND : la conversion de couleur y est électronique.'],
        ['WHITE BAL sur PRST et le bouton COLOR TEMP. : le préréglage passe de 3200 à 5600 K.', 'Exact : ça dépanne. Une balance mesurée sur un carton reste plus juste, aucune lumière n\'est exactement à 5600 K.'],
        ['On monte de 6 dB le gain de la voie bleue au RCP.', 'Ce serait une balance faite à la main, à l\'aveugle : le préréglage existe pour ça, et la balance automatique mesure.'],
      ],
      ok: 1,
    },
  ],
  // ---- 3. Les capteurs ----
  3: [
    {
      n: 'gain', q: 'Que donne +6 dB de gain ?',
      a: [
        ['Un signal deux fois plus fort, comme un diaphragme de plus, mais plus de bruit.', 'Exact : +6 dB double le signal (20 × log 2 ≈ 6), et le bruit avec lui. Le gain n\'ajoute aucune lumière.'],
        ['Un diaphragme de plus, sans inconvénient.', 'Le gain amplifie le signal et le bruit ensemble : l\'image devient plus granuleuse, surtout dans les ombres.'],
        ['Deux diaphragmes de plus.', 'Deux diaphragmes, c\'est quatre fois plus de signal : +12 dB.'],
      ],
      ok: 0,
    },
    {
      n: 'shutter', q: 'Un écran LED du décor scintille et fait des bandes dans l\'image. Quel réglage essaie-t-on ?',
      a: [
        ['Monter le gain.', 'Le gain éclaircit l\'image ; il ne change pas le moment où chaque image est prise, donc pas le scintillement.'],
        ['Le clear scan : un shutter réglé finement sur la fréquence de rafraîchissement de l\'écran.', 'Exact : la durée d\'exposition se cale sur le cycle de l\'écran, et les bandes disparaissent.'],
        ['Un shutter très court, 1/1000 s.', 'Plus court, chaque image saisit une plus petite partie du cycle de l\'écran : le scintillement se voit souvent davantage, et le mouvement saccade.'],
      ],
      ok: 1,
    },
    {
      n: 'shutter', q: 'En 1080i50, on passe le shutter de 1/50 à 1/500 s. Que devient l\'image d\'un joueur qui court ?',
      a: [
        ['Plus fluide : il y a moins de flou de bougé.', 'Moins de flou dans chaque image, oui ; mais entre deux images, plus rien n\'est enregistré : le mouvement paraît haché.'],
        ['Inchangée : le shutter ne règle que la luminosité.', 'Il règle la durée d\'exposition : la lumière, mais aussi le flou de bougé et la fluidité.'],
        ['Plus nette dans chaque image mais saccadée, et dix fois moins éclairée : plus de trois diaphragmes à rattraper.', 'Exact : 1/500 s dure dix fois moins que 1/50 s, soit 3,3 diaphragmes.'],
      ],
      ok: 2,
    },
    {
      n: 'exposition', q: 'Le plateau manque de lumière ; l\'iris est à f/2,8 et le filtre sur 1/4 ND. Dans quel ordre agir ?',
      a: [
        ['Monter le gain d\'abord, c\'est le plus rapide.', 'Le gain coûte du bruit : c\'est le dernier recours, quand il n\'y a plus de lumière à prendre.'],
        ['Retirer le ND, ouvrir l\'iris si la profondeur de champ le permet, demander de la lumière, et le gain en dernier.', 'Exact : chaque réglage a son prix. On commence par ceux qui ne coûtent rien à l\'image.'],
        ['Allonger le shutter à 1/25 s.', 'À 50 images ou trames par seconde, chacune dure 1/50 s : l\'exposition ne peut pas durer plus longtemps sans changer la cadence.'],
      ],
      ok: 1,
    },
    {
      n: 'capteur', q: 'La caméra donne F13 à 2000 lux. Le plateau est éclairé à 500 lux. Quel iris pour une exposition aussi juste, sans gain ?',
      a: [
        ['f/26.', 'Quand la lumière baisse, on ouvre l\'iris : son nombre f diminue.'],
        ['f/3,2.', 'Ce serait pour seize fois moins de lumière, quatre diaphragmes : 13 ÷ 4.'],
        ['f/6,5.', 'Exact : quatre fois moins de lumière, c\'est deux diaphragmes, et le nombre f est divisé par deux : 13 ÷ 2 = 6,5.'],
      ],
      ok: 2,
    },
    {
      n: 'formats', q: 'Quelle différence entre 1080i50 et 1080p50 ?',
      a: [
        ['En 1080i50, 50 trames par seconde portent chacune une ligne sur deux (25 images complètes) ; en 1080p50, 50 images complètes par seconde.', 'Exact : le 1080p50 demande deux fois plus de débit, d\'où la 3G-SDI (3 Gbit/s) au lieu de la HD-SDI (1,5 Gbit/s).'],
        ['Le 1080p50 a deux fois plus de lignes.', 'Les deux ont 1080 lignes ; c\'est le nombre d\'images complètes par seconde qui double.'],
        ['Aucune : i et p ne désignent que le type de fichier.', '« i » veut dire entrelacé, « p » progressif : c\'est la façon dont l\'image est balayée et transportée.'],
      ],
      ok: 0,
    },
  ],
  // ---- 4. Le traitement de l'image ----
  4: [
    {
      n: 'quantif', q: 'En 10 bits, quels codes reçoivent le noir et le blanc de l\'image ?',
      a: [
        ['0 et 1023.', 'Les codes 0 à 3 et 1020 à 1023 sont réservés à la synchronisation du signal SDI ; l\'image garde de la marge sous le noir et au-dessus du blanc.'],
        ['64 pour le noir, 940 pour le blanc.', 'Exact (ITU-R BT.709) : au-dessus de 940, les codes jusqu\'à 1019 laissent passer un dépassement jusqu\'à environ 109 %.'],
        ['16 et 235.', 'Ce sont les mêmes niveaux écrits en 8 bits : 64 ÷ 4 = 16 et 940 ÷ 4 = 235.'],
      ],
      ok: 1,
    },
    {
      n: 'balance', q: 'Pourquoi tient-on le carton de la balance des blancs sous la lumière principale, au centre du cadre ?',
      a: [
        ['Parce que la caméra mesure le blanc au centre de l\'image, et qu\'il doit recevoir la même lumière que le sujet.', 'Exact : un carton dans l\'ombre ou sous une autre lampe donnerait la balance d\'une autre lumière.'],
        ['Parce que le carton sert aussi à la balance des noirs.', 'La balance des noirs se fait iris fermé : la caméra n\'a besoin d\'aucune image.'],
        ['Parce qu\'il faut un blanc écrêté à 100 % pour que la mesure marche.', 'C\'est l\'inverse : un blanc écrêté fait échouer l\'AWB. Il doit être bien exposé, vers 80 %.'],
      ],
      ok: 0,
    },
    {
      n: 'noir', q: 'Le master black est réglé trop haut. Que devient l\'image ?',
      a: [
        ['Les ombres se bouchent.', 'C\'est l\'effet d\'un master black trop bas : les détails sombres tombent dans le noir.'],
        ['Elle devient plus contrastée.', 'C\'est l\'inverse : un noir trop haut réduit l\'écart entre le noir et le blanc.'],
        ['Elle se délave : les noirs deviennent gris.', 'Exact : on cale le noir à la forme d\'onde, sur le niveau de référence, et toutes les caméras sur le même.'],
      ],
      ok: 2,
    },
    {
      n: 'knee', q: 'Une fenêtre très claire derrière le présentateur. Quel réglage garde du détail dans la fenêtre sans assombrir le visage ?',
      a: [
        ['Le knee : au-dessus de son point de coude, les hautes lumières sont comprimées au lieu d\'être écrêtées.', 'Exact : le visage, vers 60 à 70 %, reste sous le coude et ne bouge pas ; la fenêtre garde un peu de matière.'],
        ['Le white clip, abaissé à 90 %.', 'Le white clip coupe tout ce qui dépasse son niveau : la fenêtre deviendrait un aplat blanc, encore plus tôt.'],
        ['Fermer l\'iris.', 'La fenêtre retrouverait du détail, mais le visage s\'assombrirait d\'autant.'],
      ],
      ok: 0,
    },
    {
      n: 'detail', q: 'Que fait le détail des carnations (skin detail) ?',
      a: [
        ['Il ajoute du contour sur les visages pour les rendre plus nets.', 'C\'est l\'inverse : il retire du détail là où on n\'en veut pas.'],
        ['Il réduit le détail sur les seules teintes de peau choisies, pour adoucir les visages sans adoucir le reste.', 'Exact : le décor garde son piqué ; les rides et le grain de la peau se voient moins.'],
        ['Il corrige la couleur de la peau.', 'La couleur se règle par la balance et la matrice ; le skin detail ne touche qu\'au contour ajouté.'],
      ],
      ok: 1,
    },
    {
      n: 'matrice', q: 'Deux caméras ne rendent pas le même rouge sur un maillot, alors que leurs blancs sont justes. Que règle-t-on, et comment garde-t-on le réglage ?',
      a: [
        ['On refait la balance des blancs, et on n\'éteint plus la caméra.', 'La balance règle le blanc (R = V = B) ; elle ne corrige pas une teinte particulière. Et un réglage se garde dans un fichier, pas en laissant la caméra allumée.'],
        ['On baisse le gamma de la caméra la plus rouge.', 'Le gamma répartit les tons du noir au blanc ; il ne déplace pas une teinte.'],
        ['La matrice de couleurs, puis on enregistre le réglage dans un fichier de scène.', 'Exact : la matrice raccorde les couleurs des caméras ; le fichier de scène (menu FILE) le retrouve le lendemain.'],
      ],
      ok: 2,
    },
  ],
  // ---- 5. Le corps de la caméra ----
  5: [
    {
      n: 'tally', q: 'La lampe rouge du tally s\'allume dans le viseur. Qu\'est-ce que ça veut dire pour le cadreur ?',
      a: [
        ['Sa caméra est à l\'antenne : pas de recadrage brusque, pas de point qui cherche.', 'Exact : le rouge, c\'est « tu es au programme » ; le vert, « tu es prêt », en préparation.'],
        ['La vision l\'appelle.', 'L\'appel, c\'est CALL : une lampe d\'appel, pas le tally.'],
        ['Sa caméra est en préparation.', 'La préparation (preview) allume le tally vert ; le rouge, c\'est l\'antenne.'],
      ],
      ok: 0,
    },
    {
      n: 'tally', q: 'Le cadreur veut parler à l\'ingénieur de la vision, pas au réalisateur. Quel canal d\'intercom ?',
      a: [
        ['PROD.', 'PROD, c\'est la production : le réalisateur et la scripte.'],
        ['ENG.', 'Exact : ENG (engineering), c\'est la technique : la vision, le chef de car.'],
        ['CALL.', 'CALL allume une lampe au RCP pour attirer l\'attention ; ce n\'est pas un canal de parole.'],
      ],
      ok: 1,
    },
    {
      n: 'alimentation', q: 'La caméra doit travailler à 1 km de sa CCU. Comment l\'alimente-t-on ?',
      a: [
        ['Par la fibre hybride, comme à 100 m.', 'La CCU n\'alimente la FB80 par la fibre hybride que jusqu\'à 600 m environ : au-delà, le cuivre du câble fait trop chuter la tension.'],
        ['Par le câble de l\'objectif.', 'Le câble de l\'objectif part de la caméra : c\'est elle qui alimente l\'objectif, pas l\'inverse.'],
        ['Sur fibre monomode, avec une alimentation sur place par DC IN.', 'Exact : la lumière va jusqu\'à 10 km environ ; l\'énergie, elle, doit venir d\'un bloc secteur ou d\'une batterie près de la caméra.'],
      ],
      ok: 2,
    },
    {
      n: 'retours', q: 'Le réalisateur veut que le cadreur voie le programme dans son viseur. Qu\'utilise-t-on ?',
      a: [
        ['Le tally.', 'Le tally dit si la caméra est à l\'antenne ; il ne montre pas d\'image.'],
        ['VF OUT sur G.', 'VF OUT choisit la voie de la caméra que montre le viseur (couleur, luminance, R, V, B), pas une image venue de la régie.'],
        ['Le retour vidéo : RET affiche dans le viseur l\'image renvoyée par la régie (RET 1 ou RET 2 SEL).', 'Exact : la régie l\'envoie par la fibre, avec l\'intercom et le tally.'],
      ],
      ok: 2,
    },
    {
      n: 'commandes', q: 'Caméra reliée à sa CCU et au RCP : qui règle l\'iris et la balance des blancs pendant l\'émission ?',
      a: [
        ['Le cadreur, avec les commandes du côté de la caméra.', 'Reliée à la CCU, la caméra obéit au RCP pour la peinture de l\'image ; le cadreur garde le cadre, le zoom et le point.'],
        ['La vision, au RCP, à distance.', 'Exact : l\'ingénieur de la vision expose et équilibre toutes les caméras de la même façon, l\'œil sur la forme d\'onde.'],
        ['La CCU, toute seule, en automatique.', 'Rien n\'est automatique pendant une émission : un iris automatique ferait « pomper » l\'image.'],
      ],
      ok: 1,
    },
    {
      n: 'menu', q: 'Le cadreur veut retrouver d\'un geste les pages du menu qu\'il règle tout le temps : zebra, marqueurs, VF OUT. Que fait-il ?',
      a: [
        ['Il se compose un menu USER avec ces pages.', 'Exact : le menu USER regroupe les pages choisies, sans passer par le menu OPERATION à chaque fois.'],
        ['Il les enregistre dans le fichier de scène.', 'Le fichier de scène garde la peinture de l\'image ; les réglages du viseur et du cadreur ont leur propre fichier (OPERATOR FILE).'],
        ['Il demande à la vision de les régler au RCP.', 'Ce sont les réglages du cadreur, dans le menu de la caméra : la vision ne règle pas son viseur.'],
      ],
      ok: 0,
    },
  ],
  // ---- 6. Le viseur et le cadreur ----
  6: [
    {
      n: 'viseur', q: 'Comment règle-t-on la luminosité et le contraste du viseur ?',
      a: [
        ['Sur l\'image du plateau, à l\'œil, jusqu\'à ce qu\'elle soit belle.', 'Sur une image, on ne sait pas où devrait être le noir ni le blanc : on réglerait le viseur selon la scène.'],
        ['Sur les barres : la luminosité pour que le noir soit juste noir, le contraste pour que chaque barre se distingue sans éblouir.', 'Exact : un viseur réglé sur les barres montre l\'image telle qu\'elle est. Ces réglages ne changent rien à l\'image envoyée.'],
        ['À la forme d\'onde, en regardant le signal monter.', 'La forme d\'onde mesure le signal de la caméra ; le viseur n\'y change rien, elle ne peut pas servir à le régler.'],
      ],
      ok: 1,
    },
    {
      n: 'viseur', q: 'Le peaking du viseur sert à…',
      a: [
        ['souligner les contours nets, pour faire le point.', 'Exact : il n\'agit que sur l\'affichage du viseur ; l\'image envoyée ne change pas.'],
        ['montrer les zones trop exposées.', 'Ça, c\'est le zebra.'],
        ['rendre l\'image envoyée plus piquée.', 'Le contour de l\'image envoyée, c\'est le détail, au menu PAINT ou au RCP ; le peaking ne quitte pas le viseur.'],
      ],
      ok: 0,
    },
    {
      n: 'viseur', q: 'ZEBRA1 réglé à 70 %, largeur 10 % : où se posent les hachures ?',
      a: [
        ['Sur tout ce qui dépasse 70 %.', 'Avec une largeur, le zebra hachure une bande autour du niveau choisi, pas tout ce qui est au-dessus.'],
        ['Sur ce qui est entre 65 et 75 % environ : un visage bien exposé.', 'Exact : le cadreur voit d\'un coup d\'œil si le visage est à sa place, sans forme d\'onde.'],
        ['Sur les zones écrêtées à 100 %.', 'Pour l\'écrêtage, on se sert du ZEBRA2, réglé vers 100 %.'],
      ],
      ok: 1,
    },
    {
      n: 'viseur', q: 'Le cadreur appuie sur MAG pendant qu\'il fait le point. Que se passe-t-il ?',
      a: [
        ['Le zoom de l\'objectif serre au maximum.', 'MAG ne touche pas à l\'objectif : c\'est une loupe de l\'affichage.'],
        ['L\'image envoyée à la régie est agrandie.', 'Seul le viseur est agrandi : la régie voit toujours le cadre normal.'],
        ['Le viseur grossit le centre de l\'image pour mieux juger la netteté ; l\'image envoyée ne change pas.', 'Exact : c\'est l\'aide la plus sûre pour le point et le tirage, avec le peaking.'],
      ],
      ok: 2,
    },
    {
      n: 'cadreur', q: 'Sur la tête fluide, la caméra pique du nez dès qu\'on lâche les manches. Que fait-on ?',
      a: [
        ['On serre la friction d\'inclinaison.', 'La friction freine le mouvement, elle ne compense pas un déséquilibre : la caméra continuerait de piquer, plus lentement.'],
        ['On recule la caméra sur sa plaque jusqu\'à ce qu\'elle tienne seule à l\'horizontale, puis on règle le contrepoids.', 'Exact : le centre de gravité doit passer au-dessus de l\'axe d\'inclinaison ; les frictions se règlent en dernier, au goût du cadreur.'],
        ['On verrouille l\'inclinaison pendant l\'émission.', 'Une tête verrouillée ne cadre plus : l\'équilibre se règle, il ne se bloque pas.'],
      ],
      ok: 1,
    },
    {
      n: 'cadreur', q: 'Sur un pied de plateau, où sont les commandes reportées de l\'objectif ?',
      a: [
        ['Le zoom sous le pouce, sur le manche droit ; le point à la manivelle, sur le manche gauche.', 'Exact : les deux mains restent sur les manches, le cadre et le point en même temps.'],
        ['Les deux sur le manche droit.', 'Une main ne peut pas tenir le zoom, le point et le panoramique à la fois : chaque manche a sa commande.'],
        ['Sur la poignée de l\'objectif seulement.', 'La poignée sert à l\'épaule ; sur un pied, les commandes sont reportées sur les manches et branchées au servo.'],
      ],
      ok: 0,
    },
  ],
  // ---- 7. La voie caméra ----
  7: [
    {
      n: 'fibre', q: 'À la CCU, le niveau optique reçu est de −19 dBm. Qu\'en pensez-vous ?',
      a: [
        ['Très bon : plus le nombre est négatif, mieux c\'est.', 'C\'est l\'inverse : −19 dBm, c\'est très peu de lumière. En exploitation, on lit entre −5 et −15 dBm.'],
        ['La liaison est au bord du décrochage (vers −20 dBm) : on inspecte et on nettoie les connecteurs.', 'Exact : une poussière sur un connecteur coûte plusieurs décibels. La liaison passe encore, mais elle risque de décrocher pendant l\'émission.'],
        ['Sans importance tant que l\'image passe.', 'Le numérique passe parfaitement jusqu\'à la falaise, puis plus du tout : le niveau dit la marge qui reste.'],
      ],
      ok: 1,
    },
    {
      n: 'genlock', q: 'Pourquoi la CCU reçoit-elle la référence de la régie (black burst ou tri-level) ?',
      a: [
        ['Pour que l\'image de la caméra commence en même temps que celle des autres sources, et que le mélangeur coupe proprement.', 'Exact : c\'est le genlock. Sans lui, chaque commutation ferait sauter l\'image.'],
        ['Pour régler la couleur de la caméra.', 'La référence ne porte que la synchronisation ; la couleur se règle à la balance et à la matrice.'],
        ['Pour alimenter la caméra.', 'L\'énergie vient de la CCU par le cuivre de la fibre hybride ; la référence est un signal, pas une alimentation.'],
      ],
      ok: 0,
    },
    {
      n: 'sortie', q: 'Qu\'envoie la CCU vers la grille et le mélangeur ?',
      a: [
        ['Du RVB 4:4:4 en 8 bits.', 'Le RVB reste dans la caméra : en sortie, on transporte la luminance et deux différences de couleur, sur 10 bits.'],
        ['Un signal analogique composite.', 'Le composite appartient aux anciennes régies ; la sortie de la CCU est numérique.'],
        ['Du SDI : Y\'CbCr 4:2:2 sur 10 bits, en HD-SDI (1,5 Gbit/s) ou en 3G-SDI (3 Gbit/s) pour le 1080p50.', 'Exact : le son y est embarqué ; la grille l\'aiguille ensuite vers le mélangeur et les moniteurs.'],
      ],
      ok: 2,
    },
    {
      n: 'rcp', q: 'Au RCP, que règle le joystick ?',
      a: [
        ['L\'iris quand on le pousse, le master black quand on tourne sa bague.', 'Exact : la vision expose et cale le noir d\'une seule main, l\'œil sur la forme d\'onde.'],
        ['Le zoom et le point de l\'objectif.', 'Ce sont les commandes du cadreur, reportées sur les manches du pied.'],
        ['La balance des blancs.', 'Les balances ont leurs touches (AUTO WHITE, AUTO BLACK) et leurs molettes de rouge et de bleu.'],
      ],
      ok: 0,
    },
    {
      n: 'lineup', q: 'Pourquoi fait-on le line-up de toutes les caméras avant l\'émission ?',
      a: [
        ['Pour vérifier que chaque caméra a son tally.', 'Le tally se teste aussi, mais le line-up porte sur l\'image.'],
        ['Pour que chaque caméra soit exposée au maximum.', 'Le line-up règle les caméras pareil, pas au maximum : même noir, même blanc.'],
        ['Pour couper de l\'une à l\'autre sans que le noir, le blanc ou les couleurs changent.', 'Exact : mêmes balances sur la même charte, même noir, même gamma, des couleurs raccordées.'],
      ],
      ok: 2,
    },
    {
      n: 'ccu', q: 'Dans la voie caméra, quel est le rôle de la CCU ?',
      a: [
        ['Elle enregistre l\'image de la caméra.', 'Elle ne garde rien : l\'enregistrement se fait au serveur de ralenti ou à l\'enregistreur, après la grille.'],
        ['Elle alimente la caméra, reçoit son image par la fibre et la sort en SDI, calée sur la référence de la régie.', 'Exact : elle relaie aussi les commandes du RCP, le retour, l\'intercom et le tally vers la caméra.'],
        ['Elle mélange les images des caméras.', 'Le mélange se fait au mélangeur ; chaque caméra a sa propre CCU.'],
      ],
      ok: 1,
    },
  ],
  // ---- 8. Jusqu'au moniteur ----
  8: [
    {
      n: 'waveform', q: 'Sur la forme d\'onde, le visage du présentateur monte à 85 %. Que faire ?',
      a: [
        ['Rien : il est sous 100 %.', 'Il n\'est pas écrêté, mais un visage se place vers 60 à 70 % : à 85 %, il est surexposé et perd son modelé.'],
        ['Fermer un peu l\'iris, pour ramener le visage vers 60 à 70 %.', 'Exact : on expose sur ce qui compte, le visage, en surveillant que les blancs restent sous 100 %.'],
        ['Monter le master black.', 'Le master black déplace le noir, pas le visage : l\'image se délaverait.'],
      ],
      ok: 1,
    },
    {
      n: 'waveform', q: 'Pourquoi surveille-t-on, en plus des 100 %, la limite de 103 % ?',
      a: [
        ['Au-dessus, le signal sort de ce que la diffusion admet (EBU R 103) : il sera écrêté plus loin dans la chaîne.', 'Exact : la luminance doit rester entre −1 et 103 % ; les diffuseurs le vérifient.'],
        ['Au-dessus de 103 %, la caméra coupe sa sortie.', 'La caméra sort le signal tel quel ; ce sont les étapes suivantes qui l\'écrêtent.'],
        ['C\'est une habitude, sans norme derrière.', 'C\'est la recommandation EBU R 103 sur les niveaux des signaux de télévision.'],
      ],
      ok: 0,
    },
    {
      n: 'vecto', q: 'Sur le vectorscope, que dit la distance d\'un point au centre ?',
      a: [
        ['Sa luminosité.', 'La luminosité se lit sur la forme d\'onde ; le vectorscope ne montre que la couleur.'],
        ['Sa teinte.', 'La teinte, c\'est l\'angle autour du centre : rouge, jaune, vert, cyan, bleu, magenta.'],
        ['Sa saturation : plus le point est loin du centre, plus la couleur est vive ; un blanc ou un gris reste au centre.', 'Exact : c\'est là qu\'on vérifie une balance des blancs, un blanc ramassé au centre.'],
      ],
      ok: 2,
    },
    {
      n: 'vecto', q: 'Sur le vectorscope, où tombent les carnations d\'une peau bien rendue ?',
      a: [
        ['Près de la ligne des carnations, entre le jaune et le rouge, quelle que soit la couleur de peau.', 'Exact : d\'une peau à l\'autre, c\'est surtout la saturation qui change. Une teinte qui s\'écarte de la ligne trahit une balance ou une matrice.'],
        ['Au centre, comme un gris.', 'Au centre, il n\'y a pas de couleur du tout : une peau a toujours une teinte.'],
        ['Dans la cible du bleu.', 'Une peau n\'est jamais bleue : une carnation qui part vers le bleu, c\'est une balance des blancs ratée.'],
      ],
      ok: 0,
    },
    {
      n: 'moniteur', q: 'À quoi sert la mire PLUGE ?',
      a: [
        ['À tester la sortie de la caméra.', 'La PLUGE est un signal de réglage du moniteur, pas un test de la caméra.'],
        ['À régler la luminosité du moniteur : la bande juste au-dessus du noir se devine, celle juste en dessous se confond avec lui.', 'Exact (ITU-R BT.814) : le noir du moniteur est alors à sa place, ni gris ni bouché.'],
        ['À régler la couleur du moniteur.', 'La couleur se vérifie en bleu seul, sur les barres.'],
      ],
      ok: 1,
    },
    {
      n: 'mires', q: 'Quelle mire pour régler le tirage de l\'objectif ?',
      a: [
        ['Les barres de couleur.', 'Les barres sortent du générateur de la caméra : elles ne passent pas par l\'objectif.'],
        ['La charte grise.', 'La charte grise sert à la balance et à l\'exposition ; elle n\'a pas de détail fin pour juger la netteté.'],
        ['L\'étoile de Siemens.', 'Exact : ses branches se resserrent vers le centre, et la moindre perte de netteté y fait une tache grise.'],
      ],
      ok: 2,
    },
  ],
  // ---- 9. Pour aller plus loin ----
  9: [
    {
      n: 'grandcapteur', q: 'À cadre égal et à même iris, pourquoi une caméra Super 35 a-t-elle moins de profondeur de champ qu\'une caméra 2/3" ?',
      a: [
        ['Parce que son capteur est moins sensible.', 'La sensibilité ne change pas la zone nette ; c\'est l\'optique qui la fixe.'],
        ['Parce que, pour le même cadre, il faut une focale environ deux fois et demie plus longue, et la zone nette fond avec la focale.', 'Exact : un capteur de près de 25 mm de large contre 9,6 mm. Même cadre, même iris : une profondeur de champ environ 2,5 fois plus mince.'],
        ['Parce qu\'elle n\'a qu\'un capteur au lieu de trois.', 'Le nombre de capteurs ne change rien à la zone nette : c\'est la taille du capteur, donc la focale, qui compte.'],
      ],
      ok: 1,
    },
    {
      n: 'grandcapteur', q: 'Pourquoi le direct sportif garde-t-il souvent le tri-capteur 2/3" ?',
      a: [
        ['Pour ses zooms aux très grands rapports (86×, 100× et plus) et sa profondeur de champ confortable, qui aide à suivre le jeu.', 'Exact : un grand capteur demanderait des objectifs bien plus gros pour le même rapport, et un point bien plus difficile à tenir.'],
        ['Parce qu\'un grand capteur ne sait pas faire de HD.', 'Les caméras grand capteur font la HD, l\'UHD et plus.'],
        ['Parce que le tri-capteur coûte moins cher.', 'Un bloc prisme et trois capteurs coûtent plus cher qu\'un capteur unique : ce n\'est pas le prix qui décide.'],
      ],
      ok: 0,
    },
    {
      n: 'hdr', q: 'En HLG (ITU-R BT.2100), à quel niveau du signal place-t-on le blanc de référence, celui d\'un papier blanc ou des graphiques ?',
      a: [
        ['À 100 %, comme en SDR.', 'En HLG, on garde la place au-dessus du blanc pour les hautes lumières : reflets, ciel, projecteurs.'],
        ['À 50 %.', 'Bien trop bas : tout le reste de l\'image suivrait, et elle paraîtrait éteinte.'],
        ['À 75 % (ITU-R BT.2408).', 'Exact : les hautes lumières vont de 75 à 100 % ; c\'est ce qui donne son relief à l\'image HDR.'],
      ],
      ok: 2,
    },
    {
      n: 'hdr', q: 'Que désigne l\'UHD, que produit la HDC-5500 du car ?',
      a: [
        ['2560 × 1440 pixels.', 'C\'est une définition d\'écran d\'ordinateur, pas de télévision.'],
        ['3840 × 2160 pixels, quatre fois la HD.', 'Exact : deux fois plus de lignes et de colonnes que le 1920 × 1080 ; en 2160p50, il faut de la 12G-SDI ou quatre liens 3G.'],
        ['La HD en 10 bits.', 'Le nombre de bits dit la finesse des niveaux, pas le nombre de pixels.'],
      ],
      ok: 1,
    },
    {
      n: 'hfr', q: 'Une caméra filme à 150 images par seconde ; on relit à 50 images par seconde. Le ralenti est…',
      a: [
        ['trois fois plus lent, et fluide : chaque image affichée a vraiment été prise.', 'Exact : 150 ÷ 50 = 3. Un ralenti fait en répétant les images d\'une caméra à 50 i/s saccaderait.'],
        ['cent cinquante fois plus lent.', 'La vitesse du ralenti, c\'est le rapport des cadences : 150 ÷ 50.'],
        ['impossible : un écran n\'affiche que 50 images par seconde.', 'C\'est justement l\'idée : on prend plus d\'images qu\'on n\'en affiche, puis on les relit toutes, plus lentement.'],
      ],
      ok: 0,
    },
    {
      n: 'hfr', q: 'Pourquoi une caméra de super ralenti à 150 images par seconde demande-t-elle plus de lumière ?',
      a: [
        ['Parce que son capteur est plus petit.', 'Le capteur est le même 2/3" ; c\'est la durée d\'exposition de chaque image qui change.'],
        ['Parce qu\'elle filme en noir et blanc.', 'Elle filme en couleur, avec le même prisme.'],
        ['Parce que chaque image dure au plus 1/150 s : trois fois moins de lumière qu\'à 1/50 s, environ un diaphragme et demi.', 'Exact : à lumière égale, on ouvre l\'iris ou on monte le gain ; au stade, ce sont les premières caméras à manquer de lumière le soir.'],
      ],
      ok: 2,
    },
  ],
};

// ---------------- le moule commun des questions ----------------
/**
 * Une liste de questions : un choix, l'explication de ce choix ; on peut réessayer après une
 * erreur, mais seule la première réponse de chaque question compte. Quand chaque question a reçu
 * sa première réponse, onDone(score, total, premières réponses justes).
 * open(id) : une question qui porte n propose, après une erreur, la fiche à revoir.
 * @param {QuestionChap[]} questions
 * @param {{ onDone?: (score: number, total: number, firsts: boolean[]) => void, open?: (id: string) => void, label?: string }} [o]
 */
export function questionList(questions, o = {}) {
  const firsts = /** @type {(boolean | null)[]} */ (questions.map(() => null));
  const box = el('ol', { class: 'cl-quiz' });
  questions.forEach((q, qi) => {
    const why = el('p', { class: 'cl-why', 'aria-live': 'polite' });
    const opts = el('div', { class: 'cl-opts', role: 'group', 'aria-label': `${o.label || 'Question'} ${qi + 1}` });
    q.a.forEach(([text, expl], i) => opts.append(el('button', {
      type: 'button', class: 'cl-opt',
      onclick: (e) => {
        const b = /** @type {HTMLElement} */ (e.currentTarget);
        const right = i === q.ok;
        for (const x of opts.children) x.classList.remove('chosen', 'right', 'wrong');
        b.classList.add('chosen', right ? 'right' : 'wrong');
        why.replaceChildren(expl); why.className = 'cl-why ' + (right ? 'right' : 'wrong');
        if (!right && q.n && NOTIONS[q.n] && o.open) {
          why.append(' ', el('button', { type: 'button', class: 'linkbtn cs-revoir', onclick: () => o.open(/** @type {string} */ (q.n)) }, `Revoir la fiche « ${NOTIONS[q.n].t} »`));
        }
        if (right) for (const x of opts.children) /** @type {HTMLButtonElement} */ (x).disabled = true;
        if (firsts[qi] == null) {
          firsts[qi] = right;
          if (firsts.every((x) => x != null) && o.onDone) o.onDone(firsts.filter(Boolean).length, questions.length, /** @type {boolean[]} */ (firsts));
        }
      },
    }, text)));
    box.append(el('li', { 'data-q': String(qi) }, el('p', { class: 'cl-q' }, q.q), opts, why));
  });
  return box;
}

// ---------------- le quiz d'un chapitre ----------------
/**
 * Le quiz du chapitre n, dans le panneau de droite. ctx : { open(id) : ouvrir une fiche,
 * progress() : la progression a changé (liste des notions) }. Renvoie { node, dispose }.
 * @param {number} n
 * @param {{ open: (id: string) => void, progress?: () => void }} ctx
 */
export function renderChapterQuiz(n, ctx) {
  const chap = CHAPITRES.find((c) => c.n === n); const qs = QUIZ[n] || [];
  const node = el('article', { class: 'cl-fiche cs-cquiz', 'aria-label': `Quiz du chapitre ${n}` });
  const best = el('p', { class: 'cs-best' });
  const showBest = () => {
    const b = chapterQuizBest(n);
    best.textContent = b ? `Meilleur score : ${b.score} / ${b.total}${b.score === b.total ? ' · réussi en entier' : ''}` : 'Pas encore fait.';
  };
  const ids = notionsDu(n);
  const result = el('div', { class: 'cs-result', 'aria-live': 'polite' });
  const hold = el('div');
  const start = () => {
    result.replaceChildren();
    hold.replaceChildren(questionList(qs, {
      label: 'Question',
      open: ctx.open,
      onDone(score, total, firsts) {
        recordChapterQuiz(n, score, total); showBest(); if (ctx.progress) ctx.progress();
        const wrong = [...new Set(qs.filter((q, i) => !firsts[i] && q.n && NOTIONS[q.n]).map((q) => /** @type {string} */ (q.n)))];
        result.replaceChildren(
          el('p', { class: 'cs-score' + (score === total ? ' ok' : '') }, el('b', {}, `${score} / ${total}`), score === total ? ' du premier coup : chapitre réussi.' : ' du premier coup.'),
          wrong.length ? el('p', { class: 'cs-note' }, 'À revoir :') : null,
          wrong.length ? el('div', { class: 'cl-see' }, ...wrong.map((id) => el('button', { type: 'button', class: 'cl-chip' + (NOTIONS[id].prevu ? ' prevu' : ''), onclick: () => ctx.open(id) }, NOTIONS[id].t))) : null,
          el('div', { class: 'cs-row' }, el('button', { type: 'button', class: 'btn small', onclick: () => start() }, 'Refaire le quiz')));
      },
    }));
  };
  node.append(
    el('header', { class: 'cl-fh' },
      el('p', { class: 'cl-kick' }, `Chapitre ${n} · ${chap ? chap.nom : ''}`),
      el('h2', {}, 'Quiz du chapitre')),
    el('p', { class: 'cl-short' }, `${qs.length} questions qui mélangent les notions du chapitre. Seule ta première réponse compte ; chaque réponse est expliquée.`),
    el('p', { class: 'cs-note' }, `Notions acquises dans ce chapitre : ${acquises(ids)} / ${ids.length}.`),
    best, hold, result);
  showBest(); start();
  return { node, dispose() {} };
}

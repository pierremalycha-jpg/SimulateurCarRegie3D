// @ts-check
// ----------------------------------------------------------------------------------
// Fiche « Les défauts optiques ». Fiche technique Sony HXC-FB80 : ALAC (Auto Lens Aberration
// Compensation) parmi les fonctions de l'image ; documentation Sony des RCP : elle réduit
// l'aberration chromatique de grandeur (latérale) quand l'objectif monté la permet. Norme BTA S-1005
// (monture B4) : image à 48 mm de la face d'appui, plan rouge 10 µm et plan bleu 5 µm plus loin
// (compensation de l'aberration chromatique axiale), diagonale de l'image 11 mm. Photosite de
// 9,59 mm ÷ 1920 = 5 µm. Mode d'emploi HXC-FB80 : pages M02 WHITE SHADING (menu MAINTENANCE) et
// F04 LENS FILE (menu FILE). La manipulation (camlab/labs/ch1.js, « defauts ») montre une mire
// quadrillée avec un modèle de la maquette, en ordres de grandeur : écart chromatique de 1,7 photosite
// au coin à 4,5 mm (l'ALAC en laisse 10 %), distorsion de −3 % au grand angle à +1,2 % au serré,
// coins à 50 % du centre à f/1,8.
// ----------------------------------------------------------------------------------

/** @type {import('./index.js').FicheCamera} */
export const DEFAUTS = {
  t: 'Les défauts optiques', aka: 'Aberrations chromatiques, distorsion, vignetage, flare, respiration ; ALAC', chap: 1, lot: 3, point: 'frontale',
  short: 'Aberrations chromatiques, distorsion, vignetage, flare et respiration : les défauts de tout objectif, et ce que la caméra sait en corriger (ALAC).',
  fig: 'defauts',
  lab: 'defauts',
  body: "**Aucun objectif n'est parfait.** Un zoom de télévision est un compromis entre le rapport de zoom, l'ouverture, le poids et le prix. Ses défauts sont connus, mesurés par le constructeur, et certains sont corrigés par la caméra.\n\n**Les aberrations chromatiques.** Le verre ne dévie pas toutes les couleurs de la même façon. Deux effets :\n- **axiale** : le bleu, le vert et le rouge ne font pas le point à la même distance. La norme de la monture B4 en tient compte : les capteurs rouge et bleu sont placés 10 µm et 5 µm plus loin que le vert ;\n- **latérale**, ou de grandeur : chaque couleur forme une image d'une taille un peu différente. Rien au centre, et au bord, un liseré rouge d'un côté des contours, bleu de l'autre. Elle est plus forte au grand angle et avec le doubleur. C'est elle que corrige l'**ALAC** de la caméra : connaissant l'objectif et la position de son zoom, de son point et de son iris, elle agrandit ou réduit très légèrement les images rouge et bleue pour les recaler sur le vert.\n\n**La distorsion.** Les lignes droites du bord de l'image se courbent : en barillet au grand angle (elles se bombent vers l'extérieur), en coussinet au serré (elles se creusent). Quelques pour cent au coin pour un zoom grand angle, ordre de grandeur. La caméra ne la corrige pas en direct.\n\n**Le vignetage.** Les coins reçoivent moins de lumière que le centre, surtout à pleine ouverture et au grand angle. Sur la forme d'onde, la ligne du blanc s'arrondit vers les bords. Fermer d'un ou deux diaphragmes le réduit beaucoup.\n\n**Le flare.** Les reflets entre les lentilles, en face d'une source vive : des images fantômes alignées sur la source et le centre de l'image, et un voile qui remonte les noirs (voir la lentille frontale).\n\n**La respiration.** En tournant la bague de point, le cadre change un peu de taille, comme un petit zoom. Les zooms de télévision sont corrigés pour qu'elle se voie peu.",
  vraie: "**L'ALAC** demande un objectif qui la permet et qui envoie ses positions à la caméra par son câble : la liste des objectifs compatibles est chez Sony. **WHITE SHADING** (page M02 du menu MAINTENANCE) corrige les irrégularités de couleur du blanc d'un bord à l'autre de l'image. Le **fichier d'objectif** (page F04 LENS FILE du menu FILE) garde des réglages propres à chaque objectif, pour les retrouver quand on le remonte.\n\n**Le bon geste.** Regarder un défaut avec la loupe du viseur, au bord de l'image, sur une mire quadrillée ou des lignes nettes du décor. Pour un plan avec des lignes droites (un but, un horizon, le bord d'un bureau), éviter de les mettre au bord du cadre au grand angle. Fermer un peu l'iris quand le vignetage se voit sur un fond uni.\n\n**L'erreur fréquente.** Prendre une frange colorée pour un défaut du prisme : si elle est nulle au centre et grandit vers les bords, c'est l'objectif ; si elle est la même partout, ce sont les capteurs. Ou refaire la balance des blancs pour corriger des coins plus sombres : la balance règle la couleur de toute l'image, pas son uniformité.",
  plus: "- **L'ordre de grandeur.** Un photosite fait 5 µm (9,59 mm ÷ 1920). Une aberration latérale de 5 à 10 µm au coin, un ou deux photosites, suffit à faire un liseré coloré visible sur un écran de contrôle.\n- **Les capteurs décalés.** La norme de la monture B4 (BTA S-1005, 1992) fixe la position du plan de chaque couleur derrière le prisme : les objectifs sont calculés pour ces trois plans. Monté devant un capteur unique, un objectif B4 perd cette compensation : il faut un adaptateur optique.\n- **Le vignetage naturel.** Même un objectif parfait éclaire moins les bords : la lumière y arrive en biais, et l'éclairement suit à peu près le cosinus de l'angle à la puissance quatre. Le reste vient des montures des lentilles, qui coupent une partie du faisceau à pleine ouverture.\n- **La correction de flare.** Les caméras de studio ont en général un réglage qui abaisse un peu les noirs quand l'image est très claire, pour compenser le voile.\n- **La respiration au cinéma.** Elle gêne surtout quand on fait le point d'un personnage à un autre dans le même plan : le cadre « respire ». Les zooms de cinéma sont calculés pour l'éviter.",
  car: "Dans le car, l'ingénieur vision voit les défauts au moniteur de référence : une caméra dont les coins sont plus sombres, une autre qui frange sur les lignes du terrain. L'ALAC est activée sur les caméras dont l'objectif la permet ; le reste se gère au cadre et à l'iris.",
  quiz: [
    {
      q: 'Un liseré rouge et bleu sur les contours, nul au centre de l\'image, de plus en plus fort vers les coins. Qu\'est-ce que c\'est ?',
      a: [
        ['Un capteur rouge décalé dans le prisme.', 'Un capteur décalé donne le même liseré partout, y compris au centre.'],
        ['L\'aberration chromatique latérale de l\'objectif, celle que corrige l\'ALAC.', 'Exact : les couleurs forment des images de tailles un peu différentes, l\'écart grandit avec la distance au centre.'],
        ['Une mauvaise balance des blancs.', 'La balance donne une dominante sur toute l\'image, pas des franges sur les contours.'],
      ],
      ok: 1,
    },
    {
      q: 'À pleine ouverture, au grand angle, les coins de l\'image sont plus sombres. Que fait-on ?',
      a: [
        ['On ferme l\'iris d\'un ou deux crans, et on compense la lumière autrement si besoin.', 'Exact : le vignetage vient surtout de la pleine ouverture.'],
        ['On refait la balance des blancs.', 'La balance règle la couleur de toute l\'image, pas l\'écart entre le centre et les coins.'],
        ['On monte le gain.', 'Le gain éclaircit tout, le centre comme les coins : l\'écart reste.'],
      ],
      ok: 0,
    },
    {
      q: 'Au grand angle, la ligne de touche filmée au bord du cadre est courbée. Comment l\'appelle-t-on, et que fait-on ?',
      a: [
        ['Du vignetage ; on ferme l\'iris.', 'Le vignetage assombrit les coins, il ne courbe pas les lignes.'],
        ['De la respiration ; on refait le point.', 'La respiration change la taille du cadre quand on fait le point, pas la forme des lignes.'],
        ['De la distorsion en barillet ; on évite de cadrer une ligne droite au bord en grand angle, ou on serre un peu.', 'Exact : la caméra ne la corrige pas en direct, elle diminue quand on serre.'],
      ],
      ok: 2,
    },
  ],
  see: ['frontale', 'prisme', 'doubleur', 'iris', 'monture', 'fichiers'],
  ref: 'Fiche technique Sony HXC-FB80 : ALAC (Auto Lens Aberration Compensation) ; mode d\'emploi HXC-FB80 : M02 WHITE SHADING, F04 LENS FILE ; norme BTA S-1005 (monture B4) : plans rouge +10 µm et bleu +5 µm',
  competences: ['2.2', '3.9'],
};

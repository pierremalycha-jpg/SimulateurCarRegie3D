// @ts-check
// ----------------------------------------------------------------------------------
// Fiche « Le line-up ». Méthode de la leçon du Cours « Le line-up » (cours/exploitation.js) prise
// sur le plateau : une caméra de référence, puis les noirs, les blancs, l'exposition et les
// couleurs des autres caméras raccordés sur elle. Mode d'emploi HXC-FB80 : FILE F03 REFERENCE
// (fichier de référence), PAINT P06 SATURATION, P14 USER MATRIX. Mode d'emploi RCP-1500 : WHITE
// (balance des blancs automatique), boutons WHITE R, G, B et BLACK/FLARE R, G, B, master black au
// manche. Luminance et différences de couleur : ITU-R BT.709. Tolérances de la manipulation : noir
// à 0,5 point, gris à 1 point, couleurs à 0,012 sur le vecteurscope (ordres de grandeur pour que la
// coupe ne se voie pas ; le Cours prend 2 points pour la pelouse et 2,5 pour la couleur). La
// manipulation (labs/ch7.js, « lineup ») raccorde la CAM 2 sur la CAM 1 en écran partagé, à la
// parade et au vecteurscope.
// ----------------------------------------------------------------------------------

/** @type {import('./index.js').FicheCamera} */
export const LINEUP = {
  t: 'Le line-up', aka: 'Line-up et matching : raccorder les caméras entre elles', chap: 7, lot: 3, point: 'rcp',
  short: 'Régler toutes les caméras pour qu\'elles se raccordent entre elles : même noir, même blanc, mêmes couleurs, même exposition. On coupe de l\'une à l\'autre sans que l\'image change.',
  fig: 'lineup',
  lab: 'lineup',
  body: "**Pourquoi.** Au mélangeur, on coupe de la caméra 1 à la caméra 2 : le même décor, le même visage, vus d'un autre angle. Si la caméra 2 a un noir plus gris, un blanc plus bleu ou un rouge plus vif, le téléspectateur le voit à chaque coupe. Le **line-up** rend les caméras interchangeables. On dit aussi **matching** (raccord) pour la dernière étape, celle qui compare les caméras entre elles.\n\n**Dans l'ordre**, caméra par caméra, depuis les RCP :\n1. **Partir du même réglage** : le fichier de référence de chaque caméra (page F03 REFERENCE du menu FILE), le même format, les mêmes options de peinture.\n2. **Les barres** (BARS) : elles valident la liaison jusqu'au moniteur, sans l'objectif ni la lumière.\n3. **Les noirs** : la balance des noirs automatique, iris fermé, puis le master black au même niveau sur toutes les caméras.\n4. **Les blancs** : la balance des blancs sur la même charte, sous la même lumière ; à la parade, les trois traces R, V, B à la même hauteur sur le gris.\n5. **L'exposition** : l'iris, pour que le même gris, ou le même visage, soit au même niveau partout.\n6. **Les couleurs** : au vecteurscope, chaque pastille de la charte doit tomber au même endroit pour toutes les caméras. Si une caméra rend les couleurs plus vives, on la corrige à la saturation, ou à la matrice.\n\n**Une caméra de référence.** On en règle une, souvent la caméra principale, puis on raccorde les autres sur elle, sans plus jamais la toucher. On compare sur un **moniteur de référence en écran partagé** (la moitié gauche d'une caméra, la moitié droite de l'autre) et à la mesure : la parade pour les noirs et les blancs, le vecteurscope pour les couleurs.",
  vraie: "Tout se fait au RCP : la balance des blancs (touche WHITE) et celle des noirs, les boutons WHITE R, G, B et BLACK R, G, B pour les retouches, le master black et l'iris au manche, la saturation dans les menus de peinture (page P06 SATURATION). Le cadreur cadre la charte plein écran, sous la lumière du plateau, et ne bouge plus jusqu'au « merci ».\n\n**Le bon geste.** La même charte, au même endroit, sous la même lumière, pour toutes les caméras. Les noirs avant les blancs, les blancs avant les couleurs. Noter les réglages de la caméra de référence, et ne plus y toucher.\n\n**L'erreur fréquente.** Raccorder à l'œil sur deux moniteurs différents, qui ne sont pas réglés pareil. Corriger une dominante avec le master black, qui déplace les trois voies ensemble. Retoucher la caméra de référence en cours de route : tout est à refaire.",
  plus: "- **Copier n'est pas raccorder.** Le pupitre maître du chef vision copie les réglages d'une caméra sur une autre : un bon départ, pas un line-up. Chaque objectif, chaque position, chaque capteur rend un peu différemment.\n- **Le flare.** Les boutons BLACK du RCP règlent aussi le flare, la lumière parasite de l'objectif qui relève les noirs quand le cadre est très clair : une caméra face à une fenêtre n'a pas le même noir que les autres.\n- **Les tolérances.** Deux caméras sont raccordées quand la coupe ne se voit plus : de l'ordre d'un point sur le noir et sur le gris à la parade. Le jour de match du Cours prend 2 points pour la pelouse et 2,5 % pour la couleur.\n- **Deux modèles différents.** Raccorder une HXC-FB80 et une caméra d'une autre gamme demande souvent la matrice (page P14 USER MATRIX) : leurs prismes et leurs capteurs ne voient pas exactement les mêmes couleurs.\n- **Pendant l'émission.** La lumière change : la vision suit l'iris en permanence, et reprend le raccord à la pause si besoin.",
  car: "Au stade, le line-up du car suit le même ordre, sur la pelouse : la CAM 1 est la référence, les autres se raccordent sur elle (pelouse vers 40 à 55 % et à 2 points de la CAM 1, gris neutre). La check-list se coche au poste Chef de car ; le réglage se fait au poste Vision, aux RCP, avec la parade et le vecteurscope du PRISM.",
  quiz: [
    {
      q: 'Sur la charte grise, la parade de la CAM 2 montre la trace bleue plus haute que la rouge et la verte. Quel réglage ?',
      a: [
        ['Le master black.', 'Il déplace les trois voies ensemble, en bas de l\'échelle : il ne corrige pas une dominante.'],
        ['La balance des blancs : refaire la balance automatique, ou baisser le bouton WHITE B.', 'Exact : sur un gris neutre, R, V et B doivent être à la même hauteur. C\'est le gain du bleu qui est trop fort.'],
        ['L\'iris.', 'L\'iris baisse les trois voies ensemble : le gris resterait bleu.'],
      ],
      ok: 1,
    },
    {
      q: 'Pourquoi choisit-on une caméra de référence ?',
      a: [
        ['Pour raccorder toutes les autres sur un seul modèle, qui ne bouge plus.', 'Exact : si l\'on ajustait chaque caméra sur la précédente, les petits écarts s\'additionneraient.'],
        ['Parce que c\'est la seule qui passe à l\'antenne.', 'Toutes les caméras passent à l\'antenne ; c\'est justement pour cela qu\'elles doivent se raccorder.'],
        ['Pour pouvoir se passer de la balance des blancs sur les autres.', 'Chaque caméra a sa balance ; la référence sert à les comparer, pas à les remplacer.'],
      ],
      ok: 0,
    },
    {
      q: 'Noirs, blancs et exposition sont raccordés, mais au vecteurscope les pastilles de la CAM 2 sont plus loin du centre que celles de la CAM 1. Que fait-on ?',
      a: [
        ['On ferme l\'iris de la CAM 2.', 'Les couleurs pâliraient un peu, mais l\'exposition ne serait plus raccordée : on corrigerait un défaut par un autre.'],
        ['On refait la balance des blancs de la CAM 2.', 'Les blancs sont déjà raccordés : le gris est au centre. C\'est l\'intensité des couleurs qui diffère.'],
        ['On baisse la saturation de la CAM 2 jusqu\'à poser ses pastilles sur celles de la CAM 1.', 'Exact : loin du centre veut dire des couleurs plus vives ; la saturation les ramène sans toucher aux gris.'],
      ],
      ok: 2,
    },
  ],
  see: ['balance', 'noir', 'matrice', 'rcp', 'waveform', 'vecto', 'mires', 'fichiers'],
  ref: 'Mode d\'emploi HXC-FB80 : FILE F03 REFERENCE, PAINT P06 SATURATION et P14 USER MATRIX ; mode d\'emploi RCP-1500 : WHITE, boutons WHITE R, G, B et BLACK/FLARE R, G, B, master black ; luminance et différences de couleur ITU-R BT.709 ; méthode de la leçon « Le line-up » du Cours',
  competences: ['1.4', '2.2', '3.9'],
  cours: 'expl-lineup',
};

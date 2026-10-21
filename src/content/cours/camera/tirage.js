// @ts-check
// ----------------------------------------------------------------------------------
// Fiche « Le tirage optique » (back focus, bague F.f des objectifs Fujinon). Monture 2/3" à
// baïonnette (B4) : tirage 48,00 mm dans l'air (norme BTA S-1005). Objectif de référence :
// Fujinon ZA12x4.5BERD, 4,5–54 mm, f/1,8 jusqu'à 41 mm puis f/2,4 à 54 mm, distance minimale
// 0,3 m (fiche constructeur). La manipulation (camlab/labs/optique.js, « tirage ») reprend la procédure.
// Texte : paragraphes séparés par une ligne vide, listes « - » et « 1. », **gras** (ui/rich.js).
// ----------------------------------------------------------------------------------

/** @type {import('./index.js').FicheCamera} */
export const TIRAGE = {
  t: 'Le tirage optique', aka: 'Back focus ; bague F.f (flange focal) chez Fujinon', chap: 1, lot: 1, point: 'tirage',
  short: 'Le réglage qui place l\'image formée par l\'objectif exactement sur les capteurs. S\'il est faux, le point décroche quand on élargit le cadre.',
  fig: 'tirage',
  lab: 'tirage',
  body: "**Ce que règle le tirage.** Un objectif forme son image à une distance précise de sa monture : 48 mm pour la monture B4 des caméras 2/3\". C'est là que doivent se trouver les capteurs, derrière le prisme. La bague de tirage (F.f chez Fujinon) déplace très légèrement les lentilles arrière pour amener l'image juste sur eux.\n\n**Pourquoi on le voit en élargissant.** Au téléobjectif, la bague de point a beaucoup d'effet : elle rattrape une petite erreur de tirage, et l'image paraît nette. En grand angle, la bague de point n'agit presque plus. L'erreur de tirage reste alors entière, et l'image devient floue. Net en serré, flou en large : c'est le signe d'un tirage faux.\n\n**La règle.** En serré, on fait le point avec la bague de point. En large, on règle la netteté avec la bague de tirage. On recommence jusqu'à ce que l'image reste nette sur toute la course du zoom : le zoom est alors vraiment parfocal.\n\n**La procédure.**\n1. Placer une mire en étoile de Siemens à 3 m environ, bien éclairée, au centre du cadre.\n2. Ouvrir l'iris en grand, iris en manuel. Si l'image est trop claire, baisser la lumière ou mettre un filtre ND, mais ne pas fermer l'iris.\n3. Mettre le doubleur sur ×1 et la macro au repos. Débloquer la vis de la bague F.f.\n4. Zoomer à fond (54 mm) et faire le point sur le centre de l'étoile avec la bague de point.\n5. Élargir à fond (4,5 mm) sans toucher la bague de point. Tourner la bague F.f jusqu'à ce que le centre de l'étoile soit net.\n6. Recommencer les étapes 4 et 5 jusqu'à ce que l'image reste nette du serré au large.\n7. Bloquer la vis de la bague F.f, puis remettre l'iris en automatique si besoin.",
  vraie: "Sur le Fujinon ZA12x4.5BERD, la bague F.f est à l'arrière de l'objectif, juste devant la monture, avec sa vis de blocage. Elle ne porte pas de graduation : on la tourne en regardant le viseur, avec la loupe (touche MAG du viseur) pour mieux voir le centre de l'étoile.\n\n**Quand le refaire.** À chaque montage d'un objectif sur un corps, après un transport ou un choc, et quand la température change beaucoup : un plateau froid le matin, une captation en plein soleil l'après-midi.\n\n**L'erreur fréquente.** Faire le réglage iris fermé : la profondeur de champ cache le défaut et tout semble net. Ou oublier de bloquer la vis : le tirage bouge au premier coup de zoom.",
  plus: "- **Pourquoi 48 mm.** Les objectifs B4 sont calculés pour traverser le verre du bloc prisme. Leur tirage est donné dans l'air, et le constructeur de la caméra place les capteurs en tenant compte de l'épaisseur du prisme. Un objectif qui n'est pas calculé pour ce verre donne des franges colorées et une image moins nette.\n- **Le tirage et la température.** Le métal et le verre se dilatent. Un objectif réglé dans un camion froid peut décrocher à midi en plein soleil : on vérifie le tirage avant l'antenne.\n- **Les objectifs box du car.** Les grands zooms de stade ont aussi un tirage. L'équipe caméra le règle au montage, avec la même méthode, avant le line-up.",
  car: "Au montage d'une caméra du stade, l'équipe caméra vérifie le point du serré au large avant de rendre la caméra à la vision. Un zoom qui décroche en plan large ne se rattrape pas pendant le direct.",
  quiz: [
    {
      q: 'En plan serré, le présentateur est net. Le cadreur élargit, et l\'image devient floue. Que faut-il régler ?',
      a: [
        ['La bague de point : le point s\'est déplacé pendant le zoom.', 'Non : le point était juste en serré, et en large la bague de point n\'a presque plus d\'effet. C\'est l\'image qui ne tombe pas sur les capteurs.'],
        ['Le tirage optique, avec la bague F.f.', 'Exact : net en serré et flou en large, c\'est le signe d\'un tirage faux.'],
        ['Le diaphragme : il faut le fermer pour gagner de la profondeur de champ.', 'Fermer l\'iris cache le défaut sans le corriger. Il reviendra dès que la lumière baissera.'],
      ],
      ok: 1,
    },
    {
      q: 'Pourquoi ouvre-t-on l\'iris en grand pour régler le tirage ?',
      a: [
        ['Pour réduire la profondeur de champ : le moindre défaut de netteté se voit.', 'Exact : à f/1,8, la zone nette est la plus mince possible. À f/8, tout semble net et l\'erreur passe inaperçue.'],
        ['Pour que la mire soit plus lumineuse dans le viseur.', 'La lumière n\'est pas le but : si l\'image est trop claire, on baisse l\'éclairage ou on met un ND, mais on garde l\'iris ouvert.'],
        ['Parce que la bague F.f est bloquée tant que l\'iris est fermé.', 'Les deux bagues sont indépendantes. On ouvre l\'iris pour voir l\'erreur, pas pour débloquer une bague.'],
      ],
      ok: 0,
    },
    {
      q: 'Dans quel ordre se fait le réglage ?',
      a: [
        ['Le point en large avec la bague de point, puis le tirage en serré.', 'C\'est l\'inverse : en large, la bague de point n\'a presque pas d\'effet. Elle sert en serré.'],
        ['Le tirage une seule fois en large : le zoom est ensuite parfocal.', 'Un seul passage ne suffit pas toujours : régler un bout du zoom décale un peu l\'autre. On recommence jusqu\'à ce que tout soit net.'],
        ['Le point en serré avec la bague de point, la netteté en large avec la bague F.f, puis on recommence.', 'Exact : serré, le point ; large, le tirage ; deux ou trois passages, puis on bloque la vis.'],
      ],
      ok: 2,
    },
  ],
  see: ['zoom', 'point', 'pdc', 'iris', 'monture', 'mires'],
  ref: 'Monture à baïonnette 2/3" (B4) : tirage 48,00 mm dans l\'air, norme BTA S-1005 ; notice de l\'objectif Fujinon ZA12x4.5',
  competences: ['2.7'],
};

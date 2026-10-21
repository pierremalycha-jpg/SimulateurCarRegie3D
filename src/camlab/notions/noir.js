// @ts-check
// ----------------------------------------------------------------------------------
// Fiche « Le niveau du noir ». Noir HD à 0 % (code 64, ITU-R BT.709), pas de setup (le 7,5 IRE du
// NTSC, SMPTE 170M). Repère d'exploitation du simulateur et du Cours (signal-niveaux, expl-lineup) :
// noirs posés entre 0 et 2 %. Mode d'emploi HXC-FB80 : menu PAINT, page P01 SW STATUS (FLARE) et
// page P02 VIDEO LEVEL (WHITE R, G, B ; BLACK R, G, B, M ; FLARE R, G, B, M ; de −99 à +99, 0 à
// l'usine) ; valeurs relatives, l'effet se lit à la forme d'onde. Au pied de la courbe BT.709 (pente
// 4,5 sous 1,8 % de lumière), un décalage de lumière b déplace le signal de 4,5 b : le master black
// change beaucoup les ombres, peu le blanc. La manipulation (camlab/labs/ch4.js, « noir ») pose le
// noir de la mire, bouche les branches de l'étoile (7 %), puis aligne les noirs R, V, B iris fermé.
// ----------------------------------------------------------------------------------

/** @type {import('./index.js').FicheCamera} */
export const NOIR = {
  t: 'Le niveau du noir', aka: 'Master black, pedestal (piédestal) ; noirs R, V, B', chap: 4, lot: 3, point: 'rcp',
  short: 'Le master black règle le noir de l\'image. Trop haut, l\'image se délave ; trop bas, les ombres se bouchent. Repère : le noir posé entre 0 et 2 %.',
  fig: 'noir',
  lab: 'noir',
  cours: 'signal-niveaux',
  body: "**Le noir est un réglage.** Iris fermé, un capteur ne donne pas tout à fait zéro : il reste un petit signal, qui varie avec la température et le gain. La caméra le retire (c'est la balance des noirs), puis la vision **pose** le noir là où elle le veut avec le **master black**, aussi appelé **pedestal** (piédestal) : une valeur ajoutée ou retirée au signal des trois couleurs à la fois.\n\n**Trois cas.**\n- **Délavé** : le noir est trop haut, à 5 % par exemple. Un voile gris couvre l'image, les noirs ne sont plus noirs, le contraste baisse.\n- **Juste** : le noir est posé entre 0 et 2 % à la forme d'onde. Les ombres gardent leur détail.\n- **Bouché** : le noir est trop bas. L'image ne descend pas sous le noir, mais tout ce qui était plus sombre que le décalage le rejoint : les plis d'un rideau, une chevelure, une tribune à l'ombre deviennent un aplat.\n\n**Surtout le bas de l'image.** La courbe de la caméra est très raide près du noir : un petit décalage y fait un grand écart de signal. Le master black change beaucoup les ombres, un peu les tons moyens, presque pas le blanc. On le touche en douceur, en regardant le bas de la forme d'onde.\n\n**Les trois noirs.** Le master black déplace les trois voies ensemble ; les noirs rouge, vert et bleu se règlent aussi un par un. S'ils ne sont pas alignés, les ombres prennent une teinte. On les aligne iris fermé, en parade : les trois traces au même niveau.",
  vraie: "Sur la FB80, le niveau du noir est au menu PAINT, page P02 VIDEO LEVEL : BLACK R, G, B et M (le master), de −99 à +99, 0 à l'usine. Ce sont des valeurs relatives : l'effet se lit à la forme d'onde. La même page règle le FLARE, la correction du voile de lumière de l'objectif dans les noirs ; la page P01 SW STATUS l'allume ou le coupe.\n\nReliée à la CCU, c'est la vision qui règle le noir au RCP : le master black à la bague du manche, l'iris au même manche, les noirs R, V, B aux potentiomètres BLACK.\n\n**Le bon geste.** D'abord la balance des noirs (ABB), puis le master black à la forme d'onde, iris fermé ou sur un vrai noir de la scène : entre 0 et 2 %. Le même noir sur toutes les caméras.\n\n**L'erreur fréquente.** Remonter le master black pour « déboucher » une ombre : toute l'image se délave. Pour ouvrir les ombres sans toucher au noir, c'est le black gamma.",
  plus: "- **Pas de setup en HD.** En vidéo analogique NTSC, le noir était posé à 7,5 IRE au-dessus du niveau de suppression ; en HD numérique, le noir est à 0 %, au code 64.\n- **Le flare.** La lumière parasite qui se diffuse dans l'objectif relève les noirs quand la scène est très claire. La correction de flare en retire une part qui suit le niveau de l'image.\n- **Le noir du moniteur.** Pour régler l'écran, la mire PLUGE montre des barres juste au-dessous et juste au-dessus du noir : la plus sombre doit disparaître, la suivante rester visible. Un moniteur mal réglé fait croire à un noir faux.\n- **Le noir et le bruit.** Monter le noir rend le bruit des ombres plus visible ; le descendre le cache, avec les détails.",
  car: "Dans le car, les noirs se posent au line-up, caméra par caméra, sur le même repère : 0 à 2 %. Au poste vision du simulateur, la bague du manche du RCP règle le master black, les molettes BLACK R, V, B les trois noirs, et le PRISM montre le bas de la forme d'onde et de la parade. Pendant le match, la vision retouche le noir quand le soleil passe sur la tribune.",
  quiz: [
    {
      q: 'L\'image paraît voilée de gris, le contraste est faible ; la forme d\'onde montre le noir à 6 %. Que fait-on ?',
      a: [
        ['On ferme l\'iris.', 'L\'iris assombrit tout, blancs compris : le noir resterait relevé par rapport au reste.'],
        ['On baisse le master black jusqu\'à 0 à 2 %.', 'Exact : le noir est trop haut, c\'est un noir délavé.'],
        ['On baisse le gain.', 'Le gain multiplie le signal ; il ne pose pas le noir.'],
      ],
      ok: 1,
    },
    {
      q: 'On descend le master black sous zéro. Que se passe-t-il ?',
      a: [
        ['Les détails les plus sombres rejoignent le noir : les ombres se bouchent.', 'Exact : tout ce qui était plus sombre que le décalage devient le même noir.'],
        ['L\'image devient plus contrastée, sans rien perdre.', 'Plus contrastée, oui, mais les détails des ombres sont perdus.'],
        ['Le signal passe sous 0 % et le diffuseur le refuse.', 'L\'image ne descend pas sous le noir : ce qui est perdu, ce sont les détails des ombres.'],
      ],
      ok: 0,
    },
    {
      q: 'Iris fermé, en parade, le bas du bleu est 2 % au-dessus du rouge et du vert. Que règle-t-on ?',
      a: [
        ['Le master black.', 'Il déplace les trois voies ensemble : l\'écart resterait.'],
        ['La balance des blancs.', 'Elle règle les gains en haut de l\'échelle ; ici, c\'est le zéro du bleu qui a bougé.'],
        ['Le noir bleu (BLACK B), ou on relance la balance des noirs (ABB).', 'Exact : les trois noirs doivent être alignés, sinon les ombres virent au bleu.'],
      ],
      ok: 2,
    },
  ],
  see: ['balance', 'gamma', 'waveform', 'rcp', 'lineup', 'moniteur'],
  ref: 'ITU-R BT.709 (noir à 0 %, code 64 en 10 bits) ; mode d\'emploi HXC-FB80 : menu PAINT, pages P01 SW STATUS (FLARE) et P02 VIDEO LEVEL (BLACK R, G, B, M ; FLARE R, G, B, M ; de −99 à +99) ; commande du master black et des noirs par le RCP',
  competences: ['1.4', '2.9'],
};

// @ts-check
// ----------------------------------------------------------------------------------
// Fiche « Les mires ». Barres 100/0/75/0 (nomenclature ITU-R BT.471, mire EBU du car) ; barres HD
// SMPTE RP 219 (gris à 40 %, rampe, PLUGE à −2, +2 et +4 %). Luminance BT.709 des barres à 75 % :
// 75 · 70 · 59 · 54 · 21 · 16 · 5 % (gris, jaune, cyan, vert, magenta, rouge, bleu). Mire du plateau
// du module (camlab/vf.js, drawMire) : étoile de Siemens de 36 paires de secteurs, charte de onze
// gris, pastilles de couleur, à 3 m. Disque gris de l'étoile (camlab/labs/ch89.js, starGrey) : là
// où la période des secteurs sur le capteur passe sous 1,22 fois la tache de flou, ou sous deux
// photosites. Mode d'emploi HXC-FB80 : OUTPUT/AUTO KNEE sur BARS ou CAM ; sur BARS, pas de
// balance. La manipulation (« mires ») fait choisir la mire de trois réglages.
// ----------------------------------------------------------------------------------

/** @type {import('./index.js').FicheCamera} */
export const MIRES = {
  t: 'Les mires', aka: 'Barres de couleur, étoile de Siemens, charte grise', chap: 8, lot: 2, point: 'mire',
  short: 'Barres de couleur, étoile de Siemens, charte grise : quelle mire pour quel réglage.',
  fig: 'mires',
  lab: 'mires',
  body: "**Deux familles.**\n- Les **mires électroniques** sont fabriquées par un appareil : les barres de la caméra (OUTPUT sur BARS), celles de la CCU ou du générateur de synchro. Elles ne passent ni par l'objectif ni par la lumière : elles testent la **chaîne** (la liaison, les niveaux, les couleurs, les moniteurs).\n- Les **mires optiques** sont posées devant l'objectif : étoile, charte grise, carton blanc. Elles testent l'**image** : l'objectif, le point, l'exposition, la couleur.\n\n**Les barres de couleur.** Sept bandes à 75 % : gris (ou blanc), jaune, cyan, vert, magenta, rouge, bleu. Sur la forme d'onde, un escalier : 75 · 70 · 59 · 54 · 21 · 16 · 5 % (BT.709). Sur le vectorscope, une tache par case. Elles disent si l'image de la caméra arrive intacte au car, et elles l'identifient : avant l'antenne, chaque CCU envoie ses barres. Les barres HD (SMPTE RP 219) portent aussi, en bas, une PLUGE pour régler les moniteurs.\n\n**L'étoile de Siemens.** Des secteurs noirs et blancs (36 paires sur la mire du plateau) qui s'affinent vers le centre. Près du centre, ils sont trop fins pour être séparés : on voit un disque gris. Plus l'image est floue, plus ce disque grandit ; au point exact, il est le plus petit. C'est la mire du point en serré et du tirage optique en large : elle montre la moindre erreur, à toutes les finesses à la fois.\n\n**La charte grise.** Une suite de gris, du noir au blanc (onze paliers sur la mire du module). Sur la forme d'onde, un escalier : on y lit le noir (le premier palier), le blanc (le dernier) et le gamma (la forme des marches entre les deux). Filmée par toutes les caméras sous la même lumière, elle sert à les raccorder : même escalier, même image.\n\n**Pour la balance.** Un carton blanc ou une charte grise, sous la lumière de la scène, au centre du cadre : ce qui compte, c'est qu'il soit neutre.\n\n**Quelle mire pour quel réglage.**\n- la liaison, les niveaux, le vectorscope, le moniteur : les barres ;\n- le point, le tirage, le piqué de l'objectif : l'étoile ;\n- le noir, le gamma, le blanc, le raccord des caméras : la charte grise ;\n- la balance des blancs : le carton blanc ou la charte.",
  vraie: "Sur la HXC-FB80, le commutateur OUTPUT/AUTO KNEE sur BARS remplace l'image par les barres, dans le viseur et vers la CCU. Sur BARS, la balance est impossible : la caméra ne voit plus son image. La mire du plateau (sa pastille) réunit l'étoile, la charte de onze gris et des pastilles de couleur, à 3 m de la caméra.\n\n**Le bon geste.** Une mire optique bien à plat, face à la caméra, éclairée uniformément par la lumière de la scène, à une distance connue, sans reflet. Et revenir sur CAM après le line-up.\n\n**L'erreur fréquente.** Laisser la caméra sur BARS : à la coupe, le réalisateur prend des barres à l'antenne. Ou régler le tirage sur une étoile trop proche ou de travers, la balance sur un mur « presque blanc ».",
  plus: "- **Le nom des barres.** On écrit 100/0/75/0 (ITU-R BT.471) : le blanc à 100 %, le noir à 0, les couleurs à 75 % avec un minimum à 0. Des barres à 100 % existent aussi ; les 75 % évitent de pousser les couleurs au bord de ce que le signal admet.\n- **Les barres HD de la SMPTE (RP 219).** Elles ajoutent des gris à 40 % sur les côtés, une rampe, des plages pour la phase de la couleur, et la PLUGE (−2, +2, +4 %).\n- **La lumière renvoyée.** Une charte grise ne va pas d'un noir parfait à un blanc parfait : son noir renvoie quelques pour cent de la lumière, son blanc autour de 90 %. Une carte grise à 18 % sert de repère moyen.\n- **D'autres mires.** Des chartes de couleurs (24 pastilles, par exemple), des mires de résolution, des grilles de lignes droites pour la distorsion : chacune répond à une question.",
  car: "Au line-up du car, chaque CCU envoie d'abord ses barres : on vérifie la liaison jusqu'à la grille et au mélangeur, et chaque source est identifiée. Puis chaque cadreur cadre la charte (ou le carton) sous la lumière du stade, pour la balance et le raccord des caméras.",
  quiz: [
    {
      q: 'Pour vérifier que l\'image de la caméra 4 arrive intacte jusqu\'au mélangeur, quelle mire ?',
      a: [
        ['L\'étoile de Siemens.', 'Elle passe par l\'objectif : elle teste la netteté, pas la liaison.'],
        ['La charte grise.', 'Elle dépend de la lumière et de l\'exposition : si elle arrive mal, on ne sait pas si c\'est la liaison ou l\'image.'],
        ['Les barres de la caméra (OUTPUT sur BARS).', 'Exact : fabriquées dans la caméra, elles ne dépendent ni de l\'objectif ni de la lumière ; si elles arrivent justes, la liaison est bonne.'],
      ],
      ok: 2,
    },
    {
      q: 'Pourquoi faire le point sur une étoile de Siemens plutôt que sur un visage ?',
      a: [
        ['Parce qu\'elle a des détails à toutes les finesses : le disque gris du centre grandit à la moindre erreur.', 'Exact : le point exact, c\'est le plus petit disque gris.'],
        ['Parce qu\'elle est plus lumineuse.', 'La lumière n\'y est pour rien : c\'est la finesse de ses secteurs qui révèle l\'erreur.'],
        ['Parce qu\'un visage bouge.', 'Il bouge, mais surtout il n\'a pas assez de détails fins pour montrer une petite erreur de point.'],
      ],
      ok: 0,
    },
    {
      q: 'On veut raccorder le noir et le gamma de trois caméras. Quelle mire ?',
      a: [
        ['Les barres de chaque caméra.', 'Elles sont fabriquées par la caméra : trois caméras sortiraient les mêmes barres même si leurs images ne se ressemblent pas.'],
        ['La charte grise, filmée par chacune sous la même lumière.', 'Exact : ses paliers forment un escalier sur la forme d\'onde ; mêmes marches, même noir, même gamma.'],
        ['L\'étoile de Siemens.', 'Elle n\'a que du noir et du blanc : aucun gris pour lire le gamma.'],
      ],
      ok: 1,
    },
  ],
  see: ['tirage', 'point', 'balance', 'lineup', 'waveform', 'vecto', 'moniteur', 'gamma'],
  ref: 'Barres 100/0/75/0 (nomenclature ITU-R BT.471) et barres HD SMPTE RP 219 (avec PLUGE) ; luminance BT.709 des barres à 75 % : 75, 70, 59, 54, 21, 16 et 5 % ; mode d\'emploi HXC-FB80 : commutateur OUTPUT/AUTO KNEE (BARS, CAM) ; mire du plateau du module : étoile de Siemens à 36 paires de secteurs, charte de onze gris',
  competences: ['3.9', '2.2'],
};

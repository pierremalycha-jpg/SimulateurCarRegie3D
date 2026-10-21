// @ts-check
// ----------------------------------------------------------------------------------
// Fiche « L'exposition : qui fait quoi ». Sensibilité HXC-FB80 (fiche technique) : F13 à 2000 lx,
// 50 Hz. Budget en diaphragmes par rapport à ce point : lumière log2(E ÷ 2000), iris
// 2 log2(13 ÷ N), ND log2 de la transmission (1/4, 1/16, 1/64 : −2, −4, −6), gain dB ÷ 6,02,
// shutter log2(temps de pose × 50). Exemples : 400 lx → f/5,8 ; ciel couvert 10 000 lx, vingt-cinq
// fois plus, +4,6 diaphragmes : ND 1/16 et f/7,3, ou ND 1/64 et f/3,6 ; 15 lx (lampadaires, ordre
// de grandeur) → f/1,1 à 0 dB, d'où +6 dB à f/1,8. Profondeur de champ à 54 mm, point à 3 m
// (cercle de confusion 0,011 mm, optics.js) : 16 cm à f/2,4, 27 cm à f/4, 37 cm à f/5,6, 54 cm à
// f/8. Mode d'emploi : bouton FILTER, commutateurs GAIN et SHUTTER, bague d'iris ; reliée à la
// CCU, tout est au RCP. La manipulation (camlab/labs/ch23.js, « exposition ») : plateau, dehors,
// le soir.
// ----------------------------------------------------------------------------------

/** @type {import('./index.js').FicheCamera} */
export const EXPOSITION = {
  t: 'L\'exposition : qui fait quoi', aka: 'Exposure ; iris, ND, gain, shutter, budget en diaphragmes', chap: 3, lot: 2, point: 'iris',
  short: 'Iris, ND, gain et shutter changent tous la luminosité, mais chacun a un prix : profondeur de champ, bruit ou mouvement. L\'ordre des réglages compte : l\'iris pour l\'image, le ND pour la lumière en trop, le gain pour celle qui manque.',
  fig: 'exposition',
  lab: 'exposition',
  body: "**Une seule quantité, quatre réglages.** Ce qui compte pour l'image, c'est la lumière que reçoit chaque photosite pendant une image, puis l'amplification qu'on lui donne. Quatre réglages y touchent :\n- l'**iris**, qui ouvre ou ferme le passage ;\n- le **filtre ND**, qui retire une part de la lumière ;\n- le **shutter**, qui raccourcit le temps de pose ;\n- le **gain**, qui amplifie le signal après le capteur.\n\n**Tout se compte en diaphragmes.** Un diaphragme, c'est deux fois plus ou deux fois moins de lumière. On part de la sensibilité de la FB80, f/13 à 2000 lux, et on additionne : la lumière de la scène, l'iris, le ND, le gain (6 dB par diaphragme), le shutter. Le total tombe à zéro quand le blanc est au niveau nominal. Exemple : un plateau à 400 lux, c'est 2,3 diaphragmes de moins que 2000 lux ; f/5,8 les rattrape, sans filtre ni gain.\n\n**Le prix de chacun.**\n- L'iris change la **profondeur de champ** : ouvert, le fond devient flou ; au-delà de f/11, la diffraction adoucit l'image.\n- Le ND ne coûte **rien sur l'image**, mais la roue est mécanique : l'image bouge pendant qu'elle tourne.\n- Le gain coûte du **bruit** : +6 dB, deux fois plus.\n- Le shutter coûte la **fluidité** du mouvement, et fait scintiller les lampes sur le secteur s'il ne tombe pas juste.\n\n**L'ordre.**\n1. L'iris d'abord, choisi pour l'image voulue : un fond flou, ou au contraire tout net.\n2. Le ND pour retirer la lumière en trop, sans toucher à cet iris.\n3. L'iris finit l'exposition, au tiers de diaphragme.\n4. Le gain, seulement quand l'iris est grand ouvert et le ND sur CLEAR.\n\nLe shutter ne sert pas à exposer : on le choisit pour le mouvement ou pour un écran, et les autres réglages compensent.\n\n**Dehors.** Un ciel couvert à 10 000 lux, c'est vingt-cinq fois le plateau, 4,6 diaphragmes de plus. Avec le ND 1/16, l'iris finit vers f/7,3 ; pour garder le fond flou d'une interview à f/4, il faut le 1/64.",
  vraie: "Chaque réglage a sa commande sur la caméra : la bague d'iris sur l'objectif (A/M sur la poignée), le bouton FILTER pour le ND, les commutateurs GAIN et SHUTTER, tous sur le côté droit du corps. Le viseur affiche l'iris, le ND, le gain et le shutter s'ils sont allumés dans la page VF DISPLAY ; le commutateur STATUS les montre d'un coup.\n\nReliée à la CCU, tout passe au RCP : l'iris au manche, le ND, le gain et le shutter sur des touches. C'est la vision qui expose ; le cadreur cadre.\n\n**Le bon geste.** Décider avec le réalisateur ce que l'image doit montrer (le fond flou ou net), régler l'iris pour ça, puis le ND, puis finir à l'iris en regardant la forme d'onde. Le gain en dernier, le shutter sur OFF.\n\n**L'erreur fréquente.** Fermer l'image au shutter parce qu'il y a trop de lumière ; monter le gain au lieu d'enlever un ND oublié ; fermer l'iris à f/16 en plein jour au lieu de mettre un ND.",
  plus: "- **Le nombre de diaphragmes de chaque réglage.** Iris : 2 × log2 du rapport des nombres f. ND : log2 de la lumière transmise (1/16 : −4). Gain : dB ÷ 6,02. Shutter : log2 du rapport des temps de pose (1/500 au lieu de 1/50 : −3,3).\n- **L'iris automatique.** La caméra peut régler l'iris seule en mesurant l'image ; en direct, on s'en méfie : un maillot blanc qui entre dans le champ, et tout s'assombrit.\n- **Les hautes lumières.** Bien exposer, c'est aussi choisir ce qu'on sacrifie : un ciel écrêté pour un visage juste. Le knee comprime ce qui dépasse.\n- **L'œil de la vision.** Le zebra du viseur et la forme d'onde disent si le blanc est juste ; le moniteur de référence dit si l'image est belle.",
  car: "Au stade, la vision suit l'iris de chaque caméra au manche du RCP, en continu, entre le soleil et l'ombre de la tribune ; elle change les ND quand le soleil sort ou se couche, et ne touche au gain qu'à la nuit, pour toutes les caméras à la fois. Le shutter ne sert qu'aux caméras de ralenti et aux écrans : les autres restent sur OFF.",
  quiz: [
    {
      q: 'Plein jour, il y a trop de lumière, et le réalisateur veut un fond flou. Que fait-on ?',
      a: [
        ['On ferme l\'iris à f/16.', 'L\'image est juste, mais tout devient net : c\'est le contraire du fond flou demandé.'],
        ['On met un ND et l\'iris reste ouvert.', 'Exact : le ND retire la lumière en trop sans toucher à la profondeur de champ.'],
        ['On passe le shutter à 1/1000.', 'L\'image s\'assombrit, mais le mouvement saccade : le shutter n\'est pas fait pour exposer.'],
      ],
      ok: 1,
    },
    {
      q: 'Il manque un diaphragme. L\'iris est grand ouvert, le ND sur CLEAR, le shutter sur OFF. Que reste-t-il ?',
      a: [
        ['+6 dB de gain, au prix de deux fois plus de bruit.', 'Exact : quand toute la lumière est entrée, il ne reste que l\'amplification. Ou demander de la lumière.'],
        ['Passer le shutter à 1/60.', 'Un temps de pose plus court retire de la lumière.'],
        ['Fermer l\'iris d\'un cran.', 'Ce serait un diaphragme de moins, pas de plus.'],
      ],
      ok: 0,
    },
    {
      q: 'Pourquoi ne règle-t-on pas l\'exposition au shutter ?',
      a: [
        ['Parce qu\'il change les couleurs.', 'Il ne change pas les couleurs, seulement la durée de la pose.'],
        ['Parce qu\'il n\'agit qu\'au-delà de 1/500.', 'Il agit à toutes ses vitesses : 1/100, c\'est déjà un diaphragme.'],
        ['Parce qu\'il coûte la fluidité du mouvement et peut faire scintiller les lampes.', 'Exact : on le choisit pour le mouvement ou un écran, et l\'iris ou le ND compensent.'],
      ],
      ok: 2,
    },
  ],
  see: ['iris', 'nd', 'gain', 'shutter', 'pdc', 'waveform'],
  ref: 'Fiche technique HXC-FB80 : sensibilité F13 à 2000 lx (50 Hz) ; mode d\'emploi HXC-FB80 : bouton FILTER (CLEAR, 1/4, 1/16, 1/64 ND), commutateurs GAIN et SHUTTER, affichages du viseur (VF DISPLAY) ; diaphragmes : 2 log2 (N1 ÷ N2) pour l\'iris, log2 de la transmission pour le ND, dB ÷ 6,02 pour le gain, log2 du rapport des temps de pose',
  competences: ['2.9', '1.4', '3.4'],
};

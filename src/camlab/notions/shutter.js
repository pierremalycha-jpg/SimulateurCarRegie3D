// @ts-check
// ----------------------------------------------------------------------------------
// Fiche « L'obturateur électronique ». Mode d'emploi HXC-FB80 : commutateur SHUTTER sur le côté
// droit (ON : shutter en service, OFF, SEL : passer à la vitesse ou au mode suivant, affichés
// quelques secondes dans le viseur) ; vitesses en 50i/50P : 1/60, 1/125, 1/250, 1/500, 1/1000,
// 1/2000 s (en 59,94 : 1/100 à 1/2000) ; mode ECS (clear scan) : fréquence réglée à la molette du
// menu ; indicateur SHUTTER du viseur (page VF DISPLAY), absent quand le shutter est sur OFF ;
// commandé par le RCP quand la caméra est reliée. Plage ECS en 1080/50i : de 50,00 à 4700 Hz
// d'après l'édition espagnole du mode d'emploi (à vérifier). Fiche technique : shutter lent
// (SLS) de 2 à 8 images, en 1080. Secteur 50 Hz : lumière modulée à 100 Hz. Ballon à 5 m/s :
// 10 cm pendant 1/50 s, 1 cm à 1/500. Scintillement d'une lumière sinusoïdale à F pour une pose
// te (contraste (max − min) ÷ (max + min)) : m |sin(π F te) ÷ (π F te)|, nul pour un nombre entier de périodes. Perte de lumière :
// log2(te × 50) diaphragmes (1/500 : −3,3). La manipulation (camlab/labs/ch23.js, « shutter »).
// ----------------------------------------------------------------------------------

/** @type {import('./index.js').FicheCamera} */
export const SHUTTER = {
  t: 'L\'obturateur électronique', aka: 'Shutter, clear scan (ECS) ; temps de pose, angle d\'obturation', chap: 3, lot: 2, point: 'menu',
  short: 'La durée pendant laquelle chaque image reçoit la lumière : 1/50 s par défaut ; plus court, le mouvement est plus net mais saccadé. Le clear scan cale ce temps sur un écran pour supprimer ses bandes.',
  fig: 'shutter',
  lab: 'shutter',
  body: "**Pas de rideau.** La caméra n'a pas d'obturateur mécanique : chaque photosite est vidé, puis lu un peu plus tard, et le temps entre les deux est le **temps de pose**. Shutter sur **OFF**, il dure toute la trame : 1/50 s, 20 ms. Le shutter le raccourcit : 1/60, 1/125, 1/250, 1/500, 1/1000, 1/2000 s en 50 Hz.\n\n**Plus net, mais saccadé.** Un ballon qui roule à 5 m/s avance de 10 cm en 1/50 s : sur l'image, c'est une traînée. À 1/500, il n'avance que de 1 cm : il est net. Mais entre deux images, il y a maintenant 18 ms pendant lesquelles rien n'est capté : le ballon net saute de place en place, le mouvement **saccade**. Le flou de bouger de 1/50 est ce qui rend le mouvement fluide à 50 images par seconde.\n\n**Moins de lumière.** Chaque fois que le temps de pose est divisé par deux, la lumière aussi : 1/100 coûte un diaphragme, 1/500 3,3, 1/2000 6,6. Le shutter n'est pas un réglage d'exposition : on le choisit pour le mouvement, et l'iris rattrape.\n\n**Le scintillement.** Sur le secteur 50 Hz, beaucoup de lampes vibrent à 100 Hz. Si le temps de pose contient un nombre entier de vibrations, chaque image reçoit la même lumière : 1/50 s en contient deux, 1/100 une. À 1/60 ou 1/125, ce n'est plus un nombre entier : l'image scintille. Et comme le capteur CMOS est lu ligne après ligne, chaque ligne reçoit un morceau différent de la vibration : des **bandes** horizontales défilent dans l'image.\n\n**Le clear scan.** Un écran du décor s'allume et s'éteint à sa propre fréquence, 60 Hz par exemple. Le mode **ECS** (clear scan) règle le temps de pose au dixième de hertz près : quand il vaut exactement une période de l'écran, 1/60 s, les bandes s'arrêtent. Le même mode donne 1/100 s sous des lampes à 100 Hz, une vitesse que la liste fixe n'a pas en 50 Hz.",
  vraie: "Le commutateur **SHUTTER** est sur le côté droit du corps : **ON** met le shutter en service, **OFF** l'arrête. Poussé vers **SEL**, il affiche la vitesse en cours dans le viseur ; une nouvelle poussée, avant que l'affichage disparaisse, passe à la vitesse suivante, puis au mode ECS. En ECS, on règle la fréquence en tournant la molette du menu. L'indicateur SHUTTER du viseur (page VF DISPLAY) rappelle le réglage ; il disparaît sur OFF.\n\nReliée à la CCU, c'est le RCP qui commande le shutter, et le commutateur du corps ne fait plus rien.\n\n**Le bon geste.** Shutter sur OFF pour l'antenne. Un écran dans le champ fait des bandes : passer en ECS et tourner la molette jusqu'à ce qu'elles s'arrêtent, en regardant l'écran dans le viseur.\n\n**L'erreur fréquente.** Fermer l'image au shutter parce qu'il y a trop de lumière : elle s'assombrit, mais le mouvement saccade et les lampes du plateau se mettent à scintiller. Le ND est fait pour ça.",
  plus: "- **L'angle d'obturation.** Le cinéma compte le temps de pose en degrés d'un disque tournant : 360° pour toute la durée d'une image, 180° pour la moitié. À 50 images par seconde, 1/100 s, c'est 180° ; 1/500 s, 36°.\n- **Pourquoi 1/60 en 50 Hz.** Dans un pays au secteur 60 Hz, les lampes vibrent à 120 Hz : 1/60 s en contient exactement deux. À l'inverse, en 59,94 Hz, la caméra propose 1/100 s pour les lampes du secteur 50 Hz.\n- **Obturateur global.** Un capteur à obturation globale expose toutes ses lignes au même instant : pas de bandes qui défilent, mais toute l'image qui pulse si le temps de pose ne tombe pas juste.\n- **Les murs LED.** Ils se rafraîchissent souvent à plusieurs centaines ou milliers de hertz (ordre de grandeur). À 1/50 s, ils ne gênent pas ; avec un temps de pose court, il faut caler le clear scan sur un multiple de leur période.\n- **Le shutter lent.** Dans le noir, la FB80 peut accumuler de 2 à 8 images en une seule (en 1080) : plus de lumière, mais le mouvement se traîne. Pour un plan fixe seulement.",
  car: "Les HDC-5500 du car ont un obturateur global : un flash d'appareil photo n'y coupe pas l'image en deux, mais un écran mal calé y fait pulser toute l'image. Les caméras de super ralenti posent au plus 1/150 s en 3x, une vibration et demie d'une lampe à 100 Hz : c'est pour elles qu'on demande à l'éclairage LED d'un stade de ne pas vibrer. Les panneaux LED du bord du terrain font parfois des bandes : la vision cale le clear scan depuis le RCP.",
  quiz: [
    {
      q: 'Le ballon roule à 5 m/s. De combien avance-t-il pendant une pose de 1/50 s ?',
      a: [
        ['1 cm.', 'C\'est à 1/500 s : dix fois plus court.'],
        ['10 cm : la traînée du ballon sur l\'image.', 'Exact : 5 m/s × 0,02 s. C\'est ce flou qui rend le mouvement fluide.'],
        ['1 m.', 'Ce serait le chemin parcouru en 1/5 de seconde, dix images.'],
      ],
      ok: 1,
    },
    {
      q: 'Sous des lampes qui vibrent à 100 Hz (secteur 50 Hz), quel réglage scintille ?',
      a: [
        ['OFF, 1/50 s.', '1/50 s contient exactement deux vibrations : chaque image reçoit la même lumière.'],
        ['ECS à 100 Hz, soit 1/100 s.', 'Une vibration exactement : pas de scintillement.'],
        ['1/125 s.', 'Exact : 0,8 vibration par image, pas un nombre entier. Chaque ligne reçoit une lumière différente.'],
      ],
      ok: 2,
    },
    {
      q: 'Un écran du décor fait défiler des bandes sombres dans l\'image. Que fait-on ?',
      a: [
        ['On passe en clear scan (ECS) et on règle la fréquence jusqu\'à ce que les bandes s\'arrêtent.', 'Exact : le temps de pose vaut alors une période de l\'écran.'],
        ['On monte le gain.', 'Le gain amplifie l\'image, bandes comprises.'],
        ['On met un filtre ND.', 'Le ND retire de la lumière à tout, il ne change pas le temps de pose.'],
      ],
      ok: 0,
    },
  ],
  see: ['exposition', 'capteur', 'formats', 'hfr', 'menu', 'commandes'],
  ref: 'Mode d\'emploi HXC-FB80 : commutateur SHUTTER (ON, OFF, SEL), vitesses en 50 Hz 1/60, 1/125, 1/250, 1/500, 1/1000, 1/2000 s (1/100 à 1/2000 en 59,94 Hz), mode ECS réglé à la molette, indicateur SHUTTER (VF DISPLAY) ; fiche technique HXC-FB80 : shutter lent 2 à 8 images (1080) ; secteur 50 Hz : lumière modulée à 100 Hz',
  competences: ['2.9'],
};

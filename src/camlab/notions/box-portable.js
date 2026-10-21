// @ts-check
// ----------------------------------------------------------------------------------
// Fiche « Objectif portable ou box ». Objectif portable de la caméra du plateau : Fujinon
// ZA12x4.5BERD, 4,5–54 mm, f/1,8 (f/2,4 à 54 mm), 2,07 kg sans pare-soleil (fiche Fujinon récente,
// version RD ; une fiche plus ancienne donne 1,74 kg : à vérifier), poignée de servo. Objectifs du car
// (data/cameras.js, chiffres constructeur) : Fujinon UA24x7.8BERD, 7,8–187 mm, f/1,8 jusqu'à 118 mm,
// 1,98 kg ; Fujinon UA80x9BESM (box), 9–720 mm, f/1,7 jusqu'à 350 mm puis f/3,5 à 720 mm, 23,5 kg,
// doubleurs ×1,2 et ×2. Adaptateur grand objectif (type Sony HDLA-3505) : 15,5 kg, câble d'objectif
// à 36 broches (leçon « Monter une caméra de stade », glossaire). Focale qui cadre une hauteur H à la
// distance D sur un capteur 2/3" (5,39 mm de haut) : f = D × 5,39 ÷ H. La manipulation
// (camlab/labs/ch1.js, « box-portable ») fait choisir l'objectif et la focale de trois plans.
// ----------------------------------------------------------------------------------

/** @type {import('./index.js').FicheCamera} */
export const BOX_PORTABLE = {
  t: 'Objectif portable ou box', aka: 'ENG/EFP lens, studio/field box lens ; commandes reportées (zoom demand, focus demand)', chap: 1, lot: 3, point: 'manches',
  short: 'Un objectif portable se tient à la main ; un objectif box de stade se pilote seulement par les commandes reportées sur les manches.',
  fig: 'box-portable',
  lab: 'box-portable',
  body: "**Deux familles, la même monture.** Les zooms broadcast 2/3\" ont tous la monture B4, mais ils se divisent en deux familles.\n\n**L'objectif portable.** Celui de la caméra du plateau : le ZA12x4.5, 4,5 à 54 mm, environ 2 kg. Il se monte directement sur la caméra et porte sa **poignée de servo** : la bascule de zoom sous les doigts, la touche RET, le sélecteur de l'iris. On peut s'en servir à l'épaule, sur un Steadicam, ou sur un pied avec des commandes reportées branchées sur la poignée. Les portables vont du grand angle (4,5 mm) à des focales de quelques centaines de millimètres : l'UA24x7.8 du car monte à 187 mm.\n\n**L'objectif box.** Un grand zoom dans un caisson : l'UA80x9 du car va de 9 à 720 mm et pèse 23,5 kg. Il ne se tient pas à la main. Il se monte, avec la caméra, sur un **adaptateur grand objectif** (15,5 kg), sur un pied lourd et une tête fluide. Il n'a pas de poignée : le zoom et le point ne se commandent que par les **commandes reportées** fixées sur les manches de la tête, la bascule de zoom sous le pouce d'une main, la molette de point sous l'autre.\n\n**Pourquoi si gros.** Pour garder une grande ouverture au long foyer, il faut une grande pupille d'entrée : focale ÷ nombre f. L'UA80x9 tient f/1,7 jusqu'à 350 mm : 350 ÷ 1,7 = 206 mm de pupille, contre 23 mm pour le ZA12x4.5 à 41 mm. Une lentille frontale de cette taille fait le poids et le prix.\n\n**Quelle focale pour quel plan.** La hauteur cadrée à la distance D vaut D × 5,39 ÷ focale (le capteur 2/3\" fait 5,39 mm de haut). Donc la focale d'un plan :\n- un présentateur en plan poitrine (60 cm) à 3 m : 3 × 5,39 ÷ 0,6 = 27 mm, le portable du plateau suffit ;\n- un joueur en pied (2 m) à 80 m, depuis la tribune : 216 mm, hors de portée du ZA12x4.5 même doublé ;\n- son visage (40 cm) à 80 m : 1078 mm, seulement le box avec son doubleur.",
  vraie: "Sur le pied du plateau, les commandes reportées de zoom et de point se branchent sur la poignée du ZA12x4.5 (les prises à embout vert) : le zoom sur le manche droit, sous le pouce ; le point sur le manche gauche, à la manivelle. Le côté de chaque commande est une préférence d'opérateur, on l'installe pour le cadreur.\n\n**Le bon geste.** Un box se lève à deux, tête de pied verrouillée, adaptateur déjà bloqué ; on équilibre la caméra une fois tout monté. Brancher les commandes reportées avant de libérer la tête, et vérifier le sens et la vitesse de la bascule avant l'antenne.\n\n**L'erreur fréquente.** Mettre un objectif portable au long foyer sur une position de tribune lointaine : il faut son doubleur, et l'image perd deux diaphragmes, ce qui se voit en nocturne. Ou oublier qu'un box n'a aucune commande à la main : sans ses commandes reportées branchées, le cadreur ne peut ni zoomer ni faire le point.",
  plus: "- **Le câble.** Un portable se branche sur la prise LENS de la caméra par son câble 12 broches ; un box se branche sur l'adaptateur grand objectif par un câble à 36 broches (voir la leçon « Monter une caméra de stade »).\n- **Le doubleur des box.** Les grands zooms de stade ont souvent deux doubleurs, ×1,2 et ×2. Avec le ×2, le visage d'un joueur à 80 m demande 1078 mm : 539 mm × 2, à f/5,2, plus de trois diaphragmes de moins qu'à f/1,7.\n- **Les box de studio.** Il existe aussi des box de studio, plus courts (20 à 30 fois), pour les grands plateaux de télévision : le même confort de commande sur pied, avec des focales de plateau.\n- **Les mémoires de zoom.** Les commandes reportées numériques des box gardent des positions et des vitesses de zoom : le cadreur retrouve exactement un cadre préparé.",
  car: "Dans le car du simulateur, les caméras de tribune sont des Sony HDC-5500 dans un adaptateur grand objectif, avec des box Fujinon (UA80, UA107) ; les caméras d'épaule et de Steadicam ont des portables (UA24 le plus souvent), la grue et la caméra volante un grand angle portable (UA13). Le plan caméras du stade dit, position par position, quel objectif monter.",
  cours: 'camera-montage',
  quiz: [
    {
      q: 'Un objectif box n\'a pas de poignée de servo. Comment le cadreur zoome-t-il ?',
      a: [
        ['À la bague de zoom, à la main.', 'Un box de 23,5 kg dans son caisson ne se commande pas à la bague : elle est enfermée et motorisée.'],
        ['Par les commandes reportées fixées sur les manches : la bascule de zoom sous le pouce, la molette de point sous l\'autre main.', 'Exact : ce sont les seules commandes du box.'],
        ['Par le RCP de la vision.', 'Le RCP règle l\'iris et la peinture de l\'image, pas le cadre.'],
      ],
      ok: 1,
    },
    {
      q: 'Depuis la tribune, à 80 m, il faut un joueur en pied (2 m de haut). Le ZA12x4.5 suffit-il ?',
      a: [
        ['Oui, avec le doubleur : 108 mm.', 'À 108 mm, on cadre 80 × 5,39 ÷ 108 = 4 m de haut : le joueur ne fait que la moitié de l\'image.'],
        ['Oui, à 54 mm.', 'À 54 mm, on cadre 8 m de haut : le joueur est tout petit.'],
        ['Non : il faut 80 × 5,39 ÷ 2 = 216 mm, un objectif box ou un long portable.', 'Exact : c\'est le rôle des box de tribune, ici à pleine ouverture, f/1,7.'],
      ],
      ok: 2,
    },
    {
      q: 'Pourquoi un box qui tient f/1,7 jusqu\'à 350 mm est-il si gros et si lourd ?',
      a: [
        ['Parce qu\'il faut une pupille d\'entrée de 350 ÷ 1,7 ≈ 206 mm, donc des lentilles de devant de cette taille.', 'Exact : le nombre f est focale ÷ pupille ; au long foyer, la lumière coûte du verre.'],
        ['Parce qu\'il contient un capteur plus grand.', 'Le capteur est dans la caméra, le même 2/3" que pour un portable.'],
        ['Parce que son caisson est blindé contre la pluie.', 'Le caisson protège, mais le poids vient du verre et des moteurs.'],
      ],
      ok: 0,
    },
  ],
  see: ['zoom', 'focale', 'cadreur', 'monture', 'doubleur', 'ramping'],
  ref: 'Fiche Fujinon ZA12x4.5BERD (4,5–54 mm, 2,07 kg) ; fiches Fujinon UA24x7.8BERD (7,8–187 mm, 1,98 kg) et UA80x9BESM (9–720 mm, f/1,7 jusqu\'à 350 mm, 23,5 kg) ; capteur 2/3" de 9,59 × 5,39 mm',
  competences: ['3.4', '2.7'],
};

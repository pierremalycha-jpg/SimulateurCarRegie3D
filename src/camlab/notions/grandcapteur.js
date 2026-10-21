// @ts-check
// ----------------------------------------------------------------------------------
// Fiche « Grand capteur ou tri-capteur ». 2/3″ 16:9 : 9,59 × 5,39 mm, cercle image 11 mm. Super 35 :
// environ 25 × 14 mm (ordre de grandeur, selon les caméras ; calculs à 24,9 mm), cercle 28,6 mm,
// 2,6 fois plus large. Profondeur de champ par l'hyperfocale H = f² ÷ (N × c), c proportionnel au
// capteur : 0,011 mm en 2/3″, 0,029 mm en Super 35 (camlab/labs/ch89.js, dofOf). Visage de 50 cm à
// 3 m : 58 mm et 16 cm nets à f/2,8 en 2/3″, 149 mm et 6 cm en Super 35 ; même zone nette vers
// f/7,3. Joueur à 50 m cadré sur 4 m : 6 m nets à f/1,6 en 2/3″, f/4,1 en Super 35. Zooms : Fujinon
// UA125x8BESM (8–1 000 mm, f/1,7 jusqu'à 340 mm, f/5 à 1 000 mm, data/cameras.js) ; Fujinon Duvo
// HZK25-1000mm (Super 35 : 25–1 000 mm, rapport 40, f/2,8 à 25 mm, f/5 à 1 000 mm, fiche Fujifilm).
// Caméra système Super 35 : type Sony HDC-F5500 (capteur Super 35 4K, monture PL).
// ----------------------------------------------------------------------------------

/** @type {import('./index.js').FicheCamera} */
export const GRANDCAPTEUR = {
  t: 'Grand capteur ou tri-capteur', aka: 'Caméra Super 35 à un capteur, caméra 2/3″ à prisme et trois capteurs', chap: 9, lot: 3,
  short: 'Les caméras Super 35 à un seul capteur : moins de profondeur de champ, d\'autres objectifs, et pourquoi le direct garde souvent le tri-capteur 2/3".',
  fig: 'grandcapteur',
  lab: 'grandcapteur',
  body: "**Deux façons de faire une caméra.**\n- Le **tri-capteur 2/3″** (la FB80, les caméras système du car) : un prisme sépare le rouge, le vert et le bleu vers trois capteurs de 9,59 × 5,39 mm ; objectifs à monture B4.\n- Le **grand capteur Super 35** (du nom du film de cinéma de 35 mm) : un seul capteur d'environ 25 × 14 mm (ordre de grandeur, selon les caméras), couvert d'une mosaïque de filtres colorés, le filtre de Bayer : chaque photosite ne voit qu'une couleur et la caméra recalcule les deux autres. Objectifs de cinéma, à monture PL.\n\n**Même cadre, autre focale.** Le Super 35 est environ 2,6 fois plus large. Pour cadrer un visage de 50 cm de large à 3 m, il faut 58 mm en 2/3″ et 149 mm en Super 35 : la focale suit la taille du capteur.\n\n**Même cadre, moins de profondeur de champ.** À la même ouverture, la zone nette est environ 2,6 fois plus courte : à f/2,8, 16 cm en 2/3″ et 6 cm en Super 35 pour ce visage, et le fond est 2,6 fois plus flou. C'est le « look cinéma » : le sujet se détache du décor.\n\n**Pour retrouver la même zone nette,** il faut fermer de 2,6 fois en nombre f, environ 2,8 diaphragmes, donc recevoir 7 fois moins de lumière : f/2,8 en 2/3″ vaut environ f/7,3 en Super 35. À image égale (même cadre, même zone nette), les deux capteurs reçoivent la même lumière en tout : le grand capteur n'est plus sensible que si l'on accepte moins de profondeur de champ.\n\n**Pourquoi le direct garde le 2/3″.**\n- **Les zooms.** En 2/3″, des objectifs box de 8 à 1 000 mm (rapport 125), ouverts à f/1,7 jusqu'à 340 mm. En Super 35, les plus longs zooms de direct vont de 25 à 1 000 mm (rapport 40), de f/2,8 à f/5 au bout ; et à 1 000 mm, le Super 35 cadre comme un 385 mm en 2/3″.\n- **Le point.** Le cadreur fait son point lui-même, à la volée, sur un joueur qui court. La profondeur de champ du 2/3″ pardonne ; en Super 35, il faudrait souvent un pointeur.\n- **La lumière.** Au stade, la nuit, garder 6 m nets autour d'un joueur à 50 m demande f/1,6 en 2/3″ et f/4,1 en Super 35 : presque trois diaphragmes de plus.\n- **Le parc.** Objectifs B4, fibres et CCU sont déjà là.\n\nLe Super 35 entre en direct pour quelques caméras choisies : au bord du terrain, pour une cérémonie, un concert, là où le flou du fond raconte quelque chose.",
  vraie: "La HXC-FB80 est un tri-capteur 2/3″ : on n'y monte pas d'objectif de cinéma. Une caméra de plateau Super 35 est une autre caméra, par exemple de type Sony HDC-F5500 (capteur Super 35 4K, monture PL), reliée à sa CCU par la même fibre que les caméras système.\n\n**Le bon geste.** En Super 35, prévoir la mise au point : les aides du viseur (peaking, loupe), un pointeur à distance si le sujet bouge en profondeur, et fermer un peu quand la lumière le permet. À la vision, savoir qu'à zone nette égale l'image demande plus de lumière.\n\n**L'erreur fréquente.** Croire qu'un grand capteur « voit plus large » : à la même focale, oui, mais on raisonne en cadre. Ou monter un objectif B4 sur un grand capteur sans adaptateur optique : son image fait 11 mm de diagonale pour un capteur de 28,6 mm, les coins sont noirs.",
  plus: "- **Le facteur de recadrage.** 24,9 ÷ 9,59 ≈ 2,6 : c'est le rapport des largeurs. Pour le plein format (36 mm de large), il passe à environ 3,8.\n- **Le cercle de confusion.** La netteté admise se rapporte à la taille de l'image : 0,011 mm en 2/3″ (deux photosites HD), environ 0,029 mm en Super 35. C'est lui qui fait toute la différence de profondeur de champ.\n- **Un adaptateur B4 vers grand capteur** agrandit l'image de l'objectif, d'environ 2,6 fois : il perd autant en ouverture, un f/1,8 devient environ f/4,7.\n- **Bayer ou prisme.** Le prisme donne trois images pleines ; le capteur de Bayer recalcule deux couleurs sur trois à chaque photosite : à nombre de photosites égal, un peu moins de finesse dans les couleurs.\n- **Le grand capteur et le bruit.** À nombre de pixels égal, ses photosites sont plus grands : moins de bruit à la même ouverture. Mais à zone nette égale, on ferme, et l'avantage disparaît.",
  car: "Dans le car du simulateur, les caméras système sont des tri-capteurs 2/3″ (HDC-5500, HDC-3500), avec des zooms Fujinon jusqu'au UA125x8 (8 à 1 000 mm). Une caméra Super 35 serait une caméra à part, au bord du terrain ou pour un plan d'ambiance, avec son pointeur.",
  quiz: [
    {
      q: 'Même cadre, même f/2,8 : on passe du 2/3″ au Super 35. La zone nette…',
      a: [
        ['devient environ 2,6 fois plus courte.', 'Exact : 16 cm en 2/3″, 6 cm en Super 35, pour un visage de 50 cm de large à 3 m.'],
        ['reste la même : c\'est le même f/2,8.', 'Le nombre f fixe l\'exposition, pas la zone nette : à cadre égal, le grand capteur demande une focale 2,6 fois plus longue.'],
        ['devient plus longue : le capteur est plus grand.', 'C\'est l\'inverse : la focale plus longue réduit la zone nette.'],
      ],
      ok: 0,
    },
    {
      q: 'Pourquoi les caméras principales d\'un match restent-elles en 2/3″ ?',
      a: [
        ['Parce que le Super 35 ne sait pas faire de 4K.', 'Il le sait : les caméras Super 35 de direct sont 4K.'],
        ['Parce que le 2/3″ donne une image plus nette.', 'Ce n\'est pas une question de netteté : ce sont les zooms, la profondeur de champ et la lumière.'],
        ['Pour les zooms très longs (jusqu\'à 1 000 mm, rapport 125) et une profondeur de champ qui laisse le cadreur faire son point.', 'Exact : et à zone nette égale, le 2/3″ demande près de trois diaphragmes de lumière en moins.'],
      ],
      ok: 2,
    },
    {
      q: 'En Super 35, pour retrouver la zone nette d\'un 2/3″ à f/2, il faut fermer vers…',
      a: [
        ['f/2 : le nombre f est le même partout.', 'Il donne la même exposition, pas la même zone nette.'],
        ['f/5,2, avec environ 7 fois moins de lumière.', 'Exact : 2 × 2,6 ≈ 5,2, soit environ 2,8 diaphragmes.'],
        ['f/1 : il faut ouvrir.', 'Ouvrir réduirait encore la zone nette.'],
      ],
      ok: 1,
    },
  ],
  see: ['capteur', 'pdc', 'prisme', 'focale', 'monture', 'hdr'],
  ref: 'Capteur 2/3″ 16:9 : 9,59 × 5,39 mm, cercle image 11 mm ; Super 35 : environ 25 × 14 mm (ordre de grandeur selon les caméras) ; profondeur de champ par l\'hyperfocale H = f² ÷ (N × c), c proportionnel au capteur (0,011 mm en 2/3″) ; Fujinon UA125x8BESM (8–1 000 mm, f/1,7) ; Fujinon Duvo HZK25-1000mm (Super 35 : 25–1 000 mm, f/2,8 à f/5) ; Sony HDC-F5500 (Super 35, monture PL)',
  competences: ['3.4', '2.7'],
};

// @ts-check
// ----------------------------------------------------------------------------------
// Fiche « La lentille frontale ». Réflexion d'une surface air-verre en incidence normale (Fresnel) :
// ((n − 1) / (n + 1))², soit 4,0 % pour n = 1,5. Couche quart d'onde de fluorure de magnésium
// (n = 1,38) sur un verre d'indice 1,52 : ((1,52 − 1,38²) / (1,52 + 1,38²))² = 1,3 %. Multicouche :
// de l'ordre de 0,2 % (ordre de grandeur). Trente surfaces air-verre (ordre de grandeur d'un zoom) :
// 0,96³⁰ = 29 % de lumière transmise en verre nu, 0,987³⁰ = 68 %, 0,998³⁰ = 94 %. Champ du
// ZA12x4.5BERD à 4,5 mm : 93,6° × 61,8° (fiche Fujinon). Pare-soleil : dimensions de la caméra 3D
// (camlab/model.js), ouverture de 208 × 158 mm à 84,5 mm devant une lentille de 85 mm : ombre complète
// au-delà de 60° de l'axe. Filetage de filtre sur le pare-soleil : M127 × 0,75 (fiche Fujinon récente ;
// une fiche plus ancienne donne M82, à vérifier). La manipulation (camlab/labs/ch1.js, « frontale »)
// calcule le voile et la lumière transmise ; le voile est un modèle de la maquette (ordre de grandeur).
// ----------------------------------------------------------------------------------

/** @type {import('./index.js').FicheCamera} */
export const FRONTALE = {
  t: 'La lentille frontale', aka: 'Front element ; traitement anti-reflet, pare-soleil (lens hood)', chap: 1, lot: 2, point: 'frontale',
  short: 'La première lentille que traverse la lumière : son traitement anti-reflet, le pare-soleil qui la protège, et comment la nettoyer sans la rayer.',
  fig: 'frontale',
  lab: 'frontale',
  body: "**La plus grande lentille.** Devant l'objectif, la lentille frontale est la plus large : à 4,5 mm, elle doit recevoir un champ de 94° de large. C'est aussi la plus exposée : poussière, doigts, pluie, projecteurs. Tout ce qui se pose sur elle se retrouve, adouci, sur toute l'image.\n\n**Pourquoi un traitement.** À chaque passage de l'air au verre, une partie de la lumière se réfléchit au lieu de passer. Pour un verre d'indice 1,5, la formule de Fresnel donne ((1,5 − 1) ÷ (1,5 + 1))² = 4 %. Un zoom compte une trentaine de surfaces air-verre (ordre de grandeur) :\n- en verre nu, 0,96 à la puissance 30 : il n'arrive que 29 % de la lumière, presque deux diaphragmes de perdus ;\n- avec une couche simple de fluorure de magnésium, 1,3 % par surface : 68 % ;\n- avec un traitement multicouche, de l'ordre de 0,2 % par surface : 94 %.\n\nLa lumière réfléchie ne disparaît pas : elle rebondit d'une lentille à l'autre et finit sur les capteurs, en voile gris sur toute l'image et en images fantômes. Le traitement multicouche, ces reflets violets ou verts qu'on voit sur la lentille, est ce qui rend possible un zoom de trente surfaces.\n\n**Le pare-soleil.** Il fait de l'ombre sur la lentille pour tout ce qui est hors du champ : un projecteur sur le côté, le soleil, un écran du décor. Il est rectangulaire parce que l'image est en 16:9, et court parce qu'au grand angle il ne doit pas entrer dans l'image. Sur la caméra du module, son bord met toute la lentille à l'ombre d'une lumière à plus de 60° de l'axe ; entre 36 et 60°, une partie de la lentille reste éclairée.\n\n**La nettoyer sans la rayer.** Le traitement est plus fragile que le verre. Un grain de poussière frotté devient un abrasif. L'ordre :\n1. la soufflette (une poire, ou une bombe d'air sec tenue droite) chasse les grains sans toucher ;\n2. un pinceau doux décroche ceux qui restent ;\n3. seulement ensuite, une trace grasse : une goutte de liquide pour optique sur le papier optique, jamais sur la lentille, et on essuie en spirale du centre vers le bord.",
  vraie: "La lentille frontale est derrière le pare-soleil du ZA12x4.5, qui se fixe sur le barillet avant. Le bouchon avant se met sur le pare-soleil.\n\n**Le bon geste.** Le bouchon dès que la caméra ne tourne plus, et pendant les transports. Regarder la lentille à contre-jour avant le line-up : une trace se voit mieux en lumière rasante. Pendant l'émission, si un projecteur entre dans le pare-soleil, on demande à l'éclairagiste un drapeau (un cache noir sur le projecteur) plutôt que de tourner la caméra.\n\n**L'erreur fréquente.** Souffler avec la bouche : on dépose de la salive. Essuyer d'abord, au tee-shirt ou au mouchoir, avec la poussière dessus : c'est comme ça qu'on raye un traitement. Ou vaporiser le liquide directement sur la lentille : il coule dans le joint et s'infiltre entre les lentilles.",
  plus: "- **Les couches minces.** Une couche d'épaisseur égale au quart de la longueur d'onde renvoie deux reflets qui s'annulent. Une seule couche n'est parfaite que pour une couleur ; un multicouche empile plusieurs couches pour couvrir tout le visible.\n- **Le voile se mesure.** Sur la forme d'onde, le voile soulève le noir : une image qui devrait descendre à 0 % reste à quelques pour cent, et les couleurs sombres se délavent. C'est le premier symptôme d'une lentille sale.\n- **Au serré, le pare-soleil protège mal.** Il est taillé pour le champ du grand angle : à 54 mm, une lumière à 30° de l'axe est loin hors du champ mais touche encore toute la lentille. D'où le drapeau, ou un pare-soleil plus long sur un objectif qui ne travaille qu'en serré.\n- **Les filtres de devant.** Un polariseur ou un filtre d'effet se visse sur le pare-soleil : la fiche Fujinon du ZA12x4.5 donne un filetage de 127 mm. Un filtre de plus, c'est deux surfaces de plus : un filtre traité, toujours.\n- **La pluie.** Une goutte sur la lentille, c'est une tache floue sur l'image. Housse de pluie et pare-soleil, et un papier optique sec à portée de main.",
  car: "Au stade, les objectifs passent l'après-midi dehors : le cadreur vérifie sa lentille avant le line-up, la vision voit tout de suite une caméra dont les noirs sont plus clairs que les autres. En nocturne, les projecteurs du stade entrent souvent dans le pare-soleil des caméras basses : c'est là que se forment les images fantômes.",
  quiz: [
    {
      q: 'Pourquoi un zoom sans traitement anti-reflet serait-il inutilisable ?',
      a: [
        ['Parce que le verre nu absorbe la lumière dans sa masse.', 'Le verre absorbe très peu. La perte vient des réflexions, 4 % à chaque surface.'],
        ['Parce que 4 % réfléchis à chacune de la trentaine de surfaces, il n\'arrive que 29 % de la lumière, et le reste fait un voile sur l\'image.', 'Exact : 0,96 à la puissance 30 = 0,29. Et la lumière réfléchie finit en voile et en images fantômes.'],
        ['Parce que le traitement rend l\'objectif étanche.', 'Le traitement ne sert pas à l\'étanchéité, il sert à réduire les reflets.'],
      ],
      ok: 1,
    },
    {
      q: 'Une trace de doigt et de la poussière sur la lentille. Dans quel ordre nettoyer ?',
      a: [
        ['Soufflette, pinceau doux, puis papier optique avec une goutte de liquide, en spirale du centre vers le bord.', 'Exact : d\'abord ce qui ne touche pas le verre, pour ne pas frotter un grain.'],
        ['Papier optique d\'abord, pour tout enlever d\'un coup.', 'Le papier frotterait les grains sur le traitement : c\'est ainsi qu\'on le raye.'],
        ['Liquide vaporisé sur la lentille, puis chiffon.', 'Le liquide coule dans le joint, et un chiffon de vêtement étale le gras et traîne les grains.'],
      ],
      ok: 0,
    },
    {
      q: 'Un projecteur à 50° de l\'axe frappe la lentille malgré le pare-soleil. Que fait-on ?',
      a: [
        ['On monte un pare-soleil deux fois plus long.', 'Au grand angle, il entrerait dans le champ : on le verrait dans les coins.'],
        ['On ferme l\'iris pour réduire le voile.', 'Le voile vient de la lumière qui touche la lentille ; fermer l\'iris assombrit l\'image sans enlever le reflet.'],
        ['On demande un drapeau sur le projecteur, ou on le déplace, pour que la lentille soit à l\'ombre.', 'Exact : sur cette caméra, au-delà de 60° de l\'axe, le bord du pare-soleil fait toute l\'ombre.'],
      ],
      ok: 2,
    },
  ],
  see: ['defauts', 'nd', 'iris', 'focale', 'waveform'],
  ref: 'Fresnel (incidence normale) : R = ((n − 1) / (n + 1))² ; fiche Fujinon ZA12x4.5BERD : champ 93,6° × 61,8° à 4,5 mm, filetage de filtre sur le pare-soleil ; dimensions du pare-soleil : caméra 3D du module',
  competences: ['3.12', '2.7'],
};

// @ts-check
// ----------------------------------------------------------------------------------
// Fiche « Knee et white clip ». Plafond du signal : code 1019, 109 % (ITU-R BT.709). Tolérance de
// l'EBU R 103 reprise par beaucoup de diffuseurs : environ 103 % en luminance (comme la leçon
// signal-niveaux). Knee point courant entre 85 et 95 % (ordre de grandeur ; 95 % au RCP du
// simulateur, white clip 103 %). Calcul : point 90 %, pente 1/10, une lumière qui donnerait 190 %
// sort à 100 % ; pentes de 1/10 à 1/20 : de deux à trois diaphragmes rangés au-dessus du blanc
// (190 % ↔ 3,8 fois la lumière du blanc, 290 % ↔ 9,3 fois). Mode d'emploi HXC-FB80 : menu PAINT,
// P01 SW STATUS (KNEE, WHT CLIP), P07 KNEE (K POINT, K SLOPE de −99 à +99 en R, G, B, M ; KNEE MAX,
// KNEE SAT, AUTO KNEE), P08 WHITE CLIP ; commutateur OUTPUT/AUTO KNEE. La manipulation
// (camlab/labs/ch4.js, « knee ») garde les nuages d'une fenêtre quatre fois plus claire que le
// plateau, puis huit fois au soleil, et plafonne au white clip.
// ----------------------------------------------------------------------------------

/** @type {import('./index.js').FicheCamera} */
export const KNEE = {
  t: 'Knee et white clip', aka: 'Coude (knee point, knee slope) ; écrêteur des blancs (white clip)', chap: 4, lot: 3, point: 'menu',
  short: 'Le coude qui comprime les hautes lumières pour garder du détail dans une fenêtre, et le plafond au-dessus duquel le blanc est écrêté.',
  fig: 'knee',
  lab: 'knee',
  cours: 'signal-niveaux',
  body: "**Le problème.** Exposée pour un visage, la caméra voit une fenêtre en plein jour deux, quatre, huit fois plus lumineuse que le blanc du plateau. Avec la seule courbe BT.709, tout ce qui dépasse le plafond du signal est coupé : la fenêtre devient un aplat blanc, sans un nuage.\n\n**Le knee, le coude.** Au-dessus d'un niveau choisi, le **knee point** (souvent entre 85 et 95 %, c'est un ordre de grandeur), la courbe se plie : le signal monte beaucoup moins vite, selon la **pente** (knee slope). Avec un point à 90 % et une pente d'un pour dix, une lumière qui aurait donné 190 % sort à 100 % : la fenêtre garde ses nuages, un peu tassés, au lieu d'un aplat.\n- Sous le point, rien ne change : les visages, les gris, les noirs.\n- Au-dessus, le contraste est réduit : le détail est là, mais plus doux.\n\n**Le white clip.** C'est le plafond : rien ne sort au-dessus de son niveau. Le signal pourrait monter jusqu'à 109 % (le code 1 019) ; beaucoup de diffuseurs n'acceptent pas plus d'environ 103 % en luminance, la tolérance de l'EBU R 103. Le white clip coupe net ce qui dépasse encore après le knee.\n\n**Les deux ensemble.** Le knee garde le détail, le white clip garantit la limite. Un knee point trop bas ternit les blancs du plateau (une chemise, la mire) ; une pente trop faible fait de la fenêtre un aplat gris ; sans white clip, un reflet passe au-dessus des limites.",
  vraie: "Sur la FB80, le knee est au menu PAINT, page P07 KNEE : K POINT et K SLOPE (de −99 à +99, en R, G, B et M), KNEE MAX, KNEE SAT (qui garde la couleur des hautes lumières comprimées) et AUTO KNEE. Le white clip est page P08 WHITE CLIP. La page P01 SW STATUS allume ou coupe KNEE et WHT CLIP. Le commutateur OUTPUT/AUTO KNEE, sur le côté du corps, met en service le knee automatique. Reliée à la CCU, la vision règle tout au RCP.\n\n**Le bon geste.** Exposer d'abord pour le sujet (le visage, la pelouse), puis régler le knee pour ce qui dépasse, en regardant le haut de la forme d'onde : la fenêtre doit garder une trace qui bouge, pas une ligne plate. Le white clip, lui, se règle une fois pour toutes à la limite du diffuseur.\n\n**L'erreur fréquente.** Fermer l'iris pour sauver la fenêtre : le visage s'assombrit. Ou descendre le knee point sous le niveau des blancs du plateau : la chemise du présentateur devient grise et terne.",
  plus: "- **Le knee automatique** suit les hautes lumières : plus la scène dépasse, plus le coude descend. Pratique en reportage, moins sur un plateau, où l'image doit rester stable.\n- **Voie par voie.** Le knee agit sur R, V et B séparément : une lumière très colorée et très forte pâlit en entrant dans le coude. KNEE SAT compense.\n- **Combien de lumière.** Avec une pente d'un pour dix à un pour vingt, on range de deux à trois diaphragmes au-dessus du blanc (ordre de grandeur), au prix d'un contraste réduit.\n- **HDR.** En HLG (ITU-R BT.2100), la courbe elle-même garde les hautes lumières : la version HDR n'a pas besoin de knee. La version SDR tirée de la HDR en a un, dans le convertisseur.\n- **Le légaliseur** du car coupe lui aussi au-dessus d'une limite : mieux vaut que la caméra ait déjà tout rangé, avec son détail.",
  car: "Dans le car, le knee des HDC se règle au poste vision : au RCP du simulateur, KNEE POINT (95 % par défaut) et WHITE CLIP (103 % par défaut) sont sur la page GAMMA / KNEE, et la touche KNEE le coupe. Un maillot blanc au soleil, le ciel derrière la tribune : on garde leur détail au knee, et le white clip tient la limite que vérifie le contrôle qualité.",
  quiz: [
    {
      q: 'La fenêtre derrière le présentateur est un aplat blanc ; le visage est bien exposé. Que fait-on ?',
      a: [
        ['On ferme l\'iris d\'un diaphragme.', 'La fenêtre revient un peu, mais le visage s\'assombrit d\'autant.'],
        ['On règle le knee : point vers 90 %, pente plus faible, pour faire rentrer la fenêtre sous le plafond.', 'Exact : le visage, sous le point, ne bouge pas.'],
        ['On baisse le white clip à 100 %.', 'Le white clip coupe : la fenêtre resterait un aplat, juste un peu plus bas.'],
      ],
      ok: 1,
    },
    {
      q: 'Le knee point est descendu à 75 % ; la chemise blanche du présentateur est exposée à 85 %. Que voit-on ?',
      a: [
        ['La chemise entre dans le coude : elle devient terne, ses plis s\'effacent.', 'Exact : le knee agit sur tout ce qui dépasse son point, où que ce soit dans l\'image.'],
        ['Rien de spécial : le knee n\'agit que sur la fenêtre.', 'Le knee ne sait pas ce qu\'est une fenêtre : il agit sur tout ce qui dépasse son point.'],
        ['La chemise est écrêtée à 75 %.', 'Un knee n\'écrête pas, il comprime. Le plafond, c\'est le white clip.'],
      ],
      ok: 0,
    },
    {
      q: 'À quoi sert le white clip, si le knee range déjà les hautes lumières ?',
      a: [
        ['À rien : on le coupe quand le knee est allumé.', 'Un reflet ou un projecteur peuvent dépasser malgré le knee : sans plafond, ils sortent hors limites.'],
        ['À éclaircir les blancs.', 'Il ne fait que couper au-dessus de son niveau.'],
        ['À garantir un plafond : ce qui dépasse encore, un reflet, un projecteur, ne sort pas au-dessus de la limite du diffuseur.', 'Exact : le knee garde le détail, le white clip tient la limite.'],
      ],
      ok: 2,
    },
  ],
  see: ['gamma', 'quantif', 'waveform', 'exposition', 'hdr', 'iris'],
  ref: 'ITU-R BT.709 (signal jusqu\'au code 1019, 109 %) ; EBU R 103 (tolérances des niveaux, environ 103 % en luminance) ; mode d\'emploi HXC-FB80 : menu PAINT, pages P01 SW STATUS, P07 KNEE (K POINT, K SLOPE, KNEE MAX, KNEE SAT, AUTO KNEE), P08 WHITE CLIP ; commutateur OUTPUT/AUTO KNEE',
  competences: ['1.4', '2.2'],
};

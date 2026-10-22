// @ts-check
// ----------------------------------------------------------------------------------
// Fiche « Le détail ». Principe : le contour est l'écart entre la luminance d'un pixel et celle de
// ses voisins (la maquette, camlab/vf.js : moyenne 1-2-1 sur 3 × 3 pixels), multiplié par le niveau,
// borné par le limiteur, annulé sous le seuil CRISP, puis ajouté aux trois voies ; le détail des
// carnations le réduit sur une plage de teintes (la peau, près de la ligne des chairs à 123° du
// vectorscope). Mode d'emploi HXC-FB80 : menu PAINT, P01 SW STATUS (DETAIL, LVL DEP, SKIN DTL),
// P09 DETAIL 1 (DETAIL, LEVEL, LIMITER, CRISP), P10 DETAIL 2 (H/V RATIO, FREQ, KNEE APT), P11 SD
// DETAIL, P12 SD CROSSCOLOR, P13 SKIN DETAIL (SKIN DTL, SKIN GATE, trois canaux) ; menu OPERATION,
// O04 VF DETAIL (le détail du viseur seulement). La manipulation (camlab/labs/ch4.js, « detail »)
// règle un liseré de 3 à 6 % au bord de la mire, nettoie le bruit à +12 dB au CRISP, adoucit la peau.
// ----------------------------------------------------------------------------------

/** @type {import('./index.js').FicheCamera} */
export const DETAIL = {
  t: 'Le détail', aka: 'Detail, correction de contour (aperture) ; skin detail', chap: 4, lot: 3, point: 'menu',
  short: 'Un contour ajouté pour que l\'image paraisse plus piquée ; le détail des carnations l\'adoucit sur les visages seulement.',
  fig: 'detail',
  lab: 'detail',
  body: "**Ce que fait le détail.** La caméra cherche les contours de l'image, là où la luminance change vite d'un pixel à l'autre. Elle calcule l'écart entre chaque pixel et la moyenne de ses voisins, et l'**ajoute** à l'image. De part et d'autre d'un bord apparaît un liseré : clair du côté clair, sombre du côté sombre. L'image n'est pas plus nette (l'objectif et le capteur n'ont rien gagné), elle **paraît** plus piquée.\n\n**Pourquoi on en met.** L'objectif, le filtre passe-bas devant les capteurs, l'écran adoucissent les contours ; un peu de détail compense, surtout vu de loin, sur un téléviseur. Sans détail, une image HD paraît molle.\n\n**Les réglages.**\n- **LEVEL** : la quantité de contour ajoutée.\n- **LIMITER** : la hauteur maximale des liserés, pour qu'un contour très fort ne devienne pas un trait blanc.\n- **CRISP** : un seuil. Les tout petits écarts, le bruit, le grain, ne reçoivent pas de contour ; seuls les vrais bords en ont.\n\n**Le détail des carnations.** Un visage filmé de près montre ses pores, ses rides, son maquillage : le détail les souligne. Le **skin detail** repère la teinte de la peau et réduit le détail sur elle seule. Le visage s'adoucit ; les cheveux, les yeux, la veste et le décor restent piqués.\n\n**Trop de détail.** Des liserés autour des joueurs, un bruit qui grésille, une image « électronique ». Le bon réglage ne se remarque pas.",
  vraie: "Sur la FB80, le détail est au menu PAINT : page P09 DETAIL 1 (DETAIL, LEVEL, LIMITER, CRISP), page P10 DETAIL 2 (H/V RATIO, la part du détail horizontal et vertical ; FREQ, la finesse des contours ; KNEE APT, le détail dans les hautes lumières) et page P13 SKIN DETAIL (SKIN DTL et ses portes de teinte, SKIN GATE). La page P01 SW STATUS allume ou coupe DETAIL, LVL DEP (moins de détail dans les tons sombres, où il ne ferait qu'accentuer le bruit) et SKIN DTL. Le détail du viseur (page O04 VF DETAIL du menu OPERATION) est autre chose : il aide le cadreur à faire le point et ne sort pas sur l'image.\n\n**Le bon geste.** Régler le détail au moniteur de référence, à la bonne distance, pas au viseur. Le même niveau sur toutes les caméras d'un plateau.\n\n**L'erreur fréquente.** Monter le détail pour rattraper un point flou : on souligne le flou sans le corriger. Ou garder beaucoup de détail en montant le gain : chaque grain de bruit reçoit son liseré.",
  plus: "- **Horizontal et vertical.** Le contour horizontal se calcule entre pixels voisins, le vertical entre lignes voisines ; leur rapport se règle (H/V RATIO).\n- **La finesse.** Un détail fin souligne les petits motifs (le grain d'une étoffe), un détail large les gros contours. Une veste à fines rayures peut se mettre à scintiller : on baisse le détail ou sa fréquence.\n- **Selon le niveau.** LVL DEP réduit le détail dans les ombres, où il n'ajouterait que du bruit ; KNEE APT en remet dans les hautes lumières tassées par le knee.\n- **La sortie SD.** Les pages SD DETAIL et SD CROSSCOLOR traitent la sortie en définition standard, quand on s'en sert.\n- **Le détail ne remplace pas le point.** Il ajoute des liserés à ce qui est net ; à ce qui est flou, il ajoute un halo.",
  car: "Dans le car, le détail des HDC se règle au poste vision : DETAIL sur l'écran du RCP, et les touches assignables DETAIL et SKIN DTL. Sur un stade, assez de détail pour que la balle et les lignes restent nettes en plan large ; moins sur les gros plans des joueurs et des entraîneurs, où le skin detail adoucit les visages.",
  quiz: [
    {
      q: 'Le détail rend-il l\'image plus nette ?',
      a: [
        ['Oui : il augmente la résolution de la caméra.', 'La résolution dépend de l\'objectif et du capteur ; le détail n\'ajoute aucune information.'],
        ['Non : il ajoute des liserés aux contours ; l\'image paraît plus piquée sans être plus nette.', 'Exact : c\'est une impression, utile, mais une impression.'],
        ['Oui, mais seulement au centre de l\'image.', 'Il agit partout où il y a des contours.'],
      ],
      ok: 1,
    },
    {
      q: 'Gain à +12 dB, l\'image grésille et le détail l\'accentue. Quel réglage aide sans perdre les vrais contours ?',
      a: [
        ['CRISP : sous son seuil, les petits écarts du bruit ne reçoivent plus de contour.', 'Exact : les vrais bords, bien au-dessus du seuil, gardent leur liseré.'],
        ['LIMITER : il limite la hauteur des liserés.', 'Il agit sur les grands contours ; le bruit fait de tout petits écarts, bien sous le limiteur.'],
        ['Le skin detail.', 'Il n\'agit que sur la teinte de la peau.'],
      ],
      ok: 0,
    },
    {
      q: 'En gros plan, la peau de l\'invitée paraît granuleuse ; le reste de l\'image est bien. Que fait-on ?',
      a: [
        ['On coupe le détail.', 'Toute l\'image s\'adoucit, la veste et le décor aussi.'],
        ['On ouvre l\'iris.', 'L\'exposition n\'y est pour rien.'],
        ['On allume le skin detail : il réduit le détail sur la teinte de la peau seulement.', 'Exact : le visage s\'adoucit, le reste de l\'image reste piqué.'],
      ],
      ok: 2,
    },
  ],
  see: ['point', 'gain', 'olpf', 'viseur', 'matrice', 'moniteur'],
  ref: 'Mode d\'emploi HXC-FB80 : menu PAINT, pages P01 SW STATUS (DETAIL, LVL DEP, SKIN DTL), P09 DETAIL 1 (LEVEL, LIMITER, CRISP), P10 DETAIL 2 (H/V RATIO, FREQ, KNEE APT), P11 SD DETAIL, P12 SD CROSSCOLOR, P13 SKIN DETAIL ; menu OPERATION, page O04 VF DETAIL',
  competences: ['2.9'],
};

// @ts-check
// ----------------------------------------------------------------------------------
// Fiche « UHD et HDR ». ITU-R BT.2020 : 3840 × 2160 et 7680 × 4320, primaires R (0,708 ; 0,292),
// V (0,170 ; 0,797), B (0,131 ; 0,046). ITU-R BT.2100 : primaires BT.2020, courbes HLG et PQ, 10 bits
// au moins ; écran HLG : gamma du système 1,2 à 1 000 cd/m². ITU-R BT.2408 : blanc de référence HLG
// à 75 % (203 cd/m² sur un écran de 1 000 cd/m²), gris 18 % à 38 %. Calculs (camlab/labs/ch89.js) :
// le blanc à 75 % correspond à 0,265 de la lumière maximale, d'où 1 ÷ 0,265 ≈ 3,8 fois plus de lumière
// codable au-dessus de lui. PQ : SMPTE ST 2084, jusqu'à 10 000 cd/m². 2160p50 : 12G-SDI 11,88 Gb/s ou
// 4 × 3G (Cours). Fiche Sony HDC-5500 : trois CMOS 2/3″ 4K à obturation globale, 3840 × 2160,
// BT.2020, HDR. Sony HXC-FB80 : capteurs 1920 × 1080 ; avec la CCU HXCU-FB80 et une mise à jour
// logicielle, HDR HLG en HD et sortie 4K agrandie en BT.2020 (annonce Sony).
// ----------------------------------------------------------------------------------

/** @type {import('./index.js').FicheCamera} */
export const HDR = {
  t: 'UHD et HDR', aka: 'Ultra haute définition (2160p), grande dynamique (HDR, courbe HLG), couleurs BT.2020', chap: 9, lot: 3,
  short: 'Quatre fois plus de pixels (2160p), une plus grande plage de luminosité (HLG) et des couleurs plus larges (BT.2020) : ce que la HDC-5500 du car fait d\'origine, et la FB80 seulement en partie.',
  fig: 'hdr',
  lab: 'hdr',
  body: "**Quatre fois plus de pixels.** L'UHD (ultra haute définition, souvent appelée 4K) fait 3840 × 2160 pixels : 8,3 millions, quatre fois la HD (1920 × 1080). En 2160p50, il faut un 12G-SDI (11,88 Gb/s) ou quatre liaisons 3G. Encore faut-il des capteurs qui ont vraiment ces pixels : sur un 2/3″, des photosites d'environ 2,5 µm au lieu de 5.\n\n**Ce que ça change pour la caméra.**\n- **Le point.** Le cercle de confusion est deux fois plus petit, donc la zone nette deux fois plus courte à cadre égal : une erreur de point qui passait en HD se voit en UHD.\n- **La diffraction.** À f/8, la tache d'un point (11 µm) couvre déjà quatre photosites UHD : on reste plus ouvert.\n- **Le cadre.** L'image est plus fine, pas plus large : le format reste 16:9.\n\n**Une plus grande plage de lumière (HDR).** En SDR (BT.709), tout ce qui est plus lumineux que le blanc est écrêté à 100 %, ou tassé par le knee : un ciel, un projecteur, un maillot blanc au soleil deviennent des aplats. La courbe HLG (Hybrid Log-Gamma, BT.2100) est une racine dans les sombres et un logarithme dans les hautes lumières : elle garde de la place au-dessus du blanc.\n- En direct (rapport BT.2408), on pose le **blanc de référence**, un carton blanc bien éclairé, à **75 %** ; le gris 18 % tombe à 38 %.\n- De 75 à 100 %, il reste près de quatre fois plus de lumière de scène à coder : près de deux diaphragmes.\n- Sur un écran HLG de 1 000 cd/m², le blanc de référence s'affiche à 203 cd/m² et les crêtes montent jusqu'à 1 000.\n\n**Des couleurs plus larges (BT.2020).** Les primaires de la BT.2020 sont plus pures que celles de la BT.709 : des rouges et des verts que la HD ne sait pas coder. La BT.2100 réunit ces couleurs, la courbe HLG (ou PQ) et 10 bits au moins.\n\n**La HDC-5500 et la FB80.** La HDC-5500 du car a trois capteurs 2/3″ 4K (3840 × 2160) : elle sort une vraie image UHD, en HDR et en BT.2020. La HXC-FB80 a des capteurs HD (1920 × 1080) : avec sa CCU HXCU-FB80 et une mise à jour logicielle, elle peut produire du HDR HLG en HD et sortir une image 4K agrandie, quatre fois plus de pixels mais pas plus de détails.",
  vraie: "Sur la HXC-FB80, le format de sortie se choisit dans le menu MAINTENANCE, page M09 OUTPUT FORMAT : des formats HD, jusqu'au 1080/50p. Le HDR et la sortie 4K agrandie se règlent du côté de la CCU HXCU-FB80.\n\n**Le bon geste.** En HLG, exposer avec les repères du HLG (blanc de référence à 75 %, gris à 38 %), pas avec ceux du SDR ; regarder les deux sorties, la HDR et la SDR qu'on en tire. En UHD, faire le point à la loupe : la zone nette est plus courte.\n\n**L'erreur fréquente.** Exposer en HLG comme en SDR, le blanc à 100 % : il ne reste plus de place pour les hautes lumières, et l'image SDR tirée de la HDR sort trop claire. Ou juger une image HDR sur un moniteur SDR.",
  plus: "- **HLG ou PQ.** Le PQ (SMPTE ST 2084) code une luminance d'écran absolue, jusqu'à 10 000 cd/m² : il convient aux films étalonnés. Le HLG code une lumière relative, comme le SDR : il passe sans métadonnées et s'affiche convenablement sur un écran SDR aux couleurs BT.2020. Le direct préfère le HLG.\n- **Le gamma du système.** Sur un écran HLG, le signal est déplié avec un exposant qui dépend de la luminance de l'écran : 1,2 pour 1 000 cd/m² (BT.2100). C'est lui qui donne 203 cd/m² au blanc de référence.\n- **Un seul flux.** Le car produit en HLG BT.2020 et un convertisseur en tire la version SDR BT.709 pour les chaînes HD : on règle souvent les caméras en regardant la sortie SDR, la HDR suit.\n- **Le 8K.** La BT.2020 définit aussi le 7680 × 4320, seize fois la HD.\n- **La HDC-5500 et le super ralenti.** En HD, elle tourne aussi à 3, 4, 6 ou 8 fois la cadence (option) : voir le super ralenti.",
  car: "Les caméras système du car sont des HDC-5500. En UHD HDR, le car produit en 2160p50 HLG (BT.2100), transporté en 12G-SDI. Au poste vision, le moniteur Grade 1 bascule SDR | HDR, et le PRISM a une entrée « HDR HLG », avec la ligne du blanc de référence à 75 % sur la forme d'onde.",
  quiz: [
    {
      q: 'Combien de pixels en UHD (3840 × 2160) par rapport à la HD (1920 × 1080) ?',
      a: [
        ['Deux fois plus.', 'Deux fois plus en largeur et deux fois plus en hauteur : quatre fois en tout.'],
        ['Quatre fois plus.', 'Exact : 8,3 millions de pixels contre 2,1 millions.'],
        ['Huit fois plus.', 'Ce n\'est aucun format courant ; le 8K (7680 × 4320) fait seize fois la HD.'],
      ],
      ok: 1,
    },
    {
      q: 'Pourquoi, en HLG, ne pose-t-on pas le carton blanc à 100 % ?',
      a: [
        ['Parce que le HLG ne monte pas au-dessus de 75 %.', 'Il monte jusqu\'à 100 % : c\'est justement la place des hautes lumières.'],
        ['Parce que le blanc à 100 % abîme les écrans HDR.', 'Rien ne s\'abîme : c\'est une question de place dans le signal.'],
        ['Pour garder au-dessus de lui la place des hautes lumières : de 75 à 100 %, près de quatre fois plus de lumière.', 'Exact : un ciel, un projecteur gardent leurs détails, et l\'écran les montre jusqu\'à 1 000 cd/m².'],
      ],
      ok: 2,
    },
    {
      q: 'La CCU de la FB80 sort une image 4K. Est-ce une vraie image UHD ?',
      a: [
        ['Non : les capteurs sont HD, la CCU agrandit l\'image ; quatre fois plus de pixels, pas plus de détails.', 'Exact : les détails sont ceux des capteurs de 1920 × 1080.'],
        ['Oui : 3840 × 2160 pixels, c\'est de l\'UHD.', 'Le nombre de pixels est celui de l\'UHD, mais les détails restent ceux des capteurs HD.'],
        ['Oui, si l\'objectif est un objectif 4K.', 'L\'objectif ne change pas le nombre de photosites des capteurs.'],
      ],
      ok: 0,
    },
  ],
  see: ['grandcapteur', 'hfr', 'moniteur', 'waveform', 'capteur', 'formats', 'knee', 'sortie'],
  ref: 'ITU-R BT.2020 (3840 × 2160 et 7680 × 4320, primaires) ; ITU-R BT.2100 (HLG et PQ, 10 bits au moins, gamma du système 1,2 à 1 000 cd/m²) ; ITU-R BT.2408 (HLG : blanc de référence à 75 %, 203 cd/m², gris 18 % à 38 %) ; SMPTE ST 2084 (PQ) ; fiche Sony HDC-5500 (trois CMOS 2/3″ 4K, 3840 × 2160, BT.2020, HDR) ; Sony HXC-FB80 et HXCU-FB80 (capteurs 1920 × 1080 ; HDR HLG en HD et sortie 4K agrandie avec la CCU) ; mode d\'emploi HXC-FB80 : MAINTENANCE M09 OUTPUT FORMAT',
  competences: ['3.4', '1.4'],
};

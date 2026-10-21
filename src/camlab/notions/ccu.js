// @ts-check
// ----------------------------------------------------------------------------------
// Fiche « La CCU ». Fiche Sony HXCU-FB80 (4K/HD Camera Control Unit) : REFERENCE IN (BNC ×2,
// avec boucle ; tri-level 0,6 V c-à-c, SMPTE 274M, ou black burst), PROMPTER IN (VBS 1,0 V, BNC
// ×2 avec boucle), RET (VBS ×2 et SDI ×2), sorties SDI : une carte de quatre sorties HD ou SD, une
// carte de quatre sorties 3G, 4K ou HD (4K par agrandissement, quad 3G-SDI ou 12G-SDI ; HDR HLG
// après mise à jour) ; intercom en façade (XLR 5 broches), intercom/tally/programme (D-sub 25) ;
// secteur 100 à 240 V. Avec la HXC-FB80 : 600 m de câble hybride au plus (objectif portable),
// 10 km en monomode avec alimentation locale ; la HXCU-FB80 accepte aussi la HXC-P70. HXC-FB80 :
// ≈ 32 W avec le viseur fourni (19 W le corps seul). Mode d'emploi RCP-1500 : CAM PW alimente la
// caméra depuis la CCU ; RCP-1500/1501/1530 aussi par le réseau (PoE). La manipulation
// (labs/ch7.js, « ccu ») fait câbler l'arrière de la CCU et mettre la voie en service.
// ----------------------------------------------------------------------------------

/** @type {import('./index.js').FicheCamera} */
export const CCU = {
  t: 'La CCU', aka: 'Camera Control Unit, la voie caméra ; type Sony HXCU-FB80', chap: 7, lot: 2, point: 'ccu',
  short: 'La voie caméra, en régie : elle alimente la caméra par la fibre, reçoit son image et la sort en SDI vers la grille, calée sur la référence ; elle renvoie à la caméra les retours, l\'intercom, le tally et le prompteur.',
  fig: 'ccu',
  lab: 'ccu',
  body: "**Une caméra, une CCU.** Une caméra de plateau ne travaille pas seule : au bout de sa fibre, dans la régie ou le car, il y a sa **CCU** (Camera Control Unit), un boîtier rangé en baie. Elles vont par paire, de la même famille : la HXC-FB80 avec la HXCU-FB80. Entre elles, la fibre porte un format de transmission propre au constructeur ; à la sortie de la CCU, tout est normalisé, prêt pour la régie.\n\n**Ce qu'elle fait.**\n- **Elle alimente la caméra** par le cuivre du câble hybride, quand la vision appuie sur CAM PW au RCP : jusqu'à 600 m de câble. La caméra et son viseur prennent environ 32 W (fiche Sony).\n- **Elle reçoit l'image** par la fibre et la sort en **SDI** : une carte de quatre sorties HD ou SD, une autre de quatre sorties 3G-SDI, 4K ou HD. La même image part vers la grille, un moniteur, un enregistreur : une sortie par appareil.\n- **Elle cale l'image sur la référence** : l'entrée REFERENCE reçoit le tri-level ou le black burst de la régie, et la CCU règle le rythme de la caméra dessus, pour que son image commence en même temps que celle des autres sources (le genlock).\n- **Elle renvoie à la caméra** ce dont le cadreur a besoin : deux retours vidéo (RET, en analogique ou en SDI), le prompteur, l'intercom et le tally du mélangeur.\n- **Elle relaie le RCP** : branché sur la CCU, le pupitre de la vision commande la caméra à travers elle.\n\n**Où se fait l'image.** La peinture de l'image (niveaux, gamma, knee, détail, matrice) se fait dans la tête de caméra, juste après les capteurs. La CCU la transporte et la met aux formats de la régie : HD, SD, et même 4K par agrandissement (la caméra reste une caméra HD).\n\n**Le premier point de mesure.** La CCU est la frontière entre la caméra et la régie. Si l'image est bonne à la sortie de la CCU, une panne est en aval (câble SDI, grille, mélangeur) ; si elle n'y est pas, elle est en amont (caméra, objectif, fibre).",
  vraie: "La HXCU-FB80 se range en baie. À l'arrière : la prise CAMERA (la fibre), le secteur, REFERENCE (deux BNC : l'entrée et sa boucle), les retours RET (deux en vidéo analogique, deux en SDI), PROMPTER (entrée et boucle), les deux cartes de sorties SDI, une prise D-sub 25 pour l'intercom, le tally et le programme, et la prise du RCP. L'intercom du technicien est aussi en façade, sur une XLR 5 broches.\n\n**Le bon geste.** Dans l'ordre : la fibre propre et branchée, la CCU sous tension, puis CAM PW au RCP. Vérifier la voie avec les barres (BARS) avant l'image : elles prouvent que tout va bien jusqu'à la grille, sans dépendre de l'objectif ni de la lumière. Étiqueter chaque câble de sortie : « CAM 1 », pas « une CCU ».\n\n**L'erreur fréquente.** Brancher ou débrancher la fibre avec la caméra alimentée. Laisser la boucle de la référence sans son bouchon. Chercher une panne dans la caméra alors que la sortie de la CCU n'est pas sur la bonne entrée de la grille.",
  plus: "- **Une famille.** La tête et la CCU parlent un langage propre à Sony : une HXC-FB80 se branche sur une CCU de sa famille (la HXCU-FB80 accepte aussi la HXC-P70, jusqu'à 1 000 m). Côté régie, en revanche, tout est normalisé : SDI, BNC, référence.\n- **Une sortie par appareil.** Un signal SDI ne se partage pas avec un T : il se distribue. D'où les quatre sorties par carte : la grille, un moniteur, un enregistreur, une en secours.\n- **4K et HDR.** Avec la HXCU-FB80, l'image HD peut sortir agrandie en 4K (sur quatre câbles 3G-SDI ou sur un 12G-SDI) et en HDR HLG, après une mise à jour du logiciel d'après Sony. Utile pour un car UHD ; l'image reste celle d'une caméra HD.\n- **Le RCP par le réseau.** Les RCP-1500, 1501 et 1530 peuvent aussi rejoindre la CCU par un câble réseau, alimentés en PoE : le pupitre peut alors être loin de la baie.\n- **Sans CCU.** La caméra sait travailler seule : DC IN pour l'énergie, SDI OUT pour l'image, PROMPTER/GENLOCK en entrée de référence, REMOTE pour un RCP branché en direct. On perd alors les retours, l'intercom et le tally qui passaient par la fibre.",
  car: "Dans le car, les CCU des caméras HDC (type HDCU-5500) sont en baie, une par caméra. La baie CCU affiche pour chaque voie l'alimentation, le niveau optique reçu et le verrouillage sur la référence ; « Voir la CCU » ouvre ses faces. Leurs sorties partent vers la grille Videohub en 3G-SDI (1080p50) ou en 12G-SDI pour l'UHD, avec une copie HD.",
  quiz: [
    {
      q: 'L\'image de CAM 1 n\'arrive pas au mélangeur, mais elle est bonne sur un moniteur branché directement sur une sortie SDI de sa CCU. Où chercher ?',
      a: [
        ['Dans la caméra : un capteur est en panne.', 'Si la sortie de la CCU est bonne, la caméra, la fibre et la CCU fonctionnent : la panne est plus loin.'],
        ['En aval de la CCU : le câble SDI, l\'entrée de la grille, la sortie de grille vers le mélangeur.', 'Exact : la sortie de la CCU est le premier point de mesure ; bonne là, la panne est entre elle et le mélangeur.'],
        ['Dans la fibre : il faut la nettoyer.', 'Une fibre sale empêcherait l\'image d\'arriver à la CCU elle-même ; or elle y est bonne.'],
      ],
      ok: 1,
    },
    {
      q: 'Que fait la CCU de la référence qu\'elle reçoit sur son entrée REFERENCE ?',
      a: [
        ['Elle cale le rythme de la caméra dessus, pour que son image commence en même temps que celle des autres sources.', 'Exact : c\'est le genlock. Le mélangeur peut alors couper sans saut.'],
        ['Elle l\'envoie à la grille à la place de l\'image.', 'La référence ne sort pas vers la grille : elle ne sert qu\'à caler le rythme de la CCU et de la caméra.'],
        ['Elle s\'en sert pour régler les couleurs.', 'La référence ne porte que le rythme et la phase, aucune information de couleur utile au réglage.'],
      ],
      ok: 0,
    },
    {
      q: 'La CCU est sous tension, la fibre branchée. La vision appuie sur CAM PW au RCP. Que se passe-t-il ?',
      a: [
        ['La CCU s\'allume.', 'Elle est déjà sous tension, par son interrupteur : CAM PW commande l\'alimentation de la caméra.'],
        ['Les barres de couleur sortent de la CCU.', 'Ce serait la touche BARS. CAM PW, c\'est l\'énergie.'],
        ['La CCU envoie l\'énergie à la caméra par le cuivre du câble hybride : la caméra s\'allume.', 'Exact : d\'après le mode d\'emploi du RCP-1500, CAM PW alimente la caméra depuis la CCU.'],
      ],
      ok: 2,
    },
  ],
  see: ['fibre', 'rcp', 'genlock', 'sortie', 'alimentation', 'retours', 'tally'],
  ref: 'Fiche Sony HXCU-FB80 : REFERENCE IN (BNC ×2 avec boucle, tri-level 0,6 V c-à-c SMPTE 274M ou black burst), RET (VBS ×2, SDI ×2), PROMPTER (BNC ×2), sorties SDI HD/SD ×4 et 3G/4K/HD ×4, intercom en façade (XLR 5 broches), intercom/tally/programme (D-sub 25) ; 600 m en câble hybride avec la HXC-FB80 ; mode d\'emploi RCP-1500 : CAM PW',
  competences: ['2.7', '2.1', '2.9'],
};

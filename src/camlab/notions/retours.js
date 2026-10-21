// @ts-check
// ----------------------------------------------------------------------------------
// Fiche « Retours vidéo et prompteur ». Mode d'emploi HXC-FB80 : touche RET 1 (le retour 1 dans le
// viseur tant qu'on appuie), sélecteur RET2 SEL (le retour 2, 3 ou 4 montré par la touche qui a la
// fonction « retour 2 »), touche RET de l'objectif, fonctions RETURN1 SW… des touches ASSIGN ;
// page VF OUT du menu OPERATION : RET MIX VF, MIX DIRECTION, MIX VF MODE (Y-MIX, WIRE (W),
// WIRE (B)), MIX VF LEVEL (0 à 80 %, 50 % d'usine), PinP ; prise PROMPTER/GENLOCK (avec CCU :
// sortie du prompteur ; sans CCU : entrée de référence). Mode d'emploi HXCU-FB80 : entrées de
// retour SDI-1, SDI-2, VBS-1, VBS-2, rangées en RET-1 à RET-4 par la page RETURN SET ; entrées
// prompteur VBS et HD. Le choix des quatre images est un exemple de car. La manipulation
// (camlab/labs/ch56.js, « retours ») fait voir le programme, raccorder un cadre, cadrer sous un titre.
// ----------------------------------------------------------------------------------

/** @type {import('./index.js').FicheCamera} */
export const RETOURS = {
  t: 'Retours vidéo et prompteur', aka: 'Return video (RET 1, RET2 SEL), MIX VF, PROMPTER', chap: 5, lot: 2, point: 'intercom',
  short: 'RET 1 et RET2 SEL montrent au cadreur, dans son viseur, le programme ou une autre source ; MIX VF les superpose à son image ; la prise PROMPTER envoie le texte au prompteur.',
  fig: 'retours',
  lab: 'retours',
  body: "**Voir autre chose que sa propre image.** Le viseur montre d'ordinaire l'image de la caméra. Mais le cadreur a souvent besoin de voir l'**antenne** (le programme : ce que le réalisateur a choisi, avec son habillage), une autre caméra pour ne pas faire le même plan, ou un titre qui va s'incruster. Ce sont les **retours vidéo** : des images que la grille du car envoie à la CCU, et que la fibre porte jusqu'au viseur.\n\n**Quatre retours.** La CCU HXCU-FB80 reçoit les retours sur ses entrées, deux en SDI et deux en vidéo analogique (VBS) ; sa page RETURN SET les range en RET-1 à RET-4. Le choix des images est celui du car, par exemple : 1 le programme, 2 le preview, 3 une autre caméra, 4 l'habillage seul.\n\n**Les touches.**\n- **RET 1**, à l'arrière : tant qu'on appuie, le viseur montre le retour 1. On relâche, l'image de la caméra revient.\n- **RET2 SEL** : un sélecteur 2, 3, 4. Il choisit le retour que montre la touche qui a la fonction « retour 2 », par exemple la touche **RET** de la poignée de l'objectif, sous la main droite.\n- Les touches ASSIGN peuvent aussi recevoir un retour (fonction RETURN1 SW, et les suivantes).\n\n**Mélanger plutôt que remplacer.** Page 08 VF OUT du menu OPERATION, **RET MIX VF** sur ON : en appuyant sur RET, le viseur mélange le retour à l'image de la caméra au lieu de la remplacer. **MIX VF MODE** choisit comment : Y-MIX pose le retour en transparence, WIRE (W) et WIRE (B) n'en gardent que les contours, en blanc ou en noir ; **MIX VF LEVEL** (0 à 80 %) règle le dosage. On cadre ainsi un visage au-dessus d'un titre, ou un sujet dans la fenêtre d'une incrustation.\n\n**Le prompteur.** Le texte que lit le présentateur vient de la régie : un ordinateur le fait défiler, la CCU le reçoit sur son entrée prompteur, la fibre le porte à la caméra, qui le ressort sur la prise **PROMPTER/GENLOCK** (BNC). Un câble court la relie au moniteur du prompteur, devant l'objectif : le présentateur lit en regardant l'objectif.",
  vraie: "À l'arrière, en haut de la colonne de l'intercom : RET2 SEL et la touche RET 1. Sur la poignée de l'objectif, la touche RET. Le viseur indique quel retour il affiche.\n\n**Le bon geste.** Garder la main droite sur la poignée et la touche RET sous le doigt : un coup d'œil au programme entre deux plans, puis on relâche. Demander au chef de car, en début de journée, ce qui arrive sur les retours 1, 2, 3 et 4.\n\n**L'erreur fréquente.** Rester sur un retour et chercher pourquoi le zoom ne change rien à l'image : c'est celle d'une autre caméra. Ou garder le MIX VF toute la journée et cadrer dans un viseur brouillé. Le MIX VF ne change que le viseur : la sortie de la caméra reste propre, rien n'est incrusté à l'antenne par la caméra.",
  plus: "- **Un retour sans CCU.** Une caméra qui travaille seule peut recevoir un retour en SDI sur sa prise SDI I/O, réglée en entrée dans le menu.\n- **PROMPTER/GENLOCK.** Avec une CCU, la prise sort le prompteur ; sans CCU, elle reçoit la référence de synchronisation (genlock). Une même prise, deux usages.\n- **En petit.** La page VF OUT propose aussi un PinP (picture in picture, une image dans l'image) : un retour dans un coin du viseur, sans quitter son cadre.\n- **Pourquoi le programme.** Le cadreur ne voit que sa caméra. Le programme lui dit ce qui vient de passer et ce qu'on attend de lui : ne pas refaire le plan de la caméra d'à côté, se préparer à un enchaînement, laisser la place d'un titre.",
  car: "Dans le car, la grille envoie à chaque CCU le programme et les sources que le réalisateur veut montrer aux cadreurs ; au stade, le cadreur de la caméra principale garde un œil sur le programme pour savoir quand le ralenti se termine. Le prompteur ne sert qu'aux plateaux : présentateur en bord de terrain, studio du car.",
  quiz: [
    {
      q: 'Le cadreur maintient RET 1. Que voit-il dans son viseur ?',
      a: [
        ['L\'image de sa caméra en noir et blanc.', 'Ça, c\'est VF OUT sur Y : rien à voir avec les retours.'],
        ['Le retour 1, tant qu\'il garde la touche enfoncée.', 'Exact : il relâche, l\'image de la caméra revient.'],
        ['Le retour 1, jusqu\'à ce qu\'il rappuie.', 'RET 1 est une touche à maintenir, pas un interrupteur.'],
      ],
      ok: 1,
    },
    {
      q: 'RET2 SEL est sur 3. Que montre la touche RET de l\'objectif, qui a la fonction « retour 2 » ?',
      a: [
        ['Le retour 3.', 'Exact : RET2 SEL choisit le retour 2, 3 ou 4 de la touche qui a cette fonction.'],
        ['Toujours le retour 2.', 'C\'est justement le rôle de RET2 SEL : choisir entre 2, 3 et 4.'],
        ['Le programme.', 'Le programme est le plus souvent sur le retour 1, celui de la touche RET 1.'],
      ],
      ok: 0,
    },
    {
      q: 'Le cadreur a mis RET MIX VF sur ON pour cadrer sous un titre. Que voient les téléspectateurs de ce mélange ?',
      a: [
        ['Le titre, deux fois.', 'Le mélange ne sort pas de la caméra : seul le viseur le montre.'],
        ['Une image en transparence, si le niveau dépasse 50 %.', 'Quel que soit MIX VF LEVEL, le mélange reste dans le viseur.'],
        ['Rien : le MIX VF ne change que le viseur.', 'Exact : la sortie de la caméra reste son image ; l\'incrustation se fait au mélangeur.'],
      ],
      ok: 2,
    },
  ],
  see: ['tally', 'viseur', 'connectique', 'fibre', 'ccu', 'commandes'],
  ref: 'Mode d\'emploi HXC-FB80 : touche RET 1, sélecteur RET2 SEL (retour 2, 3 ou 4), touche RET de l\'objectif, page VF OUT (RET MIX VF, MIX VF MODE Y-MIX / WIRE (W) / WIRE (B), MIX VF LEVEL 0 à 80 %, PinP), prise PROMPTER/GENLOCK ; mode d\'emploi HXCU-FB80 : entrées de retour SDI-1, SDI-2, VBS-1, VBS-2, page RETURN SET (RET-1 à RET-4), entrées prompteur VBS et HD',
  competences: ['2.9', '4.1'],
  cours: 'camera-systeme',
};

// @ts-check
// ----------------------------------------------------------------------------------
// Fiche « Tally, call et intercom ». Mode d'emploi HXC-FB80 : commutateur TALLY du corps (ON :
// le voyant s'allume quand un tally arrive à la CCU, ou pendant un CALL ; le voyant du corps ne
// s'allume qu'en rouge), bouton CALL (allume le tally rouge de la CCU et de l'appareil de commande,
// RCP ou RM), viseur : commutateur TALLY (HIGH, LOW, OFF) de la lampe, voyants R TALLY et G TALLY ;
// le tally clignote pour signaler une anomalie ; commutateur INTERCOM MIC (réglage PANEL TYPE de
// la page INTERCOM, CE d'usine : PROD, OFF, ENG), bouton INTERCOM (volume), prise INTERCOM XLR
// 5 broches ; page CALL/TALLY du menu MAINTENANCE. La manipulation (camlab/labs/ch56.js, « tally »)
// fait jouer le mélangeur, le CALL et l'intercom autour de la caméra 2.
// ----------------------------------------------------------------------------------

/** @type {import('./index.js').FicheCamera} */
export const TALLY = {
  t: 'Tally, call et intercom', aka: 'Tally (programme, preview), CALL, intercom PROD et ENG', chap: 5, lot: 2, point: 'intercom',
  short: 'Le rouge dit « tu es à l\'antenne », le vert « tu es la prochaine ». CALL appelle la vision sans un mot ; l\'intercom PROD relie le cadreur à la réalisation, ENG à la vision et à la technique.',
  fig: 'tally',
  lab: 'tally',
  body: "**Le tally.** Le mélangeur sait quelle caméra est à l'antenne. Il le dit à chaque CCU, qui le transmet à sa tête par la fibre. Sur la caméra :\n- la **lampe de tally**, sur le dessus du viseur, tournée vers le plateau : le présentateur sait dans quelle caméra regarder ;\n- les voyants **R TALLY** et **G TALLY** du viseur, pour le cadreur ;\n- le voyant du **corps**, à l'arrière, qui ne s'allume qu'en rouge.\n\n**Rouge et vert.** Rouge : la caméra est au **programme**, à l'antenne. Vert : elle est au **preview** (la présélection), la prochaine à passer. On ne bouge plus son cadre quand on est rouge ; on le prépare quand on est vert. L'usage du vert dépend de la configuration du car.\n\n**Le CALL.** Un bouton à l'arrière de la caméra : tant qu'on appuie, il allume le tally rouge de la CCU et du RCP de la vision. C'est un appel silencieux : « la 2 a besoin de toi », sans couper personne sur l'intercom. La vision appelle de la même façon depuis son RCP.\n\n**L'intercom.** Le casque-micro du cadreur se branche sur la prise INTERCOM (XLR 5 broches). Deux lignes passent dans la fibre :\n- **PROD** (production) : le réalisateur, la scripte, le plateau ; les ordres de cadre ;\n- **ENG** (engineering, la technique) : la vision, le chef de car ; l'image et les pannes.\n\nLe commutateur **INTERCOM MIC** choisit où part le micro : PROD, OFF ou ENG. Le bouton INTERCOM règle le volume du casque.",
  vraie: "À l'arrière, la colonne des retours réunit aussi l'intercom et le CALL : bouton de niveau, commutateur INTERCOM MIC (PROD, OFF, ENG), bouton CALL. Le commutateur TALLY du corps (ON, OFF) allume ou éteint le voyant du corps ; sur le viseur, le commutateur TALLY règle la lampe : HIGH, LOW ou OFF.\n\n**Le bon geste.** En début de journée, tester avec la vision : un CALL, un « tally rouge ? », un essai sur PROD et sur ENG. Pendant le direct, micro sur OFF tant qu'on n'a rien à dire, et un coup d'œil au tally avant chaque mouvement : on ne recadre pas en rouge.\n\n**L'erreur fréquente.** Laisser INTERCOM MIC sur PROD et commenter le plateau : tout ce que dit le cadreur s'entend dans le casque du réalisateur. Ou éteindre la lampe de tally du viseur à cause d'un reflet, et oublier de la rallumer : le présentateur ne sait plus où regarder.",
  plus: "- **Un voyant qui clignote.** Le tally de la caméra clignote aussi pour signaler une anomalie : ce n'est pas un appel, c'est une alarme, à lire dans le viseur.\n- **PANEL TYPE.** Le rôle du commutateur INTERCOM MIC dépend du réglage PANEL TYPE de la page INTERCOM (menu OPERATION) ; d'usine (CE), c'est le choix PROD, OFF, ENG.\n- **Le son programme.** Le casque peut aussi recevoir le son du programme, mêlé aux ordres, avec son propre niveau : utile pour suivre une musique ou un commentaire.\n- **Une troisième couleur.** Le viseur sait aussi montrer un tally jaune ; certains cars s'en servent pour une caméra enregistrée à part.\n- **La matrice d'intercom.** Dans le car, PROD et ENG sont des groupes de la matrice : le chef de car décide qui parle à qui (leçon « L'intercom »).",
  car: "Dans le car, le tally part du mélangeur vers chaque CCU, et l'intercom de la matrice vers la prise intercom de la CCU, canaux PROD et ENG : ils passent dans la fibre jusqu'à la tête et au casque du cadreur. Au poste vision, le tally rouge d'un RCP qui s'allume hors antenne, c'est un cadreur qui appelle : on lui répond sur ENG.",
  quiz: [
    {
      q: 'Ta lampe de tally passe du vert au rouge. Que dois-tu faire ?',
      a: [
        ['Finir vite de recadrer, puisque tu es la prochaine.', 'La prochaine, c\'est le vert ; en rouge, tu es déjà à l\'antenne.'],
        ['Ne plus bouger le cadre, sauf ordre du réalisateur : tu es à l\'antenne.', 'Exact : rouge, c\'est le programme.'],
        ['Appuyer sur CALL pour confirmer.', 'Le CALL sert à appeler la vision, pas à répondre au tally.'],
      ],
      ok: 1,
    },
    {
      q: 'Tu veux signaler à la vision un souci d\'image, sans parler dans le casque du réalisateur. Que fais-tu ?',
      a: [
        ['CALL, puis INTERCOM MIC sur ENG pour lui parler.', 'Exact : le CALL allume le tally rouge de son RCP ; sur ENG, seule la technique t\'entend.'],
        ['INTERCOM MIC sur PROD, et tu expliques.', 'Sur PROD, ta voix part dans le casque de la réalisation, en plein direct.'],
        ['Tu éteins ta lampe de tally pour qu\'elle le remarque.', 'La lampe sert au plateau ; la vision ne la voit pas, et le présentateur perd son repère.'],
      ],
      ok: 0,
    },
    {
      q: 'Le voyant du corps reste éteint alors que le viseur montre R TALLY. Pourquoi ?',
      a: [
        ['La caméra n\'est pas vraiment à l\'antenne.', 'R TALLY allumé : la caméra est bien au programme.'],
        ['Le voyant du corps ne s\'allume qu\'en vert.', 'C\'est l\'inverse : le voyant du corps ne s\'allume qu\'en rouge.'],
        ['Le commutateur TALLY du corps est sur OFF.', 'Exact : sur ON, le voyant du corps s\'allume en rouge à l\'antenne et pendant un CALL.'],
      ],
      ok: 2,
    },
  ],
  see: ['retours', 'connectique', 'fibre', 'ccu', 'rcp', 'cadreur'],
  ref: 'Mode d\'emploi HXC-FB80 : commutateur TALLY du corps (ON, OFF ; rouge seulement, et pendant un CALL), bouton CALL (tally rouge de la CCU et du RCP), commutateur TALLY du viseur (HIGH, LOW, OFF), voyants R TALLY et G TALLY, commutateur INTERCOM MIC (PROD, OFF, ENG ; PANEL TYPE CE, page INTERCOM), bouton INTERCOM, prise INTERCOM XLR 5 broches ; page CALL/TALLY du menu MAINTENANCE',
  competences: ['4.1', '2.9'],
  cours: 'expl-intercom',
};

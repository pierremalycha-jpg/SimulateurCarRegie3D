// @ts-check
// ----------------------------------------------------------------------------------
// Fiche « La macro ». Fiche Fujinon ZA12x4.5BERD : distance minimale de mise au point (M.O.D.) 0,3 m,
// comptée depuis la lentille frontale. La bague macro déplace le groupe arrière : l'image recule ou
// avance d'une même longueur à toutes les focales. Lentille mince : pour passer de 0,3 m à une distance
// d, il faut décaler l'image de f² × (1/d − 1/0,3) ; de 0,3 m à 12 cm, 0,10 mm à 4,5 mm, 0,50 mm à
// 10 mm, 14,6 mm à 54 mm. D'où la macro au grand angle, et un zoom qui n'est plus parfocal. La course
// de la bague macro de la maquette (0,95 mm dans l'espace image) est un ordre de grandeur, pas un
// chiffre de la fiche. La manipulation (camlab/labs/ch1.js, « macro ») fait le point à 12 cm, serre le
// zoom, puis remet la macro au repos.
// ----------------------------------------------------------------------------------

/** @type {import('./index.js').FicheCamera} */
export const MACRO = {
  t: 'La macro', aka: 'Macro, mise au point rapprochée', chap: 1, lot: 2, point: 'macro',
  short: 'La bague macro permet de filmer plus près que la distance minimale. Pendant ce temps, le zoom n\'est plus parfocal.',
  fig: 'macro',
  lab: 'macro',
  body: "**La distance minimale.** La bague de point s'arrête à 0,3 m, comptés depuis la lentille frontale (fiche Fujinon) : c'est la distance minimale de mise au point. Plus près, on a beau tourner la bague, l'objet reste flou.\n\n**La macro.** Une seconde bague, à l'arrière de l'objectif, déplace le groupe de lentilles arrière au lieu du groupe frontal. Elle décale l'image vers le capteur, et permet de faire le point plus près, jusqu'à quelques centimètres de la lentille au grand angle (ordre de grandeur). Au repos, elle est bloquée sur son repère.\n\n**Pourquoi au grand angle.** La bague macro décale l'image d'une même longueur, quelle que soit la focale. Or l'écart à rattraper pour voir net plus près grandit comme le carré de la focale. De 0,3 m à 12 cm (calcul de la lentille mince) :\n- à 4,5 mm, il faut décaler l'image de 0,10 mm ;\n- à 10 mm, de 0,50 mm ;\n- à 54 mm, de 14,6 mm, impossible.\nLa macro est un outil du grand angle.\n\n**Pourquoi le zoom n'est plus parfocal.** Le point est fait en macro pour une focale. Si l'on zoome, l'écart à rattraper change comme f², le décalage de la macro reste le même : l'image devient floue. En macro, on cadre d'abord, on fait le point ensuite, et on ne zoome plus.\n\n**Le retour au repos.** La bague macro ramenée en butée et rebloquée, le zoom redevient parfocal. Une macro oubliée ressemble à un tirage faux : net à une focale, flou aux autres.",
  vraie: "La bague macro est à l'arrière de l'objectif, près de la monture (la pastille « macro » de la caméra 3D) ; au repos, elle est verrouillée, et un bouton ou un levier, selon le modèle, la libère avant qu'on la tourne.\n\n**Le bon geste.** Élargir d'abord, cadrer, puis faire le point à la bague macro, en regardant le viseur avec la loupe. Éclairer l'objet de côté : si près, l'objectif lui fait de l'ombre. Et en fin de plan, la bague en butée et bloquée.\n\n**L'erreur fréquente.** Oublier la macro sortie : au plan suivant, le cadreur fait le point en serré, élargit, et le large est flou. On croit à un tirage faux, on dérègle la bague F.f, et le problème recommence le lendemain.",
  plus: "- **Le principe.** La bague macro agit comme la bague de tirage : elle déplace le groupe arrière, et donc le plan où se forme l'image. Elle a une plus grande course, et elle ne se règle pas une fois pour toutes.\n- **L'échelle ne veut plus rien dire.** En macro, les distances gravées sur la bague de point sont fausses : on fait le point à l'œil, au viseur.\n- **La profondeur de champ.** Si près, elle est très mince, même au grand angle : à 4,5 mm et f/1,8, environ 3 cm de zone nette à 12 cm, moins de 2 mm à 3 cm (calcul de la profondeur de champ). On ferme un peu l'iris et on éclaire en conséquence.\n- **Bonnettes.** Pour filmer de près au serré, on visse une lentille d'appoint (une bonnette) devant l'objectif : elle rapproche toute l'échelle de la bague de point, et le zoom garde sa course.",
  car: "Au stade, la macro sert rarement : un détail du ballon, une chaussure, un logo sur le maillot avant l'entrée des joueurs, avec une caméra portable. Sur un plateau, elle sert pour un objet posé sur le bureau. Dans tous les cas, la vision vérifie le point en large au plan suivant.",
  quiz: [
    {
      q: 'Un objet est à 15 cm de la lentille, et la caméra ne peut pas reculer. La bague de point est en butée à 0,3 m. Que fait-on ?',
      a: [
        ['On zoome au serré pour l\'agrandir.', 'Zoomer ne rapproche pas la distance de mise au point : l\'objet reste flou.'],
        ['On élargit, puis on fait le point avec la bague macro.', 'Exact : la macro décale l\'image pour faire le point plus près que 0,3 m, surtout au grand angle.'],
        ['On tourne la bague F.f pour rapprocher le point.', 'La bague de tirage a une petite course et se règle une fois pour toutes : la dérégler fausse le zoom pour tous les plans suivants.'],
      ],
      ok: 1,
    },
    {
      q: 'Point fait en macro à 6 mm. Le cadreur serre à 12 mm sans toucher aux bagues. Que voit-il ?',
      a: [
        ['L\'image devient floue : l\'écart à rattraper a été multiplié par quatre, le décalage de la macro est resté le même.', 'Exact : il varie comme le carré de la focale. En macro, le zoom n\'est plus parfocal.'],
        ['L\'image reste nette : le zoom est parfocal.', 'Il ne l\'est qu\'avec la macro au repos.'],
        ['L\'image s\'assombrit de deux diaphragmes.', 'La macro ne change pas l\'exposition ; c\'est le point qui se perd.'],
      ],
      ok: 0,
    },
    {
      q: 'Après une macro, le large est flou alors que le serré est net. Avant de toucher au tirage, on vérifie…',
      a: [
        ['l\'iris : il doit être grand ouvert.', 'L\'iris ne crée pas un défaut qui dépend de la focale ; c\'est la position de l\'image qu\'il faut regarder.'],
        ['le doubleur : il doit être engagé.', 'Le doubleur doit au contraire être sur ×1 pour vérifier le zoom.'],
        ['la bague macro : elle doit être en butée et bloquée.', 'Exact : une macro sortie donne exactement les symptômes d\'un tirage faux.'],
      ],
      ok: 2,
    },
  ],
  see: ['point', 'tirage', 'zoom', 'pdc', 'focale'],
  ref: 'Fiche Fujinon ZA12x4.5BERD : M.O.D. 0,3 m (depuis la lentille frontale), macro ; lentille mince : décalage de l\'image Δ = f² × (1/d − 1/d₀) ; réglage du tirage : doubleur sur ×1, macro au repos (notice de l\'objectif)',
  competences: ['2.9', '2.7'],
};

// @ts-check
// ----------------------------------------------------------------------------------
// Les lieux du simulateur (feuille de route : ROADMAP.md). Le car régie est en service ; les
// autres sont en préparation : l'accueil les montre sur un mur d'écrans, avec quelques indices,
// et une fiche « Ce qui se prépare ». Les périodes sont indicatives.
// ----------------------------------------------------------------------------------
/**
 * @typedef {object} Lieu
 * @property {string} id
 * @property {string} nom
 * @property {string} cadre ce qu'on y fait, en quelques mots (sous le nom)
 * @property {'service' | 'prepa'} etat
 * @property {string[]} icons silhouettes à l'écran (ui/icons.js)
 * @property {string} [version] version prévue
 * @property {string} [prevu] période prévue
 * @property {string[]} [indices] trois mots du métier à deviner
 * @property {string} [pitch]
 * @property {string[]} [vous] ce que l'étudiant y fera
 * @property {string[]} [materiel]
 * @property {string} [tuteur]
 * @property {{ label: string, preset: string, why: string }} [attente] ce qui s'y prépare déjà dans le car
 */
/** @type {Lieu[]} */
export const LIEUX = [
  {
    id: 'car', nom: 'Car régie', cadre: 'Captation sportive au stade', etat: 'service', icons: ['car', 'terrain'],
  },
  {
    id: 'plateau', nom: 'Plateau TV', cadre: 'Studio et régie en dur', etat: 'prepa', version: 'v20', prevu: 'printemps 2027',
    icons: ['tv', 'ccu'], indices: ['cyclo', 'prompteur', 'patch SDI'],
    pitch: 'Un studio de télévision et sa régie fixe : une émission en direct sur conducteur, avec des invités en duplex.',
    vous: [
      'Câbler le patch SDI de la salle technique : liaisons normalées et coupées, synchro black burst et tri-level.',
      'Régler les caméras de plateau et éclairer le décor avec une première console DMX.',
      'Mener une émission sur conducteur : ordres, prompteur, invités en duplex avec leur N-1.',
      'Passer le mode examen : sans aide, chronométré, noté sur une grille.',
    ],
    materiel: ['Caméras sur pied', 'Prompteur', 'Grill lumière', 'Patch SDI', 'Générateur de synchro', 'Mélangeur', 'Console son'],
    tuteur: 'le directeur technique du plateau',
    attente: { label: 'Brasser le car', preset: 'brassage', why: 'le patch SDI se travaille déjà sur la baie de brassage du car.' },
  },
  {
    id: 'entrepot', nom: 'Entrepôt', cadre: 'Préparer le matériel', etat: 'prepa', version: 'v21', prevu: 'été 2027',
    icons: ['entrepot', 'colis'], indices: ['baies 19 pouces', 'flight cases', 'P17 32 A'],
    pitch: 'Avant chaque prestation, du cahier des charges au camion chargé. Ce que vous préparez ici part sur le lieu, oublis compris.',
    vous: [
      'Lire un cahier des charges et choisir le matériel.',
      'Racker une baie 19 pouces et remplir les flight cases.',
      'Calculer le budget électrique et équilibrer les phases.',
      'Charger le camion et sortir la liste de colisage.',
    ],
    materiel: ['Baies 19 pouces', 'Flight cases', 'Distribution électrique P17', 'Liste de colisage', 'Synoptique', 'Camion de 20 m³'],
    tuteur: 'le chef de parc',
    attente: { label: 'Installer le car', preset: 'vierge', why: 'choisir, placer et câbler les caméras d\'un stade vide, c\'est déjà préparer un dispositif.' },
  },
  {
    id: 'conference', nom: 'Conférence', cadre: 'Régie mobile et direct', etat: 'prepa', version: 'v22', prevu: 'rentrée 2027',
    icons: ['conference', 'webcam'], indices: ['PTZ', 'Stream Deck', 'SRT'],
    pitch: 'Une conférence hybride dans un amphithéâtre : la régie arrive en flight cases, se monte sur place et diffuse en direct.',
    vous: [
      'Monter une régie légère : mélangeur logiciel, Stream Deck, caméras PTZ.',
      'Sonoriser la salle sans larsen : micros HF, mixette, retour de l\'orateur.',
      'Faire intervenir des participants à distance en visioconférence, avec leur N-1.',
      'Diffuser en direct en RTMP ou en SRT, avec un secours 4G.',
    ],
    materiel: ['Mélangeur logiciel', 'Stream Deck', 'Caméras PTZ', 'Convertisseurs HDMI-SDI', 'Micros HF', 'Encodeur SRT'],
    tuteur: 'le régisseur de l\'événement',
    attente: { label: 'Prendre l\'antenne', preset: 'standard', why: 'le mélangeur, les ordres et le N-1 du car sont les mêmes gestes.' },
  },
  {
    id: 'concert', nom: 'Concert', cadre: 'Son et lumière de scène', etat: 'prepa', version: 'v23 et v24', prevu: '2028',
    icons: ['hautparleur', 'lumiere'], indices: ['line array', 'DMX', 'retours'],
    pitch: 'Une salle de concert : la balance puis le live, avec la façade, les retours, la lumière et la captation.',
    vous: [
      'Lire la fiche technique du groupe et câbler le plateau : stagebox, patch list, retours.',
      'Caler la diffusion et rester sous les niveaux sonores autorisés.',
      'Patcher les projecteurs et écrire une conduite lumière en DMX.',
      'Capter le concert en multicaméra.',
    ],
    materiel: ['Console de façade', 'Console de retours', 'Line array', 'Réseau audio Dante', 'Console lumière DMX', 'Lyres et PAR LED'],
    tuteur: 'le régisseur général',
    attente: { label: 'Prendre l\'antenne', preset: 'standard', why: 'la console son du car (tranches, N-1, HF) prépare déjà la façade.' },
  },
];

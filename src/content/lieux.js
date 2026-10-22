// @ts-check
// ----------------------------------------------------------------------------------
// Les lieux de l'écran Jouer (feuille de route : ROADMAP.md). Le car régie est en service ; la
// salle de concert est en préparation : son écran ouvre une fiche « Ce qui se prépare ». Les
// périodes sont indicatives. L'entrepôt (monter une régie mobile de A à Z) est un mode à part, qui
// s'ouvre d'ici : son module (src/entrepot/) remplace le car.
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
    id: 'entrepot', nom: 'L\'entrepôt', cadre: 'Monter une régie mobile de A à Z', etat: 'service', icons: ['materiel', 'processeur'],
  },
  {
    id: 'concert', nom: 'Salle de concert', cadre: 'Son et lumière de scène', etat: 'prepa', version: 'v22 et v23', prevu: 'fin 2027',
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

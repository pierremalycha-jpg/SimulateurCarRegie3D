// @ts-check
// ----------------------------------------------------------------------------------
// Les médias de l'émission, rangés sur le serveur EVS et lancés depuis l'IPDirector : le générique de
// début, la page de publicité (jingle « Publicité », trois spots, jingle de sortie) et le générique de
// fin. Ce sont des éléments « importés » (fabriqués avant le match), pas des enregistrements des
// caméras : on les charge sur un canal de lecture (PGM), on les lance au top, ils durent ce qu'ils
// durent. Images (emission/dessin.js) et musiques (emission/musique.js) sont fabriquées par le code.
// Marques des spots : fictives.
// ----------------------------------------------------------------------------------

/**
 * @typedef {object} Partie
 * @property {number} de début (s, depuis le début du média)
 * @property {number} a fin (s)
 * @property {'ident' | 'spot' | 'retour'} quoi
 * @property {number} [spot] indice dans SPOTS
 * @property {string} titre
 */
/**
 * @typedef {object} Media
 * @property {string} id
 * @property {string} titre nom du clip dans la base de l'IPDirector (en capitales, comme sur le serveur)
 * @property {string} nom
 * @property {number} duree secondes
 * @property {string} desc
 * @property {Partie[]} [parties]
 */
/** les spots de la page de publicité (marques fictives) */
export const SPOTS = [
  { marque: 'La Baraque du Terril', slogan: 'Des frites croustillantes, au pied du terril.', fond: ['#f6b400', '#d94a1a'], encre: '#2a1405' },
  { marque: 'Mutuelle des Corons', slogan: 'Toujours là pour vous, comme de bons voisins.', fond: ['#2f6fb5', '#123a6b'], encre: '#ffffff' },
  { marque: 'Ch\'ti Vélo', slogan: 'Le vélo électrique : même les terrils deviennent plats.', fond: ['#3fae5a', '#14532d'], encre: '#ffffff' },
];
/** @type {Record<string, Media>} */
export const MEDIAS = {
  'gen-debut': { id: 'gen-debut', titre: 'GÉNÉRIQUE DÉBUT', nom: 'Générique de début', duree: 30, desc: 'Ouverture de l\'émission : habillage animé, affiche du match, musique. Commence et finit au noir.' },
  pub: {
    id: 'pub', titre: 'PAGE DE PUB', nom: 'Page de publicité', duree: 70,
    desc: 'Écran publicitaire : jingle d\'entrée « Publicité », trois spots de 20 s, jingle de retour. Il passe à la mi-temps, une pause naturelle du jeu.',
    parties: [
      { de: 0, a: 5, quoi: 'ident', titre: 'Jingle « Publicité »' },
      { de: 5, a: 25, quoi: 'spot', spot: 0, titre: 'Spot 1 · ' + SPOTS[0].marque },
      { de: 25, a: 45, quoi: 'spot', spot: 1, titre: 'Spot 2 · ' + SPOTS[1].marque },
      { de: 45, a: 65, quoi: 'spot', spot: 2, titre: 'Spot 3 · ' + SPOTS[2].marque },
      { de: 65, a: 70, quoi: 'retour', titre: 'Jingle de retour' },
    ],
  },
  'gen-fin': { id: 'gen-fin', titre: 'GÉNÉRIQUE FIN', nom: 'Générique de fin', duree: 30, desc: 'Fin de l\'émission : score final, générique déroulant (qui a tenu chaque poste), musique, fondu au noir.' },
};
export const ORDRE_MEDIAS = ['gen-debut', 'pub', 'gen-fin'];
export const mediaById = (/** @type {string} */ id) => MEDIAS[id] || null;
/** la partie d'un média à l'instant t (la page de pub), ou null */
export function partieA(/** @type {string} */ id, /** @type {number} */ t) {
  const m = MEDIAS[id]; if (!m || !m.parties) return null;
  return m.parties.find((p) => t >= p.de && t < p.a) || (t >= m.duree ? m.parties[m.parties.length - 1] : m.parties[0]);
}
/** temps au format « mm:ss:ii » (images à 25 i/s), comme un timecode de durée sur le serveur */
export function dureeTC(/** @type {number} */ s) {
  const v = Math.max(0, s); const m = Math.floor(v / 60), sec = Math.floor(v % 60), im = Math.floor((v - Math.floor(v)) * 25);
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}:${String(im).padStart(2, '0')}`;
}

// @ts-check
import { STATION_INFO } from '../content/stations.js';

// ----------------------------------------------------------------------------------
// La Carrière, saison 1 : les mails que l'on reçoit au bureau de l'entrepôt. Chaque épisode est
// une proposition de poste sur une prestation (le mail), une mission qui se joue avec une activité
// qui existe déjà (la visite guidée du car, une mission de l'entrepôt), et le mail de retour qui
// arrive quand elle est réussie. Un épisode ne s'ouvre qu'une fois ceux qu'il demande (requis)
// réussis. Les textes sont écrits pour un étudiant qui découvre le métier : chaque mot du
// jargon est expliqué à sa première apparition. La société est celle que règle le formateur
// (Réglages, espace formateur, « Le car » : Société / service), sinon un nom fictif.
// ----------------------------------------------------------------------------------
/** @typedef {{ nom: string, role: string }} Expediteur */
/**
 * @typedef {{ type: 'visite', tour: boolean, postes: string[] } | { type: 'entrepot', mission: string, seuil: number }} Action
 * visite : le tour du car (parcours « prise-en-main ») et la présentation de ces postes ;
 * entrepot : une mission de l'entrepôt rendue avec ce score au moins (sur 100)
 */
/**
 * @typedef {object} Contexte ce que les textes peuvent citer
 * @property {string} societe
 * @property {number | null} score meilleur résultat de la mission de l'entrepôt (null : pas rendue)
 */
/**
 * @typedef {object} Episode
 * @property {string} id
 * @property {string[]} requis épisodes à réussir avant que ce mail arrive
 * @property {string} poste le poste proposé sur la prestation
 * @property {Expediteur} de
 * @property {string} objet
 * @property {(c: Contexte) => string} corps texte enrichi (ui/rich.js : paragraphes, listes, **gras**)
 * @property {{ lieu: string, titre: string, duree: string, attendu: string[], bouton: string, action: Action }} mission
 * @property {{ de: Expediteur, objet: string, corps: (c: Contexte) => string }} retour
 */

/** le nom de la société quand le formateur n'en a pas donné (fictif) */
export const SOCIETE_DEFAUT = 'TIEE Prestations';

const NADIA = { nom: 'Nadia Morel', role: 'chargée de planning' };
const OLIVIER = { nom: 'Olivier', role: 'chef de car' };
/** les six postes que le stagiaire découvre le premier jour, dans l'ordre de la visite */
export const POSTES_STAGIAIRE = ['realisateur', 'melangeur', 'vision', 'evs', 'son', 'chefdecar'];
const titre = (/** @type {string} */ id) => (STATION_INFO[id] ? STATION_INFO[id].title : id);

/** @type {Episode[]} */
export const EPISODES = [
  {
    id: 'stagiaire', requis: [], poste: 'Stagiaire',
    de: NADIA,
    objet: 'Bienvenue ! Ton stage commence ce soir au stade',
    corps: (c) => `Bonjour,

Bienvenue chez **${c.societe}** ! Pour ton premier jour de stage, tu pars au stade Bollaert-Delelis avec le **car régie** (le camion qui contient toute la régie de production : on y fabrique l'image et le son du match). Ce soir : RC Lens – AS Rivière, antenne à 20 h 45.

Olivier, le **chef de car**, t'accueille au **compound** (le parking technique où stationnent les véhicules de production). Il te fait faire le tour du car, puis il te présente six postes : c'est là que travaillent les gens que tu vas croiser toute la saison.

Tu n'as rien à régler aujourd'hui : regarde, pose des questions, retiens qui fait quoi.

À ton retour, repasse au bureau : je t'aurai envoyé la suite.

Nadia`,
    mission: {
      lieu: 'Car régie, stade Bollaert-Delelis', titre: 'Découvrir le car et ses postes', duree: 'environ 25 min',
      attendu: ['Le tour du car avec Olivier', ...POSTES_STAGIAIRE.map((id) => `La présentation du poste ${titre(id)}`)],
      bouton: 'Partir au stade',
      action: { type: 'visite', tour: true, postes: POSTES_STAGIAIRE },
    },
    retour: {
      de: OLIVIER,
      objet: 'Ta journée au car',
      corps: () => `Salut,

Merci pour ta journée, tu as été attentif. Tu as vu l'essentiel d'une régie de production :
- le **réalisateur** choisit les plans et les annonce ;
- le **truquiste** les envoie à l'antenne sur le mélangeur ;
- l'**ingé vision** règle l'image de chaque caméra (exposition, couleurs) pour qu'elles se raccordent ;
- l'**opérateur ralenti** enregistre toutes les caméras et prépare les replays ;
- l'**ingé son** mixe le son du programme et renvoie aux commentateurs le **N-1** (tout le programme sauf leur propre voix) ;
- et moi, je veille à ce que tout le car marche, de l'arrivée au compound jusqu'au démontage.

Pour aller plus loin, chaque poste a ses exercices pratiques dans le **Cours**. Et si tu veux revoir un poste, la visite guidée est dans Jouer.

J'ai dit à Nadia que tu pouvais passer à la suite.

Olivier`,
    },
  },
  {
    id: 'conference', requis: ['stagiaire'], poste: 'Assistant technique',
    de: NADIA,
    objet: 'Une régie à monter pour la remise des diplômes du lycée',
    corps: () => `Bonjour,

Olivier m'a fait un bon retour sur ta journée au car. Pour ta première vraie mission, je te confie une prestation légère : le lycée nous commande la captation de sa cérémonie de remise des diplômes.

Tout se prépare ici, à l'entrepôt : tu sors le matériel du stock, tu le poses dans la **baie** (le meuble 19 pouces où se vissent les appareils) et sur la table, tu le câbles et tu le configures. Le client veut :
- trois **caméras PTZ** (motorisées : panoramique, inclinaison et zoom se pilotent à distance) commandées depuis un seul pupitre ;
- un mélangeur, et le **tally** (le voyant rouge de la caméra à l'antenne) qui s'allume ;
- le programme enregistré ;
- le micro de la salle dans le son du programme.

Attention au budget : 25 000 € HT au catalogue. Quand tout marche, rends le montage depuis le cahier des charges : le client valide à partir de 60 / 100.

Nadia`,
    mission: {
      lieu: 'L\'entrepôt', titre: 'Conférence à trois caméras PTZ', duree: 'environ 30 min',
      attendu: ['Le cahier des charges « Conférence à trois caméras PTZ » rempli', 'Le montage rendu avec 60 / 100 au moins'],
      bouton: 'Commencer le montage',
      action: { type: 'entrepot', mission: 'conference', seuil: 60 },
    },
    retour: {
      de: NADIA,
      objet: 'Le lycée a validé ta régie',
      corps: (c) => `Bonjour,

Le lycée a validé ta régie${c.score != null ? ` : **${c.score} / 100**` : ''}. Bravo, c'est ta première prestation montée de A à Z.

Ton compte rendu est dans le cahier des charges (bouton « Compte rendu ») : garde-le, c'est ce qu'on remet au client avec la liste de câblage et le plan d'adressage.

Je reviens vers toi dès qu'une nouvelle prestation se présente. En attendant, le Cours t'attend : chaque leçon a ses exercices pratiques.

Nadia`,
    },
  },
];
export const episodeById = (/** @type {string} */ id) => EPISODES.find((e) => e.id === id) || null;

// @ts-check
import { allExercises, exerciseInfo, SPECIAL, specialState } from '../cours/exercices.js';
import { lessonById as tutorLesson, progressOf } from '../tutor/engine.js';

// ----------------------------------------------------------------------------------
// Les missions spécifiques du car régie (Jouer → Car régie → Mission spécifique) : on choisit une
// tâche précise, le car est préparé pour elle, et une fois terminée on enchaîne sur une autre ou
// l'on s'arrête. Trois familles :
//   - « Installer le car » : une étape de l'installation, le reste du car prêt (les caméras, le
//     brassage, le réseau de contrôle, le line-up, la prise d'antenne, la zone technique) ; ses
//     tâches sont les missions du car vide (ui/guide.js, MISSIONS) ;
//   - « Aux postes, avec Olivier » : les exercices pratiques des leçons du Cours, par chapitre ;
//   - « Épreuves notées » : l'atelier, le jour de match, la formation réseau ST 2110.
// Calcul pur : le catalogue, la préparation du car (prepa), ce qui est déjà fait. Le déroulement
// (lancer, constater la fin, enchaîner) est dans game/mission_run.js. Les exercices restent aussi
// rangés dans leur leçon du Cours (cours/exercices.js) : ce sont les mêmes, ils comptent une fois.
// ----------------------------------------------------------------------------------
/**
 * @typedef {object} Prepa l'état du car au lancement
 * @property {string} preset vacation de départ (app/start.js : standard, brassage, atelier, scenario)
 * @property {boolean} [ip] car IP (ST 2110)
 * @property {boolean} [sdi] car SDI exigé (grille Videohub, réseau de contrôle)
 * @property {'none'} [cams] stade sans caméra
 * @property {boolean} [lineup] false : caméras posées mais pas réglées
 * @property {boolean} [reseauUsine] réseau de contrôle du car SDI remis aux adresses d'usine
 */
/**
 * @typedef {object} MissionCar
 * @property {string} id
 * @property {'installer' | 'postes' | 'epreuves'} famille
 * @property {string} [groupe] sous-titre dans la famille (le chapitre du Cours)
 * @property {string} titre
 * @property {string} resume
 * @property {string} duree
 * @property {string} niveau
 * @property {'install' | 'olivier' | 'epreuve'} kind
 * @property {string[]} [taches] install : les missions du car vide qu'il faut réussir (ui/guide.js)
 * @property {Prepa} prepa
 */
export const FAMILLES = [
  { id: 'installer', titre: 'Installer le car', ico: 'plan', resume: 'Une étape de l\'installation ; le reste du car est prêt.' },
  { id: 'postes', titre: 'Aux postes, avec Olivier', ico: 'chef', resume: 'Les exercices pratiques des leçons du Cours, rangés par chapitre : Olivier explique, tu fais, il vérifie.' },
  { id: 'epreuves', titre: 'Épreuves notées', ico: 'trophee', resume: 'Chronométrées et notées, enregistrées dans ta progression.' },
];

/** les étapes de l'installation (les tâches sont celles du car vide, dans son ordre) */
/** @type {MissionCar[]} */
const INSTALLER = [
  { id: 'i-cameras', famille: 'installer', kind: 'install', titre: 'Installer et câbler les caméras', duree: '15 min', niveau: 'découverte',
    resume: 'Le stade est vide, le car est prêt. Découvre le pied de car, pose le plan large et le serré sur la passerelle, câble-les jusqu\'au car, puis installe une Steadicam HF et ses antennes de réception.',
    taches: ['m1', 'm2', 'm3', 'm3b', 'm4', 'm5', 'm6'], prepa: { preset: 'standard', cams: 'none' } },
  { id: 'x-brassage', famille: 'installer', kind: 'epreuve', titre: SPECIAL['x-brassage'].title, duree: SPECIAL['x-brassage'].duration, niveau: SPECIAL['x-brassage'].level,
    resume: SPECIAL['x-brassage'].summary, prepa: { preset: 'brassage' } },
  { id: 'i-reseau', famille: 'installer', kind: 'install', titre: 'Paramétrer le réseau de contrôle', duree: '15 min', niveau: 'intermédiaire',
    resume: 'Les caméras sont posées et brassées, mais les RCP et les CCU sortent du carton avec leur adresse d\'usine (192.168.0.x). Au poste Réseau de contrôle, donne à chacun l\'adresse du plan : chaque RCP doit reprendre la main sur sa caméra.',
    taches: ['mz-net'], prepa: { preset: 'standard', reseauUsine: true, sdi: true } },
  { id: 'i-lineup', famille: 'installer', kind: 'install', titre: 'Le line-up : exposition, matching, barres', duree: '15 min', niveau: 'intermédiaire',
    resume: 'Les caméras sont installées mais pas réglées. Au poste Ingé vision : exposer la CAM 1 au waveform, égaliser la colorimétrie des CAM 1 et 2, puis vérifier la chaîne avec les barres.',
    taches: ['m9', 'm10', 'm10b'], prepa: { preset: 'standard', lineup: false } },
  { id: 'i-antenne', famille: 'installer', kind: 'install', titre: 'Prendre l\'antenne : mélangeur, habillage, ralenti', duree: '20 min', niveau: 'découverte',
    resume: 'Le car est prêt. Repère le multiview, fais un premier enchaîné, mets le score et un bandeau à l\'antenne, envoie un ralenti, entre avec le volet logo et monte une playlist de clips.',
    taches: ['m7', 'm8', 'm11', 'm12', 'm13', 'm13b'], prepa: { preset: 'standard' } },
  { id: 'i-technique', famille: 'installer', kind: 'install', titre: 'La zone technique : synchro, retour antenne, câblage, panne', duree: '15 min', niveau: 'intermédiaire',
    resume: 'Au fond du car : la synchro (SPG), le départ et le retour antenne, la liste de câblage qu\'on suit d\'un bout à l\'autre, puis une panne à trouver au poste Chef de car.',
    taches: ['m14', 'm15', 'm17', 'm16'], prepa: { preset: 'standard' } },
];
/** les épreuves notées qui se jouent dans le car (le brassage est rangé avec l'installation) */
const EPREUVES = /** @type {Array<[string, Prepa]>} */ ([['x-match', { preset: 'scenario' }], ['x-atelier', { preset: 'atelier' }], ['x-reseau', { preset: 'standard', ip: true }]]);
/** hors du car : la caméra en 3D et l'entrepôt ont leur propre écran (Cours, Jouer → L'entrepôt) */
const HORS_CAR = new Set(['x-camera', 'x-entrepot']);

/** le catalogue entier, dans l'ordre de présentation @returns {MissionCar[]} */
export function catalogue() {
  const postes = allExercises().filter((x) => !SPECIAL[x.id] && !HORS_CAR.has(x.id)).map((x) => {
    const info = exerciseInfo(x.id); const l = tutorLesson(x.id); const n = (l && l.needs) || {};
    return /** @type {MissionCar} */ ({ id: x.id, famille: 'postes', groupe: x.chapter.title, kind: 'olivier', titre: info ? info.title : x.id, resume: info ? info.summary : '', duree: info ? info.duration : '', niveau: info ? info.level : '', prepa: { preset: 'standard', ...(n.ip ? { ip: true } : {}), ...(n.sdi ? { sdi: true } : {}) } });
  }).filter((m, i, a) => a.findIndex((y) => y.id === m.id) === i);
  const epreuves = EPREUVES.map(([id, prepa]) => /** @type {MissionCar} */ ({ id, famille: 'epreuves', kind: 'epreuve', titre: SPECIAL[id].title, resume: SPECIAL[id].summary, duree: SPECIAL[id].duration, niveau: SPECIAL[id].level, prepa }));
  return [...INSTALLER, ...postes, ...epreuves];
}
export const missionById = (/** @type {string} */ id) => catalogue().find((m) => m.id === id) || null;

/** déjà réussie un jour (progression) : les tâches du car vide, le parcours d'Olivier, l'épreuve notée */
export function dejaFaite(/** @type {MissionCar} */ m, /** @type {any} */ P) {
  if (m.kind === 'install') return (m.taches || []).every((t) => !!(P.missions && P.missions[t]));
  if (m.kind === 'olivier') return !!progressOf(m.id).done;
  return specialState(m.id).done;
}
/** une première mission à proposer : la première pas encore réussie (installation d'abord) */
export function premiereAFaire(/** @type {any} */ P) { const all = catalogue(); return (all.find((m) => !dejaFaite(m, P)) || all[0]).id; }

/** le car tel qu'il est convient-il à la mission suivante (enchaîner sans recharger le stade) ? */
export function memeCar(/** @type {Prepa} */ a, /** @type {Prepa} */ b) {
  const simple = (/** @type {Prepa} */ p) => p.preset === 'standard' && !p.cams && p.lineup !== false && !p.reseauUsine;
  return simple(a) && simple(b) && (b.ip ? !!a.ip : b.sdi ? !a.ip : true);
}

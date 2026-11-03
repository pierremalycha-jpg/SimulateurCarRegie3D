// @ts-check
import { defiReussi } from './suivi.js';

// ----------------------------------------------------------------------------------
// Le catalogue du Labo (v19.28, décidé le 3 novembre 2026) : l'espace de Jouer qui remplace
// l'entrepôt. Chaque atelier fait manipuler une notion du Cours sur un modèle qui calcule vraiment
// (labo/calc/) ; il a ses défis notés (labo/defis/, un fichier par atelier), rattachés aux
// compétences du référentiel (champ competences, numéros officiels C1 à C39) et à ses savoirs.
// La console lumière (dot2) a des défis de programmation : le Labo relit le show qu'elle enregistre.
// Un nouvel atelier s'ajoute ici (et son onglet apparaît seul dans le Labo et dans Jouer), avec son
// module d'interface (labo/ateliers/<id>.js), ses défis et son test.
// ----------------------------------------------------------------------------------
/**
 * @typedef {object} Atelier
 * @property {string} id
 * @property {string} titre
 * @property {string} court nom de l'onglet
 * @property {string} ico icône (ui/icons.js)
 * @property {string} resume ce qu'on y fait, une phrase
 * @property {string} consigne ce que dit la touche de lancement, une ou deux phrases
 * @property {string[]} notions les notions du Cours qu'il fait manipuler
 * @property {string[]} competences compétences du référentiel (la première est la principale)
 * @property {string[]} savoirs savoirs associés (A1 à L12)
 * @property {{ lecon?: string, camera?: string, titre: string }[]} liens leçons du Cours, notions de la caméra en 3D
 * @property {string[]} terms fiches « ? » (content/terms_labo.js)
 * @property {{ id: string, titre: string }[]} defis ses défis notés, dans l'ordre
 * @property {boolean} [libre] manipulation libre, sans défi noté
 */
/** @type {Atelier[]} */
export const ATELIERS = [
  {
    id: 'optique', titre: 'Optique et profondeur de champ', court: 'Optique', ico: 'vision',
    resume: 'Une caméra et trois sujets : la focale, l\'iris, le point et le capteur dessinent la zone nette.',
    consigne: 'Régler la caméra, regarder l\'image et la vue de dessus : la zone nette, l\'hyperfocale, le champ. Puis les défis.',
    notions: ['Profondeur de champ', 'Hyperfocale', 'Cercle de confusion', 'Angle de champ', 'Taille du capteur'],
    competences: ['C23', 'C19'], savoirs: ['G7', 'G1', 'G9'],
    liens: [{ camera: 'pdc', titre: 'La profondeur de champ (caméra en 3D)' }, { camera: 'focale', titre: 'La focale (caméra en 3D)' }, { lecon: 'camera-systeme', titre: 'La chaîne caméra' }],
    terms: ['hyperfocale', 'cercle-confusion', 'angle-champ', 'facteur-recadrage'],
    defis: [{ id: 'opt-isoler', titre: 'Isoler un sujet' }, { id: 'opt-tout-net', titre: 'Tout garder net' }, { id: 'opt-cadrer', titre: 'Cadrer à la bonne focale' }],
  },
  {
    id: 'photometrie', titre: 'Photométrie', court: 'Photométrie', ico: 'lumiere',
    resume: 'Un projecteur, un sujet et un luxmètre : intensité, éclairement, distance, angle et couleur de la lumière.',
    consigne: 'Placer et régler les projecteurs, lire le luxmètre, exposer la caméra. Puis les défis.',
    notions: ['Flux, intensité, éclairement, luminance', 'Loi de l\'inverse du carré', 'Loi du cosinus', 'Température de couleur et mireds', 'Rapport de contraste'],
    competences: ['C17', 'C31', 'C23'], savoirs: ['G2', 'G3', 'G4', 'D1'],
    liens: [{ lecon: 'expl-lineup', titre: 'Le line-up' }, { lecon: 'signal-couleur', titre: 'Espaces de couleur' }, { camera: 'exposition', titre: 'L\'exposition (caméra en 3D)' }],
    terms: ['eclairement', 'intensite-lumineuse', 'flux-lumineux', 'luminance', 'inverse-carre', 'temperature-couleur', 'mired', 'rapport-contraste'],
    defis: [{ id: 'pho-niveau', titre: 'Le bon niveau au sujet' }, { id: 'pho-exposer', titre: 'Exposer d\'après le luxmètre' }, { id: 'pho-couleur', titre: 'Corriger la couleur' }, { id: 'pho-contraste', titre: 'Le rapport de contraste' }],
  },
  {
    id: 'sensito', titre: 'Sensitométrie', court: 'Sensitométrie', ico: 'mire',
    resume: 'Une charte de gris devant la caméra : exposition, gain, courbes BT.709, knee, S-Log3 et HLG, plage dynamique.',
    consigne: 'Exposer la charte, changer de courbe, lire la forme d\'onde : où s\'écrasent les noirs, où écrêtent les blancs. Puis les défis.',
    notions: ['Diaphragme et lumière', 'Gris 18 %', 'Courbe de transfert (OETF)', 'Knee', 'Courbes log et HLG', 'Plage dynamique'],
    competences: ['C32', 'C10', 'C23'], savoirs: ['G6', 'G9', 'G4', 'C10'],
    liens: [{ lecon: 'signal-niveaux', titre: 'Niveaux : 0–100 %' }, { lecon: 'signal-couleur', titre: 'Espaces de couleur, HDR' }, { camera: 'gamma', titre: 'Le gamma (caméra en 3D)' }, { camera: 'knee', titre: 'Le knee (caméra en 3D)' }],
    terms: ['gris-18', 'diaphragme', 'oetf', 'plage-dynamique', 'slog3', 'hdr-hlg'],
    defis: [{ id: 'sen-gris', titre: 'Le gris à sa place' }, { id: 'sen-ciel', titre: 'Garder le ciel' }, { id: 'sen-plage', titre: 'Compter les diaphs' }],
  },
  {
    id: 'dmx', titre: 'DMX et Art-Net', court: 'DMX', ico: 'reseau',
    resume: 'Adresser et patcher des projecteurs, régler les valeurs, tirer la ligne DMX, passer en Art-Net ou sACN.',
    consigne: 'Patcher l\'univers, envoyer des valeurs, vérifier la ligne et le réseau lumière. Puis les défis.',
    notions: ['Univers et adresses', 'Empreinte et mode', 'Valeurs 8 et 16 bits', 'Ligne DMX512 : terminaison, 32 récepteurs', 'Art-Net et sACN'],
    competences: ['C25', 'C17', 'C12'], savoirs: ['G5', 'K2', 'C7'],
    liens: [{ lecon: 'reseau-types', titre: 'Unicast, diffusion, multicast' }, { lecon: 'reseau-ip', titre: 'Adresse IP et masque' }],
    terms: ['dmx512', 'univers-dmx', 'adresse-dmx', 'empreinte-dmx', 'terminaison-dmx', 'artnet', 'sacn'],
    defis: [{ id: 'dmx-patch', titre: 'Patcher à la suite' }, { id: 'dmx-dip', titre: 'Adresser aux DIP' }, { id: 'dmx-ligne', titre: 'Une ligne DMX qui tient' }, { id: 'dmx-artnet', titre: 'Le nœud Art-Net' }],
  },
  {
    id: 'dot2', titre: 'Console lumière dot2', court: 'Console dot2', ico: 'melangeur',
    resume: 'Une console sur le modèle de la dot2 : patch, groupes, presets, cues, exécuteurs, effets, macros, et le plateau en 3D.',
    consigne: 'Programmer la console : le défi charge un show de départ, le Labo relit ce que vous avez enregistré. Ses exercices guidés restent dans l\'application.',
    notions: ['Patch et fiche des projecteurs', 'Groupes et presets', 'Cues et tracking', 'Exécuteurs et pages', 'Câblage DMX du plateau'],
    competences: ['C17', 'C31'], savoirs: ['G5', 'G3'],
    liens: [{ lecon: 'lumiere-console', titre: 'La console : patch, groupes, presets, cues' }, { lecon: 'lumiere-lyres', titre: 'Les lyres : pan, tilt, roues et effets' }],
    terms: ['dmx512', 'tracking'],
    defis: [{ id: 'dot2-couleurs', titre: 'Des couleurs sur les lyres' }, { id: 'dot2-matricks', titre: 'Une lyre sur deux (MAtricks)' }, { id: 'dot2-position', titre: 'Pointer un gobo' }, { id: 'dot2-cercle', titre: 'Un cercle de lyres' }, { id: 'dot2-chaser', titre: 'Un chaser de couleurs' }],
  },
];
/** tous les défis notés, avec leur atelier */
export const DEFIS_LABO = ATELIERS.flatMap((A) => A.defis.map((d) => ({ ...d, atelier: A.id })));
export const atelierById = (/** @type {string} */ id) => ATELIERS.find((A) => A.id === id) || null;
export const defiById = (/** @type {string} */ id) => DEFIS_LABO.find((d) => d.id === id) || null;
/** l'exercice pratique du Cours qui ouvre l'atelier (cours/exercices.js) */
export const exerciceDe = (/** @type {string} */ id) => 'x-labo-' + id;
/** où en est un atelier : défis réussis seul, sur combien */
export function bilanAtelier(P, /** @type {string} */ id) {
  const A = atelierById(id); if (!A) return { reussis: 0, total: 0 };
  return { reussis: A.defis.filter((d) => defiReussi(P, d.id)).length, total: A.defis.length };
}

// @ts-check
// ----------------------------------------------------------------------------------
// Section Cours : une fiche par notion, rangée par thème. Une fiche suit toujours le même moule :
// l'essentiel en une phrase, un schéma, une manipulation (« À toi de jouer »), l'explication,
// « pour aller plus loin », ce qu'on en voit dans le car (avec « Emmène-moi » et le parcours du
// chef lié), trois questions, des renvois et la norme. Les fiches du lexique (content/netterms.js
// et ses compléments : mesure vidéo, réseau de contrôle, grille SDI) entrent telles quelles, rangées
// par famille dans les thèmes (`familles`) ; `term` reprend l'une d'elles parmi les notions du thème.
// ----------------------------------------------------------------------------------
import { SDI } from './sdi.js';
import { CATS, TERMS } from '../netterms.js';
import '../terms_mesure.js';
import '../terms_ctrlnet.js';
import '../terms_videohub.js';

/**
 * @typedef {object} Question
 * @property {string} q la question
 * @property {[string, string][]} a réponses : [texte, explication de ce choix]
 * @property {number} ok indice de la bonne réponse
 */
/**
 * @typedef {object} Fiche
 * @property {string} t titre
 * @property {string} [aka] nom complet, traduction
 * @property {string} theme thème (THEMES)
 * @property {string} short l'essentiel en une phrase
 * @property {string} [fig] schéma (ui/cours/figs.js)
 * @property {string} [lab] manipulation (ui/cours/labs.js)
 * @property {string} [body] l'explication (niveau « essentiel »)
 * @property {string} [plus] pour aller plus loin
 * @property {string} [car] ce qu'on en voit dans le car
 * @property {{ label: string, station?: string, lesson?: string }[]} [go] boutons Emmène-moi (un poste) et parcours du chef
 * @property {Question[]} [quiz]
 * @property {string[]} [see] fiches liées
 * @property {string} [ref] norme ou document de référence
 * @property {string[]} [competences] compétences du référentiel RNCP37022 (numéros 1.1 à 4.5), pour le livret de compétences
 * @property {string} [term] fiche du lexique réseau reprise telle quelle
 * @property {boolean} [prevu] fiche annoncée, pas encore écrite
 */

/** @type {{ id: string, nom: string, icon: string, fiches: string[], familles: string[] }[]} */
export const THEMES = [
  { id: 'video', nom: 'Signal vidéo', icon: 'vision', fiches: ['sdi', 'echantillonnage', 'quantification', 'formats'], familles: ['Couche physique SDI', 'Grille SDI'] },
  { id: 'mesure', nom: 'Mesure vidéo', icon: 'mesure', fiches: [], familles: ['Mesure vidéo'] },
  { id: 'synchro', nom: 'Synchronisation', icon: 'synchro', fiches: ['genlock', 'timecode'], familles: ['PTP'] },
  { id: 'liaisons', nom: 'Liaisons', icon: 'transmission', fiches: ['fibre-smpte', 'hf'], familles: [] },
  { id: 'reseau', nom: 'Réseau', icon: 'reseau', fiches: ['sous-reseau', 'groupe', 'st2110'], familles: ['Bases du réseau', 'Réseau', 'Transport et multicast', 'ST 2110', 'NMOS', 'Mesures', 'Exploitation'] },
  { id: 'son', nom: 'Son', icon: 'mixage', fiches: ['audio-embed'], familles: [] },
];

const prevu = (t, theme, short) => ({ t, theme, short, prevu: true });

/** @type {Record<string, Fiche>} */
export const FICHES = {
  sdi: SDI,
  echantillonnage: prevu('Échantillonnage 4:2:2', 'video', 'Pourquoi on garde toute la luminance mais seulement la moitié de la couleur, et ce que l\'œil n\'en voit pas.'),
  quantification: prevu('Quantification et niveaux', 'video', 'Les 10 bits d\'un pixel, la plage légale, et ce que veulent dire 0 % et 100 % au waveform.'),
  formats: prevu('Formats et cadences', 'video', '1080i50, 1080p50, 2160p50 : lignes, images par seconde, entrelacé ou progressif.'),
  genlock: prevu('Genlock et référence', 'synchro', 'Pourquoi toutes les machines du car doivent commencer leurs images au même instant.'),
  timecode: prevu('Timecode', 'synchro', 'L\'heure image par image, commune à toutes les machines, pour retrouver une action partout.'),
  'fibre-smpte': prevu('Fibre SMPTE et triax', 'liaisons', 'Un seul câble pour l\'image, le retour, l\'intercom, le tally et l\'alimentation de la caméra.'),
  hf: prevu('Liaison HF', 'liaisons', 'Décibels, marge et diversité : comment une Steadicam envoie son image sans fil.'),
  'sous-reseau': { t: 'Adresse IP et masque', theme: 'reseau', short: '', term: 'sous-reseau' },
  groupe: { t: 'Multicast', theme: 'reseau', short: '', term: 'groupe' },
  st2110: { t: 'SMPTE ST 2110', theme: 'reseau', short: '', term: 'st2110' },
  'audio-embed': prevu('Audio embeddé et N-1', 'son', 'Le son voyage dans le câble vidéo ; le N-1 rend à chacun le programme sans sa propre voix.'),
};

// ---------------- les fiches du lexique dans les thèmes ----------------
// une famille du lexique qu'aucun thème ne cite (fiches ajoutées plus tard) va dans le thème Réseau
const AUTRES = 'reseau';
/** les familles du lexique d'un thème, avec leurs fiches (sans celles déjà parmi ses notions) */
export function familles(th) {
  const cited = new Set(THEMES.flatMap((t) => t.familles));
  const cats = th.id === AUTRES ? [...th.familles, ...CATS.filter((c) => !cited.has(c))] : th.familles;
  const own = new Set(th.fiches.map((k) => (FICHES[k] && FICHES[k].term) || k));
  return cats.map((nom) => ({ nom, ids: Object.keys(TERMS).filter((k) => TERMS[k].cat === nom && !own.has(k)) })).filter((f) => f.ids.length);
}
/** le thème d'une fiche du cours ou du lexique */
export function themeDe(id) {
  const F = FICHES[id];
  if (F) return F.theme;
  const T = TERMS[id]; if (!T) return '';
  const th = THEMES.find((t) => t.familles.includes(T.cat));
  return th ? th.id : AUTRES;
}

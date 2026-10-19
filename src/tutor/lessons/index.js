// @ts-check
import { EXPLOITATION_LESSONS } from './exploitation.js';
import { REALISATION_LESSONS } from './realisation.js';
import { IMAGE_LESSONS } from './image.js';
import { RALENTI_LESSONS } from './ralentis.js';
import { SON_LESSONS } from './son.js';
import { LIAISON_LESSONS } from './liaisons.js';
import { MATERIEL_LESSONS } from './materiel.js';

// ----------------------------------------------------------------------------------
// Parcours pratiques du chef de car pour tous les postes, les compétences et le matériel (le
// réseau ST 2110 a les siens dans reseau.js, et chaque poste sa présentation dans postes.js).
// ----------------------------------------------------------------------------------
/** @type {import('../engine.js').Lesson[]} */
export const ALL_STATION_LESSONS = [...EXPLOITATION_LESSONS, ...REALISATION_LESSONS, ...IMAGE_LESSONS, ...RALENTI_LESSONS, ...SON_LESSONS, ...LIAISON_LESSONS, ...MATERIEL_LESSONS];

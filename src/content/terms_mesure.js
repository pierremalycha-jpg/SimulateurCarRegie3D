// @ts-check
// ----------------------------------------------------------------------------------
// Fiches « ? » pour la mesure vidéo (PRISM : waveform, vecteurscope, diamant, diagramme de l'œil…). Elles s'ajoutent au lexique commun
// (content/netterms.js) : même format, mêmes boutons « ? » (ui/term.js), même lexique.
// ----------------------------------------------------------------------------------
import { TERMS } from './netterms.js';

/** @type {Record<string, import('./netterms.js').Term>} */
const ADD = {};
Object.assign(TERMS, ADD);

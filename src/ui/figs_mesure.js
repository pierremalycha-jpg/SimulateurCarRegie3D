// @ts-check
// Schémas des fiches « ? » pour la mesure vidéo (PRISM : waveform, vecteurscope, diamant, diagramme de l'œil…) : ajoutés à ui/term_figs.js (FIGS).
import { FIGS } from './term_figs.js';

/** @type {Record<string, () => SVGElement | HTMLElement>} */
const ADD = {};
Object.assign(FIGS, ADD);

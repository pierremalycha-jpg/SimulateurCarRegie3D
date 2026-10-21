// @ts-check
// Schémas des fiches « ? » pour le réseau de contrôle du car SDI (IP, masque, passerelle, VLAN, QoS…) : ajoutés à ui/term_figs.js (FIGS).
import { FIGS } from './term_figs.js';

/** @type {Record<string, () => SVGElement | HTMLElement>} */
const ADD = {};
Object.assign(FIGS, ADD);

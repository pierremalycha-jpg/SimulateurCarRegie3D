// @ts-check
// ----------------------------------------------------------------------------------
// Fiches « ? » pour le réseau de contrôle du car SDI (IP, masque, passerelle, VLAN, QoS…). Elles s'ajoutent au lexique commun
// (content/netterms.js) : même format, mêmes boutons « ? » (ui/term.js), même lexique.
// ----------------------------------------------------------------------------------
import { TERMS } from './netterms.js';

/** @type {Record<string, import('./netterms.js').Term>} */
const ADD = {};
Object.assign(TERMS, ADD);

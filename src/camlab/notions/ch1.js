// @ts-check
// Les fiches écrites du module caméra : L'objectif (chapitre 1). Une fiche par fichier (notions/<id>.js), rangée
// ici sous son identifiant ; index.js remplace la fiche « en préparation » par celle-ci.
import { FRONTALE } from './frontale.js';
import { RAMPING } from './ramping.js';
import { DOUBLEUR } from './doubleur.js';
import { MACRO } from './macro.js';
import { DEFAUTS } from './defauts.js';
import { MONTURE } from './monture.js';
import { BOX_PORTABLE } from './box-portable.js';

/** @type {Record<string, import('./index.js').FicheCamera>} */
export const CH1 = { frontale: FRONTALE, ramping: RAMPING, doubleur: DOUBLEUR, macro: MACRO, defauts: DEFAUTS, monture: MONTURE, 'box-portable': BOX_PORTABLE };

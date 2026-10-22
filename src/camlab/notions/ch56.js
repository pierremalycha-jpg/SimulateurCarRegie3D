// @ts-check
// Les fiches écrites du module caméra : le corps de la caméra, le viseur et le cadreur (chapitres 5 et 6). Une fiche par fichier (notions/<id>.js), rangée
// ici sous son identifiant ; index.js remplace la fiche « en préparation » par celle-ci.
import { COMMANDES } from './commandes.js';
import { ALIMENTATION } from './alimentation.js';
import { TALLY } from './tally.js';
import { RETOURS } from './retours.js';
import { VISEUR } from './viseur.js';
import { CADREUR } from './cadreur.js';

/** @type {Record<string, import('./index.js').FicheCamera>} */
export const CH56 = { commandes: COMMANDES, alimentation: ALIMENTATION, tally: TALLY, retours: RETOURS, viseur: VISEUR, cadreur: CADREUR };

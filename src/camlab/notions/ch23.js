// @ts-check
// Les fiches écrites du module caméra : les filtres, le prisme et les capteurs (chapitres 2 et 3). Une fiche par fichier (notions/<id>.js), rangée
// ici sous son identifiant ; index.js remplace la fiche « en préparation » par celle-ci.
import { CC } from './cc.js';
import { OLPF } from './olpf.js';
import { GAIN } from './gain.js';
import { SHUTTER } from './shutter.js';
import { EXPOSITION } from './exposition.js';
import { FORMATS } from './formats.js';

/** @type {Record<string, import('./index.js').FicheCamera>} */
export const CH23 = { cc: CC, olpf: OLPF, gain: GAIN, shutter: SHUTTER, exposition: EXPOSITION, formats: FORMATS };

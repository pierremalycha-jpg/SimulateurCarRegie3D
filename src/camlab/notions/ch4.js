// @ts-check
// Les fiches écrites du module caméra : le traitement de l'image (chapitre 4). Une fiche par fichier (notions/<id>.js), rangée
// ici sous son identifiant ; index.js remplace la fiche « en préparation » par celle-ci.
import { QUANTIF } from './quantif.js';
import { NOIR } from './noir.js';
import { GAMMA } from './gamma.js';
import { KNEE } from './knee.js';
import { DETAIL } from './detail.js';
import { MATRICE } from './matrice.js';
import { FICHIERS } from './fichiers.js';

/** @type {Record<string, import('./index.js').FicheCamera>} */
export const CH4 = { quantif: QUANTIF, noir: NOIR, gamma: GAMMA, knee: KNEE, detail: DETAIL, matrice: MATRICE, fichiers: FICHIERS };

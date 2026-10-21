// @ts-check
// Les fiches écrites du module caméra : la voie caméra (chapitre 7). Une fiche par fichier (notions/<id>.js), rangée
// ici sous son identifiant ; index.js remplace la fiche « en préparation » par celle-ci.
import { FIBRE } from './fibre.js';
import { CCU } from './ccu.js';
import { RCP } from './rcp.js';
import { GENLOCK } from './genlock.js';
import { SORTIE } from './sortie.js';
import { LINEUP } from './lineup.js';

/** @type {Record<string, import('./index.js').FicheCamera>} */
export const CH7 = { fibre: FIBRE, ccu: CCU, rcp: RCP, genlock: GENLOCK, sortie: SORTIE, lineup: LINEUP };

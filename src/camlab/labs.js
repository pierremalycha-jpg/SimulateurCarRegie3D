// @ts-check
import { OPTIQUE } from './labs/optique.js';
import { BLOC } from './labs/bloc.js';
import { CORPS } from './labs/corps.js';

// ----------------------------------------------------------------------------------
// Les manipulations des fiches du module caméra, nommées par le champ `lab` de la fiche.
// Chacune reçoit ctx = { lens(état) } : elle pilote aussi la caméra 3D (bagues, filtre, image du
// viseur et du moniteur). Elle renvoie { node, dispose }. Le viseur simulé est dans vf.js, les
// commandes communes dans controls.js, les calculs dans optics.js.
// - labs/optique.js : focale, zoom, point, iris, profondeur de champ, tirage
// - labs/bloc.js : filtres ND, prisme, capteur, balance des noirs et des blancs
// - labs/corps.js : menu de la caméra, connectique
// ----------------------------------------------------------------------------------

export const LABS = { ...OPTIQUE, ...BLOC, ...CORPS };

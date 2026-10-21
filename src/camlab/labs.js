// @ts-check
import { OPTIQUE } from './labs/optique.js';
import { BLOC } from './labs/bloc.js';
import { CORPS } from './labs/corps.js';
import { LABS_CH1 } from './labs/ch1.js';
import { LABS_CH23 } from './labs/ch23.js';
import { LABS_CH4 } from './labs/ch4.js';
import { LABS_CH56 } from './labs/ch56.js';
import { LABS_CH7 } from './labs/ch7.js';
import { LABS_CH89 } from './labs/ch89.js';

// ----------------------------------------------------------------------------------
// Les manipulations des fiches du module caméra, nommées par le champ `lab` de la fiche.
// Chacune reçoit ctx = { lens(état) } : elle pilote aussi la caméra 3D (bagues, filtre, image du
// viseur et du moniteur). Elle renvoie { node, dispose }. Le viseur simulé est dans vf.js, les
// commandes communes dans controls.js, les calculs dans optics.js.
// - labs/optique.js : focale, zoom, point, iris, profondeur de champ, tirage
// - labs/bloc.js : filtres ND, prisme, capteur, balance des noirs et des blancs
// - labs/corps.js : menu de la caméra, connectique
// - labs/ch1.js, ch23.js, ch4.js, ch56.js, ch7.js, ch89.js : les lots 2 et 3, chapitre par chapitre
// ----------------------------------------------------------------------------------

export const LABS = { ...OPTIQUE, ...BLOC, ...CORPS, ...LABS_CH1, ...LABS_CH23, ...LABS_CH4, ...LABS_CH56, ...LABS_CH7, ...LABS_CH89 };

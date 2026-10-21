// @ts-check
// Les fiches écrites du module caméra : jusqu'au moniteur, et pour aller plus loin (chapitres 8 et 9). Une fiche par fichier (notions/<id>.js), rangée
// ici sous son identifiant ; index.js remplace la fiche « en préparation » par celle-ci.
import { WAVEFORM } from './waveform.js';
import { VECTO } from './vecto.js';
import { MONITEUR } from './moniteur.js';
import { MIRES } from './mires.js';
import { GRANDCAPTEUR } from './grandcapteur.js';
import { HDR } from './hdr.js';
import { HFR } from './hfr.js';

/** @type {Record<string, import('./index.js').FicheCamera>} */
export const CH89 = { waveform: WAVEFORM, vecto: VECTO, moniteur: MONITEUR, mires: MIRES, grandcapteur: GRANDCAPTEUR, hdr: HDR, hfr: HFR };

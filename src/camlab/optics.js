// @ts-check
import { clamp } from '../util.js';
import { SENSORS, maxAperture as rampAperture } from '../data/cameras.js';

// ----------------------------------------------------------------------------------
// Optique de la caméra du module : le zoom Fujinon ZA12x4.5BERD de l'établissement (fiche
// constructeur : 4,5–54 mm, f/1,8 jusqu'à 41 mm puis f/2,4 à 54 mm, doubleur ×2, distance
// minimale 0,3 m) sur un capteur 2/3" 16:9 (9,59 × 5,39 mm, comme data/cameras.js).
// Modèle de la lentille mince : une erreur de mise au point se mesure dans l'espace image, en mm
// entre le plan où se forme l'image et le capteur. La tache de flou vaut cette erreur divisée
// par le nombre f. C'est ce qui explique le tirage : la bague de point agit en f², la bague de
// tirage d'un même déplacement à toutes les focales.
// ----------------------------------------------------------------------------------

export const LENS = { name: 'Fujinon ZA12x4.5BERD', fmin: 4.5, fmax: 54, f0: 1.8, ramp: 41, fLong: 2.4, mod: 0.3, ext: 2 };
export const SENSOR = SENSORS['2/3'];
/** cercle de confusion admis pour une image HD sur 2/3" (mm) : environ deux pixels */
export const COC = 0.011;
/** crans de la bague d'iris, gravés sur l'objectif */
export const IRIS_STOPS = [1.8, 2.8, 4, 5.6, 8, 11, 16];

/** ouverture maximale à la focale f (mm), doubleur engagé ou non */
export const maxAperture = (f, ext = false) => rampAperture(LENS, f, ext);
/** angle de champ vertical (radians) à la focale f */
export const vfov = (f) => 2 * Math.atan(SENSOR.h / 2 / f);
/** hauteur du champ (m) cadrée à la distance D (m) */
export const fieldHeight = (D, f) => D * SENSOR.h / f;

/**
 * erreur de mise au point dans l'espace image (mm) : sujet à D (m), objectif réglé sur dF (m,
 * Infinity pour l'infini), erreur de tirage delta (mm, positive = image derrière le capteur)
 */
export function defocus(f, D, dF, delta = 0) {
  const inv = (d) => (isFinite(d) ? 1 / (d * 1000) : 0);
  return f * f * (inv(D) - inv(dF)) + delta;
}
/** diamètre de la tache de flou sur le capteur (mm) */
export const blur = (f, D, dF, delta, N) => Math.abs(defocus(f, D, dF, delta)) / N;
/** l'image est-elle nette (tache plus petite que le cercle de confusion) ? */
export const sharp = (f, D, dF, delta, N) => blur(f, D, dF, delta, N) <= COC;

// ---- bague de point : position 0 (infini) à 1 (distance minimale), linéaire en 1/d ----
export const focusDist = (u) => (u <= 1e-6 ? Infinity : LENS.mod / clamp(u, 1e-6, 1));
export const focusPos = (d) => (isFinite(d) ? clamp(LENS.mod / d, 0, 1) : 0);
// ---- bague de zoom : position 0 (grand angle) à 1 (téléobjectif), logarithmique ----
export const zoomFocal = (z) => LENS.fmin * Math.pow(LENS.fmax / LENS.fmin, clamp(z, 0, 1));
export const zoomPos = (f) => Math.log(clamp(f, LENS.fmin, LENS.fmax) / LENS.fmin) / Math.log(LENS.fmax / LENS.fmin);

/** écriture française d'une valeur : 4,5 mm · f/1,8 · 2,7 m */
export const fr = (v, d = 1) => (Math.round(v * 10 ** d) / 10 ** d).toString().replace('.', ',');
export const distLabel = (d) => (isFinite(d) ? (d < 10 ? fr(d, d < 1 ? 2 : 1) : fr(d, 0)) + ' m' : '∞');

/** distance de la mire au plan des capteurs, sur le plateau du module (m) */
export const MIRE_D = 3;
/** @type {[string, number][]} filtres ND de la roue de la caméra : nom et lumière transmise */
export const ND = [['CLEAR', 1], ['1/4ND', 1 / 4], ['1/16ND', 1 / 16], ['1/64ND', 1 / 64]];
/** lumière reçue par les capteurs, relative à f/8 sans filtre ni gain (l'éclairage du plateau) */
export const exposureOf = (N, nd = 1, gainDb = 0) => (8 / N) ** 2 * nd * 10 ** (gainDb / 20);
/** nombre f réellement obtenu : l'iris ne s'ouvre pas plus que ce que permet la focale (ramping) */
export const effAperture = (N, f, ext = false) => Math.max(N, maxAperture(f, ext));
/** diamètre de la tache de flou en pixels d'une image de hauteur H pixels */
export const blurPx = (blurMm, H) => blurMm / SENSOR.h * H;

// @ts-check
import { CANAUX, trame, debitArtnet, dePortAddress, dip } from '../labo/calc/dmx.js';

// ----------------------------------------------------------------------------------
// Les quelques calculs de la partie « Commander la lumière » du chapitre « La lumière » (v19.29) qui ne sont
// pas déjà dans les ateliers du Labo (labo/calc/dmx.js, labo/calc/show.js : ceux-là s'importent, ils ne se
// recopient pas). Calcul pur, sans interface.
//   - La cadence d'une ligne DMX : la trame de labo/calc/dmx.js (coupure 176 µs, marque 12 µs, 44 µs par
//     créneau), bornée par l'intervalle minimal entre deux coupures que fixe la norme pour un émetteur
//     (ANSI E1.11, tableau des temps à l'émission : 1 204 µs, soit 830 trames par seconde au plus).
//   - L'écart de la tache d'une lyre quand sa position avance d'un pas : d × tan(pas), à la distance d,
//     perpendiculairement au faisceau (plus encore sur un sol en biais).
//   - La phase répartie entre n lyres (une vague) : 0, 360 ÷ n, 2 × 360 ÷ n…
//   - Le débit de n univers Art-Net : n fois celui d'un univers (labo/calc/dmx.js, ArtDmx complet,
//     en-têtes compris).
//   - L'univers d'une console (numérotés à partir de 1) en Port-Address d'Art-Net (numéroté à partir de 0).
// ----------------------------------------------------------------------------------
/** intervalle minimal entre deux coupures (µs), à l'émission (ANSI E1.11) */
export const BREAK_A_BREAK_MIN_US = 1204;

/**
 * La cadence d'une ligne DMX de n canaux : durée de la trame (µs), trames par seconde, et si la norme oblige
 * à l'allonger (moins de 23 canaux : la trame serait plus courte que 1 204 µs).
 * @param {number} n nombre de canaux envoyés (1 à 512)
 */
export function cadence(n = CANAUX) {
  const t = trame(Math.max(1, Math.min(CANAUX, Math.round(n))));
  const us = Math.max(t.us, BREAK_A_BREAK_MIN_US);
  return { us, ms: us / 1000, hz: 1e6 / us, allongee: t.us < BREAK_A_BREAK_MIN_US };
}

/** l'écart de la tache (m) à la distance d (m) quand la position avance d'un angle pasDeg (degrés) */
export const ecartTache = (pasDeg, d) => d * Math.tan(Math.abs(pasDeg) * Math.PI / 180);

/** la phase (degrés) de chacune des n lyres d'une vague : réparties sur etendue degrés (360 : un tour complet) */
export const phases = (n, etendue = 360) => Array.from({ length: Math.max(0, Math.round(n)) }, (_, k) => k * etendue / Math.max(1, Math.round(n)));

/** le débit (kbit/s) de n univers Art-Net envoyés à hz trames par seconde */
export const debitUnivers = (n, hz = 44) => n * debitArtnet(hz).kbps;

/** l'univers u d'une console (à partir de 1) en Port-Address d'Art-Net (à partir de 0), et ses Net, Sub-Net, Universe */
export function versPortAddress(u) {
  const pa = Math.max(0, Math.round(u) - 1);
  return { pa, ...dePortAddress(pa) };
}

/** les valeurs des commutateurs DIP levés pour une adresse (« 37 » → [1, 4, 32]) */
export const dipLeves = (adresse) => dip(adresse).map((on, k) => (on ? 1 << k : 0)).filter(Boolean);

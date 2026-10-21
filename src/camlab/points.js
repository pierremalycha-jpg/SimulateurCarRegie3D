// @ts-check
import { NOTIONS, ORDRE } from '../content/cours/camera/index.js';

// ----------------------------------------------------------------------------------
// Les pastilles de la caméra 3D : où elles s'accrochent, de quel côté elles se voient, d'où on
// regarde quand on clique dessus. Coordonnées dans le repère de la caméra (camlab/model.js :
// X vers l'avant, Y vers le haut, Z vers la droite du cadreur, origine à la monture), ou dans le
// repère du plateau pour la mire et le coin de la vision (`obj` : la pièce du plateau qui porte
// la pastille, sa position est lue dans la scène).
// `view` : direction depuis laquelle on regarde (vers la pastille) et distance (m). `mode` : vue
// à prendre en arrivant (coupe pour voir le prisme). Les notions d'une pastille sont celles
// dont `point` la désigne (content/cours/camera/index.js), plus `extra`.
// ----------------------------------------------------------------------------------

/**
 * @typedef {object} Pastille
 * @property {string} id
 * @property {string} nom ce que montre la pastille
 * @property {[number, number, number]} [at] point d'accroche (repère de la caméra)
 * @property {string} [obj] pièce du plateau qui porte la pastille
 * @property {[number, number, number]} n normale : la pastille se voit de ce côté
 * @property {[number, number, number]} dir direction de regard (de la pastille vers l'œil)
 * @property {number} dist distance de l'œil (m)
 * @property {[number, number, number]} [look] ce que la vue regarde, si ce n'est pas la pastille (repère de la caméra)
 * @property {'cut' | 'explode'} [mode]
 * @property {string[]} [extra] autres notions à proposer ici
 */

/** @type {Pastille[]} */
export const PASTILLES = [
  { id: 'frontale', nom: 'La lentille frontale et le pare-soleil', at: [0.29, 0.062, -0.088], n: [1, 0.35, -0.6], look: [0.2, 0, 0], dir: [1, 0.28, -0.55], dist: 0.6 },
  { id: 'point', nom: 'La bague de point', at: [0.152, 0.024, -0.046], n: [0, 0.45, -1], dir: [0.35, 0.4, -1], dist: 0.5 },
  { id: 'zoom', nom: 'La bague de zoom', at: [0.104, 0.016, -0.043], n: [0, 0.35, -1], dir: [0.2, 0.38, -1], dist: 0.42 },
  { id: 'iris', nom: 'La bague d\'iris', at: [0.075, 0.016, -0.041], n: [0, 0.35, -1], dir: [0.05, 0.38, -1], dist: 0.38 },
  { id: 'tirage', nom: 'La bague de tirage (F.f)', at: [0.0125, 0.032, -0.02], n: [0, 0.85, -0.55], dir: [0.25, 0.85, -0.75], dist: 0.36 },
  { id: 'macro', nom: 'Le levier macro', at: [0.027, -0.047, -0.02], n: [0, -0.6, -0.8], dir: [0.3, -0.45, -1], dist: 0.36 },
  { id: 'doubleur', nom: 'Le doubleur de focale', at: [0.056, -0.052, 0.01], n: [0, -1, 0], dir: [0.35, -0.75, -0.55], dist: 0.4 },
  { id: 'monture', nom: 'La monture et le câble de l\'objectif', at: [-0.006, 0.05, -0.03], n: [0.3, 0.6, -0.75], dir: [0.55, 0.45, -1], dist: 0.42 },
  { id: 'poignee', nom: 'La poignée du servo', at: [0.1, -0.005, 0.104], n: [0, 0, 1], dir: [0.35, 0.3, 1], dist: 0.55, extra: ['zoom', 'iris', 'exposition'] },
  { id: 'filtres', nom: 'Les filtres', at: [-0.038, 0.044, -0.072], n: [0, 0, -1], dir: [-0.05, 0.2, -1], dist: 0.42 },
  { id: 'commandes', nom: 'Les commandes du corps', at: [-0.06, 0.008, -0.075], n: [0, 0, -1], dir: [0, 0.12, -1], dist: 0.48 },
  { id: 'menu', nom: 'Les touches du menu', at: [-0.058, -0.09, -0.073], n: [0, -0.15, -1], dir: [0.05, -0.05, -1], dist: 0.42 },
  { id: 'bloc', nom: 'Le bloc prisme et les capteurs', at: [-0.06, 0.083, -0.042], n: [0, 1, -0.35], look: [-0.037, 0, 0], dir: [0.12, 0.3, -1], dist: 0.24, mode: 'cut' },
  { id: 'viseur', nom: 'Le viseur', at: [-0.416, 0.29, -0.06], n: [-1, 0, 0], dir: [-1, 0.08, -0.05], dist: 0.6 },
  { id: 'intercom', nom: 'Retours, intercom et tally', at: [-0.331, 0.02, -0.054], n: [-1, 0, -0.2], dir: [-1, 0.15, -0.35], dist: 0.45 },
  { id: 'connectique', nom: 'La connectique', at: [-0.326, -0.1, 0.012], n: [-1, 0, 0], dir: [-1, 0.12, 0.12], dist: 0.42 },
  { id: 'fibre', nom: 'La prise fibre', at: [-0.344, -0.035, 0.056], n: [-1, 0, 0.4], dir: [-1, 0.2, 0.6], dist: 0.5 },
  { id: 'manches', nom: 'Les manches et les commandes reportées', at: [-0.6, -0.28, -0.25], n: [-0.3, 1, 0], dir: [-0.8, 0.9, -0.1], dist: 1.1, extra: ['zoom', 'point'] },
  { id: 'mire', nom: 'La mire', obj: 'mire', n: [-1, 0, 0], dir: [-1, 0.12, 0.35], dist: 1.4 },
  { id: 'ccu', nom: 'La CCU', obj: 'ccu', n: [0.9, 0.3, -0.4], dir: [0.9, 0.55, -0.4], dist: 1.1 },
  { id: 'rcp', nom: 'Le RCP', obj: 'rcp', n: [0, 1, 0], dir: [0.8, 1, -0.35], dist: 0.8 },
  { id: 'moniteur', nom: 'Le moniteur de référence', obj: 'moniteur', n: [0.9, 0, -0.4], dir: [0.9, 0.15, -0.4], dist: 1.0 },
  { id: 'mesure', nom: 'Le moniteur de forme d\'onde', obj: 'mesure', n: [0.9, 0, -0.4], dir: [0.95, 0.15, -0.3], dist: 0.75 },
];

/** les notions qui s'ouvrent sur une pastille : d'abord celles qui y sont rattachées, puis les autres proposées */
export function notionsAt(id) {
  const p = PASTILLES.find((x) => x.id === id);
  const own = ORDRE.filter((n) => NOTIONS[n].point === id);
  return [...own, ...((p && p.extra) || []).filter((n) => !own.includes(n))];
}

// @ts-check
import { registerChapter } from './index.js';
import { LUMIERE_MESURE } from './lumiere_mesure.js';
import { LUMIERE_ECLAIRER } from './lumiere_eclairer.js';
import { LUMIERE_COMMANDE } from './lumiere_commande.js';

// ----------------------------------------------------------------------------------
// Chapitre « La lumière » (v19.29, décidé le 3 novembre 2026), en trois parties : la lumière et sa
// mesure (les sources, flux, intensité, éclairement, luminance, la distance et l'angle, la couleur,
// mesurer et exposer : cours/lumiere_mesure.js), éclairer pour la caméra (les projecteurs, le plateau
// de télévision, le stade : cours/lumiere_eclairer.js), commander la lumière (le DMX, la ligne, la
// console, les lyres, Art-Net et sACN : cours/lumiere_commande.js). Les calculs sont ceux des ateliers
// du Labo (labo/calc/photometrie.js, lumiere.js, dmx.js, show.js) : les leçons et le Labo disent les
// mêmes chiffres. Rangement par niveau : cours/parcours.js (PARCOURS.lumiere).
// ----------------------------------------------------------------------------------
/** les parties du chapitre, dans l'ordre du sommaire, et leurs leçons dans l'ordre de lecture */
export const PARTIES = [
  ['La lumière et sa mesure', ['lumiere-sources', 'lumiere-grandeurs', 'lumiere-distance', 'lumiere-couleur', 'lumiere-mesure']],
  ['Éclairer pour la caméra', ['lumiere-projecteurs', 'lumiere-plateau', 'lumiere-stade']],
  ['Commander la lumière', ['lumiere-dmx', 'lumiere-ligne', 'lumiere-console', 'lumiere-lyres', 'lumiere-reseau']],
];
/**
 * Range les leçons dans l'ordre des parties et note la partie de chacune (une leçon absente du tableau irait à la fin).
 * @param {import('./index.js').Lesson[]} lecons
 */
function ranger(lecons) {
  /** @type {import('./index.js').Lesson[]} */
  const out = [];
  for (const [nom, ids] of /** @type {[string, string[]][]} */ (PARTIES)) for (const id of ids) { const l = lecons.find((x) => x.id === id); if (l) out.push(Object.assign(l, { partie: nom })); }
  return out.concat(lecons.filter((l) => !out.includes(l)));
}
registerChapter({
  id: 'lumiere', title: 'La lumière', icon: 'lumiere',
  intro: 'La lumière pour la caméra et sa commande : les sources et leur couleur, ce que mesure un luxmètre, la distance et l\'angle, exposer d\'après la lumière ; les projecteurs, le plateau de télévision, le stade ; puis le DMX, la ligne, la console, les lyres et la lumière sur le réseau.',
  module: { label: 'Le Labo : les ateliers Photométrie, DMX et la console dot2', sub: 'Manipuler et programmer', event: 'labo', arg: { atelier: 'photometrie' } },
  lessons: ranger([...LUMIERE_MESURE, ...LUMIERE_ECLAIRER, ...LUMIERE_COMMANDE]),
});

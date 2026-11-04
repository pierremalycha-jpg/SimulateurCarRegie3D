// @ts-check
import { registerChapter } from './index.js';
import { PTZ_CAMERA } from './ptz_camera.js';
import { PTZ_RESEAU } from './ptz_reseau.js';
import { PTZ_EXPLOITER } from './ptz_exploiter.js';

// ----------------------------------------------------------------------------------
// Chapitre « Les caméras PTZ » (v19.30, décidé le 4 novembre 2026), sur le matériel du BTS : deux AW-HE130, une
// AW-UE20, un pupitre AW-RP150, un PC technique avec Easy IP Setup, un switch PoE+. Trois parties : la caméra et
// son système (cours/ptz_camera.js), mettre en réseau (cours/ptz_reseau.js : adresser, Easy IP Setup, PoE, page
// web, pupitre), exploiter et dépanner (cours/ptz_exploiter.js : flux IP, QoS, recette). Les manipulations
// calculent avec le modèle de l'atelier Caméras PTZ du Labo (labo/calc/ptz.js) et cours/ptz_calc.js : les leçons
// et le Labo disent les mêmes chiffres. Rangement par niveau : cours/parcours.js (PARCOURS.ptz).
// ----------------------------------------------------------------------------------
/** les parties du chapitre, dans l'ordre du sommaire, et leurs leçons dans l'ordre de lecture */
export const PARTIES = [
  ['La caméra et son système', ['ptz-tourelle', 'ptz-systeme']],
  ['Mettre en réseau', ['ptz-adresse', 'ptz-easyip', 'ptz-poe', 'ptz-web', 'ptz-pupitre']],
  ['Exploiter et dépanner', ['ptz-flux', 'ptz-qos', 'ptz-recette']],
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
  id: 'ptz', title: 'Les caméras PTZ', icon: 'ccu',
  intro: 'Les tourelles du BTS (AW-HE130, AW-UE20) et leur pupitre AW-RP150 : la caméra et son système, puis la mise en réseau (adresse, masque, passerelle, port, Easy IP Setup, PoE+, page web, pupitre), enfin les flux IP, la QoS, la recette et le dépannage.',
  module: { label: 'Le Labo : l\'atelier Caméras PTZ', sub: 'Mettre le banc en service pas à pas', event: 'labo', arg: { atelier: 'ptz' } },
  lessons: ranger(/** @type {any} */ ([...PTZ_CAMERA, ...PTZ_RESEAU, ...PTZ_EXPLOITER])),
});

// @ts-check
import { S } from '../../state.js';
import { STATION_INFO } from '../../content/stations.js';
import { ROUTER } from '../../pipeline.js';
import { mixInputs } from '../../equip.js';

// ----------------------------------------------------------------------------------
// Outils communs aux parcours des postes : aller au poste, cibles à montrer, gestes d'interface
// (« Fais-le pour moi » quand l'action n'existe que dans la page), sources du mélangeur.
// ----------------------------------------------------------------------------------
export const at = (id) => (c) => c.view().station === id;
const titleOf = (id) => (STATION_INFO[id] ? STATION_INFO[id].title : id);
/**
 * indices communs pour rejoindre un poste : d'abord l'outil (le téléphone), puis l'endroit et le geste
 * @param {string} id @returns {string[]}
 */
export function stationHints(id) {
  const where = STATION_INFO[id] && STATION_INFO[id].where;
  return [
    'Le téléphone (touche Tab), application Aller à, range les postes du car par zone : production, vision et ralentis, technique, cabine son. Dans quelle zone travaille ce poste ?',
    `${where ? `Ce poste se trouve ici : ${where}. ` : ''}Choisis-le dans le téléphone, ou approche-toi, vise le poste et appuie sur E.`,
  ];
}

/**
 * étape « aller au poste » (sautée si on y est déjà)
 * @param {string} id @param {string} say @param {string} ok @param {Partial<import('../engine.js').Step>} [more]
 * @returns {import('../engine.js').Step}
 */
export function goStation(id, say, ok, more = {}) {
  return {
    id: 'open-' + id, title: `Aller au poste ${titleOf(id)}`, say,
    do: `Rejoins le poste ${titleOf(id)} (bouton « Emmène-moi » si tu ne sais pas où il est).`,
    go: { station: id }, done: at(id), skip: at(id), ok,
    hints: stationHints(id),
    auto: (c) => c.io.go({ station: id }), ...more,
  };
}
// geste d'interface (sans navigateur, les tests simulent seulement l'effet sur l'état)
export const ui = (c, name, ...a) => (c.io.ui ? c.io.ui(name, ...a) : undefined);
// bouton d'un pupitre de poste (hwBtn : le libellé suivi de son sous-titre)
export const hw = (text, label = text, scope = '#station') => ({ sel: `${scope} button.hw`, text, label });
export const btn = (text, label = text, scope = '#station') => ({ sel: `${scope} button`, text, label });
// entrée du mélangeur qui reçoit une source (CAM3, EVSA…) ; 0 si aucune
export function meIndex(src) { for (let n = 1; n <= mixInputs(); n++) if (ROUTER.map['ME' + n] === src) return n; return 0; }
export const meOf = (n) => ROUTER.map['ME' + n];
// caméras présentes, filaires (hors HF) ou toutes
export const camIds = (wired = false) => S.cams.filter((c) => !wired || !c.rf).map((c) => c.id).sort((a, b) => a - b);
// une caméra du dispositif qui n'est pas à l'antenne, de préférence parmi `pref`
export function freeCam(pgmSrc, pref = [3, 2, 4, 5, 1]) {
  const ids = camIds();
  return [...pref.filter((i) => ids.includes(i)), ...ids].find((i) => 'CAM' + i !== pgmSrc && meIndex('CAM' + i)) || 0;
}
export const dom = () => typeof document !== 'undefined';

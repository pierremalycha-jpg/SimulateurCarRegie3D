// @ts-check
import { STATION_INFO } from '../../content/stations.js';
import { stationHints } from './kit.js';

// ----------------------------------------------------------------------------------
// « Présente-moi ce poste » : pour chaque poste, le chef de car reprend la fiche du poste
// (rôle, matériel, déroulé, conseils) et la raconte en quelques étapes. Les parcours guidés
// détaillés (réseau ST 2110 pour commencer) viennent en plus.
// ----------------------------------------------------------------------------------
const list = (a) => a.map((x) => '- ' + x).join('\n');

// postes qui s'ouvrent dans le car (les autres sont des fiches : cadreur, antenne, local TV…)
/** @param {string} id @param {boolean} canOpen */
export function stationLesson(id, canOpen) {
  if (!STATION_INFO[id]) return null;
  // la fiche est relue à chaque affichage : celle du poste « reseau » dépend du type de car (SDI ou IP)
  const I = () => STATION_INFO[id];
  const steps = [];
  if (canOpen) steps.push({
    id: 'open', title: 'Aller au poste',
    say: () => `On va au poste **${I().title}**. ${I().where ? `Il se trouve ici : ${I().where}.` : ''}`,
    do: 'Rejoins le poste (bouton « Emmène-moi »).',
    go: { station: id }, done: (c) => c.view().station === id, skip: (c) => c.view().station === id,
    ok: 'Nous y sommes. Je te présente le poste : son rôle d\'abord, puis son matériel et sa façon de travailler.',
    hints: stationHints(id),
    auto: (c) => c.io.go({ station: id }),
  });
  steps.push({ id: 'role', title: 'Le rôle', say: () => `**${I().title}**${!canOpen && I().where ? ` — ${I().where}` : ''}.\n\n${I().role}` });
  if (I().gear && I().gear.length) steps.push({ id: 'gear', title: 'Le matériel', say: () => `Le matériel du poste :\n${list(I().gear)}` });
  if (I().process && I().process.length) steps.push({ id: 'process', title: 'Le déroulé', say: () => `Comment on travaille, dans l'ordre :\n${list(I().process)}` });
  if (I().tips && I().tips.length) steps.push({ id: 'tips', title: 'Les conseils', say: () => `Ce que je dis toujours aux nouveaux :\n${list(I().tips)}` });
  return {
    id: 'poste-' + id, domain: 'Les postes du car', stations: [id],
    get title() { return `Présente-moi : ${I().title}`; }, get summary() { return I().where || ''; }, duration: '3 min', level: 'découverte',
    outro: 'Pour aller plus loin, la fiche complète du poste reste disponible (bouton « Fiche du poste »), et le Cours (onglet Postes) la reprend avec tous les autres postes.',
    steps,
  };
}
export const stationIds = () => Object.keys(STATION_INFO);

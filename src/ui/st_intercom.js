// @ts-check
import { S } from '../state.js';
import { el } from '../util.js';
import { STATION_INFO } from '../content/stations.js';
import { intercom } from './common.js';
import { explain } from './widgets.js';
import { openDevice } from '../equipment/viewer.js';
import { ICOM, ICOM_TYPES, icomKeys, icomState } from '../poste3d/icom.js';

export { ICOM, ICOM_TYPES, icomKeys, icomState };

// Poste intercom : le pupitre à touches du réalisateur (comme les pupitres numériques Riedel, Clear-Com…).
// Chaque touche a un afficheur (le nom du canal et son type), TALK (parler) et LISTEN (écouter). L'état des
// touches (ICOM) et leurs gestes (ICOMACT) sont communs au poste à plat et au pupitre en 3D (poste3d/intercom.js).

/** les gestes du pupitre (mêmes explications en 2D et en 3D) */
export const ICOMACT = {
  talk(l, t, d) {
    const st = icomState(l, t); st.talk = !st.talk;
    if (st.talk) intercom('ORDRES', `Canal ouvert vers : ${l}`);
    explain(`TALK ${l} ${st.talk ? 'ouvert' : 'fermé'} · ${ICOM_TYPES[t][1]} ${d}`, 'icom:' + l);
  },
  listen(l, t) {
    const st = icomState(l, t); st.listen = !st.listen;
    explain(`LISTEN ${l} ${st.listen ? 'activé : tu entends ce canal' : 'coupé : tu n\'entends plus ce canal'}. Chaque touche a un volume d'écoute réglable ; on coupe les canaux inutiles pour rester concentré.`, 'icom:l' + l);
  },
};

/** le parcours d'un ordre, le tally, les équipements : texte du poste à plat (et du tiroir en 3D) */
function prose() {
  return [el('div', { class: 'panelgrid' },
    el('div', { class: 'hwpanel prose' }, el('h3', {}, 'Le trajet d\'un ordre jusqu\'au cadreur'), el('ol', { class: 'steps' },
      el('li', {}, 'Micro col de cygne du pupitre → convertisseur dans le pupitre → liaison numérique (AES3, fibre ou AES67) vers la matrice.'),
      el('li', {}, 'La matrice route la voix vers la conférence « CAMÉRAS » : sortie sur une carte 4 fils analogique ou numérique.'),
      el('li', {}, 'Câble multipaire vers la baie CCU : connecteur INTERCOM/TALLY/IO (D-sub 50) de chaque CCU, canaux PROD et ENG.'),
      el('li', {}, 'La CCU multiplexe l\'audio dans la fibre hybride avec la vidéo retour, le tally et les commandes.'),
      el('li', {}, 'Sur la caméra : connecteur INTERCOM 1 (XLR-5) → casque du cadreur. Le micro du casque repart dans l\'autre sens.'))),
    el('div', { class: 'hwpanel prose' }, el('h3', {}, 'Et le tally ?'), el('p', {}, 'Le mélangeur sait quelle source est au PGM (rouge) et en preset (vert). Il l\'envoie à un contrôleur de tally (GPI ou protocole TSL UMD sur IP), qui allume le tally de chaque CCU (contacts R/G/Y du D-sub 50). La CCU transmet l\'information à la caméra : voyant sur la tête, dans le viseur, et indication sur le RCP. Le même système envoie les noms de sources (UMD) au multiview.'),
      el('p', {}, STATION_INFO.intercom.role))),
  el('div', { class: 'hwpanel prose' }, el('h3', {}, 'Équipements'), el('ul', { class: 'steps' }, STATION_INFO.intercom.gear.map((g) => el('li', {}, g))))];
}

export function buildIntercom(body, arg, ctx) {
  // chaque ouverture du poste repart des réglages d'usage (TALK fermés, conférences et IFB écoutées)
  ICOM.keys = {};
  const grid = el('div', { class: 'icp' });
  const upds = [];
  for (const [l, t, d] of icomKeys()) {
    const st = icomState(l, t);
    const talk = el('button', { class: 'icp-talk', 'aria-label': 'TALK ' + l, title: 'Parler vers ' + l, onclick: () => ICOMACT.talk(l, t, d) }, 'TALK');
    const lis = el('button', { class: 'icp-lis', 'aria-label': 'LISTEN ' + l, title: 'Écouter ' + l, onclick: () => ICOMACT.listen(l, t) }, 'LISTEN');
    const k = el('div', { class: 'icp-key' }, el('div', { class: 'icp-lcd' }, el('b', {}, l), el('small', {}, ICOM_TYPES[t][0])), el('div', { class: 'icp-btns' }, talk, lis));
    const upd = () => { talk.classList.toggle('on', st.talk); lis.classList.toggle('on', st.listen); k.classList.toggle('talking', st.talk); };
    upd(); upds.push(upd); grid.appendChild(k);
  }
  body.append(el('div', { class: 'hwpanel' }, el('h3', {}, 'Pupitre d\'intercom (poste réalisateur, 16 touches)'), grid,
      el('p', { class: 'note' }, 'Comme sur les pupitres numériques (Riedel, Clear-Com…) : chaque touche a une fonction TALK (parler, en appui bref = momentané, appui long = verrouillé) et LISTEN (écouter). L\'afficheur indique la destination et son type.'),
      el('div', { class: 'hwrow' }, el('button', { class: 'btn small', onclick: () => openDevice('icom', 1) }, 'Voir la matrice d\'intercom'), el('button', { class: 'btn small', onclick: () => openDevice('ccu', S.cams[0] ? S.cams[0].id : 1, { focus: 'icom' }) }, 'Voir l\'entrée intercom d\'une CCU'))),
    ...prose());
  // l'état est commun avec le pupitre en 3D : on relit les touches à chaque mise à jour
  return { update() { for (const u of upds) u(); } };
}

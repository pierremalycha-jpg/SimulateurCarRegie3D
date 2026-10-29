// @ts-check
import { el, mmss } from '../util.js';
import { explain } from '../ui/widgets.js';
import { ICOM, ICOM_TYPES, ICOMACT, icomKeys, icomState, buildIntercom } from '../ui/st_intercom.js';
import { ICOMS, OLED, KEY, modX, modZ, updateIcom3D, hoverIcomKey } from './icom.js';
import { monFrame } from './kit.js';

// ----------------------------------------------------------------------------------
// Le poste intercom en vue 3D (poste3d/index.js) devant le pupitre du réalisateur (poste3d/icom.js) : sur
// chaque module, TALK (parler vers ce canal) et LISTEN (l'écouter) ont leur zone cliquable, l'afficheur dit
// le type de liaison. Les gestes sont ceux du poste à plat (ICOMACT, ui/st_intercom.js) ; à droite, ce que
// regarde le réalisateur (multiview, programme), le journal de l'intercom et l'état du pupitre ; « Tous les
// réglages » contient le pupitre à plat, le trajet d'un ordre jusqu'au cadreur et le tally.
// ----------------------------------------------------------------------------------
const rect = (x, z, w, d, y) => () => [[x - w / 2, y, z - d / 2], [x + w / 2, y, z - d / 2], [x + w / 2, y, z + d / 2], [x - w / 2, y, z + d / 2]];

function controls() {
  /** @type {any[]} */
  const list = [];
  icomKeys().slice(0, 18).forEach(([l, t, d], m) => {
    const x = modX(m), z = modZ(m), [abbr, what] = ICOM_TYPES[t];
    list.push({ name: `${l} · ${abbr}`, cls: 'icp-lcd3d', text: `Afficheur ${l}`, info: `${what} ${d}`, act: () => explain(`${l} (${abbr}) · ${what} ${d}`, 'icom:i' + l), corners: rect(x, z + OLED.dz, OLED.w, OLED.d, 0.0035) });
    list.push({ name: `TALK ${l}`, cls: 'icp-talk', aria: 'TALK ' + l, text: 'TALK ' + l, ki: m * 2, act: () => ICOMACT.talk(l, t, d), on: () => icomState(l, t).talk, corners: rect(x - KEY.dx, z + KEY.dz, KEY.w, KEY.d, 0.0075),
      info: () => `${icomState(l, t).talk ? 'Micro ouvert' : 'Parler'} vers ${l} (${abbr}). ${what} Le nom d'abord, des phrases courtes, et on referme le TALK dès qu'on a fini.` });
    list.push({ name: `LISTEN ${l}`, cls: 'icp-lis', aria: 'LISTEN ' + l, text: 'LISTEN ' + l, ki: m * 2 + 1, act: () => ICOMACT.listen(l, t), on: () => icomState(l, t).listen, corners: rect(x + KEY.dx, z + KEY.dz, KEY.w, KEY.d, 0.0075),
      info: () => `${icomState(l, t).listen ? 'Tu écoutes' : 'Tu n\'écoutes pas'} ${l}. On coupe les canaux inutiles pour rester concentré sur les ordres.` });
  });
  return list;
}

// vues : œil et point visé dans le repère du pupitre (x : largeur, z : vers l'opérateur)
const VIEWS = [
  { id: 'poste', label: 'Le poste', eye: [0.0, 0.5, 0.44], look: [0.0, 0.04, -0.02], fov: 50 },
  { id: 'touches', label: 'Les touches', eye: [0.0, 0.4, 0.3], look: [0.0, 0.04, 0.01], fov: 50 },
  { id: 'micro', label: 'Micro', eye: [-0.05, 0.4, 0.34], look: [-0.19, 0.2, -0.05], fov: 48 },
];
const ZONES = [
  { id: 'touches', at: [0.0, 0.06, 0.0], view: 'touches', title: 'Les touches du pupitre',
    text: ['Chaque module : un **afficheur** (le canal et son type), **TALK** pour parler, **LISTEN** pour écouter.', 'Les types : **CONF** (conférence, tout le groupe s\'entend), **P2P** (point à point, une seule personne), **IFB** (le retour des commentateurs, baissé quand on leur parle), **4 FILS** (vers la chaîne), **HYBRIDE** (téléphone), **GPO** (un relais : voyant, buzzer).', 'On parle par la touche la plus étroite : un point à point plutôt qu\'une conférence, quand un seul doit entendre.'] },
  { id: 'micro', at: [-0.19, 0.3, -0.03], view: 'micro', title: 'Le micro et le haut-parleur',
    text: ['Le **micro col de cygne** part vers la matrice dès qu\'un TALK est ouvert ; le **haut-parleur** du pupitre (ou le casque) rend les canaux en LISTEN.', 'La voix voyage en numérique (AES3, AES67) jusqu\'à la matrice, dans la baie technique, qui la route vers les destinataires : cartes 4 fils, CCU des caméras, beltpacks, chaîne.'] },
];
const INTRO = { title: 'Le pupitre d\'intercom', text: ['Le pupitre du **réalisateur** : la matrice d\'intercom, dans la baie technique, relie tous les postes du car, les cadreurs, les commentateurs et la chaîne.', 'Survole une touche : son canal et son rôle s\'affichent ; clique **TALK** pour parler, **LISTEN** pour écouter. Glisse pour tourner autour du pupitre, clic droit (ou Maj + glisser) pour le déplacer, molette pour t\'approcher ; double-clic pour revenir à la vue.', 'À droite : ce que regarde le réalisateur, le journal de l\'intercom et l\'état de tes touches. « Tous les réglages » ouvre le pupitre à plat, avec le trajet d\'un ordre jusqu\'au cadreur et le tally.'] };

export const POSTE_INTERCOM = {
  id: 'intercom',
  ready: () => !!ICOMS.grp,
  root: () => ICOMS.grp, deck: () => ICOMS.top,
  views: VIEWS, zones: ZONES, intro: INTRO, detailView: 'touches',
  controls, controlsSig: () => icomKeys().map((e) => e[0]).join(','),
  hover(c) { hoverIcomKey(c && c.ki != null ? c.ki : -1); },
  /** à droite : ce que regarde le réalisateur, le journal de l'intercom, l'état du pupitre */
  monitors(host) {
    const log = el('ol', { class: 'p3d-icomlog', 'aria-live': 'polite' });
    const state = el('div', { class: 'p3d-icomstate' });
    host.append(el('div', { class: 'p3d-monrow' }, monFrame('mv', 'Multiview'), monFrame('PGM', 'Programme (PGM)', 'pgm')),
      el('div', { class: 'p3d-mon' }, el('div', { class: 'lab' }, 'Sur l\'intercom'), log),
      el('div', { class: 'p3d-mon' }, el('div', { class: 'lab' }, 'Ton pupitre'), state));
    let sig = '';
    return {
      update() {
        const keys = icomKeys();
        const talk = keys.filter((e) => icomState(e[0], e[1]).talk).map((e) => e[0]);
        const lis = keys.filter((e) => icomState(e[0], e[1]).listen).map((e) => e[0]);
        const s = ICOM.log.map((e) => e.t + e.msg).join('|') + '#' + talk.join() + '#' + lis.join();
        if (s === sig) return; sig = s;
        log.replaceChildren(...(ICOM.log.length ? ICOM.log.slice(-6).reverse().map((e) => el('li', {}, el('span', { class: 'mono' }, mmss(e.t)), el('b', {}, e.who), e.msg)) : [el('li', { class: 'note' }, 'Rien pour l\'instant : les ordres du réalisateur et tes ouvertures de micro s\'inscrivent ici.')]));
        state.replaceChildren(el('p', {}, el('b', {}, 'Micro ouvert vers : '), talk.length ? talk.join(', ') : 'aucun (TALK fermés)'), el('p', {}, el('b', {}, 'Tu écoutes : '), lis.length ? lis.join(', ') : 'rien'));
      },
    };
  },
  drawer: { label: 'Tous les réglages', note: 'Le pupitre à plat, le trajet d\'un ordre, le tally', build: (host, arg, ctx) => buildIntercom(host, arg, ctx) },
  legend: () => 'TALK : parler vers le canal · LISTEN : l\'écouter · cliquer l\'afficheur : le rôle du canal.',
  update(dt) { updateIcom3D(dt); },
};

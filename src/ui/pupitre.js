// @ts-check
import { S, emit, on } from '../state.js';
import { el } from '../util.js';
import { $, modal } from './common.js';
import { T } from '../truck.js';
import { STATION_INFO } from '../content/stations.js';
import { AU, startAudio, applyFaders } from '../audio.js';
import { avatarPositions } from '../multi/avatars.js';
import { DESTS, teleport, goToStation, goToMate } from '../app/teleport.js';
import { PL, updToolbar } from '../app/player.js';
import { whereAmI } from '../app/hud.js';
import { planFor } from './truckmap.js';
import { openPlan } from './plan.js';
import { openSynoptics } from './synoptics.js';
import { openGuide } from './guide.js';
import { openSessionPanel } from './session_ui.js';
import { openEquipmentIndex } from '../equipment/viewer.js';
import { openDiag } from './diag_ui.js';
import { icon } from './icons.js';

// ----------------------------------------------------------------------------------
// Le pupitre (touche Tab, ou T) : un panneau de commande comme celui d'une grille. En haut,
// le plan du car et la position du joueur ; dessous, une rangée de touches par zone du car (dans
// l'ordre du plan), les endroits hors du car et les équipiers ; en bas, les outils, chacun avec
// sa touche du clavier. Une touche allumée en ambre : là où l'on est, ou l'outil en service.
// ----------------------------------------------------------------------------------
const ZONE_NAME = { son: 'Cabine son', prod: 'Production', vision: 'Vision et ralentis', tech: 'Technique' };
// noms courts des endroits hors du car (ceux de DESTS restent pour les autres menus)
const OUT_NAME = ['Devant le car', null, null, null, null, 'Bord terrain', 'Sortie du tunnel', 'Tunnel et vestiaires', 'Passerelle caméras', 'Derrière le but', 'Kop Marek', 'Angle et pylône', 'Toit (antennes HF)', 'Vue aérienne'];
const OUT_ICON = ['car', null, null, null, null, 'terrain', 'tunnel', 'vestiaires', 'passerelle', 'but', 'kop', 'pylone', 'toit', 'aerien'];
// icône de chaque poste du car (ui/icons.js), à côté de son nom
const STATION_ICON = { son: 'mixage', scripte: 'scripte', realisateur: 'realisateur', melangeur: 'melangeur', habillage: 'habillage', producteur: 'producteur', chefdecar: 'chef', vision1: 'vision', vision2: 'vision', evsA: 'evs', evsB: 'ipdirector', ccu: 'ccu', grille: 'grille', xvsrack: 'processeur', reseau: 'reseau', evsrack: 'serveur', transmission: 'transmission', synchro: 'synchro', intercom: 'intercom', mvproc: 'brassage', audiorack: 'audio', hf: 'hf', mesure: 'diagnostic' };

// touche à afficheur : l'icône gravée sur la touche, la légende dans une petite fenêtre, une LED d'état
function dkey(label, onclick, opts = {}) {
  return el('button', { type: 'button', class: 'dkey' + (opts.on ? ' on' : ''), title: opts.title || label, 'aria-pressed': opts.toggle ? String(!!opts.on) : null, onclick },
    opts.ico ? icon(opts.ico, 'dk-ico') : null, el('span', { class: 'dwin' }, label), opts.kbd ? el('kbd', {}, opts.kbd) : null);
}
const close = () => modal.close();
const minimonOn = () => { const m = $('#minimon'); return !!m && !m.hidden; };
// outils : nom, touche, icône, action, état (pour la LED)
/** @returns {Array<[string, string, string, () => void, (() => boolean)?]>} */
const TOOLS = () => [
  ['Plan caméras', 'P', 'plan', () => { close(); openPlan(); }],
  ['Synoptiques', 'Y', 'synoptiques', () => { close(); openSynoptics(); }],
  ['Matériel', 'K', 'materiel', () => { close(); openEquipmentIndex(); }],
  ['Guide', 'G', 'guide', () => { close(); openGuide('missions'); }],
  ['Chef de car', 'J', 'chef', () => { close(); emit('chef'); }],
  ['Vol libre', 'V', 'vol', () => { PL.fly = !PL.fly; updToolbar(); }, () => PL.fly],
  ['Retour PGM', 'M', 'retour', () => { const m = $('#minimon'); if (m) m.hidden = !m.hidden; }, minimonOn],
  ['Son', '', AU.muted ? 'muet' : 'son', () => { startAudio(); AU.muted = !AU.muted; applyFaders(); emit('soundToggle'); }, () => !AU.muted],
  ['Équipe', '', 'equipe', () => { close(); openSessionPanel(); }],
  ['Réglages', '', 'reglages', () => { close(); openGuide('reglages'); }],
  ['Diagnostic technique', '', 'diagnostic', () => { close(); openDiag(); }],
];

export function openPupitre() {
  const here = S.mode === 'station' ? S.station : null;
  const body = el('div', { class: 'pupitre' });
  // le car : plan, puis une rangée de touches par zone, dans l'ordre du plan (cabine son à gauche)
  const banks = el('div', { class: 'pp-banks' });
  for (const z of T.layout.zones) {
    const list = T.stations.filter((s) => s.zone === z.id);
    banks.append(el('section', { class: 'pp-bank', style: `--zc:${z.color};--n:${Math.max(1, list.length)}` },
      el('h3', {}, ZONE_NAME[z.id] || z.name),
      el('div', { class: 'pp-keys' }, ...list.map((s) => dkey(s.short || s.label, () => { close(); goToStation(s); }, { on: here === s.station, title: `Aller au poste ${s.label}`, ico: STATION_ICON[s.id] })))));
  }
  // rangées dans l'ordre du plan, plus larges quand la zone a beaucoup de postes
  banks.style.setProperty('--cols', T.layout.zones.map((z) => `minmax(0, ${Math.sqrt(Math.max(1, T.stations.filter((s) => s.zone === z.id).length)).toFixed(2)}fr)`).join(' '));
  const [zone, hint] = whereAmI();
  const top = el('div', { class: 'pp-top' },
    el('div', { class: 'pp-plan glass' }, planFor(48)),
    el('div', { class: 'pp-here glass' }, el('span', {}, 'Vous êtes ici'), el('b', {}, zone), el('span', {}, hint),
      el('span', {}, 'Choisissez une touche ou un point du plan : vous y allez et le poste s\'ouvre.')));
  body.append(el('section', { class: 'pp-car', 'aria-label': 'Aller à un poste du car' }, el('h2', {}, 'Le car régie'), top, banks));
  // dehors : le stade et le compound
  const outs = DESTS.map((d, i) => (d[4] ? null : dkey(OUT_NAME[i] || d[0], () => { teleport(i); close(); }, { title: d[0], ico: OUT_ICON[i] }))).filter(Boolean);
  const mates = avatarPositions();
  body.append(el('section', { class: 'pp-out', 'aria-label': 'Aller ailleurs' },
    el('h2', {}, 'Le stade et le compound'), el('div', { class: 'pp-keys' }, ...outs),
    mates.length ? el('h2', {}, 'Rejoindre un équipier') : null,
    mates.length ? el('div', { class: 'pp-keys' }, ...mates.map((a) => {
      const k = dkey(`${a.name} : ${a.cam ? 'CAM ' + a.cam : a.station ? (STATION_INFO[a.station] ? STATION_INFO[a.station].title : a.station) : a.truck ? 'dans le car' : 'dehors'}`, () => { goToMate(a); close(); }, { ico: 'equipier' });
      k.style.setProperty('--mate', a.color); k.classList.add('mate');
      return k;
    })) : null));
  // outils
  const tools = el('div', { class: 'pp-tools' });
  const drawTools = () => {
    tools.replaceChildren(...TOOLS().map(([name, key, ico, fn, state]) => {
      const b = dkey(name, () => { fn(); if (state) drawTools(); }, { kbd: key || null, ico, on: state ? state() : false, toggle: !!state });
      b.classList.add('tool');
      return b;
    }));
  };
  drawTools();
  body.append(el('section', { class: 'pp-toolbar', 'aria-label': 'Outils' }, el('h2', {}, 'Outils'), tools));
  // dehors et outils côte à côte (assez de hauteur pour un écran d'ordinateur portable)
  const out = body.querySelector('.pp-out'), tb = body.querySelector('.pp-toolbar');
  body.append(el('div', { class: 'pp-row' }, out, tb));
  modal.open('Pupitre', body, { width: 1120 });
  // première touche du poste où l'on est (ou première touche) prête au clavier
  const first = /** @type {HTMLElement | null} */ (body.querySelector('.dkey.on') || body.querySelector('.dkey'));
  if (first && !matchMedia('(pointer: coarse)').matches) first.focus({ preventScroll: true });
}
on('pupitre', () => openPupitre());

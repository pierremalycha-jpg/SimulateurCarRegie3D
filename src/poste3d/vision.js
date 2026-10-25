// @ts-check
import { S, camById } from '../state.js';
import { el } from '../util.js';
import { SCOPE } from '../pipeline.js';
import { RCPACT, RCP_PAGES, rcpOk, lcdPage, buildVision } from '../ui/st_vision.js';
import { RCPS, RCP_KEYS, N_RCP, RCPW, RCPD, KNOB_Z, JOY, LCD, unitX, camOfUnit, irisPos, updateRcp3D, hoverRcpKey } from './rcp.js';

// ----------------------------------------------------------------------------------
// Le poste « Ingénieur vision » en vue 3D (poste3d/index.js) devant la rangée de RCP (poste3d/rcp.js) :
// un clic sur un RCP lui donne la main (il prend la caméra : moniteur de référence, PRISM) ; sur le RCP
// choisi, chaque commande a sa zone cliquable : touches, molettes WHITE et BLACK, joystick (glisser vers
// le haut pour ouvrir l'iris) et sa bague (master black), écran tactile qui ouvre ses pages en 2D.
// Les gestes sont ceux de la vue 2D (RCPACT, ui/st_vision.js) ; « Tous les réglages » contient le poste
// à plat : RCP complet, PRISM interactif, tableau de matching.
// ----------------------------------------------------------------------------------
const V = { seat: 0 };
const cam = () => (S.selCam != null ? camById(S.selCam) : null);
const unitOf = (id) => (id >= 1 && id <= N_RCP ? id - 1 : -1);
const selUnit = () => (cam() ? unitOf(cam().id) : -1);
/** garde : le RCP a-t-il la main sur la caméra ? (réseau de contrôle, PANEL ACTIVE) */
const guard = (fn) => () => { const c = cam(); if (rcpOk(c)) fn(c); };
const seatX = () => (V.seat === 1 ? 0.73 : -0.97);

const KEY_TXT = {
  DETAIL: 'Touche assignable : met le détail (accentuation des contours) en ou hors service.',
  KNEE: 'Touche assignable : met le knee (compression des hautes lumières) en ou hors service. Sans knee, les blancs écrêtent au white clip.',
  GAMMA: 'Touche assignable : met la courbe de gamma en ou hors service. Sans gamma, l\'image est linéaire, sombre et contrastée.',
  MATRIX: 'Touche assignable : met la matrice de couleur (saturation) en ou hors service.',
  'BLK GAM': 'Touche assignable : black gamma à +30 (ombres débouchées) ou remis à 0.',
  'SKIN DTL': 'Touche assignable : détail de peau, qui adoucit les visages (non simulé ici).',
  'ND ▲': 'Filtre ND un cran plus dense : moins de lumière, sans changer les couleurs.',
  'ND ▼': 'Filtre ND un cran plus clair : plus de lumière.',
  ZEBRA: 'Zébra dans le viseur du cadreur au-dessus d\'un niveau (non simulé ici).',
  AWB: 'Balance des blancs automatique : la caméra mesure un blanc de référence et calcule ses gains rouge et bleu.',
  ABB: 'Balance des noirs automatique : l\'iris se ferme, la caméra égalise ses trois noirs.',
  FLARE: 'Les molettes BLACK règlent la compensation de flare (le voile de l\'optique) au lieu des noirs.',
  CALL: 'Appel du cadreur : son tally clignote, il répond à l\'intercom.',
  BARS: 'Barres de couleur de la caméra, pour le line-up (liaison, nom au multiview, niveaux).',
  'CAM PW': 'Alimentation de la tête par la fibre hybride. On coupe toujours avant de débrancher un câble caméra.',
  'PANEL ACTIVE': 'Le RCP a la main sur la caméra. Éteint, les réglages sont verrouillés.',
  PREVIEW: 'Envoie la caméra sur le moniteur de référence (sortie AUX de la grille).',
  'AUTO IRIS': 'Iris automatique : pratique en dépannage, mais il « pompe » quand la scène change.',
  CLOSE: 'Ferme l\'iris (image noire) : balance des noirs, protection des capteurs.',
};
// les gestes qui passent sans que le RCP ait la main (comme en 2D)
const FREE = new Set(['flare', 'call', 'preview', 'campw', 'active']);
function keyAct(k) {
  const run = (c) => {
    switch (k.kind) {
      case 'assign': RCPACT.assign(c, k.l); break;
      case 'awb': RCPACT.awb(c); break; case 'abb': RCPACT.abb(c); break; case 'flare': RCPACT.flare(); break;
      case 'call': RCPACT.call(c); break; case 'bars': RCPACT.bars(c); break; case 'campw': RCPACT.campw(c); break;
      case 'active': RCPACT.active(c); break; case 'preview': RCPACT.preview(c); break; case 'auto': RCPACT.autoIris(c); break;
      case 'close': RCPACT.close(c); break;
      default:
    }
    updateRcp3D(0, true);
  };
  return FREE.has(k.kind) ? () => { const c = cam(); if (c) run(c); } : guard(run);
}
const rect = (x, z, w, d, y) => () => [[x - w / 2, y, z - d / 2], [x + w / 2, y, z - d / 2], [x + w / 2, y, z + d / 2], [x - w / 2, y, z + d / 2]];

function controls() {
  /** @type {any[]} */
  const list = [];
  const su = selUnit();
  // les RCP qui n'ont pas la main : un clic dessus la leur donne
  for (let i = 0; i < N_RCP; i++) {
    const c = camOfUnit(i); if (!c || i === su) continue;
    list.push({ name: `RCP de la CAM ${c.id}`, cls: 'p3d-rcpunit', text: `Prendre la CAM ${c.id} au RCP`, info: `${c.T.label}, ${c.L.name}. Un clic donne la main à ce RCP : la caméra passe sur le moniteur de référence et le PRISM.`, act: () => RCPACT.select(c.id), corners: rect(unitX(i), 0, RCPW, RCPD, 0.004) });
  }
  if (su < 0) return list;
  const x = unitX(su);
  // écran tactile : ses pages en 2D sur la fiche
  list.push({ name: 'Écran tactile', cls: 'p3d-lcd', text: 'Écran tactile du RCP', panel: 'rcp', info: 'L\'écran tactile du RCP : touchez-le pour ses pages (PAINT, GAMMA / KNEE, GAIN / ND / SHUTTER, SCÈNES) et leurs molettes.', corners: rect(x, LCD.z, LCD.w, LCD.d, 0.005) });
  // bague du joystick (avant le manche : là où ils se recouvrent, le manche l'emporte)
  list.push({ name: 'Bague du joystick : MASTER BLACK', cls: 'rjoy-ring', knob: true, step: 0.01, value: () => (cam() ? (cam().paint.mblack + 99) / 198 : 0.5), set: (n) => { const c = cam(); if (rcpOk(c)) RCPACT.mblack(c, Math.round(n * 198 - 99)); }, reset: guard((c) => RCPACT.mblack(c, 0)),
    info: () => `Master black ${cam() ? cam().paint.mblack : 0} : le niveau du noir des trois couleurs. Glisser vers le haut ou le bas, double-clic = 0. Repère : noirs posés entre 0 et 2 % au waveform.`, corners: rect(x, JOY.zc, JOY.r * 2.2, JOY.r * 2.2, 0.012) });
  list.push({ name: 'Joystick : IRIS', cls: 'rjoy', inner: 'rjoy-handle', slider: true, up: true, step: 0.01, minDrag: 260, value: () => (cam() ? irisPos(cam()) : 0), set: (pos) => { const c = cam(); if (rcpOk(c)) RCPACT.iris(c, pos); },
    info: () => { const c = cam(); return c ? `Iris F${c.paint.iris.toFixed(1).replace('.', ',')} : pousser le joystick (vers le haut) ouvre l'iris, le tirer le ferme. Un diaphragme double ou divise par deux la lumière. Flèches haut et bas pour l'affiner.` : ''; },
    along: [[x, 0.06, JOY.z0], [x, 0.06, JOY.z1]], corners: rect(x, (JOY.z0 + JOY.z1) / 2, 0.03, JOY.z0 - JOY.z1 + 0.03, 0.06) });
  // molettes WHITE et BLACK (ou FLARE)
  for (let j = 0; j < 6; j++) {
    const i = j % 3, white = j < 3, nm = (white ? 'WHITE ' : S.rcpFlare ? 'FLARE ' : 'BLACK ') + 'RGB'[i];
    const get = () => { const c = cam(); return c ? (white ? c.paint[['wbR', 'wbG', 'wbB'][i]] : RCPACT.blackGet(c, i)) : 0; };
    list.push({ name: nm, aria: nm, knob: true, step: 0.01, value: () => (get() + 99) / 198, set: (n) => { const c = cam(); if (!rcpOk(c)) return; const v = Math.round(n * 198 - 99); if (white) RCPACT.white(c, i, v); else RCPACT.black(c, i, v); }, reset: guard((c) => (white ? RCPACT.white(c, i, 0) : RCPACT.black(c, i, 0))),
      info: () => `${nm} : ${get() > 0 ? '+' : ''}${get()}. ${white ? 'Gain de la couleur dans les blancs : on règle surtout le rouge et le bleu, le vert sert de référence.' : S.rcpFlare ? 'Compensation du voile de l\'optique dans les noirs de cette couleur.' : 'Noir de cette couleur : les trois noirs doivent être alignés en parade RVB.'} Glisser, molette de la souris, double-clic = 0.`,
      corners: rect(x + (i - 1) * 0.03, white ? KNOB_Z.white : KNOB_Z.black, 0.02, 0.02, 0.014) });
  }
  // touches
  RCP_KEYS.forEach((k, j) => {
    list.push({ name: k.l, cls: k.kind === 'assign' ? 'rcp-key' : 'rcp-btn', text: k.l, i: su * RCP_KEYS.length + j, info: KEY_TXT[k.l] || '', act: keyAct(k), corners: rect(x + k.x, k.z, 0.026, 0.012, 0.007) });
  });
  return list;
}

function rcpPanel() {
  let page = 'paint';
  const tabs = el('div', { class: 'rcp-tabs' }), lcd = el('div', { class: 'rcp-lcd' }), encs = el('div', { class: 'rcp-encs' });
  const touch = (stage, fn) => (...a) => { const c = cam(); if (rcpOk(c)) fn(c, ...a); };
  const draw = () => {
    const c = cam(); tabs.innerHTML = ''; lcd.innerHTML = ''; encs.innerHTML = '';
    if (!c) { lcd.append(el('p', { class: 'note' }, 'Aucune caméra au RCP.')); return; }
    for (const k in RCP_PAGES) tabs.appendChild(el('button', { class: 'rcp-tab' + (k === page ? ' on' : ''), onclick: () => { page = k; draw(); } }, RCP_PAGES[k].l));
    lcd.append(el('div', { class: 'rcp-lcd-top' }, el('b', {}, `CAM ${c.id}`), el('span', {}, c.T.short)));
    lcdPage(c, page, lcd, encs, touch, draw, draw);
  };
  draw();
  let last = S.selCam;
  return { box: el('div', { class: 'p3d-form rcp p3d-rcp-ecran' }, tabs, lcd, encs), update() { if (S.selCam !== last) { last = S.selCam; draw(); } } };
}

const VIEWS = [
  { id: 'poste', label: 'Le poste', eye: () => [seatX(), 0.62, 0.62], look: () => [seatX() + 0.15, 0.18, -0.5], fov: 62 },
  { id: 'rcp', label: 'Le RCP', eye: () => [unitX(Math.max(0, selUnit())), 0.52, 0.34], look: () => [unitX(Math.max(0, selUnit())), 0.02, -0.01], fov: 42 },
  { id: 'rangee', label: 'La rangée', eye: () => [seatX(), 0.85, 0.95], look: () => [seatX(), 0.0, -0.1], fov: 58 },
  { id: 'ecrans', label: 'Écrans', eye: () => [seatX() * 0.4, 0.6, 0.95], look: () => [0.3, 0.78, -0.9], fov: 66 },
];
const ZONES = [
  { id: 'rcp', at: () => [unitX(Math.max(0, selUnit())), 0.09, -0.16], view: 'rcp', title: () => (cam() ? `Le RCP de la CAM ${cam().id}` : 'Le RCP'),
    text: () => ['Le pupitre de commande de la caméra (RCP) règle à distance son exposition et sa colorimétrie, par la CCU.', '**Joystick** : le pousser ouvre l\'iris, tourner sa bague règle le **master black** (le niveau du noir). **WHITE** et **BLACK** : les gains et les noirs rouge, vert, bleu ; **AWB / ABB** les font en automatique.', 'Touchez l\'**écran tactile** pour ses pages (détail, gamma, knee, gain, ND, shutter, scènes). **PANEL ACTIVE** éteint verrouille la caméra.'] },
  { id: 'ecrans', at: [0.88, 0.75, -0.9], view: 'ecrans', title: 'Moniteur de référence et oscilloscope',
    text: ['Le **moniteur Grade 1** montre la caméra au RCP (sortie AUX de la grille) ; au-dessus, l\'**oscilloscope** (waveform) mesure ses niveaux : noirs vers 0 à 2 %, blancs sous 103 %.', 'À gauche, le **multiview de la vision** : toutes les caméras, pour les accorder entre elles (matching).', 'Le PRISM interactif (waveform, vecteurscope, gamut, HDR) est dans « Tous les réglages ».'] },
  { id: 'rangee', at: () => [seatX(), 0.08, -0.2], view: 'rangee', title: 'La rangée de RCP',
    text: ['Un RCP par caméra : CAM 1 à 6 devant vous en vision 1, CAM 7 à 16 en vision 2 ; au milieu, le **MSU** (pupitre maître) qui peut régler toutes les caméras.', 'Le voyant rouge **TALLY** s\'allume quand la caméra est à l\'antenne ; l\'écran affiche ON AIR ou PVW. Un clic sur un RCP lui donne la main.'] },
];
const INTRO = { title: 'Le poste de l\'ingénieur vision', text: ['Une rangée de **RCP** (un par caméra) pilote les caméras par leurs CCU. Devant vous, le multiview de la vision, le moniteur de référence et l\'oscilloscope.', 'Cliquez un RCP pour lui donner la main, puis survolez ses commandes : leur nom et leur rôle s\'affichent. Glisser pour regarder autour, molette pour zoomer.', '« Tous les réglages » ouvre le poste à plat : le RCP complet, le PRISM, le tableau de matching.'] };

export const POSTE_VISION = {
  id: 'vision',
  ready: () => !!RCPS.grp,
  root: () => RCPS.grp, deck: () => RCPS.top,
  views: VIEWS, zones: ZONES, intro: INTRO, detailView: 'rcp',
  /** à l'ouverture : la caméra demandée (parcours du chef) ou celle du siège (vision 1 : la première, vision 2 : la première après la 6) */
  enter(arg) {
    V.seat = arg === 1 || (arg && typeof arg === 'object' && camById(arg.cam) && arg.cam > 6) ? 1 : 0;
    let id = S.cams.length ? (V.seat === 1 ? (S.cams.find((c) => c.id > 6) || S.cams[0]).id : S.cams[0].id) : null;
    if (arg && typeof arg === 'object' && camById(arg.cam)) id = arg.cam;
    if (id != null) RCPACT.select(id);
  },
  leave() { SCOPE.active = false; },
  controls, controlsSig: () => [S.selCam, S.rcpFlare ? 1 : 0, ...S.cams.map((c) => c.id)].join(','),
  hover(c) { hoverRcpKey(c && c.i != null ? c.i : -1); },
  panels: { rcp: rcpPanel },
  drawer: { label: 'Tous les réglages', note: 'Le poste à plat : RCP complet, PRISM, matching des caméras', build: (host, arg, ctx) => buildVision(host, arg, ctx) },
  legend: () => 'Joystick : glisser vers le haut = ouvrir l\'iris · bague : glisser = master black · molettes : glisser ou molette de la souris, double-clic = 0.',
  update(dt) { updateRcp3D(dt); },
};

// @ts-check
import { el } from '../util.js';
import { CAMERA_FIBRE } from './camera_fibre.js';
import { registerChapter } from './index.js';
import { figure, sv, slider, choice, readout, fmtNum } from './kit.js';

// ----------------------------------------------------------------------------------
// Chapitre « La caméra » : la chaîne caméra de bout en bout (tête, fibre hybride, CCU, RCP et MSU, qui règle
// quoi), puis le montage d'une caméra de stade (ordre des gestes, équilibrage, fibre, sécurités). Le module à
// part (src/camlab) montre la caméra de plateau en 3D ; ces leçons disent la même chose que lui et que le car :
//   · portées : fibre hybride SMPTE ≈ 2 km (data/cameras.js LINKS.smpte, guide « camsys »), 600 m pour la
//     HXC-FB80 du module 3D (camlab/notions : alimentation), fibre monomode seule ≈ 10 km avec alimentation locale ;
//   · niveau optique : −4 dBm à l'émission, 0,4 dB/km, 1,5 dB de connexions, comme la baie CCU (ui/stations.js),
//     typique −5 à −15 dBm, décrochage vers −20 dBm, « pas de signal » sous −30 dBm (content/stations.js) ;
//   · montage : les pièces, masses et gestes de l'atelier (atelier.js, guide « montage »).
// ----------------------------------------------------------------------------------
const C = { grey: '#8a949c', amber: '#ffd38a', red: '#ff8a80', green: '#7fd1a0', cyan: '#7fd3f3', copper: '#e0915a', box: '#1a2026', dim: '#3a434c', line: '#59646f' };
const txt = (x, y, s, cls = 'co-s', anchor = 'middle') => sv('text', { x, y, textAnchor: anchor, class: cls }, s);
const rect = (x, y, w, h, fill, stroke = C.line, extra = {}) => sv('rect', { x, y, width: w, height: h, rx: 3, fill, stroke, strokeWidth: 1.2, ...extra });
const at = (e, k, v) => e.setAttribute(k, String(v));
const G = 9.81;
/** décibels avec le vrai signe moins */
const fmtDbm = (v) => fmtNum(v, 1).replace('-', '−');

// ================= leçon 1 : la chaîne caméra =================
// ---------------- le schéma : qui règle quoi ----------------
function figQui() {
  const f = figure(520, 212, 'Qui règle quoi : à gauche, ce que le cadreur règle sur la caméra (cadre, zoom, point, doubleur, viseur, appel) ; à droite, ce que l\'ingénieur vision règle au RCP (iris, noir, gain, filtres, balances, menus) ; entre les deux, la fibre qui porte l\'image vers le car et les réglages vers la tête');
  f.append(txt(120, 16, 'Le cadreur, sur la caméra', 'co-t'), txt(392, 16, 'L\'ingénieur vision, au RCP', 'co-t'));
  // la caméra, objectif vers la gauche (le terrain)
  f.append(rect(22, 46, 96, 32, '#17181a'), sv('rect', { x: 18, y: 50, width: 5, height: 24, fill: '#0b1a2a' }), txt(70, 66, 'objectif box', 'co-s'));
  f.append(rect(118, 48, 50, 28, '#333c45'), txt(143, 66, 'tête', 'co-s'), rect(124, 28, 40, 18, '#2c3035'), txt(144, 41, 'viseur', 'co-s'));
  f.append(sv('line', { x1: 160, y1: 80, x2: 206, y2: 96, stroke: C.grey, strokeWidth: 4, 'stroke-linecap': 'round' }), txt(214, 100, 'manche', 'co-s', 'start'));
  // la fibre
  f.append(sv('line', { x1: 168, y1: 62, x2: 268, y2: 62, stroke: C.amber, strokeWidth: 3 }), txt(218, 55, 'image →', 'co-m'), txt(218, 76, '← réglages', 'co-m'));
  // le RCP
  f.append(rect(270, 30, 132, 54, '#262b31'));
  for (let i = 0; i < 6; i++) f.append(sv('rect', { x: 280 + i * 13, y: 38, width: 10, height: 7, rx: 1, fill: i === 0 ? '#c8102e' : '#4a545e' }));
  for (let i = 0; i < 3; i++) f.append(sv('circle', { cx: 286 + i * 18, cy: 66, r: 6, fill: '#3a434c', stroke: '#59646f' }));
  f.append(sv('circle', { cx: 376, cy: 58, r: 15, fill: '#2c3035', stroke: '#59646f' }), sv('circle', { cx: 376, cy: 58, r: 6, fill: '#8a949c' }), txt(410, 94, 'joystick : iris, noir', 'co-s', 'end'));
  const left = ['panoramique et inclinaison (manches)', 'zoom au pouce, point à la molette', 'doubleur ×2 de l\'objectif', 'viseur : peaking, zebra, retour RET', 'CALL et casque d\'intercom'];
  const right = ['iris (joystick) et master black (bague)', 'gain, shutter, filtres ND et CC', 'balances : AWB, ABB, WHITE R et B', 'détail, gamma, knee, matrice (menus)', 'CAM PW, BARS, PANEL ACTIVE'];
  left.forEach((s, i) => f.append(txt(14, 122 + i * 15, '• ' + s, 'co-s', 'start')));
  right.forEach((s, i) => f.append(txt(270, 122 + i * 15, '• ' + s, 'co-s', 'start')));
  f.append(txt(260, 206, 'Le MSU du chef vision atteint toutes les caméras ; le menu PAINT de la caméra suit le RCP.', 'co-s'));
  return f;
}

// ---------------- la manipulation : la chaîne cliquable et la longueur de câble ----------------
// Énergie : la CCU envoie une tension élevée sur les deux conducteurs d'énergie du câble hybride, la tête prend une
// puissance fixe. Puissance reçue P = (V0 − R·I)·I : elle plafonne à V0² / 4R, d'où une longueur maximale
// L = V0² / (4·P·r). Modèle d'ordre de grandeur : V0 = 240 V, r = 66 Ω/km aller-retour (deux conducteurs AWG 20,
// ≈ 33 Ω/km chacun), tête + objectif box + viseur 7" ≈ 110 W : on retrouve les ≈ 2 km du simulateur et du guide.
// Lumière : les valeurs de la baie CCU (−4 dBm, 0,4 dB/km, trois connexions à 0,5 dB).
const V0 = 240, R_KM = 66, PTX = -4, ATT_KM = 0.4, CONN_DB = 0.5, N_CONN = 3, RX_MIN = -20, SM_MAX = 10;
const LOADS = { box: 110, port: 60 };
const DIRT = { propre: 0, poussiere: 3, sale: 10 };
/** longueur du câble (m) lue sur un curseur logarithmique 0 à 100 : 50 m à 12 km */
const lenOf = (v) => { const L = 50 * Math.pow(240, v / 100); return L < 1000 ? Math.round(L / 10) * 10 : Math.round(L / 50) * 50; };
const fmtLen = (L) => (L < 1000 ? `${fmtNum(L)} m` : `${fmtNum(L / 1000, L < 10000 ? 2 : 1)} km`);
/** énergie dans le câble hybride : tension à la tête, courant, pertes, longueur maximale */
export function powerAt(L, P) {
  const R = R_KM * L / 1000, D = V0 * V0 - 4 * P * R;
  const Lmax = V0 * V0 / (4 * P * R_KM) * 1000;
  if (D < 0) return { ok: false, R, Lmax, V: 0, I: 0, loss: 0 };
  const V = (V0 + Math.sqrt(D)) / 2, I = P / V;
  return { ok: true, R, Lmax, V, I, loss: I * I * R };
}
/** niveau optique reçu à la CCU (dBm) */
export const opticalAt = (L, dirt = 0) => PTX - ATT_KM * L / 1000 - N_CONN * CONN_DB - dirt;

// ce qui circule : vers la CCU (up) ou vers la tête (down), voies du câble (f1 fibre montante, f2 fibre descendante,
// cu cuivre), appareil du car concerné
const SIGS = {
  video: { label: 'Image', up: true, lanes: ['f1'], dev: 'grille', cable: 'fibre 1, vers la CCU, dans un format de transmission propre au constructeur', car: 'la CCU la sort en SDI vers la grille (3G-SDI en 1080p50, 12G-SDI en UHD, avec une copie HD SDR)', who: 'l\'ingénieur vision la règle, le réalisateur la choisit au mélangeur' },
  audio: { label: 'Son des micros', up: true, lanes: ['f1'], dev: 'grille', cable: 'fibre 1, vers la CCU', car: 'la CCU embarque les ambiances de la caméra dans le SDI de sortie', who: 'l\'ingénieur du son, qui les désembarque' },
  icom: { label: 'Intercom', up: true, down: true, lanes: ['f1', 'f2'], dev: 'icom', cable: 'les deux fibres : la voix du cadreur monte, les ordres descendent', car: 'la CCU relie le casque du cadreur à la matrice d\'intercom (canaux PROD et ENG)', who: 'le cadreur, la réalisation (PROD), la technique et la vision (ENG)' },
  tally: { label: 'Tally', down: true, lanes: ['f2'], dev: 'mix', cable: 'fibre 2, vers la tête', car: 'le système de tally du mélangeur dit quelle caméra est à l\'antenne (rouge) ou prête (vert)', who: 'le cadreur, dans son viseur ; les lampes de la caméra le montrent aux autres' },
  ret: { label: 'Retours vidéo', down: true, lanes: ['f2'], dev: 'grille', cable: 'fibre 2, vers la tête', car: 'la grille envoie le programme ou une autre source sur les entrées de retour de la CCU', who: 'le cadreur, qui bascule son viseur sur le retour (RET)' },
  cmd: { label: 'Commandes', up: true, down: true, lanes: ['f2', 'f1'], dev: 'rcp', cable: 'fibre 2 : les réglages descendent ; fibre 1 : l\'état de la tête et le CALL remontent', car: 'le RCP et le MSU parlent à la CCU par le réseau caméras ; la CCU relaie vers la tête, où se fait l\'essentiel du traitement de l\'image', who: 'l\'ingénieur vision (RCP), le chef vision (MSU)' },
  ref: { label: 'Référence', down: true, lanes: ['f2'], dev: 'spg', cable: 'fibre 2 : la CCU cale la tête sur la référence du car', car: 'le générateur de synchro envoie black burst ou tri-level à la CCU (REF IN), par un distributeur', who: 'personne ne la règle en direct : on vérifie REF LOCK au line-up' },
  power: { label: 'Énergie', down: true, lanes: ['cu'], dev: null, cable: 'les deux conducteurs de cuivre : une tension élevée, un courant faible', car: 'la CCU alimente la tête quand la vision appuie sur CAM PW', who: 'personne, mais c\'est elle qui fixe la longueur du câble' },
};
const BLOCKS = {
  tete: ['Tête de caméra', 'Prisme et capteurs, traitement de l\'image, objectif, viseur et casque du cadreur. Reliée à sa CCU, elle reçoit tout par un seul câble : ni batterie, ni câble vidéo, ni câble d\'intercom.'],
  fibre: ['Câble hybride SMPTE', 'Câble ST 311, connecteur ST 304 : deux fibres monomodes, une par sens, deux conducteurs d\'énergie et deux conducteurs basse tension. Il passe par la prise de la passerelle, le pré-câblage du stade et le pied de car.'],
  ccu: ['CCU', 'La voie caméra, dans le car : elle alimente la tête, reçoit son image et la sort en SDI calée sur la référence, renvoie retours, ordres et tally, et relaie les réglages du RCP. Sa face avant affiche le niveau optique reçu.'],
  grille: ['Grille', 'Elle reçoit la sortie SDI de la CCU (l\'image et son son embarqué) et renvoie à la CCU les sources des retours vidéo.'],
  spg: ['Générateur de synchro', 'La référence de tout le car (black burst, tri-level), distribuée à chaque CCU : toutes les caméras sortent leurs images au même instant.'],
  icom: ['Matrice d\'intercom', 'Le casque du cadreur y est relié à travers la CCU et la fibre : il entend la réalisation et lui répond.'],
  mix: ['Mélangeur', 'Son système de tally allume le rouge de la caméra à l\'antenne et le vert de la caméra prête.'],
  rcp: ['RCP et MSU', 'Un RCP par caméra pour l\'ingénieur vision, un MSU (pupitre maître) pour le chef vision, sur le réseau caméras du car.'],
};
const DEVS = [['grille', 'Grille'], ['spg', 'Synchro (SPG)'], ['icom', 'Intercom'], ['mix', 'Mélangeur (tally)'], ['rcp', 'RCP · MSU']];

function demoChaine(host) {
  let sig = 'video', block = '', v = 51, link = 'hyb', load = 'box', dirt = 'propre';
  const W = 660, H = 250, LY = { f1: 84, f2: 100, cu: 116 }, X0 = 128, X1 = 412;
  const svg = figure(W, H, 'La chaîne caméra : la tête, le câble hybride et ses trois voies (fibre vers la CCU, fibre vers la tête, cuivre), la CCU et les appareils du car ; ce qui circule s\'allume avec son sens');
  /** @type {Record<string, Element>} */ const lanes = {}, links = {}, blocks = {}, cuts = {};
  const pick = (id) => { block = block === id ? '' : id; draw(); };
  const clickable = (id, label, ...kids) => {
    const g = sv('g', { class: 'co-port', tabindex: '0', role: 'button', 'aria-label': label }, ...kids);
    g.addEventListener('click', () => pick(id)); g.addEventListener('keydown', (e) => { const k = /** @type {KeyboardEvent} */ (e).key; if (k === 'Enter' || k === ' ') { e.preventDefault(); pick(id); } });
    blocks[id] = g.firstChild instanceof Element ? g.firstChild : g; svg.append(g); return g;
  };
  clickable('tete', 'Tête de caméra', rect(8, 66, 120, 66, C.box), txt(68, 92, 'Tête de caméra', 'co-t'), txt(68, 108, 'objectif · viseur', 'co-s'), txt(68, 122, 'casque du cadreur', 'co-s'));
  // le câble : une zone cliquable sous les trois voies
  clickable('fibre', 'Câble hybride SMPTE', sv('rect', { x: X0, y: 72, width: X1 - X0, height: 54, fill: 'transparent', stroke: 'none' }));
  for (const [k, label] of [['f1', 'fibre 1 → vers la CCU'], ['f2', 'fibre 2 ← vers la tête'], ['cu', 'cuivre ← énergie']]) {
    lanes[k] = sv('line', { x1: X0, y1: LY[k], x2: X1, y2: LY[k], stroke: C.dim, strokeWidth: 3 });
    svg.append(lanes[k], txt(X0 + 8, LY[k] - 3, label, 'co-s', 'start'));
  }
  svg.append(sv('rect', { x: 352, y: 72, width: 6, height: 56, fill: C.line }), txt(355, 140, 'pied de car', 'co-s'));
  const lenT = txt(250, 140, '', 'co-m'); svg.append(lenT);
  clickable('ccu', 'CCU', rect(412, 66, 96, 66, C.box), txt(460, 96, 'CCU', 'co-t'), txt(460, 112, 'dans le car', 'co-s'));
  DEVS.forEach(([id, label], k) => {
    const y = 14 + k * 46;
    links[id] = sv('line', { x1: 508, y1: 99, x2: 548, y2: y + 15, stroke: C.dim, strokeWidth: 2 });
    svg.append(links[id]);
    clickable(id, label, rect(548, y, 104, 30, C.box), txt(600, y + 19, label, 'co-s'));
  });
  // la coupe du câble : les éléments allumés
  const cx = 206, cy = 200;
  svg.append(sv('circle', { cx, cy, r: 36, fill: '#2b2f33', stroke: C.line }), sv('circle', { cx, cy, r: 31, fill: '#20262b' }));
  cuts.f1 = sv('circle', { cx: cx - 11, cy: cy - 10, r: 5.5 }); cuts.f2 = sv('circle', { cx: cx + 11, cy: cy - 10, r: 5.5 });
  cuts.cu1 = sv('circle', { cx: cx - 13, cy: cy + 11, r: 7.5 }); cuts.cu2 = sv('circle', { cx: cx + 13, cy: cy + 11, r: 7.5 });
  for (const k of ['f1', 'f2', 'cu1', 'cu2']) svg.append(cuts[k]);
  svg.append(sv('circle', { cx, cy: cy - 23, r: 3.5, fill: '#8a7a5a' }), sv('circle', { cx, cy: cy + 25, r: 3.5, fill: '#8a7a5a' }));
  const legend = [['f1', 'fibre 1 : vers la CCU'], ['f2', 'fibre 2 : vers la tête'], ['cu', 'énergie (cuivre)'], ['bt', 'basse tension']];
  /** @type {Record<string, Element>} */ const legT = {};
  svg.append(txt(cx, cy - 44, 'coupe du câble', 'co-s'));
  legend.forEach(([k, s], i) => { legT[k] = txt(254, 178 + i * 15, s, 'co-s', 'start'); svg.append(legT[k]); });
  svg.append(txt(8, 160, '→ vers la CCU · ← vers la tête', 'co-s', 'start'), txt(8, 176, 'cliquez un appareil ou le câble', 'co-s', 'start'));
  const note = el('p', { class: 'co-note' });
  const verdict = el('p', { class: 'co-verdict' });
  const read = readout(['Sens', 'Dans le câble', 'Côté car', 'Qui s\'en sert', 'Énergie à la tête', 'Perdu dans le câble', 'Longueur maximale', 'Niveau optique à la CCU']);
  const flow = (e, on, dir) => { at(e, 'stroke-width', on ? 4 : e === lanes.cu || Object.values(lanes).includes(e) ? 3 : 2); e.setAttribute('class', on ? 'cm-flow' + (dir === 'rev' ? ' rev' : dir === 'still' ? ' still' : '') : ''); };
  const draw = () => {
    const S = SIGS[sig];
    const L = lenOf(v), hyb = link === 'hyb', powered = !hyb || powerAt(L, LOADS[load]).ok;
    // les voies et les liaisons vers les appareils
    for (const k of ['f1', 'f2', 'cu']) {
      const on = S.lanes.includes(k) && (k !== 'cu' || hyb);
      at(lanes[k], 'stroke', on ? (k === 'cu' ? (powered ? C.copper : C.red) : k === 'f1' ? C.amber : C.cyan) : C.dim);
      flow(lanes[k], on, k === 'f1' ? 'fwd' : 'rev');
    }
    for (const [id] of DEVS) {
      const on = S.dev === id;
      at(links[id], 'stroke', on ? (S.up && S.down ? C.green : S.up ? C.amber : C.cyan) : C.dim);
      flow(links[id], on, S.up && S.down ? 'still' : S.up ? 'fwd' : 'rev');
    }
    for (const id in blocks) { at(blocks[id], 'stroke', block === id ? '#fff' : id === S.dev ? C.green : id === 'fibre' ? 'none' : C.line); at(blocks[id], 'stroke-width', block === id ? 2.5 : 1.2); }
    at(cuts.f1, 'fill', S.lanes.includes('f1') ? C.amber : '#4a545e'); at(cuts.f2, 'fill', S.lanes.includes('f2') ? C.cyan : '#4a545e');
    for (const k of ['cu1', 'cu2']) at(cuts[k], 'fill', S.lanes.includes('cu') && hyb ? C.copper : '#5a4636');
    at(legT.f1, 'fill', S.lanes.includes('f1') ? C.amber : C.grey); at(legT.f2, 'fill', S.lanes.includes('f2') ? C.cyan : C.grey); at(legT.cu, 'fill', S.lanes.includes('cu') && hyb ? C.copper : C.grey);
    lenT.textContent = `câble : ${fmtLen(L)}${hyb ? '' : ' (monomode)'}`;
    note.textContent = block ? `${BLOCKS[block][0]} : ${BLOCKS[block][1]}` : 'Choisissez ce qui circule ; cliquez un appareil ou le câble pour son rôle.';
    read.set('Sens', S.up && S.down ? 'dans les deux sens' : S.up ? 'de la tête vers la CCU (fibre 1)' : sig === 'power' ? 'de la CCU vers la tête (cuivre)' : 'de la CCU vers la tête (fibre 2)');
    read.set('Dans le câble', sig === 'power' && !hyb ? 'rien : en monomode seule, la tête est alimentée sur place (DC IN)' : S.cable);
    read.set('Côté car', S.car); read.set('Qui s\'en sert', S.who);
    // l'énergie et la lumière
    const P = LOADS[load], rx = opticalAt(L, DIRT[dirt]);
    const Lopt = (PTX - N_CONN * CONN_DB - DIRT[dirt] - RX_MIN) / ATT_KM;
    const pw = powerAt(L, P);
    if (hyb) {
      read.set('Énergie à la tête', pw.ok ? `${fmtNum(pw.V)} V sur les ${V0} V envoyés · ${fmtNum(pw.I, 2)} A · ${P} W demandés` : `plus de tension utile : la CCU ne peut pas faire passer ${P} W`);
      read.set('Perdu dans le câble', pw.ok ? `${fmtNum(pw.loss)} W en chaleur (${fmtNum(pw.loss / (pw.loss + P) * 100)} % de ce qu'envoie la CCU) · ${fmtNum(pw.R)} Ω aller-retour` : `${fmtNum(pw.R)} Ω aller-retour : trop pour ${P} W`);
      read.set('Longueur maximale', `≈ ${fmtNum(pw.Lmax / 1000, 1)} km, limitée par l'énergie (la lumière irait à ≈ ${fmtNum(Lopt)} km)`);
    } else {
      read.set('Énergie à la tête', 'alimentation locale : bloc secteur ou batterie sur DC IN');
      read.set('Perdu dans le câble', 'aucune énergie dans le câble');
      read.set('Longueur maximale', `≈ ${SM_MAX} km annoncés pour le kit monomode (la lumière irait à ≈ ${fmtNum(Lopt)} km)`);
    }
    read.set('Niveau optique à la CCU', `${fmtDbm(rx)} dBm : ${rx < -30 ? 'pas de signal' : rx < RX_MIN ? 'la liaison décroche' : rx < -15 ? 'faible, sans marge' : 'normal (−5 à −15 dBm)'}`);
    // le verdict : la pire des deux limites
    let cls = 'ok', msg;
    if (hyb && !pw.ok) { cls = 'ko'; msg = `À ${fmtLen(L)}, la tête ne s'allume pas : la chute de tension dans le cuivre empêche la CCU de faire passer ${P} W (à la baie CCU : ALIM. COUPÉE). Passez en fibre monomode avec une alimentation locale.`; }
    else if (rx < RX_MIN) { cls = 'ko'; msg = `${fmtDbm(rx)} dBm à la CCU : la liaison décroche${DIRT[dirt] ? ' ; nettoyez les connecteurs avant tout' : ''}.`; }
    else if (!hyb && L > SM_MAX * 1000) { cls = 'warn'; msg = `Au-delà des ≈ ${SM_MAX} km annoncés pour le kit monomode : hors de la fiche, même si la lumière arrive encore (${fmtDbm(rx)} dBm).`; }
    else if (hyb && L > 0.85 * pw.Lmax) { cls = 'warn'; msg = `La tête s'allume, mais la tension n'est plus qu'à ${fmtNum(pw.V)} V : aucune marge. Le constructeur annonce un peu moins que cette limite théorique.`; }
    else if (rx < -15) { cls = 'warn'; msg = `${fmtDbm(rx)} dBm : l'image passe, sans marge. Un connecteur sale coûte plusieurs décibels : nettoyez et mesurez.`; }
    else msg = `Liaison bonne : ${hyb ? `tête alimentée par la CCU (${fmtNum(pw.V)} V)` : 'tête alimentée sur place'}, ${fmtDbm(rx)} dBm à la CCU.`;
    verdict.className = 'co-verdict ' + cls; verdict.textContent = msg;
  };
  host.append(
    el('div', { class: 'co-ctl' }, choice('Ce qui circule', Object.entries(SIGS).map(([k, s]) => [k, s.label]), sig, (x) => { sig = x; draw(); })),
    el('div', { class: 'co-mxwrap cm-syn' }, svg), note,
    el('div', { class: 'co-ctl' },
      slider('Longueur du câble', 0, 100, v, 1, (x) => { v = x; draw(); }, (x) => fmtLen(lenOf(x))),
      choice('Liaison', [['hyb', 'fibre hybride', 'La CCU alimente la tête par le cuivre du câble'], ['sm', 'monomode + alim. locale', 'Fibre monomode seule avec kit de conversion : la tête s\'alimente sur place']], link, (x) => { link = x; draw(); }),
      choice('Tête', [['box', `objectif box · ${LOADS.box} W`, 'Tête, objectif box et viseur 7" : ordre de grandeur'], ['port', `objectif portable · ${LOADS.port} W`, 'Tête, objectif portable et petit viseur : ordre de grandeur']], load, (x) => { load = x; draw(); }),
      choice('Connecteurs', [['propre', 'propres'], ['poussiere', 'une poussière', '+ 3 dB, ordre de grandeur'], ['sale', 'un sale', '+ 10 dB, ordre de grandeur']], dirt, (x) => { dirt = x; draw(); })),
    verdict, read.el,
    el('p', { class: 'note' }, `Modèle d'ordre de grandeur : la CCU envoie ${V0} V, le cuivre fait ${R_KM} Ω/km aller-retour, la tête prend une puissance fixe ; la lumière part à ${fmtDbm(PTX)} dBm et perd ${fmtNum(ATT_KM, 1)} dB/km et ${fmtNum(CONN_DB, 1)} dB par connexion (trois : caméra, prise murale, pied de car).`));
  draw();
}

// ================= leçon 2 : monter une caméra de stade =================
// ---------------- le schéma : la caméra montée, dans l'ordre ----------------
function figRig() {
  const f = figure(480, 222, 'Une caméra de stade montée, vue de côté, objectif vers le terrain : 1 pied et araignée, 2 tête fluide, 3 plaque, 4 adaptateur grand objectif, 5 tête de caméra, 6 objectif box, 7 viseur, numérotés dans l\'ordre du montage, avec leurs masses ; la croix marque l\'axe d\'inclinaison de la tête');
  const GY = 204;
  for (const [x1] of [[118], [178], [238]]) f.append(sv('line', { x1, y1: GY, x2: 178, y2: 130, stroke: C.grey, strokeWidth: 3 }));
  f.append(sv('line', { x1: 122, y1: GY - 4, x2: 234, y2: GY - 4, stroke: C.line, strokeWidth: 2 }), sv('circle', { cx: 178, cy: GY - 4, r: 4, fill: C.line }));
  f.append(sv('line', { x1: 20, y1: GY + 1, x2: 260, y2: GY + 1, stroke: '#2a3238', strokeWidth: 2 }));
  f.append(rect(160, 112, 36, 20, '#3a434c'), sv('line', { x1: 172, y1: 118, x2: 184, y2: 118, stroke: '#fff' }), sv('line', { x1: 178, y1: 112, x2: 178, y2: 124, stroke: '#fff' }));
  f.append(sv('line', { x1: 194, y1: 124, x2: 262, y2: 150, stroke: C.grey, strokeWidth: 4, 'stroke-linecap': 'round' }));
  f.append(rect(128, 104, 100, 7, '#59646f'));
  f.append(rect(132, 70, 90, 34, '#2c3035'));
  f.append(rect(222, 72, 36, 30, '#333c45'));
  f.append(rect(38, 66, 106, 34, '#17181a'), sv('rect', { x: 33, y: 70, width: 6, height: 26, fill: '#0b1a2a' }));
  f.append(rect(170, 48, 40, 22, '#2c3035'));
  const num = (n, x, y) => { f.append(sv('circle', { cx: x, cy: y, r: 8, fill: '#5c4210', stroke: C.amber }), txt(x, y + 4, String(n), 'co-m')); };
  num(1, 104, 176); num(2, 148, 124); num(3, 240, 112); num(4, 177, 88); num(5, 240, 87); num(6, 92, 83); num(7, 190, 59);
  f.append(txt(36, 40, '← terrain', 'co-s', 'start'));
  const rows = ['pied lourd et araignée · 15 kg', 'tête fluide · 18 kg', 'plaque coulissante · 1,5 kg', 'adaptateur grand objectif · 15,5 kg', 'tête de caméra · 5 kg', 'objectif box · 23,5 kg (à deux)', 'viseur 7,4" · 3,3 kg'];
  rows.forEach((s, i) => { const y = 30 + i * 18; f.append(sv('circle', { cx: 290, cy: y - 4, r: 7, fill: '#5c4210', stroke: C.amber }), txt(290, y, String(i + 1), 'co-m'), txt(303, y, s, 'co-s', 'start')); });
  f.append(txt(283, 166, 'sur la tête : ≈ 49 kg', 'co-m', 'start'), txt(283, 182, 'complète : ≈ 85 kg', 'co-m', 'start'), txt(283, 197, 'avec manches et commandes', 'co-s', 'start'));
  f.append(txt(20, 220, '+ axe d\'inclinaison de la tête · numéros : ordre du montage', 'co-s', 'start'));
  return f;
}

// ---------------- la manipulation : l'ordre des gestes, puis l'équilibrage ----------------
// Les gestes regroupent les 30 de l'atelier (atelier.js, OPS) avec les mêmes prérequis : un geste n'est accepté que
// si tout ce dont il dépend est fait. Masses de l'atelier (PARTS).
const STEPS = [
  { id: 'pied', t: 'Poser le pied sur son repère, sortir et bloquer les jambes', req: [], m: 15, ok: 'hauteur d\'optique de l\'ordre de 1,40 m d\'axe, chaque serrage bloqué' },
  { id: 'araignee', t: 'Verrouiller l\'araignée', req: ['pied'], ok: 'les jambes ne peuvent plus s\'écarter' },
  { id: 'tete', t: 'Boulonner la tête fluide sur l\'embase', req: ['araignee'], m: 18, ok: 'embase plate 4 vis (ou Mitchell avec un adaptateur)' },
  { id: 'niveau', t: 'Mettre la tête à niveau (bulle)', req: ['tete'], ok: 'bulle au centre, à moins de 0,2°' },
  { id: 'verrou', t: 'Verrouiller panoramique et inclinaison', req: ['tete'], ok: 'la plateforme ne peut plus basculer' },
  { id: 'manches', t: 'Monter les deux manches', req: ['tete'], m: 2, ok: 'dentures des rosaces emboîtées avant de serrer' },
  { id: 'adapt', t: 'Fixer la plaque, poser l\'adaptateur grand objectif et le verrouiller', req: ['niveau', 'verrou'], m: 17, head: 17, ok: 'levier fermé, témoin visible, test de traction' },
  { id: 'camera', t: 'Glisser la tête de caméra par l\'arrière et la verrouiller', req: ['adapt'], m: 5, head: 5, ok: 'énergie, vidéo et commandes passent par l\'accouplement' },
  { id: 'objectif', t: 'Lever l\'objectif box à deux, le verrouiller, brancher son câble', req: ['adapt', 'verrou', 'camera'], m: 23.5, head: 23.5, ok: '≈ 24 kg en bout de bras : à deux, sur une tête verrouillée' },
  { id: 'viseur', t: 'Poser le viseur sur l\'adaptateur', req: ['adapt'], m: 3.3, head: 3.3, ok: 'il recevra l\'image, le retour et le tally' },
  { id: 'commandes', t: 'Fixer les commandes de zoom et de point, les brancher', req: ['manches', 'objectif'], m: 1, ok: 'zoom au pouce, point à la molette, branchés au servo de l\'objectif' },
  { id: 'equilibre', t: 'Équilibrer : la plaque, puis le contrepoids et les frictions', req: ['objectif', 'viseur', 'camera'], why: 'on équilibre une fois toute la charge en place (caméra, objectif, viseur) : sinon l\'équilibre est faux dès la pièce suivante.', ok: 'la caméra tient seule à l\'horizontale' },
  { id: 'nettoyer', t: 'Inspecter et nettoyer les connecteurs de fibre (caméra et prise murale)', req: ['camera'], ok: 'au stylo de nettoyage, aux deux bouts' },
  { id: 'fibre', t: 'Brancher la fibre, la raccorder à la prise murale, l\'attacher au pied', req: ['nettoyer'], ok: 'une traction ne tirera ni sur le connecteur ni sur la caméra' },
  { id: 'service', t: 'Casque, bouchon retiré, « CAM 1 câblée » à la vision, test tally et CALL', req: ['fibre', 'objectif', 'viseur'], ok: 'la CCU alimente la tête, la caméra passe au line-up' },
];
const NEED = {
  pied: 'le pied doit d\'abord être sur son repère, jambes bloquées : tout le reste repose sur lui.',
  araignee: 'verrouillez d\'abord l\'araignée : sous près de 50 kg, des jambes libres s\'écartent.',
  tete: 'la tête fluide n\'est pas encore sur le pied.',
  niveau: 'mettez d\'abord la tête à niveau : une fois chargée, elle ne se remet plus à niveau.',
  verrou: 'verrouillez d\'abord la tête : une plateforme libre bascule sous la charge.',
  manches: 'les commandes se fixent sur les manches : montez-les d\'abord.',
  adapt: 'l\'adaptateur grand objectif reçoit la caméra, l\'objectif et le viseur : il doit être posé et verrouillé.',
  camera: 'la tête de caméra doit être en place et verrouillée (le câble de l\'objectif et la fibre s\'y branchent).',
  objectif: 'l\'objectif n\'est pas encore monté.',
  viseur: 'le viseur n\'est pas encore posé.',
  nettoyer: 'une fibre se nettoie aux deux bouts avant d\'être branchée : une poussière suffit à faire chuter le niveau optique.',
  fibre: 'la fibre n\'est pas branchée : la CCU ne peut ni alimenter la tête ni recevoir son image.',
};
const shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

// la charge sur la tête : position (m) par rapport à l'axe d'inclinaison, plaque au milieu (x vers l'avant, y vers le haut)
const PAY = [
  { id: 'plaque', label: 'plaque', m: 1.5, x: 0, y: 0.09, w: 0.40, h: 0.03, fill: '#59646f' },
  { id: 'adapt', label: 'adaptateur', m: 15.5, x: -0.15, y: 0.20, w: 0.30, h: 0.19, fill: '#2c3035' },
  { id: 'cam', label: 'caméra', m: 5, x: -0.36, y: 0.27, w: 0.16, h: 0.15, fill: '#333c45' },
  { id: 'lens', label: 'objectif box', m: 23.5, x: 0.32, y: 0.28, w: 0.62, h: 0.19, fill: '#17181a' },
  { id: 'vf', label: 'viseur (3,3 kg)', m: 3.3, x: -0.12, y: 0.46, w: 0.18, h: 0.11, fill: '#2c3035', opt: true, on: true },
  { id: 'hood', label: 'pare-soleil (0,4 kg)', m: 0.4, x: 0.65, y: 0.28, w: 0.06, h: 0.24, fill: '#3a434c', opt: true, on: false },
];
/** centre de gravité de la charge, plaque décalée de d (m, + vers l'avant) */
export function balanceOf(parts, d) {
  let M = 0, mx = 0, my = 0;
  for (const p of parts) { M += p.m; mx += p.m * (p.x + d); my += p.m * p.y; }
  return { M, x: mx / M, y: my / M, torque: M * G * mx / M, counter15: M * G * (my / M) * Math.sin(15 * Math.PI / 180) };
}

function demoMontage(host) {
  // ---- 1. l'ordre ----
  let order = shuffle(STEPS), done = /** @type {string[]} */ ([]), errs = 0;
  const pool = el('div', { class: 'co-btns cm-pool' }), list = el('ol', { class: 'cm-done' });
  const verdict = el('p', { class: 'co-verdict' }, 'Cliquez le premier geste du montage.');
  const read = readout(['Gestes faits', 'Erreurs', 'Charge sur la tête', 'Masse montée']);
  const mass = (k) => STEPS.filter((s) => done.includes(s.id)).reduce((a, s) => a + (s[k] || 0), 0);
  const drawOrder = () => {
    pool.replaceChildren(...order.filter((s) => !done.includes(s.id)).map((s) => el('button', { type: 'button', class: 'btn small', onclick: () => tryStep(s) }, s.t)));
    list.replaceChildren(...done.map((id) => el('li', {}, STEPS.find((s) => s.id === id).t)));
    read.set('Gestes faits', `${done.length} / ${STEPS.length}`);
    read.set('Erreurs', errs ? `${errs} geste${errs > 1 ? 's' : ''} refusé${errs > 1 ? 's' : ''}` : 'aucune');
    read.set('Charge sur la tête', `${fmtNum(mass('head'), 1)} kg`);
    read.set('Masse montée', `${fmtNum(mass('m'), 1)} kg`);
  };
  const tryStep = (s) => {
    const miss = s.req.filter((r) => !done.includes(r));
    if (miss.length) { errs++; verdict.className = 'co-verdict ko'; verdict.textContent = `Refusé : ${s.why || NEED[miss[0]]}`; }
    else {
      done.push(s.id);
      const end = done.length === STEPS.length;
      verdict.className = 'co-verdict ' + (end ? 'ok' : 'warn');
      verdict.textContent = end ? `Montage complet, ${errs ? `${errs} geste${errs > 1 ? 's' : ''} refusé${errs > 1 ? 's' : ''}` : 'sans erreur'} : ${fmtNum(mass('head'), 1)} kg sur la tête, ≈ ${fmtNum(mass('m'))} kg en tout. La caméra passe au line-up.` : `${done.length}. ${s.t} : ${s.ok}.`;
    }
    drawOrder();
  };
  const again = el('button', { type: 'button', class: 'btn small', onclick: () => { order = shuffle(STEPS); done = []; errs = 0; verdict.className = 'co-verdict'; verdict.textContent = 'Cliquez le premier geste du montage.'; drawOrder(); } }, 'Recommencer');

  // ---- 2. l'équilibrage ----
  const parts = PAY.map((p) => ({ ...p }));
  let d = 0;
  const K = 220, AX = 212, AY = 156;
  const svg = figure(400, 196, 'Équilibrage, vue de côté : la charge sur la tête, l\'axe d\'inclinaison (cercle blanc), la verticale de l\'axe en pointillé et le centre de gravité (croix rouge) ; la charge bascule du côté du centre de gravité tant qu\'il n\'est pas au-dessus de l\'axe');
  svg.append(rect(AX - 28, AY - 2, 56, 26, '#3a434c'), txt(AX, AY + 16, 'tête fluide', 'co-s'));
  svg.append(sv('line', { x1: AX, y1: 10, x2: AX, y2: AY, stroke: C.grey, 'stroke-dasharray': '3 4' }), txt(14, 18, '← terrain (avant)', 'co-s', 'start'));
  const grp = sv('g', {}); svg.append(grp);
  const cg = sv('g', {}, sv('line', { x1: -6, y1: -6, x2: 6, y2: 6, stroke: C.red, strokeWidth: 2.5 }), sv('line', { x1: -6, y1: 6, x2: 6, y2: -6, stroke: C.red, strokeWidth: 2.5 }));
  svg.append(sv('circle', { cx: AX, cy: AY, r: 4, fill: '#fff' }));
  const bread = readout(['Charge sur la tête', 'Centre de gravité', 'Couple de basculement', 'Hauteur du centre de gravité', 'Contrepoids à 15° d\'inclinaison']);
  const bverdict = el('p', { class: 'co-verdict' });
  const drawBal = () => {
    const on = parts.filter((p) => !p.opt || p.on), B = balanceOf(on, d);
    grp.replaceChildren();
    for (const p of on) {
      const x = AX - (p.x + d + p.w / 2) * K, y = AY - (p.y + p.h / 2) * K;
      grp.append(rect(x, y, p.w * K, p.h * K, p.fill), txt(AX - (p.x + d) * K, AY - p.y * K + 4, p.id === 'plaque' || p.id === 'hood' ? '' : p.label.replace(/ \(.*/, ''), 'co-s'));
    }
    at(cg, 'transform', `translate(${AX - B.x * K} ${AY - B.y * K})`); grp.append(cg);
    const tilt = Math.max(-0.25, Math.min(0.25, B.x * 2.4)); // la charge pique du côté du centre de gravité (affichage)
    const bal = Math.abs(B.x) <= 0.01;
    at(grp, 'transform', `rotate(${bal ? 0 : -tilt * 180 / Math.PI} ${AX} ${AY})`);
    bread.set('Charge sur la tête', `${fmtNum(B.M, 1)} kg`);
    bread.set('Centre de gravité', `${fmtNum(Math.abs(B.x) * 100, 1)} cm ${B.x >= 0 ? 'en avant' : 'en arrière'} de l'axe`);
    bread.set('Couple de basculement', `${fmtNum(B.M, 1)} × 9,81 × ${fmtNum(Math.abs(B.x), 3)} = ${fmtNum(Math.abs(B.torque), 1)} N·m`);
    bread.set('Hauteur du centre de gravité', `${fmtNum(B.y * 100)} cm au-dessus de l'axe`);
    bread.set('Contrepoids à 15° d\'inclinaison', `${fmtNum(B.counter15)} N·m à compenser par les ressorts de la tête`);
    bverdict.className = 'co-verdict ' + (bal ? 'ok' : 'ko');
    bverdict.textContent = bal ? 'En équilibre : le centre de gravité est au-dessus de l\'axe, la caméra tient seule à l\'horizontale. Restent le contrepoids et les frictions.' : B.x > 0 ? `Elle pique du nez : reculez la plaque de ${fmtNum(B.x * 100, 1)} cm.` : `Elle part en arrière : avancez la plaque de ${fmtNum(-B.x * 100, 1)} cm.`;
  };
  const chks = parts.filter((p) => p.opt).map((p) => {
    const inp = /** @type {HTMLInputElement} */ (el('input', { type: 'checkbox', checked: p.on }));
    inp.addEventListener('change', () => { p.on = inp.checked; drawBal(); });
    return el('label', { class: 'co-chk' }, inp, p.label);
  });
  host.append(
    el('h5', { class: 'co-h5' }, '1 · Monter dans l\'ordre'),
    el('div', { class: 'co-2' }, el('div', {}, el('p', { class: 'co-note' }, 'Les gestes, dans le désordre :'), pool), el('div', {}, el('p', { class: 'co-note' }, 'Votre montage :'), list)),
    verdict, el('div', { class: 'co-ctl' }, again), read.el,
    el('h5', { class: 'co-h5' }, '2 · Équilibrer avant / arrière'),
    el('div', { class: 'co-ctl' }, slider('Plaque', -12, 12, 0, 0.5, (x) => { d = x / 100; drawBal(); }, (x) => (x === 0 ? 'au milieu' : fmtNum(Math.abs(x), 1) + (x > 0 ? ' cm vers l\'avant' : ' cm vers l\'arrière'))), ...chks),
    el('div', { class: 'co-2' }, svg, el('div', { class: 'co-demo-host' }, bverdict, bread.el)));
  drawOrder(); drawBal();
}

registerChapter({
  id: 'camera', title: 'La caméra', icon: 'ccu',
  intro: 'La caméra système de bout en bout : la tête, l\'objectif, la fibre, la CCU et le RCP, jusqu\'au montage sur le terrain.',
  module: { label: 'La caméra en 3D', sub: 'objectif, prisme, capteurs, menu, connectique', event: 'camera', arg: { from: 'cours' } },
  lessons: [
    {
      id: 'camera-systeme', title: 'La chaîne caméra : tête, fibre, CCU, RCP', minutes: '9 min',
      essentials: [
        'Une **caméra système**, c\'est une **tête** sur le terrain et sa **CCU** dans le car, reliées par un seul câble : la **fibre hybride SMPTE** (ST 311).',
        'Deux fibres portent les signaux, une par sens (vers le car : l\'image, le son ; vers la tête : retours, ordres, tally, commandes) ; le cuivre porte l\'**énergie** envoyée par la CCU, ce qui limite le câble à ≈ 2 km.',
        'L\'**ingénieur vision** règle l\'image au **RCP** (iris, noir, couleur), le chef vision tient le **MSU** ; le **cadreur** règle le cadre, le zoom, le point et son viseur.',
      ],
      figure: figQui,
      demoTitle: 'Choisissez ce qui circule et suivez-le de la tête au car ; allongez le câble jusqu\'à ce que la tête ne s\'allume plus, puis passez en monomode et salissez un connecteur.',
      demo: demoChaine,
      body: `Une **caméra système** est faite de trois éléments reliés entre eux. Sur le terrain, la **tête de caméra** : le prisme et les trois capteurs, le traitement de l'image, l'objectif et le viseur ; une tête de stade pèse environ 5 kg sans son objectif. Dans le car, la **CCU** (Camera Control Unit, la voie caméra), un boîtier en baie par caméra. Sur le pupitre de la régie vision, le **RCP** (Remote Control Panel), la télécommande de l'image. Tête et CCU vont par paire, de la même marque : ce qui passe entre elles suit un format de transmission propre au constructeur.

Entre la tête et la CCU, un seul câble : la **fibre hybride SMPTE** (câble ST 311, connecteur ST 304, type LEMO 3K.93C). Il contient deux **fibres monomodes** (un cœur de verre de 9 µm qui guide la lumière d'un laser), une par sens, deux conducteurs de cuivre pour l'énergie et deux conducteurs basse tension. Vers la CCU montent l'image, le son des micros de la caméra, la voix du cadreur et son appel (**CALL**, la lampe qui s'allume au RCP). Vers la tête descendent les **retours vidéo** (le programme dans le viseur), les **ordres** d'intercom (PROD pour la réalisation, ENG pour la technique), le **tally** (la lampe rouge « à l'antenne », verte « prête »), les commandes du RCP et la synchro. Le câble passe par la prise de la passerelle, le pré-câblage du stade et le **pied de car**, le panneau de raccordement extérieur du car.

La CCU **télé-alimente** la tête : elle envoie une tension élevée sur le cuivre et la tête y prend sa puissance, de l'ordre de 100 W avec un objectif box et un grand viseur. Le cuivre a une résistance : plus le câble est long, plus la tension chute et plus d'énergie part en chaleur, jusqu'au point où la CCU ne peut plus faire passer la puissance demandée. C'est l'énergie, pas la lumière, qui fixe la longueur : **environ 2 km** pour une caméra de stade en fibre hybride, 600 m pour la caméra de plateau HXC-FB80 du module 3D (d'après son mode d'emploi). La lumière ne perd que 0,4 dB par kilomètre : au-delà, on passe en **fibre monomode seule**, avec un kit de conversion et une alimentation locale de la caméra (DC IN, bloc secteur ou batterie), jusqu'à **environ 10 km**.

La CCU reçoit la **référence** du générateur de synchro (black burst ou tri-level, par un distributeur) et cale la tête dessus : c'est le **genlock**, qui fait sortir toutes les caméras au même instant pour que le mélangeur coupe proprement. Elle sort l'image en SDI vers la grille (3G-SDI en 1080p50, 12G-SDI en UHD, avec une copie HD SDR pour les diffuseurs HD), son embarqué ; elle reçoit les retours de la grille, le tally du mélangeur et l'intercom de la matrice. Sa face avant affiche le **niveau optique** reçu en dBm (décibels par rapport à 1 mW) : de −5 à −15 dBm en exploitation ; vers −20 dBm, la liaison décroche. Une poussière sur un connecteur coûte plusieurs décibels.

Qui règle quoi. L'**ingénieur vision** règle l'image au RCP : l'**iris** (joystick poussé), le **master black** (le niveau du noir, la bague du joystick), le gain, le shutter (l'obturateur électronique), les filtres ND (densité neutre, qui retirent de la lumière) et CC (correction de couleur), les balances des blancs et des noirs (AWB, ABB, molettes WHITE et BLACK), puis dans les menus le détail, le gamma, le knee et la matrice. Il allume la caméra (CAM PW), envoie ses barres (BARS) et déverrouille son panneau (PANEL ACTIVE) avant de régler. Le **chef vision** a en plus le **MSU** (Master Setup Unit), le pupitre maître qui atteint toutes les caméras, leurs fichiers de réglage, et peut copier un réglage de l'une à l'autre. Le **cadreur** règle tout ce qui fait le cadre : panoramique et inclinaison aux manches, zoom au pouce, point à la molette, le doubleur ×2 de l'objectif, et son viseur (luminosité, **peaking** qui souligne les contours nets pour faire le point, **zebra** qui hachure ce qui dépasse un niveau, retour RET). Il ne touche pas à l'iris : reliée à sa CCU, la caméra obéit au RCP pour toute la peinture de l'image.

- Câble hybride ST 311 : 2 fibres monomodes 9/125 µm, 2 conducteurs d'énergie, 2 conducteurs basse tension ; connecteur ST 304, à nettoyer à chaque branchement.
- Portées : ≈ 2 km en hybride (limite de l'énergie), ≈ 10 km en monomode avec alimentation locale ; ordres de grandeur, selon la caméra, la CCU et le câble.
- Niveau optique à la CCU : −5 à −15 dBm en exploitation, décrochage vers −20 dBm.`,
      car: { text: 'À la baie CCU, une ligne par voie : la caméra, sa liaison et sa longueur, puis l\'état, par exemple « ALIM. CCU · OPT. −5,6 dBm · RÉF. LOCK », ou l\'alarme (OPTIQUE : PAS DE SIGNAL, ALIM. COUPÉE, RÉF. NON VERROUILLÉE). « Voir la CCU » ouvre ses faces ; au poste vision, le RCP de chaque caméra.', station: 'ccu' },
      terms: ['ctrl-sdi', 'poe', 'tsl-umd', 'timing-ref'],
      competences: ['2.7', '2.10', '2.9'],
      article: 'camsys',
      exercises: [
        { id: 'materiel-camera', intro: 'Dans la visionneuse de matériel, vous ouvrez l\'arrière de la tête de caméra puis celui de sa CCU et vous cliquez leurs connecteurs : la fibre hybride, l\'intercom du cadreur, l\'arrivée CAMERA, la référence et la sortie SDI vers la grille. Sur chaque face, retrouvez ce qui monte vers le car et ce qui descend vers la tête.' },
        { id: 'cadreur-cadrer', intro: 'Vous prenez la caméra large en tribune : zoom, panoramique, puis la lecture du tally. Observez ce que le cadreur règle lui-même (le cadre, la focale) et ce qu\'il reçoit par la fibre sans y toucher : l\'image de son viseur, le tally, la voix de la réalisation.' },
        { id: 'ccu-depannage', intro: 'À la baie CCU, une caméra perd sa fibre et une autre sa référence. Lisez l\'état de chaque voie : le niveau optique dit si la lumière arrive, REF LOCK si la caméra est en phase ; rétablissez avant de chercher la cause.' },
      ],
      quiz: [
        { q: 'Dans le câble hybride SMPTE, par où passe l\'énergie de la tête de caméra ?', choices: ['Par les fibres optiques, avec l\'image', 'Par les conducteurs de cuivre du câble : la CCU l\'envoie depuis le car', 'Par une batterie fixée sur la tête'], answer: 1, why: 'Une fibre porte de la lumière, pas de puissance utile : l\'énergie passe par les deux conducteurs de cuivre, sous une tension élevée envoyée par la CCU. Une batterie ou un bloc sur DC IN ne sert que quand la tête n\'est pas alimentée par le câble : fibre monomode seule, longue distance, caméra sans CCU.' },
        { q: 'Une caméra au bout de 3 km de fibre hybride ne s\'allume pas ; à la même distance, une fibre monomode fonctionne. Pourquoi ?', choices: ['La lumière ne va pas à 3 km dans une fibre hybride', 'La chute de tension dans le cuivre empêche la CCU de faire passer la puissance au-delà d\'environ 2 km', 'La sortie SDI de la caméra est limitée à 2 km'], answer: 1, why: 'La lumière ne perd que 0,4 dB par kilomètre : à 3 km, elle arrive très bien. C\'est l\'énergie qui manque : la résistance du cuivre fait chuter la tension jusqu\'à ce que la tête ne puisse plus être alimentée (ALIM. COUPÉE à la baie CCU). En monomode, la caméra est alimentée sur place. Le SDI, lui, sort de la CCU, dans le car.' },
        { q: 'Pendant le match, qui règle l\'iris d\'une caméra de tribune ?', choices: ['Le cadreur, à la bague de l\'objectif', 'L\'ingénieur vision, au joystick de son RCP', 'Le réalisateur, au mélangeur'], answer: 1, why: 'Reliée à sa CCU, la caméra obéit au RCP pour l\'exposition et la couleur : l\'ingénieur vision expose toutes les caméras au même niveau, l\'œil sur le waveform. Le cadreur garde le cadre, le zoom et le point ; le réalisateur choisit les images, il ne les règle pas.' },
        { q: 'À la baie CCU, la voie de la CAM 4 affiche OPT. −18 dBm ; les autres voies sont vers −6 dBm. Que faut-il en penser ?',
          choices: ['Hors de la plage d\'exploitation, près du décrochage : inspecter et nettoyer les connecteurs de la fibre',
            ['Rien d\'anormal : tant que l\'image arrive, le niveau optique ne compte pas', 'L\'exploitation se fait entre −5 et −15 dBm, et la liaison décroche vers −20 dBm : à −18 dBm, il ne reste qu\'environ 2 dB.'],
            ['Le câble de la CAM 4 est trop long : il faut un câble plus court', 'La lumière ne perd que 0,4 dB par kilomètre : même 2 km de câble n\'expliquent pas 12 dB d\'écart avec les autres voies.']],
          answer: 0, why: 'En exploitation, la CCU reçoit de −5 à −15 dBm ; vers −20 dBm, la liaison décroche. −18 dBm, c\'est 12 dB de moins que les autres voies, et une poussière sur un connecteur coûte plusieurs décibels. On inspecte et on nettoie les connecteurs avant le direct.' },
        { q: 'À la baie CCU, la voie de la CAM 2 passe en alarme RÉF. NON VERROUILLÉE. Quelle conséquence pour le direct ?',
          choices: [['La caméra n\'a plus d\'image : c\'est la référence qui la transporte', 'La référence (black burst ou tri-level) ne donne que le rythme commun. L\'image monte par la fibre et sort de la CCU en SDI vers la grille.'],
            'La caméra n\'est plus en phase avec les autres : le mélangeur ne peut plus couper proprement sur elle',
            ['La tête n\'est plus alimentée : il faut vérifier le cuivre du câble', 'Ce serait l\'alarme ALIM. COUPÉE. RÉF. NON VERROUILLÉE concerne la synchro : la CCU n\'est plus calée sur le générateur.']],
          answer: 1, why: 'La CCU reçoit la référence du générateur de synchro, par un distributeur, et cale la tête dessus : c\'est le genlock, qui fait sortir toutes les caméras au même instant. Sans lui, cette caméra n\'est plus en phase avec les autres, et le mélangeur ne coupe plus proprement. On vérifie l\'arrivée de la référence à la CCU.' },
      ],
    },
    CAMERA_FIBRE,
    {
      id: 'camera-montage', title: 'Monter une caméra de stade', minutes: '9 min',
      essentials: [
        'Une règle fixe l\'ordre : **rien ne se pose sur une pièce qui n\'est pas stable et verrouillée** (pied et araignée, tête à niveau et verrouillée, adaptateur, caméra, objectif box à deux, viseur).',
        'On **équilibre** une fois tout monté : la plaque coulisse jusqu\'à ce que le **centre de gravité** soit au-dessus de l\'axe d\'inclinaison ; puis le contrepoids et les frictions.',
        'La fibre se **nettoie aux deux bouts** avant d\'être branchée et s\'attache au pied ; la mise en service se fait avec la vision : énergie, image, tally, CALL.',
      ],
      figure: figRig,
      demoTitle: 'Cliquez les gestes dans l\'ordre du montage : un geste trop tôt est refusé, avec la raison. Puis faites glisser la plaque jusqu\'à l\'équilibre, et retirez le viseur ou ajoutez le pare-soleil.',
      demo: demoMontage,
      body: `Une caméra principale de passerelle pèse plus de 80 kg une fois montée, dont près de 50 kg sur la tête fluide. L'ordre de montage n'est pas une formalité : il évite la bascule, la chute d'un objectif de 24 kg et la liaison qui décroche à l'antenne. Une seule règle le résume : **rien ne se pose sur une pièce qui n'est pas stable et verrouillée**. L'atelier de montage du simulateur la fait respecter geste par geste : une pièce présentée trop tôt est refusée, et l'erreur comptée.

**Le support.** Le **pied lourd** (≈ 15 kg) se pose sur le repère de la position, celui du plan caméras ; on sort les jambes à la hauteur d'optique voulue (de l'ordre de 1,40 m d'axe) et on bloque chaque serrage. L'**araignée**, l'étoile qui relie le bas des jambes, se verrouille : sinon les jambes s'écartent sous la charge. La **tête fluide** (≈ 18 kg ; ses mouvements sont freinés par un fluide visqueux, d'où des panoramiques sans à-coups) se boulonne sur l'embase, plate à 4 vis ou Mitchell avec un adaptateur. On la **met à niveau** à la bulle avant de la charger, puis on **verrouille** panoramique et inclinaison. Les deux **manches** se montent sur leurs rosaces dentées.

**La caméra.** La **plaque** coulissante reçoit l'**adaptateur grand objectif** (≈ 15,5 kg), qui transforme une tête de caméra portable en caméra de stade : levier fermé, témoin visible, test de traction. La **tête de caméra** (≈ 5 kg) s'y glisse par l'arrière et se verrouille ; énergie, vidéo et commandes passent par l'accouplement. L'**objectif box**, le grand zoom de stade en caisson (≈ 23,5 kg), se lève **à deux**, tête verrouillée, adaptateur déjà bloqué, puis se verrouille ; son câble de 36 broches le relie à la caméra. Le **viseur** 7,4" s'emboîte sur le dessus. Les **commandes** de zoom (bascule au pouce) et de point (molette) se fixent sur les manches et se branchent au servo de l'objectif.

**L'équilibrage**, une fois toute la charge en place. Le poids agit en un point, le **centre de gravité**. S'il est en avant de l'axe d'inclinaison de la tête, il crée un couple qui fait piquer la caméra du nez : 49 kg à 6 cm de l'axe, c'est 49 × 9,81 × 0,06 ≈ 29 N·m, que le fluide freine sans le retenir. On fait glisser la plaque jusqu'à ce que le centre de gravité passe au-dessus de l'axe : la caméra tient seule à l'horizontale. Reste la hauteur : le centre de gravité est à environ 25 cm au-dessus de l'axe ; dès qu'on incline, il sort de la verticale et la caméra tend à continuer. Le **contrepoids** de la tête (des ressorts) compense ce couple ; on le règle pour la charge avant de libérer le verrou, puis les **frictions** en dernier, au goût du cadreur. Tout ajout (pare-soleil, housse de pluie) se rééquilibre.

**La liaison et la mise en service.** Chaque extrémité de la fibre (caméra, câble, prise murale) s'**inspecte et se nettoie** au stylo avant d'être branchée : le cœur d'une fibre monomode fait 9 µm, une poussière suffit à faire chuter le niveau optique à la CCU. On aligne le détrompeur, on visse la bague, on **attache le câble au pied** pour qu'une traction ne tire ni sur le connecteur ni sur la caméra. Casque d'intercom branché, bouchon d'objectif retiré, on appelle la vision : « CAM 1 câblée ». La CCU alimente la tête, la vision vérifie l'image, on teste ensemble le **CALL** (la lampe d'appel s'allume au RCP) et le **tally** du viseur. La caméra passe au line-up.

- Sécurités : l'objectif box se lève à deux ; jamais de charge sur une tête libre ; témoins de verrouillage vus et test de traction ; câble attaché au pied et passé dans les passages protégés.
- Sur une passerelle : protection collective d'abord (garde-corps), rien posé en bord de passerelle, outils attachés.
- Masses de l'atelier, d'après les fiches constructeurs : pied 15 kg, tête 18 kg, adaptateur 15,5 kg, caméra 5 kg, objectif 23,5 kg, viseur 3,3 kg.`,
      car: { text: 'L\'atelier de montage (feuille de service, 09:30) fait refaire ces gestes sur la CAM 1, sur la passerelle de la tribune : les pièces dans leurs flight cases, la bulle et l\'équilibrage à la molette, le nettoyage de la fibre maintenu, puis la mise en service avec la vision. À la baie CCU, la voie de la caméra montée passe alors en « ALIM. CCU » avec son niveau optique.', station: 'ccu' },
      competences: ['2.7', '4.2', '3.9'],
      article: 'montage',
      exercises: [
        { id: 'atelier-montage', intro: 'Olivier vous accompagne dans l\'atelier, phase par phase : support, caméra et objectif, commandes, équilibrage, liaison, mise en service. À chaque pièce, regardez ce qu\'elle exige d\'être déjà verrouillé, et réglez l\'équilibre comme dans la leçon : la caméra doit tenir seule à l\'horizontale.' },
        { id: 'x-atelier', intro: 'Le même montage, seul et chronométré : le temps et chaque geste refusé sont notés dans le rapport de montage. Visez zéro erreur avant de chercher la vitesse : l\'ordre de la leçon suffit.' },
      ],
      quiz: [
        { q: 'Pourquoi verrouille-t-on panoramique et inclinaison avant de poser l\'adaptateur et l\'objectif ?', choices: ['Pour que la plateforme ne bascule pas pendant qu\'on charge près de 50 kg', 'Pour régler les frictions de la tête', 'Pour protéger la bulle de niveau'], answer: 0, why: 'Tête libre, une charge posée d\'un côté fait basculer la plateforme : l\'objectif de 24 kg tomberait. Les frictions se règlent après l\'équilibrage, au goût du cadreur ; la bulle se règle avant de charger, le verrou ne la protège pas.' },
        { q: 'La charge (49 kg) a son centre de gravité 6 cm en avant de l\'axe d\'inclinaison. Que se passe-t-il quand on libère le verrou ?', choices: ['Rien : la tête fluide retient la caméra', 'La caméra pique du nez (≈ 29 N·m) : on recule la plaque de 6 cm', 'La caméra part en arrière : on avance la plaque'], answer: 1, why: 'Le poids crée un couple de 49 × 9,81 × 0,06 ≈ 29 N·m vers l\'avant : le fluide freine le mouvement mais ne le retient pas. On recule la plaque jusqu\'à ce que le centre de gravité passe au-dessus de l\'axe ; la caméra tient alors seule à l\'horizontale.' },
        { q: 'Pourquoi nettoie-t-on les deux connecteurs de la fibre, et pas seulement celui de la caméra ?', choices: ['Chaque raccord met deux faces de verre en contact : une poussière d\'un seul côté fait chuter le niveau optique et passe sur l\'autre face', 'Pour éviter un court-circuit dans le cuivre', 'C\'est une habitude sans effet mesurable'], answer: 0, why: 'Le cœur d\'une fibre monomode fait 9 µm : une poussière plus fine qu\'un cheveu le masque, coûte plusieurs décibels à la CCU et peut rayer les faces. Le cuivre n\'y est pour rien : c\'est la lumière qui passe mal, et la CCU le mesure.' },
        { q: 'On vient de poser l\'adaptateur grand objectif sur la plaque : levier fermé, mais le témoin de verrouillage n\'est pas visible. Que faire avant d\'y glisser la caméra ?',
          choices: [['Glisser la caméra : elle ne pèse que 5 kg', 'Le poids ne change rien à la règle : rien ne se pose sur une pièce qui n\'est pas verrouillée. Et l\'objectif de 23,5 kg viendra ensuite sur ce même adaptateur.'],
            'Vérifier le verrou : témoin visible et test de traction, avant toute charge',
            ['Continuer, et vérifier le verrou une fois tout monté', 'Une fois l\'objectif posé, un adaptateur mal verrouillé, c\'est la chute de 24 kg : on vérifie avant de charger, quand la pièce est encore vide.']],
          answer: 1, why: 'Une seule règle fixe l\'ordre : rien ne se pose sur une pièce qui n\'est pas stable et verrouillée. L\'adaptateur se valide par trois contrôles, levier fermé, témoin visible, test de traction : ici, le témoin manque et la traction reste à faire. C\'est lui qui portera la caméra, puis l\'objectif.' },
        { q: 'La CAM 1 tient seule à l\'horizontale, mais dès que le cadreur l\'incline vers le bas, elle tend à continuer de plonger. Que faut-il régler ?',
          choices: [['La plaque, en la reculant encore', 'À l\'horizontale, la caméra tient seule : le centre de gravité est déjà au-dessus de l\'axe. Reculer la plaque le ferait passer derrière, et la caméra partirait en arrière.'],
            ['Rien : la tête fluide est là pour retenir ce mouvement', 'Le fluide freine le mouvement, il ne retient pas la charge : la caméra plongerait plus lentement, mais elle plongerait. Il faut un couple opposé.'],
            'Le contrepoids de la tête : ses ressorts compensent le couple qui naît quand on incline'],
          answer: 2, why: 'Le centre de gravité est à environ 25 cm au-dessus de l\'axe d\'inclinaison : dès qu\'on incline, il sort de la verticale et crée un couple qui fait continuer la caméra. Le contrepoids (des ressorts) compense ce couple ; il se règle pour la charge, puis viennent les frictions, au goût du cadreur.' },
      ],
    },
  ],
});

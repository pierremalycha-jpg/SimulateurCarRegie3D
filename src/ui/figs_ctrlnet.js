// @ts-check
// Schémas des fiches « ? » pour le réseau de contrôle du car SDI (IP, masque, passerelle, VLAN, QoS…) : ajoutés à ui/term_figs.js (FIGS).
// Même style que term_figs.js (SVG en texte, couleurs de l'interface). Une couleur par VLAN, la même
// que dans le poste : gestion gris, caméras cyan, production ambre, ralentis violet, intercom vert,
// fichiers jaune, invités rose. LESSON_FIGS : schémas de l'onglet Formation sans fiche propre.
import { FIGS } from './term_figs.js';

const FG = '#e7eaed', MUTED = '#9aa3ab', LINE = '#4a5560', ACC = '#8ccdf2', AMB = '#f0a61c', GRN = '#2fbf5a', RED = '#ff6b5e', BOX = '#1c2126', DARK = '#121518';
export const VCOL = { 1: '#6b737b', 10: '#a9b4bd', 20: '#4cc3e6', 30: '#f0a61c', 40: '#c77dff', 50: '#2fbf5a', 60: '#e8c35a', 90: '#ff7eb6' };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const T = (x, y, s, o = {}) => `<text x="${x}" y="${y}" fill="${o.c || FG}" font-size="${o.s || 12}"${o.a ? ` text-anchor="${o.a}"` : ''}${o.w ? ` font-weight="${o.w}"` : ''}${o.m ? ' font-family="JetBrains Mono, ui-monospace, monospace"' : ''}>${esc(s)}</text>`;
const R = (x, y, w, h, o = {}) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${o.r ?? 4}" fill="${o.f || BOX}" stroke="${o.s || LINE}" stroke-width="${o.sw || 1}"${o.d ? ' stroke-dasharray="4 3"' : ''}/>`;
const L = (x1, y1, x2, y2, o = {}) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${o.c || LINE}" stroke-width="${o.w || 1.5}"${o.d ? ' stroke-dasharray="5 4"' : ''}${o.arrow ? ` marker-end="url(#cnmk-${o.arrow})"` : ''}/>`;
const node = (x, y, w, h, title, sub, o = {}) => R(x, y, w, h, { s: o.s || LINE, f: o.f }) + T(x + w / 2, y + (sub ? h / 2 - 2 : h / 2 + 4), title, { a: 'middle', w: 600, c: o.c || FG, s: o.ts || 12 }) + (sub ? T(x + w / 2, y + h / 2 + 12, sub, { a: 'middle', c: MUTED, s: 10.5 }) : '');
const MARKERS = [['l', LINE], ['c', ACC], ['m', AMB], ['g', GRN], ['f', FG], ['r', RED]];
const svg = (w, h, body, title) => `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(title)}" font-family="Barlow, 'Segoe UI', sans-serif"><defs>${MARKERS.map(([k, c]) => `<marker id="cnmk-${k}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${c}"/></marker>`).join('')}</defs>${body}</svg>`;
const chip = (x, y, w, v, label) => R(x, y, w, 20, { f: DARK, s: VCOL[v] }) + T(x + 6, y + 14, label, { s: 10.5, c: VCOL[v] });

/** @type {Record<string, () => string>} */
const ADD = {
  // ---------------- vue d'ensemble du réseau de contrôle ----------------
  'cn-plan'() {
    let b = node(190, 14, 160, 44, 'SW-CŒUR', 'niveau 3 · passerelles .1', { s: ACC });
    b += node(400, 14, 120, 44, 'Routeur', 'pare-feu → Internet');
    b += L(350, 36, 400, 36, { c: VCOL[10], w: 2 }) + T(375, 30, 'trunk', { a: 'middle', s: 9.5, c: MUTED });
    b += node(30, 120, 160, 44, 'SW-PROD', 'production · son · PoE') + node(350, 120, 160, 44, 'SW-VISION', 'vision · ralentis · PoE');
    b += L(230, 58, 130, 120, { c: ACC, w: 2.5 }) + L(310, 58, 430, 120, { c: ACC, w: 2.5 });
    b += T(150, 92, 'trunk 802.1Q · 1 Gb/s', { a: 'middle', s: 10.5, c: ACC }) + T(400, 92, 'trunk 802.1Q · 1 Gb/s', { a: 'middle', s: 10.5, c: ACC });
    b += T(270, 78, 'CCU, processeurs, EVS, matrice…', { a: 'middle', s: 10.5, c: MUTED });
    b += chip(20, 176, 82, 30, 'pupitre mél.') + chip(106, 176, 72, 50, 'intercom') + chip(182, 176, 76, 60, 'habillage');
    b += chip(340, 176, 52, 20, 'RCP') + chip(396, 176, 74, 40, 'IPDirector') + chip(474, 176, 56, 50, 'interc.');
    const legend = [[10, 'gestion'], [20, 'caméras'], [30, 'production'], [40, 'ralentis'], [50, 'intercom, son'], [60, 'fichiers'], [90, 'invités']];
    legend.forEach(([v, n], i) => { const x = 20 + (i % 4) * 128, y = 220 + Math.floor(i / 4) * 18; b += R(x, y - 9, 10, 10, { f: VCOL[v], s: VCOL[v], r: 2 }) + T(x + 16, y, `VLAN ${v} · ${n}`, { s: 10.5 }); });
    return svg(540, 262, b, 'Réseau de contrôle du car SDI : trois switchs, des VLAN par usage');
  },
  // ---------------- adresse MAC ----------------
  'cn-mac'() {
    const bytes = ['02', 'CA', '12', '4F', 'A0', '31'];
    let b = T(20, 24, 'Adresse MAC de la carte réseau (48 bits = 6 octets)', { w: 700 });
    bytes.forEach((x, i) => { const X = 40 + i * 78; b += R(X, 44, 66, 34, { f: i < 3 ? '#0f2a3a' : '#3a2a0a', s: i < 3 ? ACC : AMB }) + T(X + 33, 66, x, { a: 'middle', m: 1, s: 15, c: i < 3 ? ACC : AMB }); if (i < 5) b += T(X + 72, 66, ':', { a: 'middle', s: 15, c: MUTED }); });
    b += L(40, 90, 262, 90, { c: ACC, w: 2 }) + T(151, 108, 'fabricant (OUI)', { a: 'middle', c: ACC, s: 11.5 }) + L(274, 90, 496, 90, { c: AMB, w: 2 }) + T(385, 108, 'numéro de la carte', { a: 'middle', c: AMB, s: 11.5 });
    b += R(20, 128, 500, 58, { f: DARK }) + T(34, 150, 'Adresse IP 10.1.20.33 : choisie, elle suit le plan d\'adressage.', { s: 11.5 }) + T(34, 172, 'Adresse MAC : celle de la carte. Elle change seulement si on change la machine.', { s: 11.5, c: MUTED });
    return svg(540, 196, b, 'Structure d\'une adresse MAC');
  },
  // ---------------- ARP ----------------
  'cn-arp'() {
    let b = R(14, 14, 380, 160, { f: '#0f1d24', s: VCOL[20], d: true }) + T(24, 32, 'VLAN 20 · caméras', { c: VCOL[20], s: 11, w: 600 });
    b += node(30, 50, 110, 40, 'RCP 3', '10.1.20.33') + node(260, 50, 120, 40, 'CCU 3', '10.1.20.13', { s: GRN }) + node(260, 116, 120, 40, 'CCU 4', '10.1.20.14');
    b += L(140, 62, 258, 62, { c: AMB, w: 2, d: true, arrow: 'm' }) + L(140, 74, 258, 130, { c: AMB, w: 1.5, d: true, arrow: 'm' });
    b += T(150, 50, '« Qui a 10.1.20.13 ? »', { s: 11, c: AMB }) + T(150, 124, 'à tout le VLAN', { s: 10.5, c: MUTED });
    b += L(258, 84, 142, 84, { c: GRN, w: 2, arrow: 'g' }) + T(148, 100, '« C\'est moi : 02:CA:12:… »', { s: 11, c: GRN });
    b += node(408, 70, 120, 40, 'Mélangeur', 'VLAN 30', { c: MUTED }) + T(468, 128, 'autre VLAN :', { a: 'middle', s: 10.5, c: MUTED }) + T(468, 142, 'n\'entend pas la question', { a: 'middle', s: 10.5, c: MUTED });
    b += T(20, 196, 'La réponse donne la MAC : le RCP peut alors envoyer ses trames à la CCU 3.', { s: 11.5 });
    return svg(540, 206, b, 'ARP : trouver la MAC qui correspond à une adresse IP');
  },
  // ---------------- switch et routeur ----------------
  'cn-switch'() {
    let b = R(10, 10, 250, 170, { f: DARK }) + T(135, 30, 'Switch (niveau 2)', { a: 'middle', w: 700 }) + T(135, 46, 'un seul réseau · lit les adresses MAC', { a: 'middle', s: 10.5, c: MUTED });
    b += node(70, 60, 130, 34, 'SW-VISION', 'table MAC', { s: ACC });
    [['RCP 1', 30], ['RCP 2', 110], ['RCP 3', 190]].forEach(([n, x]) => { b += L(+x + 20, 132, 135, 94, { c: VCOL[20] }) + node(+x, 132, 50, 26, String(n), ''); });
    b += T(135, 172, 'trame → le bon port', { a: 'middle', s: 10.5, c: MUTED });
    b += R(280, 10, 250, 170, { f: DARK }) + T(405, 30, 'Routeur (niveau 3)', { a: 'middle', w: 700 }) + T(405, 46, 'entre réseaux · lit les adresses IP', { a: 'middle', s: 10.5, c: MUTED });
    b += node(345, 84, 120, 34, 'SW-CŒUR', 'route', { s: AMB });
    b += node(290, 136, 104, 30, '10.1.20.0/24', '') + node(416, 136, 104, 30, '10.1.30.0/24', '');
    b += L(342, 136, 380, 118, { c: VCOL[20], w: 2 }) + L(468, 136, 430, 118, { c: VCOL[30], w: 2 });
    b += T(405, 72, 'passerelles .1 de chaque VLAN', { a: 'middle', s: 10.5, c: AMB });
    b += T(270, 202, 'Un switch de niveau 3 fait les deux : il commute dans un VLAN et route entre les VLAN.', { a: 'middle', s: 11.5 });
    return svg(540, 212, b, 'Switch et routeur');
  },
  // ---------------- access et trunk ----------------
  'cn-trunk'() {
    let b = node(30, 70, 120, 40, 'SW-VISION', 'switch d\'accès') + node(390, 70, 120, 40, 'SW-CŒUR', 'cœur');
    b += L(150, 90, 390, 90, { c: ACC, w: 3 }) + T(270, 62, 'trunk 802.1Q (plusieurs VLAN)', { a: 'middle', s: 11, c: ACC });
    const fr = (x, v) => R(x, 82, 46, 16, { f: VCOL[v], s: VCOL[v], r: 2 }) + T(x + 23, 94, `VLAN ${v}`, { a: 'middle', s: 9.5, c: '#0b0e11', w: 700 });
    b += fr(180, 20) + fr(240, 40) + fr(300, 20);
    b += L(60, 110, 50, 150, { c: VCOL[20], w: 2 }) + L(120, 110, 130, 150, { c: VCOL[40], w: 2 });
    b += node(14, 150, 72, 28, 'RCP 1', '') + node(96, 150, 84, 28, 'IPDirector', '');
    b += T(14, 196, 'ports access : un VLAN chacun,', { s: 10.5, c: MUTED }) + T(14, 210, 'la machine ne le sait pas', { s: 10.5, c: MUTED });
    b += R(250, 130, 270, 64, { f: DARK }) + T(262, 150, 'Étiquette 802.1Q (4 octets) dans la trame :', { s: 11 });
    b += R(262, 160, 120, 22, { f: '#0f2a3a', s: ACC }) + T(322, 175, 'VLAN : 12 bits', { a: 'middle', s: 10.5, c: ACC }) + R(388, 160, 120, 22, { f: '#3a2a0a', s: AMB }) + T(448, 175, 'CoS : 3 bits', { a: 'middle', s: 10.5, c: AMB });
    return svg(540, 220, b, 'Ports access et trunk, étiquette 802.1Q');
  },
  // ---------------- QoS du car ----------------
  'cn-qos'() {
    let b = T(10, 20, 'Paquets qui arrivent', { c: MUTED, s: 11 });
    const inc = [[GRN, 'V'], [AMB, 'F'], [AMB, 'F'], [ACC, 'C'], [AMB, 'F'], [GRN, 'V']];
    inc.forEach(([c, n], i) => { b += R(10 + i * 22, 30, 18, 16, { f: c, s: c, r: 2 }) + T(19 + i * 22, 42, n, { a: 'middle', c: '#0b0e11', s: 10.5, w: 700 }); });
    b += L(142, 38, 152, 38, { arrow: 'l' }) + node(154, 18, 66, 40, 'CoS ?', 'classement');
    /** @type {[string, string, number][]} */
    const q = [[GRN, '1 · Voix : CoS 5 · DSCP 46 (EF)', 70], [ACC, '2 · Commande : CoS 4 · DSCP 32', 100], [MUTED, '3 · Gestion : CoS 2 · DSCP 16', 130], ['#7f8a93', '4 · Données : CoS 0 · DSCP 0', 160], [AMB, '5 · Fichiers : CoS 1 · DSCP 8', 190]];
    for (const [c, t, y] of q) b += L(220, 38, 230, y, { c, w: 1.2, arrow: 'l' }) + R(232, y - 11, 222, 22, { f: DARK, s: c }) + T(240, y + 4, t, { s: 10.5, c }) + L(454, y, 462, 128, { c, w: 1.2 });
    b += node(464, 108, 66, 40, 'Port', '1 Gb/s');
    b += T(10, 222, 'Lien plein : la file 1 passe d\'abord, les fichiers attendent. Sans QoS, tout le monde perd.', { s: 11 });
    return svg(540, 232, b, 'Classes de QoS du car : files d\'attente par priorité');
  },
  // ---------------- DHCP ----------------
  'cn-dhcp'() {
    const C = 110, Sx = 430;
    let b = T(C, 20, 'Portable invité', { a: 'middle', w: 700 }) + T(Sx, 20, 'Serveur DHCP (routeur)', { a: 'middle', w: 700 }) + L(C, 28, C, 196) + L(Sx, 28, Sx, 196);
    const msg = (y, dir, l, sub, c) => { const [x1, x2] = dir > 0 ? [C, Sx] : [Sx, C]; return L(x1, y, x2, y + 16, { c, w: 2, arrow: c === GRN ? 'g' : c === AMB ? 'm' : 'c' }) + T((C + Sx) / 2, y + 2, l, { a: 'middle', w: 600, c, s: 11.5 }) + T((C + Sx) / 2, y + 28, sub, { a: 'middle', s: 10.5, c: MUTED }); };
    b += msg(40, 1, '1 · Discover', 'y a-t-il un serveur DHCP ?', AMB) + msg(78, -1, '2 · Offer', 'je propose 10.1.90.131', ACC) + msg(116, 1, '3 · Request', 'je la prends', AMB) + msg(154, -1, '4 · Ack', 'masque /24, passerelle 10.1.90.1, bail', GRN);
    b += T(270, 216, 'Sans serveur dans le VLAN : adresse automatique 169.254.x.x, inutilisable.', { a: 'middle', s: 11 });
    return svg(540, 226, b, 'DHCP : obtenir son adresse en quatre messages');
  },
  // ---------------- câble RJ45 ----------------
  'cn-rj45'() {
    const pairs = [['#f08a24', '#f8d2a8'], ['#2fbf5a', '#bfe9cb'], ['#5ea8ff', '#cfe3ff'], ['#a0703c', '#dcc3a6']];
    let b = R(30, 30, 120, 90, { f: '#2a3036', s: '#8a949c', r: 6 }) + T(90, 22, 'Prise RJ45 (8 contacts)', { a: 'middle', s: 11 });
    const pin = ['#f8d2a8', '#f08a24', '#bfe9cb', '#5ea8ff', '#cfe3ff', '#2fbf5a', '#dcc3a6', '#a0703c'];
    pin.forEach((c, i) => { b += R(40 + i * 13, 40, 9, 30, { f: c, s: c, r: 1 }); });
    b += T(90, 92, 'T568B', { a: 'middle', s: 11, c: MUTED });
    pairs.forEach(([a, c2], i) => { const y = 40 + i * 22; b += `<path d="M180 ${y} C 230 ${y - 8}, 260 ${y + 8}, 310 ${y} S 390 ${y - 8}, 440 ${y}" stroke="${a}" stroke-width="3" fill="none"/>` + `<path d="M180 ${y} C 230 ${y + 8}, 260 ${y - 8}, 310 ${y} S 390 ${y + 8}, 440 ${y}" stroke="${c2}" stroke-width="3" fill="none"/>` + T(450, y + 4, `paire ${i + 1}`, { s: 10.5, c: MUTED }); });
    b += T(310, 132, '4 paires torsadées : en Gigabit, les 4 servent (4 × 250 Mb/s)', { a: 'middle', s: 11 });
    b += R(20, 148, 500, 50, { f: DARK }) + T(34, 168, 'Catégorie 6 · 1000BASE-T · 100 m au plus par lien, cordons compris', { s: 11.5 }) + T(34, 188, 'Une paire coupée : lien à 100 Mb/s, ou plus de lien. Au-delà de 100 m : fibre.', { s: 11, c: MUTED });
    return svg(540, 208, b, 'Câble RJ45 de catégorie 6 en Gigabit');
  },
  // ---------------- ping ----------------
  'cn-ping'() {
    let b = node(20, 30, 120, 40, 'RCP 1', '10.1.20.31') + node(400, 30, 120, 40, 'CCU 1', '10.1.20.11');
    b += L(140, 44, 398, 44, { c: AMB, w: 2, arrow: 'm' }) + T(270, 38, 'echo request (même VLAN : direct)', { a: 'middle', s: 11, c: AMB });
    b += L(398, 58, 142, 58, { c: GRN, w: 2, arrow: 'g' }) + T(270, 74, 'echo reply · temps < 1 ms', { a: 'middle', s: 11, c: GRN });
    b += node(20, 110, 120, 40, 'PC supervision', '10.1.10.50') + node(210, 110, 120, 40, 'Passerelle', '10.1.10.1 → .20.1', { s: ACC }) + node(400, 110, 120, 40, 'CCU 1', '10.1.20.11');
    b += L(140, 130, 208, 130, { c: AMB, w: 2, arrow: 'm' }) + L(330, 130, 398, 130, { c: AMB, w: 2, arrow: 'm' });
    b += T(270, 170, 'Autre VLAN : par la passerelle, et la réponse revient par celle de la CCU.', { a: 'middle', s: 11 });
    b += T(270, 190, 'Pas de réponse : « délai d\'attente dépassé », sans dire pourquoi.', { a: 'middle', s: 11, c: MUTED });
    return svg(540, 200, b, 'Ping : demande d\'écho et réponse');
  },
};
// identifiants des flèches propres à chaque schéma : plusieurs schémas peuvent être affichés ensemble (onglet Formation)
const uniq = (name, f) => () => f().replace(/cnmk-/g, `cnmk${name.replace(/[^a-z0-9]/gi, '')}-`);
for (const k of Object.keys(ADD)) ADD[k] = uniq(k, ADD[k]);
Object.assign(FIGS, ADD);

// schémas de l'onglet Formation (sans fiche propre : ils illustrent des fiches du lexique commun)
const LF = {
  // ---------------- adresse IP et masque, avec l'exemple du car ----------------
  ip() {
    const bits = (n) => n.toString(2).padStart(8, '0');
    const ip = [10, 1, 20, 33], mask = [255, 255, 255, 0];
    let b = T(20, 22, 'RCP 3 : 10.1.20.33 / 24 (masque 255.255.255.0)', { w: 700 });
    const lab = ['10 · 1 = le car', '', '20 = VLAN caméras', '33 = la machine'];
    const row = (vals, y, label) => { let s = T(20, y + 16, label, { c: MUTED, s: 11 }); vals.forEach((v, i) => { const x = 100 + i * 108; s += R(x, y, 100, 24, { f: i < 3 ? '#0f2a3a' : '#3a2a0a', s: i < 3 ? ACC : AMB }) + T(x + 50, y + 16, bits(v), { a: 'middle', m: 1, s: 12, c: i < 3 ? ACC : AMB }) + T(x + 50, y - 6, String(v), { a: 'middle', s: 11.5, w: 600 }); }); return s; };
    b += row(ip, 52, 'adresse') + row(mask, 110, 'masque');
    b += L(100, 146, 416, 146, { c: ACC, w: 2 }) + T(258, 162, 'réseau : 24 bits (les « 1 » du masque)', { a: 'middle', c: ACC, s: 11 }) + L(424, 146, 524, 146, { c: AMB, w: 2 }) + T(474, 162, 'machine : 8 bits', { a: 'middle', c: AMB, s: 11 });
    lab.forEach((t, i) => { if (t) b += T(i === 0 ? 154 : 150 + i * 108, 186, t, { a: 'middle', s: 10.5, c: MUTED }); });
    b += T(20, 210, 'Sous-réseau 10.1.20.0/24 : de 10.1.20.1 à 10.1.20.254 · passerelle 10.1.20.1', { s: 11.5 });
    return svg(540, 220, b, 'Adresse IP et masque : l\'exemple du RCP 3');
  },
  // ---------------- passerelle ----------------
  gw() {
    let b = R(10, 10, 250, 110, { f: '#0f1d24', s: VCOL[20], d: true }) + T(20, 28, 'VLAN 20 · 10.1.20.0/24', { s: 11, c: VCOL[20], w: 600 });
    b += node(24, 44, 96, 36, 'RCP 3', '.33') + node(150, 44, 96, 36, 'CCU 3', '.13');
    b += L(120, 62, 148, 62, { c: GRN, w: 2, arrow: 'g' }) + T(135, 100, '« chez moi » : direct', { a: 'middle', s: 10.5, c: GRN });
    b += R(280, 10, 250, 110, { f: '#1d1a10', s: VCOL[10], d: true }) + T(290, 28, 'VLAN 10 · 10.1.10.0/24', { s: 11, c: VCOL[10], w: 600 });
    b += node(300, 44, 130, 36, 'PC supervision', '.50');
    b += node(150, 150, 240, 40, 'SW-CŒUR (passerelles .1)', '10.1.10.1 · 10.1.20.1 · 10.1.30.1 …', { s: AMB });
    b += L(365, 80, 330, 148, { c: AMB, w: 2, arrow: 'm' }) + L(230, 148, 200, 82, { c: AMB, w: 2, arrow: 'm' });
    b += T(420, 112, 'pas « chez moi » :', { a: 'middle', s: 10.5, c: AMB }) + T(470, 140, 'à la passerelle', { a: 'middle', s: 10.5, c: AMB });
    b += T(270, 212, 'Dans son sous-réseau : en direct. Ailleurs : par sa passerelle.', { a: 'middle', s: 11.5 });
    return svg(540, 222, b, 'La passerelle : la porte de sortie du sous-réseau');
  },
  // ---------------- méthode de dépannage ----------------
  method() {
    const st = [['1', 'Câble et voyant', 'port allumé ? câble des deux côtés ? (couche 1)', AMB], ['2', 'VLAN du port', 'le port est-il dans le VLAN du plan ? (couche 2)', ACC], ['3', 'Adresse et masque', 'dans le bon sous-réseau ? pas de conflit ? (couche 3)', GRN], ['4', 'Passerelle', 'la .1 du VLAN ? ping d\'un autre VLAN', '#c77dff']];
    let b = '';
    st.forEach(([n, t, s, c], i) => { const y = 12 + i * 46; b += R(20, y, 500, 38, { f: DARK, s: c }) + T(40, y + 24, n, { w: 700, c, s: 14 }) + T(64, y + 17, t, { w: 600, s: 12.5 }) + T(64, y + 31, s, { s: 10.5, c: MUTED }); if (i < 3) b += L(30, y + 38, 30, y + 46, { c: MUTED, w: 1, arrow: 'l' }); });
    b += T(270, 206, 'On remonte les couches dans l\'ordre : inutile de chercher le masque si le câble est débranché.', { a: 'middle', s: 11 });
    return svg(540, 216, b, 'Méthode de dépannage : du câble à la passerelle');
  },
};
/** @type {Record<string, () => string>} */
export const LESSON_FIGS = Object.fromEntries(Object.entries(LF).map(([k, f]) => [k, uniq('f' + k, f)]));

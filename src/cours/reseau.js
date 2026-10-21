// @ts-check
import { el } from '../util.js';
import { registerChapter } from './index.js';
import { figure, sv, canvas, slider, choice, readout, fmtNum } from './kit.js';

// ----------------------------------------------------------------------------------
// Chapitre « Le réseau » : adresse IP et masque, VLAN et commutateur, table MAC, multicast et
// IGMP, PTP. Le plan d'adressage reprend celui du réseau de contrôle du car (net/ctrlnet.js) :
// 10.1.<VLAN>.x/24, passerelle en .1, CCU en .11 à .22, RCP en .31 à .42. Toutes les
// manipulations calculent vraiment (masques en bits, inondation, charge des liens, offset PTP)
// et se passent de la scène 3D.
// ----------------------------------------------------------------------------------
const C = { grey: '#8a949c', amber: '#ffd38a', red: '#ff8a80', green: '#7fd1a0', cyan: '#7fd3f3', box: '#1a2026', line: '#2a3238' };
/** touches « une seule allumée » d'un choice() : rallume la bonne après un changement venu d'ailleurs */
function pressed(box, v) { for (const b of box.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.v === v)); }
const txt = (x, y, s, cls = 'co-s', anchor = 'middle') => sv('text', { x, y, textAnchor: anchor, class: cls }, s);
const box = (x, y, w, h, stroke = C.grey, fill = C.box) => sv('rect', { x, y, width: w, height: h, rx: 3, fill, stroke, strokeWidth: 1.2 });

// ======================================================================================
// 1. Adresse IP et masque
// ======================================================================================
const ipParse = (s) => { const m = /^\s*(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\s*$/.exec(String(s)); if (!m) return null; const o = m.slice(1).map(Number); return o.some((x) => x > 255) ? null : ((o[0] << 24) | (o[1] << 16) | (o[2] << 8) | o[3]) >>> 0; };
const ipStr = (n) => `${n >>> 24}.${(n >>> 16) & 255}.${(n >>> 8) & 255}.${n & 255}`;
const maskOf = (p) => p <= 0 ? 0 : (0xffffffff << (32 - p)) >>> 0;
const netOf = (ip, p) => (ip & maskOf(p)) >>> 0;
const bcastOf = (ip, p) => (netOf(ip, p) | (~maskOf(p) >>> 0)) >>> 0;
/** les 32 bits d'une adresse : partie réseau en ambre, partie hôte en cyan ; les bits à 0 sont pâles */
function bitsRow(ip, p, y0 = 0) {
  const g = sv('g', { transform: `translate(0 ${y0})` });
  const cell = 14, gap = 8;
  for (let i = 0; i < 32; i++) {
    const x = 2 + i * cell + Math.floor(i / 8) * gap, bit = (ip >>> (31 - i)) & 1, net = i < p;
    g.append(sv('rect', { x, y: 2, width: cell - 1, height: 18, rx: 2, fill: net ? C.amber : C.cyan, opacity: bit ? 1 : 0.3 }));
    g.append(sv('text', { x: x + (cell - 1) / 2, y: 15.5, textAnchor: 'middle', class: 'co-bit' }, String(bit)));
  }
  for (let o = 0; o < 4; o++) g.append(txt(2 + o * (8 * cell + gap) + 4 * cell - 0.5, 34, String((ip >>> (24 - 8 * o)) & 255), 'co-m'));
  if (p > 0 && p < 32) { const x = 2 + p * cell + Math.floor(p / 8) * gap - (p % 8 === 0 ? gap / 2 : 0.5); g.append(sv('line', { x1: x, y1: -2, x2: x, y2: 24, stroke: '#fff', strokeWidth: 1.5 })); }
  return g;
}
const BITS_W = 32 * 14 + 3 * 8 + 4;
function figIp() {
  const f = figure(BITS_W, 128, 'L\'adresse 10.1.20.31 avec un masque /24 : les 24 premiers bits (ambre) désignent le réseau 10.1.20.0, les 8 derniers (cyan) l\'appareil n° 31 ; le masque 255.255.255.0 a des 1 sur la partie réseau');
  f.append(txt(2, 12, 'Adresse 10.1.20.31 /24', 'co-t', 'start'), txt(BITS_W - 2, 12, 'réseau (24 bits)  ·  appareil (8 bits)', 'co-s', 'end'));
  f.append(bitsRow(ipParse('10.1.20.31'), 24, 16));
  f.append(txt(2, 76, 'Masque 255.255.255.0 : des 1 sur la partie réseau, des 0 sur la partie appareil', 'co-s', 'start'));
  f.append(bitsRow(maskOf(24), 24, 80));
  return f;
}
const PRESETS = {
  ok: { l2: true, d: [['10.1.20.31', 24, '10.1.20.1'], ['10.1.20.11', 24, '10.1.20.1']] },
  vlan: { l2: false, d: [['10.1.20.31', 24, '10.1.20.1'], ['10.1.30.11', 24, '10.1.30.1']] },
  masque: { l2: false, d: [['10.1.20.31', 16, '10.1.20.1'], ['10.1.30.11', 24, '10.1.30.1']] },
  gw: { l2: false, d: [['10.1.20.31', 24, ''], ['10.1.30.11', 24, '10.1.30.1']] },
  conflit: { l2: true, d: [['10.1.20.11', 24, '10.1.20.1'], ['10.1.20.11', 24, '10.1.20.1']] },
  p2p: { l2: true, d: [['192.168.0.1', 30, ''], ['192.168.0.2', 30, '']] },
};
function demoIp(host) {
  const D = [{ name: 'RCP 1 (pupitre caméra, régie vision)', ip: '10.1.20.31', p: 24, gw: '10.1.20.1' }, { name: 'CCU 1 (voie caméra, baie technique)', ip: '10.1.20.11', p: 24, gw: '10.1.20.1' }];
  let l2 = true; // les deux appareils sont-ils sur le même VLAN (même réseau physique) ?
  const cards = D.map((d) => {
    const ipIn = /** @type {HTMLInputElement} */ (el('input', { type: 'text', value: d.ip, spellcheck: 'false', 'aria-label': `Adresse de ${d.name}` }));
    const gwIn = /** @type {HTMLInputElement} */ (el('input', { type: 'text', value: d.gw, spellcheck: 'false', placeholder: 'aucune', 'aria-label': `Passerelle de ${d.name}` }));
    ipIn.addEventListener('input', () => { d.ip = ipIn.value; update(); });
    gwIn.addEventListener('input', () => { d.gw = gwIn.value; update(); });
    const sl = slider('Masque', 8, 30, d.p, 1, (v) => { d.p = v; update(); }, (v) => `/${v} = ${ipStr(maskOf(v))}`);
    const bits = el('div', { class: 'co-bits' });
    const rd = readout(['Réseau', 'Adresse de diffusion', 'Adresses pour les appareils']);
    const node = el('div', { class: 'co-ipdev' }, el('b', {}, d.name), el('label', { class: 'co-field' }, el('span', {}, 'Adresse'), ipIn), sl, el('label', { class: 'co-field' }, el('span', {}, 'Passerelle'), gwIn), bits, rd.el);
    return { d, node, ipIn, gwIn, sl, bits, rd };
  });
  const read = readout(['RCP → CCU', 'CCU → RCP']);
  const verdict = el('p', { class: 'co-verdict' });
  /** comment a joint b, vu de a */
  const path = (a, b) => {
    if (a.ipN == null || b.ipN == null) return { ok: false, how: 'adresse invalide' };
    if (netOf(a.ipN, a.p) === netOf(b.ipN, a.p)) return l2 ? { ok: true, how: 'directement : même sous-réseau, trame envoyée à l\'adresse MAC du voisin (ARP)' } : { ok: false, how: 'croit le voisin dans son sous-réseau et l\'appelle en direct (ARP), mais il est sur un autre VLAN : personne ne répond' };
    if (a.gwN == null) return { ok: false, how: 'autre sous-réseau et pas de passerelle : la trame n\'a nulle part où aller' };
    if (netOf(a.gwN, a.p) !== netOf(a.ipN, a.p)) return { ok: false, how: `la passerelle ${a.gw} n'est pas dans son propre sous-réseau : injoignable` };
    return { ok: true, how: `par la passerelle ${a.gw} (le routeur fait suivre vers l'autre sous-réseau)` };
  };
  function update() {
    for (const c of cards) {
      const d = c.d; d.ipN = ipParse(d.ip); d.gwN = d.gw.trim() ? ipParse(d.gw) : null;
      c.ipIn.setAttribute('aria-invalid', String(d.ipN == null)); c.gwIn.setAttribute('aria-invalid', String(!!d.gw.trim() && d.gwN == null));
      if (d.ipN == null) { c.rd.set('Réseau', 'adresse invalide'); c.rd.set('Adresse de diffusion', '—'); c.rd.set('Adresses pour les appareils', '—'); c.bits.replaceChildren(); continue; }
      const n = netOf(d.ipN, d.p), b = bcastOf(d.ipN, d.p), hosts = 2 ** (32 - d.p) - 2;
      c.rd.set('Réseau', `${ipStr(n)}/${d.p}`); c.rd.set('Adresse de diffusion', ipStr(b));
      c.rd.set('Adresses pour les appareils', `${fmtNum(hosts)} (de ${ipStr(n + 1)} à ${ipStr(b - 1)})`);
      const f = figure(BITS_W, 40, `Les 32 bits de ${d.ip} : ${d.p} bits de réseau, ${32 - d.p} bits d'appareil`); f.append(bitsRow(d.ipN, d.p)); c.bits.replaceChildren(f);
    }
    const [a, b] = D; const ab = path(a, b), ba = path(b, a);
    read.set('RCP → CCU', ab.how); read.set('CCU → RCP', ba.how);
    let cls = 'ok', t = 'Oui : les deux appareils se parlent.';
    if (a.ipN != null && b.ipN != null && a.ipN === b.ipN) { cls = 'ko'; t = 'Non : conflit d\'adresses. Deux machines avec la même adresse se perturbent toutes les deux (le RCP et la CCU se répondent par intermittence).'; }
    else if (a.ipN != null && b.ipN != null && [a, b].some((d) => d.p < 31 && (d.ipN === netOf(d.ipN, d.p) || d.ipN === bcastOf(d.ipN, d.p)))) { cls = 'ko'; t = 'Non : une des adresses est l\'adresse du réseau ou de diffusion, elle ne peut pas être donnée à un appareil.'; }
    else if (!ab.ok || !ba.ok) { cls = 'ko'; t = 'Non : ' + (!ab.ok ? 'le RCP n\'atteint pas la CCU' : 'la CCU ne peut pas répondre au RCP') + '.'; }
    else if (ab.how !== ba.how) { cls = 'warn'; t = 'Oui, mais par un chemin bancal : l\'un croit l\'autre voisin, l\'autre passe par le routeur. Un masque faux finit toujours par faire une panne.'; }
    verdict.className = 'co-verdict ' + cls; verdict.textContent = 'Se parlent-ils ? ' + t;
  }
  const apply = (k) => { const P = PRESETS[k]; l2 = P.l2; pressed(l2c, l2 ? 'oui' : 'non'); cards.forEach((c, i) => { const [ip, p, gw] = P.d[i]; c.d.ip = ip; c.d.p = p; c.d.gw = gw; c.ipIn.value = ip; c.gwIn.value = gw; const inp = c.sl.querySelector('input'), out = c.sl.querySelector('output'); if (inp) inp.value = String(p); if (out) out.textContent = `/${p} = ${ipStr(maskOf(p))}`; }); update(); };
  const l2c = choice('Les deux appareils sont', [['oui', 'dans le même VLAN'], ['non', 'dans deux VLAN différents', 'Deux réseaux physiques séparés par le routeur du cœur']], 'oui', (v) => { l2 = v === 'oui'; update(); });
  host.append(
    el('div', { class: 'co-ctl' },
      choice('Situation', [['ok', 'Même sous-réseau'], ['vlan', 'Deux VLAN', 'RCP dans le VLAN 20, CCU dans le VLAN 30 : il faut la passerelle'], ['masque', 'Masque faux', 'Le RCP est en /16 : il croit la CCU voisine'], ['gw', 'Sans passerelle'], ['conflit', 'Conflit d\'adresses'], ['p2p', '/30 point à point']], 'ok', apply), l2c),
    el('div', { class: 'co-ipdevs' }, ...cards.map((c) => c.node)),
    read.el, verdict);
  update();
}

// ======================================================================================
// 2. VLAN et commutateur
// ======================================================================================
const VL = { 10: { name: 'Gestion', col: C.grey }, 20: { name: 'Caméras', col: C.amber }, 30: { name: 'Production', col: C.green }, 50: { name: 'Intercom et son', col: C.cyan } };
/** @type {[string, number][]} */
const PORTS0 = [['RCP 1', 20], ['CCU 1', 20], ['Pupitre mélangeur', 30], ['Processeur mélangeur', 30], ['Panneau intercom', 50], ['Matrice intercom', 50], ['PC supervision', 10], ['Vers SW-CŒUR', 0]];
function figVlan() {
  const f = figure(720, 140, 'Une trame Ethernet et son étiquette 802.1Q : entre l\'adresse MAC source et le type, 4 octets sont insérés : TPID 0x8100, priorité CoS sur 3 bits, drapeau DEI, numéro de VLAN sur 12 bits');
  /** @type {[string, string, number, boolean?][]} */
  const fields = [['Préambule', '8 octets', 72], ['MAC destination', '6 octets', 104], ['MAC source', '6 octets', 104], ['Étiquette 802.1Q', '4 octets', 118, true], ['Type', '2', 46], ['Données', '46 à 1 500 octets', 170], ['FCS', '4', 46]];
  let x = 10, tagX = 0;
  for (const [name, sub, w, tag] of fields) {
    f.append(sv('rect', { x, y: 24, width: w - 3, height: 30, rx: 2, fill: tag ? '#4a3a14' : C.box, stroke: tag ? C.amber : C.grey, strokeWidth: 1.2 }));
    f.append(txt(x + w / 2 - 1.5, 43, name, 'co-s')); f.append(txt(x + w / 2 - 1.5, 68, sub, 'co-m')); if (tag) tagX = x; x += w;
  }
  f.append(txt(360, 12, 'Trame Ethernet sur un port trunk : 4 octets de plus qu\'une trame ordinaire', 'co-t'));
  /** @type {[string, string, number][]} */
  const tag = [['TPID = 0x8100', '16 bits : « voici une étiquette VLAN »', 220], ['CoS', '3 bits : priorité 0 à 7', 110], ['DEI', '1 bit', 60], ['VID = numéro de VLAN', '12 bits : 1 à 4094', 200]];
  let tx = 60; const tagW = tag.reduce((a, t) => a + t[2], 0);
  f.append(sv('path', { d: `M${tagX + 2} 56 L${tx} 92 M${tagX + 115} 56 L${tx + tagW} 92`, fill: 'none', stroke: C.amber, strokeWidth: 1, strokeDasharray: '3 3' }));
  for (const [n, sub, w] of tag) { f.append(sv('rect', { x: tx, y: 92, width: w - 3, height: 22, rx: 2, fill: '#4a3a14', stroke: C.amber, strokeWidth: 1 })); f.append(txt(tx + w / 2 - 1.5, 107, n, 'co-s')); f.append(txt(tx + w / 2 - 1.5, 128, sub, 'co-bit2')); tx += w; }
  return f;
}
function demoVlan(host) {
  const ports = PORTS0.map(([dev, vlan]) => ({ dev, vlan }));
  let sel = 0, tag = 20, last = /** @type {null | { v: number, out: { i: number, tagged: boolean }[], no: number[] }} */ (null);
  const W = 700, H = 240, PX = (i) => 36 + i * 83;
  const svg = figure(W, H, 'Commutateur 8 ports : les appareils en haut, un port par appareil ; cliquez un port pour le choisir');
  const read = readout(['Trame envoyée', 'Elle sort par', 'Elle ne sort pas par', 'Domaine de diffusion']);
  const vlanC = choice('VLAN du port choisi', [...Object.keys(VL).map((k) => [k, `${k} ${VL[k].name}`]), ['0', 'Trunk 802.1Q', 'Lien vers un autre commutateur : tous les VLAN passent, chaque trame avec son étiquette']], '20', (v) => { ports[sel].vlan = +v; last = null; draw(); });
  const tagC = choice('Étiquette de la trame entrant par le trunk', Object.keys(VL).map((k) => [k, `VLAN ${k}`]), String(tag), (v) => { tag = +v; last = null; draw(); });
  const sendBtn = el('button', { class: 'btn small primary', onclick: () => { send(); } }, 'Envoyer une trame de diffusion');
  function send() {
    const src = ports[sel], v = src.vlan === 0 ? tag : src.vlan, out = [], no = [];
    ports.forEach((p, i) => { if (i === sel) return; if (p.vlan === v) out.push({ i, tagged: false }); else if (p.vlan === 0) out.push({ i, tagged: true }); else no.push(i); });
    last = { v, out, no }; draw();
  }
  function draw() {
    svg.replaceChildren(sv('title', {}, 'Commutateur 8 ports'));
    svg.append(box(14, 150, W - 28, 70, '#3a444c'), txt(W / 2, 214, 'SW-VISION · commutateur Gigabit administrable, 8 ports représentés', 'co-s'));
    ports.forEach((p, i) => {
      const x = PX(i), isTrunk = p.vlan === 0, col = isTrunk ? '#fff' : VL[p.vlan].col;
      const outP = last && last.out.find((o) => o.i === i), dim = last && last.no.includes(i), isSrc = last && i === sel;
      // l'appareil et son câble
      const dev = sv('g', { opacity: dim ? 0.35 : 1 });
      dev.append(box(x - 4, 14, 70, 44, col, isTrunk ? '#2a3238' : C.box));
      const words = p.dev.split(' '); dev.append(txt(x + 31, words.length > 1 ? 32 : 40, words[0], 'co-s')); if (words.length > 1) dev.append(txt(x + 31, 46, words.slice(1).join(' '), 'co-s'));
      dev.append(sv('line', { x1: x + 31, y1: 58, x2: x + 31, y2: 160, stroke: isSrc ? C.amber : outP ? C.green : col, strokeWidth: isSrc || outP ? 3 : 1.2, strokeDasharray: isTrunk ? '4 3' : 'none' }));
      if (isSrc) dev.append(txt(x + 31, 106, '▼ entre', 'co-m')); else if (outP) dev.append(txt(x + 31, 106, outP.tagged ? `▲ étiquette ${last.v}` : '▲ sort', 'co-m'));
      svg.append(dev);
      // le port, cliquable
      const g = sv('g', { class: 'co-port', tabindex: '0', role: 'button', 'aria-label': `Port ${i + 1}, ${isTrunk ? 'trunk' : 'VLAN ' + p.vlan}${i === sel ? ', choisi' : ''}` });
      g.append(sv('rect', { x, y: 160, width: 62, height: 40, rx: 3, fill: isSrc ? '#4a3a14' : outP ? '#1c3a2a' : '#0b0e10', stroke: i === sel ? '#fff' : col, strokeWidth: i === sel ? 2.5 : 1.5 }));
      g.append(txt(x + 31, 176, `Port ${i + 1}`, 'co-s')); g.append(txt(x + 31, 192, isTrunk ? 'trunk' : `VLAN ${p.vlan}`, 'co-m'));
      const pick = () => { sel = i; last = null; pressed(vlanC, String(ports[sel].vlan)); draw(); };
      g.addEventListener('click', pick); g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
      svg.append(g);
    });
    tagC.hidden = ports[sel].vlan !== 0;
    sendBtn.textContent = `Envoyer une trame de diffusion depuis le port ${sel + 1} (${ports[sel].dev})`;
    if (!last) { read.set('Trame envoyée', 'aucune : choisissez un port puis envoyez'); read.set('Elle sort par', '—'); read.set('Elle ne sort pas par', '—'); read.set('Domaine de diffusion', '—'); return; }
    const name = (i) => `port ${i + 1} (${ports[i].dev})`;
    read.set('Trame envoyée', `diffusion (par exemple une requête ARP) entrée par le port ${sel + 1}, ${ports[sel].vlan === 0 ? `avec l'étiquette VLAN ${last.v}` : `port access du VLAN ${last.v} : le commutateur la range dans le VLAN ${last.v}`}`);
    read.set('Elle sort par', last.out.length ? last.out.map((o) => `${name(o.i)}${o.tagged ? `, avec l'étiquette 802.1Q « VLAN ${last.v} »` : ', sans étiquette'}`).join(' · ') : 'aucun port : personne d\'autre dans ce VLAN');
    read.set('Elle ne sort pas par', last.no.length ? last.no.map(name).join(' · ') + ' : autre VLAN' : '—');
    const n = ports.filter((p) => p.vlan === last.v).length;
    read.set('Domaine de diffusion', `${n} port${n > 1 ? 's' : ''} du VLAN ${last.v} sur ce commutateur, plus les ports du même VLAN sur les commutateurs reliés par le trunk`);
  }
  host.append(el('div', { class: 'co-ctl' }, vlanC, tagC), svg, el('div', { class: 'co-btns' }, sendBtn), read.el);
  draw();
}

// ======================================================================================
// 3. Comment un commutateur apprend (table MAC)
// ======================================================================================
const HOSTS = [
  { id: 'rcp1', name: 'RCP 1', mac: '02:1A:20:00:00:31', ip: '10.1.20.31', port: 1 },
  { id: 'ccu1', name: 'CCU 1', mac: '02:1A:20:00:00:11', ip: '10.1.20.11', port: 2 },
  { id: 'rcp2', name: 'RCP 2', mac: '02:1A:20:00:00:32', ip: '10.1.20.32', port: 3 },
  { id: 'ccu2', name: 'CCU 2', mac: '02:1A:20:00:00:12', ip: '10.1.20.12', port: 4 },
];
function figMac() {
  const f = figure(720, 150, 'Deux adresses pour un même appareil : l\'adresse MAC, gravée dans la carte réseau, sert dans le réseau local ; l\'adresse IP, configurée, sert de bout en bout. Le paquet IP voyage dans une trame Ethernet, comme une lettre dans une enveloppe');
  f.append(txt(360, 14, 'Le paquet IP voyage dans une trame Ethernet', 'co-t'));
  f.append(box(20, 26, 680, 110, C.grey), txt(32, 44, 'Trame Ethernet (niveau 2) : MAC destination · MAC source · type', 'co-s', 'start'));
  f.append(txt(32, 60, 'de 02:1A:20:00:00:31 (RCP 1) vers 02:1A:20:00:00:11 (CCU 1) — change à chaque routeur traversé', 'co-m', 'start'));
  f.append(box(60, 70, 600, 56, C.cyan), txt(72, 88, 'Paquet IP (niveau 3) : IP destination · IP source · données', 'co-s', 'start'));
  f.append(txt(72, 104, 'de 10.1.20.31 vers 10.1.20.11 — reste le même de bout en bout', 'co-m', 'start'));
  f.append(txt(72, 120, 'Le commutateur ne lit que l\'enveloppe (MAC). Le routeur ouvre l\'enveloppe et lit l\'adresse IP.', 'co-s', 'start'));
  return f;
}
function demoMac(host) {
  const table = /** @type {Record<string, { port: number, step: number }>} */ ({});
  const arp = /** @type {Record<string, boolean>} */ ({}); // cache ARP : « a connaît la MAC de b »
  const queue = /** @type {{ from: typeof HOSTS[0], to: typeof HOSTS[0] | null, what: string }[]} */ ([]);
  const journal = [];
  let step = 0, last = /** @type {null | { from: typeof HOSTS[0], to: typeof HOSTS[0] | null, outs: number[], flood: boolean, learned: boolean }} */ (null);
  const W = 640, H = 230, PX = (p) => 70 + (p - 1) * 150;
  const svg = figure(W, H, 'Un commutateur 4 ports et quatre appareils : la trame entre par un port, le commutateur apprend l\'adresse source et décide où recopier la trame');
  const tbl = el('table', { class: 'co-table', 'aria-label': 'Table MAC du commutateur' });
  const jl = el('ol', { class: 'co-journal' });
  const read = readout(['Trames en attente', 'Entrées dans la table']);
  const byId = (id) => HOSTS.find((h) => h.id === id);
  function plan(aId, bId, what) {
    const a = byId(aId), b = byId(bId);
    if (!arp[a.id + '>' + b.id]) { queue.push({ from: a, to: null, what: `requête ARP « qui a ${b.ip} ? »` }); queue.push({ from: b, to: a, what: `réponse ARP « c'est moi, ${b.mac} »` }); }
    queue.push({ from: a, to: b, what }); queue.push({ from: b, to: a, what: 'acquittement' });
    draw();
  }
  function next() {
    const fr = queue.shift(); if (!fr) return;
    step++;
    const learned = !table[fr.from.mac]; table[fr.from.mac] = { port: fr.from.port, step };
    let outs, flood = false;
    if (!fr.to) { outs = HOSTS.filter((h) => h !== fr.from).map((h) => h.port); flood = true; }
    else if (table[fr.to.mac]) outs = [table[fr.to.mac].port];
    else { outs = HOSTS.filter((h) => h !== fr.from).map((h) => h.port); flood = true; }
    if (fr.to && /réponse ARP/.test(fr.what)) arp[fr.to.id + '>' + fr.from.id] = true;
    last = { from: fr.from, to: fr.to, outs, flood, learned };
    journal.push(`${step}. ${fr.from.name} → ${fr.to ? fr.to.name : 'tous (FF:FF:FF:FF:FF:FF)'} : ${fr.what}. ` + (learned ? `Le commutateur apprend « ${fr.from.mac} → port ${fr.from.port} ». ` : '') + (!fr.to ? 'Diffusion : recopiée sur tous les autres ports.' : flood ? `Destination ${fr.to.mac} inconnue : inondation sur tous les autres ports.` : `Destination connue : envoyée sur le port ${outs[0]} seulement.`));
    draw();
  }
  function flush() { for (const k in table) delete table[k]; for (const k in arp) delete arp[k]; last = null; journal.push(`${++step}. Cinq minutes sans trafic : les entrées ont vieilli, la table est vide. Les caches ARP des machines ont expiré aussi.`); draw(); }
  function draw() {
    svg.replaceChildren(sv('title', {}, 'Commutateur 4 ports'));
    svg.append(box(14, 130, W - 28, 70, '#3a444c'), txt(W / 2, 194, 'SW-CŒUR · le commutateur ne connaît que des adresses MAC et des numéros de port', 'co-s'));
    for (const h of HOSTS) {
      const x = PX(h.port), isSrc = last && last.from === h, isOut = last && last.outs.includes(h.port), isDst = last && last.to === h;
      svg.append(box(x - 50, 10, 100, 48, isSrc ? C.amber : isDst ? C.green : C.grey));
      svg.append(txt(x, 28, h.name, 'co-s'), txt(x, 42, h.mac, 'co-m'), txt(x, 54, h.ip, 'co-bit2'));
      svg.append(sv('line', { x1: x, y1: 58, x2: x, y2: 140, stroke: isSrc ? C.amber : isOut ? (last.flood && !isDst ? '#c98f60' : C.green) : '#3a444c', strokeWidth: isSrc || isOut ? 3 : 1.2 }));
      if (isSrc) svg.append(txt(x + 6, 100, '▼ entre', 'co-m', 'start')); else if (isOut) svg.append(txt(x + 6, 100, isDst ? '▲ pour lui' : last.flood ? '▲ copie inutile' : '▲ sort', 'co-m', 'start'));
      svg.append(sv('rect', { x: x - 28, y: 140, width: 56, height: 34, rx: 3, fill: isSrc ? '#4a3a14' : isOut ? '#1c3a2a' : '#0b0e10', stroke: isSrc ? C.amber : isOut ? C.green : C.grey, strokeWidth: 1.5 }), txt(x, 162, `Port ${h.port}`, 'co-s'));
    }
    const rows = Object.entries(table).sort((a, b) => a[1].port - b[1].port);
    tbl.replaceChildren(el('thead', {}, el('tr', {}, el('th', {}, 'Adresse MAC'), el('th', {}, 'Port'), el('th', {}, 'Apprise à l\'étape'))),
      el('tbody', {}, ...(rows.length ? rows.map(([mac, e]) => el('tr', {}, el('td', {}, mac), el('td', {}, String(e.port)), el('td', {}, String(e.step)))) : [el('tr', {}, el('td', { colspan: 3 }, 'vide : le commutateur ne sait encore rien'))])));
    jl.replaceChildren(...journal.slice(-5).map((t) => el('li', {}, t)));
    read.set('Trames en attente', queue.length ? `${queue.length} — ${queue[0].from.name} → ${queue[0].to ? queue[0].to.name : 'tous'} : ${queue[0].what}` : 'aucune : lancez un échange');
    read.set('Entrées dans la table', `${rows.length} sur 4 appareils (une table réelle en tient des milliers ; chaque entrée est oubliée après 300 s sans trafic)`);
    nextBtn.disabled = !queue.length;
  }
  const nextBtn = el('button', { class: 'btn small primary', onclick: () => next() }, 'Trame suivante ▶');
  host.append(
    el('div', { class: 'co-btns' },
      el('button', { class: 'btn small', onclick: () => plan('rcp1', 'ccu1', 'réglage d\'iris') }, 'RCP 1 règle la CCU 1'),
      el('button', { class: 'btn small', onclick: () => plan('rcp2', 'ccu2', 'réglage de noir') }, 'RCP 2 règle la CCU 2'),
      el('button', { class: 'btn small', onclick: () => plan('ccu1', 'rcp1', 'retour d\'état (tally, température)') }, 'CCU 1 → RCP 1'),
      nextBtn, el('button', { class: 'btn small', onclick: () => flush() }, 'Cinq minutes passent (vieillissement)')),
    svg, el('div', { class: 'co-2' }, el('div', {}, el('h5', { class: 'co-h5' }, 'Table MAC du commutateur'), tbl), el('div', {}, el('h5', { class: 'co-h5' }, 'Journal'), jl)), read.el);
  draw();
}

// ======================================================================================
// 4. Multicast et IGMP
// ======================================================================================
const RX = [
  { id: 'mel', name: 'Mélangeur', cap: 25, wants: (n) => n },
  { id: 'mv', name: 'Multiview', cap: 25, wants: (n) => n },
  { id: 'evs', name: 'Serveur EVS (4 entrées)', cap: 25, wants: (n) => Math.min(n, 4) },
  { id: 'mon', name: 'Moniteur vision', cap: 10, wants: () => 1 },
  { id: 'prism', name: 'PRISM (mesure)', cap: 10, wants: () => 1 },
];
function figMcast() {
  const f = figure(720, 170, 'Unicast : la caméra envoie une copie du flux par destinataire, son lien se remplit N fois. Multicast : elle envoie une seule copie à un groupe 239.x.x.x, le commutateur la recopie vers les ports abonnés (IGMP)');
  const half = (x0, title, mcast) => {
    f.append(txt(x0 + 170, 14, title, 'co-t'));
    f.append(box(x0 + 10, 60, 70, 36, C.amber), txt(x0 + 45, 76, 'Caméra', 'co-s'), txt(x0 + 45, 90, mcast ? '→ 239.1.1.1' : '3 copies', 'co-m'));
    f.append(box(x0 + 140, 50, 60, 56, C.grey), txt(x0 + 170, 74, 'Leaf', 'co-s'), txt(x0 + 170, 90, mcast ? 'IGMP' : '', 'co-m'));
    const dst = ['Mélangeur', 'Multiview', 'Moniteur'];
    dst.forEach((d, i) => { const y = 30 + i * 46; f.append(box(x0 + 260, y, 80, 30, C.cyan), txt(x0 + 300, y + 19, d, 'co-s')); f.append(sv('line', { x1: x0 + 200, y1: 78, x2: x0 + 260, y2: y + 15, stroke: C.green, strokeWidth: 2 })); });
    for (let i = 0; i < (mcast ? 1 : 3); i++) f.append(sv('line', { x1: x0 + 80, y1: 78 + (mcast ? 0 : (i - 1) * 7), x2: x0 + 140, y2: 78 + (mcast ? 0 : (i - 1) * 7), stroke: mcast ? C.green : C.red, strokeWidth: 2 }));
    f.append(txt(x0 + 110, 125, mcast ? '1 × 2,2 Gb/s' : '3 × 2,2 = 6,6 Gb/s', 'co-m'));
    f.append(txt(x0 + 170, 160, mcast ? 'une copie, recopiée là où on l\'a demandée' : 'la caméra doit connaître chaque destinataire', 'co-s'));
  };
  half(0, 'Unicast', false); half(360, 'Multicast (ST 2110)', true);
  f.append(sv('line', { x1: 360, y1: 20, x2: 360, y2: 165, stroke: C.line, strokeWidth: 1 }));
  return f;
}
function demoMcast(host) {
  let mode = 'snoop', n = 4, rate = 2.2;
  const on = /** @type {Record<string, boolean>} */ ({ mel: true, mv: true, evs: true, mon: true, prism: false });
  const W = 720, H = 300;
  const svg = figure(W, H, 'Caméras à gauche, deux commutateurs leaf, récepteurs à droite : la couleur de chaque lien dit sa charge (vert, ambre, rouge saturé). Cliquez un récepteur pour l\'abonner ou le désabonner');
  // le schéma contient des touches (les récepteurs) : c'est un groupe, pas une image
  svg.setAttribute('role', 'group');
  const read = readout(['Lien de la caméra 1 (25 Gb/s)', 'Lien entre les deux leaves (100 Gb/s)', 'Port du moniteur vision (10 Gb/s)', 'Abonnement du moniteur']);
  const verdict = el('p', { class: 'co-verdict' });
  const col = (load, cap) => load > cap ? C.red : load > 0.6 * cap ? C.amber : load > 0 ? C.green : '#3a444c';
  const width = (load, cap) => 1.5 + 6 * Math.min(1, load / cap);
  function loads() {
    const srcUp = [], srcDown = []; let trunk = 0;
    for (let i = 1; i <= n; i++) {
      const subs = RX.filter((r) => on[r.id] && i <= r.wants(n)).length;
      srcUp.push(mode === 'unicast' ? subs * rate : rate);
      srcDown.push(mode === 'flood' ? (n - 1) * rate : 0);
      trunk += mode === 'unicast' ? subs * rate : mode === 'snoop' ? (subs ? rate : 0) : rate;
    }
    const rx = RX.map((r) => mode === 'flood' ? n * rate : on[r.id] ? r.wants(n) * rate : 0);
    return { srcUp, srcDown, trunk, rx };
  }
  function draw() {
    const L = loads();
    svg.replaceChildren(sv('title', {}, 'Topologie et charge des liens'));
    const lx = 220, rx = 440, ly = 40, lh = 220;
    svg.append(box(lx, ly, 60, lh, C.grey), txt(lx + 30, ly + lh + 14, 'Leaf A · caméras', 'co-s'));
    svg.append(box(rx, ly, 60, lh, C.grey), txt(rx + 30, ly + lh + 14, 'Leaf B · production', 'co-s'));
    if (mode !== 'unicast') { svg.append(txt(lx + 30, ly + lh + 28, mode === 'snoop' ? 'IGMP snooping' : 'sans snooping', 'co-m'), txt(rx + 30, ly + lh + 28, mode === 'snoop' ? 'IGMP snooping' : 'sans snooping', 'co-m')); }
    // caméras
    const step = Math.min(22, (lh - 10) / n);
    for (let i = 0; i < n; i++) {
      const y = ly + 12 + i * step + step / 2, up = L.srcUp[i], down = L.srcDown[i], worst = Math.max(up, down);
      svg.append(sv('rect', { x: 30, y: y - Math.min(9, step / 2 - 1), width: 80, height: Math.min(18, step - 2), rx: 2, fill: C.box, stroke: C.amber, strokeWidth: 1 }));
      if (step >= 14) svg.append(txt(70, y + 4, `Cam ${i + 1} · 239.1.1.${i + 1}`, 'co-bit2'));
      svg.append(sv('line', { x1: 110, y1: y, x2: lx, y2: y, stroke: col(worst, 25), strokeWidth: width(worst, 25) }));
      if (i === 0) svg.append(txt(165, y - 7, `↑ ${fmtNum(up, 1)}${down ? ` · ↓ ${fmtNum(down, 1)}` : ''} Gb/s`, 'co-bit2'));
    }
    // lien entre les leaves
    svg.append(sv('line', { x1: lx + 60, y1: ly + lh / 2, x2: rx, y2: ly + lh / 2, stroke: col(L.trunk, 100), strokeWidth: width(L.trunk, 100) * 1.3 }));
    svg.append(txt((lx + 60 + rx) / 2, ly + lh / 2 - 10, `${fmtNum(L.trunk, 1)} / 100 Gb/s`, 'co-m'), txt((lx + 60 + rx) / 2, ly + lh / 2 + 18, mode === 'unicast' ? 'une copie par destinataire' : mode === 'snoop' ? 'une copie par flux demandé' : 'tous les flux, demandés ou non', 'co-bit2'));
    // récepteurs, cliquables
    RX.forEach((r, k) => {
      const y = ly + 24 + k * 44, load = L.rx[k];
      svg.append(sv('line', { x1: rx + 60, y1: y, x2: 560, y2: y, stroke: col(load, r.cap), strokeWidth: width(load, r.cap) }));
      svg.append(txt(505, y - 6, `${fmtNum(load, 1)} / ${r.cap}`, 'co-m'));
      const g = sv('g', { class: 'co-port', tabindex: '0', role: 'button', 'aria-pressed': String(on[r.id]) }); // nom : le texte affiché (récepteur, abonnement)
      g.append(sv('rect', { x: 560, y: y - 17, width: 150, height: 34, rx: 3, fill: on[r.id] ? '#1c3a2a' : C.box, stroke: on[r.id] ? C.green : C.grey, strokeWidth: 1.5 }));
      g.append(txt(635, y - 3, r.name, 'co-s'), txt(635, y + 11, on[r.id] ? `IGMP join · ${r.wants(n)} flux` : 'pas abonné', 'co-m'));
      const toggle = () => { on[r.id] = !on[r.id]; draw(); };
      g.addEventListener('click', toggle); g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
      svg.append(g);
    });
    const sat = [];
    L.srcUp.forEach((u, i) => { if (Math.max(u, L.srcDown[i]) > 25) sat.push(`lien de la caméra ${i + 1}`); });
    if (L.trunk > 100) sat.push('lien entre les leaves');
    RX.forEach((r, k) => { if (L.rx[k] > r.cap) sat.push(`port « ${r.name} »`); });
    read.set('Lien de la caméra 1 (25 Gb/s)', `${fmtNum(L.srcUp[0], 1)} Gb/s montants${L.srcDown[0] ? ` et ${fmtNum(L.srcDown[0], 1)} Gb/s descendants (les autres caméras lui arrivent dessus)` : ''} — ${mode === 'unicast' ? `${Math.round(L.srcUp[0] / rate)} copie(s) du même flux` : 'une seule copie'}`);
    read.set('Lien entre les deux leaves (100 Gb/s)', `${fmtNum(L.trunk, 1)} Gb/s`);
    read.set('Port du moniteur vision (10 Gb/s)', `${fmtNum(L.rx[3], 1)} Gb/s${mode === 'flood' ? ' : il reçoit tout, abonné ou pas' : ''}`);
    read.set('Abonnement du moniteur', on.mon ? `IGMPv3 join (S = 10.20.1.21, G = 239.1.1.1) : « la caméra 1, et seulement elle »` : 'aucun (IGMP leave envoyé)');
    const uni = mode === 'unicast' && n * (on.mel ? 1 : 0) > 0;
    verdict.className = 'co-verdict ' + (sat.length ? 'ko' : 'ok');
    verdict.textContent = sat.length ? `Saturé : ${[...new Set(sat)].slice(0, 4).join(', ')}${sat.length > 4 ? '…' : ''}. Tous les flux qui passent par un lien saturé perdent des paquets.` : `Tous les liens tiennent.${uni ? ' Mais chaque caméra doit connaître la liste de ses destinataires : au premier changement de configuration, tout est à refaire.' : mode === 'flood' ? ' Pour l\'instant : augmentez le nombre de caméras.' : ''}`;
  }
  host.append(
    el('div', { class: 'co-ctl' },
      choice('Transport', [['unicast', 'Unicast', 'Une copie par destinataire'], ['flood', 'Multicast sans snooping', 'Le commutateur traite le multicast comme de la diffusion'], ['snoop', 'Multicast + IGMP snooping', 'Le commutateur ne recopie que vers les ports abonnés']], mode, (v) => { mode = v; draw(); }),
      slider('Caméras (sources ST 2110-20)', 1, 12, n, 1, (v) => { n = v; draw(); }),
      choice('Format', [['1.1', '1080i50 ≈ 1,1 Gb/s'], ['2.2', '1080p50 ≈ 2,2 Gb/s'], ['8.6', '2160p50 ≈ 8,6 Gb/s']], '2.2', (v) => { rate = +v; draw(); })),
    svg, read.el, verdict);
  draw();
}

// ======================================================================================
// 5. PTP
// ======================================================================================
function figPtp() {
  const f = figure(720, 200, 'Les quatre messages PTP entre le maître et l\'esclave : Sync (horodaté t1 au départ, t2 à l\'arrivée), Follow_Up qui transporte t1, Delay_Req (t3 au départ, t4 à l\'arrivée) et Delay_Resp qui transporte t4 ; l\'esclave calcule le délai moyen et son décalage');
  const yM = 40, yS = 130, x0 = 60, x1 = 440;
  f.append(sv('line', { x1: x0, y1: yM, x2: x1, y2: yM, stroke: C.amber, strokeWidth: 2 }), sv('line', { x1: x0, y1: yS, x2: x1, y2: yS, stroke: C.cyan, strokeWidth: 2 }));
  f.append(txt(x0 - 8, yM + 4, 'Maître', 'co-t', 'end'), txt(x0 - 8, yS + 4, 'Esclave', 'co-t', 'end'), txt((x0 + x1) / 2, 180, 'le temps s\'écoule vers la droite →', 'co-s'));
  const arrow = (xa, ya, xb, yb, label, colr) => { f.append(sv('line', { x1: xa, y1: ya, x2: xb, y2: yb, stroke: colr, strokeWidth: 1.5, 'marker-end': 'url(#co-arr)' })); f.append(txt((xa + xb) / 2 + 10, (ya + yb) / 2 + 4, label, 'co-s', 'start')); };
  const defs = sv('defs'); const mk = sv('marker', { id: 'co-arr', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }); mk.append(sv('path', { d: 'M0 0 L10 5 L0 10 z', fill: C.grey })); defs.append(mk); f.append(defs);
  arrow(100, yM, 160, yS, 'Sync', C.grey); arrow(140, yM, 200, yS, 'Follow_Up (t1)', C.grey); arrow(240, yS, 300, yM, 'Delay_Req', C.grey); arrow(330, yM, 390, yS, 'Delay_Resp (t4)', C.grey);
  const dot = (x, y, l) => { f.append(sv('circle', { cx: x, cy: y, r: 4, fill: '#fff' })); f.append(txt(x, y < 100 ? y - 10 : y + 18, l, 'co-m')); };
  dot(100, yM, 't1'); dot(160, yS, 't2'); dot(240, yS, 't3'); dot(300, yM, 't4');
  f.append(txt(470, 60, 'délai moyen = ((t2 − t1) + (t4 − t3)) / 2', 'co-m', 'start'), txt(470, 84, 'décalage = (t2 − t1) − délai moyen', 'co-m', 'start'));
  f.append(txt(470, 112, 'Vrai si le trajet est symétrique :', 'co-s', 'start'), txt(470, 128, 'même temps à l\'aller et au retour.', 'co-s', 'start'));
  f.append(txt(470, 152, 'Toute asymétrie a devient', 'co-s', 'start'), txt(470, 168, 'une erreur de décalage de a / 2.', 'co-s', 'start'));
  return f;
}
function demoPtp(host) {
  let bc = true, load = 30, asym = 0;
  const FRAME_NS = 1200, CABLE = 500, N = 120; // une trame de 1 500 octets à 10 Gb/s ; 100 m de fibre
  const hist = { a: /** @type {number[]} */ ([]), b: /** @type {number[]} */ ([]) };
  const W = 640, H = 170;
  const chart = canvas(W, H, 'co-canvas co-chart'); const g = chart.getContext('2d');
  const read = readout(['Dernier échange (mélangeur)', 'Délai moyen calculé', 'Décalage calculé = erreur injectée', 'Écart mélangeur / caméra', 'État']);
  const queue = () => { if (bc) return 0; let k = 0; while (Math.random() < load / 100 && k < 24) k++; return k * FRAME_NS; };
  const noise = () => (Math.random() - 0.5) * 30; // horodatage matériel : ± 15 ns
  // l'esclave est déjà à l'heure (décalage vrai 0) : ce qu'il calcule est l'erreur qu'il va s'injecter
  function exchange() {
    const q1 = queue(), q2 = queue(), t1 = 0, t2 = t1 + CABLE + asym / 2 + q1, t3 = t2 + 20000, t4 = t3 + CABLE - asym / 2 + q2;
    const delay = ((t2 - t1) + (t4 - t3)) / 2, offset = (t2 - t1) - delay + noise();
    return { t1, t2, t3, t4, delay, offset };
  }
  const ns = (v) => Math.abs(v) >= 1000 ? `${fmtNum(v / 1000, 2)} µs` : `${fmtNum(v)} ns`;
  function tick() {
    const A = exchange(), B = exchange();
    hist.a.push(A.offset); hist.b.push(B.offset); if (hist.a.length > N) { hist.a.shift(); hist.b.shift(); }
    read.set('Dernier échange (mélangeur)', `t2 − t1 = ${ns(A.t2 - A.t1)} (aller) · t4 − t3 = ${ns(A.t4 - A.t3)} (retour)`);
    read.set('Délai moyen calculé', `${ns(A.delay)} (câble réel : ${ns(CABLE)})`);
    read.set('Décalage calculé = erreur injectée', ns(A.offset));
    read.set('Écart mélangeur / caméra', ns(Math.abs(A.offset - B.offset)));
    const worst = Math.max(...hist.a.slice(-20).map(Math.abs), ...hist.b.slice(-20).map(Math.abs));
    read.set('État', worst < 100 ? 'verrouillé : erreur < 100 ns, précision attendue en broadcast' : worst < 1000 ? 'verrouillé mais dégradé : erreur entre 100 ns et 1 µs' : 'hors tolérance : erreur > 1 µs, les images des appareils ne sont plus alignées (commutations sales, alarmes PTP)');
    // tracé
    const maxAbs = Math.max(1500, ...hist.a.map(Math.abs), ...hist.b.map(Math.abs)) * 1.15;
    g.fillStyle = '#0b0e10'; g.fillRect(0, 0, W, H);
    const y = (v) => H / 2 - v / maxAbs * (H / 2 - 6);
    g.strokeStyle = '#3a444c'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, y(0)); g.lineTo(W, y(0)); g.stroke();
    g.strokeStyle = C.red; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(0, y(1000)); g.lineTo(W, y(1000)); g.moveTo(0, y(-1000)); g.lineTo(W, y(-1000)); g.stroke(); g.setLineDash([]);
    g.fillStyle = C.red; g.font = '11px monospace'; g.fillText('+1 µs', 4, y(1000) - 3); g.fillText('−1 µs', 4, y(-1000) + 12);
    g.fillStyle = C.grey; g.fillText(`échelle ± ${ns(maxAbs)}`, W - 120, 12);
    const trace = (arr, colr) => { g.strokeStyle = colr; g.lineWidth = 1.5; g.beginPath(); arr.forEach((v, i) => { const x = W - (arr.length - 1 - i) * (W / N); i ? g.lineTo(x, y(v)) : g.moveTo(x, y(v)); }); g.stroke(); };
    trace(hist.a, C.amber); trace(hist.b, C.cyan);
    g.fillStyle = C.amber; g.fillText('■ mélangeur', 4, H - 6); g.fillStyle = C.cyan; g.fillText('■ caméra IP', 90, H - 6);
  }
  const id = setInterval(tick, 250);
  host.append(
    el('div', { class: 'co-ctl' },
      choice('Le commutateur entre le maître et les esclaves est', [['bc', 'une horloge frontière (BC)', 'Il termine PTP sur chaque port et horodate lui-même'], ['plain', 'un commutateur ordinaire', 'Les messages PTP attendent dans ses files comme les autres']], 'bc', (v) => { bc = v === 'bc'; }),
      slider('Charge du commutateur', 0, 95, load, 5, (v) => { load = v; }, (v) => v + ' %'),
      slider('Asymétrie du trajet', -1000, 1000, asym, 50, (v) => { asym = v; }, (v) => `${v > 0 ? '+' : ''}${v} ns`)),
    el('p', { class: 'note co-note' }, 'Le décalage de deux esclaves, mesuré à chaque seconde (4 échanges). Asymétrie : par exemple 100 m de fibre de plus dans un sens font + 500 ns. Charge : la probabilité qu\'une trame de 1 500 octets (1,2 µs à 10 Gb/s) soit déjà dans la file quand le message PTP arrive.'),
    chart, read.el);
  tick();
  return { destroy: () => clearInterval(id) };
}

// ======================================================================================
registerChapter({
  id: 'reseau', title: 'Le réseau', icon: 'reseau',
  intro: 'Adresses, masques, VLAN, commutateurs, multicast, PTP : le réseau de contrôle du car SDI et le réseau média du car IP.',
  lessons: [
    {
      id: 'reseau-ip', title: 'Adresse IP et masque de sous-réseau', minutes: '7 min',
      essentials: [
        'Une adresse IPv4 fait **32 bits** : le masque dit combien de bits désignent le **réseau**, le reste désigne l\'**appareil**.',
        'Deux appareils du **même sous-réseau** se parlent directement ; sinon il faut une **passerelle** (le routeur).',
        'Dans le car : 10.1.<VLAN>.x /24, passerelle en .1 ; un masque ou une passerelle faux donnent une panne qui ressemble à un câble coupé.',
      ],
      figure: figIp,
      demoTitle: 'Changez le masque du RCP, mettez la CCU dans un autre VLAN, effacez une passerelle : regardez qui se parle encore.',
      demo: demoIp,
      body: `Une adresse IPv4 s'écrit en quatre nombres de 0 à 255, mais la machine la voit comme **32 bits**. Le **masque** coupe ces 32 bits en deux : à gauche la partie **réseau**, commune à tous les appareils d'un même sous-réseau ; à droite la partie **appareil** (hôte). On l'écrit **/24** (24 bits de réseau) ou 255.255.255.0 : les 1 du masque recouvrent la partie réseau. Un /24 contient 256 adresses, dont 254 pour des appareils : la première (tous les bits d'appareil à 0) nomme le réseau, la dernière (tous à 1) est l'adresse de **diffusion** (broadcast), reçue par tout le monde.

Pour envoyer un paquet, une machine compare l'adresse de destination à la sienne **à travers son propre masque**. Même partie réseau : la destination est voisine, la machine demande son adresse MAC (ARP) et lui parle directement. Partie réseau différente : elle remet le paquet à sa **passerelle**, l'adresse du routeur dans son sous-réseau, qui le fait suivre. Sans passerelle, une machine ne sort jamais de son sous-réseau : elle voit encore ses voisines, mais plus la supervision, l'heure ni Internet.

C'est pour cela qu'un **masque faux** est une panne vicieuse. Un RCP en /16 croit que toute machine 10.1.x.x est voisine : il appelle en direct la CCU 10.1.30.11 par ARP, mais elle est sur un autre VLAN et ne l'entend pas. Le RCP en /24 aurait passé par le routeur. Comme le masque et la passerelle font partie de la configuration de chaque machine, le plan d'adressage est écrit avant l'installation : dans ce car, **10.1.<numéro de VLAN>.x /24**, passerelle en .1, CCU de .11 à .22, RCP de .31 à .42, et la même fin d'adresse pour la caméra n sur toutes les lignes.

Autres ordres de grandeur :
- /16 : 65 534 appareils ; /22 : 1 022 ; /24 : 254 ; /30 : 2 (un lien entre deux routeurs).
- Les adresses 10.0.0.0/8, 172.16.0.0/12 et 192.168.0.0/16 sont **privées** (RFC 1918) : jamais sur Internet, c'est ce qu'utilisent les cars.
- Dans le car IP (ST 2110), chaque appareil a trois adresses : la carte média rouge (10.1.x.y), la carte média bleue (10.2.x.y, même fin d'adresse) et le contrôle (10.20.0.0/22, un réseau à part).

Deux machines avec la **même adresse** se perturbent toutes les deux : la table ARP des voisins bascule de l'une à l'autre, et le RCP répond une fois sur deux. Première chose à vérifier quand une machine fraîchement installée fonctionne par intermittence.`,
      car: { text: 'Au poste Réseau (baie technique, car SDI) : le plan d\'adressage du réseau de contrôle, la mise en service d\'une machine (adresse, masque, passerelle, VLAN du port) et le ping. Les pannes « masque faux » et « conflit d\'adresses » y sont jouées ; une passerelle fausse se reconnaît au ping depuis un autre VLAN.', station: 'reseau' },
      terms: ['sous-reseau', 'passerelle', 'conflit-ip', 'dhcp', 'ping', 'routage'],
      competences: ['3.6', '2.10'], article: 'reseau',
      quiz: [
        { q: 'Combien d\'appareils peut-on adresser dans 10.1.20.0/24 ?', choices: ['256', '254', '24'], answer: 1, why: '8 bits d\'appareil donnent 256 combinaisons, moins l\'adresse du réseau (10.1.20.0) et celle de diffusion (10.1.20.255) : 254. Le 24 est le nombre de bits de la partie réseau, pas un nombre d\'adresses.' },
        { q: 'Le RCP 10.1.20.31/24 veut parler à la CCU 10.1.30.11/24. Que fait-il ?', choices: ['Il lui envoie la trame directement, par ARP', 'Il remet le paquet à sa passerelle 10.1.20.1', 'Il ne peut pas : les /24 ne communiquent jamais entre eux'], answer: 1, why: 'Vu à travers le masque /24, 10.1.30.11 n\'est pas dans le réseau 10.1.20.0 : le RCP passe par sa passerelle, le routeur du cœur, qui connaît les deux sous-réseaux. L\'ARP direct ne sert qu\'aux voisins du même sous-réseau.' },
        { q: 'Une machine voit ses voisines mais ni la supervision ni l\'heure NTP. Cause probable ?', choices: ['Son câble est coupé', 'Sa passerelle est fausse ou absente', 'Son adresse MAC est en conflit'], answer: 1, why: 'Câble coupé : elle ne verrait personne. Passerelle fausse : tout ce qui est dans son sous-réseau marche, tout ce qui est au-delà (autres VLAN, Internet) échoue. C\'est la signature de ce type de panne.' },
      ],
    },
    {
      id: 'reseau-vlan', title: 'VLAN et commutateur', minutes: '7 min',
      essentials: [
        'Un **VLAN** est un réseau local virtuel : des ports du commutateur rangés dans un groupe isolé, avec son propre domaine de diffusion.',
        'Un port **access** appartient à un VLAN sans que la machine le sache ; un port **trunk** transporte plusieurs VLAN, chaque trame portant une **étiquette 802.1Q**.',
        'Le car sépare gestion, caméras, production, intercom : une machine bavarde ou une boucle dans un VLAN ne gêne pas les autres.',
      ],
      figure: figVlan,
      demoTitle: 'Choisissez un port, envoyez une trame de diffusion et regardez où elle arrive. Passez un port en trunk, changez un VLAN, recommencez.',
      demo: demoVlan,
      body: `Un commutateur (switch) recopie une trame de **diffusion** (broadcast, adresse FF:FF:FF:FF:FF:FF) sur tous ses ports : c'est ainsi que les machines se trouvent (ARP), que les protocoles de découverte fonctionnent. Mais sur un car de 80 machines, tout le monde entendrait tout. Le **VLAN** (Virtual LAN, IEEE 802.1Q) découpe le commutateur en plusieurs commutateurs virtuels : une trame de diffusion ne sort que sur les ports **du même VLAN**. Deux machines dans deux VLAN ne se voient pas, même branchées côte à côte : il faut un routeur entre elles (dans le car, le commutateur de cœur, qui route entre les VLAN).

Un port **access** est dans un seul VLAN. La machine qui y est branchée n'en sait rien : elle envoie des trames ordinaires et le commutateur les range dans le VLAN du port. Le VLAN se règle donc **sur le commutateur, pas dans la machine**. Entre deux commutateurs, un seul câble transporte tous les VLAN : c'est un port **trunk**. Chaque trame y reçoit une **étiquette 802.1Q** de 4 octets, insérée entre l'adresse source et le type : le numéro de VLAN sur 12 bits (1 à 4094) et une priorité sur 3 bits (la CoS, utilisée par la QoS). Le commutateur d'en face lit l'étiquette, la retire et remet la trame dans le bon VLAN.

Pourquoi le car sépare-t-il ses usages ? Dans ce car SDI : VLAN 10 gestion, 20 caméras (CCU et RCP), 30 production (mélangeur, grille, tally), 40 ralentis, 50 intercom et son, 60 fichiers, 90 invités. Trois raisons :
- **la panne reste chez elle** : une boucle, une tempête de diffusion ou un portable d'invité qui scanne le réseau ne touchent qu'un VLAN ;
- **la priorité** : la voix de l'intercom et les commandes du RCP passent devant les copies de fichiers, parce que la QoS est réglée par VLAN et par classe ;
- **la sécurité** : les invités n'atteignent pas les CCU, et le routeur peut filtrer entre VLAN.

Dans le car IP, les flux ST 2110 ont aussi leurs VLAN (un par leaf et par réseau, rouge et bleu), et le réseau de contrôle reste à part : un appareil qui parle NMOS ne doit jamais passer par le réseau média.

Deux pannes classiques : une machine branchée sur un port du **mauvais VLAN** (elle est isolée de sa passerelle, comme si son câble était coupé, mais le voyant du port est allumé) ; un trunk dont la liste des **VLAN autorisés** oublie un VLAN (toutes les machines de ce VLAN sur l'autre commutateur disparaissent d'un coup).`,
      car: { text: 'Au poste Réseau (car SDI) : l\'onglet des switchs montre le VLAN de chaque port de SW-CŒUR, SW-PROD et SW-VISION, les trunks 802.1Q entre eux et la classe de QoS. La panne « port dans le mauvais VLAN » y est jouée : le RCP ne commande plus sa caméra.', station: 'reseau' },
      terms: ['vlan', 'trunk', 'cos', 'commutateur', 'reseau-ctl', 'qos'],
      competences: ['3.6', '2.10'], article: 'reseau',
      quiz: [
        { q: 'Un RCP est branché sur un port access du VLAN 30 au lieu du 20. Que voit-on ?', choices: ['Le voyant du port est éteint', 'Le voyant est allumé mais le RCP ne joint plus sa CCU ni sa passerelle', 'Le RCP fonctionne, le VLAN ne change rien'], answer: 1, why: 'Le niveau physique est bon (voyant allumé), mais le RCP est dans un autre domaine de diffusion : ses requêtes ARP ne parviennent ni à la CCU ni à la passerelle 10.1.20.1. Le VLAN se règle sur le commutateur, c\'est donc là qu\'on dépanne.' },
        { q: 'À quoi sert l\'étiquette 802.1Q ?', choices: ['À chiffrer la trame', 'À dire au commutateur d\'en face dans quel VLAN remettre la trame qui arrive par le trunk', 'À remplacer l\'adresse MAC'], answer: 1, why: 'Sur un trunk, tous les VLAN partagent le même câble : sans étiquette, le commutateur d\'arrivée ne saurait pas à quel VLAN appartient chaque trame. L\'étiquette porte le numéro de VLAN (12 bits) et une priorité (3 bits) ; elle ne chiffre rien.' },
        { q: 'Pourquoi mettre l\'intercom dans son propre VLAN ?', choices: ['Parce que les panneaux intercom n\'ont pas d\'adresse IP', 'Pour que la voix ait sa priorité et ne subisse ni les diffusions ni les pannes des autres usages', 'Parce qu\'un VLAN ne peut contenir que des machines de même marque'], answer: 1, why: 'Les panneaux ont bien une adresse IP. Isoler l\'intercom limite son domaine de diffusion, permet une QoS « voix » par VLAN et met la régie à l\'abri d\'une boucle ou d\'une machine bavarde ailleurs. La marque n\'a rien à voir.' },
      ],
    },
    {
      id: 'reseau-switch', title: 'Comment un commutateur apprend (table MAC)', minutes: '6 min',
      essentials: [
        'Le commutateur lit l\'**adresse MAC source** de chaque trame et note « cette adresse est derrière ce port » : c\'est sa **table MAC**.',
        'Destination connue : la trame ne sort que par le bon port. Destination inconnue ou diffusion : **inondation** sur tous les autres ports.',
        '**MAC** : l\'adresse de la carte, pour le réseau local ; **IP** : l\'adresse configurée, pour aller de bout en bout. **ARP** traduit l\'une en l\'autre.',
      ],
      figure: figMac,
      demoTitle: 'Lancez « RCP 1 règle la CCU 1 » et avancez trame par trame : regardez la table se remplir et l\'inondation disparaître.',
      demo: demoMac,
      body: `Chaque carte réseau a une **adresse MAC** de 48 bits, écrite en six octets hexadécimaux (02:1A:20:00:00:31). Les trois premiers octets identifient le fabricant, les trois derniers la carte : elle est unique au monde et n'a pas à être configurée. Le commutateur ne connaît que ces adresses. Il ne lit jamais l'adresse IP, qui est l'affaire du routeur.

Au démarrage, sa **table MAC** est vide. À chaque trame qui entre, il lit l'adresse **source** et note : « cette adresse est derrière le port n ». C'est l'**apprentissage**. Puis il regarde l'adresse de **destination** : s'il la connaît, il recopie la trame sur ce seul port ; s'il ne la connaît pas, ou si c'est une diffusion (FF:FF:FF:FF:FF:FF), il la recopie sur **tous les autres ports** du VLAN : l'**inondation** (flooding). Après quelques trames, toutes les machines qui ont parlé sont connues et il n'y a plus d'inondation : chaque conversation ne passe que sur ses deux ports, c'est ce qui distingue un commutateur d'un simple répartiteur (hub) où tout le monde entendait tout. Une entrée inutilisée est oubliée après **300 s** en général : une machine qui change de port est réapprise à sa première trame.

Et l'adresse IP ? Pour envoyer un paquet à 10.1.20.11, le RCP a besoin de l'adresse MAC de la CCU. Il la demande par **ARP** : une trame de diffusion « qui a 10.1.20.11 ? », à laquelle la CCU seule répond « c'est moi, 02:1A:20:00:00:11 ». Le RCP garde la réponse dans son **cache ARP** quelques minutes : la deuxième commande part sans question. L'adresse IP reste la même de bout en bout ; l'adresse MAC de destination, elle, change à chaque routeur traversé (vers un autre sous-réseau, c'est la MAC de la passerelle qu'on utilise).

Ce que l'on en voit en exploitation :
- \`show mac address-table\` sur le commutateur : à quel port est branchée telle machine, sans suivre le câble ;
- une adresse qui saute d'un port à l'autre : deux machines avec la même MAC (image de disque clonée) ou une boucle ;
- une machine muette depuis l'allumage n'est dans aucune table : il faut qu'elle envoie une trame (un ping suffit) pour qu'on la localise.`,
      car: { text: 'Au poste Réseau (car SDI) : l\'onglet des switchs affiche la table MAC de chaque switch et la table ARP par VLAN ; le ping entre deux machines y montre la requête ARP puis l\'écho. On s\'en sert pour localiser une machine rebranchée au mauvais endroit, ou pour distinguer un câble débranché d\'un port dans le mauvais VLAN (l\'exercice pratique de cette leçon).', station: 'reseau' },
      terms: ['table-mac', 'mac', 'arp', 'commutateur', 'rj45', 'ping'],
      competences: ['3.6', '2.13'], article: 'reseau',
      quiz: [
        { q: 'Le commutateur reçoit une trame pour une adresse MAC qu\'il ne connaît pas. Que fait-il ?', choices: ['Il la jette', 'Il la recopie sur tous les autres ports du VLAN', 'Il demande l\'adresse par ARP'], answer: 1, why: 'Inondation : la trame sort partout sauf par son port d\'entrée ; la machine concernée répondra, et sa réponse apprendra son port au commutateur. ARP est un mécanisme des machines (IP vers MAC), pas du commutateur.' },
        { q: 'Comment la table MAC se remplit-elle ?', choices: ['L\'administrateur la saisit', 'Le commutateur note l\'adresse source de chaque trame et le port d\'entrée', 'Le routeur l\'envoie au commutateur'], answer: 1, why: 'L\'apprentissage est automatique, à partir de l\'adresse source des trames reçues. Rien à saisir : c\'est pour cela qu\'un commutateur fonctionne sans configuration. Les entrées expirent après environ 300 s sans trafic.' },
        { q: 'Quelle différence entre adresse MAC et adresse IP ?', choices: ['Aucune, ce sont deux écritures de la même chose', 'La MAC est gravée dans la carte et sert dans le réseau local ; l\'IP est configurée et sert de bout en bout', 'La MAC est configurée par le technicien, l\'IP est gravée'], answer: 1, why: 'La MAC (48 bits, unique, fabricant + numéro) n\'a de sens que sur le segment local : elle change à chaque routeur. L\'IP (32 bits, plan d\'adressage) identifie la machine de bout en bout. ARP fait le lien entre les deux.' },
      ],
    },
    {
      id: 'reseau-multicast', title: 'Multicast et IGMP (car IP, ST 2110)', minutes: '8 min',
      essentials: [
        'Un flux ST 2110-20 1080p50 pèse de l\'ordre de **2,2 Gb/s** : en **unicast**, la caméra devrait en envoyer une copie par destinataire.',
        'En **multicast**, elle envoie une seule copie vers un **groupe** 239.x.x.x ; le réseau la recopie vers ceux qui l\'ont demandée par **IGMP**.',
        'Sans **IGMP snooping**, le commutateur traite le multicast comme de la diffusion : tous les ports reçoivent tout, et les petits ports débordent.',
      ],
      figure: figMcast,
      demoTitle: 'Passez d\'unicast à multicast, coupez le snooping, ajoutez des caméras, abonnez ou désabonnez les récepteurs : regardez quel lien sature.',
      demo: demoMcast,
      body: `En SDI, une image est un câble : pour l'envoyer à trois endroits, on la distribue par la grille. En IP, l'image est un flux de paquets. Une caméra 1080p50 4:2:2 10 bits en **ST 2110-20** produit 2,07 Gb/s d'image active, soit de l'ordre de **2,2 Gb/s** sur le réseau avec les en-têtes (2,5 à 2,6 Gb/s en 1080p59,94 ; 8 à 9 Gb/s en UHD). En **unicast**, l'appareil qui émet doit connaître chaque destinataire et envoyer **une copie par destinataire** : quatre récepteurs, 8,8 Gb/s sur le lien de la caméra ; douze caméras pour un multiview, un mélangeur et un EVS, et le lien entre les commutateurs porte des dizaines de copies. Cela ne tient pas, et la configuration change à chaque branchement.

Le **multicast** renverse la logique. La caméra envoie **une seule copie** vers une adresse de **groupe** (224.0.0.0 à 239.255.255.255 ; les cars utilisent 239.x.x.x, la plage privée). Elle ne sait pas qui écoute. Chaque récepteur qui veut le flux le demande à son commutateur par **IGMP** (Internet Group Management Protocol, version 3) : un rapport « je veux le groupe 239.1.1.1 ». Le commutateur recopie le flux vers ce port et pas vers les autres. Entre les commutateurs, un protocole de routage multicast (**PIM**) construit l'arbre de distribution. Un abonnement non renouvelé expire (requêtes du querier toutes les 125 s, expiration à 260 s par défaut).

En **SSM** (Source-Specific Multicast, IGMPv3), le récepteur ne demande pas « le groupe G » mais « le groupe G **envoyé par la source S** » : le couple (S, G). Deux avantages : pas de point de rendez-vous à configurer, et un appareil qui émettrait par erreur sur le même groupe n'est pas reçu. C'est ce que fait le contrôleur NMOS quand il connecte une entrée du mélangeur : il écrit S et G dans le récepteur, qui envoie le join.

Le piège : un commutateur sans **IGMP snooping** ne lit pas les rapports IGMP. Il traite le multicast comme de la diffusion et recopie **tous les flux sur tous les ports du VLAN**, abonnés ou non. Un moniteur à 10 Gb/s reçoit douze caméras, 26 Gb/s : il déborde, perd des paquets, et les caméras elles-mêmes reçoivent les flux des autres. Avec le snooping, le commutateur tient une table « groupe → ports » et ne recopie que là où c'est demandé.

Dernière subtilité : une trame Ethernet a besoin d'une adresse MAC de destination. Pour un groupe IPv4, c'est 01:00:5E suivi des 23 derniers bits de l'adresse du groupe : 32 groupes partagent la même MAC, raison de plus pour tenir un plan d'adressage multicast propre (ici : caméra n → 239.1.1.n).`,
      car: { text: 'Dans le car IP (choisir « car IP » sur la feuille de service), au poste Réseau IP : abonnements IGMP par port (`show ip igmp snooping groups`), charge de chaque lien, entrées (S, G) ; les pannes « snooping désactivé » et « lien saturé » y sont jouées, et le contrôleur NMOS fait les connexions.', station: 'reseau' },
      terms: ['groupe', 'igmp', 'snooping', 'ssm', 'querier', 'mac-mcast', 'st2110-20', 'debit', 'pim', 'charge'],
      competences: ['3.6', '2.11'], article: 'reseau',
      quiz: [
        { q: 'Pourquoi l\'unicast ne convient-il pas aux flux ST 2110 ?', choices: ['Parce que l\'unicast est plus lent que le multicast', 'Parce que l\'émetteur devrait envoyer une copie de 2,2 Gb/s par destinataire et connaître chacun d\'eux', 'Parce que les commutateurs n\'acceptent pas l\'unicast'], answer: 1, why: 'Le débit d\'un paquet est le même dans les deux cas. Le problème est le nombre de copies : N destinataires, N × 2,2 Gb/s sur le lien de la caméra, et une configuration à refaire à chaque changement. Le multicast laisse le réseau recopier là où c\'est demandé.' },
        { q: 'À quoi sert IGMP ?', choices: ['À chiffrer les flux vidéo', 'À permettre à un récepteur de dire au commutateur quel groupe multicast il veut recevoir', 'À donner une adresse IP à la caméra'], answer: 1, why: 'IGMP est le protocole d\'abonnement : « je veux (S, G) ». Le commutateur, s\'il fait du snooping, recopie le flux vers ce port seulement. L\'adressage IP est l\'affaire de la configuration ou de DHCP ; rien n\'est chiffré.' },
        { q: 'Que se passe-t-il si l\'IGMP snooping est désactivé sur un commutateur ?', choices: ['Plus aucun flux ne passe', 'Tous les flux multicast sont recopiés sur tous les ports du VLAN et les ports lents débordent', 'Seules les caméras sont coupées'], answer: 1, why: 'Sans snooping, le multicast est traité comme de la diffusion : chaque port reçoit chaque flux, demandé ou non. Les flux passent, mais un port à 10 Gb/s qui reçoit douze fois 2,2 Gb/s perd des paquets : image qui gèle sur le moniteur, alarmes sur les caméras.' },
      ],
    },
    {
      id: 'reseau-ptp', title: 'PTP : l\'horloge du car IP', minutes: '8 min',
      essentials: [
        'En SDI, la synchro est un câble (black burst, tri-level). En IP, c\'est une **heure commune** distribuée par le réseau : **PTP** (IEEE 1588), profil **ST 2059-2**.',
        'L\'esclave mesure quatre instants (Sync t1 t2, Delay_Req t3 t4), en déduit le **délai** et son **décalage** : vrai seulement si le trajet est **symétrique**.',
        'Les commutateurs doivent être des **horloges frontières** : sinon leurs files d\'attente font varier le délai et l\'erreur dépasse la microseconde.',
      ],
      figure: figPtp,
      demoTitle: 'Montez la charge du commutateur, puis passez-le en commutateur ordinaire : regardez l\'erreur des deux esclaves. Ajoutez de l\'asymétrie.',
      demo: demoPtp,
      body: `Pour commuter proprement entre deux caméras, leurs images doivent commencer au même instant. En SDI, le générateur de synchro (SPG) distribue une **référence** à chaque appareil par un câble : black burst ou tri-level, c'est le **genlock**. En IP, il n'y a plus de câble de référence. Chaque appareil reçoit à la place **l'heure**, très précisément, et en déduit lui-même où commencent les images : la norme **SMPTE ST 2059-1** définit un instant d'origine (l'époque, le 1er janvier 1970 TAI) et la règle pour aligner tout signal vidéo ou audio sur cette heure. Deux appareils à la même heure produisent des images alignées sans jamais s'être parlé.

Cette heure est distribuée par **PTP** (Precision Time Protocol, IEEE 1588-2008), dans le profil **ST 2059-2** : un **grand maître** (GM), en général calé sur le GPS, envoie des messages **Sync** huit fois par seconde et des **Announce** quatre fois par seconde, sur un **domaine** (127 par défaut). L'esclave note l'heure d'arrivée du Sync (t2), reçoit dans le **Follow_Up** l'heure d'émission exacte (t1), envoie un **Delay_Req** (t3) dont le maître lui renvoie l'heure de réception (t4) dans le **Delay_Resp**. Alors délai moyen = ((t2 − t1) + (t4 − t3)) / 2 et décalage = (t2 − t1) − délai moyen. L'esclave corrige son horloge, et recommence. Avec l'**horodatage matériel** des paquets dans la carte réseau, l'erreur est de quelques dizaines de nanosecondes.

Le calcul suppose que l'aller et le retour durent **le même temps**. Toute **asymétrie** a devient une erreur de a / 2 : 100 m de fibre de plus dans un sens (environ 500 ns) décalent l'esclave de 250 ns, et ça ne se voit sur aucune alarme. Pire : dans un commutateur ordinaire, le message PTP attend dans la file derrière les trames vidéo (1,2 µs par trame de 1 500 octets à 10 Gb/s), un temps **différent** à l'aller et au retour, et qui change à chaque message. L'erreur dépasse vite la microseconde et saute d'un échange à l'autre. C'est pourquoi tous les commutateurs d'un car IP sont des **horloges frontières** (boundary clocks) : esclave sur le port qui mène au grand maître, maître sur les autres, le commutateur horodate lui-même et le délai mesuré redevient celui du câble. L'autre solution, l'horloge transparente, laisse passer le message en y ajoutant le temps qu'il a passé dans le commutateur.

Ce qu'il faut tenir : un esclave verrouillé à **mieux que la microseconde** (ST 2059-2), en pratique quelques dizaines de nanosecondes ; au-delà, les images des appareils ne sont plus alignées et les commutations se salissent. Le grand maître est élu par le **BMCA** (priorité 1, classe d'horloge, précision, priorité 2, identité) : un appareil laissé par défaut peut se faire élire à la place du GPS, d'où le réglage « slave only » sur tout ce qui n'est pas un générateur. Un GM qui perd le GPS passe en **holdover** et sa classe se dégrade ; un saut de l'offset trahit un changement de maître.`,
      car: { text: 'Au poste Synchro (baie technique) : le SPG est le grand maître PTP du car IP (GPS, ST 2059-2) à côté de ses sorties black burst et tri-level. Au poste Réseau IP : Exploitation → PTP (maître élu, ports Slave/Master des horloges frontières) et Mesures → Suivi PTP (courbe de l\'offset).', station: 'synchro' },
      terms: ['ptp', 'st2059', 'grand-maitre', 'bc', 'offset', 'delai-moyen', 'bmca', 'domaine', 'slave-only', 'holdover'],
      competences: ['3.6', '1.4'], article: 'ipguide',
      quiz: [
        { q: 'Pourquoi les commutateurs d\'un car IP doivent-ils être des horloges frontières ?', choices: ['Pour chiffrer les messages PTP', 'Parce que sinon le temps d\'attente dans leurs files, variable et différent à l\'aller et au retour, fausse le calcul du décalage', 'Parce que PTP ne traverse pas un commutateur ordinaire'], answer: 1, why: 'PTP traverse très bien un commutateur ordinaire, mais le message y attend derrière les trames vidéo, un temps variable et asymétrique : l\'erreur dépasse la microseconde. L\'horloge frontière termine PTP sur chaque port et horodate elle-même. Rien n\'est chiffré.' },
        { q: 'Le trajet aller dure 500 ns de plus que le retour. Quelle erreur sur le décalage calculé ?', choices: ['0 ns : PTP la compense', '250 ns', '500 ns'], answer: 1, why: 'Le calcul suppose un trajet symétrique et partage l\'asymétrie en deux : l\'erreur vaut a / 2 = 250 ns. PTP ne peut pas la détecter seul ; on la corrige par une constante d\'asymétrie dans la configuration de l\'esclave, après mesure.' },
        { q: 'Que remplace PTP dans un car IP ?', choices: ['Le réseau de contrôle', 'La référence de synchro distribuée par câble (black burst, tri-level) à chaque appareil', 'Le timecode des ralentis'], answer: 1, why: 'Le genlock par câble disparaît : chaque appareil reçoit l\'heure par PTP et aligne lui-même ses images sur l\'époque ST 2059-1. Le réseau de contrôle reste nécessaire ; le timecode dérive aussi de cette heure, mais ce n\'est pas ce que PTP remplace.' },
      ],
    },
  ],
});

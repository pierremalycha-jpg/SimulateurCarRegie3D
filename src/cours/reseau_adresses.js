// @ts-check
import { el } from '../util.js';
import { figure, sv, slider, choice, readout, fmtNum } from './kit.js';
import { ipNum, ipTxt, masque, sousReseau, decouper, planVlsm, modesEnvoi } from './reseau_calc.js';

// ----------------------------------------------------------------------------------
// Leçons « bases du réseau » du chapitre Réseau, 2 : l'adresse du réseau et l'adresse de diffusion
// (calcul bit à bit, découpage en sous-réseaux, plan d'adressage à la demande, entraînement), les
// trois façons d'envoyer (unicast, diffusion, multicast) et les services du réseau (DHCP, DNS, NAT).
// Les calculs sont dans reseau_calc.js (testés).
// ----------------------------------------------------------------------------------
const C = { grey: '#8a949c', amber: '#ffd38a', red: '#ff8a80', green: '#7fd1a0', cyan: '#7fd3f3', violet: '#c3a6ff', box: '#1a2026', line: '#2a3238' };
const txt = (x, y, s, cls = 'co-s', anchor = 'middle') => sv('text', { x, y, textAnchor: anchor, class: cls }, s);
const rect = (x, y, w, h, stroke = C.grey, fill = C.box) => sv('rect', { x, y, width: w, height: h, rx: 3, fill, stroke, strokeWidth: 1.2 });
const field = (label, input) => el('label', { class: 'co-field' }, el('span', {}, label), input);
const input = (value, aria, placeholder = '') => /** @type {HTMLInputElement} */ (el('input', { type: 'text', value, spellcheck: 'false', 'aria-label': aria, placeholder }));

// ======================================================================================
// 4. Adresse du réseau, adresse de diffusion, découpage
// ======================================================================================
/** une rangée de 32 bits : partie réseau (ambre) / machine (cyan), avec un libellé */
function rangee(f, y, label, n, p, opts = {}) {
  const cell = 13, gap = 7, x0 = 150;
  f.append(txt(x0 - 10, y + 14, label, opts.bold ? 'co-t' : 'co-s', 'end'));
  for (let i = 0; i < 32; i++) {
    const x = x0 + i * cell + Math.floor(i / 8) * gap, bit = (n >>> (31 - i)) & 1, net = i < p;
    f.append(sv('rect', { x, y, width: cell - 1, height: 18, rx: 2, fill: net ? C.amber : C.cyan, opacity: bit ? 1 : 0.28 }));
    f.append(sv('text', { x: x + (cell - 1) / 2, y: y + 13.5, textAnchor: 'middle', class: 'co-bit' }, String(bit)));
  }
  f.append(txt(x0 + 32 * cell + 3 * gap + 8, y + 14, ipTxt(n), 'co-m', 'start'));
}
function figAdressage() {
  const ip = ipNum('192.168.10.77') || 0, p = 26, s = sousReseau(ip, p);
  const f = figure(720, 200, 'L\'adresse 192.168.10.77 en /26 : la partie réseau (26 bits) est gardée ; partie machine à zéro, on obtient l\'adresse du réseau 192.168.10.64 ; partie machine à un, l\'adresse de diffusion 192.168.10.127 ; entre les deux, 62 adresses pour les machines');
  f.append(txt(10, 14, '192.168.10.77 /26 : 26 bits de réseau, 6 bits de machine', 'co-t', 'start'));
  rangee(f, 26, 'adresse', ip, p, { bold: true });
  rangee(f, 52, 'masque /26', s.masque, p);
  rangee(f, 92, 'réseau (ET)', s.reseau, p, { bold: true });
  rangee(f, 118, 'diffusion', s.diffusion, p, { bold: true });
  f.append(txt(10, 160, 'Réseau : on garde les bits du réseau, ceux de la machine à 0. Diffusion : ceux de la machine à 1.', 'co-s', 'start'));
  f.append(txt(10, 180, `Machines : de ${ipTxt(s.premier)} à ${ipTxt(s.dernier)}, soit 2^6 − 2 = ${s.hotes} adresses.`, 'co-s', 'start'));
  return f;
}
/** plan à la demande : les VLAN du car et leur nombre de machines */
const BESOINS_CAR = [
  { nom: 'Invités (Wi-Fi)', hotes: 100 }, { nom: 'Caméras (CCU, RCP)', hotes: 24 }, { nom: 'Production (mélangeur, grille)', hotes: 20 },
  { nom: 'Intercom et son', hotes: 12 }, { nom: 'Gestion (supervision)', hotes: 10 }, { nom: 'Lien vers le routeur', hotes: 2 },
];
function demoAdressage(host) {
  let mode = 'calcul';
  const zone = el('div', { class: 'co-demo-host' });
  // --- calcul
  const calc = (() => {
    const ipIn = input('192.168.10.77', 'Adresse IP');
    let p = 26;
    const bitsBox = el('div', { class: 'co-figbox' });
    const rd = readout(['Masque', 'Adresse du réseau', 'Adresse de diffusion', 'Première et dernière machine', 'Machines possibles', 'Cette adresse est', 'Nature', 'Ancienne classe']);
    const sl = slider('Préfixe', 8, 32, p, 1, (v) => { p = v; upd(); }, (v) => `/${v}`);
    function upd() {
      const ip = ipNum(ipIn.value);
      ipIn.setAttribute('aria-invalid', String(ip == null));
      if (ip == null) { rd.set('Adresse du réseau', 'adresse invalide'); bitsBox.replaceChildren(); return; }
      const s = sousReseau(ip, p);
      rd.set('Masque', `${ipTxt(s.masque)} (joker ${ipTxt(s.joker)})`);
      rd.set('Adresse du réseau', `${ipTxt(s.reseau)}/${p}`); rd.set('Adresse de diffusion', p >= 31 ? 'aucune (lien point à point ou machine seule)' : ipTxt(s.diffusion));
      rd.set('Première et dernière machine', `${ipTxt(s.premier)} → ${ipTxt(s.dernier)}`); rd.set('Machines possibles', fmtNum(s.hotes));
      rd.set('Cette adresse est', s.role === 'machine' ? 'une adresse de machine' : `l'${s.role} : on ne peut pas la donner à un appareil`);
      rd.set('Nature', s.nature); rd.set('Ancienne classe', `${s.classe} (avant 1993 ; on n'en tient plus compte)`);
      const f = figure(720, 120, `Calcul bit à bit de ${ipTxt(ip)}/${p}`);
      rangee(f, 4, 'adresse', ip, p, { bold: true }); rangee(f, 30, `masque /${p}`, s.masque, p);
      rangee(f, 64, 'réseau', s.reseau, p, { bold: true }); rangee(f, 90, 'diffusion', s.diffusion, p);
      bitsBox.replaceChildren(f);
    }
    ipIn.addEventListener('input', upd);
    upd();
    return el('div', {}, el('div', { class: 'co-ctl' }, field('Adresse', ipIn), sl), bitsBox, rd.el);
  })();
  // --- découpage en n sous-réseaux égaux
  const decoupe = (() => {
    const baseIn = input('192.168.1.0', 'Réseau à découper');
    let p = 24, n = 4;
    const out = el('div', { class: 'co-figbox' }), rd = readout(['Bits empruntés', 'Nouveau préfixe', 'Masque', 'Machines par sous-réseau']);
    const verdict = el('p', { class: 'co-verdict' });
    function upd() {
      const b = ipNum(baseIn.value); if (b == null) { verdict.className = 'co-verdict ko'; verdict.textContent = 'Adresse invalide.'; return; }
      const d = decouper(b, p, n);
      if (!d) { verdict.className = 'co-verdict ko'; verdict.textContent = 'Impossible : il ne resterait pas deux adresses de machine par sous-réseau.'; out.replaceChildren(); return; }
      rd.set('Bits empruntés', `${d.emprunt} (2^${d.emprunt} = ${2 ** d.emprunt} sous-réseaux)`); rd.set('Nouveau préfixe', `/${d.p}`); rd.set('Masque', ipTxt(masque(d.p))); rd.set('Machines par sous-réseau', fmtNum(d.parSous));
      const t = el('table', { class: 'co-table' }, el('thead', {}, el('tr', {}, ...['N°', 'Réseau', 'Machines', 'Diffusion'].map((h) => el('th', {}, h)))));
      const tb = el('tbody');
      d.sous.slice(0, 16).forEach((x, i) => tb.append(el('tr', {}, el('td', {}, String(i + 1)), el('td', {}, `${ipTxt(x.reseau)}/${d.p}`), el('td', {}, `${ipTxt(x.premier)} → ${ipTxt(x.dernier)}`), el('td', {}, ipTxt(x.diffusion)))));
      if (d.sous.length > 16) tb.append(el('tr', {}, el('td', { colspan: 4 }, `… et ${d.sous.length - 16} autres`)));
      t.append(tb); out.replaceChildren(t);
      verdict.className = 'co-verdict ' + (2 ** d.emprunt === n ? 'ok' : 'warn');
      verdict.textContent = 2 ** d.emprunt === n ? `Pile ${n} sous-réseaux : le pas entre deux réseaux est de ${2 ** (32 - d.p)} adresses.` : `On ne découpe que par puissances de 2 : pour ${n} sous-réseaux, on en obtient ${2 ** d.emprunt} (${2 ** d.emprunt - n} en réserve).`;
    }
    baseIn.addEventListener('input', upd);
    upd();
    return el('div', {}, el('div', { class: 'co-ctl' }, field('Réseau de départ', baseIn), slider('Son préfixe', 8, 28, p, 1, (v) => { p = v; upd(); }, (v) => `/${v}`), slider('Sous-réseaux voulus', 2, 64, n, 1, (v) => { n = v; upd(); })), rd.el, out, verdict);
  })();
  // --- plan du car (VLSM)
  const plan = (() => {
    const besoins = BESOINS_CAR.map((b) => ({ ...b }));
    let p = 24;
    const out = el('div', { class: 'co-figbox' }), verdict = el('p', { class: 'co-verdict' });
    const sliders = besoins.map((b) => slider(b.nom, 2, 250, b.hotes, 1, (v) => { b.hotes = v; upd(); }, (v) => `${v} machines`));
    function upd() {
      const r = planVlsm(ipNum('10.1.0.0') || 0, p, besoins);
      const t = el('table', { class: 'co-table' }, el('thead', {}, el('tr', {}, ...['VLAN', 'Besoin', 'Sous-réseau', 'Places', 'Diffusion'].map((h) => el('th', {}, h)))));
      const tb = el('tbody');
      for (const l of r.lignes) tb.append(el('tr', { style: { opacity: l.ok ? '1' : '0.5' } }, el('td', {}, l.nom), el('td', {}, String(l.hotes)), el('td', {}, l.ok ? `${ipTxt(l.reseau)}/${l.p}` : 'plus de place'), el('td', {}, String(l.places)), el('td', {}, l.ok ? ipTxt(l.diffusion) : '—')));
      t.append(tb); out.replaceChildren(t);
      verdict.className = 'co-verdict ' + (r.ok ? 'ok' : 'ko');
      verdict.textContent = r.ok ? `Tout tient dans 10.1.0.0/${p} : ${fmtNum(r.utilise)} adresses réservées sur ${fmtNum(r.total)}. Chaque VLAN a le plus petit sous-réseau qui le loge.` : `10.1.0.0/${p} est trop petit pour tous ces VLAN : élargissez le bloc (préfixe plus court) ou réduisez les besoins.`;
    }
    upd();
    return el('div', {}, el('div', { class: 'co-ctl' }, slider('Bloc d\'adresses du car', 20, 26, p, 1, (v) => { p = v; upd(); }, (v) => `10.1.0.0/${v}`), ...sliders), out, verdict);
  })();
  // --- entraînement
  const train = (() => {
    const q = el('p', { style: { fontWeight: '600', margin: '0' } });
    const rIn = input('', 'Adresse du réseau', 'ex. 192.168.1.0'), dIn = input('', 'Adresse de diffusion', 'ex. 192.168.1.255'), hIn = input('', 'Nombre de machines', 'ex. 254');
    const res = el('p', { class: 'co-verdict' });
    let cur = sousReseau(0, 24);
    const tirer = () => {
      const pre = 18 + Math.floor(Math.random() * 12), firsts = [10, 172, 192];
      const a = firsts[Math.floor(Math.random() * 3)], b = a === 172 ? 16 + Math.floor(Math.random() * 16) : a === 192 ? 168 : Math.floor(Math.random() * 256);
      const ip = ipNum(`${a}.${b}.${Math.floor(Math.random() * 256)}.${1 + Math.floor(Math.random() * 254)}`) || 0;
      cur = sousReseau(ip, pre);
      q.textContent = `Une machine a l'adresse ${ipTxt(ip)}/${pre} (masque ${ipTxt(cur.masque)}). Trouvez l'adresse de son réseau, son adresse de diffusion et le nombre de machines possibles.`;
      for (const i of [rIn, dIn, hIn]) i.value = '';
      res.className = 'co-verdict'; res.textContent = '';
    };
    const verif = () => {
      const okR = ipNum(rIn.value) === cur.reseau, okD = ipNum(dIn.value) === cur.diffusion, okH = Number(hIn.value.replace(/\s/g, '')) === cur.hotes;
      res.className = 'co-verdict ' + (okR && okD && okH ? 'ok' : 'ko');
      res.textContent = (okR && okD && okH ? 'Juste ! ' : '') + `Réseau ${okR ? '✔' : `✘ (${ipTxt(cur.reseau)})`} · diffusion ${okD ? '✔' : `✘ (${ipTxt(cur.diffusion)})`} · machines ${okH ? '✔' : `✘ (2^${32 - cur.p} − 2 = ${fmtNum(cur.hotes)})`}`;
    };
    tirer();
    return el('div', {}, q, el('div', { class: 'co-ctl' }, field('Réseau', rIn), field('Diffusion', dIn), field('Machines', hIn)),
      el('div', { class: 'co-btns' }, el('button', { type: 'button', class: 'btn small primary', onclick: verif }, 'Vérifier'), el('button', { type: 'button', class: 'btn small', onclick: tirer }, 'Autre adresse')), res);
  })();
  const vues = { calcul: calc, decoupe, plan, train };
  const show = () => zone.replaceChildren(vues[mode]);
  host.append(el('div', { class: 'co-ctl' }, choice('Outil', [['calcul', 'Calculer'], ['decoupe', 'Découper'], ['plan', 'Plan du car'], ['train', 'S\'entraîner']], mode, (v) => { mode = v; show(); })), zone);
  show();
}

/** @type {import('./index.js').Lesson} */
export const ADRESSAGE = {
  id: 'reseau-adressage', title: 'Adresse du réseau, adresse de diffusion et sous-réseaux', minutes: '10 min',
  essentials: [
    'Partie machine **toute à 0** : l\'**adresse du réseau** ; **toute à 1** : l\'**adresse de diffusion** (broadcast). Ni l\'une ni l\'autre ne se donne à un appareil : un /24 loge 2^8 − 2 = **254** machines.',
    'Calcul : réseau = adresse **ET** masque ; diffusion = réseau avec tous les bits machine à 1. En /26 : des blocs de 64 adresses (.0, .64, .128, .192).',
    '**Découper** un réseau, c\'est emprunter des bits à la partie machine : 2 bits empruntés à un /24 donnent 4 sous-réseaux /26 de 62 machines. Les adresses **privées** (10/8, 172.16/12, 192.168/16) restent dans les réseaux locaux.',
  ],
  figure: figAdressage,
  demoTitle: 'Calculez une adresse, découpez un réseau, faites le plan d\'adressage du car, puis entraînez-vous sur des adresses tirées au hasard.',
  demo: demoAdressage,
  body: `Une adresse IPv4 fait **32 bits**, écrits en quatre nombres de 0 à 255 (192.168.10.77). Le **masque** (ou le préfixe, /26) dit combien de bits, à gauche, désignent le **réseau** ; les autres désignent la **machine** dans ce réseau.

**Deux adresses réservées dans chaque réseau.**
- L'**adresse du réseau** : tous les bits machine à **0**. Elle désigne le réseau lui-même (dans les tables de routage, « 192.168.10.64/26 »).
- L'**adresse de diffusion** (broadcast) : tous les bits machine à **1**. Un paquet envoyé à cette adresse est reçu par **toutes** les machines du réseau.
Il reste 2^(bits machine) − 2 adresses pour les appareils : 254 en /24, 62 en /26, 2 en /30.

**Le calcul, bit à bit.** Pour 192.168.10.77/26 :
- le masque /26 s'écrit 255.255.255.192 : vingt-six 1, puis six 0 ;
- **réseau = adresse ET masque** : on garde les bits où le masque vaut 1, on met les autres à 0. Le dernier octet 77 = 01001101 devient 01000000 = 64 : réseau **192.168.10.64** ;
- **diffusion** : le réseau avec les six bits machine à 1 : 01111111 = 127 : **192.168.10.127** ;
- machines : de .65 à .126, soit **62**.
Astuce : en /26, les réseaux vont de 64 en 64 (256 − 192 = 64) ; il suffit de trouver le multiple de 64 juste en dessous de 77.

**Découper en sous-réseaux.** Un car ne met pas tous ses appareils dans un seul réseau : on fait un sous-réseau (et un VLAN) par usage. Pour découper un /24 en 4, on **emprunte 2 bits** à la partie machine : quatre /26 de 62 machines. On ne découpe que par **puissances de 2** : pour 5 sous-réseaux, il faut 3 bits, donc 8 sous-réseaux /27 de 30 machines. Quand les besoins sont inégaux, on donne à chacun **le plus petit sous-réseau qui le loge** (100 invités : un /25 ; 24 caméras : un /27 ; un lien entre deux routeurs : un /30), en commençant par les plus gros : c'est le **VLSM**.

**Adresses à connaître.**
- **Privées** (RFC 1918) : 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16. Libres d'usage dans un réseau local, elles ne circulent pas sur Internet (la box les traduit, c'est le NAT).
- **Publiques** : uniques au monde, attribuées par les opérateurs.
- **127.0.0.1** : la machine elle-même (boucle locale).
- **169.254.x.x** : une machine réglée en DHCP qui n'a reçu aucune réponse s'est donné cette adresse : elle ne joindra personne. Signe d'un serveur DHCP absent ou d'un mauvais VLAN.
- **224.0.0.0 à 239.255.255.255** : multicast (un groupe, pas une machine) ; les flux ST 2110 du car sont en 239.x.x.x.

**Les classes** (A, B, C) d'avant 1993 fixaient le masque d'après le premier octet. On ne s'en sert plus : le masque est donné avec l'adresse (CIDR). On entend encore « une classe C » pour un /24.`,
  plus: `- **/31** sur un lien point à point entre deux routeurs (RFC 3021) : les deux adresses servent, sans adresse de réseau ni de diffusion.
- **IPv6** : 128 bits écrits en hexadécimal (2001:db8::1), un /64 par réseau local, et **plus de diffusion** : le multicast la remplace. Le principe du préfixe reste le même.
- Le **joker** (wildcard), inverse du masque (0.0.0.63 pour un /26), sert dans les listes d'accès des routeurs.
- Écrire le **plan d'adressage** avant d'installer : chaque VLAN, son sous-réseau, sa passerelle (souvent la première adresse), les plages fixes et DHCP.`,
  car: { text: 'Au poste Réseau (car SDI) : chaque VLAN a son sous-réseau 10.1.<VLAN>.0/24, passerelle en .1. La mise en service d\'une machine demande l\'adresse, le masque et la passerelle : une adresse de réseau ou de diffusion donnée par erreur y est refusée.', station: 'reseau' },
  terms: ['sous-reseau', 'cidr', 'adresses-privees', 'diffusion', 'dhcp', 'vlan'],
  competences: ['3.6', '2.3', '2.10'], article: 'reseau',
  quiz: [
    { q: 'Quelle est l\'adresse du réseau de 192.168.10.77/26 ?',
      choices: [['192.168.10.0', 'Ce serait vrai en /24. En /26, les réseaux vont de 64 en 64 : 0, 64, 128, 192.'], '192.168.10.64', ['192.168.10.76', 'L\'adresse du réseau a tous ses bits machine à 0 : ici les 6 derniers bits.']],
      answer: 1, why: 'Masque /26 = 255.255.255.192 : 77 ET 192 = 64. Le réseau est 192.168.10.64.' },
    { q: 'Et son adresse de diffusion ?',
      choices: ['192.168.10.127', ['192.168.10.255', 'C\'est la diffusion du /24, pas du /26.'], ['192.168.10.128', 'C\'est l\'adresse du réseau suivant.']],
      answer: 0, why: 'Réseau 64, six bits machine à 1 : 64 + 63 = 127.' },
    { q: 'Combien d\'appareils peut-on adresser dans un réseau /27 ?',
      choices: [['32', 'Il y a 32 adresses, mais l\'adresse du réseau et celle de diffusion ne se donnent pas.'], '30', ['27', 'Le 27 du préfixe compte les bits de réseau, pas les machines.']],
      answer: 1, why: '5 bits machine : 2^5 = 32 adresses, moins le réseau et la diffusion : 30.' },
    { q: 'On veut découper 192.168.1.0/24 en 6 sous-réseaux égaux. Quel préfixe obtient-on ?',
      choices: [['/26', '2 bits empruntés ne donnent que 4 sous-réseaux.'], '/27 (3 bits empruntés, 8 sous-réseaux de 30 machines)', ['/30', 'Ce serait 64 sous-réseaux de 2 machines : bien trop découpé.']],
      answer: 1, why: 'Il faut 2^k ≥ 6, donc k = 3 : /24 + 3 = /27, 8 sous-réseaux (2 en réserve).' },
    { q: 'Un PC du car affiche l\'adresse 169.254.12.7. Que s\'est-il passé ?',
      choices: [['Il a reçu une adresse publique', '169.254.0.0/16 est réservée au lien local, jamais attribuée sur Internet.'], 'Il est en DHCP et aucun serveur DHCP ne lui a répondu', ['C\'est l\'adresse du routeur du car', 'Le routeur a une adresse fixe dans le plan du car.']],
      answer: 1, why: 'Sans réponse DHCP, la machine se donne une adresse 169.254.x.x : elle ne joindra que d\'autres machines dans le même cas.' },
    { q: 'Laquelle de ces adresses est une adresse privée ?',
      choices: [['172.32.5.1', '172.16.0.0/12 va de 172.16 à 172.31 : 172.32 est publique.'], ['8.8.8.8', 'C\'est une adresse publique (un serveur DNS sur Internet).'], '172.20.5.1'],
      answer: 2, why: '172.20 est dans 172.16.0.0/12, l\'une des trois plages privées de la RFC 1918 (avec 10/8 et 192.168/16).' },
    { q: 'Pourquoi ne peut-on pas donner l\'adresse 10.1.20.255 à un appareil du VLAN 20 (10.1.20.0/24) ?',
      choices: ['C\'est l\'adresse de diffusion : un paquet envoyé là va à toutes les machines du réseau', ['Parce que 255 est interdit dans une adresse IP', '255 est permis ailleurs : en /16, 10.1.20.255 serait une adresse de machine.'], ['Parce qu\'elle est réservée à la passerelle', 'La passerelle du car est en .1.']],
      answer: 0, why: 'En /24, la partie machine est le dernier octet : tout à 1, c\'est la diffusion.' },
  ],
};

// ======================================================================================
// 5. Unicast, diffusion, multicast
// ======================================================================================
function figDiffusion() {
  const f = figure(720, 190, 'Trois façons d\'envoyer : unicast, une copie par destinataire ; diffusion, une copie reçue par tout le réseau ; multicast, une copie pour les seuls abonnés du groupe');
  const panneau = (x, titre, sous, cibles, copies) => {
    f.append(rect(x, 24, 228, 160), txt(x + 114, 42, titre, 'co-t'), txt(x + 114, 176, sous, 'co-m'));
    const sx = x + 30, sy = 104;
    f.append(sv('circle', { cx: sx, cy: sy, r: 11, fill: C.amber }), txt(sx, sy + 26, 'source', 'co-m'));
    for (let i = 0; i < 5; i++) {
      const ty = 56 + i * 22, on = cibles[i];
      f.append(sv('circle', { cx: x + 200, cy: ty, r: 8, fill: on ? C.green : '#3a4652', stroke: C.grey }));
      if (on || copies === 'all') f.append(sv('path', { d: `M${sx + 11} ${sy} L${x + 192} ${ty}`, stroke: on ? C.green : C.red, strokeWidth: copies === 'n' ? 1.6 : 1, strokeDasharray: on ? '' : '3 3' }));
    }
  };
  panneau(10, 'Unicast', 'une copie par destinataire', [1, 0, 1, 0, 1], 'n');
  panneau(246, 'Diffusion (broadcast)', 'tout le VLAN reçoit', [1, 1, 1, 1, 1], 'all');
  panneau(482, 'Multicast', 'les abonnés du groupe seulement', [1, 0, 1, 0, 1], '1');
  f.append(txt(360, 14, 'Qui reçoit le paquet ?', 'co-t'));
  return f;
}
const FLUX = { prog: { nom: 'programme compressé', d: 10e6 }, audio: { nom: 'audio 8 voies (ST 2110-30)', d: 9.2e6 }, video: { nom: 'vidéo HD non compressée (ST 2110-20)', d: 2.2e9 } };
function demoDiffusion(host) {
  let mode = 'multicast', n = 6, flux = 'video';
  const M = 24, LIEN = 10e9;
  const fig = el('div', { class: 'co-figbox' });
  const rd = readout(['Copies envoyées par la source', 'Charge du lien de la source (10 Gb/s)', 'Machines qui reçoivent', 'Dont sans l\'avoir demandé', 'Adresse de destination']);
  const verdict = el('p', { class: 'co-verdict' });
  const fmtD = (b) => (b >= 1e9 ? `${fmtNum(b / 1e9, 1)} Gb/s` : `${fmtNum(b / 1e6, 1)} Mb/s`);
  function update() {
    const F = FLUX[flux], r = modesEnvoi(mode, n, M, F.d);
    rd.set('Copies envoyées par la source', String(r.copies)); rd.set('Charge du lien de la source (10 Gb/s)', `${fmtD(r.lienSource)} (${fmtNum(r.lienSource / LIEN * 100, 0)} %)`);
    rd.set('Machines qui reçoivent', `${r.recus} sur ${M}`); rd.set('Dont sans l\'avoir demandé', String(r.inutiles));
    rd.set('Adresse de destination', mode === 'unicast' ? 'celle de chaque destinataire (10.1.30.x)' : mode === 'broadcast' ? '10.1.30.255 (diffusion du réseau), MAC FF:FF:FF:FF:FF:FF' : 'un groupe : 239.1.1.1, MAC 01:00:5E:01:01:01');
    // le commutateur et ses 24 ports
    const f = figure(720, 120, `Commutateur de ${M} ports : en vert ceux qui reçoivent le flux et l'ont demandé, en rouge ceux qui le reçoivent sans l'avoir demandé`);
    f.append(rect(10, 30, 700, 56), txt(20, 22, `Source → commutateur : ${fmtD(r.lienSource)}`, r.lienSource > LIEN ? 'co-t' : 'co-s', 'start'));
    for (let i = 0; i < M; i++) {
      const x = 22 + i * 28.5, veut = i < n, recoit = mode === 'broadcast' || veut;
      f.append(sv('rect', { x, y: 44, width: 22, height: 28, rx: 2, fill: !recoit ? '#3a4652' : veut ? C.green : C.red }), txt(x + 11, 102, String(i + 1), 'co-m'));
    }
    fig.replaceChildren(f);
    if (r.lienSource > LIEN) { verdict.className = 'co-verdict ko'; verdict.textContent = `Le lien de la source déborde : ${n} copies de ${fmtD(F.d)} ne passent pas dans 10 Gb/s. En unicast, chaque destinataire de plus coûte une copie.`; }
    else if (r.inutiles > 0) { verdict.className = 'co-verdict ' + (F.d > 100e6 ? 'ko' : 'warn'); verdict.textContent = `${r.inutiles} machines reçoivent un flux qu'elles n'ont pas demandé : elles doivent le lire pour le jeter. La diffusion sert aux petits messages (ARP, DHCP), jamais à un flux.`; }
    else if (mode === 'multicast') { verdict.className = 'co-verdict ok'; verdict.textContent = 'Une seule copie quitte la source ; le commutateur (snooping IGMP) ne la duplique que vers les ports abonnés. C\'est ainsi que circulent les flux ST 2110.'; }
    else { verdict.className = 'co-verdict ok'; verdict.textContent = `Ça passe : ${n} copie${n > 1 ? 's' : ''}, chacune vers un destinataire. L'unicast convient aux échanges entre deux machines (commandes, fichiers, SRT vers la régie finale).`; }
  }
  host.append(el('div', { class: 'co-ctl' },
    choice('Mode', [['unicast', 'Unicast'], ['broadcast', 'Diffusion'], ['multicast', 'Multicast']], mode, (v) => { mode = v; update(); }),
    choice('Flux', Object.entries(FLUX).map(([k, v]) => [k, v.nom]), flux, (v) => { flux = v; update(); }),
    slider('Destinataires intéressés', 1, 20, n, 1, (v) => { n = v; update(); })),
  fig, rd.el, verdict);
  update();
}

/** @type {import('./index.js').Lesson} */
export const DIFFUSION = {
  id: 'reseau-diffusion', title: 'Unicast, diffusion, multicast : à qui s\'adresse un paquet', minutes: '7 min',
  essentials: [
    '**Unicast** : d\'une machine à une autre (une copie par destinataire). **Diffusion** (broadcast) : à toutes les machines du réseau. **Multicast** : aux seuls abonnés d\'un **groupe**.',
    'La diffusion s\'arrête au **routeur** : son domaine est le VLAN. Elle sert aux petits messages qui cherchent quelqu\'un (**ARP**, **DHCP**), jamais à un flux.',
    'Un flux vu par plusieurs récepteurs passe en **multicast** : une seule copie quitte la source, le réseau la duplique vers les abonnés (IGMP). Six copies unicast d\'une vidéo HD non compressée ne tiendraient pas dans 10 Gb/s.',
  ],
  figure: figDiffusion,
  demoTitle: 'Choisissez un mode, un flux et le nombre de destinataires : regardez la charge du lien de la source et qui reçoit quoi.',
  demo: demoDiffusion,
  body: `Un paquet IP porte une adresse de destination. Selon cette adresse, il va à une machine, à toutes, ou à un groupe.

**Unicast : d'une machine à une autre.** L'adresse de destination est celle d'un appareil (10.1.20.11). C'est le cas général : une commande du RCP vers sa CCU, un fichier vers le serveur, une page web, un flux SRT vers la régie finale. Pour servir dix destinataires, la source envoie **dix copies** : son lien porte dix fois le débit.

**Diffusion (broadcast) : à tout le réseau.** L'adresse de diffusion du sous-réseau (10.1.20.255 pour 10.1.20.0/24), ou 255.255.255.255, et l'adresse MAC **FF:FF:FF:FF:FF:FF**. Le commutateur envoie la trame sur **tous les ports du VLAN** ; chaque machine la lit. On s'en sert pour **chercher** quelqu'un dont on ne connaît pas l'adresse :
- **ARP** : « qui a l'adresse 10.1.20.11 ? Donnez-moi votre MAC » ;
- **DHCP** : « je viens d'arriver, un serveur peut-il me donner une adresse ? ».
Le **routeur arrête la diffusion** : le VLAN est un **domaine de diffusion**. C'est une des raisons de découper un car en VLAN : une machine bavarde ou une boucle de câblage (tempête de diffusion) ne noie que son VLAN.

**Multicast : à un groupe.** L'adresse de destination est un **groupe** (224.0.0.0 à 239.255.255.255 ; les flux ST 2110 du car sont en 239.x.x.x, la plage des réseaux privés). Les récepteurs qui veulent le flux s'**abonnent** au groupe par **IGMP** ; le commutateur (**snooping IGMP**) ne copie le flux que vers les ports abonnés, et les routeurs (PIM) vers les réseaux qui en ont besoin. La source n'envoie **qu'une copie**, quel que soit le nombre de récepteurs.

**Pourquoi c'est vital en car IP.** Une source HD non compressée pèse environ 2,2 Gb/s. Le mélangeur, le multiview, le serveur de ralentis et la mesure la veulent tous : en unicast, la caméra devrait envoyer quatre ou six copies et son lien de 10 Gb/s déborderait. En diffusion, toutes les machines du VLAN recevraient toutes les caméras. Le multicast envoie une copie, et le réseau la distribue.

**Sur le réseau, les trois cohabitent** : le contrôle et les fichiers en unicast, ARP et DHCP en diffusion, les flux média et PTP en multicast.`,
  plus: `- Une **adresse MAC multicast** commence par 01:00:5E, suivie des 23 derniers bits du groupe IP : 239.1.1.1 donne 01:00:5E:01:01:01.
- Sans snooping IGMP, un commutateur traite le multicast comme une diffusion : tout le VLAN reçoit tous les flux. C'est la panne classique d'un switch mal configuré en ST 2110.
- **Anycast** : la même adresse portée par plusieurs serveurs ; le réseau mène au plus proche (serveurs DNS publics, CDN).
- En IPv6, la diffusion disparaît : le multicast fait son travail (ARP devient la découverte de voisins).`,
  car: { text: 'Dans le car IP, chaque caméra envoie ses flux en multicast (groupes 239.1.x.x et 239.2.x.x), et le poste Réseau montre les abonnements IGMP de chaque port. Dans le car SDI, la table ARP des switchs montre les réponses aux diffusions ARP.', station: 'reseau' },
  terms: ['diffusion', 'groupe', 'igmp', 'snooping', 'arp', 'mac-mcast'],
  competences: ['3.6', '2.11', '2.10'], article: 'reseau',
  quiz: [
    { q: 'Six récepteurs veulent la même vidéo HD non compressée (2,2 Gb/s). En unicast, que porte le lien de 10 Gb/s de la source ?',
      choices: [['2,2 Gb/s', 'C\'est le cas du multicast : une seule copie.'], '13,2 Gb/s : il déborde', ['Rien : le commutateur fait les copies', 'En unicast, c\'est la source qui envoie une copie à chacun.']],
      answer: 1, why: 'Six copies de 2,2 Gb/s = 13,2 Gb/s : plus que les 10 Gb/s du lien. D\'où le multicast.' },
    { q: 'Où s\'arrête une trame de diffusion ?',
      choices: [['Nulle part : elle fait le tour d\'Internet', 'Heureusement non : le routeur ne la fait pas suivre.'], 'Au routeur : elle reste dans son VLAN (son domaine de diffusion)', ['Au premier commutateur', 'Le commutateur l\'envoie au contraire sur tous les ports du VLAN.']],
      answer: 1, why: 'Le VLAN est un domaine de diffusion ; seul un routeur pourrait le quitter, et il ne fait pas suivre la diffusion.' },
    { q: 'Quel message utilise la diffusion ?',
      choices: ['Une question ARP : « qui a l\'adresse 10.1.20.11 ? »', ['Un flux vidéo ST 2110', 'Les flux passent en multicast : seuls les abonnés les reçoivent.'], ['Une commande du RCP à sa CCU', 'Elle va à une seule machine connue : unicast.']],
      answer: 0, why: 'ARP cherche une machine dont on ne connaît pas encore la MAC : il demande à tout le réseau.' },
    { q: 'Comment un commutateur sait-il vers quels ports copier un flux multicast ?',
      choices: [['Il l\'envoie partout, toujours', 'C\'est ce qu\'il fait sans snooping : tout le VLAN est noyé.'], 'Il écoute les abonnements IGMP des récepteurs (snooping) et ne copie que vers ces ports', ['La source lui envoie la liste des récepteurs', 'La source ne connaît pas ses récepteurs : elle envoie au groupe.']],
      answer: 1, why: 'Le snooping IGMP lit les demandes d\'abonnement et tient la liste des ports par groupe.' },
    { q: 'Laquelle de ces adresses est un groupe multicast ?',
      choices: [['10.1.20.255', 'C\'est l\'adresse de diffusion de 10.1.20.0/24.'], '239.1.1.1', ['192.168.1.1', 'Adresse privée de machine (souvent une box).']],
      answer: 1, why: 'Les groupes multicast vont de 224.0.0.0 à 239.255.255.255 ; 239.x.x.x est la plage des réseaux privés.' },
    { q: 'Une boucle de câblage provoque une tempête de diffusion dans le VLAN 30. Qui est touché ?',
      choices: [['Tout le car', 'Les autres VLAN sont des domaines de diffusion séparés.'], 'Les machines du VLAN 30', ['Personne : les commutateurs filtrent la diffusion', 'Ils la copient sur tous les ports du VLAN : c\'est leur rôle.']],
      answer: 1, why: 'La tempête reste dans son domaine de diffusion : c\'est un intérêt des VLAN.' },
  ],
};

// ======================================================================================
// 6. Les services du réseau : DHCP, DNS, NAT
// ======================================================================================
function figServices() {
  const f = figure(720, 230, 'À gauche, l\'échange DHCP en quatre messages : Discover, Offer, Request, Ack. Au centre, une question DNS : le nom devient une adresse. À droite, le NAT de la box : les adresses privées sortent sous l\'adresse publique');
  // DHCP
  f.append(txt(120, 16, 'DHCP : obtenir une adresse', 'co-t'));
  f.append(sv('line', { x1: 40, y1: 30, x2: 40, y2: 220, stroke: C.grey }), sv('line', { x1: 200, y1: 30, x2: 200, y2: 220, stroke: C.grey }));
  f.append(txt(40, 30, 'machine', 'co-m'), txt(200, 30, 'serveur', 'co-m'));
  const msg = (y, a, b, s, col) => { f.append(sv('path', { d: `M${a} ${y} L${b} ${y}`, stroke: col, strokeWidth: 1.5 }), sv('path', { d: b > a ? `M${b - 6} ${y - 4} L${b} ${y} L${b - 6} ${y + 4}` : `M${b + 6} ${y - 4} L${b} ${y} L${b + 6} ${y + 4}`, fill: 'none', stroke: col, strokeWidth: 1.5 }), txt((a + b) / 2, y - 5, s, 'co-s')); };
  msg(60, 40, 200, 'Discover (diffusion)', C.amber); msg(100, 200, 40, 'Offer : 10.1.90.57 ?', C.green);
  msg(140, 40, 200, 'Request : je la prends', C.amber); msg(180, 200, 40, 'Ack : à vous pour 24 h', C.green);
  f.append(txt(120, 214, 'adresse, masque, passerelle, DNS', 'co-m'));
  // DNS
  f.append(rect(250, 40, 210, 150, C.violet), txt(355, 16, 'DNS : un nom → une adresse', 'co-t'));
  f.append(txt(355, 70, 'serveur.chaine.fr ?', 'co-s'), sv('path', { d: 'M355 80 L355 110', stroke: C.violet, strokeWidth: 1.5 }), txt(355, 130, '203.0.113.10', 'co-t'));
  f.append(txt(355, 160, 'UDP, port 53', 'co-m'), txt(355, 178, 'NMOS : DNS-SD trouve le registre', 'co-m'));
  // NAT
  f.append(txt(600, 16, 'NAT : sortir sur Internet', 'co-t'));
  f.append(rect(490, 40, 220, 150, C.cyan));
  f.append(txt(600, 64, '192.168.1.20 : 51 000', 'co-s'), txt(600, 84, '192.168.1.21 : 51 000', 'co-s'));
  f.append(sv('path', { d: 'M600 94 L600 118', stroke: C.cyan, strokeWidth: 1.5 }), txt(600, 136, 'box : 86.x.x.x', 'co-t'));
  f.append(txt(600, 158, 'ports 40 001 et 40 002', 'co-s'), txt(600, 178, 'une adresse publique pour tous', 'co-m'));
  return f;
}
const MACHINES_NAT = [{ nom: 'PC de la régie', ip: '192.168.1.20' }, { nom: 'Encodeur SRT', ip: '192.168.1.30' }, { nom: 'Téléphone d\'un invité', ip: '192.168.1.57' }];
function demoServices(host) {
  let cgnat = false, redir = false;
  const table = [];
  let nextPort = 40001;
  const tableBox = el('div', { class: 'co-figbox' }), journal = el('ul', { class: 'co-journal' }), verdict = el('p', { class: 'co-verdict' });
  const publique = () => (cgnat ? '100.71.20.9 (partagée, CGNAT)' : '86.247.12.31');
  const log = (s, ok) => { journal.append(el('li', {}, (ok ? '✔ ' : '✘ ') + s)); while (journal.children.length > 5) journal.firstChild?.remove(); };
  function draw() {
    const t = el('table', { class: 'co-table' }, el('thead', {}, el('tr', {}, ...['Machine (privée)', 'Port', '→', 'Vu d\'Internet', 'Destination'].map((h) => el('th', {}, h)))));
    const tb = el('tbody');
    for (const r of table) tb.append(el('tr', {}, el('td', {}, r.ip), el('td', {}, String(r.port)), el('td', {}, '→'), el('td', {}, `${publique().split(' ')[0]} : ${r.pub}`), el('td', {}, r.dst)));
    if (redir) tb.append(el('tr', {}, el('td', {}, '192.168.1.20'), el('td', {}, '8080'), el('td', {}, '←'), el('td', {}, `${publique().split(' ')[0]} : 8080`), el('td', {}, 'redirection fixe')));
    if (!table.length && !redir) tb.append(el('tr', {}, el('td', { colspan: 5 }, 'table vide : aucune connexion en cours')));
    t.append(tb); tableBox.replaceChildren(t);
  }
  const sortir = (m) => {
    const port = 50000 + Math.floor(Math.random() * 10000);
    const r = { ip: m.ip, port, pub: nextPort++, dst: 'serveur.chaine.fr (203.0.113.10) : 443' };
    table.push(r); if (table.length > 6) table.shift();
    log(`${m.nom} (${m.ip}:${port}) → 203.0.113.10:443. La box remplace la source par ${publique().split(' ')[0]}:${r.pub} et note la correspondance ; la réponse reviendra à ${m.ip}.`, true);
    verdict.className = 'co-verdict ok'; verdict.textContent = 'Sortie autorisée : la box traduit (NAT) et retrouvera la machine au retour grâce au port.';
    draw();
  };
  const entrer = () => {
    if (cgnat) { log('Un invité sur Internet appelle l\'adresse de la box… mais 100.71.20.9 n\'est pas joignable d\'Internet : c\'est une adresse partagée de l\'opérateur, sa propre box NAT est devant la vôtre.', false); verdict.className = 'co-verdict ko'; verdict.textContent = 'Adresse partagée par l\'opérateur (CGNAT) : aucune redirection n\'y fera rien. Il faut un tunnel (ex. Cloudflare) : c\'est la machine qui sort et garde la connexion ouverte.'; }
    else if (!redir) { log('Un invité sur Internet appelle 86.247.12.31:8080. Aucune ligne de la table ne correspond : la box jette le paquet.', false); verdict.className = 'co-verdict ko'; verdict.textContent = 'Refusé : le NAT ne laisse entrer que les réponses à ce qui est sorti. Pour accueillir quelqu\'un, il faut une redirection de port (à la main ou par UPnP).'; }
    else { log('Un invité appelle 86.247.12.31:8080 : la redirection l\'envoie à 192.168.1.20:8080, le PC qui héberge la partie.', true); verdict.className = 'co-verdict ok'; verdict.textContent = 'Entrée permise par la redirection de port : seul le port 8080 mène au PC, le reste du réseau reste caché.'; }
    draw();
  };
  host.append(
    el('div', { class: 'co-ctl' },
      choice('Adresse de la box', [['pub', 'publique'], ['cgnat', 'partagée (CGNAT)', 'Fréquent en fibre et en 4G : l\'opérateur partage une adresse publique entre plusieurs clients']], 'pub', (v) => { cgnat = v === 'cgnat'; table.length = 0; draw(); }),
      choice('Redirection du port 8080 vers le PC', [['non', 'aucune'], ['oui', 'active (UPnP ou à la main)']], 'non', (v) => { redir = v === 'oui'; draw(); })),
    el('div', { class: 'co-btns' }, ...MACHINES_NAT.map((m) => el('button', { type: 'button', class: 'btn small', onclick: () => sortir(m) }, `${m.nom} sort`)), el('button', { type: 'button', class: 'btn small primary', onclick: entrer }, 'Quelqu\'un d\'Internet entre')),
    tableBox, verdict, journal);
  draw();
}

/** @type {import('./index.js').Lesson} */
export const SERVICES = {
  id: 'reseau-services', title: 'Les services du réseau : DHCP, DNS et NAT', minutes: '8 min',
  essentials: [
    '**DHCP** donne à une machine qui arrive son adresse, son masque, sa passerelle et son DNS, en quatre messages (Discover, Offer, Request, Ack). Les appareils du car, eux, ont souvent une **adresse fixe**.',
    '**DNS** traduit un nom (serveur.chaine.fr) en adresse IP. Sans DNS, « Internet ne marche plus » alors que le ping vers une adresse passe.',
    '**NAT** : la box fait sortir toutes les adresses privées sous **une** adresse publique et note chaque connexion. Rien n\'entre sans y avoir été invité, sauf par une **redirection de port**.',
  ],
  figure: figServices,
  demoTitle: 'Faites sortir des machines vers Internet, puis essayez d\'entrer depuis Internet : avec ou sans redirection de port, avec une adresse publique ou partagée.',
  demo: demoServices,
  body: `Une adresse ne suffit pas pour se servir d'un réseau : il faut l'obtenir, trouver les machines par leur nom, et sortir vers Internet. Trois services s'en chargent.

**DHCP : recevoir une adresse.** Une machine réglée en DHCP ne connaît rien en arrivant. Elle crie par **diffusion** (Discover) ; le serveur DHCP du VLAN lui propose une adresse libre (Offer) ; elle la demande (Request) ; le serveur confirme (Ack) avec le **masque**, la **passerelle**, le **serveur DNS** et une **durée de bail** (quelques heures). La machine renouvelle son bail avant la fin.
- Sans réponse, la machine se donne une adresse **169.254.x.x** : rien ne marche.
- Le DHCP ne traverse pas les routeurs (diffusion) : un serveur par VLAN, ou un **relais DHCP** sur le routeur.
- Dans un car, les appareils de production (CCU, RCP, mélangeur, matrices) ont une **adresse fixe**, notée dans le plan : on doit toujours savoir où ils sont. Le DHCP sert aux PC de passage et au Wi-Fi des invités. Une **réservation** DHCP donne toujours la même adresse à la même MAC.

**DNS : des noms plutôt que des adresses.** On retient « serveur.chaine.fr », pas 203.0.113.10. La machine demande au **serveur DNS** (UDP, port 53) l'adresse qui correspond au nom, et garde la réponse un moment. Si le DNS ne répond pas, le ping vers une adresse passe mais rien ne marche par son nom : c'est la panne « Internet ne marche plus » la plus fréquente. Dans un car IP, NMOS trouve son registre par **DNS-SD** (le service est annoncé dans le DNS, ou en multicast par mDNS).

**NAT : partager une adresse publique.** Les adresses privées (10.x, 192.168.x) ne circulent pas sur Internet. À la sortie, la box (ou le routeur du car) **remplace l'adresse source** par son adresse publique et un **port** choisi, et note la correspondance dans sa **table NAT**. La réponse revient sur ce port : la box la rend à la bonne machine.
- Conséquence : **rien n'entre** sans être une réponse. C'est une protection de fait.
- Pour accueillir une connexion (héberger une partie, recevoir un flux SRT en mode « écoute »), il faut une **redirection de port** : « tout ce qui arrive sur le port 8080 va à 192.168.1.20 ». Elle se règle à la main dans la box, ou la machine la demande elle-même par **UPnP**.
- Beaucoup d'opérateurs (fibre, 4G/5G) donnent à la box une **adresse partagée** (100.64.0.0/10, CGNAT) : leur propre NAT est devant. Aucune redirection n'y fait rien ; on passe par un **tunnel** ou un relais, ouvert depuis l'intérieur.

C'est exactement ce que fait le simulateur pour « Inviter par Internet » : il demande à la box d'ouvrir le port (UPnP), et si elle refuse ou si l'adresse est partagée, il crée un tunnel.`,
  plus: `- **NTP** donne l'heure aux machines (UDP 123) ; **SNMP** les supervise (UDP 161) ; les deux passent par la passerelle.
- Le pare-feu d'une box applique le même principe que le NAT : ce qui sort ouvre le chemin du retour, le reste est refusé.
- \`ipconfig /all\` (Windows) ou \`ip addr\` et \`resolvectl\` (Linux) montrent l'adresse, la passerelle et le DNS reçus ; \`nslookup nom\` interroge le DNS.
- Deux serveurs DHCP sur le même VLAN (une box branchée par erreur) donnent des adresses fausses à la moitié des machines.`,
  car: { text: 'Au poste Réseau (car SDI) : le routeur du car fait le NAT vers Internet et sert le DHCP des invités (VLAN 90) ; les appareils de production ont des adresses fixes. Dans le salon de coopération, « Inviter par Internet » ouvre la box par UPnP ou crée un tunnel.', station: 'reseau' },
  terms: ['dhcp', 'dns', 'nat', 'pare-feu', 'adresses-privees', 'port'],
  competences: ['3.6', '2.3', '2.13'], article: 'reseau',
  quiz: [
    { q: 'Dans quel ordre se déroule l\'échange DHCP ?',
      choices: ['Discover, Offer, Request, Ack', ['Request, Offer, Discover, Ack', 'La machine ne peut rien demander avant de savoir qu\'un serveur existe : elle commence par chercher (Discover).'], ['Offer, Discover, Ack, Request', 'C\'est la machine qui parle en premier, le serveur ne la connaît pas encore.']],
      answer: 0, why: 'La machine cherche (Discover), le serveur propose (Offer), la machine choisit (Request), le serveur confirme (Ack).' },
    { q: 'Le ping vers 203.0.113.10 répond, mais « serveur.chaine.fr » est introuvable. Que vérifier ?',
      choices: [['La passerelle', 'Le ping vers une adresse extérieure passe : la passerelle fonctionne.'], 'Le serveur DNS de la machine', ['Le câble', 'Le ping passe : le câble est bon.']],
      answer: 1, why: 'L\'adresse est joignable, seul le nom ne se traduit pas : c\'est le DNS.' },
    { q: 'Pourquoi les CCU et le mélangeur du car ont-ils une adresse fixe plutôt qu\'une adresse DHCP ?',
      choices: [['Parce que le DHCP est interdit dans un car', 'Il y sert, pour les invités et les PC de passage.'], 'Pour qu\'ils soient toujours à la même adresse, notée dans le plan et connue des autres appareils', ['Parce qu\'une adresse fixe va plus vite', 'Le débit ne dépend pas de la façon d\'obtenir l\'adresse.']],
      answer: 1, why: 'Les RCP, la grille, la supervision s\'adressent à eux par leur adresse : elle ne doit jamais changer.' },
    { q: 'Que fait la box quand le PC 192.168.1.20 ouvre une page sur Internet ?',
      choices: ['Elle remplace l\'adresse source par son adresse publique et un port, et note la correspondance pour la réponse', ['Elle fait suivre le paquet tel quel', 'L\'adresse 192.168.1.20 est privée : sur Internet, la réponse ne saurait pas revenir.'], ['Elle bloque : une adresse privée ne peut pas sortir', 'Elle sort, traduite : c\'est le rôle du NAT.']],
      answer: 0, why: 'Le NAT traduit à la sortie et retraduit au retour, grâce à sa table.' },
    { q: 'Un ami sur Internet n\'arrive pas à joindre la partie hébergée sur votre PC, derrière la box. Que manque-t-il, le plus souvent ?',
      choices: [['Une adresse IP au PC', 'Le PC en a une : c\'est l\'entrée par la box qui bloque.'], 'Une redirection de port sur la box (ou un tunnel si l\'adresse est partagée)', ['Un serveur DHCP', 'Le DHCP ne fait pas entrer les connexions venues d\'Internet.']],
      answer: 1, why: 'Le NAT ne laisse entrer que les réponses. Une redirection ouvre un port vers le PC ; en CGNAT, seul un tunnel fonctionne.' },
    { q: 'La box a l\'adresse 100.71.20.9. Qu\'en conclure ?',
      choices: [['C\'est une adresse privée de la RFC 1918', 'Les plages RFC 1918 sont 10/8, 172.16/12 et 192.168/16.'], 'C\'est une adresse partagée par l\'opérateur (CGNAT) : une redirection de port ne servira à rien', ['C\'est une adresse multicast', 'Le multicast va de 224 à 239.']],
      answer: 1, why: '100.64.0.0/10 est réservée au NAT des opérateurs (RFC 6598) : la box n\'est pas joignable directement depuis Internet.' },
  ],
};

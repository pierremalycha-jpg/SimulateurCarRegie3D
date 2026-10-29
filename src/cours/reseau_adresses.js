// @ts-check
import { el } from '../util.js';
import { sv, figure, choice, slider, readout, fmtNum } from './kit.js';
import { parseIp, infoReseau, decouper, typeAdresse, classe, portee, bits32, routeurNat } from './ip_calc.js';

// ----------------------------------------------------------------------------------
// Chapitre « Le réseau », partie « Adresser et acheminer » : l'adresse réseau et l'adresse de diffusion (calcul
// binaire, découpage en sous-réseaux), les types d'adresses (unicast, diffusion, multicast ; privées, publiques,
// spéciales ; IPv6), DHCP et DNS, la traduction d'adresses (NAT) et les ports. Calculs : cours/ip_calc.js.
// Normes : RFC 950, 4632 (CIDR), 919 (diffusion), 1918, 3927, 6598, 5771, 4607 ; 8200, 4291, 5952 (IPv6) ;
// 2131 (DHCP), 1034 et 1035 (DNS), 6762 et 6763 (mDNS, DNS-SD) ; 3022 (NAT).
// ----------------------------------------------------------------------------------
const NET = '#ffd38a', HOST = '#7fd3f3';

/** les 32 bits d'une adresse en cases, partie réseau et partie appareil colorées (HTML, pour la manipulation) */
function rangee(label, n, p, valeur) {
  const b = bits32(n).replace(/\./g, '');
  const cases = [];
  for (let i = 0; i < 32; i++) {
    if (i && i % 8 === 0) cases.push(el('i', { class: 'co-bin-pt' }, '.'));
    cases.push(el('b', { class: i < p ? 'n' : 'h' }, b[i]));
  }
  return el('div', { class: 'co-bin-r' }, el('span', { class: 'co-bin-l' }, label), el('span', { class: 'co-bin-c' }, ...cases), el('code', {}, valeur));
}

// ======================================================================================
// Adresse réseau, diffusion, sous-réseaux
// ======================================================================================
function figAdresses() {
  const f = figure(440, 176, 'L\'adresse 10.1.20.31 et le masque /24 en binaire : les 24 premiers bits (en jaune) forment la partie réseau, les 8 derniers (en bleu) la partie appareil. Un ET logique avec le masque donne l\'adresse réseau 10.1.20.0 ; tous les bits d\'appareil à 1 donnent l\'adresse de diffusion 10.1.20.255.');
  const rows = [['adresse', parseIp('10.1.20.31'), '10.1.20.31'], ['masque /24', parseIp('255.255.255.0'), '255.255.255.0'], ['réseau (ET)', parseIp('10.1.20.0'), '10.1.20.0'], ['diffusion', parseIp('10.1.20.255'), '10.1.20.255']];
  const x0 = 64, cw = 8.2, gap = 4;
  f.append(sv('text', { x: x0, y: 12, class: 'co-s' }, 'partie réseau (24 bits)'), sv('text', { x: x0 + 24 * cw + 3 * gap, y: 12, class: 'co-s' }, 'appareil (8)'));
  rows.forEach(([lab, n, txt], r) => {
    const y = 20 + r * 38, bits = bits32(/** @type {number} */ (n)).replace(/\./g, '');
    f.append(sv('text', { x: 4, y: y + 15, class: 'co-s' }, String(lab)));
    for (let i = 0; i < 32; i++) {
      const x = x0 + i * cw + Math.floor(i / 8) * gap;
      f.append(sv('rect', { x, y, width: cw - 1.4, height: 22, rx: 1.5, fill: i < 24 ? NET : HOST, opacity: r === 1 ? 0.55 : 0.9 }), sv('text', { x: x + (cw - 1.4) / 2, y: y + 15, textAnchor: 'middle', class: 'co-bit' }, bits[i]));
    }
    f.append(sv('text', { x: 436, y: y + 15, textAnchor: 'end', class: 'co-m' }, String(txt)));
  });
  f.append(sv('text', { x: 220, y: 172, textAnchor: 'middle', class: 'co-s' }, 'Réseau : bits d\'appareil à 0. Diffusion : bits d\'appareil à 1. Entre les deux : 254 appareils.'));
  return f;
}
function demoAdresses(host) {
  let ip = '10.1.20.130', p = 26, q = 28;
  const inp = /** @type {HTMLInputElement} */ (el('input', { type: 'text', class: 'co-input', value: ip, 'aria-label': 'Adresse IPv4', spellcheck: 'false', inputmode: 'decimal' }));
  const bin = el('div', { class: 'co-bin', 'aria-label': 'L\'adresse, le masque, le réseau et la diffusion en binaire' });
  const R = readout(['Masque', 'Adresse réseau', 'Adresse de diffusion', 'Plage des appareils', 'Nombre d\'appareils', 'Taille du bloc', 'Cette adresse est']);
  const sub = el('div', { class: 'co-sub' });
  const qBox = el('div');
  const draw = () => {
    const n = parseIp(ip);
    if (n == null) { bin.replaceChildren(el('p', { class: 'co-note' }, 'Écris une adresse IPv4 : quatre nombres de 0 à 255 séparés par des points.')); return; }
    const I = /** @type {NonNullable<ReturnType<typeof infoReseau>>} */ (infoReseau(n, p));
    bin.replaceChildren(rangee('adresse', n, p, I.ip), rangee(`masque /${p}`, /** @type {number} */ (parseIp(I.masque)), p, I.masque), rangee('réseau (ET)', /** @type {number} */ (parseIp(I.reseau)), p, I.reseau), I.broadcast ? rangee('diffusion', /** @type {number} */ (parseIp(I.broadcast)), p, I.broadcast) : el('p', { class: 'co-note' }, `/${p} : pas d'adresse de diffusion`));
    R.set('Masque', `/${p} = ${I.masque} (joker ${I.joker})`);
    R.set('Adresse réseau', `${I.reseau}/${p}`);
    R.set('Adresse de diffusion', I.broadcast || '— (lien point à point /31 ou adresse seule /32)');
    R.set('Plage des appareils', `${I.premier} à ${I.dernier}`);
    R.set('Nombre d\'appareils', `${fmtNum(I.hotes)} (2^${32 - p} = ${fmtNum(I.taille)} adresses${p < 31 ? ', moins le réseau et la diffusion' : ''})`);
    R.set('Taille du bloc', p >= 24 ? `${I.taille} adresses dans le dernier nombre` : p >= 16 ? `${I.taille / 256} valeurs du troisième nombre` : `${fmtNum(I.taille / 65536)} valeurs du deuxième nombre`);
    R.set('Cette adresse est', I.estReseau ? 'l\'adresse du réseau : à ne donner à aucun appareil' : I.estBroadcast ? 'l\'adresse de diffusion : à ne donner à aucun appareil' : 'une adresse d\'appareil');
    // le découpage
    const opts = [p + 1, p + 2, p + 3, p + 4].filter((x) => x <= 30);
    if (!opts.includes(q)) q = opts[Math.min(1, opts.length - 1)] ?? p;
    qBox.replaceChildren(opts.length ? choice('Découper ce réseau en', opts.map((x) => [String(x), `/${x}`]), String(q), (v) => { q = +v; draw(); }) : el('p', { class: 'co-note' }, 'Un /30 ne se découpe plus utilement.'));
    const L = opts.length ? decouper(I.reseau, p, q) : [];
    sub.replaceChildren(...(L.length ? [el('p', { class: 'co-note' }, `${L.length} sous-réseaux /${q} de ${fmtNum(/** @type {any} */ (L[0]).hotes)} appareils chacun :`), el('ol', { class: 'co-trace' }, ...L.slice(0, 8).map((s) => el('li', { class: s && s.reseau === infoReseau(n, q)?.reseau ? 'on' : '' }, `${s?.reseau}/${q} : appareils ${s?.premier} à ${s?.dernier}, diffusion ${s?.broadcast ?? '—'}${s && s.reseau === infoReseau(n, q)?.reseau ? '  ← l\'adresse choisie' : ''}`)), L.length > 8 ? el('li', {}, `… et ${L.length - 8} autres`) : null)] : []));
  };
  inp.addEventListener('input', () => { ip = inp.value.trim(); draw(); });
  host.append(el('div', { class: 'co-ctl' },
    el('label', { class: 'co-slider' }, el('span', {}, 'Adresse'), inp),
    slider('Préfixe (masque)', 8, 30, p, 1, (v) => { p = v; draw(); }, (v) => `/${v}`),
    el('div', { class: 'co-chips' }, ...[['10.1.20.130', 26], ['10.1.20.31', 24], ['10.20.1.7', 22], ['192.168.1.200', 25], ['172.16.5.9', 30]].map(([a, pp]) => el('button', { type: 'button', class: 'co-chip', onclick: () => { ip = String(a); p = +pp; inp.value = ip; /** @type {HTMLInputElement} */ (host.querySelector('input[type=range]')).value = String(p); /** @type {HTMLElement} */ (host.querySelector('.co-slider output')).textContent = `/${p}`; draw(); } }, `${a}/${pp}`)))),
  bin, R.el, qBox, sub);
  draw();
}

/** @type {import('./index.js').Lesson} */
export const ADRESSES = {
  id: 'reseau-adresses', title: 'Adresse réseau, diffusion et sous-réseaux', minutes: '9 min',
  essentials: [
    'L\'**adresse réseau** a tous ses bits d\'appareil à 0 (un ET logique entre l\'adresse et le masque) ; l\'**adresse de diffusion** les a tous à 1. Ni l\'une ni l\'autre ne se donne à un appareil.',
    'Un préfixe /p laisse 32 − p bits d\'appareil : 2^(32 − p) adresses, dont **2^(32 − p) − 2 appareils**. /24 : 254 ; /26 : 62 ; /22 : 1 022.',
    '**Découper** un réseau, c\'est allonger le préfixe : un /24 donne deux /25 ou quatre /26, chacun avec son réseau, sa diffusion et sa passerelle.',
  ],
  figure: figAdresses,
  demoTitle: 'Écris une adresse, fais glisser le préfixe : regarde les bits basculer de la partie réseau à la partie appareil, puis découpe le réseau.',
  demo: demoAdresses,
  body: `Une adresse IPv4 est un nombre de **32 bits**, écrit en quatre nombres de 0 à 255 pour qu'on puisse le lire. Pour la comprendre, il faut parfois revenir au binaire : chaque nombre fait 8 bits, de poids 128, 64, 32, 16, 8, 4, 2 et 1. 20 = 16 + 4 s'écrit 00010100 ; 130 = 128 + 2 s'écrit 10000010.

**Le masque** dit où s'arrête la partie **réseau**. /24 veut dire 24 bits à 1 puis 8 à 0, soit 255.255.255.0. Tout ce qui est sous les 1 du masque désigne le réseau ; le reste désigne l'**appareil**.

**L'adresse réseau** s'obtient par un **ET logique** bit à bit entre l'adresse et le masque : un bit reste s'il est sous un 1, devient 0 sinon. 10.1.20.31 ET 255.255.255.0 = **10.1.20.0**. C'est le nom du réseau, celui qu'on écrit dans les tables de routage et le plan d'adressage ; aucun appareil ne le porte.

**L'adresse de diffusion** (broadcast) a tous les bits d'appareil à **1** : 10.1.20.255. Un paquet qui lui est envoyé atteint toutes les machines du sous-réseau ; il ne traverse pas le routeur. Elle non plus ne se donne à aucun appareil : en /24, les appareils vont de **.1 à .254**, soit 254.

**Quand le masque coupe un octet**, on raisonne par **blocs**. Un /26 s'écrit 255.255.255.**192** : le dernier nombre se découpe en blocs de 256 − 192 = **64** adresses, qui commencent à 0, 64, 128 et 192. Pour 10.1.20.130/26 : 130 est dans le bloc qui commence à 128. Réseau **10.1.20.128**, diffusion **10.1.20.191** (128 + 64 − 1), appareils de .129 à .190, soit 62. La même méthode marche sur le troisième nombre : un /22 (255.255.**252**.0) fait des blocs de 4 sur le troisième nombre ; 10.20.1.7/22 est dans 10.20.0.0 à 10.20.3.255.

**Combien d'appareils ?** 32 − p bits d'appareil donnent 2^(32 − p) adresses, moins deux (le réseau et la diffusion) :
- /30 : 2 appareils (un lien entre deux routeurs ; /31 en garde 2 sans diffusion, RFC 3021) ;
- /28 : 14 ; /26 : 62 ; /25 : 126 ; /24 : 254 ; /23 : 510 ; /22 : 1 022 ; /16 : 65 534.

**Découper un réseau en sous-réseaux.** On allonge le préfixe : 10.1.20.0/24 donne deux /25 (0 à 127, 128 à 255), quatre /26, huit /27… Chaque sous-réseau a son adresse réseau, sa diffusion et sa passerelle (souvent la première adresse). On peut aussi mélanger les tailles (**VLSM**) : un /26 pour 50 caméras, un /28 pour 10 panneaux d'intercom, des /31 pour les liens entre routeurs. Le plan d'adressage s'écrit **avant** l'installation : un tableau « VLAN, réseau, passerelle, plage, qui ».`,
  plus: `- Le **joker** (wildcard) est l'inverse du masque : 0.0.0.255 pour un /24 ; on le rencontre dans les listes d'accès des routeurs.
- Un routeur ne fait pas suivre une diffusion vers un autre réseau (la « diffusion dirigée » est désactivée par défaut depuis la RFC 2644, en 1999) : elle servait à des attaques par amplification.
- Pour retrouver le préfixe qui loge n appareils : la plus petite puissance de 2 qui dépasse n + 2. 200 appareils : 256 adresses, un /24 ; 500 : 512 adresses, un /23.
- Dans le car IP, les liens entre leaves et spines sont des /31 : deux adresses, une à chaque bout, sans diffusion.`,
  car: { text: 'Au poste Réseau (car SDI) : un /24 par VLAN, 10.1.<VLAN>.0/24, passerelle en .1, et la même fin d\'adresse pour la caméra n sur toutes les lignes. Le réseau de contrôle du car IP est un /22 (10.20.0.0 à 10.20.3.255) ; ses liens entre leaves et spines sont des /31.', station: 'reseau' },
  terms: ['adresse-reseau', 'broadcast-ip', 'cidr', 'sous-reseau', 'passerelle'],
  competences: ['3.6', '2.10'], article: 'reseau',
  quiz: [
    { q: 'Quelle est l\'adresse réseau de 10.1.20.130/26 ?',
      choices: [['10.1.20.0', 'Ce serait vrai en /24. En /26, le dernier nombre se découpe en blocs de 64 : 0, 64, 128, 192.'], '10.1.20.128', ['10.1.20.192', 'C\'est le début du bloc suivant : 130 est entre 128 et 191.']],
      answer: 1, why: '/26 = 255.255.255.192 : blocs de 64 adresses. 130 tombe dans le bloc 128 à 191 : réseau 10.1.20.128, diffusion 10.1.20.191.' },
    { q: 'Quelle est l\'adresse de diffusion du réseau 10.20.0.0/22 ?',
      choices: [['10.20.0.255', 'C\'est la diffusion d\'un /24. En /22, le réseau s\'étend sur quatre valeurs du troisième nombre, 0 à 3.'], ['10.20.255.255', 'Ce serait un /16 : un /22 ne garde que 10 bits d\'appareil.'], '10.20.3.255'],
      answer: 2, why: '/22 laisse 10 bits d\'appareil : 2 bits du troisième nombre et les 8 du quatrième. Tous à 1 : 10.20.3.255.' },
    { q: 'Combien d\'appareils peut-on adresser dans un /26 ?',
      choices: ['62', ['64', 'C\'est le nombre d\'adresses du bloc ; l\'adresse réseau et la diffusion ne se donnent pas.'], ['26', 'C\'est la longueur du préfixe, pas un nombre d\'adresses.']],
      answer: 0, why: '32 − 26 = 6 bits d\'appareil : 2^6 = 64 adresses, moins le réseau et la diffusion : 62 appareils.' },
    { q: 'Comment obtient-on l\'adresse réseau à partir d\'une adresse et de son masque ?',
      choices: [['On additionne l\'adresse et le masque', 'Une addition déborderait et ne voudrait rien dire : on combine bit à bit.'], 'Par un ET logique bit à bit : on garde les bits sous les 1 du masque, les autres passent à 0', ['On remplace le dernier nombre par 0', 'Seulement en /24. En /26 ou /22, la coupure n\'est pas sur un nombre entier.']],
      answer: 1, why: 'Le ET garde la partie réseau et met à 0 la partie appareil, quelle que soit la longueur du masque.' },
    { q: 'On découpe 10.1.20.0/24 en quatre sous-réseaux égaux. Quel est leur préfixe ?',
      choices: [['/25', 'Un bit de plus ne donne que deux sous-réseaux.'], '/26', ['/28', 'Quatre bits de plus donnent seize sous-réseaux.']],
      answer: 1, why: 'Quatre sous-réseaux, c\'est 2 bits de plus : /26, de 64 adresses chacun (0, 64, 128, 192).' },
    { q: 'Un technicien donne l\'adresse 10.1.20.255/24 à un nouveau panneau d\'intercom. Que se passe-t-il ?',
      choices: [['Rien de particulier, c\'est une adresse comme une autre', 'Tous ses bits d\'appareil sont à 1 : c\'est l\'adresse de diffusion du réseau.'], 'Ça ne marche pas : c\'est l\'adresse de diffusion du réseau, qui ne se donne à aucun appareil', ['Le panneau devient la passerelle du réseau', 'La passerelle est une adresse d\'appareil choisie dans le plan (ici .1), pas la diffusion.']],
      answer: 1, why: 'En /24, les appareils vont de .1 à .254. La plupart des systèmes refusent .255 ; ceux qui l\'acceptent se mettent à recevoir toutes les diffusions comme si elles leur étaient adressées.' },
  ],
};

// ======================================================================================
// Types d'adresses, adresses privées et spéciales, IPv6
// ======================================================================================
function figTypes() {
  const f = figure(440, 196, 'L\'espace des adresses IPv4 rangé selon son premier nombre, de 0 à 255 : les anciennes classes A, B et C pour les appareils, D pour le multicast, E réservée, avec les plages privées, la boucle locale et 169.254. En dessous, les trois façons d\'adresser : à une machine, à toutes, à un groupe.');
  const X = (o) => 10 + o / 256 * 420;
  const segs = [[0, 128, 'A', '#2c3a44'], [128, 192, 'B', '#33424c'], [192, 224, 'C', '#3a4a55'], [224, 240, 'D : multicast', '#6a4f8a'], [240, 256, 'E', '#2a2f35']];
  for (const [a, b, n, c] of /** @type {[number, number, string, string][]} */ (segs)) f.append(sv('rect', { x: X(a), y: 22, width: X(b) - X(a) - 1, height: 26, fill: c }), sv('text', { x: (X(a) + X(b)) / 2, y: 39, textAnchor: 'middle', class: 'co-t' }, n));
  const marks = [[10, '10/8 privée', '#7fd1a0', 64], [127, '127 boucle', '#ff9a8a', 78], [169, '169.254 APIPA', '#ffd38a', 64], [172, '172.16/12 privée', '#7fd1a0', 78], [192, '192.168/16 privée', '#7fd1a0', 92], [239, '239 multicast privé', '#d08cff', 64]];
  for (const [o, t, c, y] of /** @type {[number, string, string, number][]} */ (marks)) f.append(sv('line', { x1: X(o) + 1, y1: 20, x2: X(o) + 1, y2: y - 10, stroke: c, strokeWidth: 2 }), sv('text', { x: Math.min(X(o) - 2, 360), y, class: 'co-s', fill: c }, t));
  for (const o of [0, 64, 128, 192, 255]) f.append(sv('text', { x: X(o), y: 15, textAnchor: 'middle', class: 'co-m' }, String(o)));
  const pic = (x, t, dests, col) => {
    f.append(sv('circle', { cx: x, cy: 150, r: 7, fill: '#ffd38a' }), sv('text', { x: x + 50, y: 118, textAnchor: 'middle', class: 'co-t' }, t));
    [0, 1, 2, 3].forEach((k) => { const on = dests.includes(k), y = 132 + k * 14; f.append(sv('line', { x1: x + 8, y1: 150, x2: x + 92, y2: y, stroke: on ? col : '#2a3238', strokeWidth: on ? 2 : 1 }), sv('circle', { cx: x + 96, cy: y, r: 5, fill: on ? col : '#2a3238' })); });
  };
  pic(18, 'unicast', [1], '#7fd1a0'); pic(162, 'diffusion', [0, 1, 2, 3], '#ffd38a'); pic(306, 'multicast', [0, 2], '#d08cff');
  f.append(sv('text', { x: 220, y: 194, textAnchor: 'middle', class: 'co-s' }, 'à une machine · à tout le réseau local · aux abonnés d\'un groupe'));
  return f;
}
const MACHINES_T = { rcp: { nom: 'RCP 1 (10.1.20.31/24)', ip: '10.1.20.31', p: 24 }, invite: { nom: 'Portable invité (10.1.90.120/24)', ip: '10.1.90.120', p: 24 } };
function demoTypes(host) {
  let dst = '10.1.20.255', m = 'rcp';
  const inp = /** @type {HTMLInputElement} */ (el('input', { type: 'text', class: 'co-input', value: dst, 'aria-label': 'Adresse de destination', spellcheck: 'false', inputmode: 'decimal' }));
  const R = readout(['Type', 'Plage', 'Sur Internet', 'Classe d\'avant 1993', 'Depuis la machine choisie']);
  const det = el('p', { class: 'co-verdict' });
  const draw = () => {
    const t = typeAdresse(dst), M = MACHINES_T[m];
    if (!t) { R.set('Type', '— (écris une adresse IPv4)'); det.textContent = ''; return; }
    const c = classe(dst), po = portee(dst, M.ip, M.p);
    R.set('Type', t.type);
    R.set('Plage', t.cidr ? `${t.cidr} (${t.ref})` : 'hors des plages réservées');
    R.set('Sur Internet', t.routable ? (t.type === 'publique' ? 'routable partout' : 'routable (si le réseau le permet)') : 'jamais routée sur Internet');
    R.set('Classe d\'avant 1993', c ? `classe ${c.c}${c.p ? ` (/${c.p} par défaut)` : ''}` : '—');
    R.set('Depuis la machine choisie', po ? `${po.genre} : ${po.ou}` : '—');
    det.textContent = t.detail; det.className = 'co-verdict ' + (t.type === 'lien local (APIPA)' || t.type === 'réservée' ? 'ko' : t.routable ? 'ok' : 'warn');
  };
  inp.addEventListener('input', () => { dst = inp.value.trim(); draw(); });
  const pick = (a) => { dst = a; inp.value = a; draw(); };
  host.append(el('div', { class: 'co-ctl' },
    choice('La machine qui envoie', Object.entries(MACHINES_T).map(([k, v]) => [k, v.nom]), m, (v) => { m = v; draw(); }),
    el('label', { class: 'co-slider' }, el('span', {}, 'Vers l\'adresse'), inp)),
  el('div', { class: 'co-chips' }, ...['10.1.20.11', '10.1.30.11', '10.1.20.255', '255.255.255.255', '239.1.1.3', '224.0.0.251', '127.0.0.1', '169.254.7.20', '192.168.1.10', '100.72.3.4', '8.8.8.8'].map((a) => el('button', { type: 'button', class: 'co-chip', onclick: () => pick(a) }, a))),
  R.el, det);
  draw();
}

/** @type {import('./index.js').Lesson} */
export const TYPES = {
  id: 'reseau-types', title: 'Unicast, diffusion, multicast ; adresses privées, publiques, IPv6', minutes: '8 min',
  essentials: [
    'Trois façons d\'adresser un paquet : **unicast** (une machine), **diffusion** (tout le réseau local), **multicast** (les abonnés d\'un groupe, 224 à 239.x.x.x).',
    'Les adresses **privées** (10/8, 172.16/12, 192.168/16) ne circulent pas sur Internet ; une adresse **publique** est unique au monde. **127.0.0.1** est la machine elle-même ; **169.254.x.x** trahit un DHCP qui n\'a pas répondu.',
    '**IPv6** : 128 bits écrits en hexadécimal (2001:db8::1), plus de diffusion. Les cars restent en IPv4, mais les box et la 4G parlent déjà IPv6.',
  ],
  figure: figTypes,
  demoTitle: 'Choisis la machine qui envoie, puis une adresse de destination (ou écris-en une) : type, plage, et ce que devient l\'envoi.',
  demo: demoTypes,
  body: `**Trois façons d'adresser.**
- **Unicast** : une source, une destination. C'est presque tout le trafic : un RCP qui règle sa CCU, une page web, une copie de fichier.
- **Diffusion** (broadcast) : une source, toutes les machines du réseau local, à l'adresse de diffusion du sous-réseau (10.1.20.255) ou à 255.255.255.255. Elle sert à trouver quelqu'un (ARP : « qui a 10.1.20.11 ? ») ou un service (DHCP : « y a-t-il un serveur ? »). Elle s'arrête au premier routeur, et un VLAN la borne.
- **Multicast** : une source, les seuls **abonnés** d'un **groupe** (224.0.0.0 à 239.255.255.255). La caméra envoie une seule copie, le réseau la recopie là où on l'a demandée (IGMP). C'est la distribution des flux d'un car IP (leçon « Multicast et IGMP »).
On rencontre aussi l'**anycast** : une même adresse portée par plusieurs serveurs ; le routage mène au plus proche (serveurs DNS publics, réseaux de diffusion de contenu).

**Les classes d'avant 1993.** À l'origine, le premier nombre fixait la taille du réseau : classe **A** (1 à 126, réseaux /8), **B** (128 à 191, /16), **C** (192 à 223, /24), **D** (224 à 239, multicast), **E** (au-delà, réservée). Le **CIDR** a supprimé ce lien : on coupe à n'importe quel bit. Les classes ne servent plus qu'à lire les anciens documents… et à comprendre pourquoi un masque /24 est proposé par défaut pour 192.168.x.x.

**Privées et publiques.** Les quelque 4 milliards d'adresses IPv4 sont épuisées : la réserve mondiale de l'IANA s'est vidée en 2011. Trois plages sont donc **privées** (RFC 1918), réutilisées par tous les réseaux internes : **10.0.0.0/8** (le car : 10.1.x.x), **172.16.0.0/12** (172.16 à 172.31), **192.168.0.0/16** (les box). Elles ne sont jamais routées sur Internet : pour sortir, un routeur les **traduit** en son adresse publique (NAT, leçon suivante). Une adresse **publique** est unique au monde et attribuée par un opérateur.

**Les adresses particulières**, à reconnaître d'un coup d'œil :
- **127.0.0.1** (et tout 127.x.x.x) : la machine elle-même, « localhost » ; le paquet ne sort jamais de la carte ;
- **169.254.x.x** : une machine réglée en DHCP qui n'a reçu aucune réponse s'est donné cette adresse au hasard ; elle ne joint presque personne. Symptôme d'un serveur DHCP absent ou injoignable ;
- **100.64.0.0/10** : adresse partagée d'un opérateur mobile (CGNAT) ;
- **0.0.0.0** : « pas d'adresse » (source d'une requête DHCP) ; **255.255.255.255** : diffusion limitée ;
- **224.0.0.x** : multicast local, jamais routé (OSPF 224.0.0.5, mDNS 224.0.0.251) ; **239.x.x.x** : multicast privé, celui des cars ; **232.x.x.x** : multicast SSM.

**IPv6.** Pour ne plus jamais manquer d'adresses, IPv6 passe à **128 bits**, écrits en huit groupes hexadécimaux : 2001:0db8:0000:0000:0000:0000:0000:0001. On retire les zéros de tête de chaque groupe et une seule suite de groupes nuls devient « :: » : **2001:db8::1**. Un réseau local est presque toujours un **/64** ; l'appareil peut fabriquer seul la seconde moitié de son adresse. Chaque interface a aussi une adresse de **lien local** (fe80::…) ; **::1** est la boucle locale. Il n'y a plus de diffusion : la découverte des voisins (NDP, qui remplace ARP) passe en multicast. Les normes ST 2110 l'autorisent, mais les cars restent en IPv4 ; en contribution par Internet, on croise de l'IPv6 sur les box et les réseaux mobiles.`,
  plus: `- Plages de documentation (RFC 5737) : 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24 ; IPv6 : 2001:db8::/32. Ce sont celles des exemples, jamais en service.
- Un appareil en 169.254.x.x et un autre en 169.254.y.y peuvent se parler sur le même câble : c'est voulu, pour relier deux machines sans serveur.
- IPv6 et IPv4 cohabitent (double pile) : une machine a souvent les deux, et choisit selon ce que propose le DNS.`,
  car: { text: 'Au poste Réseau (car SDI) : tout le car est en adresses privées 10.1.x.x ; le VLAN 90 des invités reçoit ses adresses par DHCP ; une machine en 169.254 n\'a pas eu de réponse DHCP. Car IP : les flux en multicast 239.1.x.x et 239.2.x.x (rouge et bleu), PTP en 224.0.1.129.', station: 'reseau' },
  terms: ['types-adresses', 'adresses-privees', 'ipv6', 'broadcast-ip', 'groupe', 'dhcp'],
  competences: ['3.6', '2.11'], article: 'reseau',
  quiz: [
    { q: 'Laquelle de ces adresses est privée ?',
      choices: [['172.32.1.10', 'La plage privée 172.16.0.0/12 s\'arrête à 172.31.255.255 : 172.32 est publique.'], '172.20.1.10', ['8.8.8.8', 'C\'est une adresse publique (un résolveur DNS bien connu).']],
      answer: 1, why: '172.16.0.0/12 couvre 172.16 à 172.31 : 172.20.1.10 en fait partie. Les deux autres sont publiques.' },
    { q: 'Un PC en DHCP affiche l\'adresse 169.254.31.7. Qu\'en conclure ?',
      choices: ['Il n\'a reçu aucune réponse DHCP et s\'est donné une adresse de lien local', ['Il a reçu une adresse publique', '169.254.0.0/16 est réservée au lien local (RFC 3927), jamais attribuée par un opérateur.'], ['Il est dans le VLAN des invités, c\'est normal', 'Le VLAN 90 donne des adresses 10.1.90.100 à 199 : 169.254 signale justement l\'absence de réponse.']],
      answer: 0, why: 'Sans réponse DHCP, la machine choisit seule une adresse en 169.254.x.x : elle ne joint presque personne. On cherche pourquoi le serveur DHCP ne répond pas (VLAN, relais, serveur arrêté).' },
    { q: 'À qui parvient un paquet envoyé à 10.1.20.255 depuis 10.1.20.31/24 ?',
      choices: [['À la machine 10.1.20.255', 'En /24, .255 est l\'adresse de diffusion : aucune machine ne la porte.'], 'À toutes les machines du sous-réseau 10.1.20.0/24', ['À toutes les machines du car, tous VLAN confondus', 'La diffusion s\'arrête au routeur : les autres sous-réseaux ne la reçoivent pas.']],
      answer: 1, why: 'Tous les bits d\'appareil à 1 : c\'est la diffusion du sous-réseau. Elle atteint toutes les machines de 10.1.20.0/24 et s\'arrête là.' },
    { q: 'Quelle est l\'écriture courte de 2001:0db8:0000:0000:0000:0000:0000:0001 ?',
      choices: ['2001:db8::1', ['2001:db8:0:1', 'On ne peut pas supprimer des groupes sans le signaler : seuls « :: » remplace une suite de groupes nuls.'], ['21:db8::1', 'On ne retire que les zéros de tête d\'un groupe : 2001 reste 2001.']],
      answer: 0, why: 'On retire les zéros de tête (0db8 → db8) et une suite de groupes nuls devient « :: », une seule fois par adresse (RFC 5952).' },
    { q: 'Pourquoi le car utilise-t-il des adresses en 10.x.x.x ?',
      choices: [['Parce qu\'elles sont plus rapides', 'Une adresse n\'a pas de vitesse : c\'est un identifiant.'], ['Parce qu\'elles sont obligatoires pour ST 2110', 'ST 2110 fonctionne avec n\'importe quelles adresses ; le choix tient au réseau interne.'], 'Parce que ce sont des adresses privées, libres d\'usage dans un réseau interne et jamais routées sur Internet'],
      answer: 2, why: '10.0.0.0/8 est une plage privée (RFC 1918) : chacun peut l\'utiliser chez lui sans demander d\'adresse publique. Pour sortir sur Internet, le routeur traduit.' },
    { q: 'Un flux en multicast vers 239.1.1.3 : qui le reçoit ?',
      choices: [['Toutes les machines du VLAN', 'C\'est le cas d\'une diffusion, ou d\'un multicast sans IGMP snooping (une panne).'], 'Les seuls appareils qui se sont abonnés au groupe', ['La machine dont l\'adresse est 239.1.1.3', 'Une adresse de groupe ne désigne aucune machine : c\'est un « canal ».']],
      answer: 1, why: '239.x.x.x est une adresse de groupe : le réseau recopie le flux vers les abonnés (IGMP), et seulement vers eux si le snooping est actif.' },
  ],
};

// ======================================================================================
// DHCP et DNS
// ======================================================================================
function figDhcp() {
  const f = figure(440, 198, 'Les quatre messages du DHCP entre une machine sans adresse et le serveur : Discover en diffusion, Offer, Request, Ack. À droite, la résolution d\'un nom par le DNS : la machine demande à son résolveur, qui répond l\'adresse.');
  f.append(sv('rect', { x: 8, y: 18, width: 70, height: 24, rx: 4, fill: '#1a2229', stroke: '#7fd3f3' }), sv('text', { x: 43, y: 34, textAnchor: 'middle', class: 'co-t' }, 'Machine'));
  f.append(sv('rect', { x: 182, y: 18, width: 84, height: 24, rx: 4, fill: '#1a2229', stroke: '#ffd38a' }), sv('text', { x: 224, y: 34, textAnchor: 'middle', class: 'co-t' }, 'Serveur DHCP'));
  f.append(sv('line', { x1: 43, y1: 42, x2: 43, y2: 190, stroke: '#3a4650' }), sv('line', { x1: 224, y1: 42, x2: 224, y2: 190, stroke: '#3a4650' }));
  const M = [['Discover', 'de 0.0.0.0 à 255.255.255.255', 1], ['Offer', '« prenez 10.1.90.120 »', -1], ['Request', '« je prends 10.1.90.120 »', 1], ['Ack', 'bail de 24 h, passerelle, DNS', -1]];
  for (const [i, [n, s, d]] of /** @type {[string, string, number][]} */ (M).entries()) {
    const y = 62 + i * 34, x1 = d > 0 ? 45 : 222, x2 = d > 0 ? 222 : 45;
    f.append(sv('line', { x1, y1: y, x2, y2: y + 10, stroke: d > 0 ? '#7fd3f3' : '#ffd38a', strokeWidth: 2 }), sv('polygon', { points: d > 0 ? `${x2},${y + 10} ${x2 - 8},${y + 4} ${x2 - 6},${y + 13}` : `${x2},${y + 10} ${x2 + 8},${y + 4} ${x2 + 6},${y + 13}`, fill: d > 0 ? '#7fd3f3' : '#ffd38a' }));
    f.append(sv('text', { x: 133, y: y - 2, textAnchor: 'middle', class: 'co-t' }, String(n)), sv('text', { x: 133, y: y + 24, textAnchor: 'middle', class: 'co-m' }, String(s)));
  }
  f.append(sv('rect', { x: 290, y: 18, width: 142, height: 172, rx: 6, fill: '#141b20', stroke: '#3a4650' }), sv('text', { x: 361, y: 36, textAnchor: 'middle', class: 'co-t' }, 'DNS'));
  const D = [['« regie.exemple.fr ? »', '#7fd3f3'], ['résolveur (cache)', '#9aa4ad'], ['racine → .fr → exemple.fr', '#9aa4ad'], ['« 203.0.113.80 »', '#ffd38a']];
  D.forEach(([t, c], i) => f.append(sv('text', { x: 361, y: 64 + i * 32, textAnchor: 'middle', class: 'co-s', fill: c }, t)));
  f.append(sv('text', { x: 361, y: 182, textAnchor: 'middle', class: 'co-m' }, 'UDP, port 53'));
  return f;
}
const SERVEURS = {
  ici: { nom: 'Serveur dans le VLAN', ok: true },
  relais: { nom: 'Autre VLAN, avec relais', ok: true },
  sansrelais: { nom: 'Autre VLAN, sans relais', ok: false },
  absent: { nom: 'Pas de serveur', ok: false },
  pirate: { nom: 'Une box branchée par erreur', ok: false },
};
function demoDhcp(host) {
  let srv = 'ici', dns = 'oui', cible = 'nom';
  const out = el('ol', { class: 'co-trace' });
  const res = el('p', { class: 'co-verdict' });
  const dnsOut = el('p', { class: 'co-verdict' });
  const draw = () => {
    const E = [];
    E.push('La machine démarre sans adresse : elle envoie un **Discover** de 0.0.0.0 vers 255.255.255.255 (UDP 67), en diffusion dans son VLAN.');
    /** @type {string} */ let adr; let ok = false;
    if (srv === 'ici' || srv === 'relais') {
      if (srv === 'relais') E.push('La diffusion ne sort pas du VLAN : le routeur, réglé en **relais DHCP** (ip helper-address), la recopie en unicast vers le serveur, dans un autre VLAN.');
      E.push('Le serveur répond par une **Offer** : 10.1.90.120, masque /24, passerelle 10.1.90.1, DNS 10.1.10.53, bail de 24 h.');
      E.push('La machine confirme par un **Request** (en diffusion, pour que les autres serveurs sachent qu\'elle a choisi), le serveur conclut par un **Ack**.');
      E.push('À mi-bail (12 h), la machine redemande en unicast pour prolonger : le **renouvellement**.');
      adr = '10.1.90.120/24, passerelle 10.1.90.1'; ok = true;
    } else if (srv === 'sansrelais') {
      E.push('Le serveur est dans un autre VLAN : la diffusion ne traverse pas le routeur, et rien ne la relaie. Aucune réponse.');
      E.push('Après quelques essais, la machine se donne une adresse au hasard en **169.254.x.x** (lien local).');
      adr = '169.254.37.12/16, pas de passerelle';
    } else if (srv === 'absent') {
      E.push('Personne ne répond. Après quelques essais, la machine se donne une adresse au hasard en **169.254.x.x** (lien local).');
      adr = '169.254.37.12/16, pas de passerelle';
    } else {
      E.push('Deux serveurs répondent : celui du car et une box branchée par erreur. La machine prend souvent **la première offre arrivée**.');
      E.push('Elle reçoit 192.168.1.23 et la passerelle 192.168.1.1 de la box : elle n\'est plus dans le plan d\'adressage, et sort par la box.');
      adr = '192.168.1.23/24, passerelle de la box : un serveur pirate';
    }
    out.replaceChildren(...E.map((t) => el('li', { html: t.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>') })));
    res.textContent = `Adresse obtenue : ${adr}.`; res.className = 'co-verdict ' + (ok ? 'ok' : 'ko');
    const pingNom = ok && dns === 'oui';
    dnsOut.textContent = cible === 'adresse' ? (ok ? 'Ping vers 10.1.10.50 : répond. Une adresse n\'a pas besoin de DNS.' : 'Ping vers 10.1.10.50 : rien, la machine n\'a pas d\'adresse utilisable ni de passerelle.')
      : pingNom ? 'Ping vers supervision.car.local : le résolveur 10.1.10.53 répond 10.1.10.50, puis l\'écho revient.' : ok ? 'Ping vers supervision.car.local : « hôte inconnu ». Le réseau fonctionne, c\'est le nom qui ne se traduit pas : le DNS manque.' : 'Ping vers supervision.car.local : rien, la machine n\'a pas d\'adresse utilisable.';
    dnsOut.className = 'co-verdict ' + ((cible === 'adresse' ? ok : pingNom) ? 'ok' : 'ko');
  };
  host.append(el('div', { class: 'co-ctl' },
    choice('Le serveur DHCP', Object.entries(SERVEURS).map(([k, v]) => [k, v.nom]), srv, (v) => { srv = v; draw(); }),
    choice('Serveur DNS', [['oui', 'joignable'], ['non', 'absent']], dns, (v) => { dns = v; draw(); }),
    choice('Joindre la supervision', [['nom', 'par son nom'], ['adresse', 'par son adresse']], cible, (v) => { cible = v; draw(); })),
  out, res, dnsOut);
  draw();
}

/** @type {import('./index.js').Lesson} */
export const DHCP_DNS = {
  id: 'reseau-dhcp-dns', title: 'DHCP et DNS : recevoir une adresse, trouver un nom', minutes: '7 min',
  essentials: [
    '**DHCP** donne à une machine son adresse, son masque, sa passerelle et son DNS en quatre messages : **Discover, Offer, Request, Ack**, pour une durée, le **bail**.',
    '**DNS** traduit un nom (supervision.car.local, youtube.com) en adresse IP. Signe d\'un DNS en panne : le ping marche vers une adresse, pas vers un nom.',
    'Dans un car, les appareils de production ont des **adresses fixes** (le plan d\'adressage) ; le DHCP sert aux invités et aux portables. Sans réponse DHCP, une machine se met en **169.254.x.x**.',
  ],
  figure: figDhcp,
  demoTitle: 'Place le serveur DHCP, coupe le DNS, joins la supervision par son nom ou par son adresse : suis les messages et le résultat.',
  demo: demoDhcp,
  body: `**DHCP** (Dynamic Host Configuration Protocol) évite de régler chaque machine à la main. Au démarrage, une machine sans adresse ne peut parler à personne en particulier : elle **diffuse**.
- **Discover** : de 0.0.0.0 vers 255.255.255.255, en UDP (port 67 pour le serveur, 68 pour le client) : « y a-t-il un serveur DHCP ? » ;
- **Offer** : le serveur propose une adresse libre de sa réserve (son **pool**), avec le masque, la passerelle, les serveurs DNS et la durée du **bail** ;
- **Request** : la machine accepte, encore en diffusion pour que les autres serveurs sachent qu'elle a choisi ;
- **Ack** : le serveur confirme. La machine est configurée.
À mi-bail, elle redemande pour prolonger ; une machine éteinte longtemps rend son adresse au pool.

**La diffusion ne traverse pas le routeur.** Un serveur DHCP doit donc être dans le VLAN de la machine, ou le routeur doit jouer le **relais DHCP** (commande « ip helper-address » chez beaucoup de constructeurs) : il recopie la diffusion en unicast vers le serveur. Sans réponse, une machine finit par se donner une adresse au hasard en **169.254.x.x** : elle ne joint presque personne. C'est le premier indice d'un DHCP absent, éteint ou injoignable.

**Une réservation** fait donner toujours la même adresse à la même adresse MAC : utile pour un appareil qu'on veut retrouver, sans le régler à la main. Mais dans un car de production, on préfère des **adresses fixes** réglées dans chaque appareil : rien ne doit dépendre d'un serveur au moment de l'antenne. Le DHCP sert au VLAN des invités, aux portables, aux téléphones.

Une panne classique : quelqu'un branche une box ou un routeur domestique sur le réseau. Son serveur DHCP répond aussi, parfois plus vite que le bon : des machines reçoivent une adresse 192.168.1.x et une passerelle qui n'ont rien à faire là (**serveur DHCP pirate**). Les commutateurs administrables le bloquent (DHCP snooping : seuls les ports déclarés « de confiance » peuvent répondre).

**DNS** (Domain Name System) est l'annuaire du réseau : il traduit un **nom** en **adresse**. La machine pose la question à son **résolveur** (l'adresse DNS reçue par DHCP ou réglée à la main) ; le résolveur interroge au besoin les serveurs racine, puis ceux de .fr, puis ceux du domaine, et garde la réponse en **cache** pendant sa durée de vie. Questions et réponses passent en UDP sur le **port 53**. Les enregistrements courants : **A** (nom → IPv4), **AAAA** (nom → IPv6), **PTR** (adresse → nom).

Sur un réseau local sans serveur DNS, le **mDNS** répond aux noms en « .local » (multicast 224.0.0.251, port 5353) et **DNS-SD** annonce des services : c'est ainsi que les appareils NMOS d'un car IP trouvent leur registre, et que les sources NDI apparaissent toutes seules.

Pour dépanner : si le ping vers **l'adresse** répond mais pas vers **le nom**, le réseau va bien, c'est le DNS. Les commandes « nslookup » ou « dig » interrogent le DNS directement.`,
  plus: `- Le fichier « hosts » d'une machine donne des correspondances nom → adresse sans DNS : pratique en dépannage, piège quand on l'oublie.
- Une machine peut avoir plusieurs DNS : si le premier ne répond pas, elle essaie le suivant, après un délai.
- Le serveur DHCP tient la liste des baux (adresse, MAC, nom, échéance) : c'est l'endroit où retrouver qui a quelle adresse.`,
  car: { text: 'Au poste Réseau (car SDI) : seul le VLAN 90 (invités) a un serveur DHCP, le routeur, qui prête 10.1.90.100 à 10.1.90.199 ; toutes les machines de production sont en adresse fixe. Une machine réglée en DHCP ailleurs n\'obtient rien. Dans le car IP, les nœuds NMOS trouvent le registre par DNS-SD (ou par son adresse saisie).', station: 'reseau' },
  terms: ['dhcp', 'dns', 'dns-sd', 'broadcast-ip', 'ping'],
  competences: ['3.6', '2.3', '2.13'], article: 'reseau',
  quiz: [
    { q: 'Dans quel ordre passent les messages DHCP ?',
      choices: ['Discover, Offer, Request, Ack', ['Request, Offer, Discover, Ack', 'La machine ne peut rien demander avant de savoir qu\'un serveur existe : elle commence par chercher.'], ['Offer, Discover, Ack, Request', 'Le serveur ne propose rien avant d\'avoir été cherché, et l\'Ack conclut toujours.']],
      answer: 0, why: 'La machine cherche (Discover), le serveur propose (Offer), la machine accepte (Request), le serveur confirme (Ack) : DORA.' },
    { q: 'Pourquoi le Discover part-il en diffusion ?',
      choices: [['Pour aller plus vite', 'La vitesse n\'y est pour rien.'], 'Parce que la machine n\'a pas encore d\'adresse et ne connaît pas celle du serveur', ['Pour joindre tous les VLAN du car', 'Une diffusion s\'arrête au contraire au routeur : elle reste dans le VLAN.']],
      answer: 1, why: 'Sans adresse et sans connaître le serveur, la machine ne peut que diffuser (de 0.0.0.0 à 255.255.255.255), dans son VLAN.' },
    { q: 'Le serveur DHCP est dans le VLAN 10 ; un portable du VLAN 90 n\'obtient rien. Que manque-t-il ?',
      choices: [['Une adresse fixe sur le serveur', 'Le serveur en a sûrement une ; le problème est que la demande ne lui parvient pas.'], ['Un câble entre les deux VLAN', 'Un VLAN ne se relie pas par un câble : c\'est le routeur qui passe de l\'un à l\'autre.'], 'Un relais DHCP sur le routeur, qui recopie la diffusion vers le serveur'],
      answer: 2, why: 'La diffusion ne traverse pas le routeur. Réglé en relais DHCP (ip helper-address), il la transmet en unicast au serveur et renvoie la réponse.' },
    { q: 'Le ping vers 10.1.10.50 répond, mais « ping supervision.car.local » répond « hôte inconnu ». Où chercher ?',
      choices: ['Du côté du DNS : le réseau fonctionne, c\'est le nom qui ne se traduit pas', ['Du côté du câble', 'Le ping par adresse passe : le câble va bien.'], ['Du côté de la passerelle', 'La machine joint 10.1.10.50, dans un autre VLAN : sa passerelle fonctionne.']],
      answer: 0, why: 'Adresse qui répond, nom qui ne se traduit pas : le résolveur DNS est absent, faux ou injoignable, ou le nom n\'y est pas enregistré.' },
    { q: 'Des PC du car se retrouvent soudain en 192.168.1.x. Cause probable ?',
      choices: [['Le serveur DHCP du car a changé de pool tout seul', 'Un serveur ne change pas de plage sans qu\'on le règle.'], 'Une box ou un routeur domestique branché sur le réseau répond aux demandes DHCP', ['Une coupure du DNS', 'Le DNS traduit des noms ; il ne distribue pas d\'adresses.']],
      answer: 1, why: 'C\'est un serveur DHCP pirate : il répond plus vite que le bon. On le débranche, et l\'on active le DHCP snooping sur les commutateurs.' },
    { q: 'Pourquoi les appareils de production du car ont-ils des adresses fixes plutôt que DHCP ?',
      choices: [['Parce que DHCP est interdit en audiovisuel', 'Rien ne l\'interdit, et beaucoup d\'appareils le savent faire.'], ['Parce que les adresses fixes sont plus rapides', 'Une adresse n\'a pas de vitesse.'], 'Pour que rien ne dépende d\'un serveur pendant l\'antenne, et que chaque appareil soit toujours là où le plan l\'attend'],
      answer: 2, why: 'Le plan d\'adressage et les commandes (RCP, grille, tally) visent des adresses précises : une adresse qui change ou un serveur en panne casserait la production.' },
  ],
};

// ======================================================================================
// Sortir sur Internet : NAT, ports, pare-feu
// ======================================================================================
function figNat() {
  const f = figure(440, 196, 'À gauche, le réseau privé (le PC 192.168.1.20 et un encodeur 192.168.1.50) ; au milieu, la box qui traduit les adresses, avec son adresse publique 203.0.113.7 ; à droite, Internet. La table de traduction relie chaque sortie à un port public ; une redirection laisse entrer ce qui arrive sur le port 9000.');
  f.append(sv('rect', { x: 6, y: 20, width: 140, height: 120, rx: 8, fill: 'rgba(127,209,160,.07)', stroke: '#7fd1a0', 'stroke-dasharray': '4 3' }), sv('text', { x: 76, y: 14, textAnchor: 'middle', class: 'co-s' }, 'réseau privé 192.168.1.0/24'));
  f.append(sv('rect', { x: 18, y: 36, width: 116, height: 30, rx: 4, fill: '#1a2229', stroke: '#7fd1a0' }), sv('text', { x: 76, y: 55, textAnchor: 'middle', class: 'co-t' }, 'PC .20'));
  f.append(sv('rect', { x: 18, y: 90, width: 116, height: 30, rx: 4, fill: '#1a2229', stroke: '#7fd1a0' }), sv('text', { x: 76, y: 109, textAnchor: 'middle', class: 'co-t' }, 'Encodeur .50'));
  f.append(sv('rect', { x: 170, y: 50, width: 100, height: 56, rx: 6, fill: '#1a2229', stroke: '#ffd38a' }), sv('text', { x: 220, y: 70, textAnchor: 'middle', class: 'co-t' }, 'Box (NAT)'), sv('text', { x: 220, y: 86, textAnchor: 'middle', class: 'co-m' }, '203.0.113.7'), sv('text', { x: 220, y: 100, textAnchor: 'middle', class: 'co-s' }, 'pare-feu'));
  f.append(sv('ellipse', { cx: 370, cy: 78, rx: 62, ry: 46, fill: 'rgba(208,140,255,.08)', stroke: '#d08cff' }), sv('text', { x: 370, y: 74, textAnchor: 'middle', class: 'co-t' }, 'Internet'), sv('text', { x: 370, y: 90, textAnchor: 'middle', class: 'co-s' }, 'adresses publiques'));
  f.append(sv('line', { x1: 134, y1: 51, x2: 170, y2: 70, stroke: '#7fd1a0', strokeWidth: 2 }), sv('line', { x1: 134, y1: 105, x2: 170, y2: 88, stroke: '#7fd1a0', strokeWidth: 2 }), sv('line', { x1: 270, y1: 78, x2: 308, y2: 78, stroke: '#ffd38a', strokeWidth: 2 }));
  const T = [['192.168.1.20:51515', '→ 203.0.113.7:40000', 'sortie'], ['192.168.1.50:9000', '← 203.0.113.7:9000', 'redirection']];
  f.append(sv('text', { x: 220, y: 152, textAnchor: 'middle', class: 'co-s' }, 'table de traduction'));
  T.forEach(([a, b, c], i) => f.append(sv('text', { x: 70, y: 170 + i * 16, class: 'co-m' }, a), sv('text', { x: 215, y: 170 + i * 16, class: 'co-m' }, b), sv('text', { x: 360, y: 170 + i * 16, class: 'co-s' }, c)));
  return f;
}
function demoNat(host) {
  let N = routeurNat('203.0.113.7');
  const log = el('ol', { class: 'co-trace' });
  const table = el('pre', { class: 'co-json' });
  const L = [];
  const say = (t, ok) => { L.push(el('li', { class: ok === true ? 'ok' : ok === false ? 'ko' : '' }, t)); log.replaceChildren(...L.slice(-7)); show(); };
  const show = () => {
    const rows = [...N.table].map(([p, e]) => `${e.ip}:${e.port}  →  ${N.publique}:${p}   (vers ${e.vers})`);
    const redir = [...N.redir].map(([p, e]) => `${N.publique}:${p}  →  ${e.ip}:${e.port}   (redirection)`);
    table.textContent = ['Table de la box', ...(rows.length || redir.length ? [...rows, ...redir] : ['(vide)'])].join('\n');
  };
  let pubPc = 0;
  const actions = [
    ['Le PC ouvre youtube.com', () => { const s = N.sortie('192.168.1.20', 51515, '198.51.100.9'); pubPc = s.port; say(`Le PC 192.168.1.20:51515 envoie vers 198.51.100.9:443. La box réécrit la source : ${s.ip}:${s.port}.`, true); }],
    ['La réponse revient', () => { const e = pubPc ? N.entree(pubPc, '198.51.100.9') : null; say(e ? `La réponse de 198.51.100.9 arrive sur ${N.publique}:${pubPc} : la table la remet à ${e.ip}:${e.port}.` : 'Rien n\'est sorti : aucune réponse n\'est attendue.', !!e); }],
    ['Un inconnu frappe au port 9000', () => { const e = N.entree(9000, '192.0.2.66'); say(e ? `Le paquet entre par redirection vers ${e.ip}:${e.port}.` : 'Un paquet arrive de 192.0.2.66 sur le port 9000 : aucune ligne ne correspond, la box le jette.', !!e); }],
    ['Rediriger le port 9000 vers l\'encodeur', () => { N.rediriger(9000, '192.168.1.50', 9000); say('Redirection ajoutée : ce qui arrive sur 203.0.113.7:9000 ira à l\'encodeur 192.168.1.50:9000 (un récepteur SRT en mode listener peut maintenant être appelé).', true); }],
    ['Tout effacer', () => { N = routeurNat('203.0.113.7'); pubPc = 0; L.length = 0; log.replaceChildren(); show(); }],
  ];
  host.append(el('div', { class: 'co-ctl' }, ...actions.map(([t, f]) => el('button', { type: 'button', class: 'btn small', onclick: f }, t))), table, log);
  show();
}

/** @type {import('./index.js').Lesson} */
export const NAT = {
  id: 'reseau-nat', title: 'Sortir sur Internet : NAT, ports et pare-feu', minutes: '7 min',
  essentials: [
    'Une box ou un routeur fait de la **traduction d\'adresses (NAT)** : toutes les machines privées sortent avec la même **adresse publique**, chacune sur un **port** différent.',
    'Ce qui part de l\'intérieur reçoit sa réponse ; ce qui arrive de l\'extérieur sans avoir été demandé est **bloqué**, sauf **redirection de port**.',
    'Pour une contribution par Internet : le côté derrière une box ou en 4G **appelle** ; le côté qui **écoute** a besoin d\'un port ouvert et redirigé. En 4G, l\'adresse est souvent partagée (CGNAT) : impossible d\'y être joint.',
  ],
  figure: figNat,
  demoTitle: 'Fais sortir le PC, fais revenir la réponse, puis fais frapper un inconnu au port 9000, avant et après la redirection.',
  demo: demoNat,
  body: `Le car est en adresses **privées** (10.1.x.x) : elles ne circulent pas sur Internet. Pour en sortir, il faut un routeur qui fasse de la **traduction d'adresses**, le **NAT** (Network Address Translation) ; plus précisément de la traduction d'adresses et de ports (NAPT), comme le fait n'importe quelle box.

**À la sortie.** Le PC 192.168.1.20 ouvre une page : il envoie depuis son port 51515 vers 198.51.100.9:443. La box remplace l'adresse source par la sienne, **203.0.113.7**, et le port par un port libre, 40000 ; elle note la correspondance dans sa **table de traduction**. Le serveur ne voit que la box. Sa réponse, adressée à 203.0.113.7:40000, est remise au PC grâce à la table. Des dizaines de machines sortent ainsi avec une seule adresse publique.

**Le port** désigne le service dans une machine : l'adresse IP mène à la machine, le port au logiciel. Les ports 0 à 1023 sont réservés aux services connus (80 le web, 443 le web chiffré, 53 le DNS, 22 SSH) ; un client prend un port libre élevé. Une **socket**, c'est le couple adresse et port : 10.1.20.11:80, le serveur web de la CCU.

**À l'entrée.** Un paquet qui arrive de l'extérieur **sans avoir été demandé** ne correspond à aucune ligne de la table : il est jeté. C'est une protection de fait. Pour qu'un appareil de l'intérieur soit joignable (un serveur, un récepteur qui attend une contribution), il faut une **redirection de port** : « ce qui arrive sur 203.0.113.7:9000 va à 192.168.1.50:9000 ». Le **pare-feu** va plus loin : il décide, port par port et sens par sens, ce qui passe ; un pare-feu « à états » laisse revenir les réponses de ce qui est sorti.

**Conséquence pour une contribution par Internet.** Avec SRT, l'un des deux bouts **appelle** (caller) et l'autre **écoute** (listener). Le bout derrière une box sans réglage, ou en 4G, doit appeler : sa sortie ouvre la ligne dans sa table. Le bout qui écoute doit avoir une adresse publique et un port redirigé (souvent la régie, dont l'équipe réseau ouvre un port précis). Si aucun des deux ne peut écouter, SRT propose le mode **rendezvous** : les deux appellent en même temps.

**Le piège de la 4G et de la 5G.** Beaucoup d'opérateurs mobiles traduisent une seconde fois chez eux (**CGNAT**, adresses en 100.64.x.x) : on n'a même pas d'adresse publique à soi, et aucune redirection n'est possible. Un encodeur sur un modem 4G appelle donc toujours ; pour qu'on puisse le joindre, il faut un relais (serveur intermédiaire) ou un VPN.

L'ouverture automatique d'un port par le logiciel lui-même (**UPnP**) existe sur beaucoup de box : pratique, mais souvent désactivée sur les réseaux professionnels, pour des raisons de sécurité.`,
  plus: `- Le NAT casse les protocoles qui écrivent des adresses dans leurs données (anciens FTP, SIP) : la box doit les comprendre pour les réécrire.
- Une **DMZ** expose une machine entière à l'extérieur : à éviter, on ouvre seulement les ports utiles.
- Un VPN relie deux réseaux privés à travers Internet comme s'ils étaient voisins : tout passe dans un tunnel chiffré, une seule sortie à ouvrir.
- IPv6 se passe de NAT (assez d'adresses pour tous) ; il reste un pare-feu à régler.`,
  car: { text: 'Au poste Réseau (car SDI) : le routeur / pare-feu (10.1.10.254) fait sortir le car sur Internet et isole les invités de la production. Dans le simulateur lui-même, « Jouer par Internet » ouvre la box de l\'hôte par UPnP (une redirection automatique) et, si elle refuse, passe par un tunnel.', station: 'reseau' },
  terms: ['nat', 'port', 'pare-feu', 'adresses-privees', 'srt'],
  competences: ['3.6', '2.11', '2.13'], article: 'reseau',
  quiz: [
    { q: 'Que fait une box pour qu\'un PC en 192.168.1.20 consulte un site web ?',
      choices: ['Elle remplace l\'adresse source privée par son adresse publique et note la correspondance', ['Elle donne au PC une adresse publique', 'Le PC garde son adresse privée ; seule la box en a une publique.'], ['Rien : les adresses privées circulent sur Internet', 'Elles ne sont jamais routées sur Internet : sans traduction, aucune réponse ne reviendrait.']],
      answer: 0, why: 'C\'est la traduction d\'adresses et de ports : la box sort avec son adresse publique et un port à elle, et remet la réponse au PC grâce à sa table.' },
    { q: 'Un récepteur SRT en mode listener, derrière une box, ne reçoit jamais l\'appel de l\'encodeur. Que faut-il ?',
      choices: [['Passer l\'encodeur en listener lui aussi', 'Deux listeners s\'attendent mutuellement : personne n\'appelle.'], 'Une redirection du port d\'écoute vers le récepteur, sur la box', ['Changer d\'adresse IP privée', 'L\'adresse privée n\'est jamais visible de l\'extérieur ; c\'est la box qui bloque l\'entrée.']],
      answer: 1, why: 'Un paquet entrant non demandé est jeté. Avec une redirection (port 9000 → récepteur), l\'appel de l\'encodeur atteint le récepteur.' },
    { q: 'Un encodeur sur modem 4G doit envoyer à la régie. Quel mode SRT choisir pour l\'encodeur ?',
      choices: ['Caller : il appelle la régie, qui écoute sur un port ouvert', ['Listener : la régie l\'appellera', 'En 4G, l\'adresse est souvent partagée (CGNAT) : personne ne peut joindre l\'encodeur.'], ['Peu importe, SRT traverse tout', 'SRT traverse le NAT dans le sens sortant ; l\'entrée reste bloquée.']],
      answer: 0, why: 'Derrière une traduction qu\'on ne règle pas, on appelle : la sortie ouvre la ligne. La régie, qui a une adresse publique et un port redirigé, écoute.' },
    { q: 'À quoi sert le numéro de port dans un paquet ?',
      choices: [['À choisir le câble de sortie du commutateur', 'Le port d\'un commutateur est une prise ; le port TCP ou UDP est un numéro de service.'], 'À désigner le service ou le logiciel dans la machine', ['À numéroter les paquets', 'C\'est le rôle des numéros de séquence (TCP, RTP).']],
      answer: 1, why: 'L\'adresse IP mène à la machine, le port au logiciel : 443 pour le web chiffré, 53 pour le DNS, 1935 pour RTMP.' },
    { q: 'Sur quel port un serveur web chiffré (HTTPS) écoute-t-il par défaut ?',
      choices: [['80', 'C\'est le web non chiffré (HTTP).'], ['53', 'C\'est le DNS.'], '443'],
      answer: 2, why: '443 : HTTPS. 80 : HTTP. 53 : DNS. Les ports en dessous de 1024 sont réservés aux services connus.' },
    { q: 'Pourquoi une box protège-t-elle « par défaut » les machines du réseau privé ?',
      choices: [['Parce qu\'elle chiffre tout le trafic', 'La traduction d\'adresses ne chiffre rien.'], 'Parce qu\'un paquet entrant non demandé ne correspond à aucune ligne de sa table et est jeté', ['Parce que les adresses privées sont secrètes', 'Les plages privées sont connues de tous ; c\'est le fonctionnement de la table qui bloque.']],
      answer: 1, why: 'Seules les réponses à ce qui est sorti, et ce qu\'une redirection désigne, peuvent entrer. Ce n\'est pas un vrai pare-feu, mais cela en a l\'effet.' },
  ],
};

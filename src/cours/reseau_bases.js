// @ts-check
import { el } from '../util.js';
import { figure, sv, slider, choice, readout, fmtNum } from './kit.js';
import { encapsuler, ECHELLES, latenceEchelle, LIENS, liensPossibles, serialisation, propagationFibre, MTU } from './reseau_calc.js';

// ----------------------------------------------------------------------------------
// Leçons « bases du réseau » du chapitre Réseau, 1 : les couches (modèle OSI et modèle TCP/IP,
// encapsulation), les échelles (LAN, MAN, WAN : de la régie à l'antenne) et les supports (cuivre,
// fibre multimode et monomode, modules SFP). Les calculs sont dans reseau_calc.js (testés).
// ----------------------------------------------------------------------------------
const C = { grey: '#8a949c', amber: '#ffd38a', red: '#ff8a80', green: '#7fd1a0', cyan: '#7fd3f3', violet: '#c3a6ff', box: '#1a2026', line: '#2a3238' };
const txt = (x, y, s, cls = 'co-s', anchor = 'middle') => sv('text', { x, y, textAnchor: anchor, class: cls }, s);
const rect = (x, y, w, h, stroke = C.grey, fill = C.box) => sv('rect', { x, y, width: w, height: h, rx: 3, fill, stroke, strokeWidth: 1.2 });
const octets = (n) => `${fmtNum(n)} octet${n > 1 ? 's' : ''}`;
const ms = (v) => (v < 1 ? `${fmtNum(v * 1000, 0)} µs` : v < 10 ? `${fmtNum(v, 2)} ms` : `${fmtNum(v, 0)} ms`);
const bits = (b) => (b >= 1e9 ? `${fmtNum(b / 1e9, b % 1e9 ? 1 : 0)} Gb/s` : `${fmtNum(b / 1e6, 0)} Mb/s`);

// ======================================================================================
// 1. Les couches : modèle OSI et modèle TCP/IP
// ======================================================================================
const OSI = [
  ['7', 'Application', 'ce que veut l\'utilisateur'], ['6', 'Présentation', 'format, chiffrement'], ['5', 'Session', 'dialogue ouvert, fermé'],
  ['4', 'Transport', 'de programme à programme'], ['3', 'Réseau', 'de machine à machine'], ['2', 'Liaison', 'de voisin à voisin'], ['1', 'Physique', 'des bits sur un support'],
];
// modèle TCP/IP : [nom, première et dernière couche OSI couvertes, protocoles, appareil]
const TCPIP = [
  ['Application', 0, 2, 'HTTP, DNS, DHCP, NTP, RTP, SRT, NMOS', 'serveurs, logiciels', C.violet],
  ['Transport', 3, 3, 'TCP, UDP (ports)', 'pare-feu', C.green],
  ['Internet (réseau)', 4, 4, 'IPv4, IPv6, ICMP (ping), IGMP', 'routeur', C.amber],
  ['Accès réseau', 5, 6, 'Ethernet, VLAN 802.1Q, Wi-Fi ; RJ45, fibre', 'commutateur ; câble, module SFP', C.cyan],
];
function figModeles() {
  const f = figure(720, 330, 'Le modèle OSI en sept couches, à gauche, et le modèle TCP/IP en quatre couches, à droite, avec les protocoles et les appareils de chaque couche');
  f.append(txt(130, 16, 'Modèle OSI (7 couches)', 'co-t'), txt(490, 16, 'Modèle TCP/IP (celui d\'Internet et du car)', 'co-t'));
  const y0 = 26, h = 40, g = 3;
  OSI.forEach(([n, nom, role], i) => {
    const y = y0 + i * (h + g);
    f.append(rect(10, y, 240, h), txt(26, y + 25, n, 'co-t'), txt(44, y + 17, nom, 'co-s', 'start'), txt(44, y + 33, role, 'co-m', 'start'));
  });
  for (const [nom, a, b, proto, app, col] of TCPIP) {
    const y = y0 + Number(a) * (h + g), hh = (Number(b) - Number(a) + 1) * (h + g) - g;
    f.append(rect(275, y, 435, hh, String(col)));
    f.append(txt(289, y + 17, String(nom), 'co-t', 'start'), txt(289, y + 33, String(proto), 'co-s', 'start'), txt(700, y + 17, String(app), 'co-m', 'end'));
    f.append(sv('path', { d: `M250 ${y + hh / 2} L275 ${y + hh / 2}`, stroke: String(col), strokeWidth: 1.5 }));
  }
  return f;
}
function demoModeles(host) {
  let donnees = 1200, transport = 'udp', rtp = true, vlan = true;
  const W = 720, H = 150;
  const fig = el('div', { class: 'co-figbox' });
  const rd = readout(['Paquet IP', 'Trame Ethernet', 'Sur le câble', 'Part des données', 'Paquets par seconde à 1 Gb/s']);
  const verdict = el('p', { class: 'co-verdict' });
  const COL = { Application: C.violet, Transport: C.green, Réseau: C.amber, Liaison: C.cyan };
  function update() {
    const e = encapsuler(donnees, { transport: /** @type {'udp' | 'tcp'} */ (transport), rtp, vlan });
    const f = figure(W, H, `Encapsulation de ${donnees} octets de données : chaque couche ajoute son en-tête`);
    const total = e.surLeCable, k = (W - 20) / total;
    // de bas en haut : ce qui passe sur le câble, puis chaque couche emballe la précédente
    const pieces = [{ nom: 'préambule', o: 8, c: C.grey }, ...[...e.couches].reverse().filter((c) => c.couche === 'Liaison' && !/FCS/.test(c.nom)).map((c) => ({ nom: 'Ethernet', o: c.octets, c: COL.Liaison })),
      { nom: 'IP', o: e.couches.find((c) => c.couche === 'Réseau')?.octets || 0, c: COL.Réseau },
      { nom: transport.toUpperCase(), o: e.couches.find((c) => c.couche === 'Transport')?.octets || 0, c: COL.Transport },
      ...(rtp ? [{ nom: 'RTP', o: 12, c: COL.Application }] : []),
      { nom: 'données', o: donnees, c: '#3a4652' }, ...(e.bourrage ? [{ nom: 'bourrage', o: e.bourrage, c: C.grey }] : []),
      { nom: 'FCS', o: 4, c: COL.Liaison }, { nom: 'silence', o: 12, c: '#222a31' }];
    let x = 10;
    for (const p of pieces) {
      const w = Math.max(1, p.o * k);
      f.append(sv('rect', { x, y: 60, width: w, height: 30, fill: p.c, stroke: '#0b0f12', strokeWidth: 0.5 }));
      if (w > 34) f.append(txt(x + w / 2, 79, p.nom, 'co-bit'));
      x += w;
    }
    // accolades : ce que voit chaque couche
    const brace = (x1, x2, y, s, col) => { f.append(sv('path', { d: `M${x1} ${y + 8} L${x1} ${y} L${x2} ${y} L${x2} ${y + 8}`, fill: 'none', stroke: col, strokeWidth: 1.2 }), txt((x1 + x2) / 2, y - 4, s, 'co-s')); };
    const xIp = 10 + (8 + 14 + (vlan ? 4 : 0)) * k, xFin = xIp + (e.paquetIp + e.bourrage + 4) * k;
    brace(10 + 8 * k, xFin, 22, `trame Ethernet : ${octets(e.trame)}`, COL.Liaison);
    brace(xIp, xIp + e.paquetIp * k, 46, `paquet IP : ${octets(e.paquetIp)}`, COL.Réseau);
    brace(10, x, 112, `sur le câble : ${octets(e.surLeCable)} (préambule et silence compris)`, C.grey);
    fig.replaceChildren(f);
    rd.set('Paquet IP', `${octets(e.paquetIp)} (MTU : ${fmtNum(MTU)})`);
    rd.set('Trame Ethernet', octets(e.trame) + (e.bourrage ? ` dont ${e.bourrage} de bourrage` : ''));
    rd.set('Sur le câble', octets(e.surLeCable));
    rd.set('Part des données', `${fmtNum(e.rendement * 100, 1)} %`);
    rd.set('Paquets par seconde à 1 Gb/s', fmtNum(Math.floor(1e9 / (e.surLeCable * 8))));
    if (e.tropGros) { verdict.className = 'co-verdict ko'; verdict.textContent = `Trop gros : le paquet IP dépasse la MTU de ${MTU} octets. Il serait découpé (fragmenté) ou jeté : ST 2110 et TCP choisissent des paquets qui tiennent.`; }
    else if (e.rendement < 0.7) { verdict.className = 'co-verdict warn'; verdict.textContent = 'Petits paquets : une grande part du câble transporte des en-têtes. C\'est le cas du son ST 2110-30 (paquets de 1 ms) et de PTP.'; }
    else { verdict.className = 'co-verdict ok'; verdict.textContent = 'Paquet bien rempli : les en-têtes ne coûtent que quelques pour cent.'; }
  }
  host.append(
    el('div', { class: 'co-ctl' },
      slider('Données de l\'application', 1, 1600, donnees, 1, (v) => { donnees = v; update(); }, (v) => octets(v)),
      choice('Transport', [['udp', 'UDP'], ['tcp', 'TCP']], transport, (v) => { transport = v; update(); }),
      choice('RTP (flux temps réel)', [['oui', 'avec'], ['non', 'sans']], 'oui', (v) => { rtp = v === 'oui'; update(); }),
      choice('Étiquette VLAN', [['oui', 'avec'], ['non', 'sans']], 'oui', (v) => { vlan = v === 'oui'; update(); })),
    fig, rd.el, verdict);
  update();
}

/** @type {import('./index.js').Lesson} */
export const MODELES = {
  id: 'reseau-modeles', title: 'Les couches du réseau : modèle OSI et modèle TCP/IP', minutes: '8 min',
  essentials: [
    'Un réseau se décrit en **couches** : chacune rend un service à celle du dessus et ne s\'occupe que de son travail. Le **modèle OSI** en compte 7, le **modèle TCP/IP** (celui d\'Internet et du car) 4.',
    'À l\'envoi, chaque couche **ajoute son en-tête** (encapsulation) : données → segment TCP ou datagramme UDP → paquet IP → trame Ethernet → bits sur le câble. À l\'arrivée, chacune retire le sien.',
    'Les appareils travaillent à une couche : le **commutateur** lit les adresses MAC (couche 2), le **routeur** les adresses IP (couche 3), le **pare-feu** aussi les ports (couche 4).',
  ],
  figure: figModeles,
  demoTitle: 'Changez la taille des données, passez de UDP à TCP, retirez RTP ou l\'étiquette VLAN : suivez ce que chaque couche ajoute et ce qui reste pour les données.',
  demo: demoModeles,
  body: `Pour envoyer une image d'une caméra au mélangeur, il faut résoudre plusieurs problèmes à la fois : faire passer des bits dans un câble, trouver la bonne machine sur le réseau local, traverser des routeurs, remettre les données au bon programme, dans l'ordre. Le réseau découpe ces problèmes en **couches** empilées. Chacune ne s'occupe que du sien et s'appuie sur celle du dessous.

**Le modèle OSI** (ISO, 1984) en décrit sept. On s'en sert surtout pour **nommer** les choses : « un problème de couche 1 » (câble, fibre, module), « un commutateur de niveau 3 » (qui route), « un pare-feu de couche 4 » (qui filtre sur les ports).
- **1 Physique** : des bits sur un support (tension sur une paire de cuivre, lumière dans une fibre, ondes radio) ;
- **2 Liaison** : une trame d'une machine à sa voisine sur le même réseau, repérée par les **adresses MAC** ; Ethernet, VLAN, Wi-Fi ;
- **3 Réseau** : un paquet d'une machine à une autre, à travers des routeurs, repéré par les **adresses IP** ;
- **4 Transport** : d'un **programme** à un autre (les **ports**), avec ou sans garantie de livraison (**TCP** ou **UDP**) ;
- **5 à 7** : session, présentation (format, chiffrement), application.

**Le modèle TCP/IP**, celui d'Internet, regroupe les couches 5 à 7 en une seule couche Application, et les couches 1 et 2 en une couche Accès réseau. C'est lui qu'on trouve dans les appareils du car : un flux ST 2110 est du **RTP** (application), dans de l'**UDP** (transport), dans de l'**IP** (réseau), dans de l'**Ethernet** (accès réseau), sur une **fibre**.

**L'encapsulation.** À l'envoi, chaque couche ajoute son **en-tête** devant ce qu'elle reçoit : RTP 12 octets, UDP 8 (TCP 20), IPv4 20, Ethernet 14 plus 4 octets de contrôle d'erreur (**FCS**) à la fin, et 4 de plus pour une étiquette VLAN. Sur le câble s'ajoutent encore 8 octets de préambule et un silence de 12 octets entre deux trames. À l'arrivée, chaque couche lit **son** en-tête, le retire et passe le reste à la couche du dessus. Le nom change selon la couche : **trame** (2), **paquet** (3), **segment** TCP ou **datagramme** UDP (4).

**La MTU** (maximum transmission unit) limite le paquet IP à **1 500 octets** sur Ethernet. Un paquet plus gros serait découpé en fragments ou jeté : ST 2110 envoie des datagrammes UDP d'environ 1 460 octets au plus, TCP découpe ses données en segments de 1 460 octets (le **MSS**).

**Dépanner couche par couche**, de bas en haut : la lumière ou le voyant du port (1), la machine dans la table MAC du commutateur et dans le bon VLAN (2), le ping (3), le bon port et le bon protocole (4), le réglage du logiciel (7). On ne cherche pas une erreur de configuration NMOS quand le voyant du port est éteint.`,
  plus: `- Les « niveaux » des commutateurs : un switch **de niveau 2** ne connaît que les MAC et les VLAN ; un switch **de niveau 3** route aussi entre les VLAN (le SW-CŒUR du car).
- Les adresses changent de rôle selon la couche : la **MAC** ne vaut que sur le réseau local (elle change à chaque routeur), l'**IP** vaut de bout en bout, le **port** désigne le programme.
- IPv6 a un en-tête de 40 octets ; un tunnel (VPN, SRT dans UDP…) ajoute une couche de plus : chaque emballage réduit la place pour les données.
- Une trame Ethernet fait au moins 64 octets : un paquet trop court est complété par du bourrage.`,
  car: { text: 'Au poste Réseau : le commutateur montre les adresses MAC apprises (couche 2), le routeur ses interfaces IP et ses routes (couche 3) ; dans le car IP, l\'analyseur ouvre un paquet ST 2110 couche par couche (Ethernet, IP, UDP, RTP, données).', station: 'reseau' },
  terms: ['osi', 'encapsulation', 'mac', 'mtu', 'udp', 'tcp', 'rtp'],
  competences: ['3.6', '2.10', '2.13'], article: 'reseau',
  quiz: [
    { q: 'Un flux vidéo ST 2110 voyage dans quel ordre d\'emballage, de l\'intérieur vers l\'extérieur ?',
      choices: ['Données → RTP → UDP → IP → Ethernet', ['Données → IP → UDP → RTP → Ethernet', 'IP est la couche réseau : elle emballe le datagramme UDP, pas l\'inverse.'], ['Données → Ethernet → IP → TCP', 'ST 2110 n\'utilise pas TCP, et Ethernet est l\'emballage le plus extérieur.']],
      answer: 0, why: 'Chaque couche emballe ce que lui donne celle du dessus : RTP (application), UDP (transport), IP (réseau), Ethernet (liaison).' },
    { q: 'À quelle couche du modèle OSI travaille un commutateur ordinaire (sans routage) ?',
      choices: [['Couche 1, physique', 'Il ne se contente pas de répéter les bits : il lit l\'adresse MAC de destination pour choisir le port.'], 'Couche 2, liaison : il aiguille les trames d\'après les adresses MAC', ['Couche 3, réseau', 'C\'est celle du routeur, qui lit les adresses IP. Un switch de niveau 3 fait les deux.']],
      answer: 1, why: 'Le commutateur apprend les adresses MAC et envoie chaque trame sur le bon port : c\'est la couche liaison.' },
    { q: 'Qu\'est-ce que la MTU d\'un lien Ethernet ?',
      choices: ['La taille maximale d\'un paquet IP dans une trame : 1 500 octets en standard', ['Le débit maximal du lien', 'Le débit se mesure en bit/s ; la MTU est une taille, en octets.'], ['Le nombre maximal de machines sur le lien', 'Aucun rapport : c\'est une taille de paquet.']],
      answer: 0, why: 'Un paquet plus gros que la MTU est fragmenté ou jeté : les flux média choisissent des paquets qui tiennent dans 1 500 octets.' },
    { q: 'Un technicien voit le voyant du port éteint sur le commutateur. Par quelle couche commence-t-il le dépannage ?',
      choices: [['Par l\'application : le réglage du logiciel', 'Sans lien physique, aucun réglage logiciel ne peut marcher : on commence par le bas.'], ['Par la couche réseau : l\'adresse IP', 'Une adresse juste ne sert à rien si aucun bit ne passe.'], 'Par la couche physique : câble, fibre, module SFP, port'],
      answer: 2, why: 'On dépanne de bas en haut : tant que la couche 1 ne fonctionne pas, rien au-dessus ne peut marcher.' },
    { q: 'Le RCP envoie une commande à sa CCU en passant par un routeur. Qu\'est-ce qui reste identique de bout en bout ?',
      choices: [['Les adresses MAC source et destination', 'Les MAC ne valent que sur un réseau local : le routeur refait la trame avec de nouvelles MAC.'], 'Les adresses IP source et destination', ['La trame Ethernet tout entière', 'Le routeur retire la trame et en fabrique une nouvelle pour le réseau suivant.']],
      answer: 1, why: 'La couche réseau (IP) porte l\'adresse de bout en bout ; la couche liaison (MAC) est refaite à chaque routeur.' },
    { q: 'Pourquoi le son ST 2110-30, envoyé en petits paquets toutes les millisecondes, « coûte » plus de câble que la vidéo pour la même quantité de données ?',
      choices: [['Parce que le son est compressé', 'ST 2110-30 transporte du PCM non compressé.'], 'Parce que chaque petit paquet porte les mêmes en-têtes (RTP, UDP, IP, Ethernet) qu\'un gros', ['Parce que le son passe en TCP', 'ST 2110-30 passe en UDP, comme la vidéo.']],
      answer: 1, why: 'Environ 60 à 80 octets d\'en-têtes et d\'écarts par paquet : sur un petit paquet, c\'est une grosse part du total.' },
  ],
};

// ======================================================================================
// 2. LAN, MAN, WAN : de la régie à l'antenne
// ======================================================================================
function figEchelles() {
  const f = figure(720, 210, 'Les échelles du réseau : le LAN du car et du stade, le MAN de l\'agglomération jusqu\'au nodal de l\'opérateur, le WAN jusqu\'à la régie finale, et le satellite');
  const zones = [
    [10, 'LAN', 'le car, le stade', 'mètres à quelques km', C.cyan, 150],
    [170, 'MAN', 'l\'agglomération', 'jusqu\'à ~50 km', C.green, 150],
    [330, 'WAN', 'le pays, le monde', 'centaines de km et plus', C.amber, 230],
  ];
  for (const [x, nom, ou, dist, col, w] of zones) {
    f.append(rect(Number(x), 34, Number(w), 120, String(col)), txt(Number(x) + Number(w) / 2, 56, String(nom), 'co-t'), txt(Number(x) + Number(w) / 2, 74, String(ou), 'co-s'), txt(Number(x) + Number(w) / 2, 144, String(dist), 'co-m'));
  }
  const nodes = [[80, 108, 'car régie'], [240, 108, 'nodal opérateur'], [480, 108, 'régie finale (Paris)'], [640, 60, 'satellite']];
  for (const [x, y, s] of nodes) f.append(sv('circle', { cx: x, cy: y, r: 7, fill: C.box, stroke: '#fff', strokeWidth: 1.2 }), txt(Number(x), Number(y) + 22, String(s), 'co-m'));
  f.append(sv('path', { d: 'M87 108 L233 108 M247 108 L473 108', stroke: '#fff', strokeWidth: 1.5 }));
  f.append(sv('path', { d: 'M80 101 Q360 -10 633 60', fill: 'none', stroke: C.violet, strokeWidth: 1.2, strokeDasharray: '4 3' }));
  f.append(txt(640, 86, 'DSNG : ≈ 36 000 km', 'co-m'), txt(640, 182, 'satellite géostationnaire', 'co-s'));
  f.append(txt(360, 20, 'Plus c\'est loin, plus la lumière met de temps : environ 5 µs par km de fibre', 'co-t'));
  f.append(txt(170, 196, 'Internet : un réseau de réseaux, qui relie des LAN par des WAN d\'opérateurs', 'co-s', 'start'));
  return f;
}
function demoEchelles(host) {
  let sel = 'wan';
  const rd = readout(['Échelle', 'Support', 'Distance', 'Débit (ordre de grandeur)', 'Propagation', 'Sérialisation d\'un paquet de 1 500 octets', 'Équipements traversés', 'Latence aller simple', 'Aller-retour (RTT)']);
  const barres = el('div', { class: 'co-figbox' });
  const verdict = el('p', { class: 'co-verdict' });
  function update() {
    const e = ECHELLES.find((x) => x.id === sel) || ECHELLES[0], l = latenceEchelle(e);
    rd.set('Échelle', e.echelle); rd.set('Support', e.support);
    rd.set('Distance', e.id === 'sat' ? '2 × 35 786 km (montée, descente)' : e.km < 1 ? `${fmtNum(e.km * 1000)} m` : `${fmtNum(e.km)} km`);
    rd.set('Débit (ordre de grandeur)', bits(e.debit)); rd.set('Propagation', ms(l.prop)); rd.set('Sérialisation d\'un paquet de 1 500 octets', ms(l.ser));
    rd.set('Équipements traversés', ms(l.equip)); rd.set('Latence aller simple', ms(l.total)); rd.set('Aller-retour (RTT)', ms(2 * l.total));
    // barres en échelle logarithmique : de 10 µs à 1 s
    const W = 720, H = 26 * ECHELLES.length + 30, x0 = 260, x1 = 700;
    const lx = (v) => x0 + (Math.log10(Math.max(v, 0.01)) + 2) / 5 * (x1 - x0);
    const f = figure(W, H, 'Latence aller simple de chaque liaison, en échelle logarithmique de 10 microsecondes à 1 seconde');
    for (const [v, s] of [[0.01, '10 µs'], [0.1, '100 µs'], [1, '1 ms'], [10, '10 ms'], [100, '100 ms'], [1000, '1 s']]) f.append(sv('line', { x1: lx(v), y1: 6, x2: lx(v), y2: H - 18, stroke: C.line }), txt(lx(v), H - 4, String(s), 'co-m'));
    ECHELLES.forEach((x, i) => {
      const t = latenceEchelle(x).total, y = 10 + i * 26, on = x.id === sel;
      f.append(txt(x0 - 8, y + 14, `${x.echelle} · ${x.nom.split(' : ')[0].split(' →')[0]}`, on ? 'co-t' : 'co-s', 'end'));
      f.append(sv('rect', { x: x0, y: y + 3, width: Math.max(2, lx(t) - x0), height: 15, rx: 2, fill: on ? C.amber : '#3a4652' }));
    });
    barres.replaceChildren(f);
    const rtt = 2 * l.total;
    verdict.className = 'co-verdict ' + (rtt < 1 ? 'ok' : rtt < 100 ? 'warn' : 'ko');
    verdict.textContent = rtt < 1 ? 'Réseau local : la latence ne se sent pas. On peut y faire passer de la vidéo non compressée (ST 2110) et l\'horloge PTP.'
      : rtt < 100 ? `Aller-retour de ${ms(rtt)} : la vidéo passe compressée, avec un protocole qui encaisse ce délai (SRT, contribution par l'opérateur). Une intercom se sent un peu.`
        : `Aller-retour de ${ms(rtt)} : on le voit à l'antenne (duplex avec un plateau : questions et réponses se chevauchent). L'intercom et le retour image doivent en tenir compte.`;
  }
  host.append(el('div', { class: 'co-ctl' }, choice('Liaison', ECHELLES.map((e) => [e.id, e.nom.split(' : ')[0].split(' (')[0], e.nom]), sel, (v) => { sel = v; update(); })), rd.el, barres, verdict);
  update();
}

/** @type {import('./index.js').Lesson} */
export const ECHELLES_LECON = {
  id: 'reseau-lan-wan', title: 'LAN, MAN, WAN : de la régie à l\'antenne', minutes: '7 min',
  essentials: [
    '**LAN** : le réseau local (le car, le stade), à soi, très rapide, quasi sans délai. **MAN** : l\'agglomération. **WAN** : le pays et au-delà, loué à des **opérateurs** ; Internet est un réseau de réseaux.',
    'La lumière met environ **5 µs par km** dans une fibre : 1,25 ms pour Lens → Paris, au moins **239 ms** par satellite géostationnaire. Chaque équipement traversé ajoute son délai.',
    'Plus le lien est long, moins il y a de débit et plus il y a de délai : la vidéo non compressée reste dans le LAN, elle part compressée vers la régie finale.',
  ],
  figure: figEchelles,
  demoTitle: 'Choisissez une liaison : comparez distance, débit, propagation et délai des équipements, et ce que cela change à l\'antenne.',
  demo: demoEchelles,
  body: `On classe les réseaux par leur **étendue**. Elle décide de qui les possède, de leur débit et de leur délai.

- **LAN** (local area network, réseau local) : une pièce, un bâtiment, un car, un stade. On le possède, on le câble soi-même, le débit est énorme (10, 25, 100 Gb/s par lien) et le délai négligeable (quelques microsecondes). Le **WLAN** est un LAN sans fil (Wi-Fi). Dans le car, les réseaux de contrôle et le réseau média ST 2110 sont des LAN.
- **MAN** (metropolitan area network) : une agglomération, jusqu'à quelques dizaines de km. Souvent la fibre d'un **opérateur** ou d'une collectivité, entre le stade et le **nodal** (le point d'entrée du réseau de l'opérateur).
- **WAN** (wide area network) : un pays, un continent. On **loue** de la capacité à un opérateur : une liaison dédiée (fibre, longueur d'onde, circuit garanti), un réseau privé de l'opérateur, ou Internet. Le satellite et les réseaux mobiles (4G, 5G) sont aussi des WAN.
- **Internet** relie entre eux les réseaux de milliers d'opérateurs : personne ne garantit le débit ni le délai de bout en bout.

**D'où vient le délai.** Trois parts s'additionnent :
- la **propagation** : la lumière va moins vite dans le verre (≈ 204 000 km/s) que dans le vide, environ **5 µs par km** de fibre ; le câble suit les routes et les voies ferrées, il est plus long que la distance à vol d'oiseau ;
- la **sérialisation** : poser les bits d'un paquet sur le lien, 12 µs pour 1 500 octets à 1 Gb/s, 1,2 µs à 10 Gb/s ;
- les **équipements** : chaque commutateur, routeur, encodeur, file d'attente ajoute son temps. Sur Internet, c'est souvent la plus grosse part.

**Le satellite géostationnaire** tourne à 35 786 km d'altitude. Monter puis redescendre fait au moins 71 572 km, soit **239 ms** à la vitesse de la lumière ; en pratique, environ un quart de seconde d'aller simple, plus d'une demi-seconde pour une question et sa réponse. C'est le délai qu'on entend dans un duplex lointain.

**Ce que cela change pour une captation.** Dans le LAN du car, l'image circule **non compressée** (1,5 à 12 Gb/s par source). Vers la régie finale, sur un WAN, on envoie le **programme compressé** (de quelques dizaines à quelques centaines de Mb/s), par la fibre de l'opérateur ou par Internet avec un protocole qui encaisse les pertes (**SRT**), avec un secours (satellite, 4G/5G agrégées). Le délai du WAN impose de prévoir le **retour image** et l'**intercom** avec la régie finale.`,
  plus: `- **Fibre noire** : une fibre louée nue, éclairée par ses propres équipements ; **longueur d'onde** : un canal coloré sur la fibre de l'opérateur ; **MPLS** : réseau privé de l'opérateur, avec des classes de service.
- Le délai aller-retour (**RTT**, round-trip time) est ce que mesure \`ping\` : c'est lui qui règle la latence de SRT et le débit de TCP.
- Les satellites en orbite basse (environ 550 km) ont un délai bien plus faible (quelques dizaines de ms), mais le satellite se déplace : il faut changer de satellite en permanence.
- PAN (personal area network) : Bluetooth, à quelques mètres.`,
  car: { text: 'Au poste Transmission : le départ du programme vers la régie finale (WAN de l\'opérateur), avec son secours. Dans le car et le stade, tout reste en LAN (réseaux de contrôle et réseau média).', station: 'transmission' },
  terms: ['lan-wan', 'latence', 'debit', 'srt'],
  competences: ['2.11', '4.4', '3.4'], article: 'reseau',
  quiz: [
    { q: 'Le réseau qui relie les appareils à l\'intérieur du car régie est…',
      choices: ['Un LAN (réseau local)', ['Un MAN', 'Le MAN couvre une agglomération : bien plus grand que le car.'], ['Un WAN', 'Le WAN couvre un pays et se loue à un opérateur : le car a son propre réseau.']],
      answer: 0, why: 'Un réseau à soi, dans un espace restreint, très rapide et sans délai : c\'est un LAN.' },
    { q: 'Combien de temps la lumière met-elle, environ, pour parcourir 200 km de fibre ?',
      choices: [['1 µs', 'C\'est le temps pour 200 mètres environ.'], '1 ms', ['100 ms', 'C\'est cent fois trop : 5 µs par km donnent 1 ms pour 200 km.']],
      answer: 1, why: 'Environ 5 µs par km dans la fibre : 200 × 5 µs = 1 ms.' },
    { q: 'Pourquoi un duplex par satellite géostationnaire a-t-il un délai d\'au moins un quart de seconde ?',
      choices: [['Parce que l\'encodage satellite est lent', 'L\'encodage ajoute un peu, mais le minimum vient de la distance.'], 'Parce que le signal monte à près de 36 000 km et redescend : au moins 239 ms à la vitesse de la lumière', ['Parce que le satellite stocke les images avant de les renvoyer', 'Le satellite relaie le signal en direct.']],
      answer: 1, why: '2 × 35 786 km = 71 572 km, divisés par 300 000 km/s : 239 ms au minimum, avant tout équipement.' },
    { q: 'Pourquoi la vidéo non compressée (ST 2110) reste-t-elle dans le LAN du car, et part-elle compressée vers la régie finale ?',
      choices: ['Parce que le WAN loué offre bien moins de débit (et plus de délai) que le LAN', ['Parce que ST 2110 est interdit sur Internet', 'Rien ne l\'interdit : c\'est le débit (1,5 Gb/s et plus par source) qui coûte trop cher sur un WAN.'], ['Parce que la compression supprime le délai', 'La compression ajoute un peu de délai ; elle réduit le débit.']],
      answer: 0, why: 'Dans le LAN, 10 à 100 Gb/s par lien sont gratuits ; sur un WAN, chaque Mb/s se loue. On compresse avant de sortir.' },
    { q: 'Sur une liaison par Internet entre deux pays, quelle part du délai est souvent la plus grosse ?',
      choices: [['La sérialisation des paquets', 'Quelques microsecondes par paquet aux débits actuels.'], 'Les équipements traversés et leurs files d\'attente', ['Le préambule des trames Ethernet', '8 octets par trame : négligeable.']],
      answer: 1, why: 'Routeurs, files d\'attente, détours entre opérateurs : sur Internet, ils pèsent souvent plus que la propagation.' },
    { q: 'Qu\'est-ce qu\'un nodal ?',
      choices: [['Le commutateur central du car', 'Celui-là s\'appelle ici SW-CŒUR.'], 'Le point d\'entrée du réseau de l\'opérateur, où arrivent les liaisons des sites', ['Le satellite de secours', 'Le satellite est une autre voie de transmission.']],
      answer: 1, why: 'Le nodal est le centre technique de l\'opérateur où se raccordent les liaisons des stades et des régies.' },
  ],
};

// ======================================================================================
// 3. Câbles et débits : cuivre, fibre, modules SFP
// ======================================================================================
function figCables() {
  const f = figure(720, 210, 'Trois supports : la paire torsadée en cuivre (RJ45, 100 m), la fibre multimode au cœur de 50 µm (quelques centaines de mètres) et la fibre monomode au cœur de 9 µm (10 km et plus), branchées par des modules SFP');
  // cuivre
  f.append(rect(10, 30, 220, 150, C.amber), txt(120, 50, 'Cuivre : paires torsadées', 'co-t'));
  for (let i = 0; i < 4; i++) { const x = 40 + i * 44; f.append(sv('circle', { cx: x, cy: 100, r: 12, fill: 'none', stroke: C.amber, strokeWidth: 1.5 }), sv('circle', { cx: x + 10, cy: 108, r: 12, fill: 'none', stroke: '#fff', strokeWidth: 1 })); }
  f.append(txt(120, 140, 'RJ45, Cat 5e / 6 / 6A', 'co-s'), txt(120, 158, '100 m au plus, 1 à 10 Gb/s', 'co-m'), txt(120, 174, 'alimente aussi (PoE)', 'co-m'));
  // multimode
  const fib = (x, coeur, col, titre, l1, l2) => {
    f.append(rect(x, 30, 220, 150, col), txt(x + 110, 50, titre, 'co-t'));
    f.append(sv('circle', { cx: x + 110, cy: 100, r: 34, fill: '#222a31', stroke: C.grey }), sv('circle', { cx: x + 110, cy: 100, r: coeur, fill: col, opacity: 0.85 }));
    f.append(txt(x + 110, 152, l1, 'co-s'), txt(x + 110, 170, l2, 'co-m'));
  };
  fib(250, 14, C.green, 'Fibre multimode (OM3, OM4)', 'cœur de 50 µm, gaine 125 µm', '70 à 550 m selon le débit');
  fib(490, 3, C.cyan, 'Fibre monomode (OS2)', 'cœur de 9 µm, gaine 125 µm', '10 km et plus (40 km en ER)');
  f.append(txt(360, 202, 'Dans un switch, le port reçoit un module SFP (1 Gb/s), SFP+ (10), SFP28 (25) ou QSFP28 (100) adapté au support', 'co-s'));
  return f;
}
const DISTANCES = [1, 2, 3, 5, 10, 20, 30, 50, 70, 100, 150, 200, 300, 400, 550, 800, 1000, 2000, 5000, 10000, 20000, 40000];
function demoCables(host) {
  let debit = 10, di = 9;
  const rd = readout(['Lien le plus simple', 'Support', 'Temps pour poser un paquet de 1 500 octets', 'Propagation sur la distance']);
  const table = el('div', { class: 'co-figbox' });
  const verdict = el('p', { class: 'co-verdict' });
  const SUP = { cuivre: 'cuivre', dac: 'cuivre (DAC)', mm: 'fibre multimode', sm: 'fibre monomode' };
  function update() {
    const m = DISTANCES[di], ok = liensPossibles(debit, m);
    const best = ok[0];
    rd.set('Lien le plus simple', best ? best.nom : 'aucun en un seul tronçon');
    rd.set('Support', best ? `${SUP[best.support]} : ${best.cable}` : '—');
    rd.set('Temps pour poser un paquet de 1 500 octets', `${fmtNum(serialisation(1500, debit * 1e9), 2)} µs`);
    rd.set('Propagation sur la distance', `${fmtNum(propagationFibre(m / 1000) * 1000, 2)} µs`);
    const t = el('table', { class: 'co-table' }, el('thead', {}, el('tr', {}, ...['Lien', 'Débit', 'Support', 'Portée', ''].map((h) => el('th', {}, h)))));
    const tb = el('tbody');
    for (const l of LIENS.filter((x) => x.debit >= debit)) {
      const marche = l.portee >= m;
      tb.append(el('tr', { style: { opacity: marche ? '1' : '0.45' } }, el('td', {}, l.nom), el('td', {}, `${l.debit} Gb/s`), el('td', {}, SUP[l.support]),
        el('td', {}, l.portee >= 1000 ? `${fmtNum(l.portee / 1000)} km` : `${l.portee} m`), el('td', {}, marche ? (l === best ? '✔ le plus simple' : '✔') : 'trop court')));
    }
    t.append(tb); table.replaceChildren(t);
    verdict.className = 'co-verdict ' + (!best ? 'ko' : best.support === 'cuivre' || best.support === 'dac' ? 'ok' : 'warn');
    verdict.textContent = !best ? 'Aucun lien ne tient ce débit sur cette distance d\'un seul tenant : il faut un équipement intermédiaire (commutateur, répéteur) ou une liaison d\'opérateur.'
      : best.support === 'cuivre' || best.support === 'dac' ? 'Le cuivre suffit : simple, robuste, et il peut alimenter l\'appareil (PoE).'
        : best.support === 'mm' ? 'Il faut de la fibre multimode : modules SR, bon marché, pour l\'intérieur d\'un bâtiment ou d\'un car.'
          : 'Il faut de la fibre monomode : modules LR ou ER, pour les longues distances (stade, nodal). C\'est aussi la fibre des caméras (SMPTE).';
  }
  host.append(el('div', { class: 'co-ctl' },
    choice('Débit voulu', [['1', '1 Gb/s'], ['10', '10 Gb/s'], ['25', '25 Gb/s'], ['100', '100 Gb/s']], '10', (v) => { debit = +v; update(); }),
    slider('Distance', 0, DISTANCES.length - 1, di, 1, (v) => { di = v; update(); }, (v) => (DISTANCES[v] >= 1000 ? `${fmtNum(DISTANCES[v] / 1000)} km` : `${DISTANCES[v]} m`))),
  rd.el, table, verdict);
  update();
}

/** @type {import('./index.js').Lesson} */
export const CABLES = {
  id: 'reseau-cables', title: 'Câbles et débits : cuivre, fibre, modules SFP', minutes: '7 min',
  essentials: [
    'Le **cuivre** (paires torsadées, RJ45) va jusqu\'à **100 m** : 1 Gb/s en Cat 5e, 10 Gb/s en Cat 6A. Au-delà, ou au-delà de 10 Gb/s, il faut de la **fibre**.',
    'La fibre **multimode** (cœur de 50 µm) porte 10 Gb/s sur 300 m (OM3) ; la **monomode** (cœur de 9 µm) porte 10 à 100 Gb/s sur **10 km** et plus.',
    'Le port d\'un commutateur reçoit un **module** (SFP, SFP+, SFP28, QSFP28) choisi pour le débit et la fibre : les deux bouts doivent être du même type.',
  ],
  figure: figCables,
  demoTitle: 'Choisissez un débit et une distance : quels liens tiennent, lequel est le plus simple ?',
  demo: demoCables,
  body: `La couche physique transporte les bits. Trois familles de supports se partagent le car et le stade.

**La paire torsadée en cuivre.** Quatre paires de fils torsadés, une prise **RJ45**. Les normes Ethernet sur cuivre garantissent **100 m** par lien, avec le bon câble :
- **1000BASE-T** (1 Gb/s) : catégorie 5e ;
- **2.5GBASE-T** et **5GBASE-T** : catégorie 5e et 6 ;
- **10GBASE-T** (10 Gb/s) : catégorie **6A** (en catégorie 6, 55 m au plus).
Le cuivre peut **alimenter** l'appareil (**PoE**) : pupitres, panneaux d'intercom, caméras PTZ. Il craint les longueurs, les parasites et la foudre entre deux bâtiments.

**La fibre optique.** Un cœur de verre guide la lumière ; rien ne l'arrête que l'atténuation et la dispersion, elle ne craint ni les parasites ni les différences de potentiel.
- **Multimode** (OM3, OM4, gaine orange ou turquoise) : cœur de **50 µm**, lumière d'un laser bon marché (850 nm). Portée selon le débit : 1 Gb/s sur 550 m, **10 Gb/s sur 300 m** (OM4 : 400 m), 25 et 100 Gb/s sur 70 m (OM4 : 100 m). Pour l'intérieur d'un car ou d'un bâtiment.
- **Monomode** (OS2, gaine jaune) : cœur de **9 µm**, un seul chemin pour la lumière (1 310 ou 1 550 nm). **10 km** en version LR, 40 km en ER, quel que soit le débit jusqu'à 100 Gb/s. C'est la fibre des liaisons entre bâtiments, vers le nodal, et celle des câbles de caméra SMPTE.

**Les modules.** Le port d'un switch est une cage ; on y glisse le **module** qui convient : **SFP** (1 Gb/s), **SFP+** (10), **SFP28** (25), **QSFP28** (100 Gb/s, quatre voies). Le module fixe la longueur d'onde et la portée (SR pour le multimode, LR ou ER pour le monomode). Les deux bouts d'un lien doivent avoir des modules du même type, sur le bon type de fibre : un module SR sur de la monomode, ou un LR à un bout et un SR à l'autre, et le lien ne monte pas. Entre deux appareils d'une même baie, un câble **DAC** (cuivre serti sur deux modules) coûte moins cher que deux modules et une fibre.

**Le débit ne fait pas tout.** Le temps de **sérialisation** d'un paquet de 1 500 octets est de 12 µs à 1 Gb/s et de 1,2 µs à 10 Gb/s ; la **propagation** ajoute environ 5 µs par km. Dans un car, ces délais sont négligeables ; ce sont les **débits** qui comptent : une seule source UHD non compressée (ST 2110-20, 2160p50 en 10 bits) dépasse 8 Gb/s, d'où des liens de 25 et 100 Gb/s dans les cars IP.`,
  plus: `- **Nettoyer** un connecteur de fibre avant de le brancher : une poussière sur un cœur de 9 µm suffit à couper le lien. Mesurer le **niveau optique** reçu (en dBm) dit si le lien a de la marge.
- **Auto-négociation** : deux ports en cuivre s'accordent sur le débit et le duplex. Un port bloqué à 100 Mb/s, ou en half duplex, est une panne classique.
- La **catégorie** d'un câble cuivre se lit sur sa gaine (CAT6A) ; un câble de 120 m peut « marcher » en 1 Gb/s et faire des erreurs à 10 Gb/s.
- Chaque module a une **puissance** et une **sensibilité** : la différence est le budget optique, qu'on compare aux pertes de la fibre et des connecteurs.`,
  car: { text: 'Au poste Réseau : chaque port des commutateurs indique son débit et son module. Dans le car IP, les liens leaf → spine sont en 100 Gb/s, les appareils en 25 Gb/s ; dans le stade, les caméras arrivent par la fibre monomode de leur câble SMPTE.', station: 'reseau' },
  terms: ['sfp', 'rj45', 'poe', 'fibre-monomode', 'niveau-optique', 'vitesse'],
  competences: ['2.10', '3.8', '3.9'],
  quiz: [
    { q: 'Quelle longueur maximale garantit la norme Ethernet sur câble cuivre à paires torsadées ?',
      choices: [['10 m', 'C\'est l\'ordre de grandeur d\'un câble DAC, pas d\'un câble RJ45.'], '100 m', ['1 km', 'Au-delà de 100 m, il faut de la fibre (ou un équipement intermédiaire).']],
      answer: 1, why: '100 m par lien, du switch à l\'appareil, cordons de brassage compris.' },
    { q: 'Il faut relier en 10 Gb/s deux baies distantes de 200 m dans un bâtiment. Que choisir ?',
      choices: [['Du cuivre catégorie 6A', '10GBASE-T s\'arrête à 100 m.'], 'De la fibre multimode OM3 avec des modules 10GBASE-SR', ['Un câble DAC', 'Un DAC ne dépasse pas quelques mètres.']],
      answer: 1, why: '10GBASE-SR porte 10 Gb/s sur 300 m de multimode OM3 : c\'est la solution la plus simple ici.' },
    { q: 'Quelle fibre relie le stade au nodal de l\'opérateur, à 15 km ?',
      choices: ['De la monomode, avec des modules LR ou ER', ['De la multimode OM4', 'La multimode s\'arrête à quelques centaines de mètres.'], ['Une fibre plastique', 'Bien trop courte et lente pour 15 km.']],
      answer: 0, why: 'Seule la monomode (cœur de 9 µm) porte un signal sur 10 km et plus.' },
    { q: 'Un lien ne monte pas entre deux switchs. À un bout, un module 10GBASE-LR ; à l\'autre, un 10GBASE-SR. Pourquoi ?',
      choices: [['Les modules doivent être de la même marque', 'Pas forcément : ils doivent être du même type (longueur d\'onde, fibre).'], 'SR (multimode, 850 nm) et LR (monomode, 1 310 nm) ne se comprennent pas', ['Il manque l\'adresse IP du lien', 'Un lien physique monte sans aucune adresse.']],
      answer: 1, why: 'Les deux bouts doivent émettre et recevoir la même longueur d\'onde, sur le type de fibre prévu.' },
    { q: 'Combien de temps faut-il pour poser un paquet de 1 500 octets sur un lien à 10 Gb/s ?',
      choices: ['1,2 µs', ['12 µs', 'C\'est à 1 Gb/s : dix fois plus lent.'], ['1,2 ms', 'Mille fois trop : 12 000 bits à 10 milliards de bits par seconde font 1,2 µs.']],
      answer: 0, why: '1 500 × 8 = 12 000 bits ; 12 000 / 10 000 000 000 = 1,2 µs.' },
    { q: 'Pourquoi alimente-t-on souvent les panneaux d\'intercom par leur câble réseau ?',
      choices: [['Parce que la fibre transporte du courant', 'La fibre ne transporte pas d\'électricité.'], 'Parce que le PoE fait passer l\'alimentation sur les paires de cuivre du câble RJ45', ['Parce que les panneaux n\'ont pas besoin de courant', 'Ils en ont besoin : quelques watts, fournis par le switch.']],
      answer: 1, why: 'Le PoE (802.3af, at, bt) fournit de 15 à 90 W par port selon la norme : un seul câble pour les données et le courant.' },
  ],
};

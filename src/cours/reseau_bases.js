// @ts-check
import { el } from '../util.js';
import { sv, figure, choice, readout, fmtNum } from './kit.js';
import { encapsuler, serialisationUs, LIENS, fluxParLien, bondSatelliteMs, budgetLatence, ETENDUES } from './ip_calc.js';

// ----------------------------------------------------------------------------------
// Chapitre « Le réseau », partie « Les bases d'un réseau » : le modèle en couches (OSI, TCP/IP, encapsulation),
// la taille d'un réseau (LAN, MAN, WAN) et Ethernet (câbles, débits, trame). Calculs : cours/ip_calc.js.
// Normes : ISO/IEC 7498-1, RFC 1122, IEEE 802.3 ; UIT-T G.114 (150 ms dans un sens pour une conversation).
// ----------------------------------------------------------------------------------
const COUL = { 7: '#d08cff', 6: '#c59cf0', 5: '#b8aee6', 4: '#7fd3f3', 3: '#ffd38a', 2: '#7fd1a0', 1: '#9aa4ad' };

// ======================================================================================
// Le modèle en couches
// ======================================================================================
function figModele() {
  const f = figure(440, 212, 'À gauche les sept couches du modèle OSI, à droite les quatre couches du modèle TCP/IP qui leur correspondent ; au milieu, ce que chaque couche manipule et l\'appareil qui travaille à ce niveau.');
  const R = [[7, 'Application'], [6, 'Présentation'], [5, 'Session'], [4, 'Transport'], [3, 'Réseau'], [2, 'Liaison'], [1, 'Physique']];
  const y0 = 22, h = 26;
  f.append(sv('text', { x: 72, y: 14, textAnchor: 'middle', class: 'co-t' }, 'OSI'), sv('text', { x: 382, y: 14, textAnchor: 'middle', class: 'co-t' }, 'TCP/IP'));
  R.forEach(([n, nom], i) => {
    const y = y0 + i * h;
    f.append(sv('rect', { x: 8, y, width: 128, height: h - 3, rx: 3, fill: '#1a2229', stroke: COUL[n] }), sv('text', { x: 16, y: y + 16, class: 'co-t' }, `${n} · ${nom}`));
  });
  const TCP = [[0, 3, 'Application', 7], [3, 1, 'Transport', 4], [4, 1, 'Internet', 3], [5, 2, 'Accès réseau', 2]];
  for (const [i, n, nom, c] of /** @type {[number, number, string, number][]} */ (TCP)) f.append(sv('rect', { x: 330, y: y0 + i * h, width: 104, height: n * h - 3, rx: 3, fill: '#1a2229', stroke: COUL[c] }), sv('text', { x: 382, y: y0 + i * h + n * h / 2 + 3, textAnchor: 'middle', class: 'co-t' }, nom));
  const MID = [[0, 3, 'HTTP, RTP, NMOS, DNS', 'données'], [3, 1, 'TCP, UDP · les ports', 'segment, datagramme'], [4, 1, 'IP · le routeur', 'paquet'], [5, 1, 'Ethernet, VLAN · le commutateur', 'trame'], [6, 1, 'câble, fibre, SFP', 'bits']];
  for (const [i, n, a, b] of /** @type {[number, number, string, string][]} */ (MID)) {
    const yc = y0 + i * h + n * h / 2;
    f.append(sv('text', { x: 233, y: yc - 1, textAnchor: 'middle', class: 'co-s' }, a), sv('text', { x: 233, y: yc + 11, textAnchor: 'middle', class: 'co-m' }, b));
    f.append(sv('line', { x1: 138, y1: yc, x2: 150, y2: yc, stroke: '#3a4650' }), sv('line', { x1: 316, y1: yc, x2: 328, y2: yc, stroke: '#3a4650' }));
  }
  return f;
}

const ENVOIS = {
  video: { nom: 'Un paquet d\'image ST 2110', donnees: 1200, o: { transport: 'udp', rtp: true }, quoi: '1 200 octets de pixels' },
  web: { nom: 'La page web de la CCU', donnees: 1460, o: { transport: 'tcp', rtp: false }, quoi: '1 460 octets de page' },
  ptp: { nom: 'Un message PTP (Sync)', donnees: 44, o: { transport: 'udp', rtp: false }, quoi: '44 octets de message' },
  ping: { nom: 'Un ping', donnees: 56, o: { transport: 'icmp', rtp: false }, quoi: '56 octets de bourrage' },
};
const LECTEURS = {
  cable: { nom: 'Le câble, un module SFP', jusqua: 1, lit: 'des bits : il ne lit rien, il transporte' },
  switch: { nom: 'Un commutateur', jusqua: 2, lit: 'la trame : l\'adresse MAC de destination (et le VLAN)' },
  routeur: { nom: 'Un routeur', jusqua: 3, lit: 'le paquet : l\'adresse IP de destination (et le TTL)' },
  parefeu: { nom: 'Un pare-feu', jusqua: 4, lit: 'jusqu\'aux ports : il autorise ou bloque tel service' },
  dest: { nom: 'L\'appareil destinataire', jusqua: 7, lit: 'tout, en retirant chaque en-tête jusqu\'aux données' },
};
function demoModele(host) {
  let envoi = 'video', qui = 'switch';
  const strip = el('div', { class: 'co-strip', role: 'group', 'aria-label': 'Les couches, du fil aux données' });
  const R = readout(['Ce qui part', 'Sur le fil', 'Part utile', 'Ce que lit l\'appareil']);
  const draw = () => {
    const E = ENVOIS[envoi], L = LECTEURS[qui], enc = encapsuler(E.donnees, E.o);
    const cs = [...enc.couches].reverse(); // du fil vers les données
    strip.replaceChildren(...cs.map((c) => {
      const lu = c.couche <= L.jusqua || (c.couche === 7 && L.jusqua === 7);
      const taille = c.tete || c.total;
      return el('div', { class: 'co-seg-l' + (lu ? ' on' : ''), style: { flexGrow: String(Math.max(taille, 60)), background: COUL[c.couche], opacity: lu ? '1' : '.35' }, title: `${c.nom} : ${taille} octets` }, el('span', {}, c.nom.replace(/ \(.*\)/, '')), el('small', {}, `${taille} o`));
    }));
    R.set('Ce qui part', `${E.nom} : ${E.quoi}`);
    R.set('Sur le fil', `${enc.surFil} octets (en-têtes : ${enc.surFil - E.donnees} octets)`);
    R.set('Part utile', `${fmtNum(enc.efficacite * 100, 0)} %`);
    R.set('Ce que lit l\'appareil', `${L.nom} : ${L.lit}`);
  };
  host.append(el('div', { class: 'co-ctl' },
    choice('Ce qui part', Object.entries(ENVOIS).map(([k, v]) => [k, v.nom]), envoi, (v) => { envoi = v; draw(); }),
    choice('Qui le lit', Object.entries(LECTEURS).map(([k, v]) => [k, v.nom]), qui, (v) => { qui = v; draw(); })),
  strip, R.el);
  draw();
}

/** @type {import('./index.js').Lesson} */
export const MODELE = {
  id: 'reseau-modele', title: 'Le modèle en couches : OSI et TCP/IP', minutes: '7 min',
  essentials: [
    'Un réseau se décrit en **couches** : chacune rend un service à celle du dessus et ajoute son **en-tête** devant les données (l\'**encapsulation**).',
    '**OSI** en compte sept (physique, liaison, réseau, transport, session, présentation, application) ; **TCP/IP** en garde quatre : accès réseau, Internet, transport, application.',
    'Chaque appareil travaille à un niveau : le câble au 1, le **commutateur** au 2 (adresses MAC), le **routeur** au 3 (adresses IP), le **pare-feu** jusqu\'au 4 (ports). On dépanne de bas en haut.',
  ],
  figure: figModele,
  demoTitle: 'Choisissez ce qui part sur le réseau, puis l\'appareil qui le voit passer : regardez les en-têtes ajoutés et ce que chaque appareil lit.',
  demo: demoModele,
  body: `Envoyer une image de la caméra au mélangeur, c'est résoudre plusieurs problèmes à la fois : mettre un signal sur un câble, désigner le voisin à qui le remettre, trouver un chemin à travers les routeurs, livrer au bon logiciel, comprendre les données. Plutôt que d'en faire un seul protocole géant, on empile des **couches**, chacune avec son travail et son vocabulaire.

**Le modèle OSI** (ISO 7498, 1984) en compte sept :
- **1 physique** : le signal électrique ou lumineux, les connecteurs, le débit (câble RJ45, fibre, module SFP) ;
- **2 liaison** : la **trame** entre deux voisins d'un même réseau, avec les **adresses MAC** (Ethernet, VLAN) ;
- **3 réseau** : le **paquet** de bout en bout, avec les **adresses IP** et le routage ;
- **4 transport** : le **segment** TCP ou le **datagramme** UDP, les **ports** qui désignent le logiciel ;
- **5 session**, **6 présentation**, **7 application** : le dialogue, le format et le chiffrement, l'application elle-même (HTTP, RTP, NMOS, DNS).

**Le modèle TCP/IP**, celui d'Internet (RFC 1122), regroupe ces sept couches en quatre : accès réseau (1 et 2), Internet (3), transport (4), application (5 à 7). On garde pourtant les numéros d'OSI dans le métier : un commutateur « de niveau 2 », un routeur « de niveau 3 ».

**L'encapsulation.** À l'émission, chaque couche ajoute son **en-tête** devant ce que lui donne la couche du dessus : 1 200 octets d'image reçoivent 12 octets de RTP (numéro, horodatage), 8 d'UDP (les ports), 20 d'IP (les adresses), 18 d'Ethernet (adresses MAC, type, contrôle) ; sur le fil s'ajoutent encore le préambule et un silence entre deux trames, 20 octets. À l'arrivée, chaque couche lit son en-tête et le retire : la **décapsulation**. Un appareil n'ouvre que les couches dont il a besoin : le commutateur lit l'adresse MAC, le routeur l'adresse IP, le pare-feu le port.

**Pourquoi c'est utile au technicien : on dépanne de bas en haut.**
- 1 : le voyant du port est-il allumé ? la vitesse négociée est-elle la bonne ?
- 2 : la machine est-elle dans le bon VLAN ? sa MAC apparaît-elle dans la table du commutateur ?
- 3 : son adresse, son masque, sa passerelle sont-ils justes ? le ping passe-t-il ?
- 4 et au-delà : le service écoute-t-il sur le bon port ? un pare-feu le bloque-t-il ? le logiciel est-il bien réglé ?
Sauter une couche fait perdre du temps : inutile de chercher une erreur de configuration NMOS sur un câble débranché.`,
  plus: `- Les couches 5 et 6 n'ont presque pas d'existence propre dans TCP/IP : le chiffrement (TLS) et les formats (MPEG-TS, JSON) vivent dans l'application.
- Un flux ST 2110 : couche 1 la fibre et le module SFP28, 2 Ethernet et son VLAN, 3 IP en multicast, 4 UDP, 7 RTP et les pixels (RFC 4175).
- La **MTU** (1 500 octets de données dans une trame) est la limite de la couche 2 : un paquet IP plus grand doit être découpé, ou passer en trames géantes (« jumbo ») sur tout le chemin.
- Les noms des unités : bit (1), trame (2), paquet (3), segment ou datagramme (4), message ou données (7).`,
  car: { text: 'Au poste Réseau IP (car IP), l\'analyseur de trames déplie chaque paquet couche par couche, comme Wireshark : Ethernet II (adresses MAC), IPv4 (adresses, DSCP), UDP (ports), RTP (numéro, horodatage). Le dépannage du car SDI suit les mêmes étapes : voyant, VLAN, adresse, ping, service.', station: 'reseau' },
  terms: ['modele-osi', 'encapsulation', 'mtu', 'commutateur', 'routage', 'udp'],
  competences: ['3.6', '2.10', '2.13'], article: 'reseau',
  quiz: [
    { q: 'À quelle couche du modèle OSI travaille un commutateur Ethernet ordinaire ?',
      choices: [['Couche 1, physique', 'Le câble et le répéteur y travaillent : ils transportent des bits sans rien lire. Le commutateur, lui, lit des adresses.'], 'Couche 2, liaison : il lit l\'adresse MAC de destination', ['Couche 3, réseau', 'C\'est le niveau du routeur, qui lit l\'adresse IP. Un commutateur ordinaire ne la regarde pas.']],
      answer: 1, why: 'Le commutateur apprend et lit les adresses MAC des trames : c\'est un appareil de niveau 2. Un commutateur « de niveau 3 » (comme SW-CŒUR) ajoute la fonction de routeur.' },
    { q: 'Dans quel ordre les en-têtes s\'empilent-ils autour de 1 200 octets d\'image ST 2110, de l\'intérieur vers l\'extérieur ?',
      choices: ['RTP, UDP, IP, Ethernet', ['Ethernet, IP, UDP, RTP', 'C\'est l\'ordre dans lequel on les lit à l\'arrivée, de l\'extérieur vers l\'intérieur : la trame Ethernet enveloppe tout.'], ['IP, RTP, Ethernet, UDP', 'RTP est une couche d\'application, au plus près des données ; Ethernet est la plus externe.']],
      answer: 0, why: 'Chaque couche emballe ce que lui donne celle du dessus : RTP (application) d\'abord, puis UDP (transport), IP (réseau), et la trame Ethernet (liaison) enveloppe le tout.' },
    { q: 'Combien de couches compte le modèle TCP/IP ?',
      choices: [['Sept', 'C\'est le modèle OSI. TCP/IP regroupe les trois couches hautes en une, et les deux basses en une.'], 'Quatre : accès réseau, Internet, transport, application', ['Deux : TCP et IP', 'TCP et IP ne sont que deux protocoles, un par couche ; le modèle en compte quatre.']],
      answer: 1, why: 'TCP/IP (RFC 1122) : accès réseau (OSI 1 et 2), Internet (3), transport (4), application (5 à 7).' },
    { q: 'Le voyant d\'un port est éteint. Par quoi commencer ?',
      choices: [['Vérifier l\'adresse IP et le masque de la machine', 'C\'est la couche 3 : inutile tant que la couche 1 ne fonctionne pas.'], ['Redémarrer le logiciel de l\'appareil', 'La couche 7 viendra en dernier : sans lien physique, aucun logiciel ne communique.'], 'Le câble, le module SFP, le port : la couche physique'],
      answer: 2, why: 'On dépanne de bas en haut : voyant éteint, c\'est la couche 1 (câble, connecteur, module, port coupé). Le reste ne peut pas marcher sans elle.' },
    { q: 'Qu\'est-ce qu\'un pare-feu lit de plus qu\'un routeur ?',
      choices: ['Les ports (couche 4) : il autorise ou bloque un service précis', ['L\'adresse MAC', 'Le routeur la lit aussi, et la change à chaque saut ; ce n\'est pas ce qui distingue le pare-feu.'], ['Rien : un pare-feu est un routeur sous un autre nom', 'Un routeur choisit un chemin d\'après l\'adresse IP ; le pare-feu décide aussi d\'après le port et l\'état de la connexion.']],
      answer: 0, why: 'Le routeur s\'arrête à l\'adresse IP (couche 3). Le pare-feu regarde aussi les ports (couche 4), voire le contenu : il peut laisser passer le web et bloquer tout le reste.' },
    { q: '1 200 octets d\'image partent dans 1 278 octets sur le fil. D\'où viennent les 78 octets de plus ?',
      choices: [['De la compression', 'ST 2110-20 ne compresse pas, et une compression réduirait la taille au lieu de l\'augmenter.'], 'Des en-têtes (RTP 12, UDP 8, IP 20, Ethernet 18) et du préambule et du silence entre trames (20)', ['D\'une copie de secours du paquet', 'La redondance ST 2022-7 passe par un autre réseau, avec son propre paquet complet.']],
      answer: 1, why: '12 + 8 + 20 + 18 + 20 = 78 octets : c\'est le prix de l\'encapsulation, ici 6 % du débit.' },
  ],
};

// ======================================================================================
// LAN, MAN, WAN
// ======================================================================================
function figEtendue() {
  const f = figure(440, 196, 'Trois cercles emboîtés : le LAN du car, au centre, dans le MAN de la ville, lui-même dans le WAN qui relie la régie finale à Paris. Pour chacun : la distance, l\'aller-retour typique et à qui appartiennent les liens.');
  f.append(sv('rect', { x: 6, y: 6, width: 428, height: 184, rx: 18, fill: 'rgba(208,140,255,.06)', stroke: '#d08cff', 'stroke-dasharray': '5 4' }));
  f.append(sv('rect', { x: 26, y: 40, width: 230, height: 136, rx: 16, fill: 'rgba(255,211,138,.07)', stroke: '#ffd38a', 'stroke-dasharray': '5 4' }));
  f.append(sv('rect', { x: 46, y: 84, width: 104, height: 74, rx: 10, fill: 'rgba(127,209,160,.12)', stroke: '#7fd1a0' }));
  f.append(sv('text', { x: 98, y: 102, textAnchor: 'middle', class: 'co-t' }, 'LAN : le car'), sv('text', { x: 98, y: 118, textAnchor: 'middle', class: 'co-s' }, 'Ethernet, 100 m'), sv('text', { x: 98, y: 132, textAnchor: 'middle', class: 'co-m' }, '< 1 ms'), sv('text', { x: 98, y: 148, textAnchor: 'middle', class: 'co-s' }, 'à vous'));
  f.append(sv('text', { x: 200, y: 60, textAnchor: 'middle', class: 'co-t' }, 'MAN : la ville'), sv('text', { x: 200, y: 112, textAnchor: 'middle', class: 'co-s' }, 'fibre louée'), sv('text', { x: 200, y: 126, textAnchor: 'middle', class: 'co-s' }, 'ou noire, ≈ 15 km'), sv('text', { x: 200, y: 142, textAnchor: 'middle', class: 'co-m' }, '≈ 0,2 ms'));
  f.append(sv('text', { x: 345, y: 30, textAnchor: 'middle', class: 'co-t' }, 'WAN : le pays, le monde'), sv('text', { x: 345, y: 74, textAnchor: 'middle', class: 'co-s' }, 'fibre d\'opérateur,'), sv('text', { x: 345, y: 88, textAnchor: 'middle', class: 'co-s' }, 'Internet, satellite'), sv('text', { x: 345, y: 108, textAnchor: 'middle', class: 'co-m' }, 'Lens → Paris :'), sv('text', { x: 345, y: 122, textAnchor: 'middle', class: 'co-m' }, '≈ 3 à 15 ms'), sv('text', { x: 345, y: 138, textAnchor: 'middle', class: 'co-m' }, 'satellite : ≈ 500 ms'), sv('text', { x: 345, y: 158, textAnchor: 'middle', class: 'co-s' }, 'aux opérateurs'));
  return f;
}
const CHEMINS = {
  lan: { nom: 'Dans le car (LAN)', etendue: 'lan', km: 0.05, sauts: 2, equipementUs: 5, fileMs: 0, milieu: 'cuivre' },
  man: { nom: 'Stade → centre technique (MAN)', etendue: 'man', km: 15, sauts: 3, equipementUs: 10, fileMs: 0, milieu: 'fibre' },
  wan: { nom: 'Fibre d\'opérateur vers Paris (WAN)', etendue: 'wan', km: 250, sauts: 6, equipementUs: 20, fileMs: 0, milieu: 'fibre' },
  internet: { nom: 'Internet vers Paris (WAN)', etendue: 'wan', km: 320, sauts: 12, equipementUs: 100, fileMs: 3, milieu: 'fibre' },
  sat: { nom: 'Satellite géostationnaire (WAN)', etendue: 'wan', km: 0, sauts: 2, equipementUs: 0, fileMs: 0, milieu: 'air' },
};
const USAGES = {
  video: { nom: 'Envoyer les images', sens: 1, seuil: 1000, quoi: 'aller seul' },
  commande: { nom: 'Régler une caméra à distance', sens: 2, seuil: 100, quoi: 'un aller-retour par réglage' },
  duplex: { nom: 'Une interview en duplex', sens: 1, seuil: 150, quoi: 'chaque réplique fait l\'aller' },
};
function demoEtendue(host) {
  let ch = 'wan', us = 'duplex';
  const R = readout(['Étendue', 'Propagation (aller)', 'Aller', 'Aller-retour', 'En images à 50 i/s', 'Qui tient les liens']);
  const verdict = el('p', { class: 'co-verdict' });
  const draw = () => {
    const C = CHEMINS[ch], E = ETENDUES[C.etendue], U = USAGES[us];
    const B = ch !== 'sat' ? budgetLatence({ km: C.km, milieu: C.milieu, sauts: C.sauts, gbps: 10, equipementUs: C.equipementUs, fileMs: C.fileMs }) : null;
    const aller = B ? B.total : bondSatelliteMs() + 10; // un bond, plus les stations au sol (ordre de grandeur)
    const prop = B ? B.prop : bondSatelliteMs();
    R.set('Étendue', `${E.nom} : ${E.ex}`);
    R.set('Propagation (aller)', ch === 'sat' ? `${fmtNum(prop, 0)} ms (2 × 35 786 km à la vitesse de la lumière)` : `${fmtNum(prop, prop < 1 ? 3 : 2)} ms pour ${fmtNum(C.km, C.km < 1 ? 2 : 0)} km (${C.milieu === 'fibre' ? '≈ 5 µs/km dans la fibre' : 'paire torsadée'})`);
    R.set('Aller', `${fmtNum(aller, aller < 1 ? 3 : 1)} ms (propagation, traversée de ${C.sauts} équipement(s)${C.fileMs ? ', files d\'attente' : ''})`);
    R.set('Aller-retour', `${fmtNum(2 * aller, 2 * aller < 1 ? 3 : 1)} ms`);
    R.set('En images à 50 i/s', `${fmtNum(aller / 20, 2)} image(s) de 20 ms à l'aller`);
    R.set('Qui tient les liens', `${E.qui} · ${E.techno} · ${E.debit}`);
    const t = U.sens * aller, ok = t <= U.seuil;
    verdict.textContent = `${U.nom} (${U.quoi}) : ${fmtNum(t, t < 1 ? 3 : 0)} ms. ` + (ok ? 'Sans gêne.' : us === 'duplex' ? 'Au-delà de 150 ms dans un sens (UIT-T G.114), les interlocuteurs se coupent la parole.' : 'Le réglage répond avec un retard qui se sent.');
    verdict.className = 'co-verdict ' + (ok ? 'ok' : 'ko');
  };
  host.append(el('div', { class: 'co-ctl' },
    choice('Le chemin', Object.entries(CHEMINS).map(([k, v]) => [k, v.nom]), ch, (v) => { ch = v; draw(); }),
    choice('Ce qu\'on fait passer', Object.entries(USAGES).map(([k, v]) => [k, v.nom]), us, (v) => { us = v; draw(); })),
  R.el, verdict);
  draw();
}

/** @type {import('./index.js').Lesson} */
export const ETENDUE = {
  id: 'reseau-etendue', title: 'LAN, MAN, WAN : du car au monde', minutes: '6 min',
  essentials: [
    'Un **LAN** couvre un lieu (le car, un studio) et appartient à celui qui l\'exploite ; un **MAN** relie les sites d\'une ville ; un **WAN** relie des villes ou des pays, par des opérateurs.',
    'Plus le réseau est grand, plus la **latence** monte (≈ 5 µs par kilomètre de fibre, ≈ 240 ms par bond satellite) et moins on maîtrise le débit et les pertes.',
    'Une captation emploie les trois : le LAN du car, la fibre du stade (MAN), la **contribution** vers la régie finale (WAN : fibre d\'opérateur, satellite, Internet).',
  ],
  figure: figEtendue,
  demoTitle: 'Choisissez un chemin et ce qu\'on y fait passer : comparez la latence et dites si l\'usage la supporte.',
  demo: demoEtendue,
  body: `On classe les réseaux par leur **étendue**, et ce n'est pas qu'une affaire de taille : avec la distance changent les propriétaires des liens, les techniques, le débit disponible et surtout le **retard**.

**Le LAN** (Local Area Network) couvre un lieu : le car, un studio, un bâtiment. Il appartient à celui qui l'exploite, qui choisit tout : les commutateurs, les VLAN, la QoS. Ethernet sur cuivre (100 m au plus) ou sur fibre, de 1 à 100 Gb/s, et un aller-retour de quelques dizaines de microsecondes. Le **WLAN** est un LAN sans fil (Wi-Fi), le **PAN** un réseau personnel (Bluetooth).

**Le MAN** (Metropolitan Area Network) relie les sites d'une ville : le stade, le centre technique de l'opérateur, une salle de spectacle, la mairie. Des boucles de **fibre** louées à un opérateur ou à une collectivité, parfois de la **fibre noire** (nue, que l'on éclaire avec ses propres équipements). Quelques dizaines de kilomètres, encore très peu de retard.

**Le WAN** (Wide Area Network) relie des villes et des pays. Ses liens appartiennent à des **opérateurs** : réseau managé avec un débit garanti (fibre d'opérateur, MPLS), **Internet** (pas de garantie : le débit varie, des paquets se perdent), **satellite**, réseaux mobiles **4G/5G**. Internet lui-même est un WAN fait de milliers de réseaux reliés entre eux.

**Le retard grandit avec la distance.** La lumière parcourt environ 200 000 km/s dans le verre : **5 µs par kilomètre**, soit 1,25 ms pour les 250 km de fibre entre Lens et Paris. S'y ajoutent la traversée de chaque équipement et l'attente dans les files. Un satellite géostationnaire est à 35 786 km : montée et descente font environ **240 ms** pour un seul bond, avant tout codage. Pour une conversation, l'UIT recommande de rester sous **150 ms dans un sens** (G.114) : un duplex par satellite se reconnaît à ses silences gênés.

**Ce que cela change pour une captation.** Dans le car, on maîtrise tout. Vers la régie finale, on dépend des opérateurs : on double les chemins (fibre et satellite, ou deux fibres par deux routes différentes), on mesure la latence et les pertes avant l'antenne, et l'on choisit le protocole selon le chemin (leçon « Les protocoles du streaming »). En **production à distance** (remote, REMI), les caméras sont au stade et la régie à des centaines de kilomètres : toute la latence du WAN se retrouve dans les commandes des RCP et dans le retour des images.`,
  plus: `- Ordres de grandeur d'aller-retour : LAN < 1 ms ; MAN de 0,1 à 1 ms ; WAN national par fibre de 3 à 15 ms ; transatlantique ≈ 70 à 80 ms ; satellite géostationnaire ≈ 500 ms ; satellites en orbite basse ≈ 30 à 50 ms.
- Un WAN d'opérateur se loue avec un **SLA** (engagement de service) : débit, disponibilité, temps de rétablissement.
- La fibre ne suit pas la ligne droite : on compte la longueur réelle du câble, souvent 20 à 50 % de plus que la distance à vol d'oiseau.`,
  car: { text: 'Au poste Transmission : TX1 part par la fibre de l\'opérateur (encodeur JPEG XS), TX2 par satellite (HEVC), avec un retard nettement plus grand. Le retour antenne revient avec plusieurs secondes de retard : on ne réalise jamais en le regardant.', station: 'transmission' },
  terms: ['lan-wan', 'latence', 'contribution', 'fibre-monomode'],
  competences: ['2.10', '2.11', '3.4'], article: 'reseau',
  quiz: [
    { q: 'Le réseau du car, avec ses commutateurs et ses VLAN, est…',
      choices: ['Un LAN : un lieu, un exploitant qui choisit tout', ['Un MAN, parce qu\'il est mobile', 'L\'étendue se juge à la zone couverte, pas à la mobilité : le car couvre quelques dizaines de mètres.'], ['Un WAN, parce qu\'il sort sur Internet', 'Il a une sortie vers un WAN, mais le réseau du car lui-même reste local.']],
      answer: 0, why: 'Un LAN couvre un lieu et appartient à son exploitant : c\'est exactement le réseau d\'un car.' },
    { q: 'Combien de temps la lumière met-elle pour parcourir 250 km de fibre ?',
      choices: [['0,25 ms', 'C\'est le temps pour 50 km : dans la fibre, il faut environ 5 µs par kilomètre.'], 'Environ 1,25 ms', ['Environ 25 ms', 'Dix fois trop : à 200 000 km/s, 250 km se parcourent en 1,25 ms.']],
      answer: 1, why: 'Environ 200 000 km/s dans le verre, soit 5 µs par km : 250 × 5 µs = 1,25 ms. Le reste du retard d\'un WAN vient des équipements et des files.' },
    { q: 'Pourquoi un duplex par satellite géostationnaire est-il gênant ?',
      choices: [['Parce que le satellite compresse trop l\'image', 'La compression n\'y est pour rien : c\'est la distance.'], ['Parce que le satellite perd beaucoup de paquets', 'Une liaison satellite bien réglée perd très peu ; son défaut est ailleurs.'], 'Parce qu\'un bond fait environ 240 ms de retard, au-delà des 150 ms qu\'une conversation supporte'],
      answer: 2, why: '36 000 km de montée et autant de descente, à la vitesse de la lumière : environ 240 ms par bond, plus le codage. L\'UIT (G.114) recommande moins de 150 ms dans un sens.' },
    { q: 'Qu\'appelle-t-on de la « fibre noire » ?',
      choices: ['Une fibre louée nue, qu\'on éclaire avec ses propres équipements', ['Une fibre hors service', 'Elle est « noire » parce que personne ne l\'éclaire avant vous, pas parce qu\'elle est en panne.'], ['Une fibre gainée de noir pour l\'extérieur', 'La couleur de la gaine n\'a rien à voir : c\'est un mode de location.']],
      answer: 0, why: 'L\'opérateur ne fournit que le verre ; vous y mettez vos propres modules et choisissez débit et protocoles. C\'est courant pour relier un stade à un centre technique (MAN).' },
    { q: 'Quelle différence entre un WAN d\'opérateur managé et Internet pour une contribution ?',
      choices: [['Aucune : tout passe par les mêmes câbles', 'Les câbles peuvent être les mêmes, pas les engagements.'], 'Le réseau managé garantit un débit et une qualité (SLA) ; Internet ne garantit rien : débit variable, pertes possibles', ['Internet est toujours plus rapide', 'Il peut être rapide, mais rien n\'est garanti, et il perd parfois des paquets.']],
      answer: 1, why: 'Sur Internet, il faut un protocole qui répare les pertes (SRT, RIST) et de la marge ; sur un réseau managé, l\'opérateur s\'engage sur le débit et la disponibilité.' },
    { q: 'En production à distance, la régie est à 300 km des caméras. Qu\'est-ce qui en souffre d\'abord ?',
      choices: [['La qualité de l\'image', 'Avec un débit suffisant, l\'image arrive intacte ; c\'est le retard qui pose problème.'], ['Le son, qui se décale', 'Le son et l\'image voyagent ensemble et restent synchrones, à l\'horodatage près.'], 'Les commandes : le RCP règle une caméra qui répond avec l\'aller-retour du WAN en plus'],
      answer: 2, why: 'Chaque réglage fait un aller-retour : propagation, équipements, files, codage. On mesure ce retard avant l\'antenne et l\'on choisit des liens directs.' },
  ],
};

// ======================================================================================
// Ethernet
// ======================================================================================
function figEthernet() {
  const f = figure(440, 168, 'La trame Ethernet : préambule, adresses MAC de destination et de source, étiquette VLAN, type, données de 46 à 1 500 octets, contrôle FCS, puis un silence entre deux trames. En dessous, les deux supports : cuivre RJ45 jusqu\'à 100 m, fibre avec modules SFP sur des kilomètres.');
  const P = [['Préamb.', 8, '#59646f'], ['MAC dest.', 6, '#7fd1a0'], ['MAC src', 6, '#7fd1a0'], ['VLAN', 4, '#7fd3f3'], ['Type', 2, '#7fd3f3'], ['Données 46 à 1 500', 0, '#ffd38a'], ['FCS', 4, '#ff9a8a'], ['Silence', 12, '#3a4650']];
  const W = [34, 50, 50, 32, 32, 150, 30, 34]; let x = 8;
  P.forEach(([n, o, c], i) => {
    f.append(sv('rect', { x, y: 18, width: W[i] - 2, height: 34, rx: 2, fill: c, opacity: 0.85 }), sv('text', { x: x + (W[i] - 2) / 2, y: 38, textAnchor: 'middle', class: 'co-bit' }, String(n)));
    if (o) f.append(sv('text', { x: x + (W[i] - 2) / 2, y: 66, textAnchor: 'middle', class: 'co-m' }, `${o} o`));
    x += W[i];
  });
  f.append(sv('text', { x: 8, y: 12, class: 'co-s' }, 'La trame (IEEE 802.3), dans l\'ordre où elle passe sur le câble'));
  f.append(sv('rect', { x: 8, y: 88, width: 205, height: 70, rx: 6, fill: '#1a2229', stroke: '#9aa4ad' }), sv('text', { x: 18, y: 106, class: 'co-t' }, 'Cuivre : RJ45, paire torsadée'), sv('text', { x: 18, y: 122, class: 'co-s' }, '1 GbE (catégorie 5e), 10 GbE (6A)'), sv('text', { x: 18, y: 138, class: 'co-s' }, '100 m au plus, alimentation PoE'), sv('text', { x: 18, y: 152, class: 'co-m' }, 'commandes, intercom, PC'));
  f.append(sv('rect', { x: 227, y: 88, width: 205, height: 70, rx: 6, fill: '#1a2229', stroke: '#7fd3f3' }), sv('text', { x: 237, y: 106, class: 'co-t' }, 'Fibre : modules SFP'), sv('text', { x: 237, y: 122, class: 'co-s' }, '10, 25, 100 GbE (SFP+, SFP28, QSFP28)'), sv('text', { x: 237, y: 138, class: 'co-s' }, 'multimode ≈ 100 m, monomode 10 km'), sv('text', { x: 237, y: 152, class: 'co-m' }, 'flux ST 2110, liens entre baies'));
  return f;
}
const FLUX = {
  hd: { nom: 'ST 2110-20 1080p50', gbps: 2.16 },
  uhd: { nom: 'ST 2110-20 2160p50', gbps: 8.6 },
  jxs: { nom: 'JPEG XS (HD)', gbps: 0.2 },
  ndi: { nom: 'NDI 1080p', gbps: 0.13 },
  hevc: { nom: 'HEVC de contribution', gbps: 0.02 },
};
function demoEthernet(host) {
  let lien = '10g-sfp', flux = 'hd', trame = 1500;
  const R = readout(['Le lien', 'Flux qui tiennent (90 % de charge)', 'Une trame sur le fil', 'Part utile d\'une trame']);
  const verdict = el('p', { class: 'co-verdict' });
  const draw = () => {
    const L = LIENS.find((x) => x.id === lien) || LIENS[0], F = FLUX[flux];
    const n = fluxParLien(F.gbps, L.gbps);
    const enc = encapsuler(trame - 20 - 8, { transport: 'udp', rtp: false }); // données UDP pour une trame IP de cette taille
    R.set('Le lien', `${L.nom} · ${L.gbps} Gb/s par sens · ${L.portee}`);
    R.set('Flux qui tiennent (90 % de charge)', `${n} × ${F.nom} (${fmtNum(F.gbps, 2)} Gb/s chacun)`);
    R.set('Une trame sur le fil', `${fmtNum(serialisationUs(trame + 38, L.gbps), 2)} µs pour ${trame + 18} octets de trame (et 20 de préambule et de silence)`);
    R.set('Part utile d\'une trame', `${fmtNum(enc.efficacite * 100, 1)} % (en-têtes UDP, IP, Ethernet et silence)`);
    verdict.textContent = n === 0 ? `Le flux ne tient pas : ${fmtNum(F.gbps, 2)} Gb/s sur un lien de ${L.gbps} Gb/s. Il faut un lien plus rapide.` : trame > 1500 ? 'Trames géantes (jumbo) : à activer sur tous les équipements du chemin, sinon elles sont jetées.' : `Ça tient, avec de la marge pour les rafales.`;
    verdict.className = 'co-verdict ' + (n === 0 ? 'ko' : trame > 1500 ? 'warn' : 'ok');
  };
  host.append(el('div', { class: 'co-ctl' },
    choice('Le lien', LIENS.map((x) => [x.id, x.nom.replace(/ \(.*\)/, '')]), lien, (v) => { lien = v; draw(); }),
    choice('Le flux', Object.entries(FLUX).map(([k, v]) => [k, v.nom]), flux, (v) => { flux = v; draw(); }),
    choice('Taille du paquet IP', [['576', '576 o'], ['1500', '1 500 o (MTU)'], ['9000', '9 000 o (jumbo)']], String(trame), (v) => { trame = +v; draw(); })),
  R.el, verdict);
  draw();
}

/** @type {import('./index.js').Lesson} */
export const ETHERNET = {
  id: 'reseau-ethernet', title: 'Ethernet : câbles, débits et trame', minutes: '7 min',
  essentials: [
    '**Ethernet** (IEEE 802.3) est le réseau local de presque tout : la même trame circule sur **cuivre** (RJ45, 100 m au plus) ou sur **fibre** (modules SFP, de 100 m à 10 km et plus).',
    'Les débits vont par paliers : 1, 10, 25, 100 Gb/s. Un flux ST 2110 en 1080p50 (≈ 2,2 Gb/s) ne tient pas sur 1 GbE ; quatre tiennent sur 10 GbE, dix sur 25 GbE.',
    'La **trame** : adresses MAC de destination et de source, type, données de 46 à **1 500 octets** (la MTU), contrôle FCS. Un lien est **full duplex** : chaque sens a tout son débit.',
  ],
  figure: figEthernet,
  demoTitle: 'Choisissez un lien et un flux : combien en tiennent, combien de temps met une trame, quelle part est utile ? Essayez les trames géantes.',
  demo: demoEthernet,
  body: `**Ethernet** est né en 1973 pour relier des ordinateurs d'un même laboratoire ; normalisé sous le nom **IEEE 802.3**, il est devenu le réseau local de presque tout, du PC de bureau au cœur d'un car ST 2110. Ce qui ne change pas d'un débit à l'autre, c'est la **trame**.

**La trame.** Dans l'ordre où elle passe sur le câble :
- un **préambule** (8 octets) qui cale l'horloge du récepteur ;
- l'**adresse MAC de destination** (6 octets), puis celle de la **source** (6) ;
- éventuellement une **étiquette VLAN** 802.1Q (4 octets : numéro de VLAN et priorité) ;
- le **type** (2 octets) : 0x0800 pour IPv4, 0x86DD pour IPv6, 0x88F7 pour PTP directement sur Ethernet ;
- les **données**, de **46 à 1 500 octets** : 1 500 est la **MTU** (unité de transmission maximale) ; une trame plus courte est complétée ;
- le **FCS** (4 octets), un contrôle d'intégrité : une trame abîmée est jetée par le premier commutateur qui la reçoit.
Puis un silence de 12 octets avant la trame suivante.

**Les supports.** Sur **cuivre**, la paire torsadée et son connecteur **RJ45** : 1 GbE sur un câble de catégorie 5e, 10 GbE en catégorie 6A, **100 m au plus**. Le cuivre peut aussi **alimenter** l'appareil (PoE : un panneau d'intercom, une caméra PTZ, un point d'accès Wi-Fi). Au-delà, ou au-delà de 10 Gb/s, on passe à la **fibre** : le port du commutateur reçoit un **module SFP** choisi pour le lien (SFP+ 10 GbE, SFP28 25 GbE, QSFP28 100 GbE ; « SR » pour la fibre multimode, une centaine de mètres ; « LR » pour la monomode, 10 km).

**Le débit.** Il se lit par sens : un lien 10 GbE transporte 10 Gb/s dans chaque direction en même temps (**full duplex**). On ne le remplit jamais à 100 % : les flux arrivent par rafales et il faut de la marge. Un flux ST 2110-20 en 1080p50 fait environ 2,2 Gb/s : il ne tient pas sur 1 GbE, quatre tiennent sur un 10 GbE en gardant 10 % de marge, dix sur un 25 GbE. Une image UHD (≈ 8,6 Gb/s) demande au moins du 25 GbE.

**La négociation.** Les deux bouts d'un câble cuivre s'accordent sur la vitesse et le duplex (autonégociation). Un câble mal serti ou abîmé peut faire tomber un port Gigabit à 100 Mb/s : le voyant est allumé, tout « marche », mais le débit est dix fois trop faible. Premier réflexe devant un débit inexplicable : lire la vitesse négociée du port.`,
  plus: `- **Trames géantes** (jumbo, jusqu'à 9 000 octets de données) : moins d'en-têtes et moins de paquets par seconde, mais tous les équipements du chemin doivent les accepter ; ST 2110-10 prévoit 1 460 octets par défaut et une option jumbo.
- Un lien **agrégé** (LACP, 802.3ad) réunit plusieurs câbles en un seul lien logique, flux par flux.
- La vitesse de propagation n'est pas le débit : le premier bit met 5 µs par kilomètre à arriver, quel que soit le débit ; le débit dit combien de bits on pose par seconde.
- Temps pour poser une trame de 1 538 octets (1 500 de données, en-têtes, préambule et silence) : 12,3 µs à 1 Gb/s, 1,23 µs à 10 Gb/s.`,
  car: { text: 'Au poste Réseau (car SDI) : SW-CŒUR a 24 ports RJ45 Gigabit et 4 ports SFP ; SW-PROD et SW-VISION alimentent leurs appareils en PoE ; la vitesse négociée de chaque port s\'y lit. Dans le car IP, chaque leaf a 48 ports SFP28 (25 ou 10 GbE) et ses liens vers les spines sont en QSFP28 à 100 GbE.', station: 'reseau' },
  terms: ['ethernet', 'sfp', 'rj45', 'mtu', 'vitesse', 'poe'],
  competences: ['2.10', '3.9', '3.6'], article: 'reseau',
  quiz: [
    { q: 'Jusqu\'à quelle longueur un lien Ethernet sur câble RJ45 est-il garanti ?',
      choices: [['10 m', 'C\'est l\'ordre de grandeur d\'un câble DAC entre deux baies, pas d\'un câble RJ45.'], '100 m', ['1 km', 'Au-delà de 100 m, il faut de la fibre (ou un équipement intermédiaire).']],
      answer: 1, why: 'La norme garantit 100 m de câble (90 m de câble fixe et des cordons). Au-delà, on passe à la fibre et aux modules SFP.' },
    { q: 'Combien de flux ST 2110-20 en 1080p50 (≈ 2,2 Gb/s) peut-on faire passer sur un lien 10 GbE en gardant de la marge ?',
      choices: [['Un seul', 'Un 10 GbE en porte bien plus ; c\'est sur un lien 1 GbE qu\'aucun ne passerait.'], 'Quatre', ['Dix', 'C\'est le compte pour un lien 25 GbE.']],
      answer: 1, why: '4 × 2,2 = 8,8 Gb/s : moins de 90 % des 10 Gb/s. Un cinquième dépasserait la marge, un sixième déborderait.' },
    { q: 'Que vaut la MTU d\'Ethernet, sans trames géantes ?',
      choices: ['1 500 octets de données par trame', ['64 octets', 'C\'est la taille minimale d\'une trame, pas la taille maximale de ses données.'], ['9 000 octets', 'C\'est la taille des trames géantes (jumbo), à activer explicitement sur tout le chemin.']],
      answer: 0, why: 'Une trame Ethernet transporte de 46 à 1 500 octets de données. Un paquet IP plus grand doit être découpé, ou passer en jumbo.' },
    { q: 'Un PC branché sur un port Gigabit copie ses fichiers dix fois trop lentement ; tout le reste fonctionne. Que vérifier d\'abord ?',
      choices: [['L\'adresse IP du PC', 'Une mauvaise adresse empêcherait toute communication ; ici tout fonctionne, seulement lentement.'], 'La vitesse négociée du port : un câble abîmé peut la faire tomber à 100 Mb/s', ['Le VLAN du port', 'Un mauvais VLAN isolerait le PC ; il ne le ralentirait pas.']],
      answer: 1, why: 'Dix fois trop lent, c\'est la signature d\'un lien négocié à 100 Mb/s au lieu de 1 Gb/s : on lit la vitesse du port, puis on change le câble.' },
    { q: 'Que veut dire « full duplex » pour un lien 10 GbE ?',
      choices: [['Que le débit est partagé entre les deux sens : 5 Gb/s chacun', 'C\'était le cas des anciens réseaux partagés (half duplex). En full duplex, chaque sens a tout son débit.'], 'Que chaque sens transporte 10 Gb/s en même temps', ['Que le lien est doublé par un câble de secours', 'C\'est de la redondance, pas du duplex.']],
      answer: 1, why: 'Émission et réception ont chacune leur voie : 10 Gb/s dans chaque sens, sans collision.' },
    { q: 'À quoi sert le FCS en fin de trame ?',
      choices: [['À chiffrer la trame', 'Ethernet ne chiffre rien ; le FCS est un simple contrôle.'], ['À numéroter les trames', 'Ethernet ne numérote pas ses trames ; RTP ou TCP le font plus haut.'], 'À détecter une trame abîmée, que le récepteur jette'],
      answer: 2, why: 'Le FCS est un CRC de 32 bits calculé sur la trame : s\'il ne correspond pas à l\'arrivée, la trame est jetée. Les compteurs d\'erreurs FCS d\'un port signalent un câble ou un module défaillant.' },
  ],
};

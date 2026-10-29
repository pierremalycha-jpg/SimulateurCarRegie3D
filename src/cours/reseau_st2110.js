// @ts-check
import { el } from '../util.js';
import { figure, sv, canvas, slider, choice, readout, fmtNum } from './kit.js';
import { FORMATS, ENTETES, video, audio, modele21, emissions, tampon, fusion, surabonnement } from './st2110_calc.js';

// ----------------------------------------------------------------------------------
// Les leçons du car IP (ST 2110) du chapitre Réseau, après Multicast et PTP : les flux séparés (ST 2110-10,
// -20, -30, -40, -22), un paquet couche par couche (RFC 4175, RTP, UDP, IP, Ethernet), le rythme d'envoi
// (ST 2110-21), la redondance rouge et bleue (ST 2022-7), l'architecture spine-leaf, la découverte et la
// connexion NMOS (IS-04, IS-05). Calculs : cours/st2110_calc.js ; vues 3D : vues3d/vues/st2110_*.js.
// Les chiffres sont ceux des normes (SMPTE ST 2110, ST 2022-7, AMWA NMOS) ou des ordres de grandeur, dits.
// ----------------------------------------------------------------------------------
const C = { video: '#ffd38a', audio: '#d08cff', anc: '#7fd1a0', ptp: '#ff8a3a', grey: '#8a949c', red: '#ff6a5a', blue: '#4c9cff', ok: '#7fd1a0' };
const bar = (label, val, max, col, txt) => el('div', { class: 'co-hbar' }, el('span', {}, label), el('i', {}, el('b', { style: { width: Math.min(100, val / max * 100) + '%', background: col } })), el('small', {}, txt));
const gb = (v) => fmtNum(v, v < 10 ? 2 : 1) + ' Gb/s';

// =====================================================================================
// 1. ST 2110 : l'image, le son et les données en flux séparés
// =====================================================================================
function figFlux() {
  const f = figure(440, 190, 'À gauche, un câble SDI porte tout ensemble : image, son, timecode. À droite, en ST 2110, la même source envoie trois flux séparés sur le réseau, chacun vers son groupe multicast, tous horodatés sur la même heure PTP.');
  f.append(sv('text', { x: 10, y: 16, class: 'co-t' }, 'SDI : un câble, tout ensemble'), sv('text', { x: 240, y: 16, class: 'co-t' }, 'ST 2110 : des flux séparés'));
  const seg = (x, w, col, t) => { f.append(sv('rect', { x, y: 40, width: w, height: 26, fill: col, opacity: 0.85 })); if (t) f.append(sv('text', { x: x + w / 2, y: 57, textAnchor: 'middle', class: 'co-s', fill: '#0b1013' }, t)); };
  seg(10, 20, C.audio, 'son'); seg(30, 14, C.anc, ''); seg(44, 150, C.video, 'image'); seg(194, 20, C.audio, '');
  f.append(sv('text', { x: 110, y: 84, textAnchor: 'middle', class: 'co-s' }, 'le son et le timecode dans la suppression'));
  f.append(sv('rect', { x: 60, y: 100, width: 100, height: 40, rx: 4, fill: '#1a2229', stroke: '#59646f' }), sv('text', { x: 110, y: 124, textAnchor: 'middle', class: 'co-t' }, 'Passerelle'));
  f.append(sv('line', { x1: 110, y1: 66, x2: 110, y2: 100, stroke: C.video, strokeWidth: 2 }));
  const lane = (y, col, t, s) => { f.append(sv('line', { x1: 160, y1: 120, x2: 260, y2: y, stroke: col, strokeWidth: 2 })); for (let i = 0; i < 7; i++) f.append(sv('rect', { x: 264 + i * 22, y: y - 6, width: col === C.video ? 18 : 7, height: 12, fill: col })); f.append(sv('text', { x: 266, y: y + 20, class: 'co-s' }, `${t} · ${s}`)); };
  lane(44, C.video, 'ST 2110-20 vidéo', '239.1.1.1'); lane(94, C.audio, 'ST 2110-30 audio', '239.1.2.1'); lane(144, C.anc, 'ST 2110-40 données', '239.1.3.1');
  f.append(sv('text', { x: 220, y: 184, textAnchor: 'middle', class: 'co-s' }, 'Chaque paquet porte l\'heure PTP de son image (horodatage RTP) : le récepteur réaligne.'));
  return f;
}
function demoFlux(host) {
  let fk = '1080p50', canaux = 8, anc = true;
  const want = { mel: { v: true, a: false, d: false }, son: { v: false, a: true, d: false }, evs: { v: true, a: true, d: true } };
  const out = el('div', { class: 'co-hbars' }), read = readout(['Le flux vidéo', 'Le flux audio', 'Le flux de données', 'Le même signal en SDI']);
  const draw = () => {
    const V = video(fk), A = audio(canaux), D = anc ? 0.0005 : 0; // les données annexes : quelques centaines de kb/s au plus (ordre de grandeur)
    const tot = (w) => (w.v ? V.gbpsFil : 0) + (w.a ? A.mbpsFil / 1000 : 0) + (w.d ? D : 0);
    out.replaceChildren(
      bar('Mélangeur', tot(want.mel), 25, C.video, `${gb(tot(want.mel))} sur son lien de 25 Gb/s`),
      bar('Console son', tot(want.son) * 1000, 1000, C.audio, `${fmtNum(tot(want.son) * 1000, 1)} Mb/s sur son lien de 1 Gb/s`),
      bar('Serveur ralenti', tot(want.evs), 25, C.anc, `${gb(tot(want.evs))} sur son lien de 25 Gb/s`));
    read.set('Le flux vidéo', `ST 2110-20 ${FORMATS[fk].nom.split(' ')[0]} : ${fmtNum(V.pps, 0)} paquets/s, ${gb(V.gbpsFil)} sur le fil (${gb(V.utile)} d'image active)`);
    read.set('Le flux audio', `ST 2110-30, ${canaux} canaux L24 48 kHz, paquets de 1 ms : ${fmtNum(A.charge, 0)} octets de son par paquet, ${fmtNum(A.mbpsFil, 2)} Mb/s`);
    read.set('Le flux de données', anc ? 'ST 2110-40 : timecode, sous-titres… quelques paquets par image, de l\'ordre de quelques centaines de kb/s au plus' : 'aucun');
    read.set('Le même signal en SDI', `${FORMATS[fk].sdi} Gb/s sur un câble, suppression comprise, même pour qui ne veut que le son`);
  };
  const who = (k, label) => el('fieldset', { class: 'co-emb-g' }, el('legend', {}, label), ...[['v', 'vidéo'], ['a', 'audio'], ['d', 'données']].map(([e, t]) => { const i = /** @type {HTMLInputElement} */ (el('input', { type: 'checkbox', checked: want[k][e] })); i.addEventListener('change', () => { want[k][e] = i.checked; draw(); }); return el('label', { class: 'co-chk' }, i, t); }));
  host.append(el('div', { class: 'co-ctl' },
    choice('Format', Object.keys(FORMATS).map((k) => [k, FORMATS[k].nom]), fk, (v) => { fk = v; draw(); }),
    choice('Canaux audio', [['2', '2'], ['8', '8'], ['16', '16']], String(canaux), (v) => { canaux = +v; draw(); }),
    choice('Données annexes', [['oui', 'flux -40'], ['non', 'aucun']], 'oui', (v) => { anc = v === 'oui'; draw(); }),
    el('div', { class: 'co-emb' }, who('mel', 'Mélangeur'), who('son', 'Console son'), who('evs', 'Serveur ralenti'))),
  out, read.el);
  draw();
}
/** @type {import('./index.js').Lesson} */
const FLUX = {
  id: 'reseau-st2110', title: 'ST 2110 : l\'image, le son et les données en flux séparés', minutes: '8 min',
  essentials: [
    'En SDI, un câble porte tout ensemble. En **ST 2110**, chaque **essence** voyage dans son propre flux IP : la vidéo (**-20**), l\'audio (**-30**), les données (**-40**), chacun vers son groupe multicast.',
    'Chaque paquet est **horodaté** (RTP) sur l\'heure PTP de son image (**ST 2110-10**) : le récepteur réaligne l\'image et le son, même arrivés par des chemins différents.',
    'Un récepteur ne prend **que ce qu\'il lui faut** : la console son s\'abonne à l\'audio (quelques Mb/s), sans recevoir l\'image (2,2 Gb/s en 1080p50).',
  ],
  figure: figFlux,
  demoTitle: 'Choisis le format, le nombre de canaux, et ce que chaque appareil veut recevoir : compare la charge de son lien au même signal en SDI.',
  demo: demoFlux,
  body: `En SDI, une image et tout ce qui l'accompagne (son embarqué, timecode, métadonnées) partent ensemble, sur un câble, à un débit fixe. Le car IP les **sépare** : chaque **essence** devient un flux IP à part, envoyé en **multicast** vers son propre groupe.

- **ST 2110-20** : la vidéo active **non compressée**, sans la suppression (plus d'EAV, de SAV ni d'HANC). En 1080p50 4:2:2 10 bits : 2,07 Gb/s d'image, de l'ordre de **2,2 Gb/s** sur le fil avec les en-têtes ; 8,9 Gb/s en 2160p50.
- **ST 2110-30** : l'**audio** PCM (24 bits, 48 kHz), le format d'AES67. Des paquets courts, en général d'**1 ms** (48 échantillons par canal), parfois de 125 µs pour gagner en latence : 8 canaux tiennent dans 10 Mb/s.
- **ST 2110-40** : les **données annexes** du SDI (timecode, sous-titres, AFD…), dans leur propre flux, quelques paquets par image.
- **ST 2110-22** : de la vidéo **compressée** à débit constant (JPEG XS par exemple), pour l'UHD ou les liaisons longues.

Séparer, c'est d'abord **ne recevoir que l'utile** : la console son prend les flux audio de toutes les caméras sans voir passer une image ; le multiview prend les images sans le son. C'est aussi traiter chaque essence à part : remplacer le commentaire d'un flux audio sans toucher à l'image.

Reste à **réaligner** ce qui a voyagé séparément. C'est le rôle de **ST 2110-10** : tous les appareils sont calés sur la même heure **PTP** (ST 2059), et chaque paquet porte un **horodatage RTP** qui dit à quelle image il appartient (horloge de 90 kHz pour la vidéo, 48 kHz pour l'audio). Le récepteur range les paquets par horodatage, pas par ordre d'arrivée : l'image et le son restent synchrones, même si l'un a traversé un spine de plus.

Pour s'abonner, un récepteur a besoin de la description de chaque flux, son **SDP** : le groupe, la source, le port, le format. C'est ce que distribue NMOS (leçon suivante).`,
  plus: `- Un flux vidéo 1080p50 compte de l'ordre de **216 000 paquets par seconde** (4 par ligne active, 4 320 par image) : c'est le rythme que mesure l'analyseur du poste Réseau IP.
- Les flux d'une même caméra ont chacun leur groupe et souvent leur VLAN de multicast ; le plan d'adressage les range par source (239.1.1.n vidéo, 239.1.2.n audio…).
- Une **passerelle IP ↔ SDI** fait le pont avec le matériel SDI : elle sépare les essences d'un câble en flux, ou les réunit en un câble.`,
  car: { text: 'Dans le car IP (choisir « car IP » sur la feuille de service), au poste Réseau IP : l\'onglet Flux montre les flux vidéo et audio de chaque caméra, leur groupe, leur SDP et leur chemin sur les réseaux rouge et bleu.', station: 'reseau' },
  terms: ['st2110', 'essence', 'st2110-20', 'st2110-30', 'st2110-40', 'st2110-22', 'rtp', 'passerelle-ip'],
  competences: ['2.11', '3.6', '2.10'], article: 'ipguide',
  quiz: [
    { q: 'Que transporte un flux ST 2110-20 ?',
      choices: [['L\'image, le son et le timecode ensemble, comme le SDI', 'C\'est le principe du SDI. En ST 2110, chaque essence a son propre flux.'], 'La vidéo active seule, non compressée', ['Le son en AES67', 'C\'est le rôle de ST 2110-30.']],
      answer: 1, why: 'ST 2110-20 ne porte que la vidéo active, sans suppression ; le son (-30) et les données (-40) voyagent dans leurs propres flux.' },
    { q: 'La console son veut les micros de six caméras IP. Que reçoit-elle sur son lien ?',
      choices: [['Les six flux vidéo, dont elle extrait le son', 'Ce serait le cas en SDI (le désembeddage). En ST 2110, le son a son propre flux.'], 'Les six flux audio ST 2110-30, de quelques Mb/s chacun', ['Rien : le son ne passe pas par le réseau en ST 2110', 'Le son passe par le réseau, en ST 2110-30.']],
      answer: 1, why: 'Elle s\'abonne aux flux audio seuls : quelques Mb/s chacun, au lieu de 2,2 Gb/s par image.' },
    { q: 'L\'image d\'une caméra traverse deux commutateurs de plus que son son. Comment restent-ils synchrones ?',
      choices: ['Par l\'horodatage RTP de chaque paquet, sur l\'heure PTP commune', ['Par l\'ordre d\'arrivée des paquets', 'C\'est justement ce qui change selon le chemin. Le récepteur range par horodatage.'], ['Ils ne le restent pas : on règle un retard à la console', 'Inutile : l\'horodatage suffit, tant que tous les appareils sont sur la même heure PTP.']],
      answer: 0, why: 'ST 2110-10 : chaque paquet porte l\'heure PTP de son image (horloge RTP à 90 kHz pour la vidéo, 48 kHz pour l\'audio) ; le récepteur réaligne.' },
    { q: 'Un flux ST 2110-20 1080p50 4:2:2 10 bits pèse, sur le fil, de l\'ordre de :',
      choices: [['2,97 Gb/s, comme le 3G-SDI', 'Le 3G-SDI transporte aussi la suppression ; le ST 2110-20 n\'envoie que l\'image active.'], '2,2 Gb/s', ['22 Mb/s', 'Ce serait une vidéo très compressée ; le ST 2110-20 ne l\'est pas.']],
      answer: 1, why: '1 920 × 1 080 × 2,5 octets × 50 = 2,07 Gb/s d\'image active, plus les en-têtes : de l\'ordre de 2,2 Gb/s.' },
    { q: 'Où est passé le timecode qu\'on trouvait dans la suppression du SDI ?',
      choices: [['Il a disparu : PTP le remplace', 'PTP donne l\'heure pour aligner, mais le timecode (et les sous-titres, l\'AFD…) reste transporté pour l\'exploitation.'], ['Dans les pixels de l\'image', 'Il n\'y a plus de suppression dans le flux -20 : les données ont leur propre flux.'], 'Dans un flux de données ST 2110-40'],
      answer: 2, why: 'Les données annexes du SDI (timecode, sous-titres, AFD) voyagent dans un flux ST 2110-40 à part.' },
    { q: 'Pourquoi envoyer l\'audio en paquets de 125 µs plutôt que d\'1 ms ?',
      choices: [['Pour réduire le débit', 'Le débit augmente un peu : huit fois plus de paquets, donc d\'en-têtes, pour le même son.'], 'Pour réduire la latence : chaque paquet attend moins d\'échantillons avant de partir', ['Parce que PTP l\'impose', 'PTP ne fixe pas la durée des paquets ; c\'est un choix de configuration (ST 2110-30).']],
      answer: 1, why: 'Un paquet d\'1 ms attend 48 échantillons avant de partir ; de 125 µs, 6 seulement. Utile pour les retours des commentateurs (N-1), au prix d\'un peu de débit.' },
  ],
};

// =====================================================================================
// 2. Un paquet ST 2110-20, couche par couche
// =====================================================================================
const COUCHES = [
  { k: 'fil', nom: 'Préambule et intervalle', o: ENTETES.fil, col: '#3a4650', txt: 'Sur le fil seulement : 8 octets de préambule avant chaque trame, 12 octets de silence après. Ils comptent dans la charge du lien.' },
  { k: 'eth', nom: 'Ethernet', o: ENTETES.eth, col: '#8a949c', txt: 'Adresses MAC (destination : 01:00:5E + 23 bits du groupe), type IPv4, et 4 octets de contrôle (FCS) en fin de trame.' },
  { k: 'ip', nom: 'IPv4', o: ENTETES.ip, col: '#4cc3e6', txt: 'Adresse source (la caméra), destination (le groupe 239.x), TTL, DSCP (priorité de la vidéo, souvent AF41 ou CS5).' },
  { k: 'udp', nom: 'UDP', o: ENTETES.udp, col: '#7fd1a0', txt: 'Port de destination (le même pour tout le flux) et longueur. Pas d\'accusé de réception : un paquet perdu n\'est pas renvoyé.' },
  { k: 'rtp', nom: 'RTP', o: ENTETES.rtp, col: '#ffb020', txt: 'Numéro de séquence (16 bits), horodatage (horloge 90 kHz, l\'heure PTP de l\'image), identifiant de source (SSRC), bit M sur le dernier paquet de l\'image.' },
  { k: 'rfc', nom: 'En-tête RFC 4175', o: ENTETES.rfc4175, col: '#ff8a80', txt: 'Le numéro de séquence étendu (16 bits de plus), puis, pour la ligne transportée : longueur, numéro de ligne, décalage du premier pixel.' },
  { k: 'pix', nom: 'Pixels', o: 1200, col: '#ffd38a', txt: '1 200 octets : 240 groupes de 5 octets (Cb, Y, Cr, Y sur 10 bits chacun), 480 pixels, le quart d\'une ligne 1080.' },
];
function figPaquet() {
  const f = figure(440, 150, 'Un paquet ST 2110-20 comme des poupées russes : la trame Ethernet contient le paquet IP, qui contient le datagramme UDP, qui contient le paquet RTP, qui contient l\'en-tête RFC 4175 et 1 200 octets de pixels.');
  let x = 10, y = 20, w = 420, h = 116;
  for (const c of COUCHES.slice(1)) {
    f.append(sv('rect', { x, y, width: w, height: h, rx: 4, fill: '#121a20', stroke: c.col }), sv('text', { x: x + 6, y: y + 13, class: 'co-s', fill: c.col }, `${c.nom} · ${c.o} octets`));
    x += 14; y += 18; w -= 28; h -= 22;
  }
  return f;
}
function demoPaquet(host) {
  let fk = '1080p50', charge = 1200, sel = 'rtp';
  const strip = el('div', { class: 'co-strip', role: 'group', 'aria-label': 'Les couches du paquet' });
  const info = el('p', { class: 'co-verdict' });
  const read = readout(['Paquets par ligne', 'Paquets par seconde', 'Débit sur le fil', 'Part utile']);
  const draw = () => {
    const V = video(fk, charge), total = V.fil;
    strip.replaceChildren(...COUCHES.map((c) => { const o = c.k === 'pix' ? charge : c.o; return el('button', { type: 'button', class: 'co-seg-l' + (sel === c.k ? ' on' : ''), style: { flexGrow: String(Math.max(o, 14)), background: c.col }, title: `${c.nom} : ${o} octets`, onclick: () => { sel = c.k; draw(); } }, el('span', {}, c.nom), el('small', {}, `${o} o`)); }));
    const c = COUCHES.find((x) => x.k === sel);
    info.textContent = `${c.nom} : ${c.k === 'pix' ? `${charge} octets : ${charge / 5} groupes de 5 octets, ${charge / 2.5} pixels. ` : ''}${c.txt}`;
    read.set('Paquets par ligne', `${V.parLigne} (une ligne fait ${fmtNum(V.ligne, 0)} octets)`);
    read.set('Paquets par seconde', `${fmtNum(V.pps, 0)} (${fmtNum(V.nPaquetsImage, 0)} par image)`);
    read.set('Débit sur le fil', `${gb(V.gbpsFil)} pour ${gb(V.utile)} d'image (paquet de ${total} octets sur le fil)`);
    read.set('Part utile', `${fmtNum(V.efficacite * 100, 1)} % du lien porte des pixels`);
  };
  host.append(el('div', { class: 'co-ctl' },
    choice('Format', Object.keys(FORMATS).map((k) => [k, FORMATS[k].nom]), fk, (v) => { fk = v; draw(); }),
    choice('Pixels par paquet', [['1200', '1 200 octets (courant)'], ['1440', '1 440 octets (proche du MTU)'], ['600', '600 octets']], String(charge), (v) => { charge = +v; draw(); })),
  strip, info, read.el);
  draw();
}
/** @type {import('./index.js').Lesson} */
const PAQUET = {
  id: 'reseau-paquet', title: 'Un paquet ST 2110-20, couche par couche', minutes: '7 min',
  essentials: [
    'Une ligne d\'image 1080 (4 800 octets) est découpée en **4 paquets** de 1 200 octets de pixels : 4 320 paquets par image, **216 000 par seconde** en 1080p50.',
    'Chaque paquet s\'emboîte comme des **poupées russes** : pixels, en-tête RFC 4175 (ligne, décalage), **RTP** (numéro de séquence, horodatage), UDP (port), IP (groupe), Ethernet.',
    'Les en-têtes coûtent environ **7 %** du lien : 2,07 Gb/s d\'image deviennent 2,2 Gb/s sur le fil ; un paquet ne dépasse pas le **MTU** (1 500 octets) sans trames jumbo.',
  ],
  figure: figPaquet,
  demoTitle: 'Clique chaque couche du paquet ; change le format et la taille des paquets : regarde le nombre de paquets et la part utile du lien.',
  demo: demoPaquet,
  body: `Une image 1080 en 4:2:2 10 bits, c'est 1 080 lignes de 1 920 pixels. Les pixels vont par deux : un Cb, deux Y, un Cr, quatre échantillons de 10 bits, **5 octets pour 2 pixels** (un « pgroup », RFC 4175). Une ligne fait donc 4 800 octets. Le paquet le plus courant en porte **1 200** : 480 pixels, un quart de ligne. Quatre paquets par ligne, 4 320 par image, **216 000 par seconde** en 1080p50.

Autour des pixels, chaque couche ajoute son en-tête, comme une enveloppe dans une enveloppe :
- l'en-tête **RFC 4175** (8 octets) dit quelle ligne et à partir de quel pixel : le récepteur range chaque morceau à sa place ;
- **RTP** (12 octets) numérote les paquets (une perte se voit au trou dans la séquence) et les **horodate** à l'heure PTP de l'image ; le dernier paquet d'une image porte le bit **M** ;
- **UDP** (8 octets) donne le port ; pas de renvoi en cas de perte : en direct, un paquet en retard ne sert plus à rien ;
- **IP** (20 octets) porte la source (la caméra) et la destination, le **groupe multicast** ; son champ DSCP donne la priorité ;
- **Ethernet** (18 octets avec le contrôle de fin) porte les adresses MAC ; sur le fil s'ajoutent encore 20 octets de préambule et de silence.

Le paquet de 1 200 octets de pixels pèse ainsi 1 286 octets sur le fil : **93 %** du lien porte de l'image, d'où les 2,2 Gb/s pour 2,07 d'image active. Des paquets plus gros gaspilleraient moins, mais le **MTU** standard d'Ethernet est de 1 500 octets : au-delà, il faut des trames « jumbo » partout, sinon les paquets sont jetés (une panne du poste Réseau IP).`,
  plus: `- Le **numéro de séquence** RTP fait 16 bits : il reboucle tous les 65 536 paquets, soit trois fois par seconde en 1080p50 ; l'en-tête RFC 4175 l'étend de 16 bits.
- L'analyseur du poste Réseau IP décode chaque couche d'une capture (port miroir) : Ethernet, IPv4/DSCP, UDP, RTP, RFC 4175.
- En UHD 2160p50, la ligne fait 9 600 octets : 8 paquets par ligne, 864 000 paquets par seconde, de l'ordre de 8,9 Gb/s sur le fil.`,
  car: { text: 'Au poste Réseau IP (car IP), onglet Mesures : la capture sur port miroir décode les paquets couche par couche, et l\'analyseur de flux donne les paquets par seconde, les pertes et les trous de séquence.', station: 'reseau' },
  terms: ['st2110-20', 'rtp', 'mtu', 'qos', 'debit', 'pertes'],
  competences: ['3.6', '2.11'], article: 'ipguide',
  quiz: [
    { q: 'Combien de paquets de 1 200 octets de pixels faut-il pour une ligne 1080 en 4:2:2 10 bits ?',
      choices: [['2', 'Une ligne fait 1 920 × 2,5 = 4 800 octets.'], '4', ['1 080', 'C\'est le nombre de lignes d\'une image.']],
      answer: 1, why: '1 920 pixels × 2,5 octets = 4 800 octets, soit 4 paquets de 1 200 octets (480 pixels chacun).' },
    { q: 'À quoi sert le numéro de séquence RTP ?',
      choices: ['À voir qu\'un paquet manque (un trou dans la suite) et à remettre les paquets dans l\'ordre', ['À dater l\'image', 'C\'est le rôle de l\'horodatage RTP, l\'autre champ.'], ['À choisir le groupe multicast', 'Le groupe est l\'adresse IP de destination.']],
      answer: 0, why: 'Chaque paquet est numéroté : un trou dans la séquence est une perte, que l\'analyseur compte ; en ST 2022-7, c\'est aussi ce qui permet de prendre la copie de l\'autre réseau.' },
    { q: 'Que dit l\'en-tête RFC 4175 d\'un paquet ?',
      choices: [['À quelle caméra il appartient', 'C\'est l\'adresse IP source (et le SSRC de RTP).'], 'Quelle ligne il transporte et à partir de quel pixel', ['Sa priorité dans le réseau', 'C\'est le champ DSCP de l\'en-tête IP.']],
      answer: 1, why: 'Numéro de ligne, décalage du premier pixel et longueur : le récepteur range chaque morceau à sa place dans l\'image.' },
    { q: 'Pourquoi un flux de 2,07 Gb/s d\'image active occupe-t-il environ 2,2 Gb/s sur le lien ?',
      choices: [['Parce que le ST 2110-20 transporte aussi la suppression', 'Non : seule l\'image active est envoyée.'], 'À cause des en-têtes et du préambule de chaque paquet (de l\'ordre de 7 %)', ['À cause des renvois de paquets perdus', 'UDP ne renvoie rien.']],
      answer: 1, why: '1 200 octets de pixels font 1 286 octets sur le fil : RFC 4175, RTP, UDP, IP, Ethernet, préambule et intervalle.' },
    { q: 'Un émetteur est réglé pour des paquets de 1 800 octets, les commutateurs restent au MTU de 1 500. Que se passe-t-il ?',
      choices: [['Rien, le commutateur découpe les paquets', 'Un commutateur ne découpe pas une trame trop grande : il la jette.'], 'Les paquets sont jetés : il faut des trames jumbo partout, ou des paquets plus petits', ['Le débit baisse un peu', 'Ce n\'est pas une question de débit : les trames trop grandes ne passent pas.']],
      answer: 1, why: 'Au-delà du MTU, la trame est jetée. Les trames jumbo (jusqu\'à 9 000 octets environ) doivent être réglées sur tous les ports du chemin.' },
    { q: 'Le dernier paquet d\'une image porte un bit particulier. Lequel, et pourquoi ?',
      choices: ['Le bit M (marker) de RTP : le récepteur sait que l\'image est complète', ['Le bit DF d\'IP, pour ne pas être fragmenté', 'Ce bit existe, mais il ne marque pas la fin d\'une image.'], ['Le FCS d\'Ethernet', 'Le FCS est un contrôle d\'erreur, présent dans chaque trame.']],
      answer: 0, why: 'Le bit M de RTP marque la fin de l\'image (ou de la trame en entrelacé).' },
  ],
};

// =====================================================================================
// 3. Le rythme d'envoi : ST 2110-21
// =====================================================================================
function figRythme() {
  const f = figure(440, 160, 'Trois façons d\'envoyer les paquets d\'une image : régulièrement sur toute l\'image (linéaire), régulièrement pendant les lignes actives avec un trou pendant la suppression (espacé), ou par petites rafales (large). Dessous, le remplissage du tampon du récepteur.');
  const row = (y, t, xs, col) => { f.append(sv('text', { x: 10, y: y + 4, class: 'co-s' }, t)); for (const x of xs) f.append(sv('rect', { x: 120 + x * 300, y: y - 7, width: 2.5, height: 14, fill: col })); f.append(sv('line', { x1: 120, y1: y + 9, x2: 420, y2: y + 9, stroke: '#2a3238' })); };
  row(30, 'linéaire (NL)', Array.from({ length: 60 }, (_, i) => i / 60), C.ok);
  row(64, 'espacé (N)', Array.from({ length: 60 }, (_, i) => i / 60 * 0.9), C.video);
  row(98, 'large (W)', Array.from({ length: 60 }, (_, i) => Math.floor(i / 10) * 10 / 60 * 0.9 + (i % 10) * 0.003), C.audio);
  f.append(sv('rect', { x: 120 + 0.9 * 300, y: 18, width: 30, height: 90, fill: 'rgba(255,255,255,.04)' }), sv('text', { x: 405, y: 122, textAnchor: 'middle', class: 'co-s' }, 'suppression'));
  f.append(sv('text', { x: 270, y: 150, textAnchor: 'middle', class: 'co-s' }, 'une image (20 ms en 1080p50) → plus les rafales sont grosses, plus le récepteur doit stocker'));
  return f;
}
function demoRythme(host) {
  let type = 'N', fk = '1080p50';
  const W = 640, H = 210, cv = canvas(W, H, 'co-canvas co-smooth'), g = /** @type {CanvasRenderingContext2D} */ (cv.getContext('2d'));
  const read = readout(['Modèle de l\'émetteur', 'Tampon nécessaire (mesuré)', 'Limite du récepteur étroit', 'Verdict']);
  const draw = () => {
    const M = modele21(fk, type === 'W' ? 'W' : 'N'), MN = modele21(fk, 'N'), n = 600; // 600 paquets dessinés, à l'échelle de l'image
    const e = emissions(type, n, M.ractive), T = tampon(e, n, M.ractive);
    const scale = M.npackets / n, maxReel = Math.round(T.max * scale);
    g.fillStyle = '#0b1013'; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(255,255,255,.04)'; g.fillRect(20 + M.ractive * (W - 40), 10, (1 - M.ractive) * (W - 40), H - 20);
    g.fillStyle = '#aab4ba'; g.font = '11px Arial, sans-serif'; g.fillText('départs des paquets (une image)', 20, 18); g.fillText('remplissage du tampon du récepteur', 20, 92);
    g.fillStyle = type === 'rafale' ? C.red : C.video;
    for (const t of e) g.fillRect(20 + t * (W - 40), 26, 1.2, 40);
    const vmax = Math.max(4, ...T.pts);
    g.strokeStyle = C.ok; g.lineWidth = 2; g.beginPath();
    T.pts.forEach((v, i) => { const x = 20 + i / (T.pts.length - 1) * (W - 40), y = H - 16 - v / vmax * (H - 116); if (i) g.lineTo(x, y); else g.moveTo(x, y); });
    g.stroke(); g.lineWidth = 1;
    const lim = MN.vrx / scale, yl = H - 16 - lim / vmax * (H - 116);
    if (yl > 96) { g.strokeStyle = C.red; g.setLineDash([4, 3]); g.beginPath(); g.moveTo(20, yl); g.lineTo(W - 20, yl); g.stroke(); g.setLineDash([]); g.fillStyle = C.red; g.fillText(`VRX_FULL d'un récepteur étroit : ${MN.vrx} paquets`, W - 230, yl - 4); }
    read.set('Modèle de l\'émetteur', type === 'rafale' ? 'aucun : l\'image part en quelques lignes (non conforme)' : `type ${type} : CMAX ${M.cmax}, VRX_FULL ${M.vrx} paquets`);
    read.set('Tampon nécessaire (mesuré)', `${fmtNum(maxReel, 0)} paquets au plus dans le tampon`);
    read.set('Limite du récepteur étroit', `${MN.vrx} paquets (VRX_FULL, type N, ${fk})`);
    read.set('Verdict', maxReel <= MN.vrx ? 'un récepteur étroit suit sans perte' : type === 'W' ? 'il faut un récepteur large (tampon de plusieurs centaines de paquets)' : 'tampon débordé : pertes de paquets chez tout récepteur conforme');
  };
  host.append(el('div', { class: 'co-ctl' },
    choice('Émetteur', [['NL', 'linéaire (NL)'], ['N', 'espacé (N)'], ['W', 'large (W)'], ['rafale', 'rafale (non conforme)']], type, (v) => { type = v; draw(); }),
    choice('Format', [['1080i25', '1080i25'], ['1080p50', '1080p50'], ['2160p50', '2160p50']], fk, (v) => { fk = v; draw(); })),
  cv, read.el);
  draw();
}
/** @type {import('./index.js').Lesson} */
const RYTHME = {
  id: 'reseau-rythme', title: 'Le rythme d\'envoi : ST 2110-21', minutes: '7 min',
  essentials: [
    'Un émetteur ST 2110 doit **répartir** ses paquets dans le temps : envoyés en rafales, ils remplissent les files des commutateurs et le **tampon** du récepteur, jusqu\'aux pertes.',
    '**ST 2110-21** définit des émetteurs **étroits** (N : réguliers, petit tampon) et **larges** (W : par rafales, gros tampon), et deux mesures : **CMAX** (avance tolérée) et **VRX_FULL** (tampon du récepteur).',
    'En 1080p50, un récepteur étroit n\'a besoin que d\'un tampon de **8 paquets** ; un émetteur large peut en demander **720**. Un émetteur étroit passe partout.',
  ],
  figure: figRythme,
  demoTitle: 'Choisis le type d\'émetteur et regarde les départs des paquets puis le remplissage du tampon du récepteur.',
  demo: demoRythme,
  body: `Une image 1080p50, ce sont 4 320 paquets toutes les 20 ms. Un émetteur pourrait les envoyer **d'un bloc**, à la vitesse de son lien (25 Gb/s), puis se taire : en moyenne, le débit serait le même. Mais à chaque image, des milliers de paquets arriveraient d'un coup dans les commutateurs et chez le récepteur, qui lit l'image ligne après ligne, à son rythme. Il faudrait des tampons énormes, et la moindre file pleine perdrait des paquets.

**ST 2110-21** impose donc un **rythme**. Le modèle est celui d'un émetteur parfaitement régulier : un paquet tous les 20 ms ÷ 4 320, pendant les lignes actives.
- Un émetteur **étroit**, type **N** (narrow), s'y tient presque exactement : il peut envoyer ses paquets pendant les lignes actives et se taire pendant la suppression (mode espacé, « gapped »), ou les étaler sur toute l'image (**NL**, linéaire).
- Un émetteur **large**, type **W** (wide), envoie par petites rafales : plus simple à fabriquer (un logiciel sur un serveur), mais il faut en face un récepteur large.

Deux mesures disent si un émetteur respecte son type :
- **CINST**, le nombre de paquets arrivés **en avance** sur le rythme parfait, ne doit pas dépasser **CMAX** : quelques paquets pour un émetteur étroit (5 en 1080p50), 16 pour un large ;
- **VRX**, le remplissage d'un **récepteur virtuel** qui lit au rythme de l'image, ne doit pas dépasser **VRX_FULL** : 8 paquets pour un étroit en 1080p50, 720 pour un large.

Un récepteur étroit ne garantit rien face à un émetteur large : ses tampons débordent, et des paquets manquent à l'image. Le **type** de chaque émetteur figure dans son SDP (\`TP=2110TPN\`, \`TPNL\` ou \`TPW\`) ; l'analyseur du poste Réseau IP mesure CINST et VRX.`,
  plus: `- Les commutateurs ajoutent leur propre irrégularité : plusieurs flux qui convergent vers un même port forment des micro-rafales. Une charge de lien raisonnable (moins de 80 à 90 %) laisse de la marge.
- En UHD, CMAX et VRX_FULL grandissent avec le nombre de paquets (20 et 32 pour un étroit en 2160p50, d'après le modèle).
- Le mode espacé suit l'ancienne logique du SDI (rien pendant la suppression) ; le linéaire est plus doux pour les commutateurs.`,
  car: { text: 'Au poste Réseau IP (car IP), onglet Mesures → analyseur de flux : CINST / CMAX et VRX / VRX_FULL de chaque flux vidéo, avec leur historique sur 60 s. Une liaison saturée fait monter CINST au-delà de CMAX.', station: 'reseau' },
  terms: ['st2110-21', 'cmax', 'vrx', 'sdp', 'charge', 'pertes'],
  competences: ['2.2', '3.6', '2.11'], article: 'ipguide',
  quiz: [
    { q: 'Pourquoi un émetteur ST 2110 ne doit-il pas envoyer une image entière d\'un seul bloc ?',
      choices: [['Parce que le débit moyen serait trop élevé', 'Le débit moyen est le même ; c\'est la rafale qui pose problème.'], 'Parce que les rafales remplissent les files des commutateurs et le tampon du récepteur, jusqu\'aux pertes', ['Parce que PTP l\'interdit', 'PTP donne l\'heure ; le rythme est l\'affaire de ST 2110-21.']],
      answer: 1, why: 'Le récepteur lit au rythme de l\'image : tout ce qui arrive en avance doit attendre en mémoire. Trop d\'avance, et les tampons débordent.' },
    { q: 'Que mesure CINST, comparé à CMAX ?',
      choices: ['Le nombre de paquets arrivés en avance sur un rythme parfaitement régulier', ['Le nombre de paquets perdus par seconde', 'Les pertes se comptent à part, par les trous dans la séquence RTP.'], ['Le temps de traversée du réseau', 'C\'est la latence.']],
      answer: 0, why: 'CINST compte l\'avance prise sur le modèle régulier ; CMAX est l\'avance tolérée pour le type d\'émetteur.' },
    { q: 'Un récepteur étroit (type N) reçoit un émetteur large (type W). Que risque-t-on ?',
      choices: [['Rien, le type ne concerne que l\'émetteur', 'Le type de l\'émetteur dit quel tampon il faut en face.'], 'Des pertes : ses rafales dépassent le petit tampon du récepteur', ['Une image retardée, mais complète', 'Un tampon trop petit ne retarde pas : il déborde et perd des paquets.']],
      answer: 1, why: 'En 1080p50, un récepteur étroit tient 8 paquets d\'avance ; un émetteur large peut en demander 720.' },
    { q: 'Où lit-on le type d\'un émetteur ST 2110-21 ?',
      choices: [['Sur l\'étiquette de l\'appareil', 'Il dépend de la configuration, pas seulement du matériel.'], 'Dans son SDP (TP=2110TPN, TPNL ou TPW)', ['Dans l\'en-tête Ethernet de chaque paquet', 'Les paquets ne le portent pas.']],
      answer: 1, why: 'Le SDP décrit le flux, type d\'émetteur compris ; le contrôleur et le récepteur peuvent s\'en servir.' },
    { q: 'Un émetteur « espacé » (gapped)…',
      choices: [['envoie ses paquets par grosses rafales', 'C\'est un émetteur large ou non conforme.'], 'envoie régulièrement pendant les lignes actives et se tait pendant la suppression', ['envoie un paquet sur deux', 'Il envoie tous ses paquets, simplement pas pendant la suppression.']],
      answer: 1, why: 'Il suit la logique du SDI : rien pendant la suppression verticale. Le linéaire (NL) étale au contraire les paquets sur toute l\'image.' },
    { q: 'À l\'analyseur, CINST d\'une caméra dépasse CMAX depuis que le multiview reçoit douze flux sur le même lien. Cause probable ?',
      choices: ['Le lien est trop chargé : les flux qui convergent forment des micro-rafales', ['La caméra est devenue un émetteur large', 'Le type d\'un émetteur ne change pas tout seul ; c\'est le réseau qui a déformé son rythme.'], ['Le PTP est perdu', 'Une perte de PTP se voit à l\'offset, pas à CINST.']],
      answer: 0, why: 'Plusieurs flux qui convergent vers un port se gênent : les paquets attendent puis repartent groupés. On garde de la marge de charge sur chaque lien.' },
  ],
};

// =====================================================================================
// 4. Rouge et bleu : ST 2022-7
// =====================================================================================
function fig2022() {
  const f = figure(440, 150, 'Une caméra envoie chaque paquet deux fois, par le réseau rouge et par le réseau bleu. Le récepteur garde, numéro par numéro, la première copie qui arrive : un paquet perdu d\'un côté est pris de l\'autre.');
  f.append(sv('rect', { x: 10, y: 55, width: 70, height: 40, rx: 4, fill: '#1a2229', stroke: '#59646f' }), sv('text', { x: 45, y: 79, textAnchor: 'middle', class: 'co-t' }, 'Caméra'));
  f.append(sv('rect', { x: 360, y: 55, width: 70, height: 40, rx: 4, fill: '#1a2229', stroke: '#59646f' }), sv('text', { x: 395, y: 79, textAnchor: 'middle', class: 'co-t' }, 'Récepteur'));
  for (const [y, col, t] of /** @type {[number, string, string][]} */ ([[30, C.red, 'réseau rouge (A)'], [120, C.blue, 'réseau bleu (B)']])) {
    f.append(sv('path', { d: `M80 75 C 140 75, 140 ${y}, 200 ${y} L 240 ${y} C 300 ${y}, 300 75, 360 75`, fill: 'none', stroke: col, strokeWidth: 2.5 }), sv('text', { x: 220, y: y - 6, textAnchor: 'middle', class: 'co-s', fill: col }, t));
    for (let i = 0; i < 5; i++) f.append(sv('rect', { x: 160 + i * 22, y: y - 5, width: 14, height: 10, fill: i === 2 && col === C.red ? 'none' : col, stroke: col }));
  }
  f.append(sv('text', { x: 220, y: 80, textAnchor: 'middle', class: 'co-s' }, 'le paquet n° 3 perdu en rouge est pris en bleu'));
  return f;
}
function demo2022(host) {
  let pr = 0.02, pb = 0.0, ecart = 0.3, coupe = '';
  const W = 640, H = 110, cv = canvas(W, H, 'co-canvas co-smooth'), g = /** @type {CanvasRenderingContext2D} */ (cv.getContext('2d'));
  const read = readout(['Réseau rouge', 'Réseau bleu', 'Après fusion (sur 100 000 paquets)', 'Tampon du récepteur']);
  const draw = () => {
    const r = coupe === 'rouge' || coupe === 'deux' ? 1 : pr, b = coupe === 'bleu' || coupe === 'deux' ? 1 : pb;
    const F = fusion(r, b, 100000, mulberry(7));
    g.fillStyle = '#0b1013'; g.fillRect(0, 0, W, H);
    const rnd = mulberry(3), N = 40;
    for (let i = 0; i < N; i++) {
      const lr = rnd() < r, lb = rnd() < b, x = 20 + i * 15;
      g.fillStyle = lr ? '#2a1a1a' : C.red; g.fillRect(x, 14, 11, 20);
      g.fillStyle = lb ? '#1a1f2a' : C.blue; g.fillRect(x, 44, 11, 20);
      g.fillStyle = lr && lb ? '#ff2a2a' : lr || lb ? '#ffd38a' : C.ok; g.fillRect(x, 78, 11, 20);
    }
    g.fillStyle = '#aab4ba'; g.font = '11px Arial, sans-serif'; g.fillText('rouge', W - 50, 28); g.fillText('bleu', W - 50, 58); g.fillText('reçu', W - 50, 92);
    read.set('Réseau rouge', r >= 1 ? 'coupé' : `${fmtNum(r * 100, 1)} % de pertes`);
    read.set('Réseau bleu', b >= 1 ? 'coupé' : `${fmtNum(b * 100, 1)} % de pertes`);
    read.set('Après fusion (sur 100 000 paquets)', `${fmtNum(F.repares, 0)} réparés par l'autre réseau · ${fmtNum(F.perdus, 0)} perdus (les deux copies manquaient)`);
    read.set('Tampon du récepteur', `écart rouge / bleu de ${fmtNum(ecart, 1)} ms : il doit garder au moins ${fmtNum(ecart, 1)} ms de paquets (${fmtNum(ecart * 216, 0)} en 1080p50) pour attendre la copie en retard`);
  };
  host.append(el('div', { class: 'co-ctl' },
    slider('Pertes sur le rouge', 0, 10, pr * 100, 0.5, (v) => { pr = v / 100; draw(); }, (v) => fmtNum(v, 1) + ' %'),
    slider('Pertes sur le bleu', 0, 10, pb * 100, 0.5, (v) => { pb = v / 100; draw(); }, (v) => fmtNum(v, 1) + ' %'),
    slider('Écart rouge / bleu', 0, 10, ecart, 0.1, (v) => { ecart = v; draw(); }, (v) => fmtNum(v, 1) + ' ms'),
    choice('Coupure', [['', 'aucune'], ['rouge', 'spine rouge coupée'], ['bleu', 'réseau bleu coupé'], ['deux', 'les deux']], coupe, (v) => { coupe = v; draw(); })),
  cv, read.el);
  draw();
}
/** petit générateur pseudo-aléatoire (tirages identiques d'un dessin à l'autre) */
function mulberry(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/** @type {import('./index.js').Lesson} */
const ROUGE_BLEU = {
  id: 'reseau-2022-7', title: 'Rouge et bleu : la redondance ST 2022-7', minutes: '7 min',
  essentials: [
    'Le car IP a **deux réseaux** identiques et indépendants, **rouge** (A) et **bleu** (B) : chaque appareil a deux cartes, et chaque flux part **deux fois**.',
    'Le récepteur garde, **paquet par paquet** (même numéro de séquence), la première copie qui arrive : une perte d\'un côté est réparée par l\'autre, **sans coupure** ni commutation.',
    'Il faut un tampon au moins égal à l\'**écart** d\'arrivée entre les deux réseaux ; on ne perd un paquet que si les deux copies manquent.',
  ],
  figure: fig2022,
  demoTitle: 'Règle les pertes de chaque réseau, coupe une spine, puis les deux : compte les paquets réparés et perdus.',
  demo: demo2022,
  body: `En SDI, un câble coupé, c'est une image perdue jusqu'à ce qu'on bascule sur un secours. Le car IP double tout : deux **fabrics** spine-leaf séparées, la **rouge** (A) et la **bleue** (B), sans aucun lien entre elles, alimentées et câblées à part. Chaque appareil a une carte sur chacune (adresses 10.1.x.y et 10.2.x.y, même fin d'adresse dans le car du simulateur).

L'émetteur envoie **chaque paquet deux fois**, identiques (même numéro de séquence RTP, même horodatage), un par réseau, chacun vers son groupe. Le SDP le dit par la ligne \`a=group:DUP\` : deux descriptions de média, une par réseau.

Le récepteur s'abonne aux deux flux et les **fusionne** (ST 2022-7, « commutation sans à-coup ») : pour chaque numéro de séquence, il garde la première copie arrivée et jette l'autre. Un paquet perdu sur le rouge est pris sur le bleu ; un réseau entier peut tomber sans qu'un seul pixel manque. Ce n'est pas une bascule : il n'y a rien à détecter, les deux chemins travaillent tout le temps.

Deux limites :
- le récepteur doit **attendre** la copie la plus lente : son tampon couvre l'**écart rouge / bleu** (de l'ordre de quelques centaines de microsecondes dans un car ; ST 2022-7 classe les récepteurs selon l'écart qu'ils tolèrent) ;
- on ne perd un paquet que si **les deux copies** manquent ; avec 1 % de pertes indépendantes de chaque côté, il en reste une sur 10 000. Mais une panne commune aux deux (un émetteur, une mauvaise configuration copiée des deux côtés, une perte de PTP) n'est pas couverte.`,
  plus: `- Au poste Réseau IP, la mesure « Écart rouge / bleu » et les compteurs « paquets réparés / perdus » viennent de l'analyseur de flux.
- Les pannes « spine rouge coupée » ou « grand maître perdu » du simulateur montrent ce que couvre la redondance, et ce qu'elle ne couvre pas.
- Le contrôle (NMOS) passe par un troisième réseau, à part : il n'est pas doublé de la même façon.`,
  car: { text: 'Au poste Réseau IP (car IP) : la topologie montre les fabrics rouge et bleue ; l\'onglet Flux montre le chemin de chaque réception sur les deux réseaux, et Mesures l\'écart et les paquets réparés. Coupe une spine rouge : aucune image ne bouge.', station: 'reseau' },
  terms: ['reseaux-ab', 'st2022-7', 'ecart', 'sdp', 'pertes', 'rtp'],
  competences: ['3.12', '3.6', '2.11'], article: 'ipguide',
  quiz: [
    { q: 'Le réseau rouge perd une spine en plein direct. Que voit-on à l\'antenne ?',
      choices: [['Une image noire le temps de basculer sur le bleu', 'Il n\'y a pas de bascule : les deux réseaux travaillent en permanence.'], 'Rien : chaque paquet manquant en rouge est pris sur le bleu', ['Une image dégradée, en définition réduite', 'Le bleu porte le flux complet, pas une version réduite.']],
      answer: 1, why: 'ST 2022-7 : le récepteur reçoit les deux copies et garde, paquet par paquet, celle qui arrive. Un réseau peut tomber entier.' },
    { q: 'Comment le récepteur sait-il que deux paquets, l\'un rouge, l\'autre bleu, sont le même ?',
      choices: ['Ils ont le même numéro de séquence RTP (et le même horodatage)', ['Ils ont la même adresse IP source', 'Les adresses diffèrent : une carte par réseau.'], ['Ils arrivent en même temps', 'Ils n\'arrivent justement pas en même temps : il y a un écart.']],
      answer: 0, why: 'L\'émetteur envoie deux copies identiques ; le numéro de séquence permet de les apparier.' },
    { q: 'Avec 1 % de pertes indépendantes sur chaque réseau, quelle part des paquets manque après fusion ?',
      choices: [['2 %', 'Les pertes ne s\'additionnent pas : un paquet manque seulement si ses deux copies manquent.'], ['1 %', 'Le second réseau répare presque toutes les pertes du premier.'], 'Environ 0,01 % (une sur 10 000)'],
      answer: 2, why: '1 % × 1 % = 0,01 %, si les pertes sont indépendantes.' },
    { q: 'L\'écart rouge / bleu d\'un flux dépasse ce que tolère un récepteur. Que se passe-t-il ?',
      choices: [['Rien, il prend toujours la première copie', 'Il doit garder les paquets assez longtemps pour attendre la copie lente ; au-delà, il ne peut plus fusionner.'], 'Il ne peut plus attendre la copie en retard : la protection ne fonctionne plus pour ce flux', ['Il coupe le réseau le plus lent', 'Un récepteur ne coupe pas un réseau.']],
      answer: 1, why: 'Le tampon doit couvrir l\'écart : au-delà, une perte sur le réseau rapide ne peut plus être réparée par le lent.' },
    { q: 'Quelle panne la redondance rouge / bleu ne couvre-t-elle pas ?',
      choices: [['Une spine rouge coupée', 'C\'est exactement ce qu\'elle couvre.'], ['Une fibre bleue débranchée', 'Le rouge continue de porter le flux.'], 'Une caméra qui n\'émet plus, ou un réglage faux recopié sur les deux réseaux'],
      answer: 2, why: 'Les deux copies viennent du même émetteur : s\'il tombe, ou si l\'erreur est commune aux deux réseaux, les deux copies manquent.' },
    { q: 'Dans le SDP d\'un flux redondant, qu\'indique la ligne a=group:DUP ?',
      choices: ['Que les deux descriptions de média qui suivent sont le même flux, un par réseau', ['Que le flux est compressé', 'La compression se lit dans le format (ST 2110-22, JPEG XS).'], ['Que le récepteur doit dupliquer le flux', 'C\'est l\'émetteur qui duplique ; le récepteur fusionne.']],
      answer: 0, why: 'DUP : duplication. Le SDP décrit les deux copies (groupe, source, port de chaque réseau).' },
  ],
};

// =====================================================================================
// 5. Spine-leaf
// =====================================================================================
function figSpine() {
  const f = figure(440, 170, 'Une architecture spine-leaf : en haut deux spines, en bas quatre leaves ; chaque leaf est reliée à chaque spine. Les appareils se branchent sur les leaves. Deux appareils sont toujours à deux sauts de commutateur au plus.');
  const sp = [150, 290], lf = [60, 170, 280, 390];
  for (const x of sp) for (const y of lf) f.append(sv('line', { x1: x, y1: 40, x2: y, y2: 110, stroke: '#4c9cff', strokeWidth: 1.6 }));
  for (const x of sp) f.append(sv('rect', { x: x - 40, y: 22, width: 80, height: 22, rx: 3, fill: '#1a2229', stroke: '#4c9cff' }), sv('text', { x, y: 37, textAnchor: 'middle', class: 'co-s' }, 'spine 32 × 100G'));
  for (const x of lf) { f.append(sv('rect', { x: x - 42, y: 108, width: 84, height: 22, rx: 3, fill: '#1a2229', stroke: '#7fd1a0' }), sv('text', { x, y: 123, textAnchor: 'middle', class: 'co-s' }, 'leaf 48 × 25G')); for (let i = -2; i <= 2; i++) f.append(sv('line', { x1: x + i * 12, y1: 130, x2: x + i * 12, y2: 146, stroke: '#8a949c' })); }
  f.append(sv('text', { x: 220, y: 164, textAnchor: 'middle', class: 'co-s' }, 'caméras, CCU, serveurs, multiview… sur les leaves ; chaque flux : leaf → spine → leaf'));
  return f;
}
function demoSpine(host) {
  let ports = 48, vp = 25, up = 4, vu = 100, flux = 20;
  const read = readout(['Vers les appareils', 'Vers les spines', 'Surabonnement', 'Flux 1080p50 qui quittent la leaf']);
  const out = el('div', { class: 'co-hbars' });
  const draw = () => {
    const R = surabonnement(ports, vp, up, vu), V = video('1080p50'), sortie = flux * V.gbpsFil;
    read.set('Vers les appareils', `${ports} ports × ${vp} Gb/s = ${fmtNum(R.bas, 0)} Gb/s`);
    read.set('Vers les spines', `${up} liens × ${vu} Gb/s = ${fmtNum(R.haut, 0)} Gb/s`);
    read.set('Surabonnement', R.ratio <= 1 ? `${fmtNum(R.ratio, 2)} : 1 · non bloquant` : `${fmtNum(R.ratio, 2)} : 1 · si tous les appareils envoient vers d'autres leaves, ça ne passe pas`);
    read.set('Flux 1080p50 qui quittent la leaf', `${flux} flux × ${gb(V.gbpsFil)} = ${gb(sortie)}, répartis sur ${up} liens montants (ECMP)`);
    out.replaceChildren(...Array.from({ length: up }, (_, i) => { const v = sortie / up; return bar(`lien montant ${i + 1}`, v, vu, v > vu * 0.9 ? C.red : v > vu * 0.7 ? C.video : C.ok, `${gb(v)} sur ${vu}`); }));
  };
  host.append(el('div', { class: 'co-ctl' },
    slider('Ports vers les appareils', 8, 64, ports, 8, (v) => { ports = v; draw(); }, (v) => String(v)),
    choice('Vitesse des ports', [['10', '10G'], ['25', '25G'], ['100', '100G']], String(vp), (v) => { vp = +v; draw(); }),
    slider('Liens vers les spines', 1, 8, up, 1, (v) => { up = v; draw(); }, (v) => String(v)),
    choice('Vitesse des liens montants', [['40', '40G'], ['100', '100G'], ['400', '400G']], String(vu), (v) => { vu = +v; draw(); }),
    slider('Flux vidéo sortants', 0, 160, flux, 4, (v) => { flux = v; draw(); }, (v) => String(v))),
  out, read.el);
  draw();
}
/** @type {import('./index.js').Lesson} */
const SPINE = {
  id: 'reseau-spine-leaf', title: 'Spine-leaf : l\'architecture du réseau média', minutes: '7 min',
  essentials: [
    'Les appareils se branchent sur des **leaves** (commutateurs de haut de baie) ; chaque leaf est reliée à **chaque spine** (commutateurs centraux) : deux appareils sont à **deux sauts** au plus.',
    'Entre leaves, le trafic se répartit sur tous les chemins égaux (**ECMP**) ; le routage (OSPF) et le multicast (PIM) passent par les spines.',
    'On dimensionne les liens montants : si les appareils d\'une leaf peuvent envoyer plus que ses liens vers les spines, elle est **surabonnée** et des flux sont refusés.',
  ],
  figure: figSpine,
  demoTitle: 'Règle les ports d\'une leaf et ses liens vers les spines, puis le nombre de flux qui la quittent : lis le surabonnement et la charge de chaque lien.',
  demo: demoSpine,
  body: `Un car IP, c'est des centaines de flux de plusieurs Gb/s qui vont d'un bout à l'autre. Un seul gros commutateur serait un point de panne unique ; une chaîne de commutateurs, un embouteillage. On utilise une architecture **spine-leaf** :
- les **leaves** sont au plus près du matériel, en haut de chaque baie (« top of rack ») : dans le car du simulateur, 48 ports à 25 GbE vers les appareils et 8 à 100 GbE vers le haut ;
- les **spines** ne relient que des leaves (32 ports à 100 GbE) ;
- **chaque leaf est reliée à chaque spine**. D'un appareil à n'importe quel autre : leaf, spine, leaf, jamais plus.

Chaque leaf est aussi un **routeur** : elle a un sous-réseau par VLAN (sa SVI est la passerelle de ses appareils), et les leaves apprennent les routes des autres par **OSPF**. Plusieurs chemins aussi bons (un par spine) : **ECMP** répartit le trafic entre eux, flux par flux. Le multicast suit : **PIM** fait remonter les abonnements jusqu'à la leaf de la source, à travers une spine.

**Dimensionner.** 48 ports à 25 Gb/s, c'est 1 200 Gb/s possibles vers les appareils ; 8 liens à 100 Gb/s, 800 vers les spines. Le rapport (1,5 : 1) est le **surabonnement** : si tous les appareils d'une leaf envoyaient vers d'autres leaves en même temps, ça ne passerait pas. En broadcast, on vise souvent le **non bloquant** (1 : 1), ou l'on vérifie que les flux qui quittent vraiment chaque leaf tiennent dans ses liens montants. Un contrôleur **SDN** peut tenir ce compte et refuser une connexion qui saturerait un lien (« refus SDN » du poste Réseau IP).

Le car double tout : une fabric spine-leaf **rouge** et une **bleue**, identiques et séparées (ST 2022-7).`,
  plus: `- ECMP répartit par flux (adresse source, destination, ports), pas par paquet : un flux de 9 Gb/s ne se coupe pas en deux, et deux gros flux peuvent tomber sur la même spine.
- En multicast, le chemin dépend de l'arbre construit par PIM ; un contrôleur SDN choisit lui-même les chemins pour équilibrer les spines.
- Le réseau de contrôle (NMOS, réglages) reste un réseau à part, plus modeste.`,
  car: { text: 'Au poste Réseau IP (car IP) : la topologie montre les deux fabrics (2 spines et 6 leaves par réseau) et la charge de chaque lien ; `show ip route` et `show ip ospf neighbor` dans le terminal d\'une leaf, `show ip mroute` pour le multicast.', station: 'reseau' },
  terms: ['spine-leaf', 'leaf', 'spine', 'ecmp', 'ospf', 'pim', 'charge'],
  competences: ['3.6', '1.1', '2.10'], article: 'ipguide',
  quiz: [
    { q: 'Dans une architecture spine-leaf, combien de commutateurs traverse au plus un flux entre deux appareils de leaves différentes ?',
      choices: [['Un', 'Seulement si les deux appareils sont sur la même leaf.'], 'Trois : leaf, spine, leaf', ['Autant qu\'il y a de leaves', 'Chaque leaf est reliée à chaque spine : le chemin est toujours court.']],
      answer: 1, why: 'Leaf de départ, une spine, leaf d\'arrivée : le chemin est court et prévisible.' },
    { q: 'Que fait ECMP ?',
      choices: [['Il double chaque paquet sur deux chemins', 'C\'est ST 2022-7, sur deux réseaux.'], 'Il répartit les flux entre plusieurs chemins aussi bons (un par spine)', ['Il choisit toujours la spine la moins chargée, paquet par paquet', 'La répartition se fait par flux, pas par paquet, et sans mesurer la charge.']],
      answer: 1, why: 'Equal-cost multipath : plusieurs routes de même coût, le trafic partagé flux par flux.' },
    { q: 'Une leaf a 48 ports à 25 Gb/s et 8 liens à 100 Gb/s vers les spines. Son surabonnement est de :',
      choices: [['1 : 1', 'Il faudrait 1 200 Gb/s vers le haut.'], '1,5 : 1', ['6 : 1', 'Ce serait un seul lien à 200 Gb/s vers le haut.']],
      answer: 1, why: '48 × 25 = 1 200 Gb/s vers les appareils, 8 × 100 = 800 vers les spines : 1,5 : 1.' },
    { q: 'Pourquoi chaque leaf est-elle aussi un routeur ?',
      choices: ['Elle est la passerelle de ses appareils (une SVI par VLAN) et route vers les autres leaves (OSPF, PIM)', ['Pour remplacer les spines', 'Les spines restent le cœur du réseau.'], ['Pour faire la conversion SDI', 'C\'est le rôle des passerelles IP ↔ SDI.']],
      answer: 0, why: 'Chaque leaf a ses sous-réseaux ; entre leaves, c\'est du routage, unicast (OSPF) et multicast (PIM).' },
    { q: 'Le contrôleur refuse de connecter un 41e flux UHD vers le multiview, sur une autre leaf. Pourquoi peut-il refuser ?',
      choices: [['Parce que le multiview n\'a que 40 entrées', 'Il le dirait autrement ; ici, c\'est un refus pour la bande passante.'], 'Parce qu\'un lien du chemin serait saturé : il tient le compte de la charge (SDN)', ['Parce que PTP est perdu', 'Une perte de PTP n\'empêche pas une connexion.']],
      answer: 1, why: 'Un contrôleur SDN connaît la charge de chaque lien et refuse ce qui ferait déborder le chemin, plutôt que d\'abîmer tous les flux.' },
    { q: 'Le car a deux fabrics spine-leaf. Pourquoi ne sont-elles reliées par aucun câble ?',
      choices: [['Pour économiser des ports', 'La raison est la sûreté, pas l\'économie.'], 'Pour qu\'une panne ou une erreur de l\'une ne puisse pas atteindre l\'autre (ST 2022-7)', ['Parce qu\'elles n\'utilisent pas les mêmes adresses', 'Leurs adresses diffèrent, mais ce n\'est pas la raison.']],
      answer: 1, why: 'La redondance n\'a de sens que si les deux réseaux tombent indépendamment l\'un de l\'autre.' },
  ],
};

// =====================================================================================
// 6. NMOS : trouver et connecter
// =====================================================================================
const SENDERS = [{ id: 'cam1', nom: 'CAM 1 vidéo', g: '239.1.1.1', s: '10.1.11.1' }, { id: 'cam2', nom: 'CAM 2 vidéo', g: '239.1.1.2', s: '10.1.11.2' }, { id: 'pgm', nom: 'PGM vidéo', g: '239.1.1.24', s: '10.1.13.10' }];
const RECEIVERS = [{ id: 'mel3', nom: 'Mélangeur, entrée 3' }, { id: 'mv5', nom: 'Multiview, tuile 5' }, { id: 'gw', nom: 'Passerelle SDI, sortie 1' }];
function figNmos() {
  const f = figure(440, 168, 'NMOS : chaque appareil se déclare au registre (IS-04) ; le contrôleur y lit la liste des émetteurs et récepteurs, puis demande à un récepteur de s\'abonner à un émetteur (IS-05), en lui donnant le SDP.');
  const box = (x, y, w, t, s, col) => { f.append(sv('rect', { x, y, width: w, height: 38, rx: 4, fill: '#1a2229', stroke: col }), sv('text', { x: x + w / 2, y: y + 16, textAnchor: 'middle', class: 'co-t' }, t), sv('text', { x: x + w / 2, y: y + 31, textAnchor: 'middle', class: 'co-s' }, s)); };
  box(160, 10, 120, 'Registre', 'IS-04 : qui existe ?', '#7fd1a0'); box(310, 64, 120, 'Contrôleur', 'la « grille » du car', '#ffb020');
  box(10, 64, 120, 'Caméra', 'émetteur (sender)', '#8a949c'); box(160, 120, 120, 'Mélangeur', 'récepteur (receiver)', '#8a949c');
  const ar = (x1, y1, x2, y2, t, col) => f.append(sv('line', { x1, y1, x2, y2, stroke: col, strokeWidth: 1.6, 'stroke-dasharray': '4 3' }), sv('text', { x: (x1 + x2) / 2, y: (y1 + y2) / 2 - 4, textAnchor: 'middle', class: 'co-s', fill: col }, t));
  ar(110, 64, 170, 46, '1. se déclare', '#7fd1a0'); ar(270, 140, 230, 48, '', '#7fd1a0'); ar(320, 66, 280, 38, '2. lit la liste', '#ffb020'); ar(320, 100, 280, 138, '3. IS-05 : abonne-toi', '#ffb020');
  f.append(sv('line', { x1: 130, y1: 90, x2: 160, y2: 136, stroke: '#ffd38a', strokeWidth: 3 }), sv('text', { x: 100, y: 150, textAnchor: 'middle', class: 'co-s', fill: '#ffd38a' }, '4. le flux (multicast)'));
  return f;
}
function demoNmos(host) {
  const conn = { mel3: 'cam1', mv5: 'cam2', gw: '' };
  let rx = 'mel3', tx = 'pgm';
  const json = el('pre', { class: 'co-json' });
  const etat = el('div', { class: 'co-hbars' });
  const draw = () => {
    const S = SENDERS.find((x) => x.id === tx);
    json.textContent = `PATCH /x-nmos/connection/v1.1/single/receivers/${rx}/staged
{
  "sender_id": "${S.id}",
  "master_enable": true,
  "activation": { "mode": "activate_immediate" },
  "transport_params": [
    { "source_ip": "${S.s}", "multicast_ip": "${S.g}",
      "destination_port": 5004, "rtp_enabled": true },
    { "source_ip": "${S.s.replace('10.1.', '10.2.')}", "multicast_ip": "${S.g.replace('239.1.', '239.2.')}",
      "destination_port": 5004, "rtp_enabled": true }
  ]
}`;
    etat.replaceChildren(...RECEIVERS.map((r) => el('p', { class: 'co-verdict ' + (conn[r.id] ? 'ok' : '') }, `${r.nom} ← ${conn[r.id] ? SENDERS.find((x) => x.id === conn[r.id]).nom + ` (${SENDERS.find((x) => x.id === conn[r.id]).g})` : 'rien'}`)));
  };
  host.append(el('div', { class: 'co-ctl' },
    choice('Récepteur', RECEIVERS.map((r) => [r.id, r.nom]), rx, (v) => { rx = v; draw(); }),
    choice('Émetteur', SENDERS.map((s) => [s.id, s.nom]), tx, (v) => { tx = v; draw(); }),
    el('div', { class: 'hwrow' }, el('button', { type: 'button', class: 'btn small primary', onclick: () => { conn[rx] = tx; draw(); } }, 'Envoyer la requête IS-05'))),
  el('p', { class: 'co-note' }, 'La requête que le contrôleur envoie au récepteur (une adresse par réseau, rouge puis bleu) :'), json, etat);
  draw();
}
/** @type {import('./index.js').Lesson} */
const NMOS = {
  id: 'reseau-nmos', title: 'NMOS : trouver les flux et les connecter (IS-04, IS-05)', minutes: '7 min',
  essentials: [
    'Avec des centaines de flux, on ne tape pas les adresses à la main : chaque appareil se **déclare** dans un **registre** (NMOS **IS-04**), avec ses émetteurs et ses récepteurs.',
    'Le **contrôleur** (la « grille » du car IP) lit le registre et demande à un récepteur de s\'abonner à un émetteur (**IS-05**), en lui passant ses paramètres (source, groupe, port) ou son **SDP**.',
    'Le récepteur s\'abonne alors en IGMP sur chaque réseau : NMOS décide **qui reçoit quoi**, le réseau transporte. Registre en panne : plus de nouvelles connexions, les flux en cours continuent.',
  ],
  figure: figNmos,
  demoTitle: 'Choisis un récepteur et un émetteur, envoie la requête IS-05 : lis ce que le contrôleur transmet au récepteur.',
  demo: demoNmos,
  body: `En SDI, connecter une caméra à l'entrée 3 du mélangeur, c'est un point de croisement de la grille. En IP, c'est dire à l'entrée 3 : « abonne-toi au groupe 239.1.1.1, envoyé par 10.1.11.1, port 5004, et au même flux sur le réseau bleu ». Personne ne veut taper cela pour 300 flux. Les spécifications **NMOS** (Networked Media Open Specifications, AMWA) automatisent la découverte et la connexion, quel que soit le constructeur.

**IS-04 : découverte et enregistrement.** À sa mise en route, chaque appareil trouve le **registre** (par DNS-SD) et s'y déclare : ses **nodes**, ses **devices**, ses **senders** (émetteurs, chacun avec son flux et son SDP) et ses **receivers** (récepteurs, avec ce qu'ils acceptent). Il envoie ensuite un signe de vie régulier (heartbeat) : un appareil qui se tait disparaît du registre.

**IS-05 : connexion.** Le **contrôleur** de diffusion lit le registre et affiche émetteurs et récepteurs, comme une grille. Pour un « take », il envoie au récepteur une requête (\`PATCH .../receivers/{id}/staged\`) qui contient l'émetteur choisi et ses **paramètres de transport** : adresse source, groupe multicast, port, pour chaque réseau (rouge et bleu), ou directement le SDP. L'activation peut être immédiate ou programmée à une heure PTP précise, pour commuter plusieurs récepteurs en même temps.

Le récepteur s'abonne ensuite **lui-même** en IGMP (S, G) sur chaque réseau. NMOS ne transporte aucune image : il dit qui doit recevoir quoi. D'où une panne instructive : **registre en panne**, plus aucune nouvelle connexion, mais les flux déjà établis continuent.

Autour, d'autres spécifications : IS-07 (événements, le tally), IS-08 (correspondance des canaux audio), BCP-003 (sécurité). Le contrôleur peut aussi être un contrôleur **SDN**, qui choisit le chemin et refuse ce qui saturerait un lien.`,
  plus: `- Le contrôle passe par un réseau à part, le réseau de contrôle (10.20.0.0/22 dans le car du simulateur), jamais par le réseau média.
- Un récepteur peut aussi être connecté « à la main » (adresse, source, port saisis) : une seule erreur de source, et le filtre SSM ne laisse rien passer (exercice de la passerelle au poste Réseau IP).
- Les identifiants NMOS sont des UUID : stables d'un redémarrage à l'autre, ils permettent au contrôleur de retrouver les connexions.`,
  car: { text: 'Au poste Réseau IP (car IP), onglet Flux : chaque réception est faite par le contrôleur NMOS, avec son SDP et son chemin ; la panne « registre NMOS » empêche toute nouvelle connexion. L\'exercice de la passerelle se fait à la main, puis par NMOS.', station: 'reseau' },
  terms: ['nmos', 'is-04', 'is-05', 'registre', 'controleur', 'sdp'],
  competences: ['3.6', '2.10', '3.12'], article: 'ipguide',
  quiz: [
    { q: 'À quoi sert le registre NMOS (IS-04) ?',
      choices: ['À tenir la liste des appareils et de leurs émetteurs et récepteurs', ['À transporter les images entre appareils', 'NMOS ne transporte aucune image : c\'est le réseau multicast.'], ['À donner l\'heure aux appareils', 'C\'est le rôle de PTP.']],
      answer: 0, why: 'Chaque appareil s\'y déclare et y signale qu\'il est vivant ; le contrôleur y lit ce qui existe.' },
    { q: 'Que contient la requête IS-05 que le contrôleur envoie à un récepteur ?',
      choices: [['Les images à afficher', 'Le récepteur va chercher les images lui-même, par IGMP.'], 'L\'émetteur choisi et ses paramètres de transport (source, groupe, port, pour chaque réseau) ou son SDP', ['L\'adresse IP du récepteur', 'Le récepteur la connaît déjà.']],
      answer: 1, why: 'Avec ces paramètres, le récepteur s\'abonne en IGMP (S, G) sur le réseau rouge et sur le bleu.' },
    { q: 'Le registre NMOS tombe en panne pendant le match. Que se passe-t-il ?',
      choices: [['Toutes les images s\'arrêtent', 'Les flux ne passent pas par le registre : ils continuent.'], 'Les flux en cours continuent, mais plus aucune nouvelle connexion ne se fait', ['Le PTP se dérègle', 'PTP ne dépend pas du registre.']],
      answer: 1, why: 'NMOS commande les connexions ; il ne porte pas les médias. On le redonde, mais sa panne ne coupe pas l\'antenne.' },
    { q: 'Comment un appareil neuf, branché sur le réseau de contrôle, trouve-t-il le registre ?',
      choices: ['Par DNS-SD (découverte de services), ou par une adresse configurée', ['Par une diffusion PTP', 'PTP sert à l\'heure, pas à la découverte.'], ['Il ne le trouve pas : on le déclare à la main', 'C\'est justement ce que NMOS évite.']],
      answer: 0, why: 'IS-04 prévoit la découverte par DNS-SD (unicast ou multicast) ; une adresse fixe reste possible.' },
    { q: 'Pourquoi programmer une activation IS-05 à une heure PTP précise ?',
      choices: [['Pour économiser de la bande passante', 'L\'heure d\'activation ne change rien au débit.'], 'Pour faire commuter plusieurs récepteurs exactement en même temps (une salve)', ['Parce que l\'activation immédiate n\'existe pas', 'Elle existe (activate_immediate).']],
      answer: 1, why: 'Tous les appareils partagent l\'heure PTP : une salve de connexions peut basculer à la même image.' },
    { q: 'Un récepteur connecté à la main ne reçoit rien ; l\'adresse du groupe et le port sont justes. Que vérifier ?',
      choices: ['L\'adresse source : en SSM, un abonnement (S, G) avec la mauvaise source ne laisse rien passer', ['Le registre NMOS', 'Une connexion manuelle ne passe pas par le registre.'], ['La vitesse du lien', 'Un lien lent perdrait des paquets, il n\'en refuserait pas la totalité.']],
      answer: 0, why: 'Le filtre SSM ne laisse passer que le couple (source, groupe) demandé : une seule erreur sur la source, et rien n\'arrive.' },
  ],
};

export const ST2110_LESSONS = [FLUX, PAQUET, RYTHME, ROUGE_BLEU, SPINE, NMOS];

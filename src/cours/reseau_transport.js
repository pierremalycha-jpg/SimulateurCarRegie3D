// @ts-check
import { el } from '../util.js';
import { figure, sv, slider, choice, readout, fmtNum } from './kit.js';
import { debitTcp, fluxTcp, streaming, latenceSrt, attenteFile, erreurPtp, serialisation } from './reseau_calc.js';

// ----------------------------------------------------------------------------------
// Leçons « bases du réseau » du chapitre Réseau, 3 : le transport (TCP et UDP, les ports), le
// streaming (contribution RTP, SRT, RTMP ; diffusion HLS, DASH) et la qualité de service (débit,
// latence, gigue, pertes ; DSCP, files d'attente, priorité de PTP). Calculs dans reseau_calc.js.
// ----------------------------------------------------------------------------------
const C = { grey: '#8a949c', amber: '#ffd38a', red: '#ff8a80', green: '#7fd1a0', cyan: '#7fd3f3', violet: '#c3a6ff', box: '#1a2026', line: '#2a3238' };
const txt = (x, y, s, cls = 'co-s', anchor = 'middle') => sv('text', { x, y, textAnchor: anchor, class: cls }, s);
const rect = (x, y, w, h, stroke = C.grey, fill = C.box) => sv('rect', { x, y, width: w, height: h, rx: 3, fill, stroke, strokeWidth: 1.2 });
const mbps = (b) => (b === Infinity ? 'sans limite' : b >= 1e9 ? `${fmtNum(b / 1e9, 2)} Gb/s` : b >= 1e6 ? `${fmtNum(b / 1e6, 1)} Mb/s` : `${fmtNum(b / 1e3, 0)} kb/s`);
const duree = (msv) => (msv === Infinity ? '—' : msv >= 10000 ? `${fmtNum(msv / 1000, 0)} s` : msv >= 1000 ? `${fmtNum(msv / 1000, 1)} s` : `${fmtNum(msv, 0)} ms`);
const us = (v) => (v >= 1000 ? `${fmtNum(v / 1000, 2)} ms` : `${fmtNum(v, 1)} µs`);
const fleche = (f, x1, y1, x2, y2, col, s, dash = '') => {
  f.append(sv('path', { d: `M${x1} ${y1} L${x2} ${y2}`, stroke: col, strokeWidth: 1.4, strokeDasharray: dash }));
  const a = Math.atan2(y2 - y1, x2 - x1), k = 6;
  f.append(sv('path', { d: `M${x2 - k * Math.cos(a - 0.4)} ${y2 - k * Math.sin(a - 0.4)} L${x2} ${y2} L${x2 - k * Math.cos(a + 0.4)} ${y2 - k * Math.sin(a + 0.4)}`, fill: 'none', stroke: col, strokeWidth: 1.4 }));
  if (s) f.append(txt((x1 + x2) / 2, (y1 + y2) / 2 - 4, s, 'co-m'));
};

// ======================================================================================
// 7. TCP et UDP
// ======================================================================================
function figTcpUdp() {
  const f = figure(720, 250, 'À gauche, TCP : poignée de main en trois temps (SYN, SYN-ACK, ACK), puis des données accusées, et un segment perdu renvoyé. À droite, UDP : les datagrammes partent sans préparation ni accusé ; un datagramme perdu est perdu');
  f.append(txt(180, 16, 'TCP : connexion, accusés, renvois', 'co-t'), txt(540, 16, 'UDP : on envoie, c\'est tout', 'co-t'));
  for (const x of [60, 300, 420, 660]) f.append(sv('line', { x1: x, y1: 28, x2: x, y2: 240, stroke: C.grey }));
  f.append(txt(60, 26, 'client', 'co-m'), txt(300, 26, 'serveur', 'co-m'), txt(420, 26, 'émetteur', 'co-m'), txt(660, 26, 'récepteur', 'co-m'));
  fleche(f, 60, 44, 300, 58, C.amber, 'SYN'); fleche(f, 300, 66, 60, 80, C.amber, 'SYN-ACK'); fleche(f, 60, 88, 300, 102, C.amber, 'ACK : connexion ouverte');
  fleche(f, 60, 118, 300, 132, C.green, 'données 1'); fleche(f, 300, 138, 60, 152, C.cyan, 'ACK 1');
  fleche(f, 60, 160, 210, 168, C.red, 'données 2', '4 3'); f.append(txt(222, 172, '✘', 'co-t'));
  fleche(f, 60, 196, 300, 210, C.green, 'données 2, renvoyées'); fleche(f, 300, 216, 60, 230, C.cyan, 'ACK 2');
  f.append(txt(30, 186, '1 RTT', 'co-m'));
  for (let i = 0; i < 6; i++) {
    const y = 48 + i * 32, perdu = i === 3;
    fleche(f, 420, y, perdu ? 560 : 660, y + 10, perdu ? C.red : C.green, `paquet ${i + 1}`, perdu ? '4 3' : '');
    if (perdu) f.append(txt(572, y + 14, '✘ perdu, jamais renvoyé', 'co-m', 'start'));
  }
  return f;
}
function demoTcpUdp(host) {
  let rtt = 20, perte = 0.1, debitFlux = 8;
  const rd = readout(['Débit possible en TCP', 'Ce qui limite TCP', 'Ce flux vidéo en TCP', 'Le même flux en UDP', 'Retard d\'un segment perdu en TCP']);
  const verdict = el('p', { class: 'co-verdict' });
  const fig = el('div', { class: 'co-figbox' });
  function update() {
    const p = perte / 100, t = debitTcp({ lien: 100e6, rtt, perte: p }), ft = fluxTcp({ debit: debitFlux * 1e6, lien: 100e6, rtt, perte: p });
    rd.set('Débit possible en TCP', mbps(t.debit)); rd.set('Ce qui limite TCP', t.limite);
    rd.set('Ce flux vidéo en TCP', ft.tient ? `tient (${debitFlux} Mb/s demandés)` : `ne tient pas : TCP ne peut donner que ${mbps(t.debit)}`);
    rd.set('Le même flux en UDP', p === 0 ? 'tout arrive' : `${fmtNum(p * 100, 2)} % des paquets manquent (${fmtNum(debitFlux * 1e6 / 8 / 1316 * p, 1)} par seconde)`);
    rd.set('Retard d\'un segment perdu en TCP', `au moins ${rtt} ms (un aller-retour), et tout ce qui suit attend`);
    // courbe : débit TCP selon les pertes, pour ce RTT
    const W = 720, H = 170, x0 = 60, x1 = 700, y0 = 140, y1 = 16;
    const f = figure(W, H, `Débit possible en TCP selon le taux de pertes, pour un aller-retour de ${rtt} ms, sur un lien de 100 Mb/s`);
    const lx = (pp) => x0 + (Math.log10(pp) + 4) / 4 * (x1 - x0), ly = (d) => y0 - Math.min(1, d / 100e6) * (y0 - y1);
    for (const [pp, s] of [[1e-4, '0,01 %'], [1e-3, '0,1 %'], [1e-2, '1 %'], [1e-1, '10 %'], [1, '100 %']]) f.append(sv('line', { x1: lx(pp), y1: y1, x2: lx(pp), y2: y0, stroke: C.line }), txt(lx(pp), y0 + 16, String(s), 'co-m'));
    for (const [d, s] of [[100e6, '100 Mb/s'], [50e6, '50'], [0, '0']]) f.append(txt(x0 - 6, ly(d) + 4, String(s), 'co-m', 'end'));
    let d = '';
    for (let i = 0; i <= 80; i++) { const pp = 10 ** (-4 + i / 20); d += `${i ? 'L' : 'M'}${lx(pp)} ${ly(debitTcp({ lien: 100e6, rtt, perte: pp }).debit)}`; }
    f.append(sv('path', { d, fill: 'none', stroke: C.green, strokeWidth: 2 }));
    f.append(sv('line', { x1: x0, y1: ly(debitFlux * 1e6), x2: x1, y2: ly(debitFlux * 1e6), stroke: C.amber, strokeDasharray: '4 3' }), txt(x1, ly(debitFlux * 1e6) - 4, `flux de ${debitFlux} Mb/s`, 'co-m', 'end'));
    if (p > 0) f.append(sv('circle', { cx: lx(p), cy: ly(t.debit), r: 5, fill: ft.tient ? C.green : C.red }));
    fig.replaceChildren(f);
    verdict.className = 'co-verdict ' + (ft.tient ? (p > 0 ? 'warn' : 'ok') : 'ko');
    verdict.textContent = !ft.tient ? 'En TCP, ce flux prend du retard puis décroche : chaque perte fait ralentir TCP, et sur une longue distance il remonte lentement. Pour du direct, on passe en UDP (avec SRT pour les pertes).'
      : p > 0 ? 'TCP tient le débit, mais chaque perte arrête tout le flux le temps d\'un aller-retour : des saccades. UDP ne s\'arrête jamais, mais il manque des paquets.'
        : 'Sans perte, TCP et UDP passent tous les deux. Ce sont les pertes et la distance qui les départagent.';
  }
  host.append(el('div', { class: 'co-ctl' },
    slider('Aller-retour (RTT)', 1, 300, rtt, 1, (v) => { rtt = v; update(); }, (v) => `${v} ms`),
    slider('Pertes', 0, 5, perte, 0.05, (v) => { perte = v; update(); }, (v) => `${fmtNum(v, 2)} %`),
    slider('Débit du flux vidéo', 8, 50, debitFlux, 1, (v) => { debitFlux = v; update(); }, (v) => `${v} Mb/s`)),
  fig, rd.el, verdict);
  update();
}

/** @type {import('./index.js').Lesson} */
export const TCP_UDP = {
  id: 'reseau-tcp-udp', title: 'TCP et UDP : la fiabilité ou la ponctualité', minutes: '8 min',
  essentials: [
    '**TCP** ouvre une connexion, numérote, fait **accuser réception** et **renvoie** ce qui se perd : tout arrive, dans l\'ordre, mais en retard après une perte. Pour les fichiers, les pages web, les commandes.',
    '**UDP** envoie sans connexion ni accusé : rien n\'est renvoyé, rien ne ralentit. Pour ce qui doit arriver **à l\'heure** : flux ST 2110, son, PTP, SRT, DNS.',
    'Le **port** (16 bits) désigne le programme : 443 pour le web sécurisé, 53 pour le DNS, 319 et 320 pour PTP. Adresse IP + port + protocole = une conversation.',
  ],
  figure: figTcpUdp,
  demoTitle: 'Réglez la distance (aller-retour) et les pertes : suivez le débit que TCP peut tenir, et ce que deviendrait le même flux vidéo en UDP.',
  demo: demoTcpUdp,
  body: `IP achemine des paquets de machine à machine, sans rien promettre : un paquet peut se perdre (file pleine, erreur sur le câble), arriver en double ou dans le désordre. La couche **transport** livre les données au bon **programme** et choisit ce qu'on fait des pertes. Deux protocoles s'y partagent le travail.

**Les ports.** Une machine fait tourner plusieurs programmes réseau à la fois. Chaque paquet TCP ou UDP porte un **port source** et un **port destination** (0 à 65 535). Les services connus ont leur port : HTTP 80, HTTPS 443, DNS 53, DHCP 67 et 68, NTP 123, SNMP 161, PTP 319 et 320, RTMP 1935. Le client prend un port libre au hasard. Un pare-feu filtre souvent par port.

**TCP : la fiabilité.**
- **Connexion** : avant toute donnée, une poignée de main en trois temps (SYN, SYN-ACK, ACK). Il faut donc un aller-retour (**RTT**) avant d'envoyer.
- **Numéros et accusés** : chaque octet est numéroté ; le récepteur accuse réception (ACK). Ce qui n'est pas accusé à temps est **renvoyé**. Les données sont remises **dans l'ordre**, sans trou.
- **Contrôle de congestion** : TCP augmente son débit tant que tout passe, et le **divise** à chaque perte. Sur une longue distance (RTT élevé), il remonte lentement : 1 % de pertes à 50 ms d'aller-retour limite une connexion à environ 3 Mb/s, quel que soit le lien.
- Le prix : après une perte, tout ce qui suit **attend** le renvoi (au moins un RTT). Pour un fichier, c'est sans importance. Pour une image en direct, c'est une saccade.

**UDP : la ponctualité.** Un en-tête de 8 octets (ports, longueur, somme de contrôle) et c'est tout : pas de connexion, pas d'accusé, pas de renvoi, pas de ralentissement. Ce qui arrive arrive tout de suite ; ce qui est perdu est perdu. C'est le choix du **temps réel** :
- les flux **ST 2110** (vidéo, son, données) et **AES67**, dans du RTP ;
- **PTP**, le DNS, le DHCP, NTP, le tally TSL ;
- les protocoles de contribution comme **SRT**, qui ajoutent au-dessus d'UDP **leur propre** reprise des pertes, avec un délai borné.

**En résumé** : un fichier doit arriver **entier**, peu importe quand : TCP. Une image doit arriver **à l'heure**, quitte à en perdre un bout : UDP. Dans un car IP, le réseau média est conçu pour ne **rien perdre** (débits réservés, redondance 2022-7), ce qui permet d'envoyer sans aucune reprise.`,
  plus: `- **RTP** (au-dessus d'UDP) numérote les paquets et les horodate : le récepteur voit qu'il en manque et les remet dans l'ordre, sans les redemander.
- **QUIC** (HTTP/3) fait de la fiabilité au-dessus d'UDP, comme SRT : la frontière entre les deux familles s'estompe.
- Le débit TCP dépend aussi de la **fenêtre** : 64 Ko sans option, à 100 ms d'aller-retour, ne font que 5 Mb/s. Les systèmes récents agrandissent la fenêtre tout seuls.
- \`netstat\` ou \`ss\` listent les connexions TCP ouvertes et les ports UDP écoutés d'une machine.`,
  car: { text: 'Dans le car IP, l\'analyseur du poste Réseau montre l\'en-tête UDP et RTP de chaque flux ST 2110 (port de destination, numéro de séquence). Le contrôle (NMOS, RCP, mélangeur) passe en TCP ; les médias, PTP et le tally en UDP.', station: 'reseau' },
  terms: ['tcp', 'udp', 'port', 'rtp', 'pertes', 'latence'],
  competences: ['3.6', '2.11', '2.4'], article: 'reseau',
  quiz: [
    { q: 'Pourquoi les flux vidéo ST 2110 passent-ils en UDP plutôt qu\'en TCP ?',
      choices: [['Parce qu\'UDP est plus fiable', 'C\'est l\'inverse : UDP ne renvoie rien.'], 'Parce qu\'une image doit arriver à l\'heure : attendre le renvoi d\'un paquet perdu la mettrait en retard', ['Parce que TCP ne sait pas transporter la vidéo', 'TCP transporte n\'importe quelles données ; c\'est son délai après une perte qui gêne le direct.']],
      answer: 1, why: 'TCP bloque tout le flux en attendant le renvoi ; pour du temps réel, mieux vaut un paquet perdu qu\'une image en retard.' },
    { q: 'Que se passe-t-il quand un segment TCP se perd ?',
      choices: ['L\'émetteur le renvoie, et ce qui suit attend : au moins un aller-retour de retard', ['Il est perdu définitivement', 'C\'est le cas d\'UDP. TCP renvoie tout ce qui n\'est pas accusé.'], ['Le récepteur l\'invente à partir des voisins', 'Aucun protocole de transport ne fait ça ; certains codecs masquent les pertes.']],
      answer: 0, why: 'TCP garantit des données complètes et dans l\'ordre : il renvoie et retarde la suite.' },
    { q: 'Combien d\'allers-retours faut-il à TCP avant de pouvoir envoyer la première donnée ?',
      choices: [['Aucun', 'C\'est UDP qui envoie sans préparation.'], 'Un : la poignée de main SYN, SYN-ACK, ACK', ['Dix', 'Trois messages suffisent, soit un aller-retour et demi au plus.']],
      answer: 1, why: 'Le client envoie SYN, reçoit SYN-ACK, et peut envoyer ses données avec l\'ACK.' },
    { q: 'Sur une liaison longue (50 ms d\'aller-retour) avec 1 % de pertes, pourquoi un transfert TCP plafonne-t-il à quelques Mb/s sur un lien de 100 Mb/s ?',
      choices: [['Parce que le lien est saturé', 'Le lien a de la marge : c\'est TCP qui se freine.'], 'Parce que TCP divise son débit à chaque perte et remonte lentement quand l\'aller-retour est long', ['Parce que les paquets sont trop gros', 'La taille des paquets n\'y est pour rien ici.']],
      answer: 1, why: 'Le contrôle de congestion de TCP interprète chaque perte comme un embouteillage : débit ≈ (MSS / RTT) × 1,22 / √p, environ 2,9 Mb/s ici.' },
    { q: 'À quoi sert le numéro de port dans un paquet UDP ou TCP ?',
      choices: [['À choisir la prise du commutateur', 'Le port réseau n\'a rien à voir avec la prise physique.'], 'À désigner le programme qui doit recevoir les données sur la machine', ['À dire combien de routeurs traverser', 'C\'est le rôle du TTL, dans l\'en-tête IP.']],
      answer: 1, why: 'L\'adresse IP désigne la machine, le port désigne le programme (le serveur web, le DNS, PTP…).' },
    { q: 'Quel protocole de transport utilise PTP, l\'horloge du car IP ?',
      choices: [['TCP', 'Un message d\'horloge renvoyé en retard ne sert à rien : PTP n\'en veut pas.'], 'UDP (ports 319 et 320)', ['Aucun : PTP est un câble', 'PTP est un protocole sur IP ; les messages passent par le réseau.']],
      answer: 1, why: 'PTP envoie ses messages en UDP, sur les ports 319 (événements horodatés) et 320 (messages généraux).' },
  ],
};

// ======================================================================================
// 8. Le streaming : RTP, SRT, RTMP, HLS
// ======================================================================================
const PROTOS = [
  { id: 'rtp', nom: 'RTP sur UDP (ST 2110, ST 2022-6)', usage: 'dans le car, sur un réseau maîtrisé' },
  { id: 'srt', nom: 'SRT', usage: 'contribution : du stade à la régie finale, par Internet ou la fibre' },
  { id: 'rtmp', nom: 'RTMP (sur TCP)', usage: 'envoi vers une plateforme de diffusion en ligne' },
  { id: 'llhls', nom: 'LL-HLS (faible latence)', usage: 'diffusion aux spectateurs, en direct serré' },
  { id: 'hls', nom: 'HLS / DASH', usage: 'diffusion à des millions de spectateurs (CDN)' },
];
function figStreaming() {
  const f = figure(720, 200, 'La chaîne d\'un direct : dans le car en RTP non compressé, du stade à la régie finale en contribution (SRT, fibre, satellite), puis vers les spectateurs en diffusion (RTMP vers la plateforme, HLS ou DASH par un CDN)');
  const etapes = [
    [10, 'Car régie', 'ST 2110 / SDI', 'non compressé', C.cyan],
    [190, 'Contribution', 'SRT, fibre, satellite', '10 à 100 Mb/s', C.green],
    [370, 'Régie finale', 'encodage pour le web', 'RTMP, SRT', C.amber],
    [550, 'Diffusion', 'HLS, DASH par un CDN', 'des millions de lecteurs', C.violet],
  ];
  etapes.forEach(([x, nom, l1, l2, col], i) => {
    f.append(rect(Number(x), 50, 160, 90, String(col)), txt(Number(x) + 80, 74, String(nom), 'co-t'), txt(Number(x) + 80, 98, String(l1), 'co-s'), txt(Number(x) + 80, 120, String(l2), 'co-m'));
    if (i < 3) fleche(f, Number(x) + 162, 95, Number(x) + 188, 95, '#fff', '');
  });
  f.append(txt(170, 30, '← quelques ms', 'co-m'), txt(360, 30, 'contribution : 0,1 à 1 s', 'co-m'), txt(630, 30, 'diffusion : 2 à 30 s →', 'co-m'));
  f.append(txt(360, 170, 'Plus on va vers le public, plus on compresse, plus on met en mémoire tampon, plus le délai grandit.', 'co-s'));
  f.append(txt(360, 190, 'UDP en contribution (le délai compte), TCP/HTTP en diffusion (le nombre de lecteurs compte).', 'co-m'));
  return f;
}
function demoStreaming(host) {
  let rtt = 40, perte = 0.5, segment = 6;
  const tableBox = el('div', { class: 'co-figbox' }), srt = readout(['Latence SRT à régler', 'Pourquoi']);
  const verdict = el('p', { class: 'co-verdict' });
  function update() {
    const p = perte / 100;
    const t = el('table', { class: 'co-table' }, el('thead', {}, el('tr', {}, ...['Protocole', 'Transport', 'Latence (ordre de grandeur)', 'Face aux pertes', 'Usage'].map((h) => el('th', {}, h)))));
    const tb = el('tbody');
    for (const pr of PROTOS) {
      const r = streaming(/** @type {any} */ (pr.id), { rtt, perte: p, segment, debit: 8e6, lien: 100e6 });
      tb.append(el('tr', { style: { opacity: r.ok ? '1' : '0.6' } }, el('td', {}, (r.ok ? '' : '✘ ') + pr.nom), el('td', {}, r.transport), el('td', {}, duree(r.latence)), el('td', {}, r.pertes), el('td', {}, pr.usage)));
    }
    t.append(tb); tableBox.replaceChildren(t);
    const l = latenceSrt(rtt, p);
    srt.set('Latence SRT à régler', l == null ? 'trop de pertes : SRT ne peut plus compenser' : `${fmtNum(l)} ms`);
    srt.set('Pourquoi', l == null ? 'au-delà de 40 % de pertes, changer de liaison' : `SRT doit pouvoir redemander un paquet perdu et le recevoir avant l'heure de l'afficher : quelques allers-retours (${rtt} ms chacun), d'autant plus que les pertes sont fréquentes ; jamais moins de 120 ms.`);
    verdict.className = 'co-verdict ' + (p === 0 ? 'ok' : p < 0.02 ? 'warn' : 'ko');
    verdict.textContent = p === 0 ? 'Réseau parfait : même RTP brut passe. C\'est le cas du réseau média d\'un car, conçu pour ne rien perdre.'
      : p < 0.02 ? 'Quelques pertes : RTP brut abîme l\'image, SRT les rattrape avec une latence de quelques allers-retours, les protocoles sur TCP les rattrapent en retardant tout.'
        : 'Beaucoup de pertes : RTMP décroche (TCP n\'arrive plus à tenir le débit), SRT demande une grande latence. Changer de liaison ou en ajouter une (agrégation, secours).';
  }
  host.append(el('div', { class: 'co-ctl' },
    slider('Aller-retour (RTT)', 1, 300, rtt, 1, (v) => { rtt = v; update(); }, (v) => `${v} ms`),
    slider('Pertes', 0, 10, perte, 0.1, (v) => { perte = v; update(); }, (v) => `${fmtNum(v, 1)} %`),
    slider('Durée d\'un segment HLS', 2, 10, segment, 1, (v) => { segment = v; update(); }, (v) => `${v} s`)),
  tableBox, srt.el, verdict);
  update();
}

/** @type {import('./index.js').Lesson} */
export const STREAMING = {
  id: 'reseau-streaming', title: 'Le streaming : RTP, SRT, RTMP, HLS', minutes: '9 min',
  essentials: [
    '**Contribution** (du stade à la régie finale) : peu de destinataires, le délai compte. On envoie en **UDP** : RTP sur un réseau maîtrisé, **SRT** sur Internet (il redemande les paquets perdus dans un délai réglé, de l\'ordre de 3 à 4 allers-retours).',
    '**Diffusion** (vers le public) : des millions de lecteurs. **RTMP** (TCP) pousse le flux vers la plateforme ; **HLS** et **DASH** découpent la vidéo en **segments** servis en HTTP par un **CDN** : robuste, mais 10 à 30 s de retard (2 à 5 s en faible latence).',
    'Un flux est une suite de paquets **numérotés** et **horodatés** (RTP) : le récepteur les remet dans l\'ordre, absorbe la gigue dans une **mémoire tampon**, et repère ce qui manque.',
  ],
  figure: figStreaming,
  demoTitle: 'Réglez la distance, les pertes et la durée des segments : comparez la latence et le comportement de chaque protocole.',
  demo: demoStreaming,
  body: `« Streamer », c'est envoyer de l'image et du son **en continu** sur un réseau, pour qu'ils soient lus pendant qu'ils arrivent. Selon l'étape de la chaîne, les besoins changent du tout au tout.

**Dans le car : RTP sur un réseau maîtrisé.** Les flux ST 2110 sont des paquets **RTP** (12 octets d'en-tête : numéro de séquence, horodatage, source) dans de l'**UDP**, en multicast. Le réseau est dimensionné et redondant (rouge et bleu, ST 2022-7) : on n'a besoin d'aucune reprise, et la latence se compte en microsecondes. Le récepteur garde une petite **mémoire tampon** (tampon de gigue) pour absorber les petits écarts d'arrivée.

**La contribution : du stade à la régie finale.** On envoie le programme (et parfois quelques caméras isolées) **compressé** (H.264, HEVC, JPEG XS) : de 10 à 100 Mb/s par flux. Plusieurs voies :
- la **fibre de l'opérateur**, avec une qualité garantie ;
- **SRT** (Secure Reliable Transport, ouvert, très répandu) sur Internet : au-dessus d'UDP, le récepteur signale les paquets manquants et l'émetteur les **renvoie**, tant que le délai de **latence réglé** le permet. Ce délai se règle d'après l'aller-retour mesuré et le taux de pertes : environ 3 allers-retours jusqu'à 1 % de pertes, 4 jusqu'à 3 %, davantage au-delà (jamais moins de 120 ms). SRT chiffre aussi le flux (AES) ;
- **RIST**, cousin de SRT ; le **satellite** (DSNG) ; les sacs à dos **4G/5G** qui agrègent plusieurs cartes SIM.
On double souvent la contribution : une voie principale, une de secours par un autre chemin.

**La diffusion : vers le public.**
- **RTMP** (sur TCP, port 1935) sert encore à **pousser** le flux de l'encodeur vers une plateforme (YouTube, Twitch, un serveur de la chaîne). Sur TCP, une liaison qui perd des paquets ralentit, prend du retard, puis décroche. SRT le remplace peu à peu.
- **HLS** (Apple) et **MPEG-DASH** découpent la vidéo en **segments** de quelques secondes, en plusieurs qualités, décrits par une **liste de lecture** (manifeste). Le lecteur les télécharge en **HTTP** (sur TCP), comme des fichiers, auprès d'un **CDN** : des serveurs répartis près des spectateurs. Il choisit la qualité selon son débit (**débit adaptatif**). C'est ce qui permet de servir des millions de lecteurs, au prix du délai : le lecteur garde en général **trois segments** d'avance, soit 20 à 30 s avec des segments de 6 s. Les variantes à **faible latence** (LL-HLS, DASH à faible latence) découpent en morceaux d'environ une seconde : 2 à 5 s.

**Les mots du streaming** : **débit** (Mb/s, constant ou variable), **latence** (du capteur à l'écran), **gigue** (variation du délai d'arrivée, absorbée par le tampon), **pertes** (paquets manquants : réparés par renvoi ou par **FEC**, des paquets de correction envoyés d'avance), **GOP** (groupe d'images entre deux images complètes : un segment commence toujours par une image complète).`,
  plus: `- La **FEC** (ST 2022-1 et -5 pour la vidéo sur IP) envoie des paquets de parité : le récepteur reconstruit un paquet perdu sans rien demander, au prix d'un peu de débit en plus.
- **WebRTC** vise la latence la plus faible vers le public (moins d'une seconde), pour des audiences plus petites.
- **NDI** fait circuler de la vidéo légèrement compressée sur un réseau local ordinaire, très répandu en production légère.
- Un **CDN** garde les segments en cache dans des serveurs proches des spectateurs : la source n'envoie le flux qu'une fois par région.`,
  car: { text: 'Au poste Transmission : le départ du programme vers la régie finale et son secours. Dans le car, les sources circulent non compressées (SDI, ou RTP en ST 2110 dans le car IP) ; la compression et le streaming commencent à la sortie du car.', station: 'transmission' },
  terms: ['srt', 'rtp', 'hls', 'rtmp', 'gigue', 'fec', 'latence'],
  competences: ['2.11', '4.4', '3.4'], article: 'reseau',
  quiz: [
    { q: 'Pour envoyer le programme du stade vers la régie finale par Internet, quel protocole convient le mieux ?',
      choices: [['HLS', 'HLS sert à diffuser vers le public, avec plusieurs dizaines de secondes de retard.'], 'SRT : UDP, avec renvoi des paquets perdus dans un délai réglé', ['RTP brut, sans protection', 'Sur Internet, la moindre perte abîmerait l\'image : rien n\'est renvoyé.']],
      answer: 1, why: 'SRT encaisse les pertes d\'Internet en gardant une latence courte et maîtrisée : c\'est un protocole de contribution.' },
    { q: 'L\'aller-retour vers la régie finale est de 60 ms, avec environ 2 % de pertes. Quelle latence SRT régler, d\'après les repères habituels ?',
      choices: [['60 ms', 'Un seul aller-retour ne laisse pas le temps de redemander puis de recevoir un paquet perdu.'], 'Environ 240 ms (4 allers-retours)', ['10 s', 'Bien trop : SRT tient avec quelques allers-retours.']],
      answer: 1, why: 'Jusqu\'à 3 % de pertes, on compte environ 4 allers-retours : 4 × 60 = 240 ms.' },
    { q: 'Pourquoi un direct en HLS arrive-t-il chez le spectateur 20 à 30 secondes après l\'action ?',
      choices: [['Parce que les satellites sont loin', 'HLS passe par Internet ; le délai vient des segments.'], 'Parce que la vidéo est découpée en segments de quelques secondes et que le lecteur en garde plusieurs d\'avance', ['Parce que HLS passe en UDP', 'HLS passe en HTTP, donc en TCP.']],
      answer: 1, why: 'Un segment de 6 s doit être fini avant d\'être servi, et le lecteur en garde trois en réserve : 20 à 30 s.' },
    { q: 'Que fait le récepteur d\'un flux RTP de la gigue (les écarts d\'arrivée entre paquets) ?',
      choices: ['Il l\'absorbe dans une mémoire tampon et ressort les paquets au rythme de leurs horodatages', ['Il jette les paquets en avance', 'Il les garde : le tampon sert justement à les attendre ou à les retenir.'], ['Il demande à l\'émetteur de ralentir', 'RTP ne commande pas l\'émetteur ; c\'est TCP qui se règle sur le réseau.']],
      answer: 0, why: 'Les horodatages RTP disent quand chaque paquet doit être joué ; le tampon lisse les arrivées.' },
    { q: 'Une liaison perd 5 % de paquets. Le flux RTMP vers la plateforme décroche. Pourquoi ?',
      choices: [['RTMP ne sait pas compresser', 'L\'encodeur compresse ; RTMP transporte.'], 'RTMP passe en TCP : chaque perte le fait ralentir, il ne tient plus le débit du flux', ['RTMP est limité à 1 Mb/s', 'Il n\'a pas de telle limite.']],
      answer: 1, why: 'Sur TCP, les pertes font chuter le débit possible sous celui de la vidéo : le retard s\'accumule jusqu\'à la coupure.' },
    { q: 'Qu\'est-ce qu\'un CDN ?',
      choices: [['Un codec vidéo', 'Un codec compresse (H.264, HEVC) ; le CDN distribue.'], 'Un réseau de serveurs répartis près des spectateurs, qui gardent les segments et les servent', ['Le câble de la caméra', 'Rien à voir : c\'est une infrastructure de diffusion sur Internet.']],
      answer: 1, why: 'Le CDN démultiplie la diffusion : chaque spectateur télécharge les segments chez un serveur proche.' },
  ],
};

// ======================================================================================
// 9. La QoS
// ======================================================================================
function figQos() {
  const f = figure(720, 210, 'Un port de sortie de commutateur avec des files d\'attente par classe : les paquets marqués EF (PTP) passent en priorité, puis AF41 (médias), puis le reste. Sans priorité, un paquet PTP attend derrière toute une rafale de fichiers');
  f.append(txt(360, 16, 'Classer, marquer, mettre en file, servir', 'co-t'));
  const files = [['EF 46 : PTP', C.red, 1], ['AF41 34 : audio, vidéo', C.amber, 4], ['CS2 16 : contrôle', C.cyan, 2], ['BE 0 : fichiers', C.grey, 8]];
  files.forEach(([nom, col, n], i) => {
    const y = 34 + i * 38;
    f.append(txt(150, y + 18, String(nom), 'co-s', 'end'));
    f.append(rect(160, y, 300, 28, String(col)));
    for (let k = 0; k < Number(n); k++) f.append(sv('rect', { x: 452 - (k + 1) * 34, y: y + 5, width: 30, height: 18, rx: 2, fill: String(col), opacity: 0.85 }));
    fleche(f, 462, y + 14, 530, 112, String(col), '');
  });
  f.append(rect(530, 92, 70, 40, '#fff'), txt(565, 116, 'port', 'co-t'), fleche(f, 600, 112, 700, 112, '#fff', 'lien'));
  f.append(txt(565, 160, 'ordonnanceur : priorité stricte', 'co-m'), txt(565, 176, 'pour EF, partage pondéré ensuite', 'co-m'));
  f.append(txt(10, 200, 'Le marquage DSCP est posé à l\'entrée du réseau (ou par l\'appareil) ; chaque commutateur le lit et range le paquet dans sa file.', 'co-s', 'start'));
  return f;
}
function demoQos(host) {
  let rafale = 1.25, lien = '1', mode = 'fifo';
  const fig = el('div', { class: 'co-figbox' });
  const rd = readout(['Rafale déjà en file', 'Attente d\'un paquet PTP', 'Attente d\'un paquet audio', 'Attente d\'un paquet de fichier', 'Erreur d\'horloge PTP si l\'aller attend et pas le retour']);
  const verdict = el('p', { class: 'co-verdict' });
  function update() {
    const L = Number(lien) * 1e9, oct = rafale * 1e6;
    const r = attenteFile(oct, L, /** @type {'fifo' | 'prio'} */ (mode)), by = Object.fromEntries(r.map((c) => [c.id, c]));
    rd.set('Rafale déjà en file', `${fmtNum(rafale, 2)} Mo, soit ${us(serialisation(oct, L))} pour la vider`);
    rd.set('Attente d\'un paquet PTP', us(by.ptp.attente)); rd.set('Attente d\'un paquet audio', us(by.audio.attente)); rd.set('Attente d\'un paquet de fichier', us(by.fichiers.attente));
    const err = erreurPtp(by.ptp.attente, serialisation(1500, L));
    rd.set('Erreur d\'horloge PTP si l\'aller attend et pas le retour', us(err));
    const W = 720, H = 30 * r.length + 34, x0 = 220, x1 = 700, max = Math.max(...r.map((c) => c.attente));
    const lx = (v) => x0 + Math.log10(1 + v) / Math.log10(1 + Math.max(max, 10)) * (x1 - x0);
    const f = figure(W, H, `Attente de chaque classe dans la file du port, en ${mode === 'fifo' ? 'file unique' : 'priorité stricte'}`);
    r.forEach((c, i) => {
      const y = 8 + i * 30;
      f.append(txt(x0 - 8, y + 16, `${c.nom} (DSCP ${c.dscp})`, 'co-s', 'end'));
      f.append(sv('rect', { x: x0, y: y + 4, width: Math.max(2, lx(c.attente) - x0), height: 16, rx: 2, fill: c.attente > 100 ? C.red : c.attente > 20 ? C.amber : C.green }), txt(Math.min(x1, lx(c.attente) + 6), y + 16, us(c.attente), 'co-m', 'start'));
    });
    f.append(txt(x0, H - 6, 'échelle logarithmique', 'co-m', 'start'));
    fig.replaceChildren(f);
    verdict.className = 'co-verdict ' + (err > 1 ? 'ko' : 'ok');
    verdict.textContent = err > 1 ? `File unique : le paquet PTP attend ${us(by.ptp.attente)} derrière la rafale. Si le retour, lui, n'attend pas, l'horloge esclave se trompe de ${us(err)} : bien plus que la microseconde visée. Et la gigue d'arrivée du son et de la vidéo explose.`
      : `Priorité stricte : PTP et les médias n'attendent que la fin de la trame en cours (${us(by.ptp.attente)}). Seuls les fichiers subissent la rafale, ce qui ne gêne personne.`;
  }
  host.append(el('div', { class: 'co-ctl' },
    choice('Files d\'attente', [['fifo', 'Une seule file (sans QoS)'], ['prio', 'Files par classe, priorité stricte']], mode, (v) => { mode = v; update(); }),
    choice('Débit du port', [['1', '1 Gb/s'], ['10', '10 Gb/s'], ['25', '25 Gb/s']], lien, (v) => { lien = v; update(); }),
    slider('Rafale de fichiers en file', 0.01, 5, rafale, 0.01, (v) => { rafale = v; update(); }, (v) => `${fmtNum(v, 2)} Mo`)),
  fig, rd.el, verdict);
  update();
}

/** @type {import('./index.js').Lesson} */
export const QOS = {
  id: 'reseau-qos', title: 'La qualité de service (QoS) : priorités et files d\'attente', minutes: '8 min',
  essentials: [
    'Quatre grandeurs disent si un réseau convient : le **débit**, la **latence**, la **gigue** (variation du délai) et les **pertes**. La QoS protège les flux qui en ont besoin quand le réseau est chargé.',
    'Chaque paquet porte une **classe** : le champ **DSCP** de l\'en-tête IP (EF = 46 pour PTP, AF41 = 34 pour l\'audio et la vidéo, 0 pour le reste) ou la priorité **CoS** de l\'étiquette VLAN.',
    'Le commutateur range chaque classe dans sa **file d\'attente** et sert les prioritaires d\'abord : un paquet PTP n\'attend plus derrière une rafale de fichiers, l\'horloge reste juste à la microseconde.',
  ],
  figure: figQos,
  demoTitle: 'Envoyez une rafale de fichiers sur un port : comparez l\'attente de chaque classe avec une seule file, puis avec des files par priorité.',
  demo: demoQos,
  body: `Un commutateur reçoit parfois, pour un même port de sortie, plus de trafic que le port ne peut en envoyer : un transfert de fichiers et des flux médias en même temps, ou plusieurs ports qui envoient vers un seul. Les paquets en trop **attendent** dans une **file** ; si la file déborde, ils sont **jetés**. La qualité de service décide **qui attend** et **qui est jeté**.

**Les quatre grandeurs.**
- **Débit** : ce que le lien transporte par seconde (bit/s).
- **Latence** : le temps de bout en bout ; dans un réseau local, c'est surtout l'attente dans les files.
- **Gigue** : la variation de la latence d'un paquet à l'autre. Elle oblige le récepteur à garder un tampon ; pour PTP, elle fausse l'horloge.
- **Pertes** : les paquets jetés (file pleine) ou abîmés (erreur sur le câble).

**Classer et marquer.** Chaque paquet porte sa classe :
- dans l'en-tête IP, le champ **DSCP** (6 bits, 64 valeurs). Les valeurs normalisées : **EF** (46, expedited forwarding : faible délai), les **AF** (assured forwarding, AF41 = 34…), les **CS** (class selector, CS2 = 16…), et **0** pour le trafic ordinaire (best effort) ;
- dans l'étiquette VLAN, la priorité **CoS** (802.1p, 3 bits, 0 à 7), lue par les commutateurs de niveau 2.
Les recommandations d'AES67 et de ST 2110 : **PTP en EF (46)**, **les médias en AF41 (34)**. L'appareil marque lui-même ses paquets ; le commutateur peut faire confiance au marquage ou le refaire à l'entrée.

**Mettre en file et servir.** Chaque port a plusieurs files (souvent 8). Le commutateur range chaque paquet dans la file de sa classe, puis les sert :
- en **priorité stricte** pour la classe la plus urgente (PTP) : elle passe dès que la trame en cours est finie ;
- par **partage pondéré** pour les autres (chaque file reçoit une part garantie du débit) ;
- quand une file déborde, on jette d'abord les paquets les moins importants.
Sans QoS, une seule file : un paquet PTP peut attendre des millisecondes derrière une rafale de fichiers. Comme PTP mesure le délai aller-retour et suppose l'aller égal au retour, une attente d'un seul côté décale l'horloge de **la moitié de cette attente**.

**La QoS ne crée pas de débit.** Elle choisit qui souffre quand il en manque. Un réseau média ST 2110 est d'abord **dimensionné** pour ne jamais saturer (débits réservés, NMOS, contrôle d'admission) ; la QoS protège PTP et les médias des rafales imprévues (fichiers, mises à jour, supervision). Sur un WAN loué, la QoS de l'opérateur (classes de service) garantit le débit du programme face au reste.`,
  plus: `- **Policing** (on jette ce qui dépasse un débit) et **shaping** (on retient pour lisser) limitent un flux à ce qui lui est alloué.
- La file d'un commutateur tient quelques Mo au plus : une rafale plus grosse, et les paquets sont jetés.
- Les commutateurs du car IP sont des **horloges frontières** PTP : elles recalent l'horloge à chaque saut, ce qui retire l'attente des files du calcul. La QoS reste utile pour les réseaux sans horloge frontière et pour les médias.
- Pour vérifier : le compteur de **paquets jetés** par file et par port (show interface, show queueing).`,
  car: { text: 'Au poste Réseau (car IP) : la ligne « PTP (DSCP 46) en file prioritaire » de chaque commutateur, et la panne qui la désactive (l\'offset PTP se met à varier). Dans le car SDI, la priorité CoS de l\'intercom et du son sur le réseau de contrôle.', station: 'reseau' },
  terms: ['qos', 'dscp', 'cos', 'gigue', 'latence', 'pertes', 'ptp'],
  competences: ['1.2', '3.6', '3.12'], article: 'reseau',
  quiz: [
    { q: 'Quelle valeur DSCP recommandent AES67 et ST 2110 pour les messages PTP ?',
      choices: [['0 (best effort)', 'C\'est la classe ordinaire : PTP attendrait derrière tout le reste.'], '46 (EF)', ['34 (AF41)', 'C\'est la classe recommandée pour les médias (audio, vidéo).']],
      answer: 1, why: 'EF (expedited forwarding, 46) : la classe à faible délai, servie en priorité.' },
    { q: 'Un paquet PTP attend 2 ms dans une file à l\'aller, mais pas au retour. Quelle erreur d\'horloge en résulte ?',
      choices: [['Aucune : PTP mesure le délai', 'PTP mesure l\'aller-retour et le coupe en deux : une attente d\'un seul côté le trompe.'], 'Environ 1 ms : la moitié de l\'asymétrie', ['2 ms', 'PTP répartit l\'écart entre l\'aller et le retour : l\'erreur est la moitié.']],
      answer: 1, why: 'PTP suppose le délai aller égal au retour ; une asymétrie de 2 ms décale l\'horloge de 1 ms.' },
    { q: 'Qu\'est-ce que la gigue ?',
      choices: ['La variation du délai d\'arrivée d\'un paquet à l\'autre', ['Le nombre de paquets perdus', 'Ce sont les pertes.'], ['Le délai moyen de bout en bout', 'C\'est la latence ; la gigue est sa variation.']],
      answer: 0, why: 'Des paquets envoyés régulièrement arrivent à intervalles irréguliers : le récepteur doit les tamponner.' },
    { q: 'La QoS permet-elle de faire passer 12 Gb/s de flux dans un lien de 10 Gb/s ?',
      choices: [['Oui, en compressant les paquets', 'La QoS ne compresse rien.'], ['Oui, si tous les flux sont en EF', 'Si tout est prioritaire, rien ne l\'est : il manque toujours 2 Gb/s.'], 'Non : elle choisit seulement qui attend et qui est jeté quand il en manque'],
      answer: 2, why: 'La QoS répartit la pénurie ; seul le dimensionnement (ou un lien plus gros) crée du débit.' },
    { q: 'Où se trouve le champ DSCP ?',
      choices: [['Dans l\'en-tête Ethernet', 'Ethernet porte la priorité CoS, dans l\'étiquette VLAN.'], 'Dans l\'en-tête IP (6 bits)', ['Dans l\'en-tête UDP', 'UDP ne porte que les ports, la longueur et la somme de contrôle.']],
      answer: 1, why: 'Le DSCP occupe 6 bits de l\'octet de service de l\'en-tête IP : il suit le paquet à travers les routeurs.' },
    { q: 'Une mise à jour logicielle lancée pendant le match fait varier l\'offset PTP de plusieurs microsecondes. Quelle est la cause la plus probable ?',
      choices: [['Le grand maître PTP est en panne', 'L\'offset varierait sans lien avec la mise à jour, ou les esclaves passeraient en holdover.'], 'Les paquets PTP attendent derrière les fichiers : la file prioritaire n\'est pas réglée', ['La mise à jour change l\'heure du car', 'Elle ne touche pas à l\'horloge, mais elle charge le réseau.']],
      answer: 1, why: 'Sans file prioritaire pour EF, PTP subit l\'attente variable créée par la rafale : son offset se met à danser.' },
  ],
};

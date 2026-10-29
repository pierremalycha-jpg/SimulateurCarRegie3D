// @ts-check
import { el, mulberry32 } from '../util.js';
import { sv, figure, choice, slider, readout, fmtNum } from './kit.js';
import { budgetLatence, gigueRtp, filesQos, CLASSES } from './ip_calc.js';

// ----------------------------------------------------------------------------------
// Chapitre « Le réseau », partie « Qualité de service et mesures » : débit, latence, gigue et pertes (et les outils
// pour les mesurer), puis la qualité de service (classer, marquer en DSCP ou CoS, files d'attente, priorité stricte).
// Calculs : cours/ip_calc.js (budget de latence, gigue RFC 3550, port de sortie engorgé, modèle fluide).
// Normes : RFC 3550 (gigue d'arrivée), RFC 2474 et 4594 (DiffServ), IEEE 802.1Q (priorité, CoS) ; AES67 et
// ST 2110-10 (PTP en EF 46, médias en AF41 34).
// ----------------------------------------------------------------------------------
const bar = (label, val, max, col, txt) => el('div', { class: 'co-hbar' }, el('span', {}, label), el('i', {}, el('b', { style: { width: Math.min(100, max > 0 ? val / max * 100 : 0) + '%', background: col } })), el('small', {}, txt));
const ms = (v) => (v >= 1 ? `${fmtNum(v, v < 10 ? 2 : 1)} ms` : `${fmtNum(v * 1000, v * 1000 < 10 ? 1 : 0)} µs`);

// ======================================================================================
// Débit, latence, gigue, pertes
// ======================================================================================
function figMesures() {
  const f = figure(440, 196, 'En haut, les quatre parts de la latence d\'un paquet : propagation, sérialisation, traversée des équipements, attente dans les files. En bas, la gigue : des paquets envoyés à intervalle régulier arrivent à intervalles irréguliers.');
  const P = [['propagation', 150, '#7fd3f3', '5 µs/km'], ['sérialisation', 40, '#ffd38a', 'taille ÷ débit'], ['équipements', 50, '#7fd1a0', 'µs par saut'], ['files', 130, '#ff9a8a', 'variable : la gigue']];
  let x = 20;
  f.append(sv('text', { x: 20, y: 14, class: 'co-t' }, 'La latence d\'un paquet, de bout en bout'));
  for (const [n, w, c, s] of /** @type {[string, number, string, string][]} */ (P)) {
    f.append(sv('rect', { x, y: 22, width: w - 2, height: 26, rx: 3, fill: c, opacity: 0.85 }), sv('text', { x: x + w / 2, y: 39, textAnchor: 'middle', class: 'co-bit' }, n), sv('text', { x: x + w / 2, y: 62, textAnchor: 'middle', class: 'co-s' }, s));
    x += w;
  }
  f.append(sv('text', { x: 20, y: 96, class: 'co-t' }, 'La gigue'), sv('text', { x: 20, y: 116, class: 'co-s' }, 'envoyés'), sv('text', { x: 20, y: 170, class: 'co-s' }, 'reçus'));
  const arr = [0, 3, 14, 4, 22, 2, 9, 1];
  arr.forEach((d, i) => {
    const xs = 90 + i * 42, xr = xs + 18 + d;
    f.append(sv('rect', { x: xs, y: 106, width: 14, height: 14, rx: 2, fill: '#7fd3f3' }), sv('rect', { x: xr, y: 160, width: 14, height: 14, rx: 2, fill: d > 10 ? '#ff9a8a' : '#7fd1a0' }), sv('line', { x1: xs + 7, y1: 120, x2: xr + 7, y2: 160, stroke: '#3a4650', 'stroke-dasharray': '3 3' }));
  });
  f.append(sv('text', { x: 430, y: 192, textAnchor: 'end', class: 'co-s' }, 'un tampon de réception absorbe la gigue, au prix d\'un peu de retard'));
  return f;
}
function demoMesures(host) {
  let km = 250, sauts = 8, gbps = 10, file = 2, taille = 100;
  const bars = el('div', { class: 'co-hbars' });
  const R = readout(['Latence (aller)', 'Ping (aller-retour)', 'Gigue mesurée (RFC 3550)', 'Transférer le fichier']);
  const draw = () => {
    const B = budgetLatence({ km, sauts, gbps, equipementUs: 10, fileMs: file / 2 });
    const rnd = mulberry32(7), tr = Array.from({ length: 400 }, () => B.prop + B.seri + B.equip + rnd() * file);
    const j = gigueRtp(tr);
    const mx = B.total;
    bars.replaceChildren(
      bar('Propagation', B.prop, mx, '#7fd3f3', ms(B.prop)),
      bar('Sérialisation', B.seri, mx, '#ffd38a', `${ms(B.seri)} (${sauts} × 1 500 octets)`),
      bar('Équipements', B.equip, mx, '#7fd1a0', `${ms(B.equip)} (${sauts} × 10 µs)`),
      bar('Files (moyenne)', B.file, mx, '#ff9a8a', ms(B.file)));
    R.set('Latence (aller)', `${ms(B.total)} en moyenne`);
    R.set('Ping (aller-retour)', `≈ ${ms(2 * B.total)}`);
    R.set('Gigue mesurée (RFC 3550)', file ? `${ms(j)} : la file varie de 0 à ${file} ms` : '≈ 0 : rien n\'attend dans les files');
    const s = taille * 8 / (gbps * 1000 * 0.9);
    R.set('Transférer le fichier', `${taille} Mo = ${fmtNum(taille * 8)} Mb : ${s < 1 ? fmtNum(s * 1000, 0) + ' ms' : fmtNum(s, 1) + ' s'} à ${gbps} Gb/s (90 % utiles)`);
  };
  host.append(el('div', { class: 'co-ctl' },
    slider('Distance', 0, 1000, km, 10, (v) => { km = v; draw(); }, (v) => `${v} km`),
    slider('Équipements traversés', 1, 20, sauts, 1, (v) => { sauts = v; draw(); }, (v) => String(v)),
    choice('Débit des liens', [['1', '1 Gb/s'], ['10', '10 Gb/s'], ['100', '100 Gb/s']], String(gbps), (v) => { gbps = +v; draw(); }),
    slider('Attente variable dans les files', 0, 20, file, 0.5, (v) => { file = v; draw(); }, (v) => `0 à ${fmtNum(v, 1)} ms`),
    slider('Taille du fichier', 1, 10000, taille, 1, (v) => { taille = v; draw(); }, (v) => `${fmtNum(v)} Mo`)),
  bars, R.el);
  draw();
}

/** @type {import('./index.js').Lesson} */
export const MESURES = {
  id: 'reseau-mesures', title: 'Débit, latence, gigue, pertes : mesurer un réseau', minutes: '7 min',
  essentials: [
    'Le **débit** se compte en **bits** par seconde (Mb/s, Gb/s) ; un fichier se compte en **octets** (Mo) : 1 octet = 8 bits, 100 Mo font 800 Mb, au moins 0,8 s sur 1 Gb/s.',
    'La **latence** additionne la propagation (≈ 5 µs par km de fibre), la sérialisation, la traversée des équipements et l\'attente dans les files ; la **gigue** est la variation de cette latence ; les **pertes** se comptent en % de paquets.',
    'Outils : **ping** (aller-retour), **traceroute** (chemin), **iperf** (débit, pertes), un analyseur de trames (Wireshark : gigue et pertes RTP).',
  ],
  figure: figMesures,
  demoTitle: 'Règle la distance, le nombre d\'équipements, le débit des liens et l\'encombrement des files : regarde ce qui pèse dans la latence et ce qui fait la gigue.',
  demo: demoMesures,
  body: `Quatre chiffres décrivent ce qu'un réseau fait subir à un flux. On les mesure avant l'antenne, et on les surveille pendant.

**Le débit** est la quantité de données par seconde, en **bits** par seconde : kb/s, Mb/s, Gb/s (en réseau, k vaut 1 000). Les fichiers, eux, se comptent en **octets** (o, ou B en anglais) : 1 octet = 8 bits. Un fichier de 100 Mo, c'est 800 Mb : au moins 0,8 s sur un lien à 1 Gb/s, plutôt 0,9 s avec les en-têtes. Il faut distinguer le débit **du lien** (ce qu'il peut porter), le débit **utile** (sans les en-têtes) et la **charge** (ce qui passe vraiment, en % du lien).

**La latence** (le retard) est le temps qu'un paquet met d'un bout à l'autre. Elle a quatre parts :
- la **propagation** : la distance à la vitesse du signal, ≈ **5 µs par kilomètre** de fibre ; incompressible ;
- la **sérialisation** : le temps de poser le paquet sur le lien, taille ÷ débit (1 500 octets : 12 µs à 1 Gb/s, 1,2 µs à 10 Gb/s), à chaque saut ;
- la **traversée** de chaque équipement : de l'ordre de la microseconde pour un commutateur, bien plus pour un pare-feu ou un codeur ;
- l'**attente dans les files** des ports engorgés : de zéro à plusieurs millisecondes, et **variable**.
Le **ping** mesure l'aller-retour (RTT) ; la latence dans un sens en est à peu près la moitié, si le chemin est symétrique.

**La gigue** (jitter) est la **variation** de la latence d'un paquet à l'autre. Elle vient surtout des files d'attente : un paquet passe tout de suite, le suivant attend derrière une rafale. Pour un flux temps réel, le récepteur garde un **tampon** qui absorbe la gigue ; il doit être plus long que les plus grands écarts, et il ajoute son propre retard. RTP en donne une mesure normalisée (RFC 3550) : une moyenne glissante des écarts de temps de transit entre paquets successifs. Dans un car ST 2110, on la regarde à l'échelle de la microseconde (temps entre arrivées, IAT ; modèle -21).

**Les pertes** se comptent en pourcentage de paquets. Leurs causes : une file pleine (le port déborde), un câble ou un module abîmé (erreurs FCS), un lien sans fil. TCP les répare en ralentissant ; UDP les laisse passer (un trou dans l'image) ; SRT les redemande dans son tampon.

**Les outils.**
- **ping** : l'aller-retour et les pertes vers une machine (ICMP) ; « ping -c 100 » donne le minimum, la moyenne et le maximum : leur écart trahit la gigue ;
- **traceroute** : les routeurs du chemin, et le temps à chacun ;
- **iperf** : un émetteur et un récepteur qui mesurent le débit réel, en TCP ou en UDP (débit, gigue, pertes) ;
- **Wireshark**, ou l'analyseur du poste Réseau IP : chaque paquet, les pertes et la gigue RTP ;
- les **compteurs** des ports des commutateurs : charge, erreurs, paquets jetés.`,
  plus: `- Le **bufferbloat** : une file trop grande dans une box évite les pertes mais crée des centaines de millisecondes de retard dès que le lien se remplit (un téléchargement fait exploser le ping).
- Un lien de 1 Gb/s chargé à 50 % en moyenne peut déborder pendant quelques microsecondes : les **micro-rafales** ne se voient pas sur une moyenne par seconde, mais dans les compteurs de paquets jetés.
- On mesure toujours dans les conditions du direct : même heure, même débit, même chemin ; un ping la veille à minuit ne prouve rien.`,
  car: { text: 'Au poste Réseau IP (car IP), les mesures de chaque flux : débit, gigue et temps entre arrivées, pertes réparées par l\'autre réseau, latence ; au poste Réseau (car SDI), le ping et la charge des liens montants. La leçon « Le rythme d\'envoi : ST 2110-21 » détaille la gigue d\'un flux non compressé.', station: 'reseau' },
  terms: ['debit', 'latence', 'gigue', 'pertes', 'ping', 'traceroute'],
  competences: ['1.2', '2.13', '3.6'], article: 'reseau',
  quiz: [
    { q: 'Combien de temps faut-il au moins pour transférer un fichier de 100 Mo sur un lien à 1 Gb/s ?',
      choices: [['0,1 s', 'C\'est confondre octets et bits : 100 Mo font 800 Mb.'], 'Environ 0,8 s', ['100 s', 'Mille fois trop : 1 Gb/s, c\'est 1 000 Mb par seconde.']],
      answer: 1, why: '100 Mo × 8 = 800 Mb ; à 1 000 Mb/s : 0,8 s, un peu plus avec les en-têtes.' },
    { q: 'Qu\'est-ce que la gigue ?',
      choices: [['Le retard moyen d\'un paquet', 'C\'est la latence. La gigue est sa variation.'], 'La variation du retard d\'un paquet à l\'autre', ['Le pourcentage de paquets perdus', 'Ce sont les pertes, un autre chiffre.']],
      answer: 1, why: 'Des paquets envoyés régulièrement arrivent irrégulièrement : c\'est la gigue, surtout due aux files d\'attente. Un tampon de réception l\'absorbe.' },
    { q: 'D\'où vient surtout la gigue sur un réseau ?',
      choices: [['De la propagation dans la fibre', 'Elle est constante : la même distance prend toujours le même temps.'], ['De la couleur de la lumière', 'La longueur d\'onde ne fait pas varier le retard de façon notable à ces distances.'], 'De l\'attente variable dans les files des ports encombrés'],
      answer: 2, why: 'La propagation, la sérialisation et la traversée des équipements sont à peu près constantes ; l\'attente dans les files, elle, dépend de ce qui passe au même moment.' },
    { q: 'Le ping vers la régie donne : minimum 9 ms, moyenne 11 ms, maximum 85 ms. Qu\'en conclure ?',
      choices: ['Le chemin est court, mais une file se remplit par moments : forte gigue', ['Le chemin fait 85 ms', 'Le minimum dit le temps du chemin sans attente ; le maximum dit l\'attente occasionnelle.'], ['Le ping est en panne', 'Ces valeurs sont cohérentes : elles décrivent un chemin encombré par moments.']],
      answer: 0, why: 'Le minimum mesure le chemin (propagation, équipements) ; l\'écart avec le maximum, l\'attente dans les files : il faudra un tampon d\'au moins 80 ms, ou trouver ce qui encombre.' },
    { q: 'Quel outil mesure le débit réellement disponible entre deux machines ?',
      choices: [['ping', 'ping mesure l\'aller-retour et les pertes, pas le débit.'], ['traceroute', 'traceroute montre le chemin et le temps à chaque saut.'], 'iperf'],
      answer: 2, why: 'iperf envoie un flux d\'une machine à l\'autre et mesure ce qui passe, en TCP ou en UDP (avec gigue et pertes).' },
    { q: 'Combien de temps faut-il pour poser une trame de 1 500 octets sur un lien à 10 Gb/s ?',
      choices: ['1,2 µs', ['12 µs', 'C\'est à 1 Gb/s.'], ['5 µs', 'C\'est la propagation d\'un kilomètre de fibre, une autre part de la latence.']],
      answer: 0, why: '1 500 × 8 = 12 000 bits ; à 10 milliards de bits par seconde : 1,2 µs. C\'est la sérialisation, à chaque saut.' },
  ],
};

// ======================================================================================
// La qualité de service
// ======================================================================================
function figQos() {
  const f = figure(440, 214, 'Un port de sortie engorgé : les paquets arrivent marqués (DSCP), le commutateur les range dans une file par classe ; l\'ordonnanceur sert d\'abord la file prioritaire (PTP), puis les médias, puis les commandes, puis le reste. Quand une file déborde, ses paquets sont jetés.');
  const Q = [['PTP · EF 46', '#ff9a8a', 2], ['Médias · AF41 34', '#7fd3f3', 5], ['Commandes · CS4 32', '#7fd1a0', 3], ['Au mieux · DF 0', '#9aa4ad', 8]];
  f.append(sv('text', { x: 10, y: 16, class: 'co-t' }, 'Arrivées marquées'), sv('text', { x: 180, y: 16, class: 'co-t' }, 'Files du port de sortie'), sv('text', { x: 360, y: 16, class: 'co-t' }, 'Lien'));
  for (const [i, [n, c, k]] of /** @type {[string, string, number][]} */ (Q).entries()) {
    const y = 28 + i * 44;
    for (let j = 0; j < 3; j++) f.append(sv('rect', { x: 14 + j * 18, y: y + 6, width: 13, height: 13, rx: 2, fill: c }));
    f.append(sv('line', { x1: 70, y1: y + 12, x2: 150, y2: y + 12, stroke: c, strokeWidth: 1.5 }));
    f.append(sv('rect', { x: 152, y, width: 150, height: 26, rx: 3, fill: '#141b20', stroke: c }));
    for (let j = 0; j < Math.min(k, 8); j++) f.append(sv('rect', { x: 296 - (j + 1) * 17, y: y + 5, width: 14, height: 16, rx: 2, fill: c, opacity: 0.85 }));
    f.append(sv('text', { x: 158, y: y + 37, class: 'co-s' }, n));
    if (k >= 8) f.append(sv('text', { x: 140, y: y + 20, textAnchor: 'end', class: 'co-t', fill: '#ff8a80' }, '✕'));
  }
  f.append(sv('line', { x1: 302, y1: 41, x2: 340, y2: 106, stroke: '#ff9a8a', strokeWidth: 2.5 }), sv('line', { x1: 302, y1: 85, x2: 340, y2: 106, stroke: '#7fd3f3', strokeWidth: 1.5 }), sv('line', { x1: 302, y1: 129, x2: 340, y2: 106, stroke: '#7fd1a0', strokeWidth: 1 }), sv('line', { x1: 302, y1: 173, x2: 340, y2: 106, stroke: '#9aa4ad', strokeWidth: 0.6, 'stroke-dasharray': '3 3' }));
  f.append(sv('circle', { cx: 346, cy: 106, r: 9, fill: '#1a2229', stroke: '#ffd38a' }), sv('line', { x1: 355, y1: 106, x2: 432, y2: 106, stroke: '#ffd38a', strokeWidth: 3 }), sv('text', { x: 392, y: 98, textAnchor: 'middle', class: 'co-s' }, '1 Gb/s'));
  f.append(sv('text', { x: 392, y: 130, textAnchor: 'middle', class: 'co-s' }, 'priorité'), sv('text', { x: 392, y: 144, textAnchor: 'middle', class: 'co-s' }, 'stricte'), sv('text', { x: 140, y: 210, textAnchor: 'middle', class: 'co-s' }, 'la file « au mieux » déborde : ses paquets sont jetés'));
  return f;
}
function demoQos(host) {
  let media = 600, fichiers = 500, mode = 'prio';
  const bars = el('div', { class: 'co-hbars' });
  const verdict = el('p', { class: 'co-verdict' });
  const draw = () => {
    const offert = { ptp: 1, media, commande: 20, fichiers };
    const Q = filesQos(offert, 1000, /** @type {'fifo' | 'prio'} */ (mode));
    const col = { ptp: '#ff9a8a', media: '#7fd3f3', commande: '#7fd1a0', fichiers: '#9aa4ad' };
    bars.replaceChildren(el('p', { class: 'co-note' }, `Offert au port : ${fmtNum(Q.total)} Mb/s pour 1 000 Mb/s (${fmtNum(Q.charge * 100)} %).`),
      ...Object.entries(Q.classes).map(([k, c]) => bar(`${CLASSES[k].nom} · ${CLASSES[k].phb} ${CLASSES[k].dscp}`, c.servi, Math.max(c.offert, 1), col[k], `${fmtNum(c.servi, c.servi < 10 ? 1 : 0)} / ${fmtNum(c.offert)} Mb/s · pertes ${fmtNum(c.pertePct, 0)} % · attente ${c.retardMs ? fmtNum(c.retardMs, 1) + ' ms' : '≈ 0'}`)));
    const P = Q.classes.ptp, M = Q.classes.media;
    if (Q.charge <= 1) { verdict.textContent = 'Le port ne déborde pas : tout passe, la QoS n\'a rien à faire. C\'est l\'état normal d\'un réseau bien dimensionné.'; verdict.className = 'co-verdict ok'; }
    else if (mode === 'fifo') { verdict.textContent = `Une seule file : tout le monde perd ${fmtNum(P.pertePct, 0)} % et attend ${fmtNum(P.retardMs, 1)} ms derrière la file pleine. Pour PTP, des millisecondes d'attente variable, c'est une horloge qui dérive.`; verdict.className = 'co-verdict ko'; }
    else if (M.perdu > 0) { verdict.textContent = 'Même avec la priorité, les médias seuls dépassent le lien : la QoS ne crée pas de débit. Il faut un lien plus rapide ou moins de flux.'; verdict.className = 'co-verdict ko'; }
    else { verdict.textContent = 'Priorité stricte : PTP, les médias et les commandes passent intacts ; seule la classe « au mieux » perd ce qui dépasse. C\'est le rôle de la QoS.'; verdict.className = 'co-verdict ok'; }
  };
  host.append(el('div', { class: 'co-ctl' },
    slider('Médias (vidéo, son)', 0, 1100, media, 10, (v) => { media = v; draw(); }, (v) => `${v} Mb/s`),
    slider('Copies de fichiers', 0, 1000, fichiers, 10, (v) => { fichiers = v; draw(); }, (v) => `${v} Mb/s`),
    choice('Le port', [['fifo', 'une seule file'], ['prio', 'QoS : files et priorité stricte']], mode, (v) => { mode = v; draw(); })),
  bars, verdict);
  draw();
}

/** @type {import('./index.js').Lesson} */
export const QOS = {
  id: 'reseau-qos', title: 'La qualité de service (QoS) : classer, marquer, prioriser', minutes: '8 min',
  essentials: [
    'Quand un port de sortie reçoit plus qu\'il ne peut envoyer, les paquets **attendent** dans une file, puis sont **jetés** : la QoS décide **qui passe d\'abord** et **qui perd**.',
    'On **classe** et on **marque** chaque paquet (**DSCP**, 6 bits dans l\'en-tête IP : EF 46 pour PTP, AF41 34 pour les médias ; ou **CoS**, 3 bits dans l\'étiquette VLAN) ; le commutateur range chaque classe dans sa **file**.',
    'La QoS ne crée pas de débit : elle protège l\'horloge, la voix et les commandes quand ça déborde. Un réseau média se **dimensionne** d\'abord pour ne pas déborder.',
  ],
  figure: figQos,
  demoTitle: 'Monte les copies de fichiers et les médias au-delà du lien, avec une seule file puis avec la QoS : regarde qui perd et qui attend.',
  demo: demoQos,
  body: `Un commutateur reçoit des paquets sur plusieurs ports et les renvoie sur un autre. Si plusieurs entrées visent la même sortie (trois caméras vers un multiview, une copie de fichiers vers le NAS pendant le direct), le port de sortie reçoit plus qu'il ne peut envoyer : c'est la **congestion**. Les paquets en trop **attendent** dans une **file**, ce qui ajoute du retard et de la gigue ; quand la file est pleine, les suivants sont **jetés**. Sans réglage, la file est unique et tout le monde subit : le message PTP attend derrière une rafale de fichiers.

**La qualité de service (QoS)** organise cette attente en trois gestes.
- **Classer et marquer** : chaque paquet porte sa classe. En **DSCP** (6 bits de l'en-tête IP, DiffServ) : **EF 46** (Expedited Forwarding, priorité absolue : PTP, la voix), **AF41 34** (médias), **CS4 32** (commandes, temps réel interactif), **CS2 16** (gestion), **DF 0** (au mieux), **CS1 8** (ce qui peut attendre). Ou en **CoS** (3 bits de priorité dans l'étiquette VLAN 802.1Q, de 0 à 7). L'appareil marque en émettant ; le commutateur **fait confiance** au marquage (« trust dscp ») ou le réécrit à l'entrée du réseau.
- **Ranger** : le port de sortie a plusieurs **files** (souvent 8, les « traffic classes ») ; une table dit dans quelle file va chaque valeur de DSCP.
- **Servir** : l'**ordonnanceur** choisit la file qui envoie. En **priorité stricte**, la file prioritaire passe toujours la première : idéal pour PTP et la voix, peu gourmands. En **partage pondéré** (WRR, DWRR), chaque file reçoit une part garantie du débit. Quand une file déborde, on jette ses paquets (perte en queue, ou WRED qui jette un peu avant).

**Ce que recommandent les normes du car IP.** AES67 et ST 2110 marquent **PTP en EF (46)** et les **médias en AF41 (34)**. Dans les commutateurs, PTP va dans une file en priorité stricte : un message Sync qui attend quelques microsecondes derrière une vidéo fausse la mesure du délai et fait dériver toutes les horloges (les horloges frontières limitent le problème). Dans le car SDI, le réseau de contrôle classe aussi par usage : voix de l'intercom en EF, commandes et tally en CS4, gestion en CS2, données au mieux, fichiers et Internet en CS1.

**Ce que la QoS ne fait pas.** Elle ne crée pas de débit : si les médias seuls dépassent le lien, ils perdent des paquets quoi qu'on règle. Un réseau ST 2110 se **dimensionne** pour ne jamais déborder (contrôle des réservations, liens surdimensionnés) ; la QoS reste une assurance pour l'horloge et les commandes. Et sur Internet, personne ne respecte ton marquage : la QoS ne vaut que sur un réseau que l'on maîtrise.

**Deux autres outils.** Le **policing** coupe ce qui dépasse un débit convenu (un invité limité à 20 Mb/s) ; le **shaping** lisse un envoi en le retardant pour ne pas dépasser un débit (un encodeur qui sort vers une liaison louée).`,
  plus: `- En 802.1p, la CoS 1 (« arrière-plan ») passe **après** la CoS 0 (« au mieux ») : un piège classique.
- Une priorité stricte sans limite peut affamer les autres files : on la réserve à des flux petits et réguliers (PTP, voix), parfois avec un plafond.
- La « frontière de confiance » : au bord du réseau, on réécrit le DSCP de ce qui vient d'appareils non maîtrisés, sinon n'importe quel portable pourrait se marquer EF.
- Pour vérifier : la table DSCP → file du commutateur, et les compteurs de paquets jetés par file.`,
  car: { text: 'Au poste Réseau IP (car IP) : « show qos maps » affiche la table DSCP → file ; « qos trust dscp » fait respecter le marquage, « qos map dscp 46 to traffic-class 7 » met PTP en priorité stricte. Une panne joue PTP laissé dans la file par défaut. Au poste Réseau (car SDI), chaque VLAN a sa classe (voix EF, commande CS4, gestion CS2, données, fichiers CS1) et les pertes se lisent par classe.', station: 'reseau' },
  terms: ['qos', 'cos', 'gigue', 'ptp', 'pertes', 'charge'],
  competences: ['1.2', '3.6', '3.12'], article: 'reseau',
  quiz: [
    { q: 'Quand la QoS a-t-elle un effet ?',
      choices: [['Tout le temps : elle accélère les paquets prioritaires', 'Un paquet ne va jamais plus vite que le lien ; sans file d\'attente, l\'ordre de service ne change rien.'], 'Quand un port de sortie est engorgé : elle décide qui passe d\'abord et qui perd', ['Seulement sur Internet', 'C\'est l\'inverse : sur Internet, personne ne respecte ton marquage.']],
      answer: 1, why: 'Sans congestion, tout passe aussitôt. La QoS n\'agit que lorsque des paquets attendent : elle range et ordonne l\'attente.' },
    { q: 'Quelle valeur DSCP AES67 et ST 2110 recommandent-ils pour PTP ?',
      choices: ['46 (EF)', ['34 (AF41)', 'C\'est la valeur des médias.'], ['0 (au mieux)', 'PTP y attendrait derrière tout le reste : l\'horloge dériverait.']],
      answer: 0, why: 'PTP en EF 46, dans une file en priorité stricte ; les médias en AF41 34.' },
    { q: 'Où se trouve le marquage DSCP ?',
      choices: [['Dans l\'adresse MAC', 'La MAC désigne une carte ; elle ne porte pas de priorité.'], 'Dans l\'en-tête IP (6 bits)', ['Dans le numéro de port', 'Le port désigne un service ; le marquage est dans l\'en-tête IP.']],
      answer: 1, why: 'Le DSCP occupe 6 bits de l\'octet de service de l\'en-tête IP. La CoS, elle, est sur 3 bits dans l\'étiquette VLAN.' },
    { q: 'Les médias seuls demandent 1,1 Gb/s sur un lien de 1 Gb/s, QoS bien réglée. Que se passe-t-il ?',
      choices: [['Rien : les médias sont prioritaires, ils passent', 'La priorité ne crée pas de débit : 1,1 Gb/s ne tient pas dans 1 Gb/s.'], 'Les médias perdent des paquets : la QoS ne crée pas de débit', ['Le commutateur compresse la vidéo', 'Un commutateur ne compresse rien.']],
      answer: 1, why: 'La QoS protège les classes prioritaires des autres classes, pas d\'elles-mêmes. Il faut un lien plus rapide : un réseau média se dimensionne pour ne pas déborder.' },
    { q: 'Un commutateur du car IP a perdu la ligne « qos map dscp 46 to traffic-class 7 ». Quel symptôme attendre quand le trafic monte ?',
      choices: [['Les flux vidéo s\'arrêtent', 'Ils continuent : c\'est l\'horloge qui souffre.'], 'PTP attend dans la file par défaut : l\'offset des horloges se met à varier', ['Rien, PTP passe toujours en priorité', 'Sans cette ligne, PTP est rangé avec le reste.']],
      answer: 1, why: 'PTP mesure le délai du réseau : une attente variable dans une file fausse la mesure et l\'offset des appareils s\'agite. On remet PTP dans la file prioritaire.' },
    { q: 'Que fait le « policing » ?',
      choices: [['Il lisse un envoi en le retardant', 'C\'est le shaping.'], ['Il chiffre le trafic', 'La QoS ne chiffre rien.'], 'Il coupe ce qui dépasse un débit convenu'],
      answer: 2, why: 'Le policing jette (ou déclasse) ce qui dépasse un débit ; le shaping retarde pour lisser. On limite ainsi un invité ou un service à sa part.' },
  ],
};

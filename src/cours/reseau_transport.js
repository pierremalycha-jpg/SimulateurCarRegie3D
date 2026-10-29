// @ts-check
import { el } from '../util.js';
import { sv, figure, choice, slider, readout, fmtNum } from './kit.js';
import { debitTcp, pertesUdp, latenceSrt, PROTOCOLES } from './ip_calc.js';

// ----------------------------------------------------------------------------------
// Chapitre « Le réseau », partie « Transporter » : TCP et UDP (connexion, accusés, retransmission, ports ; débit
// d'une connexion TCP qui perd, formule de Mathis), puis les protocoles du streaming (RTP, SRT, RIST, RTMP, HLS,
// WebRTC, NDI ; contribution et distribution). Calculs : cours/ip_calc.js.
// Normes : RFC 9293 (TCP), 768 (UDP), 3550 (RTP), 8216 (HLS) ; VSF TR-06 (RIST) ; SRT (Haivision) ; Mathis et al.
// (1997) pour le débit de TCP avec pertes ; latence SRT conseillée : guide de déploiement de Haivision.
// ----------------------------------------------------------------------------------

// ======================================================================================
// TCP et UDP
// ======================================================================================
function figTcp() {
  const f = figure(440, 230, 'À gauche, TCP : la poignée de main en trois messages, puis des segments acquittés ; le segment 2 se perd, le récepteur répète son accusé, l\'émetteur le renvoie et tout arrive dans l\'ordre, en retard. À droite, UDP : des datagrammes envoyés à intervalle régulier ; le 3 se perd et ne revient jamais, il manque à l\'arrivée.');
  const lane = (x0, x1, t1, t2) => { f.append(sv('text', { x: x0, y: 14, textAnchor: 'middle', class: 'co-t' }, t1), sv('text', { x: x1, y: 14, textAnchor: 'middle', class: 'co-t' }, t2), sv('line', { x1: x0, y1: 20, x2: x0, y2: 226, stroke: '#3a4650' }), sv('line', { x1: x1, y1: 20, x2: x1, y2: 226, stroke: '#3a4650' })); };
  const fl = (xa, xb, y, t, col, perdu = false, dy = 10) => {
    const xe = perdu ? xa + (xb - xa) * 0.55 : xb, ye = perdu ? y + dy * 0.55 : y + dy;
    f.append(sv('line', { x1: xa, y1: y, x2: xe, y2: ye, stroke: col, strokeWidth: 1.6 }));
    if (perdu) f.append(sv('text', { x: xe, y: ye + 4, textAnchor: 'middle', class: 'co-t', fill: '#ff8a80' }, '✕'));
    else f.append(sv('circle', { cx: xe, cy: ye, r: 2.4, fill: col }));
    // l'étiquette au-dessus du trait, détourée pour rester lisible sur les autres flèches
    f.append(sv('text', { x: (xa + xe) / 2, y: Math.min(y, ye) - 3, textAnchor: 'middle', class: 'co-s', fill: col, stroke: '#0b0f13', 'stroke-width': 3, 'paint-order': 'stroke' }, t));
  };
  lane(26, 190, 'émetteur', 'récepteur');
  const B = '#7fd3f3', A = '#ffd38a';
  fl(22, 190, 28, 'SYN', B); fl(190, 22, 46, 'SYN-ACK', A); fl(22, 190, 64, 'ACK', B);
  fl(22, 190, 88, 'segment 1', B); fl(22, 190, 104, 'segment 2', B, true); fl(22, 190, 120, 'segment 3', B);
  fl(190, 22, 136, 'accusé : j\'attends 2', A); fl(190, 22, 152, 'encore : j\'attends 2', A);
  fl(22, 190, 172, 'segment 2 renvoyé', '#ff9a8a'); fl(190, 22, 192, 'accusé : j\'attends 4', A);
  f.append(sv('text', { x: 106, y: 222, textAnchor: 'middle', class: 'co-s' }, 'tout arrive, dans l\'ordre, en retard'));
  lane(250, 404, 'émetteur', 'récepteur');
  for (let k = 1; k <= 7; k++) fl(250, 404, 16 + k * 24, `datagramme ${k}`, '#7fd1a0', k === 3, 12);
  f.append(sv('text', { x: 327, y: 222, textAnchor: 'middle', class: 'co-s' }, 'le 3 manque pour toujours ; rien n\'attend'));
  return f;
}
function demoTcp(host) {
  let rtt = 40, perte = 0.5, lien = 1000, flux = 10;
  const R = readout(['TCP : débit atteignable', 'TCP : fichier de 1 Go', 'TCP : une perte coûte', 'UDP : flux de 10 Mb/s', 'UDP : une perte coûte']);
  const verdict = el('p', { class: 'co-verdict' });
  const draw = () => {
    const d = debitTcp(rtt, perte / 100, lien), u = pertesUdp(flux, perte / 100);
    R.set('TCP : débit atteignable', `${fmtNum(d, d < 10 ? 1 : 0)} Mb/s sur un lien de ${lien} Mb/s${d < lien * 0.99 ? ' (limité par les pertes et l\'aller-retour)' : ''}`);
    const s = 8000 / d; // 1 Go = 8 000 Mb
    R.set('TCP : fichier de 1 Go', s < 120 ? `${fmtNum(s, 1)} s` : `${fmtNum(s / 60, 1)} min`);
    R.set('TCP : une perte coûte', `au moins un aller-retour (${rtt} ms) d'attente pour tout ce qui suit, et un débit réduit de moitié`);
    R.set('UDP : flux de 10 Mb/s', `${fmtNum(u.pps, 0)} paquets/s, ${fmtNum(u.perdusS, u.perdusS < 10 ? 1 : 0)} perdus par seconde, débit et retard inchangés`);
    R.set('UDP : une perte coûte', u.perdusS ? 'un trou dans l\'image ou le son, sans retard ; à réparer par l\'application (FEC, retransmission SRT)' : 'rien : aucun paquet perdu');
    const ok = d >= flux * 1.25;
    verdict.textContent = perte === 0 ? 'Sans perte, TCP remplit le lien et UDP passe intact.' : ok ? `TCP tient encore un flux de ${flux} Mb/s (${fmtNum(d, 0)} Mb/s possibles), mais chaque perte le retarde d'un aller-retour.` : `TCP ne tient plus un flux de ${flux} Mb/s : ${fmtNum(d, 1)} Mb/s seulement. Un direct en TCP prend du retard puis décroche ; en UDP, il passe avec des trous, que SRT ou RIST savent réparer.`;
    verdict.className = 'co-verdict ' + (perte === 0 || ok ? 'ok' : 'ko');
  };
  host.append(el('div', { class: 'co-ctl' },
    slider('Aller-retour (RTT)', 1, 300, rtt, 1, (v) => { rtt = v; draw(); }, (v) => `${v} ms`),
    slider('Pertes', 0, 5, perte, 0.1, (v) => { perte = v; draw(); }, (v) => `${fmtNum(v, 1)} %`),
    choice('Lien', [['10', '10 Mb/s'], ['100', '100 Mb/s'], ['1000', '1 Gb/s']], String(lien), (v) => { lien = +v; draw(); })),
  R.el, verdict);
  draw();
}

/** @type {import('./index.js').Lesson} */
export const TCP_UDP = {
  id: 'reseau-tcp-udp', title: 'TCP et UDP : la fiabilité ou le temps réel', minutes: '8 min',
  essentials: [
    '**TCP** ouvre une connexion (SYN, SYN-ACK, ACK), numérote, attend des **accusés de réception** et **retransmet** ce qui manque : tout arrive, dans l\'ordre, mais en retard quand le réseau perd.',
    '**UDP** envoie des datagrammes sans connexion ni accusé : rien n\'est réémis, le débit et le retard restent constants. C\'est le transport du temps réel : RTP, ST 2110, SRT, PTP, DNS.',
    'Un **port** (0 à 65 535) désigne le service dans la machine : 443 le web chiffré, 53 le DNS, 319 et 320 PTP, 1935 RTMP, 5004 RTP. Adresse et port forment une **socket**.',
  ],
  figure: figTcp,
  demoTitle: 'Allonge l\'aller-retour, ajoute des pertes : regarde le débit de TCP s\'effondrer pendant qu\'UDP garde son rythme, avec des trous.',
  demo: demoTcp,
  body: `La couche **transport** (niveau 4) livre les données au bon logiciel de la machine, désigné par son **port**. Deux protocoles s'y partagent presque tout le trafic, avec deux philosophies opposées.

**TCP** (Transmission Control Protocol) garantit que tout arrive, intact et dans l'ordre.
- Il ouvre une **connexion** : SYN (« je veux te parler »), SYN-ACK (« d'accord »), ACK (« c'est parti ») : la poignée de main en trois temps, un aller-retour avant le premier octet utile.
- Il **numérote** chaque octet ; le récepteur renvoie des **accusés de réception** (« j'ai tout jusqu'à tel numéro »).
- Ce qui n'est pas acquitté à temps est **retransmis**. Trois accusés identiques signalent un trou : l'émetteur renvoie le segment manquant sans attendre.
- Une **fenêtre** limite ce qui peut voyager sans accusé (contrôle de flux) et le **contrôle de congestion** divise le débit dès qu'une perte est vue, puis le remonte doucement.
En-tête : 20 octets au moins.

Le prix : **le retard**. Quand un segment se perd, tout ce qui suit attend sa retransmission, au moins un aller-retour de plus : c'est le **blocage en tête de file**. Et sur un long chemin qui perd, le débit s'effondre. La **formule de Mathis** en donne l'ordre de grandeur : débit ≈ (taille d'un segment ÷ aller-retour) × 1,22 ÷ √pertes. À 100 ms d'aller-retour et 1 % de pertes, une connexion TCP plafonne vers **1,4 Mb/s**, même sur une fibre à 10 Gb/s. C'est pourquoi un direct en TCP sur Internet prend du retard puis décroche.

**UDP** (User Datagram Protocol) ne fait presque rien : il ajoute les ports et une somme de contrôle (8 octets d'en-tête) et envoie. Pas de connexion, pas d'accusé, pas de retransmission, pas d'ordre garanti. Un datagramme perdu est perdu : l'image ou le son ont un trou, mais le flux garde son **rythme** et son **retard**. Pour le temps réel, c'est exactement ce qu'il faut : une image qui arrive après son tour ne sert plus à rien. L'application ajoute ce dont elle a besoin : RTP numérote et horodate les paquets (pour repérer une perte et réaligner), ST 2022-7 double le flux sur deux réseaux, SRT et RIST redemandent les paquets perdus dans un tampon de latence borné.

**Qui utilise quoi.**
- **TCP** : le web (HTTP, HTTPS), les transferts de fichiers, SSH, les API NMOS, la plupart des protocoles de commande, RTMP, HLS.
- **UDP** : RTP et donc ST 2110, SRT, RIST, PTP (ports 319 et 320), DNS (port 53), DHCP, NTP (123), TSL UMD, la plupart des protocoles de tally et d'intercom sur IP.

**Les ports.** Un numéro de 0 à 65 535 qui désigne le service dans la machine ; 0 à 1023 sont réservés aux services connus. Une connexion est identifiée par cinq éléments : protocole, adresse et port source, adresse et port de destination. Un pare-feu filtre par port ; une traduction d'adresses change le port source.`,
  plus: `- Le web récent (HTTP/3) passe par **QUIC**, un transport fiable construit sur UDP : la fiabilité de TCP, sans son blocage en tête de file.
- La fenêtre de réception limite aussi le débit : sans l'option d'agrandissement, 64 Ko par aller-retour, soit 5,2 Mb/s à 100 ms.
- Tester un port TCP : « nc -vz adresse port » ou « Test-NetConnection » sous Windows. Un port UDP se teste mal : pas de réponse ne veut pas dire fermé.
- Les numéros de séquence RTP (16 bits) servent au récepteur à compter les pertes : c'est la mesure « pertes » du poste Réseau IP.`,
  car: { text: 'Au poste Réseau IP (car IP), l\'analyseur montre les flux médias en UDP (port 5004, RTP), PTP sur les ports 319 et 320 ; les API NMOS et les interfaces web des appareils passent en TCP. Les pertes d\'un flux se lisent dans ses numéros de séquence RTP.', station: 'reseau' },
  terms: ['tcp', 'udp', 'port', 'rtp', 'pertes', 'latence'],
  competences: ['2.11', '3.6', '2.10'], article: 'reseau',
  quiz: [
    { q: 'Par quels messages TCP ouvre-t-il une connexion ?',
      choices: ['SYN, SYN-ACK, ACK', ['Discover, Offer, Request, Ack', 'C\'est le DHCP, qui donne une adresse.'], ['Sync, Follow_Up, Delay_Req', 'Ce sont des messages PTP, qui mesurent l\'heure.']],
      answer: 0, why: 'La poignée de main en trois temps : un aller-retour avant le premier octet utile.' },
    { q: 'Un segment TCP se perd. Que se passe-t-il ?',
      choices: [['Rien : le récepteur continue sans lui', 'C\'est le comportement d\'UDP. TCP garantit que tout arrive.'], 'Il est retransmis, et tout ce qui le suit attend : au moins un aller-retour de retard', ['La connexion est coupée et rouverte', 'Une perte isolée est réparée sans couper la connexion.']],
      answer: 1, why: 'TCP livre dans l\'ordre : le récepteur garde ce qui suit en attendant le segment manquant. D\'où un retard d\'au moins un aller-retour, et un débit réduit par le contrôle de congestion.' },
    { q: 'Pourquoi les flux ST 2110 passent-ils en UDP plutôt qu\'en TCP ?',
      choices: [['Parce qu\'UDP est plus fiable', 'C\'est l\'inverse : UDP ne garantit rien.'], ['Parce que TCP ne sait pas faire de gros débits', 'TCP remplit sans peine un lien sans pertes ; le problème est ailleurs.'], 'Parce qu\'une image en retard ne sert plus : on préfère un rythme constant, et le multicast n\'existe qu\'en UDP'],
      answer: 2, why: 'TCP retarderait tout le flux à chaque perte, et une connexion TCP relie deux machines seulement : elle ne peut pas être multicast. La fiabilité vient des deux réseaux (ST 2022-7).' },
    { q: 'À 100 ms d\'aller-retour et 1 % de pertes, quel débit une connexion TCP atteint-elle à peu près, sur un lien à 1 Gb/s ?',
      choices: [['1 Gb/s', 'Ce serait sans pertes. Chaque perte divise le débit par deux.'], 'De l\'ordre de 1,4 Mb/s', ['De l\'ordre de 100 Mb/s', 'Encore très optimiste : à ce RTT et ce taux de pertes, TCP plafonne bien plus bas.']],
      answer: 1, why: 'Formule de Mathis : (1 460 × 8 bits ÷ 0,1 s) × 1,22 ÷ √0,01 ≈ 1,4 Mb/s. C\'est pourquoi on évite TCP pour un direct sur un chemin long qui perd.' },
    { q: 'Sur quels ports passe PTP ?',
      choices: ['319 et 320, en UDP', ['80 et 443, en TCP', 'Ce sont les ports du web.'], ['5004, en UDP', 'C\'est le port des flux RTP du car.']],
      answer: 0, why: 'PTP envoie ses messages d\'événement (Sync, Delay_Req) sur le port UDP 319 et ses messages généraux (Follow_Up, Announce) sur le 320.' },
    { q: 'Que contient un en-tête UDP ?',
      choices: [['Un numéro de séquence et un horodatage', 'C\'est l\'en-tête RTP, posé au-dessus d\'UDP.'], 'Les ports source et destination, la longueur et une somme de contrôle : 8 octets', ['Les adresses MAC', 'Elles sont dans la trame Ethernet, deux couches plus bas.']],
      answer: 1, why: 'UDP est minimal : ports, longueur, contrôle. Tout le reste (numéros, horodatage, réparation) est l\'affaire de l\'application.' },
  ],
};

// ======================================================================================
// Les protocoles du streaming
// ======================================================================================
function figStreaming() {
  const f = figure(440, 206, 'La chaîne d\'un direct : dans le car, ST 2110 ; vers la régie finale, la contribution par fibre managée (RTP) ou par Internet (SRT, RIST) ; vers une plateforme, RTMP ; vers les spectateurs, HLS ou DASH par un CDN. Sous chaque étape, sa latence typique.');
  const S = [['Car', 'ST 2110', '< 1 image', '#7fd1a0'], ['Régie finale', 'SRT · RIST · RTP', '0,1 à 1 s', '#7fd3f3'], ['Plateforme', 'RTMP (TCP)', '2 à 5 s', '#ffd38a'], ['Spectateurs', 'HLS · DASH (CDN)', '10 à 30 s', '#d08cff']];
  S.forEach(([t, p, l, c], i) => {
    const x = 6 + i * 110;
    f.append(sv('rect', { x, y: 40, width: 96, height: 52, rx: 6, fill: '#1a2229', stroke: c }), sv('text', { x: x + 48, y: 60, textAnchor: 'middle', class: 'co-t' }, t), sv('text', { x: x + 48, y: 80, textAnchor: 'middle', class: 'co-s' }, p));
    f.append(sv('text', { x: x + 48, y: 112, textAnchor: 'middle', class: 'co-m' }, l));
    if (i < 3) f.append(sv('line', { x1: x + 96, y1: 66, x2: x + 110, y2: 66, stroke: c, strokeWidth: 2 }), sv('polygon', { points: `${x + 110},66 ${x + 104},62 ${x + 104},70`, fill: c }));
  });
  f.append(sv('text', { x: 6, y: 26, class: 'co-t' }, 'contribution'), sv('line', { x1: 6, y1: 30, x2: 212, y2: 30, stroke: '#7fd3f3' }));
  f.append(sv('text', { x: 226, y: 26, class: 'co-t' }, 'distribution'), sv('line', { x1: 226, y1: 30, x2: 434, y2: 30, stroke: '#d08cff' }));
  const L = [['RTP sur UDP', 'réseau managé, multicast, FEC en option'], ['SRT, RIST', 'UDP + retransmission dans un tampon (ARQ)'], ['RTMP', 'TCP port 1935, clé de diffusion'], ['HLS, DASH', 'HTTP, segments de quelques secondes']];
  L.forEach(([a, b], i) => f.append(sv('text', { x: 10 + (i % 2) * 222, y: 140 + Math.floor(i / 2) * 32, class: 'co-t' }, a), sv('text', { x: 10 + (i % 2) * 222, y: 154 + Math.floor(i / 2) * 32, class: 'co-s' }, b)));
  return f;
}
const BESOINS = {
  contribution: { nom: 'Car → régie finale', debit: 20 },
  plateforme: { nom: 'Vers une plateforme', debit: 6 },
  public: { nom: 'Vers le public', debit: 6 },
  interview: { nom: 'Interview à distance', debit: 3 },
  lan: { nom: 'Production légère (LAN)', debit: 130 },
};
const CHEMINS_S = { manage: { nom: 'Réseau managé', rtt: 10, perte: 0 }, internet: { nom: 'Internet fixe', rtt: 30, perte: 0.5 }, mobile: { nom: '4G / 5G', rtt: 60, perte: 2 } };
function demoStreaming(host) {
  let besoin = 'contribution', chemin = 'internet', rtt = 30, perte = 0.5;
  const R = readout(['Protocole conseillé', 'Transport', 'Pertes réparées par', 'Latence typique', 'Débit typique']);
  const calc = el('p', { class: 'co-verdict' });
  const sliders = el('div', { class: 'co-ctl' });
  const mkSliders = () => sliders.replaceChildren(
    slider('Aller-retour (RTT)', 1, 300, rtt, 1, (v) => { rtt = v; draw(); }, (v) => `${v} ms`),
    slider('Pertes', 0, 10, perte, 0.1, (v) => { perte = v; draw(); }, (v) => `${fmtNum(v, 1)} %`));
  const draw = () => {
    const B = BESOINS[besoin];
    const k = besoin === 'contribution' ? (chemin === 'manage' ? 'rtp' : 'srt') : besoin === 'plateforme' ? 'rtmp' : besoin === 'public' ? 'hls' : besoin === 'interview' ? 'webrtc' : 'ndi';
    const P = PROTOCOLES[k];
    R.set('Protocole conseillé', P.nom + (k === 'srt' ? ' (ou RIST)' : ''));
    R.set('Transport', P.transport); R.set('Pertes réparées par', P.repare); R.set('Latence typique', P.latence); R.set('Débit typique', P.debit);
    const tcp = debitTcp(rtt, perte / 100, 1000);
    if (k === 'srt') {
      const s = latenceSrt(rtt, perte);
      calc.textContent = s ? `SRT sur ce chemin : latence conseillée ≈ ${s.latence} ms (${s.mult} × l'aller-retour), et ≈ ${s.surdebit} % de débit en plus pour les retransmissions. En TCP, ce chemin ne donnerait que ${fmtNum(tcp, 1)} Mb/s pour un flux de ${B.debit} Mb/s.` : 'Plus de 40 % de pertes : aucun protocole ne tient, il faut un autre chemin.';
      calc.className = 'co-verdict ' + (s ? 'ok' : 'ko');
    } else if (k === 'rtmp') {
      const ok = tcp >= B.debit * 1.5;
      calc.textContent = `RTMP passe par TCP : sur ce chemin, ≈ ${fmtNum(tcp, 1)} Mb/s possibles pour un flux de ${B.debit} Mb/s. ` + (ok ? 'Ça tient, avec de la marge.' : 'Ça ne tient pas : le direct prendra du retard puis se coupera. Baisse le débit, ou envoie en SRT si la plateforme l\'accepte.');
      calc.className = 'co-verdict ' + (ok ? 'ok' : 'ko');
    } else if (k === 'rtp') {
      calc.textContent = 'Réseau managé : peu ou pas de pertes, débit garanti. RTP sur UDP, avec de la correction en avance (FEC) ou deux chemins (ST 2022-7) pour la sécurité.';
      calc.className = 'co-verdict ok';
    } else {
      calc.textContent = k === 'hls' ? 'Le CDN garde les segments près des spectateurs ; le retard vient des segments (le lecteur en attend plusieurs). Basse latence : 2 à 5 s avec LL-HLS.' : k === 'webrtc' ? 'WebRTC vise moins d\'une seconde : idéal pour qu\'un invité réponde au plateau, au prix d\'une qualité qui s\'adapte au réseau.' : 'NDI reste sur le réseau local : sur un lien Gigabit, quelques sources plein débit suffisent à le remplir.';
      calc.className = 'co-verdict ok';
    }
  };
  host.append(el('div', { class: 'co-ctl' },
    choice('Le besoin', Object.entries(BESOINS).map(([k2, v]) => [k2, v.nom]), besoin, (v) => { besoin = v; draw(); }),
    choice('Le chemin', Object.entries(CHEMINS_S).map(([k2, v]) => [k2, v.nom]), chemin, (v) => { chemin = v; rtt = CHEMINS_S[v].rtt; perte = CHEMINS_S[v].perte; mkSliders(); draw(); })),
  sliders, R.el, calc);
  mkSliders(); draw();
}

/** @type {import('./index.js').Lesson} */
export const STREAMING = {
  id: 'reseau-streaming', title: 'Les protocoles du streaming : RTP, SRT, RIST, RTMP, HLS, NDI', minutes: '9 min',
  essentials: [
    'La **contribution** (du car à la chaîne : haut débit, peu de retard, très fiable) et la **distribution** (vers le public : des millions de lecteurs, quelques secondes admises) n\'emploient pas les mêmes protocoles.',
    'Sur réseau managé : **RTP sur UDP**. Sur Internet : **SRT** ou **RIST**, de l\'UDP qui redemande les paquets perdus dans un tampon de **latence** (de l\'ordre de 3 à 4 fois l\'aller-retour). Vers une plateforme : **RTMP** (TCP). Vers le public : **HLS** ou **DASH** (HTTP, segments).',
    'On choisit avec trois chiffres : la **latence** admise, le **débit** disponible et les **pertes** du chemin. Le protocole n\'est pas le codec : H.264, HEVC ou JPEG XS voyagent dans tous.',
  ],
  figure: figStreaming,
  demoTitle: 'Choisis un besoin et un chemin, règle l\'aller-retour et les pertes : quel protocole, quelle latence SRT, et ce que donnerait TCP.',
  demo: demoStreaming,
  body: `« Streamer », c'est envoyer un flux audio et vidéo en continu sur un réseau IP. Mais d'un bout à l'autre d'un direct, les contraintes changent, et les protocoles avec.

**Deux métiers : contribuer et distribuer.**
- La **contribution** amène le signal du lieu à la chaîne : du car à la régie finale, d'un stade à un studio. Peu de destinataires, une qualité proche de l'original (compression légère, haut débit), une **latence faible** et une **fiabilité** maximale, souvent avec deux chemins.
- La **distribution** emmène le programme vers le public : des millions de lecteurs, une compression forte, et **plusieurs secondes** de retard acceptées.

**Le protocole n'est pas le codec.** Le **codec** compresse l'image (H.264, HEVC, JPEG XS) ; le **conteneur** range image, son et données (MPEG-TS, fragments MP4) ; le **protocole** transporte le tout sur le réseau. Un même flux HEVC en MPEG-TS peut partir en RTP, en SRT ou en RTMP.

**Sur un réseau managé : RTP sur UDP.** RTP numérote et horodate les paquets ; UDP les livre sans attendre. Un réseau d'opérateur ou le LAN d'un car perdent très peu : on ajoute au besoin de la correction en avance (**FEC**, ST 2022-1) ou un second chemin (ST 2022-7). C'est la base de ST 2022-2 (MPEG-TS sur IP) et de ST 2110 (non compressé).

**Sur Internet : SRT et RIST.** Internet ne garantit rien : le débit varie et des paquets se perdent. **SRT** (Secure Reliable Transport, Haivision, logiciel libre) et **RIST** (Reliable Internet Stream Transport, Video Services Forum) partent d'UDP et ajoutent la **retransmission sur demande** (ARQ) : le récepteur signale les numéros manquants, l'émetteur les renvoie. Ils gardent pour cela un **tampon de latence** : 120 ms par défaut pour SRT, à régler de l'ordre de **3 à 4 fois l'aller-retour** quand le chemin perd quelques pour cent, davantage s'il perd plus. Il faut aussi réserver du débit pour les retransmissions. SRT chiffre le flux (AES) et se connecte en mode **caller** (appelle), **listener** (attend sur un port ouvert) ou **rendezvous** (les deux appellent). RIST, normalisé, assure l'interopérabilité entre marques ; il sait agréger plusieurs liens (plusieurs modems 4G, deux accès Internet).

**Vers une plateforme : RTMP.** YouTube, Twitch ou Facebook reçoivent le plus souvent en **RTMP** : une connexion **TCP** sur le port 1935 (RTMPS, chiffré, sur le 443), identifiée par une **clé de diffusion**. TCP répare les pertes en retardant : sur une 4G chargée, le direct prend du retard puis décroche. On envoie nettement sous le débit montant mesuré.

**Vers le public : HLS et DASH.** Le direct est découpé en **segments** de quelques secondes, en plusieurs qualités, décrits par une liste de lecture. Le lecteur les télécharge par HTTP comme des fichiers et change de qualité selon son débit. Un **CDN** (réseau de diffusion de contenu) les garde en cache près des spectateurs. Le retard vient des segments : **10 à 30 s** en général, 2 à 5 s en basse latence.

**Et aussi.** **WebRTC** pour moins d'une seconde dans un navigateur (un invité en duplex) ; **NDI** pour la production légère sur un réseau local (vMix, caméras PTZ), peu compressé, de l'ordre de 100 à 150 Mb/s en 1080p ; **RTSP** pour commander un flux de caméra de surveillance ou PTZ.`,
  plus: `- Budget de latence d'un duplex par Internet : codage (50 à 500 ms selon le codec et son réglage) + tampon SRT + décodage : on mesure le tout, image sur image, avant l'antenne.
- Les unités de transmission « cellulaires » des reporters agrègent plusieurs modems 4G/5G : la vidéo est répartie entre les liens et réassemblée au studio.
- Un flux SRT se règle aussi en débit maximal (pour ne pas saturer le lien avec les retransmissions) et en taille de paquet (1 316 octets : sept paquets MPEG-TS de 188).
- Pour tester un chemin avant une contribution : ping (aller-retour), traceroute (chemin), iperf en UDP (débit et pertes).`,
  car: { text: 'Au poste Transmission : la contribution du car part par la fibre de l\'opérateur (TX1, JPEG XS) et par satellite (TX2, HEVC). À l\'entrepôt, vMix ou une caméra diffusent en RTMP vers une plateforme par le routeur, et des caméras PTZ échangent en NDI|HX. La vue 3D « Du car à la régie finale » montre SRT sur Internet.', station: 'transmission' },
  terms: ['contribution', 'srt', 'rist', 'rtmp', 'hls', 'ndi', 'arq', 'rtp'],
  competences: ['2.11', '3.4', '2.10'], article: 'reseau',
  quiz: [
    { q: 'Pour envoyer le programme du car à la régie finale par Internet, quel protocole choisir ?',
      choices: [['HLS', 'HLS distribue au public avec des dizaines de secondes de retard ; ce n\'est pas un protocole de contribution.'], 'SRT ou RIST', ['RTMP', 'RTMP sert à livrer une plateforme ; en TCP, il souffre des pertes d\'Internet.']],
      answer: 1, why: 'SRT et RIST transportent en UDP et redemandent les paquets perdus dans un tampon de latence borné : faits pour la contribution par Internet.' },
    { q: 'L\'aller-retour vers la régie est de 80 ms, avec 2 % de pertes. Quelle latence SRT viser ?',
      choices: [['20 ms', 'Moins qu\'un aller-retour : aucune retransmission n\'aurait le temps de revenir.'], 'De l\'ordre de 320 ms (environ 4 fois l\'aller-retour)', ['5 s', 'Bien trop : le tampon ajoute ce retard à tout le direct sans rien gagner.']],
      answer: 1, why: 'Chaque réparation coûte au moins un aller-retour. Pour quelques % de pertes, le guide de Haivision conseille de l\'ordre de 4 fois le RTT, soit environ 320 ms ici.' },
    { q: 'Pourquoi un direct en RTMP sur une 4G chargée prend-il du retard ?',
      choices: [['Parce que RTMP compresse plus', 'RTMP ne compresse rien : c\'est le codec qui compresse.'], 'Parce que RTMP passe par TCP, qui retransmet et ralentit à chaque perte', ['Parce que RTMP n\'accepte pas la 4G', 'Il fonctionne en 4G, mais mal quand le lien perd.']],
      answer: 1, why: 'TCP livre tout, dans l\'ordre : une perte retarde ce qui suit et divise le débit. Le direct accumule du retard, puis décroche.' },
    { q: 'D\'où vient le retard de 10 à 30 s d\'un direct regardé en HLS ?',
      choices: ['Des segments de quelques secondes : le lecteur en attend plusieurs avant de commencer', ['De la distance jusqu\'au spectateur', 'La propagation compte en millisecondes, pas en secondes.'], ['Du codage HEVC', 'Le codage coûte au plus quelques centaines de millisecondes.']],
      answer: 0, why: 'Le direct est découpé en segments de 2 à 6 s, et le lecteur en garde plusieurs d\'avance pour ne jamais manquer : d\'où ce retard, réduit en basse latence (LL-HLS).' },
    { q: 'Quelle différence entre un codec et un protocole de streaming ?',
      choices: [['Aucune, ce sont deux noms de la même chose', 'Le codec compresse, le protocole transporte : on peut envoyer le même HEVC en SRT ou en RTMP.'], 'Le codec compresse l\'image (HEVC, JPEG XS) ; le protocole la transporte sur le réseau (SRT, RTMP)', ['Le codec chiffre, le protocole compresse', 'Le chiffrement est une option de certains protocoles (SRT) ; la compression est l\'affaire du codec.']],
      answer: 1, why: 'Codec (compression), conteneur (MPEG-TS) et protocole (transport) sont trois étages indépendants.' },
    { q: 'Le car est derrière une box ; la régie a ouvert et redirigé le port 9000. Quels modes SRT régler ?',
      choices: [['Car en listener, régie en caller', 'La box du car bloquerait l\'appel entrant de la régie.'], ['Les deux en listener', 'Deux côtés qui attendent ne se trouvent jamais.'], 'Car en caller, régie en listener sur le port 9000'],
      answer: 2, why: 'Le côté derrière la box appelle (sa sortie ouvre la ligne) ; le côté qui a un port redirigé écoute.' },
  ],
};

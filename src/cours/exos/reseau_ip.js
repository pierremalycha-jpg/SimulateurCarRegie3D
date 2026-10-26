// @ts-check
import { registerExos, entre, pick, tirer, fr } from '../exo.js';
import { debitTcp, debitFenetre, pertesUdp, latenceSrt, filesQos, CLASSES, fluxParLien, serialisationUs, propagationMs } from '../ip_calc.js';
import { video, audio, modele21, surabonnement, ENTETES } from '../st2110_calc.js';

// ----------------------------------------------------------------------------------
// Exercices en autonomie du chapitre « Le réseau », deuxième moitié : transporter (TCP et UDP, le streaming,
// le multicast), la qualité de service et les mesures, puis le car IP (PTP, ST 2110, le paquet, le rythme,
// rouge et bleu, spine-leaf, NMOS). Les réponses se calculent avec les modèles purs des leçons
// (cours/ip_calc.js, cours/st2110_calc.js) : formule de Mathis, latence SRT conseillée (guide de Haivision),
// files d'attente, paquets ST 2110-20 de 1 200 octets, modèle ST 2110-21, surabonnement d'une leaf.
// ----------------------------------------------------------------------------------
const FORMATS = { '1080i25': '1080i25', '1080p50': '1080p50', '2160p50': '2160p50 (UHD)' };

// ---------------- TCP et UDP ----------------
const TRANSPORTS = [
  { q: 'les messages Sync et Delay_Req du grand maître PTP', t: 'udp', pq: 'Un message PTP en retard fausse la mesure : on ne le renvoie pas, on attend le suivant (8 par seconde).' },
  { q: 'les flux vidéo ST 2110-20 des caméras, envoyés en multicast', t: 'udp', pq: 'Une connexion TCP ne relie que deux machines : elle ne peut pas être multicast, et une image en retard ne sert plus.' },
  { q: 'les requêtes du contrôleur NMOS (API IS-05) vers un récepteur', t: 'tcp', pq: 'Une commande de connexion doit arriver entière et une seule fois : c\'est de l\'HTTP, donc du TCP.' },
  { q: 'l\'envoi du match vers YouTube en RTMP', t: 'tcp', pq: 'RTMP ouvre une connexion TCP sur le port 1935 : TCP répare les pertes en retardant le flux.' },
  { q: 'une question DNS « quelle adresse pour registre.car.local ? »', t: 'udp', pq: 'Une question DNS tient dans un datagramme sur le port 53 : sans réponse, le client repose simplement la question.' },
  { q: 'la copie des clips de l\'EVS vers le serveur de montage', t: 'tcp', pq: 'Un fichier doit arriver complet et dans l\'ordre : peu importe s\'il met une seconde de plus.' },
  { q: 'une contribution SRT du car vers la régie finale', t: 'udp', pq: 'SRT part d\'UDP et redemande lui-même les paquets perdus, dans un tampon de latence borné : il garde le rythme.' },
];
const CH_TRANSPORT = {
  udp: ['UDP', 'UDP n\'a ni connexion ni accusé : rien n\'est garanti, ce qui convient au temps réel mais pas à ce qui doit arriver entier.'],
  tcp: ['TCP', 'TCP retransmet chaque perte et livre dans l\'ordre : tout ce qui suit attend au moins un aller-retour, et une connexion ne relie que deux machines.'],
  icmp: ['ICMP', 'ICMP porte les messages de contrôle du réseau (le ping, « destination injoignable ») : il ne transporte pas les données d\'une application.'],
};
const PORTS = [
  { q: 'les messages d\'événement PTP (Sync, Delay_Req), en UDP', p: 319 },
  { q: 'le DNS', p: 53 },
  { q: 'RTMP, l\'envoi vers une plateforme', p: 1935 },
  { q: 'le web chiffré (HTTPS)', p: 443 },
  { q: 'les flux RTP du car (ST 2110)', p: 5004 },
  { q: 'NTP, l\'heure des ordinateurs', p: 123 },
];

// ---------------- streaming ----------------
const PROTO = {
  srt: ['SRT ou RIST', 'SRT et RIST partent d\'UDP et redemandent les paquets perdus dans un tampon de latence : c\'est la contribution par Internet.'],
  rtp: ['RTP sur UDP, avec FEC ou deux chemins', 'RTP sur UDP ne répare rien lui-même : il suppose un réseau managé qui ne perd presque pas.'],
  rtmp: ['RTMP', 'RTMP passe par TCP (port 1935) : il sert à envoyer vers une plateforme, et prend du retard puis décroche sur un chemin qui perd.'],
  hls: ['HLS ou DASH par un CDN', 'HLS et DASH découpent le direct en segments de quelques secondes : 10 à 30 s de retard, faits pour des millions de spectateurs.'],
  webrtc: ['WebRTC', 'WebRTC vise moins d\'une seconde dans un navigateur, au prix d\'une qualité qui s\'adapte : il ne sert ni à la contribution d\'un match ni au public.'],
  ndi: ['NDI', 'NDI reste sur un réseau local (100 à 150 Mb/s en 1080p) : il ne traverse pas Internet.'],
};
const SCENARIOS = [
  { q: 'Le car envoie le match à la régie finale par Internet, sur l\'accès fibre du stade, qui perd un peu.', ok: 'srt' },
  { q: 'Le car envoie le match à la régie finale par la fibre managée de l\'opérateur, débit garanti.', ok: 'rtp' },
  { q: 'Le club veut le match en direct sur sa chaîne YouTube, depuis le PC vMix de l\'entrepôt.', ok: 'rtmp' },
  { q: 'Les abonnés regardent le match sur l\'application de la chaîne, sur leur téléphone.', ok: 'hls' },
  { q: 'Un consultant intervient en duplex depuis chez lui, dans son navigateur, et doit répondre au plateau sans délai.', ok: 'webrtc' },
  { q: 'À l\'entrepôt, des caméras PTZ et le PC vMix échangent leurs images sur le réseau local Gigabit.', ok: 'ndi' },
];

// ---------------- PTP : l'élection du grand maître (BMCA) ----------------
const TIERS = ['Caméra 4', 'Passerelle IP/SDI', 'Multiviewer', 'Console son'];
/** trois horloges candidates : deux SPG et un appareil laissé par défaut (ou mal réglé) */
function horloges(rnd) {
  const p2 = pick(rnd, [127, 128]);
  const a = { nom: 'SPG principal', p1: 128, classe: pick(rnd, [6, 6, 7]), p2 };
  const b = { nom: 'SPG de secours', p1: 128, classe: pick(rnd, [6, 7]), p2: p2 + 1 };
  const c = { nom: pick(rnd, TIERS), p1: pick(rnd, [128, 128, 100]), classe: 248, p2: 128 };
  return [a, b, c];
}
const avant = (x, y) => x.p1 - y.p1 || x.classe - y.classe || x.p2 - y.p2;
/** pourquoi y perd face au gagnant x */
function perd(y, x) {
  if (y.p1 !== x.p1) return `Sa priorité 1 (${y.p1}) est plus haute que celle de ${x.nom} (${x.p1}) : le BMCA compare d'abord la priorité 1, la plus basse gagne.`;
  if (y.classe !== x.classe) return `À priorité 1 égale, sa classe d'horloge (${y.classe}) est moins bonne que celle de ${x.nom} (${x.classe}) : 6 = calée sur le GPS, 7 = en holdover, 248 = réglage par défaut.`;
  return `Priorité 1 et classe égales : sa priorité 2 (${y.p2}) est plus haute que celle de ${x.nom} (${x.p2}).`;
}

// ---------------- ST 2110 ----------------
const ESSENCES = {
  '20': ['ST 2110-20', 'ST 2110-20 porte la vidéo active non compressée.'],
  '30': ['ST 2110-30', 'ST 2110-30 porte l\'audio PCM (24 bits, 48 kHz), le format d\'AES67.'],
  '40': ['ST 2110-40', 'ST 2110-40 porte les données annexes du SDI : timecode, sous-titres, AFD.'],
  '22': ['ST 2110-22', 'ST 2110-22 porte de la vidéo compressée à débit constant (JPEG XS par exemple).'],
  '10': ['ST 2110-10', 'ST 2110-10 n\'est pas une essence : il fixe la synchronisation (PTP) et l\'horodatage RTP de tous les flux.'],
};
const CONTENUS = [
  { q: 'l\'image de la caméra 3, non compressée, vers le mélangeur', ok: '20' },
  { q: 'les huit canaux du micro d\'ambiance et du commentaire', ok: '30' },
  { q: 'le timecode et les sous-titres qui accompagnent l\'image de la caméra', ok: '40' },
  { q: 'l\'image UHD compressée en JPEG XS vers la régie finale', ok: '22' },
];

// ---------------- NMOS ----------------
const SPECS = {
  'IS-04': ['IS-04', 'IS-04 sert à la découverte et à l\'enregistrement : chaque appareil déclare au registre ses émetteurs et ses récepteurs.'],
  'IS-05': ['IS-05', 'IS-05 sert à la connexion : le contrôleur dit à un récepteur quel émetteur prendre, avec ses paramètres de transport.'],
  'IS-07': ['IS-07', 'IS-07 transporte des événements, comme le tally.'],
  'IS-08': ['IS-08', 'IS-08 décrit la correspondance des canaux audio.'],
};
const BESOINS_NMOS = [
  { q: 'Une passerelle neuve s\'annonce au registre avec ses deux émetteurs et ses quatre récepteurs.', ok: 'IS-04' },
  { q: 'Le contrôleur fait le « take » : l\'entrée 3 du mélangeur prend la caméra 5.', ok: 'IS-05' },
  { q: 'Le rouge du tally doit s\'allumer sur la caméra qui passe à l\'antenne.', ok: 'IS-07' },
  { q: 'L\'ingénieur du son envoie les canaux 3 et 4 d\'un flux audio vers les sorties 1 et 2 d\'une passerelle.', ok: 'IS-08' },
];

registerExos({
  'reseau-tcp-udp': {
    titre: 'TCP ou UDP : choisir et chiffrer',
    consigne: 'Le car envoie des fichiers, des commandes et des flux temps réel : vous dites quel transport convient à chacun, et ce que donne TCP sur un long chemin qui perd.',
    gen: (rnd) => {
      const rtt = pick(rnd, [20, 50, 100, 150, 200]), p = pick(rnd, [0.5, 1, 2]), d = debitTcp(rtt, p / 100, 1000);
      const win = pick(rnd, [{ o: 65535, nom: '64 Ko (65 535 octets, sans l\'option d\'agrandissement)' }, { o: 262144, nom: '256 Kio (262 144 octets)' }]);
      const rtt2 = pick(rnd, [10, 20, 50, 100]), df = debitFenetre(win.o, rtt2);
      const T = pick(rnd, TRANSPORTS), P = pick(rnd, PORTS);
      return [
        {
          type: 'nombre', unite: 'Mb/s', answer: Math.round(d * 100) / 100, tol: d * 0.03,
          q: `Une connexion TCP vers la régie finale : **${rtt} ms** d'aller-retour, **${fr(p, 1)} %** de pertes, segments de 1 460 octets, sur une fibre à 1 Gb/s. Quel débit peut-elle tenir, d'après la formule de Mathis ?`,
          pieges: [{ v: Math.round(d / Math.sqrt(p / 100) * 100) / 100, why: 'Les pertes sont sous une racine carrée : divisez par √p, pas par p.' }, { v: Math.round(d / 8 * 100) / 100, why: 'Le segment fait 1 460 octets : comptez-le en bits (× 8) avant de diviser par l\'aller-retour.' }].filter((x) => Math.abs(x.v - d) > d * 0.05),
          aides: ['Débit ≈ (taille d\'un segment ÷ aller-retour) × 1,22 ÷ √pertes. Le lien à 1 Gb/s ne limite rien ici.', `1 460 × 8 bits ÷ ${fr(rtt / 1000, 3)} s, puis × 1,22 ÷ √${fr(p / 100, 3)}, et divisez par 10⁶ pour des Mb/s.`],
          solution: `(11 680 bits ÷ ${fr(rtt / 1000, 3)} s) × 1,22 ÷ √${fr(p / 100, 3)} ≈ **${fr(d, 2)} Mb/s**, sur une fibre à 1 Gb/s. C'est un ordre de grandeur, mais il dit l'essentiel : un direct en TCP sur un chemin long qui perd prend du retard puis décroche.`,
        },
        pick(rnd, [
          {
            type: 'nombre', unite: 'Mb/s', answer: Math.round(df * 100) / 100, tol: df * 0.02,
            q: `Sans aucune perte, la fenêtre de réception limite aussi TCP : au plus une fenêtre par aller-retour. Fenêtre de **${win.nom}**, aller-retour de **${rtt2} ms** : quel débit au plus ?`,
            pieges: [{ v: Math.round(win.o / (rtt2 / 1000) / 1e6 * 100) / 100, why: 'La fenêtre est en octets : × 8 pour des bits.' }],
            aides: ['Débit = fenêtre ÷ aller-retour.', `${fr(win.o)} octets × 8 ÷ ${fr(rtt2 / 1000, 3)} s, puis ÷ 10⁶.`],
            solution: `${fr(win.o)} × 8 ÷ ${fr(rtt2 / 1000, 3)} = **${fr(df, 2)} Mb/s**, quel que soit le débit de la fibre : d'où l'option d'agrandissement de la fenêtre sur les longs chemins.`,
          },
          {
            type: 'nombre', brut: true, answer: P.p, q: `Au pare-feu du car, quel port faut-il ouvrir pour **${P.q}** ?`,
            aides: ['Les ports de 0 à 1 023 sont réservés aux services connus ; les autres sont attribués par l\'IANA ou par l\'usage.', 'PTP : 319 et 320 ; DNS : 53 ; NTP : 123 ; HTTPS : 443 ; RTMP : 1935 ; RTP du car : 5004.'],
            solution: `Le port **${P.p}**. Un pare-feu filtre par port : un service bloqué se reconnaît à ce numéro.`,
          },
        ]),
        {
          type: 'choix', q: `Quel transport pour **${T.q}** ?`,
          choices: [CH_TRANSPORT[T.t][0], ...['udp', 'tcp', 'icmp'].filter((k) => k !== T.t).map((k) => CH_TRANSPORT[k])], answer: 0,
          aides: ['Demandez-vous ce qui compte : que tout arrive, ou que le rythme soit tenu ?', 'Le temps réel et le multicast passent en UDP ; les fichiers, le web et les commandes en TCP.'],
          solution: `**${CH_TRANSPORT[T.t][0]}**. ${T.pq}`,
        },
        pick(rnd, [
          {
            type: 'ordre', q: 'Remettez dans l\'ordre le début d\'une connexion TCP vers l\'interface web d\'une caméra.',
            items: ['Le portable envoie SYN', 'La caméra répond SYN-ACK', 'Le portable répond ACK', 'Le portable envoie le premier segment de la requête', 'La caméra acquitte le segment'],
            aides: ['Une connexion s\'ouvre en trois messages avant le premier octet utile.', 'SYN (« je veux te parler »), SYN-ACK (« d\'accord »), ACK (« c\'est parti »), puis les données et leurs accusés.'],
            solution: 'SYN, SYN-ACK, ACK : la **poignée de main en trois temps**, un aller-retour avant le premier octet utile ; puis chaque segment est acquitté.',
          },
          {
            type: 'ordre', q: 'Le segment 2 d\'un transfert TCP se perd. Remettez dans l\'ordre ce qui se passe ensuite.',
            items: ['Le segment 3 arrive : le récepteur répond « j\'attends 2 »', 'Les segments suivants arrivent : il répète « j\'attends 2 »', 'L\'émetteur reçoit trois accusés identiques', 'L\'émetteur renvoie le segment 2 sans attendre le délai', 'Le récepteur acquitte d\'un coup tout ce qu\'il gardait'],
            aides: ['TCP livre dans l\'ordre : le récepteur garde ce qui suit et redemande ce qui manque.', 'Trois accusés en double signalent le trou : c\'est la retransmission rapide.'],
            solution: 'Le récepteur répète son accusé, l\'émetteur reçoit **trois accusés en double** et renvoie le segment 2 ; tout arrive, dans l\'ordre, mais en retard : le blocage en tête de file.',
          },
        ]),
      ];
    },
  },
  'reseau-streaming': {
    titre: 'Contribuer et diffuser : protocoles et latences',
    consigne: 'Le car doit sortir le match par plusieurs chemins : vous choisissez le protocole de chacun et vous réglez SRT sur un accès Internet qui perd.',
    gen: (rnd) => {
      const rtt = pick(rnd, [10, 20, 30, 50, 80, 120, 200]), pp = pick(rnd, [0.5, 2, 5, 8, 15]), s = /** @type {{ mult: number, latence: number }} */ (latenceSrt(rtt, pp));
      const mbps = pick(rnd, [5, 10, 20, 40]), perte = pick(rnd, [0.5, 1, 2]), u = pertesUdp(mbps, perte / 100);
      const S = pick(rnd, SCENARIOS);
      const autres = Object.keys(PROTO).filter((k) => k !== S.ok).map((k) => PROTO[k]);
      return [
        {
          type: 'nombre', unite: 'ms', answer: s.latence, tol: 1,
          q: `Le chemin SRT vers la régie finale mesure **${rtt} ms** d'aller-retour et **${fr(pp, 1)} %** de pertes. Quelle latence SRT régler ? (Guide de Haivision : jusqu'à 1 % de pertes, 3 × l'aller-retour ; 3 % : 4 × ; 7 % : 6 × ; 10 % : 8 × ; 20 % : 10 × ; l'aller-retour est compté à 20 ms au moins.)`,
          pieges: [{ v: s.mult * rtt, why: 'L\'aller-retour se compte à 20 ms au moins : en dessous, prenez 20 ms.' }, { v: 120, why: '120 ms est la valeur par défaut de SRT : elle ne tient pas compte de ce chemin.' }].filter((x) => x.v !== s.latence),
          aides: ['Cherchez dans le guide la ligne qui couvre ces pertes : elle donne un multiplicateur de l\'aller-retour.', `Multiplicateur × aller-retour, avec un aller-retour de ${Math.max(20, rtt)} ms au moins.`],
          solution: `${fr(pp, 1)} % de pertes : ${s.mult} × l'aller-retour, soit ${s.mult} × ${Math.max(20, rtt)} ms = **${s.latence} ms** (un ordre de grandeur conseillé, à vérifier en essai). Plus le chemin perd, plus le tampon doit laisser de temps aux retransmissions.`,
        },
        {
          type: 'nombre', unite: 'paquets/s', answer: Math.round(u.perdusS * 10) / 10, tol: Math.max(0.2, u.perdusS * 0.02),
          q: `Un flux SRT de **${mbps} Mb/s** en paquets de 1 316 octets (sept paquets MPEG-TS) traverse un accès qui perd **${fr(perte, 1)} %** des paquets. Combien de paquets SRT doit-il redemander chaque seconde ?`,
          pieges: [{ v: Math.round(u.pps * 10) / 10, why: 'C\'est le nombre de paquets envoyés par seconde : appliquez-lui le taux de pertes.' }],
          aides: ['Comptez d\'abord les paquets par seconde : débit ÷ taille d\'un paquet en bits.', `${mbps} × 10⁶ ÷ (1 316 × 8), puis × ${fr(perte / 100, 3)}.`],
          solution: `${mbps} × 10⁶ ÷ 10 528 bits ≈ ${fr(u.pps, 0)} paquets par seconde, dont ${fr(perte, 1)} % perdus : **${fr(u.perdusS, 1)} par seconde**, que SRT redemande dans son tampon.`,
        },
        {
          type: 'choix', q: `${S.q} Quel protocole ?`,
          choices: [PROTO[S.ok][0], ...tirer(rnd, autres, 2)], answer: 0,
          aides: ['Contribution (vers la chaîne) ou distribution (vers le public) ? Réseau managé, Internet ou réseau local ?', 'Trois chiffres décident : la latence admise, le débit disponible, les pertes du chemin.'],
          solution: `**${PROTO[S.ok][0]}**. ${PROTO[S.ok][1]}`,
        },
        pick(rnd, [
          {
            type: 'choix', q: 'Le car est derrière la box du stade, sans aucun port ouvert ; la régie finale a ouvert un port UDP pour SRT. Comment régler les deux bouts ?',
            choices: ['Le car en caller, la régie finale en listener', ['Le car en listener, la régie finale en caller', 'Un listener attend sur un port ouvert : le car n\'en a pas, les appels de la régie seraient bloqués par sa box.'], ['Les deux en listener', 'Deux listeners attendent chacun que l\'autre appelle : la connexion ne s\'établit jamais.']], answer: 0,
            aides: ['Un listener attend des appels sur un port ouvert ; un caller appelle.', 'Qui a un port ouvert peut attendre ; l\'autre doit appeler.'],
            solution: 'Le **car appelle (caller)**, la **régie finale attend (listener)** sur son port ouvert. Le mode rendezvous, où les deux appellent, sert quand aucun des deux n\'a de port ouvert.',
          },
          {
            type: 'choix', q: 'Le but est marqué. Avec combien de retard, environ, le voit un spectateur qui regarde en HLS classique ?',
            choices: ['10 à 30 secondes', ['Moins d\'une seconde', 'C\'est l\'ordre de grandeur de WebRTC, ou d\'une contribution SRT : pas d\'une distribution par segments.'], ['2 à 5 secondes', 'C\'est l\'HLS basse latence, ou le RTMP vers la plateforme : l\'HLS classique attend plusieurs segments de quelques secondes.']], answer: 0,
            aides: ['HLS découpe le direct en segments de quelques secondes.', 'Le lecteur télécharge et garde plusieurs segments avant de jouer.'],
            solution: '**10 à 30 secondes** en HLS ou DASH classique (2 à 5 s en basse latence) : le retard vient des segments que le lecteur attend. C\'est un ordre de grandeur.',
          },
        ]),
      ];
    },
  },
  'reseau-multicast': {
    titre: 'Multicast : copies, abonnements, adresses',
    consigne: 'Au poste Réseau IP, vous comptez ce que porte chaque lien selon l\'unicast ou le multicast, vous lisez les adresses et vous suivez un abonnement.',
    gen: (rnd) => {
      const g = video('1080p50').gbpsFil;
      const n = entre(rnd, 2, 6), m = entre(rnd, 2, 5);
      const a = pick(rnd, [1, 2, 129, 130]), b = entre(rnd, 1, 4), c = entre(rnd, 1, 20);
      const h = (v) => v.toString(16).padStart(2, '0');
      const mac = `01:00:5e:${h(a & 0x7f)}:${h(b)}:${h(c)}`;
      return [
        pick(rnd, [
          {
            type: 'nombre', unite: 'Gb/s', answer: Math.round(m * g * 100) / 100, tol: 0.06 * m,
            q: `La caméra envoie son flux 1080p50 ST 2110-20 (${fr(g, 2)} Gb/s sur le fil) à **${m} récepteurs** en **unicast**. Quelle charge sur son propre lien ?`,
            pieges: [{ v: Math.round(g * 100) / 100, why: 'Ce serait le multicast. En unicast, l\'émetteur envoie une copie par destinataire.' }],
            aides: ['En unicast, combien de copies l\'émetteur envoie-t-il ?', `Une copie par récepteur : ${m} × ${fr(g, 2)} Gb/s.`],
            solution: `${m} × ${fr(g, 2)} = **${fr(m * g, 2)} Gb/s** sur le lien de la caméra, qui doit en plus connaître chaque destinataire. En multicast : ${fr(g, 2)} Gb/s, une seule copie.`,
          },
          {
            type: 'nombre', unite: 'Gb/s', answer: Math.round(n * g * 100) / 100, tol: 0.06 * n,
            q: `Multicast avec IGMP snooping : **${n} caméras** 1080p50 (${fr(g, 2)} Gb/s chacune) sur la leaf A ; le mélangeur et le multiview, sur la leaf B, sont abonnés aux ${n}. Quelle charge sur le lien entre les deux leaves ?`,
            pieges: [{ v: Math.round(2 * n * g * 100) / 100, why: 'C\'est le calcul de l\'unicast : en multicast, la leaf B recopie elle-même chaque flux vers ses deux récepteurs.' }, { v: Math.round(g * 100) / 100, why: 'Une copie par flux, pas une pour tous : chaque caméra a son groupe.' }],
            aides: ['En multicast, une copie de chaque flux demandé passe sur le lien ; la recopie se fait au plus près des récepteurs.', `${n} flux demandés de l'autre côté, une copie chacun.`],
            solution: `${n} × ${fr(g, 2)} = **${fr(n * g, 2)} Gb/s** : une copie de chaque flux demandé ; la leaf B, qui lit les abonnements IGMP, la recopie vers le mélangeur et le multiview.`,
          },
          {
            type: 'nombre', unite: 'Gb/s', answer: Math.round((n + 6) * g * 100) / 100, tol: 0.06 * (n + 6),
            q: `Le snooping a été désactivé sur une leaf. **${n + 6} caméras** 1080p50 (${fr(g, 2)} Gb/s chacune) y émettent dans le même VLAN. Combien de Gb/s arrivent sur le port 10 GbE d'un moniteur qui n'a demandé qu'un flux ?`,
            pieges: [{ v: Math.round(g * 100) / 100, why: 'Ce serait avec le snooping : sans lui, le commutateur traite le multicast comme de la diffusion.' }],
            aides: ['Sans snooping, le commutateur ne lit pas les rapports IGMP : que fait-il du multicast ?', 'Il recopie tous les flux du VLAN sur tous les ports.'],
            solution: `Tous les flux, ${n + 6} × ${fr(g, 2)} = **${fr((n + 6) * g, 2)} Gb/s**, pour un port de 10 Gb/s : il déborde, perd des paquets, et l'image gèle.`,
          },
        ]),
        {
          type: 'texte', forme: 'ip', placeholder: '01:00:5e:…', accept: [mac, mac.replace(/:/g, '-')],
          q: `Quelle adresse MAC de destination porte une trame du groupe **239.${a}.${b}.${c}** ? (Écrivez-la en hexadécimal, octets séparés par « : ».)`,
          pieges: a >= 128 ? [{ v: `01:00:5e:${h(a)}:${h(b)}:${h(c)}`, why: `Seuls les 23 derniers bits du groupe passent dans l'adresse MAC : le bit de poids fort de ${a} tombe, il reste ${a & 0x7f}.` }] : [],
          aides: ['Une MAC de groupe IPv4 commence par 01:00:5E, suivi des 23 derniers bits de l\'adresse du groupe.', `Écrivez ${a}, ${b} et ${c} en hexadécimal ; du premier, gardez seulement les 7 bits de droite.`],
          solution: `**${mac}** : 01:00:5E puis les 23 derniers bits de 239.${a}.${b}.${c}. Comme 32 groupes partagent la même MAC, un plan d'adressage multicast propre évite les doublons.`,
        },
        {
          type: 'ordre', q: 'Le contrôleur connecte l\'entrée 2 du mélangeur à la caméra 6 (SSM). Remettez les étapes dans l\'ordre.',
          items: ['Le contrôleur NMOS écrit la source S et le groupe G dans le récepteur', 'Le récepteur envoie un rapport IGMPv3 (S, G) à sa leaf', 'La leaf note le port abonné et envoie un join PIM vers la source', 'Le join remonte par une spine jusqu\'à la leaf de la caméra', 'Le flux descend l\'arbre et n\'est recopié que vers le port abonné'],
          aides: ['Tout part du récepteur : c\'est lui qui demande, pas la caméra qui envoie.', 'IGMP entre le récepteur et sa leaf, PIM entre les commutateurs, jusqu\'à la source.'],
          solution: 'Le contrôleur écrit (S, G), le récepteur le demande en **IGMPv3**, sa leaf le demande en **PIM** jusqu\'à la leaf de la source ; le flux descend l\'arbre ainsi construit.',
        },
        pick(rnd, [
          {
            type: 'choix', q: 'Une caméra mal réglée émet par erreur vers 239.1.1.3, le groupe de la caméra 3. Le mélangeur, connecté en SSM (S, G) à la caméra 3, la reçoit-il ?',
            choices: ['Non : son abonnement désigne aussi la source', ['Oui : tout ce qui part vers 239.1.1.3 lui est recopié', 'Ce serait un abonnement au seul groupe G. En SSM, le récepteur demande le couple (S, G).'], ['Non : deux caméras ne peuvent pas émettre vers un même groupe', 'Rien n\'empêche un appareil mal réglé d\'émettre sur un groupe déjà pris.']], answer: 0,
            aides: ['Que demande exactement un join IGMPv3 en SSM ?', 'Le groupe G, et la source S de ce groupe.'],
            solution: '**Non** : en SSM, le récepteur demande « le groupe G envoyé par S ». L\'intrus n\'est pas la source demandée.',
          },
          {
            type: 'choix', q: 'Un récepteur ne renouvelle plus son abonnement (il a planté). Que fait la leaf ?',
            choices: ['Elle cesse de lui envoyer le flux quand l\'abonnement expire', ['Elle continue pour toujours', 'Un abonnement non renouvelé expire : les requêtes du querier servent à le vérifier.'], ['Elle coupe le flux pour tout le monde', 'Les autres récepteurs ont leur propre abonnement, qui continue.']], answer: 0,
            aides: ['Un abonnement IGMP n\'est pas éternel : quelqu\'un le redemande régulièrement.', 'Le querier interroge toutes les 125 s ; sans réponse, l\'abonnement expire (260 s par défaut).'],
            solution: 'Le **querier** redemande les abonnements toutes les 125 s ; sans réponse, le port est retiré du groupe après 260 s (valeurs par défaut).',
          },
        ]),
      ];
    },
  },
  'reseau-mesures': {
    titre: 'Mesurer un chemin : débit, latence, gigue',
    consigne: 'Avant l\'antenne, vous chiffrez un transfert, le retard d\'un lien et la sérialisation d\'un paquet, puis vous lisez une mesure de ping.',
    gen: (rnd) => {
      const mo = pick(rnd, [100, 250, 500, 2000]), D = pick(rnd, [1, 10]), t = mo * 8 / (D * 1000);
      const km = pick(rnd, [15, 80, 250, 600, 1000]), pr = propagationMs(km);
      const oct = pick(rnd, [1500, 1286, 9000]), gb = pick(rnd, [1, 10, 25]), se = serialisationUs(oct, gb);
      return [
        {
          type: 'nombre', unite: 's', answer: Math.round(t * 1000) / 1000, tol: t * 0.02,
          q: `Combien de temps faut-il, au mieux (sans les en-têtes), pour envoyer un fichier de **${fr(mo)} Mo** sur un lien à **${D} Gb/s** ?`,
          pieges: [{ v: Math.round(mo / (D * 1000) * 1000) / 1000, why: 'Un fichier se compte en octets, un lien en bits : 1 octet = 8 bits.' }],
          aides: ['Mettez tout en bits : 1 octet = 8 bits, et en réseau k, M et G valent 1 000, 10⁶ et 10⁹.', `${fr(mo)} Mo × 8 = ${fr(mo * 8)} Mb, à diviser par ${fr(D * 1000)} Mb/s.`],
          solution: `${fr(mo * 8)} Mb ÷ ${fr(D * 1000)} Mb/s = **${fr(t, 3)} s**, un peu plus en pratique avec les en-têtes.`,
        },
        {
          type: 'nombre', unite: 'ms', answer: Math.round(pr * 1000) / 1000, tol: pr * 0.04,
          q: `Le car est relié à la régie finale par **${fr(km)} km** de fibre. Quel temps de propagation dans un sens ?`,
          pieges: [{ v: Math.round(km / 300 * 1000) / 1000, why: 'La lumière va moins vite dans le verre que dans le vide : environ 5 µs par kilomètre, pas 3,3.' }, { v: Math.round(2 * pr * 1000) / 1000, why: 'C\'est l\'aller-retour (ce que mesure le ping) : la question porte sur un seul sens.' }],
          aides: ['Dans la fibre, le signal parcourt environ 200 000 km par seconde.', 'Environ 5 µs par kilomètre : multipliez, puis passez en millisecondes.'],
          solution: `${fr(km)} km × ≈ 5 µs = **${fr(pr, 2)} ms** environ (204 000 km/s dans la fibre). Incompressible : aucun réglage ne le réduit.`,
        },
        {
          type: 'nombre', unite: 'µs', answer: Math.round(se * 1000) / 1000, tol: se * 0.02,
          q: `Combien de temps faut-il pour « poser » un paquet de **${fr(oct)} octets** sur un lien à **${gb} Gb/s** (le temps de sérialisation) ?`,
          pieges: [{ v: Math.round(oct / (gb * 1e3) * 1000) / 1000, why: 'Le paquet est en octets, le lien en bits par seconde : × 8.' }],
          aides: ['Sérialisation = taille ÷ débit.', `${fr(oct)} × 8 bits ÷ (${gb} × 10⁹ b/s), en microsecondes.`],
          solution: `${fr(oct * 8)} bits ÷ ${gb} Gb/s = **${fr(se, 2)} µs**, à chaque saut : plus le lien est rapide, plus elle est courte.`,
        },
        pick(rnd, [
          {
            type: 'choix', q: '`ping -c 100` vers le codeur de la régie finale : minimum 12 ms, moyenne 14 ms, maximum 96 ms, 0 % de pertes. Que montre cette mesure ?',
            choices: ['De la gigue : certains paquets attendent dans des files', ['Une distance trop longue', 'La distance fixe le minimum, 12 ms, pour tous les paquets ; l\'écart avec le maximum vient d\'ailleurs.'], ['Des pertes sur le chemin', 'Aucun paquet n\'est perdu : 0 %.']], answer: 0,
            aides: ['Comparez le minimum et le maximum : la propagation est la même pour tous les paquets.', 'Ce qui varie d\'un paquet à l\'autre, ce sont les files d\'attente.'],
            solution: 'De la **gigue** : l\'écart entre 12 et 96 ms vient des files d\'attente. Le tampon du récepteur doit couvrir ces écarts, en ajoutant son retard.',
          },
          {
            type: 'choix', q: '`ping` vers la régie finale par la liaison de secours : minimum 241 ms, maximum 250 ms, 0 % de pertes. D\'où vient ce retard ?',
            choices: ['De la propagation : la liaison passe par un satellite géostationnaire', ['D\'un commutateur engorgé', 'Une file d\'attente ferait varier le retard ; ici, il est presque constant et énorme.'], ['De pertes réparées par TCP', 'Le ping passe en ICMP, sans retransmission, et rien n\'est perdu.']], answer: 0,
            aides: ['Un retard élevé mais presque constant, c\'est une distance.', 'Un satellite géostationnaire est à 35 786 km d\'altitude : montée et descente.'],
            solution: 'La **propagation** par satellite : environ 240 ms par bond, montée et descente. Aucun réglage ne la réduit.',
          },
          {
            type: 'choix', q: 'Un flux perd 3 % de ses paquets ; le compteur d\'erreurs FCS du port de la leaf monte sans cesse, alors que le lien n\'est chargé qu\'à 20 %. Quelle cause ?',
            choices: ['Un câble ou un module optique abîmé', ['Une file pleine sur le port', 'À 20 % de charge, la file ne déborde pas ; et une file pleine jette des paquets sans erreur FCS.'], ['La gigue du chemin', 'La gigue retarde les paquets, elle ne les abîme pas.']], answer: 0,
            aides: ['Une erreur FCS veut dire une trame arrivée abîmée.', 'Ce n\'est pas la charge : regardez la couche physique.'],
            solution: 'Un **câble ou un module abîmé** : les trames arrivent corrompues (FCS faux) et sont jetées. On nettoie ou on change la jarretière, puis le module.',
          },
        ]),
      ];
    },
  },
  'reseau-qos': {
    titre: 'Marquer et prioriser au port de sortie',
    consigne: 'Un port de sortie reçoit plus qu\'il ne peut envoyer : vous marquez chaque usage, puis vous comparez une seule file et la priorité stricte.',
    gen: (rnd) => {
      const k = pick(rnd, ['ptp', 'media', 'commande', 'fichiers']), C = CLASSES[k];
      const USAGE = { ptp: 'les messages PTP du grand maître', media: 'les flux vidéo ST 2110-20 des caméras', commande: 'les commandes et l\'intercom', fichiers: 'la copie des fichiers de l\'EVS vers le NAS' };
      const L = 10, M = pick(rnd, [6.6, 8.8]), F = M === 6.6 ? pick(rnd, [4, 5]) : pick(rnd, [2, 3, 4, 5]);
      const offert = { ptp: 1, media: M * 1000, fichiers: F * 1000 };
      const fifo = filesQos(offert, L * 1000, 'fifo'), prio = filesQos(offert, L * 1000, 'prio');
      const pf = fifo.classes.media.pertePct, pp = prio.classes.fichiers.pertePct;
      return [
        {
          type: 'nombre', answer: C.dscp, q: `D'après les normes du car IP (AES67, ST 2110), quelle valeur de **DSCP** marque ce trafic : **${USAGE[k]}** ?`,
          pieges: [{ v: C.cos, why: `${C.cos} est la priorité CoS (3 bits de l'étiquette VLAN), pas le DSCP (6 bits de l'en-tête IP).` }].filter((x) => x.v !== C.dscp),
          aides: ['EF 46 pour ce qui ne doit jamais attendre, AF41 34 pour les médias, CS4 32 pour les commandes, DF 0 au mieux.', 'Demandez-vous ce que ce trafic supporte : attendre quelques microsecondes, ou pas du tout ?'],
          solution: `**${C.dscp}** (${C.phb}) pour ${USAGE[k]}${k === 'ptp' ? ' : une file en priorité stricte, car un Sync qui attend fausse la mesure du délai' : k === 'fichiers' ? ' : au mieux, ils peuvent attendre' : ''}.`,
        },
        {
          type: 'nombre', unite: '%', answer: Math.round(pf * 10) / 10, tol: 0.3,
          q: `Sur un port de sortie à **${L} Gb/s**, sans QoS (une seule file) : **${fr(M, 1)} Gb/s** de vidéo, **${F} Gb/s** de copie de fichiers et 1 Mb/s de PTP. Quelle part de ses paquets chaque flux perd-il, PTP compris ?`,
          aides: ['Une seule file : quand le lien déborde, tout le monde perd la même part.', `Le lien sert ${L} Gb/s sur ${fr(M + F + 0.001, 3)} Gb/s offerts : la part perdue est 1 − ${L} ÷ ${fr(M + F + 0.001, 3)}.`],
          solution: `${fr(M + F + 0.001, 3)} Gb/s pour ${L} : chaque flux perd **${fr(pf, 1)} %** de ses paquets, PTP et vidéo comme les fichiers, et tous attendent derrière une file pleine.`,
        },
        {
          type: 'nombre', unite: '%', answer: Math.round(pp * 10) / 10, tol: 0.3,
          q: `Même port, même trafic (${fr(M, 1)} Gb/s de vidéo, ${F} Gb/s de fichiers, 1 Mb/s de PTP sur ${L} Gb/s), avec une file par classe servie en **priorité stricte** (PTP, puis médias, puis fichiers). Quelle part des paquets de la copie de fichiers est jetée ?`,
          pieges: [{ v: Math.round(pf * 10) / 10, why: 'C\'est la perte en une seule file : en priorité stricte, PTP et la vidéo passent d\'abord, et toute la perte retombe sur les fichiers.' }],
          aides: ['En priorité stricte, les classes passent dans l\'ordre ; la dernière prend ce qui reste.', `Il reste ${L} − ${fr(M + 0.001, 3)} Gb/s pour ${F} Gb/s de fichiers.`],
          solution: `PTP et vidéo passent entiers ; il reste ${fr(L - M - 0.001, 3)} Gb/s pour ${F} Gb/s de fichiers : ils perdent **${fr(pp, 1)} %**, la copie ralentit (TCP), le direct ne voit rien.`,
        },
        pick(rnd, [
          {
            type: 'choix', q: 'Les flux vidéo seuls dépassent le débit d\'un lien entre une leaf et une spine. Que peut la QoS ?',
            choices: ['Rien : elle ne crée pas de débit, il faut redimensionner ou refuser des flux', ['Tout régler en marquant la vidéo en EF', 'Si tout est prioritaire, rien ne l\'est : la vidéo perd des paquets quoi qu\'on marque.'], ['Compresser la vidéo pour qu\'elle passe', 'La QoS range et sert les files ; elle ne touche pas au contenu des paquets.']], answer: 0,
            aides: ['La QoS choisit qui attend et qui perd ; peut-elle augmenter le débit du lien ?', 'Un réseau ST 2110 se dimensionne pour ne jamais déborder ; la QoS reste une assurance.'],
            solution: '**Rien** : la QoS ne crée pas de débit. On dimensionne (liens plus gros, non bloquant) ou un contrôleur SDN refuse ce qui saturerait le lien.',
          },
          {
            type: 'choix', q: 'Un portable branché sur un port du car marque tout son trafic en EF 46. Comment s\'en protéger ?',
            choices: ['Réécrire le DSCP à l\'entrée de ce port (frontière de confiance)', ['Faire confiance au marquage partout (« trust dscp »)', 'C\'est justement ce qui lui permet de passer devant PTP.'], ['Mettre ses paquets en CoS 1', 'La CoS 1 passe même après la CoS 0 en 802.1p, mais seul le commutateur peut l\'imposer : c\'est encore réécrire le marquage.']], answer: 0,
            aides: ['Qui décide du marquage : l\'appareil ou le réseau ?', 'Au bord du réseau, on ne fait confiance qu\'aux appareils maîtrisés.'],
            solution: 'On **réécrit le DSCP** de ce qui vient d\'appareils non maîtrisés : c\'est la frontière de confiance. « trust dscp » se garde pour les ports des appareils du car.',
          },
          {
            type: 'choix', q: 'Un invité doit être limité à 20 Mb/s : tout ce qui dépasse doit être coupé net. Quel outil ?',
            choices: ['Le policing', ['Le shaping', 'Le shaping retarde l\'envoi pour lisser le débit : il ne coupe pas, il met en attente.'], ['La priorité stricte', 'La priorité stricte ordonne les files ; elle ne limite pas le débit d\'un flux.']], answer: 0,
            aides: ['Couper ce qui dépasse, ou retarder pour lisser ?', 'L\'un jette, l\'autre met en attente.'],
            solution: 'Le **policing** jette ce qui dépasse le débit convenu ; le shaping, lui, lisse en retardant (un codeur vers une liaison louée).',
          },
        ]),
      ];
    },
  },
  'reseau-ptp': {
    titre: 'L\'heure du car IP : décalage, asymétrie, élection',
    consigne: 'Au poste Réseau IP, onglet PTP : vous refaites le calcul d\'un esclave, vous chiffrez l\'erreur d\'une asymétrie et vous dites quelle horloge le BMCA élit.',
    gen: (rnd) => {
      const a = entre(rnd, 6, 20) * 100, b = entre(rnd, 2, Math.max(2, a / 100 - 2)) * 100, del = (a + b) / 2, off = a - del;
      const m = pick(rnd, [20, 40, 60, 100, 150, 200]), asym = m * 5;
      const H = horloges(rnd), gagnant = H.slice().sort(avant)[0];
      const liste = H.map((x) => `- ${x.nom} : priorité 1 = ${x.p1}, classe ${x.classe}, priorité 2 = ${x.p2}`).join('\n');
      return [
        {
          type: 'nombre', unite: 'ns', answer: off,
          q: `Une caméra IP relève **t2 − t1 = ${fr(a)} ns** (le Sync, à l'aller) et **t4 − t3 = ${fr(b)} ns** (le Delay_Req, au retour). Quel décalage calcule-t-elle entre son horloge et celle du maître ?`,
          pieges: [{ v: del, why: 'C\'est le délai moyen, l\'estimation du temps de trajet : pas l\'écart entre les horloges.' }, { v: a - b, why: 'Le décalage passe par le délai moyen : (t2 − t1) − délai moyen, soit la moitié de cet écart.' }],
          aides: ['Calculez d\'abord le délai moyen : la moyenne de l\'aller et du retour.', 'Décalage = (t2 − t1) − délai moyen.'],
          solution: `Délai moyen = (${fr(a)} + ${fr(b)}) ÷ 2 = ${fr(del)} ns ; décalage = ${fr(a)} − ${fr(del)} = **${fr(off)} ns**. La caméra corrige son horloge d'autant, en supposant le trajet symétrique.`,
        },
        {
          type: 'nombre', unite: 'ns', answer: asym / 2, tol: asym * 0.04,
          q: `Le chemin aller d'un esclave passe par **${m} m** de fibre de plus que le retour (environ 5 ns par mètre). Quelle erreur sur le décalage qu'il calcule ?`,
          pieges: [{ v: asym, why: 'C\'est l\'asymétrie elle-même : le calcul la partage en deux.' }, { v: 0, why: 'PTP ne voit pas une asymétrie : il suppose le trajet symétrique.' }],
          aides: ['L\'asymétrie a, c\'est la différence de durée entre l\'aller et le retour.', 'L\'erreur sur le décalage vaut a ÷ 2.'],
          solution: `${m} m × 5 ns = ${fr(asym)} ns d'asymétrie, soit une erreur de **${fr(asym / 2)} ns** : invisible sur toute alarme, on la corrige par une constante d'asymétrie après mesure.`,
        },
        {
          type: 'choix', q: `Trois horloges annoncent sur le domaine 127 :\n${liste}\nLaquelle le BMCA élit-il grand maître ?`,
          choices: [gagnant.nom, ...H.filter((x) => x !== gagnant).map((x) => /** @type {[string, string]} */ ([x.nom, perd(x, gagnant)]))], answer: 0,
          aides: ['Le BMCA compare les annonces champ par champ ; dans chaque champ, la valeur la plus basse gagne.', 'Dans l\'ordre : priorité 1, classe d\'horloge, précision, priorité 2, identité.'],
          solution: `**${gagnant.nom}**. ${gagnant.p1 < 128 ? 'Sa priorité 1 est la plus basse : elle passe avant tout le reste, même une classe 248 (d\'où le réglage « slave only » sur tout ce qui n\'est pas un générateur).' : gagnant.classe === 6 && H.filter((x) => x.classe === 6).length === 1 ? 'À priorité 1 égale, c\'est la seule calée sur le GPS (classe 6).' : 'À priorité 1 et classe égales, sa priorité 2 est la plus basse.'}`,
        },
        pick(rnd, [
          {
            type: 'ordre', q: 'Remettez dans l\'ordre un échange PTP entre le grand maître et un esclave.',
            items: ['Le maître envoie Sync et note son heure d\'émission t1', 'L\'esclave note l\'heure d\'arrivée du Sync : t2', 'Le Follow_Up lui apporte t1', 'L\'esclave envoie Delay_Req et note t3', 'Le maître note l\'arrivée t4 et la renvoie dans Delay_Resp'],
            aides: ['L\'aller d\'abord (du maître vers l\'esclave), le retour ensuite.', 'Sync, Follow_Up, puis Delay_Req et Delay_Resp.'],
            solution: 'Sync (t1, t2), Follow_Up (t1 exact), puis Delay_Req (t3) et Delay_Resp (t4) : avec ces quatre instants, l\'esclave calcule le délai et son décalage.',
          },
          {
            type: 'choix', q: 'Dans un car IP, le message PTP attend dans les files des commutateurs ordinaires, derrière la vidéo. Que faut-il ?',
            choices: ['Des commutateurs horloges frontières (ou transparentes)', ['Plus de messages Sync par seconde', 'Chaque Sync attendrait autant : l\'erreur vient du temps variable passé dans les files.'], ['Une liaison plus courte vers le grand maître', 'La longueur ne change rien à l\'attente dans les files, qui varie à chaque message.']], answer: 0,
            aides: ['L\'attente dans une file est variable et différente à l\'aller et au retour.', 'Il faut que le commutateur horodate lui-même, ou corrige le temps passé chez lui.'],
            solution: 'Des **horloges frontières** : esclave vers le grand maître, maître sur les autres ports, le commutateur horodate lui-même. L\'horloge transparente, elle, ajoute au message le temps passé dans le commutateur.',
          },
        ]),
      ];
    },
  },
  'reseau-st2110': {
    titre: 'Les flux d\'une caméra IP',
    consigne: 'Vous préparez le plan des flux du car IP : le débit de chaque essence sur le fil, ce qu\'un port peut porter, et quelle norme pour quel contenu.',
    gen: (rnd) => {
      const fk = pick(rnd, Object.keys(FORMATS)), V = video(fk);
      const tp = pick(rnd, [0.001, 0.000125]), can = tp === 0.001 ? pick(rnd, [2, 4, 8]) : pick(rnd, [8, 16, 32, 64]), A = audio(can, tp);
      const fk2 = pick(rnd, Object.keys(FORMATS)), lien = pick(rnd, [10, 25, 100]), g2 = video(fk2).gbpsFil, nf = fluxParLien(g2, lien);
      const K = pick(rnd, CONTENUS);
      const autres = Object.keys(ESSENCES).filter((k) => k !== K.ok).map((k) => ESSENCES[k]);
      return [
        {
          type: 'nombre', unite: 'Gb/s', answer: Math.round(V.gbpsFil * 1000) / 1000, tol: V.gbpsFil * 0.02,
          q: `Une caméra **${FORMATS[fk]}** 4:2:2 10 bits envoie sa vidéo en ST 2110-20 : ${fr(V.pps)} paquets par seconde de ${fr(V.fil)} octets sur le fil. Quel débit sur le fil ?`,
          pieges: [{ v: Math.round(V.utile * 1000) / 1000, why: 'C\'est l\'image active seule : chaque paquet ajoute ses en-têtes.' }, { v: V.F.sdi, why: 'C\'est le débit du SDI, qui transporte aussi la suppression ; le ST 2110-20 ne porte que l\'image active.' }],
          aides: ['Débit = paquets par seconde × taille d\'un paquet en bits.', `${fr(V.pps)} × ${fr(V.fil)} × 8, puis ÷ 10⁹.`],
          solution: `${fr(V.pps)} × ${fr(V.fil)} × 8 = **${fr(V.gbpsFil, 2)} Gb/s** (pour ${fr(V.utile, 2)} Gb/s d'image active) : de l'ordre de 2,2 Gb/s en 1080p50.`,
        },
        {
          type: 'nombre', unite: 'Mb/s', answer: Math.round(A.mbpsFil * 100) / 100, tol: A.mbpsFil * 0.02,
          q: `Un flux audio ST 2110-30 de **${can} canaux**, 24 bits à 48 kHz, en paquets de **${tp === 0.001 ? '1 ms' : '125 µs'}** : ${A.ech} échantillons par canal et par paquet, plus ${ENTETES.rtp + ENTETES.udp + ENTETES.ip} octets d'en-têtes RTP, UDP et IP, et ${ENTETES.eth + ENTETES.fil} octets d'Ethernet et de fil. Quel débit sur le fil ?`,
          pieges: [{ v: Math.round(A.utile * 100) / 100, why: 'C\'est le son seul : chaque paquet ajoute 78 octets d\'en-têtes, et ils sont nombreux.' }],
          aides: [`Taille d'un paquet : ${A.ech} échantillons × ${can} canaux × 3 octets, plus 78 octets d'en-têtes.`, `${fr(A.fil)} octets × ${fr(A.pps)} paquets par seconde × 8, puis ÷ 10⁶.`],
          solution: `${A.ech} × ${can} × 3 = ${fr(A.charge)} octets de son, ${fr(A.fil)} sur le fil, ${fr(A.pps)} fois par seconde : **${fr(A.mbpsFil, 2)} Mb/s**${tp === 0.000125 ? ' ; les paquets courts gagnent en latence mais coûtent en en-têtes' : ''}.`,
        },
        pick(rnd, [
          {
            type: 'nombre', answer: nf, q: `Combien de flux vidéo **${FORMATS[fk2]}** (${fr(g2, 2)} Gb/s chacun) peut-on faire passer sur un port à **${lien} GbE**, en gardant la charge sous 90 % ?`,
            pieges: [{ v: Math.floor(lien / g2), why: 'Sans marge : gardez 10 % du lien libre pour les micro-rafales.' }, { v: Math.round(lien * 0.9 / g2 * 100) / 100, why: 'Un flux ne se coupe pas : arrondissez à l\'entier inférieur.' }].filter((x) => x.v !== nf),
            aides: ['Prenez 90 % du lien, puis divisez par le débit d\'un flux.', `${lien} × 0,9 ÷ ${fr(g2, 2)}, arrondi à l'entier inférieur.`],
            solution: `${fr(lien * 0.9, 1)} Gb/s utiles ÷ ${fr(g2, 2)} = **${nf}** flux (un flux ne se coupe pas).`,
          },
          {
            type: 'nombre', unite: 'Hz', answer: 90000,
            q: 'Chaque paquet vidéo ST 2110-20 porte un horodatage RTP qui dit à quelle image il appartient. À quelle fréquence compte cette horloge RTP de la vidéo ?',
            pieges: [{ v: 48000, why: '48 kHz est l\'horloge RTP de l\'audio (ST 2110-30), calée sur l\'échantillonnage.' }],
            aides: ['L\'audio a une horloge RTP calée sur son échantillonnage ; la vidéo en a une autre, plus rapide.', 'C\'est l\'horloge RTP classique de la vidéo, la même que celle du MPEG.'],
            solution: '**90 000 Hz** pour la vidéo (48 000 Hz pour l\'audio) : le récepteur range les paquets par horodatage, pas par ordre d\'arrivée.',
          },
        ]),
        {
          type: 'choix', q: `Quelle partie de ST 2110 transporte **${K.q}** ?`,
          choices: [ESSENCES[K.ok][0], ...tirer(rnd, autres, 2)], answer: 0,
          aides: ['-20 la vidéo, -30 l\'audio, -40 les données, -22 la vidéo compressée.', '-10 n\'est pas une essence : c\'est la synchronisation et l\'horodatage.'],
          solution: `**${ESSENCES[K.ok][0]}**. ${ESSENCES[K.ok][1]}`,
        },
      ];
    },
  },
  'reseau-paquet': {
    titre: 'Découper une ligne en paquets',
    consigne: 'À la capture sur port miroir, vous refaites le compte : paquets par ligne et par seconde, taille sur le fil, ce que dit chaque en-tête.',
    gen: (rnd) => {
      const fk = pick(rnd, ['1080p50', '2160p50', '1080i25']), charge = pick(rnd, [800, 960, 1200, 1440]), V = video(fk, charge);
      const c2 = pick(rnd, [960, 1200, 1400]), fil = c2 + ENTETES.rfc4175 + ENTETES.rtp + ENTETES.udp + ENTETES.ip + ENTETES.eth + ENTETES.fil;
      return [
        {
          type: 'nombre', answer: V.parLigne,
          q: `Une ligne active **${FORMATS[fk]}** compte ${fr(V.F.w)} pixels, à 5 octets pour 2 pixels (4:2:2 10 bits). L'émetteur met **${fr(charge)} octets** de pixels par paquet. Combien de paquets par ligne ?`,
          pieges: [{ v: Math.round(V.F.w * 2.5 / charge * 100) / 100, why: 'Un paquet ne porte qu\'une ligne : on arrondit au paquet supérieur, le dernier est plus court.' }, { v: Math.ceil(V.F.w * 2 / charge), why: 'Un pixel 4:2:2 10 bits fait 2,5 octets (20 bits), pas 2.' }].filter((x) => x.v !== V.parLigne),
          aides: ['Calculez d\'abord la taille d\'une ligne en octets.', `${fr(V.F.w)} × 2,5 = ${fr(V.ligne)} octets, divisés par ${fr(charge)}, arrondis au-dessus.`],
          solution: `${fr(V.ligne)} octets ÷ ${fr(charge)} = **${V.parLigne}** paquets par ligne${V.ligne % charge ? ' (le dernier, plus court)' : ''}.`,
        },
        {
          type: 'nombre', unite: 'paquets/s', answer: V.pps,
          q: `Toujours en **${FORMATS[fk]}**, à ${V.parLigne} paquets par ligne active et ${fr(V.F.h)} lignes actives par image, combien de paquets par seconde ?`,
          pieges: [{ v: V.parLigne * V.F.lignes * V.F.ips, why: 'Seules les lignes actives sont envoyées : le ST 2110-20 ne transporte pas la suppression.' }],
          aides: ['Paquets par image = paquets par ligne × lignes actives.', `${V.parLigne} × ${fr(V.F.h)} × ${V.F.ips} images par seconde.`],
          solution: `${V.parLigne} × ${fr(V.F.h)} = ${fr(V.nPaquetsImage)} paquets par image, × ${V.F.ips} = **${fr(V.pps)}** par seconde : le rythme que mesure l'analyseur.`,
        },
        {
          type: 'nombre', unite: 'octets', answer: fil,
          q: `Un paquet porte **${fr(c2)} octets** de pixels. En-têtes : RFC 4175 8 octets, RTP 12, UDP 8, IP 20, Ethernet 18 (contrôle compris), et 20 octets de préambule et de silence sur le fil. Combien d'octets occupe-t-il sur le fil ?`,
          pieges: [{ v: fil - ENTETES.fil, why: 'C\'est la trame Ethernet : sur le fil s\'ajoutent le préambule et l\'intervalle, 20 octets.' }, { v: c2 + 48, why: 'C\'est le paquet IP : ajoutez Ethernet et ce qu\'occupe le fil.' }],
          aides: ['Additionnez les en-têtes de toutes les couches, de RFC 4175 jusqu\'au fil.', `${fr(c2)} + 8 + 12 + 8 + 20 + 18 + 20.`],
          solution: `${fr(c2)} + 86 = **${fr(fil)} octets**, dont ${fr(c2 / fil * 100, 1)} % de pixels.`,
        },
        pick(rnd, [
          {
            type: 'choix', q: 'Un émetteur est réglé pour mettre 1 500 octets de pixels par paquet, sur un réseau au MTU standard. Que se passe-t-il ?',
            choices: ['Le paquet IP dépasse 1 500 octets : sans trames jumbo partout, il est jeté', ['Rien : 1 500 est le MTU', 'Le MTU compte tout le paquet IP : 1 500 octets de pixels + 48 d\'en-têtes RFC 4175, RTP, UDP et IP font 1 548.'], ['Le commutateur découpe le paquet', 'Les flux ST 2110 ne sont pas fragmentés : un paquet trop gros est simplement jeté.']], answer: 0,
            aides: ['Le MTU limite le paquet IP entier, en-têtes compris.', '1 500 + 8 + 12 + 8 + 20 : comparez avec 1 500.'],
            solution: '1 548 octets de paquet IP pour un MTU de 1 500 : il est **jeté** (une panne du poste Réseau IP), sauf trames jumbo de bout en bout. D\'où les 1 200 octets courants.',
          },
          {
            type: 'choix', q: 'Le récepteur doit savoir où ranger les pixels d\'un paquet dans l\'image. Quel en-tête le lui dit ?',
            choices: ['RFC 4175 : la ligne et le pixel de départ', ['RTP : le numéro de séquence', 'RTP numérote et horodate : il dit l\'ordre et l\'image, pas la place dans l\'image.'], ['IP : l\'adresse du groupe', 'IP dit d\'où vient le paquet et vers quel groupe il va, rien de sa place dans l\'image.']], answer: 0,
            aides: ['C\'est l\'en-tête le plus proche des pixels.', 'Il porte une longueur, un numéro de ligne et un décalage.'],
            solution: 'L\'en-tête **RFC 4175** (8 octets) : numéro de ligne et décalage du premier pixel. RTP, au-dessus, numérote et horodate ; son bit M marque le dernier paquet d\'une image.',
          },
          {
            type: 'choix', q: 'Comment le récepteur repère-t-il qu\'un paquet manque ?',
            choices: ['Un trou dans les numéros de séquence RTP', ['La somme de contrôle UDP', 'Elle détecte un paquet abîmé, pas un paquet absent.'], ['Un accusé de réception manquant', 'UDP et RTP n\'ont pas d\'accusé : rien n\'est redemandé.']], answer: 0,
            aides: ['Chaque paquet porte un numéro qui augmente de 1.', 'Le numéro est dans l\'en-tête RTP (16 bits, étendus par RFC 4175).'],
            solution: 'Un **trou dans la séquence RTP** : c\'est ce que compte l\'analyseur du poste Réseau IP. Le numéro (16 bits) reboucle plusieurs fois par seconde, d\'où son extension dans RFC 4175.',
          },
        ]),
      ];
    },
  },
  'reseau-rythme': {
    titre: 'Le rythme d\'un émetteur ST 2110-21',
    consigne: 'L\'analyseur de flux mesure le rythme des émetteurs : vous calculez l\'intervalle et les limites du modèle, puis vous jugez une mesure.',
    gen: (rnd) => {
      const fk = pick(rnd, ['1080p50', '2160p50', '1080i25']), V = video(fk), dt = 1e6 / V.pps;
      const fk2 = pick(rnd, ['1080p50', '2160p50']), ch = pick(rnd, [960, 1200]), N = modele21(fk2, 'N', ch), W = modele21(fk2, 'W', ch);
      const quoi = pick(rnd, ['cmax', 'vrx']);
      const cas = pick(rnd, ['N', 'W', 'aucun']), cm = cas === 'N' ? Math.max(1, N.cmax - entre(rnd, 0, 2)) : cas === 'W' ? entre(rnd, N.cmax + 1, W.cmax) : W.cmax + entre(rnd, 2, 10);
      const tp = pick(rnd, [['TPN', 'étroit, espacé (il se tait pendant la suppression)'], ['TPNL', 'étroit, linéaire (réparti sur toute l\'image)'], ['TPW', 'large (par petites rafales)']]);
      return [
        {
          type: 'nombre', unite: 'µs', answer: Math.round(dt * 1000) / 1000, tol: dt * 0.02,
          q: `Un émetteur **linéaire** (NL) répartit régulièrement ses ${fr(V.nPaquetsImage)} paquets par image sur toute la durée de l'image, en **${FORMATS[fk]}**. Quel intervalle entre deux paquets ?`,
          pieges: [{ v: Math.round(dt * 0.96 * 1000) / 1000, why: 'Ce serait un émetteur espacé (N), qui n\'envoie que pendant les lignes actives : le linéaire étale sur toute l\'image.' }],
          aides: ['Intervalle = durée d\'une image ÷ paquets par image.', `${fr(1000 / V.F.ips)} ms = ${fr(1e6 / V.F.ips)} µs, divisé par ${fr(V.nPaquetsImage)}.`],
          solution: `${fr(1e6 / V.F.ips)} µs ÷ ${fr(V.nPaquetsImage)} = **${fr(dt, 2)} µs** entre deux paquets, ${fr(V.pps)} par seconde.`,
        },
        quoi === 'cmax' ? {
          type: 'nombre', answer: N.cmax,
          q: `Le modèle ST 2110-21 fixe pour un émetteur étroit (N) **CMAX = max(4, ⌊N ÷ (43 200 × RACTIVE × TFRAME)⌋)**, avec N les paquets d'une image, RACTIVE = 1 080 ÷ 1 125 = 0,96 et TFRAME la durée d'une image (s). En **${FORMATS[fk2]}**, ${fr(ch)} octets par paquet (${fr(N.npackets)} paquets par image), que vaut CMAX ?`,
          aides: ['TFRAME vaut 0,02 s à 50 images par seconde.', `${fr(N.npackets)} ÷ (43 200 × 0,96 × 0,02), arrondi à l'entier inférieur, et au moins 4.`],
          solution: `${fr(N.npackets)} ÷ 829,44 ≈ ${fr(N.npackets / 829.44, 2)} → **${N.cmax}** paquets d'avance au plus sur le rythme parfait.`,
        } : {
          type: 'nombre', answer: N.vrx,
          q: `Le modèle ST 2110-21 fixe pour un émetteur étroit (N) **VRX_FULL = max(8, ⌊N ÷ (27 000 × TFRAME)⌋)**, avec N les paquets d'une image et TFRAME la durée d'une image (s). En **${FORMATS[fk2]}**, ${fr(ch)} octets par paquet (${fr(N.npackets)} paquets par image), que vaut VRX_FULL ?`,
          aides: ['TFRAME vaut 0,02 s à 50 images par seconde.', `${fr(N.npackets)} ÷ (27 000 × 0,02), arrondi à l'entier inférieur, et au moins 8.`],
          solution: `${fr(N.npackets)} ÷ 540 ≈ ${fr(N.npackets / 540, 2)} → **${N.vrx}** paquets au plus dans le récepteur virtuel.`,
        },
        {
          type: 'choix', q: `En **${FORMATS[fk2]}**, ${fr(ch)} octets par paquet, CMAX vaut ${N.cmax} pour un émetteur étroit (N) et ${W.cmax} pour un large (W). L'analyseur mesure un CINST maximal de **${cm}**. Que concluez-vous ?`,
          choices: [
            ['Conforme au type N (étroit)', `${cm} dépasse ${N.cmax}, le CMAX d'un émetteur étroit.`],
            ['Non conforme au type N, mais conforme au type W (large)', cm <= N.cmax ? `${cm} reste sous ${N.cmax} : il est conforme même au type étroit, plus exigeant.` : `${cm} dépasse aussi ${W.cmax}, le CMAX d'un émetteur large.`],
            ['Non conforme, même au type W', `${cm} reste sous ${W.cmax}, le CMAX d'un émetteur large.`],
          ],
          answer: cas === 'N' ? 0 : cas === 'W' ? 1 : 2,
          aides: ['CINST compte les paquets arrivés en avance sur le rythme parfait : il ne doit pas dépasser CMAX.', `Comparez ${cm} à ${N.cmax}, puis à ${W.cmax}.`],
          solution: cas === 'N' ? `**Conforme au type N** : ${cm} ≤ ${N.cmax}.` : cas === 'W' ? `**Conforme au type W seulement** : ${cm} > ${N.cmax} mais ≤ ${W.cmax}. Face à un récepteur étroit, ses tampons déborderaient.` : `**Non conforme** : ${cm} > ${W.cmax}. Une rafale pareille fait perdre des paquets dans les files.`,
        },
        {
          type: 'texte', forme: 'ip', placeholder: 'TP=…', accept: ['TP=2110' + tp[0], '2110' + tp[0]],
          q: `Quel paramètre le SDP d'un émetteur **${tp[1]}** porte-t-il pour annoncer son type ? (forme « TP=… »)`,
          pieges: ['TPN', 'TPNL', 'TPW'].filter((x) => x !== tp[0]).map((x) => ({ v: 'TP=2110' + x, why: `${x} est un autre type : N étroit espacé, NL étroit linéaire, W large.` })),
          aides: ['Le paramètre commence par « TP=2110 ».', 'Puis TPN (étroit), TPNL (étroit linéaire) ou TPW (large).'],
          solution: `**TP=2110${tp[0]}** : le récepteur sait ainsi s'il peut suivre l'émetteur.`,
        },
      ];
    },
  },
  'reseau-2022-7': {
    titre: 'Rouge et bleu : ce que répare la fusion',
    consigne: 'Le car double chaque flux sur les réseaux rouge et bleu : vous chiffrez ce que la fusion répare, le tampon qu\'elle demande, et ce qu\'elle ne couvre pas.',
    gen: (rnd) => {
      const pr = pick(rnd, [0.1, 0.5, 1, 2]), pb = pick(rnd, [0.1, 0.5, 1, 2]), n = 1e6;
      const perdus = Math.round(n * pr / 100 * pb / 100), rep = Math.round(n * (pr / 100 * (1 - pb / 100) + pb / 100 * (1 - pr / 100)));
      const fk = pick(rnd, ['1080p50', '2160p50']), V = video(fk), ec = pick(rnd, [100, 200, 300, 500]), tam = Math.round(ec * V.pps / 1e6);
      return [
        {
          type: 'nombre', unite: 'paquets', answer: perdus, tol: Math.max(0.5, perdus * 0.01),
          q: `Le réseau rouge perd **${fr(pr, 1)} %** des paquets, le bleu **${fr(pb, 1)} %**, de façon indépendante. Sur 1 000 000 de paquets, combien manquent encore après la fusion ST 2022-7 ?`,
          pieges: [{ v: Math.round(n * (pr + pb) / 100), why: 'Un paquet n\'est perdu que si ses deux copies manquent : multipliez les probabilités, n\'additionnez pas.' }, { v: Math.round(n * Math.max(pr, pb) / 100), why: 'C\'est la perte d\'un seul réseau : l\'autre copie la répare presque toujours.' }].filter((x) => x.v !== perdus),
          aides: ['On ne perd un paquet que si la copie rouge et la copie bleue manquent toutes les deux.', `Probabilité : ${fr(pr / 100, 3)} × ${fr(pb / 100, 3)}, sur 1 000 000 de paquets.`],
          solution: `${fr(pr / 100, 3)} × ${fr(pb / 100, 3)} × 10⁶ = **${fr(perdus)}** paquets ; tous les autres sont reçus ou réparés par l'autre réseau.`,
        },
        pick(rnd, [
          {
            type: 'nombre', unite: 'paquets', answer: rep, tol: rep * 0.01,
            q: `Mêmes réseaux (rouge ${fr(pr, 1)} %, bleu ${fr(pb, 1)} %). Sur 1 000 000 de paquets, combien sont **réparés** : une copie perdue, prise sur l'autre réseau ?`,
            aides: ['Réparé : perdu sur l\'un, reçu sur l\'autre. Deux cas.', `${fr(pr / 100, 3)} × (1 − ${fr(pb / 100, 3)}) + ${fr(pb / 100, 3)} × (1 − ${fr(pr / 100, 3)}), sur 10⁶.`],
            solution: `≈ **${fr(rep)}** paquets réparés sans qu'un pixel manque : c'est le compteur « réparés » de l'analyseur.`,
          },
          {
            type: 'nombre', unite: 'paquets', answer: tam, tol: 1,
            q: `Le bleu arrive **${ec} µs** après le rouge. Le flux **${FORMATS[fk]}** compte ${fr(V.pps)} paquets par seconde. Combien de paquets le récepteur doit-il garder en tampon pour attendre la copie la plus lente ?`,
            aides: ['Combien de paquets arrivent pendant l\'écart rouge / bleu ?', `${ec} µs × ${fr(V.pps)} paquets par seconde ÷ 10⁶.`],
            solution: `${ec} × 10⁻⁶ × ${fr(V.pps)} ≈ **${tam}** paquets : un récepteur ST 2022-7 se classe selon l'écart qu'il tolère.`,
          },
        ]),
        {
          type: 'texte', forme: 'ip', placeholder: 'a=…', accept: ['a=group:DUP'],
          q: 'Quelle ligne du SDP annonce que le flux est doublé sur deux réseaux (deux descriptions de média) ?',
          pieges: [{ v: 'a=source-filter', why: 'source-filter donne la source du flux (SSM), pas la redondance.' }],
          aides: ['C\'est un attribut (« a= ») qui groupe les deux médias.', 'Le groupe s\'appelle DUP, pour duplication.'],
          solution: '**a=group:DUP** : deux descriptions de média, une par réseau, même contenu, mêmes numéros de séquence.',
        },
        pick(rnd, [
          {
            type: 'choix', q: 'En plein direct, une spine rouge est coupée. Que voit le réalisateur ?',
            choices: ['Rien : chaque paquet arrive aussi par le bleu', ['Une image noire le temps de basculer', 'Ce n\'est pas une bascule : les deux chemins travaillent tout le temps, il n\'y a rien à détecter.'], ['Des macroblocs pendant quelques secondes', 'La fusion prend la première copie de chaque paquet : aucun ne manque.']], answer: 0,
            aides: ['Les deux réseaux portent chaque paquet en permanence.', 'Le récepteur garde la première copie arrivée de chaque numéro de séquence.'],
            solution: '**Rien** : la fusion ST 2022-7 prend chaque paquet sur le bleu ; aucun pixel ne manque.',
          },
          {
            type: 'choix', q: 'Quelle panne la redondance rouge / bleu ne couvre-t-elle pas ?',
            choices: ['La caméra émettrice qui tombe en panne', ['Une spine rouge coupée', 'Le bleu porte chaque paquet : la fusion couvre une fabric entière.'], ['Des pertes de 1 % sur le bleu', 'Le rouge répare presque tout : il ne reste qu\'un paquet sur 10 000 si le rouge perd autant.']], answer: 0,
            aides: ['La fusion répare ce qui manque sur un seul des deux réseaux.', 'Cherchez une panne commune aux deux copies.'],
            solution: 'L\'**émetteur en panne** : les deux copies manquent. De même une mauvaise configuration recopiée des deux côtés, ou une perte de PTP.',
          },
        ]),
      ];
    },
  },
  'reseau-spine-leaf': {
    titre: 'Dimensionner une fabric spine-leaf',
    consigne: 'Vous dimensionnez la fabric d\'un car IP : la capacité d\'une leaf vers le haut, les liens à poser, et le chemin d\'un flux.',
    gen: (rnd) => {
      const p = pick(rnd, [32, 48]), v = pick(rnd, [10, 25]), u = pick(rnd, [4, 6, 8]), Vu = 100, S = surabonnement(p, v, u, Vu);
      const Vu2 = pick(rnd, [100, 400]), nb = Math.ceil(p * v / Vu2);
      const L = pick(rnd, [4, 6, 8]), Sp = pick(rnd, [2, 4]), k = pick(rnd, [1, 2]);
      return [
        {
          type: 'nombre', unite: ': 1', answer: Math.round(S.ratio * 100) / 100, tol: 0.02,
          q: `Une leaf a **${p} ports à ${v} GbE** vers les appareils et **${u} liens à ${Vu} GbE** vers les spines. Quel est son surabonnement (capacité vers les appareils ÷ capacité vers les spines) ?`,
          pieges: [{ v: Math.round(S.haut / S.bas * 100) / 100, why: 'C\'est l\'inverse : on divise la capacité vers le bas par la capacité vers le haut.' }].filter((x) => Math.abs(x.v - S.ratio) > 0.03),
          aides: ['Capacité vers le bas = ports × vitesse ; vers le haut = liens montants × vitesse.', `${p} × ${v} ÷ (${u} × ${Vu}).`],
          solution: `${fr(S.bas)} Gb/s ÷ ${fr(S.haut)} Gb/s = **${fr(S.ratio, 2)} : 1**${S.ratio <= 1 ? ' : non bloquant, tout peut sortir de la leaf en même temps' : ' : si tous les appareils envoyaient ailleurs en même temps, ça ne passerait pas'}.`,
        },
        {
          type: 'nombre', unite: 'liens', answer: nb,
          q: `Pour qu'une leaf de **${p} ports à ${v} GbE** soit non bloquante (1 : 1), combien lui faut-il de liens montants à **${Vu2} GbE** ?`,
          pieges: [{ v: Math.floor(p * v / Vu2), why: 'Arrondissez au lien supérieur : avec un lien de moins, la leaf est surabonnée.' }].filter((x) => x.v !== nb),
          aides: ['Non bloquant : autant de capacité vers le haut que vers le bas.', `${p} × ${v} ÷ ${Vu2}, arrondi au-dessus.`],
          solution: `${fr(p * v)} Gb/s ÷ ${Vu2} = **${nb}** liens montants (arrondi au-dessus).`,
        },
        pick(rnd, [
          {
            type: 'nombre', unite: 'liens', answer: L * Sp * k,
            q: `Une fabric compte **${L} leaves** et **${Sp} spines** ; chaque leaf est reliée à chaque spine par **${k} lien${k > 1 ? 's' : ''}**. Combien de liens leaf-spine en tout, pour une fabric (rouge ou bleue) ?`,
            pieges: [{ v: L + Sp, why: 'Chaque leaf est reliée à chaque spine : c\'est un produit, pas une somme.' }],
            aides: ['Chaque leaf est reliée à chaque spine.', `${L} × ${Sp} paires, × ${k} lien${k > 1 ? 's' : ''} par paire.`],
            solution: `${L} × ${Sp} × ${k} = **${L * Sp * k}** liens, autant pour l'autre fabric.`,
          },
          {
            type: 'nombre', unite: 'commutateurs', answer: 3,
            q: 'D\'une caméra branchée sur une leaf à un mélangeur branché sur une autre leaf, combien de commutateurs un paquet traverse-t-il au plus dans une fabric spine-leaf ?',
            pieges: [{ v: 2, why: 'Deux leaves ne sont jamais reliées directement : il faut passer par une spine.' }],
            aides: ['Les leaves ne sont reliées qu\'aux spines.', 'Leaf de départ, une spine, leaf d\'arrivée.'],
            solution: '**3** : leaf, spine, leaf, jamais plus. Le retard est le même d\'un appareil à n\'importe quel autre.',
          },
        ]),
        pick(rnd, [
          {
            type: 'choix', q: 'Un flux UHD de 8,9 Gb/s sort d\'une leaf reliée à deux spines. Comment ECMP le répartit-il ?',
            choices: ['Tout le flux passe par une seule spine : ECMP répartit flux par flux', ['Moitié par chaque spine, paquet par paquet', 'ECMP ne coupe pas un flux : les paquets arriveraient dans le désordre.'], ['Par la spine la moins chargée, recalculée à chaque paquet', 'ECMP choisit le chemin d\'après les adresses et les ports du flux, pas d\'après la charge.']], answer: 0,
            aides: ['ECMP calcule le chemin à partir des adresses et des ports.', 'Même flux, mêmes adresses : même chemin.'],
            solution: '**Par une seule spine** : ECMP répartit par flux. Deux gros flux peuvent même tomber sur la même spine, d\'où le contrôleur SDN qui choisit lui-même les chemins.',
          },
          {
            type: 'choix', q: 'Le contrôleur SDN refuse de connecter un récepteur au flux d\'une caméra. Pourquoi, le plus souvent ?',
            choices: ['Le flux saturerait un lien du chemin', ['Le récepteur n\'est pas dans le même VLAN', 'Chaque leaf route : récepteur et source sont presque toujours dans des sous-réseaux différents.'], ['La caméra n\'a pas de SDP', 'Sans SDP, le contrôleur ne pourrait même pas proposer le flux.']], answer: 0,
            aides: ['Le contrôleur SDN tient le compte de la charge de chaque lien.', 'Il refuse ce qui ferait déborder un lien.'],
            solution: 'Le flux **saturerait un lien** : le contrôleur tient le compte de la capacité et refuse plutôt que de faire perdre des paquets à tout le monde (« refus SDN » du poste Réseau IP).',
          },
        ]),
      ];
    },
  },
  'reseau-nmos': {
    titre: 'Découvrir et connecter avec NMOS',
    consigne: 'Le contrôleur de diffusion connecte les flux du car IP : vous remettez la connexion dans l\'ordre, vous choisissez la bonne spécification et vous lisez un SDP.',
    gen: (rnd) => {
      const n = entre(rnd, 1, 12), bleu = rnd() < 0.5, B = pick(rnd, BESOINS_NMOS);
      const r = bleu ? 2 : 1, autre = bleu ? 1 : 2;
      const sdp = [`- \`m=video 5004 RTP/AVP 96\` (réseau rouge)`, `- \`c=IN IP4 239.1.1.${n}/32\``, `- \`a=source-filter: incl IN IP4 239.1.1.${n} 10.1.11.${n}\``, `- \`m=video 5004 RTP/AVP 96\` (réseau bleu)`, `- \`c=IN IP4 239.2.1.${n}/32\``, `- \`a=source-filter: incl IN IP4 239.2.1.${n} 10.2.11.${n}\``].join('\n');
      return [
        {
          type: 'ordre', q: 'Une caméra IP neuve est branchée ; le réalisateur veut la voir sur l\'entrée 4 du mélangeur. Remettez les étapes dans l\'ordre.',
          items: ['La caméra trouve le registre par DNS-SD', 'Elle s\'y enregistre : node, devices, senders, receivers (IS-04)', 'Le contrôleur lit le registre et affiche la caméra', 'Au « take », il envoie au récepteur un PATCH …/staged avec l\'émetteur et ses paramètres de transport (IS-05)', 'Le récepteur s\'abonne lui-même en IGMP (S, G) sur le rouge et le bleu'],
          aides: ['D\'abord être connu (IS-04), ensuite être connecté (IS-05).', 'NMOS ne transporte aucune image : à la fin, c\'est le récepteur qui s\'abonne au flux.'],
          solution: 'Découverte du registre, **enregistrement IS-04**, affichage par le contrôleur, **connexion IS-05**, puis abonnement IGMP du récepteur sur chaque réseau.',
        },
        {
          type: 'choix', q: `${B.q} Quelle spécification NMOS ?`,
          choices: [SPECS[B.ok][0], ...tirer(rnd, Object.keys(SPECS).filter((k) => k !== B.ok).map((k) => SPECS[k]), 2)], answer: 0,
          aides: ['IS-04 découvrir, IS-05 connecter.', 'IS-07 les événements (tally), IS-08 les canaux audio.'],
          solution: `**${SPECS[B.ok][0]}**. ${SPECS[B.ok][1]}`,
        },
        {
          type: 'texte', forme: 'ip', placeholder: '10.…', accept: [`10.${r}.11.${n}`],
          q: `Vous connectez la caméra ${n} **à la main** à une passerelle. Son SDP dit :\n${sdp}\nQuelle **adresse source** écrire pour le réseau **${bleu ? 'bleu' : 'rouge'}** ?`,
          pieges: [{ v: `239.${r}.1.${n}`, why: 'C\'est le groupe multicast (la destination) : la source est la dernière adresse de la ligne source-filter.' }, { v: `10.${autre}.11.${n}`, why: `C'est la source sur le réseau ${bleu ? 'rouge' : 'bleu'} : chaque réseau a sa carte et son adresse.` }],
          aides: ['La source se lit sur la ligne « a=source-filter » du bon réseau.', 'Sur cette ligne : d\'abord le groupe (destination), puis la source.'],
          solution: `**10.${r}.11.${n}** : la dernière adresse de la ligne source-filter du réseau ${bleu ? 'bleu' : 'rouge'}. Une seule erreur de source, et le filtre SSM ne laisse rien passer.`,
        },
        pick(rnd, [
          {
            type: 'choix', q: 'Le registre NMOS tombe en panne pendant le match. Que se passe-t-il ?',
            choices: ['Les flux déjà connectés continuent ; plus aucune nouvelle connexion', ['Toutes les images s\'arrêtent', 'NMOS ne transporte aucune image : les récepteurs restent abonnés à leurs flux.'], ['Rien du tout', 'Le contrôleur ne voit plus les appareils : impossible de faire un nouveau « take ».']], answer: 0,
            aides: ['NMOS transporte-t-il des images ?', 'Il dit qui doit recevoir quoi : sans lui, ce qui est établi reste établi.'],
            solution: 'Les **flux établis continuent**, mais plus aucune nouvelle connexion : NMOS dit qui reçoit quoi, il ne transporte rien.',
          },
          {
            type: 'choix', q: 'Une caméra disparaît du contrôleur alors que son image passe encore. Quelle explication ?',
            choices: ['Elle n\'envoie plus de signe de vie (heartbeat) au registre', ['Son flux multicast est coupé', 'Son image passe : le flux est là, c\'est l\'enregistrement qui manque.'], ['Le récepteur s\'est désabonné', 'Un désabonnement couperait l\'image chez le récepteur, sans retirer la caméra du registre.']], answer: 0,
            aides: ['Comment le registre sait-il qu\'un appareil est toujours là ?', 'Chaque appareil envoie un signe de vie régulier.'],
            solution: 'Plus de **heartbeat** : le registre retire l\'appareil, alors que ses flux continuent. On vérifie son réseau de contrôle, à part du réseau média.',
          },
        ]),
      ];
    },
  },
});

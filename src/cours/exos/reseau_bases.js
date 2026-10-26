// @ts-check
import { registerExos, entre, pick, tirer, fr } from '../exo.js';
import { infoReseau, decouper, prefixePour, typeAdresse, portee, classe, encapsuler, serialisationUs, fluxParLien, propagationMs, bondSatelliteMs, routeurNat, TETE } from '../ip_calc.js';

// ----------------------------------------------------------------------------------
// Exercices en autonomie du chapitre « Le réseau », parties « Les bases d'un réseau » et « Adresser et
// acheminer » : couches et encapsulation, étendues et retards, liens Ethernet, table MAC, VLAN, adresse et
// masque, réseau et diffusion, types d'adresses, DHCP et DNS, passerelle, traduction d'adresses. Les réponses
// sont calculées par le modèle des leçons (cours/ip_calc.js) avec des adresses tirées à chaque essai ; le plan
// du car SDI est celui des leçons : 10.1.<VLAN>.<machine>/24, passerelle en .1.
// ----------------------------------------------------------------------------------
/** une adresse privée réaliste : le car (10.1.x.x), une box (192.168.x.x), un réseau d'entreprise (172.16 à 31) */
function privee(rnd) {
  const f = pick(rnd, ['car', 'box', 'ent']);
  if (f === 'car') return `10.${pick(rnd, [1, 2, 20])}.${entre(rnd, 0, 99)}.${entre(rnd, 1, 254)}`;
  if (f === 'box') return `192.168.${entre(rnd, 0, 20)}.${entre(rnd, 1, 254)}`;
  return `172.${entre(rnd, 16, 31)}.${entre(rnd, 0, 255)}.${entre(rnd, 1, 254)}`;
}
/** une adresse d'appareil (ni réseau ni diffusion) et son préfixe */
function hote(rnd, prefixes) {
  for (;;) {
    const ip = privee(rnd), p = pick(rnd, prefixes), I = infoReseau(ip, p);
    if (!I.estReseau && !I.estBroadcast) return { ip, p, I };
  }
}
/** les pièges d'une réponse écrite : on retire ceux qui tombent sur la bonne réponse */
const sauf = (bonne, list) => list.filter((x) => String(x.v) !== String(bonne));
// le plan du car SDI (leçons VLAN et passerelle)
const PLAN = [
  { vlan: 10, nom: 'gestion', qui: 'le PC de supervision', fin: 50 },
  { vlan: 20, nom: 'caméras', qui: 'le RCP 3', fin: 33 },
  { vlan: 30, nom: 'production', qui: 'le processeur du mélangeur', fin: 10 },
  { vlan: 40, nom: 'ralentis', qui: 'le serveur EVS', fin: 21 },
  { vlan: 50, nom: 'intercom et son', qui: 'un panneau d\'intercom', fin: 61 },
  { vlan: 60, nom: 'fichiers', qui: 'le NAS', fin: 20 },
  { vlan: 90, nom: 'invités', qui: 'le portable d\'un invité', fin: 120 },
];
/** IPv6 : la forme complète et la forme abrégée (zéros de tête retirés, la plus longue suite de groupes nuls en « :: ») */
const v6long = (g) => g.map((x) => x.toString(16).padStart(4, '0')).join(':');
function v6court(g) {
  let best = -1, len = 0;
  for (let i = 0; i < 8;) { if (g[i] === 0) { let j = i; while (j < 8 && g[j] === 0) j++; if (j - i > len) { best = i; len = j - i; } i = j; } else i++; }
  const h = g.map((x) => x.toString(16));
  return len < 2 ? h.join(':') : h.slice(0, best).join(':') + '::' + h.slice(best + len).join(':');
}

registerExos({
  'reseau-modele': {
    titre: 'Envelopper, compter, dépanner par couche',
    consigne: 'Au poste Réseau IP, l\'analyseur déplie les paquets couche par couche : vous remettez les enveloppes dans l\'ordre, vous comptez ce qui passe sur le fil, puis vous dépannez de bas en haut.',
    gen: (rnd) => {
      const cas = pick(rnd, [
        { nom: 'un paquet d\'image ST 2110 (pixels dans RTP, sur UDP)', o: { transport: 'udp', rtp: true }, d: pick(rnd, [800, 1000, 1200, 1400]), couches: ['Les données : les pixels de l\'image', 'L\'en-tête RTP (numéro, horodatage)', 'L\'en-tête UDP (les ports)', 'L\'en-tête IP (les adresses)', 'La trame Ethernet (adresses MAC, contrôle)', 'Le préambule et le silence, sur le fil'] },
        { nom: 'une page web (HTTP, sur TCP)', o: { transport: 'tcp', rtp: false }, d: pick(rnd, [600, 1000, 1200, 1460]), couches: ['Les données : la page HTTP', 'L\'en-tête TCP (ports, numéros de séquence)', 'L\'en-tête IP (les adresses)', 'La trame Ethernet (adresses MAC, contrôle)', 'Le préambule et le silence, sur le fil'] },
        { nom: 'un ping (écho ICMP)', o: { transport: 'icmp', rtp: false }, d: pick(rnd, [56, 100, 500, 1000]), couches: ['Les données de l\'écho', 'L\'en-tête ICMP (type « écho »)', 'L\'en-tête IP (les adresses)', 'La trame Ethernet (adresses MAC, contrôle)', 'Le préambule et le silence, sur le fil'] },
      ]);
      const arrivee = rnd() < 0.5;
      const E = encapsuler(cas.d, cas.o);
      const ip = E.couches.find((c) => c.couche === 3 && c.nom.startsWith('IP')).total;
      const tetes = cas.o.rtp ? 'RTP 12, UDP 8' : cas.o.transport === 'tcp' ? 'TCP 20' : 'ICMP 8';
      return [
        {
          type: 'ordre', items: arrivee ? cas.couches.slice().reverse() : cas.couches,
          q: arrivee ? `À l'arrivée, la carte réseau reçoit **${cas.nom}**. Dans quel ordre chaque couche lit-elle et retire-t-elle son enveloppe (la décapsulation) ? De la première lue à la dernière.` : `À l'émission, **${cas.nom}** descend la pile. Dans quel ordre les enveloppes s'ajoutent-elles (l'encapsulation) ? De la première à la dernière.`,
          aides: [arrivee ? 'À l\'arrivée, on ouvre d\'abord l\'enveloppe extérieure, celle qui a été ajoutée en dernier.' : 'Chaque couche ajoute son en-tête devant ce que lui donne la couche du dessus : on part de l\'application.', 'L\'ordre des couches : application, transport (ports), réseau (IP), liaison (Ethernet), physique (le fil).'],
          solution: arrivee ? 'La décapsulation remonte la pile : le fil, la trame Ethernet, le paquet IP, le transport, puis les données. Chaque couche lit son en-tête et le retire.' : 'L\'encapsulation descend la pile : les données, puis le transport, IP, Ethernet, et enfin le préambule et le silence sur le fil.',
        },
        {
          type: 'nombre', unite: 'octets', answer: E.surFil,
          q: `${cas.nom.charAt(0).toUpperCase() + cas.nom.slice(1)} porte **${fr(cas.d)} octets** de données. En-têtes : ${tetes}, IP 20, Ethernet 18 (adresses, type, contrôle) ; sur le fil, 20 de plus (préambule et silence). Combien d'octets occupe-t-il sur le fil ?`,
          pieges: [{ v: ip, why: 'C\'est la taille du paquet IP : il manque l\'enveloppe Ethernet et ce que le fil ajoute.' }, { v: E.surFil - TETE.fil, why: 'C\'est la trame Ethernet : sur le fil s\'ajoutent encore le préambule et le silence entre deux trames, 20 octets.' }],
          aides: ['Additionnez toutes les enveloppes, de l\'application jusqu\'au fil.', `${fr(cas.d)} + ${tetes.replace(/[A-Z]+ /g, '').replace(', ', ' + ')} + 20 (IP) + 18 (Ethernet) + 20 (fil).`],
          solution: `${E.couches.map((c) => `${c.nom} : ${fr(c.total)}`).join(' ; ')}. Sur le fil : **${fr(E.surFil)} octets**, dont ${fr(E.efficacite * 100, 0)} % de données utiles.`,
        },
        pick(rnd, [
          {
            type: 'choix', q: 'Le commutateur du car reçoit une trame. Quelle adresse lit-il pour la faire suivre ?',
            choices: ['L\'adresse MAC de destination (couche 2)', ['L\'adresse IP de destination (couche 3)', 'C\'est le travail du routeur. Un commutateur n\'ouvre que la trame Ethernet.'], ['Le port UDP (couche 4)', 'Le port est lu par la machine qui reçoit, ou par un pare-feu ; jamais par un simple commutateur.']], answer: 0,
            aides: ['Un commutateur est un appareil « de niveau 2 ».', 'Niveau 2 : la liaison, la trame, les adresses MAC.'],
            solution: 'L\'**adresse MAC** : le commutateur travaille à la couche 2. Le routeur lit l\'IP (couche 3), le pare-feu va jusqu\'au port (couche 4).',
          },
          {
            type: 'choix', q: 'Un pare-feu laisse passer la supervision mais bloque le serveur web de la CCU (port 80). Jusqu\'à quelle couche lit-il ?',
            choices: ['La couche 4 (transport) : il lit le port', ['La couche 2 (liaison)', 'La couche 2 ne connaît que les adresses MAC : elle ne sait pas quel service est visé.'], ['La couche 1 (physique)', 'La couche physique ne voit que des bits sur un câble.']], answer: 0,
            aides: ['Qu\'est-ce qui désigne le logiciel (le service) dans une machine ?', 'Le port appartient à l\'en-tête TCP ou UDP.'],
            solution: 'La **couche 4** : le port (80, le web) est dans l\'en-tête TCP. Filtrer par service, c\'est lire jusqu\'au transport.',
          },
          {
            type: 'choix', q: 'Le modèle TCP/IP, celui d\'Internet, regroupe les sept couches d\'OSI. En combien ?',
            choices: ['Quatre : accès réseau, Internet, transport, application', ['Cinq : on garde la session à part', 'Dans TCP/IP, session et présentation vivent dans l\'application.'], ['Sept, comme OSI', 'C\'est le modèle OSI ; TCP/IP en regroupe plusieurs.']], answer: 0,
            aides: ['Les couches 1 et 2 d\'OSI forment une seule couche dans TCP/IP, comme les couches 5, 6 et 7.', 'Il reste : accès réseau, Internet (IP), transport, application.'],
            solution: '**Quatre** (RFC 1122) : accès réseau (1 et 2), Internet (3), transport (4), application (5 à 7). On garde pourtant les numéros d\'OSI dans le métier.',
          },
        ]),
        {
          type: 'ordre', items: ['Le voyant du port et la vitesse négociée', 'Le VLAN du port et la table MAC du commutateur', 'L\'adresse, le masque, la passerelle, puis le ping', 'Le service : le port écouté, le pare-feu, le réglage du logiciel'],
          q: `Le ${pick(rnd, ['RCP 4', 'panneau d\'intercom 2', 'PC d\'habillage', 'serveur EVS'])} ne répond plus. Dans quel ordre vérifiez-vous, en dépannant de bas en haut ?`,
          aides: ['On commence par la couche 1, la plus basse : le câble.', 'Couche 1 (physique), 2 (liaison : VLAN, MAC), 3 (réseau : IP), 4 et au-delà (le service).'],
          solution: 'De **bas en haut** : le voyant (1), le VLAN et la table MAC (2), l\'adresse et le ping (3), le service (4 et au-delà). Sauter une couche fait perdre du temps.',
        },
      ];
    },
  },
  'reseau-etendue': {
    titre: 'Du car au monde : distances et retards',
    consigne: 'Le chef de car prépare la contribution vers la régie finale : vous classez les réseaux du dispositif et vous calculez les retards de chaque chemin.',
    gen: (rnd) => {
      const V = pick(rnd, [['Lille', 40], ['Paris', 250], ['Lyon', 700], ['Marseille', 1000], ['Bruxelles', 120], ['Strasbourg', 520]]);
      const ar = rnd() < 0.5, km = V[1], t = propagationMs(km) * (ar ? 2 : 1);
      const bonds = pick(rnd, [1, 2]), sat = bondSatelliteMs() * bonds;
      return [
        {
          type: 'nombre', unite: 'ms', answer: Math.round(t * 1000) / 1000, tol: Math.max(0.01, t * 0.03),
          q: `La fibre de l'opérateur fait **${fr(km)} km** entre le stade et la régie de ${V[0]}. Combien de temps met la lumière pour ${ar ? 'un **aller-retour**' : 'un **aller**'}, en millisecondes (propagation seule) ?`,
          pieges: [{ v: Math.round(t / (ar ? 2 : 0.5) * 1000) / 1000, why: ar ? 'C\'est un aller seul : un aller-retour parcourt deux fois la fibre.' : 'C\'est un aller-retour : la question ne demande qu\'un sens.' }, { v: Math.round(km / 300 * (ar ? 2 : 1) * 1000) / 1000, why: 'C\'est la vitesse de la lumière dans le vide : dans le verre, elle ne fait qu\'environ 200 000 km/s.' }],
          aides: ['Dans le verre, la lumière parcourt environ 200 000 km/s : environ 5 µs par kilomètre.', `${fr(km)} km × 5 µs${ar ? ' × 2 (aller et retour)' : ''}, puis convertissez en ms (1 ms = 1 000 µs).`],
          solution: `${fr(km)} km ÷ 204 000 km/s${ar ? ' × 2' : ''} ≈ **${fr(t, 2)} ms**, avant la traversée des équipements et l'attente dans les files.`,
        },
        {
          type: 'nombre', unite: 'ms', answer: Math.round(sat), tol: Math.max(3, sat * 0.02),
          q: bonds === 1 ? `Le secours part par **satellite géostationnaire** (35 786 km d'altitude) : montée puis descente. Combien de millisecondes pour ce bond, au plus court et sans le codage ?` : `En duplex par **satellite géostationnaire** (35 786 km), le commentateur de Paris pose une question au journaliste du stade : sa voix fait un bond, la réponse un autre. Combien de millisecondes de propagation avant qu'il entende le début de la réponse ?`,
          pieges: [{ v: Math.round(bondSatelliteMs() * (bonds === 1 ? 2 : 1)), why: bonds === 1 ? 'Ce sont deux bonds : la question n\'en demande qu\'un (montée et descente).' : 'C\'est un seul bond : la question part au stade, puis la réponse revient, deux bonds.' }, { v: Math.round(propagationMs(35786, 'air') * bonds), why: 'Un bond, c\'est la montée vers le satellite puis la descente : deux fois l\'altitude.' }],
          aides: ['Un bond = monter au satellite puis redescendre : deux fois 35 786 km, dans l\'air, à ≈ 300 000 km/s.', `${bonds === 1 ? '' : '2 bonds × '}2 × 35 786 km ÷ 299 792 km/s, en millisecondes.`],
          solution: `Un bond : 71 572 km ÷ 299 792 km/s ≈ 239 ms${bonds === 2 ? ` ; question et réponse : **${fr(sat, 0)} ms**, d'où les silences gênés d'un duplex par satellite` : ` : **${fr(sat, 0)} ms**, sans compter le codage`}.`,
        },
        pick(rnd, [
          { type: 'choix', q: 'Le réseau du car, avec ses commutateurs, ses VLAN et sa QoS, est…', choices: ['Un LAN : un lieu, un exploitant qui choisit tout', ['Un MAN, parce que le car se déplace', 'L\'étendue se juge à la zone couverte : quelques dizaines de mètres.'], ['Un WAN, parce qu\'il sort sur Internet', 'Il a une sortie vers un WAN, mais lui-même reste local.']], answer: 0, aides: ['L\'étendue se juge à la zone couverte et à qui possède les liens.', 'Un lieu, un exploitant : c\'est le réseau local.'], solution: 'Un **LAN** : il couvre un lieu et appartient à celui qui l\'exploite.' },
          { type: 'choix', q: 'Le stade est relié au centre technique de l\'opérateur, de l\'autre côté de la ville, par une boucle de fibre louée. Quel réseau est-ce ?', choices: ['Un MAN (réseau métropolitain)', ['Un LAN', 'Un LAN couvre un seul lieu ; ici on relie deux sites de la ville.'], ['Un PAN', 'Un PAN est un réseau personnel, quelques mètres (Bluetooth).']], answer: 0, aides: ['Deux sites de la même ville, à quelques kilomètres.', 'Metropolitan Area Network.'], solution: 'Un **MAN** : des boucles de fibre qui relient les sites d\'une ville, quelques dizaines de kilomètres.' },
          { type: 'choix', q: 'La contribution du car vers la régie finale de Paris, par la fibre d\'un opérateur, passe par…', choices: ['Un WAN : des liens d\'opérateurs entre des villes', ['Un MAN', 'Un MAN reste dans une ville ; Lens et Paris sont à 200 km.'], ['Le LAN du car', 'Le LAN s\'arrête à la sortie du car ; au-delà, on dépend d\'opérateurs.']], answer: 0, aides: ['Des villes différentes, des liens qui ne vous appartiennent pas.', 'Wide Area Network.'], solution: 'Un **WAN** : on y dépend d\'opérateurs, on double les chemins et on mesure latence et pertes avant l\'antenne.' },
        ]),
        pick(rnd, [
          { type: 'choix', q: 'Pour un duplex en direct (un dialogue entre le plateau et le stade), quel chemin choisir ?', choices: ['La fibre d\'opérateur : quelques millisecondes', ['Le satellite géostationnaire : il couvre tout le pays', 'Un bond fait ≈ 240 ms dans un sens, au-delà des 150 ms recommandées pour une conversation (UIT G.114).'], ['N\'importe lequel : la latence ne s\'entend pas', 'Au-delà de 150 ms dans un sens, les interlocuteurs se coupent la parole et laissent des silences.']], answer: 0, aides: ['L\'UIT recommande de rester sous 150 ms dans un sens pour une conversation (G.114).', 'Comparez un bond satellite (≈ 240 ms) à quelques centaines de kilomètres de fibre (≈ 1 ms).'], solution: 'La **fibre** : quelques millisecondes, bien sous les 150 ms de la G.114. Le satellite reste le secours.' },
          { type: 'choix', q: 'En production à distance (REMI), les caméras sont au stade et la régie à Paris. Où se ressent la latence du WAN ?', choices: ['Dans les commandes des RCP et le retour des images en régie', ['Nulle part : le réseau est en fibre', 'La fibre ajoute environ 5 µs par kilomètre, et les équipements s\'y ajoutent : tout se retrouve dans la boucle de commande.'], ['Seulement dans le son', 'Images et commandes traversent le même WAN : tout est retardé.']], answer: 0, aides: ['Que traverse le WAN dans une production à distance ?', 'Les images vont du stade à la régie, les commandes de la régie au stade.'], solution: 'Dans les **commandes et le retour des images** : chaque réglage du RCP fait l\'aller-retour du WAN avant de se voir.' },
        ]),
      ];
    },
  },
  'reseau-ethernet': {
    titre: 'Dimensionner un lien Ethernet',
    consigne: 'Le car IP reçoit de nouvelles caméras : vous comptez les flux qu\'un lien peut porter, le temps de poser une trame, sa taille, et le bon support.',
    gen: (rnd) => {
      const F = pick(rnd, [{ nom: '1080p50 (≈ 2,2 Gb/s)', g: 2.2 }, { nom: 'UHD 2160p50 (≈ 8,6 Gb/s)', g: 8.6 }]);
      const L = pick(rnd, F.g > 5 ? [25, 100] : [10, 25, 100]);
      const n = fluxParLien(F.g, L);
      const d = pick(rnd, [64, 500, 1000, 1500]), g = pick(rnd, [1, 10, 25]), fil = d + TETE.eth + TETE.fil, us = serialisationUs(fil, g);
      const vlan = rnd() < 0.4, x = pick(rnd, vlan ? [46, 200, 1200, 1500] : [20, 30, 46, 200, 1200, 1500]), trame = Math.max(46, x) + TETE.eth + (vlan ? TETE.vlan : 0);
      const brut = Math.floor(L / F.g + 1e-9);
      return [
        {
          type: 'nombre', unite: 'flux', answer: n,
          q: `Combien de flux ST 2110 **${F.nom}** peut-on faire passer sur un lien **${L} GbE**, en gardant 10 % de marge (90 % de charge au plus) ?`,
          pieges: sauf(n, [{ v: brut, why: 'C\'est le lien rempli à 100 % : les flux arrivent par rafales, on garde 10 % de marge.' }]),
          aides: ['Un lien n\'est jamais rempli à 100 % : on n\'en utilise que 90 %.', `${L} × 0,9 ÷ ${fr(F.g, 1)}, arrondi au nombre entier inférieur.`],
          solution: `${L} × 0,9 = ${fr(L * 0.9, 1)} Gb/s utiles ; ÷ ${fr(F.g, 1)} = ${fr(L * 0.9 / F.g, 2)} : **${n} flux**.`,
        },
        {
          type: 'nombre', unite: 'µs', answer: Math.round(us * 1000) / 1000, tol: us * 0.02,
          q: `Une trame porte **${fr(d)} octets** de données ; avec l'en-tête et le contrôle Ethernet (18 octets), le préambule et le silence (20), elle occupe ${fr(fil)} octets sur le fil. Combien de microsecondes pour la poser sur un lien **${g} GbE** ?`,
          pieges: [{ v: Math.round(fil / (g * 1e3) * 1000) / 1000, why: 'Il faut compter en bits : un octet en fait 8.' }],
          aides: ['Le temps de sérialisation, c\'est le nombre de bits divisé par le débit.', `${fr(fil)} octets × 8 bits ÷ ${g} × 10⁹ b/s, puis convertissez en µs.`],
          solution: `${fr(fil)} × 8 = ${fr(fil * 8)} bits ÷ ${g} Gb/s = **${fr(us, 3)} µs**. Dix fois plus de débit, dix fois moins de temps ; la propagation, elle, ne change pas.`,
        },
        {
          type: 'nombre', unite: 'octets', answer: trame,
          q: `Une trame Ethernet${vlan ? ' **étiquetée 802.1Q** (elle passe sur un trunk)' : ''} transporte **${fr(x)} octets** de données. Combien d'octets fait-elle, de l'adresse de destination au FCS (sans le préambule) ?`,
          pieges: sauf(trame, [x < 46 ? { v: x + TETE.eth + (vlan ? TETE.vlan : 0), why: 'Les données d\'une trame font au moins 46 octets : une trame plus courte est complétée.' } : null, vlan ? { v: x + TETE.eth, why: 'Il manque l\'étiquette 802.1Q : 4 octets entre l\'adresse source et le type.' } : null].filter(Boolean)),
          aides: ['Adresses MAC (6 + 6), type (2), FCS (4) : 18 octets autour des données' + (vlan ? ', plus l\'étiquette VLAN (4).' : '.'), 'Les données font de 46 à 1 500 octets : en dessous de 46, la trame est complétée.'],
          solution: `${x < 46 ? `${x} octets sont complétés à 46 ; ` : ''}${fr(Math.max(46, x))} + 18${vlan ? ' + 4' : ''} = **${fr(trame)} octets**${trame === 64 ? ' : la plus petite trame Ethernet' : ''}.`,
        },
        pick(rnd, [
          { type: 'choix', q: 'Il faut relier deux commutateurs en 10 GbE à **400 m** l\'un de l\'autre. Quel support ?', choices: ['Une fibre monomode et des modules SFP+ « LR » (10 km)', ['Un câble RJ45 de catégorie 6A', 'Le cuivre s\'arrête à 100 m, même en catégorie 6A.'], ['Une fibre multimode et des modules SFP+ « SR »', 'En multimode OM3, le 10 GbE porte environ 300 m : 400 m, c\'est trop.']], answer: 0, aides: ['Le cuivre est limité à 100 m.', 'Multimode « SR » : quelques centaines de mètres au plus ; monomode « LR » : 10 km.'], solution: 'La **fibre monomode** en SFP+ LR : 400 m dépassent le cuivre (100 m) et le multimode en 10 GbE (≈ 300 m en OM3).' },
          { type: 'choix', q: 'Un panneau d\'intercom neuf, à 25 m du commutateur, doit être relié et alimenté. Comment ?', choices: ['Un câble RJ45 et un port PoE du commutateur', ['Une fibre et un module SFP', 'La fibre ne transporte pas d\'énergie : il faudrait une alimentation à part.'], ['Un câble RJ45 et l\'alimentation par la fibre', 'C\'est le cuivre qui peut alimenter (PoE), pas la fibre.']], answer: 0, aides: ['Moins de 100 m : le cuivre suffit.', 'Le cuivre Ethernet peut aussi alimenter l\'appareil : c\'est le PoE.'], solution: 'Un **RJ45 en PoE** : 25 m tiennent dans les 100 m du cuivre, et le port alimente le panneau.' },
          { type: 'choix', q: 'Une copie de fichiers vers le NAS se traîne à un dixième du débit attendu ; le voyant du port est allumé. Premier réflexe ?', choices: ['Lire la vitesse négociée du port : un câble abîmé l\'a fait tomber à 100 Mb/s', ['Changer l\'adresse IP du NAS', 'L\'adresse ne change pas le débit ; un problème d\'adresse empêcherait la copie.'], ['Passer en trames géantes', 'Les trames géantes font gagner quelques pour cent, pas un facteur dix.']], answer: 0, aides: ['Un facteur dix exactement, voyant allumé : la couche 1 négocie.', '1 Gb/s et 100 Mb/s : les deux vitesses que l\'autonégociation peut choisir.'], solution: 'La **vitesse négociée** : un câble mal serti fait tomber un port Gigabit à 100 Mb/s, tout « marche », dix fois trop lentement.' },
        ]),
      ];
    },
  },
  'reseau-switch': {
    titre: 'Suivre la table MAC',
    consigne: 'Au poste Réseau, le commutateur SW-VISION vient de redémarrer : sa table MAC est vide. Vous suivez les premières trames et ce qu\'il en apprend.',
    gen: (rnd) => {
      const ports = tirer(rnd, [1, 2, 3, 4, 5, 6, 7, 8], 4).sort((a, b) => a - b);
      const M = tirer(rnd, [{ nom: 'le RCP 1', mac: '02:1A:20:00:00:31' }, { nom: 'la CCU 1', mac: '02:1A:20:00:00:11' }, { nom: 'le RCP 2', mac: '02:1A:20:00:00:32' }, { nom: 'la CCU 2', mac: '02:1A:20:00:00:12' }, { nom: 'le PC de supervision', mac: '02:1A:10:00:00:50' }], 4).map((m, k) => ({ ...m, port: ports[k] }));
      const [A, B, C, D] = tirer(rnd, M, 4);
      const liste = (ps) => (ps.length === 1 ? `Le port ${ps[0]} seulement` : `Les ports ${ps.slice(0, -1).join(', ')} et ${ps[ps.length - 1]}`);
      const sauf1 = (m) => M.filter((x) => x !== m).map((x) => x.port);
      // trame 3 : C écrit à B (déjà appris) ou à D (jamais entendu)
      const vers = rnd() < 0.5 ? B : D, connu = vers === B;
      const c3 = connu ? [liste([B.port]), [liste(sauf1(C)), 'Le commutateur a appris le port de ' + B.nom + ' à la trame 2 : inutile d\'inonder.'], ['Aucun : la trame est jetée', 'Le commutateur ne jette pas une trame dont il connaît la destination.']]
        : [liste(sauf1(C)), [liste([D.port]), D.nom + ' n\'a encore rien envoyé : le commutateur ignore où il est.'], ['Aucun : la trame est jetée', 'Une destination inconnue n\'est pas jetée : elle est inondée.']];
      const entrees = new Set([A, B, C].map((m) => m.mac)).size;
      return [
        {
          type: 'choix', q: `Trame 1 : **${A.nom}** (port ${A.port}) envoie une trame vers **${B.nom}** (port ${B.port}). La table est vide. Par où la trame sort-elle ?`,
          choices: [liste(sauf1(A)), [liste([B.port]), 'Le commutateur ne sait pas encore où est ' + B.nom + ' : sa table est vide.'], ['Aucun : la trame est jetée', 'Une destination inconnue n\'est pas jetée : elle est recopiée partout, la machine visée répondra.']], answer: 0,
          aides: ['Le commutateur apprend l\'adresse source ; que fait-il d\'une destination qu\'il ne connaît pas ?', 'Destination inconnue : inondation sur tous les ports, sauf celui d\'entrée.'],
          solution: `**${liste(sauf1(A))}** : c'est l'inondation. Au passage, le commutateur a appris que ${A.mac} est derrière le port ${A.port}.`,
        },
        {
          type: 'choix', q: `Trame 2 : **${B.nom}** répond ; sa trame va vers **${A.nom}**. Par où sort-elle ?`,
          choices: [liste([A.port]), [liste(sauf1(B)), 'Le commutateur a appris le port de ' + A.nom + ' à la trame 1 : plus besoin d\'inonder.'], ['Aucun : la trame est jetée', 'La destination est connue, la trame part par son port.']], answer: 0,
          aides: ['Qu\'a appris le commutateur en recevant la trame 1 ?', 'L\'adresse source de la trame 1 était celle de ' + A.nom + ', entrée par le port ' + A.port + '.'],
          solution: `**${liste([A.port])}** : la destination est apprise. Le commutateur note aussi ${B.mac} derrière le port ${B.port}.`,
        },
        {
          type: 'choix', q: `Trame 3 : **${C.nom}** (port ${C.port}) envoie une trame vers **${vers.nom}**. Par où sort-elle ?`,
          choices: c3, answer: 0,
          aides: ['Faites la liste des adresses sources déjà vues aux trames 1 et 2.', connu ? `${B.nom} a envoyé la trame 2 : son port est connu.` : `${D.nom} n'a encore rien envoyé.`],
          solution: connu ? `**${liste([B.port])}** : ${B.nom} est connu depuis la trame 2.` : `**${liste(sauf1(C))}** : ${D.nom} n'a encore jamais parlé, sa destination est inconnue ; sa première réponse l'apprendra au commutateur.`,
        },
        pick(rnd, [
          {
            type: 'nombre', answer: entrees, unite: 'entrées',
            q: 'Après ces trois trames, combien d\'entrées compte la table MAC du commutateur ?',
            pieges: sauf(entrees, [{ v: 4, why: 'Une machine qui n\'a encore rien envoyé n\'est dans aucune table : seules les adresses sources sont apprises.' }, { v: 2, why: 'Chaque trame apprend l\'adresse source de celle qui l\'envoie : la trame 3 en apprend une de plus.' }]),
            aides: ['Le commutateur n\'apprend que les adresses sources.', 'Comptez les machines qui ont envoyé une trame.'],
            solution: `**${entrees}** : ${A.nom}, ${B.nom} et ${C.nom}, les trois expéditeurs. ${D.nom.charAt(0).toUpperCase() + D.nom.slice(1)} n'y est pas : aucune trame n'en est encore partie.`,
          },
          {
            type: 'texte', forme: 'ip', accept: ['FF:FF:FF:FF:FF:FF', 'FF-FF-FF-FF-FF-FF', 'FFFF.FFFF.FFFF'], placeholder: 'xx:xx:xx:xx:xx:xx',
            q: `Avant d'écrire à une machine voisine, ${A.nom} lui demande son adresse MAC par **ARP**. À quelle adresse MAC de destination la question est-elle envoyée ?`,
            pieges: [{ v: B.mac, why: 'Justement, ' + A.nom + ' ne la connaît pas encore : c\'est ce qu\'il demande.' }, { v: '00:00:00:00:00:00', why: 'Une adresse nulle ne désigne personne ; la question doit atteindre tout le monde.' }],
            aides: ['La question doit être entendue par toutes les machines du VLAN.', 'C\'est l\'adresse de diffusion : tous ses bits sont à 1.'],
            solution: '**FF:FF:FF:FF:FF:FF**, la diffusion : toutes les machines du VLAN l\'entendent, seule celle qui a l\'adresse IP demandée répond.',
          },
        ]),
      ];
    },
  },
  'reseau-vlan': {
    titre: 'Ranger les ports en VLAN',
    consigne: 'Le car SDI sépare ses usages : 10 gestion, 20 caméras, 30 production, 40 ralentis, 50 intercom et son, 60 fichiers, 90 invités. Vous rangez des ports et vous suivez une diffusion.',
    gen: (rnd) => {
      const [U, X, Y] = tirer(rnd, PLAN, 3);
      // un commutateur de six ports access et un trunk (port 24) vers SW-CŒUR
      const vl = tirer(rnd, [20, 30, 50], 3);
      const rangs = tirer(rnd, pick(rnd, [[0, 0, 1, 1, 2, 2], [0, 0, 0, 1, 1, 2], [0, 1, 1, 2, 2, 2]]), 6);
      const ports = [1, 2, 3, 4, 5, 6].map((p, k) => ({ p, vlan: vl[rangs[k]] }));
      const src = pick(rnd, ports.filter((x) => ports.filter((y) => y.vlan === x.vlan).length > 1));
      const memes = ports.filter((x) => x.vlan === src.vlan && x !== src).map((x) => x.p);
      const autres = ports.filter((x) => x !== src).map((x) => x.p);
      const liste = (ps) => (ps.length > 1 ? `les ports ${ps.slice(0, -1).join(', ')} et ${ps[ps.length - 1]}` : `le port ${ps[0]}`);
      const d = pick(rnd, [100, 500, 1000, 1500]);
      return [
        {
          type: 'choix', q: `On branche **${U.qui}** sur un port neuf de SW-PROD. Dans quel VLAN mettre ce port access ?`,
          choices: [`VLAN ${U.vlan} (${U.nom})`, [`VLAN ${X.vlan} (${X.nom})`, `Le VLAN ${X.vlan} est celui de « ${X.nom} » : ${U.qui} y serait isolé de ses interlocuteurs et de sa passerelle.`], [`VLAN ${Y.vlan} (${Y.nom})`, `Le VLAN ${Y.vlan} est celui de « ${Y.nom} » : ${U.qui} n'y a rien à faire.`]], answer: 0,
          aides: ['Chaque VLAN du car regroupe un usage.', `Quel est l'usage de ${U.qui} ?`],
          solution: `Le **VLAN ${U.vlan}** (${U.nom}). Le VLAN se règle sur le commutateur, pas dans la machine : elle envoie des trames ordinaires.`,
        },
        {
          type: 'choix', q: `Sur ce commutateur, ${ports.map((x) => `port ${x.p} en VLAN ${x.vlan}`).join(', ')} ; le port 24 est un trunk vers SW-CŒUR. La machine du **port ${src.p}** envoie une diffusion ARP. Par où sort-elle ?`,
          choices: [`Par ${liste(memes)} et par le trunk, étiquetée VLAN ${src.vlan}`, [`Par ${liste(autres)} et le trunk`, 'Le VLAN borne le domaine de diffusion : les ports des autres VLAN ne la reçoivent pas.'], [`Par ${liste(memes)} seulement`, 'Le trunk transporte tous les VLAN : la diffusion le traverse, étiquetée, vers les machines du VLAN de l\'autre commutateur.']], answer: 0,
          aides: [`La trame est rangée dans le VLAN de son port d'entrée, le ${src.vlan}.`, 'Elle ressort sur les autres ports de ce VLAN, et sur le trunk avec son étiquette 802.1Q.'],
          solution: `Par **${liste(memes)}**, sans étiquette, et par le **trunk** avec l'étiquette « VLAN ${src.vlan} » ; les autres VLAN ne l'entendent pas.`,
        },
        {
          type: 'nombre', unite: 'octets', answer: d + TETE.eth + TETE.vlan,
          q: `Une trame portant **${fr(d)} octets** de données traverse le trunk entre SW-PROD et SW-CŒUR. Combien d'octets fait-elle, en-tête Ethernet, étiquette 802.1Q et contrôle compris (sans le préambule) ?`,
          pieges: [{ v: d + TETE.eth, why: 'C\'est la trame sans étiquette : sur un trunk, 4 octets de 802.1Q s\'ajoutent.' }, { v: d + TETE.vlan, why: 'Il manque l\'en-tête Ethernet et le contrôle : 18 octets.' }],
          aides: ['L\'en-tête et le contrôle Ethernet font 18 octets.', 'Sur un trunk, l\'étiquette 802.1Q ajoute 4 octets entre l\'adresse source et le type.'],
          solution: `${fr(d)} + 18 + 4 = **${fr(d + 22)} octets**. L'étiquette porte le numéro de VLAN (12 bits) et la priorité (3 bits).`,
        },
        pick(rnd, [
          { type: 'choix', q: 'Toutes les machines du VLAN 20 branchées sur SW-VISION disparaissent d\'un coup ; celles des autres VLAN de ce commutateur répondent. Cause probable ?', choices: ['Le VLAN 20 a été retiré des VLAN autorisés sur le trunk', ['Le câble du trunk est coupé', 'Coupé, il isolerait aussi les autres VLAN, qui répondent encore.'], ['Les machines ont perdu leur réglage de VLAN', 'Une machine sur un port access ne connaît pas son VLAN : il se règle sur le commutateur.']], answer: 0, aides: ['Un seul VLAN est touché, sur un seul commutateur.', 'Par quel câble passent tous les VLAN entre deux commutateurs ?'], solution: 'Le **VLAN retiré du trunk** : ses trames ne passent plus, toutes ses machines de l\'autre côté disparaissent ensemble.' },
          { type: 'choix', q: 'Un RCP est branché sur un port access du VLAN 30 au lieu du 20. Que voit-on ?', choices: ['Le voyant est allumé, mais le RCP ne joint plus ni sa CCU ni sa passerelle', ['Le voyant du port est éteint', 'Le câble et le port vont bien : la couche 1 est bonne.'], ['Rien : le VLAN ne change rien au RCP', 'Dans un autre domaine de diffusion, ses requêtes ARP n\'atteignent plus la CCU.']], answer: 0, aides: ['Le niveau physique est-il touché ?', 'Le VLAN borne le domaine de diffusion : qui reçoit encore ses requêtes ARP ?'], solution: 'Le **voyant reste allumé** mais le RCP est isolé : panne qui ressemble à un câble coupé, à corriger sur le commutateur.' },
          { type: 'choix', q: 'Pourquoi le car met-il l\'intercom dans son propre VLAN ?', choices: ['Pour que la voix ait sa priorité et ne subisse ni les diffusions ni les pannes des autres usages', ['Parce que les panneaux d\'intercom n\'ont pas d\'adresse IP', 'Ils ont une adresse IP, comme toutes les machines du réseau de contrôle.'], ['Parce qu\'un VLAN ne regroupe qu\'une marque d\'appareils', 'La marque n\'a rien à voir : on range par usage.']], answer: 0, aides: ['Trois raisons de séparer : la panne, la priorité, la sécurité.', 'Une boucle ou une machine bavarde dans un VLAN ne touche que lui.'], solution: 'Pour la **priorité et l\'isolement** : la QoS « voix » se règle par VLAN, et une boucle ailleurs ne coupe pas la régie.' },
        ]),
      ];
    },
  },
  'reseau-ip': {
    titre: 'Adresse, masque : voisin ou passerelle ?',
    consigne: 'Au poste Réseau du car SDI, vous mettez des machines en service : combien d\'appareils dans un réseau, quel masque écrire, qui passe par la passerelle.',
    gen: (rnd) => {
      const p = pick(rnd, [16, 20, 22, 23, 24, 25, 26, 27, 28, 29, 30]), h = 2 ** (32 - p) - 2;
      const q = pick(rnd, [8, 16, 19, 22, 24, 25, 26, 27, 28, 29, 30]), m = infoReseau('10.0.0.0', q).masque;
      const versMasque = rnd() < 0.6;
      const [S, Dm] = tirer(rnd, PLAN.slice(0, 6), 2);
      const voisin = rnd() < 0.5;
      const sIp = `10.1.${S.vlan}.${S.fin}`, dIp = voisin ? `10.1.${S.vlan}.${entre(rnd, 100, 199)}` : `10.1.${Dm.vlan}.${Dm.fin}`;
      const P = portee(dIp, sIp, 24);
      const direct = P.ou.startsWith('un voisin');
      return [
        {
          type: 'nombre', unite: 'appareils', answer: h,
          q: `Combien d'appareils peut-on adresser dans un réseau **/${p}** ?`,
          pieges: sauf(h, [{ v: 2 ** (32 - p), why: 'C\'est le nombre d\'adresses : retirez celle du réseau et celle de diffusion.' }, { v: 32 - p, why: 'C\'est le nombre de bits d\'appareil, pas le nombre d\'adresses.' }]),
          aides: [`Un /${p} laisse 32 − ${p} = ${32 - p} bits pour l'appareil.`, `2 puissance ${32 - p} adresses, moins deux : le réseau et la diffusion.`],
          solution: `2^${32 - p} − 2 = **${fr(h)}** appareils${p === 30 ? ' : un lien entre deux routeurs' : ''}.`,
        },
        versMasque ? {
          type: 'texte', forme: 'ip', accept: [m], placeholder: '255.255.255.0',
          q: `La fiche de la machine demande le masque en décimal pointé. Écrivez le masque d'un **/${q}**.`,
          pieges: sauf(m, [{ v: infoReseau('10.0.0.0', q).joker, why: 'C\'est le joker, l\'inverse du masque : les 1 du masque sont à gauche, sur la partie réseau.' }, { v: '255.255.255.0', why: 'C\'est le /24 : comptez les bits à 1.' }]),
          aides: [`${q} bits à 1 en partant de la gauche, puis des 0 : chaque octet plein vaut 255.`, 'Un octet entamé vaut 128, 192, 224, 240, 248, 252 ou 254 selon qu\'il a 1 à 7 bits à 1.'],
          solution: `/${q} = **${m}** : ${Math.floor(q / 8)} octet${q >= 16 ? 's' : ''} plein${q >= 16 ? 's' : ''}${q % 8 ? ` puis ${q % 8} bit${q % 8 > 1 ? 's' : ''} à 1` : ''}.`,
        } : {
          type: 'nombre', answer: q,
          q: `Sur la fiche d'un appareil, le masque est écrit **${m}**. Quelle est la longueur du préfixe (le nombre après la barre oblique) ?`,
          pieges: sauf(q, [{ v: 32 - q, why: 'C\'est le nombre de bits d\'appareil ; le préfixe compte les bits à 1.' }]),
          aides: ['Comptez les bits à 1 : 255 en vaut 8.', 'Un octet partiel : 128 = 1 bit, 192 = 2, 224 = 3, 240 = 4, 248 = 5, 252 = 6, 254 = 7.'],
          solution: `${m} = **/${q}** : ${q} bits à 1.`,
        },
        {
          type: 'choix', q: `**${S.qui.charAt(0).toUpperCase() + S.qui.slice(1)}** (${sIp}/24) envoie un paquet à **${dIp}**. Comment ?`,
          choices: [['Directement, après une requête ARP pour l\'adresse MAC de ' + dIp, `Vu en /24, ${dIp} est dans ${infoReseau(dIp, 24).reseau}, pas dans ${infoReseau(sIp, 24).reseau} : ce n'est pas un voisin.`], [`Par sa passerelle 10.1.${S.vlan}.1`, `Vu en /24, ${dIp} est dans le même réseau, ${infoReseau(sIp, 24).reseau} : inutile de passer par le routeur.`], ['Il ne peut pas : deux /24 ne se parlent jamais', 'Deux sous-réseaux se parlent par le routeur : c\'est le rôle de la passerelle.']], answer: direct ? 0 : 1,
          aides: ['La machine applique son masque à la destination et à sa propre adresse.', 'En /24, les trois premiers nombres sont la partie réseau : sont-ils les mêmes ?'],
          solution: direct ? `**Directement** : même partie réseau (${infoReseau(sIp, 24).reseau}), la machine demande la MAC de ${dIp} par ARP.` : `**Par la passerelle 10.1.${S.vlan}.1** : ${dIp} est dans ${infoReseau(dIp, 24).reseau}, un autre sous-réseau.`,
        },
        pick(rnd, [
          { type: 'choix', q: 'Une machine voit ses voisines mais ni la supervision ni le serveur d\'heure. Cause probable ?', choices: ['Sa passerelle est fausse ou absente', ['Son câble est coupé', 'Elle ne verrait plus personne, voisines comprises.'], ['Son adresse MAC est en conflit', 'Un conflit perturberait aussi les échanges avec les voisines.']], answer: 0, aides: ['Ce qui marche est local ; ce qui échoue est au-delà du sous-réseau.', 'Qui fait sortir les paquets du sous-réseau ?'], solution: 'La **passerelle** : tout ce qui est local marche, tout ce qui passe par le routeur échoue.' },
          { type: 'choix', q: 'Le RCP 10.1.20.31 a reçu un masque /16 par erreur et cherche la CCU 10.1.30.11 du VLAN 30. Que se passe-t-il ?', choices: ['Il la croit voisine et l\'appelle par ARP, mais elle est sur un autre VLAN : pas de réponse', ['Il passe par sa passerelle, comme en /24', 'En /16, la partie réseau est 10.1 pour les deux adresses : il ne pense pas à la passerelle.'], ['Rien ne change : le masque ne sert qu\'au routeur', 'Chaque machine applique son propre masque pour décider.']], answer: 0, aides: ['Appliquez /16 aux deux adresses.', 'Même partie réseau : direct par ARP. Mais la diffusion ARP sort-elle du VLAN 20 ?'], solution: 'Il l\'**appelle par ARP en vain** : le masque trop large fait croire à un voisin. Une panne qui ressemble à un câble coupé.' },
          { type: 'choix', q: 'Une machine fraîchement installée répond une fois sur deux, et une autre du même VLAN aussi. Que vérifier d\'abord ?', choices: ['Qu\'elles n\'ont pas la même adresse IP (conflit d\'adresses)', ['Le masque de la passerelle', 'Une passerelle fausse couperait tout ce qui est au-delà, pas une fois sur deux.'], ['La longueur du câble', 'Un câble trop long donne des erreurs sur une seule machine, pas sur deux à la fois.']], answer: 0, aides: ['Deux machines touchées en même temps, par intermittence.', 'La table ARP des voisins bascule d\'une machine à l\'autre.'], solution: 'Un **conflit d\'adresses** : la table ARP des voisins bascule de l\'une à l\'autre, chacune répond une fois sur deux.' },
        ]),
      ];
    },
  },
  'reseau-adresses': {
    titre: 'Réseau, diffusion, plage d\'appareils',
    consigne: 'Vous écrivez le plan d\'adressage d\'une installation : pour une adresse et son préfixe, le réseau, la diffusion, la plage ; puis vous choisissez les préfixes.',
    gen: (rnd) => {
      const { ip, p, I } = hote(rnd, [20, 22, 23, 25, 26, 27, 28, 29]);
      const I24 = infoReseau(ip, 24);
      const n = pick(rnd, [6, 12, 25, 50, 60, 100, 126, 127, 200, 254, 255, 500, 1000]), pn = prefixePour(n);
      const base = pick(rnd, [22, 23, 24]), q = base + pick(rnd, [1, 2, 3]);
      const grand = `10.1.${entre(rnd, 0, 50) * 4}.0`, k = decouper(grand, base, q).length;
      const parSous = rnd() < 0.5;
      return [
        {
          type: 'texte', forme: 'ip', accept: [I.reseau], placeholder: 'a.b.c.d',
          q: `Une machine a l'adresse **${ip}/${p}**. Quelle est l'adresse du réseau ?`,
          pieges: sauf(I.reseau, [{ v: I24.reseau, why: `Ce serait vrai en /24. En /${p}, le masque ${I.masque} coupe ${p < 24 ? 'le troisième nombre' : 'le quatrième nombre'} : raisonnez par blocs.` }, { v: ip, why: 'C\'est l\'adresse de la machine : l\'adresse du réseau a tous ses bits d\'appareil à 0.' }]),
          aides: [`Le masque /${p} s'écrit ${I.masque} : où coupe-t-il ?`, p < 24 ? `Le troisième nombre se découpe en blocs de ${256 - Number(I.masque.split('.')[2])} ; le quatrième passe à 0.` : `Le dernier nombre se découpe en blocs de ${256 - Number(I.masque.split('.')[3])} : dans quel bloc tombe ${ip.split('.')[3]} ?`],
          solution: `${ip} ET ${I.masque} = **${I.reseau}** : tous les bits d'appareil à 0.`,
        },
        {
          type: 'texte', forme: 'ip', accept: [I.broadcast], placeholder: 'a.b.c.d',
          q: `Et l'adresse de **diffusion** de ce réseau (${I.reseau}/${p}) ?`,
          pieges: sauf(I.broadcast, [{ v: I24.broadcast, why: `C'est la diffusion d'un /24 : en /${p}, le réseau compte ${fr(I.taille)} adresses.` }, { v: I.dernier, why: 'C\'est la dernière adresse d\'appareil : la diffusion est juste après, tous les bits d\'appareil à 1.' }]),
          aides: [`Le réseau compte 2^${32 - p} = ${fr(I.taille)} adresses à partir de ${I.reseau}.`, 'La diffusion est la dernière : réseau + taille − 1, tous les bits d\'appareil à 1.'],
          solution: `**${I.broadcast}** : tous les bits d'appareil à 1. Appareils de ${I.premier} à ${I.dernier}, soit ${fr(I.hotes)}.`,
        },
        {
          type: 'texte', forme: 'ip', accept: [I.dernier], placeholder: 'a.b.c.d',
          q: `Le plan met les serveurs en fin de plage. Quelle est la **plus haute adresse** que l'on peut donner à un appareil de ${I.reseau}/${p} ?`,
          pieges: sauf(I.dernier, [{ v: I.broadcast, why: 'C\'est l\'adresse de diffusion : elle ne se donne à aucun appareil.' }, { v: I24.dernier, why: `C'est la fin de plage d'un /24, pas d'un /${p}.` }]),
          aides: ['La plus haute adresse du réseau est la diffusion : elle est réservée.', 'Retirez 1 à l\'adresse de diffusion.'],
          solution: `**${I.dernier}**, juste sous la diffusion ${I.broadcast}.`,
        },
        parSous ? {
          type: 'nombre', unite: 'sous-réseaux', answer: k,
          q: `On découpe **${grand}/${base}** en sous-réseaux **/${q}**. Combien en obtient-on ?`,
          pieges: sauf(k, [{ v: q - base, why: 'C\'est le nombre de bits ajoutés au préfixe : chaque bit double le nombre de sous-réseaux.' }, { v: 2 ** (32 - q), why: 'C\'est la taille d\'un sous-réseau /' + q + ', pas leur nombre.' }]),
          aides: ['Allonger le préfixe d\'un bit coupe le réseau en deux.', `${q} − ${base} = ${q - base} bits de plus : 2 puissance ${q - base}.`],
          solution: `2^${q - base} = **${k}** sous-réseaux /${q}, chacun de ${2 ** (32 - q)} adresses.`,
        } : {
          type: 'nombre', answer: pn,
          q: `Il faut loger **${fr(n)} appareils** dans un seul sous-réseau. Quel est le plus long préfixe qui convient (le plus petit réseau) ?`,
          pieges: sauf(pn, [{ v: pn + 1, why: `Un /${pn + 1} ne loge que ${fr(2 ** (32 - pn - 1) - 2)} appareils : n'oubliez pas le réseau et la diffusion.` }]),
          aides: ['Il faut n + 2 adresses : les appareils, le réseau et la diffusion.', `Cherchez la plus petite puissance de 2 qui atteint ${fr(n + 2)} : son exposant donne les bits d'appareil, et 32 − cet exposant le préfixe.`],
          solution: `${fr(n)} + 2 = ${fr(n + 2)} adresses ≤ 2^${32 - pn} = ${fr(2 ** (32 - pn))} : **/${pn}** (${fr(2 ** (32 - pn) - 2)} appareils).`,
        },
      ];
    },
  },
  'reseau-types': {
    titre: 'Reconnaître une adresse et sa portée',
    consigne: 'Au poste Réseau, des adresses inconnues apparaissent dans les journaux : vous dites de quel type elles sont, où va un envoi, et vous lisez une adresse IPv6.',
    gen: (rnd) => {
      const T = pick(rnd, [
        { ip: `10.1.${entre(rnd, 10, 90)}.${entre(rnd, 1, 254)}`, lib: 'privée (RFC 1918)' },
        { ip: `172.${entre(rnd, 16, 31)}.${entre(rnd, 0, 255)}.${entre(rnd, 1, 254)}`, lib: 'privée (RFC 1918)' },
        { ip: `192.168.${entre(rnd, 0, 255)}.${entre(rnd, 1, 254)}`, lib: 'privée (RFC 1918)' },
        { ip: `169.254.${entre(rnd, 1, 254)}.${entre(rnd, 1, 254)}`, lib: 'lien local (APIPA)' },
        { ip: `127.0.0.${entre(rnd, 1, 9)}`, lib: 'boucle locale' },
        { ip: `239.${entre(rnd, 1, 2)}.${entre(rnd, 0, 99)}.${entre(rnd, 1, 254)}`, lib: 'multicast privé' },
        { ip: `100.${entre(rnd, 64, 127)}.${entre(rnd, 0, 255)}.${entre(rnd, 1, 254)}`, lib: 'partagée d\'opérateur (CGNAT)' },
        { ip: `${pick(rnd, [80, 86, 92, 151, 185, 212])}.${entre(rnd, 0, 255)}.${entre(rnd, 0, 255)}.${entre(rnd, 1, 254)}`, lib: 'publique' },
      ]);
      const LIBS = ['privée (RFC 1918)', 'publique', 'lien local (APIPA)', 'boucle locale', 'multicast privé', 'partagée d\'opérateur (CGNAT)'];
      const ty = typeAdresse(T.ip);
      const faux = tirer(rnd, LIBS.filter((l) => l !== T.lib), 2);
      const POURQUOI = { 'privée (RFC 1918)': 'Les privées sont 10/8, 172.16/12 et 192.168/16.', publique: 'Une publique n\'est dans aucune plage réservée.', 'lien local (APIPA)': 'Le lien local, c\'est 169.254.x.x.', 'boucle locale': 'La boucle locale, c\'est 127.x.x.x.', 'multicast privé': 'Le multicast privé, c\'est 239.x.x.x.', 'partagée d\'opérateur (CGNAT)': 'L\'adresse partagée des opérateurs, c\'est 100.64.0.0/10 (100.64 à 100.127).' };
      // un envoi depuis le RCP 1 du car
      const D = pick(rnd, [
        { dst: '10.1.20.255', g: 'Une diffusion à tout le sous-réseau 10.1.20.0/24' },
        { dst: `10.1.20.${entre(rnd, 2, 30)}`, g: 'Un envoi direct à un voisin du sous-réseau' },
        { dst: `10.1.${pick(rnd, [10, 30, 60])}.${entre(rnd, 2, 99)}`, g: 'Un envoi à une machine d\'un autre réseau, par la passerelle' },
        { dst: `239.1.${entre(rnd, 0, 50)}.${entre(rnd, 1, 200)}`, g: 'Un envoi aux abonnés d\'un groupe multicast' },
        { dst: '255.255.255.255', g: 'Une diffusion à tout le réseau local, sans passer de routeur' },
      ]);
      const GENRES = ['Une diffusion à tout le sous-réseau 10.1.20.0/24', 'Un envoi direct à un voisin du sous-réseau', 'Un envoi à une machine d\'un autre réseau, par la passerelle', 'Un envoi aux abonnés d\'un groupe multicast', 'Une diffusion à tout le réseau local, sans passer de routeur'];
      const P = portee(D.dst, '10.1.20.31', 24);
      const g6 = rnd() < 0.5 ? [0x2001, 0x0db8, pick(rnd, [0, 0x12, 0xa, 0x100]), pick(rnd, [0x2c, 0x1, 0xff]), 0, 0, 0, pick(rnd, [1, 0x10, 0x2a, 0x305])] : [0xfe80, 0, 0, 0, pick(rnd, [0x21a, 0x2e0]), pick(rnd, [0x20ff, 0x4cff]), pick(rnd, [0xfe00, 0xfe12]), pick(rnd, [0x31, 0x1b2])];
      const court = v6court(g6), long = v6long(g6);
      const C = pick(rnd, [{ ip: `${entre(rnd, 1, 126)}.${entre(rnd, 0, 255)}.0.1`, c: 'A' }, { ip: `${entre(rnd, 128, 191)}.${entre(rnd, 0, 255)}.0.1`, c: 'B' }, { ip: `${entre(rnd, 192, 223)}.${entre(rnd, 0, 255)}.0.1`, c: 'C' }]);
      const cl = classe(C.ip);
      return [
        {
          type: 'choix', q: `De quel type est l'adresse **${T.ip}** ?`,
          choices: [T.lib, ...faux.map((f) => [f, POURQUOI[f]])], answer: 0,
          aides: ['Regardez d\'abord le premier nombre, puis le deuxième.', 'Privées : 10/8, 172.16/12, 192.168/16 ; APIPA 169.254 ; boucle 127 ; multicast 224 à 239 ; CGNAT 100.64 à 100.127.'],
          solution: `**${T.lib}** (${ty.ref}${ty.cidr ? ', ' + ty.cidr : ''}) : ${ty.detail}`,
        },
        {
          type: 'choix', q: `Le RCP 1 (10.1.20.31/24) envoie un paquet à **${D.dst}**. Qu'est-ce que c'est ?`,
          choices: [D.g, ...tirer(rnd, GENRES.filter((x) => x !== D.g), 2)], answer: 0,
          aides: ['Est-ce une adresse de groupe (224 à 239), une diffusion, ou une machine ?', 'Pour une machine, appliquez le masque /24 : même réseau que 10.1.20.0, ou non ?'],
          solution: `**${D.g}** : ${P.ou}.`,
        },
        {
          type: 'texte', forme: 'ip', accept: [court], placeholder: '2001:db8::1',
          q: `Une box affiche l'adresse IPv6 **${long}**. Écrivez-la sous sa forme abrégée.`,
          pieges: sauf(court, [{ v: court.replace(/(^|:)([0-9a-f]{1,3})(?=:|$)/g, (m, a, b) => a + b.padStart(4, '0')), why: 'On retire aussi les zéros de tête de chaque groupe (0db8 s\'écrit db8).' },
            ...(g6[0] === 0x2001 && g6[2] === 0 ? [{ v: court.replace(':0:', '::'), why: '« :: » ne s\'écrit qu\'une fois : deux fois, on ne saurait plus combien de groupes nuls chacun remplace.' }] : [])]),
          aides: ['Deux règles : on retire les zéros de tête de chaque groupe, et une seule suite de groupes nuls devient « :: ».', 'Choisissez la plus longue suite de groupes à 0000 pour le « :: ».'],
          solution: `**${court}**${g6[0] === 0xfe80 ? ' : une adresse de lien local (fe80::), que chaque interface se donne' : ''}.`,
        },
        pick(rnd, [
          { type: 'choix', q: `Un portable réglé en DHCP affiche **169.254.${entre(rnd, 1, 254)}.${entre(rnd, 1, 254)}**. Que s'est-il passé ?`, choices: ['Il n\'a reçu aucune réponse DHCP et s\'est donné une adresse de lien local', ['Le DHCP lui a donné une adresse publique', '169.254 est réservé au lien local (RFC 3927) : jamais distribué par un serveur.'], ['Il est en boucle locale', 'La boucle locale, c\'est 127.x.x.x.']], answer: 0, aides: ['169.254.x.x n\'est jamais donnée par un serveur.', 'C\'est l\'adresse qu\'une machine se donne seule, faute de réponse.'], solution: 'Un **DHCP sans réponse** : la machine s\'est donné une adresse APIPA et ne joint presque personne.' },
          { type: 'choix', q: `Dans un vieux document, l'adresse **${C.ip}** est dite « de classe… » ?`, choices: [`${cl.c} (préfixe /${cl.p} par défaut)`, ...['A', 'B', 'C'].filter((x) => x !== cl.c).map((x) => [`${x} (préfixe /${x === 'A' ? 8 : x === 'B' ? 16 : 24} par défaut)`, `La classe ${x} commence à ${x === 'A' ? '1' : x === 'B' ? '128' : '192'} et s'arrête à ${x === 'A' ? '126' : x === 'B' ? '191' : '223'}.`])], answer: 0, aides: ['Avant 1993, le premier nombre fixait la classe.', 'A : 1 à 126 ; B : 128 à 191 ; C : 192 à 223.'], solution: `Classe **${cl.c}** : le premier nombre ${C.ip.split('.')[0]}. Depuis le CIDR (1993), on coupe à n'importe quel bit.` },
        ]),
      ];
    },
  },
  'reseau-dhcp-dns': {
    titre: 'Recevoir une adresse, trouver un nom',
    consigne: 'Le VLAN des invités reçoit ses adresses par DHCP, la production est en adresses fixes : vous suivez les échanges et vous dépannez les noms.',
    gen: (rnd) => {
      const a = entre(rnd, 10, 120), b = a + entre(rnd, 19, 120);
      const bail = pick(rnd, [1, 2, 4, 8, 12, 24]);
      const port = pick(rnd, [['le serveur DHCP', 67], ['le client DHCP', 68], ['un serveur DNS', 53], ['le mDNS (noms en .local)', 5353]]);
      return [
        pick(rnd, [
          {
            type: 'ordre', items: ['Discover : « y a-t-il un serveur DHCP ? » (diffusion)', 'Offer : le serveur propose une adresse, le masque, la passerelle, le DNS et le bail', 'Request : la machine accepte cette offre (encore en diffusion)', 'Ack : le serveur confirme, la machine est configurée'],
            q: `Le portable d'un invité arrive dans le VLAN 90 sans adresse. Remettez les messages DHCP dans l'ordre.`,
            aides: ['Une machine sans adresse commence par chercher un serveur.', 'Chercher, proposer, accepter, confirmer : D, O, R, A.'],
            solution: '**Discover, Offer, Request, Ack** : quatre messages, les deux premiers en diffusion depuis 0.0.0.0 vers 255.255.255.255.',
          },
          {
            type: 'ordre', items: ['La machine demande le nom à son résolveur DNS', 'Le résolveur interroge un serveur racine', 'Il interroge les serveurs de .fr', 'Il interroge le serveur du domaine, qui donne l\'adresse', 'Le résolveur répond et garde la réponse en cache'],
            q: `Le PC de supervision cherche l'adresse de **${pick(rnd, ['meteo.exemple.fr', 'regie.exemple.fr', 'stats.exemple.fr'])}**, que son résolveur n'a pas en cache. Dans quel ordre la question avance-t-elle ?`,
            aides: ['La machine ne pose qu\'une question, à son résolveur ; c\'est lui qui cherche.', 'On lit le nom de droite à gauche : la racine, puis .fr, puis le domaine.'],
            solution: 'Résolveur, **racine, .fr, domaine**, puis la réponse, gardée en cache pendant sa durée de vie.',
          },
        ]),
        {
          type: 'nombre', unite: 'adresses', answer: b - a + 1,
          q: `Le routeur prête aux invités les adresses de **10.1.90.${a}** à **10.1.90.${b}**. Combien d'adresses compte cette réserve (le pool) ?`,
          pieges: [{ v: b - a, why: 'Les deux bornes comptent : de .' + a + ' à .' + b + ' compris.' }],
          aides: ['Comptez les deux bornes : la première et la dernière adresse prêtées.', `Faites ${b} − ${a}, puis ajoutez la borne de départ.`],
          solution: `${b} − ${a} + 1 = **${b - a + 1}** adresses : au-delà, un invité de plus n'obtiendrait rien.`,
        },
        rnd() < 0.5 ? {
          type: 'nombre', unite: 'min', answer: bail * 30,
          q: `Le bail DHCP dure **${bail} h**. Au bout de combien de minutes la machine redemande-t-elle à le prolonger ?`,
          pieges: [{ v: bail * 60, why: 'C\'est la fin du bail : la machine redemande à mi-bail, pour ne pas être prise de court.' }],
          aides: ['La machine n\'attend pas la fin du bail.', 'Elle redemande à la moitié : bail × 60 ÷ 2.'],
          solution: `À mi-bail : ${bail} h ÷ 2 = **${bail * 30} min**.`,
        } : {
          type: 'nombre', brut: true, answer: port[1],
          q: `Sur quel numéro de port UDP écoute **${port[0]}** ?`,
          pieges: sauf(port[1], [{ v: 67, why: '67 est le port du serveur DHCP.' }, { v: 68, why: '68 est le port du client DHCP.' }, { v: 53, why: '53 est le port du DNS.' }, { v: 80, why: '80 est le web, en TCP.' }]),
          aides: ['DHCP : deux ports voisins, le serveur et le client.', 'DHCP 67 (serveur) et 68 (client) ; DNS 53 ; mDNS 5353.'],
          solution: `**${port[1]}**. DHCP : 67 côté serveur, 68 côté client ; DNS : 53 ; mDNS : 5353 (multicast 224.0.0.251).`,
        },
        pick(rnd, [
          { type: 'choix', q: 'Le ping vers 10.1.10.50 répond, le ping vers supervision.car.local non. Où est la panne ?', choices: ['Le DNS (la traduction du nom)', ['La passerelle', 'Le ping vers l\'adresse passe : le chemin réseau est bon.'], ['Le câble', 'Le ping vers l\'adresse répond : le câble va bien.']], answer: 0, aides: ['Le réseau achemine bien les paquets vers l\'adresse.', 'Qui traduit un nom en adresse ?'], solution: 'Le **DNS** : le réseau va bien, c\'est la traduction du nom qui échoue. `nslookup` le confirme.' },
          { type: 'choix', q: 'Dans le car, des machines reçoivent soudain 192.168.1.x et la passerelle 192.168.1.1. Que s\'est-il passé ?', choices: ['Une box branchée sur le réseau répond en serveur DHCP pirate', ['Le serveur DHCP du car a changé de réserve', 'Le car est en 10.1.x.x : 192.168.1.x est la réserve typique d\'une box.'], ['Les machines sont en boucle locale', 'La boucle locale est 127.x.x.x.']], answer: 0, aides: ['192.168.1.x n\'est pas dans le plan du car.', 'Quel appareil domestique distribue des 192.168.1.x ?'], solution: 'Un **serveur DHCP pirate** : une box qui répond plus vite que le bon. Le DHCP snooping des commutateurs le bloque.' },
          { type: 'choix', q: 'Le serveur DHCP est dans le VLAN 10, les invités dans le VLAN 90. Comment leurs Discover l\'atteignent-ils ?', choices: ['Le routeur joue le relais DHCP et recopie la diffusion en unicast vers le serveur', ['La diffusion traverse le routeur toute seule', 'Une diffusion s\'arrête au premier routeur.'], ['Ils ne l\'atteignent jamais : il faut un serveur par VLAN', 'C\'est une solution, mais le relais DHCP évite d\'en mettre un partout.']], answer: 0, aides: ['Une diffusion ne traverse pas le routeur.', 'Le routeur peut la faire suivre lui-même : « ip helper-address ».'], solution: 'Le **relais DHCP** : le routeur recopie la diffusion en unicast vers le serveur, et renvoie la réponse.' },
          { type: 'choix', q: 'Faut-il mettre les CCU et les RCP du car en DHCP ?', choices: ['Non : en adresses fixes, pour que rien ne dépende d\'un serveur à l\'antenne', ['Oui : le DHCP évite les erreurs de saisie', 'Une panne du serveur DHCP au mauvais moment couperait la production.'], ['Oui, avec un bail le plus court possible', 'Un bail court multiplie les échanges, sans rien rendre plus sûr.']], answer: 0, aides: ['Que se passe-t-il si le serveur DHCP tombe pendant le direct ?', 'La production suit le plan d\'adressage écrit avant l\'installation.'], solution: '**Adresses fixes** pour la production ; le DHCP sert aux invités, aux portables et aux téléphones.' },
        ]),
      ];
    },
  },
  'reseau-routage': {
    titre: 'Passer d\'un réseau à l\'autre',
    consigne: 'Au poste Réseau, SW-CŒUR route entre les VLAN (passerelles 10.1.x.1). Vous suivez un paquet d\'une machine à l\'autre et vous dépannez le chemin.',
    gen: (rnd) => {
      const [S, D] = tirer(rnd, PLAN.slice(0, 6), 2);
      const local = rnd() < 0.4;
      const sIp = `10.1.${S.vlan}.${S.fin}`, dIp = local ? `10.1.${S.vlan}.${entre(rnd, 100, 199)}` : `10.1.${D.vlan}.${D.fin}`;
      const t0 = pick(rnd, [64, 128, 255]), k = entre(rnd, 1, 7);
      const { ip, p, I } = hote(rnd, [24, 25, 26, 27, 28]);
      return [
        {
          type: 'choix', q: `${S.qui.charAt(0).toUpperCase() + S.qui.slice(1)} (${sIp}/24) envoie un paquet à **${dIp}**. À quelle adresse MAC la trame qui le quitte est-elle adressée ?`,
          choices: [[`À celle de ${dIp}`, `Vu en /24, ${dIp} est dans un autre sous-réseau : la machine ne cherche pas sa MAC, elle passe par la passerelle.`], [`À celle de sa passerelle 10.1.${S.vlan}.1`, `${dIp} est dans le même sous-réseau : la machine lui parle directement, sans routeur.`], ['À FF:FF:FF:FF:FF:FF, la diffusion', 'La diffusion sert à la question ARP, pas au paquet lui-même.']], answer: local ? 0 : 1,
          aides: ['La machine applique son masque /24 aux deux adresses.', 'Même réseau : la MAC du destinataire ; autre réseau : celle de la passerelle.'],
          solution: local ? `À la **MAC de ${dIp}** : même sous-réseau, livraison directe.` : `À la **MAC de la passerelle 10.1.${S.vlan}.1** ; le paquet IP garde l'adresse ${dIp}, le routeur refera la trame.`,
        },
        {
          type: 'nombre', answer: t0 - k,
          q: `Un paquet part avec un **TTL de ${t0}** et traverse **${k} routeur${k > 1 ? 's' : ''}** avant d'arriver. Quel TTL lit-on à l'arrivée ?`,
          pieges: [{ v: t0 + k, why: 'Chaque routeur décrémente le TTL : il descend.' }, { v: t0, why: 'Le TTL change à chaque routeur : c\'est un compteur de sauts.' }],
          aides: ['Chaque routeur retire 1 au TTL.', `Partez de ${t0} et retirez un par routeur traversé.`],
          solution: `${t0} − ${k} = **${t0 - k}**. Un paquet à 0 est détruit : c'est ainsi qu'une boucle s'éteint, et que traceroute découvre les routeurs.`,
        },
        {
          type: 'texte', forme: 'ip', accept: [I.premier], placeholder: 'a.b.c.d',
          q: `Le plan d'adressage donne toujours la **première adresse d'appareil** du sous-réseau à la passerelle. Une machine est en **${ip}/${p}** : quelle passerelle lui régler ?`,
          pieges: sauf(I.premier, [{ v: I.reseau, why: 'C\'est l\'adresse du réseau : elle ne se donne à aucun appareil, routeur compris.' }, { v: infoReseau(ip, 24).premier, why: `C'est la première adresse d'un /24 ; en /${p}, la machine est dans ${I.reseau}.` }]),
          aides: [`Cherchez d'abord l'adresse du réseau de ${ip}/${p}.`, 'La première adresse d\'appareil est juste après l\'adresse du réseau.'],
          solution: `Réseau ${I.reseau}/${p} : passerelle **${I.premier}**.`,
        },
        pick(rnd, [
          { type: 'choix', q: 'Le ping de la supervision vers le NAS part, aucune réponse ne revient ; le NAS joint ses voisines. Que vérifier ?', choices: ['La passerelle du NAS : l\'aller arrive, le retour se perd', ['Le masque de la supervision', 'La supervision joint tout le reste du car : sa configuration est bonne.'], ['Le câble du NAS', 'Le NAS joint ses voisines : son câble fonctionne.']], answer: 0, aides: ['L\'aller et le retour sont indépendants.', 'Par où le NAS envoie-t-il sa réponse ?'], solution: 'La **passerelle du NAS** : il répond par sa propre passerelle ; fausse, la réponse ne quitte pas son VLAN.' },
          { type: 'choix', q: 'Toutes les machines du VLAN 40 se parlent entre elles, mais aucune ne joint le reste du car. Les autres VLAN vont bien. Cause probable ?', choices: ['L\'interface SVI du VLAN 40 est éteinte sur le routeur', ['Le câble d\'une machine du VLAN 40 est coupé', 'Une seule machine serait touchée, pas tout le VLAN.'], ['Le masque des machines du VLAN 10', 'Le VLAN 10 va bien ; c\'est la sortie du VLAN 40 qui manque.']], answer: 0, aides: ['Tout le VLAN est touché, et seulement vers l\'extérieur.', 'Qui est la passerelle de tout le VLAN ?'], solution: 'La **SVI éteinte** : la passerelle 10.1.40.1 n\'existe plus, le VLAN reste enfermé sur lui-même.' },
          { type: 'choix', q: `traceroute vers le serveur de la régie montre ${entre(rnd, 2, 4)} routeurs qui répondent, puis plus rien. Qu'en conclure ?`, choices: ['Le chemin s\'arrête juste après le dernier routeur qui répond', ['Le serveur est atteint', 'Le serveur répondrait lui aussi, en dernier.'], ['La passerelle de la machine est fausse', 'Le premier routeur, la passerelle, répond : elle est bonne.']], answer: 0, aides: ['Chaque routeur qui tue un paquet de TTL trop court le signale.', 'Le dernier qui répond dit où le chemin s\'arrête.'], solution: 'Le chemin **s\'arrête après le dernier routeur qui répond** : c\'est là qu\'on cherche.' },
        ]),
      ];
    },
  },
  'reseau-nat': {
    titre: 'Sortir sur Internet, être joint',
    consigne: 'Le car sort sur Internet par une box qui traduit les adresses : vous suivez une connexion qui sort, un paquet qui entre, et vous réglez une contribution SRT.',
    gen: (rnd) => {
      const pub = `203.0.113.${entre(rnd, 2, 250)}`;
      const R = routeurNat(pub);
      const pcs = tirer(rnd, [20, 21, 35, 50, 64, 101], 3).map((x) => `192.168.1.${x}`);
      const srv = `198.51.100.${entre(rnd, 2, 250)}`;
      const sorties = pcs.map((ip, k) => R.sortie(ip, 50000 + entre(rnd, 0, 9999) + k, srv + ':443'));
      const j = entre(rnd, 0, 2);
      const P = pick(rnd, [['le web chiffré (HTTPS)', 443], ['le web (HTTP)', 80], ['le DNS', 53], ['l\'administration à distance (SSH)', 22], ['RTMP, vers une plateforme', 1935]]);
      const cas = pick(rnd, ['inconnu', 'redir', 'reponse']);
      const pRedir = pick(rnd, [9000, 9710, 5000]);
      if (cas === 'redir') R.rediriger(pRedir, '192.168.1.50', pRedir);
      const e = cas === 'reponse' ? R.entree(sorties[j].port, srv + ':443') : R.entree(pRedir, '192.0.2.77:40001');
      return [
        {
          type: 'texte', forme: 'ip', accept: [pub], placeholder: 'a.b.c.d',
          q: `Le PC **${pcs[j]}** ouvre une page sur ${srv} (port 443). La box a l'adresse publique ${pub}. Quelle **adresse source** le serveur voit-il ?`,
          pieges: [{ v: pcs[j], why: 'Une adresse privée ne circule pas sur Internet : la box la remplace par la sienne.' }, { v: '192.168.1.1', why: 'C\'est l\'adresse de la box côté maison ; dehors, elle se présente avec son adresse publique.' }],
          aides: ['Les adresses 192.168.x.x ne sont jamais routées sur Internet.', 'La box remplace l\'adresse source par la seule qu\'Internet connaisse.'],
          solution: `**${pub}**, l'adresse publique de la box : le serveur ne voit jamais le PC.`,
        },
        {
          type: 'nombre', brut: true, answer: sorties[j].port,
          q: `La box donne les ports à partir de **40000**, dans l'ordre des connexions. Trois PC sortent l'un après l'autre : ${pcs.join(', puis ')}. Sur quel port de ${pub} le serveur voit-il arriver **${pcs[j]}** ?`,
          pieges: sauf(sorties[j].port, [{ v: 443, why: '443 est le port du serveur, pas celui que la box donne à la connexion.' }, { v: 40000 + j + 1, why: 'Le premier port donné est 40000 lui-même.' }]),
          aides: ['Chaque nouvelle connexion reçoit le port libre suivant.', `${pcs[j]} est la connexion n° ${j + 1} : 40000 + ${j}.`],
          solution: `**${sorties[j].port}** : la box note « ${pub}:${sorties[j].port} → ${pcs[j]} » dans sa table et y remet la réponse.`,
        },
        {
          type: 'choix', q: cas === 'reponse' ? `La réponse du serveur ${srv}:443 arrive sur ${pub}:${sorties[j].port}. Que fait la box ?` : `Un paquet arrive de **192.0.2.77** sur **${pub}:${pRedir}**, sans que personne à l'intérieur l'ait demandé. ${cas === 'redir' ? `La box a une redirection : port ${pRedir} vers 192.168.1.50:${pRedir}.` : 'Aucune redirection n\'est réglée.'} Que fait la box ?`,
          choices: cas === 'reponse' ? [`Elle le remet à ${e.ip}, d'après sa table`, ['Elle le jette : il vient de l\'extérieur', 'C\'est une réponse à une connexion sortie : sa table la reconnaît.'], ['Elle le diffuse à tout le réseau privé', 'La box sait exactement à qui il revient.']]
            : cas === 'redir' ? ['Elle le remet à 192.168.1.50, par la redirection', ['Elle le jette : rien n\'est sorti vers 192.0.2.77', 'Sans la redirection, oui ; avec elle, ce port mène à 192.168.1.50.'], ['Elle le remet au dernier PC sorti', 'La table de traduction ne concerne que les réponses ; ici, c\'est la redirection qui décide.']]
              : ['Elle le jette : aucune ligne de sa table ni redirection ne correspond', ['Elle le remet au PC qui a ce port', 'Aucune connexion sortie n\'a reçu ce port : la table est muette.'], ['Elle le diffuse à tout le réseau privé', 'Une box ne diffuse jamais un paquet d\'Internet.']], answer: 0,
          aides: ['La box ne laisse entrer que ce qui répond à une sortie, ou ce qu\'une redirection désigne.', 'Cherchez une ligne de la table (réponse) ou une redirection pour ce port.'],
          solution: e ? `Remis à **${e.ip}:${e.port}** (${e.par === 'réponse' ? 'réponse à une sortie' : 'redirection de port'}).` : '**Jeté** : ce qui arrive sans avoir été demandé est bloqué, sauf redirection.',
        },
        rnd() < 0.5 ? {
          type: 'nombre', answer: P[1],
          q: `Le pare-feu de la régie n'ouvre que le strict nécessaire. Quel numéro de port utilise **${P[0]}** ?`,
          pieges: sauf(P[1], [{ v: 443, why: '443 est le web chiffré.' }, { v: 80, why: '80 est le web non chiffré.' }]),
          aides: ['Les services connus ont des ports sous 1024 (RTMP mis à part).', 'Web 80, web chiffré 443, DNS 53, SSH 22, RTMP 1935.'],
          solution: `**${P[1]}**. Un client, lui, prend un port libre élevé.`,
        } : pick(rnd, [
          { type: 'choix', q: 'L\'encodeur du car sort par un modem 4G (adresse 100.64.x.x). La régie veut recevoir en SRT. Qui appelle ?', choices: ['L\'encodeur appelle (caller) ; la régie écoute (listener) sur un port ouvert et redirigé', ['La régie appelle l\'encodeur', 'En 4G derrière le CGNAT de l\'opérateur, l\'encodeur n\'a pas d\'adresse publique à lui : impossible de le joindre.'], ['Personne : SRT ne passe pas la 4G', 'SRT passe très bien la 4G, à condition que le bon côté appelle.']], answer: 0, aides: ['100.64.x.x : une adresse partagée d\'opérateur (CGNAT).', 'Celui qu\'on ne peut pas joindre doit appeler.'], solution: 'L\'**encodeur appelle** : sa sortie ouvre la ligne ; la régie écoute, avec une adresse publique et un port redirigé.' },
          { type: 'choix', q: 'Les deux bouts d\'une liaison SRT sont derrière des box sans port ouvert. Quel mode ?', choices: ['Le mode rendezvous : les deux appellent en même temps', ['Les deux en listener', 'Deux listeners s\'attendent : personne n\'appelle.'], ['Les deux en caller vers 0.0.0.0', '0.0.0.0 ne désigne personne : il faut viser l\'adresse publique de l\'autre.']], answer: 0, aides: ['Aucun des deux ne peut écouter.', 'SRT prévoit un mode où les deux sorties s\'ouvrent ensemble.'], solution: 'Le **rendezvous** : chacun appelle l\'autre, et les deux sorties s\'ouvrent mutuellement le passage.' },
        ]),
      ];
    },
  },
});

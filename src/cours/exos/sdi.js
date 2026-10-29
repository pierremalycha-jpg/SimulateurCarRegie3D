// @ts-check
import { registerExos, entre, pick, fr } from '../exo.js';
import { TRAMES } from '../sdi_mots.js';
import { LINKS } from '../../data/cameras.js';

// ----------------------------------------------------------------------------------
// Exercices en autonomie du chapitre « Le SDI » : des débits, des mots et des bits à calculer, des budgets de
// câble, des messages de grille, des canaux audio à ranger, des situations du car à trancher, avec des
// valeurs tirées à chaque essai. Les chiffres sont ceux des leçons : trames de cours/sdi_mots.js (raster,
// deux flux de 10 bits), affaiblissement du 1694A à la demi-fréquence d'horloge (17,7 dB/100 m en HD,
// 25,6 en 3G, 58 en 12G, fiche technique), égalisation garantie de 20 dB (HD, 3G) et 40 dB (12G), gigue
// d'alignement admise 0,2 UI (HD) et 0,3 UI (3G, 12G), ports de la Videohub du car (cours/sdi_grille.js),
// audio embarqué ST 299-1, portées du plan caméras (data/cameras.js, LINKS.coax).
// ----------------------------------------------------------------------------------
const FMT = Object.values(TRAMES);
// les liaisons et leur débit (Gb/s), avec leur norme
const LIAISONS = [
  { nom: 'SD-SDI', g: 0.27, norme: 'ST 259' },
  { nom: 'HD-SDI', g: 1.485, norme: 'ST 292-1' },
  { nom: '3G-SDI', g: 2.97, norme: 'ST 424' },
  { nom: '6G-SDI', g: 5.94, norme: 'ST 2081-1' },
  { nom: '12G-SDI', g: 11.88, norme: 'ST 2082-1' },
];
const LIAISON_CHOIX = ['SD-SDI (270 Mb/s)', 'HD-SDI (1,485 Gb/s)', '3G-SDI (2,97 Gb/s)', '6G-SDI (5,94 Gb/s)', '12G-SDI (11,88 Gb/s)'];
const IMAGES = [
  { nom: '576i25 (la SD)', l: 0 }, { nom: '1080i25', l: 1 }, { nom: '720p50', l: 1 }, { nom: '1080p25', l: 1 },
  { nom: '1080p50', l: 2 }, { nom: '2160p25', l: 3 }, { nom: '2160p50', l: 4 },
];
// le 1694A : affaiblissement à la demi-fréquence d'horloge (dB/100 m), égalisation garantie (dB), gigue admise (UI)
const CABLE = [
  { nom: 'HD-SDI', g: 1.485, k: 17.7, garantie: 20, gigue: 0.2, f: '742,5 MHz' },
  { nom: '3G-SDI', g: 2.97, k: 25.6, garantie: 20, gigue: 0.3, f: '1,485 GHz' },
  { nom: '12G-SDI', g: 11.88, k: 58, garantie: 40, gigue: 0.3, f: '5,94 GHz' },
];
/** le mauvais réflexe : juger une liaison à l'image */
const PEU_IMPORTE = /** @type {[string, string]} */ (['Peu importe : tant que l\'image est parfaite au multiview, la liaison est bonne', 'L\'image reste parfaite jusqu\'au bord de la falaise : seule la mesure dit la marge qui reste.']);
const r1 = (v) => Math.round(v * 10) / 10, r2 = (v) => Math.round(v * 100) / 100;

registerExos({
  'sdi-cest-quoi': {
    titre: 'Lire une ligne SDI et choisir la liaison',
    consigne: 'À la baie de mesure, tu vérifies ce que transporte chaque câble de la grille : le débit, la place de la suppression, l\'ordre des repères d\'une ligne.',
    gen: (rnd) => {
      const T = pick(rnd, FMT), deb = T.tot * T.lignes * T.ips * 2 * 10 / 1e9;
      const actif = T.act * T.actives * T.ips * 20 / 1e9;
      const vertical = rnd() < 0.5;
      const I = pick(rnd, IMAGES);
      return [
        {
          type: 'nombre', unite: 'Gb/s', answer: Math.round(deb * 1000) / 1000, tol: 0.01,
          q: `Un signal **${T.nom}** 4:2:2 10 bits : le raster compte ${fr(T.tot)} mots par ligne et par flux, sur ${fr(T.lignes)} lignes. Quel débit sur le câble, en Gb/s ?`,
          pieges: [
            { v: Math.round(actif * 1000) / 1000, why: 'C\'est l\'image active seule : le SDI envoie le raster complet, suppression comprise.' },
            { v: Math.round(deb / 2 * 1000) / 1000, why: 'Il manque un flux : le SDI entrelace mot à mot deux flux de 10 bits, Y et C (Cb, Cr).' },
          ],
          aides: ['Le SDI transporte le raster complet (suppression comprise), en deux flux de 10 bits entrelacés : Y et C.', `Mots par ligne × lignes × images par seconde × 2 flux × 10 bits : ${fr(T.tot)} × ${fr(T.lignes)} × ${T.ips} × 2 × 10.`],
          solution: `${fr(T.tot)} × ${fr(T.lignes)} × ${T.ips} × 2 × 10 = **${fr(deb, 3)} Gb/s** : le ${T.liaison} (${T.norme}).`,
        },
        vertical
          ? {
            type: 'nombre', answer: T.lignes - T.actives,
            q: `En **${T.nom}**, combien de lignes de suppression verticale (le VANC) entre deux images ? L'image compte ${fr(T.actives)} lignes actives sur ${fr(T.lignes)}.`,
            pieges: [{ v: T.lignes, why: 'C\'est le nombre total de lignes de la trame : retire les lignes actives.' }],
            aides: ['Toutes les lignes de la trame ne portent pas l\'image : les autres forment la suppression verticale.', `${fr(T.lignes)} lignes en tout, dont ${fr(T.actives)} actives.`],
            solution: `${fr(T.lignes)} − ${fr(T.actives)} = **${T.lignes - T.actives} lignes** : on y range le timecode (ATC), le VPID, des sous-titres.`,
          }
          : {
            type: 'nombre', answer: T.tot - T.act,
            q: `En **${T.nom}**, une ligne compte ${fr(T.tot)} mots par flux, dont ${fr(T.act)} de vidéo active. Combien de mots par flux pour la suppression horizontale (EAV, numéro de ligne, CRC, HANC, SAV) ?`,
            pieges: [{ v: T.tot, why: 'C\'est la ligne entière : retire la vidéo active.' }, { v: T.act, why: 'C\'est la vidéo active : la question porte sur ce qui reste.' }],
            aides: ['La suppression horizontale, c\'est tout ce qui n\'est pas de la vidéo active sur la ligne.', `${fr(T.tot)} mots en tout, dont ${fr(T.act)} actifs.`],
            solution: `${fr(T.tot)} − ${fr(T.act)} = **${fr(T.tot - T.act)} mots** : 4 d'EAV, 2 de numéro de ligne, 2 de CRC, l'HANC (l'audio embarqué), 4 de SAV.`,
          },
        {
          type: 'ordre', q: 'Remets dans l\'ordre où ils passent dans le câble les morceaux d\'une ligne SDI, à partir de la fin de l\'image de la ligne précédente.',
          items: ['EAV : fin de la vidéo active (3FF 000 000 XYZ)', 'Le numéro de ligne (LN)', 'Le CRC de la ligne', 'L\'HANC : paquets audio et données', 'SAV : début de la vidéo active', 'La vidéo active : les échantillons de l\'image'],
          aides: ['La ligne commence par le repère qui ferme l\'image de la ligne d\'avant.', 'Après ce repère viennent deux mots qui disent où l\'on est, deux qui contrôlent la ligne, puis l\'espace des données, et le repère qui ouvre l\'image.'],
          solution: 'EAV, numéro de ligne, CRC, HANC, SAV, puis la vidéo active. Le récepteur se repère sur EAV et SAV, dont les mots 3FF et 000 sont interdits à l\'image.',
        },
        {
          type: 'choix', q: `Quelle liaison SDI pour du **${I.nom}** ?`, choices: LIAISON_CHOIX, answer: I.l,
          aides: ['Le HD-SDI se calcule pour 25 images (ou 50 en 720p) ; 50 images progressives en 1080 doublent le débit.', 'L\'UHD compte quatre fois les pixels du 1080 : 6G à 25 images, 12G à 50. La SD est à 270 Mb/s.'],
          solution: `Le **${LIAISONS[I.l].nom}** (${LIAISONS[I.l].norme}, ${fr(LIAISONS[I.l].g, LIAISONS[I.l].g < 1 ? 2 : 3)} Gb/s).`,
        },
      ];
    },
  },
  'sdi-cable': {
    titre: 'Monter une liaison qui tient',
    consigne: 'Dans la zone technique, tu tires une liaison 3G de la CCU vers la grille, à travers la baie de brassage : son budget, sa garantie, les pièges des connecteurs.',
    gen: (rnd) => {
      const L = entre(rnd, 4, 9) * 10, n = entre(rnd, 1, 3), att = L * 25.6 / 100 + n * 0.5;
      const L1 = entre(rnd, 8, 14) * 10, L2 = entre(rnd, 1, 5) * 5;
      return [
        {
          type: 'nombre', unite: 'dB', answer: r1(att), tol: 0.4,
          q: `La liaison 3G mesure **${L} m** de 1694A (≈ 25,6 dB/100 m à la demi-fréquence d'horloge) et passe **${n} fois** par la baie de brassage (≈ 0,5 dB par passage, un ordre de grandeur). Quel affaiblissement au total ?`,
          pieges: [{ v: r1(L * 25.6 / 100), why: 'C\'est le câble seul : chaque passage dans la baie ajoute deux connecteurs et un cordon.' }],
          aides: ['Additionne l\'affaiblissement du câble et celui des passages en brassage.', `${L} m × 25,6 dB/100 m, plus ${n} × 0,5 dB.`],
          solution: `${L} × 0,256 + ${n} × 0,5 = **${fr(att, 1)} dB**.`,
        },
        {
          type: 'choix', q: `Ces ${fr(att, 1)} dB, comparés aux 20 dB d'égalisation que la norme du 3G garantit : que faut-il en penser ?`,
          choices: att <= 20
            ? ['Dans la garantie : la liaison passe avec de la marge', ['Au-delà de la garantie : elle ne tient que grâce à un bon égaliseur, sans marge', 'Compare les deux nombres : l\'affaiblissement reste sous les 20 dB garantis.'], PEU_IMPORTE]
            : [['Dans la garantie : la liaison passe avec de la marge', 'Compare les deux nombres : l\'affaiblissement dépasse les 20 dB garantis.'], 'Au-delà de la garantie : elle ne tient que grâce à un bon égaliseur, sans marge', PEU_IMPORTE],
          answer: att <= 20 ? 0 : 1,
          aides: ['ST 424 exige qu\'un récepteur 3G compense au moins 20 dB.', 'Au-delà, les égaliseurs actuels font souvent mieux (35 à 40 dB), mais rien ne le garantit.'],
          solution: att <= 20 ? `**${fr(att, 1)} dB ≤ 20 dB** : la liaison est dans ce que tout récepteur 3G doit accepter, avec ${fr(20 - att, 1)} dB de marge.` : `**${fr(att, 1)} dB > 20 dB** : elle dépend d'un égaliseur meilleur que la norme. On surveille les CRC, ou l'on raccourcit, ou l'on insère un répéteur.`,
        },
        {
          type: 'nombre', unite: 'm', answer: L2,
          q: `La caméra arrive à la grille par **${L1} m** de câble ; la grille l'envoie au mélangeur par **${L2} m**. Combien de mètres de câble l'égaliseur de l'entrée du mélangeur doit-il compenser ?`,
          pieges: [{ v: L1 + L2, why: 'La grille égalise et réhorloge chaque sortie : le budget de câble repart à zéro après elle.' }, { v: L1, why: 'C\'est la liaison d\'avant la grille, que l\'entrée de la grille a déjà compensée.' }],
          aides: ['Que fait une grille au signal de chacune de ses sorties ?', 'Le budget se compte par liaison, d\'un appareil qui réhorloge au suivant.'],
          solution: `**${L2} m** seulement : la grille régénère le signal (reclocking), la liaison CCU → grille (${L1} m) et la liaison grille → mélangeur sont deux budgets séparés.`,
        },
        pick(rnd, [
          {
            type: 'choix', q: 'À la baie de mesure, une sortie SDI mesure 1,6 V crête à crête au lieu de 800 mV. Cause probable ?',
            choices: ['Une entrée bouclée (loop-through) laissée sans bouchon de 75 Ω', ['Un câble trop court', 'Un câble n\'amplifie jamais : il ne peut qu\'affaiblir.'], ['Un adaptateur BNC 50 Ω dans la liaison', 'Une pièce 50 Ω ne renvoie qu\'environ 20 % du signal : un dépassement, pas un doublement.']], answer: 0,
            aides: ['Un niveau doublé, c\'est le signal qui revient s\'ajouter à lui-même.', 'Quelle extrémité ne renvoie rien quand elle est bien terminée ?'],
            solution: 'Une **entrée bouclée sans bouchon** renvoie tout le signal : 2 × 800 mV. On pose un bouchon de 75 Ω.',
          },
          {
            type: 'choix', q: 'Depuis qu\'on a ajouté un adaptateur pris dans une valise de mesure, le dépassement après chaque front passe à 20 % sur une liaison courte. Que vérifier ?',
            choices: ['Que l\'adaptateur est bien en 75 Ω : une pièce 50 Ω renvoie ≈ 20 % du signal', ['La longueur du câble', 'La liaison est courte : sa longueur ne crée pas de dépassement, seulement de l\'affaiblissement.'], ['Le format de la source', 'Le format change le débit, pas l\'impédance des pièces de la liaison.']], answer: 0,
            aides: ['Un dépassement vient d\'une réflexion, donc d\'une rupture d\'impédance.', 'Les BNC 50 Ω et 75 Ω s\'emboîtent : la 50 Ω montre une broche épaisse et un diélectrique blanc.'],
            solution: 'Une **pièce 50 Ω** : coefficient de réflexion (75 − 50) / (75 + 50) = 20 %, hors tolérance. Tout doit être en 75 Ω.',
          },
          {
            type: 'choix', q: 'Le réalisateur veut la même caméra au mélangeur et sur l\'écran géant. Comment la dédoubler ?',
            choices: ['Par la grille ou un distributeur (DA), qui recopie et régénère le signal', ['Avec un T BNC sur la sortie de la CCU', 'Un T casse l\'impédance de 75 Ω : réflexions et œil fermé sur les deux branches.'], ['En montant le niveau de sortie de la CCU', 'Le niveau SDI est fixe, 800 mV : il ne se règle pas pour alimenter deux entrées.']], answer: 0,
            aides: ['Une sortie SDI alimente une seule entrée.', 'Quel appareil du car recopie un signal vers plusieurs sorties ?'],
            solution: 'Par la **grille ou un DA** : le SDI reste point à point, l\'appareil recopie le signal neuf vers chaque destination.',
          },
        ]),
      ];
    },
  },
  'sdi-grille': {
    titre: 'Commuter sans se tromper',
    consigne: 'Au poste Grille, tu commandes la Videohub 40 × 40 du car : des messages par le réseau, des points de croisement, des verrous et des étiquettes.',
    gen: (rnd) => {
      const cam = entre(rnd, 1, 16);
      const R = pick(rnd, [
        { a: cam, src: `CAM ${cam}`, b: 35 + entre(rnd, 0, 5), dst: '' },
        { a: cam, src: `CAM ${cam}`, b: 33, dst: 'ÉCRAN GÉANT' },
        { a: 24, src: 'PGM', b: 31, dst: 'TX1 FIBRE' },
        { a: 24, src: 'PGM', b: 32, dst: 'TX2 SAT' },
        { a: 22, src: 'MIRE', b: 31, dst: 'TX1 FIBRE' },
        { a: 25, src: 'CLEAN', b: 33, dst: 'ÉCRAN GÉANT' },
        { a: pick(rnd, [17, 18]), src: '', b: entre(rnd, 1, 22), dst: '' },
      ]);
      const src = R.src || (R.a === 17 ? 'EVS A' : 'EVS B');
      const dst = R.dst || (R.b >= 35 ? `MV ${R.b - 22}` : `MÉL ${R.b}`);
      const msg = `${R.b - 1} ${R.a - 1}`;
      const E = pick(rnd, [16, 40, 72, 120]), S = pick(rnd, [16, 40, 72, 120]), ferme = rnd() < 0.5;
      return [
        {
          type: 'texte', placeholder: '30 23', accept: msg,
          q: `Par le réseau (protocole de la Videohub, TCP 9990), tu envoies l'entrée **${R.a} « ${src} »** sur la sortie **${R.b} « ${dst} »**. Qu'écris-tu sous \`VIDEO OUTPUT ROUTING:\` ?`,
          pieges: [
            { v: `${R.b} ${R.a}`, why: 'Ce sont les numéros de la façade : le protocole compte les ports à partir de 0.' },
            { v: `${R.a - 1} ${R.b - 1}`, why: 'L\'ordre est inversé : la sortie d\'abord, l\'entrée ensuite.' },
            { v: `${R.a} ${R.b}`, why: 'Deux erreurs : la sortie vient d\'abord, et les ports se comptent à partir de 0.' },
          ].filter((x) => x.v !== msg),
          aides: ['Le protocole donne la sortie d\'abord, puis l\'entrée.', 'Les ports y sont comptés à partir de 0 : retire 1 à chaque numéro de la façade. Exemple de la leçon : « 30 23 » route l\'entrée 24 sur la sortie 31.'],
          solution: `**${msg}** : la sortie ${R.b} devient ${R.b - 1}, l'entrée ${R.a} devient ${R.a - 1}. La grille répond ACK et prévient tous ses clients.`,
        },
        ferme
          ? {
            type: 'nombre', answer: S,
            q: `Une grille de **${E} entrées × ${S} sorties** : combien de points de croisement peuvent être fermés en même temps, au plus ?`,
            pieges: [{ v: E * S, why: 'C\'est le nombre de points de croisement de la matrice, pas ceux qui peuvent être fermés ensemble.' }, ...(E !== S ? [{ v: E, why: 'Une entrée peut partir vers autant de sorties qu\'on veut : c\'est la sortie qui limite.' }] : [])],
            aides: ['Une sortie ne reçoit qu\'une source à la fois.', 'Un point fermé au plus par ligne de la matrice, c\'est-à-dire par sortie.'],
            solution: `**${S}** : un par sortie, jamais deux. L'état de la grille tient en ${S} nombres, l'entrée de chaque sortie.`,
          }
          : {
            type: 'nombre', answer: E * S,
            q: `Une grille de **${E} entrées × ${S} sorties** : combien de points de croisement compte sa matrice ?`,
            pieges: [{ v: E + S, why: 'Un point de croisement est à l\'intersection d\'une entrée et d\'une sortie : c\'est un produit.' }],
            aides: ['La matrice a une ligne par sortie et une colonne par entrée.', 'Chaque case (ligne, colonne) est un point de croisement.'],
            solution: `${E} × ${S} = **${fr(E * S)}** points de croisement (la Videohub du car : 40 × 40 = 1 600), dont un seul fermé par sortie.`,
          },
        pick(rnd, [
          {
            type: 'ordre', q: 'À la façade de la Videohub, remets dans l\'ordre la commutation d\'une caméra vers une tuile du multiview.',
            items: ['OUT, puis le numéro de la sortie (la destination)', 'IN, puis la source', 'Regarder l\'image de la source à l\'écran', 'TAKE pour valider'],
            aides: ['On commute toujours dans le même ordre : la destination d\'abord.', 'Destination, source, contrôle, validation.'],
            solution: 'Destination (OUT), source (IN), un regard sur l\'image (une étiquette n\'est qu\'un nom), puis **TAKE** ; CLEAR annule.',
          },
          {
            type: 'ordre', q: 'Avant le match, la chaîne demande un test de ligne sur TX1, verrouillé. Remets les étapes dans l\'ordre.',
            items: ['Prévenir à l\'intercom et déverrouiller TX1', 'Router la mire sur TX1', 'Faire le test avec la chaîne', 'Remettre le PGM sur TX1', 'Reverrouiller TX1'],
            aides: ['Une sortie verrouillée refuse toute commutation : il faut commencer par la libérer.', 'On déverrouille, on teste, on remet le programme, on reverrouille.'],
            solution: 'Déverrouiller, mire, test, PGM, **reverrouiller** : le départ vers la chaîne ne reste jamais libre pendant le direct.',
          },
        ]),
        pick(rnd, [
          {
            type: 'choix', q: 'Tu rappelles le salvo « match » ; TX2 était verrouillé sur la mire depuis le test de ligne. Que reçoit TX2 ?',
            choices: ['Toujours la mire : une sortie verrouillée refuse aussi les salvos', ['Le PGM, comme le prévoit le salvo', 'Une sortie verrouillée refuse toute commutation, d\'où qu\'elle vienne, salvo compris.'], ['Rien : le salvo est annulé en entier', 'Le salvo change les autres sorties ; seule la sortie verrouillée garde sa source.']], answer: 0,
            aides: ['Un verrou fige une sortie, d\'où que vienne la demande.', 'Un salvo n\'est qu\'un ensemble de commutations.'],
            solution: 'TX2 garde **la mire** : la chaîne ne reçoit pas le programme. D\'où la règle : relire l\'état de la grille après chaque salvo.',
          },
          {
            type: 'choix', q: 'Le réalisateur demande la CAM 3 sur MV 13 ; l\'étiquette dit « CAM 3 » mais l\'image est celle de la caméra 2. Où est l\'erreur ?',
            choices: ['Dans les étiquettes des entrées : à relire avec la liste de câblage', ['Dans la grille, qui a routé la mauvaise entrée', 'La grille a fermé le point demandé : elle route une entrée, pas un nom.'], ['Dans le multiview, qui affiche mal la tuile', 'La tuile montre ce que la sortie reçoit : c\'est bien la caméra 2 qui arrive.']], answer: 0,
            aides: ['Une étiquette n\'est qu\'un nom écrit dans Videohub Setup.', 'Compare le nom, l\'image et le câblage.'],
            solution: 'Les **étiquettes** : l\'entrée appelée « CAM 3 » est câblée sur la caméra 2. On regarde l\'image avant de valider, et l\'on relit les étiquettes au line-up.',
          },
          {
            type: 'choix', q: 'Une source arrive hors phase à la grille. Comment ressort-elle ?',
            choices: ['Régénérée (reclockée), mais toujours hors phase', ['Remise en phase par la grille', 'La grille se sert de la référence pour commuter au top image ; elle ne décale pas une source dans le temps.'], ['Coupée par la grille', 'La grille ne juge pas la phase de ses entrées : elle recopie ce qu\'elle reçoit.']], answer: 0,
            aides: ['Que fait la grille sur chaque sortie ? Et à quoi lui sert la référence ?', 'Réhorloger régénère les bits ; remettre en phase demanderait de retarder l\'image.'],
            solution: '**Régénérée mais hors phase** : la grille remet le budget de câble à zéro, pas le temps ; c\'est au réglage de phase de la source (ou à un synchroniseur) de le faire.',
          },
          {
            type: 'choix', q: 'Tu veux commuter une sortie que le protocole montre à l\'état « L ». Que faire ?',
            choices: ['Appeler à l\'intercom le poste qui l\'a verrouillée avant toute chose', ['La commuter : le verrou ne vaut que pour la façade', 'Un verrou vaut pour tous les postes : la commutation sera refusée.'], ['Elle est libre : L veut dire « libre »', 'Libre, c\'est U ; O, verrouillée par ce poste ; L, par un autre poste.']], answer: 0,
            aides: ['Trois états : U, O, L.', 'L : verrouillée par un autre poste que le tien.'],
            solution: '**L**, c\'est le verrou d\'un autre poste : on ne le force qu\'après l\'avoir appelé à l\'intercom.',
          },
        ]),
      ];
    },
  },
  'sdi-embedded': {
    titre: 'Ranger le son dans le SDI',
    consigne: 'À la transmission, tu retrouves des canaux audio embarqués dans le programme : leur groupe, leur paire AES, ce qu\'ils pèsent, et ce qui les fait disparaître.',
    gen: (rnd) => {
      const c = entre(rnd, 1, 16), g = Math.ceil(c / 4), p = c % 2 ? c : c - 1;
      const n = pick(rnd, [2, 4, 8, 16, 32]), deb = n * 24 * 48000 / 1e6;
      return [
        {
          type: 'nombre', answer: g, q: `Le canal audio **${c}** est embarqué dans le programme (ST 299-1). Dans quel groupe se trouve-t-il ?`,
          pieges: [...(Math.ceil(c / 2) !== g ? [{ v: Math.ceil(c / 2), why: 'C\'est le rang de sa paire AES : un groupe porte quatre canaux, deux paires.' }] : [])],
          aides: ['Un groupe porte quatre canaux.', 'Groupe 1 : canaux 1 à 4 ; groupe 2 : 5 à 8…'],
          solution: `Le **groupe ${g}** (canaux ${4 * g - 3} à ${4 * g}).`,
        },
        {
          type: 'texte', placeholder: '5-6', accept: [`${p}-${p + 1}`, `${p}/${p + 1}`, `${p}et${p + 1}`, `${p},${p + 1}`], forme: 'ip',
          q: `Le désembeddeur sort le groupe ${g} en paires AES. Sur quelle paire écoutes-tu le canal **${c}** ? (écris les deux canaux, par exemple 5-6)`,
          pieges: [c % 2 ? { v: `${c - 1}-${c}`, why: 'Une paire AES commence par un canal impair : 1-2, 3-4, 5-6…' } : { v: `${c}-${c + 1}`, why: 'Une paire AES commence par un canal impair : 1-2, 3-4, 5-6…' }].filter((x) => !x.v.startsWith('0-')),
          aides: ['Une paire AES porte deux canaux qui se suivent.', 'Les paires commencent par un canal impair : 1-2, 3-4, 5-6, 7-8…'],
          solution: `La paire **${p}-${p + 1}**, la ${p === 4 * g - 3 ? 'première' : 'seconde'} du groupe ${g}.`,
        },
        {
          type: 'nombre', unite: 'Mb/s', answer: Math.round(deb * 1000) / 1000, tol: deb * 0.01,
          q: `Combien pèsent **${n} canaux** embarqués, à 48 kHz et 24 bits, en Mb/s ?${n > 16 ? ' (32 canaux : possible en 3G et 12G, ST 299-2)' : ''}`,
          pieges: [{ v: Math.round(n * 16 * 48000 / 1e3) / 1e3, why: 'C\'est en 16 bits : l\'audio embarqué est à 24 bits.' }],
          aides: ['Débit = canaux × bits par échantillon × échantillons par seconde.', `${n} × 24 × 48 000, puis divise par un million.`],
          solution: `${n} × 24 × 48 000 = **${fr(deb, 3)} Mb/s**, ${fr(deb / 2970 * 100, 2)} % d'une liaison 3G : le son voyage presque gratuitement avec l'image.`,
        },
        pick(rnd, [
          {
            type: 'choix', q: 'Après une commutation de grille, l\'image est bonne mais le son a disparu. Où chercher ?',
            choices: ['Dans l\'embedding de la nouvelle source : groupe, canaux, embedder actif', ['Dans la longueur du câble', 'Un câble trop long donne des erreurs sur l\'image aussi, pas seulement sur le son.'], ['Dans la grille, qui a retiré l\'audio', 'Une grille laisse passer les paquets ancillary intacts.']], answer: 0,
            aides: ['L\'image passe : le câble et la grille font leur travail.', 'Deux sources n\'embarquent pas forcément leur son dans les mêmes groupes.'],
            solution: 'L\'**embedding de la source** : elle n\'embarque pas son audio dans le même groupe, ou pas du tout.',
          },
          {
            type: 'choix', q: 'Le timecode embarqué est présent à la sortie de la grille, absent après le convertisseur placé en aval. Où chercher ?',
            choices: ['Dans le convertisseur : il doit réinsérer les paquets ancillary sur sa sortie', ['Dans la grille', 'Le timecode est bien là à sa sortie : une grille laisse passer les paquets.'], ['Dans le câble entre les deux', 'Un câble ne trie pas les données : trop long, il ferait des erreurs partout.']], answer: 0,
            aides: ['Un appareil qui ne fait que recopier laisse passer les paquets ; un appareil qui retravaille l\'image doit les réécrire.', 'Le paquet est présent avant le convertisseur.'],
            solution: 'Le **convertisseur** : un mélangeur ou un convertisseur doivent réinsérer les paquets ancillary, et c\'est là qu\'ils se perdent parfois.',
          },
          {
            type: 'choix', q: 'Où le SDI range-t-il le timecode (ATC) et l\'identifiant de format (VPID) ?',
            choices: ['Dans le VANC, la suppression verticale', ['Dans l\'HANC du flux C, avec l\'audio', 'L\'audio est bien dans l\'HANC ; le timecode et le VPID, une fois par image, sont dans les lignes de suppression verticale.'], ['À la place de quelques pixels de la vidéo active', 'Les paquets ancillary ne touchent jamais à la vidéo active.']], answer: 0,
            aides: ['Ces deux paquets ne passent qu\'une fois par image.', 'Une fois par image : entre deux images, pas entre deux lignes.'],
            solution: 'Dans le **VANC** (lignes 9 et 10 en 1080) ; l\'audio, lui, est dans l\'HANC du flux C, à chaque ligne.',
          },
          {
            type: 'choix', q: 'Combien de canaux audio au plus un HD-SDI embarque-t-il ?',
            choices: ['16 (quatre groupes de quatre)', ['8', 'Ce sont deux groupes : le HD-SDI en accepte quatre.'], ['32', 'C\'est le 3G et le 12G (ST 299-2) ; le HD-SDI s\'arrête à 16.']], answer: 0,
            aides: ['ST 299-1 définit des groupes de quatre canaux.', 'Le HD-SDI accepte quatre groupes.'],
            solution: '**16 canaux**, à 48 kHz et 24 bits ; 32 en 3G et 12G.',
          },
        ]),
      ];
    },
  },
  'sdi-falaise': {
    titre: 'Garder de la marge avant la falaise',
    consigne: 'Avant le direct, tu passes en revue les liaisons coaxiales du car : ce que le débit change à la portée, et ce que montre une liaison qui approche de la falaise.',
    gen: (rnd) => {
      const [A, B] = pick(rnd, [[4, 1], [4, 2], [2, 1], [1, 0], [4, 0], [3, 1]]).map((k) => LIAISONS[k]);
      const ratio = A.g / B.g;
      const F = pick(rnd, [{ id: 'UHD', nom: '12G-SDI (2160p50)' }, { id: 'HD', nom: '3G-SDI (1080p50)' }, { id: 'HDi', nom: 'HD-SDI (1080i)' }]);
      const max = LINKS.coax.max[F.id], loin = rnd() < 0.5, L = loin ? Math.round(max * (1.2 + rnd() * 0.3) / 5) * 5 : Math.round(max * (0.3 + rnd() * 0.3) / 5) * 5;
      return [
        {
          type: 'ordre', q: 'On allonge pas à pas le câble d\'une liaison SDI. Remets dans l\'ordre ce que l\'on observe.',
          items: ['Image parfaite, aucune erreur', 'Image parfaite, mais le PRISM compte des erreurs CRC', 'Des étincelles et des gels', 'Plus d\'image'],
          aides: ['En numérique, l\'image ne se dégrade pas peu à peu.', 'Les premières erreurs sont invisibles : seul l\'analyseur les voit.'],
          solution: 'Parfaite, puis des **erreurs invisibles** (CRC), puis des étincelles, puis plus rien, en quelques mètres : c\'est la falaise. D\'où la marge et la surveillance des CRC.',
        },
        {
          type: 'nombre', answer: r2(ratio), tol: 0.02,
          q: `Combien de fois plus de bits par seconde le **${A.nom}** (${fr(A.g, A.g < 1 ? 2 : 3)} Gb/s) envoie-t-il que le **${B.nom}** (${fr(B.g, B.g < 1 ? 2 : 3)} Gb/s) ?`,
          pieges: [{ v: r2(B.g / A.g), why: 'Le rapport est inversé : divise le plus grand débit par le plus petit.' }],
          aides: ['Un rapport de débits se calcule par une division.', `${fr(A.g, 3)} ÷ ${fr(B.g, 3)}.`],
          solution: `${fr(A.g, 3)} ÷ ${fr(B.g, 3)} = **${fr(ratio, 2)}** : des fréquences ${fr(ratio, 1)} fois plus hautes, que le câble affaiblit davantage. Plus le débit monte, plus la portée baisse.`,
        },
        {
          type: 'choix', q: `Le plan caméras du car accepte jusqu'à ≈ ${max} m de coaxial en **${F.nom}** (un ordre de grandeur, avec l'égaliseur du récepteur). Une caméra y est reliée par **${L} m**. Que voit-on au multiview ?`,
          choices: [
            loin ? ['Une image parfaite', `À ${L} m, on dépasse la portée : le récepteur ne distingue plus les 0 des 1.`] : 'Une image parfaite',
            loin ? 'Des étincelles, ou plus d\'image du tout' : ['Des étincelles, ou plus d\'image du tout', `À ${L} m, on est loin de la limite : chaque bit est lu juste.`],
            ['Une image un peu plus sombre et moins nette', 'C\'était l\'analogique. En numérique, l\'image est parfaite, ou elle casse.'],
          ],
          answer: loin ? 1 : 0,
          aides: ['Compare la longueur à la portée.', 'En numérique, c\'est tout ou rien.'],
          solution: loin ? `**Des étincelles ou plus rien** : ${L} m dépassent les ≈ ${max} m. Il faut une liaison plus courte, un répéteur ou de la fibre.` : `**Une image parfaite** : ${L} m restent bien sous les ≈ ${max} m, avec de la marge.`,
        },
        pick(rnd, [
          {
            type: 'choix', q: 'Au PRISM, le compteur CRC d\'une caméra en 3G grimpe, alors que son image est parfaite au multiview. Que faire ?',
            choices: ['Retrouver de la marge avant le direct : la liaison est au bord de la falaise', ['Rien : tant que l\'image est parfaite, la liaison est bonne', 'Les erreurs invisibles sont la première marche de la falaise : quelques mètres de plus, et l\'image casse.'], ['La surveiller au multiview : l\'image va se dégrader peu à peu', 'En numérique, elle ne se dégrade pas peu à peu : elle reste parfaite, puis elle casse.']], answer: 0,
            aides: ['Que compte le CRC de chaque ligne ?', 'Les erreurs apparaissent bien avant qu\'on voie quoi que ce soit.'],
            solution: 'La liaison est **au bord de la falaise** : on la raccourcit, on insère un répéteur, ou on passe en fibre avant le direct.',
          },
          {
            type: 'choix', q: 'Un signal UHD arrive en quad-link 2SI. On branche un seul des quatre câbles 3G sur un moniteur HD. Que voit-on ?',
            choices: ['L\'image entière, en HD', ['Un quart de l\'image', 'C\'est le cas en square division ; en 2SI, chaque câble porte une image entière en HD.'], ['Rien de lisible', 'En 2SI, chaque câble est une image HD complète, lisible seule.']], answer: 0,
            aides: ['Il existe deux façons de répartir l\'UHD sur quatre câbles.', '2SI : quatre images HD entrelacées point par point.'],
            solution: '**L\'image entière en HD** : en 2SI, chaque câble porte une image complète ; en square division, on n\'aurait vu qu\'un carré.',
          },
          {
            type: 'choix', q: 'Pourquoi un même coaxial porte-t-il moins loin le 12G-SDI que le HD-SDI ?',
            choices: ['Parce que son débit est huit fois plus élevé, et que le câble affaiblit davantage les fréquences hautes', ['Parce que l\'image UHD est compressée', 'Le SDI transporte l\'image non compressée, en UHD comme en HD.'], ['Parce que le 12G demande plus d\'amplitude', 'L\'amplitude est la même : 800 mV crête à crête.']], answer: 0,
            aides: ['Que fait un coaxial aux fréquences hautes ?', '11,88 Gb/s contre 1,485 Gb/s.'],
            solution: '**Huit fois plus de débit**, des fréquences plus hautes, plus affaiblies : ≈ 70 m en 12G contre bien plus en HD sur le même câble.',
          },
        ]),
      ];
    },
  },
  'sdi-oeil': {
    titre: 'Le budget d\'une liaison et son œil',
    consigne: 'À la baie de mesure, tu calcules l\'affaiblissement d\'une liaison de 1694A, tu le compares à ce que la norme garantit, et tu lis la gigue.',
    gen: (rnd) => {
      const C = pick(rnd, CABLE), cas = pick(rnd, C.garantie === 40 ? ['dans', 'hors'] : ['dans', 'bord', 'hors']);
      // une longueur tirée dans la zone voulue : sous la garantie, entre la garantie et 40 dB, au-delà de 40 dB
      const lmax = (db) => db / C.k * 100;
      const L = Math.round((cas === 'dans' ? lmax(C.garantie) * (0.4 + rnd() * 0.5) : cas === 'bord' ? lmax(C.garantie) + (lmax(40) - lmax(C.garantie)) * (0.15 + rnd() * 0.7) : lmax(40) * (1.1 + rnd() * 0.3)) / 5) * 5;
      const att = L * C.k / 100;
      const zone = att <= C.garantie ? 0 : att <= 40 ? 1 : 2;
      const D = pick(rnd, CABLE), ui = 1000 / D.g, gig = D.gigue * ui;
      return [
        {
          type: 'nombre', unite: 'dB', answer: r1(att), tol: 0.3,
          q: `Une liaison **${C.nom}** de **${L} m** de 1694A : ce câble perd ≈ ${fr(C.k, 1)} dB/100 m à la demi-fréquence d'horloge (${C.f}). Quel affaiblissement ?`,
          pieges: CABLE.filter((x) => x !== C).map((x) => ({ v: r1(L * x.k / 100), why: `C'est l'affaiblissement en ${x.nom} : prends celui du ${C.nom}.` })),
          aides: ['L\'affaiblissement est proportionnel à la longueur.', `${L} m × ${fr(C.k, 1)} dB pour 100 m.`],
          solution: `${L} × ${fr(C.k / 100, 3)} = **${fr(att, 1)} dB**.`,
        },
        {
          type: 'choix', q: `Ces ${fr(att, 1)} dB, pour un récepteur ${C.nom} : la norme garantit ${C.garantie} dB d'égalisation, les bons égaliseurs actuels vont vers 35 à 40 dB. Que conclure ?`,
          choices: ['Dans la garantie : la liaison passe avec de la marge', 'Au-delà de la garantie : elle tient grâce à un bon égaliseur, sans marge ; surveiller les CRC ou ajouter un répéteur', 'Au-delà de ce qu\'un bon égaliseur sait faire : répéteur, liaison plus courte ou fibre'],
          answer: zone,
          aides: [`Compare ${fr(att, 1)} dB à ${C.garantie} dB, puis à 40 dB.`, 'Trois zones : sous la garantie, entre la garantie et ≈ 40 dB, au-delà.'],
          solution: zone === 0 ? `**${fr(att, 1)} ≤ ${C.garantie} dB** : tout récepteur conforme passe, avec ${fr(C.garantie - att, 1)} dB de marge.` : zone === 1 ? `**${fr(att, 1)} dB** dépassent les ${C.garantie} dB garantis : la liaison dépend d'un égaliseur meilleur que la norme, sans marge.` : `**${fr(att, 1)} dB** : même un bon égaliseur ne rouvrira pas l'œil. Répéteur à mi-parcours, liaison plus courte ou fibre.`,
        },
        {
          type: 'nombre', unite: 'm', answer: Math.round(lmax(C.garantie)), tol: 2,
          q: `Quelle longueur de 1694A la norme garantit-elle en **${C.nom}** (${C.garantie} dB d'égalisation, ${fr(C.k, 1)} dB/100 m) ?`,
          pieges: C.garantie === 40 ? [{ v: Math.round(20 / C.k * 100), why: 'Les 20 dB valent pour le HD et le 3G ; en 12G, la norme exige 40 dB.' }] : [{ v: Math.round(40 / C.k * 100), why: 'Les 40 dB valent pour le 6G et le 12G ; en HD et en 3G, la norme exige 20 dB.' }],
          aides: ['La longueur garantie est celle dont l\'affaiblissement égale ce que l\'égaliseur doit compenser.', `${C.garantie} dB ÷ ${fr(C.k, 1)} dB × 100 m.`],
          solution: `${C.garantie} ÷ ${fr(C.k, 1)} × 100 ≈ **${Math.round(lmax(C.garantie))} m** garantis ; les constructeurs annoncent souvent plus, sans garantie.`,
        },
        {
          type: 'nombre', unite: 'ps', answer: Math.round(gig * 10) / 10, tol: Math.max(1, gig * 0.02),
          q: `En **${D.nom}** (${fr(D.g, 3)} Gb/s), la gigue d'alignement admise est de ${fr(D.gigue, 1)} UI. Combien de picosecondes ? (1 UI = la durée d'un bit)`,
          pieges: [{ v: Math.round(ui * 10) / 10, why: 'C\'est la durée d\'un bit entière, 1 UI : la gigue admise n\'en est qu\'une fraction.' }],
          aides: ['Commence par la durée d\'un bit : 1 ÷ le débit.', `1 UI = 1 000 ÷ ${fr(D.g, 3)} ps ; puis × ${fr(D.gigue, 1)}.`],
          solution: `1 UI = ${fr(ui, 1)} ps ; × ${fr(D.gigue, 1)} = **${fr(gig, 1)} ps**. Au-delà, les croisements de l'œil s'épaississent et l'œil se ferme sur les côtés.`,
        },
      ];
    },
  },
  'sdi-bits': {
    titre: 'Du mot au bit, sur le câble',
    consigne: 'Tu suis quelques mots de la ligne jusqu\'au câble : la durée d\'un bit, l\'ordre de leurs bits, le codage NRZI, et ce que le récepteur en fait.',
    gen: (rnd) => {
      const D = pick(rnd, LIAISONS.filter((l) => l.nom !== '6G-SDI')), ui = 1000 / D.g;
      const w = pick(rnd, [0x200, 0x040, 0x3AC, 0x2D8, 0x110, 0x0F0, entre(rnd, 4, 1019)]);
      const lsb = [...Array(10).keys()].map((k) => (w >> k) & 1).join(''), msb = lsb.split('').reverse().join('');
      const y = [...Array(8)].map(() => (rnd() < 0.5 ? 1 : 0));
      if (!y.some((b) => b)) y[entre(rnd, 0, 7)] = 1;
      let niv = 0; const lv = y.map((b) => (niv ^= b));
      return [
        {
          type: 'nombre', unite: 'ps', answer: Math.round(ui * 10) / 10, tol: ui * 0.01,
          q: `En **${D.nom}** (${fr(D.g, D.g < 1 ? 2 : 3)} Gb/s), combien de picosecondes dure un bit (une unité d'intervalle, UI) ?`,
          pieges: [{ v: Math.round(ui * 100) / 10, why: 'Dix fois trop : c\'est la durée d\'un mot de 10 bits.' }],
          aides: ['La durée d\'un bit est l\'inverse du débit.', `1 ÷ ${fr(D.g, 3)} × 10⁹ bits/s, soit 1 000 ÷ ${fr(D.g, 3)} ps.`],
          solution: `1 000 ÷ ${fr(D.g, 3)} = **${fr(ui, 1)} ps**. Plus le débit monte, plus l'œil est étroit.`,
        },
        {
          type: 'texte', placeholder: '0000000001', forme: 'ip', accept: lsb,
          q: `Le mot **${w.toString(16).toUpperCase().padStart(3, '0')}h** s'écrit ${msb} en binaire (b9 à gauche). Écris ses 10 bits dans l'ordre où ils partent sur le câble.`,
          pieges: msb !== lsb ? [{ v: msb, why: 'C\'est l\'ordre d\'écriture, bit de poids fort à gauche : le SDI envoie le bit de poids faible d\'abord.' }] : [],
          aides: ['Le SDI envoie chaque mot bit de poids faible d\'abord.', 'Lis l\'écriture binaire de droite à gauche.'],
          solution: `**${lsb}** : b0 part le premier, b9 le dernier. L'embrouillage vient ensuite mélanger cette suite.`,
        },
        {
          type: 'texte', placeholder: '01101101', forme: 'ip', accept: lv.join(''),
          q: `Après l'embrouillage, voici 8 bits : **${y.join(' ')}**. Le câble part du niveau 0. Écris les 8 niveaux successifs en NRZI (un 1 fait basculer le niveau, un 0 le garde).`,
          pieges: y.join('') !== lv.join('') ? [{ v: y.join(''), why: 'Ce sont les bits eux-mêmes : en NRZI, l\'information est dans les changements de niveau, pas dans le niveau.' }] : [],
          aides: ['Pars du niveau 0 et lis les bits un à un.', 'À chaque 1, le niveau change (0 → 1 ou 1 → 0) ; à chaque 0, il reste le même.'],
          solution: `**${lv.join('')}** : un 1 fait basculer, un 0 garde. Inverse la polarité du câble : les niveaux changent tous, mais les bascules, donc les données, restent les mêmes.`,
        },
        pick(rnd, [
          {
            type: 'choix', q: 'Un convertisseur inverse la polarité du signal SDI. Que se passe-t-il ?',
            choices: ['Rien : en NRZI, l\'information est dans les changements de niveau', ['L\'image devient un négatif', 'Ce serait le cas avec un codage par niveau ; en NRZI, inverser tous les niveaux garde les mêmes bascules.'], ['Le récepteur perd l\'horloge', 'L\'inversion ne supprime aucune transition : l\'horloge reste calée.']], answer: 0,
            aides: ['Où est l\'information en NRZI : dans le niveau, ou dans ses changements ?', 'Inverser tous les niveaux change-t-il un seul changement de niveau ?'],
            solution: '**Rien** : les bascules restent les mêmes, les données aussi.',
          },
          {
            type: 'choix', q: 'Pourquoi le flux SDI est-il embrouillé (x⁹ + x⁴ + 1) avant d\'être envoyé ?',
            choices: ['Pour qu\'il y ait assez de transitions : le récepteur en tire l\'horloge', ['Pour le chiffrer', 'Le polynôme est public : le récepteur désembrouille sans rien connaître de l\'émetteur.'], ['Pour réduire le débit', 'Un bit embrouillé pour un bit de donnée : le débit ne change pas.']], answer: 0,
            aides: ['Le SDI n\'a pas de fil d\'horloge.', 'Une ligne noire ne compte qu\'un 1 par mot : que manquerait-il au récepteur ?'],
            solution: 'Pour les **transitions** : la PLL du récepteur se recale sur elles ; une image noire ou un repère SAV en donneraient trop peu.',
          },
          {
            type: 'choix', q: 'Comment le récepteur trouve-t-il où commence chaque mot de 10 bits ?',
            choices: ['Il cherche la suite 3FF 000 000, interdite à l\'image et au son', ['Il compte les bits depuis l\'allumage de l\'émetteur', 'Le récepteur peut être branché à tout moment : il ne sait rien du début de l\'émission.'], ['Un fil à part lui envoie un top de mot', 'Le SDI n\'a qu\'un conducteur utile.']], answer: 0,
            aides: ['Certaines valeurs sont réservées aux repères EAV et SAV.', '000 à 003 et 3FC à 3FF ne peuvent pas apparaître dans l\'image.'],
            solution: 'La suite **3FF 000 000** : quand elle passe, un repère commence, et le récepteur aligne ses mots dessus.',
          },
          {
            type: 'choix', q: 'Avant le direct, on envoie la mire checkfield sur une longue liaison 3G. Pourquoi ?',
            choices: ['Elle produit les motifs les plus durs pour l\'égaliseur et la PLL', ['Pour régler la colorimétrie', 'Ce n\'est pas une mire de couleur : ses motifs sont choisis pour le codage du câble.'], ['Elle coupe l\'embrouillage pendant le test', 'L\'embrouillage reste actif : c\'est avec lui que ses motifs donnent de longs paliers.']], answer: 0,
            aides: ['Certains motifs rencontrés par l\'embrouilleur donnent encore de longs paliers.', 'Sa moitié haute éprouve l\'égaliseur, sa moitié basse la récupération d\'horloge (RP 198).'],
            solution: 'C\'est le **pire cas** d\'une image : si elle passe avec de la marge, toute image passera.',
          },
        ]),
      ];
    },
  },
});

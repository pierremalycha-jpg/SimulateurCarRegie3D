// @ts-check
// ----------------------------------------------------------------------------------
// Catalogue, groupe Blackmagic Design : le mélangeur ATEM Television Studio HD8 ISO, les
// enregistreurs HyperDeck Studio HD Plus et HD Mini, les convertisseurs Teranex Mini SDI to Audio
// 12G (désembedder) et Audio to SDI 12G (embedder), et le boîtier GPI and Tally Interface.
//
// Sources : fiches techniques et pages produit Blackmagic Design (ATEM Television Studio HD8 ISO,
// HyperDeck Studio, Teranex Mini, GPI and Tally Interface), manuels « ATEM Television Studio HD »,
// « HyperDeck Disk Recorders » et « Teranex Mini Converters », tels que cités par les revendeurs et
// les essais (Streaming Media, Here to Record) : le réseau de rédaction ne permettait pas d'ouvrir
// les PDF constructeur. L'inventaire des connecteurs suit ces documents ; la disposition sur les
// faces est schématique ; ce qui n'a pas pu être confirmé est listé dans `averifier` de chaque
// modèle. Les prix sont des ordres de grandeur (€ HT, d'après les tarifs publics en dollars).
// ----------------------------------------------------------------------------------
import { row } from './divers.js';

/** @typedef {import('../types.js').Modele} Modele */
/** @typedef {import('../types.js').Port} Port */
/** @typedef {import('../types.js').PortKind} PortKind */
/** @typedef {import('../types.js').Signal} Signal */
/** @typedef {import('../types.js').Dir} Dir */
/** @typedef {import('../types.js').FaceItem} FaceItem */

/** un port, en une ligne */
function P(/** @type {string} */ id, /** @type {string} */ label, /** @type {PortKind} */ kind, /** @type {Signal} */ sig, /** @type {Dir} */ dir, /** @type {string} */ group, /** @type {string} */ desc, /** @type {Partial<Port>} */ extra = {}) {
  return /** @type {Port} */ ({ id, label, kind, sig, dir, group, desc, ...extra });
}
/** le dessin de la visionneuse (equipment/viewer.js) pour chaque connecteur (même table que CONNECTEURS, recopiée ici pour éviter l'import circulaire du registre) */
const DESSIN = { bnc: 'bnc', hdmi: 'usb', rj45: 'rj45', rj12: 'rj45', xlr3: 'xlr', xlr4: 'xlr', xlr5: 'xlr', rca: 'jack', toslink: 'jack', usbc: 'usb', dsub9: 'dsub9', dsub25: 'dsub25', dc: 'jack', iec: 'iec', sd: 'multi', jack63: 'jack' };
/** un port sur une face : le dessin est déduit du connecteur du port */
function fp(/** @type {Port[]} */ ports, /** @type {string} */ id, x, y, /** @type {string} */ l = '', extra = {}) {
  const p = ports.find((q) => q.id === id); if (!p) throw new Error('port inconnu sur la face : ' + id);
  return /** @type {FaceItem} */ ({ t: 'port', id, k: DESSIN[p.kind] || 'multi', x, y, l: l || p.label, ...extra });
}
const N8 = [1, 2, 3, 4, 5, 6, 7, 8];
const RESEAU_DHCP = { dhcp: true, ip: '', mask: '255.255.255.0', gw: '' };
const SDI3G = '3G-SDI (SMPTE ST 424) : SD, HD jusqu\'à 1080p60.';

// ============================================================ ATEM Television Studio HD8 ISO
const ATEM_PORTS = /** @type {Port[]} */ ([
  ...N8.map((n) => P(`sdi-in-${n}`, `SDI IN ${n}`, 'bnc', 'sdi', 'in', 'Entrées SDI', `Entrée ${n} du mélangeur (${SDI3G}) : une caméra, un HyperDeck, un ordinateur converti… Chaque entrée a son resynchroniseur : pas besoin de genlock sur les sources, mais toutes doivent être au format du mélangeur.`)),
  ...N8.map((n) => P(`sdi-out-${n}`, `SDI OUT ${n}`, 'bnc', 'sdi', 'out', 'Retours caméra', `Retour programme pour la caméra de l'entrée ${n} : le programme avec, embarqués, le tally, le talkback et la commande de caméra des caméras Blackmagic. Pour une caméra d'une autre marque, c'est un simple retour PGM.`)),
  P('sdi-out-pgm', 'PGM OUT', 'bnc', 'sdi', 'out', 'Sorties', 'La sortie programme : ce qui est à l\'antenne, avec l\'audio mixé embarqué. Vers l\'enregistreur, le diffuseur, le Teranex.'),
  P('sdi-out-aux1', 'AUX 1', 'bnc', 'sdi', 'out', 'Sorties', 'Sortie auxiliaire 1 : n\'importe quelle source ou le programme, choisie au pupitre (touches AUX) ou dans ATEM Software Control.'),
  P('sdi-out-aux2', 'AUX 2', 'bnc', 'sdi', 'out', 'Sorties', 'Sortie auxiliaire 2 : même chose que AUX 1, pour un second moniteur ou un retour plateau.'),
  P('sdi-out-mv', 'MULTIVIEW', 'bnc', 'sdi', 'out', 'Sorties', 'La mosaïque de contrôle en SDI : programme, prévisualisation et les entrées, en 4, 7, 10, 13 ou 16 fenêtres, avec les tallys et les vumètres.'),
  P('hdmi-out', 'HDMI OUT', 'hdmi', 'hdmi', 'out', 'Sorties', 'La même mosaïque (multiview) en HDMI, pour un écran informatique.'),
  P('madi-in', 'MADI IN', 'bnc', 'madi', 'in', 'Audio', 'Entrée MADI (AES10) : 32 voies audio numériques sur un seul coaxial, depuis une console de son.'),
  P('madi-out', 'MADI OUT', 'bnc', 'madi', 'out', 'Audio', 'Sortie MADI : jusqu\'à 64 voies (50 actives) vers la console : les voies des entrées SDI, pour mixer le son hors du mélangeur.'),
  P('xlr-in-1', 'XLR 1', 'xlr3', 'audio', 'in', 'Audio', 'Entrée micro / ligne symétrique 1 (XLR 3 broches) : un micro de plateau, mixé dans le programme par le Fairlight interne.'),
  P('xlr-in-2', 'XLR 2', 'xlr3', 'audio', 'in', 'Audio', 'Entrée micro / ligne symétrique 2.'),
  P('rca-in-l', 'RCA L', 'rca', 'audio', 'in', 'Audio', 'Entrée ligne asymétrique (HiFi), voie gauche : un lecteur, un ordinateur.'),
  P('rca-in-r', 'RCA R', 'rca', 'audio', 'in', 'Audio', 'Entrée ligne asymétrique, voie droite.'),
  P('headset', 'HEADSET', 'xlr5', 'audio', 'io', 'Talkback', 'Casque-micro du réalisateur (XLR 5 broches, câblage intercom standard) : il parle aux cadreurs par le talkback embarqué dans les retours SDI des caméras Blackmagic.'),
  ...[1, 2, 3, 4].map((n) => P(`lan-${n}`, `ETHERNET ${n}`, 'rj45', 'ip', 'io', 'Réseau', `Port ${n} du switch Gigabit interne (10/100/1000BASE-T) : les quatre ports forment un même réseau. Pupitre, ordinateur de contrôle (ATEM Software Control, TCP 9910), HyperDeck (TCP 9993), boîtier GPI & Tally, routeur pour le streaming.`, { nic: true })),
  P('usbc-1', 'USB-C 1', 'usbc', 'usb', 'io', 'USB', 'USB-C 3.0 : disque d\'enregistrement (programme et ISO), sortie webcam vers un ordinateur, ou liaison avec ATEM Software Control et ATEM Setup.'),
  P('usbc-2', 'USB-C 2', 'usbc', 'usb', 'io', 'USB', 'Second port USB-C : un second disque (enregistrement en relais quand le premier est plein) ou le partage de connexion Internet d\'un ordinateur pour le streaming.'),
  P('ref-in', 'REF IN', 'bnc', 'ref', 'in', 'Synchro', 'Entrée de référence (tri-level ou black burst) : verrouille le mélangeur sur la synchro de l\'installation. Facultatif : sans référence, le mélangeur bat sa propre mesure et resynchronise ses entrées.'),
  P('ref-out', 'REF OUT', 'bnc', 'ref', 'out', 'Synchro', 'Sortie de référence : la référence du mélangeur pour verrouiller un autre appareil (caméras à genlock).'),
  P('tc-in', 'TC IN', 'bnc', 'tc', 'in', 'Synchro', 'Entrée timecode LTC : un générateur externe horodate l\'enregistrement ISO.'),
  P('tc-out', 'TC OUT', 'bnc', 'tc', 'out', 'Synchro', 'Sortie timecode LTC du générateur interne, vers les HyperDeck.'),
  P('rs422', 'REMOTE', 'rj12', 'rs422', 'io', 'Commande', 'Port RS-422 sur RJ12 : commande de machines ou de têtes PTZ par le protocole VISCA, via un câble adaptateur.'),
  P('iec', 'AC IN', 'iec', 'secteur', 'in', 'Alimentation', 'Alimentation secteur 100-240 V (IEC C14) : 100 W au plus.', { watts: 100 }),
  P('dc', '12V DC IN', 'xlr4', 'dc12', 'in', 'Alimentation', 'Alimentation 12 V de secours ou de terrain (XLR 4 broches) : batterie, bloc externe ; prend le relais si le secteur tombe.'),
]);
function atemFaces() {
  const ar = /** @type {FaceItem[]} */ ([
    { t: 'body', x: 10, y: 10, w: 1180, h: 310, r: 8 },
    { t: 'text', x: 24, y: 34, s: 'ATEM TELEVISION STUDIO HD8 ISO · FACE ARRIÈRE', size: 13 },
    { t: 'group', x: 30, y: 50, w: 560, h: 82, l: 'Entrées SDI 3G' },
    { t: 'group', x: 30, y: 140, w: 560, h: 82, l: 'Retours caméra (programme + tally, talkback, commande)' },
    { t: 'group', x: 30, y: 230, w: 340, h: 82, l: 'Sorties' },
    { t: 'group', x: 380, y: 230, w: 240, h: 82, l: 'Synchro et timecode' },
    { t: 'group', x: 640, y: 50, w: 540, h: 82, l: 'Audio' },
    { t: 'group', x: 640, y: 140, w: 540, h: 82, l: 'Réseau (switch interne), USB, commande' },
    { t: 'group', x: 640, y: 230, w: 540, h: 82, l: 'Alimentation' },
  ]);
  row(ar, N8.map((n) => `sdi-in-${n}`), 70, 92, 68, 'bnc', N8.map((n) => `IN ${n}`), { small: true });
  row(ar, N8.map((n) => `sdi-out-${n}`), 70, 182, 68, 'bnc', N8.map((n) => `OUT ${n}`), { small: true });
  ar.push(fp(ATEM_PORTS, 'sdi-out-pgm', 70, 272, 'PGM', { small: true }), fp(ATEM_PORTS, 'sdi-out-aux1', 138, 272, 'AUX 1', { small: true }), fp(ATEM_PORTS, 'sdi-out-aux2', 206, 272, 'AUX 2', { small: true }), fp(ATEM_PORTS, 'sdi-out-mv', 274, 272, 'MULTIVIEW', { small: true }), fp(ATEM_PORTS, 'hdmi-out', 340, 272, 'HDMI MV'));
  ar.push(fp(ATEM_PORTS, 'ref-in', 420, 272, '', { small: true }), fp(ATEM_PORTS, 'ref-out', 480, 272, '', { small: true }), fp(ATEM_PORTS, 'tc-in', 540, 272, '', { small: true }), fp(ATEM_PORTS, 'tc-out', 600, 272, '', { small: true }));
  ar.push(fp(ATEM_PORTS, 'madi-in', 680, 92, '', { small: true }), fp(ATEM_PORTS, 'madi-out', 745, 92, '', { small: true }), fp(ATEM_PORTS, 'xlr-in-1', 820, 92), fp(ATEM_PORTS, 'xlr-in-2', 890, 92), fp(ATEM_PORTS, 'rca-in-l', 950, 92), fp(ATEM_PORTS, 'rca-in-r', 995, 92));
  ar.push(...[1, 2, 3, 4].map((n) => fp(ATEM_PORTS, `lan-${n}`, 685 + (n - 1) * 60, 182, `ETH ${n}`)), fp(ATEM_PORTS, 'usbc-1', 945, 182), fp(ATEM_PORTS, 'usbc-2', 1010, 182), fp(ATEM_PORTS, 'rs422', 1090, 182, 'REMOTE (RS-422)'));
  ar.push(fp(ATEM_PORTS, 'iec', 700, 272, 'AC IN 100-240 V'), fp(ATEM_PORTS, 'dc', 800, 272, '12V DC IN'));
  const av = /** @type {FaceItem[]} */ ([
    { t: 'body', x: 10, y: 10, w: 1180, h: 310, r: 8 },
    { t: 'text', x: 24, y: 34, s: 'ATEM TELEVISION STUDIO HD8 ISO · PUPITRE', size: 13 },
    { t: 'lcd', id: 'lcd', x: 30, y: 50, w: 300, h: 110 },
    { t: 'text', x: 30, y: 185, s: 'ÉCRAN : MENUS, MÉDIAS, AUDIO, STREAMING', size: 9, w: 300 },
    { t: 'text', x: 360, y: 64, s: 'PROGRAM', size: 10 }, { t: 'keys', id: 'pgm', x: 360, y: 70, rows: 1, cols: 10, w: 54, h: 34, gap: 6, labels: ['1', '2', '3', '4', '5', '6', '7', '8', 'BLK', 'BARS'] },
    { t: 'text', x: 360, y: 128, s: 'PREVIEW', size: 10 }, { t: 'keys', id: 'pvw', x: 360, y: 134, rows: 1, cols: 10, w: 54, h: 34, gap: 6, labels: ['1', '2', '3', '4', '5', '6', '7', '8', 'BLK', 'BARS'] },
    { t: 'text', x: 360, y: 192, s: 'AUX 1 · AUX 2 · MACROS · KEYERS', size: 10 }, { t: 'keys', id: 'aux', x: 360, y: 198, rows: 1, cols: 10, w: 54, h: 30, gap: 6, labels: ['AUX 1', 'AUX 2', 'MACRO', 'KEY 1', 'KEY 2', 'KEY 3', 'KEY 4', 'DSK 1', 'DSK 2', 'FTB'] },
    { t: 'btn', id: 'cut', x: 980, y: 70, w: 70, h: 40, l: 'CUT' }, { t: 'btn', id: 'auto', x: 980, y: 120, w: 70, h: 40, l: 'AUTO' }, { t: 'btn', id: 'rec', x: 980, y: 170, w: 70, h: 40, l: 'REC' }, { t: 'btn', id: 'stream', x: 980, y: 220, w: 70, h: 40, l: 'ON AIR' },
    { t: 'lever', x: 1090, y: 50, w: 44, h: 230, l: 'T-BAR' },
    { t: 'led', id: 'power', x: 60, y: 260, c: 'green', l: 'POWER' }, { t: 'led', id: 'eth', x: 120, y: 260, c: 'green', l: 'ETHERNET' }, { t: 'led', id: 'disk', x: 190, y: 260, c: 'amber', l: 'DISQUE' },
    fp(ATEM_PORTS, 'headset', 300, 262, 'HEADSET (XLR 5)'),
    { t: 'knob', id: 'vol', x: 400, y: 262, r: 16, l: 'CASQUE' }, { t: 'knob', id: 'mic', x: 470, y: 262, r: 16, l: 'MICRO' },
    { t: 'text', x: 540, y: 262, s: 'Pupitre intégré : les touches des huit entrées sur deux rangées,', size: 10, w: 400 }, { t: 'text', x: 540, y: 278, s: 'les transitions, le T-bar ; le casque du réalisateur se branche ici.', size: 10, w: 400 },
  ]);
  return { avant: { label: 'Pupitre (face avant)', w: 1200, h: 330, items: av }, arriere: { label: 'Face arrière', w: 1200, h: 330, items: ar } };
}

// ============================================================ HyperDeck Studio HD Plus
const HDP_PORTS = /** @type {Port[]} */ ([
  P('sdi-in', 'SDI IN', 'bnc', 'sdi', 'in', 'Vidéo', 'Entrée 6G-SDI : SD, HD jusqu\'à 1080p60, Ultra HD jusqu\'à 2160p30. Ce qui est enregistré quand la source est « SDI ». La boucle SDI LOOP OUT la recopie telle quelle.', { thru: 'sdi-loop' }),
  P('sdi-loop', 'SDI LOOP OUT', 'bnc', 'sdi', 'out', 'Vidéo', 'Boucle active de l\'entrée SDI : le signal reçu continue vers l\'appareil suivant (mélangeur, moniteur) sans être altéré.'),
  P('sdi-out', 'SDI OUT', 'bnc', 'sdi', 'out', 'Vidéo', 'Sortie 6G-SDI : la lecture (ou l\'entrée en transparence, E-E, quand on n\'est pas en lecture). Avec la seconde sortie, lecture fill et key jusqu\'à 1080p60.'),
  P('sdi-mon', 'MON OUT', 'bnc', 'sdi', 'out', 'Vidéo', 'Sortie moniteur 3G-SDI : l\'image avec, incrustés, le timecode, le nom du clip, l\'état de l\'enregistrement et les vumètres.'),
  P('hdmi-in', 'HDMI IN', 'hdmi', 'hdmi', 'in', 'Vidéo', 'Entrée HDMI 2.0 : une caméra ou un ordinateur en HDMI ; enregistrée quand la source est « HDMI ».'),
  P('hdmi-out', 'HDMI OUT', 'hdmi', 'hdmi', 'out', 'Vidéo', 'Sortie HDMI 2.0 : la lecture (ou l\'entrée en transparence) vers un écran.'),
  P('ref-in', 'REF IN', 'bnc', 'ref', 'in', 'Synchro', 'Référence (tri-level ou black burst) : verrouille la lecture sur la synchro de l\'installation, pour un mélangeur sans resynchroniseur.'),
  P('ref-out', 'REF OUT', 'bnc', 'ref', 'out', 'Synchro', 'Recopie de la référence vers l\'appareil suivant.'),
  P('tc-in', 'TC IN', 'bnc', 'tc', 'in', 'Synchro', 'Entrée timecode LTC externe, horodate les fichiers.'),
  P('tc-out', 'TC OUT', 'bnc', 'tc', 'out', 'Synchro', 'Sortie timecode LTC du clip en cours.'),
  P('rs422-in', 'REMOTE IN', 'dsub9', 'rs422', 'in', 'Commande', 'Commande de machine RS-422 (protocole Sony 9 broches, D-sub 9 femelle) depuis un mélangeur ou un contrôleur ; active si « Remote » est sur ON.'),
  P('rs422-out', 'REMOTE OUT', 'dsub9', 'rs422', 'out', 'Commande', 'Recopie de la commande RS-422 vers un second HyperDeck, pour qu\'ils tournent ensemble.'),
  P('lan', 'ETHERNET', 'rj45', 'ip', 'io', 'Réseau', 'Gigabit Ethernet : pilotage par le protocole HyperDeck Ethernet (TCP 9993, depuis l\'ATEM), accès aux fichiers par le réseau, réglages depuis un navigateur, mises à jour.', { nic: true }),
  P('usbc', 'USB-C', 'usbc', 'usb', 'io', 'Média et USB', 'USB-C 3.0 : un disque externe comme support d\'enregistrement, ou la sortie « webcam » vers un ordinateur, ou HyperDeck Setup.'),
  P('sd1', 'SD 1', 'sd', 'media', 'in', 'Média et USB', 'Lecteur de carte SD UHS-II n° 1 (face avant) : le premier support d\'enregistrement.'),
  P('sd2', 'SD 2', 'sd', 'media', 'in', 'Média et USB', 'Lecteur de carte SD UHS-II n° 2 (face avant) : quand la première carte est pleine, l\'enregistrement continue sur la seconde.'),
  P('phones', 'PHONES', 'jack63', 'audio', 'out', 'Audio', 'Écoute au casque (jack 6,35 mm, face avant) de l\'audio embarqué.'),
  P('iec', 'AC IN', 'iec', 'secteur', 'in', 'Alimentation', 'Alimentation secteur interne 100-240 V (IEC C14).', { watts: 45 }),
  P('dc', '12V DC IN', 'xlr4', 'dc12', 'in', 'Alimentation', 'Alimentation 12 V (XLR 4 broches) : secours ou batterie.'),
]);
function hdPlusFaces() {
  const ar = /** @type {FaceItem[]} */ ([
    { t: 'body', x: 10, y: 10, w: 740, h: 210, r: 6 },
    { t: 'text', x: 24, y: 34, s: 'HYPERDECK STUDIO HD PLUS · FACE ARRIÈRE (½ rack, 1 U)', size: 13 },
    { t: 'group', x: 30, y: 50, w: 330, h: 150, l: 'Vidéo' }, { t: 'group', x: 370, y: 50, w: 240, h: 150, l: 'Synchro, timecode, commande' }, { t: 'group', x: 620, y: 50, w: 120, h: 150, l: 'Réseau, USB, alim.' },
    fp(HDP_PORTS, 'sdi-in', 70, 95), fp(HDP_PORTS, 'sdi-loop', 150, 95, 'LOOP OUT'), fp(HDP_PORTS, 'sdi-out', 230, 95), fp(HDP_PORTS, 'sdi-mon', 310, 95),
    fp(HDP_PORTS, 'hdmi-in', 100, 158), fp(HDP_PORTS, 'hdmi-out', 230, 158),
    fp(HDP_PORTS, 'ref-in', 405, 95), fp(HDP_PORTS, 'ref-out', 465, 95), fp(HDP_PORTS, 'tc-in', 525, 95), fp(HDP_PORTS, 'tc-out', 585, 95),
    fp(HDP_PORTS, 'rs422-in', 430, 158), fp(HDP_PORTS, 'rs422-out', 540, 158),
    fp(HDP_PORTS, 'lan', 655, 95), fp(HDP_PORTS, 'usbc', 715, 95), fp(HDP_PORTS, 'iec', 655, 158, 'AC IN'), fp(HDP_PORTS, 'dc', 718, 158, '12V DC'),
  ]);
  const av = /** @type {FaceItem[]} */ ([
    { t: 'body', x: 10, y: 10, w: 740, h: 130, r: 6 },
    { t: 'text', x: 24, y: 34, s: 'HYPERDECK STUDIO HD PLUS', size: 13 },
    { t: 'lcd', id: 'lcd', x: 30, y: 48, w: 170, h: 66 },
    fp(HDP_PORTS, 'sd1', 250, 70, 'SD 1'), fp(HDP_PORTS, 'sd2', 310, 70, 'SD 2'), fp(HDP_PORTS, 'phones', 365, 70, 'PHONES'),
    { t: 'btn', id: 'rec', x: 400, y: 56, w: 50, h: 30, l: 'REC', litColor: '#ff3b30' }, { t: 'btn', id: 'play', x: 456, y: 56, w: 50, h: 30, l: 'PLAY' }, { t: 'btn', id: 'stop', x: 512, y: 56, w: 50, h: 30, l: 'STOP' },
    { t: 'btn', id: 'rew', x: 400, y: 92, w: 50, h: 30, l: '◀◀' }, { t: 'btn', id: 'ff', x: 456, y: 92, w: 50, h: 30, l: '▶▶' }, { t: 'btn', id: 'rem', x: 512, y: 92, w: 50, h: 30, l: 'REM' },
    { t: 'btn', id: 'menu', x: 580, y: 56, w: 50, h: 30, l: 'MENU' }, { t: 'btn', id: 'input', x: 580, y: 92, w: 50, h: 30, l: 'INPUT' },
    { t: 'jog', x: 695, y: 78, r: 34 },
  ]);
  return { avant: { label: 'Face avant', w: 760, h: 150, items: av }, arriere: { label: 'Face arrière', w: 760, h: 230, items: ar } };
}

// ============================================================ HyperDeck Studio HD Mini
const HDM_PORTS = /** @type {Port[]} */ ([
  P('sdi-in', 'SDI IN', 'bnc', 'sdi', 'in', 'Vidéo', `Entrée ${SDI3G} C'est la seule entrée vidéo du HD Mini : pas d'entrée HDMI.`, { thru: 'sdi-out' }),
  P('sdi-out', 'SDI OUT', 'bnc', 'sdi', 'out', 'Vidéo', 'Sortie 3G-SDI : la lecture, ou l\'entrée en transparence (E-E) hors lecture : elle sert alors de boucle vers le mélangeur.'),
  P('hdmi-out', 'HDMI OUT', 'hdmi', 'hdmi', 'out', 'Vidéo', 'Sortie HDMI (type A) : la lecture ou l\'entrée en transparence, vers un écran.'),
  P('ref-in', 'REF IN', 'bnc', 'ref', 'in', 'Synchro', 'Référence (tri-level ou black burst) pour verrouiller la lecture.'),
  P('ref-out', 'REF OUT', 'bnc', 'ref', 'out', 'Synchro', 'Recopie de la référence.'),
  P('tc-in', 'TC IN', 'bnc', 'tc', 'in', 'Synchro', 'Entrée timecode LTC externe.'),
  P('tc-out', 'TC OUT', 'bnc', 'tc', 'out', 'Synchro', 'Sortie timecode LTC.'),
  P('rs422', 'REMOTE', 'dsub9', 'rs422', 'in', 'Commande', 'Commande de machine RS-422 (D-sub 9 femelle), active si « Remote » est sur ON.'),
  P('lan', 'ETHERNET', 'rj45', 'ip', 'io', 'Réseau', 'Gigabit Ethernet : protocole HyperDeck Ethernet (TCP 9993), accès aux fichiers, réglages par navigateur, mises à jour.', { nic: true }),
  P('usbc', 'USB-C', 'usbc', 'usb', 'io', 'Média et USB', 'USB-C 3.0 : disque externe d\'enregistrement, sortie webcam, HyperDeck Setup.'),
  P('sd1', 'SD 1', 'sd', 'media', 'in', 'Média et USB', 'Lecteur de carte SD UHS-II n° 1 (face avant).'),
  P('sd2', 'SD 2', 'sd', 'media', 'in', 'Média et USB', 'Lecteur de carte SD UHS-II n° 2 (face avant) : prend le relais de la première.'),
  P('phones', 'PHONES', 'jack63', 'audio', 'out', 'Audio', 'Écoute au casque (face avant).'),
  P('iec', 'AC IN', 'iec', 'secteur', 'in', 'Alimentation', 'Alimentation secteur interne 100-240 V (IEC C14) : 50 W au plus.', { watts: 30 }),
  P('dc', '12V DC IN', 'dc', 'dc12', 'in', 'Alimentation', 'Alimentation 12 V (jack verrouillable 5,5 mm) : secours ou batterie.'),
]);
function hdMiniFaces() {
  const ar = /** @type {FaceItem[]} */ ([
    { t: 'body', x: 10, y: 10, w: 540, h: 210, r: 6 },
    { t: 'text', x: 24, y: 34, s: 'HYPERDECK STUDIO HD MINI · FACE ARRIÈRE (⅓ rack, 1 U)', size: 13 },
    { t: 'group', x: 30, y: 50, w: 500, h: 150, l: 'Vidéo, synchro, commande, réseau, alimentation' },
    fp(HDM_PORTS, 'sdi-in', 60, 95), fp(HDM_PORTS, 'sdi-out', 125, 95), fp(HDM_PORTS, 'hdmi-out', 195, 95), fp(HDM_PORTS, 'ref-in', 260, 95), fp(HDM_PORTS, 'ref-out', 320, 95), fp(HDM_PORTS, 'tc-in', 380, 95), fp(HDM_PORTS, 'tc-out', 440, 95),
    fp(HDM_PORTS, 'rs422', 75, 158, 'REMOTE (RS-422)'), fp(HDM_PORTS, 'lan', 170, 158), fp(HDM_PORTS, 'usbc', 240, 158), fp(HDM_PORTS, 'iec', 320, 158, 'AC IN'), fp(HDM_PORTS, 'dc', 400, 158, '12V DC'),
  ]);
  const av = /** @type {FaceItem[]} */ ([
    { t: 'body', x: 10, y: 10, w: 540, h: 130, r: 6 },
    { t: 'text', x: 24, y: 34, s: 'HYPERDECK STUDIO HD MINI', size: 13 },
    { t: 'lcd', id: 'lcd', x: 30, y: 48, w: 130, h: 66 },
    fp(HDM_PORTS, 'sd1', 200, 70, 'SD 1'), fp(HDM_PORTS, 'sd2', 250, 70, 'SD 2'), fp(HDM_PORTS, 'phones', 300, 70, 'PHONES'),
    { t: 'btn', id: 'rec', x: 330, y: 56, w: 44, h: 28, l: 'REC', litColor: '#ff3b30' }, { t: 'btn', id: 'play', x: 378, y: 56, w: 44, h: 28, l: 'PLAY' }, { t: 'btn', id: 'stop', x: 426, y: 56, w: 44, h: 28, l: 'STOP' },
    { t: 'btn', id: 'menu', x: 330, y: 90, w: 44, h: 28, l: 'MENU' }, { t: 'btn', id: 'rem', x: 378, y: 90, w: 44, h: 28, l: 'REM' }, { t: 'btn', id: 'skip', x: 426, y: 90, w: 44, h: 28, l: '▶▶' },
    { t: 'jog', x: 510, y: 78, r: 28 },
  ]);
  return { avant: { label: 'Face avant', w: 560, h: 150, items: av }, arriere: { label: 'Face arrière', w: 560, h: 230, items: ar } };
}

// ============================================================ Teranex Mini (SDI to Audio 12G, Audio to SDI 12G)
const TERANEX_COMMUN = /** @type {Port[]} */ ([
  P('lan', 'ETHERNET PoE+', 'rj45', 'ip', 'io', 'Réseau et USB', 'Ethernet 1 Gb/s : réglages à distance par Blackmagic Converters Setup, et alimentation PoE+ (802.3at) par un switch qui la fournit, à la place du secteur.', { nic: true, poe: true, watts: 16 }),
  P('usb', 'USB', 'usbc', 'usb', 'io', 'Réseau et USB', 'USB vers un ordinateur : Blackmagic Converters Setup (réglages, mises à jour) ; ce que fait aussi l\'Ethernet.'),
  P('iec', 'AC IN', 'iec', 'secteur', 'in', 'Alimentation', 'Alimentation secteur interne 90-240 V (IEC C14), 16 W : inutile si le switch fournit le PoE+.', { watts: 16 }),
]);
const TSA_PORTS = /** @type {Port[]} */ ([
  P('sdi-in', 'SDI IN', 'bnc', 'sdi', 'in', 'Vidéo', 'Entrée 12G-SDI (SD, HD, Ultra HD, détection automatique) : le programme dont on extrait l\'audio embarqué.', { thru: 'sdi-loop' }),
  P('sdi-loop', 'SDI LOOP OUT', 'bnc', 'sdi', 'out', 'Vidéo', 'Boucle active : le signal SDI reçu continue, inchangé, vers l\'enregistreur ou le moniteur.'),
  P('xlr-out-1', 'L (1)', 'xlr3', 'audio', 'out', 'Audio', 'Sortie XLR gauche : la première voie de la paire choisie, en analogique symétrique ; en mode AES/EBU, les voies 1-2 numériques.'),
  P('xlr-out-2', 'R (2)', 'xlr3', 'audio', 'out', 'Audio', 'Sortie XLR droite : la seconde voie de la paire, en analogique ; en mode AES/EBU, les voies 3-4.'),
  P('rca-out-l', 'RCA L', 'rca', 'audio', 'out', 'Audio', 'Sortie ligne asymétrique (HiFi), voie gauche.'),
  P('rca-out-r', 'RCA R', 'rca', 'audio', 'out', 'Audio', 'Sortie ligne asymétrique, voie droite.'),
  P('optical-out', 'OPTICAL OUT', 'toslink', 'aes', 'out', 'Audio', 'Sortie optique S/PDIF (TOSLINK) de la paire choisie.'),
  ...TERANEX_COMMUN,
]);
const TAS_PORTS = /** @type {Port[]} */ ([
  P('sdi-in', 'SDI IN', 'bnc', 'sdi', 'in', 'Vidéo', 'Entrée 12G-SDI : le programme dans lequel on embarque le son. La vidéo ressort inchangée sur SDI OUT, avec la paire choisie remplacée par l\'entrée audio.', { thru: 'sdi-out' }),
  P('sdi-out', 'SDI OUT', 'bnc', 'sdi', 'out', 'Vidéo', 'Sortie 12G-SDI : la vidéo d\'entrée avec le son embarqué sur la paire choisie (les autres voies sont conservées).'),
  P('xlr-in-1', 'L (1)', 'xlr3', 'audio', 'in', 'Audio', 'Entrée XLR gauche : micro ou ligne symétrique, première voie de la paire ; en mode AES/EBU, les voies 1-2 numériques.'),
  P('xlr-in-2', 'R (2)', 'xlr3', 'audio', 'in', 'Audio', 'Entrée XLR droite : seconde voie de la paire ; en mode AES/EBU, les voies 3-4 ; peut aussi recevoir un timecode LTC.'),
  P('rca-in-l', 'RCA L', 'rca', 'audio', 'in', 'Audio', 'Entrée ligne asymétrique (HiFi), voie gauche.'),
  P('rca-in-r', 'RCA R', 'rca', 'audio', 'in', 'Audio', 'Entrée ligne asymétrique, voie droite.'),
  P('optical-in', 'OPTICAL IN', 'toslink', 'aes', 'in', 'Audio', 'Entrée optique S/PDIF (TOSLINK).'),
  ...TERANEX_COMMUN,
]);
function teranexFaces(/** @type {Port[]} */ ports, /** @type {string} */ titre, /** @type {string} */ sdi2, /** @type {string} */ opt) {
  const x = (id) => ports.find((p) => p.id === id) ? id : '';
  const ar = /** @type {FaceItem[]} */ ([
    { t: 'body', x: 10, y: 10, w: 540, h: 210, r: 6 },
    { t: 'text', x: 24, y: 34, s: `${titre} · FACE ARRIÈRE (⅓ rack, 1 U)`, size: 13 },
    { t: 'group', x: 30, y: 50, w: 140, h: 82, l: 'Vidéo 12G-SDI' }, { t: 'group', x: 180, y: 50, w: 250, h: 82, l: 'Audio (XLR : analogique ou AES)' }, { t: 'group', x: 440, y: 50, w: 90, h: 82, l: 'Réseau, USB' },
    fp(ports, 'sdi-in', 65, 95), fp(ports, sdi2, 135, 95, sdi2 === 'sdi-loop' ? 'LOOP OUT' : 'SDI OUT'),
    fp(ports, x('xlr-out-1') || 'xlr-in-1', 210, 95, 'L (1)'), fp(ports, x('xlr-out-2') || 'xlr-in-2', 265, 95, 'R (2)'),
    fp(ports, x('rca-out-l') || 'rca-in-l', 318, 95), fp(ports, x('rca-out-r') || 'rca-in-r', 358, 95), fp(ports, opt, 412, 95, 'OPTICAL'),
    fp(ports, 'lan', 465, 95, 'ETH'), fp(ports, 'usb', 515, 95, 'USB'),
    { t: 'group', x: 30, y: 142, w: 500, h: 70, l: 'Alimentation' },
    fp(ports, 'iec', 75, 185, 'AC IN 90-240 V'),
    { t: 'text', x: 150, y: 180, s: 'Secteur 90-240 V, ou PoE+ (802.3at) par le port Ethernet : 16 W.', size: 10, w: 400 },
  ]);
  const av = /** @type {FaceItem[]} */ ([
    { t: 'body', x: 10, y: 10, w: 540, h: 100, r: 6 },
    { t: 'text', x: 24, y: 34, s: titre, size: 13 },
    { t: 'led', id: 'power', x: 50, y: 68, c: 'green', l: 'POWER' }, { t: 'led', id: 'sdi', x: 110, y: 68, c: 'cyan', l: 'SDI' },
    { t: 'sw', id: 'dip', x: 180, y: 66, l: 'MICRO-INTER.' },
    { t: 'text', x: 250, y: 58, s: 'Micro-interrupteurs : réglages de base.', size: 10, w: 280 }, { t: 'text', x: 250, y: 74, s: 'Le reste : Converters Setup (USB, Ethernet)', size: 10, w: 280 }, { t: 'text', x: 250, y: 90, s: 'ou le Smart Panel (en option).', size: 10, w: 280 },
  ]);
  return { avant: { label: 'Face avant', w: 560, h: 120, items: av }, arriere: { label: 'Face arrière', w: 560, h: 230, items: ar } };
}

// ============================================================ GPI and Tally Interface
const GPI_PORTS = /** @type {Port[]} */ ([
  P('lan-1', 'ETHERNET', 'rj45', 'ip', 'io', 'Réseau', 'Ethernet 10/100BASE-T vers le réseau de l\'ATEM : le boîtier se connecte au mélangeur (TCP 9910) à l\'adresse réglée dans ATEM Setup et reçoit l\'état du tally.', { nic: true }),
  P('lan-2', 'ETHERNET LOOP', 'rj45', 'ip', 'io', 'Réseau', 'Boucle Ethernet : relie un autre appareil du réseau (même interface, le boîtier n\'a qu\'une adresse).', { nic: true }),
  P('usb', 'USB', 'usbc', 'usb', 'io', 'Réseau', 'USB 2.0 vers un ordinateur : ATEM Setup règle l\'adresse IP du boîtier et celle de l\'ATEM visé, et fait les mises à jour.'),
  P('gpio', 'GPI / TALLY', 'dsub25', 'tally', 'io', 'Tally et GPI', 'D-sub 25 broches : 8 sorties tally à relais (contacts secs, 30 V / 1 A au plus) : le relais n se ferme quand l\'entrée n de l\'ATEM est à l\'antenne ; et 8 entrées GPI opto-isolées (5 V / 14 mA, déclenchées par une mise à la masse) qui lancent des macros. Vers le TALLY/GPIO du pupitre AW-RP150 ou des voyants.'),
  P('dc', '12V', 'dc', 'dc12', 'in', 'Alimentation', 'Bloc 12 V fourni (jack) : quelques watts.', { watts: 5 }),
]);
function gpiFaces() {
  const ar = /** @type {FaceItem[]} */ ([
    { t: 'body', x: 10, y: 10, w: 560, h: 150, r: 6 },
    { t: 'text', x: 24, y: 34, s: 'GPI AND TALLY INTERFACE · CONNECTEURS', size: 13 },
    { t: 'group', x: 30, y: 50, w: 200, h: 95, l: 'Réseau et USB' }, { t: 'group', x: 240, y: 50, w: 200, h: 95, l: 'Tally (8 relais), GPI (8)' }, { t: 'group', x: 450, y: 50, w: 110, h: 95, l: 'Alimentation' },
    fp(GPI_PORTS, 'lan-1', 65, 95, 'ETHERNET'), fp(GPI_PORTS, 'lan-2', 130, 95, 'LOOP'), fp(GPI_PORTS, 'usb', 195, 95, 'USB'),
    fp(GPI_PORTS, 'gpio', 340, 95, 'GPI / TALLY (D-sub 25)'), fp(GPI_PORTS, 'dc', 505, 95, '12V'),
  ]);
  const av = /** @type {FaceItem[]} */ ([
    { t: 'body', x: 10, y: 10, w: 560, h: 70, r: 6 },
    { t: 'text', x: 24, y: 34, s: 'BLACKMAGIC GPI AND TALLY INTERFACE', size: 13 },
    { t: 'text', x: 24, y: 58, s: 'Boîtier 90 × 23 × 96 mm, à poser près du pupitre ; les connecteurs sont tous du même côté.', size: 10, w: 500 },
  ]);
  return { avant: { label: 'Boîtier', w: 580, h: 90, items: av }, arriere: { label: 'Connecteurs', w: 580, h: 170, items: ar } };
}

/** la configuration d'usine d'un HyperDeck (les mêmes clés pour les deux modèles) */
const hyperdeckCfg = () => ({ source: 'sdi', codec: 'H.264', qualite: 'High', media: 'sd1', distant: false, enregistre: false, reseau: { ...RESEAU_DHCP } });
const HD_FORMATS_HD = ['1080p50', '1080i50', '720p50', '1080p59', '1080i59', '1080p25', '1080p29'];
const HD_SERVICES = /** @type {import('../types.js').Service[]} */ ([
  { id: 'hyperdeck', role: 'serveur', port: 9993, desc: 'Protocole HyperDeck Ethernet : l\'ATEM (ou un ordinateur) lance et arrête l\'enregistrement, pilote la lecture ; il faut « Remote » sur ON.' },
  { id: 'web', role: 'serveur', port: 80, desc: 'Réglages et gestion des médias depuis un navigateur.' },
]);
const HD_AVERIFIER = ['Codec et qualité d\'usine (H.264 High est une hypothèse raisonnable : la documentation ne les précise pas).', 'État d\'usine de « Remote » (OFF est l\'hypothèse : le bouton REM doit être allumé pour la commande à distance).', 'Consommation typique : la fiche donne un maximum (100 W pour le HD Plus, 50 W pour le HD Mini) ; les valeurs retenues sont des ordres de grandeur en marche.', 'Sérigraphie exacte de la face arrière (REF, TC, REMOTE, MON OUT) : relevée d\'après les fiches, pas d\'après une photo.'];

/** @type {Record<string, Modele>} */
export const BLACKMAGIC = {
  'atem-hd8-iso': {
    id: 'atem-hd8-iso', marque: 'Blackmagic Design', nom: 'ATEM Television Studio HD8 ISO', court: 'ATEM HD8', famille: 'melangeur', pose: 'table',
    role: 'Mélangeur HD à huit entrées SDI avec pupitre intégré, enregistrement du programme et des huit ISO, streaming H.264, mixeur audio Fairlight et switch Ethernet interne.',
    ports: ATEM_PORTS,
    reseau: { dhcp: true, ip: '192.168.10.240', mask: '255.255.255.0', gw: '192.168.10.1' },
    services: [
      { id: 'atem', role: 'serveur', port: 9910, desc: 'Protocole ATEM : ATEM Software Control, les pupitres, le boîtier GPI & Tally s\'y connectent.' },
      { id: 'hyperdeck', role: 'client', port: 9993, desc: 'Pilote jusqu\'à quatre HyperDeck (enregistrement, lecture) aux adresses réglées dans ATEM Software Control.' },
      { id: 'rtmp', role: 'client', desc: 'Streaming H.264 (RTMP) vers YouTube, Twitch, Facebook… par l\'Ethernet et un routeur, ou par le partage de connexion d\'un ordinateur en USB-C.' },
    ],
    watts: 100, prix: 3500,
    formats: ['1080p50', '1080i50', '720p50', '1080p59', '1080i59', '1080p25', '1080p29'],
    cfg: {
      format: '1080p50',
      entrees: Object.fromEntries(N8.map((n) => [n, { nom: `Cam ${n}` }])),
      pgm: 1, pvw: 2, multiview: '10',
      aux: { 1: 'pgm', 2: 'pgm' },
      iso: false,
      stream: { on: false, service: 'YouTube', cle: '' },
      hyperdecks: [{ ip: '' }, { ip: '' }, { ip: '' }, { ip: '' }],
      audio: { ...Object.fromEntries(N8.map((n) => [n, 'on'])), mic1: 'off', mic2: 'off' },
      reseau: { dhcp: true, ip: '192.168.10.240', mask: '255.255.255.0', gw: '192.168.10.1' },
    },
    faces: atemFaces(),
    specs: [
      '8 entrées 3G-SDI avec resynchroniseur ; 12 sorties SDI : 8 retours caméra (programme + tally, talkback, commande des caméras Blackmagic), PGM, AUX 1, AUX 2, multiview ; multiview aussi en HDMI.',
      'Formats : 720p, 1080i et 1080p en 50 et 59,94 Hz (et 23,98 / 24 / 25 / 29,97 / 30 p) ; toutes les entrées au format du mélangeur.',
      'Audio : 2 XLR micro / ligne, RCA stéréo, MADI in (32 voies) et out, casque XLR 5 broches ; mixeur Fairlight avec traitements par voie.',
      'Enregistrement H.264 du programme et des 8 ISO sur disque USB-C (deux ports, relais) ; projet DaVinci Resolve généré ; streaming H.264 RTMP intégré.',
      'Réseau : 4 ports Gigabit en switch interne ; DHCP activé d\'usine ; contrôle TCP 9910 ; HyperDeck pilotés en TCP 9993 ; RS-422 sur RJ12.',
      'Secteur 100-240 V (100 W au plus) et 12 V XLR 4 broches ; pupitre de table (pas de baie), environ 58 × 38 × 16 cm.',
    ],
    doc: 'Blackmagic Design, « ATEM Television Studio HD » (manuel d\'installation et d\'utilisation) et fiche technique ATEM Television Studio HD8 ISO.',
    averifier: [
      'Adresse fixe d\'usine : le mélangeur est en DHCP d\'usine ; 192.168.10.240 est l\'adresse fixe historique des ATEM, proposée ici quand on passe en adresse fixe.',
      'Emplacement du connecteur casque XLR 5 broches (dessiné sur le pupitre) ; certains revendeurs citent aussi une prise RJ45 de talkback tiers : non retenue (sources contradictoires).',
      'Les 12 sorties SDI : 8 retours caméra + PGM + AUX 1 + AUX 2 + multiview, d\'après le total de la fiche et les essais (« huit » ou « neuf » sorties programme selon les sources).',
      'Entrées RCA : la fiche dit « 2 RCA stéréo » : modélisées comme une paire gauche / droite.',
      'Défauts d\'usine du mixeur audio (entrées sur ON), de la mosaïque (10 fenêtres), de l\'ISO (désactivé) et du format vidéo (1080p50 en Europe) : hypothèses raisonnables.',
      'Prix : 3 559 $ au tarif public (sans stockage interne) ; version 2TB plus chère.',
    ],
    boite: { w: 0.584, h: 0.161, d: 0.376, couleur: '#2a2d31' },
  },
  'hyperdeck-hd-plus': {
    id: 'hyperdeck-hd-plus', marque: 'Blackmagic Design', nom: 'HyperDeck Studio HD Plus', court: 'HyperDeck HD+', famille: 'enregistreur', pose: 'rack', u: 1, largeur: 1 / 2,
    role: 'Enregistreur-lecteur demi-rack : SDI 6G et HDMI, deux cartes SD et un disque USB-C, H.264, ProRes ou DNxHD, piloté par Ethernet (TCP 9993) ou RS-422.',
    ports: HDP_PORTS,
    reseau: { ...RESEAU_DHCP },
    services: HD_SERVICES,
    watts: 45, prix: 800,
    formats: [...HD_FORMATS_HD, '2160p25', '2160p29'],
    cfg: hyperdeckCfg(),
    faces: hdPlusFaces(),
    specs: [
      'Entrée 6G-SDI (jusqu\'à 2160p30) avec boucle, entrée HDMI 2.0 ; sorties SDI (lecture, fill et key), moniteur 3G-SDI avec incrustations, HDMI.',
      'Codecs : H.264 (SDI 4:2:2 10 bits, High, Medium, Low), ProRes (HQ, 422, LT, Proxy ; 4444 en lecture), DNxHD 220x / 145 / 45 et DNxHR en Ultra HD.',
      'Supports : 2 cartes SD UHS-II (relais automatique), disque USB-C 3.0 externe ; fichiers aussi accessibles par le réseau.',
      'Commande : RS-422 (D-sub 9, entrée et recopie), Ethernet Gigabit (protocole HyperDeck 9993, utilisé par l\'ATEM), déclenchement par le SDI ou le timecode.',
      'Référence et timecode en entrée et en sortie ; casque en face avant ; secteur 100-240 V (100 W au plus) et 12 V XLR 4 broches ; 1 U, demi-largeur.',
    ],
    doc: 'Blackmagic Design, « HyperDeck Disk Recorders » (manuel d\'installation et d\'utilisation) et fiche technique HyperDeck Studio HD Plus.',
    averifier: [...HD_AVERIFIER, 'Prix : 795 $ au tarif public.'],
    boite: { w: 0.216, h: 0.044, d: 0.2, couleur: '#30353a' },
  },
  'hyperdeck-hd-mini': {
    id: 'hyperdeck-hd-mini', marque: 'Blackmagic Design', nom: 'HyperDeck Studio HD Mini', court: 'HyperDeck Mini', famille: 'enregistreur', pose: 'rack', u: 1, largeur: 1 / 3,
    role: 'Enregistreur-lecteur tiers de rack : une entrée 3G-SDI, sorties SDI et HDMI, deux cartes SD et un disque USB-C, H.264, ProRes ou DNxHD, piloté par Ethernet (TCP 9993).',
    ports: HDM_PORTS,
    reseau: { ...RESEAU_DHCP },
    services: HD_SERVICES,
    watts: 30, prix: 650,
    formats: HD_FORMATS_HD,
    cfg: hyperdeckCfg(),
    faces: hdMiniFaces(),
    specs: [
      'Une entrée 3G-SDI (SD et HD jusqu\'à 1080p60), pas d\'entrée HDMI ; sorties 3G-SDI et HDMI (lecture, ou entrée en transparence).',
      'Codecs : H.264, ProRes (HQ, 422, LT, Proxy), DNxHD ; 2 cartes SD UHS-II et disque USB-C 3.0.',
      'Commande : RS-422 (D-sub 9), Ethernet Gigabit (protocole HyperDeck 9993) ; référence et timecode en entrée et sortie.',
      'Secteur 100-240 V (50 W au plus) et 12 V sur jack verrouillable ; 1 U, tiers de largeur.',
    ],
    doc: 'Blackmagic Design, « HyperDeck Disk Recorders » (manuel d\'installation et d\'utilisation) et fiche technique HyperDeck Studio HD Mini.',
    averifier: [...HD_AVERIFIER, 'Alimentation par PoE+ : annoncée pour l\'ancien HyperDeck Studio Mini, pas confirmée pour le HD Mini : non retenue.', 'Prix : 649 $ au tarif public.'],
    boite: { w: 0.14, h: 0.044, d: 0.2, couleur: '#30353a' },
  },
  'teranex-sdi-audio': {
    id: 'teranex-sdi-audio', marque: 'Blackmagic Design', nom: 'Teranex Mini SDI to Audio 12G', court: 'Teranex SDI→Audio', famille: 'convertisseur', pose: 'rack', u: 1, largeur: 1 / 3,
    role: 'Désembedder : sort une paire de l\'audio embarqué d\'un SDI (12G) sur XLR analogiques ou AES/EBU, RCA et optique ; boucle SDI ; réglé par USB ou Ethernet, alimenté par PoE+ possible.',
    ports: TSA_PORTS,
    reseau: { ...RESEAU_DHCP },
    services: [],
    watts: 16, prix: 600,
    formats: ['1080p50', '1080i50', '720p50', '1080p59', '1080i59', '2160p25', '2160p50'],
    cfg: { paire: 1, entree: 'xlr', niveau: 0, reseau: { ...RESEAU_DHCP } },
    faces: teranexFaces(TSA_PORTS, 'TERANEX MINI SDI TO AUDIO 12G', 'sdi-loop', 'optical-out'),
    specs: [
      'Entrée 12G-SDI à détection automatique (SD, HD, 2K, Ultra HD) et boucle SDI active.',
      'Sorties : 2 voies analogiques symétriques sur XLR (ou 4 voies AES/EBU sur les mêmes XLR), 2 voies ligne asymétriques RCA, optique S/PDIF TOSLINK ; choix de la paire parmi les 16 voies embarquées.',
      'Réglages : micro-interrupteurs, Blackmagic Converters Setup par USB ou Ethernet, Smart Panel en option ; secteur 90-240 V ou PoE+ ; 16 W.',
    ],
    doc: 'Blackmagic Design, « Teranex Mini Converters » (manuel d\'installation et d\'utilisation) et fiche technique Teranex Mini SDI to Audio 12G.',
    averifier: [
      'Connecteur USB : le manuel 2019 cite un mini-B ; les revendeurs récents un USB-C (le vocabulaire commun n\'a que l\'USB-C).',
      'Paire d\'usine (voies 1-2), mode des XLR (analogique) et niveau analogique (0 dB) : hypothèses, la documentation consultée ne donne pas les défauts.',
      'Sens du mode AES : les quatre voies AES sortent sur les deux XLR (1-2 et 3-4).',
      'Prix : 655 $ au tarif public actuel (495 $ à l\'origine).',
    ],
    boite: { w: 0.14, h: 0.044, d: 0.16, couleur: '#3a3f45' },
  },
  'teranex-audio-sdi': {
    id: 'teranex-audio-sdi', marque: 'Blackmagic Design', nom: 'Teranex Mini Audio to SDI 12G', court: 'Teranex Audio→SDI', famille: 'convertisseur', pose: 'rack', u: 1, largeur: 1 / 3,
    role: 'Embedder : embarque un micro ou une ligne (XLR analogique ou AES/EBU, RCA, optique) dans la paire choisie d\'un SDI (12G) qui traverse l\'appareil ; réglé par USB ou Ethernet, PoE+ possible.',
    ports: TAS_PORTS,
    reseau: { ...RESEAU_DHCP },
    services: [],
    watts: 16, prix: 600,
    formats: ['1080p50', '1080i50', '720p50', '1080p59', '1080i59', '2160p25', '2160p50'],
    cfg: { paire: 1, entree: 'xlr', niveau: 0, reseau: { ...RESEAU_DHCP } },
    faces: teranexFaces(TAS_PORTS, 'TERANEX MINI AUDIO TO SDI 12G', 'sdi-out', 'optical-in'),
    specs: [
      'Entrée 12G-SDI et sortie 12G-SDI : la vidéo traverse, la paire choisie est remplacée par l\'entrée audio, les autres voies sont conservées.',
      'Entrées : 2 voies analogiques symétriques sur XLR (ou 4 voies AES/EBU sur les mêmes XLR), 2 voies ligne asymétriques RCA, optique S/PDIF TOSLINK ; le XLR droit peut recevoir un timecode.',
      'Réglages : micro-interrupteurs, Blackmagic Converters Setup par USB ou Ethernet, Smart Panel en option ; secteur 90-240 V ou PoE+ ; 16 W.',
    ],
    doc: 'Blackmagic Design, « Teranex Mini Converters » (manuel d\'installation et d\'utilisation) et fiche technique Teranex Mini Audio to SDI 12G.',
    averifier: [
      'Connecteur USB : le manuel 2019 cite un mini-B ; les revendeurs récents un USB-C (le vocabulaire commun n\'a que l\'USB-C).',
      'Paire d\'usine (voies 1-2), entrée d\'usine (XLR analogique) et niveau (0 dB) : hypothèses, la documentation consultée ne donne pas les défauts.',
      'Prix : 675 $ au tarif public actuel (495 $ à l\'origine).',
    ],
    boite: { w: 0.14, h: 0.044, d: 0.16, couleur: '#3a3f45' },
  },
  'gpi-tally': {
    id: 'gpi-tally', marque: 'Blackmagic Design', nom: 'GPI and Tally Interface', court: 'GPI & Tally', famille: 'convertisseur', pose: 'table',
    role: 'Boîtier qui lit le tally de l\'ATEM par Ethernet et le sort sur 8 relais (D-sub 25), avec 8 entrées GPI ; adresse fixe 192.168.10.2 d\'usine.',
    ports: GPI_PORTS,
    reseau: { dhcp: false, ip: '192.168.10.2', mask: '255.255.255.0', gw: '192.168.10.1' },
    services: [{ id: 'atem', role: 'client', port: 9910, desc: 'Se connecte à l\'ATEM à l\'adresse réglée (ATEM Setup, par USB) et suit son tally programme.' }],
    watts: 5, prix: 500,
    cfg: { atemIp: '', sorties: 'entrees 1-8', reseau: { dhcp: false, ip: '192.168.10.2', mask: '255.255.255.0', gw: '192.168.10.1' } },
    faces: gpiFaces(),
    specs: [
      '8 sorties tally par relais (contacts secs, 30 V / 1 A au plus) et 8 entrées GPI opto-isolées (5 V / 14 mA) sur un D-sub 25 broches.',
      'Ethernet 10/100BASE-T avec boucle ; adresse fixe 192.168.10.2 d\'usine, réglée par ATEM Setup en USB ; l\'ATEM visé est en 192.168.10.240 d\'usine chez Blackmagic.',
      'Tally programme seulement (pas de preview) ; bloc 12 V fourni ; 90 × 23 × 96 mm, 120 g.',
    ],
    doc: 'Blackmagic Design, « ATEM Television Studio HD », chapitre GPI and Tally Interface, et fiche technique GPI and Tally Interface.',
    averifier: [
      'Nombre de prises Ethernet : « 10/100BASE-T avec boucle » laisse entendre deux RJ45 ; retenu, à confirmer sur le boîtier.',
      'Connecteur USB : USB 2.0 (le manuel ne précise pas le type ; mini-B probable ; le vocabulaire commun n\'a que l\'USB-C).',
      'Consommation (5 W) : ordre de grandeur, aucune valeur publiée.',
      'Prix : 545 $ au tarif public.',
    ],
    boite: { w: 0.09, h: 0.023, d: 0.096, couleur: '#1f2327' },
  },
};

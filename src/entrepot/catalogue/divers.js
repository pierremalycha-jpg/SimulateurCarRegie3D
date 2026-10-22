// @ts-check
// ----------------------------------------------------------------------------------
// Catalogue, groupe « divers » : l'énergie (prises murales, bandeau secteur, bloc 12 V), les
// supports (pied de caméra), un moniteur HDMI/SDI, un micro XLR, les supports d'enregistrement
// (disque USB-C, carte SD) : ce qu'il faut pour qu'un montage tienne debout. Les deux premiers
// modèles (la prise murale et le bandeau secteur) sont le gabarit d'un modèle : ports, faces,
// consommation, configuration d'usine. Les suivants sont écrits par le groupe « reseau ».
//
// Conventions : un support d'enregistrement est un appareil sans alimentation qui se « câble » dans
// le logement de l'enregistreur (carte SD : port `sd`, signal media ; disque : port `usbc`, signal
// usb) ; le pied n'a pas de port (la caméra se pose sur le plateau, le pied est dessous).
// ----------------------------------------------------------------------------------
/** @typedef {import('../types.js').Modele} Modele */
/** @typedef {import('../types.js').Port} Port */
/** @typedef {import('../types.js').FaceItem} FaceItem */

/** une rangée de ports sur une face (même utilitaire que equipment/devices.js) */
export function row(/** @type {FaceItem[]} */ items, /** @type {string[]} */ ids, x0, y, dx, kind, /** @type {string[]} */ labels, extra = {}) {
  ids.forEach((id, i) => items.push({ t: 'port', id, k: kind, x: x0 + i * dx, y, l: labels ? labels[i] : id.toUpperCase(), ...extra }));
}

/** @type {Port[]} */
const MUR_PORTS = [1, 2, 3, 4].map((n) => ({ id: 'prise' + n, label: `Prise ${n}`, kind: /** @type {const} */ ('mur'), sig: /** @type {const} */ ('secteur'), dir: /** @type {const} */ ('out'), group: 'Secteur', desc: 'Prise murale 230 V, 16 A : le réseau électrique de l\'entrepôt. Un bandeau secteur ou un bloc d\'alimentation s\'y branche.' }));

/** @type {Record<string, Modele>} */
export const DIVERS = {
  mur: {
    id: 'mur', marque: 'Entrepôt', nom: 'Prises murales 230 V', court: 'Mur', famille: 'alimentation', pose: 'mur',
    role: 'Le tableau électrique de l\'entrepôt : quatre prises 16 A sur un disjoncteur de 16 A (3 680 W au plus pour l\'ensemble).',
    ports: MUR_PORTS, watts: 0, prix: 0,
    cfg: {},
    faces: {
      avant: { label: 'Prises', w: 520, h: 150, items: [
        { t: 'body', x: 10, y: 10, w: 500, h: 130, r: 8 }, { t: 'text', x: 24, y: 36, s: 'TABLEAU · PRISES 16 A · DISJONCTEUR 16 A (3 680 W)', size: 13 },
        ...(() => { /** @type {FaceItem[]} */ const it = []; row(it, MUR_PORTS.map((p) => p.id), 70, 90, 120, 'iec', MUR_PORTS.map((p) => p.label)); return it; })(),
      ] },
    },
    specs: ['Quatre prises sur un même disjoncteur de 16 A : 3 680 W pour l\'ensemble (ordre de grandeur, P = U × I = 230 × 16).'],
    boite: { w: 0.4, h: 0.3, d: 0.05, couleur: '#dfe3e6' },
  },
  bandeau: {
    id: 'bandeau', marque: 'Générique', nom: 'Bandeau secteur 19" 8 prises', court: 'Bandeau 230 V', famille: 'alimentation', pose: 'rack', u: 1, largeur: 1,
    role: 'Un bandeau de huit prises pour la baie : un seul cordon vers le mur, un interrupteur, 10 A au plus (2 300 W).',
    ports: [
      { id: 'in', label: 'ENTRÉE 230 V', kind: 'iec', sig: 'secteur', dir: 'in', group: 'Secteur', desc: 'Le cordon vers la prise murale (10 A).' },
      ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => /** @type {Port} */ ({ id: 'out' + n, label: `PRISE ${n}`, kind: 'iec', sig: 'secteur', dir: 'out', group: 'Prises', desc: 'Une prise 230 V pour un appareil de la baie (cordon IEC C13).' })),
    ],
    watts: 0, prix: 60,
    cfg: { interrupteur: true },
    faces: {
      arriere: { label: 'Face arrière', w: 760, h: 150, items: [
        { t: 'body', x: 10, y: 10, w: 740, h: 130, r: 6 }, { t: 'text', x: 24, y: 36, s: 'BANDEAU SECTEUR 19" · 8 × IEC C13 · 10 A', size: 13 },
        { t: 'port', id: 'in', k: 'iec', x: 60, y: 90, l: 'ENTRÉE' },
        ...(() => { /** @type {FaceItem[]} */ const it = []; row(it, [1, 2, 3, 4, 5, 6, 7, 8].map((n) => 'out' + n), 150, 90, 78, 'iec', [1, 2, 3, 4, 5, 6, 7, 8].map((n) => 'PRISE ' + n)); return it; })(),
      ] },
      avant: { label: 'Face avant', w: 760, h: 110, items: [
        { t: 'body', x: 10, y: 10, w: 740, h: 90, r: 6 }, { t: 'text', x: 24, y: 36, s: 'BANDEAU SECTEUR 19"', size: 13 },
        { t: 'sw', id: 'interrupteur', x: 700, y: 60, l: 'MARCHE' }, { t: 'led', id: 'led', x: 650, y: 55, l: '230 V' },
      ] },
    },
    specs: ['Huit prises IEC C13, un interrupteur lumineux, 10 A (2 300 W) : au-delà, le fusible du bandeau saute.'],
    boite: { w: 0.483, h: 0.044, d: 0.1, couleur: '#2b2f33' },
  },
  'bloc-12v': {
    id: 'bloc-12v', marque: 'Générique', nom: 'Bloc d\'alimentation 12 V · 5 A', court: 'Bloc 12 V', famille: 'alimentation', pose: 'table',
    role: 'Un bloc secteur 12 V (60 W au plus) pour une caméra PTZ ou un pupitre qui n\'est pas alimenté en PoE+ : entrée IEC, sortie jack DC (adaptateur XLR 4 broches pour le RP150).',
    ports: [
      { id: 'iec', label: 'ENTRÉE 100-240 V', kind: 'iec', sig: 'secteur', dir: 'in', group: 'Secteur', desc: 'Cordon secteur IEC C13 vers le mur ou le bandeau.' },
      { id: 'dc', label: 'SORTIE 12 V DC', kind: 'dc', sig: 'dc12', dir: 'out', group: '12 V', desc: 'Jack DC 12 V, 5 A au plus (60 W) : le DC IN 12 V d\'une caméra AW-HE130 ou AW-HE20, ou le 12 V XLR 4 broches du RP150 par un adaptateur.' },
    ],
    watts: 0, prix: 40,
    cfg: {},
    faces: {
      avant: { label: 'Le bloc', w: 360, h: 120, items: [
        { t: 'body', x: 10, y: 10, w: 340, h: 100, r: 8 }, { t: 'text', x: 24, y: 34, s: 'BLOC SECTEUR 12 V · 5 A · 60 W', size: 12 },
        { t: 'port', id: 'iec', k: 'iec', x: 70, y: 72, l: 'IEC IN' }, { t: 'led', id: 'led', x: 180, y: 68, c: 'green', l: '12 V' }, { t: 'port', id: 'dc', k: 'jack', x: 290, y: 72, l: 'DC 12 V OUT' },
      ] },
    },
    specs: ['12 V continu, 5 A au plus (60 W) : une caméra PTZ consomme 20 à 30 W, un pupitre RP150 une dizaine de watts.', 'Le bloc ne consomme rien pour lui-même dans le budget secteur : ce qu\'il débite en 12 V est ce que l\'appareil demande (ordre de grandeur, rendement non compté).'],
    doc: 'Appareil générique (bloc secteur 12 V de bureau, type GST60A12) : pas de document constructeur.',
    averifier: ['Le connecteur de sortie (jack 5,5 / 2,5 mm) et la polarité dépendent de l\'appareil alimenté : vérifier la fiche de la caméra avant de brancher.'],
    boite: { w: 0.13, h: 0.035, d: 0.06, couleur: '#111417' },
  },
  'pied-camera': {
    id: 'pied-camera', marque: 'Générique', nom: 'Pied de caméra (colonne et plateau)', court: 'Pied', famille: 'accessoire', pose: 'plateau',
    role: 'Un pied (trépied à colonne, ou pied de table) pour une caméra PTZ : il tient la caméra à hauteur, sans aucun câble.',
    ports: [], watts: 0, prix: 250,
    cfg: {},
    faces: {
      avant: { label: 'Le pied', w: 300, h: 120, items: [
        { t: 'body', x: 10, y: 10, w: 280, h: 100, r: 8 }, { t: 'text', x: 24, y: 34, s: 'PIED DE CAMÉRA', size: 13 }, { t: 'text', x: 24, y: 60, s: 'Plateau 1/4" et 3/8", colonne 0,9 à 1,6 m, charge 8 kg', size: 10, w: 400 },
        { t: 'text', x: 24, y: 84, s: 'Aucun connecteur : la caméra se pose dessus.', size: 10, w: 400 },
      ] },
    },
    specs: ['Plateau avec vis 1/4" et 3/8" (les deux pas de vis des caméras PTZ), colonne réglable de 0,9 à 1,6 m, charge 8 kg (une AW-HE130 pèse 3 kg).', 'Un pied par caméra sur le plateau ; prix : 150 à 400 € HT selon le modèle.'],
    doc: 'Appareil générique : pas de document constructeur.',
    averifier: ['Le pied occupe un emplacement du plateau, comme la caméra : quatre emplacements pour trois pieds et trois caméras, c\'est court (voir le rapport).'],
    boite: { w: 0.12, h: 0.1, d: 0.12, couleur: '#2b2f33' },
  },
  'moniteur-hdmi': {
    id: 'moniteur-hdmi', marque: 'Générique', nom: 'Moniteur 21,5" HDMI / SDI', court: 'Moniteur', famille: 'moniteur', pose: 'table',
    role: 'Un moniteur de régie à deux entrées : HDMI (multiview de l\'ATEM, écran du PC) ou SDI (programme, sortie d\'un HyperDeck). Il montre ce qu\'il reçoit, sans rien régler.',
    ports: [
      { id: 'hdmi-in', label: 'HDMI IN', kind: 'hdmi', sig: 'hdmi', dir: 'in', group: 'Vidéo', desc: 'Entrée HDMI : la sortie HDMI d\'un mélangeur (multiview, programme) ou la carte graphique du PC.' },
      { id: 'sdi-in', label: 'SDI IN', kind: 'bnc', sig: 'sdi', dir: 'in', group: 'Vidéo', desc: 'Entrée 3G-SDI : programme ou aux d\'un mélangeur, sortie d\'un HyperDeck, sortie d\'une caméra.' },
      { id: 'iec', label: 'AC IN', kind: 'iec', sig: 'secteur', dir: 'in', group: 'Alimentation', watts: 25, desc: 'Secteur IEC C14, 25 W (ordre de grandeur pour un écran de 21,5").' },
    ],
    watts: 25, prix: 450,
    cfg: {},
    faces: {
      arriere: { label: 'Face arrière (connecteurs)', w: 520, h: 150, items: [
        { t: 'body', x: 10, y: 10, w: 500, h: 130, r: 6 }, { t: 'text', x: 24, y: 34, s: 'MONITEUR 21,5" · 1920 × 1080 · HDMI · 3G-SDI', size: 12 },
        { t: 'group', x: 20, y: 50, w: 250, h: 85, l: 'Vidéo' }, { t: 'port', id: 'hdmi-in', k: 'usb', x: 80, y: 92, l: 'HDMI IN' }, { t: 'port', id: 'sdi-in', k: 'bnc', x: 190, y: 92, l: 'SDI IN' },
        { t: 'group', x: 390, y: 50, w: 110, h: 85, l: 'Alimentation' }, { t: 'port', id: 'iec', k: 'iec', x: 445, y: 92, l: 'AC IN' },
      ] },
      avant: { label: 'Face avant (écran)', w: 520, h: 320, items: [
        { t: 'body', x: 10, y: 10, w: 500, h: 300, r: 6 }, { t: 'lcd', id: 'ecran', x: 30, y: 30, w: 460, h: 240 },
        { t: 'btn', id: 'input', x: 30, y: 282, w: 70, h: 20, l: 'INPUT' }, { t: 'btn', id: 'menu', x: 110, y: 282, w: 60, h: 20, l: 'MENU' }, { t: 'led', id: 'led', x: 480, y: 292, c: 'green', l: '' },
      ] },
    },
    specs: ['Dalle 21,5" 1920 × 1080, entrées HDMI et 3G-SDI (1080p50, 1080i50, 720p50 et 59,94 Hz), choix de l\'entrée par la touche INPUT.', 'Il « voit » ce qui arrive : le moteur affiche sur lui le flux reçu (source, format). Prix : 300 à 600 € HT.'],
    doc: 'Appareil générique (moniteur de production 21,5" HDMI/SDI) : pas de document constructeur.',
    averifier: ['Pas de sortie SDI en boucle ni d\'entrée audio modélisées : le brief demande HDMI in + SDI in.'],
    boite: { w: 0.5, h: 0.32, d: 0.05, couleur: '#101214' },
  },
  'micro-xlr': {
    id: 'micro-xlr', marque: 'Générique', nom: 'Micro dynamique XLR', court: 'Micro', famille: 'son', pose: 'table',
    role: 'Le micro de la salle (dynamique, cardioïde, sans alimentation) : sa sortie XLR part vers l\'entrée XLR d\'un Teranex Audio to SDI, d\'un mélangeur ou d\'une caméra.',
    ports: [{ id: 'out', label: 'XLR OUT', kind: 'xlr3', sig: 'audio', dir: 'out', group: 'Audio', desc: 'Sortie micro symétrique, XLR 3 broches mâle : niveau micro (environ −55 dBu), pas d\'alimentation fantôme nécessaire.' }],
    watts: 0, prix: 120,
    cfg: {},
    faces: {
      avant: { label: 'Le micro', w: 360, h: 110, items: [
        { t: 'body', x: 10, y: 10, w: 340, h: 90, r: 20 }, { t: 'text', x: 24, y: 34, s: 'MICRO DYNAMIQUE CARDIOÏDE', size: 12 }, { t: 'text', x: 24, y: 52, s: 'sans alimentation · niveau micro', size: 10, w: 400 },
        { t: 'port', id: 'out', k: 'xlr', x: 300, y: 62, l: 'XLR OUT' },
      ] },
    },
    specs: ['Dynamique cardioïde (type micro de chant ou de conférence), 50 Hz à 15 kHz, sensibilité d\'environ 1,8 mV/Pa : il demande le gain d\'un préampli micro, pas d\'alimentation fantôme.', 'Prix : 100 à 150 € HT.'],
    doc: 'Appareil générique (micro dynamique cardioïde à sortie XLR) : pas de document constructeur.',
    averifier: ['Le niveau de sortie et la bande passante sont ceux d\'un micro dynamique courant : ordres de grandeur.'],
    boite: { w: 0.05, h: 0.05, d: 0.19, couleur: '#2a2d31' },
  },
  'disque-usbc': {
    id: 'disque-usbc', marque: 'Générique', nom: 'Disque SSD USB-C 1 To', court: 'Disque USB-C', famille: 'accessoire', pose: 'table',
    role: 'Le support d\'enregistrement d\'un ATEM ISO ou d\'un HyperDeck : un SSD USB-C (1 To, 1 000 Mo/s) branché sur le port USB-C de l\'enregistreur, alimenté par ce port.',
    ports: [{ id: 'usbc', label: 'USB-C', kind: 'usbc', sig: 'usb', dir: 'io', group: 'USB', desc: 'USB-C 3.2 Gen 2 (10 Gbit/s) : vers le port USB-C de l\'enregistreur (ATEM, HyperDeck) ou du PC pour relire les fichiers.' }],
    watts: 0, prix: 150,
    cfg: {},
    faces: {
      avant: { label: 'Le disque', w: 300, h: 110, items: [
        { t: 'body', x: 10, y: 10, w: 280, h: 90, r: 10 }, { t: 'text', x: 24, y: 34, s: 'SSD USB-C · 1 To · 1 000 Mo/s', size: 12 }, { t: 'text', x: 24, y: 52, s: 'formaté exFAT pour l\'enregistreur', size: 10, w: 400 },
        { t: 'port', id: 'usbc', k: 'usb', x: 250, y: 62, l: 'USB-C' },
      ] },
    },
    specs: ['1 To : environ 9 heures de 1080p50 en H.264 à 25 Mbit/s, ou 1 h 30 en ProRes 422 (ordres de grandeur).', 'Formaté exFAT (ATEM, HyperDeck et Windows le lisent) ; un seul port, alimenté par l\'enregistreur.'],
    doc: 'Appareil générique (SSD externe USB-C) : pas de document constructeur.',
    averifier: ['L\'enregistreur doit avoir un port USB-C (kind usbc) : le moteur y reconnaît un support quand le disque y est câblé.'],
    boite: { w: 0.08, h: 0.012, d: 0.11, couleur: '#3a3f45' },
  },
  'carte-sd': {
    id: 'carte-sd', marque: 'Générique', nom: 'Carte SD 128 Go UHS-II', court: 'Carte SD', famille: 'accessoire', pose: 'table',
    role: 'La carte d\'un HyperDeck : une SDXC 128 Go UHS-II (V60) glissée dans un logement SD de l\'enregistreur.',
    ports: [{ id: 'sd', label: 'Carte SD', kind: 'sd', sig: 'media', dir: 'io', group: 'Support', desc: 'La carte elle-même : elle se glisse dans un logement SD (kind sd, signal media) d\'un HyperDeck.' }],
    watts: 0, prix: 40,
    cfg: {},
    faces: {
      avant: { label: 'La carte', w: 240, h: 110, items: [
        { t: 'body', x: 10, y: 10, w: 220, h: 90, r: 6 }, { t: 'text', x: 24, y: 34, s: 'SDXC 128 Go · UHS-II · V60', size: 12 },
        { t: 'port', id: 'sd', k: 'multi', x: 190, y: 62, l: 'SD' },
      ] },
    },
    specs: ['SDXC 128 Go, UHS-II, classe vidéo V60 (60 Mo/s garantis) : il en faut pour le ProRes HQ ; une carte lente fait sauter l\'enregistrement.', '128 Go : environ 1 heure de 1080p50 en H.264 à 25 Mbit/s, 15 minutes en ProRes 422 HQ (ordres de grandeur). Prix : 30 à 60 € HT.'],
    doc: 'Appareil générique (carte SDXC UHS-II) : pas de document constructeur ; les cartes recommandées sont listées par Blackmagic dans le manuel HyperDeck.',
    averifier: ['Les durées d\'enregistrement dépendent du codec et de la qualité choisis sur le HyperDeck : ordres de grandeur.'],
    boite: { w: 0.024, h: 0.002, d: 0.032, couleur: '#1a1d20' },
  },
};

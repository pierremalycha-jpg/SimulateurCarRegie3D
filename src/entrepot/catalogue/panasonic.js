// @ts-check
// ----------------------------------------------------------------------------------
// Catalogue, groupe Panasonic : les caméras PTZ AW-HE130 et AW-HE20, le pupitre AW-RP150.
// Sources (extraits de recherche, les PDF constructeur ne sont pas joignables depuis ici) :
//   - AW-HE130 : Operating Instructions VQT5L27A (pro-av.panasonic.net), fiche eu.connect.panasonic.com ;
//   - AW-HE20 : Operating Instructions DVQP2730YA, fiche « download-specifications/6718 », FAQ AW-UE20/HE20 ;
//   - AW-RP150 : Operating Instructions DVQP1819ZA, fiche RP150 (atcomms), FAQ Panasonic Pass ;
//   - adresses d'usine : FAQ AW-Series (Panasonic Pass) : 192.168.0.10 / 255.255.255.0 / 192.168.0.1.
// Ce qui n'a pas pu être confirmé est dit dans `averifier` de chaque modèle.
// Les positions sur les faces sont indicatives ; l'inventaire des connecteurs suit la documentation.
// ----------------------------------------------------------------------------------
import { row } from './divers.js';

/** @typedef {import('../types.js').Modele} Modele */
/** @typedef {import('../types.js').Port} Port */
/** @typedef {import('../types.js').FaceItem} FaceItem */
/** @typedef {import('../types.js').Service} Service */

/** le dessin de la visionneuse (equipment/viewer.js) pour chaque connecteur (même table que CONNECTEURS, sans import circulaire) */
const DESSIN = { bnc: 'bnc', hdmi: 'usb', rj45: 'rj45', minidin8: 'multi', jack35: 'jack', dc: 'jack', usbc: 'usb', xlr4: 'xlr', dsub25: 'dsub25' };
/** un élément « port » d'une face, dessiné d'après le port du modèle */
const pi = (/** @type {Port} */ p, x, y, extra = {}) => /** @type {FaceItem} */ ({ t: 'port', id: p.id, k: DESSIN[p.kind] || 'multi', x, y, l: p.label, ...extra });
const byId = (/** @type {Port[]} */ ports, /** @type {string} */ id) => /** @type {Port} */ (ports.find((p) => p.id === id));

/** interface d'usine commune aux caméras AW (FAQ Panasonic) */
const IFACE_CAM = { dhcp: false, ip: '192.168.0.10', mask: '255.255.255.0', gw: '192.168.0.1' };
/** formats de sortie HD des caméras, en 50 Hz et 59,94 Hz ; le premier est l'usine (modèles E : 1080/50i) */
const FORMATS_CAM = ['1080i50', '1080p50', '720p50', '1080i59', '1080p59'];

// ---------------------------------------------------------------- les ports des caméras
/** les ports communs aux deux caméras (sérigraphie Panasonic) */
function portsCamera(/** @type {{ poeWatts: number, dcWatts: number, genlock: boolean, usb: boolean, sdiLabel: string }} */ o) {
  /** @type {Port[]} */
  const P = [
    { id: 'sdi-out', label: o.sdiLabel, kind: 'bnc', sig: 'sdi', dir: 'out', group: 'Vidéo', desc: 'Sortie vidéo 3G-SDI (SMPTE ST 424 en 1080p50, ST 292 en 1080i / 720p) : vers une entrée du mélangeur. Audio de la prise AUDIO IN embarqué.' },
    { id: 'hdmi-out', label: 'HDMI', kind: 'hdmi', sig: 'hdmi', dir: 'out', group: 'Vidéo', desc: 'Sortie HDMI, simultanée avec le SDI : un moniteur ou l\'entrée HDMI d\'un mélangeur.' },
  ];
  if (o.genlock) P.push({ id: 'gl-in', label: 'G/L IN', kind: 'bnc', sig: 'ref', dir: 'in', group: 'Vidéo', desc: 'Entrée de synchronisation externe (genlock) : black burst ou tri-level. Facultative avec un mélangeur qui synchronise ses entrées.' });
  if (o.usb) P.push({ id: 'usb', label: 'USB', kind: 'usbc', sig: 'usb', dir: 'out', group: 'Vidéo', desc: 'Sortie vidéo USB-C (UVC) : la caméra est vue comme une webcam par un ordinateur.' });
  P.push(
    { id: 'lan', label: 'LAN', kind: 'rj45', sig: 'ip', dir: 'io', group: 'Réseau', poe: true, watts: o.poeWatts, nic: true, desc: `Réseau IP (100BASE-TX) : pilotage par le pupitre ou vMix (HTTP), interface web, tally IP, flux IP. Alimentation PoE+ (IEEE 802.3at) possible par ce port : ≈ ${o.poeWatts} W au plus.` },
    { id: 'rs422', label: 'CONTROL IN (RS-422)', kind: 'rj45', sig: 'rs422', dir: 'in', group: 'Télécommande', desc: 'Entrée de télécommande série RS-422 (RJ45) : un câble droit depuis un port SERIAL CONT du pupitre, une caméra par câble.' },
    { id: 'rs232-in', label: 'RS-232C IN', kind: 'minidin8', sig: 'rs232', dir: 'in', group: 'Télécommande', desc: 'Entrée série RS-232C (mini-DIN 8 broches) : chaînage de plusieurs caméras depuis un pupitre RS-232C.' },
    { id: 'rs232-out', label: 'RS-232C OUT', kind: 'minidin8', sig: 'rs232', dir: 'out', group: 'Télécommande', desc: 'Sortie série RS-232C : recopie les ordres vers la caméra suivante de la chaîne.' },
    { id: 'audio-in', label: 'AUDIO IN', kind: 'jack35', sig: 'audio', dir: 'in', group: 'Audio', desc: 'Entrée audio mini-jack 3,5 mm (micro ou ligne) : embarquée dans le SDI, le HDMI et le flux IP.' },
    { id: 'dc', label: 'DC 12V IN', kind: 'dc', sig: 'dc12', dir: 'in', group: 'Alimentation', watts: o.dcWatts, desc: `Alimentation 12 V continue par le bloc secteur fourni (≈ ${o.dcWatts} W). Si le PoE+ et le bloc sont branchés, le bloc a la priorité.` },
  );
  return P;
}

/** la face arrière d'une caméra PTZ : les connecteurs sous la tête, sur l'embase */
function faceArriereCamera(/** @type {Port[]} */ P, /** @type {string} */ titre) {
  /** @type {FaceItem[]} */
  const it = [
    { t: 'body', x: 10, y: 10, w: 560, h: 220, r: 12 }, { t: 'text', x: 24, y: 36, s: titre, size: 13 },
    { t: 'group', x: 24, y: 50, w: 250, h: 80, l: 'Vidéo' }, { t: 'group', x: 290, y: 50, w: 265, h: 80, l: 'Réseau · alimentation' },
    { t: 'group', x: 24, y: 140, w: 531, h: 80, l: 'Télécommande · audio' },
  ];
  const video = ['sdi-out', 'hdmi-out', 'gl-in', 'usb'].filter((id) => byId(P, id));
  video.forEach((id, i) => it.push(pi(byId(P, id), 60 + i * 70, 95)));
  it.push(pi(byId(P, 'lan'), 340, 95), pi(byId(P, 'dc'), 420, 95), { t: 'led', id: 'led-power', x: 500, y: 90, c: 'green', l: 'POWER' });
  ['rs422', 'rs232-in', 'rs232-out', 'audio-in'].forEach((id, i) => it.push(pi(byId(P, id), 80 + i * 130, 185)));
  return { label: 'Embase (connecteurs)', w: 580, h: 240, items: it };
}
/** la face avant d'une caméra PTZ : l'objectif, le voyant de tally, le récepteur infrarouge */
function faceAvantCamera(/** @type {string} */ titre) {
  /** @type {FaceItem[]} */
  const it = [
    { t: 'body', x: 10, y: 10, w: 360, h: 300, r: 40 }, { t: 'text', x: 24, y: 36, s: titre, size: 13 },
    { t: 'knob', id: 'objectif', x: 190, y: 170, r: 62, l: 'OBJECTIF (zoom motorisé)' },
    { t: 'led', id: 'tally', x: 190, y: 70, c: 'tally', l: 'TALLY' }, { t: 'led', id: 'ir', x: 320, y: 270, c: 'amber', l: 'IR' }, { t: 'led', id: 'status', x: 60, y: 270, c: 'green', l: 'STATUS' },
  ];
  return { label: 'Face avant', w: 380, h: 320, items: it };
}
/** les services d'une caméra AW : serveur HTTP (pilotage CGI, page web), tally IP, NDI|HX si activé */
function servicesCamera(/** @type {boolean} */ rtmp) {
  /** @type {Service[]} */
  const S = [
    { id: 'ptz-http', role: 'serveur', port: 80, desc: 'Pilotage PTZ par commandes HTTP (CGI) : le pupitre AW-RP150, vMix, un navigateur.' },
    { id: 'web', role: 'serveur', port: 80, desc: 'Page web de la caméra (image, Setup → Network…).' },
    { id: 'tally-ip', role: 'serveur', port: 80, desc: 'Tally reçu en IP (commande HTTP du pupitre) : le voyant rouge s\'allume.' },
    { id: 'ndi', role: 'serveur', desc: 'Flux NDI|HX sur le réseau, si la fonction est activée (licence NDI|HX).' },
  ];
  if (rtmp) S.push({ id: 'rtmp', role: 'client', desc: 'Diffusion RTMP/RTMPS vers une plateforme : a besoin d\'Internet par le routeur.' });
  return S;
}
/** la configuration d'usine d'une caméra (les clés du brief) */
const cfgCamera = (/** @type {boolean} */ rtmp) => ({ format: FORMATS_CAM[0], sdiOut: true, hdmiOut: true, ndi: false, ...(rtmp ? { rtmp: false } : {}), tally: 'ip', serie: 'rs422', irId: 1, reseau: { ...IFACE_CAM } });

// ---------------------------------------------------------------- AW-HE130
const HE130_PORTS = portsCamera({ poeWatts: 25, dcWatts: 22, genlock: true, usb: false, sdiLabel: '3G SDI OUT' });
/** @type {Modele} */
const HE130 = {
  id: 'he130', marque: 'Panasonic', nom: 'AW-HE130', court: 'HE130', famille: 'camera', pose: 'plateau',
  role: 'Caméra PTZ Full HD à trois capteurs MOS (zoom 20×) : sorties 3G-SDI et HDMI simultanées, pilotage IP ou série, genlock, alimentation PoE+.',
  ports: HE130_PORTS,
  reseau: { ...IFACE_CAM },
  services: servicesCamera(false),
  watts: 22, prix: 6500, formats: FORMATS_CAM,
  cfg: cfgCamera(false),
  faces: { arriere: faceArriereCamera(HE130_PORTS, 'AW-HE130 · EMBASE · 3G SDI OUT · HDMI · G/L IN · LAN (PoE+) · RS-422 · RS-232C IN/OUT · DC 12V IN'), avant: faceAvantCamera('AW-HE130 · 3MOS Full HD · zoom 20×') },
  specs: [
    'Trois capteurs MOS 1/2,86" Full HD, zoom optique 20×, panoramique ±175°, inclinaison −30° à +210°.',
    'Sorties 3G-SDI (1080/50p) et HDMI simultanées, flux IP H.264 (jusqu\'à 4 canaux) et NDI|HX avec la licence payante (firmware 2.23 ou plus).',
    'Pilotage : IP (HTTP, port 80), RS-422 (RJ45, CONTROL IN), RS-232C IN/OUT (mini-DIN 8, chaînage), télécommande infrarouge (ID 1 à 4).',
    'Genlock : G/L IN (black burst ou tri-level). Audio : AUDIO IN mini-jack 3,5 mm embarqué dans le SDI, le HDMI et l\'IP.',
    'Alimentation : DC 12 V (bloc fourni, 1,8 A ≈ 22 W) ou PoE+ IEEE 802.3at par le port LAN (0,6 A sous 42 à 57 V ≈ 25 W au plus).',
    'Adresse d\'usine : 192.168.0.10 / 255.255.255.0, passerelle 192.168.0.1 (toutes les caméras AW sortent du carton avec la même adresse : on les branche une par une).',
  ],
  doc: 'Panasonic, AW-HE130 Operating Instructions (VQT5L27A) et fiche technique ; FAQ AW-Series (Panasonic Pass) pour l\'adresse d\'usine.',
  averifier: [
    'NDI|HX : la fonction existe sur l\'AW-HE130 (firmware 2.23 et licence NewTek), mais NDI a cessé de vendre ces licences fin 2025 : à vérifier sur l\'exemplaire du BTS (Setup → NDI).',
    'Consommation : 22 W (1,8 A × 12 V) et 25 W en PoE+ sont déduits des courants de la fiche ; la fiche ne donne pas de watts.',
    'Port 80 pour le pilotage HTTP : c\'est le port d\'usine des commandes CGI ; le pupitre peut aussi utiliser le port 49154 (mise à jour, usage non confirmé ici).',
    'Format d\'usine : 1080/50i pour les modèles E (Europe) d\'après l\'usage ; non lu dans la documentation.',
    'Prix : ordre de grandeur (≈ 6 500 € HT ; 6 895 $ US en liste, modèle en fin de vie).',
  ],
  boite: { w: 0.18, h: 0.2, d: 0.18, couleur: '#2a2d31' },
};

// ---------------------------------------------------------------- AW-HE20
const HE20_PORTS = portsCamera({ poeWatts: 17, dcWatts: 16, genlock: false, usb: true, sdiLabel: '3G-SDI OUT' });
/** @type {Modele} */
const HE20 = {
  id: 'he20', marque: 'Panasonic', nom: 'AW-HE20', court: 'HE20', famille: 'camera', pose: 'plateau',
  role: 'Caméra PTZ Full HD d\'entrée de gamme (zoom 12×) : 3G-SDI, HDMI et USB-C (UVC) simultanés, IP, PoE+, RS-422 et RS-232C, diffusion RTMP.',
  ports: HE20_PORTS,
  reseau: { ...IFACE_CAM },
  services: servicesCamera(true),
  watts: 16, prix: 1500, formats: FORMATS_CAM,
  cfg: cfgCamera(true),
  faces: { arriere: faceArriereCamera(HE20_PORTS, 'AW-HE20 · EMBASE · 3G-SDI OUT · HDMI · USB · LAN (PoE+) · RS-422 · RS-232C IN/OUT · DC 12V IN'), avant: faceAvantCamera('AW-HE20 · MOS 1/2,8" Full HD · zoom 12×') },
  specs: [
    'Capteur MOS 1/2,8" Full HD, zoom optique 12×, sorties 3G-SDI, HDMI et USB-C (UVC) simultanées.',
    'Flux IP H.264 / H.265 (RTSP, port 554), diffusion RTMP/RTMPS vers une plateforme ; pas de genlock.',
    'Pilotage : IP (HTTP, port 80), RS-422 (RJ45), RS-232C IN/OUT (mini-DIN 8, jusqu\'à 7 caméras en chaîne), télécommande infrarouge (Wireless ID 1 à 4, usine : 1).',
    'Alimentation : DC 12 V (bloc fourni, 1,3 A ≈ 16 W) ou PoE+ IEEE 802.3at (0,4 A sous 42 à 57 V ≈ 17 W au plus) ; le bloc a la priorité sur le PoE+.',
    'Adresse d\'usine : 192.168.0.10 / 255.255.255.0 ; au premier accès web, la caméra demande de créer un compte.',
  ],
  doc: 'Panasonic, AW-HE20 Operating Instructions (DVQP2730YA) et fiche technique ; FAQ AW-UE20/HE20 (Panasonic Pass).',
  averifier: [
    'NDI|HX : non confirmé pour l\'AW-HE20 (la fiche de l\'AW-UE20 annonce « NDI|HX version 2 upgradable », pas celle du HE20). La clé cfg.ndi existe pour le moteur ; la fonction est à vérifier.',
    'Consommation : 16 W et 17 W déduits des courants de la fiche (1,3 A à 12 V ; 0,4 A en PoE+).',
    'Format d\'usine (1080/50i supposé) et passerelle d\'usine 192.168.0.1 : repris de la FAQ AW-Series, pas lus dans le manuel du HE20.',
    'Prix : ordre de grandeur (995 à 1 495 $ US selon les revendeurs).',
  ],
  boite: { w: 0.16, h: 0.18, d: 0.17, couleur: '#2a2d31' },
};

// ---------------------------------------------------------------- AW-RP150
/** @type {Port[]} */
const RP150_PORTS = [
  ...[1, 2, 3, 4, 5].map((n) => /** @type {Port} */ ({ id: 'serial-' + n, label: `SERIAL CONT ${n}`, kind: 'rj45', sig: 'rs422', dir: 'out', group: 'Télécommande série', desc: `Port série RS-422 n° ${n} (RJ45) : un câble droit vers CONTROL IN (RS-422) d'une caméra, une caméra par port (cinq au plus en série).` })),
  { id: 'lan', label: 'IP CONT', kind: 'rj45', sig: 'ip', dir: 'io', group: 'Réseau', poe: true, watts: 25, nic: true, desc: 'Réseau IP (100BASE-TX) : pilotage de 200 caméras au plus par HTTP, tally IP. Alimentation PoE+ (IEEE 802.3at) possible par ce port.' },
  { id: 'sdi-in', label: '3G SDI ACTIVE IN', kind: 'bnc', sig: 'sdi', dir: 'in', group: 'Vidéo', thru: 'sdi-thru', desc: 'Entrée SDI active (3G/HD) : l\'image d\'une caméra ou le programme, pour les menus incrustés (préréglages, mire). Recopiée sur THRU OUT.' },
  { id: 'sdi-thru', label: 'THRU OUT', kind: 'bnc', sig: 'sdi', dir: 'out', group: 'Vidéo', desc: 'Boucle active de 3G SDI ACTIVE IN : le même signal ressort vers le mélangeur ou un moniteur.' },
  { id: 'gpio1', label: 'TALLY/GPIO 1', kind: 'dsub25', sig: 'tally', dir: 'in', group: 'Tally et GPIO', desc: 'Entrées tally (contacts) venant du mélangeur ou d\'une interface GPI : une entrée par caméra. Avec TALLY IP sur ON, le pupitre renvoie le tally à chaque caméra en IP.' },
  { id: 'gpio2', label: 'GPIO 2', kind: 'dsub25', sig: 'gpio', dir: 'io', group: 'Tally et GPIO', desc: 'Entrées et sorties GPI (contacts) : rappel de préréglages, sélection de caméra, sorties d\'état.' },
  { id: 'dc', label: 'DC 12V IN', kind: 'xlr4', sig: 'dc12', dir: 'in', group: 'Alimentation', watts: 12, desc: 'Alimentation 12 V continue (XLR 4 broches, bloc secteur fourni, 1,0 A ≈ 12 W).' },
];
/** la configuration d'usine du pupitre : dix emplacements de caméra, rien d'affecté */
const cfgRp150 = () => ({
  cameras: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((slot) => ({ slot, mode: 'off', ip: '', port: 80 })),
  tallyIp: true, tallyIn: 'gpio1',
  reseau: { dhcp: false, ip: '192.168.0.9', mask: '255.255.255.0', gw: '192.168.0.1' },
});
/** @type {Modele} */
const RP150 = {
  id: 'rp150', marque: 'Panasonic', nom: 'AW-RP150', court: 'RP150', famille: 'pupitre', pose: 'table',
  role: 'Pupitre de télécommande PTZ à écran tactile 7" et joystick : jusqu\'à 200 caméras en IP et 5 en série RS-422, dix touches de sélection, tally en entrée (GPIO) renvoyé aux caméras en IP, alimentation PoE+.',
  ports: RP150_PORTS,
  reseau: { dhcp: false, ip: '192.168.0.9', mask: '255.255.255.0', gw: '192.168.0.1' },
  services: [
    { id: 'ptz-http', role: 'client', port: 80, desc: 'Pilote chaque caméra déclarée en IP par commandes HTTP (CGI) sur le port réglé (80 d\'usine).' },
    { id: 'tally-ip', role: 'client', port: 80, desc: 'TALLY IP : le tally reçu sur TALLY/GPIO 1 est envoyé à la caméra de l\'emplacement correspondant.' },
  ],
  watts: 12, prix: 4500,
  cfg: cfgRp150(),
  faces: {
    avant: { label: 'Dessus (commandes)', w: 760, h: 400, items: [
      { t: 'body', x: 10, y: 10, w: 740, h: 380, r: 10 }, { t: 'text', x: 24, y: 36, s: 'AW-RP150 · ÉCRAN TACTILE 7" · JOYSTICK · 10 CAMÉRAS', size: 13 },
      { t: 'lcd', id: 'ecran', x: 40, y: 56, w: 330, h: 150 },
      { t: 'keys', id: 'cams', x: 40, y: 225, w: 56, h: 34, gap: 6, rows: 1, cols: 10, labels: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'] },
      { t: 'text', x: 40, y: 285, s: 'CAMERA SELECT', size: 10 },
      { t: 'keys', id: 'presets', x: 40, y: 300, w: 56, h: 34, gap: 6, rows: 1, cols: 10, labels: ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10'] },
      { t: 'text', x: 40, y: 360, s: 'PRESET MEMORY', size: 10 },
      { t: 'joy', id: 'joystick', x: 560, y: 150, r: 70, l: 'PAN / TILT (tourner : ZOOM)' },
      { t: 'knob', id: 'iris', x: 440, y: 300, r: 22, l: 'IRIS' }, { t: 'knob', id: 'focus', x: 520, y: 300, r: 22, l: 'FOCUS' }, { t: 'knob', id: 'zoom', x: 600, y: 300, r: 22, l: 'ZOOM' },
      { t: 'btn', id: 'menu', x: 660, y: 280, w: 70, h: 30, l: 'MENU' }, { t: 'btn', id: 'auto', x: 660, y: 320, w: 70, h: 30, l: 'AUTO' },
      { t: 'led', id: 'power', x: 720, y: 40, c: 'green', l: 'POWER' },
    ] },
    arriere: { label: 'Face arrière (connecteurs)', w: 760, h: 230, items: [
      { t: 'body', x: 10, y: 10, w: 740, h: 210, r: 8 }, { t: 'text', x: 24, y: 36, s: 'AW-RP150 · SERIAL CONT 1-5 · IP CONT (PoE+) · 3G SDI ACTIVE IN / THRU OUT · TALLY/GPIO 1 · GPIO 2 · DC 12V IN', size: 12 },
      { t: 'group', x: 24, y: 50, w: 340, h: 75, l: 'Télécommande série RS-422' },
      ...(() => { /** @type {FaceItem[]} */ const it = []; row(it, [1, 2, 3, 4, 5].map((n) => 'serial-' + n), 60, 92, 65, 'rj45', [1, 2, 3, 4, 5].map((n) => 'SERIAL ' + n)); return it; })(),
      { t: 'group', x: 380, y: 50, w: 110, h: 75, l: 'Réseau' }, pi(byId(RP150_PORTS, 'lan'), 435, 92),
      { t: 'group', x: 505, y: 50, w: 230, h: 75, l: 'Vidéo' }, pi(byId(RP150_PORTS, 'sdi-in'), 560, 92, { l: '3G SDI ACTIVE IN' }), pi(byId(RP150_PORTS, 'sdi-thru'), 680, 92),
      { t: 'group', x: 24, y: 135, w: 470, h: 75, l: 'Tally et GPIO' }, pi(byId(RP150_PORTS, 'gpio1'), 130, 175), pi(byId(RP150_PORTS, 'gpio2'), 330, 175),
      { t: 'group', x: 505, y: 135, w: 230, h: 75, l: 'Alimentation' }, pi(byId(RP150_PORTS, 'dc'), 620, 175),
    ] },
  },
  specs: [
    'Écran tactile 7", joystick trois axes (pan, tilt, zoom par rotation), molettes iris et focus, dix touches de sélection de caméra, dix touches de préréglage (pages).',
    'Caméras : 200 au plus en IP (HTTP, port 80 d\'usine), 5 au plus en série RS-422 (SERIAL CONT 1 à 5, RJ45, une caméra par port) ; chaque emplacement se règle en IP, Serial ou NoAsign.',
    'Vidéo : entrée 3G SDI ACTIVE IN et sortie THRU OUT (boucle active) pour incruster les menus sur l\'image.',
    'Tally et GPI : TALLY/GPIO 1 et GPIO 2 (D-sub 25 broches) ; TALLY IP ON renvoie en IP, à chaque caméra, le tally reçu en contact.',
    'Alimentation : DC 12 V (XLR 4 broches, bloc fourni, 1,0 A ≈ 12 W) ou PoE+ IEEE 802.3at par IP CONT (0,6 A sous 42 à 57 V).',
    'Deux connecteurs « réservés à une extension future » existent sur la face arrière : ils ne servent à rien aujourd\'hui et ne sont pas modélisés.',
    'Dimensions ≈ 345 × 180 × 256 mm, ≈ 3,2 kg.',
  ],
  doc: 'Panasonic, AW-RP150 Operating Instructions (DVQP1819ZA), fiche technique AW-RP150 ; FAQ RP150 (Panasonic Pass).',
  averifier: [
    'Adresse d\'usine 192.168.0.9 : citée dans le guide de raccordement Panasonic AG-CX350 ↔ AW-RP150 comme réglage type, pas lue comme valeur d\'usine dans le manuel.',
    'Connecteurs TALLY/GPIO 1 et GPIO 2 : D-sub 25 broches femelle (fiche technique) ; le manuel de l\'AW-RP150G montre des connecteurs JST selon la variante.',
    'Consommation : 12 W (1,0 A × 12 V) déduit de la fiche ; en PoE+ la fiche donne 0,6 A (≈ 25 W au plus), ce qui est la demande inscrite sur le port IP CONT.',
    'TALLY IP sur ON d\'usine : valeur du brief, non lue dans le manuel ; emplacements de caméra sans affectation (NoAsign) d\'usine : supposé.',
    'Prix : ordre de grandeur (4 440 € HT chez un revendeur italien, 5 827 $ US aux États-Unis).',
  ],
  boite: { w: 0.345, h: 0.18, d: 0.256, couleur: '#2b2f33' },
};

/** @type {Record<string, Modele>} */
export const PANASONIC = { he130: HE130, he20: HE20, rp150: RP150 };

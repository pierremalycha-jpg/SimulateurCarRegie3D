// @ts-check
import { S } from '../state.js';
import { ROUTER, sourceLabel } from '../pipeline.js';
import { RF } from '../rf.js';
import { EQUIP, evsLayout, mixInputs } from '../equip.js';
import { FAB } from '../net/fabric.js';
import { inPlan, outPlan, xpOf } from '../videohub.js';

// ----------------------------------------------------------------------------------
// Plan de câblage de l'installation, généré à partir de la configuration courante.
// Chaque câble relie (appareil, numéro, port) à (appareil, numéro, port).
// ----------------------------------------------------------------------------------
export const DEV_NAMES = {
  cam: 'Caméra', ccu: 'CCU', rcp: 'RCP', pdc: 'Pied de car', router: 'Grille', mixer: 'Mélangeur XVS-6000', mixpanel: 'Pupitre ICP-X7000', siu: 'Interface MKS-X7700', mv: 'Multiviewer', evs: 'Serveur XT4K', lsm: 'Télécommande LSM', ipd: 'Poste IPDirector', xnet: 'Switch XNet', swred: 'Leaf IP rouge', swblue: 'Leaf IP bleue', spinered: 'Spine IP rouge', spineblue: 'Spine IP bleue', swctl: 'Switch de contrôle', gw: 'Passerelle SDI/IP', nmos: 'Contrôleur NMOS', evsmon: 'Écran du serveur EVS',
  spg: 'Générateur de synchro', da: 'Distributeur de référence', icom: 'Matrice intercom', cns: 'Switch réseau caméras (CNS)', msu: 'MSU (pupitre maître)', gfx: 'Moteur graphique',
  rx: 'Récepteur HF', conv: 'Convertisseur fibre', dav: 'Distributeur vidéo SDI', emb: 'Embedder audio', tx1: 'Encodeur TX1', tx2: 'Encodeur satellite TX2', audio: 'Console son', grade1: 'Moniteur Grade 1', giant: 'Écran géant', ups: 'Onduleur / distribution', localtv: 'Local technique TV', headset: 'Casque cadreur', lens: 'Optique', vf: 'Viseur', battery: 'Batterie', txhf: 'Émetteur HF',
};
export const SIG = {
  video: { label: 'Vidéo SDI', color: '#46c6f2' }, ref: { label: 'Référence (synchro)', color: '#ffd23f' }, audio: { label: 'Audio', color: '#7ee081' },
  comms: { label: 'Intercom / tally', color: '#c77dff' }, data: { label: 'Commande / données', color: '#ff9f6a' }, power: { label: 'Énergie', color: '#ff5a5a' },
  fiber: { label: 'Fibre caméra', color: '#ff8a1f' }, ip: { label: 'Réseau IP', color: '#2fd6c8' }, rf: { label: 'Radiofréquence', color: '#d65cf2' },
};

// numérotation de la grille : Videohub 40 × 40 du car SDI (plan détaillé dans videohub.js)
//   entrées 1-16 caméras, 17-27 serveurs, habillage, mire, mélangeur, retour ; 33-40 copies SDR (UHD)
//   sorties 1-22 mélangeur, 23-30 EVS REC, 31-34 départs et moniteur, 35-40 tuiles 13-18 du multiview
export const RIN = { cam: (n) => n, evsA: 17, evsB: 18, gfxFill: 19, gfxKey: 20, studio: 21, bars: 22, black: 23, pgm: 24, clean: 25, pvw: 26, ret: 27, camSdr: (n) => 32 + n };
export const ROUT = { me: (i) => i, mv: (i) => 22 + i, rec: (i) => 22 + i, tx1: 31, tx2: 32, giant: 33, vision: 34 };
export function routerInLabel(i) {
  if (i < 1 || i > 40) return null;
  const p = inPlan(i);
  if (p.src.startsWith('VH') && !p.live) return null;
  return p.def;
}
export function routerOutLabel(i) {
  if (i < 1 || i > 40) return null;
  const p = outPlan(i); if (!p.dest) return null;
  if (p.dest.startsWith('ME')) return `Mélangeur IN ${p.dest.slice(2)}`;
  if (p.dest.startsWith('MV')) return `Multiviewer IN ${p.dest.slice(2)}`;
  if (p.dest.startsWith('REC')) return `EVS REC ${p.dest.slice(3)}`;
  return { AUX_TX1: 'Départ TX1 (fibre)', AUX_TX2: 'Départ TX2 (satellite)', AUX_GIANT: 'Écran géant', AUX_VISION: 'Moniteur Grade 1' }[p.dest] || null;
}
// quelle entrée est commutée sur cette sortie ?
export function routerCrosspoint(outIdx) { return outIdx >= 1 && outIdx <= 40 ? xpOf(outIdx) : null; }

export const isSystemCam = (c) => c && !['pov', 'ptz', 'drone'].includes(c.type) && c.link !== 'hf';

let CACHE = { key: '', cables: [] };
function cfgKey() { return S.cams.map((c) => c.id + c.type + c.link + Math.round(c.route ? c.route.length : 0) + (c.fiberCut ? 'x' : '') + (c.genlock ? '' : 'g') + (c.powerOn === false ? 'p' : '')).join() + '|' + S.format + '|' + JSON.stringify(EQUIP) + (S.ipMode ? 'ip' + FAB.ver + (FAB.res ? 'r' : '') : '') + JSON.stringify(S.patch || {}) + JSON.stringify(ROUTER.map) + RF.antennas.map((a) => a.on ? 1 : 0).join(''); }

export function buildCabling() {
  const key = cfgKey();
  if (key === CACHE.key) return CACHE.cables;
  const C = []; let num = 1;
  const add = (a, b, type, sig, len, note = '', ok = true) => { C.push({ n: 'C' + String(num++).padStart(3, '0'), a, b, type, sig, len, note, ok }); };
  const P = (dev, n, port) => ({ dev, n, port });
  const sdiType = S.format === 'UHD' ? 'Coax 12G-SDI' : S.format === 'HD' ? 'Coax 3G-SDI' : 'Coax HD-SDI';
  // --- caméras ---
  const sys = S.cams.filter(isSystemCam);
  sys.forEach((c, i) => {
    const len = c.route ? Math.round(c.route.length) : 0;
    if (c.link === 'smpte' || c.link === 'triax') {
      add(P('cam', c.id, 'ccu'), P('pdc', 1, (c.link === 'triax' ? 'tri' : 'smpte') + c.id), c.link === 'triax' ? 'Triax' : 'Fibre hybride SMPTE 311M (3K.93C)', 'fiber', len, `Tirage terrain depuis « ${c.slot ? c.slot.label : 'position libre'} »`, c.status.ok);
      add(P('pdc', 1, (c.link === 'triax' ? 'tri' : 'smpte') + c.id), P('ccu', c.id, 'camera'), c.link === 'triax' ? 'Triax (liaison interne)' : 'Fibre hybride SMPTE (liaison interne car)', 'fiber', 4, 'Câblage interne : embase du pied de car vers la CCU', c.status.ok);
    } else {
      // fibre monomode / pré-câblage / IP : adaptateurs + alimentation locale
      add(P('cam', c.id, 'ccu'), P('conv', c.id, 'cam'), 'Fibre hybride courte (adaptateur SM)', 'fiber', 3, 'Adaptateur SMPTE / monomode côté caméra');
      add(P('battery', c.id, 'out'), P('cam', c.id, 'dcin'), 'Alimentation locale XLR-4', 'power', 3, 'Pas d\'alimentation par la fibre monomode : bloc secteur ou batterie');
      if (c.link === 'precab') {
        add(P('conv', c.id, 'line'), P('localtv', 1, 'fib' + c.id), 'Fibre SM du pré-câblage du stade', 'fiber', Math.round(c.route.infraLength || 0), 'Infrastructure installée à demeure');
        add(P('localtv', 1, 'fib' + c.id), P('pdc', 1, 'fib' + c.id), 'Fibre SM tactique (local TV → car)', 'fiber', len);
      } else add(P('conv', c.id, 'line'), P('pdc', 1, 'fib' + c.id), c.link === 'ip' ? 'Fibre SM (IP 25 GbE)' : 'Fibre monomode tactique (gaine jaune)', c.link === 'ip' ? 'ip' : 'fiber', len, '', c.status.ok);
      add(P('pdc', 1, 'fib' + c.id), P('ccu', c.id, 'camera'), 'Fibre SM interne + kit adaptateur SM à la CCU', 'fiber', 4, '', c.status.ok);
    }
    add(P('cam', c.id, 'lens'), P('lens', c.id, 'cable'), 'Câble optique 12 broches', 'data', 0.5, 'Commandes zoom, point, iris et doubleur de l\'objectif');
    add(P('cam', c.id, 'vf'), P('vf', c.id, 'cable'), 'Câble viseur 20 broches', 'video', 0.5);
    add(P('headset', c.id, 'out'), P('cam', c.id, 'icom1'), 'Casque intercom XLR-5', 'comms', 3, 'Le cadreur entend le réalisateur et lui répond (ordres transportés par la fibre)');
    // CCU
    add(P('ccu', c.id, 'sdi1'), P('router', 1, 'in' + RIN.cam(c.id)), sdiType, 'video', 2, `Sortie principale ${S.format === 'UHD' ? 'UHD HDR (HLG)' : 'HD'}`);
    // la grille 40 × 40 n'a de place que pour 8 copies SDR (entrées 33 à 40)
    if (S.format === 'UHD' && c.id <= 8) add(P('ccu', c.id, 'sdi2'), P('router', 1, 'in' + RIN.camSdr(c.id)), 'Coax 3G-SDI', 'video', 2, 'Copie HD SDR (BT.709) pour les diffuseurs HD');
    // retour programme : copie du PGM par un distributeur (aucune sortie de la grille 40 × 40 n'y est consacrée)
    if (!S.ipMode) add(P('dav', 2, 'out' + c.id), P('ccu', c.id, 'prompter'), 'Coax (retour programme)', 'video', 2, 'Retour PGM vers le viseur (bouton RET de l\'optique)');
    add(P('ccu', c.id, 'char'), P('mv', 1, 'in' + (24 + c.id)), 'Coax SDI', 'video', 2, 'Sortie CHARACTER : image avec menus et état pour la vision');
    add(P('da', 1, 'out' + (((i) % 8) + 1)), P('ccu', c.id, 'refin'), 'Coax 75 Ω (référence tri-level)', 'ref', 2, c.genlock ? 'Verrouillé' : 'RÉFÉRENCE ABSENTE', c.genlock);
    add(P('icom', 1, 'p' + c.id), P('ccu', c.id, 'icom'), 'Multipaire D-sub 50 (éclaté)', 'comms', 3, 'Intercom PROD/ENG, programme et tally R/G/Y');
    add(P('ccu', c.id, 'rcp'), P('rcp', c.id, 'ccu'), 'Câble CCA-5 (8 broches)', 'data', 8, 'Le RCP règle la caméra à travers la CCU');
    add(P('ccu', c.id, 'lan'), P('cns', 1, 'p' + c.id), 'Ethernet Cat6', 'ip', 3, 'Réseau caméras (MSU, menus à distance, tally IP TSL)');
    add(P('ups', 1, 'ac' + c.id), P('ccu', c.id, 'ac'), 'Cordon secteur IEC', 'power', 2);
  });
  // caméras non "système" : POV, PTZ, drone et HF
  for (const c of S.cams.filter((x) => !isSystemCam(x))) {
    const len = c.route ? Math.round(c.route.length) : 0;
    if (c.link === 'hf') {
      add(P('cam', c.id, 'sdi1'), P('txhf', c.id, 'sdi'), 'Coax court', 'video', 0.3, 'Émetteur COFDM au dos de la caméra');
      add(P('battery', c.id, 'out'), P('cam', c.id, 'dcin'), 'Batterie V-Lock 14,4 V', 'power', 0);
      add(P('txhf', c.id, 'ant'), P('rx', 1, 'rfin'), `Liaison radio ${(c.rf.ch / 1000).toFixed(3)} GHz`, 'rf', 0, `Marge ${c.rf.margin.toFixed(1)} dB`, c.rf.state !== 'lost');
      add(P('rx', 1, 'sdi' + c.id), P('router', 1, 'in' + RIN.cam(c.id)), sdiType, 'video', 2, `Image décodée (latence ≈ ${Math.round(c.rf.latencyS * 1000)} ms)`);
    } else {
      add(P('cam', c.id, 'sdi1'), P('conv', c.id, 'sdi'), 'Coax court', 'video', 1, 'Convertisseur SDI / fibre près de la caméra');
      add(P('conv', c.id, 'line'), P('pdc', 1, (c.link === 'coax' ? 'bnc' : 'fib') + c.id), c.link === 'coax' ? sdiType + ' (longue)' : c.link === 'ip' ? 'Fibre SM (IP)' : 'Fibre monomode tactique', c.link === 'ip' ? 'ip' : c.link === 'coax' ? 'video' : 'fiber', len, '', c.status.ok);
      add(P('pdc', 1, (c.link === 'coax' ? 'bnc' : 'fib') + c.id), P('router', 1, 'in' + RIN.cam(c.id)), sdiType, 'video', 3, 'Via convertisseur fibre / SDI dans la baie');
    }
  }
  // antennes HF -> récepteur
  RF.antennas.filter((a) => a.on).forEach((a, i) => add(P('localtv', 1, 'ant' + i), P('rx', 1, 'ant' + (i + 1)), 'RF sur fibre (fibre SM)', 'rf', 180, a.label));
  add(P('spg', 1, 'ref1'), P('rx', 1, 'ref'), 'Coax 75 Ω', 'ref', 2);
  // grille -> mélangeur, multiviewer, EVS, départs
  for (let i = 1; i <= mixInputs(); i++) add(P('router', 1, 'out' + ROUT.me(i)), P('mixer', 1, 'in' + i), sdiType, 'video', 3, `Bus ${i} : ${sourceLabel(ROUTER.map['ME' + i])}`);
  // multiview : tuiles 13 à 18 par la grille (sorties 35 à 40) ; tuiles 1 à 12 câblées en direct (hors grille)
  for (let i = 13; i <= 18; i++) add(P('router', 1, 'out' + ROUT.mv(i)), P('mv', 1, 'in' + i), sdiType, 'video', 3, `Tuile ${i} : ${sourceLabel(ROUTER.map['MV' + i])}`);
  if (!S.ipMode) {
    for (let i = 1; i <= 12; i++) {
      const src = ROUTER.map['MV' + i]; const cam = src && src.startsWith('CAM') ? S.cams.find((x) => 'CAM' + x.id === src) : null;
      add(cam && isSystemCam(cam) ? P('ccu', cam.id, 'sdi3') : P('dav', 1, 'out' + i), P('mv', 1, 'in' + i), sdiType, 'video', 3, `Tuile ${i} : ${sourceLabel(src)} (câblage direct, hors grille)`);
    }
    add(P('mixer', 1, 'out4'), P('dav', 2, 'in'), sdiType, 'video', 2, 'AUX du mélangeur : programme vers le distributeur des retours viseurs');
  }
  // serveurs ralentis (XT4K) : répartition des canaux selon le format
  const L = evsLayout();
  for (let i = 1; i <= L.rec; i++) add(P('router', 1, 'out' + ROUT.rec(i)), P('evs', L.recServer(i), 'sdi' + L.recPort(i)), sdiType, 'video', 3, `REC ${i} : ${ROUTER.map['REC' + i] ? sourceLabel(ROUTER.map['REC' + i]) + (ROUTER.phase['REC' + i] ? ' phase ' + 'ABCDEF'[ROUTER.phase['REC' + i]] : '') : 'libre'}`);
  for (let i = 0; i < L.plays; i++) add(P('evs', L.playServer(i), 'sdi' + L.playPort(i)), P('router', 1, 'in' + (i ? RIN.evsB : RIN.evsA)), sdiType, 'video', 3, `Sortie de lecture PGM${i + 1} (EVS ${i ? 'B' : 'A'})`);
  if (!L.uhd && L.per >= 12 && L.servers === 1) add(P('evs', 1, 'sdi11'), P('mv', 1, 'in19'), sdiType, 'video', 3, 'Multiviewer interne du serveur');
  for (let i = 1; i <= EQUIP.lsmCount; i++) add(P('lsm', i, 'rs422'), P('evs', Math.min(i, L.servers), 'rs' + i), 'Câble RS-422 (D-sub 9)', 'data', 6, EQUIP.lsmCount === 1 ? 'Télécommande LSM : pilote PGM1 et PGM2' : `Télécommande LSM ${i}`);
  if (EQUIP.ipdirector) for (let k = 1; k <= L.servers; k++) add(P('ipd', 1, 'lan'), P('evs', k, 'gbe1'), 'Fibre / Ethernet 10 Gb/s', 'ip', 6, 'IPDirector : base de données des clips, playlists, contrôle des canaux');
  if (L.servers > 1) for (let k = 1; k <= L.servers; k++) add(P('evs', k, 'xnet'), P('xnet', 1, 'p' + k), 'Réseau XNet', 'ip', 3, 'Partage des trains et des clips entre serveurs');
  for (let k = 1; k <= L.servers; k++) add(P('evs', k, 'vga'), P('evsmon', k, 'vga'), 'Câble VGA', 'video', 3, 'Écran du serveur (clip screen Multicam)');
  add(P('mixer', 1, 'out1'), P('router', 1, 'in' + RIN.pgm), sdiType, 'video', 3, 'PGM (avec DSK)');
  add(P('mixer', 1, 'out2'), P('router', 1, 'in' + RIN.clean), sdiType, 'video', 3, 'Clean feed (sans DSK)');
  add(P('mixer', 1, 'out3'), P('router', 1, 'in' + RIN.pvw), sdiType, 'video', 3, 'Preview');
  add(P('gfx', 1, 'fill'), P('router', 1, 'in' + RIN.gfxFill), sdiType, 'video', 3, 'Remplissage (fill)');
  add(P('gfx', 1, 'key'), P('router', 1, 'in' + RIN.gfxKey), sdiType, 'video', 3, 'Découpe (key)');
  add(P('gfx', 1, 'dsk1f'), P('mixer', 1, 'in23'), sdiType, 'video', 3, 'DSK 1 fill (score) : entrée directe du mélangeur');
  add(P('gfx', 1, 'dsk1k'), P('mixer', 1, 'in24'), sdiType, 'video', 3, 'DSK 1 key');
  add(P('mixpanel', 1, 'lan'), P('siu', 1, 'lanp'), 'Ethernet Cat6', 'ip', 6, 'Pupitre ICP-X7000 → unité d\'interface système');
  add(P('siu', 1, 'lanm'), P('mixer', 1, 'mvslan'), 'Ethernet Cat6', 'ip', 3, 'Unité d\'interface → processeur (MVS LAN)');
  add(P('siu', 1, 'tally1'), P('icom', 1, 'tally'), 'Multipaire D-sub 37', 'comms', 4, 'Tally parallèle (relais) vers la distribution tally des CCU');
  add(P('spg', 1, 'sdi1'), P('router', 1, 'in' + RIN.bars), sdiType, 'video', 3, 'Mire de test du générateur');
  add(P('router', 1, 'out' + ROUT.tx1), P('emb', 1, 'sdiin'), sdiType, 'video', 3, `Départ TX1 : ${sourceLabel(ROUTER.map.AUX_TX1)}`, ROUTER.map.AUX_TX1 === 'PGM');
  add(P('audio', 1, 'madi'), P('emb', 1, 'madi'), 'Coax MADI (AES10)', 'audio', 6, 'Son du programme (stéréo + 5.1 + international)');
  add(P('emb', 1, 'sdiout'), P('tx1', 1, 'sdiin'), sdiType, 'video', 2, 'PGM avec audio embeddé');
  add(P('tx1', 1, 'ip'), P('pdc', 1, 'txfib'), 'Fibre SM (opérateur)', 'ip', 4, 'Contribution vers la chaîne', !S.faults.tx);
  add(P('router', 1, 'out' + ROUT.tx2), P('tx2', 1, 'sdiin'), sdiType, 'video', 25, `Départ TX2 : ${sourceLabel(ROUTER.map.AUX_TX2)}`);
  add(P('rx', 1, 'retout'), P('router', 1, 'in' + RIN.ret), sdiType, 'video', 3, 'Retour antenne décodé');
  add(P('router', 1, 'out' + ROUT.giant), P('pdc', 1, 'bnc9'), 'Fibre vers l\'écran géant', 'video', 160, `Écran géant : ${sourceLabel(ROUTER.map.AUX_GIANT)}`);
  add(P('router', 1, 'out' + ROUT.vision), P('grade1', 1, 'sdia'), sdiType, 'video', 4, `Grade 1 : ${sourceLabel(ROUTER.map.AUX_VISION)}`);
  add(P('mv', 1, 'out1'), P('mv', 1, 'wall'), 'HDMI / 12G-SDI', 'video', 5, 'Mur d\'écrans production');
  // synchro
  add(P('spg', 1, 'tls1'), P('da', 1, 'in'), 'Coax 75 Ω', 'ref', 1, 'Tri-level vers le distributeur des CCU');
  add(P('spg', 1, 'bb1'), P('mixer', 1, 'refin'), 'Coax 75 Ω', 'ref', 3, 'Black burst (REF IN avec boucle)');
  add(P('spg', 1, 'tls2'), P('router', 1, 'ref'), 'Coax 75 Ω', 'ref', 2);
  for (let k = 1; k <= L.servers; k++) add(P('spg', 1, 'tls3'), P('evs', k, 'refin'), 'Coax 75 Ω', 'ref', 3);
  add(P('spg', 1, 'bb2'), P('mv', 1, 'ref'), 'Coax 75 Ω', 'ref', 2);
  for (let k = 1; k <= L.servers; k++) add(P('spg', 1, 'ltc1'), P('evs', k, 'ltcin'), 'Câble LTC (audio symétrique)', 'ref', 3, 'Timecode heure du jour');
  add(P('spg', 1, 'wclk'), P('audio', 1, 'wclk'), 'Coax 75 Ω (word clock)', 'ref', 8, 'Horloge audio 48 kHz');
  add(P('spg', 1, 'ptp1'), P('cns', 1, 'ptp'), 'Fibre / Ethernet', 'ip', 2, 'PTP (ST 2059-2) pour les équipements IP');
  add(P('pdc', 1, 'gps'), P('spg', 1, 'gps'), 'Coax antenne GPS (SMA)', 'rf', 12, 'Antenne GPS sur le toit du car', !S.faults.gps);
  // réseau
  add(P('msu', 1, 'lan'), P('cns', 1, 'msu'), 'Ethernet Cat6', 'ip', 4, 'MSU : configuration de toutes les caméras');
  add(P('mixer', 1, 'utillan'), P('cns', 1, 'tally'), 'Ethernet Cat6', 'ip', 3, 'Tally IP et noms de sources (TSL UMD) vers le multiviewer et les CCU');
  add(P('icom', 1, 'pdc'), P('pdc', 1, 'icom'), 'Câble 4 fils', 'comms', 4, 'Ordres avec la chaîne et les commentateurs');
  add(P('pdc', 1, 'power'), P('ups', 1, 'in'), 'Câble énergie P17 63 A tri', 'power', 4, 'Arrivée groupe électrogène / réseau stade');
  // car IP : la grille SDI est remplacée par deux réseaux (rouge et bleu) et des passerelles
  if (S.ipMode) {
    const keep = C.filter((c) => c.a.dev !== 'router' && c.b.dev !== 'router');
    C.length = 0; C.push(...keep);
    // raccordements réels de la fabric (net/fabric.js) : chaque carte réseau sur son port de leaf, uplinks, contrôle
    const MAP = { ccu: (d) => P('ccu', d.cam, 'opt'), xvs: () => P('mixer', 1, 'ip1'), gwevs: () => P('evs', 1, 'ipio'), gwcam: () => P('gw', 1, 'ip'), mv1: () => P('mv', 1, 'lan'), mv2: () => P('mv', 2, 'lan'), tx1: () => P('tx1', 1, 'ip'), tx2: () => P('tx2', 1, 'ip'), gfx: () => P('gfx', 1, 'ip'), grade1: () => P('grade1', 1, 'ip'), console: () => P('audio', 1, 'ip'), gm1: () => P('spg', 1, 'ptp1'), gm2: () => P('spg', 2, 'ptp1') };
    const side = (sw, port) => { const S2 = FAB.switches[sw]; return P(S2.role === 'spine' ? (S2.color === 'red' ? 'spinered' : 'spineblue') : S2.role === 'ctl' ? 'swctl' : S2.color === 'red' ? 'swred' : 'swblue', S2.k || S2.s || 1, port); };
    if (FAB.res) {
      for (const d of Object.values(FAB.devices)) for (const c of ['red', 'blue']) {
        const n = d.nics[c]; if (!n) continue; const st = FAB.res.nic[d.id + ':' + c] || {};
        const a = (d.kind === 'ccu' ? MAP.ccu : MAP[d.id] || (() => P(d.id, 1, 'ip')))(d);
        const sp = FAB.switches[n.sw].running.ports[n.port].speed;
        add(a, side(n.sw, n.port), sp === '100g' ? 'Fibre MM OM4 · QSFP28 100GBASE-SR4' : sp === '25g' ? 'Fibre MM OM4 · SFP28 25GBASE-SR' : sp === '10g' ? 'Fibre MM · SFP+ 10GBASE-SR' : 'Cuivre Cat6A', 'ip', d.kind === 'gm' ? 2 : 4, `${d.name} · réseau ${c === 'red' ? 'rouge' : 'bleu'} · ${n.ip}`, !!st.up);
      }
      for (const l of FAB.links) add(side(l.a.sw, l.a.port), side(l.b.sw, l.b.port), 'Fibre MM OM4 · QSFP28 100GBASE-SR4', 'ip', 6, `Uplink ${FAB.switches[l.a.sw].running.hostname} ↔ ${FAB.switches[l.b.sw].running.hostname} · ${l.color === 'red' ? 'rouge' : 'bleu'}`, !!FAB.res.up[l.id].up);
      for (const d of Object.values(FAB.devices)) if (d.ctl && d.ctl.port) add(d.kind === 'nmos' ? P('nmos', 1, 'lan') : (d.kind === 'ccu' ? MAP.ccu : MAP[d.id] || (() => P(d.id, 1, 'ip')))(d), side('SW-CTRL', d.ctl.port), 'Ethernet Cat6A', 'ip', 3, `Contrôle ${d.name} · ${d.ctlIp} (VLAN ${d.ctl.vlan})`, true);
    }
    C.forEach((c, i) => { c.n = 'C' + String(i + 1).padStart(3, '0'); });
  }
  CACHE = { key, cables: C };
  return C;
}

export function deviceCables(dev, n) { return buildCabling().filter((c) => (c.a.dev === dev && c.a.n === n) || (c.b.dev === dev && c.b.n === n)); }
export function endLabel(e) {
  const name = DEV_NAMES[e.dev] || e.dev;
  const multi = ['cam', 'ccu', 'rcp', 'lsm', 'conv', 'lens', 'vf', 'headset', 'battery', 'txhf', 'swred', 'swblue', 'spinered', 'spineblue'].includes(e.dev) || (e.dev === 'evs' && EQUIP.evsServers > 1);
  return `${name}${multi ? ' ' + e.n : ''} · ${portName(e.dev, e.port)}`;
}
export function portName(dev, port) {
  if (dev === 'router') { const m = /^(in|out)(\d+)$/.exec(port); if (m) return `${m[1] === 'in' ? 'IN' : 'OUT'} ${m[2]}`; }
  if (dev === 'pdc') {
    let m = /^smpte(\d+)$/.exec(port); if (m) return `SMPTE ${m[1]}`;
    m = /^fib(\d+)$/.exec(port); if (m) return `FIBRE ${m[1]}`;
    m = /^tri(\d+)$/.exec(port); if (m) return `TRIAX ${m[1]}`;
    m = /^bnc(\d+)$/.exec(port); if (m) return `BNC ${m[1]}`;
  }
  if (/^Ethernet\d+$/.test(port)) return port;
  if (/^in(\d+)$/.test(port)) return 'IN ' + port.slice(2);
  if (/^out(\d+)$/.test(port)) return 'OUT ' + port.slice(3);
  if (/^sdi(\d+)$/.test(port)) return 'SDI ' + port.slice(3);
  const map = { ccu: 'CCU (fibre)', camera: 'CAMERA', lens: 'LENS', vf: 'VF', icom1: 'INTERCOM 1', dcin: 'DC IN', prompter: 'PROMPTER', char: 'CHARACTER', refin: 'REFERENCE IN', ref: 'REF IN', icom: 'INTERCOM/TALLY/IO', rcp: 'RCP/CNU', lan: 'LAN', ac: 'AC IN', mgmt1: 'LAN gestion 1', mgmt2: 'LAN gestion 2', ltcin: 'LTC IN', tls1: 'TRI-LEVEL 1', tls2: 'TRI-LEVEL 2', tls3: 'TRI-LEVEL 3', bb1: 'BLACK BURST 1', bb2: 'BLACK BURST 2', ltc1: 'LTC 1', wclk: 'WORD CLOCK', ptp1: 'PTP 1', gps: 'GPS', sdiin: 'SDI IN', sdiout: 'SDI OUT', madi: 'MADI', ip: 'IP / fibre', fill: 'FILL OUT', key: 'KEY OUT', dsk1f: 'DSK 1 FILL', dsk1k: 'DSK 1 KEY', tally: 'TALLY (IP)', power: 'ÉNERGIE P17', icomx: 'INTERCOM', cable: 'connecteur', out: 'sortie', line: 'ligne fibre', sdi: 'SDI', ant: 'antenne', rfin: 'RF IN', retout: 'SORTIE RETOUR', sdia: 'SDI A', wall: 'écrans', txfib: 'FIBRE TX', msu: 'port MSU', ptp: 'PTP', cam: 'côté caméra', in: 'IN' };
  return map[port] || port.toUpperCase();
}

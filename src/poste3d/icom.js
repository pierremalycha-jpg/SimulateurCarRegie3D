// @ts-check
import * as THREE from 'three';
import { Builder } from '../geo.js';
import { matiere } from '../matiere.js';
import { S, on } from '../state.js';
import { keyField, canvasPlane, rr, txt } from './kit.js';

// ----------------------------------------------------------------------------------
// Le pupitre d'intercom du réalisateur, en 3D (type pupitre numérique de bureau, Riedel ou Clear-Com) : deux
// rangées de neuf modules ; chaque module a son afficheur (le nom du canal et son type) et deux touches, TALK
// (parler) et LISTEN (écouter). Au fond, le micro col de cygne, le haut-parleur et le volume général (décor).
// Tout suit l'état des touches (updateIcom3D) ; le poste en vue 3D est dans poste3d/intercom.js.
// Dimensions : ordre de grandeur (environ 48 × 22 cm), disposition simplifiée.
// Repère du plateau (top) : x vers la droite de l'opérateur, z vers lui, y vers le haut, au dessus du boîtier.
// ----------------------------------------------------------------------------------
export const ICW = 0.48, ICD = 0.22, ICH = 0.035;
export const N_MOD = 18, COLS = 9;
const PITCH = 0.045;
/** module m (0 à 17) : centre de l'afficheur et des touches */
export const modX = (m) => -0.18 + (m % COLS) * PITCH;
export const modZ = (m) => (m < COLS ? -0.03 : 0.05);
export const OLED = { dz: -0.017, w: 0.039, d: 0.017 };
export const KEY = { dz: 0.007, dx: 0.0098, w: 0.018, d: 0.014 };

// ---------------- état du pupitre (commun au poste à plat ui/st_intercom.js et à la 3D) ----------------
/** types de liaison : l'abréviation de l'afficheur et ce qu'elle veut dire */
export const ICOM_TYPES = {
  conf: ['CONF', 'Conférence (partyline) : tous les membres s\'entendent et peuvent se parler.'],
  p2p: ['P2P', 'Point à point : une liaison privée entre deux pupitres, les autres n\'entendent pas.'],
  ifb: ['IFB', 'IFB (interruptible foldback) : le destinataire entend un programme ; quand on parle, ce programme est atténué (dim) et la voix passe par-dessus.'],
  w4: ['4 FILS', 'Liaison 4 fils : une paire pour parler, une pour écouter, vers un système extérieur (la chaîne, un autre car).'],
  hyb: ['HYBRIDE', 'Hybride téléphonique / SIP : relie l\'intercom à une ligne téléphonique.'],
  gpo: ['GPO', 'Sortie relais : la touche ferme un contact (voyant, buzzer, commande d\'un appareil).'],
};
/** les touches du pupitre : [nom du canal, type, rôle] ; une touche par caméra (jusqu'à six) */
export function icomKeys() {
  return [
    ['ORDRES', 'conf', 'La conférence « Ordres » : le réalisateur parle à tout le car et à tous les cadreurs. Tout le monde écoute, seuls quelques pupitres y parlent.'],
    ['CAMÉRAS', 'conf', 'Les cadreurs : la voix sort de la matrice sur une carte 4 fils, entre dans chaque CCU par son connecteur INTERCOM/TALLY (D-sub 50, canal PROD), voyage dans la fibre caméra et arrive au casque du cadreur (XLR-5 INTERCOM sur la tête).'],
    ...S.cams.slice(0, 6).map((c) => [`CAM ${c.id}`, 'p2p', `Point à point avec le cadreur de la CAM ${c.id} (${c.T.short}) : pour lui parler sans déranger les autres.${c.link === 'hf' ? ' Caméra HF : l\'intercom passe par une liaison radio séparée (talkie numérique ou retour HF).' : ''}`]),
    ['ENG', 'conf', 'Canal ENG (technique) : la vision, le chef de car et les cadreurs parlent des problèmes techniques sans polluer les ordres de la production. Sur les caméras Sony, PROD et ENG sont deux canaux distincts du connecteur intercom.'],
    ['VISION', 'p2p', 'Ligne directe avec les ingénieurs vision.'],
    ['EVS', 'conf', 'Les opérateurs ralentis : le réalisateur demande les angles, l\'opérateur annonce « EVS A prêt ».'],
    ['SON', 'p2p', 'Ligne directe avec l\'ingénieur du son.'],
    ['TRUQUISTE', 'p2p', 'Le truquiste est souvent à côté du réalisateur, mais garde une touche pour les pupitres déportés.'],
    ['COMMENT.', 'ifb', 'IFB des commentateurs : ils entendent leur N-1 (le programme sans leur propre voix) ; quand la production leur parle, ce retour baisse.'],
    ['CHAÎNE', 'w4', 'Coordination avec la régie finale de la chaîne : top départ, compte à rebours, pubs, incidents.'],
    ['TÉLÉPHONE', 'hyb', 'Pour joindre un intervenant extérieur (le stade, la sécurité, un duplex).'],
    ['VOYANT', 'gpo', 'Allume le voyant « réalisateur au micro » dans le compound (exemple de sortie relais).'],
  ];
}
/** état des touches, par nom de canal : TALK ouvert, LISTEN actif (les conférences et l'IFB s'écoutent d'office) ;
 * log : les derniers messages passés sur l'intercom (qui, quoi, heure du match), pour l'écran du poste en 3D */
export const ICOM = { keys: {}, log: [] };
on('intercom', (e) => { ICOM.log.push({ who: e.who, msg: e.msg, t: S.simTime }); if (ICOM.log.length > 12) ICOM.log.shift(); });
export function icomState(l, t) {
  return ICOM.keys[l] || (ICOM.keys[l] = { talk: false, listen: t === 'conf' || t === 'ifb' });
}
/** @type {{ grp: THREE.Group | null, top: THREE.Object3D | null, keys: any, oleds: any[], sig: string, t: number }} */
export const ICOMS = { grp: null, top: null, keys: null, oleds: [], sig: '', t: 0 };

export function buildIcom3D(scene, pos, rotY = 0) {
  const grp = new THREE.Group(); grp.name = 'pupitre-intercom'; grp.position.copy(pos); grp.rotation.y = rotY;
  // pupitre de bureau : la face des touches inclinée vers l'opérateur
  const deck = new THREE.Object3D(); deck.position.set(0, 0.03, 0); deck.rotation.x = 0.22; grp.add(deck);
  const top = new THREE.Object3D(); top.position.set(0, ICH, 0); deck.add(top);
  ICOMS.grp = grp; ICOMS.top = top;
  const Bc = new Builder({ ao: 0.05, aoOpts: { dist: 0.1, strength: 0.9, floor: 0.35 } });
  const Bm = new Builder({ ao: 0.05, aoOpts: { dist: 0.1, strength: 0.9, floor: 0.35 } });
  Bc.cbox(ICW, ICH, ICD, 0, ICH / 2, 0, 0x1d2126, 0.01);
  // pieds (le pupitre est surélevé à l'arrière), cadre de chaque rangée d'afficheurs
  Bc.cbox(ICW - 0.04, 0.05, 0.04, 0, -0.015, -ICD / 2 + 0.03, 0x15181c, 0.006);
  for (const r of [0, 1]) Bc.cbox(COLS * PITCH + 0.004, 0.003, OLED.d + 0.006, -0.18 + 4 * PITCH, ICH + 0.0015, modZ(r * COLS) + OLED.dz, 0x07080a, 0.002);
  // volume général (décor) et touche du micro
  Bc.cyl(0.013, 0.014, 0.014, 0.205, ICH + 0.007, -0.088, 0x15171a, 24);
  // flancs en aluminium, embase et col de cygne du micro
  for (const sx of [-1, 1]) Bm.box(0.004, ICH + 0.004, ICD, sx * (ICW / 2 - 0.002), ICH / 2, 0, 0x8c939b);
  const body = Bc.mesh(matiere('plastique', { seed: 51, scale: 0.12, strength: 0.6, roughness: 0.6, name: 'pupitre-intercom-boitier' })); body.name = 'pupitre-intercom-boitier';
  const alu = Bm.mesh(matiere('alu', { seed: 52, scale: 0.2, strength: 0.6, name: 'pupitre-intercom-alu' })); alu.name = 'pupitre-intercom-alu';
  deck.add(body, alu);
  // micro col de cygne : embase sur le dessus, tige qui monte puis se penche vers l'opérateur, capsule à bonnette
  const Bg = new Builder({ ao: 0.05, aoOpts: { dist: 0.08, strength: 0.8, floor: 0.4 } });
  Bg.cyl(0.012, 0.014, 0.012, -0.212, ICH + 0.006, -0.088, 0x2a2d31, 18);
  const pts = [[-0.212, ICH + 0.012, -0.088], [-0.212, ICH + 0.12, -0.1], [-0.205, ICH + 0.22, -0.07], [-0.19, ICH + 0.27, -0.0]];
  for (let i = 0; i < pts.length - 1; i++) Bg.rod(pts[i], pts[i + 1], 0.0045, 0x34383d, 8);
  Bg.cyl(0.011, 0.009, 0.04, -0.188, ICH + 0.275, 0.022, 0x111214, 14, Math.PI / 2 - 0.4);
  const mic = Bg.mesh(matiere('plastique', { seed: 53, scale: 0.05, strength: 0.4, roughness: 0.4, name: 'pupitre-intercom-micro' })); mic.name = 'pupitre-intercom-micro';
  deck.add(mic);
  // sérigraphie : grille du haut-parleur, nom du pupitre, repères
  const ser = canvasPlane(top, ICW - 0.01, ICD - 0.01, 0, 0, 0.0003, 1024, 470, { name: 'pupitre-intercom-serigraphie' });
  drawSerigraphy(ser.g, 1024, 470); ser.dirty();
  // touches TALK et LISTEN : deux par module
  const keys = [];
  for (let m = 0; m < N_MOD; m++) {
    keys.push({ x: modX(m) - KEY.dx, z: modZ(m) + KEY.dz, w: KEY.w, d: KEY.d, h: 0.007, color: 0x38e070, legend: 'TALK', m, talk: true });
    keys.push({ x: modX(m) + KEY.dx, z: modZ(m) + KEY.dz, w: KEY.w, d: KEY.d, h: 0.007, color: 0xffb030, legend: 'LISTEN', m, talk: false });
  }
  ICOMS.keys = keyField(top, keys, { name: 'pupitre-intercom-touches' });
  // afficheurs : une bande par rangée
  ICOMS.oleds = [0, 1].map((r) => canvasPlane(top, COLS * PITCH, OLED.d, -0.18 + 4 * PITCH, modZ(r * COLS) + OLED.dz, 0.0032, 1152, 64, { lit: true, name: 'pupitre-intercom-afficheurs' }));
  scene.add(grp);
  updateIcom3D(0, true);
  return grp;
}

function drawSerigraphy(g, W, H) {
  g.fillStyle = '#1d2126'; g.fillRect(0, 0, W, H);
  const k = W / (ICW - 0.01), X = (x) => W / 2 + x * k, Z = (z) => H / 2 + z * k;
  // grille du haut-parleur
  for (let i = 0; i < 9; i++) for (let j = 0; j < 4; j++) { g.beginPath(); g.arc(X(-0.16 + i * 0.012), Z(-0.098 + j * 0.008), 3.2, 0, Math.PI * 2); g.fillStyle = '#07080a'; g.fill(); }
  txt(g, 'INTERCOM · PUPITRE RÉALISATEUR', X(0.02), Z(-0.09), 17, '#c9d1d9', 'left', 600);
  txt(g, 'VOL', X(0.205), Z(-0.065), 13, '#8b949e', 'center', 600);
  txt(g, 'TALK = parler · LISTEN = écouter', X(0.02), Z(0.1), 14, '#8b949e', 'left', 500);
  rr(g, X(-0.205), Z(-0.06), (COLS * PITCH + 0.01) * k, 0.165 * k, 8, null, '#2a3038', 2);
}

const keysNow = () => icomKeys();
/** l'état allumé d'une touche (0 ou 1) ; un module sans canal reste éteint */
function lit(k, list) {
  const e = list[k.m]; if (!e) return 0;
  const st = icomState(e[0], e[1]);
  return (k.talk ? st.talk : st.listen) ? 1 : 0;
}
export function updateIcom3D(dt, force = false) {
  if (!ICOMS.grp) return;
  ICOMS.t += dt; if (!force && ICOMS.t < 0.1) return; ICOMS.t = 0;
  const list = keysNow(), F = ICOMS.keys;
  F.keys.forEach((k, i) => F.set(i, lit(k, list)));
  F.flush();
  const sig = list.map((e) => e[0] + (icomState(e[0], e[1]).talk ? '*' : '')).join('|');
  if (sig === ICOMS.sig) return; ICOMS.sig = sig;
  ICOMS.oleds.forEach((o, r) => {
    const g = o.g, W = o.c.width, H = o.c.height, cw = W / COLS;
    g.fillStyle = '#050608'; g.fillRect(0, 0, W, H);
    for (let c = 0; c < COLS; c++) {
      const m = r * COLS + c, e = list[m], x = c * cw;
      rr(g, x + 6, 3, cw - 12, H - 6, 4, e ? (icomState(e[0], e[1]).talk ? '#0f3a1c' : '#0d2338') : '#0a0c0f');
      if (!e) continue;
      txt(g, e[0], x + cw / 2, 24, 25, '#e6f6ff', 'center', 700);
      txt(g, ICOM_TYPES[e[1]][0], x + cw / 2, 50, 17, '#6fa8dc', 'center', 600);
    }
    o.dirty();
  });
}
/** la touche survolée s'éclaire (indice dans le champ de touches, −1 : aucune) */
export function hoverIcomKey(idx) {
  const F = ICOMS.keys; if (!F) return;
  const old = F.hot; F.hot = idx; const list = keysNow();
  for (const k of [old, idx]) if (k >= 0) { F.set(k, -1); F.set(k, lit(F.keys[k], list)); }
  F.flush();
}

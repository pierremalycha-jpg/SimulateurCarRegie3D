// @ts-check
import * as THREE from 'three';
import { S, camById } from '../state.js';
import { fmt } from '../util.js';
import { Builder } from '../geo.js';
import { matiere } from '../matiere.js';
import { MIX, TRANS, WIPES, meSource, sourceLabel, allSources, frameRate, ROUTER } from '../pipeline.js';
import { EQUIP, mixInputs } from '../equip.js';
import { keyField, canvasPlane, rr, txt } from './kit.js';

// ----------------------------------------------------------------------------------
// Le pupitre du truquiste en 3D : un panneau de commande type Sony ICP-X7000 (une M/E) posé sur le
// bureau de la régie de production, touche par touche. Il remplace l'ancienne image plate du pupitre :
// on le voit en marchant dans le car (les tallys des rangées suivent le mélangeur), et le poste
// « Mélangeur » s'y installe en vue 3D (poste3d/melangeur.js, poste3d/index.js). Ce fichier n'est que le
// matériel (géométrie et état lumineux) : il ne dépend pas de l'interface.
// Repère du plateau : x vers la droite de l'opérateur, z vers lui, y vers le haut (plateau incliné
// de 7° vers l'opérateur, posé sur le bureau).
// Disposition simplifiée et non contractuelle : les zones (croisements, transition, clés, DSK,
// mémoires, menu) sont celles d'un pupitre de cette classe, pas leur place exacte sur l'ICP-X7000.
// ----------------------------------------------------------------------------------
// keyMode : libellé du mode des touches 1-9 affiché par l'écran du menu (fourni par la définition du poste)
/** @type {{ grp: THREE.Group | null, deck: THREE.Object3D | null, keys: any, ctrls: any[], lever: any, oled: any[], menu: any, lcd: any, sig: { oled: string, menu: string, lcd: string }, t: number, keyMode: () => string }} */
export const PUP = { grp: null, deck: null, keys: null, ctrls: [], lever: null, oled: [], menu: null, lcd: null, sig: { oled: '', menu: '', lcd: '' }, t: 0, keyMode: () => '' };

export const NX = 22; // touches par rangée de croisement (entrées HD ; en UHD, les dernières restent éteintes)
const PX = 0.036, KX0 = -0.42; // pas et centre de la première touche de croisement
const ROWZ = { key: -0.17, pgm: -0.08, pst: 0.01 };
export const ROW_LABEL = { key: 'KEY/AUX', pgm: 'A · PGM', pst: 'B · PST' };
const ROW_COLOR = { key: 0xf0c040, pgm: 0xff3a30, pst: 0x38e070 };
export const TB = { x: 0.72, z0: -0.06, z1: 0.15 }; // barre T : course (z) de la poignée
const TILT = 0.12;

// Nom court affiché sur l'OLED au-dessus d'une touche de croisement (et sur les boutons de la vue 2D)
export function oledName(n) {
  const id = meSource(n);
  if (!id) return ['—', ''];
  if (id.startsWith('CAM')) { const c = camById(+id.slice(3)); return [`CAM ${id.slice(3)}`, c ? c.T.short : 'libre']; }
  const s = allSources().find((x) => x.id === id);
  return [s ? s.short : id, { EVSA: 'EVS PGM1', EVSB: 'EVS PGM2', GFX: 'graph.', STUDIO: 'duplex', BARS: 'mire', BLACK: 'noir' }[id] || ''];
}

// ---------------- les touches ----------------
// chaque touche : position, taille, couleur allumée, légende ; c : la commande qu'elle porte (voir CTRL)
function layout() {
  const K = [];
  const add = (c, x, z, w, d, color, legend = '') => { K.push({ c, x, z, w, d, color, legend }); };
  for (const bus of ['key', 'pgm', 'pst']) for (let n = 1; n <= NX; n++) add({ t: 'xpt', bus, n }, KX0 + (n - 1) * PX, ROWZ[bus], 0.028, 0.028, ROW_COLOR[bus]);
  // clé 1 (redimensionneur) et DSK, devant les croisements
  add({ t: 'keycut' }, -0.40, 0.10, 0.05, 0.032, 0xff5040, 'KEY\nCUT');
  add({ t: 'keyauto' }, -0.34, 0.10, 0.05, 0.032, 0xff5040, 'KEY\nAUTO');
  [['tl', '↖', -0.27, 0.083], ['tr', '↗', -0.235, 0.083], ['bl', '↙', -0.27, 0.118], ['br', '↘', -0.235, 0.118]].forEach(([k, l, x, z]) => add({ t: 'corner', k }, +x, +z, 0.03, 0.03, 0x50b0ff, String(l)));
  add({ t: 'size', d: -1 }, -0.175, 0.10, 0.03, 0.03, 0xd0d4da, 'TAILLE\n−');
  add({ t: 'size', d: 1 }, -0.14, 0.10, 0.03, 0.03, 0xd0d4da, 'TAILLE\n+');
  add({ t: 'dsk', n: 1, auto: false }, -0.06, 0.08, 0.05, 0.034, 0xff5040, 'DSK 1\nCUT');
  add({ t: 'dsk', n: 1, auto: true }, 0.0, 0.08, 0.05, 0.034, 0xff5040, 'DSK 1\nAUTO');
  add({ t: 'dsk', n: 2, auto: false }, -0.06, 0.125, 0.05, 0.034, 0xff5040, 'DSK 2\nCUT');
  add({ t: 'dsk', n: 2, auto: true }, 0.0, 0.125, 0.05, 0.034, 0xff5040, 'DSK 2\nAUTO');
  add({ t: 'ftb' }, 0.08, 0.10, 0.05, 0.05, 0xff5040, 'FTB');
  // mémoires (snapshots), sous l'écran du menu
  add({ t: 'store' }, -0.72, 0.03, 0.05, 0.03, 0xffb030, 'STORE');
  for (let i = 0; i < 8; i++) { const j = i + 1; add({ t: 'snap', i }, -0.72 + (j % 3) * 0.075, 0.03 + Math.floor(j / 3) * 0.05, 0.05, 0.03, 0x50b0ff, 'SNAP ' + (i + 1)); }
  // module de transition
  add({ t: 'next', k: 'bkgd' }, 0.42, -0.17, 0.045, 0.03, 0xffb030, 'BKGD');
  add({ t: 'next', k: 'key1' }, 0.475, -0.17, 0.045, 0.03, 0xffb030, 'KEY 1');
  WIPES.forEach((w, i) => add({ t: 'wipe', i }, 0.55 + i * 0.04, -0.17, 0.032, 0.03, 0x50b0ff, w.split(' ')[0].slice(0, 5).toUpperCase()));
  Object.keys(TRANS).forEach((k, i) => add({ t: 'trans', k }, 0.43 + i * 0.05, -0.10, 0.042, 0.034, 0xffb030, TRANS[k]));
  add({ t: 'rate', d: -1 }, 0.53, -0.035, 0.032, 0.03, 0xd0d4da, '−');
  add({ t: 'rate', d: 1 }, 0.57, -0.035, 0.032, 0.03, 0xd0d4da, '+');
  add({ t: 'cut' }, 0.44, 0.07, 0.07, 0.05, 0xf2f4f8, 'CUT');
  add({ t: 'auto' }, 0.54, 0.07, 0.08, 0.05, 0xff3a30, 'AUTO\nTRANS');
  return K;
}

// ---------------- construction ----------------
/** pose le pupitre sur le bureau : pos = point du plateau du bureau sous le centre du pupitre */
export function buildMelangeur3D(scene, pos, rotY = 0) {
  const grp = new THREE.Group(); grp.name = 'pupitre-icp'; grp.position.copy(pos); grp.rotation.y = rotY;
  const deck = new THREE.Object3D(); deck.position.set(0, 0.05, 0); deck.rotation.x = TILT; grp.add(deck);
  PUP.grp = grp; PUP.deck = deck;
  // châssis (plastique, une pièce) et habillage (aluminium, une pièce), occlusion cuite
  const Bc = new Builder({ ao: 0.06, aoOpts: { dist: 0.12, strength: 0.9, floor: 0.35 } });
  const Ba = new Builder({ ao: 0.06, aoOpts: { dist: 0.12, strength: 0.9, floor: 0.35 } });
  Bc.cbox(1.62, 0.09, 0.58, 0, -0.045, 0, 0x2a2e33, 0.01);
  Bc.cbox(0.27, 0.012, 0.19, -0.645, 0.006, -0.15, 0x101215, 0.004); // cadre de l'écran du menu
  Bc.cbox(0.11, 0.008, 0.045, 0.455, 0.004, -0.035, 0x101215, 0.003); // cadre de l'afficheur de durée
  Bc.box(0.022, 0.006, 0.27, TB.x, 0.002, (TB.z0 + TB.z1) / 2, 0x07080a); // fente de la barre T
  for (const sx of [-1, 1]) Ba.cbox(0.02, 0.11, 0.6, sx * 0.815, -0.035, 0, 0x9aa0a8, 0.006);
  Ba.cbox(1.6, 0.022, 0.05, 0, 0.011, 0.262, 0x8c939b, 0.009); // repose-poignets
  Ba.cbox(0.05, 0.012, 0.3, TB.x - 0.026, 0.006, (TB.z0 + TB.z1) / 2, 0x8c939b, 0.004);
  Ba.cbox(0.05, 0.012, 0.3, TB.x + 0.026, 0.006, (TB.z0 + TB.z1) / 2, 0x8c939b, 0.004);
  const chassis = Bc.mesh(matiere('plastique', { seed: 22, scale: 0.12, strength: 0.6, roughness: 0.62, name: 'pupitre-icp-chassis' })); chassis.name = 'pupitre-icp-chassis';
  const alu = Ba.mesh(matiere('alu', { seed: 23, scale: 0.2, strength: 0.6, name: 'pupitre-icp-alu' })); alu.name = 'pupitre-icp-alu';
  deck.add(chassis, alu);
  // sérigraphie (fixe), OLED des rangées, écran du menu, afficheur de durée
  const silk = canvasPlane(deck, 1.6, 0.56, 0, 0, 0.0004, 2048, 716, { name: 'pupitre-icp-serigraphie', roughness: 0.78 });
  drawSilk(silk.g, silk.c.width, silk.c.height); silk.dirty();
  PUP.oled = ['key', 'pgm', 'pst'].map((bus) => canvasPlane(deck, NX * PX, 0.02, KX0 + (NX - 1) * PX / 2, ROWZ[bus] - 0.033, 0.0008, NX * 128, 72, { lit: true, name: 'pupitre-icp-oled' }));
  PUP.menu = canvasPlane(deck, 0.25, 0.17, -0.645, -0.15, 0.0125, 512, 348, { lit: true, name: 'pupitre-icp-menu' });
  PUP.lcd = canvasPlane(deck, 0.1, 0.035, 0.455, -0.035, 0.0085, 288, 100, { lit: true, name: 'pupitre-icp-lcd' });
  // touches
  const K = layout();
  PUP.keys = keyField(deck, K, { name: 'pupitre-icp-touches' });
  PUP.ctrls = K.map((k, ki) => ({ ...k.c, ki }));
  // barre T : poignée mobile (tige et barre transversale)
  const Bl = new Builder();
  Bl.cyl(0.006, 0.006, 0.07, 0, 0.03, 0, 0x2a2d31, 8);
  Bl.cyl(0.012, 0.012, 0.1, 0, 0.066, 0, 0x1a1c20, 12, 0, Math.PI / 2);
  Bl.cyl(0.0125, 0.0125, 0.012, -0.055, 0.066, 0, 0xd8dce2, 12, 0, Math.PI / 2);
  Bl.cyl(0.0125, 0.0125, 0.012, 0.055, 0.066, 0, 0xd8dce2, 12, 0, Math.PI / 2);
  const lever = Bl.mesh(matiere('plastique', { seed: 24, scale: 0.05, strength: 0.4, roughness: 0.45, name: 'pupitre-icp-barre-t' })); lever.name = 'pupitre-icp-barre-t';
  lever.position.set(TB.x, 0, TB.z0); deck.add(lever); PUP.lever = lever;
  scene.add(grp);
  PUP.sig = { oled: '', menu: '', lcd: '' };
  updateMelangeur3D(0, true);
  return grp;
}

function drawSilk(g, W, H) {
  const sx = W / 1.6, sz = H / 0.56; const px = (x) => (x + 0.8) * sx, pz = (z) => (z + 0.28) * sz;
  g.fillStyle = '#1d2024'; g.fillRect(0, 0, W, H);
  // zones du pupitre : cadres légèrement plus sombres
  const zone = (x0, z0, x1, z1, title) => { rr(g, px(x0), pz(z0), px(x1) - px(x0), pz(z1) - pz(z0), 10, '#171a1d', '#3a4047', 2); if (title) txt(g, title, px(x0) + 10, pz(z0) + 14, 17, '#8b949e', 'left', 600); };
  zone(-0.79, -0.27, -0.5, 0.2, 'MENU · SNAPSHOT');
  zone(-0.49, -0.27, 0.36, 0.045, 'M/E 1 · CROISEMENTS');
  zone(-0.49, 0.055, -0.115, 0.2, 'KEY 1 · REDIMENSIONNEUR');
  zone(-0.105, 0.055, 0.36, 0.2, 'DSK · FONDU AU NOIR');
  zone(0.38, -0.27, 0.79, 0.2, 'TRANSITION');
  for (const bus of ['key', 'pgm', 'pst']) txt(g, ROW_LABEL[bus], px(-0.44), pz(ROWZ[bus]), 19, '#c9d1d9', 'right', 700);
  txt(g, 'NEXT TRANS', px(0.4475), pz(-0.197), 13, '#8b949e');
  txt(g, 'PATTERN', px(0.65), pz(-0.197), 13, '#8b949e');
  txt(g, 'DURÉE', px(0.455), pz(-0.006), 13, '#8b949e');
  txt(g, 'BARRE T', px(TB.x), pz(0.185), 13, '#8b949e');
  txt(g, 'POSITION', px(-0.2525), pz(0.145), 13, '#8b949e');
  txt(g, `ICP-X7000 → ${EQUIP.mixer || 'XVS-6000'}`, px(0.25), pz(0.18), 15, '#6e7781');
}

// ---------------- état : tallys, OLED, menu, levier ----------------
export const lit = (c) => {
  switch (c.t) {
    case 'xpt': {
      if (c.n > mixInputs() || !meSource(c.n)) return -1;
      const on = c.bus === 'pgm' ? MIX.pgm === c.n || (MIX.auto || MIX.pos > 0) && MIX.pst === c.n && MIX.next.bkgd : c.bus === 'pst' ? MIX.pst === c.n : MIX.key1.src === c.n;
      return on ? 1 : 0;
    }
    case 'keycut': case 'keyauto': return MIX.key1.on ? 1 : 0;
    case 'corner': return MIX.key1.corner === c.k ? 0.5 : 0;
    case 'dsk': return (c.n === 1 ? MIX.dsk1 : MIX.dsk2).on ? 1 : 0;
    case 'ftb': return MIX.ftb.on ? 1 : 0;
    case 'store': return MIX.snapStore ? 1 : 0;
    case 'snap': return MIX.snaps && MIX.snaps[c.i] ? 0.5 : 0;
    case 'next': return MIX.next[c.k] ? 1 : 0;
    case 'wipe': return MIX.wipe === c.i ? 0.5 : 0;
    case 'trans': return MIX.trans === c.k ? 1 : 0;
    case 'auto': return MIX.auto ? 1 : 0;
    default: return 0;
  }
};
/** position de la poignée de la barre T (0 = butée du fond, 1 = vers l'opérateur) */
export const leverPos = () => (MIX.auto ? (MIX.tbarDir > 0 ? MIX.pos : 1 - MIX.pos) : MIX.tbar || 0);

export function updateMelangeur3D(dt, force = false) {
  if (!PUP.grp) return;
  // levier : à chaque image (il glisse pendant un AUTO TRANS)
  const v = leverPos();
  PUP.lever.position.z = TB.z0 + (TB.z1 - TB.z0) * v; PUP.lever.rotation.x = (v - 0.5) * 0.7;
  PUP.t += dt; if (!force && PUP.t < 0.1) return; PUP.t = 0;
  const F = PUP.keys;
  for (const c of PUP.ctrls) { const l = lit(c); F.set(c.ki, l < 0 ? 0 : l); }
  F.flush();
  // OLED : nom de la source au-dessus de chaque touche (redessinés quand la grille ou le plan de caméras change)
  const sig = Object.values(ROUTER.map).join(',') + S.cams.map((c) => c.id + c.type).join(',') + mixInputs();
  if (sig !== PUP.sig.oled) {
    PUP.sig.oled = sig;
    PUP.oled.forEach((o) => {
      const g = o.g; g.fillStyle = '#020304'; g.fillRect(0, 0, o.c.width, o.c.height);
      for (let n = 1; n <= NX; n++) {
        const x = (n - 1) * 128 + 64; const used = n <= mixInputs() && !!meSource(n);
        if (!used) { txt(g, String(n), x, 36, 24, '#2a3038'); continue; }
        const [l, sub] = oledName(n);
        txt(g, l, x, 24, 30, '#d8ecff', 'center', 600); txt(g, `${n} · ${sub}`, x, 54, 22, '#7fa6c8', 'center', 500);
      }
      o.dirty();
    });
  }
  const menuSig = [MIX.trans, MIX.wipe, MIX.rate, MIX.next.bkgd, MIX.next.key1, MIX.key1.on, MIX.key1.corner, Math.round(MIX.key1.size * 100), MIX.key1.src, MIX.dsk1.on, MIX.dsk2.on, MIX.ftb.on, S.format, PUP.keyMode()].join('|');
  if (menuSig !== PUP.sig.menu) { PUP.sig.menu = menuSig; drawMenu(PUP.menu); }
  const lcdSig = MIX.rate + '|' + Math.round(leverPos() * 100);
  if (lcdSig !== PUP.sig.lcd) {
    PUP.sig.lcd = lcdSig; const o = PUP.lcd, g = o.g;
    g.fillStyle = '#140c02'; g.fillRect(0, 0, o.c.width, o.c.height);
    txt(g, `${MIX.rate} f`, 18, 50, 54, '#ffb030', 'left', 700); txt(g, `${Math.round(leverPos() * 100)} %`, 270, 50, 40, '#c08020', 'right', 600);
    o.dirty();
  }
}
function drawMenu(o) {
  const g = o.g, W = o.c.width, H = o.c.height;
  g.fillStyle = '#0b1a2c'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#123457'; g.fillRect(0, 0, W, 44);
  txt(g, `M/E 1 · ${EQUIP.mixer || 'XVS-6000'}`, 14, 23, 26, '#cfe6ff', 'left', 700); txt(g, S.format === 'UHD' ? 'UHD 2160p50' : S.format === 'HDi' ? 'HD 1080i50' : 'HD 1080p50', W - 14, 23, 22, '#9ed0ff', 'right', 600);
  const row = (y, k, v, col = '#e8f2ff') => { txt(g, k, 16, y, 22, '#7fa6c8', 'left', 600); txt(g, v, W - 16, y, 24, col, 'right', 700); };
  row(72, 'Transition', `${TRANS[MIX.trans]}${MIX.trans === 'wipe' ? ' · ' + WIPES[MIX.wipe] : ''}`, '#ffd070');
  row(102, 'Durée', `${MIX.rate} images · ${fmt(MIX.rate / frameRate(), 2)} s`);
  row(132, 'Next', [MIX.next.bkgd && 'BKGD', MIX.next.key1 && 'KEY 1'].filter(Boolean).join(' + '));
  row(162, 'KEY 1', `${MIX.key1.on ? 'À L\'ANTENNE' : 'hors antenne'} · ${Math.round(MIX.key1.size * 100)} %`, MIX.key1.on ? '#ff8070' : '#e8f2ff');
  row(192, 'Source clé', sourceLabel(meSource(MIX.key1.src)) || '—');
  row(222, 'DSK 1 · DSK 2', `${MIX.dsk1.on ? 'ON' : 'off'} · ${MIX.dsk2.on ? 'ON' : 'off'}`, MIX.dsk1.on || MIX.dsk2.on ? '#ff8070' : '#e8f2ff');
  row(252, 'FTB', MIX.ftb.on ? 'NOIR' : 'off', MIX.ftb.on ? '#ff8070' : '#e8f2ff');
  rr(g, 12, H - 64, W - 24, 50, 6, '#123457');
  txt(g, 'Touches 1-9 : ' + PUP.keyMode(), W / 2, H - 39, 22, '#cfe6ff', 'center', 600);
  o.dirty();
}

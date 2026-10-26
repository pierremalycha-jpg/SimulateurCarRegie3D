// @ts-check
import { clamp, fmt } from '../util.js';
import { AU, faderLin, startAudio } from '../audio.js';
import { DESK, DESK_GEO, updateAudioDesk } from '../audiodesk.js';
import { AUACT, buildAudio, drawMeters } from '../ui/st_audio.js';
import { el } from '../util.js';
import { monFrame } from './kit.js';

// ----------------------------------------------------------------------------------
// Le poste son en vue 3D (poste3d/index.js) devant la console de la cabine (inspiration Studer Vista 1,
// audiodesk.js) : faders motorisés des 20 tranches et des deux masters (PGM, VCA commentaires), touches SEL,
// PFL et MUTE, sur l'écran Vistonics la molette du bas (GAIN d'entrée) et celle du haut (PAN ou balance), et
// la Control Bay (écoutes, DIM, MONO, talkback maintenu, suivi du jeu, limiteur). Les gestes sont ceux de la
// vue 2D (AUACT, ui/st_audio.js) ; « Tous les réglages » contient la console à plat : couches, égaliseur,
// dynamique, E/S et patch, bus et N-1, snapshots, commentaires.
// ----------------------------------------------------------------------------------
const G = DESK_GEO;
const strips = () => AU.order.map((k) => AU.ch[k]);
const pos = (db) => clamp((db + 60) / 70, 0, 1);
const dbOf = (p) => { const v = Math.round((p * 70 - 60) * 2) / 2; return v <= -59.5 ? -60 : v; };
const fdb = (v) => (v <= -59.5 ? '−∞' : (v > 0 ? '+' : v < 0 ? '−' : '') + fmt(Math.abs(v), 1));
const rect = (c, w, d) => () => [[c[0] - w / 2, c[1], c[2] - d / 2], [c[0] + w / 2, c[1], c[2] - d / 2], [c[0] + w / 2, c[1], c[2] + d / 2], [c[0] - w / 2, c[1], c[2] + d / 2]];
const FADER = (x) => ({ along: [[x, G.FADE.y + 0.012, G.FADE.z0], [x, G.FADE.y + 0.012, G.FADE.z1]], corners: () => [[x - 0.012, G.FADE.y + 0.012, G.FADE.z1 - 0.01], [x + 0.012, G.FADE.y + 0.012, G.FADE.z1 - 0.01], [x + 0.012, G.FADE.y + 0.012, G.FADE.z0 + 0.01], [x - 0.012, G.FADE.y + 0.012, G.FADE.z0 + 0.01]] });
// touches de la Control Bay (repère DESK_GEO.cb) : écoutes, DIM, MONO, talkback, suivi du jeu, limiteur
const CB = [
  ...['pgm', 'intl', 'n1', 'nxs', 'nxb'].map((k, j) => ({ j, name: () => 'Écoute ' + AU.bus[k].label, text: 'Écoute ' + k.toUpperCase(), info: () => `Les haut-parleurs écoutent ${AU.bus[k].label}. Le PFL d'une tranche passe avant tant qu'il est allumé.`, act: () => AUACT.monitor(k), on: () => AU.monitor === k })),
  { j: 5, name: 'DIM', text: 'DIM', info: 'Baisse l\'écoute de 20 dB pour parler dans la cabine, sans toucher à l\'antenne.', act: () => AUACT.dim(), on: () => AU.dim },
  { j: 6, name: 'MONO', text: 'MONO', info: 'Écoute en mono (G + D) : une ambiance en opposition de phase y disparaît.', act: () => AUACT.mono(), on: () => AU.mono },
  ...['n1', 'nxs', 'nxb'].map((k, n) => ({ j: 8 + n, name: () => 'Talkback ' + AU.bus[k].label, text: ['TB COMM', 'TB STUDIO', 'TB BORD T.'][n], info: () => `Maintenir pour parler dans ${AU.bus[k].label} (${AU.bus[k].dest}) avec le micro d'ordres, jamais dans le PGM.`, hold: (on) => AUACT.talkback(k, on) })),
  { j: 11, name: 'Suivi du jeu (canons)', text: 'SUIVI DU JEU', info: 'Assistant du simulateur : les faders des six canons suivent le ballon. Toucher un fader de canon le coupe.', act: () => AUACT.auto(), on: () => AU.autoCanon },
  { j: 12, name: 'Limiteur du PGM', text: 'LIMIT', info: 'Limiteur de sortie du programme (−2 dBFS) contre les crêtes.', act: () => AUACT.lim(), on: () => AU.master.lim },
];

function controls() {
  /** @type {any[]} */
  const list = [];
  strips().slice(0, G.NS).forEach((c, i) => {
    const x = G.SX(i);
    // molettes de l'écran : GAIN (en bas), PAN (en haut)
    const [g0, g1] = AUACT.gainRange(c);
    list.push({ name: () => `${c.short} · GAIN`, aria: 'Gain ' + c.short, knob: true, step: 1 / (g1 - g0), value: () => (c.gain - g0) / (g1 - g0), set: (n) => AUACT.gain(c, Math.round(g0 + n * (g1 - g0))), reset: () => AUACT.gain(c, c.defGain),
      info: () => `Gain d'entrée ${c.kind === 'mic' ? '+' + c.gain + ' dB (préampli micro)' : (c.gain - c.defGain >= 0 ? '+' : '') + (c.gain - c.defGain) + ' dB'}. Le bon niveau d'entrée vient avant tout autre réglage. Glisser, molette de la souris, double-clic = valeur nominale.`, corners: rect(G.knob(i, 0), 0.022, 0.022) });
    list.push({ name: () => `${c.short} · ${c.st ? 'BALANCE' : 'PAN'}`, aria: (c.st ? 'Balance ' : 'Panoramique ') + c.short, knob: true, step: 0.025, value: () => (c.pan + 1) / 2, set: (n) => AUACT.pan(c, Math.round((n * 2 - 1) * 20) / 20), reset: () => AUACT.pan(c, 0),
      info: () => `${c.st ? 'Balance' : 'Panoramique'} : ${Math.abs(c.pan) < 0.01 ? 'au centre' : Math.round(Math.abs(c.pan) * 100) + ' % à ' + (c.pan < 0 ? 'gauche' : 'droite')}. Double-clic = centre.`, corners: rect(G.knob(i, 1), 0.022, 0.022) });
    // fader (les parcours du chef visent la tranche entière de la console 2D, « .vx-strip » : en 3D, ils
    // renvoient au tiroir « Tous les réglages », où sont aussi les touches 48V et Ø)
    list.push({ name: () => `${c.short} · fader`, cls: 'p3d-fader', aria: 'Fader ' + c.short, text: c.short, slider: true, up: true, step: 1 / 140, value: () => pos(c.fader), set: (p) => AUACT.fader(c, dbOf(p)),
      info: () => `${c.label} : ${fdb(c.fader)} dB${faderLin(c) > 0 && c.pgm ? ', à l\'antenne (FaderGlow allumé)' : ''}. Pousser pour monter ; 0 dB = gain unitaire. Flèches pour régler au demi-décibel.`, ...FADER(x) });
    // SEL, PFL, MUTE
    list.push({ name: () => `SEL ${c.short}`, cls: 'vb', text: 'SEL', aria: 'SEL ' + c.short, info: 'Affiche la tranche sur l\'écran de la Control Bay (égaliseur, dynamique, départs : dans « Tous les réglages »).', act: () => AUACT.sel(c), on: () => AU.sel === c.id, corners: rect(G.btn(i, 0), 0.022, 0.013) });
    list.push({ name: () => `PFL ${c.short}`, cls: 'vb', text: 'PFL', aria: 'PFL ' + c.short, info: 'Écoute la tranche seule, avant son fader, sans rien changer à l\'antenne.', act: () => AUACT.pfl(c), on: () => c.pfl, corners: rect(G.btn(i, 1), 0.022, 0.013) });
    list.push({ name: () => `MUTE ${c.short}`, cls: 'vx-mute', text: 'MUTE', aria: 'MUTE ' + c.short, info: 'Coupe la tranche : elle disparaît du programme et de tous les départs.', act: () => AUACT.mute(c), on: () => c.mute, corners: rect(G.btn(i, 2), 0.022, 0.013) });
  });
  // masters : PGM et VCA des commentaires
  list.push({ name: 'Master PGM', aria: 'Fader Master PGM', text: 'Master PGM', slider: true, up: true, step: 1 / 140, value: () => pos(AU.master.fader), set: (p) => AUACT.master(dbOf(p)), info: () => `Master du programme : ${fdb(AU.master.fader)} dB. Il agit sur tout le PGM ; surveillez la loudness (cible −23 LUFS).`, ...FADER(G.masters[0]) });
  list.push({ name: () => AU.vca.comm.label, aria: 'Fader ' + AU.vca.comm.label, text: AU.vca.comm.label, slider: true, up: true, step: 1 / 140, value: () => pos(AU.vca.comm.fader), set: (p) => AUACT.vca('comm', dbOf(p)), info: () => `${AU.vca.comm.label} : ${fdb(AU.vca.comm.fader)} dB. Un VCA règle d'un geste le gain de toutes ses tranches, sans mélanger le son.`, ...FADER(G.masters[1]) });
  for (const k of CB) list.push({ ...k, cls: 'hw', corners: rect(G.cb(k.j), 0.026, 0.016) });
  return list;
}

// vues : œil et point visé dans le repère de la console (x : largeur, z : vers l'opérateur)
const VIEWS = [
  { id: 'poste', label: 'Le poste', eye: [0.0, 0.72, 0.5], look: [0.0, 0.04, -0.24], fov: 55 },
  { id: 'faders', label: 'Faders', eye: [0.0, 0.72, 0.3], look: [0.0, 0.03, -0.22], fov: 58 },
  { id: 'ecrans', label: 'Écrans Vistonics', eye: [-0.1, 0.56, 0.3], look: [-0.1, 0.17, -0.42], fov: 56 },
  { id: 'cbay', label: 'Control Bay', eye: [0.42, 0.4, 0.2], look: [0.42, 0.1, -0.3], fov: 46 },
];
const ZONES = [
  { id: 'faders', at: [-0.3, 0.12, -0.12], view: 'faders', title: 'Les faders et la FaderGlow',
    text: ['Vingt tranches (couche A : les sources) puis, à droite, le **master PGM** et le **VCA des commentaires**. Les faders sont motorisés : ils suivent les snapshots et l\'assistant de suivi du jeu.', 'La **FaderGlow** (bande lumineuse) prend la couleur du groupe de la tranche et s\'allume quand elle part à l\'antenne.', 'Derrière chaque fader : **SEL** (la tranche sur l\'écran de la Control Bay), **PFL** (l\'écouter seule), **MUTE** (la couper).'] },
  { id: 'ecrans', at: [-0.2, 0.3, -0.42], view: 'ecrans', title: 'Les écrans Vistonics',
    text: ['Au-dessus de chaque tranche, son écran porte ses molettes : en bas le **GAIN** d\'entrée (anneau blanc ; le rouge montre l\'égaliseur), en haut le **PAN** (anneau jaune ; le vert montre la compression).', 'Les autres vues de l\'écran (égaliseur, dynamique, départs) sont dans « Tous les réglages ».'] },
  { id: 'cbay', at: [0.42, 0.22, -0.3], view: 'cbay', title: 'La Control Bay',
    text: ['L\'écran de la tranche sélectionnée (SEL), la loudness intégrée (cible −23 LUFS, EBU R128) et les vumètres du PGM.', 'Les touches : l\'**écoute** (PGM, international, N-1), **DIM**, **MONO**, le **talkback** maintenu vers un N-1, le **suivi du jeu** des canons et le **limiteur** du PGM.'] },
];
const INTRO = { title: 'La console de la régie son', text: ['Une console inspirée de la **Studer Vista 1** : deux baies Vistonics de dix tranches, la Control Bay à droite, le pont de vumètres au fond.', 'Survolez une commande : son nom et son rôle s\'affichent. Faders : tirer vers le haut ou le bas ; molettes : glisser ou molette de la souris, double-clic pour revenir à la valeur nominale. Glissez pour tourner autour du pupitre, clic droit (ou Maj + glisser) pour le déplacer, molette pour vous approcher ; double-clic pour revenir à la vue.', 'À droite, en direct : l\'image du programme, les vumètres, la corrélation et la loudness.', '« Tous les réglages » ouvre la console à plat : couches, égaliseur, dynamique, patch, bus et N-1, snapshots, commentaires.'] };

export const POSTE_SON = {
  id: 'son',
  ready: () => !!DESK.group,
  root: () => DESK.group, deck: () => DESK.group,
  views: VIEWS, zones: ZONES, intro: INTRO, detailView: 'faders',
  controls, controlsSig: () => AU.order.join(','),
  hover() {},
  /** les écrans de la régie son, en direct dans le panneau de droite : l'image du programme, les vumètres et la loudness */
  monitors(host) {
    const cv = el('canvas', { width: 440, height: 150, class: 'vx-bridge p3d-meters', 'aria-label': 'Vumètres du programme, des départs, corrélation et loudness' });
    const lufs = el('div', { class: 'lcd amber vx-lufs' });
    const start = el('button', { class: 'btn primary small', type: 'button', 'data-ro-ok': '', onclick: () => startAudio() }, 'Activer le son');
    host.append(monFrame('PGM', 'Programme (image à l\'antenne)', 'big'), el('div', { class: 'p3d-mon' }, el('div', { class: 'lab' }, 'Vumètres et loudness (Control Bay)'), cv, el('div', { class: 'hwrow' }, lufs, start)));
    let t = 0;
    return { frame(dt) { t += dt || 0.016; if (t < 0.033) return; t = 0; drawMeters(cv); }, update() { const L = AU.lufs; start.hidden = !!AU.ctx; lufs.textContent = AU.ctx ? `M ${fmt(L.m, 1)} · S ${fmt(L.s, 1)} · I ${fmt(L.i, 1)} LUFS` : 'Son désactivé'; } };
  },
  drawer: { label: 'Tous les réglages', note: 'La console à plat : couches, égaliseur, dynamique, patch, bus et N-1, snapshots, commentaires', build: (host, arg, ctx) => buildAudio(host, arg, ctx) },
  legend: () => 'Faders : tirer · molettes : glisser ou molette de la souris, double-clic = valeur nominale · talkback : maintenir.',
  update(dt) { updateAudioDesk(AU, dt, faderLin); },
};

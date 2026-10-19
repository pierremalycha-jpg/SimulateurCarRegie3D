// @ts-check
import { S } from '../state.js';
import { el, fmt } from '../util.js';
import { modal, toast, openInfo } from './common.js';
import { LINKS, FORMATS } from '../data/cameras.js';
import { ROUTER, MIX, EVS, meSource, sourceLabel, tallyOf } from '../pipeline.js';
import { EQUIP, evsLayout, mixInputs } from '../equip.js';
import { NET, flowGbps } from '../ipnet.js';
import { FAB, LEAVES, vlanOf } from '../net/fabric.js';
import { AU, SOUND_PLAN, soundPlanOk, embLabel, avOk, avOffsetMs } from '../audio.js';
import { RACKS, RACK_ROWS } from '../truck.js';
import { CFG, offerDownload } from '../shared.js';
import { openDevice } from '../equipment/viewer.js';
import { planSVG } from './truckmap.js';

// ----------------------------------------------------------------------------------
// Synoptiques techniques du car, générés à partir de l'état réel de l'installation :
// vidéo, synchronisation, audio, intercom et tally, réseaux, énergie, élévation des baies,
// implantation. Rouge = défaut ou à l'antenne, vert = préparé, orange = alerte.
// ----------------------------------------------------------------------------------
const NS = 'http://www.w3.org/2000/svg';
const COL = {
  video: ['#46c6f2', '#0a6f9a'], fiber: ['#ff8a1f', '#c25a00'], ref: ['#ffd23f', '#a07800'], audio: ['#7ee081', '#1f8a2f'],
  comms: ['#c77dff', '#7a2fc0'], data: ['#ff9f6a', '#b5531f'], ip: ['#2fd6c8', '#0b8a80'], power: ['#ff5a5a', '#c01818'], rf: ['#d65cf2', '#9a1fb0'], tally: ['#ff3b30', '#c01818'],
};
const SIG_LABEL = { video: 'Vidéo SDI', fiber: 'Fibre caméra (SMPTE / monomode)', ref: 'Référence (BB / tri-level) · timecode', audio: 'Audio (MADI, Dante, AES)', comms: 'Intercom (4 fils, AES67)', data: 'Commande (RS-422, série)', ip: 'Réseau IP (Ethernet, ST 2110)', power: 'Énergie 230/400 V', rf: 'Radiofréquence (HF)', tally: 'Tally (GPI, TSL)' };
const STYLE = `
.syn{font-family:'Barlow Condensed','Arial Narrow',sans-serif}
.syn .bg{fill:#0e1318}
.syn .zone{fill:rgba(255,255,255,0.025);stroke:#3a4652;stroke-dasharray:6 5}
.syn .zl{fill:#8a98a5;font-size:13px;font-weight:700;letter-spacing:.08em}
.syn .bx rect.f{fill:#18212a;stroke:#4a5866;stroke-width:1.3}
.syn .bx .t{fill:#eef2f5;font-size:13px;font-weight:700}
.syn .bx .s{fill:#9fb0be;font-size:11px;font-family:Barlow,'Segoe UI',sans-serif}
.syn .bx.err rect.f{stroke:#ff3b30;stroke-width:2.6;fill:#2a1416}
.syn .bx.warn rect.f{stroke:#ffb020;stroke-width:2.4}
.syn .bx.pgm rect.f{stroke:#ff3b30;stroke-width:3.2}
.syn .bx.pvw rect.f{stroke:#2fd25a;stroke-width:3.2}
.syn .bx.ok rect.f{stroke:#2fd25a}
.syn .bx.off{opacity:.45}
.syn .bx.big rect.f{fill:#1b2633}
.syn .bx.ext rect.f{fill:#121a22;stroke-dasharray:5 4}
.syn .bx[data-dev],.syn .bx[data-info]{cursor:pointer}
.syn .bx[data-dev]:hover rect.f{stroke:#ffb020}
.syn .badge{font-size:10px;font-weight:700}
.syn .w{fill:none;stroke-width:1.8;stroke-linejoin:round}
.syn .w.bundle{stroke-width:4.5}
.syn .w.dash{stroke-dasharray:7 5}
.syn .w.bad{stroke:#ff3b30;stroke-dasharray:3 3}
.syn .w.act{stroke-width:3.4}
.syn .wl{font-size:10.5px;fill:#cdd6de;font-family:Barlow,'Segoe UI',sans-serif}
.syn .wlb{fill:#0e1318;opacity:.88}
.syn .ttl{fill:#ffb020;font-size:21px;font-weight:700;letter-spacing:.04em}
.syn .sub{fill:#93a0ab;font-size:12px;font-family:Barlow,'Segoe UI',sans-serif}
.syn .note{fill:#93a0ab;font-size:11.5px;font-family:Barlow,'Segoe UI',sans-serif}
.syn .cart rect{fill:#121a22;stroke:#4a5866}
.syn .cart text{fill:#cdd6de;font-size:11px;font-family:Barlow,'Segoe UI',sans-serif}
.syn .cart .k{fill:#8a98a5}
.syn .ru{fill:#5f6d7a;font-size:9px;font-family:Barlow,sans-serif}
${Object.entries(COL).map(([k, [d]]) => `.syn .c-${k}{stroke:${d}} .syn .m-${k}{fill:${d}}`).join('\n')}
.syn.paper .bg{fill:#ffffff}
.syn.paper .zone{fill:rgba(0,0,0,0.02);stroke:#9aa4ad}
.syn.paper .zl{fill:#5a6672}
.syn.paper .bx rect.f{fill:#f6f8fa;stroke:#4a5560}
.syn.paper .bx .t{fill:#10161c}
.syn.paper .bx .s{fill:#4a5560}
.syn.paper .bx.err rect.f{fill:#ffe9e7;stroke:#d72a22}
.syn.paper .bx.warn rect.f{stroke:#d98a00}
.syn.paper .bx.pgm rect.f{stroke:#d72a22}
.syn.paper .bx.pvw rect.f{stroke:#1f9a45}
.syn.paper .bx.ok rect.f{stroke:#1f9a45}
.syn.paper .bx.big rect.f{fill:#eef2f6}
.syn.paper .bx.ext rect.f{fill:#ffffff}
.syn.paper .wl{fill:#22303c}
.syn.paper .wlb{fill:#ffffff}
.syn.paper .ttl{fill:#b36b00}
.syn.paper .sub,.syn.paper .note{fill:#4a5560}
.syn.paper .cart rect{fill:#ffffff;stroke:#4a5560}
.syn.paper .cart text{fill:#10161c}
${Object.entries(COL).map(([k, [, p]]) => `.syn.paper .c-${k}{stroke:${p}} .syn.paper .m-${k}{fill:${p}}`).join('\n')}
`;

function E(tag, attrs = {}, text) { const e = document.createElementNS(NS, tag); for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]); if (text != null) e.textContent = text; return e; }

// ---------------- moteur de schéma ----------------
function diagram(W, H, title, sub) {
  const svg = E('svg', { viewBox: `0 0 ${W} ${H}`, class: 'syn', role: 'img', 'aria-label': title, xmlns: NS });
  svg.append(E('style', {}, STYLE));
  const defs = E('defs');
  for (const k of Object.keys(COL)) { const m = E('marker', { id: 'a-' + k, viewBox: '0 0 8 8', refX: 7.2, refY: 4, markerWidth: 10, markerHeight: 10, markerUnits: 'userSpaceOnUse', orient: 'auto-start-reverse' }); m.append(E('path', { d: 'M0,0 L8,4 L0,8 z', class: 'm-' + k })); defs.append(m); }
  svg.append(defs, E('rect', { x: 0, y: 0, width: W, height: H, class: 'bg' }));
  const gZ = E('g'), gW = E('g'), gB = E('g'), gL = E('g');
  svg.append(gZ, gW, gB, gL);
  gL.append(E('text', { x: 20, y: 32, class: 'ttl' }, title), E('text', { x: 20, y: 52, class: 'sub' }, sub));
  const boxes = {}; const used = new Set();
  const D = {
    svg, W, H, boxes,
    zone(x, y, w, h, label) { gZ.append(E('rect', { x, y, width: w, height: h, rx: 8, class: 'zone' }), E('text', { x: x + 10, y: y + 18, class: 'zl' }, label.toUpperCase())); },
    box(id, x, y, w, h, title, lines = [], o = {}) {
      const g = E('g', { class: 'bx ' + (o.cls || ''), 'data-dev': o.dev || null, 'data-n': o.n || null, 'data-info': o.info || null });
      g.append(E('rect', { x, y, width: w, height: h, rx: 5, class: 'f' }));
      if (o.tip) g.append(E('title', {}, o.tip));
      const one = !lines.length;
      g.append(E('text', { x: x + 9, y: one && !o.top ? y + h / 2 + 4.5 : y + 17, class: 't' }, title));
      lines.forEach((l, i) => g.append(E('text', { x: x + 9, y: y + 32 + i * 14, class: 's' }, l)));
      if (o.badge) { const [bt, bc] = o.badge; const bw = bt.length * 6.4 + 10; g.append(E('rect', { x: x + w - bw - 5, y: y + 5, width: bw, height: 15, rx: 3, fill: bc }), E('text', { x: x + w - bw / 2 - 5, y: y + 16, 'text-anchor': 'middle', class: 'badge', fill: '#fff' }, bt)); }
      gB.append(g);
      boxes[id] = { x, y, w, h };
      return boxes[id];
    },
    // point d'accroche : côté l/r/t/b, position relative 0..1
    p(id, side, t = 0.5) { const b = boxes[id]; if (!b) return [0, 0]; return side === 'l' ? [b.x, b.y + b.h * t] : side === 'r' ? [b.x + b.w, b.y + b.h * t] : side === 't' ? [b.x + b.w * t, b.y] : [b.x + b.w * t, b.y + b.h]; },
    // liaison orthogonale (h : horizontal puis vertical puis horizontal ; v : l'inverse)
    wire(a, b, sig, o = {}) {
      used.add(sig);
      let d;
      if (o.d) d = o.d;
      else if (o.mode === 'v') { const ym = o.m ?? (a[1] + b[1]) / 2; d = `M${a[0]},${a[1]} V${ym} H${b[0]} V${b[1]}`; }
      else if (o.mode === 'straight') d = `M${a[0]},${a[1]} L${b[0]},${b[1]}`;
      else { const xm = o.m ?? (a[0] + b[0]) / 2; d = `M${a[0]},${a[1]} H${xm} V${b[1]} H${b[0]}`; }
      const cls = ['w', 'c-' + sig, o.bundle ? 'bundle' : '', o.dash ? 'dash' : '', o.bad ? 'bad' : '', o.act ? 'act' : ''].join(' ');
      gW.append(E('path', { d, class: cls, 'marker-end': o.noArrow ? null : `url(#a-${sig})`, 'marker-start': o.both ? `url(#a-${sig})` : null }));
      if (o.label) {
        const lx = o.lx ?? (o.mode === 'v' ? (a[0] + b[0]) / 2 : (o.m ?? (a[0] + b[0]) / 2)), ly = o.ly ?? (o.mode === 'v' ? (o.m ?? (a[1] + b[1]) / 2) : (a[1] + b[1]) / 2);
        D.wlabel(lx, ly, o.label);
      }
    },
    raw(node) { gB.append(node); },
    wlabel(x, y, text) { const w = text.length * 5.6 + 8; gL.append(E('rect', { x: x - w / 2, y: y - 8, width: w, height: 14, rx: 3, class: 'wlb' }), E('text', { x, y: y + 3.5, 'text-anchor': 'middle', class: 'wl' }, text)); },
    note(x, y, lines, cls = 'note') { (Array.isArray(lines) ? lines : [lines]).forEach((l, i) => gL.append(E('text', { x, y: y + i * 15, class: cls }, l))); },
    legend(x, y) {
      const list = [...used];
      gL.append(E('text', { x, y, class: 'zl' }, 'LÉGENDE'));
      list.forEach((k, i) => { const yy = y + 16 + i * 17; gL.append(E('path', { d: `M${x},${yy} H${x + 34}`, class: `w c-${k}`, 'marker-end': `url(#a-${k})` }), E('text', { x: x + 42, y: yy + 4, class: 'wl' }, SIG_LABEL[k])); });
      const yy = y + 22 + list.length * 17;
      gL.append(E('text', { x, y: yy + 4, class: 'wl' }, 'Cadre rouge : défaut ou source à l\'antenne · vert : préparée'), E('text', { x, y: yy + 19, class: 'wl' }, 'Orange : alerte · pointillés : secours ou liaison HF · trait épais : faisceau'));
      return yy + 15;
    },
    cartouche(name) {
      const w = 330, h = 74, x = W - w - 14, y = H - h - 14;
      const g = E('g', { class: 'cart' }); g.append(E('rect', { x, y, width: w, height: h, rx: 4 }));
      const rows = [['Car', (CFG.car && CFG.car.name) || EQUIP.truck || 'Car régie'], ['Document', name], ['Format', `${FORMATS[S.format].label} · ${S.ipMode ? 'ST 2110 (IP)' : FORMATS[S.format].sdi}`], ['Généré', new Date().toLocaleString('fr-FR') + ' · simulateur']];
      rows.forEach(([k, v], i) => { g.append(E('text', { x: x + 10, y: y + 17 + i * 16, class: 'k' }, k), E('text', { x: x + 80, y: y + 17 + i * 16 }, String(v).slice(0, 44))); });
      gL.append(g);
    },
  };
  return D;
}

// ---------------- aides d'état ----------------
const camState = (c) => (!c.signalOK || c.fiberCut ? 'err' : !c.genlock ? 'warn' : '');
const tallyCls = (src) => { const t = tallyOf(src); return t === 2 ? 'pgm' : t === 1 ? 'pvw' : ''; };
const isHF = (c) => c.link === 'hf';
const ccuLabel = (c) => {
  if (isHF(c)) return ['Récepteur HF ' + c.id, 'décodeur + synchro de trame', 'rx'];
  if (c.T.model === 'pov') return ['Convertisseur ' + c.id, 'fibre → SDI (mini-caméra)', 'conv'];
  if (c.T.model === 'ptz') return ['Contrôle PTZ ' + c.id, c.link === 'ip' ? 'flux IP → passerelle' : 'SDI + commande', 'conv'];
  return ['CCU ' + c.id + ' · HDCU-5500', c.T.hfr > 1 ? `HFR ×${c.T.hfr} (${c.T.hfr} phases)` : 'voie caméra', 'ccu'];
};
const linkSig = (c) => (isHF(c) ? 'rf' : c.link === 'coax' ? 'video' : c.link === 'ip' ? 'ip' : 'fiber');

// ---------------- 1. vidéo ----------------
function videoDiagram() {
  const cams = S.cams; const n = Math.max(cams.length, 6);
  const rowH = 36, top = 96;
  const H = Math.max(860, top + n * rowH + 300), W = 1560;
  const ip = S.ipMode;
  const D = diagram(W, H, 'Synoptique vidéo', `${cams.length} caméras · ${EQUIP.mixer} (${mixInputs()} entrées) · ${evsLayout().label} · ${ip ? 'grille IP ST 2110 (réseaux rouge et bleu)' : 'grille SDI'}`);
  D.zone(10, 70, 210, n * rowH + 40, 'Stade');
  D.zone(290, 70, 210, n * rowH + 40, ip ? 'Voies caméras (sorties IP)' : 'Baie CCU · réception');
  D.zone(520, 70, 130, n * rowH + 40, ip ? 'Cœur IP' : 'Grille');
  D.zone(680, 70, 400, H - 230, 'Production et traitement');
  D.zone(1100, 70, 450, H - 230, 'Sorties · transmission');
  const pgm = meSource(MIX.pgm), pst = meSource(MIX.pst);
  cams.forEach((c, i) => {
    const y = top + i * rowH;
    const st = camState(c); const tc = tallyCls('CAM' + c.id);
    D.box('cam' + c.id, 20, y, 190, 28, `CAM ${c.id} · ${c.T.short}`, [], { cls: st || tc, dev: 'cam', n: c.id, tip: `${c.T.label} · ${c.L.name} · ${LINKS[c.link].label}`, badge: tc === 'pgm' ? ['PGM', '#d72a22'] : tc === 'pvw' ? ['PVW', '#1f9a45'] : null });
    const [t, s2, dev] = ccuLabel(c);
    D.box('ccu' + c.id, 300, y, 190, 28, t, [], { cls: st, dev, n: c.id, tip: s2 });
    const len = c.route ? Math.round(c.route.length) + ' m' : '';
    D.wire(D.p('cam' + c.id, 'r'), D.p('ccu' + c.id, 'l'), linkSig(c), { dash: isHF(c), bad: c.fiberCut || (isHF(c) && !c.signalOK), label: isHF(c) ? 'HF' : `${LINKS[c.link].short} ${len}`, m: 255, lx: 255 });
  });
  // grille / cœur IP
  const gy = top - 6, gh = n * rowH + 6;
  const netBad = ip && (!NET.red || !NET.blue || !NET.nmos);
  D.box('router', 530, gy, 110, gh, ip ? 'ST 2110' : 'GRILLE', ip ? ['rouge + bleu', `${fmt(flowGbps(), 1)} Gb/s / flux`, NET.nmos ? 'NMOS OK' : 'NMOS HS'] : ['3G/12G', '144 × 144', 'salvos'], { cls: 'big ' + (netBad ? 'warn' : ''), dev: ip ? 'swred' : 'router' });
  cams.forEach((c, i) => { const y = top + i * rowH + 14; D.wire([490, y], [530, y], ip ? 'ip' : 'video', { mode: 'straight' }); });
  // traitement
  const X = 700, BW = 360;
  D.box('mixer', X, 100, BW, 76, `Mélangeur ${EQUIP.mixer}`, [`Pupitre ${EQUIP.mixPanel} · ${mixInputs()} entrées utilisées`, `PGM : ${sourceLabel(pgm)} · PST : ${sourceLabel(pst)}${MIX.dsk1.on ? ' · DSK habillage' : ''}`, 'Sorties : PGM, CLEAN, PVW, multiviewers intégrés'], { cls: 'big', dev: 'mixer' });
  const evs = evsLayout();
  D.box('evs', X, 200, BW, 76, `Serveur EVS ${EQUIP.evsModel}${EQUIP.evsServers > 1 ? ' ×' + EQUIP.evsServers : ''}`, [`${evs.rec} entrées REC · ${evs.plays} sorties PLAY (PGM1${evs.plays > 1 ? ', PGM2' : ''})`, `LSM ×${EQUIP.lsmCount} (RS-422) · IPDirector (XNet)`, EVS.recording ? 'Enregistrement en cours' : 'ENREGISTREMENT ARRÊTÉ'], { cls: EVS.recording ? '' : 'err', dev: 'evs' });
  D.box('gfx', X, 300, 170, 50, 'Habillage', ['fill + key → DSK'], { dev: 'gfx' });
  D.box('mv', X + 190, 300, 170, 50, 'Multiviewers', ['18 tuiles · UMD + tally'], { cls: ip && NET.mvSat ? 'err' : '', dev: 'mv' });
  D.box('walls', X + 190, 380, 170, 50, 'Murs d\'écrans', ['production · vision · son'], { cls: 'ext' });
  D.box('grade1', X, 380, 170, 50, 'Grade 1 + scopes', [`vision : ${sourceLabel(ROUTER.map.AUX_VISION)}`], { dev: 'grade1' });
  const rx = 640; // bord droit de la grille
  const rIn = (y) => [rx, y];
  D.wire(rIn(119), D.p('mixer', 'l', 0.25), ip ? 'ip' : 'video', { bundle: true, mode: 'straight' }); D.wlabel(668, 109, `${mixInputs()} entrées`);
  D.wire(D.p('mixer', 'l', 0.8), rIn(161), ip ? 'ip' : 'video', { bundle: true, mode: 'straight' }); D.wlabel(668, 172, 'PGM CLN PVW');
  D.wire(rIn(219), D.p('evs', 'l', 0.25), ip ? 'ip' : 'video', { bundle: true, mode: 'straight' }); D.wlabel(668, 209, `REC 1-${evs.rec}`);
  D.wire(D.p('evs', 'l', 0.8), rIn(261), ip ? 'ip' : 'video', { mode: 'straight' }); D.wlabel(668, 271, 'PLAY');
  D.wire(D.p('gfx', 'l', 0.5), rIn(325), ip ? 'ip' : 'video', { label: 'fill/key', m: 670 });
  D.wire(rIn(350), [X + 190, 325 + 20], ip ? 'ip' : 'video', { bundle: true, d: `M${rx},350 H680 V364 H${X + 180} V325 H${X + 190}` });
  D.wlabel(X + 120, 364, 'MV 1-18');
  D.wire(D.p('mv', 'b'), D.p('walls', 't'), ip ? 'ip' : 'video', { mode: 'v' });
  D.wire(rIn(400), D.p('grade1', 'l'), ip ? 'ip' : 'video', { label: 'AUX vision', m: 665 });
  // sorties
  const OX = 1120;
  const txA = S.txPath === 1, tx1Bad = !!S.faults.tx;
  D.box('emb', OX, 100, 160, 50, 'Embedder audio', ['plan de son ' + (soundPlanOk() ? 'conforme' : 'NON CONFORME')], { cls: soundPlanOk() ? '' : 'err', dev: 'emb' });
  D.box('tx1', OX + 190, 100, 220, 50, 'TX1 · encodeur JPEG XS', [`fibre opérateur${tx1Bad ? ' · COUPÉE' : ''}`], { cls: tx1Bad ? 'err' : txA ? 'ok' : '', dev: 'tx1' });
  D.box('tx2', OX + 190, 170, 220, 50, 'TX2 · HEVC + DSNG', ['satellite (secours)'], { cls: !txA ? 'ok' : '', dev: 'tx2' });
  D.box('mcr', OX + 190, 250, 220, 44, 'Chaîne (régie finale)', [], { cls: 'ext' });
  D.box('dec', OX, 250, 160, 44, 'Décodeurs', ['retour antenne · duplex'], { dev: 'tx2' });
  D.box('giant', OX, 330, 160, 44, 'Écrans d\'angle ×2', [`stade · ${sourceLabel(ROUTER.map.AUX_GIANT)}`], { cls: 'ext', dev: 'giant' });
  D.wire(rIn(130), D.p('emb', 'l'), ip ? 'ip' : 'video', { label: `AUX TX1 : ${sourceLabel(ROUTER.map.AUX_TX1)}`, m: 1095, lx: 1000, ly: 92, d: `M${rx},130 H675 V88 H1095 V125 H${OX}` });
  D.wire(D.p('emb', 'r'), D.p('tx1', 'l'), 'video', { act: txA, bad: tx1Bad });
  D.wire(rIn(140), D.p('tx2', 'l'), ip ? 'ip' : 'video', { d: `M${rx},140 H672 V84 H1100 V195 H${OX + 190}` });
  D.wlabel(1050, 195, `AUX TX2 : ${sourceLabel(ROUTER.map.AUX_TX2)}`);
  D.wire(D.p('tx1', 'b', 0.3), D.p('mcr', 't', 0.3), 'fiber', { mode: 'v', act: txA, bad: tx1Bad, d: `M${OX + 256},150 V160 H${OX + 236} V250` });
  D.wire(D.p('tx2', 'b', 0.7), D.p('mcr', 't', 0.7), 'rf', { mode: 'v', dash: true, act: !txA });
  D.wire(D.p('mcr', 'l'), D.p('dec', 'r'), 'video', { dash: true, label: 'retour', lx: OX + 175, ly: 262 });
  D.wire(D.p('dec', 'l'), rIn(440), ip ? 'ip' : 'video', { label: 'RETOUR ANT. · STUDIO', d: `M${OX},272 H1090 V440 H${rx}`, lx: 900, ly: 440 });
  D.wire(rIn(460), D.p('giant', 'l'), 'fiber', { label: 'AUX écran géant (fibre)', d: `M${rx},460 H1095 V352 H${OX}`, lx: 900, ly: 460 });
  const ly = D.legend(OX, 420);
  D.note(OX, ly + 30, ['Toutes les sources entrent dans la grille ; mélangeur, EVS,', 'multiviewers, départs et moniteurs reçoivent ce que la grille', 'leur envoie. Cliquez un bloc pour voir l\'appareil.']);
  D.cartouche('Synoptique vidéo');
  return D;
}

// ---------------- 2. synchronisation ----------------
function syncDiagram() {
  const W = 1500, H = 820, ip = S.ipMode;
  const cams = S.cams;
  const D = diagram(W, H, 'Synoptique synchronisation (référence et timecode)', ip ? 'Car IP : PTP (SMPTE ST 2059-2) distribué par les commutateurs ; les appareils SDI restent sur black burst / tri-level' : 'Référence analogique : black burst (625 lignes) et tri-level (HD / UHD) depuis le SPG, distribuée par des DA');
  D.zone(10, 70, 380, 560, 'Génération');
  D.zone(410, 70, 300, 560, 'Distribution');
  D.zone(730, 70, 760, 560, 'Équipements verrouillés');
  const gps = !S.faults.gps;
  D.box('gps', 30, 110, 150, 44, 'Antenne GPS', ['toit du car'], { cls: gps ? '' : 'err' });
  D.box('spg1', 30, 190, 160, 64, 'SPG principal', [gps ? 'verrouillé GPS' : 'HOLDOVER (GPS perdu)', 'BB · tri-level · LTC'], { cls: gps ? 'ok' : 'warn', dev: 'spg' });
  D.box('spg2', 30, 280, 160, 54, 'SPG de secours', ['asservi au principal'], { dev: 'spg', n: 2 });
  D.box('chg', 220, 230, 150, 54, 'Commutateur auto', ['bascule sans coupure'], { dev: 'spg' });
  D.box('ltc', 30, 370, 160, 50, 'Générateur timecode', ['LTC + horloges'], { dev: 'spg' });
  D.wire(D.p('gps', 'b'), D.p('spg1', 't', 0.3), 'rf', { mode: 'v', dash: true, bad: !gps });
  D.wire(D.p('spg1', 'r'), D.p('chg', 'l', 0.3), 'ref', {});
  D.wire(D.p('spg2', 'r'), D.p('chg', 'l', 0.75), 'ref', { dash: true });
  D.wire(D.p('spg1', 'b', 0.8), D.p('ltc', 't', 0.8), 'ref', { mode: 'v', d: `M158,254 V262 H210 V360 H158 V370` });
  const das = [['da1', 'DA black burst 1', 'CCU, grille'], ['da2', 'DA black burst 2', 'EVS, convertisseurs'], ['da3', 'DA tri-level 1', `XVS, multiviewers`], ['da4', 'DA tri-level 2', 'embedders, encodeurs']];
  das.forEach(([id, t, s2], i) => { D.box(id, 440, 100 + i * 90, 240, 52, t, ['→ ' + s2], { dev: 'da', n: i + 1 }); D.wire(D.p('chg', 'r'), D.p(id, 'l'), 'ref', { m: 400 }); });
  // équipements
  const ok = cams.filter((c) => c.genlock).length;
  const lost = cams.filter((c) => !c.genlock);
  D.box('ccus', 760, 100, 330, 70, `CCU ×${cams.filter((c) => !isHF(c)).length} (REF IN)`, [`${ok} / ${cams.length} caméras verrouillées`, lost.length ? 'NON VERROUILLÉES : ' + lost.map((c) => 'CAM ' + c.id).join(', ') : 'genlock OK partout', S.patch.on ? 'référence brassée à la baie de brassage' : 'référence en boucle CCU à CCU'], { cls: lost.length ? 'err' : 'ok', dev: 'ccu' });
  D.box('rtr', 760, 190, 160, 44, 'Grille', ['commutation au top image'], { dev: 'router' });
  D.box('xvs', 940, 190, 150, 44, EQUIP.mixer, ['REF IN (boucle)'], { dev: 'mixer' });
  D.box('evs', 760, 260, 160, 50, EQUIP.evsModel, ['genlock + LTC'], { dev: 'evs' });
  D.box('mvs', 940, 260, 150, 50, 'Multiviewers', ['référence'], { dev: 'mv' });
  D.box('rxs', 760, 340, 160, 50, 'Récepteurs HF', ['synchro de trame'], { dev: 'rx' });
  D.box('emb', 940, 340, 150, 50, 'Embedders · encodeurs', ['référence'], { dev: 'emb' });
  D.box('gfx', 760, 420, 160, 50, 'Habillage', ['référence + horloge'], { dev: 'gfx' });
  D.box('ipd', 940, 420, 150, 50, 'IPDirector · scripte', ['timecode'], { dev: 'ipd' });
  D.wire(D.p('da1', 'r'), D.p('ccus', 'l', 0.4), 'ref', { m: 720 });
  D.wire(D.p('da1', 'r'), D.p('rtr', 'l'), 'ref', { m: 720 });
  D.wire(D.p('da2', 'r'), D.p('evs', 'l'), 'ref', { m: 725 });
  D.wire(D.p('da2', 'r'), D.p('rxs', 'l'), 'ref', { m: 725 });
  D.wire(D.p('da3', 'r'), D.p('xvs', 'b', 0.2), 'ref', { d: `M680,306 H730 V244 H968` });
  D.wire(D.p('da3', 'r'), D.p('mvs', 'l'), 'ref', { d: `M680,306 H930 V285 H940` });
  D.wire(D.p('da4', 'r'), D.p('emb', 'l'), 'ref', { m: 930 });
  D.wire(D.p('da4', 'r'), D.p('gfx', 'l'), 'ref', { m: 735 });
  D.wire(D.p('ltc', 'r'), D.p('ipd', 'b'), 'ref', { dash: true, d: `M190,395 H390 V600 H1015 V470` });
  D.wlabel(700, 600, 'timecode LTC (EVS, IPDirector, habillage, horloges)');
  if (ip) {
    D.zone(1110, 70, 380, 560, 'PTP (car IP)');
    const ga = (c) => (FAB.res && FAB.res.gmActive[c]) || null;
    const gmTxt = (g) => { const r = ga('red'), b = ga('blue'); const on = [r && r.id === 'gm' + g ? 'rouge' : '', b && b.id === 'gm' + g ? 'bleu' : ''].filter(Boolean); return on.length ? `ÉLU (${on.join(' + ')})` : 'en attente'; };
    D.box('gm1', 1130, 100, 160, 54, 'Grand maître 1', [NET.gm1 ? gmTxt(1) : 'PERDU'], { cls: NET.gm1 ? (gmTxt(1) !== 'en attente' ? 'ok' : '') : 'err', dev: 'spg' });
    D.box('gm2', 1310, 100, 160, 54, 'Grand maître 2', [NET.gm2 ? gmTxt(2) : 'PERDU'], { cls: NET.gm2 ? (gmTxt(2) !== 'en attente' ? 'ok' : '') : 'err', dev: 'spg', n: 2 });
    D.box('swr', 1130, 220, 160, 54, 'Fabric rouge', [ga('red') && ga('red').rogue ? 'GM NON TRAÇABLE !' : 'spines + leaves en BC'], { cls: NET.redState === 'down' || (ga('red') && ga('red').rogue) ? 'err' : NET.redState === 'degraded' ? 'warn' : '', dev: 'swred' });
    D.box('swb', 1310, 220, 160, 54, 'Fabric bleue', [ga('blue') && ga('blue').rogue ? 'GM NON TRAÇABLE !' : 'spines + leaves en BC'], { cls: NET.blueState === 'down' || (ga('blue') && ga('blue').rogue) ? 'err' : NET.blueState === 'degraded' ? 'warn' : '', dev: 'swblue' });
    D.box('fol', 1130, 340, 340, 64, 'Appareils ST 2110 (suiveurs PTP)', ['CCU IP, passerelles, XVS, EVS, multiviewers', 'chaque appareil reçoit PTP par ses deux interfaces']);
    D.wire(D.p('gm1', 'b'), D.p('swr', 't'), 'ip', { mode: 'v' }); D.wire(D.p('gm2', 'b'), D.p('swb', 't'), 'ip', { mode: 'v' });
    D.wire(D.p('gm1', 'b', 0.8), D.p('swb', 't', 0.2), 'ip', { mode: 'v', dash: true }); D.wire(D.p('gm2', 'b', 0.2), D.p('swr', 't', 0.8), 'ip', { mode: 'v', dash: true });
    D.wire(D.p('swr', 'b'), D.p('fol', 't', 0.25), 'ip', { mode: 'v', bad: !NET.red }); D.wire(D.p('swb', 'b'), D.p('fol', 't', 0.75), 'ip', { mode: 'v', bad: !NET.blue });
    D.note(1130, 440, ['BMCA : si le grand maître 1 disparaît,', 'le 2 est élu après 3 Announce manqués', '(< 1 s en ST 2059-2). Domaine 127.', 'Détail : poste Réseau IP, onglet PTP.']);
  } else {
    D.note(1120, 110, ['À retenir', '• Tout ce qui commute ou mélange doit être', '  verrouillé sur la même référence.', '• Une CCU non verrouillée : saut d\'image', '  au moment du CUT.', '• Les sources non synchrones (HF, duplex)', '  passent par un synchroniseur de trame,', '  qui ajoute 1 à 2 images de retard.', '• GPS perdu : le SPG tient sa fréquence', '  (holdover) pendant plusieurs heures.'], 'note');
  }
  D.legend(30, 660);
  D.cartouche('Synoptique synchronisation');
  return D;
}

// ---------------- 3. audio ----------------
function audioDiagram() {
  const W = 1500, H = 820;
  const D = diagram(W, H, 'Synoptique audio', `Console son : bus PGM, international, N-1 · retard de ligne ${AU.effDelay || 0} ms · plan de son ${soundPlanOk() ? 'conforme' : 'NON CONFORME'}`);
  D.zone(10, 70, 330, 600, 'Sources (stade et car)');
  D.zone(360, 70, 280, 600, 'Transport');
  D.zone(660, 70, 330, 600, 'Console');
  D.zone(1010, 70, 480, 600, 'Sorties');
  const src = [['amb', 'Couples d\'ambiance', 'tribunes, kop Marek'], ['canon', 'Canons bord terrain', '×6, suivent le jeu (48 V)'], ['comm', 'Micros commentateurs', 'positions Lepagnot'], ['hfmic', 'Micro caméra HF', 'transporté avec l\'image'], ['evs', 'Son des ralentis', 'sorties EVS (embeddé)'], ['duplex', 'Duplex studio', 'retour par la transmission'], ['tone', 'Mire 1 kHz −18 dBFS', 'test de ligne']];
  src.forEach(([id, t, s2], i) => D.box('s_' + id, 30, 100 + i * 78, 290, 50, t, [s2], { cls: id === 'tone' && AU.ch.tone && !AU.ch.tone.mute ? 'warn' : '' }));
  D.box('stage', 380, 120, 240, 60, 'Stagebox terrain', ['préamplis · MADI sur fibre'], { dev: 'audio' });
  D.box('cu', 380, 260, 240, 50, 'Unité de commentaire', ['Dante / AES67 · retours casque'], { dev: 'audio' });
  D.box('deemb', 380, 350, 240, 80, 'Désembedders', ['récepteur HF (paire 1-2)', 'EVS PGM1 / PGM2', 'décodeur duplex'], { dev: 'emb' });
  D.wire(D.p('s_amb', 'r'), D.p('stage', 'l', 0.35), 'audio', { m: 350 });
  D.wire(D.p('s_canon', 'r'), D.p('stage', 'l', 0.7), 'audio', { m: 350 });
  D.wire(D.p('s_comm', 'r'), D.p('cu', 'l'), 'audio', { m: 350 });
  D.wire(D.p('s_hfmic', 'r'), D.p('deemb', 'l', 0.25), 'rf', { dash: true, m: 345 });
  D.wire(D.p('s_evs', 'r'), D.p('deemb', 'l', 0.55), 'video', { m: 350 });
  D.wire(D.p('s_duplex', 'r'), D.p('deemb', 'l', 0.85), 'video', { m: 355 });
  const n1Bad = Object.values(AU.ch).some((c) => c.comm && c.n1), intlBad = Object.values(AU.ch).some((c) => c.voice && c.intl);
  D.box('core', 690, 100, 280, 150, 'Console son (inspi. Vista 1) · DSP', [`${Object.keys(AU.ch).length} tranches utilisées · 3 N-x · 4 VCA`, 'bus PGM (stéréo) · INTL · N-1 COM / STU / BT', `écoute : ${{ pgm: 'PGM', intl: 'international', n1: 'N-1 commentaire', nxs: 'N-1 studio', nxb: 'N-1 bord terrain' }[AU.monitor] || AU.monitor}`, intlBad ? 'VOIX DANS L\'INTERNATIONAL' : 'international sans voix', n1Bad ? 'COMMENTATEUR DANS SON N-1' : 'N-1 sans la voix du commentateur'], { cls: 'big ' + (n1Bad || intlBad ? 'err' : ''), dev: 'audio' });
  D.wire(D.p('stage', 'r'), D.p('core', 'l', 0.2), 'audio', { label: 'MADI 64 canaux', m: 650 });
  D.wire(D.p('cu', 'r'), D.p('core', 'l', 0.5), 'audio', { m: 655 });
  D.wire(D.p('deemb', 'r'), D.p('core', 'l', 0.8), 'audio', { m: 660 });
  D.wire(D.p('s_tone', 'r'), D.p('core', 'b', 0.2), 'audio', { d: `M320,593 H746 V250` });
  const avBad = !avOk();
  D.box('delay', 690, 290, 280, 50, 'Retard de ligne', [`${AU.effDelay || 0} ms${AU.follow ? ' (asservi au tally)' : ''} · décalage ${avOffsetMs()} ms`], { cls: avBad ? 'err' : 'ok', dev: 'audio' });
  D.box('loud', 690, 380, 280, 50, 'Mesure loudness (EBU R128)', [`I ${fmt(AU.lufs.i, 1)} LUFS · cible −23`]);
  D.box('mon', 690, 470, 280, 50, 'Écoutes cabine son', ['enceintes de proximité, casque']);
  D.wire(D.p('core', 'b', 0.6), D.p('delay', 't', 0.6), 'audio', { mode: 'v', label: 'PGM' });
  D.wire(D.p('core', 'b', 0.9), D.p('loud', 't', 0.9), 'audio', { mode: 'v', d: `M942,250 V270 H980 V405 H970` });
  D.wire(D.p('delay', 'l', 0.6), D.p('mon', 'l', 0.5), 'audio', { d: `M690,320 H675 V495 H690` });
  // embedder et plan de son
  const lines = AU.emb.map((v, i) => `${2 * i + 1}-${2 * i + 2} : ${embLabel(v)}${v === SOUND_PLAN[i] ? '' : '  ≠ plan (' + embLabel(SOUND_PLAN[i]) + ')'}`);
  D.box('emb', 1080, 100, 270, 104, 'Embedder du départ', lines, { cls: soundPlanOk() ? 'ok' : 'err', dev: 'emb' });
  D.box('tx', 1372, 100, 112, 50, 'TX1 / TX2', ['vers la chaîne'], { dev: 'tx1' });
  D.box('n1', 1080, 260, 270, 60, 'Retours N-1', ['commentateurs (casques)', 'studio (duplex)'], { cls: n1Bad ? 'err' : '' });
  D.box('intl', 1080, 360, 270, 50, 'International', ['diffuseurs étrangers (sans voix)'], { cls: intlBad ? 'err' : '' });
  D.wire(D.p('delay', 'r'), D.p('emb', 'l', 0.3), 'audio', { m: 1050, label: 'PGM retardé', lx: 1050, ly: 200 });
  D.wire(D.p('core', 'r', 0.35), D.p('intl', 'l'), 'audio', { m: 1030, label: 'INTL', lx: 1030, ly: 340 });
  D.wire(D.p('core', 'r', 0.7), D.p('n1', 'l'), 'audio', { m: 1012, label: 'N-1', lx: 1012, ly: 230 });
  D.wire(D.p('intl', 't', 0.9), D.p('emb', 'b', 0.9), 'audio', { mode: 'v' });
  D.wire(D.p('emb', 'r', 0.5), D.p('tx', 'l'), 'video', { label: 'SDI + audio' });
  D.wire(D.p('n1', 'l', 0.8), D.p('cu', 'b', 0.6), 'audio', { dash: true, d: `M1080,308 H1000 V560 H524 V310` });
  D.wlabel(760, 560, 'retour N-1 vers l\'unité de commentaire');
  D.legend(1030, 470);
  D.cartouche('Synoptique audio');
  return D;
}

// ---------------- 4. intercom et tally ----------------
function commsDiagram() {
  const W = 1500, H = 960;
  const cams = S.cams.filter((c) => c.T.operator !== false);
  const D = diagram(W, H, 'Synoptique intercom et tally', 'Matrice d\'intercom : postes à touches dans le car, voies 4 fils des CCU vers les cadreurs, beltpacks sans fil, coordination avec la chaîne · tally depuis le mélangeur');
  D.zone(10, 70, 300, 560, 'Postes à touches (car)');
  D.zone(330, 70, 320, 560, 'Matrice');
  D.zone(670, 70, 820, 560, 'Terrain et extérieur');
  const panels = ['Réalisateur', 'Scripte', 'Truquiste', 'Production', 'Chef de car', 'Vision 1 · 2', 'EVS / LSM', 'Son', 'HF', 'Habillage'];
  panels.forEach((p, i) => { D.box('kp' + i, 30, 92 + i * 52, 260, 40, p, [], { dev: 'icom' }); });
  D.box('mx', 360, 200, 260, 220, 'Matrice intercom', ['ports 4 fils · AES67', 'groupes : PROD, ENG, EVS, SON', 'conférences et IFB (N-1)', 'interfaces : CCU, beltpacks,', 'hybride téléphonique, codec'], { cls: 'big', dev: 'icom' });
  panels.forEach((p, i) => D.wire(D.p('kp' + i, 'r'), D.p('mx', 'l', 0.1 + i * 0.08), 'comms', { m: 325, both: true, noArrow: false }));
  D.box('ccu', 700, 100, 300, 60, `CCU ×${S.cams.filter((c) => !isHF(c)).length} · intercom`, ['PROD (réalisation) + ENG (technique)', 'dans la fibre jusqu\'au casque du cadreur'], { dev: 'ccu' });
  D.box('cams', 1030, 100, 440, 60, `Cadreurs (${cams.length})`, ['CAM ' + cams.map((c) => c.id).join(' · '), 'casques sur XLR-5 (INTERCOM 1 / 2)'], { dev: 'headset' });
  D.box('belt', 700, 200, 300, 54, 'Base beltpacks sans fil', ['DECT / 1,9 GHz'], { dev: 'icom' });
  D.box('bp', 1030, 200, 440, 54, 'Régisseur terrain, Steadicam, techniciens', ['beltpacks + casques']);
  D.box('cu', 700, 290, 300, 54, 'Unité de commentaire', ['ordres + retour N-1 (IFB)'], { dev: 'audio' });
  D.box('cm', 1030, 290, 440, 54, 'Commentateurs (positions Lepagnot)', ['écoutent le N-1 et les ordres de la réalisation']);
  D.box('hyb', 700, 380, 300, 54, 'Hybride / codec de coordination', ['ligne de conférence'], { cls: 'ext' });
  D.box('mcr', 1030, 380, 440, 54, 'Chaîne (régie finale)', ['mise à l\'antenne, ordres de début / fin'], { cls: 'ext' });
  for (const [a, b] of [['ccu', 'cams'], ['belt', 'bp'], ['cu', 'cm'], ['hyb', 'mcr']]) D.wire(D.p(a, 'r'), D.p(b, 'l'), a === 'belt' ? 'rf' : a === 'ccu' ? 'fiber' : 'comms', { both: true, dash: a === 'belt' || a === 'hyb' });
  for (const [k, t] of /** @type {Array<[string, number]>} */ ([['ccu', 0.15], ['belt', 0.4], ['cu', 0.62], ['hyb', 0.85]])) D.wire(D.p('mx', 'r', t), D.p(k, 'l'), 'comms', { m: 660, both: true });
  // tally
  const pgm = meSource(MIX.pgm), pst = meSource(MIX.pst);
  D.zone(10, 650, 1480, 190, 'Tally');
  D.box('xvs', 30, 690, 220, 54, EQUIP.mixer, [`PGM : ${sourceLabel(pgm)} · PST : ${sourceLabel(pst)}`], { dev: 'mixer' });
  D.box('mks', 290, 690, 220, 54, 'MKS-X7701 (tally)', ['GPI : 18 relais'], { dev: 'siu' });
  D.box('tc', 550, 690, 240, 54, 'Contrôleur de tally', ['TSL UMD sur IP']);
  D.box('t1', 830, 670, 300, 46, 'CCU → caméras', [`rouge : ${pgm && pgm.startsWith('CAM') ? pgm.replace('CAM', 'CAM ') : '—'} · vert : ${pst && pst.startsWith('CAM') ? pst.replace('CAM', 'CAM ') : '—'}`], { cls: pgm && pgm.startsWith('CAM') ? 'pgm' : '', dev: 'ccu' });
  D.box('t2', 830, 730, 300, 46, 'Multiviewers', ['bordures rouge / verte + noms (UMD)'], { dev: 'mv' });
  D.box('t3', 1160, 670, 310, 46, 'Viseurs et lampes tally', ['le cadreur sait qu\'il est à l\'antenne'], { cls: 'ext' });
  D.box('t4', 1160, 730, 310, 46, 'EVS, grille, habillage', ['UMD, alarmes, tally des sources']);
  D.wire(D.p('xvs', 'r'), D.p('mks', 'l'), 'tally'); D.wire(D.p('mks', 'r'), D.p('tc', 'l'), 'tally');
  D.wire(D.p('tc', 'r'), D.p('t1', 'l'), 'tally', { m: 810 }); D.wire(D.p('tc', 'r'), D.p('t2', 'l'), 'ip', { m: 815 });
  D.wire(D.p('t1', 'r'), D.p('t3', 'l'), 'fiber'); D.wire(D.p('t2', 'r'), D.p('t4', 'l'), 'ip');
  D.legend(700, 470);
  D.cartouche('Synoptique intercom et tally');
  return D;
}

// ---------------- 5. réseaux ----------------
function netDiagram() {
  const ip = S.ipMode, W = 1500, H = ip ? 1090 : 840;
  const nRcp = S.cams.filter((c) => !isHF(c) && c.T.model !== 'pov').length;
  const D = diagram(W, H, 'Synoptique réseaux et télécommandes', ip ? 'Réseau de contrôle + réseau média ST 2110 doublé (rouge / bleu, ST 2022-7)' : 'Réseaux de contrôle (caméras, mélangeur, EVS, gestion) et liaisons série');
  D.zone(10, 70, 470, 520, 'Contrôle caméras (CNS)');
  D.zone(500, 70, 470, 520, 'Mélangeur et ralentis');
  D.zone(990, 70, 500, 520, 'Gestion technique');
  D.box('cns', 150, 100, 200, 54, 'Switch caméras (CNS)', ['réseau de contrôle'], { dev: 'cns' });
  D.box('rcp', 30, 220, 200, 54, `RCP ×${Math.max(1, nRcp)}`, ['pupitres vision (PoE)'], { dev: 'rcp' });
  D.box('msu', 260, 220, 200, 54, 'MSU', ['pupitre maître'], { dev: 'msu' });
  D.box('ccus', 30, 330, 430, 54, `CCU ×${S.cams.filter((c) => !isHF(c)).length}`, ['télécommande des têtes à travers la fibre'], { dev: 'ccu' });
  D.box('hfc', 30, 440, 430, 54, 'Récepteurs HF', ['télécommande des caméras HF par voie radio de retour'], { dev: 'rx' });
  D.wire(D.p('cns', 'b', 0.2), D.p('rcp', 't'), 'ip', { mode: 'v' }); D.wire(D.p('cns', 'b', 0.8), D.p('msu', 't'), 'ip', { mode: 'v' });
  D.wire(D.p('cns', 'b', 0.5), D.p('ccus', 't'), 'ip', { mode: 'v', d: `M250,154 V300 H245 V330` });
  D.wire(D.p('ccus', 'b'), D.p('hfc', 't'), 'ip', { mode: 'v' });
  D.box('icp', 520, 100, 210, 54, EQUIP.mixPanel, ['pupitre du truquiste'], { dev: 'mixpanel' });
  D.box('mks', 750, 100, 200, 54, 'MKS-X7700', ['interface pupitre'], { dev: 'siu' });
  D.box('xvs', 640, 200, 220, 54, EQUIP.mixer, ['MVS LAN · UTIL LAN'], { dev: 'mixer' });
  D.box('lsm', 520, 330, 200, 54, `LSM ×${EQUIP.lsmCount}`, ['télécommande Multicam'], { dev: 'lsm' });
  D.box('xt', 750, 330, 200, 54, EQUIP.evsModel, [`${EQUIP.evsServers} serveur(s)`], { cls: EVS.recording ? '' : 'err', dev: 'evs' });
  D.box('xnet', 750, 440, 200, 54, 'Switch XNet / 10 GbE', ['partage des clips'], { dev: 'xnet' });
  D.box('ipdb', 520, 440, 200, 54, 'IPDirector', ['base de données, log'], { dev: 'ipd' });
  D.wire(D.p('icp', 'r'), D.p('mks', 'l'), 'data', { both: true });
  D.wire(D.p('mks', 'b'), D.p('xvs', 't', 0.8), 'ip', { mode: 'v' });
  D.wire(D.p('lsm', 'r'), D.p('xt', 'l'), 'data', { label: 'RS-422', both: true });
  D.wire(D.p('xt', 'b'), D.p('xnet', 't'), 'ip', { mode: 'v' });
  D.wire(D.p('ipdb', 'r'), D.p('xnet', 'l'), 'ip', { both: true });
  D.box('mgmt', 1150, 100, 200, 54, 'Switch de gestion', ['VLAN technique · NTP'], { dev: 'cns', n: 2 });
  const mg = [['rt', 'Grille', 'panneaux X-Y, salvos', 'router'], ['mvc', 'Multiviewers', 'configuration, UMD', 'mv'], ['ic', 'Matrice intercom', 'configuration', 'icom'], ['sp', 'SPG', 'alarmes SNMP', 'spg'], ['enc', 'Encodeurs TX', 'supervision', 'tx1'], ['ups', 'Onduleurs', 'état batteries', 'ups']];
  mg.forEach(([id, t, s2, dev], i) => { const x = 1010 + (i % 2) * 240, y = 200 + Math.floor(i / 2) * 90; D.box(id, x, y, 220, 54, t, [s2], { dev }); D.wire(D.p('mgmt', 'b'), D.p(id, 't'), 'ip', { mode: 'v', m: 180 }); });
  if (ip && FAB.res) {
    D.zone(10, 610, 1480, 460, 'Réseau média ST 2110 : deux fabrics spine-leaf indépendantes (ST 2022-7)');
    const lv = (sw) => (!sw.power ? 'err' : FAB.issues.some((x) => x.sw === sw.id && x.sev === 'err') ? 'err' : FAB.issues.some((x) => x.sw === sw.id && x.sev === 'warn') ? 'warn' : '');
    for (const [c, ox, nm] of /** @type {Array<[string, number, string]>} */ ([['red', 20, 'ROUGE (A)'], ['blue', 760, 'BLEU (B)']])) {
      const C = c === 'red' ? 'R' : 'B';
      D.note(ox + 10, 650, [`Réseau ${nm}`], 'zl');
      for (const s2 of [1, 2]) { const sw = FAB.switches[`SPINE-${C}${s2}`]; D.box(`sp${C}${s2}`, ox + 140 + (s2 - 1) * 260, 660, 180, 46, sw.running.hostname, [sw.power ? `spine 32 × 100G · ${sw.loopback}` : 'HORS TENSION'], { cls: lv(sw), dev: c === 'red' ? 'swred' : 'swblue' }); }
      for (const L of LEAVES) {
        const sw = FAB.switches[`LEAF-${C}${L.k}`]; const x = ox + (L.k - 1) * 120;
        D.box(`lf${C}${L.k}`, x, 790, 108, 58, `leaf ${C.toLowerCase()}${L.k}`, [L.name.split(' ')[0].toLowerCase(), sw.power ? `VLAN ${vlanOf(c, L.k)}` : 'HORS TENSION'], { cls: lv(sw), dev: c === 'red' ? 'swred' : 'swblue' });
        for (const s2 of [1, 2]) {
          const ls = FAB.links.filter((l) => l.color === c && l.k === L.k && l.s === s2).map((l) => FAB.res.up[l.id]);
          const bad = ls.some((u) => !u.up || u.ospf !== 'FULL' || !u.pim);
          const sp = D.p(`sp${C}${s2}`, 'b', 0.12 + (L.k - 1) * 0.15);
          D.wire(D.p(`lf${C}${L.k}`, 't', s2 === 1 ? 0.3 : 0.7), sp, 'ip', { mode: 'straight', bad, noArrow: true, dash: ls.every((u) => !u.up) });
        }
        D.wire(D.p(`lf${C}${L.k}`, 'b'), [x + 54, 900], 'ip', { mode: 'straight', noArrow: true, bad: !sw.power });
      }
    }
    const rx = Object.values(FAB.res.rxState); const lost = rx.filter((x) => !x.ok || x.loss > 0).length, unp = rx.filter((x) => x.ok && !x.protected).length;
    D.box('dev', 20, 900, 1460, 58, 'Appareils ST 2110 : une carte sur le réseau rouge, une sur le bleu', [`CCU, XVS-6000, passerelles (EVS, HF, TX), multiviewers, audio · ${fmt(flowGbps(), 1)} Gb/s par flux vidéo · ${rx.length} réceptions, ${unp} sans protection, ${lost} en défaut`], { cls: lost ? 'err' : unp ? 'warn' : 'ok', info: 'reseau' });
    D.box('ctl', 20, 990, 340, 54, 'SW-CTRL (contrôle / gestion)', ['VLAN 10 gestion OOB · VLAN 20 contrôle'], { cls: lv(FAB.switches['SW-CTRL']), dev: 'cns' });
    D.box('nm', 400, 990, 300, 54, 'Registre / contrôleur NMOS', [NET.nmos ? 'IS-04 · IS-05 OK' : 'INJOIGNABLE'], { cls: NET.nmos ? 'ok' : 'err', dev: 'nmos' });
    D.wire(D.p('ctl', 'r'), D.p('nm', 'l'), 'ip', { both: true });
    D.note(740, 1005, ['Chaque leaf : 2 × 100 GbE vers chaque spine (OSPF + PIM-SSM, ECMP). Les deux fabrics ne sont jamais reliées.', 'Détail, configuration des commutateurs et ligne de commande : poste « Réseau IP » (zone technique).'], 'note');
  } else D.legend(30, 640);
  D.cartouche('Synoptique réseaux');
  return D;
}

// ---------------- 6. énergie ----------------
function powerDiagram() {
  const W = 1500, H = 760;
  const D = diagram(W, H, 'Synoptique énergie', 'Double alimentation (voies A et B) des équipements critiques, secourue par onduleurs ; climatisation et éclairage non secourus');
  D.zone(10, 70, 360, 470, 'Sources');
  D.zone(390, 70, 380, 470, 'Car régie : distribution');
  D.zone(790, 70, 700, 470, 'Baies et usages');
  D.box('grid', 30, 110, 320, 60, 'Armoire TV du stade', ['400 V triphasé + neutre + terre', 'côté tribune Lepagnot'], { cls: 'ext' });
  D.box('gen', 30, 220, 320, 60, 'Groupe électrogène (compound)', ['secours ou source principale'], { dev: 'ups', n: 3 });
  D.box('earth', 30, 340, 320, 60, 'Piquet de terre', ['équipotentialité châssis, car, groupe'], { cls: 'ext' });
  D.box('ats', 410, 150, 340, 60, 'Inverseur de sources', ['normal / secours, contrôle des phases'], { dev: 'ups' });
  D.box('tgbt', 410, 250, 340, 54, 'Tableau général du car', ['protections différentielles'], { dev: 'ups' });
  D.box('upsA', 410, 350, 160, 60, 'Onduleur A', ['voie A'], { dev: 'ups' });
  D.box('upsB', 590, 350, 160, 60, 'Onduleur B', ['voie B'], { dev: 'ups', n: 2 });
  D.box('clim', 410, 460, 340, 54, 'Climatisation · éclairage · prises', ['non secourus'], { cls: 'ext' });
  D.wire(D.p('grid', 'r'), D.p('ats', 'l', 0.3), 'power', { m: 380 });
  D.wire(D.p('gen', 'r'), D.p('ats', 'l', 0.75), 'power', { m: 385, dash: true });
  D.wire(D.p('earth', 'r'), D.p('tgbt', 'l', 0.8), 'power', { m: 375, dash: true, label: 'terre', noArrow: true });
  D.wire(D.p('ats', 'b'), D.p('tgbt', 't'), 'power', { mode: 'v' });
  D.wire(D.p('tgbt', 'b', 0.2), D.p('upsA', 't'), 'power', { mode: 'v' }); D.wire(D.p('tgbt', 'b', 0.8), D.p('upsB', 't'), 'power', { mode: 'v' });
  D.wire(D.p('tgbt', 'l', 0.6), D.p('clim', 'l', 0.5), 'power', { d: `M410,282 H398 V487 H410` });
  const racks = [...RACK_ROWS.mur, ...RACK_ROWS.porte].map((k) => RACKS[k].title);
  racks.forEach((t, i) => {
    const x = 810 + (i % 3) * 225, y = 100 + Math.floor(i / 3) * 84;
    const dual = !['Énergie'].includes(t);
    D.box('r' + i, x, y, 205, 50, 'Baie ' + t, [dual ? 'PDU A + PDU B' : 'onduleurs'], { dev: 'ups' });
    if (dual) { const ry = y + 50 * 0.35, rx = x; D.wire([490, 410], [rx, ry], 'power', { noArrow: true, d: `M490,410 V426 H${776 + (i % 3) * 3} V${ry} H${rx}` }); D.wire(D.p('upsB', 'r'), D.p('r' + i, 'l', 0.7), 'power', { m: 786 + (i % 3) * 3, dash: true, noArrow: true }); }
  });
  D.note(30, 570, ['Avant de tout mettre sous tension : terre raccordée, contrôle des phases et du neutre, puis montée progressive (onduleurs, baies, pupitres).', 'Les appareils critiques (grille, mélangeur, EVS, CCU) ont deux alimentations : une par voie. Une voie peut tomber sans couper l\'antenne.']);
  D.legend(30, 630);
  D.cartouche('Synoptique énergie');
  return D;
}

// ---------------- 7. élévation des baies ----------------
function racksDiagram() {
  /** @type {Array<[string, string[]]>} */
  const rows = [['Rangée côté mur d\'écrans', RACK_ROWS.mur], ['Rangée côté porte', RACK_ROWS.porte]];
  const U = 11, rw = 175, gap = 22, top = 90, rh = 42 * U;
  const W = 40 + 7 * (rw + gap) + 20, H = top + 2 * (rh + 90) + 40;
  const D = diagram(W, H, 'Élévation des baies (zone technique)', 'Baies 19" de 42 U · vue de face · cliquez une baie pour voir l\'appareil principal');
  rows.forEach(([label, keys], r) => {
    const y0 = top + r * (rh + 90) + 20;
    D.note(40, y0 - 10, label.toUpperCase(), 'zl');
    keys.forEach((k, i) => {
      const x = 40 + i * (rw + gap), def = RACKS[k];
      D.box('rk' + k, x, y0, rw, rh + 26, def.title, [], { cls: 'big', dev: def.device || null, top: true });
      let u = 42;
      for (const [h, type, lab] of def.units) {
        const yy = y0 + 22 + (42 - u) * U;
        const g = E('g', { class: 'bx' }); g.append(E('rect', { x: x + 8, y: yy, width: rw - 16, height: h * U - 1, rx: 2, class: 'f' }));
        if (lab) g.append(E('text', { x: x + 14, y: yy + Math.min(h * U - 2.5, 11), class: 's', style: 'font-size:9px' }, lab.slice(0, 27)));
        else if (type === 'vent') g.append(E('text', { x: x + rw / 2, y: yy + 8.5, class: 'ru', 'text-anchor': 'middle' }, 'ventilation'));
        D.raw(g);
        u -= h;
      }
      if (i === 0) for (let uu = 42; uu >= 1; uu -= 6) D.note(x - 22, y0 + 22 + (42 - uu) * U + 8, String(uu), 'ru');
    });
  });
  D.cartouche('Élévation des baies');
  return D;
}

/** @type {Array<[string, string, Function, string]>} : clé, titre, dessin, aide */
const TABS = [
  ['video', 'Vidéo', videoDiagram, 'Le chemin des images : caméras → CCU → grille → mélangeur, EVS, multiviewers → départs vers la chaîne. Suivez une caméra à l\'antenne (cadre rouge) depuis le stade jusqu\'au TX actif.'],
  ['sync', 'Synchronisation', syncDiagram, 'Tout ce qui commute doit être calé sur la même référence. Le SPG (verrouillé GPS) alimente les distributeurs, qui alimentent chaque appareil.'],
  ['audio', 'Audio', audioDiagram, 'Des micros du stade à l\'embedder du départ : bus PGM, international (sans voix) et N-1 (sans la voix de celui qui écoute).'],
  ['comms', 'Intercom · tally', commsDiagram, 'Qui parle à qui : postes à touches du car, cadreurs (dans la fibre), beltpacks, commentateurs, chaîne. Le tally part du mélangeur et allume les caméras et le multiview.'],
  ['net', 'Réseaux', netDiagram, 'Les réseaux de commande : RCP vers CCU, pupitre vers mélangeur, LSM vers EVS, gestion des équipements' + ' (et réseau média ST 2110 en car IP).'],
  ['power', 'Énergie', powerDiagram, 'De l\'armoire du stade ou du groupe jusqu\'aux deux alimentations de chaque baie.'],
  ['racks', 'Baies', racksDiagram, 'Ce qu\'il y a dans chaque baie de la zone technique, unité par unité.'],
  ['plan', 'Implantation', null, 'Le plan du car vu de dessus : zones, postes et circulation. Cliquez un poste pour vous y rendre.'],
];

// panneau réutilisable (modal ou poste chef de car)
export function synopticsPanel(start = 'video') {
  let cur = start, paper = false, key = '';
  const tabs = el('div', { class: 'tabs' });
  const host = el('div', { class: 'svgwrap synwrap' });
  const help = el('p', { class: 'note' });
  const draw = () => {
    const t = TABS.find((x) => x[0] === cur);
    [...tabs.children].forEach((b) => b.classList.toggle('on', b.dataset.k === cur));
    help.textContent = t[3];
    host.innerHTML = '';
    let svg;
    if (t[2]) svg = t[2]().svg; else svg = planSVG();
    if (paper) svg.classList.add('paper');
    svg.addEventListener('click', (e) => { const g = e.target.closest('[data-dev]'); if (g) { openDevice(g.dataset.dev, +(g.dataset.n || 1)); return; } const i = e.target.closest('[data-info]'); if (i) openInfo(i.dataset.info); });
    host.appendChild(svg);
  };
  for (const [k, l] of TABS) tabs.appendChild(el('button', { class: 'tab', 'data-k': k, onclick: () => { cur = k; draw(); } }, l));
  const paperBtn = el('button', { class: 'btn small', onclick: () => { paper = !paper; paperBtn.classList.toggle('primary', paper); draw(); } }, 'Fond blanc (impression)');
  const dl = el('button', { class: 'btn small', onclick: async () => {
    const svg = host.querySelector('svg'); if (!svg) return;
    const txt = '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(svg);
    const r = await offerDownload(`synoptique-${cur}.svg`, new Blob([txt], { type: 'image/svg+xml' }));
    toast(r === 'saved' ? 'Synoptique téléchargé (SVG, s\'ouvre dans un navigateur ou Inkscape)' : 'Téléchargement annulé', r === 'saved' ? 'good' : '');
  } }, 'Télécharger (SVG)');
  const box = el('div', { class: 'list' }, el('div', { class: 'hwrow', style: { justifyContent: 'space-between' } }, tabs, el('div', { class: 'hwrow' }, paperBtn, dl)), help, host);
  draw();
  // mise à jour quand l'état du car change
  const stateKey = () => S.cams.map((c) => c.id + c.link + c.signalOK + c.genlock + c.fiberCut).join() + Object.values(ROUTER.map).join() + MIX.pgm + MIX.pst + JSON.stringify(S.faults) + EVS.recording + S.txPath + AU.emb.join() + [NET.redState, NET.blueState, NET.gm1, NET.gm2, NET.gmActive, NET.nmos, NET.mvSat, FAB.ver, FAB.issues.length].join() + AU.effDelay + Object.values(AU.ch).map((c) => +c.intl + '' + +c.n1).join();
  key = stateKey();
  return { el: box, update() { if (cur === 'racks' || cur === 'plan') return; const k = stateKey(); if (k !== key) { key = k; draw(); } } };
}

export function openSynoptics(tab = 'video') {
  if (document.pointerLockElement) document.exitPointerLock();
  const p = synopticsPanel(tab);
  modal.open('Synoptiques du car', p.el, { width: 1400 });
  (S.flags ||= {}).synoptics = true;
  const tick = () => { if (!p.el.isConnected) return; p.update(); setTimeout(tick, 700); };
  setTimeout(tick, 700);
}

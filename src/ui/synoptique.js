import { S } from '../state.js';
import { LINKS, FORMATS } from '../data.js';
import { ROUTER, EVS, recordedCams, sourceLabel } from '../pipeline.js';
import { openInfo } from './common.js';

const NS = 'http://www.w3.org/2000/svg';
function E(tag, attrs = {}, text) { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (text != null) e.textContent = text; return e; }
const hex = (n) => '#' + n.toString(16).padStart(6, '0');

// Synoptique de l'installation, généré à partir de la configuration en cours
export function buildSynoptique() {
  const cams = S.cams;
  const rowH = 30, top = 56;
  const n = Math.max(cams.length, 7);
  const H = top + n * rowH + 150, Wd = 1220;
  const svg = E('svg', { viewBox: `0 0 ${Wd} ${H}`, width: Wd, height: H, role: 'img', 'aria-label': 'Synoptique de l\'installation' });
  svg.style.display = 'block';
  const txt = (x, y, s, o = {}) => svg.appendChild(E('text', { x, y, fill: o.fill || '#e8edf1', 'font-size': o.size || 12, 'font-family': o.font || 'Barlow, sans-serif', 'text-anchor': o.anchor || 'start', 'font-weight': o.w || 400 }, s));
  const box = (x, y, w, h, label, sub, opts = {}) => {
    const g = E('g', { style: 'cursor:pointer' });
    g.appendChild(E('rect', { x, y, width: w, height: h, rx: 4, fill: opts.fill || '#182027', stroke: opts.stroke || '#3a4652', 'stroke-width': opts.sw || 1.2 }));
    g.appendChild(E('text', { x: x + 8, y: y + (sub ? 15 : h / 2 + 4), fill: opts.color || '#e8edf1', 'font-size': 12.5, 'font-family': 'Saira Condensed, sans-serif', 'font-weight': 600, 'letter-spacing': '0.04em' }, label));
    if (sub) g.appendChild(E('text', { x: x + 8, y: y + 28, fill: '#93a0ab', 'font-size': 11, 'font-family': 'Barlow, sans-serif' }, sub));
    if (opts.info) g.addEventListener('click', () => openInfo(opts.info));
    svg.appendChild(g); return g;
  };
  const line = (x1, y1, x2, y2, color = '#5a6672', o = {}) => svg.appendChild(E('path', { d: o.d || `M${x1},${y1} L${x2},${y2}`, stroke: color, 'stroke-width': o.w || 1.6, fill: 'none', 'stroke-dasharray': o.dash || '', 'marker-end': o.arrow === false ? '' : 'url(#arr)' }));
  const defs = E('defs'); const mk = E('marker', { id: 'arr', viewBox: '0 0 8 8', refX: 7, refY: 4, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' }); mk.appendChild(E('path', { d: 'M0,0 L8,4 L0,8 z', fill: '#7d8994' })); defs.appendChild(mk); svg.appendChild(defs);

  txt(10, 22, 'CAMÉRAS', { font: 'Saira Condensed, sans-serif', size: 13, fill: '#93a0ab', w: 600 });
  txt(250, 22, 'LIAISONS · CCU', { font: 'Saira Condensed, sans-serif', size: 13, fill: '#93a0ab', w: 600 });
  txt(430, 22, 'GRILLE', { font: 'Saira Condensed, sans-serif', size: 13, fill: '#93a0ab', w: 600 });
  txt(600, 22, 'TRAITEMENT', { font: 'Saira Condensed, sans-serif', size: 13, fill: '#93a0ab', w: 600 });
  txt(860, 22, 'SORTIES · TRANSMISSION', { font: 'Saira Condensed, sans-serif', size: 13, fill: '#93a0ab', w: 600 });
  txt(Wd - 10, H - 8, `Format : ${FORMATS[S.format].label} · ${FORMATS[S.format].sdi}`, { anchor: 'end', fill: '#ffb020', size: 12 });

  const rX = 430, rY = top - 6, rH = n * rowH;
  cams.forEach((c, i) => {
    const y = top + i * rowH;
    const bad = !c.signalOK || !c.genlock;
    box(10, y, 200, 24, `CAM ${c.id} · ${c.T.short}`, null, { stroke: bad ? '#ff3b30' : '#3a4652', info: 'cadreur' });
    const lk = LINKS[c.link];
    line(210, y + 12, 300, y + 12, hex(lk.color), { arrow: false, w: 2.2, dash: c.link === 'hf' ? '5 4' : '' });
    txt(215, y + 8, lk.short + (c.route && c.route.length ? ` ${Math.round(c.route.length)} m` : ''), { size: 10, fill: '#93a0ab' });
    box(300, y, 92, 24, c.rf ? `RX HF ${c.id}` : `CCU ${c.id}`, null, { stroke: bad ? '#ff3b30' : '#3a4652', info: c.rf ? 'hf' : 'ccu' });
    line(392, y + 12, rX, y + 12, '#5a6672');
  });
  if (!cams.length) txt(10, top + 14, 'Aucune caméra : ouvrez le plan (P).', { fill: '#93a0ab' });
  box(rX, rY, 110, rH + 12, 'GRILLE', 'SDI / IP', { info: 'grille', fill: '#1b2530' });
  // traitements
  const mx = 600;
  box(mx, top, 170, 92, 'MÉLANGEUR', 'M/E · keyers · DSK', { info: 'melangeur' });
  box(mx, top + 104, 170, 60, 'EVS (serveur ralenti)', `REC ${recordedCams().length} cam. · ${EVS.recording ? 'enregistre' : 'ARRÊTÉ'}`, { info: 'evs', stroke: EVS.recording ? '#3a4652' : '#ff3b30' });
  box(mx, top + 176, 170, 44, 'MULTIVIEW', '18 tuiles + PGM/PVW', { info: 'realisateur' });
  box(mx, top + 232, 170, 44, 'HABILLAGE', 'fill + key → DSK', { info: 'habillage' });
  for (const yy of [top + 40, top + 130, top + 196]) line(rX + 110, yy, mx, yy);
  line(mx + 85, top + 232, mx + 85, top + 92, '#5a6672');
  line(mx + 170, top + 134, mx + 210, top + 134, '#5a6672', { arrow: false }); line(mx + 210, top + 134, mx + 210, top + 70, '#5a6672', { arrow: false });
  line(mx + 210, top + 70, rX + 110, top + 70, '#5a6672', { d: `M${mx + 210},${top + 70} C ${mx + 240},${top + 70} ${mx + 240},${top + 30} ${rX + 112},${top + 20}`, dash: '3 3' });
  txt(mx + 175, top + 128, 'EVS A/B', { size: 10, fill: '#93a0ab' });
  // sorties
  const ox = 860;
  box(ox, top, 120, 40, 'PGM', 'programme + DSK', { info: 'melangeur', stroke: '#ff3b30' });
  box(ox, top + 52, 120, 40, 'CLEAN FEED', 'sans habillage', { info: 'melangeur' });
  line(mx + 170, top + 20, ox, top + 20); line(mx + 170, top + 60, ox, top + 72);
  box(ox + 150, top - 2, 110, 44, 'EMBEDDING', 'audio → SDI', { info: 'son' });
  line(ox + 120, top + 20, ox + 150, top + 20);
  const txBad = (S.faults.tx && S.txPath === 1) || ROUTER.map[S.txPath === 2 ? 'AUX_TX2' : 'AUX_TX1'] !== 'PGM';
  box(ox + 150, top + 60, 110, 40, 'TX1 FIBRE', sourceLabel(ROUTER.map.AUX_TX1) + (S.faults.tx ? ' · COUPÉ' : ''), { info: 'transmission', stroke: S.faults.tx ? '#ff3b30' : (S.txPath === 1 ? '#2fd25a' : '#3a4652') });
  box(ox + 150, top + 108, 110, 40, 'TX2 SATELLITE', sourceLabel(ROUTER.map.AUX_TX2), { info: 'transmission', stroke: S.txPath === 2 ? '#2fd25a' : '#3a4652' });
  line(ox + 205, top + 42, ox + 205, top + 60);
  line(ox + 170, top + 42, ox + 170, top + 108, '#5a6672', { d: `M${ox + 160},${top + 42} L${ox + 160},${top + 128} L${ox + 150},${top + 128}` });
  box(ox + 150, top + 170, 110, 40, 'DIFFUSEUR', 'chaîne / MCR', { info: 'transmission', stroke: txBad ? '#ff3b30' : '#3a4652' });
  line(ox + 260, top + 80, ox + 280, top + 80, '#5a6672', { arrow: false }); line(ox + 280, top + 80, ox + 280, top + 190, '#5a6672', { arrow: false }); line(ox + 280, top + 190, ox + 262, top + 190);
  line(ox + 150, top + 200, mx + 170, top + 200, '#ffb020', { dash: '5 4' });
  txt(ox - 20, top + 216, 'retour antenne (délai ≈ 1,3 s)', { size: 10.5, fill: '#ffb020' });
  box(ox, top + 120, 120, 44, 'SON', 'console · R128', { info: 'son' });
  line(ox + 120, top + 136, ox + 150, top + 30, '#5a6672');
  // synchro et intercom
  const sy = H - 70;
  box(300, sy, 240, 44, 'SPG · SYNCHRO', S.faults.gps ? 'HOLDOVER (GPS perdu)' : 'GPS · BB / tri-level · LTC · PTP', { info: 'synchro', stroke: S.faults.gps ? '#ffb020' : '#3a4652' });
  for (const x of [346, rX + 55, mx + 40, mx + 120]) line(x, sy, x, rY + rH + 16 > sy - 4 ? sy - 4 : rY + rH + 16, '#46c6f2', { dash: '2 4', arrow: false, w: 1.2 });
  txt(548, sy + 26, 'référence vers CCU, grille, mélangeur, EVS', { size: 10.5, fill: '#46c6f2' });
  box(ox, sy, 260, 44, 'INTERCOM', 'matrice · pupitres · 4 fils chaîne', { info: 'intercom' });
  box(10, sy, 260, 44, 'ÉNERGIE', 'groupe / réseau · onduleur · terre', { info: 'energie' });
  return svg;
}

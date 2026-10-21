// @ts-check
import { S, camById, emit } from '../state.js';
import { el, fmt, tc, clamp } from '../util.js';
import { IRIS_STOPS, ND_FILTERS, SHUTTERS } from '../data/exposure.js';
import { modal } from '../ui/common.js';
import { DEVICES, deviceDef, DEVICE_LIST } from './devices.js';
import { deviceCables, endLabel, portName, DEV_NAMES, SIG, routerInLabel, routerOutLabel, routerCrosspoint, isSystemCam } from './cabling.js';
import { EVS, ROUTER, MIX, meSource, sourceLabel, TRANS } from '../pipeline.js';
import { EQUIP, evsLayout } from '../equip.js';
import { CFG, photoUrl } from '../shared.js';
import { VH_PANEL, inLabel, outLabel, xpOf, lockState } from '../videohub.js';
import { openReport } from '../ui/report.js';

const NS = 'http://www.w3.org/2000/svg';
function E(tag, attrs = {}, parent, text) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
  if (text != null) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
}
const FONT = 'Barlow Condensed, Arial Narrow, sans-serif';

// ----------------------------------------------------------------------------------
// État en direct des appareils (voyants, afficheurs, positions)
// ----------------------------------------------------------------------------------
function opticalLevel(c) { return c && c.route ? -4 - (c.route.length / 1000) * 0.4 - 1.5 - (c.id % 3) * 0.7 : null; }
function liveState(key, n) {
  const st = { led: {}, btn: {}, lcd: {}, knob: {}, bar: {}, label: {}, joy: null, lever: null, screen: null };
  if (key === 'ccu' || key === 'cam' || key === 'rcp') {
    const c = camById(n); if (!c) return st;
    const t = c.tallyState;
    st.led.tally = t === 2 ? 'tally' : null; st.led.tallyled = t === 2 ? 'tally' : null;
    st.led.callled = S.time - (c.paint.call || -99) < 3 ? 'amber' : null;
    if (key === 'ccu') {
      const opt = c.fiberCut ? -40 : opticalLevel(c);
      st.led.led_ref = c.genlock ? 'green' : null; st.led.led_unlock = c.genlock ? null : 'red';
      st.led.led_rcp = 'green'; st.led.led_alarm = c.status.ok ? null : 'red'; st.led.led_fan = 'green'; st.led.campower_led = c.powerOn !== false ? 'green' : null;
      st.bar.sigbar = c.fiberCut || c.powerOn === false ? 0 : clamp((opt + 22) / 18, 0, 1);
      st.lcd.lcd = [`CAM ${c.id}  ${c.T.short.toUpperCase()}`, c.fiberCut ? 'OPT RX : PAS DE SIGNAL' : `OPT RX ${fmt(opt, 1)} dBm`, `${S.format === 'UHD' ? '2160/50P HLG' : S.format === 'HD' ? '1080/50P' : '1080/50I'}`, c.status.ok ? (c.genlock ? 'REF LOCK  ·  OK' : 'REF UNLOCK') : 'ALARME LIAISON'];
    }
    if (key === 'rcp') {
      const p = c.paint;
      st.btn.bars = p.bars; st.btn.campw = c.powerOn !== false; st.btn.active = c.panelActive !== false; st.btn.autoiris = p.autoIris; st.btn.close = p.irisClose;
      st.btn.flare = !!S.rcpFlare; st.btn.preview = ROUTER.map.AUX_VISION === 'CAM' + c.id; st.btn.callbtn = S.time - (p.call || -99) < 3;
      st.lcd.lcd = [`CAM ${c.id}   ${t === 2 ? '● ON AIR' : t === 1 ? '● PVW' : ''}`, `IRIS F${fmt(c.effAperture(), 1)}   M.BLK ${p.mblack}`, `GAIN ${p.gain > 0 ? '+' : ''}${p.gain} dB   ND ${ND_FILTERS[p.nd].label.split(' ')[0]}`, `SHUT ${SHUTTERS[p.shutter].label}   ${c.hfr > 1 ? 'HFR ' + c.hfr + 'x' : '50P'}`, `W R${p.wbR} G${p.wbG} B${p.wbB}`, `DTL ${p.detailOn ? p.detail : 'OFF'}  KNEE ${p.kneeOn ? p.knee : 'OFF'}`];
      st.knob['white:R'] = p.wbR; st.knob['white:G'] = p.wbG; st.knob['white:B'] = p.wbB;
      st.knob['black:R'] = p.blackR; st.knob['black:G'] = p.blackG; st.knob['black:B'] = p.blackB;
      const idx = IRIS_STOPS.findIndex((v) => v >= p.iris - 0.01);
      st.joy = { y: clamp((idx < 0 ? IRIS_STOPS.length - 1 : idx) / (IRIS_STOPS.length - 1), 0, 1), ring: p.mblack / 99 };
      st.btn.assign = [p.detailOn, p.kneeOn, p.gammaOn, p.matrixOn, p.blackGamma !== 0, false, p.nd > 0, p.shutter > 0, false];
    }
  }
  if (key === 'evs') {
    st.led.leds = 'green';
  }
  if (key === 'lsm') {
    const ch = EVS.ch[EVS.lsmCh ?? 0];
    st.lever = ch.lever;
    const T = (t) => tc(S.tcOffset + t);
    st.lcd.display = [`PGM${(EVS.lsmCh ?? 0) + 1}  CAM ${ch.cam}  ${ch.mode === 'live' ? 'E/E' : ch.playing ? '▶ ' + Math.round(ch.speed * 100) + '%' : 'PAUSE'}`, `TC ${T(ch.mode === 'live' ? S.simTime : ch.t)}`, `IN ${ch.in != null ? T(ch.in).slice(3) : '--'}  OUT ${ch.out != null ? T(ch.out).slice(3) : '--'}`, `PAGE ${EVS.page || 1}  ${evsLayout().label.slice(0, 40)}`];
  }
  if (key === 'mixpanel') {
    for (let i = 0; i < 12; i++) {
      const src = meSource(i + 1); st.label['oled:' + i] = src ? sourceLabel(src).replace('CAM ', 'C').slice(0, 6) : '—';
      st.btn[`xpt:0:${i}`] = MIX.key1.src === i + 1; st.btn[`xpt:1:${i}`] = MIX.pgm === i + 1; st.btn[`xpt:2:${i}`] = MIX.pst === i + 1;
    }
    st.lever = MIX.pos;
    st.lcd.menu = [`${EQUIP.mixer}`, `TRANS ${TRANS[MIX.trans]}`, `RATE ${MIX.rate}f`, `PGM ${sourceLabel(meSource(MIX.pgm))}`, `PST ${sourceLabel(meSource(MIX.pst))}`];
    st.btn.dsk = MIX.dsk1.on || MIX.dsk2.on;
  }
  if (key === 'router' && !S.ipMode) {
    // façade de la Videohub : la sortie choisie, sa source (ou la source préparée), le verrou
    const P = VH_PANEL, o = P.out, x = P.pending && P.inp ? P.inp : xpOf(o);
    st.lcd.lcd = [`OUT ${o}  ${outLabel(o)}${lockState(o) !== 'U' ? '  [LOCK]' : ''}`, `IN  ${x || '--'}  ${x ? inLabel(x) : ''}`, P.pending ? 'TAKE ?  (CLEAR pour annuler)' : '', S.format === 'UHD' ? '2160p50  12G-SDI' : S.format === 'HD' ? '1080p50  3G-SDI' : '1080i50  HD-SDI'];
    st.btn.out = P.mode === 'out'; st.btn.in = P.mode === 'in'; st.btn.take = P.pending; st.btn.clear = P.pending; st.btn.lock = lockState(o) !== 'U'; st.btn.menu = P.mode === 'menu';
    for (const k of ['led0', 'led1', 'led2', 'led3']) st.led[k] = 'green';
  }
  return st;
}

// ----------------------------------------------------------------------------------
// Dessin des éléments
// ----------------------------------------------------------------------------------
const PORT_R = { bnc: 11, lemo: 26, xlr: 15, multi: 12, jack: 7, rj45: 13, sfp: 17, dsub9: 18, dsub25: 28, dsub50: 37, iec: 17, usb: 11, sma: 7, optcon: 15, p17: 28, stud: 9 };
function drawPort(g, it, conn) {
  const k = it.k; const s = it.small ? 0.85 : 1;
  const grp = E('g', { transform: `translate(${it.x},${it.y}) scale(${s})` }, g);
  if (conn) {
    const r = (PORT_R[k] || 12) + 6;
    E('circle', { r, fill: 'none', stroke: conn.ok ? conn.color : '#ff3b30', 'stroke-width': 3.2, 'stroke-dasharray': conn.ok ? null : '4 3', opacity: 0.95 }, grp);
  }
  switch (k) {
    case 'bnc': E('circle', { r: 11, fill: '#c9ced3', stroke: '#7d858d' }, grp); E('circle', { r: 7, fill: '#2a2f35' }, grp); E('circle', { r: 2.2, fill: '#d9b85c' }, grp); break;
    case 'lemo': E('circle', { r: 26, fill: '#b9c0c7', stroke: '#6f777f', 'stroke-width': 2 }, grp); E('circle', { r: 19, fill: '#262a2f' }, grp); E('circle', { cy: -22, r: 3.2, fill: '#e04040' }, grp);
      for (const [x, y, c] of [[-6, -4, '#d9b85c'], [6, -4, '#d9b85c'], [-7, 7, '#9ad1ff'], [7, 7, '#9ad1ff']]) E('circle', { cx: x, cy: y, r: 3, fill: c }, grp); break;
    case 'xlr': { E('circle', { r: 15, fill: '#1d2126', stroke: '#9aa1a8', 'stroke-width': 2 }, grp); const n = /5/.test(it.l) || /INTERCOM|ICOM/.test(it.l) ? 5 : /DC|4P/.test(it.l) ? 4 : 3; for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + i * 2 * Math.PI / n; E('circle', { cx: Math.cos(a) * 7, cy: Math.sin(a) * 7, r: 2, fill: '#c8c8c8' }, grp); } break; }
    case 'multi': E('circle', { r: 12, fill: '#23272c', stroke: '#b0b6bc', 'stroke-width': 2 }, grp); for (let i = 0; i < 7; i++) { const a = i * 2 * Math.PI / 7; E('circle', { cx: Math.cos(a) * 6, cy: Math.sin(a) * 6, r: 1.3, fill: '#ddd' }, grp); } E('rect', { x: -1.5, y: -14, width: 3, height: 4, fill: '#b0b6bc' }, grp); break;
    case 'jack': E('circle', { r: 7, fill: '#111', stroke: '#aaa', 'stroke-width': 1.5 }, grp); E('circle', { r: 2.5, fill: '#555' }, grp); break;
    case 'rj45': E('rect', { x: -12, y: -10, width: 24, height: 20, rx: 2, fill: '#15181b', stroke: '#8b939b' }, grp); E('rect', { x: -7, y: -6, width: 14, height: 10, fill: '#30363c' }, grp); E('rect', { x: -4, y: 4, width: 8, height: 4, fill: '#15181b' }, grp); E('circle', { cx: -9, cy: -7, r: 1.6, fill: '#30ff60' }, grp); break;
    case 'sfp': E('rect', { x: -17, y: -8, width: 34, height: 16, rx: 1, fill: '#8b9096', stroke: '#5a6067' }, grp); E('rect', { x: -14, y: -5, width: 28, height: 10, fill: '#202428' }, grp); E('rect', { x: -9, y: -3, width: 7, height: 6, fill: '#3b82f6' }, grp); E('rect', { x: 2, y: -3, width: 7, height: 6, fill: '#3b82f6' }, grp); break;
    case 'dsub9': case 'dsub25': case 'dsub50': { const w = k === 'dsub9' ? 34 : k === 'dsub25' ? 54 : 72, h = k === 'dsub50' ? 22 : 17; E('path', { d: `M${-w / 2},${-h / 2} L${w / 2},${-h / 2} L${w / 2 - 4},${h / 2} L${-w / 2 + 4},${h / 2} Z`, fill: '#cfd3d6', stroke: '#7f868c' }, grp); E('path', { d: `M${-w / 2 + 4},${-h / 2 + 3} L${w / 2 - 4},${-h / 2 + 3} L${w / 2 - 7},${h / 2 - 3} L${-w / 2 + 7},${h / 2 - 3} Z`, fill: '#1c1f23' }, grp); const n = k === 'dsub9' ? 5 : k === 'dsub25' ? 12 : 17; for (let i = 0; i < n; i++) E('circle', { cx: -w / 2 + 8 + i * ((w - 16) / Math.max(1, n - 1)), cy: -2, r: 1, fill: '#d9b85c' }, grp); break; }
    case 'iec': E('rect', { x: -16, y: -12, width: 32, height: 24, rx: 3, fill: '#111', stroke: '#777' }, grp); for (const x of [-8, 0, 8]) E('rect', { x: x - 1.5, y: -5, width: 3, height: 9, fill: '#bbb' }, grp); break;
    case 'usb': E('rect', { x: -10, y: -6, width: 20, height: 12, rx: 1, fill: '#111', stroke: '#9aa1a8' }, grp); E('rect', { x: -6, y: -2, width: 12, height: 3, fill: '#4b5563' }, grp); break;
    case 'sma': E('circle', { r: 7, fill: '#d9b85c', stroke: '#8a6d2a' }, grp); E('circle', { r: 2.5, fill: '#333' }, grp); break;
    case 'optcon': E('circle', { r: 15, fill: '#2b2f33', stroke: '#9aa1a8', 'stroke-width': 2 }, grp); E('rect', { x: -6, y: -5, width: 12, height: 10, fill: '#0d4a8a' }, grp); break;
    case 'p17': E('circle', { r: 28, fill: '#c62828', stroke: '#7a1717', 'stroke-width': 2 }, grp); E('circle', { r: 19, fill: '#1c1c1c' }, grp); for (let i = 0; i < 5; i++) { const a = i * 2 * Math.PI / 5; E('circle', { cx: Math.cos(a) * 11, cy: Math.sin(a) * 11, r: 2.6, fill: '#ccc' }, grp); } break;
    case 'stud': E('circle', { r: 9, fill: '#b87333', stroke: '#6b3d17' }, grp); E('circle', { r: 3, fill: '#4d2a10' }, grp); break;
    default: E('circle', { r: 10, fill: '#777' }, grp);
  }
  const r = (PORT_R[k] || 12) * s;
  E('text', { x: it.x, y: it.y + r + 13, fill: '#cfd6dc', 'font-size': it.small ? 9.5 : 11, 'font-family': FONT, 'text-anchor': 'middle', 'letter-spacing': '0.03em' }, g, it.l);
  return grp;
}

const LEDC = { green: '#2fd25a', red: '#ff3b30', tally: '#ff2a2a', amber: '#ffb020', cyan: '#46c6f2' };
function drawItem(svg, it, st, def, conns, onPick) {
  const g = E('g', {}, svg);
  const pickId = it.id;
  if (pickId) { g.style.cursor = 'pointer'; g.dataset.id = pickId; g.addEventListener('click', (e) => { e.stopPropagation(); onPick(pickId); }); }
  switch (it.t) {
    case 'body': E('rect', { x: it.x, y: it.y, width: it.w, height: it.h, rx: it.r || 6, fill: 'url(#metal)', stroke: '#4a525b', 'stroke-width': 1.5 }, g); break;
    case 'group': E('rect', { x: it.x, y: it.y, width: it.w, height: it.h, rx: 6, fill: 'rgba(255,255,255,0.025)', stroke: '#48515a', 'stroke-dasharray': '3 3' }, g); E('text', { x: it.x + 8, y: it.y + 15, fill: '#93a0ab', 'font-size': 11, 'font-family': FONT, 'letter-spacing': '0.08em' }, g, (it.l || '').toUpperCase()); break;
    case 'text': E('text', { x: it.x, y: it.y, fill: '#e8edf1', 'font-size': it.size || 12, 'font-family': FONT, 'font-weight': it.w || 600, 'letter-spacing': '0.04em' }, g, it.s); break;
    case 'port': drawPort(g, it, conns[it.id]); break;
    case 'led': { const on = st.led[it.id]; E('circle', { cx: it.x, cy: it.y, r: 6.5, fill: on ? LEDC[on] : '#2a2d31', stroke: '#111', filter: on ? 'url(#glow)' : null }, g); if (it.l) E('text', { x: it.x, y: it.y + 20, fill: '#aab4bd', 'font-size': 10, 'font-family': FONT, 'text-anchor': 'middle' }, g, it.l); break; }
    case 'btn': { const lit = it.litKey ? st.btn[it.litKey] : st.btn[it.id]; const col = it.oled ? '#0c0f12' : lit ? (it.litColor || '#ffb020') : '#2f363e'; E('rect', { x: it.x, y: it.y, width: it.w, height: it.h, rx: 4, fill: col, stroke: lit ? '#ffd27a' : '#55606b' }, g); E('text', { x: it.x + it.w / 2, y: it.y + it.h / 2 + 4, fill: it.oled ? ({ cyan: '#46c6f2', green: '#2fd25a', amber: '#ffb020', violet: '#c77dff' }[it.c] || '#e8edf1') : lit ? '#1a1205' : '#dfe5ea', 'font-size': it.w < 60 ? 9.5 : 11, 'font-family': FONT, 'font-weight': 600, 'text-anchor': 'middle' }, g, (it.labelKey && st.label[it.labelKey]) || it.l); break; }
    case 'keys': { const arr = st.btn[it.id] || []; let k = 0; for (let r = 0; r < it.rows; r++) for (let c = 0; c < it.cols; c++) { const x = it.x + c * (it.w + it.gap), y = it.y + r * (it.h + it.gap); const lit = arr[k]; E('rect', { x, y, width: it.w, height: it.h, rx: 4, fill: lit ? '#1b4f73' : '#2f363e', stroke: lit ? '#46c6f2' : '#55606b' }, g); E('text', { x: x + it.w / 2, y: y + it.h / 2 + 4, fill: '#dfe5ea', 'font-size': 10, 'font-family': FONT, 'text-anchor': 'middle' }, g, it.labels[k]); k++; } break; }
    case 'knob': { const v = st.knob[`${it.id}:${it.l}`]; const a = (v != null ? clamp(v / 99, -1, 1) : 0) * 2.4 - Math.PI / 2; E('circle', { cx: it.x, cy: it.y, r: it.r, fill: '#3a424b', stroke: '#1a1d20', 'stroke-width': 2 }, g); E('line', { x1: it.x, y1: it.y, x2: it.x + Math.cos(a) * (it.r - 4), y2: it.y + Math.sin(a) * (it.r - 4), stroke: '#ffb020', 'stroke-width': 3, 'stroke-linecap': 'round' }, g); if (it.l) E('text', { x: it.x, y: it.y + it.r + 14, fill: '#aab4bd', 'font-size': 11, 'font-family': FONT, 'text-anchor': 'middle' }, g, it.l); break; }
    case 'sw': E('rect', { x: it.x - 9, y: it.y - 18, width: 18, height: 36, rx: 4, fill: '#15181b', stroke: '#6f777f' }, g); E('rect', { x: it.x - 5, y: it.y - 15, width: 10, height: 14, rx: 2, fill: '#c9ced3' }, g); E('text', { x: it.x, y: it.y + 32, fill: '#aab4bd', 'font-size': 10, 'font-family': FONT, 'text-anchor': 'middle' }, g, it.l); break;
    case 'lcd': { E('rect', { x: it.x, y: it.y, width: it.w, height: it.h, rx: 4, fill: '#0a1208', stroke: '#23401c' }, g); const lines = st.lcd[it.id] || ['—']; lines.forEach((l, i) => E('text', { x: it.x + 10, y: it.y + 20 + i * 18, fill: '#9dff8a', 'font-size': 13, 'font-family': 'JetBrains Mono, monospace' }, g, l)); break; }
    case 'bar': { const lv = st.bar[it.id] ?? 0.7; for (let i = 0; i < 10; i++) E('rect', { x: it.x + i * (it.w / 10), y: it.y, width: it.w / 10 - 2, height: it.h, fill: i / 10 < lv ? (i < 3 ? '#ffb020' : '#2fd25a') : '#22272c' }, g); E('text', { x: it.x + it.w + 8, y: it.y + 12, fill: '#aab4bd', 'font-size': 10, 'font-family': FONT }, g, it.l); break; }
    case 'joy': { const j = st.joy || { y: 0.5, ring: 0 }; E('circle', { cx: it.x, cy: it.y, r: it.r, fill: '#1a1d21', stroke: '#4a525b', 'stroke-width': 2 }, g); E('circle', { cx: it.x, cy: it.y, r: it.r - 8, fill: 'none', stroke: '#ffb020', 'stroke-width': 3, 'stroke-dasharray': `${(j.ring + 1) * 60} 400`, transform: `rotate(-90 ${it.x} ${it.y})` }, g); E('line', { x1: it.x, y1: it.y - it.r + 14, x2: it.x, y2: it.y + it.r - 14, stroke: '#30363c', 'stroke-width': 6, 'stroke-linecap': 'round' }, g); const hy = it.y + (j.y - 0.5) * (it.r - 22) * 2; E('circle', { cx: it.x, cy: hy, r: 16, fill: '#c9ced3', stroke: '#6f777f', 'stroke-width': 2 }, g); E('text', { x: it.x, y: it.y + it.r + 16, fill: '#aab4bd', 'font-size': 11, 'font-family': FONT, 'text-anchor': 'middle' }, g, it.l || 'IRIS (pousser/tirer) · M.BLACK (bague)'); break; }
    case 'lever': { const pos = Number(st.lever ?? 0.5); E('rect', { x: it.x, y: it.y, width: it.w, height: it.h, rx: 8, fill: '#15181b', stroke: '#4a525b' }, g); E('rect', { x: it.x + it.w / 2 - 3, y: it.y + 14, width: 6, height: it.h - 28, fill: '#2d3339' }, g); if (!it.fader) for (const [v, l] of [[1, '100'], [0.66, '66'], [0.5, '50'], [0.33, '33'], [0, '0']]) { const y = it.y + 14 + (1 - Number(v)) * (it.h - 28); E('text', { x: it.x + it.w + 6, y: y + 4, fill: '#93a0ab', 'font-size': 10, 'font-family': FONT }, g, l + ' %'); } const hy = it.y + 14 + (1 - pos) * (it.h - 28); E('rect', { x: it.x - 8, y: hy - 9, width: it.w + 16, height: 18, rx: 4, fill: '#ffb020' }, g); E('text', { x: it.x + it.w / 2, y: it.y + it.h + 18, fill: '#aab4bd', 'font-size': 11, 'font-family': FONT, 'text-anchor': 'middle' }, g, it.l || 'LEVIER'); break; }
    case 'jog': E('circle', { cx: it.x, cy: it.y, r: it.r, fill: '#2a3036', stroke: '#15181b', 'stroke-width': 3 }, g); E('circle', { cx: it.x, cy: it.y, r: it.r - 18, fill: '#353c43' }, g); E('circle', { cx: it.x + it.r * 0.55, cy: it.y - it.r * 0.35, r: 9, fill: '#1d2126' }, g); E('text', { x: it.x, y: it.y + 5, fill: '#93a0ab', 'font-size': 12, 'font-family': FONT, 'text-anchor': 'middle' }, g, 'JOG'); break;
    case 'disk': E('rect', { x: it.x, y: it.y, width: it.w, height: it.h, rx: 3, fill: '#1c2025', stroke: '#454d55' }, g); for (let i = 0; i < 8; i++) E('rect', { x: it.x + 10, y: it.y + 14 + i * 13, width: it.w - 20, height: 4, fill: '#2b3137' }, g); E('circle', { cx: it.x + it.w - 12, cy: it.y + it.h - 12, r: 3, fill: '#2fd25a' }, g); break;
    case 'psu': E('rect', { x: it.x, y: it.y, width: it.w, height: it.h, rx: 4, fill: '#1c2025', stroke: '#454d55' }, g); E('circle', { cx: it.x + it.w / 2, cy: it.y + 70, r: 44, fill: '#111', stroke: '#555' }, g); for (let i = 0; i < 5; i++) E('line', { x1: it.x + it.w / 2 - 40, y1: it.y + 50 + i * 10, x2: it.x + it.w / 2 + 40, y2: it.y + 50 + i * 10, stroke: '#333' }, g); drawPort(g, { k: 'iec', x: it.x + it.w / 2, y: it.y + it.h - 40, l: it.l }, conns[it.id]); break;
    case 'screen': drawLsmScreen(g, it, st); break;
    case 'cam-profile': drawCamProfile(g, def, st, onPick, conns); break;
  }
  return g;
}

function drawLsmScreen(g, it, st) {
  E('rect', { x: it.x, y: it.y, width: it.w, height: it.h, rx: 6, fill: '#05080b', stroke: '#3a4652', 'stroke-width': 2 }, g);
  const s = st.screen; const ch = s ? s.ch : null;
  E('rect', { x: it.x + 6, y: it.y + 6, width: it.w - 12, height: 24, fill: '#14202c' }, g);
  E('text', { x: it.x + 14, y: it.y + 23, fill: '#cfe8ff', 'font-size': 12, 'font-family': 'JetBrains Mono, monospace' }, g, `PAGE 1 · BANK 1 · REC XT-VIA · CONTRÔLE ${s ? 'PGM' + s.n : 'PGM1'} · ${ch ? (ch.mode === 'live' ? 'E/E' : ch.playing ? 'PLAY ' + Math.round(ch.speed * 100) + '%' : 'PAUSE') : ''}`);
  for (let i = 0; i < 10; i++) {
    const cl = EVS.clips[i]; const x = it.x + 10 + (i % 5) * 120, y = it.y + 40 + Math.floor(i / 5) * 56;
    E('rect', { x, y, width: 112, height: 48, rx: 4, fill: cl ? '#1b3a55' : '#11171d', stroke: '#2c3a47' }, g);
    E('text', { x: x + 6, y: y + 16, fill: '#ffd23f', 'font-size': 11, 'font-family': 'JetBrains Mono, monospace' }, g, `F${i + 1}`);
    E('text', { x: x + 6, y: y + 34, fill: '#cfe8ff', 'font-size': 10, 'font-family': 'JetBrains Mono, monospace' }, g, cl ? `CAM ${cl.cam} ${tc(S.tcOffset + cl.in).slice(3)}` : 'vide');
  }
  if (ch) E('text', { x: it.x + 14, y: it.y + it.h - 14, fill: '#9dff8a', 'font-size': 14, 'font-family': 'JetBrains Mono, monospace' }, g, `TC ${tc(S.tcOffset + (ch.mode === 'live' ? S.simTime : ch.t))}  CAM ${ch.cam}  IN ${ch.in != null ? tc(S.tcOffset + ch.in).slice(3) : '--'}  OUT ${ch.out != null ? tc(S.tcOffset + ch.out).slice(3) : '--'}`);
}

function drawCamProfile(g, def, st, onPick, conns) {
  const cam = VIEW.ctxCam;
  const box = !cam || cam.L.kind === 'box';
  const pick = (id) => (e) => { e.stopPropagation(); onPick(id); };
  const part = (id, el_) => { el_.style.cursor = 'pointer'; el_.addEventListener('click', pick(id)); return el_; };
  // tête de pied et bras
  E('rect', { x: 330, y: 352, width: 420, height: 18, rx: 4, fill: '#3a4048' }, g);
  E('rect', { x: 500, y: 370, width: 90, height: 50, fill: '#2b3036' }, g);
  part('zoomdemand', E('line', { x1: 690, y1: 350, x2: 930, y2: 410, stroke: '#9aa1a8', 'stroke-width': 9, 'stroke-linecap': 'round' }, g));
  part('zoomdemand', E('rect', { x: 900, y: 396, width: 46, height: 26, rx: 5, fill: '#ffb020' }, g));
  part('focusdemand', E('circle', { cx: 880, cy: 360, r: 15, fill: '#46c6f2' }, g));
  // corps
  part('sidepanel', E('rect', { x: 430, y: 175, width: 270, height: 175, rx: 12, fill: '#2a2f35', stroke: '#4a525b', 'stroke-width': 2 }, g));
  E('rect', { x: 480, y: 140, width: 170, height: 26, rx: 8, fill: '#1f2328' }, g);
  part('sidepanel', E('rect', { x: 560, y: 215, width: 100, height: 42, rx: 3, fill: '#0a1208', stroke: '#23401c' }, g));
  E('text', { x: 568, y: 240, fill: '#9dff8a', 'font-size': 11, 'font-family': 'JetBrains Mono, monospace' }, g, cam ? `CAM ${cam.id}` : 'MENU');
  // optique
  if (box) {
    part('lensbody', E('rect', { x: 60, y: 140, width: 370, height: 210, rx: 18, fill: '#e9eaeb', stroke: '#b9bec4', 'stroke-width': 2 }, g));
    part('lensbody', E('ellipse', { cx: 62, cy: 245, rx: 22, ry: 100, fill: '#20252b', stroke: '#888' }, g));
    E('text', { x: 130, y: 250, fill: '#2a2f35', 'font-size': 18, 'font-family': FONT, 'font-weight': 700 }, g, cam ? cam.L.name : 'Optique box');
    E('text', { x: 130, y: 272, fill: '#555', 'font-size': 12, 'font-family': FONT }, g, cam ? `${cam.L.fmin}–${cam.L.fmax} mm · doubleur x2` : '');
  } else {
    part('lensbody', E('rect', { x: 250, y: 205, width: 185, height: 100, rx: 14, fill: cam && cam.L.name.startsWith('Canon') ? '#e9eaeb' : '#222', stroke: '#888', 'stroke-width': 2 }, g));
    part('lensbody', E('ellipse', { cx: 250, cy: 255, rx: 14, ry: 52, fill: '#20252b' }, g));
    part('retsw', E('rect', { x: 340, y: 300, width: 70, height: 46, rx: 8, fill: '#1c2025', stroke: '#555' }, g));
    E('text', { x: 345, y: 328, fill: '#ffb020', 'font-size': 11, 'font-family': FONT }, g, 'RET · ZOOM');
    E('text', { x: 270, y: 260, fill: cam && cam.L.name.startsWith('Canon') ? '#2a2f35' : '#ddd', 'font-size': 13, 'font-family': FONT, 'font-weight': 700 }, g, cam ? cam.L.name.replace(/^(Canon|Fujinon) /, '') : 'Optique');
  }
  // viseur
  part('vfdisp', E('rect', { x: box ? 450 : 470, y: box ? 30 : 92, width: box ? 240 : 150, height: box ? 108 : 52, rx: 8, fill: '#1c2025', stroke: '#4a525b', 'stroke-width': 2 }, g));
  part('vfdisp', E('rect', { x: box ? 462 : 480, y: box ? 42 : 100, width: box ? 216 : 130, height: box ? 84 : 36, fill: '#0f2a18' }, g));
  part('fronttally', E('circle', { cx: box ? 465 : 480, cy: box ? 30 : 92, r: 8, fill: st.led.tally ? '#ff2a2a' : '#4a1515', filter: st.led.tally ? 'url(#glow)' : null }, g));
  // connecteurs visibles
  const ports = [['lens', 'multi', 438, 300, 'LENS 12P'], ['vf', 'multi', 560, 160, 'VF 20P'], ['mic1', 'xlr', 445, 205, 'MIC 1'], ['ccu', 'lemo', 680, 320, '']];
  for (const [id, k, x, y, l] of ports) { const gg = E('g', {}, g); gg.style.cursor = 'pointer'; gg.addEventListener('click', pick(id)); drawPort(gg, { k, x, y, l, small: true }, conns[id]); }
  E('text', { x: 20, y: 30, fill: '#93a0ab', 'font-size': 12, 'font-family': FONT }, g, 'Cliquez sur une partie de la caméra · disposition schématique');
}

// ----------------------------------------------------------------------------------
// Visionneuse
// ----------------------------------------------------------------------------------
const VIEW = { key: null, n: 1, view: null, sel: null, svgHost: null, info: null, timer: 0, ctxCam: null };
// ce que montre la visionneuse (pour le chef de car) : appareil, face, élément choisi ; null si fermée
export function viewerState() { return modal.isOpen && VIEW.svgHost && VIEW.svgHost.isConnected ? { key: VIEW.key, n: VIEW.n, view: VIEW.view, sel: VIEW.sel } : null; }

function genericDef(key, n) {
  const cables = deviceCables(key, n);
  const ports = {}; const items = [];
  const seen = [];
  for (const c of cables) { const e = c.a.dev === key && c.a.n === n ? c.a : c.b; if (!seen.includes(e.port)) seen.push(e.port); }
  const kindOf = (sig) => ({ ip: 'rj45', power: 'iec', comms: 'xlr', audio: 'bnc', ref: 'bnc', fiber: 'optcon', rf: 'sma', data: 'multi', video: 'bnc' }[sig] || 'bnc');
  const cols = Math.max(1, Math.min(10, seen.length));
  const w = Math.max(520, cols * 90 + 80), h = 120 + Math.ceil(seen.length / cols) * 90;
  items.push({ t: 'body', x: 10, y: 10, w: w - 20, h: h - 20 }, { t: 'text', x: 26, y: 34, s: (DEV_NAMES[key] || key).toUpperCase() + ' · connexions utilisées dans ce car', size: 13 });
  seen.forEach((p, i) => {
    const c = cables.find((x) => (x.a.dev === key && x.a.n === n && x.a.port === p) || (x.b.dev === key && x.b.n === n && x.b.port === p));
    const k = kindOf(c.sig);
    items.push({ t: 'port', id: p, k, x: 60 + (i % cols) * 90, y: 90 + Math.floor(i / cols) * 90, l: portName(key, p) });
    ports[p] = { n: portName(key, p), c: { ip: 'RJ-45 / fibre', power: 'Secteur', comms: 'XLR / RJ-45', fiber: 'Fibre', rf: 'RF', data: 'Données' }[c.sig] || 'BNC 75 Ω', s: c.sig, d: 'io', std: '', desc: c.type };
  });
  return { key, title: DEV_NAMES[key] || key, generic: true, intro: 'Appareil représenté de manière simplifiée : seules les connexions utilisées dans votre installation sont affichées.', views: { arriere: { label: 'Connexions', w, h, items } }, ports, controls: {}, specs: [], lesson: [] };
}

function instances(key) {
  if (key === 'cam') return S.cams.map((c) => [c.id, `CAM ${c.id} · ${c.T.short}`]);
  if (key === 'ccu' || key === 'rcp') return S.cams.filter(isSystemCam).map((c) => [c.id, `${key.toUpperCase()} ${c.id} · CAM ${c.id}`]);
  if (key === 'lsm') return [...Array(EQUIP.lsmCount).keys()].map((i) => [i + 1, `LSM ${i + 1}${EQUIP.lsmCount === 1 ? ' · pilote PGM1 et PGM2' : i ? ' · PGM2' : ' · PGM1'}`]);
  if (key === 'evs') return [...Array(EQUIP.evsServers).keys()].map((i) => [i + 1, `XT4K n° ${i + 1}`]);
  if (key === 'conv') return S.cams.filter((c) => !isSystemCam(c) && c.link !== 'hf').map((c) => [c.id, `Convertisseur CAM ${c.id}`]);
  return null;
}

function connMap(key, n) {
  const map = {};
  for (const c of deviceCables(key, n)) {
    const mine = c.a.dev === key && c.a.n === n ? c.a : c.b;
    (map[mine.port] ||= []).push(c);
  }
  const conns = {};
  for (const p in map) { const arr = map[p]; conns[p] = { ok: arr.every((c) => c.ok), color: SIG[arr[0].sig] ? SIG[arr[0].sig].color : '#999', cables: arr }; }
  return conns;
}

function devPhotos(def) { return (CFG.photos && CFG.photos.list ? CFG.photos.list : []).filter((p) => p.device === def.key); }
function renderPhoto(p) {
  const host = VIEW.svgHost; host.innerHTML = '';
  const wrap = el('div', { class: 'photo-view' }, el('img', { src: photoUrl(p), alt: p.title }));
  p.hotspots.forEach((h, j) => wrap.appendChild(el('button', { class: 'hs' + (VIEW.photoSel === j ? ' on' : ''), style: { left: h.x * 100 + '%', top: h.y * 100 + '%' }, title: h.label, onclick: () => { VIEW.photoSel = j; VIEW.sel = h.port && (VIEW.def.ports[h.port] || VIEW.def.controls[h.port]) ? h.port : null; if (VIEW.sel) (S.seenPort ||= {})[VIEW.def.key + ':' + VIEW.sel] = true; renderPhoto(p); renderInfo(); } }, String(j + 1))));
  host.append(wrap, el('p', { class: 'note' }, `Photo de votre matériel · ${p.hotspots.length} point(s) cliquable(s)`));
}
function renderSvg() {
  const def = VIEW.def;
  if (VIEW.view.startsWith('photo')) { const p = devPhotos(def)[+VIEW.view.slice(5)]; if (p) { renderPhoto(p); return; } VIEW.view = Object.keys(def.views)[0]; }
  const v = def.views[VIEW.view];
  const host = VIEW.svgHost; host.innerHTML = '';
  const svg = E('svg', { viewBox: `0 0 ${v.w} ${v.h}`, width: '100%', role: 'img', 'aria-label': def.title }, host);
  svg.style.maxHeight = '64vh'; svg.style.display = 'block';
  const defs = E('defs', {}, svg);
  const lg = E('linearGradient', { id: 'metal', x1: 0, y1: 0, x2: 0, y2: 1 }, defs); E('stop', { offset: '0', 'stop-color': '#343a41' }, lg); E('stop', { offset: '1', 'stop-color': '#262b30' }, lg);
  const f = E('filter', { id: 'glow', x: '-50%', y: '-50%', width: '200%', height: '200%' }, defs); E('feGaussianBlur', { stdDeviation: 3, result: 'b' }, f); const mg = E('feMerge', {}, f); E('feMergeNode', { in: 'b' }, mg); E('feMergeNode', { in: 'SourceGraphic' }, mg);
  const st = liveState(def.key, VIEW.n);
  const conns = connMap(def.generic ? def.key : (def.key), VIEW.n);
  for (const it of v.items) drawItem(svg, it, st, def, conns, (id) => { VIEW.sel = id; (S.seenPort ||= {})[def.key + ':' + id] = true; emit('device', { type: 'sel', key: def.key, id }); renderInfo(); highlight(); });
  highlight();
}
function highlight() {
  if (!VIEW.svgHost) return;
  VIEW.svgHost.querySelectorAll('[data-id]').forEach((g) => { g.style.filter = g.dataset.id === VIEW.sel ? 'drop-shadow(0 0 6px #ffb020) drop-shadow(0 0 2px #ffb020)' : ''; });
}

function chip(text, color) { return el('span', { class: 'pill', style: { borderColor: color || 'var(--line2)' } }, color ? el('span', { class: 'dot', style: { background: color } }) : null, text); }
function renderInfo() {
  const def = VIEW.def; const box = VIEW.info; box.innerHTML = '';
  const id = VIEW.sel;
  const meta = id ? (def.ports[id] || def.controls[id]) : null;
  if (VIEW.view.startsWith('photo') && VIEW.photoSel != null) {
    const p = devPhotos(def)[+VIEW.view.slice(5)]; const h = p && p.hotspots[VIEW.photoSel];
    if (h) { box.append(el('h3', { class: 'eq-h' }, `${VIEW.photoSel + 1}. ${h.label || 'Point'}`)); if (h.desc) box.append(el('p', { class: 'prose' }, h.desc)); }
    if (!meta) { box.append(el('button', { class: 'btn small', onclick: () => { VIEW.photoSel = null; renderInfo(); renderSvg(); } }, 'Retour à la fiche de l\'appareil')); return; }
  }
  if (meta) {
    const isPort = !!def.ports[id];
    box.append(el('h3', { class: 'eq-h' }, meta.n));
    box.append(el('div', { class: 'hwrow' }, chip(meta.c), meta.s && SIG[meta.s] ? chip(SIG[meta.s].label, SIG[meta.s].color) : null, meta.d ? chip(meta.d === 'in' ? 'Entrée' : meta.d === 'out' ? 'Sortie' : 'Entrée / sortie') : null));
    if (meta.std) box.append(el('p', { class: 'note' }, el('b', {}, 'Norme / signal : '), meta.std));
    box.append(el('p', { class: 'prose' }, meta.desc));
    if (isPort) box.append(liveLinks(def, id));
    if (!isPort && CONTROL_HINT[def.key + ':' + id]) box.append(el('p', { class: 'note ok' }, CONTROL_HINT[def.key + ':' + id]));
    box.append(el('button', { class: 'btn small', onclick: () => { VIEW.sel = null; renderInfo(); highlight(); } }, 'Retour à la fiche de l\'appareil'));
    return;
  }
  box.append(el('p', { class: 'prose' }, def.intro));
  if (def.specs.length) { const dl = el('dl', { class: 'kv' }); for (const [k, v] of def.specs) dl.append(el('dt', {}, k), el('dd', {}, v)); box.append(el('h3', { class: 'eq-h' }, 'Caractéristiques'), dl); }
  if (def.lesson.length) box.append(el('h3', { class: 'eq-h' }, 'Sur le terrain'), el('ul', { class: 'steps prose' }, def.lesson.map((l) => el('li', {}, l))));
  const cables = deviceCables(def.key, VIEW.n);
  if (cables.length) {
    box.append(el('h3', { class: 'eq-h' }, `Raccordements dans votre car (${cables.length})`));
    const list = el('div', { class: 'list' });
    for (const c of cables.slice(0, 40)) list.appendChild(cableRow(c, def.key, VIEW.n));
    if (cables.length > 40) list.appendChild(el('p', { class: 'note' }, `… et ${cables.length - 40} autres (voir la liste de câblage au poste chef de car).`));
    box.append(list);
  }
  box.append(el('p', { class: 'note' }, 'Cliquez sur un connecteur ou une commande pour son rôle. Les anneaux de couleur montrent les connecteurs câblés dans votre installation (rouge pointillé : liaison en défaut).'));
}
function cableRow(c, key, n) {
  const mine = c.a.dev === key && c.a.n === n ? c.a : c.b; const other = mine === c.a ? c.b : c.a;
  return el('div', { class: 'item' }, el('span', { class: 'dot', style: { background: SIG[c.sig] ? SIG[c.sig].color : '#999' } }),
    el('div', { class: 'grow' }, el('div', { class: 't' }, `${portName(key, mine.port)} ${mine === c.a ? '→' : '←'} ${endLabel(other)}`), el('div', { class: 's' }, `${c.n} · ${c.type}${c.len ? ' · ' + c.len + ' m' : ''}${c.note ? ' · ' + c.note : ''}${c.ok ? '' : ' · DÉFAUT'}`)),
    el('button', { class: 'btn small', onclick: () => { (S.flags ||= {}).followed = true; openDevice(other.dev, other.n, { focus: other.port }); } }, 'Suivre'));
}
function liveLinks(def, id) {
  const box = el('div', { class: 'list' });
  const cables = deviceCables(def.key, VIEW.n).filter((c) => (c.a.dev === def.key && c.a.n === VIEW.n && c.a.port === id) || (c.b.dev === def.key && c.b.n === VIEW.n && c.b.port === id));
  box.append(el('h3', { class: 'eq-h' }, 'Dans votre installation'));
  if (def.key === 'router') {
    const m = /^(in|out)(\d+)$/.exec(id);
    if (m && m[1] === 'in') box.append(el('p', { class: 'note' }, `Source câblée : ${routerInLabel(+m[2]) || 'non utilisée'}.`));
    if (m && m[1] === 'out') { const x = routerCrosspoint(+m[2]); box.append(el('p', { class: 'note' }, `Destination : ${routerOutLabel(+m[2]) || 'non utilisée'}. Point de croisement actuel : ${x ? 'IN ' + x + ' (' + routerInLabel(x) + ')' : 'aucun'}.`)); }
  }
  if (!cables.length) box.append(el('p', { class: 'note' }, 'Connecteur libre (non utilisé dans cette configuration).'));
  for (const c of cables) box.append(cableRow(c, def.key, VIEW.n));
  return box;
}

const CONTROL_HINT = {
  'rcp:joystick': 'Dans le simulateur : poste Ingé vision, bloc joystick (glisser verticalement = iris, faire tourner la bague = master black).',
  'rcp:white': 'Dans le simulateur : molettes WHITE R/G/B du poste Ingé vision.', 'rcp:black': 'Dans le simulateur : molettes BLACK/FLARE du poste Ingé vision.',
  'rcp:active': 'Dans le simulateur : si PANEL ACTIVE est éteint, le RCP refuse les réglages.', 'rcp:campw': 'Dans le simulateur : couper CAM PW éteint la caméra (PAS DE SIGNAL au multiview).',
  'ccu:campower': 'Dans le simulateur : c\'est la touche CAM PW du RCP qui agit sur cette alimentation.', 'lsm:lever': 'Dans le simulateur : levier du poste EVS.', 'lsm:jog': 'Dans le simulateur : molette jog du poste EVS (glisser ou molette de la souris).',
  'mixpanel:xpt': 'Dans le simulateur : rangées de boutons du poste Truquiste.', 'mixpanel:trans': 'Dans le simulateur : module de transition du poste Truquiste (MIX, WIPE, DME, CLIP, CUT, AUTO, levier).', 'mixpanel:snap': 'Dans le simulateur : boutons SNAPSHOT du poste Truquiste.',
};

export function openDevice(key, n = 1, opts = {}) {
  let def = deviceDef(key);
  const inst = instances(key);
  if (inst && inst.length && !inst.find((x) => x[0] === n)) n = inst[0][0];
  if (!def) def = genericDef(key, n);
  VIEW.key = key; VIEW.n = n; VIEW.def = def; VIEW.sel = opts.focus && (def.ports[opts.focus] || def.controls[opts.focus]) ? opts.focus : null;
  VIEW.ctxCam = key === 'cam' ? camById(n) : null;
  VIEW.view = opts.view && def.views[opts.view] ? opts.view : Object.keys(def.views)[0];
  if (VIEW.sel && !def.views[VIEW.view].items.some((it) => it.id === VIEW.sel)) { const v = Object.keys(def.views).find((k) => def.views[k].items.some((it) => it.id === VIEW.sel)); if (v) VIEW.view = v; emit('device', { type: 'view', key: VIEW.key, view: v }); }
  const tabs = el('div', { class: 'tabs' });
  VIEW.photoSel = null;
  devPhotos(def).forEach((p, i) => tabs.appendChild(el('button', { class: 'tab', 'data-v': 'photo' + i, onclick: () => { VIEW.view = 'photo' + i; VIEW.photoSel = null; [...tabs.children].forEach((b) => b.classList.toggle('on', b.dataset.v === VIEW.view)); renderSvg(); renderInfo(); } }, 'Photo · ' + (p.title || i + 1))));
  for (const v of Object.keys(def.views)) tabs.appendChild(el('button', { class: 'tab' + (v === VIEW.view ? ' on' : ''), onclick: () => { VIEW.view = v; emit('device', { type: 'view', key: VIEW.key, view: v }); [...tabs.children].forEach((b) => b.classList.toggle('on', b.dataset.v === v)); renderSvg(); } , 'data-v': v }, def.views[v].label));
  const bar = el('div', { class: 'hwrow' }, tabs);
  if (inst && inst.length > 1) { const s = el('select', { id: 'eqinst' }); for (const [v, l] of inst) { const o = el('option', { value: v }, l); if (v === n) o.selected = true; s.appendChild(o); } s.onchange = () => openDevice(key, +s.value, { view: VIEW.view }); bar.prepend(s); }
  bar.append(el('button', { class: 'btn small', onclick: () => openEquipmentIndex() }, 'Tout le matériel'), el('button', { class: 'btn small', onclick: () => openReport('Matériel · ' + def.title + (VIEW.sel ? ' · ' + VIEW.sel : '')) }, 'Signaler une erreur'));
  const legend = el('div', { class: 'hwrow note' }, ...Object.values(SIG).map((s) => el('span', { class: 'pill', style: { borderColor: s.color } }, el('span', { class: 'dot', style: { background: s.color } }), s.label)));
  VIEW.svgHost = el('div', { class: 'eq-svg' });
  VIEW.info = el('div', { class: 'eq-info' });
  const body = el('div', { class: 'list' }, bar, el('div', { class: 'eq-grid' }, VIEW.svgHost, VIEW.info), legend,
    el('p', { class: 'note' }, 'Inventaire des connecteurs établi d\'après les fiches techniques des constructeurs ; la disposition sur la face est schématique.'));
  modal.open(def.title + (inst ? ` · n° ${n}` : ''), body, { width: 1280 });
  renderSvg(); renderInfo();
  emit('device', { type: 'open', key, n });
  clearInterval(VIEW.timer);
  VIEW.timer = setInterval(() => { if (!modal.isOpen || !VIEW.svgHost.isConnected) { clearInterval(VIEW.timer); return; } if (['ccu', 'rcp', 'lsm', 'cam', 'mixpanel'].includes(key)) { renderSvg(); } }, 700);
}

export function openEquipmentIndex() {
  const groups = [
    ['Chaîne caméra', ['cam', 'ccu', 'rcp', 'conv']], ['Ralentis', ['evs', 'lsm', 'ipd']], ['Mélangeur', ['mixer', 'mixpanel', 'siu']], ['Commutation et traitement', ['router', 'mv']], ['Synchronisation', ['spg', 'da']], ['Liaisons', ['rx', 'pdc']],
  ];
  const body = el('div', { class: 'list' }, el('p', { class: 'note' }, 'Faces avant et arrière, connecteurs, signaux et raccordements réels de votre installation.'), el('button', { class: 'btn', onclick: () => emit('openSynoptics') }, 'Synoptiques du car (vidéo, synchro, audio, intercom, réseaux, énergie, baies)'));
  for (const [g, keys] of groups) {
    body.append(el('h3', { class: 'eq-h' }, g));
    const row = el('div', { class: 'grid2' });
    for (const k of keys) { const d = DEVICES[k]; const label = DEVICE_LIST.find((x) => x[0] === k)?.[1] || d.title; row.appendChild(el('button', { class: 'choice', onclick: () => openDevice(k, (instances(k) || [[1]])[0]?.[0] ?? 1) }, el('b', { style: { fontSize: '17px' } }, label), el('span', {}, d.title))); }
    body.append(row);
  }
  modal.open('Matériel du car', body, { width: 980 });
}

// @ts-check
import { el } from '../util.js';
import { registerChapter } from './index.js';
import { figure, sv, canvas, slider, choice, readout, fmtNum } from './kit.js';

// ----------------------------------------------------------------------------------
// Chapitre « Les ralentis » : le serveur (enregistrement en boucle de toutes les caméras, trains,
// IN et OUT, vitesse au levier, super ralenti 3× à 150 images/s) puis les clips, IPDirector et
// les playlists. Les manipulations calculent ce que montre vraiment la sortie du serveur : quelle
// image enregistrée part à chaque image de sortie (50 images/s), et la durée d'une playlist.
// ----------------------------------------------------------------------------------
const C = { grey: '#8a949c', amber: '#ffd38a', red: '#ff8a80', green: '#7fd1a0', cyan: '#7fd3f3', box: '#1a2026', line: '#2a3238', tally: '#f0372c', pvw: '#33c46c' };
// more.fill : la couleur du texte, passée en style (la classe du schéma imposerait sinon la sienne)
const txt = (x, y, s, cls = 'co-s', anchor = 'middle', more = {}) => sv('text', { x, y, textAnchor: anchor, class: cls, ...(more.fill ? { style: `fill: ${more.fill}` } : {}) }, s);
const box = (x, y, w, h, stroke = C.grey, fill = C.box) => sv('rect', { x, y, width: w, height: h, rx: 3, fill, stroke, strokeWidth: 1.2 });
const arrow = (x1, y1, x2, y2, col = C.grey) => {
  const a = Math.atan2(y2 - y1, x2 - x1), s = 6, g = sv('g', {});
  g.append(sv('line', { x1, y1, x2, y2, stroke: col, strokeWidth: 1.4 }), sv('path', { d: `M${x2} ${y2} L${x2 - s * Math.cos(a - 0.45)} ${y2 - s * Math.sin(a - 0.45)} L${x2 - s * Math.cos(a + 0.45)} ${y2 - s * Math.sin(a + 0.45)} Z`, fill: col }));
  return g;
};
const fmtS = (s, d = 1) => fmtNum(s, d) + ' s';
/** timecode HH:MM:SS:II (25 numéros d'image par seconde, de 00 à 24) */
function tc(sec) {
  const f = Math.max(0, Math.floor(sec * 25 + 1e-6)), p = (n) => String(n).padStart(2, '0');
  return `${p(Math.floor(f / 90000) % 24)}:${p(Math.floor(f / 1500) % 60)}:${p(Math.floor(f / 25) % 60)}:${p(f % 25)}`;
}
const OUT_FPS = 50; // sortie du serveur en 1080p50
/** vitesse lue au levier, en fraction du temps réel : « 33 % » et « 67 % » valent un tiers et deux tiers exactement, comme les vitesses préréglées */
const lever = (pct) => (pct === 33 ? 1 / 3 : pct === 67 ? 2 / 3 : pct / 100);

// ======================================================================================
// 1. Le serveur : trains, IN, OUT, vitesse
// ======================================================================================
// trente secondes d'enregistrement, de 21:12:20:00 à 21:12:50:00 ; un tir à 21 s (21:12:41:00), au fond à 22,4 s
const T0 = ((21 * 60 + 12) * 60 + 20), SPAN = 30, KICK = 21, GOAL = 22.4;
const ANGLES = [
  { id: 'cam1', name: 'CAM 1', role: 'large', hfr: 1 },
  { id: 'cam2', name: 'CAM 2', role: 'serré', hfr: 1 },
  { id: 'cam3', name: 'CAM 3', role: 'super ralenti 3×', hfr: 3 },
  { id: 'cam4', name: 'CAM 4', role: 'derrière le but', hfr: 1 },
];
// les trains enregistrés : une entrée par caméra, trois pour la caméra 3× (phases A, B, C)
const TRAINS = [['CAM 1', 0], ['CAM 2', 1], ['CAM 3 · A', 2], ['CAM 3 · B', 2], ['CAM 3 · C', 2], ['CAM 4', 3]];
const SANG = '#c8102e', OR = '#f2c200';
function man(g, x, y, s, shirt) {
  g.fillStyle = '#e8e8e8'; g.fillRect(x - s * 0.35, y - s * 0.9, s * 0.7, s * 0.4);
  g.fillStyle = shirt; g.fillRect(x - s * 0.4, y - s * 1.7, s * 0.8, s * 0.85);
  g.fillStyle = '#c99a78'; g.beginPath(); g.arc(x, y - s * 2, s * 0.32, 0, 7); g.fill();
  g.fillStyle = '#20262a'; g.fillRect(x - s * 0.3, y - s * 0.5, s * 0.2, s * 0.5); g.fillRect(x + s * 0.1, y - s * 0.5, s * 0.2, s * 0.5);
}
// position du ballon (0 à 1 du point de frappe au filet) et du tireur, à l'instant t de l'enregistrement
const flight = (t) => Math.min(1, Math.max(0, (t - KICK) / (GOAL - KICK)));
const runner = (t) => Math.min(1, Math.max(0, (t - 17) / (KICK - 17)));
function drawAction(g, w, h, angle, t) {
  const b = flight(t), r = runner(t);
  if (angle === 3) { // derrière le but : le filet devant, le ballon arrive vers la caméra
    g.fillStyle = '#2f7a32'; g.fillRect(0, 0, w, h); g.fillStyle = '#1b2228'; g.fillRect(0, 0, w, h * 0.22);
    man(g, w * (0.4 + 0.1 * r), h * (0.62 + 0.08 * r), h * (0.1 + 0.05 * r), SANG);
    man(g, w * 0.5 + Math.sin(t * 3) * w * 0.05, h * 0.9, h * 0.22, '#1f8f5a'); // le gardien, de dos
    const s = h * (0.015 + 0.06 * b * b);
    g.fillStyle = '#fff'; g.beginPath(); g.arc(w * (0.45 + 0.15 * b), h * (0.6 - 0.25 * b), s, 0, 7); g.fill();
    g.strokeStyle = 'rgba(230,235,240,0.5)'; g.lineWidth = 1;
    for (let x = 0; x <= w; x += w / 24) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 0; y <= h; y += h / 14) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    return;
  }
  g.fillStyle = '#2f7a32'; g.fillRect(0, 0, w, h);
  if (angle === 0) { // plan large : le but à droite
    g.fillStyle = '#1b2228'; g.fillRect(0, 0, w, h * 0.25);
    for (let k = 0; k < 6; k++) { g.fillStyle = k % 2 ? '#2f7a32' : '#378338'; g.fillRect(k * w / 6, h * 0.25, w / 6, h); }
    g.strokeStyle = '#f4f4f0'; g.lineWidth = 2; g.strokeRect(w * 0.9, h * 0.42, w * 0.08, h * 0.2);
    g.strokeStyle = 'rgba(240,240,235,0.8)'; g.lineWidth = 1; g.strokeRect(w * 0.72, h * 0.3, w * 0.3, h * 0.48);
    const px = w * (0.45 + 0.2 * r);
    man(g, px, h * 0.6, h * 0.05, SANG); man(g, w * 0.93, h * 0.6, h * 0.05, '#1f8f5a');
    const bx = b > 0 ? w * (0.67 + 0.27 * b) : px + w * 0.02, by = b > 0 ? h * (0.6 - 0.12 * Math.sin(b * Math.PI) - 0.06 * b) : h * 0.6;
    g.fillStyle = '#fff'; g.beginPath(); g.arc(bx, by, 2.5, 0, 7); g.fill();
    return;
  }
  // serré sur le tireur (CAM 2, et la CAM 3 super ralenti qui cadre la même chose)
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#3d6e3a'); gr.addColorStop(1, '#25502a'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  const px = w * (0.3 + 0.1 * r), kick = Math.max(0, Math.min(1, (t - KICK + 0.25) / 0.25));
  man(g, px, h * 0.95, h * 0.36, SANG);
  g.strokeStyle = '#20262a'; g.lineWidth = h * 0.05; g.beginPath(); g.moveTo(px + h * 0.04, h * 0.78); g.lineTo(px + h * (0.04 + 0.12 * kick), h * (0.95 - 0.08 * kick)); g.stroke(); // la jambe de frappe
  const bx = b > 0 ? px + h * 0.2 + b * w * 2.2 : px + h * 0.18, by = h * 0.92 - b * h * 0.6;
  g.fillStyle = '#fff'; g.beginPath(); g.arc(bx, by, h * 0.035, 0, 7); g.fill();
  g.fillStyle = OR; g.font = `bold ${Math.round(h * 0.09)}px Arial, sans-serif`; g.fillText('9', px - h * 0.04, h * 0.84);
}
function demoTrains(host) {
  const TW = 640, TH = 176, L0 = 92, R0 = 14, X = (s) => L0 + s / SPAN * (TW - L0 - R0), S = (x) => (x - L0) / (TW - L0 - R0) * SPAN;
  const tl = canvas(TW, TH, 'co-canvas co-smooth'), fs = canvas(TW, 96, 'co-canvas co-smooth'), pv = canvas(320, 180, 'co-canvas co-smooth');
  const gt = tl.getContext('2d'), gf = fs.getContext('2d'), gv = pv.getContext('2d');
  let cur = 18, inP = /** @type {number | null} */ (null), outP = /** @type {number | null} */ (null), angle = 2, speed = 33, playing = false, playT = 0, timer = 0;
  const read = readout(['IN · OUT', 'Durée de l\'action (OUT − IN)', 'Durée à l\'antenne', 'Images enregistrées de l\'angle, entre IN et OUT', 'Images de sortie (50 par seconde)', 'Ce que l\'on voit']);
  const A = () => ANGLES[angle];
  const drawTimeline = () => {
    gt.fillStyle = '#0b1013'; gt.fillRect(0, 0, TW, TH);
    gt.font = '11px Arial, sans-serif';
    for (let s = 0; s <= SPAN; s += 5) { gt.strokeStyle = '#2a3238'; gt.beginPath(); gt.moveTo(X(s), 14); gt.lineTo(X(s), TH - 20); gt.stroke(); gt.fillStyle = '#aab4ba'; gt.fillText(tc(T0 + s).slice(0, 8), Math.min(X(s) - 22, TW - 50), TH - 6); }
    gt.fillStyle = 'rgba(255,211,138,0.22)'; gt.fillRect(X(KICK - 0.6), 14, X(GOAL) - X(KICK - 0.6), TH - 34);
    gt.fillStyle = C.amber; gt.fillText('tir', X(KICK - 0.6) + 2, 11);
    TRAINS.forEach(([name, a], i) => {
      const y = 20 + i * 21, on = a === angle;
      gt.fillStyle = on ? '#e8eef2' : '#aab4ba'; gt.fillText(String(name), 6, y + 10);
      gt.fillStyle = on ? (a === 2 ? '#7fd3f3' : '#7fd1a0') : '#3a444c'; gt.fillRect(L0, y + 2, TW - L0 - R0, 9);
    });
    // la tête d'enregistrement : le direct, à droite ; la boucle continue
    gt.fillStyle = C.tally; gt.beginPath(); gt.arc(TW - R0 + 4, 9, 4, 0, 7); gt.fill(); gt.fillStyle = '#e8eef2'; gt.fillText('REC', TW - R0 - 24, 12);
    if (inP != null && outP != null && outP > inP) { gt.fillStyle = 'rgba(127,211,243,0.18)'; gt.fillRect(X(inP), 14, X(outP) - X(inP), TH - 34); }
    for (const [p, label, col] of [[inP, 'IN', C.pvw], [outP, 'OUT', C.tally]]) {
      if (p == null) continue; const x = X(/** @type {number} */ (p)); gt.strokeStyle = /** @type {string} */ (col); gt.lineWidth = 2; gt.beginPath(); gt.moveTo(x, 14); gt.lineTo(x, TH - 20); gt.stroke(); gt.fillStyle = /** @type {string} */ (col); gt.fillText(/** @type {string} */ (label), x + 3, TH - 22); gt.lineWidth = 1;
    }
    const t = playing ? playT : cur, x = X(t);
    gt.strokeStyle = '#fff'; gt.lineWidth = 1.5; gt.beginPath(); gt.moveTo(x, 14); gt.lineTo(x, TH - 20); gt.stroke(); gt.lineWidth = 1;
  };
  // la pellicule : en haut les images enregistrées de l'angle à partir de l'IN, en bas les images de sortie, et laquelle chacune montre
  const drawStrip = () => {
    gf.fillStyle = '#0b1013'; gf.fillRect(0, 0, TW, 96);
    const fpsRec = 50 * A().hfr, start = inP != null ? inP : cur, NOUT = 16, v = lever(speed);
    const shown = []; for (let j = 0; j < NOUT; j++) shown.push(Math.floor((start + j * v / OUT_FPS) * fpsRec + 1e-6));
    const first = shown[0], NREC = Math.max(1, Math.min(24, shown[NOUT - 1] - first + 1)), cw = (TW - 100) / Math.max(NREC, NOUT);
    gf.font = '10px Arial, sans-serif'; gf.fillStyle = '#aab4ba'; gf.fillText(`enregistrées (${fpsRec} i/s)`, 4, 22); gf.fillText('sortie (50 i/s)', 4, 84);
    const xr = (k) => 100 + k * cw, used = new Set(shown);
    for (let k = 0; k < NREC; k++) { gf.fillStyle = used.has(first + k) ? '#2a5868' : '#1a2026'; gf.fillRect(xr(k) + 1, 8, cw - 2, 22); gf.fillStyle = '#d3f3df'; gf.fillText(String(k + 1), xr(k) + cw / 2 - 4, 23); }
    shown.forEach((f, j) => {
      const k = f - first, x = 100 + j * cw;
      gf.fillStyle = '#3a3220'; gf.fillRect(x + 1, 68, cw - 2, 22); gf.fillStyle = C.amber; gf.fillText(k < NREC ? String(k + 1) : '…', x + cw / 2 - 4, 83);
      if (k < NREC) { gf.strokeStyle = 'rgba(255,211,138,0.55)'; gf.beginPath(); gf.moveTo(x + cw / 2, 68); gf.lineTo(xr(k) + cw / 2, 30); gf.stroke(); }
    });
  };
  const drawPreview = () => {
    const t = playing ? playT : cur, fpsRec = 50 * A().hfr, tq = Math.floor(t * fpsRec + 1e-6) / fpsRec; // l'image enregistrée la plus proche avant t
    drawAction(gv, 320, 180, angle, tq);
    gv.fillStyle = 'rgba(0,0,0,0.65)'; gv.fillRect(0, 0, 320, 22); gv.fillStyle = '#e8eef2'; gv.font = 'bold 12px Arial, sans-serif';
    gv.fillText(`${A().name} · ${tc(T0 + t)}${playing ? ` · ▶ ${speed} %` : ' · ❚❚'}`, 8, 15);
  };
  const calc = () => {
    const v = lever(speed), fpsRec = 50 * A().hfr;
    if (inP == null || outP == null || outP <= inP) {
      read.set('IN · OUT', inP == null ? 'pose un IN (et un OUT), ou DERN. ACTION' : `IN ${tc(T0 + inP)} · OUT à poser après l'IN`);
      read.set('Durée de l\'action (OUT − IN)', '—'); read.set('Durée à l\'antenne', '—'); read.set('Images enregistrées de l\'angle, entre IN et OUT', '—'); read.set('Images de sortie (50 par seconde)', '—');
    } else {
      const d = outP - inP;
      read.set('IN · OUT', `IN ${tc(T0 + inP)} · OUT ${tc(T0 + outP)}`);
      read.set('Durée de l\'action (OUT − IN)', `${fmtS(d, 2)} (${fmtNum(Math.round(d * 25))} numéros de timecode)`);
      read.set('Durée à l\'antenne', v > 0 ? `${fmtS(d / v, 2)} = ${fmtS(d, 2)} ÷ ${fmtNum(v, 2)}` : 'arrêt sur image : à 0 %, la lecture ne finit jamais');
      read.set('Images enregistrées de l\'angle, entre IN et OUT', `${fmtNum(Math.round(d * fpsRec))} (${fpsRec} images/s${A().hfr > 1 ? ', sur 3 entrées de 50 i/s' : ''})`);
      read.set('Images de sortie (50 par seconde)', v > 0 ? fmtNum(Math.round(d / v * OUT_FPS)) : '—');
    }
    const r = A().hfr * v; // images enregistrées avancées à chaque image de sortie
    read.set('Ce que l\'on voit', v === 0 ? 'arrêt sur image' : Math.abs(r - 1) < 0.02 ? `fluide : chaque image enregistrée est montrée une fois${v < 1 ? ', au ralenti' : ''}` : r < 1 ? `chaque image est répétée ${fmtNum(1 / r, 1)} fois en moyenne : le mouvement saccade` : `une image enregistrée sur ${fmtNum(r, 1)} est montrée${v > 1 ? ' : accéléré' : ' : vitesse réelle'}`);
  };
  const redraw = () => { drawTimeline(); drawStrip(); drawPreview(); calc(); };
  const stop = () => { playing = false; clearInterval(timer); timer = 0; playBtn.textContent = 'Lire ▶'; };
  const play = () => {
    if (playing) { cur = playT; stop(); redraw(); return; }
    playT = inP != null ? inP : cur; playing = true; playBtn.textContent = 'Pause ❚❚';
    timer = window.setInterval(() => { playT += lever(speed) / OUT_FPS; const end = outP != null && outP > (inP ?? 0) ? outP : SPAN; if (playT >= end) { playT = end; cur = end; stop(); } drawTimeline(); drawPreview(); }, 1000 / OUT_FPS);
  };
  const playBtn = el('button', { class: 'btn small primary', type: 'button', onclick: play }, 'Lire ▶');
  const curS = slider('Molette (jog)', 0, SPAN, cur, 0.04, (v) => { cur = v; if (playing) stop(); redraw(); }, (v) => tc(T0 + v).slice(3));
  const setCur = (v) => { cur = Math.max(0, Math.min(SPAN, v)); const i = /** @type {HTMLInputElement} */ (curS.querySelector('input')); i.value = String(cur); /** @type {HTMLElement} */ (curS.querySelector('output')).textContent = tc(T0 + cur).slice(3); };
  tl.addEventListener('pointerdown', (ev) => { const r = tl.getBoundingClientRect(); setCur(S((ev.clientX - r.left) / r.width * TW)); if (playing) stop(); redraw(); });
  tl.style.cursor = 'crosshair'; tl.title = 'Clique pour placer le curseur';
  const b = (label, fn, title) => el('button', { class: 'btn small', type: 'button', title, onclick: () => { fn(); if (playing) stop(); redraw(); } }, label);
  host.append(
    el('div', { class: 'co-ctl' },
      choice('Angle', ANGLES.map((a, i) => [String(i), a.name, `${a.name} : ${a.role}${a.hfr > 1 ? ' (150 images/s)' : ' (50 images/s)'}`]), String(angle), (v) => { angle = +v; redraw(); }),
      slider('Vitesse (levier)', 0, 200, speed, 1, (v) => { speed = v; redraw(); }, (v) => v + ' %')),
    el('div', { class: 'co-ctl' }, curS,
      el('div', { class: 'co-btns' },
        b('IN', () => { inP = cur; if (outP != null && outP <= inP) outP = null; }, 'Point d\'entrée au curseur'),
        b('OUT', () => { outP = cur; }, 'Point de sortie au curseur'),
        b('DERN. ACTION', () => { inP = KICK - 3; outP = KICK + 2.5; setCur(inP); }, 'IN trois secondes avant le tir, OUT deux secondes et demie après'),
        playBtn)),
    tl,
    el('figure', { class: 'co-figc' }, fs, el('figcaption', {}, 'Quelle image enregistrée part à chaque image de sortie : les 16 premières, à partir de l\'IN')),
    el('div', { class: 'co-2' },
      el('figure', { class: 'co-figc' }, pv, el('figcaption', {}, 'Sortie du serveur : l\'image enregistrée montrée à l\'instant lu')),
      read.el));
  redraw();
  return { destroy: () => clearInterval(timer) };
}
function figTrains() {
  const f = figure(720, 214, 'Le serveur enregistre en boucle une entrée par caméra (trois pour une caméra super ralenti 3×, ses phases A, B, C), toutes sur le même timecode. Un IN et un OUT délimitent l\'action sur tous les angles à la fois ; relue à la vitesse v, elle dure (OUT − IN) ÷ v à l\'antenne.');
  const L = 110, R = 600, Y0 = 30, X = (s) => L + s / 30 * (R - L);
  f.append(txt(10, 16, 'Les trains d\'enregistrement, sur le même timecode', 'co-t', 'start'));
  const rows = [['CAM 1 large', C.green], ['CAM 2 serré', C.green], ['CAM 3 · phase A', C.cyan], ['CAM 3 · phase B', C.cyan], ['CAM 3 · phase C', C.cyan], ['CAM 4 but', C.green]];
  rows.forEach(([n, col], i) => f.append(txt(10, Y0 + 12 + i * 20, n, 'co-s', 'start'), sv('rect', { x: L, y: Y0 + 4 + i * 20, width: R - L, height: 10, fill: col, opacity: 0.55 })));
  f.append(sv('rect', { x: X(18), y: Y0, width: X(23.5) - X(18), height: 122, fill: '#7fd3f3', opacity: 0.16 }));
  f.append(sv('line', { x1: X(18), y1: Y0 - 4, x2: X(18), y2: Y0 + 124, stroke: C.pvw, strokeWidth: 2 }), txt(X(18), Y0 - 8, 'IN', 'co-m'));
  f.append(sv('line', { x1: X(23.5), y1: Y0 - 4, x2: X(23.5), y2: Y0 + 124, stroke: C.tally, strokeWidth: 2 }), txt(X(23.5), Y0 - 8, 'OUT', 'co-m'));
  f.append(sv('circle', { cx: R + 10, cy: Y0 + 60, r: 5, fill: C.tally }), txt(R + 20, Y0 + 56, 'direct', 'co-s', 'start'), txt(R + 20, Y0 + 70, 'enregistrement', 'co-s', 'start'));
  f.append(txt(R + 20, Y0 + 92, 'la boucle avance ;', 'co-s', 'start'), txt(R + 20, Y0 + 106, 'le plus ancien', 'co-s', 'start'), txt(R + 20, Y0 + 120, 'est écrasé', 'co-s', 'start'));
  for (let s = 0; s <= 30; s += 10) f.append(txt(X(s), Y0 + 140, `21:12:${20 + s}:00`, 'co-s'));
  f.append(txt(L, Y0 + 162, 'Phase A : images 1, 4, 7… · phase B : 2, 5, 8… · phase C : 3, 6, 9… : 3 × 50 = 150 images/s, recombinées par le serveur', 'co-s', 'start'));
  f.append(txt(L, Y0 + 180, 'Durée à l\'antenne = (OUT − IN) ÷ vitesse : 5,5 s relues à 50 % durent 11 s', 'co-m', 'start'));
  return f;
}

// ======================================================================================
// 2. Clips, IPDirector, playlist
// ======================================================================================
// les clips d'une mi-temps (match fictif) : adresse LSM, nom, mots-clés, note, durée à 100 %
const CLIPS = [
  { id: '111A', name: 'BUT 1-0 · n° 9 de la tête', kw: ['BUT', 'TÊTE'], stars: 3, tcIn: 21 * 3600 + 12 * 60 + 38.2, dur: 6.2, cam: 'CAM 1 large' },
  { id: '112C', name: 'BUT 1-0 · le geste, super ralenti', kw: ['BUT'], stars: 3, tcIn: 21 * 3600 + 12 * 60 + 40.4, dur: 3.2, cam: 'CAM 3 (3×)' },
  { id: '113D', name: 'AMBIANCE · le kop après le but', kw: ['AMBIANCE'], stars: 1, tcIn: 21 * 3600 + 12 * 60 + 46, dur: 5.6, cam: 'CAM 4 tribune' },
  { id: '114A', name: 'ARRÊT du gardien visiteur', kw: ['ARRÊT', 'TIR'], stars: 2, tcIn: 21 * 3600 + 19 * 60 + 2.6, dur: 5.0, cam: 'CAM 1 large' },
  { id: '115B', name: 'TIR n° 10 au-dessus', kw: ['TIR'], stars: 1, tcIn: 21 * 3600 + 24 * 60 + 11, dur: 3.6, cam: 'CAM 2 serré' },
  { id: '121A', name: 'CARTON jaune · n° 5 visiteur', kw: ['CARTON', 'FAUTE'], stars: 2, tcIn: 21 * 3600 + 31 * 60 + 47.5, dur: 4.4, cam: 'CAM 1 large' },
  { id: '122C', name: 'TIR n° 7 sur le poteau', kw: ['TIR'], stars: 2, tcIn: 21 * 3600 + 38 * 60 + 5.2, dur: 4.8, cam: 'CAM 3 (3×)' },
];
const TRANS = { cut: { label: 'CUT', images: 0 }, mix: { label: 'MIX 25 im.', images: 25 }, wipe: { label: 'VOLET 25 im.', images: 25 } };
const SPEEDS = [100, 50, 33];
function demoPlaylist(host) {
  let kw = 'Tous', minStars = 1, goal = 30;
  /** @type {Array<{ c: number, speed: number, trans: string }>} */
  let pl = [{ c: 0, speed: 100, trans: 'mix' }, { c: 1, speed: 33, trans: 'cut' }];
  const base = el('table', { class: 'co-table co-pl', 'aria-label': 'Base de clips' }), list = el('table', { class: 'co-table co-pl', 'aria-label': 'Playlist' });
  const bar = canvas(640, 54, 'co-canvas co-smooth'), gb = bar.getContext('2d');
  const read = readout(['Clips trouvés', 'Somme des durées lues', 'Recouvrements des transitions', 'Durée de la playlist à l\'antenne', 'Écart à l\'objectif']);
  const stars = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);
  const lenOf = (it) => CLIPS[it.c].dur / lever(it.speed);
  const ovOf = (it, i) => (i < pl.length - 1 ? TRANS[it.trans].images / OUT_FPS : 0);
  const sel = (opts, v, on, label) => { const s = /** @type {HTMLSelectElement} */ (el('select', { 'aria-label': label }, ...opts.map(([k, t]) => el('option', { value: k, selected: String(k) === String(v) }, t)))); s.addEventListener('change', () => on(s.value)); return s; };
  const draw = () => {
    const hits = CLIPS.map((c, i) => ({ c, i })).filter(({ c }) => (kw === 'Tous' || c.kw.includes(kw)) && c.stars >= minStars);
    base.replaceChildren(el('tr', {}, ...['LSM', 'Nom', 'Mots-clés', 'Note', 'TC IN', 'Durée', ''].map((h) => el('th', {}, h))),
      ...hits.map(({ c, i }) => el('tr', {}, el('td', {}, c.id), el('td', {}, c.name), el('td', {}, c.kw.join(', ')), el('td', {}, stars(c.stars)), el('td', {}, tc(c.tcIn)), el('td', {}, fmtS(c.dur)),
        el('td', {}, el('button', { class: 'btn small', type: 'button', title: `Ajouter ${c.id} à la playlist`, onclick: () => { pl.push({ c: i, speed: c.cam.includes('3×') ? 33 : 100, trans: 'mix' }); draw(); } }, '+ playlist')))));
    if (!hits.length) base.append(el('tr', {}, el('td', { colspan: '7' }, 'Aucun clip ne correspond : un mot-clé mal choisi au moment du log, et le clip est perdu pour la recherche.')));
    list.replaceChildren(el('tr', {}, ...['N°', 'Clip', 'Vitesse', 'Durée lue', 'Vers le suivant', ''].map((h) => el('th', {}, h))),
      ...pl.map((it, i) => el('tr', {}, el('td', {}, String(i + 1)), el('td', {}, `${CLIPS[it.c].id} · ${CLIPS[it.c].name}`),
        el('td', {}, sel(SPEEDS.map((v) => [v, v + ' %']), it.speed, (v) => { it.speed = +v; draw(); }, `Vitesse de l'élément ${i + 1}`)),
        el('td', {}, fmtS(lenOf(it), 2)),
        el('td', {}, i < pl.length - 1 ? sel(Object.entries(TRANS).map(([k, t]) => [k, t.label]), it.trans, (v) => { it.trans = v; draw(); }, `Transition après l'élément ${i + 1}`) : 'fin'),
        el('td', {}, el('div', { class: 'co-btns' },
          el('button', { class: 'btn small', type: 'button', title: 'Monter', disabled: i === 0, onclick: () => { [pl[i - 1], pl[i]] = [pl[i], pl[i - 1]]; draw(); } }, '↑'),
          el('button', { class: 'btn small', type: 'button', title: 'Descendre', disabled: i === pl.length - 1, onclick: () => { [pl[i + 1], pl[i]] = [pl[i], pl[i + 1]]; draw(); } }, '↓'),
          el('button', { class: 'btn small', type: 'button', title: 'Retirer', onclick: () => { pl.splice(i, 1); draw(); } }, '×'))))));
    const sum = pl.reduce((a, it) => a + lenOf(it), 0), ov = pl.reduce((a, it, i) => a + ovOf(it, i), 0), tot = Math.max(0, sum - ov);
    // la barre : chaque élément à sa durée, les transitions en recouvrement
    gb.fillStyle = '#0b1013'; gb.fillRect(0, 0, 640, 54);
    const k = 620 / Math.max(goal, tot, 1); let x = 10;
    gb.strokeStyle = C.amber; gb.setLineDash([4, 3]); gb.beginPath(); gb.moveTo(10 + goal * k, 4); gb.lineTo(10 + goal * k, 50); gb.stroke(); gb.setLineDash([]);
    gb.font = '10px Arial, sans-serif';
    pl.forEach((it, i) => {
      const w = lenOf(it) * k; gb.fillStyle = i % 2 ? '#2a5868' : '#3a5a3a'; gb.fillRect(x, i % 2 ? 22 : 10, w, 20);
      gb.fillStyle = '#e8eef2'; gb.fillText(CLIPS[it.c].id, x + 3, (i % 2 ? 22 : 10) + 14);
      const o = ovOf(it, i) * k; if (o > 0) { gb.fillStyle = 'rgba(255,211,138,0.55)'; gb.fillRect(x + w - o, 10, o, 32); }
      x += w - o;
    });
    gb.fillStyle = C.amber; gb.fillText(`objectif ${goal} s`, Math.min(560, 14 + goal * k), 52);
    read.set('Clips trouvés', `${hits.length} sur ${CLIPS.length}${kw !== 'Tous' ? ` avec le mot-clé ${kw}` : ''}, ${'★'.repeat(minStars)} ou plus`);
    read.set('Somme des durées lues', pl.length ? `${fmtS(sum, 2)} (durée du clip ÷ vitesse, pour chaque élément)` : 'playlist vide');
    read.set('Recouvrements des transitions', ov ? `− ${fmtS(ov, 2)} : pendant un mix ou un volet, deux clips sont à l'écran` : 'aucun : des CUT seulement');
    read.set('Durée de la playlist à l\'antenne', `${fmtS(tot, 2)} · ${tc(tot)}`);
    const d = tot - goal;
    read.set('Écart à l\'objectif', Math.abs(d) < 0.5 ? 'dans l\'objectif, à une demi-seconde près' : d > 0 ? `${fmtS(d, 2)} de trop : retirer un clip, passer un super ralenti à 50 %` : `il manque ${fmtS(-d, 2)}`);
  };
  host.append(
    el('div', { class: 'co-ctl' },
      choice('Recherche', ['Tous', 'BUT', 'TIR', 'ARRÊT', 'CARTON', 'AMBIANCE'].map((k) => [k, k]), kw, (v) => { kw = v; draw(); }),
      choice('Note', [['1', '★'], ['2', '★★'], ['3', '★★★']], String(minStars), (v) => { minStars = +v; draw(); }),
      choice('Objectif du résumé', [['20', '20 s'], ['30', '30 s'], ['45', '45 s']], String(goal), (v) => { goal = +v; draw(); })),
    el('p', { class: 'co-h5' }, 'Base de clips (IPDirector)'), el('div', { class: 'co-scroll' }, base),
    el('p', { class: 'co-h5' }, 'Playlist'), el('div', { class: 'co-scroll' }, list), bar,
    read.el);
  draw();
}
function figClips() {
  const f = figure(720, 196, 'Du train au résumé : un IN et un OUT font un clip, rangé sur une touche F de la télécommande (111A : page 1, banque 1, touche F1, angle A) ; IPDirector le nomme, le décrit par des mots-clés et une note ; une playlist enchaîne des clips avec leurs vitesses et leurs transitions, lue par un canal du serveur.');
  f.append(txt(10, 16, 'Du train au résumé', 'co-t', 'start'));
  f.append(box(10, 30, 130, 60), txt(75, 50, 'Trains', 'co-t'), txt(75, 66, 'IN … OUT', 'co-m'), txt(75, 82, 'tous les angles', 'co-s'));
  f.append(arrow(142, 60, 172, 60), box(176, 30, 150, 60, C.cyan), txt(251, 50, 'Clip 111A', 'co-t'), txt(251, 66, 'page 1 · banque 1', 'co-s'), txt(251, 82, 'touche F1 · angle A', 'co-s'));
  f.append(arrow(328, 60, 358, 60), box(362, 30, 170, 60, C.amber), txt(447, 50, 'IPDirector', 'co-t'), txt(447, 66, '« BUT 1-0 · n° 9 de la tête »', 'co-s'), txt(447, 82, 'BUT, TÊTE · ★★★', 'co-m'));
  f.append(arrow(534, 60, 564, 60), box(568, 30, 142, 60), txt(639, 50, 'Recherche', 'co-t'), txt(639, 66, 'mot-clé, joueur,', 'co-s'), txt(639, 82, 'note, timecode', 'co-s'));
  // une playlist : trois éléments, deux transitions
  const Y = 118;
  f.append(txt(10, Y - 4, 'Une playlist, lue par un canal du serveur', 'co-t', 'start'));
  const seg = (x, w, label, sub, col) => f.append(sv('rect', { x, y: Y + 6, width: w, height: 30, fill: col, opacity: 0.7 }), txt(x + w / 2, Y + 19, label, 'co-s', 'middle', { fill: '#0b0e10' }), txt(x + w / 2, Y + 31, sub, 'co-s', 'middle', { fill: '#0b0e10' }));
  seg(10, 140, '111A · 100 %', '6,2 s', C.green); seg(130, 230, '112C · 33 %', '3,2 s × 3 = 9,6 s', C.cyan); seg(340, 140, '114A · 100 %', '5,0 s', C.green);
  f.append(sv('rect', { x: 130, y: Y + 2, width: 20, height: 38, fill: C.amber, opacity: 0.6 }), sv('rect', { x: 340, y: Y + 2, width: 20, height: 38, fill: C.amber, opacity: 0.6 }));
  f.append(txt(140, Y + 54, 'mix 0,5 s', 'co-s'), txt(350, Y + 54, 'mix 0,5 s', 'co-s'));
  f.append(txt(500, Y + 18, 'Durée = 6,2 + 9,6 + 5,0', 'co-m', 'start'), txt(500, Y + 34, '− 2 × 0,5 = 19,8 s', 'co-m', 'start'));
  return f;
}

registerChapter({
  id: 'ralentis', title: 'Les ralentis', icon: 'evs',
  intro: 'Le serveur ralenti : enregistrer toutes les caméras en boucle, rejouer une action, monter des clips.',
  lessons: [
    {
      id: 'ralentis-evs', title: 'Le serveur ralenti : trains, IN et vitesse', minutes: '8 min',
      essentials: [
        'Le serveur **enregistre en boucle** chacune de ses entrées (les **trains**), toutes sur le même timecode : chaque angle est disponible au même instant du match.',
        'L\'opérateur revient sur l\'action, pose un **IN** (et un **OUT**), choisit l\'angle et relit au **levier** : à l\'antenne, l\'action dure (OUT − IN) ÷ vitesse.',
        'Une caméra **super ralenti 3×** prend **150 images/s** sur trois entrées : relue à 33 %, chaque image montrée est différente, le mouvement reste fluide.',
      ],
      figure: figTrains,
      demoTitle: 'Appuie sur DERN. ACTION, puis Lire, avec la CAM 3 à 33 %. Passe sur la CAM 2 à 33 %, puis à 25 % : regarde la pellicule (images répétées) et le ballon qui saccade. Essaie 100 % et 200 %.',
      demo: demoTrains,
      body: `Le **serveur ralenti** (dans le car, un EVS XT4K) enregistre sans arrêt plusieurs sources que la grille lui envoie : chaque entrée d'enregistrement est un **train**, une boucle de plusieurs heures. Tant que l'enregistrement tourne, chaque image de chaque entrée est disponible ; quand la boucle est pleine, les images les plus anciennes sont écrasées. Tous les trains portent le même **timecode** (celui du générateur de synchro, entré en LTC) : on peut passer d'un angle à l'autre sur la même action, à l'image près. Le nombre de canaux est fixe et se partage entre enregistrement et lecture : sur un XT4K, 8 canaux en HD (par exemple 6 entrées et 2 sorties ; 12 canaux avec l'option ChannelMAX), 4 en UHD (3 entrées et 1 sortie).

Le geste, à la télécommande **LSM** : l'action vient d'avoir lieu ; l'opérateur revient en arrière à la molette (jog), ou rappelle la dernière action, et pose un **IN** quelques secondes avant, pour que le ralenti parte avec de l'élan ; il choisit l'**angle** (n'importe quelle caméra enregistrée, au même instant) et annonce « ralenti prêt ». Le réalisateur le demande, le truquiste prépare la sortie du serveur au mélangeur et entre en volet logo, l'opérateur pousse le **levier** : la lecture part. Un **OUT** marque la fin de l'action. Arrêter l'enregistrement est la pire erreur du poste : rien de ce qui se passe ensuite ne pourra être rejoué.

Le **levier** règle la vitesse de 0 à 100 % ; une plage étendue (jusqu'à 200 %, ou en marche arrière) se règle dans la configuration. La durée à l'antenne se calcule : **(OUT − IN) ÷ vitesse**. Une action de 4 s relue à 50 % dure 8 s ; à 33 %, 12 s. En football, on relit le plus souvent entre 25 et 50 %.

Pourquoi un ralenti saccade : la sortie du serveur donne 50 images par seconde (1080p50). Une caméra normale en prend 50 aussi : relue à 50 %, chaque image enregistrée doit être montrée deux fois ; à 25 %, quatre fois ; le mouvement avance par à-coups. Une caméra **super ralenti 3×** prend **150 images par seconde** et les sort sur trois liaisons à 50 images/s, les **phases** A, B et C (images 1, 4, 7… ; 2, 5, 8… ; 3, 6, 9…), enregistrées sur trois entrées et recombinées par le serveur. Relue à 33 %, elle montre chaque image une fois : le geste est parfaitement fluide. Relue à 100 %, elle montre une image sur trois : la vitesse réelle.

- Une caméra 3× occupe trois entrées d'enregistrement : avec 6 entrées, une caméra 3× et trois caméras normales.
- La vitesse se lit en pourcentage du temps réel : 33 % (exactement un tiers) pour une 3×, 50 % ou 25 % pour une caméra normale.`,
      car: { text: 'Au poste Ralentis (EVS), la télécommande LSM : la touche REC, DERN. ACTION, IN et OUT, les touches de caméras, le levier de vitesse et la molette jog ; la ligne d\'enregistrement de chaque caméra dit si elle est enregistrée et à quelle cadence.', station: 'evs' },
      terms: ['grille', 'timing-ref', 'st2110-40'],
      competences: ['2.12', '2.9', '2.7'],
      article: 'evsarch',
      exercises: [
        { id: 'evs-ralenti', intro: 'Au poste Ralentis, tu relanceras l\'enregistrement s\'il le faut, poseras l\'IN sur la dernière action, choisiras l\'angle le plus rapide, puis tu enverras le ralenti à l\'antenne au mélangeur, en volet logo. Regarde la vitesse affichée sur la sortie du serveur : pour une caméra 3×, elle est réglée à 33 %, pour que chaque image enregistrée ne soit montrée qu\'une fois.' },
        { id: 'materiel-evs', intro: 'Dans la visionneuse de matériel, Olivier te fait lire l\'arrière du serveur : connecteurs vidéo affectés en entrée ou en sortie, référence, timecode, réseau XNet. Repère l\'entrée LTC : c\'est elle qui met le même timecode sur tous les trains, et c\'est ce qui permet de changer d\'angle au même instant.' },
      ],
      quiz: [
        { q: 'Une action de 3 s (OUT − IN) est relue à 50 %. Combien dure-t-elle à l\'antenne ?', choices: ['6 s', '1,5 s', '3 s'], answer: 0, why: 'Durée à l\'antenne = (OUT − IN) ÷ vitesse = 3 ÷ 0,5 = 6 s. On multiplie par la vitesse (1,5 s) quand on confond ralenti et accéléré ; 3 s, c\'est la lecture à 100 %.' },
        { q: 'Une caméra normale (50 images/s) est relue à 25 %. Que voit-on ?', choices: ['Chaque image montrée quatre fois : le mouvement saccade', 'Un mouvement fluide', 'Une image sur quatre seulement'], answer: 0, why: 'La sortie a besoin de 50 images par seconde ; à 25 %, la caméra n\'en fournit que 12,5 : chaque image est répétée quatre fois. Montrer une image sur quatre, c\'est ce qui se passerait en accéléré à 400 %. Pour un ralenti fluide, il faut une caméra à haute fréquence d\'images.' },
        { q: 'L\'enregistrement est resté arrêté deux minutes, et un but est marqué pendant ce temps. Le ralenti du but…', choices: ['est impossible : rien n\'a été enregistré', 'se retrouve dans la boucle, plus loin', 'se retrouve dans IPDirector'], answer: 0, why: 'Le serveur ne relit que ce qu\'il a enregistré : pendant l\'arrêt, aucun train n\'a avancé. IPDirector ne fait que décrire et organiser les clips du serveur : il ne contient pas d\'autres images. Premier réflexe au poste : vérifier que REC tourne.' },
        { q: 'Le serveur du car est configuré en 6 entrées et 2 sorties. Le réalisateur veut enregistrer deux caméras super ralenti 3×, plus la caméra large et la caméra serrée. Est-ce possible ?',
          choices: [['Oui : quatre caméras pour six entrées, il en reste deux', 'Une caméra 3× sort sur trois liaisons, les phases A, B et C, enregistrées sur trois entrées : deux caméras 3× prennent déjà les six.'],
            ['Oui, en passant le serveur en UHD pour avoir plus de canaux', 'C\'est l\'inverse : en UHD, le XT4K n\'a que 4 canaux (3 entrées et 1 sortie).'],
            'Non : les deux caméras 3× occupent à elles seules les six entrées'],
          answer: 2, why: 'Chaque caméra 3× sort ses 150 images/s sur trois liaisons à 50 images/s, enregistrées sur trois entrées : 2 × 3 = 6. Six entrées suffisent pour une caméra 3× et trois caméras normales : il faut renoncer à l\'une des deux caméras 3×, ou à la large et à la serrée.' },
        { q: 'L\'IN et l\'OUT encadrent 4 s d\'action sur la CAM 3 (super ralenti 3×). Le réalisateur donne 12 s d\'antenne. À quelle vitesse relire ?',
          choices: ['33 % (un tiers) : l\'action dure 12 s et chaque image enregistrée est montrée une fois',
            ['25 % : plus lent, donc plus fluide', 'À 25 %, l\'action dure 4 ÷ 0,25 = 16 s : elle déborde du temps donné. Pour une caméra 3×, c\'est à 33 % que chaque image est montrée une seule fois.'],
            ['300 % : 4 s × 3 = 12 s', 'La vitesse divise la durée : (OUT − IN) ÷ vitesse. À 300 %, l\'action passerait en accéléré, en 1,3 s environ ; le levier ne va d\'ailleurs pas au-delà de 200 %.']],
          answer: 0, why: 'Durée à l\'antenne = (OUT − IN) ÷ vitesse, donc vitesse = 4 ÷ 12 = un tiers, 33 %. C\'est justement la vitesse où une caméra 3× (150 images/s) montre chaque image une fois sur une sortie à 50 images/s : le geste est parfaitement fluide.' },
      ],
    },
    {
      id: 'ralentis-clips', title: 'Clips et playlists : garder, nommer, enchaîner', minutes: '7 min',
      essentials: [
        'Un **clip** est un IN et un OUT sur les trains, avec tous les angles, protégé de l\'écrasement ; sur la LSM, **111A** veut dire page 1, banque 1, touche F1, angle A.',
        '**IPDirector** nomme, décrit (mots-clés, joueurs, note) et retrouve les clips de tous les serveurs : un vocabulaire fixé à l\'avance rend la recherche instantanée.',
        'Une **playlist** enchaîne des clips, chacun à sa vitesse, avec une transition vers le suivant : durée = somme des durées lues − recouvrements des transitions.',
      ],
      figure: figClips,
      demoTitle: 'Cherche les clips TIR, puis ceux à trois étoiles. Construis un résumé de 30 s : ajoute des clips, règle leur vitesse et les transitions, et lis la durée à l\'antenne.',
      demo: demoPlaylist,
      body: `La boucle d'enregistrement finit toujours par écraser ses images les plus anciennes. Ce que l'on veut garder devient un **clip** : un IN et un OUT posés sur les trains, qui gardent **tous les angles** enregistrés entre les deux et sont protégés de l'écrasement. Sur la télécommande LSM, on range le clip sur une touche F libre de la page en cours ; son nom est son adresse : **111A** est le clip de la page 1, banque 1, touche F1, angle A ; 112C, la touche F2 de la même banque, angle C. Pendant un match, un opérateur range ainsi des dizaines de clips : buts, tirs, arrêts, fautes, ambiances.

**IPDirector** est le logiciel de gestion des clips des serveurs EVS : une base de données partagée par tous les serveurs du réseau (XNet) et tous les postes. Le **logueur** y nomme chaque clip (l'action, le joueur, la minute), y ajoute des **mots-clés** (BUT, TIR, ARRÊT, CARTON), les joueurs concernés et une **note** (une à trois étoiles). En direct, il peut aussi « logger » une action d'un geste, au bon timecode, avant même d'en faire un clip. Le vocabulaire est fixé avant le match : si un clip est noté « frappe » et que la recherche demande « TIR », il est perdu.

Une **playlist** est une suite de clips lue par un canal du serveur : le résumé de la mi-temps, les meilleurs moments, les buts de la soirée. Chaque élément a sa **vitesse** (un super ralenti à 33 %, une action large à 100 %) et une **transition** vers le suivant : coupe, mix ou volet, d'une durée en images. Pendant un mix, les deux clips sont à l'écran en même temps : la transition **recouvre** la fin de l'un et le début de l'autre. D'où le calcul : **durée = somme des (durée du clip ÷ vitesse) − somme des durées de transition**. Trois clips de 6,2 s à 100 %, 3,2 s à 33 % et 5 s à 100 %, reliés par deux mix de 25 images (0,5 s en 1080p50), font 6,2 + 9,6 + 5 − 1 = 19,8 s.

Le travail pendant le match : l'opérateur LSM range les clips au fil des actions ; IPDirector les nomme et les classe ; à la mi-temps, la playlist du résumé est prête, envoyée à l'antenne par le mélangeur (entrée et sortie en volet logo) ou transférée au montage. Le producteur donne la durée attendue : on ajuste en retirant un clip ou en changeant une vitesse.`,
      car: { text: 'Au poste IPDirector, la base de clips à gauche (nom, mots-clés, note), le clip choisi au centre et la playlist à droite ; au poste Ralentis, les touches F de la télécommande LSM, la touche PLST qui passe les touches F en mode playlist, et PLAY.', station: 'ipdirector' },
      terms: ['st2110-40'],
      competences: ['2.5', '2.12', '3.7', '3.14'],
      article: 'evsarch',
      exercises: [
        { id: 'evs-clips', intro: 'À la télécommande LSM, tu délimiteras deux actions par un IN et un OUT, les rangeras sur deux touches F, puis tu les enchaîneras en playlist et lanceras la lecture. Lis le nom que prend chaque clip sur sa touche : il donne la page, la banque, la touche et l\'angle.' },
        { id: 'ipdirector-clips', intro: 'Au poste IPDirector, tu renommeras un clip, lui donneras un mot-clé et une note, puis l\'ajouteras à la playlist. Vérifie ensuite que le nouveau nom apparaît aussi sur la télécommande LSM : c\'est la même base de clips pour tous les postes.' },
      ],
      quiz: [
        { q: 'Que désigne le clip « 111A » sur la télécommande LSM ?', choices: ['Page 1, banque 1, touche F1, angle A', 'Le 111e clip de l\'opérateur A', 'La première action de la première mi-temps, caméra 1'], answer: 0, why: 'Le nom d\'un clip LSM est une adresse : on le retrouve à sa page et à sa touche, et la lettre dit quel angle (quelle entrée d\'enregistrement) il relit. Ce n\'est ni un numéro d\'ordre ni un moment du match : ça, c\'est le travail du nom et des mots-clés dans IPDirector.' },
        { q: 'Une playlist de deux clips de 5 s, lus à 100 %, reliés par un mix de 1 s. Durée à l\'antenne ?', choices: ['9 s', '10 s', '11 s'], answer: 0, why: 'Pendant le mix, les deux clips sont à l\'écran ensemble : la seconde de transition est comptée une seule fois. 5 + 5 − 1 = 9 s. 10 s serait vrai avec une coupe ; 11 s ajoute la transition au lieu de la retirer.' },
        { q: 'Pourquoi fixer avant le match la liste des mots-clés (toujours « TIR », jamais « frappe ») ?', choices: ['Parce qu\'une recherche « TIR » ne retrouvera pas un clip noté « frappe »', 'Parce que le serveur refuse les mots inconnus', 'Pour prendre moins de place sur le serveur'], answer: 0, why: 'La recherche compare des mots : deux opérateurs qui n\'emploient pas le même mot ne se retrouvent pas. Le serveur accepte n\'importe quel texte, et quelques mots-clés ne pèsent rien à côté des images enregistrées.' },
        { q: 'La playlist du résumé fait 19,8 s (6,2 s à 100 %, 3,2 s à 33 %, 5 s à 100 %, deux mix de 0,5 s). Le producteur veut moins de 15 s sans retirer de clip. Que changer ?',
          choices: [['Remplacer les deux mix par des coupes', 'Une coupe ne recouvre rien : les 2 × 0,5 s des mix ne sont plus retirées, et la playlist passe à 6,2 + 9,6 + 5 = 20,8 s, plus longue.'],
            ['Relire le super ralenti à 50 % au lieu de 33 %', '3,2 ÷ 0,5 = 6,4 s au lieu de 9,6 s : la playlist fait 6,2 + 6,4 + 5 − 1 = 16,6 s, encore trop longue.'],
            'Relire le super ralenti à 100 % au lieu de 33 %'],
          answer: 2, why: 'Durée = somme des (durée du clip ÷ vitesse) − somme des transitions. À 100 %, le clip de 3,2 s dure 3,2 s au lieu de 9,6 s : 6,2 + 3,2 + 5 − 1 = 13,4 s. C\'est le clip le plus ralenti qui pèse le plus sur la durée.' },
        { q: 'Le clip 112C du but est prêt sur la LSM. Le réalisateur veut maintenant le même moment vu par l\'angle A. Que fait l\'opérateur ?',
          choices: [['Il revient sur le train A et repose un IN et un OUT pour créer un nouveau clip', 'Inutile : le clip existe déjà sur tous les angles enregistrés. Il suffit de changer la lettre.'],
            'Il rappelle 112A : le clip garde tous les angles entre son IN et son OUT',
            ['C\'est impossible : un clip ne garde que l\'angle sur lequel il a été créé', 'Un clip est un IN et un OUT posés sur les trains : tous les angles enregistrés entre les deux sont protégés avec lui.']],
          answer: 1, why: 'Le nom d\'un clip est son adresse : 112, page 1, banque 1, touche F2 ; la lettre, l\'angle. Le clip garde tous les angles enregistrés entre son IN et son OUT : 112A relit le même moment par l\'angle A.' },
      ],
    },
  ],
});

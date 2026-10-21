// @ts-check
import { el } from '../util.js';
import { registerChapter } from './index.js';
import { figure, sv, canvas, slider, choice, readout, fmtNum } from './kit.js';

// ----------------------------------------------------------------------------------
// Chapitre « La réalisation » : le mélangeur (bus PGM et PST, coupe, enchaîné, volet, barre T,
// tally), les incrustations (fill et key, clé linéaire et clé luminance, DSK, ordre des couches) et
// le langage du direct (ordres du réalisateur, conducteur, timecode de la scripte, production).
// Les manipulations travaillent sur quatre sources dessinées (un match fictif, sang et or contre
// bleu) : le mélange, le volet et la découpe sont calculés pixel par pixel sur le canvas.
// ----------------------------------------------------------------------------------
const C = { grey: '#8a949c', amber: '#ffd38a', red: '#ff8a80', green: '#7fd1a0', cyan: '#7fd3f3', box: '#1a2026', line: '#2a3238', tally: '#f0372c', pvw: '#33c46c' };
// more.fill : la couleur du texte, passée en style (la classe du schéma imposerait sinon la sienne)
const txt = (x, y, s, cls = 'co-s', anchor = 'middle', more = {}) => sv('text', { x, y, textAnchor: anchor, class: cls, ...(more.fill ? { style: `fill: ${more.fill}` } : {}) }, s);
const box = (x, y, w, h, stroke = C.grey, fill = C.box) => sv('rect', { x, y, width: w, height: h, rx: 3, fill, stroke, strokeWidth: 1.2 });
const arrow = (x1, y1, x2, y2, col = C.grey) => {
  const a = Math.atan2(y2 - y1, x2 - x1), s = 6;
  const g = sv('g', {});
  g.append(sv('line', { x1, y1, x2, y2, stroke: col, strokeWidth: 1.4 }), sv('path', { d: `M${x2} ${y2} L${x2 - s * Math.cos(a - 0.45)} ${y2 - s * Math.sin(a - 0.45)} L${x2 - s * Math.cos(a + 0.45)} ${y2 - s * Math.sin(a + 0.45)} Z`, fill: col }));
  return g;
};
/** touches « une seule allumée » d'un choice() : rallume la bonne après un changement venu d'ailleurs */
function pressed(group, v) { for (const b of group.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.v === v)); }
const fmtS = (s, d = 2) => fmtNum(s, d) + ' s';
/** timecode HH:MM:SS:II à 25 images par seconde (images 00 à 24) */
function tc(frames) {
  const f = Math.max(0, Math.floor(frames)), p = (n) => String(n).padStart(2, '0');
  return `${p(Math.floor(f / 90000) % 24)}:${p(Math.floor(f / 1500) % 60)}:${p(Math.floor(f / 25) % 60)}:${p(f % 25)}`;
}
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

// ======================================================================================
// Quatre sources dessinées : un plan large, un serré, la tribune, le but
// ======================================================================================
const SANG = '#c8102e', OR = '#f2c200', BLEU = '#2c5bd0';
function player(g, x, y, s, shirt, shorts) {
  g.fillStyle = shorts; g.fillRect(x - s * 0.35, y - s * 0.9, s * 0.7, s * 0.4);
  g.fillStyle = shirt; g.fillRect(x - s * 0.4, y - s * 1.7, s * 0.8, s * 0.85);
  g.fillStyle = '#c99a78'; g.beginPath(); g.arc(x, y - s * 2, s * 0.32, 0, 7); g.fill();
  g.fillStyle = '#20262a'; g.fillRect(x - s * 0.3, y - s * 0.5, s * 0.2, s * 0.5); g.fillRect(x + s * 0.1, y - s * 0.5, s * 0.2, s * 0.5);
}
function drawLarge(g, w, h, t) {
  const top = h * 0.3;
  g.fillStyle = '#1b2228'; g.fillRect(0, 0, w, top);
  for (let i = 0; i < 160; i++) { g.fillStyle = i % 3 === 0 ? OR : i % 3 === 1 ? SANG : '#7a6a60'; g.fillRect((i * 37.3) % w, ((i * 13.7) % (top - 6)) + 2, w / 110, w / 110); }
  for (let k = 0; k < 8; k++) { g.fillStyle = k % 2 ? '#2f7a32' : '#378338'; const y0 = top + (h - top) * Math.pow(k / 8, 1.25), y1 = top + (h - top) * Math.pow((k + 1) / 8, 1.25); g.fillRect(0, y0, w, y1 - y0 + 1); }
  g.strokeStyle = 'rgba(240,240,235,0.85)'; g.lineWidth = Math.max(1, w / 200);
  g.beginPath(); g.moveTo(w * 0.1, top + 3); g.lineTo(w * 0.9, top + 3); g.lineTo(w * 1.02, h * 0.96); g.lineTo(-w * 0.02, h * 0.96); g.closePath(); g.stroke();
  g.beginPath(); g.moveTo(w * 0.5, top + 3); g.lineTo(w * 0.5, h * 0.96); g.stroke();
  g.beginPath(); g.ellipse(w * 0.5, top + (h * 0.96 - top) * 0.52, w * 0.11, h * 0.09, 0, 0, 7); g.stroke();
  const bx = w * (0.5 + 0.28 * Math.sin(t * 0.55)), by = top + (h - top) * (0.48 + 0.2 * Math.sin(t * 0.83));
  const team = [[0.3, 0.4], [0.42, 0.62], [0.55, 0.35], [0.62, 0.7], [0.72, 0.5], [0.36, 0.78]];
  team.forEach(([px, py], i) => {
    const x = w * px + (bx - w * px) * 0.18 + Math.sin(t * 1.3 + i) * w * 0.01, y = top + (h - top) * py + (by - top - (h - top) * py) * 0.15;
    const s = h * (0.03 + 0.035 * (y - top) / (h - top));
    player(g, x, y, s, i % 2 ? SANG : SANG, OR);
    const x2 = w * (1 - px) + (bx - w * (1 - px)) * 0.2, y2 = top + (h - top) * (1 - py * 0.8);
    player(g, x2, y2, h * (0.03 + 0.035 * (y2 - top) / (h - top)), BLEU, '#e8e8e8');
  });
  g.fillStyle = '#fff'; g.beginPath(); g.arc(bx, by, Math.max(1.5, h * 0.012), 0, 7); g.fill();
}
function drawSerre(g, w, h, t) {
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#3d6e3a'); gr.addColorStop(1, '#25502a'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(200,200,190,0.18)'; g.beginPath(); g.ellipse((i * 0.21 + 0.05) * w, h * 0.3, w * 0.05, h * 0.25, 0, 0, 7); g.fill(); } // joueurs flous au loin
  const x = w * 0.52 + Math.sin(t * 0.9) * w * 0.03, y = h * 0.02 * Math.sin(t * 1.7);
  g.fillStyle = SANG; g.beginPath(); g.ellipse(x, h * 1.02 + y, w * 0.3, h * 0.45, 0, 0, 7); g.fill();
  g.fillStyle = OR; g.fillRect(x - w * 0.06, h * 0.57 + y, w * 0.12, h * 0.05);
  g.fillStyle = '#c99a78'; g.fillRect(x - w * 0.045, h * 0.48 + y, w * 0.09, h * 0.12);
  g.beginPath(); g.ellipse(x, h * 0.36 + y, w * 0.085, h * 0.17, 0, 0, 7); g.fill();
  g.fillStyle = '#2a1d16'; g.beginPath(); g.ellipse(x, h * 0.25 + y, w * 0.088, h * 0.08, 0, Math.PI, 0); g.fill();
  g.fillRect(x - w * 0.045, h * 0.33 + y, w * 0.03, h * 0.012); g.fillRect(x + w * 0.015, h * 0.33 + y, w * 0.03, h * 0.012); // sourcils
  g.beginPath(); g.arc(x - w * 0.03, h * 0.37 + y, h * 0.014, 0, 7); g.arc(x + w * 0.03, h * 0.37 + y, h * 0.014, 0, 7); g.fill(); // yeux
  g.fillStyle = '#8a4a3a'; g.fillRect(x - w * 0.025, h * 0.45 + y, w * 0.05, h * 0.012); // bouche
  g.fillStyle = OR; g.font = `bold ${Math.round(h * 0.2)}px Arial, sans-serif`; g.textAlign = 'center'; g.fillText('10', x, h * 0.88 + y); g.textAlign = 'start';
}
function drawTribune(g, w, h, t) {
  g.fillStyle = '#14191d'; g.fillRect(0, 0, w, h);
  const rows = 7, cols = 22;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = (c + 0.5 + (r % 2) * 0.5) * w / cols, jump = Math.max(0, Math.sin(t * 4 + c * 0.7 + r)) * h * 0.02, y = (r + 0.8) * h / (rows + 0.5) - jump;
    g.fillStyle = (c + r) % 4 === 0 ? OR : (c + r) % 4 === 2 ? '#e8e8e8' : SANG; g.fillRect(x - w * 0.014, y, w * 0.028, h * 0.07);
    g.fillStyle = '#c99a78'; g.beginPath(); g.arc(x, y - h * 0.02, h * 0.022, 0, 7); g.fill();
  }
  for (const { fx, col } of [{ fx: 0.25, col: SANG }, { fx: 0.62, col: OR }]) {
    g.fillStyle = col; g.beginPath(); g.moveTo(w * fx, h * 0.1);
    for (let k = 0; k <= 10; k++) g.lineTo(w * fx + k * w * 0.018, h * 0.1 + Math.sin(t * 5 + k * 0.6) * h * 0.03);
    for (let k = 10; k >= 0; k--) g.lineTo(w * fx + k * w * 0.018, h * 0.3 + Math.sin(t * 5 + k * 0.6) * h * 0.03);
    g.closePath(); g.fill();
  }
}
function drawBut(g, w, h, t) {
  g.fillStyle = '#2f7a32'; g.fillRect(0, 0, w, h); g.fillStyle = '#1b2228'; g.fillRect(0, 0, w, h * 0.18);
  const x0 = w * 0.18, x1 = w * 0.82, y0 = h * 0.2, y1 = h * 0.78;
  g.strokeStyle = 'rgba(220,225,230,0.35)'; g.lineWidth = 1;
  for (let x = x0; x <= x1; x += w * 0.025) { g.beginPath(); g.moveTo(x, y0); g.lineTo(x, y1); g.stroke(); }
  for (let y = y0; y <= y1; y += h * 0.04) { g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke(); }
  g.strokeStyle = '#f4f4f0'; g.lineWidth = Math.max(2, w / 80); g.beginPath(); g.moveTo(x0, y1); g.lineTo(x0, y0); g.lineTo(x1, y0); g.lineTo(x1, y1); g.stroke();
  g.strokeStyle = 'rgba(240,240,235,0.85)'; g.lineWidth = Math.max(1, w / 200); g.beginPath(); g.moveTo(0, y1 + 1); g.lineTo(w, y1 + 1); g.stroke();
  const kx = w * (0.5 + 0.2 * Math.sin(t * 1.1));
  player(g, kx, y1 - h * 0.02, h * 0.17, '#1f8f5a', '#111');
}
const SCENES = [
  { name: 'CAM 1', role: 'large', draw: drawLarge },
  { name: 'CAM 2', role: 'serré', draw: drawSerre },
  { name: 'CAM 3', role: 'tribune', draw: drawTribune },
  { name: 'CAM 4', role: 'but', draw: drawBut },
];
const SW = 320, SH = 180;

// ---------------- le cœur d'un mélangeur : deux bus, une transition, le tally ----------------
// pos : avancement de la transition (0 à 1) ; dur : durée en images ; fps : images par seconde du format
function mixer() {
  const st = { pgm: 0, pst: 1, pos: 0, auto: false, trans: 'mix', dur: 25, fps: 50, dir: 1, last: '' };
  const name = (i) => `${SCENES[i].name} (${SCENES[i].role})`;
  const complete = () => {
    const from = st.pgm; [st.pgm, st.pst] = [st.pst, st.pgm]; st.pos = 0; st.auto = false;
    st.last = `${st.trans === 'mix' ? 'Enchaîné' : 'Volet'} de ${SCENES[from].name} vers ${SCENES[st.pgm].name} terminé : les bus se sont échangés, ${SCENES[from].name} attend en preset.`;
  };
  return {
    st, name, complete,
    cut() { if (st.auto) return; const from = st.pgm; [st.pgm, st.pst] = [st.pst, st.pgm]; st.pos = 0; st.last = `CUT de ${SCENES[from].name} vers ${SCENES[st.pgm].name} : d'une image à la suivante ; ${SCENES[from].name} passe en preset.`; },
    auto() { if (st.auto) return; st.auto = true; if (st.dur === 0) complete(); },
    /** barre T : v de 0 à 1 ; le sens s'inverse à chaque transition complète */
    tbar(v) { if (st.auto) return false; const p = st.dir > 0 ? v : 1 - v; if (p >= 0.999) { complete(); st.dir *= -1; return true; } st.pos = p; return false; },
    step(dt) { if (st.auto) { st.pos += dt * st.fps / Math.max(1, st.dur); if (st.pos >= 1) { complete(); return true; } } return false; },
    red: () => [st.pgm, ...(st.pos > 0 && st.pst !== st.pgm ? [st.pst] : [])],
    green: () => (st.pos > 0 || st.pst === st.pgm ? [] : [st.pst]),
    /** l'image du programme : le bus A, et le bus B qui le remplace selon la transition */
    paint(g, src, w, h) {
      g.globalAlpha = 1; g.drawImage(src[st.pgm], 0, 0, w, h);
      if (st.pos <= 0) return;
      if (st.trans === 'mix') { g.globalAlpha = st.pos; g.drawImage(src[st.pst], 0, 0, w, h); g.globalAlpha = 1; return; }
      const x = Math.round(st.pos * w);
      g.save(); g.beginPath(); g.rect(0, 0, x, h); g.clip(); g.drawImage(src[st.pst], 0, 0, w, h); g.restore();
      g.fillStyle = 'rgba(255,255,255,0.85)'; g.fillRect(x - 1, 0, 2, h); // bord du volet
    },
  };
}
function sourceCanvases() {
  const src = SCENES.map(() => { const c = document.createElement('canvas'); c.width = SW; c.height = SH; return c; });
  return { src, draw: (t) => src.forEach((c, i) => SCENES[i].draw(/** @type {CanvasRenderingContext2D} */ (c.getContext('2d')), SW, SH, t)) };
}
// vignette de multiview : image, cadre de tally, étiquette (UMD) avec sa lampe
function tile(g, img, w, h, label, tally) {
  g.drawImage(img, 0, 0, w, h);
  g.fillStyle = 'rgba(0,0,0,0.72)'; g.fillRect(0, h - 22, w, 22);
  g.fillStyle = tally === 'red' ? C.tally : tally === 'green' ? C.pvw : '#3a444c'; g.fillRect(6, h - 16, 10, 10);
  g.fillStyle = '#e8eef2'; g.font = 'bold 13px Arial, sans-serif'; g.fillText(label, 22, h - 6);
  if (tally) { g.strokeStyle = tally === 'red' ? C.tally : C.pvw; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6); }
}
function monitorLabel(g, text, col) { g.fillStyle = 'rgba(0,0,0,0.65)'; g.fillRect(0, 0, 150, 22); g.fillStyle = col; g.font = 'bold 13px Arial, sans-serif'; g.fillText(text, 8, 16); }

// ======================================================================================
// 1. Le mélangeur
// ======================================================================================
function demoMixer(host) {
  const S = sourceCanvases(), M = mixer(), st = M.st;
  const pvw = canvas(SW, SH), pgm = canvas(SW, SH), mv = SCENES.map(() => canvas(SW, SH));
  const gp = pgm.getContext('2d'), gv = pvw.getContext('2d'), gm = mv.map((c) => c.getContext('2d'));
  const read = readout(['À l\'antenne (PGM)', 'En preset (PST)', 'Tally rouge', 'Tally vert', 'Durée de la transition', 'Dernier geste']);
  const opts = SCENES.map((s, i) => [String(i), String(i + 1), `${s.name} (${s.role})`]);
  const rowA = choice('A · PGM', opts, '0', (v) => { if (+v === st.pgm && !st.pos) return; st.pgm = +v; st.pos = 0; st.auto = false; st.last = `Appui direct sur la rangée A : ${SCENES[st.pgm].name} passe à l'antenne sans transition (coupe « à chaud »), sans avoir été vue en preset.`; sync(); });
  const rowB = choice('B · PST', opts, '1', (v) => { st.pst = +v; st.last = `${SCENES[st.pst].name} préparée sur la rangée B : rien ne change à l'antenne, son tally passe au vert.`; sync(); });
  /** @type {HTMLElement | null} */ let tbarEl = null;
  const setBar = (v) => { if (!tbarEl) return; const i = /** @type {HTMLInputElement} */ (tbarEl.querySelector('input')); i.value = String(v); /** @type {HTMLElement} */ (tbarEl.querySelector('output')).textContent = v + ' %'; };
  const sync = () => { pressed(rowA, String(st.pgm)); pressed(rowB, String(st.pst)); };
  const fmtName = () => (st.fps === 25 ? '1080i50 (25 images, 50 trames par seconde)' : '1080p50 (50 images par seconde)');
  const cutBtn = el('button', { class: 'btn small primary', type: 'button', onclick: () => { M.cut(); sync(); } }, 'CUT');
  const autoBtn = el('button', { class: 'btn small primary', type: 'button', onclick: () => { M.auto(); if (!st.auto) { sync(); setBar(st.dir > 0 ? 0 : 100); } } }, 'AUTO TRANS');
  tbarEl = slider('Barre T', 0, 100, 0, 1, (v) => { if (M.tbar(v / 100)) { sync(); } }, (v) => v + ' %');
  let t = 0, prev = performance.now();
  const draw = () => {
    S.draw(t);
    M.paint(gp, S.src, SW, SH); monitorLabel(gp, `PGM · ${SCENES[st.pgm].name}`, C.tally);
    gv.drawImage(S.src[st.pst], 0, 0, SW, SH); monitorLabel(gv, `PVW · ${SCENES[st.pst].name}`, C.pvw);
    const red = M.red(), green = M.green();
    mv.forEach((_, i) => tile(gm[i], S.src[i], SW, SH, `${SCENES[i].name} ${SCENES[i].role.toUpperCase()}`, red.includes(i) ? 'red' : green.includes(i) ? 'green' : ''));
    read.set('À l\'antenne (PGM)', st.pos > 0 ? `${M.name(st.pgm)} et ${M.name(st.pst)} : ${st.trans === 'mix' ? 'enchaîné' : 'volet'} à ${Math.round(st.pos * 100)} %` : M.name(st.pgm));
    read.set('En preset (PST)', st.pos > 0 ? `${M.name(st.pst)}, déjà en partie à l'antenne` : M.name(st.pst));
    read.set('Tally rouge', red.map((i) => SCENES[i].name).join(' et ') + (red.length > 1 ? ' : les deux images sont à l\'antenne' : ''));
    read.set('Tally vert', green.length ? SCENES[green[0]].name : st.pst === st.pgm ? 'aucun : la même source est sur les deux bus' : 'aucun pendant la transition');
    read.set('Durée de la transition', st.dur ? `${st.dur} images = ${fmtS(st.dur / st.fps)} en ${fmtName()}` : '0 image : AUTO TRANS fait une coupe');
    read.set('Dernier geste', st.last || 'aucun : préparez une source sur la rangée B, puis CUT ou AUTO TRANS');
  };
  const tick = () => { const now = performance.now(), dt = Math.min(0.1, (now - prev) / 1000); prev = now; t += dt; if (M.step(dt)) { sync(); setBar(st.dir > 0 ? 0 : 100); } draw(); };
  const timer = setInterval(tick, 40);
  host.append(
    el('div', { class: 'co-ctl' }, rowA, rowB),
    el('div', { class: 'co-ctl' },
      choice('Transition', [['mix', 'MIX', 'Enchaîné : fondu d\'une image à l\'autre'], ['wipe', 'WIPE', 'Volet : la nouvelle image entre par un bord']], st.trans, (v) => { st.trans = v; }),
      slider('Durée', 0, 75, st.dur, 1, (v) => { st.dur = v; }, (v) => v + ' images'),
      choice('Format', [['50', '1080p50', '50 images par seconde'], ['25', '1080i50', '25 images (50 trames) par seconde']], '50', (v) => { st.fps = +v; }),
      cutBtn, autoBtn, tbarEl),
    el('div', { class: 'co-2' },
      el('figure', { class: 'co-figc' }, pvw, el('figcaption', {}, 'Moniteur preset (PVW) : la source du bus B, celle qui passera')),
      el('figure', { class: 'co-figc' }, pgm, el('figcaption', {}, 'Moniteur programme (PGM) : ce qui part à l\'antenne'))),
    el('div', { class: 'co-4' }, ...mv.map((c, i) => el('figure', { class: 'co-figc' }, c, el('figcaption', {}, `Multiview : ${SCENES[i].name}`)))),
    read.el);
  draw();
  return { destroy: () => clearInterval(timer) };
}
function figMixer() {
  const f = figure(720, 290, 'Le mélangeur : les sources arrivent sur deux rangées de touches, A · PGM (à l\'antenne, tally rouge) et B · PST (preset, tally vert) ; le module de transition (CUT, AUTO TRANS, barre T) fait passer B à l\'antenne, puis les deux bus s\'échangent. Pendant un enchaîné, les deux tallys sont rouges.');
  f.append(txt(10, 16, 'Sources (grille)', 'co-t', 'start'));
  ['CAM 1', 'CAM 2', 'CAM 3', 'CAM 4', 'EVS A'].forEach((s, i) => f.append(box(10, 26 + i * 22, 70, 18), txt(45, 39 + i * 22, s, 'co-m')));
  f.append(arrow(84, 70, 112, 70));
  for (const r of [{ y: 34, label: 'A · PGM', on: 0, col: C.tally }, { y: 84, label: 'B · PST', on: 2, col: C.pvw }]) {
    f.append(txt(118, r.y - 6, r.label, 'co-s', 'start'));
    for (let k = 0; k < 5; k++) f.append(sv('rect', { x: 118 + k * 34, y: r.y, width: 28, height: 22, rx: 3, fill: k === r.on ? r.col : '#0b0e10', stroke: k === r.on ? r.col : C.grey, strokeWidth: 1.2 }), txt(132 + k * 34, r.y + 15, String(k + 1), 'co-m'));
  }
  f.append(arrow(292, 66, 330, 66));
  f.append(box(334, 26, 150, 84, C.amber), txt(409, 44, 'Transition', 'co-t'), txt(409, 62, 'CUT · AUTO TRANS', 'co-m'), txt(409, 78, 'MIX · WIPE · CLIP', 'co-m'), txt(409, 96, 'durée en images, barre T', 'co-s'));
  f.append(arrow(486, 66, 520, 66), box(524, 44, 70, 44), txt(559, 63, 'DSK', 'co-t'), txt(559, 79, 'habillage', 'co-s'));
  f.append(arrow(596, 66, 630, 66), box(634, 44, 76, 44, C.tally), txt(672, 63, 'PGM', 'co-t'), txt(672, 79, 'antenne', 'co-s'));
  f.append(sv('path', { d: 'M409 110 V150 H45 V140', fill: 'none', stroke: C.grey, strokeDasharray: '4 3' }), arrow(45, 146, 45, 136), txt(240, 145, 'tally renvoyé aux sources : caméras (par la CCU et la fibre), multiview', 'co-s'));
  // chronogramme d'un enchaîné de CAM 1 vers CAM 3
  const x0 = 120, x1 = 700, tA = 330, tB = 520, Y = 202;
  f.append(txt(10, Y - 24, 'Un enchaîné de CAM 1 vers CAM 3, dans le temps', 'co-t', 'start'));
  f.append(txt(10, Y + 18, 'Image PGM', 'co-s', 'start'));
  f.append(sv('path', { d: `M${x0} ${Y + 6} H${tA} L${tB} ${Y + 26} H${x1}`, fill: 'none', stroke: C.amber, strokeWidth: 2 }), sv('path', { d: `M${x0} ${Y + 26} H${tA} L${tB} ${Y + 6} H${x1}`, fill: 'none', stroke: C.cyan, strokeWidth: 2 }));
  f.append(txt(x0 + 4, Y - 2, 'CAM 1 à 100 %', 'co-s', 'start', { fill: C.amber }), txt(x1 - 4, Y - 2, 'CAM 3 à 100 %', 'co-s', 'end', { fill: C.cyan }));
  const lane = (y, label, segs) => { f.append(txt(10, y + 9, label, 'co-s', 'start')); for (const [a, b, col] of segs) f.append(sv('rect', { x: a, y, width: b - a, height: 10, fill: col })); };
  lane(Y + 36, 'Tally CAM 1', [[x0, tB, C.tally], [tB, x1, C.pvw]]);
  lane(Y + 52, 'Tally CAM 3', [[x0, tA, C.pvw], [tA, x1, C.tally]]);
  f.append(sv('line', { x1: tA, y1: Y, x2: tA, y2: Y + 66, stroke: '#fff', strokeDasharray: '3 3' }), sv('line', { x1: tB, y1: Y, x2: tB, y2: Y + 66, stroke: '#fff', strokeDasharray: '3 3' }));
  f.append(txt((tA + tB) / 2, Y + 80, 'AUTO TRANS : 25 images, soit 0,5 s en 1080p50 ; les deux tallys sont rouges', 'co-s'));
  return f;
}

// ======================================================================================
// 2. Les incrustations : fill, key, clé linéaire et clé luminance, DSK
// ======================================================================================
const IW = 320, IH = 180;
// le graphique de l'habillage, dessiné avec sa transparence (le key est son canal alpha)
function drawBandeau(g) {
  const sh = g.createLinearGradient(0, 162, 0, 175); sh.addColorStop(0, 'rgba(0,0,0,0.6)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = sh; g.fillRect(24, 162, 284, 13); // l'ombre portée, sous le bandeau
  g.fillStyle = 'rgba(16,28,56,0.72)'; rr(g, 20, 128, 284, 34, 4); g.fill();
  g.fillStyle = SANG; rr(g, 20, 128, 42, 34, 4); g.fill();
  g.fillStyle = OR; g.font = 'bold 21px Arial, sans-serif'; g.textAlign = 'center'; g.fillText('10', 41, 153);
  g.textAlign = 'start'; g.fillStyle = '#ffffff'; g.font = 'bold 15px Arial, sans-serif'; g.fillText('J. MARTIN', 72, 144);
  g.fillStyle = OR; g.font = '11px Arial, sans-serif'; g.fillText('milieu offensif · sang et or', 72, 157);
}
function drawScore(g) {
  g.fillStyle = 'rgba(8,12,18,0.82)'; rr(g, 12, 10, 150, 22, 3); g.fill();
  g.fillStyle = SANG; g.fillRect(12, 10, 5, 22);
  g.fillStyle = '#fff'; g.font = 'bold 12px Arial, sans-serif'; g.fillText('RCL 1-0 VIS', 22, 25);
  g.fillStyle = C.amber; g.fillText('67:12', 120, 25);
}
const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
function layerOf(draw) {
  const c = document.createElement('canvas'); c.width = IW; c.height = IH;
  const g = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d')); draw(g);
  const d = g.getImageData(0, 0, IW, IH).data, n = IW * IH;
  const fill = new Float32Array(n * 3), key = new Float32Array(n);
  for (let i = 0; i < n; i++) { key[i] = d[i * 4 + 3] / 255; for (let k = 0; k < 3; k++) fill[i * 3 + k] = key[i] > 0 ? d[i * 4 + k] / 255 : 0; }
  return { fill, key };
}
function demoKeys(host) {
  const fond = document.createElement('canvas'); fond.width = IW; fond.height = IH;
  drawLarge(/** @type {CanvasRenderingContext2D} */ (fond.getContext('2d')), IW, IH, 2.2);
  const bg = /** @type {CanvasRenderingContext2D} */ (fond.getContext('2d')).getImageData(0, 0, IW, IH).data;
  const band = layerOf(drawBandeau), score = layerOf(drawScore), n = IW * IH;
  const fillC = canvas(IW, IH), keyC = canvas(IW, IH), outC = canvas(IW, IH);
  const gf = fillC.getContext('2d'), gk = keyC.getContext('2d'), go = outC.getContext('2d');
  const fillImg = new Uint8ClampedArray(n * 4), keyImg = new Uint8ClampedArray(n * 4), outImg = new Uint8ClampedArray(n * 4);
  // le fill tel qu'il sort de l'habillage, sur fond noir ; sa luminance est la source de la clé luminance
  const shapedY = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 3; k++) fillImg[i * 4 + k] = Math.round(band.fill[i * 3 + k] * band.key[i] * 255);
    fillImg[i * 4 + 3] = 255; shapedY[i] = lum(band.fill[i * 3], band.fill[i * 3 + 1], band.fill[i * 3 + 2]) * band.key[i];
  }
  gf.putImageData(new ImageData(fillImg, IW, IH), 0, 0);
  let mode = 'lin', clip = 0, gain = 1, out = 'pgm', probe = { x: 250, y: 140 };
  // zone du graphique (pour les mesures) et deux points de repère : le fond du bandeau, son ombre
  const BOX = { x0: 14, y0: 122, x1: 312, y1: 176 }, P_BAND = 140 * IW + 250, P_SHADOW = 165 * IW + 200;
  const read = readout(['Découpe tirée de', 'Au point choisi (luminances)', 'Fond du bandeau (72 % dans le key)', 'Ombre portée', 'Bords des lettres adoucis', 'Écart moyen avec la clé linéaire']);
  const keyOf = (m, i) => { const s = m === 'lin' ? band.key[i] : shapedY[i]; return Math.min(1, Math.max(0, (s - clip) * gain)); };
  const refKey = (i) => band.key[i]; // clé linéaire de référence : le key de l'habillage tel quel
  const kNow = new Float32Array(n);
  const redraw = () => {
    let soft = 0, softRef = 0, diff = 0, cnt = 0;
    for (let i = 0; i < n; i++) {
      const k = keyOf(mode, i); kNow[i] = k;
      const kv = Math.round(k * 255); keyImg[i * 4] = keyImg[i * 4 + 1] = keyImg[i * 4 + 2] = kv; keyImg[i * 4 + 3] = 255;
      const ks = score.key[i];
      let yRes = 0, yRef = 0;
      for (let c = 0; c < 3; c++) {
        const b = bg[i * 4 + c] / 255;
        let v = b, r = b;
        if (out === 'pgm') {
          v = v * (1 - k) + band.fill[i * 3 + c] * k; r = r * (1 - refKey(i)) + band.fill[i * 3 + c] * refKey(i); // DSK 2 : le bandeau
          v = v * (1 - ks) + score.fill[i * 3 + c] * ks; r = r * (1 - ks) + score.fill[i * 3 + c] * ks; // DSK 1 : le score
        }
        outImg[i * 4 + c] = Math.round(v * 255);
        yRes += v * [0.2126, 0.7152, 0.0722][c]; yRef += r * [0.2126, 0.7152, 0.0722][c];
      }
      outImg[i * 4 + 3] = 255;
      const x = i % IW, y = (i / IW) | 0;
      if (x >= BOX.x0 && x < BOX.x1 && y >= BOX.y0 && y < BOX.y1) {
        // bord d'une lettre posée sur le bandeau : dans le key de l'habillage, entre le fond du bandeau (0,72) et le plein (1)
        if (refKey(i) > 0.75 && refKey(i) < 0.97) { softRef++; if (k > 0.02 && k < 0.98) soft++; }
        diff += Math.abs(yRes - yRef); cnt++;
      }
    }
    gk.putImageData(new ImageData(keyImg, IW, IH), 0, 0); go.putImageData(new ImageData(outImg, IW, IH), 0, 0);
    // le point choisi : la formule avec ses valeurs
    go.strokeStyle = '#fff'; go.lineWidth = 1.5; go.beginPath(); go.arc(probe.x + 0.5, probe.y + 0.5, 6, 0, 7); go.stroke();
    const pi = probe.y * IW + probe.x, k = kNow[pi];
    const yb = lum(bg[pi * 4] / 255, bg[pi * 4 + 1] / 255, bg[pi * 4 + 2] / 255), yf = lum(band.fill[pi * 3], band.fill[pi * 3 + 1], band.fill[pi * 3 + 2]);
    read.set('Découpe tirée de', mode === 'lin' ? 'le key fourni par l\'habillage (clé linéaire)' : 'la luminance du fill, tel qu\'il sort sur fond noir (clé luminance, self key)');
    read.set('Au point choisi (luminances)', out === 'clean' ? 'clean feed : aucun DSK, l\'image de fond seule' : `fond ${fmtNum(yb * 100)} %, fill ${fmtNum(yf * 100)} %, k = ${fmtNum(k, 2)} → ${fmtNum(yb * 100)} × ${fmtNum(1 - k, 2)} + ${fmtNum(yf * 100)} × ${fmtNum(k, 2)} = ${fmtNum((yb * (1 - k) + yf * k) * 100)} %`);
    const kb = kNow[P_BAND], ksh = kNow[P_SHADOW];
    read.set('Fond du bandeau (72 % dans le key)', `k = ${fmtNum(kb, 2)} : ${kb < 0.02 ? 'le fond du bandeau a disparu' : kb > 0.98 ? 'opaque, l\'image derrière ne se voit plus' : `l'image derrière transparaît à ${fmtNum((1 - kb) * 100)} %`}`);
    read.set('Ombre portée', `k = ${fmtNum(ksh, 2)} : ${ksh < 0.02 ? 'disparue' : 'elle assombrit l\'image derrière le bandeau'}`);
    read.set('Bords des lettres adoucis', `${fmtNum(soft / Math.max(1, softRef) * 100)} % des pixels de bord ont un key intermédiaire${soft < softRef * 0.5 ? ' : bords durs, texte crénelé' : ' : bords lissés'}`);
    read.set('Écart moyen avec la clé linéaire', out === 'clean' ? '—' : `${fmtNum(diff / cnt * 100, 1)} % de luminance sur la zone du bandeau`);
  };
  const clipS = slider('Clip (seuil)', 0, 100, 0, 1, (v) => { clip = v / 100; redraw(); }, (v) => v + ' %');
  const gainS = slider('Gain', 1, 20, 1, 0.5, (v) => { gain = v; redraw(); }, (v) => '× ' + fmtNum(v, 1));
  const setS = (lbl, v, s) => { const i = /** @type {HTMLInputElement} */ (lbl.querySelector('input')); i.value = String(v); /** @type {HTMLElement} */ (lbl.querySelector('output')).textContent = s; };
  outC.addEventListener('pointerdown', (ev) => { const r = outC.getBoundingClientRect(); probe = { x: Math.max(0, Math.min(IW - 1, Math.round((ev.clientX - r.left) / r.width * IW))), y: Math.max(0, Math.min(IH - 1, Math.round((ev.clientY - r.top) / r.height * IH))) }; redraw(); });
  outC.style.cursor = 'crosshair'; outC.title = 'Cliquez pour lire la formule en un point';
  host.append(
    el('div', { class: 'co-ctl' },
      choice('Clé', [['lin', 'linéaire', 'Le key vient de l\'habillage, avec le fill'], ['luma', 'luminance', 'Le key est calculé sur la luminance du fill']], mode, (v) => {
        mode = v; // réglages de départ : clé linéaire telle quelle, clé luminance réglée pour le texte blanc
        if (v === 'lin') { clip = 0; gain = 1; setS(clipS, 0, '0 %'); setS(gainS, 1, '× 1,0'); } else { clip = 0.45; gain = 4; setS(clipS, 45, '45 %'); setS(gainS, 4, '× 4,0'); }
        redraw();
      }),
      clipS, gainS,
      choice('Sortie', [['pgm', 'PGM', 'Programme : fond, puis DSK 2 (bandeau) et DSK 1 (score)'], ['clean', 'clean feed', 'Le programme avant les DSK, livré aux diffuseurs étrangers']], out, (v) => { out = v; redraw(); })),
    el('div', { class: 'co-3' },
      el('figure', {}, fillC, el('figcaption', {}, 'Fill : le graphique sur fond noir (sortie 1 de l\'habillage)')),
      el('figure', {}, keyC, el('figcaption', {}, 'Key utilisé, après clip et gain : blanc = fill, noir = fond')),
      el('figure', {}, outC, el('figcaption', {}, 'Résultat · cliquez un point pour lire la formule'))),
    el('p', { class: 'note' }, 'k = (signal de découpe − clip) × gain, borné entre 0 et 1 ; PGM = fond × (1 − k) + fill × k. Le score (DSK 1) est incrusté par-dessus avec sa propre clé linéaire.'),
    read.el);
  redraw();
}
function figKeys() {
  const f = figure(720, 214, 'Une incrustation : le moteur graphique sort deux signaux, le fill (l\'image) et le key (la découpe, du noir au blanc) ; l\'incrustateur calcule PGM = fond × (1 − k) + fill × k. Dans le mélangeur, les clés du M/E sont prises dans les transitions, les DSK sont après : le clean feed est pris avant les DSK.');
  f.append(txt(10, 16, 'Fill et key', 'co-t', 'start'));
  // fill : un bandeau coloré sur noir ; key : sa silhouette en gris
  const mini = (x, y, kind) => {
    const g = sv('g', { transform: `translate(${x} ${y})` });
    g.append(sv('rect', { width: 120, height: 60, fill: '#000', stroke: C.grey }));
    if (kind === 'fill') { g.append(sv('rect', { x: 10, y: 34, width: 100, height: 16, fill: '#1c2c52' }), sv('rect', { x: 10, y: 34, width: 18, height: 16, fill: SANG }), sv('rect', { x: 34, y: 38, width: 46, height: 6, fill: '#fff' })); }
    else { g.append(sv('rect', { x: 10, y: 34, width: 100, height: 16, fill: '#b8b8b8' }), sv('rect', { x: 10, y: 34, width: 18, height: 16, fill: '#fff' }), sv('rect', { x: 34, y: 38, width: 46, height: 6, fill: '#fff' }), sv('rect', { x: 12, y: 50, width: 100, height: 4, fill: '#555' })); }
    return g;
  };
  f.append(mini(10, 24, 'fill'), txt(70, 98, 'fill : l\'image du graphique', 'co-s'), mini(150, 24, 'key'), txt(210, 98, 'key : blanc = opaque, gris = transparent', 'co-s'));
  f.append(arrow(276, 54, 300, 54), box(304, 30, 140, 50, C.amber), txt(374, 50, 'Incrustateur', 'co-t'), txt(374, 68, 'fond × (1 − k) + fill × k', 'co-m'));
  f.append(txt(460, 40, 'clé linéaire : k = key de l\'habillage', 'co-s', 'start'), txt(460, 56, 'clé luminance : k tiré de la luminance', 'co-s', 'start'), txt(460, 72, 'du fill, réglé par clip et gain', 'co-s', 'start'));
  // la chaîne : M/E → clean feed → DSK 1 → DSK 2 → PGM
  const Y = 130;
  f.append(txt(10, Y - 10, 'L\'ordre des couches dans le mélangeur, du fond vers le dessus', 'co-t', 'start'));
  f.append(box(10, Y, 190, 44), txt(105, Y + 18, 'M/E : bus A/B, transition', 'co-s'), txt(105, Y + 34, 'clés KEY 1 à 4 (image dans l\'image…)', 'co-s'));
  f.append(arrow(202, Y + 22, 250, Y + 22), box(254, Y, 110, 44, C.green), txt(309, Y + 18, 'DSK 1', 'co-t'), txt(309, Y + 34, 'score permanent', 'co-s'));
  f.append(arrow(366, Y + 22, 400, Y + 22), box(404, Y, 110, 44, C.green), txt(459, Y + 18, 'DSK 2', 'co-t'), txt(459, Y + 34, 'bandeaux', 'co-s'));
  f.append(arrow(516, Y + 22, 560, Y + 22), box(564, Y, 80, 44, C.tally), txt(604, Y + 27, 'PGM', 'co-t'));
  f.append(sv('path', { d: `M226 ${Y + 22} V${Y + 64} H262`, fill: 'none', stroke: C.cyan, strokeWidth: 1.4 }), txt(268, Y + 68, 'clean feed : le programme sans DSK, pour les diffuseurs étrangers', 'co-s', 'start', { fill: C.cyan }));
  return f;
}

// ======================================================================================
// 3. Le langage du direct : les ordres, le timecode
// ======================================================================================
// délais de réaction du truquiste simulé, en images à 25 i/s (ordres de grandeur)
const REACT = { prep: 6, top: 4, envoie: 15, mix: 25 };
function demoOrders(host) {
  const S = sourceCanvases(), M = mixer(), st = M.st; st.fps = 25; st.dur = REACT.mix; st.pst = 3;
  const pvw = canvas(SW, SH), pgm = canvas(SW, SH), gp = pgm.getContext('2d'), gv = pvw.getContext('2d');
  const TC0 = ((21 * 60 + 4) * 60 + 10) * 25; // 21:04:10:00, l'horloge maître du car
  const t0 = performance.now();
  const frame = () => TC0 + Math.floor((performance.now() - t0) / 40);
  /** @type {Array<{ at: number, run: () => void }>} */ let queue = [];
  const log = [], journal = el('ol', { class: 'co-journal', 'aria-live': 'polite' });
  let cam = 2, prepared = false, cutAt = frame(), cuts = 0, lastDelay = '', tops = 0, blind = 0, mixOrdered = 0;
  const say = (s) => { log.push(`${tc(frame())}  ${s}`); while (log.length > 7) log.shift(); journal.replaceChildren(...log.map((l) => el('li', {}, l))); };
  const read = readout(['Timecode (horloge maître)', 'À l\'antenne', 'En preset', 'Plan en cours depuis', 'Délai entre l\'ordre et l\'image', 'Ordres de coupe']);
  const later = (n, run) => queue.push({ at: frame() + n, run });
  const onAir = (from, ordered, kind) => { cuts++; cutAt = frame(); lastDelay = `${frame() - ordered} images (${fmtS((frame() - ordered) / 25)}) pour « ${kind} »`; say(`PGM : ${SCENES[st.pgm].name}${from !== st.pgm ? ` (après ${SCENES[from].name})` : ''}`); };
  const order = {
    prep() {
      const n = cam; say(`Réalisateur : « Prépare la ${n + 1} »`);
      if (n === st.pgm) { say(`Truquiste : « la ${n + 1} est déjà à l'antenne »`); return; }
      later(REACT.prep, () => { st.pst = n; prepared = true; say(`Truquiste : ${SCENES[n].name} en preset, tally vert : le cadreur sait qu'il va passer`); });
    },
    top() {
      const o = frame(); tops++; say('Réalisateur : « Top ! »');
      if (!prepared) say(`Attention : rien n'a été annoncé, le truquiste coupe sur ce qui est en preset (${SCENES[st.pst].name})`);
      later(REACT.top, () => { if (st.auto) { say('Truquiste : le fondu en cours finit d\'abord'); return; } const from = st.pgm; M.cut(); prepared = false; onAir(from, o, 'Top'); });
    },
    mix() {
      const o = frame(); tops++; say('Réalisateur : « Enchaîne »');
      if (!prepared) say(`Attention : rien n'a été annoncé, le fondu part vers ${SCENES[st.pst].name}`);
      later(REACT.top, () => { if (st.auto) { say('Truquiste : un fondu est déjà en cours'); return; } st.trans = 'mix'; mixOrdered = o; M.auto(); });
    },
    envoie() {
      const n = cam, o = frame(); blind++; say(`Réalisateur : « Envoie la ${n + 1} » (sans l'avoir annoncée)`);
      if (n === st.pgm) { say(`Truquiste : « la ${n + 1} est déjà à l'antenne »`); return; }
      later(REACT.envoie, () => { const from = st.pgm; st.pgm = n; st.pos = 0; st.auto = false; prepared = false; onAir(from, o, `Envoie la ${n + 1}`); say(`Le cadreur de la ${n + 1} n'a pas eu de tally vert : son cadre n'était peut-être pas prêt`); });
    },
  };
  let prev = performance.now(), t = 0;
  const draw = () => {
    S.draw(t);
    M.paint(gp, S.src, SW, SH); monitorLabel(gp, `PGM · ${SCENES[st.pgm].name}`, C.tally);
    gv.drawImage(S.src[st.pst], 0, 0, SW, SH); monitorLabel(gv, `PVW · ${SCENES[st.pst].name}`, prepared ? C.pvw : C.grey);
    const f = frame();
    read.set('Timecode (horloge maître)', `${tc(f)} (images de 00 à 24)`);
    read.set('À l\'antenne', st.pos > 0 ? `${M.name(st.pgm)} → ${M.name(st.pst)}, enchaîné à ${Math.round(st.pos * 100)} %` : M.name(st.pgm));
    read.set('En preset', `${M.name(st.pst)}${prepared ? ' : annoncée, tally vert' : ' : rien d\'annoncé'}`);
    read.set('Plan en cours depuis', `${fmtS((f - cutAt) / 25, 1)} (${tc(f - cutAt).slice(3)} en minutes:secondes:images)`);
    read.set('Délai entre l\'ordre et l\'image', lastDelay || '—');
    read.set('Ordres de coupe', `${tops} « Top » ou « Enchaîne » · ${blind} « Envoie » sans annonce · ${cuts} changement${cuts > 1 ? 's' : ''} de plan`);
  };
  const tick = () => {
    const now = performance.now(), dt = Math.min(0.1, (now - prev) / 1000); prev = now; t += dt;
    const f = frame(), due = queue.filter((q) => q.at <= f); queue = queue.filter((q) => q.at > f); for (const q of due) q.run();
    const from = st.pgm;
    if (M.step(dt)) { prepared = false; onAir(from, mixOrdered || f, 'Enchaîne'); }
    draw();
  };
  const timer = setInterval(tick, 40);
  const camC = choice('Caméra', SCENES.map((s, i) => [String(i), String(i + 1), `${s.name} (${s.role})`]), String(cam), (v) => { cam = +v; });
  const b = (label, fn, title) => el('button', { class: 'btn small', type: 'button', title, onclick: fn }, label);
  host.append(
    el('div', { class: 'co-ctl' }, camC,
      el('div', { class: 'co-btns' },
        b('« Prépare la… »', () => order.prep(), 'Annonce : le truquiste met la caméra en preset'),
        b('« Top ! »', () => order.top(), 'Coupe sur la source préparée'),
        b('« Enchaîne »', () => order.mix(), 'Fondu de 25 images (1 s) vers la source préparée'),
        b('« Envoie la… »', () => order.envoie(), 'Coupe directe, sans annonce'))),
    el('div', { class: 'co-2' },
      el('figure', { class: 'co-figc' }, pvw, el('figcaption', {}, 'Preset : ce que le truquiste a préparé')),
      el('figure', { class: 'co-figc' }, pgm, el('figcaption', {}, 'Programme : ce qui part à l\'antenne'))),
    el('div', { class: 'co-2' }, el('div', {}, el('p', { class: 'co-h5' }, 'Journal de la scripte (timecode, 25 images par seconde)'), journal), read.el),
    el('p', { class: 'note' }, 'Les délais du truquiste simulé sont des ordres de grandeur : 4 images après un « Top » annoncé, 15 images pour trouver et couper une caméra demandée sans annonce.'));
  say('Antenne : CAM 1, plan large. Choisissez une caméra, annoncez-la, puis donnez le top.');
  draw();
  return { destroy: () => clearInterval(timer) };
}
function figOrders() {
  const f = figure(720, 196, 'Chronogramme d\'un enchaînement d\'ordres : le réalisateur annonce « Prépare la 3 » (la CAM 3 passe en preset, tally vert), dit « Top » (coupe : CAM 3 à l\'antenne, tally rouge), annonce « Prépare la 1 » puis « Enchaîne » (fondu d\'une seconde). La scripte note chaque action avec son timecode.');
  const x0 = 130, X = (s) => x0 + s * 56, Y0 = 34;
  f.append(txt(10, 16, 'Les ordres, ce qu\'ils font, quand', 'co-t', 'start'));
  for (let s = 0; s <= 10; s++) f.append(sv('line', { x1: X(s), y1: Y0 - 6, x2: X(s), y2: 168, stroke: C.line }), txt(X(s), 186, `21:04:${String(10 + s).padStart(2, '0')}`, 'co-s'));
  const lane = (y, label) => f.append(txt(10, y + 14, label, 'co-s', 'start'));
  lane(Y0, 'Réalisateur'); lane(Y0 + 34, 'Truquiste'); lane(Y0 + 68, 'Programme'); lane(Y0 + 102, 'Tally CAM 3');
  const bubble = (s, text) => { const w = text.length * 6.4 + 12; f.append(sv('rect', { x: X(s), y: Y0, width: w, height: 20, rx: 10, fill: '#2a3238', stroke: C.amber }), txt(X(s) + w / 2, Y0 + 14, text, 'co-s')); };
  bubble(0.5, '« Prépare la 3 »'); bubble(3, '« Top ! »'); bubble(5.5, '« Prépare la 1 »'); bubble(8, '« Enchaîne »');
  const act = (s, text) => f.append(txt(X(s), Y0 + 48, text, 'co-m', 'start'));
  act(0.75, 'CAM 3 → PST'); act(3.15, 'CUT'); act(5.75, 'CAM 1 → PST'); act(8.15, 'AUTO TRANS 25 im.');
  const seg = (a, b, y, col, text) => { f.append(sv('rect', { x: X(a), y, width: X(b) - X(a), height: 18, fill: col, opacity: 0.85 })); if (text) f.append(txt(X(a) + 6, y + 13, text, 'co-s', 'start', { fill: '#0b0e10' })); };
  seg(0, 3.15, Y0 + 68, C.amber, 'CAM 1 (large)'); seg(3.15, 8.15, Y0 + 68, C.cyan, 'CAM 3 (tribune)'); seg(8.15, 9.15, Y0 + 68, '#bfc6ca', 'fondu'); seg(9.15, 10, Y0 + 68, C.amber, 'CAM 1');
  seg(0.75, 3.15, Y0 + 102, C.pvw, 'vert'); seg(3.15, 9.15, Y0 + 102, C.tally, 'rouge'); seg(9.15, 10, Y0 + 102, C.pvw, 'preset');
  f.append(txt(X(3.15), Y0 + 136, 'la scripte note : 21:04:13:04 · CAM 3 · tribune', 'co-s', 'start'));
  return f;
}

registerChapter({
  id: 'realisation', title: 'La réalisation', icon: 'melangeur',
  intro: 'Le mélangeur, les incrustations et le langage du direct : ce qui fait passer une image à l\'antenne.',
  lessons: [
    {
      id: 'real-melangeur', title: 'Le mélangeur : PGM, preset et transitions', minutes: '7 min',
      essentials: [
        'Deux bus : **PGM** (programme, à l\'antenne, tally **rouge**) et **PST** (preset ou PVW, la source suivante, tally **vert**).',
        'Une transition fait passer le preset à l\'antenne : **CUT** (d\'une image à la suivante), **MIX** (enchaîné), **WIPE** (volet), à une durée réglée en **images**, ou à la main avec la **barre T**.',
        'Après la transition, les bus s\'échangent ; pendant un enchaîné, les deux sources sont à l\'antenne et leurs deux tallys sont rouges.',
      ],
      figure: figMixer,
      demoTitle: 'Préparez la CAM 3 sur la rangée B, puis CUT. Préparez une autre caméra, choisissez MIX et AUTO TRANS : regardez les tallys du multiview pendant le fondu. Essayez la barre T et la durée en 1080i50.',
      demo: demoMixer,
      body: `Le **mélangeur** (on dit aussi le truqueur ; en anglais vision mixer ou switcher) reçoit toutes les sources du car par la grille : caméras, serveurs ralentis, habillage, duplex. Le **truquiste** l'exploite sur ordre du réalisateur. Chaque source a une touche sur chacune des **rangées** du pupitre ; la rangée **A · PGM** (le bus programme) dit ce qui est à l'antenne, la rangée **B · PST** (le bus preset, ou PVW pour preview) ce qui passera à la prochaine transition. Un moniteur montre chacun des deux bus.

Le geste de base est toujours le même : on **prépare** sur PST, on regarde le cadre au moniteur preset, puis une **transition** le fait passer à l'antenne. À la fin, les deux bus s'**échangent** (flip-flop) : l'ancienne source attend en preset, prête pour un retour. Appuyer directement sur la rangée A coupe « à chaud », sans avoir vu l'image avant : c'est possible, mais le cadreur n'a pas été prévenu.

Les transitions : le **CUT** remplace l'image d'une image à la suivante, au moment où le mélangeur commute (dans l'intervalle de suppression, entre deux images, à condition que toutes les sources soient verrouillées sur la même référence : c'est le genlock). Le **MIX** (enchaîné, fondu) mélange les deux images pendant une durée réglée en **images** du format : 25 images durent 1 s en 1080i50 (25 images, 50 trames par seconde), 0,5 s en 1080p50. Un enchaîné courant dure de 12 à 25 images. Le **WIPE** (volet) fait entrer la nouvelle image par un motif (bord, cercle, boîte) ; le **CLIP** (volet logo, stinger) cache la coupe derrière une animation, pour entrer dans un ralenti et en sortir. **AUTO TRANS** déroule la transition à la durée affichée ; la **barre T** la fait à la main, à la vitesse du geste, et peut s'arrêter à mi-course.

Le **tally** est le signal que le mélangeur renvoie pour chaque source : **rouge** quand elle est à l'antenne, **vert** quand elle est en preset (selon la configuration du car). Il allume la lampe de la caméra, le témoin du viseur du cadreur et le cadre de sa vignette au multiview (protocole TSL vers le multiview ; contacts de tally ou réseau de contrôle vers les CCU, puis la fibre jusqu'à la caméra). Pendant un enchaîné ou un volet, les deux images sont visibles : les deux sources sont rouges, et aucun des deux cadreurs ne doit bouger.

- Tout est compté en images : 20 images = 0,8 s en 1080i50, 0,4 s en 1080p50. Vérifier le format du car avant de régler une durée.
- Le mélangeur du car (Sony XVS-6000) a plusieurs étages **M/E** (mix/effects), chacun avec ses bus A et B, sa transition et quatre clés ; le dernier étage fait le programme.`,
      car: { text: 'Au poste Truquiste, les rangées A · PGM et B · PST, le module de transition (MIX, WIPE, CLIP, durée en images, CUT, AUTO TRANS) et la barre T. Le multiview, au-dessus du pupitre, encadre chaque source de la couleur de son tally.', station: 'melangeur' },
      terms: ['tsl-umd', 'commutation-propre', 'timing-ref'],
      competences: ['2.12', '2.9'],
      article: 'timing',
      exercises: [
        { id: 'melangeur-commuter', intro: 'Au poste Truquiste, vous préparerez une caméra sur la rangée B · PST, puis vous couperez, enchaînerez en AUTO TRANS, pousserez la barre T et passerez un volet logo. À chaque geste, regardez le multiview : le cadre vert suit la source en preset, le cadre rouge celle à l\'antenne, et les deux sont rouges pendant l\'enchaîné.' },
      ],
      quiz: [
        { q: 'Pendant un enchaîné de la CAM 1 vers la CAM 3, quel tally est rouge ?', choices: ['Seulement la CAM 1, jusqu\'à la fin du fondu', 'La CAM 1 et la CAM 3', 'Seulement la CAM 3, dès le début du fondu'], answer: 1, why: 'Pendant le fondu, les deux images sont mélangées à l\'antenne : le tally suit tout ce qui est visible, les deux cadreurs sont rouges et ne doivent pas bouger leur cadre. La CAM 3 n\'est verte qu\'avant la transition, la CAM 1 redevient verte après.' },
        { q: 'Après un CUT de la CAM 1 vers la CAM 3, où est la CAM 1 ?', choices: ['Sur la rangée B · PST : les deux bus se sont échangés', 'Nulle part : il faut la resélectionner', 'Toujours sur la rangée A, en fond'], answer: 0, why: 'Le mélangeur échange les bus à chaque transition (flip-flop) : la source qui quitte l\'antenne passe en preset, tally vert, prête pour un retour. Il n\'y a pas d\'image « en fond » derrière un CUT : la rangée A porte maintenant la CAM 3.' },
        { q: 'Un enchaîné réglé à 25 images en 1080i50 dure…', choices: ['0,5 s', '1 s', '25 ms'], answer: 1, why: 'Le 1080i50 compte 25 images (50 trames) par seconde : 25 images font 1 s. 0,5 s serait la même durée en 1080p50 (50 images par seconde) ; 25 ms confond images et millisecondes.' },
      ],
    },
    {
      id: 'real-incrustations', title: 'Incrustations : fill, key et DSK', minutes: '8 min',
      essentials: [
        'Une incrustation pose un **fill** (l\'image du graphique) sur le fond là où le **key** (la découpe) l\'autorise : PGM = fond × (1 − k) + fill × k.',
        '**Clé linéaire** : le key vient de l\'habillage avec son fill, transparences et ombres comprises. **Clé luminance** : le key est tiré de la luminance d\'une source, réglé par le **clip** (seuil) et le **gain** (raideur).',
        'Les clés du **M/E** sont prises dans les transitions ; les **DSK** sont après, au-dessus de tout : le score y reste quand on coupe. Le **clean feed** est pris avant les DSK.',
      ],
      figure: figKeys,
      demoTitle: 'En clé linéaire, cliquez sur le fond du bandeau et lisez la formule. Passez en clé luminance : le fond sombre, le cartouche rouge et l\'ombre disparaissent. Montez le gain, puis le clip, et regardez les bords du texte.',
      demo: demoKeys,
      body: `Une **incrustation** (key) remplace une partie de l'image de fond par une autre. Il faut deux choses : le **fill** (le remplissage, l'image à poser) et le **key** (la découpe), un signal en niveaux de gris qui dit, pixel par pixel, combien de fill on veut : noir (0 %), le fond reste ; blanc (100 %), le fill le remplace ; gris, on mélange. Le calcul de l'incrustateur est une moyenne pondérée : **PGM = fond × (1 − k) + fill × k**. Un fond de bandeau à 72 % dans le key laisse donc voir l'image derrière à 28 %.

La **clé linéaire** (linear key, ou clé externe) utilise un key fourni avec le fill. C'est le cas de l'**habillage** : le moteur graphique (Vizrt, Chyron, XPression…) sort deux signaux SDI, le fill et le key, et le mélangeur les incruste tels quels. Toutes les nuances passent : fonds semi-transparents, ombres portées, bords de lettres adoucis. Pour le graphiste, le key est le canal **alpha** de son image.

La **clé luminance** (luma key, self key) n'a pas de key fourni : elle le fabrique à partir de la **luminance** de la source elle-même. Deux réglages : le **clip** (le seuil : la luminance à partir de laquelle on commence à garder le fill) et le **gain** (la raideur : la vitesse à laquelle on passe de 0 à 100 %). Elle convient à un texte blanc sur fond noir ou à un logo clair ; sur un graphique moderne, elle fait disparaître tout ce qui est sombre (fond bleu nuit, cartouche rouge, ombre) et un gain fort durcit les bords : le texte devient crénelé. La **chroma key** (incrustation sur fond vert ou bleu, en studio) fabrique le key à partir d'une couleur ; elle a besoin d'une couleur précise sur les contours, une raison de travailler en 4:2:2.

L'**ordre des couches** décide qui recouvre qui. Dans chaque étage M/E du mélangeur, les **clés** (quatre par M/E sur le XVS-6000 : image dans l'image, logo, incrustation) sont au-dessus du fond et font partie de la transition : le réglage Next Transition (BKGD, KEY 1…) dit si la prochaine transition change le fond, la clé, ou les deux. Après le dernier M/E viennent les **DSK** (downstream keyers, incrustateurs aval) : DSK 1 pour le score, DSK 2 pour les bandeaux. Ils sont au-dessus de tout et indépendants des transitions : on coupe, on enchaîne, on part en ralenti, le score reste. La sortie **clean feed** est prise avant les DSK : c'est le programme sans habillage, livré aux diffuseurs étrangers qui posent le leur.

- Un graphique qui « ne passe pas » : le moteur sort bien le fill et le key, mais le DSK correspondant est fermé au mélangeur.
- Fill et key doivent arriver en phase (même référence, même retard sur le chemin) : décalés d'une image, la découpe ne suit plus l'image pendant les animations, et un liseré apparaît autour du graphique.`,
      plus: `Un fill peut être **prémultiplié** (shaped : déjà multiplié par le key, noir là où le key est noir) ou non (unshaped). Le mélangeur doit le savoir : un fill prémultiplié traité comme non prémultiplié est multiplié deux fois par le key, et ses bords semi-transparents s'assombrissent (un halo noir autour des lettres). Le réglage se fait dans le menu du DSK (« shaped / unshaped », « additive »).`,
      car: { text: 'Au poste Habillage, la sortie fill + key du moteur graphique (damier = transparent) à gauche, le programme à droite : le bandeau n\'y apparaît que si le DSK 2 est ouvert. Au poste Truquiste, les touches DSK 1 (score) et DSK 2 (graphiques), et le panneau KEY 1 (image dans l\'image du M/E).', station: 'habillage' },
      terms: ['ycbcr', 'waveform', 'timing-ref'],
      competences: ['2.6', '2.12'],
      article: 'chaine',
      exercises: [
        { id: 'melangeur-incrustations', intro: 'Vous ouvrirez le score sur le DSK 1 au poste Truquiste, puis vous préparerez, lancerez et retirerez un bandeau joueur au poste Habillage, sur le DSK 2. Regardez la sortie fill + key de l\'habillage : le bandeau n\'arrive au programme que lorsque son DSK est ouvert, et le score reste en place quand le bandeau sort, parce qu\'il est sur une autre couche.' },
      ],
      quiz: [
        { q: 'Le key d\'un bandeau vaut 60 % sur son fond semi-transparent. À l\'antenne, ce fond…', choices: ['laisse voir l\'image derrière à 40 %', 'est opaque : tout ce qui n\'est pas noir dans le key est plein', 'disparaît : seul le blanc pur du key est incrusté'], answer: 0, why: 'PGM = fond × (1 − 0,6) + fill × 0,6 : l\'image derrière compte encore pour 40 %. Une clé linéaire garde toutes les valeurs intermédiaires du key ; seule une clé luminance réglée trop dure transformerait ce gris en tout ou rien.' },
        { q: 'Pourquoi une clé luminance abîme-t-elle un bandeau à fond bleu nuit avec une ombre ?', choices: ['Elle découpe d\'après la luminance du fill : les parties sombres deviennent transparentes', 'Elle ne fonctionne qu\'en 4:4:4', 'Elle inverse le fill et le key'], answer: 0, why: 'La clé luminance n\'a pas le key de l\'habillage : elle le déduit de la luminance. Le fond bleu nuit, le cartouche rouge sombre et l\'ombre ont une faible luminance : sous le clip, ils disparaissent. Le format d\'échantillonnage n\'y est pour rien, et rien n\'est inversé.' },
        { q: 'Le score est sur le DSK 1. Le truquiste part en ralenti avec un volet logo. Le score…', choices: ['reste à l\'écran : le DSK est après les transitions', 'part avec la transition et revient après', 'ne se voit plus que sur le clean feed'], answer: 0, why: 'Les DSK sont en aval du dernier M/E : ce que fait la transition ne les touche pas. Le clean feed, lui, est pris avant les DSK : il est justement sans score. Une clé du M/E, en revanche, peut changer avec la transition si elle est sélectionnée dans Next Transition.' },
      ],
    },
    {
      id: 'real-ordres', title: 'Le langage du direct : ordres, conducteur, timecode', minutes: '7 min',
      essentials: [
        'Le réalisateur **annonce** puis **déclenche** : « Prépare la 3 » (preset, tally vert), « Top » (coupe), « Enchaîne » (fondu), « Ralenti ».',
        'Le **conducteur** minute l\'émission ; la **scripte** tient le temps, compte les prises d\'antenne et note chaque action avec son **timecode** (heures:minutes:secondes:images).',
        'La **production** représente la chaîne dans le car : horaires, publicités, contenus ; c\'est elle qui négocie un imprévu.',
      ],
      figure: figOrders,
      demoTitle: 'Annoncez une caméra (« Prépare la… »), puis donnez le top : lisez le délai. Recommencez avec « Envoie la… » sans annonce, puis avec un « Top » sans rien préparer. Le journal note chaque ordre avec son timecode.',
      demo: demoOrders,
      body: `Le **réalisateur** raconte le match en images, face au multiview. Il ne touche pas au mélangeur : il parle, dans l'intercom, au **truquiste**, aux **cadreurs**, aux opérateurs **ralenti**, à l'**habillage** et au **son**. Les ordres sont courts et toujours les mêmes, pour qu'il n'y ait jamais de doute, le numéro d'abord :
- « **Prépare la 3** » (ou « Attention la 3 ») : le truquiste met la CAM 3 en preset ; son tally passe au vert, le cadreur sait qu'il va passer et soigne son cadre ;
- « **Top** » : la coupe, au moment exact où le réalisateur le dit ; « **Envoie la 3** » : coupe directe sur une caméra ;
- « **Enchaîne** » : un fondu, sur un moment plus calme ;
- « **Ralenti A, la 2 et la 7** » : l'opérateur ralenti cale l'action sur ces angles ; « ralenti prêt », puis l'envoi en volet logo ;
- « **Score** », « **Bandeau** », « **On sort** » : l'habillage.

L'**annonce** est ce qui fait gagner la seconde utile. Annoncée, la coupe part quelques images après le top ; demandée d'un coup, le truquiste doit d'abord trouver la touche, et le cadreur n'a pas eu son tally vert : son plan n'est peut-être pas prêt. Un « Top » sans annonce coupe sur ce qui est en preset, souvent l'ancien plan.

Le **conducteur** est le déroulé minuté de l'émission : début d'antenne, avant-match, coup d'envoi, mi-temps et ses publicités, fin d'antenne, avec la durée de chaque séquence. La **scripte** (assistante de réalisation) le fait vivre : elle annonce les comptes à rebours (« antenne dans 1 minute… 30 secondes… 10, 9, 8… top antenne »), suit la durée des séquences et des pages de publicité, et note les actions du match avec leur **timecode**. Ce timecode (heures:minutes:secondes:images) est l'heure inscrite dans chaque image ; il vient du générateur de synchro du car (LTC) et il est le même pour les caméras, les serveurs ralentis et les enregistreurs. À 25 images par seconde, les images vont de 00 à 24 : 21:04:13:24 est la dernière image de la seconde. En 1080p50, la norme (SMPTE ST 12-1) compte encore 25 numéros par seconde, chacun couvrant une paire d'images.

La **production** (chargé de production, producteur) représente le diffuseur dans le car : elle valide le conducteur, fait respecter les horaires de la chaîne (prise d'antenne, publicités à heure fixe, rendu d'antenne), décide des contenus (statistiques, interviews, résumés) et règle les imprévus avec la régie finale de la chaîne. Elle surveille le **retour antenne**, ce que la chaîne diffuse vraiment, quelques secondes après le programme du car.`,
      car: { text: 'Au poste Réalisateur, chaque bouton est un ordre (« Prépare… », TOP, ENCHAÎNE, SCORE) exécuté par le truquiste simulé ; au poste Scripte, le timecode maître, le temps de jeu, le conducteur et les notes d\'actions ; au poste Production, le programme et le retour antenne.', station: 'realisateur' },
      terms: ['tsl-umd', 'st2110-40'],
      competences: ['2.8', '4.1', '3.11'],
      article: 'icomguide',
      exercises: [
        { id: 'realisateur-ordres', intro: 'Au poste Réalisateur, vous donnerez les ordres au truquiste simulé : « Prépare », « Top », « Enchaîne », puis le score. Annoncez toujours avant de déclencher, et vérifiez au multiview que la caméra annoncée passe au vert avant votre top, puis au rouge.' },
        { id: 'scripte-notes', intro: 'Au poste Scripte, vous lirez le timecode maître et le temps de jeu, puis vous enverrez la dernière action notée au serveur ralenti. Observez que l\'EVS se cale quelques secondes avant le timecode de la note : c\'est la même horloge pour tout le car.' },
        { id: 'production-suivi', intro: 'Au poste Production, vous comparerez le programme qui sort du car et le retour antenne de la chaîne, puis vous lirez le compte des coupes et des enchaînés. Notez le décalage de quelques secondes du retour : c\'est la production qui suit ce que la chaîne diffuse vraiment.' },
      ],
      quiz: [
        { q: 'Le réalisateur dit « Top » sans avoir annoncé de caméra. Que fait le truquiste ?', choices: ['Il coupe sur la source en preset, quelle qu\'elle soit', 'Rien : le mélangeur refuse une coupe sans annonce', 'Il coupe sur la CAM 1, le plan large'], answer: 0, why: 'Il y a toujours une source en preset, souvent l\'ancien plan revenu là après la dernière transition : le top la met à l\'antenne. Le mélangeur ne connaît pas les annonces, elles servent aux personnes ; et rien ne ramène automatiquement au plan large.' },
        { q: 'La scripte note une action à 21:04:37:24. Que veut dire « 24 » ?', choices: ['La 25e et dernière image de la seconde (images 00 à 24)', 'La 24e trame sur 50', 'Le numéro de la caméra'], answer: 0, why: 'Le timecode se lit heures:minutes:secondes:images ; à 25 images par seconde, les images sont numérotées de 00 à 24. Il ne compte pas les trames, et il ne dit rien de la caméra : c\'est la même heure pour toutes les sources.' },
        { q: 'La chaîne demande de décaler la page de publicité de la mi-temps. Qui en décide dans le car ?', choices: ['La production', 'La scripte', 'Le truquiste'], answer: 0, why: 'La production est l\'interlocutrice de la chaîne pour le conducteur et les horaires. La scripte annonce et suit le temps, le truquiste exécute les ordres du réalisateur : ils appliquent le nouveau déroulé, ils ne le négocient pas.' },
      ],
    },
  ],
});

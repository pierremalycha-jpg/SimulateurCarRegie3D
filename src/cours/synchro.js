// @ts-check
import { el } from '../util.js';
import { registerChapter } from './index.js';
import { figure, sv, canvas, slider, choice, readout, fmtNum } from './kit.js';

// ----------------------------------------------------------------------------------
// Chapitre « La synchro » : la référence et le genlock (deux sources dont on règle la phase H et V,
// un mélangeur qui coupe proprement ou non selon sa fenêtre d'entrée), puis le timecode (images ↔
// HH:MM:SS:II à 25, 50 et 29,97 images/s, deux machines à caler sur la même heure).
// ----------------------------------------------------------------------------------

// ---------------- genlock : les formats et la fenêtre du mélangeur ----------------
// durée d'une ligne : 1 125 lignes par image ; 1080p50 = 56 250 lignes/s, 1080i50 (25 images) = 28 125 lignes/s
const GL_FMT = {
  p50: { name: '1080p50', lineUs: 1e6 / 56250, frameMs: 20, clockMHz: 148.5 },
  i50: { name: '1080i50', lineUs: 1e6 / 28125, frameMs: 40, clockMHz: 74.25 },
};
const PPM = 20; // écart d'un quartz libre, ordre de grandeur : 20 µs de dérive par seconde
const NS_PER_M = 5; // propagation dans un coaxial (facteur de vélocité ≈ 0,66) : ≈ 5 ns par mètre
const signed = (v, d = 1) => (v > 0 ? '+' : v < 0 ? '−' : '') + fmtNum(Math.abs(v), d);
const lines = (v) => `${signed(v, 0) || '0'} ligne${Math.abs(v) > 1 ? 's' : ''}`;
// décompose un décalage total (µs) en lignes entières et reste dans la ligne, comme l'affichage Timing
const split = (t, L) => { const v = Math.round(t / L); return { v, h: t - v * L }; };

// le plan d'une caméra pour le moniteur de sortie (A : plan large, B : plan serré)
function drawShot(g, which, w, h) {
  g.fillStyle = which === 'A' ? '#24521c' : '#2c5f22'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#3a4a5a'; g.fillRect(0, 0, w, h * 0.22);
  g.strokeStyle = 'rgba(235,240,230,.75)'; g.lineWidth = 1.5;
  if (which === 'A') {
    g.beginPath(); g.moveTo(w / 2, h * 0.22); g.lineTo(w / 2, h); g.stroke();
    g.beginPath(); g.ellipse(w / 2, h * 0.62, w * 0.12, h * 0.16, 0, 0, 7); g.stroke();
    /** @type {[number, number, string][]} */
    const players = [[0.3, 0.5, '#d22a1e'], [0.42, 0.7, '#d22a1e'], [0.6, 0.55, '#f1f1f1'], [0.7, 0.75, '#f1f1f1'], [0.52, 0.42, '#d22a1e']];
    for (const [x, y, c] of players) { g.fillStyle = c; g.fillRect(x * w - 2, y * h - 6, 4, 9); }
  } else {
    g.beginPath(); g.moveTo(0, h * 0.8); g.lineTo(w, h * 0.7); g.stroke();
    g.fillStyle = '#d22a1e'; g.fillRect(w * 0.38, h * 0.3, w * 0.12, h * 0.42); g.fillStyle = '#ffd400'; g.fillRect(w * 0.42, h * 0.3, w * 0.04, h * 0.42);
    g.fillStyle = '#e8c9a8'; g.beginPath(); g.arc(w * 0.44, h * 0.24, h * 0.07, 0, 7); g.fill();
    g.fillStyle = '#f1f1f1'; g.beginPath(); g.arc(w * 0.62, h * 0.72, h * 0.05, 0, 7); g.fill();
  }
  g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(4, h - 16, 44, 13);
  g.fillStyle = '#e3e7e1'; g.font = '10px Arial, sans-serif'; g.fillText(which === 'A' ? 'CAM 1' : 'CAM 2', 8, h - 6);
}

function demoGenlock(host) {
  let fmt = 'p50', mode = 'fen', bLocked = true;
  const src = { A: { v: 0, h: -1.5 }, B: { v: 0, h: 4 } };
  let drift = 0, pgm = 'A', cutT = -1, lastTs = 0;
  const TW = 300, TH = 210, MW = 240, MH = 135;
  const tim = canvas(TW, TH, 'co-canvas co-smooth'), mon = canvas(MW, MH);
  const gt = tim.getContext('2d'), gm = mon.getContext('2d');
  // les deux plans, dessinés une fois
  const shots = {};
  for (const k of ['A', 'B']) { const c = document.createElement('canvas'); c.width = MW; c.height = MH; drawShot(c.getContext('2d'), k, MW, MH); shots[k] = c; }
  const read = readout(['Durée d\'une ligne', 'Source A (CAM 1)', 'Source B (CAM 2)', 'Entrée du mélangeur', 'À la coupe', 'L\'écart A–B en câble']);
  const verdict = el('p', { class: 'co-verdict' });
  const offsetOf = (k) => { const F = GL_FMT[fmt]; return src[k].v * F.lineUs + src[k].h + (k === 'B' && !bLocked ? drift : 0); };
  const inWindow = (t) => mode === 'sync' || Math.abs(t) <= GL_FMT[fmt].lineUs / 2;
  const drawTiming = () => {
    const F = GL_FMT[fmt], L = F.lineUs, VMAX = 6;
    const X = (h) => TW / 2 + h / (L / 2) * (TW / 2 - 24), Y = (v) => TH / 2 - 10 + v / VMAX * (TH / 2 - 28);
    gt.fillStyle = '#0b1013'; gt.fillRect(0, 0, TW, TH);
    // la fenêtre du mélangeur : la ligne zéro, ± ½ ligne autour de la référence
    gt.fillStyle = mode === 'sync' ? 'rgba(127,209,160,.10)' : 'rgba(127,209,160,.22)';
    if (mode === 'sync') gt.fillRect(24, Y(VMAX + 0.5), TW - 48, Y(-VMAX - 0.5) - Y(VMAX + 0.5)); else gt.fillRect(24, Y(-0.5), TW - 48, Y(0.5) - Y(-0.5) + 0);
    gt.strokeStyle = '#424c56'; gt.lineWidth = 1;
    for (let v = -VMAX; v <= VMAX; v++) { gt.beginPath(); gt.moveTo(20, Math.round(Y(v)) + 0.5); gt.lineTo(TW - 20, Math.round(Y(v)) + 0.5); gt.stroke(); }
    gt.strokeStyle = '#8a949c'; gt.beginPath(); gt.moveTo(TW / 2 + 0.5, 10); gt.lineTo(TW / 2 + 0.5, TH - 30); gt.stroke();
    gt.beginPath(); gt.moveTo(20, Math.round(Y(0)) + 0.5); gt.lineTo(TW - 20, Math.round(Y(0)) + 0.5); gt.stroke();
    gt.fillStyle = '#aab4ba'; gt.font = '10px Arial, sans-serif';
    gt.fillText('en avance', 24, TH - 16); gt.fillText('en retard', TW - 70, TH - 16);
    gt.fillText(`− ½ ligne (${fmtNum(L / 2, 1)} µs)`, 24, TH - 4); gt.fillText(`+ ½ ligne`, TW - 70, TH - 4);
    gt.fillText('lignes ↑ en avance', TW / 2 + 6, 18); gt.fillText('↓ en retard', TW / 2 + 6, TH - 34);
    gt.fillStyle = '#7fd1a0'; gt.fillText(mode === 'sync' ? 'synchroniseur : tout est repris' : 'fenêtre du mélangeur', 28, Y(0) - 6);
    for (const [k, col] of [['A', '#ffd38a'], ['B', '#7fd3f3']]) {
      const { v, h } = split(offsetOf(k), L);
      const out = Math.abs(v) > VMAX, vy = Math.max(-VMAX, Math.min(VMAX, v));
      const x = X(h), y = Y(vy);
      gt.fillStyle = col; gt.beginPath(); gt.arc(x, y, 6, 0, 7); gt.fill();
      gt.fillStyle = '#0b1013'; gt.font = 'bold 9px Arial, sans-serif'; gt.fillText(k, x - 3, y + 3);
      if (out) { gt.fillStyle = col; gt.font = '10px Arial, sans-serif'; gt.fillText(`${v > 0 ? '▼' : '▲'} ${signed(v, 0)} lignes`, Math.min(TW - 80, x + 9), y + 4); }
    }
  };
  const drawMon = (now) => {
    const t = (now - cutT) / 1000, B = offsetOf(pgm), bad = !inWindow(B), shot = shots[pgm];
    gm.fillStyle = '#000'; gm.fillRect(0, 0, MW, MH);
    if (cutT >= 0 && t < 0.6 && bad) {
      // la coupe hors fenêtre : les appareils en aval perdent la synchro, l'image roule quelques images
      const k = 1 - t / 0.6, dy = Math.round(k * MH * 0.8) % MH;
      gm.drawImage(shot, 0, dy - MH); gm.drawImage(shot, 0, dy);
      gm.fillStyle = '#000'; gm.fillRect(0, dy - 6, MW, 8);
      gm.fillStyle = 'rgba(255,255,255,.35)'; for (let y = 0; y < MH; y += 3) if (((y * 7919 + Math.floor(now / 40)) % 11) === 0) gm.fillRect(0, y, MW, 1);
    } else if (bad) {
      // hors fenêtre, le mélangeur ne peut pas réaligner : l'image de B arrive décalée (bande noire, image coupée)
      const { v, h } = split(B, GL_FMT[fmt].lineUs);
      const dy = Math.max(-MH / 3, Math.min(MH / 3, v * 3)), dx = Math.round(h / (GL_FMT[fmt].lineUs / 2) * 24);
      gm.drawImage(shot, dx, dy);
      gm.fillStyle = '#000'; if (dy > 0) gm.fillRect(0, 0, MW, dy); else gm.fillRect(0, MH + dy, MW, -dy);
      if (dx > 0) gm.fillRect(0, 0, dx, MH); else gm.fillRect(MW + dx, 0, -dx, MH);
    } else gm.drawImage(shot, 0, 0);
    gm.fillStyle = bad ? '#ff8a80' : '#e3e7e1'; gm.font = 'bold 10px Arial, sans-serif'; gm.fillText('PGM', MW - 30, 13);
  };
  const calc = () => {
    const F = GL_FMT[fmt], L = F.lineUs, A = offsetOf('A'), B = offsetOf('B');
    const txt = (k, t) => { const { v, h } = split(t, L); return `${signed(v, 0) || '0'} ligne${Math.abs(v) > 1 ? 's' : ''} ${signed(h)} µs, soit ${signed(t)} µs (${signed(t * F.clockMHz, 0)} échantillons)${k === 'B' && !bLocked ? ' · libre : dérive' : ''}`; };
    read.set('Durée d\'une ligne', `${fmtNum(L, 2)} µs en ${F.name} (1 125 lignes, ${F.frameMs} ms par image)`);
    read.set('Source A (CAM 1)', txt('A', A));
    read.set('Source B (CAM 2)', txt('B', B));
    read.set('Entrée du mélangeur', mode === 'sync' ? `synchroniseur d'images : accepte tout, au prix d'une image de retard au plus (${F.frameMs} ms)` : `fenêtre ± ½ ligne = ± ${fmtNum(L / 2, 2)} µs (mémoire de ligne)`);
    const okA = inWindow(A), okB = inWindow(B);
    const one = (k, t, ok) => (ok ? `vers ${k} : propre` : `vers ${k} : saut d'image (hors fenêtre de ${fmtNum(Math.abs(t) - L / 2, 1)} µs)`);
    read.set('À la coupe', mode === 'sync' ? (bLocked ? 'propre : chaque source est remise au top image, avec un retard' : `propre, mais B saute ou répète une image toutes les ${fmtNum(F.frameMs / 1000 / (PPM * 1e-6) / 60, 1)} min (dérive de ${PPM} ppm)`)
      : `${one('A', A, okA)} · ${one('B', B, okB)}`);
    const dAB = Math.abs(B - A), m = dAB * 1000 / NS_PER_M;
    read.set('L\'écart A–B en câble', `${fmtNum(dAB, 1)} µs ≈ ${m < 2000 ? fmtNum(m, 0) + ' m' : fmtNum(m / 1000, 1) + ' km'} de coaxial (≈ ${NS_PER_M} ns/m)${m >= 2000 ? ' : un tel écart vient d\'un traitement, pas d\'un câble' : ''}`);
    verdict.className = 'co-verdict ' + (okA && okB ? (bLocked || mode === 'sync' ? 'ok' : 'warn') : 'ko');
    verdict.textContent = !bLocked && mode !== 'sync' ? `B n'est pas verrouillée : son quartz dérive de ${PPM} µs par seconde, elle traverse la fenêtre en moins d'une seconde. Verrouillez-la (genlock) ou passez par un synchroniseur.`
      : !okA || !okB ? `Hors fenêtre : ${[!okA ? 'A' : '', !okB ? 'B' : ''].filter(Boolean).join(' et ')} arrive${!okA && !okB ? 'nt' : ''} trop loin de la référence. Réglez la phase (V en lignes, H en µs) pour revenir sur la ligne zéro.`
        : mode === 'sync' && !bLocked ? 'Le synchroniseur sauve la coupe, pas le reste : B est en retard d\'une image au plus, et le son doit être retardé d\'autant.'
          : 'Les deux sources sont dans la fenêtre : le mélangeur les réaligne et coupe au top image, sans saut.';
    drawTiming();
  };
  const cut = () => { pgm = pgm === 'A' ? 'B' : 'A'; cutT = performance.now(); cutBtn.textContent = pgm === 'A' ? 'Couper vers B (CAM 2)' : 'Couper vers A (CAM 1)'; };
  const cutBtn = el('button', { class: 'btn small primary', onclick: cut }, 'Couper vers B (CAM 2)');
  let raf = 0;
  const loop = (now) => {
    const dt = lastTs ? Math.min(0.1, (now - lastTs) / 1000) : 0; lastTs = now;
    if (!bLocked) { drift += PPM * dt; if (drift > GL_FMT[fmt].frameMs * 1000) drift -= GL_FMT[fmt].frameMs * 1000; calc(); }
    drawMon(now);
    raf = requestAnimationFrame(loop);
  };
  host.append(
    el('div', { class: 'co-ctl' },
      choice('Format', [['p50', '1080p50', 'Ligne de 17,78 µs'], ['i50', '1080i50', 'Ligne de 35,56 µs']], fmt, (v) => { fmt = v; calc(); }),
      choice('Entrée du mélangeur', [['fen', 'fenêtre ± ½ ligne', 'Réalignement par une mémoire de ligne : ordre de grandeur d\'un mélangeur de production'], ['sync', 'synchroniseur d\'images', 'Frame sync : reprend n\'importe quelle source, avec une image de retard au plus']], mode, (v) => { mode = v; calc(); }),
      choice('Source B', [['lock', 'verrouillée (genlock)', 'B suit la référence du SPG'], ['free', 'libre', `B tourne sur son propre quartz, à ${PPM} ppm près`]], 'lock', (v) => { bLocked = v === 'lock'; if (bLocked) drift = 0; calc(); })),
    el('div', { class: 'co-ctl' },
      slider('A : phase V', -4, 4, src.A.v, 1, (v) => { src.A.v = v; calc(); }, lines),
      slider('A : phase H', -18, 18, src.A.h, 0.1, (v) => { src.A.h = v; calc(); }, (v) => signed(v) + ' µs')),
    el('div', { class: 'co-ctl' },
      slider('B : phase V', -4, 4, src.B.v, 1, (v) => { src.B.v = v; calc(); }, lines),
      slider('B : phase H', -18, 18, src.B.h, 0.1, (v) => { src.B.h = v; calc(); }, (v) => signed(v) + ' µs')),
    el('div', { class: 'co-2' },
      el('figure', { class: 'co-figc' }, tim, el('figcaption', {}, 'Timing par rapport à la référence, comme la tuile Timing du PRISM : verticalement les lignes, horizontalement les µs dans la ligne. Au centre, la source est à l\'heure.')),
      el('figure', { class: 'co-figc' }, mon, el('figcaption', {}, 'Sortie du mélangeur (PGM)'), el('div', { class: 'co-btns' }, cutBtn))),
    verdict, read.el);
  calc();
  raf = requestAnimationFrame(loop);
  return { destroy: () => cancelAnimationFrame(raf) };
}

// schéma : la distribution de la référence, et les deux signaux (black burst, tri-level)
function figGenlock() {
  const f = figure(440, 196, 'La référence du car : le GPS cale le SPG, qui distribue par des DA une référence black burst ou tri-level à chaque appareil ; à droite, la forme de ces deux signaux autour du top de synchro');
  const box = (x, y, w, h, t, s, col = '#8a949c') => { f.append(sv('rect', { x, y, width: w, height: h, rx: 3, fill: '#1a2128', stroke: col })); f.append(sv('text', { x: x + w / 2, y: y + (s ? h / 2 - 1 : h / 2 + 4), textAnchor: 'middle', class: 'co-t' }, t)); if (s) f.append(sv('text', { x: x + w / 2, y: y + h / 2 + 11, textAnchor: 'middle', class: 'co-s' }, s)); };
  const line = (x1, y1, x2, y2, col = '#8a949c') => f.append(sv('line', { x1, y1, x2, y2, stroke: col, strokeWidth: 1.3 }));
  box(4, 18, 46, 30, 'GPS', '', '#7fd3f3'); line(50, 33, 62, 33, '#7fd3f3');
  box(62, 12, 58, 42, 'SPG', 'générateur', '#ffd38a'); line(91, 54, 91, 76, '#ffd38a');
  box(66, 76, 50, 30, 'DA', '', '#ffd38a');
  const devs = ['CCU 1 … 12', 'EVS', 'Mélangeur', 'Grille', 'Multiview'];
  devs.forEach((d, i) => { const y = 8 + i * 30; line(116, 91, 136, y + 11, '#ffd38a'); box(136, y, 72, 22, d); });
  f.append(sv('text', { x: 4, y: 124, class: 'co-s' }, 'en étoile,'), sv('text', { x: 4, y: 136, class: 'co-s' }, 'coaxial 75 Ω,'), sv('text', { x: 4, y: 148, class: 'co-s' }, 'une sortie'), sv('text', { x: 4, y: 160, class: 'co-s' }, 'par appareil'));
  f.append(sv('text', { x: 4, y: 176, class: 'co-s' }, 'Chaque appareil se verrouille,'), sv('text', { x: 4, y: 188, class: 'co-s' }, 'puis on règle sa phase V et H.'));
  // black burst : top de 4,7 µs à −300 mV, puis la salve de sous-porteuse (4,43 MHz, 10 cycles)
  const g1 = sv('g', { transform: 'translate(226 0)' }), k1 = 16; // px par µs
  g1.append(sv('text', { x: 0, y: 14, class: 'co-t' }, 'Black burst (SD, 625 lignes)'));
  const y0 = 46, mv = 0.06; // px par mV
  let d = `M0 ${y0} H${1.5 * k1} L${1.6 * k1} ${y0 + 300 * mv} H${6.3 * k1} L${6.4 * k1} ${y0} H${7.0 * k1}`;
  for (let i = 0; i <= 90; i++) { const t = 7.0 + i * 2.25 / 90; d += ` L${(t * k1).toFixed(1)} ${(y0 - Math.sin(i / 90 * 10 * 2 * Math.PI) * 150 * mv).toFixed(1)}`; }
  d += ` H${12.4 * k1}`;
  g1.append(sv('path', { d, fill: 'none', stroke: '#ffd38a', strokeWidth: 1.5 }));
  g1.append(sv('line', { x1: 1.55 * k1, y1: 24, x2: 1.55 * k1, y2: 72, stroke: '#e3e7e1', 'stroke-dasharray': '2 2' }), sv('text', { x: 1.55 * k1 + 3, y: 30, class: 'co-s' }, '0H'));
  g1.append(sv('text', { x: 1.7 * k1, y: y0 + 300 * mv + 12, class: 'co-s' }, '−300 mV · 4,7 µs'), sv('text', { x: 7.0 * k1, y: y0 - 14, class: 'co-s' }, 'salve 4,43 MHz'));
  g1.append(sv('text', { x: 0, y: 92, class: 'co-s' }, 'une ligne dure 64 µs'));
  // tri-level : −300 mV puis +300 mV, 44 périodes d'horloge chacun (0,59 µs en 1080i), repère au passage à 0 V
  const g2 = sv('g', { transform: 'translate(226 100)' }), k2 = 50, z = 44;
  g2.append(sv('text', { x: 0, y: 14, class: 'co-t' }, 'Tri-level (HD)'));
  const p2 = `M0 ${z} H${0.6 * k2} L${0.64 * k2} ${z + 300 * mv} H${1.2 * k2} L${1.28 * k2} ${z - 300 * mv} H${1.84 * k2} L${1.88 * k2} ${z} H${4.2 * k2}`;
  g2.append(sv('path', { d: p2, fill: 'none', stroke: '#7fd3f3', strokeWidth: 1.5 }));
  g2.append(sv('line', { x1: 1.24 * k2, y1: 22, x2: 1.24 * k2, y2: 70, stroke: '#e3e7e1', 'stroke-dasharray': '2 2' }), sv('text', { x: 1.24 * k2 + 4, y: 70, class: 'co-s' }, 'repère : passage à 0 V'));
  g2.append(sv('text', { x: 1.98 * k2, y: z - 22, class: 'co-s' }, '−300 puis +300 mV,'), sv('text', { x: 1.98 * k2, y: z - 9, class: 'co-s' }, '0,59 µs chacun'));
  g2.append(sv('text', { x: 0, y: 86, class: 'co-s' }, 'symétrique, sans composante continue'));
  f.append(g1, g2);
  return f;
}

// ---------------- timecode : les calculs ----------------
// 29,97 images/s drop-frame : on saute les numéros 00 et 01 au début de chaque minute, sauf toutes les 10 minutes
const TC_RATES = {
  25: { fps: 25, nom: 25, df: false, name: '25 images/s' },
  50: { fps: 50, nom: 50, df: false, name: '50 images/s' },
  df: { fps: 30000 / 1001, nom: 30, df: true, name: '29,97 images/s drop-frame' },
};
const pad = (n) => String(n).padStart(2, '0');
/** nombre d'images (depuis minuit) → { h, m, s, f } */
export function framesToTC(n, R) {
  let f = Math.max(0, Math.floor(n));
  if (R.df) { const D = Math.floor(f / 17982), M = f % 17982; f += 18 * D + (M > 1 ? 2 * Math.floor((M - 2) / 1798) : 0); }
  const s = Math.floor(f / R.nom);
  return { h: Math.floor(s / 3600) % 24, m: Math.floor(s / 60) % 60, s: s % 60, f: f % R.nom };
}
/** { h, m, s, f } → nombre d'images depuis minuit */
export function tcToFrames(t, R) {
  let n = ((t.h * 60 + t.m) * 60 + t.s) * R.nom + t.f;
  if (R.df) { const tm = t.h * 60 + t.m; n -= 2 * (tm - Math.floor(tm / 10)); }
  return n;
}
const tcStr = (t, R) => `${pad(t.h)}:${pad(t.m)}:${pad(t.s)}${R.df ? ';' : ':'}${pad(t.f)}`;
/** lit « HH:MM:SS:II » (ou ; avant les images) ; renvoie un message d'erreur si le timecode n'existe pas */
function parseTC(str, R) {
  const m = /^\s*(\d{1,2})[:.](\d{1,2})[:.](\d{1,2})[:;.](\d{1,2})\s*$/.exec(str);
  if (!m) return { err: 'Écrivez HH:MM:SS:II, par exemple 20:47:13:12.' };
  const t = { h: +m[1], m: +m[2], s: +m[3], f: +m[4] };
  if (t.h > 23 || t.m > 59 || t.s > 59) return { err: 'Heures de 00 à 23, minutes et secondes de 00 à 59.' };
  if (t.f >= R.nom) return { err: `En ${R.name}, les images vont de 00 à ${pad(R.nom - 1)}.` };
  if (R.df && t.s === 0 && t.f < 2 && t.m % 10 !== 0) return { err: `${tcStr(t, R)} n'existe pas en drop-frame : les numéros 00 et 01 sont sautés au début de chaque minute (sauf les minutes multiples de 10).` };
  return { t };
}
const dur = (sec) => { const h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, s = sec % 60; return `${h ? h + ' h ' : ''}${h || m ? m + ' min ' : ''}${fmtNum(s, s % 1 ? 3 : 0)} s`; };

function demoTimecode(host) {
  let rate = '25', n = 1250;
  const R = () => TC_RATES[rate];
  // 1. images ↔ timecode
  const nIn = /** @type {HTMLInputElement} */ (el('input', { type: 'number', min: 0, step: 1, value: n, 'aria-label': 'Nombre d\'images depuis minuit' }));
  const tcIn = /** @type {HTMLInputElement} */ (el('input', { type: 'text', value: '', spellcheck: 'false', 'aria-label': 'Timecode HH:MM:SS:II' }));
  const msg = el('p', { class: 'co-note' });
  const read = readout(['Timecode', 'Images depuis minuit', 'Durée réelle', 'Écart avec l\'horloge', 'Une journée']);
  const show = (fromTc) => {
    const r = R(), perDay = Math.round(86400 * r.fps);
    n = Math.min(perDay - 1, Math.max(0, Math.floor(n)));
    const t = framesToTC(n, r);
    if (!fromTc) tcIn.value = tcStr(t, r);
    if (String(n) !== nIn.value) nIn.value = String(n);
    nIn.max = String(perDay - 1);
    tcIn.setAttribute('aria-invalid', 'false');
    const real = n / r.fps, nominal = ((t.h * 60 + t.m) * 60 + t.s) + t.f / r.nom;
    read.set('Timecode', tcStr(t, r) + (rate === '50' ? `  (ST 12-1 : ${pad(t.h)}:${pad(t.m)}:${pad(t.s)}:${pad(t.f >> 1)}, ${t.f & 1 ? 'deuxième' : 'première'} image de la paire)` : ''));
    read.set('Images depuis minuit', `${fmtNum(n)} = ((${t.h} × 60 + ${t.m}) × 60 + ${t.s}) × ${r.nom} + ${t.f}${r.df ? ' − numéros sautés' : ''}`);
    read.set('Durée réelle', dur(Math.round(real * 1000) / 1000));
    const ndf = n / r.nom; // ce qu'afficherait un compteur de 30 par seconde (non drop-frame)
    read.set('Écart avec l\'horloge', r.df ? `${fmtNum((nominal - real) * 1000, 0)} ms en drop-frame ; sans drop-frame, le compteur aurait ${fmtNum(real - ndf, 2)} s de retard` : 'aucun : ' + r.nom + ' images font exactement une seconde, pas de drop-frame');
    read.set('Une journée', `${fmtNum(perDay)} images, de 00:00:00${r.df ? ';' : ':'}00 à ${tcStr(framesToTC(perDay - 1, r), r)}`);
    msg.textContent = '';
  };
  nIn.addEventListener('input', () => { if (nIn.value !== '') { n = +nIn.value; show(false); } });
  tcIn.addEventListener('input', () => {
    const p = parseTC(tcIn.value, R());
    if (p.err) { tcIn.setAttribute('aria-invalid', 'true'); msg.textContent = p.err; return; }
    n = tcToFrames(p.t, R()); show(true);
  });
  // 2. deux machines : le SPG (heure du jour, GPS) et un enregistreur B en free run, décalé
  let offset = -384, t0 = performance.now(), lastAct = null;
  const START = 20 * 3600 + 47 * 60 + 5; // 20:47:05 au lancement
  const lcdA = el('div', { class: 'lcd amber big' }), lcdB = el('div', { class: 'lcd big' });
  const log = el('ol', { class: 'co-journal' });
  const read2 = readout(['Écart de B sur le SPG', 'Pour retrouver une action sur B', 'B libre après calage']);
  const framesNow = () => Math.floor(START * R().fps + (performance.now() - t0) / 1000 * R().fps);
  const offTxt = () => { const r = R(), a = Math.abs(offset), s = Math.floor(a / r.nom), f = a % r.nom; return offset ? `B ${offset < 0 ? 'retarde' : 'avance'} de ${s} s ${f} image${f > 1 ? 's' : ''} (${fmtNum(a)} images, ${fmtNum(a / r.fps, 2)} s)` : 'aucun : B est calé sur le SPG'; };
  const upd2 = () => {
    read2.set('Écart de B sur le SPG', offTxt());
    const r = R(), last = lastAct != null ? ` : l'action notée à ${tcStr(framesToTC(lastAct, r), r)} est à ${tcStr(framesToTC(lastAct + offset, r), r)} sur B` : '';
    read2.set('Pour retrouver une action sur B', (offset ? `heure du SPG ${offset < 0 ? '−' : '+'} ${fmtNum(Math.abs(offset))} images` : 'la même heure que celle notée par la scripte') + last);
    read2.set('B libre après calage', `un quartz à ${PPM} ppm dérive d'une image toutes les ${fmtNum(1 / (R().fps * PPM * 1e-6) / 60, 0)} min : on recale avant chaque match, ou on asservit B au LTC`);
  };
  const tick = () => { const r = R(), a = framesNow(); lcdA.textContent = tcStr(framesToTC(a, r), r); lcdB.textContent = tcStr(framesToTC(a + offset, r), r); };
  const timer = setInterval(tick, 40);
  const goal = () => {
    const r = R(), a = framesNow(), ta = tcStr(framesToTC(a, r), r), tb = tcStr(framesToTC(a + offset, r), r);
    lastAct = a; upd2();
    log.append(el('li', {}, offset ? `Action : ${ta} sur le SPG (noté par la scripte), ${tb} sur B : sans calcul, l'opérateur chercherait au mauvais endroit.` : `Action : ${ta} sur le SPG et sur B : le même instant, la même heure.`));
    while (log.children.length > 4) log.firstChild.remove();
  };
  const offSl = slider('Décalage de B', -500, 500, offset, 1, (v) => { offset = v; upd2(); tick(); }, (v) => `${signed(v, 0) || '0'} images`);
  const offIn = /** @type {HTMLInputElement} */ (offSl.querySelector('input'));
  const jam = () => { offset = 0; offIn.value = '0'; offIn.dispatchEvent(new Event('input')); log.append(el('li', {}, 'B calé sur le LTC du SPG (jam sync) : les deux machines affichent la même heure.')); while (log.children.length > 4) log.firstChild.remove(); };
  host.append(
    el('div', { class: 'co-ctl' }, choice('Cadence', [['25', '25 i/s', 'Europe, 1080i25 et 1080p25'], ['50', '50 i/s', '1080p50 : le car'], ['df', '29,97 DF', 'Amériques, Japon : drop-frame']], rate, (v) => { rate = v; t0 = performance.now(); lastAct = null; show(false); upd2(); tick(); })),
    el('div', { class: 'co-ctl' },
      el('label', { class: 'co-field' }, el('span', {}, 'Images depuis minuit'), nIn),
      el('label', { class: 'co-field' }, el('span', {}, 'Timecode'), tcIn)),
    msg, read.el,
    el('h5', { class: 'co-h5' }, 'Deux machines, une seule heure'),
    el('div', { class: 'co-2' },
      el('figure', { class: 'co-figc' }, lcdA, el('figcaption', {}, 'SPG : heure du jour, calée sur le GPS (LTC distribué à tout le car)')),
      el('figure', { class: 'co-figc' }, lcdB, el('figcaption', {}, 'Enregistreur B : son propre compteur (free run)'))),
    el('div', { class: 'co-ctl' }, offSl,
      el('div', { class: 'co-btns' }, el('button', { class: 'btn small primary', onclick: goal }, 'Une action : la scripte note l\'heure'), el('button', { class: 'btn small', onclick: jam }, 'Caler B sur le SPG (jam sync)'))),
    log, read2.el);
  show(false); upd2(); tick();
  return { destroy: () => clearInterval(timer) };
}

// schéma : le mot de timecode et ses trois supports
function figTimecode() {
  const f = figure(440, 176, 'Le timecode HH:MM:SS:II, son mot LTC de 80 bits (heure en BCD, bits utilisateur, drapeaux, mot de synchro) et ses trois supports : LTC, VITC, ATC');
  const digits = [['20', 'heures'], ['47', 'minutes'], ['13', 'secondes'], ['12', 'images']];
  digits.forEach(([v, l], i) => {
    f.append(sv('text', { x: 40 + i * 64, y: 34, textAnchor: 'middle', class: 'co-m', style: 'fill: #ffd38a; font-size: 26px' }, v));
    if (i < 3) f.append(sv('text', { x: 72 + i * 64, y: 32, textAnchor: 'middle', class: 'co-m', style: 'font-size: 22px' }, ':'));
    f.append(sv('text', { x: 40 + i * 64, y: 50, textAnchor: 'middle', class: 'co-s' }, l));
  });
  f.append(sv('text', { x: 290, y: 22, class: 'co-s' }, 'à 25 i/s : images 00 à 24'), sv('text', { x: 290, y: 36, class: 'co-s' }, '2 160 000 images par jour'), sv('text', { x: 290, y: 50, class: 'co-s' }, 'à 29,97 DF : 01:00:00;02'));
  // le mot LTC : 80 bits, dans l'ordre de ST 12-1
  /** @type {[string, number][]} */
  const seg = [['t', 4], ['u', 4], ['t', 2], ['x', 2], ['u', 4], ['t', 4], ['u', 4], ['t', 3], ['x', 1], ['u', 4], ['t', 4], ['u', 4], ['t', 3], ['x', 1], ['u', 4], ['t', 4], ['u', 4], ['t', 2], ['x', 2], ['u', 4], ['s', 16]];
  const COL = { t: '#ffd38a', u: '#424c56', x: '#7fd3f3', s: '#8a949c' };
  let b = 0; const bw = 5.2, x0 = 12, y = 66;
  for (const [k, n] of seg) { f.append(sv('rect', { x: x0 + b * bw, y, width: n * bw - 1, height: 14, fill: COL[k] })); b += n; }
  [['t', 'heure (26 bits)'], ['u', 'bits utilisateur (32)'], ['x', 'drapeaux (6)'], ['s', 'synchro (16)']].forEach(([k, t], i) => {
    f.append(sv('rect', { x: x0 + i * 106, y: y + 20, width: 9, height: 9, fill: COL[k] }), sv('text', { x: x0 + i * 106 + 13, y: y + 28, class: 'co-s' }, t));
  });
  f.append(sv('text', { x: x0, y: y + 44, class: 'co-s' }, 'LTC : 80 bits × 25 i/s = 2 000 bit/s en biphase, un son entre 1 et 2 kHz'));
  [['LTC', 'signal audio, XLR ou BNC', 'lu en défilement'], ['VITC', 'dans la suppression trame', 'lu à l\'arrêt (SD)'], ['ATC', 'données du SDI (ST 12-2)', 'suit l\'image']].forEach(([k, a, b], i) => {
    f.append(sv('text', { x: x0 + i * 142, y: 140, class: 'co-m' }, k), sv('text', { x: x0 + i * 142, y: 154, class: 'co-s' }, a), sv('text', { x: x0 + i * 142, y: 167, class: 'co-s' }, b));
  });
  return f;
}

registerChapter({
  id: 'synchro', title: 'La synchro', icon: 'synchro',
  intro: 'Toutes les machines du car commencent leurs images au même instant : la référence, le genlock, le timecode.',
  lessons: [
    {
      id: 'synchro-genlock', title: 'La référence et le genlock', minutes: '8 min',
      essentials: [
        'Toutes les sources doivent commencer leurs images au même instant : chacune se **verrouille** (genlock) sur la **référence** du générateur de synchro (**SPG**), lui-même calé sur le GPS.',
        'La référence est un **black burst** (hérité de la SD) ou un **tri-level** (HD), distribuée en étoile ; on règle ensuite la **phase** de chaque appareil, V en lignes et H en µs.',
        'Le mélangeur réaligne dans une petite **fenêtre** (de l\'ordre de ± ½ ligne, 8,9 µs en 1080p50) ; au-delà, ou sans genlock, l\'image saute à la coupe.',
      ],
      figure: figGenlock,
      demoTitle: 'Coupez vers B, puis poussez la phase H de B au-delà de 9 µs et recoupez ; mettez B en « libre » et regardez-la défiler ; passez l\'entrée en synchroniseur.',
      demo: demoGenlock,
      body: `Le mélangeur fabrique le programme en passant d'une source à l'autre **au top image** : la commutation se fait dans l'intervalle de suppression, sur une ligne prévue pour cela (la ligne 7 en 1080, recommandation SMPTE RP 168), entre la fin d'une image et le début de la suivante. Pour que la coupe ne se voie pas, toutes les sources doivent commencer leurs images et leurs lignes au même instant : elles sont **synchrones**. C'est le rôle du **genlock** (generator lock) : chaque appareil cale le rythme de sa sortie sur une **référence** commune, au lieu de suivre son propre quartz.

Cette référence vient du **SPG** (Sync Pulse Generator), distribuée en étoile par des **DA** (distributeurs) sur du coaxial 75 Ω, une sortie par appareil : CCU, serveurs ralenti, habillage, mélangeur, grille, multiview. Deux signaux existent. Le **black burst** est un noir analogique SD (625 lignes, 64 µs par ligne) : un top de synchronisation à −300 mV de 4,7 µs, puis une salve de sous-porteuse couleur à 4,43 MHz ; il porte aussi le rythme des trames, d'où son usage universel, même en HD. Le **tri-level** a été créé pour la HD : une impulsion à −300 mV puis +300 mV, 44 périodes d'horloge chacune (0,59 µs en 1080i). Le repère de temps est le passage à 0 V au milieu : le signal est symétrique, sans composante continue, et le repère ne bouge pas si l'amplitude varie. En production IP, la référence est l'heure **PTP** distribuée par le réseau (ST 2059, chapitre réseau).

Le SPG est **asservi au GPS** : les satellites donnent l'heure à quelques dizaines de nanosecondes près, et la règle ST 2059-1 fixe la phase de toutes les références par rapport à une même origine des temps. Deux cars, le studio et la régie finale de la chaîne produisent ainsi des références en phase sans être reliés. Si le GPS est perdu, le SPG passe en **holdover** : son oscillateur thermostaté (OCXO) continue, avec une dérive de l'ordre de quelques dizaines à quelques centaines de nanosecondes par heure ; l'antenne n'en voit rien. Le SPG est doublé : un secours prend le relais automatiquement (changeover).

Être verrouillé ne suffit pas : chaque appareil a ses temps de traitement, chaque câble son retard (≈ 5 ns par mètre de coaxial, soit 0,5 µs pour 100 m, peu devant une ligne de 17,8 µs en 1080p50). Chaque équipement a donc un réglage de **phase** : **V** en lignes, **H** en µs ou en échantillons (6,7 ns par échantillon à 148,5 MHz), pour que son signal arrive au mélangeur au bon moment. Le mélangeur accepte une **fenêtre** d'entrée et réaligne lui-même avec une mémoire de ligne : de l'ordre de ± ½ ligne à une ligne selon les modèles (± 8,9 µs en 1080p50, à lire dans la notice). Au-delà, il faut un **synchroniseur d'images** (frame sync), qui reprend n'importe quelle source au prix d'une image de retard au plus (20 ms à 50 Hz) : le son doit alors être retardé d'autant.

Sans genlock, une source tourne sur son quartz, juste à quelques dizaines de ppm près : à 20 ppm, elle dérive de 20 µs par seconde, traverse la fenêtre du mélangeur en moins d'une seconde et fait le tour d'une image en 16 min 40 s. À la coupe, l'image **saute** ou **roule**, les appareils en aval (moniteurs, codeur de transmission) perdent la synchronisation quelques images, le son embarqué claque. Un synchroniseur la rattrape, mais il doit sauter ou répéter une image chaque fois que la dérive en a cumulé une. D'où la règle du car : tout ce qui entre au mélangeur est verrouillé sur le SPG, et les sources extérieures (duplex, satellite, caméra HF codée) passent par un synchroniseur.

- Black burst : 625 lignes, 50 trames/s, top de 4,7 µs à −300 mV, salve à 4,43 MHz (ITU-R BT.1700).
- Tri-level : ±300 mV, 0,59 µs par demi-impulsion en 1080i (SMPTE ST 274), ligne de 17,78 µs en 1080p50, 35,56 µs en 1080i50.
- Un câble de 100 m : ≈ 0,5 µs ; une image de synchroniseur : 20 ms, soit 40 000 fois plus.`,
      car: { text: 'Au poste Synchro (zone technique) : l\'heure maître, l\'état du SPG (verrouillé sur le GPS ou en holdover), ses sorties black burst et tri-level, le secours. Une CCU non verrouillée y apparaît en alarme, et « Re-verrouiller toutes les CCU » les remet en phase. À la baie de mesure, la tuile Timing du PRISM place une source par rapport à la référence, en lignes et en µs.', station: 'synchro' },
      terms: ['timing-ref', 'commutation-propre', 'holdover', 'derive'],
      competences: ['1.2', '1.4', '3.12'],
      article: 'timing',
      exercises: [
        { id: 'synchro-reference', intro: 'Au poste Synchro, vous simulez une perte du GPS, puis vous re-verrouillez des CCU qui ont perdu la référence. Comparez les deux cas : en holdover, rien ne change à l\'image ; une CCU décrochée, elle, saute à la commutation.' },
        { id: 'materiel-synchro', intro: 'Dans la visionneuse de matériel, vous ouvrez le SPG puis le distributeur, connecteur par connecteur : GPS, tri-level, LTC, entrée du DA. Suivez le chemin de la référence de la leçon, de l\'antenne GPS sur le toit jusqu\'à chaque appareil.' },
      ],
      quiz: [
        { q: 'Une CCU n\'est plus verrouillée sur la référence. Que voit-on ?', choices: ['Une image normale au multiview, mais un saut ou un roulement à la coupe vers elle', ['Une image noire, tout de suite', 'La CCU continue d\'envoyer une image : c\'est le moment où ses images commencent qui est faux, pas l\'image elle-même.'], ['Des couleurs fausses', 'La référence ne touche pas à la colorimétrie : elle ne donne que le rythme et la phase.']], answer: 0, why: 'Libre, la CCU cadence ses images sur son propre quartz : elles dérivent par rapport aux autres. Son image a l\'air normale ; c\'est à la commutation que le mélangeur ne peut pas la réaligner.' },
        { q: 'En 1080p50, une source arrive 6 µs après la référence ; le mélangeur a une fenêtre de ± ½ ligne. La coupe sera…', choices: ['Propre : 6 µs est sous la demi-ligne de 8,9 µs, le mélangeur réaligne', ['Saccadée : il faut 0 µs exactement', 'C\'est le rôle de la fenêtre : la mémoire de ligne du mélangeur absorbe les petits écarts.'], ['Impossible sans synchroniseur d\'images', 'Le synchroniseur ne sert qu\'au-delà de la fenêtre ou pour une source non verrouillée, et il coûte une image de retard.']], answer: 0, why: 'Une ligne 1080p50 dure 17,8 µs ; la demi-ligne de la fenêtre fait 8,9 µs. À 6 µs du top, la source est réalignée sans saut.' },
        { q: '100 m de câble coaxial sur la référence d\'une CCU : faut-il recaler sa phase ?', choices: [['Oui : 100 m décalent d\'une ligne', 'Une ligne dure 17,8 µs en 1080p50 ; 100 m de coaxial n\'en font que 0,5 µs.'], 'Pas pour la coupe : 0,5 µs environ (5 ns par mètre), bien dans la fenêtre ; ce sont les traitements qui décalent le plus', ['Oui : 100 m décalent d\'une image', 'Une image, c\'est 20 ms : il faudrait 4 000 km de câble.']], answer: 1, why: 'À ≈ 5 ns par mètre, un câble ne décale que de quelques dixièmes de µs. Les gros écarts viennent des traitements : un synchroniseur, un habillage ou un codage HF retardent d\'une image ou plus.' },
      ],
    },
    {
      id: 'synchro-timecode', title: 'Le timecode : une heure pour chaque image', minutes: '7 min',
      essentials: [
        'Le **timecode** date chaque image : **HH:MM:SS:II** (heures, minutes, secondes, images), de 00:00:00:00 à 23:59:59:24 en 25 images/s.',
        'Le SPG le distribue à l\'**heure du jour**, calée sur le GPS : toutes les machines notent la même heure, et l\'on retrouve une action sur chaque caméra enregistrée.',
        'Il voyage en **LTC** (signal audio), **VITC** (dans la suppression trame) ou **ATC** (données du SDI) ; le **drop-frame** ne concerne que le 29,97 images/s, pas le 25 ni le 50.',
      ],
      figure: figTimecode,
      demoTitle: 'Convertissez 1 250 images en timecode à 25 puis à 50 i/s ; tapez 00:01:00;00 en drop-frame ; notez une action, puis calez la machine B sur le SPG.',
      demo: demoTimecode,
      body: `Le timecode SMPTE (ST 12-1) donne à chaque image un nom unique dans la journée : les heures, les minutes, les secondes et le numéro de l'image dans la seconde (II, pour « images » ; FF en anglais, pour frames). En 25 images/s, les images vont de 00 à 24, et une journée en compte 2 160 000. Le calcul est direct : n = ((HH × 60 + MM) × 60 + SS) × 25 + II. Le timecode n'est pas une référence : il ne met pas les images en phase, c'est le rôle du genlock ; il les **date**. Les deux viennent du même SPG et changent ensemble, au début de chaque image.

Dans un car, on travaille en **heure du jour** (time of day) : le SPG lit l'heure du GPS et l'envoie à tout le car, serveurs ralenti, enregistreurs, habillage, multiview, poste de la scripte. La scripte note « but, 20:47:13:12 » ; l'opérateur ralenti retrouve cet instant sur chacune des caméras enregistrées, parce que toutes les entrées du serveur partagent ce timecode. Une machine qui compte pour elle-même (**free run**), ou seulement pendant qu'elle enregistre (**record run**), ne parle pas la même heure : on la **cale** (jam sync) sur le LTC du car. Si elle n'est pas asservie en permanence, elle dérive ensuite avec son quartz : à 20 ppm, une image toutes les 33 minutes en 25 images/s.

Trois supports transportent le même timecode :
- le **LTC** (linear timecode) : 80 bits par image, dont 26 pour l'heure en BCD (chaque chiffre décimal codé sur 4 bits au plus), 32 bits utilisateur et un mot de synchronisation de 16 bits ; codé en biphase, il fait 2 000 bit/s à 25 images/s, un son grinçant entre 1 et 2 kHz qu'on câble en XLR ou en BNC. Il se lit en défilement, pas à l'arrêt ;
- le **VITC** (vertical interval timecode) : inscrit dans deux lignes de la suppression trame d'un signal analogique ou SD, il se lit même image arrêtée ;
- l'**ATC** (ancillary timecode, ST 12-2) : le timecode rangé dans les données auxiliaires du SDI, qui suit l'image à travers la grille. En ST 2110, chaque paquet est horodaté par le PTP et l'heure se déduit de lui (ST 2059-1).

Le **drop-frame** est une affaire de 29,97 images/s, la cadence des Amériques et du Japon (30 000 / 1 001). Compter 30 numéros par seconde y ferait prendre au timecode 3,6 s de retard par heure (108 images). On saute donc deux **numéros** (00 et 01) au début de chaque minute, sauf les minutes multiples de 10 : aucune image n'est supprimée, et le timecode reste à l'heure. On l'écrit avec un point-virgule : 01:00:00;02. En Europe, 25 et 50 images/s sont des nombres entiers : 25 images font exactement une seconde, il n'y a pas de drop-frame.

En **50 images/s**, le timecode ST 12-1 ne sait compter que jusqu'à 30 : il numérote les paires d'images de 00 à 24 et un bit (le drapeau de trame) distingue la deuxième image de chaque paire. Selon les machines, on lit donc 00 à 24 avec un repère, ou directement 00 à 49 ; une seconde fait 50 images, une minute 3 000.`,
      car: { text: 'Au poste Synchro, l\'heure maître affiche le timecode du SPG (LTC 25 i/s, heure locale). La scripte note chaque action avec ce timecode, et l\'opérateur ralenti retrouve le même instant sur toutes les entrées de l\'EVS, qui reçoit le LTC sur son entrée LTC IN.', station: 'synchro' },
      terms: ['st2059', 'ptp', 'supervision'],
      competences: ['1.3', '2.5'],
      article: 'evsarch',
      quiz: [
        { q: 'Combien d\'images dans une minute à 50 images/s ?', choices: [['1 500', 'C\'est une minute à 25 images/s.'], '3 000', ['3 600', '3 600, ce sont les secondes d\'une heure.']], answer: 1, why: '60 s × 50 images = 3 000 images. À 25 images/s, on en compte 1 500.' },
        { q: 'Pourquoi n\'y a-t-il pas de drop-frame en 25 images/s ?', choices: ['Parce que 25 images font exactement une seconde : le timecode ne prend pas de retard sur l\'horloge', ['Parce que le 25 images/s n\'a pas de timecode', 'Le timecode existe à toutes les cadences ; c\'est le drop-frame qui n\'est utile qu\'à 29,97.'], ['Parce que le drop-frame supprime des images réelles, ce qu\'on refuse en Europe', 'Le drop-frame ne supprime aucune image : il saute seulement des numéros.']], answer: 0, why: 'Le drop-frame compense les 29,97 images/s : compter 30 numéros par seconde y retarderait le timecode de 3,6 s par heure. À 25 ou 50 images/s, le compte tombe juste.' },
        { q: 'L\'enregistreur B affiche 20:46:58:03 quand le SPG affiche 20:47:13:12 (25 i/s). La scripte a noté un but à 20:52:40:00, heure du SPG. Où le chercher sur B ?', choices: [['20:52:55:09', 'C\'est l\'écart ajouté au lieu d\'être retiré : B est en retard sur le SPG, pas en avance.'], '20:52:24:16', ['20:52:40:00', 'Ce serait vrai si B était calé sur le SPG ; ici il a 15 s 9 images de retard.']], answer: 1, why: 'B retarde de 15 s 9 images (20:47:13:12 − 20:46:58:03). On retire cet écart à l\'heure notée : 20:52:40:00 − 15 s 9 images = 20:52:24:16. Mieux : caler B sur le LTC du SPG avant le match.' },
      ],
    },
  ],
});

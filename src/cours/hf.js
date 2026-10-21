// @ts-check
import { el } from '../util.js';
import { registerChapter } from './index.js';
import { figure, sv, canvas, slider, choice, readout, fmtNum } from './kit.js';
import { CN_REQ, GUARDS, cofdmBitrate, buildChannels } from '../data/rf.js';

// ----------------------------------------------------------------------------------
// Chapitre « La HF » : bandes et fréquences (spectre, intermodulation des micros), bilan de
// liaison (affaiblissement en espace libre, marge), antennes et diversité (diagramme de
// rayonnement, évanouissements multi-trajet), COFDM (intervalle de garde, débit contre
// robustesse). Les chiffres sont ceux du modèle HF du simulateur (data/rf.js, rf.js).
// ----------------------------------------------------------------------------------
const C = { grey: '#8a949c', amber: '#ffd38a', red: '#ff8a80', green: '#7fd1a0', cyan: '#7fd3f3', box: '#1a2026', line: '#2a3238' };
const txt = (x, y, s, cls = 'co-s', anchor = 'middle') => sv('text', { x, y, textAnchor: anchor, class: cls }, s);
/** affaiblissement en espace libre (dB), d en mètres, f en MHz */
const fspl = (dM, fMHz) => 20 * Math.log10(Math.max(1, dM)) + 20 * Math.log10(fMHz) - 27.55;
const dB1 = (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${fmtNum(Math.abs(v), 1)}`;
const mW = (dBm) => { const m = 10 ** (dBm / 10); return m >= 1000 ? `${fmtNum(m / 1000, 1)} W` : m >= 1 ? `${fmtNum(m, 0)} mW` : m >= 1e-3 ? `${fmtNum(m * 1e3, 0)} µW` : m >= 1e-6 ? `${fmtNum(m * 1e6, 0)} nW` : `${fmtNum(m * 1e9, 1)} pW`; };
const sens = (dBm) => dBm >= 1e3 ? '' : mW(dBm);
const NOISE_8MHZ = -174 + 10 * Math.log10(8e6) + 4; // plancher de bruit d'un récepteur 8 MHz, facteur de bruit 4 dB : ≈ −101 dBm
const IMPL = 1.5; // marge d'implémentation du récepteur (comme rf.js)

// ======================================================================================
// 1. Bandes et fréquences
// ======================================================================================
const LOGMIN = Math.log10(400), LOGMAX = Math.log10(7600);
const fx = (f) => 24 + (Math.log10(f) - LOGMIN) / (LOGMAX - LOGMIN) * 680;
/** @type {{ row: number, f1: number, f2: number, name: string, col: string, up?: boolean }[]} */
const BANDS = [
  { row: 0, f1: 470, f2: 694, name: 'TNT 470–694', col: C.amber },
  { row: 0, f1: 823, f2: 832, name: '823–832 · 863–865', col: C.amber }, { row: 0, f1: 863, f2: 865, name: '', col: C.amber },
  { row: 0, f1: 1785, f2: 1805, name: '1 785–1 805', col: C.amber, up: true },
  { row: 1, f1: 694, f2: 790, name: '700', col: C.red }, { row: 1, f1: 791, f2: 862, name: '800', col: C.red, up: true }, { row: 1, f1: 1710, f2: 1880, name: '1 800', col: C.red }, { row: 1, f1: 1920, f2: 2170, name: '2 100', col: C.red, up: true }, { row: 1, f1: 2500, f2: 2690, name: '2 600', col: C.red }, { row: 1, f1: 3400, f2: 3800, name: '3,5 GHz (5G)', col: C.red, up: true },
  { row: 2, f1: 2200, f2: 2500, name: '« 2 GHz »', col: C.green }, { row: 2, f1: 5100, f2: 5900, name: '« 5 GHz »', col: C.green }, { row: 2, f1: 7000, f2: 7300, name: '≈ 7 GHz', col: C.green, up: true },
  { row: 3, f1: 1880, f2: 1900, name: 'DECT 1,9', col: C.cyan, up: true }, { row: 3, f1: 2400, f2: 2483.5, name: 'Wi-Fi 2,4', col: C.cyan }, { row: 3, f1: 5150, f2: 5350, name: 'Wi-Fi 5', col: C.cyan }, { row: 3, f1: 5470, f2: 5725, name: '', col: C.cyan }, { row: 3, f1: 5945, f2: 6425, name: 'Wi-Fi 6E', col: C.cyan, up: true },
];
const ROWS = ['Micros HF (PMSE audio) : UHF partagé avec la TNT, plus quelques fenêtres', 'Téléphonie mobile 4G / 5G : interdit aux micros depuis 2019 (700 MHz)', 'Caméras HF (PMSE vidéo) : COFDM 8 à 10 MHz, canaux attribués', 'Intercom sans fil (DECT) et Wi-Fi : bandes libres, sans coordination'];
function figSpectre() {
  const f = figure(720, 214, 'Le spectre de 0,4 à 7,6 GHz, échelle logarithmique : les micros HF en UHF 470–694 MHz partagés avec la TNT, les bandes de la téléphonie mobile qui les encadrent, les caméras HF vers 2 GHz, 5 GHz et 7 GHz, l\'intercom DECT à 1,9 GHz et le Wi-Fi à 2,4, 5 et 6 GHz');
  const RY = (r) => 24 + r * 42;
  ROWS.forEach((r, i) => { const y = RY(i); f.append(txt(24, y - 3, r, 'co-bit2', 'start')); f.append(sv('line', { x1: 24, y1: y + 18, x2: 704, y2: y + 18, stroke: C.line, strokeWidth: 1 })); });
  for (const b of BANDS) {
    const y = RY(b.row), x1 = fx(b.f1), x2 = Math.max(fx(b.f2), fx(b.f1) + 3);
    f.append(sv('rect', { x: x1, y: y + 2, width: x2 - x1, height: 16, fill: b.col, opacity: 0.8 }));
    if (!b.name) continue;
    if (x2 - x1 > 64) f.append(txt((x1 + x2) / 2, y + 14, b.name, 'co-bit'));
    else f.append(txt((x1 + x2) / 2, b.up ? y - 3 : y + 29, b.name, 'co-bit2'));
  }
  const yA = 196; f.append(sv('line', { x1: 24, y1: yA, x2: 704, y2: yA, stroke: C.grey, strokeWidth: 1 }));
  for (const [t, l] of [[500, '0,5'], [700, '0,7'], [1000, '1'], [1500, '1,5'], [2000, '2'], [3000, '3'], [5000, '5'], [7000, '7 GHz']]) { const x = fx(+t); f.append(sv('line', { x1: x, y1: yA, x2: x, y2: yA + 5, stroke: C.grey })); f.append(txt(x, yA + 16, String(l), 'co-m')); }
  f.append(txt(704, 10, 'ordres de grandeur, France (ANFR / Arcep) : les attributions exactes se vérifient à chaque événement', 'co-bit2', 'end'));
  return f;
}
const TV_OCC = [21, 23, 26, 29, 31, 34, 37, 40]; // canaux TNT occupés : exemple, à relever sur place
const tvCh = (f) => 21 + Math.floor((f - 470) / 8);
const im3 = (list) => { const out = []; for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) { out.push(2 * list[i] - list[j]); out.push(2 * list[j] - list[i]); } return out; };
function micPlanCheck(mics) {
  const bad = new Set(), why = [];
  mics.forEach((f, i) => { if (TV_OCC.includes(tvCh(f))) { bad.add(i); why.push(`micro ${i + 1} dans le canal TNT ${tvCh(f)} occupé`); } });
  for (let i = 0; i < mics.length; i++) for (let j = i + 1; j < mics.length; j++) if (Math.abs(mics[i] - mics[j]) < 0.4) { bad.add(i); bad.add(j); why.push(`micros ${i + 1} et ${j + 1} à moins de 400 kHz`); }
  const prods = im3(mics), hits = [];
  prods.forEach((p) => mics.forEach((f, k) => { if (Math.abs(p - f) < 0.3) { bad.add(k); hits.push(k); } }));
  if (hits.length) why.push(`${new Set(hits).size} micro(s) à moins de 300 kHz d'un produit d'intermodulation`);
  return { bad, why, prods };
}
function autoPlan(n, start) {
  const out = /** @type {number[]} */ ([]);
  for (let f = Math.max(470.2, Math.min(690, start)); f < 694 && out.length < n; f = +(f + 0.025).toFixed(3)) {
    if (TV_OCC.includes(tvCh(f)) || out.some((g) => Math.abs(g - f) < 0.4)) continue;
    const test = [...out, f]; if (im3(test).some((p) => test.some((g) => Math.abs(p - g) < 0.3))) continue;
    out.push(f);
  }
  return out;
}
function demoFreq(host) {
  let mics = [518.2, 519.6, 521.4, 523.9], camF = 2230, camBw = 10;
  const MW = 640, MH = 180, cv = canvas(MW, MH, 'co-canvas co-chart'), g = cv.getContext('2d');
  const CW = 640, CH = 80, cc = canvas(CW, CH, 'co-canvas co-chart'), gc = cc.getContext('2d');
  const read = readout(['Micros HF', 'Produits d\'ordre 3 (2f1 − f2, 2f2 − f1)', 'Caméra HF']);
  const verdict = el('p', { class: 'co-verdict' });
  const chans = buildChannels();
  let win = [510, 530];
  const fToX = (f) => (f - win[0]) / (win[1] - win[0]) * MW, xToF = (x) => win[0] + x / MW * (win[1] - win[0]);
  function drawMics() {
    const lo = Math.min(...mics), hi = Math.max(...mics), span = Math.max(14, hi - lo + 6), mid = (lo + hi) / 2;
    win = [Math.max(470, mid - span / 2), Math.min(694, mid + span / 2)];
    const R = micPlanCheck(mics);
    g.fillStyle = '#0b0e10'; g.fillRect(0, 0, MW, MH);
    // canaux TNT de 8 MHz
    for (let ch = tvCh(win[0]); ch <= tvCh(win[1]); ch++) {
      const f1 = 470 + (ch - 21) * 8, x1 = fToX(f1), x2 = fToX(f1 + 8), occ = TV_OCC.includes(ch);
      g.fillStyle = occ ? 'rgba(255,138,128,0.18)' : ch % 2 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.06)'; g.fillRect(x1, 0, x2 - x1, MH - 22);
      g.fillStyle = occ ? C.red : C.grey; g.font = '11px sans-serif'; g.textAlign = 'center'; g.fillText(`canal ${ch}${occ ? ' · TNT' : ''}`, (x1 + x2) / 2, 14);
    }
    // graduations
    g.strokeStyle = '#3a444c'; g.fillStyle = C.grey; g.font = '11px monospace'; g.textAlign = 'center';
    for (let f = Math.ceil(win[0]); f <= win[1]; f++) { const x = fToX(f); g.beginPath(); g.moveTo(x, MH - 22); g.lineTo(x, MH - 18); g.stroke(); if (f % 2 === 0) g.fillText(`${f}`, x, MH - 6); }
    // produits d'intermodulation
    for (const p of R.prods) { if (p < win[0] || p > win[1]) continue; const x = fToX(p); g.strokeStyle = C.red; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(x, 70); g.lineTo(x, MH - 42); g.stroke(); g.setLineDash([]); }
    // porteuses des micros (200 kHz de large)
    mics.forEach((f, i) => { const x = fToX(f), w = Math.max(3, 0.2 / (win[1] - win[0]) * MW); g.fillStyle = R.bad.has(i) ? C.red : C.amber; g.fillRect(x - w / 2, 40, w, MH - 82); g.font = 'bold 11px sans-serif'; g.fillText(`M${i + 1}`, x, 36); g.font = '10px monospace'; g.fillText(fmtNum(f, 3), x, MH - 30); });
    read.set('Micros HF', mics.map((f, i) => `M${i + 1} ${fmtNum(f, 3)} MHz`).join(' · '));
    const inWin = R.prods.filter((p) => p >= win[0] && p <= win[1]).length;
    read.set('Produits d\'ordre 3 (2f1 − f2, 2f2 − f1)', `${R.prods.length} pour ${mics.length} micros (${inWin} dans la fenêtre, en rouge pointillé) ; à tenir à plus de 300 kHz de chaque micro`);
    verdict.className = 'co-verdict ' + (R.why.length ? 'ko' : 'ok');
    verdict.textContent = R.why.length ? `Plan micros incompatible : ${R.why.slice(0, 3).join(' ; ')}${R.why.length > 3 ? '…' : ''}.` : `Plan micros compatible : ${mics.length} fréquences, aucun produit d'intermodulation sur un micro, aucun canal TNT occupé.`;
  }
  function drawCam() {
    gc.fillStyle = '#0b0e10'; gc.fillRect(0, 0, CW, CH);
    const f0 = 2025, f1 = 2495, x = (f) => (f - f0) / (f1 - f0) * CW;
    const col = { libre: '#243028', attrib: '#2a5a3a', occ: '#5a2a28', wifi: '#1f4650' };
    for (const ch of chans) { gc.fillStyle = col[ch.status] || col.libre; gc.fillRect(x(ch.f - 5) + 0.5, 18, x(ch.f + 5) - x(ch.f - 5) - 1, 30); }
    gc.fillStyle = C.grey; gc.font = '10px sans-serif'; gc.textAlign = 'center';
    gc.fillText('mobile 2,1 GHz, satellite', x(2155), 12); gc.fillText('Wi-Fi 2,4 GHz', x(2440), 12); gc.fillText('attribués · autre diffuseur', x(2290), 12);
    gc.font = '11px monospace'; for (let f = 2050; f <= 2450; f += 50) gc.fillText(String(f), x(f), CH - 6);
    const lo = camF - camBw / 2, hi = camF + camBw / 2;
    gc.strokeStyle = C.amber; gc.lineWidth = 2; gc.strokeRect(x(lo), 16, x(hi) - x(lo), 34);
    gc.fillStyle = C.amber; gc.fillText(`${camF} MHz`, x(camF), 62);
    const overlap = chans.filter((ch) => Math.abs(ch.f - camF) < camBw / 2 + 4);
    const bad = overlap.find((ch) => ch.status === 'occ' || ch.status === 'wifi'), own = overlap.find((ch) => ch.f === camF);
    read.set('Caméra HF', `${camF} MHz, ${camBw} MHz de large : ${bad ? `conflit, ${bad.user.toLowerCase()}` : own && own.status === 'attrib' ? 'canal attribué à la production par la coordination' : 'canal libre, mais pas attribué : à demander avant de s\'en servir'}`);
  }
  // glisser un micro
  let drag = -1;
  cv.addEventListener('pointerdown', (ev) => { const r = cv.getBoundingClientRect(); const x = (ev.clientX - r.left) / r.width * MW; let best = -1, bd = 12; mics.forEach((f, i) => { const d = Math.abs(fToX(f) - x); if (d < bd) { bd = d; best = i; } }); drag = best; if (drag >= 0) cv.setPointerCapture(ev.pointerId); });
  cv.addEventListener('pointermove', (ev) => { if (drag < 0) return; const r = cv.getBoundingClientRect(); const f = Math.round(xToF((ev.clientX - r.left) / r.width * MW) * 40) / 40; mics[drag] = Math.min(694, Math.max(470, f)); drawMics(); });
  cv.addEventListener('pointerup', () => { drag = -1; }); cv.addEventListener('pointercancel', () => { drag = -1; });
  cv.title = 'Glissez un micro pour changer sa fréquence'; cv.style.cursor = 'ew-resize';
  host.append(
    el('div', { class: 'co-ctl' },
      slider('Micros HF', 2, 8, mics.length, 1, (v) => { while (mics.length < v) mics.push(Math.min(693, Math.max(...mics) + 1.6)); mics = mics.slice(0, v); drawMics(); }),
      el('button', { class: 'btn small', onclick: () => { mics = autoPlan(mics.length, Math.min(...mics)); drawMics(); } }, 'Plan automatique (sans intermodulation)'),
      el('button', { class: 'btn small', onclick: () => { const f = Math.min(...mics); mics = mics.map((_, i) => f + i * 0.5); drawMics(); } }, 'Espacer de 500 kHz (plan naïf)')),
    el('figure', { class: 'co-figc' }, cv, el('figcaption', {}, 'Micros HF en UHF : glissez un micro. Rouge pointillé : produits d\'intermodulation d\'ordre 3 ; canaux rouges : multiplex TNT occupés (exemple)')),
    el('div', { class: 'co-ctl' }, slider('Caméra HF', 2030, 2490, camF, 10, (v) => { camF = v; drawCam(); }, (v) => `${v} MHz`), choice('Largeur', [['8', '8 MHz'], ['10', '10 MHz']], '10', (v) => { camBw = +v; drawCam(); })),
    el('figure', { class: 'co-figc' }, cc, el('figcaption', {}, 'Bande 2 GHz des caméras HF, plan de fréquences du simulateur : vert attribué, rouge occupé, bleu Wi-Fi')),
    read.el, verdict);
  drawMics(); drawCam();
}

// ======================================================================================
// 2. Le bilan de liaison
// ======================================================================================
const RXANT = { omni: ['Omni (fouet)', 2], patch: ['Patch', 9], logper: ['Log-périodique', 10], panneau: ['Panneau secteur', 13] };
const OBST = { los: ['Ligne de vue', 0], tribune: ['Derrière une tribune (béton)', 16], tunnel: ['Tunnel des vestiaires', 40] };
function figBilan() {
  const f = figure(720, 190, 'L\'échelle des dBm : 1 W = 30 dBm, 100 mW = 20 dBm, 1 mW = 0 dBm, 1 µW = −30 dBm, 1 nW = −60 dBm, 1 pW = −90 dBm ; une liaison HF part de 20 dBm et arrive vers −60 à −90 dBm. Chaque −3 dB divise la puissance par deux, chaque −10 dB par dix');
  f.append(txt(360, 14, 'Les dBm : la puissance en décibels par rapport à 1 mW', 'co-t'));
  const y0 = 54, x0 = 80, x1 = 690, dBtoX = (d) => x0 + (d + 100) / 130 * (x1 - x0);
  f.append(sv('line', { x1: x0, y1: y0, x2: x1, y2: y0, stroke: C.grey, strokeWidth: 1.5 }));
  /** @type {[number, string, string, number][]} */
  const marks = [[30, '1 W', 'caméra au maximum', 1], [20, '100 mW', 'caméra HF usuelle', 0], [10, '10 mW', 'micro HF', 1], [0, '1 mW', 'référence', 0], [-30, '1 µW', '', 0], [-60, '1 nW', 'bon niveau reçu', 0], [-87, '2 pW', 'sensibilité 16-QAM', 0], [-100, '0,1 pW', 'plancher de bruit (8 MHz)', 1]];
  marks.forEach(([d, p, l, row]) => { const x = dBtoX(d); f.append(sv('line', { x1: x, y1: y0 - 6, x2: x, y2: y0 + 6, stroke: C.amber, strokeWidth: 1.5 })); f.append(txt(x, y0 - 12, `${d} dBm`, 'co-m')); f.append(txt(x, y0 + 22, p, 'co-s')); if (l) f.append(txt(x, y0 + 36 + row * 12, l, 'co-bit2')); });
  f.append(txt(360, 126, 'Affaiblissement en espace libre : FSPL (dB) = 20 log d (m) + 20 log f (MHz) − 27,55', 'co-m'));
  f.append(txt(360, 146, 'à 2 200 MHz : 10 m → 59 dB · 100 m → 79 dB · 1 km → 99 dB. Distance × 2 : −6 dB. Fréquence × 2 : −6 dB. Puissance × 2 : +3 dB.', 'co-s'));
  f.append(txt(360, 170, 'niveau reçu = puissance émise + gain antenne émission + gain antenne réception − FSPL − obstacles − câbles ; marge = niveau reçu − sensibilité', 'co-s'));
  return f;
}
function demoBilan(host) {
  let ptx = 20, gtx = 2, rx = 'panneau', d = 80, f = 2200, ob = 'los', cable = 2, sensib = -87;
  const W = 640, H = 230, cv = canvas(W, H, 'co-canvas co-chart'), g = cv.getContext('2d');
  const read = readout(['Affaiblissement en espace libre', 'Niveau reçu', 'Sensibilité du récepteur', 'Marge']);
  const verdict = el('p', { class: 'co-verdict' });
  const sensSl = slider('Sensibilité du récepteur', -100, -70, sensib, 1, (v) => { sensib = v; draw(); }, (v) => `${v} dBm`);
  function draw() {
    const L = fspl(d, f), grx = RXANT[rx][1], obs = OBST[ob][1];
    const steps = [['Émetteur', ptx], ['Ant. émission', gtx], ['Ant. réception', grx], ['Espace libre', -L], ['Obstacles', -obs], ['Câbles', -cable]];
    const prx = steps.reduce((a, s) => a + s[1], 0), marge = prx - sensib;
    // cascade : chaque barre part du niveau précédent
    g.fillStyle = '#0b0e10'; g.fillRect(0, 0, W, H);
    const top = 40, bot = -115, yOf = (v) => 14 + (top - v) / (top - bot) * (H - 40);
    g.strokeStyle = '#2a3238'; g.fillStyle = C.grey; g.font = '10px monospace'; g.textAlign = 'right';
    for (let v = 40; v >= -110; v -= 30) { g.beginPath(); g.moveTo(44, yOf(v)); g.lineTo(W - 8, yOf(v)); g.stroke(); g.fillText(`${v}`, 40, yOf(v) + 3); }
    let level = 0; const bw = 68, x0 = 56;
    steps.forEach(([name, v], i) => {
      const x = x0 + i * 84, from = level, to = level + /** @type {number} */ (v); level = to;
      const y1 = yOf(Math.max(from, to)), y2 = yOf(Math.min(from, to));
      g.fillStyle = /** @type {number} */ (v) >= 0 ? C.green : C.red; g.fillRect(x, y1, bw, Math.max(1, y2 - y1));
      g.fillStyle = C.grey; g.font = '10px sans-serif'; g.textAlign = 'center'; g.fillText(String(name), x + bw / 2, H - 14);
      g.fillStyle = '#fff'; g.font = '11px monospace'; g.fillText(`${dB1(/** @type {number} */ (v))} dB`, x + bw / 2, (/** @type {number} */ (v) >= 0 ? y1 : y2) + (/** @type {number} */ (v) >= 0 ? -4 : 12));
      if (i < steps.length - 1) { g.strokeStyle = '#5a646c'; g.setLineDash([2, 2]); g.beginPath(); g.moveTo(x + bw, yOf(to)); g.lineTo(x + 84, yOf(to)); g.stroke(); g.setLineDash([]); }
    });
    const xr = x0 + steps.length * 84;
    g.fillStyle = marge >= 10 ? C.green : marge >= 3 ? C.amber : C.red; g.fillRect(xr, yOf(prx) - 2, bw, 4);
    g.fillStyle = '#fff'; g.font = 'bold 11px monospace'; g.textAlign = 'center'; g.fillText(`${fmtNum(prx, 1)} dBm`, xr + bw / 2, yOf(prx) - 6);
    g.fillStyle = C.grey; g.font = '10px sans-serif'; g.fillText('Niveau reçu', xr + bw / 2, H - 14);
    g.strokeStyle = C.red; g.setLineDash([4, 3]); g.beginPath(); g.moveTo(44, yOf(sensib)); g.lineTo(W - 8, yOf(sensib)); g.stroke(); g.setLineDash([]);
    g.fillStyle = C.red; g.font = '10px monospace'; g.textAlign = 'left'; g.fillText(`sensibilité ${sensib} dBm`, 48, yOf(sensib) + 12);
    g.strokeStyle = C.amber; g.beginPath(); g.moveTo(xr + bw + 4, yOf(prx)); g.lineTo(xr + bw + 4, yOf(sensib)); g.stroke();
    g.fillStyle = C.amber; g.textAlign = 'center'; g.font = 'bold 11px monospace'; g.fillText(`marge ${dB1(marge)} dB`, xr + bw / 2, Math.abs(yOf(prx) - yOf(sensib)) > 24 ? (yOf(prx) + yOf(sensib)) / 2 + 4 : Math.max(yOf(prx), yOf(sensib)) + 24);
    read.set('Affaiblissement en espace libre', `${fmtNum(L, 1)} dB à ${d} m et ${f} MHz (20 log ${d} + 20 log ${f} − 27,55)`);
    read.set('Niveau reçu', `${fmtNum(prx, 1)} dBm (${sens(prx)}) = ${ptx} + ${gtx} + ${grx} − ${fmtNum(L, 1)} − ${obs} − ${cable}`);
    read.set('Sensibilité du récepteur', `${sensib} dBm : plancher de bruit ${fmtNum(NOISE_8MHZ, 0)} dBm + C/N requis ${fmtNum(sensib - NOISE_8MHZ, 1)} dB`);
    read.set('Marge', `${fmtNum(marge, 1)} dB`);
    verdict.className = 'co-verdict ' + (marge >= 10 ? 'ok' : marge >= 3 ? 'warn' : 'ko');
    verdict.textContent = marge >= 10 ? `Marge ${fmtNum(marge, 1)} dB : confortable. Les évanouissements de quelques dB passeront inaperçus.` : marge >= 3 ? `Marge ${fmtNum(marge, 1)} dB : juste. Un corps devant l'émetteur (−4 dB) ou un évanouissement et l'image se dégrade.` : marge >= 0 ? `Marge ${fmtNum(marge, 1)} dB : instable, macro-blocs puis image figée au moindre creux (effet falaise).` : `Marge ${fmtNum(marge, 1)} dB : liaison perdue, le niveau reçu est sous la sensibilité.`;
  }
  host.append(
    el('div', { class: 'co-ctl' },
      slider('Puissance émise', 0, 30, ptx, 1, (v) => { ptx = v; draw(); }, (v) => `${v} dBm (${mW(v)})`),
      slider('Antenne émission', 0, 6, gtx, 1, (v) => { gtx = v; draw(); }, (v) => `${v} dBi`),
      choice('Antenne réception', Object.keys(RXANT).map((k) => [k, `${RXANT[k][0]} ${RXANT[k][1]} dBi`]), rx, (v) => { rx = v; draw(); })),
    el('div', { class: 'co-ctl' },
      slider('Distance', 5, 1000, d, 5, (v) => { d = v; draw(); }, (v) => `${v} m`),
      choice('Fréquence', [['600', '600 MHz (micro)'], ['2200', '2,2 GHz (caméra)'], ['5800', '5,8 GHz']], '2200', (v) => { f = +v; draw(); }),
      choice('Trajet', Object.keys(OBST).map((k) => [k, `${OBST[k][0]} (${OBST[k][1]} dB)`]), ob, (v) => { ob = v; draw(); })),
    el('div', { class: 'co-ctl' },
      slider('Câbles et connecteurs', 0, 10, cable, 1, (v) => { cable = v; draw(); }, (v) => `${v} dB`),
      sensSl,
      choice('Modulation (règle la sensibilité)', [['QPSK', 'QPSK 1/2'], ['16QAM', '16-QAM 3/4'], ['64QAM', '64-QAM 3/4']], '16QAM', (v) => { const req = CN_REQ[v][v === 'QPSK' ? '1/2' : '3/4'] + IMPL; sensib = Math.round(NOISE_8MHZ + req); const inp = sensSl.querySelector('input'), out = sensSl.querySelector('output'); if (inp) inp.value = String(sensib); if (out) out.textContent = `${sensib} dBm`; draw(); })),
    el('figure', { class: 'co-figc' }, cv, el('figcaption', {}, 'Le bilan en cascade : ce que chaque étage ajoute (vert) ou retire (rouge), jusqu\'au niveau reçu, comparé à la sensibilité')),
    read.el, verdict);
  draw();
}

// ======================================================================================
// 3. Antennes, diversité, polarisation
// ======================================================================================
/** gain (dBi) d'une antenne selon l'angle (degrés) à son axe : modèle parabolique en dB, comme rf.js */
const ANT = { omni: { name: 'Omni', gain: 2, hp: 180 }, patch: { name: 'Patch', gain: 9, hp: 33 }, logper: { name: 'Log-périodique', gain: 10, hp: 27 }, panneau: { name: 'Panneau secteur', gain: 13, hp: 20 } };
const antGain = (k, ang) => k === 'omni' ? ANT.omni.gain : ANT[k].gain - Math.min(28, 3 * (ang / ANT[k].hp) ** 2);
function figAntennes() {
  const f = figure(720, 218, 'Diagrammes de rayonnement : l\'antenne omnidirectionnelle (2 dBi) rayonne pareil dans toutes les directions ; le patch (9 dBi) et le panneau secteur (13 dBi) concentrent la puissance dans un faisceau : plus de gain dans l\'axe, presque rien derrière');
  ['omni', 'patch', 'panneau'].forEach((k, i) => {
    const cx = 120 + i * 240, cy = 100, R = 60, a = ANT[k];
    for (const r of [1 / 3, 2 / 3, 1]) f.append(sv('circle', { cx, cy, r: R * r, fill: 'none', stroke: C.line, strokeWidth: 1 }));
    let dPath = '';
    for (let ang = -180; ang <= 180; ang += 3) { const gd = antGain(k, Math.abs(ang)); const r = Math.max(0, (gd + 20) / 35) * R; const x = cx + r * Math.sin(ang * Math.PI / 180), y = cy - r * Math.cos(ang * Math.PI / 180); dPath += (ang === -180 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1); }
    f.append(sv('path', { d: dPath + 'Z', fill: 'rgba(255,211,138,0.18)', stroke: C.amber, strokeWidth: 1.5 }));
    f.append(sv('line', { x1: cx, y1: cy, x2: cx, y2: cy - R - 8, stroke: C.grey, strokeDasharray: '2 3' }));
    f.append(txt(cx, 22, `${a.name} · ${a.gain} dBi`, 'co-t'), txt(cx, cy + R + 20, k === 'omni' ? 'même gain partout, faible' : `−3 dB à ± ${a.hp}°, ${k === 'patch' ? 'large' : 'étroit'}`, 'co-s'));
    f.append(txt(cx, cy + R + 34, k === 'omni' ? 'tunnel, compound, proche' : k === 'patch' ? 'bord de terrain, mobile' : 'toit de tribune, loin', 'co-bit2'));
  });
  f.append(txt(360, 212, 'cercles : −20, −8, +5 dBi · l\'axe (pointillé) est la direction visée', 'co-bit2'));
  return f;
}
function demoAnt(host) {
  // terrain : x le long de la longueur (−52,5 à 52,5 m), y la largeur (−34 à 34), tribune principale derrière y = −34
  const ANTS = [{ id: 'A', x: -40, y: -46, h: 12, col: C.amber }, { id: 'B', x: 40, y: -46, h: 12, col: C.cyan }];
  let type = 'patch', cam = { x: 0, y: 30 }, aimA = 0, aimB = 0, running = false, timer = 0, dir = 1;
  const PTX = 20, GTX = 2, F = 2200, LAMBDA = 300 / F, HC = 1.5, SENS = -87, CABLE = 2;
  const W = 640, H = 330, SC = 3, OX = W / 2, OY = H / 2 + 6; // mètres → pixels, origine au centre du terrain
  const px = (x) => OX + x * SC, py = (y) => OY + y * SC;
  const cv = canvas(W, H, 'co-canvas co-chart'), g = cv.getContext('2d');
  const CW = 640, CH = 130, ch = canvas(CW, CH, 'co-canvas co-chart'), gh = ch.getContext('2d');
  const hist = /** @type {number[][]} */ ([]);
  const read = readout(['Antenne A', 'Antenne B', 'Diversité : la meilleure', 'Marge (sensibilité −87 dBm)']);
  const aimOf = (a) => { const base = Math.atan2(0 - a.x, 0 - a.y) * 180 / Math.PI; return base + (a.id === 'A' ? aimA : aimB); }; // 0 = vers le centre du terrain
  /** niveau reçu (dBm) : bilan + deux réflexions (sol et tribune d'en face) qui s'ajoutent en phase ou en opposition */
  function level(a) {
    const dx = cam.x - a.x, dy = cam.y - a.y, dh = Math.hypot(dx, dy), d = Math.hypot(dh, a.h - HC);
    const ang = Math.abs((((Math.atan2(dx, dy) * 180 / Math.PI - aimOf(a)) % 360) + 540) % 360 - 180);
    const direct = PTX + GTX + antGain(type, ang) - fspl(d, F) - CABLE;
    // rayon réfléchi par le sol : différence de marche par l'image de la caméra sous le sol
    const r1 = Math.hypot(dh, a.h + HC) - d, g1 = 0.6;
    // rayon réfléchi par la tribune d'en face (y = +44) : image de la caméra derrière elle
    const yi = 2 * 44 - cam.y, dh2 = Math.hypot(dx, yi - a.y), r2 = Math.hypot(dh2, a.h - HC) - d, g2 = 0.5 * Math.min(1, d / dh2);
    const re = 1 + g1 * Math.cos(2 * Math.PI * r1 / LAMBDA + Math.PI) + g2 * Math.cos(2 * Math.PI * r2 / LAMBDA + Math.PI);
    const im = g1 * Math.sin(2 * Math.PI * r1 / LAMBDA + Math.PI) + g2 * Math.sin(2 * Math.PI * r2 / LAMBDA + Math.PI);
    const fade = 20 * Math.log10(Math.max(0.02, Math.hypot(re, im)));
    return { lvl: direct + fade, direct, fade, d, ang };
  }
  const colOf = (m) => m >= 10 ? C.green : m >= 3 ? C.amber : C.red;
  function draw() {
    const L = ANTS.map(level), best = Math.max(L[0].lvl, L[1].lvl);
    hist.push([L[0].lvl, L[1].lvl, best]); if (hist.length > 160) hist.shift();
    g.fillStyle = '#0b0e10'; g.fillRect(0, 0, W, H);
    // tribunes et terrain
    g.fillStyle = '#1a2026'; g.fillRect(px(-70), py(-54), 140 * SC, 16 * SC); g.fillRect(px(-70), py(38), 140 * SC, 16 * SC);
    g.fillStyle = C.grey; g.font = '10px sans-serif'; g.textAlign = 'center'; g.fillText('tribune principale (antennes sur le toit, 12 m)', OX, py(-50)); g.fillText('tribune d\'en face (réfléchit le signal)', OX, py(50));
    g.fillStyle = '#17331f'; g.fillRect(px(-52.5), py(-34), 105 * SC, 68 * SC); g.strokeStyle = '#3f7a4c'; g.lineWidth = 1; g.strokeRect(px(-52.5), py(-34), 105 * SC, 68 * SC); g.beginPath(); g.moveTo(px(0), py(-34)); g.lineTo(px(0), py(34)); g.stroke(); g.beginPath(); g.arc(px(0), py(0), 9.15 * SC, 0, Math.PI * 2); g.stroke();
    // antennes, faisceaux, rayons
    ANTS.forEach((a, i) => {
      const ax = px(a.x), ay = py(a.y), aim = aimOf(a) * Math.PI / 180, hp = ANT[type].hp * Math.PI / 180;
      if (type !== 'omni') { g.fillStyle = a.col === C.amber ? 'rgba(255,211,138,0.10)' : 'rgba(127,211,243,0.10)'; g.beginPath(); g.moveTo(ax, ay); g.lineTo(ax + 140 * SC * Math.sin(aim - hp), ay + 140 * SC * Math.cos(aim - hp)); g.lineTo(ax + 140 * SC * Math.sin(aim + hp), ay + 140 * SC * Math.cos(aim + hp)); g.closePath(); g.fill(); }
      g.strokeStyle = a.col; g.lineWidth = 1; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(ax, ay); g.lineTo(ax + 30 * SC * Math.sin(aim), ay + 30 * SC * Math.cos(aim)); g.stroke(); g.setLineDash([]);
      const m = L[i].lvl - SENS; g.strokeStyle = colOf(m); g.lineWidth = 2; g.beginPath(); g.moveTo(ax, ay); g.lineTo(px(cam.x), py(cam.y)); g.stroke();
      g.fillStyle = a.col; g.beginPath(); g.arc(ax, ay, 6, 0, Math.PI * 2); g.fill(); g.font = 'bold 11px sans-serif'; g.fillText(`Antenne ${a.id}`, ax, ay - 10);
      g.fillStyle = colOf(m); g.font = '11px monospace'; g.fillText(`${fmtNum(L[i].lvl, 0)} dBm`, ax, ay + 18);
    });
    g.fillStyle = '#fff'; g.beginPath(); g.arc(px(cam.x), py(cam.y), 6, 0, Math.PI * 2); g.fill(); g.font = '10px sans-serif'; g.fillText('caméra HF (glissez)', px(cam.x), py(cam.y) + 16);
    // historique
    gh.fillStyle = '#0b0e10'; gh.fillRect(0, 0, CW, CH);
    const y = (v) => 8 + (-40 - v) / 70 * (CH - 16);
    gh.strokeStyle = '#2a3238'; gh.fillStyle = C.grey; gh.font = '10px monospace'; gh.textAlign = 'left';
    for (const v of [-50, -70, -90, -110]) { gh.beginPath(); gh.moveTo(0, y(v)); gh.lineTo(CW, y(v)); gh.stroke(); gh.fillText(`${v} dBm`, 2, y(v) - 2); }
    gh.strokeStyle = C.red; gh.setLineDash([4, 3]); gh.beginPath(); gh.moveTo(0, y(SENS)); gh.lineTo(CW, y(SENS)); gh.stroke(); gh.setLineDash([]);
    const trace = (k, colr, w) => { gh.strokeStyle = colr; gh.lineWidth = w; gh.beginPath(); hist.forEach((h, i) => { const x = CW - (hist.length - 1 - i) * (CW / 160); i ? gh.lineTo(x, y(h[k])) : gh.moveTo(x, y(h[k])); }); gh.stroke(); };
    trace(0, C.amber, 1); trace(1, C.cyan, 1); trace(2, '#fff', 2);
    gh.fillStyle = C.amber; gh.fillText('■ A', 300, CH - 4); gh.fillStyle = C.cyan; gh.fillText('■ B', 340, CH - 4); gh.fillStyle = '#fff'; gh.fillText('■ diversité (la meilleure des deux)', 380, CH - 4);
    const fmtA = (l) => `${fmtNum(l.lvl, 1)} dBm à ${fmtNum(l.d, 0)} m, ${fmtNum(l.ang, 0)}° de l'axe (gain ${fmtNum(antGain(type, l.ang), 1)} dBi) · multi-trajet ${dB1(l.fade)} dB`;
    read.set('Antenne A', fmtA(L[0])); read.set('Antenne B', fmtA(L[1]));
    read.set('Diversité : la meilleure', `${fmtNum(best, 1)} dBm (antenne ${L[0].lvl >= L[1].lvl ? 'A' : 'B'})`);
    read.set('Marge (sensibilité −87 dBm)', `A : ${dB1(L[0].lvl - SENS)} dB · B : ${dB1(L[1].lvl - SENS)} dB · diversité : ${dB1(best - SENS)} dB`);
  }
  const pick = (ev) => { const r = cv.getBoundingClientRect(); cam.x = Math.max(-58, Math.min(58, (((ev.clientX - r.left) / r.width * W) - OX) / SC)); cam.y = Math.max(-38, Math.min(42, (((ev.clientY - r.top) / r.height * H) - OY) / SC)); draw(); };
  cv.addEventListener('pointerdown', pick); cv.addEventListener('pointermove', (ev) => { if (ev.buttons) pick(ev); });
  cv.style.cursor = 'crosshair';
  const step = () => { cam.x += 0.8 * dir; if (cam.x > 52) dir = -1; if (cam.x < -52) dir = 1; draw(); };
  const runBtn = el('button', { class: 'btn small', onclick: () => { running = !running; runBtn.textContent = running ? 'Arrêter la caméra' : 'La caméra court le long de la touche'; if (running) timer = setInterval(step, 80); else clearInterval(timer); } }, 'La caméra court le long de la touche');
  host.append(
    el('div', { class: 'co-ctl' },
      choice('Antennes de réception', Object.keys(ANT).map((k) => [k, `${ANT[k].name} ${ANT[k].gain} dBi`]), type, (v) => { type = v; draw(); }),
      slider('Orientation A', -90, 90, aimA, 5, (v) => { aimA = v; draw(); }, (v) => `${v > 0 ? '+' : ''}${v}°`),
      slider('Orientation B', -90, 90, aimB, 5, (v) => { aimB = v; draw(); }, (v) => `${v > 0 ? '+' : ''}${v}°`), runBtn),
    el('figure', { class: 'co-figc' }, cv, el('figcaption', {}, 'Vue de dessus : émetteur 100 mW à 2,2 GHz au dos de la caméra, deux antennes sur le toit de la tribune. Couleur du rayon : marge verte ≥ 10 dB, ambre ≥ 3 dB, rouge en dessous')),
    el('figure', { class: 'co-figc' }, ch, el('figcaption', {}, 'Niveau reçu pendant le déplacement : les creux (évanouissements) ne tombent pas au même endroit sur A et sur B ; la diversité garde la meilleure')),
    read.el);
  draw();
  return { destroy: () => clearInterval(timer) };
}

// ======================================================================================
// 4. COFDM
// ======================================================================================
const MODES = { mono: { name: 'Mono-porteuse 8 MHz', tu: 0.125, carriers: 1 }, '2k': { name: 'COFDM 2K', tu: 224, carriers: 1705 }, '8k': { name: 'COFDM 8K', tu: 896, carriers: 6817 } };
function figCofdm() {
  const f = figure(720, 180, 'Un symbole COFDM dure longtemps (224 µs en 2K) et commence par un intervalle de garde, copie de sa fin. L\'écho, retardé, arrive encore pendant l\'intervalle de garde : le récepteur l\'ignore et lit le symbole utile intact. En mono-porteuse, le symbole dure 0,125 µs et l\'écho en recouvre des dizaines');
  f.append(txt(360, 14, 'L\'intervalle de garde absorbe l\'écho', 'co-t'));
  const x0 = 40, sc = 1.8, GI = 56, TU = 224, y1 = 40, y2 = 90;
  const sym = (x, y, label, dim) => { f.append(sv('rect', { x, y, width: GI * sc, height: 26, fill: dim ? '#3a3a20' : '#5a4a1a', stroke: C.amber, strokeWidth: 1 })); f.append(sv('rect', { x: x + GI * sc, y, width: TU * sc, height: 26, fill: dim ? '#1c2a3a' : '#1f4650', stroke: C.cyan, strokeWidth: 1 })); f.append(txt(x + GI * sc / 2, y + 17, 'garde', 'co-bit')); f.append(txt(x + GI * sc + TU * sc / 2, y + 17, label, 'co-s')); };
  f.append(txt(x0 - 6, y1 + 17, 'direct', 'co-s', 'end'), txt(x0 - 6, y2 + 17, 'écho', 'co-s', 'end'));
  sym(x0, y1, 'symbole n (224 µs utile)', false); sym(x0 + (GI + TU) * sc, y1, 'symbole n + 1', false);
  const tau = 40 * sc; sym(x0 + tau, y2, 'symbole n, retardé de 40 µs', true); sym(x0 + tau + (GI + TU) * sc, y2, 'symbole n + 1', true);
  f.append(sv('rect', { x: x0 + GI * sc, y: y1 - 6, width: TU * sc, height: y2 + 38 - y1, fill: 'none', stroke: C.green, strokeWidth: 1.5, strokeDasharray: '5 3' }));
  f.append(txt(x0 + GI * sc + TU * sc / 2, y2 + 46, 'fenêtre lue par le récepteur : l\'écho qui s\'y trouve est encore le symbole n, pas le précédent', 'co-s'));
  f.append(txt(360, 166, 'intervalle de garde 1/4 : 56 µs en 2K (écho jusqu\'à 17 km), 224 µs en 8K · 1/32 : 7 µs (2 km) mais plus de débit', 'co-m'));
  return f;
}
function demoCofdm(host) {
  let mode = '2k', gi = '1/4', tau = 30, mod = '16QAM', fec = '3/4';
  const W = 640, H = 170, cv = canvas(W, H, 'co-canvas co-chart'), g = cv.getContext('2d');
  const BW = 640, BH = 90, bars = canvas(BW, BH, 'co-canvas co-chart'), gb = bars.getContext('2d');
  const read = readout(['Symbole', 'Intervalle de garde', 'Écho', 'Débit utile et robustesse', 'Latence']);
  const verdict = el('p', { class: 'co-verdict' });
  function draw() {
    const M = MODES[mode], tu = M.tu, giT = mode === 'mono' ? 0 : tu * GUARDS[gi], ts = tu + giT;
    const span = mode === 'mono' ? Math.max(2, tau * 1.3) : ts * 2.3, sc = W / span, y1 = 30, y2 = 90;
    g.fillStyle = '#0b0e10'; g.fillRect(0, 0, W, H);
    g.fillStyle = C.grey; g.font = '10px monospace'; g.textAlign = 'center';
    const tick = span >= 500 ? 100 : span >= 200 ? 50 : span >= 50 ? 10 : span >= 5 ? 1 : 0.25;
    for (let t = 0; t <= span; t += tick) { g.fillText(`${fmtNum(t, tick < 1 ? 2 : 0)} µs`, t * sc, H - 6); g.fillStyle = '#2a3238'; g.fillRect(t * sc, H - 18, 1, 4); g.fillStyle = C.grey; }
    const symbols = (y, off, dim, label) => {
      for (let k = 0; k * ts + off < span; k++) {
        const x = (k * ts + off) * sc;
        if (giT) { g.fillStyle = dim ? '#3a3a20' : '#5a4a1a'; g.fillRect(x, y, giT * sc, 30); g.strokeStyle = C.amber; g.strokeRect(x + 0.5, y + 0.5, giT * sc, 30); }
        g.fillStyle = dim ? '#1c2a3a' : '#1f4650'; g.fillRect(x + giT * sc, y, tu * sc, 30); g.strokeStyle = C.cyan; g.strokeRect(x + giT * sc + 0.5, y + 0.5, tu * sc, 30);
        if (tu * sc > 40) { g.fillStyle = '#fff'; g.font = '11px sans-serif'; g.fillText(`${label} ${k + 1}`, x + giT * sc + tu * sc / 2, y + 19); }
      }
    };
    symbols(y1, 0, false, 'symbole'); symbols(y2, tau, true, 'écho');
    g.fillStyle = C.grey; g.font = '11px sans-serif'; g.textAlign = 'left'; g.fillText('direct', 4, y1 - 6); g.fillText(`écho retardé de ${fmtNum(tau, 0)} µs (${fmtNum(tau * 0.3, 1)} km de plus)`, 4, y2 - 6);
    const ok = mode === 'mono' ? tau <= tu * 0.1 : tau <= giT;
    if (mode !== 'mono') { g.strokeStyle = ok ? C.green : C.red; g.lineWidth = 1.5; g.setLineDash([5, 3]); g.strokeRect(giT * sc, y1 - 4, tu * sc, y2 + 38 - y1); g.setLineDash([]); g.lineWidth = 1; }
    read.set('Symbole', `${M.name} : ${M.carriers > 1 ? `${fmtNum(M.carriers)} porteuses, ` : ''}symbole utile de ${fmtNum(tu, tu < 1 ? 3 : 0)} µs`);
    read.set('Intervalle de garde', mode === 'mono' ? 'aucun' : `${gi} du symbole = ${fmtNum(giT, 0)} µs : un écho jusqu'à ${fmtNum(giT * 0.3, 1)} km de détour est absorbé`);
    read.set('Écho', mode === 'mono' ? `${fmtNum(tau, 0)} µs = ${fmtNum(tau / tu, 0)} symboles de retard : l'écho recouvre les symboles suivants` : `${fmtNum(tau, 0)} µs, ${ok ? 'dans' : 'au-delà de'} l'intervalle de garde`);
    const rate = cofdmBitrate(mod, fec, mode === 'mono' ? '1/32' : gi, 8), req = CN_REQ[mod][fec] + IMPL;
    read.set('Débit utile et robustesse', `${mod} ${fec}, garde ${mode === 'mono' ? '—' : gi} : ${fmtNum(rate, 1)} Mb/s en 8 MHz, C/N requis ${fmtNum(req, 1)} dB`);
    read.set('Latence', 'de l\'ordre de 1 à 3 images (20 à 60 ms) de la caméra au car, codage H.264 / HEVC compris : le retard de ligne du son s\'y cale');
    verdict.className = 'co-verdict ' + (ok ? 'ok' : 'ko');
    verdict.textContent = ok ? (mode === 'mono' ? 'Décodé : l\'écho est plus court qu\'un dixième de symbole.' : 'Décodé : l\'écho tombe dans l\'intervalle de garde, le récepteur lit le symbole utile intact.') : (mode === 'mono' ? `Pas décodé : l'écho étale chaque symbole sur ${fmtNum(tau / tu, 0)} autres (interférence entre symboles), sans un égaliseur très complexe c'est illisible.` : 'Pas décodé : l\'écho déborde de l\'intervalle de garde et recouvre le symbole suivant.');
    // barres débit et C/N
    gb.fillStyle = '#0b0e10'; gb.fillRect(0, 0, BW, BH);
    const bar = (y, label, v, max, unit, colr) => { gb.fillStyle = '#2a3238'; gb.fillRect(120, y, 480, 16); gb.fillStyle = colr; gb.fillRect(120, y, 480 * Math.min(1, v / max), 16); gb.fillStyle = C.grey; gb.font = '11px sans-serif'; gb.textAlign = 'right'; gb.fillText(label, 112, y + 12); gb.fillStyle = '#fff'; gb.font = '11px monospace'; gb.textAlign = 'left'; gb.fillText(`${fmtNum(v, 1)} ${unit}`, 126 + 480 * Math.min(1, v / max), y + 12); };
    bar(14, 'Débit utile', rate, 32, 'Mb/s', C.cyan); bar(50, 'C/N requis', req, 25, 'dB', req > 15 ? C.red : req > 9 ? C.amber : C.green);
    gb.fillStyle = C.grey; gb.font = '10px sans-serif'; gb.textAlign = 'left'; gb.fillText('plus de débit = belle image, mais il faut plus de signal : chaque pas de modulation coûte environ 6 dB', 120, 82);
  }
  host.append(
    el('div', { class: 'co-ctl' },
      choice('Transmission', Object.keys(MODES).map((k) => [k, MODES[k].name]), mode, (v) => { mode = v; draw(); }),
      choice('Intervalle de garde', Object.keys(GUARDS).map((k) => [k, k]), gi, (v) => { gi = v; draw(); }),
      slider('Retard de l\'écho', 0, 250, tau, 1, (v) => { tau = v; draw(); }, (v) => `${v} µs`)),
    el('figure', { class: 'co-figc' }, cv, el('figcaption', {}, 'Le signal direct et son écho (réflexion sur une tribune) : le cadre vert pointillé est la fenêtre que lit le récepteur')),
    el('div', { class: 'co-ctl' },
      choice('Modulation', Object.keys(CN_REQ).map((k) => [k, k]), mod, (v) => { mod = v; draw(); }),
      choice('Codage correcteur', Object.keys(CN_REQ.QPSK).map((k) => [k, k]), fec, (v) => { fec = v; draw(); })),
    bars, read.el, verdict);
  draw();
}

// ======================================================================================
registerChapter({
  id: 'hf', title: 'La HF', icon: 'hf',
  intro: 'Les liaisons sans fil du car : bandes et fréquences, bilan de liaison, antennes et diversité, COFDM.',
  lessons: [
    {
      id: 'hf-frequences', title: 'Bandes et fréquences : qui émet quoi', minutes: '8 min',
      essentials: [
        'Micros HF en **UHF 470–694 MHz**, partagés avec la TNT ; caméras HF vers **2 GHz**, 5 GHz et 7 GHz ; intercom DECT à 1,9 GHz ; Wi-Fi à 2,4 et 5 GHz.',
        'Deux micros à f1 et f2 fabriquent des produits d\'**intermodulation** à 2f1 − f2 et 2f2 − f1 : un troisième micro posé dessus est brouillé.',
        'Les fréquences se **demandent** avant l\'événement (ANFR, Arcep, coordinateur de l\'organisateur) : on n\'émet pas où l\'on veut.',
      ],
      figure: figSpectre,
      demoTitle: 'Glissez les micros pour fabriquer puis éviter les produits d\'intermodulation ; essayez le plan naïf, puis le plan automatique. Promenez la caméra HF dans la bande 2 GHz.',
      demo: demoFreq,
      body: `Tout ce qui émet dans le stade se partage le même spectre. Les **micros HF** (émetteurs de quelques dizaines de mW) travaillent en **UHF, 470 à 694 MHz**, dans les canaux de 8 MHz de la télévision : la bande est partagée avec la TNT, et un canal occupé par un multiplex local est inutilisable. Au-dessus de 694 MHz, la bande a été donnée à la téléphonie mobile (le « second dividende numérique », 2019 en France) : les anciens micros en 700 MHz sont interdits. Restent quelques fenêtres étroites (823–832 MHz, 1 785–1 805 MHz) et la bande libre 863–865 MHz, à faible puissance, pour les micros bon marché.

Les **caméras HF** envoient une vidéo compressée en **COFDM** sur 8 ou 10 MHz, avec 100 mW à 1 W. En France, elles utilisent la bande **2 GHz** (de l'ordre de 2,2 à 2,5 GHz, partagée), la bande **5 GHz** et, pour les longues portées (hélicoptère, moto), **7 GHz**. Les beltpacks de l'intercom sans fil sont en **DECT** (1 880–1 900 MHz), parfois en 2,4 GHz. Et il y a le **Wi-Fi** : 2 400–2 483,5 MHz, saturé par les téléphones de 30 000 spectateurs, puis 5 et 6 GHz. La règle du car : jamais de liaison vidéo en 2,4 GHz un jour de match.

Les fréquences ne se choisissent pas, elles se **demandent**. En France, l'usage PMSE (Programme Making and Special Events) fait l'objet d'une autorisation temporaire délivrée par l'**Arcep** sur dossier déposé auprès de l'**ANFR** ; sur un grand événement, le **coordinateur de fréquences** de l'organisateur attribue à chaque diffuseur ses canaux et vérifie sur place à l'analyseur de spectre. Les règles et les bandes exactes évoluent : les valeurs ci-dessus sont des ordres d'idée, à vérifier pour chaque événement.

Le piège des micros : deux émetteurs proches, à f1 et f2, se mélangent dans tout étage non linéaire (l'entrée du récepteur, un amplificateur d'antenne) et produisent des **produits d'intermodulation d'ordre 3** à 2f1 − f2 et 2f2 − f1. Avec trois micros, s'ajoutent f1 + f2 − f3. Un micro posé sur un de ces produits est brouillé par ses voisins. Le plan de fréquences de huit micros se calcule donc : chaque micro à plus de 300 kHz de tout produit, à plus de 400 kHz de tout autre micro, hors des canaux TNT. Un plan « tous les 500 kHz » est le pire : 2f1 − f2 tombe exactement sur le micro d'à côté. Les logiciels des constructeurs et l'analyseur de spectre font ce travail ; la manipulation montre pourquoi.`,
      car: { text: 'Au poste HF (zone technique) : le plan de fréquences de la bande 2 GHz, avec les canaux attribués à la production, ceux des autres diffuseurs et le Wi-Fi ; on y choisit le canal de chaque caméra HF et l\'analyseur de spectre montre qui émet.', station: 'hf' },
      terms: [],
      quiz: [
        { q: 'Dans quelle bande travaillent les micros HF en France ?', choices: ['2,4 GHz, avec le Wi-Fi', 'UHF 470–694 MHz, partagée avec la TNT', '700 MHz, réservée à la télévision'], answer: 1, why: 'Les micros HF professionnels sont en UHF, dans les canaux de 8 MHz de la TNT (470–694 MHz). La bande 700 MHz est passée à la téléphonie mobile ; le 2,4 GHz est le Wi-Fi, saturé dans un stade.' },
        { q: 'Deux micros à 518,0 et 518,5 MHz. Où tombe un produit d\'intermodulation d\'ordre 3 ?', choices: ['À 1 036,5 MHz', 'À 519,0 MHz (2 × 518,5 − 518,0)', 'Nulle part : deux micros ne s\'intermodulent pas'], answer: 1, why: '2f2 − f1 = 1 037 − 518 = 519,0 MHz, et 2f1 − f2 = 517,5 MHz : juste à côté des micros, là où on aurait posé le troisième. La somme f1 + f2 existe aussi (ordre 2) mais tombe loin, hors bande.' },
        { q: 'Pourquoi ne pas mettre une caméra HF en 2,4 GHz ?', choices: ['Parce que les antennes 2,4 GHz n\'existent pas', 'Parce que la bande est libre et saturée par le Wi-Fi des spectateurs', 'Parce que le COFDM ne fonctionne pas au-dessus de 2 GHz'], answer: 1, why: 'La bande 2,4 GHz est libre (ISM) : des milliers de téléphones y émettent sans coordination et le niveau de brouillage est imprévisible. Les caméras HF utilisent des canaux attribués, hors Wi-Fi ; le COFDM lui-même fonctionne à toute fréquence.' },
      ],
    },
    {
      id: 'hf-bilan', title: 'Le bilan de liaison', minutes: '9 min',
      essentials: [
        'Niveau reçu (dBm) = puissance émise + gains d\'antennes − affaiblissement en espace libre − obstacles − câbles.',
        'L\'espace libre : FSPL = 20 log d + 20 log f − 27,55 (d en m, f en MHz) ; **distance × 2 = −6 dB**, fréquence × 2 = −6 dB.',
        'La **marge** = niveau reçu − sensibilité. Au-dessus de 10 dB, confortable ; sous 3 dB, le moindre creux fait décrocher l\'image.',
      ],
      figure: figBilan,
      demoTitle: 'Éloignez la caméra, mettez une tribune sur le trajet, changez de modulation : regardez la marge passer du vert au rouge.',
      demo: demoBilan,
      body: `Les puissances d'une liaison HF s'étalent sur douze ordres de grandeur, de 1 W à l'émission jusqu'au picowatt au récepteur. On les écrit donc en **dBm**, décibels par rapport à 1 mW : 0 dBm = 1 mW, +30 dBm = 1 W, −60 dBm = 1 nW. L'intérêt : les gains et les pertes s'**additionnent**. Doubler la puissance, c'est +3 dB ; la multiplier par dix, +10 dB. Les gains d'antenne s'écrivent en **dBi**, par rapport à une antenne isotrope idéale qui rayonnerait pareil dans toutes les directions : un fouet fait environ 2 dBi, un patch 9, un panneau secteur 13.

Le poste le plus lourd du bilan est l'**affaiblissement en espace libre** (FSPL, free-space path loss) : l'énergie se répartit sur une sphère de plus en plus grande. Il ne dépend que de la distance et de la fréquence : **FSPL (dB) = 20 log d + 20 log f − 27,55**, avec d en mètres et f en MHz. À 2 200 MHz : 59 dB à 10 m, 79 dB à 100 m, 99 dB à 1 km. Chaque doublement de la distance coûte 6 dB ; passer de 2,2 à 5,8 GHz coûte 8,4 dB, ce que l'on rattrape par des antennes plus directives. Il n'y a aucun obstacle dans cette formule : une tribune en béton ajoute de l'ordre de 15 à 20 dB, un tunnel bien plus, et le corps du cadreur devant l'émetteur 3 à 5 dB.

De l'autre côté, le récepteur a une **sensibilité** : le niveau en dessous duquel il ne décode plus. Elle se calcule : plancher de bruit thermique (−174 dBm par hertz, soit −105 dBm sur 8 MHz) plus le facteur de bruit du récepteur (3 à 5 dB), plus le rapport signal sur bruit qu'exige la modulation (de l'ordre de 5 dB en QPSK 1/2, 14 dB en 16-QAM 3/4, 19 dB en 64-QAM 3/4, marge d'implémentation comprise). D'où des sensibilités vers −96, −87 et −82 dBm. Plus la modulation est riche, plus elle demande de signal.

La **marge** est la différence entre le niveau reçu et la sensibilité. Elle encaisse tout ce que le bilan n'a pas prévu : un évanouissement multi-trajet (10 à 20 dB pendant quelques millisecondes), un corps, la pluie, un brouilleur. Les ordres de grandeur du métier : au-delà de 10 dB on est tranquille ; entre 3 et 10 dB la liaison tient mais chaque creux se voit ; sous 3 dB on est à la merci du prochain pas du cadreur ; sous 0 dB l'image est perdue. Dans ce simulateur, la mission « une caméra HF » demande une marge supérieure à 3 dB avec deux antennes allumées. En numérique, la dégradation n'est pas progressive : c'est l'**effet falaise**, image parfaite puis plus rien en quelques dB.

En pratique, on ne mesure pas la marge en dBm mais en **C/N** ou **MER** sur le récepteur : c'est le même calcul, rapporté au bruit. Et on joue sur ce qui est à portée de main : rapprocher ou surélever une antenne (la distance), choisir une antenne plus directive (le gain), baisser la modulation (la sensibilité), avant d'augmenter la puissance (l'autonomie de l'émetteur et les voisins en pâtissent).`,
      car: { text: 'Au poste HF : pour chaque caméra HF, le bilan de liaison est affiché (puissance, gains, espace libre, obstacles), avec le C/N requis par la modulation et la marge en direct. La mission « une caméra HF » demande une marge supérieure à 3 dB ; promenez la Steadicam jusque dans le tunnel et regardez la marge tomber.', station: 'hf' },
      terms: ['effet-falaise'],
      quiz: [
        { q: 'La caméra s\'éloigne de 50 m à 100 m. Que devient le niveau reçu ?', choices: ['−3 dB', '−6 dB', '−20 dB'], answer: 1, why: 'L\'espace libre varie en 20 log d : doubler la distance coûte 6 dB (quatre fois moins de puissance). −3 dB serait un facteur 2 en puissance ; −20 dB correspond à une distance multipliée par dix.' },
        { q: 'Niveau reçu −75 dBm, sensibilité −87 dBm. Comment juger la liaison ?', choices: ['12 dB de marge : confortable', '12 dB de marge : trop juste, il faut 30 dB', 'Liaison perdue : −75 est plus petit que −87'], answer: 0, why: '−75 dBm est plus fort que −87 dBm (moins négatif) : la marge est de 12 dB, au-dessus des 10 dB qui mettent à l\'abri des évanouissements courants. On n\'exige pas 30 dB sur une liaison de reportage.' },
        { q: 'Que vaut 100 mW en dBm ?', choices: ['10 dBm', '20 dBm', '100 dBm'], answer: 1, why: '10 log (100 mW / 1 mW) = 10 × 2 = 20 dBm. 10 dBm, c\'est 10 mW (un micro HF) ; 100 dBm serait 10 millions de watts.' },
      ],
    },
    {
      id: 'hf-antennes', title: 'Antennes, diversité, polarisation', minutes: '8 min',
      essentials: [
        'Une antenne **directive** (patch, panneau, log-périodique) ne crée pas d\'énergie : elle la concentre dans un faisceau, d\'où son gain en dBi et un angle à viser.',
        'Deux trajets du même signal (direct, réfléchi) s\'additionnent ou s\'annulent selon la phase : les **évanouissements** multi-trajet creusent des trous de 10 à 20 dB tous les quelques centimètres.',
        'La **diversité** (plusieurs antennes, le récepteur garde ou combine les meilleures) : les trous ne tombent pas au même endroit sur deux antennes.',
      ],
      figure: figAntennes,
      demoTitle: 'Déplacez la caméra (ou lancez-la le long de la touche) et regardez les creux sur A et sur B ; tournez une antenne, changez son type.',
      demo: demoAnt,
      body: `Une antenne **omnidirectionnelle** (fouet, dipôle) rayonne et reçoit pareil dans toutes les directions du plan horizontal : son gain est faible, de l'ordre de 2 dBi, mais elle n'a pas à être visée. Une antenne **directive** concentre la même énergie dans un faisceau : un **patch** (une plaque carrée) fait 7 à 9 dBi avec un faisceau d'une soixantaine de degrés ; un **panneau secteur** 12 à 14 dBi avec un faisceau plus étroit, encore plus en vertical ; une **log-périodique** (le « râteau ») 6 à 10 dBi sur une large bande. Le gain se paie en couverture : à 40° de l'axe d'un panneau, on a déjà perdu 12 dB, et derrière il ne reste presque rien. D'où la pose : panneaux sur le toit de la tribune, visés vers le terrain ; omni dans le tunnel et au compound.

Entre l'émetteur et l'antenne, le signal ne prend pas qu'un chemin. Il se réfléchit sur la pelouse, les tribunes, les panneaux publicitaires, et plusieurs copies arrivent avec des retards différents. À 2,2 GHz, la longueur d'onde est de 13,6 cm : deux copies dont les trajets diffèrent d'une demi-longueur d'onde (7 cm) arrivent en **opposition de phase** et s'annulent en partie. C'est l'**évanouissement** multi-trajet (fading) : en se déplaçant de quelques centimètres, le cadreur fait passer le niveau reçu par des creux de 10 à 20 dB, puis des bosses. Une marge de 10 dB se mange en un pas. C'est ce que montre la manipulation : le niveau d'une antenne fixe ondule brutalement le long de la touche.

La parade est la **diversité**. Deux antennes séparées de plusieurs longueurs d'onde reçoivent des combinaisons de trajets différentes : un creux sur A n'est presque jamais un creux sur B au même instant. Le récepteur **choisit** la meilleure (diversité de commutation) ou, mieux, **combine** les signaux de 2, 4 ou 8 antennes en pondérant chacune par sa qualité (combinaison à rapport maximal, ce que font les récepteurs COFDM de reportage). Dans ce simulateur, le récepteur additionne les quatre meilleures antennes : c'est pour cela que la mission demande au moins deux antennes allumées. Les antennes sont reliées au car par de la **RF sur fibre** : le signal HF module un laser dans un petit boîtier sous l'antenne, sans les pertes d'un long coaxial (1 dB tous les 10 m à 2 GHz, de l'ordre de).

Dernier paramètre : la **polarisation**. Une antenne verticale reçoit mal une onde horizontale, et un émetteur au dos d'un cadreur qui se penche change de polarisation. Les antennes de réception des caméras HF sont souvent en polarisation **circulaire** (hélice, patch à alimentation croisée) ou à double polarisation : elles reçoivent l'émetteur quelle que soit son inclinaison, au prix de 3 dB.`,
      car: { text: 'Sur le stade (toit des tribunes, tunnel, compound) : les antennes de réception HF, à allumer et à viser ; chacune indique son type, son gain et le niveau qu\'elle reçoit de chaque caméra. Au poste HF, le niveau par antenne et le C/N combiné en diversité.', station: 'antenne' },
      terms: ['effet-falaise'],
      quiz: [
        { q: 'Qu\'apporte une antenne de 13 dBi par rapport à une omni de 2 dBi ?', choices: ['11 dB de plus partout', '11 dB de plus dans l\'axe, mais presque rien derrière et sur les côtés', 'Plus de puissance d\'émission'], answer: 1, why: 'Le gain d\'antenne est une concentration, pas une création d\'énergie : ce qu\'elle gagne dans l\'axe, elle le perd ailleurs. Une antenne ne change pas la puissance de l\'émetteur ; elle choisit où l\'énergie va, et il faut la viser.' },
        { q: 'Le niveau reçu plonge de 15 dB quand le cadreur fait un pas, puis remonte. Cause ?', choices: ['L\'émetteur a changé de canal', 'Un évanouissement multi-trajet : deux copies du signal en opposition de phase', 'L\'antenne a perdu sa polarisation'], answer: 1, why: 'À 2,2 GHz, un déplacement de 7 cm change la différence de marche entre le trajet direct et un trajet réfléchi d\'une demi-longueur d\'onde : les deux s\'annulent. Ni le canal ni la polarisation ne varient à cette échelle. La diversité d\'antennes est la réponse.' },
        { q: 'Pourquoi deux antennes en diversité valent-elles mieux qu\'une seule de 3 dB de gain en plus ?', choices: ['Parce que les creux d\'évanouissement ne tombent pas au même instant sur les deux antennes', 'Parce que deux antennes doublent la puissance émise', 'Elles ne valent pas mieux : 3 dB, c\'est 3 dB'], answer: 0, why: 'Un creux de 15 dB avale 3 dB de gain sans difficulté. Deux antennes séparées reçoivent des combinaisons de trajets différentes : quand l\'une est dans un creux, l\'autre ne l\'est presque jamais. Le récepteur garde ou combine la meilleure. La puissance émise ne change pas.' },
      ],
    },
    {
      id: 'hf-cofdm', title: 'COFDM : pourquoi la caméra HF tient dans un stade', minutes: '8 min',
      essentials: [
        'Le **COFDM** répartit le débit sur des milliers de porteuses lentes : un symbole dure des centaines de µs au lieu d\'une fraction de µs.',
        'Chaque symbole commence par un **intervalle de garde** : un écho plus court que la garde est absorbé au lieu de brouiller le symbole suivant.',
        'Modulation et codage règlent le compromis **débit contre robustesse** : 64-QAM pour la belle image en ligne de vue, QPSK pour passer partout.',
      ],
      figure: figCofdm,
      demoTitle: 'Allongez le retard de l\'écho jusqu\'à sortir de l\'intervalle de garde, passez en mono-porteuse, puis jouez modulation et codage.',
      demo: demoCofdm,
      body: `Dans un stade, le signal d'une caméra HF arrive au récepteur par plusieurs chemins : le direct et des réflexions sur les tribunes, retardées de quelques microsecondes (1 µs par 300 m de détour). Pour une transmission **mono-porteuse** à 8 Mbit de symboles par seconde, un symbole dure 0,125 µs : un écho de 10 µs étale chaque symbole sur les 80 suivants. C'est l'**interférence entre symboles**, et aucun égaliseur raisonnable ne la défait en mobilité.

Le **COFDM** (Coded Orthogonal Frequency Division Multiplexing, celui de la TNT, DVB-T) prend le problème à l'envers : au lieu d'une porteuse rapide, il utilise **des milliers de porteuses lentes** (1 705 en mode 2K, 6 817 en 8K, dans 8 MHz), chacune portant quelques bits par symbole. Le symbole dure alors 224 µs (2K) ou 896 µs (8K). Et chaque symbole est précédé d'un **intervalle de garde** : une copie de sa propre fin, d'un quart, un huitième, un seizième ou un trente-deuxième de sa durée. Tant que l'écho est plus court que la garde, ce que le récepteur lit dans sa fenêtre n'est que le symbole courant, direct et écho mêlés : l'écho ne brouille rien, il s'ajoute. Garde 1/4 en 2K : 56 µs, soit 17 km de détour absorbés ; 1/32 : 7 µs, 2 km, mais 20 % de débit en plus. Le C de COFDM, c'est le **codage** correcteur d'erreurs, entrelacé en fréquence : les porteuses tombées dans un creux d'évanouissement sont reconstruites à partir des autres.

Le réglage de l'émetteur est un compromis **débit contre robustesse** :
- **modulation** : QPSK (2 bits par porteuse), 16-QAM (4), 64-QAM (6) ; chaque pas double à peu près le débit mais demande environ 6 dB de signal en plus (C/N requis de l'ordre de 5, 12 et 18 dB pour un codage 3/4, hors marge d'implémentation) ;
- **codage** : 1/2 (une moitié de bits utiles, très robuste) à 7/8 (presque tout utile, fragile) ;
- **intervalle de garde** : long pour les grands échos, court pour le débit.
En 8 MHz, cela va de 5 Mb/s (QPSK 1/2, garde 1/4) à 27 Mb/s (64-QAM 3/4, garde 1/32) ; la vidéo est compressée en H.264 ou HEVC pour tenir dans ce débit, avec une image d'autant plus fine que le débit est élevé. Sur un stade en ligne de vue depuis le toit, 16-QAM 3/4 à 16 Mb/s est un choix courant ; pour suivre les joueurs dans le tunnel, on redescend en QPSK.

La **latence** est le prix de la compression et de l'entrelacement : de l'ordre de 1 à 3 images (20 à 60 ms) de la caméra au car selon le mode. Le son de la caméra HF et ses retours doivent être recalés d'autant, et l'image HF n'est jamais synchrone des caméras câblées : elle passe par un synchroniseur à l'entrée du car. On surveille la liaison au **MER** (rapport signal sur bruit mesuré sur la constellation) : bien au-dessus du C/N requis, image parfaite ; en dessous, macro-blocs puis image figée, l'effet falaise.`,
      car: { text: 'Au poste HF : pour chaque caméra HF, modulation, codage, intervalle de garde et latence ; le débit, le C/N requis et la marge se recalculent en direct, et l\'image se dégrade (macro-blocs, gel) quand la marge passe sous zéro.', station: 'hf' },
      terms: ['effet-falaise'],
      quiz: [
        { q: 'Un écho arrive 30 µs après le direct. En COFDM 2K, garde 1/8 (28 µs), que se passe-t-il ?', choices: ['Rien : le COFDM ignore tous les échos', 'L\'écho déborde de l\'intervalle de garde et brouille le symbole suivant', 'L\'image est perdue définitivement'], answer: 1, why: 'Le COFDM n\'absorbe que les échos plus courts que l\'intervalle de garde. À 30 µs pour 28 µs de garde, l\'écho mord sur le symbole suivant : erreurs, que le codage corrige en partie. Garde 1/4 (56 µs) ou un peu moins de débit règlent le problème.' },
        { q: 'Pourquoi passer de 64-QAM à QPSK pour suivre les joueurs dans le tunnel ?', choices: ['Parce que QPSK a plus de débit', 'Parce que QPSK demande environ 13 dB de signal en moins : la liaison tient avec un niveau reçu plus faible', 'Parce que le tunnel n\'accepte pas la 64-QAM'], answer: 1, why: 'QPSK porte 2 bits par porteuse contre 6 : le débit est trois fois plus faible, l\'image plus compressée, mais le C/N requis tombe de 18 à 5 dB environ. Dans le tunnel, où le niveau reçu s\'effondre, c\'est le seul moyen de garder une image.' },
        { q: 'Quelle latence attendre d\'une caméra HF COFDM ?', choices: ['Aucune, c\'est de la radio', 'De l\'ordre de 1 à 3 images (20 à 60 ms)', 'Plusieurs secondes'], answer: 1, why: 'La compression H.264 / HEVC, l\'entrelacement COFDM et le décodage prennent de l\'ordre de 20 à 60 ms selon le mode. Ce n\'est pas nul (le son doit être recalé), mais rien à voir avec les secondes d\'une liaison satellite ou Internet.' },
      ],
    },
  ],
});

// @ts-check
import { el } from '../util.js';
import { registerChapter } from './index.js';
import { figure, sv, canvas, slider, choice, readout, fmtNum } from './kit.js';
import { LESSON_COMPRESSION } from './signal_compression.js';

// ----------------------------------------------------------------------------------
// Chapitre « Le signal vidéo numérique ». Première leçon : l'échantillonnage 4:4:4 / 4:2:2 / 4:2:0,
// avec une image de synthèse que l'on sous-échantillonne vraiment (YCbCr BT.709) et une loupe.
// Les autres leçons (quantification, niveaux, formats et cadences, espaces de couleur) suivent le
// même modèle : un schéma SVG, une manipulation qui calcule, l'explication, le car, un quiz.
// ----------------------------------------------------------------------------------

// ---------------- 4:2:2 : la manipulation ----------------
const W = 256, H = 144;
// image de synthèse : barres, lignes fines colorées, petit texte rouge sur fond bleu, damier fin
function drawSource(g) {
  const bars = ['#c0c0c0', '#c0c000', '#00c0c0', '#00c000', '#c000c0', '#c00000', '#0000c0'];
  bars.forEach((c, i) => { g.fillStyle = c; g.fillRect(Math.round(i * W / 7), 0, Math.ceil(W / 7), 40); });
  g.fillStyle = '#1a2a6a'; g.fillRect(0, 40, W, 56);
  g.fillStyle = '#ff2a1a'; g.font = 'bold 22px Arial, sans-serif'; g.fillText('RC LENS 1-0', 10, 78);
  g.fillStyle = '#ffd400'; g.font = 'bold 11px Arial, sans-serif'; g.fillText('maillot sang et or · 4:2:2', 150, 60);
  // lignes fines : rouge, vert, bleu, magenta, sur fond gris, puis damier 1 px rouge et cyan
  g.fillStyle = '#6a6a6a'; g.fillRect(0, 96, W, 48);
  const cols = ['#ff0000', '#00ff00', '#0040ff', '#ff00ff', '#00ffff', '#ff8000'];
  cols.forEach((c, i) => { g.strokeStyle = c; g.lineWidth = 1; g.beginPath(); g.moveTo(8 + i * 22, 100); g.lineTo(8 + i * 22 + 10, 140); g.stroke(); });
  for (let y = 100; y < 140; y++) for (let x = 150; x < 246; x++) { g.fillStyle = ((x + y) & 1) ? '#ff2020' : '#20d0ff'; g.fillRect(x, y, 1, 1); }
}
// RVB ↔ YCbCr (BT.709, pleine échelle, pour la démonstration)
const toY = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const toCb = (r, g, b, y) => (b - y) / 1.8556;
const toCr = (r, g, b, y) => (r - y) / 1.5748;
function subsample(src, mode) {
  const n = W * H, Y = new Float32Array(n), Cb = new Float32Array(n), Cr = new Float32Array(n);
  for (let i = 0; i < n; i++) { const r = src[i * 4], g = src[i * 4 + 1], b = src[i * 4 + 2]; const y = toY(r, g, b); Y[i] = y; Cb[i] = toCb(r, g, b, y); Cr[i] = toCr(r, g, b, y); }
  const sx = mode === '444' ? 1 : 2, sy = mode === '420' ? 2 : 1;
  const out = new Uint8ClampedArray(n * 4);
  for (let y = 0; y < H; y += sy) for (let x = 0; x < W; x += sx) {
    // un seul échantillon de couleur pour le bloc : la moyenne, comme un vrai filtre de sous-échantillonnage
    let cb = 0, cr = 0, k = 0;
    for (let dy = 0; dy < sy && y + dy < H; dy++) for (let dx = 0; dx < sx && x + dx < W; dx++) { const i = (y + dy) * W + x + dx; cb += Cb[i]; cr += Cr[i]; k++; }
    cb /= k; cr /= k;
    for (let dy = 0; dy < sy && y + dy < H; dy++) for (let dx = 0; dx < sx && x + dx < W; dx++) {
      const i = (y + dy) * W + x + dx; const yy = Y[i];
      const r = yy + 1.5748 * cr, b = yy + 1.8556 * cb, g = (yy - 0.2126 * r - 0.0722 * b) / 0.7152;
      out[i * 4] = r; out[i * 4 + 1] = g; out[i * 4 + 2] = b; out[i * 4 + 3] = 255;
    }
  }
  return out;
}
const RATE = { 444: 3.11, 422: 2.07, 420: 1.56 }; // Gb/s, 1080p50 10 bits, hors suppression
function demo422(host) {
  const src = canvas(W, H), dst = canvas(W, H), zoomC = canvas(W, H);
  const gs = src.getContext('2d'), gd = dst.getContext('2d'), gz = zoomC.getContext('2d');
  gz.imageSmoothingEnabled = false;
  drawSource(gs);
  const pixels = gs.getImageData(0, 0, W, H).data;
  let mode = '422', zoom = 6, cx = 60, cy = 70;
  const read = readout(['Échantillons de couleur pour 4 pixels', 'Débit 1080p50 10 bits', 'Économie']);
  const redraw = () => {
    const out = subsample(pixels, mode);
    gd.putImageData(new ImageData(out, W, H), 0, 0);
    const w = Math.round(W / zoom), h = Math.round(H / zoom);
    const x0 = Math.max(0, Math.min(W - w, cx - w / 2)), y0 = Math.max(0, Math.min(H - h, cy - h / 2));
    gz.clearRect(0, 0, W, H); gz.drawImage(dst, x0, y0, w, h, 0, 0, W, H);
    const samples = mode === '444' ? 4 : mode === '422' ? 2 : 1;
    read.set('Échantillons de couleur pour 4 pixels', `${samples} (luminance : toujours 4)`);
    read.set('Débit 1080p50 10 bits', `${fmtNum(RATE[mode], 2)} Gb/s`);
    read.set('Économie', mode === '444' ? 'aucune' : `${fmtNum((1 - RATE[mode] / RATE[444]) * 100)} % de données en moins, sans perte visible de netteté`);
  };
  const pick = (ev) => { const r = dst.getBoundingClientRect(); cx = Math.round((ev.clientX - r.left) / r.width * W); cy = Math.round((ev.clientY - r.top) / r.height * H); redraw(); };
  dst.addEventListener('pointerdown', pick); dst.addEventListener('pointermove', (ev) => { if (ev.buttons) pick(ev); });
  dst.title = 'Cliquez pour déplacer la loupe'; dst.style.cursor = 'crosshair';
  host.append(
    el('div', { class: 'co-ctl' },
      choice('Échantillonnage', [['444', '4:4:4', 'Couleur sur chaque pixel'], ['422', '4:2:2', 'Couleur un pixel sur deux (SDI, car régie)'], ['420', '4:2:0', 'Couleur un pixel sur deux et une ligne sur deux (diffusion, Internet)']], mode, (v) => { mode = v; redraw(); }),
      slider('Loupe', 2, 12, zoom, 1, (v) => { zoom = v; redraw(); }, (v) => '× ' + v)),
    el('div', { class: 'co-3' },
      el('figure', {}, src, el('figcaption', {}, 'Image d\'origine (4:4:4)')),
      el('figure', {}, dst, el('figcaption', {}, 'Après échantillonnage · cliquez pour placer la loupe')),
      el('figure', {}, zoomC, el('figcaption', {}, 'Loupe'))),
    read.el);
  redraw();
}
// schéma : la grille d'échantillons
function fig422() {
  const g = (x0, title, cols, rows, sx, sy) => {
    const grp = sv('g', { transform: `translate(${x0} 0)` });
    grp.append(sv('text', { x: 64, y: 16, textAnchor: 'middle', class: 'co-t' }, title));
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      grp.append(sv('rect', { x: 8 + x * 28, y: 26 + y * 28, width: 26, height: 26, rx: 3, fill: '#8a949c' }));
      if (x % sx === 0 && y % sy === 0) grp.append(sv('circle', { cx: 8 + x * 28 + 13 + (sx > 1 ? 13 : 0) + (sx > 1 ? 1 : 0), cy: 26 + y * 28 + 13 + (sy > 1 ? 14 : 0), r: 6, fill: '#ff8a80' }));
    }
    return grp;
  };
  const f = figure(420, 100, 'Grilles d\'échantillons : la luminance sur chaque pixel (gris), la couleur (points rouges) sur chaque pixel en 4:4:4, un sur deux en 4:2:2, un sur quatre en 4:2:0');
  f.append(g(0, '4:4:4', 4, 2, 1, 1), g(140, '4:2:2', 4, 2, 2, 1), g(280, '4:2:0', 4, 2, 2, 2));
  f.append(sv('text', { x: 210, y: 96, textAnchor: 'middle', class: 'co-s' }, 'carré : échantillon de luminance Y · point : échantillon de couleur Cb et Cr'));
  return f;
}

// ---------------- 8 ou 10 bits : la manipulation ----------------
// Une scène en valeurs continues (ciel de fin de journée, soleil bas, pelouse qui s'assombrit) que l'on
// quantifie vraiment sur 4 à 10 bits par composante, avec ou sans dithering. L'écran est en 8 bits :
// pour voir la différence entre 8 et 10 bits, on « étalonne » le ciel (contraste × 5, comme une fenêtre
// de correction colorimétrique) : les marches du 8 bits apparaissent, celles du 10 bits restent sous le pas de l'écran.
const QW = 320, QH = 180, QHZ = 104, QCOL = 60, QSTRETCH = 5, QPIVOT = 0.40;
function quantScene() {
  const src = new Float32Array(QW * QH * 3);
  for (let y = 0; y < QH; y++) for (let x = 0; x < QW; x++) {
    let r, g, b;
    if (y < QHZ) { const t = y / QHZ; r = 0.30 + 0.20 * t; g = 0.34 + 0.08 * t; b = 0.48 - 0.11 * t; } // ciel bleu-gris → rosé à l'horizon
    else { const t = (y - QHZ) / (QH - QHZ); r = 0.12 - 0.05 * t; g = 0.26 - 0.13 * t; b = 0.08 - 0.04 * t; } // pelouse
    if (y < QHZ) { const d = Math.hypot(x - 232, y - (QHZ - 12)); const h = Math.max(0, 1 - d / 80); r += h * h * 0.30; g += h * h * 0.14; b -= h * h * 0.05; if (d < 9) { r = 0.98; g = 0.90; b = 0.72; } }
    const i = (y * QW + x) * 3; src[i] = Math.min(1, Math.max(0, r)); src[i + 1] = Math.min(1, Math.max(0, g)); src[i + 2] = Math.min(1, Math.max(0, b));
  }
  return src;
}
const clamp01 = (v) => v < 0 ? 0 : v > 1 ? 1 : v;
function demoBits(host) {
  const src = quantScene(), noise = new Float32Array(QW * QH * 3);
  for (let i = 0; i < noise.length; i++) noise[i] = Math.random() + Math.random() - 1; // bruit triangulaire ± 1 pas (TPDF), fixé une fois pour toutes
  const img = canvas(QW, QH), graded = canvas(QW, QH), prof = canvas(QW, QH);
  const gi = img.getContext('2d'), gg = graded.getContext('2d'), gp = prof.getContext('2d');
  const out = new Uint8ClampedArray(QW * QH * 4), out2 = new Uint8ClampedArray(QW * QH * 4);
  let bits = 8, dither = false;
  const read = readout(['Niveaux par composante', 'Pas de quantification', 'Marche après étalonnage × 5', 'Ciel étalonné : marches visibles']);
  const redraw = () => {
    const L = (1 << bits) - 1, col = new Float32Array(QHZ);
    for (let i = 0, n = QW * QH; i < n; i++) {
      const sky = (i / QW | 0) < QHZ;
      for (let c = 0; c < 3; c++) {
        let v = src[i * 3 + c];
        if (dither) v += noise[i * 3 + c] / L;
        const q = Math.round(clamp01(v) * L) / L; // la quantification : L + 1 niveaux
        out[i * 4 + c] = Math.round(q * 255);
        out2[i * 4 + c] = Math.round(clamp01(sky ? 0.5 + (q - QPIVOT) * QSTRETCH : q) * 255);
        if (c === 0 && i % QW === QCOL && sky) col[i / QW | 0] = q;
      }
      out[i * 4 + 3] = 255; out2[i * 4 + 3] = 255;
    }
    gi.putImageData(new ImageData(out, QW, QH), 0, 0); gg.putImageData(new ImageData(out2, QW, QH), 0, 0);
    // profil : la composante rouge d'une colonne du ciel, rampe continue (gris) et valeurs quantifiées (ambre)
    gp.fillStyle = '#0b1013'; gp.fillRect(0, 0, QW, QH);
    let lo = 1, hi = 0; for (let y = 0; y < QHZ; y++) { const v = src[(y * QW + QCOL) * 3]; if (v < lo) lo = v; if (v > hi) hi = v; }
    lo -= 0.01; hi += 0.01;
    const X = (v) => 30 + (v - lo) / (hi - lo) * (QW - 40), Y = (y) => 10 + y / QHZ * (QH - 20);
    gp.strokeStyle = '#8a949c'; gp.lineWidth = 1; gp.beginPath(); for (let y = 0; y < QHZ; y++) gp[y ? 'lineTo' : 'moveTo'](X(src[(y * QW + QCOL) * 3]), Y(y)); gp.stroke();
    gp.strokeStyle = '#ffd38a'; gp.lineWidth = 2; gp.beginPath(); for (let y = 0; y < QHZ; y++) gp[y ? 'lineTo' : 'moveTo'](X(col[y]), Y(y)); gp.stroke();
    gp.fillStyle = '#aab4ba'; gp.font = '11px Arial, sans-serif'; gp.fillText('haut du ciel', 4, 20); gp.fillText('horizon', 4, QH - 12); gp.fillText(`${bits} bits · ${fmtNum(L + 1)} niveaux`, QW - 130, 20);
    // lecture : marches distinctes le long de la colonne du ciel étalonné
    let steps = 0, prev = -1; for (let y = 0; y < QHZ; y++) { const v = out2[(y * QW + QCOL) * 4]; if (v !== prev) { steps++; prev = v; } }
    const stepPct = 100 / L, screen = QSTRETCH * 255 / L;
    read.set('Niveaux par composante', `${fmtNum(L + 1)} (2^${bits}) · ${fmtNum(Math.pow(L + 1, 3))} couleurs`);
    read.set('Pas de quantification', `${fmtNum(stepPct, stepPct < 1 ? 3 : 1)} % du blanc`);
    read.set('Marche après étalonnage × 5', `${fmtNum(screen, 1)} code${screen > 1.5 ? 's' : ''} d'écran 8 bits : ${screen < 1.6 ? 'invisible' : screen < 3 ? 'à peine visible' : 'bande visible'}`);
    read.set('Ciel étalonné : marches visibles', dither ? 'les marches sont remplacées par un bruit fin (dithering)' : `${steps} paliers sur ${QHZ} lignes${screen >= 3 ? ' : des bandes' : ' : un dégradé lisse'}`);
  };
  host.append(
    el('div', { class: 'co-ctl' },
      slider('Profondeur', 4, 10, bits, 1, (v) => { bits = v; redraw(); }, (v) => v + ' bits'),
      choice('Dithering', [['off', 'sans', 'Arrondi simple'], ['on', 'avec', 'Un bruit de ± 1 pas est ajouté avant l\'arrondi : les marches deviennent un grain fin']], 'off', (v) => { dither = v === 'on'; redraw(); })),
    el('div', { class: 'co-3' },
      el('figure', {}, img, el('figcaption', {}, 'Image quantifiée (telle que l\'écran la montre)')),
      el('figure', {}, graded, el('figcaption', {}, 'La même, étalonnée : contraste × 5 sur le ciel')),
      el('figure', {}, prof, el('figcaption', {}, 'Profil d\'une colonne du ciel : la rampe et ses marches'))),
    read.el);
  redraw();
}
function figBits() {
  const f = figure(420, 118, 'Quantification : une rampe continue devient un escalier ; plus il y a de bits, plus les marches sont petites : 8 niveaux à 3 bits, 16 à 4 bits, 256 à 8 bits, 1 024 à 10 bits');
  const stair = (x0, bits, title) => {
    const grp = sv('g', { transform: `translate(${x0} 0)` }), n = 1 << bits, w = 110, h = 70;
    grp.append(sv('text', { x: w / 2, y: 14, textAnchor: 'middle', class: 'co-t' }, title));
    grp.append(sv('rect', { x: 0, y: 22, width: w, height: h, fill: '#0b1013', stroke: '#424c56' }));
    grp.append(sv('line', { x1: 0, y1: 22 + h, x2: w, y2: 22, stroke: '#8a949c', strokeWidth: 1 }));
    let d = ''; for (let k = 0; k < n; k++) { const x = k * w / n, y = 22 + h - Math.round(k / (n - 1) * h); d += `${k ? 'L' : 'M'}${x.toFixed(1)} ${y} H${((k + 1) * w / n).toFixed(1)} `; }
    grp.append(sv('path', { d, fill: 'none', stroke: '#ffd38a', strokeWidth: 2 }));
    grp.append(sv('text', { x: w / 2, y: 108, textAnchor: 'middle', class: 'co-s' }, `${n} niveaux · pas ${fmtNum(100 / (n - 1), 1)} %`));
    return grp;
  };
  f.append(stair(0, 3, '3 bits'), stair(130, 4, '4 bits'));
  const t = sv('g', { transform: 'translate(262 0)' });
  t.append(sv('text', { x: 0, y: 14, class: 'co-t' }, 'En vidéo'));
  [['8 bits', '256 niveaux · pas 0,39 %', 'diffusion'], ['10 bits', '1 024 niveaux · pas 0,098 %', 'le car, le SDI'], ['12 bits', '4 096 niveaux · pas 0,024 %', 'cinéma, RAW']].forEach((r, i) => {
    t.append(sv('text', { x: 0, y: 38 + i * 26, class: 'co-m' }, r[0]), sv('text', { x: 52, y: 38 + i * 26, class: 'co-s' }, r[1]), sv('text', { x: 52, y: 50 + i * 26, class: 'co-s' }, r[2]));
  });
  f.append(t);
  return f;
}

// ---------------- niveaux : la manipulation ----------------
// Une scène en pourcentages (ciel, pelouse, maillot blanc, short noir, projecteur, rampe de gris) à laquelle on applique
// un gain et un piédestal, codée sur 10 bits (noir 64, blanc 940), puis un waveform calculé sur l'image obtenue.
const NW = 240, NH = 135, NWH = 200, NMIN = -12, NMAX = 115;
const code10 = (pct) => Math.round(64 + pct * 8.76), pct10 = (code) => (code - 64) / 8.76;
function levelsScene() {
  const s = new Float32Array(NW * NH * 3);
  const put = (x, y, r, g, b) => { const i = (y * NW + x) * 3; s[i] = r; s[i + 1] = g; s[i + 2] = b; };
  for (let y = 0; y < NH; y++) for (let x = 0; x < NW; x++) {
    if (y < 50) { const t = y / 50; put(x, y, 55 + 13 * t, 62 + 10 * t, 75 + 5 * t); }
    else if (y < 116) { const t = (y - 50) / 66; put(x, y, 36 - 8 * t, 56 - 11 * t, 24 - 4 * t); }
    else { const t = x / (NW - 1) * 100; put(x, y, t, t, t); }
    if (x >= 92 && x < 132 && y >= 58 && y < 98) put(x, y, 95, 95, 93); // maillot blanc
    if (x >= 108 && x < 116 && y >= 58 && y < 98) put(x, y, 70, 14, 12); // bande rouge
    if (x >= 96 && x < 128 && y >= 98 && y < 112) put(x, y, 2.5, 2.5, 3); // short noir
    if (Math.hypot(x - 200, y - 18) < 7) put(x, y, 100, 100, 98); // projecteur
  }
  return s;
}
function demoLevels(host) {
  const src = levelsScene(), img = canvas(NW, NH), wfm = canvas(NW, NWH, 'co-canvas co-smooth');
  const gi = img.getContext('2d'), gw = wfm.getContext('2d');
  const out = new Uint8ClampedArray(NW * NH * 4), hits = new Uint16Array(NW * NWH), wf = new Uint8ClampedArray(NW * NWH * 4);
  let gain = 100, ped = 0, legal = false;
  const Y = (pct) => Math.round(NWH - 1 - (Math.min(NMAX, Math.max(NMIN, pct)) - NMIN) / (NMAX - NMIN) * (NWH - 1));
  const read = readout(['Maillot blanc', 'Short noir', 'Maximum de l\'image', 'Au-dessus de 100 %', 'Sous le noir']);
  const redraw = () => {
    hits.fill(0);
    let max = -99, over = 0, under = 0;
    const lo = legal ? 64 : 4, hi = legal ? 940 : 1019;
    for (let i = 0, n = NW * NH; i < n; i++) {
      let lum = 0;
      for (let c = 0; c < 3; c++) {
        const p = src[i * 3 + c] * gain / 100 + ped; // la chaîne : gain puis piédestal, en %
        const code = Math.min(hi, Math.max(lo, code10(p))); // le SDI ne porte que 4 à 1 019 ; légalisé : 64 à 940
        const q = pct10(code);
        out[i * 4 + c] = Math.round(clamp01(q / 100) * 255); // l'écran écrête à 100 %
        lum += q * [0.2126, 0.7152, 0.0722][c];
      }
      out[i * 4 + 3] = 255;
      if (lum > max) max = lum; if (lum > 100.05) over++; if (lum < -0.05) under++;
      hits[Y(lum) * NW + i % NW]++;
    }
    gi.putImageData(new ImageData(out, NW, NH), 0, 0);
    // le waveform : chaque point de l'image à sa colonne, à la hauteur de sa luminance
    for (let k = 0; k < NW * NWH; k++) { const h = hits[k], pct = NMAX - (k / NW | 0) / (NWH - 1) * (NMAX - NMIN); const bad = pct > 100.5 || pct < -0.5; const a = Math.min(255, h * 90); wf[k * 4] = bad ? a : a * 0.5; wf[k * 4 + 1] = bad ? a * 0.35 : a; wf[k * 4 + 2] = bad ? a * 0.3 : a * 0.6; wf[k * 4 + 3] = 255; }
    gw.putImageData(new ImageData(wf, NW, NWH), 0, 0);
    gw.font = '9px Menlo, Consolas, monospace'; gw.lineWidth = 1;
    for (const [pct, label, col] of [[109, '109 % · 1019', '#ff8a80'], [100, '100 % · 940', '#ffd38a'], [75, '75 %', '#424c56'], [50, '50 % · 502', '#424c56'], [25, '25 %', '#424c56'], [0, '0 % · 64', '#ffd38a'], [-7, '−7 % · 4', '#ff8a80']]) {
      const y = Y(pct) + 0.5; gw.strokeStyle = col; gw.setLineDash(pct === 109 || pct === -7 ? [3, 3] : []); gw.beginPath(); gw.moveTo(0, y); gw.lineTo(NW, y); gw.stroke();
      gw.fillStyle = col === '#424c56' ? '#aab4ba' : col; gw.fillText(label, 2, y - 2);
    }
    gw.setLineDash([]);
    const px = (x, y) => { let l = 0; for (let c = 0; c < 3; c++) { const p = src[(y * NW + x) * 3 + c] * gain / 100 + ped; l += pct10(Math.min(hi, Math.max(lo, code10(p)))) * [0.2126, 0.7152, 0.0722][c]; } return l; };
    const w = px(100, 78), k = px(100, 105), n = NW * NH;
    read.set('Maillot blanc', `${fmtNum(w, 1)} % · code ${code10(w)}`);
    read.set('Short noir', `${fmtNum(k, 1)} % · code ${code10(k)}`);
    read.set('Maximum de l\'image', `${fmtNum(max, 1)} % · code ${code10(max)}`);
    read.set('Au-dessus de 100 %', over ? (legal ? 'rien : tout est écrêté à 940' : `${fmtNum(over / n * 100, 1)} % des points, jusqu'à ${fmtNum(max, 0)} % : super-blancs (toléré 103 %, EBU R 103)`) : 'rien' + (legal && gain > 100 ? ' : les blancs sont écrêtés à 940, détail perdu' : ''));
    read.set('Sous le noir', under ? (legal ? 'rien : tout est remonté à 64' : `${fmtNum(under / n * 100, 1)} % des points sous le code 64 : noir enfoncé, détail perdu`) : 'rien');
  };
  host.append(
    el('div', { class: 'co-ctl' },
      slider('Gain', 50, 150, gain, 1, (v) => { gain = v; redraw(); }, (v) => v + ' %'),
      slider('Piédestal', -10, 10, ped, 0.5, (v) => { ped = v; redraw(); }, (v) => (v > 0 ? '+' : '') + fmtNum(v, 1) + ' %'),
      choice('Sortie', [['sdi', 'brute (4 à 1 019)', 'Tout ce que le SDI peut porter : de −7 % à 109 %'], ['legal', 'légalisée (64 à 940)', 'Écrêtée à 0 et 100 % : la plage légale (narrow range)']], 'sdi', (v) => { legal = v === 'legal'; redraw(); })),
    el('div', { class: 'co-3 co-2' },
      el('figure', {}, img, el('figcaption', {}, 'Image après gain et piédestal (l\'écran écrête à 100 %)')),
      el('figure', {}, wfm, el('figcaption', {}, 'Waveform de luminance : en rouge, ce qui sort de 0 à 100 %'))),
    read.el);
  redraw();
}
function figLevels() {
  const f = figure(420, 112, 'Échelle des codes 10 bits : 0 à 3 réservés, 4 = −7 %, 64 = noir 0 %, 940 = blanc 100 %, 1 019 = 109 %, 1 020 à 1 023 réservés ; en 8 bits : 16 et 235 ; en millivolts : 0 et 700');
  const X = (code) => 20 + code / 1023 * 380;
  f.append(sv('text', { x: 20, y: 14, class: 'co-t' }, 'Les codes 10 bits d\'un signal de luminance'));
  f.append(sv('rect', { x: X(0), y: 30, width: X(4) - X(0) + 1, height: 22, fill: '#ff8a80' }), sv('rect', { x: X(1020), y: 30, width: X(1023) - X(1020) + 1, height: 22, fill: '#ff8a80' }));
  f.append(sv('rect', { x: X(4), y: 30, width: X(64) - X(4), height: 22, fill: '#5c4210' }), sv('rect', { x: X(940), y: 30, width: X(1019) - X(940), height: 22, fill: '#5c4210' }));
  const grad = sv('linearGradient', { id: 'co-lev-g', x1: 0, x2: 1, y1: 0, y2: 0 }, sv('stop', { offset: 0, 'stop-color': '#000' }), sv('stop', { offset: 1, 'stop-color': '#fff' }));
  f.append(sv('defs', {}, grad), sv('rect', { x: X(64), y: 30, width: X(940) - X(64), height: 22, fill: 'url(#co-lev-g)', stroke: '#8a949c' }));
  for (const [code, pct, mv, b8] of [[4, '−7 %', '', ''], [64, '0 % noir', '0 mV', '8 bits : 16'], [502, '50 %', '350 mV', ''], [940, '100 % blanc', '700 mV', '8 bits : 235'], [1019, '109 %', '', '']]) {
    f.append(sv('line', { x1: X(code), y1: 28, x2: X(code), y2: 56, stroke: '#e3e7e1' }), sv('text', { x: X(code), y: 68, textAnchor: 'middle', class: 'co-m' }, String(code)), sv('text', { x: X(code), y: 80, textAnchor: 'middle', class: 'co-s' }, pct));
    if (mv) f.append(sv('text', { x: X(code), y: 92, textAnchor: 'middle', class: 'co-s' }, mv));
    if (b8) f.append(sv('text', { x: X(code), y: 104, textAnchor: 'middle', class: 'co-s' }, b8));
  }
  f.append(sv('text', { x: X(34), y: 26, textAnchor: 'middle', class: 'co-s' }, 'sous le noir'), sv('text', { x: X(980), y: 26, textAnchor: 'middle', class: 'co-s' }, 'super-blancs'), sv('text', { x: X(1021), y: 68, textAnchor: 'middle', class: 'co-s' }, 'réservé'));
  return f;
}

// ---------------- formats et cadences : la manipulation ----------------
// Débits calculés sur le raster complet (échantillons totaux par ligne × lignes totales × images × 20 bits pour Y et C en
// 10 bits) : on retrouve exactement 1,485 / 2,97 / 5,94 / 11,88 Gb/s. Le 2160p est transporté en 12G comme quatre
// sous-images 1080p (ST 2082-10) : raster équivalent 5 280 × 2 250.
const FORMATS = {
  '720p': { w: 1280, h: 720, lines: 750, tot: { 25: 3960, 50: 1980 }, name: '720p' },
  '1080i': { w: 1920, h: 1080, lines: 1125, tot: { 25: 2640, 50: 2640 }, name: '1080i', i: true },
  '1080p': { w: 1920, h: 1080, lines: 1125, tot: { 25: 2640, 50: 2640 }, name: '1080p' },
  '2160p': { w: 3840, h: 2160, lines: 2250, tot: { 25: 5280, 50: 5280 }, name: '2160p' },
};
const sdiFor = (gbps) => gbps <= 1.4851 ? 'HD-SDI 1,485 Gb/s (ST 292-1)' : gbps <= 2.9701 ? '3G-SDI 2,97 Gb/s (ST 424)' : gbps <= 5.9401 ? '6G-SDI 5,94 Gb/s (ST 2081-1)' : '12G-SDI 11,88 Gb/s (ST 2082-1), ou 4 × 3G en quad-link';
function demoFormats(host) {
  let fmt = '1080i', rate = 50, bits = 10;
  const read = readout(['Pixels par image', 'Images par seconde', 'Débit utile (image active, 4:2:2)', 'Débit SDI (raster complet, mots de 10 bits)', 'Liaison nécessaire', 'Durée d\'une ligne']);
  const A = canvas(160, 90), B = canvas(160, 90), C = canvas(160, 90);
  const ga = A.getContext('2d'), gb = B.getContext('2d'), gc = C.getContext('2d');
  const calc = () => {
    const F = FORMATS[fmt], fps = F.i ? 25 : rate;
    const util = F.w * F.h * fps * bits * 2 / 1e9, sdi = F.tot[rate] * F.lines * fps * 20 / 1e9;
    read.set('Pixels par image', `${fmtNum(F.w * F.h)} (${fmtNum(F.w)} × ${fmtNum(F.h)})`);
    read.set('Images par seconde', F.i ? `25 images, soit 50 trames de 540 lignes (${fmt}25, dit aussi 1080i50)` : `${fps} images complètes (${F.name}${fps})`);
    read.set('Débit utile (image active, 4:2:2)', `${fmtNum(util, 2)} Gb/s en ${bits} bits`);
    read.set('Débit SDI (raster complet, mots de 10 bits)', `${fmtNum(sdi, 3)} Gb/s (${fmtNum(F.tot[rate])} × ${fmtNum(F.lines)} × ${fps} × 20)`);
    read.set('Liaison nécessaire', sdiFor(sdi));
    read.set('Durée d\'une ligne', `${fmtNum(1e6 / (F.lines * fps), 2)} µs${F.i ? ' (25 images de 1 125 lignes)' : ''}`);
  };
  // le peigne de l'entrelacé : une balle qui avance de 9 points par trame, lignes impaires à t, paires à t + 20 ms
  const LH = 2, R = 20;
  const scene = (g) => { g.fillStyle = '#1e3a14'; g.fillRect(0, 0, 160, 90); g.fillStyle = '#e3e7e1'; g.fillRect(140, 0, 3, 90); };
  const ball = (g, x, parity, color) => { g.fillStyle = color; for (let ly = 0; ly < 90 / LH; ly++) { if (parity && (ly % 2 === 0) !== (parity === 2)) continue; const dy = ly * LH + 1 - 45, half = Math.sqrt(Math.max(0, R * R - dy * dy)); if (half > 0) g.fillRect(Math.round(x - half), ly * LH, Math.round(2 * half), LH); } };
  let n = 0;
  const tick = () => {
    n++; const x = 24 + (n * 9) % 112, xp = 24 + ((n - 1) * 9) % 112;
    scene(ga); ball(ga, x, n % 2 ? 1 : 2, '#ffd38a'); ball(ga, xp, n % 2 ? 2 : 1, '#ffd38a'); // la trame qui vient d'arriver, et l'autre, 20 ms plus vieille
    scene(gb); ball(gb, x, 0, '#ffd38a');
    scene(gc); ball(gc, x, n % 2 ? 1 : 2, '#ffd38a'); ball(gc, xp, n % 2 ? 2 : 1, '#7fd3f3');
  };
  const timer = setInterval(tick, 320);
  host.append(
    el('div', { class: 'co-ctl' },
      choice('Format', [['720p', '720p', '1 280 × 720'], ['1080i', '1080i', '1 920 × 1 080 entrelacé : deux trames par image'], ['1080p', '1080p', '1 920 × 1 080 progressif'], ['2160p', '2160p', '3 840 × 2 160 (UHD)']], fmt, (v) => { fmt = v; calc(); }),
      choice('Cadence', [['25', '25 Hz', '25 images par seconde (en entrelacé : 50 trames)'], ['50', '50 Hz', '50 images par seconde']], String(rate), (v) => { rate = +v; calc(); }),
      choice('Profondeur', [['8', '8 bits'], ['10', '10 bits']], String(bits), (v) => { bits = +v; calc(); })),
    read.el,
    el('p', { class: 'note' }, 'Au ralenti (une trame toutes les 0,32 s au lieu de 20 ms) : en entrelacé, les deux trames d\'une même image ne sont pas prises au même instant ; sur ce qui bouge, les lignes paires et impaires ne coïncident plus (le « peigne »).'),
    el('div', { class: 'co-3' },
      el('figure', {}, A, el('figcaption', {}, '1080i : image reconstituée de deux trames')),
      el('figure', {}, B, el('figcaption', {}, '1080p : chaque image prise d\'un coup')),
      el('figure', {}, C, el('figcaption', {}, 'Les deux trames, colorées : impaire (ambre), paire (cyan)'))));
  calc(); tick();
  return { destroy: () => clearInterval(timer) };
}
function figFormats() {
  const f = figure(420, 150, 'Rasters imbriqués à l\'échelle : 720p (1 280 × 720), 1080 (1 920 × 1 080), 2160p (3 840 × 2 160) ; à droite, une seconde de 1080i (50 trames) et de 1080p50 (50 images)');
  const k = 240 / 3840;
  /** @type {[number, number, string, string][]} */
  const rasters = [[3840, 2160, '2160p · 3 840 × 2 160 · 8,3 Mpx', '#7fd3f3'], [1920, 1080, '1080 · 1 920 × 1 080 · 2,1 Mpx', '#ffd38a'], [1280, 720, '720p · 0,9 Mpx', '#7fd1a0']];
  for (const [w, h, label, col] of rasters) {
    f.append(sv('rect', { x: 10, y: 140 - h * k, width: w * k, height: h * k, fill: 'none', stroke: col, strokeWidth: 1.5 }), sv('text', { x: 14, y: 140 - h * k + 12, class: 'co-s', fill: col }, label));
  }
  const g = sv('g', { transform: 'translate(270 0)' });
  g.append(sv('text', { x: 0, y: 14, class: 'co-t' }, 'Une seconde'));
  g.append(sv('text', { x: 0, y: 36, class: 'co-s' }, '1080i25 : 25 images = 50 trames'));
  for (let i = 0; i < 50; i++) g.append(sv('rect', { x: i * 2.8, y: 42, width: 2, height: 10, fill: i % 2 ? '#7fd3f3' : '#ffd38a' }));
  g.append(sv('text', { x: 0, y: 72, class: 'co-s' }, '1080p50 : 50 images entières'));
  for (let i = 0; i < 50; i++) g.append(sv('rect', { x: i * 2.8, y: 78, width: 2, height: 18, fill: '#ffd38a' }));
  g.append(sv('text', { x: 0, y: 116, class: 'co-s' }, 'HD-SDI 1,485 Gb/s · 3G 2,97 · 6G 5,94 · 12G 11,88'), sv('text', { x: 0, y: 130, class: 'co-s' }, '1080i25, 720p50 → HD · 1080p50 → 3G · 2160p50 → 12G'));
  f.append(g);
  return f;
}

// ---------------- espaces de couleur : la manipulation ----------------
// Diagramme de chromaticité CIE 1931 xy (lieu spectral de 380 à 700 nm, pas de 10 nm) avec les triangles BT.709 et
// BT.2020 et le blanc D65 ; une couleur choisie par sa teinte et sa saturation est placée dans le diagramme et testée
// contre chaque gamut. À côté, les courbes de transfert (OETF) SDR BT.709 et HLG BT.2100 sur la lumière de scène.
const LOCUS = [[0.1741, 0.0050], [0.1738, 0.0049], [0.1733, 0.0048], [0.1726, 0.0048], [0.1714, 0.0051], [0.1689, 0.0069], [0.1644, 0.0109], [0.1566, 0.0177], [0.1440, 0.0297], [0.1241, 0.0578], [0.0913, 0.1327], [0.0454, 0.2950], [0.0082, 0.5384], [0.0139, 0.7502], [0.0743, 0.8338], [0.1547, 0.8059], [0.2296, 0.7543], [0.3016, 0.6923], [0.3731, 0.6245], [0.4441, 0.5547], [0.5125, 0.4866], [0.5752, 0.4242], [0.6270, 0.3725], [0.6658, 0.3340], [0.6915, 0.3083], [0.7079, 0.2920], [0.7190, 0.2809], [0.7260, 0.2740], [0.7300, 0.2700], [0.7320, 0.2680], [0.7334, 0.2666], [0.7344, 0.2656], [0.7347, 0.2653]];
const G709 = [[0.640, 0.330], [0.300, 0.600], [0.150, 0.060]], G2020 = [[0.708, 0.292], [0.170, 0.797], [0.131, 0.046]], D65 = [0.3127, 0.3290];
const polyArea = (p) => Math.abs(p.reduce((a, [x, y], i) => { const [x2, y2] = p[(i + 1) % p.length]; return a + x * y2 - x2 * y; }, 0)) / 2;
// distance le long d'un rayon parti de D65 (angle a) jusqu'au bord d'un polygone convexe
function rayHit(poly, a) {
  const dx = Math.cos(a), dy = Math.sin(a); let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % poly.length], ex = x2 - x1, ey = y2 - y1, den = dx * ey - dy * ex;
    if (Math.abs(den) < 1e-9) continue;
    const t = ((x1 - D65[0]) * ey - (y1 - D65[1]) * ex) / den, u = ((x1 - D65[0]) * dy - (y1 - D65[1]) * dx) / den;
    if (t > 0 && u >= 0 && u <= 1 && t < best) best = t;
  }
  return best;
}
// xy → sRGB approché (luminance ramenée pour que la composante la plus forte soit à 1), pour la pastille
function xyToCss(x, y) {
  const X = x / y, Z = (1 - x - y) / y;
  let r = 3.2406 * X - 1.5372 - 0.4986 * Z, g = -0.9689 * X + 1.8758 + 0.0415 * Z, b = 0.0557 * X - 0.2040 + 1.0570 * Z;
  const m = Math.max(r, g, b); r = Math.max(0, r / m); g = Math.max(0, g / m); b = Math.max(0, b / m);
  const c = (v) => Math.round(Math.pow(v, 1 / 2.2) * 255);
  return `rgb(${c(r)}, ${c(g)}, ${c(b)})`;
}
const CX = (x) => 24 + x * 300, CY = (y) => 262 - y * 290;
function cieDiagram() {
  const f = figure(360, 272, 'Diagramme de chromaticité CIE 1931 : le fer à cheval des couleurs visibles, le triangle BT.709 (HD) et le triangle BT.2020 (UHD, HDR), le blanc D65');
  f.append(sv('path', { d: LOCUS.map(([x, y], i) => `${i ? 'L' : 'M'}${CX(x).toFixed(1)} ${CY(y).toFixed(1)}`).join(' ') + ' Z', fill: '#242e37', stroke: '#8a949c', strokeWidth: 1 }));
  for (const [nm, i] of [[460, 8], [480, 10], [500, 12], [520, 14], [550, 17], [580, 20], [620, 24], [700, 32]]) f.append(sv('text', { x: LOCUS[i][0] > 0.3 || nm === 520 ? CX(LOCUS[i][0]) + 5 : 2, y: CY(LOCUS[i][1]) + (nm === 520 ? 10 : 4), class: 'co-s' }, nm + ' nm'));
  const tri = (p, col, id) => sv('path', { d: p.map(([x, y], i) => `${i ? 'L' : 'M'}${CX(x).toFixed(1)} ${CY(y).toFixed(1)}`).join(' ') + ' Z', fill: 'none', stroke: col, strokeWidth: 1.5, 'data-id': id });
  const t2020 = tri(G2020, '#7fd3f3', '2020'), t709 = tri(G709, '#ffd38a', '709');
  f.append(t2020, t709, sv('circle', { cx: CX(D65[0]), cy: CY(D65[1]), r: 3, fill: '#e3e7e1' }), sv('text', { x: CX(D65[0]) + 6, y: CY(D65[1]) + 12, class: 'co-s' }, 'D65'));
  f.append(sv('text', { x: CX(0.42), y: CY(0.56), class: 'co-s', fill: '#ffd38a' }, 'BT.709'), sv('text', { x: CX(0.30), y: CY(0.78), class: 'co-s', fill: '#7fd3f3' }, 'BT.2020'));
  f.append(sv('text', { x: 26, y: 270, class: 'co-s' }, 'x →'), sv('text', { x: 2, y: 10, class: 'co-s' }, 'y ↑'));
  return Object.assign(f, { t709, t2020 });
}
const oetfSdr = (L) => { const l = Math.min(1, L); return l < 0.018 ? 4.5 * l : 1.099 * Math.pow(l, 0.45) - 0.099; };
const oetfHlg = (E) => E <= 1 / 12 ? Math.sqrt(3 * E) : 0.17883277 * Math.log(12 * E - 0.28466892) + 0.55991073;
const hlgNits = (Ep, peak = 1000) => { const E = Ep <= 0.5 ? Ep * Ep / 3 : (Math.exp((Ep - 0.55991073) / 0.17883277) + 0.28466892) / 12; return peak * Math.pow(E, 1.2); };
const at = (e, k, v) => e.setAttribute(k, String(v));
function demoColor(host) {
  const dia = cieDiagram();
  const pt = sv('circle', { cx: CX(D65[0]), cy: CY(D65[1]), r: 6, fill: '#fff', stroke: '#000', strokeWidth: 1.5 }), ray = sv('line', { x1: CX(D65[0]), y1: CY(D65[1]), x2: CX(D65[0]), y2: CY(D65[1]), stroke: '#e3e7e1', 'stroke-dasharray': '3 3' });
  const swatch = sv('rect', { x: 240, y: 8, width: 50, height: 34, rx: 3, fill: '#fff', stroke: '#8a949c' });
  dia.append(ray, pt, swatch, sv('text', { x: 265, y: 54, textAnchor: 'middle', class: 'co-s' }, 'couleur (approchée)'));
  const curve = canvas(300, 212, 'co-canvas co-smooth');
  const g = curve.getContext('2d');
  let sys = 'sdr', hue = 95, sat = 45, light = 1;
  const read = readout(['Chromaticité (x ; y)', 'Gamut', 'Signal SDR BT.709', 'Signal HLG BT.2100', 'Sur un écran HLG de 1 000 cd/m²']);
  const area = polyArea(LOCUS);
  const redraw = () => {
    const a = hue * Math.PI / 180, tl = rayHit(LOCUS, a), t7 = rayHit(G709, a), t20 = rayHit(G2020, a), t = tl * sat / 100;
    const x = D65[0] + Math.cos(a) * t, y = D65[1] + Math.sin(a) * t;
    at(pt, 'cx', CX(x)); at(pt, 'cy', CY(y)); at(ray, 'x2', CX(D65[0] + Math.cos(a) * tl)); at(ray, 'y2', CY(D65[1] + Math.sin(a) * tl));
    at(pt, 'fill', xyToCss(x, y)); at(swatch, 'fill', xyToCss(x, y));
    at(dia.t709, 'stroke-width', sys === 'sdr' ? 3 : 1.5); at(dia.t2020, 'stroke-width', sys === 'hlg' ? 3 : 1.5);
    read.set('Chromaticité (x ; y)', `${fmtNum(x, 3)} ; ${fmtNum(y, 3)}`);
    read.set('Gamut', t <= t7 ? 'dans BT.709 : reproductible en HD comme en UHD' : t <= t20 ? 'hors BT.709, dans BT.2020 : en SDR cette couleur est écrêtée (désaturée)' : 'hors des deux triangles : aucun écran ne l\'affiche telle quelle');
    const vs = oetfSdr(light), vh = oetfHlg(light / 12);
    read.set('Signal SDR BT.709', `${fmtNum(vs * 100, 1)} %${light > 1 ? ' : écrêté (sans knee, tout ce qui dépasse × 1 est perdu)' : ''}`);
    read.set('Signal HLG BT.2100', `${fmtNum(vh * 100, 1)} %${Math.abs(light - 1) < 0.06 ? ' (ce qui sature le SDR n\'est qu\'à mi-échelle)' : Math.abs(vh - 0.75) < 0.012 ? ' (blanc de référence BT.2408)' : ''}`);
    read.set('Sur un écran HLG de 1 000 cd/m²', `${fmtNum(hlgNits(vh), 0)} cd/m²`);
    // les courbes
    g.fillStyle = '#0b1013'; g.fillRect(0, 0, 300, 212);
    const X = (L) => 34 + L / 12 * 258, Y = (v) => 184 - v * 168;
    g.strokeStyle = '#424c56'; g.lineWidth = 1; g.fillStyle = '#aab4ba'; g.font = '10px Arial, sans-serif';
    for (const v of [0, 0.25, 0.5, 0.75, 1]) { g.beginPath(); g.moveTo(34, Y(v) + 0.5); g.lineTo(292, Y(v) + 0.5); g.stroke(); g.fillText(`${v * 100}`, 6, Y(v) + 4); }
    for (const L of [1, 4, 8, 12]) { g.beginPath(); g.moveTo(X(L) + 0.5, 16); g.lineTo(X(L) + 0.5, 184); g.stroke(); g.fillText(`× ${L}`, X(L) - (L > 9 ? 16 : 8), 195); }
    g.fillText('signal %', 2, 10); g.fillText('lumière de scène (× 1 : ce qui sature une caméra SDR)', 40, 209);
    const plot = (fn, col, w) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); for (let i = 0; i <= 258; i++) { const L = i / 258 * 12; g[i ? 'lineTo' : 'moveTo'](X(L), Y(fn(L))); } g.stroke(); };
    plot((L) => oetfSdr(L), '#ffd38a', sys === 'sdr' ? 2.5 : 1); plot((L) => oetfHlg(L / 12), '#7fd3f3', sys === 'hlg' ? 2.5 : 1);
    g.fillStyle = '#ffd38a'; g.fillText('SDR BT.709 : écrête à × 1', X(5), Y(1) + 14); g.fillStyle = '#7fd3f3'; g.fillText('HLG : 75 % = blanc de référence', X(4.3), Y(0.75) + 14);
    g.strokeStyle = '#e3e7e1'; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(X(light) + 0.5, 16); g.lineTo(X(light) + 0.5, 184); g.stroke(); g.setLineDash([]);
    g.fillStyle = '#e3e7e1'; g.beginPath(); g.arc(X(light), Y(sys === 'sdr' ? vs : vh), 4, 0, 7); g.fill();
  };
  host.append(
    el('div', { class: 'co-ctl' },
      choice('Système', [['sdr', 'SDR · BT.709 (HD)', 'Gamut BT.709, courbe BT.709 : la HD classique'], ['hlg', 'HDR HLG · BT.2020 (UHD)', 'Gamut BT.2020, courbe HLG BT.2100 : l\'UHD HDR du car']], sys, (v) => { sys = v; redraw(); }),
      slider('Teinte', 0, 359, hue, 1, (v) => { hue = v; redraw(); }, (v) => v + '°'),
      slider('Saturation', 0, 100, sat, 1, (v) => { sat = v; redraw(); }, (v) => v + ' %'),
      slider('Lumière de scène', 0, 12, light, 0.1, (v) => { light = v; redraw(); }, (v) => '× ' + fmtNum(v, 1))),
    el('div', { class: 'co-3 co-2' },
      el('figure', {}, dia, el('figcaption', {}, `Diagramme xy : BT.709 couvre ≈ ${fmtNum(polyArea(G709) / area * 100)} % du fer à cheval, BT.2020 ≈ ${fmtNum(polyArea(G2020) / area * 100)} %`)),
      el('figure', {}, curve, el('figcaption', {}, 'Courbes de transfert (OETF) : la lumière de la scène devient un pourcentage de signal'))),
    read.el);
  redraw();
}

registerChapter({
  id: 'signal', title: 'Le signal vidéo numérique', icon: 'vision',
  intro: 'Ce qu\'il y a dans une image numérique avant toute interface : des échantillons, des bits, des niveaux, un format, et ce qu\'en garde la compression. Tout le reste du car en dépend.',
  lessons: [
    {
      id: 'signal-422', title: 'L\'échantillonnage 4:2:2', minutes: '6 min',
      essentials: [
        'Une image numérique sépare la **luminance** (Y, la netteté) de la **couleur** (Cb et Cr).',
        'L\'œil voit mal les détails de couleur : on peut garder un échantillon de couleur sur deux (4:2:2) sans perte visible.',
        'Le car travaille en 4:2:2 10 bits ; la diffusion vers le public est en 4:2:0.',
      ],
      figure: fig422,
      demoTitle: 'Passez l\'image en 4:2:2 puis en 4:2:0 et regardez à la loupe les lignes fines et le texte rouge.',
      demo: demo422,
      body: `La caméra capte du rouge, du vert et du bleu. Avant le transport, on calcule pour chaque pixel une **luminance** Y (le noir et blanc, qui porte la netteté) et deux **différences de couleur**, Cb (bleu moins Y) et Cr (rouge moins Y). C'est le **YCbCr**.

La notation **4:2:2** compte les échantillons sur quatre pixels d'une ligne : 4 de luminance, 2 de Cb, 2 de Cr. En **4:4:4**, la couleur est sur chaque pixel ; en **4:2:0**, elle est aussi divisée par deux d'une ligne à l'autre. Comme l'œil distingue bien moins les détails de couleur que ceux de lumière, le 4:2:2 n'enlève rien de visible sur une image naturelle : regardez la loupe sur la pelouse et les maillots, puis sur le texte rouge fin, le seul endroit où la couleur « bave ».

Pourquoi le car reste en 4:2:2 : l'image va être **incrustée** (chroma key du plateau virtuel, bandeaux), **ralentie**, **corrigée** ; chaque traitement a besoin de couleur précise sur les contours. Le SDI du car transporte donc du 4:2:2 10 bits (ST 292 en HD, ST 424 en 3G). En sortie, le codeur de diffusion passe en 4:2:0 8 ou 10 bits : moitié moins de données de couleur, invisible au public.

- 4:4:4 : 1 920 × 1 080 × 50 images × 30 bits = 3,11 Gb/s.
- 4:2:2 : 2,07 Gb/s (deux tiers), c'est le 3G-SDI à 2,97 Gb/s une fois la suppression et les données ajoutées.
- 4:2:0 : 1,56 Gb/s (la moitié), avant compression H.264 ou HEVC.`,
      car: { text: 'Au poste vision, le PRISM affiche le waveform en YCbCr : la trace Y d\'un côté, Cb et Cr de l\'autre. La baie de mesure donne le format exact du signal (4:2:2 10 bits, 3G-SDI).', station: 'vision' },
      terms: ['ycbcr', 'waveform', 'vpid'],
      competences: ['1.4', '2.2'], article: 'formats',
      quiz: [
        { q: 'En 4:2:2, combien d\'échantillons de couleur Cb pour 4 pixels d\'une ligne ?', choices: ['4', '2', '1'], answer: 1, why: '4:2:2 se lit « 4 Y, 2 Cb, 2 Cr » sur quatre pixels : la couleur est portée par un pixel sur deux. 4 serait du 4:4:4 ; 1 par ligne et par colonne, du 4:2:0.' },
        { q: 'Pourquoi le car garde-t-il du 4:2:2 alors que le public reçoit du 4:2:0 ?', choices: ['Parce que le SDI ne sait pas transporter du 4:2:0', 'Parce que les incrustations, ralentis et corrections ont besoin de couleur précise sur les contours', 'Parce que le 4:2:0 est de moins bonne qualité en luminance'], answer: 1, why: 'La luminance est identique dans les trois cas : c\'est la couleur qui est réduite. Les traitements du car (chroma key, habillage, étalonnage) exigent une couleur fine ; en bout de chaîne, le 4:2:0 suffit à l\'œil.' },
        { q: 'Où voit-on une différence entre 4:4:4 et 4:2:2 à la loupe ?', choices: ['Sur la pelouse uniforme', 'Sur les détails de couleur fins : texte rouge, lignes colorées', 'Sur les blancs du maillot'], answer: 1, why: 'Seuls les détails de couleur plus petits que deux pixels sont touchés : le texte rouge sur fond bleu « bave » un peu. La pelouse et les blancs ne changent pas, la luminance étant intacte.' },
        { q: 'En 1080p50 10 bits, l\'image active pèse 3,11 Gb/s en 4:4:4. Combien pèse-t-elle en 4:2:2, comme dans le car ?', choices: [['1,56 Gb/s', 'C\'est le 4:2:0 : la couleur y est aussi divisée par deux d\'une ligne à l\'autre, ce qui donne la moitié du 4:4:4.'], '2,07 Gb/s', ['2,97 Gb/s', 'C\'est le débit du 3G-SDI qui transporte ce signal : la suppression et les données s\'ajoutent à l\'image active.']], answer: 1, why: 'Sur quatre pixels, le 4:4:4 compte 12 échantillons (4 Y, 4 Cb, 4 Cr) ; le 4:2:2 n\'en garde que 8 (4 Y, 2 Cb, 2 Cr), soit les deux tiers. 3,11 × 2/3 ≈ 2,07 Gb/s, sans perte visible sur une image naturelle.' },
        { q: 'Au poste vision, le PRISM affiche en YCbCr une mire en noir et blanc, sans aucune couleur. Que montrent les traces Cb et Cr ?', choices: [['La même forme que la trace Y', 'Cb et Cr ne portent pas la lumière : ils portent l\'écart entre le bleu (ou le rouge) et Y. Sur du gris, cet écart est nul.'], ['Rien : Cb et Cr ne sont plus transportés', 'Le 4:2:2 fixe le nombre d\'échantillons de couleur, quelle que soit l\'image : ils sont toujours là, ils valent simplement zéro.'], 'Des traces plates, à zéro : sur du gris, bleu moins Y et rouge moins Y sont nuls'], answer: 2, why: 'Cb vaut bleu moins Y, Cr rouge moins Y. Dans un gris, le rouge, le vert et le bleu sont égaux à la luminance : les deux différences s\'annulent, et toute l\'image est portée par Y.' },
      ],
    },
    {
      id: 'signal-bits', title: '8 ou 10 bits : la quantification', minutes: '6 min',
      essentials: [
        'Chaque échantillon est arrondi à un niveau parmi 2 puissance n : **256** niveaux en 8 bits, **1 024** en 10 bits.',
        'Trop peu de niveaux et un dégradé devient des **bandes** ; le dithering les remplace par un grain fin.',
        'Le car travaille en **10 bits** (étalonnage, HDR, incrustation) ; la diffusion au public se contente de 8 bits.',
      ],
      figure: figBits,
      demoTitle: 'Descendez à 6 puis 4 bits et regardez le ciel ; revenez à 8 bits et comparez la vue étalonnée à celle du 10 bits.',
      demo: demoBits,
      body: `Après l'échantillonnage (où ?), vient la **quantification** (combien ?) : la valeur de chaque échantillon est arrondie au niveau le plus proche d'une échelle à **2 puissance n** barreaux. En 8 bits, 256 niveaux par composante, un pas de 0,39 % du blanc ; en 10 bits, 1 024 niveaux, un pas de 0,098 %, quatre fois plus fin. La différence entre la valeur vraie et le niveau retenu est l'**erreur de quantification** : au plus un demi-pas.

Dans un dégradé lent (un ciel, un mur éclairé en biais, un fond de plateau), cette erreur se voit : au lieu d'une pente continue, des **bandes** à bords nets, chacune large de quelques lignes. À 8 bits, les bandes sont juste sous le seuil de l'œil sur une image bien exposée ; à 6 bits, elles sautent aux yeux (c'est ce que fait la manipulation). Le **dithering** ajoute un bruit d'un pas avant l'arrondi : l'erreur devient un grain aléatoire, invisible de loin, à la place des marches.

Pourquoi le car est en 10 bits alors que l'écran du spectateur n'en affiche que 8 : parce que le signal va être **travaillé**. L'étalonnage étire des zones de l'image (remonter une pelouse à l'ombre, densifier un ciel) : des marches de 8 bits étirées cinq fois deviennent des marches de 5 codes, visibles ; celles du 10 bits restent sous le pas de l'écran. L'**incrustation** calcule une clé sur de faibles différences de couleur : en 8 bits, elle « crénèle ». La **HDR** répartit une plage de lumière dix fois plus grande sur la même échelle : en 8 bits, les bandes réapparaissent dans les hautes lumières ; le HLG et le PQ (BT.2100) exigent 10 bits au minimum.

Le SDI transporte des mots de 10 bits (ST 292-1, ST 424, ST 2082) ; une source 8 bits y voyage avec ses deux bits de poids faible à zéro. En sortie du car, le codeur de diffusion repasse souvent en 8 bits 4:2:0 pour le H.264 ; le HEVC des chaînes UHD garde 10 bits (profil Main 10).

- 8 bits : 256 niveaux, pas 0,39 % ; 16,7 millions de couleurs.
- 10 bits : 1 024 niveaux, pas 0,098 % ; 1,07 milliard de couleurs.
- 12 bits : 4 096 niveaux ; caméras cinéma, fichiers RAW et intermédiaires de post-production.`,
      car: { text: 'À la baie de mesure, l\'État SDI du PRISM lit l\'identifiant de charge utile (ST 352) : « 4:2:2 10 bits ». Au poste vision, c\'est en 10 bits que l\'ingénieur vision joue sur le master black et le gain sans faire apparaître de bandes dans le ciel du stade.', station: 'mesure' },
      terms: ['vpid', 'waveform', 'hdr-hlg'],
      competences: ['1.4', '2.2'], article: 'mesures',
      quiz: [
        { q: 'Combien de niveaux par composante en 10 bits ?', choices: ['256', '1 000', '1 024'], answer: 2, why: '2 puissance 10 = 1 024, soit quatre fois les 256 niveaux du 8 bits. « 1 000 » est l\'approximation à éviter : les codes vont de 0 à 1 023, et le noir vidéo est au code 64, le blanc à 940.' },
        { q: 'Dans quelle image les bandes de quantification se voient-elles d\'abord ?', choices: ['Un dégradé lent (ciel, mur éclairé en biais)', 'Une pelouse bien exposée et texturée', 'Un texte blanc sur fond noir'], answer: 0, why: 'Les marches ne sont visibles que là où le niveau varie lentement sur une grande surface. La texture de la pelouse et les contrastes forts masquent l\'erreur de quantification, qui ne fait qu\'un demi-pas.' },
        { q: 'Pourquoi le car travaille-t-il en 10 bits si le public reçoit du 8 bits ?', choices: ['Parce que le SDI ne sait pas transporter du 8 bits', 'Parce que l\'étalonnage, l\'incrustation et la HDR étirent le signal et révéleraient les marches du 8 bits', 'Parce que le 10 bits double la netteté'], answer: 1, why: 'La netteté dépend du nombre de pixels, pas des bits. Les traitements du car étirent des portions de l\'échelle : les marches du 8 bits deviendraient visibles. Le SDI transporte d\'ailleurs toujours des mots de 10 bits.' },
        { q: 'Un dégradé de ciel est quantifié en 8 bits. Au pire, de combien un point s\'écarte-t-il de sa valeur vraie ?', choices: ['D\'un demi-pas : environ 0,2 % du blanc', ['D\'un pas entier : 0,39 % du blanc', 'L\'arrondi se fait au niveau le plus proche : la valeur vraie n\'est jamais à plus de la moitié de l\'écart entre deux niveaux.'], ['D\'environ 0,05 % du blanc', 'C\'est le demi-pas du 10 bits (0,098 % ÷ 2), quatre fois plus fin que celui du 8 bits.']], answer: 0, why: 'En 8 bits, le pas vaut 0,39 % du blanc. L\'erreur de quantification est au plus d\'un demi-pas, soit environ 0,2 % : c\'est elle qui dessine les bandes dans un dégradé lent.' },
        { q: 'Une source 8 bits entre dans le SDI 10 bits du car, et l\'ingénieur vision va étirer son ciel à l\'étalonnage. Que gagne-t-elle au passage en 10 bits ?', choices: [['Les 1 024 niveaux du 10 bits, recalculés par le SDI', 'Le SDI transporte des mots de 10 bits, mais il n\'invente pas de niveaux : la source n\'utilise qu\'un code sur quatre.'], ['Un dithering automatique qui efface les bandes', 'Le dithering s\'ajoute avant l\'arrondi, au moment de quantifier ; le transport ne fait que porter les codes reçus.'], 'Rien : ses deux bits de poids faible sont à zéro, ses marches restent celles du 8 bits'], answer: 2, why: 'Une source 8 bits voyage dans le SDI avec ses deux bits de poids faible à zéro : elle garde ses 256 niveaux, un code sur quatre de l\'échelle 10 bits. Étirées par l\'étalonnage, ses marches deviennent visibles : le 10 bits ne sert que s\'il existe dès la quantification.' },
      ],
    },
    {
      id: 'signal-niveaux', title: 'Niveaux : 0–100 %, noir à 64, blanc à 940', minutes: '7 min',
      essentials: [
        'Le noir vidéo est au code **64** et le blanc à **940** en 10 bits (16 et 235 en 8 bits) : la plage **légale**, dite 0 à 100 %.',
        'Le SDI porte aussi de 4 à 1 019 (−7 à 109 %) : des **super-blancs** et des **sous-noirs** que la diffusion n\'accepte pas.',
        'Le **waveform** montre le niveau de chaque point : ce qui dépasse 100 % est écrêté, ce qui passe sous 0 % est perdu dans le noir.',
      ],
      figure: figLevels,
      demoTitle: 'Montez le gain à 120 % : les blancs s\'empilent sur la ligne des 100 %. Baissez le piédestal : le short disparaît sous le noir. Comparez sortie brute et légalisée.',
      demo: demoLevels,
      body: `Les codes ne sont pas utilisés de 0 à 1 023. Les normes de studio (ITU-R BT.601 puis BT.709) placent le **noir au code 64** et le **blanc au code 940** en 10 bits, soit 16 et 235 en 8 bits : c'est la plage **narrow range**, ou plage légale, que l'on exprime de 0 à 100 % (ou de 0 à 700 mV, l'héritage de l'analogique). Les codes 0 à 3 et 1 020 à 1 023 sont réservés aux mots de synchronisation du SDI (EAV, SAV) et ne doivent jamais apparaître dans l'image.

Entre les deux restent deux marges : de 4 à 63, les **sous-noirs** (jusqu'à −7 %) ; de 941 à 1 019, les **super-blancs** (jusqu'à 109 %). Une caméra peut y envoyer un reflet, un projecteur, un drapeau blanc en plein soleil : le signal est transporté sans dommage, mais il n'est pas **légal**. Le diffuseur (EBU R 103) tolère environ 103 % en luminance et de −5 à 105 % sur les composantes R, V, B ; au-delà, un **légaliseur** écrête, et le détail des blancs disparaît d'un coup. C'est la ligne rouge du waveform.

Le **gain** multiplie le signal : il déplace les blancs vers 100 % et au-delà ; le **piédestal** (master black) ajoute ou retire une constante : il pose les noirs. Les deux réglages du RCP de l'ingénieur vision sont là pour tenir l'image entre les deux lignes : noirs posés entre 0 et 2 %, blancs juste sous 100 %, la pelouse de jour vers 40 à 55 %. Ce que l'écran montre comme « blanc » ne dit rien : un blanc à 95 % et un blanc à 108 % se ressemblent sur un moniteur ; seul le waveform fait la différence.

Pourquoi un waveform : parce que l'œil s'adapte et se trompe, pas l'instrument. Il superpose toutes les lignes de l'image, chaque point à sa colonne et à la hauteur de son niveau : un trait horizontal plat en haut, ce sont des blancs écrêtés ; une trace qui plonge sous la ligne du zéro, des noirs enfoncés. En HDR HLG, les repères changent : le blanc de référence se pose vers 75 % (BT.2408), et il n'y a plus d'écrêtage à craindre avant 100 %.

- Full range (informatique, certains fichiers) : noir à 0, blanc à 1 023. Une confusion full / narrow donne des noirs gris et des blancs ternes, ou l'inverse : contrastes bouchés.
- Le rouge, le vert et le bleu peuvent dépasser alors que la luminance est légale : c'est le rôle du diamant et du gamut.`,
      car: { text: 'Au poste vision, le waveform du PRISM lit l\'image de la caméra sélectionnée ; les réglages de gain et de master black du RCP se voient tout de suite sur la trace, avec la ligne des 100 % et celle du zéro. La baie de mesure donne le même waveform sur n\'importe quel point de la grille.', station: 'vision' },
      terms: ['waveform', 'gamut', 'mire-75', 'parade-rvb'],
      competences: ['1.4', '2.2'], article: 'mesures',
      quiz: [
        { q: 'À quel code 10 bits se trouve le blanc 100 % ?', choices: ['1 023', '940', '700'], answer: 1, why: 'Le blanc légal est au code 940 (235 en 8 bits), le noir au code 64. 1 023 est le haut de l\'échelle, réservé ; 700 est la valeur en millivolts, pas en code.' },
        { q: 'Que montre un trait horizontal plat sur la ligne des 100 % du waveform ?', choices: ['Une image bien exposée', 'Des blancs écrêtés : le détail est perdu', 'Un défaut du câble SDI'], answer: 1, why: 'Tous les points plus clairs que 100 % ont été ramenés au même niveau : plus de relief dans les blancs (maillot, ciel). Un câble en défaut donne des erreurs CRC et des éclats, pas un trait plat.' },
        { q: 'Un signal à 106 % dans le SDI est…', choices: ['Impossible : le SDI s\'arrête à 100 %', 'Transporté sans dommage, mais hors plage légale : il sera écrêté avant diffusion', 'Automatiquement corrigé par la grille'], answer: 1, why: 'Le SDI porte jusqu\'à 109 % (code 1 019). Mais le diffuseur n\'accepte qu\'environ 103 % : le légaliseur écrêtera. Une grille ne touche jamais aux niveaux : elle ne fait que commuter.' },
        { q: 'Au poste vision, le waveform montre les noirs de la caméra 3 vers 8 %, quand les autres caméras les posent à 1 %. Quel réglage du RCP faut-il reprendre ?', choices: [['Le gain', 'Le gain multiplie le signal : il déplace surtout les blancs, et à peine un noir proche de zéro.'], 'Le piédestal (master black), à baisser', ['Aucun : la sortie légalisée ramènera les noirs à 0 %', 'Le légaliseur n\'écrête qu\'en dehors de la plage légale ; des noirs à 8 % sont légaux, simplement trop hauts.']], answer: 1, why: 'Le piédestal ajoute ou retire une constante à tout le signal : c\'est lui qui pose les noirs, entre 0 et 2 %. Le baisser d\'environ 7 % ramène la caméra 3 au niveau des autres ; ses blancs descendent d\'autant, on les vérifie ensuite.' },
        { q: 'Un clip enregistré en plage légale (noir 64, blanc 940) est lu par un lecteur réglé en full range (noir 0, blanc 1 023). Que voit-on ?', choices: ['Des noirs gris et des blancs ternes', ['Des noirs enfoncés et des blancs écrêtés', 'C\'est l\'erreur inverse : un signal full range lu comme narrow range, dont les codes passent sous 64 et au-dessus de 940.'], ['Rien de changé : seuls les codes réservés sont concernés', 'Les codes réservés (0 à 3, 1 020 à 1 023) servent à la synchronisation du SDI ; ici, c\'est toute l\'échelle qui est mal lue.']], answer: 0, why: 'Le lecteur attend le noir au code 0 : le code 64 lui paraît un gris foncé. Il attend le blanc à 1 023 : le code 940 reste en dessous, terne. Le contraste de l\'image est écrasé.' },
      ],
    },
    {
      id: 'signal-formats', title: '1080i, 1080p, 2160p : formats et cadences', minutes: '7 min',
      essentials: [
        'Un format, c\'est des lignes (720, 1080, 2160), un balayage (**i** entrelacé ou **p** progressif) et une cadence (25 ou 50 Hz en Europe).',
        'En **1080i25**, chaque image est faite de deux **trames** prises à 20 ms d\'écart ; en **1080p50**, 50 images entières par seconde.',
        'Le débit suit : 1080i et 720p tiennent en **HD-SDI** (1,485 Gb/s), le 1080p50 demande le **3G** (2,97), le 2160p50 le **12G** (11,88).',
      ],
      figure: figFormats,
      demoTitle: 'Passez de 1080i à 1080p puis à 2160p et lisez la liaison nécessaire ; regardez le peigne de l\'entrelacé sur la balle qui bouge.',
      demo: demoFormats,
      body: `Le nom d'un format se lit en trois parties : **1080** lignes actives, **i** ou **p**, puis la cadence. Le **p** (progressif) saisit l'image entière d'un coup, 25 ou 50 fois par seconde. Le **i** (entrelacé) la découpe en deux **trames**, les lignes impaires puis les lignes paires, prises à 20 ms d'écart : 50 trames par seconde pour 25 images. On écrit 1080i25 (25 images) ou 1080i50 (50 trames) pour la même chose, d'où bien des confusions. Le 720p50 est l'autre format HD historique : moins de lignes, mais des images entières.

L'entrelacé est un héritage de la télévision analogique : deux fois moins de données qu'un progressif de même cadence, pour une fluidité équivalente. Son défaut se voit dès qu'on fige l'image ou qu'on la retravaille : les deux trames ne montrent pas le même instant, et un objet en mouvement se dédouble en **peigne** (la manipulation le montre au ralenti). Ralentis, incrustations, redimensionnements et compression doivent d'abord **désentrelacer**, en perdant un peu. C'est pourquoi la production sportive est passée au **1080p50**, puis au **2160p50** : une image entière, nette, 50 fois par seconde. La diffusion hertzienne, elle, reste souvent en 1080i25.

Le débit se calcule sur le **raster complet**, suppression comprise : en 1080, 2 640 échantillons par ligne sur 1 125 lignes (pour 1 920 × 1 080 actifs) ; chaque pixel vaut 20 bits en 4:2:2 10 bits (un mot de luminance, un demi-mot de chaque couleur). 2 640 × 1 125 × 25 × 20 = 1,485 Gb/s : le **HD-SDI** (ST 292-1). À 50 images, le double : 2,97 Gb/s, le **3G-SDI** (ST 424). Le 2160p en 12G (ST 2082-10) est transporté comme quatre sous-images 1080p : 11,88 Gb/s. Avant le 12G, l'UHD circulait sur quatre câbles 3G (quad-link).

Les cadences : l'Europe est à 25 et 50 Hz, les Amériques et le Japon à 29,97 et 59,94 Hz (les 1 000/1 001 hérités de la couleur NTSC). Un car qui produit à 50 Hz pour un match diffusé en Amérique passe par un **convertisseur de normes**. Les ralentis, eux, tournent des caméras à 150 ou 300 images par seconde (3× et 6×) qui sortent sur plusieurs liaisons 3G.

- 720p50 : 1 980 × 750 × 50 × 20 = 1,485 Gb/s (HD-SDI).
- 1080i25 et 1080p25 : 1,485 Gb/s (HD-SDI). 1080p50 : 2,97 Gb/s (3G).
- 2160p25 : 5,94 Gb/s (6G). 2160p50 : 11,88 Gb/s (12G, ou 4 × 3G).`,
      car: { text: 'La grille Videohub du car commute du 3G-SDI en 1080p50 et du 12G-SDI en UHD. À la baie de mesure, l\'État SDI donne le format exact de chaque source (identifiant ST 352) et la tuile Timing la durée d\'une ligne : 17,8 µs en 1080p50, 35,6 µs en 1080i.', station: 'grille' },
      terms: ['12g-sdi', 'vpid', 'timing-ref'],
      competences: ['1.4', '2.10'], article: 'formats',
      quiz: [
        { q: 'Combien de trames par seconde en 1080i25 ?', choices: ['25', '50', '100'], answer: 1, why: 'Une image entrelacée = deux trames (lignes impaires, lignes paires) prises à 20 ms d\'écart : 25 images font 50 trames. On dit aussi « 1080i50 » pour la même chose.' },
        { q: 'Quelle liaison SDI pour du 1080p50 4:2:2 10 bits ?', choices: ['HD-SDI (1,485 Gb/s)', '3G-SDI (2,97 Gb/s)', '12G-SDI (11,88 Gb/s)'], answer: 1, why: '1080p50 vaut 2 640 × 1 125 × 50 × 20 bits = 2,97 Gb/s : le 3G. Le HD-SDI porte le 1080i25 et le 720p50 (moitié moins) ; le 12G est celui du 2160p50.' },
        { q: 'Pourquoi le peigne apparaît-il sur une image entrelacée figée ?', choices: ['Parce que les deux trames ont été prises à des instants différents', 'Parce que le 1080i a moins de lignes', 'Parce que le câble est trop long'], answer: 0, why: 'Les lignes impaires et paires sont saisies à 20 ms d\'écart : ce qui bouge n\'est pas au même endroit dans les deux trames. Le 1080i a autant de lignes que le 1080p ; un câble trop long donne des erreurs, pas un peigne.' },
        { q: 'Une caméra ralenti tourne en 1080p à 150 images par seconde (3×). Combien de liaisons 3G-SDI faut-il pour sortir toutes ses images ?', choices: [['Une seule', 'Une liaison 3G porte 50 images 1080p par seconde (2,97 Gb/s) : à 150 images, le débit triple.'], ['Six', 'Ce serait en HD-SDI à 1,485 Gb/s, ou pour un ralenti 6× à 300 images par seconde.'], 'Trois'], answer: 2, why: 'Le 1080p50 remplit exactement un 3G : 2 640 × 1 125 × 50 × 20 = 2,97 Gb/s. À 150 images par seconde, trois fois plus de données, 8,91 Gb/s : trois liaisons 3G.' },
        { q: 'À la baie de mesure, la tuile Timing donne une ligne de 35,6 µs pour une source annoncée en 1080p50. Qu\'en conclure ?', choices: ['Elle est à 25 images par seconde (du 1080i, par exemple), pas en 1080p50', ['Rien d\'anormal : c\'est la ligne du 1080p50', 'En 1080p50, 1 125 lignes × 50 images par seconde laissent 17,8 µs par ligne, deux fois moins.'], ['Elle est en 2160p50 : plus de lignes, donc des lignes plus longues', 'C\'est l\'inverse : plus il passe de lignes par seconde, plus chacune est courte.']], answer: 0, why: 'Une ligne dure une seconde divisée par le nombre de lignes par seconde. Avec 1 125 lignes par image : 17,8 µs à 50 images par seconde, 35,6 µs à 25. La source n\'est pas au format annoncé ; l\'État SDI dira lequel.' },
      ],
    },
    {
      id: 'signal-couleur', title: 'Espaces de couleur : BT.709, BT.2020, HDR', minutes: '8 min',
      essentials: [
        'Un **espace de couleur** fixe trois primaires (le triangle des couleurs reproductibles, le **gamut**), un blanc (D65) et une **courbe de transfert**.',
        '**BT.709** est la HD ; **BT.2020** (UHD) a un triangle bien plus large ; la **HDR** (HLG ou PQ, BT.2100) change la courbe pour garder les hautes lumières.',
        'Le car sort les deux versions, **HDR** et **SDR** : convertir l\'une en l\'autre demande de rabattre les couleurs et les lumières hors du petit triangle.',
      ],
      figure: cieDiagram,
      demoTitle: 'Poussez la saturation jusqu\'à sortir du triangle BT.709 ; passez en HLG et montez la lumière de scène au-delà de × 1 : le SDR écrête, le HLG continue.',
      demo: demoColor,
      body: `Trois nombres R, V, B ne veulent rien dire tant qu'on n'a pas dit **quel** rouge, **quel** vert, **quel** bleu : ce sont les **primaires**. Portées sur le diagramme de chromaticité CIE 1931 (le fer à cheval de toutes les couleurs visibles, sans leur luminance), elles forment un triangle : tout ce qui est dedans est reproductible, tout ce qui est dehors ne l'est pas. C'est le **gamut**. La HD (**BT.709**) couvre à peu près le tiers du fer à cheval ; l'UHD (**BT.2020**) en couvre les deux tiers, avec un vert et un rouge presque monochromatiques qu'aucun écran grand public n'atteint encore tout à fait. Les deux ont le même blanc, le **D65** (6 500 K).

La deuxième moitié d'un espace de couleur est la **courbe de transfert** (OETF), qui transforme la lumière de la scène en pourcentage de signal. La courbe SDR de la BT.709 est une racine (exposant 0,45) qui atteint 100 % pour une lumière de référence et **écrête** tout ce qui dépasse : le ciel, les projecteurs, un maillot blanc au soleil deviennent un aplat. La **HDR** (BT.2100) garde ces hautes lumières : la courbe **HLG** (Hybrid Log-Gamma) est une racine pour les basses lumières et un logarithme au-dessus, de sorte que la lumière qui saturait le SDR n'est qu'à 50 % du signal et qu'il reste douze fois plus de lumière à coder au-dessus. Le **PQ** (ST 2084), l'autre courbe HDR, code une luminance d'écran absolue jusqu'à 10 000 cd/m² ; le direct préfère le HLG, relatif, qui s'affiche passablement même sur un écran SDR.

Les repères du HLG en direct (rapport BT.2408) : le **blanc de référence** (graphismes, un papier blanc bien éclairé) à **75 %**, soit 203 cd/m² sur un écran de 1 000 cd/m² ; le gris à 18 % vers 38 %. Le reste de l'échelle, de 75 à 100 %, est pour les reflets et les sources de lumière.

Pourquoi le car sort HDR **et** SDR : le diffuseur UHD reçoit du HLG BT.2020, les chaînes HD et les réseaux reçoivent du BT.709 SDR. On produit en HLG BT.2020 et un convertisseur en déduit la version SDR : il rabat la courbe (**tone mapping**) et ramène les couleurs hors du triangle 709 vers son bord (**gamut mapping**) ; un rouge de maillot très saturé y perd un peu. L'inverse, monter du SDR vers le HDR pour une source extérieure, demande d'inventer des hautes lumières qui n'existent pas : à faire avec prudence. L'ingénieur vision règle souvent sur la sortie SDR, la HDR suit (production « single stream »).

- BT.709 : primaires R (0,640 ; 0,330), V (0,300 ; 0,600), B (0,150 ; 0,060), courbe gamma 0,45, 8 ou 10 bits.
- BT.2020 : R (0,708 ; 0,292), V (0,170 ; 0,797), B (0,131 ; 0,046), 10 ou 12 bits.
- BT.2100 : primaires BT.2020, courbes HLG ou PQ, 10 bits au minimum.`,
      car: { text: 'Au poste vision, le moniteur Grade 1 bascule SDR | HDR et le PRISM a une entrée « HDR HLG » : la tuile CIE 1931 place les couleurs de l\'image dans les triangles 709 et 2020, le waveform trace la ligne du blanc de référence à 75 %. La transmission envoie les deux versions.', station: 'vision' },
      terms: ['cie1931', 'gamut', 'hdr-hlg', 'ycbcr'],
      competences: ['1.4', '2.2'], article: 'hdrguide',
      quiz: [
        { q: 'Que représente le triangle d\'un espace de couleur sur le diagramme CIE ?', choices: ['Les couleurs que l\'espace peut reproduire (son gamut)', 'Les trois niveaux de gris de référence', 'La plage de luminance de l\'écran'], answer: 0, why: 'Les sommets sont les primaires R, V, B ; tout mélange est à l\'intérieur. La luminance n\'y figure pas : le diagramme xy ne montre que la chromaticité.' },
        { q: 'À quel niveau le HLG place-t-il le blanc de référence (graphismes, papier blanc) ?', choices: ['100 %', '75 %', '50 %'], answer: 1, why: 'BT.2408 : 75 %, soit 203 cd/m² sur un écran de 1 000 cd/m². Le quart supérieur de l\'échelle est gardé pour les reflets et les sources. 100 % serait le blanc SDR ; 50 % est le niveau HLG de la lumière qui saturait une caméra SDR.' },
        { q: 'Que fait le convertisseur HDR → SDR du car avec une couleur hors du triangle BT.709 ?', choices: ['Il la laisse passer : le SDI transporte tout', 'Il la ramène vers le bord du triangle 709 (gamut mapping) : elle perd en saturation', 'Il la remplace par du gris'], answer: 1, why: 'Un écran BT.709 ne peut pas afficher cette couleur : le convertisseur la rabat au plus près sur le bord du gamut 709. Le SDI transporte en effet n\'importe quelles valeurs, mais pas l\'écran.' },
        { q: 'Au poste vision, un projecteur du stade est quatre fois plus lumineux que la lumière qui sature la caméra en SDR. Comment le codent la courbe SDR BT.709 et la courbe HLG ?', choices: [['Écrêté dans les deux : 100 % reste le maximum du signal', 'En HLG, la lumière qui saturait le SDR n\'est qu\'à 50 % du signal, et l\'échelle code jusqu\'à douze fois plus de lumière : quatre fois passe sans écrêter.'], 'SDR : écrêté à 100 %, un aplat ; HLG : sous 100 %, avec son détail', ['Codé dans les deux : la racine du SDR comprime les hautes lumières', 'La racine du SDR (exposant 0,45) atteint 100 % pour la lumière de référence et écrête tout ce qui dépasse.']], answer: 1, why: 'La courbe SDR atteint 100 % pour la lumière de référence et écrête au-delà : le projecteur devient un aplat. Le HLG place cette même lumière à 50 % du signal et garde le haut de l\'échelle pour douze fois plus de lumière : le projecteur y garde son détail.' },
        { q: 'Une source extérieure arrive en SDR BT.709 et doit entrer dans la production HLG BT.2020 du car. Pourquoi cette conversion demande-t-elle de la prudence ?', choices: [['Parce que ses couleurs sortent du triangle BT.2020', 'Le triangle BT.709 tient à l\'intérieur du BT.2020, bien plus large : toutes ses couleurs y sont reproductibles.'], ['Parce que son blanc n\'est pas celui du BT.2020', 'BT.709 et BT.2020 ont le même blanc, le D65 : rien à corriger de ce côté.'], 'Parce que ses hautes lumières ont été écrêtées à la prise de vue : il faut inventer ce que la HDR attend'], answer: 2, why: 'La courbe SDR a écrêté tout ce qui dépassait la lumière de référence : ciel et projecteurs sont des aplats. Monter en HDR demande de recréer des hautes lumières qui n\'existent pas dans la source. Les couleurs, elles, tiennent sans peine dans le triangle BT.2020.' },
      ],
    },
    LESSON_COMPRESSION,
  ],
});

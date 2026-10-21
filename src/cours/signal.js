// @ts-check
import { el } from '../util.js';
import { registerChapter } from './index.js';
import { figure, sv, canvas, slider, choice, readout, fmtNum } from './kit.js';

// ----------------------------------------------------------------------------------
// Chapitre « Le signal vidéo numérique ». Première leçon : l'échantillonnage 4:4:4 / 4:2:2 / 4:2:0,
// avec une image de synthèse que l'on sous-échantillonne vraiment (YCbCr BT.709) et une loupe.
// Les autres leçons du chapitre (quantification, niveaux, formats, espaces de couleur) suivent
// le même modèle.
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

registerChapter({
  id: 'signal', title: 'Le signal vidéo numérique', icon: 'vision',
  intro: 'Ce qu\'il y a dans une image numérique avant toute interface : des échantillons, des bits, des niveaux, un format. Tout le reste du car en dépend.',
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
      quiz: [
        { q: 'En 4:2:2, combien d\'échantillons de couleur Cb pour 4 pixels d\'une ligne ?', choices: ['4', '2', '1'], answer: 1, why: '4:2:2 se lit « 4 Y, 2 Cb, 2 Cr » sur quatre pixels : la couleur est portée par un pixel sur deux. 4 serait du 4:4:4 ; 1 par ligne et par colonne, du 4:2:0.' },
        { q: 'Pourquoi le car garde-t-il du 4:2:2 alors que le public reçoit du 4:2:0 ?', choices: ['Parce que le SDI ne sait pas transporter du 4:2:0', 'Parce que les incrustations, ralentis et corrections ont besoin de couleur précise sur les contours', 'Parce que le 4:2:0 est de moins bonne qualité en luminance'], answer: 1, why: 'La luminance est identique dans les trois cas : c\'est la couleur qui est réduite. Les traitements du car (chroma key, habillage, étalonnage) exigent une couleur fine ; en bout de chaîne, le 4:2:0 suffit à l\'œil.' },
        { q: 'Où voit-on une différence entre 4:4:4 et 4:2:2 à la loupe ?', choices: ['Sur la pelouse uniforme', 'Sur les détails de couleur fins : texte rouge, lignes colorées', 'Sur les blancs du maillot'], answer: 1, why: 'Seuls les détails de couleur plus petits que deux pixels sont touchés : le texte rouge sur fond bleu « bave » un peu. La pelouse et les blancs ne changent pas, la luminance étant intacte.' },
      ],
    },
  ],
});

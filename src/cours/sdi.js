// @ts-check
import { el } from '../util.js';
import { registerChapter } from './index.js';
import { figure, sv, canvas, slider, choice, readout, fmtNum } from './kit.js';

// ----------------------------------------------------------------------------------
// Chapitre « Le SDI » : la trame SDI dans un coaxial, la longueur de câble et le diagramme de l'œil (la
// manipulation phare), l'audio et les données embarqués (ancillary), les connecteurs, câbles et le brassage.
// Chiffres : normes SMPTE ST 259 / 292-1 / 424 / 2081-1 / 2082-1 / 299 / 352 / 12-2 ; affaiblissement des
// câbles d'après les fiches Belden (dB / 100 m à la demi-fréquence d'horloge : 750 MHz, 1,5 GHz, 6 GHz),
// arrondis ; budgets d'égalisation : minimum exigé des récepteurs par les normes (20 dB en HD et 3G, 40 dB
// en 6G et 12G) et ordre de grandeur des égaliseurs courants (≈ 36 dB en HD et 3G, ≈ 42 dB en 12G, ce qui
// redonne les ≈ 200 m / 140 m / 70 m de 1694A annoncés par les constructeurs). Ce sont des ordres de grandeur.
// ----------------------------------------------------------------------------------
const FMT = {
  HD: { name: 'HD-SDI', gbps: 1.485, nyq: 742.5, norme: 'ST 292-1', ui: 673.4, fs: 74.25 },
  '3G': { name: '3G-SDI', gbps: 2.97, nyq: 1485, norme: 'ST 424', ui: 336.7, fs: 148.5 },
  '12G': { name: '12G-SDI', gbps: 11.88, nyq: 5940, norme: 'ST 2082-1', ui: 84.2, fs: 594 },
};
const CABLES = {
  '1694A': { name: 'Belden 1694A (type RG6, Ø 6,9 mm)', short: '1694A · RG6', att: { HD: 17.7, '3G': 25.6, '12G': 58 } },
  '4794R': { name: 'Belden 4794R (prévu 12G, Ø 7,2 mm)', short: '4794R · 12G', att: { HD: 15, '3G': 22, '12G': 47 } },
  '1505A': { name: 'Belden 1505A (type RG59, Ø 5,9 mm)', short: '1505A · RG59', att: { HD: 23, '3G': 33, '12G': 70 } },
  '1855A': { name: 'Belden 1855A (mini RG59, Ø 4 mm)', short: '1855A · mini', att: { HD: 35, '3G': 49, '12G': 107 } },
};
const BUDGET = { HD: { norme: 20, typ: 36 }, '3G': { norme: 20, typ: 36 }, '12G': { norme: 40, typ: 42 } };
const RACCORD_DB = 0.5; // par passage en brassage ou raccord : ordre de grandeur
const gauss = () => (Math.random() + Math.random() + Math.random() + Math.random() - 2) * 1.732; // ≈ loi normale (0, 1)
const fmtDb = (v) => fmtNum(v, 1) + ' dB';

// ---------------- la trame SDI : la manipulation ----------------
// Une ligne 1080 (2 640 mots par flux, Y et C) : SAV, 1 920 mots de vidéo active, EAV, numéro de ligne, CRC, puis
// l'espace HANC. Le curseur déplace un mot dans la ligne et dit ce qu'on y lit.
const RASTERS = {
  '1080p50': { fmt: '3G', tot: 2640, act: 1920, lines: 1125, label: '1080p50' },
  '1080i25': { fmt: 'HD', tot: 2640, act: 1920, lines: 1125, label: '1080i25' },
  '720p50': { fmt: 'HD', tot: 1980, act: 1280, lines: 750, label: '720p50' },
};
const hex = (v) => v.toString(16).toUpperCase().padStart(3, '0');
function zoneOf(R, w) {
  // la ligne telle qu'on la dessine : SAV (4) · vidéo active · EAV (4) · LN (2) · CRC (2) · HANC
  const a = R.act, blank = R.tot - a - 12;
  if (w < 4) return { zone: 'SAV', col: '#7fd1a0', text: `3FF 000 000 200 : début de la vidéo active (Start of Active Video). Le 4e mot (XYZ) porte les bits F, V, H : ici F = 0, V = 0, H = 0.`, word: ['3FF', '000', '000', '200'][w] };
  if (w < 4 + a) { const x = w - 4; const y = 64 + Math.round(876 * x / (a - 1)); return { zone: 'vidéo active', col: '#ffd38a', text: `pixel ${fmtNum(x + 1)} sur ${fmtNum(a)} : Y = ${hex(y)} (code ${y}, ${fmtNum((y - 64) / 8.76, 0)} %), C = 200 (Cb et Cr à 512, une rampe de gris)`, word: hex(y) }; }
  if (w < 8 + a) return { zone: 'EAV', col: '#ff8a80', text: '3FF 000 000 274 : fin de la vidéo active (End of Active Video). XYZ = 274 (H = 1). Dans la suppression verticale, les mots XYZ deviennent 2AC et 2D8 (V = 1).', word: ['3FF', '000', '000', '274'][w - 4 - a] };
  if (w < 10 + a) return { zone: 'LN', col: '#7fd3f3', text: 'numéro de ligne sur deux mots (LN0, LN1) : le récepteur sait où il en est dans l\'image sans attendre le haut de l\'image.', word: ['LN0', 'LN1'][w - 8 - a] };
  if (w < 12 + a) return { zone: 'CRC', col: '#7fd3f3', text: 'deux mots de CRC calculés sur la ligne qui vient de passer (un CRC par flux, Y et C) : le récepteur recalcule et compte les lignes fausses.', word: ['CRC0', 'CRC1'][w - 10 - a] };
  return { zone: 'HANC', col: '#8a949c', text: `espace ancillary horizontal : ${fmtNum(blank)} mots libres par flux et par ligne, pour l'audio embarqué (ST 299), le timecode, les métadonnées ; sinon des mots de remplissage (040 en Y, 200 en C).`, word: (w - 12 - a) % 2 ? '200' : '040' };
}
function demoTrame(host) {
  let rk = '1080p50', w = 1000;
  const LW = 640, LH = 112, line = canvas(LW, LH, 'co-canvas co-smooth'), g = line.getContext('2d');
  const read = readout(['Mot n°', 'Zone', 'Ce qu\'on y lit', 'Instant dans la ligne', 'Liaison']);
  const pos = slider('Position dans la ligne', 0, 2639, w, 1, (v) => { w = v; redraw(); }, (v) => 'mot ' + fmtNum(v));
  const inp = /** @type {HTMLInputElement} */ (pos.querySelector('input'));
  const redraw = () => {
    const R = RASTERS[rk], F = FMT[R.fmt], a = R.act, blank = R.tot - a - 12;
    if (w > R.tot - 1) w = R.tot - 1;
    const X = (k) => 10 + k / R.tot * (LW - 20);
    g.fillStyle = '#0b1013'; g.fillRect(0, 0, LW, LH);
    const segs = [['SAV', 0, 4, '#7fd1a0'], ['vidéo active', 4, a, '#ffd38a'], ['EAV', 4 + a, 4, '#ff8a80'], ['LN', 8 + a, 2, '#7fd3f3'], ['CRC', 10 + a, 2, '#7fd3f3'], ['HANC', 12 + a, blank, '#8a949c']];
    g.font = '11px Arial, sans-serif';
    for (const [name, k0, n, col] of segs) {
      const x0 = X(+k0), x1 = X(+k0 + +n); g.fillStyle = String(col); g.globalAlpha = 0.55; g.fillRect(x0, 20, Math.max(2, x1 - x0), 30); g.globalAlpha = 1;
      g.fillStyle = '#e3e7e1'; if (x1 - x0 > 40) g.fillText(`${name} · ${fmtNum(+n)} mots`, x0 + 4, 40);
    }
    g.fillStyle = '#aab4ba'; g.fillText('SAV', X(0) - 2, 14); g.fillText('EAV · LN · CRC', X(4 + a) - 20, 14); g.fillText(`${fmtNum(R.tot)} mots par flux Y (et autant en C) · ${fmtNum(R.tot / F.fs, 2)} µs`, X(0), LH - 30);
    // la loupe : 12 mots autour du curseur, flux Y
    const k0 = Math.max(0, Math.min(R.tot - 12, w - 5));
    for (let i = 0; i < 12; i++) { const z = zoneOf(R, k0 + i), x = 10 + i * 52; g.fillStyle = k0 + i === w ? z.col : '#1a2229'; g.fillRect(x, LH - 22, 50, 18); g.strokeStyle = z.col; g.strokeRect(x + 0.5, LH - 21.5, 50, 18); g.fillStyle = k0 + i === w ? '#000' : '#d3f3df'; g.font = '11px Menlo, Consolas, monospace'; g.fillText(z.word, x + 8, LH - 9); }
    g.font = '11px Arial, sans-serif';
    const z = zoneOf(R, w), xw = X(w);
    g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.moveTo(xw, 16); g.lineTo(xw, 54); g.stroke(); g.lineWidth = 1;
    g.fillStyle = '#fff'; g.beginPath(); g.moveTo(xw - 5, 56); g.lineTo(xw + 5, 56); g.lineTo(xw, 62); g.fill();
    read.set('Mot n°', `${fmtNum(w)} sur ${fmtNum(R.tot)} (flux Y ; le flux C a la même structure)`);
    read.set('Zone', z.zone);
    read.set('Ce qu\'on y lit', z.text);
    read.set('Instant dans la ligne', `${fmtNum(w / F.fs, 2)} µs depuis le SAV (un mot toutes les ${fmtNum(1e3 / F.fs, 2)} ns à ${fmtNum(F.fs, 2)} MHz)`);
    read.set('Liaison', `${F.name} ${fmtNum(F.gbps, 3)} Gb/s (${F.norme}) : ${fmtNum(R.tot)} × ${fmtNum(R.lines)} × ${R.fmt === '3G' ? 50 : rk === '720p50' ? 50 : 25} × 20 bits`);
  };
  host.append(
    el('div', { class: 'co-ctl' },
      choice('Format', [['1080p50', '1080p50 (3G)'], ['1080i25', '1080i25 (HD)'], ['720p50', '720p50 (HD)']], rk, (v) => { rk = v; inp.max = String(RASTERS[rk].tot - 1); redraw(); }),
      pos),
    line, read.el);
  redraw();
}
function figTrame() {
  const f = figure(420, 172, 'À gauche, la coupe d\'un coaxial 75 Ω : âme, diélectrique, tresse et feuillard, gaine ; à droite, une image SDI : la zone active entourée de la suppression horizontale (EAV, HANC, SAV) et verticale (VANC)');
  const cx = 58, cy = 86;
  f.append(sv('circle', { cx, cy, r: 46, fill: '#2b2f33', stroke: '#59646f' }), sv('circle', { cx, cy, r: 38, fill: '#8a949c' }), sv('circle', { cx, cy, r: 32, fill: '#e3e7e1' }), sv('circle', { cx, cy, r: 6, fill: '#ffd38a' }));
  f.append(sv('text', { x: 100, y: 16, textAnchor: 'middle', class: 'co-t' }, 'Coaxial 75 Ω'));
  [[46, 'gaine', -40], [38, 'tresse + feuillard', -26], [32, 'diélectrique (mousse)', -12], [6, 'âme (cuivre)', 2]].forEach(([r, label, dy]) => {
    const px = cx + +r * Math.cos(-0.6), py = cy + +r * Math.sin(-0.6);
    f.append(sv('line', { x1: px, y1: py, x2: 112, y2: cy + +dy, stroke: '#8a949c', strokeWidth: 0.6 }), sv('text', { x: 114, y: cy + +dy + 4, class: 'co-s' }, label));
  });
  f.append(sv('text', { x: 112, y: 156, textAnchor: 'middle', class: 'co-s' }, 'BNC 75 Ω · 800 mV crête à crête'));
  const g = sv('g', { transform: 'translate(230 0)' });
  g.append(sv('text', { x: 95, y: 16, textAnchor: 'middle', class: 'co-t' }, 'Une image 1080 (pas à l\'échelle)'));
  g.append(sv('rect', { x: 0, y: 26, width: 190, height: 124, fill: '#1a2229', stroke: '#59646f' }));
  g.append(sv('rect', { x: 0, y: 26, width: 190, height: 22, fill: '#2a3a44' }), sv('text', { x: 95, y: 41, textAnchor: 'middle', class: 'co-s' }, 'VANC : 45 lignes (timecode, VPID…)'));
  g.append(sv('rect', { x: 0, y: 48, width: 52, height: 102, fill: '#3a3340' }));
  ['EAV', 'LN · CRC', 'HANC', '(audio)', 'SAV'].forEach((s, i) => g.append(sv('text', { x: 26, y: 72 + i * 15, textAnchor: 'middle', class: 'co-s' }, s)));
  g.append(sv('rect', { x: 52, y: 48, width: 138, height: 102, fill: '#0b1013', stroke: '#ffd38a' }), sv('text', { x: 121, y: 94, textAnchor: 'middle', class: 'co-t' }, 'vidéo active'), sv('text', { x: 121, y: 108, textAnchor: 'middle', class: 'co-m' }, '1 920 × 1 080'));
  g.append(sv('text', { x: 95, y: 166, textAnchor: 'middle', class: 'co-s' }, '2 640 mots × 1 125 lignes par flux'));
  f.append(g);
  return f;
}

// ---------------- longueur de câble et diagramme de l'œil : la manipulation phare ----------------
// Le canal est modélisé au premier ordre : l'affaiblissement à la demi-fréquence d'horloge donne une constante de temps
// (en UI) qui arrondit les fronts et referme l'œil brut. L'égaliseur du récepteur compense jusqu'à son budget, au prix
// d'un bruit et d'une gigue qui montent vite près de la limite : au-delà, plus de verrouillage (effet de falaise).
const tauOf = (attDb) => Math.sqrt(Math.max(0, Math.pow(10, attDb / 10) - 1)) / Math.PI;
function drawEye(g, W, H, o) {
  g.fillStyle = '#0b1013'; g.fillRect(0, 0, W, H);
  const mid = H / 2, A = H * 0.3, X = (t) => t / 2 * W;
  g.strokeStyle = '#424c56'; g.lineWidth = 1; g.setLineDash([3, 3]);
  for (const y of [mid - A, mid, mid + A]) { g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(W, y + 0.5); g.stroke(); }
  for (const t of [0.5, 1, 1.5]) { g.beginPath(); g.moveTo(X(t) + 0.5, 0); g.lineTo(X(t) + 0.5, H); g.stroke(); }
  g.setLineDash([]);
  g.fillStyle = '#aab4ba'; g.font = '10px Arial, sans-serif'; g.fillText('+400 mV', 3, mid - A - 3); g.fillText('−400 mV', 3, mid + A + 11); g.fillText('1 UI', X(0.5) + 3, H - 4); g.fillText('2 UI', X(1.5) + 3, H - 4);
  g.fillStyle = '#e3e7e1'; g.fillText(o.title, W - g.measureText(o.title).width - 4, 12);
  const tau = Math.sqrt(0.25 * 0.25 + o.tau * o.tau), STEPS = 40, k = 1 - Math.exp(-1 / STEPS / tau);
  g.strokeStyle = o.dead ? 'rgba(255, 138, 128, 0.18)' : 'rgba(127, 211, 243, 0.2)'; g.lineWidth = 1.2;
  for (let n = 0; n < 90; n++) {
    const b = []; for (let i = 0; i < 6; i++) b.push(Math.random() < 0.5 ? -1 : 1);
    let v = b[0] * (1 - Math.exp(-4 / tau)); const j = gauss() * o.jitter;
    g.beginPath();
    for (let s = -3 * STEPS; s <= 2 * STEPS; s++) {
      const t = s / STEPS, target = b[Math.min(5, Math.max(0, Math.floor(t - j) + 4))];
      v += (target - v) * k;
      if (t < 0) continue;
      const y = o.dead ? mid + gauss() * A * 0.7 : mid - v * A + gauss() * o.noise * A;
      if (s === 0) g.moveTo(X(t), y); else g.lineTo(X(t), y);
    }
    g.stroke();
  }
  if (o.dead) { g.fillStyle = '#ff8a80'; g.font = 'bold 12px Arial, sans-serif'; g.fillText('pas de verrouillage', W / 2 - 50, mid + 4); }
}
function drawPicture(g, W, H, state, margin) {
  g.fillStyle = '#5a7fb0'; g.fillRect(0, 0, W, H * 0.45); g.fillStyle = '#2f6b23'; g.fillRect(0, H * 0.45, W, H);
  g.fillStyle = '#e3e7e1'; g.fillRect(W * 0.42, H * 0.5, W * 0.16, H * 0.3); g.fillStyle = '#c8102e'; g.fillRect(W * 0.49, H * 0.5, W * 0.03, H * 0.3);
  g.fillStyle = '#ffd400'; g.font = 'bold 14px Arial, sans-serif'; g.fillText('RC LENS 1-0', 8, 20);
  if (state === 'red') { g.fillStyle = '#000'; g.fillRect(0, 0, W, H); g.fillStyle = '#ff8a80'; g.font = 'bold 13px Arial, sans-serif'; g.fillText('PAS DE SIGNAL', W / 2 - 48, H / 2 + 4); return; }
  if (state === 'orange') {
    const n = Math.round(Math.max(0, 4 - margin) ** 2 * 6); // éclats : erreurs CRC de plus en plus fréquentes près de la limite
    for (let i = 0; i < n; i++) { g.fillStyle = Math.random() < 0.5 ? '#fff' : '#000'; g.fillRect(Math.random() * W, Math.round(Math.random() * H), 6 + Math.random() * 40, 2); }
  }
}
function demoOeil(host) {
  let fmt = '3G', cable = '1694A', len = 80;
  const EW = 300, EH = 190;
  const raw = canvas(EW, EH, 'co-canvas co-smooth'), eq = canvas(EW, EH, 'co-canvas co-smooth'), pic = canvas(EW, EH, 'co-canvas co-smooth'), bar = canvas(640, 44, 'co-canvas co-smooth');
  const gr = raw.getContext('2d'), ge = eq.getContext('2d'), gp = pic.getContext('2d'), gb = bar.getContext('2d');
  const read = readout(['Fréquence de Nyquist (demi-horloge)', 'Affaiblissement du câble', 'Ce que le récepteur sait compenser', 'Marge', 'Longueur maximale avec ce câble', 'État de la liaison']);
  const redraw = () => {
    const F = FMT[fmt], C = CABLES[cable], B = BUDGET[fmt], per = C.att[fmt], att = len * per / 100, margin = B.typ - att;
    const state = att <= B.norme ? 'green' : att <= B.typ ? 'orange' : 'red';
    const lNorme = B.norme / per * 100, lTyp = B.typ / per * 100, r = att / B.typ;
    drawEye(gr, EW, EH, { tau: tauOf(att), jitter: 0.02 + 0.04 * r, noise: 0.015, dead: false, title: 'œil brut au bout du câble' });
    drawEye(ge, EW, EH, { tau: 0.05, jitter: 0.02 + 0.22 * r ** 3, noise: 0.02 + 0.30 * r ** 4, dead: state === 'red', title: 'œil égalisé (vu par le récepteur)' });
    drawPicture(gp, EW, EH, state, margin);
    // la règle des longueurs : vert jusqu'au minimum garanti, orange jusqu'à la limite courante, rouge au-delà
    gb.fillStyle = '#0b1013'; gb.fillRect(0, 0, 640, 44);
    const X = (m) => 10 + Math.min(250, m) / 250 * 620;
    gb.fillStyle = '#2f6b23'; gb.fillRect(X(0), 8, X(lNorme) - X(0), 16); gb.fillStyle = '#8a5a10'; gb.fillRect(X(lNorme), 8, X(lTyp) - X(lNorme), 16); gb.fillStyle = '#7a2420'; gb.fillRect(X(lTyp), 8, X(250) - X(lTyp), 16);
    gb.fillStyle = '#aab4ba'; gb.font = '10px Arial, sans-serif';
    for (let m = 0; m <= 250; m += 50) { gb.fillRect(X(m), 24, 1, 4); gb.fillText(`${m} m`, X(m) - 8, 40); }
    gb.fillStyle = '#e3e7e1'; gb.fillText(`garanti ≈ ${fmtNum(lNorme)} m`, X(lNorme) + 3, 20); if (lTyp < 240) gb.fillText(`courant ≈ ${fmtNum(lTyp)} m`, X(lTyp) + 3, 20);
    gb.fillStyle = '#fff'; gb.beginPath(); gb.moveTo(X(len) - 6, 2); gb.lineTo(X(len) + 6, 2); gb.lineTo(X(len), 10); gb.fill(); gb.fillRect(X(len) - 1, 2, 2, 24);
    read.set('Fréquence de Nyquist (demi-horloge)', `${fmtNum(F.nyq / (F.nyq >= 1000 ? 1000 : 1), F.nyq >= 1000 ? 2 : 1)} ${F.nyq >= 1000 ? 'GHz' : 'MHz'} pour ${F.name} (${fmtNum(F.gbps, 3)} Gb/s) · 1 UI = ${fmtNum(F.ui, 1)} ps`);
    read.set('Affaiblissement du câble', `${fmtDb(att)} (${fmtNum(per, 1)} dB / 100 m à cette fréquence, ${C.short})`);
    read.set('Ce que le récepteur sait compenser', `${B.norme} dB garantis par ${F.norme} · ≈ ${B.typ} dB avec un bon égaliseur (ordre de grandeur)`);
    read.set('Marge', margin >= 0 ? `${fmtDb(margin)} avant la limite courante${att > B.norme ? ' (au-delà du minimum garanti)' : ''}` : `dépassée de ${fmtDb(-margin)}`);
    read.set('Longueur maximale avec ce câble', `≈ ${fmtNum(lNorme)} m garantis · ≈ ${fmtNum(lTyp)} m en pratique`);
    read.set('État de la liaison', state === 'green' ? 'image parfaite, sans erreur CRC : n\'importe quel récepteur conforme passe' : state === 'orange' ? (margin > 4 ? 'image parfaite, mais au-delà du minimum garanti : cela dépend de l\'égaliseur du récepteur' : margin > 2 ? 'quelques erreurs CRC par minute : la falaise est à deux pas' : 'erreurs CRC en continu, éclats dans l\'image : au bord de la falaise') : 'plus de verrouillage : l\'image est tombée d\'un coup (effet de falaise)');
  };
  host.append(
    el('div', { class: 'co-ctl' },
      slider('Longueur', 0, 250, len, 1, (v) => { len = v; redraw(); }, (v) => v + ' m'),
      choice('Format', [['HD', 'HD-SDI', '1,485 Gb/s : 1080i, 720p'], ['3G', '3G-SDI', '2,97 Gb/s : 1080p50'], ['12G', '12G-SDI', '11,88 Gb/s : 2160p50']], fmt, (v) => { fmt = v; redraw(); }),
      choice('Câble', Object.entries(CABLES).map(([k, c]) => [k, c.short, c.name]), cable, (v) => { cable = v; redraw(); })),
    el('div', { class: 'co-3' },
      el('figure', {}, raw, el('figcaption', {}, 'Œil brut : les fronts s\'arrondissent, l\'œil se ferme dès quelques dizaines de mètres')),
      el('figure', {}, eq, el('figcaption', {}, 'Œil égalisé : rouvert par le récepteur… jusqu\'à sa limite')),
      el('figure', {}, pic, el('figcaption', {}, 'Image reçue : parfaite, puis des éclats, puis plus rien'))),
    bar, read.el);
  redraw();
}
function figOeil() {
  const f = figure(420, 190, 'Diagramme de l\'œil : des milliers de bits superposés sur deux intervalles unitaires ; amplitude 800 mV entre les niveaux, croisements épaissis par la gigue, ouverture au centre où le récepteur lit le bit');
  const hi = 54, lo = 142, x0 = 40, x1 = 330, cx = 175;
  f.append(sv('text', { x: 10, y: 16, class: 'co-t' }, 'Le diagramme de l\'œil'));
  const tr = (x) => [sv('path', { d: `M${x} ${hi} C ${x + 60} ${hi}, ${x + 60} ${lo}, ${x + 120} ${lo}`, fill: 'none', stroke: '#7fd3f3', strokeWidth: 2 }), sv('path', { d: `M${x} ${lo} C ${x + 60} ${lo}, ${x + 60} ${hi}, ${x + 120} ${hi}`, fill: 'none', stroke: '#7fd3f3', strokeWidth: 2 })];
  f.append(sv('line', { x1: x0, y1: hi, x2: x1, y2: hi, stroke: '#7fd3f3', strokeWidth: 2 }), sv('line', { x1: x0, y1: lo, x2: x1, y2: lo, stroke: '#7fd3f3', strokeWidth: 2 }), ...tr(40), ...tr(190));
  for (const x of [100, 250]) f.append(sv('ellipse', { cx: x, cy: (hi + lo) / 2, rx: 9, ry: 7, fill: '#ff8a80', 'fill-opacity': 0.45 }));
  f.append(sv('line', { x1: cx, y1: hi, x2: cx, y2: lo, stroke: '#ffd38a', strokeWidth: 1, 'stroke-dasharray': '3 3' }), sv('text', { x: cx, y: 44, textAnchor: 'middle', class: 'co-s', fill: '#ffd38a' }, 'instant de lecture : l\'ouverture est la marge'));
  f.append(sv('line', { x1: 350, y1: hi, x2: 350, y2: lo, stroke: '#e3e7e1' }), sv('line', { x1: 345, y1: hi, x2: 355, y2: hi, stroke: '#e3e7e1' }), sv('line', { x1: 345, y1: lo, x2: 355, y2: lo, stroke: '#e3e7e1' }), sv('text', { x: 358, y: 94, class: 'co-m' }, '800 mV'), sv('text', { x: 358, y: 106, class: 'co-s' }, '± 10 %'));
  f.append(sv('text', { x: 100, y: 160, textAnchor: 'middle', class: 'co-s', fill: '#ff8a80' }, 'croisement : sa largeur est la gigue'), sv('text', { x: 412, y: 160, textAnchor: 'end', class: 'co-s' }, 'pente des fronts = temps de montée'));
  f.append(sv('line', { x1: 100, y1: 172, x2: 250, y2: 172, stroke: '#e3e7e1' }), sv('line', { x1: 100, y1: 167, x2: 100, y2: 177, stroke: '#e3e7e1' }), sv('line', { x1: 250, y1: 167, x2: 250, y2: 177, stroke: '#e3e7e1' }), sv('text', { x: cx, y: 187, textAnchor: 'middle', class: 'co-s' }, '1 UI : 673 ps en HD · 337 ps en 3G · 84 ps en 12G'));
  return f;
}

// ---------------- audio et données embarqués : la manipulation ----------------
// ST 299-1 : quatre groupes de quatre canaux, un paquet de 31 mots par groupe et par ligne dans l'HANC du flux C ;
// ST 12-2 : timecode ATC, paquet de 23 mots dans la suppression verticale ; ST 352 : VPID, 11 mots.
const AUDIO_PKT = 31, ATC_PKT = 23, VPID_PKT = 11, HANC_WORDS = 708; // mots par paquet, mots libres par ligne
function demoEmbedded(host) {
  const on = new Array(16).fill(false); [0, 1, 2, 3, 4, 5].forEach((i) => { on[i] = true; });
  let atc = true, vpid = true;
  const W = 640, H = 150, c = canvas(W, H, 'co-canvas co-smooth'), g = c.getContext('2d');
  const read = readout(['Canaux audio embarqués', 'Débit audio', 'Place prise dans l\'HANC (flux C, par ligne)', 'Sorties AES du désembeddeur', 'Ce que transporte ce câble']);
  const boxes = [];
  const redraw = () => {
    const groups = [0, 1, 2, 3].filter((gi) => on.slice(gi * 4, gi * 4 + 4).some(Boolean)), n = on.filter(Boolean).length;
    g.fillStyle = '#0b1013'; g.fillRect(0, 0, W, H);
    g.font = '11px Arial, sans-serif';
    const row = (y, label) => { g.fillStyle = '#aab4ba'; g.fillText(label, 10, y - 6); };
    // ligne active : HANC du flux C, à l'échelle (720 mots de suppression sur 2 640)
    row(30, 'Ligne d\'image, flux C : EAV · LN · CRC · HANC (708 mots) · SAV');
    const X = (k) => 10 + k / 760 * (W - 20);
    const seg = (k0, n, col, label, y) => { g.fillStyle = col; g.fillRect(X(k0), y, Math.max(2, X(k0 + n) - X(k0)), 26); if (label) { g.fillStyle = '#000'; g.fillText(label, X(k0) + 3, y + 17); } };
    seg(0, 4, '#ff8a80', '', 30); seg(4, 4, '#7fd3f3', '', 30); seg(8, 708, '#2a3a44', '', 30); seg(716, 4, '#7fd1a0', '', 30); seg(720, 40, '#5c4210', 'vidéo…', 30);
    let k = 12;
    for (const gi of groups) { seg(k, AUDIO_PKT, '#ffd38a', `G${gi + 1}`, 30); k += AUDIO_PKT + 4; }
    g.fillStyle = '#aab4ba'; g.fillText(groups.length ? `${groups.length} paquet${groups.length > 1 ? 's' : ''} audio de 31 mots (ADF, DID, DBN, DC, horloge, 4 × 4 mots d'échantillons, ECC, CS)` : 'aucun paquet audio : des mots de remplissage', X(8) + 4, 76);
    // lignes de la suppression verticale : VANC (zone active des lignes 9 et 10)
    row(104, 'Lignes 9 et 10 de la suppression verticale, flux Y : la zone active devient le VANC');
    // échelle propre à cette rangée : la suppression horizontale à gauche, les 1 920 mots de zone active à droite
    g.fillStyle = '#ff8a80'; g.fillRect(10, 104, 6, 26); g.fillStyle = '#7fd3f3'; g.fillRect(16, 104, 8, 26); g.fillStyle = '#2a3a44'; g.fillRect(24, 104, 110, 26); g.fillStyle = '#7fd1a0'; g.fillRect(134, 104, 6, 26);
    g.fillStyle = '#aab4ba'; g.fillText('HANC', 60, 121);
    g.fillStyle = '#121a20'; g.fillRect(142, 104, W - 152, 26); g.fillStyle = '#aab4ba'; g.fillText('zone active : 1 920 mots, sans image', 400, 121);
    let v = 146; if (atc) { g.fillStyle = '#7fd1a0'; g.fillRect(v, 104, 46, 26); g.fillStyle = '#000'; g.fillText('ATC', v + 10, 121); v += 52; } if (vpid) { g.fillStyle = '#7fd3f3'; g.fillRect(v, 104, 46, 26); g.fillStyle = '#000'; g.fillText('VPID', v + 8, 121); }
    g.fillStyle = '#aab4ba'; g.fillText(`${atc ? `timecode ATC : ${ATC_PKT} mots (ST 12-2), une fois par image` : 'pas de timecode'} · ${vpid ? `VPID : ${VPID_PKT} mots (ST 352), une fois par image` : 'pas de VPID'}`, X(8) + 4, 148);
    const pairs = [...new Set(on.map((b, i) => b ? Math.floor(i / 2) + 1 : 0).filter(Boolean))];
    read.set('Canaux audio embarqués', `${n} sur 16 (groupe${groups.length > 1 ? 's' : ''} ${groups.map((x) => x + 1).join(', ') || '—'}) · 48 kHz, 24 bits`);
    read.set('Débit audio', `${fmtNum(n * 48000 * 24 / 1e6, 2)} Mb/s, soit ${fmtNum(n * 48000 * 24 / 2.97e9 * 100, 2)} % d'une liaison 3G`);
    read.set('Place prise dans l\'HANC (flux C, par ligne)', `${groups.length * AUDIO_PKT} mots sur ${HANC_WORDS} (${fmtNum(groups.length * AUDIO_PKT / HANC_WORDS * 100)} %) : un paquet de 31 mots par groupe présent`);
    read.set('Sorties AES du désembeddeur', pairs.length ? pairs.map((p) => `AES ${p} (canaux ${2 * p - 1}–${2 * p})`).join(', ') : 'aucune');
    read.set('Ce que transporte ce câble', `vidéo 1080p50 4:2:2 10 bits${n ? ` + ${n} ${n > 1 ? 'canaux' : 'canal'} audio` : ''}${atc ? ' + timecode' : ''}${vpid ? ' + identifiant de format' : ''} : un seul BNC`);
  };
  const grid = el('div', { class: 'co-emb' });
  for (let gi = 0; gi < 4; gi++) {
    const box = el('fieldset', { class: 'co-emb-g' }, el('legend', {}, `Groupe ${gi + 1}`));
    for (let ci = 0; ci < 4; ci++) {
      const i = gi * 4 + ci, inp = /** @type {HTMLInputElement} */ (el('input', { type: 'checkbox', checked: on[i] }));
      inp.addEventListener('change', () => { on[i] = inp.checked; redraw(); });
      box.append(el('label', { class: 'co-chk' }, inp, String(i + 1)));
    }
    grid.append(box); boxes.push(box);
  }
  host.append(
    el('div', { class: 'co-ctl' }, grid,
      choice('Timecode ATC', [['on', 'embarqué'], ['off', 'absent']], 'on', (v) => { atc = v === 'on'; redraw(); }),
      choice('VPID (ST 352)', [['on', 'présent'], ['off', 'absent']], 'on', (v) => { vpid = v === 'on'; redraw(); })),
    c, read.el);
  redraw();
}
function figEmbedded() {
  const f = figure(420, 150, 'Anatomie d\'un paquet ancillary : drapeau 000 3FF 3FF, DID, SDID (ou DBN), nombre de mots, données, somme de contrôle ; exemples : audio ST 299-1, timecode ATC, VPID');
  f.append(sv('text', { x: 10, y: 16, class: 'co-t' }, 'Un paquet ancillary (ST 291)'));
  /** @type {[string, number, string, string, number][]} */
  const parts = [['ADF', 64, '000 3FF 3FF', '#ff8a80', 0], ['DID', 36, 'type', '#7fd3f3', 0], ['SDID', 40, 'sous-type', '#7fd3f3', 1], ['DC', 36, 'n mots', '#7fd3f3', 0], ['UDW', 150, 'les données : n mots (0 à 255)', '#ffd38a', 0], ['CS', 36, 'somme', '#7fd1a0', 1]];
  let x = 10;
  for (const [name, w, sub, col, row] of parts) { f.append(sv('rect', { x, y: 28, width: w - 2, height: 30, fill: col, 'fill-opacity': 0.75 }), sv('text', { x: x + w / 2 - 1, y: 48, textAnchor: 'middle', class: 'co-t' }, name), sv('text', { x: x + w / 2 - 1, y: 72 + row * 12, textAnchor: 'middle', class: 'co-s' }, sub)); x += w; }
  const rows = [['Audio ST 299-1', 'DID 2E7…2E4 · 31 mots · 4 canaux · HANC du flux C, chaque ligne'], ['ATC ST 12-2', 'DID 60, SDID 60 · 23 mots · VANC, une fois par image'], ['VPID ST 352', 'DID 41, SDID 01 · 11 mots · VANC : annonce le format']];
  rows.forEach(([t, d], i) => f.append(sv('text', { x: 10, y: 106 + i * 17, class: 'co-m' }, t), sv('text', { x: 112, y: 106 + i * 17, class: 'co-s' }, d)));
  return f;
}

// ---------------- connecteurs, câbles, brassage : la manipulation ----------------
// Une chaîne de quatre liaisons SDI ; chaque appareil en bout égalise et réhorloge, le budget repart donc de zéro
// à chaque liaison. Raccords et passages en brassage coûtent environ 0,5 dB chacun ; une pièce 50 Ω crée une
// réflexion (environ 20 % du signal renvoyé, dépassement au-delà des 10 % admis) qui mange la marge.
const LINKS = [['Caméra', 'CCU'], ['CCU', 'Grille'], ['Grille', 'Mélangeur'], ['Mélangeur', 'Transmission']];
function demoChaine(host) {
  let fmt = '3G', cable = '1694A';
  const L = [60, 120, 25, 90], R = [1, 2, 0, 1], bad = [false, false, false, false];
  const W = 760, H = 150, c = canvas(W, H, 'co-canvas co-smooth'), g = c.getContext('2d');
  const read = readout([...LINKS.map(([a, b]) => `${a} → ${b}`), 'Diagnostic']);
  const redraw = () => {
    const F = FMT[fmt], C = CABLES[cable], B = BUDGET[fmt], per = C.att[fmt];
    g.fillStyle = '#0b1013'; g.fillRect(0, 0, W, H);
    const bx = (i) => 10 + i * 162, by = 56, bw = 92, bh = 34;
    const names = ['Caméra', 'CCU', 'Grille', 'Mélangeur', 'Transmission'];
    g.font = '11px Arial, sans-serif';
    const diag = [];
    LINKS.forEach(([a, b], i) => {
      const att = L[i] * per / 100 + R[i] * RACCORD_DB, pen = bad[i] ? 6 : 0, eff = att + pen, margin = B.typ - eff;
      const state = eff <= B.norme ? 'green' : eff <= B.typ ? 'orange' : 'red';
      const col = state === 'green' ? '#7fd1a0' : state === 'orange' ? '#ffd38a' : '#ff8a80';
      g.strokeStyle = col; g.lineWidth = 3; g.beginPath(); g.moveTo(bx(i) + bw, by + bh / 2); g.lineTo(bx(i + 1), by + bh / 2); g.stroke();
      g.fillStyle = col; g.fillText(`${L[i]} m · ${fmtDb(att)}`, bx(i) + bw - 2, by - 6);
      g.fillStyle = '#aab4ba'; g.fillText(`${R[i]} raccord${R[i] > 1 ? 's' : ''}${bad[i] ? ' · 50 Ω !' : ''}`, bx(i) + bw - 2, by + bh + 16);
      if (state === 'red' && !bad[i]) { g.strokeStyle = '#e3e7e1'; g.setLineDash([4, 3]); g.strokeRect(bx(i) + bw + 20, by + 4, 30, 26); g.setLineDash([]); g.fillStyle = '#e3e7e1'; g.fillText('DA', bx(i) + bw + 28, by + 21); }
      read.set(`${a} → ${b}`, `${L[i]} m, ${R[i]} raccord${R[i] > 1 ? 's' : ''}${bad[i] ? ', une pièce 50 Ω' : ''} : ${fmtDb(att)}${bad[i] ? ` + réflexions (≈ ${fmtDb(pen)} de marge en moins, dépassement ≈ 20 %)` : ''} · marge ${margin >= 0 ? fmtDb(margin) : 'dépassée'} · ${state === 'green' ? 'garanti' : state === 'orange' ? 'sans garantie, surveiller les CRC' : 'perte'}`);
      if (bad[i]) diag.push(`${a} → ${b} : remplacer la pièce 50 Ω (adaptateur, BNC ou cordon), même si la longueur est bonne : un répéteur n'y changerait rien`);
      else if (state === 'red') diag.push(`${a} → ${b} : trop long pour un seul bond (${fmtDb(att)} > ${B.typ} dB) : un DA ou répéteur (reclocker) à mi-parcours fait deux liaisons de ${Math.round(L[i] / 2)} m, ou passer en fibre`);
      else if (state === 'orange') diag.push(`${a} → ${b} : au-delà des ${B.norme} dB garantis par ${F.norme}, marche avec un bon égaliseur : vérifier les CRC avant le direct`);
    });
    names.forEach((n, i) => { g.fillStyle = '#333c45'; g.fillRect(bx(i), by, bw, bh); g.strokeStyle = '#59646f'; g.lineWidth = 1; g.strokeRect(bx(i) + 0.5, by + 0.5, bw, bh); g.fillStyle = '#e3e7e1'; g.font = '12px Arial, sans-serif'; g.fillText(n, bx(i) + 6, by + 21); });
    g.font = '11px Arial, sans-serif';
    g.fillStyle = '#aab4ba'; g.fillText(`${F.name} sur ${C.short} : ${fmtNum(per, 1)} dB / 100 m · chaque appareil égalise et réhorloge : le budget repart de zéro à chaque liaison`, 20, 140);
    read.set('Diagnostic', diag.length ? diag.join(' — ') : 'toutes les liaisons sont dans la plage garantie : rien à ajouter');
  };
  const rows = LINKS.map(([a, b], i) => {
    const chk = /** @type {HTMLInputElement} */ (el('input', { type: 'checkbox' })); chk.addEventListener('change', () => { bad[i] = chk.checked; redraw(); });
    return el('div', { class: 'co-ctl co-link' }, el('b', {}, `${a} → ${b}`),
      slider('longueur', 0, 200, L[i], 5, (v) => { L[i] = v; redraw(); }, (v) => v + ' m'),
      slider('raccords', 0, 4, R[i], 1, (v) => { R[i] = v; redraw(); }, (v) => String(v)),
      el('label', { class: 'co-chk' }, chk, 'pièce 50 Ω'));
  });
  host.append(
    el('div', { class: 'co-ctl' },
      choice('Format', [['HD', 'HD-SDI'], ['3G', '3G-SDI'], ['12G', '12G-SDI']], fmt, (v) => { fmt = v; redraw(); }),
      choice('Câble', Object.entries(CABLES).map(([k, cb]) => [k, cb.short, cb.name]), cable, (v) => { cable = v; redraw(); })),
    ...rows, c, read.el);
  redraw();
}
function figCable() {
  const f = figure(420, 150, 'BNC 75 Ω et BNC 50 Ω vus de face : même bague, mais la 50 Ω a une broche plus épaisse et un diélectrique blanc autour ; une baie de brassage (jackfield) et un distributeur-répéteur (DA, reclocker) une entrée, quatre sorties');
  const bnc = (x, label, fifty) => {
    f.append(sv('circle', { cx: x, cy: 70, r: 34, fill: '#2b2f33', stroke: '#8a949c' }), sv('circle', { cx: x, cy: 70, r: 26, fill: '#0b1013', stroke: '#59646f' }));
    if (fifty) f.append(sv('circle', { cx: x, cy: 70, r: 18, fill: '#e3e7e1' }));
    f.append(sv('circle', { cx: x, cy: 70, r: fifty ? 5 : 3, fill: '#ffd38a' }));
    for (const a of [40, 220]) f.append(sv('rect', { x: x + 30 * Math.cos(a * Math.PI / 180) - 3, y: 70 + 30 * Math.sin(a * Math.PI / 180) - 3, width: 6, height: 6, fill: '#8a949c' }));
    f.append(sv('text', { x, y: 118, textAnchor: 'middle', class: 'co-t' }, label));
  };
  bnc(46, 'BNC 75 Ω', false); bnc(150, 'BNC 50 Ω', true);
  f.append(sv('text', { x: 46, y: 132, textAnchor: 'middle', class: 'co-s' }, 'broche fine,'), sv('text', { x: 46, y: 144, textAnchor: 'middle', class: 'co-s' }, 'air autour'), sv('text', { x: 150, y: 132, textAnchor: 'middle', class: 'co-s' }, 'broche épaisse,'), sv('text', { x: 150, y: 144, textAnchor: 'middle', class: 'co-s' }, 'isolant blanc'), sv('text', { x: 98, y: 16, textAnchor: 'middle', class: 'co-s' }, 'même bague : elles s\'emboîtent, c\'est le piège'));
  // jackfield
  const g = sv('g', { transform: 'translate(210 30)' });
  g.append(sv('text', { x: 0, y: 0, class: 'co-t' }, 'Brassage'), sv('rect', { x: 0, y: 8, width: 100, height: 52, fill: '#2b2f33', stroke: '#59646f' }));
  for (let r = 0; r < 2; r++) for (let k = 0; k < 8; k++) g.append(sv('circle', { cx: 9 + k * 12, cy: 20 + r * 26, r: 4, fill: '#0b1013', stroke: '#8a949c' }));
  g.append(sv('path', { d: 'M21 20 C 21 8, 45 8, 45 20', fill: 'none', stroke: '#ffd38a', strokeWidth: 2 }), sv('path', { d: 'M69 46 C 69 34, 93 34, 93 46', fill: 'none', stroke: '#ffd38a', strokeWidth: 2 }));
  g.append(sv('text', { x: 0, y: 76, class: 'co-s' }, '≈ 0,5 dB par passage,'), sv('text', { x: 0, y: 88, class: 'co-s' }, 'à compter'));
  f.append(g);
  const d = sv('g', { transform: 'translate(322 30)' });
  d.append(sv('text', { x: 0, y: 0, class: 'co-t' }, 'DA · répéteur'), sv('rect', { x: 14, y: 14, width: 56, height: 46, fill: '#333c45', stroke: '#59646f' }), sv('text', { x: 42, y: 41, textAnchor: 'middle', class: 'co-m' }, 'EQ+CLK'));
  d.append(sv('line', { x1: 0, y1: 37, x2: 14, y2: 37, stroke: '#ffd38a', strokeWidth: 2 }));
  for (let k = 0; k < 4; k++) d.append(sv('line', { x1: 70, y1: 20 + k * 12, x2: 86, y2: 20 + k * 12, stroke: '#7fd1a0', strokeWidth: 2 }));
  d.append(sv('text', { x: 0, y: 76, class: 'co-s' }, 'égalise et réhorloge :'), sv('text', { x: 0, y: 88, class: 'co-s' }, 'le câble repart de 0'));
  f.append(d);
  return f;
}

registerChapter({
  id: 'sdi', title: 'Le SDI', icon: 'grille',
  intro: 'Le câble coaxial qui transporte l\'image dans le car : la trame, les débits, la longueur de câble et l\'œil, l\'audio embarqué, les connecteurs et le brassage.',
  lessons: [
    {
      id: 'sdi-cest-quoi', title: 'Le SDI : une image dans un câble coaxial', minutes: '7 min',
      essentials: [
        'Le **SDI** envoie les mots de 10 bits de l\'image (Y, puis Cb, Cr) en série, bit après bit, sur un **coaxial 75 Ω** à connecteur BNC.',
        'Chaque ligne commence par **SAV**, finit par **EAV** ; entre les lignes et les images, la **suppression** (HANC, VANC) transporte audio, timecode, métadonnées.',
        'Les débits suivent les formats : SD 270 Mb/s, **HD 1,485 Gb/s**, **3G 2,97**, 6G 5,94, **12G 11,88 Gb/s** (ST 259, 292-1, 424, 2081-1, 2082-1).',
      ],
      figure: figTrame,
      demoTitle: 'Promenez le curseur le long d\'une ligne : SAV, vidéo active, EAV, numéro de ligne, CRC, puis l\'espace ancillary.',
      demo: demoTrame,
      body: `**SDI** veut dire Serial Digital Interface : l'image numérique du chapitre précédent, mot après mot, bit après bit, sur un seul câble **coaxial 75 Ω** terminé par des **BNC**. Un câble, un sens, un signal : c'est la simplicité qui a fait sa réputation dans les cars. Le signal fait 800 mV crête à crête, il est embrouillé (scrambled) pour ne pas dépendre du contenu de l'image, et le récepteur en retire lui-même l'horloge.

Le SDI ne transporte pas que les pixels : il transporte le **raster complet**. En 1080, une ligne fait 2 640 mots par flux (il y a deux flux entrelacés mot à mot, Y et C), dont 1 920 de vidéo active. Les autres 720 forment la **suppression horizontale** : quatre mots d'**EAV** (3FF 000 000 XYZ, fin de ligne active), deux mots de numéro de ligne, deux mots de **CRC**, un espace libre, l'**HANC**, puis quatre mots de **SAV** avant la ligne suivante. Les 45 lignes de **suppression verticale** entre deux images forment le **VANC**. Les valeurs 3FF et 000 sont réservées à ces repères : c'est pourquoi l'image reste entre les codes 4 et 1 019.

Ces espaces ne sont pas perdus : on y range les **données ancillary** : jusqu'à 16 canaux audio (ST 299-1), le timecode, l'identifiant de format (ST 352), des sous-titres. Un seul BNC porte donc l'image, le son et le temps : c'est la leçon sur l'audio embarqué.

Le débit se déduit du raster : 2 640 × 1 125 mots × 25 images × 2 flux × 10 bits = 1,485 Gb/s, le **HD-SDI** (ST 292-1, pour le 1080i25, le 1080p25 et le 720p50). À 50 images progressives, le **3G-SDI** (ST 424, 2,97 Gb/s). L'UHD multiplie par quatre : **6G** (ST 2081-1, 5,94 Gb/s) pour le 2160p25, **12G** (ST 2082-1, 11,88 Gb/s) pour le 2160p50. La SD historique (ST 259) était à 270 Mb/s. Chaque norme précise aussi le câble : 75 Ω, perte de retour d'au moins 15 dB, et ce qu'un récepteur doit accepter.

- Mots réservés : 3FF et 000 (EAV, SAV, drapeaux ancillary). L'image : 4 à 1 019.
- EAV porte F (trame), V (suppression verticale) et H (suppression horizontale) : le récepteur se repère sans compter.
- 1 mot toutes les 6,73 ns à 148,5 MHz (1080p50) : une ligne dure 17,8 µs, une image 20 ms.`,
      car: { text: 'La grille Videohub du car, les baies CCU et la transmission se parlent en 3G-SDI (1080p50) ou 12G-SDI (UHD) : ce sont les câbles coaxiaux BNC que vous suivez dans la zone technique. La tuile État SDI de la baie de mesure lit le format (VPID) et les CRC de chaque signal.', station: 'grille' },
      terms: ['12g-sdi', 'crc-edh', 'vpid', 'amplitude-sdi'],
      quiz: [
        { q: 'Quel débit pour le 3G-SDI ?', choices: ['1,485 Gb/s', '2,97 Gb/s', '11,88 Gb/s'], answer: 1, why: '3G-SDI (ST 424) = 2,97 Gb/s, de quoi porter le 1080p50. 1,485 Gb/s est le HD-SDI (1080i, 720p) ; 11,88 Gb/s le 12G-SDI (2160p50).' },
        { q: 'À quoi servent les mots EAV et SAV ?', choices: ['À transporter le son', 'À marquer la fin et le début de la vidéo active de chaque ligne', 'À corriger les erreurs de transmission'], answer: 1, why: 'EAV (End of Active Video) et SAV (Start) encadrent la zone active de chaque ligne et portent les bits F, V, H. Le son est dans l\'HANC, entre les deux ; les erreurs sont détectées (pas corrigées) par le CRC.' },
        { q: 'Pourquoi le débit du HD-SDI (1,485 Gb/s) dépasse-t-il le débit utile de l\'image 1080i (1,04 Gb/s) ?', choices: ['Parce que le SDI transporte aussi la suppression horizontale et verticale', 'Parce que le SDI ajoute une compression', 'Parce que le câble perd une partie des bits'], answer: 0, why: 'Le SDI envoie le raster complet, 2 640 × 1 125 mots au lieu de 1 920 × 1 080 : la suppression (EAV, SAV, HANC, VANC) prend l\'écart. Le SDI n\'est jamais compressé, et un câble ne « perd » pas de bits tant que l\'œil est ouvert.' },
      ],
    },
    {
      id: 'sdi-oeil', title: 'Longueur de câble et diagramme de l\'œil', minutes: '9 min',
      essentials: [
        'Un coaxial atténue d\'autant plus que la fréquence est haute : à la demi-fréquence d\'horloge, un 1694A perd ≈ 18 dB/100 m en HD, ≈ 26 en 3G, ≈ 58 en 12G.',
        'Le **diagramme de l\'œil** superpose les bits : l\'œil brut se ferme avec le câble, l\'**égaliseur** du récepteur le rouvre jusqu\'à son budget (20 dB garantis en HD et 3G, 40 dB en 12G).',
        'En numérique, l\'image reste parfaite puis tombe **d\'un coup** (effet de falaise) : HD ≈ 200 m, 3G ≈ 120–140 m, 12G ≈ 70–80 m sur un bon câble, ordres de grandeur.',
      ],
      figure: figOeil,
      demoTitle: 'Allongez le câble en 3G : l\'œil brut se ferme, l\'œil égalisé tient, puis tout tombe. Comparez avec le HD et le 12G, et avec un câble mince.',
      demo: demoOeil,
      body: `Un signal SDI est une suite de 0 et de 1 à 1,485, 2,97 ou 11,88 milliards de bits par seconde. Dans un coaxial, les fronts s'arrondissent : le câble **atténue** d'autant plus que la fréquence est élevée, et un bit qui alterne à chaque période est la fréquence la plus haute du signal, la **demi-fréquence d'horloge** (742,5 MHz en HD, 1,485 GHz en 3G, 5,94 GHz en 12G). C'est à cette fréquence que l'on compte l'affaiblissement : pour un Belden 1694A (le RG6 de référence des cars), environ 17,7 dB par 100 m en HD, 25,6 en 3G, 58 en 12G (fiche technique). Un câble plus mince (RG59, mini-coax) perd nettement plus.

Le **diagramme de l'œil** rend cela visible : l'instrument récupère l'horloge et dessine des milliers de bits les uns sur les autres. Au centre reste un espace vide, l'**œil** ; sa hauteur est la marge entre un 0 et un 1, l'épaisseur des croisements est la **gigue**. Un œil **brut** se ferme vite : après quelques dizaines de mètres en 3G, c'est normal. Tout récepteur SDI contient un **égaliseur adaptatif** qui remonte les hautes fréquences perdues et rouvre l'œil. Les normes exigent qu'il compense au moins **20 dB** (HD, 3G) ou **40 dB** (6G, 12G) : avec un 1694A, cela fait 113 m garantis en HD, 78 m en 3G, 69 m en 12G. Les égaliseurs actuels font mieux, de l'ordre de 35 à 40 dB, d'où les ≈ 200 m, ≈ 140 m et ≈ 70 m que les constructeurs annoncent pour ce câble : vrai en général, garanti nulle part.

Mais l'égaliseur remonte aussi le bruit : plus le câble est long, plus l'**œil égalisé** se referme, et la gigue d'alignement monte. Tant que l'œil reste ouvert à l'instant de lecture, chaque bit est lu juste et l'image est **parfaite**. Sur les derniers décibels, le taux d'erreur grimpe de plusieurs ordres de grandeur en quelques mètres : quelques erreurs CRC par minute, puis des éclats dans l'image, puis plus de verrouillage. C'est l'**effet de falaise** : rien ne prévient, sinon les compteurs CRC et la marge d'égaliseur lus à la baie de mesure.

Les règles qui en découlent dans un car : des **liaisons courtes** (la grille est au milieu, tout y converge), un **câble de qualité** connu (son affaiblissement figure sur la fiche), des **marges** de plusieurs dB avant le direct, un **répéteur** (reclocker) ou de la **fibre** quand une liaison dépasse la centaine de mètres en 3G (le retour d'une caméra de fond de stade, un duplex), et la vigilance en 12G, où tout va quatre fois plus vite et où un connecteur fatigué suffit à fermer l'œil.

- Amplitude à l'émission : 800 mV ± 10 % ; temps de montée ≤ 270 ps (HD), 135 ps (3G), 45 ps (12G).
- Gigue d'alignement admise : 0,2 UI (HD), 0,3 UI (3G, 12G), où 1 UI = la durée d'un bit.
- Les longueurs de cette leçon sont des ordres de grandeur : elles dépendent du câble, de son âge, des connecteurs et du récepteur.`,
      car: { text: 'À la baie de mesure, le préréglage « Couche physique » du PRISM affiche le diagramme de l\'œil (brut et égalisé), la gigue, l\'affaiblissement estimé en mètres de 1694A, la marge de l\'égaliseur et les CRC. La panne « touret » du scénario met plus de 100 m de câble en 3G sur une caméra : c\'est le moment de le lire.', station: 'mesure' },
      terms: ['oeil', 'affaiblissement', 'egaliseur', 'effet-falaise', 'gigue-alignement', 'ui', 'crc-edh'],
      quiz: [
        { q: 'Pourquoi un même câble porte-t-il moins loin le 12G-SDI que le HD-SDI ?', choices: ['Parce que le 12G demande plus d\'amplitude', 'Parce que l\'affaiblissement du coaxial augmente avec la fréquence, et le 12G va huit fois plus vite', 'Parce que le 12G n\'est pas compatible avec le BNC'], answer: 1, why: 'L\'amplitude est la même (800 mV) et le BNC aussi. Mais à 5,94 GHz de demi-horloge, un 1694A perd ≈ 58 dB/100 m contre ≈ 18 en HD : la longueur utile tombe de ≈ 200 m à ≈ 70 m.' },
        { q: 'Que fait l\'égaliseur d\'un récepteur SDI ?', choices: ['Il remonte les hautes fréquences perdues dans le câble et rouvre l\'œil, jusqu\'à sa limite', 'Il corrige les bits faux', 'Il augmente la tension du signal jusqu\'à 1,6 V'], answer: 0, why: 'L\'égaliseur compense l\'affaiblissement du câble (20 dB garantis en HD et 3G, davantage en pratique). Il ne corrige aucun bit : au-delà de sa limite, les erreurs apparaissent d\'un coup. 1,6 V, c\'est ce qu\'on mesure sur une sortie non terminée, un défaut.' },
        { q: 'Une liaison 3G de 150 m en 1694A fonctionne sans erreur au line-up. Que faut-il en penser ?', choices: ['Tout va bien, rien à faire', 'Elle est au-delà des 20 dB garantis : elle tient grâce à l\'égaliseur, sans marge ; surveiller les CRC ou ajouter un répéteur', 'C\'est impossible : le 3G s\'arrête à 78 m'], answer: 1, why: '150 m × 25,6 dB/100 m ≈ 38 dB : au-delà des 20 dB exigés par ST 424 et au bord de ce qu\'un bon égaliseur sait faire. L\'image parfaite ne dit rien de la marge : seuls les CRC et la mesure de l\'égaliseur la donnent. Un répéteur à mi-parcours la rétablit.' },
      ],
    },
    {
      id: 'sdi-embedded', title: 'Audio et données embarqués (ancillary)', minutes: '7 min',
      essentials: [
        'L\'espace libre de la suppression (**HANC**, **VANC**) transporte des **paquets ancillary** : audio, timecode, identifiant de format, sous-titres.',
        'L\'audio embarqué (ST 299-1) : **16 canaux** en **4 groupes** de 4, 48 kHz, 24 bits, un paquet par groupe et par ligne dans l\'HANC ; jusqu\'à 32 canaux en 3G et 12G (ST 299-2).',
        'Un seul BNC porte image, son et timecode ; l\'**embedder** les y range, le **désembeddeur** les ressort en AES ou analogique.',
      ],
      figure: figEmbedded,
      demoTitle: 'Cochez des canaux : chaque groupe présent ajoute un paquet de 31 mots dans l\'HANC. Retirez le timecode, puis le VPID, et lisez ce que le câble transporte encore.',
      demo: demoEmbedded,
      body: `Entre l'EAV et le SAV de chaque ligne, le SDI laisse plus de 700 mots inutilisés ; entre deux images, 45 lignes entières. La norme ST 291 y définit des **paquets ancillary** : un drapeau de trois mots (000 3FF 3FF, des valeurs que l'image ne peut pas prendre), un identifiant de type (**DID**, et SDID ou DBN), le nombre de mots de données, les données, une somme de contrôle. Un récepteur qui ne connaît pas un type de paquet l'ignore ; une grille, un DA les laissent passer intacts ; un mélangeur ou un convertisseur doivent les **réinsérer** sur leur sortie, et c'est là qu'ils se perdent parfois.

L'**audio embarqué** (ST 299-1 en HD et au-delà) est le paquet le plus courant : à chaque ligne, un paquet de 31 mots par **groupe** de quatre canaux, dans l'HANC du flux C, avec un échantillon de chacun des quatre canaux, à 48 kHz, 24 bits, verrouillés sur la vidéo. Quatre groupes font **16 canaux** sur un HD-SDI ; le 3G et le 12G en acceptent 32 (ST 299-2). Un paquet de contrôle par groupe et par image complète l'information (horloge, bits de validité). Seize canaux à 24 bits et 48 kHz font 18 Mb/s : 0,6 % d'une liaison 3G. Le son voyage donc gratuitement avec l'image, exactement synchrone, sur le même câble : pas de câble AES à tirer en plus, pas de décalage son-image à rattraper.

Le **timecode** (ATC, ST 12-2) tient dans un paquet de 23 mots placé dans la suppression verticale, une fois par image : c'est lui que lisent les serveurs de ralentis et l'enregistrement. L'**identifiant de charge utile** (VPID, ST 352, 11 mots) annonce le format : 1080p50, 4:2:2 10 bits, SDR ou HLG, BT.709 ou BT.2020 ; les appareils en aval s'y configurent. Les **sous-titres** (OP-47, ST 2031), des métadonnées HDR et d'autres encore utilisent le même mécanisme.

Dans le car, l'audio part de la régie son vers la vidéo : l'**embedder** (souvent intégré au mélangeur ou dans un châssis de conversion) écrit le mixage dans les groupes 1 et 2 du signal de sortie ; sur chaque CCU, les micros d'ambiance de la caméra arrivent déjà embarqués. En réception, le **désembeddeur** extrait les groupes voulus et les ressort par paires AES (canaux 1-2, 3-4…). Le réflexe à l'exploitation : savoir **quel canal est dans quel groupe**, et vérifier au multiview (barre-graphes audio) qu'un signal transporte bien le son qu'on croit.

- Un groupe = 4 canaux = 2 paires AES. Groupe 1 : canaux 1 à 4 ; groupe 2 : 5 à 8 ; groupe 3 : 9 à 12 ; groupe 4 : 13 à 16.
- Les paquets audio sont dans l'HANC du flux C (couleur) ; le timecode et le VPID dans le VANC (lignes 9 et 10 en 1080).
- Une commutation de grille entre deux sources aux groupes différents coupe le son sans toucher à l'image : vérifier l'embedding de chaque source.`,
      car: { text: 'La baie CCU sort les caméras avec leurs ambiances embarquées ; le mélangeur réinsère le mixage de la régie son dans le programme ; la transmission désembedde pour vérifier au casque. Au poste vision, le multiview affiche les barre-graphes des groupes embarqués sous chaque source.', station: 'ccu' },
      terms: ['vpid', 'crc-edh', 'grille', 'commutation-propre'],
      quiz: [
        { q: 'Combien de canaux audio un HD-SDI peut-il embarquer (ST 299-1) ?', choices: ['2', '8', '16'], answer: 2, why: 'Quatre groupes de quatre canaux : 16, à 48 kHz et jusqu\'à 24 bits. Le 3G et le 12G en acceptent 32 (ST 299-2). Deux canaux, c\'est une seule paire AES ; huit, deux groupes.' },
        { q: 'Où est placé le paquet audio dans le signal ?', choices: ['Dans la vidéo active, à la place de quelques pixels', 'Dans l\'HANC, entre l\'EAV et le SAV de chaque ligne', 'Dans un deuxième câble'], answer: 1, why: 'Les paquets ancillary occupent la suppression horizontale (HANC) pour l\'audio, verticale (VANC) pour le timecode et le VPID. Ils ne touchent jamais à la vidéo active, et il n\'y a qu\'un câble : c\'est tout l\'intérêt.' },
        { q: 'Après une commutation de grille, l\'image est bonne mais le son a disparu. Cause probable ?', choices: ['Le câble est trop long', 'La nouvelle source n\'embarque pas son audio dans le même groupe, ou pas du tout', 'La grille a écrêté le signal'], answer: 1, why: 'Un câble trop long fait des erreurs CRC et des éclats sur l\'image aussi ; une grille ne modifie rien. Si l\'image passe et pas le son, c\'est l\'embedding de la source qu\'il faut vérifier : groupe, canaux, embedder actif.' },
      ],
    },
    {
      id: 'sdi-cable', title: 'Connecteurs, câbles, brassage', minutes: '7 min',
      essentials: [
        'Tout doit être en **75 Ω** : câble, BNC, embases, adaptateurs. Une pièce **50 Ω** (BNC d\'informatique ou de radio) s\'emboîte et renvoie ≈ 20 % du signal : réflexions, dépassement, œil qui se ferme.',
        'Chaque appareil qui **égalise et réhorloge** (grille, DA, mélangeur) remet le compteur à zéro : le budget de câble se compte **par liaison**, pas sur toute la chaîne.',
        'Les passages en **brassage** et les raccords coûtent chacun quelques dixièmes de dB et une réflexion possible : une liaison longue se fait d\'un seul tenant, ou avec un répéteur.',
      ],
      figure: figCable,
      demoTitle: 'Allongez la liaison CCU → grille jusqu\'au rouge et voyez où placer un DA ; cochez une pièce 50 Ω sur une liaison courte : la longueur est bonne, la liaison ne l\'est plus.',
      demo: demoChaine,
      body: `Le SDI est une ligne de transmission : la source a une impédance de 75 Ω, le câble 75 Ω, la charge 75 Ω. Tant que c'est le cas, l'énergie file d'un bout à l'autre. Toute **rupture d'impédance** renvoie une partie du signal vers la source : une **réflexion**, qui se superpose aux bits suivants, crée un **dépassement** après chaque front et referme l'œil. Les normes demandent une perte de retour d'au moins 15 dB, soit moins de 3 % d'énergie réfléchie ; une pièce 50 Ω donne un coefficient de réflexion de 20 % (14 dB), déjà hors tolérance, et plusieurs ruptures s'additionnent.

Le piège des connecteurs : les **BNC 50 Ω** (réseaux informatiques, radio, instruments) et les **BNC 75 Ω** ont la même bague et s'emboîtent. De face, la 50 Ω montre une broche plus épaisse et un diélectrique blanc autour ; la 75 Ω laisse de l'air autour d'une broche fine. Un adaptateur, un cordon de mesure, un « T », une embase d'oscilloscope : chaque pièce étrangère se vérifie. Un BNC mal serti, un câble écrasé dans une porte ou plié trop court font le même effet. Et une entrée bouclée sans bouchon de 75 Ω (loop-through non terminé) renvoie tout le signal : on mesure alors 1,6 V au lieu de 800 mV.

La **baie de brassage** (jackfield) est le carrefour des liaisons : des embases en rangées, des cordons courts pour relier ce que la grille ne sait pas faire. Chaque passage ajoute deux connecteurs et un cordon : de l'ordre de 0,5 dB, peu, mais aussi une rupture d'impédance potentielle à chaque usure. Les pannes « intermittentes » naissent là : un cordon fatigué, un U-link à moitié enfoncé.

Le **distributeur-répéteur** (DA, reclocker) est le remède aux longueurs : il égalise la liaison d'entrée, relit les bits avec une horloge propre et renvoie un signal neuf, en plusieurs exemplaires. Une grille fait la même chose sur chacune de ses sorties : c'est pourquoi le budget de câble se compte **par liaison** : 120 m de CCU à grille puis 25 m de grille à mélangeur ne font pas 145 m, mais deux liaisons séparées. Par contre, rien ne répare un signal déjà faux : un répéteur placé après une pièce 50 Ω régénère des erreurs.

- Avant le direct : vérifier à la baie de mesure l'œil, le dépassement (≤ 10 %), les CRC à zéro et la marge de chaque liaison longue.
- Câble : le 1694A (RG6) pour le 3G, un câble prévu 12G (4794R…) pour l'UHD ; les minis (1855A) pour les cordons courts.
- Au-delà de ce que le coaxial permet, la **fibre** : SMPTE pour les caméras, convertisseurs SDI ↔ fibre pour une liaison longue, puis le réseau IP.`,
      car: { text: 'Dans la zone technique du car : la baie de brassage, les DA, les cordons et les tourets de 1694A. La panne « cordon abîmé » du scénario fait monter le dépassement à la baie de mesure ; la panne « touret » allonge une liaison 3G au-delà de 100 m, et le bouton « Insérer un répéteur » sauve l\'une mais pas l\'autre.', station: 'brassage' },
      terms: ['overshoot', 'reclocker', 'reclocking', 'amplitude-sdi', 'affaiblissement', 'egaliseur'],
      quiz: [
        { q: 'Un cordon BNC 50 Ω inséré dans une liaison SDI courte…', choices: ['Ne change rien : il s\'emboîte, le signal passe', 'Crée une réflexion (≈ 20 % du signal) et un dépassement qui peuvent fermer l\'œil', 'Double l\'affaiblissement du câble'], answer: 1, why: 'La rupture d\'impédance renvoie une partie du signal vers la source ; les fronts suivants se déforment (dépassement > 10 %), l\'œil se ferme même sur 5 m. L\'affaiblissement, lui, ne dépend que de la longueur et de la fréquence.' },
        { q: 'Une chaîne CCU → grille (120 m) → mélangeur (25 m) en 3G : quelle longueur compte pour l\'égaliseur du mélangeur ?', choices: ['145 m', '25 m', '120 m'], answer: 1, why: 'La grille égalise et réhorloge chaque signal avant de le renvoyer : le mélangeur ne voit que ses 25 m. Les 120 m sont le problème de l\'entrée de la grille. Le budget se compte par liaison.' },
        { q: 'Un répéteur (reclocker) peut-il sauver une liaison qui passe par une pièce 50 Ω ?', choices: ['Oui, il régénère le signal', 'Non : il régénère aussi les erreurs déjà commises en amont ; il faut remplacer la pièce', 'Oui, à condition de le placer avant la pièce 50 Ω'], answer: 1, why: 'Un répéteur allonge une liaison trop longue mais ne répare pas un signal déjà lu de travers. Placé avant la pièce, il ne change rien à la réflexion qui suit. Seul le remplacement de la pièce 50 Ω corrige la liaison.' },
      ],
    },
  ],
});

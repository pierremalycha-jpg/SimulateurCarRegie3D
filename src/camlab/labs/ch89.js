// @ts-check
import { el, clamp } from '../../util.js';
import { MIRE_D, zoomPos, exposureOf, fr, castOf, blur, distLabel } from '../optics.js';
import { whiteLevels, drawScope, cnv } from '../vf.js';
import { slider, seg, toggle, btnRow, linkBtn, lensRings, lensState, shell, scopeCanvas, irisPos, pointPos } from '../controls.js';

// ----------------------------------------------------------------------------------
// Manipulations des fiches du module caméra : jusqu'au moniteur, et pour aller plus loin
// (chapitres 8 et 9). Chacune reçoit ctx = { lens(état) } et renvoie { node, dispose } (voir
// ../labs.js). Le viseur simulé est dans ../vf.js, les commandes communes dans ../controls.js,
// les calculs d'optique dans ../optics.js ; les calculs propres à ces fiches sont en tête de ce
// fichier (exportés pour tests/unit/camlab-ch89.test.mjs) :
// - courbe de prise de vue BT.709 (OETF), luminance et différences de couleur BT.709 et BT.601 ;
// - HLG (ITU-R BT.2100) : courbe, blanc de référence à 75 % (BT.2408), écran de 1 000 cd/m² ;
// - moniteur : courbe d'affichage gamma 2,4 (BT.1886), luminosité, contraste, chroma, PLUGE ;
// - profondeur de champ selon la taille du capteur (cercle de confusion proportionnel) ;
// - super ralenti : lumière perdue, phases, scintillement d'une lampe à 100 Hz ;
// - étoile de Siemens : le disque gris du centre ; charte de onze gris.
// ----------------------------------------------------------------------------------

// ================================ les calculs =================================
/** courbe de prise de vue BT.709 : lumière linéaire (1 = blanc) → signal (0 à 1), écrêté à 100 % */
export const oetf709 = (L) => (L <= 0 ? 0 : L >= 1 ? 1 : L < 0.018 ? 4.5 * L : 1.099 * Math.pow(L, 0.45) - 0.099);
/** l'inverse : signal (0 à 1) → lumière linéaire */
export const oetf709inv = (V) => (V <= 0 ? 0 : V >= 1 ? 1 : V < 0.081 ? V / 4.5 : Math.pow((V + 0.099) / 1.099, 1 / 0.45));
// table de la courbe, pour les images calculées pixel par pixel
const LUT_N = 4096; const LUT = new Float32Array(LUT_N + 1);
for (let i = 0; i <= LUT_N; i++) LUT[i] = oetf709(i / LUT_N);
const enc = (l) => (l <= 0 ? 0 : l >= 1 ? 1 : LUT[(l * LUT_N) | 0]);

/** coefficients de luminance : BT.709 (HD) et BT.601 (SD) */
export const K709 = [0.2126, 0.7152, 0.0722];
export const K601 = [0.299, 0.587, 0.114];
/** R′, V′, B′ (0 à 1) → [Y′, Cb, Cr] ; Cb et Cr vont de −0,5 à +0,5 */
export function ycc(r, g, b, k = K709) {
  const Y = k[0] * r + k[1] * g + k[2] * b;
  return [Y, (b - Y) / (2 * (1 - k[2])), (r - Y) / (2 * (1 - k[0]))];
}
/** [Y′, Cb, Cr] → [R′, V′, B′] */
export function rgbOf(Y, cb, cr, k = K709) {
  const r = Y + 2 * (1 - k[0]) * cr, b = Y + 2 * (1 - k[2]) * cb;
  return [r, (Y - k[0] * r - k[2] * b) / k[1], b];
}
/** angle sur le vectorscope (degrés, depuis l'axe Cb, sens inverse des aiguilles) : la teinte */
export const hueOf = (cb, cr) => ((Math.atan2(cr, cb) * 180 / Math.PI) + 360) % 360;
/** les six couleurs des barres : nom, R, V, B */
/** @type {[string, number, number, number][]} */
export const BARS6 = [['Yl', 1, 1, 0], ['Cy', 0, 1, 1], ['G', 0, 1, 0], ['Mg', 1, 0, 1], ['R', 1, 0, 0], ['B', 0, 0, 1]];
/** la cible d'une barre (niveau 0,75 pour des barres à 75 %) : Cb, Cr, teinte, distance au centre */
export function barVector(name, level = 0.75, k = K709) {
  const b = BARS6.find((x) => x[0] === name);
  const [, cb, cr] = ycc(b[1] * level, b[2] * level, b[3] * level, k);
  return { cb, cr, hue: hueOf(cb, cr), sat: Math.hypot(cb, cr) };
}
/** la ligne des carnations du vectorscope (l'ancien axe I), en degrés */
export const SKIN_LINE = 123;
/** les sept barres à 75 % de la sortie BARS (gris, jaune, cyan, vert, magenta, rouge, bleu), en signal */
export const BAR7 = [[0.75, 0.75, 0.75], [0.75, 0.75, 0], [0, 0.75, 0.75], [0, 0.75, 0], [0.75, 0, 0.75], [0.75, 0, 0], [0, 0, 0.75]];

/** niveau (%) sur la forme d'onde d'une surface de couleur rgb (lumière linéaire, 1 = blanc parfait) exposée à E */
export function lumaOf(rgb, E, k = K709) {
  const v = rgb.map((x) => oetf709(x * E));
  return 100 * (k[0] * v[0] + k[1] * v[1] + k[2] * v[2]);
}
/** la scène de la forme d'onde : couleurs des surfaces en lumière linéaire (part de la lumière renvoyée) */
export const SCENE_WF = {
  curtain: [0.05, 0.07, 0.16], card: [0.18, 0.18, 0.18], jacket: [0.035, 0.035, 0.04], shirt: [0.8, 0.8, 0.8],
  skin: [0.58, 0.34, 0.26], hair: [0.05, 0.035, 0.025], window: [3.8, 4, 4.3],
};
/** lumière du plateau de la forme d'onde : à f/5,6, l'exposition vaut 1 (un blanc parfait à 100 %) */
export const WF_K = 0.5;

// ---- HLG (ITU-R BT.2100) ----
const HLG_A = 0.17883277, HLG_B = 1 - 4 * HLG_A, HLG_C = 0.5 - HLG_A * Math.log(4 * HLG_A);
/** courbe HLG : lumière de la scène (0 à 1) → signal (0 à 1) */
export const hlg = (E) => (E <= 0 ? 0 : E >= 1 ? 1 : E <= 1 / 12 ? Math.sqrt(3 * E) : HLG_A * Math.log(12 * E - HLG_B) + HLG_C);
/** l'inverse : signal → lumière de la scène */
export const hlgInv = (V) => (V <= 0 ? 0 : V <= 0.5 ? V * V / 3 : (Math.exp((V - HLG_C) / HLG_A) + HLG_B) / 12);
/** lumière de la scène du blanc de référence HLG, posé à 75 % (BT.2408) : 0,265 */
export const HLG_REF = hlgInv(0.75);
/** luminance (cd/m²) d'un gris neutre sur un écran HLG de crête Lw : Lw × E^γ, γ = 1,2 à 1 000 cd/m² (BT.2100) */
export const hlgNits = (E, Lw = 1000) => Lw * Math.pow(clamp(E, 0, 1), 1.2 + 0.42 * Math.log10(Lw / 1000));
/** luminance (cd/m²) d'un signal V sur un écran SDR (BT.1886) de blanc Lw et de noir Lb */
export function bt1886(V, Lw = 100, Lb = 0) {
  const g = 2.4, a = Math.pow(Math.pow(Lw, 1 / g) - Math.pow(Lb, 1 / g), g), b = Math.pow(Lb, 1 / g) / (Math.pow(Lw, 1 / g) - Math.pow(Lb, 1 / g));
  return a * Math.pow(Math.max(V + b, 0), g);
}

// ---- le moniteur de référence ----
/** ce que l'écran affiche d'un signal V : contraste × V + luminosité, borné de 0 à 1 */
export const monV = (V, br, c) => clamp(c * V + br, 0, 1);
/** luminance maximale de la dalle (cd/m²), ordre de grandeur d'un moniteur LCD de contrôle */
export const MON_PEAK = 250;
/** luminance (cd/m²) affichée pour le signal V */
export const monNits = (V, br, c) => MON_PEAK * Math.pow(monV(V, br, c), 2.4);
/** écart de signal affiché à partir duquel une plage se distingue de sa voisine (modèle de la manipulation) */
export const SEEN = 0.005;
/** la PLUGE : la barre à −2 % se voit-elle sur le noir ? et celle à +2 % ? */
export const pluge = (br, c) => ({ m2: monV(0, br, c) - monV(-0.02, br, c) > SEEN, p2: monV(0.02, br, c) - monV(0, br, c) > SEEN });
/** bleu seul : la voie bleue affichée des quatre barres qui en contiennent (gris, cyan, magenta, bleu), chroma × k */
export function blueOnly(k, br = 0, c = 1, level = 0.75) {
  return [[level, level, level], [0, level, level], [level, 0, level], [0, 0, level]].map(([r, g, b]) => {
    const [Y, cb] = ycc(r, g, b); return monV(Y + 2 * (1 - K709[2]) * cb * k, br, c);
  });
}

// ---- grand capteur : profondeur de champ à cadre égal ----
/** largeur de l'image (mm) : 2/3" 16:9 et Super 35 (environ 25 mm, ordre de grandeur selon les caméras) */
export const W23 = 9.59, WS35 = 24.9;
/** cercle de confusion (mm), proportionnel au capteur : 0,011 mm en 2/3" (deux photosites HD) */
export const cocOf = (W) => 0.011 * W / W23;
/** focale (mm) qui cadre un champ de `field` m de large à D m, sur un capteur de W mm */
export const focalFor = (W, D, field) => W * D / field;
/** zone nette (m) : focale f (mm), ouverture N, point à s (m), cercle de confusion c (mm) */
export function dofOf(f, N, s, c) {
  const H = (f * f / (N * c) + f) / 1000, fm = f / 1000;
  const near = s * (H - fm) / (H + s - 2 * fm), far = s >= H ? Infinity : s * (H - fm) / (H - s);
  return { near, far, total: far - near };
}
/** diamètre de la tache de flou d'un fond à d (m), point à s (m), en part de la largeur W (mm) de l'image */
export const bgBlurFrac = (f, N, s, d, W) => (f * f / N) * Math.abs(1 / (s * 1000) - 1 / (d * 1000)) * (s * 1000) / (s * 1000 - f) / W;

// ---- super ralenti ----
/** lumière perdue (diaphragmes) quand la cadence est multipliée par k, temps de pose à 1 ÷ cadence */
export const hfrStops = (k) => Math.log2(k);
/**
 * lumière reçue par l'image n (1 = sans scintillement) : lampe qui bat à f0 Hz avec une profondeur m
 * (lumière 1 + m·cos(2πf0t + φ)), image exposée pendant toute sa durée 1 ÷ fps. φ : décalage entre
 * la lampe et la caméra, quelconque (elles ne sont pas synchronisées).
 */
export function frameLight(n, fps, m, f0 = 100, phi = 0.6) {
  if (!m) return 1;
  const T = 1 / fps, w = 2 * Math.PI * f0, t = n / fps;
  return 1 + m * (Math.sin(w * (t + T) + phi) - Math.sin(w * t + phi)) / (w * T);
}
/** écart (±) de lumière d'une image à l'autre, sous cette lampe */
export function flickerSpread(fps, m, f0 = 100, phi = 0.6) {
  let lo = Infinity, hi = -Infinity;
  for (let n = 0; n < 120; n++) { const b = frameLight(n, fps, m, f0, phi); lo = Math.min(lo, b); hi = Math.max(hi, b); }
  return (hi - lo) / 2;
}
/** l'image enregistrée montrée par l'image j de la sortie (50 i/s), caméra k× relue à la vitesse v */
export const shownFrame = (j, k, v) => Math.floor(j * v * k + 1e-9);

// ---- les mires ----
/** l'étoile de Siemens du module : 36 paires de secteurs ; photosite de 5 µm (9,59 mm ÷ 1920) */
export const STAR_PAIRS = 36, PITCH = 9.59 / 1920;
/**
 * diamètre (mm, mesuré sur la mire) du disque gris au centre de l'étoile, où les secteurs ne se
 * séparent plus : leur période sur le capteur passe sous 1,22 fois la tache de flou b (mm), ou sous
 * deux photosites. f : focale (mm), D : distance de la mire (m).
 */
export const starGrey = (f, D, b) => STAR_PAIRS * Math.max(1.22 * b, 2 * PITCH) * D * 1000 / (Math.PI * f);
/** la charte de onze gris : lumière renvoyée par chaque palier (le blanc renvoie 90 %) ; à E = 1/0,9, 0, 10… 100 % */
export const CHART = Array.from({ length: 11 }, (_, i) => (i === 0 ? 0.004 : 0.9 * oetf709inv(i / 10)));

// ============================== les outils communs ==============================
const send = (ctx, s) => { if (ctx && ctx.lens) ctx.lens(s); };
const readout = () => el('p', { class: 'cl-read' });
const DEG = Math.PI / 180;
/** un canvas de dessin, avec son nom accessible */
function canvas(w, h, label, cls = 'cl-vfc c89-cv') {
  const c = cnv(w, h); c.className = cls; c.setAttribute('role', 'img'); c.setAttribute('aria-label', label); return c;
}
const MONO = '"B612 Mono", monospace', SANS = '"Archivo", sans-serif';
/** une longueur en m, en cm sous le mètre */
const lenLabel = (m) => (!isFinite(m) ? 'jusqu\'à l\'infini' : m < 1 ? fr(m * 100, m < 0.1 ? 1 : 0) + ' cm' : fr(m, m < 10 ? 1 : 0) + ' m');
const pctLabel = (p, d = 0) => fr(p, d) + ' %';

/** forme d'onde de luminance (0 à 110 %) d'une image, le repère 103 % et un curseur (%) */
export function drawWave(cv, img, cursor = null) {
  const g = cv.getContext('2d'), w = cv.width, h = cv.height, L = 30, R = w - 6, top = 8, bot = h - 14;
  const yOf = (p) => bot - (bot - top) * p / 110;
  g.fillStyle = '#05070a'; g.fillRect(0, 0, w, h);
  g.lineWidth = 1; g.font = `600 10px ${MONO}`; g.textBaseline = 'middle';
  for (let p = 0; p <= 100; p += 10) {
    const y = Math.round(yOf(p)) + 0.5;
    g.strokeStyle = p % 50 === 0 ? 'rgba(130,220,170,0.36)' : 'rgba(130,220,170,0.14)';
    g.beginPath(); g.moveTo(L, y); g.lineTo(R, y); g.stroke();
    if (p % 20 === 0 || p === 100) { g.fillStyle = 'rgba(160,215,185,0.75)'; g.textAlign = 'right'; g.fillText(String(p), L - 4, y); }
  }
  const y103 = Math.round(yOf(103)) + 0.5;
  g.strokeStyle = 'rgba(255,110,100,0.8)'; g.setLineDash([4, 3]); g.beginPath(); g.moveTo(L, y103); g.lineTo(R, y103); g.stroke(); g.setLineDash([]);
  g.fillStyle = 'rgba(255,150,140,0.95)'; g.textAlign = 'left'; g.fillText('103 %', L + 4, y103 - 7);
  if (img) {
    const d = img.data, W = img.width, H = img.height, pw = R - L, ph = bot - top + 1;
    const bins = new Uint16Array(pw * ph);
    for (let y = 0; y < H; y += 2) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4, p = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 2.55;
        const bx = Math.min(pw - 1, Math.floor(x / W * pw)), by = Math.round(yOf(p) - top);
        if (by >= 0 && by < ph) bins[by * pw + bx]++;
      }
    }
    const out = g.getImageData(L, top, pw, ph), o = out.data;
    for (let k = 0; k < bins.length; k++) {
      const n = bins[k]; if (!n) continue;
      const a = Math.min(1, 0.22 + n * 0.07), j = k * 4;
      o[j] += (130 - o[j]) * a; o[j + 1] += (240 - o[j + 1]) * a; o[j + 2] += (170 - o[j + 2]) * a; o[j + 3] = 255;
    }
    g.putImageData(out, L, top);
  }
  if (cursor != null) {
    const y = Math.round(yOf(cursor)) + 0.5;
    g.strokeStyle = '#ffd060'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(L, y); g.lineTo(R, y); g.stroke();
    g.fillStyle = '#ffd060'; g.textAlign = 'right'; g.fillText('curseur ' + pctLabel(cursor, 1), R - 2, y - 8);
  }
  g.fillStyle = 'rgba(160,215,185,0.6)'; g.textAlign = 'right'; g.fillText('forme d\'onde · luminance', R, h - 6);
  g.textBaseline = 'alphabetic';
}

/**
 * vectorscope : pts = suite [cb, cr, poids…] ; cibles des barres à tg % ; zoom ×1 ou ×5 ;
 * la ligne des carnations à 123°.
 */
export function drawVec(cv, pts, tg = 75, zoom = 1) {
  const g = cv.getContext('2d'), w = cv.width, h = cv.height, cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2 - 16;
  const sc = R / 0.56 * zoom;
  g.fillStyle = '#05070a'; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(130,220,170,0.4)'; g.lineWidth = 1; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = 'rgba(130,220,170,0.18)'; g.beginPath(); g.moveTo(cx - R, cy); g.lineTo(cx + R, cy); g.moveTo(cx, cy - R); g.lineTo(cx, cy + R); g.stroke();
  // les points de l'image : une petite tache par point, plus claire là où ils s'accumulent
  g.save(); g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.clip();
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < pts.length; i += 3) {
    const x = cx + pts[i] * sc, y = cy - pts[i + 1] * sc, a = Math.min(0.9, pts[i + 2]);
    g.fillStyle = `rgba(110,235,150,${a.toFixed(3)})`; g.fillRect(x - 1, y - 1, 2.2, 2.2);
  }
  g.restore();
  g.font = `700 11px ${MONO}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  if (zoom === 1) {
    for (const [n] of BARS6) {
      const t = barVector(n, tg / 100), x = cx + t.cb * sc, y = cy - t.cr * sc;
      g.strokeStyle = 'rgba(255,196,90,0.95)'; g.lineWidth = 1.4; g.strokeRect(x - 7, y - 7, 14, 14);
      const ox = t.cb / t.sat * 17, oy = -t.cr / t.sat * 17;
      g.fillStyle = 'rgba(255,214,140,0.95)'; g.fillText(n, x + ox, y + oy);
    }
    const a = SKIN_LINE * DEG;
    g.strokeStyle = 'rgba(255,200,170,0.55)'; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * R, cy - Math.sin(a) * R); g.stroke(); g.setLineDash([]);
    g.fillStyle = 'rgba(255,200,170,0.8)'; g.font = `600 10px ${SANS}`; g.textAlign = 'left'; g.fillText('carnations', cx + Math.cos(a) * R * 0.62 + 6, cy - Math.sin(a) * R * 0.62 - 4);
  } else {
    g.strokeStyle = 'rgba(130,220,170,0.5)';
    for (let i = -6; i <= 6; i++) { if (!i) continue; const p = i * 0.01 * sc; if (Math.abs(p) > R) continue; g.beginPath(); g.moveTo(cx + p, cy - 3); g.lineTo(cx + p, cy + 3); g.moveTo(cx - 3, cy + p); g.lineTo(cx + 3, cy + p); g.stroke(); }
    g.fillStyle = 'rgba(160,215,185,0.75)'; g.font = `600 10px ${MONO}`; g.textAlign = 'left'; g.fillText('×5 : une graduation = 1 %', 6, h - 8);
  }
  g.fillStyle = 'rgba(160,215,185,0.75)'; g.font = `600 10px ${MONO}`; g.textAlign = 'left';
  g.fillText(zoom === 1 ? `cibles ${tg} %` : 'zoom ×5', 6, 10);
  g.textAlign = 'right'; g.fillText('Cb', cx + R + 12, cy - 8); g.textAlign = 'left'; g.fillText('Cr', cx + 5, cy - R - 6);
  g.textBaseline = 'alphabetic';
}

// ================================ les manipulations =================================
/** @type {Record<string, (ctx: any) => { node: HTMLElement, dispose: () => void }>} */
export const LABS_CH89 = {
  // =================================================================================
  /** la forme d'onde : exposer un visage, lire une carte grise, sauver une fenêtre */
  waveform(ctx) {
    const W = 480, H = 270, S = SCENE_WF;
    const st = { z: zoomPos(20), s: pointPos(MIRE_D), n: irisPos(11), nd: 1, cur: 50, win: false };
    const defis = [false, false, false]; const seen = { face: 0, shirt: 0, card: 0 };
    const view = canvas(W, H, 'L\'image de la caméra : un présentateur en veste sombre et chemise blanche devant un rideau bleu, une carte grise à gauche de l\'image');
    const wave = canvas(360, 170, 'Moniteur de forme d\'onde : chaque colonne de l\'image à sa place, la hauteur donne le niveau de 0 à 110 %', 'cl-scopec c89-wave');
    const rings = lensRings(st, () => up(), ['iris']);
    const cur = slider('Curseur', 0, 109, 0.5, st.cur, (v) => { st.cur = v; up(); });
    const read = readout();
    const sh = shell({ vf: { canvas: view }, scope: wave, ctrls: [...rings.rows, cur.row, read], defis: [
      'Expose le présentateur à l\'iris : le visage entre 60 et 70 %, sans que la chemise blanche touche 100 %.',
      'Lis le niveau de la carte grise : pose le curseur sur sa trace, à gauche de la forme d\'onde.',
      'On ouvre le rideau : une fenêtre au soleil derrière lui. Ferme l\'iris jusqu\'à ce que plus rien ne soit écrêté.',
    ] });
    const g = view.getContext('2d'); const id = g.createImageData(W, H);
    function paint(E) {
      const d = id.data;
      for (let y = 0, i = 0; y < H; y++) {
        const v = (y + 0.5) / H;
        for (let x = 0; x < W; x++, i += 4) {
          const u = (x + 0.5) / W, dx = u - 0.5;
          let c = S.curtain, k = 0.8 + 0.4 * (0.5 + 0.5 * Math.sin(u * 56.5)); // les plis du rideau
          if (st.win && u > 0.72 && u < 0.96 && v > 0.06 && v < 0.52) {
            if (u < 0.732 || u > 0.948 || v < 0.075 || v > 0.505 || Math.abs(u - 0.84) < 0.005) { c = S.jacket; k = 1; } else { c = S.window; k = 0.94 + 0.06 * (1 - v); }
          }
          if (u > 0.08 && u < 0.2 && v > 0.34 && v < 0.66) { c = S.card; k = 1; } else if (Math.abs(u - 0.14) < 0.005 && v >= 0.66) { c = S.jacket; k = 1; }
          const jw = 0.15 + 0.05 * (v - 0.66) / 0.34;
          if (v > 0.66 && Math.abs(dx) < jw) { c = S.jacket; k = 1; if (v < 0.9 && Math.abs(dx) < 0.045 * (0.9 - v) / 0.24) c = S.shirt; }
          else if (v > 0.52 && v <= 0.66 && Math.abs(dx) < 0.03) { c = S.skin; k = 0.85; }
          const ex = dx / 0.062, ey = (v - 0.38) / 0.16, hx = dx / 0.07, hy = (v - 0.33) / 0.13;
          if (ex * ex + ey * ey < 1) { if (v < 0.255) { c = S.hair; k = 1; } else { c = S.skin; k = 0.92 + 0.08 * Math.cos(ex * Math.PI / 2); } }
          else if (hx * hx + hy * hy < 1 && v < 0.3) { c = S.hair; k = 1; }
          const e = E * k;
          d[i] = 255 * enc(c[0] * e); d[i + 1] = 255 * enc(c[1] * e); d[i + 2] = 255 * enc(c[2] * e); d[i + 3] = 255;
        }
      }
      g.putImageData(id, 0, 0);
    }
    function olivier(N, face, shirt, card, win) {
      if (!isFinite(N)) return 'Iris fermé : l\'image est noire, toute la trace est tombée à 0 %. Rouvre l\'iris.';
      if (defis[2]) return `Plus rien n'est écrêté : la fenêtre est redescendue sous 100 %. Mais le visage est tombé à ${fr(face, 0)} % : un présentateur sombre devant une fenêtre juste. L'iris ne peut pas tout : il faut de la lumière sur le visage, ou moins de lumière dans la fenêtre (un voilage, un filtre sur la vitre).`;
      if (defis[1]) {
        const head = `Carte grise à ${fr(seen.card, 0)} % : une carte qui renvoie 18 % de la lumière donne environ 41 % quand un blanc parfait est à 100 %. C'est la courbe de la caméra (BT.709), pas une règle de trois. `;
        return head + (win >= 99.6 ? 'La fenêtre fait maintenant un trait plat en haut de la trace, à droite : elle est écrêtée. Ferme l\'iris jusqu\'à ce qu\'elle redescende, et regarde où tombe le visage.' : '');
      }
      if (defis[0]) {
        const head = `Visage à ${fr(seen.face, 0)} %, chemise à ${fr(seen.shirt, 0)} % : l'exposition est juste. `;
        const dd = st.cur - card;
        return head + (Math.abs(dd) <= 1.5 ? '' : `La carte grise est à gauche de l'image, donc à gauche de la trace : une ligne plate, ${dd > 0 ? 'plus bas' : 'plus haut'} que ton curseur.`);
      }
      if (shirt >= 99.6) return 'La chemise blanche fait un trait plat sur la ligne des 100 % : elle est écrêtée, ses plis ont disparu. Ferme un peu l\'iris.';
      if (face < 60) return 'Le visage, c\'est la bosse au milieu de la trace, sous celle de la chemise. Elle est sous 60 % : ouvre l\'iris (un nombre f plus petit).';
      if (face > 70) return 'Le visage passe au-dessus de 70 % : ferme un peu l\'iris.';
      return '';
    }
    function up() {
      const o = rings.read(); rings.show();
      const E = isFinite(o.N) ? exposureOf(o.N) * WF_K : 0;
      const face = lumaOf(S.skin, E), shirt = lumaOf(S.shirt, E), card = lumaOf(S.card, E), win = lumaOf(S.window, E);
      if (!defis[0] && face >= 60 && face <= 70 && shirt < 99.6) { defis[0] = true; seen.face = face; seen.shirt = shirt; }
      if (defis[0] && !defis[1] && Math.abs(st.cur - card) <= 1.5) { defis[1] = true; seen.card = card; st.win = true; }
      if (defis[1] && !defis[2] && win < 99.6) defis[2] = true;
      cur.out.textContent = pctLabel(st.cur, 1);
      read.textContent = isFinite(o.N) ? `Iris f/${fr(o.N)} : ${E >= 1 ? '×' + fr(E, 2) : '÷' + fr(1 / Math.max(E, 1e-6), 2)} de lumière par rapport à f/5,6${st.win ? ' · rideau ouvert' : ''}` : 'Iris fermé : aucune lumière.';
      paint(E); drawWave(wave, id, st.cur);
      sh.done(defis); sh.say(olivier(o.N, face, shirt, card, win));
      send(ctx, lensState(st, o, { iris: isFinite(o.N) ? o.N : 99, light: WF_K }));
    }
    sh.node.append(btnRow(linkBtn('Recommencer', () => { Object.assign(st, { n: irisPos(11), cur: 50, win: false }); cur.set(50); defis.fill(false); rings.sync(); up(); })));
    up();
    return { node: sh.node, dispose() {} };
  },

  // =================================================================================
  /** le vectorscope : les barres dans leurs cibles, le gris au centre, le visage sur la ligne */
  vecto(ctx) {
    const W = 480, H = 270, E = 0.75, cast = castOf(3200, 5600);
    const st = { out: 'BARS', tg: 100, zoom: 1, gR: 1, gB: 1, hue: 15, sat: 1 };
    const defis = [false, false, false];
    const view = canvas(W, H, 'L\'image de la caméra : les barres de couleur, ou une charte de cinq gris et un présentateur en maillot rouge');
    const vec = canvas(300, 300, 'Vectorscope : chaque point de l\'image placé selon sa couleur, l\'angle pour la teinte, la distance au centre pour la saturation', 'cl-scopec c89-vec');
    const outSw = seg('OUTPUT', [['BARS', 'BARS'], ['CAM', 'CAM']], st.out, (v) => { st.out = v; up(); });
    const tgSw = seg('Cibles', [[75, '75 %'], [100, '100 %']], st.tg, (v) => { st.tg = Number(v); up(); });
    const zSw = seg('Gain du scope', [[1, '×1'], [5, '×5']], st.zoom, (v) => { st.zoom = Number(v); up(); });
    const gR = slider('Gain R (RCP)', 0.3, 1.6, 0.005, st.gR, (v) => { st.gR = v; up(); });
    const gB = slider('Gain B (RCP)', 0.5, 3, 0.01, st.gB, (v) => { st.gB = v; up(); });
    const hue = slider('Matrice : teinte', -30, 30, 0.5, st.hue, (v) => { st.hue = v; up(); });
    const sat = slider('Saturation', 0.5, 1.5, 0.01, st.sat, (v) => { st.sat = v; up(); });
    const read = readout();
    const sh = shell({ vf: { canvas: view }, scope: vec, ctrls: [outSw.row, tgSw.row, zSw.row, gR.row, gB.row, hue.row, sat.row, read], defis: [
      'La caméra sort ses barres (OUTPUT sur BARS) : choisis les cibles qui leur correspondent.',
      'OUTPUT sur CAM : une charte grise sous des projecteurs tungstène. Ramène la tache des gris au centre avec les gains R et B (le zoom ×5 aide).',
      'Le visage doit tomber sur la ligne des carnations : corrige la teinte de la matrice, à 3° près.',
    ] });
    // la carte des surfaces : 0 fond, 1 à 5 les gris, 6 à 8 le visage (trois ombrés), 9 le cou, 10 le maillot, 11 les cheveux
    const GREYS = [0.72, 0.36, 0.18, 0.09, 0.045];
    const SKIN = [0.58, 0.34, 0.26];
    const BASE = [[0.05, 0.07, 0.13], ...GREYS.map((v) => [v, v, v]), ...[0.88, 0.94, 1].map((k) => SKIN.map((x) => x * k)), SKIN.map((x) => x * 0.85), [0.45, 0.03, 0.035], [0.05, 0.035, 0.025]];
    const REG = new Uint8Array(W * H), COUNT = new Uint32Array(BASE.length);
    for (let y = 0, i = 0; y < H; y++) {
      const v = (y + 0.5) / H;
      for (let x = 0; x < W; x++, i++) {
        const u = (x + 0.5) / W, dx = u - 0.68; let r = 0;
        if (u > 0.06 && u < 0.36) { const t = (v - 0.08) / 0.84; if (t > 0 && t < 1) { const j = Math.floor(t * 5), f = t * 5 - j; if (f > 0.06 && f < 0.94) r = 1 + j; } }
        if (v > 0.6 && Math.abs(dx) < 0.15 + 0.06 * (v - 0.6) / 0.4) r = 10;
        else if (v > 0.47 && v <= 0.6 && Math.abs(dx) < 0.028) r = 9;
        const ex = dx / 0.065, ey = (v - 0.33) / 0.15, hx = dx / 0.072, hy = (v - 0.29) / 0.12;
        if (ex * ex + ey * ey < 1) r = v < 0.215 ? 11 : 6 + (ex * ex < 0.3 ? 2 : ex * ex < 0.7 ? 1 : 0);
        else if (hx * hx + hy * hy < 1 && v < 0.26) r = 11;
        REG[i] = r; COUNT[r]++;
      }
    }
    /** une surface vue par la caméra : gains, courbe, puis matrice (teinte) et saturation */
    function proc(rgb) {
      const v = [enc(rgb[0] * E * cast[0] * st.gR), enc(rgb[1] * E * cast[1]), enc(rgb[2] * E * cast[2] * st.gB)];
      const [Y, cb0, cr0] = ycc(v[0], v[1], v[2]); const a = st.hue * DEG;
      const cb = st.sat * (cb0 * Math.cos(a) - cr0 * Math.sin(a)), cr = st.sat * (cb0 * Math.sin(a) + cr0 * Math.cos(a));
      return { Y, cb, cr, rgb: rgbOf(Y, cb, cr).map((x) => clamp(x, 0, 1)) };
    }
    const g = view.getContext('2d'); const id = g.createImageData(W, H);
    let seed = 7; const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296 - 0.5);
    function paint() {
      const pts = [];
      if (st.out === 'BARS') {
        BAR7.forEach((c, i) => { g.fillStyle = `rgb(${c.map((x) => Math.round(x * 255)).join(',')})`; g.fillRect(Math.round(i * W / 7), 0, Math.ceil(W / 7) + 1, H); });
        seed = 7;
        for (const c of BAR7) { const [, cb, cr] = ycc(c[0], c[1], c[2]); for (let n = 0; n < 40; n++) pts.push(cb + rnd() * 0.006, cr + rnd() * 0.006, 0.25); }
        return pts;
      }
      const P = BASE.map(proc), d = id.data;
      for (let i = 0, j = 0; i < REG.length; i++, j += 4) { const c = P[REG[i]].rgb; d[j] = c[0] * 255; d[j + 1] = c[1] * 255; d[j + 2] = c[2] * 255; d[j + 3] = 255; }
      g.putImageData(id, 0, 0);
      seed = 11;
      P.forEach((p, r) => { const n = Math.min(160, Math.ceil(COUNT[r] / 60)); for (let m = 0; m < n; m++) pts.push(p.cb + rnd() * 0.005, p.cr + rnd() * 0.005, 0.3); });
      return pts;
    }
    // la direction d'une dominante : la cible de barre la plus proche en angle
    const DIRS = [['vers le jaune', 'Yl'], ['vers le cyan', 'Cy'], ['vers le vert', 'G'], ['vers le magenta', 'Mg'], ['vers le rouge', 'R'], ['vers le bleu', 'B']];
    const dirOf = (h) => {
      let best = '', err = 999;
      for (const [t, n] of DIRS) { const e = Math.abs(((h - barVector(n).hue + 540) % 360) - 180); if (e < err) { err = e; best = t; } }
      return best;
    };
    function olivier(grey, skin) {
      const gOff = Math.hypot(grey.cb, grey.cr), sh = hueOf(skin.cb, skin.cr);
      if (defis[2]) return 'Le visage est sur la ligne des carnations. Quelle que soit la couleur de la peau, les visages tombent près de cette ligne : plus ou moins loin du centre, presque pas à un autre angle. Monte la saturation : les points s\'éloignent du centre sans tourner.';
      if (defis[1]) {
        if (st.out !== 'CAM') return 'Repasse OUTPUT sur CAM : le visage est dans l\'image de la caméra.';
        return `Les gris sont au centre : la balance est juste. Le visage tombe à ${fr(sh, 0)}°, ${sh > SKIN_LINE ? 'trop vers le jaune' : 'trop vers le rouge et le magenta'} : la ligne des carnations est à ${SKIN_LINE}°. Tourne la teinte de la matrice.`;
      }
      if (defis[0]) {
        if (st.out !== 'CAM') return 'Les barres tombent dans leurs cibles : la liaison jusqu\'au vectorscope est bonne. Passe OUTPUT sur CAM : la caméra filme la charte grise, sous les projecteurs tungstène.';
        if (gOff < 0.005) return 'Gris au centre.';
        return `La tache des gris est décalée ${dirOf(hueOf(grey.cb, grey.cr))} : l'image a une dominante (la caméra est réglée pour la lumière du jour). ${grey.cr > 0.004 ? 'Trop de rouge : baisse le gain R. ' : grey.cr < -0.004 ? 'Pas assez de rouge : monte le gain R. ' : ''}${grey.cb < -0.004 ? 'Pas assez de bleu : monte le gain B.' : grey.cb > 0.004 ? 'Trop de bleu : baisse le gain B.' : ''}${st.zoom === 1 ? ' Le zoom ×5 aide à finir.' : ''}`;
      }
      if (st.out !== 'BARS') return 'Le premier défi se fait sur les barres : OUTPUT sur BARS.';
      if (st.tg === 100) return 'Les six taches tombent un peu à l\'intérieur des cases, toutes du côté du centre : ces cases sont celles d\'une mire 100 %. Les barres de la caméra sont à 75 % : change de cibles.';
      return '';
    }
    function up() {
      const P = BASE.map(proc), grey = P[3], skin = P[8];
      if (!defis[0] && st.out === 'BARS' && st.tg === 75) defis[0] = true;
      if (defis[0] && !defis[1] && st.out === 'CAM' && Math.abs(grey.cb) < 0.005 && Math.abs(grey.cr) < 0.005) defis[1] = true;
      if (defis[1] && !defis[2] && st.out === 'CAM' && Math.abs(hueOf(skin.cb, skin.cr) - SKIN_LINE) <= 3) defis[2] = true;
      const cam = st.out === 'CAM';
      for (const s of [gR, gB, hue, sat]) s.input.disabled = !cam;
      gR.out.textContent = '×' + fr(st.gR, 3); gB.out.textContent = '×' + fr(st.gB, 2); hue.out.textContent = (st.hue > 0 ? '+' : '') + fr(st.hue, 1) + '°'; sat.out.textContent = pctLabel(st.sat * 100);
      const red = P[10], r75 = barVector('R', 0.75);
      read.textContent = cam
        ? `Gris 18 % : Cb ${grey.cb >= 0 ? '+' : '−'}${fr(Math.abs(grey.cb) * 100, 1)} %, Cr ${grey.cr >= 0 ? '+' : '−'}${fr(Math.abs(grey.cr) * 100, 1)} % · visage ${fr(hueOf(skin.cb, skin.cr), 0)}° · maillot rouge à ${fr(Math.hypot(red.cb, red.cr) / r75.sat * 100, 0)} % de la cible R 75 %`
        : `Barres 75 % en BT.709 : ${['R', 'Mg', 'B', 'Cy', 'G', 'Yl'].map((n) => `${n} ${fr(barVector(n).hue, 0)}°`).join(' · ')}`;
      drawVec(vec, paint(), st.tg, st.zoom);
      sh.done(defis); sh.say(olivier(grey, skin));
      send(ctx, { zoom: zoomPos(20), iris: 5.6, light: 0.5, wb: [cast[0] * st.gR, 1, cast[2] * st.gB], bars: !cam });
    }
    sh.node.append(btnRow(linkBtn('Recommencer', () => {
      Object.assign(st, { out: 'BARS', tg: 100, zoom: 1, gR: 1, gB: 1, hue: 15, sat: 1 });
      outSw.mark('BARS'); tgSw.mark(100); zSw.mark(1); gR.set(1); gB.set(1); hue.set(15); sat.set(1); defis.fill(false); up();
    })));
    up();
    return { node: sh.node, dispose() {} };
  },

  // =================================================================================
  /** le moniteur de référence : luminosité à la PLUGE, contraste à la sonde, chroma en bleu seul */
  moniteur(ctx) {
    const W = 480, H = 270;
    const st = { br: 0.05, c: 0.85, k: 1.2, blue: false, loupe: true };
    const defis = [false, false, false];
    const scr = canvas(W, H, 'L\'écran du moniteur : en haut les barres à 75 %, en bas sur le noir le blanc 100 % et la PLUGE à −2, +2 et +4 %');
    const br = slider('Luminosité', -0.1, 0.1, 0.001, st.br, (v) => { st.br = v; up(); });
    const ct = slider('Contraste', 0.4, 1.2, 0.002, st.c, (v) => { st.c = v; up(); });
    const ch = slider('Chroma', 0.5, 1.5, 0.005, st.k, (v) => { st.k = v; up(); });
    const blue = toggle('Bleu seul (BLUE ONLY)', false, (v) => { st.blue = v; up(); });
    const loupe = toggle('Loupe sur les noirs', true, (v) => { st.loupe = v; up(); });
    const read = readout();
    const sh = shell({ vf: { canvas: scr }, ctrls: [br.row, ct.row, ch.row, btnRow(blue.btn, loupe.btn), read], defis: [
      'Luminosité, à la PLUGE : la barre à −2 % doit disparaître dans le noir, celle à +2 % rester visible.',
      'Contraste, à la sonde posée sur le blanc : 100 cd/m².',
      'Chroma, en bleu seul : les quatre barres qui contiennent du bleu à la même intensité.',
    ] });
    const g = scr.getContext('2d');
    /** ce que l'écran montre d'un signal R′V′B′ (0 à 1) : chroma, puis luminosité et contraste ; bleu seul */
    function shown(rgb) {
      const [Y, cb, cr] = ycc(rgb[0], rgb[1], rgb[2]);
      const v = rgbOf(Y, cb * st.k, cr * st.k).map((x) => monV(x, st.br, st.c));
      if (st.blue) { v[0] = 0; v[1] = 0; }
      return v;
    }
    const css = (v, boost = 1) => `rgb(${v.map((x) => Math.round(clamp(x * boost, 0, 1) * 255)).join(',')})`;
    function paint() {
      const top = Math.round(H * 0.62);
      BAR7.forEach((c, i) => { g.fillStyle = css(shown(c)); g.fillRect(Math.round(i * W / 7), 0, Math.ceil(W / 7) + 1, top); });
      const k = st.loupe ? 8 : 1;
      g.fillStyle = css(shown([0, 0, 0]), k); g.fillRect(0, top, W, H - top);
      g.fillStyle = css(shown([1, 1, 1])); g.fillRect(Math.round(W * 0.08), top + 16, Math.round(W * 0.2), H - top - 40);
      /** @type {[number, string][]} */
      const P = [[-0.02, '−2 %'], [0.02, '+2 %'], [0.04, '+4 %']];
      P.forEach(([lv, t], i) => {
        const x = Math.round(W * (0.5 + i * 0.15));
        g.fillStyle = css(shown([lv, lv, lv]), k); g.fillRect(x, top + 16, Math.round(W * 0.09), H - top - 40);
        g.fillStyle = 'rgba(150,160,166,0.75)'; g.font = `600 11px ${MONO}`; g.textAlign = 'center'; g.fillText(t, x + W * 0.045, H - 8);
      });
      g.fillStyle = 'rgba(150,160,166,0.75)'; g.fillText('100 %', W * 0.18, H - 8);
      if (st.loupe) { g.textAlign = 'right'; g.fillText('loupe ×8 sur les noirs', W - 8, top + 12); }
    }
    function olivier(P, L) {
      const b4 = blueOnly(st.k, st.br, st.c), spread = Math.max(...b4) - Math.min(...b4);
      if (defis[2]) return 'Le moniteur est réglé : les noirs à la PLUGE, le blanc à 100 cd/m², la chroma au bleu seul. On n\'y touche plus : ce sont les caméras qu\'on règle en le regardant, jamais le moniteur sur les caméras.';
      if (defis[1]) {
        if (!st.blue) return 'Passe en bleu seul : le moniteur n\'affiche plus que la voie bleue. Les barres qui contiennent du bleu (gris, cyan, magenta, bleu) doivent avoir la même intensité ; les autres sont noires.';
        if (spread < 0.008) return '';
        return b4[3] > b4[0] ? 'La barre bleue est plus claire que la grise : la chroma est trop forte, baisse-la.' : 'La barre bleue est plus sombre que la grise : la chroma est trop faible, monte-la.';
      }
      if (defis[0]) {
        const warn = P.m2 || !P.p2 ? ' Attention : en changeant le contraste, la PLUGE a bougé ; vérifie-la ensuite.' : '';
        return (L > 100 ? `Sonde sur le blanc : ${fr(L, 0)} cd/m². Baisse le contraste jusqu'à 100.` : `Sonde sur le blanc : ${fr(L, 0)} cd/m². Monte le contraste jusqu'à 100.`) + warn;
      }
      if (P.m2) return st.br > 0.02 ? 'Le noir paraît gris, et la barre à −2 % se voit : le moniteur montre du « plus noir que noir ». Baisse la luminosité jusqu\'à ce qu\'elle disparaisse.' : 'La barre à −2 % se voit encore, à peine : baisse encore un peu la luminosité.';
      if (!P.p2) return 'Trop bas : même la barre à +2 % a disparu. Le moniteur écrase les noirs ; remonte la luminosité jusqu\'à revoir la +2 %.';
      return '';
    }
    function up() {
      const P = pluge(st.br, st.c), L = monNits(1, st.br, st.c), b4 = blueOnly(st.k, st.br, st.c);
      if (!defis[0] && !P.m2 && P.p2) defis[0] = true;
      if (defis[0] && !defis[1] && Math.abs(L - 100) <= 3) defis[1] = true;
      if (defis[1] && !defis[2] && st.blue && Math.max(...b4) - Math.min(...b4) < 0.008) defis[2] = true;
      br.out.textContent = (st.br >= 0 ? '+' : '−') + fr(Math.abs(st.br), 3); ct.out.textContent = fr(st.c, 3); ch.out.textContent = fr(st.k, 3);
      read.textContent = `Sonde sur le blanc : ${fr(L, 0)} cd/m² · sur le noir : ${fr(monNits(0, st.br, st.c), 2)} cd/m² · dalle : ${MON_PEAK} cd/m² au plus`;
      paint();
      sh.done(defis); sh.say(olivier(P, L));
      send(ctx, { bars: true });
    }
    sh.node.append(btnRow(linkBtn('Recommencer', () => {
      Object.assign(st, { br: 0.05, c: 0.85, k: 1.2, blue: false, loupe: true }); br.set(st.br); ct.set(st.c); ch.set(st.k); blue.set(false); loupe.set(true); defis.fill(false); up();
    })));
    up();
    return { node: sh.node, dispose() {} };
  },

  // =================================================================================
  /** les mires : la bonne pour chaque réglage (liaison, point, gris) */
  mires(ctx) {
    const W = 480, H = 270, LIGHT = 0.12, D = MIRE_D;
    const st = { m: 'etoile', z: zoomPos(20), s: pointPos(5), n: irisPos(5.6), nd: 1, n0: 5.6, mag: false };
    const defis = [false, false, false];
    const view = canvas(W, H, 'Ce que voit la caméra : la mire choisie, barres de couleur, étoile de Siemens ou charte de onze gris');
    const sc = scopeCanvas();
    const rings = lensRings(st, () => up());
    const mire = seg('Mire', [['bars', 'Barres'], ['etoile', 'Étoile de Siemens'], ['charte', 'Charte grise']], st.m, (v) => { st.m = v; if (v === 'bars') st.n0 = rings.read().N; up(); });
    const mag = toggle('Loupe MAG ×3', false, (v) => { st.mag = v; up(); });
    const read = readout();
    const sh = shell({ vf: { canvas: view }, scope: sc, ctrls: [mire.row, ...rings.rows, btnRow(mag.btn), read], defis: [
      'Vérifier la liaison de la caméra jusqu\'au car, sans dépendre de la lumière ni de l\'objectif : choisis la mire, puis ferme l\'iris de deux crans pour le prouver.',
      'Faire le point : choisis la mire qui montre la moindre erreur de netteté. En serré, iris ouvert (f/4 ou plus ouvert), le disque gris du centre sous 1 cm.',
      'Raccorder le noir et le gamma de deux caméras : choisis la mire, cadre-la en entier, et expose son palier blanc entre 90 et 100 %.',
    ] });
    const g = view.getContext('2d'); const id = g.createImageData(W, H);
    function paint(o, E) {
      const d = id.data, f = o.f, b = isFinite(o.N) ? blur(f, D, o.dF, 0, o.N) : 0;
      const ppm = H / (D * 5.39 / f) * (st.mag ? 3 : 1);
      const dispPitch = W23 / W / (st.mag ? 3 : 1); // un pixel du dessin, en mm sur le capteur
      for (let y = 0, i = 0; y < H; y++) {
        for (let x = 0; x < W; x++, i += 4) {
          let v;
          if (st.m === 'bars') { const c = BAR7[Math.min(6, Math.floor(x / W * 7))]; d[i] = c[0] * 255; d[i + 1] = c[1] * 255; d[i + 2] = c[2] * 255; d[i + 3] = 255; continue; }
          const X = (x + 0.5 - W / 2) / ppm, Y = (y + 0.5 - H / 2) / ppm;
          if (st.m === 'etoile') {
            if (Math.abs(X) > 0.3 || Math.abs(Y) > 0.3) v = 0.05;
            else {
              const r = Math.hypot(X, Y);
              if (r > 0.25) v = 0.85;
              else {
                const ps = 2 * Math.PI * r / STAR_PAIRS * f / D; // période des secteurs sur le capteur (mm)
                const M = clamp(1 - 1.22 * b / Math.max(ps, 1e-9), 0, 1) * clamp(ps / (2 * Math.max(PITCH, dispPitch)) - 1, 0, 1);
                v = 0.44 + 0.41 * M * clamp(Math.sin(STAR_PAIRS * Math.atan2(Y, X)) * 3, -1, 1);
              }
            }
          } else {
            if (Math.abs(X) > 0.5 || Math.abs(Y) > 0.2) v = 0.012; // un fond sombre, pour ne pas se confondre avec un palier
            else v = CHART[Math.min(10, Math.floor((X + 0.5) * 11))];
          }
          const s = 255 * enc(v * E); d[i] = s; d[i + 1] = s; d[i + 2] = s; d[i + 3] = 255;
        }
      }
      g.putImageData(id, 0, 0);
      if (st.mag && st.m !== 'bars') { g.fillStyle = '#ffb020'; g.font = `600 14px ${MONO}`; g.textAlign = 'right'; g.fillText('MAG ×3', W - 10, H - 12); }
    }
    function olivier(o, disc, white) {
      if (defis[2]) return 'Onze paliers, du noir au blanc : sur la forme d\'onde, un escalier. Si deux caméras dessinent le même escalier, leurs noirs, leurs gammas et leurs blancs sont raccordés. Pour la balance, la même charte (ou un carton blanc) sous la lumière de la scène.';
      if (defis[1]) {
        if (st.m === 'bars') return 'Les barres sont fabriquées par la caméra : les deux caméras sortiraient les mêmes, même si leurs images ne se ressemblent pas. Pour raccorder, il faut une mire que les deux filment.';
        if (st.m === 'etoile') return 'L\'étoile n\'a que du noir et du blanc : aucun gris pour voir le gamma ni le noir.';
        if (o.f > 28.5) return 'Élargis : la charte entière, ses onze paliers, doit tenir dans le cadre (la charte fait 1 m de large, à 3 m).';
        return white >= 99.6 ? 'Le palier blanc est écrêté : ferme un peu l\'iris.' : `Le palier blanc est à ${fr(white, 0)} % : ouvre l'iris jusqu'à 90 % au moins.`;
      }
      if (defis[0]) {
        if (st.m === 'bars') return 'Les barres ne disent rien de la netteté : elles ne passent pas par l\'objectif.';
        if (st.m === 'charte') return 'La charte grise n\'a que des aplats : un léger flou ne s\'y voit pas.';
        if (o.f < 40) return 'Zoome à fond : en serré, l\'erreur de point se voit le mieux.';
        if (o.N > 4.05) return 'Ouvre l\'iris (f/4 ou plus ouvert) : fermé, la profondeur de champ cache l\'erreur.';
        return disc > 10 ? `Le disque gris au centre de l'étoile fait ${fr(disc / 10, 1)} cm : tourne la bague de point pour le rendre le plus petit possible. La loupe aide.` : 'Net.';
      }
      if (st.m === 'etoile') return 'L\'étoile est une mire optique : elle passe par l\'objectif, elle dépend de la lumière et du point. Pour tester la liaison seule, il faut un signal fabriqué dans la caméra.';
      if (st.m === 'charte') return 'La charte grise passe elle aussi par l\'objectif et dépend de la lumière : elle ne teste pas la liaison seule.';
      return 'Les barres sont fabriquées dans la caméra (OUTPUT sur BARS) : ni la lumière ni l\'objectif n\'y sont pour rien. Ferme l\'iris de deux crans pour le vérifier : la forme d\'onde ne bouge pas.';
    }
    function up() {
      const o = rings.read(); rings.show();
      const E = isFinite(o.N) ? exposureOf(o.N) * LIGHT : 0;
      const b = isFinite(o.N) ? blur(o.f, D, o.dF, 0, o.N) : 0, disc = starGrey(o.f, D, b);
      const steps = CHART.map((v) => 100 * oetf709(v * E)), white = steps[10];
      // deux crans d'iris : le nombre f multiplié ou divisé par 2 (un cran = √2)
      if (!defis[0] && st.m === 'bars' && 2 * Math.abs(Math.log2((isFinite(o.N) ? o.N : 1e3) / st.n0)) >= 1.9) defis[0] = true;
      if (defis[0] && !defis[1] && st.m === 'etoile' && o.f >= 40 && o.N <= 4.05 && disc <= 10) defis[1] = true;
      if (defis[1] && !defis[2] && st.m === 'charte' && o.f <= 28.5 && white >= 90 && white < 99.6) defis[2] = true;
      mag.set(st.mag);
      read.textContent = st.m === 'bars' ? `Barres 75 % : ${['gris', 'jaune', 'cyan', 'vert', 'magenta', 'rouge', 'bleu'].map((n, i) => `${n} ${fr(100 * ycc(BAR7[i][0], BAR7[i][1], BAR7[i][2])[0], 0)}`).join(' · ')} %`
        : st.m === 'etoile' ? `Tache de flou ${fr(b * 1000, 0)} µm sur le capteur · disque gris au centre de l'étoile : ${fr(disc / 10, 1)} cm sur la mire`
          : `Paliers : ${steps.map((p) => fr(p, 0)).join(' · ')} %`;
      paint(o, E); drawScope(sc, id);
      sh.done(defis); sh.say(olivier(o, disc, white));
      send(ctx, lensState(st, o, { iris: isFinite(o.N) ? o.N : 99, light: LIGHT, bars: st.m === 'bars', mag: st.mag }));
    }
    sh.node.append(btnRow(linkBtn('Recommencer', () => { Object.assign(st, { m: 'etoile', z: zoomPos(20), s: pointPos(5), n: irisPos(5.6), n0: 5.6, mag: false }); mire.mark('etoile'); defis.fill(false); rings.sync(); up(); })));
    up();
    return { node: sh.node, dispose() {} };
  },

  // =================================================================================
  /** grand capteur ou tri-capteur : même cadre, quelle zone nette, quelle ouverture */
  grandcapteur(ctx) {
    const W = 480, H = 270;
    const SC = { plateau: { s: 3, field: 0.5, bg: 6, span: 0.4 }, stade: { s: 50, field: 4, bg: 90, span: 12 } };
    const NMIN = 1.4, NMAX = 22, nOf = (x) => NMIN * Math.pow(NMAX / NMIN, x), xOf = (N) => Math.log(N / NMIN) / Math.log(NMAX / NMIN);
    const st = { fmt: '23', sc: 'plateau', x: xOf(2.8) };
    const defis = [false, false, false]; const seen = { d23: 0, d35: 0, N2: 0 };
    const view = canvas(W, H, 'En haut, l\'image : le sujet net et les lumières du fond, floues ; en bas, la zone nette sur l\'axe des distances, pour les deux capteurs');
    const fmt = seg('Capteur', [['23', '2/3″ tri-capteur'], ['s35', 'Super 35']], st.fmt, (v) => { st.fmt = v; up(); });
    const scn = seg('Scène', [['plateau', 'Plateau, visage à 3 m'], ['stade', 'Stade, joueur à 50 m']], st.sc, (v) => { st.sc = v; up(); });
    const iris = slider('Ouverture', 0, 1, 0.001, st.x, (v) => { st.x = v; up(); });
    const read = readout();
    const sh = shell({ vf: { canvas: view }, ctrls: [fmt.row, scn.row, iris.row, read], defis: [
      'Plateau, à f/2,8 : passe du 2/3″ au Super 35, même cadre. Que devient la zone nette ?',
      'Toujours en Super 35 : retrouve la zone nette du 2/3″ à f/2,8. À quelle ouverture ?',
      'Au stade, en Super 35 : garde net le joueur et son adversaire, sur 6 m de profondeur.',
    ] });
    const calc = (fm, N) => {
      const s = SC[st.sc], Wd = fm === '23' ? W23 : WS35, f = focalFor(Wd, s.s, s.field);
      return { f, Wd, dof: dofOf(f, N, s.s, cocOf(Wd)), bg: bgBlurFrac(f, N, s.s, s.bg, Wd) };
    };
    const g = view.getContext('2d');
    function paint(N, a, b) {
      const s = SC[st.sc], top = 176;
      const gr = g.createLinearGradient(0, 0, 0, top); gr.addColorStop(0, st.sc === 'stade' ? '#0b1730' : '#141a2c'); gr.addColorStop(1, st.sc === 'stade' ? '#1d4a2a' : '#232838'); g.fillStyle = gr; g.fillRect(0, 0, W, top);
      // les lumières du fond, floues : leur diamètre est la tache de flou
      const dpx = Math.max(3, a.bg * W);
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 9; i++) { const x = 30 + i * 52 + (i % 2) * 14, y = st.sc === 'stade' ? 30 + (i % 3) * 14 : 40 + (i % 3) * 34; g.fillStyle = `rgba(255,${180 + (i % 3) * 20},110,${clamp(0.9 * 12 / dpx, 0.12, 0.85).toFixed(3)})`; g.beginPath(); g.arc(x, y, dpx / 2, 0, Math.PI * 2); g.fill(); }
      g.globalCompositeOperation = 'source-over';
      // le sujet, net
      if (st.sc === 'plateau') {
        g.fillStyle = '#1b1d22'; g.beginPath(); g.ellipse(W / 2, top + 30, 150, 70, 0, Math.PI, 0); g.fill();
        g.fillStyle = '#d4a184'; g.beginPath(); g.ellipse(W / 2, 92, 46, 62, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#2a1d14'; g.beginPath(); g.ellipse(W / 2, 52, 50, 32, 0, Math.PI, 0); g.fill();
      } else {
        g.fillStyle = '#c0282a'; g.fillRect(W / 2 - 18, 52, 36, 50); g.fillStyle = '#f1f1ed'; g.fillRect(W / 2 - 16, 102, 32, 22);
        g.fillStyle = '#d4a184'; g.beginPath(); g.arc(W / 2, 40, 11, 0, Math.PI * 2); g.fill(); g.fillRect(W / 2 - 15, 124, 10, 40); g.fillRect(W / 2 + 5, 124, 10, 40);
        g.fillStyle = '#2a5ab0'; g.fillRect(W / 2 + 92, 62, 26, 40); g.beginPath(); g.arc(W / 2 + 105, 52, 8, 0, Math.PI * 2); g.fill(); // l'adversaire, plus loin
      }
      // l'axe des distances et les deux zones nettes
      const x0 = 40, x1 = W - 20, lo = s.s - s.span, hi = s.s + s.span, X = (d) => x0 + (clamp(d, lo, hi) - lo) / (hi - lo) * (x1 - x0);
      g.fillStyle = '#0d1114'; g.fillRect(0, top, W, H - top);
      g.strokeStyle = '#7d878e'; g.lineWidth = 1; g.beginPath(); g.moveTo(x0, 238); g.lineTo(x1, 238); g.stroke();
      g.font = `600 10px ${MONO}`; g.textAlign = 'center'; g.fillStyle = '#9aa3a8';
      const step = st.sc === 'stade' ? 4 : 0.1;
      for (let d = lo; d <= hi + 1e-6; d += step) { g.fillRect(X(d), 236, 1, 5); g.fillText(st.sc === 'stade' ? fr(d, 0) : fr(d, 1), X(d), 254); }
      g.fillText('m', x1 + 10, 254);
      const zone = (z, y, cls) => {
        const xa = X(z.near), xb = X(z.far);
        if (cls === 'cur') { g.fillStyle = 'rgba(64,214,122,0.85)'; g.fillRect(xa, y, Math.max(2, xb - xa), 12); }
        else { g.strokeStyle = 'rgba(255,196,90,0.9)'; g.setLineDash([4, 3]); g.strokeRect(xa, y, Math.max(2, xb - xa), 12); g.setLineDash([]); }
      };
      zone(a.dof, 200, 'cur'); zone(b.dof, 216, 'other');
      g.fillStyle = '#e8e8e2'; g.fillRect(X(s.s) - 1, 194, 2, 40);
      g.textAlign = 'left'; g.font = `600 11px ${SANS}`; g.fillStyle = '#b9f5cf'; g.fillText(st.fmt === '23' ? '2/3″' : 'S35', 4, 210);
      g.fillStyle = '#ffd27a'; g.fillText(st.fmt === '23' ? 'S35' : '2/3″', 4, 226);
      g.fillStyle = '#9aa3a8'; g.textAlign = 'right'; g.fillText(`zone nette à f/${fr(N)}`, W - 6, 190);
    }
    function olivier(N, a, b) {
      const d = a.dof.total;
      if (defis[2]) { const N35 = nForDof('s35', 6), N23 = nForDof('23', 6); return `6 m de zone nette au stade : f/${fr(N35, 1)} en Super 35, f/${fr(N23, 1)} seulement en 2/3″. ${fr(stopsBetween(N35, N23), 1)} diaphragmes de lumière en plus pour le grand capteur : la nuit, sous l'éclairage du stade, c'est du gain, donc du bruit. C'est une raison du 2/3″ en direct, avec les zooms de 100× et plus, qui n'existent pas en Super 35.`; }
      if (defis[1]) {
        if (st.sc !== 'stade') return `f/${fr(seen.N2, 1)} : il faut fermer de 2,6 fois en nombre f (environ 2,8 diaphragmes), donc 7 fois moins de lumière, pour retrouver la zone nette du 2/3″. Passe maintenant au stade.`;
        if (st.fmt !== 's35') return 'Repasse en Super 35.';
        return `Zone nette : ${lenLabel(d)}. Ferme jusqu'à 6 m au moins.`;
      }
      if (defis[0]) {
        if (st.sc !== 'plateau' || st.fmt !== 's35') return 'Reste au plateau, en Super 35.';
        return `En Super 35 à f/${fr(N, 1)} : ${lenLabel(d)} de zone nette ; le 2/3″ à f/2,8 en avait ${lenLabel(seen.d23)}. Ferme l'iris jusqu'à la retrouver.`;
      }
      if (st.sc !== 'plateau') return 'Commence au plateau.';
      if (Math.abs(N - 2.8) > 0.15) return 'Règle l\'ouverture sur f/2,8.';
      if (st.fmt === '23') return `En 2/3″ à f/2,8, cadre de 50 cm à 3 m : focale ${fr(a.f, 0)} mm, ${lenLabel(d)} de zone nette. Passe en Super 35.`;
      return '';
    }
    // diaphragmes entre deux ouvertures ; ouverture qui donne une zone nette donnée (au stade)
    const stopsBetween = (Na, Nb) => 2 * Math.log2(Na / Nb);
    const nForDof = (fm, target) => { let lo = 0.5, hi = 64; for (let i = 0; i < 50; i++) { const m = Math.sqrt(lo * hi), s = SC.stade, Wd = fm === '23' ? W23 : WS35; if (dofOf(focalFor(Wd, s.s, s.field), m, s.s, cocOf(Wd)).total >= target) hi = m; else lo = m; } return hi; };
    function up() {
      const N = nOf(st.x), a = calc(st.fmt, N), b = calc(st.fmt === '23' ? 's35' : '23', N), ref = dofOf(focalFor(W23, 3, 0.5), 2.8, 3, cocOf(W23));
      if (!defis[0] && st.sc === 'plateau' && st.fmt === 's35' && Math.abs(N - 2.8) <= 0.15) { defis[0] = true; seen.d35 = a.dof.total; seen.d23 = ref.total; }
      if (defis[0] && !defis[1] && st.sc === 'plateau' && st.fmt === 's35' && Math.abs(a.dof.total - ref.total) / ref.total <= 0.08) { defis[1] = true; seen.N2 = N; }
      if (defis[1] && !defis[2] && st.sc === 'stade' && st.fmt === 's35' && a.dof.total >= 6) { defis[2] = true; seen.N2 = N; }
      if (!defis[0]) seen.d23 = ref.total;
      iris.out.textContent = 'f/' + fr(N, N < 10 ? 1 : 0);
      read.textContent = `Focale ${fr(a.f, 0)} mm · zone nette de ${distLabel(a.dof.near)} à ${distLabel(a.dof.far)}, soit ${lenLabel(a.dof.total)} · en ${st.fmt === '23' ? 'Super 35' : '2/3″'}, même cadre et même f/${fr(N, 1)} : ${lenLabel(b.dof.total)} · flou du fond : ${fr(a.bg * 100, 1)} % de la largeur de l'image`;
      paint(N, a, b);
      sh.done(defis); sh.say(olivier(N, a, b));
      send(ctx, { iris: clamp(N, 1.8, 16) });
    }
    sh.node.append(btnRow(linkBtn('Recommencer', () => { Object.assign(st, { fmt: '23', sc: 'plateau', x: xOf(2.8) }); fmt.mark('23'); scn.mark('plateau'); iris.set(st.x); defis.fill(false); up(); })));
    up();
    return { node: sh.node, dispose() {} };
  },

  // =================================================================================
  /** UHD et HDR : SDR écrêté, HLG et son blanc de référence à 75 %, la place au-dessus */
  hdr(ctx) {
    const W = 480, H = 270, L = 0.5; // à f/5,6, l'exposition vaut 1 : le carton blanc à 100 % en SDR, à 75 % en HLG
    const st = { z: zoomPos(20), s: pointPos(MIRE_D), n: irisPos(4), nd: 1, mode: 'SDR', sx: Math.log(3) / Math.log(16) };
    const defis = [false, false, false]; let skyK = 0;
    const view = canvas(W, H, 'À gauche, les courbes SDR et HLG : signal en fonction de la lumière de la scène, avec le gris, le carton blanc et le ciel ; à droite, leur luminance sur l\'écran SDR et sur l\'écran HLG');
    const rings = lensRings(st, () => up(), ['iris']);
    const mode = seg('Courbe', [['SDR', 'SDR (BT.709)'], ['HLG', 'HLG (BT.2100)']], st.mode, (v) => { st.mode = v; up(); });
    const sky = slider('Ciel', 0, 1, 0.001, st.sx, (v) => { st.sx = v; up(); });
    const read = readout();
    const sh = shell({ vf: { canvas: view }, ctrls: [mode.row, ...rings.rows, sky.row, read], defis: [
      'En SDR, expose le carton blanc entre 90 et 100 % : que devient le ciel, trois fois plus lumineux ?',
      'Passe en HLG et pose le blanc de référence à 75 % (BT.2408), à 2 % près.',
      'Sans toucher l\'iris, monte la lumière du ciel jusqu\'à ce qu\'il touche 100 % : combien de fois le blanc ?',
    ] });
    const g = view.getContext('2d');
    const sig = (m, l, E) => 100 * (m === 'SDR' ? oetf709(l * E) : hlg(HLG_REF * l * E));
    const nits = (m, l, E) => (m === 'SDR' ? bt1886(oetf709(l * E)) : hlgNits(HLG_REF * l * E));
    function paint(E, k) {
      g.fillStyle = '#07090c'; g.fillRect(0, 0, W, H);
      const x0 = 36, x1 = 296, y0 = 236, y1 = 22, X = (l) => x0 + (Math.log2(l) + 5) / 9 * (x1 - x0), Y = (p) => y0 - p / 100 * (y0 - y1);
      g.font = `600 10px ${MONO}`; g.lineWidth = 1;
      for (const p of [0, 25, 50, 75, 100]) { g.strokeStyle = 'rgba(160,170,176,0.18)'; g.beginPath(); g.moveTo(x0, Y(p) + 0.5); g.lineTo(x1, Y(p) + 0.5); g.stroke(); g.fillStyle = '#9aa3a8'; g.textAlign = 'right'; g.fillText(String(p), x0 - 4, Y(p) + 3); }
      [[1 / 16, '1/16'], [1 / 4, '1/4'], [1, '1'], [4, '4'], [16, '16']].forEach(([l, t]) => { g.textAlign = 'center'; g.fillStyle = '#9aa3a8'; g.fillText(String(t), X(Number(l)), y0 + 13); g.fillRect(X(Number(l)), y0, 1, 4); });
      g.textAlign = 'left'; g.fillText('lumière de la scène (carton blanc = 1)', x0, y0 + 27);
      g.strokeStyle = 'rgba(92,200,236,0.6)'; g.setLineDash([5, 4]); g.beginPath(); g.moveTo(x0, Y(75) + 0.5); g.lineTo(x1, Y(75) + 0.5); g.stroke(); g.setLineDash([]);
      g.fillStyle = 'rgba(92,200,236,0.9)'; g.fillText('blanc de réf. HLG', x0 + 4, Y(75) - 4);
      for (const m of ['SDR', 'HLG']) {
        const on = m === st.mode;
        g.strokeStyle = m === 'SDR' ? (on ? '#ffd27a' : 'rgba(255,210,122,0.35)') : (on ? '#5cc8ec' : 'rgba(92,200,236,0.35)'); g.lineWidth = on ? 2.4 : 1.2;
        g.beginPath(); for (let i = 0; i <= 160; i++) { const l = Math.pow(2, -5 + 9 * i / 160), p = sig(m, l, E); if (i) g.lineTo(X(l), Y(p)); else g.moveTo(X(l), Y(p)); } g.stroke();
      }
      g.lineWidth = 1;
      /** @type {[number, string, string][]} */
      const PTS = [[0.18, 'gris 18 %', '#c9ced2'], [1, 'blanc', '#f3f1e8'], [k, 'ciel ×' + fr(k, 1), '#ffb020']];
      PTS.forEach(([l, t, c], i) => { const x = X(l), y = Y(sig(st.mode, l, E)); g.fillStyle = c; g.beginPath(); g.arc(x, y, 4.5, 0, Math.PI * 2); g.fill(); g.textAlign = i === 2 ? 'right' : 'left'; g.font = `600 11px ${SANS}`; g.fillText(t, x + (i === 2 ? -8 : 8), y + (i === 1 ? 14 : -6)); });
      // les écrans : luminance de chaque point, échelle logarithmique de 1 à 1 000 cd/m²
      const yN = (n) => y0 - clamp(Math.log10(Math.max(n, 1)) / 3, 0, 1) * (y0 - y1);
      g.font = `600 10px ${MONO}`; g.textAlign = 'right'; g.fillStyle = '#9aa3a8';
      for (const n of [1, 10, 100, 1000]) { g.fillText(String(n), 336, yN(n) + 3); g.fillStyle = 'rgba(160,170,176,0.18)'; g.fillRect(340, yN(n), 132, 1); g.fillStyle = '#9aa3a8'; }
      [['SDR', 'SDR|100 cd/m²', 352], ['HLG', 'HLG|1 000 cd/m²', 414]].forEach(([m, t, x]) => {
        const xx = Number(x);
        PTS.forEach(([l, , c], i) => { const n = nits(String(m), l, E), y = yN(n); g.fillStyle = c; g.globalAlpha = m === st.mode ? 1 : 0.45; g.fillRect(xx + i * 16, y, 12, y0 - y); });
        g.globalAlpha = 1; g.fillStyle = '#c9ced2'; g.textAlign = 'center'; g.font = `600 10px ${SANS}`; String(t).split('|').forEach((s, i) => g.fillText(s, xx + 22, y0 + 13 + i * 12));
      });
      g.textAlign = 'center'; g.fillStyle = '#9aa3a8'; g.font = `600 10px ${SANS}`; g.fillText('sur l\'écran (cd/m²)', 406, y1 - 6 + 4);
    }
    function olivier(E, k, card, skyP) {
      if (defis[2]) return `${fr(skyK, 1)} fois le blanc : de 75 à 100 %, le HLG garde près de deux diaphragmes de hautes lumières (1 ÷ 0,265 ≈ 3,8). Sur l'écran HLG de 1 000 cd/m², le blanc est à 203 cd/m² et le ciel monte à 1 000 : cinq fois plus. En SDR, le ciel serait un aplat à 100 cd/m², comme le blanc.`;
      if (defis[1]) {
        if (st.mode !== 'HLG') return 'Reste en HLG.';
        if (Math.abs(card - 75) > 2) return 'Le blanc a bougé : remets-le à 75 % à l\'iris.';
        return skyP >= 98 ? '' : `Le ciel est à ${fr(skyP, 0)} % : monte sa lumière.`;
      }
      if (defis[0]) {
        if (st.mode !== 'HLG') return 'Le ciel est écrêté : un aplat blanc à 100 %, sans nuages. Passe en HLG.';
        return Math.abs(card - 75) <= 2 ? '' : `En HLG, le carton blanc est à ${fr(card, 0)} %. Ferme ou ouvre l'iris pour le poser à 75 % : le quart du haut de l'échelle reste pour ce qui est plus lumineux que lui.`;
      }
      if (st.mode !== 'SDR') return 'Le premier défi se fait en SDR.';
      if (card >= 99.6) return 'Le carton blanc touche 100 % : il est écrêté. Ferme l\'iris.';
      if (card < 90) return `Le carton blanc est à ${fr(card, 0)} % : ouvre un peu l'iris.`;
      return '';
    }
    function up() {
      const o = rings.read(); rings.show();
      const E = isFinite(o.N) ? exposureOf(o.N) * L : 0, k = Math.pow(16, st.sx);
      const card = sig(st.mode, 1, E), skyP = sig(st.mode, k, E);
      if (!defis[0] && st.mode === 'SDR' && card >= 90 && card < 99.6) defis[0] = true;
      if (defis[0] && !defis[1] && st.mode === 'HLG' && Math.abs(card - 75) <= 2) defis[1] = true;
      if (defis[1] && !defis[2] && st.mode === 'HLG' && Math.abs(card - 75) <= 2 && skyP >= 98) { defis[2] = true; skyK = 1 / (HLG_REF * E) < k ? 1 / (HLG_REF * E) : k; }
      sky.out.textContent = '×' + fr(k, 1);
      const grey = sig(st.mode, 0.18, E);
      read.textContent = `${st.mode} · gris 18 % : ${fr(grey, 0)} % · carton blanc : ${fr(card, 0)} % · ciel : ${fr(skyP, 0)} %${skyP >= 99.6 ? ' (écrêté)' : ''} · à l'écran : blanc ${fr(nits(st.mode, 1, E), 0)} cd/m², ciel ${fr(nits(st.mode, k, E), 0)} cd/m²`;
      paint(E, k);
      sh.done(defis); sh.say(olivier(E, k, card, skyP));
      send(ctx, lensState(st, o, { iris: isFinite(o.N) ? o.N : 99, light: L }));
    }
    sh.node.append(btnRow(linkBtn('Recommencer', () => { Object.assign(st, { n: irisPos(4), mode: 'SDR', sx: Math.log(3) / Math.log(16) }); mode.mark('SDR'); sky.set(st.sx); defis.fill(false); rings.sync(); up(); })));
    up();
    return { node: sh.node, dispose() {} };
  },

  // =================================================================================
  /** le super ralenti : la cadence, la lumière, le scintillement */
  hfr(ctx) {
    const W = 480, H = 270, L = 0.49, M = 0.35; // M : profondeur du scintillement d'une lampe à décharge sur une phase (ordre de grandeur)
    const st = { z: zoomPos(20), s: pointPos(MIRE_D), n: irisPos(5.6), nd: 1, k: 1, v: 1 / 3, flick: false };
    const defis = [false, false, false];
    const view = canvas(W, H, 'En haut, les images enregistrées par la caméra, avec leur phase ; au milieu, les images montrées à l\'antenne pendant le ralenti ; en bas, le ralenti qui passe');
    const rings = lensRings(st, () => up(), ['iris']);
    const K = [1, 2, 3, 4, 6, 8];
    const rate = seg('Cadence', K.map((k) => [k, `${k}× (${k * 50} i/s)`]), st.k, (v) => { st.k = Number(v); up(); });
    /** @type {[number, string][]} */
    const SP = [[1, '100 %'], [0.5, '50 %'], [1 / 3, '33 %'], [0.25, '25 %'], [1 / 6, '16,7 %'], [0.125, '12,5 %']];
    const speed = seg('Relecture', SP, st.v, (v) => { st.v = Number(v); up(); });
    const flick = toggle('Projecteurs à décharge (100 Hz)', false, (v) => { st.flick = v; up(); });
    flick.btn.hidden = true;
    const read = readout();
    const sh = shell({ vf: { canvas: view }, ctrls: [rate.row, speed.row, ...rings.rows, btnRow(flick.btn), read], defis: [
      'Relu à 33 %, le ralenti doit être fluide : chaque image différente de la précédente. Choisis la cadence de la caméra.',
      'Passe à 6× (300 images par seconde) et garde l\'exposition : le blanc de la mire entre 80 et 100 %.',
      'Les projecteurs du stade scintillent à 100 Hz : le ralenti clignote. Trouve la cadence de super ralenti qui ne clignote pas.',
    ] });
    const g = view.getContext('2d');
    const PH = ['#4cc3e6', '#ffb020', '#40d67a', '#ff7ab0', '#b08cff', '#e0e070', '#ff8a5a', '#8ad0ff'];
    const light = (n) => frameLight(n, 50 * st.k, st.flick ? M : 0);
    let raf = 0, j = 0, last = 0;
    function frameBox(x, y, w, h, n, label, rep) {
      const b = clamp(light(n), 0, 2), lv = Math.round(clamp(38 + 46 * b, 0, 255));
      g.fillStyle = `rgb(${lv},${lv + 6},${lv + 10})`; g.fillRect(x, y, w, h);
      const bx = x + 4 + ((n / (50 * st.k)) % 0.24) / 0.24 * (w - 8);
      g.fillStyle = '#f1f1ed'; g.beginPath(); g.arc(bx, y + h * 0.55, 3.2, 0, Math.PI * 2); g.fill();
      g.strokeStyle = PH[n % st.k]; g.lineWidth = rep ? 1 : 2; g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      g.fillStyle = rep ? '#7d878e' : '#e8e8e2'; g.font = `600 10px ${MONO}`; g.textAlign = 'center'; g.fillText(label, x + w / 2, y + h + 12);
    }
    function paint() {
      g.fillStyle = '#07090c'; g.fillRect(0, 0, W, H);
      g.font = `600 11px ${SANS}`; g.textAlign = 'left'; g.fillStyle = '#c9ced2';
      g.fillText(`À la caméra : ${st.k * 50} images par seconde (${st.k}×), en ${st.k} phase${st.k > 1 ? 's' : ''}`, 8, 14);
      for (let n = 0; n < 12; n++) frameBox(8 + n * 39, 22, 34, 30, n, (st.k > 1 ? 'ABCDEFGH'[n % st.k] : '') + (n + 1), false);
      g.font = `600 11px ${SANS}`; g.textAlign = 'left'; g.fillStyle = '#c9ced2';
      g.fillText(`À l'antenne, relu à ${SP.find((s) => s[0] === st.v)[1]} : 50 images par seconde`, 8, 92);
      let prev = -1;
      for (let i = 0; i < 12; i++) { const n = shownFrame(i, st.k, st.v); frameBox(8 + i * 39, 100, 34, 30, n, (n === prev ? '= ' : '') + (n + 1), n === prev); prev = n; }
      preview();
    }
    function preview() {
      const x = 8, y = 170, w = 220, h = 84, n = shownFrame(j, st.k, st.v), b = clamp(light(n), 0, 2), lv = Math.round(clamp(30 + 40 * b, 0, 255));
      g.fillStyle = `rgb(${lv},${lv + 20},${lv})`; g.fillRect(x, y, w, h);
      const bx = x + 8 + ((n / (50 * st.k)) % 0.5) / 0.5 * (w - 16);
      g.fillStyle = '#f1f1ed'; g.beginPath(); g.arc(bx, y + h * 0.6, 6, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#2b2e33'; g.lineWidth = 2; g.strokeRect(x + 1, y + 1, w - 2, h - 2);
      g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(x + 4, y + 4, 92, 16); g.fillStyle = '#ffd27a'; g.font = `600 10px ${MONO}`; g.textAlign = 'left'; g.fillText(`image ${n + 1}`, x + 8, y + 15);
    }
    function loop(now) {
      raf = requestAnimationFrame(loop);
      if (now - last < 40) return; // le ralenti passe à 25 images par seconde dans la maquette (deux fois moins vite)
      last = now; j = (j + 1) % 6000; preview();
    }
    function olivier(w, kv) {
      const st6 = hfrStops(6);
      if (defis[2]) return '2× (100 images par seconde) : chaque image dure 1/100 s, exactement une période du scintillement de la lampe, et reçoit la même lumière. À 3×, une image ne dure que les deux tiers d\'une période : les trois phases n\'ont pas la même lumière, et le ralenti clignote. Les stades s\'équipent de projecteurs à LED qui ne scintillent pas.';
      if (defis[1]) {
        if (!st.flick) return 'Allume les projecteurs à décharge.';
        if (st.k === 1) return 'À 1× la lumière ne bat pas, mais ce n\'est plus un super ralenti.';
        return `À ${st.k}×, la lumière varie de ± ${fr(flickerSpread(50 * st.k, M) * 100, 0)} % d'une image à l'autre : regarde les vignettes. Essaie une autre cadence.`;
      }
      if (defis[0]) {
        if (st.k !== 6) return 'Passe la caméra à 6× (300 i/s).';
        if (w < 80) return `À 300 images par seconde, chaque image ne dure que 1/300 s : six fois moins de lumière qu'à 50 i/s, ${fr(st6, 1)} diaphragmes. Le blanc est tombé à ${fr(w, 0)} % : ouvre l'iris.`;
        if (w >= 99.6) return 'Écrêté : ferme un peu.';
        return '';
      }
      if (kv < 0.99) return `À ${st.k}× relu à ${fr(st.v * 100, 1)} %, chaque image est montrée ${fr(1 / kv, 1)} fois : regarde les « = » sur la ligne de l'antenne, le mouvement avance par à-coups. ${st.v > 0.34 || st.v < 0.33 ? 'Règle la relecture sur 33 %.' : 'Monte la cadence de la caméra.'}`;
      if (Math.abs(st.v - 1 / 3) > 0.01) return 'Règle la relecture sur 33 %.';
      return '';
    }
    function up() {
      const o = rings.read(); rings.show();
      const E = isFinite(o.N) ? exposureOf(o.N) * L / st.k : 0, w = whiteLevels(E)[1], kv = st.k * st.v;
      if (!defis[0] && Math.abs(st.v - 1 / 3) < 0.01 && kv >= 0.99) defis[0] = true;
      if (defis[0] && !defis[1] && st.k === 6 && w >= 80 && w < 99.6) { defis[1] = true; st.flick = true; flick.set(true); flick.btn.hidden = false; }
      if (defis[1] && !defis[2] && st.flick && st.k === 2) defis[2] = true;
      read.textContent = `Temps de pose 1/${st.k * 50} s : ${st.k > 1 ? `${fr(hfrStops(st.k), 1)} diaphragme${hfrStops(st.k) >= 2 ? 's' : ''} de moins qu'à 50 i/s` : 'la cadence normale'} · ${st.k} sortie${st.k > 1 ? 's' : ''} vers le serveur · blanc de la mire ${fr(w, 0)} %${st.flick ? ` · scintillement ± ${fr(flickerSpread(50 * st.k, M) * 100, 0)} %` : ''}`;
      paint();
      sh.done(defis); sh.say(olivier(w, kv));
      send(ctx, lensState(st, o, { iris: isFinite(o.N) ? o.N : 99, light: L / st.k }));
    }
    sh.node.append(btnRow(linkBtn('Recommencer', () => { Object.assign(st, { n: irisPos(5.6), k: 1, v: 1 / 3, flick: false }); rate.mark(1); speed.mark(1 / 3); flick.set(false); flick.btn.hidden = true; defis.fill(false); rings.sync(); up(); })));
    up();
    raf = requestAnimationFrame(loop);
    return { node: sh.node, dispose: () => { if (raf) cancelAnimationFrame(raf); raf = 0; } };
  },
};

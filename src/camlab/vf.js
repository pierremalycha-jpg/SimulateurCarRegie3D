// @ts-check
import { SENSOR, MIRE_D, ND, defocus, exposureOf, blurPx, fr } from './optics.js';

// ----------------------------------------------------------------------------------
// Le viseur simulé des manipulations : la scène du plateau vue par l'objectif, puis traitée
// comme dans la caméra. 1) Les objets sont dessinés à leur distance, du plus loin au plus près,
// chacun flouté par sa propre tache de flou (un disque, 16 copies additionnées). 2) Chaque pixel
// passe en lumière linéaire, reçoit l'exposition (iris, ND, gain, lumière du plateau), la
// dominante de couleur, le décalage des noirs et le bruit, puis revient en signal vidéo (courbe
// BT.709, écrêtage à 100 %). 3) Le viseur montre ce signal : en couleur ou une seule voie
// (VF OUT), avec les zébras, la loupe MAG et les incrustations. Les mesures (forme d'onde,
// parade) lisent l'image traitée, avant la loupe.
// Le traitement de l'image (chapitre 4) passe par un second chemin, en virgule flottante, dès
// qu'un de ses réglages est donné (hi, gamma, blackGamma, knee, clip, sat, matrix, detail, ou les
// scènes « fenetre » et « portrait ») : matrice sur la lumière linéaire, courbe de gamma (BT.709
// généralisée), black gamma, knee, saturation (sur Y'CbCr, coefficients BT.709), détail (contour
// ajouté sur la luminance), white clip (au plus 109 %, le code 1019). Le signal garde alors les
// niveaux au-dessus de 100 % (vf.signal()). Sans ces réglages, le premier chemin est inchangé.
// ----------------------------------------------------------------------------------

const TAPS = (() => { const t = [[0, 0]]; for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; t.push([0.5 * Math.cos(a), 0.5 * Math.sin(a)]); } for (let i = 0; i < 10; i++) { const a = (i + 0.5) / 10 * Math.PI * 2; t.push([Math.cos(a), Math.sin(a)]); } return t; })();
export const cnv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

/** floute un calque (disque de rayon r pixels) et le pose sur dst */
function discBlur(src, dst, r, work) {
  const g = dst.getContext('2d');
  if (r < 0.6) { g.drawImage(src, 0, 0); return; }
  // grand flou : on travaille en réduction (le lissage bilinéaire comble les copies)
  const s = r > 14 ? 0.25 : r > 6 ? 0.5 : 1;
  const w = Math.max(2, Math.round(src.width * s)), h = Math.max(2, Math.round(src.height * s));
  if (work.width !== w || work.height !== h) { work.width = w; work.height = h; }
  const tmp = work.small || (work.small = cnv(w, h)); if (tmp.width !== w || tmp.height !== h) { tmp.width = w; tmp.height = h; }
  const tg = tmp.getContext('2d'); tg.clearRect(0, 0, w, h); tg.drawImage(src, 0, 0, w, h);
  const wg = work.getContext('2d'); wg.clearRect(0, 0, w, h); wg.globalCompositeOperation = 'lighter'; wg.globalAlpha = 1 / TAPS.length;
  for (const [dx, dy] of TAPS) wg.drawImage(tmp, dx * r * s, dy * r * s);
  wg.globalCompositeOperation = 'source-over'; wg.globalAlpha = 1;
  g.drawImage(work, 0, 0, src.width, src.height);
}

// ---------------- les objets du plateau ----------------
/** les pastilles de couleur de la mire, de part et d'autre de l'étoile (comme la mire du plateau 3D) */
export const PATCHES = [['#c0282a', '#2f9a3c', '#2b3fa8'], ['#2aa6c4', '#b03a95', '#e0c22a']];
function drawStar(g, cx, cy, R) {
  const n = 36; g.fillStyle = '#121212';
  for (let i = 0; i < n; i++) { const a0 = i / n * Math.PI * 2, a1 = (i + 0.5) / n * Math.PI * 2; g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, R, a0, a1); g.closePath(); g.fill(); }
  g.strokeStyle = '#121212'; g.lineWidth = Math.max(1, R * 0.012); g.beginPath(); g.arc(cx, cy, R * 1.03, 0, Math.PI * 2); g.stroke();
}
/** la mire de 60 cm sur son chevalet : (cx, cy) est son centre, ppm les pixels par mètre à sa distance */
function drawMire(g, cx, cy, ppm, kind = 'mire', size = 0.6) {
  const k = size / 0.6;
  g.fillStyle = '#3a2a1c'; for (const dx of [-0.25, 0.25]) { g.save(); g.translate(cx + dx * k * ppm, cy + 0.3 * k * ppm); g.rotate(dx * 0.15); g.fillRect(-0.012 * ppm, 0, 0.024 * ppm, 1.4 * ppm); g.restore(); }
  g.fillStyle = kind === 'card' ? '#f1f1ed' : '#ecece6'; g.fillRect(cx - 0.3 * k * ppm, cy - 0.3 * k * ppm, 0.6 * k * ppm, 0.6 * k * ppm);
  if (kind === 'card') return;
  drawStar(g, cx, cy - 0.024 * k * ppm, 0.216 * k * ppm);
  for (let i = 0; i < 11; i++) { const v = Math.round(255 * Math.pow(i / 10, 1 / 1.1)); g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(cx - 0.252 * k * ppm + i * 0.0458 * k * ppm, cy + 0.228 * k * ppm, 0.0458 * k * ppm + 0.5, 0.036 * k * ppm); }
  if (kind === 'small') return;
  PATCHES.forEach((col, side) => col.forEach((c, i) => { g.fillStyle = c; g.fillRect(cx + (side ? 0.231 : -0.285) * k * ppm, cy + (-0.18 + i * 0.1025) * k * ppm, 0.054 * k * ppm, 0.09 * k * ppm); }));
}
function drawCurtain(g, W, H, ppm) {
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#0d1430'); gr.addColorStop(1, '#1a2550'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  // plis verticaux de 25 cm
  const n = Math.ceil(W / 2 / (0.25 * ppm)) + 1;
  for (let x = -n; x <= n; x++) {
    const px = W / 2 + x * 0.25 * ppm; const g2 = g.createLinearGradient(px, 0, px + 0.25 * ppm, 0);
    g2.addColorStop(0, 'rgba(0,0,0,0.35)'); g2.addColorStop(0.5, 'rgba(90,110,190,0.12)'); g2.addColorStop(1, 'rgba(0,0,0,0.35)'); g.fillStyle = g2; g.fillRect(px, 0, 0.25 * ppm + 1, H);
  }
  // sol (l'axe est à 1,40 m)
  const floorY = H / 2 + 1.4 * ppm; if (floorY < H) { g.fillStyle = '#1b1c1f'; g.fillRect(0, floorY, W, H - floorY); }
}
/** barres de couleur 75 % (sortie BARS de la caméra), en signal vidéo */
export function drawBars(g, W, H) {
  const cols = ['#bfbfbf', '#bfbf00', '#00bfbf', '#00bf00', '#bf00bf', '#bf0000', '#0000bf'];
  cols.forEach((c, i) => { g.fillStyle = c; g.fillRect(Math.round(i * W / 7), 0, Math.ceil(W / 7) + 1, H); });
}

// ---------------- les scènes du traitement de l'image (chapitre 4) ----------------
/** la peau de la présentatrice (scène « portrait »), en valeur de l'image */
export const SKIN = '#d29c7e';
/** dehors, par la fenêtre (scène « fenetre ») : ciel, nuages, immeuble, arbre ; en valeur de l'image */
export const OUTSIDE = { sky: '#96b9e1', cloud: '#f5f5f5', building: '#6e737d', tree: '#3c5a32' };
/** la fenêtre du mur du fond (m, centre par rapport à l'axe, largeur et hauteur du vitrage) */
export const WINDOW = { x: -1.05, y: 0.35, w: 0.9, h: 0.75 };
/** la scène « portrait » : la présentatrice (centre du visage) et la petite mire de 30 cm, par rapport à l'axe (m) */
export const PORTRAIT = { face: [-0.17, -0.03], mire: [0.28, 0], mireSize: 0.3 };
// tirages reproductibles (grain de peau, nuages, mèches)
const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296); };

/** la présentatrice en buste : (cx, cy) centre du visage, ppm pixels par mètre à sa distance */
function drawPresenter(g, cx, cy, ppm) {
  const m = (v) => v * ppm;
  // la veste à fines rayures (8 mm), la chemise, le cou
  g.fillStyle = '#232c44';
  g.beginPath(); g.moveTo(cx - m(0.26), cy + m(1)); g.lineTo(cx - m(0.26), cy + m(0.28)); g.quadraticCurveTo(cx - m(0.25), cy + m(0.16), cx - m(0.09), cy + m(0.15));
  g.lineTo(cx + m(0.09), cy + m(0.15)); g.quadraticCurveTo(cx + m(0.25), cy + m(0.16), cx + m(0.26), cy + m(0.28)); g.lineTo(cx + m(0.26), cy + m(1)); g.closePath(); g.fill();
  g.save(); g.clip(); g.strokeStyle = '#3c4a6c'; g.lineWidth = Math.max(1, m(0.0022));
  for (let x = -0.26; x <= 0.26; x += 0.008) { g.beginPath(); g.moveTo(cx + m(x), cy + m(0.12)); g.lineTo(cx + m(x), cy + m(1)); g.stroke(); }
  g.restore();
  g.fillStyle = '#ebe8e1'; g.beginPath(); g.moveTo(cx - m(0.06), cy + m(0.15)); g.lineTo(cx + m(0.06), cy + m(0.15)); g.lineTo(cx, cy + m(0.34)); g.closePath(); g.fill();
  // les cheveux, derrière le visage jusqu'aux épaules
  g.fillStyle = '#2b1d14'; g.beginPath(); g.ellipse(cx, cy - m(0.012), m(0.104), m(0.132), 0, 0, Math.PI * 2); g.fill();
  g.fillRect(cx - m(0.104), cy - m(0.012), m(0.208), m(0.19));
  // des mèches plus claires (le visage passe ensuite par-dessus)
  const r2 = lcg(5); g.strokeStyle = 'rgba(96,70,50,0.55)'; g.lineWidth = Math.max(1, m(0.0015));
  for (let i = 0; i < 26; i++) { const x0 = (r2() - 0.5) * 0.19, side = x0 < 0 ? -1 : 1; g.beginPath(); g.moveTo(cx + m(x0 * 0.5), cy - m(0.13)); g.quadraticCurveTo(cx + m(x0 + side * 0.03), cy - m(0.05), cx + m(x0 * 1.05), cy + m(0.17)); g.stroke(); }
  g.fillStyle = '#bf8a6d'; g.fillRect(cx - m(0.04), cy + m(0.06), m(0.08), m(0.1));
  g.beginPath(); g.moveTo(cx - m(0.04), cy + m(0.15)); g.lineTo(cx + m(0.04), cy + m(0.15)); g.lineTo(cx, cy + m(0.21)); g.closePath(); g.fill();
  // le visage, son grain, les joues
  g.fillStyle = SKIN; g.beginPath(); g.ellipse(cx, cy + m(0.012), m(0.078), m(0.104), 0, 0, Math.PI * 2); g.fill();
  g.save(); g.beginPath(); g.ellipse(cx, cy + m(0.012), m(0.078), m(0.104), 0, 0, Math.PI * 2); g.clip();
  const rnd = lcg(31), dot = Math.max(1, m(0.0016));
  for (let i = 0; i < 1400; i++) { g.fillStyle = rnd() < 0.5 ? 'rgba(120,64,44,0.16)' : 'rgba(255,232,214,0.14)'; g.fillRect(cx + m((rnd() - 0.5) * 0.16), cy + m((rnd() - 0.5) * 0.22), dot, dot); }
  for (const s of [-1, 1]) { const gr = g.createRadialGradient(cx + s * m(0.045), cy + m(0.035), 0, cx + s * m(0.045), cy + m(0.035), m(0.03)); gr.addColorStop(0, 'rgba(205,96,92,0.22)'); gr.addColorStop(1, 'rgba(205,96,92,0)'); g.fillStyle = gr; g.fillRect(cx + s * m(0.045) - m(0.03), cy + m(0.005), m(0.06), m(0.06)); }
  g.restore();
  // la frange
  g.fillStyle = '#2b1d14'; g.beginPath(); g.ellipse(cx + m(0.01), cy - m(0.08), m(0.088), m(0.05), -0.12, Math.PI * 0.95, Math.PI * 2.08); g.fill();
  // les yeux, les sourcils, le nez, la bouche
  for (const s of [-1, 1]) {
    const ex = cx + s * m(0.031), ey = cy - m(0.006);
    g.fillStyle = '#f2ece6'; g.beginPath(); g.ellipse(ex, ey, m(0.013), m(0.0062), 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#4a3324'; g.beginPath(); g.arc(ex, ey, m(0.0056), 0, Math.PI * 2); g.fill();
    g.fillStyle = '#0b0807'; g.beginPath(); g.arc(ex, ey, m(0.0024), 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#2b1d14'; g.lineWidth = Math.max(1, m(0.0035)); g.beginPath(); g.moveTo(cx + s * m(0.047), ey - m(0.016)); g.lineTo(cx + s * m(0.018), ey - m(0.021)); g.stroke();
  }
  g.strokeStyle = 'rgba(122,70,50,0.45)'; g.lineWidth = Math.max(1, m(0.0025)); g.beginPath(); g.moveTo(cx + m(0.002), cy + m(0.002)); g.lineTo(cx + m(0.008), cy + m(0.034)); g.lineTo(cx - m(0.006), cy + m(0.036)); g.stroke();
  g.fillStyle = '#a4505a'; g.beginPath(); g.ellipse(cx, cy + m(0.06), m(0.022), m(0.0075), 0, 0, Math.PI * 2); g.fill();
}
/** le vitrage de la fenêtre, en pixels, sur un calque à ppm pixels par mètre */
function windowRect(W, H, ppm) {
  return { x: W / 2 + (WINDOW.x - WINDOW.w / 2) * ppm, y: H / 2 - (WINDOW.y + WINDOW.h / 2) * ppm, w: WINDOW.w * ppm, h: WINDOW.h * ppm };
}
/** les montants de la fenêtre (une croisée) */
function windowBars(g, r, ppm, color) {
  const t = 0.03 * ppm; g.fillStyle = color;
  g.fillRect(r.x + r.w / 2 - t / 2, r.y, t, r.h); g.fillRect(r.x, r.y + r.h * 0.42 - t / 2, r.w, t);
}
/** le mur du fond avec sa fenêtre : le rideau, le cadre ; le vitrage est noir (la lumière du dehors est sur un calque à part) */
function drawWindowWall(g, W, H, ppm) {
  drawCurtain(g, W, H, ppm);
  const r = windowRect(W, H, ppm), f = 0.05 * ppm;
  g.fillStyle = '#5a4632'; g.fillRect(r.x - f, r.y - f, r.w + 2 * f, r.h + 2 * f);
  g.fillStyle = '#000'; g.fillRect(r.x, r.y, r.w, r.h);
  windowBars(g, r, ppm, '#5a4632');
}
/** ce qu'on voit par la fenêtre : ciel, nuages, un immeuble, un arbre (calque de la lumière du dehors) */
function drawOutside(g, W, H, ppm) {
  const r = windowRect(W, H, ppm), m = (v) => v * ppm;
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  g.save(); g.beginPath(); g.rect(r.x, r.y, r.w, r.h); g.clip();
  const sky = g.createLinearGradient(0, r.y, 0, r.y + r.h); sky.addColorStop(0, '#8db2de'); sky.addColorStop(0.5, OUTSIDE.sky); sky.addColorStop(1, '#a6c4e6'); g.fillStyle = sky; g.fillRect(r.x, r.y, r.w, r.h);
  const rnd = lcg(11); g.fillStyle = OUTSIDE.cloud;
  for (let c = 0; c < 4; c++) { const x = r.x + r.w * (0.1 + 0.25 * c + rnd() * 0.08), y = r.y + r.h * (0.14 + rnd() * 0.22); for (let i = 0; i < 6; i++) { g.beginPath(); g.ellipse(x + m((rnd() - 0.5) * 0.18), y + m((rnd() - 0.5) * 0.05), m(0.05 + rnd() * 0.05), m(0.025 + rnd() * 0.02), 0, 0, Math.PI * 2); g.fill(); } }
  g.fillStyle = OUTSIDE.building; g.fillRect(r.x + r.w * 0.52, r.y + r.h * 0.5, r.w * 0.4, r.h * 0.5);
  g.fillStyle = '#3c4048'; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) g.fillRect(r.x + r.w * (0.55 + i * 0.09), r.y + r.h * (0.56 + j * 0.11), r.w * 0.05, r.h * 0.06);
  g.fillStyle = OUTSIDE.tree; for (let i = 0; i < 7; i++) { g.beginPath(); g.arc(r.x + r.w * (0.12 + rnd() * 0.3), r.y + r.h * (0.66 + rnd() * 0.25), m(0.06 + rnd() * 0.05), 0, Math.PI * 2); g.fill(); }
  g.restore();
  windowBars(g, r, ppm, '#000');
}

// ---------------- le signal : linéaire ↔ vidéo ----------------
const DEC = new Float32Array(256); for (let i = 0; i < 256; i++) { const v = i / 255; DEC[i] = v < 0.081 ? v / 4.5 : Math.pow((v + 0.099) / 1.099, 1 / 0.45); }
const ENC_N = 4096; const ENC = new Uint8ClampedArray(ENC_N + 1);
for (let i = 0; i <= ENC_N; i++) { const l = i / ENC_N; ENC[i] = Math.round(255 * (l < 0.018 ? 4.5 * l : 1.099 * Math.pow(l, 0.45) - 0.099)); }
/** signal vidéo (0 à 1) d'une lumière linéaire, écrêté à 100 % */
export const encode = (l) => (l <= 0 ? 0 : l >= 1 ? 1 : ENC[Math.round(l * ENC_N)] / 255);
/** lumière linéaire d'une valeur de l'image (0 à 255) */
export const decode = (v) => DEC[Math.max(0, Math.min(255, Math.round(v)))];
/** blanc de la mire (valeur de l'image à l'exposition de référence) */
export const MIRE_WHITE = decode(236);
// bruit : une table de tirages gaussiens, lue à partir d'un décalage différent à chaque image
const NOISE = (() => { const n = 1 << 16, a = new Float32Array(n); let s = 12345; const rnd = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296); for (let i = 0; i < n; i += 2) { const u = Math.max(1e-7, rnd()), v = rnd(); const r = Math.sqrt(-2 * Math.log(u)); a[i] = r * Math.cos(2 * Math.PI * v); a[i + 1] = r * Math.sin(2 * Math.PI * v); } return a; })();

// ---------------- le traitement de l'image : les calculs (chapitre 4) ----------------
/** coefficients de luminance de l'ITU-R BT.709 : Y' = 0,2126 R' + 0,7152 G' + 0,0722 B' */
export const Y709 = [0.2126, 0.7152, 0.0722];
/** plafond du signal : code 1019 en 10 bits, (1019 − 64) / 876 = 109 % */
export const VMAX = (1019 - 64) / 876;
/**
 * Courbe de la caméra (OETF) : BT.709 pour g = 0,45 (V = 4,5 L sous 0,018, sinon
 * 1,099 L^0,45 − 0,099). Pour un autre exposant, même forme : la partie droite est tangente à la
 * courbe, le blanc (L = 1) reste à 100 % ; g ≥ 0,95 (ou au-delà) : pas de gamma, V = L.
 * Les lumières au-dessus du blanc (L > 1) donnent des niveaux au-dessus de 100 %.
 */
export function oetfParams(g = 0.45) {
  if (Math.abs(g - 0.45) < 1e-9) return { g, a: 1.099, beta: 0.018, slope: 4.5, lin: false };
  const a = 1.099, beta = Math.pow((a - 1) / (a * (1 - g)), 1 / g);
  if (!(g < 1) || beta >= 1) return { g, a, beta: 1, slope: 1, lin: true };
  return { g, a, beta, slope: a * g * Math.pow(beta, g - 1), lin: false };
}
export function oetf(L, g = 0.45, P = oetfParams(g)) {
  if (L <= 0) return 0;
  if (P.lin) return L;
  return L < P.beta ? P.slope * L : P.a * Math.pow(L, P.g) - (P.a - 1);
}
/** la lumière (relative au blanc) qui donne le niveau V, sur la courbe d'exposant g */
export function oetfInverse(V, g = 0.45) {
  const P = oetfParams(g); if (V <= 0) return 0; if (P.lin) return V;
  return V < P.slope * P.beta ? V / P.slope : Math.pow((V + P.a - 1) / P.a, 1 / P.g);
}
/**
 * Black gamma : sous le haut de sa plage (range, en niveau vidéo), la courbe est relevée
 * (level > 0, on ouvre les ombres) ou abaissée (level < 0, on les referme) ; le noir (0) et le
 * haut de la plage ne bougent pas, la courbe reste croissante pour level de −1 à +1. Au plus,
 * ± 14 % de la plage, au tiers de la plage. Forme du modèle : V + 0,14 × level × range × 6,75 x (1 − x)².
 */
export function blackGammaCurve(V, level, range = 0.3) {
  if (!level || V <= 0 || V >= range) return V;
  const x = V / range;
  return V + 0.14 * level * range * 6.75 * x * (1 - x) * (1 - x);
}
/** knee : au-dessus du point, le signal monte avec la pente donnée (1 = sans compression) */
export const kneeCurve = (V, point, slope) => (V > point ? point + (V - point) * slope : V);
/**
 * Matrice utilisateur, comme les réglages R-G, R-B, G-R, G-B, B-R, B-G : chaque voie reçoit une
 * part de sa différence avec une autre (R' = R + RG (R − G) + RB (R − B)…). Le blanc et les gris
 * (R = G = B) ne bougent pas : chaque ligne fait 1. Renvoie la matrice 3 × 3, ligne par ligne.
 */
export function userMatrix({ RG = 0, RB = 0, GR = 0, GB = 0, BR = 0, BG = 0 } = {}) {
  return [1 + RG + RB, -RG, -RB, -GR, 1 + GR + GB, -GB, -BR, -BG, 1 + BR + BG];
}
/** produit de deux matrices 3 × 3 (a appliquée après b) */
export function mulMatrix(a, b) {
  const o = new Array(9);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) o[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
  return o;
}
/** Y'CbCr d'un signal R'G'B' (BT.709) : Cb = (B' − Y') / 1,8556, Cr = (R' − Y') / 1,5748 */
export function ycc(r, g, b) { const y = Y709[0] * r + Y709[1] * g + Y709[2] * b; return [y, (b - y) / 1.8556, (r - y) / 1.5748]; }
/** teinte (degrés, depuis l'axe Cb, sens direct, comme le vectorscope) et saturation (module de CbCr) */
export function hueSat(r, g, b) { const [, cb, cr] = ycc(r, g, b); return { hue: (Math.atan2(cr, cb) * 180 / Math.PI + 360) % 360, sat: Math.hypot(cb, cr) }; }
/** écart de deux teintes (degrés, de −180 à 180) */
export const hueDiff = (a, b) => ((a - b + 540) % 360) - 180;
/** code numérique d'un niveau vidéo (1 = 100 %) : 10 bits 64 + 876 V, 8 bits 16 + 219 V (BT.709), bornés aux codes de l'image */
export const code10 = (V) => Math.max(4, Math.min(1019, Math.round(64 + 876 * V)));
export const code8 = (V) => Math.max(1, Math.min(254, Math.round(16 + 219 * V)));
/** poids « peau » d'un pixel (0 à 1) : sa teinte près de hue (± width degrés), assez colorée, ni noire ni blanche */
export function skinWeight(r, g, b, hue = 125, width = 22) {
  const y = Y709[0] * r + Y709[1] * g + Y709[2] * b; if (y < 0.12 || y > 0.95) return 0;
  const cb = (b - y) / 1.8556, cr = (r - y) / 1.5748, c = Math.hypot(cb, cr); if (c < 0.02) return 0;
  const dh = Math.abs(hueDiff(Math.atan2(cr, cb) * 180 / Math.PI, hue)); if (dh >= width) return 0;
  return 0.5 * (1 + Math.cos(Math.PI * dh / width)) * Math.min(1, (c - 0.02) / 0.02);
}
/** le contour ajouté par le détail pour un écart hp entre le pixel et ses voisins : seuil CRISP, gain, limiteur */
export function detailCore(hp, level, crisp = 0, limit = 0.12) {
  const a = Math.abs(hp); if (a <= crisp) return 0;
  const v = level * (hp > 0 ? a - crisp : crisp - a);
  return v > limit ? limit : v < -limit ? -limit : v;
}
/** les réglages du traitement, préparés une fois par image */
function prep(o) {
  const g = o.gamma != null ? o.gamma : 0.45, P = oetfParams(g);
  const TN = 16384, tab = new Float32Array(TN + 1); for (let i = 0; i <= TN; i++) tab[i] = oetf(i / TN, g, P);
  return {
    P, tab, TN, M: o.matrix || null, bg: o.blackGamma || 0, bgR: o.bgRange || 0.3,
    knee: o.knee || null, sat: o.sat != null ? o.sat : 1, clip: Math.min(VMAX, o.clip != null ? o.clip : 1),
  };
}
const cache = { key: '', p: null };
function prepCached(o) {
  const key = [o.gamma, o.blackGamma, o.bgRange, o.knee && o.knee.point, o.knee && o.knee.slope, o.sat, o.clip, o.matrix && o.matrix.join(',')].join('|');
  if (cache.key !== key) { cache.key = key; cache.p = prep(o); }
  return cache.p;
}
/** courbe (lumière linéaire → niveau vidéo, sans écrêtage) avec la table préparée */
function enc(L, p) { return L <= 0 ? 0 : L < 1 ? p.tab[Math.round(L * p.TN)] : oetf(L, p.P.g, p.P); }
/** une voie, de la courbe au knee (niveau vidéo, sans écrêtage) */
function curve(L, p) { let v = enc(L, p); if (p.bg) v = blackGammaCurve(v, p.bg, p.bgR); if (p.knee) v = kneeCurve(v, p.knee.point, p.knee.slope); return v; }
/**
 * Le traitement d'une lumière linéaire [R, V, B] (relative au blanc), sans le détail qui dépend
 * des voisins : matrice, courbe, black gamma, knee, saturation, white clip. Renvoie R'G'B' (1 = 100 %).
 * Les manipulations s'en servent pour leurs mesures, le viseur pour chaque pixel.
 */
export function paintLevels(lin, o = {}, clip = true) {
  const p = prepCached(o);
  let [r, g, b] = lin;
  if (p.M) { const m = p.M; const R = m[0] * r + m[1] * g + m[2] * b, G = m[3] * r + m[4] * g + m[5] * b, B = m[6] * r + m[7] * g + m[8] * b; r = R; g = G; b = B; }
  r = curve(r, p); g = curve(g, p); b = curve(b, p);
  if (p.sat !== 1) { const y = Y709[0] * r + Y709[1] * g + Y709[2] * b; r = y + p.sat * (r - y); g = y + p.sat * (g - y); b = y + p.sat * (b - y); }
  if (clip) { const c = p.clip; r = Math.max(0, Math.min(c, r)); g = Math.max(0, Math.min(c, g)); b = Math.max(0, Math.min(c, b)); }
  return [r, g, b];
}
/** lumière linéaire d'une couleur de la scène ('#rrggbb') à l'exposition E */
export const linOf = (hex, E = 1) => [1, 3, 5].map((i) => decode(parseInt(hex.slice(i, i + 2), 16)) * E);
/** les réglages du traitement sont-ils donnés (second chemin) ? */
export const usesPaint = (o) => o.scene !== 'bars' && !!(o.hi || o.gamma != null || o.blackGamma || o.knee || o.clip != null || o.sat != null || o.matrix || o.detail || o.scene === 'fenetre' || o.scene === 'portrait');

/**
 * La caméra, pixel par pixel, sur les valeurs d de l'image (RGBA, modifiées sur place) :
 * exposition, couleur, noirs, bruit, puis signal vidéo ; voie du viseur et zébras.
 * fno : numéro de l'image (le bruit change à chaque image) ; extra : la lumière du dehors
 * (scène « fenetre ») ; buf : tableaux réutilisés d'une image à l'autre. Renvoie le signal
 * (second chemin) : { data (niveaux × 255, au-delà de 255 pour les super-blancs), pre (luminance
 * avant le détail), stats (détail ajouté) }, ou null (premier chemin).
 */
export function processPixels(d, W, H, o, fno = 0, extra = null, buf = null) {
  if (usesPaint(o)) return paintPixels(d, W, H, o, fno, extra, buf || {});
  const bars = o.scene === 'bars';
  const E = o.E != null ? o.E : exposureOf(o.N, o.nd != null ? o.nd : 1, o.gain || 0) * (o.light || 1);
  const wb = o.wb || [1, 1, 1], bl = o.black || [0, 0, 0];
  const kR = bars ? 1 : E * wb[0] * ENC_N, kG = bars ? 1 : E * wb[1] * ENC_N, kB = bars ? 1 : E * wb[2] * ENC_N;
  const bR = bl[0] * ENC_N, bG = bl[1] * ENC_N, bB = bl[2] * ENC_N;
  const nz = bars ? 0 : (o.noise || 0) * ENC_N; let ni = (fno * 7919) & 0xffff;
  // décalage des capteurs : la voie rouge (ou bleue) est lue ailleurs dans l'image
  const src = o.reg && (o.reg.R || o.reg.B) ? new Uint8ClampedArray(d) : null;
  const rx = o.reg && o.reg.R ? Math.round(o.reg.R[0]) : 0, ry = o.reg && o.reg.R ? Math.round(o.reg.R[1]) : 0;
  const bxo = o.reg && o.reg.B ? Math.round(o.reg.B[0]) : 0, byo = o.reg && o.reg.B ? Math.round(o.reg.B[1]) : 0;
  const chan = o.chan || 'COLOR', z = o.zebra;
  const zLo = z ? (z.band ? z.level - (z.width || 10) / 2 : z.level) : 999, zHi = z ? (z.band ? z.level + (z.width || 10) / 2 : 999) : 999;
  for (let y = 0, i = 0; y < H; y++) {
    for (let x = 0; x < W; x++, i += 4) {
      let r = d[i], g = d[i + 1], b = d[i + 2];
      if (src) {
        const xr = Math.min(W - 1, Math.max(0, x - rx)), yr = Math.min(H - 1, Math.max(0, y - ry)); r = src[(yr * W + xr) * 4];
        const xb = Math.min(W - 1, Math.max(0, x - bxo)), yb = Math.min(H - 1, Math.max(0, y - byo)); b = src[(yb * W + xb) * 4 + 2];
      }
      if (!bars) {
        let n = 0; if (nz) { n = NOISE[ni]; ni = (ni + 1) & 0xffff; }
        const lr = DEC[r] * kR + bR + n * nz, lg = DEC[g] * kG + bG + n * nz, lb = DEC[b] * kB + bB + n * nz;
        r = lr <= 0 ? 0 : lr >= ENC_N ? 255 : ENC[lr | 0]; g = lg <= 0 ? 0 : lg >= ENC_N ? 255 : ENC[lg | 0]; b = lb <= 0 ? 0 : lb >= ENC_N ? 255 : ENC[lb | 0];
      }
      if (chan !== 'COLOR') { const v = chan === 'R' ? r : chan === 'G' ? g : chan === 'B' ? b : 0.2126 * r + 0.7152 * g + 0.0722 * b; r = g = b = v; }
      if (z) {
        const L = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 2.55;
        if (L >= zLo && L <= zHi && ((x + y) % 10) < 4) { r = g = b = 235; }
      }
      d[i] = r; d[i + 1] = g; d[i + 2] = b;
    }
  }
  return null;
}

/** le second chemin : en virgule flottante, avec les réglages du traitement */
function paintPixels(d, W, H, o, fno, extra, buf) {
  const N = W * H;
  if (!buf.sig || buf.sig.length !== N * 4) { buf.sig = new Float32Array(N * 4); buf.R = new Float32Array(N); buf.G = new Float32Array(N); buf.B = new Float32Array(N); buf.Y = new Float32Array(N); buf.T = new Float32Array(N); }
  const { sig, R, G, B, Y, T } = buf;
  const p = prepCached(o);
  const E = o.E != null ? o.E : exposureOf(o.N, o.nd != null ? o.nd : 1, o.gain || 0) * (o.light || 1);
  const wb = o.wb || [1, 1, 1], bl = o.black || [0, 0, 0];
  const kR = E * wb[0], kG = E * wb[1], kB = E * wb[2], xg = o.windowGain != null ? o.windowGain : 4;
  const nz = o.noise || 0; let ni = (fno * 7919) & 0xffff;
  const src = o.reg && (o.reg.R || o.reg.B) ? new Uint8ClampedArray(d) : null;
  const rx = o.reg && o.reg.R ? Math.round(o.reg.R[0]) : 0, ry = o.reg && o.reg.R ? Math.round(o.reg.R[1]) : 0;
  const bxo = o.reg && o.reg.B ? Math.round(o.reg.B[0]) : 0, byo = o.reg && o.reg.B ? Math.round(o.reg.B[1]) : 0;
  const m = p.M;
  // 1) lumière linéaire, matrice, courbe, black gamma, knee, saturation
  for (let y = 0, j = 0; y < H; y++) {
    for (let x = 0; x < W; x++, j++) {
      const i = j * 4;
      let r = d[i], g = d[i + 1], b = d[i + 2];
      if (src) {
        const xr = Math.min(W - 1, Math.max(0, x - rx)), yr = Math.min(H - 1, Math.max(0, y - ry)); r = src[(yr * W + xr) * 4];
        const xb = Math.min(W - 1, Math.max(0, x - bxo)), yb = Math.min(H - 1, Math.max(0, y - byo)); b = src[(yb * W + xb) * 4 + 2];
      }
      let n = 0; if (nz) { n = NOISE[ni]; ni = (ni + 1) & 0xffff; }
      let lr = DEC[r] * kR + bl[0] + n * nz, lg = DEC[g] * kG + bl[1] + n * nz, lb = DEC[b] * kB + bl[2] + n * nz;
      if (extra) { lr += DEC[extra[i]] * kR * xg; lg += DEC[extra[i + 1]] * kG * xg; lb += DEC[extra[i + 2]] * kB * xg; }
      if (m) { const a = m[0] * lr + m[1] * lg + m[2] * lb, c = m[3] * lr + m[4] * lg + m[5] * lb, e = m[6] * lr + m[7] * lg + m[8] * lb; lr = a; lg = c; lb = e; }
      let vr = curve(lr, p), vg = curve(lg, p), vb = curve(lb, p);
      const yy = Y709[0] * vr + Y709[1] * vg + Y709[2] * vb;
      if (p.sat !== 1) { vr = yy + p.sat * (vr - yy); vg = yy + p.sat * (vg - yy); vb = yy + p.sat * (vb - yy); }
      R[j] = vr; G[j] = vg; B[j] = vb; Y[j] = yy;
    }
  }
  // 2) le détail : l'écart entre la luminance et sa moyenne sur 3 × 3 pixels (1 2 1), ajouté aux trois voies
  const dt = o.detail; let stats = null;
  if (dt && dt.level) {
    for (let y = 0; y < H; y++) { const row = y * W; for (let x = 0; x < W; x++) { const l = Y[row + Math.max(0, x - 1)], rr = Y[row + Math.min(W - 1, x + 1)]; T[row + x] = 0.25 * l + 0.5 * Y[row + x] + 0.25 * rr; } }
    const skin = dt.skin || 0, hue = dt.skinHue != null ? dt.skinHue : 125, wid = dt.skinWidth || 22, crisp = dt.crisp || 0, lim = dt.limit != null ? dt.limit : 0.12;
    let flatRaw = 0, flatAbs = 0, flatN = 0, skinRaw = 0, skinAbs = 0, skinN = 0;
    for (let y = 0; y < H; y++) {
      const up = Math.max(0, y - 1) * W, dn = Math.min(H - 1, y + 1) * W, row = y * W;
      for (let x = 0; x < W; x++) {
        const j = row + x, hp = Y[j] - (0.25 * T[up + x] + 0.5 * T[j] + 0.25 * T[dn + x]);
        let dd = detailCore(hp, dt.level, crisp, lim);
        const raw = dd;
        if (skin) { const w = skinWeight(R[j], G[j], B[j], hue, wid); if (w > 0) { dd *= 1 - skin * w; if (w > 0.5) { skinRaw += Math.abs(raw); skinAbs += Math.abs(dd); skinN++; } } }
        if (Math.abs(hp) < 0.03) { flatRaw += Math.abs(dt.level * hp); flatAbs += Math.abs(dd); flatN++; }
        R[j] += dd; G[j] += dd; B[j] += dd;
      }
    }
    stats = { flatRaw: flatN ? flatRaw / flatN : 0, flatAbs: flatN ? flatAbs / flatN : 0, skinRaw: skinN ? skinRaw / skinN : 0, skinAbs: skinN ? skinAbs / skinN : 0, skinN };
  }
  // 3) white clip, signal, image du viseur (voie VF OUT, zébras)
  const clip = p.clip, chan = o.chan || 'COLOR', z = o.zebra;
  const zLo = z ? (z.band ? z.level - (z.width || 10) / 2 : z.level) : 999, zHi = z ? (z.band ? z.level + (z.width || 10) / 2 : 999) : 999;
  const to8 = (v) => (v >= 1 ? 255 : v <= 0 ? 0 : Math.round(v * 255));
  for (let y = 0, j = 0; y < H; y++) {
    for (let x = 0; x < W; x++, j++) {
      const i = j * 4;
      const r = Math.max(0, Math.min(clip, R[j])), g = Math.max(0, Math.min(clip, G[j])), b = Math.max(0, Math.min(clip, B[j]));
      sig[i] = r * 255; sig[i + 1] = g * 255; sig[i + 2] = b * 255; sig[i + 3] = 255;
      let vr = r, vg = g, vb = b;
      if (chan !== 'COLOR') { const v = chan === 'R' ? r : chan === 'G' ? g : chan === 'B' ? b : Y709[0] * r + Y709[1] * g + Y709[2] * b; vr = vg = vb = v; }
      let r8 = to8(vr), g8 = to8(vg), b8 = to8(vb);
      if (z) {
        const L = 100 * (Y709[0] * vr + Y709[1] * vg + Y709[2] * vb);
        if (L >= zLo && L <= zHi && ((x + y) % 10) < 4) { r8 = g8 = b8 = 235; }
      }
      d[i] = r8; d[i + 1] = g8; d[i + 2] = b8;
    }
  }
  return { data: sig, width: W, height: H, pre: dt && dt.level ? Y : null, stats };
}

/**
 * @typedef {object} VfState
 * @property {number} f focale (mm)
 * @property {number} dF distance de mise au point (m)
 * @property {number} [delta] erreur de tirage (mm)
 * @property {number} N nombre f effectif
 * @property {number} [nd] lumière transmise par le filtre ND
 * @property {number} [gain] gain (dB)
 * @property {number} [light] lumière du plateau (1 = éclairage de référence)
 * @property {number} [E] lumière reçue, si la manipulation la calcule elle-même
 * @property {[number, number, number]} [wb] dominante de couleur (gains R, V, B)
 * @property {[number, number, number]} [black] décalage des noirs (lumière linéaire, R, V, B)
 * @property {number} [noise] bruit (écart type en lumière linéaire)
 * @property {'mire' | 'card' | 'pdc' | 'bars' | 'fenetre' | 'portrait'} [scene] ce qu'il y a devant la caméra
 * @property {number} [D] distance de la mire (m)
 * @property {{ D: number, ang: number }[]} [cards] scène « pdc » : petites mires (distance, angle en degrés)
 * @property {'COLOR' | 'Y' | 'R' | 'G' | 'B'} [chan] VF OUT : la voie montrée par le viseur
 * @property {{ R?: [number, number], B?: [number, number] }} [reg] décalage des capteurs rouge et bleu (pixels)
 * @property {{ level: number, width?: number, band?: boolean }} [zebra] zébras : au-dessus de level (%), ou autour (band)
 * @property {boolean} [mag] loupe ×3 au centre
 * @property {boolean} [safety] cadre de sécurité 90 %
 * @property {boolean} [osd] incrustations (par défaut oui)
 * @property {string} [msg] message au centre du viseur (AWB: OK…)
 * @property {(g: CanvasRenderingContext2D, W: number, H: number) => void} [overlay] dessin par-dessus (menu)
 * @property {boolean} [hi] traitement de l'image (chapitre 4), champs facultatifs à partir d'ici ; un seul suffit pour passer au calcul en virgule flottante : vf.signal() donne alors les niveaux exacts, au-delà de 100 %
 * @property {number} [gamma] exposant de la courbe (0,45 = BT.709 ; 1 = sans gamma, signal linéaire)
 * @property {number} [blackGamma] black gamma, de −1 (ombres refermées) à +1 (ombres ouvertes)
 * @property {number} [bgRange] haut de la plage du black gamma (niveau vidéo, 0,3 par défaut)
 * @property {{ point: number, slope: number }} [knee] knee : point (niveau vidéo, 0,9 = 90 %) et pente au-dessus (1 = sans effet)
 * @property {number} [clip] white clip (niveau vidéo, 1 = 100 % par défaut, au plus 1,09)
 * @property {number} [sat] saturation (1 = inchangée, 0 = noir et blanc)
 * @property {number[]} [matrix] matrice 3 × 3 (lignes R, V, B) appliquée à la lumière linéaire (userMatrix)
 * @property {{ level: number, crisp?: number, limit?: number, skin?: number, skinHue?: number, skinWidth?: number }} [detail] détail : gain du contour, seuil CRISP et limiteur (niveau vidéo), réduction sur la peau (0 à 1) autour de la teinte skinHue (degrés)
 * @property {number} [windowGain] scène « fenetre » : lumière du dehors par rapport à celle du plateau (4 par défaut)
 */

/** le viseur simulé : { canvas, draw(o), image(), signal(), onFrame(fn), dispose() } */
export function makeViewfinder(W = 640, H = 360) {
  const view = cnv(W, H), frame = cnv(W, H), layer = cnv(W, H), work = cnv(W, H);
  frame.getContext('2d', { willReadFrequently: true }); // on relit ses pixels à chaque image (process)
  view.className = 'cl-vfc';
  let raf = 0, pending = /** @type {VfState | null} */ (null), img = /** @type {ImageData | null} */ (null), frameNo = 0;
  let outside = /** @type {HTMLCanvasElement | null} */ (null), sig = null;
  const buf = {};
  const listeners = [];

  /** une couche de la scène, dessinée puis floutée selon sa distance (sur dst : l'image, ou le calque du dehors) */
  function layerAt(o, D, paint, dst = frame) {
    const lg = layer.getContext('2d'); lg.clearRect(0, 0, W, H);
    const ppm = H / (D * SENSOR.h / o.f);
    paint(lg, ppm);
    discBlur(layer, dst, blurPx(Math.abs(defocus(o.f, D, o.dF, o.delta || 0)) / o.N, H) / 2, work);
  }
  function scene(o) {
    const fg = frame.getContext('2d'); fg.clearRect(0, 0, W, H);
    if (o.scene === 'bars') { drawBars(fg, W, H); return; }
    const D = o.D || MIRE_D;
    if (o.scene === 'pdc') {
      const cards = [...(o.cards || [])].sort((a, b) => b.D - a.D);
      layerAt(o, 6.5, (g, ppm) => drawCurtain(g, W, H, ppm));
      for (const c of cards) layerAt(o, c.D, (g, ppm) => drawMire(g, W / 2 + c.D * Math.tan(c.ang * Math.PI / 180) * ppm, H / 2, ppm, 'small', 0.3));
      return;
    }
    if (o.scene === 'fenetre') {
      if (!outside) { outside = cnv(W, H); outside.getContext('2d', { willReadFrequently: true }); }
      outside.getContext('2d').clearRect(0, 0, W, H);
      layerAt(o, D + 1.75, (g, ppm) => drawWindowWall(g, W, H, ppm));
      layerAt(o, D + 1.75, (g, ppm) => drawOutside(g, W, H, ppm), outside);
      layerAt(o, D, (g, ppm) => drawMire(g, W / 2, H / 2, ppm, 'mire'));
      return;
    }
    if (o.scene === 'portrait') {
      layerAt(o, D + 1.75, (g, ppm) => drawCurtain(g, W, H, ppm));
      layerAt(o, D, (g, ppm) => {
        drawMire(g, W / 2 + PORTRAIT.mire[0] * ppm, H / 2 - PORTRAIT.mire[1] * ppm, ppm, 'mire', PORTRAIT.mireSize);
        drawPresenter(g, W / 2 + PORTRAIT.face[0] * ppm, H / 2 - PORTRAIT.face[1] * ppm, ppm);
      });
      return;
    }
    layerAt(o, D + 1.75, (g, ppm) => drawCurtain(g, W, H, ppm));
    layerAt(o, D, (g, ppm) => drawMire(g, W / 2, H / 2, ppm, o.scene === 'card' ? 'card' : 'mire'));
  }
  /** la caméra : exposition, couleur, noirs, bruit, puis signal vidéo ; voie du viseur et zébras */
  function process(o) {
    const fg = frame.getContext('2d');
    const id = fg.getImageData(0, 0, W, H), d = id.data;
    const extra = o.scene === 'fenetre' && outside ? outside.getContext('2d').getImageData(0, 0, W, H).data : null;
    sig = processPixels(d, W, H, o, frameNo++, extra, buf);
    fg.putImageData(id, 0, 0);
    img = id;
  }
  function osd(o) {
    const vg = view.getContext('2d');
    vg.shadowColor = 'rgba(0,0,0,0.7)'; vg.shadowBlur = 3;
    if (o.osd !== false) {
      vg.font = '600 15px "B612 Mono", monospace'; vg.fillStyle = 'rgba(240,240,232,0.92)';
      vg.textAlign = 'left'; vg.fillText(`Z ${fr(o.f, o.f < 10 ? 1 : 0)} mm`, 12, 22); vg.fillText(o.N >= 64 ? 'C' : `F${fr(o.N, 1)}`, 12, 42);
      if (o.gain) vg.fillText(`${o.gain > 0 ? '+' : ''}${o.gain} dB`, 12, 62);
      const nd = ND.find((x) => x[1] === (o.nd != null ? o.nd : 1)); vg.textAlign = 'right'; vg.fillText(nd ? nd[0] : '', W - 12, 22);
      if (o.chan && o.chan !== 'COLOR') vg.fillText('VF OUT ' + o.chan, W - 12, 42);
      if (o.mag) { vg.fillStyle = '#ffb020'; vg.fillText('MAG ×3', W - 12, H - 14); }
    }
    if (o.msg) { vg.font = '700 17px "B612 Mono", monospace'; vg.fillStyle = 'rgba(240,240,232,0.96)'; vg.textAlign = 'center'; vg.fillText(o.msg, W / 2, H * 0.78); }
    vg.shadowBlur = 0;
    if (o.safety) { vg.strokeStyle = 'rgba(240,240,232,0.7)'; vg.lineWidth = 1.5; vg.strokeRect(W * 0.05, H * 0.05, W * 0.9, H * 0.9); }
    if (o.osd !== false) { vg.strokeStyle = 'rgba(240,240,232,0.55)'; vg.lineWidth = 1.5; vg.beginPath(); vg.moveTo(W / 2 - 10, H / 2); vg.lineTo(W / 2 + 10, H / 2); vg.moveTo(W / 2, H / 2 - 10); vg.lineTo(W / 2, H / 2 + 10); vg.stroke(); }
    if (o.overlay) o.overlay(vg, W, H);
  }
  function render() {
    raf = 0; const o = pending; if (!o) return;
    scene(o); process(o);
    const vg = view.getContext('2d'); vg.imageSmoothingEnabled = true;
    if (o.mag) vg.drawImage(frame, W / 3, H / 3, W / 3, H / 3, 0, 0, W, H); else vg.drawImage(frame, 0, 0);
    osd(o);
    for (const fn of listeners) fn(img);
  }
  return {
    canvas: view,
    /** redessine (au plus une fois par image) */
    draw(o) { pending = o; if (!raf) raf = requestAnimationFrame(render); },
    /** dessine tout de suite (essais) */
    now(o) { pending = o; if (raf) cancelAnimationFrame(raf); render(); },
    /** l'image traitée, avant la loupe (pour les mesures) */
    image: () => img,
    /** le signal de la caméra en virgule flottante (second chemin seulement, sinon null) : niveaux × 255, avant VF OUT et zébras */
    signal: () => sig,
    /** appelé à chaque nouvelle image */
    onFrame(fn) { listeners.push(fn); },
    dispose() { if (raf) cancelAnimationFrame(raf); raf = 0; listeners.length = 0; },
  };
}

/** niveau vidéo (%) du blanc de la mire, voie par voie, pour une lumière reçue E et une dominante wb */
export function whiteLevels(E, wb = [1, 1, 1], white = MIRE_WHITE) {
  return wb.map((k) => 100 * encode(white * E * k));
}

// ---------------- les mesures : forme d'onde et parade ----------------
/**
 * Dessine la forme d'onde (luminance) ou la parade (R, V, B côte à côte) d'une image traitée.
 * Graduations 0 à 100 %, comme le moniteur de forme d'onde du plateau.
 */
export function drawScope(canvas, img, mode = 'luma') {
  const g = canvas.getContext('2d'); const w = canvas.width, h = canvas.height;
  const top = 8, bot = h - 14, y0 = (p) => bot - (bot - top) * p / 109;
  g.fillStyle = '#05070a'; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(120,200,160,0.22)'; g.lineWidth = 1; g.font = '600 9px "B612 Mono", monospace'; g.fillStyle = 'rgba(150,210,180,0.6)'; g.textAlign = 'left';
  for (const p of [0, 25, 50, 75, 100]) { const y = Math.round(y0(p)) + 0.5; g.beginPath(); g.moveTo(22, y); g.lineTo(w - 2, y); g.stroke(); g.fillText(String(p), 2, y + 3); }
  if (!img) return;
  const d = img.data, W = img.width, H = img.height;
  const parts = mode === 'parade' ? [0, 1, 2] : [-1];
  const pw = (w - 24) / parts.length;
  const cols = ['rgba(255,90,80,', 'rgba(110,235,120,', 'rgba(110,150,255,'];
  parts.forEach((ch, pi) => {
    const x0 = 24 + pi * pw, bins = new Uint16Array(Math.ceil(pw) * (bot - top + 1));
    const bw = Math.ceil(pw), bh = bot - top + 1;
    for (let y = 0; y < H; y += 3) {
      for (let x = 0; x < W; x += 2) {
        const i = (y * W + x) * 4;
        const v = ch < 0 ? 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2] : d[i + ch];
        const p = v / 2.55, bx = Math.min(bw - 1, Math.floor(x / W * pw)), by = Math.round(y0(p) - top);
        if (by >= 0 && by < bh) bins[by * bw + bx]++;
      }
    }
    const c = ch < 0 ? 'rgba(130,240,170,' : cols[ch];
    for (let by = 0; by < bh; by++) for (let bx = 0; bx < bw; bx++) { const n = bins[by * bw + bx]; if (n) { g.fillStyle = c + Math.min(1, 0.18 + n * 0.12).toFixed(2) + ')'; g.fillRect(x0 + bx, top + by, 1, 1); } }
    if (parts.length > 1) { g.fillStyle = c + '0.8)'; g.fillText('RVB'[ch], x0 + 3, h - 3); }
  });
  g.fillStyle = 'rgba(150,210,180,0.6)'; g.textAlign = 'right'; g.fillText(mode === 'parade' ? 'parade' : 'forme d\'onde', w - 3, h - 3);
}

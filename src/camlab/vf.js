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
 * @property {'mire' | 'card' | 'pdc' | 'bars'} [scene] ce qu'il y a devant la caméra
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
 */

/** le viseur simulé : { canvas, draw(o), image(), whiteLevel(o) } */
export function makeViewfinder(W = 640, H = 360) {
  const view = cnv(W, H), frame = cnv(W, H), layer = cnv(W, H), work = cnv(W, H);
  frame.getContext('2d', { willReadFrequently: true }); // on relit ses pixels à chaque image (process)
  view.className = 'cl-vfc';
  let raf = 0, pending = /** @type {VfState | null} */ (null), img = /** @type {ImageData | null} */ (null), frameNo = 0;
  const listeners = [];

  /** une couche de la scène, dessinée puis floutée selon sa distance */
  function layerAt(o, D, paint) {
    const lg = layer.getContext('2d'); lg.clearRect(0, 0, W, H);
    const ppm = H / (D * SENSOR.h / o.f);
    paint(lg, ppm);
    discBlur(layer, frame, blurPx(Math.abs(defocus(o.f, D, o.dF, o.delta || 0)) / o.N, H) / 2, work);
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
    layerAt(o, D + 1.75, (g, ppm) => drawCurtain(g, W, H, ppm));
    layerAt(o, D, (g, ppm) => drawMire(g, W / 2, H / 2, ppm, o.scene === 'card' ? 'card' : 'mire'));
  }
  /** la caméra : exposition, couleur, noirs, bruit, puis signal vidéo ; voie du viseur et zébras */
  function process(o) {
    const fg = frame.getContext('2d');
    const id = fg.getImageData(0, 0, W, H), d = id.data;
    const bars = o.scene === 'bars';
    const E = o.E != null ? o.E : exposureOf(o.N, o.nd != null ? o.nd : 1, o.gain || 0) * (o.light || 1);
    const wb = o.wb || [1, 1, 1], bl = o.black || [0, 0, 0];
    const kR = bars ? 1 : E * wb[0] * ENC_N, kG = bars ? 1 : E * wb[1] * ENC_N, kB = bars ? 1 : E * wb[2] * ENC_N;
    const bR = bl[0] * ENC_N, bG = bl[1] * ENC_N, bB = bl[2] * ENC_N;
    const nz = bars ? 0 : (o.noise || 0) * ENC_N; let ni = (frameNo++ * 7919) & 0xffff;
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

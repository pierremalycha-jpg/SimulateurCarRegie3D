// @ts-check
// Schémas des fiches « ? » pour la mesure vidéo (PRISM : waveform, vecteurscope, diamant, diagramme de l'œil…) : ajoutés à ui/term_figs.js (FIGS).
// SVG dessinés en code, aux couleurs de l'interface : ambre pour les graticules, vert pour les traces,
// bleu clair pour les repères, rouge pour ce qui sort des limites.
import { FIGS } from './term_figs.js';

const FG = '#e7eaed', MUTED = '#9aa3ab', LINE = '#4a5560', ACC = '#8ccdf2', AMB = '#f0a61c', GRN = '#2fbf5a', RED = '#ff6b5e', BOX = '#1c2126', GLASS = '#070a0c';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const n = (v) => Math.round(v * 10) / 10;
const T = (x, y, s, o = {}) => `<text x="${n(x)}" y="${n(y)}" fill="${o.c || FG}" font-size="${o.s || 12}"${o.a ? ` text-anchor="${o.a}"` : ''}${o.w ? ` font-weight="${o.w}"` : ''}>${esc(s)}</text>`;
const R = (x, y, w, h, o = {}) => `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="${o.r ?? 3}" fill="${o.f || BOX}" stroke="${o.s || LINE}" stroke-width="${o.sw || 1}"${o.d ? ' stroke-dasharray="4 3"' : ''}/>`;
const L = (x1, y1, x2, y2, o = {}) => `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke="${o.c || LINE}" stroke-width="${o.w || 1.5}"${o.d ? ' stroke-dasharray="5 4"' : ''}${o.arrow ? ` marker-end="url(#m-${o.arrow})"` : ''}/>`;
const C = (x, y, r, o = {}) => `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}" fill="${o.f || 'none'}" stroke="${o.s || LINE}" stroke-width="${o.sw || 1}"${o.d ? ' stroke-dasharray="4 3"' : ''}/>`;
const PL = (pts, o = {}) => `<polyline points="${pts.map(([x, y]) => n(x) + ',' + n(y)).join(' ')}" fill="${o.f || 'none'}" stroke="${o.c || GRN}" stroke-width="${o.w || 1.6}"${o.d ? ' stroke-dasharray="4 3"' : ''}${o.op ? ` stroke-opacity="${o.op}"` : ''}/>`;
const PG = (pts, o = {}) => `<polygon points="${pts.map(([x, y]) => n(x) + ',' + n(y)).join(' ')}" fill="${o.f || 'none'}" stroke="${o.c || AMB}" stroke-width="${o.w || 1.4}"${o.d ? ' stroke-dasharray="5 4"' : ''}/>`;
const MK = [['l', LINE], ['a', AMB], ['c', ACC], ['f', FG], ['r', RED]];
const svg = (w, h, body, title) => `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(title)}" font-family="Barlow, 'Segoe UI', sans-serif"><defs>${MK.map(([k, c]) => `<marker id="m-${k}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${c}"/></marker>`).join('')}</defs>${body}</svg>`;
// matrice BT.709 : luminance et différences de couleur
const ycc = (r, g, b) => { const y = 0.2126 * r + 0.7152 * g + 0.0722 * b; return [y, (b - y) / 1.8556, (r - y) / 1.5748]; };
/** @type {Array<[string, number, number, number]>} */
const BARS = [['Yl', 1, 1, 0], ['Cy', 0, 1, 1], ['G', 0, 1, 0], ['Mg', 1, 0, 1], ['R', 1, 0, 0], ['B', 0, 0, 1]];

/** @type {Record<string, () => string>} */
const ADD = {
  // ---------------- waveform : de l'image à la trace ----------------
  wfm() {
    // image : ciel clair, maillot blanc, pelouse, ombre noire (colonnes)
    /** @type {Array<[number, number, string, number]>} */
    const zones = [[0, 40, '#c9ced3', 0.78], [40, 30, '#f4f4f4', 0.97], [70, 70, '#3f8a3a', 0.45], [140, 40, '#141414', 0.02]];
    let b = T(20, 18, 'L\'image', { c: MUTED }) + zones.map(([x, w, c]) => `<rect x="${20 + x}" y="28" width="${w}" height="110" fill="${c}"/>`).join('') + R(20, 28, 180, 110, { f: 'none' });
    b += L(214, 83, 262, 83, { c: FG, arrow: 'f' }) + T(238, 74, 'colonne', { a: 'middle', s: 10.5, c: MUTED }) + T(238, 100, 'par colonne', { a: 'middle', s: 10.5, c: MUTED });
    const X0 = 310, W = 200, Y = (v) => 140 - v * 110;
    b += T(X0, 18, 'Le waveform', { c: MUTED }) + R(X0, 28, W, 116, { f: GLASS });
    for (const v of [0, 0.25, 0.5, 0.75, 1]) b += L(X0, Y(v), X0 + W, Y(v), { c: v === 0 || v === 1 ? AMB : '#5a4a2a', w: 1 });
    b += T(X0 - 6, Y(1) + 4, '700 mV', { a: 'end', s: 10.5, c: AMB }) + T(X0 - 6, Y(0.5) + 4, '350', { a: 'end', s: 10.5, c: AMB }) + T(X0 - 6, Y(0) + 4, '0 mV', { a: 'end', s: 10.5, c: AMB });
    for (const [x, w, , v] of zones) { const xa = X0 + x / 180 * W, xb = X0 + (x + w) / 180 * W; for (const dv of [-0.03, 0, 0.03]) b += L(xa + 2, Y(v + dv), xb - 2, Y(v + dv * 0.5), { c: GRN, w: 1.3 }); }
    b += T(X0 + W + 6, Y(1) + 4, '100 % blanc', { s: 10.5 }) + T(X0 + W + 6, Y(0) + 4, '0 % noir', { s: 10.5 });
    b += T(20, 168, 'Chaque colonne de l\'image reste à sa place horizontale ; la hauteur donne son niveau.', { s: 11.5 }) + T(20, 186, 'Le maillot blanc monte vers 97 %, la pelouse tient vers 45 %, l\'ombre tombe à 0 %.', { s: 11.5, c: MUTED });
    return svg(560, 196, b, 'Waveform : chaque colonne de l\'image tracée selon son niveau');
  },
  // ---------------- parade RVB ----------------
  parade() {
    const panel = (x0, title, lev, sub) => {
      let s = T(x0, 18, title, { w: 600 }) + R(x0, 26, 230, 120, { f: GLASS });
      const Y = (v) => 136 - v * 100;
      for (const v of [0, 0.5, 1]) s += L(x0, Y(v), x0 + 230, Y(v), { c: v === 0.5 ? '#5a4a2a' : AMB, w: 1 });
      ['R', 'G', 'B'].forEach((k, i) => { const xa = x0 + 8 + i * 75, c = ['#ff6b6b', '#5ee07a', '#6f9bff'][i]; s += L(xa, Y(lev[i][0]), xa + 60, Y(lev[i][0]), { c, w: 2.2 }) + L(xa, Y(lev[i][1]), xa + 60, Y(lev[i][1]), { c, w: 2.2 }) + T(xa + 30, 40, k, { a: 'middle', c, w: 700 }); });
      return s + T(x0, 166, sub, { s: 11.5, c: MUTED });
    };
    let b = panel(20, 'Balance neutre', [[0.9, 0.02], [0.9, 0.02], [0.9, 0.02]], 'Blancs et noirs : trois traces alignées.');
    b += panel(300, 'Dominante rouge', [[0.98, 0.06], [0.9, 0.02], [0.84, 0.02]], 'R trop haut sur le blanc (et le noir) : à corriger.');
    b += T(300, 186, 'AWB, ou baisser WHITE R ; ABB pour les noirs.', { s: 11.5 });
    return svg(560, 196, b, 'Parade RVB : balance neutre et dominante rouge');
  },
  // ---------------- vecteurscope ----------------
  vecteur() {
    const cx = 170, cy = 150, s = 230;
    let b = C(cx, cy, 0.56 * s, { s: AMB }) + L(cx - 0.56 * s, cy, cx + 0.56 * s, cy, { c: '#5a4a2a', w: 1 }) + L(cx, cy - 0.56 * s, cx, cy + 0.56 * s, { c: '#5a4a2a', w: 1 });
    for (const [k, r, g, bb] of BARS) { const [, cb, cr] = ycc(r * 0.75, g * 0.75, bb * 0.75); const x = cx + cb * s, y = cy - cr * s; b += R(x - 7, y - 7, 14, 14, { f: 'none', s: AMB, r: 1 }) + T(x + (cb < 0 ? -14 : 14), y + 4, k, { a: 'middle', c: AMB, w: 700 }); }
    const a = 123 * Math.PI / 180; b += L(cx, cy, cx + Math.cos(a) * 0.56 * s, cy - Math.sin(a) * 0.56 * s, { c: AMB, w: 1, d: true }) + T(cx + Math.cos(a) * 0.6 * s - 8, cy - Math.sin(a) * 0.6 * s, 'tons chair', { a: 'end', s: 10.5, c: AMB });
    // une couleur : angle = teinte, rayon = saturation
    const [, pb, pr] = ycc(0.2, 0.55, 0.15); const px = cx + pb * s * 1.4, py = cy - pr * s * 1.4;
    b += L(cx, cy, px, py, { c: ACC, w: 2 }) + `<circle cx="${n(px)}" cy="${n(py)}" r="4" fill="${ACC}"/>` + `<path d="M ${n(cx + 40)} ${n(cy)} A 40 40 0 0 1 ${n(cx + 40 * (px - cx) / Math.hypot(px - cx, py - cy))} ${n(cy + 40 * (py - cy) / Math.hypot(px - cx, py - cy))}" fill="none" stroke="${ACC}" stroke-width="1.3"/>`;
    b += T(cx + 44, cy + 26, 'angle = teinte', { s: 11, c: ACC }) + T(px - 8, py + 18, 'rayon = saturation', { s: 11, c: ACC, a: 'end' });
    b += T(cx + 0.56 * s - 4, cy - 6, 'Cb', { a: 'end', s: 11, c: MUTED }) + T(cx + 6, cy - 0.56 * s + 12, 'Cr', { s: 11, c: MUTED });
    b += T(340, 40, 'Cases : la mire 75 %', { s: 12, w: 600 }) + T(340, 60, 'Centre : blanc, gris, noir', { s: 12 }) + T(340, 80, 'Loin du centre : saturé', { s: 12 }) + T(340, 112, 'Zoom ×5 sur le centre :', { s: 12, c: MUTED }) + T(340, 130, 'juger la balance des blancs', { s: 12, c: MUTED });
    return svg(540, 300, b, 'Vecteurscope : cibles de la mire, teinte et saturation');
  },
  // ---------------- mire 100/0/75/0 ----------------
  mire() {
    const cols = [['#ffffff', 'Blanc 100 %'], ['#bfbf00', 'Jaune'], ['#00bfbf', 'Cyan'], ['#00bf00', 'Vert'], ['#bf00bf', 'Magenta'], ['#bf0000', 'Rouge'], ['#0000bf', 'Bleu'], ['#000000', 'Noir']];
    let b = cols.map(([c, l], i) => `<rect x="${20 + i * 64}" y="20" width="64" height="80" fill="${c}"/>` + T(52 + i * 64, 120, l, { a: 'middle', s: 10.5 })).join('') + R(20, 20, 512, 80, { f: 'none' });
    b += T(20, 146, 'Notation 100/0/75/0 : blanc à 100 %, noir à 0 %, couleurs entre 0 et 75 %.', { s: 11.5 }) + T(20, 164, 'Une mire 100 % pousserait le jaune et le cyan à 133 % en composite.', { s: 11.5, c: MUTED });
    return svg(552, 174, b, 'Mire de barres de couleur 75 %');
  },
  // ---------------- lightning ----------------
  lightning() {
    const cx = 170, cy = 150, hy = 120, sx = 200;
    let b = L(cx - 120, cy, cx + 120, cy, { c: '#5a4a2a', w: 1 }) + L(cx, cy - hy, cx, cy + hy, { c: '#5a4a2a', w: 1 });
    const seq = [[1, 1, 1], ...BARS.map(([, r, g, bb]) => [r, g, bb]), [0, 0, 0]];
    const up = seq.map(([r, g, bb]) => { const [y, cb] = ycc(r * (r + g + bb === 3 ? 1 : 0.75), g * (r + g + bb === 3 ? 1 : 0.75), bb * (r + g + bb === 3 ? 1 : 0.75)); return [cx + cb * sx, cy - y * hy]; });
    const dn = seq.map(([r, g, bb]) => { const k = r + g + bb === 3 ? 1 : 0.75; const [y, , cr] = ycc(r * k, g * k, bb * k); return [cx + cr * sx, cy + y * hy]; });
    b += PL(up, { c: GRN }) + PL(dn, { c: GRN });
    for (const [x, y] of [...up.slice(1, 7), ...dn.slice(1, 7)]) b += R(x - 5, y - 5, 10, 10, { f: 'none', s: AMB, r: 1 });
    b += L(cx - 7, cy - 0.375 * hy, cx + 7, cy - 0.375 * hy, { c: AMB, w: 2 }) + L(cx - 7, cy + 0.375 * hy, cx + 7, cy + 0.375 * hy, { c: AMB, w: 2 });
    b += T(cx + 124, cy - hy + 10, 'haut : Y et Cb', { s: 11 }) + T(cx + 124, cy + hy, 'bas : Y et Cr', { s: 11 }) + T(cx + 124, cy - 30, 'repères du centre :', { s: 11, c: AMB }) + T(cx + 124, cy - 14, 'la transition vert → magenta', { s: 11, c: AMB }) + T(cx + 124, cy + 2, 'doit y passer (Y et C', { s: 11, c: AMB }) + T(cx + 124, cy + 18, 'alignés dans le temps)', { s: 11, c: AMB });
    return svg(500, 300, b, 'Lightning : luminance et différences de couleur sur la mire');
  },
  // ---------------- diamant : du carré G-B au losange ----------------
  diamant() {
    let b = T(20, 20, 'Valeurs permises de G et B', { c: MUTED }) + R(40, 36, 120, 120, { f: '#13261a', s: GRN });
    b += T(100, 176, 'G : 0 → 700 mV', { a: 'middle', s: 11 }) + T(30, 100, 'B', { a: 'end', s: 11 }) + T(40, 172, 'noir', { s: 10, c: MUTED }) + T(160, 32, 'blanc', { a: 'end', s: 10, c: MUTED });
    b += L(182, 96, 232, 96, { c: FG, arrow: 'f' }) + T(207, 86, 'tourné de 45°', { a: 'middle', s: 10.5, c: MUTED });
    const cx = 340, by = 180, s = 72;
    const dia = [[cx, by], [cx - s, by - s], [cx, by - 2 * s], [cx + s, by - s]];
    b += PG(dia, { c: AMB, f: '#13261a' }) + T(cx - s - 8, by - s + 4, 'G seul', { a: 'end', s: 11 }) + T(cx + s + 8, by - s + 4, 'B seul', { s: 11 }) + T(cx, by - 2 * s - 6, 'blanc', { a: 'middle', s: 11 }) + T(cx, by + 16, 'noir (centre)', { a: 'middle', s: 11 });
    // une couleur trop bleue, hors du losange
    const ex = cx + 0.95 * s, ey = by - 1.55 * s; b += `<circle cx="${n(ex)}" cy="${n(ey)}" r="5" fill="${RED}"/>` + T(ex + 10, ey - 6, 'B > 700 mV', { s: 11, c: RED, w: 600 }) + T(ex + 10, ey + 9, 'hors gamut', { s: 11, c: RED });
    b += T(20, 212, 'Losange du haut : B + G en hauteur, B − G en largeur. Celui du bas fait de même avec R et G.', { s: 11.5 }) + T(20, 230, 'Tant que la trace reste dans les losanges, R, G et B sont entre 0 et 700 mV.', { s: 11.5, c: MUTED });
    return svg(540, 240, b, 'Diamant : construction du losange de gamut RVB');
  },
  // ---------------- split diamant ----------------
  split() {
    const cx = 150, s = 52, gap = 26, yT = 130 - gap / 2, yB = 130 + gap / 2;
    let b = PG([[cx, yT], [cx - s, yT - s], [cx, yT - 2 * s], [cx + s, yT - s]]) + PG([[cx, yB], [cx - s, yB + s], [cx, yB + 2 * s], [cx + s, yB + s]]);
    b += R(cx - 60, yT + 2, 120, gap - 4, { f: '#0f2a3a', s: ACC, d: true }) + T(cx, 134, 'sous le noir', { a: 'middle', s: 11, c: ACC, w: 600 });
    b += T(cx + s + 10, yT - s + 4, 'B, G', { s: 11 }) + T(cx + s + 10, yB + s + 4, 'R, G', { s: 11 });
    b += T(270, 70, 'Diamant normal : les deux', { s: 12 }) + T(270, 88, 'pointes noires se touchent ;', { s: 12 }) + T(270, 106, 'un noir négatif y est caché.', { s: 12 }) + T(270, 150, 'Split : losanges écartés,', { s: 12, c: ACC }) + T(270, 168, 'ce qui tombe entre eux', { s: 12, c: ACC }) + T(270, 186, 'est sous le noir.', { s: 12, c: ACC });
    return svg(480, 260, b, 'Split diamant : les losanges écartés montrent les noirs négatifs');
  },
  // ---------------- arrowhead ----------------
  arrow() {
    const x0 = 60, Y = (v) => 210 - (v + 0.45) / 1.9 * 190, sx = 190 / 1.9, X = (c) => x0 + c * sx;
    let b = L(x0, Y(-0.45), x0, Y(1.45), { c: AMB, w: 1.2 });
    for (const v of [0, 0.5, 1]) b += T(x0 - 6, Y(v) + 4, `${Math.round(v * 100)} %`, { a: 'end', s: 10.5, c: AMB });
    b += L(X(0), Y(4 / 3), X(5 / 6), Y(0.5), { c: AMB, w: 1.6 }) + L(X(0), Y(-1 / 3), X(5 / 6), Y(0.5), { c: AMB, w: 1.6 }) + L(X(0), Y(1), X(0.5), Y(0.5), { c: '#5a4a2a', w: 1, d: true }) + L(X(0), Y(0), X(0.5), Y(0.5), { c: '#5a4a2a', w: 1, d: true });
    for (const [, r, g, bb] of BARS) for (const k of [0.75, 1]) { const y6 = 0.299 * r * k + 0.587 * g * k + 0.114 * bb * k; const c = Math.hypot(0.493 * (bb * k - y6), 0.877 * (r * k - y6)); b += `<circle cx="${n(X(c))}" cy="${n(Y(y6))}" r="3.5" fill="${k === 1 ? RED : GRN}"/>`; }
    b += T(X(0.05), Y(4 / 3) - 6, 'Y + C = 133 %', { s: 11 }) + T(X(0.05), Y(-1 / 3) + 16, 'Y − C = −33 %', { s: 11 });
    b += T(270, 70, 'hauteur : luminance', { s: 12 }) + T(270, 88, 'largeur : chrominance', { s: 12 }) + T(270, 120, 'vert : mire 75 %', { s: 12, c: GRN }) + T(270, 138, 'rouge : mire 100 %, sur', { s: 12, c: RED }) + T(270, 156, 'les limites du composite', { s: 12, c: RED });
    return svg(460, 230, b, 'Arrowhead : limites du signal composite');
  },
  // ---------------- CIE 1931 ----------------
  cie() {
    const ox = 40, oy = 300, s = 330, X = (x) => ox + x * s, Y = (y) => oy - y * s;
    const loc = [[0.1741, 0.005], [0.1644, 0.0109], [0.144, 0.0297], [0.1241, 0.0578], [0.0913, 0.1327], [0.0454, 0.295], [0.0082, 0.5384], [0.0139, 0.7502], [0.0743, 0.8338], [0.1547, 0.8059], [0.2296, 0.7543], [0.3016, 0.6923], [0.3731, 0.6245], [0.4441, 0.5547], [0.5125, 0.4866], [0.5752, 0.4242], [0.627, 0.3725], [0.6915, 0.3083], [0.7347, 0.2653]];
    let b = L(ox, oy, X(0.8), oy, { c: LINE, w: 1 }) + L(ox, oy, ox, Y(0.9), { c: LINE, w: 1 });
    b += PG(loc.map(([x, y]) => [X(x), Y(y)]), { c: FG, w: 1.4 });
    b += PG([[0.64, 0.33], [0.3, 0.6], [0.15, 0.06]].map(([x, y]) => [X(x), Y(y)]), { c: AMB, w: 1.8 }) + PG([[0.708, 0.292], [0.17, 0.797], [0.131, 0.046]].map(([x, y]) => [X(x), Y(y)]), { c: ACC, w: 1.6, d: true });
    b += `<circle cx="${n(X(0.3127))}" cy="${n(Y(0.329))}" r="3.5" fill="${FG}"/>` + T(X(0.3127) + 7, Y(0.329) + 4, 'D65', { s: 11 });
    b += T(X(0.0139) - 4, Y(0.7502), '510 nm', { a: 'end', s: 10, c: MUTED }) + T(X(0.7347) + 4, Y(0.2653) + 4, '700 nm', { s: 10, c: MUTED }) + T(X(0.1741), Y(0.005) + 14, '380 nm', { a: 'middle', s: 10, c: MUTED });
    b += T(X(0.8), oy - 6, 'x', { a: 'end', s: 11, c: MUTED }) + T(ox + 6, Y(0.9) + 10, 'y', { s: 11, c: MUTED });
    b += T(250, 50, 'BT.709 (HD)', { s: 12, c: AMB, w: 600 }) + T(250, 68, 'BT.2020 (UHD, HDR)', { s: 12, c: ACC, w: 600 }) + T(250, 86, 'bord : couleurs pures', { s: 12 });
    return svg(400, 320, b, 'Diagramme CIE 1931 avec les gamuts BT.709 et BT.2020');
  },
  // ---------------- diagramme de l'œil ----------------
  oeil() {
    const x0 = 70, W = 300, yH = 50, yL = 170, mid = 110; const xc1 = x0 + W / 4, xc2 = x0 + 3 * W / 4;
    const tr = (y1, y2, xs, ov = 0) => { const pts = []; for (let i = 0; i <= 40; i++) { const t = i / 40; const x = xs - 40 + t * 80; const e = 1 / (1 + Math.exp(-(t - 0.5) * 11)); const bump = ov * Math.exp(-Math.pow((t - 0.72) / 0.12, 2)); pts.push([x, y1 + (y2 - y1) * e + (y2 < y1 ? -bump : bump)]); } return pts; };
    let b = R(x0, 30, W, 160, { f: GLASS });
    for (const xs of [xc1, xc2]) for (const dx of [-5, 0, 5]) { b += PL(tr(yL, yH, xs + dx, 8), { c: GRN, w: 1.2, op: 0.8 }) + PL(tr(yH, yL, xs + dx, 8), { c: GRN, w: 1.2, op: 0.8 }); }
    b += L(x0, yH, xc1 - 40, yH, { c: GRN, w: 1.2 }) + L(xc1 + 40, yH, xc2 - 40, yH, { c: GRN, w: 1.2 }) + L(xc2 + 40, yH, x0 + W, yH, { c: GRN, w: 1.2 }) + L(x0, yL, xc1 - 40, yL, { c: GRN, w: 1.2 }) + L(xc1 + 40, yL, xc2 - 40, yL, { c: GRN, w: 1.2 }) + L(xc2 + 40, yL, x0 + W, yL, { c: GRN, w: 1.2 });
    // annotations
    b += L(x0 + W / 2, yH + 4, x0 + W / 2, yL - 4, { c: ACC, w: 1.4, arrow: 'c' }) + L(x0 + W / 2, yL - 4, x0 + W / 2, yH + 4, { c: ACC, w: 1.4, arrow: 'c' }) + T(x0 + W / 2 + 6, mid + 4, 'amplitude', { s: 11, c: ACC }) + T(x0 + W / 2 + 6, mid + 18, '800 mV ± 10 %', { s: 11, c: ACC });
    const y20 = yL - 0.2 * (yL - yH), y80 = yL - 0.8 * (yL - yH);
    b += L(xc1 - 40, y20, xc1 + 40, y20, { c: AMB, w: 1, d: true }) + L(xc1 - 40, y80, xc1 + 40, y80, { c: AMB, w: 1, d: true }) + T(x0 - 6, y20 + 4, '20 %', { a: 'end', s: 10.5, c: AMB }) + T(x0 - 6, y80 + 4, '80 %', { a: 'end', s: 10.5, c: AMB });
    b += L(xc1 - 11, 205, xc1 + 11, 205, { c: AMB, w: 1.4 }) + T(xc1, 220, 'montée', { a: 'middle', s: 11, c: AMB });
    b += L(xc2 - 10, 18, xc2 + 10, 18, { c: RED, w: 1.4 }) + T(xc2, 14, 'gigue', { a: 'middle', s: 11, c: RED });
    b += T(xc1 + 28, yH - 12, 'dépassement', { s: 11, c: RED }) + L(xc1 + 28, yH - 10, xc1 + 18, yH - 5, { c: RED, w: 1 });
    b += L(xc1, 196, xc2, 196, { c: FG, w: 1 }) + T((xc1 + xc2) / 2, 192, '1 UI (un bit)', { a: 'middle', s: 10.5 });
    b += T(390, 60, 'Œil ouvert : le', { s: 12 }) + T(390, 78, 'récepteur lit sans', { s: 12 }) + T(390, 96, 'peine les 0 et les 1.', { s: 12 }) + T(390, 130, 'Câble, réflexions,', { s: 12, c: MUTED }) + T(390, 148, 'bruit et gigue le', { s: 12, c: MUTED }) + T(390, 166, 'referment.', { s: 12, c: MUTED });
    return svg(540, 230, b, 'Diagramme de l\'œil : amplitude, temps de montée, dépassement, gigue');
  },
  // ---------------- affaiblissement et longueur ----------------
  cable() {
    const x0 = 60, y0 = 190, W = 300, H = 160, X = (m) => x0 + m / 150 * W, Y = (db) => y0 - db / 50 * H;
    let b = L(x0, y0, x0 + W, y0, { c: LINE }) + L(x0, y0, x0, y0 - H, { c: LINE });
    for (const m of [0, 50, 100, 150]) b += T(X(m), y0 + 16, `${m} m`, { a: 'middle', s: 10.5, c: MUTED });
    for (const db of [0, 20, 40]) b += L(x0, Y(db), x0 + W, Y(db), { c: db ? '#5a4a2a' : LINE, w: 1, d: !!db }) + T(x0 - 6, Y(db) + 4, `${db} dB`, { a: 'end', s: 10.5, c: AMB });
    /** @type {Array<[string, number, string, number]>} */
    const lines = [['HD-SDI', 17.72, GRN, 20], ['3G-SDI', 25.59, ACC, 20], ['12G-SDI', 58.07, RED, 40]];
    for (const [lab, a, c, lim] of lines) {
      const mMax = Math.min(150, 50 / a * 100); b += L(X(0), Y(0), X(mMax), Y(mMax * a / 100), { c, w: 2 });
      const mL = lim / a * 100; b += `<circle cx="${n(X(mL))}" cy="${n(Y(lim))}" r="3.5" fill="${c}"/>` + T(X(mL) + 6, Y(lim) + (lab === '12G-SDI' ? -6 : 14), `${lab} : ${Math.round(mL)} m`, { s: 10.5, c });
    }
    b += T(380, 50, 'Câble Belden 1694A,', { s: 12 }) + T(380, 68, 'perte à la demi-', { s: 12 }) + T(380, 86, 'fréquence d\'horloge.', { s: 12 }) + T(380, 120, 'Minimum garanti par', { s: 12, c: MUTED }) + T(380, 138, 'la norme : 20 dB', { s: 12, c: MUTED }) + T(380, 156, '(HD, 3G), 40 dB (12G).', { s: 12, c: MUTED });
    return svg(540, 210, b, 'Affaiblissement du câble en fonction de la longueur');
  },
  // ---------------- effet de falaise ----------------
  falaise() {
    const x0 = 50, y0 = 180, W = 320, H = 140;
    let b = L(x0, y0, x0 + W, y0, { c: LINE, arrow: 'l' }) + L(x0, y0, x0, y0 - H, { c: LINE, arrow: 'l' }) + T(x0 + W, y0 + 16, 'longueur de câble →', { a: 'end', s: 10.5, c: MUTED });
    b += PL([[x0, y0 - 120], [x0 + 230, y0 - 120], [x0 + 248, y0 - 100], [x0 + 260, y0 - 20], [x0 + 270, y0 - 2], [x0 + W - 10, y0 - 2]], { c: GRN, w: 2.2 }) + T(x0 + 8, y0 - 126, 'qualité de l\'image', { s: 11, c: GRN });
    const crc = []; for (let i = 0; i <= 30; i++) { const x = x0 + 150 + i * 4; crc.push([x, y0 - Math.min(120, Math.pow(1.22, i) * 1.2)]); } b += PL(crc, { c: RED, w: 1.8 }) + T(x0 + 150, y0 - 40, 'erreurs CRC', { s: 11, c: RED });
    b += R(x0 + 200, y0 - H, 58, H, { f: 'none', s: AMB, d: true }) + T(x0 + 229, y0 - H - 6, 'zone des CRC', { a: 'middle', s: 10.5, c: AMB });
    b += T(390, 60, 'Parfait, parfait…', { s: 12 }) + T(390, 78, 'puis plus rien.', { s: 12 }) + T(390, 112, 'Seuls les CRC', { s: 12, c: MUTED }) + T(390, 130, 'préviennent avant.', { s: 12, c: MUTED });
    return svg(520, 200, b, 'Effet de falaise du signal numérique');
  },
  // ---------------- timing par rapport à la référence ----------------
  timing() {
    const cx = 150, cy = 115, rx = 120, ry = 85;
    let b = R(cx - rx, cy - ry, 2 * rx, 2 * ry, { f: GLASS, s: AMB }) + L(cx - rx, cy, cx + rx, cy, { c: '#5a4a2a', w: 1 }) + L(cx, cy - ry, cx, cy + ry, { c: '#5a4a2a', w: 1 }) + C(cx, cy, 9, { s: AMB });
    b += `<circle cx="${cx}" cy="${cy}" r="5" fill="${GRN}"/>` + `<circle cx="${cx + 52}" cy="${cy + 28}" r="5" fill="${RED}"/>` + L(cx + 6, cy + 3, cx + 46, cy + 25, { c: RED, w: 1, d: true });
    b += T(cx + 60, cy + 44, 'retard + décalage', { s: 11, c: RED }) + T(cx + 60, cy + 58, 'de lignes', { s: 11, c: RED }) + T(cx + 12, cy - 12, 'à l\'heure', { s: 11, c: GRN });
    b += T(cx - rx + 4, cy - 6, 'avance', { s: 10.5, c: MUTED }) + T(cx + rx - 4, cy - 6, 'retard', { a: 'end', s: 10.5, c: MUTED }) + T(cx + 4, cy - ry + 14, 'lignes', { s: 10.5, c: MUTED });
    b += T(290, 60, 'Horizontal : µs', { s: 12 }) + T(290, 78, 'Vertical : lignes', { s: 12 }) + T(290, 112, 'Un point qui dérive :', { s: 12, c: MUTED }) + T(290, 130, 'source non verrouillée', { s: 12, c: MUTED }) + T(290, 148, '(genlock).', { s: 12, c: MUTED });
    return svg(460, 210, b, 'Affichage du timing d\'une source par rapport à la référence');
  },
};
Object.assign(FIGS, ADD);

// @ts-check
// ----------------------------------------------------------------------------------
// L'instrument de mesure, façon Tektronix / Telestream PRISM : un écran tactile en 4 tuiles (ou une
// seule en plein écran), chaque tuile choisit son affichage. Les affichages vidéo (waveform, parade,
// vecteurscope, lightning, diamant, split diamant, arrowhead, CIE 1931, histogramme, image) sont calculés
// sur l'image réellement rendue de la source : la mesure du simulateur (SCOPE dans pipeline.js, 192 × 108
// points lus sans bloquer la carte graphique, environ 8 fois par seconde). Les affichages de couche
// physique (œil, gigue, timing, état SDI) viennent du modèle de la liaison (prism_model.js).
// Le même instrument sert au poste vision (régler les caméras) et à la baie de mesure (qualifier le
// signal SDI lui-même). Dessin à 10 Hz au plus, canvas à la taille réelle de chaque tuile (graticules nets).
// ----------------------------------------------------------------------------------
import { S, on } from '../state.js';
import { el, clamp, fmt, tc } from '../util.js';
import { SCOPE, resolve } from '../pipeline.js';
import { q } from './term.js';
import { explain } from './widgets.js';
import {
  PRISM, APPS, APP_NAME, PRESETS, setTile, setPreset, setLayout, setInput, linkOf, timingOf, eyeSim, counters, resetCounters, tickCounters, tickPhy,
  sdiStd, lenOf, CABLE, AMP_NOM, AMP_TOL, OVERSHOOT_MAX,
} from '../prism_model.js';

// nouvelle image mesurée (pipeline.js : événement « scope »)
const DATA = { seq: 0 };
on('scope', () => { DATA.seq++; });

// ---------------- couleurs et matrices ----------------
const GRAT = 'rgba(255,196,90,0.42)', GRAT2 = 'rgba(255,196,90,0.22)', LAB = '#e0b75a', WARN = '#ff7a6e', CYAN = '#5cc8ec', BG = '#05080a', TXT = '#d8e2dc';
const MONO = '"B612 Mono", "JetBrains Mono", ui-monospace, monospace';
const MAT = { bt709: [0.2126, 0.7152, 0.0722], bt2020: [0.2627, 0.6780, 0.0593] };
const XYZ = {
  bt709: [[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]],
  bt2020: [[0.6370, 0.1446, 0.1689], [0.2627, 0.6780, 0.0593], [0.0, 0.0281, 1.0610]],
};
// courbe inverse : signal → lumière (SDR : écran BT.1886, gamma 2,4 ; HLG : OETF inverse de BT.2100)
const linSDR = (v) => Math.pow(Math.max(0, v), 2.4);
const linHLG = (v) => { v = Math.max(0, v); return v <= 0.5 ? v * v / 3 : (Math.exp((v - 0.55991073) / 0.17883277) + 0.28466892) / 12; };
// locus spectral CIE 1931 (observateur 2°), de 380 à 700 nm
/** @type {Array<[number, number, number]>} */
const LOCUS = [[380, 0.1741, 0.0050], [420, 0.1714, 0.0051], [440, 0.1644, 0.0109], [450, 0.1566, 0.0177], [460, 0.1440, 0.0297], [470, 0.1241, 0.0578], [475, 0.1096, 0.0868], [480, 0.0913, 0.1327], [485, 0.0687, 0.2007], [490, 0.0454, 0.2950], [495, 0.0235, 0.4127], [500, 0.0082, 0.5384], [505, 0.0039, 0.6548], [510, 0.0139, 0.7502], [515, 0.0389, 0.8120], [520, 0.0743, 0.8338], [525, 0.1142, 0.8262], [530, 0.1547, 0.8059], [540, 0.2296, 0.7543], [550, 0.3016, 0.6923], [560, 0.3731, 0.6245], [570, 0.4441, 0.5547], [580, 0.5125, 0.4866], [590, 0.5752, 0.4242], [600, 0.6270, 0.3725], [610, 0.6658, 0.3340], [620, 0.6915, 0.3083], [630, 0.7079, 0.2920], [640, 0.7190, 0.2809], [660, 0.7300, 0.2700], [700, 0.7347, 0.2653]];
const PRIM = { bt709: [[0.640, 0.330], [0.300, 0.600], [0.150, 0.060]], bt2020: [[0.708, 0.292], [0.170, 0.797], [0.131, 0.046]] };
const D65 = [0.3127, 0.3290];
// mire : jaune, cyan, vert, magenta, rouge, bleu (R, G, B à 0 ou 1)
/** @type {Array<[string, number, number, number]>} */
const BARS = [['Yl', 1, 1, 0], ['Cy', 0, 1, 1], ['G', 0, 1, 0], ['Mg', 1, 0, 1], ['R', 1, 0, 0], ['B', 0, 0, 1]];

// ---------------- textes : comment lire chaque affichage ----------------
const EXPL = {
  pic: 'Image : ce que transporte l\'entrée mesurée, en petit. « Gamut » fait clignoter les points hors des limites RVB (−5 % à 105 %, EBU R 103) : on voit quelle zone de l\'image pose problème. « Zones » trace les cadres de sécurité action (93 %) et titres (90 %).',
  'wfm:y': 'Waveform en luminance : chaque colonne de l\'image est tracée à sa place, la hauteur donne le niveau, de 0 mV (noir) à 700 mV (blanc nominal, 100 %). Regardez le haut de la trace (blancs sous 100 %, 103 % au plus selon le diffuseur) et le bas (noirs posés entre 0 et 2 %). « Curseur » : une ligne à déplacer pour lire un niveau.',
  'wfm:rgb': 'Parade RVB : le rouge, le vert et le bleu côte à côte, chacun de 0 à 700 mV. Sur un blanc ou un gris neutre, les trois traces sont à la même hauteur ; sur les noirs aussi. Une trace plus haute sur les blancs = dominante (balance des blancs) ; sur les noirs = noir déséquilibré (balance des noirs).',
  'wfm:ycbcr': 'Parade YCbCr : la luminance Y (0 à 700 mV), puis les différences de couleur Cb et Cr, centrées sur 350 mV (zéro de couleur). C\'est le signal tel qu\'il voyage dans le câble SDI. Sur un gris, Cb et Cr restent au centre.',
  vec: 'Vecteurscope : chaque point de l\'image est placé selon sa couleur. L\'angle donne la teinte, la distance au centre la saturation ; au centre, le blanc, les gris et le noir. Les cases sont les cibles de la mire : 75 % pour la mire du car (EBU 100/0/75/0), 100 % pour une mire pleine. En ×5, on zoome sur le centre pour juger la balance.',
  lightning: 'Lightning : la luminance en hauteur, une différence de couleur en largeur (Cb en haut, Cr en bas, le noir au centre). Sur la mire, chaque barre tombe dans sa cible : gains et couleurs vérifiés d\'un coup. La transition vert-magenta doit passer par les repères du centre ; sinon luminance et couleur sont décalées dans le temps.',
  diamond: 'Diamant : l\'affichage de Tektronix pour le gamut RVB. En haut, bleu et vert ; en bas, rouge et vert ; le noir au centre, le blanc aux pointes. Tant que la trace reste dans les deux losanges, chaque composante R, G, B est entre 0 et 700 mV : le signal est « légal ». Sortie par une pointe = blanc trop haut ; par un côté = couleur trop saturée.',
  split: 'Split diamant : le même diamant coupé en deux, les losanges écartés. Les noirs ne se superposent plus au centre : on voit les excursions sous le noir (valeurs négatives), cachées dans le diamant normal. La chaîne de ce car écrête à 0 : vous n\'en trouverez pas ici, mais une source extérieure peut en avoir.',
  arrow: 'Arrowhead : la luminance en hauteur, l\'amplitude de la chrominance en largeur. Les obliques sont les limites du signal composite (PAL) : luminance + chrominance en haut (133 % pour la mire 100 %), luminance − chrominance en bas (−33 %). Il ne sert que si l\'image doit encore sortir en composite analogique.',
  cie: 'CIE 1931 : les couleurs de l\'image placées dans le diagramme de chromaticité (le « fer à cheval » des couleurs visibles). Triangle plein : gamut BT.709 (HD) ; pointillé : BT.2020 (UHD, HDR). En HLG, on vérifie que les couleurs très saturées restent dans le triangle prévu.',
  histo: 'Histogramme : le nombre de points de l\'image à chaque niveau, de 0 à 109 %. Un tas collé à droite = blancs écrêtés ; collé à gauche = noirs bouchés. Pratique pour un coup d\'œil, mais le waveform dit où sont ces points dans l\'image.',
  eye: 'Diagramme de l\'œil : des milliers de bits du signal SDI superposés sur deux périodes. Plus l\'œil est ouvert au centre, plus le récepteur distingue facilement les 0 des 1. On y lit l\'amplitude (800 mV ± 10 %), les temps de montée et de descente, le dépassement. L\'œil brut inclut le câble : il se ferme après quelques dizaines de mètres, c\'est normal ; l\'œil égalisé montre ce que lit le récepteur.',
  jitter: 'Gigue : les fronts du signal n\'arrivent pas tout à fait à l\'heure. Filtre timing (10 Hz) : toute la gigue, lente comprise ; filtre alignement (100 kHz en HD et 3G) : seulement la gigue rapide, celle qui ferme l\'œil. Les deux se lisent en UI (la durée d\'un bit) et se comparent aux limites de la norme.',
  timing: 'Timing : où arrive la source par rapport à la référence du SPG (tri-level ou black burst). Au centre de la croix, la source est « à l\'heure » et le mélangeur peut la couper sans saut. Horizontal en µs, vertical en lignes. Un point qui dérive = source non verrouillée (genlock perdu).',
  status: 'État SDI : le format reconnu, les erreurs CRC (chaque ligne porte une somme de contrôle : une erreur = une ligne reçue fausse), l\'affaiblissement mesuré par l\'égaliseur, la longueur de câble qu\'on en déduit et la marge. Des CRC qui montent alors que l\'image paraît bonne : la liaison est au bord de la falaise.',
};
// fiche « ? » de chaque affichage
const TERM_OF = { pic: 'gamut', 'wfm:y': 'waveform', 'wfm:rgb': 'parade-rvb', 'wfm:ycbcr': 'ycbcr', vec: 'vecteurscope', lightning: 'lightning', diamond: 'diamant', split: 'split-diamant', arrow: 'arrowhead', cie: 'cie1931', histo: 'histogramme', eye: 'oeil', jitter: 'gigue-timing', timing: 'timing-ref', status: 'crc-edh' };
const keyOf = (t) => (t.app === 'wfm' ? 'wfm:' + t.mode : t.app);
export const explainTile = (t) => EXPL[keyOf(t)] || '';

// ---------------- mesures sur l'image ----------------
/** statistiques de l'image mesurée (une fois par image reçue, partagées par les tuiles) */
function videoStats(buf, W, H, mat) {
  const [kr, kg, kb] = MAT[mat];
  let ymax = -1, ymin = 9, ys = 0, rmax = 0, gmax = 0, bmax = 0, rmin = 9, gmin = 9, bmin = 9, gam = 0, gR = 0, gG = 0, gB = 0, y103 = 0, comp = [-9, 9];
  const n = W * H;
  for (let i = 0; i < n; i++) {
    const k = i * 4; const R = buf[k] / 255 * 1.1, G = buf[k + 1] / 255 * 1.1, B = buf[k + 2] / 255 * 1.1;
    const Y = kr * R + kg * G + kb * B; ys += Y;
    if (Y > ymax) ymax = Y; if (Y < ymin) ymin = Y; if (Y > 1.03) y103++;
    if (R > rmax) rmax = R; if (G > gmax) gmax = G; if (B > bmax) bmax = B; if (R < rmin) rmin = R; if (G < gmin) gmin = G; if (B < bmin) bmin = B;
    const oR = R > 1.05 || R < -0.05, oG = G > 1.05 || G < -0.05, oB = B > 1.05 || B < -0.05;
    if (oR) gR++; if (oG) gG++; if (oB) gB++; if (oR || oG || oB) gam++;
    // composite PAL (pour l'arrowhead) : luminance BT.601, chrominance U / V
    const y6 = 0.299 * R + 0.587 * G + 0.114 * B; const c = Math.hypot(0.493 * (B - y6), 0.877 * (R - y6));
    if (y6 + c > comp[0]) comp[0] = y6 + c; if (y6 - c < comp[1]) comp[1] = y6 - c;
  }
  return { ymax, ymin, ymean: ys / n, rmax, gmax, bmax, rmin, gmin, bmin, gam: gam / n, gR: gR / n, gG: gG / n, gB: gB / n, y103: y103 / n, comp };
}
const pct = (v, d = 1) => fmt(v * 100, d) + ' %';
// moitié de la fréquence d'horloge, où l'on compte l'affaiblissement du câble
const halfTxt = (f) => (f.half >= 1000 ? String(f.half / 1000).replace('.', ',') + ' GHz' : String(f.half).replace('.', ',') + ' MHz');
const mv = (v) => Math.round(v * 700) + ' mV';

// ---------------- dessin : outils ----------------
function text(g, s, x, y, k, o = {}) { g.font = `${o.w || 500} ${(o.s || 10.5) * k}px ${MONO}`; g.fillStyle = o.c || LAB; g.textAlign = o.a || 'left'; g.textBaseline = o.b || 'alphabetic'; g.fillText(s, x, y); }
function line(g, x1, y1, x2, y2, c = GRAT, w = 1, dash = null) { g.strokeStyle = c; g.lineWidth = w; g.setLineDash(dash || []); g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); g.setLineDash([]); }
function msg(g, w, h, k, a, b = '') { g.fillStyle = BG; g.fillRect(0, 0, w, h); text(g, a, w / 2, h / 2 - (b ? 6 * k : 0), k, { a: 'center', c: WARN, s: 13, w: 700 }); if (b) text(g, b, w / 2, h / 2 + 12 * k, k, { a: 'center', c: TXT, s: 10.5 }); }
// accumulation de points (traces en « phosphore ») dans un rectangle
function acc(T, w, h) {
  if (!T._img || T._img.width !== w || T._img.height !== h) T._img = new ImageData(Math.max(1, w), Math.max(1, h));
  T._img.data.fill(0); return T._img;
}
function plot(d, w, x, y, r, gg, b) { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= w) return; const k = (y * w + x) * 4; if (k + 3 >= d.length) return; d[k] = Math.min(255, d[k] + r); d[k + 1] = Math.min(255, d[k + 1] + gg); d[k + 2] = Math.min(255, d[k + 2] + b); d[k + 3] = 255; }
function colorDiff(R, G, B, mat) { const [kr, kg, kb] = MAT[mat]; const Y = kr * R + kg * G + kb * B; return [Y, (B - Y) / (2 * (1 - kb)), (R - Y) / (2 * (1 - kr))]; }

// ---------------- waveform ----------------
function drawWfm(g, w, h, k, T, V) {
  const m = { l: 40 * k, r: 6 * k, t: 8 * k, b: 6 * k };
  const pw = Math.floor(w - m.l - m.r), ph = Math.floor(h - m.t - m.b);
  const lo = -50, hi = 800; // mV
  const yOf = (v) => m.t + (1 - (v * 700 - lo) / (hi - lo)) * ph;
  const img = acc(T, pw, ph); const d = img.data;
  const { buf, W, H } = V; const mode = T.mode;
  const inc = clamp(Math.round(24 * ph / H), 30, 110);
  const span = mode === 'y' ? pw : pw / 3;
  const [kr, kg, kb] = MAT[V.mat];
  // chaque colonne de l'image occupe sa largeur sur la trace (pas de trous quand la tuile est grande)
  const put = (x, off, v, r, gg, b) => { const a = off + Math.floor(x / W * span), z = Math.max(a + 1, off + Math.floor((x + 1) / W * span)); const y = yOf(v) - m.t; for (let c = a; c < z; c++) plot(d, pw, c, y, r, gg, b); };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4; const R = buf[i] / 255 * 1.1, G = buf[i + 1] / 255 * 1.1, B = buf[i + 2] / 255 * 1.1;
    if (mode === 'rgb') {
      put(x, 0, R, inc, inc * 0.25, inc * 0.25); put(x, span, G, inc * 0.25, inc, inc * 0.3); put(x, 2 * span, B, inc * 0.35, inc * 0.5, inc * 1.2);
    } else {
      const Y = kr * R + kg * G + kb * B;
      if (mode === 'ycbcr') { put(x, 0, Y, inc * 0.4, inc, inc * 0.45); put(x, span, 0.5 + (B - Y) / (2 * (1 - kb)), inc * 0.4, inc * 0.7, inc); put(x, 2 * span, 0.5 + (R - Y) / (2 * (1 - kr)), inc, inc * 0.5, inc * 0.5); }
      else put(x, 0, Y, inc * 0.4, inc, inc * 0.45);
    }
  }
  const third = span;
  g.fillStyle = BG; g.fillRect(0, 0, w, h);
  g.putImageData(img, Math.round(m.l), Math.round(m.t));
  // graticule : mV ou %
  const ticks = T.scale === 'pct' ? [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1] : [0, 1, 2, 3, 4, 5, 6, 7].map((v) => v / 7);
  for (const v of ticks) { const y = yOf(v); line(g, m.l, y, m.l + pw, y, (Math.round(v * 100) % 50 === 0 || T.scale !== 'pct') ? GRAT : GRAT2); text(g, T.scale === 'pct' ? String(Math.round(v * 100)) : String(Math.round(v * 700)), m.l - 4 * k, y + 3.5 * k, k, { a: 'right' }); }
  line(g, m.l, yOf(1.09), m.l + pw, yOf(1.09), 'rgba(255,110,100,0.7)', 1, [4 * k, 4 * k]); text(g, T.scale === 'pct' ? '109 % (plafond)' : '763 mV (109 %)', m.l + pw - 3 * k, yOf(1.09) - 3 * k, k, { a: 'right', c: WARN, s: 9.5 });
  if (V.hdr) {
    line(g, m.l, yOf(0.75), m.l + pw, yOf(0.75), CYAN, 1, [6 * k, 4 * k]); text(g, 'blanc réf. HLG 75 %', m.l + 4 * k, yOf(0.75) - 3 * k, k, { c: CYAN });
    line(g, m.l, yOf(0.38), m.l + pw, yOf(0.38), 'rgba(92,200,236,0.5)', 1, [2 * k, 4 * k]); text(g, 'gris 18 % : 38 %', m.l + 4 * k, yOf(0.38) - 3 * k, k, { c: CYAN });
  }
  if (mode !== 'y') { for (const i of [1, 2]) line(g, m.l + i * third, m.t, m.l + i * third, m.t + ph, GRAT2); const lb = mode === 'rgb' ? ['R', 'G', 'B'] : ['Y', 'Cb', 'Cr']; lb.forEach((s, i) => text(g, s, m.l + i * third + 4 * k, m.t + 11 * k, k, { c: TXT, w: 700 })); if (mode === 'ycbcr') for (const i of [1, 2]) line(g, m.l + i * third, yOf(0.5), m.l + (i + 1) * third, yOf(0.5), 'rgba(255,196,90,0.6)', 1, [3 * k, 3 * k]); }
  text(g, T.scale === 'pct' ? '%' : 'mV', 4 * k, h - 3 * k, k, { c: TXT });
  if (T.cursor != null) { const y = yOf(T.cursor); line(g, m.l, y, m.l + pw, y, '#ffd060', 1.5); text(g, `${Math.round(T.cursor * 700)} mV · ${fmt(T.cursor * 100, 1)} %`, m.l + pw - 4 * k, y - 4 * k, k, { a: 'right', c: '#ffd060', w: 700 }); }
  T._yOf = { m, ph, lo, hi };
}
function wfmRead(T, st) {
  const c = T.cursor != null ? ` · curseur ${Math.round(T.cursor * 700)} mV` : '';
  if (T.mode === 'rgb') return `R ${pct(st.rmax, 0)} · G ${pct(st.gmax, 0)} · B ${pct(st.bmax, 0)} (maxi) · noirs R ${pct(st.rmin)} G ${pct(st.gmin)} B ${pct(st.bmin)}${c}`;
  if (T.mode === 'ycbcr') return `Y maxi ${mv(st.ymax)} · mini ${mv(st.ymin)}${c}`;
  return `Y maxi ${pct(st.ymax)} · mini ${pct(st.ymin)} · moyen ${pct(st.ymean, 0)}${st.y103 > 0.001 ? ` · ${pct(st.y103)} de l'image au-dessus de 103 %` : ''}${c}`;
}

// ---------------- vecteurscope ----------------
function drawVec(g, w, h, k, T, V) {
  const cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2 - 12 * k; const z = T.zoom === 5 ? 5 : 1;
  const sc = R / 0.56 * z; // 0,5 de Cb ou Cr (couleur pleine) près du bord
  const S0 = Math.floor(2 * R); const img = acc(T, S0, S0); const d = img.data;
  const { buf, W, H } = V; const inc = z === 5 ? 60 : 34;
  for (let i = 0; i < W * H; i++) {
    const p = i * 4; const [, cb, cr] = colorDiff(buf[p] / 255 * 1.1, buf[p + 1] / 255 * 1.1, buf[p + 2] / 255 * 1.1, V.mat);
    const x = R + cb * sc, y = R - cr * sc; if (Math.hypot(x - R, y - R) > R) continue;
    plot(d, S0, x, y, inc * 0.4, inc, inc * 0.45);
  }
  g.fillStyle = BG; g.fillRect(0, 0, w, h);
  g.putImageData(img, Math.round(cx - R), Math.round(cy - R));
  g.strokeStyle = GRAT; g.lineWidth = 1; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.stroke();
  line(g, cx - R, cy, cx + R, cy, GRAT2); line(g, cx, cy - R, cx, cy + R, GRAT2);
  if (z === 1) {
    for (const lvl of [0.75, 1]) {
      const on = (T.bars === 100) === (lvl === 1);
      for (const [n, r, gg, b] of BARS) {
        const [, cb, cr] = colorDiff(r * lvl, gg * lvl, b * lvl, V.mat); const x = cx + cb * sc, y = cy - cr * sc; const s = (on ? 7 : 4) * k;
        g.strokeStyle = on ? 'rgba(255,196,90,0.9)' : GRAT2; g.lineWidth = on ? 1.4 : 1; g.strokeRect(x - s, y - s, 2 * s, 2 * s);
        if (on) text(g, n, x + (cb < 0 ? -11 : 11) * k, y + 3.5 * k, k, { a: 'center', c: LAB, w: 700 });
      }
    }
    // ligne des tons chair (123° depuis l'axe Cb)
    const a = 123 * Math.PI / 180; line(g, cx, cy, cx + Math.cos(a) * R, cy - Math.sin(a) * R, GRAT2, 1, [3 * k, 3 * k]);
    text(g, 'Cb', cx + R - 2 * k, cy - 4 * k, k, { a: 'right', c: TXT }); text(g, 'Cr', cx + 4 * k, cy - R + 10 * k, k, { c: TXT });
  } else {
    // ×5 : petites graduations de 1 % autour du centre (balance des blancs)
    for (let i = -4; i <= 4; i++) { if (!i) continue; const p = i * 0.02 * sc; line(g, cx + p, cy - 3 * k, cx + p, cy + 3 * k, GRAT); line(g, cx - 3 * k, cy + p, cx + 3 * k, cy + p, GRAT); }
    text(g, '×5 : une graduation = 2 %', cx - R + 2 * k, cy + R - 2 * k, k, { c: TXT });
  }
  text(g, T.bars === 100 ? 'cibles 100 %' : 'cibles 75 %', 4 * k, 12 * k, k, { c: TXT });
}
function vecRead(T, V) {
  // balance : moyenne de la couleur des points presque neutres (gris, blancs)
  const { buf, W, H } = V; let sb = 0, sr = 0, n = 0, sat = 0;
  for (let i = 0; i < W * H; i++) { const p = i * 4; const [Y, cb, cr] = colorDiff(buf[p] / 255 * 1.1, buf[p + 1] / 255 * 1.1, buf[p + 2] / 255 * 1.1, V.mat); const c = Math.hypot(cb, cr); if (c > sat) sat = c; if (Y > 0.25 && c < 0.04) { sb += cb; sr += cr; n++; } }
  return `${n > 20 ? `gris et blancs : Cb ${sb / n >= 0 ? '+' : ''}${fmt(sb / n * 100, 1)} %, Cr ${sr / n >= 0 ? '+' : ''}${fmt(sr / n * 100, 1)} %` : 'pas assez de gris pour juger la balance'} · saturation maxi ${Math.round(sat / 0.5 * 100)} %`;
}

// ---------------- lightning ----------------
function drawLightning(g, w, h, k, T, V) {
  const cx = w / 2, cy = h / 2, hy = h / 2 - 8 * k, hx = Math.min(w / 2 - 10 * k, hy * 1.2); const sx = hx / 0.5;
  const img = acc(T, Math.floor(w), Math.floor(h)); const d = img.data; const { buf, W, H } = V;
  for (let i = 0; i < W * H; i++) {
    const p = i * 4; const [Y, cb, cr] = colorDiff(buf[p] / 255 * 1.1, buf[p + 1] / 255 * 1.1, buf[p + 2] / 255 * 1.1, V.mat);
    plot(d, Math.floor(w), cx + cb * sx, cy - Y * hy, 14, 40, 18); plot(d, Math.floor(w), cx + cr * sx, cy + Y * hy, 14, 40, 18);
  }
  g.fillStyle = BG; g.fillRect(0, 0, w, h); g.putImageData(img, 0, 0);
  line(g, cx - hx, cy, cx + hx, cy, GRAT2); line(g, cx, cy - hy, cx, cy + hy, GRAT2);
  const lvl = T.bars === 100 ? 1 : 0.75;
  for (const [n, r, gg, b] of BARS) {
    const [Y, cb, cr] = colorDiff(r * lvl, gg * lvl, b * lvl, V.mat); const s = 5 * k;
    g.strokeStyle = 'rgba(255,196,90,0.85)'; g.lineWidth = 1.2;
    g.strokeRect(cx + cb * sx - s, cy - Y * hy - s, 2 * s, 2 * s); g.strokeRect(cx + cr * sx - s, cy + Y * hy - s, 2 * s, 2 * s);
    text(g, n, cx + cb * sx + (cb < 0 ? -10 : 10) * k, cy - Y * hy + 3.5 * k, k, { a: 'center' });
  }
  // repères de timing luminance / couleur : milieu de la transition vert → magenta
  const gM = colorDiff(0, lvl, 0, V.mat), mM = colorDiff(lvl, 0, lvl, V.mat);
  for (const sgn of [-1, 1]) { const yy = cy + sgn * ((gM[0] + mM[0]) / 2) * hy; line(g, cx - 6 * k, yy, cx + 6 * k, yy, '#ffd060', 1.4); }
  text(g, 'Y / Cb', 4 * k, 12 * k, k, { c: TXT }); text(g, 'Y / Cr', 4 * k, h - 5 * k, k, { c: TXT }); text(g, T.bars === 100 ? 'cibles 100 %' : 'cibles 75 %', w - 4 * k, 12 * k, k, { a: 'right', c: TXT });
}

// ---------------- diamant et split diamant ----------------
function drawDiamond(g, w, h, k, T, V, split) {
  const cx = w / 2, cy = h / 2; const gap = split ? 14 * k : 0;
  const s = Math.min((h / 2 - gap / 2 - 16 * k) / 2, (w / 2 - 10 * k) / 1.1);
  const yT = cy - gap / 2, yB = cy + gap / 2; // noir du losange haut et du losange bas
  const img = acc(T, Math.floor(w), Math.floor(h)); const d = img.data; const { buf, W, H } = V;
  for (let i = 0; i < W * H; i++) {
    const p = i * 4; const R = buf[p] / 255 * 1.1, G = buf[p + 1] / 255 * 1.1, B = buf[p + 2] / 255 * 1.1;
    plot(d, Math.floor(w), cx + (B - G) * s, yT - (B + G) * s, 14, 42, 18);
    plot(d, Math.floor(w), cx + (R - G) * s, yB + (R + G) * s, 14, 42, 18);
  }
  g.fillStyle = BG; g.fillRect(0, 0, w, h); g.putImageData(img, 0, 0);
  const dia = (y0, sg, c, lw, dash, ext = 0) => { const a = -ext, b = 1 + ext; g.strokeStyle = c; g.lineWidth = lw; g.setLineDash(dash || []); g.beginPath(); g.moveTo(cx, y0 - sg * 2 * a * s); g.lineTo(cx - (b - a) * s, y0 - sg * (a + b) * s); g.lineTo(cx, y0 - sg * 2 * b * s); g.lineTo(cx + (b - a) * s, y0 - sg * (a + b) * s); g.closePath(); g.stroke(); g.setLineDash([]); };
  dia(yT, 1, 'rgba(255,196,90,0.85)', 1.3); dia(yB, -1, 'rgba(255,196,90,0.85)', 1.3);
  dia(yT, 1, 'rgba(255,196,90,0.35)', 1, [3 * k, 3 * k], 0.05); dia(yB, -1, 'rgba(255,196,90,0.35)', 1, [3 * k, 3 * k], 0.05);
  text(g, 'G', cx - s - 6 * k, yT - s + 3 * k, k, { a: 'right' }); text(g, 'B', cx + s + 6 * k, yT - s + 3 * k, k); text(g, 'G', cx - s - 6 * k, yB + s + 3 * k, k, { a: 'right' }); text(g, 'R', cx + s + 6 * k, yB + s + 3 * k, k);
  text(g, 'blanc', cx, yT - 2 * s - 2 * k, k, { a: 'center', c: TXT, b: 'bottom' }); text(g, 'noir', cx + 6 * k, cy + 3 * k, k, { c: TXT });
  if (split) text(g, 'sous le noir ↕', 4 * k, cy + 3 * k, k, { c: CYAN });
  text(g, 'pointillé : −5 / 105 %', w - 4 * k, h - 5 * k, k, { a: 'right', c: TXT });
}
const gamutRead = (st) => `hors gamut RVB (−5 / 105 %) : ${pct(st.gam)} de l'image · R ${pct(st.gR)} · G ${pct(st.gG)} · B ${pct(st.gB)}`;

// ---------------- arrowhead (gamut composite) ----------------
function drawArrow(g, w, h, k, T, V) {
  const m = { l: 34 * k, b: 10 * k, t: 10 * k }; const lo = -0.45, hi = 1.45;
  const ph = h - m.t - m.b; const yOf = (v) => m.t + (1 - (v - lo) / (hi - lo)) * ph; const sx = ph / (hi - lo); const xOf = (c) => m.l + c * sx;
  const img = acc(T, Math.floor(w), Math.floor(h)); const d = img.data; const { buf, W, H } = V;
  for (let i = 0; i < W * H; i++) { const p = i * 4; const R = buf[p] / 255 * 1.1, G = buf[p + 1] / 255 * 1.1, B = buf[p + 2] / 255 * 1.1; const y6 = 0.299 * R + 0.587 * G + 0.114 * B; const c = Math.hypot(0.493 * (B - y6), 0.877 * (R - y6)); plot(d, Math.floor(w), xOf(c), yOf(y6), 16, 44, 20); }
  g.fillStyle = BG; g.fillRect(0, 0, w, h); g.putImageData(img, 0, 0);
  line(g, m.l, yOf(lo), m.l, yOf(hi), GRAT);
  for (const v of [0, 0.5, 1]) { line(g, m.l - 4 * k, yOf(v), m.l, yOf(v), GRAT); text(g, String(Math.round(v * 100)), m.l - 6 * k, yOf(v) + 3.5 * k, k, { a: 'right' }); }
  // limite Y + C = L (ou Y − C = L) : oblique qui rejoint l'autre limite à mi-hauteur
  const ob = (L, c, dash) => line(g, xOf(0), yOf(L), xOf(Math.abs(L - 0.5)), yOf(0.5), c, 1.3, dash);
  ob(4 / 3, 'rgba(255,196,90,0.9)'); ob(-1 / 3, 'rgba(255,196,90,0.9)'); ob(1, GRAT2, [3 * k, 3 * k]); ob(0, GRAT2, [3 * k, 3 * k]);
  text(g, 'Y + C = 133 %', xOf(0.05), yOf(4 / 3) - 3 * k, k); text(g, 'Y − C = −33 %', xOf(0.05), yOf(-1 / 3) + 11 * k, k);
  text(g, 'luminance ↑ · chrominance →', w - 4 * k, 12 * k, k, { a: 'right', c: TXT });
}

// ---------------- CIE 1931 ----------------
function drawCie(g, w, h, k, T, V) {
  const m = 14 * k; const s = Math.min((w - 2 * m) / 0.8, (h - 2 * m) / 0.9);
  const ox = (w - 0.8 * s) / 2, oy = h - (h - 0.9 * s) / 2;
  const X = (x) => ox + x * s, Y = (y) => oy - y * s;
  const img = acc(T, Math.floor(w), Math.floor(h)); const d = img.data; const { buf, W, H } = V;
  const M = XYZ.bt709; const lin = V.hdr ? linHLG : linSDR;
  for (let i = 0; i < W * H; i += 2) {
    const p = i * 4; const r = lin(buf[p] / 255 * 1.1), gg = lin(buf[p + 1] / 255 * 1.1), b = lin(buf[p + 2] / 255 * 1.1);
    const XX = M[0][0] * r + M[0][1] * gg + M[0][2] * b, YY = M[1][0] * r + M[1][1] * gg + M[1][2] * b, ZZ = M[2][0] * r + M[2][1] * gg + M[2][2] * b; const sum = XX + YY + ZZ;
    if (YY < 0.004 || sum <= 0) continue;
    plot(d, Math.floor(w), X(XX / sum), Y(YY / sum), 70, 70, 70);
  }
  g.fillStyle = BG; g.fillRect(0, 0, w, h); g.putImageData(img, 0, 0);
  g.strokeStyle = GRAT; g.lineWidth = 1.2; g.beginPath(); LOCUS.forEach(([, x, y], i) => (i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y)))); g.closePath(); g.stroke();
  for (const [nm, x, y] of LOCUS) if ([460, 480, 500, 520, 540, 560, 580, 600, 620].includes(nm)) { const cx = X(x), cy = Y(y); const dx = cx - X(0.33), dy = cy - Y(0.33); const n = Math.hypot(dx, dy) || 1; text(g, String(nm), cx + dx / n * 12 * k, cy + dy / n * 12 * k + 3 * k, k, { a: 'center', s: 9 }); }
  const tri = (pr, c, dash) => { g.strokeStyle = c; g.lineWidth = 1.3; g.setLineDash(dash || []); g.beginPath(); pr.forEach(([x, y], i) => (i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y)))); g.closePath(); g.stroke(); g.setLineDash([]); };
  tri(PRIM.bt709, 'rgba(255,255,255,0.75)'); tri(PRIM.bt2020, CYAN, [4 * k, 3 * k]);
  g.fillStyle = '#fff'; g.beginPath(); g.arc(X(D65[0]), Y(D65[1]), 2.5 * k, 0, 7); g.fill();
  text(g, 'BT.709', w - 4 * k, 12 * k, k, { a: 'right', c: '#e8e8e8' }); text(g, 'BT.2020', w - 4 * k, 24 * k, k, { a: 'right', c: CYAN }); text(g, 'D65', X(D65[0]) + 5 * k, Y(D65[1]) + 3 * k, k, { c: '#e8e8e8' });
  text(g, 'x', X(0.8), oy - 2 * k, k, { a: 'right', c: TXT }); text(g, 'y', ox + 2 * k, Y(0.9) + 10 * k, k, { c: TXT });
}
function cieRead(V) {
  // part des points hors du triangle BT.709 (en HLG : hors BT.2020 aussi)
  const { buf, W, H } = V; const M = XYZ.bt709; const lin = V.hdr ? linHLG : linSDR; let n = 0, out = 0;
  const inside = (pr, x, y) => { let s = 0; for (let i = 0; i < 3; i++) { const [x1, y1] = pr[i], [x2, y2] = pr[(i + 1) % 3]; const c = (x2 - x1) * (y - y1) - (y2 - y1) * (x - x1); if (c < -1e-4) s |= 1; else if (c > 1e-4) s |= 2; } return s !== 3; };
  for (let i = 0; i < W * H; i += 3) { const p = i * 4; const r = lin(buf[p] / 255 * 1.1), gg = lin(buf[p + 1] / 255 * 1.1), b = lin(buf[p + 2] / 255 * 1.1); const XX = M[0][0] * r + M[0][1] * gg + M[0][2] * b, YY = M[1][0] * r + M[1][1] * gg + M[1][2] * b, ZZ = M[2][0] * r + M[2][1] * gg + M[2][2] * b; const s = XX + YY + ZZ; if (YY < 0.004 || s <= 0) continue; n++; if (!inside(PRIM.bt709, XX / s, YY / s)) out++; }
  return `${V.hdr ? 'signal BT.2100 HLG (scène en primaires BT.709)' : 'signal BT.709'} · points hors du triangle BT.709 : ${n ? pct(out / n) : '—'}`;
}

// ---------------- histogramme ----------------
function drawHisto(g, w, h, k, T, V) {
  const m = { l: 8 * k, r: 8 * k, t: 10 * k, b: 16 * k }; const pw = w - m.l - m.r, ph = h - m.t - m.b; const NB = 110;
  const hs = [new Float32Array(NB), new Float32Array(NB), new Float32Array(NB)]; const { buf, W, H } = V;
  for (let i = 0; i < W * H; i++) for (let c = 0; c < 3; c++) hs[c][Math.min(NB - 1, Math.floor(buf[i * 4 + c] / 255 * 1.1 * 100))]++;
  let mx = 1; for (const a of hs) for (let i = 1; i < NB - 1; i++) mx = Math.max(mx, a[i]);
  g.fillStyle = BG; g.fillRect(0, 0, w, h);
  for (const v of [0, 25, 50, 75, 100]) { const x = m.l + v / NB * pw; line(g, x, m.t, x, m.t + ph, v === 100 ? 'rgba(255,110,100,0.6)' : GRAT2); text(g, String(v), x, h - 4 * k, k, { a: 'center' }); }
  const col = ['rgba(255,90,80,0.9)', 'rgba(90,230,110,0.9)', 'rgba(110,150,255,0.95)'];
  hs.forEach((a, c) => { g.strokeStyle = col[c]; g.lineWidth = 1.2 * k; g.beginPath(); for (let i = 0; i < NB; i++) { const x = m.l + (i + 0.5) / NB * pw, y = m.t + ph - Math.min(1, Math.sqrt(a[i] / mx)) * ph; if (i) g.lineTo(x, y); else g.moveTo(x, y); } g.stroke(); });
  text(g, 'niveau (%) →  hauteur : racine du nombre de points', 4 * k, 12 * k, k, { c: TXT, s: 9.5 });
}

// ---------------- image ----------------
function picCanvas(V) {
  const c = V._pic ||= document.createElement('canvas'); c.width = V.W; c.height = V.H; const g = c.getContext('2d'); const img = g.createImageData(V.W, V.H);
  const { buf, W, H } = V;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const s = ((H - 1 - y) * W + x) * 4, t = (y * W + x) * 4; img.data[t] = Math.min(255, buf[s] * 1.1); img.data[t + 1] = Math.min(255, buf[s + 1] * 1.1); img.data[t + 2] = Math.min(255, buf[s + 2] * 1.1); img.data[t + 3] = 255; }
  g.putImageData(img, 0, 0); return c;
}
function drawPic(g, w, h, k, T, V) {
  g.fillStyle = BG; g.fillRect(0, 0, w, h);
  const iw = Math.min(w, h * 16 / 9), ih = iw * 9 / 16, x0 = (w - iw) / 2, y0 = (h - ih) / 2;
  g.imageSmoothingEnabled = true; g.drawImage(V.pic, x0, y0, iw, ih);
  if (T.gamut && (Math.floor(performance.now() / 400) % 2)) {
    const { buf, W, H } = V; g.fillStyle = 'rgba(255,40,220,0.9)'; const cw = iw / W, chh = ih / H;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const p = ((H - 1 - y) * W + x) * 4; const R = buf[p] / 255 * 1.1, G = buf[p + 1] / 255 * 1.1, B = buf[p + 2] / 255 * 1.1; if (R > 1.05 || G > 1.05 || B > 1.05 || R < -0.05) g.fillRect(x0 + x * cw, y0 + y * chh, Math.ceil(cw), Math.ceil(chh)); }
  }
  /** @type {Array<[number, string]>} */
  const SAFE = [[0.93, 'rgba(255,196,90,0.8)'], [0.9, 'rgba(92,200,236,0.8)']];
  if (T.safe) for (const [f, c] of SAFE) { g.strokeStyle = c; g.lineWidth = 1; g.strokeRect(x0 + iw * (1 - f) / 2, y0 + ih * (1 - f) / 2, iw * f, ih * f); }
}

// ---------------- œil ----------------
function drawEye(g, w, h, k, T, L, E) {
  const m = { l: 40 * k, r: 6 * k, t: 8 * k, b: 16 * k }; const pw = w - m.l - m.r, ph = h - m.t - m.b;
  const vmax = 560; const yOf = (v) => m.t + (1 - (v + vmax) / (2 * vmax)) * ph; const xOf = (j) => m.l + j / (E.W - 1) * pw;
  // persistance : l'image précédente s'éteint doucement, comme un écran à phosphore
  if (T._persist) { g.fillStyle = 'rgba(5,8,10,0.6)'; g.fillRect(0, 0, w, h); } else { g.fillStyle = BG; g.fillRect(0, 0, w, h); }
  T._persist = true;
  g.save(); g.beginPath(); g.rect(m.l, m.t, pw, ph); g.clip();
  // quelques paquets de traces, chacun en un seul tracé (bien plus rapide qu'un tracé par bit)
  g.globalCompositeOperation = 'lighter'; g.strokeStyle = 'rgba(70,220,110,0.32)'; g.lineWidth = 1.1 * k;
  const segs = E.segs.slice(0, 160), B = 6;
  for (let b = 0; b < B; b++) { g.beginPath(); for (let i = b; i < segs.length; i += B) { const s = segs[i]; for (let j = 0; j < E.W; j++) { const x = xOf(j), y = yOf(s[j]); if (j) g.lineTo(x, y); else g.moveTo(x, y); } } g.stroke(); }
  g.restore(); g.globalCompositeOperation = 'source-over';
  // graticule : tension (mV) et temps (UI et ps)
  g.fillStyle = BG; g.fillRect(0, 0, m.l - 1, h); g.fillRect(0, h - m.b + 1, w, m.b);
  for (const v of [-400, -200, 0, 200, 400]) { line(g, m.l, yOf(v), m.l + pw, yOf(v), v ? GRAT2 : GRAT); text(g, String(v), m.l - 4 * k, yOf(v) + 3.5 * k, k, { a: 'right' }); }
  for (const v of [-440, -360, 360, 440]) line(g, m.l, yOf(v), m.l + pw, yOf(v), 'rgba(92,200,236,0.45)', 1, [3 * k, 3 * k]);
  for (const u of [0, 0.5, 1, 1.5, 2]) { const x = m.l + u / 2 * pw; line(g, x, m.t, x, m.t + ph, GRAT2); text(g, `${u} UI`, x, h - 4 * k, k, { a: u === 0 ? 'left' : u === 2 ? 'right' : 'center' }); }
  text(g, 'mV', 4 * k, m.t + 9 * k, k, { c: TXT });
  text(g, T.eq ? 'œil égalisé' : 'œil brut (avec le câble)', m.l + pw - 4 * k, m.t + 11 * k, k, { a: 'right', c: TXT, w: 700 });
  text(g, `1 UI = ${fmt(L.f.ui, 1)} ps`, m.l + 4 * k, m.t + 11 * k, k, { c: TXT });
}

// ---------------- gigue ----------------
function drawJitter(g, w, h, k, T, L) {
  const m = { l: 40 * k, r: 6 * k, t: 10 * k, b: 16 * k }; const pw = w - m.l - m.r, ph = h - m.t - m.b;
  const tim = T.filt === 'timing'; const val = tim ? L.tj : L.aj, lim = tim ? L.f.tj : L.f.aj;
  const span = Math.max(lim * 1.3, val * 1.2); const yOf = (v) => m.t + (1 - (v + span / 2) / span) * ph;
  g.fillStyle = BG; g.fillRect(0, 0, w, h);
  for (const v of [-lim / 2, lim / 2]) line(g, m.l, yOf(v), m.l + pw, yOf(v), 'rgba(255,110,100,0.65)', 1, [4 * k, 4 * k]);
  line(g, m.l, yOf(0), m.l + pw, yOf(0), GRAT);
  text(g, fmt(lim / 2, 2), m.l - 4 * k, yOf(lim / 2) + 3.5 * k, k, { a: 'right', c: WARN }); text(g, '−' + fmt(lim / 2, 2), m.l - 4 * k, yOf(-lim / 2) + 3.5 * k, k, { a: 'right', c: WARN }); text(g, '0', m.l - 4 * k, yOf(0) + 3.5 * k, k, { a: 'right' });
  // la gigue démodulée sur la durée affichée : lente en timing (2 trames), rapide en alignement (2 lignes)
  const N = 260, t0 = S.time * (tim ? 1.3 : 9);
  g.strokeStyle = 'rgba(80,230,120,0.95)'; g.lineWidth = 1.3 * k; g.beginPath();
  for (let i = 0; i < N; i++) {
    const u = i / N; const s = tim ? 0.36 * Math.sin(2 * Math.PI * (u * 1.6 + t0 * 0.1)) + 0.1 * Math.sin(2 * Math.PI * (u * 7 + t0)) : 0.3 * Math.sin(2 * Math.PI * (u * 9 + t0)) + 0.12 * Math.sin(2 * Math.PI * (u * 23 + t0 * 1.7));
    const v = val * (s + 0.07 * (Math.random() - 0.5) * 2); const x = m.l + u * pw, y = yOf(v); if (i) g.lineTo(x, y); else g.moveTo(x, y);
  }
  g.stroke();
  text(g, 'UI', 4 * k, m.t + 9 * k, k, { c: TXT }); text(g, tim ? 'filtre timing 10 Hz · 2 trames' : `filtre alignement ${L.f.ajf} · 2 lignes`, m.l + pw - 4 * k, m.t + 9 * k, k, { a: 'right', c: TXT });
  text(g, 'temps →', m.l + pw, h - 4 * k, k, { a: 'right' });
}

// ---------------- timing ----------------
function drawTiming(g, w, h, k, T, tm) {
  const f = sdiStd(); const cx = w / 2, cy = h / 2; const rx = w / 2 - 14 * k, ry = h / 2 - 14 * k;
  g.fillStyle = BG; g.fillRect(0, 0, w, h);
  g.strokeStyle = GRAT; g.lineWidth = 1; g.strokeRect(cx - rx, cy - ry, 2 * rx, 2 * ry);
  line(g, cx - rx, cy, cx + rx, cy, GRAT2); line(g, cx, cy - ry, cx, cy + ry, GRAT2);
  g.strokeStyle = GRAT; g.beginPath(); g.arc(cx, cy, 9 * k, 0, 7); g.stroke();
  text(g, 'en avance', cx - rx + 4 * k, cy - 4 * k, k, { c: TXT }); text(g, 'en retard', cx + rx - 4 * k, cy - 4 * k, k, { a: 'right', c: TXT });
  text(g, `± ${fmt(f.lineUs / 2, 1)} µs`, cx + rx - 2 * k, cy + ry - 4 * k, k, { a: 'right' }); text(g, `± ${Math.floor(f.lines / 2)} lignes`, cx + 4 * k, cy - ry + 11 * k, k);
  if (tm.ip) { text(g, tm.ptp ? 'PTP verrouillé' : 'PTP perdu', cx, cy + 24 * k, k, { a: 'center', c: tm.ptp ? '#7fe08f' : WARN, w: 700 }); return; }
  const x = cx + clamp(tm.h / (f.lineUs / 2), -1, 1) * rx, y = cy + clamp(tm.v / (f.lines / 2), -1, 1) * ry;
  g.fillStyle = tm.locked ? '#7fe08f' : WARN; g.beginPath(); g.arc(x, y, 5 * k, 0, 7); g.fill();
  if (!tm.locked) text(g, 'NON VERROUILLÉE', cx, cy + ry - 6 * k, k, { a: 'center', c: WARN, w: 700 });
}

// ---------------- l'instrument ----------------
const APP_OPTS = {
  wfm: [['mode', [['y', 'Y'], ['ycbcr', 'YCbCr'], ['rgb', 'RVB']], 'Composantes affichées'], ['scale', [['mv', 'mV'], ['pct', '%']], 'Échelle'], ['cursor', 'toggle', 'Curseur']],
  vec: [['bars', [[75, '75 %'], [100, '100 %']], 'Cibles de la mire'], ['zoom', [[1, '×1'], [5, '×5']], 'Gain']],
  lightning: [['bars', [[75, '75 %'], [100, '100 %']], 'Cibles de la mire']],
  eye: [['eq', [[false, 'Brut'], [true, 'Égalisé']], 'Œil']],
  jitter: [['filt', [['timing', 'Timing'], ['align', 'Alignement']], 'Filtre de gigue']],
  timing: [['ref', [['tri', 'Tri-level'], ['bb', 'Black burst']], 'Référence']],
  pic: [['gamut', 'toggle', 'Gamut'], ['safe', 'toggle', 'Zones']],
};
const VIDEO_APPS = new Set(['pic', 'wfm', 'vec', 'lightning', 'diamond', 'split', 'arrow', 'cie', 'histo']);

/**
 * @typedef {object} PrismInput
 * @property {string} id @property {string} label @property {string} [group] @property {string} [short]
 */
/**
 * Crée un instrument (façade, écran, tuiles) relié à l'état PRISM[key].
 * @param {object} o
 * @param {'vision' | 'mesure'} o.key
 * @param {() => PrismInput[]} o.inputs entrées proposées
 * @param {(id: string) => { src: string, hdr: boolean, point: import('../prism_model.js').Point | null, label: string }} o.route ce que mesure une entrée
 * @param {(id: string) => void} [o.onInput]
 * @param {string} [o.title]
 */
export function prismInstrument(o) {
  const key = o.key; const P = PRISM[key];
  const root = el('div', { class: 'prism', role: 'group', 'aria-label': 'Moniteur de mesure, type PRISM' });
  const inBox = el('div', { class: 'pz-in' });
  const inChip = el('div', { class: 'pz-chip', 'aria-live': 'off' });
  const lockLed = el('span', { class: 'pz-led', 'aria-hidden': 'true' });
  const presetSel = el('select', { class: 'pz-sel', 'aria-label': 'Préréglage des quatre tuiles' }, el('option', { value: '' }, 'Préréglages…'), ...Object.entries(PRESETS).map(([k, r]) => el('option', { value: k }, r.label)));
  presetSel.onchange = () => { const v = /** @type {HTMLSelectElement} */ (presetSel).value; if (!v) return; setPreset(key, v); /** @type {HTMLSelectElement} */ (presetSel).value = ''; buildTiles(); explain(`Préréglage « ${PRESETS[v].label} » : ${P.tiles.map((t) => APP_NAME[t.app]).join(', ')}.`, 'prism:preset'); };
  const layBtns = [4, 1].map((n) => el('button', { type: 'button', class: 'pz-b', 'aria-pressed': 'false', title: n === 4 ? 'Quatre tuiles' : 'La tuile choisie en plein écran', onclick: () => { setLayout(key, n); layout(); } }, n === 4 ? '4 tuiles' : '1 tuile'));
  const freeze = el('button', { type: 'button', class: 'pz-b', 'aria-pressed': 'false', title: 'Figer l\'affichage pour le lire tranquillement', onclick: () => { P.frozen = !P.frozen; freeze.setAttribute('aria-pressed', String(P.frozen)); explain(P.frozen ? 'Affichage figé : les mesures ne bougent plus, le temps de les lire. Rappuyez pour reprendre.' : 'Affichage repris en direct.', 'prism:freeze'); } }, 'Figer');
  const top = el('div', { class: 'pz-top' }, el('span', { class: 'pz-brand' }, 'MESURE', el('small', {}, 'SDI · IP')), lockLed, inChip, inBox, el('span', { class: 'pz-sp' }), presetSel, el('div', { class: 'pz-seg', role: 'group', 'aria-label': 'Disposition' }, ...layBtns), freeze, q('prism'));
  const screen = el('div', { class: 'pz-screen' });
  root.append(el('div', { class: 'pz-bezel' }, top, screen));

  // ---- entrées ----
  let inKey = '';
  function buildInputs() {
    const list = o.inputs(); const k = list.map((x) => x.id + x.label).join('|') + P.input;
    if (k === inKey) return; inKey = k;
    inBox.replaceChildren();
    if (list.length <= 3) {
      inBox.append(el('div', { class: 'pz-seg', role: 'group', 'aria-label': 'Entrée mesurée' }, ...list.map((x) => el('button', { type: 'button', class: 'pz-b', 'aria-pressed': String(x.id === P.input), 'data-in': x.id, onclick: () => pick(x.id) }, x.short || x.label))));
    } else {
      const s = el('select', { class: 'pz-sel pz-insel', 'aria-label': 'Entrée mesurée' });
      const groups = {};
      for (const x of list) { const gk = x.group || ''; if (!groups[gk]) { groups[gk] = gk ? el('optgroup', { label: gk }) : s; if (gk) s.append(groups[gk]); } groups[gk].append(el('option', { value: x.id }, x.label)); }
      /** @type {HTMLSelectElement} */ (s).value = P.input; s.onchange = () => pick(/** @type {HTMLSelectElement} */ (s).value);
      inBox.append(s);
    }
  }
  function pick(id) { setInput(key, id); for (const T of P.tiles) T._persist = false; if (o.onInput) o.onInput(id); inKey = ''; buildInputs(); upd(true); }

  // ---- tuiles ----
  // l'état peut changer ailleurs (le chef de car, « Fais-le pour moi ») : on reconstruit les tuiles si besoin
  const sigOf = () => JSON.stringify([P.layout, P.layout === 1 ? P.sel : -1, P.tiles.map((t) => [t.app, t.mode, t.scale, t.cursor != null, t.bars, t.zoom, t.eq, t.filt, t.ref, t.gamut, t.safe])]);
  let sig = '';
  /** @type {Array<{ T: any, sec: HTMLElement, cv: HTMLCanvasElement, read: HTMLElement, body: HTMLElement, kv: any, sz: string }>} */
  let tiles = [];
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { for (const t of tiles) t.sz = ''; upd(true); }) : null;
  function buildTiles() {
    sig = sigOf(); screen.replaceChildren(); tiles = [];
    P.tiles.forEach((T, i) => {
      const sel = el('select', { class: 'pz-app', 'aria-label': `Affichage de la tuile ${i + 1}`, 'data-tile': String(i) }, ...APPS.map(([a, l]) => el('option', { value: a }, l)));
      /** @type {HTMLSelectElement} */ (sel).value = T.app;
      sel.onchange = () => { setTile(key, i, { app: /** @type {HTMLSelectElement} */ (sel).value }); buildTiles(); say(i); };
      const opts = el('div', { class: 'pz-opts' });
      for (const [prop, vals, lab] of APP_OPTS[T.app] || []) {
        if (vals === 'toggle') { const on = prop === 'cursor' ? T.cursor != null : !!T[prop]; opts.append(el('button', { type: 'button', class: 'pz-b sm', 'aria-pressed': String(on), 'data-opt': prop, onclick: () => { setTile(key, i, { [prop]: prop === 'cursor' ? (T.cursor != null ? null : (T.mode === 'y' ? 0.5 : 0.75)) : !T[prop] }); buildTiles(); sayOpt(i, prop); } }, lab)); continue; }
        opts.append(el('div', { class: 'pz-seg', role: 'group', 'aria-label': lab }, ...vals.map(([v, l]) => el('button', { type: 'button', class: 'pz-b sm', 'aria-pressed': String(T[prop] === v), 'data-opt': prop, 'data-v': String(v), onclick: () => { if (T[prop] === v) return; setTile(key, i, { [prop]: v }); T._persist = false; buildTiles(); sayOpt(i, prop); } }, l))));
      }
      const big = el('button', { type: 'button', class: 'pz-b sm pz-big', 'aria-pressed': String(P.layout === 1), title: P.layout === 1 ? 'Revenir aux quatre tuiles' : 'Agrandir cette tuile', onclick: () => { setLayout(key, P.layout === 1 ? 4 : 1, i); layout(); } }, P.layout === 1 ? '4' : '⤢');
      const head = el('div', { class: 'pz-th' }, el('span', { class: 'pz-n' }, String(i + 1)), sel, opts, el('span', { class: 'pz-sp' }), q(TERM_OF[keyOf(T)] || 'prism'), big);
      const cv = /** @type {HTMLCanvasElement} */ (el('canvas', { class: 'pz-cv', role: 'img', 'aria-label': APP_NAME[T.app], tabindex: T.app === 'wfm' && T.cursor != null ? '0' : null }));
      const read = el('div', { class: 'pz-read' });
      // l'état SDI peut défiler dans une petite tuile : la zone est atteignable au clavier
      const body = el('div', T.app === 'status' ? { class: 'pz-body pz-kvonly', tabindex: '0', role: 'region', 'aria-label': `Tuile ${i + 1} : état SDI` } : { class: 'pz-body' + (T.app === 'eye' ? ' pz-side' : '') });
      const kv = T.app === 'eye' ? eyeTable() : T.app === 'status' ? statusList() : null;
      if (T.app !== 'status') body.append(el('div', { class: 'pz-cw' }, cv));
      if (kv) body.append(kv.el);
      const sec = el('section', { class: 'pz-tile', 'data-i': String(i), 'data-app': T.app, onclick: () => { if (P.sel !== i) { P.sel = i; for (const t of tiles) t.sec.classList.toggle('sel', t.sec.dataset.i === String(P.sel)); } } }, head, body, read);
      if (T.app === 'wfm') wireCursor(cv, T, i);
      screen.append(sec);
      const t = { T, sec, cv, read, body, kv, sz: '' }; tiles.push(t);
      if (ro) ro.observe(cv);
    });
    layout(); upd(true);
  }
  function layout() {
    screen.classList.toggle('one', P.layout === 1);
    for (const t of tiles) { const i = +t.sec.dataset.i; t.sec.hidden = P.layout === 1 && i !== P.sel; t.sec.classList.toggle('sel', i === P.sel); const b = t.sec.querySelector('.pz-big'); if (b) { b.textContent = P.layout === 1 ? '4' : '⤢'; b.setAttribute('aria-pressed', String(P.layout === 1)); b.setAttribute('title', P.layout === 1 ? 'Revenir aux quatre tuiles' : 'Agrandir cette tuile'); } t.sz = ''; }
    layBtns.forEach((b, j) => b.setAttribute('aria-pressed', String((j === 0) === (P.layout === 4))));
    upd(true);
  }
  function say(i) { const T = P.tiles[i]; explain(`Tuile ${i + 1} : ${APP_NAME[T.app]}${T.app === 'wfm' ? ` (${{ y: 'luminance', ycbcr: 'YCbCr', rgb: 'parade RVB' }[T.mode]})` : ''}. ${explainTile(T)}`, 'prism:t' + i); }
  function sayOpt(i, prop) {
    const T = P.tiles[i];
    const t = {
      mode: () => say(i),
      scale: () => explain(T.scale === 'pct' ? 'Échelle en % : 0 % = noir, 100 % = blanc nominal (700 mV). C\'est l\'échelle des consignes des diffuseurs (blancs ≤ 100 % ou 103 %, noirs ≥ 0 %).' : 'Échelle en mV : la tension du signal analogique équivalent, 0 à 700 mV. 1 % = 7 mV.', 'prism:sc' + i),
      cursor: () => explain(T.cursor != null ? 'Curseur : faites-le glisser sur le waveform (ou flèches haut et bas, la trace ayant le focus) pour lire un niveau en mV et en %.' : 'Curseur retiré.', 'prism:cu' + i),
      bars: () => explain(`Cibles ${T.bars} % : ${T.bars === 75 ? 'pour la mire du car (EBU 100/0/75/0 : blanc à 100 %, couleurs à 75 %).' : 'pour une mire 100 % (couleurs pleines) ; la mire du car tombe alors à l\'intérieur des cases.'}`, 'prism:bars' + i),
      zoom: () => explain(T.zoom === 5 ? 'Vecteurscope ×5 : seul le centre est visible, agrandi. Un gris bien balancé fait une petite tache au centre exact ; une tache décalée montre la dominante (vers R : trop rouge, vers B : trop bleu).' : 'Vecteurscope ×1 : toutes les teintes et les cibles de la mire.', 'prism:z' + i),
      eq: () => explain(T.eq ? 'Œil égalisé : après l\'égaliseur adaptatif du récepteur, qui compense l\'affaiblissement du câble. C\'est ce que lit vraiment la grille. Sa fermeture annonce les erreurs.' : 'Œil brut : le signal tel qu\'il arrive, câble compris. La norme définit l\'œil à la sortie de l\'émetteur, avec 1 m de câble : pour qualifier un émetteur, mesurez au plus près.', 'prism:eq' + i),
      filt: () => explain(T.filt === 'timing' ? 'Gigue de timing (filtre 10 Hz) : toute la gigue au-dessus de 10 Hz, lente comprise. Elle gêne les appareils qui doivent suivre l\'horloge du signal (convertisseurs, synchronisation).' : 'Gigue d\'alignement (filtre 100 kHz en HD et 3G) : la gigue rapide, que la boucle de récupération d\'horloge du récepteur ne suit pas. C\'est elle qui ferme l\'œil horizontalement.', 'prism:f' + i),
      ref: () => explain(T.ref === 'bb' ? 'Référence black burst : le noir codé de la SD (625 lignes), encore très utilisé comme référence maison.' : 'Référence tri-level : l\'impulsion de synchronisation à trois niveaux des formats HD, sans ambiguïté de phase.', 'prism:r' + i),
      gamut: () => explain(T.gamut ? 'Alerte gamut sur l\'image : les points hors limites (une composante R, G ou B au-dessus de 105 % ou sous −5 %) clignotent en magenta.' : 'Alerte gamut retirée.', 'prism:g' + i),
      safe: () => explain(T.safe ? 'Zones de sécurité : cadre ambre à 93 % (action), cadre cyan à 90 % (titres et graphiques). Un texte hors du cadre cyan risque d\'être coupé sur certains écrans.' : 'Zones de sécurité retirées.', 'prism:s' + i),
    }[prop];
    if (t) t();
  }
  function wireCursor(cv, T, i) {
    const setFrom = (e) => { const m = T._yOf; if (!m || T.cursor == null) return; const r = cv.getBoundingClientRect(); const k = cv.width / Math.max(1, r.width); const y = (e.clientY - r.top) * k; const v = (m.lo + (1 - (y - m.m.t) / m.ph) * (m.hi - m.lo)) / 700; T.cursor = clamp(Math.round(v * 700) / 700, -0.07, 1.1); upd(true, i); };
    let drag = false;
    cv.addEventListener('pointerdown', (e) => { if (T.cursor == null) return; drag = true; cv.setPointerCapture(e.pointerId); setFrom(e); });
    cv.addEventListener('pointermove', (e) => { if (drag) setFrom(e); });
    cv.addEventListener('pointerup', () => { drag = false; });
    cv.addEventListener('keydown', (e) => { if (T.cursor == null) return; const d = (e.shiftKey ? 1 : 5) / 700; if (e.key === 'ArrowUp') { T.cursor = clamp(T.cursor + d, -0.07, 1.1); e.preventDefault(); upd(true, i); } if (e.key === 'ArrowDown') { T.cursor = clamp(T.cursor - d, -0.07, 1.1); e.preventDefault(); upd(true, i); } });
  }

  // ---- tableaux de mesures (œil, état SDI) : construits une fois, valeurs remplacées ensuite ----
  function eyeTable() {
    const rows = [['amp', 'Amplitude', 'amplitude-sdi'], ['tr', 'Montée', 'temps-montee'], ['tf', 'Descente', 'temps-montee'], ['dt', 'Écart', 'temps-montee'], ['ov', 'Dépassement', 'overshoot'], ['open', 'Ouverture', 'oeil'], ['aj', 'Gigue align.', 'gigue-alignement']];
    const tb = el('tbody');
    const cells = {};
    for (const [id, l, t] of rows) { const v = el('td', { class: 'v' }), lim = el('td', { class: 'lim' }); cells[id] = { v, lim }; tb.append(el('tr', {}, el('th', { scope: 'row' }, l, q(t)), v, lim)); }
    return { el: el('table', { class: 'pz-kv' }, el('caption', { class: 'sr' }, 'Mesures de l\'œil'), tb), cells };
  }
  function statusList() {
    const rows = [['in', 'Entrée', null], ['fmt', 'Format', 'vpid'], ['col', 'Colorimétrie', 'gamut'], ['lock', 'Verrouillage', 'effet-falaise'], ['crc', 'CRC Y / C', 'crc-edh'], ['es', 'Secondes en erreur', 'crc-edh'], ['att', 'Affaiblissement', 'affaiblissement'], ['len', 'Longueur estimée', 'affaiblissement'], ['marg', 'Marge égaliseur', 'egaliseur'], ['lvl', 'Niveau source', 'amplitude-sdi'], ['ref', 'Référence', 'timing-ref']];
    const dl = el('dl', { class: 'pz-dl' }); const cells = {};
    for (const [id, l, t] of rows) { const dd = el('dd'); cells[id] = { v: dd }; dl.append(el('dt', {}, l, t ? q(t) : null), dd); }
    const rz = el('button', { type: 'button', class: 'pz-b sm', onclick: () => { const r = o.route(P.input); if (r.point) resetCounters(r.point.id); explain('Compteurs CRC remis à zéro : on repart d\'une page blanche pour voir si les erreurs reviennent, et à quel rythme.', 'prism:rz'); upd(true); } }, 'Compteurs à zéro');
    return { el: el('div', { class: 'pz-status' }, dl, rz), cells };
  }
  const setCell = (c, s, cls = '') => { if (!c) return; if (c.textContent !== s) c.textContent = s; if (c.className !== cls) c.className = cls; };

  // ---- mise à jour (10 Hz au plus) ----
  let lastSeq = -1, lastT = 0, V = null, stats = null, Lk = null;
  function upd(force = false, only = -1) {
    if (!root.isConnected && !force) return;
    const now = performance.now();
    const r = o.route(P.input);
    // la source mesurée : image réelle rendue par le simulateur
    SCOPE.src = r.src; SCOPE.active = true; SCOPE.hdr = !!r.hdr;
    const f = sdiStd();
    Lk = r.point ? linkOf(r.point) : null;
    const dt = Math.min(1, (now - (lastT || now)) / 1000); lastT = now;
    if (Lk && !Lk.ip && dt > 0) tickCounters(Lk, dt);
    tickPhy();
    const newData = DATA.seq !== lastSeq && !!SCOPE.data;
    if (newData && !P.frozen) {
      lastSeq = DATA.seq;
      V = { buf: SCOPE.data, W: SCOPE.w, H: SCOPE.h, hdr: !!r.hdr, mat: r.hdr ? 'bt2020' : 'bt709', pic: null };
      V.pic = picCanvas(V); stats = videoStats(V.buf, V.W, V.H, V.mat);
    }
    // pas d'image : source absente ou liaison perdue
    const res = resolve(r.src);
    const noSig = (Lk && !Lk.ip && !Lk.lock) || /^(PAS DE SIGNAL|NO SIG|PERTE HF|PERTE|NO FLOW)$/.test(res.alarm || '') || !!res.none;
    // bandeau de l'instrument
    const lockTxt = Lk && Lk.ip ? 'IP' : noSig ? 'PAS DE SIGNAL' : 'VERROUILLÉ';
    setCell(inChip, `${r.label} · ${f.fmt} · ${Lk && Lk.ip ? 'ST 2110' : f.name}`, 'pz-chip');
    lockLed.className = 'pz-led ' + (noSig ? 'bad' : Lk && !Lk.ip && Lk.crc > 0.05 ? 'warn' : 'ok'); lockLed.title = lockTxt;
    for (const t of tiles) {
      if (only >= 0 && +t.sec.dataset.i !== only) continue;
      if (t.sec.hidden) continue;
      const T = t.T; const cv = t.cv;
      if (T.app !== 'status') {
        const rc = cv.getBoundingClientRect(); const k = Math.min(2, window.devicePixelRatio || 1);
        const W = Math.max(40, Math.round(rc.width * k)), H = Math.max(30, Math.round(rc.height * k));
        const sz = W + 'x' + H; if (t.sz !== sz) { cv.width = W; cv.height = H; t.sz = sz; T._persist = false; }
        const g = cv.getContext('2d'); if (!g) continue;
        const isVid = VIDEO_APPS.has(T.app);
        if (P.frozen && !force) continue;
        if (isVid) {
          if (!newData && !force && !(T.app === 'pic' && T.gamut)) continue;
          if (noSig) { msg(g, W, H, k, 'PAS DE SIGNAL', Lk && !Lk.ip && !Lk.lock ? 'liaison SDI non verrouillée' : res.alarm || ''); setCell(t.read, 'Aucune image à mesurer sur cette entrée.', 'pz-read'); continue; }
          if (!V) { msg(g, W, H, k, 'MESURE EN COURS…'); continue; }
          if (T.app === 'wfm') { drawWfm(g, W, H, k, T, V); setCell(t.read, wfmRead(T, stats), 'pz-read'); }
          else if (T.app === 'vec') { drawVec(g, W, H, k, T, V); setCell(t.read, vecRead(T, V), 'pz-read'); }
          else if (T.app === 'lightning') { drawLightning(g, W, H, k, T, V); setCell(t.read, `luminance maxi ${pct(stats.ymax)} · les barres dans leurs cibles = chaîne bonne`, 'pz-read'); }
          else if (T.app === 'diamond' || T.app === 'split') { drawDiamond(g, W, H, k, T, V, T.app === 'split'); setCell(t.read, gamutRead(stats), 'pz-read' + (stats.gam > 0.01 ? ' bad' : '')); }
          else if (T.app === 'arrow') { drawArrow(g, W, H, k, T, V); setCell(t.read, `composite PAL : crête haute ${pct(stats.comp[0], 0)} · crête basse ${pct(stats.comp[1], 0)}`, 'pz-read' + (stats.comp[0] > 4 / 3 + 0.01 || stats.comp[1] < -1 / 3 - 0.01 ? ' bad' : '')); }
          else if (T.app === 'cie') { drawCie(g, W, H, k, T, V); setCell(t.read, cieRead(V), 'pz-read'); }
          else if (T.app === 'histo') { drawHisto(g, W, H, k, T, V); setCell(t.read, `luminance maxi ${pct(stats.ymax)} · mini ${pct(stats.ymin)} · moyenne ${pct(stats.ymean, 0)}`, 'pz-read'); }
          else if (T.app === 'pic') { drawPic(g, W, H, k, T, V); setCell(t.read, T.gamut ? gamutRead(stats) : `${r.label} · ${V.hdr ? 'BT.2100 HLG' : 'BT.709'}`, 'pz-read' + (T.gamut && stats.gam > 0.01 ? ' bad' : '')); }
          continue;
        }
        // couche physique
        if (!Lk) { msg(g, W, H, k, 'SANS OBJET', 'pas de liaison SDI sur cette entrée'); setCell(t.read, '', 'pz-read'); continue; }
        if (Lk.ip && T.app !== 'timing') { msg(g, W, H, k, 'ENTRÉE IP (ST 2110)', 'pas de couche SDI : voir l\'analyseur du poste Réseau IP'); setCell(t.read, 'Le diagramme de l\'œil et la gigue SDI ne s\'appliquent qu\'aux liaisons coaxiales.', 'pz-read'); if (t.kv) fillKv(t, T, Lk, null); continue; }
        if (T.app === 'eye') {
          if (!Lk.lock) { msg(g, W, H, k, 'PAS DE VERROUILLAGE', 'l\'instrument ne retrouve pas l\'horloge du signal'); T._persist = false; fillKv(t, T, Lk, null); setCell(t.read, `Affaiblissement estimé : plus de ${Math.round(Lk.eq)} dB (égaliseur en butée).`, 'pz-read bad'); continue; }
          const E = eyeSim(Lk, !!T.eq, 240); drawEye(g, W, H, k, T, Lk, E); fillKv(t, T, Lk, E.meas);
          setCell(t.read, T.eq ? `ouverture ${Math.round(E.meas.open * 100)} % · marge de l'égaliseur ${fmt(Lk.margin, 1)} dB` : `câble : ${fmt(Lk.att, 1)} dB à ${halfTxt(f)} (≈ ${Math.round(lenOf(Lk.att, f))} m de ${CABLE})`, 'pz-read');
        } else if (T.app === 'jitter') {
          if (!Lk.lock) { msg(g, W, H, k, 'PAS DE VERROUILLAGE'); setCell(t.read, '', 'pz-read bad'); continue; }
          drawJitter(g, W, H, k, T, Lk);
          const ps = (u) => Math.round(u * f.ui) + ' ps';
          setCell(t.read, `timing ${fmt(Lk.tj, 2)} UI (${ps(Lk.tj)}) / limite ${fmt(f.tj, 1)} UI · alignement ${fmt(Lk.aj, 2)} UI (${ps(Lk.aj)}) / limite ${fmt(f.aj, 1)} UI`, 'pz-read' + (Lk.aj > f.aj || Lk.tj > f.tj ? ' bad' : ''));
        } else if (T.app === 'timing') {
          const tm = timingOf(r.point); drawTiming(g, W, H, k, T, tm);
          setCell(t.read, tm.ip ? `référence PTP (ST 2059-2) : ${tm.ptp ? 'verrouillée' : 'perdue'}` : `vertical ${tm.v >= 0 ? '+' : ''}${tm.v} ligne${Math.abs(tm.v) > 1 ? 's' : ''} · horizontal ${tm.h >= 0 ? '+' : ''}${fmt(tm.h, 3)} µs · réf. ${T.ref === 'bb' ? 'black burst 625 lignes' : f.ref}${S.faults.gps ? ' (SPG en holdover)' : ''}${tm.locked ? '' : ' · ' + tm.why}`, 'pz-read' + (tm.locked ? '' : ' bad'));
        }
      } else fillKv(t, T, Lk, null, r);
    }
  }
  function fillKv(t, T, L, meas, r = null) {
    const C = t.kv && t.kv.cells; if (!C) return;
    const f = sdiStd(); const ok = (b) => (b ? 'ok' : 'bad');
    if (T.app === 'eye') {
      const okv = (b) => 'v ' + ok(b);
      const has = !!(meas && meas.valid);
      const n = (v, d = 0, u = '') => (has && isFinite(v) ? fmt(v, d) + u : '—');
      setCell(C.amp.v, n(meas ? meas.amp : NaN, 0, ' mV'), has ? okv(Math.abs(meas.amp - AMP_NOM) <= AMP_NOM * AMP_TOL) : 'v'); setCell(C.amp.lim, '800 ± 10 %', 'lim');
      setCell(C.tr.v, n(meas ? meas.tr : NaN, 0, ' ps'), has ? okv(meas.tr <= f.tr) : 'v'); setCell(C.tr.lim, `≤ ${f.tr} ps`, 'lim');
      setCell(C.tf.v, n(meas ? meas.tf : NaN, 0, ' ps'), has ? okv(meas.tf <= f.tr) : 'v'); setCell(C.tf.lim, `≤ ${f.tr} ps`, 'lim');
      const dtv = has ? Math.abs(meas.tr - meas.tf) : NaN; setCell(C.dt.v, n(dtv, 0, ' ps'), has ? okv(dtv <= f.dtr) : 'v'); setCell(C.dt.lim, `≤ ${f.dtr} ps`, 'lim');
      const ov = has ? Math.max(meas.ovR, meas.ovF) : NaN; setCell(C.ov.v, n(ov, 1, ' %'), has ? okv(ov <= OVERSHOOT_MAX) : 'v'); setCell(C.ov.lim, `≤ ${OVERSHOOT_MAX} %`, 'lim');
      setCell(C.open.v, meas ? Math.round(meas.open * 100) + ' %' : '—', meas ? (meas.open > 0.35 ? 'v ok' : 'v bad') : 'v'); setCell(C.open.lim, T.eq ? 'au centre' : '(brut)', 'lim');
      setCell(C.aj.v, L && L.lock ? fmt(L.aj, 2) + ' UI' : '—', L && L.lock ? okv(L.aj <= f.aj) : 'v'); setCell(C.aj.lim, `≤ ${fmt(f.aj, 1)} UI`, 'lim');
      return;
    }
    // état SDI
    const rr = r || o.route(P.input);
    setCell(C.in.v, rr.label);
    if (!L) { for (const k of ['fmt', 'col', 'lock', 'crc', 'es', 'att', 'len', 'marg', 'lvl', 'ref']) setCell(C[k].v, '—'); return; }
    if (L.ip) {
      setCell(C.fmt.v, `${f.fmt} · ST 2110-20 (vidéo non compressée sur IP)`); setCell(C.col.v, rr.hdr ? 'BT.2100 HLG' : 'BT.709 SDR'); setCell(C.lock.v, 'flux IP (pas de couche SDI)');
      for (const k of ['crc', 'es', 'att', 'len', 'marg', 'lvl']) setCell(C[k].v, 'sans objet'); setCell(C.ref.v, `PTP ST 2059-2 : ${ptpTxt()}`); return;
    }
    const cn = counters(L.p.id);
    setCell(C.fmt.v, `${f.fmt} · ${f.name} (${f.std}) · ${f.rate}`); setCell(C.col.v, rr.hdr ? 'BT.2100 HLG' : 'BT.709 SDR');
    setCell(C.lock.v, L.lock ? 'verrouillé' : 'PAS DE SIGNAL (liaison illisible)', L.lock ? 'ok' : 'bad');
    setCell(C.crc.v, L.lock ? `${cn.y} / ${cn.c} depuis ${tc(S.tcOffset + cn.t0).slice(0, 8)}` : '—', cn.y + cn.c ? 'bad' : 'ok');
    setCell(C.es.v, String(cn.es), cn.es ? 'bad' : 'ok');
    setCell(C.att.v, L.margin > -1.5 ? `${fmt(L.att, 1)} dB à ${halfTxt(f)}` : `plus de ${Math.round(L.eq)} dB (égaliseur en butée)`, L.margin > 0 ? '' : 'bad');
    const len = Math.round(lenOf(L.att, f));
    setCell(C.len.v, L.margin > -1.5 ? `${len} m (${CABLE})` : `plus de ${Math.round(lenOf(L.eq, f))} m`, L.att > f.loss ? 'warn' : '');
    setCell(C.marg.v, L.margin > -1.5 ? `${fmt(L.margin, 1)} dB · norme : ${f.loss} dB garantis` : 'aucune', L.margin > 3 ? 'ok' : L.margin > 0 ? 'warn' : 'bad');
    setCell(C.lvl.v, L.lock ? `${fmt(L.ampSrc / 1000, 2)} V` : '—');
    setCell(C.ref.v, `${f.ref} du SPG${S.faults.gps ? ' (holdover)' : ''}`);
  }
  const ptpTxt = () => { const t = timingOf({ id: 'x', label: '', short: '', group: '', src: 'PGM', len: 1, path: '', kind: 'mixer' }); return t.ptp ? 'verrouillé' : 'perdu'; };

  buildInputs(); buildTiles();
  return {
    el: root,
    /** à appeler à 10 Hz par le poste */
    update() { buildInputs(); if (sigOf() !== sig) buildTiles(); upd(); },
    refresh() { inKey = ''; buildInputs(); buildTiles(); },
    close() { if (ro) ro.disconnect(); SCOPE.active = false; SCOPE.hdr = false; },
    link: () => Lk,
    stats: () => stats,
  };
}

// Module « La caméra », chapitre 4 (le traitement de l'image) : les calculs du viseur simulé
// (courbe BT.709 et ses variantes, black gamma, knee, codes 10 et 8 bits, matrice, saturation,
// détail, peau) et la garantie que l'ancien chemin du viseur rend exactement la même image.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  processPixels, usesPaint, oetf, oetfInverse, oetfParams, blackGammaCurve, kneeCurve, userMatrix, mulMatrix, ycc, hueSat,
  hueDiff, code10, code8, skinWeight, detailCore, paintLevels, linOf, decode, SKIN, PATCHES, OUTSIDE, MIRE_WHITE, VMAX, Y709,
} from '../../src/camlab/vf.js';
import { exposureOf } from '../../src/camlab/optics.js';
import { NOTIONS } from '../../src/camlab/notions/index.js';
import { CH4 } from '../../src/camlab/notions/ch4.js';
import { FIGS } from '../../src/camlab/figs.js';
import { LABS } from '../../src/camlab/labs.js';

const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg || ''} ${a} ≠ ${b} (± ${eps})`);

// ---------------- l'ancien chemin du viseur (v18.5), recopié tel quel ----------------
const DEC = new Float32Array(256); for (let i = 0; i < 256; i++) { const v = i / 255; DEC[i] = v < 0.081 ? v / 4.5 : Math.pow((v + 0.099) / 1.099, 1 / 0.45); }
const ENC_N = 4096; const ENC = new Uint8ClampedArray(ENC_N + 1);
for (let i = 0; i <= ENC_N; i++) { const l = i / ENC_N; ENC[i] = Math.round(255 * (l < 0.018 ? 4.5 * l : 1.099 * Math.pow(l, 0.45) - 0.099)); }
const NOISE = (() => { const n = 1 << 16, a = new Float32Array(n); let s = 12345; const rnd = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296); for (let i = 0; i < n; i += 2) { const u = Math.max(1e-7, rnd()), v = rnd(); const r = Math.sqrt(-2 * Math.log(u)); a[i] = r * Math.cos(2 * Math.PI * v); a[i + 1] = r * Math.sin(2 * Math.PI * v); } return a; })();
function oldProcess(d, W, H, o, frameNo) {
  const bars = o.scene === 'bars';
  const E = o.E != null ? o.E : exposureOf(o.N, o.nd != null ? o.nd : 1, o.gain || 0) * (o.light || 1);
  const wb = o.wb || [1, 1, 1], bl = o.black || [0, 0, 0];
  const kR = bars ? 1 : E * wb[0] * ENC_N, kG = bars ? 1 : E * wb[1] * ENC_N, kB = bars ? 1 : E * wb[2] * ENC_N;
  const bR = bl[0] * ENC_N, bG = bl[1] * ENC_N, bB = bl[2] * ENC_N;
  const nz = bars ? 0 : (o.noise || 0) * ENC_N; let ni = (frameNo * 7919) & 0xffff;
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
}
/** une image de test : dégradés, aplats, motifs (reproductible) */
function sample(W, H, seed = 3) {
  const d = new Uint8ClampedArray(W * H * 4); let s = seed;
  const rnd = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; d[i] = (x * 7 + y) & 255; d[i + 1] = Math.round(rnd() * 255); d[i + 2] = (x * y) & 255; d[i + 3] = 255; }
  return d;
}

test('vf : sans les réglages du chapitre 4, l\'image est exactement celle de la v18.5', () => {
  const W = 48, H = 27;
  const states = [
    { f: 20, dF: 3, N: 5.6, light: 0.5 },
    { f: 20, dF: 3, N: 4, nd: 1 / 4, gain: 6, light: 0.8, wb: [1.66, 1, 0.41], black: [0.004, 0, 0.006] },
    { f: 20, dF: 3, N: 2.8, E: 1.3, noise: 0.01, chan: 'G', zebra: { level: 70, width: 10, band: true } },
    { f: 20, dF: 3, N: 5.6, light: 0.5, reg: { R: [3.6, -1.8] }, zebra: { level: 95 }, chan: 'Y' },
    { f: 20, dF: 3, N: 5.6, scene: 'bars', chan: 'R' },
    { f: 20, dF: 3, N: Infinity, E: 0, black: [-0.002, 0.001, 0] },
  ];
  states.forEach((o, k) => {
    assert.equal(usesPaint(o), false, `état ${k} : premier chemin`);
    const a = sample(W, H, k + 1), b = new Uint8ClampedArray(a);
    oldProcess(a, W, H, o, 7 + k);
    assert.equal(processPixels(b, W, H, o, 7 + k), null);
    assert.deepEqual(b, a, `état ${k} : image identique`);
  });
});

test('vf : le second chemin (hi) rend la même image à un code près, et garde le signal au-delà de 100 %', () => {
  const W = 40, H = 20, o = { f: 20, dF: 3, N: 4, light: 0.5, wb: [1.2, 1, 0.8], black: [0.002, 0, 0.003] };
  const a = sample(W, H, 9), b = new Uint8ClampedArray(a);
  oldProcess(a, W, H, o, 0);
  const sig = processPixels(b, W, H, { ...o, hi: true, clip: VMAX }, 0);
  assert.ok(sig && sig.data.length === W * H * 4);
  let worst = 0; for (let i = 0; i < a.length; i++) if (i % 4 !== 3) worst = Math.max(worst, Math.abs(a[i] - b[i]));
  assert.ok(worst <= 1, `écart maximal ${worst}`);
  const top = Math.max(...sig.data) / 255; assert.ok(top > 1 && top <= VMAX + 1e-6, `signal jusqu'à ${top}`);
});

test('courbe BT.709 : 18 % → 40,9 %, 2 % → 9 %, droite 4,5 L sous 0,018 ; exposant réglable, blanc fixe', () => {
  near(oetf(0.18), 0.409, 0.001, '18 %'); near(oetf(0.02), 0.090, 0.0005, '2 %'); near(oetf(0.01), 0.045, 1e-12, 'pied');
  near(oetf(1), 1, 1e-12, 'blanc'); near(oetf(0.018), 0.081, 0.0005, 'raccord (les constantes de la norme, à 0,03 % près)');
  near(oetf(0.18, 0.40), 0.4545, 0.001, 'COARSE 0,40'); assert.equal(oetf(0.18, 1), 0.18);
  for (const g of [0.35, 0.4, 0.45, 0.5, 0.6, 0.8]) {
    const P = oetfParams(g); near(oetf(1, g), 1, 1e-9, `blanc g = ${g}`);
    near(P.slope * P.beta, P.a * Math.pow(P.beta, g) - (P.a - 1), g === 0.45 ? 0.0005 : 1e-9, `continuité g = ${g}`);
    let prev = -1; for (let i = 0; i <= 200; i++) { const v = oetf(i / 100, g); assert.ok(v > prev || i === 0, `croissante g = ${g}`); prev = v; }
    near(oetfInverse(oetf(0.37, g), g), 0.37, 1e-9, `inverse g = ${g}`);
  }
  // au-dessus du blanc, la courbe continue (super-blancs) : 105 % ↔ 1,105 fois la lumière du blanc
  near(oetf(oetfInverse(1.05)), 1.05, 1e-9);
});

test('black gamma : le noir, le haut de la plage et le gris moyen ne bougent pas ; croissante de −1 à +1', () => {
  for (const lv of [-1, -0.5, 0.5, 1]) {
    assert.equal(blackGammaCurve(0, lv), 0); assert.equal(blackGammaCurve(0.3, lv), 0.3); assert.equal(blackGammaCurve(0.41, lv), 0.41);
    let prev = -1; for (let i = 0; i <= 300; i++) { const v = blackGammaCurve(i / 1000, lv); assert.ok(v >= prev, `croissante ${lv}`); prev = v; }
  }
  assert.ok(blackGammaCurve(0.09, 1) > 0.13 && blackGammaCurve(0.09, -1) < 0.06, 'ouvre et referme');
  near(Math.max(...Array.from({ length: 300 }, (_, i) => blackGammaCurve(i / 1000, 1) - i / 1000)), 0.042, 0.001, 'au plus 14 % de la plage');
});

test('knee et white clip : rien sous le point ; 190 % rentre à 100 % avec un point à 90 % et une pente de 1/10', () => {
  assert.equal(kneeCurve(0.6, 0.9, 0.1), 0.6); near(kneeCurve(1.9, 0.9, 0.1), 1.0, 1e-12); assert.equal(kneeCurve(1.2, 0.9, 1), 1.2);
  // deux à trois diaphragmes rangés : 190 % ↔ 3,8 fois la lumière du blanc, 290 % ↔ 9,3 fois
  near(oetfInverse(1.9), 3.78, 0.02); near(oetfInverse(2.9), 9.3, 0.1);
  const sky = paintLevels(linOf(OUTSIDE.cloud, 4.08), { knee: { point: 0.9, slope: 0.05 }, clip: 1.03 });
  assert.ok(sky.every((v) => v <= 1.03 + 1e-12), 'white clip'); assert.ok(VMAX > 1.0899 && VMAX < 1.0902, '109 %');
});

test('codes : 10 bits noir 64, blanc 940, plafond 1019, plancher 4 ; 8 bits 16 et 235', () => {
  assert.equal(code10(0), 64); assert.equal(code10(1), 940); assert.equal(code10(0.5), 502); assert.equal(code10(1.05), 984);
  assert.equal(code10(VMAX), 1019); assert.equal(code10(1.5), 1019); assert.equal(code10(-0.2), 4);
  assert.equal(code8(0), 16); assert.equal(code8(1), 235); assert.equal(code8(2), 254);
  assert.equal(4 * code8(1), code10(1)); assert.equal(4 * code8(0), code10(0));
});

test('matrice : le blanc et les gris ne bougent pas ; G-R +0,11 annule la CAM 2 de la manipulation', () => {
  const m = userMatrix({ RG: 0.2, RB: -0.1, GR: 0.05, GB: 0.12, BR: -0.3, BG: 0.07 });
  for (let r = 0; r < 3; r++) near(m[r * 3] + m[r * 3 + 1] + m[r * 3 + 2], 1, 1e-12, 'ligne ' + r);
  const grey = paintLevels([0.3, 0.3, 0.3], { matrix: m }); near(grey[0], grey[1], 1e-12); near(grey[2], grey[1], 1e-12);
  const MIS = userMatrix({ GR: -0.1 }), fixed = mulMatrix(userMatrix({ GR: 0.11 }), MIS);
  const E = exposureOf(5.6) * 0.5;
  for (const hex of [...PATCHES.flat(), SKIN]) {
    const a = hueSat(...paintLevels(linOf(hex, E), {})), b = hueSat(...paintLevels(linOf(hex, E), { matrix: fixed, sat: 1.12 * 0.89 }));
    assert.ok(Math.abs(hueDiff(b.hue, a.hue)) < 1, `${hex} teinte`); near(b.sat / a.sat, 1, 0.03, `${hex} saturation`);
  }
  // sans correction, le rouge de la CAM 2 est nettement décalé vers le jaune
  const r1 = hueSat(...paintLevels(linOf(PATCHES[0][0], E), {})), r2 = hueSat(...paintLevels(linOf(PATCHES[0][0], E), { matrix: MIS }));
  assert.ok(hueDiff(r2.hue, r1.hue) > 4, 'décalage vers le jaune');
});

test('saturation et Y\'CbCr BT.709 : la luminance est gardée, 0 donne du gris', () => {
  const [y, cb, cr] = ycc(1, 1, 1); near(y, 1, 1e-12); near(cb, 0, 1e-12); near(cr, 0, 1e-12);
  near(Y709[0] + Y709[1] + Y709[2], 1, 1e-12);
  const lin = linOf('#c0282a', 1), a = paintLevels(lin, {}), b = paintLevels(lin, { sat: 0 }), c = paintLevels(lin, { sat: 1.3 }, false);
  near(ycc(...b)[0], ycc(...a)[0], 1e-9); near(b[0], b[2], 1e-9); near(ycc(...c)[0], ycc(...a)[0], 1e-9);
  near(hueSat(...c).hue, hueSat(...a).hue, 1e-6, 'la teinte ne bouge pas');
});

test('détail et peau : CRISP coupe les petits écarts, le limiteur borne ; la peau est reconnue, pas les pastilles', () => {
  assert.equal(detailCore(0.01, 1, 0.02), 0); near(detailCore(0.05, 1, 0.02), 0.03, 1e-12); near(detailCore(-0.05, 2, 0.02), -0.06, 1e-12);
  assert.equal(detailCore(0.5, 1, 0, 0.12), 0.12);
  const E = exposureOf(5.6) * 0.5, skin = paintLevels(linOf(SKIN, E), {});
  assert.ok(skinWeight(...skin) > 0.8, 'peau'); near(hueSat(...skin).hue, 123, 8, 'près de la ligne des chairs');
  for (const hex of PATCHES.flat()) assert.equal(skinWeight(...paintLevels(linOf(hex, E), {})), 0, hex);
  assert.equal(skinWeight(0.5, 0.5, 0.5), 0, 'gris');
  // un bord net : le détail ajoute un liseré clair du côté clair, sombre du côté sombre
  const W = 12, H = 3, d = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4, v = x < 6 ? 30 : 220; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
  const s = processPixels(d, W, H, { f: 20, dF: 3, N: 8, E: 1, clip: VMAX, detail: { level: 1 } }, 0);
  const row = Array.from({ length: W }, (_, x) => s.data[(W + x) * 4 + 1] / 255);
  assert.ok(row[6] > row[10] + 0.05 && row[5] < row[1] - 0.05, 'liserés');
  assert.ok(s.pre && Math.abs(s.pre[W + 10] - 220 / 255) < 0.01, 'luminance avant le détail');
});

test('mesures des manipulations : blanc de la mire, fenêtre, pavés de gris', () => {
  const E = exposureOf(5.6) * 0.5;
  near(oetf(MIRE_WHITE * E), 0.935, 0.003, 'blanc de la mire à f/5,6');
  const lum = (v) => Y709[0] * v[0] + Y709[1] * v[1] + Y709[2] * v[2];
  const cloud = lum(paintLevels(linOf(OUTSIDE.cloud, E * 4), {}, false)), sky = lum(paintLevels(linOf(OUTSIDE.sky, E * 4), {}, false));
  assert.ok(cloud > 1.8 && sky > 1.3, 'la fenêtre dépasse');
  // un knee à 95 % et une pente de 1/20 range les nuages sous 100 % avec plus de 1,5 % d'écart sur le ciel
  const k = { knee: { point: 0.95, slope: 0.05 }, clip: VMAX };
  const c2 = lum(paintLevels(linOf(OUTSIDE.cloud, E * 4), k)), s2 = lum(paintLevels(linOf(OUTSIDE.sky, E * 4), k));
  assert.ok(c2 <= 1.0005 && c2 - s2 >= 0.015, `nuages ${c2}, ciel ${s2}`);
  // le dernier pavé de l'échelle de gris est le blanc à 255 : au code 940 vers f/5,7
  assert.equal(decode(255), 1);
});

test('chapitre 4 : sept fiches écrites, chacune avec son schéma et sa manipulation', () => {
  const ids = ['quantif', 'noir', 'gamma', 'knee', 'detail', 'matrice', 'fichiers'];
  assert.deepEqual(Object.keys(CH4).sort(), [...ids].sort());
  for (const id of ids) {
    const f = NOTIONS[id];
    assert.ok(!f.prevu && f.chap === 4 && f.lot === 3, id);
    assert.ok(FIGS[f.fig] && /<svg[^>]+aria-label="[^"]{40,}/.test(FIGS[f.fig]()), `${id} : schéma`);
    assert.equal(typeof LABS[f.lab], 'function', `${id} : manipulation`);
    assert.ok(!/NaN|undefined/.test(FIGS[f.fig]()), `${id} : schéma sans NaN`);
  }
  assert.equal(NOTIONS.quantif.cours, 'signal-bits');
});

// Module « La caméra », chapitres 8 et 9 (forme d'onde, vectorscope, moniteur, mires, grand capteur,
// UHD et HDR, super ralenti) : les chiffres des fiches et des schémas, et des défis qu'on peut réussir.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NOTIONS } from '../../src/camlab/notions/index.js';
import { CH89 } from '../../src/camlab/notions/ch89.js';
import { FIGS } from '../../src/camlab/figs.js';
import { LABS } from '../../src/camlab/labs.js';
import { exposureOf } from '../../src/camlab/optics.js';
import {
  oetf709, oetf709inv, ycc, rgbOf, hueOf, barVector, K601, BAR7, SKIN_LINE, lumaOf, SCENE_WF, WF_K,
  hlg, hlgInv, HLG_REF, hlgNits, bt1886, monNits, pluge, blueOnly, W23, WS35, cocOf, focalFor, dofOf, bgBlurFrac,
  hfrStops, frameLight, flickerSpread, shownFrame, starGrey, CHART,
} from '../../src/camlab/labs/ch89.js';

const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg} : ${a} au lieu de ${b} ± ${eps}`);

test('les sept fiches : chapitre, lot et pastille de l\'annonce, schéma et manipulation, leçon du Cours', () => {
  const attendu = { waveform: [8, 2, 'mesure', 'signal-niveaux'], vecto: [8, 3, 'mesure', 'signal-couleur'], moniteur: [8, 3, 'moniteur'], mires: [8, 2, 'mire'], grandcapteur: [9, 3], hdr: [9, 3], hfr: [9, 3, undefined, 'ralentis-evs'] };
  assert.deepEqual(Object.keys(CH89).sort(), Object.keys(attendu).sort());
  for (const [id, [chap, lot, point, cours]] of Object.entries(attendu)) {
    const f = NOTIONS[id];
    assert.equal(f, CH89[id], `${id} : la fiche écrite remplace l'annonce`);
    assert.ok(!f.prevu, id);
    assert.equal(f.chap, chap, `${id} : chapitre`); assert.equal(f.lot, lot, `${id} : lot`); assert.equal(f.point, point, `${id} : pastille`);
    assert.equal(f.cours, cours, `${id} : leçon du Cours`);
    assert.equal(f.fig, id); assert.equal(f.lab, id);
    assert.ok(FIGS[id]().includes('aria-label='), `${id} : schéma accessible`);
    assert.equal(typeof LABS[id], 'function');
  }
});

test('BT.709 : la courbe de prise de vue, une carte grise à 41 %, Y′CbCr aller-retour', () => {
  near(oetf709(1), 1, 1e-12, 'blanc'); near(oetf709(0.018), 0.081, 1e-3, 'raccord du segment linéaire');
  near(100 * oetf709(0.18), 40.9, 0.1, 'carte grise 18 %');
  for (const v of [0.05, 0.3, 0.6, 0.95]) near(oetf709(oetf709inv(v)), v, 1e-9, 'inverse');
  const [Y, cb, cr] = ycc(0.7, 0.4, 0.2); const back = rgbOf(Y, cb, cr);
  [0.7, 0.4, 0.2].forEach((v, i) => near(back[i], v, 1e-9, 'aller-retour'));
});

test('vectorscope : les cibles des barres 75 % (BT.709), le décalage en BT.601, la ligne des carnations', () => {
  const H = { R: 103, Mg: 50, B: 355, Cy: 283, G: 230, Yl: 175 };
  for (const [n, h] of Object.entries(H)) near(barVector(n).hue, h, 0.6, `teinte ${n}`);
  near(barVector('R').sat / 0.5, 0.77, 0.005, 'saturation du rouge 75 %');
  near(barVector('Mg').sat / 0.5, 0.89, 0.005, 'saturation du magenta 75 %');
  near(barVector('R', 0.75, K601).hue, 108.6, 0.2, 'rouge en BT.601');
  // les complémentaires à l'opposé
  near(Math.abs(barVector('R').hue - barVector('Cy').hue), 180, 1e-6, 'rouge et cyan opposés');
  // des barres à 75 % tombent aux trois quarts des cases 100 %
  near(barVector('G', 0.75).sat / barVector('G', 1).sat, 0.75, 1e-12, 'barres 75 % dans les cibles 100 %');
  // luminance des barres : l'escalier de la forme d'onde
  assert.deepEqual(BAR7.map((c) => Math.round(100 * ycc(c[0], c[1], c[2])[0])), [75, 70, 59, 54, 21, 16, 5]);
  // le visage de la manipulation, bien balancé, tombe sur la ligne des carnations
  const v = [0.58, 0.34, 0.26].map((x) => oetf709(x * 0.75)); const [, cb, cr] = ycc(v[0], v[1], v[2]);
  near(hueOf(cb, cr), SKIN_LINE, 3, 'visage sur la ligne');
});

test('forme d\'onde : les trois défis de la manipulation se réussissent à l\'iris', () => {
  const S = SCENE_WF, E = (N) => exposureOf(N) * WF_K;
  // défi 1 : il existe un iris où le visage est entre 60 et 70 % sans que la chemise écrête
  const ok1 = [];
  for (let N = 2; N <= 16; N *= 1.01) if (lumaOf(S.skin, E(N)) >= 60 && lumaOf(S.skin, E(N)) <= 70 && lumaOf(S.shirt, E(N)) < 99.6) ok1.push(N);
  assert.ok(ok1.length > 5, 'une plage d\'iris pour le visage');
  assert.ok(Math.log2(ok1[ok1.length - 1] / ok1[0]) * 2 > 0.2, 'au moins un quart de diaphragme de marge');
  // la carte grise est alors vers 41 à 46 %
  for (const N of ok1) { const c = lumaOf(S.card, E(N)); assert.ok(c > 40 && c < 47, 'carte grise ' + c); }
  // défi 3 : la fenêtre ne s'écrête plus qu'en fermant vers f/11,4, et le visage tombe sous 30 %
  assert.ok(lumaOf(S.window, E(11)) >= 99.6 && lumaOf(S.window, E(12)) < 99.6);
  assert.ok(lumaOf(S.skin, E(12)) < 30, 'visage sombre devant la fenêtre');
});

test('HLG (BT.2100, BT.2408) : blanc de référence à 75 %, 203 cd/m², gris à 38 %, 3,8 fois de marge', () => {
  near(hlg(1 / 12), 0.5, 1e-9, 'raccord racine et logarithme'); near(hlg(1), 1, 1e-6, 'crête');
  for (const v of [0.2, 0.5, 0.75, 0.95]) near(hlg(hlgInv(v)), v, 1e-9, 'inverse');
  near(HLG_REF, 0.265, 0.001, 'lumière du blanc de référence');
  near(hlgNits(HLG_REF), 203, 1, 'blanc de référence sur un écran de 1 000 cd/m²');
  near(hlgNits(1), 1000, 1e-9, 'crête de l\'écran');
  near(100 * hlg(0.18 * HLG_REF), 38, 0.5, 'gris 18 %');
  near(1 / HLG_REF, 3.77, 0.02, 'lumière au-dessus du blanc');
  near(bt1886(1), 100, 1e-9, 'SDR : blanc à 100 cd/m²'); near(bt1886(0.5), 100 * Math.pow(0.5, 2.4), 1e-9, 'gamma 2,4');
});

test('moniteur : la PLUGE, la sonde, le bleu seul', () => {
  const c = Math.pow(100 / 250, 1 / 2.4);
  near(monNits(1, 0, c), 100, 1e-6, 'contraste pour 100 cd/m²');
  assert.deepEqual(pluge(0, c), { m2: false, p2: true }, 'bien réglé : la −2 % disparaît, la +2 % se voit');
  assert.equal(pluge(0.05, c).m2, true, 'trop lumineux : la −2 % se voit');
  assert.equal(pluge(-0.02, c).p2, false, 'trop sombre : la +2 % disparaît');
  const b1 = blueOnly(1); assert.ok(Math.max(...b1) - Math.min(...b1) < 1e-9, 'chroma juste : quatre bleus égaux');
  const b2 = blueOnly(1.2); assert.ok(b2[3] > b2[0] + 0.1, 'chroma trop forte : la barre bleue plus claire que la grise');
});

test('grand capteur : focale ×2,6, zone nette ÷2,6 environ, ouverture équivalente, stade', () => {
  near(WS35 / W23, 2.6, 0.01, 'rapport des largeurs');
  near(focalFor(W23, 3, 0.5), 57.5, 0.1, 'visage de 50 cm à 3 m en 2/3'); near(focalFor(WS35, 3, 0.5), 149.4, 0.1, 'en Super 35');
  const d23 = dofOf(focalFor(W23, 3, 0.5), 2.8, 3, cocOf(W23)).total, d35 = dofOf(focalFor(WS35, 3, 0.5), 2.8, 3, cocOf(WS35)).total;
  near(d23, 0.164, 0.003, 'zone nette 2/3 à f/2,8'); near(d35, 0.061, 0.002, 'zone nette S35 à f/2,8');
  near(d23 / d35, 2.6, 0.12, 'rapport des zones nettes');
  const e = dofOf(focalFor(WS35, 3, 0.5), 2.8 * WS35 / W23, 3, cocOf(WS35)).total;
  near(e / d23, 1, 0.05, 'f/2,8 × 2,6 en Super 35 rend à peu près la zone nette du 2/3');
  // au stade : 6 m nets autour d'un joueur à 50 m, cadré sur 4 m
  const tot = (W, N) => dofOf(focalFor(W, 50, 4), N, 50, cocOf(W)).total;
  assert.ok(tot(W23, 1.6) >= 6 && tot(W23, 1.5) < 6, '2/3 : f/1,6');
  assert.ok(tot(WS35, 4.1) >= 6 && tot(WS35, 4) < 6, 'Super 35 : f/4,1');
  near(bgBlurFrac(focalFor(WS35, 3, 0.5), 2.8, 3, 6, WS35) / bgBlurFrac(focalFor(W23, 3, 0.5), 2.8, 3, 6, W23), 2.6, 0.1, 'fond 2,6 fois plus flou');
});

test('super ralenti : lumière perdue, ralenti fluide, scintillement à 100 Hz', () => {
  near(hfrStops(3), 1.585, 0.001, '3× : 1,6 diaphragme'); near(hfrStops(6), 2.585, 0.001, '6×'); near(hfrStops(8), 3, 1e-12, '8×');
  near(11 / Math.sqrt(3), 6.35, 0.01, 'HDC-5500 : f/11 devient environ f/6,4 à 3×');
  // 3× relu à 33 % : chaque image une fois ; 1× relu à 33 % : chaque image trois fois
  assert.deepEqual([0, 1, 2, 3, 4, 5].map((j) => shownFrame(j, 3, 1 / 3)), [0, 1, 2, 3, 4, 5]);
  assert.deepEqual([0, 1, 2, 3, 4, 5].map((j) => shownFrame(j, 1, 1 / 3)), [0, 0, 0, 1, 1, 1]);
  assert.deepEqual([0, 1, 2].map((j) => shownFrame(j, 6, 1 / 6)), [0, 1, 2]);
  // scintillement : nul à 50 et 100 i/s (nombre entier de battements), visible au-delà, quelle que soit la phase
  for (const phi of [0, 0.6, 2]) {
    assert.ok(flickerSpread(50, 0.35, 100, phi) < 1e-9 && flickerSpread(100, 0.35, 100, phi) < 1e-9, '1× et 2× à l\'abri');
    for (const k of [3, 6, 8]) assert.ok(flickerSpread(50 * k, 0.35, 100, phi) > 0.05, `${k}× clignote`);
  }
  // à 3×, la lumière revient toutes les trois images : chaque phase a la sienne
  for (let n = 0; n < 9; n++) near(frameLight(n, 150, 0.35), frameLight(n + 3, 150, 0.35), 1e-9, 'période de trois images');
});

test('mires : le disque gris de l\'étoile, la charte de onze gris', () => {
  near(starGrey(54, 3, 0), 6.4, 0.05, 'au point, en serré : limité par les photosites');
  assert.ok(starGrey(54, 3, 0.05) > 30, 'flou : le disque grandit');
  assert.ok(starGrey(20, 3, 0) > starGrey(54, 3, 0), 'en large, le disque est plus grand sur la mire');
  assert.equal(CHART.length, 11);
  assert.deepEqual(CHART.map((v) => Math.round(100 * oetf709(v / 0.9))), [2, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100], 'paliers de 10 % quand le blanc touche 100 %');
});

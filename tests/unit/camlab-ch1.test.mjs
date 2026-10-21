// Module « La caméra », chapitre 1 (l'objectif), lots 2 et 3 : les calculs des manipulations
// (camlab/labs/ch1.js), les fiches écrites (camlab/notions/ch1.js) et leurs schémas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CH1 } from '../../src/camlab/notions/ch1.js';
import { NOTIONS } from '../../src/camlab/notions/index.js';
import { FIGS_CH1 } from '../../src/camlab/figs/ch1.js';
import {
  LABS_CH1, fresnel, quarterWave, COATS, transmission, veilOf, hoodLit, hoodShadow, hoodFull, pupil, rampLoss, extAperture,
  macroNeed, macroClosest, MACRO_MAX, lateralCA, ALAC_RESIDUAL, CORNER, PITCH, distortion, vignetteLoss, OBJECTIFS, focalFor, lensAperture,
} from '../../src/camlab/labs/ch1.js';
import { LENS, maxAperture, defocus, COC } from '../../src/camlab/optics.js';
import { encode } from '../../src/camlab/vf.js';

const near = (a, b, e, msg) => assert.ok(Math.abs(a - b) <= e, `${msg} : ${a} au lieu de ${b}`);
const DEG = Math.PI / 180;
const IDS = ['frontale', 'ramping', 'doubleur', 'macro', 'defauts', 'monture', 'box-portable'];

test('chapitre 1 : les sept fiches des lots 2 et 3 sont écrites, avec leur schéma et leur manipulation', () => {
  assert.deepEqual(Object.keys(CH1).sort(), [...IDS].sort());
  for (const id of IDS) {
    const f = NOTIONS[id];
    assert.ok(f && !f.prevu, `${id} écrite`);
    assert.equal(f.chap, 1, id);
    assert.equal(typeof LABS_CH1[f.lab], 'function', `${id} : manipulation`);
    assert.ok(FIGS_CH1[f.fig] && /<svg[^>]+aria-label="[^"]{30,}"/.test(FIGS_CH1[f.fig]()), `${id} : schéma avec son aria-label`);
    assert.ok(f.lab.startsWith(id) && f.fig.startsWith(id), `${id} : identifiants préfixés`);
  }
  // le lot et la pastille annoncés ne changent pas
  assert.deepEqual(IDS.map((id) => NOTIONS[id].lot), [2, 2, 2, 2, 3, 2, 3]);
  assert.deepEqual(IDS.map((id) => NOTIONS[id].point), ['frontale', 'zoom', 'doubleur', 'macro', 'frontale', 'monture', 'manches']);
});

test('lentille frontale : Fresnel, traitements et voile', () => {
  near(fresnel(1.5), 0.04, 1e-12, 'verre nu à n = 1,5 : 4 %');
  near(quarterWave(1.38, 1.52), 0.0126, 0.0002, 'couche de MgF2 sur verre 1,52 : 1,3 %');
  const T = COATS.map((c) => transmission(c.R));
  near(T[0], 0.294, 0.002, '30 surfaces de verre nu');
  near(T[1], 0.684, 0.002, '30 surfaces à couche simple');
  near(T[2], 0.942, 0.002, '30 surfaces multicouches');
  // seul le multicouche passe le défi : plus de 90 % de lumière, voile sous 2 %
  assert.deepEqual(COATS.map((c) => transmission(c.R) > 0.9 && 100 * encode(veilOf(transmission(c.R))) < 2), [false, false, true]);
});

test('pare-soleil : la lentille éclairée par un projecteur hors champ', () => {
  near(hoodShadow() / DEG, 60, 0.1, 'ombre complète au-delà de 60°');
  near(hoodFull() / DEG, 36, 0.1, 'lentille entièrement éclairée en deçà de 36°');
  assert.equal(hoodLit(30 * DEG), 1);
  assert.equal(hoodLit(61 * DEG), 0);
  assert.equal(hoodLit(70 * DEG, false), 1, 'sans pare-soleil, toute la lentille');
  let prev = 1; for (let a = 36; a <= 60; a += 2) { const v = hoodLit(a * DEG); assert.ok(v <= prev + 1e-12, 'décroît avec l\'angle'); prev = v; }
  // le pare-soleil ne coupe pas le champ au grand angle : 46,8° en horizontal à 4,5 mm
  const half = Math.atan(9.59 / 2 / 4.5);
  assert.ok(Math.atan(0.104 / 0.0845) > half, 'ouverture du pare-soleil plus large que le champ');
});

test('ramping : f/1,8 jusqu\'à 41 mm, f/2,4 à 54 mm, pupille d\'entrée bornée', () => {
  assert.equal(maxAperture(41), 1.8);
  assert.equal(rampLoss(1.8, 30), 0);
  near(rampLoss(1.8, 54), 2 * Math.log2(2.4 / 1.8), 0.05, 'un peu moins d\'un diaphragme au bout');
  near(pupil(41, 1.8), 22.8, 0.05, 'pupille à 41 mm');
  near(pupil(54, maxAperture(54)), pupil(41, 1.8), 0.01, 'au-delà de 41 mm, la pupille ne grandit plus');
  assert.equal(rampLoss(2.4, 54), 0, 'à f/2,4, plus de perte au bout du zoom');
});

test('doubleur : deux diaphragmes, f/3,6 à 82 mm et f/4,8 à 108 mm', () => {
  assert.equal(extAperture(1.8, 20, true), 3.6);
  near(extAperture(1.8, 54, true), 4.8, 0.07, 'f/4,8 à 108 mm');
  assert.equal(extAperture(5.6, 20, true), 11.2);
  near((extAperture(5.6, 20, false) / extAperture(5.6, 20, true)) ** 2, 0.25, 1e-12, 'quatre fois moins de lumière');
});

test('macro : un décalage fixe, une erreur de point en f², plus de zoom parfocal', () => {
  // à la distance minimale, aucun décalage
  near(macroNeed(20, LENS.mod), 0, 1e-12, 'net à 0,3 m sans macro');
  // pour voir net à 12 cm, le décalage croît comme le carré de la focale
  near(macroNeed(10, 0.12) / macroNeed(5, 0.12), 4, 1e-9, 'f deux fois plus longue : quatre fois plus de décalage');
  assert.ok(macroClosest(4.5) < 0.03 && macroClosest(54) > 0.25, 'la macro travaille au grand angle');
  near(macroClosest(13.8), 0.12, 0.002, '12 cm au plus serré vers 14 mm');
  // net à 12 cm à 8 mm ; serré de moitié, sans toucher aux bagues : flou
  const M = macroNeed(8, 0.12);
  assert.ok(M < MACRO_MAX);
  assert.ok(Math.abs(defocus(8, 0.12, LENS.mod, -M)) / 2.8 <= COC);
  assert.ok(Math.abs(defocus(12, 0.12, LENS.mod, -M)) / 2.8 >= 3 * COC, 'le zoom n\'est plus parfocal');
});

test('défauts optiques : ordres de grandeur du modèle', () => {
  near(PITCH, 5, 0.01, 'photosite de 5 µm');
  near(CORNER, 1101.5, 0.1, 'demi-diagonale en photosites');
  const ca = lateralCA(4.5);
  assert.ok(ca.R * CORNER > 1 && ca.R * CORNER < 2, 'un à deux photosites au coin, au grand angle');
  assert.ok(Math.abs(lateralCA(54).R) < Math.abs(ca.R), 'moins au serré');
  assert.ok(ca.R * CORNER * ALAC_RESIDUAL < 0.5, 'l\'ALAC ramène l\'écart sous un demi-photosite');
  near(distortion(4.5), -0.03, 1e-12, 'barillet au grand angle');
  assert.ok(distortion(54) > 0, 'coussinet au serré');
  assert.ok([4.5, 10, 20, 25, 26, 30, 40, 54].some((f) => Math.abs(distortion(f)) < 0.003), 'une plage sans distorsion visible');
  near(1 - vignetteLoss(1.8), 0.5, 1e-12, 'coins à 50 % à pleine ouverture');
  assert.ok(1 - vignetteLoss(4) > 0.9, 'presque plus de vignetage à f/4');
  assert.ok(1 - vignetteLoss(3.3) >= 0.8 && 1 - vignetteLoss(3) < 0.8, '80 % vers f/3,3');
});

test('portable ou box : la focale du plan et ce qu\'il reste d\'ouverture', () => {
  near(focalFor(3, 0.6), 26.95, 0.01, 'plan poitrine à 3 m');
  near(focalFor(80, 2), 215.6, 0.01, 'joueur en pied à 80 m');
  const { ZA12, UA24, UA80 } = OBJECTIFS;
  assert.ok(ZA12.fmax * 2 < focalFor(80, 2), 'le zoom du plateau ne va pas jusque-là');
  assert.equal(lensAperture(UA24, focalFor(80, 2) / 2, true), 3.6, 'le portable du car y arrive avec le doubleur, à f/3,6');
  assert.equal(lensAperture(UA80, focalFor(80, 2)), 1.7, 'le box y est à pleine ouverture');
  assert.ok(UA80.fmax < focalFor(80, 0.4) && UA80.fmax * 2 > focalFor(80, 0.4), 'le visage : le box avec son doubleur');
  near(lensAperture(UA80, focalFor(80, 0.4) / 2, true), 5.24, 0.01, 'f/5,2 pour le visage à 80 m');
  assert.ok(UA80.kg > 10 * ZA12.kg, 'un box pèse plus de dix fois un portable');
});

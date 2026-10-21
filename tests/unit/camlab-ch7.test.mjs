// Module « La caméra », chapitre 7 (la voie caméra) : les six fiches (fibre, CCU, RCP, genlock, signal de
// sortie, line-up), leurs liens vers le Cours, et les calculs de leurs manipulations (lumière arrêtée par une
// poussière, références et terminaison, codes 10 bits et débits SDI, raccord de deux caméras).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../helpers/scene.mjs';
import '../../src/cours/all.js';
import { lessonById } from '../../src/cours/index.js';
import { NOTIONS } from '../../src/camlab/notions/index.js';
import { CH7 } from '../../src/camlab/notions/ch7.js';
import { FIGS_CH7 } from '../../src/camlab/figs/ch7.js';
import {
  LABS_CH7, MODE_W, ZONE_A, blockedFraction, lossDb, inZoneA, TRI_HALF, BB_SYNC, refWave, lineWave, termGain, refChains,
  ycbcr, codes10, sdiRate, CHARTE, camSignal, lineupGaps,
} from '../../src/camlab/labs/ch7.js';

const close = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg} : ${a} au lieu de ${b}`);

test('chapitre 7 : six fiches écrites, à leur place, avec schéma, manipulation et leçon du Cours', () => {
  assert.deepEqual(Object.keys(CH7), ['fibre', 'ccu', 'rcp', 'genlock', 'sortie', 'lineup']);
  const cours = { fibre: 'camera-systeme', genlock: 'synchro-genlock', sortie: 'sdi-cest-quoi', lineup: 'expl-lineup' };
  for (const [id, f] of Object.entries(CH7)) {
    assert.equal(NOTIONS[id], f, `${id} : la fiche écrite remplace l'annonce`);
    assert.ok(!f.prevu && f.chap === 7, id);
    assert.equal(typeof LABS_CH7[f.lab], 'function', `${id} : manipulation`);
    const s = FIGS_CH7[f.fig]();
    assert.ok(s.startsWith('<svg') && /aria-label="[^"]{40,}"/.test(s) && !/NaN|undefined/.test(s), `${id} : schéma`);
    assert.equal(f.cours, cours[id], `${id} : leçon du Cours`);
    if (f.cours) assert.ok(lessonById(f.cours), `${id} : la leçon ${f.cours} existe`);
  }
  // lot et pastille : ceux de la fiche annoncée
  assert.deepEqual(Object.values(CH7).map((f) => [f.lot, f.point]), [[2, 'fibre'], [2, 'ccu'], [2, 'rcp'], [3, 'ccu'], [3, 'ccu'], [3, 'rcp']]);
});

test('fibre : la lumière arrêtée par une poussière, intégrale du mode gaussien', () => {
  // une poussière centrée de rayon a arrête 1 − exp(−2 a² / w²)
  for (const a of [0.5, 2, 4]) close(blockedFraction([{ x: 0, y: 0, r: a }]), 1 - Math.exp(-2 * a * a / (MODE_W * MODE_W)), 0.004, `rayon ${a} µm`);
  const b4 = blockedFraction([{ x: 0, y: 0, r: 2 }]);
  close(b4, 0.315, 0.005, 'poussière de 4 µm au centre');
  close(lossDb(b4), 1.64, 0.03, 'en dB');
  // sur la gaine, à 30 µm du centre : rien ; une tache à demi transparente arrête moitié moins
  assert.ok(blockedFraction([{ x: 30, y: 0, r: 3 }]) < 1e-6);
  close(blockedFraction([{ x: 0, y: 0, r: 30, t: 0.5 }]), 0.5, 0.005, 'tache grasse couvrant le mode');
  assert.equal(lossDb(0), 0);
  // la zone du cœur : 25 µm de diamètre
  assert.ok(inZoneA({ x: 13, y: 0, r: 1 }) && !inZoneA({ x: ZONE_A + 2, y: 0, r: 1 }));
});

test('référence : tri-level et black burst, ligne terminée ou ouverte', () => {
  close(TRI_HALF, 0.5926, 0.0001, '44 périodes à 74,25 MHz');
  const t0 = 1.5;
  // tri-level : −300 mV puis +300 mV, 0 V ailleurs ; repère à mi-hauteur
  close(refWave('tri', t0 + TRI_HALF / 2, t0), -0.3, 1e-9, 'première demi-impulsion');
  close(refWave('tri', t0 + 1.5 * TRI_HALF, t0), 0.3, 1e-9, 'seconde demi-impulsion');
  close(refWave('tri', t0 + TRI_HALF, t0), 0, 1e-9, 'passage à 0 V au milieu');
  close(refWave('tri', t0 + 3 * TRI_HALF, t0), 0, 1e-9, 'après');
  // black burst : top de 4,7 µs à −300 mV, front à mi-hauteur
  close(refWave('bb', t0 + BB_SYNC / 2, t0), -0.3, 1e-9, 'top');
  close(refWave('bb', t0, t0), -0.15, 1e-9, 'front à mi-hauteur');
  close(refWave('bb', t0 + BB_SYNC, t0), -0.15, 1e-9, 'front arrière à 4,7 µs');
  let lo = 0, hi = 0; for (let t = t0 + 5.6; t < t0 + 7.9; t += 0.01) { const v = refWave('bb', t, t0); lo = Math.min(lo, v); hi = Math.max(hi, v); }
  assert.ok(hi > 0.14 && lo < -0.14, 'salve de ±150 mV');
  // terminaison : une ligne ouverte double le signal, deux bouchons en donnent les deux tiers
  assert.equal(termGain(0), 2); assert.equal(termGain(1), 1); close(termGain(2), 2 / 3, 1e-12, 'deux bouchons');
  close(lineWave('tri', t0 + TRI_HALF / 2, 1, 0), -0.6, 1e-9, 'ligne ouverte, au bout');
  close(lineWave('tri', t0 + TRI_HALF / 2, 0, 0), -0.3, 1e-9, 'ligne terminée');
});

test('référence : la boucle de trois CCU', () => {
  const SIG = { A: 'bb', B: 'tri' };
  // B1 → CCU 1 → boucle → CCU 2 → boucle → CCU 3 + bouchon
  let c = refChains(['B1', 'L0', 'L1'], [false, false, true], SIG);
  assert.deepEqual(c.map((x) => [x.sig, x.gamma]), [['tri', 0], ['tri', 0], ['tri', 0]]);
  assert.deepEqual(c.map((x) => x.x), [10, 10.5, 11]); assert.ok(c.every((x) => x.L === 11));
  // sans bouchon : toute la chaîne est ouverte
  c = refChains(['B1', 'L0', 'L1'], [false, false, false], SIG);
  assert.ok(c.every((x) => x.gamma === 1));
  // la CCU 2 débranchée : la CCU 3, qui la suivait, perd la référence
  c = refChains(['B1', '', 'L1'], [true, false, true], SIG);
  assert.deepEqual(c.map((x) => x.sig), ['tri', null, null]);
  // deux sorties du DA, une boucle ; un black burst sur la CCU 3
  c = refChains(['B1', 'B2', 'A1'], [true, true, true], SIG);
  assert.deepEqual(c.map((x) => x.sig), ['tri', 'tri', 'bb']);
});

test('sortie : codes 10 bits BT.709 et débits SDI', () => {
  const code = (r, g, b) => { const [y, cb, cr] = ycbcr(r, g, b); return codes10(y, cb, cr); };
  assert.deepEqual(code(1, 1, 1), [940, 512, 512]);
  assert.deepEqual(code(0, 0, 0), [64, 512, 512]);
  assert.deepEqual(code(0.5, 0.5, 0.5), [502, 512, 512]);
  // les barres à 75 % (BT.709, 10 bits)
  assert.deepEqual(code(0.75, 0.75, 0.75), [721, 512, 512]);
  assert.deepEqual(code(0.75, 0, 0), [204, 435, 848]);
  assert.deepEqual(code(0, 0, 0.75), [111, 848, 481]);
  assert.deepEqual(code(0.75, 0.75, 0), [674, 176, 543]);
  assert.equal(sdiRate('1080i50'), 1.485e9);
  assert.equal(sdiRate('720p50'), 1.485e9);
  assert.equal(sdiRate('1080p50'), 2.97e9);
});

test('line-up : deux caméras réglées pareil se raccordent ; la saturation ne touche pas aux gris', () => {
  const c1 = { E: 0.9, wb: [1, 1, 1], black: [0.01, 0.01, 0.01], sat: 1 };
  let g = lineupGaps(c1, { ...c1 });
  assert.ok([...g.noir, ...g.gris, ...g.blanc].every((d) => Math.abs(d) < 1e-12) && g.col < 1e-12);
  // plus de saturation : les gris restent, les couleurs s'éloignent du centre
  g = lineupGaps(c1, { ...c1, sat: 1.22 });
  assert.ok(g.gris.every((d) => Math.abs(d) < 1e-12) && g.col > 0.03);
  // une dominante bleue se voit sur le gris, voie bleue au-dessus
  g = lineupGaps(c1, { ...c1, wb: [1, 1, 1.1] });
  assert.ok(g.gris[2] > 0.01 && Math.abs(g.gris[1]) < 1e-12);
  // la CAM 2 de la manipulation : ABB, master black, AWB, iris et saturation la raccordent
  const BLACK0 = [0.025, 0.018, 0.008], L1 = 0.2247;
  const ref = { E: 4 * L1, wb: [1, 1, 1], black: [0.01, 0.01, 0.01], sat: 1 };
  const N = 8 / Math.sqrt(4 / Math.SQRT2); // un demi-diaphragme de plus à fermer
  const cam2 = { E: (8 / N) ** 2 * L1 * Math.SQRT2, wb: [1, 1, 1], black: [BLACK0[1] - 0.008, BLACK0[1] - 0.008, BLACK0[1] - 0.008], sat: 1.22 * 0.82 };
  g = lineupGaps(ref, cam2);
  assert.ok(g.noir.every((d) => Math.abs(d) <= 0.005) && g.gris.every((d) => Math.abs(d) <= 0.01) && g.col <= 0.012, JSON.stringify(g));
  // le signal reste dans la plage du SDI
  for (const [, refl] of CHARTE.colors) for (const v of camSignal(refl, { ...ref, E: 10 })) assert.ok(v >= -0.07 && v <= 1.09);
});

// Les leçons ajoutées aux autres chapitres (v19.19) : l'énergie du car (triphasé, neutre, onduleur, terre), la
// compression (débit brut, rapport, bits par pixel, GOP et propagation d'une erreur), le plan caméras (sens du jeu
// à l'écran, axe, focales), le stockage du serveur ralenti (Go par heure, boucle, transfert) et la liaison point à
// point (Fresnel, renflement, parabole, diffraction). Les calculs purs que lisent les manipulations et les exercices.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../helpers/scene.mjs';
import '../../src/cours/all.js';
import { lessonById } from '../../src/cours/index.js';
import { courantMono, courantTri, kvaTri, neutre, autonomie, terreMax, bilanEnergie, CHARGES } from '../../src/cours/expl_energie.js';
import { FORMATS_C, ECHANTILLONNAGES, debitBrut, rapportCompression, bitsParPixel, gop, propagation, CODECS, qualite } from '../../src/cours/signal_compression.js';
import { CAMS_PLAN, ACTIONS, sensEcran, coupe, focalePour, serreW } from '../../src/cours/real_plan.js';
import { goParHeure, profondeur, tailleGo, transfert } from '../../src/cours/ralentis_fichiers.js';
import { lambda, fsplKm, fresnel1, renflement, gainParabole, ouverture, perteDiffraction, liaison } from '../../src/cours/hf_fresnel.js';
import { fspl } from '../../src/cours/hf.js';

const près = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) <= e, `${a} ≠ ${b}`);

test('les cinq leçons sont écrites et rangées dans leur chapitre', () => {
  for (const [id, ch] of [['expl-energie', 'exploitation'], ['signal-compression', 'signal'], ['real-plan', 'realisation'], ['ralentis-fichiers', 'ralentis'], ['hf-fresnel', 'hf']]) {
    const f = lessonById(id); assert.ok(f, id); assert.equal(f.chapter.id, ch);
  }
});

test('énergie : triphasé, neutre, onduleur, terre', () => {
  près(kvaTri(63), 43.647, 0.01); près(kvaTri(125), 86.6, 0.01);
  près(courantMono(2300, 1), 10); près(courantTri(Math.sqrt(3) * 400 * 10), 10);
  près(neutre(20, 20, 20), 0); près(neutre(30, 0, 0), 30); près(neutre(30, 30, 0), 30);
  près(autonomie(3000, 9000), 18); assert.equal(autonomie(1000, 0), Infinity);
  près(terreMax(30), 1666.67, 0.01); près(terreMax(300), 166.67, 0.01); près(terreMax(30, 25), 833.33, 0.01);
  // tout sur L1 : la phase 1 porte plus que les autres ; réparti, les trois sont proches
  const tout1 = Object.fromEntries(CHARGES.filter((c) => !c.tri).map((c) => [c.id, 0]));
  const B1 = bilanEnergie(tout1, { calibre: 63, kva: 60, wh: 3000 });
  assert.ok(B1.I[0] > 63 && B1.IN > 50, 'tout sur L1 : la phase déclenche, le neutre porte tout');
  const rep = { ccu: 0, mel: 1, evs: 2, grille: 1, ecrans: 2, son: 0, tx: 0, eclair: 1 };
  const B2 = bilanEnergie(rep, { calibre: 63, kva: 60, wh: 3000 });
  assert.ok(B2.imax < 0.8 * 63 && B2.desequilibre < 0.2, JSON.stringify(B2.I));
  près(B2.auto, 3000 * 0.9 / 12300 * 60, 1e-9);
});

test('compression : débit brut, rapport, bits par pixel, qualité', () => {
  const f = FORMATS_C['1080p50'], e = ECHANTILLONNAGES['422-10'];
  assert.equal(debitBrut(f, e), 2073600000);
  près(rapportCompression(debitBrut(f, e), 25e6), 82.944, 1e-6);
  près(bitsParPixel(200e6, f), 1.929, 0.001);
  près(bitsParPixel(25e6, FORMATS_C['2160p50']) * 8, bitsParPixel(25e6, FORMATS_C['1080i50']), 1e-9);
  assert.equal(qualite('jxs', 1.93), 'bon'); assert.equal(qualite('hevc', 0.05), 'artefacts');
  assert.ok(CODECS.jxs.lat(f) < 1 && CODECS.hevc.lat(f, 3) > 400, 'JPEG XS sous la milliseconde, HEVC à quelques centaines');
});

test('GOP : types et propagation d\'une erreur', () => {
  assert.deepEqual(gop(12, 3).join(''), 'IBBPBBPBBPBB');
  assert.deepEqual(gop(6, 1).join(''), 'IPPPPP');
  const T = [...gop(12, 3), ...gop(12, 3)];
  assert.deepEqual(propagation(T, 1), [1], 'une B : elle seule');
  assert.deepEqual(propagation(T, 3), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], 'une P : les B d\'avant, puis jusqu\'à la prochaine I');
  assert.deepEqual(propagation(T, 0), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], 'une I : tout son GOP');
  assert.deepEqual(propagation(['I', 'I', 'I'], 1), [1], 'intra : une image');
});

test('plan caméras : sens du jeu à l\'écran, axe, focales', () => {
  const cam = (id) => CAMS_PLAN.find((c) => c.id === id);
  const A = ACTIONS.find((a) => a.id === 'attaque');
  assert.equal(sensEcran(cam('c1'), A.b, A.v), 1, 'la principale : vers la droite');
  assert.equal(sensEcran(cam('c9'), A.b, A.v), -1, 'la reverse : vers la gauche');
  assert.equal(sensEcran(cam('c8'), A.b, A.v), 0, 'derrière le but : dans l\'axe');
  assert.equal(coupe(cam('c1'), cam('c9'), A.b, A.v).ok, false);
  assert.equal(coupe(cam('c1'), cam('c4'), A.b, A.v).ok, true);
  assert.ok(coupe(cam('c1'), cam('c8'), A.b, A.v).neutre);
  près(focalePour(60, 40), 14.385, 0.001); près(serreW(), 2.6 * 16 / 9);
});

test('serveur ralenti : Go par heure, boucle, taille et transfert', () => {
  près(goParHeure(185), 83.25); près(tailleGo(120, 185), 2.775);
  près(profondeur(12, 200, 6, 185), 11800 / 499.5, 1e-9);
  assert.equal(profondeur(1, 2000, 4, 100), 0, 'plus de place libre : la boucle est vide');
  près(transfert(1, 10), 8 / 7, 1e-9);
});

test('liaison point à point : Fresnel, renflement, parabole, diffraction', () => {
  // la même formule que hf.js, en km et GHz
  for (const [d, f] of [[1, 2.4], [5, 7], [20, 13]]) près(fsplKm(d, f), fspl(d * 1000, f * 1000), 0.02);
  // r1 = √(λ d1 d2 / D)
  près(fresnel1(2.5, 2.5, 7), Math.sqrt(lambda(7) * 2500 * 2500 / 5000), 0.01);
  près(fresnel1(2, 2, 7), 6.546, 0.01);
  près(renflement(10, 10), 5.887, 0.01);
  près(gainParabole(0.6, 7), 30.27, 0.05); près(gainParabole(1.2, 7) - gainParabole(0.6, 7), 6.02, 0.01);
  près(ouverture(0.6, 7), 5.0, 0.05);
  près(perteDiffraction(0), 6.03, 0.02); assert.equal(perteDiffraction(0.6), 0); assert.ok(perteDiffraction(-0.5) > 10);
  // la liaison de départ de la manipulation : obstruée ; mâts montés à 19 m, dégagée
  const L = { D: 5, f: 7, h1: 10, h2: 12, ho: 14, xo: 2, dant: 0.6, p: 20 };
  assert.ok(liaison(L).rel < 0);
  const H = liaison({ ...L, h1: 19, h2: 19 }); assert.ok(H.rel >= 0.6 && H.diff === 0 && H.marge > 15, JSON.stringify(H));
});

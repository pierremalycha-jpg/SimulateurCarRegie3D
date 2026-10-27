// Le chapitre « La caméra » du Cours, de la lentille frontale au moniteur : chacune des 51 notions de la caméra en 3D
// reprise par exactement une leçon (champ camlab), les sept parties dans l'ordre du trajet de la lumière, le rangement
// par niveau, les banques de quiz tirées des questions d'Olivier, et le modèle pur des manipulations
// (cours/camera_calc.js) : Fresnel, angle de champ, sensibilité, diaphragmes, codes 10 bits, gamma, knee, Y'CbCr,
// vectorscope, débits SDI, entrée en boucle, PLUGE, HLG, super ralenti.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../helpers/scene.mjs';
import '../../src/cours/all.js';
import { CHAPTERS, lessonById, leconDeNotion } from '../../src/cours/index.js';
import { PARTIES_CAMERA } from '../../src/cours/camera.js';
import { PARCOURS } from '../../src/cours/parcours.js';
import { NOTIONS, ORDRE } from '../../src/camlab/notions/index.js';
import { questionDuModule, quizDe } from '../../src/cours/camera_kit.js';
import * as K from '../../src/cours/camera_calc.js';

const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;

test('les 51 notions de la caméra en 3D : chacune reprise par exactement une leçon du chapitre', () => {
  const ch = CHAPTERS.find((c) => c.id === 'camera');
  const vus = new Map();
  for (const L of ch.lessons) for (const n of L.camlab || []) {
    assert.ok(NOTIONS[n], `${L.id} : notion inconnue ${n}`);
    assert.ok(!vus.has(n), `${n} reprise par ${vus.get(n)} et ${L.id}`); vus.set(n, L.id);
  }
  assert.deepEqual(ORDRE.filter((n) => !vus.has(n)), [], 'notions sans leçon');
  assert.equal(vus.size, 51);
  for (const [n, id] of vus) assert.equal(leconDeNotion(n).id, id, `la fiche ${n} renvoie à sa leçon`);
  // une leçon d'une autre catégorie ne reprend aucune notion de la caméra
  for (const c of CHAPTERS) if (c.id !== 'camera') for (const L of c.lessons) assert.ok(!(L.camlab || []).length, `${L.id} hors du chapitre`);
});

test('sept parties, dans l\'ordre du trajet de la lumière : chaque leçon dans une partie, le parcours en quatre niveaux', () => {
  const ch = CHAPTERS.find((c) => c.id === 'camera');
  assert.deepEqual(PARTIES_CAMERA.map(([p]) => p), ['L\'objectif', 'Filtres, prisme et capteurs', 'Le traitement de l\'image', 'Le corps, le viseur et le cadreur', 'La voie caméra', 'Jusqu\'au moniteur', 'Pour aller plus loin']);
  const ids = PARTIES_CAMERA.flatMap(([, l]) => l);
  assert.equal(new Set(ids).size, ids.length, 'une leçon dans deux parties');
  assert.deepEqual(ch.lessons.map((l) => l.id), ids, 'les leçons dans l\'ordre des parties');
  assert.equal(ch.lessons.length, 18);
  for (const L of ch.lessons) assert.ok(L.partie, `${L.id} : sa partie`);
  assert.deepEqual(Object.keys(PARCOURS.camera), ['debutant', 'intermediaire', 'avance', 'expert']);
  // dans chaque niveau, les leçons suivent l'ordre des parties (la frontale avant le moniteur) ; la vue d'ensemble de
  // la chaîne caméra ouvre le niveau Débutant
  assert.equal(PARCOURS.camera.debutant[0], 'camera-systeme');
  for (const lecons of Object.values(PARCOURS.camera)) {
    const rang = lecons.filter((id) => id !== 'camera-systeme').map((id) => ids.indexOf(id));
    assert.deepEqual([...rang].sort((a, b) => a - b), rang, `ordre du trajet : ${lecons.join(', ')}`);
  }
  // les exercices pratiques déplacés vers la leçon qui en parle
  const ex = (id) => (lessonById(id).lesson.exercises || []).map((x) => x.id);
  assert.ok(ex('camera-viseur').includes('cadreur-cadrer') && ex('camera-corps').includes('materiel-camera') && ex('camera-exposition').includes('vision-exposition'));
  assert.ok(!ex('camera-systeme').includes('cadreur-cadrer') && ex('camera-systeme').includes('ccu-depannage'));
});

test('le quiz d\'une leçon : les questions d\'Olivier converties, trois choix, une explication par choix faux', () => {
  const Q = NOTIONS.iris.quiz[0], C = questionDuModule(Q);
  assert.equal(C.q, Q.q); assert.equal(C.answer, Q.ok); assert.equal(C.choices.length, 3);
  C.choices.forEach((c, k) => assert.ok(k === Q.ok ? typeof c === 'string' : Array.isArray(c) && c[1], `choix ${k}`));
  assert.ok(!/^Exact/.test(C.why), 'le Cours écrit lui-même « Exact. »');
  const bank = quizDe(['iris', 'pdc']);
  assert.ok(bank.length >= 7, 'trois questions par notion, et celles du quiz de chapitre');
  assert.equal(new Set(bank.map((q) => q.q)).size, bank.length);
  for (const id of ['camera-focale', 'camera-peinture', 'camera-moniteur']) assert.ok(lessonById(id).lesson.quiz.length >= 6, id);
});

test('l\'objectif : Fresnel, angle de champ, largeur cadrée, ramping, diffraction, macro', () => {
  assert.ok(near(K.fresnel(1.5), 0.04));
  assert.ok(near(K.transmission(30, K.fresnel()), 0.2939, 1e-4), '29 % en verre nu');
  assert.ok(near(K.transmission(30, K.TRAITEMENTS.multi), 0.942, 1e-3), '94 % en multicouche');
  assert.ok(near(K.angleDeg(9.59, 4.5), 93.6, 0.1) && near(K.angleDeg(9.59, 54), 10.1, 0.1));
  assert.ok(near(K.focalePour(0.53, 3), 54.3, 0.1), '53 cm à 3 m : 54 mm');
  assert.ok(near(K.focalePourHauteur(2, 80), 215.6, 0.1), 'un joueur en pied à 80 m : 216 mm');
  assert.ok(near(K.EQUIV_24x36, 3.75, 0.01));
  assert.ok(near(K.nombreF(1.8, 54), 1.8 * 54 / 41, 1e-9) && K.nombreF(2.8, 54) === 2.8, 'ramping seulement iris en butée');
  assert.ok(near(K.nombreF(1.8, 20, true), 3.6, 1e-9), 'doubleur : f/3,6');
  assert.ok(near(K.diffraction(16), 21.47, 0.01) && near(K.photosite(), 5, 0.01));
  assert.ok(near(K.decalageImage(4.5, 0.12), 0.101, 0.001) && near(K.decalageImage(54, 0.12), 14.58, 0.01));
});

test('la lumière et les capteurs : sensibilité, budget en diaphragmes, mireds, moiré, scintillement', () => {
  assert.ok(near(K.irisPour(400), 5.81, 0.01) && near(K.irisPour(10000, 1 / 16), 7.27, 0.01));
  assert.ok(near(K.bilanExposition({ lux: 400, N: K.irisPour(400) }), 0, 1e-9), 'f/5,8 à 400 lux : exposé juste');
  assert.ok(near(K.bilanExposition({ lux: 2000, N: 13, gainDb: 6.0206 }), 1, 1e-3), '+6 dB : un diaphragme');
  assert.equal(K.diaphND(1 / 64), 6); assert.ok(near(K.diaphShutter(1 / 100), 1));
  assert.equal(K.snrGain(12), 48);
  assert.ok(near(K.mired(3200) - K.mired(5600), 133.9, 0.1));
  assert.ok(near(K.focaleMoire(2, 3), 15, 0.1) && near(K.focaleMoire(3.9, 8), 20.5, 0.1));
  assert.ok(near(K.wien(3200), 906, 1));
  assert.ok(!K.scintille(1 / 50) && !K.scintille(1 / 100) && K.scintille(1 / 60) && K.scintille(1 / 125));
  assert.ok(near(K.bouge(5, 1 / 50), 0.1) && near(K.bouge(5, 1 / 500), 0.01));
  assert.deepEqual(['720p50', '1080i50', '1080p50', '2160p50'].map((f) => K.debitSDI(f)), [1.485, 1.485, 2.97, 11.88]);
});

test('le traitement : codes 10 bits, gamma BT.709, knee, matrice, Y\'CbCr et vectorscope', () => {
  assert.deepEqual([K.code10(0), K.code10(50), K.code10(100), K.code10(109), K.code8(100)], [64, 502, 940, 1019, 235]);
  assert.ok(near(K.pctDe(940), 100) && near(K.mV(100), 700));
  assert.ok(near(K.oetf709(0.18) * 100, 40.9, 0.1) && near(K.oetf709(0.02) * 100, 9.0, 0.1) && near(K.oetf709(1), 1, 1e-3));
  assert.ok(near(K.gammaCourbe(0.18, 0.45), K.oetf709(0.18), 1e-9), 'la courbe réglée vaut la BT.709 à 0,45');
  assert.ok(K.gammaCourbe(0.18, 0.4) > K.gammaCourbe(0.18, 0.45), 'un exposant plus petit relève les tons moyens');
  assert.ok(near(K.kneeClip(1.9, 0.9, 0.1, 1.09), 1.0, 1e-9), '190 % de signal sortent à 100 % (point 90 %, pente 0,1)');
  assert.equal(K.kneeClip(1.5, 0.95, 1, 1.03), 1.03, 'le white clip coupe');
  assert.ok(near(K.signalDe(0, { black: 0.003, kneeOn: false }), 1.35, 0.01), 'le master black pose le noir');
  assert.equal(K.signalDe(0.002, { black: -0.004, kneeOn: false }), 0, 'un noir trop bas bouche les ombres');
  assert.deepEqual(K.matrice([0.5, 0.5, 0.5], { rg: 0.2, gb: -0.1 }), [0.5, 0.5, 0.5], 'la matrice ne touche pas aux gris');
  assert.deepEqual(K.BARRES.map((b) => Math.round(K.lumaBarre(b))), [75, 70, 59, 54, 21, 16, 5]);
  assert.deepEqual(K.BARRES.slice(1).map((b) => Math.round(K.vecteur(0.75 * b[1], 0.75 * b[2], 0.75 * b[3]).angle)), [175, 283, 230, 50, 103, 355]);
  const c = K.ycbcr(0.5, 0.5, 0.5); assert.ok(near(c.cb, 0) && near(c.cr, 0) && K.codeC(0) === 512);
});

test('la voie et le moniteur : boucle de référence, tri-level, PLUGE, BT.1886, bleu seul', () => {
  assert.equal(K.amplitudeBoucle(0), 2); assert.equal(K.amplitudeBoucle(1), 1); assert.ok(near(K.amplitudeBoucle(2), 2 / 3));
  assert.ok(near(K.triLevelUs(), 0.593, 0.001));
  assert.ok(K.plugeJuste(0) && !K.plugeJuste(1) && !K.plugeJuste(-2) && !K.plugeJuste(-1), 'la −2 % disparaît, la +2 % reste juste visible');
  assert.ok(near(K.luminanceEcran(1), 100) && near(K.luminanceEcran(0.5), 18.9, 0.1));
  const grise = K.bleuSeul(K.BARRES[0]); for (const b of [K.BARRES[2], K.BARRES[4], K.BARRES[6]]) assert.ok(near(K.bleuSeul(b), grise, 1e-9), `${b[0]} en bleu seul`);
  assert.ok(K.bleuSeul(K.BARRES[6], 1.2) > grise, 'chroma trop forte : la barre bleue plus claire');
  assert.ok(near(K.margeSecurite(90), 96) && near(K.couple(7, 0.02), 1.37, 0.01));
  assert.ok(near(K.autonomie(95, 37), 2.57, 0.01) && near(K.courantDC(32), 2.67, 0.01));
});

test('plus loin : HLG (blanc de référence à 75 %, gris à 38 %), Super 35, super ralenti', () => {
  const E = K.hlgInverse(0.75);
  assert.ok(near(K.hlg(E), 0.75, 1e-9) && near(K.hlg(1), 1, 1e-6) && near(K.hlg(1 / 12), 0.5, 1e-9));
  assert.ok(near(K.hlg(0.18 * E) * 100, 37.8, 0.2), 'BT.2408 : le gris 18 % vers 38 %');
  assert.ok(K.pdcTotale(149, 2.8, 3, 0.011 * K.CROP_S35) < K.pdcTotale(58, 2.8, 3) / 2, 'Super 35 : bien moins de profondeur de champ');
  const h = K.hfr(3); assert.ok(near(h.diaph, 1.585, 0.001) && near(h.fluideJusqua, 1 / 3) && h.phases === 3 && near(h.pose, 1 / 150));
});
